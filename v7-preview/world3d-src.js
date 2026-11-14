/*!
 * Overworld for ARO v7.
 * Character: AvatarSample_B by VRoid / pixiv (VRM 0.0).
 *   Commercial use and modification are allowed. Credit is not required.
 *   Not CC0. Do not sell the unmodified file.
 *   https://hub.vroid.com/en/characters/7939147878897061040/models/2292219474373673889
 * Renderer: three.js (MIT) and @pixiv/three-vrm (MIT), MToon materials from the VRM.
 * Idle and walk are original clips posed on the VRM humanoid bones (no Mixamo files).
 * Map: OpenStreetMap contributors, ODbL. Seaside, Oregon, the game's fallback place.
 *   Roads, the river, and parks are rasterized from that extract. No paid assets.
 * Ground photos, CC0, Poly Haven (https://polyhaven.com/license):
 *   forest_floor, aerial_grass_rock, floor_pebbles_01, leafy_grass.
 *   Resized and recompressed here. leafy_grass is the sunny grass base
 *   (https://polyhaven.com/a/leafy_grass). The shader grades it to a mid green
 *   with yellow-green light and deep green only in shade. No reference art is shipped.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const VRM_URL = 'assets/vrm/AvatarSample_B.vrm';
const NPC_URLS = [
  { id: 'A', url: 'assets/vrm/AvatarSample_A.vrm' },
  { id: 'C', url: 'assets/vrm/AvatarSample_C.vrm' },
];
const FIELD_URL = 'data/seaside-field.json';

const keys = { f: 0, b: 0, l: 0, r: 0 };
const ptrs = new Map();
let field = null;
let grid = null;
let renderer, scene, camera, clock;
let ground, water, avatar, vrm, blob, homeRoot, fightBeast, fightDress, fightCut, camPlate, camTex, camCanvas, kingShadow, bobber, fishLine, fishGlow, castRing;
const npcs = [];
const playerPose = { amp: 0, phase: 0 };
let worldT = 0;
let destFromPick = false;
let sun, hemi, skyMat, waterMat;
let camYaw = Math.PI;
let camDist = 10.4;
let camPitch = 0.34;
let rt, bloomA, bloomB, composeScene, composeCam, quad, brightMat, blurMat, quadMat;
let charRT, charFlat, fxaaMat;
let windMats = [];
let life = null;
let grassKit = null;
let grassMesh = null;
let grassStore = null;
const matzSparks = [];
const shellU = {
  uPlayer: { value: new THREE.Vector2() },
  uNear: { value: 32 },
  uFar: { value: 62 },
  uTime: { value: 0 },
  uHolo: { value: 1 },
};
const grassRegrow = new Map();
let grassRegrowAt = 8;
let playMode = 'world';
const fp = { on: false, view: 'virtual', aggro: 0, aggroHold: '', yaw: 0, pitch: 0.02, charge: 0, cast: 0, pulse: 0, vials: { aether: 3, fire: 3 }, xr: 'unchecked', hp: 100, clock: 0, placed: false, booted: false, fogSaved: null, track: { state: 'off', charge: 0, x: 0.5, y: 0.78, hold: false, ready: false, lastZ: null, lastX: null, lastY: null, lastT: 0, cool: 0, firedUntil: 0, err: '', errWhere: '', vision: '' } };
let palmOrb = null;
let playSaved = null;
let lastDt = 0.016;
let moveSpeed = 0;
let runHold = 0;
let runUntil = 0;
let camInit = false;
let groundHolo = null;
let rod = null;
let rodLine = null;
const bolts = [];
const roomFloors = [];
const gates = [];
const bees = [];
const wantCam = new THREE.Vector3();
const smoothCam = new THREE.Vector3();
const smoothLook = new THREE.Vector3();
const SITES = {
  home: { x: 0, z: -940, hw: 4.1, hd: 3.5 },
  house: { x: 36, z: -940, hw: 3.8, hd: 3.3 },
  market: { x: 88, z: -940, hw: 11, hd: 8 },
  arena: { x: 150, z: -940, hw: 9, hd: 7 },
  raid: { x: 220, z: -940, hw: 12, hd: 11 },
};
const superHexes = [];
const aetherMarks = [];
const sunXZ = { value: new THREE.Vector2(0.72, 0.38) };
const shadowPairs = [];
const curveU = { k: { value: 0.00024 }, cam: { value: new THREE.Vector3() } };
let curveEnabled = true;
try { if (/[?&]curve=0(?:&|$)/.test(location.search)) curveEnabled = false; } catch (e) { /* keep the bend */ }
let px = 0, pz = 0, facing = 0;
let npcSpots = [];
let dest = null;
let gpsTarget = null;
let gpsRef = null;
let tapGpsBlock = 0;
let tapUntil = 0;
let lastAnchor = '';
let shot = '';
let active = false;
let avatarReady = false;
const look = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function tapOn() {
  try { return window.__aroTapMove ? window.__aroTapMove() !== false : true; }
  catch (e) { return true; }
}
function toonRamp() {
  const data = new Uint8Array([
    46, 32, 48, 255,
    102, 74, 62, 255,
    176, 138, 104, 255,
    255, 244, 220, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
const ramp = toonRamp();
function bendMat(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    if (prev) prev(shader);
    shader.uniforms.uCurveK = curveU.k;
    shader.uniforms.uCurveCam = curveU.cam;
    if (mat.isMeshToonMaterial && !shader.fragmentShader.includes('aroRim')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `float aroRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
         outgoingLight += vec3(1.0, 0.84, 0.62) * aroRim * 0.28;
         float aroInk = smoothstep(0.4, 0.16, dot(normalize(normal), normalize(vViewPosition)));
         outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.2, 0.13, 0.11), aroInk);
         #include <output_fragment>`
      );
    }
    if (shader.vertexShader.includes('aroWp')) return;
    shader.vertexShader = 'uniform float uCurveK;\nuniform vec3 uCurveCam;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 aroWp = vec4(transformed, 1.0);
       #ifdef USE_INSTANCING
         aroWp = instanceMatrix * aroWp;
       #endif
       aroWp = modelMatrix * aroWp;
       aroWp.y -= uCurveK * dot(aroWp.xz - uCurveCam.xz, aroWp.xz - uCurveCam.xz);
       vec4 mvPosition = viewMatrix * aroWp;
       gl_Position = projectionMatrix * mvPosition;`
    );
  };
  const prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + (mat.isMeshToonMaterial ? '|cel' : '|curve');
  return mat;
}
function toonMat(color) {
  return bendMat(new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
}

function kindAt(x, z) {
  if (!field) return null;
  const c = Math.floor((x - field.minx) / field.cell);
  const r = Math.floor((z - field.minz) / field.cell);
  if (c < 0 || r < 0 || c >= field.cols || r >= field.rows) return null;
  return grid[r * field.cols + c];
}
function groundY(x, z) {
  const k = kindAt(x, z);
  const n = Math.sin(x * 0.02) * Math.cos(z * 0.017) * 1.7 + Math.sin(x * 0.055 + z * 0.04) * 0.45;
  if (k === 3) return -0.7;
  if (k === 4 || k === 5) return n * 0.08 + 0.06;
  if (k === 1 || k === 2) return n + 0.35;
  return n * 0.75 + 0.1;
}
function indoors() {
  return playMode !== 'world' && playMode !== 'fish';
}
function standY(x, z) {
  return indoors() ? 0 : groundY(x, z);
}
function blocked(x, z) {
  const k = kindAt(x, z);
  return k == null || k === 3;
}
function projectLatLon(lat, lon) {
  const x = (lon - field.origin.lon) * field.metersPerDegLon;
  const z = -(lat - field.origin.lat) * field.metersPerDegLat;
  return { x, z };
}

const COL = {
  0: [0.28, 0.48, 0.15],
  1: [0.32, 0.52, 0.16],
  2: [0.16, 0.36, 0.12],
  3: [0.04, 0.24, 0.42],
  4: [0.48, 0.36, 0.22],
  5: [0.42, 0.34, 0.24],
};
function tint(kind, x, z) {
  const base = COL[kind] || COL[0];
  const n1 = Math.sin(x * 0.11) * Math.cos(z * 0.09);
  const n2 = Math.sin(x * 0.37 + 1.7) * Math.sin(z * 0.31 + 0.4);
  const fleck = hash2((x * 2.7) | 0, (z * 2.7) | 0);
  const j = 0.9 + n1 * 0.08 + n2 * 0.05 + (fleck - 0.5) * 0.1;
  const warm = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.04);
  return [
    base[0] * j * (0.9 + warm * 0.22),
    base[1] * j * 0.96,
    base[2] * j * (0.82 - warm * 0.08),
  ];
}
function carveLake() {
  const lx = field.anchors.lake[0], lz = field.anchors.lake[1];
  const rx = 36, rz = 24;
  const cols = field.cols, rows = field.rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = field.minx + (c + 0.5) * field.cell;
    const z = field.minz + (r + 0.5) * field.cell;
    const nx = (x - lx) / rx, nz = (z - lz) / rz;
    const wob = 0.18 * Math.sin(nx * 5.2 + nz * 1.6) + 0.1 * Math.cos(nz * 6.4 + nx);
    if (nx * nx + nz * nz < 1 + wob && grid[r * cols + c] !== 4) grid[r * cols + c] = 3;
  }
  const add = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r * cols + c] !== 3) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const i = rr * cols + cc;
      const k = grid[i];
      if (k === 0 || k === 1 || k === 5) add.push(i);
    }
  }
  for (const i of add) grid[i] = 3;
}

const HEX_GLSL = `
vec2 holoHash2(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float holoHash(vec2 p){ return holoHash2(p).x; }
vec3 holoHex(vec2 p, float scale){
  vec2 uv = p / scale;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = uv - gv;
  float hd = max(abs(gv.x), abs(gv.x) * 0.5 + abs(gv.y) * 0.8660254);
  return vec3(id, 0.5 - hd);
}
`;
let seamLock = -1;
function loadGroundTex(url, color) {
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function dressGround(mesh) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHolo: { value: 1 },
      uOrigin: { value: new THREE.Vector2() },
      uSeam: { value: 0 },
      uSoil: { value: loadGroundTex('assets/ground/forest_floor.jpg', true) },
      uGrass: { value: loadGroundTex('assets/ground/leafy_grass.jpg', true) },
      uHeight: { value: loadGroundTex('assets/ground/forest_floor_h.jpg', false) },
      uMoss: { value: loadGroundTex('assets/ground/moss_rock.jpg', true) },
      uPebble: { value: loadGroundTex('assets/ground/pebbles.jpg', true) },
      uLake: { value: new THREE.Vector2() },
      uLakeR: { value: new THREE.Vector2(36, 24) },
      uHome: { value: new THREE.Vector2(1e5, 1e5) },
      uPlayer: { value: new THREE.Vector2() },
      uCurveK: curveU.k,
      uCurveCam: curveU.cam,
      uAether: { value: [new THREE.Vector2(1e5, 1e5), new THREE.Vector2(1e5, 1e5), new THREE.Vector2(1e5, 1e5)] },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vWorld;
      varying vec3 vColor;
      uniform float uCurveK;
      uniform vec3 uCurveCam;
      float vHash(vec2 p){
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      vec2 vHexId(vec2 p){
        vec2 uv = p / 3.6;
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        return uv - gv;
      }
      void main(){
        vColor = color;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 id = vHexId(w.xz);
        vec2 coarse = floor(id / 2.2);
        float cluster = step(0.9, vHash(coarse + 9.0));
        float member = step(vHash(id), 0.18 + vHash(coarse) * 0.4);
        float sunk = cluster * member * step(0.62, vHash(id + 5.0));
        w.y -= sunk * (0.02 + 0.03 * vHash(id + 1.7));
        w.y -= uCurveK * dot(w.xz - uCurveCam.xz, w.xz - uCurveCam.xz);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorld;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uHolo;
      uniform float uSeam;
      uniform vec2 uOrigin;
      uniform sampler2D uSoil;
      uniform sampler2D uGrass;
      uniform sampler2D uHeight;
      uniform sampler2D uMoss;
      uniform sampler2D uPebble;
      uniform vec2 uLake;
      uniform vec2 uLakeR;
      uniform vec2 uHome;
      uniform vec2 uPlayer;
      uniform float uCurveK;
      uniform vec3 uCurveCam;
      uniform vec2 uAether[3];
      ${HEX_GLSL}
      vec3 lift(vec3 c){ return pow(max(c, vec3(0.001)), vec3(0.5)); }
      vec3 grade(vec3 c, vec3 tint){
        return mix(c, c * 0.65 + tint, 0.08);
      }
      void main(){
        float lakeD = length((vWorld.xz - uLake) / max(uLakeR, vec2(1.0)));
        if (vWorld.y < -0.18 && lakeD < 0.9) {
          gl_FragColor = vec4(mix(vec3(0.04, 0.2, 0.32), vColor, 0.35), 1.0);
          return;
        }
        vec3 V = normalize(cameraPosition - vWorld);
        float ny = clamp(V.y, 0.0, 1.0);
        vec2 uv = vWorld.xz * 0.18;
        vec2 uvOff = uv + V.xz * (0.022 * ny);
        float hit = texture2D(uHeight, uvOff).r;
        vec3 soilRaw = lift(texture2D(uSoil, uvOff * 0.85).rgb);
        vec3 grassRaw = lift(mix(texture2D(uGrass, uvOff * 0.72).rgb, texture2D(uGrass, uvOff * 0.22 + 0.37).rgb, 0.42));
        vec3 mossRaw = lift(mix(texture2D(uMoss, uv * 0.55 + 3.0).rgb, texture2D(uMoss, uv * 0.18 + 8.0).rgb, 0.4));
        vec3 pebRaw = lift(texture2D(uPebble, uv * 1.25).rgb);
        float gL = dot(grassRaw, vec3(0.25, 0.55, 0.2));
        float sL = dot(soilRaw, vec3(0.3, 0.5, 0.2));
        float mL = dot(mossRaw, vec3(0.3, 0.5, 0.2));
        float pL = dot(pebRaw, vec3(0.33));
        vec3 grassG = vec3(0.16, 0.38, 0.11) * (0.78 + gL * 0.7);
        vec3 mossG = vec3(0.14, 0.36, 0.12) * (0.75 + mL * 0.75);
        vec3 dirtG = vec3(0.32, 0.28, 0.14) * (0.7 + sL * 0.65);
        vec3 stoneG = vec3(0.42, 0.40, 0.36) * (0.62 + pL * 0.55);
        float pebMix = smoothstep(0.62, 0.9, texture2D(uHeight, uv * 1.7 + 8.0).r) * 0.55;
        vec3 under = grassG;
        under = mix(under, mossG, smoothstep(0.22, 0.58, mL) * 0.48);
        under = mix(under, dirtG, smoothstep(0.02, 0.22, sL - gL * 0.85) * 0.5);
        under = mix(under, stoneG, pebMix);
        float clump = sin(vWorld.x * 0.042) * cos(vWorld.z * 0.036);
        clump += sin(vWorld.x * 0.09 + 1.3) * sin(vWorld.z * 0.078 + 0.4) * 0.4;
        under = mix(under, vec3(0.48, 0.62, 0.22), smoothstep(0.08, 0.7, clump) * 0.26);
        under = mix(under, vec3(0.09, 0.24, 0.08), (1.0 - smoothstep(0.0, 0.55, abs(clump))) * 0.14);
        float n1 = holoHash(floor(vWorld.xz * 0.17));
        float n2 = holoHash(vWorld.xz * 0.11 + 4.2);
        float vein = 1.0 - smoothstep(0.0, 0.04, abs(n1 - 0.5));
        vein *= step(0.62, n2);
        float pulse = 0.55 + 0.45 * sin(uTime * 0.55 + n2 * 8.0);
        under += vec3(1.0, 0.74, 0.22) * vein * pulse * 0.55;
        under = grade(under, vColor);
        vec3 hcell = holoHex(vWorld.xz, 3.6);
        vec2 hid = hcell.xy;
        float hedge = hcell.z;
        float aa = max(fwidth(hedge), 0.0035);
        float seam = 1.0 - smoothstep(aa * 0.2, aa * 1.2, hedge);
        float bevel = smoothstep(aa, aa * 5.0, hedge) * (1.0 - smoothstep(aa * 5.0, 0.18, hedge));
        float fres = pow(1.0 - ny, 1.45);
        float grassW = clamp(smoothstep(0.04, 0.16, vColor.g - vColor.r), 0.0, 1.0);
        float dirtW = clamp(smoothstep(0.02, 0.12, vColor.r - vColor.g), 0.0, 1.0);
        float stoneW = clamp(pebMix, 0.0, 1.0);
        float waterW = smoothstep(1.22, 0.98, lakeD) * smoothstep(0.78, 0.98, lakeD);
        float speckle = sin(vWorld.x * 0.33 + 0.6) * sin(vWorld.z * 0.29 - 0.4);
        float litter = smoothstep(0.25, 0.82, speckle * 0.5 + 0.5) * 0.16;
        float litterAmt = mix(litter, 0.55, dirtW);
        litterAmt *= mix(1.0, 0.28, grassW);
        under = mix(under, mix(vec3(0.36, 0.30, 0.16), dirtG, 0.5), litterAmt);
        under = mix(under, stoneG, pebMix * 0.35);
        vec3 bias = vec3(1.0);
        bias = mix(bias, vec3(1.05, 1.06, 0.9), grassW * 0.22);
        bias = mix(bias, vec3(1.08, 0.92, 0.72), dirtW * 0.4);
        bias = mix(bias, vec3(0.9, 0.94, 1.02), stoneW * 0.35);
        bias = mix(bias, vec3(0.62, 0.98, 1.08), waterW * 0.7);
        under *= bias;
        under *= 0.97 + hit * 0.08;
        vec2 coarse = floor(hid / 2.2);
        float cluster = step(0.9, holoHash(coarse + 9.0));
        float member = step(holoHash(hid), 0.18 + holoHash(coarse) * 0.4);
        float failing = cluster * member;
        float sunk = failing * step(0.62, holoHash(hid + 5.0));
        float phase = fract(uTime * 0.16 + holoHash(hid) * 3.0);
        float dropout = failing * step(0.45, holoHash(hid + 2.0)) * smoothstep(0.0, 0.04, phase) * (1.0 - smoothstep(0.1, 0.18, phase));
        under *= mix(1.0, 0.58, failing * 0.85);
        under *= mix(1.0, 0.72, sunk);
        float drift = sin(vWorld.x * 0.016 + uTime * 0.02) * sin(vWorld.z * 0.013 - uTime * 0.015);
        float cloud = smoothstep(0.2, 0.8, drift * 0.5 + 0.5);
        under *= mix(1.0, 0.9, cloud * 0.35);
        vec3 col = under + vec3(0.78, 0.92, 0.88) * fres * bevel * 0.15;
        col = mix(col, vec3(0.02, 0.03, 0.04), dropout * 0.75);
        vec3 seamGold = vec3(0.910, 0.784, 0.467);
        vec3 seamAqua = vec3(0.624, 0.902, 0.878);
        float seamEdge = smoothstep(aa * 0.16, aa * 1.2, hedge);
        vec3 seamCol = mix(seamGold, seamAqua, seamEdge);
        float seamAmp = 0.55 + fres * 0.08;
        if (uSeam > 0.5 && uSeam < 1.5) {
          float crack = fract(sin(dot(hid + floor(vec2(uTime * 9.0, uTime * 6.0)), vec2(19.1, 73.4))) * 43758.5);
          float spark = step(0.78, fract(sin(dot(vWorld.xz * 2.0, vec2(12.9, 78.2)) + uTime * 16.0) * 43758.5));
          seamCol = vec3(1.0, 0.18, 0.58);
          seamAmp = 1.7 + smoothstep(0.2, 0.9, crack) * 1.5 + spark;
          col += vec3(1.0, 0.45, 0.75) * spark * seam * 0.65;
        } else if (uSeam > 1.5 && uSeam < 2.5) {
          float rip = 0.5 + 0.5 * sin(length(vWorld.xz - uOrigin) * 2.4 - uTime * 6.0);
          seamCol = vec3(0.25, 0.72, 1.0);
          seamAmp = 1.15 + rip * 1.35;
          col += seamCol * rip * seam * 0.35;
        } else if (uSeam > 2.5 && uSeam < 3.5) {
          float flick = 0.45 + 0.55 * sin(uTime * 16.0 + hid.x * 4.0);
          float ember = step(0.7, fract(sin(dot(vWorld.xz, vec2(4.2, 9.1)) + uTime * 11.0) * 43758.5));
          seamCol = vec3(1.0, 0.38, 0.08);
          seamAmp = 1.35 + flick + ember;
        } else if (uSeam > 3.5) {
          seamCol = vec3(0.4, 1.0, 0.5);
          seamAmp = 1.5 + fres * 0.6;
        }
        float patchN = sin(vWorld.x * 0.0105) * cos(vWorld.z * 0.0085);
        patchN += 0.55 * sin(vWorld.x * 0.022 + 1.4) * sin(vWorld.z * 0.018 + 0.6);
        float noiseKeep = smoothstep(-0.7, -0.12, patchN);
        float nearHome = 1.0 - smoothstep(6.0, 16.0, length(vWorld.xz - uHome));
        float nearAether = nearHome;
        nearAether = max(nearAether, 1.0 - smoothstep(4.0, 12.0, length(vWorld.xz - uAether[0])));
        nearAether = max(nearAether, 1.0 - smoothstep(4.0, 12.0, length(vWorld.xz - uAether[1])));
        nearAether = max(nearAether, 1.0 - smoothstep(4.0, 12.0, length(vWorld.xz - uAether[2])));
        float nearPlayer = 1.0 - smoothstep(2.0, 6.0, length(vWorld.xz - uPlayer));
        float playerPulse = 0.55 + 0.45 * sin(uTime * 1.25);
        float hot = clamp(max(dirtW, max(nearHome, max(nearAether, nearPlayer * playerPulse))), 0.0, 1.0);
        float keep = mix(noiseKeep, 1.0, hot);
        if (uSeam > 0.5) keep = 1.0;
        else seamAmp = mix(seamAmp, 0.74, hot);
        seam *= mix(0.42, 1.0, keep);
        col += vec3(0.0, 0.0, 0.0) * sunk * seam * 0.35;
        col *= mix(1.0, 0.45, sunk * seam);
        col = mix(col, seamCol, clamp(seam * seamAmp, 0.0, 0.7) * (1.0 - dropout));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  mesh.material = mat;
  groundHolo = mat;
}
function holoLevel() {
  try { return window.__aroHolo ? +window.__aroHolo() : 1; }
  catch (e) { return 1; }
}
function hash2(ix, iz) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm2(x, z) {
  return noise2(x, z) * 0.62 + noise2(x * 2.13 + 4.2, z * 2.13 + 1.7) * 0.38;
}
function nearKind(x, z, kind, rad) {
  return kindAt(x + rad, z) === kind || kindAt(x - rad, z) === kind || kindAt(x, z + rad) === kind || kindAt(x, z - rad) === kind;
}

function buildGround() {
  const { cols, rows, minx, minz, cell } = field;
  const vx = cols + 1, vz = rows + 1;
  const pos = new Float32Array(vx * vz * 3);
  const col = new Float32Array(vx * vz * 3);
  for (let r = 0; r < vz; r++) for (let c = 0; c < vx; c++) {
    const x = minx + c * cell;
    const z = minz + r * cell;
    const i = r * vx + c;
    const k = kindAt(x - cell * 0.01, z - cell * 0.01) ?? 0;
    const y = groundY(x, z);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const t = tint(k, x, z);
    col[i * 3] = t[0]; col[i * 3 + 1] = t[1]; col[i * 3 + 2] = t[2];
  }
  const idx = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * vx + c, b = a + 1, d = a + vx, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }));
  ground.frustumCulled = false;
  dressGround(ground);
  scene.add(ground);

  const wpos = [], wshore = [];
  const shoreOf = (c, r) => {
    let edge = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || grid[rr * cols + cc] !== 3) edge++;
    }
    return edge / 4;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r * cols + c] !== 3) continue;
    const x0 = minx + c * cell, z0 = minz + r * cell, y = -0.22;
    const s = shoreOf(c, r);
    wpos.push(
      x0, y, z0, x0 + cell, y, z0, x0, y, z0 + cell,
      x0 + cell, y, z0, x0 + cell, y, z0 + cell, x0, y, z0 + cell
    );
    wshore.push(s, s, s, s, s, s);
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wgeo.setAttribute('aShore', new THREE.Float32BufferAttribute(wshore, 1));
  wgeo.computeVertexNormals();
  waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uLake: { value: new THREE.Vector2(12, -1.6) },
      uRad: { value: 34 },
      uCam: { value: new THREE.Vector3() },
      uLift: { value: 0 },
      uCurveK: curveU.k,
      uCurveCam: curveU.cam,
    },
    vertexShader: `
      attribute float aShore;
      varying vec3 vW;
      varying float vShore;
      uniform float uTime;
      uniform float uCurveK;
      uniform vec3 uCurveCam;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float wave = sin(w.x * 0.42 + uTime * 1.3) * sin(w.z * 0.36 - uTime * 1.05);
        w.y += wave * 0.16 * (1.0 - aShore);
        w.y -= uCurveK * dot(w.xz - uCurveCam.xz, w.xz - uCurveCam.xz);
        vW = w.xyz;
        vShore = aShore;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec3 vW;
      varying float vShore;
      uniform float uTime;
      uniform vec2 uLake;
      uniform float uRad;
      uniform vec3 uCam;
      uniform float uLift;
      void main(){
        float rip = sin(vW.x * 0.55 + uTime * 1.35) * sin(vW.z * 0.48 - uTime * 0.95);
        vec3 deep = vec3(0.10, 0.48, 0.78);
        vec3 mid = vec3(0.20, 0.66, 0.86);
        vec3 shallow = vec3(0.55, 0.88, 0.82);
        float dist = length(vW.xz - uLake);
        float depth = 1.0 - smoothstep(2.0, uRad, dist);
        vec3 c = mix(shallow, mid, smoothstep(0.0, 0.4, depth));
        c = mix(c, deep, smoothstep(0.35, 1.0, depth));
        vec3 view = normalize(uCam - vW);
        float fres = pow(1.0 - clamp(abs(view.y), 0.0, 1.0), 1.6);
        c = mix(c, vec3(0.97, 0.86, 0.68), fres * 0.42 + rip * 0.08);
        float spark = pow(max(sin(vW.x * 0.85 + uTime * 0.8) * sin(vW.z * 0.7 - uTime * 0.55), 0.0), 3.0);
        c += vec3(1.0, 0.96, 0.88) * spark * 0.55;
        float cau = sin(vW.x * 0.32 + uTime * 0.55) * sin(vW.z * 0.27 - uTime * 0.4);
        cau += sin((vW.x + vW.z) * 0.48 - uTime * 0.65);
        float caust = smoothstep(0.25, 0.8, cau * 0.5 + 0.5);
        c += vec3(0.9, 1.0, 0.86) * caust * 0.7;
        c = mix(c, floor(c * 5.0) / 5.0, 0.45);
        float foam = smoothstep(0.25, 0.95, vShore);
        foam *= 0.55 + 0.45 * sin(vW.x * 1.6 + vW.z * 1.2 + uTime * 2.2);
        c = mix(c, vec3(0.93, 0.98, 1.0), clamp(foam, 0.0, 1.0) * 0.65);
        c = mix(c, c * vec3(1.2, 1.28, 1.22) + vec3(0.06, 0.1, 0.08), uLift);
        gl_FragColor = vec4(c, 0.96);
      }`,
  });
  water = new THREE.Mesh(wgeo, waterMat);
  water.frustumCulled = false;
  if (field.anchors && field.anchors.lake) {
    waterMat.uniforms.uLake.value.set(field.anchors.lake[0], field.anchors.lake[1]);
    waterMat.uniforms.uRad.value = 36;
  }
  scene.add(water);
}

function solid(geo) {
  return geo.index ? geo.toNonIndexed() : geo;
}
function shadeCanopy(geo, bottom, top) {
  geo = solid(geo);
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const c0 = new THREE.Color(bottom), c1 = new THREE.Color(top);
  const arr = new Float32Array(pos.count * 3);
  const span = (maxY - minY) || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    const n = 0.9 + 0.1 * Math.sin(pos.getX(i) * 8.0 + pos.getZ(i) * 6.5);
    arr[i * 3] = (c0.r + (c1.r - c0.r) * t) * n;
    arr[i * 3 + 1] = (c0.g + (c1.g - c0.g) * t) * n;
    arr[i * 3 + 2] = (c0.b + (c1.b - c0.b) * t) * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function paintGeo(geo, hex) {
  geo = solid(geo);
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function inflate(geo, amount) {
  const g = geo.clone();
  const pos = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * amount, pos.getY(i) + nrm.getY(i) * amount, pos.getZ(i) + nrm.getZ(i) * amount);
  }
  pos.needsUpdate = true;
  return g;
}
const SHELL_FRAG = `
  if (vShell > 0.62) discard;
  float keep = 1.0 - smoothstep(0.28, 0.62, vShell);
  float shellN = fract(sin(vScan * 91.7 + vShell * 17.0) * 43758.5);
  if (shellN > keep) discard;
  float farFade = smoothstep(0.25, 0.9, vShell) * (1.0 - smoothstep(0.75, 1.0, vShell));
  outgoingLight += vec3(0.45, 0.9, 1.0) * smoothstep(0.045, 0.0, abs(vScan - fract(uTime * 0.22))) * farFade * 0.05 * uHolo;
`;
function bindShell(mat, instanced) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    if (prev) prev(shader);
    shader.uniforms.uPlayer = shellU.uPlayer;
    shader.uniforms.uNear = shellU.uNear;
    shader.uniforms.uFar = shellU.uFar;
    shader.uniforms.uTime = shader.uniforms.uTime || shellU.uTime;
    shader.uniforms.uHolo = shellU.uHolo;
    mat.userData.shader = shader;
    const decl = 'uniform vec2 uPlayer; uniform float uNear; uniform float uFar; uniform float uHolo; varying float vShell; varying float vScan;\n';
    if (!shader.vertexShader.includes('varying float vShell')) {
      if (!instanced) shader.vertexShader = 'attribute vec2 aAnchor;\n' + shader.vertexShader;
      if (!shader.vertexShader.includes('uniform float uTime')) shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = decl + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 shellP = ${instanced ? 'vec2(instanceMatrix[3][0], instanceMatrix[3][2])' : 'aAnchor'};
        vShell = smoothstep(uNear, uFar, distance(shellP, uPlayer));
        vScan = fract(transformed.y * 1.5 + uTime * 0.4);`
      );
      shader.fragmentShader = 'uniform float uTime;\n' + decl + shader.fragmentShader.replace('#include <opaque_fragment>', SHELL_FRAG + '\n#include <opaque_fragment>');
    }
  };
  mat.needsUpdate = true;
}
function wireMat(instanced) {
  const vertInst = `
    uniform vec2 uPlayer; uniform float uNear, uFar, uTime;
    varying float vShell; varying float vScan;
    void main(){
      vec4 wp = instanceMatrix * vec4(position, 1.0);
      vShell = smoothstep(uNear, uFar, distance(wp.xz, uPlayer));
      vScan = fract(wp.y * 1.5 + uTime * 0.4);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const vertAnchor = `
    uniform vec2 uPlayer; uniform float uNear, uFar, uTime;
    attribute vec2 aAnchor;
    varying float vShell; varying float vScan;
    void main(){
      vShell = smoothstep(uNear, uFar, distance(aAnchor, uPlayer));
      vScan = fract(position.y * 1.5 + uTime * 0.4);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  return new THREE.ShaderMaterial({
    wireframe: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPlayer: shellU.uPlayer,
      uNear: shellU.uNear,
      uFar: shellU.uFar,
      uTime: shellU.uTime,
      uHolo: shellU.uHolo,
    },
    vertexShader: instanced ? vertInst : vertAnchor,
    fragmentShader: `
      precision mediump float;
      uniform float uHolo;
      varying float vShell; varying float vScan;
      void main(){
        if (vShell < 0.5) discard;
        float scan = smoothstep(0.035, 0.0, abs(vScan - 0.5));
        if (scan < 0.3 && fract(vScan * 5.0) > 0.1) discard;
        float fog = smoothstep(0.45, 0.7, vShell) * (1.0 - smoothstep(0.72, 1.0, vShell));
        float a = fog * (0.018 + scan * 0.03) * uHolo;
        gl_FragColor = vec4(vec3(0.55, 0.86, 1.0), a);
      }`,
  });
}
function syncShells() {
  shellU.uPlayer.value.set(px, pz);
  shellU.uTime.value = worldT;
  shellU.uHolo.value = holoLevel() * 0.28;
  const low = window.innerWidth < 700 || holoLevel() < 0.5;
  shellU.uNear.value = low ? 46 : 62;
  shellU.uFar.value = low ? 90 : 130;
}
function instanced(geo, spots, scaleOf, shell) {
  if (!spots.length) return null;
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.x += sin(uTime * 1.15 + transformed.y) * transformed.y * 0.02;\ntransformed.z += cos(uTime * 0.9) * transformed.y * 0.012;'
    );
  };
  if (shell) bindShell(mat, true);
  bendMat(mat);
  windMats.push(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x1a140e, side: THREE.BackSide });
  if (shell) bindShell(inkMat, true);
  bendMat(inkMat);
  const ink = new THREE.InstancedMesh(inflate(geo, 0.045), inkMat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((p, i) => {
    const s = scaleOf(i, p);
    dummy.position.set(p[0], groundY(p[0], p[1]), p[1]);
    dummy.rotation.y = (i * 1.7) % (Math.PI * 2);
    dummy.scale.set(s, s * (0.85 + (i % 5) * 0.06), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    ink.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  ink.instanceMatrix.needsUpdate = true;
  scene.add(ink, mesh);
  if (shell) {
    const wire = new THREE.InstancedMesh(geo, wireMat(true), spots.length);
    wire.instanceMatrix.copy(mesh.instanceMatrix);
    wire.frustumCulled = false;
    scene.add(wire);
  }
  return mesh;
}
function buildDressing() {
  const trunk = paintGeo(new THREE.CylinderGeometry(0.18, 0.32, 1.7, 6), '#6d4a32');
  trunk.translate(0, 0.85, 0);
  const puffA = shadeCanopy(new THREE.IcosahedronGeometry(1.25, 1), '#1f6b34', '#8ed56a');
  puffA.translate(0, 2.35, 0);
  const puffB = shadeCanopy(new THREE.IcosahedronGeometry(0.85, 1), '#2f8a44', '#d7f0a0');
  puffB.translate(0.7, 2.85, 0.25);
  const puffC = shadeCanopy(new THREE.IcosahedronGeometry(0.78, 1), '#174f28', '#5aaa48');
  puffC.translate(-0.62, 2.55, -0.28);
  const puffD = shadeCanopy(new THREE.IcosahedronGeometry(0.55, 0), '#3c9a48', '#e7f6b4');
  puffD.translate(0.15, 3.35, -0.1);
  const puffE = shadeCanopy(new THREE.IcosahedronGeometry(0.48, 0), '#67c45a', '#f4ffe0');
  puffE.translate(-0.2, 2.15, 0.55);
  const broad = mergeGeometries([trunk, puffA, puffB, puffC, puffD, puffE]);
  const pineTrunk = paintGeo(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 5), '#5c4030');
  pineTrunk.translate(0, 0.7, 0);
  const p1 = paintGeo(new THREE.ConeGeometry(1.05, 1.35, 7), '#2f8a44');
  p1.translate(0, 1.7, 0);
  const p2 = paintGeo(new THREE.ConeGeometry(0.78, 1.15, 7), '#67c45a');
  p2.translate(0, 2.45, 0);
  const p3 = paintGeo(new THREE.IcosahedronGeometry(0.36, 0), '#d7f0a4');
  p3.translate(0, 3.05, 0);
  const pine = mergeGeometries([pineTrunk, p1, p2, p3]);
  const bushA = paintGeo(new THREE.IcosahedronGeometry(0.55, 0), '#4aaa58');
  bushA.scale(1.35, 0.72, 1.15);
  bushA.translate(0, 0.38, 0);
  const bushB = paintGeo(new THREE.IcosahedronGeometry(0.36, 0), '#d5ee86');
  bushB.translate(0.32, 0.48, 0.08);
  const bush = mergeGeometries([bushA, bushB]);
  const rock = paintGeo(new THREE.DodecahedronGeometry(0.42, 0), '#c2b4a2');
  rock.scale(1.35, 0.62, 1.05);
  const home = field.anchors.home;
  const broadSpots = [], pineSpots = [], bushSpots = [], rockSpots = [], flowerSpots = [];
  for (let i = 0; i < grid.length; i += 5) {
    const k = grid[i];
    if (k === 3 || k === 4) continue;
    const c = i % field.cols, r = (i / field.cols) | 0;
    const x = field.minx + (c + 0.5) * field.cell;
    const z = field.minz + (r + 0.5) * field.cell;
    if (kindAt(x, z) === 3 || kindAt(x, z) === 4) continue;
    const dh = Math.hypot(x - home[0], z - home[1]);
    if (nearPeople(x, z)) continue;
    const pick = (i * 13) % 17;
    if ((k === 1 || k === 2 || (k === 0 && dh < 180 && pick < 4)) && broadSpots.length < 42 && pick % 2 === 0) broadSpots.push([x, z]);
    else if ((k === 1 || k === 0) && pineSpots.length < 28 && pick % 3 === 1) pineSpots.push([x, z]);
    else if (bushSpots.length < 36 && pick % 4 === 2 && dh < 220) bushSpots.push([x, z]);
    else if (rockSpots.length < 22 && pick % 5 === 3 && dh < 200) rockSpots.push([x, z]);
    else if (flowerSpots.length < 48 && k !== 5 && dh > 8 && dh < 80) flowerSpots.push([x, z, (i % 3)]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = home[0] + Math.cos(a) * (18 + (i % 3) * 6);
    const z = home[1] + Math.sin(a) * (18 + (i % 3) * 6);
    if (kindAt(x, z) === 3 || kindAt(x, z) === 4) continue;
    if (nearPeople(x, z)) continue;
    (i % 2 ? pineSpots : broadSpots).push([x, z]);
  }
  instanced(broad, broadSpots, (i) => 1.15 + (i % 4) * 0.12, true);
  instanced(pine, pineSpots, (i) => 1.05 + (i % 3) * 0.1, true);
  instanced(bush, bushSpots, () => 1);
  instanced(rock, rockSpots, (i) => 0.7 + (i % 4) * 0.25);
  shadowField(broadSpots.concat(pineSpots), 2.1);
  shadowField(rockSpots, 0.85);
  const petal = new THREE.PlaneGeometry(0.22, 0.22);
  petal.translate(0, 0.2, 0);
  const colors = [new THREE.Color('#ff8fb8'), new THREE.Color('#ffe27a'), new THREE.Color('#f4fbff')];
  if (flowerSpots.length) {
    const flowers = new THREE.InstancedMesh(petal, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false }), flowerSpots.length);
    const dummy = new THREE.Object3D();
    flowerSpots.forEach((p, i) => {
      dummy.position.set(p[0], groundY(p[0], p[1]) + 0.05, p[1]);
      dummy.rotation.y = i;
      dummy.scale.setScalar(0.8 + (i % 3) * 0.25);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, colors[p[2]]);
    });
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    scene.add(flowers);
  }
  buildTileGrass(broadSpots.concat(pineSpots));
}
function archBlade() {
  const steps = 4;
  const pos = [];
  const uv = [];
  const idx = [];
  const h = 0.16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const width = 0.12 * (1.0 - t * 0.62);
    const y = h * t;
    const z = t * t * 0.035;
    pos.push(-width, y, z, width, y, z);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
function facetChunk(w, h, d, seed) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = g.attributes.position;
  let s = (seed * 19 + 5) | 0;
  const rnd = () => { s = (Math.imul(s, 16807) + 1) % 2147483647; return (s % 1000) / 1000; };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const corners = (Math.abs(x) > w * 0.3 ? 1 : 0) + (Math.abs(y) > h * 0.3 ? 1 : 0) + (Math.abs(z) > d * 0.3 ? 1 : 0);
    if (corners >= 2) pos.setXYZ(i, x * 0.8, y * 0.86, z * 0.8);
  }
  const nx = rnd() * 2 - 1, ny = rnd() * 0.35, nz = rnd() * 2 - 1;
  const len = Math.hypot(nx, ny, nz) || 1;
  const pxn = nx / len, pyn = ny / len, pzn = nz / len;
  const dist = (0.22 + rnd() * 0.2) * Math.max(w, h, d);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const side = x * pxn + y * pyn + z * pzn - dist;
    if (side > 0) pos.setXYZ(i, x - pxn * side, y - pyn * side, z - pzn * side);
  }
  g.computeVertexNormals();
  return g;
}
function rockCluster(n, spread, rad, moss) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const g = facetChunk(rad * (1.5 + (i % 3) * 0.35), rad * (0.9 + (i % 2) * 0.4), rad * 1.35, i + n * 3);
    g.translate((i - (n - 1) / 2) * spread, rad * 0.15, ((i * 3) % 5 - 2) * spread * 0.35);
    g.rotateY(i * 0.7);
    if (i === 0 && n > 2) g.rotateZ(0.35);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const top = moss && y > rad * 0.7;
    const grit = 0.94 + 0.06 * Math.sin(p.getX(i) * 9 + p.getZ(i) * 7);
    const warm = p.getX(i) > 0 ? 0.06 : 0;
    const c = top ? [0.36, 0.42, 0.32] : [0.52 + warm, 0.48, 0.58];
    col[i * 3] = c[0] * grit;
    col[i * 3 + 1] = c[1] * grit;
    col[i * 3 + 2] = c[2] * grit;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
