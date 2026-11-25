import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraClearance } from '../assets/petverse/camera-obstacles.js';

const flat = () => 0;

test('the camera retracts before a solid wall and can clear that same wall above its roof', () => {
  const pivot = { x: 0, y: 1.5, z: 0 };
  const wall = { x: 4, z: 0, radius: 1, height: 2.75 };
  const lowView = cameraClearance(pivot, { x: 10, y: 1.5, z: 0 }, [wall], flat);
  assert.ok(lowView > .25 && lowView < .275);
  assert.equal(cameraClearance(pivot, { x: 10, y: 10, z: 0 }, [wall], flat), 1);
});

test('higher terrain and near-wall shoulder movement keep the camera outside solid geometry', () => {
  const slope = x => Math.max(0, x - 2);
  const view = cameraClearance({ x: 0, y: 1.5, z: 0 }, { x: 10, y: 1.5, z: 0 }, [], slope);
  assert.ok(view > .3 && view < .325);
  const wall = { x: 0, z: 0, radius: 1, height: 3 };
  const shoulder = { x: 1.12, y: 1.5, z: 0 };
  assert.equal(cameraClearance(shoulder, { x: 4, y: 2, z: 0 }, [wall], flat), 1);
  assert.equal(cameraClearance(shoulder, { x: -4, y: 2, z: 0 }, [wall], flat), 0);
});
