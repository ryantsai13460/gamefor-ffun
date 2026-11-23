import { canFarmArea, crystalAtId, CRYSTAL_SITES, FARM_PRIORITIES, farmSettings, farmingAreaAt } from './farming.js';
import { canOperateGenerator, createGeneratorProgress, GENERATOR_ACHIEVEMENTS, GENERATOR_UPGRADES,
  generatorAction, generatorEggCost, generatorPlan, restoreGeneratorProgress, spendGeneratorCharge } from './generator.js';

export const SAVE_VERSION = 1;
export const WORLD_LIMIT = 27;
export const SPAWN = Object.freeze({ x: 0, z: 11 });
export const HATCHERY = Object.freeze({ x: 0, z: -4 });
export const GATHER_DISTANCE = 3;
export const REBIRTH_ALTAR = Object.freeze({ x: -22, z: -19, radius: 3.2 });

function frozenCatalog(items) {
  return Object.freeze(items.map(Object.freeze));
}

export const PETS = frozenCatalog([
  { id: 'twigpup', name: 'Twigpup', rarity: 'common', power: 4, color: '#be8161', accent: '#ffe2a0', shape: 'pup' },
  { id: 'thimblehare', name: 'Thimblehare', rarity: 'common', power: 5, color: '#aa82dc', accent: '#f8d4e9', shape: 'hare' },
  { id: 'budfinch', name: 'Budfinch', rarity: 'common', power: 6, color: '#f3c76b', accent: '#fff6c6', shape: 'bird' },
  { id: 'mosswhisker', name: 'Mosswhisker', rarity: 'common', power: 7, color: '#77a87c', accent: '#e0f0a6', shape: 'cat' },
  { id: 'puddlepop', name: 'Puddlepop', rarity: 'uncommon', power: 9, color: '#72bcd8', accent: '#efb7d8', shape: 'axolotl' },
  { id: 'plumhop', name: 'Plumhop', rarity: 'uncommon', power: 10, color: '#78568a', accent: '#f6cb75', shape: 'frog' },
  { id: 'sundrop', name: 'Sundrop', rarity: 'rare', power: 13, color: '#de8d49', accent: '#ffe8ab', shape: 'bear' },
  { id: 'kiteroot', name: 'Kiteroot', rarity: 'rare', power: 15, color: '#d268a1', accent: '#ffd2b4', shape: 'moth' },
  { id: 'brambleflare', name: 'Brambleflare', rarity: 'epic', power: 19, color: '#ad4b46', accent: '#ffc469', shape: 'fox' },
  { id: 'daybreak', name: 'Daybreak', rarity: 'legendary', power: 25, color: '#eb8c73', accent: '#fffae0', shape: 'deer' },
  { id: 'fernskip', name: 'Fernskip', rarity: 'common', power: 10, color: '#588c78', accent: '#a6edd0', shape: 'deer' },
  { id: 'lanternslug', name: 'Lanternslug', rarity: 'common', power: 11, color: '#e2aa48', accent: '#f6f2ad', shape: 'slug' },
  { id: 'mistkit', name: 'Mistkit', rarity: 'common', power: 12, color: '#708ec1', accent: '#d7e9ff', shape: 'cat' },
  { id: 'pearlfin', name: 'Pearlfin', rarity: 'uncommon', power: 14, color: '#edd7d9', accent: '#6edbc9', shape: 'axolotl' },
  { id: 'starlint', name: 'Starlint', rarity: 'uncommon', power: 16, color: '#7a65ae', accent: '#e6d2f8', shape: 'owl' },
  { id: 'emberbrush', name: 'Emberbrush', rarity: 'rare', power: 19, color: '#a95966', accent: '#ffcc86', shape: 'fox' },
  { id: 'rainruby', name: 'Rainruby', rarity: 'rare', power: 22, color: '#2b9385', accent: '#ed7991', shape: 'frog' },
  { id: 'silverbun', name: 'Silverbun', rarity: 'epic', power: 25, color: '#a2adc7', accent: '#f6f2ff', shape: 'hare' },
  { id: 'moonmote', name: 'Moonmote', rarity: 'legendary', power: 31, color: '#5d73c2', accent: '#c3f5ff', shape: 'moth' },
  { id: 'auroracub', name: 'Auroracub', rarity: 'mythic', power: 42, color: '#3c5d92', accent: '#a4ffd7', shape: 'bear' },
  { id: 'cinderskip', name: 'Cinderskip', rarity: 'common', power: 24, color: '#955b50', accent: '#fecd8e', shape: 'hare', generation: 2 },
  { id: 'glowgill', name: 'Glowgill', rarity: 'uncommon', power: 33, color: '#6babb5', accent: '#fff394', shape: 'axolotl', generation: 2 },
  { id: 'flintowl', name: 'Flintowl', rarity: 'rare', power: 44, color: '#65728e', accent: '#e6d5a4', shape: 'owl', generation: 2 },
  { id: 'shardstoat', name: 'Shardstoat', rarity: 'epic', power: 54, color: '#b58c9a', accent: '#ffc6a8', shape: 'fox', generation: 2 },
  { id: 'forgeheart', name: 'Forgeheart', rarity: 'legendary', power: 69, color: '#783d55', accent: '#ffb873', shape: 'bear', generation: 2 }
].map(pet => ({ generation: 1, ...pet })));

export const GENERATIONS = frozenCatalog([
  { id: 1, name: 'Meadow', rebirths: 0, description: 'Collect woodland companions from the Sunmeadow and Moonbloom eggs.' },
  { id: 2, name: 'Emberdeep', rebirths: 1, description: 'Unlock the Ember Geode Egg with your first rebirth at the cavern altar.' }
]);

function weightedPool(start, weights) {
  return frozenCatalog(weights.map((weight, index) => ({ speciesId: PETS[start + index].id, weight })));
}

export const EGGS = frozenCatalog([
  { id: 'sunmeadow', name: 'Sunmeadow Egg', description: 'Warm shells from Sunstep Meadow. A gentle start with two elusive finds.', cost: 18, level: 1, color: '#ffcb78',
    pool: weightedPool(0, [2400, 1900, 1700, 1450, 1000, 680, 470, 240, 120, 40]) },
  { id: 'moonbloom', name: 'Moonbloom Egg', description: 'An evening bloom with a stronger collection and the chance to meet Auroracub.', cost: 62, level: 3, color: '#b7a2ff',
    pool: weightedPool(10, [2150, 1800, 1550, 1350, 1100, 850, 600, 370, 180, 50]) },
  { id: 'embergeode', name: 'Ember Geode Egg', description: 'A warm geode from the Rebirth Cave. Its companions have stronger gathering power.', cost: 85, level: 3, color: '#ea8b63', generation: 2,
    pool: weightedPool(20, [4100, 3000, 1900, 850, 150]) }
].map(egg => ({ generation: 1, ...egg })));

export const VARIANTS = frozenCatalog([
  { id: 'normal', name: 'Standard', weight: 9175, multiplier: 1, color: '#c5d4cb' },
  { id: 'giant', name: 'Giant', weight: 5, multiplier: 3.85, color: '#f2bc88' },
  { id: 'shiny', name: 'Shiny', weight: 620, multiplier: 1.4, color: '#fff197' },
  { id: 'metallic', name: 'Metallic', weight: 100, multiplier: 1.7, color: '#a8b8ca' },
  { id: 'gold', name: 'Gold', weight: 45, multiplier: 2, color: '#ffca59' },
  { id: 'diamond', name: 'Diamond', weight: 25, multiplier: 2.35, color: '#81edee' },
  { id: 'obsidian', name: 'Obsidian', weight: 15, multiplier: 2.7, color: '#886cb2' },
  { id: 'titanium', name: 'Titanium', weight: 10, multiplier: 3, color: '#a6bbc9' },
  { id: 'mythic', name: 'Mythic', weight: 5, multiplier: 3.5, color: '#f390dc' }
]);

