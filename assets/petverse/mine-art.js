import * as THREE from './vendor/three/three.module.min.js';
import { CRYSTAL_FAMILIES } from './farming.js?v=20261123-3';

const styles = [null,
  { name: 'Gleam', color: '#309d96', light: '#abf8e2', stone: '#4c7076' },
  { name: 'Prismatic', color: '#8e6bc3', light: '#ffe1fa', stone: '#5c566f' }
];
const maximumShards = 90;
const turn = Math.PI * 2;

function prism(radii, offset) {
  const [width, height, lean] = radii;
  const faces = 6;
  const vertices = [];
  const colors = [];
  const layers = [[-.04, .77], [.18, 1], [.74, .88], [1, .08]].map(([y, radius], layer) =>
    Array.from({ length: faces }, (_, index) => {
      const angle = index * turn / faces + offset;
      return [Math.cos(angle) * width * radius + y * lean, y * height + Math.cos(angle + layer) * width * .09,
        Math.sin(angle) * width * radius];
    }));
  function triangle(a, b, c, shade, level) {
    vertices.push(...a, ...b, ...c);
    colors.push(shade, level, 0, shade, level, 0, shade, level, 0);
  }
  for (let layer = 0; layer < layers.length - 1; layer++) {
    for (let i = 0; i < faces; i++) {
      const next = (i + 1) % faces;
      const bottom = layers[layer];
      const top = layers[layer + 1];
      const light = .55 + .24 * Math.cos(i * 1.19 + layer * .39);
      triangle(bottom[i], top[i], bottom[next], light, layer / 3);
      triangle(bottom[next], top[i], top[next], light + .11, (layer + .3) / 3);
    }
  }
  for (let i = 0; i < faces; i++) triangle(layers[3][i], [lean, height * 1.015, 0], layers[3][(i + 1) % faces], .91, 1);
  return { vertices, colors };
}

