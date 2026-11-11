/* 3D home interior. The house is the inside of the zeppelin: a log cabin.
   Primitives and canvas textures only. One moving light (the fire).
   The round door is the travel threshold: step out onto the map, or step
   into a cozy room that already exists. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './gltf-loader.js';
import { applyToon } from './toon_three.js';

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
  slot: 'gold',
  nextCrackle: 0,
  ar: { active: false, stub: true, mode: 'screen', placed: false, scale: 1, reason: 'Full-screen cabin. AR has not been asked for.' },
};

const target = new THREE.Vector3(-0.15, 1.05, -0.35);
const rideFrom = new THREE.Vector3();
const rideTo = new THREE.Vector3();
const lookFrom = new THREE.Vector3();
const lookTo = new THREE.Vector3();
const lookNow = new THREE.Vector3();

let renderer, scene, camera, fireLight, doorPivot, skyTex, skyCanvas, skyCtx, cabinRoot, reticle, hitSource, slotPlane;
let doorPlate, doorPaint, doorHolo, doorBack, shipDoor, shipLeaf;
let roomPlate, roomPaint, roomHolo, roomBack;
const roomToCam = new THREE.Vector3();
const ROOM_IMG_ASPECT = 1280 / 450;
let goldRoot, goldMixer, goldAction, goldReady = false;
let slotRoot, slotArm, slotCanvas, slotCtx, slotTex, visitor;
let cat, cheebSprite, cheebShadow, cheebPad;
let ac, master;
const CHEEB = { t: 0, u: 0, leg: 0, mode: 'walk', idle: 0, tap: 0, view: 'front' };
const CHEEB_A = { x: -1.15, z: 0.42 };
const CHEEB_B = { x: 0.35, z: 0.62 };
const cheebTex = { front: null, back: null };
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
  screen: canvasTex(128, 80, (g, w, h) => {
    g.fillStyle = '#07141c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,220,255,.35)'; g.lineWidth = 1;
    for (let x = 12; x < w; x += 18) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, h - 8); g.stroke(); }
    for (let y = 12; y < h; y += 16) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
    g.fillStyle = '#9af0ff'; g.font = '700 18px sans-serif'; g.textAlign = 'center';
    g.fillText('Craft', w / 2, h / 2 + 12);
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
  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x8a5430, 0.72));
  fireLight = new THREE.PointLight(0xffb15a, 2.6, 8, 1.4);
  fireLight.position.set(0.05, 0.72, -1.35);
  scene.add(fireLight);

  mesh(new THREE.BoxGeometry(6.9, 0.12, 5.3), lambert({ map: TEX.plank }), 0, -0.06, 0);
  mesh(new THREE.BoxGeometry(6.9, 0.1, 5.4), lambert({ map: TEX.beam }), 0, 2.62, 0);

  const wall = new THREE.Shape();
  wall.moveTo(-2.6, 0); wall.lineTo(2.6, 0); wall.lineTo(2.6, 2.55); wall.lineTo(-2.6, 2.55); wall.closePath();
  const hole = new THREE.Path();
  hole.absarc(-0.15, 1.22, 0.9, 0, Math.PI * 2, true);
  wall.holes.push(hole);
  const wallMesh = mesh(new THREE.ShapeGeometry(wall), lambert({ map: TEX.log, side: THREE.DoubleSide }), 3.4, 0, 0);
  wallMesh.rotation.y = Math.PI / 2;

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
  buildCheeb();
  buildRoomPlate();
  wrapCabin();
  dressCabin();
}
function buildHearth() {
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
  pad(g, 'nook', 1.8, 1.8, 1.6, 0.9);
}
function buildBoard() {
  const g = new THREE.Group();
  g.position.set(1.55, 0, 1.25);
  tag(g, 'board');
  scene.add(g);
  pad(g, 'board', 1.7, 1.6, 1.6, 0.7);
}
function buildDoor() {
  doorPivot = new THREE.Group();
  doorPivot.position.set(3.3, 1.22, -0.75);
  scene.add(doorPivot);
  const g = new THREE.Group();
  g.position.set(0, 0, 0.9);
  tag(g, 'door');
  doorPivot.add(g);
  pad(g, 'door', 1.9, 1.9, 0.6, 0);
  buildDoorPlate();
}
function buildDoorPlate() {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  doorPaint = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: true, side: THREE.FrontSide, toneMapped: false,
  });
  doorHolo = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xffb0e8, toneMapped: false,
  });
  doorPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), doorPaint);
  doorPlate.position.set(3.08, 1.3, 0.46);
  doorPlate.rotation.y = -Math.PI / 2;
  doorPlate.visible = false;
  doorPlate.renderOrder = 2;
  doorPlate.userData.home = 'door';
  const meshRay = THREE.Mesh.prototype.raycast;
  doorPlate.raycast = function (caster, hits) { if (this.visible) meshRay.call(this, caster, hits); };
  scene.add(doorPlate);
  doorBack = new THREE.Mesh(doorPlate.geometry, new THREE.MeshBasicMaterial({ color: 0x120c08, side: THREE.FrontSide }));
  doorBack.position.set(3.14, 1.3, 0.46);
  doorBack.rotation.y = -Math.PI / 2;
  doorBack.visible = false;
  doorBack.raycast = () => {};
  scene.add(doorBack);
  new THREE.TextureLoader().load('ship_door_plate.jpg', loaded => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    const aspect = loaded.image.width / loaded.image.height;
    const height = 2.5;
    const width = height * aspect;
    doorPlate.geometry.dispose();
    doorPlate.geometry = new THREE.PlaneGeometry(width, height);
    if (doorBack) doorBack.geometry = doorPlate.geometry;
    // The oval sits left of center. Shift the plate so the swirl lands on the round door.
    doorPlate.position.z = 0.15 + (0.5 - 0.344) * width;
    doorPlate.position.y = 1.22 + (0.532 - 0.5) * height;
    doorPaint.map = loaded;
    doorHolo.map = loaded;
    doorPaint.needsUpdate = true;
    doorHolo.needsUpdate = true;
    HOME.doorPlateReady = true;
  });
}
function syncDoorPlate() {
  const live = !!(doorPlate && HOME.on && HOME.phase !== 'fishing' && HOME.phase !== 'arcade' && doorPlateFocused());
  if (!live) {
    if (doorPlate) doorPlate.visible = false;
    if (doorBack) doorBack.visible = false;
    if (!HOME.on || HOME.phase === 'fishing' || HOME.phase === 'arcade') {
      if (shipDoor) shipDoor.visible = true;
      if (shipLeaf) shipLeaf.visible = true;
    }
    HOME.doorView = { on: false, ready: !!HOME.doorPlateReady, mode: 'off' };
    return HOME.doorView;
  }
  const doorX = 3.2, doorY = 1.28, doorZ = 0.15;
  const dx = camera.position.x - doorX;
  const dy = camera.position.y - doorY;
  const dz = camera.position.z - doorZ;
  const dist = Math.hypot(dx, dy, dz);
  const frontDepth = doorX - camera.position.x;
  const behind = frontDepth < 0.4;
  const side = Math.abs(dz) > Math.max(0.7, Math.abs(frontDepth) * 1.25);
  const close = dist < 1.45;
  const holo = behind || side || close;
  doorPlate.visible = true;
  doorPlate.material = holo ? doorHolo : doorPaint;
  if (holo) {
    doorHolo.opacity = 0.34 + 0.22 * (0.5 + 0.5 * Math.sin(HOME.t * 6));
    doorHolo.color.setHex((HOME.t % 0.8) < 0.4 ? 0xff9ad4 : 0xb7f0ff);
  } else doorPaint.opacity = 0.96 + 0.04 * (0.5 + 0.5 * Math.sin(HOME.t * 2.2));
  if (shipDoor) shipDoor.visible = false;
  if (shipLeaf) shipLeaf.visible = false;
  if (doorBack) {
    doorBack.position.set(doorPlate.position.x + 0.06, doorPlate.position.y, doorPlate.position.z);
    doorBack.rotation.copy(doorPlate.rotation);
    doorBack.visible = !behind;
  }
  HOME.doorView = {
    on: true, ready: !!HOME.doorPlateReady, mode: holo ? 'holo' : 'paint',
    dist: Math.round(dist * 100) / 100,
  };
  return HOME.doorView;
}
function faceDoor(which) {
  if (!ensure()) return { on: false, mode: 'off' };
  HOME.phase = 'inside';
  HOME.door = 0; HOME.doorTo = 0;
  show(true);
  target.set(3.2, 1.28, 0.15);
  HOME.pitch = 0.04;
  const name = which || 'front';
  if (name === 'close') { HOME.yaw = -Math.PI / 2; HOME.radius = 0.85; }
  else if (name === 'behind') { HOME.yaw = Math.PI / 2; HOME.radius = 2.2; }
  else if (name === 'side') { HOME.yaw = -0.22; HOME.radius = 2.4; }
  else { HOME.yaw = -Math.PI / 2; HOME.radius = 1.72; }
  applyOrbit();
  syncCabinPlates();
  if (renderer) renderer.render(scene, camera);
  return Object.assign({}, HOME.doorView);
}
function heroEye() {
  const yaw = -0.85, pitch = 0.22, radius = 4.15;
  const look = new THREE.Vector3(0.15, 0.95, -0.15);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cam = new THREE.Vector3(
    look.x + Math.sin(yaw) * cp * radius,
    look.y + sp * radius,
    look.z + Math.cos(yaw) * cp * radius,
  );
  return { cam, look };
}
function buildRoomPlate() {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  roomPaint = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
  roomHolo = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xffb0e8, toneMapped: false,
  });
  roomPlate = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_IMG_ASPECT, 1), roomPaint);
  const eye = heroEye();
  const dir = eye.look.clone().sub(eye.cam).normalize();
  const dist = 3.35;
  roomPlate.position.copy(eye.cam).addScaledVector(dir, dist);
  const zAxis = dir.clone().negate();
  const up = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  roomPlate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  roomPlate.visible = false;
  roomPlate.renderOrder = 3;
  const meshRay = THREE.Mesh.prototype.raycast;
  roomPlate.raycast = function (caster, hits) {
    if (!this.visible) return;
    const before = hits.length;
    meshRay.call(this, caster, hits);
    for (let i = before; i < hits.length; i++) {
      const u = hits[i].uv ? hits[i].uv.x : 0.5;
      this.userData.home = (u > 0.64 && u < 0.92) ? 'door' : (u < 0.30 ? 'nook' : '');
    }
  };
  scene.add(roomPlate);
  roomBack = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_IMG_ASPECT, 1), new THREE.MeshBasicMaterial({ color: 0x24160f, side: THREE.DoubleSide }));
  roomBack.position.copy(roomPlate.position).addScaledVector(dir, 0.05);
  roomBack.quaternion.copy(roomPlate.quaternion);
  roomBack.visible = false;
  roomBack.raycast = () => {};
  scene.add(roomBack);
  HOME.roomAnchor = { dist, normal: eye.cam.clone().sub(roomPlate.position).normalize() };
  new THREE.TextureLoader().load('cabin_room_plate.jpg', loaded => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    roomPaint.map = loaded;
    roomHolo.map = loaded;
    HOME.roomPlateReady = true;
  });
}
function fitRoomPlate() {
  const dist = HOME.roomAnchor.dist;
  const viewH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
  const viewW = viewH * Math.max(0.35, camera.aspect);
  const height = Math.min(viewH * 0.9, viewW * 0.94 / ROOM_IMG_ASPECT);
  roomPlate.scale.setScalar(height);
  const backH = viewH * 1.45;
  const backW = Math.max(viewW * 1.45, height * ROOM_IMG_ASPECT * 1.08);
  roomBack.scale.set(backW / ROOM_IMG_ASPECT, backH, 1);
}
function doorPlateFocused() {
  if (!camera) return false;
  const dz = camera.position.z - 0.15;
  const dist = Math.hypot(camera.position.x - 3.2, camera.position.y - 1.28, dz);
  return camera.position.x > 0.35 && Math.abs(dz) < 1.05 && dist < 5;
}
function syncRoomPlate(doorOn) {
  const live = !!(roomPlate && HOME.on && HOME.phase !== 'fishing' && HOME.phase !== 'arcade' && !doorOn);
  if (!live) {
    if (roomPlate) roomPlate.visible = false;
    if (roomBack) roomBack.visible = false;
    HOME.roomView = { on: false, ready: !!HOME.roomPlateReady, mode: 'off' };
    return HOME.roomView;
  }
  fitRoomPlate();
  roomToCam.copy(camera.position).sub(roomPlate.position);
  const dist = roomToCam.length();
  const frontDepth = roomToCam.dot(HOME.roomAnchor.normal);
  const lateral = Math.sqrt(Math.max(0, dist * dist - frontDepth * frontDepth));
  const behind = frontDepth < 0.4;
  const side = lateral > Math.max(0.7, Math.abs(frontDepth) * 1.25);
  const close = dist < 1.45;
  const holo = behind || side || close;
  roomPlate.visible = true;
  roomPlate.material = holo ? roomHolo : roomPaint;
  if (holo) {
    roomHolo.opacity = 0.34 + 0.22 * (0.5 + 0.5 * Math.sin(HOME.t * 6));
    roomHolo.color.setHex((HOME.t % 0.8) < 0.4 ? 0xff9ad4 : 0xb7f0ff);
  } else roomPaint.opacity = 1;
  if (roomBack) roomBack.visible = !behind;
  HOME.roomView = {
    on: true, ready: !!HOME.roomPlateReady, mode: holo ? 'holo' : 'paint',
    dist: Math.round(dist * 100) / 100,
  };
  return HOME.roomView;
}
function setCabinDress(hide) {
  if (!cabinRoot) return;
  for (const ch of cabinRoot.children) {
    if (ch === roomPlate || ch === roomBack || ch === doorPlate || ch === doorBack) continue;
    if (hide) {
      if (ch.userData._plateHold == null) ch.userData._plateHold = ch.visible;
      ch.visible = false;
    } else if (ch.userData._plateHold != null) {
      ch.visible = ch.userData._plateHold;
      ch.userData._plateHold = null;
    }
  }
}
function syncCabinPlates() {
  const door = syncDoorPlate();
  const room = syncRoomPlate(!!door.on);
  const plates = !!(door.on || room.on);
  setCabinDress(plates);
  document.body.classList.toggle('cabin-plate', plates);
  return { door, room };
}
function faceRoom(which) {
  if (!ensure()) return { on: false, mode: 'off' };
  HOME.phase = 'inside';
  HOME.door = 0; HOME.doorTo = 0;
  show(true);
  heroCamera();
  if (which === 'close') HOME.radius = 1.9;
  else if (which === 'behind' || which === 'side') { HOME.yaw += Math.PI; HOME.radius = 3.3; }
  applyOrbit();
  const view = syncCabinPlates();
  if (renderer) renderer.render(scene, camera);
  return Object.assign({}, view.room);
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
  slotPlane = body;
  body.visible = HOME.slot !== 'gold';
  body.position.y = 0.62;
  slotRoot.add(body);
  slotArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), lambert({ color: 0xf3d2c3 }));
  slotArm.position.set(0.22, 0.78, 0.02);
  slotArm.geometry.translate(0, -0.18, 0);
  slotRoot.add(slotArm);
  pad(slotRoot, 'spot', 1.6, 1.8, 1.6, 0.85);
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
  for (let i = 0; i < 2; i++) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 1.15, 5), lambert({ color: 0x8a6a3a }));
    rod.position.set(0.72 + i * 0.08, 0.7, -1.85);
    rod.rotation.z = 0.12;
    scene.add(rod);
  }
}
function cheebMap(which) {
  const pack = window.__cheebSheet;
  const img = pack && pack[which];
  if (!img || !img.complete || !img.naturalWidth) return null;
  if (!cheebTex[which]) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    cheebTex[which] = tex;
  }
  return cheebTex[which];
}
function buildCheeb() {
  cheebShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 14),
    new THREE.MeshBasicMaterial({ color: 0x1a100c, transparent: true, opacity: 0.32, depthWrite: false })
  );
  cheebShadow.rotation.x = -Math.PI / 2;
  cheebShadow.position.y = 0.015;
  scene.add(cheebShadow);
  cheebSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  cheebSprite.center.set(0.5, 0);
  cheebSprite.visible = false;
  cheebSprite.userData.home = 'cheeb';
  scene.add(cheebSprite);
  cheebPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.9, 0.36),
    new THREE.MeshBasicMaterial({ visible: false, depthWrite: false })
  );
  cheebPad.userData.home = 'cheeb';
  scene.add(cheebPad);
}
function stepCheeb(dt) {
  if (!cheebSprite) return;
  const map = cheebMap(CHEEB.view) || cheebMap('front') || cheebMap('back');
  if (!map) { cheebSprite.visible = false; if (cheebPad) cheebPad.visible = false; return; }
  cheebSprite.visible = true;
  if (cheebPad) cheebPad.visible = true;
  CHEEB.t += dt;
  if (CHEEB.tap > 0) CHEEB.tap = Math.max(0, CHEEB.tap - dt);
  else if (CHEEB.mode === 'walk') {
    CHEEB.u += dt / 3.4;
    if (CHEEB.u >= 1) {
      CHEEB.u = 1;
      CHEEB.mode = 'idle';
      CHEEB.idle = 0;
      CHEEB.view = CHEEB.view === 'front' ? 'back' : 'front';
    }
  } else {
    CHEEB.idle += dt;
    if (CHEEB.idle >= 0.9) {
      CHEEB.mode = 'walk';
      CHEEB.u = 0;
      CHEEB.leg = 1 - CHEEB.leg;
    }
  }
  const shown = cheebMap(CHEEB.view) || map;
  if (cheebSprite.material.map !== shown) {
    cheebSprite.material.map = shown;
    cheebSprite.material.needsUpdate = true;
  }
  const from = CHEEB.leg ? CHEEB_B : CHEEB_A;
  const to = CHEEB.leg ? CHEEB_A : CHEEB_B;
  const k = CHEEB.u * CHEEB.u * (3 - 2 * CHEEB.u);
  const x = from.x + (to.x - from.x) * k;
  const z = from.z + (to.z - from.z) * k;
  const walking = CHEEB.mode === 'walk' && CHEEB.tap <= 0;
  const hop = walking ? Math.abs(Math.sin(CHEEB.u * Math.PI * 8)) * 0.045 : 0;
  const rock = walking ? Math.sin(CHEEB.u * Math.PI * 6) * 0.18 : 0;
  const breath = 1 + Math.sin(CHEEB.t * 1.7) * 0.02;
  const tap = CHEEB.tap > 0 ? Math.sin((1 - CHEEB.tap / 0.45) * Math.PI) : 0;
  const h = 0.92;
  const aspect = shown.image && shown.image.naturalHeight ? shown.image.naturalWidth / shown.image.naturalHeight : 0.44;
  cheebSprite.position.set(x, hop, z);
  cheebSprite.scale.set(h * aspect * (1 + tap * 0.1), h * breath * (1 - tap * 0.14), 1);
  cheebSprite.material.rotation = rock + tap * 0.28;
  if (cheebShadow) {
    cheebShadow.position.set(x, 0.015, z);
    cheebShadow.visible = true;
  }
  if (cheebPad) cheebPad.position.set(x, 0.46, z);
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
const MOVES = [
  { id: 'homeIdle', clip: 'HomeIdle_Fire', when: 'idle', bondTier: 0 },
  { id: 'wave', clip: 'Wave', when: 'enter', bondTier: 0 },
  { id: 'tap', clip: 'TapReact', when: 'tap', bondTier: 0 },
  { id: 'sit', clip: 'Sit', when: 'fire', bondTier: 0, optional: true },
  { id: 'rare', clip: 'Victory', when: 'tap', bondTier: 2, rare: true, collect: 'first-ember-watch' },
];
const BOND_TIERS = [0, 8, 20, 40];
const CARD_TITLE = { 'first-ember-watch': 'First ember watch' };
const BOND_KEY = 'aro.home.gold.bond';
let bondMem = null;
const goldClips = {};

function tierFor(taps) {
  let tier = 0;
  for (let i = 0; i < BOND_TIERS.length; i++) if (taps >= BOND_TIERS[i]) tier = i;
  return tier;
}
function bondState() {
  if (!bondMem) {
    try { bondMem = JSON.parse(localStorage.getItem(BOND_KEY)); } catch (e) { bondMem = null; }
    if (!bondMem || typeof bondMem.taps !== 'number') bondMem = { taps: 0, tier: 0, collected: [] };
    if (!Array.isArray(bondMem.collected)) bondMem.collected = [];
    bondMem.tier = tierFor(bondMem.taps);
  }
  return bondMem;
}
function saveBond() {
  const b = bondState();
  b.tier = tierFor(b.taps);
  try { localStorage.setItem(BOND_KEY, JSON.stringify(b)); } catch (e) { /* private mode */ }
  if (window.__profile && window.__profile.noteBond) window.__profile.noteBond(b);
  renderBook(false);
  return b;
}
function pickMove(when, tier) {
  const open = MOVES.filter(m => m.when === when && tier >= (m.bondTier || 0));
  const fresh = open.filter(m => m.rare && m.collect && !bondState().collected.includes(m.collect));
  if (fresh.length) return fresh[0];
  const plain = open.filter(m => !m.rare);
  return plain[0] || open[0] || null;
}
function grantCard(id) {
  const b = bondState();
  if (!id || b.collected.includes(id)) return false;
  b.collected.push(id);
  saveBond();
  renderBook(true);
  return true;
}
function renderBook(open) {
  const list = document.getElementById('homeBookList');
  const panel = document.getElementById('homeBook');
  if (!list || !panel) return;
  const b = bondState();
  list.innerHTML = '';
  if (!b.collected.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No cards yet';
    list.appendChild(empty);
  }
  for (const id of b.collected) {
    const li = document.createElement('li');
    li.textContent = CARD_TITLE[id] || id;
    list.appendChild(li);
  }
  const note = document.getElementById('homeBondNote');
  if (note) note.textContent = 'Bond ' + b.taps + ' · tier ' + b.tier;
  const pins = document.getElementById('homePinList');
  if (pins) {
    pins.innerHTML = '';
    const saved = window.__world && window.__world.pins ? window.__world.pins() : [];
    if (!saved.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No pins yet';
      pins.appendChild(empty);
    }
    for (const pin of saved) {
      const li = document.createElement('li');
      li.textContent = pin.date + ' · ' + pin.weather + ' · ' + Number(pin.lat).toFixed(2) + ', ' + Number(pin.lon).toFixed(2);
      pins.appendChild(li);
    }
  }
  if (open) panel.classList.add('on');
}
function playGold(move, loop) {
  if (!move || !goldMixer || !goldClips[move.clip]) return false;
  const next = goldMixer.clipAction(goldClips[move.clip]);
  next.reset();
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  next.clampWhenFinished = !loop;
  next.enabled = true;
  if (goldAction && goldAction !== next) goldAction.fadeOut(0.25);
  next.fadeIn(0.25).play();
  goldAction = next;
  next._move = move;
  return true;
}
function onGoldFinished(e) {
  if (!goldAction || e.action !== goldAction) return;
  const move = e.action._move;
  if (move && move.collect) grantCard(move.collect);
  if (!move || move.when === 'idle') return;
  if (move.when === 'enter') {
    const sit = pickMove('fire', bondState().tier);
    if (sit) { playGold(sit, false); return; }
  }
  playGold(pickMove('idle', bondState().tier), true);
}
function goldEnter() {
  if (!goldReady) { HOME.greet = true; return; }
  HOME.greet = false;
  const wave = pickMove('enter', bondState().tier);
  if (!playGold(wave, false)) playGold(pickMove('idle', bondState().tier), true);
}
function goldTap() {
  const b = bondState();
  b.taps += 1;
  saveBond();
  const move = pickMove('tap', b.tier);
  if (playGold(move, false) && move && move.collect) grantCard(move.collect);
}
function meshHeight(root) {
  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    box.union(b);
    any = true;
  });
  if (!any || !isFinite(box.min.y)) return null;
  return box;
}
function fitGold(root) {
  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.rotation.set(0, 0, 0);
  const box = meshHeight(root);
  if (!box) return;
  const h = Math.max(0.001, box.max.y - box.min.y);
  const s = 1.2 / h;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const fitted = meshHeight(root);
  if (fitted) root.position.y -= fitted.min.y;
  root.rotation.y = 0;
}
const gltfLoader = new GLTFLoader();
function loadGltf(file) {
  return gltfLoader.loadAsync('assets/cabin/' + file);
}
function putProp(root, x, y, z, rot) {
  root.position.set(x, y, z);
  if (rot) root.rotation.y = rot;
  cabinRoot.add(root);
  applyToon(root);
  return root;
}
async function dressCabin() {
  try {
    const hearth = (await loadGltf('cabin_hearth.glb')).scene;
    putProp(hearth, 0.05, 0, -2.15, 0);
    const baked = hearth.getObjectByName('Flames');
    if (baked) baked.visible = false;
    putProp((await loadGltf('cabin_armchair.glb')).scene, 1.7, 0, -0.85, Math.PI);
    const nook = (await loadGltf('cooknook_counter.glb')).scene;
    putProp(nook, -2.35, 0, 0.15, Math.PI / 2);
    tag(nook, 'nook');
    const board = (await loadGltf('command_board.glb')).scene;
    putProp(board, 1.55, 0, 1.25, 0);
    tag(board, 'board');
    putProp((await loadGltf('cabin_rug.glb')).scene, 0.05, 0, -0.55, 0);
    putProp((await loadGltf('cabin_fluff.glb')).scene, -0.05, 0, -0.45, 0);
    const wallSrc = (await loadGltf('cabin_log_wall.glb')).scene;
    for (const x of [-2, 0, 2]) putProp(wallSrc.clone(true), x, 0, -2.55, 0);
    for (const z of [-2, 0, 2]) putProp(wallSrc.clone(true), -3.42, 0, z, Math.PI / 2);
    const beamSrc = (await loadGltf('cabin_beam.glb')).scene;
    for (const z of [-1.8, -0.6, 0.6, 1.6]) {
      for (const x of [-2, 0, 2]) putProp(beamSrc.clone(true), x, 2.52, z, 0);
    }
    const doorRoot = (await loadGltf('cabin_round_door.glb')).scene;
    shipDoor = doorRoot;
    doorRoot.position.set(3.32, 1.22, 0.15);
    doorRoot.rotation.y = -Math.PI / 2;
    cabinRoot.add(doorRoot);
    applyToon(doorRoot);
    const swinging = doorRoot.getObjectByName('Door');
    if (swinging && doorPivot) {
      doorPivot.attach(swinging);
      tag(swinging, 'door');
      shipLeaf = swinging;
    }
    const goldGltf = await loadGltf('gold_cabin.glb');
    goldRoot = goldGltf.scene;
    fitGold(goldRoot);
    applyToon(goldRoot, {
      thickness: 0.008,
      colorSnap: { Gold_Skin: 0xf0c090, Gold_Hair: 0xf2c14a, Gold_Suit_Gold: 0xe6b23c, Gold_Bow: 0xc4522a },
    });
    if (slotRoot) slotRoot.add(goldRoot);
    else cabinRoot.add(goldRoot);
    goldRoot.visible = HOME.slot === 'gold';
    if (slotPlane) slotPlane.visible = HOME.slot !== 'gold';
    goldMixer = new THREE.AnimationMixer(goldRoot);
    goldMixer.addEventListener('finished', onGoldFinished);
    for (const clip of goldGltf.animations) goldClips[clip.name] = clip;
    goldReady = true;
    HOME.dressed = true;
    if (HOME.on && HOME.greet !== false) goldEnter();
    else playGold(pickMove('idle', bondState().tier), true);
  } catch (err) {
    console.warn('cabin dress failed', err);
  }
}
function pad(parent, name, w, h, d, y) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false, depthWrite: false }));
  m.position.y = y;
  m.userData.pad = name;
  m.userData.home = name;
  parent.add(m);
}
function wrapCabin() {
  cabinRoot = new THREE.Group();
  cabinRoot.name = 'cabinRoot';
  scene.children.filter(ch => !ch.isAmbientLight).forEach(ch => cabinRoot.add(ch));
  scene.add(cabinRoot);
}
function resetPlacement() {
  if (!cabinRoot) return;
  cabinRoot.position.set(0, 0, 0);
  cabinRoot.quaternion.identity();
  cabinRoot.scale.setScalar(1);
}
function targets() {
  const out = {};
  if (!scene) return out;
  scene.traverse(o => {
    if (!o.userData || !o.userData.pad || !o.geometry || !o.geometry.parameters) return;
    const p = o.geometry.parameters;
    out[o.userData.pad] = Math.min(p.width, p.height);
  });
  return out;
}

