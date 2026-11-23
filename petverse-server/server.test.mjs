import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { WebSocket } from 'ws';
import { biomeAt, expeditionDestination, EXPEDITION_BIOMES, mayEnterExpeditionBiome } from '../assets/petverse/biomes.js';
import { FARM_AREAS } from '../assets/petverse/farming.js';
import { GENERATOR_SITE } from '../assets/petverse/generator.js';
import { EGGS, REBIRTH_ALTAR, SPAWN, rebirthPlan } from '../assets/petverse/model.js';
import { createPetverseServer } from './server.mjs';
import { createInviteLimiter } from './rooms.mjs';
import { openStore } from './store.mjs';

const clientOrigin = 'http://127.0.0.1:4188';
const endpoint = origin => origin.replace('http:', 'ws:') + '/v1/petverse';
const type = expected => message => message.type === expected;
const tagged = (expected, id) => message => message.type === expected && message.requestId === id;

async function walk(client, from, to) {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 1.35);
  for (let step = 1; step <= steps; step++) {
    client.send({ type: 'move', x: from.x + (to.x - from.x) * step / steps,
      z: from.z + (to.z - from.z) * step / steps });
    await delay(210);
  }
}

async function connect(origin, options = {}) {
  const socket = new WebSocket(endpoint(origin), { origin: clientOrigin, handshakeTimeout: 3000 });
  const inbox = [];
  const listeners = new Set();
  socket.on('error', () => {});
  socket.on('message', bytes => {
    const message = JSON.parse(bytes.toString());
    inbox.push(message);
    for (const listener of listeners) listener();
  });
  await once(socket, 'open');
  const send = message => socket.send(JSON.stringify(message));
  const receive = (predicate, timeout = 4000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listeners.delete(check);
      reject(new Error(`Expected a server message. Buffered types: ${[...new Set(inbox.map(message => message.type))].join(', ')}`));
    }, timeout);
    function check() {
      const index = inbox.findIndex(predicate);
      if (index < 0) return;
      clearTimeout(timer);
      listeners.delete(check);
      resolve(inbox.splice(index, 1)[0]);
    }
    listeners.add(check);
    check();
  });
  send({ type: 'hello', mode: 'create', ...options });
  return {
    socket, send, receive,
    action(requestId, action, expected = 'result') {
      send({ type: 'action', requestId, action });
      return receive(tagged(expected, requestId));
    },
    trade(requestId, step, fields, expected = 'trade-result') {
      send({ type: 'trade', requestId, step, ...fields });
      return receive(tagged(expected, requestId));
    },
    room(requestId, step, expected = 'room-result') {
      send({ type: 'room', requestId, step });
      return receive(tagged(expected, requestId));
    },
    leaderboard(requestId, metric, expected = 'leaderboard-result') {
      send({ type: 'leaderboard', requestId, metric });
      return receive(tagged(expected, requestId));
    },
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      const closed = once(socket, 'close');
      socket.close();
      await closed;
    }
  };
}

async function joinPair(origin) {
  const first = await connect(origin);
  const me = await first.receive(type('welcome'));
  const second = await connect(origin, { mode: 'join', code: me.room.code });
  const other = await second.receive(type('welcome'));
  return { first, second, me, other };
}

const farmEvent = predicate => message => message.type === 'farm' && message.farm.events.some(predicate);
const stateEvent = name => message => message.type === 'player-state' && message.event.type === name;

test('requires an approved origin and refuses unknown resume tokens', async context => {
  assert.throws(() => createPetverseServer({ clientOrigins: 'https://example.com/with-path' }), /origins/);
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  assert.equal((await fetch(`${origin}/healthz`)).status, 200);
  const denied = new WebSocket(endpoint(origin), { origin: 'https://not-allowed.example.com', handshakeTimeout: 3000 });
  denied.on('error', () => {});
  const [, response] = await once(denied, 'unexpected-response');
  assert.equal(response.statusCode, 403);
  response.resume();
  denied.terminate();
  const unknown = await connect(origin, { token: 'a'.repeat(43) });
  assert.equal((await unknown.receive(type('error'))).code, 'invalid_token');
  await unknown.close();
});

