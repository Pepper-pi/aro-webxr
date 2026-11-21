// The painted things that are not grass: leaves, and solid things (trunks, rocks, standing stones).
//
// Leaves are touches of a brush ("dabs"): small marks that face the eye. One touch lays down several leaves at
// once. A crown is a few thousand touches about its boughs, and each knows which way out of the crown it faces:
// that, and not the flat mark's own facing, is what it is lit by, so a tree is shaded as the round thing it is.
//
// Solid things are painted the way a brush would do them: a few broad planes of colour with dark lines drawn
// between (cracks in bark, the joints of rock), each plane a little lighter on the edge it turns to the sun and
// darker on the other. There is no grain or speckle anywhere.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AIR, CELLS, shadowed } from './air.js';

// A dab is four corners at one place; they are set out toward the eye here.
const DAB_VERTEX = /* glsl */ `
  vec3 transformed = partAt(part, offset);
  float dSeed = fract(dabB.y);
  // what has happened to its tree: as it burns its leaves go, the outermost first and not all together
  vec4 dTree = texture2D(tTrees, vec2((tree + 0.5) / 64.0, 0.5));
  float dOwn = clamp(dTree.r * 2.0 - dSeed, 0.0, 1.0), dGone = smoothstep(0.35, 1.0, dOwn);
  vTree = dTree;
  // (stripped by wind, or shaken off as it fell: each leaf goes in its own time)
  dGone = max(dGone, smoothstep(dSeed - 0.04, dSeed + 0.04, partStrip(part) * 1.08));
  // (each leaf catches in its own time: it chars and glows just before it goes)
  vTree.r = dOwn;
  vTree.b = dTree.b * smoothstep(0.0, 0.1, dOwn) * (1.0 - smoothstep(0.3, 0.6, dOwn));
  // the bough it is on moves in the wind, and it stirs on the bough
  float dGust = aNoise(offset.xz * 0.05 - uWind.xy * uNow * 0.85);
  transformed.xz += uWind.xy * uWind.z * dabB.w * (0.05 + 0.28 * dGust * dGust) * (0.6 + 0.4 * sin(uNow * 1.3 + offset.y * 0.7 + dSeed * 6.0));
  transformed.y += dabB.w * 0.03 * sin(uNow * 2.1 + dSeed * 40.0) * uWind.z;
  // a gust that has just struck its tree throws the boughs over and sets every leaf shaking
  transformed.xz += uGustDir * dTree.a * dabB.w * (0.55 + 0.3 * sin(uNow * 11.0 + dSeed * 30.0 + offset.y));
  transformed.y += dTree.a * dabB.w * 0.12 * sin(uNow * 17.0 + dSeed * 50.0);
  // a whirlwind: the boughs are dragged round it
  if (uTwist.w > 0.0) { vec2 tv = offset.xz - uTwist.xy; float tl = length(tv); transformed.xz += (vec2(-tv.y, tv.x) * 0.8 - tv * 0.5) / max(tl, 0.1) * uTwist.w * dabB.w * 0.9 * (1.0 - smoothstep(4.0, uTwist.z * 1.5, tl)); }
  // a singularity: every leaf strains toward it
  if (uHole.w > 0.0) { vec3 dh = uHole.xyz - offset; float dhl = length(dh); transformed += (dh / max(dhl, 0.1)) * uHole.w * dabB.w * 1.5 * (1.0 - smoothstep(10.0, 36.0, dhl)); }
`;
const DAB_PROJECT = /* glsl */ `
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  {
    float a = dabB.x + dabB.w * 0.16 * sin(uNow * 1.7 + dSeed * 30.0) * uWind.z + dTree.a * 0.7 * sin(uNow * 19.0 + dSeed * 70.0);
    // (a touch is laid on upright; if its part has been turned over, the touch is turned with it)
    vec2 dUp = (viewMatrix * vec4(partTurn(part, vec3(0.0, 1.0, 0.0)), 0.0)).xy;
    if (dot(dUp, dUp) > 1e-4) a += atan(-dUp.x, dUp.y);
    vec2 o = position.xy * dabS * (1.0 - dGone);
    mvPosition.xy += vec2(cos(a) * o.x - sin(a) * o.y, sin(a) * o.x + cos(a) * o.y);
    vC = position.xy; vDab = dabB;
  }
  gl_Position = projectionMatrix * mvPosition;`;
