import * as THREE from 'three';

// A phone sword rhythm. The lanes, the cut, and the wall are the shape of Moon Rider
// (Supermedium, MIT). The pattern is original. No song and no BeatSaver map.
// Slice a small cue with a swipe. Step into another lane to pass a wall. Hold a big one.
// Four clean hits in a row launch the nearest beast. The staff is left alone.
// Block, held, raises a shield. A wolf's slow lob that meets it bounces back.
// A block pressed in the last moment shows Taunt. At most five bounced pieces live.

const LOOP = 4.6;
const APPROACH = 1.05;
const WINDOW = 0.2;
const PATTERN = [
  { t: 0.7, lane: 0, kind: 'slice', dir: 'right' },
  { t: 1.35, lane: 2, kind: 'slice', dir: 'left' },
  { t: 2.05, lane: 1, kind: 'wall' },
  { t: 2.8, lane: 1, kind: 'big' },
  { t: 3.55, lane: 0, kind: 'slice', dir: 'up' },
];

const root = () => document.getElementById('blade');
const GRAV = 14;
const MAX_BOUNCE = 5;

export function createBlade(onLaunch, bits = {}) {
  let song = 0;
  let combo = 0;
  let cursor = 0;
  let freeze = 0;
  let rush = null;
  const notes = [];
  const hold = new Map();
  const { scene, camera, world, zones } = bits;
  const shots = [];
  let blocking = false;
  let blockAt = 0;
  let lobCool = 1.4;
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

  function spawn(spec) {
    const board = root();
    const lane = board?.querySelector(`[data-lane="${spec.lane}"]`);
    if (!lane) return;
    const el = document.createElement('div');
    el.className = `note ${spec.kind}`;
    el.textContent = spec.kind === 'wall' ? 'WALL' : spec.kind === 'big' ? 'HOLD' : 'SWIPE';
    lane.appendChild(el);
    notes.push({ ...spec, el, resolved: false });
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

  function succeed(note) {
    if (note.resolved) return;
    note.resolved = true;
    note.el.classList.add('hit');
    flash();
    freeze = 0.08;
    combo += 1;
    say(combo >= 4 ? 'Sky Rush' : `Combo ${combo}`);
    if (combo >= 4) startRush();
  }

  function fail(note) {
    if (note.resolved) return;
    note.resolved = true;
    note.el.classList.add('miss');
    combo = 0;
    say('Miss');
  }

  function dirOf(dx, dy) {
    if (Math.hypot(dx, dy) < 18) return '';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  function live(note) {
    return !note.resolved && Math.abs(song - note.due) <= WINDOW;
  }

  function onDown(lane, e) {
    hold.set(e.pointerId, { lane, x: e.clientX, y: e.clientY, t: performance.now(), held: false });
    e.preventDefault();
    e.stopPropagation();
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
    for (const note of notes) {
      if (!live(note) || note.lane !== h.lane) continue;
      if (note.kind === 'slice' && swipe === note.dir) succeed(note);
      else if (note.kind === 'big' && h.held) succeed(note);
      else if (note.kind === 'wall') fail(note);
      else if (note.kind === 'slice') fail(note);
    }
    const wall = notes.find((note) => note.kind === 'wall' && live(note) && !note.resolved);
    if (wall && h.lane !== wall.lane && swipe) succeed(wall);
  }

  function wire() {
    const board = root();
    if (!board || board.dataset.wired) return;
    board.dataset.wired = '1';
    board.querySelectorAll('[data-lane]').forEach((lane) => {
      const n = Number(lane.dataset.lane);
      lane.addEventListener('pointerdown', (e) => onDown(n, e));
    });
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
    if (on) blockAt = performance.now();
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
    const perfect = performance.now() - blockAt < 220;
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
    if (!active) { blocking = false; return; }
    wireBlock();
    lobCool -= dt;
    if (lobCool <= 0) spawnLob();
    const eye = camera.position;
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.life -= dt;
      shot.v.y -= GRAV * dt;
      shot.mesh.position.addScaledVector(shot.v, dt);
      const gy = world.ground(shot.mesh.position.x, shot.mesh.position.z) + 0.2;
      if (shot.mesh.position.y < gy) { shot.mesh.position.y = gy; shot.v.y = Math.abs(shot.v.y) * 0.45; }
      if (shot.kind === 'lob') {
        const near = Math.hypot(shot.mesh.position.x - eye.x, shot.mesh.position.z - eye.z) < 1.15 && Math.abs(shot.mesh.position.y - eye.y) < 1.5;
        if (near && blocking) reflect(shot);
        else if (near) { say('Hit'); shot.life = 0; }
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

  function update(dt, active) {
    const board = root();
    const label = document.getElementById('bladeSay');
    if (!board) return;
    board.hidden = !active;
    if (label) label.hidden = !active;
    defense(dt, active);
    if (!active) return;
    wire();
    if (rush) {
      rush.t += dt;
      if (rush.t > 1.15) advanceRush(false);
      if (song > 0 && rush.t > 8) endRush();
      return;
    }
    if (freeze > 0) freeze -= dt;
    else song += dt;
    while (cursor < 400) {
      const spec = PATTERN[cursor % PATTERN.length];
      const due = spec.t + Math.floor(cursor / PATTERN.length) * LOOP;
      if (due > song + APPROACH) break;
      spawn({ ...spec, due });
      cursor += 1;
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      const along = 1 - (note.due - song) / APPROACH;
      note.el.style.top = `${Math.max(0, Math.min(86, along * 86))}%`;
      if (!note.resolved && song > note.due + WINDOW) fail(note);
      if (note.resolved && song > note.due + 0.45) {
        note.el.remove();
        notes.splice(i, 1);
      }
    }
  }

  return {
    update,
    get combo() { return combo; },
    get song() { return song; },
    setBlock,
    get incoming() { return shots.filter((s) => s.kind === 'lob' && s.life > 0).length; },
    get bounced() { return shots.filter((s) => s.kind === 'bounce' && s.life > 0).length; },
    get close() {
      if (!camera) return false;
      return shots.some((s) => s.kind === 'lob' && s.life > 0 && Math.hypot(s.mesh.position.x - camera.position.x, s.mesh.position.z - camera.position.z) < 2.4);
    },
  };
}