export const NODES = frozenCatalog([
  { id: 'path-bloom', x: -3.8, z: 8, kind: 'bloom', label: 'Pathbloom', reward: 10, cooldownMs: 4600 },
  { id: 'sun-bloom', x: 6, z: 7, kind: 'bloom', label: 'Sunbloom', reward: 10, cooldownMs: 4600 },
  { id: 'reed-bloom', x: -10, z: 2, kind: 'bloom', label: 'Reedbloom', reward: 12, cooldownMs: 5000 },
  { id: 'orchard-bloom', x: 11, z: -2, kind: 'bloom', label: 'Orchardbloom', reward: 12, cooldownMs: 5000 },
  { id: 'ridge-stone', x: 15, z: 5.5, kind: 'stone', label: 'Ridge pebble', reward: 15, cooldownMs: 6000 },
  { id: 'clover-stone', x: -14, z: 12, kind: 'stone', label: 'Clover pebble', reward: 15, cooldownMs: 6000 },
  { id: 'fern-stone', x: -10, z: -10.5, kind: 'stone', label: 'Fern pebble', reward: 16, cooldownMs: 6500 },
  { id: 'brook-crystal', x: -18, z: -7, kind: 'crystal', label: 'Brook crystal', reward: 19, crystals: 2, cooldownMs: 8500 },
  { id: 'ridge-crystal', x: 15, z: -11, kind: 'crystal', label: 'Ridge crystal', reward: 19, crystals: 2, cooldownMs: 8500 },
  { id: 'crown-crystal', x: 5, z: -17, kind: 'crystal', label: 'Crown crystal', reward: 22, crystals: 3, cooldownMs: 10000 }
]);

const upgradeData = [
  { id: 'petDamage', name: 'Pet damage', description: 'Adds 18% to each hit per rank.', costs: [38, 82, 150, 255], level: 1 },
  { id: 'attackRate', name: 'Pet attack rate', description: 'Adds 12% to attack frequency per rank.', costs: [45, 90, 165, 285], level: 2 },
  { id: 'petSpeed', name: 'Pet movement', description: 'Adds 0.8 m/s to trips between crystals per rank.', costs: [32, 70, 126], level: 1 },
  { id: 'specialCrystalLuck', name: 'Rare crystal luck', description: 'Increases the probability of rare crystal respawns.', costs: [62, 135, 240], level: 2 },
  { id: 'magnetRange', name: 'Magnet range', description: 'Adds 1.1 steps of reach for collecting nearby resource drops.', costs: [24, 50, 85, 125, 175], level: 1 },
  { id: 'magnetSpeed', name: 'Magnet speed', description: 'Shortens pickup time and speeds up flying rewards.', costs: [30, 65, 105], level: 1 },
  { id: 'magnetEfficiency', name: 'Magnet efficiency', description: 'Raises Gold rewards by 10% per rank together with other permanent bonuses.', costs: [42, 85, 130], level: 2 },
  { id: 'magnetSlots', name: 'Magnet capacity', description: 'Attracts two additional Gold piles at once per rank.', costs: [46, 100, 172], level: 2 },
  { id: 'remoteMagnet', name: 'Remote magnet', description: 'Collects Gold from the unlocked field your companions are assigned to while you are away.', costs: [90], level: 2 },
  { id: 'autoHatch', name: 'Auto Hatch', description: 'Unlocks a repeat hatch you start yourself each session.', costs: [36], level: 2 },
  { id: 'eggLuck', name: 'Egg species luck', description: 'Adds 15% to the draw weight of rare and stronger species per rank.', costs: [64, 132, 216], level: 3 },
  { id: 'variantLuck', name: 'Variant discovery', description: 'Adds 20% to the draw weight of rare variants per rank.', costs: [72, 150, 250], level: 3 },
  { id: 'hatchSpeed', name: 'Hatch speed', description: 'Shortens the time between hatches.', costs: [42, 98, 180], level: 2 },
  { id: 'multiHatch', name: 'Multi-Hatch', description: 'Unlocks hatching up to three eggs at a time.', costs: [70], level: 3 },
  { id: 'autoCollect', name: 'Auto Collect', description: 'Unlocks the automatic Gold pickup setting and grants it 1.75 m of extra reach.', costs: [58], level: 3 },
  { id: 'harvest', name: 'Harvest bonus', description: 'Collects two more Gold per resource for each rank.', costs: [32, 68, 128], level: 2 },
  { id: 'teamSize', name: 'Team size', description: 'Adds one equipped pet slot per rank.', costs: [52, 135], level: 3 },
  { id: 'capacity', name: 'Habitat space', description: 'Adds twelve inventory spaces per rank.', costs: [4, 9, 16], currency: 'crystals', level: 2 },
  { id: 'ascensionReach', name: 'Ascension reach', description: 'Adds 1.6 permanent steps of magnet reach per rank.', costs: [2, 4, 7], currency: 'ascension', level: 3, rebirths: 1 },
  { id: 'ascensionYield', name: 'Ascension yield', description: 'Increases Gold rewards by 12% per rank.', costs: [2, 4, 7], currency: 'ascension', level: 3, rebirths: 1 },
  ...GENERATOR_UPGRADES
];

export const UPGRADES = frozenCatalog(upgradeData.map(upgrade => ({
  currency: 'sunbeams', ...upgrade, costs: Object.freeze(upgrade.costs)
})));

const byId = items => new Map(items.map(item => [item.id, item]));
const petById = byId(PETS);
const variantById = byId(VARIANTS);
const eggById = byId(EGGS);
const nodeById = byId(NODES);
const upgradeById = byId(UPGRADES);
const variantIds = VARIANTS.slice(1).map(variant => variant.id);
const scarceRarities = new Set(['rare', 'epic', 'legendary', 'mythic']);
const hatchIntervals = [1600, 1250, 950, 700];
const maxNumber = 1_000_000_000;
const maxPetSerial = 999_999_999_999;
const maxDrops = 8;
const dropLifetime = 30_000;
const maxRebirths = 12;
const maxHatchHistory = 24;
const validProgressKey = /^pet-[1-9]\d{0,11}$/;
const validDropKey = /^drop-[1-9]\d{0,11}$/;
const statsKeys = ['eggsHatched', 'sunbeamsSpent', 'resourcesCollected', 'shinies', 'rareVariants',
  'goldEarned', 'crystalsDestroyed', 'specialCrystalsDestroyed', 'fusions', 'assignedAreas', 'crankGold'];
const rarityScores = { common: 10, uncommon: 14, rare: 22, epic: 35, legendary: 55, mythic: 85 };
const variantScores = { shiny: 18, metallic: 30, gold: 48, diamond: 70, obsidian: 100, titanium: 140, mythic: 200, giant: 250 };
const fusionTiers = { normal: 'shiny', shiny: 'metallic', metallic: 'gold', gold: 'diamond', diamond: 'obsidian',
  obsidian: 'titanium', titanium: 'giant', mythic: 'giant' };
const shapeCombat = {
  pup: [1.2, 6.4], hare: [1.45, 7.5], bird: [1.35, 7.8], cat: [1.35, 6.6], axolotl: [1.05, 5.8],
  frog: [1.15, 6.7], bear: [.86, 5.6], moth: [1.36, 7.7], fox: [1.24, 7.2], deer: [.96, 7],
  slug: [.93, 5.5], owl: [1.1, 7]
};

