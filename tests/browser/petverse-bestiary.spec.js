import { expect, test } from '@playwright/test';
import { EXPEDITION_BIOMES, expeditionEggAt } from '../../assets/petverse/biomes.js';
import { applyAction, collectionMetrics, createProgress, EGGS, hatchOdds, PETS, VARIANTS } from '../../assets/petverse/model.js';
import { preferencesKey, soloKey } from '../../assets/petverse/preferences.js';

const route = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const surface = frame => frame.locator('.pv-world canvas');
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const menu = (frame, name) => button(frame.getByRole('navigation', { name: 'Petverse menus' }), name);
const eggCard = (frame, egg) => frame.locator(`[data-egg-id="${egg.id}"]`);
const collectionCards = frame => frame.locator('.pv-collection-card');
const coast = EXPEDITION_BIOMES.find(biome => biome.id === 'glasswater');

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', request => request.abort());
});

async function openPetverse(page, progress, { roll = .01, observePosition = false } = {}) {
  // Freeze only the draws, while paying and hatching through the actual game controls.
  progress.farming.enabled = false;
  await page.addInitScript(({ progress, roll, soloKey, preferencesKey }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    Math.random = () => roll;
    if (!localStorage.getItem(soloKey)) localStorage.setItem(soloKey, JSON.stringify(progress));
    if (!localStorage.getItem(preferencesKey)) localStorage.setItem(preferencesKey, JSON.stringify({
      graphics: { quality: 'low', particles: 'off' }, audio: { enableAmbient: false, enableMusic: false }
    }));
  }, { progress, roll, soloKey, preferencesKey });
  if (observePosition) await page.route('**/petverse/world.js*', async request => {
    const response = await request.fetch();
    // Read the scene position while the browser moves the player with the keyboard.
    const source = (await response.text()).replace('export function mountWorld(', 'function mountObservedWorld(');
    await request.fulfill({ response, body: source + `
      export function mountWorld(...args) {
        const world = mountObservedWorld(...args);
        window.readPetverseStationPosition = () => world.getPosition();
        return world;
      }` });
  });
  await page.goto(route);
  const frame = gameFrame(page);
  await expect(surface(frame)).toBeVisible({ timeout: 24_000 });
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 20_000 });
  await button(frame, 'Play Solo').click();
  return frame;
}

