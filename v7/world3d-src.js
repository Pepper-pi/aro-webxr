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
let rt, bloomA, bloomB, composeScene, composeCam, quad, brightMat, blurMat, quadMat;
let windMats = [];
let life = null;
let grassMesh;
let grassStore = null;
let playMode = 'world';
let playSaved = null;
let lastDt = 0.016;
let runHold = 0;
let runUntil = 0;
let camInit = false;
let groundHolo = null;
let rod = null;
let rodLine = null;
const bolts = [];
const roomFloors = [];
const gates = [];
const bees = [];
const wantCam = new THREE.Vector3();
const smoothCam = new THREE.Vector3();
const smoothLook = new THREE.Vector3();
const SITES = {
  home: { x: 0, z: -940, hw: 4.1, hd: 3.5 },
  house: { x: 36, z: -940, hw: 3.8, hd: 3.3 },
  market: { x: 88, z: -940, hw: 11, hd: 8 },
  arena: { x: 150, z: -940, hw: 9, hd: 7 },
};
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
function indoors() {
  return playMode !== 'world' && playMode !== 'fish';
}
function standY(x, z) {
  return indoors() ? 0 : groundY(x, z);
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
  0: [0.40, 0.68, 0.28],
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

const HEX_GLSL = `
vec2 holoHash2(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float holoHash(vec2 p){ return holoHash2(p).x; }
vec3 holoHex(vec2 p, float scale){
  vec2 uv = p / scale;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = uv - gv;
  float hd = max(abs(gv.x), abs(gv.x) * 0.5 + abs(gv.y) * 0.8660254);
  return vec3(id, 0.5 - hd);
}
`;
function dressGround(mesh) {
  const mat = mesh.material;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uHolo = { value: 1 };
    shader.uniforms.uOrigin = { value: new THREE.Vector2() };
    mat.userData.shader = shader;
    groundHolo = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoloW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoloW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEX_GLSL + '\nvarying vec3 vHoloW;\nuniform float uTime;\nuniform float uHolo;\nuniform vec2 uOrigin;')
      .replace('#include <opaque_fragment>', `
        vec3 hcell = holoHex(vHoloW.xz, 2.45);
        vec2 hid = hcell.xy; float hedge = hcell.z;
        float hline = 1.0 - smoothstep(0.015, 0.06, hedge);
        float hdist = length(vHoloW.xz - uOrigin);
        float cycle = fract(uTime * 0.09 + 0.22);
        float sweep = cycle * 64.0;
        float ring = exp(-abs(hdist - sweep) * 0.85);
        float gate = smoothstep(0.02, 0.1, cycle) * (1.0 - smoothstep(0.72, 0.92, cycle));
        float breath = 0.65 + 0.35 * (0.5 + 0.5 * sin(uTime * 0.31));
        float presence = (0.16 * breath + ring * gate * 0.55) * uHolo;
        if (vHoloW.y < -0.15) presence = 0.0;
        vec3 hcol = mix(vec3(0.35, 0.95, 1.0), vec3(1.0, 0.78, 0.34), step(0.55, holoHash(hid)));
        outgoingLight += hcol * hline * presence;
        float far = smoothstep(14.0, 32.0, hdist);
        float rare = step(mix(0.993, 0.97, clamp(uHolo, 0.0, 1.0)), holoHash(hid + 4.2));
        float phase = fract(uTime * 0.11 + holoHash(hid + 1.7) * 6.0);
        float burst = (1.0 - smoothstep(0.0, 0.22, phase)) * far * rare;
        float scan = smoothstep(0.42, 0.82, fract(vHoloW.x * 2.6 + uTime * 5.0));
        float edgeR = holoHex(vHoloW.xz + vec2(0.09, 0.0), 2.45).z;
        float edgeB = holoHex(vHoloW.xz - vec2(0.09, 0.0), 2.45).z;
        vec3 glitch = vec3(1.0 - smoothstep(0.01, 0.045, edgeR), scan * 0.5, 1.0 - smoothstep(0.01, 0.045, edgeB));
        outgoingLight = mix(outgoingLight, glitch, burst * 0.55 * uHolo * step(-0.15, vHoloW.y));
        #include <opaque_fragment>
      `);
  };
    mat.customProgramCacheKey = () => 'holo-ground-v1';
  mat.needsUpdate = true;
}
function holoLevel() {
  try { return window.__aroHolo ? +window.__aroHolo() : 1; }
  catch (e) { return 1; }
}
function hash2(ix, iz) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm2(x, z) {
  return noise2(x, z) * 0.62 + noise2(x * 2.13 + 4.2, z * 2.13 + 1.7) * 0.38;
}
function nearKind(x, z, kind, rad) {
  return kindAt(x + rad, z) === kind || kindAt(x - rad, z) === kind || kindAt(x, z + rad) === kind || kindAt(x, z - rad) === kind;
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
  dressGround(ground);
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
    uniforms: {
      uTime: { value: 0 },
      uLake: { value: new THREE.Vector2(12, -1.6) },
      uRad: { value: 34 },
    },
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
      uniform vec2 uLake;
      uniform float uRad;
      void main(){
        float rip = sin(vW.x * 0.55 + uTime * 1.35) * sin(vW.z * 0.48 - uTime * 0.95);
        float rip2 = sin(vW.x * 1.35 - vW.z * 1.05 + uTime * 1.8);
        vec3 deep = vec3(0.03, 0.16, 0.38);
        vec3 mid = vec3(0.10, 0.48, 0.74);
        vec3 shallow = vec3(0.34, 0.78, 0.82);
        float dist = length(vW.xz - uLake);
        float depth = 1.0 - smoothstep(1.5, uRad, dist);
        vec3 c = mix(shallow, mid, smoothstep(0.0, 0.45, depth));
        c = mix(c, deep, smoothstep(0.4, 1.0, depth));
        c = mix(c, vec3(0.55, 0.88, 0.92), smoothstep(-0.2, 0.85, rip) * 0.28);
        float spark = pow(max(sin(vW.x * 0.85 + uTime * 0.8) * sin(vW.z * 0.7 - uTime * 0.55), 0.0), 4.0);
        vec3 sky = vec3(1.0, 0.82, 0.58);
        c = mix(c, sky, spark * depth * 0.55);
        c += vec3(0.95, 0.98, 1.0) * spark * depth * 0.9;
        float foam = smoothstep(0.25, 0.95, vShore);
        foam *= 0.55 + 0.45 * sin(vW.x * 1.6 + vW.z * 1.2 + uTime * 2.2);
        c = mix(c, vec3(0.93, 0.98, 1.0), clamp(foam, 0.0, 1.0) * (1.0 - depth * 0.85));
        gl_FragColor = vec4(c, 0.94);
      }`,
  });
  water = new THREE.Mesh(wgeo, waterMat);
  water.frustumCulled = false;
  if (field.anchors && field.anchors.lake) {
    waterMat.uniforms.uLake.value.set(field.anchors.lake[0], field.anchors.lake[1]);
    waterMat.uniforms.uRad.value = 36;
  }
  scene.add(water);
}

function solid(geo) {
  return geo.index ? geo.toNonIndexed() : geo;
}
function shadeCanopy(geo, bottom, top) {
  geo = solid(geo);
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const c0 = new THREE.Color(bottom), c1 = new THREE.Color(top);
  const arr = new Float32Array(pos.count * 3);
  const span = (maxY - minY) || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    const n = 0.9 + 0.1 * Math.sin(pos.getX(i) * 8.0 + pos.getZ(i) * 6.5);
    arr[i * 3] = (c0.r + (c1.r - c0.r) * t) * n;
    arr[i * 3 + 1] = (c0.g + (c1.g - c0.g) * t) * n;
    arr[i * 3 + 2] = (c0.b + (c1.b - c0.b) * t) * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
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
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.x += sin(uTime * 1.15 + transformed.y) * transformed.y * 0.02;\ntransformed.z += cos(uTime * 0.9) * transformed.y * 0.012;'
    );
  };
  windMats.push(mat);
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
  const puffA = shadeCanopy(new THREE.IcosahedronGeometry(1.25, 1), '#1f6b34', '#8ed56a');
  puffA.translate(0, 2.35, 0);
  const puffB = shadeCanopy(new THREE.IcosahedronGeometry(0.85, 1), '#2f8a44', '#d7f0a0');
  puffB.translate(0.7, 2.85, 0.25);
  const puffC = shadeCanopy(new THREE.IcosahedronGeometry(0.78, 1), '#174f28', '#5aaa48');
  puffC.translate(-0.62, 2.55, -0.28);
  const puffD = shadeCanopy(new THREE.IcosahedronGeometry(0.55, 0), '#3c9a48', '#e7f6b4');
  puffD.translate(0.15, 3.35, -0.1);
  const puffE = shadeCanopy(new THREE.IcosahedronGeometry(0.48, 0), '#67c45a', '#f4ffe0');
  puffE.translate(-0.2, 2.15, 0.55);
  const broad = mergeGeometries([trunk, puffA, puffB, puffC, puffD, puffE]);
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
    if (dh < 14) continue;
    if (Math.hypot(x - (px + 5), z - (pz - 7)) < 6) continue;
    if (Math.hypot(x - (px + 5), z - (pz + 6)) < 6) continue;
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
  const bladeGeo = solid(new THREE.BufferGeometry());
  {
    const w = 0.028, h = 0.52;
    const pos = new Float32Array([
      -w, 0, 0,
      w, 0, 0,
      w * 0.28, h * 0.55, 0.012,
      0, h, 0.02,
    ]);
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bladeGeo.setIndex([0, 1, 2, 2, 3, 0]);
    bladeGeo.computeVertexNormals();
  }
  const GRASS_MAX = 2800;
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aH;
      attribute float aHue;
      attribute float aSeed;
      uniform float uTime;
      varying float vH;
      varying float vHue;
      void main(){
        vH = clamp(position.y / 0.52, 0.0, 1.0);
        vHue = aHue;
        vec3 p = position;
        p.y *= aH;
        float sway = sin(uTime * 1.55 + aSeed) * 0.11 * vH;
        p.x += sway;
        p.z += cos(uTime * 1.15 + aSeed * 1.3) * 0.07 * vH;
        vec4 world = instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      precision mediump float;
      varying float vH;
      varying float vHue;
      void main(){
        vec3 root = vec3(0.40, 0.68, 0.28);
        vec3 tip = vec3(0.58, 0.82, 0.40);
        vec3 c = mix(root, tip, vH);
        c.r += (vHue - 0.5) * 0.06;
        c.g += (vHue - 0.5) * 0.1;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_MAX);
  grassMesh.frustumCulled = false;
  grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hAttr = new Float32Array(GRASS_MAX);
  const hueAttr = new Float32Array(GRASS_MAX);
  const seedAttr = new Float32Array(GRASS_MAX);
  for (let i = 0; i < GRASS_MAX; i++) {
    hAttr[i] = 0.55 + ((i * 17) % 100) / 140;
    hueAttr[i] = ((i * 13) % 100) / 100;
    seedAttr[i] = (i * 0.37) % 6.28;
  }
  grassMesh.geometry.setAttribute('aH', new THREE.InstancedBufferAttribute(hAttr, 1));
  grassMesh.geometry.setAttribute('aHue', new THREE.InstancedBufferAttribute(hueAttr, 1));
  grassMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));
  scene.add(grassMesh);
  plantGrass(broadSpots.concat(pineSpots));
}
function grassBudget() {
  let n = 2600;
  try {
    if (window.__aroGrass) n = window.__aroGrass() | 0;
  } catch (e) { /* keep the desktop count */ }
  return Math.max(400, Math.min(2800, n));
}
function grassLod() {
  const budget = grassBudget();
  if (budget < 1100) return 14;
  if (budget < 1800) return 20;
  return 28;
}
function plantGrass(trees) {
  const centers = [];
  const home = field.anchors.home;
  const add = (x, z, rad) => {
    const k = kindAt(x, z);
    if (k == null || k === 3 || k === 4 || k === 5) return;
    if (Math.hypot(x - home[0], z - home[1]) < 9) return;
    centers.push(x, z, rad);
  };
  for (const t of trees) add(t[0] + 1.15, t[1] + 0.2, 2.3);
  const maxX = field.minx + field.cols * field.cell;
  const maxZ = field.minz + field.rows * field.cell;
  for (let z = field.minz + 8; z < maxZ - 8; z += 12) {
    for (let x = field.minx + 8; x < maxX - 8; x += 12) {
      const k = kindAt(x, z);
      if (k == null || k === 3 || k === 4 || k === 5) continue;
      const shore = nearKind(x, z, 3, 7);
      const path = nearKind(x, z, 4, 7) || nearKind(x, z, 5, 7);
      let gate = k === 2 ? 0.32 : k === 1 ? 0.44 : 0.73;
      if (shore) gate -= 0.3;
      if (path) gate -= 0.24;
      const nv = fbm2(x * 0.031, z * 0.031);
      if (nv < gate) continue;
      add(x + (hash2(x | 0, z | 0) - 0.5) * 5, z + (hash2(z | 0, x | 0) - 0.5) * 5, 0.75 + nv * 2.5);
    }
  }
  for (const b of field.buildings || []) {
    const pts = b.p;
    if (!pts || pts.length < 3) continue;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[1]; }
    add(cx / pts.length + 3.3, cz / pts.length, 1.55);
  }
  const clumps = centers.length / 3;
  const STORE = 11000;
  const per = Math.max(5, Math.min(14, Math.floor(STORE / Math.max(1, clumps))));
  const data = new Float32Array(Math.min(STORE, clumps * per) * 4);
  let n = 0;
  for (let c = 0; c < clumps && n < STORE; c++) {
    const x = centers[c * 3], z = centers[c * 3 + 1], rad = centers[c * 3 + 2];
    for (let i = 0; i < per && n < STORE; i++) {
      const a = hash2(c * 13 + i, i * 7 + 3) * Math.PI * 2;
      const r = Math.sqrt(hash2(i + c, c * 3 + 9)) * rad;
      const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r;
      const k = kindAt(bx, bz);
      if (k == null || k === 3 || k === 4 || k === 5) continue;
      if (Math.hypot(bx - home[0], bz - home[1]) < 8.3) continue;
      const o = n * 4;
      data[o] = bx; data[o + 1] = bz; data[o + 2] = a; data[o + 3] = 0.62 + hash2(i, c + 11) * 0.75;
      n++;
    }
  }
  grassStore = { data, count: n };
  cullGrass(true);
}
function cullGrass(force) {
  if (!grassMesh || !grassStore) return;
  const key = ((px * 2) | 0) + ',' + ((pz * 2) | 0) + ':' + grassBudget();
  if (!force && grassMesh.userData.key === key) return;
  grassMesh.userData.key = key;
  const rad = grassLod();
  const rad2 = rad * rad;
  const fade0 = rad - 5;
  const budget = grassBudget();
  const { data, count } = grassStore;
  const cand = [];
  for (let i = 0; i < count; i++) {
    const dx = data[i * 4] - px, dz = data[i * 4 + 1] - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < rad2) cand.push(i, d2);
  }
  let pairs = cand.length / 2;
  let list = cand;
  if (pairs > budget) {
    const arr = new Array(pairs);
    for (let i = 0; i < pairs; i++) arr[i] = [cand[i * 2], cand[i * 2 + 1]];
    arr.sort((a, b) => a[1] - b[1]);
    arr.length = budget;
    list = arr;
    pairs = budget;
  }
  const dummy = new THREE.Object3D();
  const sorted = pairs > 0 && Array.isArray(list[0]);
  grassMesh.count = pairs;
  for (let i = 0; i < pairs; i++) {
    const idx = sorted ? list[i][0] : list[i * 2];
    const d2 = sorted ? list[i][1] : list[i * 2 + 1];
    const x = data[idx * 4], z = data[idx * 4 + 1], yaw = data[idx * 4 + 2], h = data[idx * 4 + 3];
    const d = Math.sqrt(d2);
    const fade = d < fade0 ? 1 : Math.max(0, 1 - (d - fade0) / 5);
    dummy.position.set(x, groundY(x, z), z);
    dummy.rotation.set(((idx % 7) - 3) * 0.06, yaw, ((idx % 5) - 2) * 0.04);
    dummy.scale.set(fade, fade * h, fade);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
  }
  grassMesh.instanceMatrix.needsUpdate = true;
}
function buildLife() {
  life = { motes: [], butterflies: [], birds: [], dust: [], splash: [] };
  const lite = window.innerWidth < 700 || holoLevel() < 0.5;
  const moteGeo = new THREE.SphereGeometry(0.055, 5, 4);
  for (let i = 0; i < (lite ? 6 : 16); i++) {
    const m = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({ color: 0xffd36a }));
    m.userData = { a: i * 0.7, r: 1.5 + (i % 5), y: 0.5 + (i % 4) * 0.35 };
    scene.add(m);
    life.motes.push(m);
  }
  for (let i = 0; i < (lite ? 2 : 5); i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff8ec8 : 0xffe08a, side: THREE.DoubleSide });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), mat);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), mat);
    w1.position.x = 0.09; w2.position.x = -0.09;
    g.add(w1, w2);
    g.userData = { a: i * 1.3, wings: [w1, w2] };
    scene.add(g);
    life.butterflies.push(g);
  }
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), toonMat('#4a3424'));
    body.scale.set(0.7, 0.45, 1.6);
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), toonMat('#8a6848'));
    g.add(body, wing);
    g.userData = { a: i * 2.1, wing, alt: 9 + i * 1.6 };
    scene.add(g);
    life.birds.push(g);
  }
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 3), new THREE.MeshBasicMaterial({ color: 0xe6d2ae, transparent: true, opacity: 0 }));
    m.visible = false;
    scene.add(m);
    life.dust.push({ m, t: 0 });
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0 }));
    m.visible = false;
    scene.add(m);
    life.splash.push({ m, t: 0, vy: 0 });
  }
}
function stepLife(dt, speed) {
  if (!life) return;
  const gy = groundY(px, pz);
  const indoor = indoors();
  life.motes.forEach((m) => {
    m.visible = !indoor;
    const u = m.userData;
    const a = worldT * 0.4 + u.a;
    m.position.set(px + Math.cos(a) * u.r, gy + u.y + Math.sin(worldT * 1.4 + u.a) * 0.18, pz + Math.sin(a * 0.85) * u.r);
  });
  life.butterflies.forEach((g, i) => {
    g.visible = !indoor;
    const a = worldT * 0.7 + g.userData.a;
    g.position.set(px + Math.cos(a) * (2.4 + i * 0.7), gy + 1.15 + Math.sin(a * 2) * 0.25, pz + Math.sin(a) * (1.8 + i * 0.4));
    g.userData.wings.forEach((w, k) => { w.rotation.y = Math.sin(worldT * 14 + i) * 0.9 * (k ? -1 : 1); });
  });
  life.birds.forEach((g) => {
    g.visible = !indoor;
    const a = worldT * 0.22 + g.userData.a;
    g.position.set(px + Math.cos(a) * 22, gy + g.userData.alt, pz + Math.sin(a) * 16);
    g.rotation.y = -a;
    g.userData.wing.rotation.z = Math.sin(worldT * 7 + g.userData.a) * 0.6;
  });
  if (speed > 1.05) {
    const slot = life.dust.find((d) => d.t <= 0);
    if (slot) { slot.t = 0.55; slot.m.visible = true; slot.m.position.set(px, gy + 0.05, pz); }
  }
  for (const d of life.dust) {
    if (d.t <= 0) continue;
    d.t -= dt;
    d.m.position.y += dt * 0.35;
    d.m.material.opacity = Math.max(0, d.t);
    if (d.t <= 0) d.m.visible = false;
  }
  const wet = [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]].some(([dx, dz]) => kindAt(px + dx, pz + dz) === 3);
  if (wet && speed > 0.4) {
    const slot = life.splash.find((s) => s.t <= 0);
    if (slot) { slot.t = 0.4; slot.vy = 1.4; slot.m.visible = true; slot.m.position.set(px, gy + 0.08, pz); }
  }
  for (const s of life.splash) {
    if (s.t <= 0) continue;
    s.t -= dt;
    s.vy -= dt * 3.2;
    s.m.position.y += s.vy * dt;
    s.m.material.opacity = Math.max(0, s.t * 2);
    if (s.t <= 0) s.m.visible = false;
  }
  for (const mat of windMats) {
    if (mat.userData.shader) mat.userData.shader.uniforms.uTime.value = worldT;
  }
}
function buildBuildings() {
  const list = field.buildings || [];
  if (!list.length) return;
  const pos = [], col = [], idx = [];
  const push = (x, y, z, r, g, b) => { pos.push(x, y, z); col.push(r, g, b); };
  const tri = (a, b, c) => idx.push(a, b, c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  for (const b of list) {
    const pts = b.p;
    if (!pts || pts.length < 3) continue;
    let len = 0, ux = 1, uz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], d = pts[(i + 1) % pts.length];
      const dx = d[0] - a[0], dz = d[1] - a[1], L = Math.hypot(dx, dz);
      if (L > len) { len = L; ux = dx / (L || 1); uz = dz / (L || 1); }
    }
    const vx = -uz, vz = ux;
    let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
    for (const p of pts) {
      const u = p[0] * ux + p[1] * uz, v = p[0] * vx + p[1] * vz;
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
    const cx = cu * ux + cv * vx, cz = cu * uz + cv * vz;
    if (kindAt(cx, cz) === 3) continue;
    if (Math.hypot(cx - field.anchors.home[0], cz - field.anchors.home[1]) < 16) continue;
    const hw = Math.min(8, Math.max(1.6, (maxU - minU) / 2));
    const hd = Math.min(6.5, Math.max(1.4, (maxV - minV) / 2));
    const gy = groundY(cx, cz);
    const h = Math.min(7.5, Math.max(3.2, (b.h || 5) * 0.72));
    const c = b.c || [0.9, 0.84, 0.74];
    const wall = [c[0] * 0.92, c[1] * 0.88, c[2] * 0.84];
    const roofC = [Math.min(1, c[0] * 0.72), Math.min(1, c[1] * 0.42), Math.min(1, c[2] * 0.38)];
    const trim = [Math.min(1, c[0] * 1.08), Math.min(1, c[1] * 1.02), Math.min(1, c[2] * 0.9)];
    const win = [0.22, 0.28, 0.34];
    const door = [0.28, 0.16, 0.12];
    const P = (u, v, y) => [cx + ux * u + vx * v, y, cz + uz * u + vz * v];
    const addQuad = (A, B, C, D, rgb) => {
      const i0 = pos.length / 3;
      [A, B, C, D].forEach((p) => push(p[0], p[1], p[2], rgb[0], rgb[1], rgb[2]));
      quad(i0, i0 + 1, i0 + 2, i0 + 3);
    };
    const y0 = gy, y1 = gy + h;
    addQuad(P(-hw, -hd, y0), P(hw, -hd, y0), P(hw, -hd, y1), P(-hw, -hd, y1), wall);
    addQuad(P(hw, hd, y0), P(-hw, hd, y0), P(-hw, hd, y1), P(hw, hd, y1), wall);
    addQuad(P(-hw, hd, y0), P(-hw, -hd, y0), P(-hw, -hd, y1), P(-hw, hd, y1), wall);
    addQuad(P(hw, -hd, y0), P(hw, hd, y0), P(hw, hd, y1), P(hw, -hd, y1), wall);
    const ridge = y1 + Math.min(2.4, hw * 0.55);
    const iR0 = pos.length / 3;
    [P(-hw, 0, ridge), P(hw, 0, ridge), P(hw, -hd, y1), P(-hw, -hd, y1)].forEach((p) => push(p[0], p[1], p[2], roofC[0], roofC[1], roofC[2]));
    quad(iR0, iR0 + 1, iR0 + 2, iR0 + 3);
    const iR1 = pos.length / 3;
    [P(hw, 0, ridge), P(-hw, 0, ridge), P(-hw, hd, y1), P(hw, hd, y1)].forEach((p) => push(p[0], p[1], p[2], roofC[0], roofC[1], roofC[2]));
    quad(iR1, iR1 + 1, iR1 + 2, iR1 + 3);
    addQuad(P(-hw, -0.02, y1 - 0.18), P(hw, -0.02, y1 - 0.18), P(hw, -0.02, y1), P(-hw, -0.02, y1), trim);
    for (let k = -1; k <= 1; k++) {
      const u = k * hw * 0.42;
      addQuad(P(u - 0.28, -hd - 0.04, y0 + h * 0.42), P(u + 0.28, -hd - 0.04, y0 + h * 0.42), P(u + 0.28, -hd - 0.04, y0 + h * 0.72), P(u - 0.28, -hd - 0.04, y0 + h * 0.72), win);
    }
    addQuad(P(-0.32, -hd - 0.05, y0), P(0.32, -hd - 0.05, y0), P(0.32, -hd - 0.05, y0 + h * 0.38), P(-0.32, -hd - 0.05, y0 + h * 0.38), door);
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
  const lookYaw = Math.sin(time * 0.37) * 0.28 * idle;
  setBone('neck', 0, lookYaw * 0.35, 0);
  setBone('head', -0.05 + Math.sin(time * 0.7) * 0.03 * idle, lookYaw, 0);
  setBone('leftUpperLeg', swing * 0.72 * w, 0, 0);
  setBone('rightUpperLeg', -swing * 0.72 * w, 0, 0);
  setBone('leftLowerLeg', Math.max(0, -swing) * 1.2 * w, 0, 0);
  setBone('rightLowerLeg', Math.max(0, swing) * 1.2 * w, 0, 0);
  setBone('leftFoot', -Math.max(0, swing) * 0.35 * w, 0, 0);
  setBone('rightFoot', -Math.max(0, -swing) * 0.35 * w, 0, 0);
  const reel = playMode === 'fish' && typeof window.__aroReel === 'function' ? window.__aroReel() : '';
  if (playMode === 'fish') {
    const pull = (reel === 'reel' || reel === 'nibble') ? Math.sin(time * 8) * 0.28 : 0;
    const lift = (reel === 'fly' || reel === 'aim' || reel === 'wait' || reel === 'nibble') ? 1.05 : 0.55;
    setBone('leftUpperArm', -0.25, 0, 0.85);
    setBone('leftLowerArm', 0.35, 0.1, 0);
    setBone('rightUpperArm', -lift, 0.15, -0.35);
    setBone('rightLowerArm', -0.35 - pull, -0.05, 0);
  } else {
    setBone('leftUpperArm', swing * 0.5 * w, 0, 1.18);
    setBone('rightUpperArm', -swing * 0.5 * w, 0, -1.18);
    setBone('leftLowerArm', 0.15 + Math.max(0, swing) * 0.35 * w, 0.1, 0);
    setBone('rightLowerArm', 0.15 + Math.max(0, -swing) * 0.35 * w, -0.1, 0);
  }
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
  } else if (gpsTarget && playMode === 'world' && performance.now() > tapUntil) {
    x = gpsTarget.x - px; z = gpsTarget.z - pz;
    if (Math.hypot(x, z) < 0.7) { gpsTarget = null; return 0; }
    mode = 'gps';
  } else return 0;
  const len = Math.hypot(x, z) || 1;
  if (mode === 'keys') runHold += dt;
  else runHold = 0;
  const sprint = runHold > 0.38 || performance.now() < runUntil;
  const sp = (mode === 'gps' ? 4.2 : 3.15) * (sprint ? 1.62 : 1);
  const dx = (x / len) * sp * dt;
  const dz = (z / len) * sp * dt;
  let nx = px + dx, nz = pz + dz;
  if (blocked(nx, nz)) {
    if (!blocked(px + dx, pz)) nz = pz;
    else if (!blocked(px, pz + dz)) nx = px;
    else return 0;
  }
  const moved = Math.hypot(nx - px, nz - pz);
  if (moved > 0.0008) {
    const want = Math.atan2(nx - px, nz - pz);
    let turn = want - facing;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    facing += turn * Math.min(1, dt * 8);
  }
  px = nx; pz = nz;
  clampRoom();
  return moved / Math.max(dt, 0.001);
}
function clampRoom() {
  if (!indoors()) return;
  const s = SITES[playMode];
  if (!s) return;
  px = clamp(px, s.x - s.hw, s.x + s.hw);
  pz = clamp(pz, s.z - s.hd, s.z + s.hd + 0.35);
  if (pz > s.z + s.hd) exitPlay();
}

function placeAvatar(speed) {
  if (!avatar) return false;
  const y = standY(px, pz) + (avatar.userData.foot || 0);
  const prevX = avatar.userData.lx;
  const prevZ = avatar.userData.lz;
  let jump = prevX == null || Math.hypot(px - prevX, pz - prevZ) > 0.5;
  avatar.userData.lx = px;
  avatar.userData.lz = pz;
  if ((avatar.userData.warm | 0) > 0) {
    avatar.userData.warm -= 1;
    jump = true;
  }
  avatar.position.set(px, y, pz);
  avatar.rotation.y = facing;
  const bob = speed > 0.2 ? Math.abs(Math.sin(playerPose.phase * 2)) * 0.03 : Math.sin(worldT * 1.6) * 0.012;
  avatar.position.y += bob;
  if (blob) {
    blob.visible = !indoors();
    blob.position.set(px, standY(px, pz) + 0.04, pz);
  }
  return jump;
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
function aimCamera(x, y, z, lx, ly, lz) {
  wantCam.set(x, y, z);
  look.set(lx, ly, lz);
  const k = camInit ? 1 - Math.exp(-Math.max(0.016, lastDt) * 5.2) : 1;
  if (!camInit) {
    smoothCam.copy(wantCam);
    smoothLook.copy(look);
    camInit = true;
  } else {
    smoothCam.lerp(wantCam, k);
    smoothLook.lerp(look, k);
  }
  camera.position.copy(smoothCam);
  camera.lookAt(smoothLook);
  if (skyMat) skyMat.uniforms.uCam.value.copy(camera.position);
}
function frameRoom() {
  const y = standY(px, pz);
  if (playMode === 'fish' && field) {
    const fx = Math.sin(facing), fz = Math.cos(facing);
    aimCamera(px - fx * 4.6, y + 2.15, pz - fz * 4.6, px + fx * 8, y + 0.7, pz + fz * 8);
    return;
  }
  const s = SITES[playMode];
  if (!s) return;
  if (playMode === 'home' || playMode === 'house') {
    aimCamera(s.x + 7.2, 6.4, s.z + 8.4, s.x, 1.35, s.z - 0.4);
    return;
  }
  const cy = y + 1.5;
  const cp = Math.cos(0.42), spn = Math.sin(0.42);
  aimCamera(px + Math.sin(camYaw) * 9 * cp, cy + 9 * spn, pz + Math.cos(camYaw) * 9 * cp, px, cy, pz);
}
function frameCamera() {
  if (playMode !== 'world') { frameRoom(); return; }
  if (shot === 'close') { camDist = 4.2; camPitch = 0.32; }
  else if (shot === 'face') { camDist = 2.35; camPitch = 0.12; }
  else if (shot === 'walk') { camDist = 6.2; camPitch = 0.36; }
  else if (shot === 'wide') { camDist = 22; camPitch = 0.22; }
  else if (shot === 'sky') {
    const gy = groundY(px, pz);
    aimCamera(px - 1.2, gy + 1.7, pz + 2.4, px + 6, gy + 28, pz - 10);
    return;
  }
  else if (shot === 'grass') { camDist = 11; camPitch = 0.95; }
  else if (shot === 'home' && field) {
    const h = field.anchors.home;
    const gy = groundY(h[0], h[1]);
    const spot = nearestWalkable(h[0] + 9, h[1] + 2);
    px = spot[0]; pz = spot[1];
    aimCamera(h[0] + 13, gy + 14.2, h[1] + 11, h[0] - 0.4, gy + 15.6, h[1] - 1.2);
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
    aimCamera(spot[0], groundY(spot[0], spot[1]) + 8, spot[1], lake[0], 0.4, lake[1]);
    return;
  }
  const y = groundY(px, pz) + (shot === 'face' ? 1.42 : 1.55);
  const cp = Math.cos(camPitch), spn = Math.sin(camPitch);
  aimCamera(
    px + Math.sin(camYaw) * camDist * cp,
    y + camDist * spn,
    pz + Math.cos(camYaw) * camDist * cp,
    px, y, pz
  );
}

function onKey(e, down) {
  if (!active) return;
  if (down && (e.code === 'Digit1' || e.code === 'Digit2') && !document.querySelector('#simpleMenu.on, #spineBook.on')) {
    castSpell(e.code === 'Digit2' ? 'fire' : 'aether');
    return;
  }
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
  if (indoors() && roomFloors.length) {
    const hits = raycaster.intersectObjects(roomFloors, false);
    if (!hits.length) return null;
    return hits[0].point;
  }
  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) return null;
  const p = hits[0].point;
  if (blocked(p.x, p.z)) {
    if (playMode === 'world' && kindAt(p.x, p.z) === 3 && Math.hypot(px - p.x, pz - p.z) < 16) enterPlay('fish');
    return null;
  }
  return p;
}
function pickSpecial(ev) {
  aimPointer(ev);
  const list = gates.slice();
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
  if (pick.kind === 'room') {
    enterPlay(pick.id);
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
    const now = performance.now();
    if (now - (endPtr.last || 0) < 320) runUntil = now + 1700;
    endPtr.last = now;
    dest = { x: hit.x, z: hit.z };
    tapUntil = now + 2200;
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

function hairCard(name) {
  return /hair|eyelash|eyeline|brow|highlight|eyeextra/i.test(name || '');
}
function dressVRM(model) {
  VRMUtils.removeUnnecessaryVertices(model.scene);
  model.scene.traverse((o) => {
    o.frustumCulled = false;
    o.layers.set(1);
    let mats = o.material ? [].concat(o.material) : [];
    const hair = hairCard(o.name) || mats.some((m) => m && hairCard(m.name));
    if (hair && Array.isArray(o.material)) {
      const kept = o.material.filter((m) => !(m && m.isOutline));
      o.material = kept.length === 1 ? kept[0] : kept;
      mats = kept;
    }
    mats.forEach((m) => {
      if (!m) return;
      if (hair || hairCard(m.name)) {
        if (m.outlineWidthMode != null) m.outlineWidthMode = 'none';
        if (m.outlineWidthFactor != null) m.outlineWidthFactor = 0;
        m.transparent = false;
        m.depthWrite = true;
        m.depthTest = true;
        m.alphaTest = Math.max(m.alphaTest || 0, 0.4);
        m.side = THREE.DoubleSide;
        o.renderOrder = 2;
      } else if (m.outlineWidthFactor != null && m.outlineWidthFactor > 0 && m.outlineWidthFactor < 0.0022) {
        m.outlineWidthFactor = 0.0024;
      }
    });
  });
  if (model.lookAt) model.lookAt.autoUpdate = false;
  const box = new THREE.Box3().setFromObject(model.scene);
  const h = box.max.y - box.min.y || 1.6;
  const s = h > 2.4 ? 1.58 / h : 1;
  model.scene.scale.setScalar(s);
  if (model.springBoneManager) {
    model.springBoneManager.joints.forEach((j) => {
      j.settings.hitRadius = Math.min(0.045, j.settings.hitRadius * s);
    });
    model.scene.updateMatrixWorld(true);
    model.springBoneManager.setInitState();
  }
  return -box.min.y * s;
}
function stepSprings(model, dt, jump) {
  if (!model) return;
  if (model.scene) model.scene.updateMatrixWorld(true);
  const mgr = model.springBoneManager;
  if (mgr && (jump || dt > 0.045)) {
    mgr.reset();
    model.update(Math.min(Math.max(dt, 0), 1 / 60));
    return;
  }
  let left = Math.min(Math.max(dt, 0), 0.05);
  let guard = 0;
  while (left > 0.0001 && guard < 3) {
    const h = Math.min(left, 1 / 60);
    model.update(h);
    left -= h;
    guard++;
  }
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
    avatar.layers.set(1);
    scene.add(avatar);
    avatarReady = true;
    placeAvatar(0);
    avatar.userData.warm = 12;
    if (rod) avatar.add(rod);
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
      const lab = labelSprite('Test NPC · ' + spec.id, '#ffd2a8', [1.05, 0.26]);
      lab.position.y = 1.72;
      group.add(lab);
      scene.add(group);
      npcs.push({ id: spec.id, vrm: model, group, x: spot[0], z: spot[1], foot, pose: { amp: 0, phase: i }, warm: 12, hp: 3 });
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
  ramp.position.set(6.2, 0.55, 0);
  ramp.rotation.z = -0.55;
  ramp.userData.k = 0;
  homeRoot.add(stone, metal, ringA, ringB, ramp, hullOf(stone));
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const lx = Math.cos(a) * 6.3, lz = Math.sin(a) * 6.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), toonMat('#3a342c'));
    pole.position.set(lx, 1.15, lz);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7a0 }));
    lamp.position.set(lx, 2.05, lz);
    homeRoot.add(pole, lamp);
    lamps.push(lamp);
  }
  const nightLight = new THREE.PointLight(0xffe0a0, 0.12, 18);
  nightLight.position.y = 2.2;
  homeRoot.add(nightLight);
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
  const gondola = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toonMat('#c4a07a'));
  gondola.scale.set(1.15, 0.72, 2.15);
  gondola.position.set(0, -1.55, 0.15);
  const windowM = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 1.7), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  windowM.position.set(0, -1.48, 0.35);
  const lampIn = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7a0 }));
  lampIn.position.set(0, -1.35, 0.2);
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMat('#5a5048'));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.18), toonMat('#f2efe6'));
  const blade2 = blade.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(hub, blade, blade2);
  prop.position.set(0, 0, -4.55);
  const propR = prop.clone();
  propR.position.set(1.55, -0.15, -3.6);
  zep.add(hull, band, fin, finL, finR, gondola, windowM, lampIn, prop, propR, hullOf(hull));
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
  homeRoot.userData.ramp = ramp;
  homeRoot.userData.lamps = lamps;
  homeRoot.userData.nightLight = nightLight;
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
  const samples = 0;
  if (!rt || rt.width !== w || rt.height !== h) {
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { samples, depthTexture: new THREE.DepthTexture(w, h) });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    if (!composeScene) {
      const vert = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
      brightMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: { tDiffuse: { value: null } },
        vertexShader: vert,
        fragmentShader: `
          precision mediump float; uniform sampler2D tDiffuse; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            gl_FragColor = vec4(c * smoothstep(0.82, 1.0, l), 1.0);
          }`,
      });
      blurMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
        vertexShader: vert,
        fragmentShader: `
          precision mediump float; uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
          void main(){
            vec3 s = vec3(0.0); float wsum = 0.0;
            for (int i = -5; i <= 5; i++) {
              float w = 1.0 - abs(float(i)) / 6.0;
              s += texture2D(tDiffuse, vUv + uDir * float(i)).rgb * w;
              wsum += w;
            }
            gl_FragColor = vec4(s / wsum, 1.0);
          }`,
      });
      quadMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: {
          tDiffuse: { value: null },
          tBloom: { value: null },
          tDepth: { value: null },
          uTexel: { value: new THREE.Vector2() },
        },
        vertexShader: vert,
        fragmentShader: `
          precision mediump float;
          uniform sampler2D tDiffuse, tBloom, tDepth;
          uniform vec2 uTexel;
          varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float de = abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(-uTexel.x, 0.0)).r);
            de += abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(uTexel.x, 0.0)).r);
            de += abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(0.0, uTexel.y)).r);
            de += abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(0.0, -uTexel.y)).r);
            c = mix(c, vec3(0.08, 0.05, 0.06), smoothstep(0.012, 0.04, de) * 0.8);
            c += texture2D(tBloom, vUv).rgb * 0.32;
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
      composeScene = new THREE.Scene();
      composeScene.add(quad);
      composeCam = new THREE.Camera();
    }
  }
  const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
  if (!bloomA || bloomA.width !== hw || bloomA.height !== hh) {
    if (bloomA) bloomA.dispose();
    if (bloomB) bloomB.dispose();
    bloomA = new THREE.WebGLRenderTarget(hw, hh);
    bloomB = new THREE.WebGLRenderTarget(hw, hh);
  }
  const draw = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(composeScene, composeCam);
  };
  camera.layers.set(0);
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  brightMat.uniforms.tDiffuse.value = rt.texture;
  draw(brightMat, bloomA);
  blurMat.uniforms.tDiffuse.value = bloomA.texture;
  blurMat.uniforms.uDir.value.set(1.6 / hw, 0);
  draw(blurMat, bloomB);
  blurMat.uniforms.tDiffuse.value = bloomB.texture;
  blurMat.uniforms.uDir.value.set(0, 1.6 / hh);
  draw(blurMat, bloomA);
  quadMat.uniforms.tDiffuse.value = rt.texture;
  quadMat.uniforms.tBloom.value = bloomA.texture;
  if (rt.depthTexture) quadMat.uniforms.tDepth.value = rt.depthTexture;
  quadMat.uniforms.uTexel.value.set(1.2 / w, 1.2 / h);
  renderer.setRenderTarget(null);
  draw(quadMat, null);
  const gl = renderer.getContext();
  const src = renderer.properties.get(rt).__webglFramebuffer;
  if (gl.blitFramebuffer && src) {
    renderer.state.reset();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  camera.layers.set(1);
  renderer.autoClear = false;
  renderer.clear(false, false, false);
  renderer.render(scene, camera);
  camera.layers.enable(0);
  camera.layers.enable(1);
  renderer.autoClear = true;
}
function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  const narrow = window.innerWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function tick(dt, show) {
  active = !!show && !!renderer;
  document.body.classList.toggle('world-on', active);
  if (!active || !field) return;
  const step = Math.min(dt, 0.05);
  lastDt = step;
  worldT += step;
  if (playMode === 'fish') {
    const open = document.getElementById('fishM');
    if (open && !open.classList.contains('on')) exitPlay();
  }
  if (shot === 'walk' && !dest && playMode === 'world') dest = { x: px + 7, z: pz + 2.5 };
  const speed = steer(step);
  applyPose(vrm, worldT, step, speed, playerPose);
  const jumped = placeAvatar(speed);
  stepSprings(vrm, step, jumped);
  stepLife(step, speed);
  for (const n of npcs) {
    if (!n.vrm) continue;
    if ((n.warm | 0) > 0) n.warm -= 1;
    if ((n.down | 0) > 0) n.down = Math.max(0, n.down - step);
    else if ((n.hp | 0) <= 0) n.hp = 3;
    applyPose(n.vrm, worldT, step, 0, n.pose);
    n.group.position.y = standY(n.x, n.z) + n.foot - (n.down > 0 ? 0.45 : 0);
    n.group.rotation.y = Math.atan2(px - n.x, pz - n.z);
    const flash = n.flash > 0;
    if (flash) n.flash -= step;
    n.group.scale.setScalar(flash ? 1.08 : 1);
    stepSprings(n.vrm, step, (n.warm | 0) > 0);
  }
  if (homeRoot && homeRoot.userData.zep && playMode === 'world') {
    const pulse = 0.5 + 0.5 * Math.sin(worldT * 2.4);
    homeRoot.userData.rings[0].material.opacity = 0.45 + pulse * 0.5;
    homeRoot.userData.rings[1].material.opacity = 0.35 + (1 - pulse) * 0.55;
    homeRoot.userData.zep.position.y = 18 + Math.sin(worldT * 0.7) * 0.35;
    homeRoot.userData.zep.rotation.y = Math.sin(worldT * 0.22) * 0.08;
    for (const prop of homeRoot.userData.props || []) prop.rotation.z += step * 9;
    const sunT = window.__aroSun ? window.__aroSun() : 0.2;
    const night = sunT >= 0.88 || sunT < 0.15;
    const ramp = homeRoot.userData.ramp;
    if (ramp) {
      const h = field.anchors.home;
      const near = Math.hypot(px - h[0], pz - h[1]) < 12;
      ramp.userData.k += ((near ? 1 : 0) - ramp.userData.k) * Math.min(1, step * 2.2);
      ramp.rotation.z = -0.55 + ramp.userData.k * 0.42;
      ramp.position.y = 0.55 - ramp.userData.k * 0.34;
    }
    const glow = night ? 1 : 0.35;
    for (const lamp of homeRoot.userData.lamps || []) lamp.scale.setScalar(0.8 + glow * 0.55);
    if (homeRoot.userData.nightLight) homeRoot.userData.nightLight.intensity = night ? 1.7 : 0.1;
  }
  if (grassMesh) {
    grassMesh.material.uniforms.uTime.value = worldT;
    if (playMode === 'world' && ((worldT * 4) | 0) !== (grassMesh.userData.step | 0)) {
      grassMesh.userData.step = (worldT * 4) | 0;
      cullGrass(false);
    }
  }
  stepProps(step);
  syncAnchor();
  if (waterMat) waterMat.uniforms.uTime.value = worldT;
  applySky();
  syncHolo();
  frameCamera();
  renderWorld();
  if (avatarReady && api.npcsReady) hideLoad();
}

