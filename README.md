# Gamefor Ffun / Proxy Arcade

Gamefor Ffun is a static arcade for built-in games, an external game directory, gaming videos, animated films, and the Proxy Gemini viewer. The site uses plain HTML, CSS, and JavaScript. It has no build step or production dependencies.

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

**Explore** leads to the 18 built-in games, ten video topic collections, a scrollable Shorts player, 48 cinema listings, and the Music library. The curated YouTube library contains 1,153 entries and loads more cards in batches. Music has 67 verified official uploads, including artist collections, Billboard picks, and saved and recent playlists.

**blip.ai** is the chat workspace at `#blip`. Chats and attached text are saved locally. **Set up AI → Start CPU AI** starts an optional approximately 108 MB first download and generates replies locally without a GPU. The built-in browser model and WebGPU mode are also available on supported devices. The optional hosted gateway supports streaming for conversations without files. [CPU model sources](assets/vendor/wllama-2.3.7/SOURCE.md) · [Gateway setup](server/README.md)

Proxy Gemini previews public HTTPS pages inside a browser sandbox and uses official embeds for supported games and videos. The viewer respects publisher frame restrictions. An optional new-tab link is available when a page does not display. Text searches can open matching arcade games or use Google in a new tab. The existing Base44 viewer is available under the legacy viewer disclosure.

**Web Search** keeps query history in arcade tabs. It combines matching games, wiki references, and YouTube videos, with optional connected video search configured under **YouTube**. The **Google** tab can open arcade results directly or show an optional configured Google engine inside an isolated frame. **Maps** uses Open-Meteo geocoding and an OpenStreetMap embed. [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) · [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)

## Maintain the content

- [Game catalog and recovery](docs/catalog-recovery.md) explains the 548 entries accounted for in the main libraries and the three additional games preserved from the homepage and repository history.
- [Media sources](docs/media-sources.md) lists video and film sources, credits, and the optional search integration.
- [Platform upgrade](docs/platform-upgrade.md) records the plan, review steps, and validation scope.
- [Verification report](docs/qa.md) documents the tests and known limits.
