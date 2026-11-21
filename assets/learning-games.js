const width = 800;
const height = 450;
const paper = '#fff1d5';
const mint = '#a5e2bb';
const gold = '#ffd187';

function box(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function disc(c, x, y, radius, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

function text(c, value, x, y, size, color = paper, align = 'left', weight = 650) {
  c.fillStyle = color;
  c.font = weight + ' ' + size + 'px system-ui, sans-serif';
  c.textAlign = align;
  c.fillText(value, x, y);
}

const orders = [
  { target: [1, 2], slices: [[1, 8], [1, 4], [1, 4], [1, 3]] },
  { target: [3, 4], slices: [[1, 6], [1, 3], [1, 4], [1, 8]] },
  { target: [2, 3], slices: [[1, 4], [1, 2], [1, 6], [1, 8]] },
  { target: [5, 6], slices: [[1, 4], [1, 3], [1, 6], [1, 2]] },
];
const whole = 24;
const fraction = ([numerator, denominator]) => numerator + '/' + denominator;
const units = ([numerator, denominator]) => numerator * (whole / denominator);
const sliceColors = ['#ffac85', '#f3d38d', '#a6d39e', '#8fd2c8'];

function simplify(numerator, denominator) {
  let a = numerator;
  let b = denominator;
  while (b) [a, b] = [b, a % b];
  return a === denominator ? String(numerator / a) : numerator / a + '/' + denominator / a;
}

export function createFractionKitchen() {
  let level = 0;
  let recipe, picked, served, note;

  function reset() {
    recipe = orders[level];
    picked = [];
    served = false;
    note = 'Choose slices to match the order.';
  }

  function total() {
    return picked.reduce((amount, index) => amount + units(recipe.slices[index]), 0);
  }

  function select(index) {
    if (picked.includes(index)) {
      picked = picked.filter(slot => slot !== index);
      note = 'Removed ' + fraction(recipe.slices[index]) + ' from the tray.';
    } else {
      picked.push(index);
      note = 'Added ' + fraction(recipe.slices[index]) + ' to the tray.';
    }
  }

  function check() {
    const difference = total() - units(recipe.target);
    if (difference === 0) served = true;
    else note = difference > 0 ? 'Too much. Remove or swap a slice.' : 'Too little. Add or swap a slice.';
  }

  function draw(c) {
    const amount = total();
    box(c, 0, 0, width, height, '#213932');
    box(c, 22, 58, 756, 177, '#192d29');
    text(c, 'FRACTION KITCHEN', 24, 37, 22, mint, 'left', 800);
    text(c, 'ORDER ' + (level + 1) + ' / ' + orders.length, 775, 36, 16, paper, 'right');

    const trayX = 180;
    const trayWidth = 565;
    const segment = trayWidth / Math.max(amount, whole);
    text(c, 'ORDER', 45, 112, 17, mint);
    text(c, fraction(recipe.target), 45, 143, 28);
    text(c, 'YOUR TRAY', 45, 181, 15, mint);
    text(c, simplify(amount, whole), 45, 214, 28);
    box(c, trayX, 102, trayWidth, 40, '#39564b');
    box(c, trayX, 102, units(recipe.target) * segment, 40, mint);
    box(c, trayX, 174, trayWidth, 40, '#39564b');
    let laid = 0;
    for (const index of picked) {
      const size = units(recipe.slices[index]);
      box(c, trayX + laid * segment, 174, size * segment - 2, 40, sliceColors[index]);
      laid += size;
    }
    box(c, trayX + units(recipe.target) * segment - 1, 104, 2, 109, '#e4f1da');

    for (let index = 0; index < recipe.slices.length; index++) {
      const x = 25 + index * 191;
      const active = picked.includes(index);
      box(c, x, 264, 178, 124, active ? '#496650' : '#304a3d');
      box(c, x + 9, 273, 160, 31, '#192d29');
      box(c, x + 9, 273, 160 * units(recipe.slices[index]) / whole, 31, sliceColors[index]);
      text(c, fraction(recipe.slices[index]), x + 89, 342, 28, paper, 'center');
      text(c, (index + 1) + (active ? ' · On tray' : ' · Add slice'), x + 89, 369, 16, mint, 'center');
    }
    text(c, 'Match the order before you serve.', width / 2, 427, 17, mint, 'center');
  }

  reset();
  return {
    title: 'Fraction Kitchen',
    instructions: 'Use each slice once to match the order. Tap the slice cards or press 1–4 to add or remove a slice. Press Enter or Serve order to check your tray.',
    controls: [['Slice 1', 'slice1'], ['Slice 2', 'slice2'], ['Slice 3', 'slice3'], ['Slice 4', 'slice4'], ['Serve order', 'serve']],
    shortcuts: { 1: 'slice1', 2: 'slice2', 3: 'slice3', 4: 'slice4' },
    enterAction: 'serve',
    announceHud: true,
    resetLabel: 'Clear tray',
    nextLabel: 'Next order',
    draw,
    input(action) {
      if (served) return;
      if (action === 'serve') check();
      else if (/^slice[1-4]$/.test(action)) select(Number(action.at(-1)) - 1);
    },
    point(x, y) {
      if (served || y < 264 || y > 388 || x < 25 || (x - 25) % 191 > 178) return;
      const index = Math.floor((x - 25) / 191);
      if (index < recipe.slices.length) select(index);
    },
    hud() {
      const choices = recipe.slices.map((slice, index) =>
        (index + 1) + ' is ' + fraction(slice) + (picked.includes(index) ? ' on the tray' : '')
      ).join(', ');
      return 'Order ' + (level + 1) + ' of ' + orders.length + ' · Match ' + fraction(recipe.target) +
        ' · Tray ' + simplify(total(), whole) + ' · Slices ' + choices + (served ? '' : ' · ' + note);
    },
    done: () => served,
    message: () => level === orders.length - 1 ? 'All four orders served!' : 'Order served!',
    reset,
    canNext: () => served && level < orders.length - 1,
    next() {
      if (served && level < orders.length - 1) {
        level++;
        reset();
      }
    },
  };
}

const deliveries = [
  { name: 'Library drop', clue: ['Set the clock', 'to 4:30.'], start: 180, target: 270 },
  { name: 'Garden post', clue: ['Arrive at quarter', 'past nine.'], start: 485, target: 555 },
  { name: 'Station mail', clue: ['Arrive at quarter', 'to seven.'], start: 375, target: 405 },
  { name: 'Tower parcel', clue: ['Deliver 25 minutes', 'after 10:15.'], start: 620, target: 640 },
  { name: 'Museum delivery', clue: ['Arrive 15 minutes', 'before 12:05.'], start: 15, target: 710 },
];
const clock = { x: 281, y: 228, radius: 159 };
const minuteChanges = { up: 60, down: -60, left: -5, right: 5 };

function hand(c, value, divisions, radius, color, weight) {
  const angle = value / divisions * Math.PI * 2 - Math.PI / 2;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineWidth = weight;
  c.beginPath();
  c.moveTo(clock.x, clock.y);
  c.lineTo(clock.x + Math.cos(angle) * radius, clock.y + Math.sin(angle) * radius);
  c.stroke();
}

export function createClockCourier() {
  let level = 0;
  let delivery, reading, sent, note;

  function reset() {
    delivery = deliveries[level];
    reading = delivery.start;
    sent = false;
    note = 'Set the hands to open the post box.';
  }

  function displayTime() {
    return (Math.floor(reading / 60) || 12) + ':' + String(reading % 60).padStart(2, '0');
  }

  function setTime(value) {
    reading = (value + 720) % 720;
    note = 'Clock adjusted.';
  }

  function check() {
    if (reading === delivery.target) sent = true;
    else if (reading % 60 !== delivery.target % 60) note = 'Check the minute hand against the clue.';
    else note = 'The minutes match. Check the hour hand.';
  }

  function draw(c) {
    box(c, 0, 0, width, height, '#252942');
    box(c, 28, 55, 493, 346, '#1d263d');
    box(c, 548, 55, 225, 346, '#34394f');
    text(c, 'CLOCK COURIER', 28, 36, 22, gold, 'left', 800);
    text(c, 'STOP ' + (level + 1) + ' / ' + deliveries.length, 771, 36, 16, paper, 'right');

    disc(c, clock.x, clock.y, clock.radius, '#be825c');
    disc(c, clock.x, clock.y, clock.radius - 6, '#f0dfb2');
    disc(c, clock.x, clock.y, 115, '#faf1d5');
    for (let tick = 0; tick < 60; tick++) {
      const angle = tick / 60 * Math.PI * 2 - Math.PI / 2;
      const major = tick % 5 === 0;
      const x = clock.x + Math.cos(angle) * (major ? 132 : 141);
      const y = clock.y + Math.sin(angle) * (major ? 132 : 141);
      disc(c, x, y, major ? 4 : 1.4, '#614637');
      if (major) {
        const hour = tick / 5 || 12;
        text(c, hour, clock.x + Math.cos(angle) * 96, clock.y + Math.sin(angle) * 96 + 7,
          22, '#203647', 'center', 750);
      }
    }
    hand(c, reading / 60, 12, 67, '#334c69', 11);
    hand(c, reading % 60, 60, 114, '#a54e35', 7);
    disc(c, clock.x, clock.y, 9, '#473d47');
    disc(c, clock.x, clock.y, 4, gold);

    text(c, delivery.name, 569, 96, 20, gold, 'left', 750);
    box(c, 569, 119, 182, 1, '#606176');
    delivery.clue.forEach((line, index) => text(c, line, 569, 155 + index * 25, 19));
    text(c, 'CLOCK SET TO', 569, 247, 14, '#d3c6ab');
    text(c, displayTime(), 569, 291, 37, paper, 'left', 750);
    text(c, 'Short hand shows hours', 569, 342, 15, paper);
    text(c, 'Long hand shows minutes', 569, 368, 15, paper);
    text(c, 'Match the delivery clue to unlock the post box.', width / 2, 429, 16, gold, 'center');
  }

  reset();
  return {
    title: 'Clock Courier',
    instructions: 'Up and Down move the clock one hour. Left and Right change it by five minutes. You can also tap the inner hour numbers or outer five-minute marks. Press Enter or Deliver parcel to check the time.',
    controls: [['Hour earlier', 'down'], ['Hour later', 'up'], ['Five minutes earlier', 'left'], ['Five minutes later', 'right'], ['Deliver parcel', 'deliver']],
    enterAction: 'deliver',
    announceHud: true,
    resetLabel: 'Reset clock',
    nextLabel: 'Next stop',
    draw,
    input(action) {
      if (sent) return;
      if (action === 'deliver') check();
      else if (Object.hasOwn(minuteChanges, action)) setTime(reading + minuteChanges[action]);
    },
    point(x, y) {
      if (sent) return;
      const dx = x - clock.x;
      const dy = y - clock.y;
      const radius = Math.hypot(dx, dy);
      if (radius < 58 || radius > clock.radius) return;
      const mark = Math.round(Math.atan2(dx, -dy) / (Math.PI / 6) + 12) % 12;
      if (radius < 116) setTime(mark * 60 + reading % 60);
      else setTime(reading - reading % 60 + mark * 5);
    },
    hud() {
      return 'Stop ' + (level + 1) + ' of ' + deliveries.length + ' · ' + delivery.name + ' · ' +
        delivery.clue.join(' ') + ' · Clock set to ' + displayTime() + (sent ? '' : ' · ' + note);
    },
    done: () => sent,
    message: () => level === deliveries.length - 1 ? 'All five deliveries made!' : 'Parcel delivered!',
    reset,
    canNext: () => sent && level < deliveries.length - 1,
    next() {
      if (sent && level < deliveries.length - 1) {
        level++;
        reset();
      }
    },
  };
}
