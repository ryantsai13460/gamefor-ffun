import * as THREE from './vendor/three/three.module.min.js';
import { createLeaderboardPavilion, createRebirthCave } from './cave.js?v=20261123-4';
import { EXPEDITION_BIOMES } from './biomes.js?v=20261123-4';
import { createExpeditionTerrain } from './expedition-art.js?v=20261123-4';
import { CRYSTAL_SITES, FARM_AREAS } from './farming.js?v=20261123-4';
import { GENERATOR_SITE } from './generator.js?v=20261123-4';
import { REBIRTH_ALTAR } from './model.js?v=20261123-4';

const TAU = Math.PI * 2;

function seededRandom(seed) {
  return function next() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function skyBackdrop(scene) {
  const geometry = new THREE.SphereGeometry(160, 20, 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      horizon: { value: new THREE.Color('#dceecb') },
      zenith: { value: new THREE.Color('#78adcf') }
    },
    vertexShader: `varying vec3 worldDirection;
      void main() {
        worldDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec3 worldDirection;
      uniform vec3 horizon;
      uniform vec3 zenith;
      void main() {
        float elevation = normalize(worldDirection).y;
        gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-0.24, 0.56, elevation)), 1.0);
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  scene.add(sky);
  return material.uniforms;
}

export function createMeadow(scene, kit, nodes, eggs) {
  const { mesh, paint, geometries } = kit;
  const world = new THREE.Group();
  scene.add(world);
  const sky = skyBackdrop(scene);
  const random = seededRandom(438217);
  const interactables = [];
  const obstacles = [];
  const nodeViews = new Map();
  const decorations = new Map();

  function groupAt(x, y, z, parent = world) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  function ground(geometry, color, x, y, z) {
    const surface = new THREE.Mesh(geometry, paint(color));
    surface.position.set(x, y, z);
    surface.receiveShadow = true;
    world.add(surface);
    return surface;
  }

  function label(parent, title, color, height, subtitle = '') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 104;
    const pen = canvas.getContext('2d');
    pen.beginPath();
    pen.roundRect(12, 8, 488, 85, 40);
    pen.fillStyle = '#203a41';
    pen.fill();
    pen.lineWidth = 5;
    pen.strokeStyle = color;
    pen.stroke();
    pen.font = `bold ${subtitle ? 31 : 40}px system-ui`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillStyle = '#fff8e6';
    pen.fillText(title, 256, subtitle ? 39 : 50, 434);
    if (subtitle) {
      pen.font = '600 23px system-ui';
      pen.fillStyle = color;
      pen.fillText(subtitle, 256, 69, 434);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.y = height;
    sprite.scale.set(Math.min(5.6, 2.05 + title.length * .153), .80, 1);
    parent.add(sprite);
    return sprite;
  }

  function path(points, width, color, height = .035) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, height, z)));
    const vertices = [];
    const indices = [];
    for (let i = 0; i <= 36; i++) {
      const p = curve.getPointAt(i / 36);
      const tangent = curve.getTangentAt(i / 36);
      const edge = width * (.49 + .07 * Math.sin(i * .49));
      vertices.push(p.x - tangent.z * edge, p.y, p.z + tangent.x * edge,
        p.x + tangent.z * edge, p.y, p.z - tangent.x * edge);
      if (i) {
        const previous = (i - 1) * 2;
        indices.push(previous, previous + 2, previous + 1, previous + 1, previous + 2, previous + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // Winding may vary on the two ends of a trail, so both sides remain visible.
    const road = ground(geometry, color, 0, 0, 0);
    road.material = paint(color).clone();
    road.material.side = THREE.DoubleSide;
  }

  function decoration(shape, color, x, y, z, sx, sy, sz, yaw = 0) {
    const key = `${shape}:${color}`;
    if (!decorations.has(key)) decorations.set(key, { shape, color, pieces: [] });
    decorations.get(key).pieces.push({ x, y, z, sx, sy, sz, yaw });
  }

  function batchPlantedMeshes(parent) {
    const groups = new Map();
    for (const child of parent.children) {
      if (!child.isMesh || child.isInstancedMesh) continue;
      const key = `${child.geometry.id}:${child.material.id}:${child.castShadow}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    }
    for (const pieces of groups.values()) {
      if (pieces.length < 2) continue;
      const batch = new THREE.InstancedMesh(pieces[0].geometry, pieces[0].material, pieces.length);
      batch.receiveShadow = true;
      batch.castShadow = pieces[0].castShadow;
      pieces.forEach((piece, index) => {
        piece.updateMatrix();
        batch.setMatrixAt(index, piece.matrix);
        parent.remove(piece);
      });
      parent.add(batch);
    }
  }

  const island = ground(new THREE.CylinderGeometry(39, 38, .62, 32), '#88b87b', 0, -.31, 0);
  island.rotation.y = .09;
  ground(new THREE.CylinderGeometry(38.5, 34, 3.2, 24), '#729479', 0, -2.15, 0);
  ground(new THREE.CylinderGeometry(34, 29, 5.5, 20), '#6f8f8d', 0, -6.48, 0);
  ground(new THREE.CylinderGeometry(29, 23, 4.7, 16), '#879e9d', 0, -11.5, 0);
  for (const [x, z, r, color] of [[-15, -8, 10, '#91bf7e'], [15, -14, 11, '#96bf81'], [13, 17, 11, '#9ac484'], [-13, 15, 11, '#81b577'], [-10, -21, 8, '#8eb872']]) {
    const patch = ground(new THREE.CircleGeometry(r, 16), color, x, .011, z);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = random() * TAU;
    patch.scale.y = .72;
  }

  path([[.4, 24], [-1.8, 18], [0, 11], [1.5, 4], [0, -3.9], [1, -11], [-2.6, -18]], 3.3, '#dbcc9d');
  path([[-25, 7], [-16, 4], [-11, 7], [-5, 5], [1.5, 4], [7.2, 8], [13.1, 11.4], [23.7, 9]], 2.8, '#ddcea0', .038);
  path([[-22, -13.3], [-19.4, -12.8], [-13, -13], [-8, -10], [0, -9], [6, -11], [13, -17], [21, -17]], 2.35, '#cdc99a', .04);
  path([[1.0, 11.24], [3.75, 12.3], [6.14, 13.62], [8.8, 14.6]], 1.94, '#e3cca5', .042);
  path([[-1.8, 18], [-6.45, 21.8], [-10.5, 24.2], [GENERATOR_SITE.x, GENERATOR_SITE.z]], 1.9, '#d6c9a0', .042);

  const fieldViews = new Map();
  const fieldSigns = [
    { x: -1.93, z: 13.28, light: '#ffe2a7', soil: '#939c70', fabric: '#c0865e' },
    { x: 13.14, z: -6.0, light: '#b8e6b5', soil: '#71957d', fabric: '#568a77' },
    { x: -.04, z: -15.5, light: '#ead2f7', soil: '#818d79', fabric: '#84749c' }
  ];
  FARM_AREAS.forEach((area, index) => {
    const marker = fieldSigns[index];
    if (!marker) return;
    const sign = groupAt(marker.x, 0, marker.z);
    for (const side of [-1, 1]) {
      mesh(sign, 'beam', '#87958a', side * .55, .09, 0, .23, .18, .23);
      mesh(sign, 'box', '#776854', side * .55, .70, 0, .11, 1.29, .11);
      mesh(sign, 'gem', paint(marker.light, .13), side * .55, 1.45, 0, .09, .13, .09);
    }
    mesh(sign, 'box', '#536760', 0, 1.09, 0, 1.24, .46, .14);
    mesh(sign, 'box', marker.fabric, 0, 1.08, .077, 1.12, .34, .02);
    mesh(sign, 'gem', marker.light, 0, 1.07, .116, .16, .13, .038);
    for (const site of CRYSTAL_SITES.filter(item => item.areaId === area.id)) {
      const base = ground(new THREE.CircleGeometry(1.12 + .14 * index, 8), marker.soil, site.x, .060, site.z);
      base.rotation.x = -Math.PI / 2;
      base.rotation.z = site.x * .12;
      base.scale.y = .79;
    }
    const open = label(sign, area.label, marker.light, 2.22);
    const requirement = area.rebirths ? `Level ${area.level} · Rebirth ${area.rebirths}` : `Level ${area.level} to mine`;
    const locked = area.level > 1 ? label(sign, area.label, '#f4cead', 2.22, requirement) : null;
    fieldViews.set(area.id, { open, locked });
    if (locked) open.visible = false;
  });
  const expedition = createExpeditionTerrain(kit, { groupAt, ground, label, path, batch: batchPlantedMeshes, sites: CRYSTAL_SITES, eggs });
  for (const [id, view] of expedition.fieldViews) fieldViews.set(id, view);

  // A shallow blue reed pond and timber bridge split the eastern trail.
  path([[17, -24], [16, -17], [19, -7], [16, 0], [17, 8], [18, 17], [21, 28]], 5.1, '#79aeb0', .050);
  path([[17, -24], [16, -17], [19, -7], [16, 0], [17, 8], [18, 17], [21, 28]], 4.4, '#91c8c2', .055);
  const bridge = groupAt(16.8, .08, 10.5);
  bridge.rotation.y = -.18;
  for (let i = 0; i < 16; i++) {
    const x = (i - 7.5) * .44;
    mesh(bridge, 'box', i % 2 ? '#c7956e' : '#dda67a', x, .10 + .13 * Math.cos(x / 2.1), 0, .40, .19, 3.15);
  }
  for (const side of [-1, 1]) {
    mesh(bridge, 'box', '#996c59', 0, .47, side * 1.54, 7.2, .11, .14);
    for (const x of [-3.4, -1.7, 1.7, 3.4]) mesh(bridge, 'box', '#8d6855', x, .23, side * 1.54, .24, .72, .27);
  }
  batchPlantedMeshes(bridge);

  const roost = groupAt(0, 0, -5.3);
  mesh(roost, 'beam', '#c8a887', 0, .095, 0, 5.2, .19, 3.65);
  mesh(roost, 'beam', '#ebdbc2', 0, .18, 0, 4.55, .11, 3.28);
  mesh(roost, 'box', '#f6e4ce', 0, .23, 3.1, 5.4, .24, 1.01);
  for (const side of [-1, 1]) {
    mesh(roost, 'beam', '#d7b99d', side * 2.68, 1.92, -.98, .37, 3.59, .37).castShadow = true;
    mesh(roost, 'box', '#a47765', side * 2.68, .43, -.98, .94, .29, .93);
    mesh(roost, 'round', '#dc886d', side * 2.68, 3.79, -.98, .42, .36, .42);
    mesh(roost, 'gem', paint('#ffc987', .19), side * 2.68, 3.2, -.40, .25, .34, .23);
  }
  const archGeometry = new THREE.TorusGeometry(2.7, .36, 8, 28, Math.PI);
  const arch = new THREE.Mesh(archGeometry, paint('#e2a187'));
  arch.position.set(0, 3.55, -.98);
  arch.castShadow = true;
  roost.add(arch);
  const archTrim = new THREE.Mesh(new THREE.TorusGeometry(2.71, .10, 6, 28, Math.PI), paint('#fff0d1'));
  archTrim.position.set(0, 3.59, -.66);
  roost.add(archTrim);
  mesh(roost, 'gem', paint('#ffd38d', .28), 0, 6.21, -.48, .38, .49, .32, [0, .38, .15]);
  mesh(roost, 'box', '#708f78', 0, 4.17, -1.02, 1.26, .41, .24);
  mesh(roost, 'gem', '#fcdb8e', 0, 4.17, -.86, .16, .16, .08);
  batchPlantedMeshes(roost);

  const embergeode = eggs.find(egg => egg.id === 'embergeode');
  const expeditionEggs = new Set(EXPEDITION_BIOMES.map(biome => biome.eggId));
  eggs.filter(egg => !egg.bestiary && egg !== embergeode && !expeditionEggs.has(egg.id)).forEach((egg, index) => {
    const x = index % 2 === 0 ? -3.08 : 3.08;
    const z = -2.75 - Math.floor(index / 2) * 4.2;
    const plinth = groupAt(x, 0, z);
    const color = index % 2 === 0 ? '#dfab70' : '#a6bdd5';
    mesh(plinth, 'beam', '#9f9f87', 0, .22, 0, 1.15, .44, 1.15);
    mesh(plinth, 'beam', '#f0dfc0', 0, .51, 0, 1.03, .15, 1.03);
    mesh(plinth, 'beam', '#b6af91', 0, .65, 0, .57, .18, .57);
    const shell = mesh(plinth, 'round', color, 0, 1.26, 0, .47, .62, .47, [0, 0, index % 2 === 0 ? -.18 : .18]);
    shell.castShadow = true;
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6;
      mesh(plinth, 'round', index % 2 ? '#e6e8f2' : '#ffebbd', Math.sin(angle) * .40, 1.24 + Math.sin(angle * 2) * .14, Math.cos(angle) * .4, .13, .095, .13);
    }
    label(plinth, egg.name || egg.label, index % 2 ? '#c7c6e5' : '#ffd18e', 2.58);
    interactables.push({ type: 'egg', id: egg.id, label: egg.name || egg.label, x, z, group: plinth });
    obstacles.push({ x, z, radius: .82 });
  });

  const workshop = groupAt(-12.2, 0, -5.7);
  mesh(workshop, 'box', '#a6a183', 0, .22, 0, 5.0, .44, 4.5);
  mesh(workshop, 'box', '#e2c09b', 0, 1.42, -.26, 4.47, 2.4, 3.63).castShadow = true;
  mesh(workshop, 'cone', '#587962', 0, 3, -.26, 3.64, 2.25, 3.34, [0, Math.PI / 4, 0]).castShadow = true;
  mesh(workshop, 'box', '#49634e', -1.38, 3.43, -.96, .53, 1.37, .59);
  mesh(workshop, 'box', '#749382', -1.38, 4.15, -.96, .72, .24, .75);
  mesh(workshop, 'box', '#796453', 0, 1.12, 1.60, 1.15, 1.76, .18);
  mesh(workshop, 'box', '#a17c65', 0, 1.11, 1.72, .83, 1.52, .14);
  mesh(workshop, 'round', '#ffd586', .29, 1.10, 1.81, .06, .065, .06);
  for (const side of [-1, 1]) {
    mesh(workshop, 'box', '#8c7562', side * 1.45, 1.57, 1.60, .89, .85, .19);
    mesh(workshop, 'box', paint('#edb45e', .29), side * 1.45, 1.57, 1.72, .69, .65, .13);
    mesh(workshop, 'box', '#f6e0ad', side * 1.45, 1.57, 1.80, .076, .69, .07);
  }
  label(workshop, 'Workshop', '#dacc93', 4.95);
  batchPlantedMeshes(workshop);
  obstacles.push({ x: -12.2, z: -6.0, radius: 2.40 });
  interactables.push({ type: 'upgrade', id: 'upgrades', label: 'Workshop', x: -12.2, z: -3.45, group: workshop });

  const rebirthCave = createRebirthCave(world, kit, { origin: REBIRTH_ALTAR, egg: embergeode, label, batch: batchPlantedMeshes });
  interactables.push(...rebirthCave.targets);
  obstacles.push(...rebirthCave.obstacles);
  const pavilion = createLeaderboardPavilion(world, kit, { label, batch: batchPlantedMeshes });
  interactables.push(pavilion.target);
  obstacles.push(...pavilion.obstacles);
  const caveTrail = groupAt(-16.25, 0, -12.72);
  mesh(caveTrail, 'beam', '#726f5c', 0, .67, 0, .115, 1.34, .115);
  mesh(caveTrail, 'box', '#8b8263', -.08, 1.39, 0, .98, .46, .136);
  mesh(caveTrail, 'cone', '#c3ba8a', -.68, 1.39, .012, .243, .42, .123, [0, 0, Math.PI / 2]);
  mesh(caveTrail, 'gem', paint('#87bfb2', .16), -.16, 1.38, .104, .135, .14, .046);

  const originalSites = CRYSTAL_SITES.filter(site => !expedition.fieldViews.has(site.areaId));
  const limits = [...nodes, ...interactables, ...originalSites, ...fieldSigns, rebirthCave.waitingArea, { x: 0, z: 11 }, { x: 7.4, z: 5.5 }];
  interactables.push(...expedition.interactables);
  obstacles.push(...expedition.obstacles);
  const nearGenerator = (x, z) => Math.hypot(x - GENERATOR_SITE.x - .78, z - GENERATOR_SITE.z + 2.15) <= 4.7;
  const nearExpedition = (x, z) => EXPEDITION_BIOMES.some(biome =>
    Math.hypot(x - biome.x, z - biome.z) <= 14.5 || Math.hypot(x - biome.entry.x, z - biome.entry.z) <= 4.8);
  for (const node of nodes) {
    const center = groupAt(node.x, 0, node.z);
    const baseColor = { bloom: '#788f5e', stone: '#87948f', crystal: '#9a9c9a' }[node.kind];
    mesh(center, 'beam', baseColor, 0, .084, 0, 1.15, .168, 1.15);
    const resource = groupAt(0, .09, 0, center);
    if (node.kind === 'bloom') {
      for (let i = 0; i < 5; i++) {
        const angle = i * TAU / 5;
        const x = Math.cos(angle) * .44;
        const z = Math.sin(angle) * .44;
        const h = .37 + random() * .39;
        mesh(resource, 'beam', '#597953', x, h * .5, z, .045, h, .045, [Math.sin(angle) * .12, 0, Math.cos(angle) * .13]);
        for (let p = 0; p < 5; p++) {
          const petal = p * TAU / 5;
          mesh(resource, 'round', i % 2 ? '#eeac80' : '#e6a3a2', x + Math.sin(petal) * .18, h + .11, z + Math.cos(petal) * .18, .18, .099, .17);
        }
        mesh(resource, 'round', paint('#ffdb82', .09), x, h + .12, z, .17, .114, .17);
      }
    } else if (node.kind === 'stone') {
      for (let i = 0; i < 5; i++) {
        const angle = i * TAU / 5;
        const scale = .27 + random() * .31;
        mesh(resource, 'facet', ['#91a8a3', '#a9b5ac', '#6d8285'][i % 3], Math.cos(angle) * .56, scale * .52, Math.sin(angle) * .50, scale * 1.17, scale * .74, scale, [.1, angle, .08]);
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const angle = i * TAU / 5;
        const h = .42 + random() * .52;
        mesh(resource, 'gem', paint(i % 2 ? '#b5d4e4' : '#7fbfaa', .17, .15), Math.cos(angle) * .42, h * .58, Math.sin(angle) * .43,
          h * .32, h, h * .34, [Math.sin(angle) * .41, angle, Math.cos(angle) * .34]);
      }
    }
    const halo = mesh(center, 'ring', paint('#fff0bd', .14), 0, .21, 0, 1.13, 1.13, 1.13, [Math.PI / 2, 0, 0]);
    halo.visible = false;
    batchPlantedMeshes(resource);
    nodeViews.set(node.id, { resource, halo });
    interactables.push({ type: 'gather', id: node.id, label: node.label, x: node.x, z: node.z, group: center });
  }

  function pillar(x, z) {
    const marker = groupAt(x, 0, z);
    mesh(marker, 'beam', '#807d6a', 0, .18, 0, .32, .36, .32);
    mesh(marker, 'beam', '#87725f', 0, .97, 0, .11, 1.6, .11);
    mesh(marker, 'box', '#8b6f5d', 0, 1.8, 0, .47, .13, .47);
    mesh(marker, 'box', paint('#f8d182', .35), 0, 2.03, 0, .29, .37, .29);
    mesh(marker, 'cone', '#b38a6d', 0, 2.30, 0, .42, .27, .42, [0, Math.PI / 4, 0]);
    mesh(marker, 'gem', '#f4be77', 0, 2.48, 0, .08, .11, .08);
  }
  for (const [x, z] of [[-2.2, 13.6], [2.9, 11.8], [-4.4, 2.3], [3.9, .45], [-7.9, 3.9], [8.4, 10.5], [13.1, 12.2]]) pillar(x, z);

  // Meadow cover uses instancing so plant count does not multiply draw calls.
  for (let i = 0; i < 560; i++) {
    const x = (random() - .5) * 74;
    const z = (random() - .5) * 74;
    if (Math.hypot(x, z) > 37.6 || nearGenerator(x, z) || rebirthCave.occupies(x, z) ||
        limits.some(point => Math.hypot(point.x - x, point.z - z) < 2.15)) continue;
    if (Math.abs(x - 1) < 2.45 && z > -10 || Math.abs(z - 6) < 2.35 && Math.abs(x) < 16 || Math.abs(x - 18) < 2.8) continue;
    const tint = ['#78a66b', '#9bc486', '#6fa163', '#b3ca79'][i % 4];
    const scale = .10 + random() * .25;
    const yaw = random() * TAU;
    if (nearExpedition(x, z)) continue;
    decoration('cone', tint, x, .28 + scale * .12, z, .14 + scale, .48 + scale, .17 + scale, yaw);
    if (i % 7 === 0) decoration('round', ['#edd3a3', '#f1ab96', '#bacdd1'][i % 3], x, .48, z, .155, .09, .155);
  }
  for (let i = 0; i < 58; i++) {
    const angle = random() * TAU;
    const distance = 10.5 + random() * 28;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    if (Math.abs(x) < 4.5 || Math.abs(z - 5.5) < 3.8 && Math.abs(x) < 26 || Math.abs(x - 17) < 3 ||
      nearGenerator(x, z) || rebirthCave.occupies(x, z, .7) ||
      (x > -23 && x < -13 && Math.abs(z + 12.7) < 1.65) ||
      limits.some(point => Math.hypot(point.x - x, point.z - z) < 3.25)) continue;
    const size = .68 + random() * .86;
    if (nearExpedition(x, z)) continue;
    const tint = ['#589479', '#649b70', '#9cae64', '#609a89'][i % 4];
    decoration('disc', '#77a173', x + size * .32, .020, z - size * .15, size * 1.75, 1, size * 1.31, angle);
    decoration('beam', '#867c65', x, size * 1.05, z, .22 * size, 2.1 * size, .23 * size, angle);
    for (let crown = 0; crown < 3; crown++) {
      decoration('facet', tint, x + Math.cos(angle + 2 * crown) * size * .44, size * (2.23 + crown * .54),
        z + Math.sin(angle + 2 * crown) * size * .48, size * (1.51 - crown * .19), size * (1.40 - crown * .17), size * 1.28, angle + crown);
    }
    if (i % 4 === 0) decoration('facet', '#a2a89a', x + size * .63, .26, z, size * .57, .46, size * .67, angle);
    obstacles.push({ x, z, radius: .35 * size });
  }
  const transform = new THREE.Object3D();
  for (const { shape, color, pieces } of decorations.values()) {
    const plant = new THREE.InstancedMesh(geometries[shape], paint(color), pieces.length);
    plant.receiveShadow = true;
    plant.castShadow = shape === 'facet';
    pieces.forEach(({ x, y, z, sx, sy, sz, yaw }, i) => {
      transform.position.set(x, y, z);
      transform.scale.set(sx, sy, sz);
      transform.rotation.set(0, yaw, 0);
      transform.updateMatrix();
      plant.setMatrixAt(i, transform.matrix);
    });
    world.add(plant);
  }

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * TAU;
    const x = Math.cos(angle) * (55 + random() * 17);
    const z = Math.sin(angle) * (57 + random() * 18);
    const drift = groupAt(x, -7 + random() * 15, z);
    const radius = 3.9 + random() * 4;
    mesh(drift, 'beam', '#9db89e', 0, 0, 0, radius, .70, radius * .85);
    mesh(drift, 'cone', '#8eaaa6', 0, -radius * .40, 0, radius, radius, radius * .85, [Math.PI, .14, 0]);
    for (let j = 0; j < 3; j++) mesh(drift, 'facet', '#89a896', (j - 1) * radius * .42, 1.04, -.5, 1.6, 2.24, 1.57, [0, angle, 0]);
  }

  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * TAU;
    const cloud = groupAt(Math.cos(angle) * 61, 9.5 + random() * 10, Math.sin(angle) * 61);
    const cloudPaint = new THREE.MeshBasicMaterial({ color: i % 2 ? '#e5edda' : '#f1f0dc', fog: true });
    for (let j = 0; j < 4; j++) mesh(cloud, 'round', cloudPaint, j * 3.4 - 4.6, Math.sin(j) * .75, 0, 3.65, 1.48 + random() * .81, 2.4);
    batchPlantedMeshes(cloud);
  }

  return { interactables, obstacles, nodeViews, rebirthCave, fieldViews, sky };
}
