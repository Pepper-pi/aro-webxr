// Fire, as one body.
//
// Where the ground burns (and in a burning tree) there stand cards, and the fire is drawn on them: not a flame to a
// card, but one fire that runs on through every card beside it, because it is worked out from where each point is in
// the world and not from where it is on its card, or across the view. So a tongue of flame has a place: it stays
// there when the eye turns, and is walked round. The cards turn to face where the eye stands (not the way it looks:
// looking about changes nothing). It stands in tongues of differing height that
// wander and lick, is eaten ragged by the air, throws off scraps above itself, and is white-hot low down: brighter
// than a screen can show, so the page lets it glow into what is round it.
import * as THREE from 'three';
import { AIR, GROUND } from './air.js';

// The colour of fire by how hot: deep red where it dies, orange, yellow, near white at its heart.
export const FIRE = /* glsl */ `
vec3 fireCol(float hot) {
  vec3 c = mix(vec3(0.6, 0.03, 0.0), vec3(1.0, 0.24, 0.02), smoothstep(0.0, 0.32, hot));
  c = mix(c, vec3(1.0, 0.6, 0.1), smoothstep(0.28, 0.62, hot));
  c = mix(c, vec3(1.0, 0.92, 0.6), smoothstep(0.62, 0.98, hot));
  // (its heart is brighter than a screen can show: the page lets that glow)
  return c * (1.0 + 1.6 * hot * hot);
}
`;

