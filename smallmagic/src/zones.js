// The ship, the meadow, and Long Lake. All of it is drawn in code. Nothing here is a picture or a recording.
import * as THREE from 'three';
import { createBeasts } from './beasts.js';

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

function buildCamp(lake) {
  const lodge = new THREE.Group();
  lodge.position.set(-8, 0, -3.4);
  const wall = (w, h, d, x, y, z) => lodge.add(box(w, h, d, '#8d6844', x, y, z));
  wall(7.2, 2.8, 0.18, 0, 1.4, -2.4);
  wall(0.18, 2.8, 2.2, -3.5, 1.4, -1.2);
  wall(0.18, 2.8, 2.2, 3.5, 1.4, -1.2);
  wall(2.4, 2.8, 0.18, -2.2, 1.4, 2.3);
  wall(2.4, 2.8, 0.18, 2.2, 1.4, 2.3);
  lodge.add(box(7.6, 0.16, 5.2, '#6b4428', 0, 2.9, 0));
  lodge.add(box(7.2, 0.08, 5, '#c4a574', 0, 0.06, 0));
  lodge.add(box(3.2, 0.9, 0.5, '#6b4428', -1.2, 0.7, -1.2));
  lodge.add(box(0.7, 0.7, 0.7, '#3e3832', 2.4, 0.5, -1.6));
  lodge.add(box(0.4, 0.25, 0.4, '#c4554a', 2.4, 0.95, -1.6));
  lake.add(lodge);
  const loft = new THREE.Group();
  loft.position.set(-1.2, 0, -4.6);
  loft.add(box(4.2, 2.6, 0.14, '#a67c52', 0, 1.3, -1.8));
  loft.add(box(0.14, 2.6, 3.6, '#a67c52', -2, 1.3, 0));
  loft.add(box(0.14, 2.6, 3.6, '#a67c52', 2, 1.3, 0));
  loft.add(box(1.4, 2.6, 0.14, '#a67c52', -1.2, 1.3, 1.7));
  loft.add(box(1.4, 2.6, 0.14, '#a67c52', 1.2, 1.3, 1.7));
  loft.add(box(4.4, 0.12, 3.8, '#6b4428', 0, 2.7, 0));
  loft.add(box(4, 0.1, 1.6, '#e7d3a8', 0, 1.55, -0.7));
  loft.add(box(0.08, 1.5, 0.35, '#c4a574', -1.5, 0.75, 0.6));
  lake.add(loft);
  const cabin = new THREE.Group();
  cabin.position.set(3.6, 0, -4.4);
  cabin.add(box(3.2, 2.1, 2.6, '#8d6844', 0, 1.05, 0));
  cabin.add(box(3.5, 0.12, 3, '#6b4428', 0, 2.2, 0));
  lake.add(cabin);
  const bath = new THREE.Group();
  bath.position.set(-13.5, 0, -1.6);
  bath.add(box(2.2, 3.4, 2.2, '#7a8a96', 0, 1.7, 0));
  bath.add(box(2.5, 0.2, 2.5, '#5c6a74', 0, 3.5, 0));
  lake.add(bath);
  const boat = new THREE.Group();
  boat.position.set(-3.2, 0, 0.6);
  boat.add(box(3.4, 0.12, 2.6, '#6b4428', 0, 2.1, 0));
  boat.add(box(0.12, 2.1, 0.12, '#8d6844', -1.5, 1.05, -1.1));
  boat.add(box(0.12, 2.1, 0.12, '#8d6844', 1.5, 1.05, -1.1));
  boat.add(box(0.12, 2.1, 0.12, '#8d6844', -1.5, 1.05, 1.1));
  boat.add(box(0.12, 2.1, 0.12, '#8d6844', 1.5, 1.05, 1.1));
  lake.add(boat);
}
export function createZones({ scene, world, walker, camera }) {
  const saved = { home: world.home, edge: world.edge, colliders: world.colliders, walk: world.walk, blockers: world.blockers };
  const meadowRing = ring(0x9ee7ff);
  meadowRing.position.set(world.start.x, 0.15, world.start.z - 1.6);
  const hub = new THREE.Group();
  const lake = new THREE.Group();
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

  lake.add(sky('#f0a06a', '#f6d7b0'));
  lake.add(box(42, 0.2, 18, '#6f9a45', 0, -0.1, -6));
  const waterGeo = new THREE.PlaneGeometry(36, 28, 10, 8);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      precision mediump float;
      uniform float uTime; varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.55 + uTime * 1.1) * sin(p.y * 0.42 - uTime * 0.8) * 0.07;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      precision mediump float; varying vec2 vUv; uniform float uTime;
      void main(){
        float r = sin(vUv.x * 22.0 + uTime * 1.4) * sin(vUv.y * 16.0 - uTime * 0.9);
        vec3 deep = vec3(0.04, 0.2, 0.32); vec3 mid = vec3(0.15, 0.42, 0.52);
        vec3 c = mix(deep, mid, 0.5 + 0.5 * r);
        gl_FragColor = vec4(c, 0.94);
      }`,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.04, 16);
  lake.add(water);
  for (let i = 0; i < 8; i++) lake.add(box(1.35, 0.08, 0.4, i % 2 ? '#c4a574' : '#8d6240', 0, 0.18, 1.4 + i * 0.7));
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? -1 : 1;
    lake.add(box(0.045, 0.85, 0.045, '#5f8a42', side * (1.4 + (i % 5) * 0.55), 0.4, 2.2 + (i % 3) * 0.25));
  }
  for (let i = 0; i < 6; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.38, 8), mat(i % 2 ? '#3d8a44' : '#2f6e38'));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((i - 2.5) * 1.6, 0.02, 9 + (i % 2) * 1.2);
    lake.add(pad);
  }
  for (let i = 0; i < 14; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 5), mat(i % 2 ? '#b6d96a' : '#7dae46'));
    tuft.position.set(-8 + (i % 7) * 2.6, 0.12, -2.2 - (i % 3) * 0.7);
    lake.add(tuft);
  }
  for (let i = 0; i < 8; i++) {
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(['#f2d56a', '#f0a0b8', '#fff6df'][i % 3]));
    bloom.position.set(-6 + i * 1.7, 0.16, -1.2);
    lake.add(bloom);
  }
  const raft = new THREE.Group();
  raft.add(box(1.6, 0.1, 1.6, '#c4a574', 0, 0.08, 0));
  raft.add(box(0.08, 0.7, 0.08, '#6b4a32', -0.7, 0.4, -0.7));
  raft.position.set(5.5, 0, 11);
  lake.add(raft);
  for (let i = 0; i < 9; i++) {
    const fir = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 6), mat('#4a3428'));
    trunk.position.y = 1.1;
    const h = 4.2 + (i % 3) * 0.8;
    for (let t = 0; t < 3; t++) {
      const bough = new THREE.Mesh(new THREE.ConeGeometry(1.15 - t * 0.28, h * 0.42, 7), mat(t === 2 ? '#3d9a48' : '#1e6a32'));
      bough.position.y = 1.6 + t * h * 0.28;
      fir.add(bough);
    }
    fir.add(trunk);
    fir.position.set(-15 + i * 3.6, 0, 22 + (i % 2) * 1.6);
    lake.add(fir);
  }
  buildCamp(lake);
  const lakeRing = ring(0x9ee7ff);
  lakeRing.position.set(0, 0.2, -5.2);
  lake.add(lakeRing);
  const target = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 24), new THREE.MeshBasicMaterial({ color: 0xffe7a8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  target.rotation.x = -Math.PI / 2;
  target.visible = false;
  lake.add(target);
  const bobber = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#e23b32'));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat('#f7fbff'));
  cap.scale.y = 0.45; cap.position.y = 0.06;
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  rip.rotation.x = -Math.PI / 2;
  bobber.add(ball, cap, rip);
  bobber.visible = false;
  lake.add(bobber);

  scene.add(meadowRing, hub, lake);
  const beasts = createBeasts(scene);
  hub.visible = lake.visible = meadowRing.visible = false;

  const hold = new THREE.Group();
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 8), mat('#6a3a22'));
  const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.016, 0.7, 8), mat('#e2c48a'));
  blank.position.y = 0.4;
  const tipM = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.006, 0.26, 6), mat('#f2e2b8'));
  tipM.position.y = 0.86;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), mat('#c4a06a'));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.045, 0.1, 0);
  rod.add(grip, blank, tipM, reel);
  rod.position.set(0.05, -0.28, -0.82);
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
  lake.add(splash);

  const panel = document.getElementById('board');
  const menu = document.getElementById('menu');
  const back = document.getElementById('back');
  const reelBtn = document.getElementById('reel');
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
    bobber.visible = false;
    line.visible = false;
    target.visible = false;
    splash.visible = false;
    if (reelBtn) reelBtn.hidden = true;
  }
  function enter(next) {
    name = next;
    world.root.visible = next === 'meadow';
    hub.visible = next === 'hub';
    lake.visible = next === 'lake';
    meadowRing.visible = next === 'meadow';
    hold.visible = next === 'lake';
    if (back) back.hidden = next === 'hub';
    if (next !== 'hub') hideBoard();
    if (menu) menu.hidden = true;
    world.blockers = next === 'meadow' ? saved.blockers : null;
    world.wade = null;
    resetFish();
    if (next === 'meadow') {
      world.home = saved.home; world.edge = saved.edge; world.colliders = saved.colliders; world.walk = saved.walk;
      const yaw = world.start.yaw + Math.PI;
      place(meadowRing.position.x + Math.sin(yaw) * 3.4, meadowRing.position.z + Math.cos(yaw) * 3.4, yaw);
    } else if (next === 'hub') {
      world.home = [0, 0]; world.edge = 5.1; world.colliders = [];
      world.walk = () => 0;
      place(0, -2.2, 0);
      walker.pitch = 0.42;
      boardHeld = false;
      showBoard();
    } else {
      world.home = [0, -2]; world.edge = 12; world.colliders = [];
      world.walk = (x, z) => (Math.abs(x) < 0.7 && z > 1.2 && z < 8.2 ? 0.22 : 0);
      world.wade = (x, z) => z > 2.4 || (Math.abs(x) < 0.7 && z > 2);
      place(0, -1.4, 0);
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
  back?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = false; e.preventDefault(); e.stopPropagation(); });
  reelBtn?.addEventListener('pointerup', (e) => {
    if (phase === 'bite') { phase = 'reel'; reelT = 0; reelBtn.hidden = true; }
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('catchOk')?.addEventListener('pointerup', (e) => { if (catchEl) catchEl.hidden = true; resetFish(); e.preventDefault(); e.stopPropagation(); });
  document.querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  addEventListener('pointerup', (e) => {
    if (name !== 'hub' || (e.target.closest && e.target.closest('#cast, #spell, #stick, #board, #menu, #back, #menubtn, #reel, #catch'))) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(screen, false).length) showBoard();
  });

  function onWater(x, z) {
    return Math.abs(x) < 16 && z > 3.5 && z < 26 && !(Math.abs(x) < 0.95 && z < 8.8);
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
      let found = false;
      for (let t = 2.5; t < 26; t += 0.3) {
        const px = camera.position.x + aimDir.x * t;
        const pz = camera.position.z + aimDir.z * t;
        if (onWater(px, pz)) { x = px; z = pz; found = true; break; }
      }
      if (!found) {
        x = THREE.MathUtils.clamp(x, -14, 14);
        z = Math.max(4.2, z);
        if (Math.abs(x) < 0.95 && z < 8.8) x = x >= 0 ? 1.4 : -1.4;
      }
    }
    return { x, z };
  }
  enter('hub');
  markDest();
  return {
    get name() { return name; },
    get blocksMagic() { return name !== 'meadow'; },
    showBoard, enter,
    hurt(marks) { beasts.hurt(marks, name); },
    castHeld(_held, pressed, released) {
      if (name !== 'lake') return;
      if (pressed) { phase = 'aim'; power = 0.25; target.visible = true; }
      if (_held && phase === 'aim') power = Math.min(1, power + 0.012);
      if (released && phase === 'aim') {
        const spot = waterSpot();
        phase = 'wait';
        target.visible = false;
        bobber.visible = true;
        bobber.position.set(spot.x, 0.12, spot.z);
        line.visible = true;
        flicking = 1;
        biteAt = performance.now() + 2200 + Math.random() * 2500;
      }
    },
    update(dt) {
      waterMat.uniforms.uTime.value += dt;
      beasts.update(dt, name);
      const gate = name === 'hub' ? hubRing.position : name === 'lake' ? lakeRing.position : meadowRing.position;
      const d = Math.hypot(walker.feet.x - gate.x, walker.feet.z - gate.z);
      if (d > 2.15) leftRing = true;
      if (leftRing && performance.now() >= armUntil && d < 0.95) enter(name === 'hub' ? dest : 'hub');
      if (name === 'hub') {
        const bd = Math.hypot(walker.feet.x - screen.position.x, walker.feet.z - screen.position.z);
        if (bd > 2.1) boardHeld = false;
        if (!boardHeld && bd < 1.7 && panel?.hidden) showBoard();
      }
      if (name === 'lake') {
        const onDock = Math.abs(walker.feet.x) < 0.7 && walker.feet.z > 1.2 && walker.feet.z < 8.2;
        if (!onDock && walker.feet.z > 2.2) walker.feet.z = 2.2;
        if (phase === 'aim') { const spot = waterSpot(); target.position.set(spot.x, 0.06, spot.z); }
        if (phase === 'wait' && performance.now() >= biteAt) {
          phase = 'bite';
          biteUntil = performance.now() + 1700;
          if (reelBtn) reelBtn.hidden = false;
        }
        if (phase === 'bite') {
          bobber.position.y = 0.02 + Math.sin(performance.now() * 0.02) * 0.08;
          splash.visible = true;
          splash.position.copy(bobber.position);
          splash.scale.setScalar(1 + Math.sin(performance.now() * 0.03));
          if (performance.now() > biteUntil) { phase = 'idle'; resetFish(); }
        }
        if (phase === 'reel') {
          reelT += dt;
          bobber.position.lerp(walker.feet, Math.min(1, dt * 3));
          bobber.position.y = 0.2;
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
            const sag = Math.sin(t * Math.PI) * 0.12;
            pos.setXYZ(i, tipW.x + (end.x - tipW.x) * t, tipW.y + (end.y - tipW.y) * t - sag, tipW.z + (end.z - tipW.z) * t);
          }
          pos.needsUpdate = true;
        }
        if (bobber.visible && phase !== 'bite') {
          const u = (waterMat.uniforms.uTime.value * 0.7) % 1;
          rip.scale.setScalar(0.8 + u * 1.3);
          rip.material.opacity = (1 - u) * 0.7;
        }
      } else hold.visible = false;
      hub.children[0].position.copy(camera.position);
      lake.children[0].position.copy(camera.position);
    },
  };
}
