# WebLLM 0.2.89

`index.js` is the browser ESM distribution from the public `@mlc-ai/web-llm@0.2.89` npm package. The local copy omits the source-map reference. The adjacent `LICENSE` is from that package.

Package integrity is `sha512-DfWwDED9Lrdh3IspBvDiJypGqQ4KVrjz1FYNQc9fqNOyetpk8QvWj75mld8aEaGGWfU1/83yNZw5vFI6599Fxg==`.

Blip downloads the pinned MLC build of the Apache-2.0 SmolLM2-360M-Instruct model when the user enables it. The first setup transfers approximately 220 MB including the runtime, weights, tokenizer, and WebGPU binary. Browser storage can cache these files for later visits.

- [WebLLM release](https://github.com/mlc-ai/web-llm/tree/v0.2.89)
- [Pinned MLC model weights](https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f32_1-MLC/tree/1e6b2ca3684e2bc8a6d39eb36e8d6cd51eb12bda)
- [Base model and licensing](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct)
