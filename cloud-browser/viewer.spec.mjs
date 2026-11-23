import { expect, test } from '@playwright/test';
import { createCloudBrowserServer } from './server.mjs';

const fixtureOrigin = 'https://fixture.example.com';
const accessCode = 'local-fixture-code-for-browser-tests';
const colors = { initial: [26, 45, 89], clicked: [155, 52, 83], typed: [24, 114, 86], scrolled: [153, 87, 30], retained: [161, 21, 21] };
const fixturePage = `<!doctype html>
  <title>Input playground</title>
  <style>
    body { margin: 0; min-height: 2600px; color: white; font: 22px system-ui; background: rgb(${colors.initial}); }
    main { position: fixed; top: 80px; left: 100px; display: grid; gap: 16px; width: 320px; }
    button, input { box-sizing: border-box; width: 320px; height: 70px; font: inherit; }
  </style>
  <main><button id="target">Change color</button><input id="field" placeholder="Type here" autocomplete="off">
  <a href="/next">Go to chapter two</a></main>
  <script>
    const paint = color => document.body.style.background = color;
    const target = document.getElementById('target');
    const field = document.getElementById('field');
    if (localStorage.getItem('fixture-visited')) paint('rgb(${colors.retained})');
    target.addEventListener('click', () => {
      localStorage.setItem('fixture-visited', 'true');
      paint('rgb(${colors.clicked})');
    });
    field.addEventListener('input', () => { if (field.value === 'arcade') paint('rgb(${colors.typed})'); });
    addEventListener('scroll', () => { if (scrollY > 20) paint('rgb(${colors.scrolled})'); });
  </script>`;

let backend;
let endpoint;

test.beforeAll(async ({}, worker) => {
  const fixtureRoute = body => ({ body, contentType: 'text/html; charset=utf-8' });
  backend = await createCloudBrowserServer({
    clientOrigins: [worker.project.use.baseURL],
    allowedOrigins: [fixtureOrigin],
    accessCode,
    chromiumPath: process.env.CLOUD_CHROMIUM_PATH || process.env.ARCADE_CHROMIUM,
    chromiumSandbox: false,
    searchUrl: `${fixtureOrigin}/find`,
    fixtureRoutes: new Map([
      [`${fixtureOrigin}/`, fixtureRoute(fixturePage)],
      [`${fixtureOrigin}/next`, fixtureRoute('<title>Chapter two</title><h1>Second document</h1>')],
      [`${fixtureOrigin}/find?q=solar+system`, fixtureRoute('<title>Search fixture</title><h1>Solar system</h1>')]
    ])
  });
  const origin = await backend.listen();
  endpoint = new URL('/v1/session', origin.replace(/^http:/, 'ws:')).href;
});

test.afterAll(async () => backend?.close());

const address = page => page.getByRole('textbox', { name: 'Address or search', exact: true });
const command = (page, name) => page.getByRole('button', { name, exact: true });
const display = page => page.locator('canvas[aria-label="Remote browser display"]');

async function connect(page, code = accessCode) {
  await page.getByLabel('Session endpoint', { exact: true }).fill(endpoint);
  await page.getByLabel('Access code', { exact: true }).fill(code);
  await command(page, 'Start session').click();
}

async function open(page, target) {
  await address(page).fill(target);
  await address(page).press('Enter');
}

async function expectFrame(page, color) {
  await expect.poll(() => display(page).evaluate((canvas, expected) => {
    const rgba = canvas.getContext('2d').getImageData(8, 8, 1, 1).data;
    return expected.every((channel, index) => Math.abs(channel - rgba[index]) < 13);
  }, color), { timeout: 12_000 }).toBe(true);
}

async function screenPoint(page, x, y) {
  const box = await display(page).boundingBox();
  return { x: box.x + x * box.width / 1280, y: box.y + y * box.height / 800 };
}

