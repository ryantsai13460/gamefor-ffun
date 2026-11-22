import { createBeatBeacon, createCometCourier, createPinpointPutt } from "./bonus-arcade.js";
import { createHarborDispatch, createTidalRescue } from "./harbor-games.js";
import { createKiteBreeze, createPicnicPack } from "./family-games.js";
import { createCloverRoll } from "./clover-roll.js";
import { createClockCourier, createFractionKitchen } from "./learning-games.js";

const storageKey = "ffun-original-games-v1";
const directions = {
  arrowleft: "left", a: "left",
  arrowright: "right", d: "right",
  arrowup: "up", w: "up",
  arrowdown: "down", s: "down"
};
const arrowControls = [
  ["←", "left"], ["↑", "up"], ["↓", "down"], ["→", "right"]
];
const directionNames = { left: "Left", right: "Right", up: "Up", down: "Down" };
const gridOffsets = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, action, className = "local-game__button") {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function makeBoard(surface, columns) {
  const board = element("div", "local-game__board");
  board.style.setProperty("--columns", columns);
  surface.append(board);
  return board;
}

function preferDirection(event, spaceIsUp = false) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (spaceIsUp && event.key === " " && !event.target.closest("button")) return "up";
  return directions[event.key.toLowerCase()];
}

function enableGridNavigation(root, board, tiles, columns, signal) {
  let focusIndex = 0;
  tiles.forEach((tile, index) => { tile.tabIndex = index ? -1 : 0; });
  board.addEventListener("focusin", event => {
    const index = tiles.indexOf(event.target);
    if (index < 0 || index === focusIndex) return;
    tiles[focusIndex].tabIndex = -1;
    tiles[index].tabIndex = 0;
    focusIndex = index;
  }, { signal });
  root.addEventListener("keydown", event => {
    if (event.target !== root && !board.contains(event.target)) return;
    const direction = preferDirection(event);
    if (!Object.hasOwn(gridOffsets, direction)) return;
    event.preventDefault();
    if (event.target === root) {
      tiles[focusIndex].focus({ preventScroll: true });
      return;
    }
    const [vertical, horizontal] = gridOffsets[direction];
    const row = Math.floor(focusIndex / columns) + vertical;
    const column = focusIndex % columns + horizontal;
    if (row >= 0 && column >= 0 && column < columns) {
      tiles[row * columns + column]?.focus({ preventScroll: true });
    }
  }, { signal });
}

function terraceWorkshop({ root, surface, controls, status, signal }) {
  const columns = 7;
  const gate = 14;
  const spring = 20;
  const rocks = new Set([9, 11, 17, 31, 33]);
  const materials = {
    soil: ["Bare soil", ""], path: ["Boardwalk", "▬"], flower: ["Flower bed", "✿"],
    gate: ["Garden gate", "▣"], spring: ["Spring", "≈"], rock: ["Boulder", "◆"]
  };
  const cells = Array.from({ length: 42 }, (_, slot) => {
    if (slot === gate) return "gate";
    if (slot === spring) return "spring";
    return rocks.has(slot) ? "rock" : "soil";
  });
  const board = makeBoard(surface, columns);
  board.classList.add("terrace-board");
  board.setAttribute("role", "group");
  board.setAttribute("aria-label", "Terrace garden");
  const tools = element("div", "local-game__controls terrace-materials");
  tools.setAttribute("role", "group");
  tools.setAttribute("aria-label", "Building materials");
  let brush = "path";
  let lastEdit;

  function adjacent(slot) {
    const column = slot % columns;
    const neighbors = [slot - columns, slot + columns];
    if (column > 0) neighbors.push(slot - 1);
    if (column < columns - 1) neighbors.push(slot + 1);
    return neighbors.filter(index => index >= 0 && index < cells.length);
  }

  const tiles = cells.map((_, slot) => {
    const fixed = slot === gate || slot === spring || rocks.has(slot);
    const tile = button('', () => {
      if (fixed || cells[slot] === brush) return;
      lastEdit = { slot, material: cells[slot] };
      cells[slot] = brush;
      draw();
    }, 'local-game__tile');
    if (fixed) tile.setAttribute('aria-disabled', 'true');
    return tile;
  });

  const choices = new Map(Object.entries({ path: 'Boardwalk', flower: 'Flower bed', soil: 'Eraser' })
    .map(([material, label]) => [material, button(label, () => {
      brush = material;
      draw();
    })]));
  const undo = button('Undo edit', () => {
    if (!lastEdit) return;
    cells[lastEdit.slot] = lastEdit.material;
    lastEdit = undefined;
    draw();
  });
  tools.append(...choices.values());
  controls.append(tools, undo);
  board.append(...tiles);
  enableGridNavigation(root, board, tiles, columns, signal);

  function draw() {
    const connected = new Set([gate]);
    for (const slot of connected) {
      for (const neighbor of adjacent(slot)) {
        if (cells[neighbor] === 'path' || neighbor === spring) connected.add(neighbor);
      }
    }
    const planted = cells.filter((material, slot) => material === 'flower' && adjacent(slot)
      .some(neighbor => cells[neighbor] === 'path' && connected.has(neighbor))).length;
    for (const [slot, tile] of tiles.entries()) {
      const material = cells[slot];
      const [name, symbol] = materials[material];
      tile.dataset.material = material;
      tile.classList.toggle('connected-path', material === 'path' && connected.has(slot));
      tile.textContent = symbol;
      tile.setAttribute('aria-label', `Row ${Math.floor(slot / columns) + 1}, column ${slot % columns + 1}, ${name}`);
    }
    for (const [material, choice] of choices) choice.setAttribute('aria-pressed', String(material === brush));
    undo.disabled = !lastEdit;
    const complete = connected.has(spring) && planted >= 4;
    status.textContent = complete ? 'Garden complete! Keep building or try a new layout.'
      : `${connected.has(spring) ? 'Spring connected' : 'Connect the gate to the spring'} · ${Math.min(planted, 4)} of 4 flower beds beside the boardwalk`;
  }

  draw();
}

function ticTacToe({ root, surface, status, signal }) {
  const board = makeBoard(surface, 3);
  const cells = Array(9).fill("");
  let turn = "X";
  let finished = false;
  const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
  ];

  status.textContent = "X goes first.";
  const tiles = cells.map((_, slot) => {
    const location = "Row " + (Math.floor(slot / 3) + 1) + ", column " + (slot % 3 + 1);
    const cell = button("", () => {
      if (finished || cells[slot]) return;
      cells[slot] = turn;
      cell.textContent = turn;
      cell.setAttribute("aria-label", location + ": " + turn);
      cell.setAttribute("aria-disabled", "true");

      if (wins.some(line => line.every(index => cells[index] === turn))) {
        status.textContent = turn + " wins!";
        finished = true;
      } else if (cells.every(Boolean)) {
        status.textContent = "It's a draw!";
        finished = true;
      } else {
        turn = turn === "X" ? "O" : "X";
        status.textContent = turn + "'s turn.";
      }
      if (finished) tiles.forEach(tile => { tile.setAttribute("aria-disabled", "true"); });
    }, "local-game__tile");
    cell.setAttribute("aria-label", location + ": empty");
    return cell;
  });
  board.append(...tiles);
  enableGridNavigation(root, board, tiles, 3, signal);
}

