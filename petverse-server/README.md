# Petverse Online multiplayer

Petverse can connect to a separate Node.js process for invitation-only meadows. The process accepts player actions over WebSocket and uses SQLite for guest accounts, inventory, upgrades, achievements, generations, and progression. The browser keeps a separate solo save.

## Try two players locally

Start Gamefor Ffun from the repository root with `npm run dev`. In a second terminal run the commands below with Node.js 22.13 or later.

```sh
npm --prefix petverse-server ci
PETVERSE_CLIENT_ORIGINS=http://127.0.0.1:3000 npm --prefix petverse-server start
```

Open Petverse in two independent browser profiles. In the first, choose **Create Private Server**, enter `ws://127.0.0.1:4893/v1/petverse` and create your meadow. Copy its invitation code. In the second browser, choose **Join With Code** and enter the same endpoint and code. Move, collect, and trade inside the private meadow. Reconnect from the same profile to resume its online inventory.

Keep the browser profiles separate during the test. An online explorer can occupy one session at a time. The database stores a hash of the browser's resume token. Retain the browser profile and database to recover the save. A server restart closes the rooms and keeps saved guests. Create a new room and share its new code after a restart.

## Host an approved pilot

GitHub Pages can serve the game's HTML, JavaScript, and graphics. The live room and persistent database need a separate running Node.js server. The supplied process listens on IPv4 loopback with a default port of `4893`. Install it on a machine you administer. Set `PETVERSE_CLIENT_ORIGINS` to the exact approved frontend origin, such as `https://ryantsai13460.github.io`, and set `PETVERSE_DB_PATH` to a durable local path outside the published site. Configure an HTTPS reverse proxy for `/v1/petverse` and connect through its `wss://` address.

Run one Petverse process per database. Use an unprivileged service account and keep the SQLite file and its sidecar files private. Back up the database using SQLite's backup support or take a copy while the process is stopped. Apply per-client connection limits at the HTTPS proxy because the loopback service sees the proxy's address. The default process admits 16 concurrent explorers across its private meadows and stores up to 1,000 profiles. Hosts can rotate a code or close a room. Active rooms expire after 12 hours, and empty rooms expire after 5 minutes. Running on an existing compatible machine requires no hosting subscription. A hosted VM and its storage, backup, and transfer charges depend on your provider and traffic.

The process validates movement, gathering distance, pickup range, and altar proximity. It draws each online egg on the server. Shared resource cooldowns and leaderboards belong to the connected room. Successful action IDs retain recent receipts. Trades require current consent from both explorers in the same room. Changing an offer resets confirmations and a disconnect cancels an unfinished trade. The final exchange rechecks inventory and commits both saves in one transaction.

## Run verification

```sh
npm --prefix petverse-server ci
npm --prefix petverse-server test
```

The tests open real loopback connections, check invite limits and room separation, check authorized rewards and trade consent, exercise failed writes, and restart SQLite to confirm that player progress persists. From the arcade repository root, run `npx playwright test --config petverse-server/playwright.config.mjs` for the two-browser integration test after installing both packages and Playwright Chromium.