export const ACHIEVEMENTS = frozenCatalog([
  { id: 'first-hatch', name: 'First Hatch', description: 'Hatch an egg in the meadow.', source: 'eggsHatched', target: 1, reward: 1, points: 10 },
  { id: 'meadow-naturalist', name: 'Meadow Naturalist', description: 'Discover ten different species.', source: 'uniquePets', target: 10, reward: 2, points: 30 },
  { id: 'first-shiny', name: 'A Little Brighter', description: 'Discover a Shiny companion.', source: 'shiny', target: 1, reward: 2, points: 30 },
  { id: 'first-titanium', name: 'A Giant Among Pets', description: 'Discover a Titanium companion.', source: 'titanium', target: 1, reward: 5, points: 90 },
  { id: 'first-giant', name: 'Skyline Companion', description: 'Discover a Giant companion.', source: 'giant', target: 1, reward: 5, points: 120 },
  { id: 'first-crystal', name: 'The First Fracture', description: 'Have your pets break a crystal.', source: 'crystalsDestroyed', target: 1, reward: 1, points: 10 },
  { id: 'crystal-century', name: 'Steady Work', description: 'Have your pets break a hundred crystals.', source: 'crystalsDestroyed', target: 100, reward: 3, points: 45 },
  { id: 'crystal-master', name: 'Master of the Fields', description: 'Have your pets break ten thousand crystals.', source: 'crystalsDestroyed', target: 10_000, reward: 12, points: 280 },
  { id: 'special-crystal', name: 'Rare Vein', description: 'Have your pets break their first rare crystal.', source: 'specialCrystalsDestroyed', target: 1, reward: 2, points: 35 },
  { id: 'first-fusion', name: 'Joining Forces', description: 'Fuse three eligible duplicate companions.', source: 'fusions', target: 1, reward: 2, points: 30 },
  { id: 'damage-bench', name: 'Field Strength', description: 'Equip a team with at least 50 damage per second.', source: 'teamDamageRate', target: 50, reward: 3, points: 40 },
  { id: 'fieldwork', name: 'Fieldwork', description: 'Collect twenty-five resource rewards.', source: 'resourcesCollected', target: 25, reward: 2, points: 30 },
  { id: 'magnet-makers', name: 'Magnet Maker', description: 'Purchase three Magnet Range ranks.', source: 'magnetRange', target: 3, reward: 2, points: 30 },
  { id: 'cave-pledge', name: 'Keeper of the Ember', description: 'Complete a rebirth at the cave altar.', source: 'rebirths', target: 1, reward: 3, points: 50 },
  { id: 'meadow-complete', name: 'Meadow Field Guide', description: 'Discover every Meadow species.', source: 'meadowSpecies', target: 20, reward: 5, points: 70 },
  { id: 'ember-complete', name: 'Emberdeep Field Guide', description: 'Discover every Emberdeep species.', source: 'emberSpecies', target: 5, reward: 5, points: 70 },
  ...GENERATOR_ACHIEVEMENTS
]);
const achievementById = byId(ACHIEVEMENTS);

const defaultSettings = Object.freeze({
  stopVariants: Object.freeze(Object.fromEntries(variantIds.map(id => [id, id === 'shiny']))),
  stopOnNew: false,
  stopOnNewVariant: false,
  stopOnFull: true,
  autoEquip: true,
  lockRare: true,
  multiHatch: false,
  autoCollect: false,
  autoCollectGold: false
});

function integer(value, min = 0, max = maxNumber) {
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : min;
}

function timestamp(value) {
  return integer(value, 0, Number.MAX_SAFE_INTEGER);
}

function updateSettings(current, patch) {
  const preferences = { ...current, stopVariants: { ...current.stopVariants } };
  for (const name of Object.keys(current)) {
    if (name !== 'stopVariants' && typeof patch?.[name] === 'boolean') preferences[name] = patch[name];
  }
  for (const id of variantIds) {
    if (typeof patch?.stopVariants?.[id] === 'boolean') preferences.stopVariants[id] = patch.stopVariants[id];
  }
  return preferences;
}

function petSerial(id) {
  return typeof id === 'string' && validProgressKey.test(id) ? Number(id.slice(4)) : 0;
}

function cleanPet(value) {
  if (!value || !petSerial(value.id) || !petById.has(value.speciesId) || !variantById.has(value.variant)) return null;
  return { id: value.id, speciesId: value.speciesId, variant: value.variant,
    favorite: value.favorite === true, locked: value.locked === true, obtainedAt: timestamp(value.obtainedAt) };
}

function discoveryKey(pet) {
  return `${pet.speciesId}:${pet.variant}`;
}

export function createProgress() {
  const starter = { id: 'pet-1', speciesId: 'twigpup', variant: 'normal', favorite: false, locked: false, obtainedAt: 0 };
  return {
    version: SAVE_VERSION,
    wallet: { sunbeams: 40, crystals: 0, ascension: 0 },
    xp: 0,
    rebirths: 0,
    inventory: [starter],
    equipped: [starter.id],
    discovered: [starter.speciesId],
    variantDiscoveries: [discoveryKey(starter)],
    upgrades: Object.fromEntries(UPGRADES.map(item => [item.id, 0])),
    settings: updateSettings(defaultSettings),
    farming: farmSettings({}),
    assignedFarmAreas: [],
    generator: createGeneratorProgress(),
    stats: Object.fromEntries(statsKeys.map(key => [key, 0])),
    achievements: [],
    nodeReadyAt: {},
    drops: [],
    magnetBusyUntil: [],
    nextDropId: 1,
    hatchReadyAt: 0,
    hatchHistory: [],
    nextPetId: 2
  };
}

function storageCapacity(upgrades) {
  return 36 + upgrades.capacity * 12;
}

function teamCapacity(upgrades) {
  return 2 + upgrades.teamSize;
}

export function petPower(pet) {
  const base = petById.get(pet?.speciesId)?.power || 0;
  const variant = variantById.get(pet?.variant)?.multiplier || 1;
  return Math.round(base * variant);
}

export function petCombatStats(pet, progress) {
  const species = petById.get(pet?.speciesId);
  if (!species) return { damage: 0, attackRate: 0, moveSpeed: 0, farmingPower: 0 };
  const upgrades = progress?.upgrades || {};
  const [rate, speed] = shapeCombat[species.shape];
  const heavy = pet.variant === 'titanium' || pet.variant === 'giant';
  const damage = Math.round(petPower(pet) * (1 + (upgrades.petDamage || 0) * .18));
  const attackRate = Number((rate * (1 + (upgrades.attackRate || 0) * .12) * (heavy ? .8 : 1)).toFixed(2));
  const moveSpeed = Number((speed * (heavy ? .82 : 1) + (upgrades.petSpeed || 0) * .8).toFixed(2));
  // Estimate throughput across a typical 32-health crystal and the trip to that crystal.
  const cycleSeconds = Math.ceil(32 / damage) / attackRate + 5 / moveSpeed;
  return { damage, attackRate, moveSpeed, farmingPower: 32 / cycleSeconds };
}

export function progression(progress) {
  const { xp, upgrades } = progress;
  const level = Math.floor((1 + Math.sqrt(1 + xp / 3)) / 2);
  const rebirths = progress.rebirths || 0;
  const equipped = progress.inventory.filter(pet => progress.equipped.includes(pet.id));
  const teamDamageRate = equipped.reduce((total, pet) => {
    const { damage, attackRate } = petCombatStats(pet, progress);
    return total + damage * attackRate;
  }, 0);
  return {
    level, xp,
    rebirths,
    generation: GENERATIONS.findLast(generation => rebirths >= generation.rebirths).id,
    rewardMultiplier: magnetStats(progress).efficiency,
    levelStartXp: 12 * level * (level - 1),
    nextLevelXp: 12 * level * (level + 1),
    hatchInterval: hatchIntervals[upgrades.hatchSpeed],
    capacity: storageCapacity(upgrades),
    equipSlots: teamCapacity(upgrades),
    power: equipped.reduce((total, pet) => total + petPower(pet), 0),
    teamDamageRate: Math.round(teamDamageRate * 10) / 10
  };
}

export function magnetStats(progress) {
  const { upgrades, rebirths = 0 } = progress;
  const autoCollect = Boolean(upgrades.autoCollect && progress.settings?.autoCollectGold);
  const radius = 3.3 + (upgrades.magnetRange || 0) * 1.1 + (upgrades.ascensionReach || 0) * 1.6 + rebirths * .55 + (autoCollect ? 1.75 : 0);
  const speed = 7.5 + (upgrades.magnetSpeed || 0) * 3;
  const efficiency = 1 + (upgrades.magnetEfficiency || 0) * .10 + (upgrades.ascensionYield || 0) * .12 + rebirths * .18;
  return { radius: Math.round(radius * 100) / 100, speed, efficiency: Math.round(efficiency * 100) / 100,
    maxSimultaneous: 2 + (upgrades.magnetSlots || 0) * 2, remote: Boolean(upgrades.remoteMagnet), autoCollect };
}

