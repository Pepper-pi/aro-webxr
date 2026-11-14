// A built structure in three-avbd: one rigid body per piece, one fixed joint per weld.
//
// How strong each weld is comes from the structure itself. The structure is built with every weld
// unbreakable and settled (gravity eased on over the first steps, then a while to stand), and each
// weld's load is read back. Then the welds are armed in place: a weld holds its material's margin
// times what it carries standing, and never less than the material's floor (materials.ts). So a
// weld carrying a floor holds it with room to spare, and the same weld asked to carry twice that
// because the post beside it went gives way: collapse follows the load paths.
//
// Arming happens in the solver's own joint records (three-avbd/advanced: the fracture, yield and
// bend-limit words), so the settled state, its multipliers and penalties, carries straight on. A
// structure built with breakable welds from the start breaks most of them while its penalties ramp.
//
// (From Timberfall, Patch's demolition game.) For the block demo the world lives as long as the page
// and structures come and go in it: `Structure.build` adds one, `settle` steps it a few steps a frame
// until it's armed (so a rebuild never stalls a frame), and `remove` takes it all out again.

import { type Body, type Joint, World } from 'three-avbd';
import { J_BREAK_BEND, J_LAM_LIN, J_YIELD, JOINT_FLOATS } from 'three-avbd/advanced';
import { type Builder, conj, overlapDepth, type Piece, qmul, rotate, sub, type V3, type WeldSpec } from './builder.ts';
import { MATS, type WeldKind, type WeldRule, WELDS } from './materials.ts';

export const GRAVITY = 9.81;
/** Solver settings: a step of 1/60 s, 12 iterations (at 10, a free-standing chimney of 70 courses bounced on its welds until they broke). */
export const DT = 1 / 60;
export const ITERATIONS = 12;
/** The ground's own collision group (shards collide with it alone). */
export const GROUND_GROUP = 4;
/** The solver's "never" (a threshold that is never reached). */
const BIG = 3e38;
/** Steps to settle before the welds are armed, gravity coming on over the first RAMP. */
const SETTLE = 90;
const RAMP = 30;
/** Steps at which the loads are read while settling (the larger reading is kept). */
const READS = [60, 75, 90];

export interface Tuning {
  /** Scale every weld's margin and floor (the demo's weld strength). */
  strength: number;
  /** Scale every material's density, and friction. */
  density: number;
  friction: number;
  rules?: Partial<Record<WeldKind, Partial<WeldRule>>>;
}

/** A weld's anchors in each body's frame, and the turn it holds. */
function weldFrame(pieces: Piece[], w: WeldSpec) {
  const A = pieces[w.a];
  const B = pieces[w.b];
  return {
    anchorA: rotate(conj(A.rot), sub(w.at, A.pos)),
    anchorB: rotate(conj(B.rot), sub(w.at, B.pos)),
    rest: qmul(conj(A.rot), B.rot) as [number, number, number, number],
  };
}

export class Structure {
  readonly world: World;
  readonly pieces: Piece[];
  readonly welds: WeldSpec[];
  /** The body of each piece (null once it's gone: a pane shattered). */
  readonly bodies: (Body | null)[];
  /** The joint of each weld (null once broken or cut). */
  readonly joints: (Joint | null)[];
  /** Springs of no strength between pieces built overlapping (so they never collide). */
  private readonly springs: Joint[] = [];
  /** Each weld's standing loads (its pull or push, and its angular force) and its strength (kN). */
  readonly loadLin: Float32Array;
  readonly loadAng: Float32Array;
  readonly strength: Float32Array;
  /** Where a plastic weld gives (kN; Infinity for brittle ones). */
  readonly yieldAt: Float32Array;
  /** Each piece's mass (t). */
  mass: Float32Array;
  /** The welds each piece has. */
  readonly weldsOf: number[][];
  /** Piece by body slot. */
  readonly pieceAt = new Map<number, number>();
  /** Weld by joint. */
  private readonly weldOf = new Map<Joint, number>();
  /** Welds broken so far (by load, or the cannon). */
  broken = 0;
  /** Settling: steps taken, and a readback waited on. */
  private settled = 0;
  private waiting: Promise<void> | null = null;
  /** Armed: the welds can break. */
  armed = false;
  private readonly tuning: Tuning;

  private constructor(world: World, b: Builder, bodies: (Body | null)[], joints: Joint[], tuning: Tuning) {
    this.world = world;
    this.pieces = b.pieces;
    this.welds = b.welds;
    this.bodies = bodies;
    this.joints = joints;
    this.tuning = tuning;
    this.loadLin = new Float32Array(b.welds.length);
    this.loadAng = new Float32Array(b.welds.length);
    this.strength = new Float32Array(b.welds.length);
    this.yieldAt = new Float32Array(b.welds.length);
    this.mass = new Float32Array(b.pieces.map((p) => p.size[0] * p.size[1] * p.size[2] * (p.density ?? MATS[p.mat].density) * tuning.density));
    this.weldsOf = b.pieces.map(() => []);
    b.welds.forEach((w, i) => {
      this.weldsOf[w.a].push(i);
      this.weldsOf[w.b].push(i);
    });
    bodies.forEach((body, i) => body && this.pieceAt.set(body.index, i));
    joints.forEach((j, i) => this.weldOf.set(j, i));
  }