export function createFlames(air, cap = 2800) {
  const U = air.uniforms, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), iS = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  iP.setUsage(THREE.DynamicDrawUsage); iS.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iP', iP); g.setAttribute('iS', iS);
  g.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: Object.fromEntries(Object.keys(U).map((k) => [k, U[k]])),
    vertexShader: AIR + /* glsl */ `
      attribute vec4 iP; attribute vec4 iS;
      varying vec2 vUv; varying vec3 vW; varying vec3 vQ; flat varying vec4 vI; flat varying vec2 vF;
      void main() {
        // (each card faces where the eye stands)
        vec2 f = normalize(cameraPosition.xz - iP.xz + vec2(1e-4, 0.0)), r = vec2(-f.y, f.x);
        vec3 w = iP.xyz + vec3(r.x, 0.0, r.y) * position.x * iS.x + vec3(0.0, position.y * iS.y, 0.0);
        vQ = w;
        // it leans with the wind, most at its top, and a gust lays it over
        float gust = uGust.w * (1.0 - smoothstep(uGust.z * 0.25, uGust.z, distance(iP.xz, uGust.xy)));
        w.xz += (uWind.xy * uWind.z * 0.3 + uGustDir * gust * 0.55) * position.y * position.y * iS.y;
        // a whirlwind drags it round and in
        if (uTwist.w > 0.0) { vec2 tv = iP.xz - uTwist.xy; float tl = length(tv); w.xz += (vec2(-tv.y, tv.x) * 0.7 - tv * 0.7) / max(tl, 0.1) * uTwist.w * position.y * position.y * iS.y * 0.7 * (1.0 - smoothstep(3.0, uTwist.z * 1.4, tl)); }
        // a singularity draws it up and over toward itself
        if (uHole.w > 0.0) { vec3 th = uHole.xyz - iP.xyz; float tl = length(th); w += (th / max(tl, 0.1)) * uHole.w * position.y * position.y * iS.y * 1.1 * (1.0 - smoothstep(8.0, 34.0, tl)); }
        vUv = position.xy; vW = w; vI = vec4(iP.w, iS.z, 0.0, iS.w); vF = vec2(iP.y, iS.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: AIR + GROUND + FIRE + /* glsl */ `
      varying vec2 vUv; varying vec3 vW; varying vec3 vQ; flat varying vec4 vI; flat varying vec2 vF;
      void main() {
        float y = vUv.y, heat = vI.x;
        // On the ground, how strongly it burns is read from the ground itself at each point, not taken from the card:
        // so a fire is low at its edge and where it has only just caught, and climbs from there, with no steps in it.
        if (vI.w > 0.5) heat = stateAt(vQ.xz).b;
        float rise = pow(clamp(heat, 0.0, 1.0), 0.6);
        // Everything below is a matter of where the point is in the world (as it stood before the wind leaned it).
        // tongues: each sways more the higher it goes
        vec2 p = vQ.xz + (vec2(aNoise(vec2(vQ.x * 0.7 + vQ.z * 0.5, vQ.y * 0.8 - uNow * 1.6)), aNoise(vec2(vQ.z * 0.7 - vQ.x * 0.5 + 9.0, vQ.y * 0.8 - uNow * 1.6))) - 0.5) * 0.8 * y;
        // the fire stands higher here and lower there, and that wanders (mostly low, and here and there one that stands tall)
        float tn = aNoise3(vec3(p * 2.2, uNow * 0.9)) * 0.6 + aNoise3(vec3(p * 5.5 + 7.0, uNow * 1.8)) * 0.4;
        float top = min(0.14 + 1.5 * tn * tn, 1.0);
        // the air eats at it, upward and fast
        float lick = aNoise3(vec3(p.x * 2.6, vQ.y * 2.3 - uNow * 3.6, p.y * 2.6)) * 0.6 + aNoise3(vec3(p.x * 6.5, vQ.y * 5.2 - uNow * 6.0, p.y * 6.5)) * 0.4;
        float d = (top * rise - y) + (lick - 0.5) * 0.6 * (0.35 + y) * min(1.0, rise * 1.6 + 0.08);
        float side = 1.0 - smoothstep(0.5, 1.0, abs(vUv.x));
        d = d * side - (1.0 - side) * 0.35;
        float a = smoothstep(0.0, 0.05, d);
        // scraps of flame come away above it
        float scrap = smoothstep(0.74, 0.82, lick) * step(0.0, -d) * (1.0 - smoothstep(0.0, 0.3, -d)) * side;
        // hot at its heart and low down, redder at its edge and its top, and streaked upward as fire is
        float streak = aNoise3(vec3(p.x * 8.0, vQ.y * 1.4 - uNow * 4.5, p.y * 8.0));
        float hot = clamp(smoothstep(0.0, 0.5, d) * (1.0 - 0.5 * y) + (streak - 0.5) * 0.3, 0.0, 1.0) * a + scrap * 0.3;
        // (its foot is lost in what it burns: it has no bottom edge)
        // (and it fades in over the first hand's breadth above the ground, however tall or short it stands)
        a = max(a, scrap * rise) * smoothstep(0.0, 0.3, (vW.y - vF.x) + (lick - 0.5) * 0.12) * smoothstep(0.0, 0.1, heat);
        if (a < 0.004) discard;
        gl_FragColor = vec4(fireCol(hot) * a, a * 0.85);
      }`,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false; mesh.renderOrder = 6;
  const P = new Float32Array(cap * 4), S = new Float32Array(cap * 4), key = new Float32Array(cap), order = new Uint16Array(cap);
  let n = 0;
  const api = {
    mesh, extra: null,
    get count() { return n; },
    begin() { n = 0; },
    /** A card of fire: its foot, how strongly it burns (0 to 1), half its width, its height, and a number of its own. */
    add(x, y, z, heat, half, tall, seed, onGround = 0) {
      if (n >= cap) return;
      P.set([x, y, z, heat], n * 4); S.set([half, tall, seed, onGround], n * 4); n++;
    },
    /** Hands what was added to the card, the farthest first. */
    end(eye) {
      if (api.extra) { api.add(api.extra[0], api.extra[1], api.extra[2], 0.3, 0.3, 0.3, 0.5); api.extra = null; }
      for (let i = 0; i < n; i++) { key[i] = (P[i * 4] - eye.x) ** 2 + (P[i * 4 + 2] - eye.z) ** 2; order[i] = i; }
      const sorted = order.subarray(0, n).sort((a, b) => key[b] - key[a]);
      for (let k = 0; k < n; k++) { const i = sorted[k] * 4; iP.array.set(P.subarray(i, i + 4), k * 4); iS.array.set(S.subarray(i, i + 4), k * 4); }
      for (const at of [iP, iS]) { at.clearUpdateRanges?.(); at.addUpdateRange?.(0, n * 4); at.needsUpdate = true; }
      g.instanceCount = n;
    },
  };
  return api;
}
