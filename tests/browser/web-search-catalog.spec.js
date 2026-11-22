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

test('Web Search keeps a first-party guide available when the external lookup fails', async ({ page }) => {
  await page.goto('/#web-search');
  await search(page, 'Why is the sky blue?');
  await expect(page.getByRole('heading', { name: 'Results for “Why is the sky blue?”', exact: true })).toBeVisible();
  const references = panel(page, 'Wiki and references');
  await expect(references.getByText('NASA Space Place', { exact: true })).toBeVisible();
  await references.getByRole('button', { name: 'Why Is the Sky Blue?', exact: true }).click();
  const result = page.getByRole('dialog', { name: 'Why Is the Sky Blue?', exact: true });
  const source = result.getByRole('link', { name: 'Open original source' });
  await expect(source).toHaveAttribute('href', 'https://spaceplace.nasa.gov/blue-sky/en/');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(result.locator('iframe')).toHaveCount(0);
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
  for (const address of ['https://youtu.be/dQw4w9WgXcQ?share=example', 'youtu.be/dQw4w9WgXcQ?share=example']) {
    await search(page, address);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Clear web search', exact: true }).click();
    await expect(history.getByRole('button', { name: /youtu\.be/ })).toHaveCount(0);
  }
  const storedQueries = await page.evaluate(() => JSON.parse(localStorage.getItem('ffun.web-search.history')));
  expect(storedQueries).toEqual(['MrBeast']);
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

test('Search history can be paused and cleared for both Web and library searches', async ({ page }) => {
  await page.goto('/#web-search');
  await search(page, 'violin music');
  await page.goto('/#discover');
  const query = page.getByRole('searchbox', { name: 'Library query' });
  await query.fill('classical music');
  await query.press('Enter');
  const history = () => page.evaluate(() => ['ffun.web-search.history', 'ffun.discovery.history']
    .map(key => JSON.parse(localStorage.getItem(key))));
  expect(await history()).toEqual([['violin music'], ['classical music']]);

  await page.goto('/#settings');
  await page.getByRole('checkbox', { name: 'Remember searches' }).uncheck();
  await page.goto('/#web-search');
  await expect(page.getByRole('region', { name: 'Try a search' })).toBeVisible();
  await search(page, 'science lessons');
  await page.goto('/#discover');
  await query.fill('strategy games');
  await query.press('Enter');
  expect(await history()).toEqual([['violin music'], ['classical music']]);

  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Clear search histories' }).click();
  expect(await history()).toEqual([null, null]);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Remember searches' })).not.toBeChecked();
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

test('connected Web Search retries a failed provider and passes deduplicated source context to Blip', async ({ page }) => {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  const source = 'https://developer.mozilla.org/en-US/docs/Web/HTML';
  const offsets = [];
  await page.route('https://gateway.example/api/search', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const { offset = 0 } = route.request().postDataJSON();
    offsets.push(offset);
    if (offsets.length === 1) return route.fulfill({ status: 503, headers, json: { error: 'Search fixture temporarily unavailable.' } });
    if (offset === 1) return route.fulfill({ headers, json: { results: [
      { title: 'Duplicate from second page', description: 'The same page.', url: source },
      { title: 'Learn web development', description: 'Build your first website.', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' }
    ] } });
    return route.fulfill({ headers, json: { results: [
      { title: 'HTML reference', description: 'Publisher reference for HTML.', url: source },
      { title: 'Duplicate URL', description: 'The same page.', url: source },
      { title: 'Play on Coolmath', description: 'Portal game.', url: 'https://www.coolmathgames.com/0-unlisted-fixture-game' },
      { title: 'Retro Bowl publisher', description: 'External catalog source.', url: 'https://poki.com/en/g/retro-bowl' }
    ], nextOffset: 1 } });
  });
  await page.goto('/#web-search');
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await search(page, 'learn html');
  await category(page).getByRole('button', { name: 'Web', exact: true }).click();
  const web = panel(page, 'Web results');
  await web.getByRole('button', { name: 'Retry web results' }).click();
  await expect(web.getByRole('listitem')).toHaveCount(3);
  await expect(web.getByRole('link', { name: 'HTML reference', exact: true })).toHaveAttribute('href', source);
  await expect(web.getByRole('link', { name: source, exact: true })).toHaveAttribute('href', source);
  await expect(web.locator('a[href*="coolmathgames.com"], a[href*="poki.com"]')).toHaveCount(0);
  await expect(web.getByRole('link', { name: 'Browse in-page games' })).toHaveAttribute('href', '#games?option=in-page');
  await expect(web.getByRole('link', { name: 'View game in the arcade' })).toHaveAttribute('href', '#play/retrobowl');
  const more = web.getByRole('button', { name: 'Load more web results' });
  await expect(more).toBeVisible();
  expect(offsets).toEqual([0, 0]);
  await more.click();
  await expect(web.getByRole('listitem')).toHaveCount(4);
  await expect(more).toHaveCount(0);
  await web.getByRole('listitem').filter({ hasText: 'HTML reference' }).getByRole('link', { name: 'Ask Blip', exact: true }).click();
  await expect(page.locator('#blip-prompt')).toHaveValue(`Help me understand this search result and clarify what the source supports.\n\nHTML reference\nPublisher reference for HTML.\n${source}`);
  await expect(page.getByLabel('Web lookup phrase')).toHaveValue('learn html');
  expect(offsets).toEqual([0, 0, 1]);
});
