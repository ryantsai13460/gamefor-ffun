export function mountPointerLock(canvas, { signal, canLock, onChange, onRotate, clearInput }) {
  const document = canvas.ownerDocument;
  const available = typeof canvas.requestPointerLock === 'function' && typeof document.exitPointerLock === 'function';
  let pending = false;
  let cancelled = false;
  let active = false;

  function report(reason = '') {
    canvas.dataset.shiftLock = active ? 'active' : 'off';
    onChange?.({ active, available, pending, reason });
  }

  function release() {
    cancelled ||= pending;
    pending = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    else if (active) {
      active = false;
      clearInput();
    }
    report();
  }

  function change() {
    const ownsLock = document.pointerLockElement === canvas;
    if (ownsLock && (cancelled || !canLock())) {
      cancelled = false;
      release();
      return;
    }
    if (active !== ownsLock) clearInput();
    active = ownsLock;
    cancelled = false;
    pending = false;
    report();
  }

  function fail() {
    if (!pending && !cancelled) return;
    const wasCancelled = cancelled;
    pending = cancelled = false;
    report(wasCancelled ? '' : 'Click inside the game or use the Shift Lock button to try again.');
  }

  function toggle() {
    if (!available) {
      report('This browser does not support locking the mouse here.');
      return false;
    }
    if (document.pointerLockElement === canvas || pending) {
      release();
      return false;
    }
    if (cancelled || !canLock()) return false;
    canvas.focus({ preventScroll: true });
    pending = true;
    report();
    try {
      const request = canvas.requestPointerLock();
      request?.catch(fail);
    } catch {
      fail();
    }
    return pending || active;
  }

  document.addEventListener('pointerlockchange', change, { signal });
  document.addEventListener('pointerlockerror', fail, { signal });
  document.addEventListener('mousemove', event => {
    if (active && document.pointerLockElement === canvas) onRotate(event.movementX, event.movementY);
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.code !== 'Escape' || !active && !pending) return;
    event.preventDefault();
    release();
  }, { signal });
  queueMicrotask(() => { if (!signal.aborted) report(); });
  return { get active() { return active; }, get pending() { return pending; }, toggle, release };
}