// The shape of a touch. r: 0 at the middle of the nearest mark in it, 1 at that mark's edge. tone: how much paint
// was on the brush for that mark, -1 to 1.
const DAB_SHAPE = /* glsl */ `
  vec2 dP = vC; float dSeed = fract(vDab.y), dK = vDab.z, dR = 2.0, dTone = 0.0;
  if (dK < 0.5) {
    // leaves: four to seven of them, each pointed at both ends and a little bent
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      if (fi > 3.5 + dSeed * 3.5) break;
      vec3 h = fract(sin(vec3(fi * 12.9898 + dSeed * 91.7, fi * 78.233 + dSeed * 47.3, fi * 37.719 + dSeed * 13.1)) * 43758.5453);
      vec2 q = dP - (h.xy - 0.5) * 1.05;
      float a = (h.z - 0.5) * 1.9, ca = cos(a), sa = sin(a);
      q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
      float s = 0.3 + 0.16 * h.x, y = q.y / s;
      float r = abs(y) < 1.0 ? abs(q.x + 0.1 * s * sin(y * 2.5 + h.y * 9.0)) / (s * 0.5 * pow(1.0 - y * y, 0.7) + 0.004) : 2.0;
      if (r < dR) { dR = r; dTone = h.z * 2.0 - 1.0; }
    }
  } else if (dK < 1.5) {
    // a spray of needles: they fan from the twig, which runs up the middle
    for (int i = 0; i < 9; i++) {
      float fi = float(i), side = mod(fi, 2.0) * 2.0 - 1.0, at = -0.85 + fi * 0.2;
      vec2 h = fract(sin(vec2(fi * 12.9898 + dSeed * 91.7, fi * 78.233 + dSeed * 47.3)) * 43758.5453);
      vec2 from = vec2(0.0, at), dir = normalize(vec2(side * (0.75 + 0.3 * h.x), -0.55 - 0.3 * h.y));
      vec2 q = dP - from; float al = dot(q, dir), len = 0.62 + 0.25 * h.x;
      float r = (al > 0.0 && al < len) ? abs(dot(q, vec2(-dir.y, dir.x))) / (0.085 * (1.0 - al / len) + 0.02) : 2.0;
      if (r < dR) { dR = r; dTone = h.y * 2.0 - 1.0; }
    }
    dR = min(dR, abs(dP.x) / 0.05 + step(0.9, abs(dP.y)) * 2.0);
  } else {
    // a soft ragged mass
    float ang = atan(dP.y, dP.x);
    dR = length(dP) * (1.0 + 0.14 * sin(ang * 3.0 + dSeed * 40.0) + 0.08 * sin(ang * 5.0 + dSeed * 91.0));
  }`;

