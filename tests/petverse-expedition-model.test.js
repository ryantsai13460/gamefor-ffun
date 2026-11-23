import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPEDITION_BIOMES } from '../assets/petverse/biomes.js';
import { GENERATOR_SITE, generatorEggCost, generatorPlan } from '../assets/petverse/generator.js';
import { achievementStatus, applyAction, collectionMetrics, createProgress, EGGS, exchangePets, expeditionCollections,
  generationStatus, hatchPlan, petCombatStats, PETS, progression, restoreProgress, SPAWN } from '../assets/petverse/model.js';

function explorer(level, rebirths) {
  const progress = createProgress();
  progress.xp = 12 * level * (level - 1);
  progress.rebirths = rebirths;
  progress.wallet.sunbeams = 10_000;
  progress.settings.autoEquip = false;
  progress.settings.lockRare = false;
  return progress;
}

function hatchSpecies(progress, biome, index, { variantSample = 0 } = {}) {
  const egg = EGGS.find(item => item.id === biome.eggId);
  const before = egg.pool.slice(0, index).reduce((total, item) => total + item.weight, 0);
  const draws = [(before + 1) / 10_000, variantSample];
  return applyAction(progress, { type: 'hatch', eggId: egg.id, count: 1 }, {
    now: Math.max(1, progress.hatchReadyAt), position: biome.egg, random: () => draws.shift()
  });
}

test('regional eggs require both earned admission and reaching their own station', () => {
  for (const biome of EXPEDITION_BIOMES) {
    const action = { type: 'hatch', eggId: biome.eggId };
    const novice = explorer(biome.level - 1, biome.rebirths);
    assert.equal(applyAction(novice, action, { position: biome.egg }).event.code, 'egg-locked');
    if (biome.rebirths) {
      const beforeRebirth = explorer(biome.level, biome.rebirths - 1);
      assert.equal(applyAction(beforeRebirth, action, { position: biome.egg }).event.code, 'generation-locked');
    }
    const ready = explorer(biome.level, biome.rebirths);
    const price = hatchPlan(ready, biome.eggId).unitCost;
    const away = applyAction(ready, action, { position: SPAWN });
    assert.equal(away.event.code, 'egg-out-of-range');
    assert.strictEqual(away.progress, ready);
    ready.upgrades.autoHatch = 1;
    const stopped = applyAction(ready, { ...action, mode: 'auto' });
    assert.equal(stopped.event.stopReason, 'egg-out-of-range');
    assert.strictEqual(stopped.progress, ready);
    const hatched = applyAction(ready, { ...action, mode: 'auto' }, { position: biome.egg, random: () => 0 });
    assert.equal(hatched.event.type, 'hatch');
    assert.equal(hatched.event.spent, price);
    assert.equal(hatched.progress.wallet.sunbeams, ready.wallet.sunbeams - price);
    assert.equal(PETS.find(pet => pet.id === hatched.event.pets[0].speciesId).biomeId, biome.id);
  }
});

