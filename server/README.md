# Optional arcade gateway

GitHub Pages serves the arcade. This separate Cloudflare Worker can connect blip.ai to OpenAI and send search queries to the Brave Search API and YouTube Data API. The arcade's built-in tools and local models can run without the gateway.

## Costs and access

Set up a provider account and check its pricing before creating or deploying a key. OpenAI API usage is billed by model and tokens. A ChatGPT subscription does not include API credits. Brave Search API pricing, included credits, and quotas depend on the account plan. Cloudflare Workers has a Free plan with its own request and CPU limits. Provider charges can apply even on the Workers Free plan. [OpenAI API pricing](https://platform.openai.com/pricing/) · [Brave Search API plans](https://brave.com/search/api/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

Give the gateway a random access code of at least 24 characters and share it only with the people authorized to use the provider accounts. The Worker requires this code in its Authorization header. CORS restricts browser access to the exact origins listed in `ALLOWED_ORIGINS`. On GitHub Pages, projects under the same account share an origin.

The default Worker configuration limits its endpoints together to six requests per minute per IP and 15 requests per minute across the site at each Cloudflare location. These are per-location rate limits. Set provider project permissions and monitor usage separately to control costs. Chat accepts up to 16 messages and 12,000 characters of conversation text per request, and caps completion at 700 tokens. YouTube documents one unit per `search.list` call in the Search Queries bucket, with 100 daily calls by default. Check your project quota and restrict the server key to YouTube Data API v3. [Cloudflare rate-limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) · [YouTube search quota](https://developers.google.com/youtube/data/reference/rest/v3/search/list)

Hosted chat sends the messages included in its request to OpenAI. Web search sends the query to Brave. The Worker sets OpenAI's `store` parameter to false and skips prompt and query logging. Provider terms and data policies still apply. Keep restricted or private material out of hosted requests.

Opt-in research sends only the latest question to Brave Search and supplies up to four returned snippets to OpenAI as reference material. A research turn uses one search request and one model request when sources are available. Chat history goes to OpenAI when hosted chat is enabled. Web excerpts can be incomplete and should be checked against the linked sources.

## Try locally

Node.js 20 or newer can run the fixture tests from the repository root.

```sh
node --test server/worker.test.js
```

For a real provider connection, copy `.dev.vars.example` to `.dev.vars` within this directory and supply a random access code plus a key for each API you want to test. Start the local Worker from this directory.

```sh
npx wrangler@4 dev
```

Set the arcade connection to the Worker origin printed by Wrangler. Include the local arcade origin in `.dev.vars` if you serve it on a different port.

## Deploy when ready

The source does not deploy a Worker automatically. Review pricing and choose the Cloudflare account before running these commands from this directory. Set exact trusted origins in `wrangler.toml`. Keep credentials in Workers secrets.

```sh
npx wrangler@4 deploy
npx wrangler@4 secret put ACCESS_CODE
npx wrangler@4 secret put OPENAI_API_KEY
npx wrangler@4 secret put BRAVE_SEARCH_API_KEY
npx wrangler@4 secret put YOUTUBE_API_KEY
```

Configure only the provider keys you intend to use. An endpoint without its relevant key returns an unavailable status. Use two unique rate-limit namespace IDs if the same Cloudflare account has an existing Worker using these IDs. After deployment, enter the Worker origin and site access code in the arcade.

## Request and response format

The endpoints accept POST JSON and require `Authorization: Bearer <access code>`. The browser supplies the allowed Origin header.

- `/api/chat` accepts `messages`, each with a `role` of `user` or `assistant` and a string `content`. End with a user message. Optional `mode` accepts `quick`, `think`, `brainstorm`, or `study`. Success returns `{"text":"…"}`. Set `stream: true` to receive SSE with text deltas under `choices[0].delta.content`. A complete stream ends with `data: [DONE]`. An interrupted stream ends with a JSON `error` event. Set `research: true` for a latest question up to 200 characters to use the Brave references. The response includes a `sources` array, as the first SSE event when streaming. Each source has a title, URL, and description. The Worker skips generation when no suitable sources are found.
- `/api/search` accepts `{"q":"…"}` with up to 200 characters. Success returns `{"results":[{"title":"…","url":"https://…","description":"…"}]}` with up to eight results. Brave's strict search filter is enabled.
- `/api/youtube` accepts `{"q":"…"}` with up to 200 characters. Success returns `{"items":[{"id":"…","title":"…","creator":"…","thumbnail":"…","embeddable":true}]}` with up to 12 results. It uses YouTube's strict safety, embedding, and syndication filters. Publishers can change playback permissions after search.

Errors before streaming use a non-success status and the JSON shape `{"error":"…"}`.