function makeInst(geo, mat, max) {
  const g = geo.clone();
  const mesh = new THREE.InstancedMesh(g, mat, max);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const seeds = new Float32Array(max);
  for (let i = 0; i < max; i++) seeds[i] = (i * 0.173) % 1;
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  if (mat.userData.fade) {
    g.setAttribute('aFade', new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1));
  }
  scene.add(mesh);
  return mesh;
}
function buildTileGrass(trees) {
  const bladeMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCurveK: curveU.k, uCurveCam: curveU.cam },
    vertexShader: `
      attribute float aSeed; attribute float aFade;
      uniform float uTime; uniform float uCurveK; uniform vec3 uCurveCam;
      varying float vH; varying float vHue; varying float vFade; varying float vEdge;
      void main(){
        vH = clamp(uv.y, 0.0, 1.0);
        vEdge = abs(uv.x - 0.5) * 2.0;
        vHue = aSeed; vFade = aFade;
        vec3 p = position;
        float sway = sin(uTime * 1.15 + aSeed * 6.2) * 0.045 * vH;
        p.x += sway;
        p.z += cos(uTime * 0.85 + aSeed * 4.0) * 0.022 * vH;
        vec4 w = instanceMatrix * vec4(p, 1.0);
        w.y -= uCurveK * dot(w.xz - uCurveCam.xz, w.xz - uCurveCam.xz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision highp float; varying float vH; varying float vHue; varying float vFade; varying float vEdge;
      uniform float uTime;
      void main(){
        vec3 deep = vec3(0.12, 0.32, 0.09);
        vec3 mid = vec3(0.34, 0.58, 0.18);
        vec3 sun = vec3(0.78, 0.84, 0.30);
        vec3 c = mix(deep, mid, smoothstep(0.0, 0.5, vH));
        c = mix(c, sun, smoothstep(0.4, 1.0, vH));
        c = mix(c, deep, smoothstep(0.42, 1.0, vEdge) * 0.55);
        float warm = (vHue - 0.5) * 0.035;
        c.r += warm;
        c.g += warm * 0.45;
        float scan = smoothstep(0.0, 0.12, abs(fract(vH * 5.0 - uTime * 1.4) - 0.5));
        if (vFade < 0.97 && scan > vFade) discard;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  bladeMat.userData.fade = true;
  const softMat = (kind) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uCurveK: curveU.k, uCurveCam: curveU.cam },
    vertexShader: 'varying vec2 vUv; uniform float uCurveK; uniform vec3 uCurveCam; void main(){ vUv=uv; vec4 w=instanceMatrix*vec4(position,1.0); w.y-=uCurveK*dot(w.xz-uCurveCam.xz,w.xz-uCurveCam.xz); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision mediump float; varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 q = vUv - 0.5;
        float r = length(q) * 2.0;
        float edge = 1.0 - smoothstep(0.2, 0.98, r);
        if (edge < 0.02) discard;
        float n = 0.5 + 0.5 * sin(q.x * 9.0 + q.y * 5.0) * sin(q.y * 7.0 - q.x * 3.0);
        vec3 c = ${kind === 'dirt'
          ? 'mix(vec3(0.46, 0.32, 0.16), vec3(0.30, 0.20, 0.10), n)'
          : 'mix(mix(vec3(0.34, 0.58, 0.18), vec3(0.78, 0.84, 0.28), smoothstep(0.35, 0.85, n)), vec3(0.12, 0.32, 0.09), smoothstep(0.45, 0.98, r))'};
        gl_FragColor = vec4(c, edge * ${kind === 'dirt' ? '0.5' : '0.34'});
      }`,
  });
  const discMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCurveK: curveU.k, uCurveCam: curveU.cam },
    vertexShader: 'varying vec2 vUv; uniform float uCurveK; uniform vec3 uCurveCam; void main(){ vUv=uv; vec4 w=instanceMatrix*vec4(position,1.0); w.y-=uCurveK*dot(w.xz-uCurveCam.xz,w.xz-uCurveCam.xz); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision mediump float; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.45, 1.0, r)) * 0.95;
        if (a < 0.03) discard;
        vec3 c = mix(vec3(0.12, 0.30, 0.09), vec3(0.40, 0.62, 0.20), smoothstep(0.0, 0.85, r));
        gl_FragColor = vec4(c, a);
      }`,
  });
  const hexMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCurveK: curveU.k, uCurveCam: curveU.cam },
    vertexShader: 'varying vec2 vUv; uniform float uCurveK; uniform vec3 uCurveCam; void main(){ vUv=uv; vec4 w=instanceMatrix*vec4(position,1.0); w.y-=uCurveK*dot(w.xz-uCurveCam.xz,w.xz-uCurveCam.xz); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform float uTime;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        if (r < 0.78 || r > 1.0) discard;
        float scan = 0.55 + 0.45 * sin(vUv.y * 36.0 + uTime * 1.6);
        gl_FragColor = vec4(0.55, 0.92, 1.0, 0.14 * scan);
      }`,
  });
  const rockMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector2() }, uCurveK: curveU.k, uCurveCam: curveU.cam },
    vertexShader: `
      attribute vec3 color; attribute float aSeed;
      uniform float uCurveK; uniform vec3 uCurveCam;
      varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vSeed;
      void main(){
        vC = color; vSeed = aSeed;
        vec4 w = instanceMatrix * vec4(position, 1.0);
        w.y -= uCurveK * dot(w.xz - uCurveCam.xz, w.xz - uCurveCam.xz);
        vW = w.xyz;
        vN = normalize(mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision mediump float;
      uniform float uTime; uniform vec2 uPlayer;
      varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vSeed;
      void main(){
        vec3 L = normalize(vec3(0.35, 0.92, 0.22));
        float ndl = dot(normalize(vN), L);
        float band = ndl < 0.12 ? 0.34 : ndl < 0.48 ? 0.58 : 1.0;
        vec3 col = vC * band;
        float grit = fract(sin(dot(vW.xz, vec2(19.1, 73.4)) + vSeed * 9.0) * 43758.5);
        col *= 0.88 + grit * 0.2;
        float fleck = step(0.95, fract(sin(dot(floor(vW.xz * 11.0), vec2(12.9, 78.2))) * 43758.5));
        col = mix(col, vec3(0.2, 0.13, 0.08), fleck * 0.5);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);
        float dist = distance(vW.xz, uPlayer);
        float farH = smoothstep(8.0, 28.0, dist);
        col += mix(vec3(0.4, 0.92, 1.0), vec3(1.0, 0.78, 0.35), step(0.55, fract(vSeed * 7.0))) * fres * (0.05 + farH * 0.1);
        float holo = step(0.833, fract(vSeed * 6.0));
        float crack = 1.0 - smoothstep(0.0, 0.035, abs(fract(vW.y * 2.2 + vSeed * 3.0) - 0.5));
        col += mix(vec3(0.91, 0.78, 0.47), vec3(0.62, 0.90, 0.88), fract(vSeed * 3.0)) * crack * holo * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const BLADE_MAX = 5200;
  const PAD_MAX = 700;
  const DECAL_MAX = 900;
  const HEX_MAX = 700;
  const DIRT_MAX = 500;
  const PEB_MAX = 420;
  const ROCK_MAX = 180;
  const BOLD_MAX = 70;
  const FLOWER_MAX = 280;
  grassMesh = makeInst(archBlade(), bladeMat, BLADE_MAX);
  const discGeo = new THREE.CircleGeometry(1, 10);
  discGeo.rotateX(-Math.PI / 2);
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.rotateX(-Math.PI / 2);
  const hexGeo = new THREE.CircleGeometry(1, 6);
  hexGeo.rotateX(-Math.PI / 2);
  const flower = new THREE.SphereGeometry(0.035, 5, 4);
  const pads = makeInst(discGeo, discMat, PAD_MAX);
  const decals = makeInst(plane, softMat('moss'), DECAL_MAX);
  const hexes = makeInst(hexGeo, hexMat, HEX_MAX);
  const dirts = makeInst(plane.clone(), softMat('dirt'), DIRT_MAX);
  const pebbles = makeInst(rockCluster(5, 0.07, 0.045, false), rockMat, PEB_MAX);
  const rocks = makeInst(rockCluster(2, 0.16, 0.14, false), rockMat, ROCK_MAX);
  const boulders = makeInst(rockCluster(3, 0.28, 0.34, true), rockMat, BOLD_MAX);
  const blooms = makeInst(flower, new THREE.MeshBasicMaterial({ color: 0xf0d060 }), FLOWER_MAX);
  grassMesh.userData.kit = {
    mats: [bladeMat, discMat, decals.material, hexMat, dirts.material, rockMat],
    player: rockMat.uniforms.uPlayer,
    pads, decals, hexes, dirts, pebbles, rocks, boulders, blooms,
    caps: { blades: BLADE_MAX, pads: PAD_MAX, decals: DECAL_MAX, hexes: HEX_MAX, dirts: DIRT_MAX, pebbles: PEB_MAX, rocks: ROCK_MAX, boulders: BOLD_MAX, blooms: FLOWER_MAX },
  };
  plantGrass(trees || []);
}
function nearPeople(x, z) {
  const home = field.anchors.home;
  if (Math.hypot(x - home[0], z - home[1]) < 18) return true;
  if (Math.hypot(x - px, z - pz) < 12) return true;
  for (const s of npcSpots) {
    if (Math.hypot(x - s[0], z - s[1]) < 12) return true;
  }
  return false;
}
function grassBudget() {
  let n = 4200;
  try {
    if (window.__aroGrass) n = window.__aroGrass() | 0;
  } catch (e) { /* keep the desktop count */ }
  return Math.max(600, Math.min(5200, n));
}
function grassLod() {
  const budget = grassBudget();
  if (budget < 1600) return 16;
  if (budget < 2800) return 22;
  return 28;
}
function plantGrass(trees) {
  const TILE = 2.7;
  const minx = field.minx, minz = field.minz;
  const maxX = minx + field.cols * field.cell;
  const maxZ = minz + field.rows * field.cell;
  const home = field.anchors.home;
  const list = [];
  const ix0 = Math.floor(minx / TILE) - 1;
  const ix1 = Math.ceil(maxX / TILE) + 1;
  const iz0 = Math.floor(minz / TILE) - 1;
  const iz1 = Math.ceil(maxZ / TILE) + 1;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = (ix + 0.5) * TILE;
      const z = (iz + 0.5) * TILE;
      if (x < minx || z < minz || x > maxX || z > maxZ) continue;
      const k = kindAt(x, z);
      if (k == null || k === 3 || k === 4 || k === 5) continue;
      if (Math.hypot(x - home[0], z - home[1]) < 15) continue;
      const h = hash2(ix * 3 + 11, iz * 5 + 7);
      const nb = hash2((ix - 1) * 3 + 11, iz * 5 + 7);
      const nd = hash2(ix * 3 + 11, (iz - 1) * 5 + 7);
      let roll = h;
      if (nb < 0.2 || nd < 0.2) roll *= 0.66;
      const shore = nearKind(x, z, 3, 5.5);
      const path = nearKind(x, z, 4, 4.6);
      const park = k === 1 || k === 2;
      let g = 0;
      let r = 0;
      if (shore) {
        if (h < 0.55) g = 4;
        if (h > 0.22 && h < 0.8) r = 1;
        if (h < 0.38) r = 4;
      } else if (path) {
        if (h < 0.62) r = 4;
        else if (h < 0.86) r = 1;
        if (h < 0.14) g = 1;
      } else {
        const gate = park ? 0.9 : 0.75;
        if (roll < 0.03) g = 3;
        else if (roll < 0.13) g = 2;
        else if (roll < gate) g = 1;
        if (park && h > 0.972) r = 3;
        else if (h > 0.9 && h < 0.945) r = 2;
        else if (h > 0.78 && h < 0.86) r = 1;
      }
      if (!g && !r) continue;
      list.push(x, z, g, r, h);
    }
  }
  for (let i = 0; i < (trees ? trees.length : 0); i++) {
    const x = trees[i][0] + 0.9, z = trees[i][1] + 0.35;
    const k = kindAt(x, z);
    if (k == null || k === 3 || k === 4 || k === 5) continue;
    if (Math.hypot(x - home[0], z - home[1]) < 15) continue;
    list.push(x, z, 1, 4, hash2(i + 4, i * 9 + 2));
  }
  grassStore = { data: new Float32Array(list), count: list.length / 5 };
  cullGrass(true);
}
function placeInst(mesh, i, x, y, z, yaw, sx, sy, sz) {
  const dummy = placeInst.dummy || (placeInst.dummy = new THREE.Object3D());
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, yaw, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
function cullGrass(force) {
  if (!grassMesh || !grassStore) return;
  const key = ((px * 2) | 0) + ',' + ((pz * 2) | 0) + ':' + grassBudget();
  if (!force && grassMesh.userData.key === key) return;
  grassMesh.userData.key = key;
  const rad = grassLod();
  const rad2 = rad * rad;
  const { data, count } = grassStore;
  const kit = grassMesh.userData.kit;
  const caps = kit.caps;
  const n = { blades: 0, pads: 0, decals: 0, hexes: 0, dirts: 0, pebbles: 0, rocks: 0, boulders: 0, blooms: 0 };
  const fadeAttr = grassMesh.geometry.getAttribute('aFade');
  const seedOf = (mesh, i, s) => {
    const a = mesh.geometry.getAttribute('aSeed');
    if (a) a.setX(i, s);
  };
  for (let i = 0; i < count; i++) {
    const x = data[i * 5], z = data[i * 5 + 1], g = data[i * 5 + 2], rk = data[i * 5 + 3], h = data[i * 5 + 4];
    const dx = x - px, dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 > rad2 && rk < 3) continue;
    if (rk === 3 && d2 > 52 * 52) continue;
    const d = Math.sqrt(d2);
    const y = groundY(x, z);
    const solid = d < 8 ? 1 : d > 16 ? 0 : (16 - d) / 8;
    const yaw = h * Math.PI * 2;
    if ((g === 1 || g === 2 || g === 3) && d < 24 && n.decals < caps.decals) {
      placeInst(kit.decals, n.decals, x, y + 0.025, z, yaw, 1.35 + h * 0.25, 1, 1.25 + (1 - h) * 0.2);
      seedOf(kit.decals, n.decals, h);
      n.decals++;
    }
    if (false && d > 10 && d < 32 && (g > 0) && n.hexes < caps.hexes) {
      const hs = 0.35 + Math.min(1, (d - 10) / 10);
      placeInst(kit.hexes, n.hexes, x, y + 0.04, z, yaw * 0.2, 1.15 * hs, 1, 1.15 * hs);
      n.hexes++;
    }
    if (solid > 0.04 && (g === 2 || g === 3 || g === 4)) {
      const clump = g === 3;
      const reed = g === 4;
      const blades = clump ? 14 : reed ? 6 : 10;
      const spread = clump ? 0.16 : reed ? 0.07 : 0.1;
      if (n.pads < caps.pads && !reed) {
        const pr = clump ? 0.42 : 0.28;
        placeInst(kit.pads, n.pads, x, y + 0.02, z, yaw, pr, 1, pr);
        n.pads++;
      }
      for (let b = 0; b < blades && n.blades < caps.blades; b++) {
        const a = yaw + (b / blades) * Math.PI * 2;
        const rr = spread * (0.35 + ((b * 5 + i) % 7) / 10);
        const bx = x + Math.cos(a) * rr;
        const bz = z + Math.sin(a) * rr;
        const tall = (reed ? 1.9 : 1.05 + h * 0.25) * (0.92 + ((b * 3) % 5) * 0.04);
        const wide = (clump ? 1.35 : 1.2) * (0.92 + ((b + i) % 4) * 0.06);
        placeInst(grassMesh, n.blades, bx, y, bz, a, wide * solid, tall * solid, wide * solid);
        if (fadeAttr) fadeAttr.setX(n.blades, solid);
        seedOf(grassMesh, n.blades, (h + b * 0.07) % 1);
        n.blades++;
      }
      if (clump) {
        for (let f = 0; f < 3 && n.blooms < caps.blooms; f++) {
          const a = yaw + f * 2.1;
          placeInst(kit.blooms, n.blooms, x + Math.cos(a) * 0.12, y + 0.1, z + Math.sin(a) * 0.12, a, solid, solid, solid);
          n.blooms++;
        }
      }
    }
    if (rk === 4 && d < 26 && n.dirts < caps.dirts) {
      placeInst(kit.dirts, n.dirts, x, y + 0.03, z, yaw, 2.0 + h, 1, 1.7 + h * 0.6);
      n.dirts++;
    } else if (rk === 1 && d < 18 && n.pebbles < caps.pebbles) {
      const s = 1.6 + h * 0.9;
      placeInst(kit.pebbles, n.pebbles, x, y, z, yaw, s, s * (0.8 + h * 0.3), s);
      seedOf(kit.pebbles, n.pebbles, h);
      n.pebbles++;
    } else if (rk === 2 && d < 32 && n.rocks < caps.rocks) {
      const s = 1.5 + h * 0.9;
      placeInst(kit.rocks, n.rocks, x, y, z, yaw, s, s * 0.85, s * (0.9 + h * 0.2));
      seedOf(kit.rocks, n.rocks, h);
      n.rocks++;
    } else if (rk === 3 && d < 50 && n.boulders < caps.boulders) {
      const s = 1.1 + h * 0.9;
      placeInst(kit.boulders, n.boulders, x, y, z, yaw, s, s * 0.8, s);
      seedOf(kit.boulders, n.boulders, h);
      n.boulders++;
    }
  }
  const pairs = [
    [grassMesh, n.blades, true],
    [kit.pads, n.pads, false],
    [kit.decals, n.decals, true],
    [kit.hexes, n.hexes, false],
    [kit.dirts, n.dirts, false],
    [kit.pebbles, n.pebbles, true],
    [kit.rocks, n.rocks, true],
    [kit.boulders, n.boulders, true],
    [kit.blooms, n.blooms, false],
  ];
  for (const [mesh, c, seeded] of pairs) {
    mesh.count = c;
    mesh.instanceMatrix.needsUpdate = true;
    if (seeded) {
      const a = mesh.geometry.getAttribute('aSeed');
      if (a) a.needsUpdate = true;
    }
  }
  if (fadeAttr) fadeAttr.needsUpdate = true;
}
function nearestDetail(wantRock) {
  if (!grassStore) return null;
  const { data, count } = grassStore;
  let best = null;
  let bestD = 1e9;
  for (let i = 0; i < count; i++) {
    const g = data[i * 5 + 2];
    const r = data[i * 5 + 3];
    const ok = wantRock ? (r === 1 || r === 2 || r === 3) : (g === 2 || g === 3);
    if (!ok) continue;
    const x = data[i * 5], z = data[i * 5 + 1];
    const d = Math.hypot(x - px, z - pz);
    if (d < bestD) { bestD = d; best = [x, z, g, r]; }
  }
  return best;
}
function glowSprite(inner, mid) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, mid);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
let shadowDisc = null;
function shadowGeo() {
  if (shadowDisc) return shadowDisc;
  shadowDisc = new THREE.CircleGeometry(1, 20);
  shadowDisc.rotateX(-Math.PI / 2);
  return shadowDisc;
}
function shadowMaterial(cast, instanced) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uSun: sunXZ, uCurveK: curveU.k, uCurveCam: curveU.cam },
    vertexShader: `
      uniform vec2 uSun;
      uniform float uCurveK;
      uniform vec3 uCurveCam;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        ${cast ? `vec2 sunN = normalize(uSun); vec2 sideN = vec2(-sunN.y, sunN.x);
        float along = dot(p.xz, sunN); float across = dot(p.xz, sideN);
        p.xz = sunN * along * 1.25 + sideN * across * 0.55 + sunN * 1.65;` : ''}
        vec4 w = ${instanced ? 'instanceMatrix' : 'modelMatrix'} * vec4(p, 1.0);
        w.y -= uCurveK * dot(w.xz - uCurveCam.xz, w.xz - uCurveCam.xz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(${cast ? '0.28, 0.62' : '0.34, 0.58'}, r);
        if (a < 0.02) discard;
        gl_FragColor = vec4(0.02, 0.05, 0.02, a * ${cast ? '0.72' : '0.88'});
      }`,
  });
}
const shadowMatContact = shadowMaterial(false, false);
const shadowMatCast = shadowMaterial(true, false);
function addActorShadow(rad) {
  const contact = new THREE.Mesh(shadowGeo(), shadowMatContact);
  const cast = new THREE.Mesh(shadowGeo(), shadowMatCast);
  contact.scale.setScalar(rad);
  cast.scale.setScalar(rad * 1.25);
  contact.frustumCulled = cast.frustumCulled = false;
  scene.add(contact, cast);
  const pair = { contact, cast };
  shadowPairs.push(pair);
  return pair;
}
function parkShadow(pair, x, z, show) {
  if (!pair) return;
  const y = groundY(x, z) + 0.14;
  pair.contact.visible = pair.cast.visible = !!show;
  if (!show) return;
  pair.contact.position.set(x, y, z);
  pair.cast.position.set(x, y, z);
}
function shadowField(spots, rad) {
  if (!spots.length) return;
  const geo = shadowGeo();
  const contact = new THREE.InstancedMesh(geo, shadowMaterial(false, true), spots.length);
  const cast = new THREE.InstancedMesh(geo, shadowMaterial(true, true), spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((p, i) => {
    const y = groundY(p[0], p[1]) + 0.05;
    dummy.position.set(p[0], y, p[1]);
    dummy.rotation.y = 0;
    dummy.scale.setScalar(rad * (0.85 + (i % 4) * 0.08));
    dummy.updateMatrix();
    contact.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(rad * 1.35);
    dummy.updateMatrix();
    cast.setMatrixAt(i, dummy.matrix);
  });
  contact.instanceMatrix.needsUpdate = true;
  cast.instanceMatrix.needsUpdate = true;
  contact.frustumCulled = cast.frustumCulled = false;
  scene.add(contact, cast);
}
function makeAetherMark(scale, label) {
  const g = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const aqua = new THREE.MeshBasicMaterial({ color: 0x9eefff });
  const shard = new THREE.OctahedronGeometry(0.42, 0);
  const main = new THREE.Mesh(shard, gold);
  main.scale.set(0.72 * scale, 2.05 * scale, 0.72 * scale);
  main.position.y = 1.25 * scale;
  const left = new THREE.Mesh(shard, aqua);
  left.scale.set(0.38 * scale, 1.05 * scale, 0.38 * scale);
  left.position.set(0.55 * scale, 0.62 * scale, 0.18 * scale);
  left.rotation.z = 0.42;
  const right = new THREE.Mesh(shard, gold);
  right.scale.set(0.3 * scale, 0.78 * scale, 0.3 * scale);
  right.position.set(-0.46 * scale, 0.42 * scale, -0.12 * scale);
  right.rotation.z = -0.55;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.35 * scale, 2.05 * scale, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(2.35 * scale, 28),
    new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.05;
  const light = new THREE.PointLight(0xffe08a, 1.6, 16 * Math.max(1, scale));
  light.position.y = 1.5 * scale;
  g.add(main, left, right, ring, pool, light);
  if (label) {
    const lab = labelSprite(label, '#ffe7a0', [1.5, 0.32]);
    lab.position.y = 2.7 * scale;
    g.add(lab);
  }
  g.userData.ring = ring;
  g.userData.pool = pool;
  g.userData.base = scale;
  return g;
}
function placeAetherMark(x, z, scale, label) {
  const spot = nearestWalkable(x, z);
  const g = makeAetherMark(scale, label);
  g.position.set(spot[0], groundY(spot[0], spot[1]), spot[1]);
  scene.add(g);
  aetherMarks.push(g);
  return g;
}
function fightOverlook() {
  const home = field.anchors.home;
  const lake = field.anchors.lake;
  let best = nearestWalkable(home[0] + 40, home[1] - 24);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const s = nearestWalkable(home[0] + Math.cos(a) * 34, home[1] + Math.sin(a) * 34);
    const k = kindAt(s[0], s[1]);
    if (k == null || k === 3 || k === 4) continue;
    const yaw = Math.atan2(s[0] - home[0], s[1] - home[1]);
    const ax = s[0] + Math.sin(yaw) * 9;
    const az = s[1] + Math.cos(yaw) * 9;
    if (kindAt(ax, az) === 3) continue;
    if (Math.hypot(ax - lake[0], az - lake[1]) < 46) continue;
    best = s;
    break;
  }
  return best;
}
function ensureFightBeast() {
  if (fightBeast) return;
  const g = new THREE.Group();
  const gel = toonMat('#2f9e96');
  const gelDeep = toonMat('#146e68');
  const belly = toonMat('#b7efe4');
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), gel);
  body.scale.set(1.15, 1.35, 1.05);
  body.position.y = 1.15;
  const puddle = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10), gelDeep);
  puddle.scale.set(1.2, 0.42, 1.1);
  puddle.position.y = 0.38;
  const tum = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), belly);
  tum.scale.set(0.9, 1.15, 0.55);
  tum.position.set(0, 1.05, 0.48);
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xf7fbff });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x142028 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeW);
  eyeL.position.set(-0.22, 1.45, 0.62);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.22;
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), pupil);
  pL.position.set(-0.22, 1.46, 0.74);
  const pR = pL.clone();
  pR.position.x = 0.22;
  const crown = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffe08a : 0x9fe6e0 }));
    shard.scale.set(0.7, 1.8 - i * 0.25, 0.45);
    shard.position.set((i - 1) * 0.16, 0.28, 0);
    crown.add(shard);
  }
  crown.position.set(0, 1.95, 0);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), gel);
  armL.position.set(-0.78, 1.05, 0.15);
  armL.rotation.z = 0.7;
  const armR = armL.clone();
  armR.position.x = 0.78;
  armR.rotation.z = -0.7;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.9, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8c877, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  const pink = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.86, 6),
    new THREE.MeshBasicMaterial({ color: 0xff4fb4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  pink.position.y = 1.15;
  g.add(puddle, body, tum, eyeL, eyeR, pL, pR, crown, armL, armR, ring, pink);
  g.userData.idle = { body, crown, armL, armR };
  g.userData.ring = ring;
  g.userData.pink = pink;
  g.scale.setScalar(1.85);
  g.visible = false;
  scene.add(g);
  fightBeast = g;
}
function placeFightBeast() {
  ensureFightBeast();
  const x = px + Math.sin(fp.yaw) * 8.2;
  const z = pz + Math.cos(fp.yaw) * 8.2;
  fightBeast.position.set(x, groundY(x, z), z);
  fightBeast.rotation.y = fp.yaw + Math.PI;
  fightBeast.visible = false;
}
function ensureFightCut() {
  if (fightCut) return;
  const tex = new THREE.TextureLoader().load('gel_king_cut.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  fightCut = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 4.1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })
  );
  fightCut.visible = false;
  scene.add(fightCut);
}
function fightAhead(dist) {
  return [px + Math.sin(fp.yaw) * dist, pz + Math.cos(fp.yaw) * dist];
}
function stepAggro(dt) {
  if (!fp.on || fp.fish) {
    if (fightCut) fightCut.visible = false;
    return;
  }
  ensureFightBeast();
  ensureFightCut();
  if (!fp.aggroHold) fp.aggro += dt;
  else if (fp.aggroHold === 'cutout') fp.aggro = 0.35;
  else if (fp.aggroHold === 'surge') fp.aggro = 1.6;
  else if (fp.aggroHold === 'live') fp.aggro = 4;
  const t = fp.aggro;
  const solid = t < 1.15 ? 0 : Math.min(1, (t - 1.15) / 0.95);
  const surge = t > 1.15 && t < 2.45 ? Math.sin(((t - 1.15) / 1.3) * Math.PI) : 0;
  if (!fp.kingLock) {
    fp.kingLock = { ox: px, oz: pz, fx: Math.sin(fp.yaw), fz: Math.cos(fp.yaw) };
  }
  const dist = 16 - solid * 4.5;
  const plate = 1 - solid * 0.34;
  const anchor = fp.kingLock;
  const cx = anchor.ox + anchor.fx * dist;
  const cz = anchor.oz + anchor.fz * dist;
  const half = (4.1 * plate) * 0.5;
  const eyeY = camera ? camera.position.y : groundY(cx, cz) + 1.55;
  const pitch = fp.pitch || 0;
  const floorY = fp.view === 'camera'
    ? eyeY - 1.4 * Math.max(0.55, Math.cos(pitch))
    : groundY(cx, cz);
  fightCut.position.set(cx, floorY + half, cz);
  fightCut.scale.setScalar(plate);
  if (!kingShadow) {
    kingShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
    );
    kingShadow.rotation.x = -Math.PI / 2;
    scene.add(kingShadow);
  }
  kingShadow.visible = !fp.dummy && fp.view === 'camera';
  kingShadow.position.set(cx, floorY + 0.03, cz);
  kingShadow.scale.setScalar(1.15 * plate);
  if (camera) fightCut.lookAt(camera.position);
  fightCut.visible = !fp.dummy;
  if (fightCut.material) fightCut.material.opacity = 0.34 + solid * 0.66;
  if (fightBeast) fightBeast.visible = false;
  let pink = fightCut.getObjectByName('surge');
  if (!pink) {
    pink = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 1.92, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4fb4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    pink.name = 'surge';
    pink.position.z = 0.04;
    fightCut.add(pink);
  }
  pink.material.opacity = surge * 0.92;
  pink.scale.setScalar(1 + surge * 0.85);
  pink.visible = surge > 0.04;
}
function setCameraScene(hideWorld) {
  if (!scene) return;
  const keep = new Set([fightBeast, fightCut, camPlate, fpDummy, rod, kingShadow, bobber, fishLine, fishGlow, castRing]);
  scene.children.forEach((o) => {
    if (o.isLight || keep.has(o)) return;
    if (hideWorld) {
      if (o.userData.preCam == null) {
        o.userData.preCam = o.visible;
        o.visible = false;
      }
    } else if (o.userData.preCam != null) {
      o.visible = o.userData.preCam;
      o.userData.preCam = null;
    }
  });
  if (scene.fog) {
    if (hideWorld) {
      if (!fp.fogSaved) fp.fogSaved = { near: scene.fog.near, far: scene.fog.far };
      scene.fog.near = 90;
      scene.fog.far = 420;
    } else if (fp.fogSaved) {
      scene.fog.near = fp.fogSaved.near;
      scene.fog.far = fp.fogSaved.far;
      fp.fogSaved = null;
    }
  }
}
function ensureCamPlate() {
  if (!handVideo) return;
  if (!camTex) {
    camTex = new THREE.VideoTexture(handVideo);
    camTex.colorSpace = THREE.SRGBColorSpace;
    camTex.minFilter = THREE.LinearFilter;
    camTex.magFilter = THREE.LinearFilter;
    camTex.generateMipmaps = false;
  }
  camTex.needsUpdate = true;
  if (!camPlate) {
    camPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: camTex, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    camPlate.frustumCulled = false;
    camPlate.renderOrder = -20;
    camPlate.visible = false;
    scene.add(camPlate);
  }
}
function placeCamPlate() {
  if (fp.view !== 'camera' || !camera) {
    if (camPlate) camPlate.visible = false;
    return;
  }
  ensureCamPlate();
  if (!camPlate) return;
  const dist = camera.near + 0.2;
  const v = camera.fov * Math.PI / 180;
  const h = 2 * Math.tan(v / 2) * dist;
  const w = h * Math.max(0.3, camera.aspect);
  camPlate.scale.set(w, h, 1);
  camPlate.position.copy(camera.position);
  camPlate.quaternion.copy(camera.quaternion);
  camPlate.translateZ(-dist);
  camPlate.visible = !!(handVideo && handVideo.srcObject);
  if (camTex) camTex.needsUpdate = true;
}
function setFightView(mode) {
  fp.view = mode === 'camera' ? 'camera' : 'virtual';
  const b = document.getElementById('fpView');
  if (b) b.textContent = fp.view === 'camera' ? 'Camera' : 'Virtual';
  document.body.classList.toggle('fp-cam', !!(fp.on && fp.view === 'camera'));
  if (!fp.on) return;
  if (fp.view === 'camera') {
    setCameraScene(true);
    if (avatar) avatar.visible = false;
    if (fp.fish && rod) { scene.add(rod); rod.visible = true; }
    startHandCam();
    if (handVideo && handVideo.srcObject) handVideo.play().catch(() => {});
  } else {
    setCameraScene(false);
    if (camPlate) camPlate.visible = false;
    if (fp.fish && rod && avatar) {
      avatar.add(rod);
      rod.traverse((o) => { if (o.layers) o.layers.set(2); });
      rod.scale.setScalar(1);
      rod.rotation.set(0.85, 0, 0.15);
    }
    if (avatar) avatar.visible = !!fp.body;
  }
  if (handVideo) handVideo.classList.toggle('ar', fp.view === 'camera');
}
let fpDummy = null;
function ensureDummy() {
  if (fpDummy) return;
  fpDummy = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.55, 8), toonMat('#c9b089'));
  post.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toonMat('#e7d3a8'));
  head.position.y = 1.72;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.15;
  fpDummy.add(post, head, band);
  fpDummy.visible = false;
  scene.add(fpDummy);
}
function placeDummy() {
  ensureDummy();
  const x = px + Math.sin(fp.yaw) * 6.4;
  const z = pz + Math.cos(fp.yaw) * 6.4;
  fpDummy.position.set(x, groundY(x, z), z);
  fpDummy.visible = !!fp.on && !!fp.dummy;
}
function toggleDummy() {
  if (!fp.on) return;
  fp.dummy = !fp.dummy;
  const b = document.getElementById('fpDummy');
  if (b) b.textContent = fp.dummy ? 'Gel King' : 'Dummy';
  if (fp.dummy) {
    placeDummy();
    if (fightBeast) fightBeast.visible = false;
  } else {
    if (fpDummy) fpDummy.visible = false;
    placeFightBeast();
  }
}
function ensureFightDress() {
  if (fightDress) return;
  fightDress = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 1.5, 6), toonMat('#6d4a32'));
  const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 0), toonMat('#2f8a3a'));
  const makeTree = (x, z, s) => {
    const t = new THREE.Group();
    const a = trunk.clone();
    a.position.y = 0.75 * s;
    a.scale.setScalar(s);
    const b = puff.clone();
    b.position.y = 2.1 * s;
    b.scale.setScalar(s);
    t.add(a, b);
    t.position.set(x, 0, z);
    return t;
  };
  [[-6, 16, 1.3], [5, 18, 1.5], [-2, 24, 1.7], [8, 27, 1.2], [-9, 30, 1.6]].forEach((p) => {
    fightDress.add(makeTree(p[0], p[1], p[2]));
  });
  const blade = archBlade();
  const mat = new THREE.MeshBasicMaterial({ color: 0x3f9a3a, side: THREE.DoubleSide });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(blade, mat);
    const a = (i / 18) * Math.PI * 2;
    const rr = 1.6 + (i % 5) * 0.7;
    m.position.set(Math.cos(a) * rr * 0.45, 0, 2.2 + (i % 6) * 0.55);
    m.rotation.y = a;
    m.scale.setScalar(1.4 + (i % 3) * 0.35);
    fightDress.add(m);
  }
  fightDress.visible = false;
  scene.add(fightDress);
}
function placeFightDress() {
  ensureFightDress();
  fightDress.position.set(px, groundY(px, pz), pz);
  fightDress.rotation.y = fp.yaw;
  fightDress.visible = true;
}
function lifeAnchor(i, n) {
  const lake = field.anchors.lake;
  const garden = field.anchors.garden;
  const seeds = [
    [px + 6, pz + 4], [px - 7, pz + 3], [px + 3, pz - 8],
    [lake[0] + 8, lake[1] + 14], [lake[0] - 10, lake[1] + 6],
    [garden[0] + 4, garden[1] - 3], [garden[0] - 5, garden[1] + 2],
    [px + 12, pz + 9],
  ];
  const s = seeds[i % seeds.length];
  const spot = nearestWalkable(s[0], s[1]);
  return [spot[0], spot[1]];
}
function buildLife() {
  life = { motes: [], butterflies: [], birds: [], dust: [], splash: [] };
  const lite = window.innerWidth < 700 || holoLevel() < 0.5;
  const moteCount = lite ? 4 : 7;
  for (let i = 0; i < moteCount; i++) {
    const mat = glowSprite('rgba(255,236,170,1)', i % 2 ? 'rgba(120,220,255,0.45)' : 'rgba(255,190,80,0.4)');
    const m = new THREE.Sprite(mat);
    m.scale.setScalar(0.28 + (i % 3) * 0.06);
    const spot = lifeAnchor(i, moteCount);
    m.userData = { x: spot[0], z: spot[1], y: 0.7 + (i % 4) * 0.35, phase: i * 1.3 };
    scene.add(m);
    life.motes.push(m);
  }
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.09);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.08, 0, 0);
  for (let i = 0; i < (lite ? 2 : 4); i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2a1c28 }));
    body.scale.set(0.7, 0.7, 1.5);
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 ? 0xff8ec8 : 0xfff2a8, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
    });
    const w1 = new THREE.Mesh(wingGeo, mat);
    const w2 = new THREE.Mesh(wingGeo, mat);
    w2.scale.x = -1;
    g.add(body, w1, w2);
    const spot = lifeAnchor(i + 2, 4);
    g.userData = { x: spot[0], z: spot[1], phase: i * 1.7, wings: [w1, w2] };
    scene.add(g);
    life.butterflies.push(g);
  }
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), toonMat('#4a3424'));
    body.scale.set(0.7, 0.45, 1.6);
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), toonMat('#8a6848'));
    g.add(body, wing);
    g.userData = { a: i * 2.1, wing, alt: 9 + i * 1.6 };
    scene.add(g);
    life.birds.push(g);
  }
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 3), new THREE.MeshBasicMaterial({ color: 0xe6d2ae, transparent: true, opacity: 0 }));
    m.visible = false;
    scene.add(m);
    life.dust.push({ m, t: 0 });
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0 }));
    m.visible = false;
    scene.add(m);
    life.splash.push({ m, t: 0, vy: 0 });
  }
}
function stepLife(dt, speed) {
  if (!life) return;
  const gy = groundY(px, pz);
  const indoor = indoors();
  life.motes.forEach((m) => {
    m.visible = !indoor;
    const u = m.userData;
    const bob = Math.sin(worldT * 0.7 + u.phase) * 0.18;
    m.position.set(u.x, groundY(u.x, u.z) + u.y + bob, u.z);
  });
  life.butterflies.forEach((g) => {
    g.visible = !indoor;
    const u = g.userData;
    const a = worldT * 0.45 + u.phase;
    g.position.set(u.x + Math.cos(a) * 1.3, groundY(u.x, u.z) + 0.85 + Math.sin(a * 2) * 0.2, u.z + Math.sin(a) * 1.1);
    g.rotation.y = -a;
    const flap = Math.sin(worldT * 16 + u.phase);
    u.wings.forEach((w, k) => { w.rotation.z = flap * 0.95 * (k ? -1 : 1); });
  });
  const lake = field.anchors.lake;
  life.birds.forEach((g) => {
    g.visible = !indoor;
    const a = worldT * 0.22 + g.userData.a;
    g.position.set(lake[0] + Math.cos(a) * 26, groundY(lake[0], lake[1]) + g.userData.alt, lake[1] + Math.sin(a) * 18);
    g.rotation.y = -a;
    g.userData.wing.rotation.z = Math.sin(worldT * 7 + g.userData.a) * 0.6;
  });
  if (speed > 1.05) {
    const slot = life.dust.find((d) => d.t <= 0);
    if (slot) { slot.t = 0.55; slot.m.visible = true; slot.m.position.set(px, gy + 0.05, pz); }
  }
  for (const d of life.dust) {
    if (d.t <= 0) continue;
    d.t -= dt;
    d.m.position.y += dt * 0.35;
    d.m.material.opacity = Math.max(0, d.t);
    if (d.t <= 0) d.m.visible = false;
  }
  const wet = [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]].some(([dx, dz]) => kindAt(px + dx, pz + dz) === 3);
  if (wet && speed > 0.4) {
    const slot = life.splash.find((s) => s.t <= 0);
    if (slot) { slot.t = 0.4; slot.vy = 1.4; slot.m.visible = true; slot.m.position.set(px, gy + 0.08, pz); }
  }
  for (const s of life.splash) {
    if (s.t <= 0) continue;
    s.t -= dt;
    s.vy -= dt * 3.2;
    s.m.position.y += s.vy * dt;
    s.m.material.opacity = Math.max(0, s.t * 2);
    if (s.t <= 0) s.m.visible = false;
  }
  for (const mat of windMats) {
    if (mat.userData.shader) mat.userData.shader.uniforms.uTime.value = worldT;
  }
}
function placeDiorama(x, z, kind) {
  const g = new THREE.Group();
  const y = groundY(x, z);
  g.position.set(x, y, z);
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.22, 0.1, 6), toonMat('#e4efd2'));
  hex.position.y = 0.06;
  g.add(hex);
  if (kind === 'dock') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.42), toonMat('#a56b3c'));
    deck.position.set(0.2, 0.18, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 5), toonMat('#5c4030'));
    post.position.set(0.55, 0.42, 0.14);
    g.add(deck, post);
  } else {
    const wall = kind === 'market' ? '#f4e4c8' : kind === 'home' ? '#f7f3ea' : '#f3ecdf';
    const roofC = kind === 'market' ? '#c4554a' : kind === 'home' ? '#e7b15a' : '#d06a45';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.48, 0.58), toonMat(wall));
    body.position.y = 0.36;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.34, 4), toonMat(roofC));
    roof.position.y = 0.74;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.05), toonMat('#6b3a28'));
    door.position.set(0, 0.24, 0.3);
    g.add(body, roof, door);
  }
  const label = kind === 'market' ? 'Market' : kind === 'dock' ? 'Dock' : kind === 'home' ? 'Home' : '';
  if (label) {
    const lab = labelSprite(label, '#ffd978', [1.25, 0.32]);
    lab.position.y = 1.2;
    g.add(lab);
  }
  g.scale.setScalar(1.85);
  scene.add(g);
  return g;
}
function buildBuildings() {
  const list = field.buildings || [];
  const home = field.anchors.home;
  list.forEach((b) => {
    const pts = b.p;
    if (!pts || pts.length < 3) return;
    let cx = 0, cz = 0;
    pts.forEach((p) => { cx += p[0]; cz += p[1]; });
    cx /= pts.length;
    cz /= pts.length;
    if (kindAt(cx, cz) === 3) return;
    if (Math.hypot(cx - home[0], cz - home[1]) < 14) return;
    if (Math.hypot(cx - home[0], cz - home[1]) > 160) return;
    placeDiorama(cx, cz, 'house');
  });
}

function labelSprite(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,10,16,0.82)';
  g.fillRect(8, 8, 240, 48);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(8, 8, 240, 48);
  g.fillStyle = '#fff6e4';
  g.font = '700 28px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale ? scale[0] : 2.1, scale ? scale[1] : 0.52, 1);
  return sp;
}
function addMarker(x, z, text, color) {
  const y = groundY(x, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5), toonMat(color));
  pole.position.set(x, y + 1.1, z);
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toonMat(color));
  cap.position.set(x, y + 2.25, z);
  const lab = labelSprite(text, color);
  lab.position.set(x, y + 2.85, z);
  scene.add(pole, cap, lab);
}

function hourLook() {
  const t = window.__aroSun ? window.__aroSun() : 0.2;
  if (t < 0.15) return { sky: '#ffb07a', horizon: '#ffe3c4', ground: '#9dcc72', sun: '#ffe0b0', up: 0.42, hemi: 1.05, dir: 1.45 };
  if (t < 0.6) return { sky: '#8ec6ee', horizon: '#f6d7b0', ground: '#c6d98a', sun: '#fff1c8', up: 0.92, hemi: 1.05, dir: 1.55 };
  if (t < 0.88) return { sky: '#f08a5a', horizon: '#ffc9a4', ground: '#d4926a', sun: '#ffb07a', up: 0.32, hemi: 0.8, dir: 1.15 };
  return { sky: '#243864', horizon: '#4d6294', ground: '#2a3a52', sun: '#b7c8ef', up: 0.28, hemi: 0.7, dir: 0.85 };
}
function applySky() {
  const L = hourLook();
  skyMat.uniforms.uTop.value.set(L.sky);
  skyMat.uniforms.uHor.value.set(L.horizon);
  skyMat.uniforms.uBot.value.set(L.ground);
  scene.fog.color.set(L.horizon);
  const sx = sun.position.x, sz = sun.position.z;
  const sl = Math.hypot(sx, sz) || 1;
  sunXZ.value.set(-sx / sl, -sz / sl);
  if (skyMat.uniforms.uTime) skyMat.uniforms.uTime.value = worldT;
  hemi.color.set(L.sky);
  hemi.groundColor.set(L.ground);
  hemi.intensity = L.hemi;
  sun.color.set(L.sun);
  sun.intensity = L.dir;
  const t = window.__aroSun ? window.__aroSun() : 0.2;
  const ang = (t - 0.15) * Math.PI;
  sun.position.set(Math.cos(ang) * 40, 18 + L.up * 40, Math.sin(ang) * 24);
}

function gaitLeg(phase, power) {
  const s = Math.sin(phase);
  const hip = -s * (0.42 + power * 0.2);
  const swing = Math.max(0, s);
  const knee = 0.22 + swing * (0.85 + power * 0.25);
  const foot = 0.12 - swing * 0.28;
  return [hip, knee, foot];
}
function applyPose(model, time, dt, speed, state) {
  if (!model || !model.humanoid) return;
  const setBone = (name, x, y, z) => {
    const b = model.humanoid.getNormalizedBoneNode(name);
    if (b) b.rotation.set(x, y, z);
  };
  if (shot === 'side') state.amp = 1;
  else {
    const target = speed > 0.2 ? Math.min(1, speed / 1.3) : 0;
    state.amp += (target - state.amp) * Math.min(1, dt * 5);
  }
  if (speed > 0.2 && shot !== 'side') state.phase += dt * (2.2 + speed * 0.45);
  const w = state.amp;
  const run = speed > 1.45 ? Math.min(1, (speed - 1.45) / 0.8) : 0;
  const idle = 1 - w;
  const breathe = Math.sin(time * 1.6);
  const [lHip, lKnee, lFoot] = gaitLeg(state.phase, run);
  const [rHip, rKnee, rFoot] = gaitLeg(state.phase + Math.PI, run);
  setBone('hips', Math.sin(state.phase * 2) * 0.04 * w, Math.sin(state.phase) * 0.04 * w, 0);
  setBone('spine', breathe * 0.03 * idle + Math.sin(state.phase) * 0.03 * w, 0, 0);
  setBone('chest', breathe * 0.025 * idle, Math.sin(time * 0.55) * 0.04 * idle, 0);
  const lookYaw = Math.sin(time * 0.37) * 0.22 * idle;
  setBone('neck', 0, lookYaw * 0.35, 0);
  setBone('head', -0.04 + Math.sin(time * 0.7) * 0.02 * idle, lookYaw, 0);
  setBone('leftUpperLeg', lHip * w, 0, 0);
  setBone('rightUpperLeg', rHip * w, 0, 0);
  setBone('leftLowerLeg', lKnee * w, 0, 0);
  setBone('rightLowerLeg', rKnee * w, 0, 0);
  setBone('leftFoot', lFoot * w, 0, 0);
  setBone('rightFoot', rFoot * w, 0, 0);
  const reel = playMode === 'fish' && typeof window.__aroReel === 'function' ? window.__aroReel() : '';
  if (playMode === 'fish') {
    const pull = (reel === 'reel' || reel === 'nibble') ? Math.sin(time * 8) * 0.16 : 0;
    setBone('spine', 0.12, 0, 0);
    setBone('chest', 0.06, 0, 0);
    setBone('leftUpperArm', -0.9, -0.7, 1.05);
    setBone('leftLowerArm', 0.55, 0.45, 0.35);
    setBone('rightUpperArm', -1.05, 0.4, -0.95);
    setBone('rightLowerArm', 0.7 + pull, -0.35, -0.25);
  } else {
    const swing = Math.sin(state.phase);
    const run = speed > 1.15;
    const amp = speed > 0.28 ? (run ? 0.85 : 0.45) : 0.08;
    setBone('leftUpperArm', 0.15 + swing * amp, 0.05, 1.55);
    setBone('rightUpperArm', 0.15 - swing * amp, -0.05, -1.55);
    setBone('leftLowerArm', 0.45 + Math.max(0, swing) * 0.25 * (speed > 0.28 ? 1 : 0), 0, 0);
    setBone('rightLowerArm', 0.45 + Math.max(0, -swing) * 0.25 * (speed > 0.28 ? 1 : 0), 0, 0);
  }
  if (fp.on && model === vrm) {
    facing = fp.yaw;
    const punch = fp.cast > 0 ? Math.sin((1 - Math.min(fp.cast, 0.35) / 0.35) * Math.PI) : 0;
    setBone('hips', 0, 0, 0);
    setBone('spine', 0.08, 0, 0);
    setBone('chest', 0.04, 0, 0);
    setBone('neck', 0.1, 0, 0);
    setBone('head', 0, 0, 0);
    setBone('leftUpperArm', 1.45, 0.25, 0.42);
    setBone('leftLowerArm', 1.15, 0.05, 0.1);
    setBone('leftHand', -0.4, 0, 0.25);
    setBone('rightUpperArm', 1.55 + punch * 0.2, -0.1, -0.38);
    setBone('rightLowerArm', 1.05 - punch * 0.15, -0.05, -0.08);
    setBone('rightHand', -0.55, 0.15, -0.35);
    const spread = 0.22 + (fp.cast > 0 ? 0.18 : 0);
    ['Index', 'Middle', 'Ring', 'Little'].forEach((finger, i) => {
      const splay = (i - 1.5) * spread;
      setBone('right' + finger + 'Proximal', -0.15, splay, 0);
      setBone('right' + finger + 'Intermediate', 0.05, 0, 0);
      setBone('right' + finger + 'Distal', 0.04, 0, 0);
      setBone('left' + finger + 'Proximal', -0.2, splay * 0.4, 0);
    });
    setBone('rightThumbProximal', -0.4, 0.35, 0.4);
    setBone('rightThumbIntermediate', -0.15, 0, 0);
    setBone('leftThumbProximal', -0.3, -0.2, -0.3);
  }
}

function steer(dt) {
  if (fp.on || shot === 'fp' || shot === 'fpcast' || shot === 'fpfish' || shot === 'rocks' || shot === 'home' || shot === 'npcs' || shot === 'water' || shot === 'close' || shot === 'wide' || shot === 'side' || shot === 'grass' || shot === 'grasswide' || shot === 'ground' || shot === 'groundwide' || shot === 'glass' || shot === 'glasswide' || shot === 'glassbody' || shot === 'tint') return 0;
  let x = 0, z = 0, mode = '';
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  if (keys.f || keys.b || keys.l || keys.r) {
    dest = null;
    if (keys.f) { x += fx; z += fz; }
    if (keys.b) { x -= fx; z -= fz; }
    if (keys.r) { x += rx; z += rz; }
    if (keys.l) { x -= rx; z -= rz; }
    mode = 'keys';
  } else if (dest && (tapOn() || destFromPick)) {
    x = dest.x - px; z = dest.z - pz;
    if (Math.hypot(x, z) < 0.55) { dest = null; destFromPick = false; return 0; }
    mode = 'tap';
  } else if (gpsTarget && playMode === 'world' && performance.now() > tapUntil) {
    x = gpsTarget.x - px; z = gpsTarget.z - pz;
    if (Math.hypot(x, z) < 0.7) { gpsTarget = null; return 0; }
    mode = 'gps';
  } else return 0;
  const len = Math.hypot(x, z) || 1;
  if (mode === 'keys') runHold += dt;
  else runHold = 0;
  const sprint = runHold > 0.38 || performance.now() < runUntil;
  const sp = (mode === 'gps' ? 4.2 : 3.15) * (sprint ? 1.62 : 1);
  const dx = (x / len) * sp * dt;
  const dz = (z / len) * sp * dt;
  let nx = px + dx, nz = pz + dz;
  if (blocked(nx, nz)) {
    if (!blocked(px + dx, pz)) nz = pz;
    else if (!blocked(px, pz + dz)) nx = px;
    else return 0;
  }
  const moved = Math.hypot(nx - px, nz - pz);
  if (moved > 0.0008) {
    const want = Math.atan2(nx - px, nz - pz);
    let turn = want - facing;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    facing += turn * Math.min(1, dt * 8);
  }
  px = nx; pz = nz;
  clampRoom();
  return moved / Math.max(dt, 0.001);
}
function clampRoom() {
  if (!indoors()) return;
  const s = SITES[playMode];
  if (!s) return;
  px = clamp(px, s.x - s.hw, s.x + s.hw);
  pz = clamp(pz, s.z - s.hd, s.z + s.hd + 0.35);
  if (pz > s.z + s.hd) exitPlay();
}

function placeAvatar(speed) {
  if (!avatar) return false;
  const y = standY(px, pz) + (avatar.userData.foot || 0);
  const prevX = avatar.userData.lx;
  const prevZ = avatar.userData.lz;
  let jump = prevX == null || Math.hypot(px - prevX, pz - prevZ) > 0.5;
  avatar.userData.lx = px;
  avatar.userData.lz = pz;
  if ((avatar.userData.warm | 0) > 0) {
    avatar.userData.warm -= 1;
    jump = true;
  }
  avatar.position.set(px, y, pz);
  // The sample faces -Z. Adding half a turn makes her face the way she walks.
  avatar.rotation.y = fp.on ? facing : facing + Math.PI;
  const bob = speed > 0.2 ? Math.abs(Math.sin(playerPose.phase * 2)) * 0.03 : Math.sin(worldT * 1.6) * 0.012;
  avatar.position.y += bob;
  if (blob) blob.visible = false;
  if (!avatar.userData.shadow) avatar.userData.shadow = addActorShadow(0.78);
  parkShadow(avatar.userData.shadow, px, pz, !indoors());
  return jump;
}

function syncAnchor() {
  if (!field || typeof window.__aroPlace !== 'function') return;
  const spots = [
    ['lake', field.anchors.lake, 8],
    ['garden', field.anchors.garden, 8],
    ['home', field.anchors.home, 7],
  ];
  let name = 'home';
  for (const [n, p, rad] of spots) {
    if (Math.hypot(px - p[0], pz - p[1]) <= rad) { name = n; break; }
  }
  if (name !== lastAnchor) {
    lastAnchor = name;
    window.__aroPlace(name);
  }
}

function nearestWalkable(x, z) {
  if (!blocked(x, z)) return [x, z];
  for (let rad = 2; rad <= 28; rad += 2) {
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      const nx = x + Math.cos(ang) * rad, nz = z + Math.sin(ang) * rad;
      if (!blocked(nx, nz)) return [nx, nz];
    }
  }
  return [x, z];
}
function aimCamera(x, y, z, lx, ly, lz) {
  wantCam.set(x, y, z);
  look.set(lx, ly, lz);
  const snap = shot === 'face' || shot === 'body' || shot === 'side' || shot === 'close' || shot === 'rocks' || shot === 'hex' || shot === 'hexin';
  const k = !camInit || snap ? 1 : 1 - Math.exp(-Math.max(0.016, lastDt) * 5.2);
  if (!camInit) {
    smoothCam.copy(wantCam);
    smoothLook.copy(look);
    camInit = true;
  } else {
    smoothCam.lerp(wantCam, k);
    smoothLook.lerp(look, k);
  }
  camera.position.copy(smoothCam);
  camera.lookAt(smoothLook);
  if (skyMat) skyMat.uniforms.uCam.value.copy(camera.position);
}
function frameRoom() {
  const y = standY(px, pz);
  if (playMode === 'fish' && field) {
    const fx = Math.sin(facing), fz = Math.cos(facing);
    const rx = Math.cos(facing), rz = -Math.sin(facing);
    aimCamera(px - fx * 3.1 + rx * 1.7, y + 1.45, pz - fz * 3.1 + rz * 1.7, px + fx * 5.5, y + 0.85, pz + fz * 5.5);
    return;
  }
  const s = SITES[playMode];
  if (!s) return;
  if (playMode === 'home' || playMode === 'house') {
    aimCamera(s.x + 7.2, 6.4, s.z + 8.4, s.x, 1.35, s.z - 0.4);
    return;
  }
  if (playMode === 'raid') {
    aimCamera(s.x + 20, 16, s.z + 18, s.x, 1.4, s.z);
    return;
  }
  const cy = y + 1.5;
  const cp = Math.cos(0.42), spn = Math.sin(0.42);
  aimCamera(px + Math.sin(camYaw) * 9 * cp, cy + 9 * spn, pz + Math.cos(camYaw) * 9 * cp, px, cy, pz);
}
function mountFpHud() {
  if (document.getElementById('fpHud')) return;
  const s = document.createElement('style');
  s.textContent = '#fpHud{position:fixed;inset:0;z-index:30;display:none;pointer-events:none}#fpHud.on{display:block}body.fp-on #hud,body.fp-on #worldSpells,body.fp-on #menuBtn,body.fp-on #aroBack,body.fp-on #charBtn,body.fp-on #obj,body.fp-on #banner,body.fp-on #cv,body.fp-on #mapHint,body.fp-on #act,body.fp-on #coach,body.fp-on #spineLevel,body.fp-on #spinePurse,body.fp-on #spineBookBtn{display:none!important}#fpHud .top{position:absolute;left:16px;right:16px;top:calc(14px + env(safe-area-inset-top));display:flex;align-items:center;gap:12px;pointer-events:none}#fpHud .hp{flex:1;height:10px;border-radius:999px;background:rgba(8,18,16,.45);border:1px solid rgba(255,236,180,.55);overflow:hidden}#fpHud .hp i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#e7c56a,#8fd06a)}#fpHud .time{min-width:64px;text-align:center;color:#fff6df;font:800 16px ui-rounded,system-ui;text-shadow:0 1px 2px rgba(0,0,0,.45)}#fpHud button{pointer-events:auto;min-height:32px;padding:4px 12px;border-radius:999px;border:1px solid rgba(255,236,180,.55);background:rgba(8,18,16,.4);color:#fff6df;font:800 13px ui-rounded,system-ui}#fpTrack{position:absolute;left:16px;bottom:calc(18px + env(safe-area-inset-bottom));padding:6px 10px;border-radius:999px;background:rgba(8,18,16,.72);color:#fff6df;font:800 13px ui-rounded,system-ui;border:1px solid rgba(255,236,180,.45)}#fpTrack.hot{border-color:#9fe6e0;color:#e7fffb}#fpRing{position:fixed;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;border:3px solid rgba(255,220,140,.2);display:none;pointer-events:none;z-index:31}#fpRing.on{display:block}#fpRing i{position:absolute;inset:8px;border-radius:50%;border:3px solid #ffe7a8;transform:scale(.2);box-shadow:0 0 10px rgba(255,210,120,.35)}#fpRing b{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#fff6df;box-shadow:0 0 0 2px rgba(20,12,8,.45),0 0 8px #ffe7a8;pointer-events:none}#fpCam{position:absolute;right:16px;bottom:calc(18px + env(safe-area-inset-bottom))}#fpDummy{position:absolute;right:16px;bottom:calc(62px + env(safe-area-inset-bottom))}#fpView{position:absolute;left:16px;bottom:calc(64px + env(safe-area-inset-bottom))}#handCam{position:fixed;right:12px;bottom:calc(112px + env(safe-area-inset-bottom));width:96px;height:72px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,236,180,.65);z-index:32;background:#000}#handCam.ar{opacity:0;width:8px;height:8px;right:0;bottom:0;border:0}#handDebug{position:fixed;left:8px;top:calc(58px + env(safe-area-inset-top));z-index:40;display:none;max-width:min(78vw,280px);padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#d8ffe8;font:700 11px/1.35 ui-monospace,ui-monospace,monospace;white-space:pre-wrap}#handDebug.on{display:block}#gelFight{position:fixed;left:50%;bottom:calc(112px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:28;min-height:48px;padding:10px 18px;border-radius:999px;border:2px solid #9fe6e0;background:rgba(12,40,38,.9);color:#e9fffb;font:800 16px ui-rounded,system-ui}body.fp-on #gelFight,body.garden-room #gelFight,body:not(.world-on) #gelFight{display:none}';
  document.head.appendChild(s);
  const hud = document.createElement('div');
  hud.id = 'fpHud';
  hud.innerHTML = '<div class="top"><div class="hp"><i data-hp></i></div><b class="time" data-time>00:00</b><button type="button" data-act="off">Back</button></div><div id="fpTrack">Hold, then release to cast</div><button type="button" id="fpView">Virtual</button><button type="button" id="fpDummy">Dummy</button><button type="button" id="fpCam">Camera hands</button><button type="button" id="fpSteady">Steady</button><button type="button" id="fpLock">Lock</button>';
  document.body.appendChild(hud);
  const ring = document.createElement('div');
  ring.id = 'fpRing';
  ring.innerHTML = '<i></i><b></b>';
  document.body.appendChild(ring);
  hud.querySelector('[data-act="off"]').onclick = () => setFp(false);
  hud.querySelector('#fpCam').onclick = () => startHandCam();
  hud.querySelector('#fpDummy').onclick = () => toggleDummy();
  hud.querySelector('#fpView').onclick = () => setFightView(fp.view === 'camera' ? 'virtual' : 'camera');
  hud.querySelector('#fpLock').onclick = () => toggleFishLock();
  hud.querySelector('#fpSteady').onclick = () => {
    fp.steady = !fp.steady;
    const b = document.getElementById('fpSteady');
    if (b) { b.textContent = fp.steady ? 'Steady on' : 'Steady'; b.classList.toggle('on', !!fp.steady); }
  };
  if (!document.getElementById('fishMeter')) {
    const meter = document.createElement('div');
    meter.id = 'fishMeter';
    meter.innerHTML = '<b></b><span>Power</span>';
    document.body.appendChild(meter);
  }
  if (!document.getElementById('handDebug')) {
    const dbg = document.createElement('div');
    dbg.id = 'handDebug';
    document.body.appendChild(dbg);
  }
  const extra = document.createElement('style');
  extra.textContent = '#longLake{position:fixed;left:12px;bottom:calc(172px + env(safe-area-inset-bottom));z-index:28;min-height:44px;padding:8px 14px;border-radius:999px;border:2px solid #9ad8ff;background:rgba(10,28,48,.92);color:#e7f6ff;font:800 15px ui-rounded,system-ui}body.fp-on #longLake,body.garden-room #longLake,body:not(.world-on) #longLake{display:none}#handGuide{position:fixed;left:12px;bottom:calc(118px + env(safe-area-inset-bottom));width:96px;height:128px;z-index:33;border-radius:14px;overflow:hidden;border:1px solid rgba(255,236,180,.8);box-shadow:0 8px 18px rgba(0,0,0,.4);opacity:0;pointer-events:none}body.fp-cam #handGuide{opacity:1}#handGuide #handCam,#handGuide #handCam.ar{position:absolute;inset:0;width:100%;height:100%;opacity:1;border:0;border-radius:0;right:auto;bottom:auto;object-fit:cover}#handGuide i{position:absolute;left:18%;right:18%;top:40%;height:38%;border:3px solid #fff6df;border-radius:12px;box-shadow:0 0 0 2px rgba(0,0,0,.72),0 0 10px rgba(255,210,120,.85)}';
  document.head.appendChild(extra);
  const heat = document.createElement('style');
  heat.textContent = 'body.fp-on:not(.fishing) #handGuide{opacity:1;left:auto;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:112px;height:150px;background:#041018;border-color:rgba(80,255,230,.55)}body.fishing #handGuide{opacity:0!important;visibility:hidden}body.fp-on:not(.fishing) #fpCam,body.fp-on:not(.fishing) #fpDummy{right:auto;left:16px}body.fp-on:not(.fishing) #fpDummy{bottom:calc(112px + env(safe-area-inset-bottom))}body.fp-on:not(.fishing) #fpCam{bottom:calc(156px + env(safe-area-inset-bottom))}body.fishing #fpDummy,body.fishing #fpCam{display:none}#fpLock{display:none;position:absolute;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));min-height:44px;padding:8px 18px;z-index:34}body.fishing #fpLock{display:block;left:auto;right:16px;transform:none}body.fishing #fpLock.on{background:rgba(12,42,28,.88);border-color:#7dffb0;color:#e9fff4}body.fishing #fpTrack{bottom:calc(64px + env(safe-area-inset-bottom));max-width:52vw}body.fishing #fpView{bottom:calc(16px + env(safe-area-inset-bottom))}body.fishing #fpSteady{display:block}#fpSteady{display:none;position:absolute;right:16px;bottom:calc(64px + env(safe-area-inset-bottom));min-height:36px}body.fishing #fpSteady.on{border-color:#ffe08a;color:#fff6df}#fishMeter{display:none;position:fixed;left:16px;bottom:calc(214px + env(safe-area-inset-bottom));width:22px;height:132px;border-radius:999px;border:2px solid rgba(255,224,138,.9);background:rgba(6,14,18,.62);z-index:35;overflow:visible}body.fishing.fp-on #fishMeter.show{display:block}#fishMeter b{position:absolute;left:0;right:0;bottom:0;height:0;border-radius:999px;background:linear-gradient(0deg,#ff9a3a,#fff3b0);box-shadow:0 0 14px rgba(255,200,80,.8)}#fishMeter span{position:absolute;left:30px;top:50%;transform:translateY(-50%);color:#fff6df;font:800 14px ui-rounded,system-ui;text-shadow:0 1px 2px #000;white-space:nowrap}#handGuide.locked{box-shadow:0 0 0 2px #7dffb0,0 0 16px rgba(80,255,180,.7)}#handGuide.hot{box-shadow:0 0 0 2px #ffe08a,0 0 18px rgba(255,200,80,.85)}#handGuide #handCam{filter:grayscale(1) sepia(.75) hue-rotate(150deg) contrast(1.8) brightness(.4) saturate(2.4)}#handGuide #handCam{z-index:1}#handGuide canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}#handGuide i{display:none}';
  document.head.appendChild(heat);
  if (!document.getElementById('longLake')) {
    const lake = document.createElement('button');
    lake.id = 'longLake';
    lake.type = 'button';
    lake.textContent = 'Long Lake';
    lake.onclick = () => askPhoneAim(() => { if (window.__aroPhoneRod) window.__aroPhoneRod(); setFp(true, 'fish'); });
    document.body.appendChild(lake);
  }
  if (!document.getElementById('gelFight')) {
    const fight = document.createElement('button');
    fight.id = 'gelFight';
    fight.type = 'button';
    fight.textContent = 'Gel King fight';
    fight.onclick = () => askPhoneAim(() => setFp(true, 'fight'));
    document.body.appendChild(fight);
  }
}
function setFpBody(on) {
  if (!vrm || !vrm.scene || !vrm.humanoid) return false;
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    const n = ((o.name || '') + ((o.material && o.material.name) || '')).toLowerCase();
    const hide = /hair|face|head|eye|brow|mouth|teeth|lash|ear/.test(n);
    if (!hide) return;
    if (on) {
      if (o.userData.fpVis == null) o.userData.fpVis = o.visible;
      o.visible = false;
    } else if (o.userData.fpVis != null) {
      o.visible = o.userData.fpVis;
      o.userData.fpVis = null;
    }
  });
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    if (head) head.scale.setScalar(on ? 0.001 : 1);
    ['leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'].forEach((name) => {
      const b = vrm.humanoid.getNormalizedBoneNode(name);
      if (b) b.scale.setScalar(on ? 0.001 : 1);
    });
    ['leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand'].forEach((name) => {
      const b = vrm.humanoid.getNormalizedBoneNode(name);
      if (b) b.scale.set(1, 1, 1);
    });
  const hand = vrm.humanoid.getNormalizedBoneNode('rightHand');
  if (hand && !hand.getObjectByName('fpPalm')) {
    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffe7a8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      })
    );
    palm.name = 'fpPalm';
    palm.position.set(0, 0.07, 0.02);
    palm.renderOrder = 3;
    hand.add(palm);
  }
  return true;
}
function setAvatarLayer(layer) {
  if (!avatar) return;
  avatar.traverse((o) => { if (o.layers) o.layers.set(layer); });
}
let vmCam = null;
let fpFill = null;
function ensureVmCam() {
  if (!vmCam) {
    vmCam = new THREE.PerspectiveCamera(46, 1, 0.2, 40);
    vmCam.layers.set(2);
  }
  if (!fpFill) {
    fpFill = new THREE.DirectionalLight(0xfff4e4, 1.6);
    fpFill.layers.set(2);
    fpFill.target = new THREE.Object3D();
    scene.add(fpFill, fpFill.target);
  }
  return vmCam;
}
function setFp(on, kind) {
  const fish = kind === 'fish' || (on && playMode === 'fish' && kind !== 'fight');
  const allow = playMode === 'arena' || playMode === 'raid' || playMode === 'world' || playMode === 'fish' || fp.on || fish;
  const next = !!on && allow;
  if (next === fp.on && !!fp.fish === !!fish) {
    document.body.classList.toggle('fp-on', fp.on);
    const el0 = document.getElementById('fpHud');
    if (el0) el0.classList.toggle('on', fp.on);
    return;
  }
  fp.on = next;
  fp.fish = false;
  if (fp.on) {
    fp.saved = { x: px, z: pz, f: facing, mode: playMode };
    fp.pitch = 0.12;
    fp.clock = 0;
    fp.hp = 100;
    fp.placed = true;
    ensureFpArms();
    if (fish) {
      if (window.__aroPhoneRod) window.__aroPhoneRod();
      if (playMode !== 'fish') enterPlay('fish');
      fp.fish = true;
      fp.saved.mode = 'fish';
      const lake = field.anchors.lake;
      fp.view = 'virtual';
      fp.yaw = Math.atan2(lake[0] - px, lake[1] - pz);
      facing = fp.yaw;
      fp.lookLock = false;
      fp.fishPower = 0;
      resetGyro();
      if (fightBeast) fightBeast.visible = false;
      if (fightDress) fightDress.visible = false;
    } else {
      playMode = 'world';
      const spot = fightOverlook();
      px = spot[0];
      pz = spot[1];
      const home = field.anchors.home;
      fp.yaw = Math.atan2(px - home[0], pz - home[1]);
      facing = fp.yaw;
      fp.view = 'virtual';
      fp.aggro = 0;
      fp.aggroHold = '';
      fp.kingLock = null;
      placeFightBeast();
      placeFightDress();
    }
    if (scene.fog) { scene.fog.near = 18; scene.fog.far = 110; }
    fp.body = setFpBody(true);
    if (fp.body) {
      fp.pitch = 0.08;
      setAvatarLayer(2);
    }
    if (fp.body && vrm.userData.matz) {
      vrm.userData.matz.t = 1;
      vrm.userData.matz.uFill.value = 99;
    }
  } else {
    fp.placed = false;
    setFpBody(false);
    setAvatarLayer(1);
    fp.body = false;
    if (fightBeast) fightBeast.visible = false;
    if (fightDress) fightDress.visible = false;
    clearBolts();
    if (fpDummy) fpDummy.visible = false;
    if (fightCut) fightCut.visible = false;
    setCameraScene(false);
    if (camPlate) camPlate.visible = false;
    fp.view = 'virtual';
    document.body.classList.remove('fp-cam');
    if (fp.saved) {
      playMode = fp.saved.mode;
      px = fp.saved.x;
      pz = fp.saved.z;
      facing = fp.saved.f;
      fp.saved = null;
    }
    if (scene.fog) { scene.fog.near = 55; scene.fog.far = 340; }
  }
  document.body.classList.toggle('fp-on', fp.on);
  mountFpHud();
  const el = document.getElementById('fpHud');
  if (el) el.classList.toggle('on', fp.on);
  if (avatar) avatar.visible = fp.view === 'camera' ? false : (!fp.on || !!fp.body);
  if (fpArms) fpArms.visible = !!fp.on && !fp.body && fp.view !== 'camera';
  if (fp.on && !fp.fish) {
    setFightView(fp.view || 'virtual');
    startHandCam();
    stepAggro(0);
  } else if (fp.on && fp.fish) {
    setFightView(fp.view || 'virtual');
  }
  if (!fp.on && camera) { camera.near = 0.1; camera.fov = 42; camera.updateProjectionMatrix(); }
}
async function startFpXR() {
  fp.xr = 'requesting';
  if (!navigator.xr || !navigator.xr.requestSession) { fp.xr = 'no-api'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['local-floor', 'hand-tracking'] });
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    fp.xr = 'session';
    session.addEventListener('end', () => { fp.xr = 'ended'; renderer.xr.enabled = false; });
  } catch (e) {
    fp.xr = 'failed';
  }
}
function gloveMat(hex) {
  const color = new THREE.Color(hex);
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      precision mediump float; varying vec3 vN; uniform vec3 uColor;
      void main(){
        float wrap = dot(normalize(vN), normalize(vec3(0.2, 0.75, 0.45))) * 0.5 + 0.55;
        gl_FragColor = vec4(uColor * (0.72 + wrap * 0.45), 1.0);
      }`,
  });
}
function ensureFpArms() {
  if (fpArms) return;
  fpArms = new THREE.Group();
  const sleeve = gloveMat('#3e4c68');
  const cuff = gloveMat('#f4efe6');
  const glove = gloveMat('#6d5344');
  const make = (side) => {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.4, 6, 10), sleeve);
    fore.rotation.x = 1.15;
    fore.rotation.z = side * 0.28;
    fore.position.set(side * 0.32, -0.34, -0.55);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), cuff);
    band.rotation.x = 1.15;
    band.position.set(side * 0.3, -0.42, -0.72);
    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), glove);
    mitt.scale.set(1.05, 0.78, 1.35);
    mitt.position.set(side * 0.26, -0.5, -0.9);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.04, 4, 6), glove);
    thumb.position.set(side * 0.2, -0.48, -0.84);
    thumb.rotation.z = side * -0.9;
    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd36a })
    );
    palm.position.set(side * 0.26, -0.5, -0.82);
    palm.name = 'palm';
    g.add(fore, band, mitt, thumb, palm);
    g.userData.side = side;
    return g;
  };
  fpArms.add(make(-1), make(1));
  fpArms.visible = false;
  fpArms.frustumCulled = false;
  fpArms.traverse((o) => { o.frustumCulled = false; });
  scene.add(fpArms);
}
let fpArms = null;
function attachGloves() {
  if (!vrm || !vrm.humanoid) return;
  ['left', 'right'].forEach((side) => {
    const bone = vrm.humanoid.getNormalizedBoneNode(side + 'Hand');
    if (!bone || bone.getObjectByName('glove')) return;
    const g = new THREE.Group();
    g.name = 'glove';
    const cuff = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.14, 6, 12), toonMat('#241c18'));
    cuff.position.y = -0.02;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), toonMat('#f0c4a4'));
    hand.scale.set(1.05, 0.72, 1.25);
    hand.position.y = 0.05;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: side === 'right' ? 0xffd36a : 0xfff1c4 }));
    palm.name = 'palm';
    palm.position.set(0, 0.045, 0.03);
    g.add(cuff, hand, palm);
    g.traverse((o) => { o.frustumCulled = false; if (o.layers) { o.layers.enable(0); o.layers.enable(1); } });
    bone.add(g);
  });
}
function frameFp() {
  const gy = groundY(px, pz);
  const ahead = new THREE.Vector3(Math.sin(fp.yaw), 0, Math.cos(fp.yaw));
  const pitch = fp.pitch || 0;
  camera.near = 0.08;
  camera.fov = fp.body ? 56 : 64;
  camera.updateProjectionMatrix();
  camera.position.set(px, gy + 1.55, pz).addScaledVector(ahead, 0.1);
  camera.up.set(0, 1, 0);
  const lookDist = 8;
  const lx = px + ahead.x * lookDist;
  const lz = pz + ahead.z * lookDist;
  const ly = gy + 1.5 - Math.sin(pitch) * 4.2;
  camera.lookAt(lx, ly, lz);
  if (fp.body) {
    const vm = ensureVmCam();
    vm.aspect = camera.aspect;
    const narrow = camera.aspect < 0.9;
    vm.fov = fp.fish ? (narrow ? 62 : 50) : (narrow ? 66 : 46);
    vm.near = fp.fish ? 0.05 : (narrow ? 0.4 : 0.28);
    vm.far = 6;
    vm.position.copy(camera.position);
    if (fp.fish) vm.position.addScaledVector(ahead, 0.22);
    vm.up.set(0, 1, 0);
    const aim = fp.fish
      ? new THREE.Vector3(px + ahead.x * 1.15, gy + 1.22, pz + ahead.z * 1.15)
      : new THREE.Vector3(px + ahead.x * (narrow ? 0.5 : 0.62), gy + (narrow ? 0.95 : 0.9), pz + ahead.z * (narrow ? 0.5 : 0.62));
    vm.lookAt(aim);
    vm.updateProjectionMatrix();
    if (fpFill) {
      fpFill.position.copy(vm.position).add(new THREE.Vector3(-ahead.z * 0.25, 0.35, ahead.x * 0.25));
      fpFill.target.position.copy(aim);
      fpFill.target.updateMatrixWorld();
    }
  }
  facing = fp.yaw;
  if (fpArms) {
    fpArms.visible = !!fp.on && !fp.body;
    if (fpArms.visible) {
      fpArms.position.copy(camera.position);
      fpArms.quaternion.copy(camera.quaternion);
    }
  }
  if (vrm && vrm.humanoid) {
    const palm = vrm.humanoid.getNormalizedBoneNode('rightHand');
    const glow = palm && (palm.getObjectByName('fpPalm') || palm.getObjectByName('palm'));
    if (glow && glow.material) {
      const hot = fp.cast > 0;
      glow.material.color.setHex(fp.kind === 'fire' ? 0xff7a3a : 0xffe7a8);
      glow.material.opacity = hot ? 0.8 : 0;
      glow.material.transparent = true;
      glow.material.depthWrite = false;
      glow.material.depthTest = false;
      const s = hot ? 1 : 0.4;
      glow.scale.setScalar(s);
      glow.visible = true;
    }
  }
  poseFpBody();
  placeCamPlate();
  parkFishRod();
  if (skyMat) skyMat.uniforms.uCam.value.copy(camera.position);
}
function poseFpBody() {
  if (!fp.on || !fp.body || !vrm || !vrm.humanoid) return;
  const setBone = (name, x, y, z) => {
    const b = vrm.humanoid.getNormalizedBoneNode(name);
    if (b) b.rotation.set(x, y, z);
  };
  if (fp.fish) {
    const fishNow = window.__aroFishPose && window.__aroFishPose();
    const tug = fishNow && (fishNow.phase === 'nibble' || fishNow.phase === 'fight');
    const bend = tug ? (fishNow.kind === 'heavy' ? 0.45 : 0.24) : 0;
    const narrow = vmCam && vmCam.aspect < 0.9;
    setBone('hips', 0, 0, 0);
    setBone('spine', 0.1, 0, 0);
    setBone('chest', 0.05, 0, 0);
    setBone('leftUpperArm', 1.15, 0.72, 0.2);
    setBone('leftLowerArm', 1.05, 0.12, 0.08);
    setBone('leftHand', -0.45, -0.25, 0.25);
    setBone('rightUpperArm', 1.28 + bend, -0.42, -0.18);
    setBone('rightLowerArm', 0.95 + bend, -0.08, -0.06);
    setBone('rightHand', -0.3, 0.28, -0.16);
    ['Index', 'Middle', 'Ring', 'Little'].forEach((finger) => {
      setBone('right' + finger + 'Proximal', 0.9, 0, 0);
      setBone('right' + finger + 'Intermediate', 0.7, 0, 0);
      setBone('left' + finger + 'Proximal', 0.55, 0, 0);
    });
    setBone('rightThumbProximal', -0.4, 0.5, 0.3);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    if (head) head.scale.setScalar(0.001);
    vrm.humanoid.update();
    if (vrm.scene) vrm.scene.updateMatrixWorld(true);
    return;
  }
  const punch = fp.cast > 0 ? Math.sin((1 - Math.min(fp.cast, 0.35) / 0.35) * Math.PI) : 0;
  const ready = fp.cast > 0 || (fp.track && fp.track.charge > 0.08) || !!(fightBeast && fightBeast.visible);
  const moving = moveSpeed > 0.28;
  const running = moveSpeed > 1.15;
  if (!ready) {
    const swing = Math.sin(worldT * (running ? 8.5 : 4.2)) * (running ? 0.62 : 0.32) * (moving ? 1 : 0.2);
    setBone('hips', 0, 0, 0);
    setBone('spine', 0.06, 0, 0);
    setBone('chest', 0.02, 0, 0);
    setBone('leftUpperArm', 0.42 + swing, 0.28, 0.42);
    setBone('leftLowerArm', 0.55, 0.04, 0.04);
    setBone('leftHand', 0.1, -0.2, 0.15);
    setBone('rightUpperArm', 0.42 - swing, -0.28, -0.42);
    setBone('rightLowerArm', 0.55, -0.04, -0.04);
    setBone('rightHand', 0.1, 0.2, -0.15);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    if (head) head.scale.setScalar(0.001);
    vrm.humanoid.update();
    return;
  }
  const sway = Math.sin(worldT * 1.25) * 0.06;
  setBone('hips', 0, 0, 0);
  setBone('spine', 0.08, 0, 0);
  setBone('chest', 0.04, 0, 0);
  const narrow = vmCam && vmCam.aspect < 0.9;
  setBone('leftUpperArm', (narrow ? 0.02 : 0.16) + sway, narrow ? 1.45 : 1.12, narrow ? 0.08 : 0.48);
  setBone('leftLowerArm', 0.28, 0.1, 0.04);
  const hand = [0.15, -0.95, 0.48];
  setBone('leftHand', -hand[0], -hand[1], -hand[2]);
  setBone('rightUpperArm', (narrow ? 0.04 : 0.2) + punch * 0.08 - sway, narrow ? -1.35 : -1.02, narrow ? -0.06 : -0.4);
  setBone('rightLowerArm', 0.22 - punch * 0.04, -0.08, -0.02);
  setBone('rightHand', hand[0], hand[1], hand[2]);
  const spread = 0.32 + (fp.cast > 0 ? 0.1 : 0);
  ['Index', 'Middle', 'Ring', 'Little'].forEach((finger, i) => {
    const splay = (i - 1.5) * spread;
    const curl = (fp.cast > 0 ? 0.04 : 0.14) + Math.abs(i - 1.5) * 0.03;
    setBone('right' + finger + 'Proximal', curl, splay, 0);
    setBone('right' + finger + 'Intermediate', curl * 0.7, 0, 0);
    setBone('right' + finger + 'Distal', curl * 0.45, 0, 0);
    setBone('left' + finger + 'Proximal', curl, splay * 0.7, 0);
    setBone('left' + finger + 'Intermediate', curl * 0.55, 0, 0);
  });
  setBone('rightThumbProximal', -0.55, 0.45, 0.55);
  setBone('rightThumbIntermediate', -0.2, 0, 0);
  setBone('leftThumbProximal', -0.4, -0.3, -0.35);
  const head = vrm.humanoid.getNormalizedBoneNode('head');
  if (head) head.scale.setScalar(0.001);
  vrm.humanoid.update();
  ['leftLowerArm', 'rightLowerArm'].forEach((name) => {
    const b = vrm.humanoid.getNormalizedBoneNode(name);
    if (b) b.scale.set(0.58, 1, 0.58);
  });
  ['leftHand', 'rightHand'].forEach((name) => {
    const b = vrm.humanoid.getNormalizedBoneNode(name);
    if (b) b.scale.set(1.62, 1, 1.62);
  });
  if (vrm.scene) vrm.scene.updateMatrixWorld(true);
}
function paintChargeArm() {
  if (!vrm || !vrm.humanoid) return;
  const arm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
  if (!arm) return;
  let fill = arm.getObjectByName('chargeFill');
  if (!fill) {
    fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.42, 0.09),
      new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, depthTest: false })
    );
    fill.name = 'chargeFill';
    fill.layers.set(2);
    fill.renderOrder = 8;
    arm.add(fill);
  }
  const charge = Math.max(0, Math.min(1, fp.track.charge || 0));
  const show = fp.on && fp.view !== 'camera' && !fp.fish && charge > 0.04;
  fill.visible = show;
  const len = 0.08 + charge * 0.55;
  const armPos = new THREE.Vector3();
  const handPos = new THREE.Vector3();
  arm.getWorldPosition(armPos);
  const handBone = vrm.humanoid.getNormalizedBoneNode('rightHand');
  if (handBone) handBone.getWorldPosition(handPos); else handPos.copy(armPos);
  const along = armPos.clone().lerp(handPos, 0.25 + charge * 0.6);
  if (fill.parent !== scene) scene.add(fill);
  fill.layers.set(2);
  fill.position.copy(along);
  const eye = (vmCam || camera).position;
  fill.position.add(eye.clone().sub(along).normalize().multiplyScalar(0.12));
  fill.scale.set(1.4, len / 0.42, 1.4);
  fill.lookAt(handPos);
  fill.rotateX(Math.PI / 2);
  fill.renderOrder = 999;
}
function fpShoot(kind, power) {
  if (!fp.on) return;
  const p = power == null ? 1 : Math.max(0.18, Math.min(1, power));
  if ((fp.vials[kind] | 0) <= 0) fp.vials[kind] = 3;
  fp.vials[kind] -= 1;
  fp.cast = 0.22 + p * 0.2;
  facing = fp.yaw;
  castSpell(kind, p);
  fp.pulse = 0.28;
  fp.track.state = 'fired';
  fp.track.firedUntil = performance.now() + 700;
  fp.track.charge = 0;
}
function aimYaw() {
  if (!fp.fish || !fp.steady || !field) return fp.yaw;
  const lake = field.anchors.lake;
  const want = Math.atan2(lake[0] - px, lake[1] - pz);
  const d = Math.atan2(Math.sin(want - fp.yaw), Math.cos(want - fp.yaw));
  return fp.yaw + d * 0.82;
}
function castSpot(power) {
  const yaw = aimYaw();
  const reach = 5 + Math.max(0, Math.min(1, power)) * 11;
  const x = px + Math.sin(yaw) * reach;
  const z = pz + Math.cos(yaw) * reach;
  const y = (kindAt(x, z) === 3 ? -0.22 : groundY(x, z)) + 0.08;
  return { x, y, z };
}
function ensureCastGear() {
  if (!bobber) {
    bobber = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe23a32 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf7fbff }));
    cap.scale.y = 0.42;
    cap.position.y = 0.05;
    bobber.add(ball, cap);
    scene.add(bobber);
  }
  if (!fishLine) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    fishLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.95 }));
    fishLine.frustumCulled = false;
    scene.add(fishLine);
    fishGlow = new THREE.Line(geo.clone(), new THREE.LineBasicMaterial({ color: 0x7ef0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    fishGlow.frustumCulled = false;
    scene.add(fishGlow);
  }
  if (!castRing) {
    castRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe7a8, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false })
    );
    castRing.rotation.x = -Math.PI / 2;
    scene.add(castRing);
  }
}
function stepBobber() {
  const fishing = fp.on && fp.fish && field;
  if (!fishing) {
    if (bobber) bobber.visible = false;
    if (fishLine) fishLine.visible = false;
    if (fishGlow) fishGlow.visible = false;
    if (castRing) castRing.visible = false;
    if (rodLine) rodLine.visible = false;
    fp.land = null;
    return;
  }
  ensureCastGear();
  if (rodLine) rodLine.visible = false;
  const pose = window.__aroFishPose ? window.__aroFishPose() : { phase: 'aim', kind: 'light', t: 0 };
  const cast = pose.phase && pose.phase !== 'aim';
  const tug = pose.phase === 'nibble' || pose.phase === 'fight';
  if (!cast) {
    fp.land = null;
    bobber.visible = false;
    fishLine.visible = false;
    fishGlow.visible = false;
    const power = Math.max(0.15, Math.min(1, fp.fishPower || 0.35));
    const spot = castSpot(power);
    castRing.visible = true;
    castRing.position.set(spot.x, spot.y + 0.04, spot.z);
    const s = 0.55 + power * 1.7;
    castRing.scale.set(s, s, s);
    return;
  }
  if (!fp.land || fp.land.phase !== pose.phase && pose.phase === 'fly') {
    const power = Math.max(0.15, Math.min(1, (window.FI && window.FI.castPower) || fp.fishPower || 0.6));
    const spot = castSpot(power);
    fp.land = { x: spot.x, z: spot.z, phase: pose.phase };
  } else fp.land.phase = pose.phase;
  castRing.visible = false;
  const side = Math.cos(fp.yaw);
  const fwd = Math.sin(fp.yaw);
  const drift = tug ? 0 : Math.sin(worldT * 0.7) * 0.45;
  const x = fp.land.x + side * drift;
  const z = fp.land.z - fwd * drift;
  let dip = tug ? (pose.kind === 'heavy' ? -0.16 : -0.06) : Math.sin(worldT * 1.6) * 0.04;
  const y = (kindAt(x, z) === 3 ? -0.22 : groundY(x, z)) + 0.1 + dip;
  bobber.visible = true;
  bobber.position.set(x, y, z);
  let tip = new THREE.Vector3(px, groundY(px, pz) + 1.2, pz);
  if (rod) {
    tip.set(0, 1.45, 0);
    rod.localToWorld(tip);
  }
  const sag = tug ? 0.05 : 1.35 + Math.sin(worldT * 1.3) * 0.12;
  const pos = fishLine.geometry.attributes.position;
  const glow = fishGlow.geometry.attributes.position;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const pxv = tip.x + (x - tip.x) * t;
    const pzv = tip.z + (z - tip.z) * t;
    const bow = Math.sin(t * Math.PI) * sag;
    const py = tip.y + (y - tip.y) * t - bow;
    const lat = Math.cos(aimYaw());
    const laz = -Math.sin(aimYaw());
    const lx = pxv + lat * bow * 0.25;
    const lz = pzv + laz * bow * 0.25;
    pos.setXYZ(i, lx, py, lz);
    glow.setXYZ(i, lx, py + 0.03, lz);
  }
  pos.needsUpdate = true;
  glow.needsUpdate = true;
  fishLine.geometry.computeBoundingSphere();
  fishGlow.geometry.computeBoundingSphere();
  fishLine.visible = true;
  fishGlow.visible = true;
  const hot = 0.55 + (tug ? 0.45 : 0.2) * (0.5 + 0.5 * Math.sin(worldT * (tug ? 10 : 2)));
  fishGlow.material.opacity = hot;
  if (rod && tug) rod.rotateX(pose.kind === 'heavy' ? 0.42 : 0.22);
}
function handHull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
function paintHandOcc() {
  const parked = document.getElementById('handOcc');
  if (parked) parked.style.display = 'none';
  return;
  let cv = document.getElementById('handOcc');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'handOcc';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;display:none';
    document.body.appendChild(cv);
  }
  const lm = fp.track.lm;
  const show = fp.on && fp.view === 'camera' && !fp.fish && lm && lm.length > 4 && handVideo && handVideo.videoWidth;
  cv.style.display = show ? 'block' : 'none';
  if (!show) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const pts = [];
  for (let i = 0; i < lm.length; i++) pts.push({ x: lm[i].x * w, y: lm[i].y * h });
  const hull = handHull(pts);
  if (hull.length < 3) return;
  let cx = 0, cy = 0;
  hull.forEach((p) => { cx += p.x; cy += p.y; });
  cx /= hull.length; cy /= hull.length;
  ctx.save();
  ctx.drawImage(handVideo, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(10px)';
  ctx.beginPath();
  hull.forEach((p, i) => {
    const x = cx + (p.x - cx) * 1.22;
    const y = cy + (p.y - cy) * 1.22;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}
function fishCastOut() {
  const phase = typeof window.__aroReel === 'function' ? window.__aroReel() : '';
  return phase === 'fly' || phase === 'wait' || phase === 'nibble' || phase === 'reel' || phase === 'fight' || phase === 'catch';
}
function seatFishRod() {
  if (!rod || !fp.on || !fp.fish) return;
  const cam = vmCam || camera;
  if (!cam) return;
  if (rod.parent !== scene) scene.add(rod);
  rod.traverse((o) => { if (o.layers) o.layers.set(2); });
  rod.visible = true;
  rod.frustumCulled = false;
  rod.renderOrder = 8;
  rod.scale.setScalar(0.62);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  rod.position.copy(cam.position).addScaledVector(fwd, 0.48).addScaledVector(right, 0.1).addScaledVector(up, -0.12);
  rod.quaternion.copy(cam.quaternion);
  rod.rotateX(-0.75);
  rod.rotateZ(0.18);
  if (rodLine) rodLine.visible = false;
}
function parkFishRod() {
  if (!rod || !fp.on || !fp.fish || !camera) return;
  if (fp.view !== 'camera') { seatFishRod(); return; }
  if (rod.parent !== scene) scene.add(rod);
  rod.traverse((o) => { if (o.layers) o.layers.set(0); });
  rod.visible = true;
  rod.frustumCulled = false;
  rod.renderOrder = 6;
  rod.scale.setScalar(0.68);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  rod.position.copy(camera.position).addScaledVector(fwd, 0.52).addScaledVector(right, 0.04).addScaledVector(up, -0.12);
  rod.quaternion.copy(camera.quaternion);
  rod.rotateX(-0.82);
  rod.rotateZ(0.08);
  if (rodLine) rodLine.visible = false;
}
function paintTrack() {
  const el = document.getElementById('fpTrack');
  const ring = document.getElementById('fpRing');
  if (el) {
    if (fp.fish) {
      const phase = window.__aroReel ? window.__aroReel() : '';
      if (!fp.lookLock) el.textContent = 'Look, then Lock';
      else if (phase === 'aim' || phase === '') el.textContent = 'Hold to cast';
      else el.textContent = 'Line is out';
      el.classList.toggle('hot', !!fp.lookLock);
      if (ring) ring.classList.remove('on');
      paintHandDebug();
      paintHandGuide();
      return;
    }
    const words = {
      off: 'Hold, then release to cast',
      blocked: 'Camera blocked · tap to cast',
      model: 'Hands didn’t load · tap to cast',
      looking: 'Show an open palm',
      seen: 'Hand seen',
      charging: 'Charging',
      fired: 'Fired',
    };
    el.textContent = words[fp.track.state] || words.off;
    el.classList.toggle('hot', fp.track.state === 'charging' || fp.track.state === 'fired' || fp.track.state === 'seen');
  }
  if (ring) {
    const show = fp.on && (fp.track.state === 'seen' || fp.track.state === 'charging' || fp.track.state === 'fired' || fp.holding);
    ring.classList.toggle('on', show);
    const ax = fp.holding && !fp.track.ready ? fp.track.x : (fp.aimX || 0.5);
    const ay = fp.holding && !fp.track.ready ? fp.track.y : (fp.aimY || 0.44);
    ring.style.left = (ax * window.innerWidth) + 'px';
    ring.style.top = (ay * window.innerHeight) + 'px';
    const mark = ring.querySelector('i');
    if (mark) mark.style.transform = 'scale(' + (0.2 + fp.track.charge * 0.8) + ')';
  }
  paintHandDebug();
  paintHandGuide();
}
function neonHand(cx, cy) {
  const pts = [];
  for (let i = 0; i < 21; i++) pts.push({ x: cx, y: cy });
  const mark = { 0: [0.02, 0.1], 5: [-0.08, 0.02], 8: [-0.1, -0.08], 9: [0, 0], 12: [0.01, -0.11], 13: [0.05, 0.02], 16: [0.08, -0.08], 17: [0.09, 0.04], 20: [0.12, -0.02] };
  Object.keys(mark).forEach((k) => { pts[k] = { x: cx + mark[k][0], y: cy + mark[k][1] }; });
  return pts;
}
function guideSpot(nx, ny, w, h) {
  const vw = (handVideo && handVideo.videoWidth) || 0;
  const vh = (handVideo && handVideo.videoHeight) || 0;
  if (vw < 2 || vh < 2) return { x: nx * w, y: ny * h };
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  return { x: (w - dw) / 2 + nx * dw, y: (h - dh) / 2 + ny * dh };
}
function paintHandGuide() {
  const guide = document.getElementById('handGuide');
  if (!guide) return;
  const fight = fp.on && !fp.fish;
  const lm = fp.track.lm;
  const palm = lm && (lm[9] || lm[0]);
  const aimNx = fp.aimX || 0.5;
  const aimNy = fp.aimY || 0.44;
  const onTarget = !!(palm && fp.track.inside) || (fight && (fp.track.hands | 0) > 0 && fp.track.state !== 'looking' && palm && Math.hypot(palm.x - aimNx, palm.y - aimNy) < 0.08);
  guide.classList.toggle('locked', fight && onTarget);
  guide.classList.toggle('hot', fight && fp.track.state === 'charging');
  let glow = guide.querySelector('canvas');
  if (!glow) {
    glow = document.createElement('canvas');
    guide.appendChild(glow);
  }
  const w = Math.max(96, Math.round(guide.clientWidth || 112));
  const h = Math.max(128, Math.round(guide.clientHeight || 150));
  if (glow.width !== w || glow.height !== h) { glow.width = w; glow.height = h; }
  const ctx = glow.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!fight) return;
  const aim = guideSpot(aimNx, aimNy, w, h);
  const hot = fp.track.state === 'charging';
  const r = 22 + (fp.track.charge || 0) * 8;
  ctx.lineWidth = onTarget ? 3 : 2;
  ctx.strokeStyle = hot ? '#ffe08a' : (onTarget ? '#7dffb0' : '#39f6ff');
  ctx.fillStyle = hot ? 'rgba(255,224,138,.45)' : (onTarget ? 'rgba(125,255,176,.42)' : 'rgba(57,246,255,.08)');
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = onTarget ? 14 : 6;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (palm) {
    const hp = guideSpot(palm.x, palm.y, w, h);
    if (!onTarget) {
      ctx.strokeStyle = '#39f6ff';
      ctx.fillStyle = '#39f6ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#39f6ff';
      ctx.shadowBlur = 8;
      const dx = aim.x - hp.x;
      const dy = aim.y - hp.y;
      const len = Math.hypot(dx, dy) || 1;
      const tipx = aim.x - (dx / len) * (r + 2);
      const tipy = aim.y - (dy / len) * (r + 2);
      ctx.beginPath();
      ctx.moveTo(hp.x, hp.y);
      ctx.lineTo(tipx, tipy);
      ctx.stroke();
      const ux = dx / len;
      const uy = dy / len;
      ctx.beginPath();
      ctx.moveTo(tipx, tipy);
      ctx.lineTo(tipx - ux * 9 - uy * 5, tipy - uy * 9 + ux * 5);
      ctx.lineTo(tipx - ux * 9 + uy * 5, tipy - uy * 9 - ux * 5);
      ctx.closePath();
      ctx.fill();
    }
    const links = [[0, 5], [5, 8], [0, 9], [9, 12], [0, 13], [13, 16], [0, 17], [17, 20], [5, 9], [9, 13], [13, 17]];
    ctx.strokeStyle = onTarget ? '#b8ffd8' : '#5ef6ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const pair of links) {
      const a = lm[pair[0]];
      const b = lm[pair[1]];
      if (!a || !b) continue;
      const pa = guideSpot(a.x, a.y, w, h);
      const pb = guideSpot(b.x, b.y, w, h);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#eafff8';
    for (const p of lm) {
      if (!p) continue;
      const pp = guideSpot(p.x, p.y, w, h);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
function handDebugOn() {
  return fp.track.forceDebug || /(?:\?|&)handdebug=1(?:&|$)/.test(location.search);
}
function paintHandDebug() {
  const el = document.getElementById('handDebug');
  if (!el) return;
  const on = handDebugOn();
  el.classList.toggle('on', on);
  if (!on) return;
  const d = fp.track;
  const lines = [
    'model ' + (d.model || 'idle'),
    'vision ' + (d.vision || '—'),
    'delegate ' + (d.delegate || 'none'),
    'video ' + (d.video || 'off'),
    'fps ' + (d.fps || 0),
    'hands ' + (d.hands | 0),
    'state ' + (d.state || 'off'),
  ];
  if (d.err) lines.push('err ' + d.err);
  if (d.errWhere) lines.push(d.errWhere);
  el.textContent = lines.join('\n');
}
let handLandmarker = null;
let handVideo = null;
let handCanvas = null;
let handBusy = false;
let handTs = 0;
let handVision = null;
let handFiles = null;
let handEmpty = 0;
const VISION_VER = '0.10.17';
const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VISION_VER;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
function formatHandErr(e) {
  const msg = e && e.message ? String(e.message) : (e && e.name) || String(e);
  const parts = e && e.stack ? String(e.stack).split('\n').map((s) => s.trim()).filter(Boolean) : [];
  fp.track.err = msg.slice(0, 220);
  fp.track.errWhere = (parts[1] || parts[0] || '').slice(0, 180);
}
function clearDbgClash() {
  if (typeof window.dbg === 'function') return;
  const el = document.getElementById('dbg');
  if (el) el.id = 'fpsRead';
  try { delete window.dbg; } catch (err) { /* named elements can stay */ }
}
function appleHandDevice() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function cameraDenied(err) {
  const name = err && err.name;
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError';
}
function nextHandTs() {
  const t = performance.now();
  handTs = t > handTs ? t : handTs + 1;
  return handTs;
}
async function makeHandLandmarker(delegate) {
  clearDbgClash();
  if (!handVision) {
    handVision = await import(VISION_BASE + '/vision_bundle.mjs');
    handFiles = await handVision.FilesetResolver.forVisionTasks(VISION_BASE + '/wasm');
  }
  return handVision.HandLandmarker.createFromOptions(handFiles, {
    baseOptions: { modelAssetPath: HAND_MODEL, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
  });
}
function stopHandStream() {
  if (handVideo && handVideo.srcObject) {
    handVideo.srcObject.getTracks().forEach((t) => t.stop());
    handVideo.srcObject = null;
  }
}
async function startHandCam() {
  if (handBusy) return;
  if (handLandmarker && handVideo && handVideo.srcObject) return;
  handBusy = true;
  fp.track.hold = false;
  fp.track.err = '';
  fp.track.state = 'looking';
  fp.track.model = 'starting';
  paintTrack();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
    });
    if (!handVideo) handVideo = document.createElement('video');
    handVideo.id = 'handCam';
    handVideo.muted = true;
    handVideo.defaultMuted = true;
    handVideo.autoplay = true;
    handVideo.playsInline = true;
    handVideo.setAttribute('playsinline', 'true');
    handVideo.setAttribute('webkit-playsinline', 'true');
    handVideo.srcObject = stream;
    let guide = document.getElementById('handGuide');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'handGuide';
      const spot = document.createElement('i');
      guide.appendChild(spot);
      document.body.appendChild(guide);
    }
    if (handVideo.parentNode !== guide) guide.insertBefore(handVideo, guide.firstChild);
    await handVideo.play();
    if (!handVideo.videoWidth) {
      await new Promise((resolve) => {
        const done = () => resolve();
        handVideo.addEventListener('loadeddata', done, { once: true });
        setTimeout(done, 700);
      });
    }
    fp.track.video = (handVideo.videoWidth || 0) + 'x' + (handVideo.videoHeight || 0) + ' ready ' + handVideo.readyState;
    fp.track.vision = VISION_VER;
    const order = appleHandDevice() ? ['CPU'] : ['GPU', 'CPU'];
    let lastErr = null;
    handLandmarker = null;
    for (const delegate of order) {
      try {
        handLandmarker = await makeHandLandmarker(delegate);
        fp.track.delegate = delegate;
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        formatHandErr(err);
      }
    }
    if (!handLandmarker) throw lastErr || new Error('Hand landmarker did not start');
    fp.track.ready = true;
    fp.track.model = 'loaded';
    fp.track.state = 'looking';
    fp.track.err = '';
    fp.track.errWhere = '';
    handEmpty = 0;
  } catch (e) {
    fp.track.ready = false;
    fp.track.hands = 0;
    handLandmarker = null;
    formatHandErr(e);
    const live = !!(handVideo && handVideo.srcObject && handVideo.readyState >= 2);
    if (!live) {
      fp.track.video = 'off';
      stopHandStream();
    }
    if (cameraDenied(e)) {
      fp.track.state = 'blocked';
      fp.track.model = 'denied';
    } else {
      fp.track.state = 'model';
      fp.track.model = 'failed';
    }
  }
  handBusy = false;
  paintTrack();
}
async function fallbackHandCpu() {
  if (!handVision || !handFiles || fp.track.delegate === 'CPU' || handBusy) return;
  handBusy = true;
  try {
    const next = await makeHandLandmarker('CPU');
    if (handLandmarker && handLandmarker.close) handLandmarker.close();
    handLandmarker = next;
    fp.track.delegate = 'CPU';
    fp.track.model = 'loaded';
    handEmpty = 0;
  } catch (e) {
    fp.track.err = String((e && e.message) || e).slice(0, 80);
  }
  handBusy = false;
}
function readHandResult() {
  return handLandmarker.detectForVideo(handVideo, nextHandTs());
}
function stepHands() {
  if (!fp.on) return;
  const now = performance.now();
  if (fp.track.dbgT) {
    const span = now - fp.track.dbgT;
    if (span > 0) fp.track.fps = Math.round(1000 / span);
  }
  fp.track.dbgT = now;
  if (handVideo && handVideo.videoWidth) fp.track.video = handVideo.videoWidth + 'x' + handVideo.videoHeight + ' ready ' + handVideo.readyState;
  if (fp.track.hold) { paintTrack(); return; }
  if (fp.track.firedUntil && now < fp.track.firedUntil) {
    fp.track.state = 'fired';
    paintTrack();
    return;
  }
  if (!fp.fish && fp.holding && !fp.look && !fp.track.ready) {
    fp.track.charge = Math.min(1, fp.track.charge + 0.04);
    fp.track.state = 'charging';
    fp.aimX = fp.track.x;
    fp.aimY = fp.track.y;
    if (fp.track.charge >= 1) {
      fp.holding = false;
      fpShoot('aether', 1);
      return;
    }
    paintTrack();
    return;
  }
  if (!handLandmarker || !handVideo || handVideo.readyState < 2 || !handVideo.videoWidth) {
    if (fp.track.state !== 'blocked' && fp.track.state !== 'model') fp.track.state = fp.track.ready ? 'looking' : (fp.holding ? 'charging' : 'off');
    paintTrack();
    return;
  }
  let res = null;
  try { res = readHandResult(); }
  catch (e) {
    formatHandErr(e);
    fp.track.state = 'looking';
    paintTrack();
    return;
  }
  fp.track.err = '';
  fp.track.errWhere = '';
  const hands = res && res.landmarks ? res.landmarks.length : 0;
  const lm = hands ? res.landmarks[0] : null;
  if (!lm) {
    handEmpty += 1;
    if (handEmpty === 90 && fp.track.delegate !== 'CPU') fallbackHandCpu();
    if (fp.track.seenAt && now - fp.track.seenAt < 420) {
      fp.track.hands = 1;
      fp.track.state = fp.track.palmOpen && fp.track.charge > 0.12 ? 'charging' : 'seen';
      paintTrack();
      return;
    }
    if (fp.track.maskHold) { paintTrack(); return; }
    fp.track.hands = 0;
    fp.track.palmOpen = false;
    fp.track.lm = null;
    fp.track.charge = Math.max(0, fp.track.charge - 0.04);
    fp.track.state = 'looking';
    paintTrack();
    return;
  }
  handEmpty = 0;
  fp.track.seenAt = now;
  fp.track.hands = 1;
  fp.track.lm = lm;
  const wrist = lm[0];
  const openN = [8, 12, 16, 20].filter((tip, i) => {
    const pip = [6, 10, 14, 18][i];
    const dw = Math.hypot(lm[tip].x - wrist.x, lm[tip].y - wrist.y);
    const dp = Math.hypot(lm[pip].x - wrist.x, lm[pip].y - wrist.y) || 0.001;
    return dw > dp * (fp.track.palmOpen ? 0.98 : 1.08);
  }).length;
  if (fp.track.palmOpen) fp.track.palmOpen = openN >= 2;
  else fp.track.palmOpen = openN >= 3;
  const palm = lm[9] || wrist;
  const blend = 0.42;
  fp.track.sx = fp.track.sx == null ? palm.x : fp.track.sx + (palm.x - fp.track.sx) * blend;
  fp.track.sy = fp.track.sy == null ? palm.y : fp.track.sy + (palm.y - fp.track.sy) * blend;
  fp.track.sz = fp.track.sz == null ? wrist.z : fp.track.sz + (wrist.z - fp.track.sz) * blend;
  fp.track.x = fp.track.sx;
  fp.track.y = fp.track.sy;
  const span = Math.hypot((lm[12] || palm).x - wrist.x, (lm[12] || palm).y - wrist.y);
  const grew = fp.track.span != null && span > fp.track.span + 0.0035;
  const shrank = fp.track.span != null && span < fp.track.span - 0.0035;
  const zCloser = fp.track.lastZ != null && fp.track.sz < fp.track.lastZ - 0.006;
  const zFarther = fp.track.lastZ != null && fp.track.sz > fp.track.lastZ + 0.006;
  fp.track.span = span;
  const dt = Math.max(0.016, (now - (fp.track.lastT || now)) / 1000);
  const dx = fp.track.sx - (fp.track.lastX == null ? fp.track.sx : fp.track.lastX);
  const dy = fp.track.sy - (fp.track.lastY == null ? fp.track.sy : fp.track.lastY);
  const flick = Math.hypot(dx, dy) / dt;
  fp.track.lastX = fp.track.sx;
  fp.track.lastY = fp.track.sy;
  fp.track.lastZ = fp.track.sz;
  fp.track.lastT = now;
  const aimX = 0.5;
  const aimY = fp.fish ? 0.62 : 0.44;
  fp.aimX = aimX;
  fp.aimY = aimY;
  const rx = 54 / Math.max(1, window.innerWidth);
  const ry = 54 / Math.max(1, window.innerHeight);
  const inside = Math.hypot((fp.track.sx - aimX) / rx, (fp.track.sy - aimY) / ry) < (fp.track.inside ? 1.35 : 1);
  fp.track.inside = inside;
  const pushing = grew || zCloser;
  const pulling = shrank || zFarther;
  if (fp.fish) {
    fp.track.state = inside ? 'seen' : 'looking';
    if (pulling && fp.lookLock && window.__aroHandReel) window.__aroHandReel();
    paintTrack();
    return;
  }
  if (inside && pushing) {
    fp.track.charge = Math.min(1, fp.track.charge + dt * 0.9);
    fp.track.state = 'charging';
    if (fp.track.charge >= 1 && now > (fp.track.cool || 0)) {
      fp.track.cool = now + 700;
      fpShoot('aether', 1);
    }
  } else if (fp.track.charge > 0.12 && (!inside || pulling)) {
    fp.track.cool = now + 500;
    fpShoot('aether', fp.track.charge);
  } else {
    fp.track.state = inside ? 'seen' : 'looking';
  }
  paintTrack();
}
function stepFp(dt) {
  if (fp.cast > 0) fp.cast = Math.max(0, fp.cast - dt);
  if (fp.pulse > 0) fp.pulse = Math.max(0, fp.pulse - dt);
  smoothGyro(dt);
  if (fp.on && fp.fish && fp.lookLock && fp.holding) {
    const phase = window.__aroReel ? window.__aroReel() : '';
    if (phase === 'aim' || phase === '') {
      fp.fishPower = Math.min(1, (fp.fishPower || 0) + dt * 0.85);
      if (window.__aroFishPower) window.__aroFishPower(fp.fishPower);
    }
  }
  const hud = document.getElementById('fpHud');
  if (hud) hud.classList.toggle('pulse', fp.pulse > 0);
  if (palmOrb) palmOrb.visible = false;
  if (!fp.on) return;
  stepAggro(dt);
  stepHands();
  paintChargeArm();
  if (shot === 'fpcast') fp.cast = 0.22;
  fp.clock += dt;
  if (fightBeast) {
    const idle = fightBeast.userData.idle;
    const breathe = Math.sin(worldT * 1.7);
    fightBeast.position.y = groundY(fightBeast.position.x, fightBeast.position.z);
    if (idle) {
      idle.body.scale.set(1.15 + breathe * 0.04, 1.35 - breathe * 0.05, 1.05);
      idle.crown.position.y = 1.95 + breathe * 0.04;
      idle.crown.rotation.z = Math.sin(worldT * 0.9) * 0.06;
      idle.armL.rotation.z = 0.7 + Math.sin(worldT * 1.4) * 0.12;
      idle.armR.rotation.z = -0.7 - Math.sin(worldT * 1.4 + 0.6) * 0.12;
    }
  }
  if (fpArms) {
    const sway = Math.sin(worldT * 1.15);
    fpArms.children.forEach((arm, i) => {
      const side = arm.userData.side || (i ? 1 : -1);
      arm.rotation.z = side * sway * 0.035;
      arm.rotation.x = Math.sin(worldT * 0.8 + i) * 0.025;
    });
  }
  if (hud) {
    const bar = hud.querySelector('[data-hp]');
    const time = hud.querySelector('[data-time]');
    if (bar) bar.style.width = Math.max(0, Math.min(100, fp.hp)) + '%';
    if (time) {
      const s = Math.floor(fp.clock);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      time.textContent = mm + ':' + ss;
    }
  }
}
function frameCamera() {
  if (fp.on) { frameFp(); return; }
  if (playMode !== 'world') { frameRoom(); return; }
  if (shot === 'close') { camDist = 4.2; camPitch = 0.32; }
  else if (shot === 'face') { camDist = 1.05; camPitch = 0.02; }
  else if (shot === 'body') { camDist = 2.7; camPitch = 0.12; }
  else if (shot === 'side') { camDist = 3.5; camPitch = 0.06; camYaw = facing + Math.PI / 2; }
  else if (shot === 'walk') { camDist = 6.2; camPitch = 0.36; }
  else if (shot === 'wide') { camDist = 22; camPitch = 0.22; }
  else if (shot === 'rocks' && superHexes[0]) {
    const h = superHexes[0].position;
    px = h.x + 14;
    pz = h.z + 11;
    aimCamera(px, groundY(px, pz) + 2.6, pz, h.x + 4.2, 1.2, h.z + 3.1);
    return;
  }
  else if ((shot === 'hex' || shot === 'hexin') && superHexes[0]) {
    const h = superHexes[0].position;
    if (shot === 'hex') {
      px = h.x + 26; pz = h.z + 8;
      aimCamera(px, groundY(px, pz) + 6, pz, h.x, 12, h.z);
    } else {
      px = h.x + 2; pz = h.z + 1;
      aimCamera(h.x + 11, 6.5, h.z + 11, h.x, 1.5, h.z);
    }
    return;
  }
  else if (shot === 'sky') {
    const gy = groundY(px, pz);
    aimCamera(px - 1.2, gy + 1.7, pz + 2.4, px + 6, gy + 28, pz - 10);
    return;
  }
  else if (shot === 'tint' && field) {
    const lake = field.anchors.lake;
    let best = nearestWalkable(lake[0], lake[1] + 50);
    let bestScore = -1;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const spot = nearestWalkable(lake[0] + Math.cos(a) * 52, lake[1] + Math.sin(a) * 40);
      const k = kindAt(spot[0], spot[1]);
      if (k == null || k === 3) continue;
      const d = Math.hypot((spot[0] - lake[0]) / 36, (spot[1] - lake[1]) / 24);
      if (d < 1.2) continue;
      const road = nearKind(spot[0], spot[1], 4, 16) ? 3 : 0;
      const score = road + (d < 1.7 ? 2 : 0) + (k === 0 || k === 1 ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = spot; }
    }
    px = best[0]; pz = best[1];
    facing = Math.atan2(lake[0] - px, lake[1] - pz);
    camDist = 12;
    camPitch = 0.78;
    camYaw = facing;
  }
  else if (shot === 'glass' || shot === 'glasswide' || shot === 'glassbody') {
    if (field) {
      const lake = field.anchors.lake;
      const spot = nearestWalkable(lake[0] - 36, lake[1] + 18);
      px = spot[0]; pz = spot[1];
      facing = Math.atan2(lake[0] - px, lake[1] - pz);
    }
    if (shot === 'glass') { camDist = 8; camPitch = 0.34; }
    else if (shot === 'glasswide') { camDist = 18; camPitch = 0.3; }
    else { camDist = 7.5; camPitch = 0.32; }
    camYaw = facing + 0.15;
  }
  else if (shot === 'grass' || shot === 'grasswide' || shot === 'ground' || shot === 'groundwide') {
    const spot = nearestDetail(shot.indexOf('ground') === 0);
    if (spot) { px = spot[0]; pz = spot[1]; facing = 0.6; }
    if (shot === 'grass') { camDist = 3.15; camPitch = 0.82; }
    else if (shot === 'grasswide') { camDist = 16; camPitch = 0.42; }
    else if (shot === 'ground') { camDist = 4.6; camPitch = 0.48; }
    else { camDist = 16; camPitch = 0.4; }
    camYaw = facing + 0.85;
  }
  else if (shot === 'home' && field) {
    const h = field.anchors.home;
    const gy = groundY(h[0], h[1]);
    const spot = nearestWalkable(h[0] + 9, h[1] + 2);
    px = spot[0]; pz = spot[1];
    aimCamera(h[0] + 13, gy + 14.2, h[1] + 11, h[0] - 0.4, gy + 15.6, h[1] - 1.2);
    return;
  } else if (shot === 'npcs' && npcs.length) {
    let sx = 0, sz = 0;
    npcs.forEach((n) => { sx += n.x; sz += n.z; });
    sx /= npcs.length; sz /= npcs.length;
    const spot = nearestWalkable(sx + 1, sz + 7);
    px = spot[0]; pz = spot[1];
    camYaw = Math.atan2(sx - px, sz - pz);
    camDist = 9; camPitch = 0.38;
    dest = null;
  } else if (shot === 'water' && field) {
    const lake = field.anchors.lake;
    const spot = nearestWalkable(lake[0] - 16, lake[1] + 8);
    px = spot[0]; pz = spot[1];
    aimCamera(spot[0], groundY(spot[0], spot[1]) + 8, spot[1], lake[0], 0.4, lake[1]);
    return;
  }
  const y = groundY(px, pz) + (shot === 'face' ? 1.48 : (shot === 'body' || shot === 'side') ? 0.9 : 1.55);
  const cp = Math.cos(camPitch), spn = Math.sin(camPitch);
  aimCamera(
    px + Math.sin(camYaw) * camDist * cp,
    y + camDist * spn,
    pz + Math.cos(camYaw) * camDist * cp,
    px, y, pz
  );
}

