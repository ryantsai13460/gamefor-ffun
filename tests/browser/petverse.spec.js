import { expect, test } from '@playwright/test';
import { createProgress } from '../../assets/petverse/model.js';

const gameRoute = '/#play/petverse-online?start=1';
const gameFrame = page => page.frameLocator('iframe[title="Petverse Online"]');
const canvas = frame => frame.locator('canvas[aria-label="Petverse 3D Meadow"]');

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('Petverse launches through the arcade, moves in 3D, gathers, hatches and restores the pet journal', async ({ page }) => {
  await page.goto(gameRoute);
  const frame = gameFrame(page);
  await expect(frame.getByRole('heading', { name: 'Petverse Online' })).toBeVisible();
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 15_000 });
  await expect(canvas(frame)).toBeVisible();
  const interact = frame.locator('.pv-interact');
  await expect(interact).toBeDisabled();
  await canvas(frame).focus();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  try {
    await expect(interact).toHaveText('Gather Pathbloom', { timeout: 6000 });
  } finally {
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
  }
  await interact.click();
  await expect(frame.locator('.pv-banner')).toHaveText(/Collected \d+ Sunbeams/);
  const earned = frame.locator('[data-currency="sunbeams"] strong');
  const beforeHatch = Number(await earned.textContent());
  expect(beforeHatch).toBeGreaterThan(40);
  await frame.getByRole('button', { name: 'Hatch Sunmeadow Egg', exact: true }).click();
  await expect(earned).toHaveText(String(beforeHatch - 18));
  await frame.getByRole('button', { name: 'Pets', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Pet journal' })).toBeVisible();
  await expect(frame.locator('.pv-pet-card')).toHaveCount(2);
  await frame.getByRole('button', { name: 'Favorite Twigpup', exact: true }).first().click();
  await expect(frame.getByRole('button', { name: 'Favorite Twigpup', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await frame.getByRole('button', { name: 'Pets', exact: true }).click();
  await expect(frame.locator('.pv-pet-card')).toHaveCount(2);
  await expect(frame.getByRole('button', { name: 'Favorite Twigpup', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(earned).toHaveText(String(beforeHatch - 18));
  await page.goto('/#browse?address=arcade%3Apetverse-online');
  await expect(page.locator('.proxy-frame[title="Petverse Online"]')).toBeVisible();
  await expect(frame.locator('.pv-world-message')).toBeHidden({ timeout: 15_000 });
  await expect(canvas(frame)).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test('Stop When Shiny is independent of notification preferences and auto-hatch never resumes on reload', async ({ page }) => {
  const save = createProgress();
  save.xp = 74;
  save.wallet.sunbeams = 156;
  await page.addInitScript(seed => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    Math.random = () => .94;
    if (!localStorage.getItem('ffun-petverse-solo-v1')) localStorage.setItem('ffun-petverse-solo-v1', JSON.stringify(seed));
  }, save);
  await page.goto(gameRoute);
  const frame = gameFrame(page);
  await frame.getByRole('button', { name: 'Upgrades', exact: true }).click();
  await frame.getByRole('button', { name: 'Buy Auto Hatch', exact: true }).click();
  await expect(frame.locator('[data-currency="sunbeams"] strong')).toHaveText('120');
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.getByRole('button', { name: 'Stop rules', exact: true }).click();
  await frame.getByRole('checkbox', { name: /Stop When Shiny/ }).uncheck();
  await frame.getByRole('button', { name: 'Notifications', exact: true }).click();
  await frame.getByRole('checkbox', { name: 'Shiny notifications' }).uncheck();
  await frame.getByRole('button', { name: 'Hatch', exact: true }).click();
  await frame.getByRole('button', { name: 'Auto hatch Sunmeadow Egg', exact: true }).click();
  const session = frame.locator('.pv-auto-status');
  await expect(session).toContainText('2 hatched', { timeout: 12_000 });
  await frame.getByRole('button', { name: 'Pause auto hatch' }).click();
  await expect(session).toContainText('Paused');
  await frame.getByRole('button', { name: 'Edit stop rules' }).click();
  await frame.getByRole('checkbox', { name: /Stop When Shiny/ }).check();
  await frame.getByRole('button', { name: 'Resume auto hatch' }).click();
  await frame.getByRole('button', { name: 'Hatch', exact: true }).click();
  await expect(session).toContainText('Stopped · Shiny hatched', { timeout: 12_000 });
  const balance = await frame.locator('[data-currency="sunbeams"] strong').textContent();
  await page.reload();
  await expect(frame.getByRole('heading', { name: 'Egg nursery' })).toBeVisible();
  await expect(session).toHaveCount(0);
  await expect(frame.locator('[data-currency="sunbeams"] strong')).toHaveText(balance);
});

test('Petverse graphics and audio preferences persist, and the 3D player fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  await page.goto(gameRoute);
  const frame = gameFrame(page);
  await expect(canvas(frame)).toHaveAttribute('data-render-quality', 'medium', { timeout: 15_000 });
  const initialPixels = Number(await canvas(frame).getAttribute('width'));
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.getByRole('button', { name: 'Graphics', exact: true }).click();
  await frame.getByLabel('Graphics quality').selectOption('low');
  await expect(canvas(frame)).toHaveAttribute('data-render-quality', 'low');
  expect(Number(await canvas(frame).getAttribute('width'))).toBeLessThan(initialPixels);
  await frame.getByRole('button', { name: 'Audio', exact: true }).click();
  await frame.getByRole('checkbox', { name: 'Music', exact: true }).uncheck();
  await page.reload();
  await expect(canvas(frame)).toHaveAttribute('data-render-quality', 'low');
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(frame.getByRole('checkbox', { name: 'Music', exact: true })).not.toBeChecked();
  expect(await canvas(frame).evaluate(element => element.ownerDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
