import * as THREE from './vendor/three/three.module.min.js';

const TAU = Math.PI * 2;
const bankRadius = 38.9;
const creek = [
  [17.6, -23.2], [16.4, -17.4], [19, -7.3], [16.3, .4],
  [17.3, 8], [18.1, 17.5], [20.8, 29.5], [20.3, 33.1]
];
const hills = [
  [-10.6, 12.2, 8.9, 9.1, 2.65], [9.7, 20.8, 8.3, 7.8, 1.7],
  [-21, 2.2, 9.4, 8.3, 3.0], [8.5, -14.1, 9.1, 8.2, 2.75],
  [-11.7, -20.3, 6.8, 7.3, 2.2], [-23.7, 14.1, 8.6, 8.4, 3.0],
  [24.8, -15.7, 5.9, 9.4, 2.45], [8.5, -27.9, 7.5, 7.5, 2.55]
];

function smooth(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function sunstepCreekDistance(x, z) {
  let closest = Infinity;
  for (let index = 1; index < creek.length; index++) {
    const [aX, aZ] = creek[index - 1];
    const [bX, bZ] = creek[index];
    const dx = bX - aX;
    const dz = bZ - aZ;
    const t = Math.max(0, Math.min(1, ((x - aX) * dx + (z - aZ) * dz) / (dx * dx + dz * dz)));
    closest = Math.min(closest, Math.hypot(x - aX - dx * t, z - aZ - dz * t));
  }
  return closest;
}

// Each authored clearing blends into its surroundings while keeping the interaction point level.
export function createSunstepHeight(anchors) {
  return (x, z) => {
    let elevation = 0;
    const distance = Math.hypot(x, z);
    if (distance >= 36) return 0;
    for (const [hillX, hillZ, wide, long, height] of hills) {
      const dx = (x - hillX) / wide;
      const dz = (z - hillZ) / long;
      const rise = 1 - dx * dx - dz * dz;
      if (rise > 0) elevation += height * rise ** 2.25;
    }
    if (!elevation) return 0;
    let clearance = Math.min(1 - smooth(31, 36, distance), smooth(3.3, 6.2, sunstepCreekDistance(x, z)));
    for (const { x: nearX, z: nearZ, radius } of anchors) {
      clearance = Math.min(clearance, smooth(radius, radius + 4.8, Math.hypot(x - nearX, z - nearZ)));
      if (clearance === 0) return 0;
    }
    return elevation * clearance;
  };
}

export function buildSunstepSurface(terrainHeight, colorPatches) {
  const segments = 96;
  const rings = 66;
  const positions = [0, terrainHeight(0, 0), 0];
  const colors = [];
  const indices = [];
  const root = new THREE.Color('#86ae79');
  const low = new THREE.Color('#6a9a76');
  const upper = new THREE.Color('#aac181');
  const dry = new THREE.Color('#b5ba7d');
  const tint = new THREE.Color();
  function shade(x, y, z) {
    const wave = Math.sin(x * .19 + Math.sin(z * .17)) * Math.cos(z * .24 - Math.sin(x * .25));
    tint.copy(root).lerp(low, .26 + wave * .24).lerp(upper, Math.min(.68, y * .19));
    const rim = smooth(29, bankRadius, Math.hypot(x, z));
    tint.lerp(dry, rim * (.3 + wave * .16));
    for (const patch of colorPatches) {
      const dx = x - patch.x;
      const dz = z - patch.z;
      const localX = dx * patch.cos + dz * patch.sin;
      const localZ = dz * patch.cos - dx * patch.sin;
      const weight = 1 - smooth(.24, 1, Math.hypot(localX, localZ * 1.24) / patch.radius);
      tint.lerp(patch.tint, weight * .53);
    }
    colors.push(tint.r, tint.g, tint.b);
  }
  shade(...positions);
  for (let ring = 1; ring <= rings; ring++) {
    const radius = bankRadius * ring / rings;
    for (let item = 0; item < segments; item++) {
      const angle = item / segments * TAU + .09;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      shade(x, y, z);
      const at = 1 + (ring - 1) * segments + item;
      const next = 1 + (ring - 1) * segments + (item + 1) % segments;
      if (ring === 1) indices.push(0, next, at);
      else indices.push(at - segments, next - segments, next, at - segments, next, at);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .96, metalness: 0
  }));
  surface.name = 'sunstep-heightfield';
  surface.receiveShadow = true;
  return surface;
}

