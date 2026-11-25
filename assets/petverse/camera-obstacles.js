function firstSolidHit(start, end, block, floorHeight, margin) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const x = start.x - block.x;
  const z = start.z - block.z;
  const radius = block.radius + margin;
  const a = dx * dx + dz * dz;
  const b = x * dx + z * dz;
  const c = x * x + z * z - radius * radius;
  let near = 0;
  let far = 1;
  if (a > .00001) {
    const discriminant = b * b - a * c;
    if (discriminant < 0) return Infinity;
    const span = Math.sqrt(discriminant);
    near = Math.max(0, (-b - span) / a);
    far = Math.min(1, (-b + span) / a);
  } else if (c > 0) {
    return Infinity;
  }
  const base = block.base ?? floorHeight(block.x, block.z);
  const bottom = base - margin;
  const top = base + (block.height ?? Math.min(5.5, 1.1 + block.radius * 2.35)) + margin;
  if (Math.abs(dy) > .00001) {
    const atBottom = (bottom - start.y) / dy;
    const atTop = (top - start.y) / dy;
    near = Math.max(near, Math.min(atBottom, atTop));
    far = Math.min(far, Math.max(atBottom, atTop));
  } else if (start.y < bottom || start.y > top) {
    return Infinity;
  }
  // The pivot can sit in the camera's extra clearance when the avatar hugs a wall.
  // A ray that begins in this clearance and moves directly away is safe.
  if (near <= .001 && b > 0 && c <= 0) return Infinity;
  return near <= far ? near : Infinity;
}

export function cameraClearance(start, desired, obstacles, floorHeight, margin = .25) {
  const dx = desired.x - start.x;
  const dy = desired.y - start.y;
  const dz = desired.z - start.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < .001) return 1;
  let limit = 1;
  for (const block of obstacles) {
    // Cheap rectangle rejection saves the cylinder calculation on distant trees/walls.
    const radius = block.radius + margin;
    if (block.x + radius < Math.min(start.x, desired.x) || block.x - radius > Math.max(start.x, desired.x) ||
        block.z + radius < Math.min(start.z, desired.z) || block.z - radius > Math.max(start.z, desired.z)) continue;
    limit = Math.min(limit, firstSolidHit(start, desired, block, floorHeight, margin));
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) * limit / .85));
  for (let step = 1; step <= steps; step++) {
    const fraction = limit * step / steps;
    if (start.y + dy * fraction >= floorHeight(start.x + dx * fraction, start.z + dz * fraction) + margin) continue;
    let near = limit * (step - 1) / steps;
    let far = fraction;
    for (let detail = 0; detail < 5; detail++) {
      const mid = (near + far) * .5;
      if (start.y + dy * mid >= floorHeight(start.x + dx * mid, start.z + dz * mid) + margin) near = mid;
      else far = mid;
    }
    limit = near;
    break;
  }
  return limit < 1 ? Math.max(0, limit - .10 / distance) : 1;
}
