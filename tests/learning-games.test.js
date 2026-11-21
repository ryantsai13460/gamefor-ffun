import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createClockCourier, createFractionKitchen } from '../assets/learning-games.js';

test('Fraction Kitchen checks equivalent fractions exactly and progresses through four orders', () => {
  const game = createFractionKitchen();
  const orders = [[2, 3], [1, 2, 3], [2, 3], [2, 4]];
  const targets = ['1/2', '3/4', '2/3', '5/6'];
  orders.forEach((slices, index) => {
    assert.match(game.hud(), new RegExp(`Order ${index + 1} of 4 · Match ${targets[index]} · Tray 0`));
    for (const slice of slices) game.input('slice' + slice);
    assert.match(game.hud(), new RegExp('Tray ' + targets[index]));
    assert.equal(game.done(), false);
    game.input('serve');
    assert.equal(game.done(), true);
    assert.equal(game.canNext(), index < 3);
    game.next();
  });
  assert.equal(game.message(), 'All four orders served!');
});

test('Fraction Kitchen supports tray editing, deselection and feedback after checking an incorrect tray', () => {
  const game = createFractionKitchen();
  game.point(300, 320);
  game.input('serve');
  assert.match(game.hud(), /Tray 1\/4.*Too little/);
  game.point(300, 320);
  assert.match(game.hud(), /Tray 0.*Removed 1\/4/);
  for (const slice of ['slice1', 'slice2', 'slice3', 'slice4']) game.input(slice);
  game.input('serve');
  assert.match(game.hud(), /Tray 23\/24.*Too much/);
  assert.equal(game.done(), false);
  game.reset();
  assert.match(game.hud(), /Order 1 of 4.*Tray 0/);
});

test('Clock Courier solves all five clues and wraps across twelve on the last stop', () => {
  const game = createClockCourier();
  const solutions = [
    { hours: 1, steps: 6, reading: '4:30' },
    { hours: 1, steps: 2, reading: '9:15' },
    { hours: 0, steps: 6, reading: '6:45' },
    { hours: 0, steps: 4, reading: '10:40' },
    { hours: 0, steps: -5, reading: '11:50' },
  ];
  solutions.forEach(({ hours, steps, reading }, index) => {
    assert.match(game.hud(), new RegExp('Stop ' + (index + 1) + ' of 5'));
    for (let step = 0; step < hours; step++) game.input('up');
    for (let step = 0; step < Math.abs(steps); step++) game.input(steps < 0 ? 'left' : 'right');
    assert.ok(game.hud().includes('Clock set to ' + reading));
    game.input('deliver');
    assert.equal(game.done(), true);
    assert.equal(game.canNext(), index < 4);
    game.next();
  });
  assert.equal(game.message(), 'All five deliveries made!');
});

test('Clock Courier distinguishes hour and minute taps and provides corrective feedback', () => {
  const game = createClockCourier();
  game.input('deliver');
  assert.match(game.hud(), /Check the minute hand/);
  game.point(281, 360);
  assert.match(game.hud(), /Clock set to 3:30/);
  game.input('deliver');
  assert.match(game.hud(), /The minutes match. Check the hour hand/);
  game.point(364, 276);
  assert.match(game.hud(), /Clock set to 4:30/);
  game.input('deliver');
  assert.equal(game.done(), true);
  game.reset();
  assert.match(game.hud(), /Clock set to 3:00/);
});