export function generationStatus(progress) {
  const unlocked = progression(progress).generation;
  return GENERATIONS.map(generation => {
    const species = PETS.filter(pet => pet.generation === generation.id);
    return { ...generation, unlocked: unlocked >= generation.id, total: species.length,
      discovered: species.filter(pet => progress.discovered.includes(pet.id)).length };
  });
}

export function rebirthPlan(progress) {
  const count = progress.rebirths || 0;
  const requirements = { level: 3 + count, sunbeams: 95 + count * 55, crystals: 4 + count * 2 };
  let reason = null;
  if (count >= maxRebirths) reason = 'rebirth-maxed';
  else if (progression(progress).level < requirements.level) reason = 'rebirth-level';
  else if (progress.wallet.sunbeams < requirements.sunbeams) reason = 'insufficient-sunbeams';
  else if (progress.wallet.crystals < requirements.crystals) reason = 'insufficient-crystals';
  const rewards = { ascension: 2 + count,
    generation: GENERATIONS.findLast(generation => count + 1 >= generation.rebirths).id,
    resourceBonus: .18, magnetBonus: .55 };
  return { count, requirements, rewards, available: reason === null, reason };
}

function trackedMetrics(progress) {
  const { stats } = progress;
  const species = new Set(progress.discovered);
  let collectionScore = 0;
  let meadowSpecies = 0;
  let emberSpecies = 0;
  for (const id of species) {
    const pet = petById.get(id);
    if (!pet) continue;
    collectionScore += rarityScores[pet.rarity];
    if (pet.generation === 1) meadowSpecies++;
    if (pet.generation === 2) emberSpecies++;
  }
  const variants = Object.fromEntries(variantIds.map(id => [id, 0]));
  for (const key of new Set(progress.variantDiscoveries)) {
    const [id, variant, extra] = key.split(':');
    if (!extra && species.has(id) && Object.hasOwn(variants, variant)) {
      variants[variant]++;
      collectionScore += variantScores[variant];
    }
  }
  const { generation, rebirths, teamDamageRate } = progression(progress);
  const generator = progress.generator || createGeneratorProgress();
  return { collectionScore, uniquePets: meadowSpecies + emberSpecies, ...variants,
    eggsHatched: stats.eggsHatched, resourcesCollected: stats.resourcesCollected, rebirths, generation,
    goldEarned: stats.goldEarned || 0, crystalsDestroyed: stats.crystalsDestroyed || 0,
    specialCrystalsDestroyed: stats.specialCrystalsDestroyed || 0, fusions: stats.fusions || 0,
    assignedAreas: stats.assignedAreas || 0, crankGold: stats.crankGold || 0, teamDamageRate,
    generatorOperations: generator.operations || 0, generatorEnergy: Math.floor((generator.produced || 0) / 1000),
    generatorHatches: generator.hatches || 0, rebirthGeneratorHatches: generator.rebirthHatches || 0,
    generatorUpgradeRanks: GENERATOR_UPGRADES.reduce((sum, item) => sum + (progress.upgrades[item.id] || 0), 0),
    generatorTier: generatorPlan(progress).tier,
    meadowSpecies, emberSpecies, magnetRange: progress.upgrades.magnetRange || 0 };
}

export function collectionMetrics(progress) {
  const { meadowSpecies, emberSpecies, magnetRange, ...publicMetrics } = trackedMetrics(progress);
  const achievementPoints = ACHIEVEMENTS.reduce((sum, achievement) =>
    sum + ((progress.achievements || []).includes(achievement.id) ? achievement.points : 0), 0);
  return { ...publicMetrics, achievementPoints };
}

export function achievementStatus(progress) {
  const metrics = trackedMetrics(progress);
  const claimed = new Set(progress.achievements);
  return ACHIEVEMENTS.map(({ source, ...achievement }) => ({ ...achievement, current: metrics[source],
    isClaimed: claimed.has(achievement.id), isReady: !claimed.has(achievement.id) && metrics[source] >= achievement.target }));
}

function dropSerial(id) {
  return typeof id === 'string' && validDropKey.test(id) ? Number(id.slice(5)) : 0;
}

function restoreDrops(progress, value, now) {
  const drops = new Map();
  const nodes = new Set();
  let legacyDrops = 0;
  if (Array.isArray(value.drops)) {
    for (const drop of value.drops.slice(0, maxDrops + CRYSTAL_SITES.length)) {
      if (drop?.kind === 'crystal-gold') {
        const site = crystalAtId(drop.crystalId);
        if (!site || !dropSerial(drop.id) || drops.has(drop.id) || nodes.has(site.id)) continue;
        const readyAt = timestamp(drop.readyAt);
        const sunbeams = integer(drop.sunbeams);
        if (!sunbeams) continue;
        drops.set(drop.id, { id: drop.id, kind: 'crystal-gold', nodeId: site.id, crystalId: site.id, areaId: site.areaId,
          x: site.x, z: site.z, sunbeams, crystals: integer(drop.crystals), count: integer(drop.count, 1),
          readyAt: Math.min(readyAt, now + 1250), expiresAt: Number.MAX_SAFE_INTEGER });
        nodes.add(site.id);
        continue;
      }
      const node = nodeById.get(drop?.nodeId);
      if (legacyDrops >= maxDrops) continue;
      if (!node || !dropSerial(drop.id) || drops.has(drop.id) || nodes.has(node.id)) continue;
      const readyAt = timestamp(drop.readyAt);
      const expiresAt = timestamp(drop.expiresAt);
      if (expiresAt <= now || expiresAt <= readyAt || expiresAt - readyAt > dropLifetime || expiresAt > now + dropLifetime) continue;
      const sunbeams = integer(drop.sunbeams, 0, 1000);
      if (!sunbeams) continue;
      const crystals = integer(drop.crystals, 0, node.crystals || 0);
      drops.set(drop.id, { id: drop.id, nodeId: node.id, x: node.x, z: node.z, sunbeams, crystals, readyAt, expiresAt });
      nodes.add(node.id);
      legacyDrops++;
    }
  }
  progress.drops = [...drops.values()];
  progress.nextDropId = Math.max(integer(value.nextDropId, 1, maxPetSerial + 1), ...progress.drops.map(drop => dropSerial(drop.id) + 1));
  if (Array.isArray(value.magnetBusyUntil)) {
    progress.magnetBusyUntil = value.magnetBusyUntil.slice(0, magnetStats(progress).maxSimultaneous)
      .filter(time => Number.isSafeInteger(time) && time > now && time <= now + 1250);
  }
}

