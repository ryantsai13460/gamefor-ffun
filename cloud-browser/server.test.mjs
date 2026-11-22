import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";
import { createCloudBrowserServer } from "./server.mjs";

const clientOrigin = "http://127.0.0.1:3000";
const fixtureOrigin = "https://fixture.example.com";
const accessCode = "sandboxed-local-fixture-test-code";

test("networked sessions require Chromium sandboxing", () => {
  assert.throws(() => createCloudBrowserServer({
    clientOrigins: [clientOrigin], allowedOrigins: [fixtureOrigin], accessCode, chromiumSandbox: false
  }), /sandboxing is required/);
});

async function startBackend(t, options = {}) {
  const server = await createCloudBrowserServer({
    clientOrigins: [clientOrigin],
    allowedOrigins: [fixtureOrigin],
    accessCode,
    chromiumPath: process.env.CLOUD_CHROMIUM_PATH || process.env.ARCADE_CHROMIUM,
    chromiumSandbox: false,
    fixtureRoutes: new Map([[`${fixtureOrigin}/`, {
      body: "<!doctype html><title>Cloud browser test fixture</title><h1>Approved content</h1>",
      contentType: "text/html; charset=utf-8"
    }]]),
    ...options
  });
  t.after(() => server.close());
  const origin = await server.listen(0);
  return { origin, endpoint: new URL("/v1/session", origin.replace(/^http:/, "ws:")).href };
}

async function openSessionSocket(t, endpoint) {
  const socket = new WebSocket(endpoint, { origin: clientOrigin, handshakeTimeout: 3_000 });
  const received = new EventEmitter();
  const inbox = [];
  socket.on("message", (body, isBinary) => {
    if (isBinary) return;
    const message = JSON.parse(body.toString());
    inbox.push(message);
    received.emit("message", message);
  });
  t.after(() => socket.terminate());
  await once(socket, "open");
  return {
    socket,
    send(fields) {
      socket.send(JSON.stringify(fields));
    },
    until(predicate) {
      const cached = inbox.find(predicate);
      if (cached) return Promise.resolve(cached);
      return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          received.off("message", listen);
          reject(new Error(`Expected a WebSocket message. Received types: ${inbox.map(message => message.type).join(", ")}`));
        }, 12_000);
        function listen(message) {
          if (!predicate(message)) return;
          clearTimeout(deadline);
          received.off("message", listen);
          resolve(message);
        }
        received.on("message", listen);
      });
    }
  };
}

test("session upgrades reject unapproved origins and invalid access codes", { timeout: 15_000 }, async t => {
  const { origin, endpoint } = await startBackend(t);
  assert.equal((await fetch(`${origin}/healthz`)).status, 200);
  const unknownOrigin = new WebSocket(endpoint, { origin: "https://other.example.com", handshakeTimeout: 3_000 });
  await assert.rejects(once(unknownOrigin, "open"), /403/);

  const client = await openSessionSocket(t, endpoint);
  const closed = once(client.socket, "close");
  client.send({ type: "start", accessCode: "incorrect-local-fixture-code", quality: "auto" });
  const [code] = await closed;
  assert.equal(code, 1008);
});

test("a session requires a well-formed start command", { timeout: 15_000 }, async t => {
  const { endpoint } = await startBackend(t);
  const client = await openSessionSocket(t, endpoint);
  const closed = once(client.socket, "close");
  client.socket.send("unparseable start command");
  const [code] = await closed;
  assert.equal(code, 1008);
});

test("malformed commands and denied navigation leave the approved tab available", { timeout: 25_000 }, async t => {
  const { endpoint } = await startBackend(t);
  const client = await openSessionSocket(t, endpoint);
  client.send({ type: "start", accessCode, quality: "auto" });
  const started = await client.until(message => message.type === "state");
  client.socket.send("unparseable workspace command");
  await client.until(message => message.type === "error" && /unsupported/i.test(message.message));
  client.send({ type: "navigate", url: `${fixtureOrigin}/` });
  await client.until(message => message.type === "state" && message.tabs[0]?.title === "Cloud browser test fixture");

  client.send({ type: "navigate", url: "https://other.example.com/" });
  await client.until(message => message.type === "error" && /approved/i.test(message.message));
  client.send({ type: "new-tab" });
  const updated = await client.until(message => message.type === "state" && message.tabs.length === 2);
  assert.equal(updated.tabs.find(tab => tab.id === started.activeId)?.url, `${fixtureOrigin}/`);
});

test("an idle Chromium session expires and releases the session slot", { timeout: 25_000 }, async t => {
  const { endpoint } = await startBackend(t, { idleMs: 1_200, maxSessions: 1 });
  const client = await openSessionSocket(t, endpoint);
  client.send({ type: "start", accessCode, quality: "auto" });
  await client.until(message => message.type === "state");
  const closed = once(client.socket, "close");
  const sessionEnded = await client.until(message => message.type === "ended");
  assert.match(sessionEnded.message, /idle|inactivity|expire/i);
  await closed;

  // The socket can close before Chromium exits and frees its reserved slot.
  const deadline = Date.now() + 4_000;
  do {
    const next = await openSessionSocket(t, endpoint);
    next.send({ type: "start", accessCode, quality: "auto" });
    const reply = await next.until(message => ["state", "error"].includes(message.type));
    if (reply.type === "state") return;
    assert.match(reply.message, /busy/i);
    await delay(100);
  } while (Date.now() < deadline);
  assert.fail("The expired session did not release its slot.");
});