test('the arcade connects real Chromium, streams frames, and handles mouse, keyboard and scroll', async ({ page }, info) => {
  await page.goto('/#browse');
  await page.getByRole('link', { name: 'Open Cloud Browser' }).click();
  await expect(page).toHaveURL(/#cloud-browser$/);
  await connect(page);
  await expect(page.getByText('Session connected', { exact: true })).toBeVisible({ timeout: 15_000 });
  await open(page, fixtureOrigin);
  await expect(page.getByRole('tab', { name: 'Input playground' })).toHaveAttribute('aria-selected', 'true');
  await expectFrame(page, colors.initial);

  const button = await screenPoint(page, 220, 110);
  await page.mouse.click(button.x, button.y);
  await expectFrame(page, colors.clicked);
  const input = await screenPoint(page, 220, 203);
  await page.mouse.click(input.x, input.y);
  await page.keyboard.type('arcade');
  await expectFrame(page, colors.typed);
  await page.mouse.wheel(0, 300);
  await expectFrame(page, colors.scrolled);
  await page.keyboard.press('Alt+u');
  await expect(address(page)).toBeFocused();

  await command(page, 'Fullscreen').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  const fullscreenBox = await display(page).boundingBox();
  expect(fullscreenBox.width / fullscreenBox.height).toBeCloseTo(1280 / 800, 1);
  if (process.env.ARCADE_QA_SCREENSHOTS) await page.screenshot({ path: info.outputPath('cloud-fullscreen.png') });
  await command(page, 'Exit fullscreen').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);

  await page.getByRole('link', { name: 'Proxy Gemini', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Start browsing' })).toBeVisible();
});

test('the remote toolbar navigates, searches, manages tabs and denies a destination outside its policy', async ({ page }) => {
  await page.goto('/#cloud-browser');
  await connect(page);
  await expect(page.getByText('Session connected', { exact: true })).toBeVisible({ timeout: 15_000 });
  await open(page, fixtureOrigin);
  await expect(page.getByRole('tab', { name: 'Input playground' })).toBeVisible();
  await open(page, `${fixtureOrigin}/next`);
  await expect(page.getByRole('tab', { name: 'Chapter two' })).toHaveAttribute('aria-selected', 'true');
  await command(page, 'Bookmark this tab').click();
  await expect(command(page, 'Bookmark this tab')).toHaveAttribute('aria-pressed', 'true');
  await command(page, 'Back').click();
  await expect(address(page)).toHaveValue(`${fixtureOrigin}/`);
  await command(page, 'Forward').click();
  await expect(address(page)).toHaveValue(`${fixtureOrigin}/next`);
  await command(page, 'Reload').click();
  await expect(address(page)).toHaveValue(`${fixtureOrigin}/next`);

  await command(page, 'New remote tab').click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await open(page, 'solar system');
  await expect(page.getByRole('tab', { name: 'Search fixture' })).toHaveAttribute('aria-selected', 'true');
  await command(page, 'Session history').click();
  await expect(page.getByRole('heading', { name: 'Pages visited this session' })).toBeVisible();
  await open(page, 'https://unapproved.example.com/');
  await expect(page.getByRole('alert')).toContainText(/approved|allowed|permitted/i);
  await expect(page.getByRole('tab', { name: 'Search fixture' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Chapter two' }).click();
  await command(page, 'Home').click();
  await expect(address(page)).toHaveValue(/^(?:about:blank)?$/);
  await command(page, 'Bookmarks').click();
  await expect(page.getByRole('heading', { name: 'Bookmarks saved on this device' })).toBeVisible();
  await command(page, 'Open Chapter two').click();
  await expect(page.getByRole('tab', { name: 'Chapter two' })).toHaveAttribute('aria-selected', 'true');
  await command(page, 'End session').click();
  await expect(command(page, 'Start session')).toBeEnabled();
  expect(await page.evaluate(secret => JSON.stringify(localStorage).includes(secret), accessCode)).toBe(false);
});

test('a bad access code leaves the viewer disconnected', async ({ page }) => {
  await page.goto('/#cloud-browser');
  await connect(page, 'wrong-code');
  await expect(page.getByRole('alert')).toContainText(/access code|authorization/i);
  await expect(command(page, 'Start session')).toBeEnabled();
  await expect(display(page)).toBeHidden();
});

test.describe('touch layout', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 800 } });

  test('the remote viewer fits a narrow screen, forwards a touch tap, and clears site storage between sessions', async ({ page }, info) => {
    await page.goto('/#cloud-browser');
    await connect(page);
    await expect(page.getByText('Session connected', { exact: true })).toBeVisible({ timeout: 15_000 });
    await open(page, fixtureOrigin);
    await expectFrame(page, colors.initial);
    await display(page).scrollIntoViewIfNeeded();
    const button = await screenPoint(page, 220, 110);
    await page.touchscreen.tap(button.x, button.y);
    await expectFrame(page, colors.clicked);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  if (process.env.ARCADE_QA_SCREENSHOTS) await page.screenshot({ path: info.outputPath('cloud-touch.png') });

  await command(page, 'End session').click();
  await connect(page);
  await expect(page.getByText('Session connected', { exact: true })).toBeVisible({ timeout: 15_000 });
  await open(page, fixtureOrigin);
  await expectFrame(page, colors.initial);
  });
});
