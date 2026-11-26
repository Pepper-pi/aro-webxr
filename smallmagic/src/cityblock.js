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
        uLamp: { value: new THREE.Color('#ffb45a') },
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
      uniform vec3 uLamp;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float fres = pow(1.0 - abs(vUv.x - 0.5) * 1.2, 1.4);
        vec3 col = mix(uDeep, uColor, 0.35 + fres * 0.35 + vWave * 3.0);
        float lamps[5];
        lamps[0] = 0.12; lamps[1] = 0.31; lamps[2] = 0.5; lamps[3] = 0.69; lamps[4] = 0.86;
        for (int i = 0; i < 5; i++) {
          float d = length((vUv - vec2(0.7, lamps[i])) * vec2(0.85, 16.0));
          float tw = 0.7 + 0.3 * sin(uTime * 1.6 + lamps[i] * 9.0);
          col += uLamp * exp(-d * 5.5) * tw * 0.55;
        }
        float streak = sin(vUv.y * 10.0 - uTime * 1.3 + vUv.x * 4.0);
        col += vec3(0.8, 0.92, 1.0) * smoothstep(0.45, 0.95, streak) * uShine * 0.16;
        float gleam = sin(vUv.x * 28.0 + uTime * 2.0) * sin(vUv.y * 3.0 - uTime * 0.6);
        col += vec3(1.0, 0.9, 0.7) * smoothstep(0.72, 1.0, gleam) * uShine * 0.2;
        gl_FragColor = vec4(col, 0.92);
      }
    `,
  });
}

function paintCanalSky(g, seed) {
  g.clearRect(0, 0, 1024, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  if (seed === 2) {
    sky.addColorStop(0, '#12382e');
    sky.addColorStop(0.4, '#2a6a48');
    sky.addColorStop(0.62, '#c6a24a');
    sky.addColorStop(0.78, '#7dba8a');
    sky.addColorStop(1, '#1c3428');
  } else if (seed === 3) {
    sky.addColorStop(0, '#2a140c');
    sky.addColorStop(0.28, '#6a3418');
    sky.addColorStop(0.5, '#e09848');
    sky.addColorStop(0.7, '#a86830');
    sky.addColorStop(1, '#3a2414');
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
  g.fillStyle = seed === 2 ? 'rgba(230, 220, 160, 0.85)' : 'rgba(255, 244, 220, 0.9)';
  const stars = seed === 2 ? 40 : 160;
  for (let i = 0; i < stars; i++) {
    const x = (i * 97) % 1024;
    const y = (i * 53) % (seed === 3 ? 180 : 210);
    g.globalAlpha = 0.35 + (i % 5) * 0.1;
    g.beginPath();
    g.arc(x, y, i % 9 === 0 ? 1.4 : 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  if (seed !== 3) {
    g.fillStyle = seed === 2 ? '#f3e2a4' : '#fff6d4';
    g.beginPath();
    g.arc(180, 78, 26, 0, Math.PI * 2);
    g.arc(196, 72, 22, 0, Math.PI * 2);
    g.fill('evenodd');
  }
}
function skyDome(moss) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  if (moss) {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#163832');
    sky.addColorStop(0.62, '#2c504c');
    sky.addColorStop(0.84, '#4e6e66');
    sky.addColorStop(1, '#7f9a86');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = 'rgba(210, 228, 220, 0.22)';
    g.beginPath(); g.ellipse(240, 400, 150, 16, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(680, 430, 170, 18, 0, 0, Math.PI * 2); g.fill();
  } else paintCanalSky(g, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(90, 28, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.frustumCulled = false;
  dome.userData.skipTint = true;
  if (!moss) dome.userData.paint = (seed) => { paintCanalSky(g, seed); tex.needsUpdate = true; };
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

function cobbleTex() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5c3a28';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 16;
    for (let col = 0; col < 8; col++) {
      const n = (col * 5 + row * 3) % 28;
      g.fillStyle = `rgb(${118 + n}, ${72 + n * 0.4}, ${48 + n * 0.2})`;
      g.fillRect(col * 32 + off + 2, row * 32 + 3, 26, 24);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function zeppelin(rich) {
  const g = new THREE.Group();
  g.name = 'sky-dock';
  const cloth = new THREE.MeshBasicMaterial({ color: '#22101c' });
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4030', roughness: 0.65 });
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const along = (t - 0.46) * 8.4;
    const nose = t < 0.16 ? t / 0.16 : 1;
    const tail = t > 0.8 ? Math.max(0, (1 - t) / 0.2) : 1;
    const r = (0.22 + 0.7 * Math.sin(Math.PI * t)) * nose * tail;
    pts.push(new THREE.Vector2(Math.max(0.03, r), along));
  }
  const env = new THREE.Mesh(new THREE.LatheGeometry(pts, rich ? 16 : 8), cloth);
  env.rotation.z = -Math.PI / 2;
  g.add(env);
  const ribN = rich ? 5 : 3;
  for (let i = 0; i < ribN; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.78 - Math.abs(i - 2) * 0.08, 0.025, 6, 16), cloth);
    rib.rotation.y = Math.PI / 2;
    rib.position.x = -2.2 + i * 1.05;
    g.add(rib);
  }
  const finMat = cloth;
  for (const tilt of [0, 2.1, -2.1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06), finMat);
    fin.position.set(-3.5, 0.15, 0);
    fin.rotation.x = tilt;
    g.add(fin);
  }
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.62), wood);
  gondola.position.y = -1.25;
  g.add(gondola);
  const port = new THREE.MeshBasicMaterial({ color: '#ffd2a4' });
  for (let i = 0; i < 4; i++) {
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), port);
    hole.position.set(-0.7 + i * 0.45, -1.25, 0.32);
    g.add(hole);
  }
  for (const x of [-0.6, 0.6]) {
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), wood);
    stay.position.set(x, -0.85, 0);
    g.add(stay);
  }
  g.position.set(2.2, 6.8, -8.4);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 3.2, 6), wood);
  spire.position.set(-2.4, -6.4, 3.6);
  g.add(spire);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), port);
  beacon.position.set(-2.4, -4.7, 3.6);
  g.add(beacon);
  const nose = new THREE.Vector3(3.6, 0.1, 0);
  const tip = new THREE.Vector3(-2.4, -4.7, 3.6);
  const span = nose.distanceTo(tip);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, span, 4), new THREE.MeshBasicMaterial({ color: '#3a241c' }));
  line.position.copy(nose).add(tip).multiplyScalar(0.5);
  line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(nose).normalize());
  g.add(line);
  return g;
}

function horizonTown() {
  const g = new THREE.Group();
  g.name = 'town-horizon';
  const hill = new THREE.MeshBasicMaterial({ color: '#4a2c22' });
  [[-7.5, 2.2, 1.5], [-2.2, 3.4, 2.1], [3.6, 2.6, 1.7], [8, 2, 1.3]].forEach(([x, w, h]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), hill);
    m.scale.set(w, h, 1.1);
    m.position.set(x, -0.2, -12.2);
    g.add(m);
  });
  const stone = new THREE.MeshBasicMaterial({ color: '#3a2820' });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 6, 14, Math.PI), stone);
  arch.position.set(-3.2, 1.15, -11.4);
  g.add(arch);
  const glow = new THREE.MeshBasicMaterial({ color: '#ffcc88' });
  [[-5.5, 1.1], [-1.2, 1.6], [2.4, 1.2], [6.2, 0.9]].forEach(([x, y]) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), glow);
    lamp.position.set(x, y, -11.6);
    g.add(lamp);
  });
  return g;
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
  const cobbles = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 16),
    new THREE.MeshStandardMaterial({ map: cobbleTex(), color: '#c4a080', roughness: 0.92 }),
  );
  cobbles.rotation.x = -Math.PI / 2;
  cobbles.position.set(0.6, 0.045, -0.5);
  cobbles.name = 'cobbles';
  root.add(cobbles);
  const poolMat = new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0.28, depthWrite: false });
  for (let z = -7; z <= 6; z += rich ? 2.4 : 4.8) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-2.2, 0.05, z);
    root.add(pool);
  }
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
  [[-0.34, -0.52], [-0.34, 0.52], [0.34, -0.52], [0.34, 0.52]].forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.42, 0.06), wood);
    post.position.set(x, 1.21, z);
    stand.add(post);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 1.14), wood);
  beam.position.y = 2.4;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 1.22), new THREE.MeshLambertMaterial({ color: '#c45a4a' }));
  cloth.position.y = 2.46;
  stand.add(beam, cloth);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), wood);
  hook.position.set(0, 2.22, 0.15);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd7a4' }));
  lantern.position.set(0, 2.08, 0.15);
  stand.add(hook, lantern);
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 8), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.4 }));
    cup.position.set(0.08, 0.98, -0.32 + i * 0.28);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), new THREE.MeshStandardMaterial({ color: '#f4e4c4' }));
    straw.position.y = 0.12;
    straw.rotation.z = 0.35;
    cup.add(straw);
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
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.44), new THREE.MeshBasicMaterial({ map: cardTex }));
  card.position.set(-0.12, 1.28, 0.22);
  card.rotation.y = Math.PI / 2;
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
  mist.name = 'canal-mist';
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(-4.6, 0.28, 0);
  root.add(mist);
  root.add(zeppelin(rich));
  root.add(horizonTown());
  const sun = new THREE.DirectionalLight('#ffe0c4', 0.85);
  sun.position.set(7, 12, 5);
  root.add(sun);
  const stallLight = new THREE.PointLight('#ffd8b0', 2.6, 5.5, 2);
  stallLight.position.set(0.55, 1.55, -0.6);
  root.add(stallLight);
  const friendLight = new THREE.PointLight('#ffd0a8', 0.45, 4, 2);
  friendLight.position.set(1.5, 1.65, 2.7);
  root.add(friendLight);
  const rainN = low ? 10 : 24;
  const rain = new THREE.Group();
  rain.name = 'canal-rain';
  rain.visible = false;
  const dropMat = new THREE.MeshBasicMaterial({ color: '#d5e6f4', transparent: true, opacity: 0.35, depthWrite: false });
  const drops = [];
  for (let i = 0; i < rainN; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.42), dropMat);
    s.position.set(-3 + (i % 6) * 1.1, 1.2 + (i % 4), -6 + (i % 8) * 1.4);
    s.rotation.z = -0.35;
    s.userData.speed = 2.2 + (i % 4) * 0.35;
    rain.add(s);
    drops.push(s);
  }
  root.add(rain);
  const puddleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float wave = sin(r * 26.0 - uTime * 3.4);
        float ring = smoothstep(0.18, 0.0, abs(wave) * 0.12);
        vec3 wet = vec3(0.22, 0.16, 0.12);
        vec3 lamp = vec3(1.0, 0.64, 0.3) * (0.28 + ring * 0.7);
        float a = smoothstep(1.05, 0.15, r) * 0.62;
        gl_FragColor = vec4(wet + lamp, a);
      }`,
  });
  const puddles = new THREE.Group();
  puddles.name = 'canal-puddles';
  puddles.visible = false;
  [[-1.2, -2.2], [0.8, 1.4], [1.6, -3.4], [-0.4, 3.6]].forEach(([x, z], i) => {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.42 + (i % 2) * 0.12, 18), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, 0.06, z);
    puddles.add(puddle);
  });
  root.add(puddles);
  const brollyMat = new THREE.MeshLambertMaterial({ color: '#c45a4a', side: THREE.DoubleSide });
  const brollies = [];
  [[1.9, -1.15], [2.15, 2.45]].forEach(([x, z]) => {
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.26, low ? 8 : 12, 1, true), brollyMat);
    cloth.position.y = 1.62;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), new THREE.MeshStandardMaterial({ color: '#5a3828' }));
    pole.position.y = 0.9;
    g.add(cloth, pole);
    g.position.set(x, 0, z);
    g.visible = false;
    g.name = 'canal-umbrella';
    root.add(g);
    brollies.push(g);
  });
  let raining = false;
  const setRain = (on) => {
    raining = !!on;
    rain.visible = puddles.visible = raining;
    brollies.forEach((g) => { g.visible = raining; });
  };
  let nearStall = false;
  let cardT = 0;
  const onTap = (e) => {
    if (!nearStall || e.target?.closest?.('button')) return;
    stockI = (stockI + 1) % STOCK.length;
    paintCard();
  };
  addEventListener('pointerup', onTap);
  const emberDummy = new THREE.Object3D();
  return { setRain, tick(dt, walker) {
    const t = performance.now() * 0.001;
    awnings.forEach((cloth, i) => { cloth.rotation.z = Math.sin(t * 0.8 + i) * 0.03; });
    strings.forEach((line) => { line.rotation.z = Math.sin(t * 0.9 + line.userData.phase) * 0.05; });
    for (let i = 0; i < emberN; i++) {
      const u = (t * 0.15 + i / emberN) % 1;
      emberDummy.position.set(-4.6 + Math.sin(t + i) * 0.8, 0.4 + u * 2.4, -6 + (i % 9) * 1.4);
      emberDummy.scale.setScalar(0.4 + u);
      emberDummy.updateMatrix();
      embers.setMatrixAt(i, emberDummy.matrix);
    }
    embers.instanceMatrix.needsUpdate = true;
    if (raining) {
      puddleMat.uniforms.uTime.value += dt;
      drops.forEach((s) => {
        s.position.y -= s.userData.speed * dt;
        s.position.x -= 0.35 * dt;
        if (s.position.y < 0.15) { s.position.y = 3.4; s.position.x += 0.5; }
      });
    }
    cardT += dt;
    if (cardT > 5) { cardT = 0; stockI = (stockI + 1) % STOCK.length; paintCard(); }
    nearStall = !!(walker && Math.hypot(walker.feet.x - 1.15, walker.feet.z + 0.6) < 2.4);
  } };
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
  let dome = null;
  let hemiLight = null;
  let spores = null;
  let steam = null;
  let brassTrim = null;
  let seeded = false;
  let seedNow = 1;
  const lampLights = [];
  const sporeDummy = new THREE.Object3D();
  function snapshot(host) {
    host.traverse((o) => {
      if (!o.isMesh || o.userData.skipTint) return;
      for (const m of [].concat(o.material)) {
        if (m?.color && !m.userData.base) m.userData.base = m.color.clone();
      }
    });
  }
  function applySeed(n) {
    seedNow = n === 2 ? 2 : n === 3 ? 3 : 1;
    if (!seeded) return;
    const tint = seedNow === 2 ? '#6aaa84' : seedNow === 3 ? '#c08048' : '#ffffff';
    const mix = seedNow === 1 ? 0 : seedNow === 2 ? 0.46 : 0.32;
    const dye = new THREE.Color(tint);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.skipTint) return;
      for (const m of [].concat(o.material)) {
        if (!m?.userData?.base) continue;
        m.color.copy(m.userData.base);
        if (mix) m.color.lerp(dye, mix);
      }
    });
    dome?.userData.paint?.(seedNow);
    const look = seedNow === 2
      ? { water: '#3dba8a', deep: '#0e3a32', lamp: '#d7e7a4', sky: '#9ec8a4', ground: '#1c3424', hemi: 0.7 }
      : seedNow === 3
        ? { water: '#3a6878', deep: '#1a2830', lamp: '#ffb060', sky: '#e0a060', ground: '#3a2414', hemi: 0.72 }
        : { water: '#3aa0b0', deep: '#0e3c4a', lamp: '#ffb45a', sky: '#c4a0b0', ground: '#6a4030', hemi: 0.78 };
    water.material.uniforms.uColor.value.set(look.water);
    water.material.uniforms.uDeep.value.set(look.deep);
    water.material.uniforms.uLamp.value.set(look.lamp);
    if (hemiLight) {
      hemiLight.color.set(look.sky);
      hemiLight.groundColor.set(look.ground);
      hemiLight.intensity = look.hemi;
    }
    lampLights.forEach((light) => light.color.set(look.lamp));
    if (spores) spores.visible = seedNow === 2;
    if (steam) steam.visible = seedNow === 3;
    if (brassTrim) brassTrim.visible = seedNow === 3;
    const mist = root.getObjectByName('canal-mist');
    if (mist) {
      mist.visible = seedNow !== 3;
      mist.material.color.set(seedNow === 2 ? '#b7e0c4' : '#f0c4a4');
      mist.material.opacity = seedNow === 2 ? 0.34 : 0.22;
    }
  }
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
      lampLights.push(light);
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
    dome = skyDome(moss);
    root.add(dome);
    hemiLight = new THREE.HemisphereLight(moss ? '#8eaea4' : '#c4a0b0', moss ? '#2a3028' : '#6a4030', moss ? 0.55 : 0.78);
    root.add(hemiLight);
    if (!moss) {
      const dressed = dressCanal(root, lib, low, add);
      dressTick = dressed.tick;
      setCityRain = dressed.setRain;
      const sporeN = low ? 8 : 18;
      spores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 5, 4), new THREE.MeshBasicMaterial({ color: '#f0d080' }), sporeN);
      spores.name = 'glade-spores';
      spores.frustumCulled = false;
      spores.visible = false;
      spores.userData.skipTint = true;
      root.add(spores);
      steam = new THREE.Group();
      steam.name = 'port-steam';
      const puffCanvas = document.createElement('canvas');
      puffCanvas.width = 64;
      puffCanvas.height = 64;
      {
        const g = puffCanvas.getContext('2d');
        const wash = g.createRadialGradient(32, 32, 2, 32, 32, 30);
        wash.addColorStop(0, 'rgba(255,236,220,0.7)');
        wash.addColorStop(1, 'rgba(255,236,220,0)');
        g.fillStyle = wash;
        g.fillRect(0, 0, 64, 64);
      }
      const puffTex = new THREE.CanvasTexture(puffCanvas);
      puffTex.colorSpace = THREE.SRGBColorSpace;
      const puffMat = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
      for (let i = 0; i < (low ? 3 : 7); i++) {
        const puff = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.5), puffMat.clone());
        puff.position.set(-3.1, 0.7, -6 + i * (low ? 4 : 1.8));
        puff.userData.z = puff.position.z;
        steam.add(puff);
      }
      steam.visible = false;
      root.add(steam);
      brassTrim = new THREE.Group();
      brassTrim.name = 'brass-trim';
      const copper = new THREE.MeshStandardMaterial({ color: '#d4843a', metalness: 0.62, roughness: 0.32 });
      copper.userData.base = copper.color.clone();
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.045, 6, low ? 12 : 18, Math.PI), copper);
      band.position.set(-4.6, 0.32, 0);
      brassTrim.add(band);
      for (let z = -6; z <= 6; z += low ? 6 : 3) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 6), copper);
        cap.position.set(-2.15, 1.7, z);
        brassTrim.add(cap);
      }
      brassTrim.visible = false;
      brassTrim.traverse((o) => { o.userData.skipTint = true; });
      steam.traverse((o) => { o.userData.skipTint = true; });
      root.add(brassTrim);
      snapshot(root);
      seeded = true;
      applySeed(seedNow);
    }
  });
  const flyDummy = new THREE.Object3D();
  let dressTick = () => {};
  let setCityRain = () => {};
  return {
    root,
    moss,
    ready,
    fog: moss ? ['#7f9a86', 14, 36] : ['#d08868', 26, 64],
    fogFor(n) {
      if (moss) return ['#7f9a86', 14, 36];
      if (n === 2) return ['#7fba8a', 16, 42];
      if (n === 3) return ['#c47840', 20, 52];
      return ['#d08868', 26, 64];
    },
    setSeed(n) { applySeed(n); },
    setGlow(on) { glowOn = !!on; if (glow) glow.visible = glowOn; },
    setRain(on) { setCityRain(on); },
    tick(dt, walker) {
      water.material.uniforms.uTime.value += dt;
      dressTick(dt, walker);
      const t = performance.now() * 0.001;
      if (spores?.visible) {
        const n = spores.count;
        for (let i = 0; i < n; i++) {
          const u = (t * 0.08 + i / n) % 1;
          sporeDummy.position.set(-5 + (i % 6) * 1.5, 0.4 + u * 2.2, -6 + (i % 8) * 1.5);
          sporeDummy.scale.setScalar(0.6 + (i % 3) * 0.2);
          sporeDummy.updateMatrix();
          spores.setMatrixAt(i, sporeDummy.matrix);
        }
        spores.instanceMatrix.needsUpdate = true;
      }
      if (steam?.visible) {
        steam.children.forEach((puff, i) => {
          puff.position.y = 0.55 + ((t * 0.25 + i * 0.17) % 1) * 1.4;
          puff.position.x = -3.1 + Math.sin(t + i) * 0.2;
          puff.lookAt(0, puff.position.y, 8);
          puff.material.opacity = 0.18 + (1 - ((t * 0.25 + i * 0.17) % 1)) * 0.22;
        });
      }
      if (!flies) return;
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
