import { addedShorts, addedVideos } from './media-curated.js';

const SHORTS = [
  ['80VtSQHvWBo', 'Minecraft, But I Shrunk', 'camman18', ['Minecraft', 'Challenges']],
  ['ftnaXStTPBY', '@KreekCraft visits Roblox HQ 🤣 #kreekcraft #roblox #shorts #funny #meme', 'Shedletsky', ['Roblox', 'Funny']],
  ['eWXYrhmYgH8', 'MINECRAFT 1.21', 'camman18', ['Minecraft', 'Funny']],
  ['WILeRgKUUvk', 'Ranking Roblox Funniest Moments 💀 #roblox #shorts', 'Bloxify', ['Roblox', 'Funny']],
  ['JFl6u1rsFLw', 'Roblox OBBY ESCAPE Challenge🏃‍♂️#Roblox#shorts', 'WarmBlox', ['Roblox', 'Challenges']],
  ['ZSrx-GCPR4E', 'really really hard minecraft', 'camman18', ['Minecraft', 'Challenges']],
  ['_PQEPJItlKo', 'bingo.', 'camman18', ['Minecraft', 'Challenges']]
].map(([id, title, creator, tags]) => ({id, title, creator, tags, short: true}));

// The original creator collection, checked against YouTube oEmbed.
const CREATOR_VIDEOS = [
  ['smi6fnthKI0', 'Wemmbu', 'The Unstable SMP'],
  ['2WusTNLmBpE', 'Parrot', 'I Became King of the Unstable SMP'],
  ['8_Au10osdEo', 'Spoke', 'Unstable SMP: Purgatory'],
  ['Ym2wmd19S_c', 'FlameFrags', 'I Became the Strongest on the Unstable SMP'],
  ['f_aRA-KcTQs', 'Wemmbu', 'Unstable SMP: The LAW'],
  ['TphfLyzVbqQ', 'Parrot', '100 Days as King of the Unstable SMP'],
  ['FEropZ_Tq7Y', 'Spoke', '1000 Players Simulate PRISON in Hardcore Minecraft'],
  ['BkYekSPynVo', 'FlameFrags', 'I Exposed Minecraft\'s "Strongest" Player'],
  ['C2LjQWaKZek', 'Wemmbu', 'I Explored Beyond the Minecraft Farlands'],
  ['NT2Is90lFoI', 'Parrot', 'Unstable SMP: Civil War FINALE'],
  ['ipEi6kkTIlI', 'Spoke', '1000 Players Simulate HUNGER GAMES in Hardcore Minecraft'],
  ['yBy5NnLTiWQ', 'FlameFrags', 'I Got Trained By a Minecraft Combat Master'],
  ['_6ucSC1-7ZI', 'Wemmbu', '1000 Players Simulate UNDERGROUND Civilization in Minecraft'],
  ['O-ipuD6qy1Q', 'Parrot', "Searching for a Civilization that Doesn't Exist"],
  ['ynkhNRpQ9Xc', 'Spoke', '1000 Players Build END Civilization in Hardcore Minecraft'],
  ['pS1bWc29g0Q', 'FlameFrags', 'I Explored the Minecraft Mist'],
  ['Ytm8WiQLNZA', 'Wemmbu', 'How I Destroyed an Entire Minecraft Civilization'],
  ['1EgS0othQe4', 'Parrot', "I Built Minecraft's Most Advanced Civilization"],
  ['lA1ohDqw8XA', 'Spoke', "Exploring Minecraft's Forgotten Dimension"],
  ['ZVrQRAf5dJg', 'FlameFrags', 'I Became a Minecraft Combat Master'],
  ['5hG_nAYEC2g', 'Wemmbu', "How I Saved the World's Largest Minecraft Server"],
  ['BWmWZTDxFrk', 'Parrot', 'Escaping the Minecraft Underworld'],
  ['IOS7FKtiyxE', 'Spoke', "I Created Minecraft's Greatest Empire"],
  ['h68WUZ8b0O0', 'FlameFrags', "Searching for a Vault that Doesn't Exist"]
].map(([id, creator, title]) => ({id, title, creator, tags: ['Minecraft']}));

const blender = 'https://studio.blender.org';
const blenderProject = (slug) => `${blender}/projects/${slug}/`;
const blenderArt = (path) => `${blender}/files/public/thumbnail/${path}`;

