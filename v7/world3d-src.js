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
let camDist = 8.2;
let camPitch = 0.58;
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
  const j = 0.94 + (Math.sin(x * 0.37) * Math.cos(z * 0.29) * 0.5 + 0.5) * 0.1;
  return [base[0] * j, base[1] * j, base[2] * j];
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

  const wpos = [];
  const wuv = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r * cols + c] !== 3) continue;
    const x0 = minx + c * cell, z0 = minz + r * cell, y = -0.16;
    const u = c / cols, v = r / rows;
    wpos.push(
      x0, y, z0, x0 + cell, y, z0, x0, y, z0 + cell,
      x0 + cell, y, z0, x0 + cell, y, z0 + cell, x0, y, z0 + cell
    );
    wuv.push(u, v, u + 1 / cols, v, u, v + 1 / rows, u + 1 / cols, v, u + 1 / cols, v + 1 / rows, u, v + 1 / rows);
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wgeo.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
  wgeo.computeVertexNormals();
  waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      void main(){
        float w = sin(vUv.x * 90.0 + uTime * 1.3) * sin(vUv.y * 70.0 - uTime * 0.9);
        float band = smoothstep(-0.15, 0.55, w);
        vec3 deep = vec3(0.05, 0.32, 0.62);
        vec3 lit = vec3(0.45, 0.82, 0.95);
        vec3 foam = vec3(0.85, 0.96, 1.0);
        vec3 c = mix(deep, lit, band);
        c = mix(c, foam, smoothstep(0.72, 0.95, w) * 0.55);
        gl_FragColor = vec4(c, 0.92);
      }`,
  });
  water = new THREE.Mesh(wgeo, waterMat);
  water.frustumCulled = false;
  scene.add(water);
}

function paintGeo(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function buildTrees() {
  const trunk = paintGeo(new THREE.CylinderGeometry(0.11, 0.18, 1.35, 5), '#6b4630');
  trunk.translate(0, 0.68, 0);
  const leaf = paintGeo(new THREE.ConeGeometry(0.95, 1.7, 6), '#2f8a45');
  leaf.translate(0, 1.95, 0);
  const tip = paintGeo(new THREE.ConeGeometry(0.62, 1.15, 6), '#7dce62');
  tip.translate(0, 2.7, 0);
  const merged = mergeGeometries([trunk, leaf, tip]);
  const spots = [];
  const home = field.anchors.home;
  for (let i = 0; i < grid.length; i += 7) {
    const k = grid[i];
    if (k !== 1 && k !== 2 && k !== 0) continue;
    if (k === 0 && i % 28 !== 0) continue;
    const c = i % field.cols, r = (i / field.cols) | 0;
    const x = field.minx + (c + 0.5) * field.cell;
    const z = field.minz + (r + 0.5) * field.cell;
    if (kindAt(x, z) === 4 || kindAt(x, z) === 5 || kindAt(x, z) === 3) continue;
    if (Math.hypot(x - home[0], z - home[1]) < 18) continue;
    if (k === 0 && Math.hypot(x - home[0], z - home[1]) > 140) continue;
    spots.push(x, z);
    if (spots.length >= 160) break;
  }
  if (!spots.length) return;
  const mesh = new THREE.InstancedMesh(merged, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }), spots.length / 2);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < spots.length; i += 2) {
    const s = 0.85 + ((i * 17) % 10) / 18;
    dummy.position.set(spots[i], groundY(spots[i], spots[i + 1]), spots[i + 1]);
    dummy.rotation.y = (i * 0.7) % (Math.PI * 2);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i / 2, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  const blade = new THREE.PlaneGeometry(0.35, 0.55);
  blade.translate(0, 0.28, 0);
  const grassMat = toonMat('#8ed45a');
  grassMat.side = THREE.DoubleSide;
  const grass = new THREE.InstancedMesh(blade, grassMat, 80);
  let n = 0;
  const hx = field.anchors.home[0], hz = field.anchors.home[1];
  for (let i = 0; i < grid.length && n < 80; i += 37) {
    const k = grid[i];
    if (k !== 0 && k !== 1) continue;
    const c = i % field.cols, r = (i / field.cols) | 0;
    const x = field.minx + (c + 0.5) * field.cell;
    const z = field.minz + (r + 0.5) * field.cell;
    if (Math.hypot(x - hx, z - hz) > 70 && k !== 1) continue;
    dummy.position.set(x, groundY(x, z), z);
    dummy.rotation.y = i;
    dummy.scale.set(1, 0.7 + (i % 5) * 0.12, 1);
    dummy.updateMatrix();
    grass.setMatrixAt(n++, dummy.matrix);
  }
  grass.count = n;
  grass.instanceMatrix.needsUpdate = true;
  scene.add(grass);
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
  else if (shot === 'wide') { camDist = 36; camPitch = 0.82; }
  else if (shot === 'home' && field) {
    const h = field.anchors.home;
    const gy = groundY(h[0], h[1]);
    const spot = nearestWalkable(h[0] + 9, h[1] + 2);
    px = spot[0]; pz = spot[1];
    look.set(h[0], gy + 8, h[1]);
    camera.position.set(h[0] + 22, gy + 6, h[1] + 16);
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
  const y = groundY(px, pz) + 1.25;
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
function loadVRM(url, ok, fail) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(url, (gltf) => {
    const model = gltf.userData.vrm;
    if (!model) { if (fail) fail(); return; }
    ok(model);
  }, undefined, () => { if (fail) fail(); });
}
function loadAvatar() {
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
  }, () => { api.avatarReady = 'error'; });
}
function loadNpcs() {
  let left = NPC_URLS.length;
  const done = () => { if (--left <= 0) api.npcsReady = true; };
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
function buildHome(x, z) {
  const y = groundY(x, z);
  homeRoot = new THREE.Group();
  homeRoot.position.set(x, y, z);
  homeRoot.userData.pick = { kind: 'home', x, z };
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.5, 0.32, 6), toonMat('#3a2c1c'));
  deck.position.y = 0.16;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, 0.08, 6), toonMat('#6d5434'));
  top.position.y = 0.34;
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.9, depthWrite: false });
  const glow2 = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.8, depthWrite: false });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.09, 6, 40), glow);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 6, 28), glow2);
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.x = Math.PI / 2;
  ringA.position.y = ringB.position.y = 0.46;
  const zep = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), toonMat('#f6f1e6'));
  hull.scale.set(1.55, 1.05, 4.6);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 8.2), toonMat('#ffd36a'));
  stripe.position.y = 0.85;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.15), toonMat('#c4554a'));
  fin.position.set(0, 0.85, -4.15);
  const finL = fin.clone();
  finL.position.set(-1.15, 0.15, -3.9);
  finL.rotation.z = 0.6;
  finL.scale.set(1, 0.65, 0.75);
  const finR = fin.clone();
  finR.position.set(1.15, 0.15, -3.9);
  finR.rotation.z = -0.6;
  finR.scale.set(1, 0.65, 0.75);
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 2.2), toonMat('#241c16'));
  gondola.position.set(0, -1.45, 0.2);
  zep.add(hull, stripe, fin, finL, finR, gondola);
  zep.position.y = 16;
  const tether = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 14.2, 5),
    new THREE.MeshBasicMaterial({ color: 0xffd36a })
  );
  tether.position.y = 7.4;
  homeRoot.add(deck, top, ringA, ringB, zep, tether);
  const sign = labelSprite('Home', '#ffd978');
  sign.position.y = 7.2;
  homeRoot.add(sign);
  homeRoot.userData.rings = [ringA, ringB];
  homeRoot.userData.zep = zep;
  homeRoot.userData.tether = tether;
  scene.add(homeRoot);
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
    homeRoot.userData.zep.position.y = 16 + Math.sin(worldT * 0.7) * 0.35;
    homeRoot.userData.zep.rotation.y = Math.sin(worldT * 0.22) * 0.12;
  }
  syncAnchor();
  if (waterMat) waterMat.uniforms.uTime.value = worldT;
  applySky();
  frameCamera();
  renderer.render(scene, camera);
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
  const start = nearestWalkable(home[0] + 6, home[1] + 3);
  px = start[0]; pz = start[1];
  buildGround();
  buildTrees();
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
  scene.fog = new THREE.Fog(0xffe3c4, 70, 560);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  clock = new THREE.Clock();
  hemi = new THREE.HemisphereLight(0xcfeaff, 0x6a8a48, 0.85);
  sun = new THREE.DirectionalLight(0xfff4d2, 1.3);
  sun.position.set(30, 40, 16);
  scene.add(hemi, sun);
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
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision mediump float;
      varying vec3 vW;
      uniform vec3 uTop,uHor,uBot,uCam;
      void main(){
        float h = normalize(vW - uCam).y;
        vec3 c = mix(uBot, uHor, smoothstep(-0.25, 0.12, h));
        c = mix(c, uTop, smoothstep(0.02, 0.65, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 16, 10), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  bindInput(canvas);
  window.addEventListener('resize', resize);
  resize();
  fetch(FIELD_URL).then((r) => r.json()).then(bootField).catch(() => {});
}

boot();
