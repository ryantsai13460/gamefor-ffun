import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createLanternShift } from '../assets/lantern-shift.js';

test('Lantern Shift clears three distinct courses and counts consecutive catches', () => {
  const game = createLanternShift({ reducedMotion: true });
  const courses = [['Blue Hour', 8], ['Dusk Market', 10], ['Midnight Loop', 12]];
  courses.forEach(([course, gates], index) => {
    assert.ok(game.hud().startsWith(course + ' · Lanterns 0/' + gates));
    assert.equal(game.canNext(), false);
    for (let frame = 0; frame < 1300 && !game.done(); frame++) {
      const upcoming = game.hud().match(/Next lantern \d+ in (inner|outer) lane/);
      if (upcoming) game.input(upcoming[1] === 'inner' ? 'left' : 'right');
      game.update(1 / 60);
    }
    assert.equal(game.done(), true);
    assert.ok(game.hud().includes('Lanterns ' + gates + '/' + gates));
    assert.ok(game.hud().includes('Best streak ' + gates));
    assert.equal(game.message(), index === 2 ? 'All three courses cleared!' : 'Perfect course!');
    assert.equal(game.canNext(), index < 2);
    game.next();
  });
});

test('Lantern Shift misses a wrong lane and restarts without advancing', () => {
  const game = createLanternShift();
  game.input('swap');
  game.update(2.3);
  assert.match(game.hud(), /Lanterns 0\/8.*Lane outer.*Next lantern 2 in outer lane/);
  game.update(2.0);
  assert.match(game.hud(), /Lanterns 1\/8.*Next lantern 3 in outer lane/);
  game.update(20);
  assert.equal(game.done(), true);
  assert.equal(game.canNext(), false);
  assert.equal(game.message(), 'Try this course again');
  game.next();
  game.reset();
  assert.match(game.hud(), /^Blue Hour · Lanterns 0\/8.*Lane inner.*Next lantern 1/);
});

test('Lantern Shift accepts direct ring taps and retains a relaxed pace on restart', () => {
  const game = createLanternShift();
  game.point(426, 236);
  assert.match(game.hud(), /Lane outer/);
  game.point(650, 230);
  assert.match(game.hud(), /Lane outer/);
  game.point(377, 236);
  assert.match(game.hud(), /Lane inner/);
  game.input('pace');
  game.update(2.3);
  assert.match(game.hud(), /Lanterns 0\/8.*Next lantern 1.*Relaxed pace/);
  game.update(1.2);
  assert.match(game.hud(), /Lanterns 1\/8.*Next lantern 2.*Relaxed pace/);
  game.reset();
  assert.match(game.hud(), /Lanterns 0\/8.*Lane inner.*Relaxed pace/);
});