export function createPaint(air) {
  const DAB_PARS = 'attribute vec3 offset; attribute vec3 crown; attribute vec4 dabC; attribute vec2 dabS; attribute vec4 dabB; attribute float tree; attribute float part; varying vec2 vC; flat varying vec4 vDab; flat varying vec4 vTree;';
  const leaf = shadowed(air, {
    side: THREE.DoubleSide, key: 'leaf', alphaToCoverage: true,
    vertexPars: DAB_PARS + 'flat varying vec3 vN; flat varying vec4 vCol; varying vec3 vWorld;',
    vertex: DAB_VERTEX + '  vN = partTurn(part, crown); vCol = dabC; vWorld = transformed;',
    fragmentPars: 'varying vec2 vC; flat varying vec4 vDab; flat varying vec4 vTree; flat varying vec3 vN; flat varying vec4 vCol; varying vec3 vWorld;',
    fragment: DAB_SHAPE + /* glsl */ `
  float dAA = fwidth(dR) + 1e-4, dA = 1.0 - smoothstep(1.0 - dAA, 1.0 + dAA, dR);
  if (dA < 0.04) discard;
  vec3 dV = normalize(cameraPosition - vWorld);
  // lit as the round crown it is part of; a bough in another's shadow is darker; deep inside is darker still
  float dL = smoothstep(-0.45, 0.7, dot(vN, uSun)) * mix(0.5, 1.0, outgoingLight.g) * (0.35 + 0.65 * vCol.a);
  vec3 dAlb = vCol.rgb * (1.0 + 0.2 * dTone);
  // scorched, it browns and blackens; frozen, it is white
  dAlb = mix(dAlb, vec3(0.16, 0.07, 0.02), smoothstep(0.0, 0.2, vTree.r)); dAlb = mix(dAlb, vec3(0.02), smoothstep(0.2, 0.6, vTree.r));
  dAlb = mix(dAlb, uFrost, vTree.g * 0.85);
  vec3 dC = lit(dAlb, dL, (0.3 + 0.7 * (vN.y * 0.5 + 0.5)) * vCol.a);
  // against the sun, the leaves at a crown's edge are lit through
  dC += dAlb * uSunCol * vec3(1.0, 0.92, 0.3) * pow(max(dot(-dV, uSun), 0.0), 3.0) * vCol.a * vCol.a * 0.9;
  dC += dAlb * lamps(vWorld) + vec3(2.6, 0.7, 0.08) * vTree.b * (0.45 + 0.55 * dTone);
  gl_FragColor = vec4(air(dC, vWorld), dA);`,
  });
  leaf.onBeforeCompile = ((base) => (s) => { base(s); s.vertexShader = s.vertexShader.replace('#include <project_vertex>', DAB_PROJECT); })(leaf.onBeforeCompile);
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  leafDepth.onBeforeCompile = (s) => {
    air.share(s);
    s.vertexShader = AIR + DAB_PARS + '\n' + s.vertexShader.replace('#include <begin_vertex>', DAB_VERTEX).replace('#include <project_vertex>', DAB_PROJECT);
    s.fragmentShader = 'varying vec2 vC; flat varying vec4 vDab;\n' + s.fragmentShader.replace('void main() {', `void main() {${DAB_SHAPE}\n  if (dR > 1.0) discard;`);
  };
  leafDepth.customProgramCacheKey = () => 'leaf-depth';

  // --- solid things ---
  const solid = shadowed(air, {
    key: 'solid',
    vertexPars: 'attribute vec3 tint; attribute vec4 kind; attribute float tree; attribute float part; flat varying vec4 vTree; varying vec3 vRest; varying vec3 vNw; varying vec3 vTint; flat varying vec4 vKind; varying vec3 vWorld;',
    vertex: '#include <begin_vertex>\n  transformed = partAt(part, transformed); vRest = position; vNw = partTurn(part, normalize(mat3(modelMatrix) * normal)); vTint = tint; vKind = kind; vWorld = transformed; vTree = texture2D(tTrees, vec2((tree + 0.5) / 64.0, 0.5));',
    fragmentPars: CELLS + 'varying vec3 vRest; varying vec3 vNw; varying vec3 vTint; flat varying vec4 vKind; flat varying vec4 vTree; varying vec3 vWorld;',
    fragment: /* glsl */ `
  // kind.x: 0 bark, 1 rock. kind.y: how big its planes are. kind.z: its own seed. kind.w: how much moss.
  vec3 sN = normalize(vNw);
  if (vKind.x > 0.5) { vec3 f = normalize(cross(dFdx(vWorld), dFdy(vWorld))); sN = normalize(mix(sN, f * sign(dot(f, sN)), 0.75)); }
  float sEdge; vec3 sId, sMid;
  vec3 sP = (vRest + vKind.z) * (vKind.x > 0.5 ? vec3(1.0) : vec3(1.0, 0.22, 1.0)) * vKind.y;
  cells3(sP, sEdge, sId, sMid);
  float sRock = step(0.5, vKind.x);
  vec3 sAlb = vTint * (mix(0.8, 0.9, sRock) + mix(0.4, 0.2, sRock) * sId.x);
  // each plane: lighter on the edge it turns to the sun, darker on the other; and a dark line between planes
  float sBevel = (1.0 - smoothstep(0.03, 0.26, sEdge)) * dot(normalize(-sMid + 1e-4), vKind.x > 0.5 ? uSun : normalize(uSun * vec3(1.0, 0.22, 1.0)));
  sAlb *= 1.0 + mix(0.32, 0.22, sRock) * sBevel;
  if (vKind.x > 0.5) sAlb *= 0.86 + 0.28 * smoothstep(0.35, 0.65, aNoise(vec2(dot(vRest.xz, vec2(1.7, 1.3)) * 1.6, vRest.y * 0.35) + vKind.z));
  sAlb = mix(sAlb, vTint * mix(vec3(0.3, 0.26, 0.4), vec3(0.62, 0.6, 0.66), sRock), (1.0 - smoothstep(0.012, mix(0.05, 0.03, sRock), sEdge)) * mix(1.0, 0.8, sRock));
  // moss where it faces the sky, in patches
  float sMoss = vKind.w * smoothstep(0.25, 0.75, sN.y + (aNoise3(vWorld * 1.4) - 0.5) * 0.9);
  sAlb = mix(sAlb, mix(uG4, uG2, aNoise3(vWorld * 3.0)) * 0.8, sMoss);
  // charred where its tree has burnt, rimed where it has frozen
  sAlb = mix(sAlb, vec3(0.03, 0.028, 0.03) * (0.6 + 0.8 * sId.x), vTree.r * 0.92);
  sAlb = mix(sAlb, uFrost, vTree.g * smoothstep(-0.2, 0.6, sN.y + (aNoise3(vWorld * 2.0) - 0.5)) * 0.85);
  float sL = smoothstep(-0.05, 0.5, dot(sN, uSun)) * outgoingLight.g;
  vec3 sC = lit(sAlb, sL, 0.35 + 0.65 * (sN.y * 0.5 + 0.5));
  // (stone in shade is grey with a little of the sky in it, and takes some warmth up from the grass)
  if (sRock > 0.5) sC = sAlb * (uSunCol * sL + mix(uSkyCol, vec3(dot(uSkyCol, vec3(0.3333))), 0.6) * (0.7 + 0.5 * (sN.y * 0.5 + 0.5)) + vec3(0.07, 0.09, 0.03) * (1.0 - sN.y) * 0.8);
  sC += sAlb * lamps(vWorld) * (0.4 + 0.6 * max(dot(sN, normalize(uLamp[0].xyz - vWorld)), 0.0)) + vec3(1.6, 0.4, 0.05) * vTree.b * smoothstep(0.55, 0.8, aNoise3(vWorld * 5.0 + uNow * 0.6)) * (1.0 - sRock);
  gl_FragColor = vec4(air(sC, vWorld), 1.0);`,
  });
  // (the shadow of a solid thing goes with it)
  const solidDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  solidDepth.onBeforeCompile = (s) => { air.share(s); s.vertexShader = AIR + 'attribute float part;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = partAt(part, transformed);'); };
  solidDepth.customProgramCacheKey = () => 'solid-depth';
  return { leaf, leafDepth, solid, solidDepth };
}

