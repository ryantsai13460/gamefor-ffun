import * as THREE from './vendor/three/three.module.min.js';

export const qualityPresets = Object.freeze({
  low: { scale: .68, far: 68, pixels: 1_300_000, shadows: 0, shadowInterval: 120 },
  medium: { scale: 1, far: 105, pixels: 2_200_000, shadows: 512, shadowInterval: 100 },
  high: { scale: 1.24, far: 150, pixels: 3_200_000, shadows: 1024, shadowInterval: 65 },
  ultra: { scale: 1.58, far: 195, pixels: 4_600_000, shadows: 2048, shadowInterval: 38 }
});

const shadowModes = { off: 0, low: 512, medium: 1024, high: 1536, ultra: 2048 };
const textureModes = { low: 1, medium: 2, high: 8 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const unit = value => Number.isFinite(value) ? clamp(value, 0, 1) : .5;
const sunOffset = Object.freeze({ x: -18, y: 33, z: 13 });

export function createWorldLighting(scene, palette) {
  const skylight = new THREE.HemisphereLight(palette.ambient, '#839cab', 2.15);
  const sun = new THREE.DirectionalLight(palette.sunlight, 2.36);
  const fill = new THREE.DirectionalLight('#b6daff', .42);
  sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  fill.position.set(12, 8, -16);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -23, right: 23, near: .8, far: 76, top: 23, bottom: -23 });
  sun.shadow.bias = -.00036;
  sun.shadow.normalBias = .048;
  sun.shadow.radius = 2.4;
  scene.add(skylight, sun, sun.target, fill);
  return { skylight, sun };
}

