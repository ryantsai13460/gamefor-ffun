import { games } from './catalog.js';
import { createLibrary, gameAvailability, queryLibrary, restorePreferences } from './library.js';

const storageKey = 'gamefor-ffun-complete-v2';
const pageSize = 24;
const library = createLibrary(games);
const content = document.getElementById('arcade-content');
const globalQuery = document.getElementById('global-query');
const mobileMenu = document.getElementById('mobile-menu');
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('drawer-scrim');
const announce = text => { document.getElementById('announcement').textContent = text; };
const localCount = games.filter(game => game.local).length;
const mainCatalogCount = games.filter(game => game.collection === 'github' || game.collection === 'base44-library').length;
const categories = [...library.categoryCounts.keys()].sort((a, b) => a.localeCompare(b));
const altFeatured = ['2048', 'subway', 'ffun-skyline-v1', 'minecraft-classic', 'snake', 'retrobowl', 'stickman', 'drivemad', 'memory-match', 'pong'];
const drawerMedia = matchMedia('(max-width: 860px)');
const routes = new Set(['home', 'games', 'categories', 'trending', 'new', 'favorites', 'recent', 'youtube', 'movies', 'browse', 'web-search', 'play-hub', 'settings', 'credits', 'play']);
const routeNames = {
  home: 'Home', games: 'All Games', categories: 'Categories', trending: 'Trending',
  new: 'New Games', favorites: 'Favorites', recent: 'Recently Played',
  youtube: 'YouTube', movies: 'Movies', browse: 'Proxy Gemini', 'web-search': 'Web Search', 'play-hub': 'Play Hub',
  settings: 'Settings', credits: 'Credits'
};
const labels = { local: 'Built in', embed: 'In-page player', external: 'External', unverified: 'Link unverified' };

const paths = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  trend: '<path d="m3.5 17 6-6 4 4 7-8m-5 0h5v5"/>',
  spark: '<path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3"/><circle cx="12" cy="12" r="2.5"/>',
  heart: '<path d="M20.8 8.7c0 3.9-4.5 7.4-8.8 11.2C7.7 16.1 3.2 12.6 3.2 8.7a4.4 4.4 0 0 1 8.8-.7 4.4 4.4 0 0 1 8.8.7Z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5v5l3.3 2"/>',
  gamepad: '<path d="M7 7h10c3.1 0 4.2 3 5 7.7.6 3.4-2 4.8-4.3 2.4L15.5 15h-7l-2.2 2.1C4 19.5 1.4 18.1 2 14.7 2.8 10 3.9 7 7 7zM7.5 9.5v4m-2-2h4m6.5.9h.02m2.2-2.1h.02"/>',
  video: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  film: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7.5 4v16m9-16v16M3.5 9h4m-4 6h4m9-6h4m-4 6h4"/>',
  globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6M12 3.2c2.5 2.4 3.9 5.4 3.9 8.8s-1.4 6.4-3.9 8.8C9.5 18.4 8.1 15.4 8.1 12S9.5 5.6 12 3.2Z"/>',
  activity: '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-.5 2.2-2 .9-2.1-.8-1.9 3.3 1.8 1.5v3.8l-1.8 1.5 1.9 3.3 2.1-.8 2 .9L9 21h4l.5-2.2 2-.9 2.1.8 1.9-3.3-1.8-1.5v-3.8l1.8-1.5-1.9-3.3-2.1.8-2-.9L13 3z"/>',
  info: '<circle cx="12" cy="12" r="8.7"/><path d="M12 11.2v5m0-8.3h.01"/>',
  search: '<circle cx="10.6" cy="10.6" r="6"/><path d="m15.3 15.3 4.2 4.2"/>',
  shuffle: '<path d="M3 6h3c4 0 6 12 10 12h4m-3-3 3 3-3 3M3 18h3c1.5 0 2.8-1.7 4-4m4-5c.7-2 1.6-3 3-3h3m-3-3 3 3-3 3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  play: '<path d="m8 4.5 12 7.5L8 19.5z" fill="currentColor" stroke="none"/>',
  fullscreen: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  restart: '<path d="M4 11a8 8 0 1 1 1.6 6.3M4 5v6h6"/>'
};

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = paths[name] || paths.gamepad;
  return svg;
}

