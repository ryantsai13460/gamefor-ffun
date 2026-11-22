const width = 800;
const height = 450;
const runnerWidth = 18;
const runnerHeight = 23;
const runSpeed = 260;
const jumpSpeed = 515;
const gravity = 1450;
const dashSpeed = 610;
const dashLength = .135;

const courses = [
  {
    id: 'pine-ridge', name: 'Pine Ridge', start: [52, 411], checkpoint: [520, 271], goal: [745, 224],
    hint: 'Jump between ledges and touch the gold relay to set a checkpoint.',
    solids: [[14, 411, 135, 39], [182, 367, 111, 55], [329, 319, 106, 61], [477, 271, 124, 58], [656, 224, 130, 86]],
    sky: '#284e60', ridge: '#395b67',
  },
  {
    id: 'service-shaft', name: 'Service Shaft', start: [252, 410], checkpoint: [301, 254], goal: [740, 146],
    hint: 'Hold toward a wall to slide. Jump while touching it to climb.',
    solids: [[150, 410, 205, 40], [150, 172, 27, 238], [325, 119, 30, 291], [177, 334, 42, 12],
      [276, 254, 49, 12], [177, 188, 57, 12], [405, 166, 94, 37], [550, 210, 103, 41], [705, 146, 80, 71]],
    sky: '#424766', ridge: '#4c5570',
  },
  {
    id: 'storm-tower', name: 'Storm Tower', start: [50, 402], checkpoint: [456, 308], goal: [750, 221],
    hint: 'Build speed before jumping, then dash in midair to cross wide gaps.',
    solids: [[14, 402, 115, 48], [308, 355, 91, 51], [423, 308, 104, 50], [694, 221, 92, 87]],
    sky: '#3b455d', ridge: '#49536c',
  },
];

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function approach(value, target, step) {
  return value + clamp(target - value, -step, step);
}

function intersects(player, x, y, w, h) {
  return player.x < x + w && player.x + runnerWidth > x && player.y < y + h && player.y + runnerHeight > y;
}

function post(c, [x, floor], color, complete) {
  c.fillStyle = color;
  c.fillRect(x - 1, floor - 29, 3, 28);
  c.beginPath();
  c.arc(x, floor - 27, 7, 0, Math.PI * 2);
  if (complete) c.fill();
  else {
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.stroke();
  }
}

