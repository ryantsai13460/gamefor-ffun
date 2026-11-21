import { arcadeEmbed, isMiniplayAddress } from './embedded-content.js';
import { createSearchFullscreen } from './search-fullscreen.js';
import { gatewayConnected, renderGatewaySettings, searchGateway } from './service-gateway.js';

const assetVersion = new URL(import.meta.url).search;
const [{ games }, { createLibrary, gameAvailability, normalize, queryLibrary, restorePreferences }] = await Promise.all([
  import(`./catalog.js${assetVersion}`),
  import(`./library.js${assetVersion}`)
]);

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
const routes = new Set(['home', 'explore', 'games', 'categories', 'trending', 'new', 'favorites', 'recent', 'youtube', 'movies', 'music', 'browse', 'web-search', 'blip', 'play-hub', 'settings', 'credits', 'play']);
const routeNames = {
  home: 'Home', explore: 'Explore', games: 'All Games', categories: 'Categories', trending: 'Trending',
  new: 'New Games', favorites: 'Favorites', recent: 'Recently Played',
  youtube: 'YouTube', movies: 'Movies', music: 'Music', browse: 'Proxy Gemini', 'web-search': 'Web Search', blip: 'blip.ai', 'play-hub': 'Play Hub',
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
  music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.3"/><ellipse cx="17" cy="16" rx="3" ry="2.3"/>',
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
let webProviderEnabled = false;
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

  const destinations = element('section', 'home-destinations');
  const destinationGrid = element('div', 'home-destination-grid');
  for (const [name, href, symbol, color] of [
    ['Explore', '#explore', 'layers', 'games'],
    ['Video library', '#youtube?format=all', 'video', 'video'],
    ['Cinema', '#movies', 'film', 'film'],
    ['blip.ai chat', '#blip', 'spark', 'ai']
  ]) {
    const destination = link(name, href, 'explore-tile', symbol);
    destination.dataset.color = color;
    destinationGrid.append(destination);
  }
  destinations.append(element('h2', '', 'Watch, learn, and play'), destinationGrid);
  if (!prefs.hiddenHome.includes('destinations')) target.append(destinations);

  const artPicks = games.filter(game => game.art && gameAvailability(game) !== 'unverified');
  const picks = distinct([...records(altFeatured), ...artPicks]).filter(game => game !== hero);
  for (const [key, ...args] of [
    ['featured', 'Featured games', picks, 'All games', '#games'],
    ['recent', 'Recently played', records(prefs.recent), 'Play history', '#recent'],
    ['new', 'New games', games.filter(game => game.isNew).sort((a, b) => Number(Boolean(b.art)) - Number(Boolean(a.art))), 'New games', '#new'],
    ['built-in', 'Built-in arcade', games.filter(game => game.local).sort((a, b) => Number(Boolean(b.art)) - Number(Boolean(a.art))), 'Built-in games', '#games?local=1']
  ]) {
    if (prefs.hiddenHome.includes(key)) continue;
    const section = shelf(...args);
    if (section) target.append(section);
  }

  const miniplayGames = games.filter(game => isMiniplayAddress(game.embed));
  if (miniplayGames.length) {
    const provider = element('section', 'section-block info-panel');
    const items = element('div', 'interaction-row');
    for (const game of miniplayGames) items.append(external(game.title, game.url));
    provider.append(element('h2', '', 'Miniplay links'), element('p', '', 'These games open on Miniplay in a new tab.'), items);
    target.append(provider);
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
  const title = heading(isLocal ? 'Built-in Games' : routeNames[name], description);
  const fullscreen = name === 'games' ? createSearchFullscreen(target, { label: 'Game library' }) : null;
  if (fullscreen) {
    title.classList.add('game-library-heading');
    title.append(fullscreen.controls);
  }
  target.append(title);

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
    return fullscreen?.dispose;
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
  return fullscreen?.dispose;
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

function mountSearchPanel(target, modules, { setTitle }, mode, initialQuery) {
  const { media, searchWikipedia, renderGoogleSearch, renderSearchMaps, renderAssistantPanel, gameSearchSources, openSearchResource } = modules;
  const { findCuratedVideos, openSearchVideoDialog, openShortsFeed, openYouTubeSearchVideo, parseYouTubeVideo, searchConnectedVideos } = media;
  const windowPanel = element('section', 'proxy-window web-search-window');
  const fullscreen = createSearchFullscreen(windowPanel, { label: 'Game search' });
  const toolbar = element('div', 'search-fullscreen-toolbar');
  const nav = element('div', 'proxy-tab-row web-search-tabs');
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', 'Web Search tools');
  toolbar.append(nav, fullscreen.controls);
  const searchPanel = element('div');
  const aiPanel = element('div');
  const googlePanel = element('div', 'proxy-stage web-search-stage');
  const mapPanel = element('div', 'proxy-stage web-search-stage');
  const panels = new Map([
    ['Web & YouTube', searchPanel], ['AI Mode', aiPanel], ['Google', googlePanel], ['Maps', mapPanel]
  ]);

  function queryForm(label, placeholder, buttonLabel) {
    const form = element('form', 'proxy-toolbar web-search-toolbar');
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', label);
    const address = element('div', 'proxy-address');
    address.append(icon('search'));
    const input = element('input', 'field');
    input.type = 'search';
    input.required = true;
    input.maxLength = 200;
    input.autocomplete = 'off';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', label);
    address.append(input);
    const submit = element('button', 'button primary', buttonLabel);
    submit.type = 'submit';
    form.append(address, submit);
    return { form, input };
  }

  const { form, input } = queryForm('Search the web', 'Search games, topics, or YouTube links', 'Search');
  const suggestions = element('datalist');
  suggestions.id = `${target.id}-search-suggestions`;
  input.setAttribute('list', suggestions.id);
  form.append(suggestions);
  const historyKey = 'ffun.web-search.history';
  let recent = [];
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey));
    if (Array.isArray(saved)) recent = saved.filter(item => typeof item === 'string' && item.length <= 200).slice(0, 20);
  } catch {}
  function updateSuggestions() {
    const query = input.value.trim();
    const titles = [...recent, ...queryLibrary(library, { search: query }).slice(0, 9).map(game => game.title)];
    const options = [...new Set(titles)].filter(title => title.toLowerCase().includes(query.toLowerCase())).slice(0, 9);
    suggestions.replaceChildren(...options.map(title => new Option(title, title)));
  }
  input.addEventListener('input', updateSuggestions);
  updateSuggestions();
  const stage = element('div', 'proxy-stage web-search-stage');
  const answer = element('section', 'web-search-answer');
  answer.setAttribute('aria-live', 'polite');
  const answerTitle = element('h2', '', 'Web & YouTube');
  const answerText = element('p', 'muted', 'Find games, wiki references, and YouTube videos together.');
  answer.append(answerTitle, answerText);
  const webPanel = element('section', 'web-search-videos');
  webPanel.hidden = true;
  const webList = element('ul', 'web-search-results');
  webPanel.append(element('h2', '', 'Wiki and references'), webList);
  const gamePanel = element('section', 'web-search-videos');
  gamePanel.hidden = true;
  const gameList = element('ul', 'web-search-results');
  gamePanel.append(element('h2', '', 'Games'), gameList);
  const providerPanel = element('section', 'web-search-videos');
  providerPanel.hidden = true;
  const providerList = element('ul', 'web-search-results');
  const providerStatus = element('p', 'muted');
  providerStatus.setAttribute('role', 'status');
  providerPanel.append(element('h2', '', 'Web results'), providerStatus, providerList);
  let showProvider = false;
  const groups = element('div', 'interaction-row search-result-groups');
  groups.setAttribute('role', 'group');
  groups.setAttribute('aria-label', 'Result category');
  groups.hidden = true;
  const noResults = element('p', 'muted');
  noResults.setAttribute('role', 'status');
  noResults.hidden = true;
  const musicResults = link('Search Music', '#music', 'button');
  musicResults.hidden = true;
  const videosPanel = element('section', 'web-search-videos');
  videosPanel.hidden = true;
  const videoCount = element('p', 'muted');
  const videoFilters = element('div', 'interaction-row');
  videoFilters.setAttribute('role', 'group');
  videoFilters.setAttribute('aria-label', 'Video format');
  const scrollShorts = action('Scroll matching Shorts', () => {
    closeVideo?.();
    closeVideo = openShortsFeed(windowPanel, matches.filter(video => video.short), { inPageOnly: true });
  });
  scrollShorts.setAttribute('aria-haspopup', 'dialog');
  const videoTools = element('div', 'interaction-row');
  videoTools.append(videoFilters, scrollShorts);
  const list = element('ul', 'web-search-results');
  const videoPagination = element('div', 'interaction-row');
  const previous = action('Previous video results', () => { page--; drawVideoPage(); });
  const next = action('Next video results', () => { page++; drawVideoPage(); });
  videoPagination.append(previous, next);
  videosPanel.append(element('h2', '', 'YouTube'), videoTools, videoCount, list, videoPagination);
  const resultTools = element('div', 'interaction-row search-result-tools');
  resultTools.append(groups, musicResults);
  stage.append(answer, resultTools, noResults, gamePanel, webPanel, videosPanel, providerPanel);
  renderGatewaySettings(stage, 'Connect a web search provider', () => { webProviderEnabled = gatewayConnected(); });
  searchPanel.append(form, stage);

  windowPanel.append(toolbar, ...panels.values());
  target.append(windowPanel);

  let pending;
  let closeVideo;
  let disposeMap;
  let disposeGoogle;
  let disposeAssistant;
  let mapReady = false;
  let googleReady = false;
  let aiReady = false;
  let matches = [];
  let videoDescription = '';
  let format = 'All';
  let page = 0;
  let group = 'All results';
  let searched = false;
  const videosPerPage = 20;

  function showResults() {
    groups.hidden = !searched;
    musicResults.hidden = !searched;
    for (const item of groups.children) item.setAttribute('aria-pressed', String(item.textContent === group));
    gamePanel.hidden = !searched || !gameList.childElementCount || !['All results', 'Games'].includes(group);
    webPanel.hidden = !searched || !webList.childElementCount || !['All results', 'Wiki'].includes(group);
    videosPanel.hidden = !searched || !['All results', 'YouTube'].includes(group);
    providerPanel.hidden = !searched || !showProvider || !['All results', 'Web'].includes(group);
    groups.lastElementChild.hidden = !showProvider;
    const emptyGroup = (group === 'Games' && gamePanel.hidden) || (group === 'Wiki' && webPanel.hidden);
    noResults.hidden = !searched || !emptyGroup;
    noResults.textContent = emptyGroup ? `No ${group === 'Wiki' ? 'wiki references' : 'games'} match this search.` : '';
  }

  for (const name of ['All results', 'Games', 'Wiki', 'YouTube', 'Web']) {
    groups.append(action(name, () => {
      group = name;
      showResults();
    }));
  }

  function selectPanel(name) {
    for (const [label, panel] of panels) panel.hidden = label !== name;
    for (const item of nav.children) item.setAttribute('aria-pressed', String(item.textContent === name));
    if (name === 'Maps' && !mapReady) {
      disposeMap = renderSearchMaps(mapPanel);
      mapReady = true;
    }
    if (name === 'Google' && !googleReady) {
      disposeGoogle = renderGoogleSearch(googlePanel, {
        onQuery: setTitle,
        onArcadeSearch(query) {
          input.value = query;
          selectPanel('Web & YouTube');
          form.requestSubmit();
        }
      });
      googleReady = true;
    }
    if (name === 'AI Mode' && !aiReady) {
      disposeAssistant = renderAssistantPanel(aiPanel, { onQuery: setTitle, findVideos: findCuratedVideos });
      aiReady = true;
    }
  }

  for (const name of panels.keys()) {
    nav.append(action(name, () => selectPanel(name), 'button web-search-tab'));
  }
  selectPanel(new Map([['ai', 'AI Mode'], ['google', 'Google'], ['maps', 'Maps']]).get(mode) || 'Web & YouTube');

  function openResource(resource) {
    closeVideo?.();
    closeVideo = openSearchResource(windowPanel, resource);
  }

  function drawAnswer(title, text) {
    answerTitle.textContent = title;
    answerText.textContent = text;
    answerText.hidden = !text;
  }

  function drawGames(found) {
    gameList.replaceChildren(...found.map(game => {
      const item = element('li', 'web-search-game');
      const site = gameSearchSources[game.id]?.site;
      item.append(element('strong', '', game.title), element('p', 'muted', site?.description || game.category));
      if (game.local || arcadeEmbed(game)) {
        item.append(link(`Play ${game.title}`, gamePath(game), 'button', 'play'));
      } else if (site?.preview) {
        item.append(action(`Preview ${game.title}`, () => openResource({
          ...site, provider: 'Official game', preview: site.url
        }), 'button', 'play'));
      } else {
        item.append(link(`View ${game.title}`, gamePath(game), 'button'));
      }
      return item;
    }));
  }

  function drawReferences(resources) {
    webList.replaceChildren(...resources.map(resource => {
      const item = element('li');
      item.append(
        action(resource.title, () => openResource(resource), 'button'),
        element('p', 'muted', resource.description),
        element('span', 'muted', resource.provider)
      );
      return item;
    }));
  }

  async function loadProviderResults(query, signal) {
    providerList.replaceChildren();
    providerStatus.textContent = 'Searching the connected provider…';
    try {
      const results = await searchGateway(query, AbortSignal.any([signal, AbortSignal.timeout(10000)]));
      if (signal.aborted) return;
      providerStatus.textContent = results.length ? '' : 'The connected provider found no results.';
      providerList.replaceChildren(...results.map(result => {
        const item = element('li');
        const description = element('p', 'muted', result.description);
        const destination = element('p', 'search-resource-source', result.url);
        const actions = element('div', 'interaction-row');
        actions.append(link('Preview website', hashFor('browse', { address: result.url }), 'button'),
          external('Open website', result.url));
        item.append(element('strong', '', result.title), description, destination, actions);
        return item;
      }));
    } catch (error) {
      if (!signal.aborted) providerStatus.textContent = error.message || 'The connected provider could not be reached.';
    }
  }

  function drawVideoPage() {
    const filtered = format === 'All' ? matches : matches.filter(video => Boolean(video.short) === (format === 'Shorts'));
    const start = page * videosPerPage;
    for (const item of videoFilters.children) item.setAttribute('aria-pressed', String(item.textContent === format));
    scrollShorts.hidden = format === 'Videos' || !matches.some(video => video.short);
    videoCount.textContent = filtered.length
      ? `${videoDescription} Showing ${start + 1}–${Math.min(start + videosPerPage, filtered.length)} of ${filtered.length}.`
      : (matches.length ? 'No results in this video format.' : 'No matches in the arcade’s YouTube library. You can paste a YouTube link to open it here.');
    list.replaceChildren(...filtered.slice(start, start + videosPerPage).map(video => {
      const item = element('li');
      const play = action(video.title, () => {
        closeVideo?.();
        closeVideo = openSearchVideoDialog(windowPanel, video);
      }, 'button web-search-video', 'play');
      const thumbnail = element('img', 'web-search-thumbnail');
      thumbnail.alt = '';
      thumbnail.loading = 'lazy';
      thumbnail.decoding = 'async';
      thumbnail.addEventListener('error', () => thumbnail.remove(), { once: true });
      thumbnail.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
      play.prepend(thumbnail);
      item.append(play, element('span', 'muted', [video.creator, video.short ? 'Short' : 'Video'].filter(Boolean).join(' · ')));
      return item;
    }));
    previous.disabled = page === 0;
    next.disabled = start + videosPerPage >= filtered.length;
    videoPagination.hidden = filtered.length <= videosPerPage;
  }

  for (const name of ['All', 'Videos', 'Shorts']) {
    videoFilters.append(action(name, () => {
      format = name;
      page = 0;
      drawVideoPage();
    }));
  }

  function drawVideos(found, description) {
    matches = found;
    videoDescription = description;
    page = 0;
    drawVideoPage();
    showResults();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    pending?.abort();
    const query = input.value.trim();
    if (!query) {
      drawAnswer('Search', 'Enter a search term.');
      return;
    }
    setTitle(query);
    recent = [query, ...recent.filter(item => item !== query)].slice(0, 20);
    try { localStorage.setItem(historyKey, JSON.stringify(recent)); } catch {}
    updateSuggestions();
    closeVideo?.();
    pending = new AbortController();
    const { signal } = pending;
    const video = parseYouTubeVideo(query);
    const searchQuery = query.replace(/\b(?:violion|violon)\b/gi, 'violin');
    const normalized = normalize(searchQuery.replace(/^https?:\/\/(?:www\.)?/i, ''));
    const matchingGames = normalized.length < 3 ? [] : queryLibrary(library, { search: normalized }).slice(0, 5);
    const exact = matchingGames.find(game => [game.id, game.title, ...(game.aliases || [])].some(label => normalize(label) === normalized));
    const official = exact && gameSearchSources[exact.id];
    const references = [official?.reference, official?.site].filter(Boolean);
    const localMatches = [...new Map([
      ...(official?.videos || []), ...findCuratedVideos(searchQuery)
    ].map(video => [video.id, video])).values()];
    group = 'All results';
    searched = false;
    if (video && (query !== video.id || localMatches.some(item => item.id === video.id))) {
      showResults();
      drawAnswer('YouTube', 'The official YouTube player opens here when the video allows embedding.');
      closeVideo = openYouTubeSearchVideo(windowPanel, query);
      return;
    }
    searched = true;
    showProvider = webProviderEnabled && gatewayConnected();
    if (showProvider) void loadProviderResults(searchQuery, signal);
    musicResults.href = hashFor('music', { q: searchQuery });
    format = 'All';
    drawGames(exact ? [exact, ...matchingGames.filter(game => game !== exact)] : matchingGames);
    drawReferences(references);
    drawVideos(localMatches, 'Arcade YouTube library.');
    if (exact && references.length) drawAnswer(exact.title, 'Explore the game, read a reference, or play a matching video here.');
    searchConnectedVideos(searchQuery, AbortSignal.any([signal, AbortSignal.timeout(6500)])).then(online => {
      if (signal.aborted || !online?.length) return;
      const onlineIds = new Set(online.map(item => item.id));
      matches = [...online, ...localMatches.filter(item => !onlineIds.has(item.id))];
      videoDescription = 'Connected YouTube search and arcade library.';
      drawVideoPage();
    }).catch(() => {
      if (!signal.aborted) {
        videoDescription = 'Connected search unavailable. Arcade library.';
        drawVideoPage();
      }
    });
    if (exact && references.length) return;
    drawAnswer('Web results', 'Looking up Wikipedia…');
    const found = await searchWikipedia(searchQuery, AbortSignal.any([signal, AbortSignal.timeout(5000)])).catch(() => []);
    if (signal.aborted) return;
    drawAnswer(`Results for “${query}”`, found.length ? '' : 'No Wikipedia excerpt is available for this search.');
    drawReferences(found.map(article => ({
      title: article.title, description: article.text, url: article.url, provider: 'Wikipedia · CC BY-SA 4.0'
    })));
    showResults();
  });

  if (initialQuery) {
    selectPanel('Web & YouTube');
    input.value = initialQuery.slice(0, input.maxLength);
    form.requestSubmit();
  }

  return () => {
    pending?.abort();
    closeVideo?.();
    disposeMap?.();
    disposeGoogle?.();
    disposeAssistant?.();
    fullscreen.dispose();
  };
}

