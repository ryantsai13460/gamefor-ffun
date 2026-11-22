import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { games } from '../assets/catalog.js';
import { createLibrary, gameAvailability, normalize, queryLibrary, restorePreferences } from '../assets/library.js';
import { resolveBrowserAddress } from '../assets/browser.js';
import { arcadeEmbed } from '../assets/embedded-content.js';
import { findCuratedVideos, getVideoCollections, parseYouTubeVideo } from '../assets/media.js';
import { expansionVideos } from '../assets/media-expansion.js';
import { discoveryVideos } from '../assets/media-discovery-videos.js';
import { entertainmentVideos } from '../assets/media-entertainment-videos.js';
import { familyVideos } from '../assets/media-family-videos.js';
import { learningVideos } from '../assets/media-learning-videos.js';
import { featuredFilm, filmCatalog } from '../assets/film-catalog.js';
import { learningFilms } from '../assets/film-learning.js';
import { filmPlayback } from '../assets/film-playback.js';
import { featuredTrack, musicCatalog } from '../assets/music-catalog.js';

const library = createLibrary(games);
const site = 'https://ryantsai13460.github.io/gamefor-ffun/#browse';

test('the video expansions preserve the library and use unique official player IDs', () => {
  const library = getVideoCollections();
  assert.equal(library.count, 1560);
  assert.equal(library.added, 749);
  assert.equal(expansionVideos.length, 500);
  assert.equal(expansionVideos.filter(({ short }) => short).length, 250);
  assert.equal(discoveryVideos.length, 100);
  assert.equal(discoveryVideos.filter(({ short }) => short).length, 50);
  assert.equal(entertainmentVideos.length, 100);
  assert.equal(entertainmentVideos.filter(({ short }) => short).length, 51);
  assert.equal(familyVideos.length, 58);
  assert.equal(familyVideos.filter(({ short }) => short).length, 29);
  assert.equal(learningVideos.length, 149);
  assert.equal(learningVideos.filter(({ short }) => short).length, 57);
  for (const video of [...expansionVideos, ...discoveryVideos, ...entertainmentVideos, ...familyVideos, ...learningVideos]) {
    assert.match(video.id, /^[A-Za-z0-9_-]{11}$/);
    assert.ok(video.title && video.creator && video.tags.length);
    const thumbnail = new URL(video.thumbnail);
    assert.equal(thumbnail.origin, 'https://i.ytimg.com');
    assert.ok(thumbnail.pathname.startsWith(`/vi/${video.id}/`));
    assert.equal(findCuratedVideos(video.id)[0], video);
  }
  assert.equal(library.topics.filter(({ count }) => count > 0).length, 10);
});

test('official family gaming uploads are discoverable in their verified video formats', () => {
  const examples = [
    ['uy4ODVT6-fk', 'Minecraft', true],
    ['u2in2iTZnl0', 'Roblox', false],
    ['p-e1qxdWufA', 'Brawl Stars', true]
  ];
  for (const [id, creator, short] of examples) {
    const video = familyVideos.find(video => video.id === id);
    assert.equal(video.creator, creator);
    assert.equal(video.short, short);
    assert.ok(video.tags.includes('Gaming') && video.tags.includes('Family'));
    assert.equal(video.provenance, `https://www.youtube.com/${short ? 'shorts/' : 'watch?v='}${id}`);
    assert.equal(findCuratedVideos(id)[0], video);
  }
});

test('MrBeast creator searches find official full videos and Shorts across name variants', () => {
  const official = familyVideos.filter(({ creator }) => creator === 'MrBeast');
  assert.equal(official.filter(({ short }) => !short).length, 7);
  assert.equal(official.filter(({ short }) => short).length, 12);
  for (const query of ['MrBeast', 'Mr.Beast', 'Mr Beast', '@MrBeast']) {
    assert.deepEqual(new Set(findCuratedVideos(query)), new Set(official));
    assert.deepEqual(new Set(findCuratedVideos(`${query} full videos`)), new Set(official.filter(({ short }) => !short)));
    assert.deepEqual(new Set(findCuratedVideos(`${query} shorts`)), new Set(official.filter(({ short }) => short)));
  }
});