test('private codes control membership, capacity, host controls and room-scoped rankings', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  const automatic = await connect(origin, { mode: undefined });
  assert.equal((await automatic.receive(type('error'))).code, 'private_room_required');
  const invalid = await connect(origin, { mode: 'join', code: 'PET-0000000000' });
  assert.equal((await invalid.receive(type('error'))).code, 'invalid_code');

  const first = await connect(origin, { maxPlayers: 2 });
  const me = await first.receive(type('welcome'));
  assert.match(me.room.code, /^PET-[0-9A-F]{10}$/);
  assert.equal(me.room.hostId, me.self.id);
  assert.equal(me.room.maxPlayers, 2);
  assert.deepEqual(me.peers, []);
  const second = await connect(origin, { mode: 'join', code: me.room.code.toLowerCase() });
  const other = await second.receive(type('welcome'));
  assert.equal(other.room.id, me.room.id);
  assert.equal(other.room.playerCount, 2);
  assert.equal(Object.hasOwn(other.room, 'code'), false);
  assert.deepEqual(other.peers.map(peer => peer.id), [me.self.id]);
  const full = await connect(origin, { mode: 'join', code: me.room.code });
  assert.equal((await full.receive(type('error'))).code, 'room_full');

  const stranger = await connect(origin);
  const isolated = await stranger.receive(type('welcome'));
  assert.notEqual(isolated.room.id, me.room.id);
  assert.deepEqual(isolated.peers, []);
  assert.equal((await first.trade('cross-room', 'invite', { peerId: isolated.self.id }, 'error')).code, 'player_unavailable');
  await first.action('verified-hatch', { type: 'hatch', eggId: 'sunmeadow', mode: 'manual' });
  const ranking = await second.leaderboard('verified-ranking', 'eggsHatched');
  assert.deepEqual(ranking.entries.map(entry => [entry.id, entry.score]), [[me.self.id, 1], [other.self.id, 0]]);
  assert.deepEqual((await stranger.leaderboard('private-ranking', 'eggsHatched')).entries.map(entry => entry.id), [isolated.self.id]);
  assert.equal((await second.leaderboard('bad-ranking', 'anything', 'error')).code, 'invalid_metric');

  assert.equal((await second.room('not-host', 'regenerate', 'error')).code, 'host_only');
  await first.room('renew-code', 'regenerate');
  const rotated = await first.receive(message => message.type === 'room' && message.room.code !== me.room.code);
  assert.match(rotated.room.code, /^PET-[0-9A-F]{10}$/);
  assert.equal(rotated.room.id, me.room.id);
  assert.equal(Object.hasOwn((await second.receive(type('room'))).room, 'code'), false);
  const oldCode = await connect(origin, { mode: 'join', code: me.room.code });
  assert.equal((await oldCode.receive(type('error'))).code, 'invalid_code');

  await second.close();
  await first.receive(message => message.type === 'room' && message.room.playerCount === 1 && message.room.code === rotated.room.code);
  const returning = await connect(origin, { mode: 'join', code: rotated.room.code, token: other.token });
  assert.equal((await returning.receive(type('welcome'))).self.id, other.self.id);
  assert.equal((await returning.room('guest-close', 'close', 'error')).code, 'host_only');
  await first.room('host-close', 'close');
  assert.match((await returning.receive(type('room-closed'))).message, /host closed/i);
  const closed = await connect(origin, { mode: 'join', code: rotated.room.code });
  assert.equal((await closed.receive(type('error'))).code, 'invalid_code');
});

test('expires invitations with the room and limits repeated invalid-code attempts', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin], roomLifetimeMs: 200 });
  context.after(() => server.close());
  const origin = await server.listen();
  const host = await connect(origin);
  const opened = await host.receive(type('welcome'));
  assert.match((await host.receive(type('room-closed'))).message, /expired/i);
  for (let attempt = 0; attempt < 13; attempt++) {
    const retry = await connect(origin, { mode: 'join', code: opened.room.code });
    assert.equal((await retry.receive(type('error'))).code, attempt < 12 ? 'invalid_code' : 'invite_cooldown');
    await retry.close();
  }
  const limiter = createInviteLimiter({ limit: 2, intervalMs: 100, addressLimit: 1 });
  assert.equal(limiter.take('address-a', 0), true);
  assert.equal(limiter.take('address-b', 1), false);
  assert.equal(limiter.take('address-a', 2), true);
  assert.equal(limiter.take('address-a', 3), false);
  assert.equal(limiter.take('address-b', 100), true);
});

