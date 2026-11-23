import assert from 'node:assert/strict';
import test from 'node:test';
import { CRYSTAL_SITES, canFarmArea, createFarmingWorld, crystalAtId, farmSettings, farmingAreaAt } from '../assets/petverse/farming.js';
import { advanceGenerator, GENERATOR_SITE, markGeneratorStart } from '../assets/petverse/generator.js';
import { applyAction, awardCrystalBreak, collectEligibleDrops, createProgress, petCombatStats } from '../assets/petverse/model.js';

const starter = 'sunstep-1';
const start = { x: 0, z: 11 };
const generator = { x: -14.78, z: 23.3 };
const fastCombat = () => ({ damage: 20, attackRate: 3, moveSpeed: 7 });
const ordinaryCombat = () => ({ damage: 4, attackRate: 1, moveSpeed: 4 });

function explorer({ id = 'Ada', x = start.x, z = start.z, team = 1, xp = 0, rebirths = 0, farming = {}, upgrades = {}, variant = 'normal' } = {}) {
  const inventory = Array.from({ length: team }, (_, i) => ({
    id: `pet-${i + 1}`, speciesId: 'twigpup', variant
  }));
  return { id, position: { x, z }, progress: {
    inventory, equipped: inventory.map(pet => pet.id), farming, xp, rebirths, upgrades
  } };
}

function advance(world, players, startAt, endAt, award = () => true, interval = 100) {
  const events = [];
  for (let time = startAt; time <= endAt; time += interval) {
    for (const event of world.advance(players, time, award)) events.push({ ...event, time });
  }
  return events;
}

function crystal(world, id = starter) {
  return world.snapshot().crystals.find(item => item.id === id);
}

test('places a starter field within reach and unlocks stronger fields through real progress', () => {
  const profile = explorer().progress;
  assert.equal(farmingAreaAt(start).id, 'sunstep');
  assert.equal(farmingAreaAt(generator), null);
  assert.equal(farmingAreaAt({ x: NaN, z: 10 }), null);
  assert.equal(canFarmArea(profile, 'sunstep'), true);
  assert.equal(canFarmArea(profile, 'fernwild'), false);
  assert.equal(canFarmArea({ xp: 24 }, 'fernwild'), true);
  assert.equal(canFarmArea({ xp: 72, rebirths: 0 }, 'ember-verge'), false);
  assert.equal(canFarmArea({ xp: 72, rebirths: 1 }, 'ember-verge'), true);
  assert.deepEqual(farmSettings({ ...profile, farming: { area: 'fernwild', enabled: false, policy: 'unknown', preferSpecial: 'yes' } }),
    { area: null, enabled: false, policy: 'balanced', preferSpecial: false });
  assert.equal(CRYSTAL_SITES.length, new Set(CRYSTAL_SITES.map(site => site.id)).size);
  assert.deepEqual(crystalAtId(starter), { id: starter, areaId: 'sunstep', x: 2.1, z: 12.8, familyId: 'sun-glass' });
});

test('pets travel, strike for the actual damage and interval, break once, and retarget', () => {
  const world = createFarmingWorld({ stats: ordinaryCombat, random: () => 1 });
  const player = explorer({ farming: { policy: 'nearest' } });
  const rewards = [];
  const award = (ownerId, reward) => { rewards.push({ ownerId, ...reward }); };
  assert.deepEqual(world.advance([player], 0, award), []);
  assert.equal(world.snapshot().pets[0].state, 'travel');
  assert.equal(crystal(world).health, 12);
  assert.equal(crystal(world).targeted, 1);
  assert.deepEqual(advance(world, [player], 100, 300, award), []);
  const firstAttack = advance(world, [player], 400, 500, award);
  assert.equal(firstAttack[0].type, 'damage');
  assert.equal(firstAttack[0].damage, 4);
  assert.equal(crystal(world).health, 8);
  assert.equal(world.snapshot().pets[0].state, 'attack');
  const events = [...firstAttack, ...advance(world, [player], 600, 3800, award)];
  const damage = events.filter(event => event.type === 'damage' && event.crystalId === starter);
  const breaks = events.filter(event => event.type === 'break' && event.crystalId === starter);
  assert.equal(damage.length, 3);
  assert.equal(breaks.length, 1);
  assert.equal(damage[1].time - damage[0].time, 1000);
  assert.equal(damage[2].time - damage[1].time, 1000);
  assert.equal(crystal(world).health, 0);
  assert.notEqual(world.snapshot().pets[0].targetId, starter);
  assert.deepEqual(rewards.filter(reward => reward.crystalId === starter), [
    { ownerId: player.id, crystalId: starter, areaId: 'sunstep', x: 2.1, z: 12.8, gold: 9, crystals: 1, specialTier: 0, now: breaks[0].time }
  ]);
  const respawns = advance(world, [], 3900, breaks[0].time + 5800);
  assert.equal(respawns.filter(event => event.type === 'respawn' && event.crystalId === starter).length, 1);
  assert.equal(crystal(world).health, 12);
  assert.equal(crystal(world).readyAt, 0);
});

