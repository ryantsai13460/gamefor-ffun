const field = (id, label, x, z, radius, level, rebirths) => Object.freeze({ id, label, x, z, radius, level, rebirths });

export const FARM_AREAS = Object.freeze([
  field('sunstep', 'Sunstep Field', 0, 16, 9, 1, 0),
  field('fernwild', 'Fernwild Grove', 17, -8, 8, 2, 0),
  field('ember-verge', 'Ember Verge', -2, -20, 8, 3, 1)
]);

const priority = (id, label) => Object.freeze({ id, label });
export const FARM_PRIORITIES = Object.freeze([
  priority('balanced', 'Balanced Farming'),
  priority('nearest', 'Nearest Crystal'),
  priority('value', 'Highest Value Crystal'),
  priority('low-health', 'Lowest Health Crystal'),
  priority('strongest', 'Strongest Crystal'),
  priority('special', 'Special Crystal Priority')
]);

const family = (id, label, color, glow, maxHealth, gold, crystals, respawnMs, radius, slots) =>
  Object.freeze({ id, label, color, glow, maxHealth, gold, crystals, respawnMs, radius, slots });

export const CRYSTAL_FAMILIES = Object.freeze([
  family('sun-glass', 'Sunglass', '#edac71', '#fff1b5', 12, 9, 1, 5_800, .58, 1),
  family('moss-opal', 'Moss Opal', '#62b685', '#ccffd0', 26, 17, 2, 6_800, .83, 2),
  family('honey-spire', 'Honeyspire', '#c98852', '#ffd17d', 43, 27, 2, 8_000, .99, 3),
  family('ember-crown', 'Ember Crown', '#b4666b', '#ffbb86', 70, 41, 3, 9_600, 1.12, 3),
  family('star-quartz', 'Star Quartz', '#9774bd', '#e7ceff', 112, 65, 4, 11_200, 1.24, 4)
]);

const sitesByArea = {
  sunstep: [
    [2.1, 12.8, 'sun-glass'], [1.85, 8.9, 'sun-glass'], [-3.8, 14.5, 'sun-glass'],
    [7.4, 15.0, 'moss-opal'], [-6.1, 18.9, 'moss-opal'], [4.6, 20.3, 'sun-glass'],
    [-.1, 23.8, 'honey-spire']
  ],
  fernwild: [
    [17, -7, 'moss-opal'], [13.2, -6.6, 'moss-opal'], [19.8, -4.25, 'moss-opal'],
    [20.9, -10.8, 'honey-spire'], [17.2, -13.6, 'honey-spire'], [23.6, -6.9, 'honey-spire'],
    [12.65, -11.75, 'ember-crown']
  ],
  'ember-verge': [
    [-6.3, -19, 'ember-crown'], [0, -22.7, 'ember-crown'], [3.2, -20.7, 'honey-spire'],
    [-5.1, -24.9, 'star-quartz'], [.4, -16.5, 'honey-spire'], [-3, -15.5, 'honey-spire'],
    [3.6, -24, 'star-quartz']
  ]
};

export const CRYSTAL_SITES = Object.freeze(FARM_AREAS.flatMap(({ id: areaId }) =>
  sitesByArea[areaId].map(([x, z, familyId], index) => Object.freeze({ id: `${areaId}-${index + 1}`, areaId, x, z, familyId }))));

const siteById = new Map(CRYSTAL_SITES.map(site => [site.id, site]));
const areaById = new Map(FARM_AREAS.map(area => [area.id, area]));
const familyById = new Map(CRYSTAL_FAMILIES.map(spec => [spec.id, spec]));
const priorityIds = new Set(FARM_PRIORITIES.map(option => option.id));

const WORKSHOP_OBSTACLES = [[-14.08, 20.72, 1.46], [-16.93, 19.24, .28], [-11.07, 19.24, .28], [-11.80, 21.25, .70]];
const CAVE_OBSTACLES = [
  [-22, -19, .94], [-19.45, -20.4, .48],
  ...[-1, 1].flatMap(side => [-3.88, -2.28, -.68, .92, 2.52, 4.06].map(z =>
    [-22 + side * (z > 2.4 ? 3.38 : 3.85), -19 + z, .91])),
  ...[-3.1, -1.55, 0, 1.55, 3.1].map(x => [-22 + x, -23.88, .89])
];

