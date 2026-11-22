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

function scatter(lib, name, spots, y, yaw, tint, scale = 1) {
  const src = lib[name];
  if (!src || !spots.length) return null;
  const mat = src.mat.clone();
  if (tint) mat.color = src.mat.color.clone().multiply(new THREE.Color(tint));
  const mesh = new THREE.InstancedMesh(src.geo, mat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw || 0, 0);
    dummy.scale.setScalar(scale);
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
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  if (moss) {
    sky.addColorStop(0, '#163832');
    sky.addColorStop(0.62, '#2c504c');
    sky.addColorStop(0.84, '#4e6e66');
    sky.addColorStop(1, '#7f9a86');
  } else {
    sky.addColorStop(0, '#070b22');
    sky.addColorStop(0.42, '#141c48');
    sky.addColorStop(0.7, '#2a2458');
    sky.addColorStop(0.86, '#c46a32');
    sky.addColorStop(1, '#f0a050');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  if (!moss) {
    g.fillStyle = '#fff8ee';
    for (let i = 0; i < 180; i++) {
      const x = (i * 73) % 1024;
      const y = (i * 41) % 320;
      g.fillRect(x, y, i % 11 === 0 ? 2 : 1, 1);
    }
    g.fillStyle = 'rgba(240, 196, 170, 0.18)';
    g.beginPath(); g.ellipse(180, 400, 90, 12, 0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(520, 420, 120, 14, -0.05, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(820, 390, 70, 10, 0.15, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = 'rgba(210, 228, 220, 0.22)';
    g.beginPath(); g.ellipse(240, 400, 150, 16, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(680, 430, 170, 18, 0, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(90, 28, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.frustumCulled = false;
  return dome;
}

export function createCityBlock(seed = 1, low = false) {
  const moss = seed % 2 === 0;
  const root = new THREE.Group();
  root.name = moss ? 'city-ruin' : 'city-canal';
  const tint = moss ? '#b7c9a4' : '#ffffff';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 16, 24, 48), waterMaterial(moss ? '#3d6a58' : '#3aa0b0', moss ? '#1c3330' : '#0e3c4a'));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-4.6, 0.08, 0);
  const flies = moss ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 4, 3), new THREE.MeshBasicMaterial({ color: '#e8ffb0' }), 14) : null;
  if (flies) { flies.frustumCulled = false; flies.name = 'fireflies'; }
  let glow = null;
  let glowOn = !low;
  const ready = kit().then((lib) => {
    const add = (name, spots, y, yaw, color, scale) => {
      const mesh = scatter(lib, name, spots, y, yaw, color || tint, scale || 1);
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
    add('wall-wood-block', [[1.9, -4.5], [2.15, -3.9], [1.85, -0.3], [2.1, 0.4], [1.9, 2.9], [2.15, 3.6]], 0, 0.4, null, 0.38);
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
        bulbs.push([-6.2 + u * 9.4, 2.45 - Math.sin(u * Math.PI) * 0.35, z]);
      }
    });
    const bulb = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.018, 5, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(moss ? 1.4 : 3.2, moss ? 1.6 : 1.5, moss ? 0.7 : 0.45) }),
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
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(moss ? 1.2 : 2.8, moss ? 1.5 : 1.15, moss ? 0.55 : 0.35), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const glowSpots = lamps.map(([x, z]) => [x, 1.15, z]).concat(windows);
    const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.2), glowMat, glowSpots.length);
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
    fog: moss ? ['#7f9a86', 14, 36] : ['#e09048', 16, 40],
    setGlow(on) { glowOn = !!on; if (glow) glow.visible = glowOn; },
    tick(dt) {
      water.material.uniforms.uTime.value += dt;
      if (!flies) return;
      const t = performance.now() * 0.001;
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 3.6 : -6.5;
        flyDummy.position.set(side + Math.sin(t * 0.8 + i) * 0.35, 0.25 + (i % 4) * 0.18, -5 + (i % 7) * 1.3);
        flyDummy.updateMatrix();
        flies.setMatrixAt(i, flyDummy.matrix);
      }
      flies.instanceMatrix.needsUpdate = true;
    },
  };
}
