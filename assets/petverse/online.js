const sessionPath = "/v1/petverse";
const tokenKey = "gamefor-ffun-petverse-accounts-v1";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const connectionTimeout = 10_000;
const commandTimeout = 10_000;
const queueLimit = 12;
const movementInterval = 100;
const loopbackHosts = new Set(["localhost", "127.0.0.1"]);
const tradeSteps = new Set(["invite", "accept", "cancel", "offer", "confirm"]);
const tradeStates = new Set(["invited", "open", "closed"]);
const roomSteps = new Set(["regenerate", "close"]);
const roomCodePattern = /^PET-[0-9A-F]{10}$/;
const metricPattern = /^[a-z][a-zA-Z0-9-]{0,47}$/;
const positionActions = new Set(["gather", "collect", "rebirth"]);

export function normalizeRoomCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return roomCodePattern.test(code) ? code : null;
}

function normalizeEndpoint(value) {
  if (typeof value !== "string") return null;
  const address = value.trim();
  if (address.length > 500 || /[\\?#\s]|[\u0000-\u001f\u007f]/.test(address)) return null;
  const authority = /^(?:wss?):\/\/([^/]+)/i.exec(address)?.[1];
  if (!authority || authority.includes("@")) return null;

  let url;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  const localSocket = url.protocol === "ws:" && loopbackHosts.has(url.hostname) &&
    loopbackHosts.has(window.location.hostname);
  if (url.protocol !== "wss:" && !localSocket) return null;
  if (url.pathname === "/") url.pathname = sessionPath;
  return url.pathname === sessionPath ? url.href : null;
}

function readTokens() {
  try {
    const records = JSON.parse(window.localStorage.getItem(tokenKey) || "[]");
    return Array.isArray(records) ? records.filter(record =>
      Array.isArray(record) && typeof record[0] === "string" && typeof record[1] === "string" &&
      tokenPattern.test(record[1])).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function storeToken(endpoint, token) {
  try {
    const records = readTokens().filter(([address]) => address !== endpoint);
    window.localStorage.setItem(tokenKey, JSON.stringify([[endpoint, token], ...records].slice(0, 12)));
  } catch {
    // A denied or full storage area leaves this online session usable.
  }
}

function clientError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function serverError(message, fallback) {
  const text = typeof message.message === "string" && message.message.trim().slice(0, 240);
  return clientError(text || fallback, typeof message.code === "string" ? message.code.slice(0, 40) : "server_error");
}

function isProgress(value) {
  return value && typeof value === "object" && value.wallet && Array.isArray(value.inventory) &&
    Array.isArray(value.equipped) && value.upgrades && value.settings && value.stats;
}

function readPosition(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z)) return null;
  return { x: value.x, z: value.z, heading: Number.isFinite(value.heading) ? value.heading : 0 };
}

function readActor(value) {
  const position = readPosition(value);
  if (!position || typeof value.id !== "string" || !value.id || typeof value.name !== "string") return null;
  const pet = value.pet && typeof value.pet.speciesId === "string" && typeof value.pet.variant === "string"
    ? { speciesId: value.pet.speciesId.slice(0, 50), variant: value.pet.variant.slice(0, 20) } : null;
  return { id: value.id.slice(0, 64), name: value.name.trim().slice(0, 36), ...position, pet };
}

function readPeers(value) {
  return Array.isArray(value) ? value.slice(0, 32).map(readActor).filter(Boolean) : [];
}

function readOffer(value) {
  if (!Array.isArray(value) || value.length > 4 || value.some(item => !item ||
      typeof item.id !== "string" || typeof item.speciesId !== "string" || typeof item.variant !== "string")) return null;
  return value.map(({ id, speciesId, variant }) => ({ id, speciesId, variant }));
}

function readTrade(value) {
  if (!value || typeof value.id !== "string" || !tradeStates.has(value.state) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.peer?.id !== "string" ||
      typeof value.peer?.name !== "string") return null;
  const mine = readOffer(value.mine);
  const theirs = readOffer(value.theirs);
  if (!mine || !theirs) return null;
  return {
    id: value.id, state: value.state, revision: value.revision, mine, theirs,
    peer: { id: value.peer.id, name: value.peer.name.slice(0, 36) },
    initiatedByMe: value.initiatedByMe === true,
    confirmedByMe: value.confirmedByMe === true,
    confirmedByPeer: value.confirmedByPeer === true,
    expiresAt: Number.isFinite(value.expiresAt) ? value.expiresAt : undefined,
    message: typeof value.message === "string" ? value.message.slice(0, 180) : ""
  };
}

function readRoom(value, selfId) {
  if (!value || typeof value.id !== "string" || !value.id || value.id.length > 64 ||
      typeof value.hostId !== "string" || !value.hostId || value.hostId.length > 64 ||
      !Number.isInteger(value.maxPlayers) || value.maxPlayers < 2 || value.maxPlayers > 32 ||
      !Number.isInteger(value.playerCount) || value.playerCount < 1 || value.playerCount > value.maxPlayers ||
      !Number.isSafeInteger(value.expiresAt) || value.expiresAt < 0) return null;
  const { id, hostId, maxPlayers, playerCount, expiresAt } = value;
  const room = { id, hostId, maxPlayers, playerCount, expiresAt };
  if (hostId === selfId) {
    const code = normalizeRoomCode(value.code);
    if (!code) return null;
    room.code = code;
  }
  return room;
}

function readResourceCooldowns(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 64).filter(([nodeId, until]) =>
    /^[a-z0-9][a-z0-9-]{0,63}$/.test(nodeId) && Number.isSafeInteger(until) && until >= 0));
}

