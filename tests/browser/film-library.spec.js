import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('film details preserve browse filters and distinguish full features from trailers', async ({ page }) => {
  await page.goto('/#movies?collection=features&sort=oldest-year');
  const filters = page.getByRole('group', { name: 'Film collections' });
  const query = page.getByRole('searchbox', { name: 'Search films' });
  const genre = page.getByRole('combobox', { name: 'Film genre' });
  await expect(filters.getByRole('button', { name: 'Feature films', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await genre.selectOption('Comedy');
  await query.fill('The General');
  await page.getByRole('link', { name: 'Open The General film page', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'The General', level: 1 })).toBeVisible();
  await expect(page.locator('.film-detail-information')).toContainText('Full feature film');
  await expect(page.locator('.film-details-meta')).toContainText('76 min');
  const player = page.locator('.film-detail-play');
  await expect(player.getByRole('link', { name: 'Watch Full Movie', exact: true })).toHaveAttribute(
    'href', 'https://commons.wikimedia.org/wiki/File:The_General_(1926).webm'
  );
  await expect(player.locator('iframe')).toHaveCount(0);
  await player.getByRole('button', { name: 'Add The General to watchlist', exact: true }).click();

  await page.getByRole('link', { name: 'Back to Movies', exact: true }).click();
  await expect(query).toHaveValue('The General');
  await expect(genre).toHaveValue('Comedy');
  await expect(page.getByRole('combobox', { name: 'Sort films' })).toHaveValue('oldest-year');
  await filters.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open The General film page', exact: true })).toBeVisible();

  await page.goto('/#movies?film=a-minecraft-movie');
  await expect(page.getByRole('heading', { name: 'A Minecraft Movie', level: 1 })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Watch trailer', exact: true })).toBeVisible();
  await expect(player.getByRole('link', { name: 'Watch Full Movie', exact: true })).toHaveCount(0);
  await expect(player).toContainText('A verified full-film source is unavailable.');
});

test('Family films leads with complete features and keeps regional provider links honest', async ({ page }) => {
  await page.goto('/#movies?collection=family');
  const collections = page.getByRole('group', { name: 'Film collections' });
  const query = page.getByRole('searchbox', { name: 'Search films' });
  await expect(collections.getByRole('button', { name: 'Family films', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.film-card .film-type').first()).toHaveText('Full feature film');

  await query.fill('Minecraft');
  await expect(page.getByText('No films match your search.')).toBeVisible();
  await query.fill('Little Bear Movie');
  await page.getByRole('link', { name: 'Open Little Bear Movie film page' }).click();
  const player = page.locator('.film-detail-play');
  await expect(page.locator('.film-details-meta')).toContainText('75 min');
  await expect(page.getByText('Availability varies by region.')).toBeVisible();
  await expect(player.getByRole('link', { name: 'Watch Full Movie' })).toHaveAttribute(
    'href', 'https://tubitv.com/movies/274712/little-bear-movie'
  );
  await expect(player.locator('iframe')).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to Movies', exact: true }).click();
  await expect(collections.getByRole('button', { name: 'Family films', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(query).toHaveValue('Little Bear Movie');
  await query.fill('The Tooth');
  await page.getByRole('link', { name: 'Open The Tooth film page' }).click();
  await player.getByRole('button', { name: 'Play full short', exact: true }).click();
  await expect(player.locator('iframe')).toHaveAttribute('src', 'https://www.nfb.ca/film/tooth/embed/player/');
});

test('runtime filters handle catalog minutes, legacy durations, and missing runtimes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/#movies?collection=all&page=4');
  const query = page.getByRole('searchbox', { name: 'Search films' });
  const runtime = page.getByRole('combobox', { name: 'Film runtime' });
  const pagination = page.getByRole('navigation', { name: 'Film pages' });
  await expect(pagination).toContainText('Page 4 of');
  await runtime.selectOption('under-20');
  await expect(pagination).toContainText('Page 1 of');
  await query.fill('The Daily Dweebs');
  await expect(page.getByRole('link', { name: 'Open The Daily Dweebs film page' })).toContainText('50 sec');
  await runtime.selectOption('20-59');
  await expect(page.getByText('No films match your search.')).toBeVisible();
  await query.fill('Paddle to the Sea');
  await expect(page.getByRole('link', { name: 'Open Paddle to the Sea film page' })).toContainText('27 min');
  await query.fill('Carnival of the Animals');
  await expect(page.getByRole('link', { name: 'Open Carnival of the Animals film page' })).toContainText('Half-hour special');
  await runtime.selectOption('60-plus');
  await query.fill('The General');
  await expect(page.getByRole('link', { name: 'Open The General film page' })).toContainText('76 min');
  await runtime.selectOption('unknown');
  await query.fill('A Minecraft Movie');
  await expect(page.getByRole('link', { name: 'Open A Minecraft Movie film page' })).toBeVisible();
});

test('full-film playback and runtime selections survive details and both Back controls', async ({ page }) => {
  await page.goto('/#movies?collection=all&runtime=under-20&playback=in-page&sort=title');
  const query = page.getByRole('searchbox', { name: 'Search films' });
  const runtime = page.getByRole('combobox', { name: 'Film runtime' });
  const playback = page.getByRole('combobox', { name: 'Full-film playback' });
  const details = page.getByRole('link', { name: 'Open Sintel film page', exact: true });
  const back = page.getByRole('link', { name: 'Back to Movies', exact: true });
  await expect(runtime).toHaveValue('under-20');
  await expect(playback).toHaveValue('in-page');
  await query.fill('Sintel');
  await details.click();
  await expect(back).toHaveAttribute('href', '#movies?collection=all&q=Sintel&runtime=under-20&playback=in-page&sort=title');
  await expect(page.locator('.film-detail-play').getByRole('button', { name: 'Play full short' })).toBeVisible();
  await page.goBack();
  await expect(query).toHaveValue('Sintel');
  await expect(runtime).toHaveValue('under-20');
  await expect(playback).toHaveValue('in-page');
  await details.click();
  await back.click();
  await expect(query).toHaveValue('Sintel');
  await expect(runtime).toHaveValue('under-20');
  await expect(playback).toHaveValue('in-page');

  await runtime.selectOption('');
  await playback.selectOption('provider');
  await query.fill('The General');
  const provider = page.getByRole('link', { name: 'Watch Full Movie', exact: true });
  await expect(provider).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:The_General_(1926).webm');
  await playback.selectOption('in-page');
  await expect(provider).toHaveCount(0);
  await expect(page.getByText('No films match your search.')).toBeVisible();
});

test('invalid movie filter values drop from detail links and leave default discovery intact', async ({ page }) => {
  await page.goto('/#movies?film=sintel&runtime=anywhere&playback=embed-all');
  const back = page.getByRole('link', { name: 'Back to Movies', exact: true });
  const playback = page.getByRole('combobox', { name: 'Full-film playback' });
  await expect(back).toHaveAttribute('href', '#movies');
  await back.click();
  await expect(page.getByRole('button', { name: 'Play featured film', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Film runtime' })).toHaveValue('');
  await expect(playback).toHaveValue('');
  const detail = page.getByRole('link', { name: 'Open A Minecraft Movie film page', exact: true });
  await page.getByRole('searchbox', { name: 'Search films' }).fill('A Minecraft Movie');
  await expect(detail).toBeVisible();
  await playback.selectOption('full');
  await expect(detail).toHaveCount(0);
  await expect(page.getByText('No films match your search.')).toBeVisible();
});

test('YouTube film progress starts on playback and resumes with working fullscreen controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.route('https://www.youtube-nocookie.com/embed/eRsGyueVLvQ?*', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Film player fixture</title>'
  }));
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.YT = { Player: function(_frame, { events }) {
      let position = 0;
      this.getCurrentTime = () => position;
      this.getDuration = () => 900;
      window.playFilmFixture = seconds => {
        position = seconds;
        events.onStateChange({ data: 1 });
      };
      this.destroy = () => { delete window.playFilmFixture; };
      queueMicrotask(() => events.onReady({}));
    } };`
  }));

  const player = page.locator('.film-detail-play');
  const play = player.getByRole('button', { name: 'Play full short', exact: true });
  const ready = player.getByText('YouTube player ready. Use its Play control to begin.', { exact: true });
  const back = page.getByRole('link', { name: 'Back to Movies', exact: true });
  const continuing = page.getByRole('group', { name: 'Film collections' })
    .getByRole('button', { name: 'Continue watching', exact: true });

  await page.goto('/#movies?film=sintel');
  await play.click();
  await expect(ready).toBeVisible();
  await back.click();
  await continuing.click();
  await expect(page.getByText('Films with saved playback progress appear here.', { exact: true })).toBeVisible();

  await page.goto('/#movies?film=sintel');
  await play.click();
  await expect(ready).toBeVisible();
  await player.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  const fullscreen = player.locator('.film-player-content:fullscreen');
  await expect(fullscreen).toBeVisible();
  await fullscreen.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(fullscreen).toHaveCount(0);
  await page.evaluate(() => window.playFilmFixture(27.9));
  await expect(player.getByText('Playing on YouTube.', { exact: true })).toBeVisible();
  await back.click();
  await continuing.click();
  await page.getByRole('link', { name: 'Open Sintel film page', exact: true }).click();
  await player.getByRole('button', { name: 'Continue at 0:27', exact: true }).click();
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/eRsGyueVLvQ\?.*[?&]start=27(?:&|$)/);
});
