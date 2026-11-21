// Building structures out of real pieces: posts, beams, joists, braces, boards, bricks, panes, tiles.
// The builder only describes them (sizes, poses, materials and welds); physics.ts turns the
// description into three-avbd bodies and joints. z is up, in metres.
//
// Pieces that sit square to the axes are welded to whatever they touch automatically (`autoWeld`):
// one weld at the middle of each contact patch. Pieces turned off the axes (braces, rafters, the
// tank's staves) are welded where the level says (`weld`). A long timber is made of segments welded
// end to end with a `grain` weld, so it snaps along its length, not just at its ends.

import { type Mat, type WeldKind, weldKind } from './materials.ts';

export type V3 = [number, number, number];
export type Q4 = [number, number, number, number];

export interface Piece {
  id: number;
  mat: Mat;
  /** Full size along the piece's own axes (m). */
  size: V3;
  pos: V3;
  rot: Q4;
  /** What it is, for the level's own logic and the HUD (post, beam, brick, pane, stave...). */
  role: string;
  /** Which structure it belongs to (the mill, the tower), for objectives. */
  group: string;
  /** The member it is a segment of (a timber in several pieces), or -1. */
  member: number;
  /** Never moves (the ground, footings). */
  fixed: boolean;
  /** Not welded automatically (turned pieces, or pieces welded by hand). */
  manual: boolean;
  /** Colour variation seed and tint (0..1 each), for the look. */
  seed: number;
  /** A shade for this piece within its material (0 base; materials read it their own way). */
  shade: number;
  /** Overrides the material's density (t/m³): a tank's floor carries its water. */
  density?: number;
}

export interface WeldSpec {
  a: number;
  b: number;
  /** Where it holds (world m, as built). */
  at: V3;
  kind: WeldKind;
}

const IDENTITY: Q4 = [0, 0, 0, 1];
/** Contact search: faces this close count as touching (m). */
const TOUCH = 0.012;
/** Smallest contact patch side that gets a weld (m). */
const PATCH = 0.02;

