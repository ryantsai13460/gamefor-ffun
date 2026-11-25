import { expect, test } from '@playwright/test';
import { createProgress } from '../../assets/petverse/model.js';
import { preferencesKey, soloKey } from '../../assets/petverse/preferences.js';

const route = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const surface = frame => frame.locator('.pv-world canvas');
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const menu = (frame, name) => button(frame.getByRole('navigation', { name: 'Petverse menus' }), name);

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', request => request.abort());
});

async function launchPetverse(page, progress = createProgress(), observeMovement = false) {
  progress.farming.enabled = false;
  await page.addInitScript(({ progress, soloKey, preferencesKey }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    if (!localStorage.getItem(soloKey)) localStorage.setItem(soloKey, JSON.stringify(progress));
    if (!localStorage.getItem(preferencesKey)) localStorage.setItem(preferencesKey, JSON.stringify({
      graphics: { quality: 'low', particles: 'off', antiAliasing: false }, audio: { enableAmbient: false, enableMusic: false }
    }));
  }, { progress, soloKey, preferencesKey });
  if (observeMovement) {
    await page.route('**/petverse/world.js*', async request => {
      const response = await request.fetch();
      const source = (await response.text()).replace('export function mountWorld(', 'function mountObservedWorld(');
      await request.fulfill({ response, body: source + `
        export function mountWorld(...args) {
          const world = mountObservedWorld(...args);
          window.readPetverseMovement = () => world.getPosition();
          return world;
        }` });
    });
  }
  if (observeMovement === 'jump') {
    await page.route('**/petverse/models.js*', async request => {
      const response = await request.fetch();
      const source = (await response.text()).replace('export function createTraveler(', 'function createObservedTraveler(');
      await request.fulfill({ response, body: source + `
        export function createTraveler(...args) {
          const traveler = createObservedTraveler(...args);
          window.readPetverseTraveler ||= () => traveler.position.y;
          return traveler;
        }` });
    });
  }
  await page.goto(route);
  const frame = gameFrame(page);
  await expect(surface(frame)).toBeVisible({ timeout: 35_000 });
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 20_000 });
  const solo = button(frame, 'Play Solo');
  if (await surface(frame).evaluate(() => matchMedia('(pointer: coarse)').matches)) await solo.tap();
  else await solo.click();
  return frame;
}

const position = frame => surface(frame).evaluate(() => window.readPetverseMovement());
const height = frame => surface(frame).evaluate(() => window.readPetverseTraveler());
const pointerLocked = frame => surface(frame).evaluate(canvas => canvas.ownerDocument.pointerLockElement === canvas);
const fullscreen = frame => surface(frame).evaluate(canvas => canvas.ownerDocument.fullscreenElement?.id);
const readSave = frame => surface(frame).evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
const angularDifference = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

async function controlsTab(frame) {
  await menu(frame, 'Settings').press('Enter');
  await button(frame, 'Controls').press('Enter');
}

async function exitOverlay(frame) {
  await button(frame, 'Close menu').click();
  await expect(frame.locator('.pv-panel')).toBeHidden();
}

test('Shift Lock captures the real cursor, turns the traveler, and releases for overlays and Escape', async ({ page }) => {
  test.setTimeout(80_000);
  await page.setViewportSize({ width: 980, height: 748 });
  const frame = await launchPetverse(page, createProgress(), true);
  const hud = button(frame, 'Shift Lock');
  const crosshair = frame.locator('.pv-crosshair');
  const bounds = await surface(frame).boundingBox();
  const mouse = { x: bounds.x + bounds.width * .48, y: bounds.y + bounds.height * .46 };
  await page.mouse.move(mouse.x, mouse.y);
  await surface(frame).focus();
  await page.keyboard.press('Shift');
  await expect.poll(() => pointerLocked(frame)).toBe(true);
  await expect(crosshair).toBeVisible();
  await expect(hud).toHaveAttribute('aria-pressed', 'true');

  const before = await position(frame);
  await page.mouse.move(mouse.x + 27, mouse.y, { steps: 4 });
  await expect.poll(async () => angularDifference((await position(frame)).heading, before.heading)).toBeGreaterThan(.12);
  const start = await position(frame);
  await page.keyboard.down('d');
  try {
    await expect.poll(async () => {
      const current = await position(frame);
      return Math.hypot(current.x - start.x, current.z - start.z);
    }).toBeGreaterThan(.8);
    const end = await position(frame);
    const delta = [end.x - start.x, end.z - start.z];
    const facingDot = (delta[0] * Math.sin(start.heading) + delta[1] * Math.cos(start.heading)) / Math.hypot(...delta);
    expect(Math.abs(facingDot)).toBeLessThan(.33);
    expect(angularDifference(start.heading, end.heading)).toBeLessThan(.14);
  } finally {
    await page.keyboard.up('d');
  }

  await menu(frame, 'Pets').focus();
  await page.keyboard.press('Enter');
  await expect(frame.getByRole('heading', { name: 'Pet journal', exact: true })).toBeVisible();
  await expect.poll(() => pointerLocked(frame)).toBe(false);
  await expect(crosshair).toBeHidden();
  await exitOverlay(frame);
  await expect.poll(() => pointerLocked(frame)).toBe(false);

  await hud.click();
  await expect.poll(() => pointerLocked(frame)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => pointerLocked(frame)).toBe(false);
  await expect(hud).toHaveAttribute('aria-pressed', 'false');
});

