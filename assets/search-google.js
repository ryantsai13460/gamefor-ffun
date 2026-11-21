import { createGameAddressLookup, isGamePortalAddress } from './game-play-policy.js';
import { normalize } from './library.js';

const assetVersion = new URL(import.meta.url).search;
const [{ essayGuideQuery, renderEssayGuide }, { games }] = await Promise.all([
  import(`./search-essay.js${assetVersion}`), import(`./catalog.js${assetVersion}`),
]);
const storageKey = 'ffun.google-engine';
const byAddress = createGameAddressLookup(games);
const byTitle = new Map(games.map(game => [normalize(game.title), game]));
const portalName = /^(?:(?:play|open|visit) )?(?:cool ?math(?: ?games)?|miniplay|minijuegos(?: ?gratis)?|poki|crazy ?games)$/;
const portalSuffix = / (?:on )?(?:cool ?math(?: ?games)?|miniplay|minijuegos(?: ?gratis)?|poki|crazy ?games)$/;
const portalPrefix = /^(?:cool ?math(?: ?games)?|miniplay|minijuegos(?: ?gratis)?|poki|crazy ?games) /;

function validEngineId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{5,80}(?::[A-Za-z0-9_-]{1,40})?$/.test(value);
}

function gameSearch(query) {
  const address = /^(?:https?:\/\/)?[^\s/]+\.[^\s/]+(?:\/\S*)?$/i.test(query)
    ? query.replace(/^(?:site:)?(?!(?:https?):\/\/)/i, 'https://') : '';
  const title = normalize(query);
  const named = title.replace(portalPrefix, '').replace(/^(?:play|open) /, '')
    .replace(portalSuffix, '').replace(/ (?:online|for free|free online)$/, '');
  return byTitle.get(title) || byTitle.get(named) || byAddress(address) || isGamePortalAddress(address) || portalName.test(title);
}

