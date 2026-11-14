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
import { createSound } from './sound.js';
import { spellBar } from './hud.js';
import { createZones } from './zones.js';

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

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
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
const camera = new THREE.PerspectiveCamera(world.fov, innerWidth / innerHeight, 0.12, world.far);
fitting.push(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
// ?marks: a burnt patch and a frozen one by the start, to see that the ground takes what magic will write to it
if (q.has('marks')) { world.mark(-5, 27, 4.5, 0, 1); world.mark(5.5, 26, 4.5, 1, 1); }
lap('world');

say('Taking up the staff');
await turn();
const walker = new Walker(world);
const staff = q.has('nostaff') ? null : createStaff({ air, atlas: world.atlas });
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
const zones = createZones({ scene, world, walker, camera });
const spellsBar = spellBar(document.getElementById('spells'), SPELLS);
const beam = createBeam(air);
scene.add(beam.mesh);
const blast = createBlast({ air, world, fx, fire, ruin, scene });
const hole = createHole({ air, world, fx, fire, ruin, scene });
const twister = createTwister({ air, world, fx, fire, ruin, scene });
const spells = staff ? createSpells({ world, air, fx, fire, staff, beam, ruin, blast, hole, twister, camera, walker, dom: renderer.domElement, onSelect: (i) => spellsBar.select(i) }) : null;
spellsBar.select(spells?.selected ?? 0);
fitting.push(() => post.resize());
lap('staff');

// Sound. A film of the game is made with no clock and no sound card: then the sound is worked out alongside, frame by
// frame, only when it is asked for (?capture&sound=<seconds>).
let sound = null;
try { sound = q.has('nosound') || (capture && !q.get('sound')) ? null : createSound({ offline: capture ? Number(q.get('sound')) : 0 }); }
catch (e) { console.warn('no sound', e); }
if (sound && !capture) {
  for (const what of ['pointerdown', 'keydown']) addEventListener(what, () => sound.wake());
  addEventListener('keydown', (e) => { if (e.code === 'KeyM') sound.quiet = !sound.quiet; });
}

if (sound && spells) spells.hear = (what, o) => sound.cue(what, o);

// The one clock. Everything that moves is a function of it; `pace` is how fast it runs (1 as a rule).
const clock = { pace: 1 };
let padCast = false;
let free = null;
let shaking = 0;
const blastAt = new THREE.Vector3();
function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  // (a blast all but stops time for the instant it lands)
  const pace = clock.pace * blast.pace * hole.pace;
  // (a singularity opens the eye wider)
  if (Math.abs(camera.fov - (world.fov + hole.fov)) > 0.01) { camera.fov = world.fov + hole.fov; camera.updateProjectionMatrix(); }
  air.uniforms.uNow.value += dt * pace;
  const inp = input.read(dt);
  if (zones.blocksMagic) {
    if (inp.cast && !padCast) zones.onCast();
    padCast = !!inp.cast;
    spells?.release();
  } else if (spells) {
    if (inp.cast !== null && inp.cast !== padCast) { padCast = inp.cast; if (padCast) spells.press(); else spells.release(); }
    if (inp.spell) spells.select(spells.selected + inp.spell);
  }
  zones.update(dt);
  if (inp.any) sound?.wake();
  walker.update(dt, inp);
  if (free) { camera.position.copy(free.position); camera.lookAt(free.target); } else walker.look(camera);
  // (and shakes the eye)
  if (blast.shake + hole.shake + twister.shake > 0.002) { const s = blast.shake + hole.shake + twister.shake * 0.5; shaking += dt; camera.rotateX(Math.sin(shaking * 61) * Math.sin(shaking * 37 + 1) * 0.03 * s); camera.rotateY(Math.sin(shaking * 53 + 2) * Math.sin(shaking * 29) * 0.03 * s); camera.rotateZ(Math.sin(shaking * 47 + 4) * 0.018 * s); }
  camera.updateMatrixWorld(true);
  world.update(dt, walker.feet, camera, walker.speed);
  staff?.update(dt, walker, camera, world.sunAt?.(camera.position) ?? 1);
  ruin?.update(dt * pace);
  if (spells) spells.update(dt * pace, dt); else { blast.update(dt * pace, dt, camera.position); hole.update(dt * pace, dt, camera.position); twister.update(dt * pace, dt, camera.position); }
  fire.step(dt * pace, camera.position);
  fx.update(dt * pace);
  sound?.update(dt, { blast, hole, twister, ruin, camera, fire, cast: spells?.cast, world, walker });
  // (the rim of the spell in hand fills as it is gathered, and stands full while it is poured or held open)
  if (spells) { const c = spells.cast; spellsBar.charge(c.holding ? c.charge : blast.charge > 0 ? blast.charge : c.pour || hole.phase === 'open' || twister.phase === 'gather' || twister.phase === 'live' ? 1 : 0); }
  // (the day goes dark red for a blast being gathered, and violet for a singularity)
  // (and the grey of a storm for a whirlwind)
  if (twister.dark > hole.dark && twister.dark > blast.dark) { post.doom = twister.dark; post.doomTint(0.2 + 0.3 * twister.fire, 0.25 - 0.08 * twister.fire, 0.34 - 0.24 * twister.fire, 0.3); }
  else if (hole.dark > blast.dark) { post.doom = hole.dark; const g = hole.gone; post.doomTint(0.07 * (1 - g), 0.035 * (1 - g), 0.3 * (1 - 0.9 * g), 0.22 * (1 - g)); } else { post.doom = blast.dark; post.doomTint(0.5, 0.06, 0.05); }
  post.ink = blast.ink; post.white = Math.max(blast.white, hole.white, twister.white); post.blaze = blast.blaze;
  if (hole.shockP > 0) post.shock(camera, hole.centre, hole.shockR, hole.shockP); else post.shock(camera, blastAt.copy(blast.centre).setY(blast.centre.y + 3), blast.shockR, blast.shockP);
  post.hole(camera, hole.centre, hole.radius, hole.power, hole.blur, hole.reach * 1.05);
  post.heat = Math.min(1, fire.glare * 0.85 + (spells?.glare ?? 0) * 0.6);
  post.render(scene, camera, free ? null : staff, SUN);
}

// (the measuring tools were written for a figure seen from behind: these are the same handles on one seen from within)
const head = new THREE.Vector3();
const lab = window.lab = {
  THREE, camera, input, post, renderer, scene, timings, world, walker, clock, air, fx, fire, flames, spells, ruin, blast, hole, twister, zones, way: world.way, heightAt: world.ground, ground: world.ground, counts: world.counts,
  player: walker,
  follow: { get yaw() { return walker.yaw; }, set yaw(v) { walker.yaw = v; }, get pitch() { return walker.pitch; }, set pitch(v) { walker.pitch = v; }, want: 0, distance: 0, pivot: new THREE.Vector3() },
  doll: { man: { bones: { Head: { getWorldPosition: (v) => v.copy(walker.feet).setY(walker.feet.y + 1.66) } } } },
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
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
