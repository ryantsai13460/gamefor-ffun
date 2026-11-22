const release = new URL(import.meta.url).search;
const { browserBrowsingStorageKey, normalize } = await import(`./library.js${release}`);
const filler = new Set('a an by find for i in me movie movies film films music of please play show song songs the to track tracks watch'.split(' '));
const shortFiller = new Set([...filler, 'clip', 'clips', 'short', 'shorts', 'video', 'videos']);
const weights = [8, 5, 3, 1];
let filmIndex;
let shortIndex;

function entry(item, identity, ...fields) {
  const title = normalize(item.title);
  const text = [title, ...fields.map(normalize)];
  return { item, identity, title, words: text.map(value => value.split(' ')) };
}

function rank(index, query, fillerWords = filler) {
  const text = normalize(query);
  if (!text) return [];
  const terms = [...new Set(text.split(' ').filter(word => !fillerWords.has(word)))];
  const phrase = terms.join(' ');
  const ranked = [];
  for (const candidate of index) {
    const { title, words } = candidate;
    if (title === text) {
      ranked.push({ candidate, score: 1000 });
      continue;
    }
    if (!terms.length) continue;
    const scores = terms.map(term => {
      const match = words.findIndex(field => field.includes(term));
      if (match !== -1) return weights[match];
      return term.length >= 4 && words.some(field => field.some(word => word.startsWith(term) || `${word}s` === term)) ? 1 : 0;
    });
    if (scores.includes(0)) continue;
    const phraseScore = title === phrase ? 35 : title.startsWith(`${phrase} `) ? 19 : title.includes(phrase) ? 10 : 0;
    ranked.push({ candidate, score: scores.reduce((total, score) => total + score, phraseScore) });
  }
  const seen = new Set();
  const ids = new Set();
  return ranked.sort((a, b) => b.score - a.score).flatMap(({ candidate }) => {
    if (seen.has(candidate.identity) || ids.has(candidate.item.id)) return [];
    seen.add(candidate.identity);
    ids.add(candidate.item.id);
    return [candidate.item];
  });
}

export async function searchMusic(query) {
  const { findLyricVideos } = await import(`./lyrics-library.js${release}`);
  return findLyricVideos(query);
}

export async function searchProducts(query = '') {
  const [{ findAmazonProducts }, { isExcludedShoppingQuery, shoppingCategory, shoppingLink }] = await Promise.all([
    import(`./shopping-products.js${release}`), import(`./shopping-data.js${release}`)
  ]);
  if (isExcludedShoppingQuery(query)) return [];
  return findAmazonProducts({ query }).map(product => ({
    ...product, id: product.asin, title: `${product.brand} ${product.title}`,
    categoryName: shoppingCategory(product.category)?.title,
    retailer: 'Amazon U.S.', link: shoppingLink({ product: product.asin }),
    aliases: [product.title, product.asin]
  }));
}

export async function searchBookmarks(query = '') {
  try {
    if (!window.localStorage.getItem(browserBrowsingStorageKey)) return [];
  } catch {
    return [];
  }
  const { getBrowserLibraryState } = await import(`./browser.js${release}`);
  const records = getBrowserLibraryState().favorites.map(({ title, address }) => ({
    id: address, title, address, link: '#browse?' + new URLSearchParams({ address })
  }));
  const terms = normalize(query).split(' ').filter(Boolean);
  const matching = records.filter(({ title, address }) => {
    const text = normalize(`${title} ${address}`);
    return terms.every(term => text.includes(term));
  });
  const exact = normalize(query);
  const score = ({ title, address }) => Number(normalize(title) === exact || normalize(address) === exact);
  return matching.sort((a, b) => score(b) - score(a));
}

export async function searchShorts(query) {
  shortIndex ??= import(`./shorts-catalog.js${release}`).then(({ getShortCatalog, shortsLink, shortProviders }) => getShortCatalog().map(short => {
    const item = { ...short, link: shortsLink(short), source: shortProviders[short.provider].label };
    return entry(item, short.id, short.creator, [item.source, ...short.tags, ...short.categories].join(' '), short.description || '');
  }));
  return rank(await shortIndex, query, shortFiller);
}

export async function searchFilms(query) {
  filmIndex ??= Promise.all([import(`./film-catalog.js${release}`), import(`./film-playback.js${release}`)])
    .then(([{ filmCatalog }, { filmPlayback }]) => filmCatalog.map(film => {
      const fullFilm = Boolean(filmPlayback(film));
      const item = { ...film, viewing: fullFilm ? 'Full film' : filmPlayback(film, true) ? 'Official trailer' : 'Release information' };
      return entry(item, `${normalize(film.title)}|${film.year}`, [film.year, film.credit].join(' '),
        film.genres.join(' '), film.description);
    }));
  return rank(await filmIndex, query);
}
