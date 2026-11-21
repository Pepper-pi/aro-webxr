import * as THREE from 'three';
import { shadowed } from './air.js';
import { holoMaterial, laneFillMaterial, railMaterial, tickHolo } from './holo.js';
import { ANGLE_DOT_MIN, ANGLE_DOT_SUPER, LANE, SWORD_OFFSET, TUNE, WALL_HALF, angleDot, bladePoints, clashMargin, flightU, wallBlocks } from './rider.js';

// A phone sword rhythm. Approach, cut angle, and wall hits are adapted from Moon Rider
// (Supermedium, MIT) in rider.js. The pattern is original. No song and no BeatSaver map.
// Slice a block with a swipe. A side swipe in the dodge strip steps out of a wall.
// A down swipe there crouches under a low wall. Hold a gold block. Four clean hits
// launch the nearest beast. The staff is left alone.
// Block, held, raises a shield. A wolf's slow lob that meets it bounces back.
// A block pressed in the last moment shows Taunt. At most five bounced pieces live.

const LOOP = 5.9;
const PATTERN = [
  { t: 0.7, lane: 0, kind: 'slice', dir: 'right', weight: 'light' },
  { t: 1.35, lane: 2, kind: 'slice', dir: 'left', weight: 'medium', shape: 'wide' },
  { t: 2.05, lane: 1, kind: 'wall', shape: 'deep' },
  { t: 2.8, lane: 1, kind: 'big', weight: 'heavy' },
  { t: 3.55, lane: 0, kind: 'slice', dir: 'up', weight: 'light' },
  { t: 4.25, lane: 1, kind: 'wall', ceiling: true, shape: 'wide' },
  { t: 5.0, lane: 1, kind: 'ring', dir: 'up', weight: 'ring' },
];

const root = () => document.getElementById('blade');
const GRAV = 14;
const MAX_BOUNCE = 5;

