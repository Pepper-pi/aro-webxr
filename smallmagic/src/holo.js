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
    float alpha = (0.08 + edge) * scan * flick;
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

const railFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uRepeat;
  varying vec2 vUv;
  void main() {
    float along = fract(vUv.y * uRepeat - uTime * 1.6);
    float dash = smoothstep(0.42, 0.55, along) * smoothstep(0.98, 0.8, along);
    float side = smoothstep(0.5, 0.12, abs(vUv.x - 0.5));
    float alpha = (0.12 + 0.8 * dash) * side;
    gl_FragColor = vec4(uColor * (0.7 + dash), alpha);
  }
`;

export function holoMaterial(hex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(hex) }, uTime: { value: 0 } },
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
      uRepeat: { value: 8 },
    },
    vertexShader: railVert,
    fragmentShader: railFrag,
  });
}

export function tickHolo(mats, time) {
  for (const mat of mats) if (mat.uniforms?.uTime) mat.uniforms.uTime.value = time;
}
