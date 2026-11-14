// Grass, and the flowers in it.
//
// A blade is a thin strip of a few pieces, wide at its foot and coming to a point. There are some hundreds of
// thousands of them, and they are not planted anywhere: each has a place in a square tile, and the tile is laid
// again and again round the eye, so that wherever one stands the grass is thick underfoot and thins with distance
// into the painted ground, which is the colour the grass was. What a blade is (how tall, what green, whether it is
// burnt stubble or white with frost, which way it is leaning) it works out for itself, each frame, from where it
// has ended up: from the maps of the ground, the wind, and whoever is walking through it.
//
// Flowers are the same idea: a stem and a head that faces the eye, standing where the ground says flowers grow.
import * as THREE from 'three';
import { shadowed } from './air.js';
import { rng } from './noise.js';

const PLACE = /* glsl */ `
  vec2 gCell = seed.xy * uTile.x;
  vec2 gW = gCell + floor((cameraPosition.xz - gCell) / uTile.x + 0.5) * uTile.x;
  float gDist = distance(gW, cameraPosition.xz);
  vec2 gUv = mapUv(gW);
  float gY = texture2D(tHeight, gUv).r;
  vec4 gKind = texture2D(tKind, gUv), gState = stateAt(gW);
  // (it thins out toward the edge of its tile, each blade at its own distance, so there is no line where grass stops)
  float gKeep = 1.0 - smoothstep(uFade.x, uFade.y, gDist + (seed.z - 0.5) * uFade.z);
  gKeep *= smoothstep(uFade.w - 2.0, uFade.w + 2.0, gDist + (seed.w - 0.5) * 3.0);
`;
const LEAN = /* glsl */ `
  float gAng = seed.z * 18.85;
  vec2 gFace = vec2(cos(gAng), sin(gAng)), gOwn = vec2(-gFace.y, gFace.x);
  // the wind comes over the meadow in gusts
  float gGust = aNoise(gW * 0.055 - uWind.xy * uNow * 0.85); gGust *= gGust;
  float gFlutter = sin(uNow * (2.3 + seed.w * 1.7) + seed.z * 40.0 + gW.x * 0.7);
  vec2 gLean = gFace * (0.16 + 0.26 * seed.w) + uWind.xy * uWind.z * (0.22 + 0.95 * gGust) + gOwn * gFlutter * 0.06 * uWind.z;
  // and it bends away from whoever is in it
  for (int i = 0; i < 4; i++) { vec2 dv = gW - uPush[i].xy; float dl = length(dv); gLean += (dv / max(dl, 0.05)) * (1.0 - smoothstep(0.0, uPush[i].z, dl)) * uPush[i].w; }
  // a gust lays it flat along the way it blows; frost holds it stiff
  // (and for a way behind its head the grass is still held down, springing back)
  vec2 gGd = gW - uGust.xy; float gBack = clamp(-dot(gGd, uGustDir), 0.0, uGustTail);
  gGd += uGustDir * gBack;
  float gBlow = uGust.w * (1.0 - smoothstep(uGust.z * 0.25, uGust.z, length(gGd))) * (1.0 - 0.8 * gBack / max(uGustTail, 0.01)) * (0.82 + 0.18 * sin(gBack * 1.4 - uNow * 22.0 + seed.z * 3.0));
  gLean += uGustDir * gBlow;
  // a blast goes out through it as a ring: flat where the ring is, and springing back behind it
  if (uShock.w > 0.0) { vec2 sv = gW - uShock.xy; float sl = length(sv); gLean += (sv / max(sl, 0.05)) * uShock.w * (sl < uShock.z ? smoothstep(uShock.z - 18.0, uShock.z, sl) : exp(-pow((sl - uShock.z) / 2.5, 2.0))); }
  // a whirlwind lays it round itself, and a little inward
  if (uTwist.w > 0.0) { vec2 tv = gW - uTwist.xy; float tl = length(tv); gLean += (vec2(-tv.y, tv.x) * 0.85 - tv * 0.45) / max(tl, 0.05) * uTwist.w * (1.0 - smoothstep(uTwist.z * 0.15, uTwist.z, tl)); }
  gLean *= 1.0 - 0.7 * gState.g;
  float gLL = length(gLean); if (gLL > 1.5) { gLean *= 1.5 / gLL; gLL = 1.5; }
`;

function seeds(count, seed) {
  const R = rng(seed), a = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) a[i] = R();
  return a;
}

