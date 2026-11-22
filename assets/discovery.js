const version = new URL(import.meta.url).search;
const [{ discoverySearchHistoryKey: historyKey, gameAvailability, normalize }, { filmPlayback },
  { createGameAddressLookup }] = await Promise.all([
  import(`./library.js${version}`), import(`./film-playback.js${version}`), import(`./game-play-policy.js${version}`)
]);
const kinds = [
  ['all', 'All'], ['games', 'Games'], ['movies', 'Movies'], ['music', 'Music'], ['videos', 'Videos'],
  ['products', 'Products'], ['bookmarks', 'Bookmarks']
];
const labels = new Map(kinds);
const playLabels = { local: 'Built in', embed: 'In-page player', external: 'Catalog only', unverified: 'Play unavailable' };
const resultFilters = {
  games: {
    key: 'play', label: 'Game player',
    options: [['', 'Any play option'], ['in-page', 'Playable here'], ['local', 'Built in'], ['embed', 'In-page player']],
    matches: (item, value) => value === 'in-page' ? ['local', 'embed'].includes(item.availability) : item.availability === value
  },
  movies: {
    key: 'watch', label: 'Movie playback',
    options: [['', 'Any movie'], ['full', 'Full movies'], ['embedded', 'Full movies playable here'], ['trailer', 'Trailer-only listings']],
    matches: (item, value) => value === 'full' ? ['embedded', 'provider'].includes(item.playback) : item.playback === value
  },
  videos: {
    key: 'format', label: 'Video format',
    options: [['', 'Any format'], ['standard', 'Full videos'], ['shorts', 'Shorts'], ['tiktok', 'TikTok'], ['instagram', 'Instagram Reels']],
    matches: (item, value) => value === 'shorts' ? item.short : value === 'standard' ? !item.short : item.provider === value
  }
};
const batch = 24;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(label, href, className = 'text-action') {
  const result = element('a', className, label);
  result.href = href;
  return result;
}

function button(label, action) {
  const result = element('button', 'button', label);
  result.type = 'button';
  result.addEventListener('click', action);
  return result;
}

function route(name, params = {}) {
  const query = new URLSearchParams(params);
  return '#' + name + (query.size ? '?' + query : '');
}

const thumbnail = id => /^[a-z\d_-]{11}$/i.test(id) ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : '';
const filmLink = film => route('movies', { film: film.id });
const musicLink = song => route('music', { track: song.id });
const videoLink = video => route('youtube', { format: video.short ? 'shorts' : 'all', video: video.id });

function item(type, title, subtitle, image, href, terms = '') {
  return { type, title, subtitle, image, href, terms };
}

function filmItem(film) {
  const full = filmPlayback(film);
  const playback = full?.embed ? 'embedded' : full ? 'provider' : filmPlayback(film, true) ? 'trailer' : '';
  const subtitle = [film.year, full ? film.genres?.[0] : playback === 'trailer' ? 'Trailer' : 'Catalog listing'];
  return {
    ...item('movies', film.title, subtitle.filter(Boolean).join(' · '), film.art, filmLink(film),
      [film.genres, film.description, film.credit].flat().filter(Boolean).join(' ')),
    playback
  };
}

function songItem(song) {
  return item('music', song.title, song.artist, song.thumbnail || thumbnail(song.id), song.href || musicLink(song),
    [song.category, song.genre, song.kind, song.channel, song.style].filter(Boolean).join(' '));
}

function archiveSongItem(song) {
  return { ...songItem(song), href: route('music', { view: 'videos', track: song.id }) };
}

function videoItem(video) {
  return {
    ...item('videos', video.title, [video.creator, video.short ? 'Short' : 'Video'].filter(Boolean).join(' · '),
      video.thumbnail || thumbnail(video.id), videoLink(video), video.tags?.join(' ')),
    short: Boolean(video.short)
  };
}

function shortItem(short, provider, href) {
  return {
    ...item('videos', short.title, [short.creator, provider].filter(Boolean).join(' · '), short.thumbnail,
      href, [...(short.tags || []), ...(short.categories || []), short.description].filter(Boolean).join(' ')),
    short: true, provider: short.provider
  };
}