function game2048({ root, surface, controls, status, signal }) {
  const board = makeBoard(surface, 4);
  const cells = Array(16).fill(0);
  let score = 0;

  function addTile() {
    const free = cells.flatMap((value, index) => value ? [] : [index]);
    if (free.length) {
      cells[free[Math.floor(Math.random() * free.length)]] = Math.random() < .9 ? 2 : 4;
    }
  }

  function draw() {
    board.replaceChildren();
    cells.forEach(value => {
      const tile = element("span", "local-game__tile", value || "");
      if (value) {
        tile.dataset.value = value <= 4 ? "low" : value <= 16 ? "mid" : value <= 64 ? "high" : "top";
      }
      board.append(tile);
    });

    const canMove = cells.some((value, index) => value === 0 ||
      (index % 4 < 3 && value === cells[index + 1]) || value === cells[index + 4]);
    const result = canMove ? (cells.some(value => value >= 2048) ? " · 2048 reached!" : "") : " · No moves left";
    status.textContent = "Score: " + score + result;
  }

  function move(direction) {
    const before = cells.join(",");
    for (let row = 0; row < 4; row++) {
      const positions = Array.from({ length: 4 }, (_, index) =>
        direction === "left" ? row * 4 + index :
        direction === "right" ? row * 4 + 3 - index :
        direction === "up" ? index * 4 + row :
        (3 - index) * 4 + row
      );
      const line = positions.map(index => cells[index]).filter(Boolean);
      for (let index = 0; index < line.length - 1; index++) {
        if (line[index] === line[index + 1]) {
          line[index] *= 2;
          score += line[index];
          line.splice(index + 1, 1);
        }
      }
      positions.forEach((position, index) => { cells[position] = line[index] || 0; });
    }
    if (before !== cells.join(",")) {
      addTile();
      draw();
    }
  }

  root.addEventListener("keydown", event => {
    const direction = preferDirection(event);
    if (!direction) return;
    event.preventDefault();
    move(direction);
  }, { signal });

  arrowControls.forEach(([label, key]) => {
    const control = button(label, () => move(key));
    control.setAttribute("aria-label", directionNames[key]);
    controls.append(control);
  });
  addTile();
  addTile();
  draw();
}

function reactionGame({ surface, status }) {
  let start = 0;
  let complete = false;
  const target = button("Wait for green…", () => {
    if (complete) return;
    complete = true;
    clearTimeout(timer);
    const elapsed = start ? Math.round(performance.now() - start) + " ms" : "Too early!";
    target.textContent = elapsed;
    target.setAttribute("aria-disabled", "true");
    status.textContent = elapsed + " Select Restart to try again.";
  }, "local-game__reaction");
  surface.append(target);
  status.textContent = "Wait for the signal.";
  const timer = setTimeout(() => {
    start = performance.now();
    target.classList.add("is-ready");
    target.textContent = "Click now!";
    status.textContent = "Click now!";
  }, 1200 + Math.random() * 2500);
  return () => clearTimeout(timer);
}

function switchboard({ surface, status }) {
  const board = element("div", "local-game__switches");
  surface.append(board);
  const lights = [true, true, false, true, true];
  let moves = 0;
  const tiles = lights.map((_, index) => button("", () => {
    [index, (index + 4) % 5, (index + 1) % 5].forEach(slot => { lights[slot] = !lights[slot]; });
    moves++;
    draw();
  }, "local-game__tile"));

  function draw() {
    tiles.forEach((tile, index) => {
      tile.textContent = "ABCDE"[index] + " " + (lights[index] ? "On" : "Off");
      tile.setAttribute("aria-pressed", lights[index]);
    });
    status.textContent = lights.every(Boolean)
      ? "All lights on! " + moves + (moves === 1 ? " move." : " moves.")
      : "Turn on all five lights.";
  }
  board.append(...tiles);
  draw();
}

function pixelLogic({ root, surface, status, signal }) {
  const board = makeBoard(surface, 5);
  const pattern = ["00100", "01110", "11111", "01110", "10101"];
  const puzzle = pattern.join("");
  const filled = Array(25).fill(false);

  const tiles = filled.map((_, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const tile = button("", () => {
      filled[index] = !filled[index];
      tile.setAttribute("aria-pressed", filled[index]);
      status.textContent = filled.every((value, slot) => Number(value) === Number(puzzle[slot]))
        ? "Picture complete!"
        : "Fill in the picture using the clues.";
    }, "local-game__tile");
    tile.setAttribute("aria-label", "Row " + (row + 1) + ", column " + (column + 1));
    tile.setAttribute("aria-pressed", "false");
    return tile;
  });
  board.append(...tiles);
  enableGridNavigation(root, board, tiles, 5, signal);

  const clue = element("details", "local-game__clue");
  const summary = element("summary", "", "Show clues");
  const rows = pattern.map(row => [...row].map(value => value === "1" ? "■" : "·").join(" "));
  const target = element("pre", "", rows.join("\n"));
  target.setAttribute("aria-label", "Filled positions by row: 3. 2 through 4. All five. 2 through 4. 1, 3 and 5.");
  clue.append(summary, target);
  surface.append(clue);
  status.textContent = "Fill in the picture using the clues.";
}

function memoryMatch({ root, surface, status, signal }) {
  const board = makeBoard(surface, 4);
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let slot = values.length - 1; slot > 0; slot--) {
    const other = Math.floor(Math.random() * (slot + 1));
    [values[slot], values[other]] = [values[other], values[slot]];
  }
  const matched = new Set();
  let flipped = [];
  let timer;

  const tiles = values.map((_, slot) => button("?", () => flip(slot), "local-game__tile"));

  function draw() {
    tiles.forEach((tile, slot) => {
      const found = matched.has(slot);
      const faceUp = flipped.includes(slot);
      tile.textContent = found || faceUp ? values[slot] : "?";
      tile.setAttribute("aria-disabled", String(found || faceUp || flipped.length === 2));
      tile.classList.toggle("is-matched", found);
      const face = found ? "matched " + values[slot] : faceUp ? values[slot] : "face down";
      tile.setAttribute("aria-label", "Card " + (slot + 1) + ": " + face);
    });
    status.textContent = matched.size === 16
      ? "All pairs found!"
      : matched.size / 2 + " / 8 pairs";
  }

  function flip(slot) {
    if (matched.has(slot) || flipped.includes(slot) || flipped.length === 2) return;
    flipped.push(slot);
    if (flipped.length === 2) {
      const [first, second] = flipped;
      if (values[first] === values[second]) {
        matched.add(first);
        matched.add(second);
        flipped = [];
      } else {
        timer = setTimeout(() => {
          flipped = [];
          draw();
        }, 700);
      }
    }
    draw();
  }

  board.append(...tiles);
  enableGridNavigation(root, board, tiles, 4, signal);
  draw();
  return () => clearTimeout(timer);
}

