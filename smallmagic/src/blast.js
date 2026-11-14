// Explosion: the one spell that is waited for.
//
// It is gathered for some seconds. While it gathers, circles of runes come one above another in the sky over the
// place, the day goes dark and red, light is drawn in from all round to a point above the highest circle, and the
// grass leans in toward the place. Let go before it is ready and it comes to nothing.
//
// When it is ready it goes by itself. A spark falls through the circles, each flaring as it passes. Where it lands
// the world is, for an instant, ink: black and white and nothing else, and time all but stops. Then the fire:
// one great ball of it, worked out through its whole depth (not drawn on a card), white at first, that climbs,
// flattens and rolls under at its rim, on a stem, and cools to a crust with fire in its cracks, and at last to
// smoke. A ring goes out from it along the ground that lays the grass flat, strips the trees and throws down what
// is built; the ground under it is burnt bare and its edge is left alight.
import * as THREE from 'three';
import { AIR } from './air.js';
import { createBeam } from './beam.js';
import { SIGIL } from './sigil.js';

export const HEIGHTS = [3.5, 7.5, 11.5, 16, 21, 27];
const RADII = [9, 4.8, 7.2, 3.8, 11.5, 3], SIDES = [3, 4, 6, 5, 8, 3], TOP = HEIGHTS[HEIGHTS.length - 1];
/** Seconds it is gathered for. */
export const WINDUP = 2.8;
export const FALL = 0.25;
const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