export function buildMeadowTuft() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  for (let index = 0; index < 5; index++) {
    const angle = index * 2.4;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const length = .45 + index * .105;
    positions.push(-dz * .103, 0, dx * .103, dz * .103, 0, -dx * .103, dx * .31, length, dz * .31);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function waterRibbon(rows, columns, sample) {
  const positions = [];
  const uv = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const t = row / rows;
      const u = col / columns;
      positions.push(...sample(t, u));
      uv.push(u, t);
      const at = row * (columns + 1) + col;
      if (row && col) {
        const left = at - 1;
        const back = at - columns - 1;
        indices.push(left, back, at, left, back - 1, back);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function waterPaint(falling = false) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 },
      waterColor: { value: new THREE.Color(falling ? '#95d9d6' : '#529e9d') },
      foamColor: { value: new THREE.Color('#e1fff0') },
      isFall: { value: Number(falling) }
    }]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 ribbon;
      void main() {
        ribbon = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float time;
      uniform float isFall;
      uniform vec3 waterColor;
      uniform vec3 foamColor;
      varying vec2 ribbon;
      void main() {
        vec2 flow = ribbon;
        float lateral = sin(flow.x * (36.0 + 14.0 * isFall) + 2.6 * sin(flow.y * 28.0 - time * 1.7));
        float run = sin(flow.y * (106.0 - 57.0 * isFall) - time * (4.4 + 3.9 * isFall)
          + sin(flow.x * 19.0) * 2.2);
        float margin = 1.0 - min(flow.x, 1.0 - flow.x) * 2.0;
        float foam = smoothstep(0.80, 1.0, margin) * (0.17 + run * 0.12);
        float vein = smoothstep(0.61, 1.0, lateral * 0.67 + run * 0.33);
        float current = (0.16 + vein * 0.27) + isFall * (0.10 + run * 0.07);
        gl_FragColor = vec4(mix(waterColor, foamColor, current + foam), 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `
  });
}

export function buildMeadowWater(parent, kit) {
  const curve = new THREE.CatmullRomCurve3(creek.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  function channel(width, height) {
    return waterRibbon(72, 6, (t, across) => {
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const span = width * (.88 + Math.sin(t * 16) * .09 + Math.sin(t * 36) * .06);
      const side = (across - .5) * span;
      return [point.x - tangent.z * side, height, point.z + tangent.x * side];
    });
  }
  const bank = new THREE.Mesh(channel(6.2, .027), new THREE.MeshStandardMaterial({
    color: '#7eaf91', roughness: .96, side: THREE.DoubleSide
  }));
  const stream = new THREE.Mesh(channel(4.5, .062), waterPaint());
  bank.receiveShadow = true;
  stream.name = 'sunstep-stream';
  parent.add(bank, stream);

  const falls = new THREE.Group();
  falls.position.set(17.75, 0, -25.1);
  parent.add(falls);
  const lip = new THREE.Mesh(waterRibbon(24, 10, (t, u) => [
    (u - .5) * (2.08 + t ** 3 * 1.15) + .11 * Math.sin(t * 3.1),
    .069 + 4.56 * (1 - t) ** 1.22,
    2.62 * t ** 2 + Math.sin(u * Math.PI) * (.18 + .12 * t)
  ]), waterPaint(true));
  lip.name = 'sunstep-waterfall';
  falls.add(lip);
  const { mesh } = kit;
  const strata = [
    [-2.06, .88, .49, 1.56, 1.42, 1.72], [1.93, .90, .33, 1.62, 1.36, 1.26],
    [-1.68, 2.12, -.26, 1.44, 1.54, 1.52], [1.71, 2.15, -.34, 1.33, 1.44, 1.30],
    [-1.88, 3.43, -.31, 1.55, 1.61, 1.28], [1.79, 3.44, -.42, 1.46, 1.61, 1.33],
    [-1.50, 4.19, -.80, 1.45, .97, 1.42], [1.54, 4.1, -.88, 1.55, .94, 1.48],
    [0, 1.28, -1.13, 2.18, 2.17, 1.56], [0, 3.28, -1.32, 2.10, 1.78, 1.42]
  ];
  strata.forEach(([x, y, z, w, h, d], index) => {
    const tone = ['#708a85', '#829a8c', '#5c7e79'][index % 3];
    mesh(falls, 'facet', tone, x, y, z, w, h, d, [.14, index * .53, -.06]).castShadow = true;
    if (index === 6 || index === 7) mesh(falls, 'round', '#81ac7e', x, y + .44, z, w * .79, .22, d * .88);
  });

  const mistCount = 13;
  const plume = new Float32Array(mistCount * 3);
  const mistGeometry = new THREE.BufferGeometry();
  mistGeometry.setAttribute('position', new THREE.BufferAttribute(plume, 3).setUsage(THREE.DynamicDrawUsage));
  const mist = new THREE.Points(mistGeometry, new THREE.PointsMaterial({
    color: '#d5faff', opacity: .45, transparent: true, depthWrite: false, size: .21, fog: true
  }));
  mist.frustumCulled = false;
  falls.add(mist);
  function update(time, graphics) {
    const motion = graphics.reducedMotion ? 0 : time;
    stream.material.uniforms.time.value = motion;
    lip.material.uniforms.time.value = motion;
    mist.visible = !graphics.reducedMotion && graphics.particles !== 'off';
    if (!mist.visible) return;
    for (let index = 0; index < mistCount; index++) {
      const age = (motion * .68 + index * .618) % 1;
      const side = Math.sin(index * 1.7);
      plume[index * 3] = side * (.26 + age * 1.35);
      plume[index * 3 + 1] = .15 + 1.17 * age * (1 - age);
      plume[index * 3 + 2] = 2.43 + age * (1.15 + Math.cos(index) * .33);
    }
    mistGeometry.attributes.position.needsUpdate = true;
  }
  return { update, obstacles: [
    { x: 17.75, z: -26.4, radius: 1.75, base: 0, height: 4.7 },
    { x: 15.93, z: -25.15, radius: .89, base: 0, height: 4.6 },
    { x: 19.61, z: -25.20, radius: .89, base: 0, height: 4.6 }
  ] };
}