test('synchronizes two real peers and validates movement, proximity, and server-owned rewards', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  const { first, second, me, other } = await joinPair(origin);
  assert.notEqual(me.self.id, other.self.id);
  assert.match(me.token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(me.progress.wallet, { sunbeams: 40, crystals: 0, ascension: 0 });
  assert.equal((await first.action('too-far', { type: 'gather', nodeId: 'path-bloom' })).event.type, 'error');
  first.send({ type: 'move', x: -1.6, z: 10, heading: 0.7 });
  const synced = await second.receive(message => message.type === 'peers' && message.peers.some(peer => peer.id === me.self.id && peer.x === -1.6));
  assert.equal(synced.peers[0].z, 10);
  assert.equal(synced.peers[0].pet.speciesId, 'twigpup');
  const gathered = await first.action('gather-once', { type: 'gather', nodeId: 'path-bloom', sunbeams: 999_999_999 });
  assert.equal(gathered.event.type, 'gather');
  assert.equal(gathered.progress.wallet.sunbeams, 40);
  assert.ok(gathered.event.drop.sunbeams < 100);
  await second.receive(message => message.type === 'resources' && message.nodeReadyAt['path-bloom'] > Date.now());
  assert.equal((await second.action('room-node-busy', { type: 'gather', nodeId: 'path-bloom' })).event.code, 'node-cooldown');
  const replayed = await first.action('gather-once', { type: 'gather', nodeId: 'path-bloom' });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.version, gathered.version);
  assert.deepEqual(replayed.progress.wallet, gathered.progress.wallet);
  assert.equal((await second.action('steal-drop', { type: 'collect', dropId: gathered.event.drop.id })).event.type, 'error');
  await delay(Math.max(0, gathered.event.drop.readyAt - Date.now()) + 10);
  const collected = await first.action('collect-once', { type: 'collect', dropId: gathered.event.drop.id, sunbeams: 999_999 });
  assert.equal(collected.event.type, 'collect');
  assert.equal(collected.progress.wallet.sunbeams, 40 + gathered.event.drop.sunbeams);
  assert.equal((await first.action('collect-again', { type: 'collect', dropId: gathered.event.drop.id })).event.type, 'error');

  first.send({ type: 'move', x: 25, z: -26 });
  const correction = await first.receive(type('position'));
  assert.equal(correction.x, -1.6);
  assert.equal(correction.z, 10);
  assert.equal((await second.action('fake-wallet', { type: 'set-wallet', sunbeams: 999 }, 'error')).code, 'invalid_action');
  const hatch = await second.action('hatch', { type: 'hatch', eggId: 'sunmeadow', mode: 'manual', count: 3, random: 0.999999 });
  assert.equal(hatch.event.type, 'hatch');
  assert.equal(hatch.event.pets.length, 1);
  assert.equal(hatch.progress.wallet.sunbeams, 22);
  assert.equal(hatch.progress.inventory.length, 2);
  await first.close();
  await second.receive(message => message.type === 'peers' && message.peers.length === 0);
});

