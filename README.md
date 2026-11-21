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

Home puts Games, Movies, YouTube, and Web Search up front. **Play here** links to built-in and publisher-approved in-page games, and **Watch and listen** previews the film, music, and video collections. **Search the library** looks up the catalogs together, and **My library** brings together saved items, playlists, activity, and chats.

The Home switcher offers Arcade, School, Gaming, Watching, and Library modes. School prioritizes topic search, AI Study Help, and practice games. Gaming filters Home search to in-page games. Watching prioritizes family films, Shorts, and new releases. Library puts saved items and recent activity first. Modes change the Home experience and quick actions.

**Colors & modes** previews ten site themes, including the new Lagoon, Berry, Cobalt, and Dune palettes. **Game backgrounds** lets you pick a preset, choose a custom color, or upload an image. Mode, theme, and background preferences save independently in the same browser.

**Explore** leads to 25 built-in games, including Fraction Kitchen and Clock Courier. The YouTube library has 1,528 curated entries, family selections, video favorites, and a scrollable Shorts player. Search for MrBeast to find full videos and Shorts. Connected YouTube search follows the provider’s page tokens when a configured service returns them. **Movies** has 180 complete films, a Family films collection, watchlists, and Continue watching for supported players. **Music videos** has 311 official uploads with artist and genre filters, favorites, history, and editable playlists. **Watch lyrics** has 84 text-first uploads from 7clouds and other lyric channels. **All chart songs** lists 550 songs with creator lyric videos or a title-and-artist video search. [Media sources](docs/media-sources.md)

**blip.ai** is the chat workspace at `#blip`. A configured gateway streams hosted replies without a model download through Cloudflare Workers AI or an authorized OpenAI account. Blip keeps recent exchanges together in its context and gives Think, Code, and Creative answers more room. When a hosted reply reaches its limit, you can draft a continuation. Local models can also answer questions and help read selectable PDF text, summarize attachments, and profile CSV or TSV files. PDF attachments use up to 20 pages per file and share the attachment text limit. CPU AI streams locally and downloads about 271 MB of weights on first setup. [PDF.js source](assets/vendor/pdfjs-6.5.438/SOURCE.md) · [CPU model sources](assets/vendor/wllama-2.3.7/SOURCE.md) · [Hosted chat setup](server/README.md)

Proxy Gemini previews permitted public HTTPS pages in a browser sandbox and uses official embeds for supported games and videos. Its Start page has a searchable in-page game picker. Recognized outside game portals and catalog-only games lead to suggestions inside the arcade. Official player availability depends on the publisher, browser, and network. Switching tabs preserves the open game or page. **Share** copies the viewer address, including supported YouTube start times.

**Web Search** combines arcade results, primary reference guides, wiki excerpts, and YouTube videos. Recent queries are available on an empty search tab and can be cleared. Complete pasted addresses are excluded from the query history. **AI Mode** offers built-in writing, study, and math help, source comparisons, optional Wikipedia references, on-device models, and a separate control for requesting a hosted answer. Hosted research can add citations through a configured gateway. The **Google** tab supports a configured Google engine in an isolated frame. **Maps** uses Open-Meteo geocoding and an OpenStreetMap embed. [AI Search modes](docs/ai-search.md) · [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) · [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)

## Maintain the content

- [Game catalog and recovery](docs/catalog-recovery.md) explains the 548 entries accounted for in the main libraries and the three additional games preserved from the homepage and repository history.
- [Media sources](docs/media-sources.md) lists video and film sources, credits, and the optional search integration.
- [Platform upgrade](docs/platform-upgrade.md) records the plan, review steps, and validation scope.
- [Verification report](docs/qa.md) documents the tests and known limits.
