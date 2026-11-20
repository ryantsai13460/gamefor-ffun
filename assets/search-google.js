const storageKey = 'ffun.google-engine';
const googleHome = 'https://www.google.com/';
const directRoutes = {
  web: { home: googleHome, search: new URL('search', googleHome).href },
  images: { home: new URL('imghp', googleHome).href, search: new URL('search', googleHome).href, options: { udm: '2' } },
  news: { home: 'https://news.google.com/', search: 'https://news.google.com/search' },
  shopping: { home: new URL('shopping', googleHome).href, search: new URL('search', googleHome).href, options: { tbm: 'shop' } }
};

export function validEngineId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{5,80}(?::[A-Za-z0-9_-]{1,40})?$/.test(value);
}

export function googleDestination(category, query = '') {
  if (!Object.hasOwn(directRoutes, category)) return '';
  const route = directRoutes[category];
  const text = query.trim();
  if (!text) return route.home;
  const url = new URL(route.search);
  url.search = new URLSearchParams({ q: text, ...route.options });
  return url.href;
}

export function renderGoogleSearch(target, onSearch) {
  const root = document.createElement('section');
  root.className = 'web-search-google';
  root.innerHTML = `
    <h2>Google</h2>
    <p class="muted">Search inside the arcade with your Programmable Search Engine, or open a category directly on Google.</p>
    <details>
      <summary>Google search setup</summary>
      <label>Public Search Engine ID <input class="field" name="engine" maxlength="121" autocomplete="off" spellcheck="false"></label>
      <a class="text-action" href="https://programmablesearchengine.google.com/controlpanel/all">Manage Google Search Engines</a>
    </details>
    <form action="https://www.google.com/search" role="search" aria-label="Google Search">
      <input type="search" name="q" class="field" placeholder="Search with Google" aria-label="Google query" required maxlength="200">
      <button type="submit" class="button primary">Search Google</button>
      <button type="submit" class="button" name="tbm" value="shop">Open Google Shopping</button>
    </form>
    <nav class="google-direct-links" aria-label="Open Google categories">
      <a class="button" data-category="web">Open Google Web</a>
      <a class="button" data-category="images">Open Google Images</a>
      <a class="button" data-category="news">Open Google News</a>
    </nav>
    <p class="muted" role="status">Google category links and Shopping open on Google in this tab.</p>
    <div class="web-search-google-results"></div>
  `;
  const engine = root.querySelector('[name="engine"]');
  const details = root.querySelector('details');
  const form = root.querySelector('form');
  const query = form.elements.q;
  const status = root.querySelector('[role="status"]');
  const results = root.querySelector('.web-search-google-results');
  const directLinks = [...root.querySelectorAll('[data-category]')];
  let editedEngine = false;
  try { engine.value = localStorage.getItem(storageKey) || ''; } catch {}
  details.open = !validEngineId(engine.value);

  function syncLinks() {
    for (const link of directLinks) link.href = googleDestination(link.dataset.category, query.value);
  }

  query.addEventListener('input', syncLinks);
  engine.addEventListener('input', () => {
    editedEngine = true;
    engine.removeAttribute('aria-invalid');
  });
  syncLinks();

  form.addEventListener('submit', event => {
    const text = query.value.trim();
    query.value = text;
    syncLinks();
    if (event.submitter?.value === 'shop' && text) {
      onSearch?.(text);
      return;
    }
    event.preventDefault();
    if (!text) return;
    if (!editedEngine) {
      try { engine.value = localStorage.getItem(storageKey) || engine.value; } catch {}
    }
    const id = engine.value.trim();
    if (!validEngineId(id)) {
      status.textContent = 'Enter a valid public Google Search Engine ID to search inside the arcade. The category links open on Google.';
      details.open = true;
      engine.setAttribute('aria-invalid', 'true');
      engine.focus();
      return;
    }
    engine.removeAttribute('aria-invalid');
    try { localStorage.setItem(storageKey, id); } catch {}
    onSearch?.(text);
    const url = new URL('./google-results.html', import.meta.url);
    url.search = new URLSearchParams({ cx: id, q: text });
    const frame = document.createElement('iframe');
    frame.title = 'Google results';
    frame.src = url.href;
    results.replaceChildren(frame);
    status.textContent = 'Searching with your configured engine. Google category links open directly on Google in this tab.';
  });

  target.append(root);
  return () => root.remove();
}