test('validates expedition travel, locked terrain, and room synchronization', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'petverse-expedition-'));
  const dbPath = join(directory, 'petverse.sqlite');
  const seed = openStore(dbPath, 10);
  const profile = seed.create();
  const biome = EXPEDITION_BIOMES.find(area => area.id === 'glasswater');
  const egg = EGGS.find(item => item.id === biome.eggId);
  const unlocked = { ...profile.progress, xp: 12 * biome.level * (biome.level - 1),
    wallet: { ...profile.progress.wallet, sunbeams: 500 } };
  seed.record(profile, unlocked, 'earned-expedition-fixture', { type: 'test-fixture' });
  seed.close();

  const server = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  context.after(async () => { await server.close(); await rm(directory, { recursive: true, force: true }); });
  const origin = await server.listen();
  const host = await connect(origin, { token: profile.token });
  const entered = await host.receive(type('welcome'));
  const observer = await connect(origin, { mode: 'join', code: entered.room.code });
  const fresh = await observer.receive(type('welcome'));
  const observePosition = (client, id, { x, z }) => client.receive(message =>
    message.type === 'peers' && message.peers.some(peer => peer.id === id && peer.x === x && peer.z === z));
  const travel = (client, requestId, areaId) => client.action(requestId, { type: 'expedition-travel', areaId });

  assert.equal((await travel(observer, 'locked-coast', biome.id)).event.code, 'expedition-locked');
  assert.equal((await travel(host, 'unknown-destination', 'ocean')).event.code, 'expedition-unknown');
  assert.equal((await travel(host, 'locked-summit', 'frostpine')).event.code, 'expedition-locked');
  const offsiteEgg = await host.action('distant-coast-egg', { type: 'hatch', eggId: egg.id, mode: 'manual', position: biome.egg });
  assert.equal(offsiteEgg.event.code, 'egg-out-of-range');
  assert.equal((await host.action('assign-before-travel', { type: 'assign-farm-here' })).progress.farming.area, 'sunstep');

  const approach = biome.entry;
  await Promise.all([walk(host, SPAWN, GENERATOR_SITE), walk(observer, SPAWN, approach)]);
  const pastGate = { x: approach.x + 1, z: approach.z };
  assert.equal(biomeAt(approach), null);
  assert.equal(biomeAt(pastGate)?.id, biome.id);
  assert.equal(mayEnterExpeditionBiome(fresh.progress, pastGate.x, pastGate.z, approach), false);
  assert.equal(mayEnterExpeditionBiome(fresh.progress, pastGate.x, pastGate.z, biome.arrival), true);
  assert.equal(mayEnterExpeditionBiome(fresh.progress, biome.arrival.x, biome.arrival.z, pastGate), false);
  observer.send({ type: 'move', ...pastGate, heading: 0 });
  const corrected = await observer.receive(type('position'));
  assert.equal(corrected.x, approach.x);
  assert.equal(corrected.z, approach.z);
  const backingAway = { x: approach.x - 0.7, z: approach.z };
  observer.send({ type: 'move', ...backingAway, heading: 0 });
  await observePosition(host, fresh.self.id, backingAway);

  const crank = await host.action('charge-before-travel', { type: 'generatorStart' });
  assert.equal(crank.event.type, 'generator-start');
  await host.receive(message => message.type === 'farm' && message.generator.active);
  const arrived = await host.action('travel-coast', { type: 'expedition-travel', areaId: biome.id, x: 999, z: 999 });
  const destination = expeditionDestination(unlocked, biome.id);
  assert.deepEqual(arrived.event, { type: 'expedition-travel', areaId: biome.id, position: destination });
  assert.equal(arrived.progress.farming.area, 'sunstep');
  assert.deepEqual(await host.receive(type('position')), { type: 'position', ...destination });
  await observePosition(observer, entered.self.id, destination);
  assert.ok(entered.farm.crystals.some(crystal => crystal.areaId === biome.id && crystal.x > 27));
  const immediateReturn = await travel(host, 'travel-cooldown', 'meadow');
  assert.equal(immediateReturn.event.code, 'expedition-cooldown');

  const coastStep = { x: destination.x, z: destination.z + 0.45 };
  host.send({ type: 'move', ...coastStep, heading: 0.2 });
  await observePosition(observer, entered.self.id, coastStep);
  await walk(host, coastStep, biome.egg);
  const hatched = await host.action('station-coast-egg', { type: 'hatch', eggId: egg.id, mode: 'manual' });
  assert.equal(hatched.event.type, 'hatch');
  assert.equal(hatched.event.spent, egg.cost);
  assert.ok(egg.pool.some(item => item.speciesId === hatched.event.pets[0].speciesId));
  await delay(Math.max(0, immediateReturn.event.retryAt - Date.now()) + 25);
  const storedCharge = await host.action('saved-coast-charge', { type: 'generatorSelect', eggId: 'sunmeadow' });
  assert.equal(storedCharge.progress.generator.energy, arrived.progress.generator.energy);
  const returned = await travel(host, 'return-to-meadow', 'meadow');
  assert.deepEqual(returned.event.position, expeditionDestination(unlocked, 'meadow'));
  await observePosition(observer, entered.self.id, returned.event.position);
  const replayed = await travel(host, 'travel-coast', biome.id);
  assert.equal(replayed.replayed, true);
  assert.deepEqual(replayed.event.position, returned.event.position);
});

