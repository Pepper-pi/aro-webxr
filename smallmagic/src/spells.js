// The spells, and casting them.
//
// The staff holds one spell at a time (1 to 4, or the wheel). The left button casts it: some are thrown when the
// button is let go, and are bigger the longer it was held; some pour for as long as it is held.
//   Fire    thrown. A bolt that bursts where it lands and sets light to what will burn. Held: a ball of it.
//   Frost   poured. Cold that whitens the grass, puts out fire, freezes water hard enough to walk on, rimes a tree.
//   Wind    thrown. A gust that lays the grass flat ahead, strips leaves, and drives fire on. Held: a longer, wider one.
//   Growth  poured. What was burnt or frozen comes back, and more: long grass, and flowers where there were none.
//   Tornado  called down over a place (twister.js), then led about by where the staff points for as long as the button is down.
//   Singularity  held open over a place for as long as the button is down (hole.js); let go, it shuts and throws out what it took.
//   Explosion  gathered: held for some seconds until it goes by itself (blast.js). Let go sooner and it comes to nothing.
// Every spell is a light, and where a poured one works it draws its seal on the ground.
import * as THREE from 'three';
import { fireballRadius } from './blast.js';

export const SPELLS = [
  { key: 'fire', name: 'Fire', colour: '#ff7a1c', pour: false, sides: 3 },
  { key: 'frost', name: 'Frost Bolt', colour: '#9fe6ff', pour: false, sides: 6 },
  { key: 'wind', name: 'Wind', colour: '#dffff0', pour: false, sides: 4 },
  { key: 'growth', name: 'Growth', colour: '#7dff5a', pour: true, sides: 5 },
  { key: 'explosion', name: 'Explosion', short: 'Expl', colour: '#ff4a1c', pour: false, sides: 8 },
  { key: 'singularity', name: 'Singularity', short: 'Singul', colour: '#a06bff', pour: false, sides: 7 },
  { key: 'tornado', name: 'Tornado', colour: '#8fe0e4', pour: false, sides: 9 },
];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createSpells({ world, air, fx, fire, staff, beam, ruin, blast, hole, twister, camera, walker, dom, onSelect }) {
  const U = air.uniforms, rnd = fx.rnd, cols = SPELLS.map((s) => new THREE.Color(s.colour));
  const dir = V(0, 0, -1), tip = V(0, 0, 0), tmp = V(0, 0, 0), flat = V(0, 0, 0);
  const bolts = [], gusts = [], flash = { x: 0, y: -999, z: 0, power: 0, r: 1, c: [1, 1, 1] }, shock = { x: 0, z: 0, r: 1, power: 0 };
  const ices = [];
  world.iceCols = [];
  const shardMat = new THREE.MeshBasicMaterial({ color: '#c8fbff', transparent: true, opacity: 0.92 });
  const shardViolet = new THREE.MeshBasicMaterial({ color: '#b49bff', transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
  const makeShard = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), shardMat);
    body.scale.set(0.42, 0.42, 1.9);
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.62), shardViolet);
    g.add(body, wing);
    g.visible = false;
    world.root.add(g);
    return g;
  };
  const shards = [makeShard(), makeShard(), makeShard(), makeShard()];
  const sigil = new THREE.Group();
  const sigilA = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 6, 28), new THREE.MeshBasicMaterial({ color: '#ffb15a', transparent: true, opacity: 0.9, depthWrite: false }));
  const sigilB = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.01, 6, 20), new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true, opacity: 0.85, depthWrite: false }));
  sigilB.rotation.x = Math.PI / 2;
  const sigilBits = [];
  for (let i = 0; i < 8; i++) {
    const bit = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.95 }));
    sigil.add(bit);
    sigilBits.push(bit);
  }
  sigil.add(sigilA, sigilB);
  sigil.visible = false;
  world.root.add(sigil);
  let selected = 0, down = false, hold = 0, sealPower = 0, cooldown = 0, coolMax = 1, kick = 0, beamPower = 0, beamKind = 'frost', channel = false, tether = false, leash = false;
  const slotLeft = SPELLS.map(() => 0);
  const slotMax = SPELLS.map(() => 1);
  const wait = (t) => { cooldown = coolMax = t; slotLeft[selected] = t; slotMax[selected] = Math.max(0.05, t); };
  const beamTo = V(0, 0, -1);
  const select = (i) => { if (channel) { channel = false; blast.cancel(); } if (tether) { tether = false; hole.release(); } if (leash) { leash = false; twister.release(); } selected = ((i % SPELLS.length) + SPELLS.length) % SPELLS.length; hold = 0; onSelect?.(selected); };
  if (dom) {
    dom.addEventListener('mousedown', (e) => { if (e.button === 0 && document.pointerLockElement === dom) down = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) down = false; });
    addEventListener('keydown', (e) => { const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(e.code); if (n >= 0) select(n); });
    dom.addEventListener('wheel', (e) => select(selected + Math.sign(e.deltaY)));
  }
  let lit = false;
  // What is being cast, for whoever makes the sound of it: which spell; whether one is being gathered to throw and how far;
  // whether one is being poured, where it lands, how wide it has spread there, whether that is water. And `heard` is
  // told of what happens at an instant (a thing thrown, a thing landing, a tree shaken).
  let heard = null;
  const cast = { key: 'fire', holding: false, charge: 0, pour: null, target: null, spread: 0, water: false };
  const lamp = (i, x, y, z, r, c, power) => { if (power > 0.004) lit = true; U.uLamp.value[i].set(x, y, z, r); U.uLampCol.value[i].set(c[0] * power, c[1] * power, c[2] * power); };

  // --- fire ---
  function throwFire(charge, hit) {
    heard?.('fireThrow', { charge });
    const big = charge, speed = 36 - 12 * big, to = tmp.copy(hit.point).sub(tip), far = to.length();
    const v = to.normalize().multiplyScalar(speed); v.y += (far / speed) * 1.6;
    bolts.push({ p: tip.clone(), v: v.clone(), life: 0, big, ice: false });
    kick = 0.6 + 0.6 * big; wait(0.25);
    for (let i = 0; i < 14; i++) fx.spawn({ kind: 1, x: tip.x, y: tip.y, z: tip.z, vx: dir.x * 6 + rnd(3), vy: dir.y * 6 + rnd(3), vz: dir.z * 6 + rnd(3), life: 0.3 + 0.3 * Math.random(), size: [0.03, 0.01], colour: [1, 0.6, 0.15], drag: 2 });
  }
  function frostHere(x, z, r) {
    const S = world.state; let had = 0;
    if (!S) return 0;
    for (let j = Math.floor((z - r - S.z0) / S.cell); j <= (z + r - S.z0) / S.cell; j++) for (let i = Math.floor((x - r - S.x0) / S.cell); i <= (x + r - S.x0) / S.cell; i++) {
      if (i < 0 || j < 0 || i >= S.N || j >= S.N) continue;
      if (Math.hypot(S.x0 + (i + 0.5) * S.cell - x, S.z0 + (j + 0.5) * S.cell - z) < r) had += S.data[(j * S.N + i) * 4 + 1];
    }
    return had;
  }
  function throwFrost(charge, hit) {
    const big = charge, speed = 32 - 8 * big, to = tmp.copy(hit.point).sub(tip), far = to.length();
    const v = to.normalize().multiplyScalar(speed); v.y += (far / speed) * 1.1;
    bolts.push({ p: tip.clone(), v: v.clone(), life: 0, big, ice: true });
    kick = 0.35 + 0.4 * big; wait(0.3);
  }
  function host() {
    return api.placeAr && world.root.parent ? world.root.parent : world.root;
  }
  function groundY(x, z) {
    return api.placeAr && typeof api.floorY === 'number' ? api.floorY : world.ground(x, z);
  }
  function rememberIce(g, life, cols) {
    host().add(g);
    ices.push({ g, life, max: life, cols });
    world.iceCols = ices.flatMap((i) => i.cols);
  }
  /** A flat frost disc. Every landing leaves one. It fades and does not block. */
  function frostPatch(p, r) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.8, r * 0.42), 16), new THREE.MeshBasicMaterial({ color: '#e7fdff', transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, groundY(p.x, p.z) + 0.05, p.z);
    rememberIce(mesh, 14, []);
  }
  /** A solid wall across the throw, or a mound when the ground is already frozen. Both block feet and beasts. */
  function raiseIce(p, kind, vel) {
    const y0 = groundY(p.x, p.z);
    const fl = Math.hypot(vel?.x || 0, vel?.z || 0) || 1;
    const fx = (vel?.x || 0) / fl, fz = (vel?.z || 1) / fl;
    const g = new THREE.Group();
    g.position.set(p.x, y0, p.z);
    const iceShade = (tint, op) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTint: { value: new THREE.Color(tint) }, uOp: { value: op } },
      vertexShader: `varying vec3 vN; varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vW; uniform vec3 uTint; uniform float uOp;
        void main() {
          vec3 V = normalize(cameraPosition - vW);
          float rim = pow(1.0 - max(dot(normalize(vN), V), 0.0), 2.0);
          float facet = 0.55 + 0.45 * abs(normalize(vN).y);
          vec3 col = uTint * facet + vec3(0.55, 0.85, 1.0) * rim + vec3(0.35, 0.12, 0.55) * rim * rim;
          gl_FragColor = vec4(col, uOp * (0.42 + rim * 0.5));
        }`,
    });
    const ice = iceShade(kind === 'glacier' ? '#e7fbff' : '#b7f4ff', 0.78);
    const violet = iceShade('#9a86ff', 0.55);
    ice.opacity = 0.78;
    violet.opacity = 0.55;
    const cols = [];
    if (kind === 'glacier') {
      const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), ice);
      mound.scale.set(1.7, 0.9, 1.35);
      mound.position.y = 0.72;
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), violet);
      cap.position.y = 1.55;
      g.add(mound, cap);
      cols.push({ x: p.x, z: p.z, r: 1.55 });
    } else {
      const yaw = Math.atan2(fx, fz);
      g.rotation.y = yaw;
      for (let i = -2; i <= 2; i++) {
        const h = 1.15 + (Math.abs(i) === 1 ? 0.45 : 0);
        const shard = new THREE.CylinderGeometry(0.05, 0.16, 1, 5, 1);
        shard.translate(0, 0.5, 0);
        const slab = new THREE.Mesh(shard, Math.abs(i) === 2 ? violet : ice);
        slab.scale.set(1, h, 1);
        slab.position.set(i * 0.46, 0, (i % 2) * 0.05);
        slab.rotation.y = i * 0.35;
        const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), violet);
        tip.position.set(i * 0.46, h + 0.06, (i % 2) * 0.05);
        g.add(slab, tip);
        cols.push({ x: p.x + Math.cos(yaw) * i * 0.46, z: p.z - Math.sin(yaw) * i * 0.46, r: 0.42 });
      }
    }
    rememberIce(g, kind === 'glacier' ? 16 : 12, cols);
  }
  function wetAt(x, z) {
    return !!world.rain || world.ground(x, z) < world.water + 0.45;
  }
  function freezeLand(p, big, vel) {
    const wet = wetAt(p.x, p.z);
    const r = (2.2 + 5.2 * big) * (wet ? 1.7 : 1);
    const had = frostHere(p.x, p.z, Math.max(1.8, r * 0.4));
    world.mark(p.x, p.z, r, 1, (0.5 + 0.5 * big) * (world.rain ? 1.35 : 1));
    marks.push({ x: p.x, z: p.z, r: 1.6 + 1.4 * big, d: 8 + 12 * big, k: 'arcane', status: 'chill', chill: (2.6 + 5.2 * big) * (world.rain ? 1.35 : 1) });
    stamp('frost', p.x, p.z, 0.75 + big * 0.4);
    frostPatch(p, r);
    const glacier = big > 0.82 && had > 16;
    const wall = !glacier && (big > 0.55 || had > 8);
    if (glacier || wall) raiseIce(p, glacier ? 'glacier' : 'wall', vel);
    const n = glacier ? 10 : wall ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const x = p.x + Math.cos(a) * (0.3 + Math.random());
      const z = p.z + Math.sin(a) * (0.3 + Math.random());
      fx.spawn({ kind: 3, x, y: world.ground(x, z) + 0.2, z, vy: 0.6, life: 1.2, size: [0.08, 0.16], colour: glacier ? [0.82, 0.96, 1] : [0.55, 0.86, 1] });
    }
    Object.assign(flash, { x: p.x, y: p.y + 1, z: p.z, power: 0.7, r: 8 + 6 * big, c: [0.6, 0.9, 1.3] });
    const reach = 3.2 + 4.5 * big;
    for (let t = 1; t < world.trees.length; t++) {
      const tree = world.trees[t];
      if (!tree || tree.down) continue;
      const near = Math.hypot(tree.x - p.x, tree.z - p.z);
      if (near > reach) continue;
      const close = near < reach * 0.45;
      const wasBurning = tree.burning > 0;
      tree.frost = Math.min(1, (tree.frost || 0) + (0.35 + 0.65 * big) * (close ? 1 : 0.55) * (world.rain ? 1.35 : 1));
      if (tree.frost > 0.4) {
        if (wasBurning) fx.spawn({ kind: 2, x: tree.x, y: tree.y + tree.h * 0.45, z: tree.z, vy: 0.8, life: 1.4, size: [0.8, 2.2], colour: [0.9, 0.95, 1], alpha: 0.45, drag: 0.4 });
        tree.burning = 0;
      }
      if (tree.burnt > 0.92) tree.down = true;
      world.treeChanged(tree);
    }
  }
  function burst(p, big) {
    const onWater = world.ground(p.x, p.z) < world.water, r = 1.5 + 2.3 * big;
    marks.push({ x: p.x, z: p.z, r: r * 0.7, d: 50 + 40 * big, k: 'fire' });
    heard?.('fireBurst', { p, big, water: onWater });
    for (let i = 0, n = 70 + 150 * big; i < n; i++) {
      const a = Math.random() * 6.283, up = Math.random(), sp = (2 + 7 * Math.random()) * (1 + big);
      fx.spawn({ kind: 0, x: p.x + rnd(0.3), y: p.y + 0.2, z: p.z + rnd(0.3), vx: Math.cos(a) * sp * (1 - up * 0.6), vy: 1 + up * sp * 0.8, vz: Math.sin(a) * sp * (1 - up * 0.6), life: 0.35 + 0.55 * Math.random(), size: [0.5 + 0.6 * big, 1.0 + 1.3 * big], colour: [1, 1, 1], drag: 2.4 });
    }
    for (let i = 0, n = 40 + 90 * big; i < n; i++) { const a = Math.random() * 6.283, sp = 4 + 12 * Math.random(); fx.spawn({ kind: 1, x: p.x, y: p.y + 0.3, z: p.z, vx: Math.cos(a) * sp, vy: 3 + 9 * Math.random(), vz: Math.sin(a) * sp, life: 0.8 + 1.2 * Math.random(), size: [0.045, 0.012], colour: [1, 0.6, 0.15], grav: -9, drag: 0.6 }); }
    for (let i = 0, n = 7 + 9 * big; i < n; i++) fx.spawn({ kind: 2, x: p.x + rnd(r * 0.5), y: p.y + 0.6 + Math.random(), z: p.z + rnd(r * 0.5), vx: rnd(1.2), vy: 1.8 + 1.8 * Math.random(), vz: rnd(1.2), life: 2.6 + 2 * Math.random(), size: [0.9 + big, 3.2 + 2.4 * big], colour: onWater ? [0.9, 0.93, 1] : [0.1, 0.1, 0.13], alpha: onWater ? 0.5 : 0.5, wind: 1, drag: 0.5 });
    fx.spawn({ kind: 6, x: p.x, y: p.y + 0.8, z: p.z, life: 0.28, size: [2 + 2.5 * big, 5 + 7 * big], colour: [1, 0.86, 0.55], alpha: 0.7 });
    fx.spawn({ kind: 6, x: p.x, y: p.y + 1.2, z: p.z, life: 1.3, size: [3 + 3 * big, 6 + 7 * big], colour: [1, 0.4, 0.08], alpha: 0.16 });
    Object.assign(flash, { x: p.x, y: p.y + 1, z: p.z, power: 1, r: 10 + 10 * big, c: [2.2, 1.0, 0.3] });
    Object.assign(shock, { x: p.x, z: p.z, r: 3.5 + 5.5 * big, power: 1 });
    // what is built of blocks is torn open by it
    ruin?.blast(p, 1.7 + 2.1 * big, 1 + 0.9 * big);
    // it melts frost where it lands, and sets light to what will burn
    melt(p.x, p.z, r * 1.2);
    if (!onWater) fire.ignite(p.x, p.z, r, 0.6);
    stamp('fire', p.x, p.z, 0.85 + big * 0.35);
    if (!onWater) scorch(p.x, p.z, r * (0.55 + 0.25 * big));
    for (let t = 1; t < world.trees.length; t++) { const tree = world.trees[t]; if (tree.clumps.some(([x, y, z, cr]) => Math.hypot(x - p.x, y - p.y, z - p.z) < cr + 0.6 + 1.5 * big)) { tree.frost = 0; fire.kindle(tree); world.treeChanged(tree); } }
  }
  /** Takes frost off the ground within r of a place. Says how much there was. */
  function melt(x, z, r) {
    const S = world.state; let had = 0;
    for (let j = Math.floor((z - r - S.z0) / S.cell); j <= (z + r - S.z0) / S.cell; j++) for (let i = Math.floor((x - r - S.x0) / S.cell); i <= (x + r - S.x0) / S.cell; i++) {
      if (i < 0 || j < 0 || i >= S.N || j >= S.N) continue;
      if (Math.hypot(S.x0 + (i + 0.5) * S.cell - x, S.z0 + (j + 0.5) * S.cell - z) < r) { had += S.data[(j * S.N + i) * 4 + 1]; S.data[(j * S.N + i) * 4 + 1] = 0; }
    }
    if (had) S.touch();
    return had;
  }

  // --- wind ---
  function throwWind(charge) {
    heard?.('windThrow', { charge });
    flat.set(dir.x, 0, dir.z).normalize();
    gusts.push({ x: walker.feet.x + flat.x * 1.5, z: walker.feet.z + flat.z * 1.5, dx: flat.x, dz: flat.z, t: 0, life: 1.1 + 0.8 * charge, wide: 4.5 + 4.5 * charge, speed: 22, hit: new Set(), pull: charge > 0.45 });
    stamp('wind', walker.feet.x + flat.x * 3.2, walker.feet.z + flat.z * 3.2, 0.55 + charge * 0.4);
    kick = 0.5 + 0.5 * charge; wait(0.3);
    for (let i = 0; i < 26; i++) fx.spawn({ kind: 5, x: tip.x + rnd(0.3), y: tip.y + rnd(0.3), z: tip.z + rnd(0.3), vx: dir.x * 26 + rnd(7), vy: dir.y * 26 + rnd(5), vz: dir.z * 26 + rnd(7), life: 0.22 + 0.15 * Math.random(), size: [0.012, 0.012], colour: [0.92, 1, 0.96], alpha: 0.5, rot: 30 + 30 * Math.random() });
  }

  const marks = [];
  let pourMark = 0, boomPhase = '', boomId = 0, windMark = 0, stormMark = 0, bloomMark = 0, flowerMark = 0, stormStamp = false, holeStamp = false;
  const phoneFx = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 820);
  const scorches = [];
  const blooms = [];
  function scorch(x, z, radius) {
    const cap = phoneFx ? 4 : 8;
    while (scorches.length >= cap) {
      const old = scorches.shift();
      old.mesh.parent?.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 20),
      new THREE.MeshBasicMaterial({ color: '#24140e', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, world.ground(x, z) + 0.045, z);
    host().add(mesh);
    scorches.push({ mesh, life: 9, max: 9 });
  }
  function bloomFlowers(x, z, spread) {
    const cap = phoneFx ? 6 : 14;
    const n = phoneFx ? 3 : 7;
    for (let i = 0; i < n; i++) {
      while (blooms.length >= cap) {
        const old = blooms.shift();
        old.mesh.parent?.remove(old.mesh);
      }
      const a = Math.random() * 6.283;
      const r = spread * (0.25 + Math.random() * 0.7);
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      const colors = ['#ff8cb8', '#fff6e4', '#ffd84d', '#5cb828', '#80d133'];
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.16 + Math.random() * 0.1, 6),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(px, world.ground(px, pz) + 0.05, pz);
      host().add(mesh);
      blooms.push({ mesh, life: 12, max: 12 });
    }
  }
  const brands = [];
  const BRAND = {
    fire: ['#2c1810', 16, 1.7],
    frost: ['#e9fbff', 14, 1.9],
    wind: ['#e7fff6', 7, 2.1],
    growth: ['#c6ff9a', 11, 1.5],
    explosion: ['#4a2014', 18, 2.6],
    singularity: ['#d2b6ff', 9, 1.7],
    tornado: ['#d8fff8', 9, 2.6],
  };
  function stamp(key, x, z, scale = 1) {
    const spec = BRAND[key];
    if (!spec || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.28 * scale, spec[2] * scale, 28),
      new THREE.MeshBasicMaterial({ color: spec[0], transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    const y = world.ground(x, z) + 0.06;
    mesh.position.set(x, y, z);
    host().add(mesh);
    let pad = null;
    if (api.placeAr && key === 'fire') {
      pad = new THREE.Mesh(
        new THREE.CircleGeometry(spec[2] * scale * 0.86, 28),
        new THREE.MeshBasicMaterial({ color: '#2a140c', transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, y - 0.02, z);
      mesh.material.color.set('#ff7a2a');
      host().add(pad);
    }
    const embers = [];
    if (key === 'fire') {
      for (let i = 0; i < 7; i++) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffb15a' : '#ff6a1a', transparent: true, opacity: 0.95 }));
        e.position.set(x + (Math.random() - 0.5) * 1.4, y + 0.08, z + (Math.random() - 0.5) * 1.4);
        host().add(e);
        embers.push(e);
      }
    }
    brands.push({ mesh, embers, pad, life: spec[1], max: spec[1] });
  }
  const api = {
    get selected() { return selected; }, select,
    get cast() { return cast; },
    get slotCool() { return slotLeft.map((t, i) => (t > 0.02 ? Math.min(1, t / slotMax[i]) : 0)); },
    set hear(fn) { heard = fn; },
    press() { down = true; }, release() { down = false; },
    cancel() { down = false; hold = 0; },
    refresh() { cooldown = 0; },
    from: null, hideMark: false, placeAr: false, floor: null, floorY: null,
    get busy() { return bolts.length + gusts.length; },
    get ice() { return ices.map((i) => ({ life: +i.life.toFixed(2), cols: i.cols.length })); },
    marks,
    /** How bright the last burst still is to the eye, 0 to 1. */
    get glare() { return flash.power * flash.power * Math.max(0, 1 - Math.hypot(flash.x - camera.position.x, flash.z - camera.position.z) / 50); },
    blast, hole, twister,
    update(dt, realDt = dt) {
      const spell = SPELLS[selected], col = cols[selected];
      marks.length = 0;
      camera.getWorldDirection(dir);
      staff.tip(camera, tip);
      if (api.from) tip.copy(api.from);
      const hit = world.aim(camera.position, dir, 70), reach = spell.key === 'frost' ? 17 : 34;
      // (a block of the ruin may stand nearer than the ground or a tree)
      const block = ruin ? ruin.ray(camera.position, dir, hit.dist) : null;
      if (block !== null) { hit.point.copy(camera.position).addScaledVector(dir, block); hit.dist = block; hit.ground = hit.water = hit.none = false; hit.tree = null; }
      if (api.placeAr) {
        const landed = api.floor?.(camera.position, dir);
        if (landed) hit.point.copy(landed);
        else {
          const px = walker.feet.x + Math.sin(walker.yaw) * 2.3;
          const pz = walker.feet.z + Math.cos(walker.yaw) * 2.3;
          hit.point.set(px, groundY(px, pz), pz);
        }
        hit.dist = Math.max(0.4, camera.position.distanceTo(hit.point));
        hit.ground = true;
        hit.none = false;
        hit.tree = null;
        hit.water = false;
      }
      cooldown = Math.max(0, cooldown - dt);
      for (let i = 0; i < slotLeft.length; i++) slotLeft[i] = Math.max(0, slotLeft[i] - dt);
      let power = 1, circle = 0, seal = 0, target = null;
      if (down && cooldown <= 0) hold += dt;
      const pace = (typeof localStorage !== 'undefined' && (() => { try { return (JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.lumen?.fp || 0) >= 90; } catch { return false; } })()) ? 0.68 : 1.1;
      const windup = pace < 1 ? 0.12 : 0.25;
      const charge = Math.min(1, Math.max(0, (hold - windup) / pace));

      if (spell.key === 'tornado') {
        if (down && cooldown <= 0 && (leash || !twister.busy)) {
          // where the staff points on the ground: it is called down there, and afterwards led toward there
          flat.set(dir.x, 0, dir.z).normalize();
          // (looking up at it, at the sky, leaves it where it is)
          const p = leash && hit.none ? tmp.copy(twister.base) : hit.none || hit.tree ? tmp.copy(camera.position).addScaledVector(flat, hit.tree ? hit.dist : 40) : tmp.copy(hit.point);
          if (!api.placeAr && !leash && Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 16) { p.x = camera.position.x + flat.x * 16; p.z = camera.position.z + flat.z * 16; }
          p.y = api.placeAr ? groundY(p.x, p.z) : Math.max(world.ground(p.x, p.z), world.water);
          if (!leash) { leash = true; twister.begin(p); }
          if (twister.steer(p, dt)) { twister.release(); leash = false; wait(2.5); }
        } else if (leash) { leash = false; twister.release(); wait(2.5); }
        // (its circle is on the ground from the first instant, and is gone once it has struck)
        if (leash) { power = 1.2 + 0.15 * Math.sin(U.uNow.value * 12); circle = 0.25; target = twister.base; seal = twister.mark; U.uSeal.value.z = 8; }
        hold = 0;
      } else if (spell.key === 'singularity') {
        if (down && cooldown <= 0 && (tether || !hole.busy)) {
          if (!tether) {
            // over the place aimed at (never nearer than twenty-two metres)
            flat.set(dir.x, 0, dir.z).normalize();
            const p = hit.none ? tmp.copy(camera.position).addScaledVector(flat, 40) : tmp.copy(hit.point);
            if (Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 22) { p.x = camera.position.x + flat.x * 22; p.z = camera.position.z + flat.z * 22; }
            p.y = api.placeAr ? groundY(p.x, p.z) : Math.max(world.ground(p.x, p.z), world.water);
            tether = true; hole.begin(p, camera.position);
          }
          if (hole.hold(dt)) { hole.release(); tether = false; wait(3); kick = 1.3; }
        } else if (tether) { tether = false; hole.release(); wait(3); kick = 1.3; }
        if (tether) { power = 1.5 + 0.2 * Math.sin(U.uNow.value * 16); circle = 0.3; target = hole.ground; seal = hole.power; U.uSeal.value.z = 6 + 2.6 * hole.radius; }
        hold = 0;
      } else if (spell.key === 'explosion') {
        if (down && cooldown <= 0 && !blast.busy) {
          if (!channel) {
            // over the place aimed at (never nearer than sixteen metres: it is not a thing to stand under)
            flat.set(dir.x, 0, dir.z).normalize();
            const p = hit.none ? tmp.copy(camera.position).addScaledVector(flat, 45) : tmp.copy(hit.point);
            if (Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 16) { p.x = camera.position.x + flat.x * 16; p.z = camera.position.z + flat.z * 16; }
            p.y = api.placeAr ? groundY(p.x, p.z) : Math.max(world.ground(p.x, p.z), world.water);
            channel = true; blast.begin(p);
          }
          if (blast.gather(dt)) { blast.fire(); channel = false; wait(2.5); kick = 1.6; }
        } else if (channel) { channel = false; blast.cancel(); }
        if (blast.charge > 0) { power = 2.4 + 0.4 * Math.sin(U.uNow.value * 18); circle = 0.4 + 0.6 * blast.charge; target = blast.centre; seal = blast.charge; U.uSeal.value.z = 4 + 8 * blast.charge; }
        hold = 0;
      } else if (!spell.pour) {
        // gathered while the button is held, and thrown when it is let go
        if (down && cooldown <= 0) {
          power = 1.3 + 1.7 * charge; circle = 0.35 + 0.65 * charge;
          if (spell.key === 'fire') {
            const n = (24 + 50 * charge) * dt;
            for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) fx.spawn({ kind: 0, x: tip.x + rnd(0.05), y: tip.y - 0.03, z: tip.z + rnd(0.05), vx: rnd(0.12), vy: 0.2 + 0.3 * Math.random(), vz: rnd(0.12), life: 0.2 + 0.18 * Math.random(), size: [0.022 + 0.04 * charge, 0.04 + 0.055 * charge], colour: [1, 1, 1], alpha: 0.9 });
            if (hit.ground && !hit.water) { seal = 0.5 + 0.5 * charge; target = hit.point; U.uSeal.value.z = 1.5 + 3.4 * charge; }
          } else if (spell.key === 'frost') {
            const n = (18 + 30 * charge) * dt;
            for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) fx.spawn({ kind: 3, x: tip.x + rnd(0.06), y: tip.y, z: tip.z + rnd(0.06), vy: 0.15, life: 0.25, size: [0.04 + 0.05 * charge, 0.08], colour: [0.7, 0.92, 1] });
            if (hit.ground) { seal = 0.4 + 0.6 * charge; target = hit.point; U.uSeal.value.z = 1.4 + 3 * charge; }
          } else {
            const n = 40 * dt * (0.4 + charge);
            for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = 0.05 + 0.05 * Math.random(); fx.spawn({ kind: 5, x: tip.x + Math.cos(a) * r, y: tip.y + rnd(0.05), z: tip.z + Math.sin(a) * r, vx: -Math.sin(a) * 0.5, vy: rnd(0.1), vz: Math.cos(a) * 0.5, life: 0.3, size: [0.004, 0.004], colour: [0.9, 1, 0.95], alpha: 0.5 }); }
          }
        } else if (hold > 0) {
          if (spell.key === 'fire') throwFire(charge, hit); else if (spell.key === 'frost') throwFrost(charge, hit); else throwWind(charge);
          hold = 0;
        }
      } else if (down) {
        power = 2.2 + 0.3 * Math.sin(U.uNow.value * 14); circle = 0.7;
        if (!hit.none && hit.dist < reach) { target = hit.point; seal = 1; U.uSeal.value.z = spell.key === 'frost' ? 3.1 : 3.4; }
        if (spell.key === 'frost') {
          // Cold streams from the staff to the place in lines that show against anything, with ice in it. Where it
          // lands it rolls outward along the ground, and the frost spreads from there for as long as it is poured.
          const far = Math.min(hit.dist, reach);
          const wetPour = !!world.rain || (target && world.ground(target.x, target.z) < world.water + 0.45);
          const spread = (1.2 + 4.3 * (1 - Math.exp(-hold * 0.55))) * (wetPour ? 1.7 : 1);
          const n = (phoneFx ? 70 : 200) * dt;
          for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
            const sp = 16 + 6 * Math.random(), wide = sp * 0.055, pick = Math.random(), life = Math.min(1.1, far / sp);
            const vx = dir.x * sp + rnd(wide), vy = dir.y * sp + rnd(wide), vz = dir.z * sp + rnd(wide);
            if (pick < 0.36) fx.spawn({ kind: 1, x: tip.x, y: tip.y, z: tip.z, vx, vy, vz, life, size: [0.03, 0.06], colour: Math.random() < 0.5 ? [0.3, 0.72, 1] : [0.75, 0.95, 1] });
            else if (pick < 0.6) fx.spawn({ kind: 3, x: tip.x, y: tip.y, z: tip.z, vx: vx * 0.95, vy: vy * 0.95, vz: vz * 0.95, life, size: [0.05, 0.11], colour: [0.85, 0.97, 1], drag: 0.1 });
            else if (pick < 0.8) fx.spawn({ kind: 6, x: tip.x, y: tip.y, z: tip.z, vx, vy, vz, life, size: [0.12, 0.75], colour: [0.25, 0.65, 1], alpha: 0.2 });
            else fx.spawn({ kind: 2, x: tip.x, y: tip.y, z: tip.z, vx, vy, vz, life: Math.min(0.9, far / sp), size: [0.07, 0.8], colour: [0.42, 0.66, 1], alpha: 0.3, drag: 0.2 });
          }
          if (target) {
            U.uSeal.value.z = spread;
            const floor = (x, z) => Math.max(world.ground(x, z), world.water);
            world.mark(target.x, target.z, spread, 1, dt * 1.3);
            if (fire.quench(target.x, target.z, spread * 0.9)) for (let i = 0; i < 3; i++) fx.spawn({ kind: 2, x: target.x + rnd(1.5), y: target.y + 0.4, z: target.z + rnd(1.5), vy: 2.2, life: 1.8, size: [0.6, 2.2], colour: [0.92, 0.95, 1], alpha: 0.4, wind: 0.5 });
            // cold rolling outward over the ground from where it lands: mist that keeps low, and lines of it
            const n2 = 46 * dt;
            for (let q = Math.floor(n2) + (Math.random() < n2 % 1 ? 1 : 0); q > 0; q--) {
              const a = Math.random() * 6.283, r = spread * 0.2 * Math.random(), x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r, sp = 2.4 + 3 * Math.random();
              fx.spawn({ kind: 2, x, y: floor(x, z) + 0.2, z, vx: Math.cos(a) * sp, vy: 0.15, vz: Math.sin(a) * sp, life: 0.8 + 0.6 * Math.random(), size: [0.25, 1.0], colour: [0.48, 0.7, 1], alpha: 0.2, drag: 0.9 });
            }
            const n3 = 34 * dt;
            for (let q = Math.floor(n3) + (Math.random() < n3 % 1 ? 1 : 0); q > 0; q--) {
              const a = Math.random() * 6.283, r = spread * 0.12, x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r, sp = 6 + 3 * Math.random();
              fx.spawn({ kind: 5, x, y: floor(x, z) + 0.14, z, vx: Math.cos(a) * sp, vy: 0, vz: Math.sin(a) * sp, life: Math.min(1.1, (spread * 0.9) / sp), size: [0.012, 0.012], colour: [0.35, 0.78, 1], alpha: 0.8, rot: 14 + 12 * Math.random() });
            }
            // and crystals glinting where the frost has just reached
            const n4 = 40 * dt;
            for (let q = Math.floor(n4) + (Math.random() < n4 % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = spread * (0.75 + 0.25 * Math.random()), x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r; fx.spawn({ kind: 3, x, y: floor(x, z) + 0.1 + 0.4 * Math.random(), z, vy: 0.5, life: 0.6, size: [0.07, 0.02], colour: [0.8, 0.95, 1] }); }
            for (let t = 1; t < world.trees.length; t++) { const tree = world.trees[t]; if (tree === hit.tree || Math.hypot(tree.x - target.x, tree.z - target.z) < spread * 0.7) { tree.frost = Math.min(1, tree.frost + dt * (tree === hit.tree ? 0.7 : 0.35)); if (tree.frost > 0.4) tree.burning = 0; world.treeChanged(tree); } }
          }
        } else {
          // Growth: a stream of green and gold light arcs from the staff to the place, with leaves and petals borne
          // on it. Where it lands light wells up out of the ground, leaves wind upward round it, and the meadow
          // comes back, and more than back, in a ring that widens for as long as it is poured.
          if (target) {
            const far = tmp.copy(target).sub(tip).length(), spread = 1.4 + 4.4 * (1 - Math.exp(-hold * 0.5)), G = 7, n = (phoneFx ? 48 : 150) * dt;
            const PETALS = [[1, 0.55, 0.75], [1, 0.97, 0.9], [1, 0.85, 0.3], [0.35, 0.72, 0.16], [0.5, 0.82, 0.2]];
            U.uSeal.value.z = spread;
            for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
              // (lobbed, so that it arcs over and comes down on the place)
              const sp = 13 + 4 * Math.random(), T = far / sp, pick = Math.random(), c = Math.random() < 0.35 ? [1, 0.88, 0.4] : [0.45, 1, 0.3];
              const o = { x: tip.x, y: tip.y, z: tip.z, vx: (target.x - tip.x) / T + rnd(0.7), vy: (target.y - tip.y) / T + 0.5 * G * T + rnd(0.7), vz: (target.z - tip.z) / T + rnd(0.7), life: T, grav: -G };
              if (pick < 0.34) fx.spawn({ ...o, kind: 1, size: [0.03, 0.06], colour: c });
              else if (pick < 0.58) fx.spawn({ ...o, kind: 3, size: [0.05, 0.1], colour: c });
              else if (pick < 0.78) fx.spawn({ ...o, kind: 6, size: [0.1, 0.6], colour: [0.35, 0.9, 0.25], alpha: 0.16 });
              else fx.spawn({ ...o, kind: 4, size: [0.012, 0.085], colour: PETALS[Math.floor(Math.random() * PETALS.length)], rot: Math.random() * 6.283, spin: rnd(9) });
            }
            const n2 = (phoneFx ? 40 : 150) * dt;
            for (let q = Math.floor(n2) + (Math.random() < n2 % 1 ? 1 : 0); q > 0; q--) {
              const a = Math.random() * 6.283, r = spread * Math.sqrt(Math.random()), x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r, y = world.ground(x, z), pick = Math.random();
              const c = Math.random() < 0.4 ? [1, 0.9, 0.45] : [0.5, 1, 0.35];
              // light welling up in motes and in wavering threads; leaves and petals winding upward round the place;
              // lines of it running out along the ground; and a glow over all
              if (pick < 0.3) fx.spawn({ kind: 3, x, y: y + 0.1, z, vx: rnd(0.2), vy: 0.8 + 1.8 * Math.random(), vz: rnd(0.2), life: 1 + Math.random(), size: [0.13, 0.04], colour: c });
              else if (pick < 0.5) fx.spawn({ kind: 5, x, y: y + 0.3, z, vx: rnd(0.3), vy: 2.2 + 1.5 * Math.random(), vz: rnd(0.3), life: 0.9 + 0.6 * Math.random(), size: [0.02, 0.02], colour: c, alpha: 0.7, rot: 22 + 16 * Math.random() });
              else if (pick < 0.78) fx.spawn({ kind: 4, x, y: y + 0.2, z, vx: -Math.sin(a) * 2.4 + rnd(0.4), vy: 0.9 + 1.8 * Math.random(), vz: Math.cos(a) * 2.4 + rnd(0.4), life: 1.4 + Math.random(), size: [0.1, 0.15], colour: PETALS[Math.floor(Math.random() * PETALS.length)], grav: -0.6, drag: 0.5, rot: Math.random() * 6.283, spin: rnd(8) });
              else if (pick < 0.9) { const sp = 4 + 2.5 * Math.random(), r0 = spread * 0.12; fx.spawn({ kind: 5, x: target.x + Math.cos(a) * r0, y: world.ground(target.x + Math.cos(a) * r0, target.z + Math.sin(a) * r0) + 0.16, z: target.z + Math.sin(a) * r0, vx: Math.cos(a) * sp, vy: 0, vz: Math.sin(a) * sp, life: Math.min(1.2, (spread * 0.9) / sp), size: [0.02, 0.02], colour: c, alpha: 0.8, rot: 12 + 10 * Math.random() }); }
              else fx.spawn({ kind: 6, x, y: y + 0.6, z, life: 1 + 0.6 * Math.random(), size: [1.0, 2.4], colour: [0.6, 1, 0.3], alpha: 0.09 });
            }
            // where it has just reached, the flowers come out: a puff of petals and a wink of light at the edge of it
            const n3 = (phoneFx ? 6 : 22) * dt;
            for (let q = Math.floor(n3) + (Math.random() < n3 % 1 ? 1 : 0); q > 0; q--) {
              const a = Math.random() * 6.283, r = spread * (0.8 + 0.2 * Math.random()), x = target.x + Math.cos(a) * r, z = target.z + Math.sin(a) * r, y = world.ground(x, z), petal = PETALS[Math.floor(Math.random() * 3)];
              fx.spawn({ kind: 3, x, y: y + 0.35, z, life: 0.4, size: [0.3, 0.08], colour: [1, 0.95, 0.6] });
              for (let k = 0; k < 6; k++) fx.spawn({ kind: 4, x, y: y + 0.35, z, vx: rnd(1.3), vy: 1.4 + 1.6 * Math.random(), vz: rnd(1.3), life: 0.9 + 0.6 * Math.random(), size: [0.07, 0.1], colour: petal, grav: -4, drag: 0.6, rot: Math.random() * 6.283, spin: rnd(10) });
            }
            if (spell.key === 'growth' && hold > 0.35 && performance.now() - flowerMark > 700) {
              flowerMark = performance.now();
              bloomFlowers(target.x, target.z, spread);
            }
            melt(target.x, target.z, spread * 0.9 * Math.min(1, hold));
            fire.regrow(target.x, target.z, spread, dt * 0.9);
            world.mark(target.x, target.z, spread, 3, dt * 0.7);
            for (let t = 1; t < world.trees.length; t++) { const tree = world.trees[t]; if (tree.down) continue; if (tree === hit.tree || Math.hypot(tree.x - target.x, tree.z - target.z) < spread * 0.8) { if (tree.burning <= 0 && tree.burnt < 0.9) tree.burnt = Math.max(0, tree.burnt - dt * 0.3); tree.frost = Math.max(0, tree.frost - dt * 0.6); world.treeChanged(tree); } }
          }
        }
        hold += 0;
      } else hold = 0;

      cast.key = spell.key; cast.holding = (spell.key === 'fire' || spell.key === 'wind' || spell.key === 'frost') && down && cooldown <= 0; cast.charge = cast.holding ? charge : 0;
      cast.cool = cooldown > 0.02 ? Math.min(1, cooldown / coolMax) : 0;
      cast.pour = spell.pour && down ? spell.key : null; cast.target = cast.pour && target ? target : null;
      cast.spread = spell.key === 'frost' ? 1.2 + 4.3 * (1 - Math.exp(-hold * 0.55)) : 1.4 + 4.4 * (1 - Math.exp(-hold * 0.5));
      cast.water = Boolean(cast.target) && world.ground(target.x, target.z) < world.water;
      if (cast.pour && target) {
        pourMark -= dt;
        if (pourMark <= 0) {
          pourMark = 0.28;
          marks.push({ x: target.x, z: target.z, r: Math.max(1.4, cast.spread * 0.45), d: cast.pour === 'growth' ? 8 : 14, k: 'arcane', status: cast.pour === 'frost' ? 'chill' : null, kx: (Math.random() - 0.5) * 0.6, kz: (Math.random() - 0.5) * 0.6 });
        }
      } else pourMark = 0;

      // --- what has been thrown ---
      let carried = null;
      let shardN = 0;
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.life += dt; b.v.y -= 3.2 * dt; b.p.addScaledVector(b.v, dt);
        const n = ((b.ice ? 22 : 130) + (b.ice ? 18 : 150) * b.big) * dt;
        const tint = b.ice ? (Math.random() < 0.35 ? [0.72, 0.62, 1] : [0.7, 0.95, 1]) : [1, 1, 1];
        for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) fx.spawn({ kind: b.ice ? 3 : 0, x: b.p.x + rnd(0.06), y: b.p.y + rnd(0.06), z: b.p.z + rnd(0.06), vx: b.v.x * 0.05 + rnd(0.3), vy: b.v.y * 0.05 + rnd(0.3), vz: b.v.z * 0.05 + rnd(0.3), life: b.ice ? 0.28 : 0.22 + 0.25 * Math.random(), size: b.ice ? [0.05, 0.08] : [(0.13 + 0.2 * b.big) * Math.min(1, 0.25 + b.life * 3), (0.24 + 0.34 * b.big) * Math.min(1, 0.25 + b.life * 3)], colour: tint, rot: Math.random() * 6.283 });
        if (b.ice && shardN < shards.length) {
          const s = shards[shardN++];
          s.visible = true;
          s.position.copy(b.p);
          s.lookAt(b.p.x + b.v.x, b.p.y + b.v.y, b.p.z + b.v.z);
          s.scale.setScalar(0.7 + b.big * 1.1);
        }
        if (!b.ice) {
          fx.spawn({ kind: 1, x: b.p.x, y: b.p.y, z: b.p.z, vx: b.v.x, vy: b.v.y, vz: b.v.z, life: 0.05, size: [(0.12 + 0.14 * b.big) * Math.min(1, 0.2 + b.life * 3), 0.1 + 0.1 * b.big], colour: [1, 0.72, 0.3], alpha: 0.9 });
          fx.spawn({ kind: 6, x: b.p.x, y: b.p.y, z: b.p.z, life: 0.07, size: [0.6 + 0.6 * b.big, 0.6 + 0.6 * b.big], colour: [1, 0.5, 0.12], alpha: 0.16 });
          if (Math.random() < 20 * dt) fx.spawn({ kind: 1, x: b.p.x, y: b.p.y, z: b.p.z, vx: rnd(3), vy: rnd(3), vz: rnd(3), life: 0.5 + 0.5 * Math.random(), size: [0.035, 0.01], colour: [1, 0.6, 0.15], grav: -4, drag: 1 });
          if (Math.random() < 14 * dt) fx.spawn({ kind: 2, x: b.p.x, y: b.p.y, z: b.p.z, life: 1.1, size: [0.25, 1.1 + b.big], colour: [0.12, 0.12, 0.15], alpha: 0.3, vy: 0.6 });
        }
        carried = b;
        sigil.visible = true;
        sigil.position.copy(b.p);
        sigil.lookAt(b.p.x + b.v.x, b.p.y + b.v.y, b.p.z + b.v.z);
        sigilA.rotation.z += dt * 7;
        sigilB.rotation.y += dt * 5;
        sigilA.material.color.set(b.ice ? '#9fe6ff' : '#ff7a1c');
        sigilB.material.color.set(b.ice ? '#e7c8ff' : '#fff1c4');
        sigilBits.forEach((bit, n) => {
          const a = b.life * 9 + n;
          bit.position.set(Math.cos(a) * 0.2, Math.sin(a * 1.3) * 0.08, Math.sin(a) * 0.2);
          bit.material.color.copy(sigilA.material.color);
        });
        if (!b.ice) marks.push({ x: b.p.x, z: b.p.z, r: 0.7, d: 16, k: 'fire' });
        const floor = Math.max(world.ground(b.p.x, b.p.z), world.water);
        const inTree = world.trees.some((t, k) => k && t.burnt < 0.9 && t.clumps.some(([x, y, z, r]) => Math.hypot(x - b.p.x, y - b.p.y, z - b.p.z) < r * 0.75));
        if (b.p.y <= floor + 0.1 || inTree || b.life > 4 || ruin?.touches(b.p, 0.25 + 0.2 * b.big)) { if (b.p.y < floor) b.p.y = floor; if (b.ice) freezeLand(b.p, b.big, b.v); else burst(b.p, b.big); bolts.splice(i, 1); carried = null; }
      }
      for (let k = shardN; k < shards.length; k++) shards[k].visible = false;
      if (!bolts.length) sigil.visible = false;
      for (let i = ices.length - 1; i >= 0; i--) {
        const ice = ices[i];
        ice.life -= dt;
        const fade = Math.max(0, Math.min(1, ice.life / 1.4));
        ice.g.traverse((o) => {
          if (!o.material) return;
          if (o.material.userData.o0 == null) o.material.userData.o0 = o.material.uniforms?.uOp?.value || o.material.opacity || 0.72;
          o.material.opacity = o.material.userData.o0 * fade;
          if (o.material.uniforms?.uOp) o.material.uniforms.uOp.value = o.material.userData.o0 * fade;
        });
        if (ice.life <= 0) { world.root.remove(ice.g); ices.splice(i, 1); }
      }
      world.iceCols = ices.flatMap((i) => i.cols);
      let blowing = null;
      for (let i = gusts.length - 1; i >= 0; i--) {
        const g = gusts[i];
        g.t += dt; g.x += g.dx * g.speed * dt; g.z += g.dz * g.speed * dt;
        const u = Math.min(1, g.t / g.life), fade = Math.min(1, g.t / 0.12) * (1 - Math.max(0, (u - 0.55) / 0.45) ** 2), y = world.ground(g.x, g.z);
        // lines of moving air, and what it tears loose: blades of grass, petals
        const n = 150 * dt * (0.3 + 0.7 * fade) * (g.wide / 4.5);
        for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) { const s = rnd(g.wide), back = 9 * Math.random(), up = Math.random(); fx.spawn({ kind: 5, x: g.x - g.dz * s - g.dx * back, y: y + 0.25 + 3.2 * up * up, z: g.z + g.dx * s - g.dz * back, vx: g.dx * g.speed * 1.15, vy: rnd(1.2), vz: g.dz * g.speed * 1.15, life: 0.35 + 0.3 * Math.random(), size: [0.03, 0.03], colour: [0.94, 1, 0.97], alpha: 0.5, rot: 55 + 70 * Math.random() }); }
        // (and the dust and pollen it lifts off the meadow)
        const n3 = 34 * dt * fade;
        for (let q = Math.floor(n3) + (Math.random() < n3 % 1 ? 1 : 0); q > 0; q--) { const s = rnd(g.wide); fx.spawn({ kind: 2, x: g.x - g.dz * s, y: y + 0.3 + 0.5 * Math.random(), z: g.z + g.dx * s, vx: g.dx * 11 + rnd(1.5), vy: 0.6 + Math.random(), vz: g.dz * 11 + rnd(1.5), life: 0.9 + 0.7 * Math.random(), size: [0.35, 1.7], colour: [0.97, 0.98, 0.9], alpha: 0.13, drag: 1.4 }); }
        const n2 = 90 * dt * world.grassAt(g.x, g.z);
        for (let q = Math.floor(n2) + (Math.random() < n2 % 1 ? 1 : 0); q > 0; q--) { const s = rnd(g.wide * 0.8), petal = Math.random() < 0.25; fx.spawn({ kind: 4, x: g.x - g.dz * s, y: y + 0.25, z: g.z + g.dx * s, vx: g.dx * (9 + 9 * Math.random()) + rnd(2), vy: 2 + 4 * Math.random(), vz: g.dz * (9 + 9 * Math.random()) + rnd(2), life: 1.2 + Math.random(), size: [petal ? 0.045 : 0.07, petal ? 0.045 : 0.07], colour: petal ? [[0.9, 0.2, 0.12], [0.2, 0.35, 0.9], [1, 0.95, 0.85], [0.95, 0.75, 0.1]][Math.floor(Math.random() * 4)] : [0.3, 0.62, 0.12], grav: -5, drag: 0.9, rot: Math.random() * 6.283, spin: rnd(9) }); }
        // it strips leaves off the trees it passes, and drives fire on ahead of it
        for (let t = 1; t < world.trees.length; t++) {
          const tree = world.trees[t];
          if (g.hit.has(t) || !tree.clumps.length || tree.burnt > 0.6 || Math.hypot(tree.x - g.x, tree.z - g.z) > g.wide + tree.r) continue;
          g.hit.add(t); tree.shake = 1; world.treeChanged(tree); heard?.('treeShake', { x: tree.x, z: tree.z });
          for (let q = 0; q < 130; q++) { const [x, cy, z, r] = tree.clumps[Math.floor(Math.random() * tree.clumps.length)]; fx.spawn({ kind: 4, x: x + rnd(r), y: cy + rnd(r * 0.6), z: z + rnd(r), vx: g.dx * (8 + 10 * Math.random()) + rnd(3), vy: 1 + 3 * Math.random(), vz: g.dz * (8 + 10 * Math.random()) + rnd(3), life: 1.6 + 1.4 * Math.random(), size: [0.13, 0.13], colour: tree.frost > 0.5 ? [0.85, 0.94, 1] : [0.3 + 0.3 * Math.random(), 0.62, 0.12], grav: -3.5, drag: 0.7, rot: Math.random() * 6.283, spin: rnd(9) }); }
        }
        fire.fan(g.x, g.z, g.dx, g.dz, g.wide);
        windMark -= dt;
        if (windMark <= 0) { windMark = 0.26; marks.push(g.pull ? { x: g.x, z: g.z, r: g.wide * 0.55, d: 10, k: 'arcane', pull: 0.7 } : { x: g.x, z: g.z, r: g.wide * 0.5, d: 12, k: 'arcane', kx: g.dx * 1.4, kz: g.dz * 1.4 }); }
        world.blow?.(g.x, g.z, g.dx, g.dz, g.wide, dt);
        ruin?.push(g.x, g.z, g.dx, g.dz, g.wide, 20 * fade, dt);
        ruin?.gust(g.x, g.z, g.dx, g.dz, g.wide, (g.wide - 4.5) / 4.5);
        blowing = { g, fade };
        if (g.t >= g.life) gusts.splice(i, 1);
      }
      if (blowing) { U.uGust.value.set(blowing.g.x, blowing.g.z, blowing.g.wide * 1.4, 1.9 * blowing.fade); U.uGustDir.value.set(blowing.g.dx, blowing.g.dz); U.uGustTail.value = Math.min(blowing.g.t * blowing.g.speed, 16); } else U.uGust.value.w = 0;
      // (a tree a gust has struck goes on shaking for a moment)
      for (let t = 1; t < world.trees.length; t++) { const tree = world.trees[t]; if (tree.shake > 0) { tree.shake = Math.max(0, tree.shake - dt * 0.8); world.treeChanged(tree); } }

      // --- light, the seal, the shock in the grass, and the staff ---
      lit = false;
      flash.power = Math.max(0, flash.power - dt * 2.6); shock.power = Math.max(0, shock.power - dt * 2.2);
      U.uPush.value[1].set(shock.x, shock.z, shock.r * (1.3 - 0.5 * shock.power), 2.2 * shock.power);
      if (carried) lamp(0, carried.p.x, carried.p.y, carried.p.z, 5 + 5 * carried.big, [1.2, 0.5, 0.13], Math.min(1, carried.life * 2.5));
      else if (target && down) lamp(0, target.x, target.y + 1, target.z, 9, spell.key === 'growth' ? [0.8, 1, 0.42] : [col.r, col.g, col.b], spell.key === 'growth' ? 0.6 : spell.pour ? 0.9 : 0.5 * charge);
      else lamp(0, 0, -999, 0, 1, [0, 0, 0], 0);
      blast.update(dt, realDt, camera.position);
      hole.update(dt, realDt, camera.position);
      twister.update(dt, realDt, camera.position);
      if (blast.phase === 'boom' && blast.reach > 0) {
        const visual = blast.reach, damage = fireballRadius(blast.age);
        if (Math.abs(damage - visual) > 1e-3) console.warn('explosion damage radius does not match the visible blast', { damage, visual });
        if (boomPhase !== 'boom') { boomPhase = 'boom'; boomId++; stamp('explosion', blast.centre.x, blast.centre.z); }
        marks.push({ x: blast.centre.x, z: blast.centre.z, r: visual, d: 70, k: 'fire', radial: 5, exact: true, falloff: true, once: boomId });
        world.breakAt?.(blast.centre.x, blast.centre.z, visual, boomId);
      } else boomPhase = '';
      stormMark -= dt;
      if (stormMark <= 0 && (twister.phase === 'live' || twister.phase === 'gather')) {
        stormMark = 0.3;
        const away = Math.random() * 6.283;
        marks.push({ x: twister.base.x, z: twister.base.z, r: 6, d: 16, k: 'arcane', kx: Math.cos(away) * 1.6, kz: Math.sin(away) * 1.6 });
      }
      if ((twister.phase === 'live' || twister.phase === 'gather') && !stormStamp) { stormStamp = true; stamp('tornado', twister.base.x, twister.base.z); }
      if (twister.phase === 'idle') stormStamp = false;
      if (hole.phase === 'open' && !holeStamp) { holeStamp = true; stamp('singularity', hole.ground.x, hole.ground.z); }
      if (hole.phase !== 'open' && hole.phase !== 'shut') holeStamp = false;
      if (spell.key === 'growth' && down && target) { bloomMark -= dt; if (bloomMark <= 0) { bloomMark = 1.3; stamp('growth', target.x, target.z, 0.7); } }
      for (const list of [scorches, blooms]) {
        for (let i = list.length - 1; i >= 0; i--) {
          const s = list[i];
          s.life -= dt;
          if (s.mesh.material) s.mesh.material.opacity = Math.max(0, (s.life / s.max) * 0.85);
          if (s.life <= 0) { s.mesh.parent?.remove(s.mesh); list.splice(i, 1); }
        }
      }
      for (let i = brands.length - 1; i >= 0; i--) {
        const b = brands[i];
        b.life -= dt;
        const fade = Math.max(0, b.life / b.max);
        b.mesh.material.opacity = fade * 0.82;
        if (b.pad) b.pad.material.opacity = fade * 0.94;
        b.embers.forEach((e, n) => { e.material.opacity = fade; e.position.y += dt * 0.12; e.position.x += Math.sin((b.max - b.life) * 3 + n) * dt * 0.04; });
        if (b.life <= 0) {
          const drop = (m) => { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); };
          drop(b.mesh);
          if (b.pad) drop(b.pad);
          b.embers.forEach(drop);
          brands.splice(i, 1);
        }
      }
      if (twister.phase === 'live' || twister.phase === 'gather') {
        world.swirl?.(twister.base.x, twister.base.z, 10, dt);
        world.orbitLift?.(twister.base.x, twister.base.z, 10);
      }
      if (stormMark <= 0 && hole.phase !== 'idle') {
        stormMark = 0.3;
        const hx = hole.ground?.x ?? hole.centre.x, hz = hole.ground?.z ?? hole.centre.z;
        marks.push({ x: hx, z: hz, r: 5, d: 14, k: 'arcane', siphon: 2.4, kx: 0, kz: 0 });
      }
      const hl = hole.light.power >= twister.light.power ? hole.light : twister.light, bl = blast.light.power >= hl.power ? blast.light : hl;
      if (bl.power > flash.power * flash.power) lamp(1, bl.x, bl.y, bl.z, bl.r, bl.c, bl.power); else lamp(1, flash.x, flash.y, flash.z, flash.r, flash.c, flash.power * flash.power);
      const [ground, tree] = fire.lamps();
      lamp(2, ground.x, ground.y, ground.z, 15, [2.2, 0.85, 0.2], ground.power);
      lamp(3, tree.x, tree.y, tree.z, 20, [2.2, 0.85, 0.22], tree.power);
      U.uLampOn.value = lit ? 1 : 0;
      // (a blast leaves its circle branded on the burnt ground for a while)
      let branded = false;
      if (seal <= 0 && blast.brand > 0) { branded = true; target = blast.centre; seal = blast.brand; U.uSeal.value.z = 12; }
      // The wheel is the aim mark while it is up, so the seal on the ground and the staff's circle stay out of the way.
      if (api.hideMark) { seal = 0; circle = 0; branded = false; }
      U.uSealSides.value = branded ? 8 : spell.sides;
      sealPower += ((seal > 0 ? seal : 0) - sealPower) * Math.min(1, dt * (seal > 0 ? 8 : 5));
      if (target) { U.uSeal.value.x = target.x; U.uSeal.value.y = target.z; }
      U.uSeal.value.w = sealPower; if (branded) U.uSealCol.value.set(3.4, 0.75, 0.1); else if (spell.key === 'tornado' && twister.fire > 0.3) U.uSealCol.value.set(5, 1.4, 0.3); else if (spell.key === 'growth') U.uSealCol.value.set(0.85, 1.35, 0.4); else if (spell.key === 'explosion') U.uSealCol.value.set(7, 1.6, 0.3); else U.uSealCol.value.set(col.r * 2.4, col.g * 2.4, col.b * 2.4);
      staff.cast(col, power, circle, kick, dt, spell.sides);
      // the stream from the staff, for a spell that is poured
      // (a whirlwind is on a lead only once it stands: until then nothing goes from the staff, it all happens over there)
      const pouring = (spell.pour && down) || tether || (leash && twister.down);
      beamPower += ((pouring ? 1 : 0) - beamPower) * Math.min(1, dt * (pouring ? 10 : 7));
      if (pouring) { beamKind = spell.key; if (tether) beamTo.copy(hole.centre); else if (leash) beamTo.copy(twister.base).setY(twister.base.y + 5); else if (target) beamTo.copy(target); else beamTo.copy(tip).addScaledVector(dir, Math.min(hit.dist, reach)); }
      const span = tip.distanceTo(beamTo);
      if (beamKind === 'tornado') beam.set(tip, beamTo, 0, 0.012, 0.35, [0.25, 0.7, 0.75], [0.9, 1, 1], beamPower * 0.4);
      else if (beamKind === 'singularity') beam.set(tip, beamTo, 0, 0.012, 0.28, [0.3, 0.12, 1], [1, 0.8, 1], beamPower * 1.1);
      else if (beamKind === 'frost') beam.set(tip, beamTo, 0, 0.02, 0.5, [0.16, 0.5, 1], [0.75, 0.95, 1], beamPower * 1.3);
      else beam.set(tip, beamTo, (7 * (span / 15) ** 2) / 8, 0.02, 0.36, [0.25, 0.85, 0.15], [1, 0.9, 0.4], beamPower * 1.1);
      kick = Math.max(0, kick - dt * 5);
    },
  };
  select(0);
  return api;
}
