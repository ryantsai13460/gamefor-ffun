import { expect, test } from '@playwright/test';
import { musicCatalog } from '../../assets/music-catalog.js';

const button = (container, name) => container.getByRole('button', { name, exact: true });

test('music preserves named playlists and keeps fullscreen exit through YouTube player events', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(frame, { events }) {
        window.testVideoEvents = events;
        requestAnimationFrame(() => {
          if (!frame.isConnected) return;
          events.onReady({ target: this });
          events.onStateChange({ data: 1 });
        });
      }
      destroy() {}
    } };
  });
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto('/#music?view=videos');
  expect(musicCatalog.length).toBeGreaterThanOrEqual(300);
  await expect(page.locator('.music-count')).toContainText(`${musicCatalog.length} tracks`);
  await button(page, 'Add Hall of Fame to playlist').click();
  const editor = page.getByRole('dialog', { name: 'Add to playlist', exact: true });
  await editor.getByRole('textbox', { name: 'Playlist name' }).fill('Shared study set');
  await button(editor, 'Add track').click();
  await expect(page.getByText('Added to Shared study set.', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search music by title, artist, or style' }).fill('Believer');
  await button(page, 'Add Believer to playlist').click();
  await button(editor, 'Add track').click();
  await page.reload();
  await button(page, 'Playlists').click();
  await expect(page.getByRole('combobox', { name: 'Select a saved playlist' }).locator('option:checked')).toHaveText('Shared study set');
  await expect(page.locator('.music-count')).toHaveText('2 tracks');

  await button(page, 'Play playlist').click();
  let player = page.getByRole('dialog', { name: 'Hall of Fame', exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', /embed\/mk48xRzuNvA/);
  await button(player, 'Next track').click();
  player = page.getByRole('dialog', { name: 'Believer', exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', /embed\/7wtfhZwyrcc/);
  await expect(player.getByText('Playing on YouTube.', { exact: true })).toBeVisible();
  await button(player, 'Fullscreen').click();
  const exit = button(player, 'Exit fullscreen');
  await expect(exit).toBeVisible();
  await page.evaluate(() => {
    window.testVideoEvents.onError({ data: 150 });
    window.testVideoEvents.onStateChange({ data: 1 });
  });
  await expect(exit).toBeVisible();
  await exit.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await button(player, 'Close').click();

  await button(page, 'Remove Hall of Fame from playlist').click();
  await expect(page.locator('.music-count')).toHaveText('1 track');
  await button(page, 'Recently played').click();
  await expect(page.locator('.music-count')).toHaveText('2 tracks');

  await page.goto('/#music?view=videos&track=7wtfhZwyrcc');
  const addressed = page.getByRole('dialog', { name: 'Believer', exact: true });
  await expect(addressed.locator('iframe')).toHaveAttribute('src', /embed\/7wtfhZwyrcc/);
});

test('connected YouTube search loads one requested token at a time and keeps unique video IDs', async ({ page }) => {
  const requests = [];
  const original = { id: 'FEropZ_Tq7Y', title: 'Minecraft prison simulation', creator: 'Spoke' };
  const addition = { id: '80VtSQHvWBo', title: 'Minecraft shrunk challenge', creator: 'camman18' };
  await page.route(/^https:\/\//, route => route.abort());
  await page.route('https://gateway.example/api/youtube', async route => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(route.request().postDataJSON());
    await route.fulfill({ headers, json: requests.length === 1
      ? { items: [original], nextPageToken: 'page-2' }
      : { items: [original, addition], nextPageToken: 'page-2' } });
  });
  await page.goto('/#youtube?format=all&q=Minecraft');
  await expect(page.getByRole('searchbox', { name: 'Search titles, creators, or topics' })).toHaveValue('Minecraft');
  await page.getByText('Connected YouTube search', { exact: true }).click();
  await page.getByText('Connect a YouTube Data API backend', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await button(page, 'Connect backend').click();
  await button(page, 'Search connected service').click();
  await expect(button(page, 'Watch Minecraft prison simulation')).toBeVisible();
  expect(requests).toEqual([{ q: 'Minecraft' }]);
  await button(page, 'Load more').click();
  await expect(button(page, 'Watch Minecraft shrunk challenge')).toBeVisible();
  await expect(page.locator('.media-video')).toHaveCount(2);
  await expect(page.getByText('No additional connected results.', { exact: true })).toBeVisible();
  await expect(button(page, 'Load more')).toBeHidden();
  expect(requests).toEqual([{ q: 'Minecraft' }, { q: 'Minecraft', pageToken: 'page-2' }]);
});

test('local YouTube discovery appends on scroll and the Shorts feed stays navigable in fullscreen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto('/#youtube?format=shorts&q=Minecraft');
  await expect(page.locator('.media-video')).toHaveCount(18);
  await page.getByRole('checkbox', { name: 'Load while scrolling' }).check();
  await expect.poll(() => page.locator('.media-video').count()).toBeGreaterThanOrEqual(36);
  const before = await page.locator('.media-video').count();
  await page.locator('.media-scroll-sentinel').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.media-video').count()).toBeGreaterThan(before);
  const videoIds = await page.locator('.media-card-launch').evaluateAll(cards => cards.map(card => card.dataset.videoId));
  expect(new Set(videoIds).size).toBe(videoIds.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await button(page, 'Scroll Shorts').click();
  const feed = page.getByRole('dialog', { name: 'Shorts feed', exact: true });
  const first = await feed.locator('iframe').getAttribute('src');
  await button(feed, 'Fullscreen').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('shorts-feed-content');
  await button(feed, 'Next Short').click();
  await expect(feed.locator('iframe')).not.toHaveAttribute('src', first);
  await expect(button(feed, 'Exit fullscreen')).toBeVisible();
  await button(feed, 'Exit fullscreen').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await button(feed, 'Close').click();
  await page.goto('/#youtube?format=all&video=80VtSQHvWBo');
  await expect(page.getByRole('dialog', { name: 'Minecraft, But I Shrunk', exact: true }).locator('iframe'))
    .toHaveAttribute('src', /embed\/80VtSQHvWBo/);
});

test('MrBeast variants find the official creator in both video formats', async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto('/#youtube?format=videos&q=Mr.Beast');
  await expect(page.locator('.media-video')).toHaveCount(7);
  await button(page, 'Watch I Built 10 Schools Around The World').click();
  const player = page.getByRole('dialog', { name: 'I Built 10 Schools Around The World' });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/5OLs1GWB4OA/);
  await button(player, 'Close').click();

  await page.getByRole('searchbox', { name: 'Search titles, creators, or topics' }).fill('@MrBeast');
  await button(page, 'Shorts').click();
  await expect(page.locator('.media-video')).toHaveCount(12);
  await button(page, 'Watch Can I Beat Magnus Carlsen?').click();
  const shortPlayer = page.getByRole('dialog', { name: 'Can I Beat Magnus Carlsen?', exact: true });
  await expect(shortPlayer.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/WjCH5JUNzao/);
  await button(shortPlayer, 'Close').click();
  await button(page, 'Scroll Shorts').click();
  const feed = page.getByRole('dialog', { name: 'Shorts feed' });
  await expect(feed.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/WjCH5JUNzao/);
});