export const FARM_OBSTACLES = Object.freeze([
  [-12.2, -6, 2.4], [-3.08, -2.75, .82], [3.08, -2.75, .82],
  [7.06, 13.51, .34], [10.41, 12.52, .34], [8.8, 12.99, .63],
  ...WORKSHOP_OBSTACLES, ...CAVE_OBSTACLES
].map(([x, z, radius]) => Object.freeze({ x, z, radius })));

const WORLD_SPAN = 27;
const FOLLOW_RADIUS = 6.7;
const MAX_TICK_SECONDS = .25;
const GRID_SIDE = 2 * WORLD_SPAN + 1;
const GRID_SIZE = GRID_SIDE ** 2;
const GRID_NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
const ROUTES_PER_TICK = 4;
const ROUTE_CACHE_SIZE = 96;
const ANGLE_STEP = Math.PI / 6;
const defaultStats = () => ({ damage: 4, attackRate: 1, moveSpeed: 4 });
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const bounded = ({ x, z }) => Math.abs(x) <= WORLD_SPAN && Math.abs(z) <= WORLD_SPAN;
const rounded = value => Math.round(value * 100) / 100;

export function crystalAtId(id) {
  return siteById.get(id);
}

export function farmingAreaAt(position) {
  if (!position || !bounded(position)) return null;
  return FARM_AREAS.find(area => gap(position, area) <= area.radius) ?? null;
}

export function canFarmArea(progress, areaId) {
  const area = areaById.get(areaId);
  if (!area || !progress) return false;
  const minimumXp = 12 * area.level * (area.level - 1);
  return (progress.xp || 0) >= minimumXp && (progress.rebirths || 0) >= area.rebirths;
}

export function farmSettings(progress) {
  const farm = progress?.farming;
  return {
    area: canFarmArea(progress, farm?.area) ? farm.area : null,
    enabled: farm?.enabled !== false,
    policy: priorityIds.has(farm?.policy) ? farm.policy : 'balanced',
    preferSpecial: farm?.preferSpecial === true
  };
}

function gridPoint(index) {
  return { x: index % GRID_SIDE - WORLD_SPAN, z: Math.floor(index / GRID_SIDE) - WORLD_SPAN };
}

