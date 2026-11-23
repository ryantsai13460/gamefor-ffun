import * as THREE from './vendor/three/three.module.min.js';
import { EXPEDITION_BIOMES, EXPEDITION_STATION_RADIUS } from './biomes.js?v=20261123-4';

const TAU = Math.PI * 2;

export const BIOME_LIGHT = Object.freeze({
  glasswater: { sky: '#6fbbcf', horizon: '#d0eedf', fog: '#b9e4dc', ambient: '#e4fff3', sunlight: '#fff0d1' },
  frostpine: { sky: '#8fb7df', horizon: '#ebeefa', fog: '#d5e6fa', ambient: '#e4f0ff', sunlight: '#e7f1ff' },
  cinderbloom: { sky: '#a38ab1', horizon: '#ffd5a6', fog: '#e4baa4', ambient: '#ffe5c6', sunlight: '#ffcfa9' }
});

const palettes = {
  glasswater: { land: '#e5d3a6', edge: '#94b6a0', shelf: '#5b969b', road: '#faf0c7',
    marker: '#9df3e5', pillar: '#527c79', trim: '#b4d5bd', base: '#b69e79' },
  frostpine: { land: '#e4eef7', edge: '#a7bcd3', shelf: '#758ba4', road: '#a9cfd9',
    marker: '#d9edff', pillar: '#57748a', trim: '#aec4dc', base: '#b0cad6' },
  cinderbloom: { land: '#685367', edge: '#514c60', shelf: '#443c53', road: '#8b656a',
    marker: '#ffc681', pillar: '#3e4054', trim: '#a27c76', base: '#88707e' }
};

const approaches = {
  glasswater: [[22.3, 9.1], [26.1, 9.75], [31, 11], [37, 10.9], [42.0, 11.5]],
  frostpine: [[6, -20.8], [5.35, -25], [3, -30], [3.15, -35], [2.5, -40.8]],
  cinderbloom: [[-24.1, 7.2], [-27.1, 6.2], [-31, 5], [-36.2, 5.1], [-42.2, 4.5]]
};

function circle(ground, r, color, x, z, y, stretch = 1, rotation = 0) {
  const patch = ground(new THREE.CircleGeometry(r, 28), color, x, y, z);
  patch.rotation.set(-Math.PI / 2, 0, rotation);
  patch.scale.y = stretch;
  return patch;
}

function gateAt(biome, palette, groupAt, label, batch, kit, obstacles) {
  const { mesh, paint } = kit;
  const gate = groupAt(biome.entry.x, 0, biome.entry.z);
  const yaw = Math.atan2(biome.entry.x - biome.x, biome.entry.z - biome.z);
  gate.rotation.y = yaw;
  for (const side of [-1, 1]) {
    const x = side * 2.1;
    mesh(gate, 'beam', palette.pillar, x, .19, 0, 1, .38, .96);
    mesh(gate, 'beam', palette.trim, x, .46, 0, .76, .19, .73);
    mesh(gate, 'beam', palette.pillar, x, 1.55, 0, .56, 2.06, .56);
    mesh(gate, 'beam', palette.trim, x, 2.58, 0, .79, .29, .74);
    mesh(gate, 'gem', paint(palette.marker, .22, .16), x, 2.92, 0, .33, .5, .33);
    obstacles.push({ x: biome.entry.x + x * Math.cos(yaw), z: biome.entry.z - x * Math.sin(yaw), radius: .47 });
  }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(2.1, .16, 6, 22, Math.PI), paint(palette.trim));
  arc.position.y = 2.47;
  gate.add(arc);
  const inset = new THREE.Mesh(new THREE.TorusGeometry(1.99, .065, 6, 22, Math.PI), paint(palette.marker, .20));
  inset.position.y = 2.47;
  inset.position.z = .12;
  gate.add(inset);
  mesh(gate, 'gem', paint(palette.marker, .28, .15), 0, 4.67, .03, .4, .55, .4, [0, Math.PI / 6, 0]);
  batch(gate);
  const open = label(gate, biome.label, palette.marker, 5.24);
  const reason = biome.rebirths ? `Level ${biome.level} · Rebirth ${biome.rebirths}` : `Opens at Level ${biome.level}`;
  const locked = label(gate, biome.label, '#ffd1a1', 5.24, reason);
  const barrier = new THREE.Group();
  gate.add(barrier);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.62, 2.45), new THREE.MeshBasicMaterial({
    color: palette.marker, transparent: true, opacity: .31, depthWrite: false, side: THREE.DoubleSide
  }));
  veil.position.set(0, 1.3, .05);
  barrier.add(veil);
  for (let i = -3; i <= 3; i++) {
    mesh(barrier, 'beam', paint(palette.marker, .48), i * .49, 1.26, .10, .044, 2.49, .044);
  }
  batch(barrier);
  open.visible = false;
  return { open, locked, barrier, gate };
}

