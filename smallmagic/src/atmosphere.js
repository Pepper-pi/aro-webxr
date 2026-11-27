// Official Three.js Sky and Water. Both ship with three (MIT). No extra package.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';

const MOOD = {
  day: { turbidity: 3.2, rayleigh: 1.6, mieCoefficient: 0.003, mieDirectionalG: 0.75, elevation: 36, azimuth: 48, sun: '#fff6e8', water: '#1a6e92', distort: 3.4 },
  dusk: { turbidity: 9, rayleigh: 2.8, mieCoefficient: 0.016, mieDirectionalG: 0.86, elevation: 1.6, azimuth: 258, sun: '#ff8a45', water: '#101c38', distort: 2.1 },
  rain: { turbidity: 16, rayleigh: 0.42, mieCoefficient: 0.045, mieDirectionalG: 0.62, elevation: 18, azimuth: 188, sun: '#c5ced4', water: '#243844', distort: 6.5 },
};

let normals;
function waterNormals() {
  if (normals) return normals;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = Math.sin(x * 0.37) * 0.55 + Math.sin((x + y) * 0.18) * 0.35;
      const ny = Math.cos(y * 0.31) * 0.55 + Math.sin(x * 0.22 + y * 0.11) * 0.3;
      const i = (y * size + x) * 4;
      img.data[i] = 128 + nx * 48;
      img.data[i + 1] = 128 + ny * 48;
      img.data[i + 2] = 230;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  normals = new THREE.CanvasTexture(c);
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  normals.repeat.set(3, 3);
  return normals;
}

export function sunFor(mood) {
  const look = MOOD[mood] || MOOD.day;
  const phi = THREE.MathUtils.degToRad(90 - look.elevation);
  const theta = THREE.MathUtils.degToRad(look.azimuth);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

export function makeSky(scale = 2800) {
  const sky = new Sky();
  sky.scale.setScalar(scale);
  sky.frustumCulled = false;
  sky.name = 'official-sky';
  paintSky(sky, 'day');
  return sky;
}

export function paintSky(sky, mood) {
  const look = MOOD[mood] || MOOD.day;
  const u = sky.material.uniforms;
  u.turbidity.value = look.turbidity;
  u.rayleigh.value = look.rayleigh;
  u.mieCoefficient.value = look.mieCoefficient;
  u.mieDirectionalG.value = look.mieDirectionalG;
  const sun = sunFor(mood);
  u.sunPosition.value.copy(sun);
  if (u.cloudCoverage) u.cloudCoverage.value = mood === 'rain' ? 0.82 : mood === 'dusk' ? 0.28 : 0.34;
  if (u.cloudDensity) u.cloudDensity.value = mood === 'rain' ? 0.7 : 0.35;
  return sun;
}

export function makeWater(width, depth, low) {
  const size = low ? 256 : 512;
  const water = new Water(new THREE.PlaneGeometry(width, depth), {
    textureWidth: size,
    textureHeight: size,
    waterNormals: waterNormals(),
    sunDirection: sunFor('day'),
    sunColor: '#fff4dc',
    waterColor: '#1a6e92',
    distortionScale: 3.4,
    fog: false,
    alpha: 1,
  });
  water.rotation.x = -Math.PI / 2;
  water.frustumCulled = false;
  water.userData.skipTint = true;
  water.name = 'official-water';
  return water;
}

export function paintWater(water, mood) {
  if (!water?.material?.uniforms?.waterColor) return;
  const look = MOOD[mood] || MOOD.day;
  const u = water.material.uniforms;
  u.waterColor.value.set(look.water);
  u.sunColor.value.set(look.sun);
  u.sunDirection.value.copy(sunFor(mood));
  u.distortionScale.value = look.distort;
}

export function flowWater(water, dt) {
  const u = water?.material?.uniforms;
  if (u?.time) u.time.value += dt;
}