function onKey(e, down) {
  if (!active) return;
  if (down && e.code === 'KeyC' && !document.querySelector('.modal.on, #simpleMenu.on, #spineBook.on')) {
    curveEnabled = !curveEnabled;
    return;
  }
  if (down && e.code === 'KeyG' && !document.querySelector('.modal.on, #simpleMenu.on, #spineBook.on')) {
    const order = ['auto', 'default', 'surge', 'rain', 'fire', 'hex'];
    const cur = ['auto', 'default', 'surge', 'rain', 'fire', 'hex'][seamLock + 1] || 'auto';
    const i = order.indexOf(cur);
    setSeam(order[(i + 1) % order.length]);
    return;
  }
  if (down && (e.code === 'Digit1' || e.code === 'Digit2') && !document.querySelector('#simpleMenu.on, #spineBook.on')) {
    castSpell(e.code === 'Digit2' ? 'fire' : 'aether');
    return;
  }
  if (document.querySelector('.modal.on, #simpleMenu.on, #spineBook.on')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const map = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  const slot = map[k.toLowerCase()];
  if (!slot) return;
  e.preventDefault();
  keys[slot] = down ? 1 : 0;
}

function aimPointer(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}
function pickGround(ev) {
  aimPointer(ev);
  if (indoors() && roomFloors.length) {
    const hits = raycaster.intersectObjects(roomFloors, false);
    if (!hits.length) return null;
    return hits[0].point;
  }
  const hits = raycaster.intersectObject(ground, false);
  if (!hits.length) return null;
  const p = hits[0].point;
  if (blocked(p.x, p.z)) {
    if (playMode === 'world' && kindAt(p.x, p.z) === 3 && Math.hypot(px - p.x, pz - p.z) < 16) enterPlay('fish');
    return null;
  }
  return p;
}
function pickSpecial(ev) {
  aimPointer(ev);
  const list = gates.slice();
  if (homeRoot) list.push(homeRoot);
  npcs.forEach((n) => { if (n.group) list.push(n.group); });
  if (!list.length) return null;
  const hits = raycaster.intersectObjects(list, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.pick) o = o.parent;
  return o && o.userData.pick;
}
function useSpecial(pick) {
  shot = '';
  if (pick.kind === 'home') {
    if (Math.hypot(px - pick.x, pz - pick.z) < 14) {
      if (window.__aroBoard) window.__aroBoard();
    } else {
      const spot = nearestWalkable(pick.x + 8, pick.z + 3);
      dest = { x: spot[0], z: spot[1] };
      destFromPick = true;
    }
    return;
  }
  if (pick.kind === 'room') {
    enterPlay(pick.id);
    return;
  }
  if (pick.kind === 'fight') { setFp(true, 'fight'); return; }
  if (pick.kind === 'npc') {
    if (Math.hypot(px - pick.x, pz - pick.z) < 3.6) {
      if (window.__aroSpar) window.__aroSpar(pick.id);
    } else {
      dest = nearestWalkable(pick.x, pick.z + 2);
      dest = { x: dest[0], z: dest[1] };
      destFromPick = true;
    }
  }
}

function bindInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    if (!active) return;
    if (fp.on) {
      fp.holdAt = performance.now();
      fp.downY = e.clientY;
      fp.look = false;
      fp.holding = true;
      fp.track.x = e.clientX / Math.max(1, window.innerWidth);
      fp.track.y = e.clientY / Math.max(1, window.innerHeight);
      if (fp.fish) {
        const phase = window.__aroReel ? window.__aroReel() : '';
        if (fp.lookLock && (phase === 'aim' || phase === '')) {
          fp.fishPower = 0.04;
          if (window.__aroFishPower) window.__aroFishPower(fp.fishPower);
        }
      } else if (!fp.track.ready) {
        fp.track.charge = 0.08;
        fp.track.state = 'charging';
        paintTrack();
      }
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, moved: false, fp: true });
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, moved: false });
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.ox, e.clientY - p.oy) > 12) p.moved = true;
    if (ptrs.size >= 2) {
      const pts = [...ptrs.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (p.pinch && d) camDist = clamp(camDist * (p.pinch / d), 4.2, 52);
      for (const q of ptrs.values()) q.pinch = d;
      return;
    }
    if (fp.on && p.fp) {
      if (!gyro.ready && !(fp.fish && fp.lookLock)) {
        fp.yaw -= dx * 0.005;
        fp.pitch = clamp(fp.pitch - dy * 0.004, -0.7, 0.6);
        gyro.wantYaw = fp.yaw;
        gyro.wantPitch = fp.pitch;
      }
      if (p.moved) fp.look = true;
      return;
    }
    if (p.moved) {
      camYaw -= dx * 0.007;
      camPitch = clamp(camPitch - dy * 0.004, 0.28, 1.15);
      shot = '';
    }
  });
  function endPtr(e) {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    for (const q of ptrs.values()) q.pinch = 0;
    if (p && p.fp && fp.on) {
      fp.holding = false;
      if (fp.fish) {
        const phase = window.__aroReel ? window.__aroReel() : '';
        if (!fp.lookLock) {
          if (!p.moved) toggleFishLock();
        } else if ((phase === 'aim' || phase === '') && (fp.fishPower || 0) > 0.08) {
          if (window.__aroHandCast) window.__aroHandCast(fp.fishPower);
          fp.fishPower = 0;
          if (window.__aroFishPower) window.__aroFishPower(0);
        } else if (!p.moved && phase !== 'aim' && window.__aroFishTap) {
          window.__aroFishTap();
        }
        paintTrack();
        return;
      }
      if (!p.moved && fp.track.charge > 0.08) {
        fpShoot('aether', fp.track.charge);
      }
      else if (!fp.track.ready) {
        fp.track.charge = 0;
        fp.track.state = fp.track.model === 'failed' ? 'model' : 'off';
        paintTrack();
      } else {
        fp.track.charge = Math.max(0, fp.track.charge);
        paintTrack();
      }
      return;
    }
    if (!p || p.moved || ptrs.size) return;
    const special = pickSpecial(e);
    if (special) { useSpecial(special); return; }
    const groundHit = pickGround(e);
    if (groundHit && takeVeggie(groundHit.x, groundHit.z)) return;
    if (!tapOn()) return;
    const hit = pickGround(e);
    if (!hit) return;
    const now = performance.now();
    if (now - (endPtr.last || 0) < 320) runUntil = now + 1700;
    endPtr.last = now;
    dest = { x: hit.x, z: hit.z };
    gpsTarget = null;
    tapGpsBlock = now + 12000;
    tapUntil = now + 2200;
    shot = '';
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); fp.holding = false; });
  canvas.addEventListener('wheel', (e) => {
    if (!active) return;
    e.preventDefault();
    camDist = clamp(camDist * (e.deltaY > 0 ? 1.08 : 0.92), 4.2, 52);
    shot = '';
  }, { passive: false });
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { keys.f = keys.b = keys.l = keys.r = 0; });
}

