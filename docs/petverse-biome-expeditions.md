# Petverse Online Biome Expeditions

Open **Explore** in Petverse to see the biome requirements and travel to any area you have unlocked. The gate trails leading out of Sunstep also work on foot. Choose **Return to Sunstep Meadow** from Explore when you want to visit the workshop or the Rebirth Cave.

| Biome | Unlock requirement | Egg | Full set bonus |
| --- | --- | --- | --- |
| Glasswater Coast | Level 3 | Tideglass Egg · 112 Gold | 90 points |
| Frostpine Reach | Level 5 and one rebirth | Rimebranch Egg · 215 Gold | 150 points |
| Cinderbloom Basin | Level 7 and two rebirths | Caldera Egg · 375 Gold | 240 points |

Each biome adds five original pets and seven crystal sites. The new pets cover different combat roles, from quick pets that split between small crystals to heavy hitters that work well against tough formations. Keep your team following you to mine locally, or use **Farming** to assign them to an unlocked field. An earned **Remote Magnet** collects eligible Gold from the assigned field while you are away.

Approach the region’s egg station and press **F** or use its interaction button to open the Hatch panel. Auto Hatch at a regional station stops if you walk away. A charged workshop egg can also hatch an eligible regional pet using both stored energy and Gold.

**Pets → Collection** tracks each biome’s roster, discovery points, and bonus. Finding three species grants the first bonus. Completing the set brings that biome’s total bonus to the amount in the table. The Journal offers achievements for collection milestones, and room leaderboards can rank total score, expedition bonus, or completed biome sets. Existing saves load with the new habitat capacity and retain their collected pets, variants, balances, and earned achievements.

## Playing with friends

Solo play runs on the static site. Private rooms use the matching Petverse Node.js service. It validates biome gates, travel destinations, hatching proximity, and rewards and synchronizes players and crystals across the extended world. [Server setup](../petverse-server/README.md)

## Verification

- 107 unit, 24 gateway, and 12 Petverse server checks passed.
- Three Chromium expedition checks covered locked routes on mobile, real Coast mining and a paid station hatch, save restoration, and a round trip through Frostpine and Cinderbloom. A separate walking check verified the physical Coast gate before and after the unlock.
- All ten existing Petverse browser checks passed, including Giant Titanium hatching, the Rebirth Cave, fullscreen, and remote mining during a workshop session.
- Two private-room browser checks covered synced combat and movement, gated travel, restoring the solo location on exit, trading, and recovering a guest save after a server restart.
- The 320px static package retained pets, Gold, and score from a Crystal Workshop save and traveled to Glasswater without opening a WebSocket.
