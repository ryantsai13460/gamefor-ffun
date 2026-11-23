import { expect, test } from '@playwright/test';
import { biomeAt, EXPEDITION_BIOMES, expeditionDestination } from '../../assets/petverse/biomes.js';
import { applyAction, collectionMetrics, createProgress, EGGS } from '../../assets/petverse/model.js';
import { preferencesKey, soloKey } from '../../assets/petverse/preferences.js';

const gameRoute = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const surface = frame => frame.locator('.pv-world canvas');
const control = (scope, name) => scope.getByRole('button', { name, exact: true });
const menu = (frame, name) => control(frame.getByRole('navigation', { name: 'Petverse menus' }), name);
const coast = EXPEDITION_BIOMES.find(biome => biome.id === 'glasswater');
const peak = EXPEDITION_BIOMES.find(biome => biome.id === 'frostpine');
const basin = EXPEDITION_BIOMES.find(biome => biome.id === 'cinderbloom');

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

function readySave(level, rebirths = 0) {
  const progress = createProgress();
  progress.xp = 12 * level * (level - 1);
  progress.rebirths = rebirths;
  progress.wallet.sunbeams = 2_000;
  progress.upgrades.petDamage = 1;
  // Hatch and equip a real companion from the pre-expedition nursery for the test profile.
  const rolls = [0.9999, 0];
  const hatched = applyAction(progress, { type: 'hatch', eggId: 'moonbloom', mode: 'manual', count: 1 },
    { now: 1, random: () => rolls.shift() ?? 0 });
  if (hatched.event.type !== 'hatch') throw new Error(hatched.event.message);
  return hatched.progress;
}

async function openMeadow(page, progress, { observe = true, draw = 0.125 } = {}) {
  await page.addInitScript(({ progress, soloKey, preferencesKey, draw }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    Math.random = () => draw;
    if (!localStorage.getItem(soloKey)) localStorage.setItem(soloKey, JSON.stringify(progress));
    if (!localStorage.getItem(preferencesKey)) localStorage.setItem(preferencesKey, JSON.stringify({
      graphics: { quality: 'low', particles: 'off' }, audio: { enableAmbient: false, enableMusic: false }
    }));
  }, { progress, soloKey, preferencesKey, draw });

  if (observe) await page.route('**/petverse/world.js*', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('export function mountWorld(', 'function mountExpeditionWorld(');
    // Keep the public scene controller intact and capture its position and farming snapshots for assertions.
    await route.fulfill({ response, body: source + `
      export function mountWorld(...args) {
        const world = mountExpeditionWorld(...args);
        const damaged = new Set();
        const broken = new Set();
        const observe = { position: () => world.getPosition(), damaged, broken };
        Object.defineProperty(window, '__petverseExpedition', { value: observe });
        return { ...world, update(options) {
          for (const crystal of options.farming?.crystals || []) {
            if (crystal.health > 0 && crystal.health < crystal.maxHealth) damaged.add(crystal.id);
            if (crystal.health === 0) broken.add(crystal.id);
          }
          return world.update(options);
        } };
      }` });
  });

  await page.goto(gameRoute);
  const frame = gameFrame(page);
  await expect(frame.getByRole('heading', { name: 'Petverse Online' })).toBeVisible({ timeout: 20_000 });
  await expect(surface(frame)).toBeVisible({ timeout: 24_000 });
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 20_000 });
  await control(frame, 'Play Solo').click();
  return frame;
}