test('custom camera controls persist and real fullscreen keeps the canvas when a menu releases pointer lock', async ({ page }) => {
  test.setTimeout(105_000);
  await page.setViewportSize({ width: 960, height: 760 });
  const frame = await launchPetverse(page);
  await controlsTab(frame);
  await frame.getByLabel('Shift Lock key', { exact: true }).selectOption('KeyQ');
  await frame.getByLabel('Sprint key', { exact: true }).selectOption('KeyX');
  await frame.getByLabel('Camera distance', { exact: true }).fill('65');
  await button(frame, 'Graphics').press('Enter');
  const low = await surface(frame).evaluate(canvas => ({
    pixels: canvas.width, distance: Number(canvas.dataset.drawDistance), shadows: Number(canvas.dataset.shadowResolution)
  }));
  await frame.getByLabel('Graphics quality', { exact: true }).selectOption('ultra');
  await frame.getByLabel('Render resolution', { exact: true }).fill('40');
  await expect.poll(() => surface(frame).evaluate(canvas => canvas.width)).toBeGreaterThan(low.pixels);
  await expect.poll(() => surface(frame).evaluate(canvas => Number(canvas.dataset.drawDistance))).toBeGreaterThan(low.distance);
  await expect.poll(() => surface(frame).evaluate(canvas => Number(canvas.dataset.shadowResolution))).toBeGreaterThan(low.shadows);
  await frame.getByRole('checkbox', { name: 'Bloom', exact: true }).check();
  await frame.getByRole('checkbox', { name: 'Anti-aliasing', exact: true }).check();
  await expect(surface(frame)).toHaveAttribute('data-anti-aliasing', 'true');
  await frame.getByRole('checkbox', { name: 'Anti-aliasing', exact: true }).uncheck();
  await expect(surface(frame)).toHaveAttribute('data-bloom', 'true');
  await expect(surface(frame)).toHaveAttribute('data-anti-aliasing', 'false');

  await page.reload();
  await expect(surface(frame)).toBeVisible({ timeout: 25_000 });
  await controlsTab(frame);
  await expect(frame.getByLabel('Shift Lock key', { exact: true })).toHaveValue('KeyQ');
  await expect(frame.getByLabel('Sprint key', { exact: true })).toHaveValue('KeyX');
  await expect(frame.getByLabel('Camera distance', { exact: true })).toHaveValue('65');
  await button(frame, 'Graphics').press('Enter');
  await expect(frame.getByLabel('Graphics quality', { exact: true })).toHaveValue('ultra');
  await expect(frame.getByLabel('Render resolution', { exact: true })).toHaveValue('40');
  await expect(frame.getByRole('checkbox', { name: 'Bloom', exact: true })).toBeChecked();
  await expect(frame.getByRole('checkbox', { name: 'Anti-aliasing', exact: true })).not.toBeChecked();
  // Keep the subsequent fullscreen check light on software-rendered CI browsers.
  await frame.getByRole('checkbox', { name: 'Bloom', exact: true }).uncheck();
  await frame.getByLabel('Graphics quality', { exact: true }).selectOption('low');
  await exitOverlay(frame);

  await button(frame, 'Fullscreen').click();
  await expect.poll(() => fullscreen(frame)).toBe('petverse');
  const fullBounds = await surface(frame).boundingBox();
  await surface(frame).focus();
  await page.keyboard.press('Shift');
  await expect.poll(() => pointerLocked(frame)).toBe(false);
  await page.keyboard.press('q');
  await expect.poll(() => pointerLocked(frame)).toBe(true);
  await menu(frame, 'Hatch').focus();
  await page.keyboard.press('Enter');
  await expect(frame.getByRole('heading', { name: 'Egg nursery', exact: true })).toBeVisible();
  await expect.poll(() => pointerLocked(frame)).toBe(false);
  await expect.poll(() => fullscreen(frame)).toBe('petverse');
  const menuBounds = await surface(frame).boundingBox();
  expect(menuBounds.width).toBeCloseTo(fullBounds.width, 0);
  expect(menuBounds.height).toBeCloseTo(fullBounds.height, 0);
  await button(frame, 'Exit fullscreen').click();
  await expect.poll(() => fullscreen(frame)).toBeUndefined();
});

