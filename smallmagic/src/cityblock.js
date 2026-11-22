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
      uniform vec3 uColor;
      uniform vec3 uDeep;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float fres = pow(1.0 - abs(vUv.y - 0.5) * 1.4, 1.6);
        vec3 col = mix(uDeep, uColor, 0.45 + fres * 0.4 + vWave * 4.0);
        col += vec3(0.65, 0.8, 0.75) * pow(fres, 3.0) * 0.35;
        gl_FragColor = vec4(col, 0.92);
      }
    `,
  });
}

function skyDome(top, horizon) {
  const geo = new THREE.SphereGeometry(48, 20, 12);
  const c = new THREE.Color(top);
  const h = new THREE.Color(horizon);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 48 * 0.5 + 0.5, 0, 1);
    const k = c.clone().lerp(h, 1 - t);
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  mesh.frustumCulled = false;
  return mesh;
}

export function createCityBlock(seed = 1) {
  const moss = seed % 2 === 0;
  const root = new THREE.Group();
  root.name = moss ? 'city-ruin' : 'city-canal';
  const tint = moss ? '#b7c9a4' : '#ffffff';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 16, 24, 48), waterMaterial(moss ? '#3d6a58' : '#3aa0b0', moss ? '#1c3330' : '#0e3c4a'));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-4.6, 0.08, 0);
  const flies = moss ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshBasicMaterial({ color: '#d8f0a0' }), 16) : null;
  if (flies) { flies.frustumCulled = false; flies.name = 'fireflies'; }
  const ready = kit().then((lib) => {
    const add = (name, spots, y, yaw) => {
      const mesh = scatter(lib, name, spots, y, yaw, tint);
      if (mesh) root.add(mesh);
    };
    const road = [];
    for (let x = -2; x <= 2; x++) for (let z = -8; z <= 7; z++) road.push([x, z]);
    add('road', road, 0, 0);
    const quay = [];
    for (let z = -8; z <= 7; z++) quay.push([-3, z]);
    add('planks', quay, 0.02, Math.PI / 2);
    const span = [];
    for (let x = -5; x <= -2; x++) span.push([x, 0]);
    add('planks', span, 0.35, 0);
    add('pillar-wood', [[-5, 0], [-3.2, 0]], 0, 0);
    const wall = moss ? 'wall-broken' : 'wall';
    const wood = moss ? 'wall-wood-broken' : 'wall-wood';
    const win = moss ? 'wall-wood-broken' : 'wall-window-shutters';
    const door = moss ? 'wall-wood-door' : 'wall-door';
    const houses = [-6, -2, 2, 6];
    add(door, houses.map((z) => [4.2, z]), 0, Math.PI);
    add(win, houses.map((z) => [4.2, z + 1]), 0, Math.PI);
    add(wood, houses.map((z) => [4.2, z]), 1, Math.PI);
    add(wall, houses.map((z) => [4.2, z + 1]), 1, Math.PI);
    add('roof', houses.map((z) => [4.2, z]), 2, Math.PI);
    add('roof-gable', houses.map((z) => [4.2, z + 1]), 2, Math.PI);
    add(moss ? 'banner-green' : 'banner-red', houses.map((z) => [3.7, z + 0.2]), 1.2, Math.PI);
    add(moss ? 'stall-green' : 'stall-red', [[0.6, -4], [0.6, 1], [0.6, 5]], 0, Math.PI / 2);
    add('cart', [[1.6, -1.5]], 0, 0.4);
    const lamps = [];
    for (let z = -7; z <= 6; z += 3) lamps.push([-2.4, z]);
    add('lantern', lamps, 0, 0);
    add('hedge', [[3.3, -7.2], [3.3, 7.2], [-1.2, 6.5]], 0, 0);
    add('hedge-large', moss ? [[4.6, -4], [4.6, 3], [2.2, -6]] : [[-1.4, -6.5]], 0, 0);
    add('rock-small', moss ? [[3.4, -5], [3.6, -1.2], [4.8, -4]] : [[-2.6, -5], [2.8, -6]], 0, 0);
    add('rock-wide', moss ? [[5.2, -1], [4.4, -6.4]] : [[5.4, -7]], 0, 0);
    if (moss) add('fence-broken', [[3.2, -3.2], [3.2, 3.4]], 0, Math.PI / 2);
    const dock = [[0.2, -7.4], [1.4, -7.4], [0.2, -6.4], [1.4, -6.4]];
    add('pillar-wood', dock, 0, 0);
    add('planks', dock, 1.0, 0);
    add('planks', [[0.8, -7.4], [0.8, -6.4]], 1.0, Math.PI / 2);
    add('stairs-stone', [[0.8, -5.6]], 0, 0);
    root.add(water);
    if (flies) root.add(flies);
    lamps.forEach(([x, z], i) => {
      if (i % 2) return;
      const light = new THREE.PointLight(moss ? '#d7e7a4' : '#ffc48a', moss ? 1.4 : 2.2, 7, 2);
      light.position.set(x, 1.35, z);
      root.add(light);
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: moss ? '#e7f3b0' : '#ffd7a0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.28), glowMat, lamps.length);
    const dummy = new THREE.Object3D();
    lamps.forEach(([x, z], i) => {
      dummy.position.set(x, 1.15, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      glows.setMatrixAt(i, dummy.matrix);
    });
    glows.instanceMatrix.needsUpdate = true;
    glows.frustumCulled = false;
    root.add(glows);
    root.add(skyDome(moss ? '#1d3328' : '#8eb4d4', moss ? '#6d8a62' : '#f0d7b4'));
    const fill = new THREE.HemisphereLight(moss ? '#c5d8be' : '#f7f4ee', moss ? '#3a4034' : '#8a7560', moss ? 0.7 : 0.85);
    root.add(fill);
  });
  const flyDummy = new THREE.Object3D();
  return {
    root,
    moss,
    ready,
    fog: moss ? ['#6d8a72', 5, 20] : ['#d2c2a4', 8, 34],
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