/** One layer of grass. tile: the side of the square it is laid in. fade: [from, to, raggedness, inner edge]. size: [half width, height, how much wider with distance]. */
export function createGrass(air, { count, tile, segs, fade, size, seed }) {
  const pos = [], index = [];
  for (let j = 0; j < segs; j++) pos.push(-1, j / segs, 0, 1, j / segs, 0);
  pos.push(0, 1, 0);
  for (let j = 0; j < segs - 1; j++) { const a = j * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  { const a = (segs - 1) * 2; index.push(a, a + 1, a + 2); }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds(count, seed), 4));
  g.instanceCount = count;
  const own = { uTile: { value: new THREE.Vector2(tile, 0) }, uFade: { value: new THREE.Vector4(...fade) }, uSize: { value: new THREE.Vector3(...size) } };
  const m = shadowed(air, {
    side: THREE.DoubleSide, key: 'grass',
    vertexPars: 'attribute vec4 seed; uniform vec2 uTile; uniform vec4 uFade; uniform vec3 uSize; varying float vT; varying vec3 vTip; varying vec3 vRoot; varying vec3 vWorld; varying float vGust; varying vec3 vGlow;',
    vertex: PLACE + LEAN + /* glsl */ `
  float gGrow = smoothstep(0.35, 0.6, gKind.a) * (1.0 - 0.82 * gState.r) * (1.0 + 1.1 * gState.a);
  float gH = uSize.y * (0.5 + 0.8 * seed.w * seed.w + 0.25 * seed.z) * gGrow * gKeep * (0.75 + 0.6 * aNoise(gW * 0.06 + 9.0));
  float gWd = uSize.x * (0.7 + 0.6 * seed.z) * (1.0 + gDist * uSize.z) * step(0.001, gH);
  float gT = position.y;
  // (its width is turned mostly square to the eye: a blade is never seen edge-on)
  vec2 gToEye = normalize(cameraPosition.xz - gW + 1e-4), gSq = vec2(-gToEye.y, gToEye.x);
  vec2 gAcross = normalize(mix(gOwn * sign(dot(gOwn, gSq) + 1e-4), gSq, 0.6));
  vec3 transformed = vec3(gW.x, gY - 0.03, gW.y);
  transformed.xz += gLean * gT * gT * gH + gAcross * position.x * gWd * pow(1.0 - gT, 0.7);
  transformed.y += gH * gT * (1.0 - 0.3 * gLL * gLL * gT);
  vec3 gRoot, gTip; meadow(gW, gRoot, gTip);
  gTip *= 0.8 + 0.4 * seed.w;
  gTip = mix(gTip, uG3 * 1.05, step(0.94, seed.z) * 0.7);
  // (alight, it is black at once, with fire at its tip)
  float gChar = max(gState.r, min(1.0, gState.b * 1.7));
  gTip = mix(gTip, uAsh, gChar); gRoot = mix(gRoot, uAsh * 0.6, gChar);
  // (rimed: white at the tip and blue below, so that light and mist still show against it)
  gTip = mix(gTip, uFrost * 0.94, gState.g * 0.85); gRoot = mix(gRoot, vec3(0.24, 0.42, 0.78), gState.g * 0.8);
  vT = gT; vTip = gTip; vRoot = gRoot; vWorld = transformed; vGust = gGust + gBlow * 3.2;
  vGlow = vec3(gState.b * (0.55 + 0.45 * sin(uNow * 16.0 + seed.z * 40.0)) * step(0.5, fract(seed.z * 7.0 + seed.w * 3.0)), seal(gW), gState.g);`,
    fragmentPars: 'varying float vT; varying vec3 vTip; varying vec3 vRoot; varying vec3 vWorld; varying float vGust; varying vec3 vGlow;',
    fragment: /* glsl */ `
  float gSh = outgoingLight.g;
  vec3 gAlb = mix(vRoot, vTip, smoothstep(0.0, 0.85, vT));
  vec3 gV = normalize(cameraPosition - vWorld);
  // against the sun a blade is lit through
  float gBack = pow(max(dot(-gV, uSun), 0.0), 2.0);
  vec3 gC = lit(gAlb, gSh * (0.5 + 0.5 * vT), 0.3 + 0.7 * vT);
  gC += gAlb * uSunCol * vec3(0.85, 1.0, 0.3) * gBack * gSh * vT * 0.3;
  gC += uSunCol * 0.07 * gSh * vGust * vT * vT;
  gC += gAlb * lamps(vWorld) * (0.35 + 0.65 * vT);
  // alight: it glows from its tip down; and under a seal it is lit in the seal's lines
  gC += vec3(2.0, 0.45, 0.04) * vGlow.x * vT * vT * vT + uSealCol * vGlow.y * (0.3 + vT);
  // rimed, it glitters: here and there a crystal catches the sun, never the same one for long
  if (vGlow.z > 0.03) { vec2 gq = floor(vWorld.xz * 46.0 + vWorld.y * 23.0); float gh = aHash(gq); gC += vec3(1.3, 1.6, 2.0) * vGlow.z * step(0.95, aHash(gq + floor(uNow * 3.0 + gh * 5.0))) * (0.3 + 0.7 * vT) * (0.4 + 0.6 * gSh); }
  gl_FragColor = vec4(air(gC, vWorld), 1.0);`,
  });
  m.onBeforeCompile = ((base) => (s) => { base(s); Object.assign(s.uniforms, own); })(m.onBeforeCompile);
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return mesh;
}

