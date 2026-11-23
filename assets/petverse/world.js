import * as THREE from './vendor/three/three.module.min.js';
import { EGGS, GATHER_DISTANCE, NODES, PETS, SPAWN, VARIANTS, WORLD_LIMIT } from './model.js';
import { createMeadow } from './meadow.js';
import { createModelKit, createPet, createTraveler } from './models.js';

const petById = new Map(PETS.map(spec => [spec.id, spec]));
const variantById = new Map(VARIANTS.map(variant => [variant.id, variant]));
const displayOptions = {
  quality: 'medium', particles: 'medium', petGlow: true, shinyEffects: true, rareAnimations: true,
  showPeerPets: true, showPetNames: true, collectionNumbers: true, shake: false, reducedMotion: false
};
const keys = new Map([
  ['KeyW', 'forward'], ['ArrowUp', 'forward'], ['KeyS', 'back'], ['ArrowDown', 'back'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right']
]);
const inputNames = new Set(keys.values());
const cameraStart = { yaw: .28, tilt: .43, distance: 15.3 };
const playerSpeed = 5.8;
const qualityScale = { low: .7, medium: 1, high: 1.6 };
const particleCount = { off: 0, low: 9, medium: 21, high: 36 };
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const angleDelta = (next, current) => Math.atan2(Math.sin(next - current), Math.cos(next - current));

function nameTag(host, text) {
  const label = document.createElement('span');
  label.textContent = text;
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:absolute;z-index:1;transform:translate(-50%,-100%);pointer-events:none;background:#203942e6;color:#fff6dd;padding:.16rem .42rem;border:1px solid #f5deb48f;border-radius:5px;font:650 .67rem system-ui;white-space:nowrap';
  host.append(label);
  return label;
}

function disposeScene(scene, kit) {
  const geometries = new Set(Object.values(kit.geometries));
  const materials = new Set(kit.materials.values());
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}

/** Mount a real WebGL game scene and return controls for the host interface. */
export function mountWorld(host, { onGather, onInteract, onMove, onReady, onProximity } = {}) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const canvas = document.createElement('canvas');
  canvas.className = 'petverse-canvas local-game__canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Petverse 3D Meadow');
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c4dfc4', 34, 96);
  const camera = new THREE.PerspectiveCamera(47, 1, .10, 160);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch {
    queueMicrotask(() => onReady?.({ available: false }));
    return { update() {}, setInput() {}, resetCamera() {}, interact() {}, jump() {}, showBurst() {},
      getPosition: () => ({ ...SPAWN, heading: 0 }), setPosition() {}, destroy() {} };
  }
  host.prepend(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor('#bdded2');
  const skylight = new THREE.HemisphereLight('#fff2cb', '#80a89d', 2.5);
  const sun = new THREE.DirectionalLight('#ffedb9', 2.15);
  sun.position.set(-18, 33, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, near: .5, far: 82, top: 25, bottom: -25 });
  sun.shadow.bias = -.0002;
  sun.shadow.normalBias = .025;
  scene.add(skylight, sun);

  const kit = createModelKit();
  const meadow = createMeadow(scene, kit, NODES, EGGS);
  const traveler = createTraveler(kit);
  traveler.position.set(SPAWN.x, 0, SPAWN.z);
  scene.add(traveler);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#416c45', transparent: true, opacity: .27, depthWrite: false });
  const footprint = kit.mesh(scene, 'disc', shadowMaterial, SPAWN.x, .09, SPAWN.z, .58, 1, .39);
  const party = new Map();
  const otherPlayers = new Map();
  const direction = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const cameraFocus = new THREE.Vector3();
  const projection = new THREE.Vector3();
  const particles = [];
  const pointGeometry = new THREE.BufferGeometry();
  const pointPositions = new THREE.BufferAttribute(new Float32Array(120 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const pointColors = new THREE.BufferAttribute(new Float32Array(120 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  pointGeometry.setAttribute('position', pointPositions);
  pointGeometry.setAttribute('color', pointColors);
  const sparkleMaterial = new THREE.PointsMaterial({ size: .18, vertexColors: true, transparent: true, opacity: .94, depthWrite: false });
  const sparkles = new THREE.Points(pointGeometry, sparkleMaterial);
  sparkles.frustumCulled = false;
  sparkles.visible = false;
  scene.add(sparkles);

  let graphics = { ...displayOptions };
  const view = { ...cameraStart };
  let progress;
  let activeTarget;
  let heading = 0;
  let verticalSpeed = 0;
  let airHeight = 0;
  let shakeEnds = 0;
  let frame = 0;
  let prior = 0;
  let notifyAt = 0;
  let effect;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let cameraInitialized = false;
  let destroyed = false;
  let ready = false;
  const held = new Map();
  const touch = new Set();
  let pointer;

  function resize() {
    viewportWidth = Math.max(1, Math.floor(host.clientWidth));
    viewportHeight = Math.max(1, Math.floor(host.clientHeight));
    camera.aspect = viewportWidth / viewportHeight;
    camera.updateProjectionMatrix();
    const scale = qualityScale[graphics.quality];
    renderer.setPixelRatio(graphics.quality === 'low' ? scale : Math.min(scale, window.devicePixelRatio || 1));
    renderer.setSize(viewportWidth, viewportHeight, false);
    canvas.dataset.renderQuality = graphics.quality;
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  function getPosition() {
    return { x: traveler.position.x, z: traveler.position.z, heading };
  }

  function setPosition(position) {
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return;
    traveler.position.set(clamp(position.x, -WORLD_LIMIT, WORLD_LIMIT), 0, clamp(position.z, -WORLD_LIMIT, WORLD_LIMIT));
    if (Number.isFinite(position.heading)) heading = position.heading;
    velocity.set(0, 0, 0);
    verticalSpeed = 0;
    airHeight = 0;
    cameraInitialized = false;
    for (const companion of party.values()) companion.group.position.copy(traveler.position);
  }

  function setInput(name, active) {
    if (!inputNames.has(name)) return;
    if (active) touch.add(name);
    else touch.delete(name);
  }

  function jump() {
    if (airHeight <= .015 && verticalSpeed === 0) verticalSpeed = 7;
  }

  function canInteract(target) {
    const distance = Math.hypot(traveler.position.x - target.x, traveler.position.z - target.z);
    if (target.type !== 'gather') return distance <= 3.1;
    return distance <= GATHER_DISTANCE && (progress?.nodeReadyAt?.[target.id] || 0) <= Date.now();
  }

  function interact(target = activeTarget) {
    if (!target || !canInteract(target)) return false;
    if (target.type === 'gather') onGather?.(target.id);
    else onInteract?.(target.id);
    return true;
  }

  function resetCamera() {
    Object.assign(view, cameraStart);
    cameraInitialized = false;
  }

  function clearInput() {
    held.clear();
    touch.clear();
  }

  canvas.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (keys.has(event.code)) {
      event.preventDefault();
      held.set(event.code, keys.get(event.code));
    } else if (event.code === 'Space' || event.code === 'KeyF' || event.code === 'Enter') {
      event.preventDefault();
      if (!event.repeat) {
        if (event.code === 'Space') jump();
        else interact();
      }
    }
  }, { signal });
  canvas.addEventListener('keyup', event => held.delete(event.code), { signal });
  canvas.addEventListener('blur', () => held.clear(), { signal });
  window.addEventListener('blur', clearInput, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); }, { signal });
  canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    view.distance = clamp(view.distance + Math.sign(event.deltaY) * 1.2, 8, 25);
  }, { passive: false, signal });

  canvas.addEventListener('pointerdown', event => {
    if (pointer || event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture?.(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 };
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.travel += Math.abs(dx) + Math.abs(dy);
    view.yaw -= dx * .009;
    view.tilt = clamp(view.tilt + dy * .0055, .20, 1.12);
  }, { signal });
  const raycaster = new THREE.Raycaster();
  const hitPoint = new THREE.Vector2();
  canvas.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    if (pointer.travel < 8 && event.button === 0) {
      const bounds = canvas.getBoundingClientRect();
      hitPoint.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(hitPoint, camera);
      const options = meadow.interactables.filter(canInteract);
      const hit = raycaster.intersectObjects(options.map(target => target.group), true)[0];
      for (let object = hit?.object; object; object = object.parent) {
        const target = options.find(item => item.group === object);
        if (target) { interact(target); break; }
      }
    }
    pointer = undefined;
  }, { signal });
  for (const eventName of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(eventName, event => {
    if (pointer?.id === event.pointerId) pointer = undefined;
  }, { signal });

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    clearInput();
    onReady?.({ available: false });
  }, { signal });
  canvas.addEventListener('webglcontextrestored', () => {
    prior = 0;
    ready = false;
    frame = requestAnimationFrame(draw);
  }, { signal });

  function companion(speciesId, variant, position) {
    const spec = petById.get(speciesId);
    if (!spec) return null;
    const group = createPet(spec, variant, kit);
    group.position.copy(position);
    scene.add(group);
    const shadow = kit.mesh(scene, 'disc', shadowMaterial, position.x, .09, position.z, .55, 1, .43);
    return { group, shadow, label: nameTag(host, spec.name), variant, speciesId };
  }

  function releaseCharacter(entry) {
    scene.remove(entry.group);
    if (entry.shadow) scene.remove(entry.shadow);
    entry.label?.remove();
    if (entry.companion) releaseCharacter(entry.companion);
  }

  function syncParty() {
    const equipped = new Set(progress?.equipped || []);
    const activePets = (progress?.inventory || []).filter(item => equipped.has(item.id));
    const byId = new Map(activePets.map(pet => [pet.id, pet]));
    for (const [id, pet] of party) {
      const current = byId.get(id);
      if (current?.speciesId === pet.speciesId && current?.variant === pet.variant) continue;
      releaseCharacter(pet);
      party.delete(id);
    }
    for (const item of activePets) {
      if (party.has(item.id)) continue;
      const spawn = traveler.position.clone().add(new THREE.Vector3(1.35 + party.size * .35, 0, 1.3));
      const pet = companion(item.speciesId, item.variant, spawn);
      if (pet) party.set(item.id, pet);
    }
  }

  function syncPeers(peers) {
    const records = peers.slice(0, 24).filter(peer => typeof peer.id === 'string' && Number.isFinite(peer.x) && Number.isFinite(peer.z));
    const ids = new Set(records.map(peer => peer.id));
    for (const [id, entry] of otherPlayers) if (!ids.has(id)) {
      releaseCharacter(entry);
      otherPlayers.delete(id);
    }
    for (const peer of records) {
      const name = typeof peer.name === 'string' ? peer.name.slice(0, 24) : 'Traveler';
      let entry = otherPlayers.get(peer.id);
      if (!entry) {
        const group = createTraveler(kit, true);
        scene.add(group);
        entry = { group, target: new THREE.Vector3(), direction: 0, label: nameTag(host, name) };
        entry.group.position.set(peer.x, 0, peer.z);
        otherPlayers.set(peer.id, entry);
      }
      entry.label.textContent = name;
      entry.target.set(clamp(peer.x, -WORLD_LIMIT, WORLD_LIMIT), 0, clamp(peer.z, -WORLD_LIMIT, WORLD_LIMIT));
      if (Number.isFinite(peer.heading)) entry.direction = peer.heading;
      const spec = peer.pet?.speciesId;
      const variant = peer.pet?.variant;
      if (entry.companion && (!graphics.showPeerPets || entry.companion.speciesId !== spec || entry.companion.variant !== variant)) {
        releaseCharacter(entry.companion);
        entry.companion = undefined;
      }
      if (!entry.companion && graphics.showPeerPets && petById.has(spec)) entry.companion = companion(spec, variant, entry.group.position);
    }
  }

  function update({ progress: nextProgress, peers, graphics: nextGraphics } = {}) {
    if (nextProgress) {
      progress = nextProgress;
      syncParty();
    }
    if (nextGraphics) {
      const oldQuality = graphics.quality;
      graphics = { ...displayOptions, ...nextGraphics };
      if (!Object.hasOwn(qualityScale, graphics.quality)) graphics.quality = displayOptions.quality;
      renderer.shadowMap.enabled = graphics.quality === 'high';
      if (graphics.quality !== oldQuality) resize();
    }
    if (Array.isArray(peers)) syncPeers(peers);
  }

  function rootPoint(target, label, height, visible = true) {
    projection.set(target.x, target.y + height, target.z).project(camera);
    const outside = projection.z > 1 || Math.abs(projection.x) > 1.02 || Math.abs(projection.y) > 1.02;
    label.hidden = !visible || outside;
    if (!label.hidden) {
      label.style.left = `${(projection.x * .5 + .5) * viewportWidth}px`;
      label.style.top = `${(.5 - projection.y * .5) * viewportHeight}px`;
    }
  }

  function showBurst({ kind, nodeId, variant = 'normal', amount } = {}) {
    const node = NODES.find(item => item.id === nodeId);
    const source = node || traveler.position;
    const color = new THREE.Color(variantById.get(variant)?.color || '#fadd92');
    const density = graphics.reducedMotion ? 0 : particleCount[graphics.particles] || 0;
    for (let index = 0; index < density; index++) {
      if (particles.length >= pointPositions.count) particles.shift();
      const angle = index / density * Math.PI * 2;
      const radius = .85 + Math.random() * 3;
      particles.push({ x: source.x, y: 1, z: source.z, dx: Math.cos(angle) * radius,
        dy: 2 + Math.random() * 2.4, dz: Math.sin(angle) * radius, life: .55 + Math.random() * .5, color });
    }
    if (kind === 'hatch' && graphics.shake && !graphics.reducedMotion) shakeEnds = performance.now() + 230;
    if (kind === 'gather' && Number.isFinite(amount) && graphics.collectionNumbers) {
      effect?.label.remove();
      effect = { label: nameTag(host, `+${amount} Sunbeams`), x: source.x, z: source.z, elapsed: 0 };
    }
  }

  function walkable(x, z) {
    return !meadow.obstacles.some(block => Math.hypot(block.x - x, block.z - z) < block.radius + .25);
  }

  function groundHeight(x, z) {
    if (Math.hypot((x / 4.35), ((z + 5.3) / 3.13)) < 1) return .23;
    const bridgeX = (x - 16.8) * .984 - (z - 10.5) * .179;
    const bridgeZ = (x - 16.8) * .179 + (z - 10.5) * .984;
    return Math.abs(bridgeX) < 3.43 && Math.abs(bridgeZ) < 1.49 ? .26 + .13 * Math.cos(bridgeX / 2.1) : 0;
  }

  function updateTraveler(dt, time) {
    const desired = new Set([...held.values(), ...touch]);
    const x = Number(desired.has('right')) - Number(desired.has('left'));
    const z = Number(desired.has('back')) - Number(desired.has('forward'));
    direction.set(x * Math.cos(view.yaw) + z * Math.sin(view.yaw), 0,
      z * Math.cos(view.yaw) - x * Math.sin(view.yaw)).normalize().multiplyScalar(playerSpeed);
    velocity.lerp(direction, 1 - Math.exp(-dt * 13));
    if (desired.size === 0 && velocity.lengthSq() < .003) velocity.set(0, 0, 0);
    const previousX = traveler.position.x;
    const previousZ = traveler.position.z;
    const steps = Math.ceil(dt / .035);
    for (let step = 0; step < steps; step++) {
      const nextX = clamp(traveler.position.x + velocity.x * dt / steps, -WORLD_LIMIT, WORLD_LIMIT);
      const nextZ = clamp(traveler.position.z + velocity.z * dt / steps, -WORLD_LIMIT, WORLD_LIMIT);
      if (walkable(nextX, traveler.position.z)) traveler.position.x = nextX;
      if (walkable(traveler.position.x, nextZ)) traveler.position.z = nextZ;
    }
    airHeight = Math.max(0, airHeight + verticalSpeed * dt);
    verticalSpeed = airHeight > 0 ? verticalSpeed - 21 * dt : 0;
    const floor = groundHeight(traveler.position.x, traveler.position.z);
    traveler.position.y = floor + airHeight;
    footprint.position.set(traveler.position.x, .09 + floor, traveler.position.z);
    footprint.visible = graphics.quality !== 'high';
    if (velocity.lengthSq() > .1) heading += angleDelta(Math.atan2(velocity.x, velocity.z), heading) * (1 - Math.exp(-dt * 14));
    traveler.rotation.y = heading;
    const moving = traveler.position.x !== previousX || traveler.position.z !== previousZ;
    const stride = moving && !graphics.reducedMotion ? Math.sin(time * 11) * .57 : 0;
    traveler.userData.legs.forEach((leg, index) => { leg.rotation.x = index === 0 ? stride : -stride; });
    if (moving && performance.now() - notifyAt >= 90) {
      notifyAt = performance.now();
      onMove?.(getPosition());
    }
  }

  function animatePet(entry, leader, facing, side, distance, dt, time) {
    const { group, label, variant, shadow } = entry;
    const x = leader.x - Math.sin(facing) * distance + Math.cos(facing) * side;
    const z = leader.z - Math.cos(facing) * distance - Math.sin(facing) * side;
    const dx = x - group.position.x;
    const dz = z - group.position.z;
    const step = 1 - Math.exp(-dt * 3.2);
    group.position.x += dx * step;
    group.position.z += dz * step;
    const animating = !graphics.reducedMotion && (variant === 'normal' || graphics.rareAnimations);
    const hop = animating ? Math.abs(Math.sin(time * (Math.hypot(dx, dz) > .5 ? 7.3 : 2.6) + side)) * .19 : 0;
    const floor = groundHeight(group.position.x, group.position.z);
    group.position.y = hop + floor;
    shadow.position.set(group.position.x, .09 + floor, group.position.z);
    shadow.visible = graphics.quality !== 'high';
    if (Math.hypot(dx, dz) > .2) group.rotation.y += angleDelta(Math.atan2(dx, dz), group.rotation.y) * step;
    if (group.userData.aura) {
      group.userData.aura.visible = graphics.petGlow && (variant !== 'shiny' || graphics.shinyEffects);
      if (animating && group.userData.aura.visible) group.userData.aura.rotation.z = time * .74;
    }
    group.userData.wings?.forEach((wing, index) => { wing.rotation.z = animating ? Math.sin(time * 7.2) * .24 * (index ? 1 : -1) : 0; });
    rootPoint(group.position, label, 2.04, graphics.showPetNames);
  }

  function draw(now) {
    if (destroyed) return;
    frame = requestAnimationFrame(draw);
    const active = held.size || touch.size || pointer || airHeight > 0 || particles.length || velocity.lengthSq() > .02;
    const minimumInterval = graphics.quality === 'low' ? (active ? 30 : 50) : (active ? 0 : 28);
    if (prior && now - prior < minimumInterval) return;
    const dt = prior ? clamp((now - prior) / 1000, 0, .14) : .016;
    prior = now;
    if (document.hidden || viewportWidth <= 1 || viewportHeight <= 1) return;
    const time = now / 1000;
    updateTraveler(dt, time);

    let proximity;
    let bestDistance = Infinity;
    for (const target of meadow.interactables) {
      if (!canInteract(target)) continue;
      const distance = Math.hypot(target.x - traveler.position.x, target.z - traveler.position.z);
      if (distance < bestDistance) {
        proximity = target;
        bestDistance = distance;
      }
    }
    if (proximity !== activeTarget) {
      activeTarget = proximity;
      onProximity?.(proximity ? { type: proximity.type, id: proximity.id, label: proximity.label } : null);
    }
    for (const [id, model] of meadow.nodeViews) {
      model.resource.visible = (progress?.nodeReadyAt?.[id] || 0) <= Date.now();
      model.halo.visible = activeTarget?.id === id;
      if (model.halo.visible && !graphics.reducedMotion) model.halo.scale.setScalar(1.03 + Math.sin(time * 3.8) * .065);
    }

    const zoom = view.distance * (camera.aspect < 1 ? 1.14 : 1);
    const horizontal = Math.cos(view.tilt) * zoom;
    cameraTarget.set(traveler.position.x + horizontal * Math.sin(view.yaw), 1.3 + Math.sin(view.tilt) * zoom,
      traveler.position.z + horizontal * Math.cos(view.yaw));
    if (now < shakeEnds) cameraTarget.x += Math.sin(now * .21) * (shakeEnds - now) / 240 * .15;
    cameraFocus.set(traveler.position.x - Math.sin(view.yaw) * 2, 1.47, traveler.position.z - Math.cos(view.yaw) * 2);
    if (!cameraInitialized || graphics.reducedMotion) camera.position.copy(cameraTarget);
    else camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 8.2));
    cameraInitialized = true;
    camera.lookAt(cameraFocus);
    camera.updateMatrixWorld();

    let index = 0;
    for (const entry of party.values()) {
      const side = (index % 2 ? -1 : 1) * (1.25 + Math.floor(index / 2) * .65);
      animatePet(entry, traveler.position, heading, side, 1.75 + Math.floor(index / 2) * 1.30, dt, time);
      index++;
    }
    for (const entry of otherPlayers.values()) {
      entry.group.position.lerp(entry.target, 1 - Math.exp(-dt * 12));
      entry.group.rotation.y += angleDelta(entry.direction, entry.group.rotation.y) * (1 - Math.exp(-dt * 12));
      rootPoint(entry.group.position, entry.label, 2.43);
      if (entry.companion) animatePet(entry.companion, entry.group.position, entry.group.rotation.y, 1.28, 1.80, dt, time);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) { particles.splice(i, 1); continue; }
      particle.x += particle.dx * dt;
      particle.z += particle.dz * dt;
      particle.y += particle.dy * dt;
      particle.dy -= dt * 5.2;
    }
    sparkles.visible = particles.length > 0 && !graphics.reducedMotion && graphics.particles !== 'off';
    if (sparkles.visible) {
      particles.forEach((particle, i) => {
        pointPositions.setXYZ(i, particle.x, particle.y, particle.z);
        pointColors.setXYZ(i, particle.color.r, particle.color.g, particle.color.b);
      });
      pointGeometry.setDrawRange(0, particles.length);
      pointPositions.needsUpdate = true;
      pointColors.needsUpdate = true;
    }
    if (effect) {
      effect.elapsed += dt;
      rootPoint({ x: effect.x, y: 0, z: effect.z }, effect.label, 1.7 + effect.elapsed * .73, graphics.collectionNumbers);
      effect.label.style.opacity = String(clamp((1.15 - effect.elapsed) * 2, 0, 1));
      if (effect.elapsed > 1.15) {
        effect.label.remove();
        effect = undefined;
      }
    }

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      onReady?.({ available: true });
    }
  }

  frame = requestAnimationFrame(draw);
  return { update, setInput, getPosition, setPosition, jump, interact, resetCamera, showBurst, destroy() {
    if (destroyed) return;
    destroyed = true;
    lifetime.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    for (const entry of [...party.values(), ...otherPlayers.values()]) entry.label?.remove();
    effect?.label.remove();
    for (const entry of otherPlayers.values()) entry.companion?.label.remove();
    disposeScene(scene, kit);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  } };
}