const MOVIES = [
  {
    title: 'A Minecraft Movie', year: 2025, tags: ['Adventure', 'Fantasy'],
    description: 'Four unlikely friends step into the Overworld and team up with Steve to find their way home.',
    art: 'https://www.minecraft.net/content/dam/minecraftnet/community/events/cy2025/sandstorm/2-27-25/MNCRFT_MAIN_Mojang_1170X500_TEXTLESS.jpg',
    source: 'https://www.minecraft.net/en-us/article/a-minecraft-movie-out-now',
    credit: 'Warner Bros. Pictures and Mojang Studios',
    trailer: 'wJO_vIDZn-I', full: 'https://tv.apple.com/us/movie/a-minecraft-movie/umc.cmc.1od4a1ayyjqn43uz8fel7ei5e'
  },
  {
    title: 'Wing It!', year: 2023, tags: ['Animation', 'Comedy'],
    description: 'An aspiring pilot and a meticulous engineer end up in a runaway shuttle together.',
    art: blenderArt('d7/08/d708026f351c8040518cf0331851005d_o_xs.webp'),
    source: `${blenderProject('wing-it')}3c402f7c9ab362/?asset=7022`, short: true, fullVideo: 'u9lj-c29dxI'
  },
  {
    title: 'Charge', year: 2022, tags: ['Animation', 'Sci-fi'],
    description: 'A desperate man breaks into a battery factory and encounters its relentless security droid.',
    art: blenderArt('34/b0/34b00ffed48256e3a873c31c574e8f08_o_xs.webp'),
    source: blenderProject('charge'), short: true, fullVideo: 'UXqq0ZvbOnk',
    trailerLink: `${blenderProject('charge')}?asset=6233`
  },
  {
    title: 'Sprite Fright', year: 2021, tags: ['Animation', 'Horror', 'Comedy'],
    description: 'A party of hikers underestimates the tiny mushroom creatures that live in a remote forest.',
    art: blenderArt('59/27/5927dc487d457a39f4439d0423675c7c_o_xs.webp'),
    source: blenderProject('sprite-fright'), short: true, fullVideo: '_cMxraX_5RE'
  },
  {
    title: 'Sintel', year: 2010, tags: ['Animation', 'Fantasy', 'Adventure'],
    description: 'A young traveler sets out across a harsh world in search of a dragon she once rescued.',
    art: blenderArt('03/f7/03f7b0d15c55b428680d4c6bb313f742_m.webp'),
    source: blenderProject('sintel'), short: true, trailer: 'HOfdboHvshg', fullVideo: 'eRsGyueVLvQ'
  },
  {
    title: 'Caminandes: Llamigos', year: 2016, tags: ['Animation', 'Comedy'],
    description: 'Koro the llama races a curious penguin to reach a coveted berry in the Patagonian winter.',
    art: blenderArt('6e/84/6e84fd08dda59d66aeb2152cb879f160_m.webp'),
    source: blenderProject('caminandes-3'), short: true, trailer: '6U1bsPCLLEg', fullVideo: 'SkVqJ1SGeL0'
  },
  {
    title: 'Spring', year: 2019, tags: ['Animation', 'Fantasy'],
    description: 'A shepherd and her dog venture into the mountains to help bring a new season to their valley.',
    art: blenderArt('ea/65/ea65feaacf95911f39844e2ea97e68b5_m.webp'),
    source: blenderProject('spring'), short: true, fullVideo: 'WhWc3b3KhnY'
  },
  {
    title: 'Big Buck Bunny', year: 2008, tags: ['Animation', 'Comedy'],
    description: 'A peace-loving rabbit takes action after three woodland troublemakers spoil his afternoon.',
    art: blenderArt('92/96/9296b1255fff3ef0e25da43f70616349_m.webp'),
    source: blenderProject('big-buck-bunny'), short: true, fullVideo: 'aqz-KE-bpKQ',
    trailerLink: `${blenderProject('big-buck-bunny')}564c6dc7c379cf0d22a81f6c/?asset=271`
  }
].map((film) => ({credit: 'Blender Studio', ...film}));

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'];
const VIDEO_STORE = 'ffun-video-library-v1';
const CHANNEL_STORE = 'ffun-public-channels-v1';
const DEFAULT_CREATORS = '@wemmbumc\n@ParrotX2\n@SpokeIsHere\n@FlameFragsMC';
const PAGE_SIZE = 18;
let iframeApi;

function node(tag, content = '', className = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = content;
  return element;
}

function button(label, click, className = 'button') {
  const element = node('button', label, className);
  element.type = 'button';
  element.addEventListener('click', click);
  return element;
}