test('broadcasts the same crystal hits, break and respawn to two room members', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  const { first, second, me, other } = await joinPair(origin);
  assert.ok(me.farm.crystals.length > 0);
  assert.equal(me.generator.active, false);
  const activeParty = await first.receive(message => message.type === 'farm' &&
    message.farm.pets.some(pet => pet.ownerId === me.self.id && pet.targetId) &&
    message.farm.pets.some(pet => pet.ownerId === other.self.id && pet.targetId));
  const twoTargets = activeParty.farm.pets.map(pet => pet.targetId);
  assert.equal(new Set(twoTargets).size, 2, 'starter pets should spread across the near Sunglass sites');
  await second.action('stop-farming', { type: 'farm-settings', settings: { enabled: false } });

  const hit = await first.receive(farmEvent(event => event.type === 'damage' && event.ownerId === me.self.id), 6000);
  const firstHit = hit.farm.events.find(event => event.type === 'damage' && event.ownerId === me.self.id);
  const mirrored = await second.receive(farmEvent(event => event.id === firstHit.id));
  assert.deepEqual(mirrored.farm, hit.farm);
  const injured = hit.farm.crystals.find(crystal => crystal.id === firstHit.crystalId);
  assert.ok(injured.health < injured.maxHealth && injured.health > 0);

  const spoiled = await second.action('forged-crystal', { type: 'crystal-break', crystalId: injured.id, gold: 1000 }, 'error');
  assert.equal(spoiled.code, 'invalid_action');
  const firstBreak = await first.receive(stateEvent('crystal-break'), 9000);
  const { drop } = firstBreak.event;
  const broken = await second.receive(farmEvent(event => event.type === 'break' && event.crystalId === drop.crystalId));
  assert.equal(broken.farm.crystals.find(site => site.id === drop.crystalId).health, 0);
  assert.ok(broken.farm.crystals.find(site => site.id === drop.crystalId).readyAt > Date.now());
  assert.equal(firstBreak.progress.wallet.sunbeams, me.progress.wallet.sunbeams, 'a break should mint a drop before it pays Gold');
  assert.equal((await second.action('peer-drop', { type: 'collect', dropId: drop.id })).event.code, 'drop-unavailable');
  await delay(Math.max(0, drop.readyAt - Date.now()) + 40);
  const collected = await first.action('mined-gold', { type: 'collect', dropId: drop.id });
  assert.equal(collected.event.type, 'collect');
  assert.equal(collected.progress.wallet.sunbeams, me.progress.wallet.sunbeams + drop.sunbeams);
  assert.equal((await first.action('same-claimed-gold', { type: 'collect', dropId: drop.id })).event.code, 'drop-unavailable');
  const replay = await first.action('mined-gold', { type: 'collect', dropId: drop.id });
  assert.equal(replay.replayed, true);
  assert.equal(replay.progress.wallet.sunbeams, collected.progress.wallet.sunbeams);

  const otherRoom = await connect(origin);
  await otherRoom.receive(type('welcome'));
  const isolated = await otherRoom.receive(type('farm'));
  assert.ok(isolated.farm.pets.every(pet => pet.ownerId !== me.self.id && pet.ownerId !== other.self.id));
  const regenerated = await second.receive(farmEvent(event => event.type === 'respawn' && event.crystalId === drop.crystalId), 9000);
  const newCrystal = regenerated.farm.crystals.find(site => site.id === drop.crystalId);
  assert.ok(newCrystal.health > 0);
  assert.equal(newCrystal.readyAt, 0);
});

