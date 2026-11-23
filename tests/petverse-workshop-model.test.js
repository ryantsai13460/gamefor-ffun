import assert from 'node:assert/strict';
import test from 'node:test';
import { createFarmingWorld, CRYSTAL_SITES, FARM_AREAS } from '../assets/petverse/farming.js';
import { advanceGenerator, GENERATOR_SITE, generatorEggCost, generatorPlan, markGeneratorStart } from '../assets/petverse/generator.js';
import { achievementStatus, applyAction, awardCrystalBreak, collectEligibleDrops, collectionMetrics, createProgress,
  EGGS, fusionOptions, fusionPlan, hatchOdds, magnetStats, petCombatStats, PETS, petPower, progression, restoreProgress, SPAWN,
  VARIANTS } from '../assets/petverse/model.js';

const starterEgg = EGGS[0];
const starterField = FARM_AREAS[0];
const firstSite = CRYSTAL_SITES[0];
const walletGold = progress => progress.wallet.sunbeams;
const funded = () => {
  const progress = createProgress();
  progress.wallet.sunbeams = 1000;
  progress.xp = 72;
  return progress;
};

function payFor(progress, id) {
  const { progress: next, event } = applyAction(progress, { type: 'upgrade', id });
  assert.equal(event.type, 'upgrade', event.message);
  return next;
}

function queuedBreak(progress, site, now, specialTier = 0) {
  const result = awardCrystalBreak(progress, { crystalId: site.id, areaId: site.areaId,
    gold: specialTier ? 23 : 9, crystals: 1, specialTier }, { now });
  assert.equal(result.event.type, 'crystal-break');
  return result;
}

test('a real equipped pet damages a crystal, breaks it, and yields Gold for a paid hatch', () => {
  let progress = createProgress();
  const sim = createFarmingWorld({ stats: petCombatStats, random: () => .99 });
  let struck = false;
  let broken = false;
  for (let now = 100_000; now <= 112_000 && !broken; now += 100) {
    const events = sim.advance([{ id: 'solo', progress, position: SPAWN }], now, (_id, reward) => {
      const result = awardCrystalBreak(progress, reward);
      assert.equal(result.event.type, 'crystal-break');
      progress = result.progress;
      return true;
    });
    struck ||= events.some(event => event.type === 'damage' && event.damage === petCombatStats(progress.inventory[0], progress).damage);
    broken = events.some(event => event.type === 'break');
  }
  assert.ok(struck && broken, 'a real starter pet delivers damage events and destroys a crystal');
  const [drop] = progress.drops;
  assert.equal(walletGold(progress), 40);
  assert.equal(sim.snapshot().crystals.find(crystal => crystal.id === drop.crystalId).health, 0);
  const collected = applyAction(progress, { type: 'collect', dropId: drop.id }, { now: drop.readyAt, position: drop });
  assert.equal(collected.event.type, 'collect');
  assert.equal(walletGold(collected.progress), 40 + drop.sunbeams);
  assert.equal(collected.progress.wallet.crystals, 1);
  const hatched = applyAction(collected.progress, { type: 'hatch', eggId: starterEgg.id }, { random: () => .1, now: drop.readyAt });
  assert.equal(hatched.event.type, 'hatch');
  assert.equal(walletGold(hatched.progress), 40 + drop.sunbeams - starterEgg.cost);
  assert.equal(hatched.progress.inventory.length, 2);
});

test('damage, attack speed, and travel upgrades affect their own stats and Equip Best ranks field throughput', () => {
  let progress = funded();
  const selected = ['mosswhisker', 'puddlepop', 'plumhop'];
  for (const speciesId of selected) {
    const template = progress.inventory[0];
    progress.inventory.push({ ...template, id: `pet-${progress.nextPetId++}`, speciesId });
  }
  const [, quick, heavy] = progress.inventory;
  assert.ok(petPower(quick) < petPower(heavy));
  assert.ok(petCombatStats(quick, progress).farmingPower > petCombatStats(heavy, progress).farmingPower);
  progress = applyAction(progress, { type: 'equip-best' }).progress;
  assert.ok(progress.equipped.includes(quick.id));
  assert.ok(!progress.equipped.includes(heavy.id));
  const previous = petCombatStats(quick, progress);
  progress = payFor(progress, 'petDamage');
  assert.ok(petCombatStats(quick, progress).damage > previous.damage);
  assert.equal(petCombatStats(quick, progress).attackRate, previous.attackRate);
  progress = payFor(progress, 'attackRate');
  assert.ok(petCombatStats(quick, progress).attackRate > previous.attackRate);
  assert.equal(petCombatStats(quick, progress).moveSpeed, previous.moveSpeed);
  progress = payFor(progress, 'petSpeed');
  assert.ok(petCombatStats(quick, progress).moveSpeed > previous.moveSpeed);
  assert.ok(progression(progress).teamDamageRate > 15);
  assert.equal(PETS.find(pet => pet.id === quick.speciesId).power, 7);
});

