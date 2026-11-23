import * as THREE from './vendor/three/three.module.min.js';
import { GENERATOR_SITE } from './generator.js?v=20261123-3';

const tau = Math.PI * 2;
const center = { x: GENERATOR_SITE.x + .78, z: GENERATOR_SITE.z - 2.15 };
const wheelCenter = { x: -.78, y: 1.28, z: 1.23 };
const gripOrbit = .36;
const gripDepth = .55;
const colors = {
  gravel: '#8d9c87', concrete: '#b5ae92', grout: '#7a8980', coal: '#364b4c', iron: '#526d68',
  dark: '#253c3e', green: '#487a6f', leather: '#4e443b', brass: '#d8a368', polished: '#f1c585',
  copper: '#b27250', ceramic: '#d6ceb5', energy: '#71e5b5', advanced: '#bed0ff', ember: '#ffc991'
};

function groupAt(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function gearRim(teeth, outer, root, inner, depth) {
  const profile = new THREE.Shape();
  const pitch = tau / teeth;
  for (let tooth = 0; tooth < teeth; tooth++) {
    for (const [offset, radius] of [[-.5, root], [-.29, root], [-.18, outer], [.18, outer], [.29, root]]) {
      const angle = (tooth + offset) * pitch;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (tooth === 0 && offset === -.5) profile.moveTo(x, y);
      else profile.lineTo(x, y);
    }
  }
  profile.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, tau, true);
  profile.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(profile, {
    depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .023, bevelThickness: .022, curveSegments: 12
  });
  return geometry.translate(0, 0, -depth / 2);
}

function workshopSign() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const pen = canvas.getContext('2d');
  pen.fillStyle = '#263f41';
  pen.fillRect(0, 0, 512, 128);
  pen.strokeStyle = '#e1b777';
  pen.lineWidth = 4;
  pen.strokeRect(12, 11, 488, 106);
  pen.fillStyle = '#f1d4a4';
  pen.font = '700 42px Georgia, serif';
  pen.textAlign = 'center';
  pen.fillText('Crank Workshop', 256, 60);
  pen.fillStyle = '#b4d4c3';
  pen.font = '650 19px system-ui';
  pen.fillText('PETVERSE ENERGY WORKS', 256, 94);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map });
}

function makeGear(parent, kit, { x, y, z, radius, teeth, metal, hub, spokes = 4 }) {
  const { mesh } = kit;
  const axleRotation = [Math.PI / 2, 0, 0];
  const gear = groupAt(parent, x, y, z);
  const rim = new THREE.Mesh(gearRim(teeth, radius, radius - .096, radius * .67, .15), metal);
  rim.castShadow = true;
  rim.receiveShadow = true;
  gear.add(rim);
  for (let index = 0; index < spokes; index++) {
    const angle = index * tau / spokes;
    mesh(gear, 'box', metal, Math.cos(angle) * radius * .46, Math.sin(angle) * radius * .46, 0,
      radius * .56, .106, .144, [0, 0, angle]);
  }
  mesh(gear, 'beam', hub, 0, 0, .056, radius * .27, .23, radius * .27, axleRotation);
  mesh(gear, 'beam', metal, 0, 0, .19, radius * .16, .13, radius * .16, axleRotation);
  return gear;
}

function tube(parent, material, points, radius) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, radius, 8, false), material);
  pipe.receiveShadow = true;
  parent.add(pipe);
  return curve;
}