test('the cinema catalog separates complete films from trailers and uses legitimate playback routes', () => {
  assert.equal(new Set(filmCatalog.map(({ id }) => id)).size, filmCatalog.length);
  assert.ok(learningFilms.length >= 91);
  assert.ok(learningFilms.filter(({ format }) => format === 'feature').length >= 38);
  assert.ok(learningFilms.every(film => filmPlayback(film) && !filmPlayback(film, true) && new URL(film.art).protocol === 'https:'));
  assert.ok(filmCatalog.filter(film => !film.regionLimited && filmPlayback(film)).length >= 100);
  assert.equal(filmCatalog.filter(film => !filmPlayback(film) && filmPlayback(film, true)).length, 12);
  assert.ok(filmCatalog.some(film => film.format === 'feature' && film.runtimeMinutes >= 40 && filmPlayback(film)));
  assert.ok(filmCatalog.some(film => film.format === 'short' && film.runtimeMinutes > 0 && filmPlayback(film)));
  assert.ok(featuredFilm.fullVideo);
  for (const film of filmCatalog) {
    assert.ok(film.title && film.credit && film.genres.length);
    assert.equal(new URL(film.source).protocol, 'https:');
    assert.ok(filmPlayback(film, true) || filmPlayback(film), film.id);
    if (film.fullWatch) assert.equal(new URL(film.fullWatch).protocol, 'https:');
    for (const id of [film.trailer, film.fullVideo].filter(Boolean)) {
      assert.match(id, /^[A-Za-z0-9_-]{11}$/);
    }
    if (film.embed) {
      const embed = new URL(film.embed);
      if (embed.origin === 'https://player.vimeo.com') {
        assert.match(embed.pathname, /^\/video\/[1-9]\d*$/);
        assert.equal(filmPlayback(film)?.provider, 'Vimeo');
      } else {
        assert.equal(embed.origin, 'https://www.nfb.ca');
        assert.ok(embed.pathname.endsWith('/embed/player/'));
      }
    }
  }
});

test('filmmaker Vimeo embeds require a matching public watch URL', () => {
  const film = {
    embed: 'https://player.vimeo.com/video/152985022?app_id=122963',
    fullWatch: 'https://vimeo.com/152985022'
  };
  assert.deepEqual(filmPlayback(film), {
    provider: 'Vimeo',
    external: film.fullWatch,
    embed: 'https://player.vimeo.com/video/152985022?app_id=122963&dnt=1'
  });
  assert.equal(filmPlayback({ ...film, fullWatch: 'https://vimeo.com/194276412' })?.embed, undefined);
  assert.equal(filmPlayback({ ...film, embed: 'https://player.vimeo.com/video/152985022?h=private' })?.embed, undefined);
  assert.equal(filmPlayback({ ...film, embed: 'https://player.vimeo.com.example.org/video/152985022' })?.embed, undefined);
});

