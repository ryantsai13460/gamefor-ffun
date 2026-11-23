import * as THREE from './vendor/three/three.module.min.js';
import { EGGS, GATHER_DISTANCE, magnetStats, NODES, PETS, REBIRTH_ALTAR, SPAWN, VARIANTS, WORLD_LIMIT } from './model.js?v=20261123-3';
import { createMeadow } from './meadow.js?v=20261123-3';
import { createModelKit, createPet, createTraveler, petScale } from './models.js?v=20261123-3';
import { createMineView } from './mine-art.js?v=20261123-3';
import { createGeneratorWorkshop } from './generator-art.js?v=20261123-3';
import { canFarmArea } from './farming.js?v=20261123-3';

const petById = new Map(PETS.map(spec => [spec.id, spec]));
const variantById = new Map(VARIANTS.map(variant => [variant.id, variant]));
const displayOptions = {
  quality: 'medium', shadows: true, particles: 'medium', petGlow: true, shinyEffects: true, rareAnimations: true,
  showPeerPets: true, showPeerTitanium: true, showPetNames: true, collectionNumbers: true,
  shake: false, reducedMotion: false, cameraSensitivity: .5
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
const oversized = variant => variant === 'titanium' || variant === 'giant';

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
  const textures = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    if (material.map) textures.add(material.map);
    if (material.envMap) textures.add(material.envMap);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

/** Mount a real WebGL game scene and return controls for the host interface. */
export function mountWorld(host, { onGather, onCollect, onInteract, onMove, onReady, onProximity } = {}) {
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
  const workshop = createGeneratorWorkshop(scene, kit);
  meadow.interactables.push(workshop.target);
  meadow.obstacles.push(...workshop.obstacles);
  const mine = createMineView(scene, kit, host, { groundHeight, projectLabel: rootPoint });
  const traveler = createTraveler(kit);
  traveler.position.set(SPAWN.x, 0, SPAWN.z);
  scene.add(traveler);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#416c45', transparent: true, opacity: .27, depthWrite: false });
  const footprint = kit.mesh(scene, 'disc', shadowMaterial, SPAWN.x, .09, SPAWN.z, .58, 1, .39);
  const party = new Map();
  const otherPlayers = new Map();
  const farmParty = new Map();
  const rewards = new Map();
  const rewardCoins = kit.paint('#eec568', .16, .3);
  const rewardCrystals = kit.paint('#a5e5df', .22, .2);
  const rewardTrail = new THREE.MeshBasicMaterial({ color: '#ffda83', transparent: true, opacity: .34, depthWrite: false });
  const rangeRing = new THREE.Mesh(new THREE.RingGeometry(.988, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#63ffe3', transparent: true, opacity: .78, side: THREE.DoubleSide, depthWrite: false }));
  rangeRing.visible = false;
  scene.add(rangeRing);
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
  let magnet = { radius: 3.3, speed: 7.5, maxSimultaneous: 2 };
  let magnetPreview = false;
  let peerRecords = [];
  let farmOwnerId = 'solo';
  let generator = { active: false, ratio: 0, tier: 1 };
  let stopGeneratorAt = 0;
  let previousDropList;
  const collecting = new Set();
  let harvestTask;
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
    const movedFar = Math.hypot(position.x - traveler.position.x, position.z - traveler.position.z) > 3;
    traveler.position.set(clamp(position.x, -WORLD_LIMIT, WORLD_LIMIT), 0, clamp(position.z, -WORLD_LIMIT, WORLD_LIMIT));
    if (Number.isFinite(position.heading)) heading = position.heading;
    velocity.set(0, 0, 0);
    verticalSpeed = 0;
    airHeight = 0;
    if (movedFar) {
      cameraInitialized = false;
      placeParty(0, 0, 0, true);
    }
  }

  function setInput(name, active) {
    if (!inputNames.has(name)) return;
    if (active) touch.add(name);
    else touch.delete(name);
  }

  function jump() {
    if (generator.active) { requestGeneratorStop(); return; }
    if (airHeight <= .015 && verticalSpeed === 0) verticalSpeed = 7;
  }

  function requestGeneratorStop() {
    const now = performance.now();
    if (now < stopGeneratorAt) return;
    stopGeneratorAt = now + 420;
    onInteract?.('stop-generator');
  }

  function canInteract(target) {
    const distance = Math.hypot(traveler.position.x - target.x, traveler.position.z - target.z);
    if (target.type !== 'gather') return distance <= (target.radius ?? (target.type === 'rebirth' ? REBIRTH_ALTAR.radius : 3.1));
    return distance <= GATHER_DISTANCE && (progress?.nodeReadyAt?.[target.id] || 0) <= Date.now();
  }

  function interact(target = activeTarget) {
    if (!target || !canInteract(target)) return false;
    if (target.type === 'gather') onGather?.(target.id);
    else if (target.type === 'generator' && generator.active) requestGeneratorStop();
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
    } else if (event.code === 'KeyE') {
      if (!canInteract(workshop.target)) return;
      event.preventDefault();
      if (!event.repeat) interact(workshop.target);
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
    const sensitivity = .5 + clamp(graphics.cameraSensitivity, 0, 1);
    view.yaw -= dx * .009 * sensitivity;
    view.tilt = clamp(view.tilt + dy * .0055 * sensitivity, .20, 1.12);
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
    const scale = petScale(variant);
    const shadow = kit.mesh(scene, 'disc', shadowMaterial, position.x, .09, position.z, .55 * scale, 1, .43 * scale);
    const label = nameTag(host, oversized(variant) ? `${variantById.get(variant)?.name || 'Giant'} ${spec.name}` : spec.name);
    label.dataset.petVariant = variant || 'normal';
    return { group, shadow, label, variant, scale, speciesId, target: new THREE.Vector3() };
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
    let added = false;
    for (const item of activePets) {
      if (party.has(item.id)) continue;
      const spawn = traveler.position.clone().add(new THREE.Vector3(1.35 + party.size * .35, 0, 1.3));
      const pet = companion(item.speciesId, item.variant, spawn);
      if (pet) {
        pet.entering = true;
        party.set(item.id, pet);
        added = true;
      }
    }
    if (added) placeParty(0, 0, 0);
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
      const visible = graphics.showPeerPets && !mine.poses.get(peer.id)?.size && (variant !== 'titanium' || graphics.showPeerTitanium);
      if (entry.companion && (!visible || entry.companion.speciesId !== spec || entry.companion.variant !== variant)) {
        releaseCharacter(entry.companion);
        entry.companion = undefined;
      }
      if (!entry.companion && visible && petById.has(spec)) {
        entry.companion = companion(spec, variant, entry.group.position);
        entry.companion.entering = true;
        placeCompanion(entry.companion, entry.group.position, entry.direction, 0, 0, 0, 0);
      }
    }
  }

  function syncFarmParty() {
    const visible = new Map();
    if (graphics.showPeerPets) for (const [ownerId, pets] of mine.poses) {
      if (ownerId === farmOwnerId) continue;
      for (const pose of pets.values()) {
        if (pose.variant !== 'titanium' || graphics.showPeerTitanium) visible.set(`${ownerId}:${pose.id}`, pose);
      }
    }
    for (const [key, entry] of farmParty) {
      const pose = visible.get(key);
      if (pose?.speciesId === entry.speciesId && pose.variant === entry.variant) continue;
      releaseCharacter(entry);
      farmParty.delete(key);
    }
    for (const [key, pose] of visible) {
      let entry = farmParty.get(key);
      if (!entry) {
        entry = companion(pose.speciesId, pose.variant, new THREE.Vector3(pose.x, 0, pose.z));
        if (!entry) continue;
        entry.group.rotation.y = pose.heading || 0;
        farmParty.set(key, entry);
      }
      entry.pose = pose;
    }
  }

  function update({ progress: nextProgress, peers, graphics: nextGraphics, magnetPreview: preview,
    farming, farmingEvents, farmOwnerId: owner, generator: nextGenerator } = {}) {
    if (nextProgress) {
      progress = nextProgress;
      syncParty();
      magnet = magnetStats(progress);
      if (progress.drops !== previousDropList) syncRewards(progress.drops);
      for (const [id, field] of meadow.fieldViews) {
        field.open.visible = canFarmArea(progress, id);
        if (field.locked) field.locked.visible = !field.open.visible;
      }
    }
    if (nextGraphics) {
      const oldQuality = graphics.quality;
      graphics = { ...displayOptions, ...nextGraphics };
      if (!Object.hasOwn(qualityScale, graphics.quality)) graphics.quality = displayOptions.quality;
      renderer.shadowMap.enabled = graphics.quality === 'high' && graphics.shadows;
      if (graphics.quality !== oldQuality) resize();
    }
    if (typeof preview === 'boolean') magnetPreview = preview;
    if (nextGenerator) {
      generator = nextGenerator;
      if (!generator.active) stopGeneratorAt = 0;
      canvas.dataset.charging = String(Boolean(generator.active));
    }
    if (typeof owner === 'string') farmOwnerId = owner;
    if (farming !== undefined) mine.sync(farming, farmOwnerId);
    if (farming !== undefined || nextGraphics) syncFarmParty();
    if (Array.isArray(peers)) peerRecords = peers;
    if (Array.isArray(peers) || nextGraphics || farming !== undefined) syncPeers(peerRecords);
    if (Array.isArray(farmingEvents)) {
      const now = performance.now();
      mine.emit(farmingEvents, graphics, farmOwnerId, traveler.position);
      for (const event of farmingEvents) if (event.type === 'damage') {
        const entry = event.ownerId === farmOwnerId ? party.get(event.petId) : farmParty.get(`${event.ownerId}:${event.petId}`);
        if (entry) entry.strikeTime = now;
      }
    }
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

  function syncRewards(drops) {
    previousDropList = drops;
    const pending = new Map((drops || []).map(drop => [drop.id, drop]));
    for (const [id, reward] of rewards) {
      const next = pending.get(id);
      if (next?.expiresAt === reward.drop.expiresAt && next?.nodeId === reward.drop.nodeId) {
        reward.drop = next;
        continue;
      }
      scene.remove(reward.group);
      rewards.delete(id);
    }
    for (const [id, drop] of pending) {
      if (rewards.has(id) || drop.expiresAt <= Date.now() || !Number.isFinite(drop.x) || !Number.isFinite(drop.z)) continue;
      const group = new THREE.Group();
      const floor = groundHeight(drop.x, drop.z);
      group.position.set(drop.x, floor + .68, drop.z);
      const coin = drop.kind === 'crystal-gold' || !drop.crystals;
      const token = !coin
        ? kit.mesh(group, 'gem', rewardCrystals, 0, 0, 0, .28, .48, .28)
        : kit.mesh(group, 'beam', rewardCoins, 0, 0, 0, .32, .105, .32, [Math.PI / 2, 0, 0]);
      if (coin) {
        kit.mesh(group, 'ring', rewardCoins, 0, 0, .06, .214, .214, .214);
        kit.mesh(group, 'gem', kit.paint('#fff2ba', .13, .28), 0, 0, .067, .089, .158, .026);
      }
      const wisps = [-1, 1].map(side => kit.mesh(group, 'round', rewardTrail, side * .27, 0, -.28, .075, .075, .075));
      scene.add(group);
      rewards.set(id, { drop, group, floor, token, wisps, retryAt: 0, phase: rewards.size * 1.75 });
    }
  }

  function animateRewards(dt, time) {
    rangeRing.visible = magnetPreview;
    if (rangeRing.visible) {
      rangeRing.position.set(traveler.position.x, groundHeight(traveler.position.x, traveler.position.z) + .06, traveler.position.z);
      rangeRing.scale.set(magnet.radius, 1, magnet.radius);
    }
    const now = Date.now();
    const attracting = [...rewards.values()].filter(({ drop }) => drop.expiresAt > now &&
      Math.hypot(drop.x - traveler.position.x, drop.z - traveler.position.z) <= magnet.radius &&
      (drop.kind === 'crystal-gold' || !drop.readyAt || drop.readyAt <= now));
    const localDrops = new Set(attracting.slice(0, magnet.maxSimultaneous || 1).map(({ drop }) => drop.id));
    for (const [id, reward] of rewards) {
      const { drop, group, floor, token, wisps, phase } = reward;
      if (drop.expiresAt <= now) {
        scene.remove(group);
        rewards.delete(id);
        continue;
      }
      const moving = localDrops.has(id);
      const x = (moving ? traveler.position.x : drop.x) - group.position.x;
      const z = (moving ? traveler.position.z : drop.z) - group.position.z;
      const distance = Math.hypot(x, z);
      const pull = distance && Math.min(1, dt * (moving ? magnet.speed : 7) / distance);
      group.position.x += x * pull;
      group.position.z += z * pull;
      const targetY = moving ? traveler.position.y + .82 : floor + .68;
      const lift = graphics.reducedMotion ? 0 : Math.sin(time * 4.6 + phase) * .12;
      group.position.y = THREE.MathUtils.damp(group.position.y, targetY + lift, 6, dt);
      group.rotation.y = moving ? Math.atan2(x, z) : phase + (graphics.reducedMotion ? 0 : time * 2.1);
      token.rotation.z = moving && !graphics.reducedMotion ? -time * 5 : 0;
      for (const wisp of wisps) wisp.visible = moving && !graphics.reducedMotion && graphics.particles !== 'off';
      if (!onCollect || !moving || drop.readyAt > now || (distance > .42 && !graphics.reducedMotion) ||
          collecting.has(id) || reward.retryAt > now) continue;
      collecting.add(id);
      reward.retryAt = now + 320;
      Promise.resolve().then(() => onCollect(id)).then(accepted => {
        if (accepted === true) group.visible = false;
      }).catch(() => {}).finally(() => { collecting.delete(id); });
    }
  }

  function showBurst({ kind, nodeId, variant = 'normal', amount, currency } = {}) {
    const node = NODES.find(item => item.id === nodeId);
    const lead = kind === 'gather' && node
      ? [...party].find(([, companion]) => companion.variant === 'titanium') || party.entries().next().value
      : undefined;
    if (lead) harvestTask = { id: lead[0], node, ends: performance.now() + (lead[1].variant === 'titanium' ? 1090 : 830) };
    const source = kind === 'gather' && node ? node : traveler.position;
    const titanium = variant === 'titanium' || kind === 'titanium' || (kind === 'gather' && lead?.[1].variant === 'titanium');
    const color = new THREE.Color(titanium ? '#a7f6e8' : variantById.get(variant)?.color || '#fadd92');
    const density = graphics.reducedMotion ? 0 : (particleCount[graphics.particles] || 0) * (titanium ? 2 : 1);
    for (let index = 0; index < density; index++) {
      if (particles.length >= pointPositions.count) particles.shift();
      const angle = index / density * Math.PI * 2;
      const radius = (titanium ? 2 : .85) + Math.random() * 3;
      particles.push({ x: source.x, y: 1, z: source.z, dx: Math.cos(angle) * radius,
        dy: 2 + Math.random() * (titanium ? 3.6 : 2.4), dz: Math.sin(angle) * radius, life: .55 + Math.random() * .5, color });
    }
    if (['hatch', 'titanium'].includes(kind) && graphics.shake && !graphics.reducedMotion) shakeEnds = performance.now() + 230;
    if (['collect', 'gather'].includes(kind) && Number.isFinite(amount) && graphics.collectionNumbers) {
      effect?.label.remove();
      effect = { label: nameTag(host, `+${amount} ${currency === 'gold' ? 'Gold' : 'Sunbeams'}`), x: source.x, z: source.z, elapsed: 0 };
    }
  }

  function walkable(x, z, radius = .25) {
    return !meadow.obstacles.some(block => Math.hypot(block.x - x, block.z - z) < block.radius + radius);
  }

  function groundHeight(x, z) {
    if (Math.hypot((x / 4.35), ((z + 5.3) / 3.13)) < 1) return .23;
    const bridgeX = (x - 16.8) * .984 - (z - 10.5) * .179;
    const bridgeZ = (x - 16.8) * .179 + (z - 10.5) * .984;
    if (Math.abs(bridgeX) < 3.43 && Math.abs(bridgeZ) < 1.49) return .26 + .13 * Math.cos(bridgeX / 2.1);
    return workshop.floorHeight(x, z);
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
    if (generator.active) {
      if (desired.size) requestGeneratorStop();
      velocity.set(0, 0, 0);
      verticalSpeed = 0;
      airHeight = 0;
      const { target } = workshop;
      const span = 1 - Math.exp(-dt * 7.1);
      if (Math.hypot(target.x - traveler.position.x, target.z - traveler.position.z) <= .025) {
        traveler.position.x = target.x;
        traveler.position.z = target.z;
      } else {
        traveler.position.x = THREE.MathUtils.lerp(traveler.position.x, target.x, span);
        traveler.position.z = THREE.MathUtils.lerp(traveler.position.z, target.z, span);
      }
      const turn = angleDelta(target.heading, heading);
      heading += Math.abs(turn) <= .015 ? turn : turn * span;
    } else {
      const steps = Math.ceil(dt / .035);
      for (let step = 0; step < steps; step++) {
        const nextX = clamp(traveler.position.x + velocity.x * dt / steps, -WORLD_LIMIT, WORLD_LIMIT);
        const nextZ = clamp(traveler.position.z + velocity.z * dt / steps, -WORLD_LIMIT, WORLD_LIMIT);
        if (walkable(nextX, traveler.position.z)) traveler.position.x = nextX;
        if (walkable(traveler.position.x, nextZ)) traveler.position.z = nextZ;
      }
    }
    airHeight = Math.max(0, airHeight + verticalSpeed * dt);
    verticalSpeed = airHeight > 0 ? verticalSpeed - 21 * dt : 0;
    const floor = groundHeight(traveler.position.x, traveler.position.z);
    traveler.position.y = floor + airHeight;
    footprint.position.set(traveler.position.x, .09 + floor, traveler.position.z);
    footprint.visible = !renderer.shadowMap.enabled;
    if (velocity.lengthSq() > .1) heading += angleDelta(Math.atan2(velocity.x, velocity.z), heading) * (1 - Math.exp(-dt * 14));
    traveler.rotation.y = heading;
    const moving = traveler.position.x !== previousX || traveler.position.z !== previousZ;
    const stride = moving && !graphics.reducedMotion && !generator.active ? Math.sin(time * 11) * .57 : 0;
    traveler.userData.legs.forEach((leg, index) => { leg.rotation.x = index === 0 ? stride : -stride; });
    if (moving && performance.now() - notifyAt >= 90) {
      notifyAt = performance.now();
      onMove?.(getPosition());
    }
  }

  function findPetSlot(entry, anchor, facing, side, distance, occupied) {
    const sin = Math.sin(facing);
    const cos = Math.cos(facing);
    const margin = Math.min(entry.scale * .35, WORLD_LIMIT / 10);
    let fallback;
    for (const [lateral, back] of [[side, distance], [side, distance + 1.45], [side, distance * .57],
      [-side, distance + 1], [side * .68, -distance * .72], [0, distance + 2.65]]) {
      const x = clamp(anchor.x - sin * back + cos * lateral, -WORLD_LIMIT + margin, WORLD_LIMIT - margin);
      const z = clamp(anchor.z - cos * back - sin * lateral, -WORLD_LIMIT + margin, WORLD_LIMIT - margin);
      entry.target.set(x, 0, z);
      if (Math.hypot(x - anchor.x, z - anchor.z) < Math.min(2.4, entry.scale * .93) || !walkable(x, z, margin)) continue;
      if (!occupied?.some(other => Math.hypot(other.target.x - x, other.target.z - z) < .58 * (entry.scale + other.scale))) return;
      fallback ||= { x, z };
    }
    if (fallback) entry.target.set(fallback.x, 0, fallback.z);
  }

  function petCrossesCamera(group, scale) {
    const x = traveler.position.x;
    const y = traveler.position.y + 1.25;
    const z = traveler.position.z;
    const lineX = camera.position.x - x;
    const lineY = camera.position.y - y;
    const lineZ = camera.position.z - z;
    const bodyX = group.position.x - x;
    const bodyY = group.position.y + .88 * scale - y;
    const bodyZ = group.position.z - z;
    const length2 = lineX ** 2 + lineY ** 2 + lineZ ** 2;
    const fraction = (bodyX * lineX + bodyY * lineY + bodyZ * lineZ) / length2;
    if (!Number.isFinite(fraction) || fraction <= .025 || fraction >= .98) return false;
    return (bodyX - lineX * fraction) ** 2 + (bodyY - lineY * fraction) ** 2 +
      (bodyZ - lineZ * fraction) ** 2 < (.59 * scale) ** 2;
  }

  function placeCompanion(entry, leader, facing, index, giantIndex, dt, time, snap = false, task, occupied) {
    const huge = oversized(entry.variant);
    const slot = huge ? giantIndex : index;
    const row = Math.floor(slot / 2);
    const pair = slot % 2 ? -1 : 1;
    const tighterSpace = huge && meadow.rebirthCave?.contains(leader);
    const waiting = tighterSpace && meadow.rebirthCave.waitingArea;
    const sizeOffset = Math.max(0, entry.scale - 3);
    const side = pair * (huge ? (waiting ? 2.06 : 4.65) + sizeOffset + row * .62 : 1.25 * entry.scale + row * .66);
    const distance = huge ? (waiting ? 1.44 : 3.25) + sizeOffset + row * 3.35 : 1.68 * entry.scale + row * 1.35;
    const anchor = task || waiting || leader;
    const targetSide = task ? pair * (huge ? 1.8 + sizeOffset : .65) : side;
    const targetDistance = task ? (huge ? 1.3 + sizeOffset : .55) : distance;
    findPetSlot(entry, anchor, waiting && !task ? 0 : huge ? view.yaw : facing, targetSide, targetDistance, occupied);
    animatePet(entry, leader, facing, dt, time, snap || entry.entering, Boolean(task));
    entry.entering = false;
  }

  function placeParty(dt, time, now, snap = false) {
    let regular = 0;
    let giant = 0;
    const occupied = [];
    for (const [id, entry] of party) {
      const pose = mine.poses.get(farmOwnerId)?.get(id);
      if (pose) {
        placeMiningCompanion(entry, pose, dt, time);
        continue;
      }
      const task = harvestTask?.id === id && harvestTask.ends > now ? harvestTask.node : undefined;
      placeCompanion(entry, traveler.position, heading, regular, giant, dt, time, snap, task, occupied);
      occupied.push(entry);
      if (oversized(entry.variant)) giant++;
      else regular++;
    }
  }

  function placeMiningCompanion(entry, pose, dt, time) {
    entry.target.set(pose.x, 0, pose.z);
    animatePet(entry, traveler.position, pose.heading || 0, dt, time, false, pose.state === 'attack', pose);
    entry.entering = false;
  }

  function animatePet(entry, leader, heading, dt, time, snap, working, pose) {
    const { group, label, variant, shadow } = entry;
    const huge = oversized(variant);
    const dx = entry.target.x - group.position.x;
    const dz = entry.target.z - group.position.z;
    const distance = Math.hypot(dx, dz);
    const response = pose ? 9.5 : working ? 5.1 : huge && distance < 7 ? 2.9 : 4.4;
    const step = snap ? 1 : Math.min(1 - Math.exp(-dt * response), (huge ? 10 : 12) * dt / Math.max(.01, distance));
    const atX = group.position.x + dx * step;
    const atZ = group.position.z + dz * step;
    const margin = entry.scale * .30;
    if (snap || pose || walkable(atX, group.position.z, margin)) group.position.x = atX;
    if (snap || pose || walkable(group.position.x, atZ, margin)) group.position.z = atZ;
    const gapX = group.position.x - leader.x;
    const gapZ = group.position.z - leader.z;
    const gap = Math.hypot(gapX, gapZ);
    const clearance = .61 + .61 * entry.scale;
    if (!snap && !pose && gap > .01 && gap < clearance) {
      const span = Math.min(clearance - gap, dt * 5) / gap;
      const x = clamp(group.position.x + gapX * span, -WORLD_LIMIT, WORLD_LIMIT);
      const z = clamp(group.position.z + gapZ * span, -WORLD_LIMIT, WORLD_LIMIT);
      if (walkable(x, z, margin)) group.position.set(x, group.position.y, z);
    }
    const animating = !graphics.reducedMotion && (variant === 'normal' || graphics.rareAnimations);
    const cadence = distance > .5 ? (huge ? 4.15 : 7.3) : (huge ? 1.55 : 2.6);
    const stride = animating ? Math.sin(time * cadence + entry.target.x * .31) : 0;
    const hop = Math.abs(stride) * (huge ? .095 : .19);
    const floor = groundHeight(group.position.x, group.position.z);
    const sinceStrike = time - (entry.strikeTime ?? -1000) / 1000;
    const strike = pose && animating && sinceStrike >= 0 && sinceStrike < .31
      ? Math.sin(Math.PI * sinceStrike / .31) : 0;
    group.position.y = hop + floor + strike * (huge ? .11 : .27);
    group.rotation.x = strike * (huge ? .12 : .24);
    group.rotation.z = huge ? stride * .023 : 0;
    shadow.position.set(group.position.x, .09 + floor, group.position.z);
    group.visible = (!pose || gap < 50) && (!huge || !petCrossesCamera(group, entry.scale));
    shadow.visible = group.visible && !renderer.shadowMap.enabled;
    if (snap) group.rotation.y = heading;
    else {
      const facing = !working && distance > .35 ? Math.atan2(dx, dz) : heading;
      group.rotation.y += angleDelta(facing, group.rotation.y) * (1 - Math.exp(-dt * (huge ? 3 : 6.5)));
    }
    if (group.userData.aura) {
      group.userData.aura.visible = graphics.petGlow && (variant !== 'shiny' || graphics.shinyEffects);
      if (animating && group.userData.aura.visible) group.userData.aura.rotation.z = time * .74;
    }
    group.userData.wings?.forEach((wing, index) => { wing.rotation.z = animating ? Math.sin(time * 7.2) * .24 * (index ? 1 : -1) : 0; });
    rootPoint(group.position, label, 2.04 * entry.scale, graphics.showPetNames && group.visible);
  }

  function draw(now) {
    if (destroyed) return;
    frame = requestAnimationFrame(draw);
    const active = held.size || touch.size || pointer || airHeight > 0 || particles.length || rewards.size || mine.active || generator.active || velocity.lengthSq() > .02;
    const minimumInterval = graphics.quality === 'low' ? (active ? 30 : 50) : (active ? 0 : 28);
    if (prior && now - prior < minimumInterval) return;
    const dt = prior ? clamp((now - prior) / 1000, 0, .14) : .016;
    prior = now;
    if (document.hidden || viewportWidth <= 1 || viewportHeight <= 1) return;
    const time = now / 1000;
    updateTraveler(dt, time);
    workshop.update(dt, { ...generator, reducedMotion: graphics.reducedMotion }, traveler);
    meadow.rebirthCave?.update(traveler.position, { reducedMotion: graphics.reducedMotion });
    animateRewards(dt, time);

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

    const insideCave = meadow.rebirthCave?.contains(traveler.position);
    const zoom = (insideCave ? Math.min(view.distance, 12.6) : view.distance) * (camera.aspect < 1 ? 1.14 : 1);
    const tilt = insideCave ? Math.max(.68, view.tilt) : view.tilt;
    const horizontal = Math.cos(tilt) * zoom;
    cameraTarget.set(traveler.position.x + horizontal * Math.sin(view.yaw), 1.3 + Math.sin(tilt) * zoom,
      traveler.position.z + horizontal * Math.cos(view.yaw));
    if (now < shakeEnds) cameraTarget.x += Math.sin(now * .21) * (shakeEnds - now) / 240 * .15;
    cameraFocus.set(traveler.position.x - Math.sin(view.yaw) * 2, 1.47, traveler.position.z - Math.cos(view.yaw) * 2);
    if (!cameraInitialized || graphics.reducedMotion) camera.position.copy(cameraTarget);
    else camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 8.2));
    cameraInitialized = true;
    camera.lookAt(cameraFocus);
    camera.updateMatrixWorld();

    mine.animate(dt, time, traveler.position, graphics);
    placeParty(dt, time, now);
    for (const entry of farmParty.values()) placeMiningCompanion(entry, entry.pose, dt, time);
    for (const entry of otherPlayers.values()) {
      const walking = entry.group.position.distanceToSquared(entry.target) > .009;
      entry.group.position.lerp(entry.target, 1 - Math.exp(-dt * 12));
      entry.group.rotation.y += angleDelta(entry.direction, entry.group.rotation.y) * (1 - Math.exp(-dt * 12));
      const stride = walking && !graphics.reducedMotion ? Math.sin(time * 11 + entry.target.x) * .52 : 0;
      entry.group.userData.legs.forEach((leg, index) => { leg.rotation.x = index ? -stride : stride; });
      rootPoint(entry.group.position, entry.label, 2.43);
      if (entry.companion) placeCompanion(entry.companion, entry.group.position, entry.group.rotation.y, 0, 0, dt, time);
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
    for (const entry of [...party.values(), ...otherPlayers.values(), ...farmParty.values()]) entry.label?.remove();
    effect?.label.remove();
    for (const entry of otherPlayers.values()) entry.companion?.label.remove();
    mine.destroy();
    disposeScene(scene, kit);
    rewardTrail.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  } };
}
