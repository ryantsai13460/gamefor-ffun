import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createCloverRoll } from '../assets/clover-roll.js';

const directions = { U: 'up', D: 'down', L: 'left', R: 'right' };

test('Clover Roll clears four distinct boards by collecting every clover and stopping at the bowl', () => {
  const game = createCloverRoll({ reducedMotion: true });
  const paths = ['DUR', 'UDRDL', 'ULUDRULDRU', 'DLDRURDLRURD'];
  const completeAt = [[1, 5], [5, 3], [1, 6], [3, 7]];
  paths.forEach((path, level) => {
    assert.equal(game.done(), false);
    assert.equal(game.canNext(), false);
    for (const key of path) game.input(directions[key]);
    const [row, column] = completeAt[level];
    const clovers = level + 1;
    assert.match(game.hud(), new RegExp(`${clovers}/${clovers} clovers · ${path.length} rolls · Marble at row ${row}, column ${column}`));
    assert.equal(game.done(), true);
    assert.equal(game.canNext(), level < paths.length - 1);
    game.next();
  });
  assert.equal(game.message(), 'All four gardens cleared!');
  game.reset();
  assert.match(game.hud(), /Moonlit Garden · 0\/4 clovers · 0 rolls/);
});

test('Clover Roll describes accessible stops, keeps the bowl locked and restores clovers on undo', () => {
  const game = createCloverRoll({ reducedMotion: true });
  game.input('describe');
  assert.match(game.hud(), /Bowl at row 1, column 5.*Clovers at row 4, column 3.*down to row 4, column 3/);
  game.input('up');
  game.input('right');
  assert.match(game.hud(), /0\/1 clovers.*Marble at row 1, column 5.*bowl opens after you collect every clover/);
  assert.equal(game.done(), false);
  game.input('right');
  assert.match(game.hud(), /2 rolls.*cannot roll right/);
  game.reset();
  game.input('down');
  assert.match(game.hud(), /1\/1 clovers · 1 roll/);
  game.input('undo');
  assert.match(game.hud(), /0\/1 clovers · 0 rolls · Marble at row 2, column 3 · Last roll undone/);
});

test('Clover Roll accepts a tap and finishes its motion before taking another tilt', () => {
  const game = createCloverRoll({ reducedMotion: false });
  game.point(274, 347);
  assert.equal(game.animating(), true);
  game.input('up');
  assert.match(game.hud(), /1\/1 clovers · 1 roll · Marble at row 4, column 3/);
  game.update(.3);
  assert.equal(game.animating(), false);
  game.input('up');
  game.update(.4);
  game.input('right');
  assert.equal(game.done(), false);
  game.update(.4);
  assert.equal(game.done(), true);
});
