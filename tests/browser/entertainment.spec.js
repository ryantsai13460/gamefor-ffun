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

  await page.goto('/#discover?q=the+lakes&type=music');
  await expect(page.getByRole('button', { name: 'Music', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const song = page.locator('.discovery-card').filter({ hasText: 'the lakes' }).first();
  await expect(song).toHaveAttribute('href', '#music?track=tOHcAc3r2kw');
  await song.click();
  const player = page.getByRole('dialog', { name: 'the lakes' });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/tOHcAc3r2kw/);
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

test('library search matches a game address and keeps playback filters in its links', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/#discover?q=https%3A%2F%2Fterritorial.io%2F&type=games&play=embed');
  const cards = page.locator('.discovery-card');
  const player = page.getByRole('combobox', { name: 'Game player' });
  await expect(player).toHaveValue('embed');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('In-page player');
  await expect(cards.first()).toHaveAttribute('href', '#play/territorial');
  await player.selectOption('local');
  await expect(page.locator('.discovery-status')).toHaveText('No matching titles');
  await expect(page).toHaveURL(/&play=local$/);
  await page.reload();
  await expect(player).toHaveValue('local');

  await page.goto('/#discover?q=Sintel&type=movies&watch=embedded');
  await expect(page.getByRole('combobox', { name: 'Movie playback' })).toHaveValue('embedded');
  await expect(cards.first()).toHaveAttribute('href', '#movies?film=sintel');
  await expect(player).toBeHidden();

  await page.goto('/#discover?q=MrBeast&type=videos&format=shorts');
  await expect(page.getByRole('combobox', { name: 'Video format' })).toHaveValue('shorts');
  await expect(cards.first()).toHaveAttribute('href', /#youtube\?format=shorts&video=/);
  const destinations = await cards.evaluateAll(nodes => nodes.map(node => new URL(node.href).hash));
  expect(destinations.every(hash => hash.startsWith('#youtube?format=shorts&video='))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('Home can replay a recently opened built-in game in one tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/#play/terrace-workshop?start=1');
  const game = page.getByRole('group', { name: 'Terrace Workshop controls' });
  await expect(game).toBeVisible();
  await page.goto('/#home');
  const panel = page.locator('.home-play-panel');
  const playAgain = panel.getByRole('link', { name: /Terrace Workshop.*Play again/ });
  await expect(playAgain).toHaveAttribute('href', '#play/terrace-workshop?start=1');
  await expect(panel.getByRole('link', { name: 'Built-in only' })).toHaveAttribute('href', '#games?local=1');
  await playAgain.click();
  await expect(game).toBeVisible();
});

test('the mobile home shows lazy media shelves with the arcade links', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
  await expect(page.locator('.home-destinations').getByRole('link', { name: 'Proxy Gemini', exact: true })).toBeVisible();
  await page.locator('.home-media-shelves').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Featured films', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lyric video picks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gaming videos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('Home keeps media routes available when the catalogs fail', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route(/\/assets\/(film-catalog|lyrics-library|media|shorts-catalog)\.js(?:\?|$)/, route => route.abort());
  await page.goto('/');
  const media = page.locator('.home-media-shelves');
  await media.scrollIntoViewIfNeeded();
  await expect(media.getByText('Media picks could not load.')).toBeVisible();
  await expect(media.getByRole('link', { name: 'Movies' })).toHaveAttribute('href', '#movies');
  await expect(media.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', '#youtube');
  await expect(media.getByRole('link', { name: 'Music' })).toHaveAttribute('href', '#music');
  await expect(media.getByRole('link', { name: 'Short Videos' })).toHaveAttribute('href', '#shorts');
});

test('the Home shortcuts open the main sections and lead to an in-page game', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const shortcuts = page.getByRole('navigation', { name: 'Browse the arcade' });
  for (const [label, heading] of [
    ['Games', 'All Games'], ['Movies', 'Movies'], ['YouTube', 'YouTube'], ['Web Search', 'Web Search'],
    ['Music', 'Music'], ['Short Videos', 'Shorts'], ['Shopping', 'Shopping'], ['Community', 'Community']
  ]) {
    await page.goto('/#home');
    await shortcuts.getByRole('link', { name: new RegExp(`^${label}\\b`) }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1, exact: true })).toBeVisible();
  }

  await page.goto('/#home');
  await page.getByRole('link', { name: 'In-page games', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('in-page');
  await page.getByRole('searchbox', { name: 'Search games', exact: true }).fill('Clover Roll');
  await page.getByRole('link', { name: /^Clover Roll/ }).click();
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Clover Roll controls' })).toBeVisible();
  await expect(page.locator('.player-status')).toHaveText('Built-in game ready.');
});

test('Home spotlight opens Lantern Shift and uses the chosen category for recommendations', async ({ page }) => {
  await page.goto('/#home');
  const choices = page.getByRole('group', { name: 'Featured games' });
  const lantern = choices.getByRole('button', { name: 'Lantern Shift' });
  await lantern.press('Enter');
  await expect(lantern).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Lantern Shift', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Play game', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Lantern Shift controls' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to browsing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();

  await page.goto('/#settings');
  await page.getByRole('combobox', { name: 'Recommended game category' }).selectOption('Puzzle');
  await page.goto('/#home');
  const picks = page.getByRole('heading', { name: 'Your picks in Puzzle' });
  await expect(picks).toBeVisible();
  await expect(page.getByRole('link', { name: 'More picks', exact: true })).toHaveAttribute('href', '#games?category=Puzzle&option=in-page');
  await page.goto('/#settings');
  await page.getByRole('checkbox', { name: 'Picks in your chosen category' }).uncheck();
  await page.goto('/#home');
  await expect(picks).toHaveCount(0);
});

test('the racing shelf and a copied link open the official Drift Track player inside the arcade', async ({ page }) => {
  const player = 'https://360playzone.com/game/drift-track';
  await page.unrouteAll();
  await page.route('https://**/*', route => route.request().url() === player
    ? route.fulfill({ contentType: 'text/html', body: '<title>Drift Track</title><button>Start race</button>' })
    : route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'In-page racing', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'All playable racers' }).click();
  await expect(page.getByRole('combobox', { name: 'Category' })).toHaveValue('Racing');
  await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('in-page');
  await page.getByRole('link', { name: /^Drift Track Racing/ }).click();
  await expect(page.getByRole('link', { name: 'Game from 360 PlayZone' })).toHaveAttribute('href', 'https://360playzone.com/play/drift-track');
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  const frame = page.getByTitle('Drift Track', { exact: true });
  await expect(frame).toHaveAttribute('src', player);
  await expect(frame.contentFrame().getByRole('button', { name: 'Start race' })).toBeVisible();
  await expect(page).toHaveURL(/#play\/playzone-drift-track$/);
  expect(page.context().pages()).toHaveLength(1);
  await page.goto('/#play/playzone-drift-track?start=1');
  await expect(frame.contentFrame().getByRole('button', { name: 'Start race' })).toBeVisible();
});

test('Home shelves and background controls reflow at 200% text size on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const [route, title] of [['home', 'Pocket Circuit'], ['settings?panel=background', 'Settings']]) {
    await page.goto('/#' + route);
    await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      return document.documentElement.scrollWidth;
    });
    expect(overflow).toBe(320);
  }
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
    await next.press('Enter');
  }
  expect(entries).toEqual(games.map(({ id, title }) => ({ id, title })));
});
