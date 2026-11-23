const width = 800;
const height = 450;
const columns = 7;
const rows = 5;
const cell = 64;
const left = 44;
const top = 84;
const [north, east, south, west] = [0, 1, 2, 3];
const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const slashReflection = [east, north, west, south];
const backslashReflection = [west, south, east, north];
const arrows = { up: north, right: east, down: south, left: west };
const palette = { paper: '#edf7ef', muted: '#a6bcba', gold: '#ffe0a1', blue: '#81e4de', idle: '#68817f' };

const levels = [
  {
    name: 'Light Gallery', source: [0, 2], receivers: [[6, 0]],
    mirrors: [[2, 2, false], [2, 0, false]], splitters: [],
    instructions: ['Rotate both mirrors to bend', 'the beam toward the receiver.']
  },
  {
    name: 'Relay Junction', source: [0, 2], receivers: [[6, 2], [1, 4]],
    mirrors: [[3, 0, true], [1, 0, false]], splitters: [[3, 2, false]],
    instructions: ['A splitter sends light straight', 'through and around a corner.']
  },
  {
    name: 'Night Observatory', source: [0, 3], receivers: [[6, 3], [0, 1], [0, 4]],
    mirrors: [[2, 1, true], [4, 4, false]], splitters: [[2, 3, false], [4, 3, true]],
    instructions: ['Use both splitters to light', 'all three receivers at once.']
  }
];

const cellName = (column, row) => `${String.fromCharCode(65 + column)}${row + 1}`;
const keyAt = (column, row) => row * columns + column;
const inside = (column, row) => column >= 0 && column < columns && row >= 0 && row < rows;
const pixelX = column => left + (column + .5) * cell;
const pixelY = row => top + (row + .5) * cell;

function panel(c, x, y, w, h, radius, fill, outline) {
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.fillStyle = fill;
  c.fill();
  if (outline) {
    c.strokeStyle = outline;
    c.lineWidth = 1;
    c.stroke();
  }
}

function label(c, copy, x, y, size, color = palette.paper, weight = 600) {
  c.font = `${weight} ${size}px system-ui, sans-serif`;
  c.fillStyle = color;
  c.fillText(copy, x, y);
}

