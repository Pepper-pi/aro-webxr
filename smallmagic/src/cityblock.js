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

function waterMaterial(color, deep, shine = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
        uTime: { value: 0 },
        uShine: { value: shine },
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
      uniform float uShine;
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
          col += vec3(1.0, 0.72, 0.42) * exp(-d * 10.0) * tw;
        }
        float ripple = sin(vUv.y * 46.0 + uTime * 2.2) * sin(vUv.x * 22.0 - uTime * 1.3);
        col += vec3(0.75, 0.9, 1.0) * pow(max(ripple, 0.0), 10.0) * uShine * 0.45;
        gl_FragColor = vec4(col, 0.92);
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
    sky.addColorStop(0, '#07091e');
    sky.addColorStop(0.22, '#16143c');
    sky.addColorStop(0.38, '#5a3058');
    sky.addColorStop(0.48, '#e08a58');
    sky.addColorStop(0.58, '#c46248');
    sky.addColorStop(1, '#3a2418');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  if (!moss) {
    g.fillStyle = 'rgba(255, 244, 220, 0.9)';
    for (let i = 0; i < 160; i++) {
      const x = (i * 97) % 1024;
      const y = (i * 53) % 210;
      const r = i % 9 === 0 ? 1.4 : 0.6;
      g.globalAlpha = 0.35 + (i % 5) * 0.1;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff6d4';
    g.beginPath();
    g.arc(180, 78, 26, 0, Math.PI * 2);
    g.arc(196, 72, 22, 0, Math.PI * 2);
    g.fill('evenodd');
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

const STOCK = [
  { name: 'Honey pearl', note: 'warm and slow', color: '#e7c56a' },
  { name: 'Night plum', note: 'dusk in a cup', color: '#7a4a78' },
  { name: 'Lantern milk', note: 'a little light', color: '#f3e2c4' },
  { name: 'Cinder citrus', note: 'bright peel', color: '#e07a3a' },
];

function paintStock(ctx, item) {
  ctx.clearRect(0, 0, 256, 160);
  ctx.fillStyle = '#2a160e';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#f1d9a4';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 240, 144);
  ctx.fillStyle = item.color;
  ctx.fillRect(22, 36, 28, 28);
  ctx.fillStyle = '#f6ead0';
  ctx.font = 'bold 28px Georgia';
  ctx.fillText(item.name, 60, 62);
  ctx.font = '20px Georgia';
  ctx.fillStyle = '#e7c9a2';
  ctx.fillText(item.note, 24, 112);
}

function awningMesh(color) {
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.62, 8, 1),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
  );
  const pos = cloth.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, -Math.cos((x / 1.15) * Math.PI) * 0.04);
  }
  pos.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
  cloth.rotation.x = Math.PI / 2 - 0.4;
  cloth.name = 'awning';
  return cloth;
}

function solidHouses(root, low) {
  const plaster = new THREE.MeshStandardMaterial({ color: '#cbb89a', roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8d4034', roughness: 0.72 });
  const paneMat = new THREE.MeshBasicMaterial({ color: '#ffd2a4' });
  const rows = [
    { xs: -7.4, zs: [-6, -3, 0, 3, 6], sign: -1 },
    { xs: 4.4, zs: [-7, -4, -1, 2, 5], sign: 1 },
  ];
  const stories = [3, 2, 3, 2, 3];
  rows.forEach((row) => {
    row.zs.forEach((z, i) => {
      const floors = stories[i];
      const depth = 1.4;
      const front = row.sign < 0 ? row.xs + 0.38 : row.xs - 0.38;
      const cx = front + row.sign * (depth / 2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(depth, floors, 1.9), plaster);
      body.position.set(cx, floors / 2, z + 0.5);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(depth + 0.18, 0.16, 2.08), roofMat);
      cap.position.set(cx, floors + 0.08, z + 0.5);
      root.add(body, cap);
      if (low && i % 2) return;
      for (let y = 1; y < floors; y++) {
        const back = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), paneMat);
        back.position.set(cx + row.sign * (depth / 2 + 0.02), y + 0.45, z + 0.35);
        back.rotation.y = row.sign < 0 ? -Math.PI / 2 : Math.PI / 2;
        root.add(back);
      }
    });
  });
}

