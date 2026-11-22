const assetVersion = new URL(import.meta.url).search;
const [
  { getShortCatalog, shortProviders, shortCategories, shortsLink },
  { getShortVideoPreferences, updateShortVideoPreference, mountShortYouTubePlayer },
] = await Promise.all([
  import(`./shorts-catalog.js${assetVersion}`),
  import(`./media.js${assetVersion}`),
]);

const catalog = getShortCatalog();
const byId = new Map(catalog.map(video => [video.id, video]));
const storageKey = 'ffun-shorts-social-v1';
const batchSize = 10;
let sessionPreferences;

function element(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content) result.textContent = content;
  return result;
}

function button(label, action, className = 'button') {
  const result = element('button', className, label);
  result.type = 'button';
  result.addEventListener('click', action);
  return result;
}

function link(label, href, external = true) {
  const result = element('a', 'button', label);
  result.href = href;
  if (external) {
    result.target = '_blank';
    result.rel = 'noopener noreferrer';
  }
  return result;
}

function readSocialPreferences() {
  if (sessionPreferences) return sessionPreferences;
  try {
    const store = JSON.parse(localStorage.getItem(storageKey)) || {};
    const ids = key => Array.isArray(store[key]) ? [...new Set(store[key])].filter(id => {
      const video = byId.get(id);
      return video && (key === 'watched' || video.provider !== 'youtube');
    }).slice(0, 50) : [];
    return { favorites: ids('favorites'), watched: ids('watched') };
  } catch {
    return { favorites: [], watched: [] };
  }
}

function preferencesFor(list) {
  return [...new Set([...readSocialPreferences()[list], ...getShortVideoPreferences()[list].map(id => `youtube-${id}`)])];
}

function updatePreference(video, list) {
  if (video.provider === 'youtube') {
    updateShortVideoPreference(video.videoId, list);
    if (list === 'favorites') return;
  }
  const store = readSocialPreferences();
  const remaining = store[list].filter(id => id !== video.id);
  store[list] = list === 'favorites' && remaining.length < store[list].length
    ? remaining
    : [video.id, ...remaining].slice(0, 50);
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    sessionPreferences = store;
  }
}

export function getShortLibraryState() {
  const read = list => preferencesFor(list).map(id => byId.get(id)).filter(Boolean);
  return { favorites: read('favorites'), recent: read('watched') };
}

function makeArt(video, compact = false) {
  const art = element('span', 'shorts-art');
  art.setAttribute('aria-hidden', 'true');
  const provider = shortProviders[video.provider];
  art.append(element('span', 'shorts-art-name', compact ? provider.compactLabel : provider.label));
  if (video.thumbnail) {
    const image = element('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'strict-origin-when-cross-origin';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = video.thumbnail;
    art.append(image);
  }
  return art;
}

function mountTikTok(stage, status, video, { onPlaying }) {
  const origin = 'https://www.tiktok.com';
  const frame = element('iframe');
  frame.title = `${video.title} on TikTok`;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const url = new URL(`/player/v1/${video.videoId}`, origin);
  url.search = new URLSearchParams({ description: '1', rel: '0' });
  const failed = 'TikTok playback could not be confirmed. Open the original post to watch.';
  const timer = setTimeout(() => { status.textContent = failed; }, 8500);
  const receive = event => {
    if (event.origin !== origin || event.source !== frame.contentWindow || event.data?.['x-tiktok-player'] !== true) return;
    const { type, value } = event.data;
    if (type === 'onPlayerReady') {
      clearTimeout(timer);
      status.textContent = 'TikTok player ready. Press Play on the video.';
    } else if (type === 'onPlayerError') {
      clearTimeout(timer);
      status.textContent = failed;
    } else if (type === 'onStateChange' && value === 1) {
      clearTimeout(timer);
      status.textContent = 'Playing on TikTok.';
      onPlaying();
    }
  };
  window.addEventListener('message', receive);
  frame.addEventListener('error', () => { status.textContent = failed; }, { once: true });
  frame.src = url;
  status.textContent = 'Connecting to TikTok…';
  stage.replaceChildren(frame);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('message', receive);
    frame.remove();
  };
}

