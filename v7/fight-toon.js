/* Toon fight layer for the training yard and the raid start.
   One directional light. Instanced hexes. Pooled rain, bolts, and bursts.
   No post-processing. The 2D canvas underneath keeps the disc, the forearm
   mark, and the existing controls. This view does not open a WebXR session. */
import * as THREE from './vendor/three.module.min.js';

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
  hexes: 0,
  built: false,
};

let renderer, scene, camera, sun, grad;
let hexMesh, hexInk, edgeMesh, rainMesh;
let hands, rifle, glass, rune, boss, bossWire, bossEyes, bossBar;
let reticle;
const posts = [];
const mobBlobs = [];
const bolts = [];
const bursts = [];
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
  if (g.TRAIN && g.TRAIN.on) return true;
  return g.AR.kind === 'raid' && (g.AR.phase === 'block' || g.AR.phase === 'wave' || g.AR.phase === 'arm');
}
function hexOf(q, r) { return { x: SQ3 * (q + r / 2), z: 1.5 * r }; }

function buildHexes() {
  const cells = [];
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) {
    const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
    if (dist <= 3) cells.push({ q, r, pit: dist === 2 && (q + r) % 2 === 0 });
  }
  state.hexes = cells.length;
  const top = new THREE.CylinderGeometry(0.94, 0.98, 0.14, 6);
  const rim = new THREE.CylinderGeometry(1.02, 1.02, 0.05, 6, 1, true);
  const inkGeo = top.clone(); inkGeo.scale(1.05, 1.5, 1.05);
  hexMesh = new THREE.InstancedMesh(top, toon('#3a4c66'), cells.length);
  hexInk = new THREE.InstancedMesh(inkGeo, INK.clone(), cells.length);
  edgeMesh = new THREE.InstancedMesh(rim, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), cells.length);
  const neon = [new THREE.Color('#3de0ff'), new THREE.Color('#b06bff'), new THREE.Color('#ff3355')];
  cells.forEach((c, i) => {
    const p = hexOf(c.q, c.r);
    const y = c.pit ? -0.08 : 0;
    dummy.position.set(p.x, y, p.z);
    dummy.rotation.set(0, Math.PI / 6, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hexMesh.setMatrixAt(i, dummy.matrix);
    hexInk.setMatrixAt(i, dummy.matrix);
    edgeMesh.setMatrixAt(i, dummy.matrix);
    edgeMesh.setColorAt(i, c.pit ? neon[2] : neon[(c.q + c.r + 6) % 3]);
    if (c.pit) {
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.22), new THREE.MeshBasicMaterial({ color: (i % 2) ? 0xff3355 : 0xd56bff }));
      crack.rotation.x = -Math.PI / 2;
      crack.position.set(p.x, 0.02, p.z);
      scene.add(crack);
    }
  });
  hexMesh.instanceMatrix.needsUpdate = true;
  hexInk.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceColor.needsUpdate = true;
  scene.add(hexMesh, hexInk, edgeMesh);
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
  const skin = toon('#e7b48a');
  const cuff = toon('#1c2430');
  const makeHand = (side) => {
    const h = new THREE.Group();
    h.position.set(side * 0.34, -0.16, -0.62);
    h.scale.setScalar(1.35);
    part(new THREE.BoxGeometry(0.16, 0.08, 0.2), skin, 0, 0, 0, h);
    part(new THREE.BoxGeometry(0.12, 0.1, 0.12), cuff, side * -0.02, 0.02, 0.12, h);
    part(new THREE.BoxGeometry(0.1, 0.035, 0.08), skin, 0, 0.02, -0.12, h);
    return h;
  };
  const left = makeHand(-1), right = makeHand(1);
  hands.add(left, right);
  glass = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), toon('#9eefff', { transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.set(-0.02, 0.04, -0.16);
  left.add(glass);
  ink(glass, 1.08);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 18), new THREE.MeshBasicMaterial({ color: 0xcff6ff }));
  rim.position.copy(glass.position);
  left.add(rim);
  rune = new THREE.Group();
  rune.position.set(0.02, 0.08, -0.28);
  right.add(rune);
  rune.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffb15a })));
  for (let i = 0; i < 6; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }));
    const a = i / 6 * Math.PI * 2;
    mark.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0);
    rune.add(mark);
  }
  rune.visible = false;
}