export function restoreProgress(value, { now = Date.now() } = {}) {
  if (!value || value.version !== SAVE_VERSION || !Array.isArray(value.inventory)) return createProgress();
  const progress = createProgress();
  progress.wallet = { sunbeams: integer(value.wallet?.sunbeams), crystals: integer(value.wallet?.crystals),
    ascension: integer(value.wallet?.ascension) };
  progress.xp = integer(value.xp);
  progress.rebirths = integer(value.rebirths, 0, maxRebirths);
  for (const upgrade of UPGRADES) progress.upgrades[upgrade.id] = integer(value.upgrades?.[upgrade.id], 0, upgrade.costs.length);
  const inventory = new Map();
  for (const item of value.inventory.slice(0, storageCapacity(progress.upgrades))) {
    const pet = cleanPet(item);
    if (pet && !inventory.has(pet.id)) inventory.set(pet.id, pet);
  }
  if (!inventory.size) return createProgress();
  progress.inventory = [...inventory.values()];
  progress.nextPetId = Math.max(integer(value.nextPetId, 1, maxPetSerial + 1), ...progress.inventory.map(pet => petSerial(pet.id) + 1));
  progress.equipped = Array.isArray(value.equipped)
    ? [...new Set(value.equipped.slice(0, 72).filter(id => inventory.has(id)))].slice(0, teamCapacity(progress.upgrades))
    : [];
  const discovered = new Set(progress.inventory.map(pet => pet.speciesId));
  if (Array.isArray(value.discovered)) {
    for (const id of value.discovered.slice(0, PETS.length)) if (petById.has(id)) discovered.add(id);
  }
  const discoveryKeys = new Set(progress.inventory.map(discoveryKey));
  const variantLimit = PETS.length * VARIANTS.length;
  if (Array.isArray(value.variantDiscoveries)) {
    for (const key of value.variantDiscoveries.slice(0, variantLimit)) {
      if (typeof key !== 'string' || key.length > 48) continue;
      const [id, variant, trailing] = key.split(':');
      if (!trailing && petById.has(id) && variantById.has(variant) && key === `${id}:${variant}`) {
        discovered.add(id);
        discoveryKeys.add(key);
      }
    }
  }
  progress.discovered = [...discovered];
  progress.variantDiscoveries = [...discoveryKeys];
  progress.settings = updateSettings(defaultSettings, value.settings);
  for (const key of statsKeys) progress.stats[key] = integer(value.stats?.[key]);
  progress.farming = farmSettings({ ...progress, farming: value.farming });
  if (Array.isArray(value.assignedFarmAreas)) {
    progress.assignedFarmAreas = [...new Set(value.assignedFarmAreas.slice(0, 50).filter(areaId => canFarmArea(progress, areaId)))];
  }
  progress.stats.assignedAreas = progress.assignedFarmAreas.length;
  progress.generator = restoreGeneratorProgress(value.generator, EGGS);
  if (Array.isArray(value.achievements)) {
    progress.achievements = [...new Set(value.achievements.slice(0, ACHIEVEMENTS.length).filter(id => achievementById.has(id)))];
  }
  for (const node of NODES) {
    const time = timestamp(value.nodeReadyAt?.[node.id]);
    if (time) progress.nodeReadyAt[node.id] = time;
  }
  progress.hatchReadyAt = timestamp(value.hatchReadyAt);
  restoreDrops(progress, value, timestamp(now));
  if (Array.isArray(value.hatchHistory)) {
    progress.hatchHistory = value.hatchHistory.slice(0, maxHatchHistory).flatMap(item => {
      if (item?.type !== 'hatch' || !eggById.has(item.eggId) || !Array.isArray(item.pets)) return [];
      const pets = item.pets.slice(0, 3).map(cleanPet).filter(Boolean);
      return pets.length ? [{ type: 'hatch', eggId: item.eggId, at: timestamp(item.at), spent: integer(item.spent), pets }] : [];
    });
  }
  return progress;
}

function addNumber(value, extra) {
  return Math.min(value + extra, maxNumber);
}

function pickWeighted(records, random) {
  const total = records.reduce((sum, item) => sum + item.weight, 0);
  const sample = random();
  let ticket = Number.isFinite(sample) ? Math.min(total - 1, Math.max(0, Math.floor(sample * total))) : 0;
  for (const item of records) {
    if (ticket < item.weight) return item;
    ticket -= item.weight;
  }
  return records.at(-1);
}

const messages = {
  'unknown-egg': 'That egg is unavailable.',
  'egg-locked': 'Level up to unlock this egg.',
  'generation-locked': 'Rebirth at the cave altar to unlock this generation.',
  'auto-hatch-locked': 'Unlock Auto Hatch in Upgrades first.',
  'auto-collect-locked': 'Unlock Auto Collect and turn it on first.',
  'no-equipped-pets': 'Equip a pet before using Auto Collect.',
  'hatch-cooldown': 'The hatchery is still preparing the next egg.',
  'inventory-full': 'Your habitat is full.',
  'insufficient-sunbeams': 'Collect more Gold first.',
  'insufficient-crystals': 'Collect more crystals first.',
  'insufficient-ascension': 'Earn more Ascension Crystals first.',
  'unknown-node': 'This resource is unavailable.',
  'resource-out-of-range': 'Move closer to the resource.',
  'node-cooldown': 'This resource is regrowing.',
  'magnet-pending': 'Collect the pending resource reward first.',
  'drop-unavailable': 'This resource reward has expired or was already collected.',
  'drop-cooldown': 'The reward is moving out of the resource.',
  'drop-out-of-range': 'Move into magnet range to collect this reward.',
  'gold-wallet-full': 'Make room in your wallet before collecting this Gold pile.',
  'unknown-pet': 'That pet is unavailable.',
  'unknown-upgrade': 'That upgrade is unavailable.',
  'upgrade-locked': 'Level up to unlock this upgrade.',
  'upgrade-rebirth-locked': 'Complete a rebirth to unlock this upgrade.',
  'upgrade-complete': 'This upgrade is already complete.',
  'team-full': 'Your pet team is full.',
  'release-unconfirmed': 'Confirm that you want to release this pet.',
  'pet-protected': 'Unequip and unprotect this pet before releasing it.',
  'last-pet': 'Keep at least one pet in your habitat.',
  'fusion-unconfirmed': 'Confirm the companions you want to fuse.',
  'fusion-unavailable': 'Choose three matching available companions of the same species and variant.',
  'fusion-maxed': 'This variant is at the highest fusion tier.',
  'farm-area-locked': 'Unlock this field before assigning pets to it.',
  'farm-outside-area': 'Enter an unlocked crystal field before assigning your pets here.',
  'invalid-farm-policy': 'Choose an available targeting priority.',
  'unknown-crystal': 'This crystal reward is unavailable.',
  'generator-out-of-range': 'Approach the generator crank first.',
  'generator-unready': 'Fill a generator charge before hatching.',
  'generator-egg-changed': 'The selected egg changed. Check the generator before hatching.',
  'trade-unavailable': 'Both offers must contain available, unequipped, unlocked pets.',
  'trade-generation-locked': 'Both explorers must unlock the generations of the companions they receive.',
  'unknown-achievement': 'This achievement is unavailable.',
  'achievement-incomplete': 'Complete this achievement before claiming its reward.',
  'achievement-claimed': 'You already collected this achievement reward.',
  'rebirth-unconfirmed': 'Confirm that you want to spend the altar offering.',
  'rebirth-out-of-range': 'Approach the Rebirth Cave altar first.',
  'rebirth-level': 'Reach the next rebirth level requirement first.',
  'rebirth-maxed': 'You have reached the final altar rank for this region.',
  'unknown-action': 'That action is unavailable.'
};

function failure(progress, code, detail = {}) {
  return { progress, event: { type: 'error', code, message: messages[code], ...detail } };
}

export function hatchPlan(progress, eggId, { mode = 'manual', now = Date.now(), count } = {}) {
  const egg = eggById.get(eggId);
  const limits = progression(progress);
  const capacity = Math.min(limits.capacity - progress.inventory.length, maxPetSerial - progress.nextPetId + 1);
  const unitCost = egg ? (mode === 'generator' ? generatorEggCost(egg) : egg.cost) : 0;
  const affordable = egg ? Math.floor(progress.wallet.sunbeams / unitCost) : 0;
  const maxBatch = mode !== 'generator' && progress.upgrades.multiHatch ? 3 : 1;
  const preference = progress.settings.multiHatch ? maxBatch : 1;
  const request = count === undefined ? preference : Math.max(1, Math.min(maxBatch, integer(count, 1, 3)));
  let code;
  if (!egg) code = 'unknown-egg';
  else if (limits.generation < egg.generation) code = 'generation-locked';
  else if (limits.level < egg.level) code = 'egg-locked';
  else if (mode === 'auto' && !progress.upgrades.autoHatch) code = 'auto-hatch-locked';
  else if (capacity < 1) code = 'inventory-full';
  else if (!affordable) code = 'insufficient-sunbeams';
  else if (progress.hatchReadyAt > now) code = 'hatch-cooldown';
  const quantity = code ? 0 : Math.min(request, capacity, affordable);
  return { quantity, unitCost, spent: quantity * unitCost, code,
    retryAt: code === 'hatch-cooldown' ? progress.hatchReadyAt : undefined };
}

