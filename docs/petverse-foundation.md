# Petverse Online foundation

## Open the development build

Run `npm run dev` from this branch of Gamefor Ffun and open [Petverse in the arcade player](http://127.0.0.1:3000/#play/petverse-online?start=1). Search for **Petverse Online** in the arcade to reach the same player from its catalog card. A browser with WebGL 2 can render the meadow. The source includes the Three.js renderer and its MIT license. The catalog thumbnail was captured inside the game.

Walk with WASD, the arrow keys, or the on-screen arrows. Drag to rotate the camera, scroll to zoom, and press Space to jump. Press F or use the contextual button when you approach a resource or station. Sunbeams pay for eggs and most upgrades. Crystals expand the habitat. Both eggs show their actual species weights, and the nursery lists the separate variant probabilities.

## Collection and settings

- Sunstep Meadow contains two egg pools, 20 modeled species, seven rare variants, resource nodes, and a workshop. The journal records discovered species and variants. Pets can be equipped, favorited, locked, traded online, and released with confirmation if they are eligible.
- Auto Hatch unlocks at Level 2. Multi-Hatch and Auto Collect unlock later. Every egg has a cost. Stop When Shiny, the other variant stops, new discoveries, and inventory rules apply to the result of each paid hatch. A full habitat pauses or stops the session according to its setting. Running out of Sunbeams always stops it.
- Auto-hatch starts on request each session. A running session offers Pause, Resume, Stop, and editable stop rules. Notification preferences affect alerts and sound. Stop preferences control hatching.
- Graphics quality changes the renderer resolution and workload. Particle density, motion, glow, names, and collection numbers affect the rendered scene. Separate audio controls cover original synthesized music, meadow ambience, hatching, gathering, notifications, and interface cues. Audio activates on the first input.

## Saving and multiplayer

Solo progression and presentation preferences save in the browser. The optional Node.js server makes shared meadow sessions real. It validates movement and gathering range, draws each online hatch, and keeps online progression in SQLite. Guests resume an existing online account using the saved credential for that server. A trade requires both players to accept the current offer revision and saves both inventories in a single transaction. The room shows each explorer’s lead equipped companion.

The development branch uses the normal GitHub Pages project path for its static files. The shared room needs a separately running service with a durable database and an HTTPS WebSocket endpoint. Local testing on an existing machine has no hosting subscription. Hosted costs depend on the machine, backups, and traffic. [Backend setup and pilot limits](../petverse-server/README.md)

## Run the tests

```sh
npm ci
npm test
npm --prefix petverse-server ci
npm --prefix petverse-server test
npx playwright install chromium
npx playwright test tests/browser/petverse.spec.js
npx playwright test --config petverse-server/playwright.config.mjs
````

Set `ARCADE_CHROMIUM` to a compatible installed Chromium to use it for either Playwright suite. The browser tests open the in-arcade game and use local WebGL rendering. The online test connects independent browser profiles to a real loopback service and a temporary SQLite database.

## Verification for this build

- 72 unit tests passed. The 11 Petverse model tests cover paid hatches and odds, variant stop rules, inventory and currency limits, upgrades, resource cooldowns, protected releases, saves, and trades.
- The 177-test arcade Chromium suite passed. Petverse browser checks cover movement into gathering range, hatching, persistent collection and preferences, a paid Auto Hatch upgrade, and pausing and resuming a real hatch sequence. They also verify the change in render resolution and that hatching stays off after refresh.
- Five backend tests and a two-browser gameplay test passed. The two browsers joined the same meadow, both confirmed a trade, and a guest recovered its SQLite balance and inventory after a server restart. The backend tests also exercised a failed database write and verified rollback of both trade sides.
- The static package loaded the game under `/gamefor-ffun/`, hatched a pet, and kept the save after a refresh at 390 pixels wide. Separate checks covered 320px through 1440px and fullscreen entry and exit. The managed hosted preview relay timed out. The packaged preview runs locally.

## Next phase

Replay the first progression levels with more players and tune resource pacing, hatch rewards, and encounter readability. Verify the first approved hosted room under real network conditions and load before inviting more players. Build collection milestones and cooperative tasks in the meadow, then add a second explorable region with its own art, resources, and pets.