function patternPulse({ root, surface, controls, status, signal }) {
  const rounds = 6;
  const counter = element("p", "local-game__puzzle-meta");
  surface.append(counter);

  const board = makeBoard(surface, 2);
  board.classList.add("local-game__pulse-board");
  const pads = Array.from({ length: 4 }, (_, index) => button(
    String(index + 1), () => respond(index), "local-game__tile local-game__pulse-pad"
  ));
  board.append(...pads);

  let round = 0;
  let sequence = [];
  let cursor = 0;
  let phase = "ready";
  let timer;

  const action = button("Start", () => {
    if (phase === "finished") {
      round = 0;
      sequence = [];
      phase = "ready";
    }
    if (phase === "ready") {
      round++;
      while (sequence.length < round + 2) sequence.push(Math.floor(Math.random() * pads.length));
    }
    showPattern();
  }, "local-game__button local-game__button--primary");
  controls.append(action);

  const labels = {
    ready: "Next round", watching: "Watch the pattern", input: "Replay pattern",
    retry: "Try this round again", finished: "Play again"
  };

  function updateControls() {
    counter.textContent = "Round " + Math.max(round, 1) + " of " + rounds;
    action.textContent = round === 0 ? "Start" : labels[phase];
    action.disabled = phase === "watching";
    pads.forEach(pad => { pad.disabled = phase !== "input"; });
  }

  function showPattern() {
    root.focus({ preventScroll: true });
    phase = "watching";
    status.textContent = "Watch the signals.";
    updateControls();
    let next = 0;

    function playSignal() {
      if (next === sequence.length) {
        cursor = 0;
        phase = "input";
        status.textContent = "Your turn · 0 of " + sequence.length;
        updateControls();
        return;
      }

      const index = sequence[next++];
      const pad = pads[index];
      pad.classList.add("is-lit");
      status.textContent = "Signal " + (index + 1);
      timer = setTimeout(() => {
        pad.classList.remove("is-lit");
        status.textContent = "Watch the signals.";
        timer = setTimeout(playSignal, 260);
      }, 680);
    }
    timer = setTimeout(playSignal, 350);
  }

  function respond(index) {
    if (phase !== "input") return;
    if (index !== sequence[cursor]) {
      phase = "retry";
      status.textContent = "Wrong signal. Replay the pattern and try again.";
    } else {
      cursor++;
      if (cursor < sequence.length) {
        status.textContent = "Your turn · " + cursor + " of " + sequence.length;
        return;
      }
      phase = round === rounds ? "finished" : "ready";
      status.textContent = round === rounds ? "All six rounds cleared!" : "Pattern matched!";
    }
    updateControls();
    action.focus({ preventScroll: true });
  }

  root.addEventListener("keydown", event => {
    if (phase !== "input" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[1-4]$/.test(event.key)) return;
    event.preventDefault();
    respond(Number(event.key) - 1);
  }, { signal });
  status.textContent = "Ready to play.";
  updateControls();
  return () => clearTimeout(timer);
}

const trailBoards = [
  { target: 13, values: [3, 9, 8, 3, 4, 1, 9, 6, 6, 9, 2, 9, 2, 7, 6, 8] },
  { target: 25, values: [1, 7, 3, 7, 9, 1, 4, 2, 5, 7, 5, 3, 6, 8, 3, 4] },
  { target: 27, values: [9, 4, 9, 7, 6, 5, 3, 6, 4, 7, 1, 2, 7, 5, 6, 1] },
  { target: 12, values: [7, 1, 2, 4, 3, 6, 7, 6, 6, 5, 9, 2, 4, 6, 8, 4] }
];

function sumTrail({ root, surface, controls, status, signal }) {
  const size = 4;
  const roundSize = 4;
  const summary = element("p", "local-game__puzzle-meta");
  surface.append(summary);

  const board = makeBoard(surface, size);
  board.classList.add("local-game__trail-board");
  const path = [];
  let round = 0;
  let solved = false;
  const tiles = trailBoards[round].values.map((_, index) => {
    const tile = button("", () => choose(index), "local-game__tile local-game__trail-cell");
    tile.dataset.trailCell = index;
    return tile;
  });
  board.append(...tiles);

  const undo = button("Undo", event => {
    path.pop();
    draw();
    if (undo.disabled && !event.detail) root.focus({ preventScroll: true });
  });
  const reset = button("Clear trail", event => {
    resetTrail();
    if (!event.detail) root.focus({ preventScroll: true });
  });
  const next = button("Next puzzle", () => {
    round = (round + 1) % trailBoards.length;
    resetTrail();
    tiles[0].focus({ preventScroll: true });
  }, "local-game__button local-game__button--primary");
  controls.append(undo, reset, next);

  function row(index) {
    return Math.floor(index / size);
  }

  function column(index) {
    return index % size;
  }

  function choose(index) {
    if (solved) return;
    if (path.includes(index)) {
      status.textContent = "That tile is already on your trail.";
      return;
    }
    if (path.length === roundSize) {
      status.textContent = "Four tiles selected. Undo a step to try a different route.";
      return;
    }
    const last = path.at(-1);
    if (last !== undefined && Math.abs(row(last) - row(index)) + Math.abs(column(last) - column(index)) !== 1) {
      status.textContent = "Choose a tile directly beside the end of the trail.";
      return;
    }
    path.push(index);
    draw();
  }

  function resetTrail() {
    path.length = 0;
    draw();
  }

  function draw() {
    const { target, values } = trailBoards[round];
    const total = path.reduce((sum, index) => sum + values[index], 0);
    const filled = path.length === roundSize;
    solved = filled && total === target;
    summary.textContent = "Puzzle " + (round + 1) + " of " + trailBoards.length + " · Target " + target + " · Sum " + total;
    tiles.forEach((tile, index) => {
      const step = path.indexOf(index) + 1;
      tile.textContent = values[index];
      tile.setAttribute("aria-pressed", step > 0);
      tile.setAttribute("aria-label", "Row " + (row(index) + 1) + ", column " + (column(index) + 1) + ": " +
        values[index] + (step ? ", step " + step : ""));
      if (step) tile.dataset.step = step;
      else delete tile.dataset.step;
    });
    if (solved) {
      status.textContent = round === trailBoards.length - 1 ? "All four puzzles solved!" : "Trail complete!";
    } else if (filled) {
      status.textContent = "The sum is " + total + ". Undo a step and try another route.";
    } else {
      status.textContent = path.length ? path.length + " of " + roundSize + " tiles selected." : "Choose a starting tile.";
    }
    undo.disabled = reset.disabled = solved || !path.length;
    next.hidden = !solved;
    next.textContent = round === trailBoards.length - 1 ? "Play again" : "Next puzzle";
  }

  enableGridNavigation(root, board, tiles, size, signal);
  draw();
}

