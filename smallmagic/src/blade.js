import * as THREE from 'three';
import { ANGLE_DOT_MIN, ANGLE_DOT_SUPER, LANE, SWORD_OFFSET, TUNE, angleDot, bladePoints, flightU, wallBlocks } from './rider.js';

// A phone sword rhythm. Approach, cut angle, and wall hits are adapted from Moon Rider
// (Supermedium, MIT) in rider.js. The pattern is original. No song and no BeatSaver map.
// Slice a block with a swipe. A side swipe in the dodge strip steps out of a wall.
// A down swipe there crouches under a low wall. Hold a gold block. Four clean hits
// launch the nearest beast. The staff is left alone.
// Block, held, raises a shield. A wolf's slow lob that meets it bounces back.
// A block pressed in the last moment shows Taunt. At most five bounced pieces live.

const LOOP = 5.1;
const PATTERN = [
  { t: 0.7, lane: 0, kind: 'slice', dir: 'right' },
  { t: 1.35, lane: 2, kind: 'slice', dir: 'left' },
  { t: 2.05, lane: 1, kind: 'wall' },
  { t: 2.8, lane: 1, kind: 'big' },
  { t: 3.55, lane: 0, kind: 'slice', dir: 'up' },
  { t: 4.25, lane: 1, kind: 'wall', ceiling: true },
];

const root = () => document.getElementById('blade');
const GRAV = 14;
const MAX_BOUNCE = 5;

