import { featuredFilm, filmCatalog } from './film-catalog.js';
import { getVideoCollections } from './media.js';
import { videoLibraryLink } from './video-topics.js';

const number = new Intl.NumberFormat();

function create(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function destination(label, href, className) {
  const item = create('a', className, label);
  item.href = href;
  return item;
}

function artwork(url) {
  const image = create('img', 'explore-artwork');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('load', () => image.classList.add('is-ready'), { once: true });
  image.addEventListener('error', () => image.remove(), { once: true });
  image.src = url;
  return image;
}

function section(title) {
  const root = create('section', 'explore-section');
  root.append(create('h2', '', title));
  return root;
}

function tile({ name, description, href, art, color }) {
  const item = destination('', href, 'explore-tile');
  if (color) item.dataset.color = color;
  if (art) item.append(artwork(art));
  const text = create('span', 'explore-tile-text');
  text.append(create('strong', '', name), create('span', '', description));
  item.append(text, create('span', 'explore-arrow'));
  item.lastChild.setAttribute('aria-hidden', 'true');
  return item;
}

export function renderExplore(target, { gamesSection, localCount, arcadeFeature }) {
  const { count, added, topics } = getVideoCollections();
  const hero = create('header', 'explore-hero');
  const copy = create('div', 'explore-hero-copy');
  const title = create('h1', 'heading-display', 'Explore the arcade');
  const description = create('p', '', 'Find something to watch, play a game, or look up an answer.');
  const actions = create('div', 'interaction-row');
  actions.append(destination(added ? 'Browse new videos' : 'Browse YouTube',
    videoLibraryLink('', added ? 'new' : 'all'), 'button primary'));
  actions.append(destination('Play a built-in game', '#games?local=1', 'button'));
  copy.append(title, description, actions);
  const cover = tile({
    name: arcadeFeature.title,
    description: 'Play the space delivery game',
    href: `#play/${arcadeFeature.id}`,
    art: arcadeFeature.art,
    color: 'games'
  });
  cover.classList.add('explore-hero-cover');
  hero.append(copy, cover);

  const watch = section('Watch');
  const watchList = create('div', 'explore-feature-grid');
  for (const entry of [
    { name: 'YouTube library', description: `${number.format(count)} videos and Shorts`, href: videoLibraryLink(''), color: 'video' },
    { name: 'Shorts feed', description: 'Scroll through short videos', href: videoLibraryLink('', 'shorts'), color: 'short' },
    { name: 'Cinema', description: `${number.format(filmCatalog.length)} films and trailers`, href: '#movies', art: featuredFilm.art, color: 'film' }
  ]) watchList.append(tile(entry));
  watch.append(watchList);

  const collections = section('Video collections');
  const topicList = create('div', 'explore-topic-grid');
  topics.forEach(({ topic, count: total, cover: video }, index) => {
    if (!video) return;
    topicList.append(tile({
      name: topic,
      description: `${number.format(total)} ${total === 1 ? 'video' : 'videos'}`,
      href: videoLibraryLink(topic),
      art: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
      color: String(index % 5)
    }));
  });
  collections.append(topicList);

  const tools = section('Search and tools');
  const toolsList = create('div', 'explore-feature-grid');
  for (const entry of [
    { name: 'Web Search', description: 'Search articles and YouTube in tabs', href: '#web-search', color: 'search' },
    { name: 'Google Search', description: 'Google results, Images, News, and Shopping', href: '#web-search?mode=google', color: 'google' },
    { name: 'AI Help', description: 'Ask a question, calculate, or convert units', href: '#web-search?mode=ai', color: 'ai' }
  ]) toolsList.append(tile(entry));
  tools.append(toolsList);

  const play = section('Play');
  play.append(tile({
    name: 'Built-in arcade',
    description: `${number.format(localCount)} games playable here`,
    href: '#games?local=1',
    color: 'games'
  }));
  if (gamesSection) play.append(gamesSection);
  target.replaceChildren(hero, watch, collections, play, tools);
}