function readSave(frame) {
  return surface(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
}

function readPosition(frame) {
  return surface(frame).evaluate(() => window.__petverseExpedition.position());
}

async function openExplore(frame) {
  await menu(frame, 'Explore').click();
  await expect(frame.getByRole('heading', { name: 'Biome expeditions', exact: true })).toBeVisible();
}

async function travelTo(frame, biome, progress) {
  await openExplore(frame);
  const label = biome === 'meadow' ? 'Return to Sunstep Meadow' : 'Travel to ' + biome.label;
  const id = biome === 'meadow' ? 'meadow' : biome.id;
  const target = expeditionDestination(progress, id);
  expect(target).toBeTruthy();
  await control(frame, label).click();
  await expect.poll(async () => {
    const position = await readPosition(frame);
    return Math.hypot(position.x - target.x, position.z - target.z);
  }, { timeout: 12_000 }).toBeLessThan(.5);
}

async function walkAxis(page, frame, key, axis, target, tolerance = .4) {
  const scene = page.frames().find(child => /\/petverse\/index\.html(?:\?|$)/.test(child.url()));
  const start = (await readPosition(frame))[axis];
  if (Math.abs(target - start) <= tolerance) return;
  const sign = Math.sign(target - start);
  await surface(frame).focus();
  await page.keyboard.down(key);
  try {
    await scene.waitForFunction(({ axis, target, sign, tolerance }) =>
      sign * (target - window.__petverseExpedition.position()[axis]) < tolerance,
    { axis, target, sign, tolerance }, { timeout: 18_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

test('the mobile expedition map shows real level and rebirth gates for a new explorer', async ({ page }) => {
  test.setTimeout(55_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const frame = await openMeadow(page, createProgress(), { observe: false });
  await openExplore(frame);
  for (const biome of EXPEDITION_BIOMES) {
    await expect(frame.getByRole('heading', { name: biome.label, exact: true }).first()).toBeVisible();
    await expect(control(frame, 'Travel to ' + biome.label)).toBeDisabled();
  }
  await expect(frame.getByText(/Level 3/).first()).toBeVisible();
  await expect(frame.getByText(/Level 5/).first()).toBeVisible();
  await expect(frame.getByText(/Level 7/).first()).toBeVisible();
  const noHorizontalOverflow = await surface(frame).evaluate(canvas => canvas.ownerDocument.documentElement.scrollWidth <= window.innerWidth);
  expect(noHorizontalOverflow).toBe(true);
  await control(frame, 'Close menu').click();
  await expect(surface(frame)).toBeVisible();
});

test('coastal mining and a paid regional hatch contribute to the restored save', async ({ page }) => {
  test.setTimeout(115_000);
  const progress = readySave(3);
  progress.farming.enabled = false;
  const frame = await openMeadow(page, progress);
  const before = await readSave(frame);
  await travelTo(frame, coast, before);
  await expect(frame.locator('.pv-farming-hud')).toContainText(coast.label);
  await expect.poll(async () => biomeAt(await readPosition(frame))?.id).toBe(coast.id);
  await menu(frame, 'Farming').click();
  await control(frame, 'Follow Player').click();
  await control(frame, 'Close menu').click();
  await expect.poll(() => surface(frame).evaluate((_, id) => {
    const observation = window.__petverseExpedition;
    return [...observation.damaged].some(key => key.startsWith(id + '-')) &&
      [...observation.broken].some(key => key.startsWith(id + '-'));
  }, coast.id), { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await readSave(frame)).stats.goldEarned, { timeout: 20_000 })
    .toBeGreaterThan(before.stats.goldEarned);

  const egg = EGGS.find(egg => egg.id === coast.eggId);
  await menu(frame, 'Hatch').click();
  const hatch = control(frame, 'Hatch ' + egg.name);
  await expect(hatch).toHaveCount(0);
  await expect(frame.getByText('Hatch at the egg station in ' + coast.label + '.', { exact: true })).toBeVisible();
  await control(frame, 'Close menu').click();
  await control(frame, 'Reset camera').click();
  // The Coast camera faces east, so forward runs along the boardwalk and left heads toward the station.
  await walkAxis(page, frame, 'KeyW', 'x', 42);
  await walkAxis(page, frame, 'KeyA', 'z', 7);
  await walkAxis(page, frame, 'KeyW', 'x', 43.5);
  await menu(frame, 'Hatch').click();
  await expect(hatch).toBeEnabled();
  const beforeHatch = await readSave(frame);
  await hatch.click();
  await expect.poll(async () => (await readSave(frame)).stats.eggsHatched).toBe(beforeHatch.stats.eggsHatched + 1);
  const after = await readSave(frame);
  const record = after.hatchHistory.find(hatch => hatch.eggId === egg.id);
  expect(record.spent).toBe(egg.cost);
  expect(after.stats.sunbeamsSpent - beforeHatch.stats.sunbeamsSpent).toBe(egg.cost);
  expect(record.pets[0].speciesId).toBe(egg.pool[0].speciesId);
  expect(after.inventory.some(pet => pet.id === record.pets[0].id)).toBe(true);
  expect(after.stats.crystalsDestroyed).toBeGreaterThan(before.stats.crystalsDestroyed);
  expect(collectionMetrics(after).collectionScore).toBeGreaterThan(collectionMetrics(before).collectionScore);
  await openExplore(frame);
  const card = frame.locator('.pv-expedition-card').filter({ has: frame.getByRole('heading', { name: coast.label }) });
  await expect(card).toContainText('1 / 5 species');

  await travelTo(frame, 'meadow', after);
  await page.reload();
  await expect(surface(frame)).toBeVisible({ timeout: 25_000 });
  const restored = await readSave(frame);
  expect(restored.inventory.some(pet => pet.id === record.pets[0].id)).toBe(true);
  expect(collectionMetrics(restored).collectionScore).toBe(collectionMetrics(after).collectionScore);
});

test('a reborn explorer can visit the snowy and volcanic biomes and return to Sunstep', async ({ page }) => {
  test.setTimeout(75_000);
  const progress = readySave(7, 2);
  progress.farming.enabled = false;
  const frame = await openMeadow(page, progress);
  for (const biome of [peak, basin]) {
    await travelTo(frame, biome, progress);
    await expect.poll(async () => biomeAt(await readPosition(frame))?.id).toBe(biome.id);
    await expect(frame.locator('.pv-farming-hud')).toContainText(biome.label);
  }
  await travelTo(frame, 'meadow', progress);
  await expect(frame.locator('.pv-farming-hud')).toContainText('Sunstep Field');
});
