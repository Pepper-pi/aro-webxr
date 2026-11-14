// A thing to break: a ruined watchtower and a length of wall, of dressed stone, every block a rigid body welded to
// the blocks it touches (Patch's destruction block: three-avbd by Steven Bobyn, MIT, and Timberfall's builder).
//
// The physics runs on a graphics device of its own (WebGPU compute), apart from the meadow's renderer (WebGL): it
// draws nothing. Every frame the blocks' poses are read back and the meadow draws them itself, as it paints
// everything else, so they take its sun, its shade, its haze and the light of its fires. Where there is no WebGPU
// there is no ruin, and the meadow is as it was.
//
// The physics has z up and its own origin at the foot of the tower: `toPhys` and the mesh's base matrix go between.
import * as THREE from 'three';
import { World } from 'three-avbd';
import { shadowed } from './air.js';
import { conj, qmul, rotate } from './physics/builder.ts';
import { plan } from './structures.js';
import { DT, GRAVITY, ITERATIONS, Structure } from './physics/structure.ts';

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** What each piece is painted as, and its colour: 0 stone, 1 timber, 2 plaster, 3 tile (8 the same, lying the other way), 4 boards, 5 brick, 6 paving, 7 hay, 9 cloth. */
function lookOf(p) {
  const r = p.role, m = p.mat;
  if (r === 'paving') return [6, '#b7ab96'];
  if (r === 'footing') return [0, '#8d877b'];
  if (m === 'stone') return [0, { fieldstone: '#9a9488', kerb: '#9a9488', base: '#958e80', band: '#8f897c', quoin: '#d8cfb9', ashlar: '#cdc3ac', drum: '#d2c8b1', foot: '#c3b9a2', cap: '#8f8a80' }[r] ?? '#b3a995'];
  if (m === 'timber') return [1, r === 'spar' || r === 'pole' ? '#6f5236' : '#553a26'];
  if (m === 'plaster') return [2, '#ece2c8'];
  if (m === 'tile') return [r.endsWith('-x') ? 8 : 3, r === 'ridge' ? '#9c4a2b' : '#c2643a'];
  if (m === 'brick') return [5, '#a45840'];
  if (r === 'pane') return [10, '#ffc66a'];
  if (r === 'sail' || r === 'sack') return [9, r === 'sack' ? '#d9cfb4' : '#efe6cf'];
  if (r === 'banner') return [9, '#b8322a'];
  if (r === 'hay') return [7, '#d8b85a'];
  return [4, { crate: '#b98a52', barrel: '#75502f', door: '#5f4128', shutter: '#3f6f60', floor: '#9c774a', cladding: '#8a6844' }[r] ?? '#8a6844'];
}