function startGPS() {
  if (!navigator.geolocation || !field) return;
  navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (!gpsRef) {
      gpsRef = { lat, lon, x: px, z: pz };
      return;
    }
    const dx = (lon - gpsRef.lon) * field.metersPerDegLon;
    const dz = -(lat - gpsRef.lat) * field.metersPerDegLat;
    const moved = Math.hypot(dx, dz);
    if (moved < 12) return;
    const tx = gpsRef.x + dx, tz = gpsRef.z + dz;
    gpsRef = { lat, lon, x: px, z: pz };
    if (dest || performance.now() < tapGpsBlock) return;
    if (!blocked(tx, tz)) gpsTarget = { x: tx, z: tz };
  }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 });
}

function tuneMaps(mat) {
  const keys = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'lightMap', 'shadeMultiplyTexture', 'shadingShiftTexture', 'rimMultiplyTexture', 'matcapTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture'];
  const gl2 = !!(renderer && renderer.capabilities && renderer.capabilities.isWebGL2);
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  for (const key of keys) {
    const tex = mat[key];
    if (!tex || !tex.isTexture) continue;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = gl2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.generateMipmaps = gl2;
    tex.anisotropy = aniso;
    tex.needsUpdate = true;
  }
}
function worldResScale() {
  let low = window.innerWidth < 700;
  try { if (window.__aroHolo && +window.__aroHolo() < 0.5) low = true; }
  catch (e) { /* desktop scale */ }
  return low ? 0.5 : 1;
}
function bindMaterialize(mat, state) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader) => {
    if (prev) prev(shader);
    shader.uniforms.uFill = state.uFill;
    shader.uniforms.uTime = shellU.uTime;
    if (shader.vertexShader.includes('vMatzY')) return;
    shader.vertexShader = 'varying float vMatzY;\nvarying vec3 vMatzP;\n' + shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>
      vec4 matzW = modelMatrix * vec4(transformed, 1.0);
      vMatzY = matzW.y;
      vMatzP = matzW.xyz;`
    );
    shader.fragmentShader = 'varying float vMatzY;\nvarying vec3 vMatzP;\nuniform float uFill;\nuniform float uTime;\n' + shader.fragmentShader;
    const token = 'gl_FragColor = vec4( col, diffuseColor.a );';
    const at = shader.fragmentShader.lastIndexOf(token);
    if (at < 0) return;
    const snip = `
      {
        float above = vMatzY - uFill;
        float band = smoothstep(0.008, 0.0, abs(above));
        if (uFill < 40.0 && above > 0.012) {
          float gx = abs(fract(vMatzP.x * 18.0) - 0.5);
          float gy = abs(fract(vMatzP.y * 18.0) - 0.5);
          float gz = abs(fract(vMatzP.z * 18.0) - 0.5);
          float edge = min(gx, min(gy, gz));
          float wire = 1.0 - smoothstep(0.008, 0.02, edge);
          if (wire < 0.45) discard;
          col = vec3(0.45, 0.92, 1.0);
          diffuseColor.a = 0.45 * wire;
        }
        col += vec3(0.9, 0.96, 1.0) * band * 0.22 * step(uFill, 40.0);
      }
      gl_FragColor = vec4( col, diffuseColor.a );`;
    shader.fragmentShader = shader.fragmentShader.slice(0, at) + snip + shader.fragmentShader.slice(at + token.length);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|matz';
  mat.needsUpdate = true;
}
function kickMaterialize(model, feetY) {
  const s = model && model.userData && model.userData.matz;
  if (!s) return;
  s.t = 0;
  s.t0 = performance.now();
  s.uFill.value = feetY - 0.04;
}
function stepMaterialize(model, root, dt) {
  const s = model && model.userData && model.userData.matz;
  if (!s || !root) return;
  if (model.userData.armMat) {
    model.userData.armMat = false;
    kickMaterialize(model, root.position.y);
  }
  if (s.t >= 1) {
    s.uFill.value = 99;
    return;
  }
  const waited = s.t0 ? (performance.now() - s.t0) / 900 : 0;
  s.t = Math.min(1, Math.max(s.t + dt / 0.72, waited));
  const e = s.t * s.t * (3 - 2 * s.t);
  s.uFill.value = root.position.y - 0.04 + e * 1.9;
}
function stepMatzSparks() {
  if (!matzSparks.length && typeof glowSprite === 'function') {
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Sprite(glowSprite('rgba(230,255,255,1)', 'rgba(255,210,120,0.35)'));
      m.scale.setScalar(0.09);
      m.layers.set(1);
      m.visible = false;
      scene.add(m);
      matzSparks.push(m);
    }
  }
  const actors = [];
  if (vrm && avatar && vrm.userData && vrm.userData.matz && vrm.userData.matz.t < 1) actors.push({ root: avatar, fill: vrm.userData.matz.uFill.value });
  for (const n of npcs) {
    if (n.vrm && n.group && n.vrm.userData && n.vrm.userData.matz && n.vrm.userData.matz.t < 1) actors.push({ root: n.group, fill: n.vrm.userData.matz.uFill.value });
  }
  matzSparks.forEach((sp) => { sp.visible = false; });
  let i = 0;
  for (const a of actors) {
    for (let k = 0; k < 4 && i < matzSparks.length; k++, i++) {
      const sp = matzSparks[i];
      sp.visible = true;
      const ang = worldT * 2.4 + k * 1.5;
      sp.position.set(a.root.position.x + Math.cos(ang) * 0.22, a.fill + k * 0.05 + Math.sin(worldT * 6.0 + k) * 0.03, a.root.position.z + Math.sin(ang) * 0.22);
    }
  }
}
function hairCard(name) {
  return /hair|eyelash|eyeline|brow|highlight|eyeextra/i.test(name || '');
}
function dressVRM(model) {
  model.userData = model.userData || {};
  VRMUtils.removeUnnecessaryVertices(model.scene);
  model.scene.traverse((o) => {
    o.frustumCulled = false;
    o.layers.set(1);
    let mats = o.material ? [].concat(o.material) : [];
    const hair = hairCard(o.name) || mats.some((m) => m && hairCard(m.name));
    if (hair && Array.isArray(o.material)) {
      const kept = o.material.filter((m) => !(m && m.isOutline));
      o.material = kept.length === 1 ? kept[0] : kept;
      mats = kept;
    }
    if (!model.userData.matz) model.userData.matz = { uFill: { value: -20 }, t: 0 };
    mats.forEach((m) => {
      if (!m) return;
      tuneMaps(m);
      if (m.isMToonMaterial) bindMaterialize(m, model.userData.matz);
      if (hair || hairCard(m.name)) {
        if (m.outlineWidthMode != null) m.outlineWidthMode = 'none';
        if (m.outlineWidthFactor != null) m.outlineWidthFactor = 0;
        m.transparent = false;
        m.depthWrite = true;
        m.depthTest = true;
        m.alphaTest = Math.max(m.alphaTest || 0, 0.4);
        m.side = THREE.DoubleSide;
        o.renderOrder = 2;
      } else if (m.outlineWidthFactor != null && m.outlineWidthFactor > 0 && m.outlineWidthFactor < 0.0022) {
        m.outlineWidthFactor = 0.0024;
      }
    });
  });
  if (model.lookAt) model.lookAt.autoUpdate = false;
  const box = new THREE.Box3().setFromObject(model.scene);
  const h = box.max.y - box.min.y || 1.6;
  const s = h > 2.4 ? 1.58 / h : 1;
  model.scene.scale.setScalar(s);
  if (model.springBoneManager) {
    model.springBoneManager.joints.forEach((j) => {
      j.settings.hitRadius = Math.min(0.045, j.settings.hitRadius * s);
    });
    model.scene.updateMatrixWorld(true);
    model.springBoneManager.setInitState();
  }
  return -box.min.y * s;
}
function stepSprings(model, dt, jump) {
  if (!model) return;
  if (model.scene) model.scene.updateMatrixWorld(true);
  const mgr = model.springBoneManager;
  if (mgr && (jump || dt > 0.045)) {
    mgr.reset();
    model.update(Math.min(Math.max(dt, 0), 1 / 60));
    return;
  }
  let left = Math.min(Math.max(dt, 0), 0.05);
  let guard = 0;
  while (left > 0.0001 && guard < 3) {
    const h = Math.min(left, 1 / 60);
    model.update(h);
    left -= h;
    guard++;
  }
}
function loadVRM(url, ok, fail, onProg) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(url, (gltf) => {
    const model = gltf.userData.vrm;
    if (!model) { if (fail) fail(); return; }
    ok(model);
  }, (e) => { if (onProg && e.total) onProg(e.loaded / e.total); }, () => { if (fail) fail(); });
}
function loadAvatar() {
  setLoad(0.12, 'Loading her…');
  loadVRM(VRM_URL, (model) => {
    vrm = model;
    const foot = dressVRM(vrm);
    avatar = new THREE.Group();
    avatar.add(vrm.scene);
    avatar.userData.foot = foot;
    avatar.layers.set(1);
    scene.add(avatar);
    avatarReady = true;
    placeAvatar(0);
    avatar.userData.warm = 12;
    if (vrm) vrm.userData.armMat = true;
    if (rod) avatar.add(rod);
    api.avatarReady = true;
    setLoad(0.62, 'Loading the town…');
  }, () => { api.avatarReady = 'error'; }, (p) => setLoad(0.12 + p * 0.48, 'Loading her…'));
}
function loadNpcs() {
  let left = NPC_URLS.length;
  const done = () => {
    left -= 1;
    setLoad(0.62 + (1 - left / NPC_URLS.length) * 0.38, 'Loading the town…');
    if (left <= 0) api.npcsReady = true;
  };
  NPC_URLS.forEach((spec, i) => {
    const planned = npcSpots[i] || nearestWalkable(px + (i ? -8 : 9), pz + (i ? 5 : -4));
    const spot = nearestWalkable(planned[0], planned[1]);
    loadVRM(spec.url, (model) => {
      const foot = dressVRM(model);
      const group = new THREE.Group();
      group.add(model.scene);
      group.position.set(spot[0], groundY(spot[0], spot[1]) + foot, spot[2] || spot[1]);
      group.userData.pick = { kind: 'npc', id: spec.id, x: spot[0], z: spot[1] };
      const lab = labelSprite('Test NPC · ' + spec.id, '#ffd2a8', [1.05, 0.26]);
      lab.position.y = 1.72;
      group.add(lab);
      scene.add(group);
      const npc = { id: spec.id, vrm: model, group, x: spot[0], z: spot[1], foot, pose: { amp: 0, phase: i }, warm: 12, hp: 3, shadow: addActorShadow(0.72) };
      npcs.push(npc);
      parkShadow(npc.shadow, spot[0], spot[1], true);
      kickMaterialize(model, group.position.y);
      done();
    }, done);
  });
}
function hullOf(mesh) {
  const geo = inflate(mesh.geometry, 0.06);
  const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1a140e, side: THREE.BackSide }));
  ink.position.copy(mesh.position);
  ink.rotation.copy(mesh.rotation);
  ink.scale.copy(mesh.scale);
  return ink;
}
function buildHome(x, z) {
  const y = groundY(x, z);
  homeRoot = new THREE.Group();
  homeRoot.position.set(x, y, z);
  homeRoot.userData.pick = { kind: 'home', x, z };
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.4, 0.42, 6), toonMat('#4e463c'));
  stone.position.y = 0.12;
  const metal = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.12, 6), toonMat('#d5dbe4'));
  metal.position.y = 0.36;
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, depthWrite: false });
  const glow2 = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.85, depthWrite: false });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.08, 8, 48), glow);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.06, 8, 32), glow2);
  ringA.rotation.x = ringB.rotation.x = Math.PI / 2;
  ringA.position.y = ringB.position.y = 0.48;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 3.4), toonMat('#c8b49a'));
  ramp.position.set(6.2, 0.55, 0);
  ramp.rotation.z = -0.55;
  ramp.userData.k = 0;
  homeRoot.add(stone, metal, ringA, ringB, ramp, hullOf(stone));
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const lx = Math.cos(a) * 6.3, lz = Math.sin(a) * 6.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), toonMat('#3a342c'));
    pole.position.set(lx, 1.15, lz);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7a0 }));
    lamp.position.set(lx, 2.05, lz);
    homeRoot.add(pole, lamp);
    lamps.push(lamp);
  }
  const nightLight = new THREE.PointLight(0xffe0a0, 0.12, 18);
  nightLight.position.y = 2.2;
  homeRoot.add(nightLight);
  const zep = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), toonMat('#f4efe2'));
  hull.scale.set(1.7, 1.25, 4.4);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 8, 18), toonMat('#e7b15a'));
  band.rotation.y = Math.PI / 2;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 4), toonMat('#c4554a'));
  fin.rotation.x = Math.PI / 2;
  fin.position.set(0, 0.85, -4.05);
  const finL = fin.clone();
  finL.position.set(-1.35, 0.15, -3.7);
  finL.rotation.z = 0.9;
  const finR = fin.clone();
  finR.position.set(1.35, 0.15, -3.7);
  finR.rotation.z = -0.9;
  const gondola = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toonMat('#c4a07a'));
  gondola.scale.set(1.15, 0.72, 2.15);
  gondola.position.set(0, -1.55, 0.15);
  const windowM = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 1.7), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  windowM.position.set(0, -1.48, 0.35);
  const lampIn = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7a0 }));
  lampIn.position.set(0, -1.35, 0.2);
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMat('#5a5048'));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.18), toonMat('#f2efe6'));
  const blade2 = blade.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(hub, blade, blade2);
  prop.position.set(0, 0, -4.55);
  const propR = prop.clone();
  propR.position.set(1.55, -0.15, -3.6);
  zep.add(hull, band, fin, finL, finR, gondola, windowM, lampIn, prop, propR, hullOf(hull));
  zep.position.y = 18;
  const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 16.2, 5), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
  tether.position.y = 9.2;
  homeRoot.add(zep, tether);
  const sign = labelSprite('Home', '#ffd978');
  sign.position.y = 4.2;
  homeRoot.add(sign);
  homeRoot.userData.rings = [ringA, ringB];
  homeRoot.userData.zep = zep;
  homeRoot.userData.props = [prop, propR];
  homeRoot.userData.ramp = ramp;
  homeRoot.userData.lamps = lamps;
  homeRoot.userData.nightLight = nightLight;
  scene.add(homeRoot);
}

function mountLoader() {
  if (document.getElementById('worldLoad')) return;
  const s = document.createElement('style');
  s.textContent = '#worldLoad{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:40;width:min(280px,78vw);padding:16px;border-radius:16px;background:rgba(22,12,18,.92);border:1px solid rgba(255,214,140,.75);color:#fff6e4;font:800 14px ui-rounded,system-ui;text-align:center}#worldLoad.hide{display:none}#worldLoad b{display:block;height:10px;margin-top:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}#worldLoad i{display:block;height:100%;width:4%;background:linear-gradient(90deg,#ffd978,#ff9ad6)}';
  document.head.appendChild(s);
  const d = document.createElement('div');
  d.id = 'worldLoad';
  d.innerHTML = '<span>Loading the town…</span><b><i></i></b>';
  document.body.appendChild(d);
}
function setLoad(p, text) {
  const el = document.getElementById('worldLoad');
  if (!el) return;
  el.classList.remove('hide');
  if (text) el.querySelector('span').textContent = text;
  el.querySelector('i').style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
}
function hideLoad() {
  const el = document.getElementById('worldLoad');
  if (el) el.classList.add('hide');
}
function renderWorld() {
  const fullW = Math.max(2, renderer.domElement.width);
  const fullH = Math.max(2, renderer.domElement.height);
  const scale = worldResScale();
  const w = Math.max(2, Math.round(fullW * scale));
  const h = Math.max(2, Math.round(fullH * scale));
  if (!rt || rt.width !== w || rt.height !== h) {
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { samples: 0, depthTexture: new THREE.DepthTexture(w, h) });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    rt.texture.magFilter = THREE.LinearFilter;
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    if (!composeScene) {
      const vert = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
      brightMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: { tDiffuse: { value: null } },
        vertexShader: vert,
        fragmentShader: `
          precision mediump float; uniform sampler2D tDiffuse; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            gl_FragColor = vec4(c * smoothstep(0.82, 1.0, l), 1.0);
          }`,
      });
      blurMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
        vertexShader: vert,
        fragmentShader: `
          precision mediump float; uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
          void main(){
            vec3 s = vec3(0.0); float wsum = 0.0;
            for (int i = -5; i <= 5; i++) {
              float w = 1.0 - abs(float(i)) / 6.0;
              s += texture2D(tDiffuse, vUv + uDir * float(i)).rgb * w;
              wsum += w;
            }
            gl_FragColor = vec4(s / wsum, 1.0);
          }`,
      });
      quadMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: {
          tDiffuse: { value: null },
          tBloom: { value: null },
          tDepth: { value: null },
          uTexel: { value: new THREE.Vector2() },
        },
        vertexShader: vert,
        fragmentShader: `
          precision mediump float;
          uniform sampler2D tDiffuse, tBloom, tDepth;
          uniform vec2 uTexel;
          varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float de = abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(-uTexel.x, 0.0)).r);
            de += abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(uTexel.x, 0.0)).r);
            de += abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(0.0, uTexel.y)).r);
            de += abs(texture2D(tDepth, vUv).r - texture2D(tDepth, vUv + vec2(0.0, -uTexel.y)).r);
            c = mix(c, vec3(0.05, 0.04, 0.03), smoothstep(0.018, 0.05, de) * 0.55);
            c += texture2D(tBloom, vUv).rgb * 0.14;
            float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            c *= 0.975 + grain * 0.04;
            vec3 warm = vec3(c.r * 1.05, c.g * 0.99, c.b * 0.9);
            c = mix(c, warm, 0.16);
            float luma = dot(c, vec3(0.3, 0.59, 0.11));
            c = mix(c, vec3(luma) * 0.35 + c * 0.75, 0.08);
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
      composeScene = new THREE.Scene();
      composeScene.add(quad);
      composeCam = new THREE.Camera();
    }
  }
  const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
  if (!bloomA || bloomA.width !== hw || bloomA.height !== hh) {
    if (bloomA) bloomA.dispose();
    if (bloomB) bloomB.dispose();
    bloomA = new THREE.WebGLRenderTarget(hw, hh);
    bloomB = new THREE.WebGLRenderTarget(hw, hh);
  }
  const draw = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(composeScene, composeCam);
  };
  camera.layers.set(0);
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  brightMat.uniforms.tDiffuse.value = rt.texture;
  draw(brightMat, bloomA);
  blurMat.uniforms.tDiffuse.value = bloomA.texture;
  blurMat.uniforms.uDir.value.set(1.6 / hw, 0);
  draw(blurMat, bloomB);
  blurMat.uniforms.tDiffuse.value = bloomB.texture;
  blurMat.uniforms.uDir.value.set(0, 1.6 / hh);
  draw(blurMat, bloomA);
  quadMat.uniforms.tDiffuse.value = rt.texture;
  quadMat.uniforms.tBloom.value = bloomA.texture;
  if (rt.depthTexture) quadMat.uniforms.tDepth.value = rt.depthTexture;
  quadMat.uniforms.uTexel.value.set(1.2 / w, 1.2 / h);
  renderer.setRenderTarget(null);
  draw(quadMat, null);
  renderCharacter(fullW, fullH);
}
function ensureCharTargets(w, h) {
  const samples = Math.min(4, renderer.capabilities.maxSamples || 0);
  if (charRT && charRT.width === w && charRT.height === h && charRT.samples === samples) return;
  if (charRT) charRT.dispose();
  if (charFlat) charFlat.dispose();
  charRT = new THREE.WebGLRenderTarget(w, h, { samples, depthBuffer: true });
    charRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
  charFlat = new THREE.WebGLRenderTarget(w, h, { samples: 0, depthBuffer: false });
  charFlat.texture.colorSpace = THREE.LinearSRGBColorSpace;
  charFlat.texture.magFilter = THREE.LinearFilter;
  charFlat.texture.minFilter = THREE.LinearFilter;
  charFlat.texture.generateMipmaps = false;
  if (!fxaaMat) {
    fxaaMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, transparent: true,
      uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: `
        precision mediump float;
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          vec2 t = resolution;
          vec3 acc = c.rgb * c.a;
          float w = c.a;
          vec2 o[4];
          o[0] = vec2(t.x, 0.0); o[1] = vec2(-t.x, 0.0);
          o[2] = vec2(0.0, t.y); o[3] = vec2(0.0, -t.y);
          for (int i = 0; i < 4; i++) {
            vec4 s = texture2D(tDiffuse, vUv + o[i]);
            float k = s.a * 0.4;
            acc += s.rgb * k;
            w += k;
          }
          gl_FragColor = vec4(acc / max(w, 0.001), c.a);
        }`,
    });
  }
}
function resolveCharacter(w, h) {
  const gl = renderer.getContext();
  if (!gl.blitFramebuffer) return false;
  renderer.setRenderTarget(charRT);
  renderer.setRenderTarget(charFlat);
  const props = renderer.properties;
  const srcP = props.get(charRT);
  const dstP = props.get(charFlat);
  const read = srcP.__webglMultisampledFramebuffer || srcP.__webglFramebuffer;
  const draw = dstP.__webglFramebuffer;
  if (!read || !draw) return false;
  renderer.state.reset();
  while (gl.getError()) { /* drop stale errors */ }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
  gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
  const ok = gl.getError() === gl.NO_ERROR;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok;
}
function renderCharacter(w, h) {
  ensureCharTargets(w, h);
  const prev = renderer.getClearColor(new THREE.Color());
  const prevA = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(charRT);
  renderer.autoClear = true;
  renderer.clear(true, true, true);
  camera.layers.set(1);
  renderer.render(scene, camera);
  if (fp.on && fp.body && vmCam && fp.view !== 'camera') {
    renderer.autoClear = false;
    renderer.clearDepth();
    vmCam.layers.set(2);
    renderer.render(scene, vmCam);
  }
  let src = charRT.texture;
  if ((charRT.samples | 0) > 0) {
    if (resolveCharacter(w, h)) src = charFlat.texture;
    else {
      renderer.setRenderTarget(charFlat);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      if (fp.on && fp.body && vmCam && fp.view !== 'camera') {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(scene, vmCam);
      }
      src = charFlat.texture;
    }
  }
  fxaaMat.uniforms.tDiffuse.value = src;
  fxaaMat.uniforms.resolution.value.set(1 / w, 1 / h);
  renderer.setRenderTarget(null);
  renderer.autoClear = false;
  quad.material = fxaaMat;
  renderer.render(composeScene, composeCam);
  renderer.setClearColor(prev, prevA);
  camera.layers.enable(0);
  camera.layers.enable(1);
  renderer.autoClear = true;
}
function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function tick(dt, show) {
  active = !!show && !!renderer;
  document.body.classList.toggle('world-on', active);
  if (!active || !field) return;
  if (!document.getElementById('gelFight')) mountFpHud();
  if (avatarReady && !fp.booted && !shot && playMode === 'world' && !/[?&]stay=1(?:&|$)/.test(location.search)) {
    fp.booted = true;
    setFp(true, 'fight');
  }
  const step = Math.min(dt, 0.05);
  lastDt = step;
  worldT += step;
  if (playMode === 'fish') {
    const open = document.getElementById('fishM');
    if (open && !open.classList.contains('on')) exitPlay();
  }
  if (shot === 'walk' && !dest && playMode === 'world') dest = { x: px + 7, z: pz + 2.5 };
  const speed = steer(step);
  moveSpeed = speed;
  applyPose(vrm, worldT, step, speed, playerPose);
  const jumped = placeAvatar(speed);
  stepMaterialize(vrm, avatar, step);
  for (const n of npcs) stepMaterialize(n.vrm, n.group, step);
  stepMatzSparks();
  stepSprings(vrm, step, jumped);
  stepLife(step, speed);
  stepPropFade();
  stepVeggies(step);
  for (const n of npcs) {
    if (!n.vrm) continue;
    if ((n.warm | 0) > 0) n.warm -= 1;
    if ((n.down | 0) > 0) n.down = Math.max(0, n.down - step);
    else if ((n.hp | 0) <= 0) n.hp = 3;
    applyPose(n.vrm, worldT, step, 0, n.pose);
    n.group.position.y = standY(n.x, n.z) + n.foot - (n.down > 0 ? 0.45 : 0);
    n.group.rotation.y = Math.atan2(px - n.x, pz - n.z);
    parkShadow(n.shadow, n.x, n.z, !indoors());
    const flash = n.flash > 0;
    if (flash) n.flash -= step;
    n.group.scale.setScalar(flash ? 1.08 : 1);
    stepSprings(n.vrm, step, (n.warm | 0) > 0);
  }
  if (homeRoot && homeRoot.userData.zep && playMode === 'world') {
    const pulse = 0.5 + 0.5 * Math.sin(worldT * 2.4);
    homeRoot.userData.rings[0].material.opacity = 0.45 + pulse * 0.5;
    homeRoot.userData.rings[1].material.opacity = 0.35 + (1 - pulse) * 0.55;
    homeRoot.userData.zep.position.y = 18 + Math.sin(worldT * 0.7) * 0.35;
    homeRoot.userData.zep.rotation.y = Math.sin(worldT * 0.22) * 0.08;
    for (const prop of homeRoot.userData.props || []) prop.rotation.z += step * 9;
    const sunT = window.__aroSun ? window.__aroSun() : 0.2;
    const night = sunT >= 0.88 || sunT < 0.15;
    const ramp = homeRoot.userData.ramp;
    if (ramp) {
      const h = field.anchors.home;
      const near = Math.hypot(px - h[0], pz - h[1]) < 12;
      ramp.userData.k += ((near ? 1 : 0) - ramp.userData.k) * Math.min(1, step * 2.2);
      ramp.rotation.z = -0.55 + ramp.userData.k * 0.42;
      ramp.position.y = 0.55 - ramp.userData.k * 0.34;
    }
    const glow = night ? 1 : 0.35;
    for (const lamp of homeRoot.userData.lamps || []) lamp.scale.setScalar(0.8 + glow * 0.55);
    if (homeRoot.userData.nightLight) homeRoot.userData.nightLight.intensity = night ? 1.7 : 0.1;
  }
  if (grassMesh) {
    const kit = grassMesh.userData.kit;
    if (kit) {
      for (const m of kit.mats) if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = worldT;
      if (kit.player) kit.player.value.set(px, pz);
    }
    if (playMode === 'world' && ((worldT * 4) | 0) !== (grassMesh.userData.step | 0)) {
      grassMesh.userData.step = (worldT * 4) | 0;
      cullGrass(false);
    }
  }
  stepProps(step);
  syncShells();
  stepSuperHexes();
  syncAnchor();
  if (waterMat) {
    waterMat.uniforms.uTime.value = worldT;
    if (camera && waterMat.uniforms.uCam) waterMat.uniforms.uCam.value.copy(camera.position);
    if (waterMat.uniforms.uLift) waterMat.uniforms.uLift.value = fp.on && fp.fish ? 1 : 0;
  }
  stepBobber();
  paintHandOcc();
  applySky();
  syncHolo();
  stepFp(step);
  frameCamera();
  curveU.k.value = curveEnabled ? 0.00024 : 0;
  if (camera) curveU.cam.value.copy(camera.position);
  renderWorld();
  if (avatarReady && api.npcsReady) hideLoad();
}