function line(c, x1, y1, x2, y2, color, weight) {
  c.strokeStyle = color;
  c.lineWidth = weight;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

export function createPrismRelay() {
  let levelIndex = 0;
  let level, optics, cursor, receivers, segments, lit, rotations;

  function trace() {
    const visited = new Set();
    const pending = [[...level.source, east]];
    lit = new Set();
    segments = [];
    while (pending.length) {
      const [column, row, direction] = pending.pop();
      const state = keyAt(column, row) * offsets.length + direction;
      if (visited.has(state)) continue;
      visited.add(state);
      const [dx, dy] = offsets[direction];
      const ahead = [column + dx, row + dy];
      if (!inside(...ahead)) {
        segments.push([column, row, column + dx * .42, row + dy * .42]);
        continue;
      }
      segments.push([column, row, ...ahead]);
      const key = keyAt(...ahead);
      if (receivers.has(key)) {
        lit.add(key);
        continue;
      }
      if (key === keyAt(...level.source)) continue;
      const optic = optics.get(key);
      if (!optic || optic.splitter) pending.push([...ahead, direction]);
      if (optic) {
        const reflection = optic.slash ? slashReflection : backslashReflection;
        pending.push([...ahead, reflection[direction]]);
      }
    }
  }

  function reset() {
    level = levels[levelIndex];
    rotations = 0;
    optics = new Map();
    for (const [column, row, slash] of level.mirrors) optics.set(keyAt(column, row), { slash, splitter: false });
    for (const [column, row, slash] of level.splitters) optics.set(keyAt(column, row), { slash, splitter: true });
    receivers = new Set(level.receivers.map(([column, row]) => keyAt(column, row)));
    cursor = (level.splitters[0] || level.mirrors[0]).slice(0, 2);
    trace();
  }

  function rotate() {
    const optic = optics.get(keyAt(...cursor));
    if (!optic) return;
    optic.slash = !optic.slash;
    rotations += 1;
    trace();
  }

  function describeCell() {
    const key = keyAt(...cursor);
    const optic = optics.get(key);
    if (optic) return `${optic.splitter ? 'Splitter' : 'Mirror'} slopes ${optic.slash ? 'up' : 'down'}`;
    if (receivers.has(key)) return lit.has(key) ? 'Lit receiver' : 'Unlit receiver';
    if (key === keyAt(...level.source)) return 'Emitter';
    return 'Empty';
  }

  function draw(c) {
    c.save();
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const backdrop = c.createLinearGradient(0, 0, width, height);
    backdrop.addColorStop(0, '#172d36');
    backdrop.addColorStop(1, '#0b141f');
    c.fillStyle = backdrop;
    c.fillRect(0, 0, width, height);
    label(c, level.name, left, 35, 27, palette.paper, 750);

    for (let column = 0; column < columns; column++) {
      label(c, String.fromCharCode(65 + column), pixelX(column) - 4, top - 13, 12, palette.muted);
    }
    for (let row = 0; row < rows; row++) {
      label(c, String(row + 1), left - 18, pixelY(row), 12, palette.muted);
      for (let column = 0; column < columns; column++) {
        const x = pixelX(column);
        const y = pixelY(row);
        const key = keyAt(column, row);
        const occupied = optics.has(key) || receivers.has(key) || key === keyAt(...level.source);
        const selected = column === cursor[0] && row === cursor[1];
        panel(c, x - 30, y - 30, 60, 60, 9, selected ? '#305052' : occupied ? '#1d3840' : '#11252c',
          selected ? palette.gold : '#2d4951');
        if (!occupied) panel(c, x - 1, y - 1, 2, 2, 1, '#40616a');
      }
    }

    for (const [x1, y1, x2, y2] of segments) {
      line(c, pixelX(x1), pixelY(y1), pixelX(x2), pixelY(y2), '#78dedb30', 12);
    }
    for (const [x1, y1, x2, y2] of segments) {
      line(c, pixelX(x1), pixelY(y1), pixelX(x2), pixelY(y2), palette.blue, 3);
    }

    const sx = pixelX(level.source[0]);
    const sy = pixelY(level.source[1]);
    panel(c, sx - 16, sy - 16, 32, 32, 7, '#12323a', palette.blue);
    line(c, sx - 5, sy - 6, sx + 5, sy, palette.blue, 3);
    line(c, sx + 5, sy, sx - 5, sy + 6, palette.blue, 3);
    for (const [key, optic] of optics) {
      const x = pixelX(key % columns);
      const y = pixelY(Math.floor(key / columns));
      const slope = optic.slash ? -1 : 1;
      if (optic.splitter) panel(c, x - 19, y - 19, 38, 38, 8, '#55452f', palette.gold);
      line(c, x - 15, y - slope * 15, x + 15, y + slope * 15, '#10262b', 9);
      line(c, x - 13, y - slope * 13, x + 13, y + slope * 13, optic.splitter ? palette.gold : palette.paper, 4);
    }
    for (const [column, row] of level.receivers) {
      const x = pixelX(column);
      const y = pixelY(row);
      const active = lit.has(keyAt(column, row));
      panel(c, x - 18, y - 18, 36, 36, 17, '#15333c', active ? palette.blue : palette.idle);
      panel(c, x - 9, y - 9, 18, 18, 9, active ? palette.blue : '#304a52');
    }

    panel(c, 516, top, 250, rows * cell - 4, 13, '#162a34', '#315059');
    label(c, `Stage ${levelIndex + 1} of ${levels.length}`, 540, 115, 13, palette.muted);
    label(c, 'Receivers', 540, 156, 15);
    label(c, `${lit.size} / ${receivers.size}`, 540, 192, 33, palette.blue, 780);
    label(c, `${rotations} ${rotations === 1 ? 'rotation' : 'rotations'}`, 540, 229, 14, palette.muted);
    line(c, 540, 254, 740, 254, '#385661', 1);
    level.instructions.forEach((copy, index) => label(c, copy, 540, 281 + index * 22, 14, palette.paper, 500));
    label(c, `${cellName(...cursor)}  ${describeCell()}`, 540, 364, 14, palette.gold);
    c.restore();
  }

  const done = () => lit.size === receivers.size;
  const canNext = () => done() && levelIndex + 1 < levels.length;
  reset();
  return {
    title: 'Prism Relay', width, height, announceHud: true,
    instructions: 'Light every receiver. Tap a mirror or splitter to turn it, or move with arrow keys and press Space.',
    controls: [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right'], ['Rotate optic', 'rotate']],
    spaceAction: 'rotate', enterAction: 'rotate', reset, done, canNext, draw,
    message: () => canNext() ? 'All receivers lit' : 'Prism Relay complete',
    next() {
      if (!canNext()) return;
      levelIndex += 1;
      reset();
    },
    input(action) {
      if (done()) return;
      if (action === 'rotate') {
        rotate();
      } else if (Object.hasOwn(arrows, action)) {
        const [dx, dy] = offsets[arrows[action]];
        const moved = [cursor[0] + dx, cursor[1] + dy];
        if (inside(...moved)) cursor = moved;
      }
    },
    point(x, y) {
      const slot = [Math.floor((x - left) / cell), Math.floor((y - top) / cell)];
      if (!inside(...slot) || done()) return;
      cursor = slot;
      rotate();
    },
    hud: () => `${level.name} · Receivers ${lit.size} of ${receivers.size} · ${cellName(...cursor)} ${describeCell()}`
  };
}
