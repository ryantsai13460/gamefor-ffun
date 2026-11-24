import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACHIEVEMENTS, achievementStatus, applyAction, collectionMetrics, createProgress, EGGS, exchangePets,
  generationStatus, hatchPlan, magnetStats, NODES, PETS, petPower, progression, REBIRTH_ALTAR, rebirthPlan,
  restoreProgress, VARIANTS
} from '../assets/petverse/model.js';

const eggId = 'sunmeadow';
const hatch = (progress, rolls, options = {}) => {
  let index = 0;
  const random = () => {
    assert.ok(index < rolls.length, 'a stopped batch should use no further rolls');
    return rolls[index++];
  };
  return applyAction(progress, { type: 'hatch', eggId, mode: options.mode, count: options.count }, {
    now: options.now ?? 10_000, random
  });
};

function configure(progress, settings) {
  return applyAction(progress, { type: 'settings', settings }).progress;
}

function upgradedHatching(sunbeams = 450) {
  const practice = createProgress();
  practice.xp = 72;
  practice.wallet.sunbeams = sunbeams + 106;
  const automatic = applyAction(practice, { type: 'upgrade', id: 'autoHatch' });
  const multi = applyAction(automatic.progress, { type: 'upgrade', id: 'multiHatch' });
  assert.equal(automatic.event.type, 'upgrade');
  assert.equal(multi.event.type, 'upgrade');
  return configure(multi.progress, { multiHatch: true });
}

function farmNode(progress, node, now) {
  const gathered = applyAction(progress, { type: 'gather', nodeId: node.id }, { now, position: node });
  assert.equal(gathered.event.type, 'gather');
  const { drop } = gathered.event;
  const collected = applyAction(gathered.progress, { type: 'collect', dropId: drop.id }, { now: drop.readyAt, position: node });
  assert.equal(collected.event.type, 'collect');
  return collected.progress;
}

test('all eggs disclose the exact weighted chances for 500 playable species and nine forms', () => {
  assert.equal(PETS.length, 500);
  assert.equal(EGGS.length, 26);
  assert.equal(PETS.filter(pet => !pet.bestiary).length, 40);
  assert.equal(EGGS.filter(egg => !egg.bestiary).length, 6);
  assert.equal(VARIANTS.length, 9);
  assert.deepEqual(new Set(EGGS.flatMap(egg => egg.pool.map(entry => entry.speciesId))), new Set(PETS.map(pet => pet.id)));
  for (const egg of EGGS) {
    assert.equal(egg.pool.length, egg.bestiary ? 23 : egg.biomeId || egg.generation > 1 ? 5 : 10);
    assert.equal(egg.pool.reduce((sum, pet) => sum + pet.weight, 0), 10_000);
  }
  assert.equal(VARIANTS.reduce((sum, variant) => sum + variant.weight, 0), 10_000);
  const standard = { speciesId: 'sundrop', variant: 'normal' };
  assert.ok(petPower({ ...standard, variant: 'shiny' }) > petPower(standard));
  assert.equal(createProgress().discovered.length, 1);
});

