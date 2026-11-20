// The ship, the meadow, and Long Lake. All of it is drawn in code. Nothing here is a picture or a recording.
import * as THREE from 'three';
import { createBeasts, PACKS } from './beasts.js';
import { TUNE } from './rider.js';
import { buildVillage } from './cabins.js';

const mat = (color) => new THREE.MeshBasicMaterial({ color });
const box = (w, h, d, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};

function sky(top, horizon) {
  const g = new THREE.SphereGeometry(40, 16, 10);
  const c = new THREE.Color(top), h = new THREE.Color(horizon);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 40 * 0.5 + 0.5, 0, 1);
    const k = c.clone().lerp(h, 1 - t);
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  mesh.frustumCulled = false;
  return mesh;
}

function labelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 36px Georgia';
  g.fillStyle = '#f6ead0';
  g.textAlign = 'center';
  g.fillText(text, 128, 46);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  s.userData.canvas = c;
  return s;
}
function paintLabel(sprite, text) {
  const c = sprite.userData.canvas, g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = 'bold 36px Georgia';
  g.fillStyle = '#f6ead0';
  g.textAlign = 'center';
  g.fillText(text, 128, 46);
  sprite.material.map.needsUpdate = true;
}
function ring(color) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#24180f'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#f1d9a4'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 300);
  g.fillStyle = '#f1d9a4'; g.font = '28px Georgia'; g.fillText('Where to', 58, 58);
  g.font = '24px Georgia'; g.fillText('Meadow', 62, 140); g.fillText('Long Lake', 48, 210);
  const t = new THREE.CanvasTexture(c);
  return t;
}

