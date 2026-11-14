// What stands in the meadow to be broken: a hamlet at the foot of the path. A keep with its forecourt by the ford,
// a cottage with its yard, garden and shed, a windmill on the pond's side, and the ruin of an abbey, its nave open
// to the sky, looked down from where the path begins.
//
// Each is built piece by piece, as it would be: stone laid in bond with its corners tied, a timber frame with panels
// between its posts, purlins from gable to gable with the roof laid on them, boards on joists. Every piece is a
// box; the builder welds each to what it touches, and the physics gives each weld the strength of what it carries
// (physics/structure.ts). So each comes down by what held it up.
//
// The meadow is made for them: the ground is levelled where each stands (PADS), lanes are worn from the path to
// their doors (LANES), their yards are trodden bare (YARDS) and the garden is sown (GARDENS). The meadow reads
// those when it is made; all four are in the meadow's own measures (x, z).
//
// Inside `plan` the measures are the physics' own: x east, y north (the meadow's z, the other way about), z up.
import { Builder, frame, len, lerp3, norm, sub } from './physics/builder.ts';

const S2 = Math.SQRT1_2;
/** Where each stands (x, z). */
export const SITES = { keep: [-22, 17], cottage: [-10, 30], mill: [22.5, 20.5], abbey: [27, 42] };
/** Ground made level: about (x, z), so far each way, easing back into the meadow over `fall`. Those of one group lie at one height. */
export const PADS = [
  { name: 'keep', group: 'west', x: -22, z: 19.9, hx: 6.4, hz: 7.4, fall: 4.5 },
  { name: 'cottage', group: 'west', x: -10, z: 30.3, hx: 9.5, hz: 7.3, fall: 5 },
  { name: 'mill', x: 22.5, z: 20.9, hx: 3.6, hz: 4.2, fall: 4 },
  { name: 'abbey', x: 27, z: 42, hx: 10.6, hz: 5.6, fall: 5 },
];
/** Lanes, from the path to each door. */
export const LANES = [
  [[-0.8, 31], [-5, 32.6], [-10.6, 33.1]],
  [[-10.6, 33.3], [-17, 31.4], [-21.6, 28], [-22, 20.6]],
  [[-0.7, 29], [8, 30], [16, 27], [22.5, 23.6]],
  [[0, 36], [8, 40], [17.6, 42]],
];
/** Ground trodden bare (x0, z0, x1, z1), and ground sown with flowers. */
export const YARDS = [[-16, 32.7, -8, 35.3], [-26.4, 20.5, -17.6, 25.4], [20.6, 22.6, 24.4, 24.4]];
export const GARDENS = [[-7.5, 34.0, -2.6, 36.9]];