test('resource rewards use equipped pet power and enter the wallet only once through an in-range pickup', () => {
  const initial = createProgress();
  const initialSnapshot = structuredClone(initial);
  const node = NODES[0];
  const action = { type: 'gather', nodeId: node.id };
  const now = 8000;
  assert.equal(applyAction(initial, action, { now, position: { x: 26, z: 26 } }).event.code, 'resource-out-of-range');
  const gathered = applyAction(initial, action, { now, position: node });
  assert.equal(gathered.event.type, 'gather');
  assert.equal(gathered.progress.wallet.sunbeams, initial.wallet.sunbeams);
  assert.equal(gathered.progress.xp, 0);
  const { drop } = gathered.event;
  assert.ok(drop.sunbeams > node.reward);
  assert.equal(drop.readyAt, now + 400);
  const pickup = { type: 'collect', dropId: drop.id };
  assert.equal(applyAction(gathered.progress, pickup, { now: drop.readyAt - 1, position: node }).event.code, 'drop-cooldown');
  assert.equal(applyAction(gathered.progress, pickup, { now: drop.readyAt, position: { x: 20, z: 20 } }).event.code, 'drop-out-of-range');
  assert.equal(applyAction(gathered.progress, pickup, { now: drop.readyAt }).event.code, 'drop-out-of-range');
  assert.equal(applyAction(gathered.progress, pickup, { now: drop.expiresAt, position: node }).event.code, 'drop-unavailable');
  const collected = applyAction(gathered.progress, pickup, { now: drop.readyAt, position: node });
  assert.equal(collected.event.type, 'collect');
  assert.equal(collected.progress.wallet.sunbeams, initial.wallet.sunbeams + drop.sunbeams);
  assert.equal(collected.progress.xp, 6);
  assert.equal(collected.progress.stats.resourcesCollected, 1);
  assert.equal(applyAction(collected.progress, pickup, { now: drop.readyAt, position: node }).event.code, 'drop-unavailable');
  assert.deepEqual(initial, initialSnapshot);
  const early = applyAction(gathered.progress, action, { now: gathered.event.readyAt - 1 });
  assert.equal(early.event.code, 'node-cooldown');
  assert.strictEqual(early.progress, gathered.progress);
  assert.equal(applyAction(gathered.progress, action, { now: gathered.event.readyAt }).event.code, 'magnet-pending');
  const next = farmNode(collected.progress, node, gathered.event.readyAt);
  assert.equal(next.stats.resourcesCollected, 2);
});

test('magnet upgrades extend actual collection radius, shorten pickup delay and raise rewards', () => {
  const initial = createProgress();
  initial.wallet.sunbeams = 250;
  initial.xp = 24;
  let progress = initial;
  for (const id of ['magnetRange', 'magnetSpeed', 'magnetEfficiency']) {
    const upgrade = applyAction(progress, { type: 'upgrade', id });
    assert.equal(upgrade.event.type, 'upgrade');
    progress = upgrade.progress;
  }
  assert.equal(magnetStats(progress).radius, 4.4);
  assert.equal(magnetStats(progress).speed, 10.5);
  assert.equal(magnetStats(progress).efficiency, 1.1);
  assert.equal(progress.wallet.sunbeams, 250 - 24 - 30 - 42);
  const node = NODES[0];
  const action = { type: 'gather', nodeId: node.id };
  const options = { now: 20_000, position: node };
  const earlier = applyAction(initial, action, options);
  const faster = applyAction(progress, action, options);
  assert.ok(faster.event.drop.readyAt < earlier.event.drop.readyAt);
  assert.ok(faster.event.drop.sunbeams > earlier.event.drop.sunbeams);
  const edge = { now: earlier.event.drop.readyAt, position: { x: node.x + 4, z: node.z } };
  assert.equal(applyAction(earlier.progress, { type: 'collect', dropId: earlier.event.drop.id }, edge).event.code, 'drop-out-of-range');
  assert.equal(applyAction(faster.progress, { type: 'collect', dropId: faster.event.drop.id }, edge).event.type, 'collect');
});

test('upgrade gates and charges match the progression advertised to the player', () => {
  const initial = createProgress();
  assert.equal(applyAction(initial, { type: 'upgrade', id: 'autoHatch' }).event.code, 'upgrade-locked');
  assert.equal(hatchPlan(initial, 'moonbloom').code, 'egg-locked');
  assert.equal(hatchPlan(initial, eggId, { mode: 'auto' }).code, 'auto-hatch-locked');
  assert.equal(hatchPlan(initial, eggId, { count: 3 }).quantity, 1);
  let progress = initial;
  for (const node of NODES.slice(0, 4)) progress = farmNode(progress, node, 5000);
  const level = progression(progress);
  assert.equal(level.level, 2);
  assert.equal(level.levelStartXp, 24);
  assert.equal(level.nextLevelXp, 72);
  const speed = applyAction(progress, { type: 'upgrade', id: 'hatchSpeed' });
  assert.equal(speed.event.spent, 42);
  assert.ok(progression(speed.progress).hatchInterval < level.hatchInterval);
  assert.equal(applyAction(progress, { type: 'upgrade', id: 'capacity' }).event.code, 'insufficient-crystals');
  for (const node of NODES.filter(node => node.kind === 'crystal').slice(0, 2)) {
    progress = farmNode(progress, node, 7000);
  }
  const capacity = applyAction(progress, { type: 'upgrade', id: 'capacity' });
  assert.equal(capacity.event.currency, 'crystals');
  assert.equal(capacity.progress.wallet.crystals, 0);
  assert.equal(progression(capacity.progress).capacity, level.capacity + 12);
});