const PLOT = [-32, -8];
function numeral(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 92px Georgia';
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#1a1008';
  g.strokeText(text, 128, 100);
  g.fillStyle = color;
  g.fillText(text, 128, 100);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.center.set(0.5, 0.2);
  return s;
}
export function createZones({ scene, world, walker, camera, air }) {
  const saved = { home: world.home, edge: world.edge, colliders: world.colliders, walk: world.walk, blockers: world.blockers };
  const meadowRing = ring(0x9ee7ff);
  meadowRing.position.set(PLOT[0], world.ground(PLOT[0], PLOT[1]) + 0.2, PLOT[1] - 2.4);
  const hub = new THREE.Group();
  const village = buildVillage(world.root, world, air);
  world.blow = (x, z, dx, dz, r) => village.blow(x, z, dx, dz, r);
  world.pound = (x, z, r) => village.pound(x, z, r);
  world.addLoose = (mesh, v, life) => village.addLoose(mesh, v, life);
  world.takeLoose = (x, z, r, n) => village.takeLoose(x, z, r, n);
  world.swirl = (x, z, r) => village.swirl(x, z, r);
  world.breakAt = (x, z, r, token) => village.breakAt(x, z, r, token);
  // Hook for a warrior ability that is not in the game yet. Tornado rips a few core tiles only
  // while this returns true. It stays off, so a normal tornado only swirls loose debris.
  world.warriorTornado = () => false;
  const priorBlock = world.blockers;
  const blockFeet = (f) => { priorBlock?.(f); village.block(f); };
  hub.add(sky('#3a2a1c', '#c4a07a'));
  hub.add(box(11, 0.14, 14, '#a67c52', 0, -0.07, 0));
  hub.add(box(11, 2.6, 0.16, '#6b4a32', 0, 1.3, 6.9));
  hub.add(box(0.16, 2.6, 14, '#7a5538', -5.5, 1.3, 0));
  hub.add(box(0.16, 2.6, 14, '#7a5538', 5.5, 1.3, 0));
  hub.add(box(11, 2.6, 0.16, '#5c4030', 0, 1.3, -6.9));
  hub.add(box(11, 0.12, 14, '#4a3428', 0, 2.6, 0));
  hub.add(box(1.6, 0.08, 0.8, '#c4a574', 2.4, 0.74, 1.2));
  hub.add(box(2.4, 2.5, 0.08, '#e7d3a8', 0, 1.35, 6.72));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), new THREE.MeshBasicMaterial({ map: boardTexture() }));
  screen.position.set(0, 1.35, 6.8);
  screen.scale.set(1.2, 1.2, 1);
  screen.name = 'command-board';
  hub.add(screen);
  const hubRing = ring(0xffe08a);
  hubRing.position.set(0, 0.08, -4.4);
  const destTag = labelSprite('Meadow');
  destTag.position.y = 0.7;
  hubRing.add(destTag);
  hub.add(hubRing);
  const lamp = new THREE.PointLight(0xffc56a, 1.4, 8);
  lamp.position.set(0, 2, 0.6);
  hub.add(lamp);

  const target = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 24), new THREE.MeshBasicMaterial({ color: 0xffe7a8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  target.rotation.x = -Math.PI / 2;
  target.visible = false;
  scene.add(target);
  const bobber = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#e23b32'));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat('#f7fbff'));
  cap.scale.y = 0.45; cap.position.y = 0.06;
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  rip.rotation.x = -Math.PI / 2;
  bobber.add(ball, cap, rip);
  bobber.visible = false;
  scene.add(bobber);

  scene.add(meadowRing, hub);
  const beasts = createBeasts(scene, (x, z) => world.ground(x, z), world);
  hub.visible = meadowRing.visible = false;

  const hold = new THREE.Group();
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 8), mat('#6a3a22'));
  const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.016, 0.7, 8), mat('#e2c48a'));
  blank.position.y = 0.4;
  const tipM = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.006, 0.26, 6), mat('#f2e2b8'));
  tipM.position.y = 0.86;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), mat('#e7c48a'));
  reel.rotation.x = Math.PI / 2;
  reel.position.set(0, 0.12, 0.03);
  rod.add(grip, blank, tipM, reel);
  rod.position.set(0, -0.22, -0.72);
  rod.rotation.set(0.5, 0.12, -0.18);
  hold.add(rod);
  scene.add(hold);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xd8fbff }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  const splash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mat('#e7f6ff'));
  splash.visible = false;
  scene.add(splash);

  const panel = document.getElementById('board');
  const menu = document.getElementById('menu');
  const back = document.getElementById('back');
  const reelBtn = document.getElementById('reel');
  const fishBtn = document.getElementById('fish');
  const duskBtn = document.getElementById('dusk');
  const catchEl = document.getElementById('catch');
  const FISH = ['Bluegill', 'Sunperch', 'Reed carp', 'Golden shiner', 'Creek trout'];
  let name = 'hub';
  let dest = 'meadow';
  let armUntil = 0;
  let leftRing = false;
  let boardHeld = false;
  let phase = 'idle';
  let biteAt = 0;
  let biteUntil = 0;
  let reelT = 0;
  let power = 0.35;
  let cock = 0;
  let flicking = 0;
  const aimDir = new THREE.Vector3();
  const tipW = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const place = (x, z, yaw) => {
    walker.place(x, z, yaw);
    walker.feet.y = world.walk(x, z);
    walker.vel.set(0, 0, 0);
    armUntil = performance.now() + 2000;
    leftRing = false;
  };
  function markDest() {
    const lakeGo = dest === 'lake';
    hubRing.material.color.set(lakeGo ? 0x7ec8ff : 0xffe08a);
    paintLabel(destTag, lakeGo ? 'Long Lake' : 'Meadow');
  }
  function showBoard() { if (panel) panel.hidden = false; }
  function hideBoard() { if (panel) panel.hidden = true; }
  function resetFish() {
    phase = 'idle';
    reelProg = 0;
    bobber.visible = false;
    line.visible = false;
    target.visible = false;
    splash.visible = false;
    if (reelBtn) reelBtn.hidden = true;
  }
  function outdoors() {
    world.home = saved.home; world.edge = saved.edge; world.colliders = saved.colliders; world.walk = saved.walk;
    world.blockers = blockFeet;
    world.wade = null;
  }
  function enter(next) {
    if (next === 'lake') next = 'plot';
    const outside = next === 'meadow' || next === 'plot';
    name = outside ? 'meadow' : 'hub';
    world.root.visible = outside;
    hub.visible = !outside;
    meadowRing.visible = outside;
    hold.visible = false;
    if (back) back.hidden = outside;
    if (outside) hideBoard();
    if (menu) menu.hidden = true;
    resetFish();
    if (next === 'plot') {
      outdoors();
      const yaw = Math.atan2(-54 - PLOT[0], -18 - PLOT[1]);
      meadowRing.position.set(PLOT[0] - Math.sin(yaw) * 2.4, world.ground(PLOT[0], PLOT[1]) + 0.2, PLOT[1] - Math.cos(yaw) * 2.4);
      place(PLOT[0], PLOT[1], yaw);
    } else if (next === 'meadow') {
      outdoors();
      const yaw = world.start.yaw + Math.PI;
      meadowRing.position.set(world.start.x, world.ground(world.start.x, world.start.z) + 0.2, world.start.z - 1.6);
      place(meadowRing.position.x + Math.sin(yaw) * 3.4, meadowRing.position.z + Math.cos(yaw) * 3.4, yaw);
    } else {
      world.home = [0, 0]; world.edge = 5.1; world.colliders = [];
      world.blockers = null;
      world.walk = () => 0;
      place(0, -2.2, 0);
      walker.pitch = 0.42;
      boardHeld = false;
      showBoard();
    }
  }
  panel?.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('pointerup', (e) => {
    dest = b.getAttribute('data-go');
    markDest();
    boardHeld = true;
    hideBoard();
    e.preventDefault();
    e.stopPropagation();
  }));
  document.getElementById('boardX')?.addEventListener('pointerup', (e) => { hideBoard(); boardHeld = true; e.preventDefault(); e.stopPropagation(); });
  menu?.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('pointerup', (e) => {
    enter(b.getAttribute('data-trip'));
    e.preventDefault();
    e.stopPropagation();
  }));
  document.getElementById('menuX')?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = true; e.preventDefault(); e.stopPropagation(); });
  document.getElementById('menubtn')?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = false; e.preventDefault(); e.stopPropagation(); });
  const atlas = document.getElementById('atlas');
  const mapCanvas = document.getElementById('lakemap');
  const mapCtx = mapCanvas?.getContext('2d');
  const MAP = { x0: -78, x1: -16, z0: -64, z1: 4 };
  const spots = [
    { name: 'Landing', x: -32, z: -8, tx: 12, ty: -28 },
    { name: 'Village', x: -54, z: -18, tx: 12, ty: -40 },
    { name: 'Logging camp', x: -66, z: -20, tx: 12, ty: 16 },
    { name: 'Campfire', x: -64.4, z: -19.7, tx: 12, ty: 40 },
    { name: PACKS[0].name, x: PACKS[0].x, z: PACKS[0].z, tx: -230, ty: 22 },
    { name: PACKS[1].name, x: PACKS[1].x, z: PACKS[1].z, tx: 12, ty: -18 },
    { name: PACKS[2].name, x: PACKS[2].x, z: PACKS[2].z, tx: 12, ty: -18 },
  ];
  let pin = null;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.4, 70, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }));
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  beam.add(beamCore);
  beam.visible = false;
  world.root.add(beam);
  const toMap = (x, z) => ({
    sx: ((x - MAP.x0) / (MAP.x1 - MAP.x0)) * mapCanvas.width,
    sy: (1 - (z - MAP.z0) / (MAP.z1 - MAP.z0)) * mapCanvas.height,
  });
  const fromMap = (sx, sy) => ({
    x: MAP.x0 + (sx / mapCanvas.width) * (MAP.x1 - MAP.x0),
    z: MAP.z0 + (1 - sy / mapCanvas.height) * (MAP.z1 - MAP.z0),
  });
  function drawMap() {
    if (!mapCtx) return;
    const g = mapCtx, W = mapCanvas.width, H = mapCanvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#245234'; g.fillRect(0, 0, W, H);
    const lake = toMap(-50, -46);
    g.fillStyle = '#2f7ea8';
    g.beginPath(); g.ellipse(lake.sx, lake.sy, (14 / (MAP.x1 - MAP.x0)) * W, (9 / (MAP.z1 - MAP.z0)) * H, 0, 0, Math.PI * 2); g.fill();
    for (const [px, pz, r] of [[-30, -56, 4.2], [-68, -42, 3.5]]) {
      const p = toMap(px, pz);
      g.beginPath(); g.arc(p.sx, p.sy, (r / (MAP.x1 - MAP.x0)) * W, 0, Math.PI * 2); g.fill();
    }
    for (const s of spots) {
      const p = toMap(s.x, s.z);
      g.fillStyle = s.name.startsWith('Beasts') ? '#e23b32' : '#c4a574';
      g.beginPath(); g.arc(p.sx, p.sy, s.name.startsWith('Beasts') ? 10 : 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f6ead0';
      g.font = '18px Georgia';
      g.textAlign = 'left';
      g.fillText(s.name, p.sx + (s.tx ?? 14), p.sy + (s.ty ?? 6));
    }
    const you = toMap(walker.feet.x, walker.feet.z);
    g.fillStyle = '#fff6dc';
    g.beginPath(); g.arc(you.sx, you.sy, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff6dc'; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(you.sx, you.sy);
    g.lineTo(you.sx + Math.sin(walker.yaw) * 28, you.sy - Math.cos(walker.yaw) * 28);
    g.stroke();
    if (pin) {
      const q = toMap(pin.x, pin.z);
      g.strokeStyle = '#ffe7a8'; g.lineWidth = 3;
      g.beginPath(); g.arc(q.sx, q.sy, 14, 0, Math.PI * 2); g.stroke();
    }
  }
  function setPin(x, z) {
    if (pin && Math.hypot(pin.x - x, pin.z - z) < 3.5) pin = null;
    else pin = { x, z };
    beam.visible = !!pin;
    if (pin) beam.position.set(pin.x, world.ground(pin.x, pin.z) + 35, pin.z);
    drawMap();
  }
  document.getElementById('openMap')?.addEventListener('pointerup', (e) => {
    if (menu) menu.hidden = true;
    if (atlas) atlas.hidden = false;
    drawMap();
    e.preventDefault(); e.stopPropagation();
  });
  document.getElementById('mapX')?.addEventListener('pointerup', (e) => { if (atlas) atlas.hidden = true; e.preventDefault(); e.stopPropagation(); });
  mapCanvas?.addEventListener('pointerdown', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (mapCanvas.width / r.width);
    const sy = (e.clientY - r.top) * (mapCanvas.height / r.height);
    let hit = null;
    for (const s of spots) {
      const p = toMap(s.x, s.z);
      if (Math.hypot(p.sx - sx, p.sy - sy) < 36) hit = s;
    }
    const at = hit || fromMap(sx, sy);
    setPin(at.x, at.z);
    e.preventDefault(); e.stopPropagation();
  });
  back?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = false; e.preventDefault(); e.stopPropagation(); });
  document.getElementById('catchOk')?.addEventListener('pointerup', (e) => { if (catchEl) catchEl.hidden = true; resetFish(); e.preventDefault(); e.stopPropagation(); });
  document.querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  addEventListener('pointerup', (e) => {
    if (name !== 'hub' || (e.target.closest && e.target.closest('#cast, #spell, #stick, #board, #menu, #back, #menubtn, #reel, #catch, #fish, #dusk, #gear, #settings, #atlas'))) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(screen, false).length) showBoard();
  });

  function onWater(x, z) { return world.fishHere(x, z); }
  function byWater() {
    const x = walker.feet.x, z = walker.feet.z;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (onWater(x + Math.cos(a) * 4.2, z + Math.sin(a) * 4.2)) return true;
    }
    return false;
  }
  function waterSpot() {
    camera.getWorldDirection(aimDir);
    aimDir.y = 0;
    if (aimDir.lengthSq() < 1e-6) aimDir.set(0, 0, 1);
    aimDir.normalize();
    const dist = 4 + power * 11;
    let x = camera.position.x + aimDir.x * dist;
    let z = camera.position.z + aimDir.z * dist;
    if (!onWater(x, z)) {
      for (let t = 2.5; t < 22; t += 0.35) {
        const px = camera.position.x + aimDir.x * t;
        const pz = camera.position.z + aimDir.z * t;
        if (onWater(px, pz)) { x = px; z = pz; break; }
      }
    }
    return { x, z };
  }
  function looseLine() {
    const spot = waterSpot();
    phase = 'wait';
    target.visible = false;
    bobber.visible = true;
    bobber.position.set(spot.x, world.water + 0.16, spot.z);
    line.visible = true;
    flicking = 1;
    biteAt = performance.now() + 2200 + Math.random() * 2500;
  }
  let fishDown = false;
  let reelHold = 0;
  let reelProg = 0;
  reelBtn?.addEventListener('pointerdown', (e) => {
    if (phase === 'bite') reelHold = 0.001;
    e.preventDefault();
    e.stopPropagation();
  });
  const endReel = (e) => {
    if (phase === 'bite' && reelHold > 0 && reelHold < 0.45) {
      reelProg += 0.34;
      reel.rotation.x += 1.5;
      if (reelProg >= 1) { phase = 'reel'; reelT = 0; reelProg = 0; if (reelBtn) reelBtn.hidden = true; }
    }
    reelHold = 0;
    e.preventDefault();
  };
  reelBtn?.addEventListener('pointerup', (e) => { endReel(e); e.stopPropagation(); });
  reelBtn?.addEventListener('pointercancel', endReel);
  fishBtn?.addEventListener('pointerdown', (e) => {
    fishDown = true;
    if (name === 'meadow' && (phase === 'idle' || phase === 'caught')) { phase = 'aim'; power = 0.25; target.visible = true; }
    e.preventDefault();
    e.stopPropagation();
  });
  const endFish = (e) => {
    if (fishDown && phase === 'aim') looseLine();
    fishDown = false;
    e.preventDefault();
    e.stopPropagation();
  };
  fishBtn?.addEventListener('pointerup', endFish);
  fishBtn?.addEventListener('pointercancel', endFish);
  let skyMesh = null;
  world.root.traverse((o) => { if (!skyMesh && o.material?.uniforms?.uZenith) skyMesh = o; });
  const dayZenith = skyMesh?.material.uniforms.uZenith.value.clone();
  const dayHorizon = skyMesh?.material.uniforms.uHorizon.value.clone();
  let dusk = false;
  function setDusk(on) {
    dusk = on;
    if (duskBtn) duskBtn.textContent = on ? 'Day' : 'Dusk';
    if (!skyMesh) return;
    skyMesh.material.uniforms.uZenith.value.set(on ? '#24315f' : dayZenith);
    skyMesh.material.uniforms.uHorizon.value.set(on ? '#e7a06a' : dayHorizon);
  }
  duskBtn?.addEventListener('pointerup', (e) => { setDusk(!dusk); e.preventDefault(); e.stopPropagation(); });
  addEventListener('keydown', (e) => { if (e.code === 'KeyK' && name === 'meadow') setDusk(!dusk); });
  const life = new THREE.Group();
  const motes = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff6df' : '#f2d56a' }));
    life.add(s);
    motes.push(s);
  }
  const wings = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshBasicMaterial({ color: '#f7fbff', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    g.add(w);
    g.userData.home = new THREE.Vector3(-56 + i * 5, 0, -16);
    life.add(g);
    wings.push(g);
  }
  const birds = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.07), mat('#2a2622'));
    a.rotation.z = 0.45; a.position.x = 0.12;
    const b = a.clone(); b.rotation.z = -0.45; b.position.x = -0.12;
    g.add(a, b);
    life.add(g);
    birds.push(g);
  }
  world.root.add(life);
  const pool = [];
  const blasts = [];
  const blastGeo = new THREE.SphereGeometry(0.4, 10, 8);
  enter('hub');
  markDest();
  let hearts = 100;
  return {
    get name() { return name; },
    get hearts() { return hearts; },
    nick(n) { hearts = Math.max(0, hearts - n); },
    heal(n) { hearts = n ? Math.min(100, hearts + n) : 100; },
    promote() { return beasts.promote(); },
    collect(x, z) { return beasts.collect(x, z); },
    get ring() { return meadowRing.position; },
    get rodOut() { return hold.visible; },
    get nearBeast() { return beasts.near(walker.feet.x, walker.feet.z); },
    beasts() { return beasts.probe(); },
    live() { return beasts.live(); },
    anchor(n, x, y, z, face) { beasts.anchor(n, x, y, z, face); },
    releaseAnchor(n) { beasts.releaseAnchor(n); },
    get mobsReady() { return beasts.mobsReady; },
    get dusk() { return dusk; },
    cueBeast(x, z, name) { beasts.act(x, z, name); },
    face(kind) { return beasts.face(kind); },
    clip(kind) { return beasts.clip(kind); },
    holdBeasts(px, pz, min, max, dt) { beasts.hold(px, pz, min, max, dt); },
    grabBeast(x, z) { return beasts.grab(x, z); },
    shoveBeast(x, z, dx, dz, dist) { return beasts.shove(x, z, dx, dz, dist); },
    get blocksMagic() { return name !== 'meadow'; },
    showBoard, enter,
    hurt(marks) {
      beasts.hurt(marks, name, (hit) => {
        const boom = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: hit.through ? 0xfff6dc : (hit.k === 'arcane' ? 0xd7a6ff : 0xff7a1c), transparent: true, opacity: 0.85, depthWrite: false }));
        boom.position.set(hit.x, hit.y, hit.z);
        boom.userData.life = hit.through ? 0.22 : 0.42;
        boom.userData.max = boom.userData.life;
        boom.userData.big = hit.through ? 0.9 : 2.4;
        scene.add(boom);
        blasts.push(boom);
        const color = hit.k === 'arcane' ? '#d7a6ff' : '#ffb043';
        const key = `${hit.n}-${hit.k}`;
        let sprite = pool.find((s) => s.userData.life <= 0);
        if (!sprite) {
          if (pool.length > 16) return;
          sprite = numeral(String(hit.n), color);
          sprite.userData.key = key;
          scene.add(sprite);
          pool.push(sprite);
        } else if (sprite.userData.key !== key) {
          sprite.material.map.dispose();
          sprite.material.map = numeral(String(hit.n), color).material.map;
          sprite.userData.key = key;
        }
        sprite.userData.life = 0.9;
        sprite.position.set(hit.x, hit.y, hit.z);
        sprite.visible = true;
        sprite.material.opacity = 1;
        const mark = document.getElementById('xmark');
        if (mark) { mark.classList.add('on'); clearTimeout(mark._t); mark._t = setTimeout(() => mark.classList.remove('on'), 400); }
      });
    },
    launchNearest(damage = 12, lockN = null) {
      const here = walker.feet;
      const list = beasts.probe().filter((b) => !b.dead);
      let best = lockN != null ? list.find((b) => b.n === lockN) : null;
      if (!best) {
        const fx = Math.sin(walker.yaw), fz = Math.cos(walker.yaw);
        let bestD = 1e9;
        for (const b of list) {
          const dx = b.x - here.x, dz = b.z - here.z;
          const d = Math.hypot(dx, dz);
          const ahead = d > 0.2 && (dx / d) * fx + (dz / d) * fz > 0.25;
          const score = ahead ? d : d + 30;
          if (score < bestD) { best = b; bestD = score; }
        }
      }
      if (!best) return false;
      const dx = best.x - here.x, dz = best.z - here.z, len = Math.hypot(dx, dz) || 1;
      this.hurt([{ x: best.x, z: best.z, r: 1.6, d: damage, k: 'arcane', kx: (dx / len) * 2.6, kz: (dz / len) * 2.6 }]);
      return true;
    },
    castHeld() {},
    update(dt) {
      for (const s of beasts.slams()) {
        if (Math.hypot(walker.feet.x - s.x, walker.feet.z - s.z) < s.r) this.nick(24);
      }
      for (const s of pool) {
        if (s.userData.life <= 0) continue;
        s.userData.life -= dt;
        const u = 1 - s.userData.life / 0.9;
        const pop = u < 0.16 ? 0.45 + (u / 0.16) * 0.95 : 1.4 - (u - 0.16) * 0.28;
        s.scale.set(1.8 * pop, 0.9 * pop, 1);
        s.position.y += dt * 1.4;
        s.material.opacity = s.userData.life > 0.28 ? 1 : Math.max(0, s.userData.life / 0.28);
        if (s.userData.life <= 0) s.visible = false;
      }
      for (let i = blasts.length - 1; i >= 0; i--) {
        const m = blasts[i];
        m.userData.life -= dt;
        const u = 1 - m.userData.life / m.userData.max;
        m.scale.setScalar(0.15 + u * m.userData.big);
        m.material.opacity = Math.max(0, m.userData.life / m.userData.max);
        if (m.userData.life <= 0) { scene.remove(m); blasts.splice(i, 1); }
      }
      village.tick?.(dt);
      const fell = world.stepFells?.(dt) || [];
      const bumps = village.takeBumps?.() || [];
      if (fell.length || bumps.length) {
        const marks = [];
        for (const h of fell) marks.push({ x: h.x, z: h.z, r: h.r, d: TUNE.debrisHit, k: 'arcane', exact: true });
        for (const h of bumps) {
          marks.push({ x: h.x, z: h.z, r: 1.2, d: TUNE.debrisHit, k: 'arcane', exact: true });
          if (h.dx || h.dz) beasts.shove(h.x, h.z, h.dx, h.dz, TUNE.rockFling);
        }
        this.hurt(marks);
      }
      beasts.update(dt, name);
      if (pin) {
        beam.visible = name === 'meadow';
        beam.position.y = world.ground(pin.x, pin.z) + 35 + Math.sin(performance.now() * 0.004) * 0.4;
        beam.material.opacity = 0.4 + Math.sin(performance.now() * 0.006) * 0.12;
      }
      if (atlas && !atlas.hidden) drawMap();
      const gate = name === 'hub' ? hubRing.position : meadowRing.position;
      const d = Math.hypot(walker.feet.x - gate.x, walker.feet.z - gate.z);
      if (d > 2.15) leftRing = true;
      if (leftRing && performance.now() >= armUntil && d < 0.95) enter(name === 'hub' ? dest : 'hub');
      if (name === 'hub') {
        const bd = Math.hypot(walker.feet.x - screen.position.x, walker.feet.z - screen.position.z);
        if (bd > 2.1) boardHeld = false;
        if (!boardHeld && bd < 1.7 && panel?.hidden) showBoard();
      }
      const fishing = name === 'meadow' && (byWater() || phase !== 'idle');
      const showFish = name === 'meadow' && (byWater() || phase === 'aim') && phase !== 'bite' && phase !== 'reel';
      if (fishBtn) fishBtn.hidden = !showFish;
      const cue = document.getElementById('fishcue');
      if (cue) cue.hidden = !showFish;
      if (name === 'meadow' && fishing) {
        if (fishDown && phase === 'aim') power = Math.min(1, power + 0.012);
        if (phase === 'aim') { const spot = waterSpot(); target.position.set(spot.x, world.water + 0.05, spot.z); }
        if (phase === 'wait' && performance.now() >= biteAt) {
          phase = 'bite';
          biteUntil = performance.now() + 1700;
          if (reelBtn) reelBtn.hidden = false;
        }
        if (phase === 'bite') {
          if (reelHold > 0) {
            reelHold += dt;
            reelProg += dt * 1.15;
            reel.rotation.x += dt * (8 + reelHold * 10);
            if (reelProg >= 1) { phase = 'reel'; reelT = 0; reelHold = 0; reelProg = 0; if (reelBtn) reelBtn.hidden = true; }
          }
          bobber.position.y = world.water + Math.sin(performance.now() * 0.02) * 0.08;
          splash.visible = true;
          splash.position.copy(bobber.position);
          splash.scale.setScalar(1 + Math.sin(performance.now() * 0.03));
          if (performance.now() > biteUntil) resetFish();
        }
        if (phase === 'reel') {
          reelT += dt;
          bobber.position.lerp(walker.feet, Math.min(1, dt * 3));
          bobber.position.y = walker.feet.y + 1.1;
          if (reelT > 0.7) {
            const title = document.getElementById('catchName');
            if (title) title.textContent = FISH[Math.floor(Math.random() * FISH.length)];
            if (catchEl) catchEl.hidden = false;
            phase = 'caught';
            line.visible = false;
            bobber.visible = false;
            splash.visible = false;
          }
        }
        hold.visible = true;
        hold.position.copy(camera.position);
        hold.quaternion.copy(camera.quaternion);
        if (phase === 'aim') cock = Math.min(1, cock + dt * 2.6);
        else if (flicking <= 0) cock = Math.max(0, cock - dt * 3);
        let pose = cock;
        if (flicking > 0) {
          flicking -= dt * 3.2;
          pose = flicking > 0.5 ? (flicking - 0.5) / 0.5 : (flicking / 0.5) * -0.45;
          if (flicking <= 0) { flicking = 0; cock = 0; }
        }
        rod.rotation.x = 0.4 + pose * 0.95;
        rod.rotation.z = -0.1 - Math.max(0, pose) * 0.3;
        if (line.visible) {
          tipM.getWorldPosition(tipW);
          const pos = lineGeo.attributes.position;
          const end = bobber.position;
          for (let i = 0; i < 8; i++) {
            const t = i / 7;
            const sag = Math.sin(t * Math.PI) * 0.22;
            pos.setXYZ(i, tipW.x + (end.x - tipW.x) * t, tipW.y + (end.y - tipW.y) * t - sag, tipW.z + (end.z - tipW.z) * t);
          }
          pos.needsUpdate = true;
        }
        if (bobber.visible && phase !== 'bite') {
          const u = (performance.now() * 0.0007) % 1;
          rip.scale.setScalar(0.8 + u * 1.3);
          rip.material.opacity = (1 - u) * 0.7;
        }
        const t = performance.now() * 0.001;
        motes.forEach((s, i) => s.position.set(-46 + Math.sin(t * 0.25 + i) * 16, 2 + (i % 4) * 0.45, -22 + Math.cos(t * 0.18 + i * 0.7) * 10));
        wings.forEach((g, i) => {
          const hx = g.userData.home.x, hz = g.userData.home.z;
          g.position.set(hx + Math.sin(t * 0.8 + i) * 1.5, world.ground(hx, hz) + 1.2 + Math.sin(t * 2 + i) * 0.3, hz + Math.cos(t * 0.7 + i) * 1.2);
          g.children[0].rotation.y = Math.sin(t * 14 + i) * 0.9;
        });
        birds.forEach((g, i) => {
          const a = t * 0.22 + i * 2.1;
          g.position.set(-50 + Math.cos(a) * 18, 12 + i * 1.4, -24 + Math.sin(a) * 12);
          g.rotation.y = -a;
        });
      } else hold.visible = false;
      if (name === 'meadow' && !fishing) {
        const t = performance.now() * 0.001;
        motes.forEach((s, i) => s.position.set(walker.feet.x + Math.sin(t * 0.3 + i) * 8, walker.feet.y + 1.5 + (i % 3) * 0.4, walker.feet.z + Math.cos(t * 0.2 + i) * 8));
      }
      hub.children[0].position.copy(camera.position);
    },
  };
}
