import { BufferGeometry, Float32BufferAttribute } from './vendor/three.module.min.js';

/* Only used if a glTF primitive is a strip or a fan. Cabin props are triangles. */
export function toTrianglesDrawMode(geometry, drawMode) {
  const index = geometry.getIndex();
  if (!index) return geometry;
  const src = index.array;
  const out = [];
  if (drawMode === 1) {
    for (let i = 0; i + 2 < src.length; i++) out.push(src[i], src[i + 1], src[i + 2]);
  } else {
    for (let i = 1; i + 1 < src.length; i++) out.push(src[0], src[i], src[i + 1]);
  }
  const geo = geometry.clone();
  geo.setIndex(out);
  return geo;
}