export function hatchOdds(progress, eggId) {
  const egg = eggById.get(eggId);
  if (!egg) return { pool: [], variants: [] };
  const speciesRank = progress.upgrades.eggLuck || 0;
  const variantRank = progress.upgrades.variantLuck || 0;
  const boosted = (records, applies, multiplier) => records.map(record => applies(record)
    ? { ...record, weight: Math.round(record.weight * multiplier) } : record);
  const pool = speciesRank ? boosted(egg.pool, record => scarceRarities.has(petById.get(record.speciesId).rarity), 1 + speciesRank * .15) : egg.pool;
  const variants = variantRank ? boosted(VARIANTS, record => record.id !== 'normal', 1 + variantRank * .20) : VARIANTS;
  return { pool, variants };
}

function isRare(pet) {
  return pet.variant !== 'normal' || scarceRarities.has(petById.get(pet.speciesId)?.rarity);
}

function equipBest(progress) {
  progress.equipped = progress.inventory.map(pet => ({ pet, score: petCombatStats(pet, progress).farmingPower }))
    .sort((first, second) => second.score - first.score || petSerial(first.pet.id) - petSerial(second.pet.id))
    .slice(0, teamCapacity(progress.upgrades)).map(({ pet }) => pet.id);
}

function receivePet(progress, speciesId, variant, now) {
  const pet = { id: `pet-${progress.nextPetId++}`, speciesId, variant,
    favorite: false, locked: false, obtainedAt: now };
  pet.locked = progress.settings.lockRare && isRare(pet);
  progress.inventory.push(pet);
  const fresh = !progress.discovered.includes(speciesId);
  const key = discoveryKey(pet);
  const knownVariant = progress.variantDiscoveries.includes(key);
  if (fresh) progress.discovered.push(speciesId);
  if (!knownVariant) progress.variantDiscoveries.push(key);
  return { pet, fresh, freshVariant: variant !== 'normal' && !knownVariant };
}

function hatch(progress, action, now, random) {
  const automatic = action.mode === 'auto';
  const plan = hatchPlan(progress, action.eggId, { mode: action.mode, count: action.count, now });
  if (plan.code) {
    const canWait = plan.code === 'hatch-cooldown' || (plan.code === 'inventory-full' && !progress.settings.stopOnFull);
    return failure(progress, plan.code, { retryAt: plan.retryAt,
      stopReason: automatic && !canWait ? plan.code : null });
  }
  const egg = eggById.get(action.eggId);
  const odds = hatchOdds(progress, action.eggId);
  const next = structuredClone(progress);
  const pets = [];
  const newSpecies = [];
  const stopReasons = [];
  for (let index = 0; index < plan.quantity; index++) {
    const { speciesId } = pickWeighted(odds.pool, random);
    const { id: variant } = pickWeighted(odds.variants, random);
    const { pet, fresh, freshVariant } = receivePet(next, speciesId, variant, now);
    pets.push(pet);
    if (fresh) newSpecies.push(speciesId);
    if (variant === 'shiny') next.stats.shinies = addNumber(next.stats.shinies, 1);
    if (variant !== 'normal') next.stats.rareVariants = addNumber(next.stats.rareVariants, 1);
    if (!automatic) continue;
    if (next.settings.stopVariants[variant]) stopReasons.push(`variant:${variant}`);
    if (fresh && next.settings.stopOnNew) stopReasons.push('new-discovery');
    if (freshVariant && next.settings.stopOnNewVariant) stopReasons.push('new-variant');
    if (stopReasons.length) break;
  }
  const spent = pets.length * plan.unitCost;
  next.wallet.sunbeams -= spent;
  next.xp = addNumber(next.xp, pets.length * 7);
  next.stats.eggsHatched = addNumber(next.stats.eggsHatched, pets.length);
  next.stats.sunbeamsSpent = addNumber(next.stats.sunbeamsSpent, spent);
  next.hatchReadyAt = now + hatchIntervals[next.upgrades.hatchSpeed];
  if (next.settings.autoEquip) equipBest(next);
  next.hatchHistory.unshift({ type: 'hatch', eggId: egg.id, at: now, spent, pets: pets.map(pet => ({ ...pet })) });
  next.hatchHistory.length = Math.min(next.hatchHistory.length, maxHatchHistory);
  if (automatic && next.settings.stopOnFull && next.inventory.length >= storageCapacity(next.upgrades)) stopReasons.push('inventory-full');
  if (automatic && next.wallet.sunbeams < egg.cost) stopReasons.push('insufficient-sunbeams');
  return { progress: next, event: { type: 'hatch', eggId: egg.id, pets, newSpecies, spent,
    stopReason: stopReasons[0] || null, stopReasons } };
}

function validPosition(position) {
  return Number.isFinite(position?.x) && Number.isFinite(position?.z) &&
    Math.abs(position.x) <= WORLD_LIMIT && Math.abs(position.z) <= WORLD_LIMIT;
}

function withinRange(position, target, distance) {
  return validPosition(position) && Math.hypot(position.x - target.x, position.z - target.z) <= distance;
}

function gather(progress, action, now, position) {
  const node = nodeById.get(action.nodeId);
  if (!node) return failure(progress, 'unknown-node');
  if (position !== undefined && !withinRange(position, node, GATHER_DISTANCE + .65)) return failure(progress, 'resource-out-of-range');
  if (action.mode === 'auto') {
    if (!progress.upgrades.autoCollect || !progress.settings.autoCollect) return failure(progress, 'auto-collect-locked');
    if (!progress.equipped.length) return failure(progress, 'no-equipped-pets');
  }
  const retryAt = progress.nodeReadyAt[node.id] || 0;
  if (retryAt > now) return failure(progress, 'node-cooldown', { retryAt });
  const pending = (progress.drops || []).filter(drop => drop.expiresAt > now);
  const serial = progress.nextDropId || 1;
  if (pending.filter(drop => drop.kind !== 'crystal-gold').length >= maxDrops ||
      pending.some(drop => drop.nodeId === node.id) || serial > maxPetSerial) {
    return failure(progress, 'magnet-pending');
  }
  const magnet = magnetStats(progress);
  const base = node.reward + Math.floor(Math.sqrt(progression(progress).power) * 1.45) + progress.upgrades.harvest * 2;
  const sunbeams = Math.round(base * magnet.efficiency);
  const crystals = node.crystals || 0;
  const drop = { id: `drop-${serial}`, nodeId: node.id, x: node.x, z: node.z, sunbeams, crystals,
    readyAt: now + Math.ceil(3000 / magnet.speed), expiresAt: now + dropLifetime };
  const readyAt = now + node.cooldownMs;
  const next = { ...progress, drops: [...pending, drop], nextDropId: serial + 1,
    nodeReadyAt: { ...progress.nodeReadyAt, [node.id]: readyAt } };
  return { progress: next, event: { type: 'gather', nodeId: node.id, drop, readyAt } };
}

// Only the crystal simulation calls this after a player's equipped pets earn a break.
export function awardCrystalBreak(progress, { crystalId, areaId, gold, crystals = 0, specialTier = 0,
  now: occurredAt } = {}, { now = occurredAt ?? Date.now() } = {}) {
  const site = crystalAtId(crystalId);
  if (!site || areaId !== site.areaId || !canFarmArea(progress, areaId) || !integer(gold) ||
      !Number.isSafeInteger(crystals) || crystals < 0 || !Number.isSafeInteger(specialTier) || specialTier < 0) {
    return failure(progress, 'unknown-crystal');
  }
  const pending = (progress.drops || []).filter(drop => drop.expiresAt > now);
  const stack = pending.find(drop => drop.kind === 'crystal-gold' && drop.crystalId === site.id);
  const serial = progress.nextDropId || 1;
  if (!stack && serial > maxPetSerial) return failure(progress, 'magnet-pending');
  const magnet = magnetStats(progress);
  const sunbeams = Math.round((gold + (progress.upgrades.harvest || 0) * 2) * magnet.efficiency);
  const drop = { id: stack?.id || `drop-${serial}`, kind: 'crystal-gold', nodeId: site.id, crystalId: site.id, areaId: site.areaId,
    x: site.x, z: site.z, sunbeams: addNumber(stack?.sunbeams || 0, sunbeams), crystals: addNumber(stack?.crystals || 0, crystals),
    count: addNumber(stack?.count || 0, 1), readyAt: stack?.readyAt ?? timestamp(now) + Math.ceil(3000 / magnet.speed),
    expiresAt: Number.MAX_SAFE_INTEGER };
  const stats = { ...progress.stats, crystalsDestroyed: addNumber(progress.stats.crystalsDestroyed || 0, 1),
    specialCrystalsDestroyed: addNumber(progress.stats.specialCrystalsDestroyed || 0, specialTier > 0 ? 1 : 0) };
  const next = { ...progress, stats, drops: stack ? pending.map(entry => entry.id === stack.id ? drop : entry) : [...pending, drop],
    nextDropId: stack ? serial : serial + 1 };
  return { progress: next, event: { type: 'crystal-break', crystalId: site.id, areaId, specialTier, drop } };
}