export function createBlade(onLaunch, bits = {}) {
  let drawn = false;
  let fightOn = true;
  let padOn = true;
  let wasEngaged = false;
  let song = 0;
  let combo = 0;
  let cursor = 0;
  let freeze = 0;
  let rush = null;
  const notes = [];
  const hold = new Map();
  const { scene, camera, world, zones, walker, air, fx, sword, sound } = bits;
  const shots = [];
  let blocking = false;
  let blockHeld = 99;
  let lobCool = 1.4;
  let boarCool = 2;
  let slimeCool = 2.6;
  const threats = [];
  let wiredBlock = false;
  const look = new THREE.Vector3();
  const lobGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const lobMat = new THREE.MeshBasicMaterial({ color: '#c9a0ff' });
  const bounceMat = new THREE.MeshBasicMaterial({ color: '#7ee0ff' });
  const shield = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  shield.visible = false;
  scene?.add(shield);
  const ARC = [[18, 68], [34, 56], [50, 46], [66, 56], [82, 64]];

  function say(text) {
    const el = document.getElementById('bladeSay');
    if (el) el.textContent = text;
  }
  function parryBurst() {
    flashParry();
    freeze = 0.12;
    hitShake = Math.max(hitShake, 0.7);
    sound?.cue?.('parry');
    if (!scene || !walker || !camera) return;
    camera.getWorldDirection(look);
    const at = camera.position.clone().add(look.clone().multiplyScalar(0.9));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.95, depthWrite: false }));
    ring.position.copy(at);
    ring.lookAt(camera.position);
    scene.add(ring);
    shots.push({ mesh: ring, v: new THREE.Vector3(), life: 0.32, kind: 'parry', stuck: true, blew: true, chopped: true });
    for (let i = 0; i < 9; i++) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffffff' : '#9ff6ff', transparent: true, opacity: 1, depthWrite: false }));
      spark.position.copy(at);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize().multiplyScalar(2.4 + Math.random());
      scene.add(spark);
      shots.push({ mesh: spark, v, life: 0.28, kind: 'spark' });
    }
  }

  function flashParry() {
    const el = document.getElementById('parry');
    if (!el) return;
    el.classList.add('on');
    clearTimeout(flashParry.t);
    flashParry.t = setTimeout(() => el.classList.remove('on'), 280);
  }

  const glows = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 1), new THREE.MeshBasicMaterial({ color: '#7ec8ff', transparent: true, opacity: 0.34, depthWrite: false }));
    m.visible = false;
    m.frustumCulled = false;
    scene?.add(m);
    return m;
  });
  let scoreTotal = 0;
  let orbsThisFight = 0;
  let slide = null;
  let stagger = 0;
  let openFor = 0;
  let pendingOrb = 0;
  let clash = null;
  let hitShake = 0;
  const burst = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.7, 22), new THREE.MeshBasicMaterial({ color: '#fff6dc', side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
  burst.rotation.x = -Math.PI / 2;
  burst.visible = false;
  scene?.add(burst);

  let lockN = null;
  let decoy = null;
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.92, 28), new THREE.MeshBasicMaterial({ color: '#f1c453', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.visible = false;
  scene?.add(aimRing);
  const decoyPost = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 6), new THREE.MeshBasicMaterial({ color: '#f1c453' }));
  decoyPost.visible = false;
  scene?.add(decoyPost);
  const origin = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.95 }));
  origin.visible = false;
  origin.frustumCulled = false;
  scene?.add(origin);
  const MAXHP = { wolf: 36, boar: 48, slime: 22, goblin: 30 };

  function focusBeast() {
    if (!camera || !zones) return null;
    const list = zones.beasts().filter((b) => !b.dead);
    if (lockN != null) {
      const held = list.find((b) => b.n === lockN);
      if (held) return held;
      lockN = null;
    }
    const eye = camera.position;
    camera.getWorldDirection(look);
    let best = null;
    let bestD = 16;
    for (const b of list) {
      const dx = b.x - eye.x;
      const dz = b.z - eye.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.3) continue;
      if ((dx / d) * look.x + (dz / d) * look.z < TUNE.cone) continue;
      best = b;
      bestD = d;
    }
    if (best) return best;
    let near = null;
    let nearD = 16;
    for (const b of list) {
      const d = Math.hypot(b.x - eye.x, b.z - eye.z);
      if (d < nearD) { near = b; nearD = d; }
    }
    return near;
  }

  function laneFrame() {
    if (!camera || !zones || !world) return null;
    const best = focusBeast();
    if (!best) return null;
    const eye = camera.position;
    const bestD = Math.hypot(best.x - eye.x, best.z - eye.z) || 1;
    return { beast: best, dist: bestD, fx: (best.x - eye.x) / bestD, fz: (best.z - eye.z) / bestD, rx: (best.z - eye.z) / bestD, rz: -(best.x - eye.x) / bestD };
  }

  function backOpen() {
    if (!decoy || !camera) return false;
    const beast = focusBeast();
    if (!beast) return false;
    const fx = decoy.x - beast.x;
    const fz = decoy.z - beast.z;
    const fl = Math.hypot(fx, fz) || 1;
    const px = camera.position.x - beast.x;
    const pz = camera.position.z - beast.z;
    const pl = Math.hypot(px, pz) || 1;
    const dot = (px / pl) * (-fx / fl) + (pz / pl) * (-fz / fl);
    return dot > Math.cos((TUNE.rearArc * Math.PI / 180) / 2);
  }

  let backNext = 0;
  let backFlip = false;

  function bendNote(note, dt) {
    if (!camera) return;
    camera.getWorldDirection(look);
    const eye = camera.position;
    const sx = eye.x + look.x * SWORD_OFFSET;
    const sz = eye.z + look.z * SWORD_OFFSET;
    const fx = note.launch.x;
    const fz = note.launch.z;
    let dx = sx - note.from.x;
    let dz = sz - note.from.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    let ang = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz);
    ang = Math.max(-TUNE.bendMax, Math.min(TUNE.bendMax, ang));
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let tx = note.from.x + (fx * c - fz * s) * len;
    let tz = note.from.z + (fx * s + fz * c) * len;
    const remain = Math.hypot(note.to.x - note.group.position.x, note.to.z - note.group.position.z);
    let snap = 1 - Math.exp(-TUNE.reaim * dt);
    if (remain < TUNE.straighten) {
      const k = 1 - remain / TUNE.straighten;
      const straightX = note.from.x + fx * len;
      const straightZ = note.from.z + fz * len;
      tx += (straightX - tx) * k;
      tz += (straightZ - tz) * k;
      snap = Math.max(snap, 1 - Math.exp(-12 * dt));
    }
    note.to.x += (tx - note.to.x) * snap;
    note.to.z += (tz - note.to.z) * snap;
  }

  let chimed = 0;
  function lockChime() {
    chimed += 1;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = lockChime.ctx || (lockChime.ctx = new Ctx());
      ctx.resume?.();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 740;
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch { /* the page may refuse audio */ }
  }

  function tryTarget(h) {
    if (!zones || Math.hypot(h.dx || 0, h.dy || 0) > 18) return false;
    let best = null;
    let bestD = 76;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      const s = project(new THREE.Vector3(b.x, (world?.ground(b.x, b.z) || 0) + 1.1, b.z));
      if (!s) continue;
      const d = Math.hypot(s.x - h.x, s.y - h.y);
      if (d < bestD) { best = b; bestD = d; }
    }
    if (best) {
      if (lockN === best.n) { lockN = null; say('Clear'); }
      else { lockN = best.n; lockChime(); flash(); say(best.kind); }
      return true;
    }
    const onNote = notes.some((n) => {
      if (n.resolved) return false;
      const s = project(n.group.position);
      return s && Math.hypot(s.x - h.x, s.y - h.y) < 80;
    });
    if (!onNote) lockN = null;
    return false;
  }

  function paintTarget() {
    const card = document.getElementById('targetCard');
    const beast = drawn ? focusBeast() : null;
    if (decoy && decoyPost && world) {
      decoyPost.visible = true;
      decoyPost.position.set(decoy.x, world.ground(decoy.x, decoy.z) + 0.65, decoy.z);
    } else if (decoyPost) decoyPost.visible = false;
    if (!card || !beast || !drawn) {
      if (card) card.hidden = true;
      aimRing.visible = false;
      const edge = document.getElementById('edgeGlow');
      if (edge) edge.hidden = true;
      return;
    }
    card.hidden = false;
    card.dataset.kind = beast.kind;
    const face = document.getElementById('targetFace');
    const pic = zones.face?.(beast.kind);
    if (face) face.style.backgroundImage = pic ? `url(${pic})` : '';
    const name = document.getElementById('targetName');
    if (name) name.textContent = beast.kind[0].toUpperCase() + beast.kind.slice(1);
    const hp = card.querySelector('.hp span');
    const stag = card.querySelector('.stag span');
    const max = MAXHP[beast.kind] || 36;
    if (hp) hp.style.width = `${Math.max(0, Math.min(100, (beast.hp / max) * 100))}%`;
    if (stag) stag.style.width = `${Math.round((openFor > 0 ? 1 : stagger) * 100)}%`;
    const gy = world.ground(beast.x, beast.z);
    aimRing.visible = true;
    aimRing.position.set(beast.x, gy + 0.08, beast.z);
    const edge = document.getElementById('edgeGlow');
    const s = project(new THREE.Vector3(beast.x, gy + 1.1, beast.z));
    if (!edge) return;
    if (!s) { edge.hidden = false; edge.style.boxShadow = 'inset 0 0 56px #ff5a4a'; return; }
    const pad = 28;
    const left = s.x < pad;
    const right = s.x > innerWidth - pad;
    const top = s.y < pad;
    const bot = s.y > innerHeight - pad;
    if (!left && !right && !top && !bot) { edge.hidden = true; return; }
    edge.hidden = false;
    const ix = left ? 18 : right ? -18 : 0;
    const iy = top ? 18 : bot ? -18 : 0;
    edge.style.boxShadow = `inset ${ix}px ${iy}px 64px #ff5a4a`;
  }

  function setDecoy(on) {
    const btn = document.getElementById('decoy');
    if (!on) { decoy = null; if (btn) btn.classList.remove('on'); say('Aggro'); return; }
    const frame = laneFrame();
    if (!frame || !camera) return;
    const eye = camera.position;
    const dx = frame.beast.x - eye.x;
    const dz = frame.beast.z - eye.z;
    const d = Math.hypot(dx, dz) || 1;
    decoy = { x: frame.beast.x + (dx / d) * 3.4, z: frame.beast.z + (dz / d) * 3.4 };
    if (btn) btn.classList.add('on');
    say('Decoy');
  }

  function layGlows() {
    glows.forEach((m) => { m.visible = false; });
  }

  function partIcon(part) {
    const ink = new THREE.MeshBasicMaterial({ color: '#1a2430' });
    if (part === 'legs') {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.045), ink);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.045), ink);
      a.position.set(-0.045, -0.02, 0.02);
      b.position.set(0.045, -0.02, 0.02);
      return [a, b];
    }
    if (part === 'back') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.04), ink);
      plate.position.z = 0.02;
      return [plate];
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), ink);
    head.position.z = 0.02;
    return [head];
  }

  const holos = [];
  const shards = [];
  const holoHex = (kind) => (kind === 'wall' ? '#ff4a42' : kind === 'big' || kind === 'back' ? '#ffd36a' : '#3ee0ff');

  function track(mat) {
    if (mat?.uniforms?.uTime) holos.push(mat);
    return mat;
  }

  function chevron() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.16);
    shape.lineTo(0.13, -0.08);
    shape.lineTo(0.045, -0.08);
    shape.lineTo(0, 0.01);
    shape.lineTo(-0.045, -0.08);
    shape.lineTo(-0.13, -0.08);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }
  const chevronGeo = chevron();

  function makeAttack(kind, dir, part, weight = 'medium', shape = '') {
    const g = new THREE.Group();
    const color = kind === 'wall' ? '#ff4a42' : kind === 'big' || kind === 'back' || weight === 'heavy' ? '#ffd36a' : kind === 'ring' ? '#9ad7ff' : kind === 'orb' ? '#e8f6ff' : '#3ee0ff';
    let body;
    if (kind === 'orb') {
      body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }));
      g.add(body, ...partIcon(part || 'head'));
    } else if (kind === 'ring') {
      body = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 8, 22), track(holoMaterial(color, 'ring')));
      body.rotation.x = Math.PI / 2;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.035, 0.045), new THREE.MeshBasicMaterial({ color: '#fff6d0', transparent: true, opacity: 0.95 }));
      g.add(body, seam);
    } else {
      const mat = track(holoMaterial(color, weight));
      const geo = kind === 'wall'
        ? (part === 'ceiling' ? new THREE.BoxGeometry(0.5, 0.16, 0.18) : new THREE.BoxGeometry(0.42, 0.9, 0.16))
        : new THREE.BoxGeometry(0.36, 0.36, 0.16);
      body = new THREE.Mesh(geo, mat);
      if (shape === 'wide') body.scale.x = TUNE.wideScale;
      if (shape === 'deep') body.scale.z = 2.1;
      g.add(body);
      if (weight === 'heavy') {
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#fff4d2' }));
        edge.scale.setScalar(1.16);
        g.add(edge);
      }
      if (kind === 'slice') {
        const arrow = new THREE.Mesh(chevronGeo, track(holoMaterial('#e8fbff', weight)));
        const spin = { right: -Math.PI / 2, left: Math.PI / 2, up: 0, down: Math.PI }[dir] ?? 0;
        arrow.rotation.z = spin;
        arrow.position.z = 0.1;
        g.add(arrow);
      }
      if (shape === 'deep') {
        const meter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.03), new THREE.MeshBasicMaterial({ color: '#f1c453', transparent: true, opacity: 0.95 }));
        meter.position.set(0, kind === 'wall' ? 0.58 : 0.3, 0.14);
        meter.scale.x = 0.02;
        meter.visible = false;
        meter.name = 'meter';
        g.add(meter);
      }
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: weight === 'light' ? 0.35 : 0.9, depthWrite: false }));
    glow.position.z = 0.05;
    g.add(glow);
    g.traverse((o) => { o.frustumCulled = false; });
    return { group: g, body, glow };
  }

  const threadOut = new THREE.Vector3();

  function threadCalm(note) {
    const remain = Math.hypot(note.to.x - note.group.position.x, note.to.z - note.group.position.z);
    return remain >= TUNE.straighten ? 1 : remain / TUNE.straighten;
  }

  function threadPoint(note, t, time, out) {
    const a = note.from;
    const b = note.to;
    const u = 1 - t;
    const calm = threadCalm(note);
    const sag = Math.sin(t * Math.PI) * TUNE.threadSag * calm;
    const x = u * u * a.x + 2 * u * t * ((a.x + b.x) / 2) + t * t * b.x;
    let y = u * u * a.y + 2 * u * t * ((a.y + b.y) / 2 - sag) + t * t * b.y;
    const z = u * u * a.z + 2 * u * t * ((a.z + b.z) / 2) + t * t * b.z;
    const floor = (world?.ground?.(x, z) ?? 0) + 0.62;
    if (y < floor) y = floor;
    return out.set(x, y, z);
  }

  function makeRail(kind) {
    const N = 20;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3);
    const uv = new Float32Array(N * 2 * 2);
    const idx = [];
    for (let i = 0; i < N; i++) {
      uv[i * 4] = 0;
      uv[i * 4 + 1] = i / (N - 1);
      uv[i * 4 + 2] = 1;
      uv[i * 4 + 3] = i / (N - 1);
      if (i < N - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, track(railMaterial(holoHex(kind))));
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    group.userData.N = N;
    scene?.add(group);
    return group;
  }

  function layRail(note) {
    const rail = note.rail;
    if (!rail) return;
    const N = rail.userData.N;
    const attr = rail.children[0].geometry.attributes.position;
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(threadPoint(note, i / (N - 1), song, new THREE.Vector3()));
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const nxt = pts[Math.min(N - 1, i + 1)];
      const prv = pts[Math.max(0, i - 1)];
      const tx = nxt.x - prv.x;
      const tz = nxt.z - prv.z;
      const len = Math.hypot(tx, tz) || 1;
      const w = 0.055;
      const o = i * 2;
      attr.setXYZ(o, p.x + (-tz / len) * w, p.y, p.z + (tx / len) * w);
      attr.setXYZ(o + 1, p.x - (-tz / len) * w, p.y, p.z - (tx / len) * w);
    }
    attr.needsUpdate = true;
  }

  const TRACK_N = 18;
  function makeRibbon(mat) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TRACK_N * 2 * 3);
    const uv = new Float32Array(TRACK_N * 2 * 2);
    const idx = [];
    for (let i = 0; i < TRACK_N; i++) {
      uv[i * 4] = 0;
      uv[i * 4 + 1] = i / (TRACK_N - 1);
      uv[i * 4 + 2] = 1;
      uv[i * 4 + 3] = i / (TRACK_N - 1);
      if (i < TRACK_N - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene?.add(mesh);
    return mesh;
  }
  const laneFill = makeRibbon(track(laneFillMaterial()));
  const laneLeft = makeRibbon(track(railMaterial('#3ee0ff')));
  const laneRight = makeRibbon(track(railMaterial('#3ee0ff')));
  const laneHold = { from: new THREE.Vector3(), to: new THREE.Vector3(), launch: new THREE.Vector3(), group: { position: new THREE.Vector3() } };
  const lanePts = Array.from({ length: TRACK_N }, () => new THREE.Vector3());
  const edgeL = Array.from({ length: TRACK_N }, () => new THREE.Vector3());
  const edgeR = Array.from({ length: TRACK_N }, () => new THREE.Vector3());

  function layPoly(mesh, pts, width) {
    const attr = mesh.geometry.attributes.position;
    for (let i = 0; i < TRACK_N; i++) {
      const p = pts[i];
      const nxt = pts[Math.min(TRACK_N - 1, i + 1)];
      const prv = pts[Math.max(0, i - 1)];
      const tx = nxt.x - prv.x;
      const tz = nxt.z - prv.z;
      const len = Math.hypot(tx, tz) || 1;
      const w = width;
      attr.setXYZ(i * 2, p.x + (-tz / len) * w, p.y, p.z + (tx / len) * w);
      attr.setXYZ(i * 2 + 1, p.x - (-tz / len) * w, p.y, p.z - (tx / len) * w);
    }
    attr.needsUpdate = true;
    mesh.visible = true;
  }

  function layTrack(on) {
    const frame = on ? laneFrame() : null;
    if (!frame) {
      laneFill.visible = laneLeft.visible = laneRight.visible = false;
      return;
    }
    const fly = notes.find((n) => !n.resolved && n.launch && n.kind !== 'back' && n.kind !== 'orb');
    const src = fly || laneHold;
    if (!fly) {
      laneHold.from.set(frame.beast.x, world.ground(frame.beast.x, frame.beast.z) + 1.15, frame.beast.z);
      laneHold.to.set(frame.beast.x + frame.fx * 3.2, world.ground(frame.beast.x, frame.beast.z) + 1.15, frame.beast.z + frame.fz * 3.2);
      laneHold.launch.set(frame.fx, 0, frame.fz);
      laneHold.group.position.lerpVectors(laneHold.from, laneHold.to, 0.5);
    }
    for (let i = 0; i < TRACK_N; i++) threadPoint(src, i / (TRACK_N - 1), song, lanePts[i]);
    laneLeft.visible = laneRight.visible = false;
    layPoly(laneFill, lanePts, 0.09);
  }

  function shatter(note) {
    if (!scene || note.kind === 'orb' || note.orbit) return;
    if (note.weight === 'light') { splitHalves(note); return; }
    const color = holoHex(note.kind);
    const origin = note.group.position.clone();
    note.group.visible = false;
    for (let i = 0; i < 8; i++) {
      const mat = track(holoMaterial(color));
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.03), mat);
      s.position.copy(origin);
      s.frustumCulled = false;
      scene.add(s);
      const a = (i / 8) * Math.PI * 2;
      shards.push({
        m: s,
        v: new THREE.Vector3(Math.cos(a) * 1.4, (i % 2 ? 0.8 : -0.2), Math.sin(a) * 1.4),
        life: 0.42,
      });
    }
  }

  function splitHalves(note) {
    if (!scene || !camera) { note.group.visible = false; return; }
    camera.getWorldDirection(look);
    const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const color = holoHex(note.kind);
    note.group.visible = false;
    for (const sign of [-1, 1]) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false });
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.1), mat);
      s.position.copy(note.group.position);
      s.frustumCulled = false;
      scene.add(s);
      shards.push({ m: s, v: right.clone().multiplyScalar(sign * 2.2), life: 0.5, span: 0.5 });
    }
  }

  let warrior = false;
  function spawn(spec) {
    if (!warrior) return;
    const frame = laneFrame();
    if (!frame || !scene) return;
    const eye = camera.position;
    const side = (spec.lane - 1) * LANE;
    const ceiling = !!spec.ceiling;
    const ring = spec.kind === 'ring' || spec.weight === 'ring';
    const lift = ring ? TUNE.ringLift : spec.kind === 'wall' && ceiling ? 1.72 : 1.38;
    const chest = world.ground(frame.beast.x, frame.beast.z) + 1.15;
    const from = new THREE.Vector3(frame.beast.x + frame.rx * side * 0.35, chest, frame.beast.z + frame.rz * side * 0.35);
    const span = Math.min(3.4, Math.max(1.4, Math.hypot(eye.x - frame.beast.x, eye.z - frame.beast.z) - 1.8));
    const to = new THREE.Vector3(frame.beast.x + frame.fx * span + frame.rx * side, chest, frame.beast.z + frame.fz * span + frame.rz * side);
    if (ring) to.set(eye.x, world.ground(eye.x, eye.z) + TUNE.ringLift, eye.z);
    if (spec.kind === 'back') {
      const px = eye.x - frame.beast.x;
      const pz = eye.z - frame.beast.z;
      const pl = Math.hypot(px, pz) || 1;
      from.set(frame.beast.x + (px / pl) * 0.7, world.ground(frame.beast.x, frame.beast.z) + 1.2, frame.beast.z + (pz / pl) * 0.7);
      to.set(from.x + (px / pl) * 1.3, from.y, from.z + (pz / pl) * 1.3);
    }
    const weight = spec.weight || (ring ? 'ring' : 'medium');
    const shape = spec.shape || '';
    const made = makeAttack(spec.kind, spec.dir, ceiling ? 'ceiling' : spec.part, weight, shape);
    made.group.position.copy(from);
    made.group.lookAt(to.x, from.y, to.z);
    scene.add(made.group);
    const rail = null;
    const flight = Math.max(0.4, from.distanceTo(to) / Math.max(0.5, TUNE.travelSpeed));
    let due = spec.due;
    let release = due - flight;
    if (release - TUNE.windup < song) {
      release = song + TUNE.windup;
      due = release + flight;
    }
    const launch = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    if (launch.lengthSq() > 1e-6) launch.normalize(); else launch.set(frame.fx, 0, frame.fz);
    const note = { ...spec, weight, shape, due, ceiling, group: made.group, body: made.body, glow: made.glow, rail, from, to, launch, flight, release, resolved: false, bx: frame.beast.x, bz: frame.beast.z, power: 0, depth: 0, strength: spec.shape === 'deep' ? TUNE.deepStrength : TUNE.wallHp, bonus: spec.bonus || 0 };
    if (rail) layRail(note);
    notes.push(note);
    if (frame) zones.cueBeast?.(frame.beast.x, frame.beast.z, 'attack');
  }

  function flash() {
    let el = document.getElementById('hitflash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hitflash';
      document.body.appendChild(el);
    }
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 90);
  }

  function trail(x0, y0, x1, y1, heavy) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 12) return;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const paint = (h, bg) => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;left:${x0}px;top:${y0}px;width:${len}px;height:${h}px;margin-top:-${h / 2}px;border-radius:${h}px;background:${bg};box-shadow:0 0 16px ${heavy ? '#ffb15a' : '#7ee0ff'};transform-origin:0 50%;transform:rotate(${ang}rad);z-index:12;pointer-events:none;opacity:0.95;transition:opacity .32s linear;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '0'; });
      setTimeout(() => el.remove(), 340);
    };
    paint(heavy ? 22 : 16, heavy ? 'linear-gradient(90deg,transparent,#fff6c8,#ffb15a)' : 'linear-gradient(90deg,transparent,#fff,#7ee0ff)');
    paint(heavy ? 7 : 5, '#fff');
  }

  function endRush() {
    const hits = rush?.hits ?? 0;
    rush?.board?.remove();
    rush = null;
    const damage = 6 + hits * 4;
    say(hits >= 5 ? 'Sky Rush' : `Sky Rush ${hits}/5`);
    onLaunch?.(damage);
  }

  function advanceRush(hit) {
    if (!rush) return;
    if (hit) rush.hits += 1;
    rush.i += 1;
    rush.t = 0;
    rush.board.querySelectorAll('button').forEach((b, n) => b.classList.toggle('on', n === rush.i));
    if (rush.i >= 5) endRush();
  }

  function startRush() {
    combo = 0;
    const board = document.createElement('div');
    board.id = 'rush';
    ARC.forEach((spot, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = n === 4 ? 'DIVE' : String(n + 1);
      b.style.left = `${spot[0]}%`;
      b.style.top = `${spot[1]}%`;
      if (n === 0) b.classList.add('on');
      if (n === 4) b.classList.add('dive');
      b.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!rush || n !== rush.i) { if (rush && n !== rush.i) advanceRush(false); return; }
        advanceRush(true);
      });
      board.appendChild(b);
    });
    document.body.appendChild(board);
    rush = { i: 0, hits: 0, t: 0, board };
    say('Sky Rush');
  }

  function floatScore(n, x, y, grade) {
    const el = document.createElement('div');
    el.textContent = `${grade} ${n}`;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-120%);z-index:12;color:#fff6dc;font:800 22px Georgia,serif;text-shadow:0 2px 0 #1a1008;pointer-events:none;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function maybeOpen() {
    if (TUNE.orbRate <= 0 || orbsThisFight >= TUNE.orbCap) return;
    if (notes.some((n) => n.kind === 'orb' && !n.resolved)) return;
    if (Math.random() > TUNE.orbRate) return;
    orbsThisFight += 1;
    const part = ['head', 'legs', 'back'][(orbsThisFight - 1) % 3];
    const gap = TUNE.holdMin / Math.max(0.5, TUNE.travelSpeed);
    spawn({ lane: 1, kind: 'orb', part, due: song + TUNE.windup + gap });
  }

  let lastClash = null;
  let clashSeq = 0;

  function rubbleAt(note, count, scale) {
    if (!world?.addLoose) return;
    const origin = note.group.position;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.26), new THREE.MeshBasicMaterial({ color: i % 2 ? '#c4a06a' : '#8a6844' }));
      mesh.position.set(origin.x, origin.y, origin.z);
      mesh.castShadow = true;
      const a = (i / count) * Math.PI * 2;
      const speed = 1.6 + scale * 3.2;
      world.addLoose(mesh, new THREE.Vector3(Math.cos(a) * speed, 1.8 + scale * 2.4, Math.sin(a) * speed), 2.4);
    }
  }

  function rainAt(note, scale) {
    if (!zones) return;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      if (Math.hypot(b.x - note.bx, b.z - note.bz) > TUNE.rainRadius) continue;
      zones.hurt([{ x: b.x, z: b.z, r: 1.4, d: TUNE.rainHit * (0.45 + scale), k: 'arcane' }]);
    }
  }

  function spawnComboBox(note, scale) {
    spawn({
      lane: 1,
      kind: 'slice',
      dir: 'right',
      weight: 'light',
      comboBox: true,
      bonus: Math.round(TUNE.comboBonus * (0.6 + scale)),
      due: song + TUNE.windup + 0.8,
    });
  }

  function blockPower(strength) {
    const t = Math.max(0, Math.min(1, (blockHeld || 0) / Math.max(0.05, TUNE.heavyHold)));
    return strength + (1 - t) * TUNE.marginRain + 5;
  }

  function payClash(note, result, mode) {
    if (note.resolved) return;
    const { tier, scale, margin } = result;
    note.resolved = true;
    note.tier = tier;
    lastClash = { id: ++clashSeq, tier, margin, scale, mode, strength: note.strength, power: note.strength + margin };
    if (tier === 'chip') {
      say('Chip');
      if (walker && note.launch) walker.place(walker.feet.x - note.launch.x * TUNE.deepPush, walker.feet.z - note.launch.z * TUNE.deepPush, walker.yaw);
      return;
    }
    shatter(note);
    if (mode === 'parry') {
      if (tier === 'crumble') { say('Block'); return; }
      say('Parry');
      spawnComboBox(note, scale);
      return;
    }
    const word = { crumble: 'Crumble', push: 'Push', burst: 'Burst', rain: 'Rain' }[tier] || 'Crumble';
    say(word);
    const dmg = TUNE.crumbleHit * (1 + scale * 3);
    zones?.hurt([{ x: note.bx, z: note.bz, r: 1.6, d: dmg, k: 'arcane' }]);
    if (tier === 'crumble') addStagger(TUNE.lightStagger);
    if (tier === 'push' || tier === 'burst' || tier === 'rain') {
      if (walker) zones?.shoveBeast(note.bx, note.bz, note.bx - walker.feet.x, note.bz - walker.feet.z, TUNE.marginPushDist * (0.35 + scale));
      addStagger(TUNE.marginStagger * (0.5 + scale));
    }
    if (tier === 'burst' || tier === 'rain') rubbleAt(note, tier === 'rain' ? 7 : 4, scale);
    if (tier === 'rain') rainAt(note, scale);
    if (tier === 'burst' || tier === 'rain') { freeze = TUNE.heavyStop; hitShake = Math.max(hitShake, 0.8 + scale); }
  }

  function finishDeep(note) {
    if (note.resolved) return;
    const power = note.depth >= 1 ? note.power : Math.min(note.power, (note.strength || TUNE.wallHp) - 1);
    payClash(note, clashMargin(power, note.strength || TUNE.wallHp), 'cut');
  }

  function breakHeavy(note, how) {
    if (note.resolved) return;
    const strength = note.strength || TUNE.wallHp;
    const power = how === 'Pound'
      ? strength + TUNE.marginRain * (0.35 + 0.65 * (poundWave?.charge || 0.5))
      : blockPower(strength);
    payClash(note, clashMargin(power, strength), how === 'Pound' ? 'cut' : 'parry');
  }

  function tickDeep(dt) {
    for (const note of notes) {
      if (note.resolved || note.shape !== 'deep' || song < note.release) continue;
      let best = 0;
      let moving = false;
      for (const h of hold.values()) {
        const screen = project(note.group.position);
        if (!screen) continue;
        const px = h.x + (h.dx || 0);
        const py = h.y + (h.dy || 0);
        const dist = Math.hypot(px - screen.x, py - screen.y);
        if (dist > TUNE.deepZone) continue;
        const lastX = h.markX ?? px;
        const lastY = h.markY ?? py;
        if (Math.hypot(px - lastX, py - lastY) > 0.8) moving = true;
        h.markX = px;
        h.markY = py;
        best = Math.max(best, 1 - dist / TUNE.deepZone);
      }
      const meter = note.group.getObjectByName?.('meter');
      if (best > 0 && moving) {
        const closeness = TUNE.deepEdge + (1 - TUNE.deepEdge) * best;
        note.depth = Math.min(1, note.depth + dt / TUNE.deepTime);
        note.power += dt * TUNE.deepRate * closeness;
        if (meter) { meter.visible = true; meter.scale.x = Math.max(0.04, note.depth); }
        if (note.depth >= 1) finishDeep(note);
      } else if (meter && note.depth > 0) meter.visible = true;
    }
  }

  function gradeHit(note, h) {
    if (note.resolved || note.shape === 'deep') return;
    const swipeNow = dirOf(h.dx || 0, h.dy || 0);
    if (note.weight === 'heavy') {
      const heldFor = (performance.now() - (h.t || performance.now())) / 1000;
      if (!(heldFor >= TUNE.heavyHold && swipeNow)) { say('Heavy'); return; }
    }
    if (note.weight === 'ring' && swipeNow !== 'up' && swipeNow !== 'down') return;
    const screen = project(note.group.position);
    const swipe = dirOf(h.dx || 0, h.dy || 0);
    const dist = screen ? strokeDist(h, screen.x, screen.y) : 999;
    const reach = note.shape === 'wide' ? TUNE.wideReach : 120;
    if (dist > reach) return;
    const center = Math.max(0, 1 - dist / reach);
    const time = Math.max(0, 1 - Math.abs(song - note.due) / TUNE.window);
    const dot = note.kind === 'slice' ? angleDot(h.dx || 0, h.dy || 0, note.dir) : 1;
    const tapped = !swipe;
    if (note.kind === 'slice' && !tapped && dot < ANGLE_DOT_MIN) { fail(note); return; }
    const dotNote = note.kind !== 'slice' || tapped;
    let score = bladePoints(dotNote ? 1 : dot, center, time, dotNote && note.kind !== 'slice');
    if (note.kind === 'slice' && tapped) score = Math.min(score, 70);
    if (note.kind === 'orb') score = Math.min(100, score + 30);
    const aligned = !tapped && dot >= ANGLE_DOT_SUPER;
    const grade = note.kind === 'orb' ? 'open' : score >= 90 && aligned ? 'perfect' : score >= 50 ? 'good' : 'chip';
    const marginCut = !note.comboBox && note.weight !== 'light' && note.weight !== 'ring' && note.kind !== 'orb' && note.kind !== 'back';
    if (marginCut) {
      scoreTotal += score;
      const heldFor = (performance.now() - (h.t || performance.now())) / 1000;
      let power = score * TUNE.powerScale;
      if (note.weight === 'heavy') power += Math.max(0, heldFor - TUNE.heavyHold) / 0.45 * TUNE.marginRain;
      payClash(note, clashMargin(power, note.strength || TUNE.wallHp), 'cut');
      if (note.tier && note.tier !== 'chip') combo += 1;
      if (combo >= 4 && !clash) startRush();
      return;
    }
    note.resolved = true;
    scoreTotal += score;
    const dmg = (note.kind === 'orb' ? Math.max(10, Math.round(score / 6)) : Math.max(3, Math.round(score / 9))) + (note.kind === 'back' ? TUNE.backBonus : 0) + (note.comboBox ? (note.bonus || TUNE.comboBonus) : 0);
    const clean = grade === 'perfect' || grade === 'open';
    const heavy = note.weight === 'heavy';
    flash();
    freeze = heavy ? TUNE.heavyStop : clean ? TUNE.hitStop : grade === 'good' ? TUNE.hitStop * 0.55 : TUNE.hitStop * 0.28;
    hitShake = Math.max(hitShake, heavy ? 1 : clean ? 1 : grade === 'good' ? 0.4 : 0.15);
    const word = note.comboBox ? 'Combo' : note.weight === 'ring' ? 'Split' : note.kind === 'back' ? (note.part === 'weak' ? 'Weak' : 'Backstab') : grade === 'perfect' ? 'Perfect' : grade === 'good' ? 'Good' : grade === 'open' ? (note.part || 'Open') : 'Chip';
    if (screen) floatScore(score, screen.x, screen.y, word);
    say(`${word} ${score}`);
    shatter(note);
    if (note.orbit) slamPiece(note, score);
    else {
      if (zones) zones.hurt([{ x: note.bx, z: note.bz, r: 1.6, d: dmg, k: 'arcane' }]);
      if (note.kind === 'back') addStagger(TUNE.backStagger);
      else if (note.weight === 'light') addStagger(TUNE.lightStagger);
      else if (heavy) addStagger(TUNE.heavyStagger);
      else if (grade === 'good' || grade === 'perfect') addStagger(grade === 'perfect' ? TUNE.staggerPerfect : TUNE.staggerGood);
      if (clean) beginClash();
      else if (walker) zones?.shoveBeast(note.bx, note.bz, note.bx - walker.feet.x, note.bz - walker.feet.z, TUNE.knock * (grade === 'good' ? 1 : 0.55));
      if (note.kind === 'slice') chopNear();
      if (grade === 'perfect') reflectCut(note);
    }
    if (grade === 'perfect' || grade === 'good' || grade === 'open') combo += 1;
    if (combo >= 4 && !clash) startRush();
  }

  function paintMeter() {
    const bar = document.getElementById('stagger');
    if (!bar) return;
    bar.classList.toggle('open', openFor > 0);
    const span = bar.querySelector('span');
    if (span) span.style.width = `${Math.round((openFor > 0 ? 1 : stagger) * 100)}%`;
  }

  function addStagger(amount) {
    if (openFor > 0 || amount <= 0) return;
    stagger = Math.min(1, stagger + amount);
    if (stagger < 1) return;
    stagger = 0;
    openFor = TUNE.openTime;
    pendingOrb = 0.35;
    say('Open');
    forceOrb();
  }

  function forceOrb() {
    if (orbsThisFight >= TUNE.orbCap) return;
    if (notes.some((n) => n.kind === 'orb' && !n.resolved)) return;
    orbsThisFight += 1;
    const part = ['head', 'legs', 'back'][(orbsThisFight - 1) % 3];
    const gap = TUNE.holdMin / Math.max(0.5, TUNE.travelSpeed);
    spawn({ lane: 1, kind: 'orb', part, due: song + TUNE.windup + gap });
  }

  function chopNear() {
    if (!world?.chop || !camera || !walker) return;
    camera.getWorldDirection(look);
    world.chop(walker.feet.x + look.x * 1.6, walker.feet.z + look.z * 1.6, look.x, look.z, TUNE.chopReach);
  }

  function beginClash() {
    if (clash || !walker || !zones?.grabBeast) return;
    const frame = laneFrame();
    if (!frame) return;
    const beast = zones.grabBeast(frame.beast.x, frame.beast.z);
    if (!beast) return;
    const px = walker.feet.x;
    const pz = walker.feet.z;
    const bx = beast.x;
    const bz = beast.z;
    const dx = bx - px;
    const dz = bz - pz;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d;
    const nz = dz / d;
    const midX = (px + bx) / 2;
    const midZ = (pz + bz) / 2;
    const gap = TUNE.clashGap * 0.5;
    beast.flinch(0.4);
    clash = {
      phase: 'in', t: 0, dur: TUNE.clashIn, yaw: walker.yaw, beast,
      px, pz, bx, bz,
      pToX: midX - nx * gap, pToZ: midZ - nz * gap,
      bToX: midX + nx * gap, bToZ: midZ + nz * gap,
      homeX: px, homeZ: pz, beastHomeX: bx, beastHomeZ: bz,
    };
    say('Clash');
  }

  function blowRing(x, z) {
    if (!world) return;
    burst.visible = true;
    burst.material.opacity = 0.85;
    burst.scale.setScalar(0.4);
    burst.position.set(x, world.ground(x, z) + 0.2, z);
    burst.userData.t = 0.45;
  }

  function stepClash(dt) {
    if (!clash || !walker) return;
    clash.t += dt;
    const u = Math.min(1, clash.t / clash.dur);
    const e = u * u * (3 - 2 * u);
    const px = clash.px + (clash.pToX - clash.px) * e;
    const pz = clash.pz + (clash.pToZ - clash.pz) * e;
    walker.place(px, pz, clash.yaw);
    clash.beast.put(clash.bx + (clash.bToX - clash.bx) * e, clash.bz + (clash.bToZ - clash.bz) * e);
    walker.look(camera);
    if (u < 1) return;
    if (clash.phase === 'in') {
      blowRing(px, pz);
      clash.phase = 'out';
      clash.t = 0;
      clash.dur = TUNE.clashOut;
      clash.px = px;
      clash.pz = pz;
      clash.bx = clash.beast.x;
      clash.bz = clash.beast.z;
      clash.pToX = clash.homeX;
      clash.pToZ = clash.homeZ;
      clash.bToX = clash.beastHomeX;
      clash.bToZ = clash.beastHomeZ;
      return;
    }
    clash.beast.release();
    clash = null;
  }

  const rockMat = (key, rgb) => air ? shadowed(air, {
    key,
    vertexPars: 'varying vec3 vW; varying vec3 vN;',
    vertex: '#include <begin_vertex>\n vW = (modelMatrix * vec4(position, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * normal);',
    fragmentPars: 'varying vec3 vW; varying vec3 vN;',
    fragment: `vec3 alb = vec3(${rgb}); float sun = clamp(dot(normalize(vN), uSun), 0.0, 1.0); vec3 col = lit(alb, 0.26 + 0.74 * sun, 0.62); gl_FragColor = vec4(air(col, vW), 1.0);`,
  }) : new THREE.MeshLambertMaterial({ color: '#c4a06a' });
  const rockA = rockMat('sandA', '0.78, 0.58, 0.32');
  const rockB = rockMat('sandB', '0.62, 0.44, 0.24');
  const rockC = rockMat('sandC', '0.86, 0.68, 0.40');
  const slabGeo = new THREE.BoxGeometry(1, 1, 1);
  const risen = [];
  let poundHeld = false;
  let poundCharge = 0;
  let poundWave = null;
  let tossed = 0;
  let poundHits = 0;
  const chargeRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color: '#a67c4a', side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }));
  const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 32), new THREE.MeshBasicMaterial({ color: '#cbb48a', side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
  const dustRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 24), new THREE.MeshBasicMaterial({ color: '#d7c4a2', side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
  const cracks = new THREE.Group();
  const crackMat = new THREE.MeshBasicMaterial({ color: '#5c4632', transparent: true, opacity: 0.8, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 1), crackMat);
    line.position.z = 0.5;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 7) * Math.PI * 2 + (i % 2) * 0.18;
    arm.add(line);
    cracks.add(arm);
  }
  for (const m of [chargeRing, shockRing, dustRing]) { m.rotation.x = -Math.PI / 2; m.visible = false; m.frustumCulled = false; scene?.add(m); }
  cracks.visible = false;
  scene?.add(cracks);

  function poundRadius(c) {
    const t = Math.max(0, Math.min(1, c));
    return TUNE.poundMin + (TUNE.poundReach - TUNE.poundMin) * t;
  }

  function makeSlab(spin) {
    const g = new THREE.Group();
    const spire = new THREE.Mesh(slabGeo, rockA);
    spire.scale.set(0.38, 1.45, 0.28);
    spire.position.y = 0.72;
    spire.rotation.set(0.12, spin, 0.28);
    const ledge = new THREE.Mesh(slabGeo, rockB);
    ledge.scale.set(1.35, 0.2, 0.46);
    ledge.position.set(0.48, 0.28, 0.06);
    ledge.rotation.set(0.08, spin * 0.2, -0.7);
    const chip = new THREE.Mesh(slabGeo, rockC);
    chip.scale.set(0.32, 0.7, 0.26);
    chip.position.set(-0.26, 0.42, -0.1);
    chip.rotation.set(-0.18, spin, 0.55);
    g.add(spire, ledge, chip);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
    return g;
  }

  function layCharge(c) {
    if (!walker || !world) return;
    const x = walker.feet.x;
    const z = walker.feet.z;
    const reach = poundRadius(c);
    const gy = world.ground(x, z);
    chargeRing.visible = true;
    chargeRing.position.set(x, gy + 0.16, z);
    chargeRing.scale.setScalar(reach);
    chargeRing.material.opacity = 0.28 + 0.35 * c + 0.08 * Math.sin(performance.now() * 0.02);
    const want = Math.max(0, Math.round(TUNE.poundRocks * c));
    while (risen.length < want) {
      const i = risen.length;
      const ang = (i / Math.max(1, TUNE.poundRocks)) * Math.PI * 2 + 0.35;
      const mesh = makeSlab(ang);
      scene.add(mesh);
      risen.push({ mesh, ang, dist: 2.35 + (i % 3) * 0.55 });
    }
    const scale = TUNE.rockMin + (TUNE.rockMax - TUNE.rockMin) * c;
    for (const rock of risen) {
      rock.mesh.scale.setScalar(scale);
      const rx = x + Math.cos(rock.ang) * rock.dist;
      const rz = z + Math.sin(rock.ang) * rock.dist;
      rock.mesh.position.set(rx, world.ground(rx, rz) - 0.9 * (1 - c), rz);
      rock.mesh.rotation.y = rock.ang;
    }
    hitShake = Math.max(hitShake, 0.2 + 0.8 * c * c);
  }

  function poundCancel() {
    poundHeld = false;
    poundCharge = 0;
    chargeRing.visible = false;
    for (const rock of risen) scene?.remove(rock.mesh);
    risen.length = 0;
    document.getElementById('pound')?.classList.remove('up');
  }

  function poundStart() {
    if (!drawn || !walker) return;
    poundHeld = true;
    poundCharge = 0;
    document.getElementById('pound')?.classList.add('up');
  }

  function poundRelease() {
    if (!poundHeld || !walker || !world) { poundCancel(); return; }
    poundHeld = false;
    document.getElementById('pound')?.classList.remove('up');
    const charge = Math.max(0.12, poundCharge);
    const reach = poundRadius(charge);
    const x = walker.feet.x;
    const z = walker.feet.z;
    chargeRing.visible = false;
    const gy = world.ground(x, z);
    shockRing.visible = true;
    dustRing.visible = true;
    cracks.visible = true;
    shockRing.position.set(x, gy + 0.18, z);
    dustRing.position.set(x, gy + 0.12, z);
    cracks.position.set(x, gy + 0.05, z);
    cracks.scale.setScalar(reach);
    crackMat.opacity = 0.85;
    shockRing.scale.setScalar(0.2);
    if (Math.abs(cracks.scale.x - reach) > 0.001) console.warn('pound crack', cracks.scale.x, reach);
    world.pound?.(x, z, reach);
    const speed = (2.2 + reach * 0.85) * (0.5 + 0.5 * charge);
    const vy = 2.2 + 2.4 * charge;
    for (const rock of risen) {
      const dirx = Math.cos(rock.ang);
      const dirz = Math.sin(rock.ang);
      world.addLoose?.(rock.mesh, new THREE.Vector3(dirx * speed, vy, dirz * speed), TUNE.rockLife);
    }
    tossed = risen.length;
    risen.length = 0;
    poundWave = { x, z, reach, r: 0, t: 0, dur: TUNE.poundTime * (0.35 + 0.65 * charge), charge, hit: new Set(), id: Math.random() };
    hitShake = Math.max(hitShake, 0.45 + 0.55 * charge);
    say('Pound');
    poundCharge = 0;
  }

  function poundTick(dt) {
    if (poundHeld && drawn) {
      poundCharge = Math.min(1, poundCharge + dt / TUNE.poundWindup);
      layCharge(poundCharge);
    } else if (!drawn && (poundHeld || risen.length)) poundCancel();
    if (!poundWave) return;
    poundWave.t += dt;
    const u = Math.min(1, poundWave.t / poundWave.dur);
    poundWave.r = poundWave.reach * u;
    const shown = poundWave.r;
    shockRing.scale.setScalar(shown);
    dustRing.scale.setScalar(shown);
    cracks.scale.setScalar(shown);
    shockRing.material.opacity = 0.7 * (1 - u);
    dustRing.material.opacity = 0.45 * (1 - u);
    crackMat.opacity = 0.85 * (1 - u * 0.85);
    if (Math.abs(shockRing.scale.x - shown) > 0.001) console.warn('pound ring', shockRing.scale.x, shown);
    const radius = shockRing.scale.x;
    const herd = zones?.beasts?.() || [];
    const dmg = TUNE.poundHit * (0.45 + 0.55 * poundWave.charge);
    const toss = TUNE.poundToss * (0.4 + 0.6 * poundWave.charge);
    for (const b of herd) {
      if (b.dead || poundWave.hit.has(b.n)) continue;
      if (Math.hypot(b.x - poundWave.x, b.z - poundWave.z) > radius) continue;
      poundWave.hit.add(b.n);
      poundHits += 1;
      zones.hurt([{ x: b.x, z: b.z, r: radius, d: dmg, k: 'arcane', exact: true, once: poundWave.id }]);
      zones.shoveBeast(b.x, b.z, b.x - poundWave.x, b.z - poundWave.z, toss);
    }
    for (const note of notes) {
      if (note.resolved || note.weight !== 'heavy') continue;
      if (Math.hypot(note.group.position.x - poundWave.x, note.group.position.z - poundWave.z) > radius + 0.4) continue;
      breakHeavy(note, 'Pound');
    }
    if (u >= 1) {
      shockRing.visible = false;
      dustRing.visible = false;
      cracks.visible = false;
      poundWave = null;
    }
  }

  const orbit = { pieces: [], life: 0, lane: null, slams: [] };
  let pebble = null;
  const orbitLane = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 1), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.28, depthWrite: false }));
  orbitLane.visible = false;
  orbitLane.frustumCulled = false;
  scene?.add(orbitLane);

  function dropOrbit() {
    for (const piece of orbit.pieces) if (!piece.sent) dropPiece(piece.mesh);
    orbit.pieces.length = 0;
    orbit.life = 0;
    orbitLane.visible = false;
    if (pebble) { scene?.remove(pebble); pebble = null; }
  }

  function dropPiece(mesh) {
    if (!mesh) return;
    world?.addLoose?.(mesh, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6), 2.4);
  }

  function liftAt(x, z, pull, gather) {
    if (!world?.takeLoose || !scene) return 0;
    const room = TUNE.orbitCount - orbit.pieces.length;
    if (room <= 0) return 0;
    const meshes = world.takeLoose(x, z, gather ?? pull, room);
    const radius = pull + TUNE.orbitGap;
    meshes.forEach((mesh, i) => {
      const glow = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.7, 0.7), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0, depthWrite: false }));
      glow.name = 'lock';
      glow.position.y = 0.5;
      mesh.add(glow);
      orbit.pieces.push({ mesh, ang: (orbit.pieces.length + i) * 1.7, radius, cx: x, cz: z, sent: false });
    });
    if (meshes.length) orbit.life = TUNE.orbitLife;
    return meshes.length;
  }

  function spin() {
    if (!drawn || !walker) return 0;
    const n = liftAt(walker.feet.x, walker.feet.z, TUNE.spinPull, TUNE.spinGather);
    zones?.hurt?.([{ x: walker.feet.x, z: walker.feet.z, r: 9, d: 9, k: 'arcane' }]);
    say('Spin');
    return n;
  }

  function sendPiece(piece) {
    if (piece.sent || !camera || !walker) return;
    piece.sent = true;
    const frame = laneFrame();
    const part = ['head', 'legs', 'back'][Math.floor(orbit.pieces.filter((p) => p.sent).length) % 3];
    const bx = frame ? frame.beast.x : piece.cx;
    const bz = frame ? frame.beast.z : piece.cz;
    const eye = camera.position;
    const from = piece.mesh.position.clone();
    const to = new THREE.Vector3(eye.x + (frame ? frame.fx : 0) * SWORD_OFFSET, world.ground(eye.x, eye.z) + 1.15, eye.z + (frame ? frame.fz : 1) * SWORD_OFFSET);
    const flight = Math.max(0.45, from.distanceTo(to) / Math.max(0.5, TUNE.travelSpeed));
    const due = song + flight;
    piece.mesh.traverse((o) => { if (o.name === 'lock') o.material.opacity = 0.45; });
    piece.base = piece.mesh.scale.x || 1;
    notes.push({
      kind: 'slice', dir: 'right', orbit: true, part, group: piece.mesh, body: piece.mesh, glow: null, base: piece.base,
      from, to, flight, due, release: song, resolved: false, bx, bz, ceiling: false,
    });
    orbitLane.visible = true;
    say('Lock');
  }

  function tryLock(h) {
    if (!orbit.pieces.length) { whackPebble(h); return false; }
    let best = null;
    let bestD = 110;
    for (const piece of orbit.pieces) {
      if (piece.sent) continue;
      const s = project(piece.mesh.position);
      if (!s) continue;
      const d = strokeDist(h, s.x, s.y);
      if (d < bestD) { best = piece; bestD = d; }
    }
    if (best) { sendPiece(best); return true; }
    whackPebble(h);
    return false;
  }

  function slamPiece(note, score) {
    const impact = Math.max(4, Math.round(score / 8));
    const gy = world.ground(note.bx, note.bz);
    const lift = note.part === 'head' ? 1.35 : note.part === 'legs' ? 0.3 : 0.85;
    orbit.slams.push({
      mesh: note.group, t: 0, dur: 0.3, impact, part: note.part,
      from: note.group.position.clone(),
      to: new THREE.Vector3(note.bx, gy + lift, note.bz),
      bx: note.bx, bz: note.bz,
    });
    orbitLane.visible = false;
  }

  function finishSlam(slam) {
    zones?.hurt([{ x: slam.bx, z: slam.bz, r: 1.4, d: slam.impact, k: 'arcane', exact: true }]);
    zones?.hurt([{ x: slam.bx, z: slam.bz, r: 1.2, d: TUNE.hackHit, k: 'arcane', exact: true }]);
    if (walker) {
      const dx = slam.bx - walker.feet.x;
      const dz = slam.bz - walker.feet.z;
      const d = Math.hypot(dx, dz) || 1;
      const step = Math.min(0.7, Math.max(0, d - 2.2));
      if (step > 0) walker.place(walker.feet.x + (dx / d) * step, walker.feet.z + (dz / d) * step, walker.yaw);
      zones?.shoveBeast(slam.bx, slam.bz, dx, dz, 0.8);
    }
    say(`Hack ${slam.part || 'back'}`);
    world?.addLoose?.(slam.mesh, new THREE.Vector3(0, 0.8, 0), 2.2);
  }

  function whackPebble(h) {
    if (!pebble) return;
    const s = project(pebble.position);
    if (!s || strokeDist(h, s.x, s.y) > 90) return;
    const frame = laneFrame();
    if (frame && zones) {
      zones.hurt([{ x: frame.beast.x, z: frame.beast.z, r: 1.3, d: TUNE.stoneHit, k: 'arcane', exact: true }]);
      fx?.spawn({ kind: 3, x: pebble.position.x, y: pebble.position.y, z: pebble.position.z, vx: frame.fx * 6, vy: 1.5, vz: frame.fz * 6, life: 0.45, size: [0.08, 0.16], colour: [0.78, 0.62, 0.36] });
    }
    scene.remove(pebble);
    pebble = null;
    say('Stone');
  }

  function orbitTick(dt) {
    if (orbit.life > 0) orbit.life -= dt;
    const alive = orbit.life > 0;
    for (let i = orbit.pieces.length - 1; i >= 0; i--) {
      const piece = orbit.pieces[i];
      if (piece.sent) continue;
      if (!alive) { dropPiece(piece.mesh); orbit.pieces.splice(i, 1); continue; }
      piece.ang += TUNE.orbitSpeed * dt;
      const gy = world.ground(piece.cx, piece.cz);
      piece.mesh.position.set(piece.cx + Math.cos(piece.ang) * piece.radius, gy + 1.45, piece.cz + Math.sin(piece.ang) * piece.radius);
      piece.mesh.rotation.y += dt * 0.4;
    }
    if (!orbit.pieces.length) orbitLane.visible = false;
    const flying = notes.find((n) => n.orbit && !n.resolved);
    if (flying && world) {
      const u = flightU(song, flying.due, flying.flight);
      flying.group.scale.setScalar((flying.base || 1) * (1 - 0.45 * u));
      const gy = world.ground(flying.group.position.x, flying.group.position.z);
      const dx = flying.bx - flying.group.position.x;
      const dz = flying.bz - flying.group.position.z;
      const len = Math.hypot(dx, dz) || 1;
      orbitLane.visible = true;
      orbitLane.scale.set(1, 1, len);
      orbitLane.position.set(flying.group.position.x + dx / 2, gy + 0.2, flying.group.position.z + dz / 2);
      orbitLane.rotation.y = Math.atan2(dx, dz);
    }
    for (let i = orbit.slams.length - 1; i >= 0; i--) {
      const slam = orbit.slams[i];
      slam.t += dt;
      const u = Math.min(1, slam.t / slam.dur);
      const e = u * u;
      slam.mesh.position.lerpVectors(slam.from, slam.to, e);
      slam.mesh.position.y += Math.sin(Math.PI * u) * 0.8;
      if (u >= 1) { finishSlam(slam); orbit.slams.splice(i, 1); }
    }
    if (drawn && !pebble && Math.random() < TUNE.stoneRate * dt && walker && world) {
      pebble = makeSlab(0.4);
      pebble.scale.setScalar(0.35);
      const yaw = walker.yaw;
      pebble.position.set(walker.feet.x + Math.cos(yaw) * 1.3, world.ground(walker.feet.x, walker.feet.z) + 1.15, walker.feet.z - Math.sin(yaw) * 1.3);
      scene.add(pebble);
    }
    if (pebble) pebble.position.y += Math.sin(performance.now() * 0.004) * 0.002;
  }

  if (world) world.orbitLift = liftAt;

  function reflectCut(note) {
    if (!scene) return;
    const bounced = shots.filter((s) => s.kind === 'bounce' && s.life > 0).length;
    if (bounced >= MAX_BOUNCE) return;
    const mesh = new THREE.Mesh(lobGeo, bounceMat);
    mesh.position.copy(note.group.position);
    const v = new THREE.Vector3(note.from.x - note.to.x, 0, note.from.z - note.to.z);
    if (v.lengthSq() < 1e-4) v.set(0, 0, 1);
    v.normalize().multiplyScalar(9);
    v.y = 4.5;
    scene.add(mesh);
    shots.push({ mesh, v, life: 2.2, kind: 'bounce' });
  }

  function fail(note) {
    if (note.resolved) return;
    note.resolved = true;
    combo = 0;
    say('Miss');
    maybeOpen();
  }

  function dirOf(dx, dy) {
    if (Math.hypot(dx, dy) < 10) return '';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  function crosses(h, el) {
    const r = el.getBoundingClientRect();
    const box = { l: r.left - 64, t: r.top - 72, r: r.right + 64, b: r.bottom + 72 };
    const x1 = h.x + (h.dx || 0);
    const y1 = h.y + (h.dy || 0);
    const inside = (x, y) => x >= box.l && x <= box.r && y >= box.t && y <= box.b;
    if (inside(h.x, h.y) || inside(x1, y1)) return true;
    for (let t = 0.2; t < 1; t += 0.2) if (inside(h.x + (x1 - h.x) * t, h.y + (y1 - h.y) * t)) return true;
    return false;
  }

  function dirOk(want, got) {
    if (!want || got === want) return !!got || !want;
    const side = { right: ['up', 'down'], left: ['up', 'down'], up: ['left', 'right'], down: ['left', 'right'] };
    return !!side[want]?.includes(got);
  }

  function live(note) {
    return !note.resolved && song >= note.release - 0.05 && song <= note.due + TUNE.window;
  }

  function project(pos) {
    const v = pos.clone().project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  function distPointSeg(px, pz, ax, az, bx, bz) {
    const abx = bx - ax, abz = bz - az;
    const denom = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / denom));
    return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
  }

  function strokeDist(h, sx, sy) {
    const x1 = h.x + (h.dx || 0);
    const y1 = h.y + (h.dy || 0);
    const vx = x1 - h.x;
    const vy = y1 - h.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 < 1 ? 0 : Math.max(0, Math.min(1, ((sx - h.x) * vx + (sy - h.y) * vy) / len2));
    return Math.hypot(h.x + vx * t - sx, h.y + vy * t - sy);
  }

  function onDown(e) {
    if (e.target.closest && e.target.closest('#draw, #hops, #block, #pound, #spin, #dodgePad, #repad, #settings, #gear, #menu, #rush, #cast, #spell, #stick, #fish, #reel, #mood')) return;
    const two = hold.size >= 1;
    hold.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), held: false, dx: 0, dy: 0, two });
  }

  function onMove(e) {
    const h = hold.get(e.pointerId);
    if (!h) return;
    h.dx = e.clientX - h.x;
    h.dy = e.clientY - h.y;
    if (performance.now() - h.t > 220) h.held = true;
  }

  function onUp(e) {
    const h = hold.get(e.pointerId);
    hold.delete(e.pointerId);
    if (!h) return;
    if (performance.now() - h.t > 220) h.held = true;
    const swipe = dirOf(h.dx || 0, h.dy || 0);
    if (swipe) trail(h.x, h.y, h.x + (h.dx || 0), h.y + (h.dy || 0), Math.hypot(h.dx || 0, h.dy || 0) > 150);
    if (tryTarget(h)) return;
    if (tryLock(h)) return;
    if (h.held && swipe) airSlice(h.dx || 0, h.dy || 0);
    for (const note of notes) {
      if (!live(note)) continue;
      if (note.kind === 'wall' && note.shape !== 'wide') continue;
      if (note.orbit && song < note.due - 0.22) continue;
      gradeHit(note, h);
    }
    for (const note of notes) {
      if (note.shape === 'deep' && !note.resolved && note.depth > 0) finishDeep(note);
    }
  }

  let padWired = false;
  function wirePad() {
    const pad = document.getElementById('dodgePad');
    if (!pad || padWired) return;
    padWired = true;
    const nub = pad.querySelector('.nub');
    let pid = null;
    let x0 = 0;
    let y0 = 0;
    let x = 0;
    let y = 0;
    let t0 = 0;
    pad.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'runTab') return;
      pid = e.pointerId;
      x0 = x = e.clientX;
      y0 = y = e.clientY;
      t0 = performance.now();
      try { pad.setPointerCapture?.(e.pointerId); } catch { /* a synthetic press has no live pointer */ }
      e.preventDefault();
      e.stopPropagation();
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      x = e.clientX;
      y = e.clientY;
      const dx = x - x0;
      const dy = y - y0;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(26, len) / len;
      if (nub) nub.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      e.preventDefault();
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (nub) nub.style.transform = '';
      const dx = x - x0;
      const dy = y - y0;
      const len = Math.hypot(dx, dy);
      const held = (performance.now() - t0) / 1000;
      if (len < 14) return;
      const push = Math.min(1, (len / 72) * 0.62 + Math.min(1, held / 0.45) * 0.38);
      const upFlick = dy < -16 && Math.abs(dy) > Math.abs(dx) * 1.15 && held < 0.28;
      if (upFlick) { disengage(); return; }
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'back');
      beginDodge(dir, push);
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    document.getElementById('runTab')?.addEventListener('pointerup', (e) => {
      disengage();
      e.preventDefault();
      e.stopPropagation();
    });
    document.getElementById('repad')?.addEventListener('pointerup', (e) => {
      engagePad();
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function disengage() { padOn = false; say('Run'); }
  function engagePad() { if (drawn) { padOn = true; say('Dodge'); } }

  function beginDodge(dir, push) {
    if (!walker) return;
    const delay = TUNE.dodgeDelay;
    const dur = Math.max(0.22, 0.64 - 0.36 * push);
    if (dir === 'down') {
      slide = { kind: 'crouch', t: -delay, dur, hold: 0.75 };
      say('Crouch');
      return;
    }
    if (dir === 'back') {
      const frame = laneFrame();
      const fx = frame ? frame.fx : Math.sin(walker.yaw);
      const fz = frame ? frame.fz : Math.cos(walker.yaw);
      const dist = 0.8 + 0.9 * push;
      slide = { kind: 'side', t: -delay, dur, sx: walker.feet.x, sz: walker.feet.z, x: walker.feet.x - fx * dist, z: walker.feet.z - fz * dist };
      say('Back');
      return;
    }
    const frame = laneFrame();
    const yaw = walker.yaw;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const rx = frame ? frame.rx : cy;
    const rz = frame ? frame.rz : -sy;
    const side = dir === 'left' ? 1 : -1;
    const dist = 0.8 + 0.9 * push;
    slide = { kind: 'side', t: -delay, dur, sx: walker.feet.x, sz: walker.feet.z, x: walker.feet.x + rx * side * dist, z: walker.feet.z + rz * side * dist };
    say(dir === 'left' ? 'Left' : 'Right');
  }

  function easeDodge(dt) {
    if (!slide || !walker) return;
    slide.t += dt;
    if (slide.kind === 'crouch') {
      const rise = slide.t < 0 ? 0 : Math.min(1, slide.t / slide.dur);
      const e = rise * rise * (3 - 2 * rise);
      if (slide.t < slide.dur) walker.crouch = e;
      else if (slide.t < slide.dur + slide.hold) walker.crouch = 1;
      else {
        const back = Math.min(1, (slide.t - slide.dur - slide.hold) / 0.32);
        walker.crouch = 1 - back * back * (3 - 2 * back);
        if (back >= 1) { walker.crouch = 0; slide = null; }
      }
      walker.look(camera);
      return;
    }
    if (slide.t < 0) return;
    const u = Math.min(1, slide.t / slide.dur);
    const e = u * u * (3 - 2 * u);
    walker.place(slide.sx + (slide.x - slide.sx) * e, slide.sz + (slide.z - slide.sz) * e, walker.yaw);
    walker.look(camera);
    if (u >= 1) slide = null;
  }

  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
  }

  function showTaunt() {
    let el = document.getElementById('taunt');
    if (!el) {
      el = document.createElement('div');
      el.id = 'taunt';
      el.textContent = 'Taunt';
      el.style.cssText = 'position:fixed;left:50%;top:32%;transform:translateX(-50%);z-index:12;color:#fff6dc;font:800 32px Georgia,serif;letter-spacing:0.08em;text-shadow:0 2px 0 #1a1008;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.hidden = false;
    clearTimeout(showTaunt._t);
    showTaunt._t = setTimeout(() => { el.hidden = true; }, 700);
  }

  function setBlock(on) {
    blocking = on;
    blockHeld = on ? 0 : 99;
    document.getElementById('block')?.classList.toggle('up', on);
  }

  function wireBlock() {
    const btn = document.getElementById('block');
    if (!btn || wiredBlock) return;
    wiredBlock = true;
    btn.addEventListener('pointerdown', (e) => { setBlock(true); e.preventDefault(); e.stopPropagation(); });
    const up = (e) => { setBlock(false); e.preventDefault(); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  }

  let chain = 0, chainAt = 0, swing = 0;
  function airSlice(dx, dy) {
    if (!scene || !camera || !world) return;
    camera.getWorldDirection(look);
    const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const len = Math.hypot(dx, dy) || 1;
    const aim = look.clone().multiplyScalar(-dy / len).addScaledVector(right, dx / len);
    aim.y = 0;
    if (aim.lengthSq() < 1e-6) aim.copy(look).setY(0);
    aim.normalize();
    const now = performance.now();
    if (now - chainAt > 900) chain = 0;
    const step = chain;
    chain = (chain + 1) % 3;
    chainAt = now;
    swing = 1;
    const arc = new THREE.Group();
    const span = step === 2 ? 2.4 : 1.85;
    const radius = step === 2 ? 1.7 : 1.35;
    const color = step === 2 ? '#ffe7a4' : step === 1 ? '#fff6dc' : '#7ee0ff';
    const up = new THREE.Vector3(0, 1, 0);
    const origin = camera.position.clone().add(look.clone().multiplyScalar(1.25));
    const count = 14;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const a = (u - 0.5) * span;
      const bit = new THREE.Mesh(
        new THREE.SphereGeometry(step === 2 ? 0.09 : 0.065, 6, 5),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
      );
      bit.position.copy(origin)
        .addScaledVector(right, Math.sin(a) * radius)
        .addScaledVector(up, (Math.cos(a) - 0.55) * radius * 0.42)
        .addScaledVector(look, (1 - Math.abs(u - 0.5)) * 0.35);
      arc.add(bit);
    }
    scene.add(arc);
    const strike = camera.position.clone().add(look.clone().multiplyScalar(2.2));
    const gy = (world.ground?.(strike.x, strike.z) ?? strike.y) + 0.05;
    const gouge = new THREE.Mesh(
      new THREE.PlaneGeometry(step === 2 ? 2.4 : 1.5, step === 2 ? 0.42 : 0.16),
      new THREE.MeshBasicMaterial({ color: step === 2 ? '#3a2818' : color, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }),
    );
    gouge.rotation.x = -Math.PI / 2;
    gouge.rotation.z = Math.atan2(look.x, look.z);
    gouge.position.set(strike.x, gy, strike.z);
    scene.add(gouge);
    cuts.push({ mesh: gouge, x: strike.x, z: strike.z, r: step === 2 ? 2.3 : 1.35, life: step === 2 ? 2.6 : 0.85, max: step === 2 ? 2.6 : 0.85 });
    world.mark?.(strike.x, strike.z, step === 2 ? 1.6 : 0.8, 0, step === 2 ? 0.28 : 0.06);
    const beast = zones?.beasts?.().find((b) => !b.dead && Math.hypot(b.x - strike.x, b.z - strike.z) < 2.4);
    let dmg = [8, 14, 26][step];
    try { if ((JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.bram?.fp || 0) >= 90) dmg = Math.round(dmg * 1.25); } catch { /* ordinary cut */ }
    if (beast) zones.hurt([{ x: beast.x, z: beast.z, r: 1.3, d: dmg, k: 'arcane', bleed: step === 2 ? 3.2 : 0 }]);
    shots.push({ mesh: arc, v: aim.multiplyScalar(0), life: 0.55, max: 0.55, kind: 'arc', stuck: true, blew: true, chopped: true });
    say(step === 2 ? 'Heavy' : `Cut ${step + 1}`);
  }

  function spawnLob() {
    if (!scene || !zones || !camera) return;
    const eye = camera.position;
    let best = null;
    let bestD = 14;
    for (const b of zones.beasts()) {
      if (b.dead || b.kind !== 'wolf') continue;
      const d = Math.hypot(b.x - eye.x, b.z - eye.z);
      if (d < bestD) { best = b; bestD = d; }
    }
    if (!best) return;
    const mesh = new THREE.Mesh(lobGeo, lobMat);
    mesh.position.set(best.x, best.y + 0.9, best.z);
    const dx = eye.x - best.x;
    const dz = eye.z - best.z;
    const dist = Math.hypot(dx, dz) || 1;
    const flight = Math.min(1.7, Math.max(0.85, dist / 5.5));
    const ty = eye.y - 0.15;
    const v = new THREE.Vector3(dx / flight, (ty - mesh.position.y + 0.5 * GRAV * flight * flight) / flight, dz / flight);
    scene.add(mesh);
    shots.push({ mesh, v, life: 3.4, kind: 'lob' });
    lobCool = 3.4;
  }

  function reflect(shot) {
    const perfect = blocking && blockHeld <= 0.2;
    const bounced = shots.filter((s) => s.kind === 'bounce' && s.life > 0).length;
    if (bounced >= MAX_BOUNCE) {
      scene.remove(shot.mesh);
      shot.life = 0;
    } else {
      shot.kind = 'bounce';
      shot.mesh.material = bounceMat;
      shot.v.multiplyScalar(-0.9);
      shot.v.y = Math.abs(shot.v.y) + 4;
      shot.life = 2.6;
    }
    say(perfect ? 'Taunt' : 'Blocked');
    if (perfect) showTaunt();
  }

  function nearest(kind, max) {
    const eye = camera.position;
    let best = null;
    let bestD = max;
    for (const b of zones.beasts()) {
      if (b.dead || b.kind !== kind) continue;
      const d = Math.hypot(b.x - eye.x, b.z - eye.z);
      if (d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  function meet(blockingNow) {
    if (!blockingNow) { say('Hit'); zones?.nick?.(12); return; }
    const perfect = blocking && blockHeld <= 0.2;
    say(perfect ? 'Parry' : 'Blocked');
    if (perfect) { showTaunt(); parryBurst(); }
  }

  function spawnBoar() {
    const boar = nearest('boar', 11);
    if (!boar) return;
    const eye = camera.position;
    const dx = eye.x - boar.x;
    const dz = eye.z - boar.z;
    const len = Math.hypot(dx, dz) || 1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.4), new THREE.MeshBasicMaterial({ color: '#e23b32', transparent: true, opacity: 0.8 }));
    const y = world.ground(boar.x, boar.z) + 0.12;
    mesh.position.set(boar.x, y, boar.z);
    mesh.lookAt(boar.x + dx, y, boar.z + dz);
    scene.add(mesh);
    threats.push({ kind: 'charge', t: 0, wind: 0.6, rush: 0.38, mesh, x: boar.x, z: boar.z, dx: dx / len, dz: dz / len, dist: Math.min(len, 6.5), resolved: false });
    boarCool = 4.6;
  }

  function spawnSlime() {
    const slime = nearest('slime', 10);
    if (!slime) return;
    const eye = camera.position;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.25, 20), new THREE.MeshBasicMaterial({ color: '#7dff5a', side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(eye.x, world.ground(eye.x, eye.z) + 0.08, eye.z);
    scene.add(mesh);
    threats.push({ kind: 'slam', t: 0, wind: 0.7, mesh, x: eye.x, z: eye.z, resolved: false });
    slimeCool = 4.8;
  }

  function threatsUpdate(dt) {
    boarCool -= dt;
    slimeCool -= dt;
    if (boarCool <= 0) spawnBoar();
    if (slimeCool <= 0) spawnSlime();
    const eye = camera.position;
    for (let i = threats.length - 1; i >= 0; i--) {
      const threat = threats[i];
      threat.t += dt;
      if (threat.kind === 'charge') {
        const u = threat.t < threat.wind ? 0 : Math.min(1, (threat.t - threat.wind) / threat.rush);
        const x = threat.x + threat.dx * threat.dist * u;
        const z = threat.z + threat.dz * threat.dist * u;
        threat.mesh.position.set(x, world.ground(x, z) + 0.12, z);
        threat.mesh.material.opacity = threat.t < threat.wind ? 0.35 + 0.4 * Math.sin(threat.t * 24) : 0.9;
        if (!threat.resolved && u > 0.8 && Math.hypot(eye.x - x, eye.z - z) < 1.25) {
          threat.resolved = true;
          meet(blocking);
        }
        if (u >= 1) { scene.remove(threat.mesh); threats.splice(i, 1); }
      } else {
        if (!threat.resolved && threat.t >= threat.wind) {
          threat.resolved = true;
          if (Math.hypot(eye.x - threat.x, eye.z - threat.z) < 1.3) meet(blocking);
          else say('Dodge');
          scene.remove(threat.mesh);
          threats.splice(i, 1);
        }
      }
    }
  }

  function defense(dt, active) {
    const btn = document.getElementById('block');
    if (btn) btn.hidden = !active;
    if (!scene || !camera) return;
    shield.visible = !!(active && blocking);
    if (shield.visible) {
      camera.getWorldDirection(look);
      shield.position.copy(camera.position).addScaledVector(look, 0.9);
      shield.quaternion.copy(camera.quaternion);
    }
    if (blocking) blockHeld += dt;
    if (!active) {
      blocking = false;
      blockHeld = 99;
      for (const threat of threats) scene.remove(threat.mesh);
      threats.length = 0;
      return;
    }
    wireBlock();
    // The lane attacks are the fight. The old lob, charge, and slam stay quiet while the blade is drawn.
    const eye = camera.position;
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.life -= dt;
      if (shot.stuck) {
        if (shot.kind === 'arc') {
          const age = (shot.max || 0.55) - Math.max(0, shot.life);
          const u = Math.min(1, age / 0.2);
          const fade = Math.max(0, shot.life / (shot.max || 0.55));
          shot.mesh.children.forEach((c, n) => {
            const t = n / Math.max(1, shot.mesh.children.length - 1);
            c.material.opacity = t <= u + 0.2 ? fade : 0;
          });
        } else if (shot.mesh.material) shot.mesh.material.opacity = Math.max(0, shot.life / 0.45);
        if (shot.kind === 'parry') shot.mesh.scale.setScalar(1 + (0.32 - Math.max(0, shot.life)) * 4);
        if (shot.life <= 0) { shot.mesh.parent?.remove(shot.mesh); shots.splice(i, 1); }
        continue;
      }
      if (shot.kind !== 'slice') shot.v.y -= GRAV * dt;
      shot.mesh.position.addScaledVector(shot.v, dt);
      if (shot.kind !== 'slice') {
        const gy = world.ground(shot.mesh.position.x, shot.mesh.position.z) + 0.2;
        if (shot.mesh.position.y < gy) { shot.mesh.position.y = gy; shot.v.y = Math.abs(shot.v.y) * 0.45; }
      }
      if (shot.kind === 'lob') {
        const near = Math.hypot(shot.mesh.position.x - eye.x, shot.mesh.position.z - eye.z) < 1.15 && Math.abs(shot.mesh.position.y - eye.y) < 1.5;
        if (near && blocking) reflect(shot);
        else if (near) { say('Hit'); zones?.nick?.(12); shot.life = 0; }
      } else if (shot.kind === 'spark') {
        shot.mesh.material.opacity = Math.max(0, shot.life / 0.28);
      } else if (shot.kind === 'slice') {
        const p = shot.mesh.position;
        const speed = Math.hypot(shot.v.x, shot.v.z) || 1;
        world.blow(p.x, p.z, shot.v.x / speed, shot.v.z / speed, 3, dt);
        if (!shot.chopped) { shot.chopped = true; world.chop?.(p.x, p.z, shot.v.x, shot.v.z, TUNE.chopReach); }
        const beast = zones.beasts().find((b) => !b.dead && Math.hypot(b.x - shot.mesh.position.x, b.z - shot.mesh.position.z) < 2.2);
        if (beast) {
          zones.hurt([{ x: beast.x, z: beast.z, r: 1.3, d: shot.dmg || 6, k: 'arcane', bleed: (shot.dmg || 0) >= 20 ? 3.2 : 0, kx: shot.v.x * (shot.kick || 0.04), kz: shot.v.z * (shot.kick || 0.04) }]);
          shot.life = 0;
        }
      } else {
        const beast = zones.beasts().find((b) => !b.dead && Math.hypot(b.x - shot.mesh.position.x, b.z - shot.mesh.position.z) < 1.15);
        if (beast) {
          zones.hurt([{ x: beast.x, z: beast.z, r: 1.2, d: 8, k: 'arcane' }]);
          shot.life = 0;
        }
      }
      if (shot.life <= 0) { scene.remove(shot.mesh); shots.splice(i, 1); }
    }
  }

  function frameHold() {
    const frame = laneFrame();
    if (!frame || !walker) return;
    const chest = world.ground(frame.beast.x, frame.beast.z) + 1.05;
    const drop = walker.feet.y + 1.66 - chest;
    walker.pitch = -Math.atan2(Math.max(0.45, drop), Math.max(1.2, frame.dist));
  }

  function clearRails() {
    for (const note of notes) { scene?.remove(note.group); if (note.rail) scene.remove(note.rail); }
    notes.length = 0;
  }

  function clearNotes() {
    for (const note of notes) { scene?.remove(note.group); if (note.rail) scene.remove(note.rail); }
    notes.length = 0;
    glows.forEach((m) => { m.visible = false; });
    if (rush) { rush.board.remove(); rush = null; }
    slide = null;
    if (clash) { clash.beast.release(); clash = null; }
    if (walker) walker.crouch = 0;
    stagger = 0;
    openFor = 0;
  }

  const cuts = [];
  function update(dt, classOn, inRange) {
    for (let i = cuts.length - 1; i >= 0; i--) {
      const c = cuts[i];
      c.life -= dt;
      if (c.mesh?.material) c.mesh.material.opacity = Math.max(0, c.life / c.max) * 0.82;
      if (c.life <= 0) { scene.remove(c.mesh); cuts.splice(i, 1); }
    }
    warrior = !!classOn;
    const board = root();
    const label = document.getElementById('bladeSay');
    const drawBtn = document.getElementById('draw');
    if (drawBtn) {
      drawBtn.hidden = !classOn;
      drawBtn.textContent = drawn ? 'Sheathe' : 'Draw';
    }
    const hops = document.getElementById('hops');
    if (hops) hops.hidden = true;
    document.body.classList.toggle('blade-drawn', !!(classOn && drawn));
    document.body.classList.toggle('blade-pad', !!(classOn && drawn && padOn));
    const engaged = !!(classOn && drawn && inRange);
    if (board) board.hidden = true;
    if (label) label.hidden = !engaged;
    const dodge = document.getElementById('dodge');
    if (dodge) dodge.hidden = true;
    const dodgePad = document.getElementById('dodgePad');
    if (dodgePad) dodgePad.hidden = !(classOn && drawn && padOn);
    const repad = document.getElementById('repad');
    if (repad) repad.hidden = !(classOn && drawn && !padOn);
    wirePad();
    const poundBtn = document.getElementById('pound');
    if (poundBtn) poundBtn.hidden = !(classOn && drawn);
    const spinBtn = document.getElementById('spin');
    if (spinBtn) spinBtn.hidden = !(classOn && drawn);
    const meter = document.getElementById('stagger');
    if (meter) meter.hidden = !(classOn && drawn);
    paintMeter();
    paintTarget();
    const decoyBtn = document.getElementById('decoy');
    if (decoyBtn) {
      decoyBtn.hidden = !(classOn && drawn);
      if (!decoyBtn.dataset.wired) {
        decoyBtn.dataset.wired = '1';
        decoyBtn.addEventListener('pointerup', (e) => { setDecoy(!decoy); e.preventDefault(); e.stopPropagation(); });
      }
    }
    if (swing > 0) swing = Math.max(0, swing - dt * 3.4);
    poundTick(dt);
    orbitTick(dt);
    tickHolo(holos, song);
    if (engaged) tickDeep(dt);
    for (let i = shards.length - 1; i >= 0; i--) {
      const bit = shards[i];
      bit.life -= dt;
      bit.m.position.addScaledVector(bit.v, dt);
      bit.m.scale.setScalar(Math.max(0.05, bit.life / (bit.span || 0.42)));
      if (bit.span && bit.m.material) bit.m.material.opacity = Math.max(0, bit.life / bit.span);
      if (bit.life <= 0) { scene?.remove(bit.m); shards.splice(i, 1); }
    }
    if (classOn && drawn && zones && walker && !clash) zones.holdBeasts(walker.feet.x, walker.feet.z, TUNE.holdMin, TUNE.holdMax, dt);
    if (!clash) easeDodge(dt);
    layGlows(engaged ? laneFrame() : null);
    defense(dt, engaged);
    if (!engaged) {
      layTrack(false);
      origin.visible = false;
      if (wasEngaged) { song = 0; cursor = 0; orbsThisFight = 0; clearNotes(); }
      wasEngaged = false;
      return;
    }
    if (!wasEngaged) { song = 0; cursor = 0; }
    wasEngaged = true;
    wire();
    if (rush) {
      rush.t += dt;
      if (rush.t > 1.15) advanceRush(false);
      if (song > 0 && rush.t > 8) endRush();
      return;
    }
    const motion = freeze > 0 ? 0 : dt;
    if (freeze > 0) freeze -= dt;
    if (burst.userData.t > 0) {
      burst.userData.t -= dt;
      burst.scale.setScalar(0.4 + (0.45 - burst.userData.t) * 8);
      burst.material.opacity = Math.max(0, burst.userData.t / 0.45);
      if (burst.userData.t <= 0) burst.visible = false;
    }
    if (openFor > 0) {
      openFor -= motion;
      if (pendingOrb > 0) { pendingOrb -= motion; if (pendingOrb <= 0) forceOrb(); }
      if (openFor <= 0) { openFor = 0; stagger = 0; }
    }
    stepClash(motion);
    if (!clash) song += motion;
    if (hitShake > 0 && camera) {
      camera.rotateX(Math.sin(hitShake * 90) * TUNE.shake * hitShake);
      camera.rotateZ(Math.sin(hitShake * 60) * TUNE.shake * 0.65 * hitShake);
      hitShake = Math.max(0, hitShake - dt * 9);
    }
    const rate = Math.max(0.25, TUNE.attackRate);
    const loop = LOOP / rate;
    const pad = TUNE.windup + TUNE.anticipation;
    const flightGuess = Math.max(0.45, (TUNE.holdMin - 1) / Math.max(0.5, TUNE.travelSpeed));
    if (!fightOn) {
      if (notes.length) clearRails();
    } else if (backOpen()) {
      if (song > backNext) {
        const part = backFlip ? 'weak' : 'backstab';
        backFlip = !backFlip;
        spawn({ lane: 1, kind: 'back', dir: 'right', part, due: song + TUNE.windup + 0.7 });
        backNext = song + 1.35;
      }
    } else {
      while (cursor < 400) {
        const spec = PATTERN[cursor % PATTERN.length];
        const due = pad + spec.t / rate + Math.floor(cursor / PATTERN.length) * loop;
        if (due - flightGuess - TUNE.windup > song + 0.08) break;
        const before = notes.length;
        spawn({ ...spec, due });
        if (notes.length === before) break;
        cursor += 1;
      }
      if (song > 0.25 && !notes.some((n) => !n.resolved)) {
        const spec = PATTERN[cursor % PATTERN.length];
        const before = notes.length;
        spawn({ ...spec, due: song + 0.8 });
        if (notes.length > before) cursor += 1;
      }
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (!note.orbit && note.launch) bendNote(note, dt);
      const winding = song < note.release;
      if (winding) {
        note.group.position.copy(note.from);
        const left = note.release - song;
        const pulse = 0.35 + 0.6 * Math.abs(Math.sin((TUNE.windup - left) * 18));
        note.group.children.forEach((child) => { child.visible = child === note.glow; });
        note.glow.material.opacity = pulse;
        note.glow.scale.setScalar(1 + pulse * 0.35);
      } else {
        note.group.children.forEach((child) => { child.visible = child !== note.glow; });
        const u = flightU(song, note.due, note.flight);
        if (note.rail) {
          threadPoint(note, u, song, note.group.position);
          if (u < 0.98 && note.kind !== 'ring') {
            threadPoint(note, u + 0.05, song, threadOut);
            note.group.lookAt(threadOut.x, note.group.position.y, threadOut.z);
          }
        } else note.group.position.lerpVectors(note.from, note.to, u);
      }
      layRail(note);
      if (!note.resolved && note.shape === 'deep' && song >= note.due) {
        const feet = walker ? walker.feet : camera.position;
        const lateral = Math.hypot(feet.x - note.group.position.x, feet.z - note.group.position.z);
        if (lateral > WALL_HALF * 2.4 || slide) { note.resolved = true; say('Dodge'); }
        else if (blocking && note.depth < 1) breakHeavy(note, 'Block');
        else finishDeep(note);
      } else if (!note.resolved && note.weight === 'heavy' && song >= note.due) {
        if (blocking) breakHeavy(note, 'Block');
        else { note.resolved = true; combo = 0; say('Hit'); zones?.nick?.(12); flash(); }
      } else if (!note.resolved && note.weight === 'ring' && song >= note.due) {
        const crouched = (walker?.crouch || 0) > 0.45 || slide?.kind === 'crouch';
        note.resolved = true;
        if (crouched || slide) say(crouched ? 'Crouch' : 'Dodge');
        else { combo = 0; say('Hit'); zones?.nick?.(12); flash(); }
      } else if (note.kind === 'wall' && note.shape !== 'deep' && !note.resolved && song >= note.due) {
        const feet = walker ? walker.feet : camera.position;
        const lateral = Math.hypot(feet.x - note.group.position.x, feet.z - note.group.position.z);
        const crouched = (walker?.crouch || 0) > 0.6;
        if (!wallBlocks(lateral, crouched, note.ceiling)) { note.resolved = true; say(note.ceiling && crouched ? 'Crouch' : 'Dodge'); }
        else if (blocking) breakHeavy(note, 'Block');
        else { note.resolved = true; combo = 0; say('Hit'); zones?.nick?.(12); flash(); maybeOpen(); }
      } else if (!note.resolved && song > note.due + TUNE.window) fail(note);
      if (note.resolved && song > note.due + 0.35) {
        if (!note.orbit) scene?.remove(note.group);
        if (note.rail) scene?.remove(note.rail);
        notes.splice(i, 1);
      }
    }
    const liveNote = fightOn && notes.find((n) => !n.resolved && n.launch && n.kind !== 'back' && n.kind !== 'orb');
    const who = laneFrame();
    if (who) {
      origin.visible = true;
      origin.position.set(who.beast.x, world.ground(who.beast.x, who.beast.z) + 1.15, who.beast.z);
      const pulse = 0.85 + 0.3 * Math.abs(Math.sin(song * 9));
      origin.scale.setScalar(pulse);
    } else origin.visible = false;
    layTrack(!!who);
  }

  return {
    update,
    get combo() { return combo; },
    get swing() { return swing; },
    get chain() { return chain; },
    get song() { return song; },
    setBlock,
    get blocking() { return blocking; },
    setDrawn(on) { drawn = !!on; padOn = true; if (drawn) frameHold(); if (!drawn) { song = 0; cursor = 0; clearNotes(); poundCancel(); dropOrbit(); } },
    setFight(on) { fightOn = on !== false; if (!fightOn) clearRails(); },
    disengage() { padOn = false; say('Run'); },
    engagePad() { if (drawn) { padOn = true; say('Dodge'); } },
    get pad() { return !!(drawn && padOn); },
    setDecoy,
    clash(power, strength) { return clashMargin(power, strength); },
    get clashLast() { return lastClash; },
    get clashId() { return clashSeq; },
    get chimed() { return chimed; },
    get halves() { return shards.length; },
    get fighting() { return fightOn; },
    cut() { airSlice(0, -90); },
    parry() { parryBurst(); },
    flashParry,
    tryRush() { if (!drawn || rush) return; startRush(); },
    get bend() {
      const note = notes.find((n) => !n.resolved && n.launch && n.kind !== 'back');
      if (!note) return 0;
      const dx = note.to.x - note.from.x;
      const dz = note.to.z - note.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const ang = Math.atan2((dx / len) * note.launch.z - (dz / len) * note.launch.x, (dx / len) * note.launch.x + (dz / len) * note.launch.z);
      return +((ang * 180) / Math.PI).toFixed(1);
    },
    cutFlat() { const c = cuts[0]; return c ? { x: c.x, z: c.z, r: c.r } : null; },
    get locked() { return lockN; },
    lock(n) { lockN = n == null ? null : n; },
    get thread() {
      const note = notes.find((n) => !n.resolved && n.rail && n.launch);
      if (!note) return null;
      let sag = 0;
      let side = 0;
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const p = threadPoint(note, t, song, threadOut);
        const straight = note.from.clone().lerp(note.to, t);
        sag = Math.max(sag, straight.y - p.y);
        side = Math.max(side, Math.hypot(p.x - straight.x, p.z - straight.z));
      }
      return { sag: +sag.toFixed(3), side: +side.toFixed(3) };
    },
    get back() { return backOpen(); },
    spin,
    get drawn() { return drawn; },
    get score() { return scoreTotal; },
    get flyers() { return notes.filter((n) => !n.resolved).length; },
    get live() {
      return notes.filter((n) => !n.resolved).map((n) => {
        const s = project(n.group.position);
        return { kind: n.kind, shape: n.shape || '', weight: n.weight || '', dir: n.dir || '', combo: !!n.comboBox, phase: song < n.release ? 'wind' : 'fly', dt: +((n.due - song).toFixed(2)), x: s ? Math.round(s.x) : 0, y: s ? Math.round(s.y) : 0, depth: +((n.depth || 0).toFixed(2)), power: Math.round(n.power || 0) };
      });
    },
    get cue() {
      const note = notes.find((n) => !n.resolved);
      if (!note) return null;
      const s = project(note.group.position);
      return { kind: note.kind, dir: note.dir, part: note.part || '', weight: note.weight || '', shape: note.shape || '', ceiling: !!note.ceiling, phase: song < note.release ? 'wind' : 'fly', dt: +(note.due - song).toFixed(2), x: s ? Math.round(s.x) : 0, y: s ? Math.round(s.y) : 0, depth: +(note.depth || 0).toFixed(2), power: Math.round(note.power || 0) };
    },
    tune: TUNE,
    pound: poundRelease,
    poundStart,
    poundRelease,
    get poundCharge() { return poundCharge; },
    get poundRocks() { return risen.length; },
    get poundReachNow() { return poundWave ? +shockRing.scale.x.toFixed(2) : +poundRadius(poundCharge).toFixed(2); },
    get tossed() { return tossed; },
    get orbiting() { return orbit.pieces.filter((p) => !p.sent).length; },
    get orbitSpot() {
      let best = null;
      let bestD = 1e9;
      for (const piece of orbit.pieces) {
        if (piece.sent) continue;
        const s = project(piece.mesh.position);
        if (!s) continue;
        const d = Math.hypot(s.x - innerWidth / 2, s.y - innerHeight / 2);
        if (d < bestD) { best = s; bestD = d; }
      }
      return best ? { x: Math.round(best.x), y: Math.round(best.y), n: orbit.pieces.length } : null;
    },
    get poundHits() { return poundHits; },
    get stagger() { return openFor > 0 ? 1 : stagger; },
    get clashing() { return clash ? clash.phase : ''; },
    get open() { return openFor > 0; },
    get opening() {
      const note = notes.find((n) => n.kind === 'orb' && !n.resolved);
      if (!note) return null;
      const s = project(note.group.position);
      return { part: note.part, phase: song < note.release ? 'wind' : 'fly', x: s ? Math.round(s.x) : 0, y: s ? Math.round(s.y) : 0, dt: +(note.due - song).toFixed(2) };
    },
    get incoming() { return shots.filter((s) => s.kind === 'lob' && s.life > 0).length; },
    get bounced() { return shots.filter((s) => s.kind === 'bounce' && s.life > 0).length; },
    get close() {
      if (!camera) return false;
      return shots.some((s) => s.kind === 'lob' && s.life > 0 && Math.hypot(s.mesh.position.x - camera.position.x, s.mesh.position.z - camera.position.z) < 1.6);
    },
  };
}
