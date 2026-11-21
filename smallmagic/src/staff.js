// The staff, as it is held: old twisted wood, a wrapped grip, and at its head three prongs grown round a crystal
// that hangs between them without touching, turning slowly. A band of runes is cut into the wood under the head.
// It is drawn by itself after the world, close to the eye, and moves as a held thing does: it lags a turn of the
// head, dips with each step, and is never quite still.
import * as THREE from 'three';
import { SIGIL } from './sigil.js';
import { CELLS } from './air.js';
import { knead, roll } from './shape.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, HEART = V(0.002, 0.198, 0);

export function createStaff({ air, atlas }) {
  const U = air.uniforms, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.01, 20);
  const own = {
    uSunV: { value: V(0, 1, 0) }, uSunCol: U.uSunCol, uSkyCol: U.uSkyCol, uNow: U.uNow, uShade: { value: 1 },
    uGlow: { value: new THREE.Color('#58d8ff') }, uHeart: { value: V(0, 0, -1) }, uPower: { value: 1 },
  };
  const rig = new THREE.Group();
  scene.add(rig);

  // --- the wood ---
  const parts = [];
  // (a rolled piece knows, at each point of its skin, how far along it that is and how far round: the grain follows that)
  const coil = (g, points) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal'), len = curve.getLength(), N = 160, P = [], Nn = [], B = [], t = V(0, 0, 0), nrm = V(0, 1, 0);
    curve.getTangentAt(0, t);
    if (Math.abs(t.y) > 0.9) nrm.set(1, 0, 0);
    for (let i = 0; i <= N; i++) { curve.getTangentAt(i / N, t); nrm.addScaledVector(t, -nrm.dot(t)).normalize(); P.push(curve.getPointAt(i / N)); Nn.push(nrm.clone()); B.push(V(0, 0, 0).crossVectors(t, nrm)); }
    const p = g.attributes.position, c = new Float32Array(p.count * 3), v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let best = 0, bd = 1e9;
      for (let j = 0; j <= N; j++) { const d = v.distanceToSquared(P[j]); if (d < bd) { bd = d; best = j; } }
      v.sub(P[best]);
      const a = Math.atan2(v.dot(B[best]), v.dot(Nn[best]));
      c.set([Math.cos(a), Math.sin(a), (best / N) * len], i * 3);
    }
    g.setAttribute('coil', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const add = (g, colour, kind) => {
    const n = g.attributes.position.count, c = new THREE.Color(colour), tint = new Float32Array(n * 3), k = new Float32Array(n);
    for (let i = 0; i < n; i++) { tint.set([c.r, c.g, c.b], i * 3); k[i] = kind; }
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3)); g.setAttribute('kind', new THREE.BufferAttribute(k, 1));
    if (!g.attributes.coil) { const co = new Float32Array(n * 3); for (let i = 0; i < n; i++) co[i * 3] = 1; g.setAttribute('coil', new THREE.BufferAttribute(co, 3)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const WOOD = '#9a6a40', GOLD = '#d2a23c';
  // the shaft: not straight, thicker at its knots, flaring where the head leaves it
  const SHAFT = [V(0.012, -1.25, 0), V(-0.008, -0.9, 0.006), V(0.01, -0.55, -0.004), V(-0.006, -0.25, 0.005), V(0, -0.02, 0)];
  add(coil(knead(roll(SHAFT, (t) => 0.02 + 0.003 * Math.sin(t * 23) + 0.0035 * Math.sin(t * 9 + 1), { around: 14, every: 0.02 }), 0.0025, 30, 3), SHAFT), WOOD, 0);
  // the grip: wrapped in leather, bound above and below with gold, and a strap wound across the wrapping
  const GRIP = [V(0.006, -0.72, 0.002), V(0.01, -0.55, -0.004), V(0.004, -0.4, 0)];
  add(coil(roll(GRIP, 0.027, { around: 14, every: 0.02 }), GRIP), '#4a2f26', 1);
  for (const y of [-0.73, -0.39]) {
    add(new THREE.TorusGeometry(0.029, 0.006, 8, 22).rotateX(Math.PI / 2).translate(0.006, y, 0), GOLD, 2);
    add(new THREE.TorusGeometry(0.0285, 0.0022, 6, 22).rotateX(Math.PI / 2).translate(0.006, y + (y < -0.5 ? 0.012 : -0.012), 0), GOLD, 2);
  }
  { // (the strap, and the knot it ends in, with two tails)
    const strap = []; for (let i = 0; i <= 26; i++) { const u = i / 26, a = u * TAU * 2.5, y = -0.69 + u * 0.27; strap.push(V(0.008 + Math.cos(a) * 0.029, y, Math.sin(a) * 0.029)); }
    add(roll(strap, 0.0035, { around: 5, every: 0.012 }), '#2f1d18', 3);
    add(new THREE.SphereGeometry(0.0075, 8, 6).translate(0.036, -0.42, 0.006), '#2f1d18', 3);
    add(roll([V(0.036, -0.42, 0.006), V(0.045, -0.45, 0.012), V(0.043, -0.5, 0.016)], (t) => 0.0032 - 0.0015 * t, { around: 5, every: 0.012 }), '#2f1d18', 3);
    add(roll([V(0.036, -0.42, 0.006), V(0.05, -0.44, 0.0), V(0.052, -0.485, -0.004)], (t) => 0.0032 - 0.0015 * t, { around: 5, every: 0.012 }), '#2f1d18', 3);
  }
  // the head: the wood goes on up and curls over, like the head of a fern, and the crystal hangs in the curl
  const HEAD = [V(0, -0.06, 0), V(0.005, -0.01, 0.002), V(0.03, 0.045, 0.004), V(0.066, 0.115, 0.006), V(0.078, 0.19, 0.004), V(0.056, 0.258, 0), V(0.008, 0.29, -0.004), V(-0.045, 0.272, -0.006), V(-0.074, 0.222, -0.004), V(-0.07, 0.165, 0), V(-0.045, 0.132, 0.004)];
  add(coil(knead(roll(HEAD, (t) => 0.021 - 0.017 * t ** 0.8, { around: 12, every: 0.008 }), 0.0014, 45, 7), HEAD), WOOD, 0);
  // and a shoot off it, that reaches for the crystal from below
  const SHOOT = [V(0.014, 0.01, 0.004), V(-0.008, 0.05, 0.012), V(-0.022, 0.09, 0.01), V(-0.016, 0.122, 0.004)];
  add(coil(roll(SHOOT, (t) => 0.0095 - 0.007 * t, { around: 8, every: 0.008 }), SHOOT), WOOD, 0);
  // a collar of gold under the head, either side of the runes; and a ferrule where the curl ends
  for (const [y, r, w] of [[-0.148, 0.0235, 0.0045], [-0.137, 0.0228, 0.002], [-0.083, 0.0232, 0.002], [-0.072, 0.024, 0.0045]]) add(new THREE.TorusGeometry(r, w, 8, 22).rotateX(Math.PI / 2).translate(0, y, 0), GOLD, 2);
  add(new THREE.TorusGeometry(0.0062, 0.0022, 6, 14).rotateY(Math.PI / 2).rotateZ(-0.9).translate(-0.05, 0.137, 0.003), GOLD, 2);
  // a vine has grown up it, round the shaft and on round the curl, and keeps a few leaves
  {
    const vine = [], at = (u) => { const a = u * TAU * 3.2 + 1; return V(Math.cos(a) * 0.025 - 0.004 * (1 - u), -0.36 + u * 0.3, Math.sin(a) * 0.025); };
    for (let i = 0; i <= 30; i++) vine.push(at(i / 30));
    vine.push(V(0.012, -0.02, 0.022), V(0.03, 0.04, 0.022), V(0.058, 0.1, 0.02), V(0.082, 0.16, 0.014), V(0.07, 0.235, -0.014), V(0.03, 0.283, -0.018), V(-0.02, 0.292, 0.008));
    add(roll(vine, (t) => 0.0042 - 0.003 * t, { around: 6, every: 0.008 }), '#55391f', 3);
    const leaf = (p, yaw, tilt, s) => add(new THREE.OctahedronGeometry(1, 1).scale(0.0075 * s, 0.0016 * s, 0.015 * s).translate(0, 0, 0.013 * s).rotateX(tilt).rotateY(yaw).translate(p.x, p.y, p.z), ['#6aa838', '#86bd3e', '#4f9436'][Math.round(s * 7) % 3], 4);
    leaf(at(0.22), 0.4, -0.5, 1.1); leaf(at(0.5), 2.6, -0.3, 0.9); leaf(at(0.78), 4.4, -0.6, 1.2); leaf(at(0.93), 1.2, -0.2, 0.8);
    leaf(V(0.03, 0.04, 0.022), 0.9, -0.7, 1.0); leaf(V(0.082, 0.16, 0.014), 1.5, 0.3, 1.2); leaf(V(0.07, 0.235, -0.014), 2.4, 0.5, 0.9); leaf(V(-0.02, 0.292, 0.008), -1.2, 0.6, 1.0);
  }
  const woodMaterial = new THREE.ShaderMaterial({
    uniforms: own,
    vertexShader: /* glsl */ `
      attribute vec3 tint; attribute float kind; attribute vec3 coil; varying vec3 vRest; varying vec3 vN; varying vec3 vTint; varying float vKind; varying vec3 vView; varying vec3 vCoil;
      void main() { vRest = position; vN = normalize(normalMatrix * normal); vTint = tint; vKind = kind; vCoil = coil; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: CELLS + /* glsl */ `
      varying vec3 vRest; varying vec3 vN; varying vec3 vTint; varying float vKind; varying vec3 vView; varying vec3 vCoil;
      uniform vec3 uSunV; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGlow; uniform vec3 uHeart; uniform float uShade; uniform float uPower; uniform float uNow;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        vec3 N = normalize(vN), alb = vTint, lit = vec3(0.0);
        // how far round the piece this is (in turns), and how far along it (m)
        float th = atan(vCoil.y, vCoil.x) / 6.2832, s = vCoil.z, spec = 0.0;
        if (vKind < 0.5) {
          // Old wood, grown with a twist in it. Its grain runs along it in long lines that wander: dark in the furrow, with a
          // pale edge beside each where it is worn. Broader bands of two browns. Here and there a knot the grain goes round.
          float tw = th + s * 0.9;
          float cell = floor(s / 0.19), ks = (cell + 0.3 + 0.4 * h1(cell)) * 0.19, ka = h1(cell + 9.0), has = step(0.35, h1(cell + 4.0));
          vec2 kd = vec2((fract(tw - ka + 0.5) - 0.5) * 0.13, s - ks); float kr = length(kd * vec2(1.0, 0.75)), knot = (1.0 - smoothstep(0.004, 0.02, kr)) * has;
          alb = mix(alb, vTint * 0.42, (1.0 - smoothstep(0.003, 0.008, kr)) * has);
          alb *= 1.0 - 0.3 * knot * (0.5 + 0.5 * sin(kr * 1400.0));
          float g1 = sin(tw * 6.2832 * 9.0 + sin(s * 34.0) * 1.1 + sin(s * 7.0 + tw * 12.0) * 1.6 + knot * 5.0);
          float g2 = sin(tw * 6.2832 * 23.0 + sin(s * 61.0) * 1.3 + 2.0);
          alb *= 0.86 + 0.2 * smoothstep(-0.3, 0.7, sin(tw * 6.2832 * 3.0 + sin(s * 11.0) * 2.0)) + 0.05 * g2;
          float furrow = smoothstep(0.72, 0.95, g1);
          alb = mix(alb, vTint * 0.42, furrow * 0.85);
          alb += vTint * 0.3 * smoothstep(0.35, 0.7, g1) * (1.0 - furrow);
          // A channel is cut into it that winds up it once and again, and the crystal's light runs up the channel to the crystal.
          float mask = smoothstep(-0.37, -0.33, vRest.y) * (1.0 - smoothstep(-0.16, -0.15, vRest.y) * (1.0 - smoothstep(-0.07, -0.06, vRest.y)));
          float ch = abs(fract(th + s * 4.6) - 0.5), cut = (1.0 - smoothstep(0.035, 0.06, ch)) * mask, core = (1.0 - smoothstep(0.0, 0.03, ch)) * mask;
          alb = mix(alb, vTint * 0.28, cut);
          lit = uGlow * core * uPower * (0.55 + 0.75 * pow(0.5 + 0.5 * sin(s * 26.0 - uNow * 3.2), 3.0));
          // small marks cut beside it, like tallies
          float tk = fract(s * 46.0), tm = step(0.42, tk) * step(tk, 0.58) * step(0.075, ch) * step(ch, 0.12) * mask * step(0.5, h1(floor(s * 46.0)));
          alb = mix(alb, vTint * 0.35, tm); lit += uGlow * tm * uPower * 0.25;
        } else if (vKind < 1.5) {
          // leather, wound round: a line at each turn, and a line of stitches up it
          float turn = fract(s * 40.0 + th);
          alb *= 0.74 + 0.32 * smoothstep(0.04, 0.16, turn) * (1.0 - 0.6 * smoothstep(0.86, 1.0, turn));
          alb *= 0.92 + 0.1 * sin(th * 6.2832 * 40.0 + s * 300.0);
          float st = abs(fract(th + 0.25) - 0.5);
          alb = mix(alb, vec3(0.8, 0.7, 0.5), (1.0 - smoothstep(0.004, 0.009, abs(st - 0.02))) * step(0.3, fract(s * 85.0)) * 0.85);
        } else if (vKind < 2.5) {
          // gold: darker in the lines engraved round it, and it shines
          float a = atan(vRest.z, vRest.x);
          alb *= 0.72 + 0.4 * smoothstep(-0.3, 0.5, sin(a * 18.0));
          spec = 1.0;
        } else if (vKind > 3.5) {
          // a leaf: lighter where it is turned to the sky
          alb *= 0.85 + 0.3 * smoothstep(0.0, 1.0, N.y * 0.5 + 0.5);
        }
        float sun = smoothstep(-0.1, 0.55, dot(N, uSunV)) * uShade;
        vec3 col = alb * (uSunCol * sun + uSkyCol * (0.75 + 0.6 * (N.y * 0.5 + 0.5)) + vec3(0.06, 0.07, 0.04));
        // (a light along its edges, as a painter puts on a round thing to turn it)
        col += alb * uSunCol * pow(1.0 - abs(dot(N, normalize(-vView))), 3.0) * 0.5 * uShade;
        vec3 R = reflect(normalize(vView), N);
        col += spec * (uSunCol * pow(max(dot(R, uSunV), 0.0), 16.0) * 1.3 * uShade + alb * uSkyCol * 0.5 * pow(max(R.y, 0.0), 2.0));
        // the crystal's light on what is round it
        float d = distance(vView, uHeart);
        col += alb * uGlow * uPower * (1.6 / (1.0 + 900.0 * d * d)) * (0.4 + 0.6 * max(dot(N, normalize(uHeart - vView)), 0.0)) * (1.0 + spec);
        gl_FragColor = vec4(col + lit * 1.6, 1.0);
      }`,
  });
  const wood = new THREE.Mesh(mergeGeometries(parts), woodMaterial);
  rig.add(wood);

  // --- the runes cut round it, under the head ---
  {
    const pos = [], uv = [], index = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, glyph = (i * 5 + 3) % 32, u0 = (glyph % 8) / 8, v0 = 1 - (Math.floor(glyph / 8) + 1) / 4, r = 0.0265, hw = 0.01, hh = 0.015, p = pos.length / 3;
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const b = a + (x * hw) / r; pos.push(Math.cos(b) * r, -0.11 + y * hh, Math.sin(b) * r); uv.push(u0 + ((1 - x) / 2) / 8, v0 + ((y + 1) / 2) / 4); }
      index.push(p, p + 1, p + 2, p, p + 2, p + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    rig.add(new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { ...own, tRunes: { value: atlas } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying float vA; void main() { vUv = uv; vA = atan(position.z, position.x); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vA; uniform sampler2D tRunes; uniform vec3 uGlow; uniform float uNow; uniform float uPower;
        void main() { float a = texture2D(tRunes, vUv).r; gl_FragColor = vec4(uGlow * a * uPower * (1.2 + 1.2 * sin(uNow * 1.6 - vA)), 1.0); }`,
    })));
  }

  // --- the crystal ---
  const gemOf = (small) => new THREE.ShaderMaterial({
    defines: small ? { SMALL: 1 } : {},
    uniforms: own,
    vertexShader: /* glsl */ `varying vec3 vView; varying vec3 vRest; void main() { vRest = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vView; varying vec3 vRest; uniform vec3 uGlow; uniform vec3 uSunV; uniform float uNow; uniform float uPower;
      void main() {
        vec3 N = normalize(cross(dFdx(vView), dFdy(vView))), E = normalize(-vView);
        float facing = abs(dot(N, E)), rim = pow(1.0 - facing, 2.0);
        // each face has its own depth of colour, by which way it is turned; it is brightest along its edges and at its
        // heart; within it are flaws, planes that catch the light and lose it as it turns; and white where a face catches the sun
        float face = 0.3 + 0.7 * pow(max(dot(N, normalize(vec3(-0.4, 0.5, 0.75))), 0.0), 1.5);
        float heart = exp(-dot(vRest.xz, vRest.xz) * 9000.0 - vRest.y * vRest.y * 1400.0);
        #ifdef SMALL
        heart *= 0.1;
        #endif
        vec3 into = vRest - E * 0.006;
        float flaw = pow(abs(sin(dot(into, vec3(210.0, 95.0, 160.0)) + uNow * 0.4)), 14.0) + 0.7 * pow(abs(sin(dot(into, vec3(-130.0, 180.0, 90.0)) + 1.7)), 18.0);
        float vein = smoothstep(0.75, 1.0, sin(vRest.y * 180.0 - uNow * 2.4 + sin(vRest.x * 400.0) * 1.5)) * heart;
        vec3 col = (uGlow * (0.22 + 0.9 * face + 1.7 * rim + 0.55 * flaw) + vec3(0.7, 1.0, 1.0) * (1.3 * heart + 0.8 * vein)) * (0.85 + 0.15 * sin(uNow * 2.3)) * uPower;
        col += vec3(1.0) * (pow(max(dot(reflect(-E, N), uSunV), 0.0), 24.0) * 2.8 + pow(max(dot(reflect(-E, N), normalize(vec3(0.3, 0.8, 0.5))), 0.0), 40.0) * 1.2);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const gemMaterial = gemOf(false), chipMaterial = gemOf(true);
  const shard = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 6).toNonIndexed();
  const gem = new THREE.Mesh(shard([[0, -0.056], [0.011, -0.036], [0.0185, -0.014], [0.021, 0.012], [0.014, 0.038], [0.0, 0.062]]), gemMaterial);
  // small pieces of it keep it company, going slowly round
  const chips = [0, 1, 2].map((i) => { const m = new THREE.Mesh(shard([[0, -0.012], [0.0042, -0.003], [0.0036, 0.006], [0, 0.014]]), chipMaterial); rig.add(m); return { m, r: 0.034 + 0.006 * i, sp: 0.5 + 0.17 * i, ph: i * 2.1, y: (i - 1) * 0.03 }; });
  // and a charm hangs from the curl by a cord: a bead of gold and a drop of the same crystal. It hangs as the world has down, and swings.
  const charm = new THREE.Group();
  charm.position.set(0.079, 0.176, 0.01);
  rig.add(charm);
  {
    const bits = [], put = (g, colour, kind) => { const n = g.attributes.position.count, c = new THREE.Color(colour), tint = new Float32Array(n * 3), k = new Float32Array(n).fill(kind), co = new Float32Array(n * 3); for (let i = 0; i < n; i++) { tint.set([c.r, c.g, c.b], i * 3); co[i * 3] = 1; } g.setAttribute('tint', new THREE.BufferAttribute(tint, 3)); g.setAttribute('kind', new THREE.BufferAttribute(k, 1)); g.setAttribute('coil', new THREE.BufferAttribute(co, 3)); g.deleteAttribute('uv'); bits.push(g.index ? g.toNonIndexed() : g); };
    put(new THREE.CylinderGeometry(0.0009, 0.0009, 0.05, 5).translate(0, -0.025, 0), '#2f1d18', 3);
    put(new THREE.SphereGeometry(0.0042, 8, 6).translate(0, -0.052, 0), '#d2a23c', 2);
    put(new THREE.TorusGeometry(0.004, 0.0012, 5, 12).translate(0, -0.002, 0), '#d2a23c', 2);
    const hung = new THREE.Mesh(mergeGeometries(bits), woodMaterial);
    hung.frustumCulled = false;
    charm.add(hung);
    const drop = new THREE.Mesh(shard([[0, -0.016], [0.0052, -0.006], [0.0045, 0.006], [0, 0.011]]), chipMaterial);
    drop.position.y = -0.068; drop.frustumCulled = false;
    charm.add(drop);
  }
  gem.position.copy(HEART);
  rig.add(gem);
  // its glow in the air round it, and the motes that keep to it
  const soft = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...own, uSize: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vC; uniform float uSize; void main() { vC = position.xy; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying vec2 vC; uniform vec3 uGlow; uniform float uPower; void main() { float r = length(vC); gl_FragColor = vec4(uGlow * uPower * (exp(-r * r * 7.0) * 0.5 + exp(-r * r * 60.0) * 0.6) * (1.0 - smoothstep(0.8, 1.0, r)), 1.0); }`,
  });
  const quad = new THREE.PlaneGeometry(2, 2);
  const halo = new THREE.Mesh(quad, soft.clone());
  halo.material.uniforms = { ...own, uSize: { value: 0.13 } };
  halo.position.copy(HEART);
  rig.add(halo);
  const motes = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(quad, soft.clone());
    m.material.uniforms = { ...own, uSize: { value: 0.006 + 0.004 * (i % 3) } };
    rig.add(m);
    return { m, r: 0.035 + 0.025 * ((i * 7) % 5) / 4, sp: 0.9 + 0.5 * ((i * 3) % 4), ph: i * 1.7, tilt: (i - 3) * 0.35 };
  });
  // The circle a spell draws in the air before the staff as it is gathered: rings, a three-cornered figure, runes
  // round the rim, turning; it grows with the spell.
  const ring = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { ...own, tRunes: { value: atlas }, uCircle: { value: 0 }, uSides: { value: 3 } },
    vertexShader: /* glsl */ `varying vec2 vC; void main() { vC = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vC; uniform sampler2D tRunes; uniform vec3 uGlow; uniform float uNow; uniform float uCircle; uniform float uSides;
      ` + SIGIL + /* glsl */ `
      void main() {
        float r = length(vC), I = sigil(vC, uSides, uNow * 1.1, 1.0, length(fwidth(vC)));
        // (it is small in the eye: only its strong lines are kept, or it would be a plate of light over the crystal)
        I = max(I - 0.22, 0.0) * 0.95 + 0.06 * exp(-(r - 0.94) * (r - 0.94) * 280.0);
        gl_FragColor = vec4((uGlow * min(I, 1.5) + vec3(1.0) * max(I - 0.9, 0.0) * 0.4) * uCircle * 1.5 * step(r, 1.0), 1.0);
      }`,
  }));
  ring.renderOrder = 3;
  scene.add(ring);
  for (const o of [halo, gem, wood, ring, ...motes.map((x) => x.m), ...chips.map((x) => x.m)]) o.frustumCulled = false;
  const want = new THREE.Color('#58d8ff'), cast = { power: 1, circle: 0, kick: 0 }, swing = new THREE.Vector2(), hang = new THREE.Quaternion(), sway = new THREE.Quaternion(), tilt = new THREE.Euler();

  const REST = V(0.25, -0.17, -0.6), lag = new THREE.Vector2(), sunV = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    scene, camera,
    /** The spell in the staff: its colour, how strongly it is held, how far gathered (0 to 1), and the kick of one thrown. */
    cast(colour, power, circle, kick, dt, sides = 3) {
      ring.material.uniforms.uSides.value = sides;
      own.uGlow.value.lerp(want.copy(colour), Math.min(1, dt * 9));
      cast.power += (power - cast.power) * Math.min(1, dt * 10); cast.circle += (circle - cast.circle) * Math.min(1, dt * 10); cast.kick = kick;
      own.uPower.value = cast.power;
    },
    /** Where the crystal is in the world, as the eye sees it (into `out`). */
    tip(eye, out) {
      const k = Math.tan((eye.fov * Math.PI) / 360) / Math.tan((camera.fov * Math.PI) / 360), h = own.uHeart.value;
      return out.set(h.x * k, h.y * k, h.z).applyQuaternion(eye.quaternion).add(eye.position);
    },
    resize(aspect) {
      camera.aspect = aspect; camera.updateProjectionMatrix();
      // (it is drawn into the nearest sliver of depth there is, so that it is in front of the whole world without the world's depth being lost)
      const e = camera.projectionMatrix.elements;
      for (let c = 0; c < 4; c++) e[c * 4 + 2] = 0.01 * e[c * 4 + 2] - 0.99 * e[c * 4 + 3];
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    },
    /** walker: who holds it. eye: the camera the world is seen through. sun: how much sun reaches them, 0 to 1. */
    update(dt, walker, eye, sun) {
      const t = U.uNow.value, s = Math.min(1, walker.speed / 4.2);
      // it lags a turn of the head and comes after
      lag.x += (-walker.turned.x * 2.2 - lag.x * 9) * dt * 3.2; lag.y += (-walker.turned.y * 2.2 - lag.y * 9) * dt * 3.2;
      lag.clampLength(0, 0.2);
      // (a spell thrown kicks it back; one being gathered lifts it a little)
      const kx = cast.kick, lift = cast.circle * 0.03;
      rig.position.set(REST.x + lag.x * 0.25 + Math.cos(walker.stride * 1.7) * 0.012 * s, REST.y + lag.y * 0.2 + Math.sin(walker.stride * 3.4) * 0.011 * s + Math.sin(t * 1.1) * 0.003 - 0.05 * walker.landed - 0.02 * (walker.grounded ? 0 : 1) + lift, REST.z + kx * 0.07);
      rig.rotation.set(-0.36 + lag.y * 0.5 + Math.sin(t * 0.9) * 0.008 + kx * 0.3 - cast.circle * 0.12, -0.3 + lag.x * 0.6, 0.4 + lag.x * 0.4 + Math.cos(walker.stride * 1.7) * 0.02 * s);
      gem.rotation.y = t * 0.7; gem.position.y = HEART.y + Math.sin(t * 1.4) * 0.006;
      for (const o of chips) { const a = t * o.sp + o.ph; o.m.position.set(HEART.x + Math.cos(a) * o.r, gem.position.y + o.y + Math.sin(a * 1.7) * 0.008, Math.sin(a) * o.r); o.m.rotation.set(a * 1.3, a * 0.9, 0.4); }
      // the charm hangs straight down whatever way the staff is held, and swings after a turn of the head or a step
      swing.x += ((lag.x * 2.2 + Math.cos(walker.stride * 1.7) * 0.12 * s) - swing.x) * Math.min(1, dt * 5); swing.y += ((lag.y * 2.2 + Math.sin(t * 1.3) * 0.03) - swing.y) * Math.min(1, dt * 5);
      charm.quaternion.copy(hang.copy(rig.quaternion).invert()).multiply(sway.setFromEuler(tilt.set(swing.y, 0, swing.x)));
      halo.position.copy(gem.position);
      for (const o of motes) { const a = t * o.sp + o.ph; o.m.position.set(HEART.x + Math.cos(a) * o.r, HEART.y + Math.sin(a * 1.3 + o.ph) * 0.035 + Math.sin(o.tilt) * 0.02, Math.sin(a) * o.r); }
      // the sun, as the hand sees it
      own.uSunV.value.copy(sunV.copy(U.uSun.value).applyQuaternion(q.copy(eye.quaternion).invert()));
      own.uShade.value += (sun - own.uShade.value) * Math.min(1, dt * 6);
      rig.updateMatrixWorld(true);
      own.uHeart.value.copy(gem.position).applyMatrix4(rig.matrixWorld);
      ring.position.copy(own.uHeart.value); ring.position.z += 0.02;
      ring.scale.setScalar(0.035 + 0.075 * cast.circle);
      ring.material.uniforms.uCircle.value = Math.min(1, cast.circle * 2);
      halo.material.uniforms.uSize.value = 0.13 * (0.8 + 0.25 * cast.power);
    },
  };
}