const classicGames = {
  snake: {
    title: "Snake",
    instructions: "Use the arrow keys, WASD, or the controls below. Eat the food and avoid your tail.",
    controls: arrowControls
  },
  pong: {
    title: "Pong",
    instructions: "Use W/S, Up/Down, or the controls below to move the left paddle. First to seven wins.",
    controls: [["↑", "up"], ["↓", "down"]]
  },
  breakout: {
    title: "Breakout",
    instructions: "Use A/D, Left/Right, or the controls below to move the paddle. Break all the bricks before you lose three balls.",
    controls: [["←", "left"], ["→", "right"]]
  },
  catch: {
    title: "Catch the Stars",
    instructions: "Use A/D, Left/Right, or the controls below to move the catcher. Catch the falling stars.",
    controls: [["←", "left"], ["→", "right"]]
  }
};

function classicArcade(id) {
  let over = false;
  let score = 0;
  let lives = 3;

  let playerX = 320;
  let playerY = 380;
  let ballX = 350;
  let ballY = 240;
  let ballVX = 220;
  let ballVY = -260;

  let snake = [
    {x:6,y:8},{x:5,y:8},{x:4,y:8}
  ];

  let direction = {x:1,y:0};
  let nextDirection = null;
  let food = {x:15,y:8};
  let snakeTimer = 0;

  let falling = [];
  let spawnTimer = 0;

  const bricks = [];

  for (let row = 0;row < 5;row++) {
    for (let col = 0;col < 9;col++) {
      bricks.push({
        x:30+col*74,
        y:40+row*26,
        w:66,
        h:18,
        color:["#ada1d5","#8fbed5","#dbaa81",
               "#bed493","#dca7c0"][row]
      });
    }
  }

  let aiY = 180;
  let computerScore = 0;

  function input(directionName) {
    if (id !== "snake") return;

    const options = {
      up:{x:0,y:-1},
      down:{x:0,y:1},
      left:{x:-1,y:0},
      right:{x:1,y:0}
    };

    const next = options[directionName];
    if (!next || nextDirection) return;

    if (next.x === -direction.x &&
        next.y === -direction.y) return;

    nextDirection = next;
  }

  function movePlayer(dt,keys,speed=400) {
    const horizontal =
      Number(keys.has("right"))-Number(keys.has("left"));

    playerX = Math.max(
      0,Math.min(630,playerX+horizontal*speed*dt)
    );
  }

  function updateSnake(dt) {
    snakeTimer += dt;
    if (snakeTimer < .14) return;
    snakeTimer -= .14;

    if (nextDirection) {
      direction = nextDirection;
      nextDirection = null;
    }

    const head = {
      x:(snake[0].x+direction.x+24)%24,
      y:(snake[0].y+direction.y+16)%16
    };

    const eating = head.x === food.x && head.y === food.y;

    const bodyToCheck = eating ? snake : snake.slice(0,-1);

    if (bodyToCheck.some(p => p.x === head.x && p.y === head.y)) {
      over = true;
      return;
    }

    snake.unshift(head);

    if (eating) {
      score++;

      const free = [];

      for (let y = 0;y < 16;y++) {
        for (let x = 0;x < 24;x++) {
          if (!snake.some(p => p.x === x && p.y === y)) {
            free.push({x,y});
          }
        }
      }

      if (!free.length) {
        over = true;
        return;
      }

      food = free[Math.floor(Math.random()*free.length)];
    } else {
      snake.pop();
    }
  }

  function updateCatch(dt,keys) {
    movePlayer(dt,keys);

    spawnTimer += dt;

    if (spawnTimer > .65) {
      spawnTimer = 0;
      falling.push({
        x:10+Math.random()*680,
        y:-20
      });
    }

    for (const star of falling) {
      star.y += 180*dt;
    }

    falling = falling.filter(star => {
      if (star.y > 430 && star.y < 470 &&
          star.x >= playerX && star.x <= playerX+90) {
        score++;
        return false;
      }

      if (star.y > 480) {
        lives--;
        return false;
      }

      return true;
    });

    if (lives <= 0) over = true;
  }

  function updatePong(dt,keys) {
    const vertical =
      Number(keys.has("down"))-Number(keys.has("up"));

    playerY = Math.max(
      0,Math.min(380,playerY+vertical*420*dt)
    );

    aiY += Math.max(
      -220*dt,
      Math.min(220*dt,ballY-aiY-50)
    );

    aiY = Math.max(0,Math.min(380,aiY));

    ballX += ballVX*dt;
    ballY += ballVY*dt;

    if (ballY < 0 || ballY > 468) ballVY *= -1;

    if (ballX < 42 && ballX > 20 &&
        ballY+12 > playerY && ballY < playerY+100 &&
        ballVX < 0) {
      ballVX = Math.abs(ballVX)*1.04;
      ballVY = (ballY-playerY-50)*4;
    }

    if (ballX > 665 && ballX < 700 &&
        ballY+12 > aiY && ballY < aiY+100 &&
        ballVX > 0) {
      ballVX = -Math.abs(ballVX)*1.04;
      ballVY = (ballY-aiY-50)*4;
    }

    if (ballX < -15 || ballX > 735) {
      if (ballX < 0) computerScore++;
      else score++;

      ballX = 350;
      ballY = 240;
      ballVX = ballVX < 0 ? 230 : -230;
      ballVY = (Math.random()-.5)*250;
    }

    if (score >= 7 || computerScore >= 7) over = true;
  }

  function updateBreakout(dt,keys) {
    movePlayer(dt,keys);

    ballX += ballVX*dt;
    ballY += ballVY*dt;

    if (ballX < 0 || ballX > 708) ballVX *= -1;
    if (ballY < 0) ballVY = Math.abs(ballVY);

    if (ballVY > 0 &&
        ballY+12 >= 448 && ballY < 462 &&
        ballX+12 >= playerX && ballX <= playerX+90) {
      ballVY = -Math.abs(ballVY);
      ballVX = (ballX-playerX-45)*6;
    }

    for (let i = bricks.length-1;i >= 0;i--) {
      const b = bricks[i];

      if (ballX+12 > b.x && ballX < b.x+b.w &&
          ballY+12 > b.y && ballY < b.y+b.h) {
        bricks.splice(i,1);
        ballVY *= -1;
        score += 10;
        break;
      }
    }

    if (ballY > 480) {
      lives--;

      if (lives <= 0) {
        over = true;
      } else {
        ballX = 350;
        ballY = 300;
        ballVX = 220;
        ballVY = -260;
      }
    }

    if (!bricks.length) over = true;
  }

  function draw(ctx) {
    const rectangle = (...args) => rect(ctx, ...args);
    const label = (value, x, y, size = 24) => text(ctx, value, x, y, size, "#f5f5f7", "center");
    rectangle(0,0,720,480,"#11202a");

    if (id === "snake") {
      rectangle(food.x*30+5,food.y*30+5,20,20,"#e4a37a");

      snake.forEach((p,i) => {
        rectangle(
          p.x*30+2,p.y*30+2,26,26,
          i === 0 ? "#c9e9a8" : "#83ae70"
        );
      });
    }

    if (id === "catch") {
      rectangle(playerX,450,90,13,"#c9e9a8");

      falling.forEach(star => {
        label("★",star.x,star.y,27);
      });
    }

    if (id === "pong") {
      for (let y = 0;y < 480;y += 30) {
        rectangle(358,y,4,15,"#3a4b57");
      }

      rectangle(25,playerY,14,100,"#c9e9a8");
      rectangle(681,aiY,14,100,"#9ebedc");
      rectangle(ballX,ballY,12,12,"white");

      label(score+" : "+computerScore,360,65,38);
    }

    if (id === "breakout") {
      bricks.forEach(b => {
        rectangle(b.x,b.y,b.w,b.h,b.color);
      });

      rectangle(playerX,448,90,13,"#c9e9a8");
      rectangle(ballX,ballY,12,12,"white");
    }
  }

  const update = { snake: updateSnake, catch: updateCatch, pong: updatePong, breakout: updateBreakout };

  return {
    ...classicGames[id],
    width: 720,
    height: 480,
    input,
    update: (delta, keys) => update[id](delta, keys),
    draw,
    hud: () => id === "pong" ? "Player " + score + " · Computer " + computerScore : "Score: " + score +
      ((id === "catch" || id === "breakout") ? " · Lives: " + Math.max(0, lives) : ""),
    done: () => over,
    message: () => {
      if (id === "pong") return score >= 7 ? "You win!" : "Computer wins";
      if (id === "breakout" && !bricks.length) return "All bricks cleared!";
      if (id === "snake" && snake.length === 24 * 16) return "Board cleared!";
      return "Game over";
    }
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function text(
  c, s, x, y,
  size = 20,
  color = '#ecedf0',
  align = 'left'
) {
  c.fillStyle = color;
  c.font = `600 ${size}px system-ui`;
  c.textAlign = align;
  c.fillText(s, x, y);
}

function background(c) {
  rect(c, 0, 0, 800, 450, '#101a22');

  c.strokeStyle = '#1c2b36';
  c.lineWidth = 1;

  for (let x = 0; x < 800; x += 40) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, 450);
    c.stroke();
  }

  for (let y = 10; y < 450; y += 40) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(800, y);
    c.stroke();
  }
}

