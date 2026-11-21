const width = 800;
const height = 450;
const navy = '#0d1c2d';
const water = '#142b3e';
const line = '#35576e';
const light = '#edf7f7';
const muted = '#a9c4ce';
const mint = '#8fe1cb';
const gold = '#ffd388';
const pink = '#f5a0a5';

function rectangle(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function circle(c, x, y, radius, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

function label(c, value, x, y, size = 18, color = light, align = 'left') {
  c.font = '650 ' + size + 'px system-ui';
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(value, x, y);
}

function lines(c, points, color, thickness) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.lineWidth = thickness;
  c.strokeStyle = color;
  c.stroke();
}

const gridWidth = 7;
const gridHeight = 6;
const tileSize = 54;
const boardX = (width - tileSize * gridWidth) / 2;
const boardY = 54;
const portNames = ['north', 'east', 'south', 'west'];
const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const dockLetters = ['A', 'B', 'C'];
const cargoColors = [mint, gold, '#c6b7f7'];
const straightTracks = [[0, 2], [1, 3]];
const curvedTracks = [[0, 1], [1, 2], [2, 3], [0, 3]];
const switchTracks = [...straightTracks, ...curvedTracks];
const coordinates = {
  up: steps[0], right: steps[1], down: steps[2], left: steps[3]
};

// A route records x/y coordinates from the loading shed to a named dock.
const schedules = [
  {
    name: 'East Pier',
    routes: [
      [[0, 2], [1, 2], [2, 2], [2, 1], [3, 1], [4, 1], [4, 0], [5, 0], [6, 0]],
      [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [5, 4], [5, 5], [6, 5]],
    ],
  },
  {
    name: 'Lantern Basin',
    routes: [
      [[0, 3], [1, 3], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]],
      [[0, 3], [1, 3], [2, 3], [2, 2], [3, 2], [4, 2], [4, 3], [5, 3], [6, 3]],
      [[0, 3], [1, 3], [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [5, 5], [6, 5]],
    ],
  },
  {
    name: 'Crescent Harbor',
    routes: [
      [[0, 2], [1, 2], [1, 1], [2, 1], [3, 1], [3, 2], [4, 2], [4, 1], [5, 1], [5, 0], [6, 0]],
      [[0, 2], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [4, 2], [5, 2], [5, 3], [6, 3]],
      [[0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [5, 5], [6, 5]],
    ],
  },
];

function cellIndex(x, y) {
  return y * gridWidth + x;
}

function direction([x, y], [toX, toY]) {
  return steps.findIndex(([dx, dy]) => dx === toX - x && dy === toY - y);
}

function makeTrackMap(routes) {
  const connections = new Map();
  for (const route of routes) {
    for (let offset = 1; offset < route.length - 1; offset++) {
      const here = route[offset];
      const cell = cellIndex(...here);
      const pair = [direction(here, route[offset - 1]), direction(here, route[offset + 1])].sort();
      const known = connections.get(cell) || [];
      if (!known.some(item => item[0] === pair[0] && item[1] === pair[1])) known.push(pair);
      connections.set(cell, known);
    }
  }
  return new Map([...connections].map(([cell, choices]) => {
    const [first, second] = choices[0];
    const options = choices.length > 1 ? switchTracks
      : second - first === 2 ? straightTracks : curvedTracks;
    return [cell, { options, turn: (cell * 7 + Math.floor(cell / gridWidth) + 2) % options.length }];
  }));
}

function traceTrain(start, docks, tracks) {
  const seen = new Set();
  const path = [];
  let [x, y] = start;
  let exit = 1;

  while (true) {
    const [dx, dy] = steps[exit];
    x += dx;
    y += dy;
    const entry = (exit + 2) % 4;
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
      return { path, note: 'The train reached the edge without a dock.' };
    }
    const cell = cellIndex(x, y);
    if (seen.has(cell)) return { path, note: 'The track sends the train in a loop.' };
    seen.add(cell);
    path.push(cell);
    const dock = docks.get(cell);
    if (dock !== undefined && entry === 3) return { path, dock };
    const track = tracks.get(cell);
    const pair = track?.options[track.turn];
    if (!pair?.includes(entry)) {
      return { path, note: `Route breaks at row ${y + 1}, column ${x + 1}.` };
    }
    exit = pair[0] === entry ? pair[1] : pair[0];
  }
}

export function createHarborDispatch() {
  let stage = 0;
  let yard, tracks, docks, start, cursor, dispatched, attempts, note, lastPath, traceColor;

  function reset() {
    yard = schedules[stage];
    tracks = makeTrackMap(yard.routes);
    docks = new Map(yard.routes.map((route, index) => [cellIndex(...route.at(-1)), index]));
    start = yard.routes[0][0];
    cursor = [1, start[1]];
    dispatched = attempts = 0;
    note = 'Route the next cargo to its matching dock.';
    lastPath = [];
    traceColor = mint;
  }

  function rotate() {
    const track = tracks.get(cellIndex(...cursor));
    if (!track) {
      note = 'Choose a track tile to change its connection.';
      return;
    }
    track.turn = (track.turn + 1) % track.options.length;
    lastPath = [];
    note = 'Connection switched.';
  }

  function send() {
    if (dispatched === yard.routes.length) return;
    attempts++;
    const { path, dock, note: failure } = traceTrain(start, docks, tracks);
    lastPath = path;
    if (dock !== dispatched) {
      traceColor = pink;
      note = failure || `The train reached dock ${dockLetters[dock]}. This cargo needs dock ${dockLetters[dispatched]}.`;
      return;
    }
    traceColor = cargoColors[dispatched];
    note = `Cargo delivered to dock ${dockLetters[dispatched]}.`;
    dispatched++;
  }

  function drawTrack(c, tile, x, y) {
    const [a, b] = tile.options[tile.turn];
    const cx = x + tileSize / 2;
    const cy = y + tileSize / 2;
    const ends = steps.map(([dx, dy]) => [cx + dx * tileSize / 2, cy + dy * tileSize / 2]);
    const points = [ends[a], [cx, cy], ends[b]];
    lines(c, points, '#405462', 11);
    lines(c, points, '#b1c6ce', 4);
    if (tile.options.length === switchTracks.length) {
      circle(c, cx, cy, 7, gold);
      circle(c, cx, cy, 3, navy);
    }
  }

  reset();
  return {
    title: 'Harbor Dispatch',
    instructions: 'Link the loading shed to each dock in order. Tap a track to switch it, or use arrows and Space. Press Enter or Dispatch to test a route.',
    controls: [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right'], ['Switch track', 'rotate'], ['Dispatch', 'dispatch']],
    spaceAction: 'rotate',
    enterAction: 'dispatch',
    announceHud: true,
    resetLabel: 'Reset yard',
    nextLabel: 'Next yard',
    input(key) {
      const movement = Object.hasOwn(coordinates, key) && coordinates[key];
      if (movement) {
        const [dx, dy] = movement;
        cursor = [
          Math.min(gridWidth - 1, Math.max(0, cursor[0] + dx)),
          Math.min(gridHeight - 1, Math.max(0, cursor[1] + dy)),
        ];
      } else if (key === 'rotate') rotate();
      else if (key === 'dispatch') send();
    },
    point(x, y) {
      const column = Math.floor((x - boardX) / tileSize);
      const row = Math.floor((y - boardY) / tileSize);
      if (column < 0 || column >= gridWidth || row < 0 || row >= gridHeight) return;
      cursor = [column, row];
      if (tracks.has(cellIndex(column, row))) rotate();
    },
    draw(c) {
      rectangle(c, 0, 0, width, height, navy);
      label(c, yard.name.toUpperCase(), 28, 37, 20, gold);
      label(c, 'YARD ' + (stage + 1) + ' / ' + schedules.length, 772, 37, 16, muted, 'right');
      label(c, 'NEXT CARGO', 28, 99, 14, muted);
      label(c, dispatched < yard.routes.length ? 'DOCK ' + dockLetters[dispatched] : 'ALL DOCKS', 28, 129, 22,
        cargoColors[dispatched] || mint);
      for (let index = 0; index < yard.routes.length; index++) {
        circle(c, 38, 171 + index * 40, 12, index < dispatched ? mint : line);
        label(c, dockLetters[index], 38, 176 + index * 40, 13, navy, 'center');
        label(c, index < dispatched ? 'Delivered' : 'Waiting', 62, 177 + index * 40, 14, muted);
      }
      label(c, 'DISPATCHES', 670, 105, 13, muted);
      label(c, attempts, 670, 134, 24, light);

      for (let row = 0; row < gridHeight; row++) {
        for (let column = 0; column < gridWidth; column++) {
          const x = boardX + column * tileSize;
          const y = boardY + row * tileSize;
          const cell = cellIndex(column, row);
          const track = tracks.get(cell);
          const dock = docks.get(cell);
          const cx = x + tileSize / 2;
          const cy = y + tileSize / 2;
          rectangle(c, x + 1, y + 1, tileSize - 2, tileSize - 2, track ? line : water);
          if (lastPath.includes(cell)) rectangle(c, x + 3, y + 3, tileSize - 6, tileSize - 6, traceColor);
          if (track) drawTrack(c, track, x, y);
          if (column === start[0] && row === start[1]) {
            rectangle(c, x + 3, y + 10, tileSize - 7, 34, gold);
            label(c, 'LOAD', cx, cy + 4, 12, navy, 'center');
          }
          if (dock !== undefined) {
            circle(c, cx, cy, 19, cargoColors[dock]);
            label(c, dockLetters[dock], cx, cy + 6, 15, navy, 'center');
          }
        }
      }
      c.strokeStyle = light;
      c.lineWidth = 2;
      c.strokeRect(boardX + cursor[0] * tileSize + 3, boardY + cursor[1] * tileSize + 3, tileSize - 6, tileSize - 6);
      label(c, note, width / 2, 421, 16, muted, 'center');
    },
    hud() {
      const cell = cellIndex(...cursor);
      const track = tracks.get(cell);
      const connection = track
        ? track.options[track.turn].map(port => portNames[port]).join(' to ')
        : docks.has(cell) ? 'Dock ' + dockLetters[docks.get(cell)] : 'No switchable track';
      return `${yard.name} · ${dispatched}/${yard.routes.length} delivered · Row ${cursor[1] + 1}, column ${cursor[0] + 1}: ${connection} · ${note}`;
    },
    done: () => dispatched === yard.routes.length,
    message: () => stage === schedules.length - 1 ? 'All three yards cleared!' : 'Yard cleared!',
    reset,
    canNext: () => dispatched === yard.routes.length && stage < schedules.length - 1,
    next() {
      if (this.canNext()) {
        stage++;
        reset();
      }
    },
  };
}

const bays = [
  {
    name: 'Beacon Bay',
    fuel: 60,
    crew: [[288, 291], [552, 209], [666, 94]],
    rocks: [[381, 255, 29], [483, 130, 36], [649, 318, 30]],
  },
  {
    name: 'Drift Channel',
    fuel: 70,
    crew: [[215, 121], [404, 82], [643, 105], [671, 317]],
    rocks: [[306, 194, 38], [427, 190, 46], [550, 238, 43], [577, 100, 34]],
  },
  {
    name: 'Outer Shoals',
    fuel: 78,
    crew: [[145, 116], [332, 140], [570, 92], [658, 231], [495, 328]],
    rocks: [[228, 253, 43], [296, 85, 33], [395, 225, 52], [517, 189, 34], [681, 134, 44], [564, 302, 32]],
  },
];
const pier = { x: 98, y: 349 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createTidalRescue() {
  let stage = 0;
  let bay, x, y, vx, vy, facing, crew, elapsed, fuel, hull, impact, finished, successful;

  function reset() {
    bay = bays[stage];
    ({ x, y } = pier);
    vx = vy = elapsed = impact = 0;
    fuel = bay.fuel;
    hull = 3;
    facing = -Math.PI / 2;
    finished = successful = false;
    crew = bay.crew.map(([cx, cy]) => ({ x: cx, y: cy, pickedUp: false }));
  }

  function onPier() {
    return Math.abs(x - pier.x) < 29 && Math.abs(y - pier.y) < 26;
  }

  function brake() {
    vx *= .15;
    vy *= .15;
  }

  function drift(px, py) {
    return [
      Math.sin(py / 65 + stage * .7) * (38 + stage * 18),
      Math.cos(px / 87 - stage * .4) * (32 + stage * 19),
    ];
  }

  function checkCollision() {
    for (const [rx, ry, r] of bay.rocks) {
      const dx = x - rx;
      const dy = y - ry;
      const distance = Math.hypot(dx, dy);
      const clear = r + 13;
      if (distance >= clear) continue;
      const nx = distance ? dx / distance : 1;
      const ny = distance ? dy / distance : 0;
      x = rx + nx * clear;
      y = ry + ny * clear;
      const approach = Math.min(0, vx * nx + vy * ny);
      vx -= approach * nx * 1.56;
      vy -= approach * ny * 1.56;
      if (impact === 0) {
        hull--;
        impact = .85;
      }
    }
  }

  function update(dt, held) {
    elapsed += dt;
    fuel = Math.max(0, bay.fuel - elapsed);
    impact = Math.max(0, impact - dt);

    const forceX = Number(held.has('right')) - Number(held.has('left'));
    const forceY = Number(held.has('down')) - Number(held.has('up'));
    const force = Math.max(1, Math.hypot(forceX, forceY));
    const [currentX, currentY] = onPier() ? [0, 0] : drift(x, y);
    const thrust = 435 / force;
    const damping = Math.exp(-(held.has('brake') ? 8 : 1.85) * dt);
    vx = (vx + (forceX * thrust + currentX) * dt) * damping;
    vy = (vy + (forceY * thrust + currentY) * dt) * damping;
    x = clamp(x + vx * dt, 43, 757);
    y = clamp(y + vy * dt, 68, 394);
    const speed = Math.hypot(vx, vy);
    if (forceX || forceY) facing = Math.atan2(forceY, forceX);
    else if (speed > 28) facing = Math.atan2(vy, vx);

    checkCollision();
    for (const person of crew) {
      if (!person.pickedUp && Math.hypot(person.x - x, person.y - y) < 26) person.pickedUp = true;
    }
    successful = crew.every(person => person.pickedUp) && onPier() && speed < 95 && hull > 0;
    finished = successful || fuel === 0 || hull === 0;
  }

  function drawDock(c) {
    rectangle(c, pier.x - 40, pier.y - 38, 81, 76, '#4d5d58');
    rectangle(c, pier.x - 34, pier.y - 32, 69, 64, water);
    for (let xOff = -40; xOff <= 40; xOff += 12) {
      rectangle(c, pier.x + xOff, pier.y - 38, 6, 9, gold);
      rectangle(c, pier.x + xOff, pier.y + 29, 6, 9, gold);
    }
    label(c, 'DOCK', pier.x, pier.y + 7, 14, gold, 'center');
  }

  function drawBoat(c) {
    c.save();
    c.translate(x, y);
    c.rotate(facing);
    c.beginPath();
    c.moveTo(17, 0);
    c.lineTo(4, -10);
    c.lineTo(-14, -8);
    c.lineTo(-14, 8);
    c.lineTo(4, 10);
    c.closePath();
    c.fillStyle = impact > .45 ? pink : light;
    c.fill();
    rectangle(c, -2, -5, 9, 10, '#456f81');
    rectangle(c, -12, -4, 3, 8, '#578a93');
    c.restore();
  }

  reset();
  return {
    title: 'Tidal Rescue',
    instructions: 'Steer with arrows, WASD, or the direction buttons. Pass close to each buoy, then return to the dock. Press Space or Brake to slow down. Avoid rocks and watch your fuel.',
    controls: [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right'], ['Brake', 'brake']],
    spaceAction: 'brake',
    resetLabel: 'Restart bay',
    nextLabel: 'Next bay',
    input(key) {
      if (key === 'brake') {
        brake();
      } else if (Object.hasOwn(coordinates, key)) {
        const [dx, dy] = coordinates[key];
        vx = clamp(vx + dx * 88, -280, 280);
        vy = clamp(vy + dy * 88, -280, 280);
      }
    },
    update,
    draw(c) {
      rectangle(c, 0, 0, width, height, navy);
      rectangle(c, 28, 54, 744, 354, water);
      for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 16; column++) {
          const px = 37 + ((column * 47 + (row % 2) * 23 + elapsed * 7) % 723);
          const py = 71 + row * 44 + Math.sin(elapsed * 1.5 + column * .4) * 3;
          const [dx, dy] = drift(px, py);
          lines(c, [[px, py], [px + dx * .31, py + dy * .13]], '#284a60', 2);
        }
      }
      drawDock(c);
      for (const [rx, ry, r] of bay.rocks) {
        circle(c, rx, ry + 3, r + 2, '#0d2635');
        circle(c, rx, ry, r, '#4e586c');
        circle(c, rx - r * .17, ry - r * .19, r * .66, '#798396');
        lines(c, [[rx - r * .35, ry + r * .26], [rx + r * .09, ry + r * .1], [rx + r * .24, ry - r * .28]], '#4e586c', 4);
      }
      crew.forEach((person, index) => {
        if (person.pickedUp) return;
        const { x: cx, y: cy } = person;
        circle(c, cx, cy, 16 + (Math.sin(elapsed * 2 + index) + 1) * 2, '#356d82');
        circle(c, cx, cy, 11, gold);
        circle(c, cx, cy, 5.5, navy);
        label(c, index + 1, cx, cy - 22, 13, light, 'center');
      });
      drawBoat(c);
      label(c, bay.name.toUpperCase(), 29, 38, 18, gold);
      label(c, 'HULL ' + hull + ' / 3', 772, 38, 16, hull === 1 ? pink : mint, 'right');
      label(c, 'FUEL', 27, 432, 13, muted);
      rectangle(c, 72, 420, 146, 12, '#314255');
      rectangle(c, 72, 420, fuel / bay.fuel * 146, 12, fuel < 15 ? pink : gold);
      const rescued = crew.filter(person => person.pickedUp).length;
      label(c, rescued === crew.length ? 'Return to the dock and brake' : 'Crew rescued ' + rescued + ' / ' + crew.length,
        772, 432, 16, light, 'right');
    },
    hud() {
      const rescued = crew.filter(person => person.pickedUp).length;
      return `${bay.name} · Crew ${rescued}/${crew.length} · Hull ${hull}/3 · Fuel ${Math.ceil(fuel)}s` +
        (rescued === crew.length ? ' · Return to dock and brake' : '');
    },
    done: () => finished,
    message: () => successful ? (stage === bays.length - 1 ? 'All three bays cleared!' : 'Crew safely returned!')
      : hull ? 'Fuel depleted' : 'Hull damaged',
    reset,
    canNext: () => successful && stage < bays.length - 1,
    next() {
      if (this.canNext()) {
        stage++;
        reset();
      }
    },
  };
}
