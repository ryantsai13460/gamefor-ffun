import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('Home loads route styles on demand and supports the mobile navigation drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/#home');
  await expect(page.getByRole('heading', { level: 1, name: 'Pocket Circuit' })).toBeVisible();
  expect(requests.filter(path => /\/(shorts|shopping|community)\.(js|css)$/.test(path))).toEqual([]);
  expect(requests.filter(path => /\/(blip|films|browser|lyrics-library|music-library|play-hub|assistant-panel)\.css$/.test(path))).toEqual([]);
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
  await drawer.click();
  await page.getByRole('navigation', { name: 'Arcade navigation' }).getByRole('link', { name: 'Web Search', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Web Search' })).toBeVisible();
  expect(requests).toContain('/assets/browser.css');
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
  await expect(page.getByRole('link', { name: 'Open Amazon results', exact: true })).toHaveAttribute('href', /https:\/\/www\.amazon\.com\/s\?/);
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

test('universal search groups exact products and named bookmarks without opening their original sites', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  const original = 'https://example.com/private/controller-notes';
  const title = 'Ultimate 2C Wireless Controller';
  const requests = [];
  page.on('request', request => {
    if (/example\.com|amazon\.com/.test(new URL(request.url()).hostname)) requests.push(request.url());
  });
  await page.goto('/#browse?address=' + encodeURIComponent(original));
  await page.getByRole('button', { name: 'Save current page to favorites' }).click();
  await page.goto('/#browse?panel=favorites');
  await page.getByRole('button', { name: 'Rename example.com', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Bookmark name' });
  await name.fill(title);
  await name.press('Enter');
  const beforeSearch = requests.length;

  const discoverRoute = '/#discover?' + new URLSearchParams({ q: title });
  await page.goto(discoverRoute);
  const products = page.getByRole('region', { name: 'Products', exact: true });
  const bookmarks = page.getByRole('region', { name: 'Bookmarks', exact: true });
  const product = products.getByRole('link');
  const bookmark = bookmarks.getByRole('link');
  await expect(product).toHaveAttribute('href', '#shopping?retailer=amazon&product=B0D736BCNM');
  await expect(bookmark).toHaveAttribute('href', '#browse?address=' + encodeURIComponent(original));
  await expect(product.getByText('Exact match')).toBeVisible();
  await expect(bookmark.getByText('Exact match')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  const filters = page.getByRole('group', { name: 'Content type' });
  await filters.getByRole('button', { name: 'Bookmarks' }).click();
  await expect(page.locator('.discovery-card')).toHaveCount(1);
  const input = page.getByRole('searchbox', { name: 'Library query' });
  await input.fill(original);
  await input.press('Enter');
  await expect(page.locator('.discovery-card')).toContainText('Exact match');
  await expect(page.getByRole('link', { name: 'Open in Proxy Gemini' })).toHaveAttribute('href', '#browse?address=' + encodeURIComponent(original));
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('ffun.discovery.history')));
  expect(history).toEqual([title]);
  expect(requests).toHaveLength(beforeSearch);

  await page.goto('/#web-search?' + new URLSearchParams({ q: title }));
  const categories = page.getByRole('group', { name: 'Result category' });
  await categories.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('link', { name: `8BitDo ${title}`, exact: true })).toBeVisible();
  await categories.getByRole('button', { name: 'Bookmarks', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toHaveAttribute('href', '#browse?address=' + encodeURIComponent(original));

  const first = await page.evaluate(async address => {
    const key = 'gamefor-ffun-proxy-v1';
    const data = JSON.parse(localStorage.getItem(key));
    data.favorites.unshift(...Array.from({ length: 7 }, (_, index) => `${address}/${index}`));
    localStorage.setItem(key, JSON.stringify(data));
    const { searchBookmarks } = await import('./assets/search-catalog.js');
    return (await searchBookmarks(address))[0].address;
  }, original);
  expect(first).toBe(original);

  const outgoing = [];
  page.on('request', request => {
    if (request.url().startsWith('https:')) outgoing.push(request.url());
  });
  const webInput = page.getByRole('combobox', { name: 'Search the web' });
  await webInput.fill(`${original}?token=private_test_value`);
  await webInput.press('Enter');
  await expect(page).toHaveURL(/#discover\?.*&type=bookmarks$/);
  await expect(page.locator('.discovery-status')).toHaveText('No matching titles');
  expect(outgoing.every(url => !url.includes('private_test_value'))).toBe(true);
});

test('loading another result page moves keyboard focus to a newly displayed card', async ({ page }) => {
  await page.goto('/#discover?q=racing');
  await expect(page.locator('.discovery-status')).toHaveText(/^Showing 24 of \d+ results$/);
  const seen = await page.locator('.discovery-card').evaluateAll(cards => cards.map(card => card.getAttribute('href')));
  await page.getByRole('button', { name: 'Load more results', exact: true }).press('Enter');
  await expect(page.locator('.discovery-status')).toHaveText(/^Showing 48 of \d+ results$/);
  const target = page.locator('.discovery-card:focus');
  await expect(target).toBeVisible();
  expect(seen).not.toContain(await target.getAttribute('href'));
});
