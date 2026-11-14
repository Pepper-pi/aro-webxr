// The meadow: open grass and flowers under a wide sky, a stream through it that widens to a pond, round trees
// standing singly and in twos, a few dark pines at its edges, and on a rise at the far side a ring of standing
// stones. Beyond are wooded hills, blue with distance, and one mountain.
//
// It is small, and what is in it is put there by hand. Only the grass, the flowers and the far woods are scattered.
import * as THREE from 'three';
import { GARDENS, LANES, PADS, YARDS } from '../structures.js';
import { noise, rng } from '../noise.js';
import { ball, block, knead, put, roll, sstep } from '../shape.js';
import { AIR, GROUND, MAP, SUN, shadowed } from '../air.js';
import { createGrass, createFlowers } from '../grass.js';
import { createPaint, createDabs, createSolids } from '../paint.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, C = (hex) => new THREE.Color(hex);
export const WATER = -0.14;
const HOME = [0, -4], EDGE = 84;
const CIRCLE = [5, -31], POND = [19, 5, 7.5];
const STREAM = [[-140, 22], [-70, 12], [-34, 7], [-14, 2.5], [0, 4.5], [10, 3.5], [19, 5], [34, 1], [60, -8], [140, -24]];
const WAY = [[0, 36], [-1, 26], [-3, 16], [-1.5, 8], [0, 4.5], [1.5, -2], [0.5, -12], [3, -22], [5, -30]];
const STEPS = [[-0.9, 6.3], [-0.4, 5.2], [0.1, 4.2], [0.5, 3.2], [0.9, 2.3]];
const phoneGrass = (n) => (typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 820) ? Math.round(n * 0.02) : n);

function along(line) {
  const seg = line.slice(1).map(([x1, z1], i) => { const [x0, z0] = line[i], dx = x1 - x0, dz = z1 - z0; return { x0, z0, dx, dz, l2: dx * dx + dz * dz }; });
  return (x, z) => {
    let best = 1e9;
    for (const s of seg) { const t = Math.min(1, Math.max(0, ((x - s.x0) * s.dx + (z - s.z0) * s.dz) / s.l2)); best = Math.min(best, Math.hypot(x - s.x0 - s.dx * t, z - s.z0 - s.dz * t)); }
    return best;
  };
}
const streamLine = new THREE.CatmullRomCurve3(STREAM.map(([x, z]) => V(x, 0, z))).getPoints(90).map((p) => [p.x, p.z]);
const wayLine = new THREE.CatmullRomCurve3(WAY.map(([x, z]) => V(x, 0, z))).getPoints(60).map((p) => [p.x, p.z]);
const nearStream = along(streamLine), nearWay = along(wayLine);
/** How far inside the water's edge (x, z) is: above 0 in the stream or the pond. */
const wet = (x, z) => Math.max(1.7 - nearStream(x, z), POND[2] - Math.hypot(x - POND[0], z - POND[1]) + 1.2 * noise(x * 0.3, z * 0.3));

function raw(x, z) {
  const w = wet(x, z), r = Math.hypot(x - HOME[0], z - HOME[1]);
  // (the land lies low and level by the water, and rolls away from it)
  const roll_ = sstep(-1, -14, w);
  let h = 0.42 + (1.5 * noise(x * 0.014 + 2, z * 0.014) + 0.55 * noise(x * 0.045 + 7, z * 0.045) + 2.1) * roll_;
  h += 3.2 * sstep(26, 5, Math.hypot(x - CIRCLE[0], z - CIRCLE[1]));
  h += sstep(94, 250, r) * (14 + 20 * noise(x * 0.0042 + 11, z * 0.0042) + 7 * noise(x * 0.012, z * 0.012 + 3));
  const bed = sstep(-1.5, 1.0, w) * sstep(150, 95, r);
  h = h * (1 - bed) - 0.8 * bed;
  for (const [sx, sz] of STEPS) { const d = Math.hypot(x - sx, z - sz); if (d < 0.7) h = Math.max(h, WATER + 0.1 - 0.9 * sstep(0.42, 0.7, d)); }
  return h;
}

// Where something is built the ground is made level for it, easing back into the meadow round about (structures.js).
let levelled = false;
export function ground(x, z) {
  if (!levelled) {
    levelled = true;
    const groups = {};
    for (const p of PADS) { p.y = raw(p.x, p.z); (groups[p.group ?? p.name] ??= []).push(p); }
    for (const list of Object.values(groups)) { const y = list.reduce((a, p) => a + p.y, 0) / list.length; for (const p of list) p.y = y; }
  }
  let h = raw(x, z);
  for (const p of PADS) { const d = Math.hypot(Math.max(Math.abs(x - p.x) - p.hx, 0), Math.max(Math.abs(z - p.z) - p.hz, 0)); if (d < p.fall) h += (p.y - h) * (1 - sstep(0, p.fall, d)); }
  return h;
}
const laneLines = LANES.map((l) => along(new THREE.CatmullRomCurve3(l.map(([x, z]) => V(x, 0, z))).getPoints(24).map((p) => [p.x, p.z])));
const nearLane = (x, z) => Math.min(...laneLines.map((f) => f(x, z)));
const inside = (list, x, z) => Math.max(...list.map(([x0, z0, x1, z1]) => Math.min(x - x0, x1 - x, z - z0, z1 - z)));

