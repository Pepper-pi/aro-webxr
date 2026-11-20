// Magic: a meadow, seen through the eyes of whoever is walking in it, staff in hand.
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and films)
//   ?patch-test=1  as Patch's test opens it: it begins by itself once loaded, never pauses, and reads no controller
//   ?nostaff       the staff is not drawn
//   ?marks         a burnt patch and a frozen one by the start
//   ?noruin        no ruin (the thing there is to break), and so no physics
import * as THREE from 'three';
import { createAir, SUN } from './air.js';
import { createWorld } from './meadow/world.js';
import { createStaff } from './staff.js';
import { createCastDisc } from './castdisc.js';
import { createPage } from './page.js';
import { Walker } from './player.js';
import { Input } from './input.js';
import { createFx } from './fx.js';
import { createFire } from './fire.js';
import { createFlames } from './flames.js';
import { createBeam } from './beam.js';
import { createRuin } from './ruin.js';
import { createBlast } from './blast.js';
import { createHole } from './hole.js';
import { createTwister } from './twister.js';
import { createSpells, SPELLS } from './spells.js';
import { createQuest } from './quest.js';
import { createSound } from './sound.js';
import { spellBar } from './hud.js';
import { createZones } from './zones.js';
import { useRenderer } from './beasts.js';
import { createArms } from './arms.js';
import { TUNE } from './rider.js';
import { createBlade } from './blade.js';
import { attachFells } from './fells.js';
import { createGunner } from './gunner.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture'), testing = q.has('patch-test');
if (q.has('shot')) document.body.classList.add('shot');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
const loading = document.getElementById('loading');
// The cover is over everything while the meadow is made, and until they begin.
const title = document.getElementById('title'), bar = document.getElementById('sigil');
if (capture) title?.remove();
let shown = true, loaded = false, told = 0.02, begun = capture, paused = false;
const say = (text) => { told = Math.min(0.95, told + 0.1); if (loading) loading.textContent = text; bar?.style.setProperty('--p', told); };
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
useRenderer(renderer);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, phone ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.shadowMap.enabled = !phone;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('view').appendChild(renderer.domElement);
// Listened for from the start, not once loaded: the page may go fullscreen while the world is still being made.
const fitting = [];
let fitW = 0, fitH = 0;
function fitView() {
  fitW = innerWidth; fitH = innerHeight;
  const now = renderer.getSize(new THREE.Vector2());
  if (now.x !== innerWidth || now.y !== innerHeight) renderer.setSize(innerWidth, innerHeight);
  for (const fit of fitting) fit();
}
addEventListener('resize', fitView);

