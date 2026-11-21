const videoId = /^[A-Za-z0-9_-]{11}$/;
const youtubeScript = 'https://www.youtube.com/iframe_api';
let youtubeApi;

export function filmHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : '';
  } catch {
    return '';
  }
}

export function filmPlayback(film, trailer = false) {
  if (!trailer && Date.parse(film.availableUntil) <= Date.now()) return null;
  const id = trailer ? film.trailer : film.fullVideo;
  if (videoId.test(id || '') && (trailer || id !== film.trailer)) {
    return {
      provider: 'YouTube', id, external: `https://www.youtube.com/watch?v=${id}`,
      embed: (trailer ? film.trailerEmbeddable : film.fullEmbeddable) === false
        ? '' : `https://www.youtube-nocookie.com/embed/${id}`
    };
  }
  if (trailer) {
    const external = filmHttps(film.trailerLink);
    return external ? { provider: film.credit || new URL(external).hostname, external } : null;
  }

  const embed = filmHttps(film.embed);
  const external = filmHttps(film.fullWatch);
  if (embed) {
    const url = new URL(embed);
    const source = external || filmHttps(film.source);
    if (source && ['www.nfb.ca', 'nfb.ca'].includes(url.hostname) && /^\/film\/[\w-]+\/embed\/player\/$/.test(url.pathname)) {
      return { provider: 'NFB', external: source, embed };
    }
  }
  return external ? { provider: film.provider || new URL(external).hostname.replace(/^www\./, ''), external } : null;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function readyYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApi) return youtubeApi;
  youtubeApi = new Promise(resolve => {
    const existing = document.querySelector(`script[src="${youtubeScript}"]`);
    const script = existing || element('script');
    const fail = () => finish(null);
    function finish(api) {
      clearInterval(poll);
      clearTimeout(timer);
      script.removeEventListener('error', fail);
      if (!api && !existing) script.remove();
      resolve(api);
    }
    const poll = setInterval(() => { if (window.YT?.Player) finish(window.YT); }, 125);
    const timer = setTimeout(fail, 6500);
    script.addEventListener('error', fail, { once: true });
    if (!existing) {
      script.src = youtubeScript;
      script.async = true;
      document.head.append(script);
    }
  }).then(api => {
    if (!api) youtubeApi = undefined;
    return api;
  });
  return youtubeApi;
}

export function mountFilmPlayer(target, destination, { title, resumeAt = 0, onProgress, regional = false } = {}) {
  const controls = new AbortController();
  const { signal } = controls;
  const viewport = element('div', 'media-player film-player-viewport');
  const frame = element('iframe');
  frame.title = title;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  const status = element('p', 'media-player-status film-playback-status', `Opening the ${destination.provider} player…`);
  status.setAttribute('role', 'status');
  const progress = element('progress', 'film-loading');
  progress.setAttribute('aria-label', 'Loading film player');
  const actions = element('div', 'media-actions');
  const external = element('a', 'button primary', `Watch on ${destination.provider}`);
  external.href = destination.external;
  external.target = '_blank';
  external.rel = 'noopener noreferrer';
  actions.append(external);
  const fullscreen = element('button', 'button', 'Fullscreen');
  fullscreen.type = 'button';
  if (document.fullscreenEnabled && target.requestFullscreen) {
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === target) await document.exitFullscreen();
        else await target.requestFullscreen();
      } catch {
        status.textContent = 'Fullscreen is unavailable in this browser.';
      }
    }, { signal });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.textContent = document.fullscreenElement === target ? 'Exit fullscreen' : 'Fullscreen';
    }, { signal });
    actions.append(fullscreen);
  }

  let player;
  let polling;
  let playing = false;
  let answered = false;
  function report(message) {
    if (signal.aborted) return;
    clearTimeout(wait);
    progress.hidden = true;
    status.textContent = message;
  }

  function checkPosition(complete = false) {
    try {
      const seconds = player?.getCurrentTime?.();
      const duration = player?.getDuration?.();
      if (Number.isFinite(seconds) && seconds >= 0 && Number.isFinite(duration) && duration > 0) {
        onProgress?.({ seconds, duration, complete });
      }
    } catch {
      // A provider can revoke access or close the player during playback.
    }
  }

  function fail() {
    if (signal.aborted || answered) return;
    answered = true;
    playing = false;
    clearInterval(polling);
    frame.remove();
    viewport.hidden = true;
    fullscreen.hidden = true;
    report(`The ${destination.provider} player could not play this film here. Use the provider link to check availability.`);
  }

  const unconfirmed = regional
    ? `${destination.provider} availability varies by location. Use the provider link if playback is unavailable.`
    : `Playback could not be verified in the embedded ${destination.provider} player. Use the provider link if it stays blank.`;
  const wait = setTimeout(() => report(unconfirmed), 8500);
  frame.addEventListener('load', () => { if (!destination.id) report(unconfirmed); }, { signal, once: true });
  frame.addEventListener('error', fail, { signal, once: true });

  const src = new URL(destination.embed);
  if (destination.id) {
    src.searchParams.set('enablejsapi', '1');
    src.searchParams.set('playsinline', '1');
    src.searchParams.set('origin', window.location.origin);
    if (resumeAt >= 2) src.searchParams.set('start', String(Math.floor(resumeAt)));
  }
  frame.src = src.href;
  viewport.append(frame);
  target.replaceChildren(viewport, progress, status, actions);

  if (destination.id) readyYouTube().then(api => {
    if (signal.aborted || answered || !api || !frame.isConnected) return;
    player = new api.Player(frame, {
      events: {
        onReady() {
          if (signal.aborted || answered) return;
          report('YouTube player ready. Use its Play control to begin.');
        },
        onStateChange(event) {
          if (signal.aborted || answered) return;
          clearInterval(polling);
          if (event.data === 1) {
            playing = true;
            report('Playing on YouTube.');
            if (onProgress) {
              checkPosition();
              polling = setInterval(checkPosition, 5000);
            }
          } else if (event.data === 2 || event.data === 0) {
            if (playing || event.data === 0) checkPosition(event.data === 0);
            playing = false;
            report(event.data === 0 ? 'Playback ended.' : 'Playback paused.');
          }
        },
        onError: fail
      }
    });
  }).catch(() => {});

  return () => {
    if (signal.aborted) return;
    if (playing && onProgress) checkPosition();
    controls.abort();
    clearTimeout(wait);
    clearInterval(polling);
    try { player?.destroy(); } catch {}
    frame.remove();
    target.replaceChildren();
  };
}
