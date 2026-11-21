const width = 800;
const height = 450;
const navy = '#122330';
const paper = '#ffeed4';
const muted = '#b2c5bd';
const mint = '#9fdfb1';
const gold = '#ffd282';
const offsets = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

function box(canvas, x, y, w, h, color) {
  canvas.fillStyle = color;
  canvas.fillRect(x, y, w, h);
}

function circle(canvas, x, y, radius, color) {
  canvas.fillStyle = color;
  canvas.beginPath();
  canvas.arc(x, y, radius, 0, Math.PI * 2);
  canvas.fill();
}

function label(canvas, value, x, y, options = {}) {
  const { size = 16, color = paper, align = 'left' } = options;
  canvas.font = '650 ' + size + 'px system-ui';
  canvas.fillStyle = color;
  canvas.textAlign = align;
  canvas.fillText(value, x, y);
}

function polygon(canvas, points, color) {
  canvas.beginPath();
  canvas.moveTo(...points[0]);
  for (const point of points.slice(1)) canvas.lineTo(...point);
  canvas.closePath();
  canvas.fillStyle = color;
  canvas.fill();
}

const basketLayouts = [
  { name: 'First Picnic', rows: ['AABB', 'A.CB', 'DDCC'] },
  { name: 'Lunch for Friends', rows: ['AABBB', 'A.CBB', 'DCC.E', 'DDD.E'] },
  { name: 'Meadow Feast', rows: ['AA.BBB', 'AACB.B', 'D.CEEF', 'DDCEFF', '.DGGG.'] },
];
const supplies = [
  ['Apples', '#e3a27b'],
  ['Sandwiches', '#eec673'],
  ['Berries', '#cf94af'],
  ['Cucumber', '#a6ce96'],
  ['Cookies', '#c6a48c'],
  ['Cheese', '#f1dc91'],
  ['Napkins', '#91c8ce'],
];
const basket = { left: 80, top: 66, width: 432, height: 318, panelX: 537, panelY: 68, panelRow: 44 };

function shapeFrom(points) {
  const left = Math.min(...points.map(([x]) => x));
  const top = Math.min(...points.map(([, y]) => y));
  return points.map(([x, y]) => [x - left, y - top]);
}

function makeBasket(layout) {
  const tiles = [];
  const open = new Set();
  layout.rows.forEach((row, y) => {
    [...row].forEach((letter, x) => {
      if (letter === '.') return;
      const index = letter.charCodeAt(0) - 65;
      (tiles[index] ??= []).push([x, y]);
      open.add(`${x},${y}`);
    });
  });
  const columns = layout.rows[0].length;
  const rows = layout.rows.length;
  const cell = Math.floor(Math.min(basket.width / columns, basket.height / rows));
  return {
    columns, rows, cell, open,
    left: basket.left + (basket.width - columns * cell) / 2,
    top: basket.top + (basket.height - rows * cell) / 2,
    pieces: tiles.map((points, index) => ({
      id: String.fromCharCode(index + 65), name: supplies[index][0], color: supplies[index][1], shape: shapeFrom(points), at: null,
    })),
  };
}

