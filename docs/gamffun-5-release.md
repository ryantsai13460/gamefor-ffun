# Gamffun 5.0 release report

The development branch starts from the deployed [d40a117 revision](https://github.com/ryantsai13460/gamefor-ffun/tree/d40a1176761d8c77a03c656f475cd56ef1e061e4). A ZIP of that revision and a detached checkout were saved before editing. The release keeps the static HTML, CSS, and JavaScript app and the separately deployed optional Cloudflare Worker.

## Problems and repairs

- **Game launch and recovery.** Some titles had a usable official page but their game details only offered other games. Game details and Proxy Gemini now provide an explicit publisher link for supported listings. Approved players still open in-page, and their recovery offers Retry or Restart and a source link. Spinz.io remains in the historical catalog with its closure notice. Older distributor links still resolve to the right listing.
- **Lantern Shift.** The published route started correctly in the baseline check. The game now saves the highest completed lantern total per course on this device. Normal and relaxed pace share the record. Restarting mid-run leaves the existing record intact. The existing lane controls, restart, pause, direct launch and Back behavior remain available.
- **Home and search.** Home has a keyboard-accessible spotlight for Pocket Circuit, Lantern Shift, and Terrace Workshop using captured gameplay. The main shortcuts lead to the actual sections, and Music opens its discovery view. Settings can recommend in-page games in a chosen category. Visitors can pause or clear Web Search and library search histories. The library indexes each game’s playback option once for repeated filters.
- **Web Search and Blip.** Connected search offers another page when Brave signals one, deduplicates URLs across pages, and preserves loaded results on retry. Web Search can draft a cited Blip research question. The editable lookup phrase is separate from the question and sending requires an explicit action. Saved drafts resolve to their chat after sending. Regeneration keeps the lookup phrase. The hosted gateway applies its reply limits and provider retry delay.
- **Proxy Gemini.** Search refresh retains its previous results if the provider fails. Saved bookmarks and history are searchable. The viewer still uses its existing sandbox and publisher embeds, so the publisher and the visitor’s network determine what can load.
- **Movies, Music, and YouTube.** Ten complete National Film Board of Canada animations join the Movies catalog. Movie filters combine runtime, genre, and playback. Selections survive Details and Back. Music adds artist artwork and Recently added, Acoustic, and Jazz discovery. The Watch Queue keeps focus on the next control when a player closes during removal. YouTube shows when connected search is limited and retains local and previously loaded results. The 7clouds main-channel view, lyrics collection, and chart lookup remain available.

## Catalog and playback

| Library | Configured in this release | Verification |
| --- | --- | --- |
| Games | 1,585 unique entries, including all 548 recovered records. 1,051 configured for in-page play (27 built-in and 1,024 hosted), 531 external, 3 unavailable. 1,445 entries have credited artwork. | All built-ins mounted in Chromium. Five new publisher games accepted gameplay input inside the real arcade sandbox. Lantern Shift was played with keyboard and touch. |
| Movies | 190 complete films, including 162 with an embedded player and 28 with an official full-film link. Another 12 listings are trailers or releases. | All 10 new NFB films advanced playback inside the development arcade. The Tooth and The Cat Came Back also played on the published site. Sintel’s player and Blender Studio source were reachable. Its media stream returned HTTP 403 in the QA network. |
| Music | 602 official uploads across 19 collections. The 84 text-first lyric uploads and 550 chart lookup rows are separate views. | All 291 additions matched their official uploader and thumbnail and had positive embed-eligibility metadata. Two full-stream spot checks were unavailable on this network. Both had a direct YouTube fallback. |
| YouTube | 1,546 curated videos and Shorts, including 18 new family and learning videos. Connected search can load more through the configured API. | The additions matched official YouTube titles and uploaders and had positive embed-eligibility metadata. Browser fixtures covered playback controls, Shorts, pagination and rate limits. Full live playback across the catalog remains unverified. |

The five new games are WordSash, Killer Sudoku, Pings Portal, Breachfield, and Pier Putt. The launch checks used current publisher responses and normal certificate validation. Source corrections include Drive Mad, Eggy Car, Idle Breakout, Slope, Suika Game, and Subway Surfers artwork. [Game sources and attribution](catalog-recovery.md) · [Official media sources](media-sources.md)

## Files changed

| Area | Files |
| --- | --- |
| Arcade, search and layout | `index.html`, `assets/arcade.js`, `arcade.css`, `home.css`, `library.js`, `discovery.js` |
| Games and content viewer | `assets/catalog.js`, `independent-games.js`, `lantern-shift.js`, `browser.js`, `browser.css` |
| Chat and gateway | `assets/blip.js`, `blip.css`, `blip-store.js`, `service-gateway.js`, `server/worker.js`, `server/README.md` |
| Movies, Music and YouTube | `assets/film-family.js`, `film-library.js`, `films.css`, `music-catalog.js`, `music-library.js`, `music-library.css`, `media.js`, `media-learning-videos.js` |
| Tests | `tests/arcade.test.js`, `tests/lantern-shift.test.js`, `server/worker.test.js`, and browser specs covering the updated sections |
| Release notes and sources | `README.md`, `docs/catalog-recovery.md`, `docs/media-sources.md`, this report |

## Verification and performance

- `npm test` and `npm run test:gateway` passed 47 and 23 tests respectively. Provider responses in the Worker tests were fixtures.
- The Chromium suite checks every catalog card, all built-in player mounts, direct links, watch queues, media filters, search/privacy settings, and game and chat interactions. Targeted WebKit tests checked Lantern Shift, recovery, and Music. Representative live checks used the published site and local arcade rather than provider fixtures.
- The published Lantern Shift check confirmed starting, changing lanes, returning to Home and staying in one tab. A separate Chromium check preserved the exact game search when going Back to browsing. The best-score test finished two real built-in runs and verified the stored improvement across reloads.
- The static preview passed a smoke test at the GitHub Pages project path and 320 px viewport. It exercised Lantern Shift, Home navigation, the game and film filters, Music discovery, and the Web Search to Blip draft with no JavaScript errors or missing first-party assets.
- Three comparable cold Chromium visits at a simulated 1.25 Mbps, 80 ms latency and 4× CPU slowdown measured median Home title plus cover readiness at 6.13 s on the baseline and 5.91 s on this version. First-party transfer through that point was 650 KiB and 663 KiB respectively on the uncompressed local server, with third-party traffic blocked. Six repeated All Games filter redraws took a median 464 ms and 408 ms respectively. These are local measurements with run-to-run variation. They identify initial static transfer as the larger remaining cost.

## Preview, deploy, and connect services

1. Run `npm run dev` at the branch root and open [the local preview](http://127.0.0.1:3000/#home). Use `#play/lantern-shift?start=1`, `#music?view=videos`, `#movies?playback=in-page`, or `#web-search` to review individual routes.
2. Review the development pull request, then merge it into `main` to deploy GitHub Pages. Serving the files from the root of `main` needs no build or secrets. The README includes the command for exporting a portable static ZIP. [Deployment instructions](../README.md#deploy-on-github-pages) · [GitHub Pages site](https://ryantsai13460.github.io/gamefor-ffun/)
3. For hosted Blip, deploy the Worker with its allowed site origin and a private access code. Choose the included Workers AI binding or add an authorized OpenAI API key. Add the Brave Search key for Blip Search and connected Web Search. Add a YouTube Data API key for connected video discovery. Enter the Worker URL and access code in the site settings. Provider pricing and quotas apply to the selected services. The current release verification used fixtures for these calls. [Worker setup and quotas](../server/README.md)

Follow-up verification should exercise the owner’s deployed gateway with one real authorized chat, cited search, and video page before sharing access. Additional provider coverage should prioritize a representative live playback matrix across regions and devices. The settings and built-in experiences work on the static site without those services.