export async function createRuin({ air, meadow, scene, fx, say, turn }) {
  const gpu = navigator.gpu;
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null);
  if (!adapter) return null;
  const most = 1 << 30;
  const device = await adapter.requestDevice({ requiredLimits: {
    maxStorageBufferBindingSize: Math.min(most, adapter.limits.maxStorageBufferBindingSize),
    maxBufferSize: Math.min(most, adapter.limits.maxBufferSize),
    maxStorageBuffersPerShaderStage: Math.min(10, adapter.limits.maxStorageBuffersPerShaderStage),
  } }).catch(() => null);
  if (!device) return null;

  // the physics' measures: x as the meadow's, y the meadow's z the other way about, z up; the same origin
  const ox = 0, oy = 0, oz = 0, toPhys = (p) => [p.x, -p.z, p.y];
  const { builder: built, floors } = plan((x, z) => meadow.ground(x, z), meadow.trees, meadow.parts);
  for (const f of floors) meadow.pave(f);
  const MAX = Math.ceil((built.pieces.length + 64) / 256) * 256;
  const world = await World.create({ device, maxBodies: MAX, gravity: [0, 0, -GRAVITY], iterations: ITERATIONS, dt: DT });
  world.maxSubsteps = 2;
  // (room for a collapse's contacts up front: grown in doublings while everything comes down, each is a hitch)
  const solver = world.solver;
  solver.allocateContacts(Math.max(solver.contactCapacity, MAX * 40), Math.max(solver.pairCapacity, MAX * 12), Math.max(solver.manifoldCapacity, MAX * 8));

  const s = Structure.build(world, built, { strength: 0.6, density: 1, friction: 1 });
  // they are put up with welds that cannot break, left to stand, and then each weld is given its strength from what it carries
  for (let guard = 0; !s.settle(6) && guard < 1200; guard++) { if (guard % 6 === 0) say?.('Raising the walls'); await sleep(1); }
  world.onBreak((joint) => {
    const i = s.markBroken(joint);
    // (a puff of dust where a joint in masonry lets go, now and then)
    if (i < 0 || !fx || Math.random() > 0.3) return;
    const w = s.welds[i], pc = s.pieces[w.a], p = s.position(w.a);
    if (pc.mat === 'stone' || pc.mat === 'brick' || pc.mat === 'plaster') fx.spawn({ kind: 2, x: p[0], y: p[2], z: -p[1], vx: fx.rnd(0.6), vy: 0.5 + Math.random(), vz: fx.rnd(0.6), life: 1.2 + Math.random(), size: [0.3, 1.3], colour: pc.mat === 'brick' ? [0.72, 0.56, 0.48] : [0.8, 0.76, 0.68], alpha: 0.3, drag: 0.8 });
  });
  world.readbackEvery = 1;
  const splinters = (x, y, z, n) => {
    if (!fx) return;
    for (let q = 0; q < n; q++) fx.spawn({ kind: 4, x: x + fx.rnd(0.5), y: y + fx.rnd(0.5), z: z + fx.rnd(0.5), vx: fx.rnd(6), vy: 1 + 5 * Math.random(), vz: fx.rnd(6), life: 1.2 + Math.random(), size: [0.05, 0.12], colour: Math.random() < 0.5 ? [0.85, 0.7, 0.46] : [0.4, 0.26, 0.16], grav: -7, drag: 0.6, rot: Math.random() * 6.283, spin: fx.rnd(14) });
  };

  // --- drawn the meadow's way: every piece a box, painted as what it is made of ---
  const ids = [], terraces = [];
  s.pieces.forEach((p, i) => { if (!p.fixed || p.role === 'tree') ids.push(i); else if (p.role === 'paving' || p.role === 'footing') terraces.push(i); });
  const material = shadowed(air, {
    key: 'piece',
    vertexPars: 'attribute float aLook; attribute vec3 aTint; varying vec3 vLocal; flat varying vec3 vHalf; varying vec3 vNw; flat varying vec3 vNl; varying vec3 vWorld; flat varying vec3 vSeed; flat varying vec3 vTint; flat varying vec2 vLook;',
    vertex: /* glsl */ `#include <begin_vertex>
  vec3 pScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position * pScale; vHalf = pScale * 0.5; vNl = normal; vTint = aTint;
  vNw = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * (normal / pScale));
  vWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
  // (which way is down a slab of roof: its tiles overlap that way)
  vec3 pSlope = mat3(modelMatrix) * mat3(instanceMatrix) * (aLook > 7.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0));
  vLook = vec2(aLook, pSlope.y < 0.0 ? 1.0 : -1.0);
  float pId = float(gl_InstanceID) + aLook * 31.0; vSeed = fract(sin(vec3(pId * 12.9898, pId * 78.233, pId * 37.719)) * 43758.5453);`,
    fragmentPars: 'varying vec3 vLocal; flat varying vec3 vHalf; varying vec3 vNw; flat varying vec3 vNl; varying vec3 vWorld; flat varying vec3 vSeed; flat varying vec3 vTint; flat varying vec2 vLook;\nfloat pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    fragment: /* glsl */ `
  vec3 pN = normalize(vNw), nl = abs(vNl);
  // the two ways across the face that is seen, in the piece's own measure (m); how near its edge; its long way, and the way across that
  vec2 uv = nl.x > 0.5 ? vLocal.yz : nl.y > 0.5 ? vLocal.xz : vLocal.xy;
  vec3 pE = vHalf - abs(vLocal);
  float pEdge = max(min(pE.x, pE.y), min(max(pE.x, pE.y), pE.z)), look = vLook.x;
  vec3 pLong = vHalf.x >= vHalf.y && vHalf.x >= vHalf.z ? vec3(1.0, 0.0, 0.0) : vHalf.y >= vHalf.z ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  float along = dot(vLocal, pLong), across = dot(vLocal, max(vec3(1.0) - pLong - vec3(greaterThan(nl, vec3(0.5))), 0.0));
  vec3 pAlb = vTint * (0.9 + 0.2 * vSeed.y);
  float grey = 1.0, glow = 0.0;
  // how far above the ground this is: the foot of a wall is damp, and green
  float pUp = vWorld.y - texture2D(tHeight, mapUv(vWorld.xz)).r, damp = 1.0 - smoothstep(0.0, 1.5, pUp + (aNoise(vWorld.xz * 1.7 + vWorld.y) - 0.5) * 0.9);
  if (look > 9.5) {
    // a window with a light behind it: warm, brightest at its middle, crossed by its leading
    vec2 g = uv * vec2(7.0, 5.0); float lead = (1.0 - smoothstep(0.0, 0.07, min(fract(g.x), 1.0 - fract(g.x)))) + (1.0 - smoothstep(0.0, 0.07, min(fract(g.y), 1.0 - fract(g.y))));
    pAlb = vTint * 0.5; glow = (1.25 - 0.5 * length(uv * vec2(1.6, 3.0))) * (1.0 - 0.6 * min(lead, 1.0));
  } else if (look < 0.5) {
    // dressed stone: each its own shade, a few broad strokes across its face, worn darker along its edges, moss on what faces the sky
    pAlb = vTint * mix(0.78, 1.08, vSeed.x) * (0.9 + 0.2 * smoothstep(0.35, 0.65, aNoise(vec2(dot(vLocal, vec3(1.3, 1.1, 0.25)) * 2.4 + vSeed.z * 20.0, vLocal.z * 4.0 + vSeed.x * 9.0))));
    pAlb *= 0.9 + 0.1 * smoothstep(0.3, 0.7, aNoise(vWorld.xz * 2.5 + vWorld.y * 0.7));
    pAlb *= 1.0 - 0.42 * (1.0 - smoothstep(0.0, 0.045, pEdge));
    float pMoss = smoothstep(0.55, 0.9, pN.y) * smoothstep(0.42, 0.7, aNoise3(vWorld * 1.6 + vSeed.z * 5.0));
    pAlb = mix(pAlb, mix(uG4, uG2, aNoise3(vWorld * 3.0)) * 0.8, pMoss * 0.7);
    pAlb = mix(pAlb * (1.0 - 0.28 * damp), mix(uG4, uG2, 0.4) * 0.7, damp * smoothstep(0.35, 0.7, aNoise3(vWorld * 2.3 + 9.0)) * 0.6);
  } else if (look < 1.5) {
    // timber: its grain runs along it, dark in the furrow and pale beside it; darker at its edges
    float g = sin(across * 75.0 + sin(along * 5.0 + vSeed.x * 20.0) * 1.6 + vSeed.z * 30.0), furrow = smoothstep(0.7, 0.95, g);
    pAlb = mix(pAlb, vTint * 0.5, furrow * 0.7) + vTint * 0.2 * smoothstep(0.3, 0.7, g) * (1.0 - furrow);
    pAlb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.025, pEdge));
    grey = 0.0;
  } else if (look < 2.5) {
    // plaster: limewash, laid on in broad strokes, a little stained toward the foot of each panel
    pAlb *= 0.92 + 0.1 * smoothstep(0.3, 0.7, aNoise(uv * 1.7 + vSeed.xy * 30.0));
    pAlb *= 0.9 + 0.1 * smoothstep(-0.9, 0.6, vLocal.z / max(vHalf.z, 0.01));
    pAlb *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.03, pEdge));
    pAlb = mix(pAlb, pAlb * vec3(0.78, 0.8, 0.7), damp * 0.7);
    grey = 0.3;
  } else if (look < 3.5 || look > 7.5 && look < 8.5) {
    // tiles: in rows down the slope, each row half a tile along from the last; every tile its own red, its foot rounded and in the shadow of the row above
    vec2 t = look > 7.5 ? vLocal.yx : vLocal.xy; float hs = look > 7.5 ? vHalf.x : vHalf.y;
    if (nl.z > 0.5 && hs > 0.3) {
      float row = (t.y * vLook.y + hs) / 0.3404, id = floor(row), fr = fract(row), col = t.x / 0.27 + 0.5 * mod(id, 2.0) + vSeed.x, fc = fract(col);
      pAlb = vTint * (0.78 + 0.42 * pHash(vec2(id + vSeed.y * 40.0, floor(col))));
      pAlb *= 1.0 - 0.5 * smoothstep(0.76, 0.9, fr + 0.17 * pow(abs(fc - 0.5) * 2.0, 2.0));
      pAlb *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.06, min(fc, 1.0 - fc))) * (1.0 - smoothstep(0.7, 0.9, fr));
      pAlb *= 1.0 + 0.16 * smoothstep(0.3, 0.0, fr);
      pAlb = mix(pAlb, mix(uG4, uG2, 0.5) * 0.7, smoothstep(0.62, 0.8, aNoise(vWorld.xz * 1.3 + vWorld.y)) * 0.35);
    } else pAlb *= 0.8;
    grey = 0.0;
  } else if (look < 4.5) {
    // boards: planks side by side along its length, a dark line between them
    float pl = across / 0.2 + vSeed.x * 3.0, fp = fract(pl);
    pAlb *= 0.84 + 0.3 * pHash(vec2(floor(pl), vSeed.z * 50.0));
    pAlb *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.07, min(fp, 1.0 - fp)));
    pAlb *= 0.94 + 0.08 * sin(across * 140.0 + sin(along * 4.0) * 2.0);
    pAlb *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.02, pEdge));
    grey = 0.0;
  } else if (look < 5.5) {
    // brick, in bond, with its mortar
    float row = uv.y / 0.1 + 50.0, bx = uv.x / 0.27 + 0.5 * mod(floor(row), 2.0) + 20.0, fy = fract(row), fx2 = fract(bx);
    float mortar = 1.0 - smoothstep(0.06, 0.14, min(fy, 1.0 - fy)) * smoothstep(0.02, 0.06, min(fx2, 1.0 - fx2));
    pAlb = mix(vTint * (0.74 + 0.5 * pHash(vec2(floor(row), floor(bx)))), vec3(0.74, 0.7, 0.62), mortar * 0.85) * (1.0 - 0.25 * damp);
  } else if (look < 6.5) {
    // a terrace: flagstones on top, each its own grey and none square with the next; coursed stone down its sides
    vec2 c = nl.z > 0.5 ? uv / 0.95 : uv / vec2(0.9, 0.42); float row = floor(c.y); c.x += 0.5 * mod(row, 2.0) + 0.37 * pHash(vec2(row, 3.0));
    vec2 f = fract(c); float joint = min(min(f.x, 1.0 - f.x) * (nl.z > 0.5 ? 0.95 : 0.9), min(f.y, 1.0 - f.y) * (nl.z > 0.5 ? 0.95 : 0.42));
    pAlb = vTint * (0.8 + 0.34 * pHash(floor(c) + 7.0)) * (0.94 + 0.1 * smoothstep(0.3, 0.7, aNoise(vWorld.xz * 2.1)));
    pAlb *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.045, joint));
    pAlb = mix(pAlb, mix(uG4, uG2, 0.6) * 0.75, (1.0 - smoothstep(0.0, 0.03, joint)) * smoothstep(0.45, 0.6, aNoise(vWorld.xz * 0.9 + 5.0)) * 0.8 * step(0.5, nl.z));
  } else if (look < 7.5) {
    // hay: straw laid all one way, and the cord round the bale
    pAlb *= 0.8 + 0.4 * aNoise(vec2(across * 55.0, along * 2.5 + vSeed.x * 9.0));
    pAlb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.02, abs(abs(along) - vHalf.y * 0.5)));
    grey = 0.0;
  } else {
    // cloth: plain, in soft folds
    pAlb *= 0.9 + 0.12 * sin(uv.x * 7.0 + vSeed.x * 6.0 + sin(uv.y * 3.0) * 1.2);
    grey = 0.0;
  }
  float pL = smoothstep(-0.05, 0.5, dot(pN, uSun)) * outgoingLight.g;
  // (in shade stone is grey with a little of the sky in it; wood and tile keep more of the sky's blue; all take some warmth up from the grass)
  vec3 pSky = mix(uSkyCol, vec3(dot(uSkyCol, vec3(0.3333))), 0.6 * grey);
  vec3 pC = pAlb * (uSunCol * pL + pSky * (0.7 + 0.5 * (pN.y * 0.5 + 0.5)) + vec3(0.07, 0.09, 0.03) * (1.0 - pN.y) * 0.8);
  pC += pAlb * lamps(vWorld) * (0.4 + 0.6 * max(dot(pN, normalize(uLamp[0].xyz - vWorld)), 0.0));
  pC += vec3(1.9, 1.05, 0.42) * glow;
  gl_FragColor = vec4(air(pC, vWorld), 1.0);`,
  });
  const dress = (mesh, list) => {
    const look = new Float32Array(list.length), tint = new Float32Array(list.length * 3), c = new THREE.Color();
    list.forEach((i, k) => { const [l, hex] = lookOf(s.pieces[i]); look[k] = l; c.set(hex); const v = 0.92 + 0.16 * (s.pieces[i].shade || 0.5); tint.set([c.r * v, c.g * v, c.b * v], k * 3); });
    mesh.geometry.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 1)); mesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  };
  const mesh = dress(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, ids.length), ids);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const base = new THREE.Matrix4().makeRotationX(-Math.PI / 2), m = new THREE.Matrix4();
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), inv = new THREE.Quaternion(), loc = new THREE.Vector3(), dl = new THREE.Vector3();
  // the terraces they stand on do not move: set once
  const ground = dress(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, terraces.length), terraces);
  terraces.forEach((i, k) => { const pc = s.pieces[i]; ground.setMatrixAt(k, m.compose(P.set(...pc.pos), Q.set(0, 0, 0, 1), S.set(...pc.size)).premultiply(base)); });
  // (each piece's pose as last read, kept for aiming and for what a spell reaches)
  const pos = new Float32Array(ids.length * 3), rot = new Float32Array(ids.length * 4);
  // (pieces a spell has taken: carried by hand, out of the physics, until it lets them go)
  const cap = new Array(ids.length).fill(null);

  // ================================================================================================================ the trees
  // A tree is not a thing of the physics. Its trunk stands in it, held fast, to be struck; but the tree is moved by rule, all of a piece: it falls about its foot and
  // lies on its trunk, its crown pressed against the ground and half its leaves shaken off; it is taken up whole and stripped bare as it is whirled; and when it is
  // destroyed its boughs go in leaves and splinters and its trunk is let go as logs, which the physics does well. The meadow draws it: it is told here where each part is.
  const kOf = new Map(); ids.forEach((i, k) => kOf.set(i, k));
  const partOfK = new Int32Array(ids.length), logK = new Uint8Array(ids.length), groves = [], PT = air.parts, PW = PT.W, Ph = (v) => [v[0], -v[2], v[1]];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const spinOf = (ax, ang) => { const sh = Math.sin(ang / 2); return [ax[0] * sh, ax[1] * sh, ax[2] * sh, Math.cos(ang / 2)]; };
  for (const t of meadow.trees) {
    if (!t || !t.kind || !t.parts?.length) continue;
    const trunks = t.parts.map((id) => meadow.parts[id]).filter((p) => p.kind === 'trunk'), foot = Ph(trunks[0].a), tip = Ph(trunks[trunks.length - 1].b);
    const g = { tree: t, n: groves.length, state: 'stand', pivot: foot, O: [...foot], Q: [0, 0, 0, 1], strip: 0, stripTo: 0, flag: 0, shown: false, H: t.h, L: Math.hypot(tip[0] - foot[0], tip[1] - foot[1], tip[2] - foot[2]), rest: t.clumps.map((c) => [...c]), x0: t.x, z0: t.z, y0: t.y, move: null,
      parts: t.parts.map((id) => { const p = meadow.parts[id], k = p.piece !== undefined ? kOf.get(p.piece) : undefined, pc = k !== undefined ? s.pieces[ids[k]] : null; return { id, k: k ?? -1, rest: pc ? [...pc.pos] : Ph(p.c), rot0: pc ? [...pc.rot] : [0, 0, 0, 1], log: false }; }) };
    groves.push(g);
    for (const p of g.parts) { PT.data.set([p.rest[0], p.rest[2], -p.rest[1], 0], p.id * 4); if (p.k >= 0) partOfK[p.k] = p.id; }
  }
  for (let k = 0; k < ids.length; k++) if (partOfK[k]) mesh.setMatrixAt(k, m.makeScale(0, 0, 0));
  let stirred = true;
  /** Where a point of a tree (given as it was grown) now is. */
  const poseOf = (g, rest) => add3(g.O, rotate(g.Q, sub3(rest, g.pivot)));
  const put = (p, at, q, flag) => { PT.data.set([at[0], at[2], -at[1], flag], (PW + p.id) * 4); const dq = qmul(q, conj(p.rot0)); PT.data.set([dq[0], dq[2], -dq[1], dq[3]], (2 * PW + p.id) * 4); };
  /** The meadow is told where each part of a tree is, and how much of its leaves are gone. */
  const show = (g) => {
    if (g.state === 'stand' && !g.shown && g.strip === g.told) return;
    for (const p of g.parts) {
      if (g.state === 'stand') PT.data[(PW + p.id) * 4 + 3] = 0;
      else if (p.log) put(p, [pos[p.k * 3], pos[p.k * 3 + 1], pos[p.k * 3 + 2]], [rot[p.k * 4], rot[p.k * 4 + 1], rot[p.k * 4 + 2], rot[p.k * 4 + 3]], 1);
      else if (g.state === 'logs') PT.data.set([0, -999, 0, 1], (PW + p.id) * 4);
      else put(p, poseOf(g, p.rest), qmul(g.Q, p.rot0), g.flag);
      PT.data[p.id * 4 + 3] = g.strip;
    }
    g.shown = g.state !== 'stand'; g.told = g.strip; stirred = true;
  };
  /** Its boughs, for whatever asks where they are (fire, aim, shade): where each now is. */
  const follow = (g) => {
    const t = g.tree; let sx = 0, sz = 0, sy = 0;
    t.clumps.forEach((c, i) => { const r = g.rest[i], v = poseOf(g, [r[0], -r[2], r[1]]); c[0] = v[0]; c[1] = v[2]; c[2] = -v[1]; sx += c[0]; sy += c[1]; sz += c[2]; });
    const n = Math.max(1, t.clumps.length);
    t.x = sx / n; t.z = sz / n; t.y = sy / n - t.h * 0.6;
  };
  const leafOf = (t) => (t.kind === 'pine' ? [0.1, 0.32 + 0.1 * Math.random(), 0.2] : [0.3 + 0.3 * Math.random(), 0.62, 0.12]);
  /** Leaves come off it: so many, from its boughs, going so (vx, vy, vz in the meadow's measures) and scattering. */
  const shed = (g, n, vx = 0, vy = 0, vz = 0, scatter = 2) => {
    const t = g.tree;
    if (!fx || !t.clumps.length || t.burnt > 0.8) return;
    for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) { const c = t.clumps[Math.floor(Math.random() * t.clumps.length)]; fx.spawn({ kind: 4, x: c[0] + fx.rnd(c[3]), y: c[1] + fx.rnd(c[3] * 0.6), z: c[2] + fx.rnd(c[3]), vx: vx + fx.rnd(scatter), vy: vy + fx.rnd(scatter * 0.6), vz: vz + fx.rnd(scatter), life: 2.2 + 1.6 * Math.random(), size: [0.13, 0.13], colour: leafOf(t), grav: -2.6, drag: 0.8, rot: Math.random() * 6.283, spin: fx.rnd(8) }); }
  };
  /** Its trunk in the physics is set aside (while the tree is moving), or put where the tree lies. */
  const park = (g) => { for (const p of g.parts) if (p.k >= 0 && !p.log) s.bodies[ids[p.k]]?.set({ position: [p.rest[0] + 700 + 90 * g.n, p.rest[1] + 700, p.rest[2] - 400] }); };
  const lay = (g) => { for (const p of g.parts) if (p.k >= 0 && !p.log) s.bodies[ids[p.k]]?.set({ position: poseOf(g, p.rest), rotation: qmul(g.Q, p.rot0) }); };
  /** It leaves the ground for the first time: the earth is torn where it stood. */
  const uproot = (g) => {
    const t = g.tree;
    if (t.down) return;
    t.down = true;
    meadow.bare(g.x0, g.z0, 1.5);
    if (!fx) return;
    for (let q = 0; q < 22; q++) { const a = Math.random() * 6.283, sp = 1 + 3 * Math.random(); fx.spawn({ kind: 2, x: g.x0 + Math.cos(a) * 0.7, y: g.y0 + 0.5, z: g.z0 + Math.sin(a) * 0.7, vx: Math.cos(a) * sp, vy: 1 + 2 * Math.random(), vz: Math.sin(a) * sp, life: 1.3 + Math.random(), size: [0.5, 2.2], colour: [0.42, 0.33, 0.25], alpha: 0.4, drag: 1 }); }
    for (let q = 0; q < 26; q++) { const a = Math.random() * 6.283, sp = 1.5 + 5 * Math.random(); fx.spawn({ kind: 4, x: g.x0, y: g.y0 + 0.4, z: g.z0, vx: Math.cos(a) * sp, vy: 2.5 + 5 * Math.random(), vz: Math.sin(a) * sp, life: 1.1 + Math.random(), size: [0.08, 0.12], colour: [0.3, 0.22, 0.15], grav: -9, drag: 0.5, rot: Math.random() * 6.283, spin: fx.rnd(10) }); }
  };
  /** A tree that stands begins to fall, away along (dx, dy). */
  const fall = (g, dx, dy) => {
    if (g.state !== 'stand') return;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    // (how far over it goes: until its top is on the ground there, whatever the slope)
    const lift = 0.45, top = meadow.ground(g.pivot[0] + dx * g.L, -(g.pivot[1] + dy * g.L)) + 0.3;
    g.state = 'fall'; g.flag = 2;
    g.move = { ax: [-dy, dx, 0], dx, dy, t: 0, dur: 1.25 + g.H * 0.055, max: Math.acos(Math.max(-0.45, Math.min(0.45, (top - g.pivot[2] - lift) / g.L))), lift, hit: false };
    park(g); uproot(g);
  };
  /** A tree is taken up, to be carried whole (from wherever it is: standing, falling or lying). */
  const seize = (g, kind) => {
    if (g.state === 'stand') uproot(g);
    park(g);
    const c0 = poseOf(g, add3(g.pivot, [0, 0, g.H * 0.5])), ax = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], l = Math.hypot(...ax) || 1;
    g.state = 'held'; g.flag = 1;
    return (g.move = { kind, t: 0, c0, O0: [...g.O], Q0: [...g.Q], c: [...c0], v: [0, 0, 0], ax: ax.map((v) => v / l), spin: 0.35 + 0.6 * Math.random() });
  };
  /** A tree in hand is moved: its middle to C, turned by so much about its own axis since it was taken. */
  const carry = (g, C, dt) => {
    const o = g.move, Qs = spinOf(o.ax, o.spin * o.t);
    for (let a = 0; a < 3; a++) { if (dt > 0 && o.t > dt * 1.5) o.v[a] = (C[a] - o.c[a]) / dt; o.c[a] = C[a]; }
    g.Q = qmul(Qs, o.Q0); g.O = add3(C, rotate(Qs, sub3(o.O0, o.c0)));
  };
  /** A tree is destroyed: its boughs go in leaves and splinters, and each stretch of its trunk is a log, let go to the physics going as velOf(where it is) says. */
  const toLogs = (g, velOf) => {
    if (g.state === 'logs') return;
    if (g.state === 'stand') uproot(g);
    follow(g);
    if (fx) {
      shed(g, 190 * (1 - g.strip), 0, 2, 0, 6);
      for (const c of g.tree.clumps) splinters(c[0], c[1], c[2], 7);
    }
    for (const p of g.parts) {
      if (p.k < 0) continue;
      const body = s.bodies[ids[p.k]], at = poseOf(g, p.rest), q = qmul(g.Q, p.rot0);
      p.log = true; logK[p.k] = 1; s.pieces[ids[p.k]].fixed = false;
      pos.set(at, p.k * 3); rot.set(q, p.k * 4);
      if (!body) continue;
      body.setFixed(false);
      body.set({ position: at, rotation: q, velocity: velOf(at), angularVelocity: [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4] });
    }
    g.state = 'logs'; g.move = null; g.strip = g.stripTo = 1;
    g.tree.clumps.length = 0; g.tree.gone = true; g.tree.burning = 0;
  };
  /** The trees go on with whatever they are doing. */
  const grow = (dt) => {
    for (const g of groves) {
      const o = g.move;
      if (g.state === 'fall') {
        o.t += dt;
        const u = o.t / o.dur, after = o.t - o.dur, ang = u < 1 ? o.max * u ** 2.4 : o.max - 0.05 * Math.exp(-5 * after) * Math.abs(Math.sin(10 * after));
        g.Q = spinOf(o.ax, ang); g.O = add3(g.pivot, [0, 0, o.lift * Math.min(1, u * 1.5)]);
        // (as it goes over the air takes leaves off it; when it strikes, a great many, and dust along its whole length)
        if (u < 1) shed(g, 26 * dt * u, -o.dx * 2, 1, o.dy * 2, 1.5);
        else if (!o.hit) {
          o.hit = true; g.stripTo = Math.max(g.stripTo, 0.38 + 0.12 * Math.random());
          follow(g); shed(g, 150, o.dx * 3, 3.5, -o.dy * 3, 4.5);
          if (fx) for (let q = 0; q < 34; q++) { const f = Math.random(), at = poseOf(g, add3(g.pivot, [0, 0, g.H * f])), a = Math.random() * 6.283; fx.spawn({ kind: 2, x: at[0], y: meadow.ground(at[0], -at[1]) + 0.4, z: -at[1], vx: Math.cos(a) * 3, vy: 0.8 + 1.4 * Math.random(), vz: Math.sin(a) * 3, life: 1.5 + Math.random(), size: [0.7, 3.4], colour: [0.78, 0.72, 0.6], alpha: 0.3, drag: 1.2 }); }
        }
        if (after > 1.3) { g.state = 'lying'; g.move = null; lay(g); }
      }
      if (g.strip < g.stripTo) { const was = g.strip; g.strip = Math.min(g.stripTo, g.strip + dt * (g.state === 'held' ? 1 : 2.5) * Math.max(0.12, g.stripTo - g.strip)); if (g.state === 'held') shed(g, (g.strip - was) * 260, 0, 0, 0, 2); }
      if (g.state !== 'stand' && g.state !== 'logs') follow(g);
      show(g);
    }
    if (stirred) { PT.tex.needsUpdate = true; stirred = false; }
  };
  const middle = (g) => poseOf(g, add3(g.pivot, [0, 0, g.H * 0.45]));

  function draw() {
    for (let k = 0; k < ids.length; k++) {
      const piece = s.pieces[ids[k]], body = s.bodies[ids[k]];
      const own = cap[k], p = own ? own.p : body ? body.position : piece.pos, q = own ? own.q : body ? body.rotation : piece.rot;
      pos.set(p, k * 3); rot.set(q, k * 4);
      if (partOfK[k]) continue;
      m.compose(P.set(p[0], p[1], p[2]), Q.set(q[0], q[1], q[2], q[3]), S.set(piece.size[0], piece.size[1], piece.size[2])).premultiply(base);
      mesh.setMatrixAt(k, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  draw();

  /** A point (or a direction) of the physics' own, into a block's own frame. */
  const local = (k, v, out) => out.copy(v).applyQuaternion(inv.set(-rot[k * 4], -rot[k * 4 + 1], -rot[k * 4 + 2], rot[k * 4 + 3]));
  const api = {
    mesh, world, structure: s, count: ids.length,
    get broken() { return s.broken; },
    /** How many blocks have moved more than half a metre from where they were built. */
    get fallen() { let f = 0; for (let k = 0; k < ids.length; k++) { const a = s.pieces[ids[k]].pos; if (Math.hypot(pos[k * 3] - a[0], pos[k * 3 + 1] - a[1], pos[k * 3 + 2] - a[2]) > 0.5) f++; } return f; },
    update(dt) { if (dt > 0) world.update(dt); draw(); grow(dt); },
    /** How many trees no longer stand. */
    get treesDown() { return groves.filter((g) => g.state !== 'stand').length; },
    /** Whoever walks is kept out of what still stands where it was built (f: their feet, moved if need be). What has fallen, or is only set down, they walk through. */
    block(f) {
      const r = 0.3;
      for (let k = 0; k < ids.length; k++) {
        const pc = s.pieces[ids[k]];
        if (pc.manual || partOfK[k]) continue;
        const hx = pc.size[0] / 2 + r, hy = pc.size[1] / 2 + r, dx = f.x - pos[k * 3], dy = -f.z - pos[k * 3 + 1];
        if (Math.abs(dx) >= hx || Math.abs(dy) >= hy) continue;
        if (Math.abs(pos[k * 3] - pc.pos[0]) + Math.abs(pos[k * 3 + 1] - pc.pos[1]) + Math.abs(pos[k * 3 + 2] - pc.pos[2]) > 0.15) continue;
        const top = pos[k * 3 + 2] + pc.size[2] / 2;
        if (top < f.y + 0.45 || top - pc.size[2] > f.y + 1.7) continue;
        const px = hx - Math.abs(dx), py = hy - Math.abs(dy);
        if (px < py) f.x += Math.sign(dx || 1) * px; else f.z -= Math.sign(dy || 1) * py;
      }
    },
    /** How far along a line from o (the meadow's own measures) the first block is, within `max`; or null. */
    ray(o, d, max) {
      const po = toPhys(o), best = { t: max, any: false };
      for (let k = 0; k < ids.length; k++) {
        const h = s.pieces[ids[k]].size;
        P.set(po[0] - pos[k * 3], po[1] - pos[k * 3 + 1], po[2] - pos[k * 3 + 2]);
        // (a quick look first: is the line anywhere near it)
        const along = -(P.x * d.x + P.y * -d.z + P.z * d.y);
        if (along < -1 || along > best.t + 1) continue;
        local(k, P, loc); local(k, P.set(d.x, -d.z, d.y), dl);
        let t0 = 0, t1 = best.t, hit = true;
        for (let a = 0; a < 3 && hit; a++) {
          const lo = loc.getComponent(a), dd = dl.getComponent(a), half = h[a] / 2;
          if (Math.abs(dd) < 1e-6) { if (Math.abs(lo) > half) hit = false; continue; }
          let ta = (-half - lo) / dd, tb = (half - lo) / dd;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) hit = false;
        }
        if (hit) { best.t = t0; best.any = true; }
      }
      return best.any ? best.t : null;
    },
    /** Whether a ball of radius r at p touches any block. */
    touches(p, r) {
      const pp = toPhys(p);
      for (let k = 0; k < ids.length; k++) {
        const h = s.pieces[ids[k]].size;
        local(k, P.set(pp[0] - pos[k * 3], pp[1] - pos[k * 3 + 1], pp[2] - pos[k * 3 + 2]), loc);
        const dx = Math.max(Math.abs(loc.x) - h[0] / 2, 0), dy = Math.max(Math.abs(loc.y) - h[1] / 2, 0), dz = Math.max(Math.abs(loc.z) - h[2] / 2, 0);
        if (dx * dx + dy * dy + dz * dz < r * r) return true;
      }
      return false;
    },
    /** Something bursts at p: the blocks nearest are torn from their welds, and all within `radius` are thrown from it.
     * (Thrown hard: a block low in a wall is pinned by the weight on it, and at under 10 m/s it stops within a hand's breadth.) */
    blast(p, radius, power) {
      const c = toPhys(p);
      let reached = 0;
      // (trees: those near are destroyed, their trunks thrown as logs; those further off are thrown down, away from it)
      for (const g of groves) {
        if (g.state === 'logs' || g.state === 'held') continue;
        const cg = middle(g), dx = cg[0] - c[0], dy = cg[1] - c[1], d = Math.hypot(dx, dy, (cg[2] - c[2]) * 0.5), f = 1 - d / (radius * 1.3);
        if (f > 0.5) toLogs(g, (at) => { const ex = at[0] - c[0], ey = at[1] - c[1], l = Math.hypot(ex, ey) || 1, sp = (7 + 12 * f) * (0.6 + 0.8 * Math.random()); return [(ex / l) * sp, (ey / l) * sp, 3 + 7 * Math.random()]; });
        else if (f > 0.06) fall(g, dx, dy);
      }
      for (let k = 0; k < ids.length; k++) {
        const body = s.bodies[ids[k]];
        if (!body || (partOfK[k] && !logK[k])) continue;
        const dx = pos[k * 3] - c[0], dy = pos[k * 3 + 1] - c[1], dz = pos[k * 3 + 2] - c[2] + 0.3, d = Math.hypot(dx, dy, dz);
        if (d > radius) continue;
        const f = 1 - d / radius, mass = s.mass[ids[k]], v = (power * 12 * Math.pow(f, 1.5)) / Math.max(d, 0.3);
        if (f > 0.42) s.release(ids[k]);
        body.applyImpulse([dx * v * mass, dy * v * mass, dz * v * mass]);
        body.applyAngularImpulse([(Math.random() - 0.5) * mass * f, (Math.random() - 0.5) * mass * f, (Math.random() - 0.5) * mass * f]);
        reached++;
      }
      return reached;
    },
    /** Something draws them to it. Those within `reach` of c are taken, the nearest first: torn from their welds, lifted
     * out of the physics, and carried round it by hand, in the plane whose normal is n, between 1.5 and 4 of its radii
     * out, faster the nearer in. `shut` (0 to 1): it is closing, and they are drawn in and whipped round.
     * (Steering them with a push every step ran away: the solver takes a steady push for a gravity and adds to it.) */
    orbit(c, n, reach, radius, shut, dt) {
      const pc = toPhys(c), N = [n.x, -n.z, n.y];
      // two ways across the plane
      let A = Math.abs(N[2]) < 0.9 ? [-N[1], N[0], 0] : [1, 0, 0]; const al = Math.hypot(...A); A = A.map((v) => v / al);
      const B = [N[1] * A[2] - N[2] * A[1], N[2] * A[0] - N[0] * A[2], N[0] * A[1] - N[1] * A[0]];
      // a tree is pulled out of the ground whole, goes round whole, and is stripped bare as it goes
      for (const g of groves) {
        let o = g.move;
        if (g.state !== 'held') {
          if (g.state === 'logs' || (g.state === 'fall' && !o.hit)) continue;
          const cg = middle(g), d = Math.hypot(cg[0] - pc[0], cg[1] - pc[1], cg[2] - pc[2]);
          if (d > reach || Math.random() > (shut > 0 ? 1 : dt * 1.6 * (1 - d / reach) ** 2)) continue;
          o = Object.assign(seize(g, 'orbit'), { rho: 2.2 + 1.6 * Math.random(), ang: Math.random() * 6.283, h: (Math.random() - 0.5) * 0.4, T: 2.4 + Math.random() });
        }
        if (o.kind !== 'orbit') continue;
        o.t += dt; o.ang += (dt * 3.2 * (1 + 7 * shut)) / o.rho ** 1.5;
        const r = radius * o.rho * (1 - 0.7 * shut), co = Math.cos(o.ang), si = Math.sin(o.ang), e = Math.min(1, o.t / o.T), ease = e * e * (3 - 2 * e);
        carry(g, [0, 1, 2].map((a) => o.c0[a] + (pc[a] + (A[a] * co + B[a] * si) * r + N[a] * o.h * radius - o.c0[a]) * ease), dt);
        g.stripTo = Math.min(1, g.stripTo + dt * 0.32);
      }
      for (let k = 0; k < ids.length; k++) {
        const body = s.bodies[ids[k]];
        if (!body || (partOfK[k] && !logK[k])) continue;
        let own = cap[k];
        if (!own) {
          const d = Math.hypot(pos[k * 3] - pc[0], pos[k * 3 + 1] - pc[1], pos[k * 3 + 2] - pc[2]);
          if (d > reach || Math.random() > (shut > 0 ? 1 : dt * 3.2 * (1 - d / reach) ** 2)) continue;
          s.release(ids[k]);
          const ax = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], l = Math.hypot(...ax) || 1;
          own = cap[k] = { t: 0, from: [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], q0: [rot[k * 4], rot[k * 4 + 1], rot[k * 4 + 2], rot[k * 4 + 3]], p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0],
            rho: 1.5 + 2.5 * Math.random() ** 1.4, ang: Math.random() * 6.283, h: (Math.random() - 0.5) * 0.5, ax: ax.map((v) => v / l), spin: 1 + 3 * Math.random(), T: 1.3 + 0.9 * Math.random() };
          // (parked where it meets nothing)
          body.setFixed(true); body.set({ position: [400 + k * 3, 400, -200], velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
        }
        own.t += dt; own.ang += (dt * 3.2 * (1 + 7 * shut)) / own.rho ** 1.5;
        const r = radius * own.rho * (1 - 0.7 * shut), co = Math.cos(own.ang), si = Math.sin(own.ang), e = Math.min(1, own.t / own.T), ease = e * e * (3 - 2 * e);
        for (let a = 0; a < 3; a++) {
          const there = pc[a] + (A[a] * co + B[a] * si) * r + N[a] * own.h * radius, was = own.p[a];
          own.p[a] = own.from[a] + (there - own.from[a]) * ease;
          if (dt > 0 && own.t > dt * 1.5) own.v[a] = (own.p[a] - was) / dt;
        }
        const half = own.spin * own.t * 0.5, sh = Math.sin(half);
        own.q = qmul([own.ax[0] * sh, own.ax[1] * sh, own.ax[2] * sh, Math.cos(half)], own.q0);
      }
    },
    /** A whirlwind (tw: where its foot is, how tall, how wide below and above, how it leans, how far it reaches). What
     * stands near its foot is taken, the nearest first, carried up and round it by hand, and thrown out when it has
     * climbed some way; what it throws lands, and may be taken again. `tw.on` false: all it carries is let go. */
    twist(tw, dt) {
      const bx = tw.x - ox, by = -(tw.z - oz), bz = tw.y - oy;
      // a tree is torn up whole, carried up and round and stripped, and at the last thrown: and what is thrown is logs
      for (const g of groves) {
        let o = g.move;
        if (g.state !== 'held') {
          if (!tw.on || g.state === 'logs' || (g.state === 'fall' && !o.hit)) continue;
          const d = Math.hypot(g.O[0] - bx, g.O[1] - by), far = tw.reach + 1.5;
          if (d > far || Math.random() > dt * 1.5 * (1 - d / far)) continue;
          o = seize(g, 'twist');
          Object.assign(o, { hh: Math.max(1, o.c0[2] - bz), rise: 2.2 + 2 * Math.random(), top: tw.H * (0.42 + 0.3 * Math.random()), rho: 1.0 + 0.4 * Math.random(), ang: Math.atan2(o.c0[1] - by, o.c0[0] - bx), T: 1.4 });
        }
        if (o.kind !== 'twist') continue;
        let out = [0, 0];
        if (tw.on) {
          o.t += dt; o.hh += o.rise * dt;
          const h = Math.min(1, o.hh / tw.H), bend = h ** 1.6, sw = 1.4 * h * (1 - 0.3 * h), R = (tw.r0 + (tw.r1 - tw.r0) * h ** 1.8) * o.rho + 1.5;
          o.ang -= (dt * 9) / (1 + R * 0.5);
          out = [Math.cos(o.ang), Math.sin(o.ang)];
          const there = [bx + tw.lx * bend + Math.sin(h * 5 + tw.now * 0.9) * sw + out[0] * R, by - (tw.lz * bend + Math.cos(h * 4.2 + tw.now * 0.7) * sw) + out[1] * R, bz + o.hh], e = Math.min(1, o.t / o.T), ease = e * e * (3 - 2 * e);
          carry(g, [0, 1, 2].map((a) => o.c0[a] + (there[a] - o.c0[a]) * ease), dt);
          g.stripTo = Math.min(1, g.stripTo + dt * 0.28);
        }
        if (!tw.on || o.hh > o.top) { const v = [...o.v]; toLogs(g, () => [v[0] * 0.6 + out[0] * 6 + (Math.random() - 0.5) * 4, v[1] * 0.6 + out[1] * 6 + (Math.random() - 0.5) * 4, Math.min(v[2], 3) + 2 * Math.random()]); }
      }
      for (let k = 0; k < ids.length; k++) {
        const body = s.bodies[ids[k]];
        if (!body || (partOfK[k] && !logK[k])) continue;
        let own = cap[k];
        if (!own) {
          if (!tw.on) continue;
          const d = Math.hypot(pos[k * 3] - bx, pos[k * 3 + 1] - by), up = pos[k * 3 + 2] - bz;
          if (d > tw.reach || up > 9 || Math.random() > dt * 4 * (1 - d / tw.reach) ** 1.5) continue;
          s.release(ids[k]);
          const ax = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], l = Math.hypot(...ax) || 1;
          own = cap[k] = { tw: true, t: 0, from: [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], q0: [rot[k * 4], rot[k * 4 + 1], rot[k * 4 + 2], rot[k * 4 + 3]], p: [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], q: [0, 0, 0, 1], v: [0, 0, 0],
            hh: Math.max(0.4, up), rise: 2.5 + 3.5 * Math.random(), top: tw.H * (0.3 + 0.5 * Math.random()), rho: 0.9 + 0.6 * Math.random(), ang: Math.atan2(pos[k * 3 + 1] - by, pos[k * 3] - bx), ax: ax.map((v) => v / l), spin: 2 + 4 * Math.random(), T: 0.8 };
          body.setFixed(true); body.set({ position: [400 + k * 3, 400, -200], velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
        }
        if (!own.tw) continue;
        let out = [0, 0];
        if (tw.on) {
          own.t += dt; own.hh += own.rise * dt;
          const h = Math.min(1, own.hh / tw.H), bend = h ** 1.6, sw = 1.4 * h * (1 - 0.3 * h), R = (tw.r0 + (tw.r1 - tw.r0) * h ** 1.8) * own.rho + 0.6;
          // (the other way round from the meadow's own measures: these have its z turned about)
          own.ang -= (dt * 13) / (1 + R * 0.5);
          const cx = bx + tw.lx * bend + Math.sin(h * 5 + tw.now * 0.9) * sw, cy = by - (tw.lz * bend + Math.cos(h * 4.2 + tw.now * 0.7) * sw);
          out = [Math.cos(own.ang), Math.sin(own.ang)];
          const there = [cx + out[0] * R, cy + out[1] * R, bz + own.hh], e = Math.min(1, own.t / own.T), ease = e * e * (3 - 2 * e);
          for (let a = 0; a < 3; a++) { const was = own.p[a]; own.p[a] = own.from[a] + (there[a] - own.from[a]) * ease; if (dt > 0) own.v[a] = (own.p[a] - was) / dt; }
          const half = own.spin * own.t * 0.5, sh = Math.sin(half);
          own.q = qmul([own.ax[0] * sh, own.ax[1] * sh, own.ax[2] * sh, Math.cos(half)], own.q0);
        }
        if (!tw.on || own.hh > own.top) {
          // thrown: given back to the physics going as it was going, and outward
          body.setFixed(false);
          body.set({ position: [...own.p], rotation: [...own.q], velocity: [own.v[0] + out[0] * 5, own.v[1] + out[1] * 5, Math.min(own.v[2], 4) + 1], angularVelocity: own.ax.map((v) => v * own.spin) });
          cap[k] = null;
        }
      }
    },
    /** For looking into it: how many blocks are held in an orbit. */
    get held() { return cap.filter(Boolean).length; },
    /** What it held is let go, thrown out from c at about `speed`, mostly level; and what lies loose near c is thrown too. */
    fling(c, speed) {
      const pc = toPhys(c);
      // (the trees it held come out of it as logs; those that stood near are thrown down)
      for (const g of groves) {
        if (g.state === 'held' && g.move.kind === 'orbit') toLogs(g, (at) => { let hx = at[0] - pc[0], hy = at[1] - pc[1]; if (Math.hypot(hx, hy) < 0.3) { const a = Math.random() * 6.283; hx = Math.cos(a); hy = Math.sin(a); } const hr = Math.hypot(hx, hy), sp = speed * (0.5 + 0.7 * Math.random()); return [(hx / hr) * sp, (hy / hr) * sp, sp * (0.1 + 0.3 * Math.random())]; });
        else if (g.state === 'stand') { const cg = middle(g), dx = cg[0] - pc[0], dy = cg[1] - pc[1]; if (Math.hypot(dx, dy) < 26) fall(g, dx, dy); }
      }
      for (let k = 0; k < ids.length; k++) {
        const body = s.bodies[ids[k]], own = cap[k];
        if (!body || (partOfK[k] && !logK[k])) continue;
        const from = own ? own.p : [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
        let hx = from[0] - pc[0], hy = from[1] - pc[1];
        const d = Math.hypot(hx, hy, from[2] - pc[2]);
        if (!own && d > 16) continue;
        if (Math.hypot(hx, hy) < 0.3) { const a = Math.random() * 6.283; hx = Math.cos(a); hy = Math.sin(a); }
        const hr = Math.hypot(hx, hy), sp = speed * (0.6 + 0.8 * Math.random());
        if (own) {
          // (given back to the physics as it is, going the way it was going and outward)
          // (let go first, then set moving: letting go stills a body)
          body.setFixed(false);
          body.set({ position: [...own.p], rotation: [...own.q], velocity: [own.v[0] * 0.25 + (hx / hr) * sp, own.v[1] * 0.25 + (hy / hr) * sp, sp * (0.1 + 0.3 * Math.random())], angularVelocity: own.ax.map((v) => v * own.spin) });
          cap[k] = null;
        } else body.applyImpulse([(hx / hr) * sp * s.mass[ids[k]], (hy / hr) * sp * s.mass[ids[k]], sp * 0.3 * s.mass[ids[k]]]);
      }
    },
    /** A gust of so much power (0 to 1) passes (x, z), going along (dx, dz), so wide: with enough in it, what trees stand in its way are thrown down (a pine sooner than a broad tree). */
    gust(x, z, dx, dz, wide, power) {
      for (const g of groves) if (g.state === 'stand' && power >= (g.tree.kind === 'pine' ? 0.5 : 0.8) && Math.hypot(g.x0 - x, g.z0 - z) < wide * 0.7 + 1) fall(g, dx, -dz);
    },
    /** Wind over the ground at (x, z), blowing along (dx, dz): what stands in it within `wide` is pushed so hard (m/s²). */
    push(x, z, dx, dz, wide, accel, dt) {
      for (let k = 0; k < ids.length; k++) {
        const body = s.bodies[ids[k]];
        if (!body) continue;
        const wx = ox + pos[k * 3], wz = oz - pos[k * 3 + 1], d = Math.hypot(wx - x, wz - z);
        if (d > wide || (partOfK[k] && !logK[k])) continue;
        const f = (1 - d / wide) * accel * dt * s.mass[ids[k]];
        body.applyImpulse([dx * f, -dz * f, 0.15 * f]);
      }
    },
  };
  return api;
}
