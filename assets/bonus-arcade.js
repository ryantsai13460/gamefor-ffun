const width = 800;
const height = 450;
const ink = "#0f1a2b";
const panel = "#182940";
const line = "#38506c";
const white = "#f2f6ff";
const muted = "#b7c4da";
const gold = "#ffd17a";
const mint = "#83e0cb";

function box(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function dot(c, x, y, radius, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

function label(c, value, x, y, size = 18, color = white, align = "left") {
  c.font = "650 " + size + "px system-ui";
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(value, x, y);
}

function polygon(c, points, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.closePath();
  c.fill();
}

function limit(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createCometCourier() {
  const waves = [
    [1, 2], [0, 1], [2, 0], [2, 1], [0, 2], [1, 0], [2, 1], [0, 2],
    [1, 2], [0, 1], [0, 2], [2, 1], [1, 0], [2, 0], [1, 2], [0, 1]
  ];
  const lanes = [240, 400, 560];
  const shipY = 365;
  const stars = Array.from({ length: 26 }, (_, index) => ({
    x: (index * 119 + 22) % width,
    y: (index * 61 + 10) % height,
    speed: 14 + (index % 4) * 9
  }));
  const arrivals = waves.map((_, index) => 2.2 + index * 1.36 - index * index * .011);
  let elapsed = 0;
  let wave = 0;
  let lane = 1;
  let parcels = 0;
  let shields = 3;
  let result = "Ready for launch";

  function done() {
    return wave === waves.length || shields === 0;
  }

  return {
    title: "Comet Courier",
    instructions: "Change lanes with A/D, Left/Right, or the buttons below. Catch the square cargo and dodge the jagged rocks.",
    controls: [["Move left", "left"], ["Move right", "right"]],
    input(key) {
      if (key === "left") lane = Math.max(0, lane - 1);
      if (key === "right") lane = Math.min(lanes.length - 1, lane + 1);
    },
    update(dt) {
      elapsed += dt;
      if (done() || elapsed < arrivals[wave]) return;
      const [cargo, rock] = waves[wave++];
      if (lane === rock) {
        shields--;
        result = "Rock hit";
      } else if (lane === cargo) {
        parcels++;
        result = "Cargo collected";
      } else {
        result = "Cargo missed";
      }
    },
    draw(c) {
      box(c, 0, 0, width, height, ink);
      for (const star of stars) dot(c, star.x, (star.y + elapsed * star.speed) % height, 1.5, line);
      const laneStart = 160;
      lanes.forEach((x, index) => {
        box(c, x - 74, 68, 148, 338, index === lane ? panel : "#132238");
        for (let y = 78; y < 394; y += 26) box(c, x - 78, y, 2, 12, line);
      });
      box(c, 638, 68, 2, 338, line);
      box(c, laneStart, shipY, 480, 2, line);
      label(c, "CARGO " + parcels + " / " + waves.length, 30, 42, 17, gold);
      label(c, "SHIELDS " + shields, 770, 42, 17, mint, "right");

      for (let index = wave; index < waves.length; index++) {
        const y = shipY - (arrivals[index] - elapsed) * 168;
        if (y < 74) break;
        const [cargo, rock] = waves[index];
        const x = lanes[cargo];
        box(c, x - 15, y - 15, 30, 30, gold);
        box(c, x - 11, y - 11, 22, 22, "#8b5a2a");
        box(c, x - 3, y - 11, 6, 22, gold);
        const r = lanes[rock];
        polygon(c, [[r - 18, y - 10], [r - 3, y - 20], [r + 12, y - 15], [r + 19, y - 3],
          [r + 10, y + 18], [r - 12, y + 12]], "#cb8899");
        dot(c, r + 6, y - 4, 5, "#724559");
      }

      const x = lanes[lane];
      polygon(c, [[x, shipY - 25], [x + 23, shipY + 22], [x, shipY + 13], [x - 23, shipY + 22]], mint);
      dot(c, x, shipY - 1, 6, "#21435a");
      label(c, result, 400, 430, 15, muted, "center");
    },
    hud: () => "Cargo " + parcels + "/" + waves.length + " · Shields " + shields + " · " + result,
    done,
    message: () => shields ? "Route complete!" : "Ship out of shields"
  };
}

const holes = [
  { tee: [150, 230], cup: [585, 230], par: 2, angle: 0, walls: [] },
  { tee: [132, 346], cup: [660, 148], par: 3, angle: -.95, walls: [[320, 179, 111, 214]] },
  { tee: [140, 344], cup: [658, 119], par: 4, angle: -.13, walls: [[264, 58, 83, 230], [503, 232, 95, 159]] }
];

export function createPinpointPutt() {
  const bounds = { left: 48, top: 58, right: 752, bottom: 393 };
  const radius = 8;
  const drag = 630;
  const shotAction = "putt";
  let hole = 0;
  let course, x, y, angle, power, vx, vy, strokes, sunk;

  function reset() {
    course = holes[hole];
    [x, y] = course.tee;
    angle = course.angle;
    power = .75;
    vx = vy = strokes = 0;
    sunk = false;
  }

  function moving() {
    return vx !== 0 || vy !== 0;
  }

  function blocked(px, py) {
    return course.walls.some(([wallX, wallY, w, h]) =>
      px > wallX - radius && px < wallX + w + radius && py > wallY - radius && py < wallY + h + radius
    );
  }

  reset();
  return {
    title: "Pinpoint Putt",
    instructions: "Aim with Left/Right. Adjust power with Up/Down. Press Space or Putt to shoot. Fast shots can roll past the cup.",
    controls: [["Aim left", "left"], ["Aim right", "right"], ["More power", "up"], ["Less power", "down"], ["Putt", shotAction]],
    spaceAction: shotAction,
    resetLabel: "Restart hole",
    nextLabel: "Next hole",
    input(key) {
      if (moving() || sunk) return;
      if (key === "left") angle -= Math.PI / 24;
      if (key === "right") angle += Math.PI / 24;
      if (key === "up") power = limit(power + .05, 0, 1);
      if (key === "down") power = limit(power - .05, 0, 1);
      if (key === shotAction) {
        const speed = 130 + 650 * power;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
        strokes++;
      }
    },
    update(dt) {
      if (!moving()) return;
      const [cupX, cupY] = course.cup;
      const nextX = x + vx * dt;
      const nextY = y + vy * dt;
      if (nextX < bounds.left + radius || nextX > bounds.right - radius || blocked(nextX, y)) vx *= -.6;
      else x = nextX;
      if (nextY < bounds.top + radius || nextY > bounds.bottom - radius || blocked(x, nextY)) vy *= -.6;
      else y = nextY;

      const speed = Math.hypot(vx, vy);
      if (Math.hypot(x - cupX, y - cupY) < 14 && speed < 260) {
        x = cupX;
        y = cupY;
        sunk = true;
        vx = vy = 0;
        return;
      }
      const dragFactor = speed ? Math.max(0, speed - drag * dt) / speed : 0;
      vx *= dragFactor;
      vy *= dragFactor;
    },
    draw(c) {
      box(c, 0, 0, width, height, ink);
      box(c, 44, 54, 712, 343, "#78ab93");
      box(c, bounds.left, bounds.top, 704, 335, "#25584d");
      for (let xGreen = 56; xGreen < 745; xGreen += 44) box(c, xGreen, 58, 22, 335, "#295e51");
      for (const [xWall, yWall, wWall, hWall] of course.walls) {
        box(c, xWall, yWall, wWall, hWall, "#754d39");
        box(c, xWall + 4, yWall + 4, wWall - 8, hWall - 8, "#c4926a");
      }
      const [cx, cy] = course.cup;
      dot(c, cx, cy, 25, "#376d59");
      dot(c, cx, cy, 13, "#abc9a8");
      dot(c, cx, cy, 11, "#15292d");
      box(c, cx, cy - 46, 2, 35, white);
      polygon(c, [[cx + 2, cy - 46], [cx + 29, cy - 40], [cx + 2, cy - 32]], gold);
      if (!moving() && !sunk) {
        for (let offset = 21; offset < 72 + power * 48; offset += 11) {
          const px = x + Math.cos(angle) * offset;
          const py = y + Math.sin(angle) * offset;
          if (px < 48 || px > 752 || py < 58 || py > 393 || blocked(px, py)) break;
          dot(c, px, py, 2.5, gold);
        }
      }
      if (!sunk) dot(c, x, y, radius, white);
      label(c, "HOLE " + (hole + 1) + " / " + holes.length, 48, 38, 17, mint);
      label(c, "PAR " + course.par + " · STROKES " + strokes, 752, 38, 17, white, "right");
      label(c, "POWER", 287, 428, 14, muted, "right");
      box(c, 307, 414, 184, 14, line);
      box(c, 307, 414, 184 * power, 14, gold);
      label(c, Math.round(power * 100) + "%", 510, 428, 14, gold);
    },
    hud: () => "Hole " + (hole + 1) + "/" + holes.length + " · Par " + course.par + " · Strokes " + strokes +
      " · Power " + Math.round(power * 100) + "%" + (moving() ? " · Ball rolling" : ""),
    done: () => sunk,
    message: () => hole === holes.length - 1 ? "All three holes complete!" : "In the cup!",
    reset,
    canNext: () => sunk && hole < holes.length - 1,
    next() {
      if (sunk && hole < holes.length - 1) {
        hole++;
        reset();
      }
    }
  };
}

export function createBeatBeacon() {
  const beats = [0, 1, 2, 3, 4, 5.5, 6, 7, 8, 8.5, 9.5, 10.5, 12, 13, 14, 15.5, 16, 17, 18, 19, 20, 20.5, 21.5, 23];
  const notes = beats.map(beat => 2 + beat * .57);
  const tolerance = .19;
  const action = "hit";
  const targetX = 204;
  let elapsed = 0;
  let current = 0;
  let hits = 0;
  let combo = 0;
  let score = 0;
  let result = "Watch the hit marker.";

  return {
    title: "Beat Beacon",
    instructions: "Press Space or tap Hit as each note crosses the marker. Closer timing earns more points and extends your streak.",
    controls: [["Hit", action]],
    spaceAction: action,
    input(key) {
      if (key !== action || current >= notes.length) return;
      const difference = elapsed - notes[current];
      if (Math.abs(difference) <= tolerance) {
        const perfect = Math.abs(difference) <= .085;
        hits++;
        combo++;
        score += (perfect ? 100 : 55) + (combo - 1) * 5;
        current++;
        result = perfect ? "Perfect!" : "Hit!";
      } else if (difference < 0) {
        result = "Too early";
        combo = 0;
      }
    },
    update(dt) {
      elapsed += dt;
      if (current < notes.length && elapsed > notes[current] + tolerance) {
        current++;
        combo = 0;
        result = "Missed";
      }
    },
    draw(c) {
      box(c, 0, 0, width, height, ink);
      box(c, 72, 173, 656, 112, panel);
      box(c, 72, 173, 656, 3, line);
      box(c, 72, 282, 656, 3, line);
      box(c, 72, 227, 656, 2, line);
      box(c, targetX - 22, 181, 44, 96, "#345364");
      box(c, targetX - 2, 173, 4, 112, mint);
      label(c, "HIT", targetX, 155, 16, mint, "center");
      for (let index = current; index < notes.length; index++) {
        const x = targetX + (notes[index] - elapsed) * 258;
        if (x > 706) break;
        dot(c, x, 228, 18, gold);
        dot(c, x, 228, 10, "#5a472d");
      }
      label(c, "SCORE " + score, 72, 90, 22, gold);
      label(c, "STREAK " + combo, 728, 90, 22, white, "right");
      label(c, result, 400, 339, 23, white, "center");
      box(c, 260, 382, 280, 7, line);
      box(c, 260, 382, 280 * current / notes.length, 7, mint);
      label(c, hits + " / " + notes.length + " notes hit", 400, 419, 15, muted, "center");
    },
    hud: () => "Score " + score + " · Streak " + combo + " · Hits " + hits + "/" + notes.length + " · " + result,
    done: () => elapsed > notes.at(-1) + .8,
    message: () => "Set complete!"
  };
}
