const sides = [-1, 1];

function makeFox({ part, mass, eyes, tail, shell, accent, shade, face }) {
  mass('round', shell, 0, .62, -.18, .35, .33, .55);
  mass('facet', shell, 0, .92, .30, .39, .34, .35);
  part('round', accent, 0, .66, .38, .25, .26, .23);
  part('facet', accent, 0, .81, .57, .21, .135, .25);
  part('round', face, 0, .85, .773, .064, .045, .044);
  eyes(.169, .977, .529, .061);
  for (const side of sides) {
    part('cone', shell, side * .26, 1.28, .17, .16, .48, .13, [-.11, 0, side * -.25]);
    part('gem', accent, side * .265, 1.28, .24, .103, .15, .034, [0, 0, side * -.22]);
    for (const z of [.21, -.46]) part('round', z > 0 ? shade : shell, side * .237, .249, z, .113, .22, .137);
  }
  const brush = tail(0, .63, -.58);
  brush('round', shell, 0, .079, -.30, .165, .16, .37, [.24, .05, 0]);
  brush('facet', accent, .03, .187, -.57, .142, .130, .23, [.4, .05, 0]);
  return { y: .64, z: -.16, scale: .72, stride: 1.04 };
}

function makeAxolotl({ part, mass, eyes, tail, shell, accent, shade, shine }) {
  mass('round', shell, 0, .49, -.24, .37, .29, .59);
  mass('round', shell, 0, .71, .29, .45, .27, .35);
  part('round', accent, 0, .57, .49, .34, .14, .21);
  eyes(.197, .761, .594, .070);
  part('round', shade, 0, .651, .687, .096, .024, .025);
  for (const side of sides) {
    part('round', shell, side * .29, .25, .22, .17, .107, .15);
    part('round', shade, side * .275, .23, -.50, .16, .105, .14);
    for (let index = 0; index < 3; index++) {
      const y = .74 + index * .095;
      const x = side * (.43 + index * .039);
      part('round', accent, x, y, .17 - index * .052, .21, .068, .095, [0, 0, side * (.47 + index * .25)]);
      part('round', shine, x + side * .108, y + index * .051, .175 - index * .052, .057, .044, .060);
    }
  }
  const fin = tail(0, .45, -.76);
  fin('cone', shell, 0, .047, -.24, .155, .56, .15, [-1.35, 0, 0]);
  fin('gem', accent, 0, .124, -.42, .078, .19, .33, [0, 0, .1]);
  return { y: .52, z: -.23, scale: .74, stride: .52 };
}

function makeStoat({ part, mass, eyes, tail, shell, accent, shade, face }) {
  mass('round', shell, 0, .53, -.24, .268, .28, .69, [-.13, 0, 0]);
  mass('round', shell, 0, .82, .32, .294, .265, .33);
  part('round', accent, 0, .65, .38, .225, .233, .279, [-.39, 0, 0]);
  part('round', face, 0, .725, .674, .044, .034, .036);
  eyes(.122, .878, .586, .049);
  for (const side of sides) {
    part('round', shade, side * .218, 1.015, .266, .097, .094, .072, [0, 0, side * -.31]);
    part('round', accent, side * .215, .998, .315, .056, .054, .035);
    part('round', shell, side * .19, .211, .25, .106, .17, .12, [-.3, 0, 0]);
    part('round', shade, side * .184, .221, -.58, .103, .18, .17);
  }
  const paddle = tail(0, .43, -.77);
  paddle('round', shell, .033, .06, -.22, .102, .105, .29, [-.2, -.22, 0]);
  paddle('round', shade, .093, .127, -.44, .082, .085, .17, [-.37, -.24, 0]);
  return { y: .52, z: -.24, scale: .63, stride: 1.1 };
}