function link(label, href, className = 'button') {
  const anchor = node('a', label, className);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function lookup(id, short = false) {
  return short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

export function parseYouTubeVideo(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (VIDEO_ID.test(value)) return {id: value, short: false};
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const [, route, pathId] = url.pathname.split('/');
    const short = route === 'shorts';
    let id;
    if (url.hostname === 'youtu.be') id = route;
    if (YOUTUBE_HOSTS.includes(url.hostname)) {
      if (route === 'watch') id = url.searchParams.get('v');
      if (short || route === 'embed' || route === 'live') id = pathId;
    }
    return VIDEO_ID.test(id || '') ? {id, short} : null;
  } catch {
    return null;
  }
}

function preference(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function sanitizeVideo(video) {
  if (!video || !VIDEO_ID.test(video.id || '') || typeof video.title !== 'string') return null;
  return {
    id: video.id,
    title: video.title.slice(0, 250),
    creator: typeof video.creator === 'string' ? video.creator.slice(0, 160) : '',
    short: video.short === true,
    embeddable: video.embeddable !== false,
    tags: [],
    channelId: video.channelId
  };
}

function validChannels(channels) {
  if (!Array.isArray(channels)) return [];
  return channels.filter((channel) => channel && CHANNEL_ID.test(channel.id || '') &&
    typeof channel.handle === 'string' && Number.isFinite(channel.at) && Array.isArray(channel.items))
    .map((channel) => ({
      id: channel.id,
      handle: channel.handle.slice(0, 100),
      title: String(channel.title || channel.handle).slice(0, 160),
      at: channel.at,
      items: channel.items.map(sanitizeVideo).filter((video) => video?.channelId === channel.id)
    }));
}

function image(art, title) {
  const element = node('span', '', 'media-image');
  const fallback = node('span', title, 'media-image-fallback');
  fallback.setAttribute('aria-hidden', 'true');
  element.append(fallback);
  if (art) {
    const picture = node('img');
    picture.alt = '';
    picture.loading = 'lazy';
    picture.decoding = 'async';
    picture.referrerPolicy = 'strict-origin-when-cross-origin';
    picture.addEventListener('load', () => picture.classList.add('is-ready'), {once: true});
    picture.addEventListener('error', () => picture.remove(), {once: true});
    picture.src = art;
    element.append(picture);
  }
  return element;
}

function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApi) return iframeApi;
  iframeApi = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.YT?.Player) finish(window.YT);
      else if (Date.now() - started > 6500) finish(null);
    }, 125);
    const finish = (api) => {
      clearInterval(timer);
      if (!api) {
        script.remove();
        iframeApi = null;
      }
      resolve(api);
    };
    script.addEventListener('error', () => finish(null), {once: true});
    document.head.append(script);
  });
  return iframeApi;
}

function playEmbedded(stage, status, video, isOpen) {
  if (video.embeddable === false) {
    status.textContent = 'The creator has disabled embedded playback. Watch this video on YouTube.';
    return () => {};
  }
  const frame = node('iframe');
  frame.title = video.title;
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const url = new URL(`https://www.youtube-nocookie.com/embed/${video.id}`);
  url.search = new URLSearchParams({enablejsapi: '1', playsinline: '1', origin: location.origin});
  frame.src = url;
  status.textContent = 'Connecting to YouTube…';
  stage.replaceChildren(frame);
  let player;
  const timer = setTimeout(() => {
    status.textContent = 'Embedded playback could not be confirmed. Open the video on YouTube if the player does not start.';
  }, 8500);
  loadIframeApi().then((api) => {
    if (!api || !isOpen() || !frame.isConnected) return;
    player = new api.Player(frame, {
      events: {
        onReady: () => {
          clearTimeout(timer);
          status.textContent = 'YouTube player ready.';
        },
        onError: () => {
          clearTimeout(timer);
          status.textContent = 'YouTube could not play this video here. Open it on YouTube for details.';
        }
      }
    });
  }).catch(() => {});
  return () => {
    clearTimeout(timer);
    player?.destroy();
    frame.remove();
  };
}

function watchDialog(target, {title, subtitle, description, video, external, directLabel, details, short}) {
  const dialog = node('dialog', '', 'media-dialog');
  dialog.setAttribute('aria-label', title);
  const top = node('header', '', 'media-dialog-header');
  const text = node('div');
  text.append(node('h2', title), node('p', subtitle, 'media-meta'));
  const close = button('Close', () => dialog.close());
  close.autofocus = true;
  top.append(text, close);
  const stage = node('div', '', `media-player${short ? ' media-player-short' : ''}`);
  const status = node('p', '', 'media-player-status');
  status.setAttribute('role', 'status');
  const controls = node('div', '', 'media-actions');
  if (external) controls.append(link(directLabel, external, 'button primary'));
  if (video && video.embeddable !== false && document.fullscreenEnabled) {
    const full = button('Fullscreen', async () => {
      try {
        if (document.fullscreenElement === stage) await document.exitFullscreen();
        else await stage.requestFullscreen();
      } catch {
        status.textContent = 'Fullscreen is unavailable in this browser.';
      }
    });
    const update = () => {
      full.textContent = document.fullscreenElement === stage ? 'Exit fullscreen' : 'Fullscreen';
    };
    document.addEventListener('fullscreenchange', update);
    dialog.addEventListener('close', () => document.removeEventListener('fullscreenchange', update), {once: true});
    controls.append(full);
  }
  if (details) controls.append(details);
  dialog.append(top);
  if (video && video.embeddable !== false) dialog.append(stage);
  if (video) dialog.append(status);
  if (description) dialog.append(node('p', description, 'media-dialog-description'));
  dialog.append(controls);
  target.append(dialog);
  dialog.showModal();
  const release = video ? playEmbedded(stage, status, video, () => dialog.open) : () => {};
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    release();
    dialog.remove();
  };
  dialog.addEventListener('close', remove, {once: true});
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    }
  });
  return () => {
    if (dialog.open) dialog.close();
    remove();
  };
}

