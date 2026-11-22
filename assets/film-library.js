const release = new URL(import.meta.url).search;
const [{ filmCatalog, featuredFilm }, { filmHttps, filmPlayback, mountFilmPlayer }] = await Promise.all([
  import(`./film-catalog.js${release}`), import(`./film-playback.js${release}`)
]);

const COLLECTIONS = [
  { id: 'discover', title: 'Discover' },
  { id: 'all', title: 'All films' },
  { id: 'full', title: 'Full films' },
  { id: 'features', title: 'Feature films' },
  { id: 'family', title: 'Family films' },
  { id: 'classics', title: 'Classic films' },
  { id: 'documentaries', title: 'Documentaries' },
  { id: 'additions', title: 'Recently added' },
  { id: 'open', title: 'Open films' },
  { id: 'shorts', title: 'Animated shorts' },
  { id: 'trailers', title: 'Studio trailers' },
  { id: 'watchlist', title: 'Watchlist' },
  { id: 'favorites', title: 'Favorites' },
  { id: 'continuing', title: 'Continue watching' },
  { id: 'recent', title: 'Recently opened' }
];
const FILTER_OPTIONS = {
  runtime: new Map([
    ['', 'Any runtime'],
    ['under-20', 'Under 20 min'],
    ['20-59', '20–59 min'],
    ['60-plus', '60+ min'],
    ['unknown', 'Runtime not listed']
  ]),
  playback: new Map([
    ['', 'Any playback'],
    ['full', 'Full films only'],
    ['in-page', 'Full films in-page'],
    ['provider', 'Full films on provider site']
  ])
};
const PAGE_SIZE = 16;
const SHELF_SIZE = 4;
const filmKey = 'ffun-film-library-v1';
const byId = new Map(filmCatalog.map(film => [film.id, film]));
const fullSources = new Map(filmCatalog.map(film => [film.id, filmPlayback(film)]));
const trailerSources = new Map(filmCatalog.map(film => [film.id, filmPlayback(film, true)]));
const runtimeGroups = new Map(filmCatalog.map(film => [film.id, runtimeGroup(film)]));
const genres = [...new Set(filmCatalog.flatMap(film => film.genres))].sort();
const addedDates = new Map(filmCatalog.flatMap(film => {
  const date = Date.parse(film.addedAt);
  return Number.isFinite(date) ? [[film.id, date]] : [];
}));
const searchable = new Map(filmCatalog.map(film => [film.id, normalize([
  film.title, film.year, film.credit, film.director, film.description, film.rating, ...film.genres
].filter(Boolean).join(' '))]));
let storedInMemory = { favorites: [], watchlist: [], playback: Object.create(null) };
let memoryOnly = false;

