import {featuredTrack, musicCatalog} from './music-catalog.js';

export {featuredTrack, musicCatalog};

const CATEGORIES = ['All music', 'Nursery rhymes', 'Folk tunes', 'Classical', 'Seasonal', 'Original instrumentals'];
const QUERY_FILLER = new Set('can could find hear let listen me music of play please show song songs some to tracks would you'.split(' '));

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
    const style = normalized(`${track.style} ${track.category} instrumental`);
    const fields = [title, artist, style];
    if (words.some((word) => !fields.some((field) => field.includes(word)))) return null;
    const score = (title === text ? 20 : title.includes(text) ? 8 : 0) +
      words.reduce((sum, word) => sum + (title.includes(word) ? 3 : artist.includes(word) ? 2 : 1), 0);
    return {track, score};
  }).filter(Boolean).sort((first, second) => second.score - first.score).map(({track}) => track);
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

function trackTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function renderMusic(target, params) {
  const page = element('section', 'music-library');
  const heading = element('header', 'music-library-heading');
  heading.append(element('h1', '', 'Music'), element('p', '', 'Instrumental nursery rhymes, familiar melodies, and original tracks.'));

  const feature = element('section', 'music-feature');
  const featureCaption = element('div', 'music-feature-copy');
  featureCaption.append(element('p', 'music-meta music-feature-label', 'Featured track'),
    element('h2', '', featuredTrack.title),
    element('p', 'music-meta', `${featuredTrack.style} · ${trackTime(featuredTrack.duration)}`));
  const featurePlay = action('Play featured track', () => playTrack(featuredTrack), true);
  featurePlay.setAttribute('aria-label', `Play featured track, ${featuredTrack.title}`);
  featureCaption.append(featurePlay);
  const record = element('div', 'music-feature-disc');
  record.setAttribute('aria-hidden', 'true');
  feature.append(featureCaption, record);

  const player = element('section', 'music-player');
  player.setAttribute('aria-label', 'Music player');
  player.hidden = true;
  const trackInfo = element('div', 'music-player-info');
  const playerTitle = element('h2');
  const credits = element('p', 'music-meta');
  trackInfo.append(playerTitle, credits);
  const transport = element('div', 'music-transport');
  const previous = action('Previous track', () => changeTrack(-1));
  const next = action('Next track', () => changeTrack(1));
  const audio = element('audio');
  audio.controls = true;
  audio.disableRemotePlayback = true;
  audio.preload = 'none';
  audio.setAttribute('aria-label', 'Track playback');
  transport.append(previous, audio, next);
  const status = element('p', 'music-meta music-playback-status');
  status.setAttribute('role', 'status');
  player.append(trackInfo, transport, status);

  const filters = element('div', 'music-filters');
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
  filters.append(query, categories);

  const count = element('p', 'music-meta music-count');
  count.setAttribute('role', 'status');
  const list = element('ul', 'music-track-list');
  list.setAttribute('aria-label', 'Music tracks');
  const empty = element('p', 'music-empty', 'No tracks match your search.');
  page.append(heading, feature, player, filters, count, list, empty);
  target.replaceChildren(page);

  let category = 'All music';
  let matches = [];
  let current;
  let request = 0;
  let closed = false;
  let buttons = new Map();

  function draw() {
    for (const [name, node] of categoryButtons) node.setAttribute('aria-pressed', String(name === category));
    matches = findMusicTracks(query.value).filter((track) => category === 'All music' || track.category === category);
    feature.hidden = Boolean(query.value.trim()) || category !== 'All music';
    count.textContent = `${matches.length} ${matches.length === 1 ? 'track' : 'tracks'}`;
    empty.hidden = matches.length > 0;
    list.hidden = !matches.length;
    buttons = new Map();
    list.replaceChildren(...matches.map((track) => {
      const item = element('li', 'music-track');
      const metadata = element('div', 'music-track-info');
      metadata.append(element('h2', '', track.title),
        element('p', 'music-meta', track.artist),
        element('p', 'music-meta music-style', track.style));
      const duration = element('span', 'music-meta music-duration', trackTime(track.duration));
      const play = action('Play', () => {
        if (current?.id === track.id && !audio.paused) {
          request++;
          audio.pause();
        } else {
          playTrack(track);
        }
      });
      buttons.set(track.id, {item, track, play});
      item.append(metadata, duration, play);
      return item;
    }));
    syncPlayer();
  }

  function playlist() {
    return matches.some(({id}) => current?.id === id) ? matches : musicCatalog;
  }

  function syncPlayer() {
    const tracks = playlist();
    const index = tracks.findIndex(({id}) => current?.id === id);
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index >= tracks.length - 1;
    for (const {item, track, play} of buttons.values()) {
      const selected = current?.id === track.id;
      const label = selected && !audio.paused ? 'Pause' : 'Play';
      item.classList.toggle('is-current', selected);
      play.textContent = label;
      play.setAttribute('aria-label', `${label} ${track.title}`);
    }
  }

  function changeTrack(direction) {
    const tracks = playlist();
    const index = tracks.findIndex(({id}) => current?.id === id);
    const track = tracks[index + direction];
    if (index >= 0 && track) playTrack(track);
  }

  async function playTrack(track) {
    if (closed) return;
    const token = ++request;
    if (track.id !== current?.id) {
      current = track;
      player.hidden = false;
      playerTitle.textContent = track.title;
      credits.textContent = `${track.artist} · ${track.credit}`;
      audio.src = new URL(track.src, document.baseURI).href;
    } else if (audio.error) {
      audio.load();
    }
    status.textContent = `Opening ${track.title}…`;
    syncPlayer();
    player.scrollIntoView({ block: 'nearest' });
    audio.focus({preventScroll: true});
    try {
      await audio.play();
      if (!closed && request === token) syncPlayer();
    } catch {
      if (!closed && request === token) {
        status.textContent = 'The track could not start. Try Play again.';
        syncPlayer();
      }
    }
  }

  audio.addEventListener('playing', () => {
    status.textContent = `Playing ${current.title}.`;
    syncPlayer();
  });
  audio.addEventListener('pause', () => {
    if (!current || closed || !audio.paused) return;
    request++;
    status.textContent = 'Paused.';
    syncPlayer();
  });
  audio.addEventListener('ended', () => {
    status.textContent = 'Track finished.';
    syncPlayer();
  });
  audio.addEventListener('error', () => {
    if (closed) return;
    status.textContent = 'This track could not be loaded.';
    syncPlayer();
  });
  query.addEventListener('input', draw);
  draw();

  return () => {
    closed = true;
    request++;
    if (audio.hasAttribute('src')) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    page.remove();
  };
}