function nursery(biome, palette, egg, kit, groupAt, label, batch) {
  const { mesh, paint } = kit;
  const group = groupAt(biome.egg.x, 0, biome.egg.z);
  mesh(group, 'beam', palette.base, 0, .19, 0, 1.66, .38, 1.66, [0, Math.PI / 4, 0]);
  mesh(group, 'beam', palette.trim, 0, .42, 0, 1.38, .17, 1.38, [0, Math.PI / 4, 0]);
  mesh(group, 'beam', palette.pillar, 0, .65, 0, .71, .32, .71);
  const shell = mesh(group, 'round', paint(egg.color, .14, .25), 0, 1.35, 0, .54, .76, .52, [0, .25, .19]);
  shell.castShadow = true;
  for (let index = 0; index < 7; index++) {
    const angle = index * TAU / 7;
    const y = 1.35 + .19 * Math.cos(index * 2);
    mesh(group, 'gem', palette.marker, Math.sin(angle) * .50, y, Math.cos(angle) * .49,
      .13, .15, .10, [0, angle, .24]);
  }
  for (let index = 0; index < 4; index++) {
    const angle = .77 + index * TAU / 4;
    const x = Math.cos(angle) * .85;
    const z = Math.sin(angle) * .85;
    mesh(group, 'gem', paint(palette.marker, .31), x, .62, z, .13, .22, .13);
  }
  label(group, egg.name, palette.marker, 2.55);
  batch(group);
  return { type: 'egg', id: egg.id, areaId: biome.id, label: egg.name, x: biome.egg.x, z: biome.egg.z,
    radius: EXPEDITION_STATION_RADIUS, group };
}

function coast(biome, group, kit, ground) {
  const { mesh, paint } = kit;
  circle(ground, 8.0, '#87c9c1', 49.35, 10.8, .027, 1.24, -.12);
  circle(ground, 7.15, '#64bbae', 50.75, 10.95, .037, 1.19, -.12);
  circle(ground, 5.2, '#51aaac', 51.75, 11.45, .043, 1.22, -.18);
  const rocks = ['#809e94', '#9ab4a4', '#beccb2'];
  for (let i = 0; i <= 5; i++) {
    const angle = (i / 11) * TAU;
    const x = 51.2 - biome.x + Math.cos(angle) * .12;
    const z = 7.4 - biome.z + Math.cos(angle) * 2.37;
    const y = Math.sin(angle) * 3.1;
    mesh(group, 'facet', rocks[i % rocks.length], x, y + 1, z, 1.22, 1.45, 1.24,
      [i * .29, angle, i * .21]);
  }
  for (const z of [5.2, 9.6]) {
    mesh(group, 'facet', '#6c918a', 51.2 - biome.x, .83, z - biome.z, 1.28, 1.72, 1.23, [.10, z, .06]);
  }
  for (let i = 0; i < 16; i++) {
    const x = 3.4 + (i % 4) * 1.08;
    const z = 7.2 + Math.floor(i / 4) * .71;
    const y = .23 + (i % 3) * .11;
    mesh(group, 'beam', '#a86e7b', x, y, z, .105, y * 2, .08, [.15, i, -.14]);
    mesh(group, 'round', paint(i % 2 ? '#e2a38c' : '#bd7991', .10), x, y * 1.85, z, .19, .25, .14);
  }
  for (let i = 0; i < 17; i++) {
    const angle = .32 + i * 2.399;
    const radius = 10.2 + (i % 3) * .43;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    mesh(group, 'facet', rocks[i % rocks.length], x, .22, z, .38 + i % 3 * .16, .44, .43, [.22, angle, .1]);
    if (i % 2) mesh(group, 'round', '#fff0d1', x + .39, .13, z + .37, .38, .18, .28, [.15, angle, .26]);
  }
}

function frost(biome, group, kit, ground) {
  const { mesh } = kit;
  circle(ground, 4.8, '#cfe4f2', biome.x + .9, biome.z + 1.8, .030, .61, -.55);
  circle(ground, 3.8, '#9abfda', biome.x + 1.0, biome.z + 1.6, .034, .62, -.55);
  circle(ground, 3.42, '#b1d4ed', biome.x + 1.12, biome.z + 1.67, .038, .58, -.55);
  for (let i = 0; i < 15; i++) {
    const angle = .58 + (i / 15) * TAU;
    const r = 10.2 + i % 3 * .57;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (z > 0 && Math.abs(x) < 5.2) continue;
    const size = .81 + i % 4 * .16;
    mesh(group, 'beam', '#82929c', x, size * .82, z, .22, size * 1.64, .22);
    for (let crown = 0; crown < 3; crown++) {
      const breadth = size * (1.95 - .44 * crown);
      mesh(group, 'cone', ['#416e76', '#568a94', '#79a5ac'][crown], x, size * (1.61 + .70 * crown),
        z, breadth, size * 1.37, breadth, [0, i + crown, .025]);
      mesh(group, 'cone', '#d9ebf6', x, size * (1.97 + .70 * crown), z, breadth * .77, size * .83,
        breadth * .77, [0, i + crown, .025]);
    }
  }
  const peaks = [[-4.25, -8.45, 4.5], [-.7, -10.15, 5.9], [2.55, -10.3, 7.35], [4.9, -9.9, 5.6]];
  for (const [x, z, height] of peaks) {
    mesh(group, 'facet', '#839eb8', x, height * .40, z, 2.87, height, 2.12, [.08, x, -.1]);
    mesh(group, 'facet', '#dcecf6', x - .09, height * .75, z, 1.70, height * .53, 1.34, [.08, x, -.1]);
  }
}

