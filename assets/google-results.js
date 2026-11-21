const status = document.getElementById('google-status');
const params = new URLSearchParams(location.search);
const cx = params.get('cx');
const query = params.get('q')?.trim().slice(0, 200);

function renderResults(_name, _query, promotions, results, container) {
  const list = document.createElement('ul');
  list.className = 'web-search-results';
  for (const { url, titleNoFormatting, title, contentNoFormatting, content } of [...(promotions || []), ...(results || [])]) {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) continue;
    const item = document.createElement('li');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'button';
    open.textContent = String(titleNoFormatting || title || url).replace(/<[^>]*>/g, '').slice(0, 180);
    open.addEventListener('click', () => window.parent.postMessage({ type: 'arcade-google-destination', url }, '*'));
    item.append(open);
    const snippet = String(contentNoFormatting || content || '').replace(/<[^>]*>/g, '').slice(0, 360);
    if (snippet) {
      const summary = document.createElement('p');
      summary.textContent = snippet;
      item.append(summary);
    }
    list.append(item);
  }
  const empty = document.createElement('p');
  empty.textContent = 'Google returned no web results.';
  container.replaceChildren(list.childElementCount ? list : empty);
  return true;
}

if (window.parent === window || window.origin !== 'null') {
  status.textContent = 'Open Google results from the arcade search panel.';
} else if (!cx || !/^[A-Za-z0-9_-]{5,80}(?::[A-Za-z0-9_-]{1,40})?$/.test(cx) || !query) {
  status.textContent = 'A public Google Search Engine ID and query are required.';
} else {
  const timeout = setTimeout(() => {
    status.textContent = 'Google is taking longer than expected. Check the engine ID and your connection.';
  }, 10000);
  window.__gcse = {
    parsetags: 'explicit',
    searchCallbacks: { web: { ready: renderResults } },
    initializationCallback() {
      clearTimeout(timeout);
      try {
        const element = window.google.search.cse.element;
        element.render({
          div: 'google-results',
          tag: 'searchresults-only',
          gname: 'arcade-results',
          attributes: { autoSearchOnLoad: false, safeSearch: 'active' }
        });
        element.getElement('arcade-results').execute(query);
        status.hidden = true;
      } catch {
        status.textContent = 'Google could not start this search. Check the engine ID and try again.';
      }
    }
  };

  const script = document.createElement('script');
  const source = new URL('https://cse.google.com/cse.js');
  source.searchParams.set('cx', cx);
  script.src = source.href;
  script.async = true;
  script.addEventListener('error', () => {
    clearTimeout(timeout);
    status.textContent = 'Google Search could not load on this connection.';
  }, { once: true });
  document.head.append(script);
}
