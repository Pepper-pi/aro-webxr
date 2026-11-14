// Tornado: a whirlwind that is called down and led about.
//
// How it comes. Where the staff points, at once: a circle of runes is written on the ground, the grass begins to go
// round, and dust and leaves wind up out of it in a small whirl that grows. Over it rings of runes are written in
// the air one above another, a lid of cloud winds itself up, dark, with light flickering in it, and the day goes
// grey. Then lightning comes down through the rings into the circle, everything is white for an instant, and the
// funnel is driven down the path of it and strikes: a ring goes out through the grass, the rune rings burst and
// are gone, and from then on there is only the storm.
//
// From then it goes where the staff points for as long as it is held, leaning back from the way it goes, and
// everything near its foot goes round it and up: grass lies in a ring, leaves and petals and dust climb it in a
// helix, trees thrash and shed, and what is built is taken a block at a time, carried up and round, and thrown out.
//
// It takes on what it passes over. Over fire it draws the fire up into itself and becomes a pillar of flame that
// sets alight what it crosses; over frost it whitens and leaves frost behind it; over water it is a spout.
// Let go, it draws back up into the cloud, drops what it carried, and the cloud thins and is gone.
//
// The funnel is worked out through its whole depth along each line of sight (as the fireball is), about an axis that
// bends: a soft body with no shell to it, thick at its heart, torn at its edge, with a thin sleeve of mist outside.
import * as THREE from 'three';
import { AIR } from './air.js';
import { SIGIL } from './sigil.js';

/** How tall (m), how wide at its foot and at the cloud; how long it gathers, how long the funnel takes to be driven down, to go back up; how long it can be kept. */
const H = 34, R0 = 2.1, R1 = 13, GATHER = 1.15, SLAM = 0.3, UP = 1.5, LAST = 20, CLOUD = 95;
const RINGS = [0.2, 0.45, 0.72];

