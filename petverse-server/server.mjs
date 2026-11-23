import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { applyAction, GATHER_DISTANCE, NODES, SPAWN, VARIANTS, WORLD_LIMIT } from '../assets/petverse/model.js';
import { openStore } from './store.mjs';
import { createTrading } from './trading.mjs';

const endpoint = '/v1/petverse';
const loopback = '127.0.0.1';
const speedLimit = 7.25;
const moveBurst = 2;
const gatherRadius = GATHER_DISTANCE + 0.65;
const requestPattern = /^[A-Za-z0-9_-]{1,64}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const idPattern = /^[A-Za-z0-9_-]{1,48}$/;
const trustedRandom = () => randomBytes(4).readUInt32BE() / 0x1_0000_0000;
const nodeById = new Map(NODES.map(node => [node.id, node]));
const variantKeys = VARIANTS.filter(variant => variant.id !== 'normal').map(variant => variant.id);
const settingKeys = ['stopOnNew', 'stopOnFull', 'autoEquip', 'lockRare', 'multiHatch', 'autoCollect'];

function exactOrigins(initial) {
  const entries = typeof initial === 'string' ? initial.split(',') : initial;
  const values = entries?.map(entry => entry.trim()).filter(Boolean) || [];
  if (!values.length) throw new Error('Configure at least one exact Petverse frontend origin.');
  return new Set(values.map(value => {
    const url = new URL(value);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.origin !== value || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('Use exact HTTPS origins or HTTP loopback preview origins.');
    }
    return value;
  }));
}

function parse(bytes, binary) {
  if (binary) return null;
  try {
    const message = JSON.parse(bytes.toString());
    return message && typeof message === 'object' && !Array.isArray(message) ? message : null;
  } catch {
    return null;
  }
}

function validId(value) {
  return typeof value === 'string' && idPattern.test(value);
}

function validRequestId(value) {
  return typeof value === 'string' && requestPattern.test(value);
}

function booleanFields(input, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(input, key) && typeof input[key] === 'boolean')
    .map(key => [key, input[key]]));
}

function cleanAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
  const { type, mode } = action;
  switch (type) {
    case 'hatch': {
      const { eggId, count } = action;
      if (!validId(eggId) || (mode !== 'manual' && mode !== 'auto')) return null;
      if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 3)) return null;
      return { type, eggId, mode, ...(count === undefined ? {} : { count }) };
    }
    case 'gather':
      return validId(action.nodeId) ? { type, nodeId: action.nodeId, mode: mode === 'auto' ? 'auto' : 'manual' } : null;
    case 'equip':
    case 'favorite':
    case 'lock':
      return validId(action.petId) ? { type, petId: action.petId } : null;
    case 'release':
      return validId(action.petId) && action.confirm === true ? { type, petId: action.petId, confirm: true } : null;
    case 'equip-best':
      return { type };
    case 'upgrade':
      return validId(action.id) ? { type, id: action.id } : null;
    case 'settings': {
      const { settings } = action;
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
      const flags = booleanFields(settings, settingKeys);
      if (settings.stopVariants && typeof settings.stopVariants === 'object' && !Array.isArray(settings.stopVariants)) {
        flags.stopVariants = booleanFields(settings.stopVariants, variantKeys);
      }
      return { type, settings: flags };
    }
    default:
      return null;
  }
}

function validTrade(message) {
  if (message.step === 'invite') return validId(message.peerId);
  if (!validId(message.tradeId)) return false;
  if (message.step === 'accept' || message.step === 'cancel') return true;
  if (message.step === 'confirm') return Number.isSafeInteger(message.revision) && message.revision >= 0;
  return message.step === 'offer' && Array.isArray(message.petIds) && message.petIds.length <= 4 && message.petIds.every(validId);
}

function playerAppearance(player) {
  const pet = player.progress.inventory.find(item => item.id === player.progress.equipped[0]);
  return { id: player.id, name: player.name, ...player.position,
    pet: pet ? { speciesId: pet.speciesId, variant: pet.variant } : null };
}

