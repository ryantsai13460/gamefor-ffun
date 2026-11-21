const release = new URL(import.meta.url).search;
const { filmCatalog, featuredFilm } = await import(`./film-catalog.js${release}`);

const COLLECTIONS = [
  { id: 'all', title: 'All films' },
  { id: 'open', title: 'Open films' },
  { id: 'shorts', title: 'Animated shorts' },
  { id: 'trailers', title: 'Studio trailers' }
];
const PAGE_SIZE = 16;
const SHELF_SIZE = 4;

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

function artFor(film, eager = false) {
  const box = element('div', 'film-art');
  const fallback = element('span', '', film.title);
  fallback.setAttribute('aria-hidden', 'true');
  box.append(fallback);
  if (film.art) {
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
    const artwork = new URL(film.art);
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

function viewingLabel(film, trailer) {
  if (trailer) return 'Official trailer';
  return film.genres.includes('Animation') ? 'Full animated short' : 'Full short film';
}

function filmPlayer(target, film, trailer) {
  const dialog = element('dialog', 'media-dialog film-player-dialog');
  dialog.setAttribute('aria-label', film.title);
  const header = element('header', 'media-dialog-header');
  const titles = element('div');
  titles.append(element('h2', '', film.title), element('p', 'media-meta', viewingLabel(film, trailer)));
  const close = button('Close', () => dialog.close());
  close.autofocus = true;
  header.append(titles, close);
  const frame = element('iframe');
  const id = trailer ? film.trailer : film.fullVideo;
  const provider = id ? 'YouTube' : 'NFB';
  frame.title = trailer ? `${film.title} trailer` : film.title;
  frame.src = id ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1` : film.embed;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const viewport = element('div', 'media-player');
  viewport.append(frame);
  const status = element('p', 'media-player-status', `Opening the ${provider} player…`);
  status.setAttribute('role', 'status');
  const unconfirmed = film.regionLimited
    ? 'NFB availability varies by location. If the film is unavailable here, check the Watch on NFB link.'
    : `Embedded playback could not be confirmed. If the player does not start, use Watch on ${provider}.`;
  const wait = setTimeout(() => { status.textContent = unconfirmed; }, 8500);
  function updateStatus(message) {
    clearTimeout(wait);
    status.textContent = message;
  }
  frame.addEventListener('load', () => updateStatus(unconfirmed), {once: true});
  frame.addEventListener('error', () => updateStatus(
    `The ${provider} player could not be reached. Use Watch on ${provider}.`), {once: true});
  const actions = element('div', 'media-actions');
  const external = id ? `https://www.youtube.com/watch?v=${id}` : film.source;
  actions.append(sourceLink(`Watch on ${provider}`, external, 'button primary'));
  let removeFullscreenListener = () => {};
  if (document.fullscreenEnabled && viewport.requestFullscreen) {
    const full = button('Fullscreen', async () => {
      try {
        if (document.fullscreenElement === viewport) await document.exitFullscreen();
        else await viewport.requestFullscreen();
      } catch {
        updateStatus('Fullscreen is unavailable in this browser.');
      }
    });
    const update = () => {
      full.textContent = document.fullscreenElement === viewport ? 'Exit fullscreen' : 'Fullscreen';
    };
    document.addEventListener('fullscreenchange', update);
    removeFullscreenListener = () => document.removeEventListener('fullscreenchange', update);
    actions.append(full);
  }
  actions.append(sourceLink('Source and credits', film.licenseUrl || film.source, 'film-credit'));
  dialog.append(header, viewport, status, element('p', 'media-dialog-description', film.description), actions);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    clearTimeout(wait);
    removeFullscreenListener();
    frame.remove();
    dialog.remove();
  };
  dialog.addEventListener('close', remove, {once: true});
  target.append(dialog);
  dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
    remove();
  };
}