export function createBeaconAscent(best = {}, record = () => {}) {
  let courseIndex = 0;
  let course, player, checkpoint, falls, elapsed, finished, dashReady, dashTime, facing;
  let jumpBuffer, dashBuffer, coyoteTime, wallLock;

  function respawn() {
    const [x, floor] = checkpoint ? course.checkpoint : course.start;
    player = { x: x - runnerWidth / 2, y: floor - runnerHeight, vx: 0, vy: 0, grounded: true };
    dashReady = true;
    facing = 1;
    dashTime = jumpBuffer = dashBuffer = coyoteTime = wallLock = 0;
  }

  function reset() {
    course = courses[courseIndex];
    checkpoint = finished = false;
    falls = elapsed = 0;
    respawn();
  }

  function wallSide() {
    for (const [x, y, w, h] of course.solids) {
      if (player.y >= y + h || player.y + runnerHeight <= y) continue;
      if (Math.abs(player.x + runnerWidth - x) < .1) return 1;
      if (Math.abs(player.x - x - w) < .1) return -1;
    }
    return 0;
  }

  function moveAcross(distance) {
    player.x = clamp(player.x + distance, 0, width - runnerWidth);
    for (const [x, y, w, h] of course.solids) {
      if (!intersects(player, x, y, w, h)) continue;
      player.x = distance > 0 ? x - runnerWidth : x + w;
      player.vx = dashTime = 0;
    }
  }

  function moveVertically(distance) {
    player.y += distance;
    player.grounded = false;
    for (const [x, y, w, h] of course.solids) {
      if (!intersects(player, x, y, w, h)) continue;
      player.grounded = distance > 0;
      player.y = player.grounded ? y - runnerHeight : y + h;
      player.vy = 0;
    }
  }

  function update(dt, held) {
    if (finished) return;
    elapsed += dt;
    wallLock = Math.max(0, wallLock - dt);
    coyoteTime = player.grounded ? .095 : Math.max(0, coyoteTime - dt);
    if (player.grounded) dashReady = true;
    const direction = Number(held.has('right')) - Number(held.has('left'));
    const wall = wallSide();
    if (direction && !wallLock && !dashTime) facing = direction;

    if (jumpBuffer && !dashTime && (coyoteTime || (wall && !wallLock))) {
      player.vy = -jumpSpeed;
      player.grounded = false;
      if (!coyoteTime) {
        facing = -wall;
        player.vx = facing * 285;
        wallLock = .145;
      }
      jumpBuffer = coyoteTime = 0;
    }
    if (dashBuffer && dashReady && !player.grounded) {
      facing = direction || facing;
      player.vx = facing * dashSpeed;
      player.vy = 0;
      dashTime = dashLength;
      dashReady = false;
      dashBuffer = 0;
    }
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    dashBuffer = Math.max(0, dashBuffer - dt);

    if (dashTime) {
      moveAcross(player.vx * Math.min(dt, dashTime));
      dashTime = Math.max(0, dashTime - dt);
      if (!dashTime) player.vx = clamp(player.vx, -runSpeed, runSpeed);
    } else {
      if (!wallLock) {
        const acceleration = player.grounded ? 2650 : 1800;
        player.vx = approach(player.vx, direction * runSpeed, acceleration * dt);
      }
      moveAcross(player.vx * dt);
      const slide = !player.grounded && direction && wallSide() === direction && !wallLock;
      player.vy = Math.min(slide ? 108 : 670, player.vy + gravity * dt);
      moveVertically(player.vy * dt);
      if (player.grounded) dashReady = true;
    }

    if (player.y > height) {
      falls++;
      respawn();
      return;
    }
    const [relayX, relayY] = course.checkpoint;
    if (intersects(player, relayX - 11, relayY - 32, 22, 32)) checkpoint = true;
    const [goalX, goalY] = course.goal;
    if (intersects(player, goalX - 11, goalY - 44, 22, 44)) {
      finished = true;
      record(`beacon-ascent:${course.id}`, elapsed);
    }
  }

  function draw(c) {
    const sky = c.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#152334');
    sky.addColorStop(1, course.sky);
    c.fillStyle = sky;
    c.fillRect(0, 0, width, height);
    c.fillStyle = course.ridge;
    c.beginPath();
    c.moveTo(0, 338);
    for (const [x, y] of [[109, 257], [164, 306], [295, 184], [358, 248], [409, 214], [529, 310], [630, 218], [800, 328]]) c.lineTo(x, y);
    c.lineTo(width, height);
    c.lineTo(0, height);
    c.fill();
    c.fillStyle = '#0e2330';
    c.fillRect(0, height - 14, width, 14);
    for (const [x, y, w, h] of course.solids) {
      c.fillStyle = '#1c3342';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#7fcac1';
      c.fillRect(x, y, w, 3);
      c.fillStyle = '#38526a';
      c.fillRect(x + w - 4, y + 3, 4, Math.max(0, h - 3));
      c.fillRect(x, y + 3, 3, Math.max(0, h - 3));
    }

    post(c, course.checkpoint, checkpoint ? '#baf4d2' : '#ffe18a', checkpoint);
    post(c, course.goal, '#c1cfff', finished);
    const [goalX, goalY] = course.goal;
    c.fillStyle = '#c1cfff';
    c.fillRect(goalX - 12, goalY - 35, 24, 3);

    c.fillStyle = '#0e2030';
    c.fillRect(12, 12, width - 24, 53);
    c.textAlign = 'left';
    c.fillStyle = '#edf6f0';
    c.font = 'bold 19px system-ui, sans-serif';
    c.fillText(course.name, 25, 35);
    c.font = '14px system-ui, sans-serif';
    c.fillText(course.hint, 25, 55);
    c.textAlign = 'right';
    c.font = 'bold 19px system-ui, sans-serif';
    c.fillText(`${elapsed.toFixed(2)} s`, 771, 35);
    const saved = best[`beacon-ascent:${course.id}`];
    c.font = '14px system-ui, sans-serif';
    c.fillStyle = '#afe3d8';
    c.fillText(Number.isFinite(saved) ? `Best ${saved.toFixed(2)} s` : `${courseIndex + 1} / ${courses.length}`, 771, 55);

    if (dashTime) {
      c.fillStyle = '#63c3de';
      c.fillRect(facing > 0 ? player.x - 16 : player.x + runnerWidth, player.y + 9, 16, 6);
    }
    c.fillStyle = '#ffefb3';
    c.fillRect(player.x, player.y, runnerWidth, runnerHeight);
    c.fillStyle = '#173040';
    c.fillRect(player.x + (facing > 0 ? 11 : 3), player.y + 5, 4, 4);
  }

  reset();
  return {
    title: 'Beacon Ascent', width, height, announceHud: true,
    instructions: 'A/D or Left/Right moves. W, Up, or Space jumps, including away from walls. X dashes in the air. Land to recharge. Touch a gold relay to set a checkpoint.',
    controls: [['Left', 'left'], ['Right', 'right'], ['Jump', 'up'], ['Dash', 'dash']],
    spaceAction: 'up', shortcuts: { x: 'dash' }, resetLabel: 'Restart course', nextLabel: 'Next course',
    input(action) {
      if (action === 'up') jumpBuffer = .115;
      if (action === 'dash') dashBuffer = .11;
    },
    reset, update, draw,
    hud: () => `${course.name} · ${checkpoint ? 'Checkpoint set' : 'Checkpoint ahead'} · Air dash ${dashReady ? 'ready' : 'used'} · Falls ${falls}`,
    done: () => finished,
    canNext: () => finished && courseIndex < courses.length - 1,
    message: () => courseIndex === courses.length - 1 ? 'All three beacons reached!' : 'Beacon reached!',
    next() {
      if (finished && courseIndex < courses.length - 1) {
        courseIndex++;
        reset();
      }
    },
  };
}
