import { Resolver } from "node:dns/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import { createConnection, isIPv4 } from "node:net";

const httpsPort = 443;
const connectTimeoutMs = 7_000;
const tunnelIdleTimeoutMs = 60_000;
const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const reservedSuffixes = new Set(["alt", "arpa", "corp", "example", "home", "internal", "invalid", "lan", "local", "localhost", "onion", "test"]);

function parseHttpsUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048 || !/^https:\/\//i.test(raw) || /[\\\u0000-\u0020\u007f]/.test(raw)) return null;
  const authority = raw.slice(8).split(/[/?#]/, 1)[0];
  if (!authority || /[@%]/.test(authority)) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const parts = url.hostname.split(".");
  if (url.port || isIPv4(url.hostname) || url.hostname.length > 253 || parts.length < 2 ||
      parts.some(part => !label.test(part)) || reservedSuffixes.has(parts.at(-1))) return null;
  return url;
}

export function normalizeAllowedOrigins(raw = []) {
  const entries = typeof raw === "string" ? raw.split(",") : raw;
  const origins = new Set();
  for (const entry of entries) {
    const value = entry.trim();
    if (!value) continue;
    const url = parseHttpsUrl(value);
    if (!url || !/^https:\/\/[^/?#]+\/?$/i.test(value)) {
      throw new Error("Allowed origins must be exact HTTPS origins on port 443.");
    }
    origins.add(url.origin);
  }
  return origins;
}

export function approvedUrl(raw, allowedOrigins) {
  const url = parseHttpsUrl(raw);
  return url && allowedOrigins.has(url.origin) ? url : null;
}

function publicIPv4(address) {
  if (!isIPv4(address)) return false;
  const [first, second, third] = address.split(".").map(Number);
  return !(first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 168 || (second === 0 && (third === 0 || third === 2)) ||
      (second === 88 && third === 99) || (second === 31 && third === 196) ||
      (second === 52 && third === 193) || (second === 175 && third === 48))) ||
    (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100) ||
      (second === 97 && third === 38))) ||
    (first === 203 && second === 0 && third === 113) || address === "168.63.129.16");
}

function rejectConnect(socket, status) {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

// Dependencies are injectable by local tests. The runner always uses the system DNS and TCP socket.
export async function createEgressProxy(allowedOrigins, {
  resolveIPv4 = host => new Resolver({ timeout: 2_000, tries: 2 }).resolve4(host),
  connect = address => createConnection({ host: address, port: httpsPort, family: 4 })
} = {}) {
  const origins = normalizeAllowedOrigins(allowedOrigins);
  const clients = new Set();
  const relay = createServer({ headersTimeout: 5_000, requestTimeout: 5_000, maxHeaderSize: 8192 }, (_request, response) => {
    response.writeHead(405, { Connection: "close", "Content-Length": "0" }).end();
  });
  relay.maxConnections = 64;

  relay.on("connection", socket => {
    clients.add(socket);
    socket.setTimeout(connectTimeoutMs, () => socket.destroy());
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => socket.destroy());
  });
  relay.on("clientError", (_error, socket) => rejectConnect(socket, "400 Bad Request"));
  relay.on("upgrade", (_request, socket) => rejectConnect(socket, "405 Method Not Allowed"));
  relay.on("connect", async (request, client, head) => {
    if (!/^[a-z0-9.-]+:443$/i.test(request.url)) {
      rejectConnect(client, "403 Forbidden");
      return;
    }
    const url = approvedUrl(`https://${request.url}`, origins);
    if (!url) {
      rejectConnect(client, "403 Forbidden");
      return;
    }

    try {
      const addresses = await resolveIPv4(url.hostname);
      if (client.destroyed) return;
      if (!addresses.length || !addresses.every(publicIPv4)) {
        rejectConnect(client, "403 Forbidden");
        return;
      }

      // Connect with the validated numeric address so the socket performs no second DNS lookup.
      const upstream = connect(addresses[0]);
      let connected = false;
      client.once("close", () => upstream.destroy());
      upstream.setTimeout(connectTimeoutMs, () => upstream.destroy(new Error("Relay timed out")));
      upstream.once("connect", () => {
        if (client.destroyed) return upstream.destroy();
        connected = true;
        client.setTimeout(tunnelIdleTimeoutMs);
        upstream.setTimeout(tunnelIdleTimeoutMs);
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream).pipe(client);
      });
      upstream.on("error", () => {
        if (connected) client.destroy();
        else rejectConnect(client, "502 Bad Gateway");
      });
      upstream.on("close", () => {
        if (connected) client.destroy();
      });
    } catch {
      rejectConnect(client, "502 Bad Gateway");
    }
  });

  relay.listen(0, "127.0.0.1");
  await once(relay, "listening");
  let closed;
  return {
    server: `http://127.0.0.1:${relay.address().port}`,
    close() {
      closed ??= new Promise((resolve, reject) => {
        relay.close(error => error ? reject(error) : resolve());
        for (const client of clients) client.destroy();
      });
      return closed;
    }
  };
}