/** Collects touches of the brush and makes one mesh of them. */
export function createDabs(material, depth) {
  const c = new THREE.Color();
  let cap = 1 << 15, n = 0;
  const cols = { offset: 3, crown: 3, dabC: 4, dabS: 2, dabB: 4, tree: 1, part: 1 }, data = {};
  let tree = 0, part = 0;
  for (const k of Object.keys(cols)) data[k] = new Float32Array(cap * cols[k]);
  const grow = () => { cap *= 2; for (const k of Object.keys(cols)) { const more = new Float32Array(cap * cols[k]); more.set(data[k]); data[k] = more; } };
  return {
    /** Which tree what is added next belongs to (0: none that magic can touch). */
    set tree(v) { tree = v; },
    /** Which part of that tree (0: none: it stays where it is put). */
    set part(v) { part = v; },
    /** One touch at (x, y, z). w, h: half its width and height. kind: 0 leaves, 1 a spray of needles, 2 a soft mass.
     *  normal: which way out of its crown it faces. inner: 0 deep inside the crown to 1 at its surface. */
    add(x, y, z, { w, h = w, turn = 0, seed = 0.5, kind = 0, colour, normal, inner = 1, sway = 0.5 }) {
      if (n === cap) grow();
      c.set(colour);
      data.offset.set([x, y, z], n * 3); data.crown.set([normal.x, normal.y, normal.z], n * 3); data.dabC.set([c.r, c.g, c.b, inner], n * 4);
      data.dabS.set([w, h], n * 2); data.dabB.set([turn, Math.min(seed, 0.999), kind, sway], n * 4); data.tree[n] = tree; data.part[n] = part;
      n++;
    },
    build() {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      for (const k of Object.keys(cols)) g.setAttribute(k, new THREE.InstancedBufferAttribute(data[k].slice(0, n * cols[k]), cols[k]));
      g.instanceCount = n;
      const mesh = new THREE.Mesh(g, material);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      return mesh;
    },
    get count() { return n; },
  };
}

/** Collects solid pieces and makes one mesh of them. bark: it is a trunk (its planes run up it). scale: how many
 *  planes to a metre. moss: 0 to 1. */
export function createSolids(material, depth) {
  const parts = [], T = new THREE.Color();
  let k = 0, tree = 0, part = 0;
  return {
    set tree(v) { tree = v; },
    set part(v) { part = v; },
    /** partOf(x, y, z): which part each of its faces belongs to, by where the face's middle is (else all of it is the part now set). */
    add(g, colour, { bark = false, scale = 1, moss = 0, partOf = null } = {}) {
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count, tint = new Float32Array(n * 3), kind = new Float32Array(n * 4), seed = (++k * 7.31) % 50;
      T.set(colour);
      for (let i = 0; i < n; i++) { tint.set([T.r, T.g, T.b], i * 3); kind.set([bark ? 0 : 1, scale, seed, moss], i * 4); }
      g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
      g.setAttribute('kind', new THREE.BufferAttribute(kind, 4));
      g.setAttribute('tree', new THREE.BufferAttribute(new Float32Array(n).fill(tree), 1));
      g.deleteAttribute('uv');
      if (g.index) g = g.toNonIndexed();
      const m = g.attributes.position.count, pa = new Float32Array(m).fill(part), p = g.attributes.position;
      if (partOf) for (let i = 0; i < m; i += 3) pa[i] = pa[i + 1] = pa[i + 2] = partOf((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3);
      g.setAttribute('part', new THREE.BufferAttribute(pa, 1));
      parts.push(g);
      return g;
    },
    build() {
      const mesh = new THREE.Mesh(mergeGeometries(parts), material);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      return mesh;
    },
    get count() { return parts.length; },
  };
}