/** q such that q turns +x onto `dir` and +z as near `up` as it can go. */
export function frame(dir: V3, up: V3 = [0, 0, 1]): Q4 {
  const x = norm(dir);
  let z = sub(up, scale(x, dot(up, x)));
  if (len(z) < 1e-6) z = Math.abs(x[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  z = norm(sub(z, scale(x, dot(z, x))));
  const y = cross(z, x);
  // Rotation matrix columns x, y, z → quaternion
  const m00 = x[0], m10 = x[1], m20 = x[2];
  const m01 = y[0], m11 = y[1], m21 = y[2];
  const m02 = z[0], m12 = z[1], m22 = z[2];
  const tr = m00 + m11 + m22;
  let q: Q4;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const l = Math.hypot(...q);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** v turned by unit quaternion q. */
export function rotate(q: ArrayLike<number>, v: ArrayLike<number>): V3 {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]];
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
}
export const conj = (q: ArrayLike<number>): Q4 => [-q[0], -q[1], -q[2], q[3]];
export function qmul(a: ArrayLike<number>, b: ArrayLike<number>): Q4 {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** A small seeded random (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BoxOpts {
  rot?: Q4;
  role?: string;
  group?: string;
  member?: number;
  fixed?: boolean;
  manual?: boolean;
  shade?: number;
  density?: number;
}

export class Builder {
  readonly pieces: Piece[] = [];
  readonly welds: WeldSpec[] = [];
  private members = 0;
  readonly random: () => number;
  /** The group new pieces go in. */
  group = 'site';

  constructor(seed = 7) {
    this.random = rng(seed);
  }

  box(mat: Mat, pos: V3, size: V3, o: BoxOpts = {}): number {
    if (!(size[0] > 0 && size[1] > 0 && size[2] > 0)) throw new Error(`a piece needs a positive size, not ${size} (${o.role ?? mat})`);
    const id = this.pieces.length;
    this.pieces.push({
      id,
      mat,
      size: [...size],
      pos: [...pos],
      rot: o.rot ?? IDENTITY,
      role: o.role ?? mat,
      group: o.group ?? this.group,
      member: o.member ?? -1,
      fixed: o.fixed ?? false,
      manual: o.manual ?? !!o.rot,
      seed: this.random(),
      shade: o.shade ?? 0,
      density: o.density,
    });
    return id;
  }

  /** An axis-aligned box from its min and max corners. */
  span(mat: Mat, min: V3, max: V3, o: BoxOpts = {}): number {
    // (Either corner first: a negative size would make a body of negative mass, which the solver
    // takes for a fixed one: the west gable's boards hung in the air in 0.1.0)
    const lo: V3 = [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])];
    const hi: V3 = [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])];
    return this.box(mat, lerp3(lo, hi, 0.5), sub(hi, lo), o);
  }

  /**
   * A timber (or steel) member from `a` to `b` (centre line), `w` wide and `h` deep (h along the
   * `up` side), in `segments` pieces welded end to end. Square to an axis, its pieces weld to
   * their neighbours automatically; turned, only end to end, and the level welds its ends.
   */
  member(mat: Mat, a: V3, b: V3, w: number, h: number, segments: number, o: BoxOpts & { up?: V3 } = {}): number[] {
    const d = sub(b, a);
    const L = len(d);
    const dir = norm(d);
    const axis = [Math.abs(dir[0]), Math.abs(dir[1]), Math.abs(dir[2])];
    const square = axis.some((v) => v > 0.9999);
    const member = this.members++;
    const ids: number[] = [];
    for (let k = 0; k < segments; k++) {
      const c = lerp3(a, b, (k + 0.5) / segments);
      const l = L / segments;
      if (square) {
        // Square to an axis: no rotation, the size permuted
        const i = axis.indexOf(Math.max(...axis));
        // h goes vertical when the member is horizontal, else along y
        const size: V3 = i === 0 ? [l, w, h] : i === 1 ? [w, l, h] : [w, h, l];
        ids.push(this.box(mat, c, size, { ...o, member, manual: o.manual ?? false }));
      } else {
        ids.push(this.box(mat, c, [l, w, h], { ...o, member, rot: frame(dir, o.up ?? [0, 0, 1]), manual: true }));
      }
    }
    // Segments end to end (square ones find each other in autoWeld, turned ones need it here)
    if (!square) for (let k = 1; k < segments; k++) this.weld(ids[k - 1], ids[k], lerp3(a, b, k / segments));
    return ids;
  }

  /** Weld two pieces where they meet (world point as built). */
  weld(a: number, b: number, at: V3, kind?: WeldKind): void {
    if (a === b) return;
    const A = this.pieces[a];
    const B = this.pieces[b];
    if (A.fixed && B.fixed) return;
    // Cladding is nailed to the frame, not to itself: board to board it carries nothing
    const clad = (r: string) => r === 'weatherboard' || r === 'gable board';
    if (!kind && clad(A.role) && clad(B.role) && Math.abs(A.pos[2] - B.pos[2]) > 0.01) return;
    // Chimney bricks hold to the house only by ties
    if (!kind && (A.role === 'chimney') !== (B.role === 'chimney') && A.mat !== 'stone' && B.mat !== 'stone') kind = 'tie';
    this.welds.push({ a, b, at: [...at], kind: kind ?? weldKind(A.mat, B.mat, A.member >= 0 && A.member === B.member) });
  }

  /** Weld piece `a` to every square piece whose box contains point `at` (or is within `r` of it). */
  weldToAny(a: number, at: V3, r = 0.05, except: number[] = []): number {
    let n = 0;
    for (const p of this.pieces) {
      if (p.id === a || except.includes(p.id) || p.rot !== IDENTITY) continue;
      const inside = [0, 1, 2].every((i) => Math.abs(at[i] - p.pos[i]) <= p.size[i] / 2 + r);
      if (inside) {
        this.weld(a, p.id, at);
        n++;
      }
    }
    return n;
  }

  /**
   * Weld every pair of square pieces whose faces touch: one weld at the middle of the patch.
   * (Turned pieces are left to the level.)
   */
  autoWeld(): void {
    const cell = 1.0;
    const grid = new Map<string, number[]>();
    // The ground (a fixed slab bigger than the site) is welded to what stands on it, not searched
    const grounds = this.pieces.filter((p) => p.fixed && Math.max(...p.size) > 20);
    const square = this.pieces.filter((p) => !p.manual && p.rot === IDENTITY && !grounds.includes(p));
    for (const g of grounds) {
      const top = g.pos[2] + g.size[2] / 2;
      for (const p of square) if (Math.abs(p.pos[2] - p.size[2] / 2 - top) < TOUCH) this.weld(g.id, p.id, [p.pos[0], p.pos[1], top]);
    }
    for (const p of square) {
      const lo = p.pos.map((v, i) => Math.floor((v - p.size[i] / 2 - TOUCH) / cell));
      const hi = p.pos.map((v, i) => Math.floor((v + p.size[i] / 2 + TOUCH) / cell));
      for (let x = lo[0]; x <= hi[0]; x++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let z = lo[2]; z <= hi[2]; z++) {
            const k = `${x},${y},${z}`;
            const list = grid.get(k);
            if (list) list.push(p.id);
            else grid.set(k, [p.id]);
          }
    }
    const seen = new Set<number>();
    for (const list of grid.values()) {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = Math.min(list[i], list[j]);
          const b = Math.max(list[i], list[j]);
          const key = a * 1_000_003 + b;
          if (seen.has(key)) continue;
          seen.add(key);
          const at = this.patch(this.pieces[a], this.pieces[b]);
          if (at) this.weld(a, b, at);
        }
    }
  }

  /** Where two square boxes touch face to face (the patch's middle), or null. */
  private patch(A: Piece, B: Piece): V3 | null {
    const at: V3 = [0, 0, 0];
    let touching = -1;
    for (let i = 0; i < 3; i++) {
      const lo = Math.max(A.pos[i] - A.size[i] / 2, B.pos[i] - B.size[i] / 2);
      const hi = Math.min(A.pos[i] + A.size[i] / 2, B.pos[i] + B.size[i] / 2);
      const overlap = hi - lo;
      if (overlap >= PATCH) at[i] = (lo + hi) / 2;
      else if (overlap > -TOUCH) {
        if (touching >= 0) return null; // an edge or a corner, not a face
        touching = i;
        at[i] = (lo + hi) / 2;
      } else return null;
    }
    if (touching < 0) return null; // overlapping volumes (one inside the other): leave them
    return at;
  }
}

