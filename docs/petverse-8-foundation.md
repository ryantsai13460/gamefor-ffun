# Petverse Online 8.0 foundation

This release focuses on exploration controls, the camera, Sunstep Meadow, and pet presentation. It carries forward the 500-species Bestiary and the solo and private-room progression systems.

## Explore and use Shift Lock

Choose **Play Solo**, then press **Left Shift** or select **Shift Lock** to lock the mouse. Move it to look around. The character faces the camera direction while **A** and **D** strafe. Press **Escape** to release the cursor. Opening an overlay releases it too. Press **I** to open Pets while playing. Enable Shift Lock again when you return to the world.

Hold **R** to sprint, press **Space** to jump, use **F** at stations, and use **E** for the crank. Without Shift Lock, drag to orbit. Scroll to zoom. In **Settings → Controls**, change Shift Lock and sprint bindings, camera distance, or camera sensitivity. Touch movement stays available on touch devices.

The camera shortens its orbit around solid scenery and adapts in the cave. **Fullscreen** expands the world and floating controls. The ranks button opens the same saved-score leaderboard from the upper-right HUD.

## Graphics and pets

Sunstep has raised terrain, thicker grass, new rocks, reshaped trees, and an animated waterfall. Pets use refined materials and expressions. The inventory renders portraits from the same 3D models used in the meadow, loads visible portraits as needed, and shows the equipped team and its damage separately. **Unequip all** frees the team without deleting any companions. The locked slots show their unlock costs.

The Low, Medium, High, and Ultra presets set real rendering budgets. Resolution, draw distance, dynamic shadows, texture filtering, anti-aliasing, and bloom can be adjusted individually. Reduced motion softens or pauses decorative animation. Giant and Titanium visibility can be controlled for other players.

Crystal strikes, shatters, fusion, upgrades, and travel have original sound cues. The current expedition biomes use different ambient arrangements. Toggle crystal hits and breaks separately in **Settings → Audio**.

## Hatch and save

**Settings → Generation** can cap an Auto Hatch run at 10, 25, 50, or 100 eggs. The session shows its Gold estimate, and its paid batches stop at the chosen limit. Existing rarity, variant, and discovery stop rules still apply. Use the workshop or local egg stations as before.

Solo play runs on the static site. Private rooms use the matching Petverse service for sprint motion and bulk equipment changes. [Private server setup](../petverse-server/README.md)

## Verification

The 121 arcade and game unit tests, 14 Petverse server tests, and 24 gateway tests passed. Chromium checks covered native mouse lock and fullscreen, jumps and sprinting, mobile-size touch input, rendered pet portraits, and bulk unequip. Gameplay checks covered crystal damage and Gold pickup, designated farming while cranking, paid hatches and stop rules, biome travel, and the Rebirth Cave path. Four gameplay cases passed on focused reruns after their tests were updated for simultaneous Gold pickups, eased movement, and hatch timing.

The extracted static preview loaded inside the arcade at 320 pixels under the GitHub Pages project path. It preserved both pet IDs, the Gold balance, and the graphics preference from a save created by the previous release.

Two Chromium clients also joined a private room, shared the farming field, completed a trade, and recovered the guest profile after a server restart. A separate room check exercised both permitted and gated expedition travel.

## Next phase

The larger new regions and six dimensions are subsequent phases, along with Colossal forms, Ascended progression, and the deeper Rebirth Cave overhaul.
