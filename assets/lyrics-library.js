const release = new URL(import.meta.url).search;
const [{ lyricsChart }, { lyricsSources, normalizeLyricsText: normalize, appleMusicSearchUrl }] = await Promise.all([
  import(`./lyrics-chart.js${release}`),
  import(`./lyrics-sources.js${release}`)
]);

const batchSize = 25;
const featuredTitles = ['housewife', 'dracula'];
const corrections = new Map([['house wifre', 'housewife'], ['house wife', 'housewife'], ['drcula', 'dracula']]);
const songIndex = lyricsChart.map(song => ({ song, match: normalize(`${song.title} ${song.artist}`) }));
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

function sourceFor(song) {
  const title = normalize(song.title);
  const artist = normalize(song.artist);
  return lyricsSources[`${title}|${artist}`];
}

function officialVideo(song) {
  const source = sourceFor(song);
  if (!source) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(source.videoId || '')) {
    return { id: source.videoId, url: `https://www.youtube.com/watch?v=${source.videoId}` };
  }
  if (source.label === 'Official lyric video on Apple Music'
      && /^https:\/\/music\.apple\.com\/[a-z]{2}\/music-video\//.test(source.url)) {
    return { url: source.url, provider: 'Apple Music' };
  }
  return null;
}

function lyricVideoSearch(song) {
  const url = new URL('https://www.youtube.com/results');
  const exact = [song.title, song.artist].map(value => `"${value.replace(/"/g, '')}"`);
  url.searchParams.set('search_query', `${exact.join(' ')} official lyric video`);
  return url.href;
}

export function findChartSongs(query = '', chart = '', videosOnly = false) {
  const normalized = normalize(query);
  const words = (corrections.get(normalized) || normalized).split(' ').filter(Boolean);
  return songIndex
    .filter(({ song, match }) => (!chart || song.sourceUrl === chart) && words.every(word => match.includes(word))
      && (!videosOnly || officialVideo(song)))
    .map(({ song }) => song);
}

