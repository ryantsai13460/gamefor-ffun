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

export function findChartSongs(query = '', chart = '') {
  const normalized = normalize(query);
  const words = (corrections.get(normalized) || normalized).split(' ').filter(Boolean);
  return songIndex
    .filter(({ song, match }) => (!chart || song.sourceUrl === chart) && words.every(word => match.includes(word)))
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
  opening.append(element('h2', '', 'Chart lyrics'));
  const featured = element('div', 'lyrics-feature-grid');
  for (const name of featuredTitles) {
    const song = lyricsChart.find(entry => normalize(entry.title) === name);
    if (!song) continue;
    const card = element('div', 'lyrics-feature-song');
    const title = element('div');
    title.append(element('h3', '', song.title), element('p', 'muted', song.artist));
    card.append(title, songButton(song));
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

  function songButton(song) {
    const open = button('Lyrics', () => openLyrics(song));
    open.setAttribute('aria-label', `Lyrics for ${song.title} by ${song.artist}`);
    return open;
  }

  function closeLyrics() {
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = undefined;
    if (dialog.open) dialog.close();
    dialog.remove();
  }

  function openLyrics(song) {
    closeLyrics();
    const dialog = element('dialog', 'media-dialog lyrics-dialog');
    dialog.setAttribute('aria-label', `Lyrics for ${song.title}`);
    const head = element('header', 'media-dialog-header');
    const title = element('div');
    title.append(element('h2', '', song.title), element('p', 'muted', song.artist));
    const close = button('Close', closeLyrics);
    close.autofocus = true;
    head.append(title, close);
    dialog.append(head, element('p', 'lyrics-dialog-copy', 'Apple Music may require sign-in or a subscription to show lyrics.'));
    const actions = element('div', 'interaction-row');
    const source = sourceFor(song);
    if (source) actions.append(link(source.label, source.url, 'button primary', true));
    if (source?.label !== 'Lyrics on Apple Music') {
      const lookup = song.trackUrl || appleMusicSearchUrl(song.title, song.artist);
      actions.append(link(song.trackUrl ? 'Lyrics on Apple Music' : 'Find song on Apple Music', lookup, 'button', true));
    }
    if (source?.videoId) {
      const stage = element('div', 'media-player lyrics-video');
      stage.hidden = true;
      const play = button('Play official lyric video here', () => {
        const frame = element('iframe');
        frame.title = `${song.title} official lyric video`;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = `https://www.youtube-nocookie.com/embed/${source.videoId}?autoplay=1&playsinline=1`;
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
        stage.replaceChildren(frame);
        stage.hidden = false;
        play.hidden = true;
      }, 'button primary');
      actions.prepend(play);
      dialog.append(stage);
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
    const results = findChartSongs(query.value, chart.value);
    const text = query.value.trim();
    const videoParams = new URLSearchParams({ view: 'videos' });
    if (text) videoParams.set('q', text);
    musicVideos.href = `#music?${videoParams}`;
    opening.hidden = Boolean(text || chart.value);
    status.textContent = results.length
      ? `Showing ${Math.min(visible, results.length)} of ${results.length} chart songs`
      : 'No songs match this search.';
    list.replaceChildren(...results.slice(0, visible).map(song => {
      const row = element('li', 'lyrics-song');
      const rank = element('span', 'lyrics-rank', `#${song.rank}`);
      const title = element('div', 'lyrics-track');
      title.append(element('h3', '', song.title), element('p', 'muted', song.artist));
      const source = link(song.source, song.sourceUrl, 'lyrics-source text-action', true);
      row.append(rank, title, source, songButton(song));
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
  draw();
  return closeLyrics;
}
