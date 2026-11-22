# Arcade release verification

## Main-channel song selection and popular game alternatives

Music's 55-song 7clouds queue switches between individual official players and the full uploads playlist. Chromium and WebKit covered searching, keyboard selection, focus restoration, and video switching with the YouTube status script unavailable. Live WebKit received the playlist and individual player documents with the correct referrer, then YouTube returned HTTP 403 for the media requests when Play was pressed. Both streams stayed at 0:00. The view offers the official links and keeps song selection available. [Main 7clouds uploads](https://www.youtube.com/playlist?list=UUNqFDjYTexJDET3rPDrmJKg)

The arcade added 18 games and now offers 1,035 in-page titles. Tested Terrace Workshop's complete game loop on a 320-pixel view with external requests disabled. Live WebKit confirmed representative Tapamine games, Voxelia, and Annex respond inside the playback sandbox. Territorial.io loaded its game canvas and visible controls. Bloxd.io and Geometry Dash lead to related in-page games, with a link to RobTop's official demo on the Geometry Dash page. [Game sources](catalog-recovery.md)

## In-page game expansion and main 7clouds uploads

The library preserves all 563 earlier records and adds 988 play entries, for 1,017 in-page titles in total. Each added game was checked against an exact publisher or creator URL. The catalog excludes duplicate titles and inspected addresses with frame restrictions. [Game sources](catalog-recovery.md)

Representative live WebKit checks used the arcade's sandbox with TLS verification enabled. In-game input changed the rendered game for Rally Legend, Stacktris, Drift Track, and Black Box. Tower of Hanoi recorded a move, Bubblenado started from a touch input, and Drift Racing's dashboard showed 35 km/h after the race started. Word Hive and Solitaire opened playable boards. These checks kept the parent page and tab stable. Hosted titles rely on the publisher and the player's connection.

