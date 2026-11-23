export const SAVE_VERSION = 1;
export const WORLD_LIMIT = 27;
export const SPAWN = Object.freeze({ x: 0, z: 11 });
export const HATCHERY = Object.freeze({ x: 0, z: -4 });
export const GATHER_DISTANCE = 3;

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
  { id: 'auroracub', name: 'Auroracub', rarity: 'mythic', power: 42, color: '#3c5d92', accent: '#a4ffd7', shape: 'bear' }
]);

function weightedPool(start, weights) {
  return frozenCatalog(weights.map((weight, index) => ({ speciesId: PETS[start + index].id, weight })));
}

export const EGGS = frozenCatalog([
  { id: 'sunmeadow', name: 'Sunmeadow Egg', description: 'Warm shells from Sunstep Meadow. A gentle start with two elusive finds.', cost: 18, level: 1, color: '#ffcb78',
    pool: weightedPool(0, [2400, 1900, 1700, 1450, 1000, 680, 470, 240, 120, 40]) },
  { id: 'moonbloom', name: 'Moonbloom Egg', description: 'An evening bloom with a stronger collection and the chance to meet Auroracub.', cost: 62, level: 3, color: '#b7a2ff',
    pool: weightedPool(10, [2150, 1800, 1550, 1350, 1100, 850, 600, 370, 180, 50]) }
]);

