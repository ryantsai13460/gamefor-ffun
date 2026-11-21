# Gamefor Ffun / Proxy Arcade

Gamefor Ffun is a static arcade for built-in games, an external game directory, gaming videos, animated films, and the Proxy Gemini viewer. The site uses HTML, CSS, and JavaScript and runs without a build step.

## Run locally

Use Python 3.9 or later and Node.js 20 or later.

```sh
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Serving the project over HTTP allows the browser to load the JavaScript modules.

## Test

```sh
npm ci
npm test
npm run test:gateway
npx playwright install chromium
npm run test:browser
```

The browser suite uses a local test server. You can set `ARCADE_CHROMIUM` to a compatible installed Chromium executable. See the [verification report](docs/qa.md) for coverage and third-party playback limits.

## Deploy on GitHub Pages

GitHub Pages deploys from the root of `main`. The entry point is `index.html`, and `.nojekyll` enables direct static serving. Asset and game links use relative paths for the `/gamefor-ffun/` project URL.

The static site runs its built-in games, catalog filters, saved games, media library, and permitted-content viewer in the browser. Favorites, history, local launch totals, and preferences stay on the device. Creator imports can fetch public data through the YouTube Data API. The optional connected search can run on a Cloudflare Worker free plan with its API key stored as a Worker secret. Its API contract is documented in [Media sources](docs/media-sources.md). The local video library and link to search on YouTube are available on every deployment.

**Explore** leads to 20 built-in games, ten video topic collections, a scrollable Shorts player, 48 cinema listings, and the Music library. Harbor Dispatch is a rail-switching puzzle, and Tidal Rescue is a boat rescue game. The curated YouTube library contains 1,253 entries and loads more cards in batches. **Watch lyrics** plays 42 official lyric videos. **All chart songs** lists 550 songs and offers title-and-artist searches where a verified lyric video is unavailable. The separate Music videos collection has 67 official uploads and saved and recent playlists.

**blip.ai** is the chat workspace at `#blip`. Search and pin saved chats, download a transcript, edit and resend a message into a new conversation, preview attachments, and copy generated code. Blip can read selectable PDF text on-device, find passages, summarize text, and profile CSV or TSV files. PDF attachments use up to 20 pages per file and share the attachment text limit. **Set up AI → Start CPU AI** starts an optional approximately 108 MB first download and generates replies locally without a GPU. Supported devices can also use the built-in browser model or WebGPU mode. A configured hosted gateway adds streaming, Advanced replies, and opt-in research with source links for conversations without files. [PDF.js source](assets/vendor/pdfjs-6.5.438/SOURCE.md) · [CPU model sources](assets/vendor/wllama-2.3.7/SOURCE.md) · [Gateway setup](server/README.md)

Proxy Gemini previews public HTTPS pages inside a browser sandbox and uses official embeds for supported games and videos. Duplicate tabs, reopen recently closed tabs with their Back and Forward history, and open saved pages directly from Start. The viewer respects publisher frame restrictions. An optional new-tab link is available when a page does not display. Text searches can open matching arcade games or use Google in a new tab. The existing Base44 viewer is available under the legacy viewer disclosure.

**Web Search** keeps query history in arcade tabs. It combines matching games, wiki references, and YouTube videos, with optional connected video search configured under **YouTube**. AI Mode can answer an on-device follow-up using the last turn and send a topic to Web & YouTube in the same tab. The **Google** tab can open arcade results directly or show an optional configured Google engine inside an isolated frame. **Maps** uses Open-Meteo geocoding and an OpenStreetMap embed. [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) · [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)

## Maintain the content

- [Game catalog and recovery](docs/catalog-recovery.md) explains the 548 entries accounted for in the main libraries and the three additional games preserved from the homepage and repository history.
- [Media sources](docs/media-sources.md) lists video and film sources, credits, and the optional search integration.
- [Platform upgrade](docs/platform-upgrade.md) records the plan, review steps, and validation scope.
- [Verification report](docs/qa.md) documents the tests and known limits.