test('movement, damage and attack-rate increases each change simulated combat', () => {
  function timing({ damage = 4, attackRate = 1, moveSpeed = 4 } = {}) {
    const world = createFarmingWorld({ stats: () => ({ damage, attackRate, moveSpeed }), random: () => 1 });
    const player = explorer();
    const events = advance(world, [player], 0, 3300, undefined, 50).filter(event => event.crystalId === starter);
    return { first: events[0].time, last: events.find(event => event.type === 'break').time };
  }
  const defaultTiming = timing();
  assert.ok(timing({ moveSpeed: 8 }).first < defaultTiming.first);
  assert.ok(timing({ damage: 6 }).last < defaultTiming.last);
  assert.ok(timing({ attackRate: 2 }).last < defaultTiming.last);
  assert.ok(timing({ moveSpeed: 2 }).first > defaultTiming.first);
});

test('turning off targeting or briefly unequipping cannot skip the attack interval', () => {
  const world = createFarmingWorld({ stats: ordinaryCombat });
  const player = explorer({ x: 2.1, z: 11.63 });
  assert.equal(world.advance([player], 0)[0].damage, 4);
  assert.equal(crystal(world).health, 8);
  player.progress.farming.enabled = false;
  world.advance([player], 100);
  player.progress.farming.enabled = true;
  assert.deepEqual(world.advance([player], 200), []);
  player.progress.equipped = [];
  world.advance([player], 400);
  player.progress.equipped = ['pet-1'];
  assert.deepEqual(world.advance([player], 900), []);
  assert.equal(world.advance([player], 1000)[0].damage, 4);
  assert.equal(crystal(world).health, 4);
});

test('small attack-rate upgrades accumulate across a discrete simulation tick', () => {
  const gradual = attackRate => {
    const world = createFarmingWorld({ stats: () => ({ damage: 3, attackRate, moveSpeed: 4 }) });
    const player = explorer({ x: -.1, z: 22.1, farming: { policy: 'strongest' } });
    return advance(world, [player], 0, 16_000, () => true, 200)
      .find(event => event.type === 'break' && event.crystalId === 'sunstep-7').time;
  };
  assert.ok(gradual(1.12) < gradual(1) - 1_000);
});

test('ordinary crystals spread pets and strongest or highest-value priorities can share large targets', () => {
  const world = createFarmingWorld();
  const pets = explorer({ team: 3, farming: { policy: 'balanced' } });
  world.advance([pets], 0);
  assert.equal(new Set(world.snapshot().pets.map(pet => pet.targetId)).size, 3);
  assert.equal(crystal(world).targeted, 1);
  for (const selection of ['strongest', 'value']) {
    pets.progress.farming = { area: 'sunstep', policy: selection };
    world.advance([pets], selection === 'strongest' ? 100 : 200);
    const selected = world.snapshot().pets.map(pet => pet.targetId);
    assert.equal(selected.filter(id => id === 'sunstep-7').length, 3, selection);
  }
  pets.progress.farming.policy = 'low-health';
  world.advance([pets], 300);
  assert.equal(crystal(world, 'sunstep-7').targeted, 0);
  assert.equal(world.snapshot().pets.filter(pet => pet.targetId).length, 3);
});

