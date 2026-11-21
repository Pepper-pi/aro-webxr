// Singularity: a hole in the day.
//
// It is opened over a place and held open. It is black, and what is behind it is seen bent round it (the page does
// that: a thing with no light of its own can only be shown by what it does to the light of other things). Round it
// turns a disc of what it has taken, white at its inner edge and dying outward through gold and rose to violet,
// faster the nearer in, so that it is drawn out into streaks; and outside that, level with it, rings of runes.
//
// While it is open everything goes to it. The day darkens to violet. Grass lies over toward it, leaves strain on
// their boughs and tear loose, sparks and petals and runes wind in, fire is drawn off the ground and out of the air
// and drunk, and what is built is taken apart block by block, the nearest first, and set circling in the disc.
//
// Let go, it falls in on itself: a moment in which everything is pulled, then nothing, then all it held is thrown
// out again, level, in a ring.
import * as THREE from 'three';
import { AIR } from './air.js';
import { SIGIL } from './sigil.js';

/** How high over the place it opens (m); its radius full grown; its disc's inner and outer edge, in radii; how long it can be held. */
const HEIGHT = 13, RH = 2.7, INNER = 1.35, DISC = 4.4, LAST = 11;
export const SHUT = 0.55;

export function createHole({ air, world, fx, fire, ruin, scene }) {
  const U = air.uniforms, rnd = fx.rnd, shared = () => Object.fromEntries(Object.keys(U).map((k) => [k, U[k]]));
  const own = { uAge: { value: 0 }, uOn: { value: 0 } };

  const disc = new THREE.Mesh(new THREE.RingGeometry(INNER * 0.9, DISC, 160, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: { ...shared(), ...own },
    vertexShader: /* glsl */ `varying vec3 vL; varying vec3 vW; void main() { vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: AIR + /* glsl */ `
      uniform float uAge; uniform float uOn; varying vec3 vL; varying vec3 vW;
      void main() {
        float r = length(vL.xz), u = (r - ${INNER.toFixed(2)}) / ${(DISC - INNER).toFixed(2)};
        if (u < 0.0 || u > 1.0) discard;
        // it turns faster the nearer in, so what is in it slides past what is beside it and is drawn out round the hole
        float a = atan(vL.z, vL.x) + uAge * 3.2 / pow(r, 1.5);
        vec2 ring = vec2(cos(a), sin(a));
        float n = aNoise3(vec3(ring * 1.3, r * 2.2)) * 0.5 + aNoise3(vec3(ring * 3.1 + 5.0, r * 5.0)) * 0.32 + aNoise3(vec3(ring * 7.0 + 9.0, r * 11.0)) * 0.18;
        // the side that comes toward the eye is the brighter
        float toward = 1.0 + 0.35 * dot(normalize(vec3(-vL.z, 0.0, vL.x)), normalize(cameraPosition - vW));
        // hottest at its inner edge, and dying outward in streaks
        float t = (1.0 - u) * (0.28 + 1.45 * n) * toward;
        // painted in a few tones: white at its inner edge, then gold, rose, and violet where it thins to nothing
        vec3 c = mix(vec3(0.16, 0.05, 0.62), vec3(0.75, 0.22, 1.5), smoothstep(0.2, 0.26, t));
        c = mix(c, vec3(2.8, 1.5, 0.45), smoothstep(0.36, 0.43, t));
        c = mix(c, vec3(4.4, 4.0, 3.4), smoothstep(0.62, 0.72, t));
        float alpha = smoothstep(0.1, 0.17, t) * smoothstep(0.0, 0.04, u) * uOn;
        if (alpha < 0.03) discard;
        gl_FragColor = vec4(c, alpha);
      }`,
  }));
  disc.visible = false; disc.frustumCulled = false;
  scene.add(disc);

  // the runes: a band of them round the disc, and a circle above the hole and one below, all level
  const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const rune = (sides, turn, from) => {
    const m = new THREE.Mesh(flat, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { ...shared(), uOn: { value: 0 }, uWritten: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vC; void main() { vC = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vC; uniform sampler2D tRunes; uniform float uNow; uniform float uOn; uniform float uWritten;
        ` + SIGIL + /* glsl */ `
        void main() {
          float r = length(vC);
          if (r > 1.0 || r < ${from.toFixed(2)}) discard;
          float I = sigil(vC, ${sides.toFixed(1)}, uNow * ${turn.toFixed(2)}, uWritten, length(fwidth(vC)));
          gl_FragColor = vec4((vec3(1.5, 0.8, 3.0) * min(I, 1.6) + vec3(1.4, 1.2, 1.6) * max(I - 0.8, 0.0)) * uOn, 1.0);
        }`,
    }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 9;
    scene.add(m);
    return m;
  };
  const band = rune(7, 0.22, 0.69), above = rune(7, -0.5, 0), below = rune(4, 0.6, 0);
  // the ring it throws out when it shuts
  const wave = new THREE.Mesh(flat, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uOn: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vC; void main() { vC = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vC; uniform float uOn;
      void main() {
        float r = length(vC), d = (r - 0.96) / 0.02;
        if (r > 1.0) discard;
        float d2 = (r - 0.8) / 0.012; gl_FragColor = vec4(vec3(3.2, 2.4, 4.2) * (exp(-d * d) + 0.45 * exp(-d2 * d2) + 0.05 * smoothstep(0.7, 0.96, r) * step(r, 0.96)) * uOn, 1.0);
      }`,
  }));
  wave.visible = false; wave.frustumCulled = false; wave.renderOrder = 9;
  scene.add(wave);

  // They are one thing, and all level with one another. It is tipped toward whoever opened it, so that from there the
  // disc is seen nearly edge-on: a bright line across the dark, with the rest of it bent up and over.
  const rig = new THREE.Group(), UP = new THREE.Vector3(0, 1, 0), lean = new THREE.Vector3();
  scene.add(rig);
  rig.add(disc, band, above, below);
  const C = new THREE.Vector3(), G = new THREE.Vector3(), light = { x: 0, y: -999, z: 0, r: 1, c: [1, 1, 1], power: 0 }, pull = { x: 0, y: 0, z: 0, pull: 0, swirl: 0.8, kill: 1, range: 36 };
  const SPARK = [[0.75, 0.5, 1], [1, 0.95, 1], [1, 0.8, 0.45], [0.5, 0.35, 1]], LEAF = [[0.3, 0.62, 0.12], [0.45, 0.72, 0.16], [1, 0.55, 0.75], [1, 0.97, 0.9], [0.2, 0.35, 0.9]];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  let grip = 0, closing = 0;
  let phase = 'idle', held = 0, age = 0, since = 0, real = 0, turned = 0, Rh = 0, R0 = 0, power = 0, dark = 0, shake = 0, pace = 1, white = 0, fov = 0, blur = 0, shockR = 0, shockP = 0, warm = 0, gone = 0;

  function show(on, written) {
    // (the circles above and below it are left out: seen edge-on they were a hat and a saucer)
    disc.visible = band.visible = on > 0.003; above.visible = below.visible = false;
    rig.position.copy(C); disc.scale.setScalar(Math.max(Rh, 0.01));
    own.uAge.value = turned; own.uOn.value = Math.min(1, on * 1.5);
    const set = (m, y, s) => { m.position.set(0, y, 0); m.scale.set(s, 1, s); m.material.uniforms.uOn.value = on; m.material.uniforms.uWritten.value = written; };
    set(band, 0, (DISC * Rh) / 0.69); set(above, 2.3 * Rh, 2.3 * Rh); set(below, -2.3 * Rh, 3.1 * Rh);
  }

  /** What it draws in: sparks, motes, grass and petals off the meadow, runes; leaves off the trees; fire off the ground. */
  function draw(dt, strength) {
    const n = (30 + 170 * strength) * dt;
    for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
      const a = Math.random() * 6.283, d = 8 + 22 * Math.random(), up = Math.random(), x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
      const gy = Math.max(world.ground(x, z), world.water), tv = 4 + 5 * Math.random(), p = Math.random();
      const o = { x, y: gy + 0.3 + up * up * (HEIGHT + 3), z, vx: -Math.sin(a) * tv, vy: 1 + 2 * Math.random(), vz: Math.cos(a) * tv, life: 2.4 + Math.random() };
      if (p < 0.42) fx.spawn({ ...o, kind: 1, size: [0.1, 0.03], colour: pick(SPARK) });
      else if (p < 0.66) fx.spawn({ ...o, kind: 3, size: [0.14, 0.05], colour: pick(SPARK) });
      else if (p < 0.93) { if (world.grassAt(x, z) > 0.4) fx.spawn({ ...o, y: gy + 0.3, kind: 4, size: [0.09, 0.09], colour: pick(LEAF), rot: Math.random() * 6.283, spin: rnd(9) }); }
      else fx.spawn({ ...o, kind: 7, size: [0.4, 0.2], colour: [0.8, 0.6, 1], rot: 0 });
    }
    for (let t = 1; t < world.trees.length; t++) {
      const tree = world.trees[t], d = Math.hypot(tree.x - G.x, tree.z - G.z);
      if (d > 34 || !tree.clumps.length || tree.burnt > 0.8) continue;
      const near = 1 - d / 34;
      tree.shake = Math.max(tree.shake ?? 0, 0.75 * strength * near); world.treeChanged(tree);
      const m = 34 * strength * near * dt;
      for (let q = Math.floor(m) + (Math.random() < m % 1 ? 1 : 0); q > 0; q--) { const [x, y, z, r] = pick(tree.clumps); fx.spawn({ kind: 4, x: x + rnd(r), y: y + rnd(r * 0.6), z: z + rnd(r), vx: rnd(1.5), vy: 1 + 2 * Math.random(), vz: rnd(1.5), life: 2.6 + Math.random(), size: [0.13, 0.13], colour: tree.frost > 0.5 ? [0.85, 0.94, 1] : [0.3 + 0.3 * Math.random(), 0.62, 0.12], rot: Math.random() * 6.283, spin: rnd(9) }); }
    }
    for (const [x, z] of fire.drain(G.x, G.z, 26, 0.7 * strength, dt)) {
      const y = world.ground(x, z);
      for (let k = 0; k < 5; k++) fx.spawn({ kind: 0, x: x + rnd(0.4), y: y + 0.4 + Math.random(), z: z + rnd(0.4), vx: rnd(1), vy: 3 + 3 * Math.random(), vz: rnd(1), life: 1.6 + 0.8 * Math.random(), size: [0.5, 0.2], colour: [1, 1, 1], alpha: 0.9 });
    }
  }

  function burst() {
    phase = 'burst'; since = 0; real = 0; shockR = 0; shockP = 1;
    fx.attract = null;
    // all it held goes out again, level, in a ring
    for (let i = 0; i < 420; i++) { const a = Math.random() * 6.283, sp = 14 + 50 * Math.random(); fx.spawn({ kind: 1, x: C.x, y: C.y, z: C.z, vx: Math.cos(a) * sp, vy: rnd(5), vz: Math.sin(a) * sp, life: 0.8 + 1.6 * Math.random(), size: [0.12, 0.03], colour: pick(SPARK), grav: -3, drag: 0.6 }); }
    for (let i = 0; i < 34; i++) { const a = Math.random() * 6.283, sp = 10 + 26 * Math.random(); fx.spawn({ kind: 7, x: C.x, y: C.y, z: C.z, vx: Math.cos(a) * sp, vy: rnd(3), vz: Math.sin(a) * sp, life: 0.8 + 0.6 * Math.random(), size: [0.5, 0.2], colour: [0.6, 0.4, 1], drag: 1, rot: 0 }); }
    for (let i = 0; i < 90; i++) { const a = Math.random() * 6.283, sp = 8 + 24 * Math.random(); fx.spawn({ kind: 4, x: C.x + rnd(1), y: C.y + rnd(1), z: C.z + rnd(1), vx: Math.cos(a) * sp, vy: 2 + rnd(5), vz: Math.sin(a) * sp, life: 2.5 + 1.5 * Math.random(), size: [0.11, 0.11], colour: pick(LEAF), grav: -3, drag: 0.7, rot: Math.random() * 6.283, spin: rnd(9) }); }
    fx.spawn({ kind: 6, x: C.x, y: C.y, z: C.z, life: 0.28, size: [2, 16], colour: [0.85, 0.75, 1], alpha: 0.9 });
    ruin?.fling(C, 19);
    for (let t = 1; t < world.trees.length; t++) { const tree = world.trees[t]; if (Math.hypot(tree.x - G.x, tree.z - G.z) < 40) { tree.shake = 1; world.treeChanged(tree); } }
  }

  const api = {
    /** Whether one is open, shutting or going off. */
    get busy() { return phase !== 'idle'; },
    get open() { return phase === 'open'; },
    /** Which part of it this is (idle, open, shut, burst); how hard it draws; and how far shut it is (0 to 1). */
    get phase() { return phase; }, get grip() { return phase === 'open' || phase === 'shut' ? grip : 0; }, get closing() { return phase === 'shut' ? closing : 0; },
    get centre() { return C; }, get ground() { return G; },
    /** Its radius now (m); how strongly it is there (0 to 1); how hard the view is drawn toward it. */
    get radius() { return Rh; }, /** How far its disc reaches (m). */ get reach() { return Rh * DISC; }, get power() { return phase === 'burst' ? 0 : power; }, get blur() { return blur; },
    /** For the page and the eye: how dark the day is, how white-blind, how shaken, how fast time runs, how much wider the eye opens (degrees). */
    /** How nearly all light has gone (0 to 1): as it shuts, and for the instant after. */
    get gone() { return gone; },
    get dark() { return dark; }, get white() { return white; }, get shake() { return shake; }, get pace() { return pace; }, get fov() { return fov; },
    get shockR() { return shockR; }, get shockP() { return phase === 'burst' ? shockP : 0; },
    light,
    /** Opened, over a place. */
    begin(target, eye) {
      phase = 'open'; held = 0; age = 0; turned = 0; G.copy(target); C.copy(target).setY(target.y + HEIGHT);
      const hx = C.x - eye.x, hz = C.z - eye.z, hd = Math.hypot(hx, hz) || 1, tip = Math.max(-0.6, Math.min(0, 0.13 - Math.atan2(C.y - eye.y, hd)));
      rig.quaternion.setFromUnitVectors(UP, lean.set((hx / hd) * Math.sin(tip), Math.cos(tip), (hz / hd) * Math.sin(tip)).normalize());
    },
    /** Held open a little longer. Says when it can be held no more. */
    hold(dt) { if (phase !== 'open') return true; held += dt; return held >= LAST; },
    /** Let go: it shuts. */
    release() { if (phase === 'open') { phase = 'shut'; since = 0; R0 = Rh; } },
    warm(p) { warm = 3; C.copy(p); },

    update(dt, realDt, eye) {
      pace = 1; shake = 0; light.power = 0; blur = 0; gone = 0;
      let wantDark = 0, wantFov = 0;
      if (warm > 0) {
        warm--; Rh = 0.05; turned = 1; show(0.02, 1);
        wave.visible = true; wave.position.copy(C); wave.scale.set(0.2, 1, 0.2); wave.material.uniforms.uOn.value = 0.02;
        if (warm === 0) { show(0, 0); wave.visible = false; Rh = 0; }
        return;
      }
      const far = Math.max(0, 1 - Math.hypot(C.x - eye.x, C.z - eye.z) / 120);
      if (phase === 'open' || phase === 'shut') {
        age += dt;
        const shutting = phase === 'shut', k = shutting ? Math.min(1, (since += dt) / SHUT) : 0;
        // it opens from a point, and goes on growing for as long as it is held
        const opened = 1 - (1 - Math.min(1, age / 0.6)) ** 3, size = 0.3 + 0.7 * (1 - Math.exp(-held * 0.5));
        if (!shutting) Rh = RH * size * opened; else Rh = R0 * Math.max(0.03, (1 - k) ** 2.2);
        power = opened;
        const strength = opened * (0.45 + 0.55 * size) * (shutting ? 1 + 2.5 * k : 1);
        grip = strength; closing = k;
        turned += dt * (1 + 7 * k);
        show(shutting ? 1 - k * k * k : opened, Math.min(1, age / 1.3));
        wave.visible = false;
        // everything goes to it
        Object.assign(pull, { x: C.x, y: C.y, z: C.z, pull: 70 * strength, kill: Math.max(Rh * 1.1, 0.5) });
        fx.attract = pull;
        U.uHole.value.set(C.x, C.y, C.z, Math.min(1.6, strength));
        U.uPush.value[3].set(G.x, G.z, 32, -1.25 * Math.min(1.3, strength));
        if (!shutting) draw(dt, strength);
        ruin?.orbit(C, lean.lengthSq() > 0.5 ? lean : UP, shutting ? 40 : 9 + 22 * size * opened, shutting ? R0 : Rh, k, dt);
        Object.assign(light, { x: C.x, y: C.y - 2, z: C.z, r: 48, c: [1.1, 0.75, 2.3], power: 0.7 * opened });
        // (as it shuts the last of the light goes with it)
        wantDark = 0.8 * opened + 0.2 * k; wantFov = 7 * opened * size + 9 * k; gone = k * k;
        if (shutting) dark = Math.max(dark, 0.8 + 0.2 * k);
        blur = 0.4 * k * k;
        shake = (0.06 * size * opened + 0.25 * k) * far;
        if (shutting && k >= 1) burst();
      } else if (phase === 'burst') {
        since += dt; real += realDt;
        // a moment of nothing; then the ring
        const beat = 0.16, after = Math.max(0, real - beat);
        pace = real < beat ? 0.05 : 1 - 0.95 * Math.exp(-after * 6);
        white = real < beat ? 0 : 0.9 * Math.exp(-after * 6);
        gone = real < beat ? 1 : Math.exp(-after * 9);
        wantDark = real < beat ? 1 : 0.75 * Math.exp(-after * 1.5);
        if (real < beat) { dark = 1; blur = 0.4; }
        show(0, 1);
        wave.visible = since < 1.1; wave.position.copy(C); const wr = 3 + 62 * since; wave.scale.set(wr, 1, wr); wave.material.uniforms.uOn.value = Math.max(0, 1 - since / 1.1) ** 2;
        shockR = 4 + 50 * since; shockP = 0.45 * Math.max(0, 1 - since / 1.3);
        U.uShock.value.set(G.x, G.z, shockR, 4.5 * shockP);
        U.uHole.value.w = 0; U.uPush.value[3].w = 0;
        Object.assign(light, { x: C.x, y: C.y, z: C.z, r: 90, c: [2.6, 2.0, 3.6], power: Math.exp(-since * 3.5) });
        shake = 1.1 * Math.exp(-since * 2.4) * far;
        wantFov = -5 * Math.exp(-since * 5);
        if (since > 2.2) { phase = 'idle'; U.uShock.value.w = 0; white = 0; Rh = 0; }
      } else {
        white = Math.max(0, white - dt * 3);
        if (fx.attract === pull) fx.attract = null;
      }
      dark += (wantDark - dark) * Math.min(1, realDt * (wantDark > dark ? 3 : 2.2));
      fov += (wantFov - fov) * Math.min(1, realDt * 9);
    },
  };
  return api;
}