function navigator(obstacles) {
  const grids = new Map();

  function segmentOpen(from, to, margin) {
    if (!bounded(to)) return false;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSquared = dx * dx + dz * dz;
    return obstacles.every(block => {
      const bx = block.x - from.x;
      const bz = block.z - from.z;
      const distance = (bx * dx + bz * dz) / (lengthSquared || 1);
      const ratio = Math.max(0, Math.min(1, distance));
      return (bx - dx * ratio) ** 2 + (bz - dz * ratio) ** 2 >= (block.radius + margin) ** 2;
    });
  }

  function grid(margin) {
    if (!grids.has(margin)) {
      const open = new Uint8Array(GRID_SIZE);
      for (let index = 0; index < GRID_SIZE; index++) {
        const point = gridPoint(index);
        open[index] = Number(segmentOpen(point, point, margin));
      }
      grids.set(margin, { open, links: new Int16Array(GRID_SIZE).fill(-1), paths: new Map() });
    }
    return grids.get(margin);
  }

  function closestCell(point, margin, connect) {
    const { open } = grid(margin);
    let result = -1;
    let nearest = Infinity;
    for (let z = Math.max(-WORLD_SPAN, Math.round(point.z) - 2); z <= Math.min(WORLD_SPAN, Math.round(point.z) + 2); z++) {
      for (let x = Math.max(-WORLD_SPAN, Math.round(point.x) - 2); x <= Math.min(WORLD_SPAN, Math.round(point.x) + 2); x++) {
        const index = (z + WORLD_SPAN) * GRID_SIDE + x + WORLD_SPAN;
        if (!open[index]) continue;
        const cell = { x, z };
        const distance = gap(point, cell);
        if (distance >= nearest || connect && !segmentOpen(point, cell, margin)) continue;
        nearest = distance;
        result = index;
      }
    }
    return result;
  }

  function freePoint(point, margin) {
    if (segmentOpen(point, point, margin)) return point;
    const cell = closestCell(point, margin, false);
    return cell >= 0 ? gridPoint(cell) : null;
  }

  function gridLinks(grid, index, margin) {
    if (grid.links[index] >= 0) return grid.links[index];
    const point = gridPoint(index);
    let links = 0;
    for (let bit = 0; bit < GRID_NEIGHBORS.length; bit++) {
      const [dx, dz] = GRID_NEIGHBORS[bit];
      const next = { x: point.x + dx, z: point.z + dz };
      if (bounded(next) && grid.open[index + dx + dz * GRID_SIDE] && segmentOpen(point, next, margin)) links |= 1 << bit;
    }
    return grid.links[index] = links;
  }

  function gridRoute(start, finish, margin) {
    const map = grid(margin);
    const routeId = start * GRID_SIZE + finish;
    if (map.paths.has(routeId)) return map.paths.get(routeId);
    const source = new Int16Array(GRID_SIZE).fill(-1);
    const queue = new Int16Array(GRID_SIZE);
    let head = 0;
    let tail = 1;
    source[start] = start;
    queue[0] = start;
    while (head < tail && source[finish] < 0) {
      const index = queue[head++];
      const links = gridLinks(map, index, margin);
      for (let bit = 0; bit < GRID_NEIGHBORS.length; bit++) {
        if (!(links & (1 << bit))) continue;
        const [dx, dz] = GRID_NEIGHBORS[bit];
        const key = index + dx + dz * GRID_SIDE;
        if (source[key] >= 0) continue;
        source[key] = index;
        queue[tail++] = key;
      }
    }
    let route = null;
    if (source[finish] >= 0) {
      route = [gridPoint(finish)];
      for (let index = finish; index !== start; index = source[index]) route.push(gridPoint(source[index]));
      route.reverse();
    }
    if (map.paths.size >= ROUTE_CACHE_SIZE) map.paths.delete(map.paths.keys().next().value);
    map.paths.set(routeId, route);
    return route;
  }

  function route(from, to, margin) {
    const start = closestCell(from, margin, true);
    const finish = closestCell(to, margin, true);
    if (start < 0 || finish < 0) return null;
    const cells = gridRoute(start, finish, margin);
    if (!cells) return null;
    const path = [...cells, to];
    const waypoints = [];
    let last = from;
    for (let index = 0; index < path.length;) {
      let furthest = path.length - 1;
      while (furthest > index && !segmentOpen(last, path[furthest], margin)) furthest--;
      last = path[furthest];
      waypoints.push(last);
      index = furthest + 1;
    }
    return waypoints;
  }

  return { segmentOpen, freePoint, route };
}

function newCrystal(site) {
  const spec = familyById.get(site.familyId);
  return { site, spec, health: spec.maxHealth, maxHealth: spec.maxHealth, gold: spec.gold,
    crystals: spec.crystals, slots: spec.slots, readyAt: 0, specialTier: 0, contributions: new Map(),
    luck: 0, specialUnlocked: false };
}

function chooseSpecial(crystal, random) {
  const roll = random();
  if (crystal.specialUnlocked && roll < .006 + crystal.luck * .002) return 2;
  return roll < .025 + crystal.luck * .011 ? 1 : 0;
}

function readyCrystal(crystal, random) {
  const { spec } = crystal;
  const specialTier = chooseSpecial(crystal, random);
  const multiplier = [1, 1.65, 2.4][specialTier];
  crystal.specialTier = specialTier;
  crystal.health = crystal.maxHealth = Math.ceil(spec.maxHealth * multiplier);
  crystal.gold = Math.round(spec.gold * [1, 2.35, 4][specialTier]);
  crystal.crystals = spec.crystals + [0, 1, 3][specialTier];
  crystal.slots = spec.slots + Number(specialTier > 0);
  crystal.readyAt = 0;
}