export function createPicnicPack() {
  let stage = 0;
  let layout, board, pieces, selected, x, y, note;

  function reset() {
    layout = basketLayouts[stage];
    board = makeBasket(layout);
    pieces = board.pieces;
    selected = pieces[0];
    x = 0;
    y = 0;
    note = 'Fit every supply inside the open basket spaces.';
  }

  function done() {
    return pieces.every(piece => piece.at);
  }

  function cellOf(piece, dx, dy) {
    return piece.shape.map(([px, py]) => [px + dx, py + dy]);
  }

  function occupant(dx, dy) {
    return pieces.find(piece => piece.at && cellOf(piece, ...piece.at).some(([px, py]) => px === dx && py === dy));
  }

  function fits(piece) {
    return cellOf(piece, x, y).every(([px, py]) => board.open.has(`${px},${py}`) && !occupant(px, py));
  }

  function nextItem() {
    if (done()) return;
    const start = pieces.indexOf(selected);
    for (let offset = 1; offset <= pieces.length; offset++) {
      const piece = pieces[(start + offset) % pieces.length];
      if (!piece.at) {
        selected = piece;
        break;
      }
    }
  }

  function rotate() {
    selected.shape = shapeFrom(selected.shape.map(([px, py]) => [-py, px]));
    note = selected.name + ' rotated.';
  }

  function placeOrLift() {
    if (fits(selected)) {
      selected.at = [x, y];
      note = selected.name + ' packed.';
      nextItem();
      return;
    }
    const placed = occupant(x, y);
    if (placed) {
      placed.at = null;
      selected = placed;
      note = placed.name + ' picked up.';
    } else {
      note = 'That item does not fit there.';
    }
  }

  function drawCell(c, px, py, fill, letter, textColor = navy) {
    box(c, board.left + px * board.cell + 3, board.top + py * board.cell + 3, board.cell - 6, board.cell - 6, fill);
    if (letter) label(c, letter, board.left + (px + .5) * board.cell, board.top + (py + .5) * board.cell + 5,
      { size: 15, color: textColor, align: 'center' });
  }

  reset();
  return {
    title: 'Picnic Pack',
    instructions: 'Fit all the supplies without overlap. Use arrows to move, Space to rotate, Enter to place or pick up, and N for the next item. You can also tap the basket and item list.',
    controls: [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right'], ['Rotate item', 'rotate'], ['Place or pick up', 'place'], ['Next item', 'select']],
    spaceAction: 'rotate',
    enterAction: 'place',
    shortcuts: { n: 'select' },
    announceHud: true,
    resetLabel: 'Empty basket',
    nextLabel: 'Next basket',
    input(key) {
      if (done()) return;
      const move = Object.hasOwn(offsets, key) && offsets[key];
      if (move) {
        x = Math.max(0, Math.min(board.columns - 1, x + move[0]));
        y = Math.max(0, Math.min(board.rows - 1, y + move[1]));
      } else if (key === 'rotate') rotate();
      else if (key === 'place') placeOrLift();
      else if (key === 'select') {
        nextItem();
        note = selected.name + ' selected.';
      }
    },
    point(px, py) {
      if (done()) return;
      if (px >= basket.panelX && px <= 775 && py >= basket.panelY) {
        const piece = pieces[Math.floor((py - basket.panelY) / basket.panelRow)];
        if (piece && !piece.at) {
          selected = piece;
          note = piece.name + ' selected.';
        }
        return;
      }
      const column = Math.floor((px - board.left) / board.cell);
      const row = Math.floor((py - board.top) / board.cell);
      if (column >= 0 && column < board.columns && row >= 0 && row < board.rows) {
        x = column;
        y = row;
        placeOrLift();
      }
    },
    draw(c) {
      box(c, 0, 0, width, height, navy);
      box(c, 27, 52, 492, 342, '#36463a');
      box(c, 32, 57, 482, 332, '#2f3e34');
      label(c, layout.name.toUpperCase(), 29, 36, { size: 20, color: gold });
      label(c, 'BASKET ' + (stage + 1) + ' / ' + basketLayouts.length, 773, 36, { align: 'right', color: muted });
      for (let py = 0; py < board.rows; py++) {
        for (let px = 0; px < board.columns; px++) {
          drawCell(c, px, py, board.open.has(`${px},${py}`) ? '#776e4b' : '#22332d');
        }
      }
      for (const piece of pieces) {
        if (piece.at) for (const [px, py] of cellOf(piece, ...piece.at)) drawCell(c, px, py, piece.color, piece.id);
      }
      if (!done()) {
        c.lineWidth = 2;
        c.strokeStyle = fits(selected) ? mint : gold;
        for (const [px, py] of cellOf(selected, x, y)) {
          if (px < board.columns && py < board.rows) c.strokeRect(board.left + px * board.cell + 6,
            board.top + py * board.cell + 6, board.cell - 12, board.cell - 12);
        }
        c.lineWidth = 3;
        c.strokeStyle = paper;
        c.strokeRect(board.left + x * board.cell + 2, board.top + y * board.cell + 2, board.cell - 4, board.cell - 4);
      }
      pieces.forEach((piece, index) => {
        const startY = basket.panelY + basket.panelRow * index;
        box(c, basket.panelX, startY, 236, 39, piece === selected ? '#4b5c49' : '#253841');
        for (const [px, py] of piece.shape) {
          box(c, basket.panelX + 7 + 7 * px, startY + 8 + 7 * py, 6, 6, piece.color);
        }
        label(c, piece.name, basket.panelX + 36, startY + 25, { size: 14 });
        label(c, piece.at ? 'Packed' : piece === selected ? 'Selected' : '', 764, startY + 24,
          { size: 12, color: muted, align: 'right' });
      });
      label(c, note, width / 2, 428, { align: 'center', color: muted });
    },
    hud() {
      const packed = pieces.filter(piece => piece.at).length;
      return `${layout.name} · ${packed}/${pieces.length} packed · Row ${y + 1}, column ${x + 1}` +
        (done() ? '' : ` · Item ${selected.id}, ${selected.name}`) + ' · ' + note;
    },
    done,
    message: () => stage === basketLayouts.length - 1 ? 'All three baskets packed!' : 'Basket packed!',
    reset,
    canNext: () => done() && stage < basketLayouts.length - 1,
    next() {
      if (done() && stage < basketLayouts.length - 1) {
        stage++;
        reset();
      }
    },
  };
}

const breezes = [
  { name: 'Dandelion Field', ribbons: [225, 175, 136, 214, 281, 245, 168, 228], goal: 5, interval: 1.48, speed: 220 },
  { name: 'Orchard Hill', ribbons: [215, 280, 245, 155, 102, 170, 251, 310, 195], goal: 6, interval: 1.35, speed: 238 },
  { name: 'Sunset Ridge', ribbons: [235, 172, 117, 222, 319, 291, 175, 111, 234, 295], goal: 7, interval: 1.23, speed: 252 },
];
const kiteX = 168;
const rose = '#f4aa95';
const skyPalette = [
  ['#1f4659', '#274d50', '#3d6e56'],
  ['#36496a', '#4a5b5c', '#468583'],
  ['#594966', '#6c5367', '#5c7666'],
];

export function createKiteBreeze() {
  let stage = 0;
  let breeze, time, y, speed, nextRibbon, collected, note;
  function reset() {
    breeze = breezes[stage];
    time = nextRibbon = collected = speed = 0;
    y = 225;
    note = 'Fly past the colored ribbons to collect them.';
  }

  function done() {
    return nextRibbon === breeze.ribbons.length;
  }

  function success() {
    return done() && collected >= breeze.goal;
  }

  function arrival(index) {
    return 2.15 + index * breeze.interval;
  }

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function drawKite(c) {
    const rope = [];
    for (let index = 0; index <= 9; index++) {
      rope.push([kiteX - 17 - index * 10, y + 12 + index * 4 + Math.sin(index * 1.1 - time * 4) * 8]);
    }
    c.beginPath();
    c.moveTo(...rope[0]);
    for (const point of rope.slice(1)) c.lineTo(...point);
    c.strokeStyle = paper;
    c.lineWidth = 2;
    c.stroke();

    for (const index of [2, 5, 8]) {
      const [cx, cy] = rope[index];
      polygon(c, [[cx - 7, cy - 5], [cx + 7, cy + 5], [cx + 7, cy - 5], [cx - 7, cy + 5]], index % 2 ? mint : gold);
    }
    polygon(c, [[kiteX - 27, y], [kiteX - 4, y - 28], [kiteX + 26, y - 3], [kiteX - 5, y + 26]], paper);
    polygon(c, [[kiteX - 22, y], [kiteX - 5, y - 23], [kiteX + 22, y - 3], [kiteX - 5, y + 21]], gold);
    polygon(c, [[kiteX - 5, y - 23], [kiteX + 22, y - 3], [kiteX - 5, y + 7]], rose);
    polygon(c, [[kiteX - 22, y], [kiteX - 5, y + 7], [kiteX - 5, y + 21]], mint);
  }

  reset();
  return {
    title: 'Kite Breeze',
    instructions: 'Fly through the ribbons to collect them. Hold Up or Down, or use the on-screen controls. Press Space or Steady to slow your climb or descent.',
    controls: [['Climb', 'up'], ['Dip', 'down'], ['Steady', 'steady']],
    spaceAction: 'steady',
    announceHud: true,
    resetLabel: 'Restart breeze',
    nextLabel: 'Next breeze',
    input(key) {
      if (key === 'up') speed = clamp(speed - 60, -205, 205);
      if (key === 'down') speed = clamp(speed + 60, -205, 205);
      if (key === 'steady') speed *= .2;
    },
    update(dt, held) {
      if (done()) return;
      time += dt;
      const direction = Number(held.has('down')) - Number(held.has('up'));
      const drift = 35 * Math.sin(time * .83 + stage);
      const damping = Math.exp(-(held.has('steady') ? 8 : 2.2) * dt);
      speed = clamp((speed + (direction * 455 + drift) * dt) * damping, -205, 205);
      const nextY = y + speed * dt;
      y = clamp(nextY, 83, 346);
      if (nextY !== y) speed = 0;
      if (time < arrival(nextRibbon)) return;
      const caught = Math.abs(y - breeze.ribbons[nextRibbon]) <= 38;
      if (caught) collected++;
      nextRibbon++;
      note = caught ? 'Ribbon collected!' : 'Keep flying toward the next ribbon.';
    },
    draw(c) {
      const [sky, hill, grass] = skyPalette[stage];
      box(c, 0, 0, width, height, sky);
      for (let index = 0; index < 9; index++) {
        const cx = (111 * index + 78 - time * (3 + index % 3) + 900) % 900;
        const cy = 92 + (index * 37) % 144;
        c.globalAlpha = .35;
        circle(c, cx, cy, 22, muted);
        circle(c, cx + 27, cy + 6, 27, muted);
        circle(c, cx + 52, cy + 8, 17, muted);
        c.globalAlpha = 1;
      }
      polygon(c, [[0, 360], [115, 327], [234, 346], [358, 330], [466, 366], [600, 335], [800, 361], [800, 450], [0, 450]], hill);
      polygon(c, [[0, 389], [172, 377], [289, 403], [461, 370], [580, 392], [800, 365], [800, 450], [0, 450]], grass);
      for (let index = nextRibbon; index < breeze.ribbons.length; index++) {
        const rx = kiteX + (arrival(index) - time) * breeze.speed;
        if (rx > width + 40) break;
        const ry = breeze.ribbons[index];
        c.strokeStyle = paper;
        c.lineWidth = 2;
        c.strokeRect(rx - 13, ry - 10, 26, 20);
        polygon(c, [[rx - 12, ry - 8], [rx + 12, ry - 8], [rx + 12, ry + 13], [rx, ry + 7], [rx - 12, ry + 13]], rose);
        label(c, index + 1, rx, ry - 17, { size: 14, color: paper, align: 'center' });
      }
      drawKite(c);
      label(c, breeze.name.toUpperCase(), 29, 38, { size: 20, color: gold });
      label(c, 'BREEZE ' + (stage + 1) + ' / ' + breezes.length, 771, 38, { align: 'right' });
      label(c, 'RIBBONS ' + collected + ' / ' + breeze.ribbons.length + ' · GOAL ' + breeze.goal, 29, 428);
      label(c, note, 771, 428, { align: 'right' });
    },
    hud() {
      return `${breeze.name} · Ribbons ${collected}/${breeze.ribbons.length} · Goal ${breeze.goal} · Passed ${nextRibbon}/${breeze.ribbons.length}`;
    },
    done,
    message: () => !success() ? 'Try this breeze again' : stage === breezes.length - 1 ? 'All three breezes cleared!' : 'Breeze cleared!',
    reset,
    canNext: () => success() && stage < breezes.length - 1,
    next() {
      if (success() && stage < breezes.length - 1) {
        stage++;
        reset();
      }
    },
  };
}