Music loads the main 7clouds public uploads playlist. Browser fixtures covered on-demand loading, player status, closing the player, and redirects from earlier channel routes. The live main playlist displayed an upload in WebKit, where YouTube media requests returned HTTP 403 and playback stalled. The link to the full playlist remained available. [7clouds uploads](https://www.youtube.com/playlist?list=UUNqFDjYTexJDET3rPDrmJKg)

## Earlier direct play and channel picker release

The Music picker includes all 43 handles on the official 7clouds roster. Official YouTube oEmbed responses confirmed an uploader match on a representative video for each handle. The in-page player uses the corresponding uploads playlist. In live WebKit checks, the main playlist loaded its first entry but media requests returned HTTP 403. Rock’s player said the video was unavailable. Both channel links remained available. [Official 7clouds roster](https://7clouds.org/) · [YouTube embedding help](https://support.google.com/youtube/answer/171780)

The real Territorial.io player opened inside the arcade from a direct play link. WebKit opened Custom Scenario on the arcade page and a separate guest test reached the battlefield. HexGL’s live Start menu reached its continue prompt. The 3D race was outside the verified path. Blocked-frame fixtures verified retry, neutral playback status, same-tab alternatives, and keyboard focus. [Territorial.io terms](https://territorial.io/terms) · [HexGL project](https://github.com/BKcore/HexGL)

All 38 unit tests, 21 gateway tests, and 97 Chromium cases passed across the full run and two isolated timeout retries. Nine focused cases passed in each of Firefox and WebKit. The exported Pages package passed 25 route checks at four widths and 14 further rounds that exercised all 43 channel-to-playlist mappings alongside direct game links.

## Modes, in-page play, and learning collections

| Area | Verification |
| --- | --- |
| Home modes | Arcade, School, Gaming, Watching, and Library remember the selected view after reload. The School topic form, Gaming’s filtered search, Watching’s recently added media, and Library’s saved games lead to the corresponding routes. Keyboard switching retains focus. |
| Colors and resizing | The ten palette previews update the site immediately. The four new game backdrop presets save independently. Retested all modes and Settings on a 320-pixel display with text enlarged to 200%. |
| Game destinations | Inspected the rendered details for all 563 catalog IDs and 83 aliases. All 561 earlier records were preserved. Started 25 local games and opened both documented Fancade players with fixtures. The other 536 titles offer in-page alternatives. |
| Proxy Gemini and Google | Coolmath, Miniplay, Poki, and recognized game URLs lead to arcade options. Tested that opening the Coolmath choice makes zero portal requests. Configured Google results retained their sandbox, routed a known game to its catalog card, and opened an ordinary article in the viewer. |
| Learning games | Completed Fraction Kitchen’s four orders and Clock Courier’s five stops in the game logic. Chromium checks covered keyboard controls and direct touch play on slices, clock numbers, and the minute ring. |
| Web Search, AI Mode, and Blip | Curated references work with the external lookup unavailable. Draft in AI Mode keeps the search and in-progress answer in the same tab and waits for the user to submit. Tested partial comparisons, exact math, study and programming guides, and fallback from a simulated gateway outage. |
| Movies and YouTube | The library gained 29 complete films and 131 verified YouTube entries, including 57 Shorts. Checked publisher metadata and representative complete-film manifests. Browser playback checks used provider fixtures. |

All 38 Node unit tests, 21 gateway tests, 94 Chromium tests, and 36 focused WebKit tests passed. All 34 focused Firefox cases passed across the initial suite and a targeted timeout rerun. The Chromium layout case also passed in isolation after timing out under concurrent load.

The final package passed 900 combinations of mode, palette, and width from 320 to 1920 pixels across Chromium, Firefox, and WebKit. One parallel Firefox pass timed out in School search. All 300 Firefox cases passed on the isolated repeat. The package opened 25 destinations under `/gamefor-ffun/` at four widths without overflow or first-party errors. An automated accessibility scan reported zero violations across 184 states. Session-only mode switching, colors, and game launch also worked when browser storage was denied.

The final package completed 70 navigation rounds over about 35 minutes across the three browsers, with 14 rounds for each mode and zero first-party errors. Ten additional Firefox checks of School search, Back, reload, and enlarged text passed.

The real pinned CPU model answered a question carried from School search into AI Mode. It produced the relevant answer after about 62 seconds on the successful run. An earlier attempt timed out during concurrent browser testing. Hosted AI and third-party playback were verified with fixtures. The Sites preview relay did not start, so browser checks ran against the repository and exported static package.

## Home, game colors, and search refresh

| Area | Verification |
| --- | --- |
| Home | At 320, 390, 768, 1440, and 1920 pixels, the home page fits without horizontal overflow. Tested the eight shortcuts, the keyboard skip link, Pocket Circuit from its featured card, the mobile drawer, and all 561 catalog cards. |
| Watch and listen | The Home media region loads as it approaches the viewport. Clicked through to the film detail, music and gaming players. Missing artwork leaves a text card, and catalog failures leave links to the media sections. |
| Personalization | Checked six site themes, four game color presets, custom colors, image upload and removal, and preference restoration after reload. Custom images and colors stay in the browser. |
| Clover Roll | Cleared all four boards through the browser player. Tests cover keyboard play, touch controls, undo, and board descriptions. Game art was captured from the running puzzle. |
| Proxy Gemini | Tested the searchable in-page game picker, publisher-blocked previews, original links, retry, and switching to a local game. Tab buttons support arrow navigation and Delete. |
| Web and AI Search | Tested recent-query replay and clearing across tabs, address exclusion, follow-ups after canceled and failed requests, local unit conversion and guides, restricted citation links, CPU session cleanup, and explicit hosted streaming with fixtures. |
| Blip | Tested recent-turn context packing, mode-specific generation limits, streaming completion, and the continuation prompt. The pinned CPU model streamed a basic answer, recalled a game name from a previous turn, and produced valid JavaScript for a short Code request. It gave three presentation practice tips in Think mode in 36 seconds. An earlier longer local prompt timed out in the test run. Hosted response checks used fixtures. |

All 27 unit tests, 21 gateway tests, 77 Chromium browser tests, and 21 focused tests in each of Firefox and WebKit passed. The static package opened 25 destinations under `/gamefor-ffun/` at 320, 390, 768, and 1440 pixels without first-party HTTP errors, JavaScript exceptions, or horizontal overflow. The gateway passed a Wrangler deployment dry run.

An extended check completed 61 rounds over 32 minutes in Chromium and Firefox on the release candidate. The final static package completed 21 rounds over 10 minutes in Chromium, Firefox, and WebKit. Both runs rotated screen widths and themes and exercised Home media, local game launch, the viewer, and search without first-party errors.

Automated accessibility scans covered 18 states across the Home palettes and controls in Settings, Play, Web Search, and Proxy Gemini. The final scan reported zero automated violations for those states.

## Family media, backgrounds, and online Blip

| Area | Verification |
| --- | --- |
| Family arcade | All earlier game records are preserved. Picnic Pack and Kite Breeze bring the catalog to 560 games, including 22 built-in titles. Unit tests solve their stages and exercise restart. Chromium covers keyboard play and touch controls. |
| Game backgrounds | Tested the game-page shortcut, the Pocket Circuit screenshot, selection across a reload, an invalid upload, and saving and removing a local image. At a 320px viewport the settings and player fit the screen. |
| YouTube and lyrics | The 44 additions bring the curated video catalog to 1,397. Chromium verifies MrBeast name variants, full-video and Shorts result sets, and the player routes. Watch Lyrics now has 84 uploads. Tests check the retained chart workflow and the Hall of Fame player from 7clouds Rock. |
| Full family films | The 17 additions include eight features and nine complete shorts. Tests cover Family view ordering, licensed destinations, NFB embed routing, offer expiration, and the distinction between trailers and full films. |
| Proxy Gemini | Tested a separate viewer tab from a search result, share and clipboard fallback, saved YouTube start times, provider disconnect, and the link to open search provider setup. |
| Blip | Worker and browser fixtures cover opt-in hosted streaming, provider selection, aborted replies, usage limits, and local-only attachment conversations. The Wrangler dry run packages the optional Workers AI gateway. Live inference needs a deployed Worker and authorized access. |

Player checks in Chromium used controlled provider responses. Source checks established film availability and official YouTube metadata at review time. Tubi availability depends on region and licensing windows, and YouTube playback depends on the uploader's current settings. [Media sources](media-sources.md) · [Hosted chat setup](../server/README.md)

All 22 arcade unit tests, 20 gateway fixtures, and 66 Chromium tests passed. The static build opened 25 destinations under `/gamefor-ffun/` at widths of 320, 390, 768, and 1440 pixels without first-party HTTP errors, JavaScript exceptions, or horizontal overflow.

## Entertainment expansion

The starting release used static HTML, CSS, and JavaScript on GitHub Pages with an optional Cloudflare Worker. The baseline checks passed. The biggest gaps were the small film and music catalogs, separate saved lists, limited video search continuation, and a viewer with no connected search results. The expansion was developed separately from the published `main` branch.

| Phase | Changes and verification | Remaining conditions |
| --- | --- | --- |
| 1. Navigation and game loading | Kept the existing routes and built-in players. Checked the standalone entry, loading, fullscreen, mobile menu, filters, and Back route. Game pages now show related picks and available descriptions. | Full external gameplay depends on each publisher. |
| 2. Catalog and artwork | Preserved all 558 game records, including the 548 recovered entries. Rendered and checked every card across 24 library pages. Existing source and artwork attributions are retained. | Two listings still lack a verified game URL. Artwork falls back to a title card when the source has no usable image. |
| 3. Blip | Added Code, Creative, and Games modes, collapsible history, a theme setting, shortcuts, safer table and equation rendering, and Ask Blip drafts. Browser tests exercise streaming, cancellation, history, files, and hosted research fixtures. Real CPU inference ran in Chromium using pinned model weights and generated a streamed reply with a factual error. | Answer quality depends on the model. A live hosted model needs a gateway and provider credentials. WebGPU did initialize with the test machine’s software adapter, but did not finish a reply in the test window. Voice and image generation are unavailable. |
| 4. Movies | The 146 listings include 134 complete films and 12 trailer or release listings. The catalog adds 98 complete films, including 21 features. Dedicated pages show related films, artwork, runtimes where available, favorites, and watchlists. Tested provider fallback and confirmed playback resume. | Availability depends on each provider and region. Four retained NFB films carry region notices. Resume requires an embedded player that reports playback progress. |
| 5. Music and YouTube | Expanded to 311 music uploads and 1,353 curated YouTube entries. Tested artist and genre filters, chart credits, playlist persistence, saved tracks, fullscreen, Shorts, and local incremental loading. Connected video tests exercise page tokens, repeated-token protection, and deduplication. | Connected YouTube searches require a configured service and use provider quota. Official metadata checks establish the listed uploads and source links. Embedded playback varies. |
| 6. Search and Proxy Gemini | Tested exact game, film, and track results, search history, fullscreen, state restoration, canceled searches, provider previews, and the Ask Blip handoff. External frames use the browser’s sandbox and security policies. | Live web results need a configured Brave Search gateway or Google Search Engine. Separate Images and News tabs need a supported provider. |
| 7. Saved library | Checked unified search, home preferences, saved and recently played games, films, playlists, and chats. Played history relies on supported provider signals. | Activity and chat data live in the current browser. Clearing its site storage clears saved information. |
| 8. Deployment | Tested static project-relative assets, legacy links, and Android-sized, tablet, and desktop layouts in Chromium. | GitHub Pages can serve the static files. An optional hosted gateway is a separate deployment. |

The Chromium fixtures exercise external player behavior under controlled success, error, and blocked states. This test environment encountered certificate errors during live embed attempts. Publisher catalog, artwork, and player checks are documented separately. [Media sources](media-sources.md) · [Gateway setup and costs](../server/README.md)

### Release checks

All 17 arcade unit tests, 17 gateway tests, and 57 Chromium tests passed. The Wrangler dry run packaged the optional gateway. The extracted static ZIP served correctly under `/gamefor-ffun/`. A separate check visited 25 destinations at widths of 320, 390, 768, and 1440 pixels with no first-party HTTP errors, JavaScript exceptions, or horizontal overflow. Film and music catalogs loaded after navigation or scrolling to their Home shelves.

## Previous release audit

### Audit findings

Gamefor Ffun uses plain HTML, CSS, and JavaScript with optional provider services behind a Cloudflare Worker. The two legacy entry files were blank. The mobile drawer allowed focus into the covered page, and navigating back from Settings could leave the clear-saved-games dialog open. Fullscreen hid the game player’s exit control and could leave keyboard focus outside the game. Removing the last favorite produced a search error message.

Proxy Gemini lost game state on tab switches, made a stale preview request on some deep links, and could erase an address error when an earlier frame finished. The film player treated an iframe load event as confirmed playback, even when NFB delivered a region notice. The media library could keep old service results after editing its search. Some local games lost keyboard focus or ignored quick taps on their controls.

The update preserves the 558-entry catalog, game IDs, native site routes, and existing content. Legacy links now preserve their query and game route. The drawer contains focus, the confirmation closes on navigation, the game player keeps an exit button and keyboard control, and Proxy Gemini keeps a tab's page when switching. Media routes distinguish a usable player from an unconfirmed embed and offer the official destination.

### Checks passed

The release suite includes 16 Node tests, 15 gateway tests, and 39 Chromium tests. Independent checks covered the local game inputs, the full paginated catalog, authorized and blocked frames, mobile layout, and gateway setup in a local Worker runtime.

| Area | Coverage |
| --- | --- |
| Catalog | All 558 game cards across 24 pages, including the 548 recovered entries. Preserved the 551 titles in the earlier workspace ZIP and all later originals. Checked IDs, categories, titles, aliases, and availability. |
| Artwork and sources | 555 matched images and three title-card fallbacks. Added eight gameplay screenshots and twelve publisher or distributor images. Verified missing-image treatment, 536 URL responses, and 78 source pages by title. |
| Library | Featured games, search with varied queries, category and play filters, sorting by name/category/local launches, pagination and Back state, favorites, recently played, new games, and Random Game. |
| Player | All 20 built-in entries started and restarted in Chromium. Exercised keyboard and pointer input, six 390px touch cases, missing Canvas recovery, timer cleanup, and fullscreen entry, exit, and keyboard focus. Traced publisher embed URLs and direct links for the two documented Fancade players. |
| Navigation | All 19 sidebar destinations and layouts from 320px through 1440px. Checked menu keyboard focus, Close and Escape, responsive artwork, modal dismissal, legacy URLs, preferences, and application errors. |
| Proxy Gemini and Web Search | Preview and fallback links, browser-enforced frame restrictions, address errors, tabs and state, Back/Forward/Refresh/Home, fullscreen, Google’s sandboxed result frame, AI Help, and essay results. **Games you can play here** lists 20 local games and two approved embeds from Google and Proxy Gemini. |
| YouTube and movies | Search and filtering, 1,253 videos, Shorts pagination and player cleanup, correct trailer and full-film destinations for 48 films, provider fallback, and mobile playback controls. Official movie YouTube metadata was checked separately. |
| Blip and gateway | Saved chats, model setup and retry, local attachments, hosted SSE and queries with fixture responses, consent and access-code checks, disabled browser storage, Unicode budgets, timeouts, and streaming failures. Wrangler dry-run and local HTTP checks passed. |

### Verification limits

- The user upload is a written brief. Catalog reconciliation uses the GitHub and Base44 records and the earlier upgrade archive available in the workspace.
- HTTP responses verify link reachability. The catalog has 20 built-in games, two documented embed routes, 534 external game-page entries, and two entries awaiting a verified play URL. The external game sessions remain unverified.
- The browser enforced the blocked-frame test policy. YouTube, Blender, and NFB browser playback checks in this environment encountered TLS trust errors and used controlled provider responses to test the application. Four NFB URLs served regional notices during the official link audit.
- Hosted provider integrations were tested with fixtures and an authorized local gateway. Live hosted credentials, account quotas, and billing require the operator’s own provider configuration.