function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(text, href, className = '', iconName = '') {
  const node = element('a', className, text);
  node.href = href;
  if (iconName) node.prepend(icon(iconName));
  return node;
}

function action(text, fn, className = 'button', iconName = '') {
  const node = element('button', className, text);
  node.type = 'button';
  if (iconName) node.prepend(icon(iconName));
  node.addEventListener('click', fn);
  return node;
}

function verifiedSource(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch {}
  return '';
}

function external(text, url, className = 'button') {
  const node = link(text, url, className);
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}

function heading(title, description) {
  const block = element('header', 'page-heading');
  block.append(element('h1', 'heading-display', title));
  if (description) block.append(element('p', '', description));
  return block;
}

function empty(title, description) {
  const wrapper = element('div', 'empty-state');
  wrapper.append(element('h2', '', title), element('p', '', description));
  return wrapper;
}

function loadPreferences() {
  try {
    return restorePreferences(JSON.parse(localStorage.getItem(storageKey)), library.byId);
  } catch {
    return restorePreferences(null, library.byId);
  }
}

let prefs = loadPreferences();
function savePreferences() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    announce('Browser storage is unavailable. Changes will last for this visit.');
  }
}

let current = null;
let currentTarget = null;
let previousLibrary = '#home';
let cleanup = () => {};
let version = 0;
let browserModule = null;
const browserTarget = element('div', 'route route-browse');

function readRoute() {
  const hash = location.hash.slice(1);
  const separator = hash.indexOf('?');
  const path = separator < 0 ? hash : hash.slice(0, separator);
  const params = new URLSearchParams(separator < 0 ? '' : hash.slice(separator + 1));
  const [name, id = ''] = path.split('/');
  return { name: routes.has(name) ? name : 'home', id, params, hash: routes.has(name) ? location.hash : '#home' };
}

function hashFor(name, options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value) params.set(key, value);
  return `#${name}${params.size ? `?${params}` : ''}`;
}

function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
  else if (document.body.classList.contains('drawer-open')) setDrawer(false, true);
}

function setDrawer(open, restoreFocus = false) {
  const active = open && drawerMedia.matches;
  document.body.classList.toggle('drawer-open', active);
  scrim.hidden = !active;
  mobileMenu.setAttribute('aria-expanded', String(active));
  mobileMenu.setAttribute('aria-label', active ? 'Close navigation' : 'Open navigation');
  if (active) (sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector('.brand')).focus();
  else if (restoreFocus) mobileMenu.focus();
}

function resolveGame(id) {
  try {
    return library.byId.get(decodeURIComponent(id));
  } catch {
    return undefined;
  }
}

function gamePath(game) {
  return `#play/${encodeURIComponent(game.id)}`;
}

function isFavorite(id) {
  return prefs.favorites.includes(id);
}

function toggleFavorite(id) {
  const game = library.byId.get(id);
  if (!game) return;
  if (isFavorite(game.id)) {
    prefs.favorites = prefs.favorites.filter(value => value !== game.id);
    announce(`Removed ${game.title} from favorites`);
  } else {
    prefs.favorites.unshift(game.id);
    announce(`Saved ${game.title} to favorites`);
  }
  savePreferences();
  return isFavorite(game.id);
}