function element(tag, className = '', text = '') {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

function button(label, onClick, className = 'button') {
  const item = element('button', className, label);
  item.type = 'button';
  item.addEventListener('click', onClick);
  return item;
}

function playerButton(label, onClick, className) {
  const item = button(label, onClick, className);
  item.setAttribute('aria-haspopup', 'dialog');
  return item;
}

function sourceLink(label, url, className = 'button') {
  const item = element('a', className, label);
  item.href = url;
  item.target = '_blank';
  item.rel = 'noopener noreferrer';
  return item;
}

function routeLink(label, url, className = 'button') {
  const item = element('a', className, label);
  item.href = url;
  return item;
}

function artFor(film, eager = false) {
  const box = element('div', 'film-art');
  const fallback = element('span', '', film.title);
  fallback.setAttribute('aria-hidden', 'true');
  box.append(fallback);
  let artwork;
  try { if (film.art) artwork = new URL(film.art, document.baseURI); } catch {}
  if (artwork && ['https:', 'http:'].includes(artwork.protocol)) {
    const image = element('img');
    image.alt = '';
    image.decoding = 'async';
    image.loading = eager ? 'eager' : 'lazy';
    if (eager) image.fetchPriority = 'high';
    image.addEventListener('load', () => {
      image.classList.toggle('is-portrait', image.naturalHeight > image.naturalWidth);
      image.classList.add('is-ready');
    }, {once: true});
    image.addEventListener('error', () => image.remove(), {once: true});
    if (artwork.hostname === 'assets.nfbcdn.ca' && artwork.searchParams.has('w')) {
      image.srcset = [384, 768, 1280].map(width => {
        artwork.searchParams.set('w', width);
        return `${artwork.href} ${width}w`;
      }).join(', ');
      image.sizes = '(max-width: 350px) 100vw, (max-width: 690px) 50vw, 340px';
    }
    image.src = film.art;
    box.append(image);
  }
  return box;
}

function normalize(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function filmFormat(film) {
  if (film.format === 'feature' || film.format === 'short') return film.format;
  if (film.runtimeMinutes >= 40) return 'feature';
  if (['open', 'shorts'].includes(film.collection)) return 'short';
  return '';
}

function viewingLabel(film, trailer = false) {
  if (trailer) return 'Official trailer';
  if (!fullSources.get(film.id)) return 'Trailer or release listing';
  if (filmFormat(film) === 'feature') return 'Full feature film';
  if (filmFormat(film) === 'short') return film.genres.includes('Animation') ? 'Full animated short' : 'Full short film';
  return 'Full film';
}

function runtime(film) {
  return Number.isFinite(film.runtimeMinutes) && film.runtimeMinutes > 0
    ? `${film.runtimeMinutes} min` : film.duration || '';
}

function runtimeGroup(film) {
  let minutes = film.runtimeMinutes;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    const duration = film.duration?.trim() || '';
    // Older entries store the runtime as minutes, seconds, or both.
    const parts = /^(?:(\d+) min)?\s*(?:(\d+) sec)?$/i.exec(duration);
    minutes = duration === 'Half-hour special' ? 30 : Number(parts?.[1] || 0) + Number(parts?.[2] || 0) / 60;
  }
  if (!minutes) return 'unknown';
  if (minutes < 20) return 'under-20';
  if (minutes < 60) return '20-59';
  return '60-plus';
}

function filmFilter(key, label, params) {
  const select = element('select', 'field');
  select.setAttribute('aria-label', label);
  const options = FILTER_OPTIONS[key];
  select.append(...[...options].map(([value, name]) => new Option(name, value)));
  const value = params.get(key);
  select.value = options.has(value) ? value : '';
  return select;
}

function filmIds(list) {
  return Array.isArray(list) ? [...new Set(list.filter(id => byId.has(id)))] : [];
}

function filmState() {
  if (memoryOnly) return storedInMemory;
  try {
    const raw = localStorage.getItem(filmKey);
    if (!raw || raw.length > 250_000) return storedInMemory;
    const parsed = JSON.parse(raw);
    const playback = Object.create(null);
    for (const [id, data] of Object.entries(parsed?.playback || {})) {
      if (!byId.has(id) || !data || typeof data !== 'object') continue;
      const openedAt = Number.isFinite(data.openedAt) && data.openedAt > 0 ? data.openedAt : 0;
      const opens = Number.isInteger(data.opens) && data.opens > 0 ? data.opens : 0;
      const duration = Number.isFinite(data.duration) && data.duration > 0 && data.duration <= 86400 ? data.duration : 0;
      const seconds = duration && Number.isFinite(data.seconds) && data.seconds >= 0 && data.seconds < duration ? data.seconds : 0;
      playback[id] = { openedAt, opens, seconds, duration };
    }
    return { favorites: filmIds(parsed?.favorites), watchlist: filmIds(parsed?.watchlist), playback };
  } catch {
    return storedInMemory;
  }
}

function updateFilmState(update) {
  const state = filmState();
  update(state);
  storedInMemory = state;
  try { localStorage.setItem(filmKey, JSON.stringify(state)); } catch { memoryOnly = true; }
  return state;
}

function toggleSaved(id, kind) {
  return updateFilmState(state => {
    const saved = state[kind];
    state[kind] = saved.includes(id) ? saved.filter(value => value !== id) : [id, ...saved];
  });
}

function markOpened(film) {
  updateFilmState(state => {
    const record = state.playback[film.id] || {};
    state.playback[film.id] = { ...record, openedAt: Date.now(), opens: (record.opens || 0) + 1 };
  });
}

function storeProgress(film, { seconds, duration, complete }) {
  updateFilmState(state => {
    const record = state.playback[film.id] || {};
    state.playback[film.id] = { ...record, duration, seconds: !complete && seconds < duration - 2 ? seconds : 0 };
  });
}

function openHistory(state) {
  return Object.entries(state.playback).filter(([id, record]) => fullSources.get(id) && record.openedAt)
    .sort(([, first], [, second]) => second.openedAt - first.openedAt);
}

export function getFilm(id) { return byId.get(id); }

export function getFilmLibraryState() {
  const state = filmState();
  const saved = state.favorites.map(getFilm);
  const recent = openHistory(state);
  return {
    saved, favorites: saved, watchlist: state.watchlist.map(getFilm), recent: recent.map(([id]) => getFilm(id)),
    continuing: recent.filter(([, record]) => record.seconds >= 2).map(([id]) => getFilm(id)),
    completeCount: filmCatalog.filter(film => fullSources.get(film.id)).length,
    catalogCount: filmCatalog.length
  };
}

function browsePath(params) {
  const query = new URLSearchParams();
  for (const key of ['collection', 'q', 'genre', 'runtime', 'playback', 'sort', 'page']) {
    const value = params?.get(key);
    if (value && (!FILTER_OPTIONS[key] || FILTER_OPTIONS[key].has(value))) query.set(key, value);
  }
  return `#movies${query.size ? `?${query}` : ''}`;
}

export function filmDetailUrl(id, params) {
  const route = browsePath(params);
  return `${route}${route.includes('?') ? '&' : '?'}film=${encodeURIComponent(id)}`;
}

function savedButton(film, kind, onChange) {
  const favorite = kind === 'favorites';
  const item = button('', () => sync(toggleSaved(film.id, kind), true));
  function sync(state, changed = false) {
    const active = state[kind].includes(film.id);
    item.textContent = favorite ? (active ? 'Favorited' : 'Favorite') : (active ? 'Watchlisted' : 'Watchlist');
    item.setAttribute('aria-label', favorite
      ? (active ? `Remove ${film.title} from favorites` : `Favorite ${film.title}`)
      : (active ? `Remove ${film.title} from watchlist` : `Add ${film.title} to watchlist`));
    item.setAttribute('aria-pressed', String(active));
    if (changed) onChange?.();
  }
  sync(filmState());
  return item;
}

function makePlaybackActions(film, open, inline = false) {
  const actions = element('div', 'film-actions');
  const playButton = inline ? button : playerButton;
  const full = fullSources.get(film.id);
  const trailer = trailerSources.get(film.id);
  if (full?.embed) actions.append(playButton(filmFormat(film) === 'short' ? 'Play full short' : 'Play full film', () => open(false), 'button primary'));
  else if (full) {
    const watch = sourceLink('Watch Full Movie', full.external, 'button primary');
    watch.addEventListener('click', () => markOpened(film));
    actions.append(watch);
  }
  if (trailer?.embed) actions.append(playButton('Watch trailer', () => open(true)));
  else if (trailer) actions.append(sourceLink(film.trailerLabel || 'Official trailer', trailer.external));
  if (!full && filmHttps(film.where)) actions.append(sourceLink('Where to watch', filmHttps(film.where)));
  return actions;
}

function filmCard(film, params, open, onSave) {
  const article = element('article', 'film-card media-movie');
  const link = routeLink('', filmDetailUrl(film.id, params), 'film-card-link');
  link.setAttribute('aria-label', `Open ${film.title} film page`);
  const info = element('div', 'film-card-info');
  info.append(element('h3', '', film.title),
    element('p', 'film-meta', [film.year, runtime(film), film.rating, ...film.genres].filter(Boolean).join(' · ')),
    element('p', 'film-type', viewingLabel(film)));
  link.append(artFor(film), info);
  const body = element('div', 'film-card-body');
  body.append(makePlaybackActions(film, trailer => open(film, trailer)));
  const saves = element('div', 'film-actions film-save-actions');
  saves.append(savedButton(film, 'favorites', onSave), savedButton(film, 'watchlist', onSave));
  body.append(saves);
  article.append(link, body);
  return article;
}

function createPlayback(target, film, trailer, resumeAt = 0) {
  const destination = (trailer ? trailerSources : fullSources).get(film.id);
  if (!destination?.embed) return () => {};
  if (!trailer) markOpened(film);
  return mountFilmPlayer(target, destination, {
    title: trailer ? `${film.title} trailer` : film.title,
    onProgress: !trailer && destination.id ? progress => storeProgress(film, progress) : undefined,
    regional: film.regionLimited === true,
    resumeAt
  });
}

function openFilmDialog(target, film, trailer, afterClose) {
  const dialog = element('dialog', 'media-dialog film-player-dialog');
  dialog.setAttribute('aria-label', film.title);
  const header = element('header', 'media-dialog-header');
  const titles = element('div');
  titles.append(element('h2', '', film.title), element('p', 'media-meta', viewingLabel(film, trailer)));
  const close = button('Close', () => dialog.close());
  close.autofocus = true;
  header.append(titles, close);
  const player = element('div', 'film-player-content');
  const credit = filmHttps(film.licenseUrl || film.source);
  dialog.append(header, player, element('p', 'media-dialog-description', film.description));
  if (credit) dialog.append(sourceLink('Source and credits', credit, 'film-credit'));
  target.append(dialog);
  dialog.showModal();
  const resumeAt = trailer ? 0 : filmState().playback[film.id]?.seconds || 0;
  const release = createPlayback(player, film, trailer, resumeAt);
  let disposed = false;
  function remove() {
    if (disposed) return;
    disposed = true;
    release();
    dialog.remove();
    afterClose?.();
  }
  dialog.addEventListener('close', remove, {once: true});
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  return () => {
    if (dialog.open) dialog.close();
    remove();
  };
}

function relatedFilms(film) {
  return filmCatalog.filter(candidate => candidate.id !== film.id && fullSources.get(candidate.id))
    .map(candidate => ({ candidate, score: candidate.genres.filter(genre => film.genres.includes(genre)).length }))
    .filter(record => record.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, SHELF_SIZE)
    .map(record => record.candidate);
}

function renderFilmDetail(target, id, params) {
  const root = element('section', 'films-page film-detail');
  const back = routeLink('Back to Movies', browsePath(params), 'button film-back');
  root.append(back);
  target.replaceChildren(root);
  const film = getFilm(id);
  if (!film) {
    root.append(element('h1', '', 'Film unavailable'), element('p', 'film-empty', 'This title could not be found in the film catalog.'));
    return () => {};
  }

  const details = element('div', 'film-detail-information');
  const copy = element('div', 'film-detail-copy');
  const full = fullSources.get(id);
  const trailer = trailerSources.get(id);
  const credit = filmHttps(film.source);
  const meta = element('dl', 'film-details-meta');
  for (const [label, value] of [
    ['Release', film.year], ['Genre', film.genres.join(' · ')], ['Runtime', runtime(film)], ['Rating', film.rating],
    ['Content advisory', film.advisory], ['Director', film.director],
    ['Playback source', full?.provider || trailer?.provider], ['Credits', film.credit]
  ]) {
    if (value) {
      const item = element('div');
      item.append(element('dt', '', label), element('dd', '', value));
      meta.append(item);
    }
  }
  copy.append(element('p', 'film-type', viewingLabel(film)), element('h1', '', film.title),
    element('p', 'film-detail-description', film.description), meta);
  if (film.regionLimited) copy.append(element('p', 'film-meta', 'Availability varies by region.'));
  if (credit) copy.append(sourceLink('Source and credits', credit, 'text-action film-credit'));
  if (film.license && film.license !== film.credit && (full || !film.availableUntil)) {
    const license = filmHttps(film.licenseUrl);
    copy.append(license ? sourceLink(film.license, license, 'text-action film-credit') : element('p', 'film-meta', film.license));
  }
  details.append(artFor(film, true), copy);
  const panel = element('section', 'film-detail-play');
  const playerTitle = element('h2', '', 'Watch');
  const player = element('div', 'film-player-content');
  player.hidden = true;
  const playerActions = makePlaybackActions(film, start, true);
  playerActions.append(savedButton(film, 'favorites'), savedButton(film, 'watchlist'));
  let releasePlayer;
  let releaseRelated;
  const resumeAt = full?.id ? filmState().playback[id]?.seconds || 0 : 0;
  if (resumeAt >= 2) {
    const resume = button(`Continue at ${formatTime(resumeAt)}`, () => start(false, resumeAt), 'button primary');
    const restart = playerActions.querySelector('button.primary');
    if (restart) {
      restart.textContent = 'Start over';
      restart.classList.remove('primary');
    }
    playerActions.prepend(resume);
  }
  panel.append(playerTitle, playerActions, player);
  if (!full) {
    const message = film.availableUntil
      ? 'The verified viewing window has ended. Check the provider for current availability.'
      : 'This page lists the trailer or release source. A verified full-film source is unavailable.';
    panel.append(element('p', 'film-meta', message));
  }
  const related = element('section', 'film-shelf');
  const relatedTitles = relatedFilms(film);
  if (relatedTitles.length) {
    const grid = element('div', 'film-grid');
    grid.append(...relatedTitles.map(entry => filmCard(entry, params, (selected, isTrailer) => {
      releaseRelated?.();
      releaseRelated = openFilmDialog(root, selected, isTrailer);
    })));
    related.append(element('h2', '', 'Related films'), grid);
  }
  root.append(details, panel);
  if (relatedTitles.length) root.append(related);

  function start(isTrailer, seconds = 0) {
    releasePlayer?.();
    player.hidden = false;
    playerTitle.textContent = viewingLabel(film, isTrailer);
    releasePlayer = createPlayback(player, film, isTrailer, seconds);
    playerTitle.tabIndex = -1;
    playerTitle.focus({ preventScroll: true });
    playerTitle.scrollIntoView({ block: 'nearest' });
  }

  return () => { releasePlayer?.(); releaseRelated?.(); };
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function renderFilms(target, { collection, params = new URLSearchParams(location.hash.split('?')[1]) } = {}) {
  if (params.has('film')) return renderFilmDetail(target, params.get('film'), params);
  const root = element('section', 'films-page');
  const heading = element('header', 'film-heading');
  const { completeCount, catalogCount } = getFilmLibraryState();
  const trailerCount = catalogCount - completeCount;
  heading.append(element('h1', '', 'Movies'), element('p', 'film-meta',
    `${completeCount} complete films ${trailerCount ? `· ${trailerCount} trailer and release listings` : ''}`.trim()));
  const feature = element('section', 'film-feature');
  const featureCopy = element('div', 'film-feature-copy');
  featureCopy.append(element('p', 'film-feature-label', 'Featured film'),
    element('h2', '', featuredFilm.title),
    element('p', 'film-meta', [featuredFilm.year, runtime(featuredFilm), ...featuredFilm.genres].filter(Boolean).join(' · ')),
    element('p', '', featuredFilm.description));
  const featureActions = element('div', 'film-actions');
  if (fullSources.get(featuredFilm.id)?.embed) {
    featureActions.append(playerButton('Play featured film', () => openFilm(featuredFilm, false), 'button primary'));
  }
  featureActions.append(routeLink('Film details', filmDetailUrl(featuredFilm.id)));
  featureCopy.append(featureActions);
  feature.append(artFor(featuredFilm, true), featureCopy);

  const toolbar = element('div', 'film-toolbar');
  const filters = element('div', 'film-filters');
  const query = element('input', 'field');
  query.type = 'search';
  query.maxLength = 160;
  query.value = (params.get('q') || '').slice(0, query.maxLength);
  query.placeholder = 'Search films';
  query.setAttribute('aria-label', 'Search films');
  const genre = element('select', 'field');
  genre.setAttribute('aria-label', 'Film genre');
  genre.append(new Option('All genres', ''), ...genres.map(name => new Option(name, name)));
  genre.value = genres.includes(params.get('genre')) ? params.get('genre') : '';
  const runtimeFilter = filmFilter('runtime', 'Film runtime', params);
  const playbackFilter = filmFilter('playback', 'Full-film playback', params);
  const sort = element('select', 'field');
  sort.setAttribute('aria-label', 'Sort films');
  const orders = [
    ['catalog', 'Catalog order'], ['title', 'Title A–Z'], ['latest-year', 'Newest release'],
    ['oldest-year', 'Oldest release'], ['opened', 'Most opened on this device']
  ];
  if (addedDates.size) orders.splice(4, 0, ['recently-added', 'Recently added']);
  sort.append(...orders.map(([value, name]) => new Option(name, value)));
  sort.value = orders.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'catalog';
  filters.append(query, genre, runtimeFilter, playbackFilter, sort);
  const tabs = element('div', 'film-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Film collections');
  const requested = collection || params.get('collection');
  let current = COLLECTIONS.some(({id}) => id === requested) ? requested : 'discover';
  let page = Math.max(0, (Number.parseInt(params.get('page'), 10) || 1) - 1);
  let closeDialog;
  const collectionButtons = new Map();
  for (const {id, title} of COLLECTIONS) {
    if (id === 'additions' && !addedDates.size) continue;
    const item = button(title, () => chooseCollection(id));
    collectionButtons.set(id, item);
    tabs.append(item);
  }
  toolbar.append(tabs, filters);

  const status = element('p', 'film-meta film-result-count');
  status.setAttribute('aria-live', 'polite');
  const results = element('div', 'film-results');
  const pagination = element('nav', 'film-pagination');
  pagination.setAttribute('aria-label', 'Film pages');
  const previous = button('Previous page', () => changePage(-1));
  const next = button('Next page', () => changePage(1));
  const pageStatus = element('span', 'film-meta');
  pagination.append(previous, pageStatus, next);
  root.append(heading, feature, toolbar, status, results, pagination);
  target.replaceChildren(root);

  function openFilm(film, trailer) {
    closeDialog?.();
    closeDialog = openFilmDialog(root, film, trailer, () => {
      if (root.isConnected && current === 'continuing') draw();
    });
  }

  function currentParams() {
    const selected = new URLSearchParams();
    if (current !== 'discover') selected.set('collection', current);
    if (query.value.trim()) selected.set('q', query.value.trim());
    if (genre.value) selected.set('genre', genre.value);
    if (runtimeFilter.value) selected.set('runtime', runtimeFilter.value);
    if (playbackFilter.value) selected.set('playback', playbackFilter.value);
    if (sort.value !== 'catalog') selected.set('sort', sort.value);
    if (page > 0) selected.set('page', String(page + 1));
    return selected;
  }

  function updateUrl() {
    const next = browsePath(currentParams());
    if (location.hash !== next) history.replaceState(history.state, '', next);
  }

  function onSave() {
    const label = document.activeElement?.getAttribute('aria-label');
    draw();
    updateUrl();
    const match = [...results.querySelectorAll('button[aria-label]')].find(item => item.getAttribute('aria-label') === label);
    (match || collectionButtons.get(current)).focus({preventScroll: true});
  }

  function section(name, films, collectionId) {
    const shelf = element('section', 'film-shelf');
    const top = element('div', 'film-shelf-heading');
    top.append(element('h2', '', name));
    if (collectionId) {
      top.append(button(`View all ${name.toLowerCase()}`, () => chooseCollection(collectionId), 'button'));
    }
    const grid = element('div', 'film-grid');
    const savedParams = currentParams();
    grid.append(...films.map(film => filmCard(film, savedParams, openFilm, onSave)));
    shelf.append(top, grid);
    return shelf;
  }

  function matches(film, words) {
    const text = searchable.get(film.id);
    if (runtimeFilter.value && runtimeGroups.get(film.id) !== runtimeFilter.value) return false;
    if (genre.value && !film.genres.includes(genre.value)) return false;
    if (playbackFilter.value) {
      const full = fullSources.get(film.id);
      if (!full) return false;
      if (playbackFilter.value === 'in-page' && !full.embed) return false;
      if (playbackFilter.value === 'provider' && full.embed) return false;
    }
    return words.every(word => text.includes(word) || text.replaceAll(' ', '').includes(word));
  }

  function collectionFilms(id, state) {
    if (id === 'watchlist' || id === 'favorites') return state[id].map(getFilm);
    if (id === 'continuing' || id === 'recent') {
      return openHistory(state).filter(([, record]) => id === 'recent' || record.seconds >= 2).map(([key]) => getFilm(key));
    }
    if (id === 'full') return filmCatalog.filter(film => fullSources.get(film.id));
    if (id === 'features') return filmCatalog.filter(film => fullSources.get(film.id) && filmFormat(film) === 'feature');
    if (id === 'family') return filmCatalog.filter(film => film.genres.includes('Family') && fullSources.get(film.id))
      .sort((first, second) => Number(filmFormat(second) === 'feature') - Number(filmFormat(first) === 'feature'));
    if (id === 'classics' || id === 'documentaries') {
      const genre = id === 'classics' ? 'Classic' : 'Documentary';
      return filmCatalog.filter(film => fullSources.get(film.id) && film.genres.includes(genre));
    }
    if (id === 'additions') return filmCatalog.filter(film => fullSources.get(film.id) && addedDates.has(film.id))
      .sort((first, second) => addedDates.get(second.id) - addedDates.get(first.id));
    if (id === 'shorts') return filmCatalog.filter(film => filmFormat(film) === 'short' && fullSources.get(film.id) && film.genres.includes('Animation'));
    if (id === 'open' || id === 'trailers') return filmCatalog.filter(film => film.collection === id);
    return filmCatalog;
  }

  function sortFilms(entries, state) {
    if (sort.value === 'title') entries.sort((first, second) => first.title.localeCompare(second.title));
    if (sort.value === 'latest-year') entries.sort((first, second) => (second.year || 0) - (first.year || 0));
    if (sort.value === 'oldest-year') entries.sort((first, second) => (first.year || Infinity) - (second.year || Infinity));
    if (sort.value === 'recently-added') entries.sort((first, second) => (addedDates.get(second.id) || 0) - (addedDates.get(first.id) || 0));
    if (sort.value === 'opened') entries.sort((first, second) => (state.playback[second.id]?.opens || 0) - (state.playback[first.id]?.opens || 0));
    return entries;
  }

  function draw() {
    for (const [id, item] of collectionButtons) item.setAttribute('aria-pressed', String(id === current));
    const state = filmState();
    const words = normalize(query.value).split(' ').filter(Boolean);
    const filtered = sortFilms(collectionFilms(current, state).filter(film => matches(film, words)), state);
    const viewingFilters = Boolean(runtimeFilter.value || playbackFilter.value);
    const shelves = current === 'discover' && !words.length && !genre.value && !viewingFilters && sort.value === 'catalog';
    feature.hidden = !shelves;
    results.replaceChildren();
    const pages = Math.ceil(filtered.length / PAGE_SIZE);
    page = Math.max(0, Math.min(page, pages - 1));
    status.textContent = filtered.length
      ? `${filtered.length} ${filtered.length === 1 ? 'title' : 'titles'}${!shelves && pages > 1 ? ` · Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)}` : ''}`
      : '0 titles';
    if (shelves) {
      const additions = filtered.filter(film => addedDates.has(film.id) && fullSources.get(film.id))
        .sort((first, second) => addedDates.get(second.id) - addedDates.get(first.id));
      const active = collectionFilms('continuing', state);
      if (active.length) results.append(section('Continue watching', active.slice(0, SHELF_SIZE), 'continuing'));
      if (additions.length) results.append(section('Recently added', additions.slice(0, SHELF_SIZE), 'additions'));
      const opened = openHistory(state).sort(([, first], [, second]) => second.opens - first.opens);
      if (opened.length) results.append(section('Most opened on this device', opened.slice(0, SHELF_SIZE).map(([id]) => getFilm(id))));
      for (const id of ['family', 'features', 'classics', 'documentaries', 'open', 'shorts', 'trailers']) {
        const { title } = COLLECTIONS.find(value => value.id === id);
        const entries = collectionFilms(id, state);
        if (entries.length) results.append(section(title, entries.slice(0, SHELF_SIZE), id));
      }
    } else if (filtered.length) {
      const { title } = COLLECTIONS.find(({id}) => id === current);
      const name = words.length ? 'Search results' : current === 'discover' && viewingFilters ? 'Filtered films' : title;
      results.append(section(name, filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)));
    } else {
      const empty = {
        favorites: 'Favorite a film to see it here.', watchlist: 'Add a film to your watchlist to see it here.',
        continuing: 'Films with saved playback progress appear here.', recent: 'Films you open for playback appear here.'
      };
      let message = empty[current] || 'No films found.';
      if (viewingFilters) message = 'No films match your filters.';
      if (words.length || genre.value) message = 'No films match your search.';
      results.append(element('p', 'film-empty', message));
    }
    pagination.hidden = shelves || pages <= 1;
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    pageStatus.textContent = `Page ${page + 1} of ${pages}`;
  }

  function chooseCollection(id) {
    current = id;
    page = 0;
    draw();
    updateUrl();
    collectionButtons.get(id).focus({preventScroll: true});
    toolbar.scrollIntoView({block: 'nearest'});
  }

  function changePage(direction) {
    page += direction;
    draw();
    updateUrl();
    status.scrollIntoView({block: 'nearest'});
  }

  function updateFilters() {
    page = 0;
    draw();
    updateUrl();
  }

  query.addEventListener('input', updateFilters);
  genre.addEventListener('change', updateFilters);
  runtimeFilter.addEventListener('change', updateFilters);
  playbackFilter.addEventListener('change', updateFilters);
  sort.addEventListener('change', updateFilters);
  draw();
  return () => closeDialog?.();
}
