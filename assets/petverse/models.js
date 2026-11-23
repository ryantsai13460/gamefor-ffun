import * as THREE from './vendor/three/three.module.min.js';

const mutationColors = {
  shiny: '#ffe79a', metallic: '#a0aecd', gold: '#ffb741', diamond: '#8feef8',
  obsidian: '#655081', titanium: '#d3e0ff', mythic: '#f5a9ed'
};

/** Shared geometry and materials keep custom meshes inexpensive as the party grows. */
export function createModelKit() {
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    round: new THREE.SphereGeometry(1, 12, 8),
    facet: new THREE.IcosahedronGeometry(1, 0),
    disc: new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2),
    gem: new THREE.OctahedronGeometry(1, 0),
    beam: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 8),
    ring: new THREE.TorusGeometry(1, .065, 6, 40)
  };
  const materials = new Map();
  function paint(color, emissive = 0, metalness = 0) {
    const hex = new THREE.Color(color).getHex();
    const key = `${hex}:${emissive}:${metalness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
      color: hex, flatShading: true, roughness: .83 - metalness * .5, metalness,
      emissive: hex, emissiveIntensity: emissive
    }));
    return materials.get(key);
  }

  function mesh(parent, shape, color, x, y, z, w, h, d, rotation) {
    const part = new THREE.Mesh(geometries[shape], color?.isMaterial ? color : paint(color));
    part.position.set(x, y, z);
    part.scale.set(w, h, d);
    if (rotation) part.rotation.set(...rotation);
    part.receiveShadow = true;
    parent.add(part);
    return part;
  }

  return { mesh, paint, geometries, materials };
}

export function createTraveler(kit, remote = false) {
  const { mesh } = kit;
  const traveler = new THREE.Group();
  const coat = remote ? '#b675b6' : '#318e89';
  mesh(traveler, 'round', coat, 0, .99, 0, .43, .53, .32).castShadow = true;
  mesh(traveler, 'round', '#f6ba74', 0, 1.72, .05, .4, .43, .38).castShadow = true;
  mesh(traveler, 'round', '#512f49', 0, 1.96, -.02, .42, .23, .38);
  mesh(traveler, 'round', '#ee8c58', 0, 1.94, .24, .39, .09, .28);
  mesh(traveler, 'box', '#eda951', 0, .73, .26, .31, .09, .08);
  mesh(traveler, 'round', '#e5ae67', 0, 1.05, -.29, .29, .37, .18);
  mesh(traveler, 'box', '#f2ce85', 0, 1.19, -.42, .36, .13, .12);
  for (const side of [-1, 1]) {
    mesh(traveler, 'round', '#342d42', side * .14, 1.73, .391, .034, .052, .026);
    mesh(traveler, 'round', coat, side * .45, 1.02, .05, .13, .31, .135, [0, 0, side * .19]);
    mesh(traveler, 'round', '#f6ba74', side * .51, .77, .055, .105, .11, .105);
  }
  traveler.userData.legs = [-1, 1].map(side => {
    const leg = new THREE.Group();
    leg.position.set(side * .2, .61, 0);
    mesh(leg, 'box', '#38465e', 0, -.215, 0, .22, .43, .22);
    mesh(leg, 'round', '#47384b', 0, -.51, .07, .145, .12, .22);
    mesh(leg, 'box', '#c69579', 0, -.565, .076, .265, .055, .3);
    traveler.add(leg);
    return leg;
  });
  return traveler;
}

/** The silhouettes come from separate facial and anatomical pieces for each family. */
export function createPet(spec, variant, kit) {
  const { mesh, paint } = kit;
  const pet = new THREE.Group();
  const hue = new THREE.Color(spec.color || '#76c491');
  const special = mutationColors[variant];
  if (special) hue.lerp(new THREE.Color(special), variant === 'shiny' ? .36 : .65);
  const accent = spec.accent || '#fff1cc';
  const shell = paint(hue, special ? .065 : 0, ['metallic', 'titanium', 'gold'].includes(variant) ? .45 : 0);
  const inner = '#efb8a6';
  const face = '#352a43';
  const body = (shape, material, x, y, z, w, h, d, rot) => mesh(pet, shape, material, x, y, z, w, h, d, rot);
  const silhouette = spec.shape;
  body('round', shell, 0, .68, -.2, .53, .48, .63).castShadow = true;
  body('round', shell, 0, .97, .19, .51, .48, .47).castShadow = true;
  body('round', accent, 0, .73, .47, .255, .17, .19);
  for (const side of [-1, 1]) {
    body('round', shell, side * .35, .26, .24, .15, .15, .22);
    body('round', shell, side * .31, .27, -.47, .17, .17, .21);
    body('round', face, side * .20, 1.0, .597, .073, .097, .036);
    body('round', '#fff4df', side * .20 - .016, 1.035, .624, .024, .030, .012);
    body('round', inner, side * .34, .88, .55, .07, .035, .03);
  }
  body('round', face, 0, .804, .632, .067, .044, .026);

  function ears(shape, height, spread = .34, width = .15, twist = .36) {
    for (const side of [-1, 1]) {
      body(shape, shell, side * spread, 1.34 + height * .27, .06, width, height, .16, [0, 0, -side * twist]);
      body('round', inner, side * (spread + .03), 1.38 + height * .22, .161, width * .56, height * .45, .046, [0, 0, -side * twist]);
    }
  }

  function wings(big = false) {
    pet.userData.wings = [-1, 1].map(side => {
      const wing = new THREE.Group();
      wing.position.set(side * .43, .86, -.20);
      pet.add(wing);
      mesh(wing, 'round', accent, side * (big ? .43 : .26), .05, -.10, big ? .55 : .35, .12, big ? .48 : .36, [0, side * .28, side * .22]);
      mesh(wing, 'round', hue, side * .10, .008, -.15, big ? .38 : .24, .13, .31, [0, side * .20, side * .29]);
      return wing;
    });
  }

  function tail(length, thickness) {
    body('round', shell, 0, .64 + length * .19, -.72, thickness, length, thickness, [-.80, 0, .34]);
    body('round', accent, -.16, .66 + length * .62, -.94, thickness * .75, thickness * .79, thickness * .8);
  }

  switch (silhouette) {
    case 'hare':
      ears('round', .44, .27, .13, .23);
      body('round', '#fff6dd', 0, .57, -.78, .25, .25, .25);
      break;
    case 'cat':
      ears('cone', .50);
      tail(.48, .11);
      break;
    case 'pup':
      for (const side of [-1, 1]) body('round', accent, side * .46, 1.15, .06, .13, .35, .17, [0, 0, -side * .32]);
      tail(.33, .13);
      break;
    case 'bear':
      ears('round', .20, .36, .21, .48);
      body('round', accent, 0, .53, .22, .32, .26, .17);
      break;
    case 'bird':
    case 'owl':
      wings();
      body('cone', '#efb051', 0, .86, .64, .15, .28, .12, [Math.PI / 2, 0, 0]);
      if (silhouette === 'owl') ears('cone', .36, .30, .13, .30);
      else body('round', accent, .04, 1.46, .14, .16, .28, .29, [-.42, 0, .26]);
      break;
    case 'moth':
      wings(true);
      for (const side of [-1, 1]) {
        body('beam', accent, side * .23, 1.44, .18, .048, .48, .048, [.13, 0, -side * .28]);
        body('round', accent, side * .30, 1.64, .21, .104, .104, .104);
      }
      break;
    case 'deer':
      ears('round', .21, .45, .16, .73);
      for (const side of [-1, 1]) {
        body('beam', accent, side * .25, 1.58, -.02, .074, .48, .074, [0, 0, -side * .18]);
        body('beam', accent, side * .34, 1.72, .03, .05, .28, .05, [-.4, 0, -side * .55]);
      }
      break;
    case 'slug':
      pet.scale.set(1.16, .72, 1.20);
      body('round', accent, 0, .74, -.44, .55, .49, .45);
      body('ring', shell, 0, .833, -.24, .28, .28, .28, [0, .3, -.5]);
      ears('round', .33, .24, .08, .27);
      break;
    case 'axolotl':
      for (const side of [-1, 1]) for (let index = 0; index < 3; index++) {
        body('round', accent, side * (.47 + index * .045), 1.17 - index * .115, .06, .32 - index * .025, .065, .105, [0, 0, side * (.70 - index * .38)]);
      }
      tail(.36, .20);
      break;
    case 'fox':
      ears('cone', .59, .32, .17, .30);
      tail(.59, .23);
      break;
    case 'frog':
      for (const side of [-1, 1]) {
        body('round', shell, side * .33, 1.27, .22, .23, .22, .20);
        body('round', face, side * .33, 1.30, .405, .058, .065, .035);
      }
      break;
    default:
      ears('gem', .32);
      tail(.29, .12);
  }

  if (special) {
    const aura = body('ring', paint(special, .33, .1), 0, .20, 0, .84, .84, .84, [Math.PI / 2, 0, 0]);
    pet.userData.aura = aura;
    for (const side of [-1, 1]) body('gem', paint(special, .35), side * .76, 1.12, -.2, .09, .15, .09);
  }
  return pet;
}