function setFavoriteButton(node, game, short) {
  const state = isFavorite(game.id);
  node.setAttribute('aria-pressed', String(state));
  node.setAttribute('aria-label', state ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`);
  node.title = node.getAttribute('aria-label');
  if (!short) node.replaceChildren(icon('heart'), document.createTextNode(state ? 'Favorited' : 'Favorite'));
}

function favoriteButton(game, short = true, afterChange) {
  const node = action('', () => {
    toggleFavorite(game.id);
    for (const button of content.querySelectorAll('[data-favorite]')) {
      if (button.dataset.favorite === game.id) setFavoriteButton(button, game, button.classList.contains('favorite-button'));
    }
    afterChange?.();
  }, short ? 'icon-button favorite-button' : 'button', 'heart');
  node.dataset.favorite = game.id;
  setFavoriteButton(node, game, short);
  return node;
}

function artwork(game, eager = false) {
  const visual = element('div', 'card-art');
  const tones = ['#302637', '#243140', '#27362f', '#403127', '#282c42', '#3f2930'];
  const index = [...game.id].reduce((hash, char) => hash + char.codePointAt(0), 0) % tones.length;
  visual.style.setProperty('--tone', tones[index]);
  const fallback = element('div', 'art-placeholder');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.append(icon('gamepad'), element('span', '', game.title));
  visual.append(fallback);
  const source = prefs.artwork && game.art;
  if (source) {
    const picture = element('img', 'art-image');
    picture.alt = '';
    picture.decoding = 'async';
    picture.loading = eager ? 'eager' : 'lazy';
    if (eager) picture.fetchPriority = 'high';
    picture.addEventListener('load', () => picture.classList.add('is-ready'), { once: true });
    picture.addEventListener('error', () => {
      picture.remove();
      visual.classList.add('has-no-art');
    }, { once: true });
    picture.src = source;
    visual.append(picture);
  } else {
    visual.classList.add('has-no-art');
  }
  return visual;
}

function gameCard(game, afterChange) {
  const card = element('article', 'game-card');
  const open = link('', gamePath(game), 'card-link');
  const copy = element('div', 'card-copy');
  const name = element('h3', '', game.title);
  name.title = game.title;
  const meta = element('div', 'card-meta');
  const availability = gameAvailability(game);
  meta.append(element('span', '', game.category), element('span', availability === 'local' ? 'local-label' : '', labels[availability]));
  copy.append(name, meta);
  open.append(artwork(game), copy);
  card.append(open, favoriteButton(game, true, afterChange));
  return card;
}

function grid(items, className = '', afterChange) {
  const list = element('div', `game-grid ${className}`.trim());
  list.replaceChildren(...items.map(game => gameCard(game, afterChange)));
  return list;
}

function distinct(items) {
  return [...new Set(items.filter(Boolean))];
}

function records(ids) {
  return distinct(ids.map(id => library.byId.get(id)));
}

function launch(game) {
  prefs.recent = [game.id, ...prefs.recent.filter(id => id !== game.id)].slice(0, 30);
  prefs.launches[game.id] = Math.min((prefs.launches[game.id] || 0) + 1, Number.MAX_SAFE_INTEGER);
  savePreferences();
}

function featuredGame() {
  return library.byId.get('ffun-circuit-v1') || records(altFeatured)[0] || games[0];
}

function shelf(title, items, browseLabel, browsePath) {
  if (items.length === 0) return null;
  const section = element('section', 'section-block');
  const header = element('div', 'section-heading');
  header.append(element('h2', '', title), link(browseLabel, browsePath, 'text-action'));
  section.append(header, grid(items.slice(0, 6), 'shelf'));
  return section;
}

function renderHome(target) {
  const hero = featuredGame();
  if (!hero) {
    target.append(heading('Gamefor Ffun'), empty('Game library unavailable', 'The catalog could not be loaded.'));
    return;
  }

  const banner = element('section', 'hero-feature');
  const copy = element('div', 'hero-copy');
  const kicker = element('span', 'hero-kicker', 'Featured game');
  kicker.prepend(icon('spark'));
  const desc = hero.id === 'ffun-circuit-v1'
    ? 'Race three courses, hit every checkpoint, and beat your best time.'
    : `${hero.category} game in the arcade library.`;
  copy.append(kicker, element('h1', 'heading-display', hero.title), element('p', '', desc),
    link(hero.local ? 'Play game' : 'View game', gamePath(hero), 'button primary', 'play'));
  const art = artwork(hero, true);
  art.className = `hero-art${art.classList.contains('has-no-art') ? ' has-no-art' : ''}`;
  if (hero.artCredit && prefs.artwork) art.append(element('span', 'hero-credit', hero.artCredit));
  banner.append(copy, art);
  target.append(banner);

  const chips = element('div', 'quick-filters');
  chips.append(link(`All ${games.length} games`, '#games', 'chip is-active', 'grid'));
  for (const category of ['Arcade', 'Racing', 'Puzzle', 'Sports', 'Platformer', 'Parkour', 'Multiplayer']) {
    if (library.categoryCounts.has(category)) chips.append(link(category, hashFor('games', { category }), 'chip'));
  }
  chips.append(link('Categories', '#categories', 'chip', 'layers'));
  target.append(chips);

  const artPicks = games.filter(game => game.art && gameAvailability(game) !== 'unverified');
  const picks = distinct([...records(altFeatured), ...artPicks]).filter(game => game !== hero);
  for (const section of [
    shelf('Featured games', picks, 'All games', '#games'),
    shelf('Recently played', records(prefs.recent), 'Play history', '#recent'),
    shelf('New games', games.filter(game => game.isNew).sort((a, b) => Number(Boolean(b.art)) - Number(Boolean(a.art))), 'New games', '#new'),
    shelf('Built-in arcade', games.filter(game => game.local).sort((a, b) => Number(Boolean(b.art)) - Number(Boolean(a.art))), 'Built-in games', '#games?local=1')
  ]) {
    if (section) target.append(section);
  }
}

function selectField(label, values, selected = '') {
  const field = element('select', 'field');
  for (const [value, title] of values) field.append(new Option(title, value));
  field.value = selected;
  if (field.selectedIndex < 0) field.selectedIndex = 0;
  const wrapper = element('label', '', label);
  wrapper.append(field);
  return { wrapper, field };
}

function renderLibrary(target, route) {
  const { name, params } = route;
  const isLocal = params.get('local') === '1';
  let source = games;
  let description = isLocal
    ? 'These games run directly in the arcade.'
    : 'Find games by title, category, or play option.';
  if (name === 'favorites') {
    source = records(prefs.favorites);
    description = 'Games you have saved in this browser.';
  }
  if (name === 'recent') {
    source = records(prefs.recent);
    description = 'Games and official game pages you opened from this browser.';
  }
  if (name === 'new') {
    source = games.filter(game => game.isNew);
    description = 'Games from the latest recoverable additions to the library.';
  }
  if (name === 'trending') {
    source = games.filter(game => prefs.launches[game.id] > 0);
    description = 'Ranked by game launches in this browser.';
  }
  target.append(heading(isLocal ? 'Built-in Games' : routeNames[name], description));

  if (source.length === 0) {
    const details = {
      favorites: ['No favorites yet', 'Use the heart on a game card to save it here.'],
      recent: ['No play history yet', 'Start a built-in game or visit its official game page.'],
      trending: ['No launches recorded yet', 'Play games to see your most-visited titles here.'],
      new: ['No recent additions', 'Games added in a future catalog update will appear here.']
    };
    const blank = empty(...(details[name] || ['No games here yet', 'Browse the full arcade library.']));
    blank.append(link('Browse games', '#games', 'button primary'));
    target.append(blank);
    return;
  }

  const controls = element('div', 'library-controls');
  const inputLabel = element('label', 'library-query', 'Search games');
  const search = element('input', 'field');
  search.type = 'search';
  search.maxLength = 150;
  search.value = (params.get('q') || '').slice(0, 150);
  search.placeholder = 'Find a title…';
  inputLabel.append(search);
  const category = selectField('Category', [['', 'All categories'], ...categories.map(value => [value, value])], params.get('category') || '');
  const availability = selectField('Play option', [['', 'Any option'], ...Object.entries(labels)], isLocal ? 'local' : params.get('option') || '');
  const hasLaunches = Object.values(prefs.launches).some(count => count > 0);
  const sort = selectField('Sort by', [
    ['', name === 'favorites' ? 'Recently saved' : name === 'new' ? 'Newest added' : name === 'recent' ? 'Recently opened' : 'Catalog order'],
    ['name', 'Name A–Z'], ['category', 'Category'], ...(hasLaunches ? [['popularity', 'Most opened on this browser']] : [])
  ], params.get('sort') || (name === 'trending' ? 'popularity' : ''));
  controls.append(inputLabel, category.wrapper);
  if (!isLocal) controls.append(availability.wrapper);
  controls.append(sort.wrapper);
  const results = element('p', 'library-results');
  results.setAttribute('aria-live', 'polite');
  const listing = element('div');
  const pagination = element('nav', 'pagination');
  pagination.setAttribute('aria-label', 'Game pages');
  const previous = action('Previous', () => changePage(-1));
  const next = action('Next', () => changePage(1));
  const pageOutput = element('span', 'pagination-output');
  pagination.append(previous, pageOutput, next);
  target.append(controls, results, listing, pagination);

  let page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  let pageCount = 1;
  function draw() {
    if (name === 'favorites') source = records(prefs.favorites);
    const filtered = queryLibrary(library, {
      source, search: search.value, category: category.field.value,
      availability: availability.field.value, sort: sort.field.value, launches: prefs.launches
    });
    pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pageCount);
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, filtered.length);
    results.textContent = filtered.length ? `${start + 1}–${end} of ${filtered.length} games` : '0 games found';
    const onFavorite = name === 'favorites' ? () => {
      draw();
      search.focus({ preventScroll: true });
    } : undefined;
    listing.replaceChildren(filtered.length
      ? grid(filtered.slice(start, end), '', onFavorite)
      : empty('No matching games', 'Try a shorter search or reset the category and play option.'));
    previous.disabled = page <= 1;
    next.disabled = page >= pageCount;
    pagination.hidden = pageCount < 2;
    pageOutput.textContent = `Page ${page} of ${pageCount}`;
  }

  function changePage(delta) {
    page = Math.max(1, Math.min(page + delta, pageCount));
    draw();
    rememberFilters();
    results.tabIndex = -1;
    results.focus({ preventScroll: true });
    controls.scrollIntoView({ block: 'start' });
  }

  function resetPage() {
    page = 1;
    draw();
    rememberFilters();
  }

  function rememberFilters() {
    const hash = hashFor(name, {
      q: search.value.trim(), category: category.field.value,
      local: isLocal ? '1' : '', option: isLocal ? '' : availability.field.value,
      sort: sort.field.value, page: page > 1 ? page : ''
    });
    history.replaceState(null, '', hash);
    route.hash = hash;
  }

  search.addEventListener('input', () => {
    globalQuery.value = search.value;
    resetPage();
  });
  for (const select of [category, availability, sort]) select.field.addEventListener('change', resetPage);
  draw();
}

function renderCategories(target) {
  target.append(heading('Categories', 'Browse the arcade by genre.'));
  const list = element('div', 'category-grid');
  const map = { Arcade: 'gamepad', Puzzle: 'grid', Racing: 'activity', Sports: 'trend', Multiplayer: 'globe', Strategy: 'layers' };
  for (const category of categories) {
    const count = library.categoryCounts.get(category);
    const card = link('', hashFor('games', { category }), 'category-card');
    card.append(icon(map[category] || 'gamepad'), element('strong', '', category), element('span', '', `${count} ${count === 1 ? 'game' : 'games'}`));
    list.append(card);
  }
  target.append(list);
}

function renderWebSearch(target) {
  const form = element('form', 'info-panel web-search-form');
  form.action = 'https://duckduckgo.com/';
  form.target = '_blank';
  form.rel = 'noopener noreferrer';
  form.setAttribute('role', 'search');
  form.setAttribute('aria-label', 'Web search');

  const label = element('label', '', 'Search the web');
  const query = element('input', 'field');
  query.type = 'search';
  query.name = 'q';
  query.id = 'web-search-query';
  query.required = true;
  label.htmlFor = query.id;
  const actions = element('div', 'interaction-row');
  const duckDuckGo = element('button', 'button primary', 'Search DuckDuckGo');
  const google = element('button', 'button', 'Search Google');
  duckDuckGo.type = google.type = 'submit';
  google.formAction = 'https://www.google.com/search';
  actions.append(duckDuckGo, google);
  form.append(label, query, actions);
  target.append(heading('Web Search', 'Search from the arcade. Results open on the selected search engine in a new tab.'), form);
}

function renderSettings(target) {
  target.append(heading('Settings', 'Your changes are saved in this browser.'));
  const row = element('div', 'settings-grid');
  const visuals = element('section', 'info-panel');
  const privacy = element('section', 'info-panel');
  visuals.append(element('h2', '', 'Appearance'));
  for (const [key, label] of [['compact', 'Compact game cards'], ['artwork', 'Load game artwork']]) {
    const choice = element('label', 'settings-option', label);
    const check = element('input');
    check.type = 'checkbox';
    check.checked = prefs[key];
    check.addEventListener('change', () => {
      prefs[key] = check.checked;
      document.body.classList.toggle('compact', prefs.compact);
      savePreferences();
      announce(`${label} ${check.checked ? 'on' : 'off'}`);
    });
    choice.prepend(check);
    visuals.append(choice);
  }
  const dialog = document.getElementById('confirm-dialog');
  privacy.append(element('h2', '', 'Play history'), element('p', '', 'Clear favorites, recently played games, and local launch totals.'),
    action('Clear saved games', () => {
      dialog.returnValue = '';
      dialog.showModal();
    }));
  row.append(visuals, privacy);
  target.append(row);
}

function renderCredits(target) {
  target.append(heading('Credits'));
  const sources = element('section', 'info-panel');
  sources.append(element('h2', '', 'Gamefor Ffun / Proxy Arcade'),
    element('p', '', `The arcade lists ${games.length} games, including ${mainCatalogCount} recovered from the main libraries and ${localCount} built-in games. Official or distributor game pages open separately where available.`),
    element('p', '', 'Game artwork, names, videos, and films belong to their respective creators. Game and film details identify source and attribution where available.'),
    element('p', '', 'Third-party video and website playback depends on the publisher, your browser, and your network.'),
    external('GitHub repository', 'https://github.com/ryantsai13460/gamefor-ffun'));
  target.append(sources);
}

function renderGame(target, id) {
  const game = resolveGame(id);
  const back = link('Back to browsing', previousLibrary, 'button player-back');
  target.append(back);
  if (!game) {
    target.append(heading('Game unavailable'), empty('This entry could not be found', 'Try opening the game from All Games.'));
    return () => {};
  }

  const availability = gameAvailability(game);
  const publisherUrl = verifiedSource(game.url);
  const embedUrl = verifiedSource(game.embed);
  const relatedUrl = verifiedSource(game.relatedUrl);
  const localFile = typeof game.local === 'string' && game.local.match(/^(?:\.\/)?([\w.-]+\.html)$/)?.[1];
  const header = element('header', 'player-heading');
  const headingCopy = element('div');
  headingCopy.append(element('p', '', `${game.category} · ${labels[availability]}`), element('h1', '', game.title));
  header.append(artwork(game), headingCopy);
  target.append(header);
  const controls = element('div', 'player-actions interaction-row');
  controls.append(favoriteButton(game, false));
  const status = element('p', 'player-status');
  status.setAttribute('role', 'status');
  const stage = element('div', 'player-stage');
  target.append(controls, status, stage);
  if (game.artCredit && prefs.artwork) target.append(element('p', 'player-note', `Artwork: ${game.artCredit}`));
  let dispose = () => {};
  const scope = new AbortController();
  let revision = 0;

  if (publisherUrl) {
    const publisher = external('Open game source', publisherUrl);
    publisher.addEventListener('click', () => launch(game));
    controls.append(publisher);
  }
  if (relatedUrl) controls.append(external(game.relatedLabel || 'Related publisher site', relatedUrl));

  if (game.local !== true && !localFile && !embedUrl) {
    if (publisherUrl) {
      status.textContent = 'Open the official or distributor page to check play options.';
      stage.append(empty('This game opens separately', 'The game source may require an account, download, or purchase.'));
    } else {
      status.textContent = 'A matching official game page has yet to be verified.';
      stage.append(empty('Play link unavailable', 'This title is preserved in the catalog.'));
    }
    return () => scope.abort();
  }

  const restart = action('Restart', () => start(false), 'button', 'restart');
  const fullscreen = action('Fullscreen', async () => {
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      status.textContent = 'Fullscreen is unavailable in this browser context.';
    }
  }, 'button', 'fullscreen');
  const canFullscreen = Boolean(document.fullscreenEnabled && stage.requestFullscreen);
  restart.disabled = true;
  fullscreen.disabled = true;
  controls.append(restart);
  if (canFullscreen) controls.append(fullscreen);
  document.addEventListener('fullscreenchange', () => {
    fullscreen.replaceChildren(icon('fullscreen'), document.createTextNode(document.fullscreenElement === stage ? 'Exit fullscreen' : 'Fullscreen'));
  }, { signal: scope.signal });

  showStart('Ready to play', game.local ? 'Start the built-in game to activate its controls.' : 'Open the publisher’s embedded player.');

  function showStart(title, text) {
    const welcome = empty(title, text);
    welcome.append(action('Play game', () => start(true), 'button primary start-game', 'play'));
    stage.replaceChildren(welcome);
  }

  async function start(record) {
    const token = ++revision;
    dispose();
    stage.replaceChildren();
    restart.disabled = true;
    fullscreen.disabled = true;
    status.textContent = 'Opening game…';
    if (game.local === true) {
      try {
        const { mountLocalGame } = await import('./local-games.js');
        if (token !== revision) return;
        dispose = mountLocalGame(game.id, stage);
        status.textContent = 'Built-in game ready.';
        restart.disabled = false;
        fullscreen.disabled = !canFullscreen;
        if (record) launch(game);
      } catch {
        if (token !== revision) return;
        status.textContent = 'This game could not start.';
        showStart('Game could not load', 'Try opening the game again.');
      }
      return;
    }

    const frame = element('iframe');
    frame.title = game.title;
    frame.allow = 'fullscreen; autoplay; gamepad';
    frame.allowFullscreen = true;
    if (!game.local) frame.sandbox = 'allow-scripts allow-same-origin allow-pointer-lock allow-presentation';
    const timer = setTimeout(() => {
      if (token !== revision) return;
      status.textContent = publisherUrl ? 'The frame did not respond. Try the game source directly.' : 'The game frame did not respond. Try restarting.';
      restart.disabled = false;
    }, 10000);
    dispose = () => {
      clearTimeout(timer);
      frame.remove();
    };
    frame.addEventListener('load', () => {
      if (token !== revision) return;
      clearTimeout(timer);
      status.textContent = game.local ? 'Built-in game ready.' : 'Publisher player requested. If the game does not appear, open the game source directly.';
      restart.disabled = false;
      fullscreen.disabled = !canFullscreen;
      if (record && game.local) launch(game);
    }, { once: true });
    if (record && !game.local) launch(game);
    frame.src = localFile ? `./${localFile}` : embedUrl;
    stage.append(frame);
  }

  return () => {
    revision++;
    scope.abort();
    dispose();
  };
}

function randomGame() {
  const eligible = games.filter(game => (game.local || game.embed) && (!current || current.id !== game.id));
  if (!eligible.length) {
    announce('There are no built-in games available to select.');
    return;
  }
  const game = eligible[Math.floor(Math.random() * eligible.length)];
  navigate(gamePath(game));
}

async function renderRoute(focus = true) {
  const route = readRoute();
  const token = ++version;
  if (current?.name === 'browse' && browserModule) browserModule.suspendBrowser?.(currentTarget);
  cleanup();
  cleanup = () => {};
  if (current && current.name !== 'play') previousLibrary = current.hash;
  current = route;
  currentTarget = route.name === 'browse' ? browserTarget : element('div', `route route-${route.name}`);
  const target = currentTarget;
  content.replaceChildren(target);
  if (route.name === 'games') globalQuery.value = route.params.get('q') || '';
  document.title = `${route.name === 'play' ? resolveGame(route.id)?.title || 'Game' : routeNames[route.name]} · Gamefor Ffun`;

  document.querySelectorAll('[data-page]').forEach(item => {
    const active = route.name === 'games' && route.params.get('local') === '1' ? 'offline' : route.name;
    if (item.dataset.page === active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  setDrawer(false);
  window.scrollTo(0, 0);
  if (focus) content.focus({ preventScroll: true });

  try {
    switch (route.name) {
      case 'home':
        renderHome(target);
        break;
      case 'games':
      case 'favorites':
      case 'recent':
      case 'new':
      case 'trending':
        renderLibrary(target, route);
        break;
      case 'categories':
        renderCategories(target);
        break;
      case 'play':
        cleanup = renderGame(target, route.id);
        break;
      case 'youtube':
      case 'movies': {
        target.append(element('p', 'boot-note', 'Loading media…'));
        const { renderMedia } = await import('./media.js');
        if (token === version) {
          target.replaceChildren();
          const teardown = renderMedia(target, route.name);
          if (typeof teardown === 'function') cleanup = teardown;
        }
        break;
      }
      case 'web-search':
        renderWebSearch(target);
        break;
      case 'browse': {
        if (!browserModule) target.append(element('p', 'boot-note', 'Loading Proxy Gemini…'));
        browserModule = await import('./browser.js');
        if (token === version) {
          browserModule.renderBrowser(target, route.params.get('address') || '');
        }
        break;
      }
      case 'play-hub': {
        target.append(element('p', 'boot-note', 'Loading Play Hub…'));
        const { renderPlayHub } = await import('./play-hub.js');
        if (token === version) {
          target.replaceChildren();
          renderPlayHub(target, games, {
            openGame: id => { const game = library.byId.get(id); if (game) navigate(gamePath(game)); },
            openBrowser: url => navigate(hashFor('browse', { address: url })),
            isFavorite, toggleFavorite
          });
        }
        break;
      }
      case 'settings':
        renderSettings(target);
        break;
      case 'credits':
        renderCredits(target);
        break;
    }
  } catch (error) {
    if (token !== version) return;
    console.error(error);
    const failure = empty('This page could not load', 'Try reloading or returning home.');
    failure.append(action('Try again', () => renderRoute()), link('Home', '#home', 'button'));
    target.replaceChildren(failure);
  }
}

document.querySelectorAll('[data-icon]').forEach(node => node.prepend(icon(node.dataset.icon)));
document.body.classList.toggle('compact', prefs.compact);
document.getElementById('random-game').addEventListener('click', randomGame);
document.getElementById('random-game').setAttribute('aria-label', 'Random Game');
document.getElementById('global-search').addEventListener('submit', event => {
  event.preventDefault();
  const search = globalQuery.value.trim();
  navigate(hashFor('games', { q: search }));
});
mobileMenu.addEventListener('click', () => setDrawer(!document.body.classList.contains('drawer-open'), true));
scrim.addEventListener('click', () => setDrawer(false, true));
sidebar.addEventListener('click', event => {
  const item = event.target.closest('a');
  if (item && item.hash === location.hash && document.body.classList.contains('drawer-open')) setDrawer(false, true);
});
drawerMedia.addEventListener('change', () => setDrawer(false));
document.addEventListener('keydown', event => {
  const drawerOpen = document.body.classList.contains('drawer-open');
  if (event.key === 'Escape' && drawerOpen) setDrawer(false, true);
  if (event.key === 'Tab' && drawerOpen) {
    const links = [...sidebar.querySelectorAll('a')];
    if (event.shiftKey && document.activeElement === links[0]) {
      event.preventDefault();
      links.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === links.at(-1)) {
      event.preventDefault();
      links[0].focus();
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    if (drawerOpen) setDrawer(false);
    globalQuery.focus();
    globalQuery.select();
  }
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  content.focus();
});
document.getElementById('confirm-dialog').addEventListener('close', event => {
  if (event.currentTarget.returnValue !== 'clear') return;
  prefs = { ...prefs, favorites: [], recent: [], launches: Object.create(null) };
  savePreferences();
  announce('Saved games cleared');
});
window.addEventListener('hashchange', () => renderRoute());
renderRoute(false);