test('three legitimate auto-hatches complete when the shiny stop is off', () => {
  const initial = configure(upgradedHatching(), { stopVariants: { shiny: false } });
  const result = hatch(initial, [0.25, 0.95, 0.5, 0.1, 0.8, 0.1], { mode: 'auto' });
  assert.deepEqual(result.event.pets.map(pet => pet.variant), ['shiny', 'normal', 'normal']);
  assert.equal(result.event.stopReason, null);
  assert.equal(result.event.spent, 54);
  assert.equal(result.progress.wallet.sunbeams, initial.wallet.sunbeams - 54);
  assert.equal(result.progress.stats.shinies, 1);
  assert.equal(result.progress.stats.eggsHatched, 3);
  assert.equal(result.progress.stats.sunbeamsSpent, 54);
  assert.equal(initial.inventory.length, 1);
  assert.ok(result.progress.variantDiscoveries.includes('thimblehare:shiny'));
  for (const pet of result.event.pets) assert.ok(result.progress.inventory.includes(pet));
});

test('auto-hatch stops after the awarded shiny, checks simultaneous triggers and only charges that egg', () => {
  const initial = configure(upgradedHatching(), { stopVariants: { shiny: true }, stopOnNew: true });
  const result = hatch(initial, [0.25, 0.95], { mode: 'auto' });
  assert.deepEqual(result.event.stopReasons, ['variant:shiny', 'new-discovery']);
  assert.equal(result.event.stopReason, 'variant:shiny');
  assert.deepEqual(result.event.newSpecies, ['thimblehare']);
  assert.equal(result.event.spent, 18);
  assert.equal(result.progress.wallet.sunbeams, initial.wallet.sunbeams - 18);
  assert.equal(result.progress.inventory.length, 2);
  assert.equal(result.progress.inventory[1].locked, true);
  assert.equal(result.progress.hatchHistory[0].pets[0].id, result.event.pets[0].id);

  const next = hatch(result.progress, [], { mode: 'auto', now: result.progress.hatchReadyAt - 1 });
  assert.equal(next.event.code, 'hatch-cooldown');
  assert.equal(next.event.stopReason, null);
  assert.equal(next.event.retryAt, result.progress.hatchReadyAt);
});

test('a shiny with its stop off does not mask the separate Mythic stop', () => {
  const initial = configure(upgradedHatching(), { stopVariants: { shiny: false, mythic: true } });
  const result = hatch(initial, [0.2, 0.95, 0.2, 0.9998], { mode: 'auto' });
  assert.deepEqual(result.event.pets.map(pet => pet.variant), ['shiny', 'mythic']);
  assert.equal(result.event.stopReason, 'variant:mythic');
  assert.equal(result.progress.stats.rareVariants, 2);
  assert.equal(result.event.spent, 36);
});

test('Titanium uses its published odds and only its own enabled stop setting ends a batch', () => {
  const disabled = configure(upgradedHatching(), { stopVariants: { titanium: false } });
  const completed = hatch(disabled, [0.25, 0.999, 0.5, 0.1, 0.8, 0.1], { mode: 'auto' });
  assert.deepEqual(completed.event.pets.map(pet => pet.variant), ['titanium', 'normal', 'normal']);
  assert.equal(completed.event.stopReason, null);
  const enabled = configure(upgradedHatching(), { stopVariants: { titanium: true } });
  const stopped = hatch(enabled, [0.25, 0.999], { mode: 'auto' });
  assert.equal(stopped.event.stopReason, 'variant:titanium');
  assert.equal(stopped.event.spent, 18);
  assert.equal(stopped.progress.inventory.at(-1).variant, 'titanium');
  assert.ok(petPower(stopped.progress.inventory.at(-1)) > petPower({ ...stopped.progress.inventory.at(-1), variant: 'normal' }));
  assert.equal(collectionMetrics(stopped.progress).titanium, 1);
});