function syncHolo() {
  const h = holoLevel();
  if (skyMat && skyMat.uniforms.uHolo) skyMat.uniforms.uHolo.value = h;
  if (groundHolo && groundHolo.uniforms) {
    groundHolo.uniforms.uTime.value = worldT;
    if (groundHolo.uniforms.uHolo) groundHolo.uniforms.uHolo.value = h;
    groundHolo.uniforms.uOrigin.value.set(px, pz);
    if (groundHolo.uniforms.uPlayer) groundHolo.uniforms.uPlayer.value.set(px, pz);
    if (groundHolo.uniforms.uSeam) groundHolo.uniforms.uSeam.value = seamValue();
    if (field && groundHolo.uniforms.uLake) {
      groundHolo.uniforms.uLake.value.set(field.anchors.lake[0], field.anchors.lake[1]);
      groundHolo.uniforms.uHome.value.set(field.anchors.home[0], field.anchors.home[1]);
      const spots = groundHolo.uniforms.uAether.value;
      for (let i = 0; i < 3; i++) {
        const g = superHexes[i];
        if (g) spots[i].set(g.position.x, g.position.z);
      }
    }
  }
}
function seamValue() {
  if (seamLock >= 0) return seamLock;
  for (const g of superHexes) {
    if (Math.hypot(px - g.position.x, pz - g.position.z) < 9) return 4;
  }
  for (const b of bolts) {
    if (b.kind === 'fire' && Math.hypot(b.p.x - px, b.p.z - pz) < 7) return 3;
  }
  return 0;
}
function setSeam(name) {
  const map = { auto: -1, default: 0, surge: 1, rain: 2, fire: 3, hex: 4 };
  seamLock = name in map ? map[name] : -1;
  return seamLock;
}
function shoreSpot() {
  const lake = field.anchors.lake;
  let best = null;
  let bestD = 1e9;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const x = lake[0] + Math.cos(a) * 30;
    const z = lake[1] + Math.sin(a) * 22;
    const spot = nearestWalkable(x, z);
    const d = Math.hypot(spot[0] - lake[0], spot[1] - lake[1]);
    if (d < bestD && !blocked(spot[0], spot[1])) { bestD = d; best = spot; }
  }
  return best || nearestWalkable(lake[0], lake[1] + 28);
}
function parkNpcs(on) {
  const s = SITES.arena;
  npcs.forEach((n, i) => {
    if (!n.group) return;
    if (!n.home) n.home = { x: n.x, z: n.z };
    if (on) {
      n.x = s.x + (i ? 2.4 : -2.4);
      n.z = s.z - 1.6;
      n.hp = 3;
      n.down = 0;
    } else {
      n.x = n.home.x;
      n.z = n.home.z;
    }
    n.group.position.set(n.x, standY(n.x, n.z) + n.foot, n.z);
  });
}
function enterPlay(id) {
  if (!SITES[id] && id !== 'fish') return;
  if (playMode === id) return;
  if (playMode === 'fish' && typeof window.__aroFishClose === 'function') window.__aroFishClose();
  if (playMode === 'arena') parkNpcs(false);
  if (playMode === 'world') playSaved = { x: px, z: pz, f: facing };
  playMode = id;
  camInit = false;
  shot = '';
  dest = null;
  if (id === 'fish') {
    const spot = shoreSpot();
    px = spot[0];
    pz = spot[1];
    const lake = field.anchors.lake;
    facing = Math.atan2(lake[0] - px, lake[1] - pz);
    if (avatar) avatar.userData.warm = 6;
    if (typeof window.__aroOpenFish === 'function') window.__aroOpenFish();
    return;
  }
  const s = SITES[id];
  px = s.x;
  pz = s.z + 0.35;
  facing = Math.PI;
  if (avatar) avatar.userData.warm = 6;
  if (id === 'arena') parkNpcs(true);
}
function exitPlay() {
  if (playMode === 'world') return false;
  setFp(false);
  const was = playMode;
  playMode = 'world';
  if (was === 'arena') parkNpcs(false);
  if (was === 'fish' && typeof window.__aroFishClose === 'function') window.__aroFishClose();
  if (playSaved) {
    px = playSaved.x;
    pz = playSaved.z;
    facing = playSaved.f;
    playSaved = null;
  }
  camInit = false;
  shot = '';
  dest = null;
  if (avatar) avatar.userData.warm = 4;
  if (vrm) vrm.userData.armMat = true;
  return true;
}
function handWorld(which) {
  const v = new THREE.Vector3(px, standY(px, pz) + 1.15, pz);
  if (!vrm || !vrm.humanoid) return v;
  const bone = vrm.humanoid.getNormalizedBoneNode(which === 'l' ? 'leftHand' : 'rightHand');
  if (bone) bone.getWorldPosition(v);
  return v;
}
function clearBolts() {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
    b.embers.forEach((e) => { scene.remove(e); e.geometry.dispose(); e.material.dispose(); });
  }
  bolts.length = 0;
}
function castSpell(kind, power) {
  const scale = 0.45 + (power == null ? 1 : power) * 0.7;
  let origin = handWorld('r').clone();
  let dir = new THREE.Vector3(Math.sin(facing), 0.06, Math.cos(facing)).normalize();
  if (fp.on && camera) {
    origin = camera.position.clone().add(new THREE.Vector3(0.12, -0.28, -0.9).applyQuaternion(camera.quaternion));
    dir = new THREE.Vector3(0, -0.02, -1).applyQuaternion(camera.quaternion).normalize();
    fp.kind = kind;
  }
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(kind === 'fire' ? 0.22 : 0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: kind === 'fire' ? 0xff6a2a : 0xffd36a })
  );
  mesh.scale.setScalar(scale);
  mesh.position.copy(origin);
  mesh.layers.set(0);
  scene.add(mesh);
  const embers = [];
  if (kind === 'fire') {
    for (let i = 0; i < 3; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      e.position.copy(origin);
      e.layers.set(0);
      scene.add(e);
      embers.push(e);
    }
  }
  const speed = (kind === 'fire' ? 7 : 9) * (0.5 + scale * 0.4);
  bolts.push({
    kind, p: origin.clone(), origin: origin.clone(), forward: dir.clone(),
    v: dir.clone().multiplyScalar(speed), life: 1.15, mesh, embers, born: performance.now(),
  });
}
function hurtNpc(p) {
  if (playMode !== 'arena' && playMode !== 'raid') return;
  for (const n of npcs) {
    if (!n.group || (n.hp | 0) <= 0) continue;
    if (Math.hypot(p.x - n.x, p.z - n.z) < 1.25 && Math.abs(p.y - 1.1) < 1.5) {
      n.hp -= 1;
      n.flash = 0.25;
      if (fp.on) fp.pulse = 0.4;
      if (n.hp <= 0) n.down = 2.4;
    }
  }
}
function stepProps(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    if (b.mesh.parent !== scene) scene.attach(b.mesh);
    b.embers.forEach((e) => { if (e.parent !== scene) scene.attach(e); });
    b.life -= dt;
    b.p.addScaledVector(b.v, dt);
    if (b.origin && performance.now() - b.born > 160 && b.p.distanceTo(b.origin) < 0.2) {
      b.v.copy(b.forward).multiplyScalar(8);
    }
    b.mesh.position.copy(b.p);
    b.embers.forEach((e, k) => {
      e.position.set(b.p.x + Math.sin(worldT * 18 + k) * 0.12, b.p.y + (k - 1.5) * 0.06, b.p.z);
    });
    hurtNpc(b.p);
    if (b.life <= 0) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      b.embers.forEach((e) => { scene.remove(e); e.geometry.dispose(); e.material.dispose(); });
      bolts.splice(i, 1);
    }
  }
  for (const bee of bees) {
    const a = worldT * 1.4 + bee.userData.a;
    bee.position.set(Math.cos(a) * bee.userData.r, 1.35 + Math.sin(a * 2) * 0.18, Math.sin(a * 0.9) * bee.userData.r);
    bee.rotation.y = -a;
  }
  if (rod) {
    const fishing = playMode === 'fish' || (fp.on && fp.fish);
    if (!(fp.on && fp.fish)) rod.visible = fishing;
    if (rodLine) rodLine.visible = false;
  }
}
function cutaway(id, w, d, h, wall, floor) {
  const s = SITES[id];
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), toonMat(floor));
  fl.position.y = -0.08;
  roomFloors.push(fl);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), toonMat(wall));
  back.position.set(0, h * 0.5, -d * 0.5);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, d), toonMat(wall));
  left.position.set(-w * 0.5, h * 0.5, 0);
  const right = left.clone();
  right.position.x = w * 0.5;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.12), toonMat('#6b3a28'));
  door.position.set(0, 1.05, d * 0.5 - 0.08);
  const sign = labelSprite('Back', '#9ee7ff', [1.1, 0.28]);
  sign.position.set(0, 2.45, d * 0.5);
  g.add(fl, back, left, right, door, sign);
  g.userData.pick = { kind: 'room', id: 'world', x: s.x, z: s.z + d * 0.5 };
  scene.add(g);
  return g;
}
function plankMat() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#a56b3c' : '#7a4a28';
    g.fillRect(0, i * 32, 256, 32);
    g.strokeStyle = 'rgba(48,24,10,.45)';
    g.strokeRect(2, i * 32 + 1, 252, 30);
    g.fillStyle = 'rgba(255,220,170,.08)';
    g.fillRect(8, i * 32 + 6, 70, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp });
}
function roomBackdrop() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: true,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      precision mediump float; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        vec3 bot = vec3(0.07, 0.045, 0.03);
        vec3 mid = vec3(0.36, 0.22, 0.14);
        vec3 top = vec3(0.14, 0.2, 0.32);
        vec3 c = mix(bot, mid, smoothstep(-0.35, 0.2, d.y));
        c = mix(c, top, smoothstep(0.25, 0.85, d.y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  [[SITES.home, 18], [SITES.house, 18], [SITES.market, 32], [SITES.arena, 26]].forEach(([s, rad]) => {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(rad, 18, 12), mat);
    sky.position.set(s.x, rad * 0.12, s.z);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.96, 24), new THREE.MeshBasicMaterial({ color: 0x120c09 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(s.x, -0.5, s.z);
    scene.add(sky, floor);
  });
}
function buildCabin() {
  const s = SITES.home;
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), plankMat());
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  roomFloors.push(floor);
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7, 4.0, 2.8, 24, 1, true, Math.PI * 0.15, Math.PI * 1.15),
    plankMat()
  );
  hull.position.y = 1.45;
  const rib = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.06, 6, 24, Math.PI * 1.15), toonMat('#8a5a32'));
  rib.rotation.z = Math.PI * 0.15;
  rib.rotation.x = Math.PI / 2;
  rib.position.y = 1.5;
  g.add(floor, hull, rib);
  const skyWin = new THREE.MeshBasicMaterial({ color: 0xb7dcff });
  for (let i = 0; i < 3; i++) {
    const a = -0.7 + i * 0.7;
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), skyWin);
    win.position.set(Math.sin(a) * 3.55, 1.7, -Math.cos(a) * 3.35);
    win.lookAt(0, 1.7, 0);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 16), toonMat('#6d4a32'));
    frame.position.copy(win.position);
    frame.lookAt(0, 1.7, 0);
    g.add(win, frame);
  }
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), toonMat('#8d3d48'));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.04;
  const lamp = new THREE.PointLight(0xffc56a, 1.35, 9);
  lamp.position.set(0, 2.3, -0.4);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7b0 }));
  bulb.position.copy(lamp.position);
  g.add(rug, lamp, bulb);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.38), toonMat('#6d4a32'));
  shelf.position.set(2.15, 1.15, -1.5);
  const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.16, 6), toonMat('#c48a52'));
  plantPot.position.set(-2.2, 0.1, -0.4);
  const plant = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), toonMat('#3f9a48'));
  plant.position.set(-2.2, 0.38, -0.4);
  g.add(shelf, plantPot, plant);
  const hive = new THREE.Group();
  hive.position.set(-1.7, 0, -2.15);
  for (let row = 0; row < 3; row++) {
    const n = 3 - (row === 2 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 6), toonMat(row === 1 ? '#e7b15a' : '#f0c56a'));
      cell.position.set((k - (n - 1) / 2) * 0.3, 0.2 + row * 0.22, 0);
      hive.add(cell);
    }
  }
  const hiveCap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.28, 6), toonMat('#c4554a'));
  hiveCap.position.y = 0.95;
  hive.add(hiveCap);
  const beeBody = new THREE.SphereGeometry(0.05, 6, 5);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(beeBody, new THREE.MeshBasicMaterial({ color: 0xffe08a })));
    b.userData = { a: i * 1.4, r: 0.45 + (i % 2) * 0.15 };
    hive.add(b);
    bees.push(b);
  }
  const hiveLab = labelSprite('Hive', '#b6f5a8', [0.9, 0.24]);
  hiveLab.position.y = 1.25;
  hive.add(hiveLab);
  g.add(hive);
  const rack = new THREE.Group();
  rack.position.set(2.15, 1.28, -1.5);
  for (let i = 0; i < 5; i++) {
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
    vial.position.set(-0.48 + i * 0.24, 0.16, 0);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35 }));
    glass.position.copy(vial.position);
    rack.add(vial, glass);
  }
  g.add(rack);
  addKitchen(g);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 8), toonMat('#6d4a32'));
  ped.position.set(0.15, 0.12, -0.85);
  const queen = new THREE.Group();
  queen.position.set(0.15, 0.28, -0.85);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffe7a0 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), glow);
  body.position.y = 0.12;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glow);
  head.position.y = 0.24;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.025), glow);
  armL.position.set(-0.09, 0.14, 0);
  const armR = armL.clone();
  armR.position.x = 0.09;
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), glow);
  ant.position.set(0.03, 0.32, 0);
  queen.add(body, head, armL, armR, ant);
  const queenLab = labelSprite('Queen', '#ffd978', [0.95, 0.24]);
  queenLab.position.set(0.15, 0.85, -0.85);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.1), toonMat('#6b3a28'));
  door.position.set(0, 1.0, 3.15);
  const back = labelSprite('Back', '#9ee7ff', [1.0, 0.26]);
  back.position.set(0, 2.3, 3.2);
  g.add(ped, queen, queenLab, door, back);
  g.userData.pick = { kind: 'room', id: 'world', x: s.x, z: s.z + 3.2 };
  scene.add(g);
  return g;
}
function buildSites() {
  roomBackdrop();
  const home = buildCabin();

  const house = cutaway('house', 7.4, 6.4, 3.1, '#efe2d2', '#cbb89a');
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.8), toonMat('#a87848'));
  table.position.set(0, 0.7, -1.4);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), toonMat('#6d4a32'));
  leg.position.set(0, 0.35, -1.4);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.1, 6), toonMat('#c4554a'));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.02;
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0xbfe9ff }));
  win.position.set(0, 1.8, -3.15);
  house.add(table, leg, rug, win, labelSprite('House', '#ffd2a8', [1.1, 0.26]));
  house.children[house.children.length - 1].position.set(0, 2.5, -2.4);

  const market = cutaway('market', 22, 16, 3.6, '#f7efe2', '#e6d3b0');
  const stallColors = ['#c4554a', '#3d8fd1', '#e7b15a', '#6aaa54'];
  stallColors.forEach((col, i) => {
    const stall = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.2), toonMat('#d8c4a4'));
    base.position.y = 0.5;
    const awn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.7), toonMat(col));
    awn.position.set(0, 1.85, 0.35);
    awn.rotation.x = 0.18;
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 5), toonMat('#6d4a32'));
    postL.position.set(-1.15, 0.95, 0.7);
    const postR = postL.clone();
    postR.position.x = 1.15;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), toonMat('#c48a52'));
    crate.position.set(0.7, 1.22, 0.15);
    const crate2 = crate.clone();
    crate2.position.set(0.95, 1.22, -0.2);
    crate2.scale.setScalar(0.8);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    lantern.position.set(0, 1.55, 0.55);
    stall.add(base, awn, postL, postR, crate, crate2, lantern);
    const colI = i % 2;
    const row = Math.floor(i / 2);
    stall.position.set(-4 + colI * 6, 0, -3.2 - row * 3.2);
    market.add(stall);
  });
  const marketLab = labelSprite('Market', '#ffd978', [1.4, 0.3]);
  marketLab.position.set(0, 2.6, -6);
  market.add(marketLab);

  const arena = cutaway('arena', 18, 14, 3.4, '#5d6e8a', '#3e516c');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.08, 8, 48), new THREE.MeshBasicMaterial({ color: 0x7ff0ff }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  arena.add(ring);
  for (let i = 0; i < 8; i++) {
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.08, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7ff0ff : 0xffd36a, transparent: true, opacity: 0.55 }));
    const a = (i / 8) * Math.PI * 2;
    hex.position.set(Math.cos(a) * 4.6, 0.07, Math.sin(a) * 4.6);
    arena.add(hex);
  }
  const arenaLight = new THREE.PointLight(0x9ee7ff, 1.1, 16);
  arenaLight.position.y = 2.2;
  arena.add(arenaLight);
  const arenaFill = new THREE.HemisphereLight(0xffe0c0, 0x3a4a62, 0.85);
  arena.add(arenaFill);
  const arenaSky = new THREE.Mesh(new THREE.SphereGeometry(12, 20, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      precision mediump float; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        vec3 groundC = vec3(0.34, 0.46, 0.36);
        vec3 hor = vec3(0.96, 0.82, 0.66);
        vec3 sky = vec3(0.45, 0.68, 0.9);
        vec3 c = mix(groundC, hor, smoothstep(-0.35, 0.02, d.y));
        c = mix(c, sky, smoothstep(0.0, 0.42, d.y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  arenaSky.position.y = 1.2;
  arena.add(arenaSky);
  const arenaLab = labelSprite('Sparring', '#9ee7ff', [1.4, 0.3]);
  arenaLab.position.set(0, 2.4, -4);
  arena.add(arenaLab);

  const homeA = field.anchors.home;
  const houseAt = nearestWalkable(homeA[0] + 26, homeA[1] + 8);
  const marketAt = nearestWalkable(homeA[0] - 18, homeA[1] + 22);
  addGate(houseAt[0], houseAt[1], 'house', 'House');
  addGate(marketAt[0], marketAt[1], 'market', 'Market');
  placeDiorama(homeA[0] + 5, homeA[1] - 4, 'home');
  placeDiorama(marketAt[0] + 2.4, marketAt[1] + 1.2, 'market');
  const raidAt = nearestWalkable(homeA[0] + 12, homeA[1] - 18);
  addGate(raidAt[0], raidAt[1], 'raid', 'Gel King');
  buildSuperHexes();
  buildRaidPit();
  dressLake();
  const shore = shoreSpot();
  placeDiorama(shore[0] - 2.2, shore[1] + 1.4, 'dock');
  placeFightMark();
  rod = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 8), toonMat('#6a3a22'));
  grip.position.y = 0.14;
  const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.15, 7), toonMat('#e2c48a'));
  blank.position.y = 0.78;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.36, 6), toonMat('#f2e2b8'));
  tip.position.y = 1.48;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), toonMat('#d5dde4'));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.07, 0.24, 0);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 10), toonMat('#2a2e33'));
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0.07, 0.24, 0);
  for (let i = 0; i < 4; i++) {
    const guide = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 4, 8), new THREE.MeshBasicMaterial({ color: 0xd7dde2 }));
    guide.position.y = 0.42 + i * 0.28;
    guide.rotation.y = Math.PI / 2;
    rod.add(guide);
  }
  const hands = new THREE.Group();
  hands.name = 'rodHands';
  const skin = toonMat('#e8b892');
  const sleeveMat = toonMat('#f7f1e6');
  const mitt = (x, z) => {
    const g = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    palm.scale.set(1.15, 0.72, 0.9);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.18, 8), sleeveMat);
    sleeve.position.y = -0.12;
    g.add(palm, sleeve);
    g.position.set(x, 0.16, z);
    return g;
  };
  hands.add(mitt(0.02, 0.04), mitt(-0.05, -0.02));
  rod.add(grip, blank, tip, reel, hub, hands);
  rod.rotation.x = 0.85;
  rod.rotation.z = 0.15;
  rodLine = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 2.2, 4), new THREE.MeshBasicMaterial({ color: 0xe9fbff }));
  rodLine.position.set(0, 1.05, 0.15);
  rodLine.rotation.x = 0.85;
  rod.add(rodLine);
  rod.visible = false;
  if (avatar) avatar.add(rod);
}
function addKitchen(g) {
  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.52), toonMat('#3e3832'));
  stove.position.set(-2.15, 0.28, 1.05);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.2, 8), toonMat('#c4554a'));
  pot.position.set(-2.15, 0.62, 1.05);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat('#e7d2b4'));
  lid.scale.y = 0.35;
  lid.position.set(-2.15, 0.74, 1.05);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 5), new THREE.MeshBasicMaterial({ color: 0xff7a3a }));
  flame.position.set(-1.85, 0.2, 1.2);
  const cookLight = new THREE.PointLight(0xffb060, 0.9, 4.5);
  cookLight.position.set(-2.0, 0.7, 1.1);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.34), toonMat('#c48a52'));
  board.position.set(-1.35, 0.42, 1.15);
  const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), toonMat('#e07a32'));
  carrot.rotation.z = Math.PI / 2;
  carrot.position.set(-1.42, 0.5, 1.12);
  const herb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), toonMat('#3f9a48'));
  herb.position.set(-1.22, 0.5, 1.2);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toonMat('#f4efe2'));
  bowl.scale.y = 0.45;
  bowl.position.set(-1.28, 0.5, 1.02);
  const lab = labelSprite('Kitchen', '#ffd2a8', [1.05, 0.26]);
  lab.position.set(-2.1, 1.15, 1.05);
  g.add(stove, pot, lid, flame, cookLight, board, carrot, herb, bowl, lab);
  g.userData.flame = flame;
}
function stepSuperHexes() {
  for (const g of superHexes) {
    const d = Math.hypot(px - g.position.x, pz - g.position.z);
    const inside = d < 9;
    g.userData.inner.visible = d < 20;
    const mat = g.userData.column.material;
    if (mat.uniforms && mat.uniforms.uIn) mat.uniforms.uIn.value = inside ? 1 : 0;
    for (const m of g.userData.motes || []) {
      const a = worldT * 0.45 + m.userData.a;
      m.position.set(Math.cos(a) * 0.35, (a * 2.4) % 20, Math.sin(a * 0.8) * 0.35);
    }
    const mark = g.userData.mark;
    if (mark && mark.userData.ring) {
      const pulse = 0.5 + 0.5 * Math.sin(worldT * 1.7 + g.position.x);
      mark.userData.ring.material.opacity = 0.38 + pulse * 0.28;
      mark.userData.pool.material.opacity = 0.14 + pulse * 0.12;
    }
  }
  for (const mark of aetherMarks) {
    if (!mark.userData.ring || mark.parent !== scene) continue;
    const pulse = 0.5 + 0.5 * Math.sin(worldT * 1.7 + mark.position.x);
    mark.userData.ring.material.opacity = 0.38 + pulse * 0.28;
    mark.userData.pool.material.opacity = 0.14 + pulse * 0.12;
  }
}
function buildSuperHexes() {
  const cols = field.cols, rows = field.rows;
  const found = [];
  for (let r = 4; r < rows - 4; r += 8) {
    for (let c = 4; c < cols - 4; c += 8) {
      const k = grid[r * cols + c];
      if (k !== 1 && k !== 2) continue;
      let n = 0;
      for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const kk = grid[rr * cols + cc];
        if (kk === 1 || kk === 2) n++;
      }
      if (n < 18) continue;
      const x = field.minx + (c + 0.5) * field.cell;
      const z = field.minz + (r + 0.5) * field.cell;
      if (Math.hypot(x - field.anchors.home[0], z - field.anchors.home[1]) < 30) continue;
      if (found.some((s) => Math.hypot(s.x - x, s.z - z) < 48)) continue;
      found.push({ x, z, wood: k === 2, n });
    }
  }
  found.sort((a, b) => b.n - a.n);
  const picks = [];
  const wood = found.find((s) => s.wood);
  const park = found.find((s) => !s.wood);
  if (park) picks.push(park);
  if (wood) picks.push(wood);
  for (const s of found) {
    if (picks.length >= 3) break;
    if (!picks.includes(s)) picks.push(s);
  }
  for (const s of picks) {
    const g = new THREE.Group();
    const y = groundY(s.x, s.z);
    g.position.set(s.x, y, s.z);
    const columnMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: { uIn: { value: 0 }, uColor: { value: new THREE.Color(s.wood ? '#b6f5c8' : '#d7f6ff') } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        precision mediump float; varying float vY; uniform float uIn; uniform vec3 uColor;
        void main(){
          float h = clamp(vY / 11.0 + 0.5, 0.0, 1.0);
          float a = (1.0 - smoothstep(0.02, 1.0, h)) * (uIn > 0.5 ? 0.08 : 0.2);
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.05, 22, 6, 1, true), columnMat);
    column.position.y = 11;
    const dome = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2 + i * 1.5, 0.025, 4, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.28, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.2 + i * 1.6;
      dome.add(ring);
    }
    const inner = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rad = 1.4 + (i % 3) * 0.7;
      const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + (i % 3) * 0.18, 0), toonMat(s.wood ? '#174f28' : '#2f8a3a'));
      tree.position.set(Math.cos(a) * rad, 1.15, Math.sin(a) * rad);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 5), toonMat('#5c4030'));
      trunk.position.set(Math.cos(a) * rad, 0.45, Math.sin(a) * rad);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), toonMat('#3f7a32'));
      bush.position.set(Math.cos(a + 0.3) * (rad * 0.55), 0.25, Math.sin(a + 0.3) * (rad * 0.55));
      inner.add(tree, trunk, bush);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), toonMat(i % 2 ? '#e07098' : '#f0d060'));
      fl.position.set(Math.cos(a) * (0.8 + (i % 4) * 0.35), 0.12, Math.sin(a) * (0.8 + (i % 4) * 0.35));
      inner.add(fl);
    }
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), toonMat('#6d6458'));
    rock.position.set(0.4, 0.22, -0.3);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), toonMat('#2f6a32'));
    moss.position.set(0.45, 0.48, -0.28);
    inner.add(rock, moss);
    const lab = labelSprite(s.wood ? 'Wood hex' : 'Park hex', '#b6f5a8', [1.3, 0.28]);
    lab.position.y = 2.4;
    inner.add(lab);
    const motes = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Sprite(glowSprite('rgba(230,255,240,1)', 'rgba(180,255,210,0.25)'));
      m.scale.setScalar(0.18);
      m.userData.a = i * 0.9;
      g.add(m);
      motes.push(m);
    }
    g.add(column, dome, inner);
    g.userData.column = column;
    g.userData.dome = dome;
    g.userData.inner = inner;
    g.userData.motes = motes;
    const mark = makeAetherMark(2.2, null);
    g.add(mark);
    g.userData.mark = mark;
    aetherMarks.push(mark);
    const slab = facetChunk(0.55, 1.7, 0.32, 2);
    slab.translate(0, 0.2, 0);
    const lean = facetChunk(0.48, 0.7, 0.4, 5);
    lean.rotateZ(0.45);
    lean.translate(0.55, 0, 0.15);
    const chip = facetChunk(0.32, 0.38, 0.3, 8);
    chip.rotateZ(-0.28);
    chip.translate(-0.42, 0, 0.22);
    const formGeo = mergeGeometries([slab, lean, chip]);
    formGeo.computeBoundingBox();
    formGeo.translate(0, -formGeo.boundingBox.min.y, 0);
    const form = new THREE.Mesh(formGeo, toonMat('#c4b4d0'));
    form.position.set(4.2, 0, 3.1);
    form.scale.setScalar(1.7);
    g.add(form);
    if (superHexes.length % 6 === 0) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.02), new THREE.MeshBasicMaterial({ color: 0xe8c877 }));
      crack.position.set(4.2, 1.4, 3.3);
      g.add(crack);
    }
    scene.add(g);
    superHexes.push(g);
  }
}
function buildRaidPit() {
  const s = SITES.raid;
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(11, 6), toonMat('#2a3344'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  roomFloors.push(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(11.4, 14.2, 8.4, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x6d7c96, side: THREE.DoubleSide }));
  wall.position.y = 3.6;
  g.add(floor, wall);
  for (let i = 0; i < 7; i++) {
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1.6 + (i % 3) * 0.4, 0.22, 1.1), new THREE.MeshBasicMaterial({ color: 0xd7f4ff }));
    const a = (i / 7) * Math.PI * 2;
    ice.position.set(Math.cos(a) * (3 + (i % 2)), 0.12, Math.sin(a) * (3 + (i % 3) * 0.4));
    ice.rotation.y = a;
    ice.rotation.z = (i % 2 ? 0.08 : -0.05);
    g.add(ice);
  }
  for (let i = 0; i < 8; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.12, 0), toonMat(i % 2 ? '#6a7384' : '#8a93a4'));
    const a = (i / 8) * Math.PI * 2 + 0.4;
    rock.position.set(Math.cos(a) * (5.2 + (i % 3)), i % 2 ? 2.4 : 0.35, Math.sin(a) * (5.4 + (i % 2)));
    rock.rotation.set(i, a, 0.2);
    g.add(rock);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 10), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      precision mediump float; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        vec2 uv = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))) * vec2(2.2, 3.0);
        vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h; vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a,a) < dot(b,b) ? a : b;
        float edge = 0.5 - max(abs(gv.x), abs(gv.x)*0.5 + abs(gv.y)*0.8660254);
        float line = 1.0 - smoothstep(0.02, 0.07, edge);
        float miss = step(0.84, fract(sin(dot(floor(uv * 1.15), vec2(19.1, 73.4))) * 43758.5));
        vec3 skyC = mix(vec3(0.45, 0.62, 0.88), vec3(0.12, 0.18, 0.32), smoothstep(0.1, 0.8, d.y));
        vec3 voidC = vec3(0.01, 0.015, 0.04);
        vec3 c = mix(skyC, voidC, miss);
        float rim = smoothstep(0.12, 0.02, edge) * miss;
        c = mix(c, vec3(0.75, 0.95, 1.0), line * 0.55 + rim * 0.85);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.position.y = 6;
  const lab = labelSprite('Gel King', '#9ee7ff', [1.4, 0.3]);
  lab.position.set(0, 3.2, -8);
  g.add(sky, lab);
  scene.add(g);
}
function placeFightMark() {
  const home = field.anchors.home;
  const spot = nearestWalkable(home[0] + 6, home[1] + 4);
  const g = new THREE.Group();
  const y = groundY(spot[0], spot[1]);
  g.position.set(spot[0], y, spot[1]);
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.02, 0.08, 6), toonMat('#e7c56a'));
  hex.position.y = 0.05;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), toonMat('#2f9e96'));
  body.position.y = 0.55;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf7fbff }));
  eye.position.set(-0.1, 0.66, 0.32);
  const eyeR = eye.clone();
  eyeR.position.x = 0.1;
  const lab = labelSprite('Gel King', '#9fe6e0', [1.45, 0.34]);
  lab.position.y = 1.25;
  g.add(hex, body, eye, eyeR, lab);
  g.userData.pick = { kind: 'fight', id: 'fp', x: spot[0], z: spot[1] };
  scene.add(g);
}
function dressLake() {
  const spot = shoreSpot();
  const lake = field.anchors.lake;
  const y = groundY(spot[0], spot[1]);
  const dx = lake[0] - spot[0], dz = lake[1] - spot[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const pxr = -uz, pzr = ux;
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.55), toonMat(i % 2 ? '#a56b3c' : '#8a5a32'));
    plank.position.set(spot[0] + ux * i * 0.62, y + 0.12, spot[1] + uz * i * 0.62);
    plank.rotation.y = Math.atan2(ux, uz);
    g.add(plank);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 5), toonMat('#5c4030'));
  post.position.set(spot[0] + pxr * 0.9, y + 0.75, spot[1] + pzr * 0.9);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
  lantern.position.set(post.position.x, y + 1.55, post.position.z);
  const lamp = new THREE.PointLight(0xffc56a, 0.8, 8);
  lamp.position.copy(lantern.position);
  g.add(post, lantern, lamp);
  for (let i = 0; i < 8; i++) {
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 1.15, 4), toonMat('#6a8a48'));
    const side = i < 4 ? -1.4 : 1.5;
    const along = (i % 4) * 0.45;
    reed.position.set(spot[0] + pxr * side + ux * along, y + 0.5, spot[1] + pzr * side + uz * along);
    reed.rotation.z = side * 0.08;
    g.add(reed);
  }
  for (let i = 0; i < 4; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 2) * 0.1, 0), toonMat('#8a8078'));
    rock.position.set(spot[0] - ux * 0.8 + pxr * (i - 1.5) * 0.7, y + 0.15, spot[1] - uz * 0.8 + pzr * (i - 1.5) * 0.7);
    g.add(rock);
  }
  for (let i = 0; i < 6; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35 + (i % 3) * 0.08, 8), toonMat('#3f8a48'));
    pad.rotation.x = -Math.PI / 2;
    const a = i * 1.2;
    pad.position.set(lake[0] + Math.cos(a) * (6 + i), -0.15, lake[1] + Math.sin(a) * (4 + i * 0.6));
    g.add(pad);
  }
  scene.add(g);
}
function addGate(x, z, id, text) {
  const g = new THREE.Group();
  g.position.set(x, groundY(x, z), z);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.2, 0.16), toonMat('#6b3a28'));
  frame.position.y = 1.1;
  const lab = labelSprite(text, '#ffd978', [1.2, 0.28]);
  lab.position.y = 2.5;
  g.add(frame, lab);
  g.userData.pick = { kind: 'room', id, x, z };
  gates.push(g);
  scene.add(g);
}
const api = {
  ready: false,
  avatarReady: false,
  npcsReady: false,
  tick,
  key: onKey,
  pose(name) {
    const next = name || '';
    if (next === 'fp' || next === 'fpcast') setFp(true, 'fight');
    else if (next === 'fpfish') setFp(true, 'fish');
    else if (fp.on) setFp(false);
    shot = next;
    if (!next) camInit = false;
  },
  posePhase(p) { playerPose.phase = p; playerPose.amp = 1; if (!shot) shot = 'side'; },
  fp(on) { setFp(on); return { on: fp.on, xr: fp.xr, vials: fp.vials, track: fp.track.state }; },
  handDemo(mode) {
    if (!fp.on) setFp(true, 'fight');
    fp.track.hold = mode !== 'live';
    fp.track.forceDebug = true;
    fp.track.model = 'loaded';
    fp.track.delegate = 'CPU';
    fp.track.video = '640x480 ready 4';
    fp.track.fps = 30;
    fp.track.hands = 0;
    fp.track.err = '';
    if (mode === 'tap' || mode === 'blocked') { fp.track.state = 'blocked'; fp.track.charge = 0; fp.track.model = 'denied'; }
    else if (mode === 'seen') { fp.track.state = 'seen'; fp.track.charge = 0.2; fp.track.hands = 1; fp.aimX = 0.5; fp.aimY = 0.44; fp.track.inside = true; fp.track.sx = 0.5; fp.track.sy = 0.44; fp.track.lm = neonHand(0.5, 0.44); }
    else if (mode === 'drift') { fp.track.state = 'looking'; fp.track.charge = 0; fp.track.hands = 1; fp.aimX = 0.5; fp.aimY = 0.44; fp.track.inside = false; fp.track.sx = 0.3; fp.track.sy = 0.72; fp.track.lm = neonHand(0.3, 0.72); }
    else if (mode === 'charge') { fp.track.state = 'charging'; fp.track.charge = 0.72; fp.track.hands = 1; fp.aimX = 0.5; fp.aimY = 0.44; fp.track.inside = true; fp.track.sx = 0.5; fp.track.sy = 0.44; fp.track.lm = neonHand(0.5, 0.44); }
    else if (mode === 'fired') { fp.track.state = 'fired'; fp.track.charge = 1; fp.track.x = 0.6; fp.track.y = 0.62; fp.cast = 0.28; fp.track.hands = 1; }
    else if (mode === 'looking') { fp.track.state = 'looking'; fp.track.charge = 0; fp.track.hands = 0; }
    else if (mode === 'full') { fp.track.state = 'charging'; fp.track.charge = 1; fp.aimX = 0.5; fp.aimY = 0.44; }
    else { fp.track.hold = false; fp.track.state = 'off'; fp.track.forceDebug = false; }
    paintTrack();
  },
  dummy(on) {
    if (!fp.on) setFp(true, 'fight');
    fp.dummy = !!on;
    const b = document.getElementById('fpDummy');
    if (b) b.textContent = fp.dummy ? 'Gel King' : 'Dummy';
    if (fp.dummy) { placeDummy(); if (fightBeast) fightBeast.visible = false; }
    else { if (fpDummy) fpDummy.visible = false; placeFightBeast(); }
  },
  seam(name) { return setSeam(name == null ? 'auto' : name); },
  where() {
    const mat = vrm && vrm.userData && vrm.userData.matz;
    return { x: px, z: pz, facing, avatarReady, active, mode: playMode, fill: mat ? mat.uFill.value : null, matT: mat ? mat.t : null, view: fp.view, aggro: fp.aggro };
  },
  aggro(stage) {
    if (!fp.on) setFp(true, 'fight');
    fp.aggroHold = stage || '';
    stepAggro(0);
    return fp.aggro;
  },
  view(mode) {
    if (!fp.on) setFp(true, 'fight');
    setFightView(mode === 'camera' ? 'camera' : 'virtual');
    return fp.view;
  },
  maskDemo() {
    if (!fp.on) setFp(true, 'fight');
    setFightView('camera');
    fp.track.maskHold = true;
    fp.track.lm = [
      { x: 0.42, y: 0.62 }, { x: 0.58, y: 0.6 }, { x: 0.62, y: 0.72 },
      { x: 0.5, y: 0.78 }, { x: 0.38, y: 0.74 }, { x: 0.36, y: 0.66 },
    ];
    fp.track.hands = 1;
    paintHandOcc();
  },
  enter: enterPlay,
  exit: exitPlay,
  cast: castSpell,
  mode() { return playMode; },
  keepsWorld() { return playMode !== 'world'; },
  fishing() { return playMode === 'fish'; },
  materialize() { if (vrm) vrm.userData.armMat = true; },
  materializeAt(t) {
    if (!vrm || !avatar || !vrm.userData.matz) return;
    const s = vrm.userData.matz;
    s.t = t;
    const e = t * t * (3 - 2 * t);
    s.uFill.value = avatar.position.y - 0.04 + e * 1.9;
  },
};
window.__world3d = api;

