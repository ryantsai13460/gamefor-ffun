const width = 800;
const height = 450;
const center = { x: 274, y: 236 };
const orbit = { inner: 103, outer: 152 };
const colors = {
  ink: '#10192b', paper: '#fff0d4', muted: '#bdc9de',
  inner: '#a2edcd', outer: '#ffd17d', violet: '#bfb4ff',
};
const courses = [
  { name: 'Blue Hour', duration: 17, goal: 6, gates: [
    [2.2, 'inner'], [4.2, 'outer'], [6.1, 'outer'], [8.0, 'inner'],
    [9.8, 'outer'], [11.6, 'inner'], [13.3, 'inner'], [15.1, 'outer'],
  ] },
  { name: 'Dusk Market', duration: 18.5, goal: 8, gates: [
    [2.0, 'outer'], [4.0, 'inner'], [5.7, 'outer'], [7.3, 'inner'], [8.7, 'inner'],
    [10.5, 'outer'], [12.5, 'inner'], [14.1, 'outer'], [15.2, 'inner'], [17.0, 'outer'],
  ] },
  { name: 'Midnight Loop', duration: 19.5, goal: 9, gates: [
    [1.9, 'inner'], [3.8, 'outer'], [5.2, 'inner'], [6.7, 'outer'], [7.8, 'inner'], [9.2, 'outer'],
    [11.1, 'outer'], [12.7, 'inner'], [14.1, 'outer'], [15.3, 'inner'], [16.7, 'inner'], [18.0, 'outer'],
  ] },
];

function circle(c, x, y, radius, fill) {
  c.beginPath();
  c.arc(x, y, radius, 0, 2 * Math.PI);
  c.fillStyle = fill;
  c.fill();
}

function ring(c, x, y, radius, stroke, weight = 1) {
  c.beginPath();
  c.arc(x, y, radius, 0, 2 * Math.PI);
  c.strokeStyle = stroke;
  c.lineWidth = weight;
  c.stroke();
}

function line(c, x1, y1, x2, y2, stroke, weight = 1) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = stroke;
  c.lineWidth = weight;
  c.stroke();
}

function text(c, value, x, y, size, color = colors.paper, align = 'left', weight = 650) {
  c.font = weight + ' ' + size + 'px system-ui, sans-serif';
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(value, x, y);
}

function position(progress, radius) {
  const radians = 2 * Math.PI * progress - Math.PI / 2;
  return [center.x + radius * Math.cos(radians), center.y + radius * Math.sin(radians)];
}

function lantern(c, x, y, lane, size, color) {
  if (lane === 'outer') {
    circle(c, x, y, size, color);
    circle(c, x, y, size * .38, colors.ink);
  } else {
    c.beginPath();
    c.moveTo(x, y - size);
    c.lineTo(x + size, y);
    c.lineTo(x, y + size);
    c.lineTo(x - size, y);
    c.closePath();
    c.fillStyle = color;
    c.fill();
    circle(c, x, y, size * .25, colors.ink);
  }
}

