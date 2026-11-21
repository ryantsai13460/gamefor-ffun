const release = new URL(import.meta.url).search;
const { normalize } = await import(`./library.js${release}`);
const filler = new Set('a an by find for i in me movie movies film films music of please play show song songs the to track tracks watch'.split(' '));
const weights = [8, 5, 3, 1];
let musicIndex;
let filmIndex;

function entry(item, identity, ...fields) {
  const title = normalize(item.title);
  const text = [title, ...fields.map(normalize)];
  return { item, identity, title, words: text.map(value => value.split(' ')) };
}

function rank(index, query) {
  const text = normalize(query);
  if (!text) return [];
  const terms = [...new Set(text.split(' ').filter(word => !filler.has(word)))];
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
  musicIndex ??= import(`./music-catalog.js${release}`).then(({ musicCatalog }) => musicCatalog.map(track =>
    entry(track, `${normalize(track.title)}|${normalize(track.artist)}`, track.artist, [track.category, track.style].join(' '))));
  return rank(await musicIndex, query);
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