function makeGecko({ part, mass, eyes, tail, shell, accent, shade, face }) {
  mass('round', shell, 0, .38, -.13, .303, .26, .58);
  mass('facet', shell, 0, .565, .37, .36, .245, .346);
  part('round', accent, 0, .457, .544, .259, .090, .161);
  part('round', face, 0, .473, .70, .078, .022, .028);
  eyes(.185, .646, .576, .073);
  for (const side of sides) for (const z of [.152, -.43]) {
    part('round', shell, side * .26, .234, z, .25, .079, .102, [0, side * .52, 0]);
    for (const spread of [-.085, 0, .085]) {
      part('round', accent, side * (.434 + Math.abs(spread) * .20), .165, z + spread + .052, .081, .048, .073,
        [0, side * .42, 0]);
    }
  }
  const curl = tail(0, .37, -.62);
  curl('round', shell, .048, -.016, -.22, .116, .094, .27, [0, -.24, 0]);
  curl('round', shade, .178, .023, -.421, .096, .083, .20, [-.25, -.67, 0]);
  curl('round', accent, .306, .10, -.462, .07, .074, .126, [-.37, -1.72, 0]);
  return { y: .41, z: -.16, scale: .62, stride: .64 };
}

function makeMagpie({ part, mass, eyes, wings, tail, shell, accent, shade, shine }) {
  mass('round', shell, 0, .74, -.14, .326, .35, .48, [.28, 0, 0]);
  mass('round', shell, 0, 1.088, .253, .288, .28, .28);
  part('round', accent, 0, .782, .199, .239, .292, .159, [-.2, 0, 0]);
  part('cone', shade, 0, 1.006, .58, .088, .244, .086, [1.56, 0, 0]);
  eyes(.145, 1.134, .466, .061);
  wings(.25, .81, -.16, (wing, side) => {
    wing('gem', shell, side * .235, -.019, -.017, .383, .169, .307, [-.27, side * .29, side * -.31]);
    wing('gem', shine, side * .418, -.041, -.152, .192, .079, .239, [-.20, side * .37, side * -.28]);
    wing('gem', accent, side * .29, .069, .012, .160, .068, .172, [-.29, side * .31, side * -.32]);
  });
  const plume = tail(0, .60, -.49);
  for (const side of sides) {
    plume('gem', shade, side * .064, -.062, -.27, .107, .075, .48, [-.16, side * -.13, side * -.052]);
    part('round', accent, side * .119, .229, .113, .114, .085, .153);
  }
  return { y: .73, z: -.13, scale: .67, stride: .76 };
}

function makeLynx({ part, mass, eyes, shell, accent, shade, face }) {
  mass('round', shell, 0, .69, -.18, .39, .36, .52);
  mass('facet', shell, 0, 1.00, .28, .385, .389, .389);
  part('round', accent, 0, .873, .559, .248, .133, .163);
  part('round', face, 0, .906, .697, .074, .049, .036);
  eyes(.182, 1.052, .571, .067);
  part('round', shade, 0, .684, -.68, .126, .14, .19, [-.2, 0, 0]);
  for (const side of sides) {
    part('cone', shell, side * .24, 1.39, .179, .154, .404, .106, [-.10, 0, side * -.24]);
    part('cone', face, side * .293, 1.614, .151, .03, .18, .034, [-.10, 0, side * -.24]);
    part('facet', accent, side * .31, .913, .43, .175, .141, .159, [0, side * .47, -side * .53]);
    part('cone', accent, side * .36, .840, .36, .102, .24, .09, [0, 0, -side * 1.96]);
    for (const z of [.22, -.48]) {
      part('round', shell, side * .254, .376, z, .126, .274, .121);
      part('round', accent, side * .256, .174, z + .025, .133, .104, .173);
    }
  }
  return { y: .68, z: -.15, scale: .78, stride: .9 };
}

function makeIbex({ part, mass, eyes, tail, shell, accent, shade, face }) {
  mass('round', shell, 0, .75, -.23, .36, .37, .53);
  mass('facet', shell, 0, 1.037, .239, .329, .311, .379);
  part('round', accent, 0, .95, .509, .221, .116, .163);
  part('round', face, 0, .966, .642, .061, .034, .032);
  part('cone', shade, 0, .833, .47, .096, .279, .094, [Math.PI - .36, 0, 0]);
  eyes(.164, 1.125, .488, .062);
  for (const side of sides) {
    for (const z of [.172, -.465]) {
      part('round', shell, side * .246, .478, z, .098, .263, .115);
      part('box', shade, side * .246, .235, z + .039, .158, .171, .176, [0, side * .12, 0]);
    }
    part('round', shell, side * .315, 1.155, .185, .173, .083, .098, [0, side * -.15, side * .26]);
    part('cone', shade, side * .234, 1.379, .110, .115, .45, .113, [-.37, 0, side * -.27]);
    part('cone', accent, side * .293, 1.591, -.073, .073, .36, .088, [-1.01, 0, side * -.23]);
    part('cone', accent, side * .32, 1.658, -.294, .053, .273, .066, [-1.65, 0, side * -.10]);
  }
  const tuft = tail(0, .785, -.707);
  tuft('facet', accent, 0, .081, -.086, .151, .142, .171, [0, .16, 0]);
  return { y: .76, z: -.24, scale: .76, stride: .82 };
}

