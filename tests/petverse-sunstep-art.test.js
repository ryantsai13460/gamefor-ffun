import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../assets/petverse/vendor/three/three.module.min.js';
import { createModelKit } from '../assets/petverse/models.js';
import { buildMeadowWater, buildSunstepSurface, createSunstepHeight, sunstepCreekDistance } from '../assets/petverse/sunstep-art.js';

test('Sunstep has gradual traversable relief and preserves level interaction clearings', () => {
  const height = createSunstepHeight([
    { x: 0, z: 11, radius: 3 },
    { x: -22, z: -18, radius: 7.7 },
    { x: -14, z: 21.15, radius: 4.75 }
  ]);
  assert.equal(height(0, 11), 0);
  assert.equal(height(-22, -18), 0);
  assert.equal(height(-14, 21.15), 0);
  assert.equal(height(16.8, 10.5), 0);
  assert.equal(height(41, 12), 0);
  assert.ok(height(-21, 2.2) > 2.5);
  assert.ok(sunstepCreekDistance(16.8, 10.5) < 2);
  assert.ok(sunstepCreekDistance(-21, 2.2) > 20);
  for (let x = -31; x < 30; x += .6) {
    for (let z = -31; z < 30; z += .6) {
      assert.ok(Math.abs(height(x, z) - height(x, z + .6)) / .6 <= 1.27);
      assert.ok(Math.abs(height(x, z) - height(x + .6, z)) / .6 <= 1.27);
    }
  }
});

test('the landscape surface and stream use actual 3D geometry and support reduced motion', () => {
  const terrain = createSunstepHeight([]);
  const surface = buildSunstepSurface(terrain, []);
  const vertices = surface.geometry.attributes.position;
  const normals = surface.geometry.attributes.normal;
  assert.ok(vertices.array.some((value, index) => index % 3 === 1 && value > 2.5));
  assert.equal(normals.count, vertices.count);
  assert.ok(normals.array.every(Number.isFinite));
  assert.ok(normals.array.every((value, index) => index % 3 !== 1 || value > 0));

  const group = new THREE.Group();
  const { update, obstacles } = buildMeadowWater(group, createModelKit());
  const stream = group.getObjectByName('sunstep-stream');
  const falls = group.getObjectByName('sunstep-waterfall');
  const mist = group.getObjectsByProperty('isPoints', true)[0];
  assert.ok(stream && falls && mist);
  assert.ok(falls.geometry.attributes.position.array.some((value, index) => index % 3 === 1 && value > 4));
  assert.ok(obstacles.some(block => block.height > 4));
  update(3.25, { reducedMotion: false, particles: 'medium' });
  assert.equal(stream.material.uniforms.time.value, 3.25);
  assert.equal(mist.visible, true);
  assert.ok(mist.geometry.attributes.position.array.every(Number.isFinite));
  update(10, { reducedMotion: true, particles: 'high' });
  assert.equal(falls.material.uniforms.time.value, 0);
  assert.equal(mist.visible, false);
});
