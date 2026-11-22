// One city block from Kenney's Fantasy Town Kit (CC0). The plan is fixed.
// The seed only changes which pieces, the tint, the fog, and the fireflies.
// No trees from that kit are used.
import * as THREE from 'three';

const PIECES = [
  'wall', 'wall-window-shutters', 'wall-door', 'wall-broken',
  'wall-wood', 'wall-wood-window-shutters', 'wall-wood-door', 'wall-wood-broken',
  'roof', 'roof-gable', 'stall-red', 'stall-green', 'lantern',
  'banner-red', 'banner-green', 'road', 'planks', 'rock-small', 'rock-wide',
  'hedge', 'hedge-large', 'cart', 'pillar-wood', 'fence-broken', 'stairs-stone',
  'wall-wood-block',
];

let kitPromise = null;

function kit() {
  if (kitPromise) return kitPromise;
  kitPromise = (async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const out = {};
    await Promise.all(PIECES.map(async (name) => {
      const gltf = await loader.loadAsync(new URL(`city/kenney/${name}.glb`, document.baseURI).href);
      gltf.scene.updateMatrixWorld(true);
      let mesh = null;
      gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      const mat = mesh.material.clone();
      if (mat.map) mat.map.anisotropy = 8;
      mat.side = THREE.FrontSide;
      out[name] = { geo, mat };
    }));
    return out;
  })();
  return kitPromise;
}

