// Quaternius Universal Animation Library, CC0, in-place locomotion.
// The clips drive a mannequin. Each frame their pose is carried onto the VRM.
import * as THREE from 'three';

const MAP = [
  ['pelvis', 'hips'],
  ['spine_01', 'spine'],
  ['spine_02', 'chest'],
  ['spine_03', 'upperChest'],
  ['neck_01', 'neck'],
  ['Head', 'head'],
  ['clavicle_l', 'leftShoulder'],
  ['upperarm_l', 'leftUpperArm'],
  ['lowerarm_l', 'leftLowerArm'],
  ['hand_l', 'leftHand'],
  ['clavicle_r', 'rightShoulder'],
  ['upperarm_r', 'rightUpperArm'],
  ['lowerarm_r', 'rightLowerArm'],
  ['hand_r', 'rightHand'],
  ['thigh_l', 'leftUpperLeg'],
  ['calf_l', 'leftLowerLeg'],
  ['foot_l', 'leftFoot'],
  ['thigh_r', 'rightUpperLeg'],
  ['calf_r', 'rightLowerLeg'],
  ['foot_r', 'rightFoot'],
];

const CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'];

function smooth(x, a, b) {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

function band(speed, in0, in1, out0, out1) {
  const up = smooth(speed, in0, in1);
  const down = 1 - smooth(speed, out0, out1);
  return Math.max(0, Math.min(up, down));
}

export async function loadLocomotion() {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('motion/UAL1_Standard.glb');
  const root = gltf.scene;
  const byName = {};
  root.traverse((o) => { if (o.name) byName[o.name] = o; });
  root.updateMatrixWorld(true);
  const restLocal = {};
  const restWorld = {};
  for (const [src] of MAP) {
    const bone = byName[src];
    if (!bone) continue;
    restLocal[src] = bone.quaternion.clone();
    restWorld[src] = bone.getWorldQuaternion(new THREE.Quaternion());
  }
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const name of CLIPS) {
    const clip = gltf.animations.find((a) => a.name === name);
    if (!clip) continue;
    const act = mixer.clipAction(clip);
    act.enabled = true;
    act.play();
    act.setEffectiveWeight(0);
    actions[name] = act;
  }
  return {
    root,
    byName,
    restLocal,
    restWorld,
    mixer,
    actions,
    pelvisRest: byName.pelvis ? byName.pelvis.position.y : 0,
    map: MAP,
  };
}

export function driveLocomotion(motion, speed, dt) {
  const idle = 1 - smooth(speed, 0.15, 1.15);
  const walk = band(speed, 0.25, 1.2, 3.1, 4.8);
  const jog = band(speed, 2.8, 4.4, 7.4, 10.2);
  const sprint = smooth(speed, 8, 11.5);
  const sum = idle + walk + jog + sprint || 1;
  const w = { Idle_Loop: idle / sum, Walk_Loop: walk / sum, Jog_Fwd_Loop: jog / sum, Sprint_Loop: sprint / sum };
  const pace = {
    Idle_Loop: 1,
    Walk_Loop: THREE.MathUtils.clamp(Math.max(speed, 0.8) / 1.5, 0.65, 2.3),
    Jog_Fwd_Loop: THREE.MathUtils.clamp(Math.max(speed, 2) / 3.4, 0.7, 2.15),
    Sprint_Loop: THREE.MathUtils.clamp(Math.max(speed, 4) / 6.4, 0.75, 2.05),
  };
  for (const name of CLIPS) {
    const act = motion.actions[name];
    if (!act) continue;
    act.setEffectiveWeight(w[name]);
    act.setEffectiveTimeScale(pace[name]);
  }
  motion.mixer.update(dt);
}

const _src = new THREE.Quaternion();
const _dst = new THREE.Quaternion();
const _parent = new THREE.Quaternion();
const _fix = new THREE.Quaternion();

export function retargetPose(motion, bones, restLocal, restWorld) {
  motion.root.updateMatrixWorld(true);
  for (const [src, name] of motion.map) {
    const from = motion.byName[src];
    const to = bones[name];
    if (!from || !to || !motion.restWorld[src] || !restWorld[name] || !restLocal[name]) continue;
    from.getWorldQuaternion(_src);
    _dst.copy(_src).multiply(_fix.copy(motion.restWorld[src]).invert()).multiply(restWorld[name]);
    to.parent?.updateWorldMatrix(true, false);
    to.parent?.getWorldQuaternion(_parent);
    to.quaternion.copy(_parent.invert()).multiply(_dst);
    to.updateMatrixWorld(true);
  }
  const hips = bones.hips;
  const pelvis = motion.byName.pelvis;
  if (hips && pelvis) {
    const bob = THREE.MathUtils.clamp(pelvis.position.y - motion.pelvisRest, -0.07, 0.08);
    hips.position.y = (hips.userData.restY ?? hips.position.y) + bob;
  }
}