// The shape of a flower's head, by how many petals it has. r: 0 at its middle, 1 at its edge. eye: 1 in its heart.
const HEAD = /* glsl */ `
  float fN = vKind.x, fRad = length(vC), fAng = atan(vC.y, vC.x), fR, fEye = 0.0, fTone = 0.0;
  if (fN < 1.5) {
    // a tuft: several small florets
    fR = 2.0;
    for (int i = 0; i < 6; i++) { float fi = float(i); vec2 h = fract(sin(vec2(fi * 12.9898 + vKind.y * 91.7, fi * 78.233 + vKind.y * 47.3)) * 43758.5453); float r = length(vC - (h - 0.5) * 1.1) / 0.42; if (r < fR) { fR = r; fTone = h.x * 2.0 - 1.0; } }
  } else {
    float turn = fAng / 6.2832 * fN + vKind.y, k = abs(fract(turn) - 0.5) * 2.0;
    float L = fN > 9.5 ? 0.78 + 0.2 * fract(sin(floor(turn) * 91.3 + vKind.y * 7.0) * 437.5) : 0.72 + 0.26 * sqrt(1.0 - k * k);
    float wide = fN > 9.5 ? 0.7 * sin(3.1416 * clamp(fRad / L, 0.0, 1.0)) + 0.1 : 2.0;
    fR = max(fRad / L, k / wide);
    fTone = k * 2.0 - 1.0;
    fEye = step(fRad, fN > 9.5 ? 0.3 : 0.2);
    if (fEye > 0.5) fR = fRad;
  }
`;

