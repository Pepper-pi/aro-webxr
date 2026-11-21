// What pours from the staff while a spell is held: one stream from the crystal to the place, widening as it goes,
// with brighter streams running along inside it, away from the staff. It is a ribbon that always faces the eye,
// so it is seen whole from wherever it is looked at, even from behind the staff and nearly along it. It can arc.
import * as THREE from 'three';
import { AIR } from './air.js';

export function createBeam(air) {
  const U = air.uniforms, SEG = 32, pos = [], index = [];
  for (let i = 0; i <= SEG; i++) pos.push(i / SEG, -1, 0, i / SEG, 1, 0);
  for (let i = 0; i < SEG; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  const own = { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3(0, 0, -1) }, uLift: { value: 0 }, uWide: { value: new THREE.Vector2(0.03, 0.5) }, uCol: { value: new THREE.Vector3(1, 1, 1) }, uCol2: { value: new THREE.Vector3(1, 1, 1) }, uPower: { value: 0 }, uLen: { value: 1 } };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { ...Object.fromEntries(Object.keys(U).map((k) => [k, U[k]])), ...own },
    vertexShader: AIR + /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; uniform float uLift; uniform vec2 uWide; uniform float uLen;
      varying vec2 vUv;
      vec3 at(float t) { return mix(uA, uB, t) + vec3(0.0, uLift * 4.0 * t * (1.0 - t), 0.0); }
      void main() {
        float t = position.x;
        vec3 p = at(t), along = normalize(at(t + 0.01) - at(t - 0.01)), across = normalize(cross(along, cameraPosition - p) + vec3(0.0, 1e-5, 0.0));
        // (it wavers a little as it goes, more the farther from the staff)
        p += across * (position.y * mix(uWide.x, uWide.y, pow(t, 0.8)) + sin(t * uLen * 1.3 - uNow * 9.0) * 0.04 * t * uLen * 0.2);
        vUv = vec2(position.y, t);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: AIR + /* glsl */ `
      uniform vec3 uCol; uniform vec3 uCol2; uniform float uPower; uniform float uLen;
      varying vec2 vUv;
      void main() {
        float u = vUv.x, v = vUv.y * uLen;
        // streams within it, running away from the staff, that wind about one another
        float wind = (aNoise(vec2(v * 0.45 - uNow * 2.2, 3.0)) - 0.5) * 2.4;
        float s1 = aNoise(vec2(u * 3.2 + wind, v * 0.6 - uNow * 8.0)), s2 = aNoise(vec2(u * 7.5 - wind, v * 1.5 - uNow * 13.0));
        float core = pow(max(1.0 - u * u, 0.0), 1.5);
        float body = core * (0.22 + 1.2 * s1 * s1 + 0.6 * s2 * s2 * core);
        float ends = smoothstep(0.0, 0.04, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
        gl_FragColor = vec4(mix(uCol, uCol2, smoothstep(0.3, 0.75, s1)) * body * ends * uPower, 0.0);
      }`,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 9; mesh.visible = false;
  let warm = 0;
  return {
    mesh,
    /** Draws it faintly for a few frames, so that the card has built it before a spell needs it. */
    warm(a, b) { warm = 3; own.uA.value.copy(a); own.uB.value.copy(b); own.uLen.value = a.distanceTo(b); },
    /** From a to b, lifted so much in the middle; how wide at each end; its two colours; and how strongly (0 none). */
    set(a, b, lift, wide0, wide1, col, col2, power) {
      if (warm > 0) { warm--; own.uPower.value = 0.01; mesh.visible = true; return; }
      mesh.visible = power > 0.005;
      if (!mesh.visible) return;
      own.uA.value.copy(a); own.uB.value.copy(b); own.uLift.value = lift; own.uWide.value.set(wide0, wide1);
      own.uCol.value.set(col[0], col[1], col[2]); own.uCol2.value.set(col2[0], col2[1], col2[2]);
      own.uPower.value = power; own.uLen.value = a.distanceTo(b);
    },
  };
}