function readLeaderboard(message, metric) {
  const { entries } = message;
  if (message.metric !== metric || !Array.isArray(entries) || entries.length > 32 ||
      entries.some(entry => !entry || typeof entry.id !== "string" || !entry.id ||
        typeof entry.name !== "string" || !Number.isFinite(entry.score) || entry.score < 0)) return null;
  return { metric, entries: entries.map(({ id, name, score }) => ({
    id: id.slice(0, 64), name: name.trim().slice(0, 36), score
  })) };
}

function parseMessage(value) {
  if (typeof value !== "string" || value.length > 400_000) return null;
  try {
    const message = JSON.parse(value);
    return message && typeof message === "object" && typeof message.type === "string" ? message : null;
  } catch {
    return null;
  }
}

export function createOnlineClient({ onProgress, onPeers, onPosition, onTrade, onRoom, onRoomClosed, onResources, onClose } = {}) {
  let active;
  let destroyed = false;

  function close(session, error, unexpected, notify = true) {
    if (active !== session) return;
    active = undefined;
    clearTimeout(session.connectTimer);
    clearTimeout(session.moveTimer);
    clearTimeout(session.pending?.timer);
    if (!session.connected) session.reject(error);
    session.pending?.reject(error);
    for (const request of session.queue) request.reject(error);
    session.queue.length = 0;
    if (session.socket.readyState < WebSocket.CLOSING) session.socket.close();
    if (session.connected && notify) onClose?.({ unexpected, message: error.message });
  }

  function protocolError(session) {
    close(session, clientError("The Petverse server sent an incompatible reply.", "protocol_error"), true);
  }

  function send(session, message) {
    if (active !== session || session.socket.readyState !== WebSocket.OPEN) return false;
    try {
      session.socket.send(JSON.stringify(message));
      return true;
    } catch {
      close(session, clientError("The connection to Petverse was interrupted.", "connection_lost"), true);
      return false;
    }
  }

  function sendNext(session) {
    if (active !== session || !session.connected || session.pending || !session.queue.length) return;
    const request = session.queue.shift();
    session.pending = request;
    if (session.nextMove && positionActions.has(request.message.action?.type)) {
      clearTimeout(session.moveTimer);
      flushMove(session);
    }
    if (!send(session, { ...request.message, requestId: request.id })) {
      close(session, clientError("The connection to Petverse was interrupted.", "connection_lost"), true);
      return;
    }
    request.timer = setTimeout(() => {
      close(session, clientError("Petverse stopped responding. Rejoin to check your saved progress.", "action_timeout"), true);
    }, commandTimeout);
  }

  function receive(session, value) {
    if (active !== session) return;
    const message = parseMessage(value);
    if (!message) return protocolError(session);

    if (!session.connected) {
      if (message.type === "error") return close(session, serverError(message, "Petverse refused the connection."), true);
      const self = readActor(message.self);
      const room = self && readRoom(message.room, self.id);
      if (message.type !== "welcome" || !self || !room || typeof message.token !== "string" ||
          !tokenPattern.test(message.token) || !isProgress(message.progress)) return protocolError(session);
      session.connected = true;
      session.selfId = self.id;
      session.roomId = room.id;
      clearTimeout(session.connectTimer);
      storeToken(session.endpoint, message.token);
      session.resolve({ endpoint: session.endpoint, self, progress: message.progress, peers: readPeers(message.peers),
        room, nodeReadyAt: readResourceCooldowns(message.nodeReadyAt) });
      return;
    }

    if (message.type === "room") {
      const room = readRoom(message.room, session.selfId);
      if (!room || room.id !== session.roomId) return protocolError(session);
      onRoom?.(room);
      return;
    }
    if (message.type === "room-closed") {
      const error = serverError(message, "This private meadow has closed.");
      close(session, error, true, !onRoomClosed);
      onRoomClosed?.({ message: error.message });
      return;
    }
    if (message.type === "resources") {
      onResources?.(readResourceCooldowns(message.nodeReadyAt));
      return;
    }
    if (message.type === "peers") {
      onPeers?.(readPeers(message.peers));
      return;
    }
    if (message.type === "position") {
      const position = readPosition(message);
      if (position) onPosition?.(position);
      return;
    }
    if (message.type === "trade") {
      const trade = readTrade(message.trade);
      if (!trade) return protocolError(session);
      onTrade?.(trade);
      return;
    }
    if (message.type === "player-state") {
      if (!isProgress(message.progress) || typeof message.event?.type !== "string") return protocolError(session);
      onProgress?.(message.progress, message.event);
      return;
    }
    if (message.type === "error" && !message.requestId) {
      close(session, serverError(message, "The Petverse server ended the session."), true);
      return;
    }

    const request = session.pending;
    if (!request || message.requestId !== request.id) return;
    if (message.type !== "error" && message.type !== request.resultType) return protocolError(session);
    if (message.type === "result" && (!isProgress(message.progress) || typeof message.event?.type !== "string")) {
      return protocolError(session);
    }

    clearTimeout(request.timer);
    session.pending = undefined;
    if (message.type === "error") {
      request.reject(serverError(message, "Petverse could not complete that action."));
      sendNext(session);
      return;
    }

    let result;
    if (message.type === "result") result = { progress: message.progress, event: message.event };
    if (message.type === "leaderboard-result") {
      result = readLeaderboard(message, request.message.metric);
      if (!result) {
        request.reject(clientError("The meadow rankings could not be read.", "protocol_error"));
        return protocolError(session);
      }
    }
    request.resolve(result);
    sendNext(session);
    if (message.type === "result") onProgress?.(result.progress, result.event);
  }

  async function connect(value, { mode, code, maxPlayers, newGuest = false } = {}) {
    if (destroyed) throw clientError("This Petverse player has been closed.", "closed");
    if (active) throw clientError("Leave your current private meadow first.", "already_connected");
    if (mode !== "create" && mode !== "join") {
      throw clientError("Create a private meadow or join with a friend's code.", "invalid_room_mode");
    }
    const hello = { type: "hello", mode };
    if (mode === "join") {
      hello.code = normalizeRoomCode(code);
      if (!hello.code) throw clientError("Enter the full PET- invitation code.", "invalid_code");
    } else if (maxPlayers !== undefined) {
      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 32) {
        throw clientError("Choose a player limit from 2 to 32.", "invalid_room_limit");
      }
      hello.maxPlayers = maxPlayers;
    }
    const endpoint = normalizeEndpoint(value);
    if (!endpoint) throw clientError("Enter a secure Petverse server address, starting with wss://.", "invalid_endpoint");

    const socket = new WebSocket(endpoint);
    const token = newGuest ? undefined : readTokens().find(([address]) => address === endpoint)?.[1];
    return new Promise((resolve, reject) => {
      const session = { socket, endpoint, resolve, reject, queue: [], connected: false, lastMove: -Infinity };
      active = session;
      session.connectTimer = setTimeout(() => {
        close(session, clientError("The Petverse server did not answer in time.", "connect_timeout"), true);
      }, connectionTimeout);
      socket.addEventListener("open", () => send(session, { ...hello, token }));
      socket.addEventListener("message", event => receive(session, event.data));
      socket.addEventListener("close", () => {
        close(session, clientError("The Petverse server closed the connection.", "connection_lost"), true);
      });
      socket.addEventListener("error", () => {
        close(session, clientError("Could not connect to the Petverse server.", "connection_lost"), true);
      });
    });
  }

  async function request(message, resultType) {
    const session = active;
    if (!session?.connected) throw clientError("Join an online session first.", "offline");
    if (session.queue.length + Number(Boolean(session.pending)) >= queueLimit) {
      throw clientError("There are too many pending actions. Try again in a moment.", "queue_full");
    }
    const encoded = JSON.stringify(message);
    if (new TextEncoder().encode(encoded).length > 3500) {
      throw clientError("That Petverse action is too large.", "invalid_action");
    }
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), value => value.toString(16).padStart(2, "0")).join("");
    const snapshot = JSON.parse(encoded);
    return new Promise((resolve, reject) => {
      session.queue.push({ id, message: snapshot, resultType, resolve, reject });
      sendNext(session);
    });
  }

  async function command(action) {
    if (!action || typeof action !== "object" || typeof action.type !== "string") {
      throw clientError("Choose a valid Petverse action.", "invalid_action");
    }
    return request({ type: "action", action }, "result");
  }

  async function trade(step, { peerId, tradeId, petIds, revision } = {}) {
    if (!tradeSteps.has(step)) throw clientError("Choose a valid trade action.", "invalid_action");
    return request({ type: "trade", step, peerId, tradeId, petIds, revision }, "trade-result");
  }

  async function room(step) {
    if (!roomSteps.has(step)) throw clientError("Choose a valid private meadow action.", "invalid_action");
    return request({ type: "room", step }, "room-result");
  }

  async function leaderboard(metric) {
    if (typeof metric !== "string" || !metricPattern.test(metric)) {
      throw clientError("Choose a valid leaderboard category.", "invalid_action");
    }
    return request({ type: "leaderboard", metric }, "leaderboard-result");
  }

  function flushMove(session) {
    session.moveTimer = undefined;
    if (active !== session || !session.nextMove) return;
    if (session.socket.bufferedAmount > 4096) {
      session.moveTimer = setTimeout(() => flushMove(session), movementInterval);
      return;
    }
    const next = session.nextMove;
    session.nextMove = undefined;
    session.lastMove = performance.now();
    send(session, { type: "move", ...next });
  }

  function move(value) {
    const session = active;
    if (!session?.connected) return;
    const position = readPosition(value);
    if (!position) return;
    session.nextMove = position;
    if (session.moveTimer !== undefined) return;
    const wait = movementInterval - (performance.now() - session.lastMove);
    if (wait > 0) session.moveTimer = setTimeout(() => flushMove(session), wait);
    else flushMove(session);
  }

  function disconnect() {
    if (active) close(active, clientError("You left the online session.", "offline"), false);
  }

  function destroy() {
    destroyed = true;
    if (active) close(active, clientError("The Petverse player was closed.", "closed"), false, false);
  }

  return { connect, command, trade, room, leaderboard, move, disconnect, destroy };
}