function mountInstagram(stage, status, video) {
  const frame = element('iframe');
  frame.title = `${video.title} on Instagram`;
  frame.allow = 'fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = video.embedUrl;
  status.textContent = 'Use Open on Instagram if the embedded Reel is unavailable.';
  frame.addEventListener('error', () => {
    status.textContent = 'Instagram could not be reached. Open the original Reel to watch.';
  }, { once: true });
  stage.replaceChildren(frame);
  return () => frame.remove();
}

function normalize(value) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

export function renderShorts(target, params = new URLSearchParams()) {
  const requested = byId.get(params.get('video'));
  const page = element('section', 'shorts-page');
  const heading = element('header', 'shorts-heading');
  const headingText = element('div');
  headingText.append(element('h1', '', 'Shorts'), element('p', '', 'Quick videos from creators and official channels.'));
  heading.append(headingText, link('YouTube video library', '#youtube', false));

  let source = Object.hasOwn(shortProviders, params.get('source')) ? params.get('source') : 'all';
  if (requested && source !== 'all') source = requested.provider;
  let view = ['favorites', 'watched'].includes(params.get('view')) ? params.get('view') : 'browse';
  let index = -1;
  let matches = [];
  let resultStart = 0;
  let shown = batchSize;
  let resetScroll = 0;
  let scrollTimer;
  let resize;
  let player;
  let stopPlayback = () => {};
  let currentVideo;
  let closed = false;

  const sources = element('div', 'shorts-sources');
  sources.setAttribute('role', 'group');
  sources.setAttribute('aria-label', 'Short video platforms');
  const sourceButtons = new Map();
  for (const [id, label] of [['all', 'All platforms'], ...Object.entries(shortProviders).map(([id, item]) => [id, item.label])]) {
    const control = button(label, () => {
      if (source === id) return;
      source = id;
      update();
    });
    sourceButtons.set(id, control);
    sources.append(control);
  }

  const layout = element('div', 'shorts-body');
  const screen = element('section', 'shorts-screen');
  screen.setAttribute('aria-label', 'Shorts feed');
  const rail = element('div', 'shorts-rail');
  rail.tabIndex = 0;
  rail.setAttribute('role', 'region');
  rail.setAttribute('aria-label', 'Vertical video feed');
  rail.setAttribute('aria-describedby', 'shorts-keyboard-help');
  const keyboardHelp = element('p', 'shorts-visually-hidden', 'Use the Up and Down arrows to move between shorts.');
  keyboardHelp.id = 'shorts-keyboard-help';
  const playerStatus = element('p', 'shorts-player-status');
  playerStatus.setAttribute('role', 'status');
  const controls = element('div', 'shorts-player-nav');
  const previous = button('Previous short', () => {
    select(index - 1);
    if (previous.disabled) rail.focus({ preventScroll: true });
  });
  previous.setAttribute('aria-keyshortcuts', 'ArrowUp PageUp');
  const next = button('Next short', () => {
    select(index + 1);
    if (next.disabled) rail.focus({ preventScroll: true });
  }, 'button primary');
  next.setAttribute('aria-keyshortcuts', 'ArrowDown PageDown');
  const position = element('p', 'shorts-position');
  const navigationAnnouncement = element('p', 'shorts-visually-hidden');
  navigationAnnouncement.setAttribute('aria-live', 'polite');
  controls.append(previous, position, next, navigationAnnouncement);

  const caption = element('div', 'shorts-caption');
  const platform = element('p', 'shorts-platform');
  const title = element('h2');
  const creator = element('p', 'shorts-creator');
  const description = element('p', 'shorts-description');
  const actions = element('div', 'shorts-actions');
  const original = link('Open original post', shortProviders.youtube.discover);
  const save = button('Save', () => {
    if (!currentVideo) return;
    const id = currentVideo.id;
    updatePreference(currentVideo, 'favorites');
    if (view === 'favorites') {
      update(id, index);
      if (save.disabled) shelfHeading.focus();
    } else updateSavedState();
  });
  const sound = button('Unmute', () => {
    if (!player) return;
    try {
      const wasMuted = player.isMuted();
      if (wasMuted) player.unMute();
      else player.mute();
      sound.textContent = wasMuted ? 'Mute' : 'Unmute';
    } catch {
      sound.hidden = true;
    }
  });
  sound.hidden = true;
  const share = button('Share', () => {
    if (!currentVideo) return;
    sharePanel.hidden = !sharePanel.hidden;
    share.setAttribute('aria-expanded', String(!sharePanel.hidden));
    if (!sharePanel.hidden) {
      shareUrl.value = new URL(shortsLink(currentVideo), location.href).href;
      shareUrl.focus();
      shareUrl.select();
    }
  });
  share.setAttribute('aria-expanded', 'false');
  share.setAttribute('aria-controls', 'shorts-share-panel');
  const sharePanel = element('div', 'shorts-share');
  sharePanel.id = 'shorts-share-panel';
  sharePanel.hidden = true;
  const shareUrl = element('input', 'field');
  shareUrl.type = 'url';
  shareUrl.readOnly = true;
  shareUrl.setAttribute('aria-label', 'Link to this short');
  const copyStatus = element('p', 'shorts-visually-hidden');
  copyStatus.setAttribute('role', 'status');
  const copy = button('Copy link', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      copyStatus.textContent = 'Short link copied.';
    } catch {
      shareUrl.focus();
      shareUrl.select();
      copyStatus.textContent = 'Link selected for copying.';
    }
  });
  sharePanel.append(shareUrl, copy, copyStatus);
  actions.append(original, save, share, sound);
  caption.append(platform, title, creator, description, actions, sharePanel);

  const empty = element('div', 'shorts-empty');
  empty.hidden = true;
  const emptyTitle = element('h2');
  const emptyText = element('p');
  const discover = link('See more Shorts', shortProviders.youtube.discover);
  const clear = button('Clear filters', () => {
    query.value = '';
    category.value = '';
    view = 'browse';
    update();
  });
  const emptyActions = element('div', 'shorts-actions');
  emptyActions.append(clear, discover);
  empty.append(emptyTitle, emptyText, emptyActions);
  screen.append(keyboardHelp, rail, controls, playerStatus, caption, empty);

  const library = element('section', 'shorts-discover');
  const shelfHeading = element('h2', '', 'Find shorts');
  shelfHeading.tabIndex = -1;
  const filters = element('div', 'shorts-filters');
  const queryLabel = element('label', '', 'Search shorts');
  const query = element('input', 'field');
  query.type = 'search';
  query.maxLength = 160;
  query.value = (params.get('q') || '').slice(0, query.maxLength);
  query.placeholder = 'Title, creator, or topic';
  query.addEventListener('input', () => update());
  queryLabel.append(query);
  const categoryLabel = element('label', '', 'Category');
  const category = element('select', 'field');
  category.append(new Option('All categories', ''), ...shortCategories.map(([label]) => new Option(label)), new Option('Other'));
  if ([...category.options].some(option => option.value === params.get('category'))) category.value = params.get('category');
  category.addEventListener('change', () => update());
  categoryLabel.append(category);
  filters.append(queryLabel, categoryLabel);
  const views = element('div', 'shorts-views');
  views.setAttribute('role', 'group');
  views.setAttribute('aria-label', 'Shorts library');
  const viewButtons = new Map();
  for (const [id, label] of [['browse', 'Browse'], ['favorites', 'Favorites'], ['watched', 'Recently watched']]) {
    const control = button(label, () => {
      if (view === id) return;
      view = id;
      update();
    });
    viewButtons.set(id, control);
    views.append(control);
  }
  library.append(shelfHeading, filters, views);

  const results = element('section', 'shorts-results');
  const resultsHeading = element('h2', '', 'Browse videos');
  const count = element('p', 'shorts-count');
  count.setAttribute('role', 'status');
  const cards = element('ol', 'shorts-results-list');
  const earlier = button('Load earlier shorts', () => {
    resultStart = Math.max(0, resultStart - batchSize);
    drawResults();
    cards.firstElementChild?.firstElementChild.focus();
  });
  const more = button('Load more shorts', () => {
    const previouslyShown = shown;
    shown += batchSize;
    drawResults();
    cards.children[previouslyShown - resultStart]?.firstElementChild.focus();
  });
  results.append(resultsHeading, count, earlier, cards, more);
  layout.append(library, screen, results);
  page.append(heading, sources, layout);
  target.replaceChildren(page);

  function updateSavedState() {
    const saved = currentVideo && preferencesFor('favorites').includes(currentVideo.id);
    save.textContent = saved ? 'Saved' : 'Save';
    save.setAttribute('aria-pressed', String(Boolean(saved)));
  }

  function stopPlayer() {
    stopPlayback();
    stopPlayback = () => {};
    player = undefined;
    sound.hidden = true;
  }

  function play(stage, video) {
    if (!stage.isConnected || currentVideo !== video) return;
    const onPlaying = () => {
      if (currentVideo === video && !closed) updatePreference(video, 'watched');
    };
    stopPlayer();
    if (video.provider === 'tiktok') {
      stopPlayback = mountTikTok(stage, playerStatus, video, { onPlaying });
    } else if (video.provider === 'instagram') {
      stopPlayback = mountInstagram(stage, playerStatus, video);
    } else {
      stopPlayback = mountShortYouTubePlayer(stage, playerStatus, video, {
        onPlaying,
        onReady(instance) {
          if (currentVideo !== video || closed || typeof instance?.isMuted !== 'function') return;
          player = instance;
          sound.textContent = player.isMuted() ? 'Unmute' : 'Mute';
          sound.hidden = false;
        },
      });
    }
    rail.focus({ preventScroll: true });
  }

  function drawCard(video, active) {
    const slide = element('div', 'shorts-slide');
    const stage = element('div', 'shorts-stage');
    stage.append(makeArt(video));
    if (active) {
      if ((video.provider === 'instagram' && !video.embedUrl) || video.embeddable === false) {
        stage.append(link(`Watch on ${shortProviders[video.provider].label}`, video.href));
      } else {
        stage.append(button('Play short', () => play(stage, video), 'button primary shorts-play'));
      }
    } else {
      slide.setAttribute('aria-hidden', 'true');
      const label = element('div', 'shorts-preview');
      label.append(element('p', '', video.title), element('p', '', video.creator));
      stage.append(label);
    }
    slide.append(stage);
    return slide;
  }

  function align() {
    if (index < 0 || !rail.clientHeight) return;
    resetScroll = index > 0 ? rail.clientHeight : 0;
    rail.scrollTop = resetScroll;
  }

  function select(nextIndex, drawShelf = true) {
    if (nextIndex < 0 || nextIndex >= matches.length || nextIndex === index) return;
    const video = matches[nextIndex];
    if (!video) return;
    const focusWasInRail = rail.contains(document.activeElement);
    stopPlayer();
    clearTimeout(scrollTimer);
    index = nextIndex;
    currentVideo = video;
    sharePanel.hidden = true;
    share.setAttribute('aria-expanded', 'false');
    copyStatus.textContent = '';
    const slides = [];
    for (let candidate = Math.max(0, index - 1); candidate <= Math.min(index + 1, matches.length - 1); candidate++) {
      slides.push(drawCard(matches[candidate], candidate === index));
    }
    rail.replaceChildren(...slides);
    align();
    position.textContent = `${index + 1} of ${matches.length}`;
    navigationAnnouncement.textContent = `${position.textContent}. ${video.title} by ${video.creator}.`;
    previous.disabled = index === 0;
    next.disabled = index === matches.length - 1;
    const provider = shortProviders[video.provider].label;
    platform.textContent = `${provider} · ${video.categories[0]}`;
    title.textContent = video.title;
    creator.textContent = video.creator;
    description.textContent = video.description || '';
    description.hidden = !video.description;
    original.href = video.href;
    original.textContent = `Open on ${provider}`;
    save.disabled = false;
    updateSavedState();
    playerStatus.textContent = video.provider === 'instagram' && !video.embedUrl ? 'Watch this public Reel on Instagram.' : '';
    if (focusWasInRail) rail.focus({ preventScroll: true });
    if (drawShelf) {
      if (index < resultStart || index >= shown) {
        resultStart = Math.floor(index / batchSize) * batchSize;
        shown = resultStart + batchSize;
        drawResults();
      } else {
        cards.querySelector('[aria-current]')?.removeAttribute('aria-current');
        cards.children[index - resultStart]?.firstElementChild?.setAttribute('aria-current', 'true');
      }
    }
  }

  function drawResults() {
    const records = matches.slice(resultStart, shown);
    cards.replaceChildren(...records.map((video, itemIndex) => {
      const item = element('li');
      const pick = button('', () => {
        select(resultStart + itemIndex);
        rail.focus({ preventScroll: true });
        rail.scrollIntoView({ block: 'nearest' });
      }, 'shorts-result');
      const copy = element('span', 'shorts-result-text');
      copy.append(element('strong', '', video.title), element('span', '', `${video.creator} · ${shortProviders[video.provider].label}`));
      pick.append(makeArt(video, true), copy);
      if (currentVideo === video) pick.setAttribute('aria-current', 'true');
      item.append(pick);
      return item;
    }));
    const displayed = resultStart ? `${resultStart + 1}–${resultStart + records.length}` : records.length;
    count.textContent = matches.length ? `${displayed} of ${matches.length} shorts` : 'No matches';
    earlier.hidden = resultStart === 0;
    more.hidden = shown >= matches.length;
  }

  function update(preferredId, preferredIndex = 0) {
    const available = view === 'browse' ? catalog : preferencesFor(view).map(id => byId.get(id)).filter(Boolean);
    const terms = normalize(query.value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    matches = available.filter(video => (source === 'all' || video.provider === source) &&
      (!category.value || video.categories.includes(category.value)) && terms.every(term =>
        normalize([video.title, video.creator, video.description || '', ...video.tags, ...video.categories].join(' ')).includes(term)));
    for (const [id, control] of sourceButtons) control.setAttribute('aria-pressed', String(id === source));
    for (const [id, control] of viewButtons) control.setAttribute('aria-pressed', String(id === view));
    resultsHeading.textContent = { browse: 'Browse videos', favorites: 'Favorites', watched: 'Recently watched' }[view];
    resultStart = 0;
    shown = batchSize;
    index = -1;
    currentVideo = undefined;
    stopPlayer();
    clearTimeout(scrollTimer);
    const found = Boolean(matches.length);
    for (const item of [rail, controls, caption, playerStatus]) item.hidden = !found;
    empty.hidden = found;
    save.disabled = !found;
    if (found) {
      const requestedIndex = matches.findIndex(video => video.id === preferredId);
      const firstIndex = requestedIndex >= 0 ? requestedIndex : Math.min(preferredIndex, matches.length - 1);
      resultStart = Math.floor(firstIndex / batchSize) * batchSize;
      shown = resultStart + batchSize;
      select(firstIndex, false);
    } else {
      rail.replaceChildren();
      const provider = shortProviders[source] || shortProviders.youtube;
      discover.href = provider.discover;
      discover.textContent = `Explore on ${provider.label}`;
      const filtered = Boolean(query.value.trim() || category.value);
      clear.hidden = !filtered && view === 'browse';
      emptyTitle.textContent = view === 'favorites' ? 'No saved shorts here' : view === 'watched' ? 'No watched shorts here' : 'No shorts found';
      emptyText.textContent = filtered ? 'Try a different title, creator, or category.' : view === 'favorites'
        ? 'Save a short to find it here later.' : view === 'watched' ? 'Shorts appear here after playback is confirmed.'
          : `Public ${provider.label} posts can be browsed on the original platform.`;
    }
    drawResults();
  }

  rail.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    if (Math.abs(rail.scrollTop - resetScroll) < 2 || !rail.clientHeight) return;
    scrollTimer = setTimeout(() => {
      if (closed || !rail.clientHeight) return;
      select(index + Math.round((rail.scrollTop - resetScroll) / rail.clientHeight));
    }, 130);
  }, { passive: true });
  rail.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : ['ArrowDown', 'PageDown'].includes(event.key) ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    select(index + direction);
  });
  if (typeof ResizeObserver === 'function') {
    resize = new ResizeObserver(align);
    resize.observe(rail);
  }
  update(requested?.id);
  return () => {
    closed = true;
    stopPlayer();
    clearTimeout(scrollTimer);
    resize?.disconnect();
    page.remove();
  };
}
