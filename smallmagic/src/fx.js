// What a spell is seen by, in the air: flames, sparks, smoke and mist, motes of light, torn leaves, streaks of wind.
//
// Each is one small mark that faces the eye, and has a short life: where it is, how big, what colour and how far
// through its life it is are worked out here each frame, and the mark itself is drawn by its kind:
//   0 a flame: a tongue of fire, never the same shape twice, white at its heart and red where it dies;
//   1 a spark, an ember: a bright point, drawn out a little along the way it flies;
//   2 a puff: smoke, steam or cold mist, with a ragged edge that eats inward as it thins;
//   3 a mote: a small four-pointed star of light;
//   4 a leaf, a petal, a blade of grass torn loose, turning as it falls;
//   5 a streak: a line of moving air;
//   6 a glow: light with no edge, for what a fire throws round itself;
//   7 a rune, adrift.
// Light (0, 1, 3, 5) is added to what is behind it; smoke and leaves (2, 4) cover it.
import * as THREE from 'three';
import { AIR } from './air.js';
import { FIRE } from './flames.js';

const VERT = AIR + /* glsl */ `
  attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec3 iD;
  varying vec2 vC; flat varying vec4 vB; flat varying vec4 vCol; flat varying vec3 vP;
  void main() {
    vec4 mv = viewMatrix * vec4(iA.xyz, 1.0);
    vec2 c = position.xy; float kind = iB.z;
    if (kind > 4.5 && kind < 5.5) {
      // a line of air lies along the way it goes, in the world: one going away from the eye is seen going away
      vec3 al = normalize(iD + vec3(0.0, 1e-4, 0.0)), sd = normalize(cross(al, cameraPosition - iA.xyz) + vec3(1e-5, 0.0, 0.0));
      mv = viewMatrix * vec4(iA.xyz + (al * c.y * max(10.0, iB.w) + sd * c.x * 8.0) * iA.w, 1.0);
    } else if (kind > 0.5 && kind < 1.5) {
      // drawn out along the way it is going
      vec2 dir = (viewMatrix * vec4(iD, 0.0)).xy; float sp = length(dir); dir = sp > 1e-4 ? dir / sp : vec2(0.0, 1.0);
      float stretch = 1.0 + min(sp * 0.07, 3.0);
      mv.xy += (dir * c.y * stretch + vec2(-dir.y, dir.x) * c.x) * iA.w;
    } else {
      float a = iB.w; mv.xy += vec2(cos(a) * c.x - sin(a) * c.y, sin(a) * c.x + cos(a) * c.y) * iA.w * (kind < 0.5 ? vec2(0.7, 1.25) : vec2(1.0));
    }
    vC = c; vB = iB; vCol = iC; vP = iA.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
const LIGHT = AIR + FIRE + /* glsl */ `
  uniform sampler2D tRunes;
  varying vec2 vC; flat varying vec4 vB; flat varying vec4 vCol; flat varying vec3 vP;
  void main() {
    float life = vB.x, seed = vB.y, kind = vB.z, r = length(vC), a; vec3 col;
    if (kind < 0.5) {
      // a body of fire: hottest in its middle, narrower above, its edge eaten ragged, and eaten away as it dies
      float n = aNoise(vC * 2.1 + seed * 31.0 + vec2(0.0, -life * 2.2)) * 0.6 + aNoise(vC * 4.6 - seed * 13.0 + vec2(0.0, -life * 3.6)) * 0.4;
      float d = 1.0 - length(vC * vec2(1.0 + 0.6 * max(vC.y, 0.0), 1.0)) - (n - 0.3) * (0.55 + 0.8 * life) - life * 0.5;
      a = smoothstep(0.0, 0.1, d) * smoothstep(0.0, 0.08, life) * vCol.a;
      col = fireCol(clamp(d * 1.1 * (1.0 - 0.5 * life), 0.0, 1.0)) * vCol.rgb;
    } else if (kind < 1.5) {
      a = pow(max(1.0 - r, 0.0), 2.0) * (1.0 - life * life) * vCol.a; col = vCol.rgb * 3.5;
    } else if (kind < 3.5) {
      float star = pow(max(1.0 - r, 0.0), 3.0) + 0.7 * pow(max(max(1.0 - abs(vC.x) * 7.0 - abs(vC.y), 0.0), max(1.0 - abs(vC.y) * 7.0 - abs(vC.x), 0.0)), 2.0);
      a = star * sin(3.1416 * life) * vCol.a; col = vCol.rgb * 2.6;
    } else if (kind > 6.5) {
      float id = floor(seed * 32.0);
      a = texture2D(tRunes, (vec2(mod(id, 8.0), 3.0 - floor(id / 8.0)) + clamp(vC * 0.5 + 0.5, 0.0, 1.0)) / vec2(8.0, 4.0)).r * sin(3.1416 * clamp(life, 0.0, 1.0)) * vCol.a; col = vCol.rgb * 2.6;
    } else if (kind > 5.5) {
      a = pow(max(1.0 - r, 0.0), 2.2) * sin(3.1416 * clamp(life, 0.0, 1.0)) * vCol.a; col = vCol.rgb;
    } else {
      // a line of moving air: it wavers as it goes, and is thin at both ends
      float mid = 0.62 * sin(vC.y * 2.6 + seed * 40.0 + life * 5.0) * (1.0 - vC.y * vC.y);
      a = (1.0 - smoothstep(0.05, 0.2, abs(vC.x - mid))) * pow(max(1.0 - abs(vC.y), 0.0), 1.5) * sin(3.1416 * clamp(life, 0.0, 1.0)) * vCol.a; col = vCol.rgb * 2.0;
    }
    // (a flame is partly a thing in front of what is behind it, or against a bright sky it would have no colour)
    gl_FragColor = vec4(col * a, kind < 0.5 ? min(a * 0.75, 1.0) : 0.0);
  }`;
const SOFT = AIR + /* glsl */ `
  varying vec2 vC; flat varying vec4 vB; flat varying vec4 vCol; flat varying vec3 vP;
  void main() {
    float life = vB.x, seed = vB.y, kind = vB.z, r = length(vC), a; vec3 col;
    if (kind < 3.0) {
      // a puff: its edge is ragged, and is eaten inward as it thins
      float n = aNoise(vC * 1.7 + seed * 17.0 + vec2(0.0, -life * 0.7)) * 0.6 + aNoise(vC * 4.0 + seed * 5.0) * 0.4;
      a = (1.0 - smoothstep(0.3 - 0.25 * life, 1.0, r + (n - 0.5) * (0.6 + 0.6 * life))) * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.4, 1.0, life)) * vCol.a;
      // lit from above by the sun, blue underneath
      col = vCol.rgb * (uSunCol * (0.35 + 0.5 * smoothstep(-0.6, 0.8, vC.y + (n - 0.5))) + uSkyCol * 0.7) + lamps(vP) * 0.2 * (1.0 - smoothstep(-0.9, 0.8, vC.y));
    } else {
      // a leaf: pointed at both ends, seen now flat and now edge-on as it turns
      float flip = 0.25 + 0.75 * abs(sin(life * 9.0 + seed * 20.0));
      a = step(abs(vC.x) / flip, 0.62 * pow(max(1.0 - vC.y * vC.y, 0.0), 0.7)) * (1.0 - smoothstep(0.8, 1.0, life)) * vCol.a;
      col = vCol.rgb * (uSunCol * (0.5 + 0.5 * flip) + uSkyCol * 0.6);
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(col * a, a);
  }`;

class Pool {
  constructor(cap, light) {
    this.cap = cap; this.n = 0;
    const f = (k) => new Float32Array(cap * k);
    Object.assign(this, { p: f(3), v: f(3), life: f(1), max: f(1), size: f(2), col: f(4), kind: f(1), seed: f(1), rot: f(2), drag: f(1), grav: f(1), wind: f(1) });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.iA = new THREE.InstancedBufferAttribute(f(4), 4); this.iB = new THREE.InstancedBufferAttribute(f(4), 4); this.iC = new THREE.InstancedBufferAttribute(f(4), 4); this.iD = new THREE.InstancedBufferAttribute(f(3), 3);
    for (const a of [this.iA, this.iB, this.iC, this.iD]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.iA); g.setAttribute('iB', this.iB); g.setAttribute('iC', this.iC); g.setAttribute('iD', this.iD);
    g.instanceCount = 0;
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      // (both faces: a mark drawn out along its way is wound the other way round)
      vertexShader: VERT, fragmentShader: light ? LIGHT : SOFT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = light ? 8 : 7;
  }

  add(o) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.p.set([o.x, o.y, o.z], i * 3); this.v.set([o.vx ?? 0, o.vy ?? 0, o.vz ?? 0], i * 3);
    this.life[i] = 0; this.max[i] = o.life ?? 1;
    const s = o.size ?? 0.3; this.size.set(Array.isArray(s) ? s : [s, s], i * 2);
    const c = o.colour ?? [1, 1, 1]; this.col.set([c[0], c[1], c[2], o.alpha ?? 1], i * 4);
    this.kind[i] = o.kind ?? 0; this.seed[i] = Math.random();
    this.rot.set([o.rot ?? (Math.random() - 0.5) * 0.6, o.spin ?? 0], i * 2);
    this.drag[i] = o.drag ?? 0; this.grav[i] = o.grav ?? 0; this.wind[i] = o.wind ?? 0;
  }

  update(dt, wx, wz, att) {
    const { p, v, life, max, size, col, kind, seed, rot, drag, grav, wind } = this, A = this.iA.array, B = this.iB.array, C = this.iC.array, D = this.iD.array;
    for (let i = 0; i < this.n;) {
      life[i] += dt;
      if (life[i] >= max[i]) {
        // (the last one takes its place)
        const j = --this.n;
        if (i !== j) {
          p.copyWithin(i * 3, j * 3, j * 3 + 3); v.copyWithin(i * 3, j * 3, j * 3 + 3); size.copyWithin(i * 2, j * 2, j * 2 + 2); col.copyWithin(i * 4, j * 4, j * 4 + 4); rot.copyWithin(i * 2, j * 2, j * 2 + 2);
          life[i] = life[j]; max[i] = max[j]; kind[i] = kind[j]; seed[i] = seed[j]; drag[i] = drag[j]; grav[i] = grav[j]; wind[i] = wind[j];
        }
        continue;
      }
      const k = Math.exp(-drag[i] * dt), a = i * 3;
      if (att && att.vortex) {
        // a whirlwind: within reach of it they are taken round it, out to its wall, and up
        const h = (p[a + 1] - att.y) / att.H;
        if (h > -0.05 && h < 1) {
          const hh = Math.max(0, h), bend = hh ** 1.6, dx = p[a] - att.x - att.lx * bend, dz = p[a + 2] - att.z - att.lz * bend, r = Math.hypot(dx, dz) || 1e-3;
          if (r < att.range) {
            const R = att.r0 + (att.r1 - att.r0) * hh ** 1.8, near = 1 - r / att.range, g = Math.min(1, att.grip * dt * (0.25 + near)), out = Math.max(-8, Math.min(8, (R * 1.05 - r) * 1.6)), vt = att.spin * (0.45 + 0.55 * near);
            v[a] += ((-dz / r) * vt + (dx / r) * out - v[a]) * g; v[a + 1] += (att.lift * (0.35 + near) - v[a + 1]) * g; v[a + 2] += ((dx / r) * vt + (dz / r) * out - v[a + 2]) * g;
          }
        }
      } else if (att) {
        // something draws them to it: they wind in, and are gone when they reach it
        const dx = att.x - p[a], dy = att.y - p[a + 1], dz = att.z - p[a + 2], r = Math.hypot(dx, dy, dz);
        if (r < att.kill) life[i] = max[i];
        else if (r < att.range) {
          const g = (att.pull * dt) / (1 + r * 0.12) / r, slow = Math.exp(-0.9 * dt);
          v[a] = v[a] * slow + (dx + dz * att.swirl) * g; v[a + 1] = v[a + 1] * slow + dy * g; v[a + 2] = v[a + 2] * slow + (dz - dx * att.swirl) * g;
        }
      }
      v[a] = v[a] * k + wx * wind[i] * dt; v[a + 1] = v[a + 1] * k + grav[i] * dt; v[a + 2] = v[a + 2] * k + wz * wind[i] * dt;
      p[a] += v[a] * dt; p[a + 1] += v[a + 1] * dt; p[a + 2] += v[a + 2] * dt;
      rot[i * 2] += rot[i * 2 + 1] * dt;
      const t = life[i] / max[i];
      A[i * 4] = p[a]; A[i * 4 + 1] = p[a + 1]; A[i * 4 + 2] = p[a + 2]; A[i * 4 + 3] = size[i * 2] + (size[i * 2 + 1] - size[i * 2]) * t;
      B[i * 4] = t; B[i * 4 + 1] = seed[i]; B[i * 4 + 2] = kind[i]; B[i * 4 + 3] = rot[i * 2];
      C[i * 4] = col[i * 4]; C[i * 4 + 1] = col[i * 4 + 1]; C[i * 4 + 2] = col[i * 4 + 2]; C[i * 4 + 3] = col[i * 4 + 3];
      D[a] = v[a]; D[a + 1] = v[a + 1]; D[a + 2] = v[a + 2];
      i++;
    }
    this.geometry.instanceCount = this.n;
    for (const at of [this.iA, this.iB, this.iC, this.iD]) { at.clearUpdateRanges?.(); at.addUpdateRange?.(0, this.n * at.itemSize); at.needsUpdate = true; }
  }
}

export function createFx(air) {
  const phone = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 820);
  const U = air.uniforms, light = new Pool(phone ? 2800 : 9000, true), soft = new Pool(phone ? 1600 : 5000, false), group = new THREE.Group();
  for (const pool of [light, soft]) { air.share(pool.mesh.material); pool.mesh.material.uniforms = Object.fromEntries(Object.keys(U).map((k) => [k, U[k]])); }
  group.add(soft.mesh, light.mesh);
  const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
  return {
    group, rnd,
    /** A place every mark is drawn to: { x, y, z, pull, swirl, kill, range }, or null. */
    attract: null,
    get count() { return light.n + soft.n; },
    /** One mark. kind: see the head of this file. */
    spawn(o) { (o.kind === 2 || o.kind === 4 ? soft : light).add(o); },
    update(dt) { const w = U.uWind.value; light.update(dt, w.x * w.z * 6, w.y * w.z * 6, this.attract); soft.update(dt, w.x * w.z * 6, w.y * w.z * 6, this.attract); },
  };
}