test('Gold piles persist and coalesce, while remote collection needs a matching earned assignment and pays once', () => {
  const now = 90_000;
  const original = createProgress();
  assert.equal(applyAction(original, { type: 'farm-settings', settings: { area: FARM_AREAS[1].id } }).event.code, 'farm-area-locked');
  let state = funded();
  assert.equal(applyAction(state, { type: 'assign-farm-here' }, { position: GENERATOR_SITE }).event.code, 'farm-outside-area');
  state = applyAction(state, { type: 'assign-farm-here' }, { position: SPAWN }).progress;
  assert.equal(state.farming.area, starterField.id);
  state = queuedBreak(state, firstSite, now).progress;
  state = queuedBreak(state, firstSite, now + 8000, 1).progress;
  const clock = now + 100_000;
  state = restoreProgress(JSON.parse(JSON.stringify(state)), { now: clock });
  assert.equal(state.drops.length, 1);
  assert.equal(state.drops[0].sunbeams, 32);
  assert.equal(state.drops[0].count, 2);
  assert.equal(collectionMetrics(state).crystalsDestroyed, 2);
  assert.equal(collectionMetrics(state).specialCrystalsDestroyed, 1);
  assert.equal(achievementStatus(state).find(item => item.id === 'special-crystal').isReady, true);
  const beforeUpgrade = collectEligibleDrops(state, { now: clock, position: GENERATOR_SITE, cranking: true });
  assert.strictEqual(beforeUpgrade.progress, state);
  state = payFor(state, 'remoteMagnet');
  const wrongArea = applyAction(state, { type: 'farm-settings', settings: { area: FARM_AREAS[1].id } }).progress;
  assert.deepEqual(collectEligibleDrops(wrongArea, { now: clock, position: GENERATOR_SITE }).events, []);
  const spoof = applyAction(state, { type: 'collect', dropId: state.drops[0].id, remote: true }, { now: clock, position: GENERATOR_SITE });
  assert.equal(spoof.event.code, 'drop-out-of-range');
  const earned = collectEligibleDrops(state, { now: clock, position: GENERATOR_SITE, cranking: true });
  assert.deepEqual(earned.events.map(event => [event.type, event.remote, event.sunbeams]), [['collect', true, 32]]);
  assert.equal(walletGold(earned.progress), walletGold(state) + 32);
  assert.equal(earned.progress.stats.crankGold, 32);
  assert.equal(earned.progress.stats.goldEarned, 32);
  assert.strictEqual(collectEligibleDrops(earned.progress, { now: clock + 1, position: GENERATOR_SITE }).progress, earned.progress);
  assert.equal(applyAction(state, { type: 'crystal-break', crystalId: firstSite.id, gold: 5000 }).event.code, 'unknown-action');
  const fullWallet = { ...state, wallet: { ...state.wallet, sunbeams: 1_000_000_000 } };
  assert.strictEqual(collectEligibleDrops(fullWallet, { now: clock, position: GENERATOR_SITE }).progress, fullWallet);
  assert.equal(fullWallet.drops[0].sunbeams, 32);
});