function buildRifle() {
  rifle = new THREE.Group();
  rifle.position.set(0.28, -0.14, -0.55);
  camera.add(rifle);
  const body = toon('#3a2a28');
  const metal = toon('#8d97a6');
  part(new THREE.BoxGeometry(0.08, 0.1, 0.34), body, 0, 0, 0.02, rifle);
  part(new THREE.BoxGeometry(0.07, 0.08, 0.16), body, 0, -0.02, 0.16, rifle);
  const barrel = part(new THREE.CylinderGeometry(0.025, 0.03, 0.36, 6), metal, 0, 0.04, -0.22, rifle);
  barrel.rotation.x = Math.PI / 2;
  rifle.userData.mag = part(new THREE.BoxGeometry(0.05, 0.12, 0.06), toon('#1a1c22'), 0, -0.1, 0.02, rifle);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  flash.rotation.x = -Math.PI / 2;
  flash.position.set(0, 0.04, -0.46);
  flash.visible = false;
  rifle.add(flash);
  rifle.userData.flash = flash;
  rifle.visible = false;
}

function buildBoss() {
  boss = new THREE.Group();
  scene.add(boss);
  const glassMat = toon('#17304a', { transparent: true, opacity: 0.55, depthWrite: false });
  part(new THREE.BoxGeometry(0.7, 0.55, 0.4), glassMat, 0, 0.85, 0, boss);
  part(new THREE.BoxGeometry(0.42, 0.36, 0.36), glassMat, 0, 1.35, 0, boss);
  part(new THREE.BoxGeometry(0.22, 0.55, 0.22), glassMat, -0.5, 0.9, 0, boss);
  part(new THREE.BoxGeometry(0.22, 0.55, 0.22), glassMat, 0.5, 0.9, 0, boss);
  bossWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), new THREE.MeshBasicMaterial({ color: 0x7fd0ff, wireframe: true }));
  bossWire.position.y = 0.95;
  boss.add(bossWire);
  bossEyes = [];
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    eye.position.set(x, 1.38, 0.16);
    boss.add(eye);
    bossEyes.push(eye);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: 0x1a1018 }));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0x3de07a }));
  back.position.set(0, 1.85, 0);
  fill.position.set(0, 1.85, 0.01);
  boss.add(back, fill);
  bossBar = fill;
  boss.position.set(0, 0, -4.6);
  boss.scale.setScalar(1.7);
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
  for (let i = 0; i < BOLTS; i++) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
    core.scale.set(1, 1, 2.4);
    g.add(core);
    const trail = [];
    for (let t = 0; t < 4; t++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.05 - t * 0.008, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.8 - t * 0.15 }));
      g.add(s);
      trail.push(s);
    }
    g.visible = false;
    scene.add(g);
    bolts.push({ g, core, trail, life: 0 });
  }
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
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
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
  const gun = g.G.cls === 'gunner';
  const list = [];
  for (const s of g.AR.shots || []) list.push(s);
  for (const s of g.TRAIN.bolts || []) list.push(s);
  let n = 0;
  for (const s of list) {
    if (n >= bolts.length) break;
    const dur = s.dur || s.life || 0.3;
    const k = Math.min(1, (s.t || 0) / dur);
    const x1 = s.mob ? s.mob.x : s.x1, z1 = s.mob ? s.mob.y : s.y1;
    const x = s.x0 + (x1 - s.x0) * k, z = s.y0 + (z1 - s.y0) * k;
    const slot = bolts[n++];
    slot.life = 1 - k;
    slot.g.visible = true;
    slot.g.position.set(x, 0.85, z);
    const col = gun ? 0xff4455 : 0xffd27a;
    slot.core.material.color.setHex(col);
    slot.trail.forEach((p, i) => { p.position.set(0, 0, 0.16 + i * 0.12); });
    if (!seen.has(s) && s.x1 !== undefined) { state.muzzle = 0.16; state.kick = 1; }
    takeShot(s, x, z, k);
  }
  for (let i = n; i < bolts.length; i++) bolts[i].g.visible = false;
  hands.visible = hands.visible && !gun;
  rifle.visible = gun && g.TRAIN.on && g.TRAIN.view === 'fp';
  rune.visible = !gun && ((g.TRAIN.charge || 0) > 0.04 || state.cast > 0);
  const sc = 0.45 + (g.TRAIN.charge || 0) * 0.9;
  rune.scale.setScalar(sc);
  rune.rotation.z += 0.08;
  glass.material.opacity = 0.28 + Math.min(0.4, (g.TRAIN.guide || 0) * 0.35 + (g.TRAIN.charge || 0) * 0.2);
  if ((g.TRAIN.charge || 0) > 0.2) state.cast = 0.35;
}