function cinder(biome, group, kit, ground, path) {
  const { mesh, paint } = kit;
  const upperFlow = [[-54, -1.6], [-52, -2.9], [-47.75, -2.4], [-46, -.5], [-47.5, 1.0]];
  path(upperFlow, 2.38, '#7e4d5e', .038);
  path(upperFlow, 1.47, '#f08b61', .045);
  path(upperFlow, .57, '#f5b078', .051);
  const lowerFlow = [[-49.8, 15], [-46.5, 12.2], [-43, 13.8], [-39.6, 13.0], [-36.9, 10.9]];
  path(lowerFlow, 1.92, '#855764', .041);
  path(lowerFlow, .91, '#ed8f63', .049);
  circle(ground, 3.78, '#4f4556', -49, -3.1, .027, .87, .29);
  circle(ground, 2.62, '#884e59', -49, -3.1, .033, .88, .29);
  circle(ground, 1.64, '#e48d66', -49, -3.1, .040, .84, .29);
  for (let i = 0; i < 12; i++) {
    const angle = i * TAU / 12;
    const x = -49 - biome.x + Math.cos(angle) * 2.25;
    const z = -3.1 - biome.z + Math.sin(angle) * 1.9;
    const height = 1.6 + i % 3 * .47;
    mesh(group, 'beam', i % 2 ? '#574758' : '#4d4556', x, height * .50, z, .79, height, .84, [.1, angle, -.14]);
    mesh(group, 'facet', '#706072', x - .08, height * .86, z + .1, .93, .79, .67, [.2, angle, .13]);
    if (i % 3 === 1) mesh(group, 'gem', paint('#f8b37c', .27), x, height + .14, z, .32, .47, .29, [0, angle, -.29]);
  }
  for (let i = 0; i < 16; i++) {
    const angle = .53 + i * TAU / 16;
    const r = 10.7 + i % 3 * .45;
    const x = Math.sin(angle) * r;
    const z = Math.cos(angle) * r;
    const height = .72 + i % 5 * .45;
    mesh(group, 'facet', i % 2 ? '#575064' : '#756878', x, height * .5, z, .89, height, .92, [.16, angle, -.16]);
    if (i % 4 === 0) mesh(group, 'gem', paint('#f5a261', .26), x + .47, .50, z, .23, .69, .24, [.18, angle, -.32]);
  }
}

export function createExpeditionTerrain(kit, { groupAt, ground, label, path, batch, sites, eggs }) {
  const interactables = [];
  const obstacles = [];
  const fieldViews = new Map();
  for (const biome of EXPEDITION_BIOMES) {
    const palette = palettes[biome.id];
    const group = groupAt(biome.x, 0, biome.z);
    ground(new THREE.CylinderGeometry(14.5, 13.0, .65, 30), palette.land, biome.x, -.31, biome.z);
    ground(new THREE.CylinderGeometry(14.1, 11.1, 3.4, 28), palette.edge, biome.x, -2.21, biome.z);
    ground(new THREE.CylinderGeometry(11.2, 7.8, 4.25, 24), palette.shelf, biome.x, -6.02, biome.z);
    for (const [dx, dz, r, stretch] of [[2, 2.2, 5.13, .72], [-4.18, -1.0, 4.61, .61], [-.8, 5.5, 4.1, .66]]) {
      circle(ground, r, palette.trim, biome.x + dx, biome.z + dz, .019, stretch, dx * .32);
    }
    const approach = approaches[biome.id];
    path(approach, 2.65, palette.road, .057);
    path([[biome.x, biome.z], [biome.x * .42 + biome.egg.x * .58, biome.z * .42 + biome.egg.z * .58],
      [biome.egg.x, biome.egg.z]], 1.65, palette.road, .058);
    for (const site of sites.filter(entry => entry.areaId === biome.id)) {
      circle(ground, 1.40, palette.base, site.x, site.z, .066, .81, site.x * .23);
    }
    fieldViews.set(biome.id, gateAt(biome, palette, groupAt, label, batch, kit, obstacles));
    const egg = eggs.find(item => item.id === biome.eggId);
    if (egg) {
      interactables.push(nursery(biome, palette, egg, kit, groupAt, label, batch));
      obstacles.push({ x: biome.egg.x, z: biome.egg.z, radius: .8 });
    }
    if (biome.id === 'glasswater') {
      coast(biome, group, kit, ground);
      obstacles.push({ x: 51.2, z: 5.2, radius: .82 }, { x: 51.2, z: 9.6, radius: .82 });
    } else if (biome.id === 'frostpine') {
      frost(biome, group, kit, ground);
      obstacles.push({ x: 3.2, z: -52, radius: 1.75 });
    } else {
      cinder(biome, group, kit, ground, path);
      obstacles.push({ x: -49, z: -3.1, radius: 2.15 });
    }
    batch(group);
  }
  return { interactables, obstacles, fieldViews };
}