test('assigned pets keep earning remote Gold while the server advances a verified crank and save', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'petverse-workshop-'));
  const dbPath = join(directory, 'petverse.sqlite');
  const seed = openStore(dbPath, 10);
  const profile = seed.create();
  const ready = { ...profile.progress, xp: 48, wallet: { ...profile.progress.wallet, sunbeams: 130 } };
  seed.record(profile, ready, 'seed-earned-workshop', { type: 'test-fixture' });
  seed.close();

  const server = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  context.after(async () => { await server.close(); await rm(directory, { recursive: true, force: true }); });
  const origin = await server.listen();
  const host = await connect(origin, { token: profile.token });
  const entered = await host.receive(type('welcome'));
  const observer = await connect(origin, { mode: 'join', code: entered.room.code });
  await observer.receive(type('welcome'));
  await observer.action('watch-no-pet', { type: 'farm-settings', settings: { enabled: false } });

  const locked = await host.action('locked-field', { type: 'farm-settings', settings: { area: 'ember-verge' } });
  assert.equal(locked.event.type, 'error');
  const tooFar = await host.action('fake-workshop-position', { type: 'generatorStart', position: GENERATOR_SITE });
  assert.equal(tooFar.event.code, 'generator-out-of-range');
  const unearned = await host.action('fake-generator-charge', { type: 'generatorClaim', eggId: 'sunmeadow', energy: 100000 });
  assert.equal(unearned.event.type, 'error');
  const bought = await host.action('eligible-remote-magnet', { type: 'upgrade', id: 'remoteMagnet' });
  assert.equal(bought.event.type, 'upgrade');
  const field = FARM_AREAS[0];
  const assigned = await host.action('assign-at-sunstep', { type: 'assign-farm-here' });
  assert.equal(assigned.progress.farming.area, field.id);
  await walk(host, SPAWN, GENERATOR_SITE);

  const started = await host.action('operate-real-crank', { type: 'generatorStart' });
  assert.equal(started.event.type, 'generator-start');
  assert.equal(started.progress.generator.operations, 1);
  const work = await host.receive(message => message.type === 'farm' && message.generator.active &&
    message.farm.pets.some(pet => pet.ownerId === entered.self.id && pet.targetId?.startsWith(`${field.id}-`)));
  assert.ok(work.farm.pets.some(pet => Math.hypot(pet.x - GENERATOR_SITE.x, pet.z - GENERATOR_SITE.z) > 7));
  const charge = await host.receive(stateEvent('generator-progress'));
  assert.ok(charge.progress.generator.energy > started.progress.generator.energy);
  const remote = await host.receive(message => stateEvent('collect')(message) && message.version > started.version &&
    message.event.remote && message.progress.stats.crankGold > 0, 12_000);
  assert.ok(remote.progress.wallet.sunbeams > started.progress.wallet.sunbeams);
  assert.equal(remote.event.areaId, field.id);
  const sameBreak = await observer.receive(farmEvent(event => event.type === 'break' && event.ownerId === entered.self.id &&
    event.areaId === field.id), 6000);
  assert.ok(sameBreak.farm.crystals.some(site => site.areaId === field.id && site.health === 0));
  assert.equal((await host.action('already-gathered-remotely', { type: 'collect', dropId: remote.event.dropId })).event.code, 'drop-unavailable');

  const paused = await host.action('stop-the-crank', { type: 'generatorStop' });
  assert.equal(paused.event.type, 'generator-stop');
  await delay(650);
  const pausedEnergy = await host.action('check-paused-energy', { type: 'generatorSelect', eggId: 'sunmeadow' });
  assert.equal(pausedEnergy.progress.generator.energy, paused.progress.generator.energy);
  const restarted = await host.action('restart-at-crank', { type: 'generatorStart' });
  assert.equal(restarted.progress.generator.operations, 2);

  await host.close();
  await server.close();
  const restoredServer = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  try {
    const returning = await connect(await restoredServer.listen(), { token: profile.token });
    const saved = await returning.receive(type('welcome'));
    assert.equal(saved.self.id, entered.self.id);
    assert.equal(saved.progress.farming.area, field.id);
    assert.equal(saved.progress.upgrades.remoteMagnet, 1);
    assert.ok(saved.progress.generator.energy >= charge.progress.generator.energy);
    assert.equal(saved.progress.generator.operations, 2);
    assert.ok(saved.progress.stats.crankGold >= remote.progress.stats.crankGold);
    const stopped = await returning.receive(type('farm'));
    assert.equal(stopped.generator.active, false);
    const replay = await returning.action('restart-at-crank', { type: 'generatorStart' });
    assert.equal(replay.replayed, true);
    assert.equal((await returning.receive(type('farm'))).generator.active, false);
    await returning.close();
  } finally {
    await restoredServer.close();
  }
});

