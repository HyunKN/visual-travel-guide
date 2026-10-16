import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { motionEnabled } from './motion.js';

// Original, deliberately simplified illustration; never a survey or a reconstruction.
const colors = { roof: 0x303b4b, tile: 0x8ca3ae, green: 0x29574f, wood: 0x79413a, red: 0xb25748, ivory: 0xf7f8f4, blue: 0x416b96, gold: 0xd4b86f, stone: 0xe1e2e5, water: 0x89c2cd };

function makePalace(pavilion = false) {
  const group = new THREE.Group(), materials = new Map();
  const material = (key) => {
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color: colors[key], roughness: .8, transparent: true }));
    return materials.get(key);
  };
  const box = (w, h, d, x, y, z, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    m.position.set(x, y, z); group.add(m); return m;
  };
  const pillar = (x, y, z, height, key) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.07, .085, height, 10), material(key));
    m.position.set(x, y + height / 2, z); group.add(m);
    box(.19, .065, .19, x, y + .025, z, 'stone');
    box(.2, .06, .2, x, y + height - .02, z, 'green');
  };
  function roof(width, depth, y, height) {
    const ridge = width * .29, lines = [];
    function surface(side, u, t) {
      const rise = y + height * (1 - t) ** 1.75 + .1 * t ** 4 + .12 * Math.abs(u) ** 4 * t ** 4;
      if (side < 2) return new THREE.Vector3(THREE.MathUtils.lerp(u * ridge, u * width / 2, t), rise, (side ? -1 : 1) * depth / 2 * t);
      return new THREE.Vector3((side === 2 ? -1 : 1) * THREE.MathUtils.lerp(ridge, width / 2, t), rise, u * depth / 2 * t);
    }
    for (let side = 0; side < 4; side++) {
      const positions = [], indices = [], columns = 28, rows = 12;
      for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
        const p = surface(side, column / columns * 2 - 1, row / rows);
        positions.push(p.x, p.y, p.z);
      }
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const mat = material('roof'); mat.side = THREE.DoubleSide;
      group.add(new THREE.Mesh(geometry, mat));
      for (let column = 0; column <= columns; column++) for (let row = 0; row < rows; row++) {
        const a = surface(side, column / columns * 2 - 1, row / rows), b = surface(side, column / columns * 2 - 1, (row + 1) / rows);
        lines.push(a.x, a.y + .015, a.z, b.x, b.y + .015, b.z);
      }
      // Curved eave edges and exposed rafter ends give the roof real thickness.
      const edge = Array.from({ length: 29 }, (_, i) => surface(side, i / 14 - 1, 1));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 28, .035, 5, false), material('green')));
      for (let i = 0; i <= 24; i++) {
        const tip = surface(side, i / 12 - 1, .97);
        const rafter = box(.055, .055, .19, tip.x, tip.y - .045, tip.z, i % 3 ? 'wood' : 'red');
        if (side >= 2) rafter.rotation.y = Math.PI / 2;
      }
    }
    const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    group.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: colors.tile, transparent: true, opacity: .68 })));
    box(width * .6, .08, .12, 0, y + height + .025, 0, 'ivory');
    for (const sign of [-1, 1]) {
      box(.11, .16, .15, sign * ridge, y + height + .075, 0, 'roof');
      for (let n = 0; n < 4; n++) {
        const tip = surface(0, sign, .72 + n * .065);
        box(.055, .09 - n * .009, .07, tip.x, tip.y + .055, tip.z, 'roof');
      }
    }
    for (const [offset, key] of [[0, 'green'], [-.04, 'ivory'], [-.07, 'red']]) {
      box(width, .032, depth, 0, y + offset, 0, key);
    }
  }
  function floor(y, width, depth, open = false) {
    const h = open ? .95 : .83;
    box(width + .08, .08, depth + .08, 0, y, 0, 'green');
    for (const z of [-depth / 2, depth / 2]) for (let column = 0; column < 7; column++) {
      const x = -width / 2 + column * width / 6;
      pillar(x, y, z, h, open ? 'stone' : 'red');
      if (!open && column < 6) {
        box(width / 6 - .13, h * .58, .025, x + width / 12, y + h * .37, z, 'wood');
        for (let j = 1; j < 4; j++) box(.018, h * .58, .036, x + width / 6 * j / 4, y + h * .37, z, 'green');
        for (let j = 1; j < 5; j++) box(width / 6 - .13, .018, .036, x + width / 12, y + h * .08 + j * h * .12, z, 'green');
      }
    }
    for (const x of [-width / 2, width / 2]) {
      for (const z of [-depth / 6, depth / 6]) pillar(x, y, z, h, open ? 'stone' : 'red');
      if (!open) for (let bay = 0; bay < 3; bay++) {
        const z = -depth / 3 + bay * depth / 3;
        box(.028, h * .62, depth / 3 - .14, x, y + h * .38, z, 'wood');
        for (let j = 1; j < 5; j++) box(.045, .018, depth / 3 - .14, x, y + h * .08 + j * h * .12, z, 'green');
        for (let j = -1; j <= 1; j++) box(.045, h * .62, .018, x, y + h * .38, z + j * (depth / 3 - .14) / 4, 'green');
      }
    }
    box(width, .13, depth, 0, y + h, 0, 'green');
    for (const z of [-depth / 2 - .015, depth / 2 + .015]) {
      box(width, .04, .035, 0, y + h + .015, z, 'blue');
      box(width, .02, .04, 0, y + h + .05, z, 'ivory');
      for (let n = 0; n < 21; n++) box(.04, .065, .04, -width / 2 + n * width / 20, y + h + .01, z, n % 3 === 0 ? 'gold' : 'red');
      for (let n = 0; n < 13; n++) {
        const x = -width / 2 + n * width / 12;
        box(.16, .045, .3, x, y + h - .11, z, 'green');
        box(.24, .045, .23, x, y + h - .065, z, 'red');
        box(.3, .035, .34, x, y + h - .025, z, 'wood');
        box(.065, .035, .36, x, y + h - .025, z, 'blue');
      }
    }
    return y + h;
  }
  if (pavilion) {
    box(5.5, .22, 4.4, 0, -.32, 0, 'stone');
    box(5.36, .045, 4.26, 0, -.19, 0, 'water');
    box(4.2, .16, 2.9, 0, -.08, 0, 'stone');
    const lower = floor(0, 3.55, 2.15, true);
    box(3.85, .12, 2.5, 0, lower + .03, 0, 'red');
    floor(lower + .09, 3.55, 2.15);
    roof(4.5, 3.2, lower + .96, .68);
    box(.8, .1, 1.25, 0, -.12, 2.05, 'stone');
  } else {
    box(5, .2, 3.95, 0, -.35, 0, 'stone');
    box(4.6, .19, 3.55, 0, -.16, 0, 'stone');
    const lower = floor(0, 3.3, 2.15);
    roof(4.35, 3.18, lower + .1, .65);
    const upperY = lower + .3;
    floor(upperY, 2.7, 1.6);
    roof(3.9, 2.65, upperY + .94, .7);
    for (let step = 0; step < 5; step++) box(.7, .085, .2, 0, -.36 + step * .065, 2.24 - step * .17, 'stone');
    for (const z of [-1.64, 1.64]) for (let n = 0; n < 15; n++) {
      const x = -2.08 + n * .3;
      if (z > 0 && Math.abs(x) < .45) continue;
      box(.055, .2, .055, x, .025, z, 'ivory');
      box(.09, .05, .09, x, .15, z, 'ivory');
    }
    box(4.3, .05, .08, 0, .14, -1.64, 'ivory');
    for (const x of [-1.3, 1.3]) box(1.7, .05, .08, x, .14, 1.64, 'ivory');
    for (const x of [-2.08, 2.08]) {
      box(.08, .05, 3.28, x, .14, 0, 'ivory');
      for (let n = 1; n < 11; n++) {
        const z = -1.64 + n * .3;
        box(.055, .2, .055, x, .025, z, 'ivory');
        box(.09, .05, .09, x, .15, z, 'ivory');
      }
    }
    // Fine joints on the stylised stone platform, without image textures.
    for (const z of [-1.98, 1.98]) for (let n = -5; n <= 5; n++) box(.012, .18, .008, n * .43, -.35, z, 'tile');
  }
  // Batch the many painted timbers by material; the illustration has no large textures.
  group.updateMatrixWorld(true);
  const merged = new THREE.Group(), byMaterial = new Map();
  group.traverse((o) => {
    if (o.isMesh) {
      const geometry = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      geometry.applyMatrix4(o.matrixWorld);
      geometry.deleteAttribute('uv');
      if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
      byMaterial.get(o.material).push(geometry);
    } else if (o.isLineSegments) merged.add(o.clone());
  });
  for (const [mat, geometries] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    merged.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
  group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return merged;
}

