/* 3D home interior. The house is the inside of the zeppelin: a log cabin.
   Primitives and canvas textures only. One moving light (the fire).
   The round door is the way to the existing fishing slice, and the way back. */
import * as THREE from './vendor/three.module.min.js';

const HOME = {
  on: false,
  phase: 'inside',
  door: 0,
  doorTo: 0,
  ride: 0,
  bounce: 0,
  sound: false,
  t: 0,
  yaw: 0.62,
  pitch: 0.26,
  radius: 3.55,
  slot: 'billboard',
  nextCrackle: 0,
};

const target = new THREE.Vector3(-0.15, 1.05, -0.35);
const rideFrom = new THREE.Vector3();
const rideTo = new THREE.Vector3();
const lookFrom = new THREE.Vector3();
const lookTo = new THREE.Vector3();
const lookNow = new THREE.Vector3();

let renderer, scene, camera, fireLight, doorPivot, skyTex, skyCanvas, skyCtx;
let slotRoot, slotArm, slotCanvas, slotCtx, slotTex;
let cat;
let ac, master;
const ray = new THREE.Raycaster();
const ptr = { id: null, x: 0, y: 0, drag: false };

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function wood(base, line, knots) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.globalAlpha = 0.18 + ((y * 17) % 7) / 28;
      g.fillStyle = line;
      g.fillRect(0, y, w, 2);
    }
    g.globalAlpha = 0.35;
    for (let i = 0; i < knots; i++) {
      const x = (i * 53) % w, y = (i * 29) % h;
      g.fillStyle = line;
      g.beginPath(); g.ellipse(x, y, 7, 4, 0.4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  });
}
const TEX = {
  log: wood('#8d5a34', '#5a341c', 5),
  plank: wood('#c4844a', '#7a4e28', 3),
  beam: wood('#4e3018', '#2c1a0e', 2),
  stone: canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#6d675f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = i % 2 ? '#857e74' : '#564f48';
      g.fillRect((i * 13) % w, (i * 9) % h, 10, 8);
    }
  }),
  rug: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#7a2438'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a06a'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12);
    g.strokeStyle = '#e6d2a4'; g.lineWidth = 2;
    for (let i = 16; i < w; i += 14) { g.beginPath(); g.moveTo(i, 14); g.lineTo(i, h - 14); g.stroke(); }
  }),
  fluff: canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#f3e6d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e7d3b4';
    for (let i = 0; i < 80; i++) g.fillRect((i * 13) % w, (i * 7) % h, 3, 2);
  }),
  screen: canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#07141c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,220,255,.35)'; g.lineWidth = 1;
    for (let x = 12; x < w; x += 18) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, h - 8); g.stroke(); }
    for (let y = 12; y < h; y += 16) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
    g.fillStyle = '#9af0ff'; g.font = '700 36px sans-serif'; g.textAlign = 'center';
    g.fillText('Cook Nook', w / 2, h / 2 + 12);
  }),
  door: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#6a3c22'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 18) {
      g.fillStyle = (x / 18) % 2 ? '#7c4a2a' : '#5a3218';
      g.fillRect(x, 0, 16, h);
      g.fillStyle = '#3a2010'; g.fillRect(x + 16, 0, 2, h);
    }
  }),
};
TEX.plank.wrapS = TEX.plank.wrapT = THREE.RepeatWrapping;
TEX.plank.repeat.set(3, 3);
TEX.log.wrapS = TEX.log.wrapT = THREE.RepeatWrapping;
TEX.log.repeat.set(2, 1);

function lambert(opts) {
  return new THREE.MeshLambertMaterial(opts);
}
function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  (parent || scene).add(m);
  return m;
}
function tag(obj, name) { obj.userData.home = name; obj.traverse(o => { o.userData.home = name; }); return obj; }

