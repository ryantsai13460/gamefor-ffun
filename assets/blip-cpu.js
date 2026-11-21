const weights = 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/7be6f65f1db715fe5dc5a4634c0d459b4eed42ec/SmolLM2-360M-Instruct-Q4_K_M.gguf';
const weightSize = 270_590_880;
const weightHash = '2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2';
const cacheName = 'ffun-blip-cpu-model-v2';
const shaHeader = 'x-blip-sha256';
let current;

function supported() {
  return globalThis.isSecureContext === true && typeof Worker === 'function'
    && typeof globalThis.WebAssembly?.validate === 'function'
    && typeof globalThis.crypto?.subtle?.digest === 'function';
}

export async function cpuBlipAvailability() {
  if (current) return current.ready ? 'available' : 'downloading';
  return supported() ? 'downloadable' : 'unavailable';
}

export function cpuBlipReady() {
  return Boolean(current?.ready);
}

async function loadWeights(signal, progress) {
  const cache = await globalThis.caches?.open(cacheName).catch(() => undefined);
  const cached = await cache?.match(weights).catch(() => undefined);
  signal.throwIfAborted();
  if (cached?.headers.get(shaHeader) === weightHash) {
    const blob = await cached.blob();
    if (blob.size === weightSize) return blob;
  }

  const response = await fetch(weights, { credentials: 'omit', signal });
  if (!response.ok || !response.body) throw new Error('Could not download the CPU model.');
  const bytes = new Uint8Array(weightSize);
  const reader = response.body.getReader();
  let copied = 0;
  let reported = -1;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (copied + value.length > bytes.length) throw new Error('Unexpected CPU model file size.');
      bytes.set(value, copied);
      copied += value.length;
      const percent = Math.floor(copied / weightSize * 90);
      if (percent > reported) {
        reported = percent;
        progress?.(percent / 100, 'Downloading CPU AI');
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  signal.throwIfAborted();
  if (copied !== weightSize) throw new Error('Incomplete CPU model download.');
  progress?.(.92, 'Verifying the CPU model');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  signal.throwIfAborted();
  if (hash !== weightHash) throw new Error('The CPU model download failed verification.');
  const blob = new Blob([bytes]);
  await cache?.put(weights, new Response(blob, { headers: { [shaHeader]: weightHash } })).catch(() => {});
  return blob;
}

async function closeEngine(state) {
  const engine = state.engine;
  state.engine = undefined;
  await engine?.exit().catch(() => {});
}

export function prepareCpuBlipModel(signal, onProgress) {
  signal?.throwIfAborted();
  if (current) return current.initialization;
  if (!supported()) return Promise.reject(new Error('The CPU model needs browser WebAssembly and worker support.'));
  const state = { controller: new AbortController(), queue: Promise.resolve(), ready: false };
  current = state;
  const lifetime = signal ? AbortSignal.any([state.controller.signal, signal]) : state.controller.signal;
  state.initialization = (async () => {
    try {
      onProgress?.(0, 'Preparing the CPU model');
      const { Wllama } = await import('./vendor/wllama-2.3.7/index.js');
      lifetime.throwIfAborted();
      const model = await loadWeights(lifetime, onProgress);
      lifetime.throwIfAborted();
      onProgress?.(.96, 'Loading the CPU model');
      const wasm = new URL('./vendor/wllama-2.3.7/wllama.wasm', import.meta.url);
      state.engine = new Wllama({ 'single-thread/wllama.wasm': wasm.href }, { suppressNativeLog: true });
      await state.engine.loadModel([model], { n_threads: 1, n_ctx: 4_096, n_batch: 128 });
      lifetime.throwIfAborted();
      state.ready = true;
      onProgress?.(1, 'CPU AI ready');
    } catch (error) {
      if (current === state) current = undefined;
      await closeEngine(state);
      throw error;
    }
  })();
  return state.initialization;
}

export function releaseCpuBlipModel() {
  const state = current;
  if (!state) return;
  current = undefined;
  state.controller.abort();
  void state.initialization.catch(() => {}).then(() => state.queue).then(() => closeEngine(state));
}

export function runCpuBlipPrompt(messages, mode, signal, onUpdate) {
  signal?.throwIfAborted();
  const state = current;
  if (!state?.ready) return Promise.resolve('');
  const abortSignal = signal ? AbortSignal.any([state.controller.signal, signal]) : state.controller.signal;
  const answer = state.queue.then(async () => {
    abortSignal.throwIfAborted();
    const result = await state.engine.createChatCompletion(messages, {
      stream: false,
      useCache: true,
      nPredict: mode === 'quick' ? 120 : 220,
      sampling: {
        temp: ['brainstorm', 'creative'].includes(mode) ? .72 : .3,
        penalty_last_n: 64,
        penalty_repeat: 1.1
      },
      abortSignal,
      onNewToken: onUpdate ? (_token, _piece, value) => {
        if (!abortSignal.aborted) onUpdate(value.trimStart());
      } : undefined
    });
    abortSignal.throwIfAborted();
    return typeof result === 'string' ? result.trim() : '';
  });
  state.queue = answer.catch(() => {});
  return answer;
}