function makeBeetle({ part, mass, eyes, shell, accent, shade, shine }) {
  mass('round', shell, 0, .56, -.13, .424, .326, .572);
  mass('round', shell, 0, .582, .357, .31, .238, .27);
  part('round', shade, 0, .68, -.09, .035, .221, .509, [0, 0, 0]);
  eyes(.164, .673, .547, .061);
  for (const side of sides) {
    part('round', accent, side * .193, .692, -.204, .215, .232, .456, [-.04, side * .22, side * -.15]);
    part('beam', shade, side * .112, .854, .351, .024, .309, .023, [-.24, 0, side * -.32]);
    part('gem', shine, side * .17, .991, .389, .074, .080, .056);
    part('cone', shell, side * .187, .572, .602, .087, .268, .065, [1.26, 0, side * -.17]);
    for (const z of [.246, -.075, -.365]) {
      part('round', shade, side * .35, .279, z, .202, .079, .101, [0, side * .24, side * -.22]);
    }
  }
  return { y: .56, z: -.11, scale: .73, stride: .55 };
}

function makeOctopus({ part, mass, eyes, shell, accent, shade, shine }) {
  mass('round', shell, 0, .82, -.05, .382, .461, .385);
  part('round', accent, 0, .65, .225, .293, .24, .172);
  eyes(.163, .889, .311, .076);
  part('round', shade, 0, .772, .397, .064, .039, .026);
  for (let index = 0; index < 8; index++) {
    const angle = Math.PI * index / 4;
    const x = Math.sin(angle);
    const z = Math.cos(angle);
    const lift = index % 2 ? .092 : .001;
    part('round', shell, x * .346, .30, z * .346 - .045, .104, .122, .275, [-.32, angle, 0]);
    part('round', index % 2 ? shade : accent, x * (.568 - lift), .206 + lift, z * (.568 - lift) - .045,
      .103, .101, .232, [.26 + lift * 2, angle + (index % 2 ? .54 : -.48), 0]);
    part('round', shine, x * .533, .231 + lift, z * .533 - .037, .048, .034, .054);
  }
  return { y: .76, z: -.07, scale: .77, stride: .40 };
}

function makeHummingbird({ part, mass, eyes, wings, tail, shell, accent, shade, shine }) {
  mass('round', shell, 0, .82, -.094, .274, .38, .34, [-.37, 0, 0]);
  mass('round', shell, 0, 1.121, .218, .236, .231, .248);
  part('gem', shine, 0, .940, .324, .184, .238, .116, [-.19, .32, 0]);
  part('cone', shade, 0, 1.067, .663, .045, .463, .051, [1.54, 0, 0]);
  eyes(.132, 1.191, .416, .057);
  wings(.20, .928, -.15, (wing, side) => {
    wing('gem', shell, side * .302, .111, -.104, .457, .139, .195, [.21, side * .25, side * .28]);
    wing('gem', accent, side * .409, .118, -.153, .282, .084, .165, [.22, side * .33, side * .31]);
  });
  const fan = tail(0, .678, -.365);
  for (const side of sides) fan('gem', shade, side * .104, -.102, -.239, .111, .091, .324, [-.49, side * -.35, side * .12]);
  return { y: .82, z: -.092, scale: .57, stride: .67 };
}

function makePorcupine({ part, mass, eyes, shell, accent, shade, shine, face }) {
  mass('round', shell, 0, .592, -.163, .433, .394, .543);
  mass('round', shell, 0, .596, .38, .301, .251, .287);
  part('round', accent, 0, .532, .593, .191, .09, .133);
  part('round', face, 0, .574, .703, .055, .034, .036);
  eyes(.131, .693, .601, .060);
  for (const side of sides) {
    part('round', accent, side * .206, .810, .306, .11, .121, .082);
    for (const z of [.184, -.406]) part('round', shade, side * .272, .221, z, .141, .149, .166);
  }
  for (const back of [.075, -.165, -.397, -.57]) {
    for (const side of [-1, 0, 1]) {
      const height = side ? .74 : .87;
      part('cone', back < -.22 ? shade : shell, side * .298, height, back, .129, .396, .124, [-.75, 0, side * -.59]);
      part('cone', shine, side * .369, height + .121, back - .105, .069, .22, .069, [-.76, 0, side * -.59]);
    }
  }
  return { y: .58, z: -.16, scale: .74, stride: .54 };
}

