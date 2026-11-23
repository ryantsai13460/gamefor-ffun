import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createPetverseServer } from './server.mjs';
import { openStore } from './store.mjs';

const clientOrigin = 'http://127.0.0.1:4188';
const endpoint = origin => origin.replace('http:', 'ws:') + '/v1/petverse';
const type = expected => message => message.type === expected;
const tagged = (expected, id) => message => message.type === expected && message.requestId === id;

async function connect(origin, token) {
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
  const receive = predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listeners.delete(check);
      reject(new Error(`Expected a server message. Buffered types: ${inbox.map(message => message.type).join(', ')}`));
    }, 4000);
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
  send({ type: 'hello', ...(token ? { token } : {}) });
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
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      const closed = once(socket, 'close');
      socket.close();
      await closed;
    }
  };
}

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
  const unknown = await connect(origin, 'a'.repeat(43));
  assert.equal((await unknown.receive(type('error'))).code, 'invalid_token');
  await unknown.close();
});

test('synchronizes two real peers and validates movement, proximity, and server-owned rewards', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  const [first, second] = await Promise.all([connect(origin), connect(origin)]);
  const [me, other] = await Promise.all([first.receive(type('welcome')), second.receive(type('welcome'))]);
  assert.notEqual(me.self.id, other.self.id);
  assert.match(me.token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(me.progress.wallet, { sunbeams: 40, crystals: 0 });
  assert.equal((await first.action('too-far', { type: 'gather', nodeId: 'path-bloom' }, 'error')).code, 'too_far');
  first.send({ type: 'move', x: -1.6, z: 10, heading: 0.7 });
  const synced = await second.receive(message => message.type === 'peers' && message.peers.some(peer => peer.id === me.self.id && peer.x === -1.6));
  assert.equal(synced.peers[0].z, 10);
  assert.equal(synced.peers[0].pet.speciesId, 'twigpup');
  const gathered = await first.action('gather-once', { type: 'gather', nodeId: 'path-bloom', sunbeams: 999_999_999 });
  assert.equal(gathered.event.type, 'gather');
  assert.equal(gathered.progress.wallet.sunbeams, 40 + gathered.event.sunbeams);
  assert.ok(gathered.event.sunbeams < 100);
  const replayed = await first.action('gather-once', { type: 'gather', nodeId: 'path-bloom' });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.version, gathered.version);
  assert.deepEqual(replayed.progress.wallet, gathered.progress.wallet);

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
  const duplicateGuest = await connect(firstOrigin, welcome.token);
  assert.equal((await duplicateGuest.receive(type('error'))).code, 'active_session');
  await player.close();
  await firstServer.close();
  assert.equal((await readFile(dbPath)).includes(Buffer.from(welcome.token)), false);

  const reopened = createPetverseServer({ clientOrigins: [clientOrigin], dbPath });
  context.after(() => reopened.close());
  const restored = await connect(await reopened.listen(), welcome.token);
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

test('requires consent on both sides of a current trade and commits both inventories together', async context => {
  const server = createPetverseServer({ clientOrigins: [clientOrigin] });
  context.after(() => server.close());
  const origin = await server.listen();
  const [first, second] = await Promise.all([connect(origin), connect(origin)]);
  const [a, b] = await Promise.all([first.receive(type('welcome')), second.receive(type('welcome'))]);
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
  const restored = await connect(origin, a.token);
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
