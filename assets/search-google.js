const assetVersion = new URL(import.meta.url).search;
const { essayGuideQuery, renderEssayGuide } = await import(`./search-essay.js${assetVersion}`);
const storageKey = 'ffun.google-engine';

function validEngineId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{5,80}(?::[A-Za-z0-9_-]{1,40})?$/.test(value);
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
  try { engine.value = localStorage.getItem(storageKey) || ''; } catch {}

  function updateActions() {
    const text = query.value.trim();
    clear.disabled = !query.value && !essayActive && !results.firstChild && !status.textContent;
    googleLink.hidden = !text;
    if (text) {
      const url = new URL('https://www.google.com/search');
      url.searchParams.set('q', text);
      googleLink.href = url.href;
    } else {
      googleLink.removeAttribute('href');
    }
  }

  query.addEventListener('input', updateActions);
  clear.addEventListener('click', () => {
    query.value = '';
    disposeGuide?.();
    disposeGuide = undefined;
    essayActive = undefined;
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
    results.replaceChildren();
    if (!google) {
      status.textContent = '';
      if (essay) onQuery(essay);
      else onArcadeSearch(text);
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
    url.search = new URLSearchParams({ cx: id, q: normalized });
    const frame = document.createElement('iframe');
    frame.title = 'Google results';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.addEventListener('load', () => {
      if (results.contains(frame)) status.textContent = 'The configured Google engine opens below. You can also open this search on Google.';
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
    disposeGuide?.();
    root.remove();
  };
}
