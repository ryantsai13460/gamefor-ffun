import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { applyAction, collectionMetrics, SPAWN, VARIANTS, WORLD_LIMIT } from '../assets/petverse/model.js';
import { openStore } from './store.mjs';
import { createTrading } from './trading.mjs';
import { createInviteLimiter, createRooms } from './rooms.mjs';

const endpoint = '/v1/petverse';
const loopback = '127.0.0.1';
const speedLimit = 7.25;
const moveBurst = 2;
const requestPattern = /^[A-Za-z0-9_-]{1,64}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const idPattern = /^[A-Za-z0-9_-]{1,48}$/;
const trustedRandom = () => randomBytes(4).readUInt32BE() / 0x1_0000_0000;
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
    case 'collect':
      return validId(action.dropId) ? { type, dropId: action.dropId } : null;
    case 'claim':
      return validId(action.achievementId) ? { type, achievementId: action.achievementId } : null;
    case 'rebirth':
      return action.confirm === true ? { type, confirm: true } : null;
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

export function createPetverseServer({ clientOrigins, dbPath = ':memory:', maxPlayers = 16, maxProfiles = 1000,
  roomLifetimeMs = 12 * 60 * 60_000, emptyRoomGraceMs = 5 * 60_000 } = {}) {
  const origins = exactOrigins(clientOrigins);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 32 ||
      !Number.isInteger(maxProfiles) || maxProfiles < maxPlayers || maxProfiles > 10_000) throw new Error('Invalid Petverse capacity.');
  if (!Number.isSafeInteger(roomLifetimeMs) || roomLifetimeMs < 100 ||
      !Number.isSafeInteger(emptyRoomGraceMs) || emptyRoomGraceMs < 100) throw new Error('Invalid Petverse room lifetime.');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const store = openStore(dbPath, maxProfiles);
  const players = new Map();
  const rooms = createRooms({ limit: maxPlayers, lifetimeMs: roomLifetimeMs, emptyMs: emptyRoomGraceMs });
  const invites = createInviteLimiter();
  const dirtyRooms = new Set();
  const dirtyResources = new Set();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const server = createServer({ headersTimeout: 5000, requestTimeout: 5000, maxHeaderSize: 8192 }, (request, response) => {
    const status = request.method === 'GET' && request.url === '/healthz' ? 200 : 404;
    response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' })
      .end(status === 200 ? '{"status":"ok"}' : '{"status":"not_found"}');
  });
  server.maxConnections = maxPlayers + 12;
  server.keepAliveTimeout = 3000;

  let closing;
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
    publicChange: player => dirtyRooms.add(player.room)
  });

  function announceRoom(room) {
    for (const player of room.members) send(player, { type: 'room', room: rooms.info(room, player.id) });
  }

  function endRoom(room, message) {
    rooms.close(room);
    dirtyRooms.delete(room);
    dirtyResources.delete(room);
    for (const player of room.members) {
      trading.leave(player);
      send(player, { type: 'room-closed', message });
      player.socket.close(1000, 'Private meadow closed.');
    }
  }

  function manageRoom(player, message) {
    const { step, requestId } = message;
    const { room } = player;
    if (room.hostId !== player.id) return error(player, 'host_only', 'Only the host can manage this meadow.', requestId);
    if (step === 'regenerate') {
      rooms.regenerate(room);
      announceRoom(room);
      return send(player, { type: 'room-result', requestId });
    }
    if (step === 'close') {
      send(player, { type: 'room-result', requestId });
      return endRoom(room, 'The host closed this private meadow.');
    }
    return error(player, 'invalid_request', 'Choose a supported private meadow action.', requestId);
  }

  function leaderboard(player, message) {
    const { metric, requestId } = message;
    if (typeof metric !== 'string' || !Object.hasOwn(collectionMetrics(player.progress), metric)) {
      return error(player, 'invalid_metric', 'That collection ranking is unavailable.', requestId);
    }
    const entries = Array.from(player.room.members, member => ({ id: member.id, name: member.name,
      score: collectionMetrics(member.progress)[metric] }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return send(player, { type: 'leaderboard-result', requestId, metric, entries });
  }

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
    dirtyRooms.add(player.room);
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
    if (command.type === 'gather' && (player.room.nodeReadyAt.get(command.nodeId) || 0) > now) {
      return send(player, progressMessage(player, { type: 'error', code: 'node-cooldown',
        message: 'This resource is regrowing.', retryAt: player.room.nodeReadyAt.get(command.nodeId) },
      { type: 'result', requestId }));
    }
    const { progress, event } = applyAction(player.progress, command, { now, random: trustedRandom, position: player.position });
    if (event.type !== 'error') {
      store.record(player, progress, requestId, event);
      dirtyRooms.add(player.room);
      if (event.type === 'gather') {
        player.room.nodeReadyAt.set(command.nodeId, progress.nodeReadyAt[command.nodeId]);
        dirtyResources.add(player.room);
      }
    }
    send(player, progressMessage(player, event, { type: 'result', requestId }));
  }

  function join(peer, message, now) {
    const { token, mode, code, maxPlayers: selectedLimit } = message || {};
    const reject = (reason, message, status = 1008) => {
      error(peer, reason, message);
      peer.socket.close(status);
    };
    if (message?.type !== 'hello' || (token !== undefined && (typeof token !== 'string' || !tokenPattern.test(token)))) {
      return reject('invalid_token', 'The player sign-in could not be verified.');
    }
    if (mode !== 'create' && mode !== 'join') {
      return reject('private_room_required', 'Create a private meadow or join one with an invite code.');
    }
    let room;
    const roomLimit = selectedLimit ?? Math.min(8, maxPlayers);
    if (mode === 'create') {
      if (!Number.isInteger(roomLimit) || roomLimit < 2 || roomLimit > maxPlayers) {
        return reject('invalid_capacity', `Choose a player limit from 2 to ${maxPlayers}.`);
      }
      if (!rooms.hasSpace()) return reject('room_capacity', 'The server has reached its private meadow limit.', 1013);
    } else {
      if (!invites.take(peer.address, now)) return reject('invite_cooldown', 'Wait a minute before trying another invite code.', 1013);
      room = rooms.find(code, now);
      if (!room) return reject('invalid_code', 'That invite code is invalid or expired. Ask the host for the current code.');
      if (room.members.size >= room.maxPlayers) return reject('room_full', 'This private meadow is full.', 1013);
    }
    if (players.size >= maxPlayers) {
      return reject('server_full', 'The server is full. Try again when another explorer leaves.', 1013);
    }
    if (token === undefined) {
      if (now - accountWindowAt >= 1000) {
        accountsThisWindow = 0;
        accountWindowAt = now;
      }
      if (++accountsThisWindow > 6) {
        return reject('account_cooldown', 'Wait a moment before creating an online profile.', 1013);
      }
    }
    const profile = token === undefined ? store.create() : store.restore(token);
    if (!profile || players.has(profile.id)) {
      if (profile) return reject('active_session', 'This explorer is already connected. Close the other session first.');
      if (token === undefined) return reject('profile_capacity', 'This server has reached its profile limit.');
      return reject('invalid_token', 'The saved online profile could not be found.');
    }
    if (mode === 'create') room = rooms.create(profile.id, roomLimit, now);
    const { token: resumeToken, ...profileState } = profile;
    const player = peer.player = { ...profileState, room, socket: peer.socket, position: { ...SPAWN, heading: 0 },
      lastMoveAt: now, lastCorrectionAt: 0, moveBudget: moveBurst };
    clearTimeout(peer.joinTimer);
    const peers = Array.from(room.members, playerAppearance);
    rooms.add(room, player);
    players.set(player.id, player);
    send(player, { type: 'welcome', token: resumeToken, self: playerAppearance(player), progress: player.progress,
      version: player.version, peers, room: rooms.info(room, player.id), nodeReadyAt: Object.fromEntries(room.nodeReadyAt) });
    announceRoom(room);
    dirtyRooms.add(room);
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
      if (message.type === 'room') return manageRoom(player, message);
      if (message.type === 'leaderboard') return leaderboard(player, message);
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
    sockets.handleUpgrade(request, socket, head, connected => sockets.emit('connection', connected, request));
  });
  server.on('clientError', (_error, socket) => rejectUpgrade(socket, '400 Bad Request'));

  sockets.on('connection', (socket, request) => {
    // The HTTPS edge can apply its own per-client limits. Forwarded addresses are not trusted here.
    const peer = { socket, address: request.socket.remoteAddress || 'unknown', windowAt: Date.now(), messages: 0, actions: 0 };
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('error', () => socket.terminate());
    peer.joinTimer = setTimeout(() => socket.close(1008, 'Sign-in timed out.'), 5000);
    peer.joinTimer.unref();
    socket.on('message', (bytes, binary) => { if (socket.readyState === WebSocket.OPEN) handle(peer, bytes, binary); });
    socket.on('close', () => {
      clearTimeout(peer.joinTimer);
      if (peer.player) {
        const player = peer.player;
        const { room } = player;
        if (players.get(player.id) === player) players.delete(player.id);
        trading.leave(player);
        rooms.remove(room, player, Date.now());
        if (rooms.contains(room)) {
          announceRoom(room);
          dirtyRooms.add(room);
        }
      }
    });
  });

  const tick = setInterval(() => {
    const now = Date.now();
    trading.expire(now);
    for (const room of rooms.expired(now)) endRoom(room, 'This private meadow has expired. Ask the host to create another.');
    for (const room of rooms.values()) {
      for (const [nodeId, readyAt] of room.nodeReadyAt) {
        if (readyAt <= now) {
          room.nodeReadyAt.delete(nodeId);
          dirtyResources.add(room);
        }
      }
    }
    for (const room of dirtyRooms) {
      const everyone = Array.from(room.members, playerAppearance);
      for (const player of room.members) send(player, { type: 'peers', peers: everyone.filter(peer => peer.id !== player.id) }, true);
    }
    dirtyRooms.clear();
    for (const room of dirtyResources) {
      const nodeReadyAt = Object.fromEntries(room.nodeReadyAt);
      for (const player of room.members) send(player, { type: 'resources', nodeReadyAt });
    }
    dirtyResources.clear();
    if (now - lastPingAt >= 20_000) {
      lastPingAt = now;
      invites.expire(now);
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