test('biome scores reward actual discoveries once and preserve the old journal milestones', () => {
  let progress = explorer(7, 2);
  const before = collectionMetrics(progress);
  assert.deepEqual([before.collectionScore, before.discoveryPoints, before.expeditionBonus], [10, 10, 0]);
  const coast = EXPEDITION_BIOMES[0];
  const first = hatchSpecies(progress, coast, 0, { variantSample: .95 }).progress;
  const duplicate = hatchSpecies(first, coast, 0, { variantSample: .95 }).progress;
  assert.equal(collectionMetrics(first).collectionScore, collectionMetrics(duplicate).collectionScore);
  assert.equal(expeditionCollections(first)[0].discovered, 1);
  assert.equal(expeditionCollections(first)[0].points, 28);
  progress = duplicate;
  for (const index of [1, 2]) progress = hatchSpecies(progress, coast, index).progress;
  assert.equal(expeditionCollections(progress)[0].bonus, 30);
  const earlyClaim = applyAction(progress, { type: 'claim', achievementId: 'coast-complete' });
  assert.equal(earlyClaim.event.code, 'achievement-incomplete');
  for (const index of [3, 4]) progress = hatchSpecies(progress, coast, index).progress;
  assert.equal(expeditionCollections(progress)[0].bonus, 90);
  for (const biome of EXPEDITION_BIOMES.slice(1)) {
    for (let index = 0; index < 5; index++) progress = hatchSpecies(progress, biome, index).progress;
  }
  const score = collectionMetrics(progress);
  assert.equal(score.collectionScore, score.discoveryPoints + score.expeditionBonus);
  assert.deepEqual([score.uniquePets, score.biomesCompleted, score.expeditionBonus], [16, 3, 480]);
  const journal = achievementStatus(progress);
  assert.equal(journal.find(achievement => achievement.id === 'meadow-complete').current, 1);
  assert.equal(journal.find(achievement => achievement.id === 'ember-complete').current, 0);
  assert.equal(journal.find(achievement => achievement.id === 'collection-five-hundred').isReady, true);
  const claimed = applyAction(progress, { type: 'claim', achievementId: 'expedition-complete' });
  assert.equal(claimed.event.type, 'claim');
  assert.equal(applyAction(claimed.progress, { type: 'claim', achievementId: 'expedition-complete' }).event.code, 'achievement-claimed');
  assert.deepEqual(expeditionCollections(restoreProgress(JSON.parse(JSON.stringify(progress)))), expeditionCollections(progress));
});

test('stronger regional pets improve the equipped team and require an unlocked destination to trade', () => {
  const [coast, frost, cinder] = EXPEDITION_BIOMES;
  let progress = explorer(7, 2);
  for (const biome of [coast, frost, cinder]) progress = hatchSpecies(progress, biome, 0).progress;
  const team = progress.inventory.map(pet => petCombatStats(pet, progress));
  for (let index = 1; index < team.length; index++) {
    assert.ok(team[index].damage > team[index - 1].damage);
    assert.ok(team[index].farmingPower > team[index - 1].farmingPower);
  }
  assert.ok(new Set(team.map(pet => pet.attackRate)).size > 2);
  assert.ok(new Set(team.map(pet => pet.moveSpeed)).size > 2);
  const best = applyAction(progress, { type: 'equip-best' }).progress;
  assert.deepEqual(best.equipped, ['pet-4', 'pet-3']);
  assert.ok(progression(progress).capacity >= PETS.length);
  const novice = explorer(2, 0);
  const offered = applyAction(novice, { type: 'hatch', eggId: 'sunmeadow' }, { random: () => 0 }).progress;
  const trade = exchangePets(progress, offered, { firstIds: ['pet-2'], secondIds: ['pet-2'] });
  assert.equal(trade.event.code, 'trade-biome-locked');
  assert.strictEqual(trade.first, progress);
});

test('the charged generator respects Generation 3 admission and hatches away from the regional station', () => {
  const biome = EXPEDITION_BIOMES.at(-1);
  const select = { type: 'generatorSelect', eggId: biome.eggId };
  assert.equal(applyAction(explorer(7, 1), select).event.code, 'generator-egg-locked');
  const ready = explorer(7, 2);
  ready.generator.energy = 100_000;
  const selected = applyAction(ready, select);
  assert.equal(selected.event.type, 'generator-selected');
  const result = applyAction(selected.progress, { type: 'generatorClaim', eggId: biome.eggId }, {
    position: GENERATOR_SITE, random: () => 0
  });
  assert.equal(result.event.type, 'hatch');
  assert.equal(result.event.fromGenerator, true);
  assert.equal(result.event.spent, generatorEggCost(EGGS.find(egg => egg.id === biome.eggId)));
  assert.equal(generatorPlan(result.progress).energy, 0);
  assert.deepEqual(generationStatus(result.progress).map(item => [item.id, item.total, item.unlocked]),
    [[1, 25, true], [2, 10, true], [3, 5, true]]);
});