test('restores inventory, preferences and action receipts after a SQLite restart', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'petverse-online-'));
  const dbPath = join(directory, 'petverse.sqlite');
  const firstServer = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  context.after(async () => { await firstServer.close(); await rm(directory, { recursive: true, force: true }); });
  const firstOrigin = await firstServer.listen();
  const player = await connect(firstOrigin);
  const welcome = await player.receive(type('welcome'));
  const saved = await player.action('prefs', { type: 'settings', settings: { stopVariants: { shiny: false, mythic: true } } });
  assert.equal(saved.progress.settings.stopVariants.shiny, false);
  assert.equal(saved.progress.settings.stopVariants.mythic, true);
  const hatched = await player.action('my-hatch', { type: 'hatch', eggId: 'sunmeadow', mode: 'manual' });
  const duplicateGuest = await connect(firstOrigin, { token: welcome.token });
  assert.equal((await duplicateGuest.receive(type('error'))).code, 'active_session');
  await player.close();
  await firstServer.close();
  assert.equal((await readFile(dbPath)).includes(Buffer.from(welcome.token)), false);

  const reopened = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  context.after(() => reopened.close());
  const restored = await connect(await reopened.listen(), { token: welcome.token });
  const state = await restored.receive(type('welcome'));
  assert.equal(state.self.id, welcome.self.id);
  assert.equal(state.token, welcome.token);
  assert.equal(state.version, hatched.version);
  assert.deepEqual(state.progress.wallet, hatched.progress.wallet);
  assert.deepEqual(state.progress.inventory, hatched.progress.inventory);
  assert.equal(state.progress.settings.stopVariants.shiny, false);
  const result = await restored.action('my-hatch', { type: 'hatch', eggId: 'sunmeadow', mode: 'manual' });
  assert.equal(result.replayed, true);
  assert.deepEqual(result.progress.inventory, hatched.progress.inventory);
});

test('validates earned achievements and rebirth against the player position and committed profile', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'petverse-rebirth-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const dbPath = join(directory, 'petverse.sqlite');
  const seed = openStore(dbPath, 10);
  const profile = seed.create();
  const ready = structuredClone(profile.progress);
  ready.xp = 1200;
  ready.wallet.sunbeams = 5000;
  ready.wallet.crystals = 100;
  seed.record(profile, ready, 'seed-rebirth-test', { type: 'test-fixture' });
  seed.close();

  const server = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  const player = await connect(await server.listen(), { token: profile.token });
  try {
    await player.receive(type('welcome'));
    const unearned = await player.action('unearned', { type: 'claim', achievementId: 'first-hatch', ascension: 1000 });
    assert.equal(unearned.event.code, 'achievement-incomplete');
    await player.action('earn', { type: 'hatch', eggId: 'sunmeadow', mode: 'manual' });
    const claimed = await player.action('claim', { type: 'claim', achievementId: 'first-hatch', ascension: 1000 });
    assert.equal(claimed.event.type, 'claim');
    assert.equal(claimed.progress.wallet.ascension, 1);
    assert.equal((await player.action('claim-twice', { type: 'claim', achievementId: 'first-hatch' })).event.code, 'achievement-claimed');

    const spoofed = await player.action('remote-altar', { type: 'rebirth', confirm: true, position: { ...REBIRTH_ALTAR } });
    assert.equal(spoofed.event.code, 'rebirth-out-of-range');
    assert.equal(spoofed.progress.rebirths, 0);
    await walk(player, SPAWN, REBIRTH_ALTAR);
    const plan = rebirthPlan(claimed.progress);
    assert.equal(plan.available, true);
    const reborn = await player.action('altar-offering', { type: 'rebirth', confirm: true });
    assert.equal(reborn.event.type, 'rebirth');
    assert.equal(reborn.progress.rebirths, 1);
    assert.deepEqual(reborn.progress.inventory, claimed.progress.inventory);
    assert.equal(reborn.progress.wallet.sunbeams, claimed.progress.wallet.sunbeams - plan.requirements.sunbeams);
    assert.equal(reborn.progress.wallet.ascension, claimed.progress.wallet.ascension + plan.rewards.ascension);
    await player.close();
  } finally {
    await server.close();
  }
  const reopened = openStore(dbPath, 10);
  try {
    const persisted = reopened.restore(profile.token);
    assert.equal(persisted.progress.rebirths, 1);
    assert.deepEqual(persisted.progress.achievements, ['first-hatch']);
  } finally {
    reopened.close();
  }
});