function googleDestination(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    let url = new URL(value);
    if (['www.google.com', 'google.com'].includes(url.hostname) && url.pathname === '/url') {
      url = new URL(url.searchParams.get('url') || url.searchParams.get('q'));
    }
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function renderGoogleSearch(target, { onArcadeSearch, onQuery, initialQuery = '' }) {
  const root = document.createElement('section');
  root.className = 'web-search-google';
  root.innerHTML = `
    <h2>Google and arcade search</h2>
    <p class="muted">Search games, references, and YouTube here. A configured Google engine can also show results inside this tab.</p>
    <form role="search" aria-label="Google Search">
      <input type="search" name="q" class="field" placeholder="Search a game or topic" aria-label="Google query" required maxlength="200">
      <button type="submit" class="button primary">Search</button>
      <button type="submit" class="button" value="google">Use Google engine</button>
      <button type="button" class="button" data-clear disabled>Clear search</button>
    </form>
    <div class="interaction-row">
      <a class="button" href="#games?option=in-page">Games you can play here</a>
      <a class="button" data-google-link target="_blank" rel="noopener noreferrer" hidden>Open Google in new tab</a>
    </div>
    <details>
      <summary>Optional Google Search Engine</summary>
      <label>Public Search Engine ID <input class="field" name="engine" maxlength="121" autocomplete="off" spellcheck="false"></label>
    </details>
    <p class="muted" role="status"></p>
    <div class="web-search-google-guide"></div>
    <div class="web-search-google-results"></div>
  `;
  const engine = root.querySelector('[name="engine"]');
  const details = root.querySelector('details');
  const form = root.querySelector('form');
  const query = form.elements.q;
  const clear = form.querySelector('[data-clear]');
  const googleLink = root.querySelector('[data-google-link]');
  const status = root.querySelector('[role="status"]');
  const guide = root.querySelector('.web-search-google-guide');
  const results = root.querySelector('.web-search-google-results');
  let editedEngine = false;
  let essayActive;
  let disposeGuide;
  let resultFrame;
  try { engine.value = localStorage.getItem(storageKey) || ''; } catch {}

  function updateActions() {
    const text = query.value.trim();
    clear.disabled = !query.value && !essayActive && !results.firstChild && !status.textContent;
    googleLink.hidden = !text || Boolean(gameSearch(text));
    if (!googleLink.hidden) {
      const url = new URL('https://www.google.com/search');
      url.searchParams.set('q', text);
      googleLink.href = url.href;
    } else {
      googleLink.removeAttribute('href');
    }
  }

  function followResult(event) {
    if (!resultFrame || event.source !== resultFrame.contentWindow || event.origin !== 'null' ||
        event.data?.type !== 'arcade-google-destination') return;
    const destination = googleDestination(event.data.url);
    if (!destination) {
      status.textContent = 'This search result has no supported web address.';
      return;
    }
    const game = byAddress(destination);
    if (game) {
      location.hash = '#play/' + encodeURIComponent(game.id);
    } else if (isGamePortalAddress(destination)) {
      status.textContent = 'This result points to a game portal. Browse the in-page games to play here.';
    } else {
      location.hash = '#browse?' + new URLSearchParams({ address: destination.href });
    }
  }
  window.addEventListener('message', followResult);

  query.addEventListener('input', updateActions);
  clear.addEventListener('click', () => {
    query.value = '';
    disposeGuide?.();
    disposeGuide = undefined;
    essayActive = undefined;
    resultFrame = undefined;
    results.replaceChildren();
    status.textContent = '';
    engine.removeAttribute('aria-invalid');
    onQuery('');
    updateActions();
    query.focus();
  });

  engine.addEventListener('input', () => {
    editedEngine = true;
    engine.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = query.value.trim();
    if (!text) return;
    const essay = essayGuideQuery(text);
    if (essayActive !== essay) {
      disposeGuide?.();
      disposeGuide = essay ? renderEssayGuide(guide, essay) : undefined;
      essayActive = essay;
    }
    if (essay) query.value = essay;
    updateActions();
    const google = event.submitter?.value === 'google';
    resultFrame = undefined;
    results.replaceChildren();
    if (!google) {
      status.textContent = '';
      if (essay) onQuery(essay);
      else onArcadeSearch(text);
      return;
    }
    const local = gameSearch(text);
    if (local) {
      if (local === true) status.textContent = 'Browse the in-page games to play here.';
      else onArcadeSearch(local.title);
      return;
    }
    if (!editedEngine) {
      try { engine.value = localStorage.getItem(storageKey) || engine.value; } catch {}
    }
    const id = engine.value.trim();
    if (!validEngineId(id)) {
      status.textContent = 'Enter a valid public Google Search Engine ID to use Google results here.';
      details.open = true;
      engine.setAttribute('aria-invalid', 'true');
      engine.focus();
      return;
    }
    engine.removeAttribute('aria-invalid');
    try { localStorage.setItem(storageKey, id); } catch {}
    const normalized = essay || text;
    onQuery(normalized);
    const url = new URL('./google-results.html', import.meta.url);
    url.search = assetVersion;
    url.searchParams.set('cx', id);
    url.searchParams.set('q', normalized);
    const frame = document.createElement('iframe');
    resultFrame = frame;
    frame.title = 'Google results';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.addEventListener('load', () => {
      if (results.contains(frame)) status.textContent = 'Google results open below.';
    });
    frame.addEventListener('error', () => {
      if (results.contains(frame)) status.textContent = 'The Google engine panel did not load. Open this search on Google or try again.';
    }, { once: true });
    frame.src = url.href;
    results.replaceChildren(frame);
    status.textContent = 'Searching with your configured Google engine…';
  });

  target.append(root);
  if (initialQuery) {
    query.value = initialQuery.slice(0, query.maxLength);
    queueMicrotask(() => { if (root.isConnected) form.requestSubmit(); });
  }
  return () => {
    window.removeEventListener('message', followResult);
    disposeGuide?.();
    root.remove();
  };
}
