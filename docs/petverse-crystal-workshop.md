# Petverse Online Crystal Workshop

## Start playing

Run `npm run dev` from the Gamefor Ffun repository and choose **Play Solo**. The same play route is available inside the arcade. [Open the local Petverse build](http://127.0.0.1:3000/#play/petverse-online?start=1)

Your starter companion chooses nearby crystals automatically. Watch the pet travel to its target and see the health meter fall with each hit. When a crystal breaks, move within magnet range to collect its Gold and Crystal materials. Fresh crystals grow back at the same sites. Spend Gold on eggs and combat upgrades, then compare the results in **Pets**. **Equip best** uses damage, attack frequency, and travel speed to estimate farming performance.

| Field | Access |
| --- | --- |
| Sunstep Field | Available from the start, next to the arrival point |
| Fernwild Grove | Level 2 |
| Ember Verge | Level 3 and one rebirth |

The three fields contain five crystal families. Larger crystals can support more attacking pets. Two rare respawn tiers raise crystal health and yields. The stronger tier becomes available at Level 4 or after rebirth. Rare Crystal Luck improves spawn chances, and **Farming** lets you prioritize special crystals or choose another targeting strategy.

## Assign a team and run the crank

1. Open **Farming** while standing in a field and choose **Assign Pets Here**. You can also select any unlocked field and choose **Assign selected area**. **Follow Player** lets pets target near you again, while **Recall All Pets** sends them back to you and turns off automatic targeting.
2. At Level 2, buy **Remote magnet** for 90 Gold in **Upgrades**. It collects eligible Gold from your assigned field while you are outside ordinary pickup range. Magnet upgrades improve range, pickup capacity, speed, or yield. Earn **Auto Collect** and enable **Auto-Collect Gold Drops** in **Settings → Workshop** for additional local range.
3. Walk to the southwest workshop and press **E** at the crank, or open **Generator** nearby and choose **Start Cranking**. The gears turn, the charge meter fills, and your assigned pets keep mining. Use **Stop Cranking** or walk away to end the session. The Farming panel shows your active pets, crystals destroyed, and recent Gold per second.
4. Select an unlocked egg in **Generator** and spend a full charge to hatch it at the workshop. The charge lowers its Gold price by 20 percent before rounding up to the nearest whole Gold. Generator upgrades increase production or capacity, reduce the charge requirement, or add rebirth bonuses. The Fernwild compressor opens at Level 4, and the Emberdeep reactor opens at Level 6 after rebirth.

## Hatch, fuse, and save

The hatchery shows current species and variant odds, including purchased luck upgrades. **Settings → Stop rules** controls each rare form and discovery stop separately. Open **Pets → Fusion** to review three matching pets and the exact result before confirming. Equipped, locked, and favorite companions are protected. The Journal tracks crystal breaks, rare crystals, workshop milestones, achievements, and Rebirth Cave progression.

The update carries forward existing solo and online balances, collections, and upgrades. Gold uses the existing `wallet.sunbeams` save field. New uncollected Gold survives a reload and combines into one pile per crystal site. Stored generator energy and the chosen egg also persist. Auto Hatch and cranking require a fresh start after a reload or reconnect. The workshop settings control whether solo assignments persist and whether changing world modes recalls the team.

## Run private multiplayer

GitHub Pages serves the game client and the complete solo mode. Private play uses the matching Petverse Node.js server and a durable SQLite database. The server runs one crystal simulation per room and validates farming, magnet, generator, and fusion transactions. When teams share a crystal, its reward goes to the player whose pets dealt the most damage. Rankings use actual player progress in the private room. A server restart keeps player saves and closes the existing rooms. [Local two-player setup and hosting instructions](../petverse-server/README.md)

Additional full-sized regions and daily or weekly quests remain future expansion work.

## Verification

- 100 arcade unit tests, 24 service gateway tests, and 11 Petverse server tests passed.
- All 174 arcade browser checks outside Petverse passed, including the web search, Proxy Gemini, Blip, music, movies, and YouTube flows.
- Four Crystal Workshop and six existing Petverse browser checks passed. The new checks observed actual crystal damage and saved Gold, walked to the crank while pets farmed in an assigned field, spent a charge and Gold on an egg, and opened the game fullscreen at a narrow viewport.
- A standalone browser check confirmed Fusion consumed the three previewed duplicates and kept the equipped pet. It also opened the real Gold ranking from the HUD.
- Two real Chromium profiles joined a private room, saw a damaged crystal in both scenes, hatched and traded pets, checked their saved rankings, and recovered a guest save after a server restart.
- The static package loaded at 320 pixels under the GitHub Pages project path. It kept a save from the previous release and collected Gold in solo play without opening a socket.