function renderSettings(target) {
  target.append(heading('Settings', 'Your changes are saved in this browser.'));
  const row = element('div', 'settings-grid');
  const visuals = element('section', 'info-panel');
  const privacy = element('section', 'info-panel');
  visuals.append(element('h2', '', 'Appearance'));
  const theme = selectField('Theme', [['midnight', 'Midnight'], ['graphite', 'Graphite']], prefs.theme);
  theme.field.addEventListener('change', () => {
    prefs.theme = theme.field.value;
    document.body.dataset.theme = prefs.theme;
    savePreferences();
  });
  visuals.append(theme.wrapper);
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
  const home = element('section', 'info-panel');
  home.append(element('h2', '', 'Home sections'));
  for (const [key, title] of [
    ['destinations', 'Media shortcuts'], ['featured', 'Featured games'], ['recent', 'Recently played'],
    ['new', 'New games'], ['built-in', 'Built-in arcade']
  ]) {
    const choice = element('label', 'settings-option', title);
    const check = element('input');
    check.type = 'checkbox';
    check.checked = !prefs.hiddenHome.includes(key);
    check.addEventListener('change', () => {
      prefs.hiddenHome = check.checked ? prefs.hiddenHome.filter(id => id !== key) : [...prefs.hiddenHome, key];
      savePreferences();
    });
    choice.prepend(check);
    home.append(choice);
  }
  const dialog = document.getElementById('confirm-dialog');
  privacy.append(element('h2', '', 'Play history'), element('p', '', 'Clear favorites, recently played games, and local launch totals.'),
    action('Clear saved games', () => {
      dialog.returnValue = '';
      dialog.showModal();
    }));
  row.append(visuals, home, privacy);
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
  const embedUrl = verifiedSource(arcadeEmbed(game));
  const relatedUrl = verifiedSource(game.relatedUrl);
  const localFile = typeof game.local === 'string' && game.local.match(/^(?:\.\/)?([\w.-]+\.html)$/)?.[1];
  const header = element('header', 'player-heading');
  const headingCopy = element('div');
  headingCopy.append(element('p', '', `${game.category} · ${labels[availability]}`), element('h1', '', game.title));
  header.append(artwork(game), headingCopy);
  target.append(header);
  const controls = element('div', 'player-actions interaction-row');
  controls.append(favoriteButton(game, false),
    link('Find wiki and videos', hashFor('web-search', { q: game.title }), 'button', 'search'));
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
      if (isMiniplayAddress(publisherUrl)) {
        status.textContent = 'This catalog entry uses Miniplay.';
        stage.append(empty('Publisher link available', 'Use the publisher link if Miniplay is available on your connection.'));
      } else {
        const preview = empty('Preview the game site', 'The preview stays in the arcade when the publisher allows embedding.');
        preview.append(link('Open in Proxy Gemini', hashFor('browse', { address: publisherUrl }), 'button primary'));
        stage.append(preview);
      }
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
      showFrameError('The player did not respond.');
    }, 10000);
    function showFrameError(message) {
      dispose();
      status.textContent = message;
      showStart('Game could not load', publisherUrl ? 'Try again or use the official game source.' : 'Try opening the game again.');
    }
    dispose = () => {
      clearTimeout(timer);
      frame.remove();
    };
    frame.addEventListener('load', () => {
      if (token !== revision) return;
      clearTimeout(timer);
      if (localFile && frame.contentDocument?.title !== game.title) {
        showFrameError('The built-in game file did not load.');
        return;
      }
      status.textContent = game.local ? 'Built-in game ready.' : 'Publisher player requested. If the game does not appear, open the game source directly.';
      restart.disabled = false;
      fullscreen.disabled = !canFullscreen;
      if (record && game.local) launch(game);
    }, { once: true });
    frame.addEventListener('error', () => {
      if (token === revision) showFrameError('The player failed to load.');
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
  const eligible = games.filter(game => (game.local || arcadeEmbed(game)) && (!current || current.id !== game.id));
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
  if (['games', 'web-search'].includes(route.name)) globalQuery.value = route.params.get('q') || '';
  globalQuery.placeholder = ['play', 'web-search'].includes(route.name) ? 'Search games, wikis, and videos…' : 'Search games…';
  document.title = `${route.name === 'play' ? resolveGame(route.id)?.title || 'Game' : routeNames[route.name]} · Gamefor Ffun`;

  document.querySelectorAll('[data-page]').forEach(item => {
    const offline = route.name === 'games' && route.params.get('local') === '1';
    const assistant = route.name === 'web-search' && route.params.get('mode') === 'ai';
    const active = offline ? 'offline' : assistant ? 'ai-help' : route.name;
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
      case 'explore': {
        target.append(element('p', 'boot-note', 'Loading collections…'));
        const { renderExplore } = await import(`./explore.js${assetVersion}`);
        if (token === version) {
          const newLocalGames = games.filter(game => game.local && game.collection === 'original').slice(-3);
          renderExplore(target, {
            gamesSection: shelf('New built-in games', newLocalGames, 'All built-in games', '#games?local=1'),
            localCount,
            arcadeFeature: library.byId.get('comet-courier')
          });
        }
        break;
      }
      case 'games':
      case 'favorites':
      case 'recent':
      case 'new':
      case 'trending':
        cleanup = renderLibrary(target, route) || (() => {});
        break;
      case 'categories':
        renderCategories(target);
        break;
      case 'play':
        cleanup = renderGame(target, route.id);
        break;
      case 'youtube': {
        target.append(element('p', 'boot-note', 'Loading videos…'));
        const { renderVideoLibrary } = await import(`./media.js${assetVersion}`);
        if (token === version) cleanup = renderVideoLibrary(target, route.params);
        break;
      }
      case 'movies': {
        target.append(element('p', 'boot-note', 'Loading movies…'));
        const [{ renderFilms }, { watchDialog }] = await Promise.all([
          import('./film-library.js'), import(`./media.js${assetVersion}`)
        ]);
        if (token === version) cleanup = renderFilms(target, { watchDialog, collection: route.params.get('collection') });
        break;
      }
      case 'music': {
        target.append(element('p', 'boot-note', 'Loading music…'));
        const render = route.params.has('view')
          ? (await import(`./music-library.js${assetVersion}`)).renderMusic
          : (await import(`./lyrics-library.js${assetVersion}`)).renderLyrics;
        if (token === version) cleanup = render(target, route.params);
        break;
      }
      case 'blip': {
        target.append(element('p', 'boot-note', 'Loading blip.ai…'));
        const { renderBlip } = await import(`./blip.js${assetVersion}`);
        if (token === version) cleanup = renderBlip(target);
        break;
      }
      case 'web-search': {
        const [media, { searchWikipedia }, { renderGoogleSearch }, { renderSearchMaps }, { renderAssistantPanel }, { renderSearchTabs },
          { gameSearchSources }, { openSearchResource }] = await Promise.all([
          import(`./media.js${assetVersion}`), import('./search-answer.js'), import('./search-google.js'),
          import('./search-map.js'), import('./assistant-panel.js'), import('./search-tabs.js'),
          import('./search-game-sources.js'), import(`./search-resource.js${assetVersion}`)
        ]);
        if (token === version) {
          target.append(heading('Web Search', 'Search, watch, and ask questions in separate tabs.'));
          const modules = { media, searchWikipedia, renderGoogleSearch, renderSearchMaps, renderAssistantPanel, gameSearchSources, openSearchResource };
          let firstMode = route.params.get('mode');
          let firstQuery = route.params.get('q')?.trim();
          cleanup = renderSearchTabs(target, (panel, tools) => {
            const teardown = mountSearchPanel(panel, modules, tools, firstMode, firstQuery);
            firstMode = null;
            firstQuery = null;
            return teardown;
          });
        }
        break;
      }
      case 'browse': {
        if (!browserModule) target.append(element('p', 'boot-note', 'Loading Proxy Gemini…'));
        browserModule = await import(`./browser.js${assetVersion}`);
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
document.body.dataset.theme = prefs.theme;
document.getElementById('random-game').addEventListener('click', randomGame);
document.getElementById('random-game').setAttribute('aria-label', 'Random Game');
document.getElementById('global-search').addEventListener('submit', event => {
  event.preventDefault();
  const search = globalQuery.value.trim();
  const useWebSearch = ['play', 'web-search'].includes(current?.name);
  navigate(hashFor(useWebSearch ? 'web-search' : 'games', { q: search }));
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