function footbridge(root, rich) {
  const g = new THREE.Group();
  g.name = 'canal-arch';
  const stone = new THREE.MeshStandardMaterial({ color: '#d2c4ae', roughness: 0.82 });
  const wood = new THREE.MeshStandardMaterial({ color: '#a86a3c', roughness: 0.68 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#6a4030', roughness: 0.6 });
  const near = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 1.25), stone);
  near.position.set(-3.0, 0.85, 0);
  const far = near.clone();
  far.position.set(-6.2, 0.85, 0);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, rich ? 0.11 : 0.09, rich ? 8 : 5, rich ? 20 : 10, Math.PI), stone);
  arch.position.set(-4.6, 0.28, 0);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.05), wood);
  deck.position.set(-4.6, 1.74, 0);
  g.add(near, far, arch, deck);
  for (const side of [-0.48, 0.48]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 0.05), railMat);
    top.position.set(-4.6, 2.12, side);
    g.add(top);
    for (let i = 0; i < (rich ? 7 : 4); i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.4, 0.045), railMat);
      post.position.set(-6.15 + i * (rich ? 0.52 : 1.0), 1.92, side);
      g.add(post);
    }
  }
  root.add(g);
}

function dressCanal(root, lib, low, add) {
  const rich = !low;
  solidHouses(root, low);
  footbridge(root, rich);
  const bankZ = [];
  for (let z = -7; z <= 6; z += rich ? 2.2 : 3.4) bankZ.push([-6.55, z], [-2.55, z]);
  add('rock-wide', bankZ, 0, 0, '#d5c6b0', 0.42);
  const awnings = [];
  const colors = ['#c45a4a', '#e7b15a', '#7a4a62'];
  const spots = rich ? [[0.45, -4.2], [0.45, 3.2]] : [[0.45, 3.2]];
  spots.forEach(([x, z], i) => {
    const cloth = awningMesh(colors[i % colors.length]);
    cloth.position.set(x, 1.95, z);
    root.add(cloth);
    awnings.push(cloth);
  });
  const strings = [];
  if (rich) {
    [-4.2, -0.6, 3.2].forEach((z, s) => {
      const line = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd7a4' }));
        bulb.position.set(-0.4 + u * 2.2, 2.85 - Math.sin(u * Math.PI) * 0.22, 0);
        line.add(bulb);
      }
      line.position.set(0, 0, z);
      line.userData.phase = s;
      root.add(line);
      strings.push(line);
    });
  }
  const stand = new THREE.Group();
  stand.name = 'boba-stand';
  stand.position.set(1.15, 0, -0.6);
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4030', roughness: 0.7 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 1.2), wood);
  counter.position.y = 0.46;
  stand.add(counter);
  const canopy = awningMesh('#c45a4a');
  canopy.position.set(0, 1.95, 0);
  stand.add(canopy);
  awnings.push(canopy);
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 8), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.4 }));
    cup.position.set(-0.05, 0.98, -0.32 + i * 0.28);
    stand.add(cup);
  }
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 256;
  cardCanvas.height = 160;
  const cardCtx = cardCanvas.getContext('2d');
  const cardTex = new THREE.CanvasTexture(cardCanvas);
  cardTex.colorSpace = THREE.SRGBColorSpace;
  let stockI = 0;
  const paintCard = () => { paintStock(cardCtx, STOCK[stockI]); cardTex.needsUpdate = true; };
  paintCard();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.52), new THREE.MeshBasicMaterial({ map: cardTex, side: THREE.DoubleSide }));
  card.position.set(-0.4, 1.22, 0);
  card.rotation.y = -Math.PI / 2;
  card.name = 'boba-card';
  stand.add(card);
  root.add(stand);
  const emberN = low ? 8 : 22;
  const embers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffd2a8' }), emberN);
  embers.frustumCulled = false;
  embers.name = 'canal-embers';
  root.add(embers);
  const mistMat = new THREE.MeshBasicMaterial({ color: '#f0c4a4', transparent: true, opacity: 0.22, depthWrite: false, fog: false });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 16), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(-4.6, 0.28, 0);
  root.add(mist);
  const ship = new THREE.Group();
  ship.name = 'sky-dock';
  ship.position.set(5.5, 6.8, -14);
  const hullMat = new THREE.MeshBasicMaterial({ color: '#140818' });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(rich ? 5.2 : 4, 0.75, 1.1), hullMat);
  const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), hullMat);
  balloon.scale.set(2.2, 0.7, 1);
  balloon.position.y = 1.35;
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), hullMat);
  mast.position.set(-0.4, 0.9, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd7a4' }));
  lamp.position.set(1.2, 0.15, 0.55);
  ship.add(hull, balloon, mast, lamp);
  root.add(ship);
  const sun = new THREE.DirectionalLight('#ffe0c4', 0.85);
  sun.position.set(7, 12, 5);
  root.add(sun);
  const stallLight = new THREE.PointLight('#ffd8b0', 2.6, 5.5, 2);
  stallLight.position.set(0.55, 1.55, -0.6);
  root.add(stallLight);
  const friendLight = new THREE.PointLight('#ffd0a8', 0.45, 4, 2);
  friendLight.position.set(1.5, 1.65, 2.7);
  root.add(friendLight);
  let nearStall = false;
  let cardT = 0;
  const onTap = (e) => {
    if (!nearStall || e.target?.closest?.('button')) return;
    stockI = (stockI + 1) % STOCK.length;
    paintCard();
  };
  addEventListener('pointerup', onTap);
  const emberDummy = new THREE.Object3D();
  return (dt, walker) => {
    const t = performance.now() * 0.001;
    awnings.forEach((cloth, i) => { cloth.rotation.z = Math.sin(t * 0.8 + i) * 0.04; });
    strings.forEach((line) => { line.rotation.z = Math.sin(t * 0.9 + line.userData.phase) * 0.05; });
    for (let i = 0; i < emberN; i++) {
      const u = (t * 0.15 + i / emberN) % 1;
      emberDummy.position.set(-4.6 + Math.sin(t + i) * 0.8, 0.4 + u * 2.4, -6 + (i % 9) * 1.4);
      emberDummy.scale.setScalar(0.4 + u);
      emberDummy.updateMatrix();
      embers.setMatrixAt(i, emberDummy.matrix);
    }
    embers.instanceMatrix.needsUpdate = true;
    cardT += dt;
    if (cardT > 5) { cardT = 0; stockI = (stockI + 1) % STOCK.length; paintCard(); }
    nearStall = !!(walker && Math.hypot(walker.feet.x - 1.15, walker.feet.z + 0.6) < 2.4);
    card.scale.setScalar(nearStall ? 1.15 : 1);
  };
}