export async function createWorld({ air, scene, say, turn }) {
  const U = air.uniforms, group = new THREE.Group(), R = rng(4242), any = (list) => list[Math.floor(R() * list.length)];
  const paint = createPaint(air), dabs = createDabs(paint.leaf, paint.leafDepth), solids = createSolids(paint.solid, paint.solidDepth);
  const colliders = [], crowns = [], tmp = new THREE.Color(), nrm = V(0, 1, 0);
  let seed = 10, kindMap = null;
  const floors = [];
  // The trees magic can touch: where each is, the boughs of its crown, and what has happened to it. (0 is no tree.)
  const trees = [null], treeData = new Uint8Array(64 * 4), treeTex = new THREE.DataTexture(treeData, 64, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  treeTex.magFilter = treeTex.minFilter = THREE.NearestFilter;
  treeTex.needsUpdate = true;
  U.tTrees.value = treeTex;
  let growing = null;
  const begin = (x, z, y, h, r, far) => { growing = far ? null : { id: trees.length, x, z, y, h, r, clumps: [], parts: [], kind: null, burnt: 0, frost: 0, burning: 0, warm: 0 }; if (growing) trees.push(growing); dabs.tree = solids.tree = growing ? growing.id : 0; };
  const end = () => { growing = null; dabs.tree = solids.tree = 0; dabs.part = solids.part = 0; };
  // The parts a tree is grown in, that it may be broken into: stretches of its trunk, and the boughs of its crown. (0 is no part.)
  const parts = [null];
  let seed2 = 9000;
  const newPart = (o) => { const id = parts.length; parts.push({ id, tree: growing.id, ...o }); growing.parts.push(id); return id; };
  /** A trunk that can be broken. It is one piece to look at, as it always was; but each stretch of its height is a part of its own, and where two
   * meet there is the pale wood that shows if they come apart. Under its foot, out of sight until it is torn up, the earth its roots hold. */
  function trunk(pts, rad, K, bark, o) {
    const g = knead(roll(pts, rad, { around: o.around, every: o.every }), o.amount, o.grain, seed++);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), N = 80, S = [];
    for (let i = 0; i <= N; i++) S.push(curve.getPointAt(i / N));
    const yA = pts[0].y, yB = pts[pts.length - 1].y, cut = (k) => { if (k >= K) return N; const y = yA + ((yB - yA) * k) / K; let i = 0; while (i < N && S[i].y < y) i++; return i; };
    const ids = [];
    for (let k = 0; k < K; k++) { const a = S[cut(k)], b = S[cut(k + 1)]; ids.push(newPart({ kind: 'trunk', a: [a.x, a.y, a.z], b: [b.x, b.y, b.z], c: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], r: rad((cut(k) + cut(k + 1)) / 2 / N), wide: o.wide ? o.wide((k + 0.5) / K) : 0 })); }
    const at = (y) => ids[Math.max(0, Math.min(K - 1, Math.floor(((y - yA) / (yB - yA)) * K)))];
    solids.add(g, bark, { bark: true, scale: o.scale, moss: o.moss, partOf: (cx, cy) => at(cy) });
    const disc = (i, up, part) => { const t = curve.getTangentAt(i / N); if (!up) t.negate(); const d = new THREE.CircleGeometry(rad(i / N) * 0.97, 9); d.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), t)); d.translate(S[i].x, S[i].y, S[i].z); solids.part = part; solids.add(d, '#e0bd8a', { scale: 7 }); };
    for (let k = 1; k < K; k++) { disc(cut(k), true, ids[k - 1]); disc(cut(k), false, ids[k]); }
    // (the earth its roots hold: a rough ball of it, no wider than the foot of the trunk and a little more)
    const rr = rad(0.0) * 0.8;
    solids.part = ids[0];
    solids.add(put(knead(ball(1, 2).scale(rr, rr * 0.5, rr), rr * 0.3, 2.4 / rr, seed2++, 5, rr * 0.6), pts[0].x, pts[0].y - rr * 0.3, pts[0].z, 0), '#3f2f24', { scale: 4 });
    // and the roots themselves: a few, going out and down from the foot
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + seed2 * 1.7, l = rr * (1.3 + 0.5 * ((i * 7) % 3)), b0 = pts[0]; solids.add(roll([V(b0.x + Math.cos(a) * rr * 0.4, b0.y + 0.15, b0.z + Math.sin(a) * rr * 0.4), V(b0.x + Math.cos(a) * l * 0.6, b0.y - 0.25, b0.z + Math.sin(a) * l * 0.6), V(b0.x + Math.cos(a + 0.3) * l, b0.y - 0.65, b0.z + Math.sin(a + 0.3) * l)], (u) => rad(0.3) * (0.42 - 0.34 * u), { around: 6, every: 0.3 }), bark, { bark: true, scale: 14 }); }
    solids.part = 0;
    return { ids, at };
  }

  // ============================================================================================== the maps of the ground
  say('Waking the meadow');
  await turn();
  {
    const N = 512, h = new Uint16Array(N * N), kind = kindMap = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = MAP.x0 + ((i + 0.5) / N) * MAP.size, z = MAP.z0 + ((j + 0.5) / N) * MAP.size, k = (j * N + i) * 4, y = ground(x, z);
      h[j * N + i] = THREE.DataUtils.toHalfFloat(y);
      // the path, the lanes that leave it for each door, and the yards trodden bare
      const lane = Math.max(sstep(0.95, 0.35, nearLane(x, z) + 0.3 * noise(x * 0.7 + 9, z * 0.7)), 0.8 * sstep(-0.1, 0.6, inside(YARDS, x, z) + 0.5 * noise(x * 0.8, z * 0.8)));
      const path = Math.max(sstep(1.25, 0.5, nearWay(x, z) + 0.35 * noise(x * 0.6, z * 0.6)), lane) * sstep(WATER + 0.05, WATER + 0.35, y), w = wet(x, z);
      const shore = sstep(-1.6, -0.2, w), ring = Math.hypot(x - CIRCLE[0], z - CIRCLE[1]);
      // flowers: thick in drifts, none on the path, the shore or among the stones
      // (and thickest of all in a garden)
      const drift = Math.max(0.07 + 0.62 * sstep(0.12, 0.6, noise(x * 0.035 + 50, z * 0.035) + 0.5 * noise(x * 0.11, z * 0.11 + 9)), sstep(0, 0.5, inside(GARDENS, x, z))) * (1 - path) * (1 - shore);
      const grass = (1 - path) * sstep(WATER + 0.02, WATER + 0.22, y) * (1 - 0.55 * sstep(3.2, 1.6, ring));
      kind[k] = path * 255; kind[k + 1] = shore * 255; kind[k + 2] = drift * 255; kind[k + 3] = grass * 255;
    }
    const tex = (data, format, type) => { const t = new THREE.DataTexture(data, N, N, format, type); t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; };
    U.tHeight.value = tex(h, THREE.RedFormat, THREE.HalfFloatType);
    U.tKind.value = tex(kind, THREE.RGBAFormat, THREE.UnsignedByteType);
  }
  // what has been done to the ground: nothing yet. Magic writes here.
  const STATE = 256, state = new Uint8Array(STATE * STATE * 4), stateTex = new THREE.DataTexture(state, STATE, STATE, THREE.RGBAFormat, THREE.UnsignedByteType);
  stateTex.magFilter = stateTex.minFilter = THREE.LinearFilter;
  stateTex.needsUpdate = true;
  U.tState.value = stateTex;

  // ============================================================================================================ the sky
  say('Painting the sky');
  await turn();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uNow: U.uNow, uSun: U.uSun, uZenith: { value: C('#2f79e6') }, uHorizon: { value: C('#b9e2ff') }, uCloud: { value: C('#fffaf0').multiplyScalar(1.45) }, uCloudMid: { value: C('#f6e4ee') }, uCloudShade: { value: C('#9fb4ea') } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform float uNow; uniform vec3 uSun; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uCloud; uniform vec3 uCloudMid; uniform vec3 uCloudShade;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      // how much cloud there is one way: heaped clouds with level bottoms, bigger and closer together toward the horizon
      float cloud(vec3 d) {
        vec2 p = d.xz / (d.y + 0.2) * 1.35 + vec2(uNow * 0.006, 0.0);
        float m = fbm(p * 0.9 + 3.0) + 0.22 * fbm(p * 3.3);
        return smoothstep(0.6, 0.76, m) * smoothstep(0.0, 0.07, d.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0), toSun = max(dot(d, uSun), 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
        col = mix(col, vec3(1.0, 0.93, 0.8), pow(toSun, 6.0) * 0.5);
        col += vec3(1.0, 0.9, 0.7) * (pow(toSun, 900.0) * 30.0 + pow(toSun, 60.0) * 0.5);
        // clouds, painted in three tones: lit where they face the sun, rose in their bodies, blue underneath
        float c = cloud(d);
        if (c > 0.0) {
          vec3 toS = normalize(uSun - d * dot(uSun, d));
          float c2 = cloud(normalize(d + toS * 0.045)), c3 = cloud(normalize(d - vec3(0.0, 0.05, 0.0)));
          float light = clamp((c - c2) * 2.2 + 0.55, 0.0, 1.0), under = clamp((c3 - c) * 1.5 + 0.2, 0.0, 1.0);
          vec3 cc = mix(uCloudShade, uCloudMid, smoothstep(0.15, 0.5, light));
          cc = mix(cc, uCloud, smoothstep(0.5, 0.85, light));
          cc = mix(cc, uCloudShade * 0.9, under * 0.5);
          col = mix(col, cc, c * 0.96);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  group.add(sky);

  // ========================================================================================================= the ground
  say('Rolling out the grass');
  await turn();
  const landNear = new THREE.PlaneGeometry(MAP.size, MAP.size, 320, 320).rotateX(-Math.PI / 2);
  { const p = landNear.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i))); landNear.computeVertexNormals(); }
  const landMat = (near) => {
    const m = shadowed(air, {
      key: `land-${near}`,
      vertexPars: 'varying vec3 vWorld; varying vec3 vNw;',
      vertex: '#include <begin_vertex>\n  vWorld = position; vNw = normal;',
      fragmentPars: 'varying vec3 vWorld; varying vec3 vNw;',
      fragment: /* glsl */ `
  vec2 xz = vWorld.xz, uv = mapUv(xz);
  float inMap = step(abs(uv.x - 0.5), 0.498) * step(abs(uv.y - 0.5), 0.498);
  ${near ? '' : 'if (inMap > 0.5) discard;'}
  vec4 lKind = mix(vec4(0.0, 0.0, 0.0, 1.0), texture2D(tKind, uv), inMap), lSt = stateAt(xz) * inMap;
  vec3 lRoot, lTip; meadow(xz, lRoot, lTip);
  float lD = distance(vWorld, cameraPosition);
  // near, it is the dark between the blades; further, where the blades give out, it is the grass itself seen from above
  vec3 lCol = mix(lRoot * 1.2, lTip * 0.8, smoothstep(5.0, 44.0, lD));
  // the far hills are wooded: darker in drifts
  lCol = mix(lCol, uG4 * 0.4, (1.0 - inMap) * smoothstep(0.42, 0.62, aNoise(xz * 0.02 + 5.0) * 0.7 + aNoise(xz * 0.07) * 0.3) * 0.8);
  // (burnt ground is not one black: char, and paler drifts of ash on it)
  lCol = mix(lCol, mix(uAsh * 0.7, vec3(0.2, 0.19, 0.18), smoothstep(0.4, 0.72, aNoise(xz * 1.9 + 11.0)) * 0.7 * lSt.r), max(lSt.r, min(1.0, lSt.b * 1.7)) * 0.92);
  lCol = mix(lCol, uEarth * (0.82 + 0.36 * smoothstep(0.3, 0.7, aNoise(xz * 1.3))), lKind.r);
  lCol = mix(lCol, mix(uSand, uEarth * 0.55, smoothstep(0.3, 0.8, aNoise(xz * 0.8))), lKind.g);
  // frost lies on whatever is there: grass, a path, a shore
  lCol = mix(lCol, uFrost * (0.78 + 0.14 * aNoise(xz * 2.2 + 3.0)), lSt.g * 0.85);
  vec3 lN = normalize(vNw);
  float lSun = smoothstep(-0.1, 0.55, dot(lN, uSun)) * outgoingLight.g;
  vec3 lC = lit(lCol, lSun * mix(1.0, 0.62, lKind.a), 1.0) + lCol * lamps(vWorld);
  // where it is alight the ground glows between the blades; and a seal is drawn on it in light
  float lTurf = (1.0 - lKind.r) * (1.0 - lKind.g);
  lC += vec3(2.2, 0.55, 0.06) * lSt.b * smoothstep(0.35, 0.75, aNoise(xz * 5.0 + uNow * vec2(0.7, 1.3))) * lTurf;
  lC += vec3(1.6, 0.3, 0.03) * lTurf * lSt.r * (1.0 - lSt.b) * smoothstep(0.78, 0.9, aNoise(xz * 9.0 + 17.0)) * (0.5 + 0.5 * sin(uNow * 2.0 + xz.x * 3.0)) * step(lSt.r, 0.98);
  lC += uSealCol * seal(xz) * 1.1;
  gl_FragColor = vec4(air(lC, vWorld), 1.0);`,
    });
    return m;
  };
  {
    const near = new THREE.Mesh(landNear, landMat(true));
    near.receiveShadow = true; near.frustumCulled = false;
    const fg = new THREE.PlaneGeometry(1800, 1800, 300, 300).rotateX(-Math.PI / 2), p = fg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) - 0.25);
    fg.computeVertexNormals();
    const far = new THREE.Mesh(fg, landMat(false));
    far.frustumCulled = false;
    group.add(near, far);
  }
  // grass in two rings, and the flowers
  group.add(
    createGrass(air, { count: phoneGrass(300000), tile: 30, segs: 4, fade: [10, 15, 6, -100], size: [0.016, 0.42, 0.012], seed: 11 }),
    createGrass(air, { count: phoneGrass(420000), tile: 104, segs: 2, fade: [34, 52, 14, 9], size: [0.03, 0.46, 0.022], seed: 23 }),
    createFlowers(air, { count: phoneGrass(110000), tile: 84, fade: [32, 42, 8, -100], seed: 37 }),
  );

  // ============================================================================================================= water
  {
    const water = new THREE.Mesh(new THREE.CircleGeometry(190, 96).rotateX(-Math.PI / 2).translate(0, WATER, 0), new THREE.ShaderMaterial({
      uniforms: { ...Object.fromEntries(Object.keys(U).map((k) => [k, U[k]])), uDeep: { value: C('#2a78a4') }, uShallow: { value: C('#6fd0c4') }, uSkyLow: { value: C('#b9e2ff') }, uSkyHigh: { value: C('#3f86ea') } },
      vertexShader: /* glsl */ `varying vec3 vWorld; void main() { vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: AIR + GROUND + /* glsl */ `
        varying vec3 vWorld; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSkyLow; uniform vec3 uSkyHigh;
        // Cracks in ice: long and nearly straight, running a few ways, each there for a stretch and then not, some
        // broad and some no more than a hair.
        float cracks(vec2 p) {
          float m = 0.0;
          // (none is straight: each bends as it goes, and jogs)
          p += (vec2(aNoise(p * 0.3), aNoise(p * 0.3 + 19.0)) - 0.5) * 1.8 + (vec2(aNoise(p * 1.9 + 7.0), aNoise(p * 1.9 + 43.0)) - 0.5) * 0.22;
          for (int k = 0; k < 3; k++) {
            float fk = float(k), an = fk * 1.07 + 0.4 + 0.3 * sin(fk * 5.0), fr = 0.36 + 0.13 * fk;
            vec2 d = vec2(cos(an), sin(an));
            float f = dot(p, d) * fr + fk * 3.7, id = floor(f), h = aHash(vec2(id, fk * 7.0)), h2 = aHash(vec2(id + 31.0, fk * 3.0));
            float there = smoothstep(0.5, 0.56, aNoise(vec2(id * 5.3 + fk * 11.0, dot(p, vec2(-d.y, d.x)) * 0.13 + h * 30.0)));
            m = max(m, (1.0 - smoothstep(0.0, 0.007 + 0.045 * h * h * h, abs(fract(f) - (0.25 + 0.5 * h2)) / fr)) * there);
          }
          return m;
        }
        void main() {
          vec2 xz = vWorld.xz;
          float depth = vWorld.y - texture2D(tHeight, mapUv(xz)).r;
          if (depth < -0.02) discard;
          vec4 st = stateAt(xz);
          vec3 V = normalize(cameraPosition - vWorld);
          // ripples: long soft ones, drawn out along the way the water goes
          vec2 f = xz * vec2(0.55, 1.6) + vec2(uNow * 0.35, 0.0);
          float r1 = aNoise(f), r2 = aNoise(f * 2.3 + 9.0 - vec2(uNow * 0.2, 0.0));
          vec3 N = normalize(vec3((r1 - 0.5) * 0.22, 1.0, (r2 - 0.5) * 0.22));
          float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
          vec3 bed = mix(uShallow, uDeep, smoothstep(0.0, 0.6, depth));
          vec3 refl = mix(uSkyLow, uSkyHigh, clamp(reflect(-V, N).y * 1.4, 0.0, 1.0));
          vec3 col = mix(lit(bed, 0.75, 1.0), refl * 1.05, clamp(0.12 + fres * 0.85, 0.0, 1.0));
          // painted streaks of light on it, and where the sun is, glints
          col += vec3(1.0) * smoothstep(0.6, 0.74, r1 * 0.6 + r2 * 0.4) * 0.07;
          col += uSunCol * smoothstep(0.93, 0.97, aNoise(xz * vec2(3.0, 9.0) + vec2(uNow * 1.1, uNow * 0.3))) * pow(max(dot(reflect(-V, N), uSun), 0.0), 6.0) * 5.0;
          // a pale line where it meets the land
          float foam = 1.0 - smoothstep(0.02, 0.09, depth + (aNoise(xz * 4.0 + uNow * 0.25) - 0.5) * 0.06);
          col = mix(col, vec3(1.25), foam * 0.75);
          // frozen: pale ice, cracked, with a little of the sky in it and no ripple
          float ice = smoothstep(0.3, 0.55, st.g);
          if (ice > 0.0) {
            // Ice is looked into, not at: cracks on its face, and cracks seen again deeper down, dimmer and bluer,
            // sliding under the first as the eye moves. Bubbles are caught in it, and frost lies on it in drifts.
            vec2 into = V.xz / max(V.y, 0.3);
            float body = aNoise(xz * 0.5 + 3.0) * 0.6 + aNoise(xz * 1.7) * 0.4;
            vec3 iceCol = mix(vec3(0.22, 0.54, 0.8), vec3(0.62, 0.86, 0.97), body) * mix(1.08, 0.86, smoothstep(0.0, 0.6, depth));
            float c0 = cracks(xz), c1 = cracks(xz - into * 0.1 + 31.0), c2 = cracks(xz * 0.8 - into * 0.26 + 77.0);
            iceCol += vec3(0.2, 0.5, 0.8) * c2 * 0.4 + vec3(0.5, 0.82, 1.0) * c1 * 0.55;
            vec2 bp = (xz - into * 0.16) * 9.0;
            iceCol += vec3(0.6, 0.85, 1.0) * 0.5 * step(0.9, aHash(floor(bp))) * (1.0 - smoothstep(0.1, 0.36, length(fract(bp) - 0.5))) * smoothstep(0.52, 0.72, aNoise(xz * 0.6 + 50.0));
            vec3 iced = lit(iceCol, 0.85, 1.0);
            iced = mix(iced, mix(uSkyLow, uSkyHigh, clamp(V.y * 1.4, 0.0, 1.0)) * 1.05, clamp(0.03 + pow(1.0 - max(V.y, 0.0), 3.0) * 0.3, 0.0, 0.35));
            iced = mix(iced, lit(vec3(0.93, 0.98, 1.0), 1.0, 1.0), c0 * 0.92);
            // (it is frosted over, white and matt, with windows of clear ice in it: nothing like the water beside it)
            float drift = smoothstep(0.4, 0.68, aNoise(xz * 0.45 + 13.0) * 0.65 + aNoise(xz * 1.9 + 5.0) * 0.35);
            iced = mix(iced, lit(vec3(0.84, 0.93, 1.0), 0.92, 1.0), 0.1 + drift * 0.78);
            iced += uSunCol * pow(max(dot(reflect(-V, vec3(0.0, 1.0, 0.0)), uSun), 0.0), 50.0) * 2.2 * (1.0 - drift);
            // snow lies along its edge
            iced = mix(lit(vec3(0.96, 0.98, 1.0), 0.95, 1.0), iced, smoothstep(0.5, 0.96, st.g));
            col = mix(col, iced, ice);
          }
          col += (mix(bed, vec3(1.0), 0.3) * lamps(vWorld)) + uSealCol * seal(xz) * 0.9;
          gl_FragColor = vec4(air(col, vWorld), 1.0);
        }`,
    }));
    water.frustumCulled = false;
    group.add(water);
    for (const [sx, sz] of STEPS) solids.add(put(knead(ball(1, 3).scale(0.55 + 0.1 * R(), 0.2, 0.5 + 0.1 * R()), 0.05, 2.5, seed++), sx, WATER - 0.02, sz, R() * 3), any(['#b4aea4', '#c0b8aa', '#a8a298']), { scale: 1.6, moss: 0.25 });
  }

  // ============================================================================================================= trees
  say('Growing the trees');
  await turn();
  const GREEN = { ramp: ['#0f4a3a', '#1f7a3c', '#4fa83a', '#9fd040', '#e2e85a'].map(C), gold: C('#f4d84a') };
  const WARM = { ramp: ['#1f5236', '#3c8a3a', '#84b838', '#cfd844', '#f6ec6a'].map(C), gold: C('#ffd24a') };
  const PINE = { ramp: ['#062a30', '#0d4038', '#1b5c40', '#3c8448', '#86b050'].map(C) };
  const FAR = { ramp: ['#134a3c', '#256e40', '#4f983e', '#93c446', '#d8e060'].map(C), gold: C('#ecd658') };
  const ramp = (pal, t) => { t = Math.min(0.999, Math.max(0, t)) * 4; const i = Math.floor(t); return tmp.copy(pal.ramp[i]).lerp(pal.ramp[i + 1], t - i); };
  /** A bough of leaves: a dark mass, and touches of leaves all over it and loosely round its edge. `mid`: the middle of the whole crown. */
  function clump(c, r, pal, mid, { leaf = 0.2, dens = 150, squash = 0.8, sway = 0.6 } = {}, part = 0) {
    if (Math.hypot(c.x - HOME[0], c.z - HOME[1]) < 80) crowns.push([c.x, c.y, c.z, r]);
    growing?.clumps.push([c.x, c.y, c.z, r, part]);
    dabs.part = part;
    nrm.copy(c).sub(mid).normalize();
    dabs.add(c.x, c.y - r * 0.08, c.z, { w: r * 0.86, h: r * 0.8 * squash, turn: R() * TAU, seed: R(), kind: 2, colour: ramp(pal, 0.12 + 0.1 * R()), normal: nrm.clone(), inner: 0.35, sway });
    const n = Math.round(dens * r * r);
    for (let i = 0; i < n * 1.3; i++) {
      const edge = i >= n, u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u), k = edge ? 0.95 + 0.32 * R() : 0.4 + 0.6 * Math.cbrt(R());
      const px = c.x + Math.cos(a) * s * r * k, py = c.y + u * r * squash * k, pz = c.z + Math.sin(a) * s * r * k;
      // (which way out of the crown it faces: half from the bough it is on, half from the whole tree)
      nrm.set(Math.cos(a) * s, u, Math.sin(a) * s).multiplyScalar(0.55).add(V(px - mid.x, py - mid.y, pz - mid.z).normalize().multiplyScalar(0.75)).normalize();
      // (its own green: lighter the more it faces the sky and the sun, with a little chance in it)
      const tone = 0.2 + 0.5 * (nrm.dot(SUN) * 0.5 + 0.5) + 0.22 * (nrm.y * 0.5 + 0.5) + 0.2 * (R() - 0.5) + (edge ? 0.05 : 0);
      ramp(pal, tone);
      if (pal.gold && tone > 0.7 && R() < 0.12) tmp.lerp(pal.gold, 0.5);
      tmp.offsetHSL((R() - 0.5) * 0.025, 0, (R() - 0.5) * 0.04);
      const w = leaf * (0.75 + 0.6 * R()) * (edge ? 0.8 : 1);
      dabs.add(px, py, pz, { w, turn: R() * TAU, seed: R(), kind: 0, colour: tmp, normal: nrm.clone(), inner: edge ? 1 : 0.45 + 0.55 * Math.min(1, k), sway });
    }
  }
  /** A round tree: a trunk that forks, boughs out to its crown, and the crown a dome of boughs of leaves. */
  function tree(x, z, { h = 9, spread = 4, pal = GREEN, lean = 0, far = false, bark = '#8f5a3c' } = {}) {
    const y0 = ground(x, z) - 0.25, r0 = 0.1 + h * 0.034;
    begin(x, z, y0, h, spread, far);
    const fork = V(x + lean * 0.4 + (R() - 0.5) * 0.4, y0 + h * 0.42, z + (R() - 0.5) * 0.4), top = V(x + lean, y0 + h * 0.66, z + (R() - 0.5) * 0.5), mid = V(x + lean, y0 + h * 0.66, z);
    let stem = null, core = 0;
    if (!far) {
      growing.kind = 'tree';
      stem = trunk([V(x, y0, z), V(x + lean * 0.1 + (R() - 0.5) * 0.3, y0 + h * 0.2, z + (R() - 0.5) * 0.3), fork, top], (t) => r0 * (1.3 - 0.95 * t) * (1 + 0.9 * Math.max(0, 0.1 - t) / 0.1), 4, bark, { around: 12, every: 0.3, amount: 0.03, grain: 2.2, scale: 13, moss: 0.35 });
      // (the middle of the crown is one part; each bough that reaches out from it is another)
      core = newPart({ kind: 'crown', c: [mid.x, mid.y + spread * 0.5, mid.z], side: spread * 1.0, to: stem.ids[3], at: [top.x, top.y, top.z] });
      colliders.push({ x, z, r: r0 + 0.25, tree: growing });
    } else solids.add(roll([V(x, y0, z), top], (t) => r0 * (1.2 - 0.8 * t), { around: 6, every: 1.5 }), bark, { bark: true, scale: 5 });
    const boughs = far ? 4 : 7, opts = far ? { leaf: 0.42, dens: 34 } : {};
    clump(top.clone().add(V(0, spread * 0.55, 0)), spread * 0.52, pal, mid, opts, core);
    if (!far) for (let i = 0; i < 3; i++) clump(top.clone().add(V((R() - 0.5) * spread * 0.9, spread * (0.5 + 0.3 * R()), (R() - 0.5) * spread * 0.9)), spread * 0.36, pal, mid, opts, core);
    for (let i = 0; i < boughs; i++) {
      const a = (i / boughs) * TAU + R() * 0.6, out = spread * (0.62 + 0.22 * R()), end = V(mid.x + Math.cos(a) * out, mid.y + (R() - 0.25) * spread * 0.4, mid.z + Math.sin(a) * out);
      let bough = 0;
      if (!far) {
        const from = fork.clone().lerp(top, R() * 0.7);
        bough = newPart({ kind: 'crown', c: [end.x, end.y + spread * 0.1, end.z], side: spread * 0.6, to: stem.at(from.y), at: [from.x, from.y, from.z] });
        solids.part = bough;
        solids.add(roll([from, from.clone().lerp(end, 0.55).add(V(0, 0.2 * out, 0)), end], (t) => r0 * (0.42 - 0.34 * t), { around: 7, every: 0.45 }), bark, { bark: true, scale: 16 });
        solids.part = 0;
      }
      clump(end, spread * (0.4 + 0.12 * R()), pal, mid, opts, bough);
      if (!far) clump(V(end.x + (R() - 0.5) * spread * 0.5, end.y + spread * (0.22 + 0.2 * R()), end.z + (R() - 0.5) * spread * 0.5), spread * (0.3 + 0.1 * R()), pal, mid, opts, bough);
    }
    for (let i = 0; i < (far ? 2 : 4); i++) clump(V(mid.x + (R() - 0.5) * spread * 0.9, mid.y + spread * (0.3 + 0.3 * R()), mid.z + (R() - 0.5) * spread * 0.9), spread * (0.34 + 0.1 * R()), pal, mid, opts, core);
    end();
  }
  /** A pine: a tall dark stem, tiers of boughs that droop and lift at their ends, bare stubs low down. */
  function pine(x, z, h = 15, far = false) {
    const y0 = ground(x, z) - 0.25, r0 = 0.16 + h * 0.016, mid = V(x, y0 + h * 0.6, z);
    begin(x, z, y0, h, h * 0.25, far);
    const pts = [V(x, y0, z), V(x + (R() - 0.5) * 0.3, y0 + h * 0.5, z + (R() - 0.5) * 0.3), V(x, y0 + h * 0.98, z)], rad = (t) => r0 * (1.25 - 1.1 * t) * (1 + 0.7 * Math.max(0, 0.08 - t) / 0.08);
    let stem = null;
    if (growing) {
      growing.kind = 'pine';
      // (each stretch of its stem carries the tiers of boughs that leave it there)
      stem = trunk(pts, rad, 5, '#6a4030', { around: 10, every: 0.5, amount: 0.02, grain: 2.5, scale: 12, moss: 0.2, wide: (f) => (f < 0.2 ? 0 : ((1 - (f - 0.2) / 0.8) ** 0.85 * h * 0.3 + 0.5) * 1.1) });
      for (const t of [0.3, 0.5, 0.7, 0.88]) growing.clumps.push([x, y0 + h * t, z, (1 - t) * h * 0.28 + 0.6, stem.at(y0 + h * t)]);
      colliders.push({ x, z, r: r0 + 0.25, tree: growing });
    } else solids.add(knead(roll(pts, rad, { around: 6, every: 1.5 }), 0.02, 2.5, seed++), '#6a4030', { bark: true, scale: 12, moss: 0.2 });
    const tiers = Math.round(h * 0.95), from = 0.2;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1), y = y0 + h * (from + (1 - from) * t), reach = (1 - t) ** 0.85 * h * 0.3 + 0.5, arms = far ? 5 : 7 + Math.floor(R() * 2);
      dabs.part = stem ? stem.at(y) : 0;
      for (let j = 0; j < arms; j++) {
        const a = (j / arms) * TAU + k * 0.9 + R() * 0.5, dx = Math.cos(a), dz = Math.sin(a), len = reach * (0.75 + 0.4 * R()), steps = Math.max(3, Math.round(len / (far ? 0.8 : 0.27)));
        for (let s = 1; s <= steps; s++) {
          const u = s / steps, out = len * u, droop = -len * 0.34 * Math.sin(u * 2.4) + len * 0.1 * u * u;
          nrm.set(dx * 0.6, 0.75, dz * 0.6).normalize();
          ramp(PINE, (0.25 + 0.55 * u + 0.25 * (R() - 0.5)) * (0.7 + 0.3 * (nrm.dot(SUN) * 0.5 + 0.5)));
          const w = (far ? 1.0 : 0.44) * (1.05 - 0.4 * u) * (0.85 + 0.3 * R());
          // (the bough itself, under its needles: a dark flat mass, so that a pine is a solid thing and not a haze of lines)
          if (s % 2 === 1 || far) { const body = PINE.ramp[0].clone().lerp(PINE.ramp[1], 0.3 + 0.5 * u); dabs.add(x + dx * out * 0.96, y + droop - 0.1, z + dz * out * 0.96, { w: w * 1.15, h: w * 0.42, turn: (R() - 0.5) * 0.3, seed: R(), kind: 2, colour: body, normal: nrm.clone(), inner: 0.4 + 0.5 * u, sway: 0.3 + 0.5 * u }); }
          dabs.add(x + dx * out + (R() - 0.5) * 0.15, y + droop + (R() - 0.5) * 0.1, z + dz * out + (R() - 0.5) * 0.15, { w, h: w * 1.05, turn: (R() - 0.5) * 0.7, seed: R(), kind: 1, colour: tmp, normal: nrm.clone(), inner: 0.45 + 0.55 * u, sway: 0.3 + 0.5 * u });
        }
      }
    }
    // the stubs of boughs it has lost
    if (!far) for (let i = 0; i < 5; i++) { const a = R() * TAU, y = y0 + h * (0.1 + 0.2 * R()), l = 0.5 + 0.9 * R(); solids.part = stem.at(y); solids.add(roll([V(x, y, z), V(x + Math.cos(a) * l, y + 0.15 * l, z + Math.sin(a) * l)], (t) => 0.06 - 0.045 * t, { around: 5, every: 0.5 }), '#4a2c26', { bark: true, scale: 14 }); }
    end();
  }
  /** A bush: a low heap of leaves. */
  function bush(x, z, r = 1, pal = GREEN) {
    const y = ground(x, z), mid = V(x, y + r * 0.3, z);
    begin(x, z, y, r, r, false);
    clump(V(x, y + r * 0.5, z), r, pal, mid, { leaf: 0.15, dens: 170, squash: 0.7 });
    for (let i = 0; i < 2; i++) clump(V(x + (R() - 0.5) * r * 1.5, y + r * 0.34, z + (R() - 0.5) * r * 1.5), r * 0.62, pal, mid, { leaf: 0.15, dens: 170, squash: 0.7 });
    end();
  }
  tree(-9, 15, { h: 11.5, spread: 5.2, lean: -0.6 });
  tree(12.5, 21, { h: 9, spread: 4.2, pal: WARM });
  tree(-23, -2, { h: 10, spread: 4.6, pal: WARM, lean: 0.5 });
  tree(23, -13, { h: 10.5, spread: 4.8 });
  tree(-14, -25, { h: 9.5, spread: 4.4 });
  tree(-31, 23, { h: 10, spread: 4.6 });
  tree(31, 27, { h: 9.5, spread: 4.4, pal: WARM });
  tree(-5, -47, { h: 11, spread: 5 });
  tree(27, -39, { h: 9, spread: 4.2, pal: WARM });
  tree(29, 11.5, { h: 8.5, spread: 3.8, lean: -0.8 });
  tree(-36, -30, { h: 10, spread: 4.6 });
  tree(14, -44, { h: 8.5, spread: 3.8, pal: WARM });
  for (const [x, z, h] of [[-40, -14, 17], [-44, -3, 15], [39, -26, 17], [43, -12, 14.5], [-33, -43, 16], [18, -55, 17.5], [-12, -58, 15.5], [-46, 12, 16], [46, 6, 15]]) pine(x, z, h);
  for (const [x, z, r] of [[-12.5, 12, 1.1], [15, 18.5, 0.9], [-20, 1, 1.0], [25.5, -10, 1.1], [-17, -22, 0.9], [9, 9.5, 0.8], [-7, -6, 0.9], [12, -20, 1.0], [-27, 13, 1.1], [33, 20, 1.0], [-3, -40, 0.9], [22, -33, 1.0], [26, 14, 0.8]]) bush(x, z, r, R() < 0.4 ? WARM : GREEN);

  // ===================================================================================================== rocks and stones
  say('Setting the stones');
  await turn();
  const ROCK = ['#b4aea4', '#a8a298', '#c0b8aa', '#9c988f'];
  /** A boulder: a lump with flats on it. */
  function boulder(x, z, s = 1, sink = 0.25) {
    const g = knead(ball(1, 2).scale(s * (0.9 + 0.4 * R()), s * (0.6 + 0.25 * R()), s * (0.8 + 0.35 * R())), s * 0.16, 1.1 / s, seed++, 5, s * 0.8);
    solids.add(put(g, x, ground(x, z) + s * (0.3 - sink), z, R() * 6), any(ROCK), { scale: 0.9 / s + 0.5, moss: 0.4 });
    if (s > 0.7) colliders.push({ x, z, r: s * 0.85 });
  }
  for (const [x, z, s] of [[-5.5, 6.5, 0.9], [-7, 5.4, 0.5], [4.5, 2.2, 0.7], [6, 6.2, 1.1], [13, 1, 0.8], [27, 7, 1.3], [24.5, 11.5, 0.7], [-18, 6.5, 1.0], [-21, 3.2, 0.6], [-3.5, 20, 0.6], [8, -8, 1.4], [9.6, -9.6, 0.6], [-10, -14, 0.9], [18, -24, 1.2], [-25, -16, 1.5], [-26.6, -14.2, 0.7], [33, -2, 1.0], [-30, 8, 0.8]]) boulder(x, z, s);
  // the ring of standing stones on the rise
  const stones = [];
  {
    const [cx, cz] = CIRCLE, n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.35, x = cx + Math.cos(a) * 6.2, z = cz + Math.sin(a) * 6.2, y = ground(x, z), h = 2.7 + 1.1 * R(), w = 0.95 + 0.35 * R(), d = 0.5 + 0.2 * R(), face = Math.atan2(cx - x, cz - z);
      const fallen = i === 4;
      const g = knead(block(w, h, d, 0.12, 0.3), 0.07, 1.2, seed++, 6, 0.5);
      // (each leans a little; one has fallen)
      if (fallen) g.rotateX(Math.PI / 2 - 0.12).translate(0, d * 0.4, h * 0.3); else g.rotateZ((R() - 0.5) * 0.14).rotateX((R() - 0.5) * 0.12).translate(0, h / 2 - 0.35, 0);
      solids.add(put(g, x, y, z, face), any(ROCK), { scale: 0.75, moss: 0.3 });
      colliders.push({ x, z, r: fallen ? 1.2 : 0.7 });
      if (!fallen) stones.push({ x, y, z, h, d, face });
    }
    solids.add(put(knead(turned_(1.5, 0.5), 0.05, 1.5, seed++, 4, 0.6), cx, ground(cx, cz) - 0.05, cz), ROCK[1], { scale: 0.8, moss: 0.3 });
    colliders.push({ x: cx, z: cz, r: 1.5 });
  }
  function turned_(r, h) { const g = block(r * 2, h, r * 2, 0.16, 0.3); return g.translate(0, h / 2, 0); }

  // The runes on the standing stones: each stone has three, cut one under another into its inward face, and they
  // glow, slowly, not all together. The letters are this world's own: every one is a stave with strokes off it.
  {
    const COLS = 8, ROWS = 4, cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d'), RR = rng(77);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < COLS * ROWS; k++) {
      const ox = (k % COLS) * 64, oy = Math.floor(k / COLS) * 64, P = (c, r) => [ox + 20 + c * 12, oy + 10 + r * 11];
      g.lineWidth = 4.5;
      const line = (a, b) => { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
      const stave = Math.floor(RR() * 3);
      if (RR() < 0.85) line(P(stave, 0), P(stave, 4));
      const strokes = 2 + Math.floor(RR() * 2);
      for (let s = 0; s < strokes; s++) {
        const r0 = Math.floor(RR() * 4), c1 = (stave + 1 + Math.floor(RR() * 2)) % 3, r1 = Math.min(4, Math.max(0, r0 + (RR() < 0.5 ? 1 : -1) * (1 + Math.floor(RR() * 2))));
        line(P(stave, r0), P(c1, r1));
        if (RR() < 0.35) line(P(c1, r1), P(stave, Math.min(4, r1 + 1)));
      }
      if (RR() < 0.3) { const [x, y] = P(Math.floor(RR() * 3), Math.floor(RR() * 5)); g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); }
    }
    const atlas = new THREE.CanvasTexture(cv);
    atlas.colorSpace = THREE.NoColorSpace;
    atlas.generateMipmaps = false; atlas.minFilter = atlas.magFilter = THREE.LinearFilter;
    U.tRunes.value = atlas;
    const pos = [], uv = [], ph = [], index = [];
    stones.forEach((s, si) => {
      for (let k = 0; k < 3; k++) {
        const glyph = Math.floor(R() * COLS * ROWS), u0 = (glyph % COLS) / COLS, v0 = 1 - (Math.floor(glyph / COLS) + 1) / ROWS, yc = s.y + s.h * (0.62 - 0.2 * k) - 0.35, hw = 0.24, hh = 0.24, out = s.d / 2 + 0.06;
        const cx = s.x + Math.sin(s.face) * out, cz = s.z + Math.cos(s.face) * out, rx = Math.cos(s.face), rz = -Math.sin(s.face), p = pos.length / 3;
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(cx + rx * a * hw, yc + b * hh, cz + rz * a * hw); uv.push(u0 + ((a + 1) / 2) / COLS, v0 + ((b + 1) / 2) / ROWS); ph.push(si * 1.7 + k * 0.6); }
        index.push(p, p + 1, p + 2, p, p + 2, p + 3);
      }
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    rg.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1));
    rg.setIndex(index);
    const runes = new THREE.Mesh(rg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uNow: U.uNow, tRunes: { value: atlas }, uGlow: { value: C('#6fe6ff') } },
      vertexShader: /* glsl */ `attribute float phase; varying vec2 vUv; varying float vPhase; void main() { vUv = uv; vPhase = phase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vPhase; uniform float uNow; uniform sampler2D tRunes; uniform vec3 uGlow;
        void main() {
          float a = texture2D(tRunes, vUv).r, pulse = 0.55 + 0.45 * sin(uNow * 0.8 + vPhase);
          gl_FragColor = vec4(uGlow * a * (0.9 + 2.6 * pulse), 1.0);
        }`,
    }));
    runes.frustumCulled = false;
    runes.renderOrder = 4;
    group.add(runes);
    world_.atlas = atlas;
  }

  // =========================================================================================================== far off
  say('Laying in the hills');
  await turn();
  {
    // woods on the hills beyond: trees and pines, hundreds of them, small with distance
    let made = 0;
    for (let i = 0; i < 2400 && made < 300; i++) {
      const a = R() * TAU, r = 100 + 240 * R() * R(), x = HOME[0] + Math.cos(a) * r, z = HOME[1] + Math.sin(a) * r;
      if (wet(x, z) > -5 || noise(x * 0.02 + 5, z * 0.02) * 0.7 + noise(x * 0.07, z * 0.07) * 0.3 < -0.05) continue;
      if (R() < 0.3) pine(x, z, 13 + 6 * R(), true); else tree(x, z, { h: 8 + 5 * R(), spread: 3.6 + 1.6 * R(), pal: FAR, far: true });
      made++;
    }
    // and the ranges past them, one behind another, to the mountain
    const RANGES = [
      { far: 520, lo: 2.5, hi: 6.5, f: 2.4, pig: '#2f8a52', s: 3, wood: 1 },
      { far: 900, lo: 4.5, hi: 9.5, f: 2.0, pig: '#3f7fa0', s: 11, wood: 0.5 },
      { far: 1500, lo: 6.5, hi: 13, f: 1.7, pig: '#5f86c8', s: 19, wood: 0 },
      { far: 2400, lo: 8, hi: 14, f: 1.4, pig: '#8fa8e0', s: 29, wood: 0, peak: true },
    ];
    const SEG = 720, pos = [], col = [], dat = [], index = [], pig = new THREE.Color();
    RANGES.forEach(({ far, lo, hi, f, pig: colour, s, wood, peak }, layer) => {
      const first = pos.length / 3;
      pig.set(colour);
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const sw = Math.min(1, Math.max(0, 0.5 + 0.55 * noise(ca * f + s, sa * f + s * 1.7) + 0.26 * noise(ca * f * 2.9 + s * 3, sa * f * 2.9) + 0.08 * noise(ca * f * 8 + 5, sa * f * 8 + s)));
        let deg = lo + (hi - lo) * sw;
        // the mountain: to the north, a little left of the way ahead
        if (peak) { const da = Math.atan2(Math.sin(a + 1.86), Math.cos(a + 1.86)); deg += 15 * Math.exp(-((Math.abs(da) / 0.2) ** 1.5)) * (0.92 + 0.12 * noise(a * 30, 3)) + 7 * Math.exp(-((Math.abs(da - 0.4) / 0.14) ** 1.6)); }
        const top = far * Math.tan((deg * Math.PI) / 180);
        pos.push(ca * far, top, HOME[1] + sa * far, ca * far, -30, HOME[1] + sa * far);
        for (let k = 0; k < 2; k++) { col.push(pig.r, pig.g, pig.b); dat.push(a, k, top, wood + (peak ? 10 : 0)); }
        if (i) { const p = first + (i - 1) * 2; index.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('dat', new THREE.Float32BufferAttribute(dat, 4));
    g.setIndex(index);
    const ranges = new THREE.Mesh(g, new THREE.ShaderMaterial({
      side: THREE.DoubleSide, vertexColors: true, uniforms: Object.fromEntries(Object.keys(U).map((k) => [k, U[k]])),
      vertexShader: /* glsl */ `attribute vec4 dat; varying vec3 vCol; varying vec4 vDat; varying vec3 vWorld; void main() { vCol = color; vDat = dat; vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: AIR + /* glsl */ `
        varying vec3 vCol; varying vec4 vDat; varying vec3 vWorld;
        void main() {
          float a = vDat.x, top = vDat.z, down = (top - vWorld.y) / max(top, 1.0), wood = mod(vDat.w, 10.0), peak = step(5.0, vDat.w);
          // painted in planes: spurs that catch the sun on one side and are blue on the other
          float spur = aNoise(vec2(a * 46.0 + down * 5.0, down * 3.0 + vDat.z * 0.01)), plane = smoothstep(0.42, 0.56, spur);
          vec3 col = vCol * mix(0.62, 1.2, plane);
          // woods on the nearer ones: darker, in drifts along the crest and down the folds
          col = mix(col, vCol * 0.5, wood * smoothstep(0.4, 0.6, aNoise(vec2(a * 120.0, down * 14.0))) * 0.6);
          // snow on the mountain, lying further down in the gullies
          float snow = peak * (1.0 - smoothstep(0.2, 0.34, down + (spur - 0.5) * 0.22)) * step(520.0, top);
          col = mix(col, mix(vec3(0.62, 0.74, 1.0), vec3(1.25, 1.2, 1.15), plane), snow);
          gl_FragColor = vec4(air(col * (uSunCol * 0.75 + uSkyCol * 0.6), vWorld), 1.0);
        }`,
    }));
    ranges.frustumCulled = false;
    group.add(ranges);
  }

  group.add(solids.build(), dabs.build());
  group.name = 'meadow';
  scene.add(group);

  // ============================================================================================================ the light
  // (the lamp is only there to throw shadows: see air.js)
  const lamp = new THREE.DirectionalLight('#ffffff', Math.PI);
  lamp.position.copy(SUN).multiplyScalar(160).add(V(HOME[0], 0, HOME[1]));
  lamp.target.position.set(HOME[0], 0, HOME[1]);
  lamp.castShadow = true;
  const mobile = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 820);
  lamp.castShadow = !mobile;
  lamp.shadow.mapSize.set(mobile ? 512 : 4096, mobile ? 512 : 4096);
  Object.assign(lamp.shadow.camera, { left: -84, right: 84, top: 84, bottom: -84, near: 20, far: 340 });
  lamp.shadow.camera.updateProjectionMatrix();
  lamp.shadow.bias = -0.0006;
  lamp.shadow.normalBias = 0.05;
  lamp.shadow.radius = 1.4;
  scene.add(lamp, lamp.target);

  const [sx, sz] = WAY[0];
  return Object.assign(world_, {
    ground, colliders, home: HOME, edge: EDGE, water: WATER, trees, root: group,
    /** The ground as it is walked on: frozen water bears a walker. */
    walk(x, z) { let g = ground(x, z); if (g < WATER && state[(Math.floor((z - MAP.z0) / (MAP.size / STATE)) * STATE + Math.floor((x - MAP.x0) / (MAP.size / STATE))) * 4 + 1] > 110) g = WATER + 0.02; for (const f of floors) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1 && f.y > g) g = f.y; return g; },
    /** The parts trees are grown in. */
    parts,
    /** The ground is torn bare about a place (where a tree was pulled up). */
    bare(x, z, r) {
      const at = (v, o) => Math.floor(((v - o) / MAP.size) * 512);
      for (let j = Math.max(0, at(z - r, MAP.z0)); j <= Math.min(511, at(z + r, MAP.z0)); j++) for (let i = Math.max(0, at(x - r, MAP.x0)); i <= Math.min(511, at(x + r, MAP.x0)); i++) {
        const d = Math.hypot(MAP.x0 + ((i + 0.5) / 512) * MAP.size - x, MAP.z0 + ((j + 0.5) / 512) * MAP.size - z) / r, k = (j * 512 + i) * 4;
        if (d < 1) { const f = 1 - d * d; kindMap[k] = Math.max(kindMap[k], 255 * f); kindMap[k + 2] *= 1 - f; kindMap[k + 3] *= 1 - f; }
      }
      U.tKind.value.needsUpdate = true;
    },
    /** A terrace is laid: it is walked on at its own height, and nothing grows through it. */
    pave(f) {
      floors.push(f);
      const at = (v, o) => Math.floor(((v - o) / MAP.size) * 512);
      for (let j = Math.max(0, at(f.z0 - 0.4, MAP.z0)); j <= Math.min(511, at(f.z1 + 0.4, MAP.z0)); j++) for (let i = Math.max(0, at(f.x0 - 0.4, MAP.x0)); i <= Math.min(511, at(f.x1 + 0.4, MAP.x0)); i++) { kindMap[(j * 512 + i) * 4 + 2] = 0; kindMap[(j * 512 + i) * 4 + 3] = 0; }
      U.tKind.value.needsUpdate = true;
    },
    /** What has been done to the ground, for whoever works on it: the numbers, how to find a place in them, and how to say they changed. */
    state: { N: STATE, data: state, cell: MAP.size / STATE, x0: MAP.x0, z0: MAP.z0, touch() { stateTex.needsUpdate = true; } },
    /** How well grass grows at a place, 0 to 1. */
    /** How much of a trodden path a place is, 0 to 1. */
    pathAt(x, z) { const i = Math.floor(((x - MAP.x0) / MAP.size) * 512), j = Math.floor(((z - MAP.z0) / MAP.size) * 512); return i < 0 || j < 0 || i > 511 || j > 511 ? 0 : kindMap[(j * 512 + i) * 4] / 255; },
    grassAt(x, z) { const i = Math.floor(((x - MAP.x0) / MAP.size) * 512), j = Math.floor(((z - MAP.z0) / MAP.size) * 512); return i < 0 || j < 0 || i > 511 || j > 511 ? 0 : kindMap[(j * 512 + i) * 4 + 3] / 255; },
    /** Says a tree has changed, so that its leaves and trunk show it. */
    treeChanged(t) { treeData.set([t.burnt * 255, t.frost * 255, t.burning * 255, (t.shake ?? 0) * 255], t.id * 4); treeTex.needsUpdate = true; },
    /** What a line from o along d first meets within `max`: the ground (or the water), or a tree's crown. */
    aim(o, d, max = 70) {
      let hit = max, tree = null;
      for (let i = 1; i < trees.length; i++) for (const [x, y, z, r] of trees[i].clumps) {
        if (trees[i].burnt > 0.9) break;
        const lx = x - o.x, ly = y - o.y, lz = z - o.z, s = lx * d.x + ly * d.y + lz * d.z;
        if (s < 0 || s - r > hit) continue;
        const off2 = lx * lx + ly * ly + lz * lz - s * s, rr = r * r * 0.8;
        if (off2 < rr) { const at = s - Math.sqrt(rr - off2); if (at > 0 && at < hit) { hit = at; tree = trees[i]; } }
      }
      const over = (t) => o.y + d.y * t - Math.max(ground(o.x + d.x * t, o.z + d.z * t), WATER);
      let a = 0, found = false;
      for (let t = 0.6; t < hit; t += 0.6 + t * 0.02) { if (over(t) < 0) { let b = t; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (over(m) < 0) b = m; else a = m; } hit = b; tree = null; found = true; break; } a = t; }
      const point = V(o.x + d.x * hit, o.y + d.y * hit, o.z + d.z * hit);
      return { point, dist: hit, tree, ground: found, water: found && ground(point.x, point.z) < WATER, none: !found && !tree };
    },
    start: { x: sx, z: sz, yaw: Math.atan2(WAY[1][0] - sx, WAY[1][1] - sz) },
    way: new THREE.CatmullRomCurve3(WAY.map(([x, z]) => V(x, 0, z))).getPoints(160).map((p) => [p.x, p.z]),
    fov: 62, far: 6000, sun: SUN,
    counts: { dabs: dabs.count, pieces: solids.count },
    /** Writes to what has been done to the ground: channel 0 burnt, 1 frozen, 2 wet, 3 overgrown; amount -1 to 1. */
    mark(x, z, radius, channel, amount) {
      const cell = MAP.size / STATE, i0 = Math.max(0, Math.floor((x - radius - MAP.x0) / cell)), i1 = Math.min(STATE - 1, Math.ceil((x + radius - MAP.x0) / cell)), j0 = Math.max(0, Math.floor((z - radius - MAP.z0) / cell)), j1 = Math.min(STATE - 1, Math.ceil((z + radius - MAP.z0) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(MAP.x0 + (i + 0.5) * cell - x, MAP.z0 + (j + 0.5) * cell - z) / radius;
        if (d < 1) { const k = (j * STATE + i) * 4 + channel; state[k] = Math.min(255, Math.max(0, state[k] + amount * 255 * (1 - d * d))); }
      }
      stateTex.needsUpdate = true;
    },
    /** How much sun reaches a place, 0 to 1: less under a tree. */
    sunAt(p) {
      let open = 1;
      for (const [x, y, z, r] of crowns) {
        const dx = x - p.x, dy = y - p.y, dz = z - p.z, s = dx * SUN.x + dy * SUN.y + dz * SUN.z;
        if (s < 0) continue;
        const d = Math.hypot(dx - SUN.x * s, dy - SUN.y * s, dz - SUN.z * s) / r;
        if (d < 1.1) open = Math.min(open, sstep(0.55, 1.1, d));
      }
      return open;
    },
    update(dt, feet, camera, speed = 0) {
      sky.position.copy(camera.position);
      // the grass parts round whoever walks in it
      U.uPush.value[0].set(feet.x, feet.z, 1.1, 0.5 + 0.25 * Math.min(1, speed / 4));
    },
  });
}
const world_ = {};
