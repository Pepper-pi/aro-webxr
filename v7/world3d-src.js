/*!
 * Overworld for ARO v7.
 * Character: AvatarSample_B by VRoid / pixiv (VRM 0.0).
 *   Commercial use and modification are allowed. Credit is not required.
 *   Not CC0. Do not sell the unmodified file.
 *   https://hub.vroid.com/en/characters/7939147878897061040/models/2292219474373673889
 * Renderer: three.js (MIT) and @pixiv/three-vrm (MIT), MToon materials from the VRM.
 * Idle and walk are original clips posed on the VRM humanoid bones (no Mixamo files).
 * Map: OpenStreetMap contributors, ODbL. Seaside, Oregon, the game's fallback place.
 *   Roads, the river, and parks are rasterized from that extract. No paid assets.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const VRM_URL = 'assets/vrm/AvatarSample_B.vrm';
const NPC_URLS = [
  { id: 'A', url: 'assets/vrm/AvatarSample_A.vrm' },
  { id: 'C', url: 'assets/vrm/AvatarSample_C.vrm' },
];
const FIELD_URL = 'data/seaside-field.json';

const keys = { f: 0, b: 0, l: 0, r: 0 };
const ptrs = new Map();
let field = null;
let grid = null;
let renderer, scene, camera, clock;
let ground, water, avatar, vrm, blob, homeRoot;
const npcs = [];
const playerPose = { amp: 0, phase: 0 };
let worldT = 0;
let destFromPick = false;
let sun, hemi, skyMat, waterMat;
let camYaw = Math.PI;
let camDist = 10.4;
let camPitch = 0.34;
let rt, composeScene, composeCam, quadMat;
let grassMesh, propSpins = [];
let px = 0, pz = 0, facing = 0;
let dest = null;
let gpsTarget = null;
let gpsRef = null;
let tapUntil = 0;
let lastAnchor = '';
let shot = '';
let active = false;
let avatarReady = false;
const look = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function tapOn() {
  try { return window.__aroTapMove ? window.__aroTapMove() !== false : true; }
  catch (e) { return true; }
}
function toonRamp() {
  const data = new Uint8Array([
    148, 148, 148, 255,
    205, 205, 205, 255,
    255, 255, 255, 255,
    255, 250, 236, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
const ramp = toonRamp();
function toonMat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp });
}

function kindAt(x, z) {
  if (!field) return null;
  const c = Math.floor((x - field.minx) / field.cell);
  const r = Math.floor((z - field.minz) / field.cell);
  if (c < 0 || r < 0 || c >= field.cols || r >= field.rows) return null;
  return grid[r * field.cols + c];
}
function groundY(x, z) {
  const k = kindAt(x, z);
  const n = Math.sin(x * 0.02) * Math.cos(z * 0.017) * 1.7 + Math.sin(x * 0.055 + z * 0.04) * 0.45;
  if (k === 3) return -0.7;
  if (k === 4 || k === 5) return n * 0.08 + 0.06;
  if (k === 1 || k === 2) return n + 0.35;
  return n * 0.75 + 0.1;
}
function blocked(x, z) {
  const k = kindAt(x, z);
  return k == null || k === 3;
}
function projectLatLon(lat, lon) {
  const x = (lon - field.origin.lon) * field.metersPerDegLon;
  const z = -(lat - field.origin.lat) * field.metersPerDegLat;
  return { x, z };
}

const COL = {
  0: [0.42, 0.78, 0.32],
  1: [0.62, 0.88, 0.34],
  2: [0.18, 0.52, 0.22],
  3: [0.05, 0.32, 0.55],
  4: [0.90, 0.78, 0.52],
  5: [0.96, 0.88, 0.66],
};
function tint(kind, x, z) {
  const base = COL[kind] || COL[0];
  const n1 = Math.sin(x * 0.11) * Math.cos(z * 0.09);
  const n2 = Math.sin(x * 0.37 + 1.7) * Math.sin(z * 0.31 + 0.4);
  const j = 0.78 + n1 * 0.14 + n2 * 0.08;
  const warm = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.04);
  return [
    base[0] * j * (0.92 + warm * 0.16),
    base[1] * j,
    base[2] * j * (1.05 - warm * 0.12),
  ];
}
function carveLake() {
  const lx = field.anchors.lake[0], lz = field.anchors.lake[1];
  const rx = 36, rz = 24;
  const cols = field.cols, rows = field.rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = field.minx + (c + 0.5) * field.cell;
    const z = field.minz + (r + 0.5) * field.cell;
    const nx = (x - lx) / rx, nz = (z - lz) / rz;
    const wob = 0.18 * Math.sin(nx * 5.2 + nz * 1.6) + 0.1 * Math.cos(nz * 6.4 + nx);
    if (nx * nx + nz * nz < 1 + wob && grid[r * cols + c] !== 4) grid[r * cols + c] = 3;
  }
  const add = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r * cols + c] !== 3) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const i = rr * cols + cc;
      const k = grid[i];
      if (k === 0 || k === 1 || k === 5) add.push(i);
    }
  }
  for (const i of add) grid[i] = 3;
}

function buildGround() {
  const { cols, rows, minx, minz, cell } = field;
  const vx = cols + 1, vz = rows + 1;
  const pos = new Float32Array(vx * vz * 3);
  const col = new Float32Array(vx * vz * 3);
  for (let r = 0; r < vz; r++) for (let c = 0; c < vx; c++) {
    const x = minx + c * cell;
    const z = minz + r * cell;
    const i = r * vx + c;
    const k = kindAt(x - cell * 0.01, z - cell * 0.01) ?? 0;
    const y = groundY(x, z);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const t = tint(k, x, z);
    col[i * 3] = t[0]; col[i * 3 + 1] = t[1]; col[i * 3 + 2] = t[2];
  }
  const idx = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * vx + c, b = a + 1, d = a + vx, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }));
  ground.frustumCulled = false;
  scene.add(ground);

  const wpos = [], wshore = [];
  const shoreOf = (c, r) => {
    let edge = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || grid[rr * cols + cc] !== 3) edge++;
    }
    return edge / 4;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r * cols + c] !== 3) continue;
    const x0 = minx + c * cell, z0 = minz + r * cell, y = -0.22;
    const s = shoreOf(c, r);
    wpos.push(
      x0, y, z0, x0 + cell, y, z0, x0, y, z0 + cell,
      x0 + cell, y, z0, x0 + cell, y, z0 + cell, x0, y, z0 + cell
    );
    wshore.push(s, s, s, s, s, s);
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wgeo.setAttribute('aShore', new THREE.Float32BufferAttribute(wshore, 1));
  wgeo.computeVertexNormals();
  waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aShore;
      varying vec3 vW;
      varying float vShore;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vShore = aShore;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec3 vW;
      varying float vShore;
      uniform float uTime;
      void main(){
        float rip = sin(vW.x * 0.55 + uTime * 1.35) * sin(vW.z * 0.48 - uTime * 0.95);
        float rip2 = sin(vW.x * 1.35 - vW.z * 1.05 + uTime * 1.8);
        vec3 deep = vec3(0.03, 0.24, 0.48);
        vec3 mid = vec3(0.12, 0.55, 0.78);
        vec3 lit = vec3(0.62, 0.92, 0.96);
        vec3 c = mix(deep, mid, smoothstep(-0.55, 0.45, rip));
        c = mix(c, lit, smoothstep(0.45, 0.95, rip2) * 0.55);
        float foam = smoothstep(0.2, 0.95, vShore);
        foam *= 0.55 + 0.45 * sin(vW.x * 1.6 + vW.z * 1.2 + uTime * 2.2);
        c = mix(c, vec3(0.93, 0.98, 1.0), clamp(foam, 0.0, 1.0));
        gl_FragColor = vec4(c, 0.92);
      }`,
  });
  water = new THREE.Mesh(wgeo, waterMat);
  water.frustumCulled = false;
  scene.add(water);
}

function solid(geo) {
  return geo.index ? geo.toNonIndexed() : geo;
}
function paintGeo(geo, hex) {
  geo = solid(geo);
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function inflate(geo, amount) {
  const g = geo.clone();
  const pos = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * amount, pos.getY(i) + nrm.getY(i) * amount, pos.getZ(i) + nrm.getZ(i) * amount);
  }
  pos.needsUpdate = true;
  return g;
}
function instanced(geo, spots, scaleOf) {
  if (!spots.length) return null;
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const ink = new THREE.InstancedMesh(inflate(geo, 0.045), new THREE.MeshBasicMaterial({ color: 0x1a140e, side: THREE.BackSide }), spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((p, i) => {
    const s = scaleOf(i, p);
    dummy.position.set(p[0], groundY(p[0], p[1]), p[1]);
    dummy.rotation.y = (i * 1.7) % (Math.PI * 2);
    dummy.scale.set(s, s * (0.85 + (i % 5) * 0.06), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    ink.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  ink.instanceMatrix.needsUpdate = true;
  scene.add(ink, mesh);
  return mesh;
}
function buildDressing() {
  const trunk = paintGeo(new THREE.CylinderGeometry(0.18, 0.32, 1.7, 6), '#6d4a32');
  trunk.translate(0, 0.85, 0);
  const puffA = paintGeo(new THREE.IcosahedronGeometry(1.15, 1), '#3c9a48');
  puffA.translate(0, 2.25, 0);
  const puffB = paintGeo(new THREE.IcosahedronGeometry(0.78, 1), '#8ed56a');
  puffB.translate(0.55, 2.7, 0.15);
  const puffC = paintGeo(new THREE.IcosahedronGeometry(0.7, 1), '#2f7340');
  puffC.translate(-0.48, 2.45, -0.2);
  const broad = mergeGeometries([trunk, puffA, puffB, puffC]);
  const pineTrunk = paintGeo(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 5), '#5c4030');
  pineTrunk.translate(0, 0.7, 0);
  const p1 = paintGeo(new THREE.ConeGeometry(1.05, 1.35, 7), '#2f8a44');
  p1.translate(0, 1.7, 0);
  const p2 = paintGeo(new THREE.ConeGeometry(0.78, 1.15, 7), '#67c45a');
  p2.translate(0, 2.45, 0);
  const p3 = paintGeo(new THREE.IcosahedronGeometry(0.36, 0), '#d7f0a4');
  p3.translate(0, 3.05, 0);
  const pine = mergeGeometries([pineTrunk, p1, p2, p3]);
  const bushA = paintGeo(new THREE.IcosahedronGeometry(0.55, 0), '#4aaa58');
  bushA.scale(1.35, 0.72, 1.15);
  bushA.translate(0, 0.38, 0);
  const bushB = paintGeo(new THREE.IcosahedronGeometry(0.36, 0), '#d5ee86');
  bushB.translate(0.32, 0.48, 0.08);
  const bush = mergeGeometries([bushA, bushB]);
  const rock = paintGeo(new THREE.DodecahedronGeometry(0.42, 0), '#c2b4a2');
  rock.scale(1.35, 0.62, 1.05);
  const home = field.anchors.home;
  const broadSpots = [], pineSpots = [], bushSpots = [], rockSpots = [], flowerSpots = [];
  for (let i = 0; i < grid.length; i += 5) {
    const k = grid[i];
    if (k === 3 || k === 4) continue;
    const c = i % field.cols, r = (i / field.cols) | 0;
    const x = field.minx + (c + 0.5) * field.cell;
    const z = field.minz + (r + 0.5) * field.cell;
    if (kindAt(x, z) === 3 || kindAt(x, z) === 4) continue;
    const dh = Math.hypot(x - home[0], z - home[1]);
    if (dh < 11) continue;
    const pick = (i * 13) % 17;
    if ((k === 1 || k === 2 || (k === 0 && dh < 180 && pick < 4)) && broadSpots.length < 42 && pick % 2 === 0) broadSpots.push([x, z]);
    else if ((k === 1 || k === 0) && pineSpots.length < 28 && pick % 3 === 1) pineSpots.push([x, z]);
    else if (bushSpots.length < 36 && pick % 4 === 2 && dh < 220) bushSpots.push([x, z]);
    else if (rockSpots.length < 22 && pick % 5 === 3 && dh < 200) rockSpots.push([x, z]);
    else if (flowerSpots.length < 48 && k !== 5 && dh > 8 && dh < 80) flowerSpots.push([x, z, (i % 3)]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = home[0] + Math.cos(a) * (18 + (i % 3) * 6);
    const z = home[1] + Math.sin(a) * (18 + (i % 3) * 6);
    if (kindAt(x, z) === 3 || kindAt(x, z) === 4) continue;
    (i % 2 ? pineSpots : broadSpots).push([x, z]);
  }
  instanced(broad, broadSpots, (i) => 1.15 + (i % 4) * 0.12);
  instanced(pine, pineSpots, (i) => 1.05 + (i % 3) * 0.1);
  instanced(bush, bushSpots, () => 1);
  instanced(rock, rockSpots, (i) => 0.7 + (i % 4) * 0.25);
  const petal = new THREE.PlaneGeometry(0.22, 0.22);
  petal.translate(0, 0.2, 0);
  const colors = [new THREE.Color('#ff8fb8'), new THREE.Color('#ffe27a'), new THREE.Color('#f4fbff')];
  if (flowerSpots.length) {
    const flowers = new THREE.InstancedMesh(petal, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false }), flowerSpots.length);
    const dummy = new THREE.Object3D();
    flowerSpots.forEach((p, i) => {
      dummy.position.set(p[0], groundY(p[0], p[1]) + 0.05, p[1]);
      dummy.rotation.y = i;
      dummy.scale.setScalar(0.8 + (i % 3) * 0.25);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, colors[p[2]]);
    });
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    scene.add(flowers);
  }
  const blade = (rot) => {
    const g = solid(new THREE.PlaneGeometry(0.36, 0.46, 1, 2));
    g.translate(0, 0.23, 0);
    g.rotateY(rot);
    return g;
  };
  const tuft = mergeGeometries([blade(0), blade(1.15), blade(2.3)]);
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying float vH;
      void main(){
        vec3 p = position;
        float h = clamp(p.y / 0.46, 0.0, 1.0);
        vec3 ip = instanceMatrix[3].xyz;
        float s = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.22);
        p.x += s * 0.16 * h;
        p.z += cos(uTime * 1.25 + ip.z * 0.4) * 0.1 * h;
        vH = h;
        vec4 world = instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      precision mediump float;
      varying float vH;
      void main(){
        vec3 root = vec3(0.16, 0.40, 0.12);
        vec3 tip = vec3(0.48, 0.74, 0.26);
        gl_FragColor = vec4(mix(root, tip, vH), 1.0);
      }`,
  });
  grassMesh = new THREE.InstancedMesh(tuft, grassMat, 240);
  grassMesh.frustumCulled = false;
  grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(grassMesh);
  scatterGrass();
}
function scatterGrass() {
  if (!grassMesh) return;
  const dummy = new THREE.Object3D();
  const home = field.anchors.home;
  const n = grassMesh.count;
  for (let i = 0; i < n; i++) {
    const ang = i * 2.399963;
    const rad = Math.sqrt((i + 0.5) / n) * (i % 5 === 0 ? 22 : 14);
    const x = px + Math.cos(ang) * rad;
    const z = pz + Math.sin(ang) * rad;
    const k = kindAt(x, z);
    const onPad = Math.hypot(x - home[0], z - home[1]) < 8;
    if (k == null || k === 3 || k === 4 || onPad) dummy.scale.set(0, 0, 0);
    else {
      const lod = rad > 12 ? 0.55 : 1;
      dummy.position.set(x, groundY(x, z), z);
      dummy.rotation.y = ang;
      dummy.scale.set(lod, 0.75 + (i % 6) * 0.08, lod);
    }
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
  }
  grassMesh.instanceMatrix.needsUpdate = true;
}
function buildBuildings() {
  const list = field.buildings || [];
  if (!list.length) return;
  const pos = [], col = [], idx = [];
  for (const b of list) {
    const pts = b.p;
    if (!pts || pts.length < 3) continue;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[1]; }
    cx /= pts.length; cz /= pts.length;
    if (kindAt(cx, cz) === 3) continue;
    if (Math.hypot(cx - field.anchors.home[0], cz - field.anchors.home[1]) < 16) continue;
    const gy = groundY(cx, cz);
    const h = b.h || 5;
    const c = b.c || [0.9, 0.84, 0.74];
    const wall = [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78];
    const roof = [Math.min(1, c[0] * 1.05), Math.min(1, c[1] * 0.95), Math.min(1, c[2] * 0.88)];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], d = pts[(i + 1) % n];
      const i0 = pos.length / 3;
      pos.push(a[0], gy, a[1], d[0], gy, d[1], a[0], gy + h, a[1], d[0], gy + h, d[1]);
      for (let k = 0; k < 4; k++) col.push(wall[0], wall[1], wall[2]);
      idx.push(i0, i0 + 1, i0 + 2, i0 + 2, i0 + 1, i0 + 3);
    }
    const tip = pos.length / 3;
    pos.push(cx, gy + h + 0.45, cz);
    col.push(roof[0], roof[1], roof[2]);
    for (let i = 0; i < n; i++) {
      const a = pts[i], d = pts[(i + 1) % n];
      const i0 = pos.length / 3;
      pos.push(a[0], gy + h, a[1], d[0], gy + h, d[1]);
      col.push(roof[0], roof[1], roof[2], roof[0], roof[1], roof[2]);
      idx.push(tip, i0, i0 + 1);
    }
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp })));
}

function labelSprite(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,10,16,0.82)';
  g.fillRect(8, 8, 240, 48);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(8, 8, 240, 48);
  g.fillStyle = '#fff6e4';
  g.font = '700 28px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale ? scale[0] : 2.1, scale ? scale[1] : 0.52, 1);
  return sp;
}
function addMarker(x, z, text, color) {
  const y = groundY(x, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5), toonMat(color));
  pole.position.set(x, y + 1.1, z);
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toonMat(color));
  cap.position.set(x, y + 2.25, z);
  const lab = labelSprite(text, color);
  lab.position.set(x, y + 2.85, z);
  scene.add(pole, cap, lab);
}

function hourLook() {
  const t = window.__aroSun ? window.__aroSun() : 0.2;
  if (t < 0.15) return { sky: '#ffb07a', horizon: '#ffe3c4', ground: '#9dcc72', sun: '#ffe0b0', up: 0.42, hemi: 1.05, dir: 1.45 };
  if (t < 0.6) return { sky: '#79c8f4', horizon: '#e7f7ff', ground: '#b7dc86', sun: '#fff6d8', up: 0.92, hemi: 1.05, dir: 1.55 };
  if (t < 0.88) return { sky: '#f08a5a', horizon: '#ffc9a4', ground: '#d4926a', sun: '#ffb07a', up: 0.32, hemi: 0.8, dir: 1.15 };
  return { sky: '#243864', horizon: '#4d6294', ground: '#2a3a52', sun: '#b7c8ef', up: 0.28, hemi: 0.7, dir: 0.85 };
}
function applySky() {
  const L = hourLook();
  skyMat.uniforms.uTop.value.set(L.sky);
  skyMat.uniforms.uHor.value.set(L.horizon);
  skyMat.uniforms.uBot.value.set(L.ground);
  scene.fog.color.set(L.horizon);
  if (skyMat.uniforms.uTime) skyMat.uniforms.uTime.value = worldT;
  hemi.color.set(L.sky);
  hemi.groundColor.set(L.ground);
  hemi.intensity = L.hemi;
  sun.color.set(L.sun);
  sun.intensity = L.dir;
  const t = window.__aroSun ? window.__aroSun() : 0.2;
  const ang = (t - 0.15) * Math.PI;
  sun.position.set(Math.cos(ang) * 40, 18 + L.up * 40, Math.sin(ang) * 24);
}

function applyPose(model, time, dt, speed, state) {
  if (!model || !model.humanoid) return;
  const setBone = (name, x, y, z) => {
    const b = model.humanoid.getNormalizedBoneNode(name);
    if (b) b.rotation.set(x, y, z);
  };
  const target = speed > 0.2 ? Math.min(1, speed / 1.3) : 0;
  state.amp += (target - state.amp) * Math.min(1, dt * 5);
  if (speed > 0.2) state.phase += dt * (2.4 + speed * 0.55);
  const w = state.amp;
  const idle = 1 - w;
  const swing = Math.sin(state.phase);
  const breathe = Math.sin(time * 1.6);
  setBone('hips', Math.sin(state.phase * 2) * 0.05 * w, Math.sin(state.phase) * 0.05 * w, 0);
  setBone('spine', breathe * 0.035 * idle + swing * 0.04 * w, 0, 0);
  setBone('chest', breathe * 0.03 * idle, Math.sin(time * 0.55) * 0.05 * idle, 0);
  setBone('neck', 0, 0, 0);
  setBone('head', -0.06, Math.sin(time * 0.45) * 0.1 * idle, 0);
  setBone('leftUpperLeg', swing * 0.72 * w, 0, 0);
  setBone('rightUpperLeg', -swing * 0.72 * w, 0, 0);
  setBone('leftLowerLeg', Math.max(0, -swing) * 1.2 * w, 0, 0);
  setBone('rightLowerLeg', Math.max(0, swing) * 1.2 * w, 0, 0);
  setBone('leftFoot', -Math.max(0, swing) * 0.35 * w, 0, 0);
  setBone('rightFoot', -Math.max(0, -swing) * 0.35 * w, 0, 0);
  setBone('leftUpperArm', swing * 0.5 * w, 0, 1.18);
  setBone('rightUpperArm', -swing * 0.5 * w, 0, -1.18);
  setBone('leftLowerArm', 0.15 + Math.max(0, swing) * 0.35 * w, 0.1, 0);
  setBone('rightLowerArm', 0.15 + Math.max(0, -swing) * 0.35 * w, -0.1, 0);
  model.update(dt);
}

function steer(dt) {
  if (shot === 'home' || shot === 'npcs' || shot === 'water' || shot === 'close' || shot === 'wide') return 0;
  let x = 0, z = 0, mode = '';
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  if (keys.f || keys.b || keys.l || keys.r) {
    dest = null;
    if (keys.f) { x += fx; z += fz; }
    if (keys.b) { x -= fx; z -= fz; }
    if (keys.r) { x += rx; z += rz; }
    if (keys.l) { x -= rx; z -= rz; }
    mode = 'keys';
  } else if (dest && (tapOn() || destFromPick)) {
    x = dest.x - px; z = dest.z - pz;
    if (Math.hypot(x, z) < 0.55) { dest = null; destFromPick = false; return 0; }
    mode = 'tap';
  } else if (gpsTarget && performance.now() > tapUntil) {
    x = gpsTarget.x - px; z = gpsTarget.z - pz;
    if (Math.hypot(x, z) < 0.7) { gpsTarget = null; return 0; }
    mode = 'gps';
  } else return 0;
  const len = Math.hypot(x, z) || 1;
  const sp = mode === 'gps' ? 4.4 : 3.25;
  const dx = (x / len) * sp * dt;
  const dz = (z / len) * sp * dt;
  let nx = px + dx, nz = pz + dz;
  if (blocked(nx, nz)) {
    if (!blocked(px + dx, pz)) nz = pz;
    else if (!blocked(px, pz + dz)) nx = px;
    else return 0;
  }
  const moved = Math.hypot(nx - px, nz - pz);
  if (moved > 0.0008) facing = Math.atan2(nx - px, nz - pz);
  px = nx; pz = nz;
  return moved / Math.max(dt, 0.001);
}

function placeAvatar(speed) {
  if (!avatar) return;
  const y = groundY(px, pz) + (avatar.userData.foot || 0);
  avatar.position.set(px, y, pz);
  avatar.rotation.y = facing;
  const bob = speed > 0.2 ? Math.abs(Math.sin(playerPose.phase * 2)) * 0.03 : Math.sin(worldT * 1.6) * 0.01;
  avatar.position.y += bob;
  if (blob) blob.position.set(px, groundY(px, pz) + 0.04, pz);
}

function syncAnchor() {
  if (!field || typeof window.__aroPlace !== 'function') return;
  const spots = [
    ['lake', field.anchors.lake, 8],
    ['garden', field.anchors.garden, 8],
    ['home', field.anchors.home, 7],
  ];
  let name = 'home';
  for (const [n, p, rad] of spots) {
    if (Math.hypot(px - p[0], pz - p[1]) <= rad) { name = n; break; }
  }
  if (name !== lastAnchor) {
    lastAnchor = name;
    window.__aroPlace(name);
  }
}

function nearestWalkable(x, z) {
  if (!blocked(x, z)) return [x, z];
  for (let rad = 2; rad <= 28; rad += 2) {
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      const nx = x + Math.cos(ang) * rad, nz = z + Math.sin(ang) * rad;
      if (!blocked(nx, nz)) return [nx, nz];
    }
  }
  return [x, z];
}
function frameCamera() {
  if (shot === 'close') { camDist = 4.6; camPitch = 0.4; }
  else if (shot === 'walk') { camDist = 6.4; camPitch = 0.48; }
  else if (shot === 'wide') { camDist = 26; camPitch = 0.42; }
  else if (shot === 'home' && field) {
    const h = field.anchors.home;
    const gy = groundY(h[0], h[1]);
    const spot = nearestWalkable(h[0] + 9, h[1] + 2);
    px = spot[0]; pz = spot[1];
    look.set(h[0], gy + 11, h[1]);
    camera.position.set(h[0] + 30, gy + 6, h[1] + 24);
    camera.lookAt(look);
    if (skyMat) skyMat.uniforms.uCam.value.copy(camera.position);
    return;
  } else if (shot === 'npcs' && npcs.length) {
    let sx = 0, sz = 0;
    npcs.forEach((n) => { sx += n.x; sz += n.z; });
    sx /= npcs.length; sz /= npcs.length;
    const spot = nearestWalkable(sx + 1, sz + 7);
    px = spot[0]; pz = spot[1];
    camYaw = Math.atan2(sx - px, sz - pz);
    camDist = 9; camPitch = 0.38;
    dest = null;
  } else if (shot === 'water' && field) {
    const lake = field.anchors.lake;
    const spot = nearestWalkable(lake[0] - 16, lake[1] + 8);
    px = spot[0]; pz = spot[1];
    look.set(lake[0], 0.4, lake[1]);
    camera.position.set(spot[0], groundY(spot[0], spot[1]) + 8, spot[1]);
    camera.lookAt(look);
    if (skyMat) skyMat.uniforms.uCam.value.copy(camera.position);
    return;
  }
  const y = groundY(px, pz) + 1.65;
  look.set(px, y, pz);
  const cp = Math.cos(camPitch), spn = Math.sin(camPitch);
  camera.position.set(
    px + Math.sin(camYaw) * camDist * cp,
    y + camDist * spn,
    pz + Math.cos(camYaw) * camDist * cp
  );
  camera.lookAt(look);
  if (skyMat) skyMat.uniforms.uCam.value.copy(camera.position);
}

function onKey(e, down) {
  if (!active) return;
  if (document.querySelector('.modal.on, #simpleMenu.on, #spineBook.on')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const map = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  const slot = map[k.toLowerCase()];
  if (!slot) return;
  e.preventDefault();
  keys[slot] = down ? 1 : 0;
}

function aimPointer(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}
function pickGround(ev) {
  aimPointer(ev);
  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) return null;
  const p = hits[0].point;
  if (blocked(p.x, p.z)) return null;
  return p;
}
function pickSpecial(ev) {
  aimPointer(ev);
  const list = [];
  if (homeRoot) list.push(homeRoot);
  npcs.forEach((n) => { if (n.group) list.push(n.group); });
  if (!list.length) return null;
  const hits = raycaster.intersectObjects(list, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.pick) o = o.parent;
  return o && o.userData.pick;
}
function useSpecial(pick) {
  shot = '';
  if (pick.kind === 'home') {
    if (Math.hypot(px - pick.x, pz - pick.z) < 14) {
      if (window.__aroBoard) window.__aroBoard();
    } else {
      const spot = nearestWalkable(pick.x + 8, pick.z + 3);
      dest = { x: spot[0], z: spot[1] };
      destFromPick = true;
    }
    return;
  }
  if (pick.kind === 'npc') {
    if (Math.hypot(px - pick.x, pz - pick.z) < 3.6) {
      if (window.__aroSpar) window.__aroSpar(pick.id);
    } else {
      dest = nearestWalkable(pick.x, pick.z + 2);
      dest = { x: dest[0], z: dest[1] };
      destFromPick = true;
    }
  }
}

function bindInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    if (!active) return;
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, moved: false });
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.ox, e.clientY - p.oy) > 12) p.moved = true;
    if (ptrs.size >= 2) {
      const pts = [...ptrs.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (p.pinch && d) camDist = clamp(camDist * (p.pinch / d), 4.2, 52);
      for (const q of ptrs.values()) q.pinch = d;
      return;
    }
    if (p.moved) {
      camYaw -= dx * 0.007;
      camPitch = clamp(camPitch - dy * 0.004, 0.28, 1.15);
      shot = '';
    }
  });
  function endPtr(e) {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    for (const q of ptrs.values()) q.pinch = 0;
    if (!p || p.moved || ptrs.size) return;
    const special = pickSpecial(e);
    if (special) { useSpecial(special); return; }
    if (!tapOn()) return;
    const hit = pickGround(e);
    if (!hit) return;
    dest = { x: hit.x, z: hit.z };
    tapUntil = performance.now() + 2200;
    shot = '';
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
  canvas.addEventListener('wheel', (e) => {
    if (!active) return;
    e.preventDefault();
    camDist = clamp(camDist * (e.deltaY > 0 ? 1.08 : 0.92), 4.2, 52);
    shot = '';
  }, { passive: false });
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { keys.f = keys.b = keys.l = keys.r = 0; });
}

function startGPS() {
  if (!navigator.geolocation || !field) return;
  navigator.geolocation.watchPosition((pos) => {
    if (performance.now() < tapUntil) return;
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    const here = projectLatLon(lat, lon);
    if (!blocked(here.x, here.z)) {
      gpsTarget = here;
      gpsRef = null;
      return;
    }
    if (!gpsRef) {
      gpsRef = { lat, lon, x: px, z: pz };
      return;
    }
    const dx = (lon - gpsRef.lon) * field.metersPerDegLon;
    const dz = -(lat - gpsRef.lat) * field.metersPerDegLat;
    const tx = gpsRef.x + dx, tz = gpsRef.z + dz;
    if (!blocked(tx, tz)) gpsTarget = { x: tx, z: tz };
  }, () => {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 8000 });
}

function dressVRM(model) {
  VRMUtils.removeUnnecessaryVertices(model.scene);
  model.scene.traverse((o) => {
    o.frustumCulled = false;
    const mats = o.material ? [].concat(o.material) : [];
    mats.forEach((m) => {
      if (m && m.outlineWidthFactor != null && m.outlineWidthFactor < 0.004) m.outlineWidthFactor = 0.008;
    });
  });
  if (model.lookAt) model.lookAt.autoUpdate = false;
  const box = new THREE.Box3().setFromObject(model.scene);
  const h = box.max.y - box.min.y || 1.6;
  const s = h > 2.4 ? 1.58 / h : 1;
  model.scene.scale.setScalar(s);
  return -box.min.y * s;
}
function loadVRM(url, ok, fail, onProg) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(url, (gltf) => {
    const model = gltf.userData.vrm;
    if (!model) { if (fail) fail(); return; }
    ok(model);
  }, (e) => { if (onProg && e.total) onProg(e.loaded / e.total); }, () => { if (fail) fail(); });
}
function loadAvatar() {
  setLoad(0.12, 'Loading her…');
  loadVRM(VRM_URL, (model) => {
    vrm = model;
    const foot = dressVRM(vrm);
    avatar = new THREE.Group();
    avatar.add(vrm.scene);
    avatar.userData.foot = foot;
    scene.add(avatar);
    avatarReady = true;
    placeAvatar(0);
    api.avatarReady = true;
    setLoad(0.62, 'Loading the town…');
  }, () => { api.avatarReady = 'error'; }, (p) => setLoad(0.12 + p * 0.48, 'Loading her…'));
}
function loadNpcs() {
  let left = NPC_URLS.length;
  const done = () => {
    left -= 1;
    setLoad(0.62 + (1 - left / NPC_URLS.length) * 0.38, 'Loading the town…');
    if (left <= 0) api.npcsReady = true;
  };
  NPC_URLS.forEach((spec, i) => {
    const spot = nearestWalkable(px + 5, pz + (i === 0 ? -7 : 6));
    loadVRM(spec.url, (model) => {
      const foot = dressVRM(model);
      const group = new THREE.Group();
      group.add(model.scene);
      group.position.set(spot[0], groundY(spot[0], spot[1]) + foot, spot[2] || spot[1]);
      group.userData.pick = { kind: 'npc', id: spec.id, x: spot[0], z: spot[1] };
      const lab = labelSprite('Test NPC · ' + spec.id, '#ffd2a8', [1.8, 0.4]);
      lab.position.y = 2.35;
      group.add(lab);
      scene.add(group);
      npcs.push({ id: spec.id, vrm: model, group, x: spot[0], z: spot[1], foot, pose: { amp: 0, phase: i } });
      done();
    }, done);
  });
}
function hullOf(mesh) {
  const geo = inflate(mesh.geometry, 0.06);
  const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1a140e, side: THREE.BackSide }));
  ink.position.copy(mesh.position);
  ink.rotation.copy(mesh.rotation);
  ink.scale.copy(mesh.scale);
  return ink;
}
function buildHome(x, z) {
  const y = groundY(x, z);
  homeRoot = new THREE.Group();
  homeRoot.position.set(x, y, z);
  homeRoot.userData.pick = { kind: 'home', x, z };
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.4, 0.42, 6), toonMat('#4e463c'));
  stone.position.y = 0.12;
  const metal = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.12, 6), toonMat('#d5dbe4'));
  metal.position.y = 0.36;
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, depthWrite: false });
  const glow2 = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.85, depthWrite: false });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.08, 8, 48), glow);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.06, 8, 32), glow2);
  ringA.rotation.x = ringB.rotation.x = Math.PI / 2;
  ringA.position.y = ringB.position.y = 0.48;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 3.4), toonMat('#c8b49a'));
  ramp.position.set(6.2, 0.18, 0);
  ramp.rotation.z = -0.22;
  homeRoot.add(stone, metal, ringA, ringB, ramp, hullOf(stone));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const lx = Math.cos(a) * 6.3, lz = Math.sin(a) * 6.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), toonMat('#3a342c'));
    pole.position.set(lx, 1.15, lz);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7a0 }));
    lamp.position.set(lx, 2.05, lz);
    homeRoot.add(pole, lamp);
  }
  const zep = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), toonMat('#f4efe2'));
  hull.scale.set(1.7, 1.25, 4.4);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 8, 18), toonMat('#e7b15a'));
  band.rotation.y = Math.PI / 2;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 4), toonMat('#c4554a'));
  fin.rotation.x = Math.PI / 2;
  fin.position.set(0, 0.85, -4.05);
  const finL = fin.clone();
  finL.position.set(-1.35, 0.15, -3.7);
  finL.rotation.z = 0.9;
  const finR = fin.clone();
  finR.position.set(1.35, 0.15, -3.7);
  finR.rotation.z = -0.9;
  const gondola = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toonMat('#2a241c'));
  gondola.scale.set(1.15, 0.72, 2.15);
  gondola.position.set(0, -1.55, 0.15);
  const windowM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.4), new THREE.MeshBasicMaterial({ color: 0xffe7a8 }));
  windowM.position.set(0, -1.5, 0.2);
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMat('#5a5048'));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.18), toonMat('#f2efe6'));
  const blade2 = blade.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(hub, blade, blade2);
  prop.position.set(0, 0, -4.55);
  const propR = prop.clone();
  propR.position.set(1.55, -0.15, -3.6);
  zep.add(hull, band, fin, finL, finR, gondola, windowM, prop, propR, hullOf(hull));
  zep.position.y = 18;
  const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 16.2, 5), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  tether.position.y = 9.2;
  homeRoot.add(zep, tether);
  const sign = labelSprite('Home', '#ffd978');
  sign.position.y = 4.2;
  homeRoot.add(sign);
  homeRoot.userData.rings = [ringA, ringB];
  homeRoot.userData.zep = zep;
  homeRoot.userData.props = [prop, propR];
  scene.add(homeRoot);
}

function mountLoader() {
  if (document.getElementById('worldLoad')) return;
  const s = document.createElement('style');
  s.textContent = '#worldLoad{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:40;width:min(280px,78vw);padding:16px;border-radius:16px;background:rgba(22,12,18,.92);border:1px solid rgba(255,214,140,.75);color:#fff6e4;font:800 14px ui-rounded,system-ui;text-align:center}#worldLoad.hide{display:none}#worldLoad b{display:block;height:10px;margin-top:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}#worldLoad i{display:block;height:100%;width:4%;background:linear-gradient(90deg,#ffd978,#ff9ad6)}';
  document.head.appendChild(s);
  const d = document.createElement('div');
  d.id = 'worldLoad';
  d.innerHTML = '<span>Loading the town…</span><b><i></i></b>';
  document.body.appendChild(d);
}
function setLoad(p, text) {
  const el = document.getElementById('worldLoad');
  if (!el) return;
  el.classList.remove('hide');
  if (text) el.querySelector('span').textContent = text;
  el.querySelector('i').style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
}
function hideLoad() {
  const el = document.getElementById('worldLoad');
  if (el) el.classList.add('hide');
}
function renderWorld() {
  const w = Math.max(2, renderer.domElement.width);
  const h = Math.max(2, renderer.domElement.height);
  if (!rt || rt.width !== w || rt.height !== h) {
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h);
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    if (!composeScene) {
      quadMat = new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
        fragmentShader: `
          precision mediump float;
          uniform sampler2D tDiffuse;
          uniform vec2 uTexel;
          varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            vec3 l = texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)).rgb;
            vec3 r = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb;
            vec3 u = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb;
            vec3 d = texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y)).rgb;
            float e = length(c - l) + length(c - r) + length(c - u) + length(c - d);
            c = mix(c, vec3(0.09, 0.06, 0.07), smoothstep(0.42, 0.9, e) * 0.45);
            vec3 blur = (l + r + u + d) * 0.25;
            c += max(blur - 0.58, 0.0) * 0.45;
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
      composeScene = new THREE.Scene();
      composeScene.add(quad);
      composeCam = new THREE.Camera();
    }
  }
  quadMat.uniforms.tDiffuse.value = rt.texture;
  quadMat.uniforms.uTexel.value.set(1.25 / w, 1.25 / h);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(composeScene, composeCam);
}
function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  const narrow = w < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.15 : 1.5));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function tick(dt, show) {
  active = !!show && !!renderer;
  document.body.classList.toggle('world-on', active);
  if (!active || !field) return;
  const step = Math.min(dt, 0.05);
  worldT += step;
  if (shot === 'walk' && !dest) dest = { x: px + 7, z: pz + 2.5 };
  const speed = steer(step);
  applyPose(vrm, worldT, step, speed, playerPose);
  placeAvatar(speed);
  for (const n of npcs) {
    if (!n.vrm) continue;
    applyPose(n.vrm, worldT, step, 0, n.pose);
    n.group.position.y = groundY(n.x, n.z) + n.foot;
    n.group.rotation.y = Math.atan2(px - n.x, pz - n.z);
  }
  if (homeRoot && homeRoot.userData.zep) {
    const pulse = 0.5 + 0.5 * Math.sin(worldT * 2.4);
    homeRoot.userData.rings[0].material.opacity = 0.45 + pulse * 0.5;
    homeRoot.userData.rings[1].material.opacity = 0.35 + (1 - pulse) * 0.55;
    homeRoot.userData.zep.position.y = 18 + Math.sin(worldT * 0.7) * 0.35;
    homeRoot.userData.zep.rotation.y = Math.sin(worldT * 0.22) * 0.08;
    for (const prop of homeRoot.userData.props || []) prop.rotation.z += step * 9;
  }
  if (grassMesh) {
    grassMesh.material.uniforms.uTime.value = worldT;
    if ((worldT * 8 | 0) !== (grassMesh.userData.step | 0)) {
      grassMesh.userData.step = worldT * 8 | 0;
      scatterGrass();
    }
  }
  syncAnchor();
  if (waterMat) waterMat.uniforms.uTime.value = worldT;
  applySky();
  frameCamera();
  renderWorld();
  if (avatarReady && api.npcsReady) hideLoad();
}

const api = {
  ready: false,
  avatarReady: false,
  npcsReady: false,
  tick,
  key: onKey,
  pose(name) { shot = name || ''; },
  where() { return { x: px, z: pz, facing, avatarReady, active }; },
};
window.__world3d = api;

function bootField(data) {
  field = data;
  const raw = atob(data.grid);
  grid = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) grid[i] = raw.charCodeAt(i);
  const home = data.anchors.home;
  const start = nearestWalkable(home[0] + 16, home[1] + 8);
  px = start[0]; pz = start[1];
  carveLake();
  buildGround();
  buildDressing();
  buildBuildings();
  const a = data.anchors;
  addMarker(a.garden[0], a.garden[1], 'Garden hive', '#b6f5a8');
  addMarker(a.lake[0], a.lake[1], 'Long Lake', '#9ad8ff');
  buildHome(a.home[0], a.home[1]);
  api.ready = true;
  startGPS();
  loadAvatar();
  loadNpcs();
}

function boot() {
  const canvas = document.getElementById('worldCv');
  if (!canvas) return;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x8ec8ee, 1);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffe3c4, 36, 240);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  clock = new THREE.Clock();
  hemi = new THREE.HemisphereLight(0xcfeaff, 0x6a8a48, 0.85);
  sun = new THREE.DirectionalLight(0xfff4d2, 1.3);
  sun.position.set(30, 40, 16);
  scene.add(hemi, sun);
  const rim = new THREE.DirectionalLight(0xcfe8ff, 0.55);
  rim.position.set(-24, 16, -18);
  scene.add(rim);
  blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x14200c, transparent: true, opacity: 0.32, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#7ec8f0') },
      uHor: { value: new THREE.Color('#d7f3ff') },
      uBot: { value: new THREE.Color('#b7d48a') },
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision mediump float;
      varying vec3 vW;
      uniform vec3 uTop,uHor,uBot,uCam;
      uniform float uTime;
      void main(){
        vec3 dir = normalize(vW - uCam);
        float h = dir.y;
        vec3 c = mix(uBot, uHor, smoothstep(-0.2, 0.15, h));
        c = mix(c, uTop, smoothstep(0.05, 0.7, h));
        vec2 cloudUv = dir.xz / max(0.15, dir.y + 0.35) * 1.6 + vec2(uTime * 0.015, 0.0);
        float n = sin(cloudUv.x * 6.0) * sin(cloudUv.y * 5.0);
        n += sin(cloudUv.x * 13.0 + 2.0) * sin(cloudUv.y * 11.0) * 0.5;
        float cloud = smoothstep(0.35, 0.85, n * 0.5 + 0.5) * smoothstep(0.05, 0.45, h);
        c = mix(c, vec3(1.0, 0.97, 0.93), cloud * 0.72);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 16, 10), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  bindInput(canvas);
  window.addEventListener('resize', resize);
  resize();
  mountLoader();
  setLoad(0.04, 'Loading the town…');
  fetch(FIELD_URL).then((r) => r.json()).then((data) => { setLoad(0.1, 'Loading the town…'); bootField(data); }).catch(() => {});
}

boot();