export function createCityBlock(seed = 1, low = false) {
  const moss = seed % 2 === 0;
  const root = new THREE.Group();
  root.name = moss ? 'city-ruin' : 'city-canal';
  const tint = moss ? '#b7c9a4' : '#ffffff';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 16, low ? 8 : 24, low ? 16 : 48), waterMaterial(moss ? '#3d6a58' : '#3aa0b0', moss ? '#1c3330' : '#0e3c4a', moss ? 0 : 1));
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
    if (moss) {
      const span = [];
      for (let x = -6; x <= -2; x++) span.push([x, 0]);
      add('planks', span, 0.2, 0);
      add('pillar-wood', [[-6, 0], [-3.2, 0]], 0, 0);
    }
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
    add(moss ? 'stall-green' : 'stall-red', [[0.4, -4.2], [0.4, 3.2]], 0, Math.PI / 2);
    if (moss) add('stall-green', [[0.4, -0.6]], 0, Math.PI / 2);
    add('cart', [[1.5, -2.2], [1.7, 2.4]], 0, 0.5);
    if (moss) add('wall-wood-block', [[1.9, -4.5], [2.15, -3.9], [1.85, -0.3], [2.1, 0.4], [1.9, 2.9], [2.15, 3.6]], 0, 0.4, null, 0.38);
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
    if (moss) add('stairs-stone', [[0.8, -5.6]], 0, 0);
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
    const fill = new THREE.HemisphereLight(moss ? '#8eaea4' : '#c4a0b0', moss ? '#2a3028' : '#6a4030', moss ? 0.55 : 0.78);
    root.add(fill);
    if (!moss) dressTick = dressCanal(root, lib, low, add);
  });
  const flyDummy = new THREE.Object3D();
  let dressTick = () => {};
  return {
    root,
    moss,
    ready,
    fog: moss ? ['#7f9a86', 14, 36] : ['#d08868', 26, 64],
    setGlow(on) { glowOn = !!on; if (glow) glow.visible = glowOn; },
    tick(dt, walker) {
      water.material.uniforms.uTime.value += dt;
      dressTick(dt, walker);
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
