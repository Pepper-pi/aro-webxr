/* Toon fight layer for the training yard and the raid start.
   One directional light. Instanced hexes. Pooled rain, bolts, and bursts.
   No post-processing. The 2D canvas underneath keeps the disc, the forearm
   mark, and the existing controls. This view does not open a WebXR session. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './gltf-loader.js';

const SQ3 = Math.sqrt(3);
const BOSS_MAX = 90;
const RAIN = 48;
const BOLTS = 6;

const state = {
  on: false,
  bossHp: BOSS_MAX,
  bossMax: BOSS_MAX,
  flash: 0,
  kick: 0,
  muzzle: 0,
  reload: 0,
  cast: 0,
  t: 0,
  sky: 0,
  practice: false,
  hexes: 0,
  built: false,
  guard: 0,
  wardN: -1,
  nova: 0,
  novaAt: { x: 0, z: 0 },
  flare: 0,
  flareAt: { x: 0, z: 0 },
};

let renderer, scene, camera, sun, grad;
let hexMesh, hexInk, edgeMesh, rainMesh;
let hands, rifle, glass, rune, boss, bossWire, bossEyes, bossBar, boltSky, streak;
let kingPlate, kingPaint, kingHolo, kingShadow;
let boarPlate, boarPaint, boarHolo, boarShadow;
let parkPlate, parkPaint;
let raidFloor, raidDress, raidPit, raidIce, raidSky;
const RAID_PIT = { x: -0.7, z: 0.15, r: 1.65, depth: 2.05 };
const parkDir = new THREE.Vector3();
const parkAt = new THREE.Vector3();
const BOAR_PULL = 2.15;
const BOAR_Y = 1.28;
let reticle, petFollow, petSphere, slamRing;
let wardMesh, wardShell, novaRing, slashBar, fragMesh, turretMesh, droneMesh, flareMark;
const petRigs = {};
const posts = [];
const mobBlobs = [];
const weatherBlobs = [];
const weatherBeasts = [];
const weatherFolk = [];
const rigActors = [];
let rigWire = null;
let rigGlass = null;
let mobsReady = false;
const bolts = [];
const bursts = [];
const wallBits = [];
const seen = new WeakSet();
const dummy = new THREE.Object3D();
const color = new THREE.Color();

function gradMap() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 1;
  const g = c.getContext('2d');
  g.fillStyle = '#8d8d99'; g.fillRect(0, 0, 1, 1);
  g.fillStyle = '#ffffff'; g.fillRect(1, 0, 1, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
const mats = new Map();
function toon(hex, extra) {
  const key = hex + JSON.stringify(extra || {});
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshToonMaterial(Object.assign({ color: hex, gradientMap: grad }, extra || {}));
  mats.set(key, m);
  return m;
}
const INK = new THREE.MeshBasicMaterial({ color: 0x140810, side: THREE.BackSide });
let glowMap;
const glowMats = {};
function glowTex() {
  if (glowMap) return glowMap;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,.95)');
  grd.addColorStop(0.4, 'rgba(255,255,255,.28)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  glowMap = new THREE.CanvasTexture(c);
  return glowMap;
}
function glowMat(hex) {
  const key = hex && hex.isColor ? hex.getHexString() : String(hex);
  if (!glowMats[key]) {
    glowMats[key] = new THREE.SpriteMaterial({
      map: glowTex(), color: hex && hex.isColor ? hex.getHex() : hex, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.9,
    });
  }
  return glowMats[key];
}
function halo(hex, x, y, z, s) {
  const sp = new THREE.Sprite(glowMat(hex));
  sp.position.set(x, y, z);
  sp.scale.set(s, s, 1);
  scene.add(sp);
  return sp;
}
function ink(mesh, s) {
  const g = mesh.geometry.clone();
  g.scale(s || 1.07, s || 1.07, s || 1.07);
  mesh.add(new THREE.Mesh(g, INK));
  return mesh;
}
function part(geo, mat, x, y, z, parent) {
  const m = ink(new THREE.Mesh(geo, mat));
  m.position.set(x, y, z);
  (parent || scene).add(m);
  return m;
}

function game() {
  const aro = window.__aro, tr = window.__train;
  if (!aro || !tr) return null;
  return { G: aro.G, AR: aro.AR, TRAIN: tr.TRAIN };
}
function live() {
  const g = game();
  if (!g || !g.G || g.G.scene !== 'arena') return false;
  if (document.body.classList.contains('home-in')) return false;
  if (g.TRAIN && g.TRAIN.area === 'Market') return false;
  if (g.TRAIN && g.TRAIN.on) return true;
  return g.AR.kind === 'raid' && (g.AR.phase === 'block' || g.AR.phase === 'wave' || g.AR.phase === 'arm');
}
function hexOf(q, r) { return { x: SQ3 * (q + r / 2), z: 1.5 * r }; }

const hexCells = [];
const halos = [];
const cracks = [];
const scatterProps = [];
const areaDress = { Forest: [], Meadow: [], Stone: [] };
const DRESS_SPOTS = [[-1, 0], [1, 0], [0, -1], [-2, 0], [2, -1], [-1, -1]];
function buildHexes() {
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) {
    const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
    if (dist <= 3) hexCells.push({ q, r });
  }
  state.hexes = hexCells.length;
  const top = new THREE.CylinderGeometry(0.94, 0.98, 0.14, 6);
  const rim = new THREE.CylinderGeometry(1.02, 1.02, 0.05, 6, 1, true);
  const inkGeo = top.clone(); inkGeo.scale(1.05, 1.5, 1.05);
  hexMesh = new THREE.InstancedMesh(top, toon('#3a4c66'), hexCells.length);
  hexInk = new THREE.InstancedMesh(inkGeo, INK.clone(), hexCells.length);
  edgeMesh = new THREE.InstancedMesh(rim, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), hexCells.length);
  hexCells.forEach(() => halos.push(halo('#3de0ff', 0, 0, 0, 1.05)));
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.22), new THREE.MeshBasicMaterial({ color: 0xff4466 }));
    crack.rotation.x = -Math.PI / 2;
    crack.visible = false;
    scene.add(crack);
    cracks.push(crack);
  }
  for (let i = 0; i < 5; i++) {
    const prop = new THREE.Mesh(i % 2 ? new THREE.SphereGeometry(0.16, 8, 6) : new THREE.BoxGeometry(0.28, 0.22, 0.28), toon(i % 2 ? '#e6c07a' : '#6a4030'));
    prop.visible = false;
    scene.add(prop);
    scatterProps.push(prop);
  }
  DRESS_SPOTS.forEach((_, i) => {
    areaDress.Forest.push(dressTree(i));
    areaDress.Meadow.push(dressMeadow(i));
    areaDress.Stone.push(dressStone(i));
  });
  scene.add(hexMesh, hexInk, edgeMesh);
  buildRaidFloor();
  paintField(null);
}
function buildRaidFloor() {
  const tex = new THREE.TextureLoader().load('raid_floor.png?v=3');
  tex.colorSpace = THREE.SRGBColorSpace;
  raidFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(28.4, 16),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
  );
  raidFloor.rotation.x = -Math.PI / 2;
  raidFloor.position.set(0, 0.1, -2.6);
  raidFloor.visible = false;
  raidFloor.renderOrder = 1;
  scene.add(raidFloor);
  raidDress = new THREE.Group();
  raidDress.visible = false;
  raidPit = buildRaidPit();
  raidIce = buildRaidIce();
  raidSky = buildRaidSky();
  raidDress.add(raidPit, raidIce, raidSky);
  scene.add(raidDress);
}
function raidHexShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
}
function buildRaidPit() {
  const g = new THREE.Group();
  g.position.set(RAID_PIT.x, 0, RAID_PIT.z);
  const R = RAID_PIT.r;
  const depth = RAID_PIT.depth;
  const ap = R * Math.cos(Math.PI / 6);
  const notch = [0.18, 0.9, 1, 1, 1, 0.9];
  const stone = new THREE.MeshBasicMaterial({ color: 0x1a2436, side: THREE.DoubleSide });
  const insetMat = new THREE.MeshBasicMaterial({ color: 0x10182a, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const ang = i * Math.PI / 3;
    const h = depth * notch[i];
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.04, h), stone);
    wall.position.set(Math.sin(ang) * ap, -h * 0.5 + 0.04, Math.cos(ang) * ap);
    wall.rotation.y = ang;
    g.add(wall);
    const inset = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.72, h * 0.82), insetMat);
    inset.position.set(Math.sin(ang) * (ap - 0.02), -h * 0.46, Math.cos(ang) * (ap - 0.02));
    inset.rotation.y = ang;
    g.add(inset);
    for (let row = 0; row < 4; row++) {
      const y = -0.18 - row * (h * 0.22);
      if (y < -h + 0.12) continue;
      const neon = new THREE.Mesh(
        new THREE.PlaneGeometry(R * 0.92, 0.035),
        new THREE.MeshBasicMaterial({ color: row % 2 ? 0xff4aa8 : 0x3de0ff, side: THREE.DoubleSide, toneMapped: false })
      );
      neon.position.set(Math.sin(ang) * (ap - 0.04), y, Math.cos(ang) * (ap - 0.04));
      neon.rotation.y = ang;
      g.add(neon);
    }
  }
  const floor = new THREE.Mesh(raidHexShape(R * 0.92), new THREE.MeshBasicMaterial({ color: 0x071018, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -depth + 0.02;
  g.add(floor);
  const glowL = new THREE.Mesh(raidHexShape(R * 0.7), new THREE.MeshBasicMaterial({
    color: 0x1ad4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  glowL.rotation.x = -Math.PI / 2;
  glowL.position.set(-0.28, -depth + 0.06, 0.05);
  const glowR = glowL.clone();
  glowR.material = glowL.material.clone();
  glowR.material.color.setHex(0xff3d9a);
  glowR.position.x = 0.32;
  g.add(glowL, glowR);
  const chunks = [
    [0.15, 1.42, 0.26, 0.5], [-0.55, 1.5, 0.18, -0.4], [0.7, 1.35, 0.2, 0.8],
    [1.25, 0.85, 0.22, 0.3], [-1.3, 0.7, 0.24, -0.2], [1.15, -0.9, 0.16, 0.7],
    [-1.05, -1.15, 0.2, 0.4], [0.35, -1.25, 0.14, 1.0], [-0.2, 1.15, 0.12, 0.6],
  ];
  chunks.forEach((c, i) => {
    const rock = new THREE.Mesh(
      i % 2 ? new THREE.DodecahedronGeometry(c[2], 0) : new THREE.BoxGeometry(c[2] * 1.8, c[2] * 0.7, c[2] * 1.3),
      toon(i % 3 ? '#3a465c' : '#2a3344')
    );
    rock.position.set(c[0], 0.08 + c[2] * 0.35, c[1]);
    rock.rotation.set(c[3], i, c[3] * 0.4);
    g.add(rock);
  });
  [[0.35, 0.15, 0.16, -0.45], [-0.28, -0.2, 0.14, -0.85], [0.05, -0.4, 0.12, -0.3]].forEach((c, i) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(c[2], 0), toon('#243044'));
    rock.position.set(c[0], c[3], c[1]);
    rock.rotation.y = i;
    g.add(rock);
  });
  return g;
}
function buildRaidIce() {
  const g = new THREE.Group();
  const spots = [
    [-3.15, 0.15, 2.05], [-2.35, -2.05, 2.55], [1.85, 0.35, 1.55],
    [2.7, -1.7, 2.25], [-2.15, 1.35, 0.95], [1.15, 1.55, 0.7],
  ];
  spots.forEach((s, i) => {
    const cluster = new THREE.Group();
    const h = s[2];
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16 + (i % 3) * 0.05, h, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xd8f7ff : 0x9be7ff, toneMapped: false }));
    shard.position.y = h * 0.5;
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.08, h * 0.72, 4), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, toneMapped: false }));
    core.position.set(0.12, h * 0.38, 0.06);
    core.rotation.z = 0.18;
    cluster.add(shard, core);
    if (i % 2 === 0) {
      const side = new THREE.Mesh(new THREE.ConeGeometry(0.1, h * 0.55, 4), new THREE.MeshBasicMaterial({ color: 0xeafbff, toneMapped: false }));
      side.position.set(-0.16, h * 0.28, 0.05);
      side.rotation.z = -0.35;
      cluster.add(side);
    }
    cluster.position.set(s[0], 0.08, s[1]);
    cluster.rotation.y = i * 0.7;
    g.add(cluster);
  });
  return g;
}
function buildRaidSky() {
  const g = new THREE.Group();
  const edge = new THREE.MeshBasicMaterial({ color: 0x3de0ff, side: THREE.DoubleSide, toneMapped: false });
  const edgeHot = new THREE.MeshBasicMaterial({ color: 0xff4aa8, side: THREE.DoubleSide, toneMapped: false });
  const fill = new THREE.MeshBasicMaterial({ color: 0x12182c, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    if (i === 2 || i === 5 || i === 8) continue;
    const a = -1.05 + i * 0.19;
    const x = Math.sin(a) * 6.2;
    const z = -2.4 - Math.cos(a) * 2.8;
    const y = 2.7 + (i % 3) * 0.7;
    const panel = new THREE.Mesh(raidHexShape(0.72 + (i % 2) * 0.18), fill);
    const rim = new THREE.Mesh(raidHexShape(0.8 + (i % 2) * 0.18), i % 4 === 0 ? edgeHot : edge);
    panel.position.set(x, y, z);
    rim.position.set(x, y, z - 0.02);
    const yaw = Math.atan2(x, z - 3);
    panel.rotation.y = yaw;
    rim.rotation.y = yaw;
    panel.rotation.x = 0.18;
    rim.rotation.x = 0.18;
    g.add(rim, panel);
  }
  return g;
}
function hidePitHexes() {
  hexCells.forEach((c, i) => {
    const p = hexOf(c.q, c.r);
    if (Math.hypot(p.x - RAID_PIT.x, p.z - RAID_PIT.z) > RAID_PIT.r * 0.96) return;
    dummy.position.set(p.x, -8, p.z);
    dummy.rotation.set(0, Math.PI / 6, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hexMesh.setMatrixAt(i, dummy.matrix);
    hexInk.setMatrixAt(i, dummy.matrix);
    edgeMesh.setMatrixAt(i, dummy.matrix);
    if (halos[i]) halos[i].visible = false;
  });
  hexMesh.instanceMatrix.needsUpdate = true;
  hexInk.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceMatrix.needsUpdate = true;
  state.pitHidden = true;
}
function syncRaidFloor(g) {
  const king = !!(g && g.TRAIN && g.TRAIN.king && !state.parkOn);
  if (raidFloor) raidFloor.visible = king;
  if (raidDress) raidDress.visible = king;
  if (king) hidePitHexes();
  else if (state.pitHidden && !state.parkOn) {
    state.pitHidden = false;
    halos.forEach(h => { h.visible = true; });
    state.worldKey = '';
  } else if (state.pitHidden) state.pitHidden = false;
  const img = raidFloor && raidFloor.material.map && raidFloor.material.map.image;
  const ready = !!(img && img.complete && img.naturalWidth);
  state.raidFloor = {
    on: !!(raidFloor && raidFloor.visible),
    art: 'raid-floor',
    ready,
    pit: !!(king && raidPit),
    ice: !!(king && raidIce && raidIce.children.length > 0),
    sky: !!(king && raidSky && raidSky.children.length > 0),
  };
  return state.raidFloor;
}

function dressTree(i) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 5), toon('#6b4330'));
  trunk.position.y = 0.4;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48 + (i % 3) * 0.08, 1.15, 6), toon(i % 2 ? '#2f7a3a' : '#3f8f48'));
  cap.position.y = 1.15;
  g.add(trunk, cap);
  g.visible = false;
  scene.add(g);
  return g;
}
function dressMeadow(i) {
  const g = new THREE.Group();
  if (i % 2) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 5), toon('#ffd36a'));
    post.position.y = 0.6;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), toon('#ffe7a0'));
    cap.position.y = 1.22;
    g.add(post, cap);
  } else {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 5), toon('#c6a24a'));
    tuft.position.y = 0.3;
    g.add(tuft);
  }
  g.visible = false;
  scene.add(g);
  return g;
}
function dressStone(i) {
  const g = new THREE.Group();
  if (i % 2) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.55, 5), toon('#8b939e'));
    pillar.position.y = 0.8;
    g.add(pillar);
  } else {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), toon('#9aa3ad'));
    rock.position.y = 0.2;
    rock.rotation.y = i;
    g.add(rock);
  }
  g.visible = false;
  scene.add(g);
  return g;
}
function placeDress(area) {
  for (const name of Object.keys(areaDress)) {
    areaDress[name].forEach((g, i) => {
      const on = name === area;
      g.visible = on;
      if (!on) return;
      const spot = DRESS_SPOTS[i];
      const p = hexOf(spot[0], spot[1]);
      g.position.set(p.x, 0, p.z);
    });
  }
}
function storyPits() {
  return hexCells.filter(c => {
    const dist = (Math.abs(c.q) + Math.abs(c.r) + Math.abs(c.q + c.r)) / 2;
    return (dist === 2 && (c.q + c.r) % 2 === 0) || (c.q === 0 && c.r === -1);
  }).map(c => ({ q: c.q, r: c.r, deep: c.q === 0 && c.r === -1 }));
}
function paintField(look) {
  const neon = (look ? look.neon : ['#3de0ff', '#b06bff', '#ff3355']).map(h => new THREE.Color(h));
  const pits = look ? look.pits : storyPits();
  const pitKey = new Map(pits.map(p => [p.q + ',' + p.r, p]));
  hexCells.forEach((c, i) => {
    const hit = pitKey.get(c.q + ',' + c.r);
    const deep = !!(hit && hit.deep);
    const y = deep ? -0.55 : hit ? -0.08 : 0;
    const p = hexOf(c.q, c.r);
    dummy.position.set(p.x, y, p.z);
    dummy.rotation.set(0, Math.PI / 6, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hexMesh.setMatrixAt(i, dummy.matrix);
    hexInk.setMatrixAt(i, dummy.matrix);
    edgeMesh.setMatrixAt(i, dummy.matrix);
    const tint = hit ? neon[2] : neon[(Math.abs(c.q + c.r) + 6) % 3];
    edgeMesh.setColorAt(i, tint);
    halos[i].position.set(p.x, y + 0.16, p.z);
    halos[i].material = glowMat(tint);
    const s = deep ? 2.1 : 1.05;
    halos[i].scale.set(s, s, 1);
  });
  hexMesh.instanceMatrix.needsUpdate = true;
  hexInk.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceMatrix.needsUpdate = true;
  if (edgeMesh.instanceColor) edgeMesh.instanceColor.needsUpdate = true;
  cracks.forEach((cr, i) => {
    const pit = pits[i];
    cr.visible = !!pit;
    if (!pit) return;
    const p = hexOf(pit.q, pit.r);
    cr.position.set(p.x, pit.deep ? -0.47 : 0.02, p.z);
    cr.scale.set(pit.deep ? 1.45 : 1, 1, pit.deep ? 1.6 : 1);
    cr.material.color.set(pit.deep ? '#ff4466' : '#d56bff');
  });
  placeDress(look && look.area);
  const scatter = look && !look.area ? look.scatter : [];
  scatterProps.forEach((m, i) => {
    const s = scatter[i];
    m.visible = !!s;
    if (!s) return;
    const p = hexOf(s.q, s.r);
    m.position.set(p.x + (s.kind === 'lantern' ? 0.2 : -0.15), s.kind === 'lantern' ? 0.28 : 0.12, p.z);
  });
  const kind = look ? look.weather : 'storm';
  const skyHex = !look ? '#070814'
    : kind === 'clear' ? '#d7e6f8'
    : kind === 'night' ? '#070814'
    : kind === 'storm' ? '#243044'
    : kind === 'rain' ? '#7f93ab'
    : look.sky;
  scene.background = new THREE.Color(skyHex);
  if (scene.fog) {
    scene.fog.color.set(skyHex);
    scene.fog.near = !look ? 8 : kind === 'storm' ? 4 : kind === 'rain' ? 7 : 12;
    scene.fog.far = !look ? 16 : kind === 'storm' ? 12 : kind === 'clear' ? 26 : 18;
  }
  if (sun) {
    sun.color.set(!look ? '#9eb4d0' : kind === 'clear' ? '#fff4d8' : kind === 'night' ? '#6d82b0' : '#d5deee');
    sun.intensity = !look ? 0.55 : kind === 'clear' ? 1.7 : kind === 'night' ? 0.22 : kind === 'storm' ? 0.38 : 0.7;
  }
  if (hexMesh && look) {
    if (!hexMesh.userData.own) { hexMesh.material = hexMesh.material.clone(); hexMesh.userData.own = true; }
    hexMesh.material.color.set(look.area === 'Forest' ? '#245c34' : look.area === 'Meadow' ? '#7d8a32' : look.area === 'Stone' ? '#6a7078' : look.area === 'Town' ? '#8a5a32' : look.area === 'Market' ? '#a07840' : look.area === 'Dock' ? '#6e5a48' : (kind === 'rain' || kind === 'storm' ? '#243246' : kind === 'night' ? '#1a2230' : '#5d7594'));
  }
  state.weatherKind = kind;
  state.story = !look;
  placeWeatherMobs(look);
  if (rainMesh) {
    const wet = state.story || ['rain', 'storm', 'snow', 'wind'].includes(state.weatherKind);
    rainMesh.visible = wet;
    rainMesh.material.color.set(state.weatherKind === 'snow' ? '#f4f7ff' : '#9ec7ff');
  }
}
function standKind(id) {
  if (id === 'blob') return 'rig-blob';
  if (id === 'slime') return 'blob';
  if (id === 'scout') return 'rig-beast';
  if (id === 'goblin') return 'beast';
  if (id === 'glass-brute' || id === 'wire-brute') return 'rig-brute';
  return '';
}
const RIG_CLIP = {
  blob: { idle: 'Idle', move: 'Hop', attack: 'Lunge', hit: 'HitReact', death: 'Death' },
  beast: { idle: 'Idle', move: 'Run', attack: 'Bite', hit: 'HitReact', death: 'Death' },
  brute: { idle: 'Idle', move: 'Walk', attack: 'Swipe', hit: 'HitReact', death: 'Death' },
};
function dressMob(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    o.frustumCulled = false;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map(src => {
      const name = ((src && src.name) || '') + ' ' + (o.name || '');
      if (/glass|ghost/i.test(name)) {
        const m = src.clone();
        m.transparent = true;
        m.depthWrite = false;
        m.opacity = Math.min(0.48, src.opacity || 0.4);
        m.roughness = 0.2;
        m.metalness = 0.05;
        m.emissiveIntensity = Math.max(src.emissiveIntensity || 1, 0.6);
        return m;
      }
      if (/wire/i.test(name)) {
        const col = src.emissive ? src.emissive.clone() : new THREE.Color(0x38ebff);
        return new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.95,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        });
      }
      if (/eye|spark|heart/i.test(name)) {
        const col = src.emissive && src.emissive.getHex() ? src.emissive.clone() : new THREE.Color(0xff1405);
        return new THREE.MeshBasicMaterial({ color: col, toneMapped: false, side: THREE.DoubleSide });
      }
      return new THREE.MeshToonMaterial({
        color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        gradientMap: grad,
        emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
        emissiveIntensity: src.emissiveIntensity || 1,
      });
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}
function cloneRig(src) {
  const root = src.clone(true);
  const byName = new Map();
  root.traverse(o => { if (o.isBone) byName.set(o.name, o); });
  root.traverse(o => {
    if (!o.isSkinnedMesh || !o.skeleton) return;
    const bones = o.skeleton.bones.map(b => byName.get(b.name));
    if (bones.some(b => !b)) return;
    o.bind(new THREE.Skeleton(bones, o.skeleton.boneInverses), o.bindMatrix);
    o.frustumCulled = false;
  });
  return root;
}
function makeActor(template, clips, scale, set) {
  const root = cloneRig(template);
  root.scale.setScalar(scale);
  root.visible = false;
  scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const c of clips) {
    const act = mixer.clipAction(c);
    act.clampWhenFinished = true;
    actions[c.name] = act;
  }
  const actor = { root, mixer, actions, set, clip: '', mob: null, hold: 0, hit: false, death: false };
  mixer.addEventListener('finished', (e) => {
    const name = e.action && e.action.getClip().name;
    if (name === 'HitReact' || name === RIG_CLIP[set].attack || name === 'Roar' || name === 'Slam' || name === 'Pounce') actor.clip = '';
  });
  rigActors.push(actor);
  return actor;
}
function playRig(actor, name, once) {
  const next = actor.actions[name];
  if (!next || actor.clip === name) return;
  const prev = actor.actions[actor.clip];
  actor.clip = name;
  next.reset();
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  next.clampWhenFinished = !!once;
  next.enabled = true;
  if (prev && prev !== next) next.crossFadeFrom(prev, 0.1, false);
  next.play();
}
function driveActor(actor, m, px, pz) {
  const set = RIG_CLIP[actor.set];
  const dying = !m || m.state === 'dying' || m.state === 'gone' || m.hp <= 0;
  if (dying) {
    if (!actor.death) {
      actor.death = true;
      playRig(actor, set.death, true);
      actor.hold = 1.15;
    }
    actor.root.visible = actor.hold > 0;
    return;
  }
  actor.death = false;
  actor.hold = 0;
  actor.root.visible = true;
  actor.root.position.set(m.x, 0, m.y);
  actor.root.rotation.y = Math.atan2(px - m.x, pz - m.y);
  if (m.fl > 0.35 && !actor.hit) {
    actor.hit = true;
    actor.clip = '';
    playRig(actor, set.hit, true);
  } else if (m.fl <= 0) actor.hit = false;
  if (m.roarOnce) {
    m.roarOnce = false;
    actor.clip = '';
    playRig(actor, 'Roar', true);
    return;
  }
  if (m.slamOnce) {
    m.slamOnce = false;
    actor.clip = '';
    playRig(actor, 'Slam', true);
    return;
  }
  if (actor.clip === set.hit || actor.clip === set.attack || actor.clip === 'Roar' || actor.clip === 'Slam' || actor.clip === 'Pounce') return;
  if (m.pounceOnce) {
    m.pounceOnce = false;
    m.swingOnce = false;
    actor.clip = '';
    playRig(actor, 'Pounce', true);
    return;
  }
  if (m.swingOnce) {
    m.swingOnce = false;
    actor.clip = '';
    playRig(actor, set.attack, true);
    return;
  }
  if (m.moving) playRig(actor, set.move, false);
  else playRig(actor, set.idle, false);
}
function claimActor(pool, m) {
  let actor = pool.find(a => a.mob === m);
  if (!actor) actor = pool.find(a => !a.mob || (a.death && a.hold <= 0));
  if (!actor) return null;
  if (actor.mob !== m) {
    actor.mob = m;
    actor.clip = '';
    actor.hit = false;
    actor.death = false;
    actor.hold = 0;
  }
  return actor;
}
async function loadMobRigs() {
  const loader = new GLTFLoader();
  const load = (file) => loader.loadAsync('assets/mobs/' + file);
  const [blob, beast, glassB, wireB] = await Promise.all([
    load('mob_blob_r002.glb'),
    load('mob_raid_beast_r002.glb'),
    load('mob_raid_brute_glass_r002.glb'),
    load('mob_raid_brute_wire_r002.glb'),
  ]);
  for (const g of [blob, beast, glassB, wireB]) dressMob(g.scene);
  for (let i = 0; i < 4; i++) makeActor(blob.scene, blob.animations, 1.85, 'blob');
  for (let i = 0; i < 4; i++) makeActor(beast.scene, beast.animations, 1.15, 'beast');
  rigGlass = makeActor(glassB.scene, glassB.animations, 0.72, 'brute');
  rigWire = makeActor(wireB.scene, wireB.animations, 0.72, 'brute');
  petRigs.blob = makeFollow(blob.scene, blob.animations, 0.85, 'blob');
  petRigs.beast = makeFollow(beast.scene, beast.animations, 0.52, 'beast');
  petRigs.brute = makeFollow(glassB.scene, glassB.animations, 0.34, 'brute');
  petRigs.wire = makeFollow(wireB.scene, wireB.animations, 0.34, 'brute');
  mobsReady = true;
}
function makeFollow(template, clips, scale, set) {
  const root = cloneRig(template);
  root.scale.setScalar(scale);
  root.visible = false;
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const c of clips) {
    const act = mixer.clipAction(c);
    act.clampWhenFinished = true;
    actions[c.name] = act;
  }
  const actor = { root, mixer, actions, set, clip: '', follow: true, hold: 0 };
  return actor;
}
function followKey(species) {
  if (species === 'blob' || species === 'slime') return 'blob';
  if (species === 'scout' || species === 'goblin') return 'beast';
  if (species === 'glass-brute') return 'brute';
  if (species === 'wire-brute') return 'wire';
  return '';
}
function rigPools() {
  return {
    blob: rigActors.filter(a => a.set === 'blob'),
    beast: rigActors.filter(a => a.set === 'beast'),
  };
}
function buildWeatherMobs() {
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const body = part(new THREE.SphereGeometry(0.42, 10, 8), toon('#7dffa8').clone(), 0, 0.34, 0, g);
    body.scale.set(1.15, 0.72, 1);
    part(new THREE.SphereGeometry(0.12, 8, 6), toon('#e8fff2').clone(), -0.08, 0.42, 0.16, g);
    part(new THREE.SphereGeometry(0.12, 8, 6), toon('#e8fff2').clone(), 0.08, 0.42, 0.16, g);
    g.visible = false;
    scene.add(g);
    weatherBlobs.push(g);
  }
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const fur = toon('#c45a3a').clone();
    const torso = part(new THREE.SphereGeometry(0.36, 10, 8), fur, 0, 0.42, 0, g);
    torso.scale.set(1.35, 0.62, 0.78);
    part(new THREE.SphereGeometry(0.14, 8, 6), fur, 0.32, 0.46, 0, g);
    for (const [x, z] of [[-0.16, 0.14], [0.12, 0.14], [-0.16, -0.14], [0.12, -0.14]]) {
      part(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 5), fur, x, 0.1, z, g);
    }
    g.visible = false;
    scene.add(g);
    weatherBeasts.push(g);
  }
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const cloth = toon(i % 2 ? '#e2b15a' : '#6aa7d8').clone();
    part(new THREE.CylinderGeometry(0.16, 0.18, 0.46, 7), cloth, 0, 0.4, 0, g);
    part(new THREE.SphereGeometry(0.12, 8, 6), toon('#f0c09a').clone(), 0, 0.78, 0, g);
    g.visible = false;
    scene.add(g);
    weatherFolk.push(g);
  }
}
function placeWeatherMobs(look) {
  weatherBlobs.forEach(m => { m.visible = false; });
  weatherBeasts.forEach(m => { m.visible = false; });
  weatherFolk.forEach(m => { m.visible = false; });
  state.showBrute = false;
  state.bruteAt = null;
  if (!look) return;
  const folks = (look.spawns || []).filter(s => (s.group === 'npc' || s.group === 'vendor') && s.place === 'field');
  const spots = [[-3, -1], [3, -1], [-2, 1], [2, 1]];
  folks.slice(0, Math.min(weatherFolk.length, spots.length)).forEach((s, i) => {
    const p = hexOf(spots[i][0], spots[i][1]);
    const g = weatherFolk[i];
    g.visible = true;
    g.position.set(p.x, 0, p.z);
    g.userData.folkId = s.id;
  });
}
function syncRolledFigures(g) {
  weatherBlobs.forEach(m => { m.visible = false; });
  weatherBeasts.forEach(m => { m.visible = false; });
  const px = g.AR.ppx || 0, pz = g.AR.ppy || 3;
  if (state.story) {
    state.showBrute = false;
    weatherFolk.forEach(m => { m.visible = false; });
    rigActors.forEach(a => { if (a !== rigWire) { a.root.visible = false; } });
    return;
  }
  const mobs = (g.AR.mobs || []).filter(m => m.rollId && m.state !== 'gone' && m.state !== 'panel');
  let bi = 0, ei = 0;
  state.showBrute = false;
  state.bruteFlinch = 0;
  const pools = rigPools();
  const used = new Set();
  for (const m of mobs) {
    const kind = standKind(m.rollId);
    if (kind === 'blob' && bi < weatherBlobs.length) {
      const o = weatherBlobs[bi++];
      o.visible = true;
      o.position.set(m.x, 0, m.y);
      o.scale.setScalar(m.fl > 0 ? 0.82 : 1);
    } else if (kind === 'beast' && ei < weatherBeasts.length) {
      const o = weatherBeasts[ei++];
      o.visible = true;
      o.position.set(m.x, 0, m.y);
      o.rotation.z = m.fl > 0 ? 0.35 : 0;
    } else if (kind === 'rig-blob' || kind === 'rig-beast') {
      const pool = kind === 'rig-blob' ? pools.blob : pools.beast;
      const actor = mobsReady ? claimActor(pool, m) : null;
      if (actor) { used.add(actor); driveActor(actor, m, px, pz); }
      else if (kind === 'rig-blob' && bi < weatherBlobs.length) {
        const o = weatherBlobs[bi++];
        o.visible = true;
        o.position.set(m.x, 0, m.y);
      }
    } else if (kind === 'rig-brute') {
      const wire = m.rollId === 'wire-brute' || m.tier === 'elite';
      const actor = mobsReady ? (wire ? rigWire : rigGlass) : null;
      if (actor) { used.add(actor); driveActor(actor, m, px, pz); }
      else {
        state.showBrute = true;
        state.bruteAt = { x: m.x, z: m.y };
        state.bruteFlinch = m.fl > 0 ? 1 : 0;
      }
    }
  }
  for (const a of rigActors) {
    if (used.has(a)) continue;
    if (a.mob && (a.mob.state === 'dying' || a.mob.state === 'gone' || a.mob.hp <= 0)) driveActor(a, a.mob, px, pz);
    else if (!a.death) { a.root.visible = false; a.mob = null; }
  }
  const folk = g.AR.folk || [];
  weatherFolk.forEach((o, i) => {
    const f = folk[i];
    o.visible = !!f;
    if (f) o.position.set(f.x, 0, f.y);
  });
}
function syncBossRig(g, mobs) {
  const bossMob = (mobs || []).find(m => (m.tier === 'boss' || m.rollId === 'wire-brute') && m.state !== 'gone');
  const use = !!(mobsReady && rigWire && bossMob && bossMob.rollId === 'wire-brute');
  boss.children.forEach(ch => { if (!ch.userData.keep) ch.visible = !use; });
  if (!use) {
    if (state.story && rigWire) rigWire.root.visible = false;
    return false;
  }
  const px = g.AR.ppx || 0, pz = g.AR.ppy || 3;
  const stand = {
    x: bossMob ? bossMob.x : 0,
    y: bossMob ? bossMob.y : -4.6,
    fl: bossMob ? bossMob.fl : state.flash,
    hp: bossMob ? bossMob.hp : state.bossHp,
    state: (bossMob && (bossMob.state === 'dying' || bossMob.hp <= 0)) || state.bossHp <= 0 ? 'dying' : 'live',
    moving: false,
    atkSwing: false,
    roarOnce: !!(bossMob && bossMob.roarOnce),
    slamOnce: !!(bossMob && bossMob.slamOnce),
  };
  if (bossMob) { bossMob.roarOnce = false; bossMob.slamOnce = false; }
  driveActor(rigWire, stand, px, pz);
  rigWire.root.position.set(stand.x, 0, stand.y);
  rigWire.mob = stand;
  return true;
}
function storySpace(g) {
  return !!(g && g.TRAIN && (g.TRAIN.king || g.TRAIN.dayRaid));
}
function syncWorld(g) {
  const story = storySpace(g);
  const w = window.__world;
  const rev = w && w.revision ? w.revision() : 0;
  const key = (story ? 'story' : 'field') + ':' + rev;
  if (key === state.worldKey) return;
  state.worldKey = key;
  paintField(story ? null : (w && w.look && w.look()));
}
function buildRain() {
  const geo = new THREE.BoxGeometry(0.03, 0.28, 0.03);
  rainMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x9ec7ff }), RAIN);
  for (let i = 0; i < RAIN; i++) {
    dummy.position.set((i % 8) - 3.5, (i * 0.37) % 6, -((i * 1.7) % 10) + 2);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    rainMesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rainMesh);
}

function buildHands() {
  hands = new THREE.Group();
  camera.add(hands);
  const skin = toon('#f0c09a');
  const cuff = toon('#2c3448');
  const makeHand = (side) => {
    const h = new THREE.Group();
    h.position.set(side * 0.48, -0.36, -0.72);
    const palm = part(new THREE.SphereGeometry(0.085, 12, 8), skin, 0, 0, 0, h);
    palm.scale.set(1.2, 0.78, 1.28);
    const thumb = part(new THREE.SphereGeometry(0.032, 8, 6), skin, side * 0.07, -0.015, 0.01, h);
    thumb.scale.set(0.9, 1.35, 0.75);
    part(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 8), cuff, 0, 0.01, 0.07, h);
    return h;
  };
  const left = makeHand(-1), right = makeHand(1);
  hands.add(left, right);
  glass = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), toon('#9eefff', { transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.set(0, 0.02, -0.08);
  left.add(glass);
  const rimG = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.005, 6, 16), new THREE.MeshBasicMaterial({ color: 0xcff6ff }));
  rimG.position.copy(glass.position);
  left.add(rimG);
  rune = new THREE.Group();
  rune.position.set(0, 0.04, -0.16);
  right.add(rune);
  rune.add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.004, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffb15a })));
  for (let i = 0; i < 5; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.006), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }));
    const a = i / 5 * Math.PI * 2;
    mark.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0);
    rune.add(mark);
  }
  rune.visible = false;
}

function buildRifle() {
  rifle = new THREE.Group();
  rifle.position.set(0.42, -0.3, -0.64);
  camera.add(rifle);
  const wood = toon('#6b3d2a');
  const metal = toon('#b7c0ce');
  const body = part(new THREE.CapsuleGeometry(0.05, 0.26, 4, 8), wood, 0, 0.02, 0.02, rifle);
  body.rotation.x = Math.PI / 2;
  const stock = part(new THREE.SphereGeometry(0.065, 10, 8), wood, 0, -0.01, 0.2, rifle);
  stock.scale.set(0.72, 1.15, 1.25);
  const barrel = part(new THREE.CapsuleGeometry(0.026, 0.24, 3, 8), metal, 0, 0.055, -0.2, rifle);
  barrel.rotation.x = Math.PI / 2;
  const scope = part(new THREE.SphereGeometry(0.038, 8, 6), metal, 0, 0.1, -0.02, rifle);
  scope.scale.set(0.75, 0.65, 1.45);
  rifle.userData.mag = part(new THREE.CapsuleGeometry(0.028, 0.07, 3, 6), toon('#1c1e26'), 0, -0.07, 0.04, rifle);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  flash.position.set(0, 0.055, -0.38);
  flash.visible = false;
  rifle.add(flash);
  const flashGlow = new THREE.Sprite(glowMat(0xfff2a8));
  flashGlow.scale.set(0.45, 0.45, 1);
  flashGlow.position.copy(flash.position);
  flash.add(flashGlow);
  rifle.userData.flash = flash;
  rifle.visible = false;
}

function buildBoss() {
  boss = new THREE.Group();
  scene.add(boss);
  const meat = toon('#121820');
  const glassMat = toon('#1a4568', { transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  const torso = part(new THREE.SphereGeometry(0.48, 12, 8), meat, 0, 1.15, 0, boss);
  torso.scale.set(1.15, 1.35, 0.9);
  part(new THREE.SphereGeometry(0.28, 10, 8), meat, 0, 1.78, 0.04, boss);
  part(new THREE.CapsuleGeometry(0.14, 0.46, 3, 6), meat, -0.62, 1.05, 0, boss);
  part(new THREE.CapsuleGeometry(0.14, 0.46, 3, 6), meat, 0.62, 1.05, 0, boss);
  part(new THREE.CapsuleGeometry(0.16, 0.35, 3, 6), meat, -0.2, 0.42, 0, boss);
  part(new THREE.CapsuleGeometry(0.16, 0.35, 3, 6), meat, 0.2, 0.42, 0, boss);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), glassMat);
  shell.position.y = 1.15;
  shell.scale.set(1.15, 1.35, 1);
  boss.add(shell);
  bossWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 1), new THREE.MeshBasicMaterial({ color: 0x8fe8ff, wireframe: true, transparent: true, opacity: 0.85 }));
  bossWire.position.y = 1.15;
  bossWire.scale.set(1.15, 1.35, 1);
  boss.add(bossWire);
  const aura = new THREE.Sprite(glowMat(0x66e0ff));
  aura.position.y = 1.2;
  aura.scale.set(3.4, 3.4, 1);
  boss.add(aura);
  bossEyes = [];
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    eye.position.set(x, 1.82, 0.22);
    boss.add(eye);
    const eg = new THREE.Sprite(glowMat(0xff2244));
    eg.position.copy(eye.position);
    eg.scale.set(0.45, 0.45, 1);
    boss.add(eg);
    bossEyes.push(eye);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0x1a1018 }));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.045, 0.05), new THREE.MeshBasicMaterial({ color: 0x3de07a }));
  back.position.set(0, 2.25, 0);
  fill.position.set(0, 2.25, 0.02);
  back.userData.keep = true;
  fill.userData.keep = true;
  boss.add(back, fill);
  bossBar = fill;
  boss.position.set(0, 0, -4.6);
  boss.scale.setScalar(1.55);
  buildKingPlate();
  buildBoarPlate();
  boltSky = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4), new THREE.MeshBasicMaterial({ color: 0xe7f3ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  boltSky.position.set(0.4, 4.4, -2.2);
  streak = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 3.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  streak.position.set(-3.4, 4.2, -1.2);
  streak.rotation.z = 0.4;
  scene.add(boltSky, streak);
}

function buildKingPlate() {
  const tex = new THREE.TextureLoader().load('gel_king_cut.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  kingPaint = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: true, side: THREE.FrontSide, toneMapped: false,
  });
  kingHolo = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xffb0e8, toneMapped: false,
  });
  kingPlate = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 2.18), kingPaint);
  kingPlate.visible = false;
  kingPlate.renderOrder = 2;
  scene.add(kingPlate);
  kingShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 18),
    new THREE.MeshBasicMaterial({ color: 0x120814, transparent: true, opacity: 0.4, depthWrite: false })
  );
  kingShadow.rotation.x = -Math.PI / 2;
  kingShadow.visible = false;
  scene.add(kingShadow);
}
function gelKingMob(g) {
  if (!kingPlate || !g || !g.TRAIN || !g.TRAIN.king) return null;
  return (g.AR.mobs || []).find(m => m && m.tier === 'boss' && m.art === 'king' && m.state !== 'gone') || null;
}
function syncKingPlate(g) {
  const king = gelKingMob(g);
  const on = !!king;
  state.plateOn = on;
  if (!kingPlate) return { on: false, mode: 'off' };
  if (!on) {
    kingPlate.visible = false;
    if (kingShadow) kingShadow.visible = false;
    state.plateMode = 'off';
    return { on: false, mode: 'off' };
  }
  boss.visible = false;
  const x = king.x, z = king.y;
  if (king.max) { state.bossHp = Math.max(0, king.hp); state.bossMax = king.max; }
  const bob = Math.sin(state.t * 1.5) * 0.025;
  kingPlate.position.set(x, 1.12 + bob, z);
  kingPlate.rotation.set(0, 0, 0);
  kingPlate.visible = true;
  const dx = camera.position.x - x;
  const dy = camera.position.y - (1.12 + bob);
  const dz = camera.position.z - z;
  const dist = Math.hypot(dx, dy, dz);
  const behind = dz < 0.4;
  const side = Math.abs(dx) > Math.max(0.7, Math.abs(dz) * 1.25);
  const close = dist < 1.45;
  const holo = behind || side || close;
  state.plateMode = holo ? 'holo' : 'paint';
  kingPlate.material = holo ? kingHolo : kingPaint;
  if (holo) {
    kingHolo.opacity = 0.34 + 0.22 * (0.5 + 0.5 * Math.sin(state.t * 6));
    kingHolo.color.setHex((state.t % 0.8) < 0.4 ? 0xff9ad4 : 0xb7f0ff);
  } else kingPaint.opacity = 0.96 + 0.04 * (0.5 + 0.5 * Math.sin(state.t * 2.2));
  if (kingShadow) {
    kingShadow.visible = !holo;
    kingShadow.position.set(x, 0.03, z + 0.12);
  }
  return { on: true, mode: state.plateMode, dist: Math.round(dist * 100) / 100 };
}
function buildBoarPlate() {
  const tex = new THREE.TextureLoader().load('boar_plate.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  boarPaint = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: true, side: THREE.FrontSide, toneMapped: false,
  });
  boarHolo = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xffb0e8, toneMapped: false,
  });
  boarPlate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.5), boarPaint);
  boarPlate.visible = false;
  boarPlate.renderOrder = 2;
  scene.add(boarPlate);
  boarShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 18),
    new THREE.MeshBasicMaterial({ color: 0x120814, transparent: true, opacity: 0.4, depthWrite: false })
  );
  boarShadow.rotation.x = -Math.PI / 2;
  boarShadow.visible = false;
  scene.add(boarShadow);
  buildParkBackdrop();
}
function buildParkBackdrop() {
  const tex = new THREE.TextureLoader().load('park_backdrop.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  parkPaint = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
  parkPlate = new THREE.Mesh(new THREE.PlaneGeometry(16 / 9, 1), parkPaint);
  parkPlate.visible = false;
  parkPlate.renderOrder = 0;
  scene.add(parkPlate);
}
function syncParkBackdrop(g, on, plateX, plateZ) {
  state.parkOn = !!on;
  if (!parkPlate) {
    state.park = { on: false, mode: 'off' };
    return state.park;
  }
  if (!on) {
    if (state.parkHeld) {
      state.parkHeld = false;
      state.worldKey = '';
      if (hexMesh) hexMesh.visible = true;
      if (hexInk) hexInk.visible = true;
      if (edgeMesh) edgeMesh.visible = true;
      halos.forEach(h => { h.visible = true; });
    }
    parkPlate.visible = false;
    state.park = { on: false, mode: 'off' };
    return state.park;
  }
  state.parkHeld = true;
  if (hexMesh) hexMesh.visible = false;
  if (hexInk) hexInk.visible = false;
  if (edgeMesh) edgeMesh.visible = false;
  halos.forEach(h => { h.visible = false; });
  cracks.forEach(c => { c.visible = false; });
  if (rainMesh) rainMesh.visible = false;
  if (scene) {
    scene.background = new THREE.Color('#8ec8f0');
    if (scene.fog) { scene.fog.color.set('#8ec8f0'); scene.fog.near = 28; scene.fog.far = 40; }
  }
  const z = plateZ - 0.35;
  camera.getWorldDirection(parkDir);
  const t = Math.abs(parkDir.z) > 0.02 ? (z - camera.position.z) / parkDir.z : 4;
  parkAt.copy(camera.position).addScaledVector(parkDir, Math.max(0.4, t));
  parkPlate.position.set(plateX, parkAt.y, z);
  parkPlate.rotation.set(0, 0, 0);
  const dist = Math.max(0.6, camera.position.z - z);
  const viewH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
  const viewW = viewH * Math.max(0.4, camera.aspect);
  parkPlate.scale.setScalar(Math.max(viewW / (16 / 9), viewH) * 1.14);
  parkPlate.visible = true;
  state.park = { on: true, mode: 'paint' };
  return state.park;
}
function fieldBoar(g) {
  if (!boarPlate || !g || !g.TRAIN || !g.TRAIN.dayRaid || g.TRAIN.view !== 'fp') return null;
  return (g.AR.mobs || []).find(m => m && m.raidBoss && m.state !== 'gone') || null;
}
function syncBoarPlate(g) {
  const mob = fieldBoar(g);
  const on = !!mob;
  if (!boarPlate) return { on: false, mode: 'off' };
  if (!on) {
    boarPlate.visible = false;
    if (boarShadow) boarShadow.visible = false;
    state.boarMode = 'off';
    state.boar = { on: false, mode: 'off' };
    syncParkBackdrop(g, false);
    return state.boar;
  }
  boss.visible = false;
  if (kingPlate) kingPlate.visible = false;
  if (kingShadow) kingShadow.visible = false;
  if (typeof rigWire !== 'undefined' && rigWire && rigWire.root) rigWire.root.visible = false;
  const x = mob.x, z = mob.y + BOAR_PULL;
  const bob = Math.sin(state.t * 1.5) * 0.02;
  const y = BOAR_Y + bob;
  boarPlate.position.set(x, y, z);
  boarPlate.rotation.set(0, 0, 0);
  boarPlate.visible = true;
  const dx = camera.position.x - x;
  const dy = camera.position.y - y;
  const dz = camera.position.z - z;
  const dist = Math.hypot(dx, dy, dz);
  const behind = dz < 0.4;
  const side = Math.abs(dx) > Math.max(0.7, Math.abs(dz) * 1.25);
  const close = dist < 1.45;
  const holo = behind || side || close;
  state.boarMode = holo ? 'holo' : 'paint';
  boarPlate.material = holo ? boarHolo : boarPaint;
  if (holo) {
    boarHolo.opacity = 0.34 + 0.22 * (0.5 + 0.5 * Math.sin(state.t * 6));
    boarHolo.color.setHex((state.t % 0.8) < 0.4 ? 0xff9ad4 : 0xb7f0ff);
  } else boarPaint.opacity = 0.96 + 0.04 * (0.5 + 0.5 * Math.sin(state.t * 2.2));
  if (boarShadow) boarShadow.visible = false;
  syncParkBackdrop(g, true, x, z);
  state.boar = { on: true, mode: state.boarMode, dist: Math.round(dist * 100) / 100 };
  return state.boar;
}
function buildSlamRing() {
  slamRing = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 28),
    new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide })
  );
  disc.rotation.x = -Math.PI / 2;
  slamRing.add(disc);
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.05, 28),
    new THREE.MeshBasicMaterial({ color: 0xffe1e4, depthWrite: false, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  slamRing.add(rim);
  slamRing.visible = false;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff6d4';
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Slam', 64, 30);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.position.y = 0.8;
  sprite.scale.set(0.7, 0.22, 1);
  slamRing.add(sprite);
  scene.add(slamRing);
}
function syncSlam(g) {
  if (!slamRing) return;
  const boss = g && g.AR && (g.AR.mobs || []).find(m => m.raidBoss && m.slamTele > 0 && m.slamAt);
  slamRing.visible = !!boss;
  if (boss) slamRing.position.set(boss.slamAt.x, 0.55, boss.slamAt.y);
}
function buildPet() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  body.position.y = 0.2;
  g.add(body);
  petSphere = body;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.position.y = 0.42;
  sprite.scale.set(0.32, 0.08, 1);
  g.add(sprite);
  g.visible = false;
  g.userData.canvas = canvas;
  g.userData.sprite = sprite;
  scene.add(g);
  petFollow = g;
}
function syncPet(g) {
  if (!petFollow) return;
  const pet = window.__profile && window.__profile.active && window.__profile.active();
  const show = !!(pet && g.TRAIN && g.TRAIN.on && !g.TRAIN.king);
  const key = show ? followKey(pet.species) : '';
  const rig = key && petRigs[key];
  Object.keys(petRigs).forEach(k => { if (petRigs[k] && petRigs[k] !== rig) petRigs[k].root.visible = false; });
  petFollow.visible = show;
  if (!show) return;
  const px = g.AR.ppx || 0;
  const pz = g.AR.ppy || 0;
  const fp = g.TRAIN.view === 'fp';
  const bob = Math.abs(Math.sin(state.t * 3.2)) * 0.05;
  const x = px + (fp ? -0.08 : -0.55);
  const z = pz + (fp ? -0.62 : 0.72);
  if (rig) {
    if (petSphere) petSphere.visible = false;
    if (!rig.root.parent) scene.add(rig.root);
    rig.root.visible = true;
    rig.root.position.set(x, (fp ? 0.92 : 0.15) + bob, z);
    rig.root.rotation.y = fp ? Math.PI : 0.4;
    if (rig.clip !== 'Idle') playRig(rig, 'Idle', false);
    petFollow.position.set(x, fp ? 0.7 : 0.35, z);
  } else {
    if (petSphere) petSphere.visible = true;
    petFollow.position.set(x, bob, z);
  }
  petFollow.scale.setScalar(1);
  if (petFollow.userData.shown !== pet.name) {
    const ctx = petFollow.userData.canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 32);
    ctx.fillStyle = '#fff6d4';
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pet.name, 64, 24);
    petFollow.userData.sprite.material.map.needsUpdate = true;
    petFollow.userData.shown = pet.name;
  }
}
const SPELL_COL = { ember: 0xff8a3d, frost: 0x8fe3ff, nova: 0xffc94d, shot: 0xff4455, flare: 0xffe14a, ward: 0x9dffc8, frag: 0xffb45a };
function spellKind(s, gun) {
  if (s && s.sp && s.sp.k) return s.sp.k;
  if (s && s.kind) return s.kind;
  if (s && s.col === '#ffe14a') return 'flare';
  if (s && s.col === '#ffd36a') return 'shot';
  return gun ? 'shot' : 'ember';
}
function makeBolt() {
  const g = new THREE.Group();
  const shapes = {};
  const add = (kind, mesh) => { mesh.visible = false; g.add(mesh); shapes[kind] = mesh; };
  const ember = ink(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 8), toon('#ff8a3d')));
  ember.rotation.x = Math.PI / 2;
  add('ember', ember);
  const frost = ink(new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), toon('#bff4ff')));
  frost.scale.set(0.85, 1.9, 0.85);
  add('frost', frost);
  const nova = ink(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.1, 8, 20), toon('#ffc94d')));
  nova.rotation.x = Math.PI / 2;
  add('nova', nova);
  const shot = ink(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.62, 3, 6), toon('#ff4455')));
  shot.rotation.x = Math.PI / 2;
  add('shot', shot);
  add('flare', ink(new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), toon('#ffe14a'))));
  add('ward', ink(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 18), toon('#9dffc8'))));
  const glow = new THREE.Sprite(glowMat(0xffd27a));
  glow.scale.set(1.8, 1.8, 1);
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.55, 20), new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
  }));
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = -0.7;
  g.add(mark);
  g.userData.mark = mark;
  g.add(glow);
  g.visible = false;
  scene.add(g);
  return { g, shapes, glow, mark, life: 0 };
}
function buildCasts() {
  wardMesh = new THREE.Group();
  const band = part(new THREE.TorusGeometry(1.15, 0.08, 8, 28), toon('#9dffc8'), 0, 1.15, 0, wardMesh);
  band.rotation.x = Math.PI / 2;
  const collar = part(new THREE.TorusGeometry(1.05, 0.06, 8, 24), toon('#eafff4'), 0, 0.35, 0, wardMesh);
  collar.rotation.x = Math.PI / 2;
  wardShell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.15, 2.3, 16, 1, true),
    toon('#9dffc8', { transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })
  );
  wardShell.position.y = 1.15;
  wardMesh.add(wardShell);
  wardMesh.visible = false;
  scene.add(wardMesh);
  novaRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.07, 8, 28),
    toon('#ffc94d', { transparent: true, opacity: 0.9, depthWrite: false })
  );
  novaRing.rotation.x = Math.PI / 2;
  novaRing.position.y = 0.08;
  novaRing.visible = false;
  scene.add(novaRing);
  slashBar = ink(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 1), toon('#ff5ad8')));
  slashBar.visible = false;
  scene.add(slashBar);
  for (let i = 0; i < 6; i++) {
    const slab = part(new THREE.BoxGeometry(0.72, 1.15, 0.22), toon('#d7f6ff').clone(), 0, 0, 0);
    const cap = part(new THREE.BoxGeometry(0.5, 0.16, 0.28), toon('#ffffff').clone(), 0, 0.62, 0, slab);
    cap.position.y = 0.62;
    slab.visible = false;
    scene.add(slab);
    wallBits.push(slab);
  }
  fragMesh = ink(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon('#ffb45a')));
  fragMesh.visible = false;
  scene.add(fragMesh);
  turretMesh = new THREE.Group();
  part(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 8), toon('#ffd36a'), 0, 0.2, 0, turretMesh);
  const barrel = part(new THREE.CapsuleGeometry(0.045, 0.28, 3, 6), toon('#b7c0ce'), 0, 0.34, 0.16, turretMesh);
  barrel.rotation.x = Math.PI / 2;
  turretMesh.visible = false;
  scene.add(turretMesh);
  droneMesh = new THREE.Group();
  part(new THREE.OctahedronGeometry(0.16, 0), toon('#7fd8ff'), 0, 0, 0, droneMesh);
  part(new THREE.BoxGeometry(0.34, 0.04, 0.1), toon('#d7f4ff'), 0, 0.02, 0, droneMesh);
  droneMesh.visible = false;
  scene.add(droneMesh);
  flareMark = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe14a, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })
  );
  flareMark.rotation.x = -Math.PI / 2;
  flareMark.position.y = 0.06;
  flareMark.visible = false;
  scene.add(flareMark);
}
function layBar(mesh, x0, z0, x1, z1, y) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.max(0.2, Math.hypot(dx, dz));
  mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  mesh.scale.set(1, 1, len);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.visible = true;
}
function syncCasts(g, dt) {
  const field = window.__aro && window.__aro.FIELD;
  const gun = window.__gun && window.__gun.GUN;
  const tr = g.TRAIN;
  if (state.wardN < 0) state.wardN = tr ? (tr.casts || 0) : 0;
  if (tr && tr.last && tr.last.ok && tr.last.spell === 'ward' && state.wardN !== tr.casts) {
    state.wardN = tr.casts;
    state.guard = 2.6;
  }
  if (g.AR.guardT > 0) state.guard = g.AR.guardT;
  else state.guard = Math.max(0, state.guard - dt);
  if (wardMesh) {
    wardMesh.visible = state.guard > 0;
    if (wardMesh.visible) {
      wardMesh.position.set(g.AR.ppx || 0, 0, g.AR.ppy || 0);
      wardMesh.rotation.y = state.t * 1.4;
      const s = 0.92 + Math.sin(state.t * 5) * 0.05;
      wardMesh.scale.setScalar(s);
      if (wardShell) wardShell.material.opacity = 0.22 + 0.22 * Math.min(1, state.guard);
    }
  }
  if (g.AR.novaT >= 0) {
    state.nova = Math.max(state.nova, 0.9 - g.AR.novaT);
    state.novaAt = { x: g.AR.ppx || 0, z: g.AR.ppy || 0 };
  }
  if (novaRing) {
    novaRing.visible = state.nova > 0;
    if (novaRing.visible) {
      const k = 1 - Math.min(1, state.nova / 0.9);
      novaRing.position.set(state.novaAt.x, 0.08, state.novaAt.z);
      novaRing.scale.setScalar(0.35 + k * 3.4);
      novaRing.material.opacity = Math.max(0.05, state.nova);
    }
    state.nova = Math.max(0, state.nova - dt);
  }
  if (slashBar) {
    slashBar.visible = false;
    const cut = field && field.cut && field.cut.t < 0.45 ? field.cut : null;
    const wind = field && field.pslash;
    const line = cut || wind;
    if (line) layBar(slashBar, line.x0, line.y0, line.x1, line.y1, cut ? 0.72 : 0.55);
  }
  wallBits.forEach(m => { m.visible = false; });
  const wall = field && field.wall;
  if (wall && wall.hexes) {
    wall.hexes.forEach((h, i) => {
      if (!wallBits[i]) return;
      const p = hexOf(h[0], h[1]);
      const slab = wallBits[i];
      const shake = (wall.shake || 0) * (i % 2 ? 0.1 : -0.1);
      const k = wall.max ? Math.max(0.2, wall.hp / wall.max) : 1;
      slab.visible = true;
      slab.position.set(p.x + shake, 0.55 * k, p.z);
      slab.scale.y = k;
    });
  }
  if (fragMesh) {
    const frag = gun && gun.frag;
    fragMesh.visible = !!frag;
    if (frag) {
      const span = (frag.warn || 0.5) + 0.45;
      const u = Math.min(1, (frag.t || 0) / span);
      fragMesh.position.set(
        frag.x0 + (frag.x - frag.x0) * u,
        0.25 + Math.sin(u * Math.PI) * 1.35,
        frag.y0 + (frag.y - frag.y0) * u
      );
      fragMesh.rotation.y = state.t * 6;
    }
  }
  if (turretMesh) {
    const turret = gun && gun.turret;
    turretMesh.visible = !!turret;
    if (turret) {
      turretMesh.position.set(turret.x, 0, turret.y);
      turretMesh.rotation.y = Math.PI / 2 - (turret.aim || 0);
    }
  }
  if (droneMesh) {
    const drone = gun && gun.drone;
    droneMesh.visible = !!drone;
    if (drone) {
      droneMesh.position.set(drone.x, 0.9 - (drone.dip || 0), drone.y);
      droneMesh.rotation.y = state.t * 3;
    }
  }
  state.flare = Math.max(0, state.flare - dt);
  if (flareMark) {
    flareMark.visible = state.flare > 0;
    if (flareMark.visible) {
      flareMark.position.set(state.flareAt.x, 0.06, state.flareAt.z);
      flareMark.material.opacity = Math.min(0.95, state.flare);
    }
  }
}

function buildPools() {
  for (let i = 0; i < 3; i++) {
    const p = part(new THREE.CylinderGeometry(0.16, 0.2, 1.25, 6), toon('#6a3a32').clone(), 0, 0.62, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toon('#ff4455').clone());
    head.position.y = 1.15;
    p.add(head);
    p.userData.head = head;
    p.visible = false;
    posts.push(p);
  }
  for (let i = 0; i < 6; i++) {
    const b = part(new THREE.SphereGeometry(0.28, 8, 6), toon('#67d08a').clone(), 0, 0.4, 0);
    b.visible = false;
    mobBlobs.push(b);
  }
  for (let i = 0; i < BOLTS; i++) bolts.push(makeBolt());
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
      const a = k / 6 * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2);
      g.add(s);
    }
    g.visible = false;
    scene.add(g);
    bursts.push({ g, life: 0 });
  }
}

function ensure() {
  if (state.built) return true;
  const canvas = document.getElementById('fightCv');
  if (!canvas) return false;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: /(?:^|[?&])shot3d=1/.test(location.search),
    });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.innerWidth < 700 ? 1 : 1.25, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#070814');
  scene.fog = new THREE.Fog('#070814', 8, 18);
  scene.add(new THREE.AmbientLight(0x8899bb, 0.4));
  sun = new THREE.DirectionalLight(0xdde7ff, 1.35);
  sun.position.set(3.5, 8, 4);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(56, 1, 0.08, 40);
  scene.add(camera);
  grad = gradMap();
  buildHexes();
  buildRain();
  buildHands();
  buildRifle();
  buildBoss();
  buildPools();
  buildPet();
  buildSlamRing();
  buildCasts();
  buildWeatherMobs();
  loadMobRigs().catch(err => console.warn('mob rigs', err));
  state.built = true;
  resize();
  return true;
}

function resize() {
  const canvas = document.getElementById('fightCv');
  if (!renderer || !canvas) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function show(on) {
  state.on = on;
  document.body.classList.toggle('field-on', on);
  const canvas = document.getElementById('fightCv');
  if (canvas) canvas.classList.toggle('on', on);
  if (reticle) reticle.classList.toggle('on', on && !!(game() && game().TRAIN && window.__aro && window.__aro.G && window.__aro.G.cls === 'gunner'));
}

function placeCamera(g) {
  const view = g.TRAIN.on ? g.TRAIN.view : (g.AR.roomLow ? 'low' : 'tactical');
  const px = g.AR.ppx || 0, pz = g.AR.ppy || 0;
  if (view === 'fp') {
    camera.position.set(px, 1.5, pz + 0.15);
    camera.lookAt(px, 0.72, pz - 6);
    hands.visible = true;
  } else if (view === 'low') {
    camera.position.set(px, 2.2, pz + 2.4);
    camera.lookAt(0, 0.6, -4);
    hands.visible = false;
  } else {
    camera.position.set(px * 0.2, 8.2, pz + 4.2);
    camera.lookAt(0, 0, -3);
    hands.visible = false;
  }
  const calm = g.SET && g.SET.cozy;
  const sh = !calm && g.AR && g.AR.shake > 0.18 ? g.AR.shake : 0;
  if (sh) {
    camera.position.x += Math.sin(performance.now() * 0.04) * sh * 0.12;
    camera.position.y += Math.cos(performance.now() * 0.05) * sh * 0.05;
  }
}

function nearBoss(x, z) {
  return Math.hypot(x - boss.position.x, z - boss.position.z) < 1.45;
}
function hurtBoss(n) {
  state.bossHp = Math.max(0, state.bossHp - n);
  state.flash = 1;
}
function takeShot(s, x, z, k) {
  if (seen.has(s) || k < 0.72) return;
  seen.add(s);
  if (nearBoss(x, z)) hurtBoss(18);
  const b = bursts.find(it => it.life <= 0);
  if (b) { b.life = 0.28; b.g.visible = true; b.g.position.set(x, 0.2, z); }
}

function syncShots(g) {
  const gunner = g.G.cls === 'gunner';
  const list = [];
  for (const s of g.AR.shots || []) list.push(s);
  for (const s of g.TRAIN.bolts || []) list.push(s);
  const tracers = window.__gun && window.__gun.GUN && window.__gun.GUN.tracers;
  if (tracers) for (const s of tracers) list.push(Object.assign({ kind: 'shot' }, s));
  let n = 0;
  for (const s of list) {
    if (n >= bolts.length) break;
    const dur = s.dur || s.life || 0.12;
    const k = Math.min(1, (s.t || 0) / dur);
    const x1 = s.mob ? s.mob.x : s.x1, z1 = s.mob ? s.mob.y : s.y1;
    if (x1 == null || z1 == null) continue;
    const x = s.x0 + (x1 - s.x0) * k, z = s.y0 + (z1 - s.y0) * k;
    const kind = spellKind(s, gunner);
    const slot = bolts[n++];
    slot.life = 1 - k;
    slot.g.visible = true;
    const y = kind === 'nova' ? 0.55 + Math.sin(k * Math.PI) * 0.45 : 0.85;
    slot.g.position.set(x, y, z);
    slot.g.rotation.y = Math.atan2(x1 - s.x0, z1 - s.y0);
    Object.keys(slot.shapes).forEach(key => { slot.shapes[key].visible = key === kind || (kind === 'frag' && key === 'shot'); });
    if (!slot.shapes[kind] && slot.shapes.ember) slot.shapes.ember.visible = true;
    const col = s.col ? new THREE.Color(s.col).getHex() : (SPELL_COL[kind] || (gunner ? 0xff4455 : 0xff8a3d));
    if (slot.glow) slot.glow.material = glowMat(col);
    if (slot.mark) slot.mark.material.color.setHex(col);
    if (slot.shapes.frost && slot.shapes.frost.visible) slot.shapes.frost.rotation.z = state.t * 9;
    if (slot.shapes.flare && slot.shapes.flare.visible) slot.shapes.flare.rotation.y = state.t * 7;
    if (kind === 'nova') {
      state.nova = Math.max(state.nova, 0.7);
      state.novaAt = { x: x1, z: z1 };
    }
    if (kind === 'ward') state.guard = Math.max(state.guard, 2.6);
    if (kind === 'flare' && k > 0.72) { state.flare = Math.max(state.flare, 2.2); state.flareAt = { x: x1, z: z1 }; }
    if (!seen.has(s) && s.x1 !== undefined) { state.muzzle = 0.16; state.kick = 1; }
    takeShot(s, x, z, k);
  }
  for (let i = n; i < bolts.length; i++) bolts[i].g.visible = false;
  hands.visible = hands.visible && !gunner;
  rifle.visible = gunner && g.TRAIN.on && g.TRAIN.view === 'fp';
  rune.visible = !gunner && ((g.TRAIN.charge || 0) > 0.04 || state.cast > 0);
  const sc = 0.8 + (g.TRAIN.charge || 0) * 0.15;
  rune.scale.setScalar(sc);
  rune.rotation.z += 0.08;
  glass.material.opacity = 0.28 + Math.min(0.4, (g.TRAIN.guide || 0) * 0.35 + (g.TRAIN.charge || 0) * 0.2);
  if ((g.TRAIN.charge || 0) > 0.2) state.cast = 0.35;
}

function syncActors(g) {
  syncRolledFigures(g);
  const mobs = (g.AR.mobs || []).filter(m => m.state !== 'gone' && m.state !== 'panel');
  const dummies = mobs.filter(m => m.dummy);
  posts.forEach((p, i) => {
    if (!state.story) { p.visible = false; return; }
    const m = dummies[i];
    p.visible = !!m;
    if (!m) return;
    p.position.set(m.x, 0, m.y);
    const hit = m.fl > 0;
    p.material.color.set(hit ? '#fff6e0' : '#c9846a');
    if (p.userData.head) p.userData.head.material.color.set(hit ? '#fff6e0' : '#ff4455');
  });
  let b = 0;
  if (!state.story) mobBlobs.forEach(bl => { bl.visible = false; });
  else for (const m of mobs) {
    if (m.dummy || b >= mobBlobs.length) continue;
    const kind = standKind(m.rollId);
    if (m.tier === 'boss' || kind === 'rig-blob' || kind === 'rig-beast' || kind === 'rig-brute') continue;
    const blob = mobBlobs[b++];
    blob.visible = true;
    blob.position.set(m.x, 0.4, m.y);
    blob.material.color.set(m.fl > 0 ? '#ffffff' : '#7dffa8');
  }
  if (state.story) for (let i = b; i < mobBlobs.length; i++) mobBlobs[i].visible = false;
  const raidBoss = mobs.find(m => m.tier === 'boss');
  const rigBoss = syncBossRig(g, mobs);
  let bx = 0, bz = -4.6;
  if (raidBoss) { bx = raidBoss.x; bz = raidBoss.y; }
  else if (!state.story && state.showBrute && state.bruteAt) { bx = state.bruteAt.x; bz = state.bruteAt.z; }
  boss.visible = rigBoss || state.story || !!raidBoss || !!state.showBrute;
  if (raidBoss) {
    state.bossHp = Math.max(0, raidBoss.hp);
    state.bossMax = raidBoss.max || BOSS_MAX;
  }
  const flinch = state.bruteFlinch ? 0.28 : (state.flash > 0 ? 0.35 * state.flash : 0);
  const baseY = state.bossHp <= 0 ? -0.4 : 0;
  boss.scale.setScalar(rigBoss ? 1 : (!state.story && state.showBrute ? (state.weatherKind === 'storm' ? 1.25 : 1.1) : 1.55));
  boss.position.set(bx, baseY + Math.sin(state.t * 1.4) * 0.06, bz + flinch);
  boss.rotation.y = Math.sin(state.t * 0.7) * 0.22;
  boss.rotation.z = Math.sin(state.t * 0.9) * 0.05;
  boss.rotation.x = state.flash > 0 ? -0.45 * state.flash : Math.sin(state.t * 0.55) * 0.04;
  const hpK = state.bossMax ? state.bossHp / state.bossMax : 0;
  bossBar.scale.x = Math.max(0.04, hpK);
  bossBar.position.x = -0.33 * (1 - hpK);
  bossBar.material.color.set(hpK > 0.35 ? '#3de07a' : '#ff4455');
  const hit = state.flash > 0;
  bossWire.material.color.set(hit ? '#ffffff' : '#8fe8ff');
  bossEyes.forEach(e => { e.scale.setScalar(hit ? 1.7 : 1); });
  const plate = syncKingPlate(g);
  state.plate = plate;
  syncBoarPlate(g);
  syncRaidFloor(g);
}

function syncGun(g) {
  state.reload = g.TRAIN.shotCd || 0;
  const kick = state.kick * 0.08;
  rifle.position.z = -0.64 + kick;
  rifle.rotation.x = state.reload > 0 ? 0.35 : kick * 2;
  rifle.userData.mag.position.y = -0.1 - (state.reload > 0 ? 0.06 : 0);
  rifle.userData.flash.visible = state.muzzle > 0;
  if (reticle) reticle.classList.toggle('on', state.on && g.G.cls === 'gunner');
}

function stepRain(t) {
  const snow = state.weatherKind === 'snow';
  const wind = state.weatherKind === 'wind' || state.weatherKind === 'storm';
  const speed = snow ? 1.2 : 3;
  for (let i = 0; i < RAIN; i++) {
    const y = (6 - ((t * speed + i * 0.37) % 6));
    const x = ((i * 1.3) % 8) - 4 + (wind ? Math.sin(t + i) * 0.8 : 0);
    dummy.position.set(x, y, -((i * 1.7) % 11) + 3);
    dummy.rotation.set(0.2, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    rainMesh.setMatrixAt(i, dummy.matrix);
  }
  rainMesh.instanceMatrix.needsUpdate = true;
}

function frame(now) {
  requestAnimationFrame(frame);
  const on = live();
  if (on !== state.on) show(on);
  if (!on) return;
  if (!ensure()) return;
  const g = game();
  const dt = Math.min(0.05, (now - (frame.then || now)) / 1000 || 0.016);
  frame.then = now;
  state.t += dt;
  state.flash = Math.max(0, state.flash - dt * 3.2);
  state.sky = Math.max(0, state.sky - dt);
  const stormRate = state.weatherKind === 'storm' ? 0.85 : state.weatherKind === 'rain' ? 0.05 : state.story ? 0.28 : 0;
  if (state.sky <= 0 && Math.random() < dt * stormRate) state.sky = 0.14;
  if (state.parkOn) state.sky = 0;
  if (boltSky) boltSky.material.opacity = state.sky > 0 ? 0.72 : 0;
  if (streak) streak.material.opacity = state.sky > 0.03 ? 0.95 : 0;
  state.kick = Math.max(0, state.kick - dt * 6);
  state.muzzle = Math.max(0, state.muzzle - dt);
  state.cast = Math.max(0, state.cast - dt);
  placeCamera(g);
  syncWorld(g);
  const fp = !!(g.TRAIN.on && g.TRAIN.view === 'fp');
  document.body.classList.toggle('fight-fp', fp);
  document.body.classList.toggle('fp-clear', fp && !state.practice);
  syncShots(g);
  syncCasts(g, dt);
  syncActors(g);
  syncPet(g);
  syncSlam(g);
  syncGun(g);
  stepRain(now / 1000);
  for (const a of rigActors) {
    if (a.root.visible || a.hold > 0) a.mixer.update(dt);
    if (a.hold > 0) a.hold -= dt;
  }
  Object.keys(petRigs).forEach(k => { if (petRigs[k] && petRigs[k].root.visible) petRigs[k].mixer.update(dt); });
  bursts.forEach(b => {
    if (b.life <= 0) { b.g.visible = false; return; }
    b.life -= dt;
    const k = 1 - b.life / 0.28;
    b.g.scale.setScalar(0.6 + k * 1.4);
    b.g.visible = b.life > 0;
  });
  renderer.render(scene, camera);
}

function mount() {
  const style = document.createElement('style');
  style.textContent = [
    '#fightCv{position:fixed;left:0;right:0;top:0;height:100%;z-index:2;display:none;pointer-events:none;width:100%}',
    '#fightCv.on{display:block}',
    '#aimCv{position:fixed;inset:0;width:100%;height:100%;z-index:4;display:none;pointer-events:none}',
    'body.field-on #aimCv{display:block}',
    'body.field-on #trainHud{left:8px;right:auto;width:max-content;max-width:calc(100% - 16px)}',
    'body.field-on #obj{left:8px;right:auto;transform:none;top:calc(118px + var(--sat));max-width:46vw;text-align:left}',
    'body.field-on #trainHud .rowb button{flex:0 1 auto;min-width:64px;padding:6px 10px}',
    'body.field-on #castFeed{top:auto !important;bottom:108px;max-width:42vw}',
    'body.field-on #itemBoard{top:auto !important;bottom:148px;right:8px}',
    'body.field-on #cellBtn{top:auto !important;bottom:108px;right:8px}',
    '#fightReticle{position:fixed;left:50%;top:34%;width:54px;height:54px;margin:-27px 0 0 -27px;border:2px solid rgba(80,220,255,.9);border-radius:50%;display:none;pointer-events:none;z-index:3;box-shadow:0 0 0 1px rgba(255,40,70,.8) inset}',
    '#fightReticle.on{display:block}',
    '#fightReticle:before,#fightReticle:after{content:"";position:absolute;background:#ff3355}',
    '#fightReticle:before{left:50%;top:6px;bottom:6px;width:2px;margin-left:-1px}',
    '#fightReticle:after{top:50%;left:6px;right:6px;height:2px;margin-top:-1px}',
    '#fpPractice{position:fixed;left:12px;top:calc(8px + env(safe-area-inset-top,0px));z-index:16;display:none;min-height:36px;padding:6px 12px;border-radius:12px;border:1px solid rgba(226,196,138,.7);background:rgba(20,12,18,.88);color:#f6e2c4;font:800 13px sans-serif}',
    'body.fight-fp #fpPractice{display:block}',
    'body.fp-clear #trainHud .rowb,body.fp-clear #trainHud .note,body.fp-clear #trainHelp,body.fp-clear #obj,body.fp-clear #castFeed,body.fp-clear #cellBtn,body.fp-clear #itemBoard,body.fp-clear #itemBubble{display:none !important}',
  ].join('');
  document.head.appendChild(style);
  const canvas = document.createElement('canvas');
  canvas.id = 'fightCv';
  document.body.appendChild(canvas);
  const aim = document.createElement('canvas');
  aim.id = 'aimCv';
  document.body.appendChild(aim);
  reticle = document.createElement('div');
  reticle.id = 'fightReticle';
  document.body.appendChild(reticle);
  const practice = document.createElement('button');
  practice.id = 'fpPractice';
  practice.type = 'button';
  practice.textContent = 'Practice';
  practice.onclick = () => {
    const on = !document.body.classList.contains('practice-on');
    if (window.setPractice) window.setPractice(on);
    else state.practice = on;
    practice.setAttribute('aria-expanded', on ? 'true' : 'false');
  };
  document.body.appendChild(practice);
  window.addEventListener('resize', resize);
  window.__fight = {
    status: () => ({
      on: state.on, hexes: state.hexes, gradient: 2, bossHp: state.bossHp, bossMax: state.bossMax,
      lights: 1, rain: RAIN, outlined: true, toon: true, rigs: mobsReady ? rigActors.length : 0,
      follow: Object.keys(petRigs).length, weather: state.weatherKind, story: !!state.story,
      guard: state.guard > 0, nova: state.nova > 0, flare: state.flare > 0,
      wall: wallBits.some(m => m.visible), slash: !!(slashBar && slashBar.visible),
      frag: !!(fragMesh && fragMesh.visible), turret: !!(turretMesh && turretMesh.visible),
      drone: !!(droneMesh && droneMesh.visible),
      plate: state.plate || { on: false, mode: 'off' },
    }),
    plate: () => state.plate || { on: false, mode: 'off' },
    floor: () => state.raidFloor || { on: false, art: 'raid-floor', ready: false },
    boar: () => state.boar || { on: false, mode: 'off' },
    park: () => state.park || { on: false, mode: 'off' },
    strike: () => { if (ensure()) hurtBoss(18); return state.bossHp; },
    setPractice: (on) => { state.practice = !!on; },
  };
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
