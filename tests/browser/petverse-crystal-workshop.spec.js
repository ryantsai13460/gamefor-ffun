import { expect, test } from '@playwright/test';
import { GENERATOR_SITE, generatorEggCost, generatorStats } from '../../assets/petverse/generator.js';
import { EGGS, createProgress } from '../../assets/petverse/model.js';
import { preferencesKey, soloKey } from '../../assets/petverse/preferences.js';

const gameRoute = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const canvas = frame => frame.locator('.pv-world canvas');
const control = (frame, name) => frame.getByRole('button', { name, exact: true });

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

async function readSolo(frame) {
  return canvas(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
}

async function openMeadow(page, progress = createProgress()) {
  await page.addInitScript(({ progress, soloKey, preferencesKey }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    if (!localStorage.getItem(soloKey)) localStorage.setItem(soloKey, JSON.stringify(progress));
    if (!localStorage.getItem(preferencesKey)) {
      localStorage.setItem(preferencesKey, JSON.stringify({
        graphics: { quality: 'low', particles: 'off' }, audio: { enableAmbient: false, enableMusic: false }
      }));
    }
    const saves = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      setItem.call(this, key, value);
      if (key === soloKey) saves.push(JSON.parse(value));
    };
    Object.defineProperty(window, '__petverseObservedSaves', { value: saves });
  }, { progress, soloKey, preferencesKey });

  // Observe the coordinates and updates the production scene receives. Movement still uses the canvas controls.
  await page.route('**/petverse/world.js*', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('export function mountWorld(', 'function mountObservedWorld(');
    await route.fulfill({ response, body: source + `
      export function mountWorld(...args) {
        const controller = mountObservedWorld(...args);
        const observation = { position: () => controller.getPosition(), update: null, damaged: new Set() };
        Object.defineProperty(window, '__petverseObservedWorld', { value: observation });
        return { ...controller, update(options) {
          observation.update = options;
          for (const crystal of options.farming?.crystals || []) {
            if (crystal.health > 0 && crystal.health < crystal.maxHealth) observation.damaged.add(crystal.id);
          }
          return controller.update(options);
        } };
      }` });
  });

  await page.goto(gameRoute);
  const frame = gameFrame(page);
  await expect(frame.getByRole('heading', { name: 'Petverse Online' })).toBeVisible({ timeout: 20_000 });
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 20_000 });
  await expect(canvas(frame)).toBeVisible({ timeout: 20_000 });
  return frame;
}

async function faceNorth(page, frame) {
  const surface = canvas(frame);
  // The default 0.28-radian yaw is almost exactly a 31px drag at the default sensitivity.
  const point = await surface.boundingBox();
  const x = point.x + point.width * .28;
  const y = point.y + point.height * .47;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 31, y, { steps: 5 });
  await page.mouse.up();
  await surface.focus();
}

