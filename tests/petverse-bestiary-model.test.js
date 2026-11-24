import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPEDITION_BIOMES } from '../assets/petverse/biomes.js';
import { GENERATOR_SITE, generatorEggCost } from '../assets/petverse/generator.js';
import { achievementStatus, applyAction, BESTIARY_HABITATS, bestiaryCollections, collectionMetrics, createProgress, EGGS,
  exchangePets, expeditionCollections, hatchOdds, petCombatStats, PET_RARITIES, PETS, progression,
  restoreProgress, SPAWN, UPGRADES } from '../assets/petverse/model.js';

const eggs = EGGS.filter(egg => egg.bestiary);
const speciesById = new Map(PETS.map(species => [species.id, species]));
const positionFor = egg => EXPEDITION_BIOMES.find(biome => biome.id === egg.biomeId)?.egg || SPAWN;
const newTiers = ['exalted', 'celestial', 'ethereal', 'primordial'];

function readyExplorer(level = 80, rebirths = 2) {
  const progress = createProgress();
  progress.xp = 12 * level * (level - 1);
  progress.rebirths = rebirths;
  progress.wallet.sunbeams = 1_000_000;
  progress.wallet.crystals = 1000;
  return progress;
}

function hatchSpecies(progress, egg, index, { mode = 'manual', position = positionFor(egg) } = {}) {
  const { pool } = hatchOdds(progress, egg.id);
  const offset = pool.slice(0, index).reduce((total, entry) => total + entry.weight, 0);
  const draws = [(offset + .5) / pool.reduce((total, entry) => total + entry.weight, 0), 0];
  return applyAction(progress, { type: 'hatch', eggId: egg.id, mode, count: 1 }, {
    now: Math.max(1, progress.hatchReadyAt), position, random: () => draws.shift()
  });
}

test('each new rarity has exact positive draw weight from the actual pet pool and hatch luck', () => {
  const progress = readyExplorer();
  assert.equal(PET_RARITIES.length, 10);
  assert.deepEqual(PET_RARITIES.slice(-4).map(rarity => rarity.id), newTiers);
  for (const egg of eggs) {
    const base = hatchOdds(progress, egg.id);
    assert.deepEqual(base.rarities.map(rarity => rarity.weight), PET_RARITIES.map(rarity => rarity.weight));
    assert.deepEqual(base.rarities.map(rarity => rarity.speciesCount), PET_RARITIES.map(rarity => rarity.speciesCount));
    const lucky = hatchOdds({ ...progress, upgrades: { ...progress.upgrades, eggLuck: 3 } }, egg.id);
    assert.equal(lucky.rarities[0].weight, base.rarities[0].weight);
    assert.ok(lucky.rarities.at(-1).weight > base.rarities.at(-1).weight);
    assert.equal(lucky.rarities.reduce((sum, rarity) => sum + rarity.weight, 0),
      lucky.pool.reduce((sum, outcome) => sum + outcome.weight, 0));
  }
  const firstEgg = eggs.find(egg => egg.level === 1 && !egg.biomeId);
  const common = hatchSpecies(progress, firstEgg, 0);
  const primordial = hatchSpecies(progress, firstEgg, firstEgg.pool.length - 1);
  assert.equal(common.event.pets[0].locked, false);
  assert.equal(primordial.event.pets[0].locked, true);
  assert.equal(speciesById.get(primordial.event.pets[0].speciesId).rarity, 'primordial');
  assert.ok(collectionMetrics(primordial.progress).collectionScore > collectionMetrics(common.progress).collectionScore);
});