export function createBlast({ air, world, fx, fire, ruin, scene }) {
  const U = air.uniforms, rnd = fx.rnd, shared = () => Object.fromEntries(Object.keys(U).map((k) => [k, U[k]]));

  // --- the circles in the sky ---
  const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const discs = HEIGHTS.map((h, i) => {
    const m = new THREE.Mesh(flat, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { ...shared(), uOn: { value: 0 }, uSides: { value: SIDES[i] }, uTurn: { value: (i % 2 ? -1 : 1) * (0.4 + 0.1 * i) }, uWhite: { value: 0 }, uWritten: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vC; void main() { vC = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vC; uniform sampler2D tRunes; uniform float uNow; uniform float uOn; uniform float uSides; uniform float uTurn; uniform float uWhite; uniform float uWritten;
        ` + SIGIL + /* glsl */ `
        void main() {
          float r = length(vC);
          if (r > 1.0) discard;
          float I = sigil(vC, uSides, uNow * uTurn, uWritten, length(fwidth(vC)));
          // (its lines burn white at their hearts; it has a glow of its own along its rim, and a faint light across it)
          vec3 hue = mix(vec3(2.8, 0.6, 0.1), vec3(3.4, 3.0, 2.5), uWhite);
          vec3 col = hue * min(I, 1.6) + vec3(1.6, 1.3, 0.9) * max(I - 0.8, 0.0);
          col += hue * (0.16 * exp(-(r - 0.94) * (r - 0.94) * 400.0) + 0.045 * (1.0 - r)) * smoothstep(0.0, 0.3, uWritten);
          gl_FragColor = vec4(col * uOn, 1.0);
        }`,
    }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 9;
    scene.add(m);
    return m;
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { ...shared(), uOn: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform sampler2D tRunes; uniform float uNow; uniform float uOn;
      ` + SIGIL + /* glsl */ `
      void main() {
        // three bands of runes going round it, each the other way from the last, fainter the higher
        float I = 1.0 - smoothstep(0.0, 0.012, vUv.y);
        for (int b = 0; b < 3; b++) {
          float fb = float(b), y0 = 0.06 + fb * 0.27, k = vUv.x * (48.0 - fb * 8.0) + uNow * (0.8 + 0.3 * fb) * (mod(fb, 2.0) * 2.0 - 1.0);
          I += sgGlyph(floor(k) * 3.0 + fb * 7.0, vec2(fract(k) * 1.25 - 0.125, (vUv.y - y0) / 0.17)) * (0.6 + 0.4 * sin(uNow * 3.0 + floor(k) * 2.4)) * (1.0 - 0.28 * fb);
          I += (1.0 - smoothstep(0.0, 0.005, abs(vUv.y - y0 + 0.022))) * 0.45 * (1.0 - 0.28 * fb);
        }
        gl_FragColor = vec4(vec3(2.6, 0.6, 0.1) * I * pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.3) * uOn, 1.0);
      }`,
  }));
  wall.visible = false; wall.frustumCulled = false; wall.renderOrder = 9;
  scene.add(wall);
  const pillar = createBeam(air);
  scene.add(pillar.mesh);

  // --- the fire itself ---
  const ballU = { uC: { value: new THREE.Vector3() }, uBall: { value: new THREE.Vector4(1, 1, 0, 0) }, uNear: { value: 0 } };
  const ball = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3)).setIndex([0, 1, 2, 0, 2, 3]),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { ...shared(), ...ballU },
      vertexShader: /* glsl */ `
        uniform vec3 uC; uniform vec4 uBall; uniform float uNear; varying vec3 vW;
        void main() {
          // a card that only says which part of the view to work out: it stands between the eye and the fire
          vec2 f = normalize(cameraPosition.xz - uC.xz + vec2(1e-4, 0.0)), r = vec2(-f.y, f.x);
          float top = uBall.y + uBall.x * 1.25, Rb = max(uBall.x * 1.75, top * 0.5 + 0.5);
          vec3 w = uC + vec3(f.x, 0.0, f.y) * uNear + vec3(r.x, 0.0, r.y) * position.x * (Rb * 1.2 + 1.0) + vec3(0.0, -1.0 + position.y * (top * 0.5 + Rb * 1.2 + 2.0), 0.0);
          vW = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: AIR + /* glsl */ `
        uniform vec3 uC; uniform vec4 uBall; varying vec3 vW;
        void main() {
          float R = uBall.x, H = uBall.y, age = uBall.z;
          vec3 ro = cameraPosition, rd = normalize(vW - ro);
          float top = H + R * 1.25, Rb = max(R * 1.75, top * 0.5 + 0.5);
          vec3 oc = ro - (uC + vec3(0.0, top * 0.5, 0.0));
          float b = dot(oc, rd), h = b * b - (dot(oc, oc) - Rb * Rb);
          if (h < 0.0) discard;
          h = sqrt(h);
          float t0 = max(-b - h, 0.0), t1 = -b + h;
          if (t1 <= t0) discard;
          const int N = 36;
          float dt = (t1 - t0) / float(N), j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          // how far it has turned from a ball into a cap on a stem; how hot it still is; and, at the very first, smooth
          float m = smoothstep(0.5, 2.6, age), hot = exp(-age * 0.33), calm = smoothstep(0.0, 0.4, age);
          vec3 cc = uC + vec3(0.0, H, 0.0), col = vec3(0.0); float A = 0.0;
          for (int i = 0; i < N; i++) {
            vec3 p = ro + rd * (t0 + (float(i) + j) * dt);
            if (p.y < uC.y - 0.3) continue;
            vec3 q = (p - cc) / R; float rad = length(q.xz);
            // the cap: a ball, pressed flatter as it climbs, and hollowed underneath so that its rim rolls under
            float cap = 1.0 - length(q * vec3(1.0, 1.0 + 0.45 * m, 1.0));
            cap -= m * 0.9 * smoothstep(-0.05, -0.6, q.y) * (1.0 - smoothstep(0.25, 0.85, rad));
            // the stem: from the ground up into the cap, flared at its foot
            vec3 s = p - uC; float sr = R * (0.2 + 0.3 * exp(-s.y / (R * 0.35)));
            float d = max(cap, (1.0 - length(s.xz) / sr) * step(s.y, H) * m * 0.7);
            if (d < -0.5) continue;
            // it boils: big rolls of it, and smaller ones on those, all going up through it
            float n1 = aNoise3(q * 2.1 + vec3(0.0, -age * 0.45, 0.0)), n2 = aNoise3(q * 5.2 + vec3(1.7, -age * 0.8, 4.1));
            float dd = d + ((n1 - 0.5) * 0.6 + (n2 - 0.5) * 0.25) * calm;
            if (dd <= 0.0) continue;
            // hot in its depths and in the cracks of its crust, which darkens as it cools
            // (and where it turns away from the eye it is seen through more of its crust: that is what makes it round)
            float facing = dot(normalize(q + vec3(0.0, 0.3, 0.0)), -rd);
            float temp = clamp(0.5 + dd * 1.3 + ((n2 - 0.5) * 1.5 + (n1 - 0.5) * 0.8 + (aNoise3(q * 11.0 + vec3(3.1, -age * 1.3, 0.7)) - 0.5) * 0.7) * calm + 0.3 * (facing - 0.55) + 0.12 * q.y, 0.0, 1.3) * hot + (1.0 - calm);
            vec3 c = mix(vec3(0.045, 0.03, 0.04), vec3(0.34, 0.29, 0.31), clamp(0.45 + 0.4 * q.y + (n1 - 0.5) * 0.8, 0.0, 1.0)) * (uSunCol * 0.8 + uSkyCol * 0.4);
            c += vec3(1.0, 0.32, 0.05) * hot * 0.5 * smoothstep(0.3, -0.9, q.y);
            // (painted in a few tones, as everything here is: smoke, a dull red, red, orange, and a white heart)
            c = mix(c, vec3(0.5, 0.035, 0.01), smoothstep(0.1, 0.13, temp));
            c = mix(c, vec3(1.6, 0.22, 0.03), smoothstep(0.25, 0.29, temp));
            c = mix(c, vec3(2.2, 1.0, 0.12), smoothstep(0.45, 0.5, temp));
            c = mix(c, vec3(3.4, 2.8, 1.5), smoothstep(0.7, 0.76, temp));
            float a = smoothstep(0.0, 0.1, dd) * min(1.0, dt / (0.2 * R));
            col += (1.0 - A) * a * c; A += (1.0 - A) * a;
            if (A > 0.985) break;
          }
          if (A < 0.004) discard;
          gl_FragColor = vec4(col, A) * uBall.w;
        }`,
    }),
  );
  ball.visible = false; ball.frustumCulled = false; ball.renderOrder = 5;
  scene.add(ball);

  const C = new THREE.Vector3(), top = new THREE.Vector3(), at = new THREE.Vector3();
  const pending = [], light = { x: 0, y: -999, z: 0, r: 1, c: [1, 1, 1], power: 0 };
  let phase = 'idle', charge = 0, since = 0, real = 0, age = 0, dark = 0, white = 0, ink = 0, shake = 0, pace = 1, shockR = 0, shockP = 0, warm = 0, blaze = 0;

  function leaves(tree, n, hot) {
    if (!tree.clumps.length) return;
    const dx = tree.x - C.x, dz = tree.z - C.z, d = Math.hypot(dx, dz) || 1;
    for (let q = 0; q < n; q++) {
      const [x, y, z, r] = tree.clumps[Math.floor(Math.random() * tree.clumps.length)], sp = 9 + 16 * Math.random();
      fx.spawn({ kind: 4, x: x + rnd(r), y: y + rnd(r * 0.6), z: z + rnd(r), vx: (dx / d) * sp + rnd(4), vy: 2 + 6 * Math.random(), vz: (dz / d) * sp + rnd(4), life: 2 + 1.6 * Math.random(), size: [0.13, 0.13], colour: hot ? (Math.random() < 0.5 ? [1, 0.45, 0.08] : [0.06, 0.05, 0.05]) : [0.3 + 0.3 * Math.random(), 0.62, 0.12], grav: -3.5, drag: 0.7, rot: Math.random() * 6.283, spin: rnd(9) });
    }
  }

  function impact() {
    phase = 'boom'; age = 0; real = 0; shockR = 0; shockP = 1; dark = 0.3;
    const g = world.ground(C.x, C.z), onWater = g < world.water;
    // what is thrown out of it: fire along the ground, sparks high and far, and a glare
    for (let i = 0; i < 110; i++) { const a = Math.random() * 6.283, sp = 16 + 30 * Math.random(); fx.spawn({ kind: 0, x: C.x + rnd(1), y: C.y + 0.5 + 0.6 * Math.random(), z: C.z + rnd(1), vx: Math.cos(a) * sp, vy: 0.5 + 3 * Math.random(), vz: Math.sin(a) * sp, life: 0.5 + 0.7 * Math.random(), size: [0.8 + Math.random(), 1.8 + 1.6 * Math.random()], colour: [1, 1, 1], drag: 1.8 }); }
    for (let i = 0; i < 320; i++) { const a = Math.random() * 6.283, sp = 12 + 46 * Math.random(); fx.spawn({ kind: 1, x: C.x, y: C.y + 1, z: C.z, vx: Math.cos(a) * sp, vy: 8 + 38 * Math.random(), vz: Math.sin(a) * sp, life: 1.5 + 2.8 * Math.random(), size: [0.1, 0.03], colour: [1, 0.65, 0.2], grav: -14, drag: 0.35 }); }
    HEIGHTS.forEach((h, i) => { for (let k = 0; k < 16; k++) { const a = Math.random() * 6.283, sp = 6 + 12 * Math.random(); fx.spawn({ kind: 7, x: C.x + Math.cos(a) * RADII[i], y: C.y + h, z: C.z + Math.sin(a) * RADII[i], vx: Math.cos(a) * sp, vy: rnd(3), vz: Math.sin(a) * sp, life: 1 + 0.8 * Math.random(), size: [0.9, 0.3], colour: [1, 0.75, 0.4], drag: 1.2, rot: 0 }); } });
    fx.spawn({ kind: 6, x: C.x, y: C.y + 4, z: C.z, life: 0.5, size: [12, 70], colour: [1, 0.85, 0.6], alpha: 1.2 });
    fx.spawn({ kind: 6, x: C.x, y: C.y + 6, z: C.z, life: 2.4, size: [16, 44], colour: [1, 0.35, 0.06], alpha: 0.35 });
    // what it does to the place: frost and fresh growth are gone, the ground is burnt bare and its edge left alight
    world.mark(C.x, C.z, 17, 1, -1);
    world.mark(C.x, C.z, 12, 3, -1);
    if (onWater) for (let i = 0; i < 40; i++) fx.spawn({ kind: 2, x: C.x + rnd(6), y: world.water + 0.5, z: C.z + rnd(6), vx: rnd(3), vy: 3 + 5 * Math.random(), vz: rnd(3), life: 2.5 + 2 * Math.random(), size: [1.5, 6], colour: [0.92, 0.95, 1], alpha: 0.45, drag: 0.6 });
    fire.scorch(C.x, C.z, 10.5);
    ruin?.blast(at.copy(C).setY(C.y + 1), 17, 3.4);
    // the trees get it as the ring reaches them
    pending.length = 0;
    for (let t = 1; t < world.trees.length; t++) { const tree = world.trees[t], d = Math.hypot(tree.x - C.x, tree.z - C.z) - tree.r; if (d < 44) pending.push({ d: Math.max(0, d), tree }); }
  }

  const api = {
    /** How long it is gathered for (s). */
    windup: WINDUP,
    get charge() { return phase === 'gather' || phase === 'fade' ? charge : 0; },
    /** Which part of it this is: idle, gather, fade (let go too soon), fall, boom. */
    get phase() { return phase; },
    /** Whether one is going off (a new one cannot be begun). */
    get busy() { return phase === 'fall' || (phase === 'boom' && age < 7); },
    get centre() { return C; },
    /** For the page: how dark and red the day is (0 to 1); the ink of the instant it lands (1 black on white, -1 the other way); how white-blind; the ring in the air. */
    get dark() { return dark; }, get ink() { return ink; }, get white() { return white; },
    /** How much of its light is on everything in sight (0 to 1). */
    get blaze() { return blaze; },
    get shockR() { return shockR; }, get shockP() { return phase === 'boom' ? shockP : 0; },
    /** The circle left branded on the burnt ground, fading (0 to 1). */
    get brand() { return phase === 'boom' && age > 0.3 && age < 8 ? 1 - age / 8 : 0; },
    /** How much the eye is shaken (0 to 1 and over), and how fast time runs (1 as a rule). */
    get shake() { return shake; }, get pace() { return pace; },
    /** Its light on what is round it. */
    light,
    /** Begun, over a place. */
    begin(target) { phase = 'gather'; charge = 0; C.copy(target); ball.visible = false; U.uShock.value.w = 0; pending.length = 0; },
    /** Gathered a little more. Says when it is ready. */
    gather(dt) { if (phase !== 'gather') return false; charge = Math.min(1, charge + dt / WINDUP); return charge >= 1; },
    /** Let go before it was ready. */
    cancel() { if (phase === 'gather') phase = 'fade'; },
    /** It goes. */
    fire() { if (phase === 'gather') { phase = 'fall'; since = 0; } },
    /** Draws every part of it once, small and faint, so that the card has built them before they are needed. */
    warm(p) { warm = 3; C.copy(p); },

    update(dt, realDt, eye) {
      pace = 1; ink = 0; shake = 0; light.power = 0; blaze = 0;
      const far = Math.max(0, 1 - Math.hypot(C.x - eye.x, C.z - eye.z) / 110), now = U.uNow.value;
      top.copy(C).setY(C.y + TOP + 4);
      if (warm > 0) {
        warm--;
        discs.forEach((m, i) => { m.visible = true; m.position.set(C.x + i * 0.2, C.y + 0.3, C.z); m.scale.setScalar(0.2); m.material.uniforms.uOn.value = 0.02; m.material.uniforms.uWritten.value = 1; });
        wall.visible = true; wall.position.copy(C); wall.scale.set(0.2, 0.2, 0.2); wall.material.uniforms.uOn.value = 0.02;
        ball.visible = true; ballU.uC.value.copy(C); ballU.uBall.value.set(0.25, 0.2, 1.5, 0.03); ballU.uNear.value = 0;
        pillar.warm(C, at.copy(C).setY(C.y + 0.5));
        pillar.set(C, at, 0, 0.02, 0.02, [1, 1, 1], [1, 1, 1], 0);
        if (warm === 0) { discs.forEach((m) => (m.visible = false)); ball.visible = false; wall.visible = false; }
        return;
      }
      if (phase === 'fade') { charge -= dt * 2.5; if (charge <= 0) { charge = 0; phase = 'idle'; } }
      let want = 0;

      if (phase === 'gather' || phase === 'fade' || phase === 'fall') {
        const falling = phase === 'fall';
        if (falling) since += dt;
        discs.forEach((m, i) => {
          // (each is written in its turn, from the lowest up)
          const u = m.material.uniforms, on = Math.min(1, Math.max(0, (charge * (HEIGHTS.length + 0.7) - i) / 1.4));
          m.position.set(C.x, C.y + HEIGHTS[i], C.z);
          // (all level, one above another)
          m.rotation.set(0, 0, 0);
          let scale = RADII[i], lit = Math.min(1, on * 4) * (0.85 + 0.15 * Math.sin(now * 9 + i * 2)), whiten = Math.max(0, (charge - 0.75) / 0.25) * 0.5;
          if (falling) {
            // the spark has passed it: it flares white, opens, and is gone
            const e = (since - (1 - HEIGHTS[i] / TOP) * FALL) / 0.12;
            if (e > 0) { whiten = 1; lit = 1.6 * Math.max(0, 1 - e); scale *= 1 + 0.6 * e; }
          }
          m.visible = lit > 0.003; m.scale.set(scale, 1, scale); u.uOn.value = lit; u.uWhite.value = whiten; u.uWritten.value = falling ? 1 : on;
        });
        // the wall of runes round the place, as wide as the seal on the ground
        const wr = 4 + 8 * charge;
        wall.visible = true; wall.position.copy(C); wall.scale.set(wr, 5 + 3 * charge, wr);
        wall.material.uniforms.uOn.value = falling ? 1.6 * Math.max(0, 1 - since / FALL) : charge;
        // runes adrift, going up and round
        const n0 = (5 + 22 * charge) * dt * (falling ? 0 : 1);
        for (let q = Math.floor(n0) + (Math.random() < n0 % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = wr * (0.25 + 0.75 * Math.random()); fx.spawn({ kind: 7, x: C.x + Math.cos(a) * r, y: C.y + 0.5 + 2 * Math.random(), z: C.z + Math.sin(a) * r, vx: -Math.sin(a) * 2.2, vy: 1.5 + 2.5 * Math.random(), vz: Math.cos(a) * 2.2, life: 1.4 + 0.8 * Math.random(), size: [0.3, 0.55], colour: [1, 0.5, 0.12], rot: 0 }); }
        // light is drawn in to a point above the highest circle, and rises from the place below
        const n = (20 + 130 * charge) * dt * (falling ? 0 : 1);
        for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
          const a = Math.random() * 6.283, el = (Math.random() - 0.35) * 1.6, d = 9 + 12 * Math.random(), sp = 13 + 9 * Math.random();
          const x = Math.cos(a) * Math.cos(el) * d, y = Math.sin(el) * d, z = Math.sin(a) * Math.cos(el) * d;
          fx.spawn({ kind: 1, x: top.x + x, y: top.y + y, z: top.z + z, vx: (-x / d) * sp, vy: (-y / d) * sp, vz: (-z / d) * sp, life: d / sp, size: [0.09, 0.03], colour: Math.random() < 0.3 ? [1, 0.92, 0.7] : [1, 0.45, 0.1] });
        }
        const n2 = (10 + 70 * charge) * dt * (falling ? 0 : 1);
        for (let q = Math.floor(n2) + (Math.random() < n2 % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = (4 + 8 * charge) * Math.sqrt(Math.random()), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r; fx.spawn({ kind: 3, x, y: Math.max(world.ground(x, z), world.water) + 0.2, z, vy: 3 + 5 * Math.random(), life: 0.8 + 0.6 * Math.random(), size: [0.12, 0.03], colour: [1, 0.45, 0.12] }); }
        if (!falling) {
          fx.spawn({ kind: 6, x: top.x, y: top.y, z: top.z, life: 0.07, size: [1 + 4 * charge, 1 + 4 * charge], colour: [1, 0.45, 0.1], alpha: 0.5 * charge });
          fx.spawn({ kind: 6, x: top.x, y: top.y, z: top.z, life: 0.07, size: [0.4 + 1.2 * charge, 0.4 + 1.2 * charge], colour: [1, 0.95, 0.8], alpha: charge });
          pillar.set(top, C, 0, 0.05, 0.1, [1, 0.3, 0.05], [1, 0.8, 0.5], 0.6 * charge * charge);
        } else {
          const k = Math.min(1, since / FALL);
          at.copy(top).lerp(C, k);
          pillar.set(top, at, 0, 0.5, 0.25, [3, 2.4, 1.6], [3, 3, 2.6], 3);
          fx.spawn({ kind: 6, x: at.x, y: at.y, z: at.z, life: 0.06, size: [5, 5], colour: [1, 0.95, 0.8], alpha: 1 });
        }
        U.uPush.value[2].set(C.x, C.z, 20, -0.85 * charge);
        want = falling ? 1 : charge * 0.9;
        shake = 0.1 * charge * charge * far;
        Object.assign(light, { x: top.x, y: top.y - 8, z: top.z, r: 45, c: [2.4, 0.7, 0.18], power: 0.55 * charge });
        if (falling && since >= FALL) impact();
      } else if (phase === 'boom') {
        age += dt; real += realDt;
        // the instant: ink, and time all but stopped; then white, and time let go again
        if (real < 0.14) { pace = 0.04; ink = real < 0.07 ? 1 : -1; white = 1; } else { pace = 1 - 0.96 * Math.exp(-(real - 0.14) * 5); white = Math.exp(-(real - 0.14) * 7); }
        const R = 2 + 12 * (1 - Math.exp(-age * 3.5)) + 0.9 * age, H = R * 0.45 + 3.6 * Math.max(age - 0.35, 0) ** 1.15;
        ballU.uC.value.copy(C); ballU.uBall.value.set(R, H, age, age < 6 ? 1 : Math.max(0, 1 - (age - 6) / 4));
        ballU.uNear.value = Math.max(0, Math.min(R * 0.9, Math.hypot(C.x - eye.x, C.z - eye.z) - 3));
        ball.visible = age < 10;
        discs.forEach((m) => (m.visible = false)); wall.visible = false;
        pillar.set(C, at.copy(C).setY(C.y + 12 + 70 * age), 0, 1.5 + 5 * age, 0.6, [3, 2, 1], [3, 3, 2.6], 4 * Math.exp(-age * 6));
        // the ring that goes out from it
        shockR += (60 * Math.exp(-age * 0.9) + 12) * dt; shockP = Math.max(0, 1 - shockR / 90);
        U.uShock.value.set(C.x, C.z, shockR, 2.6 * shockP);
        U.uPush.value[2].w = 0;
        for (let i = pending.length - 1; i >= 0; i--) {
          const { d, tree } = pending[i];
          if (d > shockR) continue;
          pending.splice(i, 1);
          if (d < 13) { tree.frost = 0; tree.burnt = Math.max(tree.burnt, 0.7); tree.burning = 1; leaves(tree, 130, true); }
          else { tree.shake = 1; leaves(tree, 30 + 70 * (1 - d / 44), false); if (d < 24) fire.kindle(tree); }
          world.treeChanged(tree);
        }
        if (shockR < 55) {
          const n = 90 * dt * (shockR / 20 + 0.5);
          for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
            const a = Math.random() * 6.283, x = C.x + Math.cos(a) * shockR, z = C.z + Math.sin(a) * shockR, y = Math.max(world.ground(x, z), world.water);
            if (Math.random() < 0.5) fx.spawn({ kind: 2, x, y: y + 0.5, z, vx: Math.cos(a) * 9, vy: 0.8 + 1.5 * Math.random(), vz: Math.sin(a) * 9, life: 1 + 0.8 * Math.random(), size: [0.8, 3.6], colour: [0.78, 0.72, 0.62], alpha: 0.28, drag: 1.2 });
            else if (world.grassAt(x, z) > 0.4) fx.spawn({ kind: 4, x, y: y + 0.3, z, vx: Math.cos(a) * (10 + 12 * Math.random()), vy: 3 + 6 * Math.random(), vz: Math.sin(a) * (10 + 12 * Math.random()), life: 1.4 + Math.random(), size: [0.08, 0.08], colour: Math.random() < 0.25 ? [1, 0.9, 0.85] : [0.3, 0.62, 0.12], grav: -5, drag: 0.9, rot: Math.random() * 6.283, spin: rnd(9) });
          }
        }
        // embers come down for a long while, and ash; and when the fire is gone the place goes on smoking
        if (age > 0.4 && age < 10) {
          const n = 46 * dt * (1 - age / 10);
          for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = R * 1.3 * Math.sqrt(Math.random()); fx.spawn({ kind: 1, x: C.x + Math.cos(a) * r, y: C.y + H + rnd(R * 0.5), z: C.z + Math.sin(a) * r, vx: Math.cos(a) * 5 + rnd(2), vy: rnd(3), vz: Math.sin(a) * 5 + rnd(2), life: 3 + 2.5 * Math.random(), size: [0.07, 0.02], colour: [1, 0.5, 0.1], grav: -4, drag: 0.5, wind: 1.5 }); }
        }
        if (age > 1.2 && age < 13) {
          const n = 30 * dt;
          for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = 34 * Math.sqrt(Math.random()); fx.spawn({ kind: 4, x: C.x + Math.cos(a) * r, y: C.y + 6 + 14 * Math.random(), z: C.z + Math.sin(a) * r, vx: rnd(0.6), vy: -1.2, vz: rnd(0.6), life: 4 + 2 * Math.random(), size: [0.05, 0.05], colour: [0.13, 0.12, 0.12], drag: 0.4, wind: 0.8, rot: Math.random() * 6.283, spin: rnd(5) }); }
        }
        if (age > 4.5 && age < 16) {
          const n = 7 * dt;
          for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) fx.spawn({ kind: 2, x: C.x + rnd(6), y: C.y + 1.5, z: C.z + rnd(6), vx: rnd(0.5), vy: 3 + 2 * Math.random(), vz: rnd(0.5), life: 6 + 3 * Math.random(), size: [2, 9], colour: [0.09, 0.08, 0.1], alpha: 0.42, wind: 1, drag: 0.12 });
        }
        // (the dark that gathered is burnt off: now the whole day is lit by it)
        want = 0.3 * Math.max(0, 1 - age / 9);
        blaze = (1.1 * Math.exp(-age * 0.6) + 0.25 * Math.exp(-age * 0.2)) * Math.min(1, far * 1.5);
        shake = (1.5 * Math.exp(-age * 1.3) + 0.25 * Math.exp(-age * 0.35)) * far;
        Object.assign(light, { x: C.x, y: C.y + H * 0.7 + 3, z: C.z, r: 100, c: [4.2, 2.1, 0.8], power: Math.exp(-age * 0.42) });
        if (age > 16) { phase = 'idle'; U.uShock.value.w = 0; }
      } else {
        discs.forEach((m) => (m.visible = false)); wall.visible = false;
        pillar.set(C, C, 0, 0.1, 0.1, [1, 1, 1], [1, 1, 1], 0);
        U.uPush.value[2].w = 0; white = 0;
      }
      if (phase !== 'boom') white = Math.max(0, white - dt * 3);
      dark += (want - dark) * Math.min(1, realDt * (want > dark ? 4 : 1.5));
    },
  };
  void hash;
  return api;
}