function planNpcSpots() {
  const wants = [[px + 10, pz - 5], [px - 9, pz + 6]];
  npcSpots = [];
  for (const [x, z] of wants) {
    let picked = null;
    for (let rad = 0; rad <= 28 && !picked; rad += 2) {
      const steps = rad === 0 ? 1 : 12;
      for (let a = 0; a < steps; a++) {
        const ang = (a / steps) * Math.PI * 2;
        const nx = x + Math.cos(ang) * rad;
        const nz = z + Math.sin(ang) * rad;
        if (blocked(nx, nz)) continue;
        if (Math.hypot(nx - field.anchors.home[0], nz - field.anchors.home[1]) < 16) continue;
        if (Math.hypot(nx - px, nz - pz) < 6) continue;
        if (npcSpots.some((s) => Math.hypot(nx - s[0], nz - s[1]) < 8)) continue;
        picked = [nx, nz];
        break;
      }
    }
    npcSpots.push(picked || nearestWalkable(x, z));
  }
}
function warmPropColor(color) {
  const c = color ? color.clone() : new THREE.Color('#c4b39a');
  if (c.r > 0.42 && c.r > c.g * 1.15 && c.b < 0.42) c.set('#8d5a32');
  else if (c.r > 0.5 && c.g > 0.28 && c.g < 0.55 && c.b < 0.35) c.set('#a89880');
  return c;
}
function celOf(src, sway) {
  const mat = new THREE.MeshToonMaterial({
    color: warmPropColor(src && src.color),
    map: src && src.map ? src.map : null,
    gradientMap: ramp,
  });
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
  bendMat(mat);
  if (!sway) return mat;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader) => {
    prev(shader);
    if (shader.vertexShader.includes('aroSway')) return;
    shader.uniforms.uTime = shellU.uTime;
    if (!shader.vertexShader.includes('uniform float uTime')) shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.xz += sin(uTime * 1.3 + position.y) * position.y * 0.12 * vec2(1.0, 0.55); // aroSway'
    );
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|sway';
  return mat;
}
function propSpots(n, minR, maxR, origin, salt) {
  const out = [];
  const want = Math.max(1, Math.round(n * 0.65));
  minR *= 1.28;
  maxR *= 1.22;
  for (let i = 0, guard = 0; out.length < want && guard < 90; guard++, i++) {
    const a = salt + i * 2.399;
    const r = minR + ((Math.sin(salt * 3.0 + i) * 0.5 + 0.5) * (maxR - minR));
    const x = origin[0] + Math.cos(a) * r;
    const z = origin[1] + Math.sin(a) * r;
    const k = kindAt(x, z);
    if (k == null || k === 3 || k === 4) continue;
    out.push([x, z]);
  }
  return out;
}
const freeFade = [];
let moundGeo = null;
function addMound(x, z) {
  if (kindAt(x, z) == null || kindAt(x, z) === 3) return;
  if (!moundGeo) {
    moundGeo = new THREE.SphereGeometry(0.7, 8, 5);
    moundGeo.scale(1, 0.22, 1);
  }
  const g = new THREE.Group();
  const moss = new THREE.Mesh(moundGeo, toonMat('#6d8f46'));
  moss.position.y = 0.02;
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), toonMat('#a89880'));
  stone.position.set(0.38, 0.08, 0.12);
  const shade = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10), new THREE.MeshBasicMaterial({ color: 0x1c140c, transparent: true, opacity: 0.28, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.03;
  g.add(shade, moss, stone);
  g.position.set(x, groundY(x, z), z);
  g.userData.fadeAt = { x, z };
  scene.add(g);
  freeFade.push({ group: g, x, z });
}
function placeProp(root, spots, scale, file) {
  if (!spots.length) return;
  root.updateMatrixWorld(true);
  const tree = file && /tree|pine|palm|oak/i.test(file) && !/waterplant/i.test(file);
  const parts = [];
  root.traverse((o) => { if (o.isMesh) parts.push(o); });
  parts.forEach((o) => {
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    const sway = o.material && o.material.userData && o.material.userData.sway;
    const mat = celOf(o.material, sway);
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    mesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const scales = [];
    spots.forEach((p, i) => {
      dummy.position.set(p[0], groundY(p[0], p[1]), p[1]);
      dummy.rotation.y = (saltOf(p[0], p[1]) * 6.2) % (Math.PI * 2);
      const s = scale * 0.62 * (0.9 + (i % 5) * 0.04);
      scales.push(s);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (tree) addMound(p[0], p[1]);
    });
    scene.add(mesh);
    freeFade.push({ mesh, spots, scales });
  });
}
function stepPropFade() {
  if (!freeFade.length || !camera) return;
  const dummy = stepPropFade.dummy || (stepPropFade.dummy = new THREE.Object3D());
  const cam = camera.position;
  const px1 = px;
  const pz1 = pz;
  const abx = px1 - cam.x;
  const abz = pz1 - cam.z;
  const ab2 = abx * abx + abz * abz || 1;
  freeFade.forEach((rec) => {
    if (rec.group) {
      const d = Math.hypot(rec.x - px1, rec.z - pz1);
      let fade = d < 1.5 ? Math.max(0.08, d / 1.5) : 1;
      const t = ((rec.x - cam.x) * abx + (rec.z - cam.z) * abz) / ab2;
      if (t > 0.08 && t < 0.92) {
        const cx = cam.x + abx * t;
        const cz = cam.z + abz * t;
        if (Math.hypot(rec.x - cx, rec.z - cz) < 1.15) fade *= 0.12;
      }
      rec.group.visible = fade > 0.12;
      rec.group.scale.setScalar(fade);
      return;
    }
    if (!rec.mesh) return;
    rec.spots.forEach((p, i) => {
      const d = Math.hypot(p[0] - px1, p[1] - pz1);
      let s = rec.scales[i];
      if (d < 1.7) s *= Math.max(0.06, d / 1.7);
      const t = ((p[0] - cam.x) * abx + (p[1] - cam.z) * abz) / ab2;
      if (t > 0.08 && t < 0.92) {
        const cx = cam.x + abx * t;
        const cz = cam.z + abz * t;
        if (Math.hypot(p[0] - cx, p[1] - cz) < 1.15) s *= 0.12;
      }
      dummy.position.set(p[0], groundY(p[0], p[1]), p[1]);
      dummy.rotation.y = (saltOf(p[0], p[1]) * 6.2) % (Math.PI * 2);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      rec.mesh.setMatrixAt(i, dummy.matrix);
    });
    rec.mesh.instanceMatrix.needsUpdate = true;
  });
}
const veggies = [];
function chibiVeggie(x, z) {
  if (kindAt(x, z) == null || kindAt(x, z) === 3) return;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), toonMat('#e07a32'));
  body.scale.set(1.05, 0.78, 1.05);
  body.position.y = 0.2;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.16, 5), toonMat('#3c8a42'));
  stem.position.y = 0.4;
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.42, 16), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.04;
  g.add(body, stem, aura);
  g.position.set(x, groundY(x, z), z);
  scene.add(g);
  veggies.push(g);
}
function seedVeggies() {
  superHexes.forEach((h, i) => {
    if (i % 2) return;
    const a = i * 1.7;
    chibiVeggie(h.position.x + Math.cos(a) * 3.4, h.position.z + Math.sin(a) * 3.4);
  });
  chibiVeggie(px - 1.8, pz - 0.4);
}
function stepVeggies(dt) {
  for (let i = veggies.length - 1; i >= 0; i--) {
    const g = veggies[i];
    if (!g.parent) { veggies.splice(i, 1); continue; }
    g.position.y = groundY(g.position.x, g.position.z) + Math.sin(worldT * 2.2 + g.position.x) * 0.05;
    const aura = g.children[2];
    if (aura && aura.material) aura.material.opacity = 0.35 + 0.3 * Math.sin(worldT * 3 + i);
  }
  if (veggies.length >= 8) return;
  if (Math.random() > dt * 0.035) return;
  const a = Math.random() * Math.PI * 2;
  const r = 10 + Math.random() * 12;
  chibiVeggie(px + Math.cos(a) * r, pz + Math.sin(a) * r);
}
function takeVeggie(x, z) {
  for (const g of veggies) {
    if (!g.parent) continue;
    if (Math.hypot(g.position.x - x, g.position.z - z) < 1.8) {
      scene.remove(g);
      if (typeof window.addItem === 'function') window.addItem('pumpkin', 1);
      return true;
    }
  }
  return false;
}
function saltOf(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function loadFreeProps() {
  if (!field || !field.anchors) return;
  const loader = new GLTFLoader();
  const lake = field.anchors.lake;
  const home = field.anchors.home;
  const jobs = [
    ['kenney-oak.glb', propSpots(4, 30, 48, lake, 0.4), 3.3, false],
    ['kenney-pine.glb', propSpots(3, 34, 52, lake, 1.1), 2.7, false],
    ['kenney-bush.glb', propSpots(5, 26, 42, lake, 2.2), 3.1, false],
    ['kenney-rock.glb', propSpots(4, 24, 40, lake, 0.8), 2.4, false],
    ['kenney-flower.glb', propSpots(6, 22, 38, lake, 1.7), 2.6, false],
    ['kenney-grass.glb', propSpots(8, 22, 40, lake, 2.8), 2.1, true],
    ['quaternius-palm.glb', propSpots(2, 32, 50, lake, 0.2), 0.014, false],
    ['quaternius-pine.glb', propSpots(2, 36, 54, lake, 1.5), 0.015, false],
    ['quaternius-bush.glb', propSpots(3, 26, 40, lake, 2.6), 0.012, false],
    ['quaternius-rock.glb', propSpots(3, 24, 38, lake, 0.6), 0.012, false],
    ['quaternius-flower.glb', propSpots(4, 22, 36, lake, 1.9), 0.04, false],
    ['quaternius-grass.glb', propSpots(5, 22, 38, lake, 3.1), 0.03, true],
    ['kaykit/tree_single_A.gltf', propSpots(3, 28, 46, lake, 0.9), 1.8, false],
    ['kaykit/rock_single_A.gltf', propSpots(3, 24, 36, lake, 1.4), 1.5, false],
    ['kaykit/waterplant_A.gltf', propSpots(4, 20, 34, lake, 2.4), 1.4, true],
    ['kenney-cart.glb', propSpots(1, 10, 16, home, 0.3), 0.04, false],
    ['kenney-fountain.glb', propSpots(1, 12, 18, home, 1.2), 0.06, false],
    ['kaykit/barrel.gltf', propSpots(2, 8, 14, home, 2.1), 1.2, false],
    ['kaykit/crate_A_small.gltf', propSpots(2, 9, 15, home, 0.7), 1.2, false],
    ['kaykit/chest.glb', propSpots(1, 11, 16, home, 1.8), 1.05, false],
    ['kaykit/coin.glb', propSpots(2, 8, 13, home, 2.5), 0.85, false],
  ];
  const shore = shoreSpot();
  const toLakeX = lake[0] - shore[0];
  const toLakeZ = lake[1] - shore[1];
  const toLen = Math.hypot(toLakeX, toLakeZ) || 1;
  const ux = toLakeX / toLen;
  const uz = toLakeZ / toLen;
  const rx = -uz;
  const rz = ux;
  const beside = (along, side) => {
    for (let pull = 0; pull < 8; pull++) {
      const a = Math.max(1.2, along - pull * 1.6);
      const x = shore[0] + ux * a + rx * side;
      const z = shore[1] + uz * a + rz * side;
      const k = kindAt(x, z);
      if (k != null && k !== 3 && k !== 4) return [x, z];
    }
    return null;
  };
  const bank = [
    ['kenney-oak.glb', beside(11, 2.2), 4.4],
    ['kenney-pine.glb', beside(16, -2.2), 3.6],
    ['kenney-bush.glb', beside(8, -1.5), 4.2],
    ['kenney-rock.glb', beside(7, 1.2), 3.2],
    ['quaternius-palm.glb', beside(20, 1.6), 0.016],
    ['kaykit/tree_single_A.gltf', beside(13, -1.2), 2.8],
    ['kaykit/waterplant_A.gltf', beside(9, 0.4), 2.8],
    ['kaykit/rock_single_A.gltf', beside(6, -0.8), 2.2],
  ];
  bank.forEach((row) => { if (row[1]) jobs.push([row[0], [row[1]], row[2], row[0].indexOf('grass') >= 0 || row[0].indexOf('waterplant') >= 0]); });
  jobs.forEach((job) => {
    const spots = job[1];
    if (!spots.length) return;
    loader.load('assets/props/' + job[0], (gltf) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh && o.material) o.material.userData.sway = job[3];
      });
      placeProp(gltf.scene, spots, job[2], job[0]);
    }, undefined, () => {});
  });
}
function bootField(data) {
  field = data;
  const raw = atob(data.grid);
  grid = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) grid[i] = raw.charCodeAt(i);
  const home = data.anchors.home;
  const start = nearestWalkable(home[0] + 16, home[1] + 8);
  px = start[0]; pz = start[1];
  carveLake();
  planNpcSpots();
  buildGround();
  buildDressing();
  buildLife();
  buildBuildings();
  const a = data.anchors;
  placeAetherMark(a.garden[0], a.garden[1], 1.65, 'Garden');
  placeAetherMark(a.garden[0] + 8, a.garden[1] - 6, 0.78, '');
  placeAetherMark(a.garden[0] - 7, a.garden[1] + 7, 0.7, '');
  addMarker(a.lake[0], a.lake[1], 'Long Lake', '#9ad8ff');
  buildHome(a.home[0], a.home[1]);
  buildSites();
  if (rod && avatar) avatar.add(rod);
  api.ready = true;
  startGPS();
  loadAvatar();
  loadNpcs();
  loadFreeProps();
  seedVeggies();
}