async function walkAxis(page, frame, axis, target, tolerance = .48) {
  const surface = canvas(frame);
  const scene = page.frames().find(child => /\/petverse\/index\.html(?:\?|$)/.test(child.url()));
  const from = await scene.evaluate(axis => window.__petverseObservedWorld.position()[axis], axis);
  if (Math.abs(target - from) <= tolerance) return;
  const sign = Math.sign(target - from);
  const key = axis === 'x' ? (sign > 0 ? 'KeyD' : 'KeyA') : (sign > 0 ? 'KeyS' : 'KeyW');
  await surface.focus();
  await page.keyboard.down(key);
  try {
    await scene.waitForFunction(({ axis, target, sign, tolerance }) =>
      sign * (target - window.__petverseObservedWorld.position()[axis]) < tolerance,
    { axis, target, sign, tolerance }, { timeout: 24_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

async function enterWorkshop(page, frame) {
  await faceNorth(page, frame);
  // Skirt the Honeyspire on the south trail before crossing to the workshop.
  await walkAxis(page, frame, 'z', 19.3, .7);
  await walkAxis(page, frame, 'x', -3.1);
  await walkAxis(page, frame, 'z', 25.3);
  await walkAxis(page, frame, 'x', GENERATOR_SITE.x);
  await walkAxis(page, frame, 'z', GENERATOR_SITE.z + .9);
  await expect(frame.locator('.pv-interact')).toContainText(/operate generator/i);
}

test('a starter pet damages a crystal and the magnet credits the dropped Gold exactly once', async ({ page }) => {
  test.setTimeout(55_000);
  const frame = await openMeadow(page);
  const wallet = frame.locator('[data-currency="sunbeams"]');
  await expect(wallet).toContainText('Gold');
  await control(frame, 'Play Solo').click();
  const meters = frame.locator('[data-crystal-id]:visible meter');
  await expect.poll(() => meters.evaluateAll(labels => labels.some(meter => meter.value > 0 && meter.value < meter.max)), {
    timeout: 18_000, intervals: [75, 110, 150]
  }).toBe(true);

  const writes = () => canvas(frame).evaluate(() => window.__petverseObservedSaves);
  const openingGold = createProgress().wallet.sunbeams;
  await expect.poll(async () => (await readSolo(frame)).wallet.sunbeams, { timeout: 15_000 }).toBeGreaterThan(openingGold);
  const saves = await writes();
  const firstCrystalDrop = drop => drop.kind === 'crystal-gold';
  const broke = saves.find(save => save.stats.crystalsDestroyed > 0 && save.drops?.some(firstCrystalDrop));
  expect(broke).toBeDefined();
  expect(broke.wallet.sunbeams).toBe(openingGold);
  const reward = broke.drops.find(firstCrystalDrop);
  expect(await canvas(frame).evaluate((_, id) => window.__petverseObservedWorld.damaged.has(id), reward.crystalId)).toBe(true);
  const collected = saves.find(save => save.wallet.sunbeams > openingGold && !save.drops.some(drop => drop.id === reward.id));
  expect(collected).toBeDefined();
  expect(collected.wallet.sunbeams).toBe(openingGold + reward.sunbeams);
  expect(collected.stats.goldEarned).toBe(reward.sunbeams);

  await control(frame, 'Farming').click();
  await frame.getByRole('checkbox', { name: 'Automatic Crystal Targeting', exact: true }).uncheck();
  await expect.poll(async () => (await readSolo(frame)).farming.enabled).toBe(false);
  const beforeReload = await readSolo(frame);
  await page.reload();
  await expect(canvas(frame)).toBeVisible({ timeout: 20_000 });
  expect((await readSolo(frame)).wallet.sunbeams).toBe(beforeReload.wallet.sunbeams);
  expect((await readSolo(frame)).drops.some(drop => drop.id === reward.id)).toBe(false);
});

test('assigned pets earn remote Gold while a player walks to and operates the crank', async ({ page }) => {
  test.setTimeout(110_000);
  const progress = createProgress();
  progress.xp = 24;
  progress.wallet.sunbeams = 90;
  const frame = await openMeadow(page, progress);
  await control(frame, 'Upgrades').click();
  await control(frame, 'Buy Remote magnet').click();
  await expect.poll(async () => (await readSolo(frame)).upgrades.remoteMagnet).toBe(1);
  await control(frame, 'Play Solo').click();

  await control(frame, 'Generator').click();
  await expect(control(frame, 'Start Cranking')).toBeDisabled();
  await control(frame, 'Farming').click();
  await expect(frame.getByLabel('Change farming area').locator('option[value="ember-verge"]')).toHaveCount(0);
  await expect(frame.getByText(/Ember Verge unlocks at Level 3 after 1 rebirth/)).toBeVisible();
  await control(frame, 'Assign Pets Here').click();
  await expect.poll(async () => (await readSolo(frame)).farming.area).toBe('sunstep');
  await control(frame, 'Close menu').click();

  await enterWorkshop(page, frame);
  const before = await readSolo(frame);
  expect(before.generator.energy).toBe(0);
  const position = () => canvas(frame).evaluate(() => window.__petverseObservedWorld.position());
  const workshop = GENERATOR_SITE;
  const reached = await position();
  expect(Math.hypot(reached.x - workshop.x, reached.z - workshop.z)).toBeLessThan(workshop.radius);
  expect(Math.hypot(reached.x, reached.z - 16)).toBeGreaterThan(9);

  await canvas(frame).press('e');
  const crankHud = frame.locator('.pv-crank-hud');
  const stop = control(crankHud, 'Stop Cranking');
  await expect(stop).toBeVisible();
  await expect(canvas(frame)).toHaveAttribute('data-charging', 'true');
  await expect(frame.locator('.pv-farming-hud')).toContainText('Sunstep Field · Assigned');
  await expect.poll(async () => (await readSolo(frame)).generator.energy, { timeout: 12_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await readSolo(frame)).stats.crankGold, { timeout: 28_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await readSolo(frame)).stats.crystalsDestroyed, { timeout: 24_000 }).toBeGreaterThan(before.stats.crystalsDestroyed);
  const working = await readSolo(frame);
  expect(working.wallet.sunbeams).toBeGreaterThan(before.wallet.sunbeams);
  expect(working.farming.area).toBe('sunstep');
  expect(working.generator.operations).toBe(1);
  await expect.poll(() => canvas(frame).evaluate(() => window.__petverseObservedWorld.update?.farming?.pets
    .some(pet => pet.ownerId === 'solo' && Math.hypot(pet.x, pet.z - 16) < 9))).toBe(true);

  await stop.click();
  const stopped = await readSolo(frame);
  await expect(stop).toBeHidden();
  await expect(canvas(frame)).toHaveAttribute('data-charging', 'false');
  await expect.poll(async () => (await readSolo(frame)).stats.crystalsDestroyed, { timeout: 26_000 }).toBeGreaterThan(stopped.stats.crystalsDestroyed);
  expect((await readSolo(frame)).generator.energy).toBe(stopped.generator.energy);

  await control(frame, 'Generator').click();
  await control(frame, 'Start Cranking').click();
  await expect.poll(async () => (await readSolo(frame)).generator.operations).toBe(2);
  await page.reload();
  await expect(canvas(frame)).toBeVisible({ timeout: 20_000 });
  await control(frame, 'Generator').click();
  await expect(stop).toBeHidden();
  expect((await readSolo(frame)).generator.operations).toBe(2);
  expect((await readSolo(frame)).farming.area).toBe('sunstep');
  await control(frame, 'Farming').click();
  await control(frame, 'Recall All Pets').click();
  await expect.poll(async () => (await readSolo(frame)).farming).toMatchObject({ area: null, enabled: false });
  await control(frame, 'Follow Player').click();
  await expect.poll(async () => (await readSolo(frame)).farming).toMatchObject({ area: null, enabled: true });
});

test('the crank finishes charging an egg and only then grants a pet for Gold and energy', async ({ page }) => {
  test.setTimeout(85_000);
  const progress = createProgress();
  const egg = EGGS[0];
  const { threshold } = generatorStats(progress);
  progress.farming.enabled = false;
  progress.generator.energy = threshold - 8000;
  progress.generator.produced = progress.generator.energy;
  const frame = await openMeadow(page, progress);
  await control(frame, 'Play Solo').click();
  await enterWorkshop(page, frame);

  await control(frame, 'Generator').click();
  await expect(control(frame, 'Hatch Charged Egg')).toBeDisabled();
  await control(frame, 'Start Cranking').click();
  await expect(control(frame, 'Close menu')).toBeHidden();
  await control(frame, 'Generator').click();
  await expect(control(frame, 'Hatch Charged Egg')).toBeEnabled({ timeout: 12_000 });
  await control(frame, 'Hatch Charged Egg').click();
  await expect.poll(async () => (await readSolo(frame)).generator.hatches).toBe(1);
  const award = await canvas(frame).evaluate(() => window.__petverseObservedSaves.find(save => save.generator.hatches === 1));
  expect(award.generator.energy).toBe(0);
  expect(award.wallet.sunbeams).toBe(progress.wallet.sunbeams - generatorEggCost(egg));
  expect(award.stats.eggsHatched).toBe(1);
  expect(award.inventory).toHaveLength(progress.inventory.length + 1);
  expect(egg.pool.some(entry => entry.speciesId === award.inventory.at(-1).speciesId)).toBe(true);
});

test('full-screen play keeps the 3D canvas full size when the farming menu opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  const frame = await openMeadow(page);
  await control(frame, 'Play Solo').click();
  await control(frame, 'Fullscreen').click();
  const surface = canvas(frame);
  await expect.poll(() => surface.evaluate(element => element.ownerDocument.fullscreenElement?.id)).toBe('petverse');
  const fullscreen = await surface.boundingBox();
  expect(fullscreen.width).toBeGreaterThanOrEqual(385);
  expect(fullscreen.height).toBeGreaterThanOrEqual(790);
  await control(frame, 'Farming').click();
  await expect(control(frame, 'Assign Pets Here')).toBeVisible();
  const withMenu = await surface.boundingBox();
  expect(Math.abs(fullscreen.width - withMenu.width)).toBeLessThan(5);
  expect(Math.abs(fullscreen.height - withMenu.height)).toBeLessThan(5);
  await control(frame, 'Close menu').click();
  await expect(control(frame, 'Assign Pets Here')).toBeHidden();
  expect(await surface.evaluate(element => element.ownerDocument.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await control(frame, 'Exit fullscreen').click();
  await expect.poll(() => surface.evaluate(element => Boolean(element.ownerDocument.fullscreenElement))).toBe(false);
});
