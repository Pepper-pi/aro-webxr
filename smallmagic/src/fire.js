// Fire, as a thing the meadow does once it has been set alight.
//
// The ground is squares a metre across. A square that is burning uses up the grass on it, in a few seconds, and
// while it burns it may set light to the squares beside it: sooner downwind, later up it, never where the ground
// is bare, already burnt or frozen. What is left is ash, which the grass reads and stays short and black.
// A fire tires as it goes: each square it takes is a little less able to take the next, so a fire left alone burns
// a patch (a longer one downwind) and goes out. Wind through it gives it its strength back.
// Nothing about it is sudden: a square that catches starts as almost nothing and takes a second or so to burn up,
// and how strongly each square burns is written to the ground's map, which the flames read between the squares, so
// that fire grows out of the ground and its edge creeps.
// A tree that fire burns under for long enough catches: its leaves glow, go, and its trunk is charred.
const NEAR = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

export function createFire({ world, air, fx, flames }) {
  const S = world.state, N = S.N, data = S.data, cell = S.cell, U = air.uniforms, rnd = fx.rnd;
  const heat = new Float32Array(N * N), fuel = new Float32Array(N * N), full = new Float32Array(N * N), reach = new Float32Array(N * N), green = new Float32Array(N * N), active = new Set();
  const X = (i) => S.x0 + ((i % N) + 0.5) * cell, Z = (i) => S.z0 + (Math.floor(i / N) + 0.5) * cell;
  const at = (x, z) => { const i = Math.floor((x - S.x0) / cell), j = Math.floor((z - S.z0) / cell); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  for (let i = 0; i < N * N; i++) fuel[i] = full[i] = world.grassAt(X(i), Z(i));
  // (what will burn: grass that is not frozen, and not so fresh from a growth spell that it is still too green to catch)
  const can = (i) => i >= 0 && fuel[i] > 0.05 && data[i * 4 + 1] < 70 && U.uNow.value >= green[i];
  const light = (i, h = 1, far = 1) => { if (!can(i)) return false; heat[i] = Math.max(heat[i], h); reach[i] = Math.max(reach[i], far); active.add(i); return true; };
  const each = (x, z, r, fn) => { const n = Math.ceil(r / cell); const c = at(x, z); if (c < 0) return; const ci = c % N, cj = Math.floor(c / N); for (let j = Math.max(0, cj - n); j <= Math.min(N - 1, cj + n); j++) for (let i = Math.max(0, ci - n); i <= Math.min(N - 1, ci + n); i++) { const k = j * N + i, d = Math.hypot(X(k) - x, Z(k) - z); if (d <= r) fn(k, d); } };
  let acc = 0, glare = 0, glow = { x: 0, y: -999, z: 0, power: 0 }, treeGlow = { x: 0, y: -999, z: 0, power: 0 };
  const foot = new Float32Array(N * N).fill(NaN);

  function sim(dt) {
    const w = U.uWind.value, wx = w.x, wz = w.y;
    for (const i of [...active]) {
      const k = i * 4;
      if (fuel[i] > 0) {
        heat[i] = Math.min(1, heat[i] + dt * 0.85);
        fuel[i] -= dt * 0.17 * (0.75 + 0.5 * Math.random());
        data[k] = Math.max(data[k], Math.min(255, (1 - Math.max(fuel[i], 0) / Math.max(full[i], 0.05)) * 255));
        if (heat[i] > 0.5 && reach[i] > 0) for (const [dx, dz] of NEAR) {
          const ci = (i % N) + dx, cj = Math.floor(i / N) + dz;
          if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
          const j = cj * N + ci;
          if (heat[j] > 0 || !can(j)) continue;
          const along = (dx * wx + dz * wz) / Math.hypot(dx, dz);
          if (Math.random() < dt * 0.26 * (along > 0 ? 1 + 2.2 * along : 1 + 0.7 * along) * (0.4 + 0.6 * fuel[j])) { heat[j] = 0.02; reach[j] = reach[i] - (along > 0.3 ? 0.09 + 0.12 * Math.random() : 0.2 + 0.3 * Math.random()); active.add(j); }
        }
      } else {
        heat[i] -= dt * 0.8;
        if (heat[i] <= 0) { heat[i] = 0; active.delete(i); }
      }
      // (how strongly it burns: it dies down as the grass under it goes)
      data[k + 2] = heat[i] * Math.min(1, (Math.max(fuel[i], 0) / Math.max(full[i], 0.05)) * 3.5 + 0.2) * 255;
    }
    // trees: one that fire burns under catches; one alight burns through, and drops fire under itself
    let tg = null;
    for (let t = 1; t < world.trees.length; t++) {
      const tree = world.trees[t], c = at(tree.x, tree.z);
      if (!tree.burning && tree.burnt < 0.5 && tree.frost < 0.5 && c >= 0) {
        let hot = 0; for (const [dx, dz] of [[0, 0], ...NEAR]) hot = Math.max(hot, heat[c + dx + dz * N] ?? 0);
        tree.warm = hot > 0.6 ? tree.warm + dt : Math.max(0, tree.warm - dt * 0.5);
        if (tree.warm > 1.6) tree.burning = 1;
      }
      if (tree.burning > 0) {
        if (tree.frost > 0.5) tree.burning = 0;
        else if (tree.burnt < 1) { tree.burnt = Math.min(1, tree.burnt + dt / 11); if (Math.random() < dt * 0.6) { const a = Math.random() * 6.28, d = Math.random() * tree.r * 0.8; light(at(tree.x + Math.cos(a) * d, tree.z + Math.sin(a) * d), 0.05, 0.5); } }
        else tree.burning = Math.max(0, tree.burning - dt * 0.4);
        world.treeChanged(tree);
        if (tree.burning > 0.3 && (!tg || tree.burning > tg.burning)) tg = tree;
      }
    }
    treeGlow = tg ? { x: tg.x, y: tg.y + tg.h * 0.6, z: tg.z, power: tg.burning * (1 - 0.6 * tg.burnt) } : { x: 0, y: -999, z: 0, power: 0 };
    S.touch();
  }

  return {
    get burning() { return active.size; },
    /** How much fire there is near the eye, 0 to 1: the page is seen warmer for it. */
    get glare() { return glare; },
    /** Sets light to the ground within r of a place. Says whether anything caught. */
    ignite(x, z, r, far = 1) { let any = false; each(x, z, r, (k, d) => { if (light(k, 0.55 - 0.45 * (d / r), far)) any = true; }); if (any) S.touch(); return any; },
    /** Puts out what is burning within r of a place. Says how much there was. */
    quench(x, z, r) { let n = 0; each(x, z, r, (k) => { if (heat[k] > 0) { heat[k] = 0; data[k * 4 + 2] = 0; active.delete(k); n++; } }); if (n) S.touch(); return n; },
    /** The grass comes back within r of a place: by `amount` of the way. */
    regrow(x, z, r, amount) { each(x, z, r, (k, d) => { if (heat[k] > 0) return; const a = amount * (1 - (d / r) ** 2); data[k * 4] = Math.max(0, data[k * 4] - a * 255); fuel[k] = full[k] * (1 - data[k * 4] / 255) * (1 + 0.6 * data[k * 4 + 3] / 255); green[k] = U.uNow.value + 4; }); S.touch(); },
    /** A gust through fire: it leaps ahead, along (dx, dz), from what is burning within r of a place. */
    fan(x, z, dx, dz, r) { each(x, z, r, (k) => { if (heat[k] > 0.5) reach[k] = 1; if (heat[k] > 0.5 && Math.random() < 0.35) { const far = 1.5 + Math.random() * 3.5; light(at(X(k) + dx * far + rnd(0.8), Z(k) + dz * far + rnd(0.8)), 0.05); } }); },
    /** A blast: the ground within r is burnt bare at once, burns out in a moment, and leaves its edge alight. */
    scorch(x, z, r) {
      each(x, z, r * 1.15, (k, d) => {
        if (d > r * (0.85 + 0.3 * hash(k))) return;
        data[k * 4] = 255; data[k * 4 + 3] = 0; green[k] = 0;
        fuel[k] = full[k] * 0.12; heat[k] = 1; reach[k] = 0.9; active.add(k);
      });
      S.touch();
    },
    /** How many squares are well alight within r of a place. */
    near(x, z, r) { let n = 0; each(x, z, r, (k) => { if (heat[k] > 0.3) n++; }); return n; },
    /** Something drinks the fire within r of a place: so much of it a second goes out. Says where it went from. */
    drain(x, z, r, rate, dt) { const out = []; each(x, z, r, (k) => { if (heat[k] > 0.1 && Math.random() < rate * dt) { out.push([X(k), Z(k)]); heat[k] = 0; data[k * 4 + 2] = 0; active.delete(k); } }); if (out.length) S.touch(); return out; },
    /** A tree is set alight outright. */
    kindle(tree) { if (tree && tree.burnt < 0.9 && tree.frost < 0.5) tree.burning = 1; },
    /** Where the fire's light is, for the lamps: the ground's nearest the eye, and a tree's. */
    lamps: () => [glow, treeGlow],
    step(dt, eye) {
      acc += dt;
      while (acc > 0.05) { acc -= 0.05; sim(0.05); }
      flames.begin();
      const list = [...active];
      let near = 0;
      if (list.length) {
        // the fire itself: a card or two on every square alight, and it is one fire across them all
        for (const i of list) {
          const h = heat[i];
          if (h < 0.015) continue;
          const x = X(i), z = Z(i), d = Math.hypot(x - eye.x, z - eye.z);
          if (d > 110) continue;
          let y = foot[i];
          if (y !== y) y = foot[i] = world.ground(x, z);
          // (it dies down as the grass under it goes)
          const a = hash(i), b = hash(i + 7919), left = Math.max(fuel[i], 0) / Math.max(full[i], 0.05), life = Math.min(1, h) * Math.min(1, left * 3.5 + 0.2);
          // (how strongly each burns the flames read from the ground's map, between the squares)
          flames.add(x + (a - 0.5) * 0.6, y - 0.25, z + (b - 0.5) * 0.6, life, 0.85 + 0.25 * a, 1.7 + 1.5 * b, a, 1);
          if (d < 50) flames.add(x + (b - 0.5) * 0.8, y - 0.25, z + (a - 0.5) * 0.8, life, 0.75 + 0.25 * b, 1.3 + 1.2 * a, b + 0.37, 1);
          near += Math.max(0, 1 - d / 35);
        }
        // what it throws off: loose flame above itself, embers, smoke going up and downwind, and its glow
        const rate = Math.min(list.length * 3.2, 420) * dt, count = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
        for (let q = 0; q < count; q++) {
          const i = list[Math.floor(Math.random() * list.length)], h = heat[i];
          if (h < 0.3) continue;
          const x = X(i) + rnd(0.6), z = Z(i) + rnd(0.6), d = Math.hypot(x - eye.x, z - eye.z);
          if (d > 70 || (d > 30 && Math.random() < 0.5)) continue;
          const y = world.ground(x, z), pick = Math.random();
          if (pick < 0.3) fx.spawn({ kind: 0, x, y: y + 0.7 + Math.random() * 0.7, z, vx: rnd(0.3), vy: 1.4 + 1.6 * Math.random(), vz: rnd(0.3), life: 0.4 + 0.4 * Math.random(), size: [0.22 + 0.2 * h, 0.1], colour: [1, 1, 1], alpha: 0.9, wind: 0.8 });
          else if (pick < 0.72) fx.spawn({ kind: 1, x, y: y + 0.5 + Math.random(), z, vx: rnd(1.2), vy: 2 + 3.5 * Math.random(), vz: rnd(1.2), life: 1.2 + 1.6 * Math.random(), size: [0.035, 0.01], colour: [1, 0.55, 0.12], grav: -0.5, drag: 0.5, wind: 1.6 });
          else if (pick < 0.9) fx.spawn({ kind: 2, x, y: y + 1.6, z, vx: rnd(0.3), vy: 2 + 1.4 * Math.random(), vz: rnd(0.3), life: 4 + 3 * Math.random(), size: [0.7, 3.6], colour: [0.1, 0.09, 0.1], alpha: 0.4, wind: 1.0, drag: 0.15 });
          else fx.spawn({ kind: 6, x, y: y + 0.7, z, life: 0.5 + 0.5 * Math.random(), size: [1.5, 2.6], colour: [1, 0.4, 0.08], alpha: 0.05 });
        }
        // (its light is taken from a handful of the squares alight nearest the eye)
        let gx = 0, gy = 0, gz = 0, gn = 0;
        const best = [];
        for (let q = 0; q < Math.min(list.length, 60); q++) { const i = list[Math.floor(Math.random() * list.length)]; best.push([Math.hypot(X(i) - eye.x, Z(i) - eye.z), i]); }
        best.sort((a, b) => a[0] - b[0]);
        for (const [, i] of best.slice(0, 10)) { gx += X(i); gz += Z(i); gy += world.ground(X(i), Z(i)); gn++; }
        glow = gn ? { x: gx / gn, y: gy / gn + 1.2, z: gz / gn, power: Math.min(1, list.length / 14) * (0.8 + 0.2 * Math.sin(U.uNow.value * 23) * Math.sin(U.uNow.value * 7.3)) } : glow;
      } else glow = { x: 0, y: -999, z: 0, power: 0 };
      // trees alight: fire stands in the boughs
      for (let t = 1; t < world.trees.length; t++) {
        const tree = world.trees[t];
        if (tree.burning < 0.2 || tree.burnt > 0.97 || !tree.clumps.length) continue;
        const power = tree.burning * Math.min(1, 1.25 - tree.burnt), d = Math.hypot(tree.x - eye.x, tree.z - eye.z);
        for (let c = 0; c < tree.clumps.length; c++) { const [x, y, z, r] = tree.clumps[c]; flames.add(x, y - r * 0.7, z, power, r * 0.8, r * 1.7 + 0.9, hash(t * 31 + c)); }
        near += 6 * Math.max(0, 1 - d / 45) * power;
        const n = 30 * dt * power;
        for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
          const [x, y, z, r] = tree.clumps[Math.floor(Math.random() * tree.clumps.length)], pick = Math.random();
          if (pick < 0.3) fx.spawn({ kind: 0, x: x + rnd(r * 0.7), y: y + r * 0.6 + rnd(r * 0.4), z: z + rnd(r * 0.7), vx: rnd(0.4), vy: 1.4 + 1.6 * Math.random(), vz: rnd(0.4), life: 0.5 + 0.5 * Math.random(), size: [0.4 + 0.3 * Math.random(), 0.15], colour: [1, 1, 1], alpha: 0.9, wind: 0.8 });
          else if (pick < 0.65) fx.spawn({ kind: 1, x: x + rnd(r), y, z: z + rnd(r), vx: rnd(1.5), vy: 1 + 3 * Math.random(), vz: rnd(1.5), life: 1.5 + 1.5 * Math.random(), size: [0.04, 0.012], colour: [1, 0.55, 0.12], grav: -1.2, drag: 0.4, wind: 1.5 });
          else if (pick < 0.85) fx.spawn({ kind: 2, x, y: y + r, z, vx: rnd(0.4), vy: 2 + Math.random(), vz: rnd(0.4), life: 4 + 2 * Math.random(), size: [1.0, 4.0], colour: [0.09, 0.08, 0.1], alpha: 0.42, wind: 1.0, drag: 0.15 });
          else fx.spawn({ kind: 6, x, y, z, life: 0.6 + 0.5 * Math.random(), size: [2.5, 4.5], colour: [1, 0.42, 0.08], alpha: 0.06 });
        }
      }
      flames.end(eye);
      glare += (Math.min(1, near / 45) - glare) * Math.min(1, dt * 2.5);
    },
  };
}
