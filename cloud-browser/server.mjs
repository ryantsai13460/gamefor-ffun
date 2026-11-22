import { createHash, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { approvedUrl, createEgressProxy, normalizeAllowedOrigins } from "./egress.mjs";
import { createSession, validInput, validQuality } from "./session.mjs";

const loopback = "127.0.0.1";
const startTimeout = 5000;
const commandBudget = 180;
const queueLimit = 64;
const addressLimit = 2048;
const websocketPath = "/v1/session";
const simpleCommands = new Set(["back", "forward", "reload", "home", "new-tab"]);

function normalizeClientOrigins(raw = []) {
  const values = typeof raw === "string" ? raw.split(",") : raw;
  const origins = new Set();
  for (const value of values) {
    const entry = value.trim();
    if (!entry) continue;
    const url = new URL(entry);
    const isLocalHttp = url.protocol === "http:" && [loopback, "localhost", "[::1]"].includes(url.hostname);
    if (entry !== url.origin || (!isLocalHttp && url.protocol !== "https:")) {
      throw new Error("Client origins must be exact HTTPS origins or local HTTP preview origins.");
    }
    origins.add(url.origin);
  }
  return origins;
}

function boundedInteger(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}.`);
  return value;
}

function parseMessage(bytes) {
  try {
    const result = JSON.parse(bytes.toString("utf8"));
    if (result && typeof result === "object" && !Array.isArray(result) && typeof result.type === "string") return result;
  } catch { /* The caller reports the invalid message. */ }
  return null;
}

function validCommand(message) {
  if (simpleCommands.has(message.type)) return true;
  switch (message.type) {
    case "navigate": return typeof message.url === "string" && message.url.length <= addressLimit;
    case "search": return typeof message.query === "string" && message.query.length <= 200 && Boolean(message.query.trim());
    case "quality": return validQuality(message.quality);
    case "select-tab":
    case "close-tab": return typeof message.id === "string" && /^\d{1,6}$/.test(message.id);
    case "input": return validInput(message);
    default: return false;
  }
}

function hashCode(code) {
  return createHash("sha256").update(code, "utf8").digest();
}

function rejectUpgrade(socket, status) {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

export function createCloudBrowserServer({
  clientOrigins, allowedOrigins, accessCode, searchUrl, chromiumPath, chromiumSandbox = true,
  fixtureRoutes, maxSessions = 2, maxTabs = 5, idleMs = 5 * 60_000, maxAgeMs = 20 * 60_000
} = {}) {
  clientOrigins = normalizeClientOrigins(clientOrigins);
  allowedOrigins = normalizeAllowedOrigins(allowedOrigins);
  if (!clientOrigins.size || !allowedOrigins.size) throw new Error("Configure at least one client origin and one approved destination origin.");
  if (typeof accessCode !== "string" || Buffer.byteLength(accessCode) < 16 || Buffer.byteLength(accessCode) > 256) {
    throw new Error("The access code must contain 16 to 256 bytes.");
  }
  const expectedCode = hashCode(accessCode);
  const search = searchUrl ? approvedUrl(searchUrl, allowedOrigins) : null;
  if (searchUrl && !search) throw new Error("The search URL must use an approved HTTPS origin.");
  searchUrl = search?.href;
  boundedInteger(maxSessions, 1, 4, "session limit");
  boundedInteger(maxTabs, 1, 6, "tab limit");
  boundedInteger(idleMs, 250, 5 * 60_000, "idle timeout");
  boundedInteger(maxAgeMs, 1000, 20 * 60_000, "session lifetime");
  if (fixtureRoutes !== undefined && (!(fixtureRoutes instanceof Map) || !fixtureRoutes.size)) {
    throw new Error("Local fixtures must contain at least one response.");
  }
  if (chromiumSandbox !== true && !(chromiumSandbox === false && fixtureRoutes)) {
    throw new Error("Chromium sandboxing is required for networked sessions.");
  }
  if (fixtureRoutes) {
    if (Array.from(clientOrigins).some(origin => ![loopback, "localhost", "[::1]"].includes(new URL(origin).hostname))) {
      throw new Error("Local fixtures require local client origins.");
    }
    fixtureRoutes = new Map(fixtureRoutes);
    for (const [url, fixture] of fixtureRoutes) {
      if (!approvedUrl(url, allowedOrigins) || !fixture || typeof fixture.body !== "string") {
        throw new Error("Local fixtures require approved HTTPS routes and literal response bodies.");
      }
    }
  }

  const peers = new Set();
  let activeCount = 0;
  let egress;
  let startup;
  let shutdown;
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 5000, headersTimeout: 5000 }, (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end('{"status":"ok"}');
    } else {
      response.writeHead(404, { "Cache-Control": "no-store" }).end();
    }
  });
  server.maxConnections = 24;
  server.keepAliveTimeout = 3000;
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });

  function send(peer, message, binary = false) {
    if (!peer.closing && peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(binary ? message : JSON.stringify(message), { binary }, error => {
        if (error) finish(peer);
      });
    }
  }

  function finish(peer, { message, code = 1000, error = false } = {}) {
    if (peer.closing) return peer.cleanup;
    if (message) send(peer, { type: error ? "error" : "ended", message });
    peer.closing = true;
    peer.queue.length = 0;
    clearTimeout(peer.startTimer);
    let forceClose;
    if (peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.close(code);
      forceClose = setTimeout(() => peer.socket.terminate(), 750);
      forceClose.unref();
      peer.socket.once("close", () => clearTimeout(forceClose));
    }
    peer.cleanup = (async () => {
      await peer.session?.close();
      if (!peer.session) {
        const started = await peer.startup?.catch(() => null);
        await started?.close();
      }
      if (peer.reserved) activeCount--;
      peers.delete(peer);
    })();
    return peer.cleanup;
  }

  async function drain(peer) {
    if (peer.processing || peer.closing || !peer.session) return;
    peer.processing = true;
    try {
      while (!peer.closing && peer.queue.length) {
        const command = peer.queue.shift();
        try {
          await peer.session.handle(command);
        } catch {
          send(peer, { type: "error", message: "The workspace could not complete that action." });
        }
      }
    } finally {
      peer.processing = false;
    }
  }

  function start(peer, message) {
    clearTimeout(peer.startTimer);
    const code = message?.accessCode;
    if (message?.type !== "start" || typeof code !== "string" || Buffer.byteLength(code) > 256 ||
        !timingSafeEqual(hashCode(code), expectedCode)) {
      finish(peer, { message: "The workspace access code is invalid.", code: 1008, error: true });
      return;
    }
    if (activeCount >= maxSessions) {
      finish(peer, { message: "The workspace is busy. Try again after a session ends.", code: 1013, error: true });
      return;
    }
    if (message.quality !== undefined && !validQuality(message.quality)) {
      finish(peer, { message: "Choose a supported stream quality.", code: 1008, error: true });
      return;
    }
    activeCount++;
    peer.reserved = true;
    peer.startedAt = Date.now();
    peer.lastInput = peer.startedAt;
    peer.startup = createSession({
      allowedOrigins, searchUrl, fixtureRoutes, maxTabs, chromiumPath, chromiumSandbox, egress: egress.server,
      quality: message.quality || "auto",
      send: state => send(peer, state),
      sendFrame: frame => send(peer, frame, true),
      bufferedAmount: () => peer.socket.bufferedAmount,
      isOpen: () => !peer.closing && peer.socket.readyState === WebSocket.OPEN,
      onDisconnect: () => finish(peer, { message: "The browser session stopped.", code: 1011 })
    });
    void peer.startup.then(session => {
      peer.session = session;
      return drain(peer);
    }).catch(() => {
      finish(peer, { message: "Chromium could not start. Check the workspace runner setup.", code: 1011, error: true });
    });
  }

  function acceptMessage(peer, bytes, isBinary) {
    if (peer.closing) return;
    const now = Date.now();
    if (now - peer.windowStart >= 1000) {
      peer.windowStart = now;
      peer.messageCount = 0;
    }
    if (++peer.messageCount > commandBudget) {
      finish(peer, { message: "The workspace received too many actions. Reconnect to continue.", code: 1008 });
      return;
    }
    const message = isBinary ? null : parseMessage(bytes);
    if (!peer.reserved) return start(peer, message);
    if (message?.type === "end") return finish(peer, { message: "Session ended." });
    if (!message || !validCommand(message)) {
      send(peer, { type: "error", message: "Unsupported workspace action." });
      return;
    }
    peer.lastInput = now;
    const previous = peer.queue.at(-1);
    if (message.type === "input" && message.action === "move" && previous?.type === "input" && previous.action === "move") {
      peer.queue[peer.queue.length - 1] = message;
    } else if (peer.queue.length >= queueLimit) {
      finish(peer, { message: "The workspace could not keep up with actions. Reconnect to continue.", code: 1013 });
      return;
    } else {
      peer.queue.push(message);
    }
    void drain(peer);
  }

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== websocketPath) return rejectUpgrade(socket, "404 Not Found");
    if (!clientOrigins.has(request.headers.origin)) return rejectUpgrade(socket, "403 Forbidden");
    if (shutdown || peers.size >= maxSessions + 4) return rejectUpgrade(socket, "503 Service Unavailable");
    sockets.handleUpgrade(request, socket, head, client => sockets.emit("connection", client));
  });
  server.on("clientError", (_error, socket) => rejectUpgrade(socket, "400 Bad Request"));

  sockets.on("connection", socket => {
    const peer = { socket, queue: [], windowStart: Date.now(), messageCount: 0, lastPong: Date.now() };
    peers.add(peer);
    peer.startTimer = setTimeout(() => finish(peer, { message: "The workspace connection timed out.", code: 1008, error: true }), startTimeout);
    peer.startTimer.unref();
    socket.on("message", (bytes, binary) => acceptMessage(peer, bytes, binary));
    socket.on("pong", () => { peer.lastPong = Date.now(); });
    socket.on("close", () => finish(peer));
    socket.on("error", () => {
      socket.terminate();
      finish(peer);
    });
  });

  let lastPing = Date.now();
  const monitor = setInterval(() => {
    const now = Date.now();
    const ping = now - lastPing >= 15_000;
    if (ping) lastPing = now;
    for (const peer of peers) {
      if (peer.closing) continue;
      if (peer.reserved && now - peer.startedAt >= maxAgeMs) {
        finish(peer, { message: "The session reached its time limit." });
      } else if (peer.session && now - peer.lastInput >= idleMs) {
        finish(peer, { message: "The idle session ended." });
      } else if (now - peer.lastPong > 35_000) {
        finish(peer);
      } else if (ping && peer.socket.readyState === WebSocket.OPEN) {
        peer.socket.ping();
      }
    }
  }, Math.min(idleMs, 1000));
  monitor.unref();

  return {
    listen(port = 0) {
      if (shutdown) throw new Error("This workspace runner has stopped.");
      boundedInteger(port, 0, 65535, "port");
      startup ??= (async () => {
        egress = await createEgressProxy(fixtureRoutes ? new Set() : allowedOrigins);
        try {
          server.listen(port, loopback);
          await once(server, "listening");
          return `http://${loopback}:${server.address().port}`;
        } catch (error) {
          await egress.close();
          throw error;
        }
      })();
      return startup;
    },
    close() {
      shutdown ??= (async () => {
        clearInterval(monitor);
        await startup?.catch(() => {});
        await Promise.all([...peers].map(peer => finish(peer, { message: "The workspace runner stopped.", code: 1001 })));
        await new Promise(resolve => sockets.close(resolve));
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await egress?.close();
      })();
      return shutdown;
    }
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const runner = createCloudBrowserServer({
    accessCode: process.env.CLOUD_ACCESS_CODE,
    clientOrigins: process.env.CLOUD_CLIENT_ORIGINS,
    allowedOrigins: process.env.CLOUD_ALLOWED_ORIGINS,
    searchUrl: process.env.CLOUD_SEARCH_URL,
    chromiumPath: process.env.CLOUD_CHROMIUM_PATH
  });
  const origin = await runner.listen(Number(process.env.CLOUD_PORT || 4892));
  console.log(`Gamefor Ffun cloud browser listening at ${origin}`);
  process.once("SIGTERM", () => void runner.close());
  process.once("SIGINT", () => void runner.close());
}
