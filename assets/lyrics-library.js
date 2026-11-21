const release = new URL(import.meta.url).search;
const [{ lyricsChart }, { lyricsSources, normalizeLyricsText: normalize, appleMusicSearchUrl }, { sevenCloudsLyrics }, { otherChannelLyrics }] = await Promise.all([
  import(`./lyrics-chart.js${release}`),
  import(`./lyrics-sources.js${release}`),
  import(`./lyrics-7clouds.js${release}`),
  import(`./lyrics-other-channels.js${release}`)
]);

const batchSize = 25;
const corrections = new Map([['house wifre', 'housewife'], ['house wife', 'housewife'], ['drcula', 'dracula']]);
const searchIndex = songs => songs.map(song => ({ song, match: normalize(`${song.title} ${song.artist}`) }));
const trackKey = (title, artist) => `${normalize(title)}|${normalize(artist)}`;
const songIndex = searchIndex(lyricsChart);
export const creatorLyricVideos = [...new Map([...sevenCloudsLyrics, ...otherChannelLyrics].map(video => [video.id, video])).values()];
const videoIndex = searchIndex(creatorLyricVideos);
const videoByTrack = new Map();
for (const video of creatorLyricVideos) {
  const key = trackKey(video.chartTitle || video.title, video.artist);
  if (!videoByTrack.has(key)) videoByTrack.set(key, video);
}
const channels = [...new Set(creatorLyricVideos.map(video => video.channel))];
const charts = [...new Map(lyricsChart.map(song => [song.sourceUrl, song])).values()];
const displayDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text, action, className = 'button') {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function link(text, href, className = 'button', external = false) {
  const anchor = element('a', className, text);
  anchor.href = href;
  if (external) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

function trackVideo(song) {
  return videoByTrack.get(trackKey(song.title, song.artist));
}

function watchUrl(video) {
  return `https://www.youtube.com/watch?v=${video.id}`;
}

function videoArtwork(song) {
  const art = element('div', 'lyrics-video-art');
  art.setAttribute('aria-hidden', 'true');
  art.append(element('span', 'lyrics-video-art-title', song.title));
  return art;
}

function lyricVideoSearch(song) {
  const url = new URL('https://www.youtube.com/results');
  const exact = [song.title, song.artist].map(value => `"${value.replace(/"/g, '')}"`);
  url.searchParams.set('search_query', `${exact.join(' ')} lyric video`);
  return url.href;
}

function searchTracks(index, query, include) {
  const normalized = normalize(query);
  const words = (corrections.get(normalized) || normalized).split(' ').filter(Boolean);
  return index.filter(({ song, match }) => include(song) && words.every(word => match.includes(word)))
    .map(({ song }) => song);
}

export function findChartSongs(query = '', chart = '', videosOnly = false) {
  return searchTracks(songIndex, query, song => (!chart || song.sourceUrl === chart) && (!videosOnly || trackVideo(song)));
}

export function renderLyrics(target, params) {
  let watchView = params?.get('lyrics') === 'watch';
  const page = element('section', 'lyrics-library');
  const head = element('header', 'lyrics-heading');
  const copy = element('div');
  const edition = displayDate.format(new Date(lyricsChart[0].date));
  copy.append(element('h1', '', 'Music'), element('p', 'muted', `Watch lyrics from 7clouds and other lyric channels, or browse the ${edition} charts.`));
  head.append(copy);
  const views = element('nav', 'lyrics-views');
  views.setAttribute('aria-label', 'Music views');
  const watchLyrics = button('Watch lyrics', () => chooseView(true), 'button primary');
  const allSongs = button('All chart songs', () => chooseView(false));
  const musicVideos = link('Music videos', '#music?view=videos');
  views.append(watchLyrics, allSongs, musicVideos);
  page.append(head, views);

  const filters = element('div', 'lyrics-filters');
  const queryLabel = element('label', '', 'Song or artist');
  const query = element('input', 'field');
  query.type = 'search';
  query.placeholder = 'Search chart songs';
  query.maxLength = 160;
  query.value = (params?.get('q') || '').slice(0, query.maxLength);
  queryLabel.append(query);
  const chartLabel = element('label', '', 'Chart source');
  const chart = element('select', 'field');
  chart.append(new Option('All chart sources', ''), ...charts.map(entry => new Option(
    entry.source === 'Billboard Hot 100' ? entry.source : `${entry.source} · ${entry.market}`, entry.sourceUrl
  )));
  chartLabel.append(chart);
  const channelLabel = element('label', 'lyrics-channel', 'Lyric channel');
  const channel = element('select', 'field');
  channel.append(new Option('All lyric channels', ''), ...channels.map(name => new Option(name, name)));
  channelLabel.append(channel);
  filters.append(queryLabel, chartLabel, channelLabel);
  const videoFilter = element('label', 'lyrics-video-filter');
  const videosOnly = element('input');
  videosOnly.type = 'checkbox';
  videoFilter.append(videosOnly, element('span', '', 'Lyric videos only'));
  filters.append(videoFilter);
  page.append(filters);

  const status = element('p', 'muted lyrics-count');
  status.setAttribute('role', 'status');
  const lyricIntro = element('p', 'lyrics-watch-intro', 'Lyrics on screen from 7clouds and other lyric channels.');
  const list = element('ol', 'lyrics-song-list');
  list.setAttribute('aria-label', 'Chart songs');
  const more = button('Load more songs', () => {
    const previousCount = list.childElementCount;
    visible += batchSize;
    draw();
    list.children[previousCount]?.querySelector('button')?.focus({ preventScroll: true });
  });
  more.classList.add('lyrics-more');
  const attribution = element('details', 'lyrics-attribution');
  const summary = element('summary', '', 'Chart sources');
  const sources = element('ul');
  for (const entry of charts) {
    const item = element('li');
    item.append(link(`${entry.source} · ${displayDate.format(new Date(entry.date))}`, entry.sourceUrl, 'text-action', true));
    sources.append(item);
  }
  attribution.append(summary, sources);
  page.append(lyricIntro, status, list, more, attribution);
  target.replaceChildren(page);

  let visible = batchSize;
  let activeDialog;
  let releasePlayer;
  let dialogRevision = 0;

  function songButton(song) {
    const open = button('Lyrics', () => openLyrics(song));
    open.setAttribute('aria-label', `Lyrics for ${song.title} by ${song.artist}`);
    return open;
  }

  function songActions(song) {
    const actions = element('div', 'lyrics-song-actions');
    const video = trackVideo(song);
    if (video) actions.append(playButton(song, video));
    actions.append(songButton(song));
    if (!video) {
      const find = link('Find lyric videos', lyricVideoSearch(song), 'button lyrics-find-action', true);
      find.setAttribute('aria-label', `Find lyric videos for ${song.title} by ${song.artist}`);
      actions.append(find);
    }
    return actions;
  }

  function playButton(song, video) {
    const play = button('Play lyrics video', () => openLyricVideo(song, video), 'button primary lyrics-video-action');
    play.setAttribute('aria-label', `Play lyrics video for ${song.title} by ${song.artist}`);
    play.setAttribute('aria-haspopup', 'dialog');
    return play;
  }

  function closeLyrics() {
    dialogRevision++;
    const dispose = releasePlayer;
    releasePlayer = undefined;
    dispose?.();
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = undefined;
    if (dialog.open) dialog.close();
    dialog.remove();
  }

  function providerActions(song, video, inPlayer = false) {
    const actions = element('div', 'lyrics-provider-actions');
    if (video && !inPlayer) actions.append(link(`Watch on YouTube · ${video.channel}`, watchUrl(video), 'button', true));
    if (song.sourceUrl) {
      const source = lyricsSources[trackKey(song.title, song.artist)];
      const appleUrl = source?.url || song.trackUrl;
      actions.append(link(appleUrl ? 'Lyrics on Apple Music' : 'Find song on Apple Music',
        appleUrl || appleMusicSearchUrl(song.title, song.artist), 'button', true));
      if (!video) actions.append(link('Find lyric videos', lyricVideoSearch(song), 'button', true));
    }
    return actions;
  }

  async function openLyricVideo(song, video) {
    const revision = ++dialogRevision;
    let watchDialog;
    try {
      ({ watchDialog } = await import(`./media.js${release}`));
    } catch {
      if (revision === dialogRevision && page.isConnected) openLyrics(song, video, true);
      return;
    }
    if (revision !== dialogRevision || !page.isConnected) return;
    try {
      closeLyrics();
      releasePlayer = watchDialog(page, {
        title: `Lyrics for ${song.title}`,
        subtitle: `${song.artist} · ${video.channel}`,
        video: { id: video.id, title: `${song.title} lyric video from ${video.channel}` },
        external: watchUrl(video),
        directLabel: `Watch on YouTube · ${video.channel}`,
        details: song.sourceUrl ? providerActions(song, video, true) : undefined
      });
    } catch {
      if (page.isConnected) openLyrics(song, video, true);
    }
  }

  function openLyrics(song, video = trackVideo(song), playbackFailed = false) {
    closeLyrics();
    const dialog = element('dialog', 'media-dialog lyrics-dialog');
    dialog.setAttribute('aria-label', `Lyrics for ${song.title}`);
    const head = element('header', 'media-dialog-header');
    const title = element('div');
    title.append(element('h2', '', song.title), element('p', 'muted', song.artist));
    const close = button('Close', closeLyrics);
    close.autofocus = true;
    head.append(title, close);
    dialog.append(head);
    if (playbackFailed) {
      const error = element('p', 'lyrics-dialog-copy', 'The in-page player could not start. You can open the lyric video on YouTube.');
      error.setAttribute('role', 'status');
      dialog.append(error);
    } else {
      dialog.append(element('p', 'lyrics-dialog-copy', 'Apple Music may require sign-in or a subscription to show lyrics.'));
    }
    const actions = providerActions(song, video);
    if (video && !playbackFailed) {
      actions.prepend(button('Play lyric video here', () => openLyricVideo(song, video), 'button primary'));
    }
    dialog.append(actions);
    dialog.addEventListener('close', () => {
      if (activeDialog === dialog) closeLyrics();
    }, { once: true });
    activeDialog = dialog;
    page.append(dialog);
    dialog.showModal();
  }

  function draw() {
    const results = watchView
      ? searchTracks(videoIndex, query.value, video => !channel.value || video.channel === channel.value)
      : findChartSongs(query.value, chart.value, videosOnly.checked);
    const text = query.value.trim();
    const videoParams = new URLSearchParams({ view: 'videos' });
    if (text) videoParams.set('q', text);
    musicVideos.href = `#music?${videoParams}`;
    watchLyrics.setAttribute('aria-pressed', String(watchView));
    allSongs.setAttribute('aria-pressed', String(!watchView));
    chartLabel.hidden = watchView;
    channelLabel.hidden = !watchView;
    videoFilter.hidden = watchView;
    lyricIntro.hidden = !watchView;
    attribution.hidden = watchView;
    query.placeholder = watchView ? 'Search lyric videos' : 'Search chart songs';
    list.setAttribute('aria-label', watchView ? 'Lyric videos' : 'Chart songs');
    more.textContent = watchView ? 'Load more lyric videos' : 'Load more songs';
    list.classList.toggle('lyrics-video-list', watchView);
    if (watchView) {
      status.textContent = results.length
        ? `Showing ${Math.min(visible, results.length)} of ${results.length} lyric videos`
        : 'No lyric videos match this search.';
    } else {
      status.textContent = results.length
        ? `Showing ${Math.min(visible, results.length)} of ${results.length} chart songs${videosOnly.checked ? ' with lyric videos' : ''}`
        : videosOnly.checked ? 'No chart songs with lyric videos match this search.' : 'No songs match this search.';
    }
    list.replaceChildren(...results.slice(0, visible).map(song => {
      const row = element('li', watchView ? 'lyrics-song lyrics-video-card' : 'lyrics-song');
      const title = element('div', 'lyrics-track');
      title.append(element('h3', '', song.title), element('p', 'muted', song.artist));
      if (watchView) {
        const actions = element('div', 'lyrics-song-actions');
        actions.append(playButton(song, song));
        row.append(videoArtwork(song), title, link(song.channel, song.channelUrl, 'lyrics-source text-action', true), actions);
      } else {
        row.append(element('span', 'lyrics-rank', `#${song.rank}`), title,
          link(song.source, song.sourceUrl, 'lyrics-source text-action', true), songActions(song));
      }
      return row;
    }));
    more.hidden = visible >= results.length;
  }

  function resetFilter() {
    visible = batchSize;
    draw();
  }
  function chooseView(watch) {
    watchView = watch;
    resetFilter();
  }
  query.addEventListener('input', resetFilter);
  chart.addEventListener('change', resetFilter);
  channel.addEventListener('change', resetFilter);
  videosOnly.addEventListener('change', resetFilter);
  draw();
  return closeLyrics;
}
