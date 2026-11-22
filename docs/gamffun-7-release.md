# Gamffun 7.0

Gamffun 7.0 extends the Gamefor Ffun site on the `dev/gamffun-7` branch. The app uses HTML, CSS, and browser JavaScript modules. GitHub Pages serves the static site. The optional Cloudflare Worker handles authorized search and hosted chat with server-side provider credentials.

## What changed

| Area | Release result |
| --- | --- |
| Games | 1,602 entries, including all 548 recovered games. There are 1,068 configured for in-page play, including 27 built-in games and 1,041 external publisher players. The remaining 534 are catalog listings or entries with unavailable players. |
| Game player | The player keeps a slow official frame open if a resource delays the browser's load event. Restart, fullscreen, and the official source remain available. |
| Movies | 302 complete films, up from 227. There are 260 with an in-page player and 42 complete films on an official provider page. 12 separate listings contain trailers or release information. Added Classic films and Documentaries collections. |
| Music | 36 reviewed official lyric videos and 16 instrumental visualizers, including 20 new lyric videos and 11 new visualizers. Added visual-production references, matching-instrumental search, and reusable playlist ordering controls. |
| YouTube | 1,560 curated uploads, with 707 full videos and 853 Shorts. Added 14 official gaming uploads, including five vertical Shorts. |
| Short Videos | 825 curated posts across 819 YouTube Shorts, two TikTok posts, and four Instagram Reels. |
| Search | Universal Search groups results, labels exact matches, and includes authorized product listings and your device's Proxy Gemini bookmarks. Searching again from the Web Search Bookmarks view opens the local bookmark filter. Library Search keeps pasted addresses and bookmark-only queries out of recent text searches. |
| Proxy Gemini | Hide a slow preview, reopen it when ready, and rename saved bookmarks. Browser navigation and restored tabs remember which previews were hidden. |
| Shopping | Sort the Amazon U.S. catalog by product name or brand. Filters, saved searches, links, and product detail pages retain the order. eBay category and query links go to the official provider. |
| Blip | On-device models get relevant passages from the loaded attachment text when users ask follow-up questions. Browser, WebGPU, CPU, and connected AI choices continue to use their existing opt-in setup. |
| Home | Route-specific style sheets load on demand, reducing the first-party requests made by a cold visit. |