function normalize(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function renderFilms(target, { watchDialog, collection } = {}) {
  const root = element('section', 'films-page');
  const heading = element('header', 'film-heading');
  heading.append(element('h1', '', 'Movies'));
  const feature = element('section', 'film-feature');
  const featureCopy = element('div', 'film-feature-copy');
  featureCopy.append(element('p', 'film-feature-label', 'Featured film'),
    element('h2', '', featuredFilm.title),
    element('p', 'film-meta', [featuredFilm.year, ...featuredFilm.genres].join(' · ')),
    element('p', '', featuredFilm.description));
  const featureActions = element('div', 'film-actions');
  featureActions.append(playerButton('Play featured film', () => openFilm(featuredFilm, false), 'button primary'));
  featureCopy.append(featureActions);
  feature.append(artFor(featuredFilm, true), featureCopy);

  const toolbar = element('div', 'film-toolbar');
  const filters = element('div', 'film-filters');
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const query = element('input', 'field');
  query.type = 'search';
  query.maxLength = 160;
  query.value = (params.get('q') || '').slice(0, query.maxLength);
  query.placeholder = 'Search films';
  query.setAttribute('aria-label', 'Search films');
  const genre = element('select', 'field');
  genre.setAttribute('aria-label', 'Film genre');
  const genres = [...new Set(filmCatalog.flatMap((film) => film.genres))].sort();
  for (const name of ['All genres', ...genres]) genre.append(element('option', '', name));
  filters.append(query, genre);
  const tabs = element('div', 'film-tabs');
  tabs.setAttribute('aria-label', 'Film collections');
  const requested = collection || params.get('collection');
  let current = COLLECTIONS.some(({id}) => id === requested) ? requested : 'all';
  let page = 0;
  let closeDialog;
  const collectionButtons = new Map();
  for (const {id, title} of COLLECTIONS) {
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
    const id = trailer ? film.trailer : film.fullVideo;
    if (typeof watchDialog === 'function' && id) {
      closeDialog = watchDialog(root, {
        title: film.title,
        subtitle: viewingLabel(film, trailer),
        description: film.description,
        video: {id, title: trailer ? `${film.title} trailer` : film.title},
        external: `https://www.youtube.com/watch?v=${id}`,
        directLabel: 'Watch on YouTube',
        details: sourceLink(film.license || film.credit, film.licenseUrl || film.source, 'film-credit')
      });
      return;
    }
    closeDialog = filmPlayer(root, film, trailer);
  }

  function card(film) {
    const article = element('article', 'film-card media-movie');
    const body = element('div', 'film-card-body');
    const info = element('div', 'film-card-info');
    const meta = [film.year, film.duration, ...film.genres, film.regionLimited && 'Regional availability']
      .filter(Boolean).join(' · ');
    info.append(element('h3', '', film.title), element('p', 'film-meta', meta),
      element('p', 'film-card-description', film.description));
    const actions = element('div', 'film-actions');
    if (film.fullVideo || film.embed) {
      actions.append(playerButton('Play full short', () => openFilm(film, false), 'button primary'));
    }
    if (film.trailer) actions.append(playerButton('Watch trailer', () => openFilm(film, true)));
    if (film.trailerLink) actions.append(sourceLink(film.trailerLabel || 'Official trailer', film.trailerLink));
    if (film.where) actions.append(sourceLink('Where to watch', film.where));
    const credit = sourceLink(film.director ? `${film.director} · ${film.credit}` : film.credit,
      film.source, 'film-credit');
    body.append(info, actions, credit);
    article.append(artFor(film), body);
    return article;
  }

  function section(name, films, collectionId) {
    const shelf = element('section', 'film-shelf');
    const top = element('div', 'film-shelf-heading');
    top.append(element('h2', '', name));
    if (collectionId) {
      top.append(button(`View all ${name.toLowerCase()}`, () => chooseCollection(collectionId), 'button'));
    }
    const grid = element('div', 'film-grid');
    grid.append(...films.map(card));
    shelf.append(top, grid);
    return shelf;
  }

  function matches(film, words) {
    const fields = [film.title, film.year, film.credit, film.director, film.description, ...film.genres];
    const searchable = normalize(fields.filter(Boolean).join(' '));
    const joinedTitle = normalize(film.title).replaceAll(' ', '');
    return words.every((word) => searchable.includes(word) || joinedTitle.includes(word)) &&
      (genre.selectedIndex === 0 || film.genres.includes(genre.value));
  }

  function draw() {
    for (const [id, item] of collectionButtons) item.setAttribute('aria-pressed', String(id === current));
    const words = normalize(query.value).split(' ').filter(Boolean);
    const filtered = filmCatalog.filter((film) =>
      (current === 'all' || film.collection === current) && matches(film, words));
    const shelves = current === 'all' && !words.length && genre.selectedIndex === 0;
    feature.hidden = !shelves;
    status.textContent = `${filtered.length} ${filtered.length === 1 ? 'film' : 'films'}`;
    results.replaceChildren();
    const pages = Math.ceil(filtered.length / PAGE_SIZE);
    page = Math.max(0, Math.min(page, pages - 1));
    if (shelves) {
      for (const {id, title} of COLLECTIONS.slice(1)) {
        const entries = filtered.filter((film) => film.collection === id);
        if (entries.length) results.append(section(title, entries.slice(0, SHELF_SIZE), id));
      }
    } else if (filtered.length) {
      const name = words.length ? 'Search results' : COLLECTIONS.find(({id}) => id === current).title;
      results.append(section(name, filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)));
    } else {
      results.append(element('p', 'film-empty', 'No films match your search.'));
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
    collectionButtons.get(id).focus({preventScroll: true});
    toolbar.scrollIntoView({block: 'nearest'});
  }

  function changePage(direction) {
    page += direction;
    draw();
    status.scrollIntoView({block: 'nearest'});
  }

  function updateFilters() {
    page = 0;
    draw();
  }

  query.addEventListener('input', updateFilters);
  genre.addEventListener('change', updateFilters);
  draw();
  return () => closeDialog?.();
}