test('a failed award cannot remove the crystal or double-pay it when persistence recovers', () => {
  const world = createFarmingWorld({ stats: fastCombat, random: () => 1 });
  let attempts = 0;
  const player = explorer();
  const failed = advance(world, [player], 0, 1100, (id, reward) => {
    if (reward.crystalId === starter) attempts++;
    throw new Error('storage unavailable');
  });
  assert.equal(failed.some(event => event.type === 'break'), false);
  assert.ok(attempts >= 1);
  assert.equal(crystal(world).health, 1);
  const rewards = [];
  const accepted = advance(world, [player], 1200, 1800, (id, reward) => { rewards.push(reward); });
  assert.equal(accepted.filter(event => event.type === 'break' && event.crystalId === starter).length, 1);
  assert.equal(rewards.filter(reward => reward.crystalId === starter).length, 1);
});

test('assigned pets continue at their farm while the traveler is in the workshop', () => {
  const world = createFarmingWorld({ stats: fastCombat, random: () => 1 });
  const player = explorer({ team: 3, farming: { area: 'sunstep' } });
  advance(world, [player], 0, 500);
  player.position = generator;
  const events = advance(world, [player], 600, 12_000);
  assert.ok(events.some(event => event.type === 'break' && event.areaId === 'sunstep'));
  assert.ok(events.some(event => event.type === 'respawn' && event.areaId === 'sunstep'));
  assert.equal(world.snapshot().pets.length, 3);
  assert.ok(world.snapshot().pets.every(pet => Math.hypot(pet.x - generator.x, pet.z - generator.z) > 4));
  player.progress.farming.enabled = false;
  const paused = advance(world, [player], 12_100, 13_000);
  assert.ok(paused.every(event => event.type === 'respawn'));
  assert.ok(world.snapshot().pets.every(pet => pet.state === 'wait' && pet.targetId === null));
  player.progress.farming.area = null;
  world.advance([player], 13_100);
  assert.deepEqual(world.snapshot().pets, []);
});

test('assigned pets earn remote Gold while an actual generator charge builds', () => {
  const world = createFarmingWorld({ stats: petCombatStats, random: () => 1 });
  const progress = createProgress();
  progress.xp = 24;
  progress.wallet.sunbeams = 140;
  const assigned = applyAction(progress, { type: 'assign-farm-here' }, { position: start });
  assert.equal(assigned.event.type, 'farm-settings');
  const player = { id: 'solo', position: start, progress: assigned.progress };
  world.advance([player], 0);
  player.position = GENERATOR_SITE;
  player.progress = markGeneratorStart(player.progress);

  function tick(now) {
    player.progress = advanceGenerator(player.progress, 200);
    world.advance([player], now, (_, reward) => {
      const result = awardCrystalBreak(player.progress, reward, { now });
      if (result.event.type === 'error') return false;
      player.progress = result.progress;
      return true;
    });
    const collection = collectEligibleDrops(player.progress, { now, position: GENERATOR_SITE, cranking: true });
    player.progress = collection.progress;
    return collection.events;
  }

  for (let now = 200; now <= 4800; now += 200) assert.deepEqual(tick(now), []);
  assert.ok(player.progress.generator.energy > 0);
  assert.ok(player.progress.drops.some(drop => drop.crystalId === starter));
  assert.equal(player.progress.wallet.sunbeams, 140);
  const purchased = applyAction(player.progress, { type: 'upgrade', id: 'remoteMagnet' }, { position: GENERATOR_SITE });
  assert.equal(purchased.event.type, 'upgrade');
  const balance = purchased.progress.wallet.sunbeams;
  player.progress = purchased.progress;
  let gold = 0;
  for (let now = 5000; now <= 11_000; now += 200) {
    for (const event of tick(now)) {
      assert.equal(event.remote, true);
      gold += event.sunbeams;
    }
  }
  assert.ok(gold > 0);
  assert.equal(player.progress.wallet.sunbeams, balance + gold);
  assert.equal(player.progress.stats.crankGold, gold);
  assert.ok(player.progress.generator.energy > purchased.progress.generator.energy);
});