test('the expanded music catalog has unique provider IDs and attributable chart ranks', () => {
  assert.ok(musicCatalog.length >= 300);
  assert.equal(new Set(musicCatalog.map(({ id }) => id)).size, musicCatalog.length);
  assert.equal(featuredTrack.title, 'Hall of Fame');
  for (const track of musicCatalog) {
    assert.match(track.id, /^[A-Za-z0-9_-]{11}$/);
    assert.ok(track.title && track.artist && track.category && track.channel);
    const artwork = new URL(track.thumbnail);
    assert.equal(artwork.hostname, 'i.ytimg.com');
    assert.ok(artwork.pathname.startsWith(`/vi/${track.id}/`));
    assert.equal(new URL(track.channelUrl).hostname, 'www.youtube.com');
    if (track.chart) {
      assert.ok(Number.isInteger(track.chart.rank) && track.chart.rank > 0);
      assert.match(track.chart.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(track.chart.source && track.chart.market);
      assert.equal(new URL(track.chart.url).protocol, 'https:');
    }
  }
});

test('expiring family film offers preserve their records and only advertise active viewing windows', () => {
  const bear = filmCatalog.find(film => film.id === 'little-bear-movie');
  assert.ok(bear.genres.includes('Family'));
  assert.equal(bear.format, 'feature');
  assert.equal(bear.rating, 'G');
  assert.deepEqual(filmPlayback(bear), {
    provider: 'Tubi', external: 'https://tubitv.com/movies/274712/little-bear-movie'
  });
  assert.equal(filmPlayback({ ...bear, availableUntil: '2000-01-01T00:00:00Z' }), null);
  assert.equal(filmPlayback({ ...bear, availableUntil: '2000-01-01T00:00:00Z', trailer: 'wJO_vIDZn-I' }, true).id, 'wJO_vIDZn-I');
});

test('the catalog preserves the earlier library and exposes at least 1,000 distinct in-page titles', () => {
  assert.ok(games.filter(game => ['local', 'embed'].includes(gameAvailability(game))).length >= 1000);
  assert.equal(games.filter(({ collection }) => collection === 'github' || collection === 'base44-library').length, 548);
  assert.equal(games.filter(({ collection }) => collection === 'base44-home').length, 2);
  assert.equal(games.filter(({ collection }) => collection === 'history').length, 1);
  assert.equal(games.filter(({ collection }) => collection === 'original').length, 14);
  assert.equal(new Set(games.map(({ id }) => id)).size, games.length);
  assert.equal(new Set(games.map(({ title }) => normalize(title))).size, games.length);
  assert.equal([...library.categoryCounts.values()].reduce((sum, count) => sum + count, 0), games.length);
});

test('catalog records have distinct sources, correct status, and safe relative assets', async () => {
  const sources = new Set();
  const players = new Set();
  const statusCounts = { local: 0, embed: 0, external: 0, unverified: 0 };
  for (const game of games) {
    assert.ok(game.id && game.title && game.category);
    for (const alias of game.aliases || []) assert.equal(library.byId.get(alias), game);
    for (const id of game.playAlternatives || []) {
      const alternative = library.byId.get(id);
      assert.ok(alternative && alternative !== game && (alternative.local || arcadeEmbed(alternative)), id);
    }
    const status = gameAvailability(game);
    statusCounts[status]++;
    for (const source of [game.url, game.embed, game.embedUrl, game.demo, game.relatedUrl, ...(game.legacyUrls || [])].filter(Boolean)) {
      const url = new URL(source);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    }
    if (game.url) {
      assert.ok(!sources.has(game.url), game.url);
      sources.add(game.url);
    }
    const player = arcadeEmbed(game);
    if (player) {
      assert.ok(!players.has(player), player);
      assert.equal(game.status, 'embed');
      players.add(player);
    }
    if (game.art) {
      assert.ok(game.artCredit);
      if (!game.art.startsWith('https://')) await readFile(new URL(game.art, new URL('../', import.meta.url)));
    }
    if (typeof game.local === 'string') await readFile(new URL(game.local, new URL('../', import.meta.url)));
  }
  assert.equal(statusCounts.local, 27);
  assert.ok(statusCounts.embed >= 975);
  assert.equal(statusCounts.external, 523);
  assert.equal(statusCounts.unverified, 3);
});

test('the independent games use their exact publisher-approved player URLs and credits', () => {
  const approved = [
    ['afternoon-wordsash', 'https://afternoongames.com/embed/word-sash', 'https://afternoongames.com/free-games-for-your-website', true],
    ['afternoon-killer-sudoku', 'https://afternoongames.com/embed/killer-sudoku', 'https://afternoongames.com/free-games-for-your-website', true],
    ['s7gs-pings-portal', 'https://s7gs.com/Play/pings-portal.html', 'https://s7gs.com/Play/', false],
    ['s7gs-breachfield', 'https://s7gs.com/Play/breachfield.html', 'https://s7gs.com/Play/', false],
    ['s7gs-bat-hunt', 'https://s7gs.com/Play/bat-hunt.html', 'https://s7gs.com/Play/', false],
    ...['kakuro', 'canasta', 'yukon-solitaire'].map(slug => [
      `afternoon-${slug}`, `https://afternoongames.com/embed/${slug}`, 'https://afternoongames.com/free-games-for-your-website', true
    ]),
    ...['pier-putt', 'atlas-dash', 'sum-rocket', 'wordloom', 'planet-dash', 'wandoku', 'gembay', 'boxwood'].map(slug => [
      `yuzool-${slug}`, `https://www.yuzool.com/${slug}/?embed=1`, 'https://www.yuzool.com/embed/', true
    ])
  ];
  for (const [id, embed, source, attribution] of approved) {
    const game = library.byId.get(id);
    assert.equal(gameAvailability(game), 'embed', id);
    assert.equal(arcadeEmbed(game), embed);
    assert.equal(game.source, source);
    assert.equal(Boolean(game.attribution), attribution);
    assert.ok(game.creator && game.isNew);
  }
});

test('the new games keep distinct titles and expand searchable genres', () => {
  for (const id of ['yuzool-atlas-dash', 'yuzool-sum-rocket', 'yuzool-planet-dash']) {
    assert.ok(queryLibrary(library, { category: 'Learning', availability: 'in-page' }).some(game => game.id === id));
  }
  assert.equal(library.byId.get('s7gs-bat-hunt').category, 'Action');
  assert.equal(library.byId.get('yuzool-boxwood').category, 'Strategy');
  assert.equal(library.byId.get('tapamine-rally').category, 'Arcade');
  assert.equal(library.byId.get('tapamine-kart').category, 'Racing');
  for (const slug of ['rally', 'vault', 'ski', 'skate', 'kart']) {
    const game = library.byId.get(`tapamine-${slug}`);
    assert.equal(arcadeEmbed(game), `https://tapamine.com/embed/${slug}/`);
    assert.equal(game.attribution, true);
  }
  const trimps = library.byId.get('trimps');
  assert.equal(arcadeEmbed(trimps), 'https://trimps.github.io/');
  assert.equal(trimps.license, 'GPL-2.0');
  assert.equal(trimps.licenseUrl, 'https://github.com/Trimps/Trimps.github.io/blob/master/license.txt');
});

test('publisher destinations preserve recovered game identities and identify the closed Spinz.io service', () => {
  const replacements = [
    ['eggy', 'https://eggycarofficial.com/', 'Beedo Games'],
    ['idlebreakout', 'https://kodiqi.itch.io/idle-breakout', 'Kodiqi'],
    ['subway', 'https://poki.com/en/g/subway-surfers', 'SYBO'],
    ['suika-game', 'https://suikagame.jp/', 'Aladdin X']
  ];
  for (const [id, url, artCredit] of replacements) {
    const game = library.byId.get(id);
    assert.equal(gameAvailability(game), 'external', id);
    assert.equal(game.url, url);
    assert.equal(game.artCredit, artCredit);
  }
  const spinz = library.byId.get('spinz-io');
  assert.equal(library.byId.get('6afe6f480567ca2910243b29'), spinz);
  assert.equal(gameAvailability(spinz), 'unverified');
  assert.equal(spinz.relatedUrl, 'https://spinz.io/');
  assert.match(spinz.relatedLabel, /closure notice/i);
});

test('the promoted games retain their catalog identities and use official in-page players', () => {
  const ovo = library.byId.get('ovo');
  assert.equal(ovo.creator, 'Dedra Games');
  assert.equal(arcadeEmbed(ovo), 'https://www.crazygames.com/embed/ovo');
  assert.equal(arcadeEmbed(library.byId.get('slope')), 'https://y8.com/embed/slope');
  assert.equal(arcadeEmbed(library.byId.get('drivemad')), 'https://play.fancade.com/5F084A0BCE06B710?max_w=2800&max_h=2800');
  assert.equal(arcadeEmbed(library.byId.get('pack150-longcat')), 'https://play.fancade.com/5BFC1C2A246D67DD?max_w=2800&max_h=2800');
  assert.equal(resolveBrowserAddress('https://poki.com/en/g/drive-mad?ref=bookmark', site).embed, arcadeEmbed(library.byId.get('drivemad')));
  assert.equal(queryLibrary(library, { availability: 'in-page', search: 'OvO' })[0], ovo);
  for (const address of [ovo.url, ovo.embed, 'https://www.coolmathgames.com/0-ovo?ref=bookmark']) {
    const destination = resolveBrowserAddress(address, site);
    assert.equal(destination.kind, 'game');
    assert.equal(destination.embed, ovo.embed);
    assert.equal(destination.gamepadAllow, 'gamepad https://games.crazygames.com https://ovo.game-files.crazygames.com');
  }
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
  assert.equal(resolveBrowserAddress('https://support.miniclip.com/hc/en-us/articles/360019766978-Blash-io', site).kind, 'website');
  assert.equal(resolveBrowserAddress('https://www.miniplay.com/game/snow-rider-3d', site).title, 'Snow Rider 3D');
  for (const input of [
    'https://www.miniplay.com/embed/unlisted-game', 'https://www.coolmathgames.com/0-eggy-car/?ref=fixture',
    'poki.com/en/g/unlisted-game', 'https://voodoo.io/paper2'
  ]) {
    const destination = resolveBrowserAddress(input, site);
    assert.equal(destination.kind, 'external-game');
    assert.equal(destination.embed, undefined);
    assert.equal(destination.url, undefined);
  }
  assert.equal(resolveBrowserAddress('https://play.fancade.com/5BEC8352E4E078B1', site).kind, 'game');
  assert.equal(resolveBrowserAddress('https://territorial.io/', site).kind, 'game');
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
