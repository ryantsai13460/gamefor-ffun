# Gamffun 6.0 development report

The development branch starts from the live [Gamffun 5.0 revision](https://github.com/ryantsai13460/gamefor-ffun/tree/3f865f4b6174ef126e1858b2b60d90a1bc516b00). The initial source was archived before edits. The site continues to use GitHub Pages and an optional Cloudflare Worker.

## What changed

- **Short Videos** has its own vertical feed with provider tabs, categories, search, incremental loading, keyboard navigation, original-post links, favorites, and history when a player confirms playback. TikTok and Instagram load the official player after a visitor selects Play.
- **Music** opens a reviewed lyric-video library. The separate Visualizers collection displays reviewed instrumental art tracks. Both use official players and provide search, favorites, playlists, history, and source links. Earlier creator catalogs, the 7clouds queue, chart search, and the broader music archive are still reachable from their existing URLs and the Music sources controls.
- **Movies** adds 37 complete works. The 32 National Film Board of Canada titles use its in-page player for personal and noncommercial use. Five documentaries link to their official NASA+ players. [NFB terms](https://help.nfb.ca/terms/) · [NASA+](https://plus.nasa.gov/)
- **Community** links to actual project updates and public reporting channels. Its optional Discord setup validates the public server ID and invite. The status widget and invite verification run on explicit clicks, and the server settings can be cleared from the device. [Discord widget](https://docs.discord.com/developers/resources/guild#get-guild-widget-image) · [Discord invite API](https://docs.discord.com/developers/resources/invite#get-invite)
- **Shopping** supports six categories, 18 starting searches, and official Amazon and eBay U.S. search links. It saves interests and searches on the device. Retailers show product availability, prices, and checkout on their own sites.
- **Home, Search, and My library** link the new sections together. Universal search finds reviewed lyrics, films, games, videos, and the curated public social posts. It can carry the query into Shopping or create a Blip question draft. The dashboard surfaces Proxy Gemini bookmarks and history, saved shopping searches, lyric playlists, and short-video activity. The global search history control also clears Shopping recents and leaves saved queries available.
- **Blip** adds an optional Workers AI Gemma 4 Advanced mode and response audio using an installed device voice. Standard replies keep their existing provider configuration. Hosted conversations and cited lookups still use the authorized gateway. [Worker setup and limits](../server/README.md)
- **Performance and preservation**. Home retains the working game spotlight and theme options. The new route code and styles load when opened. The library prepares its media index once per page session, catalog displays are bounded, and thumbnails load lazily. The 5.0 game catalog, game controls, fullscreen, and Proxy Gemini navigation remain available.

## Inventory and verification

| Area | Catalog or integration | Verified |
| --- | --- | --- |
| Games | 1,585 catalog entries, including all 548 recovered entries. 1,051 are configured for in-page play, including 27 built-ins. | Scope tests exercised direct launch, keyboard and touch controls, fullscreen entry and exit, and returning to the library. The test suite mounts all 27 built-ins. The five publisher additions tested in 5.0 remain in this build. |
| Movies | 227 complete films and animated shorts. 194 have approved in-page players, and 33 have official full-film destinations. Another 12 records are trailer or release listings. | All 37 additions advanced the actual movie playback time in normal-TLS WebKit. All 32 NFB additions played inside the arcade and all five NASA+ films played through the official links. |
| Music | The reviewed library contains 16 lyric videos and 5 instrumental art-track visualizers. The 84 previous channel entries, 550 chart lookup rows, and 602 Music archive uploads remain available through the archive routes. | Reviewed records have exact source URLs and per-entry evidence about their visuals. Fourteen returned current official oEmbed metadata and positive embed eligibility. Seven additional artist or studio-sourced uploads have production evidence. Fresh eligibility checks for those seven returned HTTP 503. The 500 reviewed-lyrics target remains open. |
| Short Videos | 820 curated entries across three providers. There are 814 YouTube Shorts, two TikTok posts, and four Instagram Reels. The original YouTube library still lists 1,546 videos and Shorts. | Official TikTok and Instagram player interfaces rendered with the expected public post identities. Guest streaming remained unconfirmed. YouTube media requests returned HTTP 403 during live checks. The app keeps each original-post link available. |
| Community and Shopping | Optional Discord public widget and invite verification. Two working retailer search integrations. | Live Discord widget and invite checks passed with temporary public test settings. Chromium and WebKit exercised keyboard navigation, local saves, and merchant link activation. |

## Performance and layout checks

Chromium passed 141 browser tests. The Node and gateway suites passed 52 and 24 tests respectively. Targeted WebKit runs covered the new Music, Shopping, Discord, and film flows. The gateway used simulated provider responses for the optional hosted AI and connected search checks.

Three cold Chromium mobile visits used 1.25 Mbps bandwidth, 80 ms latency, and 4× CPU slowdown. The median Home title and cover readiness was 6.47 seconds on 5.0 and 6.41 seconds on 6.0. The Home route used 38 first-party requests in both builds, transferring 663 KiB and 667 KiB respectively through that point on the uncompressed local server. These runs measured the same throttled scenario with variable local load. A separate test confirms that the Shopping, Community, and Short Videos interfaces load only when opened. The suite also checks 320px layouts and Home reflow at 200% text size.

## What needs configuration

- The static preview works without an account. A server owner can enter an authorized Discord public server ID and invite in Community. The default ships without a configured server.
- Hosted Blip requires an owner-deployed Cloudflare Worker and access code, plus Workers AI or an authorized OpenAI key. The optional Gemma 4 setting also requires a visitor to select Advanced. Brave Search and connected YouTube need their own authorized keys. Current backend checks used provider fixtures. [Gateway setup](../server/README.md)
- The Shopping integration uses retailer search links. Showing live product inventory and prices inside the site would require approved retailer APIs and owner credentials.
- Expand the reviewed Music collection by confirming the exact official upload, thumbnail, and visual format for each entry. Provider playback and availability can vary by region and device.

## Preview and release

1. Check out `dev/gamffun-6`, run `npm ci` and `npm run dev`, then open [the local preview](http://127.0.0.1:3000/#home).
2. Review `#shorts`, `#community`, `#shopping`, `#music`, and `#movies`. The earlier Music catalog is at `#music?view=archive`.
3. Run `npm test`, `npm run test:gateway`, and `npm run test:browser` in the branch. GitHub Pages deploys after the development pull request is reviewed and merged into `main`. [Deployment instructions](../README.md#deploy-on-github-pages)
