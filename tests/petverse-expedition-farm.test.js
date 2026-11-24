import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPEDITION_BIOMES, isExpeditionLand } from '../assets/petverse/biomes.js';
import { canFarmArea, createFarmingWorld, CRYSTAL_FAMILIES, CRYSTAL_SITES, farmingAreaAt } from '../assets/petverse/farming.js';
import { applyAction, awardCrystalBreak, createProgress, magnetStats, restoreProgress } from '../assets/petverse/model.js';

const families = new Map(CRYSTAL_FAMILIES.map(family => [family.id, family]));

function unlockedProgress(biome) {
  const progress = createProgress();
  progress.xp = 12 * biome.level * (biome.level - 1);
  progress.rebirths = biome.rebirths;
  return progress;
}

test('all three expeditions have seven attainable seams and honor both progression gates', () => {
  assert.equal(CRYSTAL_SITES.length, 42);
  assert.equal(new Set(CRYSTAL_SITES.map(site => site.id)).size, 42);
  for (const biome of EXPEDITION_BIOMES) {
    const localSites = CRYSTAL_SITES.filter(site => site.areaId === biome.id);
    assert.equal(localSites.length, 7, biome.label);
    assert.ok(localSites.every(site => isExpeditionLand(site.x, site.z) && farmingAreaAt(site)?.id === biome.id), biome.label);
    assert.ok(localSites.every(site => Math.hypot(site.x - biome.egg.x, site.z - biome.egg.z) > 2), biome.label);

    const progress = unlockedProgress(biome);
    assert.equal(canFarmArea(progress, biome.id), true);
    assert.equal(canFarmArea({ ...progress, xp: progress.xp - 1 }, biome.id), false);
    if (biome.rebirths) assert.equal(canFarmArea({ ...progress, rebirths: biome.rebirths - 1 }, biome.id), false);
  }
});

test('expedition crystals pay their catalog Gold and materials only after a break and a close pickup', () => {
  const combat = () => ({ damage: 44, attackRate: 1.8, moveSpeed: 7 });
  for (const biome of EXPEDITION_BIOMES) {
    const original = unlockedProgress(biome);
    const actor = { id: 'explorer', position: biome, progress: original };
    const world = createFarmingWorld({ stats: combat, random: () => 1 });
    const rewards = [];
    let now = 0;
    const award = (ownerId, reward) => {
      assert.equal(ownerId, actor.id);
      assert.equal(reward.areaId, biome.id);
      const result = awardCrystalBreak(actor.progress, reward, { now });
      assert.equal(result.event.type, 'crystal-break');
      actor.progress = result.progress;
      rewards.push(reward);
      return true;
    };
    for (; now <= 9000 && rewards.length === 0; now += 100) world.advance([actor], now, award);

    assert.equal(rewards.length, 1, biome.label);
    const [reward] = rewards;
    const site = CRYSTAL_SITES.find(item => item.id === reward.crystalId);
    const family = families.get(site.familyId);
    const restored = restoreProgress(JSON.parse(JSON.stringify(actor.progress)), { now });
    const [drop] = restored.drops;
    assert.equal(drop.nodeId, site.id);
    assert.equal(drop.sunbeams, Math.round(family.gold * magnetStats(original).efficiency));
    assert.equal(drop.crystals, family.crystals);
    assert.deepEqual(restored.wallet, original.wallet);
    assert.equal(applyAction(restored, { type: 'collect', dropId: drop.id }, { now: drop.readyAt, position: { x: 0, z: 11 } })
      .event.code, 'drop-out-of-range');
    const pickedUp = applyAction(restored, { type: 'collect', dropId: drop.id }, { now: drop.readyAt, position: site });
    assert.equal(pickedUp.progress.wallet.sunbeams, original.wallet.sunbeams + drop.sunbeams);
    assert.equal(pickedUp.progress.wallet.crystals, original.wallet.crystals + drop.crystals);
    assert.deepEqual(pickedUp.progress.drops, []);
  }
});

test('an assigned party can cross the expanded map to Frostpine and mine while the explorer stays on the coast', () => {
  const coast = EXPEDITION_BIOMES.find(area => area.id === 'glasswater');
  const summit = EXPEDITION_BIOMES.find(area => area.id === 'frostpine');
  const progress = unlockedProgress(summit);
  const position = { x: coast.x + 6, z: coast.z - 5 };
  const assigned = applyAction(progress, { type: 'farm-settings', settings: { area: summit.id } }, { position });
  assert.equal(assigned.event.type, 'farm-settings');
  const actor = { id: 'explorer', position, progress: assigned.progress };
  const world = createFarmingWorld({ random: () => 1, stats: () => ({ damage: 52, attackRate: 1.8, moveSpeed: 9 }) });
  const events = [];

  for (let now = 0; now <= 18000 && !events.some(event => event.type === 'break'); now += 100) {
    events.push(...world.advance([actor], now, () => true));
    assert.ok(world.snapshot().pets.every(pet => isExpeditionLand(pet.x, pet.z)));
  }

  const mined = events.find(event => event.type === 'break');
  assert.equal(mined?.areaId, summit.id);
  assert.equal(actor.position, position);
  assert.equal(farmingAreaAt(actor.position)?.id, coast.id);
});
