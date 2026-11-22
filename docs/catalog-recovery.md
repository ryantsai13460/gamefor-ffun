# Game catalog

The catalog combines the preserved records in `assets/catalog.js` with the supported players in `assets/publisher-games.js`, `assets/indie-racing.js`, and `assets/open-web-games.js`. The library derives its counts from those records. Each entry has a stable ID, title, and category. The game detail distinguishes built-in games, publisher-approved players, and catalog-only records.

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
| **Preserved games and original built-in additions** | **563** |
| Fancade shared players | 808 |
| GameLake original games | 74 |
| Simon Tatham's Portable Puzzle Collection | 40 |
| 360 PlayZone original games | 38 |
| Tibo Games | 11 |
| Upload Arcade original games | 9 |
| Featured indie racers and arcade games | 4 |
| Independent creator-hosted games | 4 |
| Terrace Workshop | 1 |
| Tapamine original games | 13 |
| Voxelia, Annex, PULSEGRID, and Rhythm Forge | 4 |
| **Current searchable catalog** | **1,569** |

The GitHub source is commit [`4deda5c`](https://github.com/ryantsai13460/gamefor-ffun/tree/4deda5c1ce9058184123d85792198fee5bc09a7c). Memory Match came from commit [`41ea241`](https://github.com/ryantsai13460/gamefor-ffun/commit/41ea241). The [public Base44 library](https://proxy-arcade-play.base44.app/library/games) supplied 58 records, including six titles already in the GitHub catalog. Slither.io appears in both Base44 sources and counts once. The [Base44 homepage](https://proxy-arcade-play.base44.app/) also lists Minecraft Classic and Suika Game, which are absent from both main libraries. Suika Game is the commercial original, with a separate listing from Suika Game: Merge Fruits. Catch the Star is the standalone clicker, while Catch the Stars is the built-in falling-stars game.

The 548 entries from the GitHub and Base44 libraries form the recovered set within the 563 preserved games. Stable IDs keep existing favorites, recent games, and links working.

## Links and artwork

Catalog-only entries retain their HTTPS publisher or distributor records. Their detail pages and Play Hub point to in-page alternatives. Fancade and Stacktris use the documented embed where the publisher allows it. [Fancade player documentation](https://www.fancade.com/wiki/Fancade_Web#Embedding)

Territorial.io and HexGL open from their original HTTPS game addresses in a sandboxed frame. Territorial.io’s terms describe permitted fan sites, and HexGL’s author publishes the game under MIT terms with listed asset exceptions. These links use the original services. [Territorial.io terms](https://territorial.io/terms) · [HexGL source and license](https://github.com/BKcore/HexGL)

Fancade documents embedding shared play links. GameLake, Tibo Games, 360 PlayZone, and Upload Arcade publish their own embed codes. Added entries use those exact players and preserve publisher branding and credits. The source check covered HTTPS, the publisher's title and player identity, and frame permissions. Individual gameplay checks covered representative titles. [Fancade embed documentation](https://www.fancade.com/wiki/Fancade_Web#Embedding) · [Fancade category catalog](https://www.fancade.com/wiki/List_of_games_by_category) · [GameLake](https://gamelake.com/developers/) · [Tibo Games](https://tibogames.com/free-games-for-websites/) · [360 PlayZone](https://360playzone.com/embed-games) · [Upload Arcade](https://www.uploadarcade.com/embeddable-games)

The independent games use creator-hosted releases and keep their source and license credits. [Starter Kit Racing](https://github.com/mrdoob/Starter-Kit-Racing) · [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/)

Terrace Workshop loads its board and game logic directly from the arcade. Bloxd.io's page suggests Terrace Workshop and Voxelia. Geometry Dash's page links to RobTop's official browser demo and suggests playable alternatives including Dash by Tapamine. Territorial.io continues to use its official player and links to related strategy games such as Annex. [Tapamine's embed terms](https://tapamine.com/terms/) · [Voxelia](https://github.com/rahulatrkm/voxelia) · [Annex](https://github.com/GabrieleMaurina/annex) · [RobTop's browser demo](https://www.geometrydash.com/game/)

Artwork comes from game-specific publisher or distributor metadata or from captured gameplay of this site's local games. The preserved catalog has 560 artwork entries, including screenshots for all 25 built-in games. The catalog keeps source attribution and uses a title card when artwork is unavailable.

The source pass checked 536 distinct game-source URLs for an HTTP response and compared page contents for 78 titles. Artwork checks also compared 425 existing Miniplay image identifiers against their game pages. The reachability check establishes that a source responded. Test coverage for actual gameplay is recorded separately. [Verification report](qa.md)

Use stable IDs when editing entries so saved favorites and recently played games continue to work. Use `aliases` when consolidating duplicate records of the same release. Confirm the game title and version at the source before adding links or artwork. Keep related official pages separate from the game's own URL. Add an embed URL when the publisher provides it for reuse and the viewer can render it under the provider’s security rules.
