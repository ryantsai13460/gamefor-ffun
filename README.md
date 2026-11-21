# Gamefor Ffun / Proxy Arcade

Gamefor Ffun brings together built-in games, a game directory, films, music, YouTube, blip.ai, and the Proxy Gemini viewer. The site uses HTML, CSS, and JavaScript and runs without a build step.

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

The browser suite uses a local test server. You can set `ARCADE_CHROMIUM` to a compatible installed Chromium executable. The report covers provider fixtures and third-party playback limits. [Verification report](docs/qa.md)

## Deploy on GitHub Pages

GitHub Pages deploys from the root of `main`. The entry point is `index.html`, and `.nojekyll` enables direct static serving. Asset and game links use relative paths for the `/gamefor-ffun/` project URL.

Review the prepared development branch and the verification report before merging. To test the current commit as a static package, export the public files and serve the extracted files over HTTP under a `gamefor-ffun` directory. This matches the path used on GitHub Pages.

```sh
git archive --format=zip -o gamefor-ffun-pages.zip HEAD .nojekyll index.html catch-the-star.html pro.html index.html.index.html assets
```

The static site runs its built-in games, catalog filters, saved games, media library, and permitted-content viewer in the browser. Favorites, history, local launch totals, and preferences stay on the device. Creator imports can fetch public data through the YouTube Data API. The optional connected search and hosted chat require a separate gateway. The included Cloudflare Worker fits the Free plan and keeps provider credentials in Worker secrets. Provider charges and quotas are separate. [Gateway setup](server/README.md) · [Media sources](docs/media-sources.md) · [Verification report](docs/qa.md)

**Search the library** looks up games, movies, official music uploads, and videos together. **My library** brings together saved items, playlists, activity, chats, and theme settings. Home can show your recent games, local launch counts, and media picks. Use **Game backgrounds** in Settings for a clean panel, an arcade grid, a Pocket Circuit gameplay screenshot, or your own image. Custom images are resized and stored in the same browser.

**Explore** leads to 22 built-in games, including Picnic Pack and Kite Breeze. The YouTube library has 1,397 curated entries, family selections, video favorites, and a scrollable Shorts player. Search for MrBeast to find full videos and Shorts. Connected YouTube search follows the provider’s page tokens when a configured service returns them. **Movies** has 151 complete films, a Family films collection, watchlists, and Continue watching for supported players. **Music videos** has 311 official uploads with artist and genre filters, favorites, history, and editable playlists. **Watch lyrics** has 84 text-first uploads from 7clouds and other lyric channels. **All chart songs** lists 550 songs with creator lyric videos or a title-and-artist video search. [Media sources](docs/media-sources.md)

**blip.ai** is the chat workspace at `#blip`. A configured gateway streams hosted replies without a model download through Cloudflare Workers AI or an authorized OpenAI account. Blip can also use local models and read selectable PDF text on-device, find passages, summarize text, and profile CSV or TSV files. PDF attachments use up to 20 pages per file and share the attachment text limit. CPU AI streams replies locally and downloads about 271 MB of model weights on first setup. The chat supports saved history, attachments, study and coding modes, and Markdown tables, code, and equations. [PDF.js source](assets/vendor/pdfjs-6.5.438/SOURCE.md) · [CPU model sources](assets/vendor/wllama-2.3.7/SOURCE.md) · [Hosted chat setup](server/README.md)

Proxy Gemini previews permitted public HTTPS pages in a browser sandbox and uses official embeds for supported games and videos. Switching tabs preserves the open game or page. Use **Share** to copy the current viewer address, including supported YouTube start times. Duplicate tabs, reopen recently closed tabs with their Back and Forward history, and open saved or recent pages from Start. A configured Web Search provider supplies results you can open in separate viewer tabs. An official link is available when a page fails to display. **Games you can play here** lists built-in games and publisher-authorized embeds from Proxy Gemini and Google. The existing Base44 viewer is available under the legacy viewer disclosure.

**Web Search** keeps query history in arcade tabs. It combines arcade results, wiki references, and YouTube videos. Connect an authorized Brave Search gateway to see web results and use **Ask Blip** to review one in chat. AI Mode can answer an on-device follow-up using the last turn and send a topic to Web & YouTube in the same tab. The **Google** tab includes a guide, videos, and writing tools for essay questions, and supports a configured Google engine in an isolated frame. **Maps** uses Open-Meteo geocoding and an OpenStreetMap embed. [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) · [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)

## Maintain the content

- [Game catalog and recovery](docs/catalog-recovery.md) explains the 548 entries accounted for in the main libraries and the three additional games preserved from the homepage and repository history.
- [Media sources](docs/media-sources.md) lists video and film sources, credits, and the optional search integration.
- [Platform upgrade](docs/platform-upgrade.md) records the plan, review steps, and validation scope.
- [Verification report](docs/qa.md) documents the tests and known limits.