test('insufficient money and full habitats stop charging exactly at their limits', () => {
  const initial = upgradedHatching(21);
  const lastEgg = hatch(initial, [0, 0], { mode: 'auto' });
  assert.equal(lastEgg.event.stopReason, 'insufficient-sunbeams');
  assert.equal(lastEgg.progress.wallet.sunbeams, 3);
  const rejected = hatch(lastEgg.progress, [], { mode: 'auto', now: lastEgg.progress.hatchReadyAt });
  assert.equal(rejected.event.code, 'insufficient-sunbeams');
  assert.strictEqual(rejected.progress, lastEgg.progress);

  const nearlyFull = upgradedHatching();
  const slots = progression(nearlyFull).capacity;
  while (nearlyFull.inventory.length < slots - 1) {
    nearlyFull.inventory.push({ ...nearlyFull.inventory[0], id: `pet-${nearlyFull.nextPetId++}` });
  }
  const full = hatch(nearlyFull, [0, 0], { mode: 'auto' });
  assert.equal(full.event.stopReason, 'inventory-full');
  assert.equal(full.event.spent, 18);
  assert.equal(full.progress.inventory.length, slots);
  const continueUntilRefusal = configure(nearlyFull, { stopOnFull: false });
  const lastSlot = hatch(continueUntilRefusal, [0, 0], { mode: 'auto' });
  assert.equal(lastSlot.event.stopReason, null);
  const refused = hatch(lastSlot.progress, [], { mode: 'auto', now: lastSlot.progress.hatchReadyAt });
  assert.equal(refused.event.stopReason, null);
  assert.equal(refused.event.code, 'inventory-full');
  assert.strictEqual(refused.progress, lastSlot.progress);
  const freed = applyAction(refused.progress, { type: 'release', petId: 'pet-3', confirm: true });
  const resumed = hatch(freed.progress, [0, 0], { mode: 'auto', now: freed.progress.hatchReadyAt });
  assert.equal(resumed.event.type, 'hatch');
  assert.equal(resumed.progress.inventory.length, slots);
});

test('auto collect requires both the enabled upgrade and an equipped team', () => {
  const initial = upgradedHatching();
  const action = { type: 'gather', nodeId: NODES[0].id, mode: 'auto' };
  assert.equal(applyAction(initial, action).event.code, 'auto-collect-locked');
  const unlocked = applyAction(initial, { type: 'upgrade', id: 'autoCollect' }).progress;
  assert.equal(applyAction(unlocked, action).event.code, 'auto-collect-locked');
  const enabled = configure(unlocked, { autoCollect: true });
  assert.equal(applyAction(enabled, action).event.type, 'gather');
  const noTeam = applyAction(enabled, { type: 'equip', petId: enabled.equipped[0] }).progress;
  assert.equal(applyAction(noTeam, action).event.code, 'no-equipped-pets');
});

test('saves restore bounded known data without resuming any automated session', () => {
  const initial = configure(upgradedHatching(), { stopVariants: { shiny: false, gold: true }, stopOnNew: true });
  const { progress } = hatch(initial, [0.25, 0.95], { count: 1 });
  const saved = JSON.parse(JSON.stringify(progress));
  saved.inventory.push(saved.inventory[0], { id: 'pet-30', speciesId: 'unknown', variant: 'mythic' });
  saved.equipped.push('pet-999');
  saved.nextPetId = 0;
  saved.wallet.crystals = -10;
  saved.settings.stopVariants.bogus = true;
  saved.settings.autoHatching = true;
  saved.nodeReadyAt['missing-node'] = 1;
  const restored = restoreProgress(saved);
  assert.equal(restored.inventory.length, 2);
  assert.equal(restored.nextPetId, 3);
  assert.deepEqual(restored.equipped, progress.equipped);
  assert.equal(restored.settings.stopVariants.shiny, false);
  assert.equal(restored.settings.stopVariants.gold, true);
  assert.equal(restored.settings.stopOnNew, true);
  assert.equal(restored.settings.autoHatching, undefined);
  assert.equal(restored.settings.stopVariants.bogus, undefined);
  assert.equal(restored.nodeReadyAt['missing-node'], undefined);
  assert.equal(restored.wallet.crystals, 0);
  assert.deepEqual(restored.hatchHistory, progress.hatchHistory);
  assert.deepEqual(restoreProgress({ ...saved, version: 100 }), createProgress());
});