function gameItem(game, showArtwork) {
  const aliases = [game.id, ...(game.aliases || [])];
  return {
    ...item('games', game.title, game.category, showArtwork ? game.art : '', '#play/' + encodeURIComponent(game.id),
      [game.description, ...aliases].filter(Boolean).join(' ')),
    id: game.id, aliases, availability: gameAvailability(game)
  };
}

function history() {
  try {
    const list = JSON.parse(localStorage.getItem(historyKey));
    if (Array.isArray(list)) return list.filter(value => typeof value === 'string' && value.length <= 150).slice(0, 8);
  } catch {}
  return [];
}

function saveHistory(list) {
  try { localStorage.setItem(historyKey, JSON.stringify(list)); } catch {}
}

function card(record, exactMatch = false) {
  const anchor = link('', record.href, 'discovery-card');
  anchor.dataset.type = record.type;
  const artwork = element('div', 'discovery-art');
  artwork.setAttribute('aria-hidden', 'true');
  artwork.append(element('span', '', record.title));
  if (record.image) {
    const image = element('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => image.classList.add('is-ready'), { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = record.image;
    artwork.append(image);
  }
  const info = element('div', 'discovery-card-copy');
  info.append(element('p', 'discovery-kind', labels.get(record.type)), element('h3', '', record.title));
  const subtitle = [record.subtitle, playLabels[record.availability]].filter(Boolean).join(' · ');
  if (subtitle) info.append(element('p', 'muted', subtitle));
  if (exactMatch === true) info.append(element('p', 'discovery-exact', 'Exact match'));
  anchor.append(artwork, info);
  return anchor;
}

function heading(title, description) {
  const header = element('header', 'page-heading');
  header.append(element('h1', 'heading-display', title));
  if (description) header.append(element('p', '', description));
  return header;
}

function shelf(title, records, href, label, shortcut) {
  const section = element('section', 'section-block');
  const caption = element('div', 'section-heading');
  const actions = element('div', 'interaction-row');
  if (shortcut) actions.append(shortcut);
  actions.append(link(label, href));
  caption.append(element('h2', '', title), actions);
  const grid = element('div', 'discovery-grid');
  grid.append(...records.map(card));
  section.append(caption, grid);
  return section;
}

const filmData = () => import(`./film-catalog.js${version}`);
const musicData = () => import(`./lyrics-library.js${version}`);
const videoData = () => import(`./media.js${version}`);
const shortData = () => import(`./shorts-catalog.js${version}`);
const searchData = () => import(`./search-catalog.js${version}`);
const domainAddress = /^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+(?::\d+)?(?:[/?#]\S*)?$/u;

const isSearchText = query => Boolean(query && !/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(query)
  && !/^[\w-]+(?:\.[\w-]+)+[/?#]\S*$/u.test(query));

function productItem(product) {
  return {
    ...item('products', product.title, [product.retailer, product.categoryName].filter(Boolean).join(' · '),
      product.image, product.link, [product.description, product.terms, ...product.specs.flat()].join(' ')),
    aliases: product.aliases
  };
}

function bookmarkItem(bookmark) {
  return {
    ...item('bookmarks', bookmark.title, bookmark.address, '', bookmark.link),
    aliases: [bookmark.address]
  };
}

function prepare(records) {
  return records.map(record => {
    const title = normalize(record.title);
    return {
      record, title, aliases: (record.aliases || []).map(normalize),
      searchable: normalize([record.title, record.subtitle, record.terms, ...(record.aliases || [])].join(' '))
    };
  });
}

let mediaIndex;
function prepareMedia() {
  const types = ['movies', 'music', 'videos', 'videos', 'products'];
  mediaIndex ??= Promise.allSettled([
    filmData().then(({ filmCatalog }) => filmCatalog.map(filmItem)),
    musicData().then(async ({ findLyricVideos }) => (await findLyricVideos('')).map(songItem)),
    videoData().then(({ getCuratedVideos }) => getCuratedVideos().map(videoItem)),
    shortData().then(({ getShortCatalog, shortsLink, shortProviders }) => getShortCatalog().filter(video => video.provider !== 'youtube')
      .map(video => shortItem(video, shortProviders[video.provider].label, shortsLink(video)))),
    searchData().then(async ({ searchProducts }) => (await searchProducts()).map(productItem))
  ]).then(results => {
    const unavailable = [...new Set(types.filter((type, index) => results[index].status === 'rejected'))];
    if (unavailable.length) mediaIndex = undefined;
    return { index: prepare(results.flatMap(result => result.status === 'fulfilled' ? result.value : [])), unavailable };
  });
  return mediaIndex;
}

export function renderDiscovery(target, { params, games, showArtwork, rememberSearches = true, onRouteChange }) {
  let active = true;
  let prepared = prepare(games.map(game => gameItem(game, showArtwork)));
  let bookmarks = [];
  let unavailable = [];
  let pending = true;
  let cachedHistory = rememberSearches ? history() : [];
  let selected = labels.has(params.get('type')) ? params.get('type') : 'all';
  let query = (params.get('q') || '').slice(0, 150);
  let limit = batch;
  const gameAtAddress = createGameAddressLookup(games);

  const header = heading('Search the library', 'Find games, movies, lyric videos, shorts, products, and your saved bookmarks.');
  const form = element('form', 'discovery-form');
  form.setAttribute('role', 'search');
  form.setAttribute('aria-label', 'Library search');
  const input = element('input', 'field');
  input.type = 'search';
  input.maxLength = 150;
  input.placeholder = 'Search titles, artists, products, or bookmarks';
  input.setAttribute('aria-label', 'Library query');
  input.value = query;
  const submit = element('button', 'button primary', 'Search');
  submit.type = 'submit';
  const clear = button('Clear search', () => {
    input.value = '';
    applyQuery();
    input.focus();
  });
  form.append(input, submit, clear);
  const filters = element('div', 'interaction-row discovery-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Content type');
  const typeButtons = new Map(kinds.map(([value, label]) => [
    value, button(label, () => {
      selected = value;
      limit = batch;
      saveRoute();
      draw();
    })
  ]));
  filters.append(...typeButtons.values());
  const filterControls = new Map(Object.entries(resultFilters).map(([type, config]) => {
    const label = element('label', 'discovery-result-filter', config.label);
    const field = element('select', 'field');
    field.append(...config.options.map(([value, text]) => new Option(text, value)));
    const initial = params.get(config.key);
    if (config.options.some(([value]) => value === initial)) field.value = initial;
    field.addEventListener('change', () => {
      limit = batch;
      saveRoute();
      draw();
    });
    label.append(field);
    filters.append(label);
    return [type, { ...config, label, field }];
  }));

  const recent = element('div', 'interaction-row discovery-recent');
  const status = element('p', 'muted discovery-status');
  status.setAttribute('role', 'status');
  const listing = element('div', 'discovery-results');
  const more = button('Load more results', () => {
    const first = listing.querySelectorAll('.discovery-card').length;
    limit += batch;
    draw();
    [...listing.querySelectorAll('.discovery-card')].find(node => Number(node.dataset.resultIndex) >= first)?.focus();
  });
  const web = link('Search the web', '#web-search', 'button');
  const proxy = link('Open in Proxy Gemini', '#browse', 'button');
  const shopping = link('Search Shopping', '#shopping', 'button');
  const blip = link('Ask Blip', '#blip', 'button');
  const shorts = link('Browse Short Videos', '#shorts', 'button');
  const actions = element('div', 'interaction-row discovery-actions');
  actions.append(more, web, proxy, shopping, shorts, blip);
  target.replaceChildren(header, form, filters, recent, status, listing, actions);

  function saveRoute() {
    const parameters = {};
    if (query) parameters.q = query;
    if (selected !== 'all') parameters.type = selected;
    const filter = filterControls.get(selected);
    if (filter?.field.value) parameters[filter.key] = filter.field.value;
    const hash = route('discover', parameters);
    window.history.replaceState(null, '', hash);
    onRouteChange(hash, query);
  }

  function rememberQuery() {
    if (!rememberSearches || selected === 'bookmarks' || !isSearchText(query) || domainAddress.test(query) || matchingGame(query)) return;
    const normalizedQuery = normalize(query);
    cachedHistory = [query, ...cachedHistory.filter(term => normalize(term) !== normalizedQuery)].slice(0, 8);
    saveHistory(cachedHistory);
  }

  function matchingGame(value) {
    return value.includes('.') && (gameAtAddress(value) || gameAtAddress('https://' + value));
  }

  function applyQuery() {
    query = input.value.trim();
    limit = batch;
    rememberQuery();
    saveRoute();
    draw();
  }

  function draw() {
    if (!active) return;
    const text = normalize(query);
    const terms = text.split(' ').filter(Boolean);
    const addressMatch = matchingGame(query);
    const filter = filterControls.get(selected);
    const filterValue = filter?.field.value;
    const matches = (selected === 'all' || selected === 'bookmarks' ? [...prepared, ...bookmarks] : prepared).filter(({ record, searchable }) =>
      (selected === 'all' || selected === record.type) && (!filterValue || filter.matches(record, filterValue)) &&
      ((addressMatch && record.id === addressMatch.id) || terms.every(term => searchable.includes(term))));
    if (text) matches.sort((left, right) => score(right) - score(left));
    function isExact({ record, title, aliases }) {
      return Boolean(text && (title === text || aliases.includes(text) || (addressMatch && record.id === addressMatch.id)));
    }
    function score({ record, title, aliases }) {
      if (addressMatch && record.id === addressMatch.id) return 80;
      return (title === text ? 40 : aliases.includes(text) ? 32 : title.startsWith(text) ? 22 : title.includes(text) ? 12 : 0)
        + terms.filter(term => title.includes(term)).length * 3;
    }
    for (const [key, control] of typeButtons) control.setAttribute('aria-pressed', String(key === selected));
    for (const [key, control] of filterControls) control.label.hidden = selected !== key;
    clear.hidden = !input.value;
    recent.replaceChildren();
    if (!query && cachedHistory.length) {
      recent.append(element('span', 'muted', 'Recent searches'));
      for (const term of cachedHistory) {
        recent.append(button(term, () => {
          input.value = term;
          applyQuery();
        }));
      }
      recent.append(button('Clear recent searches', () => {
        cachedHistory = [];
        saveHistory([]);
        draw();
        input.focus();
      }));
    }
    const incomplete = unavailable.filter(key => selected === 'all' || selected === key).map(key => labels.get(key));
    const seen = new Set();
    const distinct = matches.filter(({ record }) => {
      if (seen.has(record.href)) return false;
      seen.add(record.href);
      return true;
    });
    const total = distinct.length
      ? `Showing ${Math.min(limit, distinct.length)} of ${distinct.length} results`
      : 'No matching titles';
    status.textContent = pending && selected !== 'games' && !addressMatch
      ? 'Loading catalogs and bookmarks…'
      : total + (incomplete.length ? `. Unavailable catalogs include ${incomplete.join(', ')}.` : '');
    const focusedHref = listing.contains(document.activeElement) && document.activeElement.getAttribute('href');
    const groups = new Map();
    const grouped = Boolean(text && selected === 'all');
    distinct.slice(0, limit).forEach((entry, index) => {
      const key = grouped ? entry.record.type : selected;
      if (!groups.has(key)) groups.set(key, element('div', 'discovery-grid'));
      const result = card(entry.record, isExact(entry));
      result.dataset.resultIndex = index;
      groups.get(key).append(result);
    });
    listing.replaceChildren(...[...groups].map(([key, grid]) => {
      if (!grouped) return grid;
      const section = element('section', 'discovery-result-group');
      section.setAttribute('aria-label', labels.get(key));
      section.append(element('h2', '', labels.get(key)), grid);
      return section;
    }));
    if (focusedHref) [...listing.querySelectorAll('.discovery-card')]
      .find(node => node.getAttribute('href') === focusedHref)?.focus({ preventScroll: true });
    more.hidden = limit >= distinct.length;
    web.href = query ? route('web-search', { q: query }) : '#web-search';
    proxy.hidden = !(domainAddress.test(query) || /^https:\/\/\S+$/i.test(query));
    proxy.href = proxy.hidden ? '#browse' : route('browse', { address: query });
    const canDraft = isSearchText(query);
    blip.hidden = !canDraft;
    blip.href = canDraft ? route('blip', { draft: query, research: query }) : '#blip';
    shopping.href = canDraft ? route('shopping', { q: query }) : '#shopping';
    shorts.href = canDraft ? route('shorts', { q: query }) : '#shorts';
  }

  input.addEventListener('input', () => { clear.hidden = !input.value; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    applyQuery();
  });
  rememberQuery();
  draw();

  Promise.allSettled([prepareMedia(), searchData().then(({ searchBookmarks }) => searchBookmarks())]).then(([media, saved]) => {
    if (!active) return;
    if (media.status === 'fulfilled') {
      unavailable = media.value.unavailable;
      prepared = [...prepared, ...media.value.index];
    } else {
      unavailable = ['movies', 'music', 'videos', 'products'];
    }
    if (saved.status === 'fulfilled') bookmarks = prepare(saved.value.map(bookmarkItem));
    else unavailable.push('bookmarks');
    pending = false;
    draw();
  });
  return () => { active = false; };
}

export function renderSavedLibrary(target, { favorites, recent, showArtwork, profileName }) {
  let active = true;
  const sections = element('div', 'discovery-shelves');
  const loading = element('p', 'muted', 'Loading saved media…');
  const profile = element('section', 'info-panel profile-summary');
  const initial = element('span', 'profile-initial', profileName[0].toUpperCase());
  initial.setAttribute('aria-hidden', 'true');
  profile.setAttribute('aria-label', 'Your Gamffun profile');
  profile.append(initial, element('h2', '', profileName), link('Edit profile', '#settings?panel=profile'));
  target.replaceChildren(heading('My library', 'Saved games, media, bookmarks, and chats on this device.'), profile, sections, loading);
  const featured = (title, records, href, text) => {
    if (records.length) sections.append(shelf(title, records.slice(0, 6), href, text));
  };
  function shortcuts(title, items, href, label) {
    if (!items.length) return;
    const section = element('section', 'section-block');
    const header = element('div', 'section-heading');
    header.append(element('h2', '', title), link(label, href));
    const links = element('div', 'interaction-row');
    links.append(...items.slice(0, 6).map(([name, destination]) => link(name, destination, 'button')));
    section.append(header, links);
    sections.append(section);
  }
  featured('Favorite games', favorites.map(game => gameItem(game, showArtwork)), '#favorites', 'All favorite games');
  featured('Recently played games', recent.map(game => gameItem(game, showArtwork)), '#recent', 'All recently played games');

  Promise.allSettled([
    import(`./film-library.js${version}`).then(({ getFilmLibraryState }) => getFilmLibraryState()),
    musicData().then(({ getLyricLibraryState }) => getLyricLibraryState()),
    videoData().then(({ getVideoLibraryState }) => getVideoLibraryState()),
    import(`./blip.js${version}`).then(({ getBlipChatSummary }) => getBlipChatSummary()),
    import(`./browser.js${version}`).then(({ getBrowserLibraryState }) => getBrowserLibraryState()),
    Promise.all([import(`./shopping-data.js${version}`), import(`./shopping-products.js${version}`)]).then(([shopping, products]) =>
      ({ ...shopping.getShoppingLibraryState(), shoppingLink: shopping.shoppingLink, shoppingCategory: shopping.shoppingCategory,
        amazonProduct: products.amazonProduct })),
    import(`./music-library.js${version}`).then(({ getMusicLibraryState }) => getMusicLibraryState()),
    Promise.all([import(`./shorts.js${version}`), shortData()]).then(([{ getShortLibraryState }, catalog]) =>
      ({ ...getShortLibraryState(), ...catalog }))
  ]).then(results => {
    if (!active) return;
    const [films, music, videos, chats, browser, shopping, archive, shorts] = results;
    if (films.status === 'fulfilled') {
      featured('Saved movies', films.value.saved.map(filmItem), '#movies?collection=favorites', 'All saved movies');
      featured('Movie watchlist', films.value.watchlist.map(filmItem), '#movies?collection=watchlist', 'Open watchlist');
      featured('Continue watching', films.value.continuing.map(filmItem), '#movies?collection=continuing', 'Open Continue watching');
    }
    if (music.status === 'fulfilled') {
      featured('Saved lyric videos', music.value.saved.map(songItem), '#music?collection=saved', 'All saved lyric videos');
      featured('Recently played lyric videos', music.value.recent.map(songItem), '#music?collection=recent', 'All recently played lyric videos');
      shortcuts('Lyric video playlists', music.value.playlists.map(playlist => [
        playlist.name, route('music', { collection: 'playlists', playlist: playlist.id })
      ]), '#music?collection=playlists', 'All lyric video playlists');
    }
    if (archive.status === 'fulfilled') {
      featured('Saved music', archive.value.saved.map(archiveSongItem), '#music?view=saved', 'All saved archive music');
      featured('Recently played music', archive.value.recent.map(archiveSongItem), '#music?view=recent', 'Open archive history');
      shortcuts('Music playlists', archive.value.playlists.map(playlist => [
        playlist.name, route('music', { view: 'playlists', playlist: playlist.id })
      ]), '#music?view=playlists', 'All archive playlists');
    }
    if (videos.status === 'fulfilled') {
      featured('YouTube watch queue', (videos.value.queue || []).map(video => ({
        ...videoItem(video), href: route('youtube', { format: 'queue', video: video.id })
      })), '#youtube?format=queue', 'Open watch queue');
      featured('Favorite videos', videos.value.favorites.map(videoItem), '#youtube?format=favorites', 'All favorite videos');
      featured('Recently watched videos', videos.value.watched.map(videoItem), '#youtube?format=recent', 'Recent videos');
    }
    if (shorts.status === 'fulfilled') {
      const { favorites: shortFavorites, recent: shortRecent, shortProviders, shortsLink } = shorts.value;
      const toCard = video => shortItem(video, shortProviders[video.provider].label, shortsLink(video));
      featured('Favorite short videos', shortFavorites.map(toCard), '#shorts?view=favorites', 'All favorite short videos');
      featured('Recently watched short videos', shortRecent.map(toCard), '#shorts?view=watched', 'Recent short videos');
    }
    if (chats.status === 'fulfilled') shortcuts('Blip chats', chats.value.map(chat => [chat.title, route('blip', { chat: chat.id })]), '#blip', 'Open blip.ai');
    if (browser.status === 'fulfilled') {
      shortcuts('Proxy Gemini bookmarks', browser.value.favorites.map(page => [page.title, route('browse', { address: page.address })]),
        '#browse?panel=favorites', 'Manage bookmarks');
      shortcuts('Proxy Gemini history', browser.value.history.map(page => [page.title, route('browse', { address: page.address })]),
        '#browse?panel=history', 'Manage browsing history');
    }
    if (shopping.status === 'fulfilled') {
      const { saved, products, shoppingLink, shoppingCategory, amazonProduct } = shopping.value;
      shortcuts('Saved shopping searches', saved.map(search => [search.query || shoppingCategory(search.category)?.title, shoppingLink(search)]),
        '#shopping', 'Open Shopping');
      shortcuts('Saved Amazon picks', products.map(amazonProduct).filter(Boolean).map(product => [
        `${product.brand} ${product.title}`, shoppingLink({ product: product.asin })
      ]), '#shopping?retailer=amazon', 'Browse Amazon picks');
    }
    if (!sections.childElementCount) {
      sections.append(element('p', 'empty-state', 'Save a game, movie, song, video, or chat to see it here.'));
    }
    loading.hidden = results.every(result => result.status === 'fulfilled');
    loading.textContent = 'Some saved libraries are unavailable.';
    target.append(link('Theme and saved-game preferences', '#settings', 'button'));
  });
  return () => { active = false; };
}

function homeMediaCard(record, featured) {
  const anchor = link('', record.href, featured ? 'home-media-lead' : 'home-media-item');
  if (record.image) {
    const art = element('div', 'home-media-art');
    art.setAttribute('aria-hidden', 'true');
    const image = element('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => art.classList.add('is-ready'), { once: true });
    image.addEventListener('error', () => art.remove(), { once: true });
    image.src = record.image;
    art.append(image);
    anchor.append(art);
  }
  const copy = element('div', 'home-media-copy');
  copy.append(element('h4', '', record.title));
  if (record.subtitle) copy.append(element('p', '', record.subtitle));
  anchor.append(copy);
  return anchor;
}

function homeMediaLane({ title, records, href, browse, shortcut, kind }) {
  const [featured, ...more] = records;
  if (!featured) return null;
  const lane = element('section', 'home-media-lane');
  lane.dataset.media = kind || featured.type;
  const heading = element('header', 'home-media-heading');
  heading.append(element('h3', '', title), link(browse, href));
  lane.append(heading, homeMediaCard(featured, true));
  if (more.length) {
    const listing = element('ul', 'home-media-list');
    for (const record of more) {
      const row = element('li');
      row.append(homeMediaCard(record, false));
      listing.append(row);
    }
    lane.append(listing);
  }
  if (shortcut) {
    const actions = element('div', 'home-media-actions');
    actions.append(link(...shortcut));
    lane.append(actions);
  }
  return lane;
}

function homeMediaPicks(catalog, preferred, format) {
  const selection = [...new Map([
    ...preferred.map(id => catalog.find(record => record.id === id)).filter(Boolean),
    ...catalog
  ].map(record => [record.id, record])).values()];
  return selection.slice(0, 3).map(format);
}

export async function populateHomeMedia(target, { watching = false } = {}) {
  const [films, music, videos, shorts] = await Promise.allSettled([
    Promise.all([filmData(), import(`./film-playback.js${version}`)]),
    musicData().then(({ findLyricVideos }) => findLyricVideos('')),
    videoData(),
    shortData()
  ]);
  if (!target.isConnected) return;
  const shelves = element('div', 'home-media-lanes');
  if (films.status === 'fulfilled') {
    const [{ featuredFilm, filmCatalog }, { filmPlayback }] = films.value;
    const fullFilms = filmCatalog.filter(film => filmPlayback(film));
    if (watching) fullFilms.sort((a, b) => (Date.parse(b.addedAt) || 0) - (Date.parse(a.addedAt) || 0));
    const lane = homeMediaLane({
      title: watching ? 'New to the library' : 'Featured films',
      records: homeMediaPicks(fullFilms, watching ? [] : [featuredFilm.id, 'little-bear-movie', 'waterwalker'], filmItem),
      href: '#movies', browse: 'Browse movies',
      shortcut: watching ? ['Recently added films', '#movies?collection=additions'] : ['Family films', '#movies?collection=family']
    });
    if (lane) shelves.append(lane);
  }
  if (music.status === 'fulfilled') {
    const lane = homeMediaLane({
      title: 'Lyric video picks', records: homeMediaPicks(music.value, [], songItem),
      href: '#music', browse: 'Browse music', shortcut: ['New lyric videos', '#music?collection=new']
    });
    if (lane) shelves.append(lane);
  }
  if (shorts.status === 'fulfilled') {
    const { getShortCatalog, shortsLink, shortProviders } = shorts.value;
    const catalog = getShortCatalog();
    const providers = ['youtube', 'tiktok', 'instagram'];
    const picks = providers.map(provider => catalog.find(video => video.provider === provider)?.id).filter(Boolean);
    const lane = homeMediaLane({
      title: 'Short Videos', kind: 'shorts', records: homeMediaPicks(catalog, picks,
        video => shortItem(video, shortProviders[video.provider].label, shortsLink(video))),
      href: '#shorts', browse: 'Open short feed'
    });
    if (lane) shelves.append(lane);
  }
  if (videos.status === 'fulfilled') {
    const topic = watching ? 'Education' : 'Gaming';
    const picks = videos.value.getCuratedVideos().filter(video => video.tags.includes(topic));
    const lane = homeMediaLane({
      title: watching ? 'Learning videos' : 'Gaming videos',
      records: homeMediaPicks(picks, watching ? [] : ['NWjkbAQOGY8', '7fRbU-uUNQA', 'ftnaXStTPBY'], videoItem),
      href: `#youtube?format=all&topic=${topic}`, browse: 'Browse videos',
      shortcut: watching ? ['New videos', '#youtube?format=new'] : ['MrBeast videos', '#youtube?format=all&q=MrBeast']
    });
    if (lane) shelves.append(lane);
  }
  if (!shelves.childElementCount) return;
  const region = element('section', 'home-media-region');
  const title = element('h2', '', 'Watch and listen');
  title.id = 'home-media-title';
  region.setAttribute('aria-labelledby', title.id);
  region.append(title, shelves);
  target.replaceChildren(region);
}
