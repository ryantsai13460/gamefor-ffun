import assert from 'node:assert/strict';
import test from 'node:test';
import { BESTIARY_PETS } from '../assets/petverse/bestiary.js';
import { createModelKit, createPet, petScale } from '../assets/petverse/models.js';
import { Box3, Vector3 } from '../assets/petverse/vendor/three/three.module.min.js';

function bounds(pet) {
  const box = new Box3().setFromObject(pet);
  const dimensions = box.getSize(new Vector3()).toArray();
  assert.ok(dimensions.every(axis => Number.isFinite(axis) && axis > 0));
  return dimensions;
}

test('every Bestiary species has its own buildable 3D appearance', () => {
  const kit = createModelKit();
  const appearances = new Set();
  for (const spec of BESTIARY_PETS) {
    const pet = createPet(spec, 'normal', kit);
    assert.equal(pet.children.length, 1, spec.id);
    assert.deepEqual(pet.scale.toArray(), [1, 1, 1], spec.id);
    assert.ok(pet.userData.strideScale > 0, spec.id);
    const pieces = [];
    pet.traverse(part => {
      if (!part.isMesh) return;
      assert.ok(part.geometry && part.material, spec.id);
      pieces.push([part.geometry.id, part.material.color.getHex(),
        ...part.position.toArray(), ...part.scale.toArray(), ...part.rotation.toArray()]);
    });
    assert.ok(pieces.length >= 16, spec.id);
    bounds(pet);
    appearances.add(JSON.stringify([pet.children[0].scale.toArray(), pieces]));
  }
  assert.equal(appearances.size, 460);
});

test('Giant and Titanium still scale all 23 Bestiary anatomies and fit their original body rigs', () => {
  const kit = createModelKit();
  const silhouettes = new Map(BESTIARY_PETS.map(spec => [spec.shape, spec]));
  assert.equal(silhouettes.size, 23);
  for (const spec of silhouettes.values()) {
    const unmodified = createPet(spec, 'normal', kit);
    const reference = bounds(unmodified.children[0]);
    for (const variant of ['titanium', 'giant']) {
      const pet = createPet(spec, variant, kit);
      assert.deepEqual(pet.scale.toArray(), Array(3).fill(petScale(variant)), spec.id);
      const armor = pet.children[0].children.at(-1);
      assert.equal(armor.isGroup, true, spec.id);
      assert.ok(armor.children.length >= 6, spec.id);
      bounds(pet);
      const originalBody = pet.children[0];
      originalBody.remove(armor);
      originalBody.removeFromParent();
      assert.deepEqual(bounds(originalBody), reference, spec.id);
      if (variant === 'titanium') assert.ok(armor.children.some(mesh => mesh.material.envMap), spec.id);
    }
  }
});
