import { validEngineId } from './search-google.js';

const status = document.getElementById('google-status');
const params = new URLSearchParams(location.search);
const cx = params.get('cx');
const query = params.get('q')?.trim().slice(0, 200);

if (!validEngineId(cx) || !query) {
  status.textContent = 'A public Google Search Engine ID and query are required.';
} else {
  const timeout = setTimeout(() => {
    status.textContent = 'Google is taking longer than expected. Check the engine ID and your connection.';
  }, 10000);
  window.__gcse = {
    parsetags: 'explicit',
    initializationCallback() {
      clearTimeout(timeout);
      try {
        const element = window.google.search.cse.element;
        element.render({
          div: 'google-results',
          tag: 'searchresults-only',
          gname: 'arcade-results',
          attributes: { autoSearchOnLoad: false, safeSearch: 'active', linkTarget: '_self' }
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