const scene = new THREE.Scene();
lap('start');
const air = createAir();
const world = await createWorld({ air, renderer, scene, say, turn });
attachFells(world, air);
const camera = new THREE.PerspectiveCamera(world.fov, innerWidth / innerHeight, 0.12, world.far);
fitting.push(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
// ?marks: a burnt patch and a frozen one by the start, to see that the ground takes what magic will write to it
if (q.has('marks')) { world.mark(-5, 27, 4.5, 0, 1); world.mark(5.5, 26, 4.5, 1, 1); }
lap('world');

say('Taking up the staff');
await turn();
const walker = new Walker(world);
const staff = q.has('nostaff') ? null : createStaff({ air, atlas: world.atlas });
const castDisc = createCastDisc(scene);
let discOn = true;
let discCharge = false;
if (staff) { staff.resize(innerWidth / innerHeight); fitting.push(() => staff.resize(innerWidth / innerHeight)); }
const input = new Input(renderer.domElement, { pads: !capture && !testing && !q.has('nopad') });
const touchUi = document.getElementById('touch');
if (touchUi && (phone || navigator.maxTouchPoints > 0)) { touchUi.hidden = false; input.bindTouch(touchUi); }
const post = createPage(renderer);
// magic: what is seen of it in the air, the fire that spreads by itself, and the spells
const fx = createFx(air);
scene.add(fx.group);
// things to break: what is built in the meadow, standing on Patch's destruction physics. Where there is no WebGPU, none.
// (They are raised before the fire is made: nothing grows through their paving, so nothing burns there.)
say('Raising the walls');
await turn();
const ruin = (q.has('noruin') || phone) ? null : await createRuin({ air, meadow: world, scene, fx, say, turn }).catch((e) => { console.warn('no buildings:', e); return null; });
if (ruin) world.blockers = (f) => ruin.block(f);
lap('ruin');
const flames = createFlames(air);
scene.add(flames.mesh);
const fire = createFire({ world, air, fx, flames });
const zones = createZones({ scene, world, walker, camera, air });
const BLADE_ATK = [
  { key: 'pound', name: 'Pound', colour: '#c4a574', sides: 4 },
  { key: 'spin', name: 'Spin', colour: '#7ec8ff', sides: 6 },
  { key: 'rush', name: 'Sky Rush', colour: '#3ee0ff', sides: 5 },
  { key: 'block', name: 'Block', colour: '#9fd4ff', sides: 4 },
  { key: 'slice', name: 'Slice', colour: '#3ee0ff', sides: 3 },
];
const GUN_ATK = [
  { key: 'bolt', name: 'Fire', colour: '#ffb043', sides: 4 },
  { key: 'nade', name: 'Grenade', colour: '#9ee7ff', sides: 5 },
];
const spellsBar = spellBar(document.getElementById('spells'), SPELLS, 'ui/', { ring: true, onPick: (i) => spells?.select(i) });
let kitBar = spellsBar;
let kit = 'mage';
let atk = 0;
function applyKit(next) {
  const want = next === 'blade' || next === 'gunner' ? next : 'mage';
  if (want === kit) return;
  kit = want;
  atk = 0;
  const box = document.getElementById('spells');
  const spellBtn = document.getElementById('spell');
  const castBtn = document.getElementById('cast');
  if (want === 'mage') {
    kitBar = spellBar(box, SPELLS, 'ui/', { ring: true, onPick: (i) => spells?.select(i) });
    kitBar.select(spells?.selected ?? 0);
    if (spellBtn) spellBtn.textContent = 'Spell';
    if (castBtn) castBtn.textContent = 'Cast';
    return;
  }
  kitBar = spellBar(box, want === 'blade' ? BLADE_ATK : GUN_ATK);
  kitBar.select(0);
  if (spellBtn) spellBtn.textContent = 'Attacks';
  if (castBtn) castBtn.textContent = 'Use';
}
function useAttack(which, index, down) {
  if (which === 'gunner') {
    if (!down) return;
    if (index === 1) gun.toss(); else gun.fire();
    return;
  }
  const key = BLADE_ATK[index]?.key;
  if (key === 'pound') { if (down) blade.poundStart(); else blade.poundRelease(); }
  else if (down && key === 'spin') blade.spin();
  else if (down && key === 'rush') blade.tryRush();
  else if (key === 'block') blade.setBlock(down);
  else if (down && key === 'slice') blade.cut();
}
const beam = createBeam(air);
scene.add(beam.mesh);
const blast = createBlast({ air, world, fx, fire, ruin, scene });
const hole = createHole({ air, world, fx, fire, ruin, scene });
const twister = createTwister({ air, world, fx, fire, ruin, scene });
const spells = staff ? createSpells({ world, air, fx, fire, staff, beam, ruin, blast, hole, twister, camera, walker, dom: renderer.domElement, onSelect: (i) => { if (kit === 'mage') kitBar.select(i); } }) : null;
const quest = createQuest({ walker, zones, spells });
spellsBar.select(spells?.selected ?? 0);
const discToggle = document.getElementById('discToggle');
discToggle?.addEventListener('pointerup', (e) => {
  discOn = !discOn;
  discToggle.textContent = discOn ? 'Disc' : 'List';
  e.preventDefault();
  e.stopPropagation();
});
let discSpin = null;
let discX = 0;
const discAt = (e) => {
  const s = castDisc?.screen;
  if (!s?.on) return { dx: 0, dy: 0, r: 1, R: 1, hit: false };
  const dx = e.clientX - s.x, dy = e.clientY - s.y, r = Math.hypot(dx, dy);
  return { dx, dy, r, R: s.r, hit: r <= s.r * 1.15 };
};
addEventListener('pointerdown', (e) => {
  if (!discOn || kit !== 'mage' || !spells) return;
  const at = discAt(e);
  if (!at.hit) return;
  e.preventDefault();
  e.stopPropagation();
  discX = e.clientX;
  if (at.r > at.R * 0.38) {
    discSpin = { a: Math.atan2(at.dy, at.dx), i: spells.selected };
  } else {
    discCharge = true;
    spells.press();
  }
}, true);
addEventListener('pointermove', (e) => {
  if (!spells) return;
  if (discCharge && Math.abs(e.clientX - discX) > 22 && (spells.cast?.charge || 0) < 0.2) {
    spells.cancel();
    discCharge = false;
    const at = discAt(e);
    discSpin = { a: Math.atan2(at.dy, at.dx), i: spells.selected };
  }
  if (!discSpin) return;
  const at = discAt(e);
  let d = Math.atan2(at.dy, at.dx) - discSpin.a;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  const step = Math.round(d / (Math.PI * 2 / 7));
  const next = (discSpin.i - step + 70) % 7;
  if (next !== spells.selected) spells.select(next);
}, true);
const endDisc = () => {
  if (discCharge && spells) spells.release();
  discCharge = false;
  discSpin = null;
};
addEventListener('pointerup', endDisc, true);
addEventListener('pointercancel', endDisc, true);
fitting.push(() => post.resize());
lap('staff');

// Sound. A film of the game is made with no clock and no sound card: then the sound is worked out alongside, frame by
// frame, only when it is asked for (?capture&sound=<seconds>).
let sound = null;
try { sound = q.has('nosound') || (capture && !q.get('sound')) ? null : createSound({ offline: capture ? Number(q.get('sound')) : 0 }); }
catch (e) { console.warn('no sound', e); }
if (sound && !capture) {
  for (const what of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) addEventListener(what, () => sound.wake(), true);
  addEventListener('keydown', (e) => { if (e.code === 'KeyM') sound.quiet = !sound.quiet; });
}

if (sound && spells) spells.hear = (what, o) => sound.cue(what, o);

// The one clock. Everything that moves is a function of it; `pace` is how fast it runs (1 as a rule).
const clock = { pace: 1 };
const settings = { hands: false, class: 'mage', blade: false, gunner: false, gfx: 'high', viewBack: false };
document.getElementById('chase')?.addEventListener('pointerup', (e) => {
  settings.viewBack = !settings.viewBack;
  e.currentTarget.textContent = settings.viewBack ? 'Far' : 'Near';
  e.currentTarget.classList.toggle('on', settings.viewBack);
  e.preventDefault();
  e.stopPropagation();
});
const handsEl = document.getElementById('hands');
const gear = document.getElementById('gear');
const settingsEl = document.getElementById('settings');
gear?.addEventListener('pointerup', (e) => { if (settingsEl) settingsEl.hidden = false; e.preventDefault(); e.stopPropagation(); });
document.getElementById('setX')?.addEventListener('pointerup', (e) => { if (settingsEl) settingsEl.hidden = true; e.preventDefault(); e.stopPropagation(); });
settingsEl?.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('pointerup', (e) => {
  settingsEl.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('on', t === b));
  const tab = b.getAttribute('data-tab');
  settingsEl.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.getAttribute('data-pane') !== tab; });
  e.preventDefault(); e.stopPropagation();
}));
function showClass() {
  document.querySelectorAll('[data-class]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-class') === settings.class));
  const bladeBtn = document.getElementById('bladeToggle');
  const gunBtn = document.getElementById('gunnerToggle');
  if (bladeBtn) { bladeBtn.textContent = settings.class === 'blade' ? 'Blade: on' : 'Blade: off'; bladeBtn.classList.toggle('on', settings.class === 'blade'); }
  if (gunBtn) { gunBtn.textContent = settings.class === 'gunner' ? 'Gunner: on' : 'Gunner: off'; gunBtn.classList.toggle('on', settings.class === 'gunner'); }
}
function pickClass(name) {
  settings.class = name === 'blade' || name === 'gunner' ? name : 'mage';
  settings.blade = settings.class === 'blade';
  settings.gunner = settings.class === 'gunner';
  if (settings.class !== 'mage') arms.load();
  if (settings.class !== 'blade') blade.setDrawn(false);
  showClass();
}
document.querySelectorAll('[data-class]').forEach((b) => b.addEventListener('pointerup', (e) => {
  pickClass(b.getAttribute('data-class'));
  e.preventDefault(); e.stopPropagation();
}));
document.getElementById('handsToggle')?.addEventListener('pointerup', (e) => {
  settings.hands = !settings.hands;
  e.currentTarget.textContent = settings.hands ? 'Hands mode: on' : 'Hands mode: off';
  e.currentTarget.classList.toggle('on', settings.hands);
  if (handsEl) handsEl.hidden = !settings.hands;
  if (settings.hands) {
    arms.load();
    import('./handtrack.js').then((m) => m.startHandTrack(() => {})).catch(() => {});
  }
  e.preventDefault(); e.stopPropagation();
});
settingsEl?.querySelectorAll('[data-gfx]').forEach((b) => b.addEventListener('pointerup', (e) => {
  settings.gfx = b.getAttribute('data-gfx');
  settingsEl.querySelectorAll('[data-gfx]').forEach((t) => t.classList.toggle('on', t === b));
  const low = settings.gfx === 'low';
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = !low && !phone;
  fitView();
  e.preventDefault(); e.stopPropagation();
}));
document.getElementById('bladeToggle')?.addEventListener('pointerup', (e) => {
  pickClass(settings.class === 'blade' ? 'mage' : 'blade');
  e.preventDefault(); e.stopPropagation();
});
document.getElementById('gunnerToggle')?.addEventListener('pointerup', (e) => {
  pickClass(settings.class === 'gunner' ? 'mage' : 'gunner');
  e.preventDefault(); e.stopPropagation();
});
document.querySelectorAll('[data-hop]').forEach((b) => b.addEventListener('pointerup', (e) => {
  hop(b.getAttribute('data-hop'));
  e.preventDefault(); e.stopPropagation();
}));
const MOOD_KEY = 'aro-sm-monsters';
function readMood() {
  try { return localStorage.getItem(MOOD_KEY) === 'passive' ? 'passive' : 'fight'; } catch { return 'fight'; }
}
function applyMood(mode, save) {
  const next = mode === 'passive' ? 'passive' : 'fight';
  settings.monsters = next;
  if (save) { try { localStorage.setItem(MOOD_KEY, next); } catch { /* private mode keeps the choice for this visit */ } }
  const btn = document.getElementById('mood');
  if (btn) { btn.textContent = next === 'passive' ? 'Passive' : 'Fight'; btn.classList.toggle('on', next === 'fight'); }
  blade.setFight(next === 'fight');
}
document.getElementById('mood')?.addEventListener('pointerup', (e) => {
  applyMood(settings.monsters === 'passive' ? 'fight' : 'passive', true);
  e.preventDefault(); e.stopPropagation();
});
document.getElementById('draw')?.addEventListener('pointerup', (e) => {
  const next = !blade.drawn;
  if (next && readMood() !== 'passive') applyMood('fight', false);
  blade.setDrawn(next);
  e.preventDefault(); e.stopPropagation();
});
document.getElementById('pound')?.addEventListener('pointerdown', (e) => {
  e.currentTarget.setPointerCapture?.(e.pointerId);
  blade.poundStart();
  e.preventDefault(); e.stopPropagation();
});
document.getElementById('pound')?.addEventListener('pointerup', (e) => {
  blade.poundRelease();
  e.preventDefault(); e.stopPropagation();
});
document.getElementById('pound')?.addEventListener('pointercancel', (e) => {
  blade.poundRelease();
  e.preventDefault();
});
document.getElementById('spin')?.addEventListener('pointerup', (e) => {
  blade.spin();
  e.preventDefault(); e.stopPropagation();
});
document.getElementById('gunFire')?.addEventListener('pointerup', (e) => { gun.fire(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('gunNade')?.addEventListener('pointerup', (e) => { gun.toss(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('vol')?.addEventListener('input', (e) => { if (sound) sound.volume = Number(e.target.value) / 100; });
const arms = createArms(scene);
const sword = new THREE.Group();
const steel = new THREE.MeshBasicMaterial({ color: '#e7eef6' });
const gripMat = new THREE.MeshBasicMaterial({ color: '#6b3a22' });
const gold = new THREE.MeshBasicMaterial({ color: '#e6c27a' });
function sculptedBlade() {
  const h = 0.74, n = 7;
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = 0.08 + t * h;
    const half = 0.05 * (1 - t * 0.9);
    const thick = 0.011 * (1 - t * 0.55);
    pos.push(-half, y, 0, 0, y, thick, half, y, 0, 0, y, -thick * 0.45);
    if (i === n) continue;
    const b = i * 4;
    idx.push(b, b + 4, b + 1, b + 1, b + 4, b + 5, b + 1, b + 5, b + 2, b + 2, b + 5, b + 6, b + 2, b + 6, b + 3, b + 3, b + 6, b + 7, b + 3, b + 7, b, b, b + 7, b + 4);
  }
  const tip = pos.length / 3;
  pos.push(0, 0.08 + h + 0.05, 0);
  const last = n * 4;
  idx.push(last, last + 1, tip, last + 1, last + 2, tip, last + 2, last + 3, tip, last + 3, last, tip);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
const edge = new THREE.Mesh(sculptedBlade(), steel);
const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.028, 0.04), gold);
guard.position.y = 0.06;
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 8), gripMat);
handle.position.y = -0.05;
const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), gold);
pommel.position.y = -0.15;
sword.add(edge, guard, handle, pommel);
sword.scale.setScalar(1.05);
sword.visible = false;
sword.traverse((o) => { o.frustumCulled = false; });
scene.add(sword);
const blade = createBlade((damage) => zones.launchNearest(damage, blade.locked), { scene, camera, world, zones, walker, air, fx });
applyMood(readMood(), false);
const gun = createGunner(scene, camera, world, zones);
camera.layers.enable(9);
let padCast = false, forceDraw = false, chaseDist = 0;
let free = null;
let shaking = 0;
const blastAt = new THREE.Vector3();
let hopCool = 0;
function hop(kind) {
  if (hopCool > 0 || !(settings.class === 'blade' && blade.drawn)) return;
  hopCool = 0.32;
  const yaw = walker.yaw;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const step = 1.8;
  let dx = 0, dz = 0;
  if (kind === 'in') {
    let best = null, bestD = 16;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - walker.feet.x, b.z - walker.feet.z);
      if (d < bestD) { best = b; bestD = d; }
    }
    if (!best || bestD < 2.2) return;
    const hop = Math.min(3.4, bestD - 2);
    dx = (best.x - walker.feet.x) / bestD * hop;
    dz = (best.z - walker.feet.z) / bestD * hop;
  } else if (kind === 'back') { dx = -sy * step; dz = -cy * step; }
  else if (kind === 'left') { dx = cy * step; dz = -sy * step; }
  else { dx = -cy * step; dz = sy * step; }
  walker.place(walker.feet.x + dx, walker.feet.z + dz, yaw);
}
function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  // (a blast all but stops time for the instant it lands)
  const pace = clock.pace * blast.pace * hole.pace;
  if (hopCool > 0) hopCool -= dt;
  // (a singularity opens the eye wider)
  if (Math.abs(camera.fov - (world.fov + hole.fov)) > 0.01) { camera.fov = world.fov + hole.fov; camera.updateProjectionMatrix(); }
  air.uniforms.uNow.value += dt * pace;
  const inp = input.read(dt);
  const planted = zones.name !== 'hub' && settings.class === 'blade' && blade.pad;
  const melee = zones.name !== 'hub' && (settings.class === 'blade' || settings.class === 'gunner');
  applyKit(melee ? settings.class : 'mage');
  if (discToggle) discToggle.hidden = kit !== 'mage';
  if (zones.blocksMagic) {
    zones.castHeld(!!inp.cast, !padCast && !!inp.cast, padCast && !inp.cast);
    padCast = !!inp.cast;
    spells?.release();
  } else if (melee) {
    spells?.release();
    const list = settings.class === 'blade' ? BLADE_ATK : GUN_ATK;
    if (inp.spell) { atk = (atk + inp.spell + list.length) % list.length; kitBar.select(atk); }
    if (inp.cast !== null && inp.cast !== padCast) { const down = !!inp.cast; padCast = !!inp.cast; useAttack(settings.class, atk, down); }
  } else if (spells) {
    if (inp.cast !== null && inp.cast !== padCast) { padCast = inp.cast; if (padCast) spells.press(); else spells.release(); }
    if (inp.spell) spells.select(spells.selected + inp.spell);
  }
  zones.update(dt);
  quest?.update();
  if (inp.any) sound?.wake();
  walker.update(dt, planted ? { ...inp, move: { x: 0, y: 0 }, jump: false, sprint: false } : inp);
  if (free) { camera.position.copy(free.position); camera.lookAt(free.target); } else walker.look(camera);
  const bladeClose = settings.class === 'blade' && blade.drawn && blade.pad;
  const wantChase = !free && !bladeClose && (settings.viewBack || walker.speed > 1.15);
  const wantDist = settings.viewBack ? 4.4 : 2.5 + Math.min(2.1, Math.max(0, walker.speed - 1) * 0.32);
  chaseDist += ((wantChase ? wantDist : 0) - chaseDist) * Math.min(1, dt * 3.2);
  const chasing = chaseDist > 0.45;
  if (chasing) {
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    camera.position.set(walker.feet.x - fx * chaseDist, walker.feet.y + 1.55 + chaseDist * 0.18, walker.feet.z - fz * chaseDist);
    camera.lookAt(walker.feet.x + fx * 1.6, walker.feet.y + 1.15, walker.feet.z + fz * 1.6);
  }
  // (and shakes the eye)
  if (blast.shake + hole.shake + twister.shake > 0.002) { const s = blast.shake + hole.shake + twister.shake * 0.5; shaking += dt; camera.rotateX(Math.sin(shaking * 61) * Math.sin(shaking * 37 + 1) * 0.03 * s); camera.rotateY(Math.sin(shaking * 53 + 2) * Math.sin(shaking * 29) * 0.03 * s); camera.rotateZ(Math.sin(shaking * 47 + 4) * 0.018 * s); }
  camera.updateMatrixWorld(true);
  world.update(dt, walker.feet, camera, walker.speed);
  staff?.update(dt, walker, camera, world.sunAt?.(camera.position) ?? 1);
  const wheel = discOn && kit === 'mage' && !melee;
  castDisc?.update(dt, wheel, spells?.selected ?? 0, walker, camera, discCharge ? (spells?.cast?.charge || 0) : 0, !chasing && !free);
  const spellBox = document.getElementById('spells');
  if (spellBox) spellBox.hidden = !!(wheel && castDisc?.ready);
  if (spells) {
    const on = !!(wheel && castDisc?.ready);
    spells.hideMark = on;
    spells.from = on ? castDisc.muzzle : null;
  }
  if (discCharge && spells?.cast?.charge >= 0.98) { discCharge = false; spells.release(); padCast = false; }
  ruin?.update(dt * pace);
  if (spells) spells.update(dt * pace, dt); else { blast.update(dt * pace, dt, camera.position); hole.update(dt * pace, dt, camera.position); twister.update(dt * pace, dt, camera.position); }
  if (spells) zones.hurt(spells.marks);
  fire.step(dt * pace, camera.position);
  fx.update(dt * pace);
  sound?.update(dt, { blast, hole, twister, ruin, camera, fire, cast: spells?.cast, world, walker });
  // (the rim of the spell in hand fills as it is gathered, and stands full while it is poured or held open)
  if (spells && kit === 'mage') {
    const c = spells.cast;
    kitBar.charge(c.holding ? c.charge : blast.charge > 0 ? blast.charge : c.pour || hole.phase === 'open' || twister.phase === 'gather' || twister.phase === 'live' ? 1 : 0);
    kitBar.cool(c.cool || 0);
  }
  // (the day goes dark red for a blast being gathered, and violet for a singularity)
  // (and the grey of a storm for a whirlwind)
  if (twister.dark > hole.dark && twister.dark > blast.dark) { post.doom = twister.dark; post.doomTint(0.2 + 0.3 * twister.fire, 0.25 - 0.08 * twister.fire, 0.34 - 0.24 * twister.fire, 0.3); }
  else if (hole.dark > blast.dark) { post.doom = hole.dark; const g = hole.gone; post.doomTint(0.07 * (1 - g), 0.035 * (1 - g), 0.3 * (1 - 0.9 * g), 0.22 * (1 - g)); } else { post.doom = blast.dark; post.doomTint(0.5, 0.06, 0.05); }
  post.ink = blast.ink; post.white = Math.max(blast.white, hole.white, twister.white); post.blaze = blast.blaze;
  if (hole.shockP > 0) post.shock(camera, hole.centre, hole.shockR, hole.shockP); else post.shock(camera, blastAt.copy(blast.centre).setY(blast.centre.y + 3), blast.shockR, blast.shockP);
  post.hole(camera, hole.centre, hole.radius, hole.power, hole.blur, hole.reach * 1.05);
  post.heat = Math.min(1, fire.glare * 0.85 + (spells?.glare ?? 0) * 0.6);
  if (handsEl) handsEl.classList.toggle('on', !!(settings.hands && (inp.cast || spells?.cast?.holding || spells?.cast?.pour)));
  const klass = zones.name !== 'hub' ? settings.class : 'mage';
  const moodBtn = document.getElementById('mood');
  if (moodBtn) moodBtn.hidden = zones.name === 'hub';
  blade.update(dt, klass === 'blade', zones.nearBeast < 14);
  gun.update(dt, klass === 'gunner');
  const armsOn = (settings.hands || klass === 'gunner') && zones.name !== 'hub' && arms.loaded;
  arms.rig.visible = !!armsOn;
  if (arms.rig.visible) {
    const ready = !!(klass === 'blade' || klass === 'gunner' || inp.cast || spells?.cast?.holding || spells?.cast?.pour || zones.rodOut || zones.nearBeast < 7);
    arms.update(dt, camera, { ready, speed: walker.speed, stride: walker.stride });
  }
  sword.visible = klass === 'blade' && blade.drawn;
  if (sword.parent !== scene) scene.add(sword);
  if (sword.visible && chasing) {
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    sword.position.set(walker.feet.x + fx * 0.45 + fz * 0.28, walker.feet.y + 1.0, walker.feet.z + fz * 0.45 - fx * 0.28);
    sword.quaternion.copy(camera.quaternion);
    sword.rotateZ(-0.5);
  } else if (sword.visible) {
    const s = blade.swing || 0;
    const narrow = innerWidth < 820;
    sword.position.set(narrow ? -0.02 : 0.22, (narrow ? -0.2 : -0.18) - s * 0.02, narrow ? -0.58 : -0.7);
    sword.rotation.set(narrow ? 0.35 - s * 0.2 : 0.55 - s * 0.45, narrow ? 0.4 : 0.15, narrow ? -0.5 - s * 0.25 : -0.45 - s * 0.55);
    sword.scale.setScalar(narrow ? 0.62 : 1.05);
    sword.updateMatrix();
    sword.matrix.premultiply(camera.matrixWorld);
    sword.matrix.decompose(sword.position, sword.quaternion, sword.scale);
  }
  const hideStaff = !!(free || zones.name === 'hub' || settings.hands || zones.rodOut || klass === 'blade' || klass === 'gunner');
  if (!q.has('fast') || forceDraw) post.render(scene, camera, hideStaff ? null : staff, SUN);
  forceDraw = false;
}

