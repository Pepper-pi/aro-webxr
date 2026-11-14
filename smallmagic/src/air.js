// What every painted thing in this world shares: the sun, the sky's light, the air between, the wind, and the maps
// of the ground.
//
// The look is a painter's: the sun is warm and the sky's light is blue, so whatever the sun does not reach goes
// cool, never grey; and the air is thick and blue, so that each thing further off is paler and bluer than the one
// before it, and the land falls into layers.
//
// The ground is known to everything through three pictures of it, laid over the same square:
//   tHeight  how high it is;
//   tKind    what it is: r bare earth (the path), g shore, b how thick flowers grow, a how well grass grows;
//   tState   what has been done to it, which is what magic writes: r burnt, g frozen, b burning now, a overgrown.
// Trees have their own small picture, tTrees, one point a tree: r how much of it has burnt away, g frost, b burning now.
// And whatever is alight or aglow is a lamp: four of them, which everything painted is also lit by.
// And there is one clock, uNow, which everything that moves is a function of: it can be slowed, stopped or run back.
import * as THREE from 'three';
import { SIGIL } from './sigil.js';

export const SUN = new THREE.Vector3(-0.5, 0.56, -0.66).normalize();
export const MAP = { x0: -128, z0: -128, size: 256 };
const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

export function createAir() {
  const uniforms = {
    uNow: { value: 0 },
    uSun: { value: SUN.clone() },
    uSunCol: { value: lin('#fff0d2', 1.22) },
    uSkyCol: { value: lin('#7c92ff', 0.72) },
    uHaze: { value: lin('#8fbdf6') },
    uHazeSun: { value: lin('#e9e2d2') },
    uAirK: { value: 0.0044 },
    uWind: { value: new THREE.Vector4(0.86, 0.5, 0.55, 0) },
    uPush: { value: [new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0)] },
    tHeight: { value: null }, tKind: { value: null }, tState: { value: null }, tTrees: { value: null }, tRunes: { value: null },
    uLamp: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -999, 0, 1)) }, uLampCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
    uGust: { value: new THREE.Vector4(0, 0, 1, 0) }, uGustDir: { value: new THREE.Vector2(1, 0) }, uGustTail: { value: 0 }, uLampOn: { value: 0 }, uShock: { value: new THREE.Vector4(0, 0, 0, 0) }, uHole: { value: new THREE.Vector4(0, 0, 0, 0) }, uTwist: { value: new THREE.Vector4(0, 0, 1, 0) },
    uSeal: { value: new THREE.Vector4(0, 0, 1, 0) }, uSealCol: { value: new THREE.Vector3(1, 1, 1) }, uSealSides: { value: 3 },
    uMap: { value: new THREE.Vector4(MAP.x0, MAP.z0, 1 / MAP.size, MAP.size) },
    // the meadow's greens: fresh, yellow, straw, lush
    uG1: { value: lin('#56b23a') }, uG2: { value: lin('#8cc63a') }, uG3: { value: lin('#cfd058') }, uG4: { value: lin('#2a8c46') },
    uEarth: { value: lin('#d4a468') }, uSand: { value: lin('#d9c896') }, uAsh: { value: lin('#2a2622') }, uFrost: { value: lin('#dff2ff') },
  };
  // (the parts of trees: 512 of them at most, three rows: rest, now, turn)
  const PW = 512, partData = new Float32Array(PW * 3 * 4);
  for (let i = 0; i < PW; i++) partData[(2 * PW + i) * 4 + 3] = 1;
  const partTex = new THREE.DataTexture(partData, PW, 3, THREE.RGBAFormat, THREE.FloatType);
  partTex.magFilter = partTex.minFilter = THREE.NearestFilter; partTex.needsUpdate = true;
  uniforms.tParts = { value: partTex };
  return { uniforms, parts: { data: partData, tex: partTex, W: PW }, share(s) { for (const k of Object.keys(uniforms)) s.uniforms[k] = uniforms[k]; } };
}