function filter(label, options) {
  const select = node('select', '', 'field media-field');
  select.setAttribute('aria-label', label);
  for (const name of options) select.append(node('option', name));
  return select;
}

function search(label) {
  const input = node('input', '', 'field media-field');
  input.type = 'search';
  input.placeholder = label;
  input.setAttribute('aria-label', label);
  input.maxLength = 250;
  return input;
}

function matches(value, ...fields) {
  return fields.join(' ').toLowerCase().includes(value.trim().toLowerCase());
}

function heading(title, description) {
  const header = node('div', '', 'media-heading');
  header.append(node('h1', title), node('p', description, 'media-meta'));
  return header;
}

function moviePage(target) {
  const root = node('section', '', 'media-page');
  const tools = node('div', '', 'media-filters');
  const input = search('Search films');
  const genre = filter('Film genre', ['All genres', ...new Set(MOVIES.flatMap(({tags}) => tags))].sort((a, b) => {
    if (a === 'All genres') return -1;
    if (b === 'All genres') return 1;
    return a.localeCompare(b);
  }));
  const count = node('p', '', 'media-meta media-result-count');
  count.setAttribute('aria-live', 'polite');
  const grid = node('div', '', 'media-grid media-movies');
  let closeDialog;
  tools.append(input, genre);
  root.append(heading('Movies', 'Animated shorts and official trailers.'), tools, count, grid);
  target.replaceChildren(root);

  const showMovie = (movie, trailer) => {
    closeDialog?.();
    const id = trailer ? movie.trailer : movie.fullVideo;
    const destination = lookup(id);
    const detail = link(`Artwork and film credits · ${movie.credit}`, movie.source, 'media-credit');
    closeDialog = watchDialog(root, {
      title: movie.title,
      subtitle: trailer ? 'Official trailer' : 'Full animated short',
      description: movie.description,
      video: {id, title: trailer ? `${movie.title} trailer` : movie.title},
      external: destination,
      directLabel: 'Watch on YouTube',
      details: detail
    });
  };

  function draw() {
    const results = MOVIES.filter((movie) => (genre.selectedIndex === 0 || movie.tags.includes(genre.value)) &&
      matches(input.value, movie.title, movie.year, movie.description, ...movie.tags));
    count.textContent = `${results.length} ${results.length === 1 ? 'film' : 'films'}`;
    grid.replaceChildren();
    if (!results.length) grid.append(node('p', 'No films match your search.', 'media-empty'));
    for (const movie of results) {
      const card = node('article', '', 'media-card media-movie');
      const art = image(movie.art, movie.title);
      const info = node('div', '', 'media-card-body');
      const actions = node('div', '', 'media-actions');
      info.append(node('h2', movie.title), node('p', `${movie.year} · ${movie.tags.join(' · ')}`, 'media-meta'),
        node('p', movie.description, 'media-description'));
      if (movie.trailer) actions.append(button('Watch trailer', () => showMovie(movie, true)));
      if (movie.trailerLink) actions.append(link('Official teaser', movie.trailerLink));
      if (movie.fullVideo) actions.append(button('Play full short', () => showMovie(movie, false), 'button primary'));
      if (movie.full) actions.append(link('Where to watch', movie.full));
      const credit = link(`Artwork · ${movie.credit}`, movie.source, 'media-credit');
      info.append(actions, credit);
      card.append(art, info);
      grid.append(card);
    }
  }

  input.addEventListener('input', draw);
  genre.addEventListener('change', draw);
  draw();
  return () => closeDialog?.();
}

function creatorHandles(input) {
  const handles = new Set();
  for (let value of input.split(/[\s,]+/).filter(Boolean)) {
    if (value.includes('://')) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.includes(url.hostname) ||
          url.username || url.password || url.port) throw new Error('Use YouTube channel addresses or handles.');
      const [, route, id] = url.pathname.split('/');
      value = route === 'channel' ? id || '' : route || '';
    }
    if (!CHANNEL_ID.test(value)) {
      value = value.replace(/^@/, '');
      if (!/^[a-z0-9_.-]{3,50}$/i.test(value)) throw new Error('Enter a valid YouTube handle or UC channel ID.');
      value = `@${value}`;
    }
    handles.add(value);
  }
  if (!handles.size) throw new Error('Enter at least one YouTube creator.');
  if (handles.size > 20) throw new Error('Import up to 20 creators per run.');
  return handles;
}