// (the measuring tools were written for a figure seen from behind: these are the same handles on one seen from within)
const head = new THREE.Vector3();
const lab = window.lab = { castDisc, discOn: () => discOn, quest,
  THREE, camera, input, post, renderer, scene, timings, world, walker, clock, air, fx, fire, flames, spells, ruin, blast, hole, twister, zones, settings, arms, blade, gun, tune: TUNE, way: world.way, heightAt: world.ground, ground: world.ground, counts: world.counts,
  player: walker,
  follow: { get yaw() { return walker.yaw; }, set yaw(v) { walker.yaw = v; }, get pitch() { return walker.pitch; }, set pitch(v) { walker.pitch = v; }, want: 0, distance: 0, pivot: new THREE.Vector3() },
  doll: { man: { bones: { Head: { getWorldPosition: (v) => v.copy(walker.feet).setY(walker.feet.y + 1.66) } } } },
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
  draw() { forceDraw = true; },
  sound,
  /** One frame, and the sound of it worked out before the next (films with sound). */
  async stepSound(dt = 1 / 60) { tick(dt); await sound.advance(dt); },
  setInput(fn) { input.override = fn; },
  /** Puts them at (x, z), facing (fx, fz). */
  teleport(x, z, fx, fz) { walker.place(x, z, Math.atan2(fx - x, fz - z)); tick(1 / 60); },
  /** A fixed view for stills: eye and what it looks at. Call with nothing to see through their eyes again. */
  view(eye, target) { free = eye ? { position: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null; },
};
void head;

say('Letting the light in');
await turn();
if (!capture && !phone) await Promise.race([renderer.compileAsync(scene, camera).catch(() => {}), new Promise((r) => setTimeout(r, 8000))]);
lap('shaders');
// The first frames are drawn before Patch is told the demo is ready, and each is waited for: the card builds a
// good deal the first time it draws a thing, after JavaScript has gone on, and that must not land after ready.
function gpuDone() {
  const gl = renderer.getContext();
  if (!gl.fenceSync) return Promise.resolve();
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync) return Promise.resolve();
  gl.flush();
  const start = performance.now();
  return new Promise((resolve) => {
    const poll = () => {
      if (performance.now() - start > 800 || gl.clientWaitSync(sync, 0, 0) !== gl.TIMEOUT_EXPIRED) {
        gl.deleteSync(sync);
        resolve();
        return;
      }
      setTimeout(poll, 4);
    };
    poll();
  });
}
// Everything magic draws is drawn in these frames too, small, a few metres ahead and gone again at once: a card
// builds a thing the first time it is really drawn, and that must not be the first time a spell is cast.
const ahead = new THREE.Vector3();
function warmMagic() {
  camera.getWorldDirection(ahead).multiplyScalar(7).add(camera.position);
  for (let kind = 0; kind <= 7; kind++) fx.spawn({ kind, x: ahead.x + (kind - 3) * 0.2, y: ahead.y, z: ahead.z, vx: 0.1, life: 0.04, size: 0.05, alpha: 0.03 });
  flames.extra = [ahead.x, world.ground(ahead.x, ahead.z), ahead.z];
  beam.warm(ahead.clone().setY(ahead.y - 0.6), ahead);
  blast.warm(ahead.clone().setY(world.ground(ahead.x, ahead.z)));
  hole.warm(ahead.clone());
  twister.warm(ahead.clone().setY(world.ground(ahead.x, ahead.z)));
}
timings.warm = [];
for (let i = 0; i < (capture ? 3 : phone ? 0 : 6); i++) {
  const t = performance.now();
  if (i > 0) warmMagic();
  tick(1 / 60);
  if (!capture) { await gpuDone(); say('Letting the light in'); await turn(); }
  timings.warm.push(Math.round(performance.now() - t));
}
lap('first frames');