/*
  SKYLINE SPRINT
  Eight original stages, double jump and checkpoints.

  Stage format:
  platforms, crystals, reset pads, goal.
*/
function skyline(best, record) {
  const levels = [
    [
      [
        [0,400,800,50],
        [160,334,115,16],
        [345,278,115,16],
        [545,334,105,16]
      ],
      [[214,308],[400,252],[597,308]],
      [],
      [738,400]
    ],

    [
      [
        [0,400,170,50],
        [292,400,190,50],
        [650,400,150,50],
        [185,325,82,16],
        [450,272,88,16],
        [555,332,74,16]
      ],
      [[225,299],[495,246],[590,306]],
      [],
      [738,400]
    ],

    [
      [
        [0,400,800,50],
        [130,326,95,16],
        [305,253,100,16],
        [490,190,100,16],
        [660,265,100,16]
      ],
      [[175,300],[350,227],[540,164]],
      [[240,386,48,14],[435,386,48,14]],
      [710,265]
    ],

    [
      [
        [0,400,155,50],
        [240,345,92,18],
        [420,285,105,18],
        [585,343,90,18],
        [710,400,90,50]
      ],
      [[286,319],[470,259],[628,317]],
      [],
      [755,400]
    ],

    [
      [
        [0,400,800,50],
        [110,315,100,18],
        [280,245,105,18],
        [470,315,95,18],
        [645,245,100,18]
      ],
      [[160,289],[335,219],[695,219]],
      [
        [220,386,70,14],
        [385,386,75,14],
        [565,386,70,14]
      ],
      [695,245]
    ],

    [
      [
        [0,400,130,50],
        [220,350,85,18],
        [390,295,100,18],
        [565,235,95,18],
        [700,335,100,18]
      ],
      [[262,324],[435,269],[612,209]],
      [],
      [746,335]
    ],

    [
      [
        [0,400,800,50],
        [130,320,95,18],
        [315,240,95,18],
        [500,160,95,18],
        [660,240,100,18]
      ],
      [[175,294],[360,214],[545,134]],
      [
        [235,386,65,14],
        [425,386,65,14],
        [610,386,50,14]
      ],
      [712,240]
    ],

    [
      [
        [0,400,130,50],
        [205,330,85,18],
        [385,260,90,18],
        [555,190,90,18],
        [705,290,95,18]
      ],
      [[247,304],[430,234],[600,164]],
      [],
      [753,290]
    ]
  ];

  let level = 0;
  let t = 0;
  let retries = 0;

  let crystals;
  let platforms;
  let pads;
  let goal;
  let p;
  let spawn;
  let checkpoint;

  let jumps = 0;
  let buffer = 0;
  let coyote = 0;
  let done = false;

  function load() {
    const l = levels[level];

    platforms = l[0].map(
      ([x,y,w,h]) => ({x,y,w,h})
    );

    crystals = l[1].map(
      ([x,y]) => ({x,y,taken:false})
    );

    pads = l[2].map(
      ([x,y,w,h]) => ({x,y,w,h})
    );

    goal = {x:l[3][0], y:l[3][1]};
    spawn = {x:42, y:365};

    p = {
      ...spawn,
      w:20,
      h:28,
      vx:0,
      vy:0
    };

    checkpoint = false;
    t = 0;
    retries = 0;
    done = false;
    jumps = 0;
    buffer = 0;
    coyote = 0;
  }

  function resetPosition() {
    p.x = spawn.x;
    p.y = spawn.y;
    p.vx = 0;
    p.vy = 0;

    jumps = 0;
    buffer = 0;
    coyote = 0;
    retries++;
  }

  load();

  return {
    title: 'Skyline Sprint',

    instructions:
      'A/D or Left/Right: move. Space/W/Up: jump; ' +
      'press again for an air jump. Collect three crystals, ' +
      'then reach the flag. Middle crystal sets a checkpoint.',

    controls: [
      ['Left','left'],
      ['Right','right'],
      ['Jump','up']
    ],

    reset: load,

    next() {
      if (done && level < levels.length - 1) {
        level++;
        load();
      }
    },

    input(key) {
      if (key === 'up') buffer = .13;
    },

    update(dt, held) {
      if (done) return;

      t += dt;
      buffer = Math.max(0, buffer - dt);
      coyote = Math.max(0, coyote - dt);

      const axis =
        Number(held.has('right')) -
        Number(held.has('left'));

      const target = axis * 220;

      p.vx +=
        (target - p.vx) *
        Math.min(1, 14 * dt);

      if (
        buffer > 0 &&
        (coyote > 0 || jumps < 2)
      ) {
        p.vy = -445;
        jumps = coyote > 0 ? 1 : jumps + 1;
        coyote = 0;
        buffer = 0;
      }

      p.vy = Math.min(720, p.vy + 1250 * dt);
      p.x += p.vx * dt;

      for (const b of platforms) {
        if (overlap(p,b)) {
          p.x = p.vx > 0
            ? b.x - p.w
            : b.x + b.w;

          p.vx = 0;
        }
      }

      p.x = clamp(p.x, 0, 800 - p.w);
      p.y += p.vy * dt;

      for (const b of platforms) {
        if (overlap(p,b)) {
          if (p.vy >= 0) {
            p.y = b.y - p.h;
            coyote = .09;
            jumps = 0;
          } else {
            p.y = b.y + b.h;
          }

          p.vy = 0;
        }
      }

      if (
        p.y > 510 ||
        pads.some(b => overlap(p,b))
      ) {
        resetPosition();
        return;
      }

      crystals.forEach((v,i) => {
        if (
          !v.taken &&
          Math.hypot(
            p.x + 10 - v.x,
            p.y + 14 - v.y
          ) < 28
        ) {
          v.taken = true;

          if (i === 1) {
            const floor = platforms
              .filter(b =>
                v.x >= b.x &&
                v.x <= b.x + b.w &&
                b.y >= v.y
              )
              .sort((a,b) => a.y - b.y)[0];

            if (floor) {
              spawn = {
                x: clamp(
                  v.x - 10,
                  floor.x,
                  floor.x + floor.w - p.w
                ),
                y: floor.y - p.h
              };

              checkpoint = true;
            }
          }
        }
      });

      if (
        crystals.every(v => v.taken) &&
        Math.abs(p.x + 10 - goal.x) < 30 &&
        Math.abs(p.y + p.h - goal.y) < 36
      ) {
        done = true;
        record('skyline-' + level, t);
      }
    },

    draw(c) {
      background(c);

      for (let i = 0; i < 12; i++) {
        const h = 45 + (i * 41) % 130;

        rect(
          c, i * 75, 450 - h,
          58, h, '#192732'
        );

        rect(
          c, i * 75 + 10, 460 - h,
          5, 6, '#2c3b46'
        );
      }

      for (const b of platforms) {
        rect(c,b.x,b.y,b.w,b.h,'#405765');
        rect(c,b.x,b.y,b.w,3,'#97bac2');
      }

      pads.forEach(b => {
        c.fillStyle = '#d78e72';

        for (
          let x = b.x;
          x < b.x + b.w;
          x += 12
        ) {
          c.beginPath();
          c.moveTo(x, b.y + b.h);
          c.lineTo(x + 6, b.y);
          c.lineTo(x + 12, b.y + b.h);
          c.fill();
        }
      });

      if (checkpoint) {
        rect(
          c,spawn.x+10,spawn.y-17,
          2,17,'#88c0af'
        );

        rect(
          c,spawn.x+12,spawn.y-17,
          14,8,'#88c0af'
        );
      }

      crystals.forEach(v => {
        if (v.taken) return;

        c.fillStyle = '#f2ca66';
        c.beginPath();
        c.moveTo(v.x, v.y - 10);
        c.lineTo(v.x + 8, v.y);
        c.lineTo(v.x, v.y + 10);
        c.lineTo(v.x - 8, v.y);
        c.closePath();
        c.fill();
      });

      rect(
        c, goal.x, goal.y - 57,
        3, 57, '#d7dfe0'
      );

      c.fillStyle = crystals.every(v => v.taken)
        ? '#a8d69b'
        : '#6f7b87';

      c.beginPath();
      c.moveTo(goal.x + 3, goal.y - 57);
      c.lineTo(goal.x + 30, goal.y - 47);
      c.lineTo(goal.x + 3, goal.y - 36);
      c.fill();

      rect(c,p.x,p.y,p.w,p.h,'#f4d174');

      rect(
        c,
        p.x + (p.vx < 0 ? 3 : 12),
        p.y + 6,
        4,4,
        '#24313a'
      );

      text(
        c,
        'STAGE ' + (level + 1) + ' / 8',
        22,31,14,'#bbc8cf'
      );

      text(
        c,
        crystals.filter(v => v.taken).length +
          ' / 3 CRYSTALS',
        778,31,14,'#f2ca66','right'
      );
    },

    hud: () =>
      `Stage ${level+1}/8 · ${t.toFixed(1)}s · ` +
      `${retries} retries` +
      (checkpoint ? ' · Checkpoint saved' : '') +
      (
        Number.isFinite(best['skyline-'+level])
          ? ' · Best ' +
            best['skyline-'+level].toFixed(1) + 's'
          : ''
      ),

    done: () => done,

    message: () => level === 7
      ? 'All eight stages complete!'
      : 'Stage cleared!',

    canNext: () => done && level < 7
  };
}