function collect(progress, dropId, now, position, { remote = false, cranking = false } = {}) {
  const drop = (progress.drops || []).find(entry => entry.id === dropId);
  if (!drop || drop.expiresAt <= now) return failure(progress, 'drop-unavailable');
  if (drop.readyAt > now) return failure(progress, 'drop-cooldown', { retryAt: drop.readyAt });
  const magnet = magnetStats(progress);
  if (!remote && !withinRange(position, drop, magnet.radius)) return failure(progress, 'drop-out-of-range');
  const crystalDrop = drop.kind === 'crystal-gold';
  let magnetBusyUntil = progress.magnetBusyUntil || [];
  if (crystalDrop) {
    if (progress.wallet.sunbeams + drop.sunbeams > maxNumber) return failure(progress, 'gold-wallet-full');
    magnetBusyUntil = magnetBusyUntil.filter(time => time > now);
    if (magnetBusyUntil.length >= magnet.maxSimultaneous) return failure(progress, 'drop-cooldown', { retryAt: Math.min(...magnetBusyUntil) });
    magnetBusyUntil.push(now + Math.ceil(3000 / magnet.speed));
  }
  const count = drop.count || 1;
  const wallet = { ...progress.wallet,
    sunbeams: addNumber(progress.wallet.sunbeams, drop.sunbeams), crystals: addNumber(progress.wallet.crystals, drop.crystals) };
  const stats = { ...progress.stats, resourcesCollected: addNumber(progress.stats.resourcesCollected, count),
    goldEarned: addNumber(progress.stats.goldEarned || 0, wallet.sunbeams - progress.wallet.sunbeams),
    crankGold: addNumber(progress.stats.crankGold || 0, crystalDrop && cranking ? wallet.sunbeams - progress.wallet.sunbeams : 0) };
  const next = { ...progress, wallet, xp: addNumber(progress.xp, (drop.crystals ? 8 : 6) * count), stats, magnetBusyUntil,
    drops: progress.drops.filter(entry => entry.id !== drop.id && entry.expiresAt > now) };
  const { id, nodeId, x, z } = drop;
  return { progress: next, event: { type: 'collect', dropId: id, nodeId, x, z, sunbeams: wallet.sunbeams - progress.wallet.sunbeams,
    crystals: wallet.crystals - progress.wallet.crystals, ...(crystalDrop ? { crystalId: drop.crystalId, areaId: drop.areaId, remote, count } : {}) } };
}

export function collectEligibleDrops(progress, { now = Date.now(), position, cranking = false, autoOnly = true } = {}) {
  const events = [];
  const magnet = magnetStats(progress);
  const area = farmSettings(progress).area;
  if (!validPosition(position) || autoOnly && !magnet.autoCollect && !(magnet.remote && area)) return { progress, events };
  let next = progress;
  const candidates = (progress.drops || []).filter(drop => drop.kind === 'crystal-gold' && drop.readyAt <= now)
    .sort((first, second) => first.readyAt - second.readyAt);
  for (const drop of candidates) {
    if (events.length >= magnet.maxSimultaneous) break;
    const local = withinRange(position, drop, magnet.radius);
    const remote = !local && Boolean(magnet.remote && area && drop.areaId === area && now >= drop.readyAt + 550);
    if (!remote && !(local && (magnet.autoCollect || !autoOnly))) continue;
    const result = collect(next, drop.id, timestamp(now), position, { remote, cranking });
    if (result.event.type !== 'collect') continue;
    next = result.progress;
    events.push(result.event);
  }
  return { progress: next, events };
}

function rebirth(progress, action, position) {
  if (action.confirm !== true) return failure(progress, 'rebirth-unconfirmed');
  if (!withinRange(position, REBIRTH_ALTAR, REBIRTH_ALTAR.radius)) return failure(progress, 'rebirth-out-of-range');
  const plan = rebirthPlan(progress);
  if (!plan.available) return failure(progress, plan.reason);
  const wallet = { sunbeams: progress.wallet.sunbeams - plan.requirements.sunbeams,
    crystals: progress.wallet.crystals - plan.requirements.crystals,
    ascension: addNumber(progress.wallet.ascension || 0, plan.rewards.ascension) };
  const next = { ...progress, wallet, rebirths: plan.count + 1 };
  return { progress: next, event: { type: 'rebirth', rebirths: next.rebirths, ...plan.rewards, x: REBIRTH_ALTAR.x, z: REBIRTH_ALTAR.z } };
}

function claim(progress, id) {
  if (!achievementById.has(id)) return failure(progress, 'unknown-achievement');
  const achievement = achievementStatus(progress).find(entry => entry.id === id);
  if (achievement.isClaimed) return failure(progress, 'achievement-claimed');
  if (!achievement.isReady) return failure(progress, 'achievement-incomplete');
  const wallet = { ...progress.wallet, ascension: addNumber(progress.wallet.ascension || 0, achievement.reward) };
  return { progress: { ...progress, wallet, achievements: [...progress.achievements, id] },
    event: { type: 'claim', achievementId: id, ascension: achievement.reward, points: achievement.points } };
}

function buyUpgrade(progress, id) {
  const upgrade = upgradeById.get(id);
  if (!upgrade) return failure(progress, 'unknown-upgrade');
  const rank = progress.upgrades[id] || 0;
  const cost = upgrade.costs[rank];
  if (cost === undefined) return failure(progress, 'upgrade-complete');
  if (upgrade.rebirths && (progress.rebirths || 0) < upgrade.rebirths) return failure(progress, 'upgrade-rebirth-locked');
  if (progression(progress).level < upgrade.level) return failure(progress, 'upgrade-locked');
  if ((progress.wallet[upgrade.currency] || 0) < cost) return failure(progress, `insufficient-${upgrade.currency}`);
  const next = structuredClone(progress);
  next.wallet[upgrade.currency] -= cost;
  next.upgrades[id] = rank + 1;
  if (next.settings.autoEquip && ['teamSize', 'petDamage', 'attackRate', 'petSpeed'].includes(id)) equipBest(next);
  return { progress: next, event: { type: 'upgrade', id, rank: next.upgrades[id], spent: cost, currency: upgrade.currency } };
}

function updatePet(progress, action) {
  const index = progress.inventory.findIndex(pet => pet.id === action.petId);
  if (index < 0) return failure(progress, 'unknown-pet');
  const active = progress.equipped.includes(action.petId);
  if (action.type === 'equip' && !active && progress.equipped.length >= teamCapacity(progress.upgrades)) {
    return failure(progress, 'team-full');
  }
  const next = structuredClone(progress);
  const pet = next.inventory[index];
  let enabled;
  if (action.type === 'equip') {
    if (active) next.equipped = next.equipped.filter(id => id !== pet.id);
    else next.equipped.push(pet.id);
    enabled = !active;
  } else {
    const flag = action.type === 'favorite' ? 'favorite' : 'locked';
    pet[flag] = !pet[flag];
    enabled = pet[flag];
  }
  return { progress: next, event: { type: action.type, petId: pet.id, enabled } };
}

function releasePet(progress, action) {
  const pet = progress.inventory.find(entry => entry.id === action.petId);
  if (!pet) return failure(progress, 'unknown-pet');
  if (action.confirm !== true) return failure(progress, 'release-unconfirmed');
  if (pet.favorite || pet.locked || progress.equipped.includes(pet.id)) return failure(progress, 'pet-protected');
  if (progress.inventory.length === 1) return failure(progress, 'last-pet');
  return { progress: { ...progress, inventory: progress.inventory.filter(entry => entry.id !== pet.id) },
    event: { type: 'release', petId: pet.id } };
}

