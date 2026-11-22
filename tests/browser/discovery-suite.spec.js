import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('6.0 Home loads discovery tools on demand and supports the mobile navigation drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/#home');
  await expect(page.getByRole('heading', { level: 1, name: 'Pocket Circuit' })).toBeVisible();
  expect(requests.filter(path => /\/(shorts|shopping|community)\.(js|css)$/.test(path))).toEqual([]);
  const shortcuts = page.getByRole('navigation', { name: 'Browse the arcade' });
  await shortcuts.getByRole('link', { name: /^Short Videos/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shorts', exact: true })).toBeVisible();
  expect(requests).toContain('/assets/shorts.css');
  const drawer = page.getByRole('button', { name: 'Open navigation' });
  await drawer.click();
  await page.getByRole('navigation', { name: 'Arcade navigation' }).getByRole('link', { name: 'Community' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Community' })).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('universal search links real provider posts, product searches, and a Blip draft', async ({ page }) => {
  const retailerRequests = [];
  page.on('request', request => {
    if (/\.(amazon|ebay)\.com$/.test(new URL(request.url()).hostname)) retailerRequests.push(request.url());
  });
  await page.goto('/#discover?type=videos&format=tiktok&q=NASA');
  const result = page.locator('.discovery-card').getByRole('heading', { name: /Drop your questions below/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/#shorts\?source=tiktok&video=tiktok-7667244788046892319/);
  await expect(page.getByRole('link', { name: 'Open on TikTok', exact: true }).first())
    .toHaveAttribute('href', 'https://www.tiktok.com/@nasa/video/7667244788046892319');

  const search = page.getByRole('searchbox', { name: 'Search the arcade' });
  await search.fill('wireless controller');
  await search.press('Enter');
  await expect(page).toHaveURL(/#discover\?q=wireless\+controller/);
  await page.getByRole('link', { name: 'Search Shopping', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search shopping', exact: true })).toHaveValue('wireless controller');
  await expect(page.getByRole('link', { name: /Amazon/ }).first()).toHaveAttribute('href', /https:\/\/www\.amazon\.com\/s\?/);
  expect(retailerRequests).toEqual([]);

  await page.goto('/#discover?q=How+do+I+make+a+platformer');
  await page.getByRole('link', { name: 'Ask Blip', exact: true }).click();
  await expect(page.locator('#blip-prompt')).toHaveValue('How do I make a platformer');
});

test('the dashboard opens and manages real Proxy Gemini bookmarks', async ({ page }) => {
  await page.route('https://example.com/demo', route => route.fulfill({ contentType: 'text/html', body: '<h1>Example page</h1>' }));
  await page.goto('/#browse?address=https%3A%2F%2Fexample.com%2Fdemo');
  await page.getByRole('button', { name: 'Save current page to favorites' }).click();
  await page.goto('/#library');
  const favorites = page.locator('.section-block').filter({ has: page.getByRole('heading', { name: 'Proxy Gemini bookmarks' }) });
  await expect(favorites.getByRole('link', { name: 'example.com' })).toHaveAttribute('href', '#browse?address=https%3A%2F%2Fexample.com%2Fdemo');
  await favorites.getByRole('link', { name: 'Manage bookmarks' }).click();
  const manager = page.getByRole('dialog', { name: 'Favorite pages' });
  await expect(manager).toBeVisible();
  await expect(manager.getByRole('searchbox', { name: 'Search saved pages' })).toBeVisible();
});

test('Web Search hands off product searches and Settings clears shopping history while keeping saved queries', async ({ page }) => {
  await page.goto('/#web-search?q=wireless+controller');
  const results = page.getByRole('group', { name: 'Result category' });
  await results.getByRole('button', { name: 'Shopping', exact: true }).click();
  await page.getByRole('link', { name: 'Continue in Shopping' }).click();
  const form = page.getByRole('search', { name: 'Shopping' });
  await expect(form.getByRole('searchbox')).toHaveValue('wireless controller');
  await form.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  const persisted = () => page.evaluate(() => JSON.parse(localStorage.getItem('gamefor-ffun-shopping-v1')));
  expect((await persisted()).saved).toHaveLength(1);
  expect((await persisted()).recent).toHaveLength(1);

  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Clear search histories', exact: true }).click();
  await expect(page.locator('#announcement')).toHaveText('Web, library, and shopping search histories cleared.');
  expect((await persisted()).saved).toHaveLength(1);
  expect((await persisted()).recent).toEqual([]);
});
