import { expect, test } from '@playwright/test';
import { ACHIEVEMENTS, EGGS, REBIRTH_ALTAR, createProgress, rebirthPlan } from '../../assets/petverse/model.js';
import { preferencesKey, soloKey } from '../../assets/petverse/preferences.js';

const gameRoute = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const control = (frame, name) => frame.getByRole('button', { name, exact: true });
const canvas = frame => frame.locator('canvas[aria-label="Petverse 3D Meadow"]');
const wallet = frame => frame.locator('[data-currency="sunbeams"] strong');

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

async function openMeadow(page) {
  await page.goto(gameRoute);
  const frame = gameFrame(page);
  await expect(canvas(frame)).toBeVisible({ timeout: 20_000 });
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 15_000 });
  return frame;
}

test('magnet pickup credits a gathered drop once and persists the balance in solo play', async ({ page }) => {
  const progress = createProgress();
  progress.farming.enabled = false;
  await page.addInitScript(({ key, progress }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(progress));
    const writes = [];
    const write = Storage.prototype.setItem;
    Object.defineProperty(window, '__petverseSaveWrites', { value: writes });
    Storage.prototype.setItem = function (name, value) {
      write.call(this, name, value);
      if (name === key) {
        const { wallet, drops } = JSON.parse(value);
        writes.push({ sunbeams: wallet.sunbeams, drops });
      }
    };
  }, { key: soloKey, progress });

  const frame = await openMeadow(page);
  await expect(wallet(frame)).toHaveText('40');
  const interact = frame.locator('.pv-interact');
  await canvas(frame).focus();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  try {
    await expect(interact).toHaveText('Gather Pathbloom', { timeout: 8_000 });
  } finally {
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
  }
  await interact.click();

  const readWrites = () => canvas(frame).evaluate(() => window.__petverseSaveWrites);
  await expect.poll(async () => (await readWrites()).at(-1)?.sunbeams, { timeout: 8_000 }).toBeGreaterThan(40);
  const writes = await readWrites();
  const dropped = writes.find(entry => entry.drops?.some(drop => drop.nodeId === 'path-bloom'));
  expect(dropped).toBeDefined();
  expect(dropped.sunbeams).toBe(40);
  const reward = dropped.drops.find(drop => drop.nodeId === 'path-bloom');
  const balance = 40 + reward.sunbeams;
  expect(reward.sunbeams).toBeGreaterThan(0);
  expect(writes.at(-1).drops).toHaveLength(0);
  expect(writes.at(-1).sunbeams).toBe(balance);
  await expect(wallet(frame)).toHaveText(String(balance));
  await page.reload();
  await expect(wallet(frame)).toHaveText(String(balance));
  const saved = await canvas(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
  expect(saved.drops).toHaveLength(0);
  expect(saved.wallet.sunbeams).toBe(balance);
});

test('Titanium can continue and then stop paid auto-hatching according to the saved rule', async ({ page }) => {
  const progress = createProgress();
  progress.xp = 74;
  const startingGold = 180;
  progress.wallet.sunbeams = startingGold;
  progress.upgrades.autoHatch = 1;
  progress.farming.enabled = false;
  await page.addInitScript(({ key, progress }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    Math.random = () => 0.999;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(progress));
  }, { key: soloKey, progress });

  const frame = await openMeadow(page);
  await control(frame, 'Auto hatch Sunmeadow Egg').click();
  const status = frame.locator('.pv-auto-status');
  await expect.poll(() => canvas(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)).stats.eggsHatched, soloKey),
    { timeout: 12_000 }).toBeGreaterThanOrEqual(2);
  await control(frame, 'Pause auto hatch').press('Enter');
  await expect(status).toContainText('Paused');
  await control(frame, 'Edit stop rules').click();
  await frame.getByRole('checkbox', { name: /Stop When Titanium/i }).check();
  await control(frame, 'Resume auto hatch').click();
  await control(frame, 'Hatch').click();
  await expect(status).toContainText('Stopped · Titanium hatched', { timeout: 10_000 });
  const saved = await canvas(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
  expect(saved.settings.stopVariants.titanium).toBe(true);
  expect(saved.stats.eggsHatched).toBeGreaterThanOrEqual(3);
  expect(saved.wallet.sunbeams).toBe(startingGold - saved.stats.eggsHatched * 18);
  expect(saved.inventory.filter(pet => pet.variant === 'titanium')).toHaveLength(saved.stats.eggsHatched);
});