function canFusePet(progress, pet) {
  return pet && !pet.favorite && !pet.locked && !progress.equipped.includes(pet.id);
}

export function fusionPlan(progress, petIds) {
  if (!Array.isArray(petIds) || petIds.length !== 3 || new Set(petIds).size !== 3) return { code: 'fusion-unavailable' };
  const consumed = petIds.map(id => progress.inventory.find(pet => pet.id === id));
  if (!consumed.every(pet => canFusePet(progress, pet))) return { code: 'fusion-unavailable' };
  const { speciesId, variant } = consumed[0];
  if (!consumed.every(pet => pet.speciesId === speciesId && pet.variant === variant)) return { code: 'fusion-unavailable' };
  if (!fusionTiers[variant]) return { code: 'fusion-maxed' };
  if (progress.nextPetId > maxPetSerial) return { code: 'inventory-full' };
  return { petIds: [...petIds], consumed, result: { speciesId, variant: fusionTiers[variant] } };
}

export function fusionOptions(progress) {
  const duplicates = new Map();
  for (const pet of progress.inventory) {
    if (!canFusePet(progress, pet) || !fusionTiers[pet.variant]) continue;
    const key = discoveryKey(pet);
    if (!duplicates.has(key)) duplicates.set(key, []);
    const group = duplicates.get(key);
    if (group.length < 3) group.push(pet.id);
  }
  return [...duplicates.values()].filter(ids => ids.length === 3)
    .map(ids => fusionPlan(progress, ids)).filter(plan => !plan.code);
}

function fuse(progress, action, now) {
  if (action.confirm !== true) return failure(progress, 'fusion-unconfirmed');
  const plan = fusionPlan(progress, action.petIds);
  if (plan.code) return failure(progress, plan.code);
  const next = structuredClone(progress);
  next.inventory = next.inventory.filter(pet => !plan.petIds.includes(pet.id));
  const { pet } = receivePet(next, plan.result.speciesId, plan.result.variant, now);
  next.stats.fusions = addNumber(next.stats.fusions || 0, 1);
  if (next.settings.autoEquip) equipBest(next);
  return { progress: next, event: { type: 'fuse', pet, consumed: plan.petIds } };
}

function farmAction(progress, action, position) {
  const settings = action.type === 'assign-farm-here' ? { area: farmingAreaAt(position)?.id, enabled: true } : action.settings;
  if (action.type === 'assign-farm-here' && !settings.area) return failure(progress, 'farm-outside-area');
  if (!settings || typeof settings !== 'object') return failure(progress, 'unknown-action');
  const area = settings.area;
  if (area !== undefined && area !== null && !canFarmArea(progress, area)) return failure(progress, 'farm-area-locked');
  if (settings.policy !== undefined && !FARM_PRIORITIES.some(policy => policy.id === settings.policy)) {
    return failure(progress, 'invalid-farm-policy');
  }
  const current = farmSettings(progress);
  const farming = { ...current };
  if (area !== undefined) farming.area = area;
  for (const key of ['enabled', 'preferSpecial']) {
    if (typeof settings[key] === 'boolean') farming[key] = settings[key];
  }
  if (settings.policy !== undefined) farming.policy = settings.policy;
  const history = progress.assignedFarmAreas || [];
  const assignedFarmAreas = farming.area && !history.includes(farming.area) ? [...history, farming.area] : history;
  const stats = { ...progress.stats, assignedAreas: assignedFarmAreas.length };
  return { progress: { ...progress, farming, stats, assignedFarmAreas }, event: { type: 'farm-settings', farming } };
}

function generatorHatch(progress, action, now, position, random) {
  if (!canOperateGenerator(position)) return failure(progress, 'generator-out-of-range');
  const plan = generatorPlan(progress);
  if (!plan.ready) return failure(progress, 'generator-unready');
  if (action.eggId !== undefined && action.eggId !== plan.eggId) return failure(progress, 'generator-egg-changed');
  const result = hatch(progress, { eggId: plan.eggId, mode: 'generator', count: 1 }, now, random);
  if (result.event.type !== 'hatch') return result;
  return spendGeneratorCharge(result.progress, result.event, { now });
}

export function applyAction(progress, action, { now = Date.now(), random = Math.random, position, cranking = false } = {}) {
  switch (action?.type) {
    case 'hatch': return hatch(progress, { ...action, mode: action.mode === 'auto' ? 'auto' : 'manual' }, timestamp(now), random);
    case 'gather': return gather(progress, action, timestamp(now), position);
    case 'collect': return collect(progress, action.dropId, timestamp(now), position, { cranking });
    case 'farm-settings':
    case 'assign-farm-here': return farmAction(progress, action, position);
    case 'generatorSelect': return generatorAction(progress, action, { eggs: EGGS, level: progression(progress).level });
    case 'generatorClaim': return generatorHatch(progress, action, timestamp(now), position, random);
    case 'rebirth': return rebirth(progress, action, position);
    case 'claim': return claim(progress, action.achievementId);
    case 'upgrade': return buyUpgrade(progress, action.id);
    case 'release': return releasePet(progress, action);
    case 'fuse': return fuse(progress, action, timestamp(now));
    case 'equip':
    case 'favorite':
    case 'lock': return updatePet(progress, action);
    case 'equip-best': {
      const next = structuredClone(progress);
      equipBest(next);
      return { progress: next, event: { type: 'equip-best' } };
    }
    case 'settings': {
      const next = structuredClone(progress);
      next.settings = updateSettings(progress.settings, action.settings);
      if (next.settings.autoEquip && !progress.settings.autoEquip) equipBest(next);
      if (next.settings.lockRare && !progress.settings.lockRare) {
        for (const pet of next.inventory) if (isRare(pet)) pet.locked = true;
      }
      return { progress: next, event: { type: 'settings' } };
    }
    default: return failure(progress, 'unknown-action');
  }
}

function offeredPets(progress, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4 || new Set(ids).size !== ids.length) return null;
  const pets = ids.map(id => progress.inventory.find(pet => pet.id === id));
  return pets.every(pet => pet && !pet.locked && !pet.favorite && !progress.equipped.includes(pet.id)) ? pets : null;
}

export function exchangePets(first, second, { firstIds, secondIds } = {}, { now = Date.now() } = {}) {
  const sends = offeredPets(first, firstIds);
  const receives = offeredPets(second, secondIds);
  const fail = code => ({ first, second, event: { type: 'error', code, message: messages[code] } });
  if (first === second || !sends || !receives) return fail('trade-unavailable');
  const firstGeneration = progression(first).generation;
  const secondGeneration = progression(second).generation;
  if (receives.some(pet => petById.get(pet.speciesId).generation > firstGeneration) ||
      sends.some(pet => petById.get(pet.speciesId).generation > secondGeneration)) return fail('trade-generation-locked');
  if (first.inventory.length - sends.length + receives.length > storageCapacity(first.upgrades) ||
      second.inventory.length - receives.length + sends.length > storageCapacity(second.upgrades) ||
      first.nextPetId + receives.length - 1 > maxPetSerial || second.nextPetId + sends.length - 1 > maxPetSerial) {
    return fail('inventory-full');
  }
  const firstNext = structuredClone(first);
  const secondNext = structuredClone(second);
  firstNext.inventory = firstNext.inventory.filter(pet => !firstIds.includes(pet.id));
  secondNext.inventory = secondNext.inventory.filter(pet => !secondIds.includes(pet.id));
  const receivedAt = timestamp(now);
  const firstReceived = receives.map(pet => receivePet(firstNext, pet.speciesId, pet.variant, receivedAt).pet);
  const secondReceived = sends.map(pet => receivePet(secondNext, pet.speciesId, pet.variant, receivedAt).pet);
  if (firstNext.settings.autoEquip) equipBest(firstNext);
  if (secondNext.settings.autoEquip) equipBest(secondNext);
  return { first: firstNext, second: secondNext, event: { type: 'trade', firstReceived, secondReceived } };
}
