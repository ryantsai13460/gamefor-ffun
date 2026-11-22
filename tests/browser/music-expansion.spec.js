import { expect, test } from '@playwright/test';
import { musicCatalog } from '../../assets/music-catalog.js';

const button = (within, name) => within.getByRole('button', { name, exact: typeof name === 'string' });
const thumbnail = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

test('Music discovers 500 or more sourced uploads and browses the latest addition batch', async ({ page }) => {
  expect(musicCatalog.length).toBeGreaterThanOrEqual(500);
  const latest = musicCatalog.map(track => track.addedAt || '').sort().at(-1);
  const newCount = musicCatalog.filter(track => track.addedAt === latest).length;
  expect(newCount).toBeGreaterThanOrEqual(189);
  expect(new Set(musicCatalog.map(track => track.id)).size).toBe(musicCatalog.length);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/^https:\/\//, route => route.abort());
  await page.route('https://i.ytimg.com/**', route => route.fulfill({ contentType: 'image/gif', body: thumbnail }));
  await page.goto('/#music?view=videos');
  await expect(page.getByText(`Discover ${musicCatalog.length.toLocaleString('en-US')} official uploads by song, artist, or style.`)).toBeVisible();

  const imagine = button(page, /^Browse Imagine Dragons,/);
  await expect(imagine.locator('img')).toHaveAttribute('src', /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\//);
  await expect(imagine.locator('img')).toHaveAttribute('loading', 'lazy');
  await imagine.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Filter by artist' })).toHaveValue('Imagine Dragons');

  await button(page, 'Recently added').click();
  const count = page.locator('.music-count');
  await expect(count).toHaveText(new RegExp(`Showing \\d+ of ${newCount} tracks`));
  const list = page.getByRole('list', { name: 'Music tracks' });
  const firstCount = await list.getByRole('listitem').count();
  await button(page, 'Load more tracks').scrollIntoViewIfNeeded();
  await expect.poll(() => list.getByRole('listitem').count()).toBeGreaterThan(firstCount);

  await page.getByRole('searchbox', { name: 'Search music by title, artist, or style' }).fill('I Giorni');
  const play = button(page, 'Play I Giorni');
  await expect(play.locator('img')).toHaveAttribute('src', /\/vi\/Htk5IuW5JHE\//);
  await play.click();
  const player = page.getByRole('dialog', { name: 'I Giorni', exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/Htk5IuW5JHE/);
  await expect(player.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=Htk5IuW5JHE');
  await button(player, 'Close').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('YouTube explains connected search limits and keeps the already-loaded results', async ({ page }) => {
  const calls = [];
  await page.route(/^https:\/\//, route => route.abort());
  await page.route('https://video-limit.example/search?**', route => {
    const token = new URL(route.request().url()).searchParams.get('pageToken');
    calls.push(token);
    const headers = { 'access-control-allow-origin': '*' };
    return calls.length === 1
      ? route.fulfill({ headers, json: { items: [{ id: '80VtSQHvWBo', title: 'Connected Minecraft match', creator: 'camman18' }], nextPageToken: 'more' } })
      : route.fulfill({ headers, status: 429, body: '' });
  });
  await page.goto('/#youtube?format=shorts&q=80VtSQHvWBo');
  const libraryVideo = button(page, 'Watch Minecraft, But I Shrunk');
  await expect(libraryVideo).toBeVisible();
  await page.getByText('Connected YouTube search', { exact: true }).click();
  await page.getByLabel('YouTube search endpoint').fill('https://video-limit.example/search');
  await button(page, 'Save search endpoint').click();
  await button(page, 'Search connected service').click();
  const connected = button(page, 'Watch Connected Minecraft match');
  await expect(connected).toBeVisible();
  await button(page, 'Load more').click();
  await expect(page.getByText('Connected YouTube search reached its request limit. Videos already loaded are still available.')).toBeVisible();
  await expect(connected).toBeVisible();
  expect(calls).toEqual([null, 'more']);
  await button(page, 'Search connected service').click();
  await expect(page.getByText('Connected YouTube search reached its request limit. You can keep browsing the curated library.')).toBeVisible();
  await expect(libraryVideo).toBeVisible();
});
