export function createSearchFullscreen(target, { label = 'Search' } = {}) {
  const document = target.ownerDocument;
  const controls = document.createElement('div');
  controls.className = 'search-fullscreen-controls';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button search-fullscreen-button';
  const status = document.createElement('p');
  status.className = 'search-fullscreen-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  controls.append(button, status);

  const scope = new AbortController();
  let disposed = false;
  let pending = false;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function supported() {
    return document.fullscreenEnabled === true &&
      typeof target.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function';
  }

  function sync() {
    const expanded = document.fullscreenElement === target;
    button.textContent = expanded ? 'Exit fullscreen' : 'Fullscreen';
    button.title = expanded ? 'Exit fullscreen' : `Open ${label} in fullscreen`;
    button.disabled = pending || (!expanded && !supported());
  }

  function exitOnCleanup() {
    if (document.fullscreenElement === target) {
      void document.exitFullscreen().catch(() => {});
    }
  }

  button.addEventListener('click', async () => {
    if (disposed || pending || button.disabled) return;

    const expanded = document.fullscreenElement === target;
    pending = true;
    showStatus('');
    sync();

    try {
      if (expanded) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      if (!disposed) {
        showStatus(expanded
          ? 'Fullscreen could not close. Use your browser’s fullscreen exit control.'
          : 'Fullscreen is unavailable here. You can continue in the normal view.');
      }
    } finally {
      pending = false;
      if (disposed) {
        exitOnCleanup();
      } else {
        sync();
        if (button.isConnected) button.focus({ preventScroll: true });
      }
    }
  }, { signal: scope.signal });

  document.addEventListener('fullscreenchange', sync, { signal: scope.signal });
  if (!supported()) showStatus('Fullscreen is unavailable on this device.');
  sync();

  return {
    button,
    status,
    controls,
    dispose() {
      if (disposed) return;
      disposed = true;
      scope.abort();
      if (!pending) exitOnCleanup();
    },
  };
}