function syncActors(g) {
  const mobs = (g.AR.mobs || []).filter(m => m.state !== 'gone' && m.state !== 'panel');
  const dummies = mobs.filter(m => m.dummy);
  posts.forEach((p, i) => {
    const m = dummies[i];
    p.visible = !!m;
    if (!m) return;
    p.position.set(m.x, 0, m.y);
    const hit = m.fl > 0;
    p.material.color.set(hit ? '#fff6e0' : '#c9846a');
    if (p.userData.head) p.userData.head.material.color.set(hit ? '#fff6e0' : '#ff4455');
  });
  let b = 0;
  for (const m of mobs) {
    if (m.dummy || b >= mobBlobs.length) continue;
    const blob = mobBlobs[b++];
    blob.visible = true;
    blob.position.set(m.x, 0.4, m.y);
    blob.material.color.set(m.fl > 0 ? '#ffffff' : '#7dffa8');
  }
  for (let i = b; i < mobBlobs.length; i++) mobBlobs[i].visible = false;
  const raidBoss = mobs.find(m => m.tier === 'boss');
  if (raidBoss) {
    boss.position.set(raidBoss.x, 0, raidBoss.y);
    state.bossHp = Math.max(0, raidBoss.hp);
    state.bossMax = raidBoss.max || BOSS_MAX;
  }
  const hpK = state.bossMax ? state.bossHp / state.bossMax : 0;
  bossBar.scale.x = Math.max(0.04, hpK);
  bossBar.position.x = -0.33 * (1 - hpK);
  bossBar.material.color.set(hpK > 0.35 ? '#3de07a' : '#ff4455');
  const flash = state.flash > 0;
  bossWire.material.color.set(flash ? '#ffffff' : '#7fd0ff');
  bossEyes.forEach(e => { e.scale.setScalar(flash ? 1.6 : 1); });
  boss.position.y = state.bossHp <= 0 ? -0.35 : 0;
}

function syncGun(g) {
  state.reload = g.TRAIN.shotCd || 0;
  const kick = state.kick * 0.08;
  rifle.position.z = -0.55 + kick;
  rifle.rotation.x = state.reload > 0 ? 0.35 : kick * 2;
  rifle.userData.mag.position.y = -0.1 - (state.reload > 0 ? 0.06 : 0);
  rifle.userData.flash.visible = state.muzzle > 0;
  if (reticle) reticle.classList.toggle('on', state.on && g.G.cls === 'gunner');
}

function stepRain(t) {
  for (let i = 0; i < RAIN; i++) {
    const y = (6 - ((t * 3 + i * 0.37) % 6));
    dummy.position.set(((i * 1.3) % 8) - 4, y, -((i * 1.7) % 11) + 3);
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
  state.flash = Math.max(0, state.flash - dt * 4);
  state.kick = Math.max(0, state.kick - dt * 6);
  state.muzzle = Math.max(0, state.muzzle - dt);
  state.cast = Math.max(0, state.cast - dt);
  placeCamera(g);
  syncShots(g);
  syncActors(g);
  syncGun(g);
  stepRain(now / 1000);
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
    '#fightCv{position:fixed;left:0;right:0;top:0;height:calc(100% - 250px);z-index:2;display:none;pointer-events:none;width:100%}',
    '#fightCv.on{display:block}',
    '@media (max-height:520px){#fightCv{height:100%;clip-path:inset(0 168px 0 0)}}',
    '#fightReticle{position:fixed;left:50%;top:34%;width:54px;height:54px;margin:-27px 0 0 -27px;border:2px solid rgba(80,220,255,.9);border-radius:50%;display:none;pointer-events:none;z-index:3;box-shadow:0 0 0 1px rgba(255,40,70,.8) inset}',
    '#fightReticle.on{display:block}',
    '#fightReticle:before,#fightReticle:after{content:"";position:absolute;background:#ff3355}',
    '#fightReticle:before{left:50%;top:6px;bottom:6px;width:2px;margin-left:-1px}',
    '#fightReticle:after{top:50%;left:6px;right:6px;height:2px;margin-top:-1px}',
  ].join('');
  document.head.appendChild(style);
  const canvas = document.createElement('canvas');
  canvas.id = 'fightCv';
  document.body.appendChild(canvas);
  reticle = document.createElement('div');
  reticle.id = 'fightReticle';
  document.body.appendChild(reticle);
  window.addEventListener('resize', resize);
  window.__fight = {
    status: () => ({
      on: state.on, hexes: state.hexes, gradient: 2, bossHp: state.bossHp, bossMax: state.bossMax,
      lights: 1, rain: RAIN, outlined: true, toon: true,
    }),
    strike: () => { if (ensure()) hurtBoss(18); return state.bossHp; },
  };
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
