# Petverse Online — Rebirth Cave

## Play the expansion

On the development branch run `npm run dev` and open [Petverse in the arcade player](http://127.0.0.1:3000/#play/petverse-online?start=1). **Play Solo** works with the static site. The **Create Private Server** and **Join With Code** controls connect to a separately running Petverse server. Friends enter the same WebSocket endpoint and the host's code. [Backend setup and pilot limits](../petverse-server/README.md)

## Gather and hatch

Harvest a resource near your equipped companions, then stand within magnet range to pull the reward toward you. A starter magnet has a 3.3-range pickup radius. The workshop shows current range and attraction speed and previews the radius in the meadow. Magnet upgrades change the accepted pickup range, attraction speed, or payout. Rewards expire after 30 seconds and can be credited once.

New Titanium companions are three times standard size. Their oversized formation keeps them farther from the player and uses a metallic finish and heavier motion. Titanium still has a published 0.1% variant chance. Its discovery sound, animation, notifications, and auto-hatch stop rule are separate controls. The graphics menu controls visibility of other players' Titanium pets.

## Rebirth and collections

Find the stone trail to the cave on the far side of the meadow. The first rebirth requires Level 3, 95 Sunbeams, and 4 Crystals. Confirm the offering at the altar to earn Ascension currency, a permanent gathering and magnet bonus, and access to Emberdeep. Pets, discoveries, XP, and purchased upgrades carry forward. The Ember Geode egg adds five species to the existing twenty.

The Meadow Journal records each generation, collection score, and achievement progress. Claim earned achievements to receive Ascension for permanent workshop upgrades. The ranking pavilion and Journal open the same leaderboard. It ranks verified statistics from the current private room. Solo players can inspect their personal score.

## Development and deployment

The static preview can run under the GitHub Pages project subdirectory with its original models and self-hosted WebGL dependencies. Private rooms were built for a separate Node.js server and a durable SQLite database. Room codes expire on a server restart, and guest profiles survive. Online progression is earned and validated separately from solo progression.

Use the expansion version of both the browser and the server for private play. The invitation handshake is part of this release. The existing SQLite profile and solo save schemas carry forward.

## Verification

- 78 unit tests, 24 gateway tests, and eight Petverse server tests passed. They cover old saves, paid hatch and variant stop rules, position-checked pickups, one-time rewards, rebirth, achievements, invite expiry, isolation, and trade rollback.
- The full arcade browser run passed 179 of 180 checks. The cave walkthrough's automated movement overshot the trail under parallel load. The test now centers on the trail before entering the cave. It passed two consecutive reruns and a six-test Petverse run with two workers.
- Two independent Chromium profiles joined the same private room through the arcade. They verified invalid-code handling, private code visibility, live movement, a completed trade, room hatch rankings, and restoration of a guest save after restarting the server.
- The solo browser tests followed actual movement to the Rebirth Altar, completed an offering, hatched a Generation 2 pet, claimed the achievement, and restored progression after reload. An independent WebGL check measured Titanium at 3× normal height and verified its spacing, peer visibility, and magnet pickup.
- The packaged frontend opened under `/gamefor-ffun/` at 320px, kept the old foundation save, recorded a new hatch, showed the solo score, and opened zero WebSocket connections. A separate Chromium check entered and exited leaderboard fullscreen and returned to the meadow.

Further expansion can build on a hosted room pilot, collection balancing, and a second full explorable region. Additional rankings that span rooms, a friends system, and total playtime need their own saved data and privacy rules.
