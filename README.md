# Gamefor Ffun / Proxy Arcade

Gamefor Ffun brings together built-in games, a game directory, films, lyric videos, Short Videos, YouTube, Shopping, Community, blip.ai, and Proxy Gemini. The arcade uses HTML, CSS, and JavaScript and runs without a build step.

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

**Cloud Browser** opens from Proxy Gemini at `#cloud-browser`. Each connection starts a private Chromium session on an operator-managed Linux backend and streams the display to the arcade. Operators approve the HTTPS origins the browser can reach. GitHub Pages serves the viewer, and the backend runs separately. [Setup, testing, and hosting costs](cloud-browser/README.md)

Home puts Games, Movies, Lyric Videos, and Short Videos up front. The shortcuts also open YouTube, Web Search, Proxy Gemini, Blip, Community, and Shopping. Switch the spotlight between Pocket Circuit, Lantern Shift, and Terrace Workshop to launch one of the built-in games. **Play here** lets you replay your latest game or open a built-in pick with one action. **Watch and listen** previews the film, music, and video collections. **Search the library** groups results, marks exact matches, accepts publisher game links, and searches authorized product listings and saved bookmarks. **My library** brings together saved items, playlists, Proxy Gemini bookmarks, short-video activity, shopping searches, and chats. Choose an optional recommended game category and hide individual shelves in Settings.

The Home switcher offers Arcade, School, Gaming, Watching, and Library modes. School prioritizes topic search, AI Study Help, and practice games. Gaming filters Home search to in-page games. Watching prioritizes family films, Shorts, and recently added media. Library puts saved items and recent activity first. Modes change the Home experience and quick actions.

**Colors & modes** previews ten site themes, including the new Lagoon, Berry, Cobalt, and Dune palettes. **Game backgrounds** lets you pick a preset, choose a custom color, or upload an image. Mode, theme, and background preferences save independently in the same browser.

**Play Here** in the navigation opens the in-page library, with 1,090 titles configured for in-page play. It includes 30 built-in games and 1,060 publisher and creator players. Prism Relay joins the built-in library with three light-routing puzzles and keyboard and touch controls. **Games Like OvO** collects precision jumps, wall climbs, timed runs, and puzzle platformers, including the built-in Beacon Ascent. The top search bar keeps your collection and play option while you search. **Copy play link** creates a link that starts the in-page player, and **Open game page** links to the source. [Platformer expansion](docs/platformer-library.md) · [Game sources and verification](docs/catalog-recovery.md)

**Petverse Online** opens Sunstep Meadow inside the arcade’s game player. Collect 500 species from six habitats, with ten rarity tiers and distinct crystal-mining roles. Open the Bestiary eggs, assign pets to gather while you crank, and earn bonuses for completing egg sets. Solo progress saves in the browser, and the optional Petverse server supports invite-only meadows with persistent profiles. [8.0 controls and graphics guide](docs/petverse-8-foundation.md) · [Bestiary guide](docs/petverse-bestiary.md) · [Biome Expeditions guide](docs/petverse-biome-expeditions.md) · [Multiplayer setup](petverse-server/README.md)

**Explore** leads to 27 built-in games, including Lantern Shift, Terrace Workshop, and Fraction Kitchen. The YouTube library has 1,560 curated entries, family selections, favorites, Shorts, and a watch queue for both formats. Connected YouTube search follows page tokens from its configured provider. **Movies** has 302 complete films, runtime and playback filters, Family films, Classic films, and Documentaries collections, watchlists, and Continue watching for supported players. **Music** opens with 36 reviewed lyric videos and 16 instrumental visualizers. You can reorder playlist tracks with keyboard-accessible controls. The Music sources controls retain the earlier 84 channel entries, the 550 chart lookup rows, and the 602-upload Music archive. [Media sources](docs/media-sources.md)

