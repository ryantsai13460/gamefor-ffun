import { expect, test } from '@playwright/test';
import { games } from '../../assets/catalog.js';

const origin = 'http://127.0.0.1:4178';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503, body: 'Third-party requests are isolated in this test.' }));
});

async function go(page, label, heading = label) {
  await page.getByRole('navigation', { name: 'Arcade navigation' }).getByRole('link', { name: label, exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, level: 1, exact: true })).toBeVisible();
}

async function recordScreenshot(page, info, title) {
  if (process.env.ARCADE_QA_SCREENSHOTS) {
    await page.screenshot({ path: info.outputPath(`${title}.png`) });
  }
}

test('navigation, catalog pagination, filtering, favorites, play history and settings', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400) errors.push(response.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Random Game' })).toBeVisible();
  await expect(page.locator('.hero-art .art-image.is-ready')).toBeVisible();

  await go(page, 'All Games');
  await expect(page.locator('.library-results')).toHaveText('1–24 of 551 games');
  await expect(page.locator('.game-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.library-results')).toHaveText('25–48 of 551 games');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('.pagination-output')).toHaveText('Page 1 of 23');

  await go(page, 'Categories');
  await page.getByRole('link', { name: /^Puzzle \d+ games$/ }).click();
  await expect(page.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('Puzzle');
  await page.getByRole('combobox', { name: 'Play option' }).selectOption('local');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name');
  await expect(page.locator('.game-card').first()).toContainText('2048');
  const find = page.getByLabel('Search games', { exact: true });
  await find.fill('no game using this title');
  await expect(page.getByText('No matching games')).toBeVisible();
  await find.fill('2048');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add 2048 to favorites' }).click();
  await expect(page.getByRole('button', { name: 'Remove 2048 from favorites' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.card-link').click();
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(page.locator('.player-status')).toHaveText('Built-in game ready.');
  const local = page.getByRole('group', { name: '2048 controls' });
  await expect(local).toBeVisible();
  await local.press('ArrowLeft');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(local).toBeVisible();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toContain('player-stage');
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole('link', { name: 'Back to browsing' }).click();
  await expect(find).toHaveValue('2048');
  await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('local');

  await go(page, 'Recently Played');
  await expect(page.locator('.game-card')).toContainText('2048');
  await go(page, 'Trending');
  await expect(page.locator('.game-card')).toContainText('2048');
  await go(page, 'Favorites');
  await expect(page.locator('.game-card')).toContainText('2048');
  await page.reload();
  await expect(page.locator('.game-card')).toContainText('2048');
  await go(page, 'New Games');
  await expect(page.locator('.game-card').first()).toBeVisible();
  await go(page, 'Built-in Games');
  await expect(page.locator('.game-card')).toHaveCount(13);

  const global = page.getByRole('searchbox', { name: 'Search the arcade' });
  await global.fill('slither.io');
  await global.press('Enter');
  const slither = page.locator('.game-card').filter({ has: page.getByRole('heading', { name: 'Slither.io', exact: true }) });
  await expect(slither).toHaveCount(1);
  await expect(slither.locator('.has-no-art')).toBeVisible();
  await global.fill('resent client');
  await global.press('Enter');
  await page.getByRole('link', { name: /^Resent Client/ }).click();
  await expect(page.getByText('Play link unavailable')).toBeVisible();
  await expect(page.getByRole('link', { name: /Minecraft Classic/i })).toBeVisible();

  await page.getByRole('button', { name: 'Random Game' }).click();
  await expect(page.getByRole('button', { name: 'Play game', exact: true })).toBeVisible();
  await go(page, 'Settings');
  await page.getByLabel('Compact game cards').check();
  await expect(page.locator('body')).toHaveClass(/compact/);
  await page.getByRole('button', { name: 'Clear saved games' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear saved games' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear saved games' }).click();
  await go(page, 'Favorites');
  await expect(page.getByText('No favorites yet')).toBeVisible();
  await go(page, 'Credits');
  await expect(page.getByText(/548 recovered from the main libraries/)).toBeVisible();
  await go(page, 'Home', 'Pocket Circuit');
  expect(errors).toEqual([]);
});

test('standalone game and Proxy Gemini tabs, history and website previews', async ({ page }) => {
  await page.route('https://wikipedia.org/', route => route.fulfill({
    contentType: 'text/html',
    body: '<h1>Wikipedia preview</h1><a href="/next">Read more</a>'
  }));
  await page.route('https://wikipedia.org/next', route => route.fulfill({
    contentType: 'text/html',
    body: '<h1>Next page inside the preview</h1>'
  }));
  await page.goto('/#play/catch-the-star');
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  const game = page.frameLocator('.player-stage iframe');
  await game.locator('#star').click();
  await expect(game.locator('#score')).toContainText('1');
  await go(page, 'Proxy Gemini');
  await page.getByRole('button', { name: 'Open Catch the Star', exact: true }).click();
  const frame = page.frameLocator('.proxy-stage iframe');
  await frame.locator('#star').click();
  await expect(frame.locator('#score')).toContainText('1');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(frame.locator('#score')).toContainText('0');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Start browsing', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(frame.locator('#star')).toBeVisible();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toContain('proxy-');
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  const address = page.locator('.proxy-toolbar input');
  await address.fill('wikipedia.org');
  await address.press('Enter');
  await expect(frame.getByRole('heading', { name: 'Wikipedia preview' })).toBeVisible();
  await expect(page.locator('.proxy-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await frame.getByRole('link', { name: 'Read more' }).click();
  await expect(frame.getByRole('heading', { name: 'Next page inside the preview' })).toBeVisible();
  const source = page.getByRole('link', { name: 'Open in new tab', exact: true });
  await expect(source).toHaveAttribute('href', 'https://wikipedia.org/');
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(page).toHaveURL(/#browse$/);
  expect(page.context().pages()).toHaveLength(1);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await go(page, 'Home', 'Pocket Circuit');
  await go(page, 'Proxy Gemini');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page.getByRole('button', { name: 'Close wikipedia.org tab' }).click();
  await expect(frame.locator('#star')).toBeVisible();
});

test('Proxy Gemini respects frame blocking and keeps links and search explicit', async ({ page }) => {
  await page.route('https://example.com/blocked', route => route.fulfill({
    contentType: 'text/html',
    headers: { 'Content-Security-Policy': "frame-ancestors 'none'" },
    body: '<h1>Restricted preview content</h1>'
  }));
  await page.goto('/#browse');
  await expect(page.locator('.proxy-playable-group').nth(0).getByRole('button')).toHaveCount(13);
  await expect(page.locator('.proxy-playable-group').nth(1).getByRole('button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Play 2048', exact: true }).click();
  await expect(page.getByRole('group', { name: '2048 controls' })).toBeVisible();
  await expect(page).toHaveURL(/#browse$/);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('group', { name: '2048 controls' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Snow Rider 3D', exact: true }).click();
  await expect(page.locator('.proxy-frame')).toHaveAttribute('src', 'https://www.miniplay.com/embed/snow-rider-3d');
  const address = page.getByRole('textbox', { name: 'Address or search query' });
  await address.fill('https://example.com/blocked');
  await address.press('Enter');
  await expect(page.getByText(/the site may block embedding/)).toBeVisible();
  await expect(page.frameLocator('.proxy-frame').getByRole('heading', { name: 'Restricted preview content' })).not.toBeVisible();
  await expect(page).toHaveURL(/#browse$/);

  await address.fill('https://proxy-arcade-play.base44.app/browse');
  await address.press('Enter');
  await expect(page.getByText('Base44 blocks embedding this viewer.')).toBeVisible();
  await expect(page.locator('.proxy-frame')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Base44 in new tab' })).toHaveAttribute('target', '_blank');
  await address.fill('snow rider');
  await address.press('Enter');
  await expect(page.getByRole('link', { name: 'Search Google in new tab' })).toHaveAttribute('target', '_blank');
  await page.getByRole('link', { name: 'Search arcade games' }).click();
  await expect(page).toHaveURL(/#games\?q=snow\+rider$/);
  await expect(page.getByRole('heading', { name: 'Snow Rider 3D', exact: true }).first()).toBeVisible();
});

test('video and film search, official fallback, playback review, catalog report', async ({ page }) => {
  await page.goto('/');
  await go(page, 'YouTube', 'YouTube Shorts');
  await page.getByRole('searchbox', { name: 'Search titles, creators, or topics' }).fill('minecraft');
  await page.getByRole('button', { name: /^Watch / }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /YouTube/ }).first()).toHaveAttribute('href', /https:\/\/www\.youtube\.com\//);
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\//);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();

  await go(page, 'Movies');
  await page.getByRole('searchbox', { name: 'Search films' }).fill('sintel');
  await page.getByRole('button', { name: 'Watch trailer', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Official trailer', { exact: true })).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/HOfdboHvshg/);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Play full short', exact: true }).click();
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/eRsGyueVLvQ/);
  await dialog.getByRole('button', { name: 'Close' }).click();

  await go(page, 'Play Hub');
  await page.getByRole('button', { name: 'Playback checks', exact: true }).click();
  await page.getByRole('button', { name: 'Check catalog' }).click();
  const report = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  expect((await report).suggestedFilename()).toMatch(/\.json$/);
});

test('every built-in player mounts and publisher embeds retain a direct source', async ({ page }) => {
  await page.goto('/');
  for (const game of games.filter(({ local }) => local === true)) {
    await page.goto(`/#play/${game.id}`);
    await page.getByRole('button', { name: 'Play game', exact: true }).click();
    await expect(page.getByRole('group', { name: `${game.title} controls`, exact: true })).toBeVisible();
    const start = page.getByRole('button', { name: 'Start', exact: true });
    if (await start.isVisible()) {
      await start.click();
      await expect(page.locator('.player-stage canvas')).toBeVisible();
    }
  }
  for (const game of games.filter(({ embed }) => embed)) {
    await page.goto(`/#play/${game.id}`);
    await page.getByRole('button', { name: 'Play game', exact: true }).click();
    await expect(page.locator('.player-stage iframe')).toHaveAttribute('src', game.embed);
    await expect(page.getByRole('link', { name: 'Open game source' })).toHaveAttribute('href', game.url);
  }
});

test('layout and mobile menu fit desktop, tablet and phone widths', async ({ page }, info) => {
  await page.unroute('https://**/*');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await recordScreenshot(page, info, `home-${width}`);
    if (width === 390) {
      await expect(page.getByRole('navigation', { name: 'Arcade navigation' })).not.toBeVisible();
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await go(page, 'All Games');
      await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.game-grid')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    }
  }
});
