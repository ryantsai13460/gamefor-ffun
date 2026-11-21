import { arcadeEmbed } from './embedded-content.js';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

export function createLibrary(games) {
  const byId = new Map();
  const categoryCounts = new Map();
  const searchTerms = new Map();
  for (const game of games) {
    byId.set(game.id, game);
    categoryCounts.set(game.category, (categoryCounts.get(game.category) || 0) + 1);
    searchTerms.set(game.id, normalize([game.title, game.category, game.id, ...(game.aliases || [])].join(' ')));
  }
  for (const game of games) {
    for (const alias of game.aliases || []) {
      if (!byId.has(alias)) byId.set(alias, game);
    }
  }
  return { games, byId, categoryCounts, searchTerms };
}

export function queryLibrary(library, settings) {
  const { source = library.games, search = '', category = '', availability = '', sort = '', launches = {} } = settings;
  const terms = normalize(search).split(' ').filter(Boolean);
  const playOptions = availability === 'in-page' ? ['local', 'embed'] : availability ? [availability] : [];
  const matches = source.filter(game => {
    const index = library.searchTerms.get(game.id);
    return (!category || game.category === category) &&
      (!playOptions.length || playOptions.includes(gameAvailability(game))) &&
      terms.every(term => index.includes(term));
  });
  switch (sort) {
    case 'category':
      return matches.sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.title, b.title));
    case 'popularity':
      return matches.sort((a, b) => (launches[b.id] || 0) - (launches[a.id] || 0) || collator.compare(a.title, b.title));
    case 'name':
      return matches.sort((a, b) => collator.compare(a.title, b.title));
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
  return {
    favorites: ids(saved?.favorites),
    recent: ids(saved?.recent).slice(0, 30),
    compact: saved?.compact === true,
    artwork: saved?.artwork !== false,
    theme: saved?.theme === 'graphite' ? 'graphite' : 'midnight',
    hiddenHome: Array.isArray(saved?.hiddenHome) ? [...new Set(saved.hiddenHome
      .filter(id => ['destinations', 'featured', 'recent', 'new', 'built-in'].includes(id)))] : [],
    launches
  };
}