function scatter(lib, name, spots, y, yaw, tint) {
  const src = lib[name];
  if (!src || !spots.length) return null;
  const mat = src.mat.clone();
  if (tint) mat.color = src.mat.color.clone().multiply(new THREE.Color(tint));
  const mesh = new THREE.InstancedMesh(src.geo, mat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw || 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function waterMaterial(color, deep) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uDeep: { value: new THREE.Color(deep) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 1.6 + uTime * 1.4) * 0.035 + sin(p.y * 2.2 + uTime * 0.9) * 0.02;
        p.z += w;
        vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uDeep;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float fres = pow(1.0 - abs(vUv.x - 0.5) * 1.2, 1.4);
        vec3 col = mix(uDeep, uColor, 0.35 + fres * 0.35 + vWave * 3.0);
        float lamps[5];
        lamps[0] = 0.12; lamps[1] = 0.31; lamps[2] = 0.5; lamps[3] = 0.69; lamps[4] = 0.86;
        for (int i = 0; i < 5; i++) {
          float d = length((vUv - vec2(0.78, lamps[i])) * vec2(2.2, 8.0));
          float tw = 0.65 + 0.35 * sin(uTime * 2.4 + lamps[i] * 12.0);
          col += vec3(1.0, 0.62, 0.28) * exp(-d * 10.0) * tw;
        }
        gl_FragColor = vec4(col, 0.94);
      }
    `,
  });
}

function skyDome(moss) {
  const geo = new THREE.SphereGeometry(48, 24, 16);
  const top = new THREE.Color(moss ? '#16302e' : '#140c2c');
  const mid = new THREE.Color(moss ? '#3d5c56' : '#5a3068');
  const horizon = new THREE.Color(moss ? '#7f9a86' : '#e09048');
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 48 * 0.5 + 0.5, 0, 1);
    const k = t > 0.45 ? mid.clone().lerp(top, (t - 0.45) / 0.55) : horizon.clone().lerp(mid, t / 0.45);
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  dome.frustumCulled = false;
  const group = new THREE.Group();
  group.add(dome);
  if (!moss) {
    const stars = new THREE.BufferGeometry();
    const pts = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const y = 8 + (i % 9) * 3.2;
      const r = 18 + (i % 5) * 4;
      pts[i * 3] = Math.cos(a) * r;
      pts[i * 3 + 1] = y;
      pts[i * 3 + 2] = Math.sin(a) * r;
    }
    stars.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    group.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#fff4d4', size: 0.045, sizeAttenuation: true })));
  }
  const cloud = new THREE.MeshBasicMaterial({ color: moss ? '#c5d6cc' : '#e7c2b0', transparent: true, opacity: moss ? 0.22 : 0.16, depthWrite: false, side: THREE.DoubleSide });
  [[-8, 14, -6, 9, 2.2], [6, 16, 4, 8, 1.8], [-2, 18, -12, 7, 1.6]].forEach(([x, y, z, w, h]) => {
    const puff = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloud);
    puff.position.set(x, y, z);
    puff.rotation.x = -Math.PI / 2;
    group.add(puff);
  });
  return group;
}

export function createCityBlock(seed = 1, low = false) {
  const moss = seed % 2 === 0;
  const root = new THREE.Group();
  root.name = moss ? 'city-ruin' : 'city-canal';
  const tint = moss ? '#b7c9a4' : '#ffffff';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 16, 24, 48), waterMaterial(moss ? '#3d6a58' : '#3aa0b0', moss ? '#1c3330' : '#0e3c4a'));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-4.6, 0.08, 0);
  const flies = moss ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshBasicMaterial({ color: '#d8f0a0' }), 16) : null;
  if (flies) { flies.frustumCulled = false; flies.name = 'fireflies'; }
  let glow = null;
  let glowOn = !low;
  const ready = kit().then((lib) => {
    const add = (name, spots, y, yaw, color) => {
      const mesh = scatter(lib, name, spots, y, yaw, color || tint);
      if (mesh) root.add(mesh);
    };
    const road = [];
    for (let x = -2; x <= 3; x++) for (let z = -8; z <= 7; z++) road.push([x, z]);
    add('road', road, 0, 0, moss ? '#4a5640' : '#8a5a38');
    const quay = [];
    for (let z = -8; z <= 7; z++) quay.push([-3, z]);
    add('planks', quay, 0.02, Math.PI / 2);
    const span = [];
    for (let x = -6; x <= -2; x++) span.push([x, 0]);
    add('planks', span, 0.2, 0);
    add('pillar-wood', [[-6, 0], [-3.2, 0]], 0, 0);
    const right = [-7, -4, -1, 2, 5];
    const left = [-6, -3, 0, 3, 6];
    const stories = [3, 2, 3, 2, 3];
    const winName = moss ? 'wall-wood-broken' : 'wall-window-shutters';
    const doorName = moss ? 'wall-wood-door' : 'wall-door';
    const stone = moss ? 'wall-broken' : 'wall';
    const wood = moss ? 'wall-wood-broken' : 'wall-wood';
    const windows = [];
    const bank = (xs, zs, yaw, side) => {
      zs.forEach((z, i) => {
        const floors = stories[i];
        for (let y = 0; y < floors; y++) {
          const piece = y === 0 ? (i % 2 ? doorName : wood) : (y === floors - 1 ? stone : winName);
          add(piece, [[xs, z]], y, yaw);
          add(i % 2 ? wood : winName, [[xs, z + 1]], y, yaw);
          if (piece === winName || (y > 0 && !moss)) windows.push([xs + (side < 0 ? -0.15 : 0.15), y + 0.55, z + (y === 0 ? 1 : 0.5)]);
          if (y > 0) add('hedge', [[xs + (side < 0 ? -0.35 : 0.35), z + 0.4]], y, yaw);
        }
        add(i % 2 ? 'roof-gable' : 'roof', [[xs, z]], floors, yaw);
        add('roof', [[xs, z + 1]], floors, yaw);
        add(moss ? 'banner-green' : 'banner-red', [[xs + (side < 0 ? -0.2 : 0.2), z]], 1.3, yaw);
        if (moss) add('hedge-large', [[xs + side * 0.4, z]], 0, yaw);
      });
    };
    bank(4.4, right, Math.PI, 1);
    bank(-7.4, left, 0, -1);
    add(moss ? 'stall-green' : 'stall-red', [[0.4, -4.2], [0.4, -0.6], [0.4, 3.2]], 0, Math.PI / 2);
    add('cart', [[1.5, -2.2], [1.7, 2.4]], 0, 0.5);
    const crates = [[0.9, -3.4], [1.2, -3.1], [0.8, 0.4], [1.1, 2.6], [1.3, 2.9], [-2.2, -2], [-2.4, 1.5]];
    add('wall-wood-block', crates, 0, 0.3);
    const lamps = [];
    for (let z = -7; z <= 6; z += 2.4) lamps.push([-2.35, z]);
    add('lantern', lamps, 0, 0);
    add('lantern', [[3.6, -5], [3.6, 1], [-6.6, -2], [-6.6, 4]], 0, 0);
    if (moss) {
      add('fence-broken', [[3.1, -3], [3.1, 2.2], [-6.2, -4]], 0, Math.PI / 2);
      add('rock-wide', [[4.8, -6], [-6.8, 5]], 0, 0);
      [[0.2, -2.2], [1.4, 1.6], [-1.2, -5.5], [2.2, 4.4]].forEach(([x, z]) => {
        const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10), waterMaterial('#2a403c', '#142420'));
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.set(x, 0.04, z);
        root.add(puddle);
      });
    }
    const dock = [[0.2, -7.4], [1.4, -7.4], [0.2, -6.4], [1.4, -6.4]];
    add('pillar-wood', dock, 0, 0);
    add('planks', dock, 1.0, 0);
    add('stairs-stone', [[0.8, -5.6]], 0, 0);
    root.add(water);
    if (flies) root.add(flies);
    lamps.forEach(([x, z], i) => {
      if (i % 2) return;
      const light = new THREE.PointLight(moss ? '#d7e7a4' : '#ffb060', moss ? 1.6 : 3.2, 8, 2);
      light.position.set(x, 1.4, z);
      root.add(light);
    });
    const bulbs = [];
    [-4.5, -1, 2.5].forEach((z) => {
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        bulbs.push([-6.6 + u * 10.2, 3.15 - Math.sin(u * Math.PI) * 0.55, z]);
      }
    });
    const bulb = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.045, 5, 4),
      new THREE.MeshBasicMaterial({ color: moss ? '#d5e8a8' : '#ffd09a' }),
      bulbs.length,
    );
    const dummy = new THREE.Object3D();
    bulbs.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      bulb.setMatrixAt(i, dummy.matrix);
    });
    bulb.instanceMatrix.needsUpdate = true;
    bulb.frustumCulled = false;
    root.add(bulb);
    const glowMat = new THREE.MeshBasicMaterial({ color: moss ? '#e4f6b4' : '#ffc078', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const glowSpots = lamps.map(([x, z]) => [x, 1.15, z]).concat(windows);
    const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.42), glowMat, glowSpots.length);
    glowSpots.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.abs(x) > 5 ? 0 : Math.PI / 2;
      dummy.updateMatrix();
      glows.setMatrixAt(i, dummy.matrix);
    });
    glows.instanceMatrix.needsUpdate = true;
    glows.frustumCulled = false;
    glows.name = 'city-glow';
    glows.visible = glowOn;
    root.add(glows);
    glow = glows;
    root.add(skyDome(moss));
    const fill = new THREE.HemisphereLight(moss ? '#8eaea4' : '#6a4e78', moss ? '#2a3028' : '#3a2418', moss ? 0.55 : 0.42);
    root.add(fill);
  });
  const flyDummy = new THREE.Object3D();
  return {
    root,
    moss,
    ready,
    fog: moss ? ['#4e6a64', 7, 22] : ['#6a4030', 12, 30],
    setGlow(on) { glowOn = !!on; if (glow) glow.visible = glowOn; },
    tick(dt) {
      water.material.uniforms.uTime.value += dt;
      if (!flies) return;
      const t = performance.now() * 0.001;
      for (let i = 0; i < 16; i++) {
        flyDummy.position.set(3.2 + Math.sin(t * 0.7 + i) * 1.4, 0.6 + (i % 5) * 0.35 + Math.sin(t * 1.6 + i) * 0.15, -2 + (i - 8) * 0.7);
        flyDummy.updateMatrix();
        flies.setMatrixAt(i, flyDummy.matrix);
      }
      flies.instanceMatrix.needsUpdate = true;
    },
  };
}