export function renderLyrics(target, params) {
  const page = element('section', 'lyrics-library');
  const head = element('header', 'lyrics-heading');
  const copy = element('div');
  const edition = displayDate.format(new Date(lyricsChart[0].date));
  copy.append(element('h1', '', 'Music'), element('p', 'muted', `Find lyrics and official lyric videos. Charts dated ${edition}.`));
  const musicVideos = link('Music videos', '#music?view=videos');
  head.append(copy, musicVideos);
  page.append(head);

  const opening = element('section', 'lyrics-feature');
  opening.append(element('h2', '', 'Featured lyric videos'));
  const featured = element('div', 'lyrics-feature-grid');
  for (const name of featuredTitles) {
    const song = lyricsChart.find(entry => normalize(entry.title) === name);
    if (!song) continue;
    const card = element('div', 'lyrics-feature-song');
    const title = element('div');
    title.append(element('h3', '', song.title), element('p', 'muted', song.artist));
    card.append(title, songActions(song));
    featured.append(card);
  }
  opening.append(featured);
  page.append(opening);

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
  chart.append(new Option('All chart sources', ''), ...charts.map(entry => new Option(entry.source, entry.sourceUrl)));
  chartLabel.append(chart);
  filters.append(queryLabel, chartLabel);
  const videoFilter = element('label', 'lyrics-video-filter');
  const videosOnly = element('input');
  videosOnly.type = 'checkbox';
  videoFilter.append(videosOnly, element('span', '', 'Official lyric videos only'));
  filters.append(videoFilter);
  page.append(filters);

  const status = element('p', 'muted lyrics-count');
  status.setAttribute('role', 'status');
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
  page.append(status, list, more, attribution);
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
    const video = officialVideo(song);
    if (video) {
      const play = video.id
        ? button('Play lyrics video', () => openLyricVideo(song, video), 'button primary lyrics-video-action')
        : link(`Lyric video on ${video.provider}`, video.url, 'button primary lyrics-video-action', true);
      play.setAttribute('aria-label', `Play lyrics video for ${song.title} by ${song.artist}${video.provider ? ` on ${video.provider}` : ''}`);
      actions.append(play);
    }
    actions.append(songButton(song));
    if (!video?.id) {
      const find = link('Find lyric videos', lyricVideoSearch(song), 'button lyrics-find-action', true);
      find.setAttribute('aria-label', `Find lyric videos for ${song.title} by ${song.artist}`);
      actions.append(find);
    }
    return actions;
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

  function providerActions(song, video, excludedUrl) {
    const source = sourceFor(song);
    const choices = new Map();
    if (source) choices.set(source.url, source.label);
    if (source?.alternateUrl && source.alternateLabel) choices.set(source.alternateUrl, source.alternateLabel);
    if (video?.id) choices.set(video.url, 'Official lyric video on YouTube');
    if (source?.label !== 'Lyrics on Apple Music') {
      choices.set(song.trackUrl || appleMusicSearchUrl(song.title, song.artist),
        song.trackUrl ? 'Lyrics on Apple Music' : 'Find song on Apple Music');
    }
    if (!video?.id) choices.set(lyricVideoSearch(song), 'Find lyric videos');
    const actions = element('div', 'lyrics-provider-actions');
    for (const [url, label] of choices) {
      if (url !== excludedUrl) {
        const primary = !video?.id && !actions.childElementCount;
        actions.append(link(label, url, primary ? 'button primary' : 'button', true));
      }
    }
    return actions;
  }

  async function openLyricVideo(song, video) {
    const revision = ++dialogRevision;
    let watchDialog;
    try {
      ({ watchDialog } = await import(`./media.js${release}`));
    } catch {
      if (revision === dialogRevision && page.isConnected) openLyrics(song, true);
      return;
    }
    if (revision !== dialogRevision || !page.isConnected) return;
    try {
      closeLyrics();
      releasePlayer = watchDialog(page, {
        title: `Lyrics for ${song.title}`,
        subtitle: song.artist,
        video: { id: video.id, title: `${song.title} official lyric video` },
        external: video.url,
        directLabel: 'Official lyric video on YouTube',
        details: providerActions(song, video, video.url)
      });
    } catch {
      if (page.isConnected) openLyrics(song, true);
    }
  }

  function openLyrics(song, playbackFailed = false) {
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
      const error = element('p', 'lyrics-dialog-copy', 'The in-page player could not start. You can still open the official lyric video on YouTube.');
      error.setAttribute('role', 'status');
      dialog.append(error);
    } else {
      dialog.append(element('p', 'lyrics-dialog-copy', 'Apple Music may require sign-in or a subscription to show lyrics.'));
    }
    const video = officialVideo(song);
    const actions = providerActions(song, video);
    if (video?.id && !playbackFailed) {
      actions.prepend(button('Play official lyric video here', () => openLyricVideo(song, video), 'button primary'));
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
    const results = findChartSongs(query.value, chart.value, videosOnly.checked);
    const text = query.value.trim();
    const videoParams = new URLSearchParams({ view: 'videos' });
    if (text) videoParams.set('q', text);
    musicVideos.href = `#music?${videoParams}`;
    opening.hidden = Boolean(text || chart.value || videosOnly.checked);
    status.textContent = results.length
      ? `Showing ${Math.min(visible, results.length)} of ${results.length} chart songs${videosOnly.checked ? ' with official lyric videos' : ''}`
      : videosOnly.checked ? 'No songs with official lyric videos match this search.' : 'No songs match this search.';
    list.replaceChildren(...results.slice(0, visible).map(song => {
      const row = element('li', 'lyrics-song');
      const rank = element('span', 'lyrics-rank', `#${song.rank}`);
      const title = element('div', 'lyrics-track');
      title.append(element('h3', '', song.title), element('p', 'muted', song.artist));
      const source = link(song.source, song.sourceUrl, 'lyrics-source text-action', true);
      row.append(rank, title, source, songActions(song));
      return row;
    }));
    more.hidden = visible >= results.length;
  }

  function resetFilter() {
    visible = batchSize;
    draw();
  }
  query.addEventListener('input', resetFilter);
  chart.addEventListener('change', resetFilter);
  videosOnly.addEventListener('change', resetFilter);
  draw();
  return closeLyrics;
}