export function plan(gnd, trees = [], parts = []) {
  const b = new Builder(11), R = b.random, floors = [], G = -0.19;

  /** A site: the means to build there, measured from its middle and from the level its walls start at. (G: where the bare ground is, a little lower.) */
  const site = (name) => {
    const [wx, wz] = SITES[name], pad = PADS.find((p) => p.name === name), base = gnd(wx, wz) + 0.15, O = [wx, -wz, base];
    b.group = name;
    // the level ground itself, for the physics: things set down on it stay; walls built on it are footed in it
    b.span('ground', [pad.x - Math.min(pad.hx, 9.9), -(pad.z + pad.hz), base + G - 3], [pad.x + Math.min(pad.hx, 9.9), -(pad.z - pad.hz), base + G], { fixed: true, role: 'ground' });
    const box = (mat, x0, y0, z0, x1, y1, z1, o = {}) => b.span(mat, [O[0] + x0, O[1] + y0, O[2] + z0], [O[0] + x1, O[1] + y1, O[2] + z1], o);
    const at = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
    /** What a building stands on: a footing of stone, flush with its walls' feet. It is walked on. */
    const foot = (x0, y0, x1, y1, role = 'footing') => { box('ground', x0, y0, -1.3, x1, y1, 0, { fixed: true, role }); floors.push({ x0: wx + x0, x1: wx + x1, z0: wz - y1, z1: wz - y0, y: base }); };
    return { O, box, at, foot };
  };

  /** Stone laid in a square ring, each course breaking joint with the last and bonded at the corners. Openings: { wall: 'y-' | 'y+' | 'x-' | 'x+', c0, c1, w, t }
   * (from course c0 up to c1, w wide, centred t along the wall). Corner stones are quoins; the courses in `bands` are a different stone. */
  const ring = (s, { n, L = 1.0, courses, H = 0.5, z0 = 0, openings = [], bands = [], role = 'stone' }) => {
    const W = L / 2, S = n * L, c0 = S / 2 - W / 2;
    const lay = (c, wall, ta, tb, r) => {
      const side = wall[1] === '-' ? -1 : 1, za = z0 + c * H, zb = za + H;
      // what is left of this block once the openings in its wall are taken out of it
      let parts = [[ta, tb]];
      for (const o of openings) if (o.wall === wall && c >= o.c0 && c < o.c1) { const a = (o.t ?? 0) - o.w / 2, e = (o.t ?? 0) + o.w / 2; parts = parts.flatMap(([p, q]) => (e <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, e), q]].filter(([u, v]) => v - u > 0.05))); }
      for (const [p, q] of parts) { if (wall[0] === 'y') s.box('stone', p, side * c0 - W / 2, za, q, side * c0 + W / 2, zb, { role: r }); else s.box('stone', side * c0 - W / 2, p, za, side * c0 + W / 2, q, zb, { role: r }); }
    };
    for (let c = 0; c < courses; c++) {
      const even = c % 2 === 0, r = bands.includes(c) ? 'band' : c === 0 && z0 === 0 ? 'base' : role;
      for (const sd of ['-', '+']) {
        // the walls that run the whole side this course (their end stones are the quoins), and those that fit between them
        for (let k = 0; k < n; k++) { const t = -S / 2 + L / 2 + k * L; lay(c, (even ? 'y' : 'x') + sd, t - L / 2, t + L / 2, (k === 0 || k === n - 1) && r === role ? 'quoin' : r); }
        for (let k = 0; k < n - 1; k++) { const t = -(S / 2 - W) + L / 2 + k * L; lay(c, (even ? 'x' : 'y') + sd, t - L / 2, t + L / 2, r); }
      }
    }
    return S;
  };

  /** A straight wall of bonded blocks. along: 'x' or 'y'; at: where its middle line is on the other; from, to: its ends. open: [{ a, b, c0, c1 }], holes in it.
   * reach(c): how far course c runs, for a wall that is broken off or comes to a gable. cope: the top course's stone. */
  const wall = (s, { along, at, from, to, thick, courses, H = 0.5, z0 = 0, L = 1.1, role = 'ashlar', open = [], reach = null, cope = null }) => {
    for (let c = 0; c < courses; c++) {
      const [ra, rb] = reach ? reach(c) : [from, to];
      if (rb - ra < 0.2) continue;
      let runs = [[ra, rb]];
      for (const o of open) if (c >= o.c0 && c < o.c1) runs = runs.flatMap(([p, q]) => (o.b <= p || o.a >= q ? [[p, q]] : [[p, Math.min(q, o.a)], [Math.max(p, o.b), q]].filter(([u, v]) => v - u > 0.05)));
      for (const [p, q] of runs) {
        // (cut at every L from a start that shifts each course, so no joint stands over another)
        const marks = [p]; for (let m = from + (c % 2 ? L / 2 : 0); m < q - 0.25; m += L) if (m > p + 0.25) marks.push(m); marks.push(q);
        for (let i = 0; i + 1 < marks.length; i++) { const r = cope && c === courses - 1 ? cope : role, za = z0 + c * H, zb = za + H; if (along === 'x') s.box('stone', marks[i], at - thick / 2, za, marks[i + 1], at + thick / 2, zb, { role: r }); else s.box('stone', at - thick / 2, marks[i], za, at + thick / 2, marks[i + 1], zb, { role: r }); }
      }
    }
  };

  /** A pitched roof with its ridge along one axis, from gable to gable. h: half the span, to the wall line. a0, a1: where the gables stand along the ridge. off: where
   * the ridge is across. z0: the top of the wall plate. stop: where the roof ends along the ridge (it overhangs the gables unless told). */
  const gable = (s, { h, a0, a1, z0, along = 'x', off = 0, wall: mat = 'plaster', over = 0.3, stop = null }) => {
    const n = Math.floor((h + 0.1 - 0.3) / 0.4 + 0.001) + 1, P = (a, c, z) => (along === 'x' ? [a, c + off, z] : [c + off, a, z]);
    const span = (m, aA, cA, zA, aB, cB, zB, o) => { const p = P(aA, cA, zA), q = P(aB, cB, zB); return s.box(m, p[0], p[1], p[2], q[0], q[1], q[2], o); };
    // the gables: stepped rows, each narrower than the last
    for (const a of [a0, a1]) for (let i = 0; i < n; i++) span(mat, a - 0.1, -(h + 0.1 - 0.4 * i), z0 + 0.4 * i, a + 0.1, h + 0.1 - 0.4 * i, z0 + 0.4 * (i + 1), { role: mat === 'plaster' ? 'gable' : 'cladding' });
    // purlins from gable to gable, one on each step, and the ridge on the peak
    const segs = Math.max(1, Math.round((a1 - a0) / 2.4)), cut = (k) => a0 - 0.1 + ((a1 - a0 + 0.2) * k) / segs;
    for (let k = 0; k < segs; k++) {
      for (let i = 1; i < n; i++) for (const e of [-1, 1]) span('timber', cut(k), e * (h + 0.3 - 0.4 * i) - 0.08, z0 + 0.4 * i, cut(k + 1), e * (h + 0.3 - 0.4 * i) + 0.08, z0 + 0.4 * i + 0.16, { role: 'purlin' });
      span('timber', cut(k), -0.08, z0 + 0.4 * n, cut(k + 1), 0.08, z0 + 0.4 * n + 0.16, { role: 'purlin' });
    }
    // the roof: slabs of tile laid on the slope, each nailed to the purlins under it
    const c0 = z0 + h + 0.58, t = 0.1, eave = h + 0.55, top = 0.06, rows = Math.max(1, Math.round(((eave - top) * Math.SQRT2) / 1.4)), dc = (eave - top) / rows;
    const r0 = a0 - over, r1 = stop ?? a1 + over, cols = Math.max(1, Math.round((r1 - r0) / 1.3)), da = (r1 - r0) / cols, tops = [];
    for (const e of [-1, 1]) for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const cA = eave - r * dc, cB = cA - dc, cm = (cA + cB) / 2, am = r0 + (k + 0.5) * da;
      const ang = ((along === 'x' ? -e : e) * Math.PI) / 4, rot = along === 'x' ? [Math.sin(ang / 2), 0, 0, Math.cos(ang / 2)] : [0, Math.sin(ang / 2), 0, Math.cos(ang / 2)];
      const size = along === 'x' ? [da, dc * Math.SQRT2, t] : [dc * Math.SQRT2, da, t];
      const id = b.box('tile', s.at(...P(am, e * (cm + (t / 2) * S2), c0 - cm + (t / 2) * S2)), size, { rot, role: along === 'x' ? 'tile' : 'tile-x', shade: R() });
      const aw = Math.min(a1, Math.max(a0, am));
      for (let i = 1; i < n; i++) { const c = h + 0.3 - 0.4 * i; if (c > cB - 0.06 && c < cA + 0.06) b.weldToAny(id, s.at(...P(aw, e * c, z0 + 0.4 * i + 0.1)), 0.02); }
      if (r === rows - 1) { b.weldToAny(id, s.at(...P(aw, 0, z0 + 0.4 * n + 0.1)), 0.02); tops.push([id, am, e]); }
    }
    // and a cap along the ridge, that ties the two slopes together
    for (let k = 0; k < cols; k++) {
      const cap = span('tile', r0 + k * da, -0.2, c0 + 0.03, r0 + (k + 1) * da, 0.2, c0 + 0.13, { role: 'ridge', manual: true });
      for (const [id, am, e] of tops) if (Math.abs(am - (r0 + (k + 0.5) * da)) < 0.01) b.weld(cap, id, s.at(...P(am, e * 0.12, c0 - 0.02)));
    }
  };

  // ============================================================================================================ the keep, and its forecourt
  {
    const s = site('keep'), N = 26;
    s.foot(-3.3, -3.3, 3.3, 3.3);
    // six metres square and thirteen high: a door to the south, a window in each wall at two heights, and three bands of darker stone
    const openings = [{ wall: 'y-', c0: 0, c1: 5, w: 1.0 }];
    for (const c of [9, 17]) for (const sd of ['-', '+']) { openings.push({ wall: 'y' + sd, c0: c, c1: c + 2, w: 1.0 }); openings.push({ wall: 'x' + sd, c0: c + 1, c1: c + 3, w: 1.0 }); }
    ring(s, { n: 6, courses: N, openings, bands: [8, 16, 23] });
    s.box('board', -0.5, -2.62, 0, 0.5, -2.54, 2.5, { role: 'door' });
    // three floors of boards on joists; the highest is the roof
    for (const z of [4.5, 8.5, 12.5]) {
      for (const y of [-2, -1, 0, 1, 2]) s.box('timber', -2.5, y - 0.1, z - 0.2, 2.5, y + 0.1, z, { role: 'joist' });
      for (let k = 0; k < 5; k++) s.box('board', -2.5, -2.5 + k, z, 2.5, -1.5 + k, z + 0.07, { role: 'floor' });
    }
    // the parapet stands out from the wall on a ring of its own, and is battlemented
    ring(s, { n: 7, courses: 2, z0: 12.0, role: 'band' });
    for (const e of [-1, 1]) { for (const t of [-3, -1, 1, 3]) s.box('stone', t - 0.5, e * 3.25 - 0.25, 13.0, t + 0.5, e * 3.25 + 0.25, 13.7, { role: 'quoin' }); for (const t of [-2, 0, 2]) s.box('stone', e * 3.25 - 0.25, t - 0.5, 13.0, e * 3.25 + 0.25, t + 0.5, 13.7, { role: 'quoin' }); }
    // a pole on the roof, with a long banner
    for (let k = 0; k < 5; k++) s.box('timber', 1.9, 1.9, 12.57 + 0.9 * k, 2.04, 2.04, 13.47 + 0.9 * k, { role: 'pole' });
    s.box('board', -0.3, 1.94, 15.4, 1.9, 2.0, 16.9, { role: 'banner' });
    // the forecourt: a low wall round it on three sides, coped, with piers at the gate
    for (const e of [-1, 1]) {
      wall(s, { along: 'y', at: e * 5, from: -9.25, to: -3.0, thick: 0.5, courses: 3, z0: G, L: 1.0, role: 'stone', cope: 'band' });
      wall(s, { along: 'x', at: -3.25, from: e < 0 ? -4.75 : 3.3, to: e < 0 ? -3.3 : 4.75, thick: 0.5, courses: 3, z0: G, L: 1.0, role: 'stone', cope: 'band' });
      wall(s, { along: 'x', at: -9, from: e < 0 ? -4.75 : 2.2, to: e < 0 ? -2.2 : 4.75, thick: 0.5, courses: 3, z0: G, L: 1.0, role: 'stone', cope: 'band' });
      for (let c = 0; c < 5; c++) s.box('stone', e * 1.7 - 0.5, -9.35, G + 0.5 * c, e * 1.7 + 0.5, -8.65, G + 0.5 * c + 0.5, { role: c === 4 ? 'band' : 'quoin' });
      s.box('stone', e * 1.7 - 0.3, -9.2, G + 2.5, e * 1.7 + 0.3, -8.8, G + 2.9, { role: 'quoin' });
    }
    // set down in it: a rack of barrels and a stack of crates
    for (const [x, y, z] of [[-4.2, -5.2, 0], [-4.2, -4.4, 0], [-4.15, -4.8, 0.9]]) s.box('board', x, y, G + z, x + 0.65, y + 0.65, G + z + 0.9, { role: 'barrel', manual: true });
    for (const [x, y, z] of [[3.4, -4.6, 0], [3.5, -5.5, 0], [3.45, -5.0, 0.75]]) s.box('board', x, y, G + z, x + 0.75, y + 0.75, G + z + 0.75, { role: 'crate', manual: true });
  }

  // ============================================================================================================ the cottage: its yard, shed and garden
  {
    const s = site('cottage');
    s.foot(-3.9, -2.7, 3.9, 2.7);
    // a low wall of stone all round, that the frame stands on
    for (const e of [-1, 1]) { for (let k = 0; k < 6; k++) s.box('stone', -3.75 + 1.25 * k, e * 2.4 - 0.15, 0, -2.5 + 1.25 * k, e * 2.4 + 0.15, 0.6, { role: 'base' }); for (let k = 0; k < 4; k++) s.box('stone', e * 3.6 - (e > 0 ? 0.15 : 0.1), -2.25 + 1.125 * k, 0, e * 3.6 + (e > 0 ? 0.1 : 0.15), -1.125 + 1.125 * k, 0.6, { role: 'base' }); }
    // the frame: posts, a rail half way up, and the plate along the top
    const post = (x, y) => s.box('timber', x - 0.1, y - 0.1, 0.6, x + 0.1, y + 0.1, 3.0, { role: 'post' });
    for (const e of [-1, 1]) { for (let k = 0; k <= 6; k++) post(-3.6 + 1.2 * k, e * 2.4); for (let k = 1; k <= 3; k++) post(e * 3.6, -2.4 + 1.2 * k); }
    for (const e of [-1, 1]) { for (const [xa, xb] of [[-3.7, 0], [0, 3.7]]) s.box('timber', xa, e * 2.4 - 0.1, 3.0, xb, e * 2.4 + 0.1, 3.2, { role: 'plate' }); s.box('timber', e * 3.6 - 0.1, -2.3, 3.0, e * 3.6 + 0.1, 2.3, 3.2, { role: 'plate' }); }
    // between the posts: plaster below the rail and above it; a door in one bay; in some a window, with shutters, a bar down its middle and a light behind
    const bay = (face, k, kind) => {
      const long = face[0] === 'y', e = face[1] === '-' ? -1 : 1, a0 = (long ? -3.6 : -2.4) + 1.2 * k + 0.1, a1 = a0 + 1.0, w = long ? 2.4 : 3.6;
      const put = (mat, za, zb, half, role, aA = a0, aB = a1, in0 = 0) => (long ? s.box(mat, aA, e * (w - in0) - half, za, aB, e * (w - in0) + half, zb, { role }) : s.box(mat, e * (w - in0) - half, aA, za, e * (w - in0) + half, aB, zb, { role }));
      put('timber', 1.8, 1.95, 0.1, 'rail');
      if (kind === 'door') put('board', 0.6, 1.8, 0.04, 'door'); else put('plaster', 0.6, 1.8, 0.07, 'panel');
      if (kind === 'window') { put('plaster', 1.95, 2.2, 0.07, 'panel'); put('plaster', 2.8, 3.0, 0.07, 'panel'); put('timber', 2.2, 2.8, 0.04, 'bar', (a0 + a1) / 2 - 0.04, (a0 + a1) / 2 + 0.04); put('board', 2.2, 2.8, 0.03, 'shutter', a0, a0 + 0.22); put('board', 2.2, 2.8, 0.03, 'shutter', a1 - 0.22, a1); put('board', 2.2, 2.8, 0.015, 'pane', a0 + 0.22, a1 - 0.22, 0.06); }
      else put('plaster', 1.95, 3.0, 0.07, 'panel');
    };
    for (let k = 0; k < 6; k++) { bay('y-', k, k === 2 ? 'door' : k === 0 || k === 4 ? 'window' : 'wall'); bay('y+', k, k === 1 || k === 4 ? 'window' : 'wall'); }
    for (let k = 0; k < 4; k++) { bay('x-', k, k === 1 ? 'window' : 'wall'); bay('x+', k, 'wall'); }
    // the roof; it stops short at the east end, where the chimney stands against the gable
    gable(s, { h: 2.4, a0: -3.6, a1: 3.6, z0: 3.2, stop: 3.68 });
    for (let c = 0; c < 15; c++) for (const [ya, yb] of c % 2 ? [[-0.4, 0], [0, 0.4]] : [[-0.4, 0.4]]) s.box('brick', 3.7, ya, c * 0.5, 4.4, yb, (c + 1) * 0.5, { role: 'chimney' });
    s.box('stone', 3.62, -0.48, 7.5, 4.48, 0.48, 7.68, { role: 'cap' });

    // --- the shed, west of it: boarded, with a roof of its own ---
    {
      const xa = -8.5, xb = -5.6, yc = 0.6, h = 1.4, top = 2.0;
      for (const x of [xa, xb]) for (const e of [-1, 1]) s.box('timber', x - 0.08, yc + e * h - 0.08, G, x + 0.08, yc + e * h + 0.08, top, { role: 'post' });
      const n = 5, w = (xb - xa - 0.16) / n;
      for (let k = 0; k < n; k++) { const a0 = xa + 0.08 + k * w; s.box('board', a0, yc + h - 0.04, G, a0 + w, yc + h + 0.04, top, { role: 'cladding', shade: R() }); if (k !== 2) s.box('board', a0, yc - h - 0.04, G, a0 + w, yc - h + 0.04, top, { role: 'cladding', shade: R() }); else s.box('board', a0, yc - h - 0.04, 1.75, a0 + w, yc - h + 0.04, top, { role: 'cladding', shade: R() }); }
      const m = 5, v = (2 * h - 0.16) / m;
      for (const x of [xa, xb]) for (let k = 0; k < m; k++) s.box('board', x - 0.04, yc - h + 0.08 + k * v, G, x + 0.04, yc - h + 0.08 + (k + 1) * v, top, { role: 'cladding', shade: R() });
      gable(s, { h, a0: xa, a1: xb, z0: top, off: yc, wall: 'board', over: 0.25 });
    }

    // --- the yard: things that are only set down, and go where they are sent ---
    const loose = (mat, x0, y0, z0, x1, y1, z1, role) => s.box(mat, x0, y0, G + z0, x1, y1, G + z1, { role, manual: true });
    for (const [x, y, z] of [[0.3, -4.0, 0], [1.1, -4.0, 0], [0.7, -3.95, 0.7], [0.2, -4.85, 0]]) loose('board', x, y, z, x + 0.7, y + 0.7, z + 0.7, 'crate');
    for (const [x, y] of [[-3.4, -3.5], [-2.7, -3.6], [-3.1, -4.3]]) loose('board', x, y, 0, x + 0.6, y + 0.6, 0.9, 'barrel');
    // hay, stacked against the shed
    for (const [x, y, z] of [[-8.3, -2.4, 0], [-7.1, -2.4, 0], [-8.3, -1.7, 0], [-7.1, -1.7, 0], [-7.7, -2.4, 0.55], [-7.7, -1.7, 0.55], [-7.7, -2.05, 1.1]]) loose('board', x, y, z, x + 1.15, y + 0.65, z + 0.55, 'hay');
    // a well: a kerb of stone, two posts, a beam, and a little roof of boards
    for (const c of [0, 1]) for (const e of [-1, 1]) { s.box('stone', -6.3, -5.0 + e * 0.55 - 0.15, G + c * 0.35, -4.9, -5.0 + e * 0.55 + 0.15, G + (c + 1) * 0.35, { role: 'kerb' }); s.box('stone', -5.6 + e * 0.55 - 0.15, -5.4, G + c * 0.35, -5.6 + e * 0.55 + 0.15, -4.6, G + (c + 1) * 0.35, { role: 'kerb' }); }
    for (const e of [-1, 1]) s.box('timber', -5.6 + e * 0.55 - 0.07, -5.07, G + 0.7, -5.6 + e * 0.55 + 0.07, -4.93, G + 2.3, { role: 'post' });
    s.box('timber', -6.3, -5.07, G + 2.3, -4.9, -4.93, G + 2.44, { role: 'beam' });
    for (const e of [-1, 1]) s.box('board', -6.4, -5.0 + (e < 0 ? -0.6 : 0), G + 2.44, -4.8, -5.0 + (e < 0 ? 0 : 0.6), G + 2.5, { role: 'floor' });
    // the garden: a fence of posts and two rails round it, with a gap for the gate
    {
      const x0 = 2.4, x1 = 7.5, y0 = -7.0, y1 = -3.9, posts = [];
      for (let x = x0; x <= x1 + 0.01; x += 1.7) { posts.push([x, y0]); posts.push([x, y1]); }
      for (let y = y0 + 1.55; y < y1 - 0.5; y += 1.55) { posts.push([x0, y]); posts.push([x1, y]); }
      for (const [x, y] of posts) s.box('timber', x - 0.06, y - 0.06, G, x + 0.06, y + 0.06, G + 1.0, { role: 'pole' });
      for (const z of [0.4, 0.8]) {
        for (let x = x0; x < x1 - 0.1; x += 1.7) { s.box('timber', x + 0.06, y0 - 0.03, G + z, x + 1.64, y0 + 0.03, G + z + 0.08, { role: 'pole' }); if (Math.abs(x - 4.1) > 0.1) s.box('timber', x + 0.06, y1 - 0.03, G + z, x + 1.64, y1 + 0.03, G + z + 0.08, { role: 'pole' }); }
        for (let y = y0; y < y1 - 0.1; y += 1.55) for (const x of [x0, x1]) s.box('timber', x - 0.03, y + 0.06, G + z, x + 0.03, y + 1.49, G + z + 0.08, { role: 'pole' });
      }
    }
  }

  // ============================================================================================================ the windmill
  {
    const s = site('mill'), H = 0.5;
    s.foot(-2.3, -2.3, 2.3, 2.3);
    // a base of stone five courses high, with a door in it
    ring(s, { n: 5, L: 0.8, courses: 5, H, openings: [{ wall: 'y-', c0: 0, c1: 4, w: 0.8 }], bands: [4] });
    s.box('board', -0.4, -1.72, 0, 0.4, -1.64, 2.0, { role: 'door' });
    for (let k = 0; k < 5; k++) s.box('board', -2.0, -2.0 + 0.8 * k, 2.5, 2.0, -1.2 + 0.8 * k, 2.6, { role: 'floor' });
    // three storeys of boarded frame, each a little narrower than the one under it
    let z = 2.6;
    for (let j = 0; j < 3; j++) {
      const hw = 1.9 - 0.25 * j, top = z + 2.1;
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) s.box('timber', ex * (hw - 0.1) - 0.1, ey * (hw - 0.1) - 0.1, z, ex * (hw - 0.1) + 0.1, ey * (hw - 0.1) + 0.1, top, { role: 'post' });
      const span = 2 * hw - 0.4, n = Math.round(span / 0.55), w = span / n;
      for (const e of [-1, 1]) for (let k = 0; k < n; k++) {
        const a0 = -hw + 0.2 + k * w, a1 = a0 + w, window = j === 1 && k === Math.floor(n / 2);
        for (const [za, zb] of window && e < 0 ? [[z, z + 0.8], [z + 1.5, top]] : [[z, top]]) s.box('board', a0, e * (hw - 0.1) - 0.04, za, a1, e * (hw - 0.1) + 0.04, zb, { role: 'cladding', shade: R() });
        for (const [za, zb] of window ? [[z, z + 0.8], [z + 1.5, top]] : [[z, top]]) s.box('board', e * (hw - 0.1) - 0.04, a0, za, e * (hw - 0.1) + 0.04, a1, zb, { role: 'cladding', shade: R() });
      }
      for (let k = 0; k < 4; k++) s.box('board', -hw, -hw + (hw / 2) * k, top, hw, -hw + (hw / 2) * (k + 1), top + 0.1, { role: 'floor' });
      z = top + 0.1;
    }
    // the cap: a roof with its ridge running back from the sails
    gable(s, { h: 1.3, a0: -1.3, a1: 1.3, z0: z, along: 'y', wall: 'board', over: 0.3 });
    // the sails: a shaft out of the front gable, a hub, four arms and the cloth on each
    const zc = z + 0.65, y0 = -2.75, y1 = -2.63;
    s.box('timber', -0.15, -2.55, zc - 0.15, 0.15, -1.4, zc + 0.15, { role: 'shaft' });
    s.box('timber', -0.28, -2.82, zc - 0.28, 0.28, -2.55, zc + 0.28, { role: 'hub' });
    for (let k = 0; k < 5; k++) {
      s.box('timber', -0.08, y0, zc + 0.28 + k, 0.08, y1, zc + 1.28 + k, { role: 'spar' }); s.box('timber', -0.08, y0, zc - 1.28 - k, 0.08, y1, zc - 0.28 - k, { role: 'spar' });
      s.box('timber', 0.28 + k, y0, zc - 0.08, 1.28 + k, y1, zc + 0.08, { role: 'spar' }); s.box('timber', -1.28 - k, y0, zc - 0.08, -0.28 - k, y1, zc + 0.08, { role: 'spar' });
    }
    for (let k = 0; k < 3; k++) {
      s.box('board', 0.08, -2.73, zc + 1.0 + 1.4 * k, 1.15, -2.65, zc + 2.4 + 1.4 * k, { role: 'sail' }); s.box('board', -1.15, -2.73, zc - 2.4 - 1.4 * k, -0.08, -2.65, zc - 1.0 - 1.4 * k, { role: 'sail' });
      s.box('board', 1.0 + 1.4 * k, -2.73, zc - 1.15, 2.4 + 1.4 * k, -2.65, zc - 0.08, { role: 'sail' }); s.box('board', -2.4 - 1.4 * k, -2.73, zc + 0.08, -1.0 - 1.4 * k, -2.65, zc + 1.15, { role: 'sail' });
    }
    // sacks of flour by the door
    for (const [x, y, z] of [[1.0, -3.3, 0], [1.75, -3.25, 0], [1.35, -3.3, 0.42], [-2.2, -3.1, 0]]) s.box('board', x, y, G + z, x + 0.7, y + 0.5, G + z + 0.42, { role: 'sack', manual: true });
  }

  // ============================================================================================================ the abbey, what is left of it
  {
    const s = site('abbey');
    s.foot(-9.6, -4.75, 9.95, 4.75, 'paving');
    // The nave: two rows of five columns (a foot, six drums, a head), each row carrying an arcade: from each head the stones step out to either side
    // until they meet over the bay. The far row stands whole, with what is left of the wall above it; the near row is broken down toward the east.
    const XS = [-6.4, -3.2, 0, 3.2, 6.4];
    const arcade = (y, drums) => {
      XS.forEach((x, i) => {
        s.box('stone', x - 0.5, y - 0.5, 0, x + 0.5, y + 0.5, 0.3, { role: 'foot' });
        for (let k = 0; k < drums[i]; k++) s.box('stone', x - 0.35, y - 0.35, 0.3 + 0.8 * k, x + 0.35, y + 0.35, 1.1 + 0.8 * k, { role: 'drum' });
        if (drums[i] < 6) return;
        s.box('stone', x - 0.5, y - 0.5, 5.1, x + 0.5, y + 0.5, 5.4, { role: 'foot' });
        s.box('stone', x - 0.7, y - 0.3, 5.4, x + 0.7, y + 0.3, 5.9, { role: 'ashlar' });
        for (const e of [-1, 1]) { s.box('stone', e < 0 ? x - 1.1 : x, y - 0.3, 5.9, e < 0 ? x : x + 1.1, y + 0.3, 6.4, { role: 'ashlar' }); s.box('stone', e < 0 ? x - 1.1 : x, y - 0.3, 6.4, e < 0 ? x : x + 1.1, y + 0.3, 6.9, { role: 'band' }); }
        // the stone that closes the bay, where the next column stands to share it; and at the east end, the last reach to the wall
        if (i < 4 && drums[i + 1] === 6) s.box('stone', x + 1.1, y - 0.3, 6.4, x + 2.1, y + 0.3, 6.9, { role: 'quoin' });
        if (i === 4) s.box('stone', x + 1.1, y - 0.3, 6.4, 8.6, y + 0.3, 6.9, { role: 'band' });
      });
    };
    arcade(2.6, [6, 6, 6, 6, 6]);
    arcade(-2.6, [6, 6, 6, 4, 2]);
    wall(s, { along: 'x', at: 2.6, from: -7.5, to: 8.6, thick: 0.6, courses: 4, z0: 6.9, open: [-4.8, -1.6, 1.6, 4.8].map((x) => ({ a: x - 0.45, b: x + 0.45, c0: 0, c1: 3 })), reach: (c) => (c < 2 ? [-7.5, 8.6] : c === 2 ? [-5.2, 8.6] : [-0.9, 8.6]) });
    // the east wall: eleven metres to its broken gable, with the great window in it (pointed, two bars of stone up it and one across) and a lancet either side
    wall(s, {
      along: 'y', at: 8.95, from: -4.4, to: 4.4, thick: 0.7, courses: 22,
      open: [{ a: -1.65, b: 1.65, c0: 4, c1: 15 }, { a: -1.1, b: 1.1, c0: 15, c1: 16 }, { a: -0.55, b: 0.55, c0: 16, c1: 17 }, { a: 2.72, b: 3.28, c0: 5, c1: 12 }, { a: -3.28, b: -2.72, c0: 5, c1: 12 }],
      reach: (c) => { const half = c < 16 ? 4.4 : 4.4 - 0.62 * (c - 15); return c < 19 ? [-half, half] : [-half, half * 0.25]; },
    });
    for (const e of [-1, 1]) for (let k = 0; k < 5; k++) s.box('stone', 8.78, e * 0.55 - 0.12, 2.0 + k, 9.12, e * 0.55 + 0.12, 3.0 + k, { role: 'drum' });
    for (const [ya, yb] of [[-1.65, -0.55], [-0.55, 0.55], [0.55, 1.65]]) s.box('stone', 8.78, ya, 7.0, 9.12, yb, 7.5, { role: 'quoin' });
    // buttresses against it outside, and an altar before it inside
    for (const e of [-1, 1]) wall(s, { along: 'x', at: e * 3.6, from: 9.3, to: 9.9, thick: 0.7, courses: 14, L: 2, reach: (c) => (c < 10 ? [9.3, 9.9] : [9.3, 9.62]), cope: 'band' });
    for (const e of [-1, 1]) s.box('stone', 7.0, e * 0.6 - 0.2, 0, 7.5, e * 0.6 + 0.2, 0.9, { role: 'ashlar' });
    s.box('stone', 6.8, -1.0, 0.9, 7.7, 1.0, 1.1, { role: 'quoin' });
    // the west front: only the foot of it, and the doorway
    wall(s, { along: 'y', at: -8.95, from: -4.4, to: 4.4, thick: 0.7, courses: 7, open: [{ a: -0.9, b: 0.9, c0: 0, c1: 6 }], reach: (c) => (c < 3 ? [-4.4, 4.4] : [-4.4, 3.6 - (c - 3) * 1.25]) });
    // and what has already fallen lies about
    for (const [x, y, w] of [[2.4, -3.4, 0.7], [3.9, -1.3, 0.7], [5.3, -3.6, 0.7], [1.0, -0.6, 1.1], [5.6, -0.9, 0.7], [-2.2, -0.4, 2], [4.4, -4.3, 0.7], [7.0, -3.0, 1.1]]) s.box('stone', x, y, 0, x + (w > 1.5 ? 1.4 : 0.7), y + (w > 1.5 ? 0.6 : 0.7), w > 1.5 ? 0.5 : w > 1 ? 0.5 : 0.8, { role: w > 1.5 ? 'ashlar' : 'drum', manual: true });
  }

  // ============================================================================================================ the trees
  // Of each tree only its trunk is here, a piece for every stretch of it along its own line, and each is held fast where it stands: a thing to be struck, to stop what is
  // thrown at it. A tree is not moved by the physics (trees.js does that, by rule). When a tree is destroyed these are let go, and are then logs like any other timber.
  b.group = 'trees';
  const Ph = (v) => [v[0], -v[2], v[1]];
  for (const t of trees) {
    if (!t || !t.parts?.length || !t.kind) continue;
    for (const id of t.parts) {
      const p = parts[id];
      if (p.kind !== 'trunk') continue;
      const a = Ph(p.a), e = Ph(p.b), d = sub(e, a), w = p.r * 1.8;
      p.piece = b.box('timber', lerp3(a, e, 0.5), [len(d), w, w], { rot: frame(norm(d)), manual: true, fixed: true, role: 'tree' });
    }
  }

  // ============================================================================================================ the ground about them
  // What falls must land on something: squares of ground five metres across, each as high as the meadow is there.
  b.group = 'ground';
  const T = 5, seen = new Set();
  for (const [wx, wz] of Object.values(SITES)) for (let i = Math.floor((wx - 24) / T); i <= Math.floor((wx + 24) / T); i++) for (let j = Math.floor((wz - 24) / T); j <= Math.floor((wz + 24) / T); j++) {
    if (seen.has(i + ',' + j)) continue;
    seen.add(i + ',' + j);
    const top = gnd((i + 0.5) * T, (j + 0.5) * T) - 0.08;
    b.span('ground', [i * T, -(j + 1) * T, top - 6], [(i + 1) * T, -j * T, top], { fixed: true, manual: true, role: 'ground' });
  }
  // (and further off, wherever anything may be thrown or a tree may fall, in broader squares)
  const T2 = 8;
  for (let i = Math.floor(-92 / T2); i <= Math.floor(92 / T2); i++) for (let j = Math.floor(-96 / T2); j <= Math.floor(88 / T2); j++) {
    const cx = (i + 0.5) * T2, cz = (j + 0.5) * T2;
    if (Math.hypot(cx, cz + 4) > 94 || Object.values(SITES).some(([wx, wz]) => Math.abs(cx - wx) < 20 && Math.abs(cz - wz) < 20)) continue;
    // (never higher than the lowest of the meadow there: on a slope a square at its middle's height would bury the foot of whatever stands on it)
    let top = 1e9; for (let u = 0; u <= 1; u += 0.5) for (let v = 0; v <= 1; v += 0.5) top = Math.min(top, gnd((i + u) * T2, (j + v) * T2)); top -= 0.1;
    b.span('ground', [i * T2, -(j + 1) * T2, top - 6], [(i + 1) * T2, -j * T2, top], { fixed: true, manual: true, role: 'ground' });
  }
  b.autoWeld();
  return { builder: b, floors };
}