function targetMetric(policy, pet, crystal, occupants) {
  const distance = gap(pet, crystal.site);
  if (policy === 'nearest') return distance;
  if (policy === 'value') return -crystal.gold;
  if (policy === 'low-health') return crystal.health;
  if (policy === 'strongest') return -crystal.maxHealth;
  if (policy === 'special') return -crystal.specialTier * 100 + distance;
  return distance + 3.5 * (occupants.length / crystal.slots) + .06 * crystal.health;
}

function compareTargets(policy, pet, occupied, preferSpecial) {
  return (left, right) =>
    (preferSpecial ? right.specialTier - left.specialTier : 0) ||
    targetMetric(policy, pet, left, occupied.get(left.site.id) || []) -
      targetMetric(policy, pet, right, occupied.get(right.site.id) || []) ||
    left.site.id.localeCompare(right.site.id);
}

export function createFarmingWorld({ stats = defaultStats, random = Math.random, obstacles = FARM_OBSTACLES } = {}) {
  const crystals = new Map(CRYSTAL_SITES.map(site => [site.id, newCrystal(site)]));
  const crystalsByArea = new Map(FARM_AREAS.map(area => [area.id, CRYSTAL_SITES.filter(site => site.areaId === area.id)
    .map(site => crystals.get(site.id))]));
  const pets = new Map();
  const attackReadyAt = new Map();
  const nav = navigator(obstacles);
  let nextEvent = 1;
  let lastTick;
  let targeted = new Map();
  let routeBudget = 0;

  function emit(events, type, crystal, detail = {}) {
    events.push({ id: nextEvent++, type, crystalId: crystal.site.id, areaId: crystal.site.areaId,
      familyId: crystal.site.familyId, x: crystal.site.x, z: crystal.site.z, specialTier: crystal.specialTier, ...detail });
  }

  function movePet(pet, goal, dt, now) {
    if (!goal) return false;
    const distance = gap(pet, goal);
    if (distance < .08) return true;
    if (goal !== pet.goal) {
      pet.goal = goal;
      pet.waypoints = null;
      pet.retryAt = 0;
    }
    if (!dt) return false;
    if (!pet.waypoints && now >= pet.retryAt) {
      if (nav.segmentOpen(pet, goal, pet.margin)) pet.waypoints = [goal];
      else {
        if (!routeBudget) return false;
        routeBudget--;
        pet.waypoints = nav.route(pet, goal, pet.margin);
      }
      pet.retryAt = now + 900;
    }
    const next = pet.waypoints?.[0];
    if (!next) return false;
    const dx = next.x - pet.x;
    const dz = next.z - pet.z;
    const travel = Math.hypot(dx, dz);
    if (travel > .001) {
      const speed = Math.max(.1, pet.combat.moveSpeed);
      const ratio = Math.min(1, speed * dt / travel);
      pet.x += dx * ratio;
      pet.z += dz * ratio;
      pet.heading = Math.atan2(dx, dz);
    }
    if (gap(pet, next) < .06) pet.waypoints.shift();
    return gap(pet, goal) < .08;
  }

  function assignTarget(pet, crystal, occupied) {
    const { site, spec } = crystal;
    const angle = Math.atan2(pet.z - site.z, pet.x - site.x);
    const radius = spec.radius + pet.margin + .29;
    for (let attempt = 0; attempt < 12; attempt++) {
      const offset = Math.ceil(attempt / 2) * (attempt % 2 ? 1 : -1) * ANGLE_STEP;
      const goal = { x: site.x + Math.cos(angle + offset) * radius, z: site.z + Math.sin(angle + offset) * radius };
      if (!nav.segmentOpen(goal, goal, pet.margin)) continue;
      if (occupied.some(other => gap(other.attackGoal, goal) < other.margin + pet.margin + .18)) continue;
      pet.crystal = crystal;
      pet.attackGoal = goal;
      occupied.push(pet);
      return true;
    }
    return false;
  }

  function eligible(crystal, context) {
    return crystal.health > 0 && (context.fixed || gap(crystal.site, context.owner.position) <= FOLLOW_RADIUS);
  }

  function roster(players) {
    const owners = new Map();
    const present = new Set();
    for (const owner of players) {
      if (typeof owner?.id !== 'string' || !bounded(owner.position || {}) || owners.has(owner.id)) continue;
      owners.set(owner.id, owner);
      const settings = farmSettings(owner.progress);
      const fixed = areaById.get(settings.area);
      const area = fixed || farmingAreaAt(owner.position);
      if (!area || !canFarmArea(owner.progress, area.id) || !settings.enabled && !fixed) continue;
      const { equipped, inventory } = owner.progress;
      const equippedIds = new Set(equipped);
      const context = { owner, settings, fixed, area };
      const key = `${area.id}/${Boolean(fixed)}/${settings.enabled}/${settings.policy}/${settings.preferSpecial}`;
      for (const spec of inventory) {
        if (!equippedIds.has(spec.id)) continue;
        const id = `${owner.id}/${spec.id}`;
        present.add(id);
        const margin = spec.variant === 'titanium' || spec.variant === 'giant' ? .76 : .30;
        let pet = pets.get(id);
        if (!pet) {
          const spawn = nav.freePoint(owner.position, margin);
          if (!spawn) continue;
          pet = { x: spawn.x, z: spawn.z, heading: owner.position.heading || 0, id: spec.id, ownerId: owner.id,
            runtimeId: id, state: 'wait', retryAt: 0 };
          pets.set(id, pet);
        }
        if (pet.key !== key || pet.margin !== margin) pet.crystal = null;
        pet.key = key;
        pet.margin = margin;
        pet.spec = spec;
        pet.context = context;
        pet.combat = stats(spec, owner.progress);
      }
    }
    for (const id of pets.keys()) if (!present.has(id)) pets.delete(id);
    for (const crystal of crystals.values()) {
      for (const ownerId of crystal.contributions.keys()) if (!owners.has(ownerId)) crystal.contributions.delete(ownerId);
    }
    return owners;
  }

  function chooseTargets() {
    const occupied = new Map();
    for (const pet of pets.values()) {
      const crystal = pet.crystal;
      if (!crystal) continue;
      const group = occupied.get(crystal.site.id) || [];
      if (!pet.context.settings.enabled || !eligible(crystal, pet.context) || group.length >= crystal.slots) {
        pet.crystal = null;
        continue;
      }
      group.push(pet);
      occupied.set(crystal.site.id, group);
    }
    for (const pet of pets.values()) {
      const { settings, area } = pet.context;
      if (!settings.enabled || pet.crystal && !settings.preferSpecial && settings.policy !== 'special') continue;
      const prior = pet.crystal;
      const options = crystalsByArea.get(area.id).filter(crystal => eligible(crystal, pet.context) &&
        (!prior || crystal.specialTier > prior.specialTier) &&
        (occupied.get(crystal.site.id)?.length || 0) < crystal.slots)
        .sort(compareTargets(settings.policy, pet, occupied, settings.preferSpecial));
      for (const crystal of options) {
        const group = occupied.get(crystal.site.id) || [];
        if (!assignTarget(pet, crystal, group)) continue;
        if (prior) occupied.set(prior.site.id, occupied.get(prior.site.id).filter(member => member !== pet));
        occupied.set(crystal.site.id, group);
        break;
      }
    }
    return occupied;
  }

  function damageCrystal(pet, crystal, now, scheduledAt, owners, award, events) {
    const damage = Math.min(crystal.health, Math.max(1, Math.floor(pet.combat.damage)));
    attackReadyAt.set(pet.runtimeId, scheduledAt + 1000 / Math.max(.05, pet.combat.attackRate));
    const priorDamage = crystal.contributions.get(pet.ownerId) || 0;
    let applied = damage;
    let ownerId;
    if (damage === crystal.health) {
      const totals = new Map(crystal.contributions).set(pet.ownerId, priorDamage + damage);
      const candidates = [...totals].sort(([first, firstScore], [second, secondScore]) =>
        secondScore - firstScore || first.localeCompare(second));
      ownerId = candidates[0][0];
      const reward = { crystalId: crystal.site.id, areaId: crystal.site.areaId, x: crystal.site.x, z: crystal.site.z, gold: crystal.gold,
        crystals: crystal.crystals, specialTier: crystal.specialTier, now };
      try {
        if (award(ownerId, reward) === false) applied = damage - 1;
      } catch {
        applied = damage - 1;
      }
    }
    if (!applied) return;
    crystal.health -= applied;
    crystal.contributions.set(pet.ownerId, priorDamage + applied);
    emit(events, 'damage', crystal, { damage: applied, ownerId: pet.ownerId, petId: pet.id });
    if (crystal.health > 0) return;
    const { progress } = owners.get(ownerId);
    crystal.luck = Math.max(0, Math.min(5, progress.upgrades?.specialCrystalLuck || 0));
    crystal.specialUnlocked = progress.rebirths > 0 || progress.xp >= 144;
    crystal.readyAt = now + crystal.spec.respawnMs;
    crystal.contributions.clear();
    emit(events, 'break', crystal, { ownerId, petId: pet.id, gold: crystal.gold });
  }

  function advance(players, now, award = () => false) {
    if (!Number.isFinite(now) || lastTick !== undefined && now < lastTick) return [];
    const dt = lastTick === undefined ? 0 : Math.min(MAX_TICK_SECONDS, (now - lastTick) / 1000);
    lastTick = now;
    routeBudget = ROUTES_PER_TICK;
    const tickStart = now - dt * 1000;
    for (const [id, deadline] of attackReadyAt) if (deadline < tickStart) attackReadyAt.delete(id);
    const owners = roster(players);
    const events = [];
    for (const crystal of crystals.values()) {
      if (!crystal.readyAt || crystal.readyAt > now) continue;
      readyCrystal(crystal, random);
      emit(events, 'respawn', crystal);
    }
    targeted = chooseTargets();
    const resting = new Map();
    for (const pet of pets.values()) {
      const crystal = pet.crystal;
      if (!crystal || !crystal.health) {
        pet.crystal = null;
        pet.state = 'wait';
        const { fixed, owner } = pet.context;
        if (fixed) {
          const index = resting.get(pet.ownerId) || 0;
          resting.set(pet.ownerId, index + 1);
          if (!pet.rest || pet.rest.area !== fixed.id || pet.rest.index !== index) {
            const angle = index * Math.PI * .764;
            const span = pet.margin * 1.9 + 1.32;
            pet.rest = { area: fixed.id, index, goal: nav.freePoint({ x: fixed.x + Math.cos(angle) * span,
              z: fixed.z + Math.sin(angle) * span }, pet.margin) };
          }
          movePet(pet, pet.rest.goal, dt, now);
        } else {
          // Following is rendered separately. Start the next trip from the current party.
          const follow = nav.freePoint(owner.position, pet.margin);
          if (follow) { pet.x = follow.x; pet.z = follow.z; }
          pet.goal = null;
        }
        continue;
      }
      pet.state = 'travel';
      if (!movePet(pet, pet.attackGoal, dt, now)) continue;
      pet.heading = Math.atan2(crystal.site.x - pet.x, crystal.site.z - pet.z);
      pet.state = 'attack';
      const scheduledAt = attackReadyAt.get(pet.runtimeId) ?? now;
      // Preserve fractional cadence between ticks. Time spent away cannot stack attacks.
      if (scheduledAt <= now) damageCrystal(pet, crystal, now, scheduledAt, owners, award, events);
    }
    return events;
  }

  function snapshot() {
    return {
      crystals: Array.from(crystals.values(), crystal => ({ ...crystal.site, health: crystal.health,
        maxHealth: crystal.maxHealth, readyAt: crystal.readyAt, targeted: crystal.health ? (targeted.get(crystal.site.id)?.length || 0) : 0,
        specialTier: crystal.specialTier })),
      pets: Array.from(pets.values()).filter(pet => pet.crystal || pet.context.fixed).map(pet => ({
        ownerId: pet.ownerId, id: pet.id, speciesId: pet.spec.speciesId, variant: pet.spec.variant,
        x: rounded(pet.x), z: rounded(pet.z), heading: rounded(pet.heading), state: pet.state,
        targetId: pet.crystal?.health > 0 ? pet.crystal.site.id : null
      }))
    };
  }

  return { advance, snapshot };
}