/** Flowers: stems and heads, in the same tiling as the grass. */
export function createFlowers(air, { count, tile, fade, seed }) {
  const s = seeds(count, seed), own = { uTile: { value: new THREE.Vector2(tile, 0) }, uFade: { value: new THREE.Vector4(...fade) } };
  const FLOWER = /* glsl */ `
  // which flower grows here, and whether one does: kinds keep to their own drifts
  float fZone = aNoise(gW * 0.045 + 70.0), fPick = fract(seed.z * 7.13 + seed.w * 3.7);
  float fKind = fZone < 0.34 ? (fPick < 0.7 ? 0.0 : 3.0) : fZone < 0.52 ? (fPick < 0.75 ? 1.0 : 2.0) : fZone < 0.7 ? (fPick < 0.65 ? 2.0 : 4.0) : (fPick < 0.6 ? 3.0 : 1.0);
  float fThere = step(seed.w, min(1.0, gKind.b * 1.15 + gState.a * 1.6)) * gKind.a * gKeep * (1.0 - smoothstep(0.1, 0.5, gState.r + gState.b)) * (1.0 - 0.7 * gState.g);
  float fTall = (fKind < 0.5 ? 0.46 : fKind < 1.5 ? 0.42 : fKind < 2.5 ? 0.34 : fKind < 3.5 ? 0.3 : 0.38) * (0.75 + 0.5 * seed.z) * fThere;
  vec3 fTop = vec3(gW.x, gY, gW.y); fTop.xz += gLean * 0.42 * fTall; fTop.y += fTall * (1.0 - 0.12 * gLL * gLL);
`;
  const common = 'attribute vec4 seed; uniform vec2 uTile; uniform vec4 uFade;';
  // --- stems ---
  const sg = new THREE.InstancedBufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 0.5, 0, 1, 0.5, 0, 0, 1, 0], 3));
  sg.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  sg.setAttribute('seed', new THREE.InstancedBufferAttribute(s, 4));
  sg.instanceCount = count;
  const stemM = shadowed(air, {
    side: THREE.DoubleSide, key: 'stem',
    vertexPars: common + 'varying vec3 vWorld; varying float vT;',
    vertex: PLACE + LEAN + FLOWER + /* glsl */ `
  vec2 fToEye = normalize(cameraPosition.xz - gW + 1e-4), fSq = vec2(-fToEye.y, fToEye.x);
  float fT = position.y;
  vec3 transformed = vec3(gW.x, gY - 0.02, gW.y);
  transformed.xz += gLean * 0.42 * fTall * fT * fT + fSq * position.x * 0.007 * step(0.001, fTall);
  transformed.y += fTall * (1.0 - 0.12 * gLL * gLL) * fT;
  vWorld = transformed; vT = fT;`,
    fragmentPars: 'varying vec3 vWorld; varying float vT;',
    fragment: /* glsl */ `gl_FragColor = vec4(air(lit(uG4 * (0.55 + 0.5 * vT), outgoingLight.g * (0.5 + 0.5 * vT), 0.4 + 0.6 * vT), vWorld), 1.0);`,
  });
  // --- heads ---
  const hg = new THREE.InstancedBufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  hg.setIndex([0, 1, 2, 0, 2, 3]);
  hg.setAttribute('seed', new THREE.InstancedBufferAttribute(s, 4));
  hg.instanceCount = count;
  const headM = shadowed(air, {
    side: THREE.DoubleSide, key: 'head', alphaToCoverage: true,
    vertexPars: common + 'uniform vec3 uPetal[5]; varying vec2 vC; flat varying vec3 vKind; varying vec3 vCol; varying vec3 vWorld;',
    vertex: PLACE + LEAN + FLOWER + /* glsl */ `
  vec3 transformed = fTop;
  float fSize = (fKind < 0.5 ? 0.085 : fKind < 1.5 ? 0.06 : fKind < 2.5 ? 0.055 : fKind < 3.5 ? 0.04 : 0.07) * (0.8 + 0.4 * seed.w) * step(0.001, fTall);
  vC = position.xy; vKind = vec3(fKind < 0.5 ? 4.0 : fKind < 1.5 ? 8.0 : fKind < 2.5 ? 13.0 : fKind < 3.5 ? 5.0 : 1.0, seed.z, fSize);
  vCol = uPetal[int(fKind)] * (0.82 + 0.36 * seed.w); vWorld = fTop;`,
    fragmentPars: 'varying vec2 vC; flat varying vec3 vKind; varying vec3 vCol; varying vec3 vWorld;',
    fragment: HEAD.replace('  float fN', '  float fN') + /* glsl */ `
  float fAA = fwidth(fR) + 1e-4, fA = 1.0 - smoothstep(1.0 - fAA, 1.0 + fAA, fR);
  if (fA < 0.03) discard;
  vec3 fAlb = vCol * (1.0 + 0.16 * fTone);
  fAlb = mix(fAlb, fN > 9.5 ? vec3(0.9, 0.5, 0.03) : fN > 6.5 ? vec3(0.03, 0.03, 0.2) : fN > 4.5 ? vec3(0.75, 0.38, 0.02) : vec3(0.02, 0.015, 0.03), fEye);
  vec3 fV = normalize(cameraPosition - vWorld);
  vec3 fC = lit(fAlb, outgoingLight.g, 1.0) + fAlb * uSunCol * 0.5 * pow(max(dot(-fV, uSun), 0.0), 2.0) * outgoingLight.g + fAlb * lamps(vWorld);
  gl_FragColor = vec4(air(fC, vWorld), fA);`,
  });
  // (a head is a square laid out toward the eye, after the stem has been put where it stands)
  headM.onBeforeCompile = ((base) => (sh) => {
    base(sh);
    Object.assign(sh.uniforms, own, { uPetal: { value: ['#e8452f', '#3f6fe6', '#fff6e4', '#f7cf2a', '#f09ac8'].map((c) => new THREE.Color(c)) } });
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\n  mvPosition.xy += position.xy * fSize;\n  gl_Position = projectionMatrix * mvPosition;');
  })(headM.onBeforeCompile);
  stemM.onBeforeCompile = ((base) => (sh) => { base(sh); Object.assign(sh.uniforms, own); })(stemM.onBeforeCompile);
  const stems = new THREE.Mesh(sg, stemM), heads = new THREE.Mesh(hg, headM);
  for (const mesh of [stems, heads]) { mesh.frustumCulled = false; mesh.receiveShadow = true; }
  const group = new THREE.Group();
  group.add(stems, heads);
  return group;
}