const readSave = frame => surface(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
const readPosition = frame => surface(frame).evaluate(() => window.readPetverseStationPosition());

function speciesRoll(progress, egg, speciesId) {
  const pool = hatchOdds(progress, egg.id).pool;
  const index = pool.findIndex(record => record.speciesId === speciesId);
  expect(index).toBeGreaterThanOrEqual(0);
  const total = pool.reduce((weight, record) => weight + record.weight, 0);
  const lower = pool.slice(0, index).reduce((weight, record) => weight + record.weight, 0);
  return (lower + pool[index].weight / 2) / total;
}

async function openCollection(frame) {
  await menu(frame, 'Pets').click();
  await button(frame, 'Collection').click();
  await expect(frame.getByRole('heading', { name: 'Pet journal', exact: true })).toBeVisible();
}

async function openBestiaryEggs(frame, habitat = 'sunstep') {
  await menu(frame, 'Hatch').click();
  await button(frame, 'Bestiary eggs').click();
  await frame.getByLabel('Egg habitat', { exact: true }).selectOption(habitat);
}

async function walkAxis(page, frame, key, axis, target) {
  const scene = page.frames().find(child => /\/petverse\/index\.html(?:\?|$)/.test(child.url()));
  const sign = Math.sign(target - (await readPosition(frame))[axis]);
  await surface(frame).focus();
  await page.keyboard.down(key);
  try {
    await scene.waitForFunction(({ axis, target, sign }) =>
      sign * (target - window.readPetverseStationPosition()[axis]) < .35,
    { axis, target, sign }, { timeout: 18_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

test('the mobile bestiary browses all 500 species and can filter the new rarity', async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const frame = await openPetverse(page, createProgress());
  await openCollection(frame);
  await expect(frame.getByText('1 of 500 species discovered · 0.2%', { exact: true })).toBeVisible();
  await expect(frame.getByText('Showing 1–24 of 500 species', { exact: true })).toBeVisible();
  await expect(collectionCards(frame)).toHaveCount(24);
  const firstPage = await collectionCards(frame).getByRole('heading').allTextContents();
  await button(frame, 'Next page').click();
  await expect(frame.getByText('Page 2 of 21', { exact: true })).toBeVisible();
  const secondPage = await collectionCards(frame).getByRole('heading').allTextContents();
  expect(secondPage).toHaveLength(24);
  expect(secondPage.some(name => firstPage.includes(name))).toBe(false);

  await frame.getByLabel('Rarity', { exact: true }).selectOption('primordial');
  await expect(collectionCards(frame)).toHaveCount(20);
  await expect(frame.getByText('Showing 1–20 of 20 species', { exact: true })).toBeVisible();
  const top = PETS.find(pet => pet.rarity === 'primordial');
  await frame.getByRole('searchbox', { name: 'Search pets', exact: true }).fill(top.name);
  await expect(collectionCards(frame)).toHaveCount(1);
  await expect(collectionCards(frame).getByRole('heading', { name: top.name, exact: true })).toBeVisible();
  await expect(collectionCards(frame)).toHaveAttribute('data-discovered', 'false');
  const overflow = await surface(frame).evaluate(canvas => canvas.ownerDocument.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('a paid Clover hatch uses real odds and saves a discovered Primordial', async ({ page }) => {
  test.setTimeout(80_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const start = createProgress();
  const egg = EGGS.find(egg => egg.id === 'clover-egg');
  const species = PETS.find(pet => pet.eggId === egg.id && pet.rarity === 'primordial');
  const roll = speciesRoll(start, egg, species.id);
  const expected = applyAction(start, { type: 'hatch', eggId: egg.id, mode: 'manual', count: 1 }, { now: 1, random: () => roll });
  expect(expected.event.type).toBe('hatch');
  expect(expected.event.pets[0].speciesId).toBe(species.id);
  const variant = VARIANTS.find(item => item.id === expected.event.pets[0].variant);
  const visibleName = variant.id === 'normal' ? species.name : variant.name + ' ' + species.name;
  const frame = await openPetverse(page, start, { roll });
  await openBestiaryEggs(frame);
  const card = eggCard(frame, egg);
  await expect(card.getByRole('heading', { name: 'Clover Egg', exact: true })).toBeVisible();
  const rarityOdds = card.locator('details').filter({ hasText: 'Rarity odds' });
  await rarityOdds.locator('summary').click();
  await expect(rarityOdds).toContainText('Primordial');
  await expect(rarityOdds.getByText('0.3%', { exact: true })).toBeVisible();
  await button(card, 'Hatch Clover Egg').click();
  await expect.poll(async () => (await readSave(frame)).stats.eggsHatched).toBe(start.stats.eggsHatched + 1);

  const saved = await readSave(frame);
  expect(saved.wallet.sunbeams).toBe(start.wallet.sunbeams - egg.cost);
  expect(saved.discovered).toContain(species.id);
  expect(saved.equipped).toContain(expected.event.pets[0].id);
  expect(saved.hatchHistory[0]).toMatchObject({ eggId: egg.id, spent: egg.cost, pets: expected.event.pets.map(({ id, speciesId, variant }) => ({ id, speciesId, variant })) });
  expect(collectionMetrics(saved).collectionScore).toBe(collectionMetrics(expected.progress).collectionScore);
  await expect(frame.getByRole('heading', { name: visibleName, exact: true }).first()).toBeVisible();
  await button(frame, 'Close menu').click();
  await expect(frame.locator('.pv-world [data-pet-variant]').filter({ hasText: species.name })).toHaveCount(1);

  await page.reload();
  await expect(surface(frame)).toBeVisible({ timeout: 24_000 });
  await openCollection(frame);
  await frame.getByLabel('Rarity', { exact: true }).selectOption('primordial');
  await frame.getByRole('searchbox', { name: 'Search pets', exact: true }).fill(species.name);
  await expect(collectionCards(frame)).toHaveCount(1);
  await expect(collectionCards(frame)).toHaveAttribute('data-discovered', 'true');
  expect(collectionMetrics(await readSave(frame)).collectionScore).toBe(collectionMetrics(saved).collectionScore);
});

test('a coastal bestiary hatch uses its unlocked physical station and gold cost', async ({ page }) => {
  test.setTimeout(100_000);
  const start = createProgress();
  start.xp = 72;
  start.wallet.sunbeams = 400;
  const egg = EGGS.find(egg => egg.bestiary && egg.habitatId === coast.id && egg.level === 3);
  expect(egg).toBeTruthy();
  const frame = await openPetverse(page, start, { observePosition: true });
  await openBestiaryEggs(frame, coast.id);
  await expect(eggCard(frame, egg)).toContainText('Hatch at the egg station in Glasswater Coast.');
  await expect(button(eggCard(frame, egg), 'Hatch ' + egg.name)).toHaveCount(0);

  await menu(frame, 'Explore').click();
  await button(frame, 'Travel to ' + coast.label).click();
  await expect.poll(async () => (await readPosition(frame)).x).toBeCloseTo(coast.arrival.x, 1);
  await button(frame, 'Reset camera').click();
  // The regional camera faces east, so forward crosses the boardwalk and left turns toward the station.
  await walkAxis(page, frame, 'KeyW', 'x', 42);
  await walkAxis(page, frame, 'KeyA', 'z', 7);
  await walkAxis(page, frame, 'KeyW', 'x', 43.5);
  expect(expeditionEggAt(await readPosition(frame), coast.id)).toBe(true);

  await openBestiaryEggs(frame, coast.id);
  await button(eggCard(frame, egg), 'Hatch ' + egg.name).click();
  await expect.poll(async () => (await readSave(frame)).stats.eggsHatched).toBe(1);
  const saved = await readSave(frame);
  expect(saved.wallet.sunbeams).toBe(start.wallet.sunbeams - egg.cost);
  expect(saved.hatchHistory[0]).toMatchObject({ eggId: egg.id, spent: egg.cost });
  const species = PETS.find(pet => pet.id === saved.hatchHistory[0].pets[0].speciesId);
  expect(species).toMatchObject({ habitatId: coast.id, eggId: egg.id });
});
