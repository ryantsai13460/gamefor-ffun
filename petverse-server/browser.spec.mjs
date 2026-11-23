import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { preferencesKey } from '../assets/petverse/preferences.js';
import { createPetverseServer } from './server.mjs';

const route = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const control = (player, name) => player.getByRole('button', { name, exact: true });
const connection = player => player.locator('.pv-status');

function watchServer(page) {
  const latest = new Map();
  page.on('websocket', socket => {
    if (new URL(socket.url()).pathname !== '/v1/petverse') return;
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(payload.toString());
      latest.set(message.type, message);
    });
  });
  return type => latest.get(type);
}

let runner;
let folder;
let endpoint;
let baseURL;

async function start(port) {
  runner = createPetverseServer({ clientOrigins: [baseURL], dbPath: join(folder, 'profiles.sqlite') });
  const origin = await runner.listen(port);
  endpoint = new URL('/v1/petverse', origin.replace('http:', 'ws:')).href;
}

test.beforeAll(async ({}, info) => {
  baseURL = info.project.use.baseURL;
  folder = await mkdtemp(join(tmpdir(), 'petverse-browser-test-'));
  await start();
});

test.afterAll(async () => {
  await runner?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
});

async function openPrivateMenu(player, mode) {
  await control(player, mode === 'create' ? 'Create Private Server' : 'Join With Code').click();
  await player.getByLabel('Server endpoint').fill(endpoint);
}

async function createRoom(player) {
  await openPrivateMenu(player, 'create');
  await control(player, 'Create private meadow').click();
  await expect(connection(player)).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
  const field = player.getByLabel('Invite code', { exact: true });
  await expect(field).toHaveValue(/^PET-[A-F0-9]{10}$/);
  return field.inputValue();
}

async function enterCode(player, code) {
  await player.getByLabel('Invitation code', { exact: true }).fill(code);
  await control(player, 'Join private meadow').click();
}

test('two real players join by invitation, move, trade and restore a saved guest after restart', async ({ browser }) => {
  const sessions = await Promise.all([0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 990, height: 820 } })));
  try {
    const [page, other] = await Promise.all(sessions.map(session => session.newPage()));
    const firstMessage = watchServer(page);
    const secondMessage = watchServer(other);
    await Promise.all([page, other].map(player => player.route('https://**/*', request => request.abort())));
    await Promise.all([page, other].map(player => player.addInitScript(key => {
      if (!location.pathname.endsWith('/petverse/index.html') || localStorage.getItem(key)) return;
      localStorage.setItem(key, JSON.stringify({ graphics: { quality: 'low', particles: 'off', reducedMotion: true } }));
    }, preferencesKey)));
    await Promise.all([page, other].map(player => player.goto(route)));
    const [first, second] = [page, other].map(gameFrame);
    const code = await createRoom(first);
    const { room, self: host } = firstMessage('welcome');
    expect(room.code).toBe(code);
    await openPrivateMenu(second, 'join');
    const invalidCode = code.slice(0, -1) + (code.endsWith('0') ? '1' : '0');
    await enterCode(second, invalidCode);
    await expect(second.getByRole('alert')).toContainText(/code/i);
    await expect(connection(second)).not.toHaveAttribute('data-state', 'online');
    expect(secondMessage('welcome')).toBeUndefined();
    await enterCode(second, code);
    await expect(connection(second)).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
    const guest = secondMessage('welcome');
    expect(guest.room.id).toBe(room.id);
    expect(guest.room.code).toBeUndefined();
    expect(guest.self.id).not.toBe(host.id);
    await expect(second.getByLabel('Invite code', { exact: true })).toHaveCount(0);
    await expect(first.getByRole('button', { name: 'Offer trade to ' + guest.self.name })).toBeVisible();
    await expect(second.getByRole('button', { name: 'Offer trade to ' + host.name })).toBeVisible();

    const world = first.locator('canvas[aria-label="Petverse 3D Meadow"]');
    await world.focus();
    await page.keyboard.down('KeyD');
    try {
      await expect.poll(() => {
        const movedHost = secondMessage('peers')?.peers.find(peer => peer.id === host.id);
        return movedHost ? Math.hypot(movedHost.x - host.x, movedHost.z - host.z) : 0;
      }, { timeout: 8_000 }).toBeGreaterThan(0.4);
    } finally {
      await page.keyboard.up('KeyD');
    }

    for (const player of [first, second]) {
      await control(player, 'Hatch').click();
      await control(player, 'Hatch Sunmeadow Egg').click();
      await expect(player.locator('[data-currency="sunbeams"] strong')).toHaveText('22');
      await control(player, 'Pets').click();
      await expect(player.locator('.pv-pet-card')).toHaveCount(2);
      // The starter is standard and remains unprotected even when the new hatch is a rare variant.
      const starter = player.locator('.pv-pet-card').filter({ has: player.getByRole('heading', { name: 'Twigpup', exact: true }) }).first();
      await control(starter, 'Unequip Twigpup').click();
      await control(player, 'Online').click();
    }
    await first.getByRole('button', { name: /^Offer trade to/ }).click();
    await control(second, 'Accept trade').click();
    for (const player of [first, second]) {
      await player.getByText('Choose pets to offer', { exact: true }).click();
      await player.getByRole('checkbox', { name: 'Twigpup', exact: true }).first().check();
      await control(player, 'Save offer').click();
      await expect(player.locator('.pv-trade-offers')).toContainText('Twigpup');
    }
    await control(first, 'Confirm trade').click();
    await expect(second.locator('.pv-trade')).toContainText('Other player confirmed.');
    await control(second, 'Confirm trade').click();
    for (const player of [first, second]) {
      await expect(player.locator('.pv-banner')).toHaveText(/Trade complete/);
      await expect(player.locator('.pv-trade')).toHaveCount(0);
    }

    await control(first, 'Journal').click();
    await control(first, 'Leaderboards').click();
    const ranking = first.locator('.pv-rankings select');
    await expect(ranking).toBeVisible();
    await ranking.selectOption('eggsHatched');
    for (const name of [host.name, guest.self.name]) {
      const score = first.locator('.pv-ranking-list li').filter({ hasText: name }).locator('strong');
      await expect(score).toHaveText('1');
    }
    expect(firstMessage('leaderboard-result').entries).toHaveLength(2);

    const usedPort = Number(new URL(endpoint).port);
    await runner.close();
    await expect(connection(first)).not.toHaveAttribute('data-state', 'online');
    await start(usedPort);
    await createRoom(first);
    expect(firstMessage('welcome').self.id).toBe(host.id);
    expect(firstMessage('welcome').room.id).not.toBe(room.id);
    await expect(first.locator('[data-currency="sunbeams"] strong')).toHaveText('22');
    await control(first, 'Pets').click();
    await expect(first.locator('.pv-pet-card')).toHaveCount(2);
  } finally {
    await Promise.all(sessions.map(session => session.close()));
  }
});
