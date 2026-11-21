const version = new URL(import.meta.url).search;
const { normalize } = await import(`./library.js${version}`);
const kinds = [['all', 'All'], ['games', 'Games'], ['movies', 'Movies'], ['music', 'Music'], ['videos', 'Videos']];
const labels = new Map(kinds);
const historyKey = 'ffun.discovery.history';
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
const musicLink = song => route('music', { view: 'videos', track: song.id });
const videoLink = video => route('youtube', { format: video.short ? 'shorts' : 'all', video: video.id });

function item(type, title, subtitle, image, href, terms = '') {
  return { type, title, subtitle, image, href, terms };
}

function filmItem(film) {
  return item('movies', film.title, [film.year, film.fullVideo || film.embed || film.fullWatch ? film.genres?.[0] : 'Trailer'].filter(Boolean).join(' · '), film.art, filmLink(film),
    [film.genres, film.description, film.credit].flat().filter(Boolean).join(' '));
}

function songItem(song) {
  return item('music', song.title, song.artist, song.thumbnail || thumbnail(song.id), musicLink(song),
    [song.category, song.style].filter(Boolean).join(' '));
}

function videoItem(video) {
  return item('videos', video.title, [video.creator, video.short ? 'Short' : 'Video'].filter(Boolean).join(' · '),
    video.thumbnail || thumbnail(video.id), videoLink(video), video.tags?.join(' '));
}

function gameItem(game, showArtwork) {
  return item('games', game.title, game.category, showArtwork ? game.art : '', '#play/' + encodeURIComponent(game.id),
    [game.id, game.description, ...(game.aliases || [])].filter(Boolean).join(' '));
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

function card(record) {
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
  if (record.subtitle) info.append(element('p', 'muted', record.subtitle));
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
const musicData = () => import(`./music-catalog.js${version}`);
const videoData = () => import(`./media.js${version}`);

function prepare(records) {
  return records.map(record => {
    const title = normalize(record.title);
    return { record, title, searchable: normalize([record.title, record.subtitle, record.terms].join(' ')) };
  });
}

export function renderDiscovery(target, { params, games, showArtwork, onRouteChange }) {
  let active = true;
  let prepared = prepare(games.map(game => gameItem(game, showArtwork)));
  const unavailable = new Set();
  let pending = true;
  let cachedHistory = history();
  let selected = labels.has(params.get('type')) ? params.get('type') : 'all';
  let query = (params.get('q') || '').slice(0, 150);
  let limit = batch;

  const header = heading('Search the library', 'Find games, movies, songs, and videos from the arcade catalogs.');
  const form = element('form', 'discovery-form');
  form.setAttribute('role', 'search');
  form.setAttribute('aria-label', 'Library search');
  const input = element('input', 'field');
  input.type = 'search';
  input.maxLength = 150;
  input.placeholder = 'Search titles, artists, or topics';
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

  const recent = element('div', 'interaction-row discovery-recent');
  const status = element('p', 'muted discovery-status');
  status.setAttribute('role', 'status');
  const listing = element('div', 'discovery-grid');
  const more = button('Load more results', () => {
    const first = listing.childElementCount;
    limit += batch;
    draw();
    listing.children[first]?.focus({ preventScroll: true });
  });
  const web = link('Search the web', '#web-search', 'button');
  const actions = element('div', 'interaction-row discovery-actions');
  actions.append(more, web);
  target.replaceChildren(header, form, filters, recent, status, listing, actions);

  function saveRoute() {
    const parameters = {};
    if (query) parameters.q = query;
    if (selected !== 'all') parameters.type = selected;
    const hash = route('discover', parameters);
    window.history.replaceState(null, '', hash);
    onRouteChange(hash, query);
  }

  function rememberQuery() {
    if (!query) return;
    const normalizedQuery = normalize(query);
    cachedHistory = [query, ...cachedHistory.filter(term => normalize(term) !== normalizedQuery)].slice(0, 8);
    saveHistory(cachedHistory);
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
    const matches = prepared.filter(({ record, searchable }) =>
      (selected === 'all' || selected === record.type) && terms.every(term => searchable.includes(term)));
    if (text) matches.sort((left, right) => score(right.title) - score(left.title));
    function score(title) {
      return (title === text ? 40 : title.startsWith(text) ? 22 : title.includes(text) ? 12 : 0)
        + terms.filter(term => title.includes(term)).length * 3;
    }
    for (const [key, control] of typeButtons) control.setAttribute('aria-pressed', String(key === selected));
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
    const incomplete = [...unavailable].filter(key => selected === 'all' || selected === key).map(key => labels.get(key));
    const total = matches.length
      ? `Showing ${Math.min(limit, matches.length)} of ${matches.length} results`
      : 'No matching titles';
    status.textContent = pending && selected !== 'games'
      ? 'Loading media catalogs…'
      : total + (incomplete.length ? `. Unavailable catalogs include ${incomplete.join(', ')}.` : '');
    listing.replaceChildren(...matches.slice(0, limit).map(({ record }) => card(record)));
    more.hidden = limit >= matches.length;
    web.href = query ? route('web-search', { q: query }) : '#web-search';
  }

  input.addEventListener('input', () => { clear.hidden = !input.value; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    applyQuery();
  });
  rememberQuery();
  draw();

  Promise.allSettled([
    filmData().then(({ filmCatalog }) => filmCatalog.map(filmItem)),
    musicData().then(({ musicCatalog }) => musicCatalog.map(songItem)),
    videoData().then(({ getCuratedVideos }) => getCuratedVideos().map(videoItem))
  ]).then(results => {
    if (!active) return;
    const media = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') media.push(...result.value);
      else unavailable.add(kinds[index + 2][0]);
    });
    prepared = [...prepared, ...prepare(media)];
    pending = false;
    draw();
  });
  return () => { active = false; };
}