function rejectUpgrade(socket, status) {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

export function createPetverseServer({ clientOrigins, dbPath = ':memory:', maxPlayers = 16, maxProfiles = 1000 } = {}) {
  const origins = exactOrigins(clientOrigins);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 32 ||
      !Number.isInteger(maxProfiles) || maxProfiles < maxPlayers || maxProfiles > 10_000) throw new Error('Invalid Petverse capacity.');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const store = openStore(dbPath, maxProfiles);
  const players = new Map();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const server = createServer({ headersTimeout: 5000, requestTimeout: 5000, maxHeaderSize: 8192 }, (request, response) => {
    const status = request.method === 'GET' && request.url === '/healthz' ? 200 : 404;
    response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' })
      .end(status === 200 ? '{"status":"ok"}' : '{"status":"not_found"}');
  });
  server.maxConnections = maxPlayers + 12;
  server.keepAliveTimeout = 3000;

  let closing;
  let dirty = false;
  let listening;
  let lastPingAt = Date.now();
  let accountWindowAt = 0;
  let accountsThisWindow = 0;

  function send(player, message, bestEffort = false) {
    const socket = player.socket;
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 256 * 1024) {
      if (!bestEffort) socket.close(1013, 'Connection is too slow.');
      return;
    }
    socket.send(JSON.stringify(message));
  }

  function error(player, code, message, requestId) {
    send(player, { type: 'error', code, message, ...(validRequestId(requestId) ? { requestId } : {}) });
  }

  function progressMessage(player, event, options = {}) {
    return { ...options, progress: player.progress, version: player.version, event };
  }

  const trading = createTrading({ players, send, exchange: store.exchange,
    announceProgress: (player, event) => send(player, progressMessage(player, event, { type: 'player-state' })),
    publicChange: () => { dirty = true; }
  });

  function move(player, message, now) {
    const { x, z, heading = player.position.heading } = message;
    const distance = Number.isFinite(x) && Number.isFinite(z)
      ? Math.hypot(x - player.position.x, z - player.position.z) : Infinity;
    const elapsed = (now - player.lastMoveAt) / 1000;
    player.lastMoveAt = now;
    player.moveBudget = Math.min(moveBurst, player.moveBudget + Math.max(0, elapsed) * speedLimit);
    if (distance > player.moveBudget || Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT ||
        !Number.isFinite(heading) || Math.abs(heading) > 32) {
      if (now - player.lastCorrectionAt >= 400) {
        player.lastCorrectionAt = now;
        send(player, { type: 'position', ...player.position });
      }
      return;
    }
    player.moveBudget -= distance;
    player.position = { x, z, heading: Math.atan2(Math.sin(heading), Math.cos(heading)) };
    dirty = true;
  }

  function act(player, message, now) {
    const requestId = message.requestId;
    const command = cleanAction(message.action);
    if (!command) return error(player, 'invalid_action', 'Choose a supported Petverse action.', requestId);
    const receipt = store.receipt(player, requestId);
    if (receipt) {
      send(player, progressMessage(player, receipt, { type: 'result', requestId, replayed: true }));
      return;
    }
    if (command.type === 'gather') {
      const node = nodeById.get(command.nodeId);
      if (!node || Math.hypot(node.x - player.position.x, node.z - player.position.z) > gatherRadius) {
        return error(player, 'too_far', 'Move closer to this resource to gather it.', requestId);
      }
    }
    const { progress, event } = applyAction(player.progress, command, { now, random: trustedRandom });
    if (event.type !== 'error') {
      store.record(player, progress, requestId, event);
      dirty = true;
    }
    send(player, progressMessage(player, event, { type: 'result', requestId }));
  }

  function join(peer, message, now) {
    const { token } = message || {};
    if (message?.type !== 'hello' || (token !== undefined && (typeof token !== 'string' || !tokenPattern.test(token)))) {
      error(peer, 'invalid_token', 'The player sign-in could not be verified.');
      peer.socket.close(1008);
      return;
    }
    if (players.size >= maxPlayers) {
      error(peer, 'room_full', 'The meadow is full. Try again when another explorer leaves.');
      peer.socket.close(1013);
      return;
    }
    if (token === undefined) {
      if (now - accountWindowAt >= 1000) {
        accountsThisWindow = 0;
        accountWindowAt = now;
      }
      if (++accountsThisWindow > 6) {
        error(peer, 'account_cooldown', 'Wait a moment before creating an online profile.');
        peer.socket.close(1013);
        return;
      }
    }
    const profile = token === undefined ? store.create() : store.restore(token);
    if (!profile || players.has(profile.id)) {
      if (profile) error(peer, 'active_session', 'This explorer is already connected. Close the other session first.');
      else if (token === undefined) error(peer, 'profile_capacity', 'This server has reached its profile limit.');
      else error(peer, 'invalid_token', 'The saved online profile could not be found.');
      peer.socket.close(1008);
      return;
    }
    const { token: resumeToken, ...profileState } = profile;
    const player = peer.player = { ...profileState, socket: peer.socket, position: { ...SPAWN, heading: 0 },
      lastMoveAt: now, lastCorrectionAt: 0, moveBudget: moveBurst };
    clearTimeout(peer.joinTimer);
    const peers = Array.from(players.values(), playerAppearance);
    players.set(player.id, player);
    send(player, { type: 'welcome', token: resumeToken, self: playerAppearance(player), progress: player.progress,
      version: player.version, peers });
    dirty = true;
  }

  function handle(peer, bytes, binary) {
    const now = Date.now();
    if (now - peer.windowAt >= 1000) {
      peer.windowAt = now;
      peer.messages = 0;
      peer.actions = 0;
    }
    if (++peer.messages > 45) return peer.socket.close(1008, 'Too many messages.');
    const message = parse(bytes, binary);
    try {
      const player = peer.player;
      if (!player) return join(peer, message, now);
      if (message?.type === 'move') return move(player, message, now);
      if (!message || !validRequestId(message.requestId)) return error(peer, 'invalid_request', 'This message was not understood.');
      if (++peer.actions > 8) return error(peer, 'slow_down', 'Take a moment before the next action.', message.requestId);
      if (message.type === 'action') return act(player, message, now);
      if (message.type === 'trade' && validTrade(message)) return trading.handle(player, message, now);
      return error(peer, 'invalid_request', 'This message was not understood.', message.requestId);
    } catch {
      error(peer, 'save_unavailable', 'Petverse could not save this action. Please try again.', message?.requestId);
      if (!peer.player) peer.socket.close(1011);
    }
  }

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== endpoint) return rejectUpgrade(socket, '404 Not Found');
    if (!origins.has(request.headers.origin)) return rejectUpgrade(socket, '403 Forbidden');
    if (closing || sockets.clients.size >= maxPlayers + 5) return rejectUpgrade(socket, '503 Service Unavailable');
    sockets.handleUpgrade(request, socket, head, connected => sockets.emit('connection', connected));
  });
  server.on('clientError', (_error, socket) => rejectUpgrade(socket, '400 Bad Request'));

  sockets.on('connection', socket => {
    const peer = { socket, windowAt: Date.now(), messages: 0, actions: 0 };
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('error', () => socket.terminate());
    peer.joinTimer = setTimeout(() => socket.close(1008, 'Sign-in timed out.'), 5000);
    peer.joinTimer.unref();
    socket.on('message', (bytes, binary) => { if (socket.readyState === WebSocket.OPEN) handle(peer, bytes, binary); });
    socket.on('close', () => {
      clearTimeout(peer.joinTimer);
      if (peer.player) {
        players.delete(peer.player.id);
        trading.leave(peer.player);
        dirty = true;
      }
    });
  });

  const tick = setInterval(() => {
    const now = Date.now();
    trading.expire(now);
    if (dirty) {
      dirty = false;
      const everyone = Array.from(players.values(), playerAppearance);
      for (const player of players.values()) {
        send(player, { type: 'peers', peers: everyone.filter(peer => peer.id !== player.id) }, true);
      }
    }
    if (now - lastPingAt >= 20_000) {
      lastPingAt = now;
      for (const socket of sockets.clients) {
        if (!socket.isAlive || socket.readyState === WebSocket.CLOSING) socket.terminate();
        else if (socket.readyState === WebSocket.OPEN) {
          socket.isAlive = false;
          socket.ping();
        }
      }
    }
  }, 100);
  tick.unref();

  return {
    listen(port = 0) {
      if (closing) throw new Error('This Petverse server is closed.');
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid Petverse port.');
      listening ??= (async () => {
        server.listen(port, loopback);
        await once(server, 'listening');
        return `http://${loopback}:${server.address().port}`;
      })();
      return listening;
    },
    close() {
      closing ??= (async () => {
        clearInterval(tick);
        await listening?.catch(() => {});
        for (const socket of sockets.clients) socket.terminate();
        await new Promise(resolve => sockets.close(resolve));
        if (server.listening) await new Promise(resolve => server.close(resolve));
        store.close();
      })();
      return closing;
    }
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.umask(0o077);
  const server = createPetverseServer({ clientOrigins: process.env.PETVERSE_CLIENT_ORIGINS,
    dbPath: process.env.PETVERSE_DB_PATH || 'data/petverse.sqlite' });
  const origin = await server.listen(Number(process.env.PETVERSE_PORT || 4893));
  console.log(`Petverse server listening on ${origin}`);
  process.once('SIGINT', () => void server.close());
  process.once('SIGTERM', () => void server.close());
}