/*
  POCKET CIRCUIT
  Three original tracks.
  Ordered checkpoints prevent shortcuts.
*/
function circuit(best, record) {
  let course = 0;
  let points;
  let car;
  let time = 0;
  let laps = 0;
  let gate = 0;
  let done = false;

  const names = [
    'Harbor oval',
    'Clover circuit',
    'Ripple ring'
  ];

  function point(a) {
    const r = course === 1
      ? 1 + .11 * Math.cos(3*a)
      : course === 2
        ? 1 + .10 * Math.sin(4*a)
        : 1;

    return {
      x:400 + 290*r*Math.cos(a),
      y:228 + 136*r*Math.sin(a)
    };
  }

  function reset() {
    points = Array.from(
      {length:128},
      (_,i) => point(i*Math.PI*2/128)
    );

    const p = point(-Math.PI/2);
    const next = point(-Math.PI/2 + .015);

    car = {
      ...p,
      angle:Math.atan2(next.y-p.y, next.x-p.x),
      speed:0
    };

    time = 0;
    laps = 0;
    gate = 0;
    done = false;
  }

  function distance(p) {
    let best = Infinity;

    points.forEach((a,i) => {
      const b = points[(i+1)%points.length];
      const dx = b.x-a.x;
      const dy = b.y-a.y;

      const u = clamp(
        (
          (p.x-a.x)*dx +
          (p.y-a.y)*dy
        ) / (dx*dx+dy*dy),
        0,1
      );

      best = Math.min(
        best,
        Math.hypot(
          p.x-a.x-u*dx,
          p.y-a.y-u*dy
        )
      );
    });

    return best;
  }

  function road(c,width,color) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.beginPath();

    points.forEach((p,i) =>
      i
        ? c.lineTo(p.x,p.y)
        : c.moveTo(p.x,p.y)
    );

    c.closePath();
    c.stroke();
  }

  reset();

  return {
    title:'Pocket Circuit',

    instructions:
      'W/Up: accelerate. S/Down: brake or reverse. ' +
      'A/D or Left/Right: steer. Drive clockwise through ' +
      'the gold checkpoint. Complete three laps; ' +
      'leaving the road slows the car.',

    controls:[
      ['Left','left'],
      ['Right','right'],
      ['Drive','up'],
      ['Brake','down']
    ],

    reset,

    next() {
      if (done && course < 2) {
        course++;
        reset();
      }
    },

    input() {},

    update(dt,held) {
      if (done) return;

      if (
        held.has('up') ||
        Math.abs(car.speed) > 1
      ) {
        time += dt;
      }

      const throttle =
        Number(held.has('up')) -
        Number(held.has('down'));

      car.speed = clamp(
        car.speed +
        (throttle*165-car.speed*.38)*dt,
        -65,235
      );

      if (!throttle) {
        car.speed *= Math.exp(-.8*dt);
      }

      const turn =
        Number(held.has('right')) -
        Number(held.has('left'));

      car.angle +=
        turn * 2.7 *
        clamp(car.speed/95,-1,1) * dt;

      car.x +=
        Math.cos(car.angle) * car.speed * dt;

      car.y +=
        Math.sin(car.angle) * car.speed * dt;

      const off = distance(car) > 28;

      if (off) {
        car.speed *= Math.exp(-3.5*dt);
      }

      car.x = clamp(car.x,10,790);
      car.y = clamp(car.y,10,440);

      const goal = point(gate*Math.PI/2);

      if (
        Math.hypot(
          car.x-goal.x,
          car.y-goal.y
        ) < 38 &&
        !off
      ) {
        gate++;

        if (gate === 4) {
          gate = 0;
          laps++;
        }

        if (laps === 3) {
          done = true;
          record('circuit-'+course,time);
        }
      }
    },

    draw(c) {
      background(c);

      road(c,76,'#334333');
      road(c,66,'#d4c9a6');
      road(c,60,'#34404a');

      c.setLineDash([10,14]);
      road(c,1,'#788086');
      c.setLineDash([]);

      const start = point(-Math.PI/2);

      for (let row=0;row<6;row++) {
        for (let col=0;col<2;col++) {
          rect(
            c,
            start.x-8+col*8,
            start.y-24+row*8,
            8,8,
            (row+col)%2
              ? '#36404a'
              : '#e9e7d9'
          );
        }
      }

      const goal = point(gate*Math.PI/2);

      c.strokeStyle = '#f4d174';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(goal.x,goal.y,24,0,Math.PI*2);
      c.stroke();

      text(
        c,'NEXT',
        goal.x,goal.y+5,
        10,'#f4d174','center'
      );

      text(
        c,names[course].toUpperCase(),
        400,218,19,'#d1d9d8','center'
      );

      text(
        c,
        'LAP '+Math.min(laps+1,3)+' / 3',
        400,248,16,'#b6c3bf','center'
      );

      c.save();
      c.translate(car.x,car.y);
      c.rotate(car.angle);

      rect(c,-14,-9,28,18,'#f4d174');
      rect(c,2,-6,6,12,'#18232d');
      rect(c,-9,-11,7,3,'#101418');
      rect(c,-9,8,7,3,'#101418');

      c.restore();

      text(
        c,
        Math.round(Math.abs(car.speed))+' SPEED',
        20,30,13,'#ccd7d7'
      );

      text(
        c,time.toFixed(1)+'s',
        780,30,16,'#f4d174','right'
      );
    },

    hud: () =>
      `${names[course]} · ` +
      `Lap ${Math.min(laps+1,3)}/3 · ` +
      `${time.toFixed(1)}s` +
      (
        Number.isFinite(best['circuit-'+course])
          ? ' · Best ' +
            best['circuit-'+course].toFixed(1) + 's'
          : ''
      ),

    done: () => done,

    message: () => course === 2
      ? 'All three circuits complete!'
      : 'Three laps complete!',

    canNext: () => done && course < 2
  };
}