const quadVertex = `
  varying vec2 sampleUV;
  void main() {
    sampleUV = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const quadFragment = `
  uniform sampler2D sceneColor;
  uniform vec2 texel;
  uniform bool edgeSmoothing;
  uniform bool glow;
  uniform float glowThreshold;
  varying vec2 sampleUV;

  float sceneLuma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 smoothEdge(vec3 center) {
    float nw = sceneLuma(texture2D(sceneColor, sampleUV + vec2(-1.0, -1.0) * texel).rgb);
    float ne = sceneLuma(texture2D(sceneColor, sampleUV + vec2( 1.0, -1.0) * texel).rgb);
    float sw = sceneLuma(texture2D(sceneColor, sampleUV + vec2(-1.0,  1.0) * texel).rgb);
    float se = sceneLuma(texture2D(sceneColor, sampleUV + vec2( 1.0,  1.0) * texel).rgb);
    float low = min(sceneLuma(center), min(min(nw, ne), min(sw, se)));
    float high = max(sceneLuma(center), max(max(nw, ne), max(sw, se)));
    if (high - low < max(0.035, high * 0.13)) return center;

    vec2 direction = vec2(sw + se - nw - ne, nw + sw - ne - se);
    float reduce = max((nw + ne + sw + se) * 0.03125, 0.0078125);
    direction = clamp(direction / (min(abs(direction.x), abs(direction.y)) + reduce),
      vec2(-7.0), vec2(7.0)) * texel;
    vec3 narrow = 0.5 * (texture2D(sceneColor, sampleUV - direction / 6.0).rgb
      + texture2D(sceneColor, sampleUV + direction / 6.0).rgb);
    vec3 wide = narrow * 0.5 + 0.25 * (texture2D(sceneColor, sampleUV - direction * 0.5).rgb
      + texture2D(sceneColor, sampleUV + direction * 0.5).rgb);
    float result = sceneLuma(wide);
    return result < low || result > high ? narrow : wide;
  }

  vec3 highlight(vec2 offset) {
    vec3 color = texture2D(sceneColor, sampleUV + offset * texel).rgb;
    float brightness = sceneLuma(color);
    float excess = max(brightness - glowThreshold, 0.0);
    return clamp(color / max(brightness, 0.01) * excess, 0.0, 1.8);
  }

  void main() {
    vec3 color = texture2D(sceneColor, sampleUV).rgb;
    if (edgeSmoothing) color = smoothEdge(color);
    if (glow) {
      vec3 nearGlow = highlight(vec2(-3.0, 0.0)) + highlight(vec2(3.0, 0.0))
        + highlight(vec2(0.0, -3.0)) + highlight(vec2(0.0, 3.0));
      vec3 farGlow = highlight(vec2(-6.0, -6.0)) + highlight(vec2(6.0, -6.0))
        + highlight(vec2(-6.0, 6.0)) + highlight(vec2(6.0, 6.0));
      color += nearGlow * 0.055 + farGlow * 0.021;
    }
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createRenderQuality(renderer, scene, camera, { canvas, sun }) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor('#b9d9d5');

  const sky = scene.getObjectByName('petverse-sky');
  const canDrawFloat = renderer.extensions.has('EXT_color_buffer_float');
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const maxTextureSize = renderer.capabilities.maxTextureSize;
  const drawSize = new THREE.Vector2();
  let cssWidth = 1;
  let cssHeight = 1;
  let applied = {};
  let postprocess;
  let priorShadowAt = -Infinity;
  let previousFocusX = Infinity;
  let previousFocusZ = Infinity;

  function resize(width, height) {
    cssWidth = Math.max(1, width);
    cssHeight = Math.max(1, height);
    const { profile, resolution } = applied;
    const density = Math.min(1.65, 1 + .5 * Math.max(0, (globalThis.devicePixelRatio || 1) - 1));
    const requested = profile.scale * (.66 + resolution * .68) * density;
    const budget = Math.sqrt(profile.pixels / (cssWidth * cssHeight));
    const pixelRatio = Math.min(requested, budget, maxTextureSize / Math.max(cssWidth, cssHeight));
    renderer.setDrawingBufferSize(cssWidth, cssHeight, pixelRatio);
    camera.aspect = cssWidth / cssHeight;
    camera.updateProjectionMatrix();
    if (postprocess) sizePass();
  }

  function sizePass() {
    renderer.getDrawingBufferSize(drawSize);
    const width = Math.max(1, drawSize.x);
    const height = Math.max(1, drawSize.y);
    postprocess.target.setSize(width, height);
    postprocess.material.uniforms.texel.value.set(1 / width, 1 / height);
  }

  function setupPass() {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: canDrawFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      colorSpace: THREE.LinearSRGBColorSpace
    });
    const material = new THREE.ShaderMaterial({
      vertexShader: quadVertex, fragmentShader: quadFragment, depthTest: false, depthWrite: false,
      uniforms: {
        sceneColor: { value: target.texture }, texel: { value: new THREE.Vector2() },
        edgeSmoothing: { value: false }, glow: { value: false },
        glowThreshold: { value: canDrawFloat ? 1.04 : .82 }
      }
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    postprocess = { target, material, geometry, scene: quadScene, camera: new THREE.Camera() };
    sizePass();
  }

  function disposePass() {
    if (!postprocess) return;
    postprocess.target.dispose();
    postprocess.material.dispose();
    postprocess.geometry.dispose();
    postprocess = null;
  }

  function tuneTextures(level) {
    const updated = new Set();
    scene.traverse(object => {
      const material = object.material;
      for (const surface of Array.isArray(material) ? material : [material]) {
        const texture = surface?.map;
        if (!texture?.isCanvasTexture || updated.has(texture)) continue;
        updated.add(texture);
        texture.generateMipmaps = level !== 'low';
        texture.minFilter = level === 'low' ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.anisotropy = Math.min(maxAnisotropy, textureModes[level]);
        texture.needsUpdate = true;
      }
    });
  }

  function setShadows(size) {
    renderer.shadowMap.enabled = size > 0;
    sun.castShadow = size > 0;
    if (!size || sun.shadow.mapSize.x !== size) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      if (size) sun.shadow.mapSize.set(size, size);
    }
    renderer.shadowMap.needsUpdate = size > 0;
    priorShadowAt = -Infinity;
  }

  function update(graphics = {}) {
    const quality = Object.hasOwn(qualityPresets, graphics.quality) ? graphics.quality : 'medium';
    const profile = qualityPresets[quality];
    const resolution = unit(graphics.resolution);
    const drawDistance = unit(graphics.drawDistance);
    const far = Math.round(profile.far * (.64 + .72 * drawDistance));
    const sizeLimit = Object.hasOwn(shadowModes, graphics.shadowQuality) ? shadowModes[graphics.shadowQuality] : shadowModes.medium;
    const shadows = graphics.shadows === false ? 0 : Math.min(sizeLimit, profile.shadows);
    const texture = Object.hasOwn(textureModes, graphics.textureQuality) ? graphics.textureQuality : 'medium';
    const aa = graphics.antiAliasing !== false;
    const bloom = graphics.bloom === true;
    const previous = applied;
    applied = { quality, profile, resolution, far, shadows, texture, aa, bloom };
    if (previous.far !== far) {
      camera.far = far;
      camera.updateProjectionMatrix();
      if (scene.fog?.isFog) {
        scene.fog.near = far * .35;
        scene.fog.far = far * .88;
      }
      if (sky) sky.scale.setScalar(far * .81 / 160);
    }
    if (previous.shadows !== shadows) setShadows(shadows);
    if (previous.texture !== texture) tuneTextures(texture);
    if (previous.quality !== quality || previous.resolution !== resolution) resize(cssWidth, cssHeight);
    if (previous.aa !== aa || previous.bloom !== bloom) {
      if ((aa || bloom) && !postprocess) setupPass();
      if (!aa && !bloom) disposePass();
      else {
        postprocess.material.uniforms.edgeSmoothing.value = aa;
        postprocess.material.uniforms.glow.value = bloom;
      }
    }
    if (previous.quality !== quality) canvas.dataset.renderQuality = quality;
    if (previous.far !== far) canvas.dataset.drawDistance = String(far);
    if (previous.shadows !== shadows) canvas.dataset.shadowResolution = String(shadows);
    if (previous.texture !== texture) canvas.dataset.textureQuality = texture;
    if (previous.aa !== aa) canvas.dataset.antiAliasing = String(aa);
    if (previous.bloom !== bloom) canvas.dataset.bloom = String(bloom);
  }

  function draw(focus) {
    if (sky) sky.position.copy(camera.position);
    const now = performance.now();
    if (applied.shadows && now - priorShadowAt >= applied.profile.shadowInterval) {
      if (focus) {
        const x = Math.round(focus.x / 1.5) * 1.5;
        const z = Math.round(focus.z / 1.5) * 1.5;
        if (x !== previousFocusX || z !== previousFocusZ || sun.target.position.x !== x || sun.target.position.z !== z) {
          const y = focus.y || 0;
          sun.position.set(x + sunOffset.x, y + sunOffset.y, z + sunOffset.z);
          sun.target.position.set(x, y, z);
          previousFocusX = x;
          previousFocusZ = z;
        }
      }
      renderer.shadowMap.needsUpdate = true;
      priorShadowAt = now;
    }
    if (applied.aa || applied.bloom) {
      renderer.setRenderTarget(postprocess.target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postprocess.scene, postprocess.camera);
    } else renderer.render(scene, camera);
  }

  function dispose() {
    disposePass();
    sun.shadow.dispose();
    renderer.dispose();
  }

  update();
  return { update, resize, draw, dispose };
}
