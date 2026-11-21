import assert from 'node:assert/strict';
import test from 'node:test';
import { createHarborDispatch, createTidalRescue } from '../assets/harbor-games.js';

const eastPier = [
  [[0, 2], [1, 2], [2, 2], [2, 1], [3, 1], [4, 1], [4, 0], [5, 0], [6, 0]],
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [5, 4], [5, 5], [6, 5]],
];
const direction = ([x, y], [nextX, nextY]) => {
  if (nextY < y) return 'north';
  if (nextX > x) return 'east';
  if (nextY > y) return 'south';
  return 'west';
};
const ports = ['north', 'east', 'south', 'west'];

test('Harbor Dispatch reports disconnected tracks, routes two cargoes through one junction, and advances', () => {
  const game = createHarborDispatch();
  game.input('dispatch');
  assert.match(game.hud(), /Route breaks at row/);
  assert.match(game.hud(), /0\/2 delivered/);

  for (const route of eastPier) {
    for (let index = 1; index < route.length - 1; index++) {
      const here = route[index];
      const [x, y] = here;
      const expected = [direction(here, route[index - 1]), direction(here, route[index + 1])]
        .sort((first, second) => ports.indexOf(first) - ports.indexOf(second))
        .join(' to ');
      game.point(211 + (x + .5) * 54, 54 + (y + .5) * 54);
      for (let turn = 0; turn < 6 && !game.hud().includes(expected); turn++) game.input('rotate');
      assert.ok(game.hud().includes(expected), game.hud());
    }
    game.input('dispatch');
  }
  assert.match(game.hud(), /2\/2 delivered/);
  assert.ok(game.done() && game.canNext());
  game.next();
  assert.match(game.hud(), /Lantern Basin · 0\/3 delivered/);
  game.reset();
  assert.equal(game.done(), false);
});

test('Tidal Rescue can collect cargo with directional input and can restart after fuel depletion', () => {
  const game = createTidalRescue();
  const empty = new Set();
  const move = new Set(['right']);
  const rise = new Set(['up']);
  const step = (frames, keys) => {
    for (let frame = 0; frame < frames && !game.done(); frame++) game.update(1 / 120, keys);
  };

  // Approach the first buoy in Beacon Bay from the left, then brake.
  game.input('right');
  step(132, move);
  game.input('brake');
  step(77, rise);
  game.input('brake');
  assert.match(game.hud(), /Crew 1\/3/);
  assert.match(game.hud(), /Hull 3\/3/);
  game.reset();
  step(61 * 120, empty);
  assert.equal(game.done(), true);
  assert.equal(game.message(), 'Fuel depleted');
  assert.equal(game.canNext(), false);

  game.reset();
  assert.equal(game.done(), false);
  assert.match(game.hud(), /Crew 0\/3 · Hull 3\/3 · Fuel 60s/);
});