function clusterGeometry(color, light) {
  const chunks = [
    { shape: [.39, 1.52, -.10], spin: .04, x: 0, z: 0 },
    { shape: [.25, .94, -.23], spin: .36, x: -.32, z: .18 },
    { shape: [.27, 1.12, .23], spin: .24, x: .37, z: -.17 },
    { shape: [.19, .64, .09], spin: .81, x: .25, z: .37 },
    { shape: [.16, .55, -.09], spin: .59, x: -.24, z: -.39 }
  ];
  const positions = [];
  const tint = [];
  const base = new THREE.Color(color);
  const tip = new THREE.Color(light);
  const face = new THREE.Color();
  for (const { shape, spin, x, z } of chunks) {
    const { vertices, colors } = prism(shape, spin);
    for (let i = 0; i < vertices.length; i += 3) {
      positions.push(vertices[i] + x, vertices[i + 1], vertices[i + 2] + z);
      face.copy(base).lerp(tip, Math.min(1, colors[i] * .62 + colors[i + 1] * .49));
      tint.push(face.r, face.g, face.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function healthTag(host, id) {
  const label = document.createElement('span');
  label.dataset.crystalId = id;
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:absolute;z-index:1;transform:translate(-50%,-100%);min-width:5.2rem;padding:.22rem .35rem;background:#213236e8;color:#fff6df;border:1px solid #f8edcc80;border-radius:6px;pointer-events:none;text-align:center;white-space:nowrap;font:650 .65rem system-ui;box-shadow:0 2px 5px #142a333b';
  const title = document.createElement('span');
  const health = document.createElement('meter');
  health.style.cssText = 'display:block;width:100%;height:.42rem;margin-top:.1rem;accent-color:#77e3af';
  const fraction = document.createElement('span');
  fraction.style.cssText = 'display:block;color:#c5efd3;font-size:.59rem;font-variant-numeric:tabular-nums';
  label.append(title, health, fraction);
  label.hidden = true;
  host.append(label);
  return { label, title, health, fraction };
}

/** Scene geometry and screen labels are projections of the farming simulator's authoritative state. */
export function createMineView(scene, kit, host, { groundHeight, projectLabel }) {
  const families = new Map(CRYSTAL_FAMILIES.map(family => [family.id, family]));
  const geometry = new Map();
  const views = new Map();
  const bursts = [];
  const numbers = [];
  const ownerTargets = new Set();
  const poses = new Map();
  const shards = new THREE.InstancedMesh(kit.geometries.gem,
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: .72, metalness: .22 }), maximumShards);
  const transform = new THREE.Object3D();
  const glint = new THREE.Color();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .27, metalness: .21, emissive: '#122b25', emissiveIntensity: .16, flatShading: true });
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;
  shards.count = 0;
  scene.add(shards);

  function texture(state) {
    const family = families.get(state.familyId);
    const rare = styles[state.specialTier];
    return {
      color: rare?.color || family?.color || '#bc8b75', light: rare?.light || family?.glow || '#ffd4ab',
      name: rare ? `${rare.name} ${family?.label || 'crystal'}` : family?.label || 'Meadow crystal',
      stone: rare?.stone || '#696962', radius: family?.radius || .9
    };
  }

  function build(state) {
    const look = texture(state);
    const group = new THREE.Group();
    const ground = groundHeight(state.x, state.z);
    group.position.set(state.x, ground, state.z);
    const radius = look.radius * 1.23;
    const base = kit.mesh(group, 'beam', look.stone, 0, .075, 0, radius, .15, radius * .91);
    base.rotation.y = state.x + state.z;
    const rim = kit.mesh(group, 'ring', kit.paint(look.light, state.specialTier ? .29 : .12, .19), 0, .15, 0,
      radius * .93, radius * .93, radius * .93, [-Math.PI / 2, 0, .2]);
    const key = `${look.color}:${look.light}`;
    if (!geometry.has(key)) geometry.set(key, clusterGeometry(look.color, look.light));
    const crystal = new THREE.Mesh(geometry.get(key), material);
    const size = (.46 + radius * .63) * (state.specialTier ? 1.19 : 1);
    crystal.position.y = .11;
    crystal.rotation.y = state.x * .63 - state.z * .12;
    crystal.scale.setScalar(size);
    crystal.castShadow = true;
    group.add(crystal);
    scene.add(group);
    return { group, crystal, rim, size, look, height: size * 1.65 + .45, ...healthTag(host, state.id) };
  }

  function disposeView(view) {
    scene.remove(view.group);
    view.label.remove();
  }

  function sync(snapshot, ownerId) {
    const records = snapshot?.crystals || [];
    const active = new Set(records.map(record => record.id));
    poses.clear();
    ownerTargets.clear();
    for (const pet of snapshot?.pets || []) {
      if (pet.ownerId === ownerId && pet.targetId) ownerTargets.add(pet.targetId);
      if (!poses.has(pet.ownerId)) poses.set(pet.ownerId, new Map());
      poses.get(pet.ownerId).set(pet.id, pet);
    }
    for (const [id, view] of views) if (!active.has(id)) {
      disposeView(view);
      views.delete(id);
    }
    for (const state of records) {
      let view = views.get(state.id);
      if (!view || view.state.familyId !== state.familyId || view.state.specialTier !== state.specialTier) {
        if (view) disposeView(view);
        view = build(state);
        views.set(state.id, view);
        view.title.textContent = view.look.name;
      }
      if (view.state?.health !== state.health || view.state?.maxHealth !== state.maxHealth) {
        view.health.max = state.maxHealth;
        view.health.value = state.health;
        view.fraction.textContent = `${Math.ceil(state.health)} / ${state.maxHealth}`;
      }
      view.state = state;
      view.crystal.visible = state.health > 0;
      view.rim.visible = state.health > 0 && Boolean(state.targeted || state.specialTier);
    }
  }

  function emit(events, graphics, ownerId, traveler) {
    for (const event of events) {
      const view = views.get(event.crystalId);
      if (!view || Math.hypot(event.x - traveler.x, event.z - traveler.z) > 26 ||
          !['damage', 'break'].includes(event.type)) continue;
      const breaking = event.type === 'break';
      view.hit = breaking ? 0 : .15;
      const amount = graphics.particles === 'low' ? 6 : graphics.particles === 'high' ? 17 : 11;
      const density = graphics.reducedMotion || graphics.particles === 'off' ? 0 : breaking ? amount : Math.ceil(amount / 4);
      for (let index = 0; index < density; index++) {
        if (bursts.length >= maximumShards) bursts.shift();
        const angle = index * turn / density + Math.random() * .8;
        const speed = (breaking ? 1.8 : .9) + Math.random() * 2.6;
        bursts.push({
          x: event.x + Math.cos(angle) * .28, y: view.group.position.y + view.height * .59,
          z: event.z + Math.sin(angle) * .28, ground: view.group.position.y,
          dx: Math.cos(angle) * speed, dy: 1 + Math.random() * (breaking ? 3.5 : 1.8), dz: Math.sin(angle) * speed,
          color: index % 3 ? view.look.light : view.look.color, life: breaking ? .95 : .43,
          scale: (breaking ? .09 : .043) + Math.random() * .09, spin: Math.random() * 3.1
        });
      }
      if (breaking || !graphics.collectionNumbers || !Number.isFinite(event.damage) || event.ownerId !== ownerId) continue;
      if (numbers.length >= 14) numbers.shift().label.remove();
      const label = document.createElement('span');
      label.dataset.crystalDamage = event.crystalId;
      label.setAttribute('aria-hidden', 'true');
      label.textContent = `−${event.damage}`;
      label.style.cssText = 'position:absolute;z-index:2;transform:translate(-50%,-100%);pointer-events:none;white-space:nowrap;color:#fff0ae;text-shadow:0 1px 3px #782712,0 0 4px #743a22;font:800 1rem system-ui';
      host.append(label);
      const x = event.x + (numbers.length % 3 - 1) * .24;
      numbers.push({ label, position: { x, y: view.group.position.y, z: event.z }, height: view.height, elapsed: 0 });
    }
  }

  function animate(dt, time, traveler, graphics) {
    for (const view of views.values()) {
      const targeted = view.state.targeted || ownerTargets.has(view.state.id);
      const distance = Math.hypot(view.state.x - traveler.x, view.state.z - traveler.z);
      const visible = targeted && view.state.health > 0 && distance <= 20;
      projectLabel(view.group.position, view.label, view.height, visible);
      view.hit = Math.max(0, (view.hit || 0) - dt);
      view.crystal.rotation.z = graphics.reducedMotion ? 0 : Math.sin(view.hit * 42) * view.hit * .48;
      view.rim.scale.setScalar(view.look.radius * (1.09 + (graphics.reducedMotion ? 0 : Math.sin(time * 3.5) * .035)));
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const number = numbers[i];
      number.elapsed += dt;
      if (number.elapsed >= .8) {
        number.label.remove();
        numbers.splice(i, 1);
        continue;
      }
      const lift = graphics.reducedMotion ? 0 : number.elapsed * 1.35;
      projectLabel(number.position, number.label, number.height + lift, graphics.collectionNumbers);
      number.label.style.opacity = String(Math.min(1, (.8 - number.elapsed) * 3.8));
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const shard = bursts[i];
      shard.life -= dt;
      if (shard.life <= 0 || shard.y < shard.ground) {
        bursts.splice(i, 1);
        continue;
      }
      shard.x += shard.dx * dt;
      shard.y += shard.dy * dt;
      shard.z += shard.dz * dt;
      shard.dy -= 8.1 * dt;
    }
    shards.count = graphics.reducedMotion || graphics.particles === 'off' ? 0 : bursts.length;
    for (let index = 0; index < shards.count; index++) {
      const shard = bursts[index];
      const size = shard.scale * Math.min(1, shard.life * 5);
      transform.position.set(shard.x, shard.y, shard.z);
      transform.rotation.set(shard.spin + time * 3.4, time * 4.6 - index, shard.spin + time * 6);
      transform.scale.set(size * .81, size * 1.47, size);
      transform.updateMatrix();
      shards.setMatrixAt(index, transform.matrix);
      shards.setColorAt(index, glint.set(shard.color));
    }
    if (shards.count) {
      shards.instanceMatrix.needsUpdate = true;
      shards.instanceColor.needsUpdate = true;
    }
  }

  function destroy() {
    for (const view of views.values()) disposeView(view);
    for (const number of numbers) number.label.remove();
    for (const shape of geometry.values()) shape.dispose();
    material.dispose();
  }

  return { sync, emit, animate, destroy, poses, get active() { return Boolean(bursts.length || numbers.length); } };
}