let last = performance.now();
function run() {
  last = performance.now();
  // (every frame also looks at the window's size itself, in case a resize was ever missed)
  const going = shown && begun && !paused && !capture;
  if (sound && !capture) { if (going) sound.wake(); else sound.sleep(); }
  renderer.setAnimationLoop(going ? () => { if (innerWidth !== fitW || innerHeight !== fitH) fitView(); const now = performance.now(); tick((now - last) / 1000); last = now; } : null);
}
fitView();
loaded = true;
run();
const hint = document.getElementById('hint');
if (capture) hint?.remove();
if (phone) hint?.classList.add('off');
if (sound && capture) await sound.ready;
if (!capture) {
  // Stopped: when the window is left, when the mouse is let go (Esc is Patch's, and lets it go), on P, or on a pad's
  // Start. Never while Patch tests it: its window cannot hold the mouse.
  const pauseEl = document.getElementById('pause'), resume = document.getElementById('resume'), begin = document.getElementById('begin');
  const dom = renderer.domElement;
  let byPad = false, locked = false, device = 'keys';
  // what they are told follows what they last used: a pad left plugged in changes nothing for someone on the keys
  const TOLD = { keys: hint.innerHTML, pad: 'Left stick moves &middot; right stick looks &middot; right trigger casts, hold for more<br>Shoulders change spell &middot; bottom button jumps &middot; press the left stick to sprint &middot; Start pauses' };
  const useDevice = (d) => { if (d === device) return; device = d; hint.innerHTML = TOLD[d]; resume.textContent = d === 'pad' ? 'Press Start to carry on' : 'Click to carry on'; };
  const setPaused = (v) => { if (!begun || testing || v === paused) return; paused = v; pauseEl.hidden = !v; if (v) { spells?.release(); padCast = false; } run(); };
  const start = (pad) => {
    if (begun) return;
    begun = true; byPad = pad;
    title.classList.add('gone'); setTimeout(() => title.remove(), 1400);
    if (!pad && !testing) dom.requestPointerLock?.()?.catch?.(() => {});
    setTimeout(() => hint.classList.add('faded'), 12000);
    run();
  };
  addEventListener('blur', () => setPaused(true));
  document.addEventListener('visibilitychange', () => { shown = !document.hidden; if (document.hidden) setPaused(true); else run(); });
  document.addEventListener('pointerlockchange', () => { const now = document.pointerLockElement === dom; if (locked && !now && !byPad) setPaused(true); locked = now; if (now) byPad = false; });
  addEventListener('keydown', (e) => {
    useDevice('keys');
    if (e.code === 'KeyH') hint.classList.toggle('off');
    if (!begun) { if (!['F11', 'F12'].includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) start(false); return; }
    if (e.code === 'KeyP') setPaused(!paused);
  });
  addEventListener('mousedown', () => {
    if (performance.now() - (input.touchAt || 0) < 700) return;
    useDevice('keys'); if (!begun) start(false); else if (paused) { dom.requestPointerLock?.()?.catch?.(() => {}); setPaused(false); }
  });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if (!begun) start(true);
    else if (paused && !e.target.closest('#cast, #spell, #stick')) setPaused(false);
  });
  // a pad has no click: any of its buttons begins, and Start stops and starts again (looked for even while stopped)
  const padWatch = () => {
    const pad = testing || q.has('nopad') ? null : [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected && p.mapping === 'standard');
    const any = pad?.buttons.some((b, i) => i !== 16 && b.pressed), startDown = Boolean(pad?.buttons[9]?.pressed);
    if (any && !begun) start(true);
    else if (begun && startDown && !padWatch.was) { byPad = true; setPaused(!paused); }
    if (any) { useDevice('pad'); if (begun) byPad = true; }
    padWatch.was = startDown;
    requestAnimationFrame(padWatch);
  };
  requestAnimationFrame(padWatch);
  // (with a pad plugged in, they are told it can begin the game too)
  addEventListener('gamepadconnected', () => { if (!testing) begin.textContent = 'Click, or press any button, to begin'; });
  // Patch may ask for less to be drawn on a PC that struggles: it lowers the pixel ratio the page sees, so the view is fitted again
  window.patch?.addEventListener?.('qualitychange', () => { renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2)); fitView(); });
  // ready: the bar is full, and they are asked to begin
  bar?.style.setProperty('--p', 1);
  loading?.remove();
  if (begin) begin.hidden = false;
  if (testing) start(false);
}
lab.ready = true;
// for the measuring tools
window.__block = { ready: true, timings, set() {} };
// (the measuring tools go straight in)
lab.begin = () => { if (!begun) { begun = true; title?.remove(); run(); } };
