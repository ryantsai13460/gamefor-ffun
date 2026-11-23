import * as THREE from './vendor/three/three.module.min.js';

const slate = ['#4c6267', '#3e515b', '#617676', '#526a70', '#708182'];
const metal = '#b29b70';
const deepStone = '#333f4d';
const jade = '#88e9cf';
const gold = '#f8d78b';
const bands = 10;
const profiles = [
  [5.65, 3.45, 4.08], [3.75, 3.54, 4.48], [1.55, 4.30, 5.16],
  [-1.62, 4.40, 5.35], [-3.93, 4.16, 4.75], [-5.05, 3.76, 4.24]
];

function makeGroup(parent, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function shellPoint(profileIndex, division) {
  const [z, width, height] = profiles[profileIndex];
  const angle = Math.PI * division / bands;
  const drift = Math.sin(profileIndex * 5.1 + division * 2.1);
  return [Math.cos(angle) * (width + .14 * drift),
    .13 + Math.sin(angle) * (height + drift * .21), z + Math.sin(division * 2.8) * .19];
}

function buildShell(parent, first, last) {
  const positions = [];
  const colors = [];
  const tint = new THREE.Color();
  for (let row = 0; row < profiles.length - 1; row++) {
    for (let column = first; column < last; column++) {
      const a = shellPoint(row, column);
      const b = shellPoint(row + 1, column);
      const c = shellPoint(row, column + 1);
      const d = shellPoint(row + 1, column + 1);
      positions.push(...a, ...b, ...c, ...c, ...b, ...d);
      for (const delta of [0, 2]) {
        tint.set(slate[(row * 3 + column + delta) % slate.length]);
        for (let point = 0; point < 3; point++) colors.push(tint.r, tint.g, tint.b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(geometry, material);
  shell.receiveShadow = true;
  shell.castShadow = true;
  parent.add(shell);
}

function crystals(group, kit, x, z, size, turn, color) {
  const { mesh, paint } = kit;
  const seam = paint(color, .57, .15);
  mesh(group, 'facet', deepStone, x, .14, z, size * .46, .23, size * .42, [0, turn, 0]);
  for (const [dx, dz, width, h, lean] of [
    [0, 0, .25, 1.03, -.12], [-.26, .09, .16, .68, .22], [.23, -.11, .14, .52, -.26]
  ]) {
    mesh(group, 'gem', seam, x + dx * size, h * size * .53, z + dz * size, width * size,
      h * size, width * size * .88, [lean, turn + dx, lean * .7]);
  }
  mesh(group, 'disc', new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .15, depthWrite: false
  }), x, .028, z, size * .79, 1, size * .73);
}

function altar(parent, kit) {
  const { mesh, paint } = kit;
  const shrine = makeGroup(parent);
  mesh(shrine, 'beam', '#48535a', 0, .12, 0, 1.50, .24, 1.38);
  mesh(shrine, 'beam', '#6b7a7f', 0, .31, 0, 1.32, .18, 1.22);
  mesh(shrine, 'beam', deepStone, 0, .56, 0, .82, .43, .78);
  mesh(shrine, 'beam', metal, 0, .77, 0, .72, .10, .68);
  mesh(shrine, 'beam', '#738a8c', 0, .88, 0, .67, .18, .62);
  mesh(shrine, 'ring', paint(jade, .25, .25), 0, .976, 0, .44, .44, .44, [Math.PI / 2, 0, 0]);
  const relic = makeGroup(shrine, 0, 1.62, 0);
  mesh(relic, 'gem', paint(jade, .52, .28), 0, 0, 0, .43, .67, .40);
  mesh(relic, 'ring', paint(gold, .25, .26), 0, .07, 0, .64, .64, .64, [Math.PI * .44, .18, 0]);
  mesh(relic, 'ring', paint('#acd7cf', .21, .19), 0, -.05, 0, .66, .66, .66, [Math.PI * .62, .68, 0]);
  return { shrine, relic };
}

function caveEgg(parent, kit, origin, egg, label) {
  if (!egg) return null;
  const { mesh, paint } = kit;
  const local = { x: 2.55, z: -1.4 };
  const group = makeGroup(parent, local.x, 0, local.z);
  mesh(group, 'beam', '#48585d', 0, .18, 0, .85, .36, .85);
  mesh(group, 'beam', '#b39a70', 0, .38, 0, .76, .13, .76);
  mesh(group, 'ring', paint('#dcb486', .20), 0, .48, 0, .55, .55, .55, [Math.PI / 2, 0, 0]);
  mesh(group, 'round', paint(egg.color || '#e59b6f', .14, .23), 0, .92, 0, .34, .51, .36, [-.07, 0, -.18]);
  for (const [x, y, z, tilt] of [
    [-.18, .71, .30, -.21], [.17, 1.05, .24, .12], [-.11, 1.19, .22, .34],
    [.19, .87, -.26, -.31], [-.18, 1.04, -.25, .34]
  ]) mesh(group, 'gem', paint('#f3d7aa', .47, .18), x, y, z, .087, .16, .067, [0, 0, tilt]);
  label(group, 'Ember Geode', '#ebc695', 1.65).position.x = -.48;
  return { type: 'egg', id: egg.id, label: egg.name, x: origin.x + local.x, z: origin.z + local.z, group };
}

export function createRebirthCave(parent, kit, { origin, egg, label, batch }) {
  const { mesh, paint } = kit;
  const cave = makeGroup(parent, origin.x, 0, origin.z);
  const canopy = makeGroup(cave);
  const foundation = makeGroup(cave);
  buildShell(foundation, 0, 2);
  buildShell(foundation, bands - 2, bands);
  buildShell(canopy, 2, bands - 2);
  mesh(foundation, 'box', deepStone, 0, .97, -4.93, 7.19, 2.01, .49);
  mesh(canopy, 'facet', '#798b86', -.94, 3.88, -2.84, 4.76, 2.84, 3.13, [.16, -.44, .03]);
  mesh(canopy, 'facet', '#697d77', 1.38, 4.19, -.11, 3.07, 2.56, 3.23, [.16, .42, -.41]);
  mesh(canopy, 'facet', '#7f8b77', .36, 4.21, 2.1, 3.14, 1.58, 2.95, [.11, -.35, -.14]);
  for (const [x, y, z, sx, sy, sz, turn] of [
    [-3.93, 1.28, 3.65, 1.63, 1.87, 1.81, -.40], [4.05, 1.26, 3.7, 1.52, 1.76, 1.66, .44],
    [-4.35, 1.29, .37, 1.35, 1.94, 2.18, .12], [4.40, 1.31, -.01, 1.45, 1.83, 2.39, .34],
    [-4.2, .94, -2.72, 1.65, 1.67, 1.74, .5], [4.17, .89, -2.8, 1.65, 1.6, 2.00, -.12],
    [-2.61, 1.18, -4.85, 1.49, 1.88, 1.11, .22], [2.62, 1.19, -4.7, 1.47, 1.99, 1.2, -.28]
  ]) mesh(foundation, 'facet', '#677d77', x, y, z, sx, sy, sz, [.11, turn, .13]).castShadow = true;

  const floor = makeGroup(cave);
  mesh(floor, 'box', '#536778', 0, .027, .16, 6.53, .07, 9.53);
  mesh(floor, 'disc', '#415662', 0, .073, -.18, 3.33, 1, 3.15);
  mesh(floor, 'ring', paint('#749b95', .06), 0, .082, -.18, 2.54, 2.54, .32, [Math.PI / 2, 0, 0]);
  mesh(floor, 'ring', paint(metal, .07, .16), 0, .087, -.18, 1.94, 1.94, .27, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const z = 5.46 - i * .51;
    mesh(floor, 'box', i % 2 ? '#87978e' : '#95a197', 0, .092, z, 3.26 - i * .08, .07, .46);
    for (const side of [-1, 1]) {
      mesh(floor, 'box', '#a99d78', side * (1.65 - i * .055), .112, z, .105, .095, .48);
      if (!(i % 2)) mesh(floor, 'gem', paint(gold, .36), side * 1.87, .17, z, .10, .17, .1);
    }
  }
  for (let index = 0; index < 8; index++) {
    const angle = Math.PI * index / 4;
    mesh(floor, 'box', metal, Math.sin(angle) * 2.21, .097,
      Math.cos(angle) * 2.21 - .18, .19, .021, .47, [0, angle, 0]);
  }

  const gate = makeGroup(cave, 0, 0, 4.68);
  for (const side of [-1, 1]) {
    mesh(gate, 'beam', '#76898a', side * 2.83, 1.17, -.09, .34, 2.33, .42);
    mesh(gate, 'box', '#929e93', side * 2.83, .16, -.09, .85, .28, .78);
    mesh(gate, 'box', metal, side * 2.83, 2.15, .056, .77, .15, .29);
    mesh(gate, 'gem', paint(gold, .4, .09), side * 2.84, 1.58, .36, .13, .29, .144);
  }
  // The arch geometry is thin so the trail camera can look into the chamber.
  const arc = new THREE.Mesh(new THREE.TorusGeometry(2.83, .22, 6, 20, Math.PI),
    paint('#8b9c90', 0, .08));
  arc.position.set(0, 2.21, 4.59);
  // Keep the tip of the constructed opening low enough to fit the natural rock shell.
  arc.scale.y = .65;
  canopy.add(arc);
  const lintel = makeGroup(canopy, 0, 3.98, 4.83);
  mesh(lintel, 'gem', paint(gold, .25, .25), 0, 0, 0, .31, .38, .15, [0, 0, Math.PI / 4]);
  label(lintel, 'Rebirth Cave', '#bde8ce', 1.11);

  const minerals = makeGroup(cave);
  for (const [x, z, size, spin, color] of [
    [-3.12, 2.5, 1.13, .1, jade], [3.08, 2.15, 1.10, .67, '#90c8e8'],
    [-3.0, -.1, 1.32, .45, '#8cdce4'], [-3.12, -2.5, 1.37, -.80, jade],
    [3.10, -3.48, 1.55, .35, '#bdc8fb'], [-1.38, -4.10, 1.32, -.73, '#9bd3eb'],
    [1.24, -4.13, 1.23, -.25, '#a0e5d0']
  ]) crystals(minerals, kit, x, z, size, spin, color);

  const carving = makeGroup(cave, 0, 1.65, -4.65);
  mesh(carving, 'box', '#41515b', 0, 0, -.04, 1.22, 1.30, .16, [0, 0, Math.PI / 4]);
  mesh(carving, 'ring', paint('#86b7b8', .17), 0, 0, .052, .58, .58, .32);
  mesh(carving, 'gem', paint('#ade5c9', .32), 0, 0, .13, .19, .32, .07);
  for (const side of [-1, 1]) {
    mesh(carving, 'box', metal, side * .915, -.15, .037, .22, .042, .052, [0, 0, side * .55]);
    mesh(carving, 'box', metal, side * .924, .14, .037, .18, .038, .052, [0, 0, -side * .53]);
  }

  // Sparse rock teeth hang back from the arch. The cutaway removes them along with the roof.
  for (const [x, z, h, turn] of [[-2.26, 3, .97, .20], [-2.35, .23, 1.22, .36], [2.18, -.20, 1.11, .42],
    [-1.71, -3.22, .84, .76], [1.61, -2.45, .91, 1.00]]) {
    mesh(canopy, 'cone', '#667778', x, 3.76, z, .32, h, .37, [Math.PI, turn, .08]);
  }

  const { shrine, relic } = altar(cave, kit);
  label(shrine, 'Rebirth Altar', jade, 3.12);
  const eggTarget = caveEgg(cave, kit, origin, egg, label);
  for (const group of [foundation, canopy, floor, gate, minerals, shrine]) batch(group);
  const targets = [{ type: 'rebirth', id: 'rebirth', label: 'Rebirth Altar', x: origin.x, z: origin.z, group: shrine }];
  if (eggTarget) targets.push(eggTarget);

  const obstacles = [{ x: origin.x, z: origin.z, radius: .94 }];
  if (eggTarget) obstacles.push({ x: eggTarget.x, z: eggTarget.z, radius: .48 });
  for (const side of [-1, 1]) {
    for (const localZ of [-3.88, -2.28, -.68, .92, 2.52, 4.06]) {
      // A broad clear middle keeps the threshold walkable from the southeast trail.
      obstacles.push({ x: origin.x + side * (localZ > 2.4 ? 3.38 : 3.85), z: origin.z + localZ, radius: .91 });
    }
    obstacles.push({ x: origin.x + side * 2.68, z: origin.z + 4.63, radius: .39 });
  }
  for (const localX of [-3.1, -1.55, 0, 1.55, 3.1]) obstacles.push({ x: origin.x + localX, z: origin.z - 4.88, radius: .89 });

  function contains({ x, z }) {
    return Math.abs(x - origin.x) < 4.08 && z > origin.z - 5.02 && z < origin.z + 5.52;
  }
  return {
    targets, obstacles, contains, waitingArea: { x: origin.x + 5.25, z: origin.z + 8.6 },
    occupies(x, z, padding = 0) {
      return Math.abs(x - origin.x) < 5.6 + padding && z > origin.z - 5.5 - padding && z < origin.z + 6.5 + padding;
    },
    update(position, { reducedMotion = false } = {}) {
      canopy.visible = !contains(position);
      const time = performance.now() / 1000;
      relic.position.y = reducedMotion ? 1.62 : 1.62 + Math.sin(time * 2.1) * .12;
      relic.rotation.y = reducedMotion ? 0 : time * .52;
    }
  };
}

function carvedBoard() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const pen = canvas.getContext('2d');
  pen.fillStyle = '#203b3b';
  pen.fillRect(0, 0, 768, 384);
  pen.strokeStyle = '#adab79';
  pen.lineWidth = 6;
  pen.beginPath();
  pen.roundRect(18, 17, 732, 348, 20);
  pen.stroke();
  pen.fillStyle = '#f6e7bd';
  pen.textAlign = 'center';
  pen.font = '700 72px Georgia';
  pen.fillText('Meadow', 384, 140);
  pen.fillText('Leaderboard', 384, 233);
  pen.fillStyle = '#b5d6bb';
  pen.font = '600 25px system-ui';
  pen.fillText('Collections · Discoveries · Rebirths', 384, 312);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

export function createLeaderboardPavilion(parent, kit, { label, batch }) {
  const { mesh, paint } = kit;
  const x = 8.8;
  const z = 14.6;
  const group = makeGroup(parent, x, 0, z - 1.25);
  group.rotation.y = -.28;
  const green = '#55766b';
  const sand = '#d7bf96';
  mesh(group, 'beam', '#9a9b80', 0, .089, .22, 3.30, .178, 2.38);
  mesh(group, 'beam', '#d6c5a1', 0, .177, .24, 2.98, .12, 2.16);
  mesh(group, 'box', '#a69172', 0, 1.73, -.37, 3.39, 1.73, .23);
  mesh(group, 'box', '#e5c79b', 0, 1.70, -.21, 3.24, 1.62, .19);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.16, 1.54), carvedBoard());
  plaque.position.set(0, 1.70, -.102);
  group.add(plaque);
  const canopy = mesh(group, 'cone', green, 0, 3.29, -.21, 2.79, .93, 1.88, [0, Math.PI / 4, 0]);
  canopy.castShadow = true;
  mesh(group, 'box', green, 0, 2.81, -.21, 4.07, .20, 2.31);
  mesh(group, 'beam', '#b8976d', 0, 3.79, -.21, .23, .55, .23);
  mesh(group, 'gem', paint(gold, .2), 0, 4.14, -.21, .28, .36, .28, [0, -.38, .15]);
  for (const side of [-1, 1]) {
    mesh(group, 'beam', '#786b59', side * 1.77, 1.56, -.28, .21, 2.85, .24);
    mesh(group, 'box', sand, side * 1.77, .38, -.27, .59, .34, .59);
    mesh(group, 'box', sand, side * 1.77, 2.41, -.27, .53, .16, .50);
    mesh(group, 'box', '#6f6d56', side * 1.79, 2.31, -.02, .27, .13, .48);
    mesh(group, 'box', paint('#f5ca80', .35), side * 1.79, 2.08, .12, .20, .34, .20);
    mesh(group, 'beam', '#776956', side * 1.79, 1.90, .12, .157, .11, .16);
    mesh(group, 'facet', '#55796a', side * 2.71, .29, .82, .46, .59, .43);
  }
  label(group, 'Leaderboard', '#d3dcad', 4.66);
  batch(group);
  return {
    target: { type: 'leaderboard', id: 'leaderboard', label: 'Leaderboard', x, z, group },
    obstacles: [{ x: x - 1.74, z: z - 1.09, radius: .34 }, { x: x + 1.61, z: z - 2.08, radius: .34 },
      { x, z: z - 1.61, radius: .63 }]
  };
}