/** How deep two boxes overlap (m, by the separating axis test), or <= 0 if they don't. */
export function overlapDepth(A: Pick<Piece, 'pos' | 'rot' | 'size'>, B: Pick<Piece, 'pos' | 'rot' | 'size'>): number {
  const ax = [rotate(A.rot, [1, 0, 0]), rotate(A.rot, [0, 1, 0]), rotate(A.rot, [0, 0, 1])];
  const bx = [rotate(B.rot, [1, 0, 0]), rotate(B.rot, [0, 1, 0]), rotate(B.rot, [0, 0, 1])];
  const d = sub(B.pos, A.pos);
  const cands: V3[] = [...ax, ...bx];
  for (const x of ax)
    for (const y of bx) {
      const c = cross(x, y);
      const l = len(c);
      if (l > 1e-4) cands.push(scale(c, 1 / l));
    }
  let min = Infinity;
  for (const n of cands) {
    const ra = ax.reduce((s, a, i) => s + Math.abs(dot(a, n)) * A.size[i] / 2, 0);
    const rb = bx.reduce((s, b, i) => s + Math.abs(dot(b, n)) * B.size[i] / 2, 0);
    min = Math.min(min, ra + rb - Math.abs(dot(d, n)));
    if (min <= 0) return min;
  }
  return min;
}
