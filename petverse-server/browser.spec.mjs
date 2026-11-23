import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createPetverseServer } from './server.mjs';

const route = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const control = (player, name) => player.getByRole('button', { name, exact: true });

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

async function connect(player) {
  await control(player, 'Online').click();
  await player.getByLabel('Server endpoint').fill(endpoint);
  await control(player, 'Join meadow').click();
  await expect(player.locator('.pv-status')).toHaveAttribute('data-state', 'online', { timeout: 15_000 });
}

test('two real players trade and restore the same guest progress after a server restart', async ({ browser }) => {
  const sessions = await Promise.all([0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 990, height: 820 } })));
  try {
    const [page, other] = await Promise.all(sessions.map(session => session.newPage()));
    await Promise.all([page, other].map(player => player.route('https://**/*', request => request.abort())));
    await Promise.all([page, other].map(player => player.goto(route)));
    const [first, second] = [page, other].map(gameFrame);
    for (const player of [first, second]) {
      await control(player, 'Settings').click();
      await control(player, 'Graphics').click();
      await player.getByLabel('Graphics quality').selectOption('low');
    }
    await Promise.all([first, second].map(connect));
    for (const player of [first, second]) await expect(player.locator('.pv-status')).toHaveText('Online · 2');

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

    const usedPort = Number(new URL(endpoint).port);
    await runner.close();
    await expect(first.locator('.pv-status')).toHaveText('Solo');
    await start(usedPort);
    await connect(first);
    await expect(first.locator('[data-currency="sunbeams"] strong')).toHaveText('22');
    await control(first, 'Pets').click();
    await expect(first.locator('.pv-pet-card')).toHaveCount(2);
  } finally {
    await Promise.all(sessions.map(session => session.close()));
  }
});