function boot() {
  const canvas = document.getElementById('worldCv');
  if (!canvas) return;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x8ec8ee, 1);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf6d7b0, 50, 300);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  clock = new THREE.Clock();
  hemi = new THREE.HemisphereLight(0xcfeaff, 0x6a8a48, 0.85);
  sun = new THREE.DirectionalLight(0xfff4d2, 1.3);
  sun.position.set(30, 40, 16);
  scene.add(hemi, sun);
  hemi.layers.enable(1);
  sun.layers.enable(1);
  const rim = new THREE.DirectionalLight(0xcfe8ff, 0.55);
  rim.position.set(-24, 16, -18);
  rim.layers.enable(1);
  scene.add(rim);
  blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x14200c, transparent: true, opacity: 0.32, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#8ec6ee') },
      uHor: { value: new THREE.Color('#f7d2a4') },
      uBot: { value: new THREE.Color('#c9d98a') },
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uHolo: { value: 1 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `
      precision mediump float;
      varying vec3 vW;
      uniform vec3 uTop,uHor,uBot,uCam;
      uniform float uTime, uHolo;
      vec2 holoHash2(vec2 p){
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }
      float holoHash(vec2 p){ return holoHash2(p).x; }
      vec3 holoHex(vec2 p, float scale){
        vec2 uv = p / scale;
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = uv - gv;
        float hd = max(abs(gv.x), abs(gv.x) * 0.5 + abs(gv.y) * 0.8660254);
        return vec3(id, 0.5 - hd);
      }
      void main(){
        vec3 dir = normalize(vW - uCam);
        float hgt = dir.y;
        vec3 c = mix(uBot, uHor, smoothstep(-0.15, 0.22, hgt));
        c = mix(c, uTop, smoothstep(0.08, 0.72, hgt));
        vec2 cuv = dir.xz / max(0.2, hgt + 0.45);
        float n = sin(cuv.x * 2.2 + uTime * 0.04) * sin(cuv.y * 1.8);
        n += sin(cuv.x * 5.5 + 2.0) * sin(cuv.y * 4.8 + uTime * 0.06) * 0.65;
        float puffA = smoothstep(0.62, 0.78, n * 0.5 + 0.55);
        float puffB = smoothstep(0.7, 0.86, sin(cuv.x * 9.0 + 4.0) * sin(cuv.y * 8.0) * 0.5 + 0.5);
        float cloud = max(puffA, puffB * 0.85);
        cloud *= smoothstep(0.12, 0.42, hgt);
        vec3 puff = mix(uHor, vec3(1.0, 0.98, 0.96), 0.75);
        c = mix(c, puff, cloud * 0.8);
        vec2 suv = vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0))) * vec2(2.15, 3.1);
        vec3 hcell = holoHex(suv, 0.42);
        vec2 hid = hcell.xy; float hedge = hcell.z;
        float above = smoothstep(0.06, 0.28, hgt) * (1.0 - cloud * 0.65);
        float hline = 1.0 - smoothstep(0.02, 0.07, hedge);
        vec3 panel = mix(vec3(0.45, 0.95, 1.0), vec3(1.0, 0.8, 0.4), step(0.62, holoHash(hid)));
        float gap = step(0.993, holoHash(hid + 2.0));
        c = mix(c, c * vec3(0.82, 0.9, 0.94), gap * above * uHolo * 0.22);
        c = mix(c, panel, hline * 0.03 * above * uHolo);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 16, 10), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  bindInput(canvas);
  window.addEventListener('resize', resize);
  window.addEventListener('deviceorientation', (e) => {
    if (!fp.on || e.alpha == null || (fp.fish && fp.lookLock)) return;
    readGyro(e);
  });
  resize();
  mountLoader();
  setLoad(0.04, 'Loading the town…');
  fetch(FIELD_URL).then((r) => r.json()).then((data) => { setLoad(0.1, 'Loading the town…'); bootField(data); }).catch((err) => { console.error(err); });
}

const gyro = {
  ready: false,
  ios: false,
  rawYaw: 0,
  rawPitch: 0,
  baseRaw: 0,
  basePitch: 0,
  baseWant: 0,
  basePitchWant: 0.12,
  wantYaw: 0,
  wantPitch: 0.12,
  q: new THREE.Quaternion(),
  q1: new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2),
  q0: new THREE.Quaternion(),
  euler: new THREE.Euler(),
  zee: new THREE.Vector3(0, 0, 1),
  fwd: new THREE.Vector3(),
};
function resetGyro() {
  gyro.ready = false;
}
function screenOrientRad() {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return THREE.MathUtils.degToRad(screen.orientation.angle);
  }
  return THREE.MathUtils.degToRad(window.orientation || 0);
}
function screenOrientDeg() {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  const o = window.orientation || 0;
  return o < 0 ? o + 360 : o;
}
function askPhoneAim(done) {
  const ask = window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission;
  const go = () => { if (done) done(); };
  if (typeof ask === 'function') ask().then(go).catch(go);
  else go();
}
function readGyro(e) {
  gyro.ios = typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading);
  const orient = screenOrientDeg();
  let heading = gyro.ios ? e.webkitCompassHeading : (360 - (e.alpha || 0));
  let beta = e.beta == null ? 90 : e.beta;
  if (orient === 90) beta = 90 + (e.gamma || 0);
  else if (orient === 270 || orient === -90) beta = 90 - (e.gamma || 0);
  if (gyro.smHead == null) gyro.smHead = heading;
  let dh = heading - gyro.smHead;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  gyro.smHead += dh * 0.45;
  if (gyro.smBeta == null) gyro.smBeta = beta;
  gyro.smBeta += (beta - gyro.smBeta) * 0.45;
  if (!gyro.ready) {
    gyro.ready = true;
    gyro.baseHead = gyro.smHead;
    gyro.baseBeta = gyro.smBeta;
    gyro.baseWant = fp.yaw;
    gyro.basePitchWant = fp.pitch;
    gyro.wantYaw = fp.yaw;
    gyro.wantPitch = fp.pitch;
    return;
  }
  let dHead = gyro.smHead - gyro.baseHead;
  if (dHead > 180) dHead -= 360;
  if (dHead < -180) dHead += 360;
  if (orient === 90 || orient === 270) dHead = -dHead;
  const dBeta = gyro.smBeta - gyro.baseBeta;
  gyro.wantYaw = gyro.baseWant + THREE.MathUtils.degToRad(dHead);
  gyro.wantPitch = clamp(gyro.basePitchWant + THREE.MathUtils.degToRad(dBeta) * 0.85, -0.75, 0.65);
}
function smoothGyro(dt) {
  if (!fp.on || !gyro.ready || (fp.fish && fp.lookLock)) return;
  const k = 1 - Math.exp(-Math.max(0.001, dt) * 8);
  const err = Math.atan2(Math.sin(gyro.wantYaw - fp.yaw), Math.cos(gyro.wantYaw - fp.yaw));
  fp.yaw += err * k;
  fp.pitch += (gyro.wantPitch - fp.pitch) * k;
}
function toggleFishLock() {
  if (!fp.on || !fp.fish || !field) return;
  const btn = document.getElementById('fpLock');
  if (fp.lookLock) {
    fp.lookLock = false;
    resetGyro();
    if (btn) { btn.textContent = 'Lock'; btn.classList.remove('on'); }
    paintTrack();
    return;
  }
  const lake = field.anchors.lake;
  fp.yaw = Math.atan2(lake[0] - px, lake[1] - pz);
  fp.pitch = 0.22;
  gyro.wantYaw = fp.yaw;
  gyro.wantPitch = fp.pitch;
  fp.lookLock = true;
  if (btn) { btn.textContent = 'Locked'; btn.classList.add('on'); }
  paintTrack();
}

boot();