export const bestiaryAnatomies = Object.freeze({
  fox: makeFox, axolotl: makeAxolotl, stoat: makeStoat, gecko: makeGecko, magpie: makeMagpie,
  lynx: makeLynx, ibex: makeIbex, beetle: makeBeetle, octopus: makeOctopus,
  hummingbird: makeHummingbird, porcupine: makePorcupine
});

const patterns = {
  stripe: [[-.40, .03], [-.10, .21], [.19, .12]],
  spot: [[-.49, .04], [-.20, .22], [.18, -.05], [.40, .11]],
  wave: [[-.42, -.17], [-.23, .11], [.06, .24], [.34, .01]],
  band: [[-.32, -.05], [.12, -.05]],
  speckle: [[-.51, .03], [-.29, .23], [-.09, -.19], [.17, .18], [.37, -.04]]
};

const habitats = {
  sunstep: { count: 2, plume: .91, breadth: 1, light: '#fff1b6' },
  fernwild: { count: 3, plume: 1.02, breadth: 1.03, light: '#d0ffbf' },
  emberdeep: { count: 2, plume: 1.08, breadth: 1.04, light: '#ffc397' },
  glasswater: { count: 3, plume: .88, breadth: .99, light: '#9df8ec' },
  frostpine: { count: 2, plume: 1.17, breadth: 1.025, light: '#d5ecff' },
  cinderbloom: { count: 3, plume: 1.12, breadth: 1.06, light: '#ffd18e' }
};

