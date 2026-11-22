# Optional arcade gateway

GitHub Pages serves the arcade. This separate Cloudflare Worker can connect blip.ai to Workers AI or OpenAI and send search queries to the Brave Search API and YouTube Data API. The arcade's built-in tools and local models can run without the gateway.

## No-download chat with Workers AI

The included `AI` binding uses IBM Granite 4.0 H Micro on Cloudflare. It streams generated replies without downloading model weights to the visitor's device or using an OpenAI API key. A Cloudflare account and a deployed Worker are required. On the Workers Free plan, Workers AI includes 10,000 neurons per day shared across the account. A neuron is Cloudflare's unit of inference usage. The Free plan stops serving inference after the daily allocation is used up. Stay on Workers Free to avoid paid overages. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Granite model](https://developers.cloudflare.com/workers-ai/models/granite-4.0-h-micro/)

Keep `CHAT_PROVIDER = "auto"` to use an existing OpenAI key when configured or Workers AI when there is no OpenAI key. Set `CHAT_PROVIDER = "workers-ai"` to select Workers AI regardless of existing keys. Set it to `"openai"` to require OpenAI. Each request uses only the selected provider.

After deploying and setting a gateway access code, open Blip, choose **Set up online chat**, enter the Worker URL and gateway access code, then opt into the connected model for chats without files. The access code and online-chat opt-in stay in the current tab. The backend URL can be remembered across visits. Attachments and chats containing them use the local path. Visitors do not need a Cloudflare or OpenAI account.

## Costs and access

Set up a provider account and check its pricing before creating or deploying a key. OpenAI API usage is billed by model and tokens. A ChatGPT subscription does not include API credits. Brave Search API pricing, included credits, and quotas depend on the account plan. Use the Cloudflare Workers Free plan for the optional gateway within its published allowance of 100,000 requests per day and 10 ms of CPU time per HTTP request. Time spent waiting for provider responses does not use CPU time. Provider charges can apply even on the Workers Free plan. [OpenAI API pricing](https://platform.openai.com/pricing/) · [Brave Search API plans](https://brave.com/search/api/) · [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)

Give the gateway a random access code of at least 24 characters and share it only with the people authorized to use the provider accounts. The Worker requires this code in its Authorization header. CORS restricts browser access to the exact origins listed in `ALLOWED_ORIGINS`. On GitHub Pages, projects under the same account share an origin.

The default Worker configuration uses approximate limits for requests that use providers. Each Cloudflare location applies six requests per minute per IP and 15 per minute across the site. The authenticated capabilities check reports configuration without consuming either rate limit or provider quota. Set provider project permissions and monitor usage separately to control costs. Chat accepts up to 16 messages and 12,000 characters of conversation text in a JSON body of up to 32 KiB. Replies are capped at 12,000 characters. Workers AI uses a 512-token output budget for Quick and up to 768 tokens for modes such as Think, Code, and Creative. Standard OpenAI replies retain the 700-token budget. The optional advanced replies default to 1,800 and can cost more. YouTube documents one unit per `search.list` call in the Search Queries bucket, with 100 daily calls by default. Check your project quota and restrict the server key to YouTube Data API v3. [Cloudflare rate-limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) · [YouTube search quota](https://developers.google.com/youtube/data/reference/rest/v3/search/list)

## Advanced replies

Advanced replies are available on OpenAI. They use expanded instructions and a higher output limit. They use the standard configured model unless you set `OPENAI_ADVANCED_MODEL` to a model that your OpenAI API project can access. Optionally set `OPENAI_ADVANCED_MAX_TOKENS` to an integer from 700 to 2,400. Check the selected model’s capabilities before setting `OPENAI_ADVANCED_REASONING_EFFORT` to `low`, `medium`, or `high`. Leave it unset for models that lack that option. Reasoning models can use part of the completion budget internally. [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat/create) · [OpenAI API pricing](https://platform.openai.com/pricing/)

Hosted chat sends the messages included in its request to the selected provider. Web search sends the query to Brave. The Worker sets OpenAI's `store` parameter to false and skips prompt and query logging. Provider terms and data policies still apply. Keep restricted or private material out of hosted requests.

Open **Blip Search** in the composer to enable research for the next reply. Enter a separate web lookup phrase for a detailed question, or leave it blank to search a question of up to 200 characters. Only the lookup phrase goes to Brave Search. The selected model receives the question, recent chat history, and up to four snippets. Research uses one search request and one model request when sources are available. Check the linked sources for details the excerpts may omit.

The capabilities check reports configured reply token caps. Use the provider dashboard for available account quota. The browser respects a retry delay returned by the gateway so users can preserve drafts while waiting. The site-wide gateway limit applies across connected features. A delay advertised for a provider error applies to the endpoint that returned it.

## Try locally

Node.js 20 or newer can run the fixture tests from the repository root.

```sh
node --test server/worker.test.js
```

For a real provider connection, copy `.dev.vars.example` to `.dev.vars` within this directory and supply a random access code plus any optional search or OpenAI keys you want to test. Wrangler uses your authorized Cloudflare account for actual Workers AI calls. The Node fixture tests need no provider accounts and consume no quota. Start the local Worker from this directory.

```sh
npx wrangler@4 dev
```

Set the arcade connection to the Worker origin printed by Wrangler. Include the local arcade origin in `.dev.vars` if you serve it on a different port.

Run `npx wrangler@4 deploy --dry-run --outdir .wrangler/build` to check the package before deployment. Keep generated bundles and secret files out of Git.

## Deploy when ready

The source does not deploy a Worker automatically. Review pricing and choose the Cloudflare account before running these commands from this directory. Set exact trusted origins in `wrangler.toml`. Keep credentials in Workers secrets.

```sh
npx wrangler@4 deploy
npx wrangler@4 secret put ACCESS_CODE
```

Workers AI needs the binding already listed in `wrangler.toml`. Use `npx wrangler@4 secret put OPENAI_API_KEY`, `BRAVE_SEARCH_API_KEY`, or `YOUTUBE_API_KEY` only for the optional APIs you intend to use. Endpoints without their required provider configuration return an unavailable status. Use two unique rate-limit namespace IDs if the same Cloudflare account has an existing Worker using these IDs. After deployment, enter the Worker origin and site access code in the arcade.

## Request and response format

The endpoints accept POST JSON and require `Authorization: Bearer <access code>`. The browser supplies the allowed Origin header.

- `/api/chat` accepts `messages`, each with a `role` of `user` or `assistant` and a string `content`. End with a user message. Optional `mode` accepts `quick`, `think`, `brainstorm`, `study`, `code`, `creative`, or `games`. Optional `depth` accepts `standard` or `advanced`, with standard used by default. Success returns `{"text":"…"}`. Set `stream: true` to receive SSE with text deltas under `choices[0].delta.content`. A complete stream ends with `data: [DONE]`. A token-limited reply includes an SSE `finish_reason: "length"` choice before completion, or `truncated: true` in the non-streamed JSON response. An interrupted stream ends with a JSON `error` event. Set `research: true` for Brave references. The lookup uses the latest question of at most 200 characters or an optional `researchQuery` of at most 200 characters. The response includes a `sources` array, as the first SSE event when streaming. Each source has a title, URL, and description. The Worker skips generation when no suitable sources are found.
- `/api/capabilities` accepts `{}` and reports the configured chat provider as `chatProvider` when available and configured features as booleans under `chat`, `advanced`, `research`, `search`, and `youtube`. It advertises `customResearchQuery: true` when research is configured and accepts a separate lookup phrase. It returns `standardOutputTokens` and `advancedOutputTokens` with the current caps, optional `maxStandardOutputTokens` for modes with larger budgets, and `modes` with the accepted chat modes. This check reports configuration without consuming provider quota. Actual requests verify provider access.
- `/api/search` accepts `{"q":"…"}` with up to 200 characters and an optional integer page `offset` from 0 to 9. Success returns `{"results":[{"title":"…","url":"https://…","description":"…"}]}` with up to eight results. It includes `nextOffset` when Brave reports more results and the offset cap allows another page. Each requested page uses one search request. Brave's strict search filter is enabled. [Brave Search API pagination](https://api-dashboard.search.brave.com/app/documentation/web-search#pagination)
- `/api/youtube` accepts `{"q":"…"}` with up to 200 characters. Success returns `{"items":[{"id":"…","title":"…","creator":"…","thumbnail":"…","embeddable":true}]}` with up to 12 results. The optional `nextPageToken` string can be passed as `pageToken` with the same query to fetch the next page. Each page uses a search request. The endpoint uses YouTube's strict safety, embedding, and syndication filters. Publishers can change playback permissions after search.

Errors before streaming use a non-success status and the JSON shape `{"error":"…"}`.
