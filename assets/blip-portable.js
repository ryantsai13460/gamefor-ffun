let runner;
let preparing;
let revision = 0;
const replyTimeout = 80_000;

async function supportsPortableModel() {
  const gpu = globalThis.navigator?.gpu;
  if (typeof Worker !== 'function' || typeof gpu?.requestAdapter !== 'function') return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

export async function portableBlipAvailability() {
  if (runner?.ready) return 'available';
  if (preparing) return 'downloading';
  return await supportsPortableModel() ? 'downloadable' : 'unavailable';
}

export function portableBlipReady() {
  return Boolean(runner?.ready);
}

function createRunner(worker) {
  const requests = new Map();
  const state = { ready: false, queue: Promise.resolve(), request, close };
  let latest = 0;
  let closed = false;

  function close(reason = new DOMException('Portable model stopped.', 'AbortError')) {
    if (closed) return;
    closed = true;
    state.ready = false;
    worker.terminate();
    for (const callback of requests.values()) callback.finish(reason);
  }

  worker.addEventListener('error', event => {
    event.preventDefault();
    close(new Error('The portable model worker stopped.'));
  });

  worker.addEventListener('message', ({ data }) => {
    const callback = requests.get(data?.id);
    if (!callback) return;
    if (data.kind === 'progress') {
      callback.onProgress?.(data.fraction, data.description);
    } else if (data.kind === 'delta') {
      callback.onUpdate?.(data.answer);
    } else if (data.kind === 'result') {
      callback.onFinish?.(data.truncated === true);
      callback.finish(undefined, data.answer);
    } else if (data.kind === 'error') {
      callback.finish(new Error(data.message));
    }
  });

  function request(action, input, signal, { onProgress, onUpdate, onFinish } = {}) {
    signal?.throwIfAborted();
    if (closed) return Promise.reject(new Error('The portable model is closed.'));
    const id = ++latest;
    return new Promise((resolve, reject) => {
      let interruptTimer;
      const stop = () => {
        if (action === 'prepare') {
          close(signal.reason);
        } else {
          worker.postMessage({ action: 'interrupt', id });
          interruptTimer = setTimeout(() => close(signal.reason), 5_000);
        }
      };
      const finish = (error, value) => {
        requests.delete(id);
        clearTimeout(interruptTimer);
        signal?.removeEventListener('abort', stop);
        if (signal?.aborted) reject(signal.reason);
        else if (error) reject(error);
        else resolve(value);
      };
      requests.set(id, { finish, onProgress, onUpdate, onFinish });
      signal?.addEventListener('abort', stop, { once: true });
      try {
        worker.postMessage({ action, id, input });
      } catch (error) {
        finish(error);
      }
    });
  }

  return state;
}

export function preparePortableBlipModel(signal, onProgress) {
  signal?.throwIfAborted();
  if (runner?.ready) return Promise.resolve();
  if (preparing) return preparing;
  const generation = revision;
  const setup = (async () => {
    const supported = await supportsPortableModel();
    signal?.throwIfAborted();
    if (generation !== revision) throw new DOMException('Portable model stopped.', 'AbortError');
    if (!supported) throw new Error('An available WebGPU adapter is required.');

    runner?.close();
    const workerUrl = new URL('./blip-model-worker.js', import.meta.url);
    workerUrl.search = new URL(import.meta.url).search;
    const worker = new Worker(workerUrl, { type: 'module' });
    const next = createRunner(worker);
    runner = next;
    try {
      await next.request('prepare', undefined, signal, { onProgress });
      next.ready = true;
    } catch (error) {
      next.close();
      if (runner === next) runner = undefined;
      throw error;
    }
  })();
  preparing = setup;
  return setup.finally(() => {
    if (preparing === setup) preparing = undefined;
  });
}

export function releasePortableBlipModel() {
  revision++;
  preparing = undefined;
  runner?.close();
  runner = undefined;
}

export function runPortableBlipPrompt(messages, mode, signal, onUpdate, onFinish) {
  signal?.throwIfAborted();
  if (!runner?.ready) return Promise.resolve('');
  const current = runner;
  // WebLLM's interrupt control applies to its active generation, so serialize requests.
  const answer = current.queue.then(async () => {
    const deadline = AbortSignal.timeout(replyTimeout);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      return await current.request('generate', { messages, mode }, requestSignal, {
        onUpdate(value) { if (!requestSignal.aborted) onUpdate?.(value); },
        onFinish(value) { if (!requestSignal.aborted) onFinish?.(value); },
      });
    } catch (error) {
      if (deadline.aborted) current.close(error);
      throw error;
    }
  });
  current.queue = answer.catch(() => {});
  return answer;
}
