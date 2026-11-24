import * as THREE from './vendor/three/three.module.min.js';
import { bestiaryAnatomies, dressBestiaryPet } from './bestiary-art.js?v=20261124-1';

const mutationColors = {
  shiny: '#ffe79a', metallic: '#a0aecd', gold: '#ffb741', diamond: '#8feef8',
  obsidian: '#655081', titanium: '#d3e0ff', mythic: '#f5a9ed', giant: '#ffc77f'
};

const mutationScales = { metallic: 1.13, gold: 1.29, diamond: 1.50, obsidian: 1.80, titanium: 3, mythic: 1.65, giant: 3.8 };
export function petScale(variant) { return mutationScales[variant] || 1; }

// A small procedural sky supplies soft reflection bands without a remote texture or a second camera.
function steelReflection() {
  const width = 128;
  const height = 64;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const elevation = y / (height - 1);
    const longitude = x / width * Math.PI * 2;
    const panel = Math.pow(Math.max(0, Math.cos(longitude - elevation * 3.02)), 17);
    const horizon = Math.exp(-((elevation - .49) ** 2) * 170);
    const sky = Math.max(0, elevation - .30) * 74;
    const light = 34 + 153 * panel + 31 * horizon + sky;
    const index = (y * width + x) * 4;
    pixels.set([Math.min(255, light * .86), Math.min(255, light * 1.05), Math.min(255, light * 1.18), 255], index);
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

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
  let reflection;
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

  function steel(color, polished = false) {
    const hex = new THREE.Color(color).getHex();
    const key = `steel:${hex}:${polished}`;
    if (!materials.has(key)) {
      reflection ||= steelReflection();
      materials.set(key, new THREE.MeshStandardMaterial({
        color: hex, flatShading: true, metalness: polished ? .85 : .75, roughness: polished ? .23 : .34,
        envMap: reflection, envMapIntensity: 1.5
      }));
    }
    return materials.get(key);
  }

  return { mesh, paint, steel, geometries, materials };
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
  traveler.userData.arms = [-1, 1].map(side => {
    mesh(traveler, 'round', '#342d42', side * .14, 1.73, .391, .034, .052, .026);
    const sleeve = mesh(traveler, 'round', coat, side * .45, 1.02, .05, .13, .31, .135, [0, 0, side * .19]);
    const hand = mesh(traveler, 'round', '#f6ba74', side * .51, .77, .055, .105, .11, .105);
    return { side, sleeve, hand };
  });
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

const sides = [-1, 1];

function makeTidecup({ part, mass, eyes, shell, accent, shade }) {
  mass('round', shell, 0, .57, -.06, .61, .32, .43);
  part('facet', accent, 0, .66, -.16, .47, .25, .31);
  part('round', shade, 0, .45, .32, .36, .14, .17);
  for (const side of sides) {
    for (let index = 0; index < 3; index++) {
      part('round', shade, side * (.48 + index * .028), .22, .10 - index * .22, .33, .09, .067, [0, side * .17, side * .23]);
    }
    part('round', shell, side * .50, .40, .43, .15, .12, .27, [0, side * .40, 0]);
    part('facet', shell, side * .67, .53, .63, .25, .24, .28, [-.27, 0, side * .19]);
    part('round', accent, side * .74, .64, .81, .13, .12, .17, [-.38, side * .2, 0]);
    part('round', accent, side * .58, .47, .84, .11, .10, .15, [.42, 0, side * .38]);
    part('round', shell, side * .19, .86, .19, .12, .22, .12, [-.3, 0, side * .09]);
    part('round', accent, side * .19, .98, .27, .14, .14, .11);
  }
  eyes(.19, .99, .369, .063);
  return { y: .52, z: -.10, scale: .78, stride: .32 };
}

function makeRiverbody({ part, mass, eyes, tail, shell, accent, shade, face, shine }, frozen = false) {
  mass('round', shell, 0, .57, -.22, .37, .38, .69);
  part('round', accent, 0, .42, .04, .30, .22, .43);
  mass('round', shell, 0, .85, .35, .36, .34, .31);
  part('round', accent, 0, .73, .59, .225, .125, .14);
  part('round', face, 0, .79, .713, .071, .048, .032);
  eyes(.15, .94, .614, .058);
  for (const side of sides) {
    part('round', accent, side * .27, 1.04, .25, .11, .13, .083);
    part('round', shade, side * .245, .30, .20, .13, .171, .185, [-.21, 0, 0]);
    part('round', shade, side * .25, .27, -.49, .15, .158, .20);
    if (frozen) part('gem', shine, side * .21, .89, -.19, .068, .17, .071, [.09, .19, side * -.28]);
    else for (const z of [.66, .694]) part('round', shade, side * .15, .753, z, .018, .018, .018);
  }
  const sweep = tail(0, .43, -.73);
  sweep('round', shell, 0, -.04, -.27, .16, .13, .38, [-.17, 0, 0]);
  sweep('round', frozen ? shine : shade, 0, frozen ? .01 : -.08, frozen ? -.58 : -.55, frozen ? .13 : .20, .10, .25);
  return { y: .55, z: -.22, scale: .74, stride: .73 };
}

function makeTesselshell({ part, mass, eyes, shell, accent, shade }) {
  mass('round', shell, 0, .63, -.10, .58, .43, .69);
  part('round', accent, 0, .44, -.10, .57, .19, .68);
  part('facet', shade, 0, .93, -.15, .35, .14, .42, [0, .3, 0]);
  part('gem', accent, 0, .991, -.15, .17, .116, .21, [0, .32, 0]);
  mass('round', shell, 0, .63, .57, .29, .23, .30);
  part('round', accent, 0, .57, .75, .21, .10, .11);
  part('cone', shade, 0, .39, -.79, .086, .28, .09, [-Math.PI / 2, 0, 0]);
  for (const side of sides) {
    part('gem', accent, side * .38, .87, -.21, .16, .095, .22, [0, .20, -side * .30]);
    part('round', shell, side * .47, .31, .35, .23, .11, .24, [0, side * .64, -.1]);
    part('round', shade, side * .42, .28, -.50, .18, .105, .16, [0, side * -.49, 0]);
  }
  eyes(.125, .67, .818, .055);
  return { y: .63, z: -.15, scale: .80, stride: .45 };
}

function makeGlassfin({ part, mass, eyes, wings, shell, accent, shade, shine }) {
  mass('round', shell, 0, .83, -.02, .29, .45, .33, [.20, 0, 0]);
  mass('round', shell, 0, 1.33, .10, .32, .29, .33);
  part('round', accent, 0, .83, .224, .19, .36, .13, [.17, 0, 0]);
  part('round', accent, 0, 1.22, .40, .137, .112, .18, [-.1, 0, 0]);
  part('round', shade, 0, 1.223, .546, .091, .070, .048);
  part('ring', shell, 0, .37, -.11, .24, .24, .24, [0, Math.PI / 2, 0]);
  part('round', accent, 0, .36, -.08, .065, .067, .065);
  eyes(.137, 1.39, .389, .061);
  for (let index = 0; index < 3; index++) {
    part('cone', shine, 0, 1.60 - index * .07, -.10 - index * .086, .093, .22 - index * .035, .068, [-.22, 0, 0]);
    part('round', shade, 0, .77 + index * .12, .335 - index * .018, .105, .018, .022);
  }
  wings(.20, .89, -.12, (fin, side) => {
    fin('gem', accent, side * .18, 0, 0, .24, .138, .088, [.27, side * .31, side * .37]);
  });
  return { y: .83, z: -.02, scale: .57, stride: .57 };
}

function makeMirrorwake({ part, mass, eyes, tail, wings, shell, accent, shade, shine }) {
  mass('round', shell, 0, .62, .06, .48, .22, .53);
  part('round', accent, 0, .54, .10, .45, .12, .47);
  part('gem', shine, 0, .824, .20, .113, .079, .20, [0, .40, 0]);
  eyes(.23, .64, .512, .058);
  for (const side of sides) {
    part('cone', shell, side * .31, .66, .46, .12, .36, .12, [Math.PI / 2.5, 0, -side * .52]);
  }
  wings(.35, .64, -.04, (fin, side) => {
    fin('gem', shell, side * .36, 0, -.045, .66, .16, .43, [0, side * .40, side * -.15]);
    fin('gem', accent, side * .27, -.046, .008, .45, .069, .30, [0, side * .40, side * -.15]);
    fin('gem', shade, side * .54, .07, -.094, .30, .068, .20, [0, side * .44, side * -.15]);
    fin('round', shine, side * .42, .09, .023, .117, .021, .084);
  });
  const sweep = tail(0, .61, -.36);
  sweep('cone', shell, 0, 0, -.35, .10, .70, .072, [-Math.PI / 2, 0, 0]);
  sweep('gem', shine, 0, .028, -.72, .075, .029, .14, [0, .38, 0]);
  return { y: .62, z: -.10, scale: .62, stride: .65 };
}

function makeYak({ part, mass, eyes, tail, shell, accent, shade, face, shine }, ember = false) {
  mass('round', shell, 0, .69, -.21, .52, .45, .57);
  mass('facet', shell, 0, .88, .30, .50, .43, .41);
  part('round', accent, 0, .75, .55, .32, .18, .22);
  for (const side of sides) {
    for (const z of [.23, -.50]) {
      part('round', shell, side * .33, .33, z, .165, .24, .16);
      part('round', shade, side * .33, .145, z + .04, .157, .14, .19);
    }
    part('round', face, side * .11, .78, .752, .047, .031, .026);
    part('round', shell, side * .40, .99, .22, .215, .115, .12, [0, side * .24, side * -.24]);
    if (ember) {
      part('cone', accent, side * .47, 1.16, .08, .162, .545, .14, [.27, 0, side * -.94]);
      part('gem', shine, side * .65, 1.352, .03, .087, .204, .086, [.10, .26, side * -.39]);
      part('gem', shine, side * .32, 1.11, -.31, .084, .262, .102, [-.37, .19, side * -.31]);
    } else {
      part('cone', accent, side * .45, 1.16, .08, .14, .47, .12, [.09, 0, -side * .80]);
      part('cone', accent, side * .61, 1.33, .07, .112, .35, .10, [0, 0, -side * .33]);
    }
    for (let index = 0; index < 2; index++) {
      part('facet', ember ? shade : accent, side * .43, .75 - index * .17, -.015 - index * .22, .19, .21, .265, [0, side * .11, side * .50]);
    }
  }
  part('facet', ember ? shine : accent, 0, 1.19, .41, .235, .19, .20, [.38, .3, .2]);
  eyes(.218, .98, .61, .066);
  const tuft = tail(0, .70, -.68);
  tuft('round', shade, 0, -.08, -.12, .078, .074, .19, [-.5, 0, 0]);
  tuft('round', accent, 0, -.16, -.245, .134, .105, .106);
  return { y: .79, z: -.15, scale: .94, stride: .80 };
}

function makeSnowstitch({ part, mass, eyes, shell, accent, shade, shine, face }) {
  mass('round', shell, 0, .63, -.27, .40, .42, .49);
  mass('round', shell, 0, .94, .22, .39, .39, .35);
  part('round', accent, 0, .62, .35, .249, .285, .177);
  part('round', accent, 0, .52, -.74, .205, .23, .21);
  part('gem', face, 0, .83, .573, .062, .047, .037);
  eyes(.168, 1.013, .526, .071);
  for (const side of sides) {
    part('round', shell, side * .248, .37, .21, .131, .182, .136, [-.26, 0, 0]);
    part('round', shell, side * .28, .20, .34, .136, .128, .208);
    part('round', shade, side * .285, .33, -.465, .17, .23, .22);
    part('round', shell, side * .25, 1.50, .13, .108, .39, .114, [-.13, 0, side * -.31]);
    part('round', accent, side * .276, 1.53, .22, .060, .277, .047, [-.13, 0, side * -.31]);
    part('gem', shine, side * .325, 1.78, .12, .080, .123, .088, [-.22, .32, side * -.32]);
    part('gem', shine, side * .33, .94, .417, .076, .059, .049, [0, .3, side * .4]);
  }
  return { y: .66, z: -.21, scale: .79, stride: 1.10 };
}

function makeWindquill({ part, mass, eyes, wings, shell, accent, shade, shine }) {
  mass('round', shell, 0, .65, -.07, .43, .49, .39);
  mass('round', shell, 0, 1.13, .09, .45, .37, .37);
  part('round', accent, 0, .64, .23, .28, .37, .19);
  part('cone', '#b6856f', 0, .96, .519, .085, .23, .104, [1.46, 0, 0]);
  for (const side of sides) {
    part('round', accent, side * .187, 1.137, .356, .21, .222, .135, [0, side * .18, side * .23]);
    part('cone', shade, side * .288, 1.44, -.03, .14, .39, .107, [0, 0, side * -.43]);
    part('round', '#c68666', side * .16, .20, .19, .12, .089, .164);
    part('gem', shade, side * .09, .64, .416, .024, .082, .023, [0, .21, side * -.34]);
    part('gem', shine, side * .115, .49, .386, .019, .066, .022, [0, -.11, side * -.34]);
    part('gem', shell, side * .13, .398, -.35, .124, .35, .104, [.67, 0, side * .24]);
  }
  eyes(.172, 1.164, .469, .088);
  wings(.34, .80, -.08, (wing, side) => {
    wing('gem', shade, side * .18, -.10, 0, .28, .39, .14, [-.27, 0, side * .50]);
    wing('gem', shell, side * .22, -.12, .115, .21, .31, .10, [-.27, 0, side * .54]);
    wing('gem', accent, side * .27, -.26, .13, .094, .20, .05, [-.22, 0, side * .62]);
  });
  return { y: .68, z: -.09, scale: .72, stride: .80 };
}

function makeMoth({ part, mass, eyes, wings, shell, accent, shade, shine }, ember = false) {
  mass('round', shell, 0, .61, -.07, .27, .37, .39);
  mass('round', shell, 0, 1.04, .17, .32, .30, .34);
  part('round', accent, 0, .75, .245, .22, .205, .143);
  const tip = ember ? 'gem' : 'round';
  for (const side of sides) {
    part('beam', accent, side * .16, 1.39, .12, .027, .39, .027, [0, .15, side * -.44]);
    part(tip, shine, side * .25, 1.57, .13, .084, .103, .077, [0, 0, side * -.28]);
    part('round', shade, side * .14, .33, .18, .108, .099, .133);
  }
  eyes(.135, 1.06, .47, .061);
  wings(.24, .80, -.12, (wing, side) => {
    const profile = ember ? 'gem' : 'round';
    wing(profile, shell, side * .33, .115, -.10, .49, .269, .14, [-.32, side * .18, side * .48]);
    wing(profile, shade, side * .28, -.14, -.154, .38, .228, .15, [.39, side * .30, side * -.40]);
    wing(profile, accent, side * .365, .148, .006, .345, .13, .086, [-.34, side * .17, side * .48]);
    wing('gem', shine, side * .49, .204, .066, .112, .099, .045, [0, side * .2, side * .40]);
    wing('gem', accent, side * .36, -.198, -.04, .126, .079, .052, [0, 0, side * -.42]);
  });
  return { y: .66, z: -.14, scale: .66, stride: .72 };
}

function makeCoalfrill({ part, mass, eyes, tail, shell, accent, shade, shine, face }) {
  mass('round', shell, 0, .48, -.24, .40, .30, .60);
  mass('round', shell, 0, .71, .31, .42, .26, .36);
  part('round', accent, 0, .58, .53, .29, .11, .16);
  part('round', face, 0, .60, .665, .069, .034, .025);
  eyes(.197, .80, .573, .066);
  for (const side of sides) {
    part('round', shade, side * .32, .25, .26, .19, .123, .16, [0, side * .42, 0]);
    part('round', shade, side * .29, .24, -.53, .19, .117, .166, [0, side * .30, 0]);
    for (let index = 0; index < 3; index++) {
      part('gem', shine, side * (.36 + index * .052), .74 - index * .076, .10 - index * .072, .15, .14, .08, [0, side * .21, side * .52]);
    }
  }
  for (let index = 0; index < 3; index++) part('gem', shine, 0, .765 - index * .045, -.15 - index * .20, .091, .116, .081);
  const sweep = tail(0, .48, -.65);
  sweep('cone', shell, 0, -.069, -.30, .19, .69, .13, [-1.43, 0, 0]);
  sweep('gem', shine, 0, -.097, -.57, .070, .052, .15);
  return { y: .51, z: -.24, scale: .72, stride: .47 };
}

function makeClinkhide({ part, mass, eyes, shell, accent, shade, shine, face }) {
  mass('round', shell, 0, .61, -.22, .48, .44, .61);
  part('round', shade, 0, .44, -.12, .43, .19, .58);
  mass('round', shell, 0, .64, .37, .315, .24, .29);
  part('round', accent, 0, .57, .59, .207, .093, .171);
  part('round', face, 0, .595, .739, .058, .036, .035);
  eyes(.133, .71, .598, .055);
  for (let index = 0; index < 4; index++) {
    const width = .43 - Math.abs(1 - index) * .066;
    const z = -.06 - index * .192;
    part('facet', index % 2 ? shell : shade, 0, .74 - index * .016, z, width, .279, .158, [0, .09, .055]);
    part('gem', shine, 0, .987 - index * .025, z - .047, .083, .066, .068, [0, .30, 0]);
  }
  for (const side of sides) {
    part('cone', accent, side * .207, .87, .273, .10, .29, .072, [-.11, 0, side * -.42]);
    part('round', shade, side * .265, .285, .26, .135, .172, .177, [-.24, 0, 0]);
    part('round', shade, side * .26, .265, -.51, .146, .168, .17);
  }
  part('cone', shade, 0, .49, -.82, .13, .30, .13, [-1.25, 0, 0]);
  return { y: .62, z: -.22, scale: .73, stride: .47 };
}

function makeEmbercoil({ part, mass, eyes, tail, wings, shell, accent, shade, shine, face }) {
  mass('round', shell, 0, .68, -.24, .42, .44, .63);
  mass('facet', shell, 0, .99, .27, .43, .34, .34);
  part('round', accent, 0, .60, .13, .30, .34, .22);
  part('round', shade, 0, .85, .54, .233, .134, .185);
  eyes(.167, 1.036, .548, .078);
  for (const side of sides) {
    part('round', face, side * .109, .882, .705, .029, .028, .02);
    part('round', shell, side * .253, .421, .196, .13, .225, .14, [-.29, 0, 0]);
    part('round', shade, side * .29, .24, .28, .15, .14, .202);
    part('round', shade, side * .285, .325, -.527, .17, .221, .19);
    part('cone', accent, side * .28, 1.30, .11, .126, .435, .102, [-.19, 0, side * -.36]);
    part('cone', shell, side * .41, .99, .18, .12, .34, .115, [.29, 0, side * -1.15]);
    part('gem', shine, side * .248, .778, .685, .043, .109, .043, [0, 0, side * .12]);
  }
  for (let index = 0; index < 3; index++) part('gem', shine, 0, 1.08 - index * .05, -.15 - index * .22, .10, .141, .094, [-.28, .28, 0]);
  wings(.36, .85, -.25, (wing, side) => {
    wing('gem', shell, side * .28, .103, -.14, .43, .22, .13, [.25, side * .31, side * .56]);
    wing('gem', accent, side * .36, .101, -.075, .259, .135, .067, [.25, side * .31, side * .59]);
    wing('gem', shine, side * .58, .23, -.24, .147, .092, .062, [0, side * .28, side * .5]);
  });
  const sweep = tail(0, .56, -.72);
  sweep('cone', shell, 0, -.028, -.30, .19, .69, .18, [-1.37, 0, 0]);
  sweep('gem', shine, 0, .01, -.57, .12, .156, .16, [-.50, .22, 0]);
  return { y: .69, z: -.24, scale: .84, stride: .79 };
}

const expeditionModels = {
  tidecup: makeTidecup,
  reedwake: makeRiverbody,
  tesselshell: makeTesselshell,
  glassfin: makeGlassfin,
  mirrorwake: makeMirrorwake,
  thawhoof: makeYak,
  snowstitch: makeSnowstitch,
  windquill: makeWindquill,
  rimecoil: details => makeRiverbody(details, true),
  aurorawing: makeMoth,
  coalfrill: makeCoalfrill,
  clinkhide: makeClinkhide,
  cinderhorn: details => makeYak(details, true),
  spindleflare: details => makeMoth(details, true),
  embercoil: makeEmbercoil
};

const bestiaryModels = {
  hare: makeSnowstitch, owl: makeWindquill, turtle: makeTesselshell, otter: makeRiverbody, crab: makeTidecup,
  yak: makeYak, moth: makeMoth, salamander: makeCoalfrill, armadillo: makeClinkhide, dragon: makeEmbercoil,
  manta: makeMirrorwake, seahorse: makeGlassfin,
  ...bestiaryAnatomies
};

function createExpeditionPet(pet, spec, kit, { hue, shell, accent, face }, build, titanium) {
  const { mesh, paint, steel } = kit;
  const shape = host => (...args) => mesh(host, ...args);
  const part = shape(pet);
  let mainVolume;
  const mass = (...args) => {
    const volume = part(...args);
    volume.castShadow = true;
    mainVolume ||= volume;
    return volume;
  };
  const shade = titanium ? steel('#53677d', true) : paint(hue.clone().multiplyScalar(.56));
  const shine = paint(titanium ? '#7be4ca' : spec.accent || '#fff1cc', .19, .12);
  function eyes(spread, y, z, size) {
    for (const side of sides) {
      part('round', face, side * spread, y, z, size, size * 1.22, size * .53);
      part('round', '#fff3e7', side * spread - size * .23, y + size * .32, z + size * .48, size * .28, size * .30, size * .13);
    }
  }
  function joint(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    pet.add(group);
    return group;
  }
  function tail(x, y, z) {
    pet.userData.tail = joint(x, y, z);
    return shape(pet.userData.tail);
  }
  function wings(x, y, z, draw) {
    pet.userData.wings = sides.map(side => {
      const group = joint(x * side, y, z);
      draw(shape(group), side);
      return group;
    });
  }
  const details = build({ part, mass, eyes, tail, wings, shell, accent, shade, shine, face });
  pet.userData.strideScale = details.stride;
  if (spec.bestiary) dressBestiaryPet(pet, spec, kit, mainVolume, titanium);
  return details;
}

function createMeadowPet(pet, silhouette, { mesh }, { hue, shell, accent, inner, face }) {
  const body = (shape, material, x, y, z, w, h, d, rot) => mesh(pet, shape, material, x, y, z, w, h, d, rot);
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
}

/** The silhouettes come from separate facial and anatomical pieces for each species. */
export function createPet(spec, variant, kit) {
  const { mesh, paint, steel } = kit;
  const pet = new THREE.Group();
  const hue = new THREE.Color(spec.color || '#76c491');
  const special = mutationColors[variant];
  const titanium = variant === 'titanium';
  if (special) hue.lerp(new THREE.Color(titanium ? '#90a2b8' : special), titanium ? .82 : variant === 'shiny' ? .36 : .65);
  const accent = titanium ? steel('#b8cbd0', true) : spec.accent || '#fff1cc';
  const shell = titanium ? steel(hue) : paint(hue, special ? .065 : 0, ['metallic', 'gold'].includes(variant) ? .45 : 0);
  const inner = titanium ? '#85b1b5' : '#efb8a6';
  const face = '#352a43';
  const palette = { hue, shell, accent, inner, face };
  const legacy = Object.hasOwn(expeditionModels, spec.id) ? expeditionModels[spec.id] : null;
  const bestiary = spec.bestiary && Object.hasOwn(bestiaryModels, spec.shape) ? bestiaryModels[spec.shape] : null;
  const sculpt = bestiary || legacy;
  const anatomy = bestiary ? new THREE.Group() : pet;
  if (bestiary) pet.add(anatomy);
  const details = sculpt ? createExpeditionPet(anatomy, spec, kit, palette, sculpt, titanium) : null;
  if (!sculpt) createMeadowPet(pet, spec.shape, kit, palette);
  if (bestiary) Object.assign(pet.userData, anatomy.userData);

  if (special) {
    const glow = titanium ? '#7be4ca' : special;
    const aura = mesh(pet, 'ring', paint(glow, titanium ? .19 : .33, .1), 0, .20, 0, .84, .84, .84, [Math.PI / 2, 0, 0]);
    pet.userData.aura = aura;
    const armor = details ? new THREE.Group() : pet;
    if (details) {
      armor.position.set(0, details.y - .77 * details.scale, details.z + .20 * details.scale);
      armor.scale.setScalar(details.scale);
      anatomy.add(armor);
    }
    const body = (shape, material, x, y, z, w, h, d, rotation) => mesh(armor, shape, material, x, y, z, w, h, d, rotation);
    if (titanium) {
      const shellPlate = steel('#526980', true);
      for (const side of [-1, 1]) {
        body('facet', shellPlate, side * .48, .77, -.20, .20, .27, .39, [.18, side * .24, side * .1]);
        body('box', paint(glow, .42), side * .63, .77, -.19, .027, .033, .26, [0, side * .15, 0]);
        body('gem', paint(glow, .34), side * .55, .99, -.18, .035, .055, .038);
      }
    } else if (variant === 'giant') {
      const trim = paint('#d98d58', .09, .37);
      const crystal = paint('#ffe1a5', .24, .18);
      body('facet', trim, 0, 1.21, -.48, .46, .22, .38, [.13, .28, 0]);
      body('gem', crystal, 0, 1.42, -.41, .13, .36, .13, [-.14, .27, 0]);
      for (const side of [-1, 1]) {
        body('facet', trim, side * .50, .75, -.11, .21, .29, .30, [0, 0, side * .24]);
        body('gem', crystal, side * .59, 1.03, -.18, .073, .25, .072, [-.15, 0, -side * .34]);
      }
    } else for (const side of [-1, 1]) body('gem', paint(glow, .35), side * .76, 1.12, -.2, .09, .15, .09);
  }
  pet.scale.multiplyScalar(petScale(variant));
  return pet;
}
