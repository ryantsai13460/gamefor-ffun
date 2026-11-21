import { openSearchVideoDialog } from './media.js';
import {featuredTrack, musicCatalog} from './music-catalog.js';

export {featuredTrack, musicCatalog};

const CATEGORIES = ['All music', 'Imagine Dragons', 'Benson Boone', 'Chart picks', 'Pop'];
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
    const style = normalized(`${track.style} ${track.category}`);
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

export function renderMusic(target, params) {
  const page = element('section', 'music-library');
  const heading = element('header', 'music-library-heading');
  heading.append(element('h1', '', 'Music'), element('p', '', 'Find songs by title or artist and play official uploads here.'));

  const feature = element('section', 'music-feature');
  const featureCaption = element('div', 'music-feature-copy');
  featureCaption.append(element('p', 'music-meta music-feature-label', 'Featured track'),
    element('h2', '', featuredTrack.title),
    element('p', 'music-meta', `${featuredTrack.artist} · ${featuredTrack.style}`));
  const featurePlay = action('Play featured track', () => playTrack(featuredTrack), true);
  featurePlay.setAttribute('aria-label', `Play featured track, ${featuredTrack.title}`);
  featureCaption.append(featurePlay);
  const record = element('div', 'music-feature-disc');
  record.setAttribute('aria-hidden', 'true');
  feature.append(featureCaption, record);

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
  page.append(heading, feature, filters, count, list, empty);
  target.replaceChildren(page);

  let category = 'All music';
  let closePlayer;

  function draw() {
    for (const [name, node] of categoryButtons) node.setAttribute('aria-pressed', String(name === category));
    const matches = findMusicTracks(query.value).filter((track) => category === 'All music' || track.category === category);
    feature.hidden = Boolean(query.value.trim()) || category !== 'All music';
    count.textContent = `${matches.length} ${matches.length === 1 ? 'track' : 'tracks'}`;
    empty.hidden = matches.length > 0;
    list.hidden = !matches.length;
    list.replaceChildren(...matches.map(track => {
      const item = element('li', 'music-track');
      const metadata = element('div', 'music-track-info');
      metadata.append(element('h2', '', track.title), element('p', 'music-meta', track.artist));
      item.append(metadata, element('span', 'music-meta', track.style),
        action(`Play ${track.title}`, () => playTrack(track)));
      return item;
    }));
  }

  function playTrack(track) {
    closePlayer?.();
    closePlayer = openSearchVideoDialog(page, { ...track, creator: track.artist });
  }

  query.addEventListener('input', draw);
  draw();

  return () => {
    closePlayer?.();
    page.remove();
  };
}
