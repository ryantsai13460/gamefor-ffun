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
