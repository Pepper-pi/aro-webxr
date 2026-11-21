// Maren Reed, derived from VRoid AvatarSample_A. The file is not CC0.
// Hair, cloth, and the sprig are runtime changes. The other companions stay as they are.
import * as THREE from 'three';

const HAIR = /hair/i;
const TOP = /tops/i;
const BOTTOM = /bottoms/i;
const SHOE = /shoes/i;

const _euler = new THREE.Euler();

function dye(material, lit, shade) {
  if (!material) return;
  if (material.color?.set) material.color.set(lit);
  if (material.shadeColorFactor?.set) material.shadeColorFactor.set(shade);
}

function shrink(tex, max) {
  const img = tex?.image;
  if (!img || !img.width || Math.max(img.width, img.height) <= max) return;
  const scale = max / Math.max(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  tex.image = canvas;
  tex.needsUpdate = true;
}

function sprig() {
  const g = new THREE.Group();
  g.name = 'herb-sprig';
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.006, 0.08, 5),
    new THREE.MeshBasicMaterial({ color: '#3d6a34' }),
  );
  stem.position.y = 0.04;
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 6, 4),
    new THREE.MeshBasicMaterial({ color: '#6d9a52' }),
  );
  leaf.scale.set(1.1, 0.4, 1.7);
  leaf.position.set(0.012, 0.075, 0);
  const bud = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 6, 4),
    new THREE.MeshBasicMaterial({ color: '#e2c56a' }),
  );
  bud.position.set(-0.012, 0.086, 0.004);
  g.add(stem, leaf, bud);
  return g;
}

// Later NPC builds can vary the body. Maren stays at the sample's own shape.
export function shapeBody(vrm, shape = {}) {
  const hips = shape.hips ?? 1;
  const thighs = shape.thighs ?? 1;
  const waist = shape.waist ?? 1;
  const height = shape.height ?? 1;
  const bone = (name) => vrm.humanoid?.getRawBoneNode(name);
  const apply = (name, x, y, z) => {
    const node = bone(name);
    if (node) node.scale.set(x, y, z);
  };
  apply('hips', hips, 1, hips);
  apply('spine', waist, 1, waist);
  apply('chest', waist, 1, waist);
  apply('leftUpperLeg', thighs, 1, thighs);
  apply('rightUpperLeg', thighs, 1, thighs);
  const fit = vrm.scene.userData.fit || vrm.scene.scale.x || 1;
  vrm.scene.scale.setScalar(fit * height);
  return { hips, thighs, waist, height };
}

function tuneSprings(vrm, low) {
  const springs = vrm.springBoneManager;
  if (!springs) return;
  for (const joint of springs.joints) {
    const name = joint.bone?.name || '';
    const settings = joint.settings;
    if (!settings) continue;
    if (/bust/i.test(name)) {
      settings.stiffness = 1.8;
      settings.gravityPower = 0.015;
      settings.dragForce = 0.72;
    } else if (/hair/i.test(name)) {
      settings.stiffness = low ? 0.9 : 0.55;
      settings.gravityPower = 0.1;
      settings.gravityDir.set(0, -1, 0);
      settings.dragForce = low ? 0.55 : 0.34;
      settings.hitRadius = Math.min(settings.hitRadius || 0.02, 0.035);
    } else if (/hood|string/i.test(name)) {
      settings.stiffness = low ? 0.95 : 0.62;
      settings.gravityPower = 0.16;
      settings.gravityDir.set(0, -1, 0);
      settings.dragForce = 0.42;
    }
  }
  springs.setInitState();
}

