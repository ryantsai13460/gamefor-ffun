# Gamefor Ffun upgrade

## Implementation plan

1. Preserve the published site while developing on `dev/platform-upgrade`.
2. Audit catalog counts, exact game destinations, and player failure states. Preserve the local and publisher-authorized players.
3. Verify browser-local AI generation and provide an optional server-side provider with protected credentials and request limits.
4. Expand Music and YouTube discovery with official videos, incremental loading, and local listening history or favorites.
5. Connect game pages, search results, and Proxy Gemini, then test navigation, failure handling, and mobile layouts.

## Review and deployment

From the development branch, run `npm ci`, then `npm run dev`. The preview serves the arcade at [http://localhost:3000](http://localhost:3000).

The existing GitHub Pages workflow serves the root of `main`. Review this branch before merging. The Music entry and its catalog share the version query on the app entry in `index.html`. Update that version when publishing later Music or Blip changes.

Blip can run an available browser model, a downloadable CPU model, or the existing optional WebGPU model. For hosted text chat and broad web search, deploy the optional gateway and connect it through the site settings. The gateway setup documents credentials, access controls, provider charges, and rate limits. [Gateway setup](../server/README.md)

## Validation scope

Passed 10 arcade unit tests, nine gateway fixture tests, and 28 Chromium tests. The separate CPU inference test completed a real response.

| Feature | Coverage |
| --- | --- |
| Games | The catalog has 556 distinct records, including all 548 recovered games. All 18 built-in entries have player tests. The two Fancade embeds use the publisher's documented route. A fresh sample of 123 game routes returned HTTP 200. Other third-party games expose their verified publisher or distributor pages. |
| Media | Video and music discovery use official YouTube uploads. Chromium uses controlled provider responses to test player loading, fallback links, Shorts, search, sorting by collections, Music saves, and scrolling controls. Provider availability and embedded playback vary by title and region. |
| Blip.AI | Chromium generated “The sky on a clear day is a deep, deep blue.” in 14.1 seconds with WebGPU and cross-origin isolation disabled. The test loaded authentic SHA-256-verified weights from a loopback fixture and confirmed browser cache reuse. Browser tests also cover formatting, regeneration, hosted-stream parsing with a fixture, attachment privacy, and cancellation. Live hosted AI requires authorized credentials. |
| Web Search | Tested local, game wiki, YouTube, and Wikipedia result paths, tab controls, query suggestions, and a fixture-backed search provider. Google requires a configured Programmable Search Engine. Broad web search requires a configured search provider. |
| Proxy Gemini | Tests cover tabs, back, forward, refresh, fullscreen, a local game, a blocked frame with a publisher link, browser history and favorites, and mobile layout. The viewer uses the browser's normal sandbox and embedding rules. |
| Movies and preferences | Tests cover movie collection filters and official player routes, responsive navigation, and existing game favorites and recent activity. |

Complete online gameplay, provider quotas, individual third-party poster availability, and streaming rights depend on each source. HTTP reachability alone does not show that a remote game supports in-page playback. [Fancade embedding documentation](https://www.fancade.com/wiki/Fancade_Web#Embedding)

The CPU test exercised Chromium with production-equivalent WebAssembly and worker restrictions. It did not exercise the direct model download in Brave. The hosted gateway passed local fixture tests and an unauthenticated local smoke test. Live OpenAI, Brave Search, and YouTube Data API requests require provider credentials.
