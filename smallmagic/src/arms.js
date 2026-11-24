// First-person arms from the same hires AvatarSample A/B/C the map body uses.
// Those files are not CC0. @pixiv/three-vrm is MIT.
import * as THREE from 'three';

const E = new THREE.Euler();
const Q = new THREE.Quaternion();

export function createArms(scene) {
  const rig = new THREE.Group();
  rig.name = 'fp-arms';
  rig.visible = false;
  scene.add(rig);
  const hemi = new THREE.HemisphereLight('#fff6ea', '#6d8f58', 1.15);
  const sun = new THREE.DirectionalLight('#fff1d4', 1.35);
  sun.position.set(0.35, 1.1, 0.45);
  rig.add(hemi, sun);
  let vrm = null;
  let pending = null;
  let key = '';
  let aligned = false;
  let letter = 'B';
  let tier = 'Phone';
  const headAt = new THREE.Vector3();

  function load(next = {}) {
    if (next.letter === 'A' || next.letter === 'B' || next.letter === 'C') letter = next.letter;
    if (next.tier === 'High' || next.tier === 'Phone') tier = next.tier;
    const want = `${letter}-${tier}`;
    if (pending && key === want) return pending;
    const mine = want;
    key = want;
    aligned = false;
    pending = (async () => {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(`./figure/hires/AvatarSample_${letter}_${tier}.vrm`);
      if (key !== mine) return;
      if (vrm) rig.remove(vrm.scene);
      vrm = gltf.userData.vrm;
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((o) => {
        o.frustumCulled = false;
        if (/face|hair/i.test(o.name)) o.visible = false;
      });
      vrm.firstPerson?.setup?.();
      rig.add(vrm.scene);
    })().catch((err) => {
      console.warn('arms unavailable', err);
      if (key === mine) vrm = null;
    });
    return pending;
  }

  function bend(name, x, y, z) {
    const bone = vrm.humanoid.getNormalizedBoneNode(name);
    if (!bone) return;
    E.set(x, y, z);
    Q.setFromEuler(E);
    bone.quaternion.copy(Q);
  }

  let shown = 0;
  function update(dt, camera, state) {
    if (!vrm) return;
    const want = state.rise == null ? (state.ready ? 1 : 0) : (state.rise ? 1 : 0);
    shown += (want - shown) * Math.min(1, dt * 7);
    rig.position.copy(camera.position);
    rig.position.y -= (1 - shown) * 0.72;
    rig.quaternion.copy(camera.quaternion);
    const lift = shown;
    const run = state.speed > 5;
    const moving = state.speed > 0.4;
    const swing = Math.sin(state.stride * (run ? 7.2 : 3.5)) * (moving ? (run ? 0.16 : 0.08) : 0);
    // Raised hands tip in from the lower corners. Lowered hands sit below the frame.
    const yaw = 1.34 + lift * 0.03;
    const drop = -0.02 + swing + (1 - lift) * 1.25;
    bend('leftUpperArm', (1 - lift) * 0.9, yaw, drop);
    bend('rightUpperArm', (1 - lift) * 0.9, -yaw, -drop);
    bend('leftLowerArm', 0, 0.28, 0.1);
    bend('rightLowerArm', 0, -0.28, -0.1);
    vrm.update(dt);
    if (!aligned) {
      vrm.scene.rotation.y = Math.PI;
      vrm.scene.scale.setScalar(0.82);
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) {
        vrm.scene.updateWorldMatrix(true, true);
        head.getWorldPosition(headAt);
        rig.worldToLocal(headAt);
        vrm.scene.position.sub(headAt);
        vrm.scene.position.y -= 0.06;
        aligned = true;
      }
    }
  }

  return {
    rig,
    load,
    update,
    get loaded() { return !!vrm; },
  };
}
