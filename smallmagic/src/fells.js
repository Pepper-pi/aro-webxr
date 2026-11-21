// A blade cut tips a nearby tree. The meadow already draws a tree part from the part picture
// (the same one a falling tree uses). This only writes that picture. Cabins are left alone.
import { TUNE } from './rider.js';

export function attachFells(world, air) {
  const PT = air.parts;
  const PW = PT.W;
  const falls = [];

  const spin = (ax, ang) => {
    const s = Math.sin(ang / 2);
    return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)];
  };
  const rot = (q, v) => {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const tx = 2 * (y * v[2] - z * v[1]);
    const ty = 2 * (z * v[0] - x * v[2]);
    const tz = 2 * (x * v[1] - y * v[0]);
    return [
      v[0] + w * tx + (y * tz - z * ty),
      v[1] + w * ty + (z * tx - x * tz),
      v[2] + w * tz + (x * ty - y * tx),
    ];
  };

  function prep(tree) {
    if (tree._bits) return;
    const trunks = (tree.parts || []).map((id) => world.parts[id]).filter((p) => p && p.kind === 'trunk');
    if (!trunks.length) { tree._bits = []; return; }
    const foot = trunks[0].a;
    tree._pivot = [foot[0], -foot[2], foot[1]];
    tree._bits = tree.parts.map((id) => {
      const p = world.parts[id];
      const c = p?.c || p?.a;
      if (!c) return null;
      const rest = [c[0], -c[2], c[1]];
      PT.data.set([c[0], c[1], c[2], 0], id * 4);
      return { id, rest };
    }).filter(Boolean);
  }

  function write(tree, q, flag) {
    const pivot = tree._pivot;
    for (const p of tree._bits) {
      const spun = rot(q, [p.rest[0] - pivot[0], p.rest[1] - pivot[1], p.rest[2] - pivot[2]]);
      const at = [spun[0] + pivot[0], spun[1] + pivot[1], spun[2] + pivot[2]];
      PT.data.set([at[0], at[2], -at[1], flag], (PW + p.id) * 4);
      PT.data.set([q[0], q[2], -q[1], q[3]], (2 * PW + p.id) * 4);
    }
    PT.tex.needsUpdate = true;
  }

  function chop(x, z, dx, dz, reach) {
    let best = null;
    let bestD = reach;
    for (let i = 1; i < world.trees.length; i++) {
      const tree = world.trees[i];
      if (!tree || tree.down || tree.gone || !tree.parts?.length) continue;
      const d = Math.hypot(tree.x - x, tree.z - z);
      if (d < bestD) { best = tree; bestD = d; }
    }
    if (!best) return null;
    prep(best);
    if (!best._bits.length) return null;
    best.down = true;
    const len = Math.hypot(dx, dz) || 1;
    const fx = dx / len;
    const fz = dz / len;
    const ax = [fz, fx, 0];
    const al = Math.hypot(ax[0], ax[1]) || 1;
    falls.push({ tree: best, ax: [ax[0] / al, ax[1] / al, 0], t: 0, dur: TUNE.treeFall, max: 1.25, hit: false, fx, fz });
    return best;
  }

  function step(dt) {
    const hits = [];
    for (let i = falls.length - 1; i >= 0; i--) {
      const fall = falls[i];
      fall.t += dt;
      const u = Math.min(1, fall.t / fall.dur);
      const q = spin(fall.ax, fall.max * u * u);
      write(fall.tree, q, u > 0.92 ? 2 : 1);
      if (!fall.hit && u > 0.8) {
        fall.hit = true;
        const h = fall.tree.h || 6;
        hits.push({ x: fall.tree.x + fall.fx * h * 0.65, z: fall.tree.z + fall.fz * h * 0.65, r: 2.4 });
      }
      if (u >= 1 && fall.t > fall.dur + 0.35) falls.splice(i, 1);
    }
    return hits;
  }

  world.chop = chop;
  world.stepFells = step;
  world.falling = () => falls.length;
}