test('walking to the Rebirth Cave unlocks the paid second-generation egg and achievement', async ({ page }) => {
  test.setTimeout(60_000);
  const progress = createProgress();
  const { requirements, rewards } = rebirthPlan(progress);
  const egg = EGGS.find(item => item.generation === 2);
  const achievement = ACHIEVEMENTS.find(item => item.id === 'cave-pledge');
  progress.xp = 12 * requirements.level * (requirements.level - 1);
  progress.wallet.sunbeams = requirements.sunbeams + egg.cost;
  progress.wallet.crystals = requirements.crystals;
  progress.farming.enabled = false;
  await page.addInitScript(({ key, prefsKey, progress }) => {
    if (!location.pathname.endsWith('/petverse/index.html') || localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify(progress));
    localStorage.setItem(prefsKey, JSON.stringify({ graphics: { quality: 'low' } }));
  }, { key: soloKey, prefsKey: preferencesKey, progress });

  // Read live coordinates for the walking waypoints without changing player movement or exposing a game command.
  await page.route('**/petverse/world.js*', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('export function mountWorld(', 'function mountObservedWorld(');
    await route.fulfill({ response, body: source + `
      export function mountWorld(...args) {
        const controller = mountObservedWorld(...args);
        Object.defineProperty(window, '__petverseWalkPosition', { value: () => controller.getPosition() });
        return controller;
      }` });
  });

  const frame = await openMeadow(page);
  await control(frame, 'Journal').click();
  await control(frame, 'Rebirth Cave').click();
  await expect(control(frame, 'Begin rebirth')).toBeDisabled();

  const surface = canvas(frame);
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 31, y, { steps: 5 });
  await page.mouse.up();
  await surface.focus();
  const position = () => surface.evaluate(() => window.__petverseWalkPosition());
  async function walk(key, measure, limit) {
    await page.keyboard.down(key);
    try {
      await expect.poll(async () => measure(await position()), { timeout: 12_000, intervals: [40, 65, 85] }).toBeLessThan(limit);
    } finally {
      await page.keyboard.up(key);
    }
  }

  async function centerOnTrail() {
    const target = REBIRTH_ALTAR.x;
    const { x } = await position();
    if (x > target + .6) await walk('KeyA', point => point.x, target + .3);
    else if (x < target - .6) await walk('KeyD', point => -point.x, -target + .3);
  }

  await walk('KeyW', ({ z }) => z, 5.4);
  await centerOnTrail();
  await walk('KeyW', ({ z }) => z, REBIRTH_ALTAR.z + 8.5);
  await centerOnTrail();
  await walk('KeyW', ({ x, z }) => Math.hypot(x - REBIRTH_ALTAR.x, z - REBIRTH_ALTAR.z), REBIRTH_ALTAR.radius - 0.5);
  await expect(control(frame, 'Begin rebirth')).toBeEnabled();
  await control(frame, 'Begin rebirth').click();
  await control(frame, 'Confirm rebirth').click();
  const ascension = frame.locator('[data-currency="ascension"] strong');
  await expect(ascension).toHaveText(String(rewards.ascension));
  await expect(wallet(frame)).toHaveText(String(egg.cost));

  await control(frame, 'Hatch').click();
  await control(frame, 'Hatch ' + egg.name).click();
  await expect(wallet(frame)).toHaveText('0');
  await control(frame, 'Journal').click();
  await control(frame, 'Milestones').click();
  await control(frame, 'Claim ' + achievement.name).click();
  await expect(ascension).toHaveText(String(rewards.ascension + achievement.reward));

  await page.reload();
  await expect(ascension).toHaveText(String(rewards.ascension + achievement.reward));
  const saved = await canvas(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
  expect(saved.rebirths).toBe(1);
  expect(saved.achievements).toContain(achievement.id);
  expect(saved.inventory.map(pet => pet.speciesId)).toContain('twigpup');
  expect(egg.pool.some(pet => pet.speciesId === saved.inventory[1].speciesId)).toBe(true);
});