export function mountPalaceStory(host, controls) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { host.dataset.unavailable = 'true'; return () => {}; }
  host.append(renderer.domElement);
  host.dataset.ready = 'true';
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 100);
  const palace = makePalace(), pavilion = makePalace(true);
  const palaceMaterials = new Set(), pavilionMaterials = new Set();
  palace.traverse((o) => { if (o.material) palaceMaterials.add(o.material); });
  pavilion.traverse((o) => { if (o.material) pavilionMaterials.add(o.material); });
  const originalOpacity = new Map([...palaceMaterials, ...pavilionMaterials].map((mat) => [mat, mat.opacity]));
  scene.add(palace, pavilion, new THREE.HemisphereLight(0xffffff, 0x83908b, 1.7));
  const light = new THREE.DirectionalLight(0xffffff, 2.8); light.position.set(-3, 7, 5); scene.add(light);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 20 });
  light.shadow.normalBias = .035;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x46534d, opacity: .16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.46; ground.receiveShadow = true; scene.add(ground);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0xffffff, 0);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, stopped = false, paused = !motionEnabled(), explicitPlayback = false, visible = true, elapsed = 0, last = 0, phase = -1;
  const canMove = () => motionEnabled() || explicitPlayback;
  const captions = ['이 건물은 어떤 곳일까요?', '작은 문양에는 어떤 뜻이 담겼을까요?', '눈앞의 궁궐, 조금 더 가까이'];
  const paint = () => {
    const nextPhase = Math.min(2, Math.floor(elapsed / 6500));
    if (nextPhase !== phase) {
      phase = nextPhase; controls.caption.textContent = captions[phase];
      if (canMove()) controls.caption.animate([{ opacity: .2, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350 });
      controls.dots.forEach((dot, i) => dot.classList.toggle('current', i === phase));
    }
    const p = (elapsed % 6500) / 6500;
    const blend = phase === 2 && canMove() && !paused ? Math.min(1, (elapsed - 13000) / 650) : phase === 2 ? 1 : 0;
    palace.visible = blend < 1; pavilion.visible = blend > 0;
    palaceMaterials.forEach((mat) => { mat.opacity = originalOpacity.get(mat) * (1 - blend); mat.depthWrite = blend < .25; });
    pavilionMaterials.forEach((mat) => { mat.opacity = originalOpacity.get(mat) * blend; mat.depthWrite = blend > .75; });
    if (phase === 2) { palace.scale.setScalar(1.04 - blend * .08); palace.position.y = -.2 - blend * .12; }
    const building = phase < 2 ? palace : pavilion;
    // A shallow three-quarter view keeps the facade central, including when motion is off.
    const reveal = THREE.MathUtils.smoothstep(p, .3, 1);
    building.rotation.y = phase === 0 ? -.18 - reveal * .1 : phase === 1 ? -.28 - p * .08 : -.18 - p * .1;
    const scale = phase === 1 ? 1.1 + Math.sin(p * Math.PI) * .08 : 1;
    building.scale.setScalar(scale);
    building.position.y = phase === 1 ? -.2 : 0;
    ground.position.y = phase === 2 ? -.46 : -.46 * scale + building.position.y;
    // Avoid opaque silhouette shadows while the two transparent models overlap.
    light.castShadow = blend === 0 || blend === 1;
    ground.visible = light.castShadow;
    camera.position.set(0, 3.2, 12); camera.lookAt(0, .8, 0);
    renderer.render(scene, camera);
  };
  const updateButton = () => {
    controls.pause.setAttribute('aria-label', paused ? '이야기 재생' : '이야기 멈추기');
    controls.pause.textContent = paused ? '▷' : 'Ⅱ';
    controls.pause.setAttribute('aria-pressed', String(paused));
  };
  const frame = (now) => {
    if (stopped || paused || !visible || document.hidden || !canMove()) { raf = 0; return; }
    elapsed += last ? Math.min(40, now - last) : 0; last = now;
    if (elapsed >= 19500) { elapsed = 19499; paused = true; updateButton(); }
    paint();
    raf = paused ? 0 : requestAnimationFrame(frame);
  };
  const resume = () => { last = 0; if (!raf && !stopped && !paused && visible && !document.hidden && canMove()) raf = requestAnimationFrame(frame); };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    const aspect = width / height, half = 3.5;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix(); paint();
  };
  const toggle = () => { paused = !paused; explicitPlayback = !paused; if (!paused && elapsed >= 19499) elapsed = 0; updateButton(); resume(); };
  const next = () => { elapsed = ((phase + 1) % 3) * 6500 + 750; paint(); };
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else resume(); };
  const motionChange = () => { explicitPlayback = false; paused = !motionEnabled(); cancelAnimationFrame(raf); raf = 0; updateButton(); paint(); resume(); };
  controls.pause.addEventListener('click', toggle); controls.next.addEventListener('click', next);
  document.addEventListener('visibilitychange', visibility); reduce.addEventListener('change', motionChange);
  document.addEventListener('prototype-motion-change', motionChange);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) { cancelAnimationFrame(raf); raf = 0; } else resume(); });
  intersection.observe(host);
  updateButton(); resize(); resume();
  return () => {
    stopped = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); intersection.disconnect();
    controls.pause.removeEventListener('click', toggle); controls.next.removeEventListener('click', next);
    document.removeEventListener('visibilitychange', visibility); reduce.removeEventListener('change', motionChange);
    document.removeEventListener('prototype-motion-change', motionChange);
    const geometries = new Set(), mats = new Set();
    scene.traverse((o) => { if (o.geometry) geometries.add(o.geometry); if (o.material) mats.add(o.material); });
    geometries.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); light.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };
}
