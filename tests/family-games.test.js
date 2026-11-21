import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createKiteBreeze, createPicnicPack } from '../assets/family-games.js';

test('Picnic Pack supports rotation, reversible placement and all three basket solutions', () => {
  const game = createPicnicPack();
  game.input('right');
  game.input('down');
  game.input('place');
  assert.match(game.hud(), /0\/4 packed.*does not fit there/);
  game.reset();
  game.input('rotate');
  assert.match(game.hud(), /Apples rotated/);
  game.input('rotate');
  game.input('rotate');
  game.input('rotate');
  game.input('place');
  assert.match(game.hud(), /1\/4 packed.*Apples packed/);
  game.input('place');
  assert.match(game.hud(), /0\/4 packed.*Apples picked up/);

  const baskets = [
    { left: 84, top: 66, cell: 106, placements: [[0, 0], [2, 0], [2, 1], [0, 2]] },
    { left: 98, top: 67, cell: 79, placements: [[0, 0], [2, 0], [1, 1], [0, 2], [4, 2]] },
    { left: 107, top: 67, cell: 63, placements: [[0, 0], [3, 0], [2, 1], [0, 2], [3, 2], [4, 2], [2, 4]] },
  ];
  baskets.forEach(({ left, top, cell, placements }, stage) => {
    placements.forEach(([column, row], piece) => {
      game.point(560, 86 + piece * 44);
      game.point(left + (column + .5) * cell, top + (row + .5) * cell);
      assert.match(game.hud(), new RegExp(`${piece + 1}/${placements.length} packed`));
    });
    assert.equal(game.done(), true);
    assert.equal(game.canNext(), stage < 2);
    game.next();
  });
  assert.equal(game.message(), 'All three baskets packed!');
  game.reset();
  assert.match(game.hud(), /Meadow Feast.*0\/7 packed/);
});

test('Kite Breeze supports restarting after a missed goal and clearing all three courses', () => {
  const game = createKiteBreeze();
  const idle = new Set();
  const step = 1 / 120;
  for (let tick = 0; tick < 1800 && !game.done(); tick++) game.update(step, idle);
  assert.equal(game.done(), true);
  assert.equal(game.canNext(), false);
  assert.equal(game.message(), 'Try this breeze again');
  game.next();
  game.reset();
  assert.match(game.hud(), /Dandelion Field.*Ribbons 0\/8.*Passed 0\/8/);

  let pathStart;
  let kiteY;
  let ribbonY;
  const canvas = {
    fillRect() {}, fillText() {}, beginPath() { pathStart = null; }, arc() {},
    moveTo(x, y) { pathStart = [x, y]; }, lineTo() {}, closePath() {}, stroke() {},
    strokeRect(x, y) { if (ribbonY === undefined) ribbonY = y + 10; },
    fill() { if (this.fillStyle === '#9fdfb1' && pathStart?.[0] === 146) kiteY = pathStart[1]; },
  };
  for (let stage = 0; stage < 3; stage++) {
    for (let tick = 0; tick < 1900 && !game.done(); tick++) {
      ribbonY = undefined;
      game.draw(canvas);
      const difference = ribbonY - kiteY;
      if (Math.abs(difference) <= 8) game.input('steady');
      const held = Math.abs(difference) > 8 ? new Set([difference < 0 ? 'up' : 'down']) : idle;
      game.update(step, held);
    }
    assert.equal(game.done(), true);
    assert.equal(game.message(), stage < 2 ? 'Breeze cleared!' : 'All three breezes cleared!');
    assert.equal(game.canNext(), stage < 2);
    game.next();
  }
});
