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
import { createAR } from './ar.js';
import { createWander } from './wander.js';
import { createLiving } from './living.js';
import { createFolk } from './folk.js';
import { createWeather } from './weather.js';
import { createDuel } from './petduel.js';
import { createPets } from './pets.js';
import { createAppeal } from './appeal.js';
import { createMind } from './hearthmind.js';
import { createHexes } from './hexes.js';
import { createHub } from './hub.js';
import { tracked } from './handtrack.js';
import { createPage } from './page.js';
import { Walker } from './player.js';
import { createAvatar } from './avatar.js';
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
import { createRanger } from './ranger.js';
import { createWarden } from './warden.js';
import { createAlchemist } from './alchemist.js';
import { migrateSave, rememberClass, savedClass } from './save.js';
import { createSummoner } from './summoner.js';
import { createPuppetmaster } from './puppetmaster.js';
import { createFamiliar } from './familiar.js';
import { createAmbience } from './ambience.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture'), testing = q.has('patch-test'), playtest = q.has('playtest');
migrateSave();
if (q.has('shot')) document.body.classList.add('shot');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
const loading = document.getElementById('loading');
// The cover is over everything while the meadow is made, and until they begin.
const title = document.getElementById('title'), bar = document.getElementById('sigil');
if (capture) title?.remove();
let shown = true, loaded = false, told = 0.02, begun = capture || playtest, paused = false;
const say = (text) => { told = Math.min(0.95, told + 0.1); if (loading) loading.textContent = text; bar?.style.setProperty('--p', told); };
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
useRenderer(renderer);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, phone ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.shadowMap.enabled = !phone;
renderer.shadowMap.type = phone ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
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
const familiar = createFamiliar(scene);
const ambience = createAmbience();
lap('start');
const air = createAir();
const world = await createWorld({ air, renderer, scene, say, turn });
attachFells(world, air);
const camera = new THREE.PerspectiveCamera(world.fov, innerWidth / innerHeight, 0.12, world.far);
fitting.push(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
// ?marks: a burnt patch and a frozen one by the start, to see that the ground takes what magic will write to it
if (q.has('marks')) { world.mark(-5, 27, 4.5, 0, 1); world.mark(5.5, 26, 4.5, 1, 1); }
if (q.get('bond') === 'trusted') {
  const people = {};
  for (const id of ['maren', 'sable', 'bram', 'lumen']) people[id] = { fp: 100, mood: 'glad', notes: 2, hangs: 1 };
  try { localStorage.setItem('aro-hub', JSON.stringify({ respect: 80, people, boardSeed: 1, done: {} })); } catch { /* private mode */ }
}
lap('world');

say('Warming the hands');
await turn();
const walker = new Walker(world);
const avatar = createAvatar(scene, { phone, world });
const staff = q.has('nostaff') ? null : createStaff({ air, atlas: world.atlas });
const castDisc = createCastDisc(scene);
let discOn = true;
let discCharge = false;
if (staff) { staff.resize(innerWidth / innerHeight); fitting.push(() => staff.resize(innerWidth / innerHeight)); }
const input = new Input(renderer.domElement, { pads: !capture && !testing && !q.has('nopad') });
const touchUi = document.getElementById('touch');
if (touchUi && (phone || navigator.maxTouchPoints > 0)) { touchUi.hidden = false; input.bindTouch(touchUi); }
const post = createPage(renderer);
let painted = true;
try { painted = localStorage.getItem('aro-paint') !== '0'; } catch { /* keep the warm grade */ }
post.paint = painted;
// magic: what is seen of it in the air, the fire that spreads by itself, and the spells
const fx = createFx(air);
scene.add(fx.group);
// things to break: what is built in the meadow, standing on Patch's destruction physics. Where there is no WebGPU, none.
// (They are raised before the fire is made: nothing grows through their paving, so nothing burns there.)
say('Raising the walls');
await turn();
const ruin = (q.has('noruin') || phone) ? null : await createRuin({ air, meadow: world, scene, fx, say, turn }).catch((e) => { console.warn('no buildings:', e); return null; });
if (ruin?.mesh) ruin.mesh.visible = false;
if (ruin) world.blockers = (f) => ruin.block(f);
lap('ruin');
const flames = createFlames(air);
scene.add(flames.mesh);
const fire = createFire({ world, air, fx, flames });
const zones = createZones({ scene, world, walker, camera, air, detail: phone ? 'low' : 'high' });
const ar = createAR(scene, camera, world, zones);
const appeal = createAppeal(scene, world);
const mind = createMind();
if (phone) { appeal.quality = 0; post.grade = 0; }
const living = createLiving({ zones });
const folk = createFolk({ scene, world, living, zones, phone });
const street = createWeather(scene, world);
const duel = createDuel({ scene, world, camera, living });
// Declared before the wander loop reads it. A capture with no sound card leaves it null.
let sound = null;
try { sound = q.has('nosound') || (capture && !q.get('sound')) ? null : createSound({ offline: capture ? Number(q.get('sound')) : 0 }); }
catch (e) { console.warn('no sound', e); }
const wander = createWander({
  scene, world, zones, sound,
  living,
  leave() { ar.set(false, walker, renderer); zones.enter('meadow'); },
  onDuel() { duel.begin({ foe: 'wolf' }); },
});
const hexes = createHexes(scene, world, camera, walker, zones);
hexes.watch = living;
if (q.get('bond') === 'trusted') zones.setHearts(120);
const hub = createHub({
  visit() {
    zones.enter('hub');
    walker.pitch = 0.06;
    const board = document.getElementById('board');
    if (board) board.hidden = true;
  },
  toast(text) { zones.toast(text); },
  living,
  mind,
  sky() { return zones.boardSky(); },
});
zones.onLand = () => { const shore = hexes.at(walker.feet.x, walker.feet.z); hexes.grant(shore?.id || 'shore', shore ? 16 : 8); };
zones.seatHexes(hexes.list);
zones.onHexTap = (sx, sy) => {
  const h = hexes.hit(sx, sy);
  if (!h) return false;
  if (zones.name !== 'meadow') zones.enter('meadow');
  hexes.enter(h);
  return true;
};
document.getElementById('rangerShoot')?.addEventListener('pointerdown', (e) => { ranger.chargeStart(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('rangerShoot')?.addEventListener('pointerup', (e) => { ranger.chargeRelease(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('rangerShoot')?.addEventListener('pointercancel', (e) => { ranger.chargeRelease(); e.preventDefault(); });
document.getElementById('rangerVolley')?.addEventListener('pointerup', (e) => { ranger.volley(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('rangerTrap')?.addEventListener('pointerup', (e) => { ranger.trap(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('rangerMark')?.addEventListener('pointerup', (e) => { ranger.hawk(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('wardenTotem')?.addEventListener('pointerup', (e) => { warden.plantTotem(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('wardenBubble')?.addEventListener('pointerup', (e) => { warden.shield(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('wardenSnare')?.addEventListener('pointerup', (e) => { warden.root(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('wardenCalm')?.addEventListener('pointerup', (e) => { warden.calm(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('alchemistHeal')?.addEventListener('pointerup', (e) => { alchemist.heal(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('alchemistAcid')?.addEventListener('pointerup', (e) => { alchemist.acid(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('alchemistSmoke')?.addEventListener('pointerup', (e) => { alchemist.smoke(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('alchemistBrew')?.addEventListener('pointerup', (e) => { alchemist.brew(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('summonerCatch')?.addEventListener('pointerdown', (e) => { summoner.catchStart(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('summonerCatch')?.addEventListener('pointerup', (e) => { summoner.catchStop(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('summonerCall')?.addEventListener('pointerup', (e) => { summoner.summon(); e.preventDefault(); e.stopPropagation(); });
const wrist = new THREE.Vector3();
function wristPoint() {
  if (!tracked.on) return null;
  wrist.set((0.5 - tracked.u) * 0.5, (0.45 - tracked.v) * 0.42 - 0.05, -0.35);
  return wrist.applyMatrix4(camera.matrixWorld);
}
document.getElementById('ar')?.addEventListener('pointerup', (e) => {
  // Both calls have to start inside this tap. iPhone Safari drops the camera and the
  // tilt permission if either waits for the other.
  const next = !ar.on;
  if (next && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().catch(() => 'denied');
  }
  if (next) wander.askMotion();
  ar.set(next, walker, renderer);
  if (ar.on) import('./handtrack.js').then((m) => m.startHandTrack(() => {})).catch(() => {});
  e.preventDefault();
  e.stopPropagation();
});
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
const SUMMON_ATK = [
  { key: 'catch', name: 'Catch', colour: '#c9a6ff', sides: 4 },
  { key: 'summon', name: 'Summon', colour: '#7ee0ff', sides: 3 },
];
const PUPPET_ATK = [
  { key: 'deploy', name: 'Deploy Tank', colour: '#8a5a32', sides: 4 },
  { key: 'pop', name: 'Pop Fighter', colour: '#c4a574', sides: 3 },
  { key: 'strike', name: 'Fighter Strike', colour: '#e7c56a', sides: 3 },
  { key: 'trap', name: 'Set Trap', colour: '#ffb043', sides: 4 },
  { key: 'bash', name: 'Tank Bash', colour: '#6a3a22', sides: 4 },
  { key: 'recall', name: 'Recall', colour: '#9fd4ff', sides: 3 },
];
const WARDEN_ATK = [
  { key: 'totem', name: 'Ward totem', colour: '#8a9a78', sides: 4 },
  { key: 'bubble', name: 'Bubble', colour: '#d7e4f2', sides: 6 },
  { key: 'snare', name: 'Root snare', colour: '#6a8f4a', sides: 5 },
  { key: 'calm', name: 'Calm', colour: '#c9d7b8', sides: 6 },
];
const RANGER_ATK = [
  { key: 'draw', name: 'Draw', colour: '#c4a574', sides: 3 },
  { key: 'volley', name: 'Volley', colour: '#e7c56a', sides: 3 },
  { key: 'trap', name: 'Trap arrow', colour: '#6a8f4a', sides: 4 },
  { key: 'hawk', name: 'Hawk', colour: '#8a5a32', sides: 5 },
];
const ALCHEMIST_ATK = [
  { key: 'heal', name: 'Heal splash', colour: '#7dff9a', sides: 6 },
  { key: 'acid', name: 'Acid splash', colour: '#c6e04a', sides: 5 },
  { key: 'smoke', name: 'Smoke', colour: '#d5d0c8', sides: 6 },
  { key: 'brew', name: 'Brew', colour: '#6a4324', sides: 6 },
];
const KIT_ATK = { blade: BLADE_ATK, gunner: GUN_ATK, summoner: SUMMON_ATK, puppet: PUPPET_ATK, warden: WARDEN_ATK, ranger: RANGER_ATK, alchemist: ALCHEMIST_ATK };
const spellsBar = spellBar(document.getElementById('spells'), SPELLS, 'ui/', { ring: true, onPick: (i) => spells?.select(i) });
let kitBar = spellsBar;
let kit = 'mage';
let atk = 0;
function applyKit(next) {
  const want = KIT_ATK[next] ? next : 'mage';
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
  kitBar = spellBar(box, KIT_ATK[want]);
  kitBar.select(0);
  if (spellBtn) spellBtn.textContent = 'Attacks';
  if (castBtn) castBtn.textContent = 'Use';
}
function useAttack(which, index, down) {
  const drawing = which === 'ranger' && RANGER_ATK[index]?.key === 'draw';
  if (sound && down && !drawing) sound.cast(which);
  if (sound && drawing) sound.cast(down ? 'draw' : 'ranger');
  if (which === 'gunner') {
    if (index === 1) { if (down) gun.toss(); return; }
    if (down) gun.arm(); else gun.release();
    return;
  }
  if (which === 'summoner') {
    const key = SUMMON_ATK[index]?.key;
    if (key === 'catch') { if (down) summoner.catchStart(); else summoner.catchStop(); }
    else if (down) summoner.summon();
    return;
  }
  if (which === 'puppet') {
    const key = PUPPET_ATK[index]?.key;
    if (key === 'bash') { if (down) puppet.bashStart(); else puppet.bashRelease(); return; }
    if (down) puppet.use(key);
    return;
  }
  if (which === 'warden') { if (down) warden.use(WARDEN_ATK[index]?.key); return; }
  if (which === 'ranger') {
    const key = RANGER_ATK[index]?.key;
    if (key === 'draw') { if (down) ranger.chargeStart(); else ranger.chargeRelease(); return; }
    if (down && key === 'volley') ranger.volley();
    if (down && key === 'trap') ranger.trap();
    if (down && key === 'hawk') ranger.hawk();
    return;
  }
  if (which === 'alchemist') {
    if (!down) return;
    const key = ALCHEMIST_ATK[index]?.key;
    if (key === 'acid') alchemist.acid();
    else if (key === 'smoke') alchemist.smoke();
    else if (key === 'brew') alchemist.brew();
    else alchemist.heal();
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
duel.bind({
  walker,
  hurt(n) {
    zones.nick(n);
    const hp = document.getElementById('hp');
    if (hp) {
      hp.classList.add('hurt');
      clearTimeout(hp._t);
      hp._t = setTimeout(() => hp.classList.remove('hurt'), 280);
    }
    if (zones.hearts > 0) return false;
    zones.setHearts(70);
    return true;
  },
  note(text) { zones.toast(text); },
  cols: () => world.iceCols || [],
  marks: () => spells?.marks || [],
  ignite(x, z, r) { fire.ignite(x, z, r, 0.8); },
  whirl(p) { twister.begin(p); },
  flames() { return fire.near(duel.spot.x, duel.spot.z, 4) > 0 ? 0.5 : 0; },
});
hexes.onPortal = (h) => {
  if (playtest) return;
  zones.enter('meadow');
  duel.beginRaid(`${h.name} brute`);
};
const pets = createPets({ scene, world, walker, living, zones, duel });
pets.onRare = () => {
  const here = hexes.at(walker.feet.x, walker.feet.z);
  hexes.grant(here?.id || 'meadow', 12);
};
document.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('pointerup', (e) => {
  const which = b.getAttribute('data-ask');
  const board = document.getElementById('board');
  if (board) board.hidden = true;
  zones.enter('meadow');
  if (which === 'square') walker.place(-4, 22, 0);
  else {
    const hex = hexes.list.find((h) => h.id === 'meadow');
    if (hex) hexes.enter(hex);
  }
  e.preventDefault();
  e.stopPropagation();
}));
addEventListener('pointerup', (e) => { if (!playtest) pets.tap(e, camera); });
const quest = createQuest({ walker, zones, spells });
spellsBar.select(spells?.selected ?? 0);
const discToggle = document.getElementById('discToggle');
document.getElementById('discPrev')?.addEventListener('pointerup', (e) => { spells?.select((spells.selected || 0) - 1); e.preventDefault(); e.stopPropagation(); });
document.getElementById('discNext')?.addEventListener('pointerup', (e) => { spells?.select((spells.selected || 0) + 1); e.preventDefault(); e.stopPropagation(); });
document.getElementById('discCharge')?.addEventListener('pointerdown', (e) => { spells?.press(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('discCharge')?.addEventListener('pointerup', (e) => { spells?.release(); e.preventDefault(); e.stopPropagation(); });
document.getElementById('discCharge')?.addEventListener('pointercancel', (e) => { spells?.release(); e.preventDefault(); });
document.getElementById('discFire')?.addEventListener('pointerup', (e) => {
  spells?.press();
  setTimeout(() => spells?.release(), 40);
  e.preventDefault();
  e.stopPropagation();
});
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
  return { dx, dy, r, R: s.r, hit: r <= s.r * (s.grab || 1.15), hole: s.hole || 0.38 };
};
addEventListener('pointerdown', (e) => {
  if (!discOn || kit !== 'mage' || !spells) return;
  if (e.target.closest && e.target.closest('#discActs')) return;
  const at = discAt(e);
  if (!at.hit) return;
  e.preventDefault();
  e.stopPropagation();
  discX = e.clientX;
  if (at.r > at.R * at.hole) {
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
if (sound && !capture) {
  for (const what of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) addEventListener(what, () => sound.wake(), true);
  addEventListener('keydown', (e) => { if (e.code === 'KeyM') sound.quiet = !sound.quiet; });
}

if (sound && spells) spells.hear = (what, o) => sound.cue(what, o);
if (sound) living.hear = (tier) => sound.chime(tier || 'rare');
if (sound && !capture) document.addEventListener('visibilitychange', () => { if (document.hidden) sound.sleep(); });

// The one clock. Everything that moves is a function of it; `pace` is how fast it runs (1 as a rule).
const clock = { pace: 1 };
const settings = { hands: false, class: savedClass(), blade: false, gunner: false, gfx: phone ? 'low' : 'high', viewBack: true, look: 'B', jiggle: 'soft' };
settings.blade = settings.class === 'blade';
settings.gunner = settings.class === 'gunner';
try {
  const savedLook = localStorage.getItem('aro-look');
  if (savedLook === 'A' || savedLook === 'B' || savedLook === 'C') settings.look = savedLook;
  const savedJiggle = localStorage.getItem('aro-jiggle');
  if (savedJiggle === 'off' || savedJiggle === 'soft' || savedJiggle === 'full') settings.jiggle = savedJiggle;
} catch { /* private mode */ }
if (playtest) {
  const qq = q.get('q');
  if (qq === 'low' || qq === 'high') settings.gfx = qq;
  if (settings.gfx === 'low') {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    appeal.quality = 0;
    post.grade = 0;
    zones.setDetail(true);
  }
  const look = (q.get('look') || '').toUpperCase();
  if (look === 'A' || look === 'B' || look === 'C') settings.look = look;
  avatar.setTier(settings.gfx === 'low' ? 'Phone' : 'High');
}
if (settings.look !== 'B') avatar.setLetter(settings.look);
avatar.setJiggle(settings.jiggle);
document.querySelectorAll('[data-gfx]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-gfx') === settings.gfx));
const followCam = { yaw: walker.yaw, pitch: 0.22, dist: 3.35, want: 3.35, pos: new THREE.Vector3(), look: new THREE.Vector3(), born: false };
function chaseLabel() {
  const b = document.getElementById('chase');
  if (!b) return;
  if (typeof zones !== 'undefined' && zones.atLake) b.textContent = settings.viewBack ? 'Near' : 'Far';
  else b.textContent = settings.class === 'mage' ? (settings.viewBack ? 'Eyes' : 'Zoom') : (settings.viewBack ? 'Far' : 'Near');
  b.classList.toggle('on', settings.viewBack);
}
document.getElementById('chase')?.addEventListener('pointerup', (e) => {
  settings.viewBack = !settings.viewBack;
  chaseLabel();
  e.preventDefault();
  e.stopPropagation();
});
chaseLabel();
const handsEl = document.getElementById('hands');
const gear = document.getElementById('gear');
const settingsEl = document.getElementById('settings');
gear?.addEventListener('pointerup', (e) => {
  const menu = document.getElementById('menu');
  if (menu) menu.hidden = false;
  document.querySelector('[data-menu="settings"]')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  if (settingsEl) settingsEl.hidden = false;
  e.preventDefault();
  e.stopPropagation();
});
document.getElementById('setX')?.addEventListener('pointerup', (e) => {
  const menu = document.getElementById('menu');
  if (menu) menu.hidden = true;
  if (settingsEl) settingsEl.hidden = true;
  e.preventDefault();
  e.stopPropagation();
});
document.getElementById('raidTest')?.addEventListener('pointerup', (e) => {
  if (settingsEl) settingsEl.hidden = true;
  document.getElementById('menu') && (document.getElementById('menu').hidden = true);
  zones.enter('meadow');
  duel.beginRaid('Hex brute');
  e.preventDefault();
  e.stopPropagation();
});
document.getElementById('petArena')?.addEventListener('pointerup', (e) => {
  if (settingsEl) settingsEl.hidden = true;
  document.getElementById('menu') && (document.getElementById('menu').hidden = true);
  zones.enter('meadow');
  duel.begin({ foe: 'deer' });
  e.preventDefault();
  e.stopPropagation();
});
document.getElementById('hexDuel')?.addEventListener('pointerup', (e) => {
  const foe = hexes.foe();
  document.getElementById('hexcard') && (document.getElementById('hexcard').hidden = true);
  zones.enter('meadow');
  duel.begin({ foe });
  e.preventDefault();
  e.stopPropagation();
});
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
  const live = ['blade', 'gunner', 'summoner', 'puppet', 'ranger', 'warden', 'alchemist'];
  settings.class = live.includes(name) ? name : 'mage';
  rememberClass(settings.class);
  settings.blade = settings.class === 'blade';
  settings.gunner = settings.class === 'gunner';
  arms.load();
  chaseLabel();
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
  try { localStorage.setItem('aro-gfx', settings.gfx); } catch { /* private mode */ }
  settingsEl.querySelectorAll('[data-gfx]').forEach((t) => t.classList.toggle('on', t === b));
  const low = settings.gfx === 'low';
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = !low && !phone;
  renderer.shadowMap.type = low || phone ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  appeal.quality = !low;
  post.grade = !low;
  zones.setDetail(low || phone);
  avatar.setTier(low || phone ? 'Phone' : 'High');
  arms.load({ letter: settings.look, tier: armTier() });
  fitView();
  e.preventDefault(); e.stopPropagation();
}));
function showLook() {
  document.querySelectorAll('[data-look]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-look') === settings.look));
  document.querySelectorAll('[data-jiggle]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-jiggle') === settings.jiggle));
  document.querySelectorAll('[data-familiar]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-familiar') === familiar.kind));
}
showLook();
document.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('pointerup', (e) => {
  settings.look = b.getAttribute('data-look') || 'B';
  try { localStorage.setItem('aro-look', settings.look); } catch { /* private mode */ }
  avatar.setLetter(settings.look);
  arms.load({ letter: settings.look, tier: armTier() });
  showLook();
  e.preventDefault(); e.stopPropagation();
}));
document.querySelectorAll('[data-familiar]').forEach((b) => b.addEventListener('pointerup', (e) => {
  familiar.show(b.getAttribute('data-familiar'));
  showLook();
  e.preventDefault(); e.stopPropagation();
}));
document.querySelectorAll('[data-jiggle]').forEach((b) => b.addEventListener('pointerup', (e) => {
  settings.jiggle = b.getAttribute('data-jiggle') || 'soft';
  try { localStorage.setItem('aro-jiggle', settings.jiggle); } catch { /* private mode */ }
  avatar.setJiggle(settings.jiggle);
  showLook();
  e.preventDefault(); e.stopPropagation();
}));
const paintBtn = document.getElementById('paintToggle');
if (paintBtn) {
  paintBtn.textContent = painted ? 'Painted: on' : 'Painted: off';
  paintBtn.classList.toggle('on', painted);
  paintBtn.addEventListener('pointerup', (e) => {
    painted = !painted;
    post.paint = painted;
    paintBtn.textContent = painted ? 'Painted: on' : 'Painted: off';
    paintBtn.classList.toggle('on', painted);
    try { localStorage.setItem('aro-paint', painted ? '1' : '0'); } catch { /* private mode */ }
    e.preventDefault(); e.stopPropagation();
  });
}
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
function readAudio() {
  try { return JSON.parse(localStorage.getItem('aro-audio') || '{}'); } catch { return {}; }
}
function applyAudio() {
  if (!sound) return;
  const saved = readAudio();
  const master = Number.isFinite(saved.master) ? saved.master : 65;
  const music = Number.isFinite(saved.music) ? saved.music : 50;
  const sfx = Number.isFinite(saved.sfx) ? saved.sfx : 70;
  sound.volume = master / 100;
  sound.music = music / 100;
  sound.sfx = sfx / 100;
  const vol = document.getElementById('vol');
  const mus = document.getElementById('music');
  const fx = document.getElementById('sfx');
  if (vol) vol.value = String(master);
  if (mus) mus.value = String(music);
  if (fx) fx.value = String(sfx);
}
function storeAudio() {
  const vol = document.getElementById('vol');
  const mus = document.getElementById('music');
  const fx = document.getElementById('sfx');
  try {
    localStorage.setItem('aro-audio', JSON.stringify({
      master: Number(vol?.value ?? 65),
      music: Number(mus?.value ?? 50),
      sfx: Number(fx?.value ?? 70),
    }));
  } catch { /* private mode */ }
}
applyAudio();
document.getElementById('vol')?.addEventListener('input', (e) => { if (sound) sound.volume = Number(e.target.value) / 100; storeAudio(); sound?.ui(); });
document.getElementById('music')?.addEventListener('input', (e) => { if (sound) sound.music = Number(e.target.value) / 100; storeAudio(); });
document.getElementById('sfx')?.addEventListener('input', (e) => { if (sound) sound.sfx = Number(e.target.value) / 100; storeAudio(); });
addEventListener('pointerup', (e) => {
  if (e.target?.closest?.('button')) sound?.ui();
});
const arms = createArms(scene);
const armTier = () => (phone || settings.gfx === 'low' ? 'Phone' : 'High');
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
const blade = createBlade((damage) => zones.launchNearest(damage, blade.locked), { scene, camera, world, zones, walker, air, fx, sword, sound });
applyMood(readMood(), false);
const gun = createGunner(scene, camera, world, zones, fire);
const groundAt = (x, z) => (ar.on ? ar.floorY : world.ground(x, z));
const ranger = createRanger({ scene, camera, world, zones, walker, fire, living, ground: groundAt });
zones.whenClear(() => ranger.restock());
zones.hexOf = (x, z) => hexes.at(x, z);
const warden = createWarden({ scene, camera, world, zones, walker, pets, ground: groundAt });
const alchemist = createAlchemist({ scene, camera, world, zones, walker, fire, living, ground: groundAt });
const summoner = createSummoner({ scene, camera, world, zones, walker, staff, beam });
const puppet = createPuppetmaster({ scene, world, zones, walker });
function buzz(kind) {
  const phoneTap = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (!phoneTap || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const ms = kind === 'bite' ? 28 : kind === 'catch' ? 22 : 16;
  try { navigator.vibrate(ms); } catch { /* this phone stays still */ }
}
const classBind = {
  foe: () => (duel.active ? duel.foeSpot() : null),
  wound: (n, x, z) => duel.wound(n, x, z),
  mendPet: (n) => duel.mendPet(n),
  snareRaid: (s) => duel.snareRaid(s),
  smokeRaid: (s) => duel.smokeRaid(s),
  buzz,
};
summoner.bind(classBind);
ranger.bind(classBind);
warden.bind(classBind);
alchemist.bind(classBind);
zones.ward = (n) => warden.soak(n);
zones.buzz = buzz;
world.cobble = (x, z) => zones.town?.nearCobble?.(x, z);
let hitFreeze = 0;
let hitShake = 0;
zones.feel = (hit) => {
  if (hit.heavy) hitFreeze = Math.max(hitFreeze, Math.min(0.07, 0.04 + (hit.dealt || 12) * 0.0012));
  hitShake = Math.max(hitShake, Math.min(0.2, (hit.heavy ? 0.05 : 0.02) + (hit.dealt || 4) * 0.003));
  sound?.hit?.({ heavy: !!hit.heavy, crit: !!hit.crit });
  if (hit.heavy) buzz('hit');
};
duel.bind({ calm: () => warden.aura() });
puppet.bind(classBind);
if (settings.class !== 'mage') showClass();
camera.layers.enable(9);
let padCast = false, forceDraw = false, chaseDist = 0, greetWho = '', greetUntil = 0, lakeWide = false, playFrames = 0;
const tour = { t: 0, done: false, live: false };
function playMove() {
  const t = tour.t;
  const blank = { move: { x: 0, y: 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, turn: 0, device: 'keyboard', cast: null, spell: 0, pause: false, any: false };
  if (!tour.live || t >= 53) return blank;
  if (t < 10) return { ...blank, move: { x: 0, y: 1 }, walk: true, any: true, turn: Math.sin(t * 0.9) * 0.4 };
  if (t < 18) return { ...blank, move: { x: 0, y: 1 }, any: true };
  if (t < 28) {
    const u = t - 18;
    return { ...blank, move: { x: 0, y: 1 }, sprint: true, any: true, turn: u < 3.2 ? 0.65 : u < 6.4 ? -0.7 : 0.12 };
  }
  if (t < 48) return { ...blank, move: { x: 0, y: 1 }, any: true };
  return blank;
}
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
function pullFollow(from, to) {
  const vx = to.x - from.x, vy = to.y - from.y, vz = to.z - from.z;
  let span = Math.hypot(vx, vy, vz);
  if (span < 0.05) return span;
  const cols = world.colliders || [];
  for (const c of cols) {
    if (c.tree?.down) continue;
    const vv = vx * vx + vz * vz;
    const t = vv > 1e-4 ? Math.min(1, Math.max(0, ((c.x - from.x) * vx + (c.z - from.z) * vz) / vv)) : 0;
    const px = from.x + vx * t, pz = from.z + vz * t;
    if (Math.hypot(px - c.x, pz - c.z) < c.r + 0.3) span = Math.min(span, Math.max(1.65, t * span - 0.2));
  }
  return span;
}

function applyFollow(dt) {
  const yaw = followCam.yaw;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const shoulder = 0.34;
  const look = followCam.look.set(
    walker.feet.x + rx * shoulder + fx * 0.4,
    walker.feet.y + 1.32,
    walker.feet.z + rz * shoulder + fz * 0.4,
  );
  const lift = 0.42 + followCam.pitch * 1.05;
  const aim = new THREE.Vector3(look.x - fx * followCam.dist + rx * 0.16, look.y + lift, look.z - fz * followCam.dist + rz * 0.16);
  const floor = world.ground(aim.x, aim.z) + 0.4;
  if (aim.y < floor) aim.y = floor;
  const span = pullFollow(look, aim);
  if (span < 1.65) { walker.look(camera); return; }
  const dir = aim.clone().sub(look);
  const len = dir.length() || 1;
  aim.copy(look).addScaledVector(dir.multiplyScalar(1 / len), span);
  const k = followCam.born ? 1 - Math.exp(-dt * 7) : 1;
  followCam.born = true;
  followCam.dist += (followCam.want - followCam.dist) * k;
  followCam.pos.x += (aim.x - followCam.pos.x) * k;
  followCam.pos.y += (aim.y - followCam.pos.y) * k;
  followCam.pos.z += (aim.z - followCam.pos.z) * k;
  camera.position.copy(followCam.pos);
  camera.lookAt(followCam.look);
}

let xrFrame = null;
let xrHeld = null;
let xrSelectCast = false;
const xrGaze = new THREE.Vector3();
let wheelOpen = false;
let wheelFromHold = false;
let selectHold = 0;
let drawArmed = false;
let castArmed = false;
const xrWheel = new THREE.Group();
xrWheel.name = 'xr-wheel';
xrWheel.visible = false;
scene.add(xrWheel);
const xrWedges = [];
const wheelLook = new THREE.Vector3();
const wheelAt = new THREE.Vector3();
function wheelList() {
  if (settings.class === 'mage') return SPELLS.map((s) => ({ name: s.name, colour: s.colour }));
  return (KIT_ATK[settings.class] || []).map((a) => ({ name: a.name, colour: a.colour }));
}
function openWheel() {
  const list = wheelList();
  while (xrWheel.children.length) xrWheel.remove(xrWheel.children[0]);
  xrWedges.length = 0;
  const n = Math.max(1, list.length);
  list.forEach((item, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshBasicMaterial({ color: item.colour, transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.set(Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0);
    xrWheel.add(mesh);
    xrWedges.push(mesh);
  });
  xrWheel.visible = true;
  wheelOpen = true;
}
function closeWheel() {
  wheelOpen = false;
  wheelFromHold = false;
  xrWheel.visible = false;
  ar.cue('');
}
function gazeWheel() {
  const list = wheelList();
  if (!list.length || !xrWedges.length) return;
  camera.getWorldDirection(wheelLook);
  xrWheel.position.copy(camera.position).addScaledVector(wheelLook, 0.95);
  xrWheel.quaternion.copy(camera.quaternion);
  let best = 0;
  let bestD = -1;
  xrWedges.forEach((w, i) => {
    w.getWorldPosition(wheelAt);
    wheelAt.sub(camera.position).normalize();
    const d = wheelAt.dot(wheelLook);
    if (d > bestD) { bestD = d; best = i; }
  });
  xrWedges.forEach((w, i) => w.scale.setScalar(i === best ? 1.5 : 0.86));
  if (settings.class === 'mage') spells?.select(best);
  else { atk = best; kitBar.select(best); }
  ar.cue(list[best]?.name || '');
}
function firePrimary(down) {
  const klass = settings.class;
  if (KIT_ATK[klass]) useAttack(klass, atk, down);
  else if (down) spells?.press();
  else spells?.release();
}
function tick(frameDt) {
  const fixed = playtest;
  const burst = q.has('clip') && tour.live ? 16 : 1;
  for (let n = 0; n < burst; n++) {
    if (fixed && tour.live) {
      const prev = tour.t;
      tour.t += 1 / 30;
      if (prev < 42 && tour.t >= 42) {
        walker.yaw += Math.PI;
        followCam.yaw += Math.PI;
      }
    }
    let budget = fixed ? 1 / 30 : Math.min(Math.max(frameDt || 0, 0), 0.25);
    const slices = [];
    while (budget > 1e-4) {
      const h = Math.min(1 / 15, budget);
      slices.push(h);
      budget -= h;
    }
    if (!slices.length) slices.push(fixed ? 1 / 30 : 1 / 60);
    const lastBurst = n === burst - 1;
    for (let i = 0; i < slices.length; i++) tickStep(slices[i], lastBurst && i === slices.length - 1);
    if (fixed && tour.live) playFrames += 1;
  }
  if (fixed) {
    const counter = document.getElementById('playframes');
    if (counter) counter.textContent = String(playFrames);
  }
}

function tickStep(dt, draw) {
  const frame = dt;
  if (hitFreeze > 0) {
    hitFreeze = Math.max(0, hitFreeze - frame);
    dt *= 0.06;
  }
  const xrLive = !!(ar.xr && renderer.xr.isPresenting);
  if (xrFrame) ar.sample(xrFrame);
  // (a blast all but stops time for the instant it lands)
  const pace = clock.pace * blast.pace * hole.pace;
  if (hopCool > 0) hopCool -= dt;
  // (a singularity opens the eye wider)
  if (Math.abs(camera.fov - (world.fov + hole.fov)) > 0.01) { camera.fov = world.fov + hole.fov; camera.updateProjectionMatrix(); }
  air.uniforms.uNow.value += dt * pace;
  const inp = input.read(dt);
  const planted = zones.name !== 'hub' && settings.class === 'blade' && blade.pad;
  const melee = zones.name !== 'hub' && (settings.class === 'blade' || settings.class === 'gunner');
  const summonerOn = zones.name !== 'hub' && settings.class === 'summoner';
  const puppetOn = zones.name !== 'hub' && settings.class === 'puppet';
  const rangerOn = zones.name !== 'hub' && settings.class === 'ranger';
  const wardenOn = zones.name !== 'hub' && settings.class === 'warden';
  const alchemistOn = zones.name !== 'hub' && settings.class === 'alchemist';
  const kitOn = melee || summonerOn || puppetOn || rangerOn || wardenOn || alchemistOn;
  applyKit(kitOn ? settings.class : 'mage');
  if (discToggle) discToggle.hidden = kit !== 'mage';
  if (zones.blocksMagic) {
    zones.castHeld(!!inp.cast, !padCast && !!inp.cast, padCast && !inp.cast);
    padCast = !!inp.cast;
    spells?.release();
  } else if (kitOn) {
    spells?.release();
    const list = KIT_ATK[settings.class] || BLADE_ATK;
    if (inp.spell) { atk = (atk + inp.spell + list.length) % list.length; kitBar.select(atk); }
    if (inp.cast !== null && inp.cast !== padCast) { const down = !!inp.cast; padCast = !!inp.cast; useAttack(settings.class, atk, down); }
    if (settings.class === 'summoner') kitBar.charge?.(summoner.fill || 0);
    if (settings.class === 'puppet') kitBar.charge?.(puppet.bash || 0);
    if (settings.class === 'ranger') kitBar.charge?.(ranger.charge || 0);
    if (settings.class === 'warden') kitBar.charge?.(warden.calm || 0);
  } else if (spells) {
    if (inp.cast !== null && inp.cast !== padCast) { padCast = inp.cast; if (padCast) { spells.press(); sound?.cast('mage'); } else spells.release(); }
    if (inp.spell) spells.select(spells.selected + inp.spell);
  }
  if (xrLive) {
    const drawing = settings.class === 'ranger' && RANGER_ATK[atk]?.key === 'draw';
    const charged = drawing || settings.class === 'mage';
    if (ar.squeezeHeld && !wheelOpen) { openWheel(); wheelFromHold = false; }
    if (!ar.squeezeHeld && wheelOpen && !wheelFromHold) closeWheel();
    if (ar.selectHeld) {
      if (selectHold === 0 && !wheelOpen && charged) {
        if (drawing) { ranger.chargeStart(); drawArmed = true; }
        else { firePrimary(true); castArmed = true; }
      }
      selectHold += dt;
      if (!wheelOpen && !drawing && selectHold > 0.55) {
        spells?.cancel();
        if (castArmed) { firePrimary(false); castArmed = false; }
        openWheel();
        wheelFromHold = true;
      }
    } else {
      if (wheelFromHold && wheelOpen) { closeWheel(); wheelFromHold = false; }
      else if (drawArmed) ranger.chargeRelease();
      else if (castArmed) firePrimary(false);
      else if (!wheelOpen && selectHold >= 0.02 && selectHold < 0.55) { firePrimary(true); firePrimary(false); }
      selectHold = 0;
      drawArmed = false;
      castArmed = false;
    }
    if (wheelOpen) gazeWheel();
  } else {
    if (wheelOpen) closeWheel();
    if (drawArmed) { ranger.chargeRelease(); drawArmed = false; }
    if (castArmed) { firePrimary(false); castArmed = false; }
    selectHold = 0;
  }
  zones.showMage(settings.class === 'mage' && settings.viewBack && zones.name !== 'hub' && zones.name !== 'deck' && !avatar.ready);
  zones.aim({
    x: walker.feet.x,
    z: walker.feet.z,
    fight: settings.monsters !== 'passive',
    block: settings.class === 'blade' && !!blade.blocking,
    guard: settings.class === 'warden' && warden.guard > 0,
    dodge: settings.class === 'ranger' && ranger.iframe > 0,
    sip: settings.class === 'alchemist' && alchemist.hot > 0,
    onParry: () => blade.parry(),
  });
  zones.update(dt, { mood: mind.mood('maren') });
  appeal.scan(scene);
  appeal.update(dt);
  post.dusk = !!zones.dusk && zones.name !== 'hub';
  if (zones.name !== 'hub') {
    const card = document.getElementById('hearthGreet');
    if (card) card.hidden = true;
    greetWho = '';
  }
  if (zones.name === 'hub') {
    zones.roomWeather = living.weather;
    const who = zones.nearFriend;
    const card = document.getElementById('hearthGreet');
    if (who && who !== greetWho && walker.speed < 0.4) {
      greetWho = who;
      greetUntil = performance.now() + 4000;
      const names = { maren: 'Maren', sable: 'Sable', bram: 'Bram', lumen: 'Lumen' };
      const ctx = { name: names[who] || who, weather: living.weather, dusk: zones.dusk };
      mind.talk(who, '', ctx).then((line) => {
        if (greetWho !== who || !card) return;
        const nameEl = document.getElementById('greetName');
        const lineEl = document.getElementById('greetLine');
        if (nameEl) nameEl.textContent = `${ctx.name} · ${mind.mood(who)}`;
        if (lineEl) lineEl.textContent = line;
        card.hidden = false;
      });
    } else if (!who && card) {
      greetWho = '';
      card.hidden = true;
    }
    if (card && !card.hidden && performance.now() > greetUntil) card.hidden = true;
  }
  quest?.update();
  if (inp.any) sound?.wake();
  const bladeClose = settings.class === 'blade' && blade.drawn && blade.pad;
  const inHub = zones.name === 'hub';
  const raidOwn = !!duel.playerCam;
  const raidSweep = !!duel.sweep;
  const mapFollow = !free && (!duel.active || raidOwn) && !raidSweep && !ar.on && !bladeClose && settings.viewBack && zones.name === 'meadow' && !zones.atLake;
  const stepInp = { ...inp, look: { x: inp.look.x, y: inp.look.y }, move: planted ? { x: 0, y: 0 } : inp.move, jump: planted ? false : inp.jump, sprint: planted ? false : inp.sprint };
  if (stepInp.turn) followCam.yaw -= stepInp.turn * 1.8 * dt;
  const orbiting = playtest && tour.t >= 28 && tour.t < 36;
  if (playtest) {
    settings.viewBack = !(tour.t >= 48 && tour.t < 53);
    settings.monsters = 'passive';
    for (const b of zones.live()) {
      if (!b.g || b.where !== 'meadow') continue;
      const far = Math.hypot(b.g.position.x - walker.feet.x, b.g.position.z - walker.feet.z) > 40;
      b.g.visible = far && !b.dead;
    }
    if (tour.t >= 56 && !tour.done) {
      tour.done = true;
      const tag = document.getElementById('tourdne');
      if (tag) tag.hidden = false;
    }
  }
  if (mapFollow && !orbiting) {
    followCam.yaw -= stepInp.look.x;
    followCam.pitch = THREE.MathUtils.clamp(followCam.pitch + stepInp.look.y * 0.85, 0.08, 1.15);
    if (stepInp.zoom) followCam.want = THREE.MathUtils.clamp(followCam.want + stepInp.zoom * 0.38, 1.85, 7.2);
    if (Math.hypot(stepInp.move.x, stepInp.move.y) > 0.08) {
      const dy = Math.atan2(Math.sin(followCam.yaw - walker.yaw), Math.cos(followCam.yaw - walker.yaw));
      walker.yaw += dy * (1 - Math.exp(-dt * 9));
    }
    stepInp.look.x = 0;
    stepInp.look.y = 0;
  }
  walker.update(frame, stepInp);
  if (xrLive) {
    if (!xrHeld) xrHeld = { x: walker.feet.x, z: walker.feet.z, yaw: walker.yaw };
    renderer.xr.updateCamera(camera);
    ar.seat(camera);
    camera.getWorldDirection(xrGaze);
    walker.feet.x = camera.position.x;
    walker.feet.z = camera.position.z;
    walker.feet.y = ar.floorY;
    walker.yaw = Math.atan2(xrGaze.x, xrGaze.z);
  } else if (xrHeld) {
    const back = xrHeld;
    xrHeld = null;
    walker.place(back.x, back.z, back.yaw);
    if (ar.on) ar.unseat(walker);
  }
  if (!xrLive) {
  if (duel.active && !raidOwn) duel.look(camera);
  else if (free) { camera.position.copy(free.position); camera.lookAt(free.target); }
  else walker.look(camera);
  if (ar.on && !ar.xr && !free) { camera.rotateX(ar.gyro.pitch); camera.rotateZ(-ar.gyro.roll); }
  if (ar.shake > 0.002) {
    const s = ar.shake;
    camera.rotateX(Math.sin(performance.now() * 0.05) * 0.012 * s);
    camera.rotateZ(Math.sin(performance.now() * 0.04) * 0.008 * s);
  }
  }
  const wantChase = !ar.on && !raidSweep && !free && !bladeClose && !inHub && !mapFollow && (settings.class === 'mage' ? settings.viewBack : (settings.viewBack || walker.speed > 1.15));
  const wantDist = settings.viewBack ? 4.4 : 2.5 + Math.min(2.1, Math.max(0, walker.speed - 1) * 0.32);
  chaseDist += ((wantChase ? wantDist : 0) - chaseDist) * Math.min(1, dt * 3.2);
  const chasing = mapFollow || chaseDist > 0.45;
  const inCity = zones.name === 'block' || zones.name === 'ruin';
  const hiLook = settings.gfx !== 'low' && !phone && !ar.on;
  post.bloom = hiLook && (inCity || zones.name === 'meadow' || zones.name === 'hub');
  post.direct = !!(phone && ar.on);
  post.bloomStrength = inCity ? 0.48 : zones.name === 'hub' ? 0.05 : 0.16;
  post.bloomThreshold = inCity ? 0.9 : zones.name === 'hub' ? 1.25 : 0.7;
  if (zones.atLake && !lakeWide) { settings.viewBack = true; lakeWide = true; chaseLabel(); }
  if (!zones.atLake) lakeWide = false;
  if (xrLive) { /* the viewer pose is the camera */ }
  else if (inHub && !free && !duel.active) {
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const dist = 3.1;
    const x = Math.max(-4.2, Math.min(4.2, walker.feet.x - fx * dist));
    const z = Math.max(-5.2, Math.min(5.2, walker.feet.z - fz * dist));
    camera.position.set(x, walker.feet.y + 1.62, z);
    camera.lookAt(walker.feet.x + fx * 1.1, walker.feet.y + 1.05, walker.feet.z + fz * 1.1);
    const headGap = Math.hypot(camera.position.x - walker.feet.x, camera.position.y - walker.feet.y - 1.5, camera.position.z - walker.feet.z);
    if (headGap < 0.95) walker.look(camera);
  } else if (zones.name === 'deck' && !free && !duel.active) {
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    camera.position.set(walker.feet.x - fx * 1.7, walker.feet.y + 1.58, walker.feet.z - fz * 1.7);
    camera.lookAt(walker.feet.x + fx * 6, walker.feet.y + 1.15, walker.feet.z + fz * 6);
  } else if (zones.atLake && !free && !duel.active) {
    const far = settings.viewBack;
    const dist = far ? 9.2 : 3.3;
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    camera.position.set(walker.feet.x - fx * dist, walker.feet.y + (far ? 3.6 : 1.7), walker.feet.z - fz * dist);
    camera.lookAt(walker.feet.x + fx * (far ? 14 : 4), walker.feet.y + 0.35, walker.feet.z + fz * (far ? 14 : 4));
  } else if (inCity && !free && !duel.active) {
    const a = zones.cityAngle || 0;
    camera.position.set(-2.35 + Math.sin(a) * 3.4, 1.28, 4.6 - Math.cos(a) * 0.8);
    camera.lookAt(-3.8, 0.72, -8);
  } else if (duel.active && !raidOwn && !raidSweep) {
    duel.look(camera);
  } else if (raidSweep) {
    duel.look(camera);
  } else if (mapFollow) {
    if (orbiting) {
      const u = Math.min(1, (tour.t - 28) / 8);
      followCam.yaw = walker.yaw + u * (Math.PI / 2);
      followCam.pitch = 0.7;
      followCam.want = 3.05;
      followCam.dist += (3.05 - followCam.dist) * Math.min(1, dt * 2);
    }
    applyFollow(dt);
  } else if (chasing) {
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    camera.position.set(walker.feet.x - fx * chaseDist, walker.feet.y + 1.55 + chaseDist * 0.12, walker.feet.z - fz * chaseDist);
    camera.lookAt(walker.feet.x + fx * 1.6, walker.feet.y + 1.15, walker.feet.z + fz * 1.6);
  }
  // (and shakes the eye)
  if (!xrLive && hitShake > 0.002) {
    hitShake = Math.max(0, hitShake - frame * 1.8);
    camera.rotateX(Math.sin(performance.now() * 0.08) * hitShake);
    camera.rotateZ(Math.sin(performance.now() * 0.05) * hitShake * 0.55);
  }
  if (!xrLive && blast.shake + hole.shake + twister.shake > 0.002) { const s = blast.shake + hole.shake + twister.shake * 0.5; shaking += dt; camera.rotateX(Math.sin(shaking * 61) * Math.sin(shaking * 37 + 1) * 0.03 * s); camera.rotateY(Math.sin(shaking * 53 + 2) * Math.sin(shaking * 29) * 0.03 * s); camera.rotateZ(Math.sin(shaking * 47 + 4) * 0.018 * s); }
  camera.updateMatrixWorld(true);
  const showBody = !!avatar.ready && !ar.on && !free && (zones.name === 'hub' || zones.name === 'block' || zones.name === 'deck' || zones.atLake || (zones.name === 'meadow' && settings.viewBack && followCam.dist > 1.15));
  avatar.update(dt, walker, showBody);
  world.update(dt, walker.feet, camera, walker.speed);
  const flats = air.uniforms.uFlat.value;
  for (const f of flats) f.w = 0;
  let flatN = 0;
  const pal = zones.buddyAt?.();
  if (pal) flats[flatN++].set(pal.x, pal.z, 0.95, 1);
  for (const b of zones.beasts()) {
    if (flatN >= 3 || b.dead) continue;
    if (Math.hypot(b.x - walker.feet.x, b.z - walker.feet.z) > 12) continue;
    flats[flatN++].set(b.x, b.z, 0.9, 1);
  }
  const cut = blade.cutFlat?.();
  if (cut) flats[3].set(cut.x, cut.z, cut.r, 1);
  staff?.update(dt, walker, camera, world.sunAt?.(camera.position) ?? 1);
  const fishPull = zones.fishZoom || 0;
  if (!xrLive && fishPull > 0.04 && !free && !chasing) {
    const yaw = walker.yaw;
    camera.position.x -= Math.sin(yaw) * fishPull * 0.35;
    camera.position.y += fishPull * 0.08;
    camera.position.z -= Math.cos(yaw) * fishPull * 0.35;
  }
  const lean = gun?.lean || 0;
  if (!xrLive && lean) {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    camera.position.addScaledVector(right, lean);
  }
  camera.updateMatrixWorld(true);
  zones.stickRod?.();
  const wheel = !playtest && discOn && kit === 'mage' && !melee && !zones.rodOut && zones.name !== 'hub' && zones.name !== 'block' && zones.name !== 'ruin' && !duel.active;
  const rangerBar = document.getElementById('rangerBar');
  const wardenBar = document.getElementById('wardenBar');
  const alchemistBar = document.getElementById('alchemistBar');
  const summonerBar = document.getElementById('summonerBar');
  if (rangerBar) rangerBar.hidden = !rangerOn;
  if (wardenBar) wardenBar.hidden = !wardenOn;
  if (alchemistBar) alchemistBar.hidden = !alchemistOn;
  if (summonerBar) summonerBar.hidden = !summonerOn;
  const puppetBar = document.getElementById('puppetBar');
  if (puppetBar) puppetBar.hidden = !puppetOn;
  ranger?.update(dt, rangerOn);
  warden?.update(dt, wardenOn);
  alchemist?.update(dt, alchemistOn);
  summoner?.update(dt, summonerOn);
  puppet?.update(dt, puppetOn);
  const armCharge = (discCharge || spells?.cast?.holding) ? Math.max(0.14, spells?.cast?.charge || 0) : 0;
  const handDisc = !!(ar.on || settings.hands);
  if (spells) spells.placeAr = !!ar.on;
  castDisc?.update(dt, wheel && !free, spells?.selected ?? 0, walker, camera, armCharge, !chasing && !free, wristPoint(), ar.on, handDisc);
  const acts = document.getElementById('discActs');
  if (acts) {
    const showActs = !playtest && phone && !!(wheel && castDisc?.ready && !handDisc);
    acts.hidden = !showActs;
    if (showActs && castDisc.screen?.on) {
      const s = castDisc.screen;
      const put = (id, x, y) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.style.left = `${x}px`;
        b.style.top = `${y}px`;
      };
      put('discPrev', s.x - s.r * 1.55, s.y);
      put('discNext', s.x + s.r * 1.55, s.y);
      put('discCharge', s.x, s.y + s.r * 1.45);
      put('discFire', s.x, s.y - s.r * 1.35);
    }
  }
  if (spells) {
    spells.floor = ar.on ? (origin, dir) => ar.hitFloor(origin, dir) : null;
    spells.floorY = ar.on ? ar.floorY : null;
  }
  ar.update(dt, walker, camera, { twister, spells, living });
  wander.update(dt, walker, camera, ar.on);
  if (folk.root) folk.root.visible = zones.name === 'meadow';
  if (zones.name === 'meadow') {
    const big = blast.phase === 'fall' || blast.phase === 'boom' || hole.phase === 'open' || hole.phase === 'shut' || twister.phase === 'live' || twister.phase === 'slam';
    folk.update(dt, walker, zones.dusk, {
      weather: living.weather,
      big,
      pet: pets.root?.visible ? pets.root.position : null,
    });
  }
  const petStand = xrLive ? { x: camera.position.x, z: camera.position.z, yaw: walker.yaw } : null;
  pets.update(dt, camera, ar.on ? ar.floorY : null, petStand);
  const xrLine = document.getElementById('xrCheck');
  if (xrLine) {
    const text = `XR self-check: ${ar.viewName()}`;
    if (xrLine.textContent !== text) xrLine.textContent = text;
  }
  street.sky = living.weather;
  world.rain = living.weather === 'rain';
  street.update(dt, walker, ar.on || zones.name === 'hub' || duel.active);
  duel.update(dt);
  if (hexes.layer) hexes.layer.visible = zones.name === 'meadow' && !playtest;
  hexes.update(dt);
  const spellBox = document.getElementById('spells');
  if (spellBox) {
    const closed = !!(zones.name === 'hub' || zones.rodOut || (wheel && castDisc?.ready));
    spellBox.classList.toggle('shut', closed && spellBox.classList.contains('ring'));
    if (!spellBox.classList.contains('ring') || !closed) spellBox.hidden = closed;
    else if (!spellBox._shut) spellBox._shut = setTimeout(() => { if (spellBox.classList.contains('shut')) spellBox.hidden = true; spellBox._shut = 0; }, 320);
    if (!closed) { clearTimeout(spellBox._shut); spellBox._shut = 0; spellBox.hidden = false; }
  }
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
  familiar.update(dt, walker, zones.name, phone || settings.gfx === 'low', camera);
  {
    const bed = zones.name === 'hub' ? 'hearth' : zones.name === 'deck' ? 'deck' : (zones.atLake || zones.name === 'block') ? 'water' : 'meadow';
    ambience.scene(bed, zones.boardSky?.().weather === 'Lantern Rain');
  }
  if (sound) {
    const night = zones.dusk || new Date().getHours() >= 19 || new Date().getHours() < 6;
    const bed = zones.atLake ? (night ? 'bed-lake-night' : 'bed-lake') : (world.cobble?.(walker.feet.x, walker.feet.z) ? 'bed-town' : 'bed-meadow');
    sound.bed(bed);
  }
  // (the rim of the spell in hand fills as it is gathered, and stands full while it is poured or held open)
  if (spells && kit === 'mage') {
    const c = spells.cast;
    kitBar.charge(c.holding ? c.charge : blast.charge > 0 ? blast.charge : c.pour || hole.phase === 'open' || twister.phase === 'gather' || twister.phase === 'live' ? 1 : 0);
    kitBar.cool(c.cool || 0);
    kitBar.paint?.(spells.slotCool);
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
  const casting = !!(inp.cast || spells?.cast?.holding || spells?.cast?.pour || (spells?.cast?.charge || 0) > 0.04);
  const mageEyes = klass === 'mage' && !chasing && !free && zones.name !== 'hub';
  const armsWanted = zones.name !== 'hub' && (klass === 'gunner' || settings.hands || mageEyes);
  if (armsWanted && !arms.loaded) arms.load({ letter: settings.look, tier: armTier() });
  const armsOn = armsWanted && arms.loaded;
  arms.rig.visible = !!armsOn;
  if (arms.rig.visible) {
    const rise = klass === 'mage' ? !!(casting || (wheel && castDisc?.ready)) : undefined;
    const ready = !!(klass === 'blade' || klass === 'gunner' || casting || zones.rodOut || zones.nearBeast < 7);
    arms.update(dt, camera, { ready, rise, speed: walker.speed, stride: walker.stride });
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
  const hideStaff = settings.class !== 'summoner';
  const hpEl = document.getElementById('hp');
  if (hpEl) hpEl.textContent = `HP ${Math.round(zones.hearts)}`;
  const questEl = document.getElementById('quest');
  if (questEl) {
    const open = ['catch', 'book', 'hexcard', 'home', 'crew', 'menu', 'settings', 'atlas', 'board'].some((id) => {
      const el = document.getElementById(id);
      return el && !el.hidden;
    });
    questEl.style.visibility = (open || zones.rodOut) ? 'hidden' : '';
  }
  if (draw && (!q.has('fast') || forceDraw)) {
    if (renderer.xr.isPresenting) renderer.render(scene, camera);
    else post.render(scene, camera, hideStaff ? null : staff, SUN);
    if (q.has('clip')) renderer.getContext().finish?.();
  }
  forceDraw = false;
}

// (the measuring tools were written for a figure seen from behind: these are the same handles on one seen from within)
const head = new THREE.Vector3();
let postcard = false;
function setPostcard(on) {
  postcard = !!on;
  document.body.classList.toggle('postcard', postcard);
  const bar = document.getElementById('postcard');
  if (bar) bar.hidden = !postcard;
  if (postcard) {
    const menu = document.getElementById('menu');
    if (menu) menu.hidden = true;
    document.exitPointerLock?.();
  }
}
function savePostcard() {
  const hideStaff = settings.class !== 'summoner';
  if (renderer.xr.isPresenting) renderer.render(scene, camera);
  else post.render(scene, camera, hideStaff ? null : staff, SUN);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = 'aro-postcard.png';
  a.click();
}
document.getElementById('postcardOpen')?.addEventListener('pointerup', (e) => { setPostcard(true); e.preventDefault(); e.stopPropagation(); });
document.getElementById('postcardExit')?.addEventListener('pointerup', (e) => { setPostcard(false); e.preventDefault(); e.stopPropagation(); });
document.getElementById('postcardSave')?.addEventListener('pointerup', (e) => { savePostcard(); e.preventDefault(); e.stopPropagation(); });
const ambienceBtn = document.getElementById('ambienceToggle');
if (ambienceBtn) {
  const paintAmb = () => { ambienceBtn.textContent = ambience.on ? 'Ambience: on' : 'Ambience: off'; ambienceBtn.classList.toggle('on', ambience.on); };
  paintAmb();
  ambienceBtn.addEventListener('pointerup', (e) => { ambience.set(!ambience.on); paintAmb(); e.preventDefault(); e.stopPropagation(); });
}
const lab = window.lab = { castDisc, discOn: () => discOn, quest, ar, wander, living, street, duel, appeal, mind, hexes, hub, ranger, warden, alchemist, avatar, playtest, familiar, setPostcard, savePostcard,
  THREE, camera, input, post, renderer, scene, timings, world, walker, clock, air, fx, fire, flames, spells, ruin, blast, hole, twister, zones, settings, arms, blade, gun, summoner, tune: TUNE, way: world.way, heightAt: world.ground, ground: world.ground, counts: world.counts,
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
if (playtest) {
  try {
    input.override = () => playMove();
    input.lockable = false;
    zones.enter('meadow');
    applyMood('passive', false);
    document.body.classList.add('playtest');
    tour.t = 0;
    tour.live = false;
  } catch (err) {
    console.error('playtest', err);
  }
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
  if (q.has('clip') && going) {
    const pump = () => {
      if (tour.done) return;
      tick(1 / 30);
      setTimeout(pump, 40);
    };
    setTimeout(pump, 40);
    return;
  }
  renderer.setAnimationLoop(going ? (time, frame) => {
    xrFrame = frame || null;
    if (!renderer.xr.isPresenting && (innerWidth !== fitW || innerHeight !== fitH)) fitView();
    if (playtest) tick(1 / 30);
    else { const now = performance.now(); tick((now - last) / 1000); last = now; }
  } : null);
}
fitView();
loaded = true;
if (playtest) {
  try {
    input.override = () => playMove();
    input.lockable = false;
    zones.enter('meadow');
    applyMood('passive', false);
    document.body.classList.add('playtest');
    playFrames = 0;
    tour.t = 0;
    tour.live = true;
    title?.classList.add('gone');
    document.getElementById('hint')?.classList.add('off');
    const greet = document.getElementById('hearthGreet');
    if (greet) greet.hidden = true;
    const counter = document.createElement('div');
    counter.id = 'playframes';
    counter.textContent = '0';
    const tag = document.createElement('div');
    tag.id = 'tourdne';
    tag.textContent = 'tour done';
    tag.hidden = true;
    document.body.append(counter, tag);
  } catch (err) {
    console.error('playtest', err);
  }
}
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
    if (!pad && !testing && !playtest) dom.requestPointerLock?.()?.catch?.(() => {});
    setTimeout(() => hint.classList.add('faded'), 12000);
    run();
  };
  addEventListener('blur', () => setPaused(true));
  document.addEventListener('visibilitychange', () => { shown = !document.hidden; if (document.hidden) setPaused(true); else run(); });
  document.addEventListener('pointerlockchange', () => { const now = document.pointerLockElement === dom; if (locked && !now && !byPad) setPaused(true); locked = now; if (now) byPad = false; });
  addEventListener('keydown', (e) => {
    useDevice('keys');
    if (e.code === 'KeyH') hint.classList.toggle('off');
    if (settings.class === 'mage' && spells && /^Digit[1-7]$/.test(e.code)) spells.select(Number(e.code.slice(5)) - 1);
    if (KIT_ATK[settings.class] && /^Digit[1-6]$/.test(e.code)) {
      const list = KIT_ATK[settings.class];
      const i = Number(e.code.slice(5)) - 1;
      if (list[i]) { atk = i; kitBar.select(i); }
    }
    if (!begun) { if (!['F11', 'F12'].includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) start(false); return; }
    if (e.code === 'KeyP') { setPostcard(!postcard); return; }
    if (e.code === 'Escape' && postcard) { setPostcard(false); e.preventDefault(); return; }
  });
  addEventListener('mousedown', () => {
    if (performance.now() - (input.touchAt || 0) < 700) return;
    useDevice('keys'); if (!begun) start(false); else if (paused && !playtest) { dom.requestPointerLock?.()?.catch?.(() => {}); setPaused(false); }
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
lab.kitCount = (which) => (which === 'mage' ? SPELLS.length : (KIT_ATK[which]?.length || 0));
lab.act = (which, index, down) => {
  const name = ['mage', 'blade', 'gunner', 'summoner', 'puppet', 'warden', 'ranger', 'alchemist'].includes(which) ? which : 'mage';
  if (settings.class !== name) pickClass(name);
  if (name === 'mage') {
    spells?.select(index % SPELLS.length);
    if (down) spells?.press();
    else spells?.release();
    return;
  }
  const list = KIT_ATK[name] || [];
  if (!list[index]) return;
  atk = index;
  kitBar.select(index);
  useAttack(name, index, down);
};