test('the expanded habitat can earn, own, and restore all 500 species', () => {
  let progress = readyExplorer();
  progress.settings.autoEquip = false;
  const purchases = UPGRADES.filter(upgrade => ['capacity', 'habitatAnnex'].includes(upgrade.id));
  for (const upgrade of purchases) {
    for (const cost of upgrade.costs) {
      const bought = applyAction(progress, { type: 'upgrade', id: upgrade.id });
      assert.equal(bought.event.type, 'upgrade');
      assert.equal(bought.event.spent, cost);
      progress = bought.progress;
    }
  }
  assert.equal(progression(progress).capacity, 532);
  let spent = 0;
  const gold = progress.wallet.sunbeams;
  for (const egg of EGGS) {
    for (const [index, entry] of egg.pool.entries()) {
      if (entry.speciesId === 'twigpup') continue;
      const result = hatchSpecies(progress, egg, index);
      assert.equal(result.event.type, 'hatch', egg.id);
      assert.equal(result.event.pets[0].speciesId, entry.speciesId);
      assert.equal(result.event.spent, egg.cost);
      progress = result.progress;
      spent += egg.cost;
    }
  }
  const restored = restoreProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(restored.inventory.length, 500);
  assert.equal(restored.discovered.length, 500);
  assert.equal(restored.wallet.sunbeams, gold - spent);
  assert.equal(restored.variantDiscoveries.length, 500);
  assert.equal(progression(restored).capacity, 532);
  const habitats = bestiaryCollections(restored);
  assert.equal(habitats.length, BESTIARY_HABITATS.length);
  assert.ok(habitats.every(habitat => habitat.discovered === habitat.total &&
    habitat.completeEggs === habitat.totalEggs && habitat.bonus === habitat.possibleBonus));
  assert.ok(expeditionCollections(restored).every(region => region.total === 5 && region.discovered === 5));
  const scores = collectionMetrics(restored);
  assert.equal(scores.bestiarySpecies, 460);
  assert.equal(scores.bestiaryEggsCompleted, 20);
  assert.equal(scores.expeditionBonus, 480);
  assert.equal(scores.collectionScore, scores.discoveryPoints + scores.bestiaryBonus + scores.expeditionBonus);
  assert.equal(achievementStatus(restored).find(achievement => achievement.id === 'bestiary-complete').isReady, true);
});

test('regional bestiary eggs share the station gate and unlock a paid charged hatch', () => {
  const regional = eggs.find(egg => egg.biomeId);
  const novice = readyExplorer(regional.level - 1);
  assert.equal(hatchSpecies(novice, regional, 0).event.code, 'egg-locked');
  let ready = readyExplorer(regional.level);
  ready.upgrades.autoHatch = 1;
  const away = hatchSpecies(ready, regional, 0, { mode: 'auto', position: SPAWN });
  assert.equal(away.event.code, 'egg-out-of-range');
  assert.equal(away.event.stopReason, 'egg-out-of-range');
  assert.strictEqual(away.progress, ready);
  const before = expeditionCollections(ready);
  const hatched = hatchSpecies(ready, regional, 0, { mode: 'auto' });
  assert.equal(hatched.event.type, 'hatch');
  assert.deepEqual(expeditionCollections(hatched.progress), before);
  assert.equal(collectionMetrics(hatched.progress).bestiarySpecies, 1);
  ready.generator.energy = 100_000;
  ready = applyAction(ready, { type: 'generatorSelect', eggId: regional.id }).progress;
  const charged = applyAction(ready, { type: 'generatorClaim', eggId: regional.id }, {
    now: 1200, position: GENERATOR_SITE, random: () => 0
  });
  assert.equal(charged.event.type, 'hatch');
  assert.equal(charged.event.spent, generatorEggCost(regional));
  assert.equal(charged.event.fromGenerator, true);
  const coastalPet = { speciesId: regional.pool[0].speciesId, variant: 'normal' };
  const combat = petCombatStats(coastalPet, charged.progress);
  assert.ok(combat.damage > 0 && combat.attackRate > 0 && combat.moveSpeed > 0);
});

test('trades keep Bestiary egg progression intact and fusion moves forms without losing a species', () => {
  const egg = eggs.find(egg => !egg.biomeId && egg.generation === 1 && egg.level > 1);
  let senior = readyExplorer(egg.level);
  senior.settings.autoEquip = false;
  senior.settings.lockRare = false;
  for (let index = 0; index < 3; index++) senior = hatchSpecies(senior, egg, 0).progress;
  let junior = readyExplorer(1, 0);
  junior.settings.autoEquip = false;
  junior = applyAction(junior, { type: 'hatch', eggId: 'sunmeadow' }, { random: () => 0 }).progress;
  assert.equal(exchangePets(senior, junior, { firstIds: ['pet-2'], secondIds: ['pet-2'] }).event.code, 'trade-egg-locked');
  const before = collectionMetrics(senior);
  const fusion = applyAction(senior, { type: 'fuse', petIds: ['pet-2', 'pet-3', 'pet-4'], confirm: true });
  assert.equal(fusion.event.type, 'fuse');
  assert.equal(fusion.event.pet.speciesId, egg.pool[0].speciesId);
  assert.equal(fusion.event.pet.variant, 'shiny');
  assert.equal(collectionMetrics(fusion.progress).bestiarySpecies, before.bestiarySpecies);
  assert.ok(collectionMetrics(fusion.progress).collectionScore > before.collectionScore);
});