export async function createMaren(url, { low = false } = {}) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  // The normalized rig is a T-pose. Copying it onto the sample would hold her arms out.
  vrm.humanoid.autoUpdateHumanBones = false;
  const cap = low ? 160 : 256;
  vrm.scene.traverse((o) => {
    o.frustumCulled = false;
    if (!o.isMesh) return;
    for (const material of [].concat(o.material || [])) {
      const name = material.name || o.name || '';
      if (HAIR.test(name)) dye(material, '#e7b08a', '#7a4030');
      else if (TOP.test(name)) dye(material, '#f3e2c0', '#a88458');
      else if (BOTTOM.test(name)) dye(material, '#b7d39a', '#4e6a3c');
      else if (SHOE.test(name)) dye(material, '#c4926e', '#5c3a28');
      if (material.outlineWidthFactor != null) material.outlineWidthFactor = low ? 0 : 0.0015;
      for (const key of ['map', 'shadeMultiplyTexture', 'normalMap']) {
        if (material[key]) shrink(material[key], cap);
      }
    }
  });
  const chest = vrm.humanoid.getRawBoneNode('chest') || vrm.humanoid.getRawBoneNode('upperChest');
  if (chest) {
    const herb = sprig();
    herb.position.set(0.03, 0.04, -0.1);
    herb.rotation.z = -0.5;
    chest.add(herb);
  }
  const relax = (name, x, y, z) => {
    const node = vrm.humanoid.getRawBoneNode(name);
    if (node) node.rotation.set(x, y, z);
  };
  // The sample stands in a T. A quiet A-pose reads as someone waiting by the fire.
  relax('leftUpperArm', 0.12, 0.05, 1.12);
  relax('rightUpperArm', 0.12, -0.05, -1.12);
  relax('leftLowerArm', 0.08, 0.15, 0.18);
  relax('rightLowerArm', 0.08, -0.15, -0.18);
  relax('leftShoulder', 0, 0, 0.12);
  relax('rightShoulder', 0, 0, -0.12);
  vrm.scene.userData.appealed = true;
  vrm.scene.userData.fit = 1;
  const root = vrm.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = box.getSize(new THREE.Vector3()).y || 1;
  if (Number.isFinite(height) && height > 0.3 && height < 20) root.scale.multiplyScalar(1.58 / height);
  root.updateMatrixWorld(true);
  root.position.y -= new THREE.Box3().setFromObject(root).min.y;
  root.userData.fit = root.scale.x;
  shapeBody(vrm, {});
  tuneSprings(vrm, low);

  const gaze = new THREE.Object3D();
  gaze.name = 'maren-gaze';
  if (vrm.lookAt) vrm.lookAt.target = gaze;
  const rest = new Map();
  let mood = 'settled';
  let greetLeft = 0;
  let greeting = false;
  let blinkIn = 2.4;
  let blink = 0;
  let hold = null;
  let detail = low;

  function setDetail(next) {
    detail = !!next;
    const max = detail ? 160 : 256;
    vrm.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const material of [].concat(o.material || [])) {
        if (material.outlineWidthFactor != null) material.outlineWidthFactor = detail ? 0 : 0.0015;
        for (const key of ['map', 'shadeMultiplyTexture', 'normalMap']) {
          if (material[key]) shrink(material[key], max);
        }
      }
    });
    tuneSprings(vrm, detail);
  }

  function feel(next) {
    const was = greeting;
    mood = next.mood || mood;
    greeting = !!next.greeting;
    if (greeting && !was) greetLeft = 1.7;
  }

  function poseBone(name, x, y, z) {
    const node = vrm.humanoid.getRawBoneNode(name);
    if (!node) return;
    if (!rest.has(name)) rest.set(name, node.quaternion.clone());
    _euler.setFromQuaternion(rest.get(name), 'XYZ');
    _euler.x += x;
    _euler.y += y;
    _euler.z += z;
    node.quaternion.setFromEuler(_euler);
  }

  function update(dt, camera) {
    const t = performance.now() * 0.001;
    if (greetLeft > 0) greetLeft = Math.max(0, greetLeft - dt);
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blink = 1;
      blinkIn = 2.6 + (t % 1.3);
    }
    if (blink > 0) blink = Math.max(0, blink - dt * 7);
    let happy = 0.15;
    let relaxed = 0.7;
    let surprised = 0;
    if (hold === 'happy') { happy = 0.72; relaxed = 0.16; }
    else if (hold === 'relaxed') { relaxed = 0.95; happy = 0.08; }
    else if (hold === 'surprised') { surprised = 0.75; relaxed = 0.1; happy = 0.05; }
    else if (greetLeft > 1.05) { surprised = 0.72; relaxed = 0.1; happy = 0.05; }
    else if (greetLeft > 0) { happy = 0.88; relaxed = 0.15; }
    else if (/busy/.test(mood)) { happy = 0.5; relaxed = 0.25; }
    else if (/hushed/.test(mood)) { relaxed = 0.92; happy = 0.06; }
    else { relaxed = 0.78; happy = 0.28; }
    const face = vrm.expressionManager;
    if (face) {
      face.setValue('happy', happy);
      face.setValue('relaxed', relaxed);
      face.setValue('Surprised', surprised);
      face.setValue('blink', surprised > 0.4 ? blink * 0.25 : blink);
    }
    poseBone('chest', Math.sin(t * 1.45) * 0.035, 0, 0);
    poseBone('spine', Math.sin(t * 0.7) * 0.012, 0, Math.sin(t * 0.45) * 0.018);
    if (camera) {
      camera.getWorldPosition(gaze.position);
      if (!gaze.parent) camera.parent?.add(gaze) || vrm.scene.parent?.add(gaze);
    }
    vrm.update(detail ? Math.min(dt, 1 / 30) : dt);
  }

  return {
    vrm,
    root,
    update,
    feel,
    setDetail,
    shape(next) { return shapeBody(vrm, next); },
    pose(name) { hold = name || null; },
    get expressions() { return Object.keys(vrm.expressionManager?.expressionMap || {}); },
  };
}