  /** Put a structure into the world, every weld unbreakable: then `settle` it, a few steps a frame. */
  static build(world: World, b: Builder, tuning: Tuning): Structure {
    world.gravity = [0, 0, 0];
    const bodies = b.pieces.map((p) => {
      const m = MATS[p.mat];
      return world.addBox({
        size: p.size,
        position: p.pos,
        rotation: p.rot,
        density: (p.density ?? (m.density || 1)) * tuning.density,
        friction: Math.min(1.5, m.friction * tuning.friction),
        fixed: p.fixed,
        // The ground is in a group of its own as well (GROUND_GROUP): glass shards land on it and
        // pass through everything else
        group: p.mat === 'ground' ? 1 | GROUND_GROUP : 1,
      });
    });
    const joints = b.welds.map((w) => world.addJoint(bodies[w.a]!, bodies[w.b]!, weldFrame(b.pieces, w)));
    const s = new Structure(world, b, bodies, joints, tuning);
    // Pieces built overlapping where they're joined (a rafter's foot in the ridge, braces crossing)
    // would burst apart the moment their weld went: a spring of no strength keeps them from ever
    // colliding with each other (a joint's pair never collides while it holds, and springs hold)
    for (const w of b.welds) {
      const A = b.pieces[w.a];
      const B = b.pieces[w.b];
      if (A.fixed || B.fixed || (!A.manual && !B.manual)) continue;
      if (overlapDepth(A, B) > 0.006) s.springs.push(world.addSpring(bodies[w.a]!, bodies[w.b]!, { stiffness: 1e-6, rest: 0 }));
    }
    return s;
  }

  /** How far settling has got (0..1). */
  get progress(): number {
    return this.armed ? 1 : Math.min(0.99, this.settled / SETTLE);
  }

  /**
   * Settle: run up to `steps` steps now (gravity easing on), reading the welds' loads as it goes;
   * once settled, arm the welds. Call once a frame until it returns true (armed).
   */
  settle(steps: number): boolean {
    if (this.armed) return true;
    if (this.waiting) return false;
    for (let k = 0; k < steps && this.settled < SETTLE; k++) {
      this.settled++;
      this.world.gravity = [0, 0, -GRAVITY * Math.min(1, this.settled / RAMP)];
      this.world.step();
      if (READS.includes(this.settled)) {
        this.waiting = this.world.readJoints().then(() => {
          this.joints.forEach((j, i) => {
            if (!j) return;
            const f = j.force;
            this.loadLin[i] = Math.max(this.loadLin[i], f.linear);
            this.loadAng[i] = Math.max(this.loadAng[i], f.angular);
          });
          this.waiting = this.settled >= SETTLE ? this.arm().then(() => void (this.armed = true)) : null;
        });
        return false;
      }
    }
    return false;
  }

  /** Give every weld its strength, in the solver's joint records and on the joints. */
  private async arm(): Promise<void> {
    const { strength: marginScale, rules: overrides } = this.tuning;
    const floorScale = marginScale;
    const solver = this.world.solver;
    const data = await solver.readJoints();
    this.welds.forEach((w, i) => {
      const j = this.joints[i];
      if (!j) return;
      const rule = { ...WELDS[w.kind], ...overrides?.[w.kind] };
      const pull = rule.pull;
      const load = pull ? Math.max(this.loadLin[i], this.loadAng[i]) : this.loadAng[i];
      // Floors are in g's of the lighter piece: its weight (kN) for a pull, and for a bend its
      // weight's moment about the weld, as the solver's angular force (over the torque arm)
      const free = [w.a, w.b].filter((k) => !this.pieces[k].fixed);
      const weight = GRAVITY * Math.min(...free.map((k) => this.mass[k]));
      const moment = Math.min(...free.map((k) => GRAVITY * this.mass[k] * Math.max(0.1, Math.hypot(...sub(w.at, this.pieces[k].pos)))));
      const sa = this.pieces[w.a].size;
      const sb = this.pieces[w.b].size;
      const arm = (sa[0] + sb[0]) ** 2 + (sa[1] + sb[1]) ** 2 + (sa[2] + sb[2]) ** 2;
      const bendFloor = moment / arm;
      const floor = rule.floor * floorScale * (pull ? Math.max(weight, bendFloor) : bendFloor);
      const s = Math.max(floor, rule.margin * marginScale * load);
      this.strength[i] = s;
      const plastic = rule.yieldMargin !== undefined && rule.bend !== undefined;
      // (A plastic weld yields on its bend alone, whatever it carries in a pull or a push)
      const y = plastic ? Math.min(s * 0.9, Math.max((rule.yieldFloor ?? 0) * floorScale * bendFloor, rule.yieldMargin! * this.loadAng[i])) : BIG;
      this.yieldAt[i] = plastic ? y : Infinity;
      const o = j.slot * JOINT_FLOATS;
      data[o + J_LAM_LIN + 3] = pull ? -s : s;
      data[o + J_YIELD] = y;
      data[o + J_BREAK_BEND] = plastic ? rule.bend! : BIG;
      // The handle's own record of it (what readbacks look at: World.read watches breakable joints)
      Object.assign(j as unknown as Record<string, unknown>, {
        breakForce: s,
        breakOnPull: pull,
        yieldForce: plastic ? y : Infinity,
        breakBend: plastic ? rule.bend! : Infinity,
      });
    });
    const buffer = (solver as unknown as { jointBuffer: GPUBuffer }).jointBuffer;
    this.world.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }

  /** Take every piece, weld and spring out of the world (the joints in one batch). */
  remove(): void {
    const solver = this.world.solver as unknown as { releaseJoints: (slots: ArrayLike<number>) => void };
    const release = solver.releaseJoints;
    const slots: number[] = [];
    solver.releaseJoints = (s) => slots.push(...Array.from(s));
    try {
      for (const j of this.joints) j?.remove();
      for (const j of this.springs) j.remove();
    } finally {
      solver.releaseJoints = release;
    }
    if (slots.length) release.call(solver, slots);
    for (const b of this.bodies) b?.remove();
    this.bodies.fill(null);
    this.joints.fill(null);
  }

  /** The weld a joint was made for. */
  weldOfJoint(j: Joint): number {
    return this.weldOf.get(j) ?? -1;
  }

  /** A joint seen broken at a readback (World.onBreak). */
  markBroken(j: Joint): number {
    const i = this.weldOf.get(j) ?? -1;
    if (i >= 0 && this.joints[i]) {
      this.joints[i] = null;
      this.broken++;
      this.wake(this.welds[i].a);
      this.wake(this.welds[i].b);
    }
    return i;
  }

  /** Cut a weld now (the cannon). */
  cut(i: number): boolean {
    const j = this.joints[i];
    if (!j) return false;
    j.remove();
    this.joints[i] = null;
    this.broken++;
    this.wake(this.welds[i].a);
    this.wake(this.welds[i].b);
    return true;
  }

  /**
   * Set a piece moving, a few cm/s downwards. The solver starts a body slower than 0.1 m/s from
   * where it was and takes its gravity from how it accelerated last step (three-avbd's adaptive
   * warm start): a piece held still by a weld that then lets go can carry on standing still in
   * mid-air, with nothing under it. The nudge gets it falling, and from then on gravity takes it.
   */
  wake(piece: number): void {
    const b = this.bodies[piece];
    if (!b || this.pieces[piece].fixed) return;
    b.applyImpulse([0, 0, -this.mass[piece] * 0.15]);
  }

  /** Every weld a piece still has. */
  holding(piece: number): number[] {
    return this.weldsOf[piece].filter((i) => this.joints[i]);
  }

  /** Free a piece from all its welds. */
  release(piece: number): number {
    let n = 0;
    for (const i of this.weldsOf[piece]) if (this.cut(i)) n++;
    return n;
  }

  /** A loose piece joins the structure (an offcut, a shard): no welds. Returns its id. */
  addLoose(piece: Piece, body: Body): number {
    const id = this.pieces.length;
    this.pieces.push({ ...piece, id });
    this.bodies.push(body);
    this.weldsOf.push([]);
    const m = new Float32Array(this.mass.length + 1);
    m.set(this.mass);
    m[id] = piece.size[0] * piece.size[1] * piece.size[2] * (piece.density ?? MATS[piece.mat].density) * this.tuning.density;
    this.mass = m;
    this.pieceAt.set(body.index, id);
    return id;
  }

  /** Where a piece is now (as of the last readback), or as built. */
  position(piece: number): V3 {
    const b = this.bodies[piece];
    return b ? (b.position as V3) : this.pieces[piece].pos;
  }
}

/** A world for the demo's structures: the solver, room for `maxBodies`, contact storage up front. */
export async function createWorld(renderer: import('three/webgpu').WebGPURenderer, maxBodies: number): Promise<World> {
  const world = await World.create({ renderer, maxBodies, gravity: [0, 0, -GRAVITY], iterations: ITERATIONS, dt: DT });
  // At most two steps a frame: a slow frame that owed four steps made the next one slower still
  world.maxSubsteps = 2;
  // Contact storage for a collapse up front: a standing structure has almost no contacts (welded
  // pairs don't collide), so the solver would otherwise grow it in doublings, each a reallocation
  // and a hitch, while everything comes down at once
  const solver = world.solver as unknown as { contactCapacity: number; pairCapacity: number; manifoldCapacity: number; allocateContacts: (c: number, p: number, m: number) => void };
  solver.allocateContacts(Math.max(solver.contactCapacity, maxBodies * 40), Math.max(solver.pairCapacity, maxBodies * 12), Math.max(solver.manifoldCapacity, maxBodies * 8));
  return world;
}