export function createTwister({ air, world, fx, fire, ruin, scene }) {
  const U = air.uniforms, rnd = fx.rnd, shared = () => Object.fromEntries(Object.keys(U).map((k) => [k, U[k]]));
  const own = { uBase: { value: new THREE.Vector3() }, uShape: { value: new THREE.Vector4(H, R0, R1, 0) }, uLean: { value: new THREE.Vector4() }, uOn: { value: 0 }, uNear: { value: 0 }, uSpout: { value: 0 } };
  const card = () => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3)).setIndex([0, 1, 2, 0, 2, 3]);

  const funnel = new THREE.Mesh(card(), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { ...shared(), ...own },
    vertexShader: /* glsl */ `
      uniform vec3 uBase; uniform vec4 uShape; uniform vec4 uLean; uniform float uNear; varying vec3 vW;
      void main() {
        // a card that only says which part of the view to work out: it stands between the eye and the funnel
        vec3 mid = uBase + vec3(uLean.x * 0.5, 0.0, uLean.y * 0.5);
        vec2 f = normalize(cameraPosition.xz - mid.xz + vec2(1e-4, 0.0)), r = vec2(-f.y, f.x);
        float Rb = uShape.z * 1.5 + length(uLean.xy) * 0.5 + 4.0;
        vec3 w = mid + vec3(f.x, 0.0, f.y) * uNear + vec3(r.x, 0.0, r.y) * position.x * (Rb + 1.0) + vec3(0.0, -4.5 + position.y * (uShape.x + 6.5), 0.0);
        vW = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: AIR + /* glsl */ `
      uniform vec3 uBase; uniform vec4 uShape; uniform vec4 uLean; uniform float uOn; uniform float uSpout; varying vec3 vW;
      vec2 axis(float h) { return uLean.xy * pow(h, 1.6) + vec2(sin(h * 5.0 + uNow * 0.9), cos(h * 4.2 + uNow * 0.7)) * 1.4 * h * (1.0 - 0.3 * h); }
      void main() {
        float Ht = uShape.x;
        vec3 ro = cameraPosition, rd = normalize(vW - ro);
        // where the line of sight is inside an upright drum that holds all of it
        float Rb = uShape.z * 1.5 + length(uLean.xy) * 0.5 + 4.0;
        vec2 oc = ro.xz - uBase.xz - uLean.xy * 0.5;
        float qa = dot(rd.xz, rd.xz), qb = dot(oc, rd.xz), qd = qb * qb - qa * (dot(oc, oc) - Rb * Rb);
        if (qd < 0.0 || qa < 1e-6) discard;
        qd = sqrt(qd);
        float t0 = max((-qb - qd) / qa, 0.0), t1 = (-qb + qd) / qa;
        if (abs(rd.y) > 1e-4) { float ya = (uBase.y - 4.0 - ro.y) / rd.y, yb = (uBase.y + Ht - ro.y) / rd.y; t0 = max(t0, min(ya, yb)); t1 = min(t1, max(ya, yb)); }
        if (t1 <= t0) discard;
        // (each line of sight starts a different part of a step in: with none of that, or too little, the steps show as rings)
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        // it is walked up to in strides no longer than it can be away (it widens upward and bends, so a line of sight that climbs must allow for that), and through in steps as fine as it is narrow there
        float across = max(length(rd.xz), 0.05), climb = 1.3 * abs(rd.y), t = t0, tip = 1.0 - uShape.w, fireH = uLean.z * 1.25, in0 = 0.0;
        vec3 col = vec3(0.0); float A = 0.0;
        for (int i = 0; i < 72; i++) {
          if (t > t1) break;
          vec3 p = ro + rd * t;
          float h = (p.y - uBase.y) / Ht;
          // (once it stands it has no flat foot: it goes on down to the ground, wherever the ground is there)
          float stood = smoothstep(0.9, 1.0, uShape.w), low = mix(tip - 0.03, -4.0 / Ht, stood);
          if (h < low) { t += max(0.15, (low - h) * Ht / max(abs(rd.y), 0.05) * 0.9); continue; }
          float taper = max(smoothstep(tip - 0.03, tip + 0.16, h), stood);
          float R = (uShape.y + (uShape.z - uShape.y) * pow(clamp(h, 0.0, 1.0), 1.8)) * (0.15 + 0.85 * taper);
          // where it stands on the ground it throws up a skirt of what lies there
          R += uShape.y * 1.7 * pow(max(0.0, 1.0 - max(h, 0.0) / 0.13), 2.0) * stood;
          vec2 q = p.xz - uBase.xz - axis(clamp(h, 0.0, 1.0)); float rr = length(q), Rout = R * 1.5;
          if (rr > Rout) { t += max(0.1, (rr - Rout) / (across + climb) * 0.9); continue; }
          float ds = clamp(R * 0.1, 0.14, 1.0);
          if (in0 < 0.5) { in0 = 1.0; t += ds * ign; continue; }
          // It goes round, and what is in it is drawn out along the way it goes and upward: so it is looked up by how far
          // round and how high, the two wound together, and pushed about by a slower turning of the same.
          // (it turns at one rate at every height: were it to turn faster low down than high up, what is drawn on it would be wound tighter with every
          // second that passes, into rings as fine as hairs)
          float ang = atan(q.y, q.x) - uNow * 2.6 + p.y * 0.42 + rr * 0.35;
          vec2 cs = vec2(cos(ang), sin(ang));
          float wv = aNoise3(vec3(cs * 1.1 + 9.0, p.y * 0.11 - uNow * 0.45));
          float n1 = aNoise3(vec3(cs * 1.6 + wv * 1.3, p.y * 0.085 - uNow * 0.65 + rr * 0.12));
          float n2 = aNoise3(vec3(cs * 4.4 + 4.0 + wv * 2.0, p.y * 0.5 - uNow * 2.0));
          float n = n1 * 0.6 + n2 * 0.4, edge = R * (0.8 + 0.5 * n);
          // thick at its heart (a little hollow down the very middle), thinning to nothing across the outer half; and outside that a sleeve of mist, in rags
          float dens = (1.0 - smoothstep(edge * 0.62, edge, rr)) * (0.6 + 0.4 * smoothstep(0.0, R * 0.4, rr));
          dens += 0.1 * (1.0 - smoothstep(R * 0.95, Rout, rr)) * smoothstep(0.42, 0.75, n2 * 0.6 + wv * 0.4);
          // Its foot is lost in what it raises: it thins toward the ground, raggedly (here it is solid from knee height, there from head height), and is nothing under it.
          float up = p.y - texture2D(tHeight, (p.xz - uMap.xy) * uMap.z).r;
          if (up < -0.4) break;
          // (and round the foot, low and wide, the dust it has thrown out: in rags, turning with it)
          float low2 = 1.0 - smoothstep(0.4, 4.0 + 3.0 * wv, up);
          dens += 0.34 * stood * low2 * (1.0 - smoothstep(R * 0.5, Rout, rr)) * smoothstep(0.3, 0.72, n2 * 0.55 + n1 * 0.45);
          dens *= smoothstep(0.0, 1.1 + 3.4 * n1 + 1.6 * n2, up) * (0.4 + 0.6 * smoothstep(0.0, 5.0, up));
          if (dens < 0.004) { t += ds; continue; }
          float a = 1.0 - exp(-dens * ds * 7.0 / max(R * 0.34, 0.6));
          // lit on the side the sun is, and darker the deeper into it the eye has gone
          float tone = dot(normalize(vec3(q.x, -0.25 * rr, q.y)), uSun) * 0.75 + (n - 0.5) * 1.1 + 0.02 - A * 0.3;
          vec3 c = mix(vec3(0.03, 0.045, 0.1), vec3(0.13, 0.17, 0.27), smoothstep(-0.5, -0.12, tone));
          c = mix(c, vec3(0.36, 0.42, 0.52), smoothstep(-0.1, 0.25, tone));
          c = mix(c, vec3(0.9, 0.9, 0.86), smoothstep(0.3, 0.62, tone));
          c *= uSunCol * 0.72 + uSkyCol * 0.5;
          // dust at its foot; white where it has passed over frost or water
          c = mix(c, vec3(0.78, 0.66, 0.5) * (0.7 + 0.5 * n), max((1.0 - smoothstep(0.0, 0.2, h)) * 0.6, (1.0 - smoothstep(0.5, 6.0, up)) * mix(0.3, 0.85, smoothstep(R * 0.3, R * 0.85, rr))) * (1.0 - uSpout));
          c = mix(c, vec3(0.84, 0.93, 1.0) * (0.7 + 0.45 * n), max(uLean.w * 0.85, uSpout * 0.7 * (1.0 - smoothstep(0.1, 0.7, h))));
          // fire: drawn up into it from below, climbing as it takes more; above the fire it is smoke
          float burn = uLean.z * (1.0 - smoothstep(fireH - 0.3, fireH + 0.05, h + (n - 0.5) * 0.3));
          c = mix(c, c * vec3(0.4, 0.34, 0.34), uLean.z * 0.75);
          float temp = clamp((1.0 - rr / max(edge, 0.01)) * 1.0 + (n - 0.5) * 1.4 + 0.3 - A * 0.25, 0.0, 1.2);
          vec3 f = mix(vec3(0.45, 0.03, 0.01), vec3(1.5, 0.2, 0.03), smoothstep(0.12, 0.34, temp));
          f = mix(f, vec3(2.3, 0.95, 0.12), smoothstep(0.36, 0.62, temp));
          f = mix(f, vec3(3.4, 2.8, 1.5), smoothstep(0.7, 0.95, temp));
          c = mix(air(c, p), f, burn);
          col += (1.0 - A) * a * c; A += (1.0 - A) * a;
          if (A > 0.985) break;
          t += ds;
        }
        if (A < 0.004) discard;
        gl_FragColor = vec4(col, A) * uOn;
      }`,
  }));
  funnel.visible = false; funnel.frustumCulled = false; funnel.renderOrder = 5;
  scene.add(funnel);

  // the lid of cloud it hangs from
  const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const cloud = new THREE.Mesh(flat, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...shared(), uOn: { value: 0 }, uFire: { value: 0 }, uFlash: { value: 0 }, uGrown: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vC; varying vec3 vW; void main() { vC = uv * 2.0 - 1.0; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: AIR + /* glsl */ `
      varying vec2 vC; varying vec3 vW; uniform float uOn; uniform float uFire; uniform float uFlash; uniform float uGrown;
      void main() {
        float r = length(vC);
        if (r > 1.0) discard;
        // arms of it wind in toward the middle, and the whole turns
        float a = atan(vC.y, vC.x) - uNow * 0.3 + r * 5.0;
        vec2 cs = vec2(cos(a), sin(a));
        float n = aNoise3(vec3(cs * 1.5, r * 5.0)) * 0.5 + aNoise3(vec3(cs * 3.4 + 3.0, r * 11.0 - uNow * 0.12)) * 0.3 + aNoise(vC * 13.0 + uNow * 0.06) * 0.2;
        // thick in the middle, torn at the rim; it grows outward as it gathers
        float reach = uGrown * 1.05, cover = smoothstep(0.0, 0.14, n + (reach - r) * 1.6 - 0.45);
        // slate, darker in its folds, paler where it thins; lit from below by fire, and from within
        vec3 c = mix(vec3(0.07, 0.09, 0.16), vec3(0.2, 0.25, 0.36), smoothstep(0.36, 0.54, n));
        c = mix(c, vec3(0.42, 0.47, 0.57), smoothstep(0.56, 0.74, n));
        c *= uSunCol * 0.6 + uSkyCol * 0.6;
        c += vec3(1.9, 0.6, 0.1) * uFire * (1.0 - smoothstep(0.0, 0.55, r)) * (0.3 + 0.7 * n);
        c += vec3(0.9, 1.0, 1.7) * uFlash * smoothstep(0.4, 0.8, n) * (1.0 - r) * 1.6;
        float alpha = cover * (1.0 - smoothstep(0.85, 1.0, r)) * uOn;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(air(c, vW), alpha);
      }`,
  }));
  cloud.visible = false; cloud.frustumCulled = false; cloud.renderOrder = 4;
  scene.add(cloud);

  // the rings of runes written in the air while it gathers, level, one above another: they are gone once it has struck
  const rings = RINGS.map((h, i) => {
    const m = new THREE.Mesh(flat, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { ...shared(), uOn: { value: 0 }, uWritten: { value: 0 }, uWhite: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vC; void main() { vC = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vC; uniform sampler2D tRunes; uniform float uNow; uniform float uOn; uniform float uWritten; uniform float uWhite;
        ` + SIGIL + /* glsl */ `
        void main() {
          float r = length(vC);
          if (r > 1.0) discard;
          float I = sigil(vC, 9.0, uNow * ${((i % 2 ? -1 : 1) * (0.9 + 0.3 * i)).toFixed(2)}, uWritten, length(fwidth(vC)));
          gl_FragColor = vec4((mix(vec3(0.6, 1.5, 1.7), vec3(2.6, 2.8, 3.2), uWhite) * min(I, 1.6) + vec3(1.0) * max(I - 0.8, 0.0)) * uOn, 1.0);
        }`,
    }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 9;
    scene.add(m);
    return m;
  });

  // the lightning it comes down by: a card that faces the eye, with the stroke drawn on it
  const boltU = { uBase: own.uBase, uOn: { value: 0 }, uSeed: { value: 0 } };
  const bolt = new THREE.Mesh(card(), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { ...shared(), ...boltU },
    vertexShader: /* glsl */ `
      uniform vec3 uBase; varying vec2 vP;
      void main() {
        vec2 f = normalize(cameraPosition.xz - uBase.xz + vec2(1e-4, 0.0)), r = vec2(-f.y, f.x);
        vP = vec2(position.x * 9.0, position.y * ${H.toFixed(1)});
        gl_Position = projectionMatrix * viewMatrix * vec4(uBase + vec3(r.x, 0.0, r.y) * vP.x + vec3(0.0, vP.y, 0.0), 1.0);
      }`,
    fragmentShader: AIR + /* glsl */ `
      uniform float uOn; uniform float uSeed; varying vec2 vP;
      // where the stroke is at each height: it wanders, and jogs, and comes to the place exactly
      float path(float y, float s) { return ((aNoise(vec2(y * 0.3, s)) - 0.5) * 6.0 + (aNoise(vec2(y * 1.3, s + 7.0)) - 0.5) * 1.8 + (aNoise(vec2(y * 4.5, s + 3.0)) - 0.5) * 0.5) * smoothstep(0.0, 8.0, y); }
      void main() {
        float px = path(vP.y, uSeed), d = abs(vP.x - px);
        float I = exp(-d * d * 70.0) * 3.0 + exp(-d * 2.4) * 0.45;
        // two forks leave it on the way down and die out
        for (int k = 0; k < 2; k++) {
          float fk = float(k), y0 = 12.0 + 11.0 * fract(uSeed * (7.0 + fk * 3.0)), side = fk < 0.5 ? 1.0 : -1.0, below = y0 - vP.y;
          if (below > 0.0 && below < 10.0) { float db = abs(vP.x - (px + side * below * 0.42 + (aNoise(vec2(vP.y * 1.2, uSeed + 20.0 + fk * 9.0)) - 0.5) * 1.6 * smoothstep(0.0, 3.0, below))); I += (exp(-db * db * 110.0) * 1.5 + exp(-db * 3.5) * 0.18) * (1.0 - below / 10.0); }
        }
        gl_FragColor = vec4(vec3(2.4, 2.8, 4.0) * I * uOn, 1.0);
      }`,
  }));
  bolt.visible = false; bolt.frustumCulled = false; bolt.renderOrder = 10;
  scene.add(bolt);

  const base = new THREE.Vector3(), want = new THREE.Vector3(), vel = new THREE.Vector2(), lean = new THREE.Vector2(), hit = { x: 0, z: 0 };
  const light = { x: 0, y: -999, z: 0, r: 1, c: [1, 1, 1], power: 0 }, vortex = { vortex: true, x: 0, y: 0, z: 0, H, r0: R0, r1: R1, lx: 0, lz: 0, range: 16, spin: 15, lift: 7, grip: 5 };
  const LEAF = [[0.3, 0.62, 0.12], [0.45, 0.72, 0.16], [0.36, 0.66, 0.14], [1, 0.55, 0.75], [1, 0.97, 0.9], [0.2, 0.35, 0.9], [0.9, 0.2, 0.12]];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  let phase = 'idle', down = 0, grown = 0, cloudOn = 0, life = 0, since = 0, struck = Infinity, written = 0, fireLevel = 0, frostLevel = 0, spout = 0, dark = 0, shake = 0, flash = 0, nextFlash = 2, flashes = 0, lit = 0, wind0 = null, white = 0, mark = 0, ringing = false, seed = 0, warm = 0;
  const floor = (x, z) => Math.max(world.ground(x, z), world.water);

  function place() {
    own.uBase.value.copy(base); own.uShape.value.set(H, R0, R1, down); own.uLean.value.set(lean.x, lean.y, fireLevel, frostLevel); own.uSpout.value = spout;
    cloud.position.set(base.x + lean.x, base.y + H + 0.5, base.z + lean.y); cloud.scale.set(CLOUD, 1, CLOUD);
    const cu = cloud.material.uniforms; cu.uOn.value = cloudOn; cu.uGrown.value = grown; cu.uFire.value = fireLevel * down; cu.uFlash.value = flash;
    // the rings: written one after another as it gathers; when it strikes they flare white, open, and are gone
    const gone = struck < Infinity ? Math.min(1, struck / 0.8) : 0;
    rings.forEach((m, i) => {
      const h = RINGS[i], R = ((R0 + (R1 - R0) * h ** 1.8) * 1.5 + 2.5) * (1 + 0.7 * gone), w = Math.max(0, Math.min(1, written * 1.5 - i * 0.22)), u = m.material.uniforms;
      m.position.set(hit.x, base.y + h * H, hit.z); m.scale.set(R, 1, R);
      u.uOn.value = Math.min(1, w * 4) * (struck < Infinity ? 1.7 * (1 - gone) ** 2 : 0.75); u.uWritten.value = struck < Infinity ? 1 : w; u.uWhite.value = struck < Infinity ? 1 : 0;
      m.visible = u.uOn.value > 0.003;
    });
    // the stroke: twice, the second by another path, and gone
    const on = struck < 0.07 ? 1 : struck < 0.1 ? 0.2 : struck < 0.17 ? 0.9 : struck < 0.27 ? (0.27 - struck) * 9 : 0;
    bolt.visible = on > 0; boltU.uOn.value = on; boltU.uSeed.value = seed + (struck < 0.1 ? 0 : 13.7);
  }

  /** What it lifts from where it stands: dust, grass and petals; fire, ice or spray if it has taken those on. `much`: how much of it (1 when it stands). */
  function lift(dt, much, reach) {
    const onWater = world.ground(base.x, base.z) < world.water, grass = world.grassAt(base.x, base.z);
    const n = 95 * dt * much;
    for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) {
      const a = Math.random() * 6.283, r = 0.6 + reach * Math.random(), x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r, y = floor(x, z), p = Math.random();
      const o = { x, y: y + 0.3 + Math.random(), z, vx: -Math.sin(a) * 5, vy: 2 + 2 * Math.random(), vz: Math.cos(a) * 5 };
      if (fireLevel > 0.3 && p < 0.5 * fireLevel) { if (Math.random() < 0.6) fx.spawn({ ...o, kind: 0, life: 1.2 + Math.random(), size: [0.7, 0.25], colour: [1, 1, 1], alpha: 0.9 }); else fx.spawn({ ...o, kind: 1, life: 2 + 1.5 * Math.random(), size: [0.08, 0.02], colour: [1, 0.55, 0.12] }); }
      else if (frostLevel > 0.3 && p < 0.5) fx.spawn({ ...o, kind: 3, life: 2 + Math.random(), size: [0.1, 0.04], colour: [0.8, 0.95, 1] });
      else if (p < 0.34) fx.spawn({ ...o, kind: 2, life: 2 + 1.2 * Math.random(), size: [0.9, 3.6], colour: onWater || frostLevel > 0.4 ? [0.9, 0.95, 1] : fireLevel > 0.4 ? [0.12, 0.1, 0.1] : [0.78, 0.7, 0.58], alpha: 0.34, drag: 0.3 });
      else if (!onWater && grass > 0.3) fx.spawn({ ...o, kind: 4, life: 3 + 1.5 * Math.random(), size: [0.1, 0.1], colour: fireLevel > 0.5 && Math.random() < 0.5 ? [1, 0.45, 0.08] : pick(LEAF), rot: Math.random() * 6.283, spin: rnd(9) });
    }
  }
  function trees(dt) {
    for (let t = 1; t < world.trees.length; t++) {
      const tree = world.trees[t], d = Math.hypot(tree.x - base.x, tree.z - base.z);
      if (d > 20 || !tree.clumps.length) continue;
      const near = 1 - d / 20;
      tree.shake = Math.max(tree.shake ?? 0, near * 1.2 > 1 ? 1 : near * 1.2); world.treeChanged(tree);
      if (tree.burnt > 0.8) continue;
      const m = 70 * near * near * dt;
      for (let q = Math.floor(m) + (Math.random() < m % 1 ? 1 : 0); q > 0; q--) { const [x, y, z, r] = pick(tree.clumps); fx.spawn({ kind: 4, x: x + rnd(r), y: y + rnd(r * 0.6), z: z + rnd(r), vx: rnd(2), vy: 1 + 2 * Math.random(), vz: rnd(2), life: 3 + Math.random(), size: [0.13, 0.13], colour: tree.frost > 0.5 ? [0.85, 0.94, 1] : [0.3 + 0.3 * Math.random(), 0.62, 0.12], rot: Math.random() * 6.283, spin: rnd(9) }); }
      if (fireLevel > 0.5 && d < 7.5) { tree.frost = 0; fire.kindle(tree); }
    }
  }

  /** The lightning comes down, and the funnel after it. */
  function strike() {
    phase = 'slam'; since = 0; struck = 0; seed = Math.random() * 50; hit.x = base.x; hit.z = base.z; ringing = true;
    for (let i = 0; i < 90; i++) { const a = Math.random() * 6.283, sp = 6 + 12 * Math.random(); fx.spawn({ kind: 2, x: base.x + Math.cos(a) * 1.5, y: base.y + 0.4, z: base.z + Math.sin(a) * 1.5, vx: Math.cos(a) * sp, vy: 0.5 + 1.5 * Math.random(), vz: Math.sin(a) * sp, life: 1.4 + Math.random(), size: [0.7, 3.6], colour: [0.8, 0.74, 0.62], alpha: 0.32, drag: 1.3 }); }
    for (let i = 0; i < 110; i++) { const a = Math.random() * 6.283, sp = 6 + 20 * Math.random(); fx.spawn({ kind: 1, x: base.x, y: base.y + 0.5, z: base.z, vx: Math.cos(a) * sp, vy: 3 + 14 * Math.random(), vz: Math.sin(a) * sp, life: 0.5 + 0.8 * Math.random(), size: [0.09, 0.02], colour: Math.random() < 0.5 ? [0.7, 0.9, 1] : [1, 1, 1], grav: -14, drag: 0.8 }); }
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, sp = 5 + 10 * Math.random(), h = RINGS[i % 3] * H; fx.spawn({ kind: 7, x: base.x + Math.cos(a) * 6, y: base.y + h, z: base.z + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: rnd(2), vz: Math.sin(a) * sp, life: 0.7 + 0.5 * Math.random(), size: [0.7, 0.25], colour: [0.7, 0.95, 1], drag: 1.5, rot: 0 }); }
    fx.spawn({ kind: 6, x: base.x, y: base.y + 2, z: base.z, life: 0.3, size: [5, 26], colour: [0.75, 0.85, 1], alpha: 1 });
  }

  const api = {
    get busy() { return phase !== 'idle'; },
    /** Whether it stands on the ground and can be led. */
    get down() { return phase === 'live'; },
    /** Which part of it this is (idle, gather, slam, live, lift); how bright its lightning is now; how much frost it has taken on, and water. */
    get phase() { return phase; }, get flash() { return flash; }, get frost() { return frostLevel; }, get spout() { return spout; },
    get base() { return base; },
    /** How fully it is there (0 to 1); how much fire it has taken on; how strongly its circle is on the ground. */
    get power() { return down; }, get fire() { return fireLevel; }, get mark() { return mark; },
    /** For the page and the eye: how grey the day is, how white-blind, how shaken. */
    get dark() { return dark; }, get white() { return white; }, get shake() { return shake; },
    light,
    /** Called down over a place. */
    begin(target) { phase = 'gather'; down = 0; grown = 0; life = 0; since = 0; struck = Infinity; written = 0; flashes = 0; fireLevel = frostLevel = spout = 0; base.copy(target); want.copy(target); hit.x = target.x; hit.z = target.z; vel.set(0, 0); lean.set(0, 0); if (wind0 === null) wind0 = U.uWind.value.z; },
    /** Held: it is led toward a place. Says when it can be kept no longer. */
    steer(target, dt) { want.copy(target); life += dt; return life > LAST; },
    /** Let go: it draws back up. */
    release() { if (phase !== 'idle' && phase !== 'lift') phase = 'lift'; },
    warm(p) { warm = 3; base.copy(p); },

    update(dt, realDt, eye) {
      shake = 0; light.power = 0;
      if (warm > 0) {
        warm--;
        down = 1; grown = 1; cloudOn = 0.02; written = 1; struck = 0.05; hit.x = base.x; hit.z = base.z; place();
        own.uShape.value.set(1.2, 0.1, 0.4, 1); own.uOn.value = 0.03; own.uNear.value = 0; funnel.visible = cloud.visible = bolt.visible = true; cloud.scale.set(0.5, 1, 0.5); cloud.position.copy(base); boltU.uOn.value = 0.01;
        rings.forEach((m) => { m.visible = true; m.scale.set(0.2, 1, 0.2); m.position.copy(base); m.material.uniforms.uOn.value = 0.02; });
        if (warm === 0) { funnel.visible = cloud.visible = bolt.visible = false; rings.forEach((m) => (m.visible = false)); down = 0; grown = 0; cloudOn = 0; written = 0; struck = Infinity; }
        return;
      }
      white = Math.max(0, white - realDt * 5);
      if (struck < Infinity) {
        struck += dt;
        // the ring that goes out through the grass from where it struck
        if (struck < 1) U.uShock.value.set(hit.x, hit.z, 3 + 42 * struck, 2.4 * (1 - struck));
        else if (ringing) { ringing = false; U.uShock.value.w = 0; }
      }
      if (phase === 'idle') {
        if (cloudOn > 0) { cloudOn = Math.max(0, cloudOn - dt * 0.4); grown = Math.max(0, grown - dt * 0.1); place(); cloud.visible = cloudOn > 0.003; }
        mark = Math.max(0, mark - dt * 2); written = Math.max(0, written - dt * 3);
        dark += (0 - dark) * Math.min(1, realDt * 1.2);
        if (wind0 !== null) U.uWind.value.z += (wind0 - U.uWind.value.z) * Math.min(1, dt * 0.8);
        return;
      }
      const now = U.uNow.value, far = Math.max(0, 1 - Math.hypot(base.x - eye.x, base.z - eye.z) / 70);
      let g = 1;
      if (phase === 'gather') {
        // It is there at once, small: the circle, the grass going round, a whirl of dust that climbs; and the nub of the funnel shows under the cloud.
        since += dt; g = Math.min(1, since / GATHER);
        down = 0.3 * g * g; written = g; mark = Math.min(1, g * 2);
        grown = Math.min(1, g * 1.15); cloudOn = Math.min(1, since * 3.5);
        base.y = floor(base.x, base.z);
        Object.assign(vortex, { x: base.x, y: base.y, z: base.z, lx: 0, lz: 0, H: 3 + 11 * g, r0: 0.7, r1: 2.4, range: 5 + 6 * g, spin: 9 + 4 * g, lift: 4, grip: 5 });
        fx.attract = vortex;
        U.uTwist.value.set(base.x, base.z, 5 + 10 * g, 1.6 * g);
        lift(dt, 1 + 2.5 * g, 2 + 4 * g);
        const m = (10 + 40 * g) * dt;
        for (let q = Math.floor(m) + (Math.random() < m % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = 0.5 + 1.5 * Math.random(); fx.spawn({ kind: 2, x: base.x + Math.cos(a) * r, y: base.y + 0.3, z: base.z + Math.sin(a) * r, vx: -Math.sin(a) * 6, vy: 3 + 3 * Math.random(), vz: Math.cos(a) * 6, life: 1 + 0.6 * Math.random(), size: [0.5, 2.2], colour: [0.82, 0.78, 0.68], alpha: 0.4, drag: 0.3 }); }
        const n = (4 + 14 * g) * dt;
        for (let q = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); q > 0; q--) { const a = Math.random() * 6.283, r = 6 * Math.random(); fx.spawn({ kind: 7, x: base.x + Math.cos(a) * r, y: base.y + 0.5, z: base.z + Math.sin(a) * r, vx: -Math.sin(a) * 3, vy: 3 + 3 * Math.random(), vz: Math.cos(a) * 3, life: 0.9 + 0.5 * Math.random(), size: [0.25, 0.5], colour: [0.6, 0.95, 1], rot: 0 }); }
        // light in the cloud, quicker and quicker
        if (flashes < 3 && g > [0.4, 0.68, 0.88][flashes]) { flash = 0.7 + 0.15 * flashes; flashes++; }
        Object.assign(light, { x: base.x, y: base.y + 3, z: base.z, r: 22, c: [0.6, 1.3, 1.5], power: 0.5 * g });
        shake = 0.1 * g * far;
        if (since >= GATHER) strike();
      } else if (phase === 'slam') {
        since += dt; const k = Math.min(1, since / SLAM);
        down = 0.3 + 0.7 * (1 - (1 - k) ** 3);
        if (k >= 1) { phase = 'live'; down = 1; }
      } else if (phase === 'lift') {
        down = Math.max(0, down - dt / UP); written = Math.max(0, written - dt * 3);
        if (down <= 0) { phase = 'idle'; funnel.visible = bolt.visible = false; rings.forEach((m) => (m.visible = false)); U.uTwist.value.w = 0; if (fx.attract === vortex) fx.attract = null; ruin?.twist({ on: false }, dt); return; }
      }
      flash = Math.max(0, flash - dt * 5);
      if (struck < Infinity) {
        mark = Math.max(0, 1 - struck / 1.2);
        if (struck < 0.09 && white < 0.4) white = 0.4;
        flash = Math.max(flash, 1.6 * Math.exp(-struck * 6));
        shake = Math.max(shake, 1.5 * Math.exp(-struck * 4) * far);
        if (struck < 0.5) Object.assign(light, { x: hit.x, y: base.y + 9, z: hit.z, r: 80, c: [2.4, 2.8, 4], power: Math.exp(-struck * 8) });
        nextFlash -= dt;
        if (nextFlash <= 0) { flash = Math.max(flash, 0.6 + 0.4 * Math.random()); nextFlash = 0.8 + 3.2 * Math.random(); }
      } else mark = phase === 'lift' ? Math.max(0, mark - dt * 3) : mark;
      const standing = phase === 'live' || phase === 'slam';
      if (phase === 'live') {
        // it goes where it is led, no faster than a run, and leans back from the way it goes
        const dx = want.x - base.x, dz = want.z - base.z, d = Math.hypot(dx, dz), sp = Math.min(7.5, d * 1.4), k = Math.min(1, dt * 2.2);
        vel.x += ((d > 0.01 ? (dx / d) * sp : 0) - vel.x) * k; vel.y += ((d > 0.01 ? (dz / d) * sp : 0) - vel.y) * k;
        base.x += vel.x * dt; base.z += vel.y * dt;
      } else vel.multiplyScalar(Math.exp(-dt * 2));
      base.y = floor(base.x, base.z);
      lean.x += (-vel.x * 1.25 - lean.x) * Math.min(1, dt * 1.5); lean.y += (-vel.y * 1.25 - lean.y) * Math.min(1, dt * 1.5);

      if (standing) {
        Object.assign(vortex, { x: base.x, y: base.y, z: base.z, lx: lean.x, lz: lean.y, H, r0: R0, r1: R1, range: 16, spin: 15, lift: 7, grip: 5 });
        fx.attract = vortex;
        U.uTwist.value.set(base.x, base.z, 15, 1.5);
        lift(dt, 1, 7); trees(dt);
        // what it is over: fire is drawn up into it; frost and water whiten it
        const hot = fire.near(base.x, base.z, 4.5), cell = world.state, ci = Math.floor((base.x - cell.x0) / cell.cell), cj = Math.floor((base.z - cell.z0) / cell.cell);
        const frozen = ci >= 0 && cj >= 0 && ci < cell.N && cj < cell.N && cell.data[(cj * cell.N + ci) * 4 + 1] > 110, onWater = world.ground(base.x, base.z) < world.water;
        fireLevel = Math.max(0, Math.min(1, fireLevel + (hot > 2 ? 0.7 : -0.06) * dt));
        frostLevel = fireLevel > 0.15 ? Math.max(0, frostLevel - dt) : Math.max(0, Math.min(1, frostLevel + (frozen ? 0.7 : -0.08) * dt));
        spout += ((onWater ? 1 : 0) - spout) * Math.min(1, dt * 1.5);
        if (fireLevel > 0.3) { lit -= dt; if (lit <= 0) { lit = 0.2; if (!onWater) fire.ignite(base.x, base.z, 3.4, 0.9); } }
        else if (frostLevel > 0.3) world.mark(base.x, base.z, 4.5, 1, dt * 0.9);
        const sp = vel.length();
        if (sp > 0.5) fire.fan(base.x, base.z, vel.x / sp, vel.y / sp, 7);
        if (phase === 'live') ruin?.twist({ on: true, x: base.x, y: base.y, z: base.z, H, r0: R0, r1: R1, lx: lean.x, lz: lean.y, reach: 9, now }, dt);
        shake = Math.max(shake, 0.3 * far * far + 0.5 * Math.max(0, 1 - Math.hypot(base.x - eye.x, base.z - eye.z) / 14));
        if (fireLevel > 0.05 && light.power < fireLevel) Object.assign(light, { x: base.x + lean.x * 0.2, y: base.y + 9, z: base.z + lean.y * 0.2, r: 50, c: [3.2, 1.3, 0.35], power: fireLevel * (0.85 + 0.15 * Math.sin(now * 19)) });
      } else if (phase === 'lift') {
        U.uTwist.value.w = 0;
        if (fx.attract === vortex) fx.attract = null;
        ruin?.twist({ on: false }, dt);
        fireLevel = Math.max(0, fireLevel - dt * 0.6);
      }
      U.uWind.value.z += (1.35 - U.uWind.value.z) * Math.min(1, dt * 0.8);
      dark += (0.85 * (phase === 'gather' ? g : phase === 'lift' ? Math.min(1, down * 2) : 1) - dark) * Math.min(1, realDt * 2.5);
      place();
      own.uOn.value = 1;
      own.uNear.value = Math.max(0, Math.min(R1 * 1.5 + lean.length() * 0.5 + 4, Math.hypot(base.x + lean.x * 0.5 - eye.x, base.z + lean.y * 0.5 - eye.z) - 3));
      funnel.visible = down > 0.01; cloud.visible = cloudOn > 0.003;
    },
  };
  return api;
}
