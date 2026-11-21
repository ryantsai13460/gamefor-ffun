import { expect, test } from '@playwright/test';

const category = page => page.getByRole('group', { name: 'Result category' });
const panel = (page, name) => page.locator('.web-search-videos').filter({
  has: page.getByRole('heading', { name, exact: true })
});

async function search(page, query) {
  const input = page.getByRole('combobox', { name: 'Search the web' });
  await input.fill(query);
  await input.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('Web Search offers examples and keeps clearable recent queries across tabs', async ({ page }) => {
  await page.goto('/#web-search');
  const ideas = page.getByRole('region', { name: 'Try a search' });
  await ideas.getByRole('button', { name: 'MrBeast', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Search the web' });
  await expect(input).toHaveValue('MrBeast');
  await page.getByRole('button', { name: 'Clear web search', exact: true }).click();
  const history = page.getByRole('region', { name: 'Recent searches' });
  await expect(history.getByRole('button', { name: 'MrBeast', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New search tab' }).click();
  const tabs = page.getByRole('tablist', { name: 'Web Search tabs' });
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  await expect(tabs.getByRole('button', { name: /^Close/ })).toHaveCount(0);
  await expect(history.getByRole('button', { name: 'MrBeast', exact: true })).toBeVisible();
  await search(page, 'https://youtu.be/dQw4w9WgXcQ?share=example');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Clear web search', exact: true }).click();
  await expect(history.getByRole('button', { name: /youtu\.be/ })).toHaveCount(0);
  await tabs.getByRole('tab', { selected: true }).press('Delete');
  await expect(tabs.getByRole('tab')).toHaveCount(1);
  await expect(tabs.getByRole('tab', { selected: true })).toBeFocused();

  await page.reload();
  await expect(history.getByRole('button', { name: 'MrBeast', exact: true })).toBeVisible();
  await history.getByRole('button', { name: 'Clear search history' }).click();
  await expect(ideas).toBeVisible();
  await expect(input).toBeFocused();
  await page.reload();
  await expect(ideas).toBeVisible();
  await expect(history).toHaveCount(0);
});

test('Web Search opens matching tracks and complete films from the real catalogs', async ({ page }) => {
  await page.goto('/#web-search');
  await search(page, 'Radioactive Imagine Dragons');
  await category(page).getByRole('button', { name: 'Music', exact: true }).click();
  const music = panel(page, 'Music');
  await expect(music.getByRole('listitem')).toHaveCount(1);
  await expect(music.getByText('Imagine Dragons · Pop rock')).toBeVisible();
  await music.getByRole('link', { name: 'Radioactive', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play Radioactive', exact: true })).toBeVisible();

  await page.goto('/#web-search?q=Sintel');
  await category(page).getByRole('button', { name: 'Movies', exact: true }).click();
  const films = panel(page, 'Movies');
  await expect(films.getByRole('listitem')).toHaveCount(1);
  await expect(films.getByText('Full film · 2010 · Animation · Fantasy · Adventure')).toBeVisible();
  await films.getByRole('link', { name: 'Sintel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sintel', level: 1 })).toBeVisible();
});

test('Clear search ignores late catalog work and trailer results remain labeled', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const catalogPath = url => url.pathname === '/assets/search-catalog.js';
  await page.route(catalogPath, async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/#web-search');
  await search(page, 'Sintel');
  await category(page).getByRole('button', { name: 'Movies', exact: true }).click();
  await expect(page.getByText('Searching the film catalog…')).toBeVisible();
  await page.getByRole('button', { name: 'Clear web search' }).click();
  const loaded = page.waitForResponse(response => catalogPath(new URL(response.url())));
  finish();
  await loaded;
  await expect(category(page)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Search the web' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Sintel', exact: true })).toHaveCount(0);

  await search(page, 'A Minecraft Movie');
  await category(page).getByRole('button', { name: 'Movies', exact: true }).click();
  const films = panel(page, 'Movies');
  await expect(films.getByRole('link', { name: 'A Minecraft Movie', exact: true }).first()).toBeVisible();
  await expect(films.getByText(/^Official trailer · 2025/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await search(page, 'qqqnoactualfilmzz');
  await category(page).getByRole('button', { name: 'Movies', exact: true }).click();
  await expect(films.getByText('No films in the arcade catalog match this search.')).toBeVisible();
  await expect(films.getByRole('listitem')).toHaveCount(0);
});

test('connected Web Search deduplicates sources and passes their context to Blip', async ({ page }) => {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  const source = 'https://developer.mozilla.org/en-US/docs/Web/HTML';
  await page.route('https://gateway.example/api/search', route => route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers }) : route.fulfill({ headers, json: { results: [
      { title: 'HTML reference', description: 'Publisher reference for HTML.', url: source },
      { title: 'Duplicate URL', description: 'The same page.', url: source }
    ] } }));
  await page.goto('/#web-search');
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await search(page, 'learn html');
  await category(page).getByRole('button', { name: 'Web', exact: true }).click();
  const web = panel(page, 'Web results');
  await expect(web.getByRole('listitem')).toHaveCount(1);
  await expect(web.getByRole('link', { name: 'HTML reference', exact: true })).toHaveAttribute('href', source);
  await expect(web.getByRole('link', { name: source, exact: true })).toHaveAttribute('href', source);
  await web.getByRole('link', { name: 'Ask Blip', exact: true }).click();
  await expect(page.locator('#blip-prompt')).toHaveValue(`Help me understand this search result and clarify what the source supports.\n\nHTML reference\nPublisher reference for HTML.\n${source}`);
});