function readBestTimes() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) return saved;
  } catch {
    // The game remains playable when browser storage is disabled.
  }
  return {};
}

function nextTimedGame(factory) {
  const best = readBestTimes();
  function record(key, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const saved = readBestTimes();
    if (!Number.isFinite(saved[key]) || seconds < saved[key]) {
      saved[key] = seconds;
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch {
        // Preserve this session's result when browser storage is disabled.
      }
    }
    if (!Number.isFinite(best[key]) || saved[key] < best[key]) best[key] = saved[key];
  }
  return factory(best, record);
}

function playCanvas(context, createGame) {
  const { root, surface, controls, status, signal } = context;
  let game = createGame();
  const canvas = element("canvas", "local-game__canvas");
  canvas.width = game.width || 800;
  canvas.height = game.height || 450;
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", game.title + " game");
  surface.append(canvas);

  const c = canvas.getContext("2d");
  if (!c) throw new Error("This browser could not start the game canvas.");

  if (game.announceHud) status.setAttribute("role", "status");
  else status.setAttribute("aria-live", "off");
  const help = element("p", "local-game__help", game.instructions + " Press P to pause.");
  root.append(help);
  const heldInputs = new Map();
  const tapInputs = new Map();
  let paused = true;
  let started = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;

  const controlsBar = element("div", "local-game__canvas-tools");
  const toggle = button("Start", () => pause(!paused));
  toggle.classList.add("local-game__button--primary");
  const reset = button(game.resetLabel || (game.reset ? "Restart stage" : "Restart"), () => {
    if (game.reset) game.reset();
    else game = createGame();
    started = false;
    pause(true);
  });
  controlsBar.append(toggle, reset);
  let next;

  if (game.canNext) {
    next = button(game.nextLabel || "Next stage", () => {
      game.next();
      started = false;
      pause(true);
    });
    controlsBar.append(next);
  }
  controls.append(controlsBar);

  const pad = element("div", "local-game__pad");
  const padButtons = [];
  game.controls.forEach(([label, key]) => {
    const control = button(label, event => {
      if (!event.detail && !paused && !game.done()) respond(key);
    });
    control.setAttribute("aria-label", label.length === 1 ? directionNames[key] : label);
    control.addEventListener("pointerdown", event => {
      if (paused || game.done() || event.button !== 0) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      control.setPointerCapture?.(event.pointerId);
      heldInputs.set("pointer:" + event.pointerId, key);
      respond(key);
    }, { signal });
    control.addEventListener("lostpointercapture", releasePointer, { signal });
    pad.append(control);
    padButtons.push(control);
  });
  window.addEventListener("pointerup", releasePointer, { signal });
  window.addEventListener("pointercancel", releasePointer, { signal });
  controls.append(pad);
  if (game.point) {
    canvas.classList.add("local-game__canvas--interactive");
    canvas.addEventListener("click", event => {
      if (paused || game.done()) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      game.point((event.clientX - bounds.left) * canvas.width / bounds.width,
        (event.clientY - bounds.top) * canvas.height / bounds.height);
      paint();
      syncControls();
      requestTick();
    }, { signal });
  }

  function respond(key) {
    game.input(key);
    // Preserve a short directional impulse when a button is activated by keyboard
    // or tapped and released between rendered frames.
    if (game.update && !game.animating && Object.hasOwn(directionNames, key)) tapInputs.set(key, .1);
    if (!game.update || game.animating) {
      paint();
      syncControls();
      requestTick();
    }
  }

  function paint() {
    game.draw(c);
    const finished = game.done();
    const message = finished ? game.message() : "";
    const hud = message ? game.hud() + " · " + message : game.hud();
    if (status.textContent !== hud) status.textContent = hud;
    if (paused || finished) {
      rect(c, canvas.width * .125, canvas.height * .36, canvas.width * .75, canvas.height * .28, "#101821ed");
      const heading = message || (started ? "Paused" : "Ready to play");
      const instruction = finished ? "Choose a control below" : "Select " + (started ? "Resume" : "Start") + " below";
      text(c, heading, canvas.width / 2, canvas.height * .47, 26, "#f1dfac", "center");
      text(c, instruction, canvas.width / 2, canvas.height * .55, 16, "#c2cbd4", "center");
    }
  }

  function syncControls() {
    const finished = game.done();
    toggle.textContent = !paused ? "Pause" : started ? "Resume" : "Start";
    toggle.disabled = finished;
    const waiting = paused || finished || Boolean(game.animating?.());
    padButtons.forEach(control => { control.disabled = waiting; });
    if (next) next.hidden = !game.canNext();
  }

  function tick(now) {
    frame = 0;
    elapsed += last ? Math.min((now - last) / 1000, .075) : 0;
    last = now;
    while (elapsed >= 1 / 120 && !game.done()) {
      const held = new Set(heldInputs.values());
      for (const [key, remaining] of tapInputs) {
        held.add(key);
        if (remaining <= 1 / 120) tapInputs.delete(key);
        else tapInputs.set(key, remaining - 1 / 120);
      }
      game.update(1 / 120, held);
      elapsed -= 1 / 120;
    }
    paint();
    if (!game.done()) requestTick();
    if (!frame) {
      last = 0;
      elapsed = 0;
      syncControls();
    }
  }

  function requestTick() {
    if (!frame && game.update && (!game.animating || game.animating())) frame = requestAnimationFrame(tick);
  }

  function pause(value) {
    paused = value;
    if (!paused) started = true;
    clearInputs();
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    elapsed = 0;
    paint();
    syncControls();
    if (!paused && !game.done()) {
      canvas.focus({ preventScroll: true });
      requestTick();
    }
  }

  function inputFor(event) {
    const key = event.key.toLowerCase();
    if (!event.altKey && !event.ctrlKey && !event.metaKey && game.shortcuts && Object.hasOwn(game.shortcuts, key)) {
      return game.shortcuts[key];
    }
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.target.closest("button")) {
      if (game.spaceAction && event.key === " ") return game.spaceAction;
      if (game.enterAction && event.key === "Enter") return game.enterAction;
    }
    return preferDirection(event, game.title === "Skyline Sprint");
  }

  function clearInputs() {
    heldInputs.clear();
    tapInputs.clear();
  }

  function releasePointer(event) {
    heldInputs.delete("pointer:" + event.pointerId);
  }

  root.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "p" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (game.done()) return;
      event.preventDefault();
      pause(!paused);
      return;
    }
    const direction = inputFor(event);
    if (!direction || paused || game.done()) return;
    event.preventDefault();
    if (!event.repeat) respond(direction);
    heldInputs.set("key:" + (event.code || event.key), direction);
  }, { signal });
  root.addEventListener("keyup", event => {
    heldInputs.delete("key:" + (event.code || event.key));
  }, { signal });
  root.addEventListener("focusout", event => {
    if (!root.contains(event.relatedTarget)) clearInputs();
  }, { signal });
  window.addEventListener("blur", () => {
    if (!paused) pause(true);
  }, { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !paused) pause(true);
  }, { signal });
  pause(true);
  return () => cancelAnimationFrame(frame);
}