test('magnet capacity limits simultaneous automatic pickups and earned Auto Collect extends the radius', () => {
  const now = 30_000;
  const position = GENERATOR_SITE;
  let progress = applyAction(funded(), { type: 'assign-farm-here' }, { position: SPAWN }).progress;
  progress = payFor(progress, 'remoteMagnet');
  for (const site of CRYSTAL_SITES.slice(0, 5)) progress = queuedBreak(progress, site, now).progress;
  const timing = { now: now + 1010, position };
  const twice = collectEligibleDrops(progress, timing);
  assert.equal(twice.events.length, 2);
  assert.equal(collectEligibleDrops(twice.progress, timing).events.length, 0);
  assert.equal(collectEligibleDrops(twice.progress, { ...timing, now: timing.now + 450 }).events.length, 2);
  assert.equal(collectEligibleDrops(payFor(progress, 'magnetSlots'), timing).events.length, 4);

  let local = funded();
  local = queuedBreak(local, firstSite, now).progress;
  local = applyAction(local, { type: 'settings', settings: { autoCollectGold: true } }).progress;
  const beyond = { position: { x: firstSite.x + 4.5, z: firstSite.z }, now: now + 1010 };
  assert.equal(collectEligibleDrops(local, beyond).events.length, 0);
  local = payFor(local, 'autoCollect');
  assert.equal(magnetStats(local).radius, 5.05);
  assert.equal(collectEligibleDrops(local, beyond).events[0].remote, false);
});

test('fusion discloses the actual three duplicates and protects equipped, favorite, and locked pets', () => {
  let progress = applyAction(funded(), { type: 'settings', settings: { autoEquip: false } }).progress;
  for (let count = 0; count < 3; count++) {
    progress = applyAction(progress, { type: 'hatch', eggId: starterEgg.id }, { now: 100_000 + 2000 * count, random: () => .1 }).progress;
  }
  const [plan] = fusionOptions(progress);
  assert.deepEqual(plan.petIds, ['pet-2', 'pet-3', 'pet-4']);
  assert.equal(plan.consumed.every(pet => pet.speciesId === 'twigpup'), true);
  assert.deepEqual(plan.result, { speciesId: 'twigpup', variant: 'shiny' });
  const action = { type: 'fuse', petIds: plan.petIds, confirm: true };
  for (const type of ['equip', 'favorite', 'lock']) {
    const protectedState = applyAction(progress, { type, petId: plan.petIds[0] }).progress;
    assert.equal(applyAction(protectedState, action).event.code, 'fusion-unavailable');
  }
  assert.equal(fusionPlan(progress, ['pet-2', 'pet-2', 'pet-3']).code, 'fusion-unavailable');
  assert.equal(applyAction(progress, { ...action, confirm: false }).event.code, 'fusion-unconfirmed');
  const fused = applyAction(progress, action);
  assert.equal(fused.event.type, 'fuse');
  assert.equal(fused.event.pet.variant, 'shiny');
  assert.equal(fused.progress.inventory.length, 2);
  assert.ok(fused.progress.variantDiscoveries.includes('twigpup:shiny'));
  assert.equal(fused.progress.stats.fusions, 1);
  assert.equal(achievementStatus(fused.progress).find(item => item.id === 'first-fusion').isReady, true);
  assert.equal(applyAction(fused.progress, action).event.code, 'fusion-unavailable');
});

test('each rare hatch is controlled only by the enabled variant and discovery conditions', () => {
  const tests = VARIANTS.slice(1);
  const newSpeciesBit = 1 << tests.length;
  const newVariantBit = newSpeciesBit << 1;
  let firstWeight = VARIANTS[0].weight;
  for (const [index, tested] of tests.entries()) {
    const chance = (firstWeight + .5) / 10_000;
    firstWeight += tested.weight;
    for (let mask = 0; mask < newVariantBit * 2; mask++) {
      const progress = funded();
      progress.upgrades.autoHatch = 1;
      progress.upgrades.multiHatch = 1;
      progress.settings.multiHatch = true;
      progress.settings.autoEquip = false;
      progress.settings.stopOnNew = Boolean(mask & newSpeciesBit);
      progress.settings.stopOnNewVariant = Boolean(mask & newVariantBit);
      progress.settings.stopVariants = Object.fromEntries(tests.map(({ id }, bit) => [id, Boolean(mask & (1 << bit))]));
      const samples = [.25, chance, .25, 0, .25, 0];
      const { event } = applyAction(progress, { type: 'hatch', eggId: starterEgg.id, mode: 'auto' }, { random: () => samples.shift() });
      const reasons = [];
      if (mask & (1 << index)) reasons.push(`variant:${tested.id}`);
      if (mask & newSpeciesBit) reasons.push('new-discovery');
      if (mask & newVariantBit) reasons.push('new-variant');
      assert.equal(event.pets[0].variant, tested.id);
      assert.deepEqual(event.stopReasons, reasons);
      assert.equal(event.pets.length, reasons.length ? 1 : 3);
    }
  }
});