/* Home is an AR object first, and a full-screen room second.
   Dollhouse: the whole cabin scales to 0.07 (about half a metre across) and a
   pinch on a detected plane sets it down. Portal: scale stays 1 and the round
   door, not the room centre, sits on that plane so the door is a way through
   in the real room. Both need immersive-ar plus hit-test. This browser check
   has neither, so start() records the reason and leaves the full-screen room. */
const DOLL_SCALE = 0.07;
const DOOR_LOCAL = new THREE.Vector3(3.32, 1.22, 0.15);
function arReason() {
  return 'WebXR immersive AR is not in this browser. The full-screen cabin stays.';
}
async function probeAr() {
  if (typeof navigator === 'undefined' || !navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') {
    return { available: false, reason: arReason() };
  }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-ar');
    if (!ok) return { available: false, reason: 'This browser has WebXR, but not immersive AR. The full-screen cabin stays.' };
  } catch (err) {
    return { available: false, reason: arReason() };
  }
  return { available: true, reason: '' };
}
function showArNote(text) {
  const n = document.getElementById('homeArNote');
  if (!n) return;
  n.textContent = text;
  n.classList.add('on');
}
function placeCabin(matrix) {
  const mode = HOME.ar.mode === 'portal' ? 'portal' : 'dollhouse';
  const s = mode === 'portal' ? 1 : DOLL_SCALE;
  cabinRoot.matrix.copy(matrix);
  cabinRoot.matrix.decompose(cabinRoot.position, cabinRoot.quaternion, cabinRoot.scale);
  cabinRoot.scale.setScalar(s);
  if (mode === 'portal') {
    const offset = DOOR_LOCAL.clone().applyQuaternion(cabinRoot.quaternion).multiplyScalar(s);
    cabinRoot.position.sub(offset);
  }
  HOME.ar.scale = s;
  HOME.ar.placed = true;
}
function onXRFrame(t, frame) {
  const now = t || performance.now();
  const dt = Math.min(0.05, (now - (HOME.xrNow || now)) / 1000) || 0.016;
  HOME.xrNow = now;
  if (frame && hitSource && !HOME.ar.placed && reticle) {
    const ref = renderer.xr.getReferenceSpace();
    const hits = ref ? frame.getHitTestResults(hitSource) : [];
    if (hits.length) {
      const pose = hits[0].getPose(ref);
      if (pose) {
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      }
    }
  }
  step(dt);
}
function endAr() {
  if (hitSource) { try { hitSource.cancel(); } catch (e) { /* already ended */ } hitSource = null; }
  if (reticle) reticle.visible = false;
  HOME.ar.active = false;
  HOME.ar.placed = false;
  if (renderer) {
    renderer.xr.enabled = false;
    renderer.setAnimationLoop(null);
    renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
  }
  resetPlacement();
  resize();
}
async function startAr(mode) {
  const picked = mode === 'portal' ? 'portal' : 'dollhouse';
  const found = await probeAr();
  HOME.ar = {
    active: false,
    stub: !found.available,
    mode: picked,
    placed: false,
    scale: picked === 'portal' ? 1 : DOLL_SCALE,
    reason: found.available ? '' : found.reason,
  };
  if (!found.available) {
    showArNote(found.reason + (picked === 'portal'
      ? ' On a phone this button places the round door on a detected surface.'
      : ' On a phone this button places the cabin as a tabletop dollhouse.'));
    resetPlacement();
    return Object.assign({}, HOME.ar);
  }
  if (!ensure()) {
    HOME.ar.stub = true;
    HOME.ar.reason = 'The cabin view is not ready, so AR did not start.';
    showArNote(HOME.ar.reason);
    return Object.assign({}, HOME.ar);
  }
  let session;
  try {
    const overlay = document.getElementById('homeHud');
    const opts = { requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor'] };
    if (overlay) { opts.optionalFeatures.push('dom-overlay'); opts.domOverlay = { root: overlay }; }
    session = await navigator.xr.requestSession('immersive-ar', opts);
  } catch (err) {
    HOME.ar.stub = true;
    HOME.ar.reason = 'The AR session did not start. The full-screen cabin stays.';
    showArNote(HOME.ar.reason);
    return Object.assign({}, HOME.ar);
  }
  try {
    renderer.setPixelRatio(1);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
    const viewer = await session.requestReferenceSpace('viewer');
    hitSource = await session.requestHitTestSource({ space: viewer });
  } catch (err) {
    try { session.end(); } catch (e) { /* session may already be closing */ }
    renderer.xr.enabled = false;
    HOME.ar.stub = true;
    HOME.ar.reason = 'Hit-test is missing, so the cabin cannot be placed. The full-screen cabin stays.';
    showArNote(HOME.ar.reason);
    return Object.assign({}, HOME.ar);
  }
  if (!reticle) {
    reticle = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 20), new THREE.MeshBasicMaterial({ color: 0xe2c48a }));
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
  }
  HOME.ar.active = true;
  HOME.ar.stub = false;
  session.addEventListener('select', () => { if (reticle && reticle.visible) placeCabin(reticle.matrix); });
  session.addEventListener('end', endAr);
  renderer.setAnimationLoop(onXRFrame);
  return Object.assign({}, HOME.ar);
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
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: /(?:^|[?&])shot3d=1/.test(location.search),
    });
  } catch (e) { return false; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
  camera = new THREE.PerspectiveCamera(48, 1, 0.08, 40);
  buildRoom();
  buildVisitor();
  buildArcade();
  resize();
  return true;
}
function buildVisitor() {
  visitor = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 8), new THREE.MeshBasicMaterial({ color: 0x6aa7d8 }));
  body.position.y = 0.55;
  visitor.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf0c09a }));
  head.position.y = 1.05;
  visitor.add(head);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.position.y = 1.45;
  sprite.scale.set(0.9, 0.18, 1);
  visitor.add(sprite);
  visitor.userData.canvas = canvas;
  visitor.userData.sprite = sprite;
  visitor.position.set(-1.15, 0, 0.15);
  visitor.visible = false;
  scene.add(visitor);
}
function syncVisitor() {
  if (!visitor) return;
  const pal = window.__profile && window.__profile.visitor && window.__profile.visitor();
  const show = !!(pal && HOME.on && (HOME.phase === 'inside' || HOME.phase === 'opening'));
  visitor.visible = show;
  paintHelpers();
  if (!show || visitor.userData.shown === pal.name) return;
  const ctx = visitor.userData.canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 48);
  ctx.fillStyle = '#fff6d4';
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(pal.name, 128, 34);
  visitor.userData.sprite.material.map.needsUpdate = true;
  visitor.userData.shown = pal.name;
}
function paintHelpers() {
  const host = document.getElementById('homeHelpers');
  if (!host || !window.__profile || !window.__profile.readyFriends) return;
  const list = window.__profile.readyFriends();
  const cur = window.__profile.visitor ? window.__profile.visitor() : null;
  const key = list.map(f => f.id + ':' + f.name).join(',') + '|' + (cur ? cur.id : '');
  if (host.dataset.key === key) return;
  host.dataset.key = key;
  host.innerHTML = '';
  if (!list.length) return;
  const tag = document.createElement('span');
  tag.textContent = 'At the fire';
  host.appendChild(tag);
  for (const f of list) {
    const b = document.createElement('button');
    b.type = 'button';
    const on = cur && cur.id === f.id;
    b.textContent = on ? f.name + ' · visiting' : f.name;
    if (on) b.className = 'on';
    b.onclick = () => { window.__profile.setHelper(f.id); };
    host.appendChild(b);
  }
}
function labelSprite(text, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff6d4';
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h * 0.7);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.userData.canvas = canvas;
  sprite.userData.ctx = ctx;
  return sprite;
}
function buildArcade() {
  const room = new THREE.Group();
  room.position.set(-7.4, 0, 0);
  const wood = new THREE.MeshBasicMaterial({ color: 0x6a4328 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 3.4), new THREE.MeshBasicMaterial({ color: 0x8a5a32 }));
  floor.position.y = 0.04;
  room.add(floor);
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.12), wood);
  back.position.set(0, 1.2, -1.6);
  room.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 3.4), wood);
  left.position.set(-2.05, 1.2, 0);
  room.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 3.4), wood);
  right.position.set(2.05, 1.2, 0);
  room.add(right);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 3.4), new THREE.MeshBasicMaterial({ color: 0x3a2618 }));
  ceil.position.set(0, 2.4, 0);
  room.add(ceil);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.4), new THREE.MeshBasicMaterial({ color: 0xc4a574 }));
  shelf.position.set(0, 1.35, -1.35);
  room.add(shelf);
  const prizes = [
    { id: 'sticker', name: 'Sticker 2', x: -0.78, color: 0x7ec8ff },
    { id: 'snack', name: 'Snack 3', x: 0, color: 0xffd36a },
    { id: 'trinket', name: 'Trinket 5', x: 0.78, color: 0xd7b4ff },
  ];
  prizes.forEach(p => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.32), new THREE.MeshBasicMaterial({ color: p.color }));
    box.position.set(p.x, 1.55, -1.35);
    tag(box, 'prize:' + p.id);
    room.add(box);
    const s = labelSprite(p.name, 256, 48);
    s.position.set(p.x, 1.9, -1.3);
    s.scale.set(0.58, 0.14, 1);
    room.add(s);
  });
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), new THREE.MeshBasicMaterial({ color: 0x4a3020 }));
  table.position.set(0, 0.35, 0.15);
  room.add(table);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.7), new THREE.MeshBasicMaterial({ color: 0x2a1a14 }));
  top.position.set(0, 0.72, 0.15);
  room.add(top);
  const strike = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.28), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  strike.position.set(0, 0.8, 0.15);
  tag(strike, 'arcade-strike');
  room.add(strike);
  const prize = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.24), new THREE.MeshBasicMaterial({ color: 0x7ec8ff }));
  prize.position.set(0.42, 0.86, 0.05);
  prize.visible = false;
  room.add(prize);
  const prizeLabel = labelSprite('Sticker', 256, 48);
  prizeLabel.position.set(0.42, 1.08, 0.05);
  prizeLabel.scale.set(0.5, 0.12, 1);
  prizeLabel.visible = false;
  room.add(prizeLabel);
  HOME.prize = prize;
  HOME.prizeLabel = prizeLabel;
  const board = labelSprite('Pet board', 256, 48);
  board.position.set(0, 1.05, 0.15);
  board.scale.set(0.8, 0.18, 1);
  board.name = 'arcadeLog';
  room.add(board);
  room.userData.log = board;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.08), new THREE.MeshBasicMaterial({ color: 0x8d5a32 }));
  door.position.set(-1.9, 0.7, 0.4);
  tag(door, 'arcade-out');
  room.add(door);
  const out = labelSprite('Step out', 256, 48);
  out.position.set(-1.9, 1.5, 0.4);
  out.scale.set(0.7, 0.16, 1);
  room.add(out);
  scene.add(room);
  HOME.arcadeRoom = room;
}
function enterArcade() {
  if (!ensure()) return false;
  HOME.phase = 'arcade';
  camera.position.set(-7.4, 1.85, 4.2);
  camera.lookAt(-7.4, 1.15, 0);
  show(true);
  refreshPrize();
  return true;
}
function refreshPrize() {
  const prize = HOME.prize, label = HOME.prizeLabel;
  if (!prize) return false;
  const list = window.__profile && window.__profile.get ? window.__profile.get().prizes : [];
  const name = list && list[0];
  prize.visible = !!name;
  if (label) label.visible = !!name;
  if (!name) return false;
  const color = /trinket/i.test(name) ? 0xd7b4ff : /snack/i.test(name) ? 0xffd36a : 0x7ec8ff;
  prize.material.color.setHex(color);
  if (label && label.userData.ctx) {
    const ctx = label.userData.ctx, canvas = label.userData.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff6d4';
    ctx.font = '700 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, canvas.width / 2, canvas.height * 0.7);
    label.material.map.needsUpdate = true;
  }
  return true;
}
function leaveArcade() {
  HOME.phase = 'inside';
  heroCamera();
  applyOrbit();
  show(true);
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
  document.body.classList.toggle('arcade-in', HOME.phase === 'arcade');
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
  syncVisitor();
  if (goldMixer) goldMixer.update(dt);
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
    if (HOME.ride >= 1 && HOME.phase === 'through') openDoorPortrait();
    if (HOME.ride >= 1 && HOME.phase === 'return') { HOME.phase = 'inside'; HOME.doorTo = 0; }
  } else if ((HOME.phase === 'inside' || HOME.phase === 'opening') && !HOME.ar.active) applyOrbit();
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
  stepCheeb(dt);
  if (slotRoot) {
    const hop = HOME.bounce > 0 ? Math.sin(HOME.bounce * Math.PI) : 0;
    slotRoot.position.y = hop * 0.16;
    slotRoot.scale.y = (HOME.slot === 'cheeb' ? 0.82 : 1) * (1 - hop * 0.08);
    if (slotArm) slotArm.rotation.z = -hop * 1.15;
    if (HOME.bounce > 0) HOME.bounce = Math.max(0, HOME.bounce - dt * 1.35);
  }
  paintSky(HOME.t * 0.15);
  syncCabinPlates();
  if (HOME.sound) {
    HOME.nextCrackle -= dt;
    if (HOME.nextCrackle <= 0) { crackle(); HOME.nextCrackle = 0.05 + Math.random() * 0.14; }
  }
  renderer.render(scene, camera);
}
function loop(now) {
  requestAnimationFrame(loop);
  if (HOME.ar.active || !HOME.on || HOME.phase === 'fishing') return;
  const dt = Math.min(0.05, (now - (loop.then || now)) / 1000);
  loop.then = now;
  step(dt || 0.016);
}
const DOOR_ROOMS = [
  { id: 'out', name: 'Step out', hint: 'The real map' },
  { id: 'garden', name: 'Home garden', hint: 'Lily pond' },
  { id: 'pond', name: 'Fishing pond', hint: 'Beside the ship' },
  { id: 'Town', name: 'Town', hint: 'Already on the map' },
  { id: 'Market', name: 'Market', hint: 'Already on the map' },
  { id: 'Dock', name: 'Dock', hint: 'Already on the map' },
];
function ensureDoorPortrait() {
  let el = document.getElementById('doorRooms');
  if (el) return el;
  const style = document.createElement('style');
  style.textContent = '#doorRooms{position:fixed;inset:0;z-index:48;display:none;align-items:flex-end;justify-content:center;pointer-events:none}#doorRooms.on{display:flex}#doorRooms .sheet{pointer-events:auto;width:min(280px,calc(100% - 20px));max-height:min(78vh,640px);margin:0 0 10px;overflow:auto;padding:12px 14px 16px;border-radius:22px 22px 16px 16px;background:linear-gradient(180deg,#3a2048,#140c18);border:1px solid rgba(255,214,160,.7);color:#fff6e4;box-shadow:0 16px 40px rgba(0,0,0,.45)}#doorRooms .sh-h{display:flex;align-items:center;gap:8px}#doorRooms small{display:block;color:#ffd978;font:800 11px sans-serif;letter-spacing:.04em}#doorRooms h2{margin:0;font:800 18px ui-rounded,system-ui}#doorRooms .x{margin-left:auto}#doorRooms .hint{margin:8px 0;color:#f6e2c4;font:600 13px/1.35 sans-serif}#doorRooms button.room{display:block;width:100%;min-height:48px;margin:6px 0 0;padding:8px 10px;text-align:left;border-radius:12px;border:1px solid rgba(190,230,255,.45);background:rgba(18,28,48,.88);color:#f4fbff;font:800 15px ui-rounded,system-ui}#doorRooms button.room small{color:#9ad7ff;font:700 11px sans-serif}';
  document.head.appendChild(style);
  el = document.createElement('div');
  el.id = 'doorRooms';
  el.innerHTML = '<div class="sheet"><div class="sh-h"><div><small>Ship door</small><h2>Step through</h2></div><button type="button" class="x" id="doorRoomsClose" aria-label="Close">×</button></div><p class="hint">Step out onto the map, or into a room you already have. This door does not roam the wild.</p><div id="doorRoomList"></div></div>';
  document.body.appendChild(el);
  document.getElementById('doorRoomsClose').onclick = () => closeDoorPortrait();
  return el;
}
function paintDoorRooms() {
  const host = document.getElementById('doorRoomList');
  if (!host) return;
  host.innerHTML = '';
  DOOR_ROOMS.forEach(room => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'room';
    b.dataset.room = room.id;
    b.innerHTML = room.name + '<br><small>' + room.hint + '</small>';
    b.onclick = () => chooseDoor(room.id);
    host.appendChild(b);
  });
}
function openDoorPortrait() {
  HOME.phase = 'portrait';
  const el = ensureDoorPortrait();
  paintDoorRooms();
  el.classList.add('on');
}
function closeDoorPortrait() {
  const el = document.getElementById('doorRooms');
  if (el) el.classList.remove('on');
  if (HOME.phase === 'portrait') { HOME.phase = 'inside'; HOME.doorTo = 0; }
}
function afterDoor(label, then) {
  const go = () => { leave(); if (then) then(); };
  if (window.__doorClear) window.__doorClear(label, go);
  else go();
}
function chooseDoor(id) {
  const el = document.getElementById('doorRooms');
  if (el) el.classList.remove('on');
  if (id === 'out') {
    afterDoor('Outside', () => { if (window.__showWorldMap) window.__showWorldMap(); });
    return true;
  }
  if (id === 'garden') {
    afterDoor('Home garden', () => {
      if (window.__showWorldMap) window.__showWorldMap();
      if (typeof enterGarden === 'function') enterGarden();
    });
    return true;
  }
  if (id === 'pond') { beginFishing(); return true; }
  const place = DOOR_ROOMS.find(r => r.id === id);
  if (place && typeof enterDiscArea === 'function') {
    afterDoor(place.name, () => {
      if (window.__showWorldMap) window.__showWorldMap();
      enterDiscArea({ name: place.name, q: 0, r: 0, x: 0, y: 0 });
    });
    return true;
  }
  return false;
}
function beginFishing() {
  HOME.phase = 'fishing';
  show(false);
  document.body.classList.remove('home-in');
  const back = document.getElementById('homeDoorBack');
  if (back) { back.textContent = 'Door home'; back.classList.add('on'); }
  if (typeof openFish === 'function') openFish();
}
function fishFromNook() {
  if (typeof closeModal === 'function') closeModal('craftM');
  HOME.phase = 'fishing';
  show(false);
  document.body.classList.remove('home-in');
  const back = document.getElementById('homeDoorBack');
  if (back) { back.textContent = 'Back to crafting'; back.classList.add('on'); }
  if (typeof window.__showWorldMap === 'function') window.__showWorldMap();
  if (typeof tileAt === 'function' && typeof MAP !== 'undefined') {
    const home = tileAt(0, 0);
    if (home) {
      MAP.house.q = home.q; MAP.house.r = home.r;
      MAP.house.x = home.x; MAP.house.y = home.y;
      MAP.house.mode = 'park';
      MAP.avOut = true;
    }
  }
  if (typeof openFish === 'function') openFish({ nook: true });
  return true;
}
function enter() {
  if (!ensure()) return false;
  resetPlacement();
  if (!HOME.ar.active) {
    HOME.ar.scale = 1;
    HOME.ar.placed = false;
    HOME.ar.mode = 'screen';
  }
  heroCamera();
  HOME.phase = 'inside';
  HOME.door = 0; HOME.doorTo = 0; HOME.ride = 0;
  const rooms = document.getElementById('doorRooms');
  if (rooms) rooms.classList.remove('on');
  if (doorPivot) doorPivot.rotation.y = 0;
  show(true);
  const back = document.getElementById('homeDoorBack');
  if (back) back.classList.remove('on');
  applyOrbit();
  syncCabinPlates();
  renderer.render(scene, camera);
  goldEnter();
  if (HOME.paintLoadout) HOME.paintLoadout();
  if (window.__guideBeat) window.__guideBeat('home');
  if (window.__paintGuide) window.__paintGuide();
  return true;
}
function goOutside() {
  const step = window.__profile && window.__profile.guide && window.__profile.guide();
  leave();
  if (window.__openGuideMap) window.__openGuideMap();
  else if (window.__showWorldMap) window.__showWorldMap();
  if (step === 'out' && window.__guideBeat) window.__guideBeat('out');
}
function leave() {
  HOME.on = false; HOME.phase = 'inside';
  const rooms = document.getElementById('doorRooms');
  if (rooms) rooms.classList.remove('on');
  show(false);
  const back = document.getElementById('homeDoorBack');
  if (back) back.classList.remove('on');
}
function paintArcade(text) {
  const log = HOME.arcadeRoom && HOME.arcadeRoom.userData.log;
  if (!log) return;
  const ctx = log.userData.ctx;
  const canvas = log.userData.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff6d4';
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height * 0.7);
  log.material.map.needsUpdate = true;
}
function activate(name) {
  if (name === 'nook' && typeof openCraft === 'function') { openCraft(); return true; }
  if (name === 'board' && typeof openCommand === 'function') { openCommand(); return true; }
  if (name === 'spot') { HOME.bounce = 1; goldTap(); return true; }
  if (name === 'cheeb') { CHEEB.tap = 0.45; return true; }
  if (name === 'door') {
    if (HOME.fromField) {
      HOME.fromField = false;
      if (window.__doorClear) window.__doorClear('Outside', () => {
        leave();
        if (window.__showWorldMap) window.__showWorldMap();
      });
      else { leave(); if (window.__showWorldMap) window.__showWorldMap(); }
      return true;
    }
    if (HOME.phase !== 'inside' && HOME.phase !== 'opening') return false;
    HOME.phase = 'opening'; HOME.doorTo = 1; return true;
  }
  if (name === 'arcade-out') { leaveArcade(); return true; }
  if (name && name.indexOf('prize:') === 0 && window.__profile && window.__profile.takePrize) {
    const ok = window.__profile.takePrize(name.slice(6));
    paintArcade(ok ? 'Taken' : 'Need tokens');
    return true;
  }
  if (name === 'arcade-strike' && window.__profile && window.__profile.boardStrike) {
    const r = window.__profile.boardStrike();
    paintArcade(r.win ? 'Win · +3 xp' : r.reason === 'ko' ? 'Pet is tired' : 'Strike 2');
    return true;
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
  if (back) { back.textContent = 'Door home'; back.classList.remove('on'); }
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
  if (slotPlane) slotPlane.visible = kind !== 'gold';
  if (slotArm) slotArm.visible = kind !== 'gold';
  if (goldRoot) goldRoot.visible = kind === 'gold';
  if (slotRoot) slotRoot.scale.set(1, kind === 'cheeb' ? 0.82 : 1, 1);
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
  if (HOME.ar.active || !ptr.drag || (HOME.phase !== 'inside' && HOME.phase !== 'opening')) return;
  HOME.yaw -= dx * 0.005;
  HOME.pitch = Math.max(0.08, Math.min(0.62, HOME.pitch + dy * 0.003));
  ptr.x = e.clientX; ptr.y = e.clientY;
}
function onUp(e) {
  if (ptr.id !== e.pointerId) return;
  const was = ptr.drag;
  ptr.id = null;
  if (!was && (HOME.phase === 'inside' || HOME.phase === 'opening' || HOME.phase === 'arcade')) activate(hitName(e.clientX, e.clientY));
}

function mount() {
  const style = document.createElement('style');
  style.textContent = [
    '#homeCv{position:fixed;inset:0;z-index:18;display:none;touch-action:none;width:100%;height:100%}',
    'body.home-in #homeCv{display:block}',
    'body.home-in #mapNav,body.home-in #act,body.home-in #menuBtn,body.home-in #obj,body.home-in #coach,body.home-in #wirePanel,body.home-in #charBtn,body.home-in #title{visibility:hidden!important}',
    '#homeHud{position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:19;display:none;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none}',
    'body.cabin-plate #homeHud{top:auto;bottom:calc(8px + env(safe-area-inset-bottom,0px));max-height:30vh}',
    '#homeHud.on{display:flex}',
    '#homeHudRow{display:flex;flex-wrap:wrap;gap:8px}',
    '#homeHud button,#homeDoorBack{pointer-events:auto;min-height:48px;min-width:48px;padding:10px 14px;border-radius:12px;font:800 15px sans-serif;background:rgba(42,24,16,.82);border:1px solid rgba(226,196,138,.7);color:#f6e2c4}',
    '#homeHud button.on{outline:2px solid #ffd36a}',
    '#homeLoadout{display:flex;flex-wrap:wrap;gap:6px;max-width:100%}',
    '#homeLoadout button.on{outline:2px solid #9dffc8}',
    '#homeHelpers{display:flex;flex-wrap:wrap;gap:6px;max-width:100%;align-items:center}',
    '#homeHelpers span{pointer-events:none;color:#f6e2c4;font:800 13px sans-serif;background:rgba(42,24,16,.82);border-radius:12px;padding:8px 10px}',
    '#homeHelpers button.on{outline:2px solid #9ecbff}',
    '#homeArNote{display:none;margin:0;max-width:34rem;padding:10px 12px;border-radius:12px;background:rgba(42,24,16,.9);color:#f6e2c4;font:600 15px/1.35 sans-serif}',
    '#homeArNote.on{display:block}',
    '#homeBook{display:none;margin:0;max-width:16rem;padding:10px 12px;border-radius:12px;background:rgba(42,24,16,.92);color:#f6e2c4}',
    '#homeBook.on{display:block}',
    '#homeBook ul{margin:6px 0 0;padding-left:18px}',
    '#homeDoorBack{position:fixed;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:45;display:none}',
    '#homeDoorBack.on{display:block}',
    '#homeArcadeOut{display:none}',
    'body.home-in.arcade-in #homeArcadeOut{display:inline-block}',
  ].join('');
  document.head.appendChild(style);
  const canvas = document.createElement('canvas');
  canvas.id = 'homeCv';
  document.body.appendChild(canvas);
  const hud = document.createElement('div');
  hud.id = 'homeHud';
  hud.innerHTML = '<div id="homeHudRow"><button type="button" id="homeCrackle" aria-pressed="false">Fire sound off</button><button type="button" id="homeTable">Place on a table</button><button type="button" id="homePortal">Place the door</button><button type="button" id="homeBookBtn">Collection</button><button type="button" id="homeArcade">Arcade</button><button type="button" id="homeArcadeOut">Step out</button><button type="button" id="homeBoard">Pet board</button><button type="button" id="homeMage">Mage</button><button type="button" id="homeGun">Gunner</button><button type="button" id="homeOutside" title="Opens the world map.">Outside</button><button type="button" id="homePin">Pin this world</button></div><div id="homeHelpers"></div><div id="homeLoadout"></div><p id="homeArNote"></p><div id="homeBook"><b>Collection</b><p id="homeBondNote"></p><ul id="homeBookList"></ul><b>Pins</b><ul id="homePinList"></ul></div>';
  document.body.appendChild(hud);
  const back = document.createElement('button');
  back.id = 'homeDoorBack'; back.type = 'button'; back.textContent = 'Door home';
  document.body.appendChild(back);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', e => {
    if (!HOME.on) return;
    HOME.radius = Math.max(1.05, Math.min(4.8, HOME.radius + Math.sign(e.deltaY) * 0.15));
  }, { passive: true });
  document.getElementById('homeCrackle').onclick = () => setSound(!HOME.sound);
  document.getElementById('homeTable').onclick = () => startAr('dollhouse');
  document.getElementById('homePortal').onclick = () => startAr('portal');
  document.getElementById('homeOutside').onclick = () => goOutside();
  document.getElementById('homePin').onclick = () => { if (window.__world && window.__world.pin) { window.__world.pin(); renderBook(true); } };
  document.getElementById('homeBookBtn').onclick = () => {
    renderBook(false);
    if (window.__profile && window.__profile.openBook) window.__profile.openBook('pins');
    else document.getElementById('homeBook').classList.toggle('on');
  };
  document.getElementById('homeArcade').onclick = () => { if (window.__home && window.__home.enterArcade) window.__home.enterArcade(); };
  document.getElementById('homeArcadeOut').onclick = () => { if (window.__home && window.__home.leaveArcade) window.__home.leaveArcade(); };
  document.getElementById('homeBoard').onclick = () => { if (window.__profile && window.__profile.openBoard) window.__profile.openBoard(); };
  const pickClass = (c) => {
    if (window.__profile && window.__profile.setClass) window.__profile.setClass(c);
    if (window.__train && window.__train.setClass) window.__train.setClass(c);
    document.getElementById('homeMage').classList.toggle('on', c === 'mage');
    document.getElementById('homeGun').classList.toggle('on', c === 'gunner');
    const note = document.getElementById('homeArNote');
    if (note) {
      note.textContent = (c === 'gunner' ? 'Gunner' : 'Mage') + ' saved. Swap the wheel below.';
      note.classList.add('on');
    }
    paintLoadout();
    if (window.__guideBeat) window.__guideBeat('class');
  };
  function paintLoadout() {
    const host = document.getElementById('homeLoadout');
    if (!host || !window.__profile || !window.__profile.loadout) return;
    const cls = window.__profile.get().cls === 'gunner' ? 'gunner' : 'mage';
    const names = cls === 'gunner'
      ? { shot: 'Shot', frag: 'Frag', turret: 'Turret', drone: 'Drone', flare: 'Flare' }
      : { ember: 'Ember', frost: 'Frost', nova: 'Nova', iceberg: 'Iceberg', slash: 'Slash', ward: 'Ward' };
    const on = window.__profile.loadout(cls);
    host.innerHTML = '';
    Object.keys(names).forEach(id => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = names[id];
      b.classList.toggle('on', on.indexOf(id) >= 0);
      b.onclick = () => { window.__profile.toggleLoadout(cls, id); paintLoadout(); if (window.__train && window.__train.syncWheel) window.__train.syncWheel(); };
      host.appendChild(b);
    });
  }
  HOME.paintLoadout = paintLoadout;
  document.getElementById('homeMage').onclick = () => pickClass('mage');
  document.getElementById('homeGun').onclick = () => pickClass('gunner');
  back.onclick = () => backHome();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
}
function boot() {
  mount();
  window.__home = {
    enter, leave, activate, back: backHome, pose, step, setSound, setSlot, hitName, targets,
    ar: { probe: probeAr, start: startAr },
    covers: () => HOME.on && HOME.phase !== 'fishing',
    refreshBook: () => renderBook(false),
    goOutside, enterArcade, leaveArcade, fishFromNook, refreshPrize, syncVisitor,
    doorRooms: () => DOOR_ROOMS.map(r => ({ id: r.id, name: r.name })),
    doorPlate: { state: () => syncCabinPlates().door, face: faceDoor },
    roomPlate: { state: () => syncCabinPlates().room, face: faceRoom },
    chooseDoor, openDoor: openDoorPortrait, closeDoor: closeDoorPortrait,
    markFromField: () => { HOME.fromField = true; },
    bond: () => { const b = bondState(); return { taps: b.taps, tier: b.tier, collected: b.collected.slice() }; },
    collection: () => bondState().collected.map(id => ({ id, title: CARD_TITLE[id] || id })),
    state: () => ({ on: HOME.on, phase: HOME.phase, door: HOME.door, bounce: HOME.bounce, sound: HOME.sound, slot: HOME.slot, yaw: HOME.yaw, dressed: !!HOME.dressed, ar: Object.assign({}, HOME.ar), cheeb: cheebSprite ? { x: cheebSprite.position.x, z: cheebSprite.position.z, view: CHEEB.view, on: cheebSprite.visible, tap: CHEEB.tap, rock: cheebSprite.material.rotation } : null }),
  };
  window.__homeCovers = () => window.__home.covers();
  const guideStep = window.__profile && window.__profile.guide && window.__profile.guide();
  if (guideStep && guideStep !== 'done' && !(window.__train && window.__train.TRAIN && window.__train.TRAIN.on)) enter();
  window.__homeCommandExtra = list => {
    const sheet = list && list.closest ? list.closest('.sheet') : null;
    if (!sheet) return;
    if (!sheet.querySelector('[data-friend-quests]')) {
      const d = document.createElement('div');
      d.dataset.friendQuests = '1';
      d.className = 'hint';
      d.innerHTML = '<b>Friend quests</b><br>Placeholder. Friends are not out yet.';
      const head = sheet.querySelector('.sh-h');
      if (head) head.after(d); else list.insertBefore(d, list.firstChild);
    }
    let box = sheet.querySelector('[data-daily-quests]');
    if (!box) {
      box = document.createElement('div');
      box.dataset.dailyQuests = '1';
      box.className = 'hint';
      const friend = sheet.querySelector('[data-friend-quests]');
      if (friend) friend.after(box);
      else list.insertBefore(box, list.firstChild);
    }
    box.innerHTML = '';
    const title = document.createElement('b');
    title.textContent = 'Daily quests';
    box.appendChild(title);
    const rows = window.__profile && window.__profile.quests ? window.__profile.quests() : [];
    rows.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button';
      const pay = q.coins + ' coins' + (q.tokens ? ' · ' + q.tokens + ' tokens' : '');
      b.textContent = q.name + ' · ' + Math.min(q.have, q.need) + '/' + q.need + ' · ' + (q.claimed ? 'Claimed' : pay);
      b.disabled = !(q.have >= q.need && !q.claimed);
      b.onclick = () => {
        if (window.__profile.claimQuest(q.id)) renderCommand();
      };
      box.appendChild(b);
    });
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