const localGames = {
  "2048": {
    title: "2048",
    run: game2048,
    help: "Use the arrow keys, WASD, or the controls below to combine matching tiles."
  },
  ttt: {
    title: "Three in a Row",
    run: ticTacToe,
    help: "Take turns with another player. Get three marks in a row to win. Use the arrow keys and Enter, or tap a square."
  },
  reaction: { title: "Reaction Test", run: reactionGame, help: "Click as soon as the target turns green." },
  switches: { title: "Switchboard", run: switchboard, help: "Each switch toggles itself and its two neighbors." },
  pixel: { title: "Pixel Logic", run: pixelLogic, help: "Use the arrow keys and Enter, or tap a square." },
  "memory-match": { title: "Memory Match", run: memoryMatch, help: "Use the arrow keys and Enter, or tap cards to find all eight pairs." },
  "pattern-pulse": {
    title: "Pattern Pulse",
    run: patternPulse,
    help: "Watch the numbered pads light up, then tap them in the same order or press 1–4. Each round adds a signal."
  },
  "sum-trail": {
    title: "Sum Trail",
    run: sumTrail,
    help: "Select four neighboring tiles that add up to the target. Move up, down, left, or right without reusing a tile. Use arrow keys and Enter, or tap."
  },
  "comet-courier": { title: "Comet Courier", run: context => playCanvas(context, createCometCourier) },
  "pinpoint-putt": { title: "Pinpoint Putt", run: context => playCanvas(context, createPinpointPutt) },
  "beat-beacon": { title: "Beat Beacon", run: context => playCanvas(context, createBeatBeacon) },
  "harbor-dispatch": { title: "Harbor Dispatch", run: context => playCanvas(context, createHarborDispatch) },
  "tidal-rescue": { title: "Tidal Rescue", run: context => playCanvas(context, createTidalRescue) },
  "picnic-pack": { title: "Picnic Pack", run: context => playCanvas(context, createPicnicPack) },
  "kite-breeze": { title: "Kite Breeze", run: context => playCanvas(context, createKiteBreeze) },
  "clover-roll": { title: "Clover Roll", run: context => playCanvas(context, createCloverRoll) },
  "fraction-kitchen": { title: "Fraction Kitchen", run: context => playCanvas(context, createFractionKitchen) },
  "clock-courier": { title: "Clock Courier", run: context => playCanvas(context, createClockCourier) },
  "terrace-workshop": {
    title: "Terrace Workshop",
    run: terraceWorkshop,
    help: "Choose a material and tap a tile, or move with the arrow keys and place it with Enter. Build around the boulders and plant four flower beds beside the connected boardwalk."
  },
  ...Object.fromEntries(Object.entries(classicGames).map(([id, { title }]) => [
    id, { title, run: context => playCanvas(context, () => classicArcade(id)) }
  ])),
  "ffun-skyline-v1": {
    title: "Skyline Sprint",
    run: context => playCanvas(context, () => nextTimedGame(skyline))
  },
  "ffun-circuit-v1": {
    title: "Pocket Circuit",
    run: context => playCanvas(context, () => nextTimedGame(circuit))
  }
};

export function mountLocalGame(id, stage) {
  const game = Object.hasOwn(localGames, id) && localGames[id];
  if (!game) throw new Error("Unknown built-in game: " + id);

  const root = element("div", "local-game");
  root.tabIndex = 0;
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", game.title + " controls");
  const status = element("p", "local-game__status");
  status.setAttribute("aria-live", "polite");
  const surface = element("div", "local-game__surface");
  const controls = element("div", "local-game__controls");
  const events = new AbortController();
  root.append(status, surface, controls);
  if (game.help) root.append(element("p", "local-game__help", game.help));
  stage.append(root);

  let clean;
  try {
    clean = game.run({ root, status, surface, controls, signal: events.signal });
  } catch (error) {
    events.abort();
    root.remove();
    throw error;
  }
  root.focus({ preventScroll: true });
  return () => {
    events.abort();
    clean?.();
    root.remove();
  };
}