function buildSky() {
  skyCanvas = document.createElement('canvas');
  skyCanvas.width = skyCanvas.height = 256;
  skyCtx = skyCanvas.getContext('2d');
  skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  paintSky(0);
}
function paintSky(off) {
  const g = skyCtx, w = 256;
  const grd = g.createLinearGradient(0, 0, 0, w);
  grd.addColorStop(0, '#14182e'); grd.addColorStop(0.55, '#243456'); grd.addColorStop(1, '#3a4e68');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
  g.fillStyle = '#f4f0dc';
  for (let i = 0; i < 40; i++) {
    const x = (i * 47) % w, y = (i * 19) % 140;
    g.globalAlpha = 0.4 + (i % 5) * 0.12;
    g.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
  g.globalAlpha = 0.85;
  g.fillStyle = '#f7f3e4';
  g.beginPath(); g.arc(188, 54, 16, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.55;
  g.fillStyle = '#d5dbe6';
  for (let i = 0; i < 3; i++) {
    const x = ((off * 40 + i * 90) % 320) - 40;
    g.beginPath(); g.ellipse(x, 150 + i * 18, 54, 16, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + 28, 146 + i * 18, 30, 12, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  skyTex.needsUpdate = true;
}

function buildRoom() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a120e');
  scene.fog = new THREE.Fog('#1a120e', 8, 16);
  scene.add(new THREE.AmbientLight(0xffe6cc, 0.42));
  fireLight = new THREE.PointLight(0xff7a32, 3.1, 7.2, 1.5);
  fireLight.position.set(0.05, 0.72, -1.35);
  scene.add(fireLight);

  mesh(new THREE.BoxGeometry(6.9, 0.12, 5.3), lambert({ map: TEX.plank }), 0, -0.06, 0);
  mesh(new THREE.BoxGeometry(6.9, 2.55, 0.14), lambert({ map: TEX.log }), 0, 1.28, -2.55);
  mesh(new THREE.BoxGeometry(0.14, 2.55, 5.3), lambert({ map: TEX.log }), -3.42, 1.28, 0);
  mesh(new THREE.BoxGeometry(6.9, 0.1, 5.4), lambert({ map: TEX.beam }), 0, 2.62, 0);
  for (const z of [-1.8, -0.6, 0.6, 1.6]) mesh(new THREE.BoxGeometry(6.5, 0.08, 0.1), lambert({ color: 0x3a2414 }), 0, 2.52, z);

  const wall = new THREE.Shape();
  wall.moveTo(-2.6, 0); wall.lineTo(2.6, 0); wall.lineTo(2.6, 2.55); wall.lineTo(-2.6, 2.55); wall.closePath();
  const hole = new THREE.Path();
  hole.absarc(-0.15, 1.22, 0.9, 0, Math.PI * 2, true);
  wall.holes.push(hole);
  const wallMesh = mesh(new THREE.ShapeGeometry(wall), lambert({ map: TEX.log, side: THREE.DoubleSide }), 3.4, 0, 0);
  wallMesh.rotation.y = Math.PI / 2;

  const rug = mesh(new THREE.BoxGeometry(2.5, 0.015, 1.7), lambert({ map: TEX.rug }), 0.05, 0.01, -0.55);
  const fluff = mesh(new THREE.CircleGeometry(0.72, 20), lambert({ map: TEX.fluff }), -0.05, 0.03, -0.45);
  fluff.rotation.x = -Math.PI / 2;

  buildHearth();
  buildPorthole();
  buildNook();
  buildBoard();
  buildDoor();
  buildLake();
  buildCat();
  buildBee();
  buildSlot();
  buildLamp();
  buildSeat();
}
function buildHearth() {
  const stone = lambert({ map: TEX.stone });
  const g = new THREE.Group();
  scene.add(g);
  const block = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); m.position.set(x, y, z); g.add(m); };
  block(2.15, 0.42, 0.85, 0, 0.21, 0);
  block(0.32, 1.15, 0.7, -0.85, 0.95, 0);
  block(0.32, 1.15, 0.7, 0.85, 0.95, 0);
  block(2.2, 0.16, 0.78, 0, 1.55, 0);
  block(0.55, 0.7, 0.4, 0, 1.95, 0);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.08), new THREE.MeshBasicMaterial({ color: 0x1a0c08 }));
  mouth.position.set(0, 0.78, 0.36);
  g.add(mouth);
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), lambert({ color: 0x4a2c18 }));
    log.rotation.z = Math.PI / 2; log.rotation.y = i * 0.5;
    log.position.set(0, 0.48, 0.22);
    g.add(log);
  }
  g.position.set(0.05, 0, -2.15);
  const flames = new THREE.Group();
  flames.position.set(0.05, 0.5, -1.82);
  scene.add(flames);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb15a, transparent: true, opacity: 0.9, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16 + (i % 2) * 0.06, 0.38), flameMat.clone());
    p.position.set((i - 2) * 0.07, 0.15, i * 0.01);
    p.userData.ph = i;
    flames.add(p);
  }
  HOME.flames = flames;
}
function buildPorthole() {
  const g = new THREE.Group();
  g.position.set(-3.32, 1.55, 0.15);
  g.rotation.y = Math.PI / 2;
  scene.add(g);
  buildSky();
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), new THREE.MeshBasicMaterial({ map: skyTex }));
  g.add(glass);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 8, 28), lambert({ color: 0xc9a15a }));
  g.add(ring);
}
function buildNook() {
  const g = new THREE.Group();
  g.position.set(-2.35, 0, 0.15);
  tag(g, 'nook');
  scene.add(g);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.62), lambert({ color: 0x6a4128, map: TEX.plank }));
  counter.position.y = 0.39;
  g.add(counter);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.28), lambert({ color: 0x2a241c }));
  box.position.set(0, 0.95, 0);
  g.add(box);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: TEX.screen }));
  screen.position.set(0, 0.98, 0.15);
  g.add(screen);
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lambert({ color: 0xb87333 }));
  kettle.position.set(0.38, 0.86, 0.05);
  kettle.scale.y = 0.8;
  g.add(kettle);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 10, Math.PI), lambert({ color: 0xb87333 }));
  handle.position.set(0.38, 0.96, 0.05);
  g.add(handle);
  for (const x of [-0.28, 0.05]) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 8), lambert({ color: 0xd9cfc2 }));
    mug.position.set(x, 0.82, 0.16);
    g.add(mug);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.28), lambert({ color: 0x5c3a22 }));
  shelf.position.set(0, 1.7, -0.05);
  g.add(shelf);
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), lambert({ color: i === 1 ? 0x8a9a78 : 0xc4b49a }));
    jar.position.set(-0.35 + i * 0.32, 1.8, -0.05);
    g.add(jar);
  }
}
function buildBoard() {
  const g = new THREE.Group();
  g.position.set(1.55, 0, 1.25);
  tag(g, 'board');
  scene.add(g);
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.62), lambert({ color: 0x6a4128, map: TEX.plank }));
  table.position.y = 0.62;
  g.add(table);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.58, 0.4), lambert({ color: 0x4e301c }));
  leg.position.y = 0.29;
  g.add(leg);
  const face = canvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#102018'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d7b15a'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 18 + i * 16, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = '#7ee7c8';
    ctx.beginPath(); ctx.moveTo(40, h / 2); ctx.lineTo(w - 40, h / 2); ctx.moveTo(w / 2, 16); ctx.lineTo(w / 2, h - 16); ctx.stroke();
    ctx.fillStyle = '#f3e2a8'; ctx.font = '700 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Command', w / 2, 28);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.46), new THREE.MeshBasicMaterial({ map: face }));
  board.position.set(0, 0.78, 0.02);
  board.rotation.x = -0.7;
  g.add(board);
}
function buildDoor() {
  doorPivot = new THREE.Group();
  doorPivot.position.set(3.3, 1.22, -0.75);
  scene.add(doorPivot);
  const g = new THREE.Group();
  g.position.set(0, 0, 0.9);
  tag(g, 'door');
  doorPivot.add(g);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.08, 32), lambert({ map: TEX.door }));
  door.rotation.z = Math.PI / 2;
  g.add(door);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 14), lambert({ color: 0xd7c08a }));
  handle.position.set(-0.06, 0, 0.22);
  g.add(handle);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.055, 8, 32), lambert({ color: 0xc9a15a }));
  frame.position.set(3.38, 1.22, 0.15);
  frame.rotation.y = Math.PI / 2;
  scene.add(frame);
}
function buildLake() {
  const g = new THREE.Group();
  scene.add(g);
  const water = new THREE.Mesh(new THREE.CircleGeometry(8, 28), lambert({ color: 0x1a4568 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(11, -0.05, 0);
  g.add(water);
  const shore = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20), lambert({ color: 0x3d5a3a }));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(6.2, -0.02, 0);
  g.add(shore);
  for (let i = 0; i < 4; i++) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 7), lambert({ color: i % 2 ? 0x243c28 : 0x1c3222 }));
    tree.position.set(7.5 + i * 0.8, 0.8, -2.2 + i * 1.1);
    g.add(tree);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4f0dc }));
  moon.position.set(12, 4.2, -1.5);
  g.add(moon);
}
function buildCat() {
  cat = new THREE.Group();
  cat.position.set(-0.15, 0.05, -0.42);
  cat.rotation.y = -0.6;
  scene.add(cat);
  const fur = lambert({ map: canvasTex(32, 32, (g, w, h) => { g.fillStyle = '#e09a55'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a4a28'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); }) });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), fur);
  body.scale.set(1.5, 0.7, 0.85);
  body.position.y = 0.12;
  cat.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), fur);
  head.position.set(0.28, 0.16, 0.02);
  cat.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 5), fur);
    ear.position.set(0.28, 0.28, s * 0.05);
    cat.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.32, 6), fur);
  tail.position.set(-0.32, 0.16, 0.08);
  tail.rotation.z = 1.1;
  cat.add(tail);
}
function paintSlot() {
  const c = slotCanvas, g = slotCtx, w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  const gold = HOME.slot === 'gold', cheeb = HOME.slot === 'cheeb';
  const skin = gold ? '#f0d7a4' : '#f3d2c3';
  const cloth = gold ? '#e2b84a' : cheeb ? '#f2d2b0' : '#f4f1ea';
  const hair = gold ? '#f2e2a8' : '#7d6ad4';
  g.fillStyle = cloth;
  if (cheeb) { g.beginPath(); g.ellipse(w / 2, h * 0.62, 46, 58, 0, 0, Math.PI * 2); g.fill(); }
  else { g.fillRect(w / 2 - 28, h * 0.42, 56, gold ? 120 : 100); }
  g.fillStyle = skin;
  g.beginPath(); g.arc(w / 2, cheeb ? h * 0.38 : h * 0.32, cheeb ? 40 : 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = hair;
  g.beginPath(); g.arc(w / 2, (cheeb ? h * 0.34 : h * 0.28), cheeb ? 42 : 32, Math.PI, Math.PI * 2); g.fill();
  g.fillStyle = '#2a241c';
  g.fillRect(w / 2 - 12, h * 0.3, 6, 4); g.fillRect(w / 2 + 6, h * 0.3, 6, 4);
  slotTex.needsUpdate = true;
}
function buildSlot() {
  slotCanvas = document.createElement('canvas');
  slotCanvas.width = 128; slotCanvas.height = 256;
  slotCtx = slotCanvas.getContext('2d');
  slotTex = new THREE.CanvasTexture(slotCanvas);
  slotTex.colorSpace = THREE.SRGBColorSpace;
  paintSlot();
  slotRoot = new THREE.Group();
  slotRoot.position.set(0.95, 0, -1.05);
  tag(slotRoot, 'spot');
  scene.add(slotRoot);
  const body = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24), new THREE.MeshBasicMaterial({ map: slotTex, transparent: true, depthWrite: false }));
  body.position.y = 0.62;
  slotRoot.add(body);
  slotArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), lambert({ color: 0xf3d2c3 }));
  slotArm.position.set(0.22, 0.78, 0.02);
  slotArm.geometry.translate(0, -0.18, 0);
  slotRoot.add(slotArm);
}
function buildBee() {
  const g = new THREE.Group();
  g.position.set(0.22, 0.1, -0.28);
  scene.add(g);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), lambert({ color: 0xf0c84a }));
  body.scale.set(1.3, 0.8, 0.8);
  g.add(body);
  const band = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), lambert({ color: 0x2a2418 }));
  band.scale.set(0.4, 1, 1);
  g.add(band);
}
function buildSeat() {
  const g = new THREE.Group();
  g.position.set(1.7, 0, -0.85);
  scene.add(g);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.7), lambert({ color: 0x7a3a32 }));
  seat.position.y = 0.28;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.12), lambert({ color: 0x8a4036 }));
  back.position.set(0, 0.62, -0.28);
  g.add(back);
  const throwRug = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.4), lambert({ color: 0xc45a3a }));
  throwRug.position.set(0.05, 0.46, 0.05);
  g.add(throwRug);
  for (let i = 0; i < 2; i++) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 1.15, 5), lambert({ color: 0x8a6a3a }));
    rod.position.set(0.72 + i * 0.08, 0.7, -1.85);
    rod.rotation.z = 0.12;
    scene.add(rod);
  }
}
function buildLamp() {
  const g = new THREE.Group();
  g.position.set(0.2, 2.15, 0.4);
  scene.add(g);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd29a, transparent: true, opacity: 0.45, depthWrite: false }));
  glow.scale.set(0.42, 0.42, 1);
  g.add(glow);
}
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(42,24,16,.8)'; g.fillRect(8, 8, 240, 48);
  g.fillStyle = '#f6e2c4'; g.font = '700 28px sans-serif'; g.textAlign = 'center';
  g.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.22, 1);
  return s;
}