async function distanceInTime(page, frame, sprint = false) {
  await surface(frame).focus();
  if (sprint) await page.keyboard.down('r');
  await page.keyboard.down('w');
  try {
    return await surface(frame).evaluate(canvas => new Promise(resolve => {
      const from = window.readPetverseMovement();
      const deadline = performance.now() + 350;
      const during = () => {
        if (performance.now() < deadline) return requestAnimationFrame(during);
        const current = window.readPetverseMovement();
        resolve({ distance: Math.hypot(current.x - from.x, current.z - from.z), gait: canvas.dataset.playerMotion });
      };
      requestAnimationFrame(during);
    }));
  } finally {
    await page.keyboard.up('w');
    if (sprint) await page.keyboard.up('r');
  }
}

test('the player jumps and lands, and holding the sprint key crosses more ground', async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 980, height: 748 });
  const frame = await launchPetverse(page, createProgress(), 'jump');
  await surface(frame).focus();
  const floor = await height(frame);
  await page.keyboard.press('Space');
  await expect.poll(() => height(frame), { intervals: [30, 45, 70] }).toBeGreaterThan(floor + .45);
  await expect.poll(async () => Math.abs(await height(frame) - floor)).toBeLessThan(.09);
  const walking = await distanceInTime(page, frame);
  expect(walking.gait).toBe('walk');
  expect(walking.distance).toBeGreaterThan(1.25);

  await page.reload();
  await expect(surface(frame)).toBeVisible({ timeout: 25_000 });
  await button(frame, 'Play Solo').click();
  const sprinting = await distanceInTime(page, frame, true);
  expect(sprinting.gait).toBe('sprint');
  expect(sprinting.distance).toBeGreaterThan(walking.distance * 1.1);
});

test('equipped pets have real rendered portraits and can be unequipped without leaving the collection', async ({ page }) => {
  test.setTimeout(80_000);
  await page.setViewportSize({ width: 950, height: 790 });
  const start = createProgress();
  start.xp = 120;
  start.wallet.sunbeams = 200;
  const frame = await launchPetverse(page, start);
  await menu(frame, 'Hatch').click();
  await button(frame, 'Hatch Sunmeadow Egg').click();
  await expect.poll(async () => (await readSave(frame)).inventory.length).toBe(2);
  await menu(frame, 'Upgrades').click();
  await button(frame, 'Buy Team size').click();
  await expect.poll(async () => (await readSave(frame)).upgrades.teamSize).toBe(1);
  await menu(frame, 'Pets').click();
  await button(frame, 'Equip best').click();
  await expect.poll(async () => (await readSave(frame)).equipped.length).toBe(2);
  await expect(frame.getByRole('heading', { name: 'Equipped team', exact: true })).toBeVisible();
  await expect(frame.getByText('Locked slot 4', { exact: true })).toBeVisible();

  const team = frame.getByRole('region', { name: 'Equipped team' });
  const portrait = team.locator('.pv-pet-symbol[data-model-preview="ready"] img.pv-pet-render').first();
  await expect(portrait).toBeVisible({ timeout: 12_000 });
  const rendered = await portrait.evaluate(img => {
    const sample = document.createElement('canvas');
    sample.width = img.naturalWidth;
    sample.height = img.naturalHeight;
    const ctx = sample.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 192) colors.add([pixels[i], pixels[i + 1], pixels[i + 2]].join(','));
    }
    return { width: img.naturalWidth, colors: colors.size, source: img.src.slice(0, 22) };
  });
  expect(rendered.width).toBe(112);
  expect(rendered.colors).toBeGreaterThan(24);
  expect(rendered.source).toMatch(/^data:image\/png/);

  const before = await readSave(frame);
  await button(frame, 'Unequip all').click();
  await expect.poll(async () => (await readSave(frame)).equipped.length).toBe(0);
  expect((await readSave(frame)).inventory.map(pet => pet.id)).toEqual(before.inventory.map(pet => pet.id));
  await page.reload();
  await expect(surface(frame)).toBeVisible({ timeout: 25_000 });
  await menu(frame, 'Pets').click();
  await expect(frame.getByText(/0\s*\/\s*3 equipped/)).toBeVisible();
  expect((await readSave(frame)).equipped).toEqual([]);
});

test.describe('touch controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 860 } });

  test('a real held touch moves the player within the mobile viewport', async ({ page }) => {
    test.setTimeout(65_000);
    const frame = await launchPetverse(page, createProgress(), true);
    const forward = button(frame, 'Move forward');
    await expect(forward).toBeVisible();
    await forward.scrollIntoViewIfNeeded();
    const start = await position(frame);
    const bounds = await forward.boundingBox();
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    ] });
    try {
      await expect(forward).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => {
        const current = await position(frame);
        return Math.hypot(current.x - start.x, current.z - start.z);
      }).toBeGreaterThan(.55);
    } finally {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    }
    await expect(forward).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => pointerLocked(frame)).toBe(false);
    expect(await surface(frame).evaluate(canvas => canvas.ownerDocument.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
});
