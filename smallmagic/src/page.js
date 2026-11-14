// How the painted world is finally seen.
//   1. shafts of sun: where the sun is in front of the eye and things stand between, light streams past them;
//   2. bright things glow a little into what is round them;
//   3. it is brought into the range a screen can show, kept rich in colour, and the corners are let fall away.
// The staff is drawn last, by itself, over everything.
import * as THREE from 'three';

const QUAD = /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPage(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const scene = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  scene.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  const print = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: { tDrawn: { value: scene.texture }, tDepth: { value: scene.depthTexture }, uSize: { value: size.clone() }, uSunUv: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color('#fff0d2') }, uHeat: { value: 0 }, uDoom: { value: 0 }, uInk: { value: 0 }, uWhite: { value: 0 }, uBlaze: { value: 0 }, uShock: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uHole: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uHoleB: { value: new THREE.Vector4(0, 0, 0, 0) }, uHoleC: { value: new THREE.Vector4(0.1, 1000, 1, 1) }, uDoomCol: { value: new THREE.Vector3(0.5, 0.06, 0.05) }, uDoomKeep: { value: 0.05 } },
    vertexShader: QUAD,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tDrawn; uniform sampler2D tDepth; uniform vec2 uSize; uniform vec3 uSunUv; uniform vec3 uSunCol; uniform float uHeat; uniform float uDoom; uniform float uInk; uniform float uWhite; uniform float uBlaze; uniform vec4 uShock; uniform vec4 uHole; uniform vec4 uHoleB; uniform vec4 uHoleC; uniform vec3 uDoomCol; uniform float uDoomKeep;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        // a blast's ring in the air bends what is seen through it, and splits its colours a little
        vec2 at = vUv, asp0 = vec2(uSize.x / uSize.y, 1.0), sd = (vUv - uShock.xy) * asp0; float sl = length(sd), bend = 0.0;
        if (uShock.w > 0.0) { float so = (sl - uShock.z) / (0.02 + uShock.z * 0.08); bend = exp(-so * so) * uShock.w; at -= (sd / max(sl, 1e-4)) / asp0 * bend * 0.035; }
        // A singularity. It has no light of its own: it is seen by what it does to the light from behind it, which is
        // bent round it (what is seen at an angle from it comes from nearer it, and close in, from its other side).
        // What stands nearer the eye than it does is left alone.
        vec2 hd = (vUv - uHole.xy) * asp0; float hl = length(hd), hdep = textureLod(tDepth, vUv, 0.0).r, hback = uHole.w > 0.0 ? step(uHoleB.y, hdep) : 0.0, hworld = uHole.w > 0.0 ? step(0.011, hdep) : 0.0;
        // (what is nearer the eye than it is left alone, its own disc where that crosses in front of it too; and from there back the bending comes on by degrees, so that there is no seam)
        if (hworld > 0.5 && hl > uHoleB.x) {
          float fall = 1.0 - smoothstep(uHole.z * 1.5, uHole.z * 6.0, hl);
          float hz = uHoleC.x * uHoleC.y / (uHoleC.y - hdep * (uHoleC.y - uHoleC.x)), hw = smoothstep(uHoleC.w - 2.4 * uHoleC.z, uHoleC.w + 0.3 * uHoleC.z, hz);
          at = clamp(uHole.xy + hd * (1.0 - (uHole.z * uHole.z) / (hl * hl) * fall * uHole.w * hw) / asp0, vec2(0.001), vec2(0.999));
        }
        vec3 c = textureLod(tDrawn, at, 0.0).rgb;
        // (and all that is seen is drawn out toward it)
        if (uHoleB.z > 0.0 && hworld > 0.5) { vec2 to = (uHole.xy - at) * uHoleB.z; vec3 acc = c; float got = 1.0, hj = hash(gl_FragCoord.xy + 3.0); for (int i = 0; i < 10; i++) { vec2 q = at + to * (float(i) + hj) * 0.1; float back = step(0.011, textureLod(tDepth, q, 0.0).r); acc += textureLod(tDrawn, q, 0.0).rgb * back; got += back; } c = acc / got; }
        if (bend > 0.01) c.r = textureLod(tDrawn, at - (sd / max(sl, 1e-4)) / asp0 * bend * 0.012, 0.0).r;
        // --- shafts of sun ---
        if (uSunUv.z > 0.0) {
          vec2 asp = vec2(uSize.x / uSize.y, 1.0), to = uSunUv.xy - vUv;
          float acc = 0.0, j = hash(gl_FragCoord.xy);
          for (int i = 0; i < 24; i++) {
            vec2 uv = vUv + to * ((float(i) + j) / 24.0);
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
            // (open sky, near the sun: light comes from there)
            acc += step(0.9999999, textureLod(tDepth, uv, 0.0).r) * exp(-length((uv - uSunUv.xy) * asp) * 3.2);
          }
          c += uSunCol * (acc / 24.0) * uSunUv.z * 0.5;
        }
        // --- glow ---
        vec3 glow = vec3(0.0);
        for (int i = 2; i <= 6; i++) glow += max(textureLod(tDrawn, vUv, float(i)).rgb - 0.95, 0.0) * (i < 4 ? 0.14 : 0.22);
        c += glow * (0.55 + 0.3 * uHeat);
        // the hole itself: nothing; with the last light that gets round it as a thin bright ring at its edge
        if (hback > 0.5) {
          float hpx = 1.5 / uSize.y, ho = (hl - uHoleB.x * 1.07) / (uHoleB.x * 0.04 + hpx);
          c *= smoothstep(uHoleB.x - hpx, uHoleB.x + hpx, hl);
          c += (vec3(3.4, 2.9, 2.4) * exp(-ho * ho) + vec3(0.45, 0.25, 1.0) * exp(-max(hl - uHoleB.x, 0.0) / (uHoleB.x * 0.7)) * 0.3 * step(uHoleB.x, hl)) * uHole.w;
        }
        // by a fire everything is seen a little through its light
        // (the eye closes down for it: all else is darker and redder, and the fire itself still white)
        c *= mix(vec3(1.0), vec3(0.76, 0.6, 0.52), uHeat);
        // a great spell being gathered: the day goes dark and red, and only what burns keeps its light
        float dl = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, dl * uDoomCol + c * uDoomKeep, uDoom * (1.0 - smoothstep(1.5, 3.0, dl)));
        // a blast's light is on everything: shade goes red-brown and the whole of what is seen is lifted toward its orange
        c = mix(c, c * vec3(0.55, 0.25, 0.16), min(1.0, uBlaze * 1.2) * (1.0 - smoothstep(1.2, 2.6, dl))) + vec3(1.0, 0.33, 0.08) * min(uBlaze, 1.2) * 0.6;
        // --- seen ---
        c *= 1.02;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= (1.0 + l / 9.0) / (1.0 + l * 0.62);
        l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.16);
        c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
        // a little more depth in the darks, and the corners eased
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
        // the instant it lands: ink. Black and white and nothing between, with rays from the place, then the same turned about.
        if (uInk != 0.0) {
          float k = smoothstep(0.3, 0.36, dot(c, vec3(0.299, 0.587, 0.114))), cell = floor(atan(sd.y, sd.x) * 44.0);
          float ray = step(0.74, hash(vec2(cell, 3.0))) * smoothstep(0.3, 0.42, sl - 0.3 * hash(vec2(cell, 9.0)));
          // (and the burst itself: a hard disc of light at the place)
          k = max(k, 1.0 - smoothstep(0.0, 0.006, sl - (uInk > 0.0 ? 0.07 : 0.13)));
          k = mix(k, 1.0 - k, ray);
          c = uInk > 0.0 ? vec3(k) : vec3(1.0 - k);
        } else c = mix(c, vec3(1.0, 0.97, 0.9), uWhite);
        c *= 1.0 - (0.3 + 0.25 * uDoom) * pow(length(vUv - 0.5) * 1.25, 3.0);
        outC = vec4(c, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), print);
  quad.frustumCulled = false;
  const stage = new THREE.Scene();
  stage.add(quad);
  const flat = new THREE.Camera(), v = new THREE.Vector3(), fwd = new THREE.Vector3();
  return {
    depth: scene.depthTexture,
    /** How much fire is in the eye, 0 to 1. */
    set heat(v) { print.uniforms.uHeat.value = v; },
    /** A great spell: how dark and red the day is, the ink of the instant it lands (1, -1 or 0), and how white-blind. */
    set doom(v) { print.uniforms.uDoom.value = v; },
    /** The colour the day goes dark to. */
    doomTint(r, g, b, keep = 0.05) { print.uniforms.uDoomCol.value.set(r, g, b); print.uniforms.uDoomKeep.value = keep; },
    /** A singularity as the eye sees it: at a place in the world, of so great a radius (m), so strongly there (0 none), and how hard the view is drawn to it. */
    hole(camera, place, radius, power, pull, front = 0) {
      const u = print.uniforms.uHole.value, b = print.uniforms.uHoleB.value;
      v.copy(place).project(camera);
      if (power <= 0 || v.z > 1 || v.z < -1) { u.w = 0; b.z = 0; return; }
      const k = 1 / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(camera.position.distanceTo(place), 1));
      u.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, radius * 1.6 * k, power); b.set(radius * k, v.z * 0.5 + 0.5, pull, 0);
      print.uniforms.uHoleC.value.set(camera.near, camera.far, radius, -v.copy(place).applyMatrix4(camera.matrixWorldInverse).z);
    },
    set ink(v) { print.uniforms.uInk.value = v; },
    set white(v) { print.uniforms.uWhite.value = v; },
    set blaze(v) { print.uniforms.uBlaze.value = v; },
    /** The ring a blast sends out, as the eye sees it: round a place in the world, so far out, so strong. */
    shock(camera, place, radius, power) {
      const u = print.uniforms.uShock.value, d = camera.position.distanceTo(place);
      v.copy(place).project(camera);
      if (v.z > 1 || v.z < -1) { u.w = 0; return; }
      u.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, radius / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(d, 1)), power);
    },
    resize() {
      renderer.getDrawingBufferSize(size);
      scene.setSize(size.x, size.y);
      print.uniforms.uSize.value.copy(size);
    },
    /** world, camera: what is seen. hand: { scene, camera }, drawn over it. sun: the way to the sun. */
    render(world, camera, hand, sun) {
      // where the sun is on the page, and how squarely the eye faces it
      camera.getWorldDirection(fwd);
      const facing = fwd.dot(sun);
      v.copy(camera.position).addScaledVector(sun, 1000).project(camera);
      print.uniforms.uSunUv.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, facing > 0 ? Math.min(1, facing * 1.6) : 0);
      renderer.setRenderTarget(scene);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(world, camera);
      if (hand) renderer.render(hand.scene, hand.camera);
      renderer.setRenderTarget(null);
      renderer.render(stage, flat);
    },
  };
}
