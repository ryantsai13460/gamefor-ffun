# Game catalog

The catalog lives in `assets/catalog.js`. The library derives its counts from the published records. Each entry has a stable ID, title, and category. The game detail distinguishes built-in games, publisher-approved players, and records without in-page play.

## Source inventory

| Source | Unique additions |
| --- | ---: |
| GitHub Pages library | 66 |
| First expansion, including Resent Client | 26 |
| 150-game expansion | 150 |
| 200-game expansion | 200 |
| 50-game expansion | 50 |
| UNDERTALE demo | 1 |
| Skyline Sprint and Pocket Circuit from the truncated local-games script | 2 |
| Standalone Catch the Star | 1 |
| Base44 games library | 52 |
| **Combined library records** | **548** |
| Two additional games from the Base44 homepage | 2 |
| Memory Match from repository history | 1 |
| **Total preserved in the searchable catalog** | **551** |
| Original built-in puzzles, Pattern Pulse and Sum Trail | 2 |
| Original arcade games, Comet Courier, Pinpoint Putt, and Beat Beacon | 3 |
| Harbor Dispatch and Tidal Rescue | 2 |
| Picnic Pack and Kite Breeze | 2 |
| Clover Roll | 1 |
| Fraction Kitchen and Clock Courier | 2 |
| **Current searchable catalog** | **563** |

The GitHub source is commit [`4deda5c`](https://github.com/ryantsai13460/gamefor-ffun/tree/4deda5c1ce9058184123d85792198fee5bc09a7c). Memory Match came from commit [`41ea241`](https://github.com/ryantsai13460/gamefor-ffun/commit/41ea241). The [public Base44 library](https://proxy-arcade-play.base44.app/library/games) supplied 58 records, including six titles already in the GitHub catalog. Slither.io appears in both Base44 sources and counts once. The [Base44 homepage](https://proxy-arcade-play.base44.app/) also lists Minecraft Classic and Suika Game, which are absent from both main libraries. Suika Game is the commercial original, with a separate listing from Suika Game: Merge Fruits. Catch the Star is the standalone clicker, while Catch the Stars is the built-in falling-stars game.

The earlier upgrade ZIP in the workspace contains 551 entries. Each retains its ID, title, category, collection, and original aliases. The 548 entries from the GitHub and Base44 libraries form the recovered set within the 563 total.

## Links and artwork

Catalog-only entries retain their HTTPS publisher or distributor records. Their detail pages and Play Hub point to in-page alternatives. Fancade and Stacktris use the documented embed where the publisher allows it. [Fancade player documentation](https://www.fancade.com/wiki/Fancade_Web#Embedding)

Artwork comes from game-specific publisher or distributor metadata or from captured gameplay of this site's local games. The catalog has 560 artwork entries, including captured gameplay for Fraction Kitchen and Clock Courier and artwork for all 25 built-in games. Resent Client, Blash.io, and Roams.io use title cards. The catalog keeps source attribution and the interface uses a title card if an image fails to load.

The source pass checked 536 distinct game-source URLs for an HTTP response and compared page contents for 78 titles. Artwork checks also compared 425 existing Miniplay image identifiers against their game pages. The reachability check establishes that a source responded. Test coverage for actual gameplay is recorded separately. [Verification report](qa.md)

Use stable IDs when editing entries so saved favorites and recently played games continue to work. Use `aliases` when consolidating duplicate records of the same release. Confirm the game title and version at the source before adding links or artwork. Keep related official pages separate from the game's own URL. Add an embed URL when the publisher provides it for reuse and the viewer can render it under the provider’s security rules.