test('requires consent on both sides of a current trade and commits both inventories together', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  const { first, second, me: a, other: b } = await joinPair(origin);
  const [aHatch, bHatch] = await Promise.all([first, second].map(async client => {
    await client.action('no-auto-equip', { type: 'settings', settings: { autoEquip: false, lockRare: false } });
    return client.action('hatch', { type: 'hatch', eggId: 'sunmeadow', mode: 'manual' });
  }));
  const aPet = aHatch.event.pets[0];
  const bPet = bHatch.event.pets[0];
  await first.trade('invite', 'invite', { peerId: b.self.id });
  const invitation = (await second.receive(message => message.type === 'trade' && message.trade.state === 'invited')).trade;
  assert.equal(invitation.peer.id, a.self.id);
  assert.equal(invitation.initiatedByMe, false);
  const tradeId = invitation.id;
  const initiatorAccept = await first.trade('try-own-accept', 'accept', { tradeId }, 'error');
  assert.equal(initiatorAccept.code, 'trade_pending');
  await second.trade('accept', 'accept', { tradeId });
  const invalid = await first.trade('equipped', 'offer', { tradeId, petIds: ['pet-1'] }, 'error');
  assert.equal(invalid.code, 'invalid_offer');
  await first.trade('offer', 'offer', { tradeId, petIds: [aPet.id] });
  await second.trade('offer', 'offer', { tradeId, petIds: [bPet.id] });

  const bothOffers = (await first.receive(message => message.type === 'trade' && message.trade.revision === 2)).trade;
  assert.equal(bothOffers.mine[0].speciesId, aPet.speciesId);
  assert.equal(bothOffers.theirs[0].speciesId, bPet.speciesId);
  await first.trade('first-confirm', 'confirm', { tradeId, revision: bothOffers.revision });
  const approved = await second.receive(message => message.type === 'trade' && message.trade.confirmedByPeer);
  assert.equal(approved.trade.confirmedByMe, false);
  await second.trade('clear', 'offer', { tradeId, petIds: [] });
  await second.trade('restore-offer', 'offer', { tradeId, petIds: [bPet.id] });
  const current = (await first.receive(message => message.type === 'trade' && message.trade.revision === 4)).trade;
  assert.equal(current.confirmedByMe, false);
  assert.equal((await first.trade('stale', 'confirm', { tradeId, revision: 2 }, 'error')).code, 'offer_changed');
  await delay(1050);
  await second.trade('second-confirm', 'confirm', { tradeId, revision: current.revision });
  await first.trade('first-confirm-final', 'confirm', { tradeId, revision: current.revision });
  const [aTrade, bTrade] = await Promise.all([first.receive(type('player-state')), second.receive(type('player-state'))]);
  assert.equal(aTrade.progress.inventory.length, 2);
  assert.equal(bTrade.progress.inventory.length, 2);
  assert.equal(aTrade.progress.inventory.some(pet => pet.id === aPet.id), false);
  assert.equal(bTrade.progress.inventory.some(pet => pet.id === bPet.id), false);
  assert.equal(aTrade.progress.inventory.at(-1).speciesId, bPet.speciesId);
  assert.equal(bTrade.progress.inventory.at(-1).speciesId, aPet.speciesId);
  assert.equal(aTrade.version, aHatch.version + 1);
  assert.equal(bTrade.version, bHatch.version + 1);
  assert.equal((await first.trade('confirm-again', 'confirm', { tradeId, revision: current.revision }, 'error')).code, 'trade_unavailable');
  await first.close();
  const restored = await connect(origin, { mode: 'join', code: a.room.code, token: a.token });
  assert.deepEqual((await restored.receive(type('welcome'))).progress.inventory, aTrade.progress.inventory);
});

test('rolls back both writes when either side of a trade has stale progress', context => {
  const store = openStore(':memory:', 10);
  context.after(() => store.close());
  const first = store.create();
  const second = store.create();
  const stale = { ...second };
  const newSecond = structuredClone(second.progress);
  newSecond.wallet.sunbeams += 4;
  store.record(second, newSecond, 'separate-action', { type: 'gather' });
  const changedFirst = structuredClone(first.progress);
  changedFirst.inventory[0].favorite = true;
  assert.throws(() => store.exchange(first, changedFirst, stale, stale.progress), /another session/);
  assert.deepEqual(store.restore(first.token).progress, first.progress);
  assert.deepEqual(store.restore(second.token).progress, newSecond);
  assert.equal(store.restore(first.token).version, 0);
  assert.equal(store.restore(second.token).version, 1);
});

test('keeps command receipts across passive progress checkpoints', context => {
  const store = openStore(':memory:', 10);
  context.after(() => store.close());
  const player = store.create();
  const receipt = { type: 'generator-start' };
  store.record(player, player.progress, 'start-once', receipt);
  for (let index = 0; index < 160; index++) {
    const next = { ...player.progress, xp: index };
    store.checkpoint(player, next);
  }
  store.record(player, player.progress, 'after-checkpoints', { type: 'settings' });
  assert.deepEqual(store.receipt(player, 'start-once'), receipt);
  assert.equal(store.restore(player.token).version, 162);
  assert.equal(store.restore(player.token).progress.xp, 159);
});