The 17 new games include official Yuzool, Afternoon Games, and Tapamine players, independent titles from S7GS, and the licensed Trimps source. Publisher links and credits appear in the arcade. Fifteen new titles use specific publisher artwork and two use title placeholders. [Yuzool embed guide](https://www.yuzool.com/embed/) · [Afternoon Games embed guide](https://afternoongames.com/free-games-for-your-website) · [Catalog sources](catalog-recovery.md)

The 75 new complete films include 62 National Film Board of Canada films, seven from NASA+, four filmmaker-published Vimeo shorts, and two public-domain silent films. Films retain their official provider links and source credits. The Vimeo player uses the verified public video ID and Vimeo's privacy parameter. [NFB](https://www.nfb.ca/) · [NASA+](https://plus.nasa.gov/) · [Media sources](media-sources.md)

## Verification

- Passed 57 repository unit tests, 24 gateway tests, and 161 Chromium browser tests. The exported static ZIP passed a 320px smoke test under `/gamefor-ffun/` with no missing first-party assets or JavaScript errors.
- The exact published Lantern Shift URL in the brief started with keyboard controls and returned to Home. The same link parameters passed on the development branch. All 27 built-in games launched under Chromium while third-party requests were disabled. [Lantern Shift](https://ryantsai13460.github.io/gamefor-ffun/?release=d40a117&build=20261122-1#play/lantern-shift?start=1)
- Sixteen of the 17 additions completed live in-page input checks. Bat Hunt reached wave one during an earlier live session. Its slow-load fix passed the delayed-resource browser test in Chromium and WebKit. The publisher returned HTTP 503 on the live retest. [Publisher game links](catalog-recovery.md)
- Movie checks observed playback progress in 40 new NFB films and two new Vimeo films. Stream checks fetched real media bytes for 59 of the 62 NFB films, all seven NASA+ films, and both public-domain titles. Provider HTTP 503 responses and buffering limited the remaining browser checks. [Film catalog and media sources](media-sources.md)
- The actual SmolLM2 CPU model verified its pinned model digest, streamed 28 updates, and answered Mars in a question about the Red Planet. In the Blip UI, it also answered correctly from a passage 4,472 characters into a local attachment. The tests served the original verified model bytes from a local HTTP server and ran the browser's actual inference engine. [CPU model source and checksum](../assets/vendor/wllama-2.3.7/SOURCE.md)
- All 52 reviewed Music entries passed YouTube's official iframe eligibility check using the GitHub Pages origin. Three live music samples loaded the correct official players. YouTube's media CDN returned HTTP 403 in the QA environment, so playback time did not advance in those samples. The Music player offers the original YouTube link when playback is unconfirmed. [YouTube embed rules](https://support.google.com/youtube/answer/171780)
- Proxy Gemini and Shopping were checked by keyboard and at 320px. In a live test, OpenStreetMap served its official frame and displayed its attribution. Catch the Star advanced to a score of one in the local preview.

### Cold Home comparison

Three cold visits per version used Chromium at 390px, a 1.25 Mbps connection, 80 ms latency, and 4× CPU slowdown on a shared QA host. Third-party requests were disabled. Timings report the median and vary with concurrent workloads.

| Home metric | Previous release | Gamffun 7.0 |
| --- | ---: | ---: |
| First-party requests by spotlight art ready | 40 | 29 |
| First-party transfer by spotlight art ready | 713 KiB | 646 KiB |
| First contentful paint | 3.48 s | 3.27 s |
| Heading and spotlight artwork ready | 13.53 s | 11.94 s |
| Six synchronous All Games filter redraws | 2.34 s | 3.05 s |

## Remaining items

- Music's 500-entry target remains open for the reviewed lyric-first library. Existing chart lookup rows, 7clouds uploads, and the earlier Music archive remain separately accessible.
- Hosted Blip replies and connected Brave or YouTube search require an owner-configured gateway and provider access. The existing public Pages deployment continues to serve built-in search and optional on-device AI. This release uses the existing service configuration. [Gateway setup](../server/README.md)
- Discord can display a server's published widget and authorized invites when the owner configures them. The shopping catalog links to authentic product details and retailer pages. Reuse rights for exact product photos still need confirmation. Retailers handle prices, inventory, and checkout themselves.
- Embeds depend on the publisher, viewer region, browser, and network. Proxy Gemini uses permitted public previews and offers direct official links for unsupported sites.

## Preview and deployment

To recreate the static preview from the branch, use the same paths GitHub Pages serves. Open `http://127.0.0.1:8080/gamefor-ffun/` after extracting the package and starting the HTTP server.

```sh
git archive --format=zip -o gamefor-ffun-7-preview.zip HEAD .nojekyll index.html catch-the-star.html pro.html index.html.index.html assets
mkdir -p preview/gamefor-ffun
unzip gamefor-ffun-7-preview.zip -d preview/gamefor-ffun
python3 -m http.server 8080 --directory preview
```

Merge the reviewed pull request into `main` to trigger the existing GitHub Pages deployment. The pre-upgrade baseline is commit `41bd6fd29a3b9069e00890b3dd0e6658d45218b2`. To roll back after merging, revert the merge on `main` so Pages rebuilds the prior site. [Baseline commit](https://github.com/ryantsai13460/gamefor-ffun/commit/41bd6fd29a3b9069e00890b3dd0e6658d45218b2) · [GitHub Pages deployment history](https://github.com/ryantsai13460/gamefor-ffun/deployments)
