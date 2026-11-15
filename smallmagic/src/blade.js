// A phone sword rhythm. The lanes, the cut, and the wall are the shape of Moon Rider
// (Supermedium, MIT). The pattern is original. No song and no BeatSaver map.
// Slice a small cue with a swipe. Step into another lane to pass a wall. Hold a big one.
// Four clean hits in a row launch the nearest beast. The staff is left alone.

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

export function createBlade(onLaunch) {
  let song = 0;
  let combo = 0;
  let cursor = 0;
  const notes = [];
  const hold = new Map();

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
    el.textContent = spec.kind === 'wall' ? 'WALL' : spec.kind === 'big' ? 'HOLD' : spec.dir.toUpperCase();
    lane.appendChild(el);
    notes.push({ ...spec, el, resolved: false });
  }

  function succeed(note) {
    if (note.resolved) return;
    note.resolved = true;
    note.el.classList.add('hit');
    combo += 1;
    say(combo >= 4 ? 'Launch' : `Combo ${combo}`);
    if (combo >= 4) {
      combo = 0;
      onLaunch?.();
    }
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

  function update(dt, active) {
    const board = root();
    const label = document.getElementById('bladeSay');
    if (!board) return;
    board.hidden = !active;
    if (label) label.hidden = !active;
    if (!active) return;
    wire();
    song += dt;
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
  };
}