test('earned hatch luck changes the displayed weights and the real paid draw', () => {
  const base = funded();
  const baseline = hatchOdds(base, starterEgg.id);
  assert.strictEqual(baseline.pool, starterEgg.pool);
  assert.strictEqual(baseline.variants, VARIANTS);
  const speciesLuck = payFor(base, 'eggLuck');
  const both = payFor(speciesLuck, 'variantLuck');
  const improved = hatchOdds(both, starterEgg.id);
  const sampleDraws = [.91, .91];
  const draw = progress => {
    const weights = [...sampleDraws];
    return applyAction(progress, { type: 'hatch', eggId: starterEgg.id }, { random: () => weights.shift() }).event.pets[0];
  };
  assert.equal(improved.pool[0].weight, baseline.pool[0].weight);
  assert.equal(improved.pool.at(-1).weight, 46);
  assert.equal(improved.variants.find(item => item.id === 'titanium').weight, 12);
  assert.equal(draw(base).variant, 'normal');
  assert.notEqual(draw(both).variant, 'normal');
});

test('Stop When New Variant allows a previously discovered variant of the same species to continue', () => {
  const progress = funded();
  progress.upgrades.autoHatch = 1;
  progress.upgrades.multiHatch = 1;
  progress.settings.multiHatch = true;
  progress.settings.stopOnNewVariant = true;
  progress.settings.stopVariants.shiny = false;
  const action = { type: 'hatch', eggId: starterEgg.id, mode: 'auto' };
  const firstDraw = [.25, .95];
  const first = applyAction(progress, action, { random: () => firstDraw.shift(), now: 1000 });
  assert.equal(first.event.stopReason, 'new-variant');
  const draws = [.25, .95, .25, .95, .25, .95];
  const repeated = applyAction(first.progress, action, { random: () => draws.shift(), now: 3000 });
  assert.equal(repeated.event.stopReason, null);
  assert.equal(repeated.event.pets.length, 3);
});

test('generator hatches require a genuine stored charge, player proximity, and payment', () => {
  let progress = funded();
  const action = { type: 'generatorClaim' };
  const args = { position: GENERATOR_SITE, now: 50_000, random: () => .1 };
  assert.equal(applyAction(progress, action, args).event.code, 'generator-unready');
  progress = markGeneratorStart(progress);
  for (let second = 0; second < 13; second++) progress = advanceGenerator(progress, 1000);
  assert.equal(generatorPlan(progress).ready, true);
  assert.equal(applyAction(progress, action, { ...args, position: SPAWN }).event.code, 'generator-out-of-range');
  assert.equal(applyAction(progress, { ...action, eggId: EGGS[1].id }, args).event.code, 'generator-egg-changed');
  assert.equal(applyAction(progress, action, args).event.spent, generatorEggCost(starterEgg));
  const paid = applyAction(progress, action, args);
  assert.equal(paid.event.fromGenerator, true);
  assert.equal(walletGold(paid.progress), walletGold(progress) - generatorEggCost(starterEgg));
  assert.equal(paid.progress.generator.energy, 0);
  assert.equal(paid.progress.generator.hatches, 1);
  assert.equal(applyAction(paid.progress, action, args).event.code, 'generator-unready');
  const forged = applyAction(progress, { type: 'hatch', eggId: starterEgg.id, mode: 'generator' }, args);
  assert.equal(forged.event.spent, starterEgg.cost);
  assert.equal(forged.progress.generator.energy, progress.generator.energy);
  const selected = applyAction(progress, { type: 'generatorSelect', eggId: EGGS[1].id }, args).progress;
  assert.deepEqual(restoreProgress(selected).generator, selected.generator);
  assert.equal(applyAction(progress, { type: 'generatorSelect', eggId: EGGS[2].id }, args).event.code, 'generator-egg-locked');
});