export function createLanternShift({ reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches } = {}) {
  let stage = 0;
  let slower = false;
  let course, elapsed, lane, shownRadius, passed, collected, streak, bestStreak, results;

  function reset() {
    course = courses[stage];
    elapsed = passed = collected = streak = bestStreak = 0;
    lane = 'inner';
    shownRadius = orbit.inner;
    results = [];
  }

  function done() {
    return elapsed >= course.duration;
  }

  function cleared() {
    return done() && collected >= course.goal;
  }

  function move(action) {
    if (done()) return;
    if (action === 'pace') slower = !slower;
    else if (action === 'swap') lane = lane === 'inner' ? 'outer' : 'inner';
    else if (action === 'left' || action === 'up') lane = 'inner';
    else if (action === 'right' || action === 'down') lane = 'outer';
    if (reducedMotion) shownRadius = orbit[lane];
  }

  function drawBackdrop(c) {
    const sky = c.createLinearGradient(0, 0, width, height);
    sky.addColorStop(0, '#0e162a');
    sky.addColorStop(1, stage === 0 ? '#1f254b' : stage === 1 ? '#322447' : '#252550');
    c.fillStyle = sky;
    c.fillRect(0, 0, width, height);
    for (let index = 0; index < 70; index++) {
      const x = (index * 83 + 23) % width;
      const y = (index * 113 + 57) % height;
      circle(c, x, y, index % 9 === 0 ? 1.6 : .8, index % 9 === 0 ? '#8f91b5' : '#51577d');
    }
    c.fillStyle = '#131d35';
    c.fillRect(508, 68, 263, 322);
    line(c, 508, 68, 771, 68, colors.violet, 2);
  }

  function drawCourse(c) {
    const { x, y } = center;
    circle(c, x, y, 178, '#131e35');
    ring(c, x, y, 178, '#49527a');
    ring(c, x, y, 125, '#263958');
    ring(c, x, y, 72, '#273d5b');
    for (let tick = 0; tick < 48; tick++) {
      const progress = tick / 48;
      line(c, ...position(progress, tick % 4 ? 163 : 160), ...position(progress, 171), '#637297');
    }
    for (const name of Object.keys(orbit)) {
      ring(c, x, y, orbit[name], '#243752', 14);
      ring(c, x, y, orbit[name], name === lane ? '#7585a4' : '#40506f');
    }
    const progress = elapsed / course.duration;
    c.beginPath();
    c.arc(x, y, orbit[lane], -Math.PI / 2, 2 * Math.PI * progress - Math.PI / 2);
    c.strokeStyle = '#647494';
    c.lineWidth = 3;
    c.stroke();

    course.gates.forEach(([arrival, gateLane], index) => {
      const step = arrival / course.duration;
      const [gx, gy] = position(step, orbit[gateLane]);
      if (index === passed) {
        line(c, ...position(step, 83), ...position(step, 170), '#9aa5c2');
        ring(c, gx, gy, 19, colors.paper, 2);
      }
      const faded = index < passed;
      const color = faded ? (results[index] ? '#607c87' : '#52617c') : colors[gateLane];
      lantern(c, gx, gy, gateLane, index === passed ? 12 : 8, color);
      if (faded && results[index]) circle(c, gx, gy, 2.1, colors.paper);
    });

    if (!reducedMotion && results[passed - 1]) {
      const [arrival, lastLane] = course.gates[passed - 1];
      const fade = (elapsed - arrival) / .42;
      if (fade < 1) {
        c.save();
        c.globalAlpha = 1 - fade;
        ring(c, ...position(arrival / course.duration, orbit[lastLane]), 14 + fade * 20, colors[lastLane], 2);
        c.restore();
      }
    }

    const [px, py] = position(progress, shownRadius);
    circle(c, px, py, 19, '#7285b0');
    circle(c, px, py, 15, colors.ink);
    circle(c, px, py, 11, colors.paper);
    circle(c, px - 2, py - 3, 3, '#ffffff');
    text(c, 'CURRENT LANE', x, y - 10, 13, colors.muted, 'center');
    text(c, lane === 'inner' ? 'Inner' : 'Outer', x, y + 21, 28, colors[lane], 'center', 800);
  }

  function draw(c) {
    drawBackdrop(c);
    drawCourse(c);
    text(c, 'LANTERN SHIFT', 25, 39, 25, colors.paper, 'left', 820);
    text(c, 'COURSE ' + (stage + 1) + ' / ' + courses.length, 770, 38, 15, colors.violet, 'right');
    text(c, course.name, 529, 113, 25, colors.paper, 'left', 770);
    line(c, 529, 132, 749, 132, '#364563');
    text(c, 'LANTERNS', 529, 159, 14, colors.muted);
    text(c, collected + ' / ' + course.gates.length, 529, 198, 34, colors.paper, 'left', 800);
    text(c, 'Goal ' + course.goal, 748, 198, 16, colors.muted, 'right');
    const upcoming = course.gates[passed];
    text(c, upcoming ? 'NEXT LANTERN' : 'BEST STREAK', 529, 240, 14, colors.muted);
    if (upcoming) {
      const nextLane = upcoming[1];
      lantern(c, 542, 270, nextLane, 9, colors[nextLane]);
      text(c, nextLane === 'inner' ? 'Inner lane' : 'Outer lane', 562, 277, 22, colors[nextLane], 'left', 760);
    } else {
      text(c, bestStreak, 529, 277, 25);
    }
    c.fillStyle = '#334561';
    c.fillRect(529, 313, 220, 6);
    c.fillStyle = colors.violet;
    c.fillRect(529, 313, 220 * elapsed / course.duration, 6);
    text(c, slower ? 'Relaxed pace' : 'Normal pace', 529, 349, 15, colors.muted);
    text(c, 'Streak ' + streak, 749, 349, 15, colors.muted, 'right');
    text(c, 'Match the next lantern’s lane before you reach it.', width / 2, 427, 17, colors.paper, 'center');
  }

  reset();
  return {
    title: 'Lantern Shift',
    instructions: 'Match the next lantern’s lane before you reach it. Use Left for inner and Right for outer, Space to switch, or tap a ring. Press T to change pace.',
    controls: [['Inner lane', 'left'], ['Outer lane', 'right'], ['Swap lanes', 'swap'], ['Change pace', 'pace']],
    spaceAction: 'swap',
    shortcuts: { t: 'pace' },
    announceHud: true,
    resetLabel: 'Restart course',
    nextLabel: 'Next course',
    draw,
    input: move,
    point(x, y) {
      const radius = Math.hypot(x - center.x, y - center.y);
      if (radius >= 71 && radius <= 176) move(radius < (orbit.inner + orbit.outer) / 2 ? 'left' : 'right');
    },
    update(dt) {
      if (done()) return;
      elapsed = Math.min(course.duration, elapsed + dt * (slower ? .65 : 1));
      shownRadius += (orbit[lane] - shownRadius) * (1 - Math.exp(-20 * dt));
      while (passed < course.gates.length && elapsed >= course.gates[passed][0]) {
        const caught = lane === course.gates[passed][1];
        results.push(caught);
        if (caught) collected++;
        streak = caught ? streak + 1 : 0;
        bestStreak = Math.max(bestStreak, streak);
        passed++;
      }
    },
    hud() {
      const upcoming = course.gates[passed];
      const next = upcoming ? 'Next lantern ' + (passed + 1) + ' in ' + upcoming[1] + ' lane' : 'Best streak ' + bestStreak;
      return course.name + ' · Lanterns ' + collected + '/' + course.gates.length + ' · Goal ' + course.goal +
        ' · Lane ' + lane + ' · ' + next + ' · ' + (slower ? 'Relaxed pace' : 'Normal pace');
    },
    done,
    message() {
      if (!cleared()) return 'Try this course again';
      if (stage === courses.length - 1) return 'All three courses cleared!';
      return collected === course.gates.length ? 'Perfect course!' : 'Course cleared!';
    },
    reset,
    canNext: () => cleared() && stage < courses.length - 1,
    next() {
      if (cleared() && stage < courses.length - 1) {
        stage++;
        reset();
      }
    },
  };
}