test('a locked region remains untargetable until the required level and rebirth are earned', () => {
  const world = createFarmingWorld({ stats: fastCombat });
  const player = explorer({ x: -2, z: -20, xp: 72, farming: { area: 'ember-verge' } });
  const blocked = advance(world, [player], 0, 5000);
  assert.deepEqual(blocked, []);
  assert.deepEqual(world.snapshot().pets, []);
  player.progress.rebirths = 1;
  const earned = advance(world, [player], 5_100, 10_000);
  assert.ok(earned.some(event => event.type === 'damage' && event.areaId === 'ember-verge'));
});

test('rare tiers raise difficulty and rewards and override an ordinary target when preferred', () => {
  for (const [xp, expectedTier] of [[0, 1], [144, 2]]) {
    let rolls = 0;
    const world = createFarmingWorld({ stats: ordinaryCombat, random: () => rolls++ === 0 ? 0 : 1 });
    const player = explorer({ xp, farming: { area: 'sunstep', policy: 'nearest', preferSpecial: true } });
    const rewards = [];
    const award = (id, reward) => { rewards.push(reward); };
    const first = advance(world, [player], 0, 3_000, award).find(event => event.type === 'break');
    const respawnAt = first.time + 5_800;
    advance(world, [player], 3_100, respawnAt, award);
    assert.equal(crystal(world).specialTier, expectedTier);
    assert.equal(world.snapshot().pets[0].targetId, starter);
    const events = advance(world, [player], respawnAt + 100, respawnAt + 12_000, award);
    assert.ok(events.some(event => event.type === 'break' && event.specialTier === expectedTier));
    const awardInfo = rewards.find(reward => reward.crystalId === starter && reward.specialTier === expectedTier);
    assert.ok(awardInfo?.gold > 9);
    assert.ok(awardInfo?.crystals > 1);
  }
});

test('pet routing finds a walkable path around a collision without reversing progress', () => {
  const block = { x: 1.14, z: 11.91, radius: .48 };
  const world = createFarmingWorld({ stats: fastCombat, obstacles: [block] });
  const player = explorer();
  let broken = false;
  for (let now = 0; now <= 5000 && !broken; now += 50) {
    const events = world.advance([player], now, () => true);
    for (const pet of world.snapshot().pets) {
      assert.ok(Math.hypot(pet.x - block.x, pet.z - block.z) >= .77);
    }
    broken = events.some(event => event.type === 'break' && event.crystalId === starter);
  }
  assert.equal(broken, true);
});

test('a room shares crystal damage, awards the highest contributor once, and forgets departed pets', () => {
  const world = createFarmingWorld({ stats: pet => ({ damage: pet.variant === 'titanium' ? 13 : 9, attackRate: 1, moveSpeed: 5 }) });
  const a = explorer({ id: 'Ada', x: 7.4, z: 12, farming: { policy: 'strongest' }, variant: 'titanium' });
  const b = explorer({ id: 'Basil', x: 7.4, z: 12, farming: { policy: 'strongest' } });
  const rewards = [];
  const events = advance(world, [a, b], 0, 2200, (id, reward) => { rewards.push({ id, ...reward }); }, 50);
  const first = events.filter(event => event.crystalId === 'sunstep-4');
  assert.equal(new Set(first.filter(event => event.type === 'damage').map(event => event.ownerId)).size, 2);
  assert.equal(first.filter(event => event.type === 'break').length, 1);
  assert.equal(rewards.filter(reward => reward.crystalId === 'sunstep-4').length, 1);
  assert.equal(rewards.find(reward => reward.crystalId === 'sunstep-4').id, a.id);
  world.advance([b], 2300, () => true);
  assert.ok(world.snapshot().pets.every(pet => pet.ownerId !== a.id));
});
