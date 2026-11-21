import { expect, test } from '@playwright/test';
import { games } from '../../assets/catalog.js';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('the library searches across media and remembers the filtered route on game Back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
  const globalSearch = page.getByRole('searchbox', { name: 'Search the arcade' });
  await globalSearch.fill('Sintel');
  await globalSearch.press('Enter');
  await expect(page).toHaveURL(/#discover\?q=Sintel$/);
  const filters = page.getByRole('group', { name: 'Content type' });
  await filters.getByRole('button', { name: 'Movies' }).click();
  await expect(page.locator('.discovery-status')).toHaveText('Showing 1 of 1 results');
  const film = page.getByRole('link', { name: /Sintel/ }).first();
  await expect(film).toHaveAttribute('href', '#movies?film=sintel');
  await film.click();
  await expect(page.getByRole('heading', { name: 'Sintel', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Movies' })).toBeVisible();

  await page.goto('/#discover?q=Hall+of+Fame&type=music');
  await expect(page.getByRole('button', { name: 'Music', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const song = page.locator('.discovery-card').filter({ hasText: 'Hall of Fame' }).first();
  await expect(song).toHaveAttribute('href', '#music?view=videos&track=mk48xRzuNvA');
  await song.click();
  const player = page.getByRole('dialog', { name: 'Hall of Fame' });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/mk48xRzuNvA/);
  await player.getByRole('button', { name: 'Close', exact: true }).click();

  await page.goto('/#discover');
  const input = page.getByRole('searchbox', { name: 'Library query' });
  await input.fill('2048');
  await filters.getByRole('button', { name: 'Games' }).click();
  await input.press('Enter');
  const game = page.locator('.discovery-card').filter({ has: page.getByRole('heading', { name: '2048', exact: true }) });
  await game.click();
  await page.getByRole('button', { name: 'Add 2048 to favorites' }).click();
  await page.getByRole('link', { name: 'Back to browsing' }).click();
  await expect(input).toHaveValue('2048');
  await expect(filters.getByRole('button', { name: 'Games' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.getByText('Recent searches', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2048', exact: true }).click();
  await expect(input).toHaveValue('2048');

  await page.goto('/#library');
  await expect(page.getByRole('heading', { name: 'My library', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Favorite games', exact: true })).toBeVisible();
  await expect(page.locator('.discovery-card').filter({ hasText: '2048' })).toHaveAttribute('href', '#play/2048');
});

test('the mobile home shows lazy media shelves with the arcade links', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
  await expect(page.locator('.home-destinations').getByRole('link', { name: 'Proxy Gemini', exact: true })).toBeVisible();
  await page.locator('.home-media-shelves').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Featured films', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Music (chart )?picks/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gaming videos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('every game card points to its preserved catalog route', async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.game-grid')).toBeVisible();
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const entries = [];
  while (true) {
    entries.push(...await page.locator('.game-card .card-link').evaluateAll(cards => cards.map(card => ({
      id: decodeURIComponent(card.hash.split('/').at(-1)),
      title: card.querySelector('h3').textContent.trim()
    }))));
    if (await next.isDisabled()) break;
    await next.click();
  }
  expect(entries).toEqual(games.map(({ id, title }) => ({ id, title })));
});