function searchServiceUrl(input) {
  const url = new URL(input, location.href);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === location.origin)) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Enter an HTTPS search endpoint without a query or credentials.');
  }
  return url;
}

async function youtubeData(endpoint, parameters, key, signal) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.search = new URLSearchParams({...parameters, key});
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`YouTube returned HTTP ${response.status}. Check the key and quota.`);
  return response.json();
}

async function readChannel(handle, key, signal, report) {
  const search = CHANNEL_ID.test(handle) ? {id: handle} : {forHandle: handle};
  const result = await youtubeData('channels', {part: 'snippet,contentDetails', ...search}, key, signal);
  const channel = result.items?.[0];
  const playlistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error('This channel has no accessible uploads playlist.');
  const items = new Map();
  let token = '';
  do {
    const page = await youtubeData('playlistItems', {
      part: 'contentDetails', playlistId, maxResults: 50, ...(token ? {pageToken: token} : {})
    }, key, signal);
    if (!Array.isArray(page.items)) throw new Error('YouTube returned an incomplete playlist.');
    const ids = page.items.map((item) => item.contentDetails?.videoId).filter((id) => VIDEO_ID.test(id || ''));
    if (ids.length) {
      const metadata = await youtubeData('videos', {part: 'snippet,status', id: ids.join(',')}, key, signal);
      if (!Array.isArray(metadata.items)) throw new Error('YouTube returned incomplete video metadata.');
      for (const entry of metadata.items) {
        if (entry.status?.privacyStatus !== 'public' || entry.snippet?.channelId !== channel.id) continue;
        const video = sanitizeVideo({
          id: entry.id, title: entry.snippet.title, creator: entry.snippet.channelTitle,
          channelId: channel.id, embeddable: entry.status.embeddable
        });
        if (video) items.set(video.id, video);
      }
    }
    token = page.nextPageToken;
    report(`${handle} · ${items.size} public uploads read${token ? ' so far…' : '.'}`);
  } while (token);
  return {id: channel.id, handle, title: channel.snippet.title, at: Date.now(), items: [...items.values()]};
}

function creatorImport(state, changed) {
  const section = node('details', '', 'media-import');
  const summary = node('summary', 'Creator library settings');
  const form = node('form');
  const handles = node('textarea', '', 'field media-field');
  handles.value = state.handles;
  handles.rows = 3;
  handles.maxLength = 4000;
  const key = node('input', '', 'field media-field');
  key.type = 'password';
  key.autocomplete = 'off';
  key.required = true;
  const handleLabel = node('label', 'Creator handles or channel IDs');
  handleLabel.append(handles);
  const keyLabel = node('label', 'Restricted YouTube Data API key');
  keyLabel.append(key);
  const submit = node('button', 'Import creators', 'button primary');
  submit.type = 'submit';
  let controller;
  const stop = button('Stop import', () => controller?.abort());
  stop.disabled = true;
  const report = node('p', '', 'media-meta');
  report.setAttribute('role', 'status');
  const exportButton = button('Export creator library', () => {
    const file = URL.createObjectURL(new Blob([JSON.stringify({channels: state.channels}, null, 2)], {type: 'application/json'}));
    const anchor = node('a');
    anchor.href = file;
    anchor.download = 'unstable-library.json';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(file), 1000);
  });
  exportButton.disabled = !state.channels.length;
  const importFile = node('input');
  importFile.type = 'file';
  importFile.accept = 'application/json,.json';
  importFile.hidden = true;
  const restoreButton = button('Load exported library', () => importFile.click());
  const storage = () => persist(CHANNEL_STORE, {handles: state.handles, channels: state.channels});
  const merge = (channel) => {
    const old = state.channels.find((item) => item.id === channel.id);
    if (!old || old.at <= channel.at) {
      state.channels = [...state.channels.filter((item) => item.id !== channel.id), channel];
    }
  };
  importFile.addEventListener('change', async () => {
    try {
      const file = importFile.files[0];
      if (!file) return;
      if (file.size > 12_000_000) throw new Error('This library is larger than 12 MB.');
      const incoming = validChannels(JSON.parse(await file.text()).channels);
      if (!incoming.length) throw new Error('This file contains no valid creator catalogs.');
      incoming.forEach(merge);
      const saved = storage();
      exportButton.disabled = false;
      report.textContent = `${incoming.length} creator catalogs loaded.${saved ? '' : ' Browser storage is unavailable.'}`;
      changed();
    } catch (error) {
      report.textContent = error instanceof SyntaxError ? 'This is not a valid JSON library.' : error.message;
    } finally {
      importFile.value = '';
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    let requested;
    try {
      requested = creatorHandles(handles.value);
    } catch (error) {
      report.textContent = error.message;
      return;
    }
    const secret = key.value.trim();
    if (!secret || controller) return;
    controller = new AbortController();
    const {signal} = controller;
    state.handles = handles.value;
    key.value = '';
    submit.disabled = key.disabled = handles.disabled = restoreButton.disabled = true;
    stop.disabled = false;
    const messages = [];
    let count = 0;
    try {
      for (const handle of requested) {
        if (signal.aborted) break;
        try {
          const channel = await readChannel(handle, secret, signal, (message) => {
            report.textContent = [...messages, message].join(' ');
          });
          if (signal.aborted) break;
          merge(channel);
          count++;
          if (!storage()) messages.push('Browser storage is unavailable. Export to keep these results.');
          exportButton.disabled = false;
          changed();
        } catch (error) {
          if (!signal.aborted) messages.push(`${handle}: ${error.name === 'TimeoutError' ? 'Request timed out.' : error.message}`);
        }
      }
    } finally {
      controller = null;
      submit.disabled = key.disabled = handles.disabled = restoreButton.disabled = false;
      stop.disabled = true;
      const summary = signal.aborted ? 'Import stopped.' : 'Import finished.';
      report.textContent = [summary, `${count} of ${requested.size} creator catalogs were updated.`, ...messages].join(' ');
    }
  });
  const actions = node('div', '', 'media-actions');
  actions.append(submit, stop, exportButton, restoreButton);
  form.append(handleLabel, keyLabel, actions, importFile, report);
  section.append(summary, node('p', 'Import public uploads from YouTube using a key restricted to your site. The key is used for this session only.', 'media-meta'), form);
  return {section, stop: () => controller?.abort()};
}