/** Install the physical generator, its controls, and an arm pose matching the turning grip. */
export function createGeneratorWorkshop(parent, kit) {
  const { mesh, paint, steel } = kit;
  const site = groupAt(parent, center.x, 0, center.z);
  site.name = 'Crank Workshop';
  const { gravel, concrete, grout, coal, iron, dark, green, leather, brass, polished, copper, ceramic, energy, advanced, ember } = colors;
  const metal = steel(brass);
  const rimMetal = steel(polished, true);
  const axleMetal = steel('#8ca9aa');
  const copperMetal = steel(copper);
  const steelGreen = paint(green, 0, .18);
  const glow = new THREE.MeshStandardMaterial({ color: energy, emissive: energy, emissiveIntensity: .19, roughness: .22, metalness: .15 });
  const flowColor = new THREE.MeshBasicMaterial({ color: energy });
  const frameColor = paint(iron, 0, .15);
  const creamLamp = paint('#ffe5a0', .32);
  const axleRotation = [Math.PI / 2, 0, 0];

  mesh(site, 'beam', gravel, 0, .039, 0, 3.93, .08, 3.13, [0, Math.PI / 8, 0]);
  mesh(site, 'beam', grout, 0, .077, 0, 3.52, .14, 2.79, [0, Math.PI / 8, 0]);
  mesh(site, 'beam', concrete, 0, .15, 0, 3.41, .065, 2.69, [0, Math.PI / 8, 0]);
  for (let row = 0; row < 4; row++) {
    const columns = [5, 5, 4, 3][row];
    const offset = [0, .25, -.15, -.50][row];
    for (let column = 0; column < columns; column++) {
      const x = (column - (columns - 1) / 2) * .9 + offset;
      mesh(site, 'box', column % 2 ? '#a89f8c' : '#b9af97', x, .185, row * .46 + .94, .88, .025, .435);
    }
  }
  mesh(site, 'box', gravel, -.78, .031, 2.94, 2.88, .065, 1.32);
  mesh(site, 'box', polished, -.78, .201, 2.48, 1.35, .019, .063);
  for (const side of [-1, 1]) {
    const x = side * 2.93;
    mesh(site, 'beam', grout, x, .21, -1.91, .39, .33, .39);
    mesh(site, 'box', frameColor, x, 2.15, -1.91, .33, 3.85, .33).castShadow = true;
    mesh(site, 'box', copper, x, 3.35, -1.91, .41, .22, .40);
    mesh(site, 'box', steelGreen, x, 3.79, -1.08, .18, .20, 2.05).castShadow = true;
    mesh(site, 'box', iron, x, 3.36, -1.28, .19, 1.36, .19, [.81, 0, 0]);
    mesh(site, 'box', coal, x, 3.42, -.19, .49, .15, .49);
    mesh(site, 'beam', creamLamp, x, 3.21, -.19, .17, .32, .17);
    mesh(site, 'beam', coal, x, 3.025, -.19, .21, .079, .21);
  }
  mesh(site, 'box', frameColor, 0, 3.88, -1.91, 6.32, .26, .33).castShadow = true;
  mesh(site, 'box', steelGreen, 0, 4.24, -1.42, 6.47, .18, 1.35, [-.23, 0, 0]).castShadow = true;
  mesh(site, 'box', green, 0, 4.24, -.52, 6.47, .18, 1.11, [.30, 0, 0]).castShadow = true;
  mesh(site, 'box', coal, 0, 4.46, -.96, 6.5, .13, .18);
  // Open sides keep the moving gears and player visible from the path.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.83, .96), workshopSign());
  sign.position.set(0, 4.38, .28);
  site.add(sign);
  mesh(site, 'box', leather, 0, 4.38, .211, 3.96, 1.035, .12).castShadow = true;
  for (const side of [-1, 1]) mesh(site, 'beam', steelGreen, side * 1.34, 4.15, -.28, .042, .60, .042, [1.18, 0, 0]);

  const engine = groupAt(site, 0, 0, 0);
  engine.name = 'Crank Generator';
  mesh(engine, 'box', coal, -.09, .37, -.18, 3.50, .40, 2.16).castShadow = true;
  mesh(engine, 'box', green, -.17, 1.13, -.24, 3.08, 1.40, 1.79).castShadow = true;
  mesh(engine, 'box', dark, -.20, 1.16, .72, 2.85, 1.19, .32);
  mesh(engine, 'box', steelGreen, -.20, 1.87, -.25, 3.45, .21, 1.96);
  for (const x of [-1.48, 1.16]) {
    mesh(engine, 'box', metal, x, 1.12, .735, .105, 1.2, .125);
    for (const y of [.64, 1.62]) mesh(engine, 'beam', axleMetal, x, y, .82, .08, .08, .08, axleRotation);
  }
  mesh(engine, 'box', copperMetal, -.20, .67, .93, 2.70, .13, .11);
  for (let index = 0; index < 7; index++) {
    mesh(engine, 'box', iron, -1.15 + index * .29, .38, .94, .18, .09, .09, [0, 0, -.35]);
  }

  const large = makeGear(engine, kit, { ...wheelCenter, z: 1.007, radius: .638, teeth: 16, metal, hub: axleMetal, spokes: 5 });
  const small = makeGear(engine, kit, { x: .20, y: 1.41, z: 1.007, radius: .389, teeth: 10, metal: axleMetal, hub: rimMetal });
  const distribution = makeGear(engine, kit, { x: .83, y: 1.63, z: 1.007, radius: .313, teeth: 8, metal: copperMetal, hub: axleMetal, spokes: 3 });
  large.name = 'Primary gear';
  small.name = 'Counter gear';
  distribution.name = 'Energy gear';
  const handWheel = groupAt(engine, wheelCenter.x, wheelCenter.y, wheelCenter.z);
  handWheel.name = 'Mechanical crank';
  mesh(handWheel, 'beam', axleMetal, 0, 0, .095, .19, .32, .19, axleRotation);
  mesh(handWheel, 'ring', rimMetal, 0, 0, .13, .446, .446, .85).castShadow = true;
  for (let index = 0; index < 3; index++) {
    const angle = index * tau / 3;
    mesh(handWheel, 'box', rimMetal, Math.cos(angle) * .206, Math.sin(angle) * .206, .13, .428, .065, .068, [0, 0, angle]);
  }
  mesh(handWheel, 'beam', copperMetal, gripOrbit, 0, .28, .073, .30, .073, axleRotation);
  const grip = mesh(handWheel, 'beam', leather, gripOrbit, 0, gripDepth - .075, .096, .214, .096, axleRotation);
  grip.name = 'Crank grip';
  mesh(handWheel, 'beam', rimMetal, gripOrbit, 0, gripDepth + .025, .115, .055, .115, axleRotation);
  mesh(engine, 'beam', leather, -.22, 1.01, 1.59, .087, .23, .087, axleRotation);
  mesh(engine, 'beam', copperMetal, -.22, 1.01, 1.71, .104, .058, .104, axleRotation);

  const energyColumn = groupAt(site, -.13, 2.05, -.50);
  mesh(energyColumn, 'beam', copperMetal, 0, .076, 0, .86, .25, .86);
  mesh(energyColumn, 'beam', dark, 0, .218, 0, .75, .14, .75);
  mesh(energyColumn, 'beam', axleMetal, 0, 1.07, 0, .76, .18, .76);
  mesh(energyColumn, 'beam', copperMetal, 0, 1.22, 0, .53, .16, .53);
  mesh(energyColumn, 'gem', glow, 0, 1.49, 0, .22, .47, .22, [.09, .3, -.09]);
  const core = groupAt(energyColumn, 0, .65, 0);
  mesh(core, 'gem', glow, 0, .04, 0, .35, .57, .35, [.15, -.14, -.20]);
  mesh(core, 'gem', glow, -.28, -.071, .20, .14, .33, .14, [0, -.3, .38]);
  mesh(core, 'gem', glow, .26, -.09, -.11, .16, .33, .17, [.18, .8, -.45]);
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * tau;
    mesh(energyColumn, 'beam', rimMetal, Math.cos(angle) * .65, .66, Math.sin(angle) * .65, .055, .93, .055);
  }

  const canisters = groupAt(site, 2.20, 0, .10);
  mesh(canisters, 'beam', gravel, 0, .223, 0, .74, .23, .67);
  mesh(canisters, 'beam', iron, 0, .80, 0, .49, 1.25, .48);
  mesh(canisters, 'beam', copperMetal, 0, 1.44, 0, .54, .16, .54);
  mesh(canisters, 'beam', ceramic, 0, 1.73, 0, .36, .49, .36);
  mesh(canisters, 'ring', glow, 0, 1.72, 0, .382, .382, .42, axleRotation);
  mesh(canisters, 'beam', rimMetal, 0, 1.97, 0, .40, .11, .40);
  const conduitPaths = [
    [[.52, 2.36, -.61], [.97, 2.41, -.62], [1.57, 2.65, -.59], [2.15, 2.61, -.33], [2.20, 2.24, .06], [2.20, 2.02, .10]],
    [[-.8, 2.32, -.62], [-1.40, 2.34, -.61], [-1.90, 2.20, -.51], [-2.04, 1.44, -.42], [-1.56, 1.22, -.29]]
  ];
  const circulation = conduitPaths.map(points => {
    tube(site, copperMetal, points, .087);
    const strip = points.map(([x, y, z]) => [x, y + .038, z + .058]);
    const curve = tube(site, glow, strip, .033);
    return { curve, pulse: mesh(site, 'round', flowColor, 0, 0, 0, .095, .095, .095) };
  });
  const regulator = groupAt(site, 1.66, 1.40, 1.09);
  mesh(regulator, 'box', coal, 0, 0, 0, .51, .93, .21, [-.15, 0, 0]);
  const gauge = Array.from({ length: 8 }, (_, index) => mesh(regulator, 'box', iron, 0, -.33 + index * .091, .122, .31, .064, .07));
  mesh(site, 'beam', dark, -2.07, .23, -.26, .52, .22, .52);
  const backupCore = groupAt(site, -2.07, 0, -.26);
  mesh(backupCore, 'beam', axleMetal, 0, .70, 0, .37, .72, .37);
  mesh(backupCore, 'beam', copperMetal, 0, 1.07, 0, .43, .15, .43);
  mesh(backupCore, 'gem', glow, 0, 1.40, 0, .22, .65, .23, [.06, .02, .09]);
  const emberHousing = groupAt(backupCore, 0, 1.57, 0);
  mesh(emberHousing, 'ring', rimMetal, 0, .10, 0, .40, .40, .56, [.65, .72, -.25]);
  mesh(emberHousing, 'ring', glow, 0, .10, 0, .45, .45, .55, [1.59, -.34, .63]);
  mesh(emberHousing, 'gem', glow, 0, .72, 0, .096, .19, .096);
  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const wrist = new THREE.Vector3();
  const gripPoint = new THREE.Vector3();
  const sleeveRotation = new THREE.Quaternion();
  const armRest = new WeakMap();
  let pose = 0;
  let angle = .42;
  let turning = 0;
  let lit = 0;
  let lastTier = null;
  let filledCells = -1;

  function adjustPose(traveler, dt, active) {
    if (!traveler?.userData.arms) return;
    pose = THREE.MathUtils.damp(pose, Number(active), 12, dt);
    if (pose < .002) pose = 0;
    for (const { side, sleeve, hand } of traveler.userData.arms) {
      let rest = armRest.get(sleeve);
      if (!rest) {
        rest = { p: sleeve.position.clone(), q: sleeve.quaternion.clone(), s: sleeve.scale.clone(), hand: hand.position.clone() };
        armRest.set(sleeve, rest);
      }
      if (!pose && !active) {
        sleeve.position.copy(rest.p);
        sleeve.quaternion.copy(rest.q);
        sleeve.scale.copy(rest.s);
        hand.position.copy(rest.hand);
        continue;
      }
      shoulder.set(side * .34, 1.26, .045);
      if (side === 1) gripPoint.set(center.x + wheelCenter.x + Math.cos(angle) * gripOrbit,
        wheelCenter.y + Math.sin(angle) * gripOrbit, center.z + wheelCenter.z + gripDepth - .065);
      else gripPoint.set(center.x - .22, 1.01, center.z + 1.70);
      wrist.copy(traveler.worldToLocal(gripPoint));
      axis.copy(wrist).sub(shoulder).clampLength(.08, .90);
      sleeveRotation.setFromUnitVectors(up, wrist.copy(axis).normalize());
      sleeve.quaternion.copy(rest.q).slerp(sleeveRotation, pose);
      sleeve.position.copy(rest.p).lerp(wrist.copy(shoulder).addScaledVector(axis, .43), pose);
      sleeve.scale.copy(rest.s);
      sleeve.scale.y = THREE.MathUtils.lerp(rest.s.y, axis.length() * .52, pose);
      hand.position.copy(rest.hand).lerp(wrist.copy(shoulder).add(axis), pose);
    }
  }

  function update(dt, { active = false, ratio = 0, tier = 1, rate = 8, animate = true, reducedMotion = false } = {}, traveler) {
    const speed = Number.isFinite(rate) ? Math.sqrt(Math.max(rate, 0) / 8) : 1;
    const running = active && animate && !reducedMotion;
    turning = THREE.MathUtils.damp(turning, running ? THREE.MathUtils.clamp(speed, .85, 3.4) * 3 : 0, 7, dt);
    if (!running && turning < .008) turning = 0;
    angle = (angle + turning * dt) % (tau * 5);
    large.rotation.z = angle;
    small.rotation.z = -angle * 16 / 10 + .18;
    distribution.rotation.z = angle * 16 / 8 + .27;
    handWheel.rotation.z = angle;
    core.rotation.y = (core.rotation.y + turning * dt * .61) % tau;
    emberHousing.rotation.y = core.rotation.y;
    if (tier !== lastTier) {
      lastTier = tier;
      glow.color.set(tier >= 3 ? ember : tier >= 2 ? advanced : energy);
      glow.emissive.copy(glow.color);
      flowColor.color.copy(glow.color);
      backupCore.visible = tier >= 2;
      emberHousing.visible = tier >= 3;
    }
    lit = THREE.MathUtils.damp(lit, Number(active), 5, dt);
    glow.emissiveIntensity = .21 + lit * .48;
    for (let index = 0; index < circulation.length; index++) {
      const { curve, pulse } = circulation[index];
      pulse.visible = running;
      if (pulse.visible) curve.getPointAt((angle / tau * 6 + index * .41) % 1, pulse.position);
    }
    const cells = Math.round(Math.max(0, Math.min(1, ratio)) * gauge.length);
    if (cells !== filledCells) {
      filledCells = cells;
      gauge.forEach((cell, index) => { cell.material = index < cells ? glow : frameColor; });
    }
    const nearHandle = traveler && Math.hypot(traveler.position.x - GENERATOR_SITE.x, traveler.position.z - GENERATOR_SITE.z) < .72;
    adjustPose(traveler, dt, running && nearHandle);
  }

  update(0);
  return {
    target: { ...GENERATOR_SITE, type: 'generator', group: site },
    floorHeight(x, z) {
      const pavedRadius = Math.hypot((x - center.x) / 3.43, (z - center.z) / 2.69);
      return .198 * THREE.MathUtils.clamp((1.025 - pavedRadius) / .105, 0, 1);
    },
    obstacles: [{ x: center.x - .08, z: center.z - .43, radius: 1.46 },
      { x: center.x - 2.93, z: center.z - 1.91, radius: .28 },
      { x: center.x + 2.93, z: center.z - 1.91, radius: .28 },
      { x: center.x + 2.2, z: center.z + .10, radius: .70 },
      { x: center.x - 2.07, z: center.z - .26, radius: .52 }],
    update
  };
}
