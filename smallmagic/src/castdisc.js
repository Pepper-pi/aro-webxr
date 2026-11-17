// The Mage casting disc from the v7 build (Nov 6–7 mesh, Nov 13 spin-to-select).
// The outer gold rim stays put. The inner ring turns so the chosen spell sits at the top.
// A drag on the inner ring changes the spell. A press in the hole uses the existing hold-to-cast.
import * as THREE from 'three';

const TAU = Math.PI * 2;

export function createCastDisc(staffScene) {
  const root = new THREE.Group();
  root.name = 'cast-disc';
  root.visible = false;
  root.position.set(0, -0.22, -1.05);
  root.rotation.x = -0.72;
  staffScene.add(root);
  const inner = new THREE.Group();
  root.add(inner);
  let ready = false;
  let shown = 0;
  const loaderP = import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
    const gltf = await new GLTFLoader().loadAsync(new URL('casting-disc-v3.glb', document.baseURI).href);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const k = 0.2 / Math.max(size.x, size.y, size.z, 0.01);
    gltf.scene.scale.setScalar(k);
    gltf.scene.position.y -= box.getCenter(new THREE.Vector3()).y * k;
    gltf.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const color = src.color ? src.color.clone() : new THREE.Color('#f1d9a4');
      const emit = src.emissive ? src.emissive.clone() : new THREE.Color(0);
      color.multiplyScalar(1.15).add(emit.multiplyScalar(1.15));
      o.material = new THREE.MeshBasicMaterial({
        color, transparent: !!src.transparent, opacity: src.opacity == null ? 1 : src.opacity, side: THREE.DoubleSide,
      });
      o.frustumCulled = false;
    });
    for (const child of [...gltf.scene.children]) {
      const n = child.name || '';
      if (/^rim_outer|^hub_|^preview_glass/.test(n)) root.add(child);
      else inner.add(child);
    }
    ready = true;
  }).catch(() => { ready = false; });
  void loaderP;
  return {
    root,
    get ready() { return ready; },
    /** Mage only. `index` is the spell in hand. The inner ring eases toward that slice. */
    update(dt, show, index) {
      root.visible = !!(show && ready);
      if (!root.visible) return;
      const want = -index * (TAU / 7);
      shown += (want - shown) * Math.min(1, dt * 8);
      inner.rotation.y = shown;
    },
  };
}
