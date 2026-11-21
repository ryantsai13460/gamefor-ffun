# Wllama 2.3.7

`index.js` and `wllama.wasm` are the unmodified browser ESM and single-thread WebAssembly distributions from `@wllama/wllama@2.3.7`. The adjacent license files cover Wllama and its pinned llama.cpp dependency.

Package integrity is `sha512-T273gBEqEZCHAoyNZDg+X6boQWktaq+efNF6bJo5aHToJr7jS1kCYImKXDdBi2/CccRuBUcMBHHLHiQN4+OfKQ==`.

The CPU option downloads about 108 MB on first setup, including the runtime and the pinned SmolLM2-135M-Instruct Q4_K_M GGUF. Blip verifies the model SHA-256 before loading it and caches the verified bytes when browser storage is available. Generation runs in a single-thread worker and needs no cross-origin isolation headers or GPU.

- [Pinned Wllama source](https://github.com/ngxson/wllama/tree/5e17fb070911688c10403b433499d64b03060400)
- [Pinned llama.cpp source](https://github.com/ggml-org/llama.cpp/tree/4abef75f2cf2eee75eb5083b30a94cf981587394)
- [Pinned GGUF and Apache-2.0 licensing](https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/tree/09816acd5d99df7be770d85ea30822623dab342c)
- [Base model](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct)
