const portraitSize = 112;
const cacheLimit = 80;
const materialsLimit = 480;

// One idle renderer draws the exact in-world assets. The small cached images
// let the browser scroll a large habitat without creating a context per pet.
export function createPetPreviews() {
  const observed = new Map();
  const queued = new Map();
  const cache = new Map();
  let loading;
  let studio;
  let frame;
  let pruning = false;
  let stopped = false;

  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const job = observed.get(entry.target);
      if (!job) continue;
      if (!entry.target.isConnected || entry.isIntersecting) forget(entry.target);
      if (entry.isIntersecting && entry.target.isConnected) enqueue(entry.target, job);
    }
  }, { threshold: .01 }) : null;

  function forget(holder) {
    observer?.unobserve(holder);
    observed.delete(holder);
  }

  function show(holder, imageSource) {
    if (!holder.isConnected || holder.querySelector('.pv-pet-render')) return;
    const picture = document.createElement('img');
    picture.className = 'pv-pet-render';
    picture.alt = '';
    picture.width = picture.height = portraitSize;
    picture.decoding = 'async';
    picture.draggable = false;
    picture.addEventListener('load', () => { holder.dataset.modelPreview = 'ready'; }, { once: true });
    picture.addEventListener('error', () => picture.remove(), { once: true });
    holder.append(picture);
    picture.src = imageSource;
  }

  function enqueue(holder, job) {
    const cached = cache.get(job.key);
    if (cached) {
      cache.delete(job.key);
      cache.set(job.key, cached);
      show(holder, cached);
      return;
    }
    if (!queued.has(job.key)) queued.set(job.key, { ...job, holders: new Set() });
    queued.get(job.key).holders.add(holder);
    schedule();
  }

  async function makeStudio() {
    const [THREE, models] = await Promise.all([
      import('./vendor/three/three.module.min.js'),
      import('./models.js?v=20261125-1')
    ]);
    if (stopped) return null;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setSize(portraitSize, portraitSize);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 48);
    const key = new THREE.DirectionalLight('#fff1d6', 2.7);
    key.position.set(4, 6, 5);
    const rim = new THREE.DirectionalLight('#a8dcff', 2.1);
    rim.position.set(-3, 2.7, -4.4);
    scene.add(new THREE.HemisphereLight('#f9fdf4', '#a697a2', 2.2), key, rim);
    canvas.addEventListener('webglcontextlost', dispose, { once: true });
    const bounds = new THREE.Box3();
    const center = new THREE.Vector3();
    const corner = new THREE.Vector3();
    const dimensions = new THREE.Vector3();
    let kit = models.createModelKit();

    return {
      draw(species, variant) {
        if (kit.materials.size >= materialsLimit) {
          kit.dispose();
          kit = models.createModelKit();
        }
        const pet = models.createPet(species, variant, kit);
        scene.add(pet);
        try {
          bounds.setFromObject(pet).getCenter(center);
          // Fit both a slender upright pet and a broad-winged pet into the
          // same portrait using their real projected extents.
          const depth = Math.max(1, bounds.getSize(dimensions).length() / 6);
          camera.position.set(center.x + 4 * depth, center.y + 2.8 * depth, center.z + 7 * depth);
          camera.lookAt(center);
          camera.updateMatrixWorld();
          let extent = .2;
          for (const x of [bounds.min.x, bounds.max.x])
            for (const y of [bounds.min.y, bounds.max.y])
              for (const z of [bounds.min.z, bounds.max.z]) {
                corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
                extent = Math.max(extent, Math.abs(corner.x), Math.abs(corner.y));
              }
          const radius = extent * 1.17;
          Object.assign(camera, { left: -radius, right: radius, top: radius, bottom: -radius });
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          const imageSource = canvas.toDataURL('image/png');
          return imageSource.startsWith('data:image/png;') ? imageSource : '';
        } finally {
          pet.removeFromParent();
        }
      },
      dispose() {
        canvas.removeEventListener('webglcontextlost', dispose);
        kit.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }

  function schedule() {
    if (!stopped && frame === undefined && queued.size) frame = requestAnimationFrame(draw);
  }

  async function draw() {
    try {
      loading ||= makeStudio();
      studio ||= await loading;
      if (stopped || !studio) return;
      for (const [key, job] of queued) {
        queued.delete(key);
        const holders = [...job.holders].filter(holder => holder.isConnected);
        if (!holders.length) continue;
        const imageSource = studio.draw(job.species, job.variant);
        if (imageSource) {
          cache.set(key, imageSource);
          if (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
          for (const holder of holders) show(holder, imageSource);
        }
        break;
      }
    } catch {
      dispose();
    } finally {
      frame = undefined;
      schedule();
    }
  }

  function attach(holder, species, variant = 'normal') {
    if (stopped || !species?.id) return;
    const job = { key: `${species.id}:${variant}`, species, variant };
    if (observer) {
      observed.set(holder, job);
      observer.observe(holder);
      if (!pruning) {
        pruning = true;
        queueMicrotask(() => {
          pruning = false;
          for (const node of observed.keys()) if (!node.isConnected) forget(node);
        });
      }
    } else queueMicrotask(() => { if (!stopped && holder.isConnected) enqueue(holder, job); });
  }

  function dispose() {
    if (stopped) return;
    stopped = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    observer?.disconnect();
    observed.clear();
    queued.clear();
    cache.clear();
    studio?.dispose();
  }

  return { attach, dispose };
}