function heroCamera() {
  HOME.yaw = -0.85; HOME.pitch = 0.22; HOME.radius = 4.15;
  target.set(0.15, 0.95, -0.15);
}
function applyOrbit() {
  const cp = Math.cos(HOME.pitch), sp = Math.sin(HOME.pitch);
  camera.position.set(
    target.x + Math.sin(HOME.yaw) * cp * HOME.radius,
    target.y + sp * HOME.radius,
    target.z + Math.cos(HOME.yaw) * cp * HOME.radius,
  );
  camera.lookAt(target);
}
function ensure() {
  if (renderer) return true;
  const canvas = document.getElementById('homeCv');
  if (!canvas) return false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
  camera = new THREE.PerspectiveCamera(48, 1, 0.08, 40);
  buildRoom();
  resize();
  return true;
}
function resize() {
  const canvas = document.getElementById('homeCv');
  if (!renderer || !canvas) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
function show(on) {
  HOME.on = on;
  document.body.classList.toggle('home-in', on && HOME.phase !== 'fishing');
  const hud = document.getElementById('homeHud');
  if (hud) hud.classList.toggle('on', on && HOME.phase !== 'fishing');
}
function placeRide(out) {
  if (out) {
    rideFrom.copy(camera.position);
    rideTo.set(5.1, 1.65, 0.15);
    lookFrom.copy(target);
    lookTo.set(11, 0.8, 0);
  } else {
    rideFrom.copy(camera.position);
    heroCamera();
    applyOrbit();
    rideTo.copy(camera.position);
    lookFrom.copy(lookNow);
    lookTo.copy(target);
  }
  HOME.ride = 0;
}
function step(dt) {
  if (!HOME.on) return;
  HOME.t += dt;
  HOME.door += (HOME.doorTo - HOME.door) * Math.min(1, dt * 3.2);
  if (doorPivot) doorPivot.rotation.y = -HOME.door * 2.05;
  if (HOME.phase === 'opening' && HOME.door > 0.86) { HOME.phase = 'through'; placeRide(true); }
  if (HOME.phase === 'through' || HOME.phase === 'return') {
    HOME.ride = Math.min(1, HOME.ride + dt / 1.15);
    const k = HOME.ride * HOME.ride * (3 - 2 * HOME.ride);
    camera.position.lerpVectors(rideFrom, rideTo, k);
    lookNow.lerpVectors(lookFrom, lookTo, k);
    camera.lookAt(lookNow);
    if (HOME.ride >= 1 && HOME.phase === 'through') beginFishing();
    if (HOME.ride >= 1 && HOME.phase === 'return') { HOME.phase = 'inside'; HOME.doorTo = 0; }
  } else if (HOME.phase === 'inside' || HOME.phase === 'opening') applyOrbit();
  if (HOME.flames) {
    const flick = 0.75 + Math.sin(HOME.t * 17) * 0.12 + Math.sin(HOME.t * 29) * 0.08;
    fireLight.intensity = 1.7 + flick;
    HOME.flames.children.forEach(p => {
      const s = 0.85 + Math.sin(HOME.t * 11 + p.userData.ph) * 0.25;
      p.scale.y = s; p.position.y = 0.12 + s * 0.08;
      p.material.opacity = 0.55 + s * 0.3;
    });
  }
  if (cat) cat.scale.y = 1 + Math.sin(HOME.t * 1.4) * 0.03;
  if (slotRoot) {
    const hop = HOME.bounce > 0 ? Math.sin(HOME.bounce * Math.PI) : 0;
    slotRoot.position.y = hop * 0.16;
    slotRoot.scale.y = (HOME.slot === 'cheeb' ? 0.82 : 1) * (1 - hop * 0.08);
    if (slotArm) slotArm.rotation.z = -hop * 1.15;
    if (HOME.bounce > 0) HOME.bounce = Math.max(0, HOME.bounce - dt * 1.35);
  }
  paintSky(HOME.t * 0.15);
  if (HOME.sound) {
    HOME.nextCrackle -= dt;
    if (HOME.nextCrackle <= 0) { crackle(); HOME.nextCrackle = 0.05 + Math.random() * 0.14; }
  }
  renderer.render(scene, camera);
}
function loop(now) {
  requestAnimationFrame(loop);
  if (!HOME.on || HOME.phase === 'fishing') return;
  const dt = Math.min(0.05, (now - (loop.then || now)) / 1000);
  loop.then = now;
  step(dt || 0.016);
}
function beginFishing() {
  HOME.phase = 'fishing';
  show(false);
  document.body.classList.remove('home-in');
  const back = document.getElementById('homeDoorBack');
  if (back) back.classList.add('on');
  if (typeof openFish === 'function') openFish();
}
function enter() {
  if (!ensure()) return false;
  heroCamera();
  HOME.phase = 'inside';
  HOME.door = 0; HOME.doorTo = 0; HOME.ride = 0;
  if (doorPivot) doorPivot.rotation.y = 0;
  show(true);
  const back = document.getElementById('homeDoorBack');
  if (back) back.classList.remove('on');
  applyOrbit();
  renderer.render(scene, camera);
  return true;
}
function leave() {
  HOME.on = false; HOME.phase = 'inside';
  show(false);
  const back = document.getElementById('homeDoorBack');
  if (back) back.classList.remove('on');
}
function activate(name) {
  if (name === 'nook' && typeof openCraft === 'function') { openCraft(); return true; }
  if (name === 'board' && typeof openCommand === 'function') { openCommand(); return true; }
  if (name === 'spot') { HOME.bounce = 1; return true; }
  if (name === 'door') {
    if (HOME.phase !== 'inside' && HOME.phase !== 'opening') return false;
    HOME.phase = 'opening'; HOME.doorTo = 1; return true;
  }
  return false;
}
function pose(which) {
  if (!ensure()) return false;
  if (which === 'door') {
    HOME.on = true; HOME.phase = 'inside'; HOME.door = 1; HOME.doorTo = 1;
    if (doorPivot) doorPivot.rotation.y = -2.05;
    target.set(2.55, 1.22, 0.15);
    HOME.yaw = -0.5; HOME.pitch = 0.05; HOME.radius = 3.3;
    show(true); applyOrbit(); renderer.render(scene, camera);
    return true;
  }
  return enter();
}
function backHome() {
  if (!ensure()) return false;
  HOME.on = true;
  HOME.phase = 'return';
  HOME.doorTo = 0;
  if (typeof closeModal === 'function') closeModal('fishM');
  show(true);
  const back = document.getElementById('homeDoorBack');
  if (back) back.classList.remove('on');
  camera.position.set(5.1, 1.65, 0.15);
  lookNow.set(11, 0.8, 0);
  placeRide(false);
  return true;
}
function setSound(on) {
  HOME.sound = !!on;
  ensureAudio();
  if (master) master.gain.value = HOME.sound ? 0.22 : 0;
  const b = document.getElementById('homeCrackle');
  if (b) { b.textContent = HOME.sound ? 'Fire sound on' : 'Fire sound off'; b.setAttribute('aria-pressed', HOME.sound ? 'true' : 'false'); }
  return HOME.sound;
}
function ensureAudio() {
  if (ac) return;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  ac = new C();
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
}
function crackle() {
  if (!ac || !HOME.sound) return;
  const dur = 0.02 + Math.random() * 0.04;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 1600;
  const g = ac.createGain(); g.gain.value = 0.35;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}
function setSlot(kind) {
  if (kind !== 'billboard' && kind !== 'cheeb' && kind !== 'gold') return false;
  HOME.slot = kind;
  if (slotCanvas) paintSlot();
  if (slotRoot) {
    const s = kind === 'gold' ? 1.12 : 1;
    slotRoot.scale.set(s, kind === 'cheeb' ? 0.82 : s, s);
  }
  return true;
}
function hitName(x, y) {
  if (!renderer || !camera) return '';
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(scene.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o) { if (o.userData && o.userData.home) return o.userData.home; o = o.parent; }
  }
  return '';
}
function onDown(e) {
  if (!HOME.on || HOME.phase === 'fishing') return;
  ptr.id = e.pointerId; ptr.x = e.clientX; ptr.y = e.clientY; ptr.drag = false;
}
function onMove(e) {
  if (ptr.id !== e.pointerId || HOME.phase === 'through' || HOME.phase === 'return') return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  if (!ptr.drag && dx * dx + dy * dy > 36) ptr.drag = true;
  if (!ptr.drag || (HOME.phase !== 'inside' && HOME.phase !== 'opening')) return;
  HOME.yaw -= dx * 0.005;
  HOME.pitch = Math.max(0.08, Math.min(0.62, HOME.pitch + dy * 0.003));
  ptr.x = e.clientX; ptr.y = e.clientY;
}
function onUp(e) {
  if (ptr.id !== e.pointerId) return;
  const was = ptr.drag;
  ptr.id = null;
  if (!was && (HOME.phase === 'inside' || HOME.phase === 'opening')) activate(hitName(e.clientX, e.clientY));
}

