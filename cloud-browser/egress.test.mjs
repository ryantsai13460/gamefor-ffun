import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection, createServer } from "node:net";
import test from "node:test";
import { approvedUrl, createEgressProxy, normalizeAllowedOrigins } from "./egress.mjs";

const fixture = "https://fixture.example.com";

function relayRequest(server, request) {
  const port = Number(new URL(server).port);
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let response = "";
    socket.setEncoding("utf8");
    socket.setTimeout(2_000, () => socket.destroy(new Error("Request timed out")));
    socket.once("connect", () => socket.write(request));
    socket.on("data", chunk => response += chunk);
    socket.once("error", reject);
    socket.once("end", () => resolve(response));
  });
}

function connectRequest(host, head = "") {
  return `CONNECT ${host} HTTP/1.1\r\nHost: ${host}\r\n\r\n${head}`;
}

test("operator origin configuration requires exact HTTPS origins on the default port", () => {
  const origins = normalizeAllowedOrigins(`  ${fixture}/ , HTTPS://Example.COM:443,, ${fixture}`);
  assert.deepEqual([...origins], [fixture, "https://example.com"]);
  assert.deepEqual([...normalizeAllowedOrigins()], []);
  for (const invalid of [
    `${fixture}/page`, `${fixture}?id=1`, `${fixture}#`, `${fixture}:8443`, "http://fixture.example.com",
    "https://*.example.com", "https://fixture.example.com.", "https://user@fixture.example.com",
    "https://localhost", "https://host.local", "https://host.test", "https://127.0.0.1", "https://[::1]"
  ]) assert.throws(() => normalizeAllowedOrigins(invalid), /exact HTTPS origins/);
});

test("approved URLs support paths and query strings on a configured origin", () => {
  const origins = normalizeAllowedOrigins([fixture]);
  const permitted = `${fixture}/article?q=arcade%20guide#section`;
  assert.equal(approvedUrl(permitted, origins)?.href, permitted);
  assert.equal(approvedUrl("https://FIXTURE.example.com:443/", origins)?.href, `${fixture}/`);
  for (const invalid of [
    `http://${new URL(fixture).hostname}`, `${fixture}:8443`, `ftp:${fixture}`, `${fixture}/space here`,
    `${fixture}\\path`, `${fixture}.alternate.org`, "https:///fixture.example.com", "https://@fixture.example.com",
    "https://%66ixture.example.com", "https://other.example.com", "data:text/html,test", "file:///tmp/test"
  ]) assert.equal(approvedUrl(invalid, origins), null, invalid);
});

test("the relay rejects plaintext, upgrade requests, and unapproved CONNECTs before DNS", async t => {
  let queries = 0;
  const relay = await createEgressProxy([fixture], { resolveIPv4: async () => ++queries });
  t.after(relay.close);
  for (const authority of [
    "other.example.com:443", "fixture.example.com:8443", "fixture.example.com:80", "127.0.0.1:443",
    "[::ffff:127.0.0.1]:443", "fixture.example.com/redirect:443"
  ]) assert.match(await relayRequest(relay.server, connectRequest(authority)), /^HTTP\/1.1 403/);
  assert.match(await relayRequest(relay.server, `GET ${fixture}/ HTTP/1.1\r\nHost: fixture.example.com\r\n\r\n`), /^HTTP\/1.1 405/);
  assert.match(await relayRequest(relay.server, "GET / HTTP/1.1\r\nHost: fixture.example.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"), /^HTTP\/1.1 405/);
  assert.equal(queries, 0);
});

test("a configured hostname cannot resolve to a local or reserved address", async t => {
  let addresses = [];
  let connections = 0;
  const relay = await createEgressProxy([fixture], {
    resolveIPv4: async () => addresses,
    connect: () => ++connections
  });
  t.after(relay.close);
  for (const address of [
    "0.0.0.0", "10.0.0.1", "100.100.100.200", "127.5.4.3", "168.63.129.16", "169.254.169.254", "172.31.255.1",
    "192.0.0.1", "192.0.2.1", "192.168.1.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1",
    "240.0.0.1", "255.255.255.255", "::1", "::ffff:127.0.0.1"
  ]) {
    addresses = ["93.184.215.14", address];
    assert.match(await relayRequest(relay.server, connectRequest("fixture.example.com:443")), /^HTTP\/1.1 403/, address);
  }
  addresses = [];
  assert.match(await relayRequest(relay.server, connectRequest("fixture.example.com:443")), /^HTTP\/1.1 403/);
  assert.equal(connections, 0);
});

test("the relay pins a resolved public address and closes active clients", async t => {
  let pin;
  let resolveCount = 0;
  const upstream = createServer(socket => socket.on("data", bytes => socket.end(`echo:${bytes}`)));
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  let relay;
  t.after(async () => {
    await relay?.close();
    await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
  });
  relay = await createEgressProxy([fixture], {
    resolveIPv4: async host => {
      assert.equal(host, "fixture.example.com");
      resolveCount++;
      return ["93.184.215.14"];
    },
    connect(address) {
      pin = address;
      return createConnection({ host: "127.0.0.1", port: upstream.address().port });
    }
  });
  const exchange = await relayRequest(relay.server, connectRequest("fixture.example.com:443", "hello"));
  assert.equal(exchange, "HTTP/1.1 200 Connection Established\r\n\r\necho:hello");
  assert.equal(pin, "93.184.215.14");
  assert.equal(resolveCount, 1);

  const active = createConnection({ host: "127.0.0.1", port: Number(new URL(relay.server).port) });
  const activeClosed = once(active, "close");
  const response = once(active, "data");
  await once(active, "connect");
  active.write(connectRequest("fixture.example.com:443"));
  assert.match(String((await response)[0]), /^HTTP\/1.1 200/);
  assert.equal(resolveCount, 2);
  await relay.close();
  await activeClosed;
});