function syncHolo() {
  const h = holoLevel();
  if (skyMat && skyMat.uniforms.uHolo) skyMat.uniforms.uHolo.value = h;
  if (groundHolo) {
    groundHolo.uniforms.uTime.value = worldT;
    groundHolo.uniforms.uHolo.value = h;
    groundHolo.uniforms.uOrigin.value.set(px, pz);
  }
}
function shoreSpot() {
  const lake = field.anchors.lake;
  let best = null;
  let bestD = 1e9;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const x = lake[0] + Math.cos(a) * 30;
    const z = lake[1] + Math.sin(a) * 22;
    const spot = nearestWalkable(x, z);
    const d = Math.hypot(spot[0] - lake[0], spot[1] - lake[1]);
    if (d < bestD && !blocked(spot[0], spot[1])) { bestD = d; best = spot; }
  }
  return best || nearestWalkable(lake[0], lake[1] + 28);
}
function parkNpcs(on) {
  const s = SITES.arena;
  npcs.forEach((n, i) => {
    if (!n.group) return;
    if (!n.home) n.home = { x: n.x, z: n.z };
    if (on) {
      n.x = s.x + (i ? 2.4 : -2.4);
      n.z = s.z - 1.6;
      n.hp = 3;
      n.down = 0;
    } else {
      n.x = n.home.x;
      n.z = n.home.z;
    }
    n.group.position.set(n.x, standY(n.x, n.z) + n.foot, n.z);
  });
}
function enterPlay(id) {
  if (!SITES[id] && id !== 'fish') return;
  if (playMode === id) return;
  if (playMode === 'fish' && typeof window.__aroFishClose === 'function') window.__aroFishClose();
  if (playMode === 'arena') parkNpcs(false);
  if (playMode === 'world') playSaved = { x: px, z: pz, f: facing };
  playMode = id;
  camInit = false;
  shot = '';
  dest = null;
  if (id === 'fish') {
    const spot = shoreSpot();
    px = spot[0];
    pz = spot[1];
    const lake = field.anchors.lake;
    facing = Math.atan2(lake[0] - px, lake[1] - pz);
    if (avatar) avatar.userData.warm = 6;
    if (typeof window.__aroOpenFish === 'function') window.__aroOpenFish();
    return;
  }
  const s = SITES[id];
  px = s.x;
  pz = s.z + 0.35;
  facing = Math.PI;
  if (avatar) avatar.userData.warm = 6;
  if (id === 'arena') parkNpcs(true);
}
function exitPlay() {
  if (playMode === 'world') return false;
  const was = playMode;
  playMode = 'world';
  if (was === 'arena') parkNpcs(false);
  if (was === 'fish' && typeof window.__aroFishClose === 'function') window.__aroFishClose();
  if (playSaved) {
    px = playSaved.x;
    pz = playSaved.z;
    facing = playSaved.f;
    playSaved = null;
  }
  camInit = false;
  shot = '';
  dest = null;
  if (avatar) avatar.userData.warm = 4;
  return true;
}
function handWorld(which) {
  const v = new THREE.Vector3(px, standY(px, pz) + 1.15, pz);
  if (!vrm || !vrm.humanoid) return v;
  const bone = vrm.humanoid.getNormalizedBoneNode(which === 'l' ? 'leftHand' : 'rightHand');
  if (bone) bone.getWorldPosition(v);
  return v;
}
function castSpell(kind) {
  const origin = handWorld(kind === 'fire' ? 'r' : 'l');
  const dir = new THREE.Vector3(Math.sin(facing), 0.06, Math.cos(facing)).normalize();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(kind === 'fire' ? 0.28 : 0.2, 8, 6),
    new THREE.MeshBasicMaterial({ color: kind === 'fire' ? 0xff6a2a : 0xffd36a })
  );
  mesh.position.copy(origin);
  scene.add(mesh);
  const embers = [];
  if (kind === 'fire') {
    for (let i = 0; i < 4; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      e.position.copy(origin);
      scene.add(e);
      embers.push(e);
    }
  }
  bolts.push({ kind, p: origin.clone(), v: dir.multiplyScalar(kind === 'fire' ? 6.5 : 8), life: 1.3, mesh, embers });
}
function hurtNpc(p) {
  if (playMode !== 'arena') return;
  for (const n of npcs) {
    if (!n.group || (n.hp | 0) <= 0) continue;
    if (Math.hypot(p.x - n.x, p.z - n.z) < 1.25 && Math.abs(p.y - 1.1) < 1.5) {
      n.hp -= 1;
      n.flash = 0.25;
      if (n.hp <= 0) n.down = 2.4;
    }
  }
}
function stepProps(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
    b.p.addScaledVector(b.v, dt);
    b.mesh.position.copy(b.p);
    b.embers.forEach((e, k) => {
      e.position.set(b.p.x + Math.sin(worldT * 18 + k) * 0.12, b.p.y + (k - 1.5) * 0.06, b.p.z);
    });
    hurtNpc(b.p);
    if (b.life <= 0) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      b.embers.forEach((e) => { scene.remove(e); e.geometry.dispose(); e.material.dispose(); });
      bolts.splice(i, 1);
    }
  }
  for (const bee of bees) {
    const a = worldT * 1.4 + bee.userData.a;
    bee.position.set(Math.cos(a) * bee.userData.r, 1.35 + Math.sin(a * 2) * 0.18, Math.sin(a * 0.9) * bee.userData.r);
    bee.rotation.y = -a;
  }
  if (rod) {
    rod.visible = playMode === 'fish';
    if (rodLine) rodLine.visible = rod.visible;
    if (rod.visible && avatar && vrm && vrm.humanoid) {
      const hand = vrm.humanoid.getNormalizedBoneNode('rightHand');
      if (hand) {
        const w = hand.getWorldPosition(new THREE.Vector3());
        avatar.worldToLocal(w);
        rod.position.copy(w);
        const reel = typeof window.__aroReel === 'function' ? window.__aroReel() : '';
        const out = reel === 'fly' || reel === 'wait' || reel === 'nibble' || reel === 'reel';
        if (rodLine) {
          rodLine.visible = out;
          rodLine.scale.set(1, out ? 1 : 0.2, 1);
          rodLine.position.set(0.1, 0.85, 0.55);
        }
      }
    }
  }
}
function cutaway(id, w, d, h, wall, floor) {
  const s = SITES[id];
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), toonMat(floor));
  fl.position.y = -0.08;
  roomFloors.push(fl);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), toonMat(wall));
  back.position.set(0, h * 0.5, -d * 0.5);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, d), toonMat(wall));
  left.position.set(-w * 0.5, h * 0.5, 0);
  const right = left.clone();
  right.position.x = w * 0.5;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.12), toonMat('#6b3a28'));
  door.position.set(0, 1.05, d * 0.5 - 0.08);
  const sign = labelSprite('Back', '#9ee7ff', [1.1, 0.28]);
  sign.position.set(0, 2.45, d * 0.5);
  g.add(fl, back, left, right, door, sign);
  g.userData.pick = { kind: 'room', id: 'world', x: s.x, z: s.z + d * 0.5 };
  scene.add(g);
  return g;
}
function buildSites() {
  const home = cutaway('home', 8.2, 7, 3.3, '#f3e4cf', '#d7c2a4');
  const hive = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), toonMat('#e7b15a'));
  hive.position.set(-2.2, 0.7, -2.2);
  const hiveTop = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 6), toonMat('#c4554a'));
  hiveTop.position.set(-2.2, 1.2, -2.2);
  home.add(hive, hiveTop);
  const beeBody = new THREE.SphereGeometry(0.08, 6, 5);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(beeBody, toonMat(i % 2 ? '#ffd36a' : '#f4fbff'));
    body.scale.set(0.7, 0.7, 1.4);
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    wing.position.y = 0.05;
    b.add(body, wing);
    b.userData = { a: i * 1.2, r: 0.55 + (i % 3) * 0.18 };
    hive.add(b);
    bees.push(b);
  }
  for (let i = 0; i < 4; i++) {
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
    vial.position.set(1.4 + (i % 2) * 0.22, 0.7, -2.3 + Math.floor(i / 2) * 0.22);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.36, 6), new THREE.MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.35 }));
    glass.position.copy(vial.position);
    home.add(vial, glass);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.46), toonMat('#8a6244'));
  shelf.position.set(1.55, 0.52, -2.2);
  const queen = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.12, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  queen.position.set(0.2, 0.08, -1.2);
  const queenLab = labelSprite('Queen', '#ffd978', [1.15, 0.28]);
  queenLab.position.set(0.2, 0.7, -1.2);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.9), toonMat('#f2d2c4'));
  bed.position.set(-2.3, 0.2, 0.8);
  home.add(shelf, queen, queenLab, bed, labelSprite('Hive', '#b6f5a8', [1, 0.26]));
  home.children[home.children.length - 1].position.set(-2.2, 1.7, -2.2);

  const house = cutaway('house', 7.4, 6.4, 3.1, '#efe2d2', '#cbb89a');
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.8), toonMat('#a87848'));
  table.position.set(0, 0.7, -1.4);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), toonMat('#6d4a32'));
  leg.position.set(0, 0.35, -1.4);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.1, 6), toonMat('#c4554a'));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.02;
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0xbfe9ff }));
  win.position.set(0, 1.8, -3.15);
  house.add(table, leg, rug, win, labelSprite('House', '#ffd2a8', [1.1, 0.26]));
  house.children[house.children.length - 1].position.set(0, 2.5, -2.4);

  const market = cutaway('market', 22, 16, 3.6, '#f7efe2', '#e6d3b0');
  const stallColors = ['#c4554a', '#3d8fd1', '#e7b15a', '#6aaa54'];
  stallColors.forEach((col, i) => {
    const stall = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.2), toonMat('#d8c4a4'));
    base.position.y = 0.5;
    const awn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 1.5), toonMat(col));
    awn.position.y = 1.7;
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 5), toonMat('#6d4a32'));
    postL.position.set(-1.1, 0.85, 0.6);
    const postR = postL.clone();
    postR.position.x = 1.1;
    stall.add(base, awn, postL, postR);
    const colI = i % 2;
    const row = Math.floor(i / 2);
    stall.position.set(-4 + colI * 6, 0, -3.2 - row * 3.2);
    market.add(stall);
  });
  const marketLab = labelSprite('Market', '#ffd978', [1.4, 0.3]);
  marketLab.position.set(0, 2.6, -6);
  market.add(marketLab);

  const arena = cutaway('arena', 18, 14, 3.4, '#2a3348', '#3c465c');
  for (let i = 0; i < 7; i++) {
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.08, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7ff0ff : 0xffd36a, transparent: true, opacity: 0.28 }));
    const a = (i / 7) * Math.PI * 2;
    hex.position.set(Math.cos(a) * 3.2, 0.06, Math.sin(a) * 2.4);
    arena.add(hex);
  }
  const arenaLab = labelSprite('Sparring', '#9ee7ff', [1.4, 0.3]);
  arenaLab.position.set(0, 2.4, -4);
  arena.add(arenaLab);

  const homeA = field.anchors.home;
  const houseAt = nearestWalkable(homeA[0] + 26, homeA[1] + 8);
  const marketAt = nearestWalkable(homeA[0] - 18, homeA[1] + 22);
  addGate(houseAt[0], houseAt[1], 'house', 'House');
  addGate(marketAt[0], marketAt[1], 'market', 'Market');
  rod = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.7, 5), toonMat('#c4a07a'));
  pole.rotation.z = 0.5;
  pole.position.set(0.15, 0.7, 0.15);
  rodLine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.4, 4), new THREE.MeshBasicMaterial({ color: 0xe9fbff }));
  rodLine.rotation.x = 0.9;
  rod.add(pole, rodLine);
  rod.visible = false;
  if (avatar) avatar.add(rod);
}
function addGate(x, z, id, text) {
  const g = new THREE.Group();
  g.position.set(x, groundY(x, z), z);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.2, 0.16), toonMat('#6b3a28'));
  frame.position.y = 1.1;
  const lab = labelSprite(text, '#ffd978', [1.2, 0.28]);
  lab.position.y = 2.5;
  g.add(frame, lab);
  g.userData.pick = { kind: 'room', id, x, z };
  gates.push(g);
  scene.add(g);
}
const api = {
  ready: false,
  avatarReady: false,
  npcsReady: false,
  tick,
  key: onKey,
  pose(name) { shot = name || ''; if (!name) camInit = false; },
  where() { return { x: px, z: pz, facing, avatarReady, active, mode: playMode }; },
  enter: enterPlay,
  exit: exitPlay,
  cast: castSpell,
  mode() { return playMode; },
  keepsWorld() { return playMode !== 'world'; },
  fishing() { return playMode === 'fish'; },
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
  buildLife();
  buildBuildings();
  const a = data.anchors;
  addMarker(a.garden[0], a.garden[1], 'Garden hive', '#b6f5a8');
  addMarker(a.lake[0], a.lake[1], 'Long Lake', '#9ad8ff');
  buildHome(a.home[0], a.home[1]);
  buildSites();
  if (rod && avatar) avatar.add(rod);
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
  scene.fog = new THREE.Fog(0xffe3c4, 55, 340);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  clock = new THREE.Clock();
  hemi = new THREE.HemisphereLight(0xcfeaff, 0x6a8a48, 0.85);
  sun = new THREE.DirectionalLight(0xfff4d2, 1.3);
  sun.position.set(30, 40, 16);
  scene.add(hemi, sun);
  hemi.layers.enable(1);
  sun.layers.enable(1);
  const rim = new THREE.DirectionalLight(0xcfe8ff, 0.55);
  rim.position.set(-24, 16, -18);
  rim.layers.enable(1);
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
      uHolo: { value: 1 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision mediump float;
      varying vec3 vW;
      uniform vec3 uTop,uHor,uBot,uCam;
      uniform float uTime, uHolo;
      vec2 holoHash2(vec2 p){
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }
      float holoHash(vec2 p){ return holoHash2(p).x; }
      vec3 holoHex(vec2 p, float scale){
        vec2 uv = p / scale;
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = uv - gv;
        float hd = max(abs(gv.x), abs(gv.x) * 0.5 + abs(gv.y) * 0.8660254);
        return vec3(id, 0.5 - hd);
      }
      void main(){
        vec3 dir = normalize(vW - uCam);
        float hgt = dir.y;
        vec3 c = mix(uBot, uHor, smoothstep(-0.15, 0.22, hgt));
        c = mix(c, uTop, smoothstep(0.08, 0.72, hgt));
        vec2 cuv = dir.xz / max(0.2, hgt + 0.45);
        float n = sin(cuv.x * 2.2 + uTime * 0.04) * sin(cuv.y * 1.8);
        n += sin(cuv.x * 5.5 + 2.0) * sin(cuv.y * 4.8 + uTime * 0.06) * 0.65;
        float puffA = smoothstep(0.62, 0.78, n * 0.5 + 0.55);
        float puffB = smoothstep(0.7, 0.86, sin(cuv.x * 9.0 + 4.0) * sin(cuv.y * 8.0) * 0.5 + 0.5);
        float cloud = max(puffA, puffB * 0.85);
        cloud *= smoothstep(0.12, 0.42, hgt);
        vec3 puff = mix(uHor, vec3(1.0, 0.98, 0.96), 0.75);
        c = mix(c, puff, cloud * 0.8);
        vec2 suv = vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0))) * vec2(2.15, 3.1);
        vec3 hcell = holoHex(suv, 0.42);
        vec2 hid = hcell.xy; float hedge = hcell.z;
        float above = smoothstep(0.06, 0.28, hgt) * (1.0 - cloud * 0.65);
        float hline = 1.0 - smoothstep(0.02, 0.07, hedge);
        vec3 panel = mix(vec3(0.45, 0.95, 1.0), vec3(1.0, 0.8, 0.4), step(0.62, holoHash(hid)));
        c = mix(c, panel, hline * 0.07 * above * uHolo);
        float miss = step(0.965, holoHash(hid + 2.0));
        float flick = step(0.93, holoHash(hid + 8.0)) * step(0.55, fract(uTime * (1.4 + holoHash(hid) * 2.5) + holoHash(hid + 1.0)));
        vec3 voidCol = vec3(0.012, 0.018, 0.05);
        voidCol += vec3(0.75, 0.88, 1.0) * step(0.992, holoHash(floor(suv * 26.0)));
        c = mix(c, voidCol, max(miss, flick) * above * uHolo * 0.92);
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
  fetch(FIELD_URL).then((r) => r.json()).then((data) => { setLoad(0.1, 'Loading the town…'); bootField(data); }).catch((err) => { console.error(err); });
}

boot();
