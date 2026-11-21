const gardens = [
  { name: 'Dewdrop Walk', rows: ['....G', '..S..', '....#', '..C#.'] },
  { name: 'Hedge Corner', rows: ['.C...#', '.C....', '.S#...', '....#.', '.#G...'] },
  { name: 'Clover Court', rows: ['C.#..GC', '..C....', '#.S....', '......#', '..##.##'] },
  { name: 'Moonlit Garden', rows: ['#....#.', '.#....S', '...C.CG', '.#C...#', '..#.#..', '..C.##.'] },
];

const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const colors = { ground: '#173831', hedge: '#235343', leaves: '#53976e', path: '#d9d5af', shade: '#fbefd3', mint: '#8ad9a3', gold: '#fabd6c' };
const list = new Intl.ListFormat('en');
const width = 800;
const height = 450;

function fill(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function disc(c, x, y, radius, color) {
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

function text(c, value, x, y, size, color, align = 'left', weight = 600) {
  c.font = weight + ' ' + size + 'px system-ui, sans-serif';
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(value, x, y);
}

function loadGarden({ rows }) {
  const columns = rows[0].length;
  const size = Math.floor(Math.min(470 / columns, 312 / rows.length));
  const board = {
    rows, size, left: 39 + (470 - size * columns) / 2, top: 74 + (312 - size * rows.length) / 2,
    clovers: [],
  };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'S') board.start = { x, y };
      if (row[x] === 'G') board.goal = { x, y };
      if (row[x] === 'C') board.clovers.push({ x, y });
    }
  });
  return board;
}

function same(a, b) {
  return a.x === b.x && a.y === b.y;
}

function describe({ x, y }) {
  return 'row ' + (y + 1) + ', column ' + (x + 1);
}