export const VARIANTS = frozenCatalog([
  { id: 'normal', name: 'Standard', weight: 9180, multiplier: 1, color: '#c5d4cb' },
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
  { id: 'autoHatch', name: 'Auto Hatch', description: 'Unlocks a repeat hatch you start yourself each session.', costs: [36], level: 2 },
  { id: 'hatchSpeed', name: 'Hatch speed', description: 'Shortens the time between hatches.', costs: [42, 98, 180], level: 2 },
  { id: 'multiHatch', name: 'Multi-Hatch', description: 'Unlocks hatching up to three eggs at a time.', costs: [70], level: 3 },
  { id: 'autoCollect', name: 'Auto Collect', description: 'Lets equipped pets gather nearby ready nodes when enabled.', costs: [58], level: 3 },
  { id: 'harvest', name: 'Harvest bonus', description: 'Collects two more sunbeams per node for each rank.', costs: [32, 68, 128], level: 2 },
  { id: 'teamSize', name: 'Team size', description: 'Adds one equipped pet slot per rank.', costs: [52, 135], level: 3 },
  { id: 'capacity', name: 'Habitat space', description: 'Adds twelve inventory spaces per rank.', costs: [4, 9, 16], currency: 'crystals', level: 2 }
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
const maxHatchHistory = 24;
const validProgressKey = /^pet-[1-9]\d{0,11}$/;
const statsKeys = ['eggsHatched', 'sunbeamsSpent', 'resourcesCollected', 'shinies', 'rareVariants'];

const defaultSettings = Object.freeze({
  stopVariants: Object.freeze(Object.fromEntries(variantIds.map(id => [id, id === 'shiny']))),
  stopOnNew: false,
  stopOnFull: true,
  autoEquip: true,
  lockRare: true,
  multiHatch: false,
  autoCollect: false
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
    wallet: { sunbeams: 40, crystals: 0 },
    xp: 0,
    inventory: [starter],
    equipped: [starter.id],
    discovered: [starter.speciesId],
    variantDiscoveries: [discoveryKey(starter)],
    upgrades: Object.fromEntries(UPGRADES.map(item => [item.id, 0])),
    settings: updateSettings(defaultSettings),
    stats: Object.fromEntries(statsKeys.map(key => [key, 0])),
    nodeReadyAt: {},
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

export function progression(progress) {
  const { xp, upgrades } = progress;
  const level = Math.floor((1 + Math.sqrt(1 + xp / 3)) / 2);
  return {
    level, xp,
    levelStartXp: 12 * level * (level - 1),
    nextLevelXp: 12 * level * (level + 1),
    hatchInterval: hatchIntervals[upgrades.hatchSpeed],
    capacity: storageCapacity(upgrades),
    equipSlots: teamCapacity(upgrades),
    power: progress.inventory.filter(pet => progress.equipped.includes(pet.id)).reduce((total, pet) => total + petPower(pet), 0)
  };
}

export function restoreProgress(value) {
  if (!value || value.version !== SAVE_VERSION || !Array.isArray(value.inventory)) return createProgress();
  const progress = createProgress();
  progress.wallet = { sunbeams: integer(value.wallet?.sunbeams), crystals: integer(value.wallet?.crystals) };
  progress.xp = integer(value.xp);
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
  for (const node of NODES) {
    const time = timestamp(value.nodeReadyAt?.[node.id]);
    if (time) progress.nodeReadyAt[node.id] = time;
  }
  progress.hatchReadyAt = timestamp(value.hatchReadyAt);
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
  'auto-hatch-locked': 'Unlock Auto Hatch in Upgrades first.',
  'auto-collect-locked': 'Unlock Auto Collect and turn it on first.',
  'no-equipped-pets': 'Equip a pet before using Auto Collect.',
  'hatch-cooldown': 'The hatchery is still preparing the next egg.',
  'inventory-full': 'Your habitat is full.',
  'insufficient-sunbeams': 'Collect more sunbeams first.',
  'insufficient-crystals': 'Collect more crystals first.',
  'unknown-node': 'This resource is unavailable.',
  'node-cooldown': 'This resource is regrowing.',
  'unknown-pet': 'That pet is unavailable.',
  'unknown-upgrade': 'That upgrade is unavailable.',
  'upgrade-locked': 'Level up to unlock this upgrade.',
  'upgrade-complete': 'This upgrade is already complete.',
  'team-full': 'Your pet team is full.',
  'release-unconfirmed': 'Confirm that you want to release this pet.',
  'pet-protected': 'Unequip and unprotect this pet before releasing it.',
  'last-pet': 'Keep at least one pet in your habitat.',
  'trade-unavailable': 'Both offers must contain available, unequipped, unlocked pets.',
  'unknown-action': 'That action is unavailable.'
};

function failure(progress, code, detail = {}) {
  return { progress, event: { type: 'error', code, message: messages[code], ...detail } };
}

export function hatchPlan(progress, eggId, { mode = 'manual', now = Date.now(), count } = {}) {
  const egg = eggById.get(eggId);
  const limits = progression(progress);
  const capacity = Math.min(limits.capacity - progress.inventory.length, maxPetSerial - progress.nextPetId + 1);
  const affordable = egg ? Math.floor(progress.wallet.sunbeams / egg.cost) : 0;
  const maxBatch = progress.upgrades.multiHatch ? 3 : 1;
  const preference = progress.settings.multiHatch ? maxBatch : 1;
  const request = count === undefined ? preference : Math.max(1, Math.min(maxBatch, integer(count, 1, 3)));
  let code;
  if (!egg) code = 'unknown-egg';
  else if (limits.level < egg.level) code = 'egg-locked';
  else if (mode === 'auto' && !progress.upgrades.autoHatch) code = 'auto-hatch-locked';
  else if (capacity < 1) code = 'inventory-full';
  else if (!affordable) code = 'insufficient-sunbeams';
  else if (progress.hatchReadyAt > now) code = 'hatch-cooldown';
  const quantity = code ? 0 : Math.min(request, capacity, affordable);
  return { quantity, spent: quantity ? quantity * egg.cost : 0, code,
    retryAt: code === 'hatch-cooldown' ? progress.hatchReadyAt : undefined };
}

function isRare(pet) {
  return pet.variant !== 'normal' || scarceRarities.has(petById.get(pet.speciesId)?.rarity);
}

function equipBest(progress) {
  progress.equipped = [...progress.inventory]
    .sort((first, second) => petPower(second) - petPower(first) || petSerial(first.id) - petSerial(second.id))
    .slice(0, teamCapacity(progress.upgrades)).map(pet => pet.id);
}

function receivePet(progress, speciesId, variant, now) {
  const pet = { id: `pet-${progress.nextPetId++}`, speciesId, variant,
    favorite: false, locked: false, obtainedAt: now };
  pet.locked = progress.settings.lockRare && isRare(pet);
  progress.inventory.push(pet);
  const fresh = !progress.discovered.includes(speciesId);
  const key = discoveryKey(pet);
  if (fresh) progress.discovered.push(speciesId);
  if (!progress.variantDiscoveries.includes(key)) progress.variantDiscoveries.push(key);
  return { pet, fresh };
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
  const next = structuredClone(progress);
  const pets = [];
  const newSpecies = [];
  const stopReasons = [];
  for (let index = 0; index < plan.quantity; index++) {
    const { speciesId } = pickWeighted(egg.pool, random);
    const { id: variant } = pickWeighted(VARIANTS, random);
    const { pet, fresh } = receivePet(next, speciesId, variant, now);
    pets.push(pet);
    if (fresh) newSpecies.push(speciesId);
    if (variant === 'shiny') next.stats.shinies = addNumber(next.stats.shinies, 1);
    if (variant !== 'normal') next.stats.rareVariants = addNumber(next.stats.rareVariants, 1);
    if (!automatic) continue;
    if (next.settings.stopVariants[variant]) stopReasons.push(`variant:${variant}`);
    if (fresh && next.settings.stopOnNew) stopReasons.push('new-discovery');
    if (stopReasons.length) break;
  }
  const spent = pets.length * egg.cost;
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

function gather(progress, action, now) {
  const node = nodeById.get(action.nodeId);
  if (!node) return failure(progress, 'unknown-node');
  if (action.mode === 'auto') {
    if (!progress.upgrades.autoCollect || !progress.settings.autoCollect) return failure(progress, 'auto-collect-locked');
    if (!progress.equipped.length) return failure(progress, 'no-equipped-pets');
  }
  const retryAt = progress.nodeReadyAt[node.id] || 0;
  if (retryAt > now) return failure(progress, 'node-cooldown', { retryAt });
  const next = structuredClone(progress);
  const sunbeams = node.reward + Math.floor(Math.sqrt(progression(progress).power) * 1.45) + next.upgrades.harvest * 2;
  const crystals = node.crystals || 0;
  next.wallet.sunbeams = addNumber(next.wallet.sunbeams, sunbeams);
  next.wallet.crystals = addNumber(next.wallet.crystals, crystals);
  next.xp = addNumber(next.xp, crystals ? 8 : 6);
  next.stats.resourcesCollected = addNumber(next.stats.resourcesCollected, 1);
  next.nodeReadyAt[node.id] = now + node.cooldownMs;
  return { progress: next, event: { type: 'gather', nodeId: node.id, sunbeams, crystals, readyAt: next.nodeReadyAt[node.id] } };
}

function buyUpgrade(progress, id) {
  const upgrade = upgradeById.get(id);
  if (!upgrade) return failure(progress, 'unknown-upgrade');
  const rank = progress.upgrades[id];
  const cost = upgrade.costs[rank];
  if (cost === undefined) return failure(progress, 'upgrade-complete');
  if (progression(progress).level < upgrade.level) return failure(progress, 'upgrade-locked');
  if (progress.wallet[upgrade.currency] < cost) return failure(progress, `insufficient-${upgrade.currency}`);
  const next = structuredClone(progress);
  next.wallet[upgrade.currency] -= cost;
  next.upgrades[id]++;
  if (id === 'teamSize' && next.settings.autoEquip) equipBest(next);
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

export function applyAction(progress, action, { now = Date.now(), random = Math.random } = {}) {
  switch (action?.type) {
    case 'hatch': return hatch(progress, action, timestamp(now), random);
    case 'gather': return gather(progress, action, timestamp(now));
    case 'upgrade': return buyUpgrade(progress, action.id);
    case 'release': return releasePet(progress, action);
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
