import { expect, test } from '@playwright/test';

const uploads = 'UUNqFDjYTexJDET3rPDrmJKg';
const playlistUrl = `https://www.youtube.com/playlist?list=${uploads}`;

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 200, body: '' }));
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.YT = { Player: class {
      constructor(frame, { events }) {
        window.playlistEvents = events;
        queueMicrotask(events.onReady);
      }
      destroy() { window.playlistPlayersClosed = (window.playlistPlayersClosed || 0) + 1; }
    } };`
  }));
});

test('Music opens the main 7clouds uploads playlist on demand and reports player state', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (request.url().startsWith('https://www.youtube-nocookie.com/embed/videoseries')) requests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('/#music');
  await page.getByRole('link', { name: '7clouds uploads', exact: true }).click();
  await expect(page).toHaveURL(/#music\?lyrics=7clouds$/);
  await expect(page.getByRole('heading', { name: '7clouds uploads' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open full playlist on YouTube' })).toHaveAttribute('href', playlistUrl);
  const frame = page.getByTitle('7clouds uploads playlist');
  await expect(frame).toHaveCount(0);
  expect(requests).toHaveLength(0);

  const open = page.getByRole('button', { name: 'Load playlist player' });
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  await open.click();
  await expect(frame).toHaveAttribute('src', new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/videoseries\\?list=${uploads}&`));
  const status = page.locator('.seven-clouds-player').getByRole('status');
  await expect(status).toContainText('YouTube player ready');
  expect(requests).toHaveLength(1);
  const close = page.getByRole('button', { name: 'Close playlist player' });
  await expect(close).toHaveAttribute('aria-expanded', 'true');

  await page.evaluate(() => window.playlistEvents.onStateChange({ data: 3 }));
  await expect(status).toContainText('Buffering on YouTube');
  await page.evaluate(() => window.playlistEvents.onStateChange({ data: 1 }));
  await expect(status).toHaveText('Playing on YouTube.');
  await page.evaluate(() => window.playlistEvents.onError({ data: 150 }));
  await expect(status).toContainText('Choose a lyric video below or open the full playlist on YouTube.');
  await expect(frame).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await close.click();
  await expect(frame).toHaveCount(0);
  await expect(open).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.playlistPlayersClosed)).toBe(1);
  await open.click();
  await expect(status).toContainText('YouTube player ready');
  await page.getByRole('link', { name: 'Music videos', exact: true }).click();
  await expect(frame).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.playlistPlayersClosed)).toBe(2);
  await expect(page.getByRole('link', { name: '7clouds uploads', exact: true })).toHaveAttribute('href', '#music?lyrics=7clouds');
});

test('the accessible main-channel queue works with the YouTube status script blocked', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', route => route.abort('blockedbyclient'));
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/#music?lyrics=7clouds');
  const queue = page.getByRole('list', { name: 'Curated 7clouds videos' });
  await expect(queue.getByRole('button')).toHaveCount(25);
  await expect(page.getByText('Showing 25 of 55 curated lyric videos.')).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(0);
  const more = page.getByRole('button', { name: 'Load more videos' });
  await more.press('Enter');
  await expect(queue.getByRole('button')).toHaveCount(50);
  await expect(queue.getByRole('button', { name: /^Select Darkside by/ })).toBeFocused();
  await more.press('Space');
  await expect(queue.getByRole('button')).toHaveCount(55);

  await page.getByRole('searchbox', { name: 'Song or artist' }).fill('Imagine Dragons');
  await expect(queue.getByRole('button')).toHaveCount(4);
  const believer = queue.getByRole('button', { name: 'Select Believer by Imagine Dragons' });
  await believer.press('Enter');
  await expect(page.getByRole('heading', { name: 'Believer', exact: true })).toBeFocused();
  await expect(believer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTitle('Believer lyric video from 7clouds')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/W0DM5lcj6mw\?/);
  await expect(page.getByRole('link', { name: 'Watch this video on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=W0DM5lcj6mw');
  await expect(page.locator('.seven-clouds-player').getByRole('status')).toContainText('YouTube playback status is unavailable.');

  const previous = page.getByRole('button', { name: 'Previous song' });
  const next = page.getByRole('button', { name: 'Next song' });
  await expect(previous).toBeDisabled();
  await next.press('Space');
  await expect(next).toBeFocused();
  await expect(page.getByTitle('Thunder lyric video from 7clouds')).toHaveAttribute('src', /embed\/GtEvysh1654\?/);
  await expect(page.locator('main iframe')).toHaveCount(1);
  await next.press('Enter');
  await next.press('Enter');
  await expect(next).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Radioactive', exact: true })).toBeFocused();
  await previous.press('Enter');
  await expect(page.getByTitle('Demons lyric video from 7clouds')).toHaveAttribute('src', /embed\/MA0aCUxItYA\?/);
  const demons = queue.getByRole('button', { name: 'Select Demons by Imagine Dragons' });
  await page.getByRole('button', { name: 'Close lyric video' }).press('Enter');
  await expect(demons).toBeFocused();
  await expect(demons).not.toHaveAttribute('aria-current', 'true');
  await expect(page.locator('main iframe')).toHaveCount(0);

  await page.getByRole('button', { name: 'Load playlist player' }).press('Enter');
  await expect(page.getByTitle('7clouds uploads playlist')).toBeVisible();
  await demons.press('Enter');
  await expect(page.getByTitle('7clouds uploads playlist')).toHaveCount(0);
  await expect(page.getByTitle('Demons lyric video from 7clouds')).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

test('old 7clouds channel bookmarks open the main playlist and retain the curated lyrics view', async ({ page }) => {
  await page.goto('/#music?lyrics=channels&channel=7cloudsRock');
  await expect(page.getByRole('heading', { name: '7clouds uploads' })).toBeVisible();
  await page.getByRole('button', { name: 'Load playlist player' }).click();
  await expect(page.getByTitle('7clouds uploads playlist')).toHaveAttribute('src', new RegExp(`list=${uploads}&`));
  await page.getByRole('link', { name: 'Watch lyrics', exact: true }).click();
  await expect(page.getByLabel('Lyric channel')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Lyric videos' })).toBeVisible();
  await expect(page.getByTitle('7clouds uploads playlist')).toHaveCount(0);
});