export function createCloverRoll({ reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches } = {}) {
  let garden = 0;
  let board, position, remaining, history, trail, moves, note, motion;

  function reset() {
    board = loadGarden(gardens[garden]);
    position = board.start;
    remaining = board.clovers;
    history = [];
    trail = [];
    moves = 0;
    motion = null;
    note = 'Gather the clovers and stop in the bowl.';
  }

  function done() {
    return !motion && !remaining.length && same(position, board.goal);
  }

  function rollPath([dx, dy]) {
    const path = [];
    let { x, y } = position;
    while (true) {
      x += dx;
      y += dy;
      const tile = board.rows[y]?.[x];
      if (!tile || tile === '#') return path;
      path.push({ x, y });
    }
  }

  function tilt(direction) {
    const path = rollPath(directions[direction]);
    if (!path.length) {
      note = 'The marble cannot roll ' + direction + '.';
      return;
    }
    history.push({ position, remaining, trail });
    if (history.length > 250) history.shift();
    trail = [position, ...path];
    position = path.at(-1);
    const before = remaining.length;
    remaining = remaining.filter(clover => !path.some(square => same(square, clover)));
    const found = before - remaining.length;
    moves++;
    if (!reducedMotion) motion = { elapsed: 0, duration: .12 + path.length * .035 };
    if (same(position, board.goal) && remaining.length) note = 'The bowl opens after you collect every clover.';
    else if (found) note = found === 1 ? 'Clover collected.' : found + ' clovers collected.';
    else note = 'Rolled ' + direction + '.';
  }

  function undo() {
    const previous = history.pop();
    if (!previous) {
      note = 'Make a roll before using undo.';
      return;
    }
    ({ position, remaining, trail } = previous);
    moves--;
    note = 'Last roll undone.';
  }

  function directionsNote() {
    const stops = Object.entries(directions).flatMap(([direction, delta]) => {
      const stop = rollPath(delta).at(-1);
      return stop ? [direction + ' to ' + describe(stop)] : [];
    });
    const markers = list.format(remaining.map(describe));
    note = 'Bowl at ' + describe(board.goal) + '. ' +
      (markers ? 'Clovers at ' + markers + '. ' : 'Bowl open. ') +
      'Roll ' + list.format(stops) + '.';
  }

  function center({ x, y }) {
    return [board.left + (x + .5) * board.size, board.top + (y + .5) * board.size];
  }

  function drawClover(c, x, y, radius) {
    disc(c, x, y + radius * .73, radius * .23, colors.hedge);
    for (const [dx, dy] of [[-.42, -.36], [.42, -.36], [-.42, .34], [.42, .34]]) {
      disc(c, x + dx * radius, y + dy * radius, radius * .5, colors.leaves);
      disc(c, x + dx * radius, y + dy * radius - radius * .11, radius * .32, colors.hedge);
    }
    disc(c, x, y, radius * .22, colors.leaves);
  }

  function draw(c) {
    const { rows, left, top, size } = board;
    fill(c, 0, 0, width, height, colors.ground);
    fill(c, 18, 54, 518, 350, '#304c3b');
    fill(c, 24, 60, 506, 338, '#263e33');
    text(c, 'CLOVER ROLL', 24, 36, 23, colors.mint, 'left', 800);
    const radius = size * .26;
    rows.forEach((row, y) => {
      [...row].forEach((tile, x) => {
        const tx = left + x * size;
        const ty = top + y * size;
        const [cx, cy] = center({ x, y });
        fill(c, tx + 1, ty + 1, size - 2, size - 2, tile === '#' ? colors.hedge : (x + y) % 2 ? '#c6c8a1' : colors.path);
        if (tile !== '#') return;
        disc(c, cx - radius * .36, cy + radius * .1, radius * .76, colors.leaves);
        disc(c, cx + radius * .36, cy + radius * .1, radius * .76, colors.leaves);
        disc(c, cx, cy - radius * .46, radius * .79, '#669f72');
        disc(c, cx, cy - radius * .53, radius * .19, '#93b982');
      });
    });
    for (const square of trail) disc(c, ...center(square), Math.max(2, size * .035), '#718267');
    const [goalX, goalY] = center(board.goal);
    disc(c, goalX, goalY, radius * 1.26, remaining.length ? colors.hedge : '#979754');
    disc(c, goalX, goalY, radius, remaining.length ? '#94a182' : colors.gold);
    disc(c, goalX, goalY, radius * .67, remaining.length ? colors.hedge : '#6a472c');
    for (const clover of remaining) drawClover(c, ...center(clover), radius);
    const [x, y] = center(position);
    const [originX, originY] = motion ? center(trail[0]) : [x, y];
    const progress = motion ? Math.min(1, motion.elapsed / motion.duration) : 1;
    const eased = progress * progress * (3 - 2 * progress);
    const marbleX = originX + (x - originX) * eased;
    const marbleY = originY + (y - originY) * eased;
    disc(c, marbleX + 2, marbleY + 3, radius, '#807e60');
    const glaze = c.createRadialGradient(marbleX - radius * .32, marbleY - radius * .37, 0, marbleX, marbleY, radius);
    glaze.addColorStop(0, '#eaf4fc');
    glaze.addColorStop(.27, '#acdafa');
    glaze.addColorStop(.73, '#497bb8');
    glaze.addColorStop(1, '#284a83');
    disc(c, marbleX, marbleY, radius, glaze);
    disc(c, marbleX - radius * .34, marbleY - radius * .39, radius * .15, '#f6fbff');

    fill(c, 553, 54, 224, 350, '#102c27');
    text(c, 'GARDEN ' + (garden + 1) + ' / ' + gardens.length, 574, 86, 15, colors.mint);
    text(c, gardens[garden].name, 574, 118, 23, colors.shade, 'left', 750);
    fill(c, 574, 145, 180, 1, '#47715b');
    text(c, (board.clovers.length - remaining.length) + ' / ' + board.clovers.length, 574, 187, 29, colors.mint, 'left', 750);
    text(c, 'CLOVERS', 574, 210, 14, colors.shade);
    text(c, moves + (moves === 1 ? ' roll' : ' rolls'), 574, 249, 19, colors.shade);
    text(c, remaining.length ? 'Bowl closed' : 'Bowl open', 574, 282, 18, remaining.length ? '#a2baa3' : colors.gold);
    text(c, 'Roll to the next hedge', 574, 351, 14, colors.shade);
    text(c, 'or garden edge.', 574, 373, 14, colors.shade);
    text(c, 'Collect every clover, then stop in the bowl.', width / 2, 433, 15, colors.mint, 'center');
  }

  reset();
  return {
    title: 'Clover Roll',
    instructions: 'Tilt with arrows, WASD, or the direction buttons. You can also tap a space in the marble’s row or column. The marble rolls to the next hedge or edge. Collect every clover and stop in the bowl. Press U to undo or H to read the garden.',
    controls: [['↑', 'up'], ['←', 'left'], ['↓', 'down'], ['→', 'right'], ['Undo move', 'undo'], ['Read garden', 'describe']],
    shortcuts: { u: 'undo', h: 'describe' },
    announceHud: true,
    resetLabel: 'Reset garden',
    nextLabel: 'Next garden',
    draw,
    input(action) {
      if (motion || done()) return;
      if (Object.hasOwn(directions, action)) tilt(action);
      else if (action === 'undo') undo();
      else if (action === 'describe') directionsNote();
    },
    point(px, py) {
      if (motion || done()) return;
      const x = Math.floor((px - board.left) / board.size);
      const y = Math.floor((py - board.top) / board.size);
      if (!board.rows[y]?.[x]) return;
      if (x === position.x && y !== position.y) tilt(y < position.y ? 'up' : 'down');
      else if (y === position.y && x !== position.x) tilt(x < position.x ? 'left' : 'right');
    },
    animating: () => Boolean(motion),
    update(dt) {
      if (!motion) return;
      motion.elapsed += dt;
      if (motion.elapsed >= motion.duration) motion = null;
    },
    hud() {
      return gardens[garden].name + ' · ' + (board.clovers.length - remaining.length) + '/' + board.clovers.length +
        ' clovers · ' + moves + (moves === 1 ? ' roll' : ' rolls') + ' · Marble at ' + describe(position) + ' · ' + note;
    },
    done,
    message: () => garden === gardens.length - 1 ? 'All four gardens cleared!' : 'Garden cleared!',
    reset,
    canNext: () => done() && garden < gardens.length - 1,
    next() {
      if (done() && garden < gardens.length - 1) {
        garden++;
        reset();
      }
    },
  };
}
