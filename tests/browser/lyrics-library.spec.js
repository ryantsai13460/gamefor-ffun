import { expect, test } from '@playwright/test';
import { findLyricVideos } from '../../assets/lyrics-library.js';

const records = findLyricVideos('');
const lyric = records.find(track => track.kind === 'lyrics');
const visualizer = records.find(track => track.artist === 'C418' && track.kind === 'visualizer');
const thumbnail = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const button = (target, name) => target.getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort());
  await page.route('https://i.ytimg.com/**', route => route.fulfill({contentType: 'image/gif', body: thumbnail}));
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(frame, { events }) {
        requestAnimationFrame(() => {
          if (!frame.isConnected) return;
          events.onReady({target: this});
          events.onStateChange({data: 1});
        });
      }
      destroy() {}
    } };
  });
});

test('Music opens directly to sourced lyric videos and offers instrumental visualizers separately', async ({ page }) => {
  expect(new Set(records.map(track => track.id)).size).toBe(records.length);
  for (const track of records) {
    expect(track.visualSource).toMatch(/^https:\/\//);
    expect(track.thumbnail).toContain(`://i.ytimg.com/vi/${track.id}/`);
    expect(track.href).toBe(`#music?track=${track.id}`);
  }
  expect(findLyricVideos('Minecraft')).toContain(visualizer);
  expect(findLyricVideos('Green Day Wake Me Up When September Ends')).toHaveLength(0);

  await page.setViewportSize({width: 320, height: 780});
  await page.goto('/#music');
  const list = page.getByRole('list', {name: 'Music tracks'});
  await expect(page.getByText('Discover lyric videos by song, artist, or genre.')).toBeVisible();
  await expect(button(list, `Play ${lyric.title}`).locator('img')).toHaveAttribute('src', lyric.thumbnail);
  await expect(button(list, `Play ${visualizer.title}`)).toHaveCount(0);
  await expect(page.locator('main iframe')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await page.getByRole('searchbox', {name: 'Search music by title, artist, or style'}).fill('Minecraft');
  await expect(list).toBeHidden();
  await button(page, 'Show matching instrumentals').press('Enter');
  await expect(button(page, 'Instrumental visualizers')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', {name: 'Search music by title, artist, or style'})).toHaveValue('Minecraft');
  await expect(button(page, 'Show matching instrumentals')).toBeHidden();
  await expect(button(list, `Play ${lyric.title}`)).toHaveCount(0);
  await expect(button(list, `Play ${visualizer.title}`)).toBeVisible();
  await page.goto(`/${visualizer.href}`);
  const player = page.getByRole('dialog', { name: visualizer.title, exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', new RegExp(`youtube-nocookie\\.com/embed/${visualizer.id}`));
  await expect(player.getByText(`${visualizer.artist} · Instrumental visualizer`, {exact: true})).toBeVisible();
  await expect(player.getByRole('link', {name: 'Watch on YouTube', exact: true})).toHaveAttribute('href', `https://www.youtube.com/watch?v=${visualizer.id}`);
});

test('lyric favorites, playlists, recent playback and fullscreen work apart from the old music archive', async ({ page }) => {
  await page.goto('/#music?lyrics=watch');
  const list = page.getByRole('list', { name: 'Music tracks' });
  await page.getByRole('searchbox', { name: 'Search music by title, artist, or style' }).fill(lyric.title);
  await button(list, `Save ${lyric.title}`).press('Enter');
  await button(list, `Add ${lyric.title} to playlist`).press('Enter');
  const editor = page.getByRole('dialog', { name: 'Add to playlist', exact: true });
  await editor.getByRole('textbox', {name: 'Playlist name'}).fill('Lyrics study');
  await button(editor, 'Add track').click();
  await expect(page.getByText('Added to Lyrics study.', {exact: true})).toBeVisible();

  await page.goto('/#music?collection=playlists');
  await expect(page.getByRole('combobox', {name: 'Select a saved playlist'}).locator('option:checked')).toHaveText('Lyrics study');
  await button(page, 'Play playlist').click();
  const player = page.getByRole('dialog', {name: lyric.title, exact: true});
  await expect(player.getByText('Playing on YouTube.', {exact: true})).toBeVisible();
  await button(player, 'Fullscreen').click();
  await expect(button(player, 'Exit fullscreen')).toBeVisible();
  await button(player, 'Exit fullscreen').click();
  await button(player, 'Close').click();
  await page.goto('/#music?collection=recent');
  await expect(button(list, `Play ${lyric.title}`)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await button(page, 'Clear playback history').click();
  await expect(page.getByText('Playback history cleared.')).toBeVisible();
  await expect(list).toBeHidden();
  await page.goto('/#music?collection=saved');
  await expect(button(list, `Remove ${lyric.title} from saved music`)).toBeVisible();

  await page.getByText('Music sources and archive', {exact: true}).click();
  await page.getByRole('link', {name: 'Music archive', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Music archive', exact: true})).toBeVisible();
  await expect(button(page, 'Play featured track, Hall of Fame')).toBeVisible();
  await button(page, 'Saved music').click();
  await expect(list).toBeHidden();
  await page.getByRole('link', {name: 'Chart lyrics', exact: true}).click();
  await expect(page.getByText('Showing 25 of 550 chart songs')).toBeVisible();
});

test('lyric discovery appends reviewed videos and opens a later official release', async ({ page }) => {
  const exact = findLyricVideos('Rolling Stones Ruby Tuesday')[0];
  const lyrics = records.filter(track => track.kind === 'lyrics');
  expect(exact).toMatchObject({id: 'ADtnUC_ctNk', title: 'Ruby Tuesday', artist: 'The Rolling Stones'});
  expect(lyrics.length).toBeGreaterThan(18);
  await page.goto('/#music');
  const list = page.getByRole('list', {name: 'Music tracks'});
  await expect(list.getByRole('listitem')).toHaveCount(18);
  await expect(button(list, `Play ${exact.title}`)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(list.getByRole('listitem')).toHaveCount(Math.min(36, lyrics.length));
  await button(list, `Play ${exact.title}`).click();
  const dialog = page.getByRole('dialog', {name: exact.title, exact: true});
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/ADtnUC_ctNk/);
  await expect(dialog.getByRole('link', {name: 'About the visuals'})).toHaveAttribute('href', exact.visualSource);
});

test('lyric playlists can be reordered with the keyboard and play the saved order', async ({ page }) => {
  const nextLyric = records.find(track => track.kind === 'lyrics' && track.id !== lyric.id);
  await page.setViewportSize({width: 320, height: 780});
  await page.goto('/#music');
  const list = page.getByRole('list', {name: 'Music tracks'});
  const editor = page.getByRole('dialog', {name: 'Add to playlist', exact: true});
  await button(list, `Add ${lyric.title} to playlist`).press('Enter');
  await editor.getByRole('textbox', {name: 'Playlist name'}).fill('Listening order');
  await button(editor, 'Add track').click();
  await button(list, `Add ${nextLyric.title} to playlist`).press('Enter');
  await button(editor, 'Add track').click();

  await page.goto('/#music?collection=playlists');
  await expect(button(list, `Move ${lyric.title} earlier`)).toBeDisabled();
  await button(list, `Move ${nextLyric.title} earlier`).press('Enter');
  await expect(page.getByText(`Moved ${nextLyric.title} to position 1.`, {exact: true})).toBeVisible();
  await expect(button(list, `Play ${nextLyric.title}`)).toBeFocused();
  await expect(button(list, `Move ${nextLyric.title} earlier`)).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await page.reload();
  const rows = list.getByRole('listitem');
  await expect(button(rows.first(), `Play ${nextLyric.title}`)).toBeVisible();
  await button(page, 'Play playlist').press('Enter');
  const firstPlayer = page.getByRole('dialog', {name: nextLyric.title, exact: true});
  await expect(firstPlayer.getByRole('link', {name: 'About the visuals'})).toHaveAttribute('href', nextLyric.visualSource);
  await button(firstPlayer, 'Next track').press('Enter');
  const secondPlayer = page.getByRole('dialog', {name: lyric.title, exact: true});
  await expect(secondPlayer).toBeVisible();
  await expect(button(secondPlayer, 'Next track')).toBeDisabled();
});
