# Petverse Online Bestiary

Petverse has 500 collectible species. The Bestiary adds 460 species to the 40 classic pets. Its pets use 23 original body shapes with themed coats, patterns, crests, and movements.

Open **Hatch → Bestiary eggs** and choose a habitat. The twenty new eggs each have 23 possible species. The Clover Egg is available in Sunstep at Level 1. Other sets open as you level up and rebirth. For eggs from Glasswater Coast, Frostpine Reach, or Cinderbloom Basin, visit the same physical egg station used by the classic regional egg. The workshop can hatch an eligible charged egg using Gold and stored energy.

| Habitat | Bestiary eggs | Species |
| --- | ---: | ---: |
| Sunstep | 4 | 92 |
| Fernwild | 3 | 69 |
| Emberdeep | 3 | 69 |
| Glasswater Coast | 4 | 92 |
| Frostpine Reach | 3 | 69 |
| Cinderbloom Basin | 3 | 69 |

## Species rarity

Every Bestiary egg starts with these rarity odds. **Rarity odds** and **Species odds** on each egg show the actual draw after upgrades.

| Rarity | Starting chance |
| --- | ---: |
| Common | 30% |
| Uncommon | 23% |
| Rare | 16.5% |
| Epic | 11.5% |
| Legendary | 8.5% |
| Mythic | 5.5% |
| Exalted | 2.5% |
| Celestial | 1.4% |
| Ethereal | 0.8% |
| Primordial | 0.3% |

Hatching draws a species and a variant separately. A Primordial can also hatch as a Shiny, Giant, or Titanium. Rarity earns collection points, and the pet's combat role affects damage, attack frequency, and travel speed. Try scouts for clearing small crystals and strikers for tougher crystals.

## Track the collection

Open **Pets → Collection** to search species, filter by rarity, habitat, generation, or variant, and browse the full roster. Explore the habitat and egg-set progress in the journal as you earn Bestiary score bonuses. Habitat Annex upgrades give you room to keep all 500 species.

The expansion loads existing pets, variants, and progress from solo saves and private profiles. Solo play runs on the static site. Private rooms use the matching Petverse server. [Server setup](../petverse-server/README.md)

## Verification

- 115 unit tests, 24 gateway tests, and 13 Petverse server tests passed. The model checks hatched and restored a complete 500-species collection through the paid hatch action. Server checks exercised a 530-pet private profile with all 4,500 species-and-variant discoveries.
- Three new Chromium checks verified mobile browsing, displayed Primordial odds, a paid Primordial hatch with persistence, and hatching at the coastal station. All 13 existing Petverse browser checks and both private-room browser checks also passed.
- The 320px GitHub Pages package kept the Gold, pets, and score from a Biome Expeditions save and completed a paid Clover hatch in solo play.
