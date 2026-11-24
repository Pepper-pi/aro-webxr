// The player on the map. AvatarSample A, B, or C, re-encoded from the VRoid Hub originals.
// High is capped at 2048. Phone is capped at 512. These files are not CC0.
import * as THREE from 'three';

const LETTERS = ['A', 'B', 'C'];
const _euler = new THREE.Euler();
const _q = new THREE.Quaternion();

function band(speed, in0, in1, out0, out1) {
  const up = smooth(speed, in0, in1);
  const down = 1 - smooth(speed, out0, out1);
  return Math.max(0, Math.min(up, down));
}

function smooth(x, a, b) {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

function kindOf(name) {
  const n = name || '';
  if (/bust/i.test(n)) return 'bust';
  if (/hair|ahoge|sidehair/i.test(n)) return 'hair';
  if (/skirt|dress|cloth|sleeve|hood|ribbon|string|tail/i.test(n)) return 'cloth';
  return 'body';
}

const JIGGLE = {
  soft: { hair: [0.72, 0.08, 0.48], cloth: [0.8, 0.1, 0.5], bust: [1.7, 0.012, 0.74], body: [0.95, 0.06, 0.55] },
  full: { hair: [0.38, 0.12, 0.3], cloth: [0.42, 0.14, 0.32], bust: [1.15, 0.02, 0.58], body: [0.5, 0.1, 0.36] },
};

export function createAvatar(scene, { phone = false } = {}) {
  const group = new THREE.Group();
  group.name = 'player-avatar';
  group.visible = false;
  scene.add(group);

  let letter = 'B';
  let tier = phone ? 'Phone' : 'High';
  let jiggle = 'soft';
  let vrm = null;
  let bones = {};
  let rest = {};
  let phase = 0;
  let ease = 0;
  let turn = 0;
  let lastYaw = 0;
  let springAcc = 0;
  const springBase = new WeakMap();
  let token = 0;
  const ready = { current: null };

  function bone(name) {
    return vrm?.humanoid?.getRawBoneNode(name) || null;
  }

  function captureRest() {
    bones = {};
    rest = {};
    const names = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
      'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'];
    for (const name of names) {
      const node = bone(name);
      if (!node) continue;
      bones[name] = node;
      rest[name] = node.quaternion.clone();
    }
  }

  function poseBone(name, x, y, z) {
    const node = bones[name];
    if (!node || !rest[name]) return;
    _euler.setFromQuaternion(rest[name], 'XYZ');
    _euler.x += x;
    _euler.y += y;
    _euler.z += z;
    node.quaternion.setFromEuler(_euler);
  }

  function setAbs(name, x, y, z) {
    const node = bones[name];
    if (node) node.rotation.set(x, y, z);
  }

  function dropArms() {
    setAbs('leftShoulder', 0, 0, 0.12);
    setAbs('rightShoulder', 0, 0, -0.12);
    setAbs('leftUpperArm', 0.12, 0.05, 1.12);
    setAbs('rightUpperArm', 0.12, -0.05, -1.12);
    setAbs('leftLowerArm', 0.08, 0.15, 0.18);
    setAbs('rightLowerArm', 0.08, -0.15, -0.18);
    captureRest();
  }

  function tuneSprings() {
    const springs = vrm?.springBoneManager;
    if (!springs) return;
    const phoneCut = tier === 'Phone';
    for (const joint of springs.joints) {
      const settings = joint.settings;
      if (!settings) continue;
      if (!springBase.has(joint)) {
        springBase.set(joint, {
          stiffness: settings.stiffness,
          gravityPower: settings.gravityPower,
          dragForce: settings.dragForce,
          hitRadius: settings.hitRadius,
        });
      }
      if (jiggle === 'off') continue;
      const preset = JIGGLE[jiggle][kindOf(joint.bone?.name)];
      const stiff = preset[0] * (phoneCut && jiggle === 'soft' ? 1.25 : 1);
      settings.stiffness = stiff;
      settings.gravityPower = preset[1];
      settings.gravityDir.set(0, -1, 0);
      settings.dragForce = Math.min(0.86, preset[2] + (phoneCut ? 0.08 : 0));
      settings.hitRadius = phoneCut || jiggle === 'soft' ? 0 : Math.min(springBase.get(joint).hitRadius || 0, 0.04);
    }
    if (jiggle === 'off') springs.reset();
    else springs.setInitState();
  }

  function stepSprings(dt) {
    const springs = vrm?.springBoneManager;
    if (!springs || jiggle === 'off' || !group.visible) return;
    const cap = tier === 'Phone' || jiggle === 'soft' ? 1 / 30 : 1 / 20;
    springAcc += dt;
    if (springAcc < cap && tier === 'Phone') return;
    const step = Math.min(springAcc, cap);
    springAcc = 0;
    springs.update(step);
  }

  function stepMaterials(dt) {
    vrm?.materials?.forEach((material) => material.update?.(dt));
  }

  async function load() {
    const mine = ++token;
    const url = `figure/hires/AvatarSample_${letter}_${tier}.vrm`;
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    if (mine !== token) return;
    const next = gltf.userData.vrm;
    VRMUtils.rotateVRM0(next);
    next.humanoid.autoUpdateHumanBones = false;
    const maxAniso = tier === 'Phone' ? 1 : 8;
    next.scene.traverse((o) => {
      o.frustumCulled = false;
      if (!o.isMesh) return;
      for (const material of [].concat(o.material || [])) {
        if (material.outlineWidthFactor != null) material.outlineWidthFactor = tier === 'Phone' ? 0 : 0.0012;
        for (const key of ['map', 'shadeMultiplyTexture', 'normalMap']) {
          const tex = material[key];
          if (!tex) continue;
          tex.anisotropy = maxAniso;
          tex.needsUpdate = true;
        }
      }
    });
    const root = next.scene;
    root.position.set(0, 0, 0);
    root.scale.setScalar(1);
    root.updateMatrixWorld(true);
    const height = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y || 1.6;
    if (height > 0.3 && height < 20) root.scale.setScalar(1.62 / height);
    root.updateMatrixWorld(true);
    root.position.y -= new THREE.Box3().setFromObject(root).min.y;
    if (vrm) {
      group.remove(vrm.scene);
      vrm.scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
    }
    vrm = next;
    group.add(root);
    captureRest();
    dropArms();
    tuneSprings();
    ready.current = vrm;
  }

  function gait(dt, walker) {
    if (!vrm) return;
    const speed = walker.speed || 0;
    const walkW = band(speed, 0.2, 0.8, 2.6, 3.6);
    const jogW = band(speed, 2.4, 3.8, 7.4, 9.2);
    const sprintW = smooth(speed, 7.6, 10.5);
    const moving = Math.max(walkW, Math.max(jogW, sprintW));
    const swing = (0.42 * walkW + 0.62 * jogW + 0.9 * sprintW) * (walker.grounded ? 1 : 0.35);
    ease += (swing - ease) * (1 - Math.exp(-dt * 5));
    const stride = 1.25 + jogW * 0.45 + sprintW * 0.7;
    const rate = speed > 0.2 && walker.grounded ? Math.min(speed / stride, 2.65) : 0;
    phase = (phase + rate * dt) % 1;
    const s = Math.sin(phase * Math.PI * 2);
    const breathe = Math.sin(performance.now() * 0.0016) * (moving > 0.2 ? 0.012 : 0.03);
    const dyaw = Math.atan2(Math.sin(walker.yaw - lastYaw), Math.cos(walker.yaw - lastYaw));
    lastYaw = walker.yaw;
    const yawRate = dyaw / Math.max(dt, 1 / 120);
    turn += (THREE.MathUtils.clamp(yawRate, -2.2, 2.2) - turn) * (1 - Math.exp(-dt * 6));
    const lean = THREE.MathUtils.clamp(-turn * 0.08, -0.22, 0.22) * Math.min(1, speed / 3);
    const fwd = 0.03 * jogW + 0.1 * sprintW;
    poseBone('hips', Math.abs(Math.cos(phase * Math.PI * 2)) * ease * 0.05, s * ease * 0.06, lean * 0.4);
    poseBone('spine', breathe + fwd * 0.4, 0, lean * 0.7);
    poseBone('chest', breathe * 1.4 + fwd, 0, lean * 0.45);
    poseBone('upperChest', breathe, 0, lean * 0.2);
    poseBone('neck', breathe * 0.4, -s * ease * 0.04, -lean * 0.25);
    poseBone('head', 0.02, -s * ease * 0.05, -lean * 0.15);
    const liftL = Math.max(0, s);
    const liftR = Math.max(0, -s);
    poseBone('leftUpperLeg', s * ease * 0.95, 0, 0.03);
    poseBone('rightUpperLeg', -s * ease * 0.95, 0, -0.03);
    poseBone('leftLowerLeg', liftL * ease * 1.15, 0, 0);
    poseBone('rightLowerLeg', liftR * ease * 1.15, 0, 0);
    poseBone('leftFoot', -s * ease * 0.35 + 0.05, 0, 0);
    poseBone('rightFoot', s * ease * 0.35 + 0.05, 0, 0);
    poseBone('leftUpperArm', 0.08 - s * ease * 0.7, 0, 0.06);
    poseBone('rightUpperArm', 0.08 + s * ease * 0.7, 0, -0.06);
    poseBone('leftLowerArm', 0.18 + liftR * ease * 0.35, 0, 0);
    poseBone('rightLowerArm', 0.18 + liftL * ease * 0.35, 0, 0);
    if (!walker.grounded) {
      poseBone('leftUpperLeg', 0.35, 0, 0.04);
      poseBone('rightUpperLeg', 0.28, 0, -0.04);
      poseBone('leftLowerLeg', 0.7, 0, 0);
      poseBone('rightLowerLeg', 0.55, 0, 0);
    }
  }

  const pending = load().catch((err) => { console.warn('avatar', err); });

  return {
    group,
    get letter() { return letter; },
    get tier() { return tier; },
    get jiggle() { return jiggle; },
    get ready() { return !!ready.current; },
    whenReady: pending,
    setLetter(next) {
      const pick = LETTERS.includes(next) ? next : 'B';
      if (pick === letter) return pending;
      letter = pick;
      return load().catch((err) => { console.warn('avatar', err); });
    },
    setTier(next) {
      const pick = next === 'Phone' ? 'Phone' : 'High';
      if (pick === tier) return pending;
      tier = pick;
      return load().catch((err) => { console.warn('avatar', err); });
    },
    setJiggle(next) {
      jiggle = next === 'off' || next === 'full' ? next : 'soft';
      tuneSprings();
    },
    update(dt, walker, visible) {
      group.visible = !!(visible && vrm);
      if (!vrm || !group.visible) return;
      group.position.set(walker.feet.x, walker.feet.y, walker.feet.z);
      group.rotation.y = walker.yaw;
      gait(dt, walker);
      stepSprings(dt);
      stepMaterials(dt);
    },
  };
}