export function renderSavedLibrary(target, { favorites, recent, showArtwork }) {
  let active = true;
  const sections = element('div', 'discovery-shelves');
  const loading = element('p', 'muted', 'Loading saved media…');
  target.replaceChildren(heading('My library', 'Your saved games, media, and chats in this browser.'), sections, loading);
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
    import(`./music-library.js${version}`).then(({ getMusicLibraryState }) => getMusicLibraryState()),
    videoData().then(({ getVideoLibraryState }) => getVideoLibraryState()),
    import(`./blip.js${version}`).then(({ getBlipChatSummary }) => getBlipChatSummary())
  ]).then(([films, music, videos, chats]) => {
    if (!active) return;
    if (films.status === 'fulfilled') {
      featured('Saved movies', films.value.saved.map(filmItem), '#movies?collection=favorites', 'All saved movies');
      featured('Movie watchlist', films.value.watchlist.map(filmItem), '#movies?collection=watchlist', 'Open watchlist');
      featured('Continue watching', films.value.continuing.map(filmItem), '#movies?collection=continuing', 'Open Continue watching');
    }
    if (music.status === 'fulfilled') {
      featured('Saved music', music.value.saved.map(songItem), '#music?view=saved', 'All saved music');
      featured('Recently played music', music.value.recent.map(songItem), '#music?view=recent', 'All recently played music');
      shortcuts('Music playlists', music.value.playlists.map(playlist => [
        playlist.name, route('music', { view: 'playlists', playlist: playlist.id })
      ]), '#music?view=playlists', 'All music playlists');
    }
    if (videos.status === 'fulfilled') {
      featured('Favorite videos', videos.value.favorites.map(videoItem), '#youtube?format=favorites', 'All favorite videos');
      featured('Recently watched videos', videos.value.watched.map(videoItem), '#youtube?format=recent', 'Recent videos');
    }
    if (chats.status === 'fulfilled') shortcuts('Blip chats', chats.value.map(chat => [chat.title, route('blip', { chat: chat.id })]), '#blip', 'Open blip.ai');
    if (!sections.childElementCount) {
      sections.append(element('p', 'empty-state', 'Save a game, movie, song, video, or chat to see it here.'));
    }
    loading.hidden = [films, music, videos, chats].every(result => result.status === 'fulfilled');
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

function homeMediaLane({ title, records, href, browse, shortcut }) {
  const [featured, ...more] = records;
  if (!featured) return null;
  const lane = element('section', 'home-media-lane');
  lane.dataset.media = featured.type;
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
  const [films, music, videos] = await Promise.allSettled([
    Promise.all([filmData(), import(`./film-playback.js${version}`)]),
    musicData(),
    videoData()
  ]);
  if (!target.isConnected) return;
  const shelves = element('div', 'home-media-lanes');
  if (films.status === 'fulfilled') {
    const [{ featuredFilm, filmCatalog }, { filmPlayback }] = films.value;
    const fullFilms = filmCatalog.filter(film => filmPlayback(film));
    const lane = homeMediaLane({
      title: 'Featured films',
      records: homeMediaPicks(fullFilms, [featuredFilm.id, 'little-bear-movie', 'waterwalker'], filmItem),
      href: '#movies', browse: 'Browse movies',
      shortcut: watching ? ['Recently added films', '#movies?collection=additions'] : ['Family films', '#movies?collection=family']
    });
    if (lane) shelves.append(lane);
  }
  if (music.status === 'fulfilled') {
    const { featuredTrack, musicCatalog } = music.value;
    const chartPicks = musicCatalog.filter(song => song.chart).map(song => song.id);
    const lane = homeMediaLane({
      title: 'Music picks',
      records: homeMediaPicks(musicCatalog, [featuredTrack.id, ...chartPicks.slice(0, 2)], songItem),
      href: '#music?view=videos', browse: 'Browse music',
      shortcut: ['Watch lyrics', '#music?lyrics=watch']
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