function hashName(id) {
  let hash = 2166136261;
  for (const letter of id) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function addCrest(draw, crest, { x, y, z, w, d }, material, trim, count, plume) {
  for (let index = 0; index < count; index++) {
    const setback = index / 5;
    const length = (.19 - index * .026) * plume;
    const scale = (.09 - index * .010) * plume;
    const high = y + length * .40 - setback * .08;
    const depth = z - d * (setback + .18);
    const direction = -.48 - index * .155;
    if (crest === 'fin') {
      draw('gem', material, x, high, depth, scale * .59, length, scale * 1.77, [direction, 0, 0]);
      draw('gem', trim, x, high + length * .41, depth - .015, scale * .44, length * .40, scale, [direction, 0, 0]);
    } else if (crest === 'tuft') {
      draw('round', material, x, high, depth, scale * 1.26, length * .68, scale * 1.52, [direction, 0, 0]);
      draw('round', trim, x + w * .08, high + length * .21, depth + .014, scale * .76, length * .38, scale, [direction, 0, 0]);
    } else if (crest === 'horn') {
      draw('cone', material, x, high, depth, scale, length * 1.56, scale, [direction, .16, 0]);
      draw('cone', trim, x, high + length * .44, depth - .026, scale * .62, length * .63, scale * .61, [direction - .13, .16, 0]);
    } else if (crest === 'gem') {
      draw('gem', material, x, high, depth, scale, length * .89, scale, [direction, index * .4, .16]);
    } else {
      const turn = index % 2 ? -1 : 1;
      draw('gem', material, x + turn * w * .12, high, depth, scale, length, scale * .58, [direction, turn * .41, turn * .38]);
      draw('gem', trim, x + turn * w * .17, high + length * .23, depth + .031, scale * .43, length * .45, scale * .31,
        [direction, turn * .41, turn * .38]);
    }
  }
}

function addOriginMarks(draw, shape, pattern, { x, y, z, w, h, d }, mark, trim) {
  for (const side of sides) {
    for (const [index, [along, high]] of (patterns[pattern] || patterns.stripe).entries()) {
      const edge = Math.sqrt(1 - along ** 2 - high ** 2);
      const spread = shape === 'manta' ? .88 : 1;
      const scale = pattern === 'speckle' ? .036 : .058;
      draw(pattern === 'spot' || pattern === 'speckle' ? 'round' : 'gem', index % 2 ? trim : mark,
        x + side * (w * (edge * spread) + .003), y + h * high, z + d * along, .021,
        pattern === 'band' ? .146 : scale * (pattern === 'stripe' ? 1.63 : 1), scale * (pattern === 'wave' ? 1.6 : 1),
        [pattern === 'wave' ? side * .66 : .23, -side * along * .64, side * high * .59]);
    }
  }
}

function addRarityDetail(draw, rarity, { x, y, z, w, h, d }, trim, mark, shell) {
  const shimmer = [];
  const suspend = (material, atX, lift, front, sx, sy, sz, rotation) => {
    const piece = draw('gem', material, atX, lift, front, sx, sy, sz, rotation);
    shimmer.push({ piece, lift, spin: rotation[1] });
  };
  if (rarity === 'primordial') {
    suspend(mark, x, y + h + .17, z - d * .55, .128, .223, .124, [-.27, .38, 0]);
    for (const side of sides) {
      draw('facet', shell, x + side * w * .47, y + h * .67, z - d * .52, .164, .124, .212, [0, side * .29, -side * .36]);
      draw('gem', mark, x + side * w * .66, y + h * .95, z - d * .52, .076, .143, .076, [.12, side * .29, -side * .49]);
    }
  } else if (rarity === 'ethereal') {
    for (const side of sides) {
      suspend(mark, x + side * w * 1.01, y + h * .56, z - d * .63, .065, .125, .139, [-.2, side * .42, side * .16]);
      draw('gem', trim, x + side * w * .71, y + h * .52, z - d * 1.13, .044, .080, .110, [0, side * .38, side * .2]);
    }
  } else if (rarity === 'celestial') {
    draw('ring', trim, x, y + h + .064, z - d * .68, .18, .17, .18, [1.14, 0, -.24]);
    suspend(mark, x + w * .10, y + h + .18, z - d * .67, .065, .083, .055, [.22, .57, .3]);
  } else if (rarity === 'exalted') {
    for (const side of sides) {
      draw('gem', trim, x + side * w * .78, y + h * .60, z - d * .48, .048, .113, .090, [.24, 0, -side * .73]);
    }
  } else if (rarity === 'mythic') {
    for (const side of sides) {
      suspend(mark, x + side * w * 1.12, y + h * .66, z - d * .40, .059, .139, .083, [-.48, side * .49, side * -.43]);
      draw('gem', trim, x + side * w * .81, y + h * .57, z - d * .55, .103, .069, .155, [-.36, side * .49, side * -.45]);
    }
  } else if (rarity === 'legendary') {
    draw('gem', trim, x, y + h * 1.09, z - d * .64, .122, .153, .147, [-.52, .19, 0]);
    draw('gem', mark, x, y + h * 1.37, z - d * .74, .054, .114, .084, [-.57, .20, 0]);
  } else if (rarity === 'epic' || rarity === 'rare') {
    const width = rarity === 'epic' ? .095 : .051;
    for (const side of sides) {
      draw('gem', trim, x + side * w * .64, y + h * .76, z - d * .45, width, .082, .145, [-.39, side * .44, side * -.36]);
    }
  }
  return shimmer;
}

export function dressBestiaryPet(group, spec, kit, mass, titanium) {
  const seed = hashName(spec.id);
  const { count, plume, breadth, light } = habitats[spec.habitatId] || habitats.sunstep;
  const { pattern = 'stripe', crest = 'leaf' } = spec.appearance || {};
  const draw = (...parts) => kit.mesh(group, ...parts);
  const origin = {
    x: mass.position.x, y: mass.position.y, z: mass.position.z,
    w: mass.scale.x, h: mass.scale.y, d: mass.scale.z
  };
  const metalTrim = titanium ? kit.steel('#668593', true) : kit.paint(spec.accent, .09, .29, 'soft');
  const mark = kit.paint(light, .16, .13, 'polished');
  const top = { ...origin, y: origin.y + origin.h * .93 };
  addOriginMarks(draw, spec.shape, pattern, origin, mark, metalTrim);
  addCrest(draw, crest, top, metalTrim, mark, count + (seed % 3 === 0 ? 1 : 0), plume);
  group.userData.shimmer = addRarityDetail(draw, spec.rarity, origin, metalTrim, mark, mass.material);
  group.scale.set(breadth * (.958 + (seed % 19) / 230), .94 + (seed >>> 8 & 31) / 250, .94 + (seed >>> 16 & 31) / 260);
}
