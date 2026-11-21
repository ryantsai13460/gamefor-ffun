const assetVersion = new URL(import.meta.url).search;
const [{ watchDialog }, { featuredTrack, musicCatalog }] = await Promise.all([
  import(`./media.js${assetVersion}`),
  import(`./music-catalog.js${assetVersion}`)
]);

export {featuredTrack, musicCatalog};

const genreNames = new Set(musicCatalog.map(({category}) => category));
const primaryCategories = ['Imagine Dragons', 'Benson Boone', 'Chart picks', 'Pop']
  .filter(name => genreNames.delete(name));
const CATEGORIES = ['All music', ...primaryCategories, ...genreNames];
const SECTIONS = [
  {id: 'discover', label: 'Discover', empty: 'No tracks match your search.'},
  {id: 'saved', label: 'Saved music', empty: 'Save a music video to add it to this playlist.'},
  {id: 'recent', label: 'Recently played', empty: 'Music videos appear here after playback starts.'}
];
const QUERY_FILLER = new Set('can could find hear let listen me music of play please show song songs some to tracks would you'.split(' '));
const PAGE_SIZE = 18;
const STORAGE_KEY = 'ffun-music-preferences-v1';
const byId = new Map(musicCatalog.map(track => [track.id, track]));

function normalized(value) {
  return value.toLowerCase().normalize('NFKD').replace(/\p{Mark}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function findMusicTracks(query = '') {
  if (typeof query !== 'string') return [];
  const text = normalized(query);
  if (!text) return [...musicCatalog];
  const words = text.split(' ').filter((word) => !QUERY_FILLER.has(word));
  if (!words.length) return [...musicCatalog];
  return musicCatalog.map((track) => {
    const title = normalized(track.title);
    const artist = normalized(track.artist);
    const style = normalized(`${track.style} ${track.category}`);
    const fields = [title, artist, style];
    if (words.some((word) => !fields.some((field) => field.includes(word)))) return null;
    const score = (title === text ? 20 : title.includes(text) ? 8 : 0) +
      words.reduce((sum, word) => sum + (title.includes(word) ? 3 : artist.includes(word) ? 2 : 1), 0);
    return {track, score};
  }).filter(Boolean).sort((first, second) => second.score - first.score).map(({track}) => track);
}

function readPreferences() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    stored = {};
  }
  const ids = (value, limit) => Array.isArray(value)
    ? [...new Set(value.filter(id => byId.has(id)))].slice(0, limit)
    : [];
  return {saved: ids(stored?.saved, 200), recent: ids(stored?.recent, 50)};
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function action(label, activate, primary = false) {
  const node = element('button', `button${primary ? ' primary' : ''}`, label);
  node.type = 'button';
  node.addEventListener('click', activate);
  return node;
}

function artwork(track, feature = false) {
  const art = element('span', feature ? 'music-art music-feature-art' : 'music-art');
  const placeholder = element('span', 'music-art-title', track.title);
  placeholder.setAttribute('aria-hidden', 'true');
  const picture = element('img', feature ? 'music-feature-cover' : '');
  picture.alt = '';
  picture.loading = feature ? 'eager' : 'lazy';
  picture.decoding = 'async';
  picture.referrerPolicy = 'strict-origin-when-cross-origin';
  if (feature) picture.fetchPriority = 'high';
  picture.addEventListener('load', () => picture.classList.add('is-ready'), { once: true });
  picture.addEventListener('error', () => picture.remove(), { once: true });
  picture.src = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
  art.append(placeholder, picture);
  return art;
}

function durationText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function renderMusic(target, params) {
  const state = readPreferences();
  let section = SECTIONS.some(({id}) => id === params?.get('view')) ? params.get('view') : 'discover';
  let category = CATEGORIES.includes(params?.get('category')) ? params.get('category') : 'All music';
  let matches = [];
  let shown = 0;
  let closed = false;
  let closePlayer;
  const saveButtons = new Map();

  const page = element('section', 'music-library');
  const heading = element('header', 'music-library-heading');
  heading.append(element('h1', '', 'Music'), element('p', '', 'Find songs by title or artist and play official uploads here.'));

  const feature = element('section', 'music-feature');
  const featureCaption = element('div', 'music-feature-copy');
  featureCaption.append(element('p', 'music-meta music-feature-label', 'Featured track'),
    element('h2', '', featuredTrack.title), element('p', 'music-meta', `${featuredTrack.artist} · ${featuredTrack.style}`));
  const featurePlay = action('Play featured track', () => openTrack(featuredTrack), true);
  featurePlay.setAttribute('aria-label', `Play featured track, ${featuredTrack.title}`);
  featureCaption.append(featurePlay);
  feature.append(featureCaption, artwork(featuredTrack, true));

  const filters = element('div', 'music-filters');
  const tabs = element('div', 'music-sections');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Music collections');
  const sectionButtons = new Map();
  for (const {id, label} of SECTIONS) {
    const button = action(label, () => {
      section = id;
      category = 'All music';
      draw();
    });
    sectionButtons.set(id, button);
    tabs.append(button);
  }
  const query = element('input', 'field');
  query.type = 'search';
  query.placeholder = 'Search music';
  query.setAttribute('aria-label', 'Search music by title, artist, or style');
  query.maxLength = 160;
  query.value = (params?.get('q') || '').slice(0, query.maxLength);
  const categories = element('div', 'music-categories');
  categories.setAttribute('role', 'group');
  categories.setAttribute('aria-label', 'Music categories');
  const categoryButtons = new Map();
  for (const name of CATEGORIES) {
    const button = action(name, () => {
      category = name;
      draw();
    });
    categoryButtons.set(name, button);
    categories.append(button);
  }
  filters.append(tabs, query, categories);

  const listHead = element('div', 'music-list-head');
  const count = element('p', 'music-meta music-count');
  count.setAttribute('role', 'status');
  const playlistPlay = action('Play playlist', () => {
    if (matches.length) openTrack(matches[0], matches);
  });
  listHead.append(count, playlistPlay);
  const notice = element('p', 'music-meta music-notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  const list = element('ul', 'music-track-list');
  list.setAttribute('aria-label', 'Music tracks');
  const empty = element('p', 'music-empty');
  const nextBatch = element('div', 'music-more');
  const loadMore = action('Load more tracks', (event) => {
    const firstNew = addTracks();
    if (event.detail === 0) firstNew?.querySelector('button')?.focus();
  });
  loadMore.classList.add('music-load-more');
  nextBatch.append(loadMore);
  page.append(heading, feature, filters, listHead, notice, list, empty, nextBatch);
  target.replaceChildren(page);

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      notice.textContent = 'Saved and recently played music will be kept for this visit. Browser storage is unavailable.';
      notice.hidden = false;
    }
  }

  function syncSave(button, track) {
    const selected = state.saved.includes(track.id);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? 'Remove' : 'Save'} ${track.title}${selected ? ' from saved music' : ''}`);
    button.textContent = button.classList.contains('music-save') ? (selected ? '★' : '☆') :
      (selected ? 'Remove saved video' : 'Save video');
  }

  function toggleSaved(track, button) {
    const selected = state.saved.includes(track.id);
    state.saved = selected ? state.saved.filter(id => id !== track.id) : [track.id, ...state.saved].slice(0, 200);
    persist();
    syncSave(button, track);
    const cardButton = saveButtons.get(track.id);
    if (cardButton) syncSave(cardButton, track);
    if (section === 'saved' && selected) {
      draw();
      if (!page.querySelector('dialog[open]')) {
        (list.querySelector('.music-save') || sectionButtons.get('saved')).focus();
      }
    }
  }

  function card(track) {
    const item = element('li', 'music-track');
    const launch = action(`Play ${track.title}`, () => openTrack(track));
    launch.className = 'music-track-launch';
    launch.setAttribute('aria-label', `Play ${track.title}`);
    launch.replaceChildren();
    const art = artwork(track);
    const playMark = element('span', 'music-track-play-mark');
    playMark.setAttribute('aria-hidden', 'true');
    art.append(playMark);
    const duration = durationText(track.duration);
    if (duration) art.append(element('span', 'music-duration', duration));
    const metadata = element('span', 'music-track-info');
    metadata.append(element('strong', 'music-track-title', track.title), element('span', 'music-meta', track.artist),
      element('span', 'music-meta music-style', track.style));
    launch.append(art, metadata);
    const save = action('', () => toggleSaved(track, save));
    save.className = 'music-save';
    syncSave(save, track);
    saveButtons.set(track.id, save);
    item.append(launch, save);
    return item;
  }

  function addTracks() {
    if (closed) return null;
    const end = Math.min(matches.length, shown + PAGE_SIZE);
    const batch = matches.slice(shown, end).map(card);
    list.append(...batch);
    shown = end;
    nextBatch.hidden = shown >= matches.length;
    count.textContent = shown < matches.length ? `Showing ${shown} of ${matches.length} tracks` :
      `${matches.length} ${matches.length === 1 ? 'track' : 'tracks'}`;
    return batch[0] || null;
  }

  function draw() {
    for (const [id, node] of sectionButtons) node.setAttribute('aria-pressed', String(id === section));
    for (const [name, node] of categoryButtons) node.setAttribute('aria-pressed', String(name === category));
    const results = findMusicTracks(query.value);
    if (section === 'discover') {
      matches = results.filter((track) => category === 'All music' || track.category === category);
    } else {
      const matchedIds = new Set(results.map(track => track.id));
      matches = state[section].filter(id => matchedIds.has(id)).map(id => byId.get(id));
    }
    feature.hidden = Boolean(query.value.trim()) || section !== 'discover' || category !== 'All music';
    categories.hidden = section !== 'discover';
    playlistPlay.hidden = !matches.length;
    list.hidden = !matches.length;
    empty.hidden = matches.length > 0;
    empty.textContent = query.value.trim() ? SECTIONS[0].empty : SECTIONS.find(({id}) => id === section).empty;
    saveButtons.clear();
    list.replaceChildren();
    shown = 0;
    addTracks();
  }

  function openTrack(track, queue = matches) {
    closePlayer?.();
    const playlist = queue.some(({id}) => id === track.id) ? queue : [track];
    const position = playlist.findIndex(({id}) => id === track.id);
    const details = element('div', 'music-playlist-controls');
    const before = action('Previous track', () => openTrack(playlist[position - 1], playlist));
    before.disabled = position <= 0;
    const after = action('Next track', () => openTrack(playlist[position + 1], playlist));
    after.disabled = position >= playlist.length - 1;
    const save = action('Save video', () => toggleSaved(track, save));
    syncSave(save, track);
    details.append(before, element('span', 'music-meta music-queue-position', `${position + 1} of ${playlist.length}`), after, save);
    let counted = false;
    closePlayer = watchDialog(page, {
      title: track.title,
      subtitle: track.artist,
      video: track,
      external: `https://www.youtube.com/watch?v=${track.id}`,
      directLabel: 'Watch on YouTube',
      details,
      onPlaying: () => {
        if (closed || counted) return;
        counted = true;
        state.recent = [track.id, ...state.recent.filter(id => id !== track.id)].slice(0, 50);
        persist();
      }
    });
    const dialog = page.querySelector('dialog[open]');
    // Keep keyboard focus off detached queue controls when the next dialog closes.
    dialog?.addEventListener('close', () => {
      if (closed || page.querySelector('dialog[open]')) return;
      if (section === 'recent') draw();
      const active = document.activeElement;
      if (!page.contains(active)) {
        (saveButtons.get(track.id)?.parentElement.querySelector('.music-track-launch') || sectionButtons.get(section)).focus({preventScroll: true});
      }
    }, {once: true});
  }

  query.addEventListener('input', draw);
  draw();
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting) && shown < matches.length) addTracks();
  }, {rootMargin: '100px 0px'}) : null;
  observer?.observe(nextBatch);

  return () => {
    closed = true;
    observer?.disconnect();
    closePlayer?.();
    page.remove();
  };
}