export const AIR = /* glsl */ `
uniform float uNow; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uHaze; uniform vec3 uHazeSun; uniform float uAirK;
uniform vec4 uWind; uniform vec4 uPush[4]; uniform vec4 uGust; uniform vec2 uGustDir; uniform float uGustTail; uniform float uLampOn; uniform vec4 uShock; uniform vec4 uHole; uniform vec4 uTwist;
uniform vec4 uLamp[4]; uniform vec3 uLampCol[4]; uniform sampler2D tTrees;
// Parts of trees, which can be moved: for each, where it was grown, where it is now (and whether it has moved at all), and how it is turned. (0: no part.)
uniform sampler2D tParts; uniform sampler2D tHeight; uniform vec4 uMap;
vec3 partTurn(float part, vec3 n) { if (part < 0.5) return n; int i = int(part + 0.5); if (texelFetch(tParts, ivec2(i, 1), 0).w < 0.5) return n; vec4 q = texelFetch(tParts, ivec2(i, 2), 0); return n + 2.0 * cross(q.xyz, cross(q.xyz, n) + q.w * n); }
vec3 partAt(float part, vec3 p) {
  if (part < 0.5) return p;
  int i = int(part + 0.5); vec4 cur = texelFetch(tParts, ivec2(i, 1), 0);
  if (cur.w < 0.5) return p;
  vec3 v = p - texelFetch(tParts, ivec2(i, 0), 0).xyz; vec4 q = texelFetch(tParts, ivec2(i, 2), 0);
  vec3 r = cur.xyz + v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  // (a tree that lies is pressed against the ground: nothing of it goes under)
  if (cur.w > 1.5) r.y = max(r.y, texture2D(tHeight, (r.xz - uMap.xy) * uMap.z).r + 0.07);
  return r;
}
// how much of a part's leaves have been stripped from it (0 to 1)
float partStrip(float part) { return part < 0.5 ? 0.0 : texelFetch(tParts, ivec2(int(part + 0.5), 0), 0).w; }
float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(aHash(i), aHash(i + vec2(1, 0)), f.x), mix(aHash(i + vec2(0, 1)), aHash(i + vec2(1, 1)), f.x), f.y); }
float aHash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float aNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(aHash3(i), aHash3(i + vec3(1, 0, 0)), f.x), mix(aHash3(i + vec3(0, 1, 0)), aHash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(aHash3(i + vec3(0, 0, 1)), aHash3(i + vec3(1, 0, 1)), f.x), mix(aHash3(i + vec3(0, 1, 1)), aHash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// the air between the eye and a place
vec3 air(vec3 col, vec3 world) {
  vec3 v = world - cameraPosition; float d = length(v);
  float f = (1.0 - exp(-d * uAirK)) * 0.97;
  vec3 haze = mix(uHaze, uHazeSun, pow(max(dot(v / max(d, 1e-3), uSun), 0.0), 3.0) * 0.6);
  return mix(col, haze, f);
}
// the light of whatever is burning or aglow nearby, at a place
vec3 lamps(vec3 world) {
  vec3 s = vec3(0.0);
  if (uLampOn < 0.5) return s;
  for (int i = 0; i < 4; i++) { float d = distance(world, uLamp[i].xyz) / max(uLamp[i].w, 0.001); s += uLampCol[i] * (1.0 - smoothstep(0.6, 1.0, d)) / (1.0 + 7.0 * d * d); }
  return s;
}
// a thing's colour under so much sun (0 to 1) and so much open sky (0 to 1)
vec3 lit(vec3 albedo, float sun, float sky) { return albedo * (uSunCol * sun + uSkyCol * (0.42 + 0.58 * sky)); }
`;

export const GROUND = /* glsl */ `
uniform sampler2D tKind; uniform sampler2D tState;
uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform vec3 uG4; uniform vec3 uEarth; uniform vec3 uSand; uniform vec3 uAsh; uniform vec3 uFrost;
vec2 mapUv(vec2 xz) { return (xz - uMap.xy) * uMap.z; }
// what has been done to the ground at a place (its edges are ragged: it is read a little to one side, differently everywhere)
vec4 stateAt(vec2 xz) { return texture2D(tState, mapUv(xz + vec2(sin(xz.y * 1.31 + sin(xz.x * 0.53) * 2.0), sin(xz.x * 1.17 + sin(xz.y * 0.61) * 2.0)) * 0.55 + vec2(sin(xz.y * 4.3), sin(xz.x * 3.9)) * 0.16)); }
// A seal: the circle a spell draws on the ground where it works. Rings, a three-cornered figure turning inside
// them, and runes round the rim, in light.
uniform vec4 uSeal; uniform vec3 uSealCol; uniform float uSealSides; uniform sampler2D tRunes;
` + SIGIL + /* glsl */ `
float seal(vec2 xz) {
  if (uSeal.w <= 0.0) return 0.0;
  vec2 q = (xz - uSeal.xy) / uSeal.z;
  if (dot(q, q) > 1.0) return 0.0;
  return min(sigil(q, uSealSides, uNow * 0.45, 1.0, 0.014), 1.6) * uSeal.w;
}
// the meadow's colour at a place: at the foot of its grass, and at the tips
void meadow(vec2 xz, out vec3 root, out vec3 tip) {
  float a = aNoise(xz * 0.03 + 3.0) * 0.65 + aNoise(xz * 0.09 + 31.0) * 0.35, lush = aNoise(xz * 0.07 + 17.0), dry = aNoise(xz * 0.016 + 40.0);
  tip = mix(uG1, uG2, smoothstep(0.3, 0.72, a));
  tip = mix(tip, uG3, smoothstep(0.6, 0.86, dry) * 0.45);
  tip = mix(tip, uG4, smoothstep(0.58, 0.9, lush) * 0.6);
  root = tip * vec3(0.2, 0.42, 0.5);
}
`;

// The cells a surface is cut into (for cracks in bark, facets of rock): how far to the nearest wall, three numbers
// that are the cell's own, and where its middle is.
export const CELLS = /* glsl */ `
vec3 cHash3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
void cells3(vec3 p, out float edge, out vec3 id, out vec3 centre) {
  vec3 n = floor(p), f = fract(p), mg = vec3(0.0), mr = vec3(0.0); float md = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k)), r = g + cHash3(n + g) - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = mg + vec3(float(i), float(j), float(k)), r = g + cHash3(n + g) - f, dr = r - mr;
    if (dot(dr, dr) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
  }
  edge = md; id = cHash3(n + mg + 17.0); centre = mr;
}
`;

/** A MeshLambertMaterial used only for what three.js knows how to do (shadows, and being drawn into them): in its
 *  fragment shader, outgoingLight.g is how much sun reaches the place, 0 to 1. The painting is ours. */
export function shadowed(air, { side = THREE.FrontSide, vertexPars = '', vertex = '', fragmentPars = '', fragment = '', key, vertexColors = false, alphaToCoverage = false }) {
  const m = new THREE.MeshLambertMaterial({ side, vertexColors: false, alphaToCoverage });
  m.onBeforeCompile = (s) => {
    air.share(s);
    s.vertexShader = AIR + GROUND + vertexPars + '\n' + s.vertexShader.replace('#include <begin_vertex>', vertex);
    s.fragmentShader = AIR + GROUND + fragmentPars + '\n' + s.fragmentShader
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = directionalLights[0].direction;')
      .replace('#include <opaque_fragment>', fragment);
  };
  m.customProgramCacheKey = () => key;
  return m;
}
