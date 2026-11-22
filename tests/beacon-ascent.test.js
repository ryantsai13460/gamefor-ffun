import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createBeaconAscent } from '../assets/beacon-ascent.js';

function play(game, steps) {
  for (const [frames, direction, action] of steps) {
    if (action) game.input(action);
    const held = new Set(direction ? [direction] : []);
    for (let frame = 0; frame < frames; frame++) game.update(1 / 120, held);
  }
}

const ridgeCheckpoint = [
  [37, 'right'], [47, 'right', 'up'], [11],
  [21, 'right'], [38, 'right', 'up'], [11],
  [20, 'right'], [47, 'right', 'up'], [11],
];

test('Beacon Ascent completes every course with wall jumping and midair dashes', () => {
  const records = [];
  const game = createBeaconAscent({}, (course, time) => records.push({ course, time }));
  play(game, [...ridgeCheckpoint, [28, 'right'], [47, 'right', 'up'], [11], [20, 'right']]);
  assert.equal(game.done(), true);
  assert.equal(game.canNext(), true);
  assert.match(game.hud(), /^Pine Ridge .*Checkpoint set.*Falls 0$/);

  game.next();
  play(game, [
    [44, 'left', 'up'], [48], [57, 'right', 'up'], [40], [10, 'right'],
    [28, 'right', 'up'], [32, 'right', 'up'], [19, 'right', 'dash'],
  ]);
  assert.match(game.hud(), /^Service Shaft .*Checkpoint set.*Air dash used.*Falls 0$/);
  play(game, [
    [46], [45, 'right', 'up'], [73], [19, 'right'], [52, 'right', 'up'], [77],
    [16, 'right'], [85, 'right', 'up'],
  ]);
  assert.equal(game.done(), true);
  assert.equal(game.canNext(), true);

  game.next();
  play(game, [
    [36, 'right'], [39, 'right', 'up'], [42, 'right', 'dash'], [41], [21, 'right'],
    [42, 'right', 'up'], [56], [29, 'right'], [41, 'right', 'up'], [30, 'right', 'dash'], [34],
  ]);
  assert.equal(game.done(), true);
  assert.equal(game.canNext(), false);
  assert.match(game.hud(), /^Storm Tower .*Checkpoint set.*Falls 0$/);
  assert.equal(game.message(), 'All three beacons reached!');
  assert.deepEqual(records.map(({ course }) => course), [
    'beacon-ascent:pine-ridge', 'beacon-ascent:service-shaft', 'beacon-ascent:storm-tower',
  ]);
  for (const { time } of records) assert.ok(time > 0 && time < 10);
});

test('Beacon Ascent preserves the checkpoint after a fall and clears it on course restart', () => {
  const game = createBeaconAscent();
  play(game, ridgeCheckpoint);
  assert.match(game.hud(), /Checkpoint set.*Falls 0$/);
  for (let frame = 0; frame < 425 && game.hud().endsWith('Falls 0'); frame++) play(game, [[1, 'right']]);
  assert.match(game.hud(), /Checkpoint set.*Air dash ready.*Falls 1$/);
  assert.equal(game.done(), false);
  game.reset();
  assert.match(game.hud(), /Checkpoint ahead.*Falls 0$/);
});