async function identifyVideo(video, signal) {
  const url = new URL('https://www.youtube-nocookie.com/oembed');
  url.search = new URLSearchParams({url: lookup(video.id), format: 'json'});
  const response = await fetch(url, {signal: AbortSignal.any([signal, AbortSignal.timeout(6000)])});
  if (!response.ok) throw new Error('YouTube could not confirm this video.');
  const result = await response.json();
  return sanitizeVideo({...video, title: result.title, creator: result.author_name});
}

function youtubePage(target) {
  const store = preference(VIDEO_STORE);
  const channelStore = preference(CHANNEL_STORE);
  const ids = (values) => Array.isArray(values) ? [...new Set(values.filter((id) => VIDEO_ID.test(id)))].slice(0, 100) : [];
  const state = {
    favorites: ids(store.favorites),
    recent: ids(store.recent).slice(0, 30),
    extra: Array.isArray(store.extra) ? store.extra.map(sanitizeVideo).filter(Boolean).slice(-100) : [],
    endpoint: typeof store.endpoint === 'string' ? store.endpoint : '',
    channels: validChannels(channelStore.channels),
    handles: typeof channelStore.handles === 'string' ? channelStore.handles : DEFAULT_CREATORS
  };
  const save = () => persist(VIDEO_STORE, {
    favorites: state.favorites, recent: state.recent, extra: state.extra, endpoint: state.endpoint
  });
  const root = node('section', '', 'media-page');
  const filters = node('div', '', 'media-filters');
  const views = node('div', '', 'media-tabs');
  const input = search('Search titles, creators, or topics');
  const topics = [...new Set([...SHORTS, ...CREATOR_VIDEOS, ...addedShorts, ...addedVideos]
    .flatMap(video => video.tags))].sort();
  const category = filter('Video topic', ['All topics', ...topics]);
  const creator = filter('Video creator', ['All creators']);
  const count = node('p', '', 'media-meta media-result-count');
  const notice = node('p', '', 'media-meta media-notice');
  notice.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  const grid = node('div', '', 'media-grid media-videos');
  const controls = node('div', '', 'media-actions media-pages');
  const prev = button('Previous page', () => changePage(-1));
  const next = button('Next page', () => changePage(1));
  const pageLabel = node('span', '', 'media-meta');
  controls.append(prev, pageLabel, next);
  const addressForm = node('form', '', 'media-filters media-link-form');
  const address = search('Paste a YouTube video or Shorts link');
  address.required = true;
  const play = node('button', 'Open video', 'button');
  play.type = 'submit';
  addressForm.append(address, play);
  const externalSearch = link('Search on YouTube', 'https://www.youtube.com/', 'button');
  let view = 'Shorts';
  let page = 0;
  let closeDialog;
  let active = true;
  let videoCheck;
  let onlineResults = [];
  let onlineRequest;

  const importer = creatorImport(state, () => {
    updateCreatorOptions();
    draw();
  });

  const viewButtons = new Map();
  for (const tab of ['Shorts', 'Full videos', 'Favorites', 'Recently opened']) {
    const choice = button(tab, () => {
      onlineRequest?.abort();
      notice.textContent = '';
      view = tab;
      page = 0;
      category.selectedIndex = 0;
      creator.selectedIndex = 0;
      draw();
    }, 'button media-tab');
    viewButtons.set(tab, choice);
    views.append(choice);
  }
  views.setAttribute('aria-label', 'Video collections');
  const linkTools = node('div', '', 'media-link-tools');
  linkTools.append(addressForm, externalSearch);
  const connectedSearch = node('details', '', 'media-import');
  const settings = node('form', '', 'media-filters');
  const endpointLabel = node('label', 'YouTube search endpoint');
  const endpoint = node('input', '', 'field media-field');
  endpoint.value = state.endpoint;
  endpoint.placeholder = 'https://example.com/api/youtube';
  endpointLabel.append(endpoint);
  const saveEndpoint = node('button', 'Save search endpoint', 'button');
  saveEndpoint.type = 'submit';
  const settingsStatus = node('p', '', 'media-meta');
  settingsStatus.setAttribute('role', 'status');
  const online = button('Search connected service', searchOnline);
  online.hidden = !state.endpoint;
  linkTools.append(online);
  settings.append(endpointLabel, saveEndpoint, settingsStatus);
  connectedSearch.append(node('summary', 'Connected YouTube search'), settings);
  settings.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const address = endpoint.value.trim();
      state.endpoint = address ? searchServiceUrl(address).href : '';
      online.hidden = !state.endpoint;
      const saved = save();
      settingsStatus.textContent = `Search endpoint ${address ? 'updated' : 'removed'}.${saved ? '' : ' Browser storage is unavailable.'}`;
    } catch (error) {
      settingsStatus.textContent = error.message;
    }
  });
  filters.append(input, category, creator);
  root.append(heading('YouTube', 'Browse curated gaming Shorts and full videos without an API key.'),
    views, filters, count, grid, controls, linkTools, notice, importer.section, connectedSearch);
  target.replaceChildren(root);

  function allVideos() {
    return new Map([...state.channels.flatMap(({items}) => items), ...state.extra,
      ...CREATOR_VIDEOS, ...addedVideos, ...SHORTS, ...addedShorts].map((video) => [video.id, video]));
  }

  function rememberOnlineVideo(video) {
    if (!state.extra.some(({id}) => id === video.id) && onlineResults.some(({id}) => id === video.id)) {
      state.extra = [...state.extra, video].slice(-100);
    }
  }

  function showVideo(video) {
    closeDialog?.();
    rememberOnlineVideo(video);
    state.recent = [video.id, ...state.recent.filter((id) => id !== video.id)].slice(0, 30);
    save();
    if (view === 'Recently opened') draw();
    closeDialog = watchDialog(root, {
      title: video.title,
      subtitle: video.creator,
      video,
      external: lookup(video.id, video.short),
      directLabel: 'Watch on YouTube',
      short: video.short
    });
  }

  function updateCreatorOptions() {
    const selected = creator.value;
    const names = [...new Set([...allVideos().values()].map(({creator}) => creator).filter(Boolean))].sort();
    creator.replaceChildren(...['All creators', ...names].map((name) => node('option', name)));
    if (names.includes(selected)) creator.value = selected;
  }

  function card(video) {
    const item = node('article', '', 'media-card media-video');
    const watch = button('', () => showVideo(video), 'media-card-launch');
    watch.setAttribute('aria-label', `Watch ${video.title}`);
    const art = image(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, video.title);
    const info = node('span', '', 'media-card-body');
    info.append(node('strong', video.title, 'media-card-title'), node('span', video.creator, 'media-meta'));
    watch.append(art, info);
    const favorite = button('', () => {
      const saving = !state.favorites.includes(video.id);
      if (saving) rememberOnlineVideo(video);
      state.favorites = saving
        ? [video.id, ...state.favorites].slice(0, 100)
        : state.favorites.filter((id) => id !== video.id);
      if (!save()) notice.textContent = 'Favorites are available for this session. Browser storage is unavailable.';
      if (view === 'Favorites') {
        draw();
        grid.querySelector('.media-favorite')?.focus();
      } else updateFavorite();
    }, 'media-favorite');
    function updateFavorite() {
      const saved = state.favorites.includes(video.id);
      favorite.textContent = saved ? '★' : '☆';
      favorite.setAttribute('aria-pressed', String(saved));
      favorite.setAttribute('aria-label', `${saved ? 'Remove from' : 'Add to'} favorites: ${video.title}`);
    }
    updateFavorite();
    item.append(watch, favorite);
    return item;
  }

  function draw() {
    for (const [name, choice] of viewButtons) choice.setAttribute('aria-pressed', String(view === name));
    category.disabled = creator.disabled = view === 'Connected search';
    const library = allVideos();
    let videos;
    if (view === 'Favorites') videos = state.favorites.map((id) => library.get(id)).filter(Boolean);
    else if (view === 'Recently opened') videos = state.recent.map((id) => library.get(id)).filter(Boolean);
    else if (view === 'Connected search') videos = onlineResults;
    else videos = [...library.values()].filter((video) => Boolean(video.short) === (view === 'Shorts'));
    const results = view === 'Connected search' ? videos : videos.filter((video) =>
      (category.selectedIndex === 0 || video.tags.includes(category.value)) &&
      (creator.selectedIndex === 0 || video.creator === creator.value) && matches(input.value, video.title, video.creator, ...video.tags));
    const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const prefs = view === 'Favorites' || view === 'Recently opened';
    const resultType = view === 'Shorts' ? 'Short' : 'video';
    count.textContent = `${results.length} ${resultType}${results.length === 1 ? '' : 's'}`;
    grid.classList.toggle('media-shorts', view === 'Shorts');
    grid.replaceChildren(...results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(card));
    if (!results.length) {
      grid.append(node('p', prefs && !videos.length ? `Your ${view.toLowerCase()} collection is empty.` : 'No videos match your search.', 'media-empty'));
    }
    controls.hidden = pages === 1;
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page + 1 === pages;
    externalSearch.href = input.value.trim()
      ? `https://www.youtube.com/results?${new URLSearchParams({search_query: input.value.trim()})}`
      : 'https://www.youtube.com/';
  }

  function changePage(direction) {
    page += direction;
    draw();
    count.scrollIntoView({block: 'nearest'});
  }

  async function searchOnline() {
    const query = input.value.trim().slice(0, 200);
    if (!query) {
      input.focus();
      notice.textContent = 'Enter a video topic first.';
      return;
    }
    onlineRequest?.abort();
    const request = new AbortController();
    onlineRequest = request;
    const {signal} = request;
    notice.textContent = 'Searching the connected service…';
    try {
      const url = searchServiceUrl(state.endpoint);
      url.search = new URLSearchParams({q: query, safeSearch: 'strict', videoEmbeddable: 'true'});
      const response = await fetch(url, {credentials: 'omit', cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), headers: {Accept: 'application/json'}});
      if (!response.ok) throw new Error('The connected search service is unavailable.');
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('The search service did not return a video list.');
      if (signal.aborted) return;
      onlineResults = [...new Map(data.items.slice(0, 100).map(sanitizeVideo).filter(Boolean)
        .map((video) => [video.id, video])).values()];
      view = 'Connected search';
      page = 0;
      notice.textContent = 'Results from the connected YouTube search service.';
      draw();
    } catch (error) {
      if (!signal.aborted) notice.textContent = error.name === 'TimeoutError'
        ? 'The search service timed out. Try again or search on YouTube.'
        : 'The connected search service could not be reached or returned an invalid response.';
    }
  }

  const changeFilters = () => {
    page = 0;
    draw();
  };
  input.addEventListener('input', changeFilters);
  category.addEventListener('change', changeFilters);
  creator.addEventListener('change', changeFilters);
  addressForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const candidate = parseYouTubeVideo(address.value);
    if (!candidate) {
      notice.textContent = 'Enter a valid YouTube video or Shorts link.';
      return;
    }
    const known = allVideos().get(candidate.id);
    notice.textContent = '';
    if (known) {
      showVideo(known);
      return;
    }
    play.disabled = true;
    notice.textContent = 'Checking the video on YouTube…';
    videoCheck = new AbortController();
    let video;
    try {
      video = await identifyVideo(candidate, videoCheck.signal);
    } catch {
      // A valid destination can still be opened if metadata or embedding is restricted.
    } finally {
      videoCheck = null;
      play.disabled = false;
    }
    if (!active) return;
    if (!video) {
      notice.replaceChildren(document.createTextNode('YouTube could not confirm this video. '),
        link('Open the original YouTube link', lookup(candidate.id, candidate.short), 'media-credit'));
      return;
    }
    state.extra = [...state.extra, video].slice(-100);
    notice.textContent = '';
    updateCreatorOptions();
    draw();
    showVideo(video);
  });
  updateCreatorOptions();
  draw();
  return () => {
    active = false;
    videoCheck?.abort();
    importer.stop();
    onlineRequest?.abort();
    closeDialog?.();
  };
}

export function renderMedia(target, page) {
  return page === 'movies' ? moviePage(target) : youtubePage(target);
}