function mount() {
  const style = document.createElement('style');
  style.textContent = [
    '#homeCv{position:fixed;inset:0;z-index:18;display:none;touch-action:none;width:100%;height:100%}',
    'body.home-in #homeCv{display:block}',
    'body.home-in #mapNav,body.home-in #act,body.home-in #menuBtn,body.home-in #obj,body.home-in #coach,body.home-in #wirePanel,body.home-in #charBtn{visibility:hidden!important}',
    '#homeHud{position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:19;display:none;gap:8px;pointer-events:none}',
    '#homeHud.on{display:flex}',
    '#homeHud button{pointer-events:auto;padding:8px 12px;border-radius:12px;font-weight:800;background:rgba(42,24,16,.82);border:1px solid rgba(226,196,138,.7);color:#f6e2c4}',
    '#homeDoorBack{position:fixed;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:45;display:none;padding:8px 12px;border-radius:12px;font-weight:800;background:rgba(42,24,16,.9);border:1px solid rgba(226,196,138,.8);color:#f6e2c4}',
    '#homeDoorBack.on{display:block}',
  ].join('');
  document.head.appendChild(style);
  const canvas = document.createElement('canvas');
  canvas.id = 'homeCv';
  document.body.appendChild(canvas);
  const hud = document.createElement('div');
  hud.id = 'homeHud';
  hud.innerHTML = '<button type="button" id="homeCrackle" aria-pressed="false">Fire sound off</button><button type="button" id="homeOutside">Outside</button>';
  document.body.appendChild(hud);
  const back = document.createElement('button');
  back.id = 'homeDoorBack'; back.type = 'button'; back.textContent = 'Door home';
  document.body.appendChild(back);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', e => {
    if (!HOME.on) return;
    HOME.radius = Math.max(2.4, Math.min(4.8, HOME.radius + Math.sign(e.deltaY) * 0.15));
  }, { passive: true });
  document.getElementById('homeCrackle').onclick = () => setSound(!HOME.sound);
  document.getElementById('homeOutside').onclick = () => leave();
  back.onclick = () => backHome();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
}
function boot() {
  mount();
  window.__home = {
    enter, leave, activate, back: backHome, pose, step, setSound, setSlot, hitName,
    covers: () => HOME.on && HOME.phase !== 'fishing',
    state: () => ({ on: HOME.on, phase: HOME.phase, door: HOME.door, bounce: HOME.bounce, sound: HOME.sound, slot: HOME.slot, yaw: HOME.yaw }),
  };
  window.__homeCovers = () => window.__home.covers();
  window.__homeCommandExtra = list => {
    const sheet = list && list.closest ? list.closest('.sheet') : null;
    if (!sheet || sheet.querySelector('[data-friend-quests]')) return;
    const d = document.createElement('div');
    d.dataset.friendQuests = '1';
    d.className = 'hint';
    d.innerHTML = '<b>Friend quests</b><br>Placeholder. Friends are not out yet.';
    const head = sheet.querySelector('.sh-h');
    if (head) head.after(d); else list.insertBefore(d, list.firstChild);
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
