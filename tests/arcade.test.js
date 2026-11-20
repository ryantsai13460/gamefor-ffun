import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { games } from '../assets/catalog.js';
import { createLibrary, gameAvailability, normalize, queryLibrary, restorePreferences } from '../assets/library.js';
import { resolveBrowserAddress } from '../assets/browser.js';
import { parseYouTubeVideo } from '../assets/media.js';

const library = createLibrary(games);
const site = 'https://ryantsai13460.github.io/gamefor-ffun/#browse';

test('the two main sources reconcile to 548 games and three more are preserved', () => {
  assert.equal(games.length, 551);
  assert.equal(games.filter(({ collection }) => collection === 'github' || collection === 'base44-library').length, 548);
  assert.equal(games.filter(({ collection }) => collection === 'base44-home').length, 2);
  assert.equal(games.filter(({ collection }) => collection === 'history').length, 1);
  assert.equal(new Set(games.map(({ id }) => id)).size, games.length);
  assert.equal(new Set(games.map(({ title }) => normalize(title))).size, games.length);
  assert.equal([...library.categoryCounts.values()].reduce((sum, count) => sum + count, 0), games.length);
});

test('catalog records have distinct sources, correct status, and safe relative assets', async () => {
  const sources = new Set();
  const statusCounts = { local: 0, embed: 0, external: 0, unverified: 0 };
  for (const game of games) {
    assert.ok(game.id && game.title && game.category);
    for (const alias of game.aliases || []) assert.equal(library.byId.get(alias), game);
    const status = gameAvailability(game);
    statusCounts[status]++;
    for (const source of [game.url, game.embed, game.relatedUrl].filter(Boolean)) {
      const url = new URL(source);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    }
    if (game.url) {
      assert.ok(!sources.has(game.url), game.url);
      sources.add(game.url);
    }
    if (game.art) {
      assert.ok(game.artCredit);
      if (!game.art.startsWith('https://')) await readFile(new URL(game.art, new URL('../', import.meta.url)));
    }
    if (typeof game.local === 'string') await readFile(new URL(game.local, new URL('../', import.meta.url)));
  }
  assert.deepEqual(statusCounts, { local: 13, embed: 3, external: 533, unverified: 2 });
});

test('search spans titles, punctuated names, legacy aliases, categories and availability', () => {
  assert.ok(queryLibrary(library, { search: 'slither.io' }).some(({ title }) => title === 'Slither.io'));
  assert.ok(queryLibrary(library, { search: 'géômetry DASH' }).some(({ title }) => title === 'Geometry Dash'));
  assert.equal(queryLibrary(library, { search: 'retrobowl' })[0].title, 'Retro Bowl');
  assert.equal(queryLibrary(library, { search: 'missing-example-game-000001' }).length, 0);
  const localPuzzles = queryLibrary(library, { category: 'Puzzle', availability: 'local' });
  assert.ok(localPuzzles.length > 0);
  assert.ok(localPuzzles.every(game => game.category === 'Puzzle' && game.local));
  const racing = queryLibrary(library, { category: 'Racing', sort: 'name' });
  assert.ok(racing.length > 24);
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const alphabetical = queryLibrary(library, { sort: 'category' });
  assert.ok(alphabetical.every(({ category }, index) => index === 0 || collator.compare(category, alphabetical[index - 1].category) >= 0));
});

test('legacy preferences migrate IDs, discard malformed data and sort by actual local launches', () => {
  const old = { favorites: ['geometry-dash', 'extra-geometry-dash', 'missing'], recent: [{ id: 'snake' }, 'pong', 'pong'], compact: true, artwork: false };
  const prefs = restorePreferences({ ...old, launches: { snake: 2, pong: 1, fake: 500, '2048': -5 } }, library.byId);
  assert.deepEqual(prefs.favorites, ['extra-geometry-dash']);
  assert.deepEqual(prefs.recent, ['snake', 'pong']);
  assert.equal(prefs.compact, true);
  assert.equal(prefs.artwork, false);
  const ranked = queryLibrary(library, { sort: 'popularity', launches: prefs.launches });
  assert.deepEqual(ranked.slice(0, 2).map(game => game.id), ['snake', 'pong']);
});

test('Proxy Gemini resolves website previews, official embeds, local play and restricted destinations', () => {
  assert.equal(resolveBrowserAddress('catch-the-star.html', site).url, 'https://ryantsai13460.github.io/gamefor-ffun/catch-the-star.html');
  assert.equal(resolveBrowserAddress('wikipedia.org', site).embed, 'https://wikipedia.org/');
  assert.equal(resolveBrowserAddress('wikipedia.org', site).kind, 'website');
  assert.equal(resolveBrowserAddress('https://www.miniplay.com/game/snow-rider-3d', site).embed, 'https://www.miniplay.com/embed/snow-rider-3d');
  assert.equal(resolveBrowserAddress('https://www.miniplay.com/embed/unlisted-game', site).kind, 'website');
  assert.equal(resolveBrowserAddress('https://proxy-arcade-play.base44.app/browse/', site).kind, 'unavailable');
  assert.equal(resolveBrowserAddress('my next game', site).kind, 'search');
  assert.equal(resolveBrowserAddress('https://www.youtube.com/shorts/aqz-KE-bpKQ', site).embed, 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
  for (const input of ['javascript:alert(1)', 'http://example.com', 'https://127.0.0.1', 'https://username@example.com']) {
    assert.equal(resolveBrowserAddress(input, site), null);
  }
});

test('the media player accepts YouTube URLs and rejects lookalike hosts', () => {
  assert.ok(parseYouTubeVideo('https://www.youtube.com/shorts/aqz-KE-bpKQ'));
  assert.ok(parseYouTubeVideo('https://youtu.be/aqz-KE-bpKQ'));
  assert.equal(parseYouTubeVideo('https://youtube.com.example.org/watch?v=aqz-KE-bpKQ'), null);
});