**7clouds uploads** at `#music?lyrics=7clouds` lets you search 55 main-channel lyric videos and select each one in the official YouTube player. The full public uploads playlist remains available from the same page. Video selection works locally and playback depends on YouTube availability. [7clouds uploads](https://www.youtube.com/playlist?list=UUNqFDjYTexJDET3rPDrmJKg) · [YouTube playlist embedding](https://support.google.com/youtube/answer/171780)

**blip.ai** is the chat workspace at `#blip`. A configured gateway streams hosted replies without a model download through Cloudflare Workers AI or an authorized OpenAI account. Blip keeps recent exchanges together in its context and gives Think, Code, and Creative answers more room. When a hosted reply reaches its limit, you can draft a continuation. Local models retrieve relevant passages from attachments, including follow-up questions about text farther down a file. Blip can read selectable PDF text, summarize attachments, and profile CSV or TSV files. PDF attachments use up to 20 pages per file and share the attachment text limit. CPU AI streams locally and downloads about 271 MB of weights on first setup. [PDF.js source](assets/vendor/pdfjs-6.5.438/SOURCE.md) · [CPU model sources](assets/vendor/wllama-2.3.7/SOURCE.md) · [Hosted chat setup](server/README.md)

The gateway can offer optional **Gemma 4 Advanced** replies after owner configuration and visitor opt-in. **Read aloud** uses a compatible local device voice where available. Blip's **Chat tools** downloads conversation backups as JSON and can restore them as copies in this browser. Backups include saved messages, pins, thinking modes, and saved attachment excerpts. **Blip Search** can send an editable lookup phrase separately from the chat question and cite the results. Connected web results and general queries can draft a Blip question for review. [Hosted research setup](server/README.md)

Proxy Gemini previews permitted public HTTPS pages in a browser sandbox and uses official embeds for supported games and videos. Its Start page filters playable games by title, category, and player type. Each tab keeps its filters and visible games when you go back. You can hide a slow preview and reopen it when needed. Rename bookmarks and search them by title or address. Catalog-only listings give you in-page alternatives and an explicit publisher link when available. Failed search refreshes keep the last results and offer a retry. Official player availability depends on the publisher, browser, and network. **Share** copies the viewer address, including supported YouTube start times.

**Web Search** combines arcade results, primary reference guides, wiki excerpts, and YouTube videos. A connected Brave Search gateway can offer more pages and retry failed requests. **Remember searches** and **Clear search histories** control local Web Search, library, and Shopping history from Settings. Complete pasted addresses are excluded from the Web Search query history. **AI Mode** offers built-in writing, study, and math help, source comparisons, optional Wikipedia references, on-device models, and a separate control for requesting a hosted answer. Hosted research can add citations through a configured gateway. The **Google** tab supports a configured Google engine in an isolated frame. **Maps** uses Open-Meteo geocoding and an OpenStreetMap embed. [AI Search modes](docs/ai-search.md) · [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) · [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api)

**Short Videos** at `#shorts` is a vertical feed for curated YouTube Shorts and confirmed public posts from TikTok and Instagram. Play opens the official provider. Search, source tabs, categories, favorites, and supported playback history work on the device.

**Community** at `#community` links to project updates and has an optional public Discord widget and invite check. **Shopping** at `#shopping` offers curated categories and searches through official Amazon and eBay U.S. links. Shops handle current listings, prices, and checkout.

The Gamffun profile starts as `user_12345`. Select the profile badge or open `#settings?panel=profile` to change the username. Gamffun stores it in your browser and keeps your existing saved items. Each external service manages its own accounts and sign-in.

Open `#instagram` to browse selected public posts or paste an Instagram post or reel link for its official embed. Open `#community?view=discord` to browse the public voice and stage channels a configured server publishes through its Discord widget. Open `#shopping?retailer=amazon` to filter product picks, sort by brand or product name, read specifications, and save picks to My library. Amazon shows live prices and handles checkout.

## Maintain the content

- [Game catalog and recovery](docs/catalog-recovery.md) explains the 548 entries accounted for in the main libraries and the three additional games preserved from the homepage and repository history.
- [Media sources](docs/media-sources.md) lists video and film sources, credits, and the optional search integration.
- [Platform upgrade](docs/platform-upgrade.md) records the plan, review steps, and validation scope.
- [Gamffun 5.0 release report](docs/gamffun-5-release.md) lists the changes, inventory, verification, and deployment steps for the previous release.
- [Verification report](docs/qa.md) documents the tests and known limits.

- [Gamffun 6.0 development report](docs/gamffun-6-release.md) records the new routes, provider checks, setup requirements, and release steps.
- [Gamffun 7.0 release report](docs/gamffun-7-release.md) records the catalog expansion, playback checks, performance measurements, and deployment preview.
