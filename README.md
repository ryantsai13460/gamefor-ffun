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

Review the prepared development branch and the verification report before merging. To test the current commit as a static package, export the public files and serve the extracted files over HTTP under a `gamefor-ffun` directory. This matches the path used on GitHub Pages.

```sh
git archive --format=zip -o gamefor-ffun-pages.zip HEAD .nojekyll index.html catch-the-star.html pro.html index.html.index.html assets
```

The static site runs its built-in games, catalog filters, saved games, media library, and permitted-content viewer in the browser. Favorites, history, local launch totals, and preferences stay on the device. Creator imports can fetch public data through the YouTube Data API. The optional connected search and hosted chat require a separate gateway. The included Cloudflare Worker fits the Free plan and keeps provider credentials in Worker secrets. Provider charges and quotas are separate. [Gateway setup](server/README.md) · [Media sources](docs/media-sources.md) · [Verification report](docs/qa.md)

**Explore** leads to 20 built-in games, ten video topic collections, a scrollable Shorts player, 48 cinema listings, and the Music library. Harbor Dispatch is a rail-switching puzzle, and Tidal Rescue is a boat rescue game. The curated YouTube library contains 1,253 entries and loads more cards in batches. **Watch lyrics** has 69 uploads from 7clouds and six other lyric channels, with channel credits and text-only covers. **All chart songs** lists 550 songs, with matching creator videos or a title-and-artist video search. The Music videos collection has 67 official uploads and saved and recent playlists.

**blip.ai** is the chat workspace at `#blip`. Search and pin saved chats, download a transcript, edit and resend a message into a new conversation, preview attachments, and copy generated code. Blip can read selectable PDF text on-device, find passages, summarize text, and profile CSV or TSV files. PDF attachments use up to 20 pages per file and share the attachment text limit. If a reply needs a model, Blip can set one up in the chat and retry the saved message. CPU AI streams replies locally and downloads about 106 MB of model weights the first time it is started. Supported devices can also use the built-in browser model or WebGPU mode. A configured hosted gateway adds Advanced replies and opt-in research with source links for conversations without files. [PDF.js source](assets/vendor/pdfjs-6.5.438/SOURCE.md) · [CPU model sources](assets/vendor/wllama-2.3.7/SOURCE.md) · [Gateway setup](server/README.md)

Proxy Gemini previews public HTTPS pages inside a browser sandbox and uses official embeds for supported games and videos. Switching tabs preserves the open game or page. Duplicate tabs, reopen recently closed tabs with their Back and Forward history, and open saved pages directly from Start. Preview status distinguishes confirmed players from pages the browser cannot inspect. An official link is available if a page fails to display. **Games you can play here** lists built-in games and publisher-authorized embeds from Proxy Gemini and Google. The existing Base44 viewer is available under the legacy viewer disclosure.

**Web Search** keeps query history in arcade tabs. It combines matching games, wiki references, and YouTube videos, with optional connected video search configured under **YouTube**. AI Mode can answer an on-device follow-up using the last turn and send a topic to Web & YouTube in the same tab. The **Google** tab includes a guide, videos, and writing tools for essay questions. It can open game results directly and supports a configured Google engine inside an isolated frame. **Maps** uses Open-Meteo geocoding and an OpenStreetMap embed. [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) · [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)

## Maintain the content

- [Game catalog and recovery](docs/catalog-recovery.md) explains the 548 entries accounted for in the main libraries and the three additional games preserved from the homepage and repository history.
- [Media sources](docs/media-sources.md) lists video and film sources, credits, and the optional search integration.
- [Platform upgrade](docs/platform-upgrade.md) records the plan, review steps, and validation scope.
- [Verification report](docs/qa.md) documents the tests and known limits.
