import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BESTIARY_EGGS, BESTIARY_HABITATS, BESTIARY_PETS, BESTIARY_PROFILES, PET_RARITIES } from '../assets/petverse/bestiary.js';
import { EXPEDITION_BIOMES } from '../assets/petverse/biomes.js';

test('the six habitats contain 460 unique new species across 20 eggs', () => {
  assert.equal(BESTIARY_PETS.length, 460);
  assert.equal(new Set(BESTIARY_PETS.map(pet => pet.id)).size, 460);
  assert.equal(new Set(BESTIARY_PETS.map(pet => pet.name)).size, 460);
  assert.ok(BESTIARY_PETS.every(pet => /^[a-z0-9-]{1,38}$/.test(pet.id)));
  assert.equal(BESTIARY_EGGS.length, 20);
  assert.equal(new Set(BESTIARY_EGGS.map(egg => egg.id)).size, 20);
  assert.deepEqual(BESTIARY_HABITATS.map(habitat => BESTIARY_EGGS.filter(egg => egg.habitatId === habitat.id).length),
    [4, 3, 3, 4, 3, 3]);

  const byId = new Map(BESTIARY_PETS.map(pet => [pet.id, pet]));
  const allHatchable = [];
  for (const egg of BESTIARY_EGGS) {
    const habitat = BESTIARY_HABITATS.find(item => item.id === egg.habitatId);
    assert.equal(egg.generation, habitat.generation);
    assert.ok(egg.level >= habitat.level && egg.cost > 0);
    if (egg.biomeId) {
      const biome = EXPEDITION_BIOMES.find(item => item.id === egg.biomeId);
      assert.ok(egg.level >= biome.level);
      assert.equal(egg.generation, biome.rebirths + 1);
    }
    assert.equal(egg.pool.length, 23);
    const hatchable = egg.pool.map(record => byId.get(record.speciesId));
    assert.ok(hatchable.every(pet => pet.eggId === egg.id && pet.habitatId === egg.habitatId && pet.biomeId === egg.biomeId));
    assert.deepEqual(new Set(hatchable.map(pet => pet.shape)), new Set(BESTIARY_PROFILES.map(profile => profile.shape)));
    assert.deepEqual(new Set(hatchable.map(pet => pet.combatRole)), new Set(['scout', 'striker', 'balanced']));
    allHatchable.push(...hatchable.map(pet => pet.id));
  }
  assert.deepEqual(allHatchable.sort(), [...byId.keys()].sort());
});

test('each new egg has ten correctly weighted rarities and stronger high-tier pets', () => {
  const byId = new Map(BESTIARY_PETS.map(pet => [pet.id, pet]));
  for (const egg of BESTIARY_EGGS) {
    assert.equal(egg.pool.reduce((weight, record) => weight + record.weight, 0), 10000);
    const powers = [];
    for (const tier of PET_RARITIES) {
      const band = egg.pool.filter(record => byId.get(record.speciesId).rarity === tier.id);
      assert.equal(band.length, tier.speciesCount);
      assert.ok(band.every(record => Number.isInteger(record.weight) && record.weight > 0));
      assert.equal(band.reduce((total, record) => total + record.weight, 0), tier.weight);
      const bandPowers = band.map(record => byId.get(record.speciesId).power);
      powers.push({ min: Math.min(...bandPowers), max: Math.max(...bandPowers) });
    }
    assert.ok(powers.slice(1).every((value, index) => value.min > powers[index].max));
  }
});
