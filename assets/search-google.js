const storageKey = 'ffun.google-engine';

export function validEngineId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{5,80}(?::[A-Za-z0-9_-]{1,40})?$/.test(value);
}

export function renderGoogleSearch(target) {
  const root = document.createElement('section');
  root.className = 'web-search-google';
  root.innerHTML = `
    <h2>Google</h2>
    <p class="muted">Use Google results from a configured Programmable Search Engine.</p>
    <details>
      <summary>Google search setup</summary>
      <label>Public Search Engine ID <input class="field" name="engine" maxlength="121" autocomplete="off"></label>
      <a class="text-action" href="https://programmablesearchengine.google.com/controlpanel/all">Manage Google Search Engines</a>
    </details>
    <form action="https://www.google.com/search" role="search" aria-label="Google Search">
      <input type="search" name="q" class="field" placeholder="Search with Google" aria-label="Google query" required maxlength="200">
      <button type="submit" class="button primary">Search Google</button>
      <button type="submit" class="button" name="tbm" value="shop">Open Google Shopping</button>
    </form>
    <p class="muted" role="status">Shopping opens on Google in this tab.</p>
    <div class="web-search-google-results"></div>
  `;
  const engine = root.querySelector('[name="engine"]');
  const details = root.querySelector('details');
  const form = root.querySelector('form');
  const query = form.elements.q;
  const status = root.querySelector('[role="status"]');
  const results = root.querySelector('.web-search-google-results');
  try { engine.value = localStorage.getItem(storageKey) || ''; } catch {}
  details.open = !validEngineId(engine.value);

  form.addEventListener('submit', event => {
    const text = query.value.trim();
    query.value = text;
    if (event.submitter?.value === 'shop' && text) return;
    event.preventDefault();
    if (!text) return;
    const id = engine.value.trim();
    if (!validEngineId(id)) {
      status.textContent = 'Enter a valid public Google Search Engine ID to search inside the arcade.';
      details.open = true;
      engine.focus();
      return;
    }
    try { localStorage.setItem(storageKey, id); } catch {}
    const url = new URL('./google-results.html', import.meta.url);
    url.search = new URLSearchParams({ cx: id, q: text });
    const frame = document.createElement('iframe');
    frame.title = 'Google results';
    frame.src = url.href;
    results.replaceChildren(frame);
    status.textContent = 'Results come from your configured Google Search Engine. Shopping opens on Google in this tab.';
  });

  target.append(root);
}
