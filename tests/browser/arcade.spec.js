import { expect, test } from '@playwright/test';
import { games } from '../../assets/catalog.js';
import { arcadeEmbed, browserApps } from '../../assets/embedded-content.js';

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
  await expect(page.locator('.library-results')).toHaveText(`1–24 of ${games.length} games`);
  await expect(page.locator('.game-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.library-results')).toHaveText(`25–48 of ${games.length} games`);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('.pagination-output')).toHaveText('Page 1 of 24');

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
  await expect(local).toBeFocused();
  await page.locator('.player-stage:fullscreen').getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(page.locator('.player-stage:fullscreen')).toHaveCount(0);
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
  const builtInCount = games.filter(game => game.local).length;
  await expect(page.locator('.game-card')).toHaveCount(24);
  await expect(page.locator('.library-results')).toHaveText(`1–24 of ${builtInCount} games`);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.game-card')).toHaveCount(builtInCount - 24);

  const global = page.getByRole('searchbox', { name: 'Search the arcade' });
  await global.fill('slither.io');
  await global.press('Enter');
  const slither = page.locator('.game-card').filter({ has: page.getByRole('heading', { name: 'Slither.io', exact: true }) });
  await expect(slither).toHaveCount(1);
  await expect(slither.locator('.has-no-art')).toBeVisible();
  await global.fill('resent client');
  await global.press('Enter');
  await page.getByRole('link', { name: /^Resent Client/ }).click();
  await expect(page.getByText('In-page play unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse in-page games', exact: true })).toHaveAttribute('href', '#games?option=in-page');

  await page.getByRole('button', { name: 'Random Game' }).click();
  await expect(page.getByRole('button', { name: 'Play game', exact: true })).toBeVisible();
  await go(page, 'Settings');
  await page.getByLabel('Theme').selectOption('graphite');
  await page.getByRole('checkbox', { name: 'Featured games', exact: true }).uncheck();
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
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'graphite');
  await expect(page.getByRole('heading', { name: 'Featured games', exact: true })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Catch the Star Local arcade', exact: true }).click();
  const frame = page.frameLocator('.proxy-stage iframe');
  await frame.locator('#star').click();
  await expect(frame.locator('#score')).toContainText('1');
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  const tabs = page.getByRole('tablist', { name: 'Browser tabs' });
  const gameTab = tabs.getByRole('tab', { name: 'Catch the Star', exact: true });
  const startTab = tabs.getByRole('tab', { name: 'Start page', exact: true });
  await expect(tabs.getByRole('button')).toHaveCount(0);
  await gameTab.click();
  await expect(frame.locator('#score')).toContainText('1');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Favorite pages' })).toBeVisible();
  await page.keyboard.press('Escape');
  await gameTab.press('ArrowRight');
  await expect(startTab).toBeFocused();
  await startTab.press('Delete');
  await expect(startTab).toHaveCount(0);
  await expect(gameTab).toBeFocused();
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
  await page.getByRole('button', { name: 'Reopen closed tab', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Wikipedia preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate current tab', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(frame.getByRole('heading', { name: 'Wikipedia preview' })).toBeVisible();
});

test('Proxy Gemini respects frame blocking and keeps links and search explicit', async ({ page }) => {
  const blocked = 'https://example.com/blocked';
  await page.route(blocked, route => route.fulfill({
    contentType: 'text/html',
    headers: { 'Content-Security-Policy': "frame-ancestors 'none'" },
    body: '<h1>Restricted preview content</h1>'
  }));
  await page.goto('/#browse');
  await expect(page.locator('.proxy-playable-group').nth(0).getByRole('button')).toHaveCount(games.filter(game => game.local).length);
  await expect(page.locator('.proxy-playable-group').nth(1).getByRole('button')).toHaveCount(games.filter(arcadeEmbed).length);
  for (const app of browserApps) {
    await page.getByRole('button', { name: `${app.title} ${app.description}`, exact: true }).click();
    await expect(page.locator('.proxy-frame')).toHaveAttribute('src', app.embed);
    await expect(page).toHaveURL(/#browse$/);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Play 2048', exact: true }).click();
  await expect(page.getByRole('group', { name: '2048 controls' })).toBeVisible();
  await expect(page).toHaveURL(/#browse$/);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('group', { name: '2048 controls' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stacktris Game player', exact: true }).click();
  await expect(page.locator('.proxy-frame')).toHaveAttribute('src', 'https://play.fancade.com/5BEC8352E4E078B1');
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true })).toHaveCount(0);
  const address = page.getByRole('textbox', { name: 'Address or search query' });
  await address.fill('https://www.miniplay.com/game/snow-rider-3d');
  await address.press('Enter');
  await expect(page.getByRole('heading', { name: 'Snow Rider 3D isn’t available in-page' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Pocket Circuit' })).toBeVisible();
  await expect(page.locator('.proxy-frame')).toHaveCount(0);
  await address.fill(blocked);
  const requestedBlockedPage = page.waitForRequest(blocked);
  await address.press('Enter');
  await requestedBlockedPage;
  const original = page.getByRole('link', { name: 'Open in new tab', exact: true });
  await expect(original).toHaveAttribute('href', blocked);
  await expect(original).toHaveAttribute('target', '_blank');
  const hide = page.getByRole('button', { name: 'Hide preview' });
  const chooseGame = page.getByRole('button', { name: 'Choose an in-page game' });
  await expect(hide.or(chooseGame)).toBeVisible({ timeout: 15_000 });
  await expect(page.frameLocator('.proxy-frame').getByRole('heading', { name: 'Restricted preview content' })).not.toBeVisible();
  await expect(page).toHaveURL(/#browse$/);

  await address.fill('https://proxy-arcade-play.base44.app/browse');
  await address.press('Enter');
  await expect(page.getByRole('heading', { name: 'This legacy viewer can’t open here' })).toBeVisible();
  await expect(page.locator('.proxy-frame')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Base44 in new tab' })).toHaveCount(0);
  await address.fill('snow rider');
  await address.press('Enter');
  await expect(page.getByRole('link', { name: 'Search Google in new tab' })).toHaveAttribute('target', '_blank');
  await page.getByRole('link', { name: 'Browse arcade alternatives' }).click();
  await expect(page).toHaveURL(/#games\?option=in-page&category=Racing$/);
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', exact: true }).first()).toBeVisible();
});

test('video and film search, official fallback, playback review, catalog report', async ({ page }) => {
  await page.goto('/');
  await go(page, 'YouTube');
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

test('the expanded YouTube tabs show the curated catalog and support pagination', async ({ page }) => {
  await page.goto('/#youtube');
  await page.getByRole('button', { name: 'Play featured video', exact: true }).click();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute('src', /embed\/NWjkbAQOGY8/);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  const count = page.locator('.media-result-count');
  const watch = page.getByRole('button', { name: /^Watch / });
  const firstWatch = await watch.first().getAttribute('aria-label');
  await expect(watch).toHaveCount(18);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(watch).toHaveCount(36);
  await expect(watch.first()).toHaveAttribute('aria-label', firstWatch);
  for (const [tab, destination, minimum] of [['Shorts', '/shorts/', 350], ['Full videos', '/watch', 170]]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    expect(parseInt(await count.textContent(), 10)).toBeGreaterThanOrEqual(minimum);
    const firstTitle = await watch.first().getAttribute('aria-label');
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(watch.first()).not.toHaveAttribute('aria-label', firstTitle);

    await watch.first().click();
    const dialog = page.getByRole('dialog');
    const href = await dialog.getByRole('link', { name: 'Watch on YouTube' }).getAttribute('href');
    expect(new URL(href).pathname.startsWith(destination)).toBe(true);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Explore connects the new videos, collections, cinema, arcade and tools', async ({ page }) => {
  await page.goto('/');
  await go(page, 'Explore', 'Explore the arcade');
  await expect(page.getByRole('heading', { name: 'Watch', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Video collections', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Search and tools', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Comet Courier Play the space delivery game$/ })).toBeVisible();

  await page.getByRole('link', { name: 'Browse new videos' }).click();
  await expect(page.getByRole('button', { name: 'New additions' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.media-result-count')).toHaveText('731 videos');
  await page.getByRole('navigation', { name: 'Browse video topics' }).getByRole('link', { name: 'Science' }).click();
  await expect(page.getByRole('combobox', { name: 'Video topic' })).toHaveValue('Science');
  await expect(page.locator('.media-result-count')).toHaveText('172 videos');

  await go(page, 'Explore', 'Explore the arcade');
  await page.getByRole('link', { name: /^Cinema \d+ films and trailers$/ }).click();
  await expect(page.getByRole('heading', { name: 'Movies', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open films', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Animated shorts', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Studio trailers', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Studio trailers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Studio trailers', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Watch trailer', exact: true }).first()).toBeVisible();

  await page.goto('/#movies?collection=shorts');
  await page.getByRole('searchbox', { name: 'Search films' }).fill('The Cat Came Back');
  await page.getByRole('button', { name: 'Play full short', exact: true }).click();
  const film = page.getByRole('dialog', { name: 'The Cat Came Back' });
  await expect(film.locator('iframe')).toHaveAttribute('src', 'https://www.nfb.ca/film/the-cat-came-back/embed/player/');
  await expect(film.getByRole('link', { name: 'Watch on NFB' })).toHaveAttribute('href', 'https://www.nfb.ca/film/the-cat-came-back/');
});

test('every built-in player mounts and publisher embeds retain a direct source', async ({ page }) => {
  await page.goto('/');
  for (const game of games.filter(({ local }) => local === true)) {
    await page.goto(`/#play/${game.id}`);
    await page.getByRole('button', { name: 'Play game', exact: true }).click();
    await expect(page.getByRole('group', { name: `${game.title} controls`, exact: true })).toBeVisible();
    const start = page.getByRole('button', { name: 'Start', exact: true });
    if (await page.locator('.player-stage canvas').count() && await start.isVisible()) {
      await start.click();
      await expect(page.locator('.player-stage canvas')).toBeVisible();
    }
  }
  for (const game of games.filter(arcadeEmbed)) {
    await page.goto(`/#play/${game.id}`);
    await page.getByRole('button', { name: 'Play game', exact: true }).click();
    await expect(page.locator('.player-stage iframe')).toHaveAttribute('src', game.embed);
    await expect(page.getByRole('link', { name: 'Open game source' })).toHaveCount(0);
  }
});

test('Shorts scroll to the next filtered video and replace the active player', async ({ page }) => {
  await page.goto('/#youtube');
  await page.getByRole('combobox', { name: 'Video topic' }).selectOption('Violin');
  await page.getByRole('button', { name: 'Scroll Shorts', exact: true }).click();
  const feed = page.getByRole('dialog', { name: 'Shorts feed' });
  const viewport = feed.locator('.shorts-feed-viewport');
  const player = feed.locator('iframe');
  await expect(feed.getByText('1 of 52')).toBeVisible();
  await expect(player).toHaveCount(1);
  const first = await player.getAttribute('src');
  await viewport.hover({ position: { x: 15, y: 25 } });
  await page.mouse.wheel(0, await viewport.evaluate(element => element.clientHeight));
  await expect(feed.getByText('2 of 52')).toBeVisible();
  await expect(player).toHaveCount(1);
  await expect(player).not.toHaveAttribute('src', first);
  await viewport.press('ArrowUp');
  await expect(feed.getByText('1 of 52')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(feed.getByRole('button', { name: 'Next Short', exact: true })).toBeInViewport();
  await feed.getByRole('button', { name: 'Next Short', exact: true }).click();
  await expect(feed.getByText('2 of 52')).toBeVisible();
  await feed.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(feed).toHaveCount(0);
});

test('the new original puzzles play inside the arcade', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/#play/pattern-pulse');
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Your turn · 0 of 3')).toBeVisible();
  for (let count = 0; count < 3; count++) await page.keyboard.press('1');
  await expect(page.getByText('Pattern matched!')).toBeVisible();

  await page.goto('/#play/sum-trail');
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  for (const index of [5, 4, 8, 12]) await page.locator(`[data-trail-cell="${index}"]`).click();
  await expect(page.getByText('Trail complete!')).toBeVisible();
  await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
  await expect(page.getByText('Puzzle 2 of 4 · Target 25 · Sum 0')).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test('layout and mobile menu fit desktop, tablet and phone widths', async ({ page }, info) => {
  await page.unroute('https://**/*');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await recordScreenshot(page, info, `home-${width}`);
    if (width <= 390) {
      await expect(page.getByRole('navigation', { name: 'Arcade navigation' })).not.toBeVisible();
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const drawer = page.getByRole('dialog', { name: 'Site navigation' });
      await expect(drawer).toHaveAttribute('aria-modal', 'true');
      await expect(page.locator('.workspace[inert]')).toHaveCount(1);
      await drawer.getByRole('button', { name: 'Close navigation', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await go(page, 'All Games');
      await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.game-grid')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();

      for (const [route, title] of [
        ['explore', 'Explore the arcade'], ['youtube', 'YouTube'], ['movies', 'Movies'], ['music', 'Music'],
        ['browse', 'Proxy Gemini'], ['web-search', 'Web Search'], ['play-hub', 'Play Hub']
      ]) {
        await page.goto('/#' + route, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await recordScreenshot(page, info, `${route}-${width}`);
      }
    }
  }
});

test('legacy links retain their routes and leaving settings dismisses its confirmation', async ({ page }) => {
  await page.goto('/pro.html?from=bookmark#play/2048');
  await expect(page.getByRole('heading', { name: '2048', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/\?from=bookmark#play\/2048$/);
  await page.getByRole('button', { name: 'Add 2048 to favorites' }).click();
  await page.goto('/index.html.index.html#games?q=snake');
  await expect(page.getByLabel('Search games', { exact: true })).toHaveValue('snake');
  await expect(page).toHaveURL(/\/#games\?q=snake$/);
  await go(page, 'Settings');
  await page.getByRole('button', { name: 'Clear saved games' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'All Games', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await go(page, 'Favorites');
  await page.getByRole('button', { name: 'Remove 2048 from favorites' }).click();
  await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse games', exact: true })).toBeFocused();
});

test('Web Search shows a sourced answer and opens matching YouTube videos in the same tab', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true, value: { availability: async () => 'unavailable' }
    });
  });
  await page.route(url => url.hostname === 'en.wikipedia.org' && url.pathname === '/w/api.php', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('gsrsearch')).toBe('Minecraft');
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: {
      query: { pages: [{ pageid: 27815578, title: 'Minecraft', extract: 'Minecraft is a sandbox video game.' }] }
    } });
  });
  await page.goto('/#web-search');
  await page.getByRole('combobox', { name: 'Search the web' }).fill('What is Minecraft');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wiki and references' })).toBeVisible();
  await expect(page.getByText('Minecraft is a sandbox video game.')).toBeVisible();
  await page.getByRole('button', { name: 'Minecraft', exact: true }).click();
  const article = page.getByRole('dialog', { name: 'Minecraft' });
  await expect(article.getByText('Minecraft is a sandbox video game.')).toBeVisible();
  await expect(article.getByText(/en\.wikipedia\.org\/\?curid=27815578/)).toBeVisible();
  await article.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'YouTube', exact: true })).toBeVisible();
  await page.locator('.web-search-video').first().click();
  const player = page.getByRole('dialog');
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\//);
  await expect(player.getByRole('link', { name: 'Watch on YouTube' })).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(1);
  await expect(page).toHaveURL(/#web-search$/);
  await player.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Web Search can enable the on-device model and labels its answer', async ({ page }) => {
  await page.addInitScript(() => {
    let available = false;
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => available ? 'available' : 'downloadable',
        create: async ({ monitor }) => {
          if (monitor) {
            const progress = new EventTarget();
            monitor(progress);
            progress.dispatchEvent(new ProgressEvent('downloadprogress', { loaded: 1 }));
            available = true;
          }
          return {
            prompt: async text => text.includes('Mario Kart')
              ? (text.includes('How does multiplayer work?') ? 'A follow-up that used Mario Kart as context.' : 'An answer produced by the test model.')
              : '',
            destroy() {}
          };
        }
      }
    });
  });
  await page.goto('/#web-search');
  await page.getByRole('button', { name: 'AI Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Enable on-device AI' }).click();
  await expect(page.getByText('On-device AI is ready. Ask a question to use it.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Ask AI' }).fill('Mario Kart');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'On-device AI answer' })).toBeVisible();
  await expect(page.getByText('An answer produced by the test model.')).toBeVisible();
  await page.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Ask AI', exact: true }).fill('How does multiplayer work?');
  await page.getByRole('button', { name: 'Send follow-up', exact: true }).click();
  await expect(page.getByText('A follow-up that used Mario Kart as context.')).toBeVisible();
  await page.getByRole('link', { name: 'Search web and YouTube', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Search the web' })).toHaveValue('Mario Kart');
  await page.getByRole('button', { name: 'AI Mode', exact: true }).click();
  await expect(page.getByText('A follow-up that used Mario Kart as context.')).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test('AI Help opens directly and converts units without a model or external search', async ({ page }) => {
  let wikipediaQueries = 0;
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    wikipediaQueries++;
    return route.abort();
  });
  await page.goto('/#web-search?mode=ai');
  await expect(page.getByRole('button', { name: 'AI Mode', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Convert units', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Ask AI' })).toHaveValue('Convert 5 miles to km');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unit converter', exact: true })).toBeVisible();
  await expect(page.getByText('5 mi = 8.04672 km')).toBeVisible();
  expect(wikipediaQueries).toBe(0);
  await page.getByRole('button', { name: 'New search tab', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Search the web' })).toBeVisible();
});

test('search tabs keep paged violin results with separate Shorts and videos', async ({ page }) => {
  await page.goto('/#web-search');
  const input = page.getByRole('combobox', { name: 'Search the web' });
  await input.fill('violion');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText(/Showing 1–20 of 116/)).toBeVisible();
  await expect(page.locator('.web-search-video')).toHaveCount(20);
  await page.getByRole('button', { name: 'Next video results' }).click();
  await expect(page.getByText(/Showing 21–40 of 116/)).toBeVisible();
  await page.getByRole('button', { name: 'New search tab' }).click();
  await expect(input).toHaveValue('');
  await page.getByRole('tab', { name: 'violion' }).click();
  await expect(input).toHaveValue('violion');
  await expect(page.getByText(/Showing 21–40 of 116/)).toBeVisible();
  await page.getByRole('button', { name: 'Videos', exact: true }).click();
  await expect(page.getByText(/Showing 1–20 of 64/)).toBeVisible();
  await page.getByRole('button', { name: 'Shorts', exact: true }).click();
  await expect(page.getByText(/Showing 1–20 of 52/)).toBeVisible();
  await page.getByRole('button', { name: 'Scroll matching Shorts' }).click();
  const feed = page.getByRole('dialog', { name: 'Shorts feed' });
  await expect(feed.getByText('1 of 52')).toBeVisible();
  await feed.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Close violion tab' }).click();
  await expect(input).toHaveValue('');
  expect(page.context().pages()).toHaveLength(1);
});

test('catalog-only game details and Home lead to playable alternatives inside the arcade', async ({ page }) => {
  for (const id of ['retrobowl', 'snow-rider-3d']) {
    await page.goto(`/#play/${id}`);
    await expect(page.getByRole('heading', { name: 'In-page play unavailable' })).toBeVisible();
    await expect(page.locator('.player-actions a[target="_blank"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Browse in-page games' }).click();
    await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('in-page');
  }
  await go(page, 'Home', 'Pocket Circuit');
  await expect(page.locator('main a[href*="miniplay.com"]')).toHaveCount(0);
});

test('Web Search opens a pasted YouTube URL in the official player', async ({ page }) => {
  await page.goto('/#web-search');
  await page.getByRole('combobox', { name: 'Search the web' }).fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  await expect(dialog.getByRole('link', { name: 'Watch on YouTube' })).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(1);
});

test('Web Search isolates configured Google results in the page', async ({ page }) => {
  await page.route(url => url.hostname === 'cse.google.com' && url.pathname === '/cse.js', route => {
    expect(new URL(route.request().url()).searchParams.get('cx')).toBe('public_sample_123');
    return route.fulfill({ contentType: 'application/javascript', body: `
      window.google = { search: { cse: { element: {
        render() {},
        getElement() { return { execute(query) { document.querySelector('#google-results').textContent = query; } }; }
      } } } };
      window.__gcse.initializationCallback();
    ` });
  });
  await page.goto('/#web-search');
  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Google query' }).fill('arcade controller');
  await page.getByRole('button', { name: 'Use Google engine', exact: true }).click();
  await expect(page.getByText(/Enter a valid public Google Search Engine ID/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Public Search Engine ID' }).fill('public_sample_123');
  await page.getByRole('button', { name: 'Use Google engine', exact: true }).click();
  await expect(page.locator('iframe[title="Google results"]')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.frameLocator('iframe[title="Google results"]').getByText('arcade controller')).toBeVisible();
  await expect(page).toHaveURL(/#web-search$/);
  expect(page.context().pages()).toHaveLength(1);
});

test('Google essay searches show an answer, videos and writing tools together', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: {
      availability: async () => window.essayModelReady ? 'available' : 'unavailable',
      create: async () => ({
        prompt: async text => text.includes('how to write an essay about music') ? 'Start with a thesis about music.' : '',
        destroy() {}
      })
    } });
  });
  await page.goto('/#web-search?mode=google&q=how+to+wrie+an+essay');
  const query = page.getByRole('searchbox', { name: 'Google query' });
  const search = page.getByRole('button', { name: 'Search', exact: true });
  await expect(query).toHaveValue('how to write an essay');
  await expect(page.getByRole('heading', { name: 'Essay writing guide', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Built-in essay guide', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google Docs', exact: true })).toHaveAttribute('href', /docs\.google\.com/);
  await expect(page.getByRole('link', { name: 'ZoteroBib', exact: true })).toHaveAttribute('href', 'https://zbib.org/');
  await expect(page.getByRole('link', { name: 'blip.ai', exact: true }).last()).toHaveAttribute('href', '#blip');

  await page.getByRole('button', { name: /^How to Write an Essay:.*Scribbr/ }).click();
  const video = page.getByRole('dialog', { name: /^How to Write an Essay:.*Scribbr/ });
  await expect(video.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/UuOWNNvupik/);
  await video.getByRole('button', { name: 'Close', exact: true }).click();

  await page.evaluate(() => { window.essayModelReady = true; });
  await query.fill('how to write an essay about music');
  await search.click();
  await expect(page.getByRole('heading', { name: 'On-device AI answer', exact: true })).toBeVisible();
  await expect(page.getByText('Start with a thesis about music.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Purdue OWL', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#web-search\?mode=google&q=how\+to\+wrie\+an\+essay$/);
});

test('Google and Proxy Gemini link to built-in and publisher-authorized in-page games', async ({ page }) => {
  const inPage = games.filter(game => game.local || arcadeEmbed(game));
  const cards = page.locator('.game-card');
  const next = page.getByRole('navigation', { name: 'Game pages' }).getByRole('button', { name: 'Next', exact: true });
  for (const route of ['web-search?mode=google', 'browse']) {
    await page.goto('/#' + route);
    await page.getByRole('link', { name: 'Games you can play here', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('in-page');
    for (let start = 0; start < inPage.length; start += 24) {
      if (start) await next.click();
      const end = Math.min(start + 24, inPage.length);
      await expect(page.locator('.library-results')).toHaveText(`${start + 1}–${end} of ${inPage.length} games`);
      await expect(cards.getByRole('heading')).toHaveText(inPage.slice(start, end).map(game => game.title));
      await expect(cards.getByText('External', { exact: true })).toHaveCount(0);
    }
  }
});

test('searching Territorial.io from Google shows its preview, wiki and videos without leaving', async ({ page }) => {
  await page.goto('/#web-search?mode=google');
  await page.getByRole('searchbox', { name: 'Google query' }).fill('territorial.io');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Territorial.io', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search Music' })).toHaveAttribute('href', '#music?q=territorial.io');
  await page.getByRole('button', { name: 'Preview Territorial.io', exact: true }).click();
  const game = page.getByRole('dialog', { name: 'Territorial.io', exact: true });
  await expect(game.locator('iframe')).toHaveAttribute('src', 'https://territorial.io/');
  await expect(game.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-presentation');
  await expect(game.getByRole('button', { name: 'Retry player', exact: true })).toBeVisible();
  await expect(game.getByRole('link', { name: 'Browse in-page games' })).toHaveAttribute('href', '#games?option=in-page');
  await game.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(game.locator('.search-resource-body:fullscreen')).toBeVisible();
  await game.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(game.locator('.search-resource-body:fullscreen')).toHaveCount(0);
  await game.getByRole('button', { name: 'Close', exact: true }).click();
  const categories = page.getByRole('group', { name: 'Result category' });
  await categories.getByRole('button', { name: 'Wiki', exact: true }).click();
  await page.getByRole('button', { name: 'Game Play – Territorial.io Wiki', exact: true }).click();
  const wiki = page.getByRole('dialog', { name: 'Game Play – Territorial.io Wiki' });
  await expect(wiki.getByText(/balance that grows/)).toBeVisible();
  await expect(wiki.getByRole('link')).toHaveCount(0);
  await wiki.getByRole('button', { name: 'Close', exact: true }).click();

  await categories.getByRole('button', { name: 'YouTube', exact: true }).click();
  await page.getByRole('button', { name: 'Trailer - Territorial.io', exact: true }).click();
  const player = page.getByRole('dialog', { name: 'Trailer - Territorial.io' });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/SN7yOZARWB0/);
  await expect(player.getByRole('link')).toHaveCount(0);
  await expect(page).toHaveURL(/#web-search\?mode=google$/);
  expect(page.context().pages()).toHaveLength(1);
});

test('Music videos finds official songs and opens the player inside the arcade', async ({ page }) => {
  const musicRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/\/assets\/music-(library|catalog)\.js$/.test(url.pathname)) musicRequests.push(url);
  });
  await page.goto('/#music?view=videos');
  await expect(page.getByRole('button', { name: 'Play featured track, Hall of Fame', exact: true })).toBeVisible();
  const entry = await page.locator('script[src*="/arcade.js"]').getAttribute('src');
  const release = new URL(entry, page.url()).search;
  expect(release).toMatch(/^\?v=.+/);
  expect(musicRequests.map(url => url.search)).toEqual([release, release]);
  const search = page.getByRole('searchbox', { name: 'Search music by title, artist, or style' });
  await search.fill('hall of fame');
  await page.getByRole('button', { name: 'Play Hall of Fame', exact: true }).click();
  const player = page.getByRole('dialog', { name: 'Hall of Fame' });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/mk48xRzuNvA/);
  await player.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Save Hall of Fame', exact: true }).click();
  await search.fill('');
  await page.getByRole('button', { name: 'Saved music', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play Hall of Fame', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await search.fill('Benson Boone');
  await expect(page.getByRole('button', { name: 'Play Beautiful Things', exact: true })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test('Music replaces lyric videos with creator uploads and keeps the searchable chart', async ({ page }) => {
  await page.goto('/#music');
  const songs = page.getByRole('list', { name: 'Chart songs' });
  await expect(page.getByText('Showing 25 of 550 chart songs')).toBeVisible();
  await page.getByRole('button', { name: 'Watch lyrics', exact: true }).click();
  await expect(page.getByText('Showing 25 of 84 lyric videos')).toBeVisible();
  const lyricVideos = page.getByRole('list', { name: 'Lyric videos' });
  await expect(lyricVideos.locator('img')).toHaveCount(0);
  await page.getByLabel('Lyric channel').selectOption('7clouds');
  await expect(page.getByText('Showing 25 of 55 lyric videos')).toBeVisible();
  await expect(lyricVideos.getByRole('link', { name: '7clouds', exact: true })).toHaveCount(25);
  await lyricVideos.getByRole('button', { name: 'Play lyrics video for Housewife by Tate McRae' }).click();
  const creatorPlayer = page.getByRole('dialog', { name: 'Lyrics for Housewife' });
  await expect(creatorPlayer.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/hlLvIWeZc2w/);
  await expect(creatorPlayer.getByRole('link', { name: 'Watch on YouTube · 7clouds' })).toBeVisible();
  await creatorPlayer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Lyric channel').selectOption('Unique Vibes');
  await expect(lyricVideos.getByRole('link', { name: '7clouds', exact: true })).toHaveCount(0);
  await expect(lyricVideos.getByRole('link', { name: 'Unique Vibes', exact: true }).first()).toBeVisible();
  await page.getByLabel('Lyric channel').selectOption('7clouds Rock');
  await lyricVideos.getByRole('button', { name: /Play lyrics video for Hall of Fame/ }).click();
  const hallOfFame = page.getByRole('dialog', { name: 'Lyrics for Hall of Fame' });
  await expect(hallOfFame.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/rPlwqDjzJ14/);
  await expect(hallOfFame.getByRole('link', { name: 'Watch on YouTube · 7clouds Rock' })).toBeVisible();
  await hallOfFame.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Find lyric videos for / })).toHaveCount(0);
  await page.getByRole('button', { name: 'All chart songs', exact: true }).click();
  await expect(songs.getByRole('listitem')).toHaveCount(25);
  await page.getByRole('button', { name: 'Load more songs' }).click();
  await expect(songs.getByRole('listitem')).toHaveCount(50);
  await page.getByLabel('Chart source').selectOption({ label: 'Billboard Hot 100' });
  await expect(page.getByText('Showing 25 of 25 chart songs')).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Song or artist' });
  await search.fill('house wifre');
  await songs.getByRole('button', { name: 'Play lyrics video for Housewife by Tate McRae' }).click();
  const housewife = page.getByRole('dialog', { name: 'Lyrics for Housewife' });
  await expect(housewife.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/hlLvIWeZc2w/);
  await expect(housewife.getByRole('link', { name: 'Lyrics on Apple Music' }))
    .toHaveAttribute('href', /music\.apple\.com\/us\/album\/housewife\//);
  await housewife.getByRole('button', { name: 'Close', exact: true }).click();

  await search.fill('drcula');
  await songs.getByRole('button', { name: 'Lyrics for Dracula by Tame Impala & JENNIE' }).click();
  const dracula = page.getByRole('dialog', { name: 'Lyrics for Dracula' });
  await dracula.getByRole('button', { name: 'Play lyric video here' }).click();
  await expect(dracula.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/UvhkjVBBKiU/);
  await dracula.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Lyric videos only' }).check();
  await expect(songs.getByRole('button', { name: 'Play lyrics video for Dracula by Tame Impala & JENNIE' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Lyric videos only' }).uncheck();
  await search.fill('Benson Boone');
  await expect(page.getByRole('link', { name: 'Music videos' })).toHaveAttribute('href', '#music?view=videos&q=Benson+Boone');

  await page.getByLabel('Chart source').selectOption('');
  await search.fill('KILLY MANJARO');
  await songs.getByRole('button', { name: 'Lyrics for KILLY MANJARO by Summer Cem & BILLA JOE' }).click();
  const fallback = page.getByRole('dialog', { name: 'Lyrics for KILLY MANJARO' });
  const resultsUrl = await fallback.getByRole('link', { name: /find lyric videos/i }).getAttribute('href');
  expect(new URL(resultsUrl).origin).toBe('https://www.youtube.com');
  const videoQuery = new URL(resultsUrl).searchParams.get('search_query');
  expect(videoQuery).toContain('KILLY MANJARO');
  expect(videoQuery).toContain('Summer Cem & BILLA JOE');
});

test('Web Search and All Games use fullscreen without losing the query', async ({ page }) => {
  await page.goto('/#web-search?q=territorial.io');
  const webSearch = page.locator('.web-search-window');
  await webSearch.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.locator('.web-search-window:fullscreen')).toBeVisible();
  await expect(webSearch.getByRole('combobox', { name: 'Search the web' })).toHaveValue('territorial.io');
  await webSearch.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(page.locator('.web-search-window:fullscreen')).toHaveCount(0);

  await page.goto('/#games?q=snake');
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.locator('.route-games:fullscreen')).toBeVisible();
  await expect(page.getByLabel('Search games', { exact: true })).toHaveValue('snake');
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(page.locator('.route-games:fullscreen')).toHaveCount(0);
});

test('game pages launch unified wiki and video search', async ({ page }) => {
  await page.goto('/#play/territorial');
  await page.getByRole('link', { name: 'Find wiki and videos' }).click();
  await expect(page.getByRole('button', { name: 'Game Play – Territorial.io Wiki', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trailer - Territorial.io', exact: true })).toBeVisible();

  await page.goto('/#play/snake');
  const search = page.getByRole('searchbox', { name: 'Search the arcade' });
  await search.fill('territorial.io');
  await search.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Search the web' })).toHaveValue('territorial.io');
  await expect(page.getByRole('button', { name: 'Trailer - Territorial.io', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#web-search\?q=territorial\.io$/);
});

test('connected web results open the arcade viewer and preserve the official link', async ({ page }) => {
  let searched = false;
  await page.route('https://gateway.example/api/search', async route => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    searched = true;
    expect(route.request().postDataJSON()).toEqual({ q: 'learning html' });
    return route.fulfill({ headers, json: { results: [
      { title: 'HTML on MDN', description: 'Official learning reference.', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
      { title: 'Invalid site', description: '', url: 'javascript:alert(1)' }
    ] } });
  });
  await page.goto('/#web-search');
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('combobox', { name: 'Search the web' }).fill('learning html');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('group', { name: 'Result category' }).getByRole('button', { name: 'Web', exact: true }).click();
  await expect(page.getByText('HTML on MDN', { exact: true })).toBeVisible();
  await expect(page.getByText('Invalid site', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open website', exact: true })).toHaveAttribute('href', 'https://developer.mozilla.org/en-US/docs/Web/HTML');
  await page.getByRole('link', { name: 'Preview website', exact: true }).click();
  await expect(page).toHaveURL(/#browse\?address=/);
  expect(searched).toBe(true);
});

test('Web Search finds a place and opens the map in the same tab', async ({ page }) => {
  await page.route(url => url.hostname === 'geocoding-api.open-meteo.com', route => {
    expect(new URL(route.request().url()).searchParams.get('name')).toBe('Paris');
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: {
      results: [{ name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.8566, longitude: 2.3522 }]
    } });
  });
  await page.goto('/#web-search');
  await page.getByRole('button', { name: 'Maps', exact: true }).click();
  await page.getByRole('searchbox', { name: 'City, postal code, or coordinates' }).fill('Paris');
  await page.getByRole('button', { name: 'Find on map', exact: true }).click();
  await expect(page.getByText('1 place found for “Paris”.')).toBeVisible();
  await expect(page.locator('.search-map-frame')).toHaveAttribute('src', /openstreetmap\.org\/export\/embed\.html\?/);
  const frame = new URL(await page.locator('.search-map-frame').getAttribute('src'));
  expect(frame.searchParams.get('marker')).toBe('48.8566,2.3522');
  await expect(page).toHaveURL(/#web-search$/);
  expect(page.context().pages()).toHaveLength(1);
});