export function createBlade(onLaunch, bits = {}) {
  let drawn = false;
  let wasEngaged = false;
  let song = 0;
  let combo = 0;
  let cursor = 0;
  let freeze = 0;
  let rush = null;
  const notes = [];
  const hold = new Map();
  const { scene, camera, world, zones, walker } = bits;
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

  function laneFrame() {
    if (!camera || !zones || !world) return null;
    const eye = camera.position;
    let best = null;
    let bestD = 14;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - eye.x, b.z - eye.z);
      if (d < bestD) { best = b; bestD = d; }
    }
    if (!best) return null;
    return { beast: best, dist: bestD, fx: (best.x - eye.x) / bestD, fz: (best.z - eye.z) / bestD, rx: bestD && (best.z - eye.z) / bestD, rz: -(best.x - eye.x) / bestD };
  }

  function layGlows(frame) {
    const eye = camera.position;
    glows.forEach((m, i) => {
      if (!frame) { m.visible = false; return; }
      const side = (i - 1) * LANE;
      const a = 1.5;
      const b = Math.min(frame.dist - 0.3, 7.2);
      const len = Math.max(0.6, b - a);
      const mid = (a + b) / 2;
      const hot = notes.some((n) => !n.resolved && n.lane === i && n.due - song < 0.55 && n.due - song > -0.15);
      m.visible = true;
      m.scale.set(1, 1, len);
      m.position.set(eye.x + frame.fx * mid + frame.rx * side, world.ground(eye.x, eye.z) + 0.28, eye.z + frame.fz * mid + frame.rz * side);
      m.rotation.y = Math.atan2(frame.fx, frame.fz);
      m.material.color.set(hot ? '#fff2b0' : '#7ec8ff');
      m.material.opacity = hot ? 0.7 : 0.34;
      m.position.y = world.ground(eye.x, eye.z) + 0.28;
    });
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

  function makeAttack(kind, dir, part) {
    const g = new THREE.Group();
    const color = kind === 'wall' ? '#e23b32' : kind === 'big' ? '#f1c453' : kind === 'orb' ? '#e8f6ff' : '#3ee0ff';
    let body;
    if (kind === 'orb') {
      body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }));
      g.add(body, ...partIcon(part || 'head'));
    } else if (kind === 'wall' && part === 'ceiling') {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      g.add(body);
    } else {
      body = new THREE.Mesh(kind === 'wall' ? new THREE.BoxGeometry(0.42, 0.9, 0.16) : new THREE.BoxGeometry(0.34, 0.34, 0.16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      g.add(body);
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    glow.position.z = 0.05;
    g.add(glow);
    if (kind === 'slice') {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), new THREE.MeshBasicMaterial({ color: '#102028' }));
      const spin = { right: -Math.PI / 2, left: Math.PI / 2, up: 0, down: Math.PI }[dir] ?? 0;
      arrow.rotation.z = spin;
      arrow.position.z = -0.18;
      g.add(arrow);
    }
    g.traverse((o) => { o.frustumCulled = false; });
    return { group: g, body, glow };
  }

  function spawn(spec) {
    const frame = laneFrame();
    if (!frame || !scene) return;
    const eye = camera.position;
    const side = (spec.lane - 1) * LANE;
    const ceiling = !!spec.ceiling;
    const lift = spec.kind === 'wall' ? (ceiling ? 1.55 : 0.9) : spec.kind === 'orb' ? 1.35 : 1.15;
    const from = new THREE.Vector3(frame.beast.x + frame.rx * side * 0.35, world.ground(frame.beast.x, frame.beast.z) + lift, frame.beast.z + frame.rz * side * 0.35);
    const to = new THREE.Vector3(eye.x + frame.fx * SWORD_OFFSET + frame.rx * side, world.ground(eye.x, eye.z) + lift, eye.z + frame.fz * SWORD_OFFSET + frame.rz * side);
    const made = makeAttack(spec.kind, spec.dir, ceiling ? 'ceiling' : spec.part);
    made.group.position.copy(from);
    made.group.lookAt(to.x, from.y, to.z);
    scene.add(made.group);
    const flight = Math.max(0.4, from.distanceTo(to) / Math.max(0.5, TUNE.travelSpeed));
    let due = spec.due;
    let release = due - flight;
    if (release - TUNE.windup < song) {
      release = song + TUNE.windup;
      due = release + flight;
    }
    notes.push({ ...spec, due, ceiling, group: made.group, body: made.body, glow: made.glow, from, to, flight, release, resolved: false, bx: frame.beast.x, bz: frame.beast.z });
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

  function trail(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 12) return;
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:${x0}px;top:${y0}px;width:${len}px;height:10px;margin-top:-5px;border-radius:6px;background:linear-gradient(90deg,#fff,#3ee0ff);transform-origin:0 50%;transform:rotate(${Math.atan2(y1 - y0, x1 - x0)}rad);z-index:12;pointer-events:none;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 160);
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

  function gradeHit(note, h) {
    if (note.resolved) return;
    const screen = project(note.group.position);
    const swipe = dirOf(h.dx || 0, h.dy || 0);
    const dist = screen ? strokeDist(h, screen.x, screen.y) : 999;
    const reach = 120;
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
    note.resolved = true;
    scoreTotal += score;
    const dmg = note.kind === 'orb' ? Math.max(10, Math.round(score / 6)) : Math.max(3, Math.round(score / 9));
    flash();
    freeze = grade === 'perfect' || grade === 'open' ? 0.08 : 0.04;
    const word = grade === 'perfect' ? 'Perfect' : grade === 'good' ? 'Good' : grade === 'open' ? (note.part || 'Open') : 'Chip';
    if (screen) floatScore(score, screen.x, screen.y, word);
    say(`${word} ${score}`);
    if (zones) zones.hurt([{ x: note.bx, z: note.bz, r: 1.6, d: dmg, k: 'arcane', kx: (note.to.x - note.from.x) * 0.02, kz: (note.to.z - note.from.z) * 0.02 }]);
    if (grade === 'perfect') { reflectCut(note); maybeOpen(); }
    if (grade === 'perfect' || grade === 'good' || grade === 'open') combo += 1;
    if (combo >= 4) startRush();
  }

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
    if (e.target.closest && e.target.closest('#draw, #hops, #block, #settings, #gear, #menu, #rush, #cast, #spell, #stick, #fish, #reel')) return;
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
    if (swipe) trail(h.x, h.y, h.x + (h.dx || 0), h.y + (h.dy || 0));
    const zone = h.y > innerHeight * 0.78 || h.x < 36 || h.x > innerWidth - 36 || h.two;
    const push = Math.min(1, Math.max(0, (Math.hypot(h.dx || 0, h.dy || 0) - 36) / 160) * 0.65 + Math.min(1, Math.max(0, (performance.now() - h.t) / 1000 - TUNE.dodgeDelay) / 0.4) * 0.35);
    if (zone && (swipe === 'left' || swipe === 'right' || swipe === 'down') && Math.hypot(h.dx || 0, h.dy || 0) > 28) {
      beginDodge(swipe, push);
      return;
    }
    if (h.held && swipe) airSlice(h.dx || 0, h.dy || 0);
    for (const note of notes) {
      if (!live(note) || note.kind === 'wall') continue;
      gradeHit(note, h);
    }
  }

  function beginDodge(dir, push) {
    if (!walker) return;
    const delay = TUNE.dodgeDelay;
    const dur = Math.max(0.22, 0.64 - 0.36 * push);
    if (dir === 'down') {
      slide = { kind: 'crouch', t: -delay, dur, hold: 0.75 };
      say('Crouch');
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
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.28), new THREE.MeshBasicMaterial({ color: '#3ee0ff', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    mesh.position.copy(camera.position);
    mesh.position.y -= 0.35;
    mesh.lookAt(mesh.position.x + aim.x, mesh.position.y, mesh.position.z + aim.z);
    scene.add(mesh);
    shots.push({ mesh, v: aim.multiplyScalar(18), life: 0.5, kind: 'slice', blew: false });
    say('Slice');
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
    if (!blockingNow) { say('Hit'); return; }
    const perfect = blocking && blockHeld <= 0.2;
    say(perfect ? 'Taunt' : 'Blocked');
    if (perfect) showTaunt();
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
    threatsUpdate(dt);
    lobCool -= dt;
    if (lobCool <= 0) spawnLob();
    const eye = camera.position;
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.life -= dt;
      if (shot.kind !== 'slice') shot.v.y -= GRAV * dt;
      shot.mesh.position.addScaledVector(shot.v, dt);
      if (shot.kind !== 'slice') {
        const gy = world.ground(shot.mesh.position.x, shot.mesh.position.z) + 0.2;
        if (shot.mesh.position.y < gy) { shot.mesh.position.y = gy; shot.v.y = Math.abs(shot.v.y) * 0.45; }
      }
      if (shot.kind === 'lob') {
        const near = Math.hypot(shot.mesh.position.x - eye.x, shot.mesh.position.z - eye.z) < 1.15 && Math.abs(shot.mesh.position.y - eye.y) < 1.5;
        if (near && blocking) reflect(shot);
        else if (near) { say('Hit'); shot.life = 0; }
      } else if (shot.kind === 'slice') {
        const p = shot.mesh.position;
        const speed = Math.hypot(shot.v.x, shot.v.z) || 1;
        world.blow(p.x, p.z, shot.v.x / speed, shot.v.z / speed, 3, dt);
        const beast = zones.beasts().find((b) => !b.dead && Math.hypot(b.x - shot.mesh.position.x, b.z - shot.mesh.position.z) < 1.3);
        if (beast) {
          zones.hurt([{ x: beast.x, z: beast.z, r: 1.3, d: 6, k: 'arcane', kx: shot.v.x * 0.04, kz: shot.v.z * 0.04 }]);
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

  function clearNotes() {
    for (const note of notes) scene?.remove(note.group);
    notes.length = 0;
    glows.forEach((m) => { m.visible = false; });
    if (rush) { rush.board.remove(); rush = null; }
    slide = null;
    if (walker) walker.crouch = 0;
  }

  function update(dt, classOn, inRange) {
    const board = root();
    const label = document.getElementById('bladeSay');
    const drawBtn = document.getElementById('draw');
    if (drawBtn) {
      drawBtn.hidden = !classOn;
      drawBtn.textContent = drawn ? 'Sheathe' : 'Draw';
    }
    const hops = document.getElementById('hops');
    if (hops) hops.hidden = !(classOn && drawn);
    document.body.classList.toggle('blade-drawn', !!(classOn && drawn));
    const engaged = !!(classOn && drawn && inRange);
    if (board) board.hidden = true;
    if (label) label.hidden = !engaged;
    const dodge = document.getElementById('dodge');
    if (dodge) dodge.hidden = !(classOn && drawn);
    if (classOn && drawn && zones && walker) zones.holdBeasts(walker.feet.x, walker.feet.z, TUNE.holdMin, TUNE.holdMax, dt);
    easeDodge(dt);
    layGlows(engaged ? laneFrame() : null);
    defense(dt, engaged);
    if (!engaged) {
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
    if (freeze > 0) freeze -= dt;
    else song += dt;
    const rate = Math.max(0.25, TUNE.attackRate);
    const loop = LOOP / rate;
    const pad = TUNE.windup + TUNE.anticipation;
    const flightGuess = Math.max(0.45, (TUNE.holdMin - 1) / Math.max(0.5, TUNE.travelSpeed));
    while (cursor < 400) {
      const spec = PATTERN[cursor % PATTERN.length];
      const due = pad + spec.t / rate + Math.floor(cursor / PATTERN.length) * loop;
      if (due - flightGuess - TUNE.windup > song + 0.08) break;
      spawn({ ...spec, due });
      cursor += 1;
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
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
        note.group.position.lerpVectors(note.from, note.to, flightU(song, note.due, note.flight));
      }
      if (note.kind === 'wall' && !note.resolved && song >= note.due) {
        note.resolved = true;
        const feet = walker ? walker.feet : camera.position;
        const lateral = distPointSeg(feet.x, feet.z, note.from.x, note.from.z, note.to.x, note.to.z);
        const crouched = (walker?.crouch || 0) > 0.6;
        if (!wallBlocks(lateral, crouched, note.ceiling)) say(note.ceiling && crouched ? 'Crouch' : 'Dodge');
        else if (blocking) {
          const perfect = blockHeld <= 0.2;
          say(perfect ? 'Taunt' : 'Blocked');
          if (perfect) showTaunt();
        } else { combo = 0; say('Hit'); flash(); maybeOpen(); }
      } else if (!note.resolved && song > note.due + TUNE.window) fail(note);
      if (note.resolved && song > note.due + 0.35) {
        scene?.remove(note.group);
        notes.splice(i, 1);
      }
    }
  }

  return {
    update,
    get combo() { return combo; },
    get song() { return song; },
    setBlock,
    setDrawn(on) { drawn = !!on; if (!drawn) { song = 0; cursor = 0; clearNotes(); } },
    get drawn() { return drawn; },
    get score() { return scoreTotal; },
    get flyers() { return notes.filter((n) => !n.resolved).length; },
    get cue() {
      const note = notes.find((n) => !n.resolved);
      if (!note) return null;
      const s = project(note.group.position);
      return { kind: note.kind, dir: note.dir, part: note.part || '', ceiling: !!note.ceiling, phase: song < note.release ? 'wind' : 'fly', dt: +(note.due - song).toFixed(2), x: s ? Math.round(s.x) : 0, y: s ? Math.round(s.y) : 0 };
    },
    tune: TUNE,
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
