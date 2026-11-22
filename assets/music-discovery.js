const assetVersion = new URL(import.meta.url).search;
let playback;

const sections = [
  {id: 'discover', label: 'Discover', empty: 'No tracks match your search.'},
  {id: 'new', label: 'Recently added', empty: 'No recently added tracks match.'},
  {id: 'saved', label: 'Saved music', empty: 'Save a video to find it here.'},
  {id: 'recent', label: 'Recently played', empty: 'Videos appear here after playback starts.'},
  {id: 'playlists', label: 'Playlists', empty: 'Add videos to this playlist from their cards or player.'}
];
const queryFiller = new Set('can could find hear let listen me music of play please show song songs some to tracks would you'.split(' '));
const formatLabels = {lyrics: 'Lyric video', visualizer: 'Instrumental visualizer'};
const pageSize = 18;
const alpha = new Intl.Collator(undefined, {sensitivity: 'base', numeric: true});
const maxPlaylists = 40;
const hasChart = track => /^\d{4}-\d{2}-\d{2}$/.test(track.chart?.date || '') && Number.isSafeInteger(track.chart.rank) && track.chart.rank > 0;

function normalized(value) {
  return value.toLowerCase().normalize('NFKD').replace(/\p{Mark}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function createMusicProfile(tracks, { featured = tracks[0], storageKey, lyrics = false, corrections = new Map() }) {
  const byId = new Map(tracks.map(track => [track.id, track]));
  const catalogPosition = new Map(tracks.map((track, index) => [track.id, index]));
  const artistTracks = new Map();
  for (const track of tracks) {
    if (!artistTracks.has(track.artist)) artistTracks.set(track.artist, []);
    artistTracks.get(track.artist).push(track);
  }
  const featuredArtists = [...artistTracks].map(([name, entries]) => [name, lyrics ? entries.filter(track => track.kind === 'lyrics') : entries])
    .filter(([, entries]) => entries.length >= (lyrics ? 1 : 2))
    .sort((first, second) => second[1].length - first[1].length || alpha.compare(first[0], second[0])).slice(0, 8);
  const latestAddition = tracks.reduce((latest, track) => track.addedAt > latest ? track.addedAt : latest, '');
  const chartDate = tracks.filter(hasChart).map(track => track.chart.date).sort().at(-1);
  const genreNames = new Set(tracks.map(({category}) => category));
  const primary = (lyrics ? ['Pop', 'Rock', 'Electronic', 'Gaming music', 'Piano', 'Relaxing'] : ['Imagine Dragons', 'Benson Boone', 'Chart picks', 'Pop'])
    .filter(name => genreNames.delete(name));
  const categories = ['All music', ...primary, ...genreNames];
  const collections = sections.map(section => lyrics && section.id === 'saved' ? {...section, label: 'Favorites'} : section);
  if (lyrics && tracks.some(track => track.kind === 'visualizer')) {
    collections.splice(2, 0, {id: 'visualizers', label: 'Instrumental visualizers', empty: 'No instrumental visualizers match.'});
  }
  if (chartDate) collections.splice(1, 0, {id: 'chart', label: 'Chart snapshot', empty: 'No chart tracks match.'});

  const searchRows = tracks.map((track) => ({track, title: normalized(track.title), artist: normalized(track.artist),
    style: normalized(`${track.style} ${track.category} ${track.channel || ''} ${track.kind || ''}`)}));
  function find(query = '') {
    if (typeof query !== 'string') return [];
    const input = normalized(query);
    const text = corrections.get(input) || input;
    const words = text.split(' ').filter(word => word && !queryFiller.has(word) && (!lyrics || !['video', 'videos'].includes(word)));
    if (!words.length) return [...tracks];
    return searchRows.map(({track, title, artist, style}) => {
      const fields = [title, artist, style];
      if (words.some((word) => !fields.some((field) => field.includes(word)))) return null;
      const score = (title === text ? 20 : title.includes(text) ? 8 : 0) +
        words.reduce((sum, word) => sum + (title.includes(word) ? 3 : artist.includes(word) ? 2 : 1), 0);
      return {track, score};
    }).filter(Boolean).sort((first, second) => second.score - first.score).map(({track}) => track);
  }
  return { tracks, featured, storageKey, byId, catalogPosition, artistTracks, featuredArtists,
    latestAddition, chartDate, categories, collections, maxTracks: Math.max(300, tracks.length), find, lyrics };
}

function playlistName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

const playlistNameKey = value => normalized(value) || value.toLocaleLowerCase();

function readPreferences({ storageKey, byId, maxTracks }) {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    stored = {};
  }
  const trackIds = (value, limit = maxTracks) => Array.isArray(value)
    ? [...new Set(value.filter(id => byId.has(id)))].slice(0, limit) : [];
  const names = new Set();
  const ids = new Set();
  const playlists = [];
  for (const list of Array.isArray(stored?.playlists) ? stored.playlists.slice(0, maxPlaylists) : []) {
    const name = playlistName(list?.name);
    const nameKey = playlistNameKey(name);
    if (typeof list?.id !== 'string' || !/^[\w-]{1,80}$/.test(list.id) || !nameKey || names.has(nameKey) || ids.has(list.id)) continue;
    names.add(nameKey);
    ids.add(list.id);
    playlists.push({id: list.id, name, tracks: trackIds(list.tracks)});
  }
  return {saved: trackIds(stored?.saved), recent: trackIds(stored?.recent, 50), playlists};
}

export function musicProfileState(profile) {
  const state = readPreferences(profile);
  const tracks = ids => ids.map(id => profile.byId.get(id));
  return {
    saved: tracks(state.saved), recent: tracks(state.recent),
    playlists: state.playlists.map(list => ({...list, tracks: tracks(list.tracks)})),
  };
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

function artwork(track, feature = false, fallback = track.title) {
  const art = element('span', feature ? 'music-art music-feature-art' : 'music-art');
  const placeholder = element('span', 'music-art-title', fallback);
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

function artistChannel(track) {
  try {
    const url = new URL(track.channelUrl);
    return url.protocol === 'https:' && url.hostname === 'www.youtube.com' &&
      !url.username && !url.password && !url.port && /^\/(?:@[^/]+|channel\/UC[\w-]{22})(?:\/)?$/.test(url.pathname) ? url.href : '';
  } catch {
    return '';
  }
}

function visualReference(track) {
  try {
    const url = new URL(track.visualSource);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function renderMusicDiscovery(target, params, profile) {
  const { tracks, featured, storageKey, byId, catalogPosition, artistTracks, featuredArtists, latestAddition,
    chartDate, categories: genres, collections, maxTracks, find, lyrics } = profile;
  const state = readPreferences(profile);
  const requestedSection = params?.get(lyrics ? 'collection' : 'view');
  let section = collections.some(({id}) => id === requestedSection) ? requestedSection : 'discover';
  let category = genres.includes(params?.get('category')) ? params.get('category') : 'All music';
  let matches = [];
  let shown = 0;
  let closed = false;
  let closePlayer;
  let playbackRevision = 0;
  let selectedPlaylist = state.playlists.find(list => list.id === params?.get('playlist'))?.id || state.playlists[0]?.id || '';
  let editing;
  const saveButtons = new Map();

  const page = element('section', lyrics ? 'music-library lyrics-discovery' : 'music-library');
  const heading = element('header', 'music-library-heading');
  const lyricsLink = element('a', 'button', 'Chart lyrics');
  lyricsLink.href = '#music?lyrics=chart';
  const uploadsLink = element('a', 'button', '7clouds uploads');
  uploadsLink.href = '#music?lyrics=7clouds';
  const headingCopy = element('div');
  const title = !lyrics && requestedSection === 'archive' ? 'Music archive' : 'Music';
  const lead = lyrics ? 'Discover lyric videos by song, artist, or genre.'
    : `Discover ${tracks.length.toLocaleString()} official uploads by song, artist, or style.`;
  headingCopy.append(element('h1', '', title), element('p', '', lead));
  const musicViews = element('div', 'interaction-row');
  const lyricHome = element('a', 'button', 'Lyrics library');
  lyricHome.href = '#music';
  musicViews.append(lyricHome, lyricsLink, uploadsLink);
  heading.append(headingCopy);
  if (!lyrics) heading.append(musicViews);

  const feature = element('section', 'music-feature');
  if (featured) {
    const featureCaption = element('div', 'music-feature-copy');
    featureCaption.append(element('p', 'music-meta music-feature-label', lyrics ? `Featured ${formatLabels[featured.kind].toLowerCase()}` : 'Featured track'),
      element('h2', '', featured.title), element('p', 'music-meta', `${featured.artist} · ${featured.style}`));
    const featurePlay = action('Play featured track', () => openTrack(featured), true);
    featurePlay.setAttribute('aria-label', `Play featured track, ${featured.title}`);
    featureCaption.append(featurePlay);
    feature.append(featureCaption, artwork(featured, true));
  }

  const artists = element('section', 'music-artists');
  artists.append(element('h2', '', 'Featured artists'));
  const artistButtons = element('div', 'music-artist-list');
  for (const [name, tracks] of featuredArtists) {
    const artistButton = action('', () => {
      artist.value = name;
      draw();
      count.focus();
    });
    artistButton.setAttribute('aria-label', `Browse ${name}, ${tracks.length} tracks`);
    const artistCopy = element('span', 'music-artist-copy');
    artistCopy.append(element('strong', '', name), element('small', 'music-meta', `${tracks.length} tracks`));
    const artistArt = artwork(tracks[0], false, name);
    artistArt.classList.add('music-artist-art');
    artistButton.append(artistArt, artistCopy);
    artistButtons.append(artistButton);
  }
  artists.append(artistButtons);

  const filters = element('div', 'music-filters');
  const tabs = element('div', 'music-sections');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Music collections');
  const sectionButtons = new Map();
  for (const {id, label} of collections) {
    const button = action(label, () => {
      section = id;
      category = 'All music';
      artist.value = '';
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
  const fields = element('div', 'music-filter-fields');
  const artist = element('select', 'field');
  artist.setAttribute('aria-label', 'Filter by artist');
  artist.append(new Option('All artists', ''), ...[...artistTracks.keys()].sort(alpha.compare).map(name => new Option(name, name)));
  if (artistTracks.has(params?.get('artist'))) artist.value = params.get('artist');
  const sort = element('select', 'field');
  sort.setAttribute('aria-label', 'Sort music');
  sort.append(new Option('Default order', ''), new Option('Title A–Z', 'title'), new Option('Artist A–Z', 'artist'),
    new Option('Recently added', 'added'));
  if (tracks.some(track => track.releaseDate)) sort.append(new Option('Newest releases', 'released'));
  fields.append(query, artist, sort);
  const categories = element('div', 'music-categories');
  categories.setAttribute('role', 'group');
  categories.setAttribute('aria-label', 'Music categories');
  const categoryButtons = new Map();
  for (const name of genres) {
    const button = action(name, () => {
      category = name;
      draw();
    });
    categoryButtons.set(name, button);
    categories.append(button);
  }
  filters.append(tabs, fields, categories);

  const playlistTools = element('div', 'music-custom-playlists');
  const playlistSelect = element('select', 'field');
  playlistSelect.setAttribute('aria-label', 'Select a saved playlist');
  const createList = action('Create playlist', () => openPlaylist('create'), true);
  const renameList = action('Rename playlist', () => openPlaylist('rename'));
  const removeList = action('Delete playlist', () => openPlaylist('delete'));
  playlistTools.append(playlistSelect, createList, renameList, removeList);
  playlistSelect.addEventListener('change', () => { selectedPlaylist = playlistSelect.value; draw(); });

  const playlistDialog = element('dialog', 'media-dialog music-playlist-dialog');
  const editForm = element('form');
  const dialogTitle = element('h2');
  dialogTitle.id = 'music-edit-playlist-heading';
  playlistDialog.setAttribute('aria-labelledby', dialogTitle.id);
  const dialogCopy = element('p', 'music-meta');
  const destination = element('select', 'field');
  destination.setAttribute('aria-label', 'Destination playlist');
  const name = element('input', 'field');
  name.maxLength = 80;
  name.setAttribute('aria-label', 'Playlist name');
  name.placeholder = 'Playlist name';
  const editorStatus = element('p', 'music-meta');
  editorStatus.setAttribute('role', 'status');
  const editActions = element('div', 'music-playlist-controls');
  const cancel = action('Cancel', () => playlistDialog.close());
  const confirm = element('button', 'button primary');
  confirm.type = 'submit';
  editActions.append(cancel, confirm);
  editForm.append(dialogTitle, dialogCopy, destination, name, editorStatus, editActions);
  playlistDialog.append(editForm);
  destination.addEventListener('change', syncPlaylistEditor);
  editForm.addEventListener('submit', savePlaylistEdit);

  const listHead = element('div', 'music-list-head');
  const count = element('p', 'music-meta music-count');
  count.setAttribute('role', 'status');
  count.tabIndex = -1;
  const playlistPlay = action('Play playlist', () => {
    if (matches.length) openTrack(matches[0], matches);
  });
  listHead.append(count, playlistPlay);
  let clearHistory;
  if (lyrics) {
    clearHistory = action('Clear playback history', () => {
      if (!state.recent.length || !window.confirm('Clear lyric playback history in this browser?')) return;
      state.recent = [];
      notice.textContent = 'Playback history cleared.';
      notice.hidden = false;
      persist();
      draw();
      sectionButtons.get('recent').focus();
    });
    listHead.append(clearHistory);
  }
  const notice = element('p', 'music-meta music-notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  const list = element('ul', 'music-track-list');
  list.setAttribute('aria-label', 'Music tracks');
  const empty = element('p', 'music-empty');
  const showInstrumentals = lyrics ? action('Show matching instrumentals', () => {
    section = 'visualizers';
    category = 'All music';
    draw();
    count.focus();
  }) : null;
  showInstrumentals?.classList.add('music-search-alternative');
  const nextBatch = element('div', 'music-more');
  const loadMore = action('Load more tracks', (event) => {
    const firstNew = addTracks();
    if (event.detail === 0) firstNew?.querySelector('button')?.focus();
  });
  loadMore.classList.add('music-load-more');
  nextBatch.append(loadMore);
  page.append(heading, feature, artists, filters, playlistTools, listHead, notice, list, empty);
  if (showInstrumentals) page.append(showInstrumentals);
  page.append(nextBatch, playlistDialog);
  if (lyrics) {
    const sources = element('details', 'music-sources');
    const archiveLink = element('a', 'button', 'Music archive');
    archiveLink.href = '#music?view=archive';
    const earlierLink = element('a', 'button', 'Earlier lyric catalog');
    earlierLink.href = '#music?lyrics=legacy';
    musicViews.replaceChildren(lyricsLink, uploadsLink, archiveLink, earlierLink);
    sources.append(element('summary', '', 'Music sources and archive'), musicViews);
    page.append(sources);
  }
  target.replaceChildren(page);

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      notice.textContent = 'Browser storage is unavailable. Music changes stay available while this view is open.';
      notice.hidden = false;
    }
  }

  function activePlaylist() {
    return state.playlists.find(list => list.id === selectedPlaylist);
  }

  function syncPlaylistEditor() {
    const enteringName = editing?.mode === 'create' || editing?.mode === 'rename' ||
      (editing?.mode === 'add' && !destination.value);
    name.hidden = !enteringName;
    name.required = enteringName;
    editorStatus.textContent = '';
  }

  function openPlaylist(mode, track) {
    const current = activePlaylist();
    if ((mode === 'rename' || mode === 'delete') && !current) return;
    editing = {mode, id: current?.id, track};
    dialogTitle.textContent = {create: 'Create playlist', rename: 'Rename playlist', delete: 'Delete playlist', add: 'Add to playlist'}[mode];
    dialogCopy.textContent = mode === 'add' ? track.title : mode === 'delete' ? `Remove “${current.name}” from your saved playlists?` : '';
    dialogCopy.hidden = !dialogCopy.textContent;
    destination.hidden = mode !== 'add';
    destination.replaceChildren(...state.playlists.map(list => new Option(list.name, list.id)), new Option('Create a new playlist', ''));
    if (mode === 'add') destination.value = current?.id || state.playlists[0]?.id || '';
    name.value = mode === 'rename' ? current.name : '';
    confirm.textContent = mode === 'add' ? 'Add track' : mode === 'delete' ? 'Delete playlist' : 'Save playlist';
    syncPlaylistEditor();
    playlistDialog.showModal();
    if (mode === 'delete') cancel.focus();
    else (name.hidden ? destination : name).focus();
  }

  function savePlaylistEdit(event) {
    event.preventDefault();
    if (!editing) return;
    const {mode, id, track} = editing;
    let list = state.playlists.find(item => item.id === (mode === 'add' ? destination.value : id));
    if (mode === 'delete' && list) {
      state.playlists = state.playlists.filter(item => item.id !== list.id);
      selectedPlaylist = state.playlists[0]?.id || '';
      notice.textContent = 'Playlist deleted.';
    } else {
      if (mode === 'create' || mode === 'rename' || !list) {
        const value = playlistName(name.value);
        const nameKey = playlistNameKey(value);
        if (!nameKey || state.playlists.some(item => item.id !== (mode === 'rename' ? id : '') && playlistNameKey(item.name) === nameKey)) {
          editorStatus.textContent = 'Enter a playlist name that you have not already used.';
          return;
        }
        if (mode === 'rename' && list) list.name = value;
        else {
          if (state.playlists.length >= maxPlaylists) {
            editorStatus.textContent = `This browser can save up to ${maxPlaylists} playlists.`;
            return;
          }
          const suffix = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
          list = {id: 'list-' + suffix, name: value, tracks: []};
          state.playlists.push(list);
        }
      }
      if (mode === 'add' && list.tracks.includes(track.id)) {
        editorStatus.textContent = 'This track is already in the selected playlist.';
        return;
      }
      if (mode === 'add') list.tracks.push(track.id);
      selectedPlaylist = list.id;
      notice.textContent = mode === 'add' ? `Added to ${list.name}.` : `Saved ${list.name}.`;
    }
    notice.hidden = false;
    persist();
    playlistDialog.close();
    editing = undefined;
    if (section === 'playlists') {
      draw();
      if (!page.querySelector('dialog[open]')) (playlistSelect.hidden ? createList : playlistSelect).focus();
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
    state.saved = selected ? state.saved.filter(id => id !== track.id) : [track.id, ...state.saved].slice(0, maxTracks);
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

  function card(track, position) {
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
    if (lyrics) metadata.append(element('span', 'music-meta music-kind', formatLabels[track.kind]));
    if (hasChart(track) && track.chart.date === chartDate) {
      metadata.append(element('span', 'music-meta', `Chart #${track.chart.rank} · ${track.chart.market || track.chart.source} · ${track.chart.date}`));
    }
    launch.append(art, metadata);
    const save = action('', () => toggleSaved(track, save));
    save.className = 'music-save';
    syncSave(save, track);
    saveButtons.set(track.id, save);
    const inPlaylist = section === 'playlists';
    const playlistAction = action(inPlaylist ? '−' : '+', () => {
      if (!inPlaylist) {
        openPlaylist('add', track);
        return;
      }
      const playlist = activePlaylist();
      if (!playlist) return;
      playlist.tracks = playlist.tracks.filter(id => id !== track.id);
      notice.textContent = `Removed from ${playlist.name}.`;
      notice.hidden = false;
      persist();
      draw();
      (list.querySelector('.music-add') || playlistSelect).focus({preventScroll: true});
    });
    playlistAction.className = 'music-save music-add';
    playlistAction.setAttribute('aria-label', inPlaylist ? `Remove ${track.title} from playlist` : `Add ${track.title} to playlist`);
    if (!inPlaylist) playlistAction.setAttribute('aria-haspopup', 'dialog');
    item.append(launch, save, playlistAction);
    if (lyrics && inPlaylist && !query.value.trim() && !artist.value && !sort.value && matches.length > 1) {
      const order = element('div', 'music-playlist-order');
      const earlier = action('Move earlier', () => movePlaylistTrack(track, -1));
      const later = action('Move later', () => movePlaylistTrack(track, 1));
      earlier.dataset.musicOrder = 'earlier';
      later.dataset.musicOrder = 'later';
      earlier.setAttribute('aria-label', `Move ${track.title} earlier`);
      later.setAttribute('aria-label', `Move ${track.title} later`);
      earlier.disabled = position === 0;
      later.disabled = position === matches.length - 1;
      order.append(earlier, later);
      item.append(order);
    }
    return item;
  }

  function movePlaylistTrack(track, direction) {
    const playlist = activePlaylist();
    if (!playlist) return;
    const position = playlist.tracks.indexOf(track.id);
    const destination = position + direction;
    if (position < 0 || destination < 0 || destination >= playlist.tracks.length) return;
    [playlist.tracks[position], playlist.tracks[destination]] = [playlist.tracks[destination], playlist.tracks[position]];
    notice.textContent = `Moved ${track.title} to position ${destination + 1}.`;
    notice.hidden = false;
    persist();
    draw(Math.max(shown, destination + 1));
    const item = saveButtons.get(track.id)?.parentElement;
    const move = item?.querySelector(`[data-music-order="${direction < 0 ? 'earlier' : 'later'}"]`);
    (move && !move.disabled ? move : item?.querySelector('.music-track-launch'))?.focus();
  }

  function addTracks(amount = pageSize) {
    if (closed) return null;
    const end = Math.min(matches.length, shown + amount);
    const batch = matches.slice(shown, end).map((track, index) => card(track, shown + index));
    list.append(...batch);
    shown = end;
    nextBatch.hidden = shown >= matches.length;
    count.textContent = shown < matches.length ? `Showing ${shown} of ${matches.length} tracks` :
      `${matches.length} ${matches.length === 1 ? 'track' : 'tracks'}`;
    return batch[0] || null;
  }

  function draw(visibleTracks = pageSize) {
    for (const [id, node] of sectionButtons) node.setAttribute('aria-pressed', String(id === section));
    const isCatalog = ['discover', 'new', 'chart', 'visualizers'].includes(section);
    const kind = section === 'visualizers' ? 'visualizer' : 'lyrics';
    for (const [name, node] of categoryButtons) {
      node.setAttribute('aria-pressed', String(name === category));
      node.hidden = Boolean(lyrics && isCatalog && name !== 'All music' &&
        !tracks.some(track => track.kind === kind && track.category === name));
    }
    const results = find(query.value).filter(track => !artist.value || track.artist === artist.value);
    const playlist = activePlaylist();
    if (isCatalog) {
      matches = results.filter(track => (category === 'All music' || track.category === category) &&
        (!lyrics || track.kind === kind) &&
        (section !== 'new' || !latestAddition || track.addedAt === latestAddition) &&
        (section !== 'chart' || (hasChart(track) && track.chart.date === chartDate)));
    } else {
      const matchedIds = new Set(results.map(track => track.id));
      const ids = section === 'playlists' ? playlist?.tracks || [] : state[section];
      matches = ids.filter(id => matchedIds.has(id)).map(id => byId.get(id));
    }
    const order = sort.value || (section === 'new' ? 'added' : section === 'chart' ? 'rank' : '');
    if (order === 'title') matches.sort((first, second) => alpha.compare(first.title, second.title));
    if (order === 'artist') matches.sort((first, second) => alpha.compare(first.artist, second.artist) || alpha.compare(first.title, second.title));
    if (order === 'added') matches.sort((first, second) => catalogPosition.get(second.id) - catalogPosition.get(first.id));
    if (order === 'released') matches.sort((first, second) => (second.releaseDate || '').localeCompare(first.releaseDate || ''));
    if (order === 'rank') matches.sort((first, second) => first.chart.rank - second.chart.rank);

    feature.hidden = !featured || Boolean(query.value.trim() || artist.value) || section !== 'discover' || category !== 'All music';
    artists.hidden = feature.hidden || !featuredArtists.length;
    categories.hidden = !isCatalog;
    playlistTools.hidden = section !== 'playlists';
    if (!playlistTools.hidden) {
      playlistSelect.replaceChildren(...state.playlists.map(item => new Option(item.name, item.id)));
      playlistSelect.hidden = !playlist;
      playlistSelect.value = selectedPlaylist;
      renameList.disabled = removeList.disabled = !playlist;
    }
    playlistPlay.hidden = !matches.length;
    playlistPlay.textContent = section === 'playlists' ? 'Play playlist' : 'Play results';
    if (clearHistory) clearHistory.hidden = section !== 'recent' || !state.recent.length;
    list.hidden = !matches.length;
    empty.hidden = matches.length > 0;
    empty.textContent = query.value.trim() || artist.value ? collections[0].empty
      : section === 'playlists' && !playlist ? 'Create a playlist to save a listening queue.' : collections.find(({id}) => id === section).empty;
    if (showInstrumentals) {
      showInstrumentals.hidden = section !== 'discover' || matches.length > 0 || !(query.value.trim() || artist.value) ||
        !results.some(track => track.kind === 'visualizer');
    }
    saveButtons.clear();
    list.replaceChildren();
    shown = 0;
    addTracks(visibleTracks);
  }

  async function openTrack(track, queue = matches) {
    const revision = ++playbackRevision;
    if (!playback) {
      const opening = 'Opening the video player…';
      notice.textContent = opening;
      notice.hidden = false;
      try {
        playback = await import(`./media.js${assetVersion}`);
      } catch {
        if (closed || revision !== playbackRevision) return;
        const direct = element('a', 'text-action', 'Watch on YouTube');
        direct.href = `https://www.youtube.com/watch?v=${track.id}`;
        direct.target = '_blank';
        direct.rel = 'noopener noreferrer';
        notice.replaceChildren(document.createTextNode('The video player could not load. '), direct);
        notice.hidden = false;
        return;
      }
      if (closed || revision !== playbackRevision) return;
      if (notice.textContent === opening) notice.hidden = true;
    }
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
    const add = action('Add to playlist', () => openPlaylist('add', track));
    add.setAttribute('aria-haspopup', 'dialog');
    details.append(before, element('span', 'music-meta music-queue-position', `${position + 1} of ${playlist.length}`), after, save, add);
    const channel = artistChannel(track);
    if (channel) {
      const channelLink = element('a', 'button', 'Artist on YouTube');
      channelLink.href = channel;
      channelLink.target = '_blank';
      channelLink.rel = 'noopener noreferrer';
      details.append(channelLink);
    }
    const reference = lyrics && visualReference(track);
    if (reference) {
      const visualLink = element('a', 'button', 'About the visuals');
      visualLink.href = reference;
      visualLink.target = '_blank';
      visualLink.rel = 'noopener noreferrer';
      details.append(visualLink);
    }
    const related = tracks.filter(candidate => candidate.id !== track.id && (!lyrics || candidate.kind === track.kind) &&
      (candidate.artist === track.artist || candidate.category === track.category))
      .sort((first, second) => Number(second.artist === track.artist) - Number(first.artist === track.artist)).slice(0, 4);
    if (related.length) {
      const recommendations = element('section', 'music-related');
      recommendations.append(element('h3', '', 'Related music'));
      for (const candidate of related) recommendations.append(action(`Play ${candidate.title}`, () => openTrack(candidate, related)));
      details.append(recommendations);
    }
    let counted = false;
    closePlayer = playback.watchDialog(page, {
      title: track.title,
      subtitle: lyrics ? `${track.artist} · ${formatLabels[track.kind]}` : track.artist,
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

  query.addEventListener('input', () => draw());
  artist.addEventListener('change', () => draw());
  sort.addEventListener('change', () => draw());
  draw();
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting) && shown < matches.length) addTracks();
  }, {rootMargin: '100px 0px'}) : null;
  observer?.observe(nextBatch);
  const addressedTrack = byId.get(params?.get('track'));
  if (addressedTrack) openTrack(addressedTrack);

  return () => {
    closed = true;
    observer?.disconnect();
    closePlayer?.();
    page.remove();
  };
}
