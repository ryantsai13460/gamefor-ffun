# Petverse Online multiplayer

Petverse can connect to a separate Node.js process for a shared meadow. The process accepts player actions over WebSocket and uses SQLite for accounts, currency, inventory, unlocks, and generation preferences. Each device's solo game uses its own save.

## Try two players locally

Start Gamefor Ffun from the repository root with `npm run dev`. In a second terminal run the commands below with Node.js 22.13 or later.

```sh
npm --prefix petverse-server ci
PETVERSE_CLIENT_ORIGINS=http://127.0.0.1:3000 npm --prefix petverse-server start
```

Open Petverse in two independent browser profiles. Connect each one to `ws://127.0.0.1:4893/v1/petverse`. Move and equip a pet on one device to see the changes on the other. Reconnect using the same browser profile to resume its online inventory.

Keep the two browser profiles separate during the test. An online explorer can occupy one session at a time. Protect the browser's resume token as an account credential. The database stores its hash. Retain the token and restore the same database to recover the save after migrating the server.

## Host an approved pilot

GitHub Pages can serve the game's HTML, JavaScript, and graphics. The live room and persistent database need a separate running Node.js server. The supplied process listens on IPv4 loopback with a default port of `4893`. Install it on a machine you administer. Set `PETVERSE_CLIENT_ORIGINS` to the exact approved frontend origin, such as `https://ryantsai13460.github.io`, and set `PETVERSE_DB_PATH` to a durable local path outside the published site. Configure an HTTPS reverse proxy for `/v1/petverse` and connect through its `wss://` address.

Run one Petverse process per database. Use an unprivileged service account and keep the SQLite file and its sidecar files private. Back up the database using SQLite's backup support or take a copy while the process is stopped. For public traffic, apply connection throttles at the HTTPS proxy and monitor memory, disk growth, and transfer. The current configuration admits 16 concurrent explorers in one meadow and stores up to 1,000 profiles. Running on an existing compatible machine requires no hosting subscription. A hosted VM and its storage, backup, and transfer charges depend on your provider and traffic.

The process validates movement and proximity to resources, applies the same collection rules as solo mode, and draws each online egg on the server. Successful action IDs are stored alongside their results so recent retries use the saved receipt. Trades require current consent from both explorers. Changing an offer resets confirmations and a disconnect cancels an unfinished trade. The final exchange rechecks inventory and commits both saves in one transaction.

## Run verification

```sh
npm --prefix petverse-server ci
npm --prefix petverse-server test
```

The tests open real loopback connections, check authorized rewards and trade consent, exercise failed writes, and restart SQLite to confirm that inventory and preferences persist.
