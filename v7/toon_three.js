/* ARO slime toon look.
   Flat cartoon fills like Adventure Time / The Simpsons: one hard-edged
   shadow band, a small hard highlight, crisp dark ink outlines.
   MeshToonMaterial + 2-step (optional tiny highlight) gradientMap, plus
   an inverted-hull outline (BackSide inflated copy).

   import { applyToon, makeToonGradientMap, addInvertedHullOutline } from './toon_three.js';

   In aro-webxr, map 'three' (or keep ./vendor/three.module.min.js) to the
   same three.module the scene already uses. Settings were tuned against
   the Blender EEVEE stills in previews/toon/ (shadow_thr 0.52, ink #301E0C,
   hull thickness 0.012). MeshToonMaterial has no real specular; the last
   gradient texel is only a cheap highlight stand-in.
*/
import * as THREE from './vendor/three.module.min.js';

const INK = 0x301e0c;
// World-unit inflate that reads close to the 2.4px Freestyle line on a ~1.9-unit-tall slime.
const HULL_THICKNESS = 0.012;
// Shadow band strength, shared. Sheet-sampled per-slime linear muls are
// Gold 0.70, Citrine 0.73, Boba 0.82. 0.74 is the middle ground.
const SHADOW_GREY = 189; // 0.74 * 255

/** Stepped nearest gradient: shadow band, lit fill, tiny cream highlight. */
export function makeToonGradientMap(opts = {}) {
  const s = opts.shadow ?? SHADOW_GREY;
  const data = new Uint8Array([
    s, s, s, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 252, 232, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

let _gradient;
export function sharedGradientMap() {
  if (!_gradient) _gradient = makeToonGradientMap();
  return _gradient;
}

export function toonMaterial(opts = {}) {
  const params = Object.assign({
    color: 0xffffff,
    gradientMap: sharedGradientMap(),
  }, opts);
  return new THREE.MeshToonMaterial(params);
}

/**
 * Clone a mesh as a back-face inflated hull in a dark ink material.
 * Thickness is in world units. Skip helpers and tiny face cards by default.
 */
export function addInvertedHullOutline(object, opts = {}) {
  const color = opts.color ?? INK;
  const thickness = opts.thickness ?? HULL_THICKNESS;
  const skip = opts.skipNames ?? /icosphere|^ico|flame|screen|holo|glass|portal|fluff|EyeHi|Blush/i;
  const ink = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    depthWrite: true,
  });
  const made = [];
  object.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if (o.userData && o.userData.toonOutline) return;
    if (skip && skip.test(o.name || '')) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat && mat.transparent) return;
    const geo = o.geometry.clone();
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + nrm.getX(i) * thickness,
        pos.getY(i) + nrm.getY(i) * thickness,
        pos.getZ(i) + nrm.getZ(i) * thickness,
      );
    }
    pos.needsUpdate = true;
    const hull = new THREE.Mesh(geo, ink);
    hull.name = (o.name || 'mesh') + '_outline';
    hull.userData.toonOutline = true;
    hull.renderOrder = (o.renderOrder || 0) - 1;
    o.add(hull);
    made.push(hull);
  });
  return made;
}

function colorFrom(mat) {
  if (!mat) return 0xffffff;
  if (mat.color) return mat.color.getHex();
  return 0xffffff;
}

/**
 * Replace standard / lambert / phong materials on an object with MeshToonMaterial,
 * keeping maps, vertex colors, and emissive, then add inverted-hull outlines.
 */
export function applyToon(root, opts = {}) {
  const gradientMap = opts.gradientMap || sharedGradientMap();
  const thickness = opts.thickness ?? HULL_THICKNESS;
  const outlineColor = opts.outlineColor ?? INK;
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    if (o.userData && o.userData.toonOutline) return;
    if (/icosphere|^ico/i.test(o.name || '')) {
      o.visible = false;
      return;
    }
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map(src => {
      if (!src || src.isMeshToonMaterial) return src;
      const snap = opts.colorSnap && src.name && opts.colorSnap[src.name];
      const dst = new THREE.MeshToonMaterial({
        color: snap != null ? snap : colorFrom(src),
        map: src.map || null,
        gradientMap,
        vertexColors: !!src.vertexColors,
        emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
        emissiveMap: src.emissiveMap || null,
        emissiveIntensity: src.emissiveIntensity ?? 1,
        transparent: !!src.transparent,
        opacity: src.opacity ?? 1,
        side: src.side ?? THREE.FrontSide,
        alphaTest: src.alphaTest ?? 0,
      });
      if (src.name) dst.name = src.name;
      return dst;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
  if (opts.outline !== false) {
    addInvertedHullOutline(root, { color: outlineColor, thickness, skipNames: opts.skipNames });
  }
  return root;
}

export const TOON = {
  INK, HULL_THICKNESS, SHADOW_GREY,
  makeToonGradientMap, sharedGradientMap, toonMaterial,
  addInvertedHullOutline, applyToon,
};
export default TOON;
