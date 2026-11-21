import { MLCEngine } from './vendor/webllm-0.2.89/index.js';

const modelId = 'SmolLM2-360M-Instruct-q4f32_1-MLC';
const model = {
  model_id: modelId,
  model: 'https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f32_1-MLC/resolve/1e6b2ca3684e2bc8a6d39eb36e8d6cd51eb12bda/',
  model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/5b7251f3bdce957be2a7bf73a6f6c560d9874df4/web-llm-models/v0_2_87/base/SmolLM2-360M-Instruct-q4f32_1_cs1k-webgpu.wasm',
  overrides: { context_window_size: 4096 }
};

let engine;
let generating;

self.addEventListener('message', async ({ data: { action, id, input } }) => {
  try {
    if (action === 'prepare') {
      let reported = 0;
      engine = new MLCEngine({
        appConfig: { model_list: [model], cacheBackend: 'cache' },
        logLevel: 'ERROR',
        initProgressCallback(report) {
          const progress = Number.isFinite(report.progress) ? Math.max(0, Math.min(1, report.progress)) : 0;
          const finished = report.text?.startsWith('Finish loading');
          const shaders = report.text?.startsWith('Loading GPU');
          const cached = report.text?.startsWith('Loading model from cache');
          const description = finished ? 'Local AI ready' : shaders ? 'Preparing the GPU' : cached ? 'Loading model into memory' : 'Downloading local AI';
          const fraction = finished ? 1 : shaders ? .8 + progress * .19 : progress * .8;
          reported = Math.max(reported, fraction);
          self.postMessage({ id, kind: 'progress', fraction: reported, description });
        }
      });
      await engine.reload(modelId);
      self.postMessage({ id, kind: 'result' });
    } else if (action === 'generate') {
      generating = id;
      try {
        const response = await engine.chat.completions.create({
          model: modelId,
          messages: input.messages,
          max_tokens: input.mode === 'quick' ? 180 : 320,
          temperature: input.mode === 'brainstorm' ? .8 : .4,
          stream: false
        });
        const content = response.choices[0]?.message?.content;
        self.postMessage({ id, kind: 'result', answer: typeof content === 'string' ? content.trim() : '' });
      } finally {
        generating = undefined;
      }
    } else if (action === 'interrupt' && generating === id) {
      engine.interruptGenerate();
    }
  } catch (error) {
    self.postMessage({ id, kind: 'error', message: error?.message || 'The portable model stopped.' });
  }
});
