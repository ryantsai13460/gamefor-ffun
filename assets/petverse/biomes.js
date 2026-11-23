export const WORLD_EXTENT = 54;
export const BIOME_BOUNDARY = 11.6;
export const EXPEDITION_STATION_RADIUS = 3.4;
export const MEADOW_ARRIVAL = Object.freeze({ x: 0, z: 11, heading: 0 });

const point = (x, z) => Object.freeze({ x, z });
const arrival = (x, z, heading) => Object.freeze({ x, z, heading });

export const EXPEDITION_BIOMES = Object.freeze([
  Object.freeze({ id: 'glasswater', label: 'Glasswater Coast', theme: 'coast', x: 43, z: 11, radius: 9, level: 3, rebirths: 0,
    eggId: 'glasswater-shell', entry: point(31, 11), egg: point(45, 5), arrival: arrival(38, 11, Math.PI / 2),
    description: 'Tidal pools, pearlstone outcrops, and five shoreline companions.' }),
  Object.freeze({ id: 'frostpine', label: 'Frostpine Reach', theme: 'frost', x: 3, z: -42, radius: 9, level: 5, rebirths: 1,
    eggId: 'frostpine-egg', entry: point(3, -30), egg: point(9, -43), arrival: arrival(3, -37, Math.PI),
    description: 'Snowy pines, frozen rime hearts, and quick alpine companions.' }),
  Object.freeze({ id: 'cinderbloom', label: 'Cinderbloom Basin', theme: 'cinder', x: -43, z: 5, radius: 9, level: 7, rebirths: 2,
    eggId: 'cinderbloom-egg', entry: point(-31, 5), egg: point(-44, -1), arrival: arrival(-38, 5, -Math.PI / 2),
    description: 'Basalt spires, glowing geodes, and the strongest expedition companions.' })
]);

const byId = new Map(EXPEDITION_BIOMES.map(biome => [biome.id, biome]));

export const EXPEDITION_LAND = Object.freeze([Object.freeze({ x: 0, z: 0, radius: 38.2 }),
  ...EXPEDITION_BIOMES.map(({ x, z }) => Object.freeze({ x, z, radius: 13 }))]);

export function biomeAt(position) {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position.z)) return null;
  return EXPEDITION_BIOMES.find(biome => Math.hypot(position.x - biome.x, position.z - biome.z) <= BIOME_BOUNDARY) || null;
}

export function canEnterBiome(progress, id) {
  if (id === 'meadow') return true;
  const biome = byId.get(id);
  return Boolean(biome && (progress?.xp || 0) >= 12 * biome.level * (biome.level - 1) &&
    (progress?.rebirths || 0) >= biome.rebirths);
}

export function isExpeditionLand(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > WORLD_EXTENT || Math.abs(z) > WORLD_EXTENT) return false;
  return EXPEDITION_LAND.some(land => Math.hypot(x - land.x, z - land.z) <= land.radius);
}

export function mayEnterExpeditionBiome(progress, x, z, from) {
  if (!isExpeditionLand(x, z)) return false;
  const biome = biomeAt({ x, z });
  if (!biome || canEnterBiome(progress, biome.id)) return true;
  // An existing position can leave a locked biome by moving outward.
  return biomeAt(from) === biome && Math.hypot(x - biome.x, z - biome.z) > Math.hypot(from.x - biome.x, from.z - biome.z);
}

export function expeditionDestination(progress, id) {
  if (id === 'meadow') return MEADOW_ARRIVAL;
  const biome = byId.get(id);
  return biome && canEnterBiome(progress, id) ? biome.arrival : null;
}

export function expeditionEggAt(position, id) {
  const egg = byId.get(id)?.egg;
  return Boolean(egg && Number.isFinite(position?.x) && Number.isFinite(position.z) &&
    Math.hypot(position.x - egg.x, position.z - egg.z) <= EXPEDITION_STATION_RADIUS);
}
