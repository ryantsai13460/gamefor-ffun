# Platformer library expansion

Open **Games Like OvO** from the Home play panel, the navigation, or Categories. The collection has 26 listings, with 19 configured for in-page play. Related collections cover Platformers, Speedrun Games, Parkour Games, Puzzle Platformers, and Hard Platformers. Use **Play option** to narrow to in-page games and **Random Platformer** to launch one from the current results.

Search indexes title, category, known aliases, and reviewed gameplay tags. Recently added ordering uses the dates in the catalog. Challenging first uses the reviewed challenging tag wherever applicable. Clicking an in-page card in a collection opens the corresponding game player. Player controls, when documented, appear beside the game. Back preserves the collection and search, and the player has fullscreen and a retry action.

## Inventory

| Scope | Built in | Authorized in-page player | Official external page | Unverified | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Entire catalog | 28 | 1,060 | 531 | 3 | 1,622 |
| Added in this branch | 1 | 11 | 8 | 0 | 20 |
| Games Like OvO | 2 | 17 | 7 | 0 | 26 |

All 1,602 pre-expansion game IDs, source and player URLs, and availability values were checked against the merged baseline. The expanded catalog keeps them and adds 20 distinct records.

## New in-page games

- **Beacon Ascent** is an original platformer with three mountain courses, wall jumps, rechargeable air dashes, checkpoint recovery, and saved best times. It uses the arcade's local game runner and has official artwork captured from the game itself.
- **Moss Moss** and **To a Starling** use the exact Lexaloffle widgets that their authors enabled. WebKit loaded the correct PICO-8 start screens in the arcade sandbox. Their keyboard actions come from the authors’ documentation. [Widget permissions](https://www.lexaloffle.com/bbs/?pid=59457) · [Moss Moss](https://www.lexaloffle.com/bbs/?pid=mossmoss-17) · [To a Starling](https://www.lexaloffle.com/bbs/?pid=112422)
- **TETHER, Blip’s Grove, Ninja vs Evil Corp: Rage Run, Stolen Sword, Jumping Journey, Euphrosine Wants Ten Dots, Super Bunny Strikes Back!, The Melon Man, and VectraClash** use the authors' published browser builds. The catalog records each source and license. [Creator-hosted catalog](../assets/platformer-games.js)

## Official browser pages

Each of the eight requested titles below has an official browser listing on itch.io. Those pages restrict embedding to itch.io, so the arcade links to the author's page. The original CELESTE Classic cartridge also explicitly disables embedded playback. [CELESTE PICO-8 release](https://www.lexaloffle.com/bbs/?tid=2145)

| Game | Official browser page |
| --- | --- |
| CELESTE Classic | [Maddy Thorson and Noel Berry](https://maddymakesgamesinc.itch.io/celesteclassic) |
| Tricky Keys | [Team Bugulon](https://saturnyoshi.itch.io/tricky-keys) |
| Deepest Sword | [Cosmic Adventure Squad](https://cosmicadventuresquad.itch.io/deepest-sword) |
| Pikwip | [Cookiecrayon](https://cookiecrayon.itch.io/pikwip) |
| Alpine | [Oddly Shaped Pixels](https://oddly-shaped-pixels.itch.io/alpine) |
| Frogfall | [Kultisti](https://kultisti.itch.io/frogfall) |
| Platformer Toolkit | [Game Maker's Toolkit](https://gmtk.itch.io/platformer-toolkit) |
| Mobility! Accessible Precision Platformer | [Auroriax](https://auroriax.itch.io/mobility) |

## Testing and limits

- Beacon Ascent passed keyboard and 320px touch tests in Chromium and WebKit. Its game-logic tests completed all three courses and exercised checkpoint recovery.
- The nine creator-hosted games reached their gameplay screens in live WebKit tests. Jumping Journey needed Tab and Enter to start at the tested size. The Melon Man responded to movement and jump input with a WebKit audio error. The two PICO-8 widgets reached their branded start screens, with gameplay input still unverified.
- Mochi and the Midnight Escape stayed on its title screen during live keyboard tests. Its author-hosted build was excluded from the release.
- Automated checks cover catalog integrity, stable approved player URLs, the Play Here filter, keyboard movement and retry, mobile collection navigation, and fullscreen using a publisher fixture.
- The collection can grow toward 50 as more original or author-approved versions are checked. Access to a publisher's player depends on the user's device and network.

## Preview and deployment

The development branch uses the static GitHub Pages layout. Serve the exported preview under the `/gamefor-ffun/` project path. These commands build and serve the same package from the checked-out branch.

```sh
git archive --format=zip -o gamefor-ffun-platformers.zip HEAD .nojekyll index.html catch-the-star.html pro.html index.html.index.html assets
mkdir -p preview/gamefor-ffun
unzip gamefor-ffun-platformers.zip -d preview/gamefor-ffun
python3 -m http.server 8080 --directory preview
```

In the preview, open `http://127.0.0.1:8080/gamefor-ffun/#games?collection=like-ovo`. A reviewed merge to `main` publishes the release through the existing GitHub Pages setup. The previous site checkpoint is commit `55d8886`. [Baseline](https://github.com/ryantsai13460/gamefor-ffun/commit/55d888646f6285f3dd9262b258cda06d0a50d075)