test('an old save keeps pet IDs and gains compatible defaults for the meadow expansion', () => {
  const { progress } = hatch(createProgress(), [0.25, 0.95]);
  const old = structuredClone(progress);
  delete old.wallet.ascension;
  delete old.rebirths;
  delete old.achievements;
  delete old.drops;
  delete old.nextDropId;
  for (const key of ['magnetRange', 'magnetSpeed', 'magnetEfficiency', 'ascensionReach', 'ascensionYield']) delete old.upgrades[key];
  assert.deepEqual(restoreProgress(old), progress);
});

test('pending drops survive legitimate refreshes, retain serials and time out without payment', () => {
  const initial = createProgress();
  const node = NODES[0];
  const now = 60_000;
  const gathered = applyAction(initial, { type: 'gather', nodeId: node.id }, { now, position: node });
  const { drop } = gathered.event;
  const roundTrip = restoreProgress(JSON.parse(JSON.stringify(gathered.progress)), { now: now + 1 });
  assert.deepEqual(roundTrip, gathered.progress);
  const expired = restoreProgress(roundTrip, { now: drop.expiresAt });
  assert.equal(expired.drops.length, 0);
  assert.equal(expired.wallet.sunbeams, initial.wallet.sunbeams);
  const replacement = applyAction(expired, { type: 'gather', nodeId: node.id }, { now: drop.expiresAt, position: node });
  assert.equal(replacement.event.drop.id, 'drop-2');
});

test('rebirth requires confirmation and altar proximity, then preserves the collection and unlocks Emberdeep', () => {
  const initial = createProgress();
  const position = REBIRTH_ALTAR;
  const action = { type: 'rebirth', confirm: true };
  assert.deepEqual(rebirthPlan(initial).requirements, { level: 3, sunbeams: 95, crystals: 4 });
  assert.equal(applyAction(initial, action, { position }).event.code, 'rebirth-level');
  assert.equal(applyAction(initial, { ...action, confirm: false }, { position }).event.code, 'rebirth-unconfirmed');
  assert.equal(applyAction(initial, action, { position: { x: 0, z: 0 } }).event.code, 'rebirth-out-of-range');
  assert.equal(hatchPlan(initial, 'embergeode').code, 'generation-locked');
  assert.equal(generationStatus(initial).find(generation => generation.id === 2).unlocked, false);
  const funded = hatch(initial, [0.25, 0.999]).progress;
  funded.xp = 72;
  funded.wallet.sunbeams = 300;
  funded.wallet.crystals = 4;
  const { progress, event } = applyAction(funded, action, { position });
  assert.equal(event.type, 'rebirth');
  assert.equal(event.generation, 2);
  assert.equal(progress.rebirths, 1);
  assert.deepEqual(progress.wallet, { sunbeams: 205, crystals: 0, ascension: 2 });
  for (const key of ['inventory', 'discovered', 'equipped', 'variantDiscoveries', 'upgrades', 'xp', 'stats']) {
    assert.deepEqual(progress[key], funded[key]);
  }
  assert.ok(magnetStats(progress).radius > magnetStats(funded).radius);
  assert.ok(magnetStats(progress).efficiency > magnetStats(funded).efficiency);
  assert.deepEqual(restoreProgress(JSON.parse(JSON.stringify(progress))), progress);
  assert.equal(progression(progress).generation, 2);
  assert.equal(generationStatus(progress)[1].unlocked, true);
  assert.equal(rebirthPlan(progress).reason, 'rebirth-level');
  const found = applyAction(progress, { type: 'hatch', eggId: 'embergeode' }, { now: 20_000, random: () => .03 });
  assert.equal(found.event.pets[0].speciesId, 'cinderskip');
  assert.equal(generationStatus(found.progress)[1].discovered, 1);
  const unlocked = applyAction(found.progress, { type: 'equip', petId: 'pet-3' }).progress;
  const meadow = hatch(configure(initial, { autoEquip: false }), [0.25, 0.1]).progress;
  const refused = exchangePets(unlocked, meadow, { firstIds: ['pet-3'], secondIds: ['pet-2'] });
  assert.equal(refused.event.code, 'trade-generation-locked');
  assert.strictEqual(refused.first, unlocked);
  assert.strictEqual(refused.second, meadow);
});

