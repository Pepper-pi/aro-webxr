// The v3 casting disc, as a coin in the world in front of the Mage.
// Outer gold stays put. The inner ring turns with the spell in hand.
// A drag on the ring changes the spell. Holding the hole pushes the forearm through it.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const DIAM = 0.32;

export function createCastDisc(scene) {
  const root = new THREE.Group();
  root.name = 'cast-disc';
  root.visible = false;
  scene.add(root);
  const inner = new THREE.Group();
  root.add(inner);
  const skin = new THREE.MeshBasicMaterial({ color: '#f0c2a0' });
  const arm = new THREE.Group();
  arm.name = 'cast-arm';
  arm.visible = false;
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.46, 8), skin);
  fore.rotation.x = Math.PI / 2;
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
  fist.position.z = -0.26;
  arm.add(fore, fist);
  scene.add(arm);
  let ready = false;
  let shown = 0;
  const screen = { x: 0, y: 0, r: 48, on: false };
  import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
    const gltf = await new GLTFLoader().loadAsync(new URL('casting-disc-v3.glb', document.baseURI).href);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const k = DIAM / Math.max(size.x, size.y, size.z, 0.01);
    const holder = new THREE.Group();
    holder.scale.setScalar(k);
    const mid = box.getCenter(new THREE.Vector3());
    holder.position.set(-mid.x * k, -mid.y * k, -mid.z * k);
    root.add(holder);
    holder.add(inner);
    gltf.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const color = src.color ? src.color.clone() : new THREE.Color('#e6c27a');
      const emit = src.emissive ? src.emissive.clone() : new THREE.Color(0);
      color.multiplyScalar(1.25).add(emit.multiplyScalar(1.8));
      o.material = new THREE.MeshBasicMaterial({
        color, transparent: !!src.transparent, opacity: src.opacity == null ? 1 : src.opacity, side: THREE.DoubleSide,
      });
      o.frustumCulled = false;
    });
    for (const child of [...gltf.scene.children]) {
      const n = child.name || '';
      if (/^rim_outer|^hub_|^preview_glass/.test(n)) holder.add(child);
      else inner.add(child);
    }
    ready = true;
  }).catch(() => { ready = false; });
  const ndc = new THREE.Vector3();
  return {
    root, screen,
    get ready() { return ready; },
    /**
     * Place the coin at chest height, a short step in front of the caster.
     * `charge` 0–1 pushes the forearm through the hole, first person only.
     */
    update(dt, show, index, walker, camera, charge, firstPerson) {
      root.visible = !!(show && ready);
      arm.visible = !!(root.visible && firstPerson && charge > 0.02);
      screen.on = root.visible;
      if (!root.visible || !walker) return;
      const yaw = walker.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const y = walker.feet.y + 1.12;
      root.position.set(walker.feet.x + fx * 1.05, y, walker.feet.z + fz * 1.05);
      root.lookAt(walker.feet.x, y, walker.feet.z);
      const want = -index * (TAU / 7);
      shown += (want - shown) * Math.min(1, dt * 8);
      inner.rotation.y = shown;
      if (camera) {
        ndc.copy(root.position).project(camera);
        screen.x = (ndc.x * 0.5 + 0.5) * innerWidth;
        screen.y = (-ndc.y * 0.5 + 0.5) * innerHeight;
        const dist = Math.max(0.35, camera.position.distanceTo(root.position));
        const fov = (camera.fov * Math.PI) / 180;
        screen.r = ((DIAM * 0.5) / dist) / Math.tan(fov / 2) * (innerHeight * 0.5);
        screen.on = ndc.z < 1;
      }
      if (arm.visible) {
        const past = root.position.clone().add(new THREE.Vector3(fx, 0, fz).multiplyScalar(-0.22 + charge * 0.55));
        const from = camera.position.clone();
        from.y -= 0.28;
        arm.position.lerpVectors(from, past, 0.25 + charge * 0.7);
        arm.lookAt(root.position.x + fx * 0.4, root.position.y, root.position.z + fz * 0.4);
      }
    },
  };
}
