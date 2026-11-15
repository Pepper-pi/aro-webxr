// Original holo block look. No imported art. A glassy box, a neon edge, a faint grid, and a dashed rail.
import * as THREE from 'three';

const blockVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vL;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vL = position;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const blockFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFill;
  uniform float uEdge;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vL;
  void main() {
    vec3 view = normalize(cameraPosition - vW);
    float fres = pow(1.0 - abs(dot(normalize(vN), view)), 2.0);
    float gx = smoothstep(0.45, 0.5, abs(fract(vL.x * 7.0) - 0.5));
    float gy = smoothstep(0.45, 0.5, abs(fract(vL.y * 7.0) - 0.5));
    float gz = smoothstep(0.45, 0.5, abs(fract(vL.z * 7.0) - 0.5));
    float grid = max(gx, max(gy, gz));
    float scan = 0.72 + 0.28 * sin(vL.y * 48.0 + uTime * 7.0);
    float flick = 0.86 + 0.14 * sin(uTime * 19.0 + vL.x * 11.0);
    float edge = fres * 0.9 + grid * 0.45;
    float alpha = (uFill + edge * uEdge) * scan * flick;
    vec3 col = uColor * (0.45 + fres * 1.4 + grid * 0.6);
    gl_FragColor = vec4(col, alpha);
  }
`;

const railVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The same language as the fishing line: a soft glow, a pale core, and a few lights traveling the thread.
const railFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float d = abs(vUv.x - 0.5);
    float glow = smoothstep(0.5, 0.05, d);
    float core = smoothstep(0.14, 0.0, d);
    float flow = fract(vUv.y * 3.0 - uTime * 0.45);
    float mote = smoothstep(0.09, 0.0, abs(flow - 0.5)) * smoothstep(0.2, 0.0, d);
    vec3 col = mix(uColor, vec3(1.0, 0.98, 0.93), clamp(core * 0.9 + mote, 0.0, 1.0));
    float alpha = glow * 0.42 + core * 0.95 + mote * 0.8;
    gl_FragColor = vec4(col, alpha);
  }
`;

const BODY = { light: [0.04, 0.42], medium: [0.28, 1], heavy: [0.62, 1.7], ring: [0.18, 1.05] };

export function holoMaterial(hex, weight = 'medium') {
  const pair = BODY[weight] || BODY.medium;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uTime: { value: 0 },
      uFill: { value: pair[0] },
      uEdge: { value: pair[1] },
    },
    vertexShader: blockVert,
    fragmentShader: blockFrag,
  });
}

export function railMaterial(hex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uTime: { value: 0 },
    },
    vertexShader: railVert,
    fragmentShader: railFrag,
  });
}

export function tickHolo(mats, time) {
  for (const mat of mats) if (mat.uniforms?.uTime) mat.uniforms.uTime.value = time;
}

const laneVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const laneFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float x = abs(vUv.x - 0.5);
    float along = vUv.y;
    float fade = smoothstep(0.0, 0.42, along);
    float tip = fract(along * 5.5 - uTime * 0.42);
    float chev = smoothstep(0.14, 0.02, abs(tip - 0.26 - x * 0.72));
    float scan = 0.72 + 0.28 * sin(along * 22.0 - uTime * 1.4);
    vec3 near = vec3(0.62, 0.95, 1.0);
    vec3 far = vec3(0.08, 0.32, 0.62);
    vec3 col = mix(far, near, along);
    col += vec3(0.45, 0.82, 1.0) * chev;
    float alpha = (0.30 + chev * 0.45) * fade * scan * smoothstep(0.5, 0.05, x);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function laneFillMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: laneVert,
    fragmentShader: laneFrag,
  });
}
