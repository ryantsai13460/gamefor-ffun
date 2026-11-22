import { arcadeEmbed } from './embedded-content.js';
import { arcadeModes } from './arcade-modes.js';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export const discoverySearchHistoryKey = 'ffun.discovery.history';
export const browserBrowsingStorageKey = 'gamefor-ffun-proxy-v1';
export const defaultProfileName = 'user_12345';

export function validateProfileName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return /^[a-z\d][a-z\d_-]{2,23}$/i.test(name) ? name : '';
}

export const themeOptions = [
  ['midnight', 'Midnight'],
  ['graphite', 'Graphite'],
  ['ocean', 'Ocean'],
  ['pine', 'Pine'],
  ['violet', 'Violet'],
  ['ember', 'Ember'],
  ['lagoon', 'Lagoon'],
  ['berry', 'Berry'],
  ['cobalt', 'Cobalt'],
  ['dune', 'Dune']
];

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

const isPlatformer = game => game.category === 'Platformer' || game.category === 'Parkour';
const hasPlatformerTag = (game, tag) => game.platformerTags?.includes(tag) === true;

export const platformerCollections = Object.freeze([
  { id: 'like-ovo', title: 'Games Like OvO', description: 'Precision jumps, wall climbs, obstacle courses, and timed runs.',
    matches: game => isPlatformer(game) && Boolean(game.platformerTags?.length) },
  { id: 'platformers', title: 'Platformers', description: 'Jump through action, exploration, and puzzle games.', matches: isPlatformer },
  { id: 'speedrun', title: 'Speedrun Games', description: 'Improve your time in games with timed runs or quick restarts.',
    matches: game => hasPlatformerTag(game, 'speedrun') },
  { id: 'parkour', title: 'Parkour Games', description: 'Cross gaps, climb walls, and clear obstacle courses.',
    matches: game => game.category === 'Parkour' || hasPlatformerTag(game, 'parkour') },
  { id: 'puzzle-platformers', title: 'Puzzle Platformers', description: 'Solve switches, traps, and platform puzzles as you move.',
    matches: game => hasPlatformerTag(game, 'puzzle') },
  { id: 'hard-platformers', title: 'Hard Platformers', description: 'Practice precise timing and demanding movement.',
    matches: game => hasPlatformerTag(game, 'hard') }
]);

export function createLibrary(games) {
  const byId = new Map();
  const categoryCounts = new Map();
  const searchTerms = new Map();
  const availabilityById = new Map();
  for (const game of games) {
    byId.set(game.id, game);
    categoryCounts.set(game.category, (categoryCounts.get(game.category) || 0) + 1);
    searchTerms.set(game.id, normalize([game.title, game.category, game.id, ...(game.aliases || []), ...(game.platformerTags || []),
      isPlatformer(game) ? 'platformer' : ''].join(' ')));
    availabilityById.set(game.id, gameAvailability(game));
  }
  for (const game of games) {
    for (const alias of game.aliases || []) {
      if (!byId.has(alias)) byId.set(alias, game);
    }
  }
  return { games, byId, categoryCounts, searchTerms, availabilityById };
}

export function queryLibrary(library, settings) {
  const { source = library.games, search = '', category = '', availability = '', sort = '', launches = {} } = settings;
  const terms = normalize(search).split(' ').filter(Boolean);
  const playOptions = availability === 'in-page' ? ['local', 'embed'] : availability ? [availability] : [];
  const matches = source.filter(game => {
    const index = library.searchTerms.get(game.id);
    return (!category || game.category === category) &&
      (!playOptions.length || playOptions.includes(library.availabilityById.get(game.id) ?? gameAvailability(game))) &&
      terms.every(term => index.includes(term));
  });
  switch (sort) {
    case 'category':
      return matches.sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.title, b.title));
    case 'popularity':
      return matches.sort((a, b) => (launches[b.id] || 0) - (launches[a.id] || 0) || collator.compare(a.title, b.title));
    case 'name':
      return matches.sort((a, b) => collator.compare(a.title, b.title));
    case 'newest':
      return matches.sort((a, b) => (b.addedOn || '').localeCompare(a.addedOn || ''));
    case 'challenge':
      return matches.sort((a, b) => Number(hasPlatformerTag(b, 'hard')) - Number(hasPlatformerTag(a, 'hard')));
    default:
      return matches;
  }
}

export function gameAvailability(game) {
  if (game.local) return 'local';
  if (arcadeEmbed(game)) return 'embed';
  if (game.url) return 'external';
  return 'unverified';
}

export function restorePreferences(saved, byId) {
  const ids = values => [...new Set((Array.isArray(values) ? values : [])
    .map(value => byId.get(typeof value === 'string' ? value : value?.id)?.id)
    .filter(Boolean))];
  const launches = Object.create(null);
  if (saved?.launches && typeof saved.launches === 'object') {
    for (const [id, count] of Object.entries(saved.launches)) {
      const game = byId.get(id);
      if (game && Number.isSafeInteger(count) && count > 0) {
        launches[game.id] = Math.min((launches[game.id] || 0) + count, Number.MAX_SAFE_INTEGER);
      }
    }
  }
  const interest = typeof saved?.interest === 'string' && [...byId.values()].some(game => game.category === saved.interest)
    ? saved.interest : '';
  return {
    favorites: ids(saved?.favorites),
    recent: ids(saved?.recent).slice(0, 30),
    profileName: validateProfileName(saved?.profileName) || defaultProfileName,
    compact: saved?.compact === true,
    artwork: saved?.artwork !== false,
    theme: themeOptions.some(([id]) => id === saved?.theme) ? saved.theme : 'midnight',
    mode: arcadeModes.some(({ id }) => id === saved?.mode) ? saved.mode : 'arcade',
    interest,
    rememberSearches: saved?.rememberSearches !== false,
    hiddenHome: Array.isArray(saved?.hiddenHome) ? [...new Set(saved.hiddenHome
      .filter(id => ['destinations', 'featured', 'racing', 'interest', 'recent', 'popular', 'new', 'built-in', 'media'].includes(id)))] : [],
    launches
  };
}