test('achievement claims and leaderboard scores use validated collection and progression totals', () => {
  const initial = createProgress();
  const claim = { type: 'claim', achievementId: 'first-hatch' };
  assert.equal(applyAction(initial, claim).event.code, 'achievement-incomplete');
  const progress = hatch(initial, [0.25, 0.95]).progress;
  const before = collectionMetrics(progress);
  assert.deepEqual([before.uniquePets, before.shiny, before.achievementPoints], [2, 1, 0]);
  assert.ok(before.collectionScore > collectionMetrics(initial).collectionScore);
  assert.equal(achievementStatus(progress).find(item => item.id === claim.achievementId).isReady, true);
  const rewarded = applyAction(progress, claim);
  assert.equal(rewarded.event.type, 'claim');
  assert.equal(rewarded.progress.wallet.ascension, 1);
  assert.equal(applyAction(rewarded.progress, claim).event.code, 'achievement-claimed');
  assert.equal(collectionMetrics(rewarded.progress).achievementPoints, ACHIEVEMENTS[0].points);
  assert.equal(applyAction(rewarded.progress, { type: 'upgrade', id: 'ascensionReach' }).event.code, 'upgrade-rebirth-locked');
  const restored = restoreProgress(JSON.parse(JSON.stringify(rewarded.progress)));
  assert.deepEqual(collectionMetrics(restored), collectionMetrics(rewarded.progress));
});

test('releasing a pet requires confirmation and never removes protected pets or discovery history', () => {
  const initial = configure(createProgress(), { autoEquip: false });
  const progress = hatch(initial, [0.25, 0.1]).progress;
  const action = { type: 'release', petId: 'pet-2', confirm: true };
  assert.equal(applyAction(progress, { ...action, confirm: false }).event.code, 'release-unconfirmed');
  assert.equal(applyAction(progress, { ...action, petId: 'pet-1' }).event.code, 'pet-protected');
  for (const type of ['favorite', 'lock']) {
    const saved = applyAction(progress, { type, petId: action.petId }).progress;
    assert.equal(applyAction(saved, action).event.code, 'pet-protected');
  }
  const released = applyAction(progress, action);
  assert.equal(released.event.type, 'release');
  assert.equal(released.progress.inventory.length, 1);
  assert.ok(released.progress.discovered.includes('thimblehare'));
  assert.equal(released.progress.stats.eggsHatched, 1);
  const last = applyAction(released.progress, { type: 'equip', petId: 'pet-1' }).progress;
  assert.equal(applyAction(last, { ...action, petId: 'pet-1' }).event.code, 'last-pet');
});

test('trade settlement validates both offers and replaces owner-scoped IDs atomically', () => {
  const starting = configure(createProgress(), { autoEquip: false });
  const first = hatch(starting, [0.25, 0.1]).progress;
  const second = hatch(starting, [0.45, 0.1]).progress;
  const offer = { firstIds: ['pet-2'], secondIds: ['pet-2'] };
  const protectedSecond = applyAction(second, { type: 'favorite', petId: 'pet-2' }).progress;
  const rejected = exchangePets(first, protectedSecond, offer, { now: 20_000 });
  assert.equal(rejected.event.code, 'trade-unavailable');
  assert.strictEqual(rejected.first, first);
  assert.strictEqual(rejected.second, protectedSecond);
  const completed = exchangePets(first, second, offer, { now: 20_000 });
  assert.equal(completed.event.type, 'trade');
  assert.equal(completed.first.inventory[1].speciesId, second.inventory[1].speciesId);
  assert.equal(completed.second.inventory[1].speciesId, first.inventory[1].speciesId);
  assert.equal(completed.first.inventory[1].id, 'pet-3');
  assert.equal(completed.second.inventory[1].id, 'pet-3');
  assert.equal(completed.first.inventory[1].obtainedAt, 20_000);
  assert.deepEqual(completed.first.wallet, first.wallet);
  assert.equal(completed.second.stats.eggsHatched, second.stats.eggsHatched);
  assert.equal(exchangePets(completed.first, completed.second, offer).event.code, 'trade-unavailable');
});
