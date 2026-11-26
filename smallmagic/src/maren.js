// Maren Reed, derived from VRoid AvatarSample_A. The file is not CC0.
// Hair, cloth, and the sprig are runtime changes. The other companions stay as they are.
import * as THREE from 'three';

const HAIR = /hair/i;
const TOP = /tops/i;
const BOTTOM = /bottoms/i;
const SHOE = /shoes/i;

const _euler = new THREE.Euler();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qout = new THREE.Quaternion();

function crackle(tex) {
  const img = tex?.image;
  if (!img?.width || !img?.height) return null;
  const w = Math.min(img.width, 1024);
  const h = Math.min(img.height, 1024);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  g.strokeStyle = 'rgba(36, 18, 22, 0.62)';
  g.lineWidth = Math.max(2.5, w / 180);
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = (0.12 + i * 0.12) * w;
    g.moveTo(x, h * 0.05);
    g.bezierCurveTo(x + w * 0.04, h * 0.3, x - w * 0.05, h * 0.55, x + w * 0.02, h * 0.92);
  }
  g.stroke();
  g.strokeStyle = '#9a1830';
  g.lineWidth = Math.max(2, w / 180);
  g.beginPath();
  g.arc(w * 0.28, h * 0.42, w * 0.045, 0.2, Math.PI * 1.3);
  g.moveTo(w * 0.25, h * 0.4);
  g.lineTo(w * 0.32, h * 0.46);
  g.moveTo(w * 0.62, h * 0.22);
  g.lineTo(w * 0.62, h * 0.34);
  g.moveTo(w * 0.57, h * 0.28);
  g.lineTo(w * 0.67, h * 0.28);
  g.stroke();
  g.strokeStyle = '#1a1014';
  g.stroke();
  const next = new THREE.CanvasTexture(canvas);
  next.colorSpace = tex.colorSpace || THREE.SRGBColorSpace;
  next.flipY = tex.flipY;
  next.wrapS = tex.wrapS;
  next.wrapT = tex.wrapT;
  next.needsUpdate = true;
  return next;
}

function sigilTex(color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = color;
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(64, 72, 30, 0.3, Math.PI * 1.45);
  g.moveTo(46, 58);
  g.lineTo(84, 90);
  g.moveTo(64, 18);
  g.lineTo(64, 48);
  g.moveTo(48, 34);
  g.lineTo(80, 34);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function crackStroke(parent, x, y, z, len, rotZ) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.014, 0.002),
    new THREE.MeshBasicMaterial({ color: '#14080c' }),
  );
  m.position.set(x, y, z);
  m.rotation.z = rotZ;
  m.name = 'porcelain-crack';
  parent.add(m);
}

function glazePorcelain(vrm) {
  const paint = (material, kind) => {
    if (!material?.color?.set) return;
    material.emissive?.set?.('#000000');
    if (material.emissiveIntensity != null) material.emissiveIntensity = 0;
    if (kind === 'eye') {
      material.color.set('#ffb4d6');
      material.emissive?.set?.('#ff8ec4');
      if (material.emissiveIntensity != null) material.emissiveIntensity = 0.4;
      material.shadeColorFactor?.set?.('#e080b0');
      return;
    }
    if (kind === 'skin' || kind === 'cloth') {
      const rim = material.uniforms?.parametricRimColorFactor?.value;
      if (rim?.set) rim.set('#ff4fa8');
      if (material.uniforms?.parametricRimFresnelPowerFactor) material.uniforms.parametricRimFresnelPowerFactor.value = 5.8;
      if (material.uniforms?.parametricRimLiftFactor) material.uniforms.parametricRimLiftFactor.value = 0;
      if (material.uniforms?.rimLightingMixFactor) material.uniforms.rimLightingMixFactor.value = kind === 'skin' ? 0.7 : 0.5;
    }
    if (kind === 'skin') {
      material.color.set('#c5d2e0');
      material.shadeColorFactor?.set?.('#b7c6d6');
      if (material.uniforms?.shadingToonyFactor) material.uniforms.shadingToonyFactor.value = 0.04;
    }
    if (kind === 'cloth') {
      material.color.set('#7a5578');
      material.shadeColorFactor?.set?.('#a07898');
    }
    if (kind === 'hair') {
      material.color.set('#2c2430');
      material.shadeColorFactor?.set?.('#4a4050');
    }
    if (kind === 'cloth') {
      const baked = crackle(material.map);
      if (baked) material.map = baked;
    }
  };
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const material of [].concat(o.material || [])) {
      const name = `${material.name || ''} ${o.name || ''}`;
      if (/eyeiris/i.test(name)) paint(material, 'eye');
      else if (/skin|face_00|body_00/i.test(name)) paint(material, 'skin');
      else if (/hair/i.test(name)) paint(material, 'hair');
      else if (/tops|bottoms|cloth/i.test(name)) paint(material, 'cloth');
    }
  });
  const ringMat = new THREE.MeshStandardMaterial({ color: '#3a3034', metalness: 0.55, roughness: 0.28 });
  for (const boneName of ['leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftLowerLeg', 'rightLowerLeg']) {
    const bone = vrm.humanoid.getRawBoneNode(boneName);
    if (!bone) continue;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(boneName.includes('Hand') ? 0.022 : 0.036, 0.006, 6, 14), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.name = 'porcelain-joint';
    bone.add(ring);
  }
  const head = vrm.humanoid.getRawBoneNode('head');
  if (head) {
    const red = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.09),
      new THREE.MeshBasicMaterial({ map: sigilTex('#c41830'), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    red.position.set(0.055, -0.02, 0.108);
    red.name = 'porcelain-glyph';
    head.add(red);
    const black = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.07),
      new THREE.MeshBasicMaterial({ map: sigilTex('#14080c'), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    black.position.set(-0.01, 0.055, 0.105);
    black.name = 'porcelain-glyph';
    head.add(black);
    crackStroke(head, -0.062, 0.072, 0.1, 0.026, 1.15);
    crackStroke(head, -0.05, 0.058, 0.1, 0.018, 0.25);
    crackStroke(head, 0.064, 0.066, 0.1, 0.022, -0.7);
  }
  const neck = vrm.humanoid.getRawBoneNode('neck');
  if (neck) {
    crackStroke(neck, 0.0, 0.02, 0.045, 0.06, 0.2);
    crackStroke(neck, 0.01, -0.02, 0.045, 0.05, -0.5);
  }
  for (const side of ['leftHand', 'rightHand']) {
    const hand = vrm.humanoid.getRawBoneNode(side);
    if (!hand) continue;
    crackStroke(hand, 0, 0.01, 0.02, 0.04, side === 'leftHand' ? 0.4 : -0.4);
  }
  const chest = vrm.humanoid.getRawBoneNode('chest') || vrm.humanoid.getRawBoneNode('upperChest');
  if (chest && !chest.getObjectByName('porcelain-wisp')) {
    const wisp = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ff8ec8', transparent: true, opacity: 0.72, depthWrite: false }),
    );
    wisp.name = 'porcelain-wisp';
    chest.add(wisp);
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#ffd0ea', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    mote.name = 'porcelain-mote';
    chest.add(mote);
  }
}

function dye(material, lit, shade) {
  if (!material) return;
  if (material.color?.set) material.color.set(lit);
  if (material.shadeColorFactor?.set) material.shadeColorFactor.set(shade);
}

function sharpen(tex, max, aniso = 8) {
  if (!tex) return;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = aniso;
  const img = tex.image;
  // An empty image must not be uploaded. That leaves the face black and the eyes as white slits.
  if (!img || !img.width || !img.height) return;
  if (max && Math.max(img.width, img.height) > max) {
    const scale = max / Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    tex.image = canvas;
  }
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

function sampleQuat(track, time, out) {
  const times = track.times;
  const values = track.values;
  let i = 0;
  const last = times.length - 1;
  while (i < last && times[i + 1] <= time) i += 1;
  const j = Math.min(i + 1, last);
  const span = Math.max(0.0001, times[j] - times[i]);
  const u = j === i ? 0 : (time - times[i]) / span;
  _qa.fromArray(values, i * 4);
  _qb.fromArray(values, j * 4);
  out.copy(_qa).slerp(_qb, u);
}

// One companion id in four. The tell is how they stand and walk, not a light show.
export function isRareNpc(id) {
  let h = 2166136261;
  for (const c of String(id || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 4 === 0;
}

const MANNER = { maren: 'tend', sable: 'still', bram: 'sure', lumen: 'glance' };
const FOLLOW = { tend: 1.55, still: 1.35, sure: 4.4, glance: 1.9 };

export function rareFollowRate(id) {
  if (!isRareNpc(id)) return null;
  return FOLLOW[MANNER[id] || 'still'];
}

function buildIdle(vrm, manner) {
  const slow = manner === 'still' || manner === 'glance' || manner === 'tend';
  const sure = manner === 'sure';
  const amp = manner === 'still' ? 0.28 : sure ? 0.75 : slow ? 0.55 : 1;
  const scale = (frames) => frames.map(([x, y, z]) => [x * amp, y * amp, z * amp]);
  const keys = {
    hips: scale([[0.02, 0.05, 0.03], [-0.03, -0.02, 0.06], [0, -0.05, 0], [0.03, 0.02, -0.05], [0.02, 0.05, 0.03]]),
    spine: scale([[0.03, 0, 0], [0.07, 0.03, 0.02], [0.02, 0, 0], [0.06, -0.03, -0.015], [0.03, 0, 0]]),
    chest: scale(sure
      ? [[-0.02, 0, 0], [0.04, 0, 0.015], [-0.02, 0, 0], [0.02, 0, -0.012], [-0.02, 0, 0]]
      : [[0.02, 0, 0], [0.12, 0.02, 0.015], [0.03, 0, 0], [0.1, -0.02, -0.012], [0.02, 0, 0]]),
    neck: scale([[0, 0.03, 0], [0.02, -0.04, 0], [0, -0.02, 0], [0.015, 0.04, 0], [0, 0.03, 0]]),
    head: scale(manner === 'glance'
      ? [[0, 0.05, 0], [0.02, -0.16, 0.01], [0, 0.02, 0], [0.02, 0.14, -0.01], [0, 0.05, 0]]
      : [[0, 0.05, 0], [0.03, -0.06, 0.01], [0, -0.04, 0], [0.02, 0.06, -0.01], [0, 0.05, 0]]),
    leftUpperArm: scale([[0, 0, 0], [0.05, 0, 0.05], [0.01, 0, 0], [0.04, 0, -0.03], [0, 0, 0]]),
    rightUpperArm: scale(manner === 'tend'
      ? [[0, 0, 0], [0.35, 0.1, -0.2], [0.08, 0, -0.05], [0.05, 0, 0.04], [0, 0, 0]]
      : [[0, 0, 0], [0.04, 0, -0.05], [0.01, 0, 0], [0.05, 0, 0.04], [0, 0, 0]]),
    leftLowerArm: scale([[0, 0, 0], [0.08, 0.04, 0], [0.02, 0, 0], [0.06, -0.02, 0], [0, 0, 0]]),
    rightLowerArm: scale(manner === 'tend'
      ? [[0, 0, 0], [0.45, -0.05, 0], [0.12, 0, 0], [0.08, 0.04, 0], [0, 0, 0]]
      : [[0, 0, 0], [0.06, -0.03, 0], [0.02, 0, 0], [0.08, 0.04, 0], [0, 0, 0]]),
  };
  const times = sure ? [0, 0.7, 1.4, 2.1, 2.8] : slow ? [0, 1.6, 3.2, 4.8, 6.4] : [0, 1, 2, 3, 4];
  const tracks = [];
  const bones = [];
  for (const [name, frames] of Object.entries(keys)) {
    const node = vrm.humanoid.getRawBoneNode(name);
    if (!node) continue;
    const rest = node.quaternion.clone();
    const values = [];
    for (const [x, y, z] of frames) {
      _euler.setFromQuaternion(rest, 'XYZ');
      _euler.x += x;
      _euler.y += y;
      _euler.z += z;
      _qa.setFromEuler(_euler);
      values.push(_qa.x, _qa.y, _qa.z, _qa.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
    bones.push(node);
  }
  return { clip: new THREE.AnimationClip('companion-idle', times[times.length - 1], tracks), bones, time: 0 };
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

function dressLumen(vrm, chest, low) {
  vrm.scene.traverse((o) => {
    if (!o.isMesh || !/hair/i.test(o.name || '')) return;
    o.scale.x *= 1.06;
    o.scale.y *= 0.82;
    o.scale.z *= 1.04;
  });
  const head = vrm.humanoid.getRawBoneNode('head');
  const braids = [];
  if (head) {
    const hair = new THREE.MeshLambertMaterial({ color: '#efe6ff' });
    const band = new THREE.MeshLambertMaterial({ color: '#e7c56a' });
    const bead = new THREE.SphereGeometry(0.012, 6, 5);
    for (const side of [-1, 1]) {
      const braid = new THREE.Group();
      braid.name = 'lumen-braid';
      for (let i = 0; i < 6; i++) {
        const knot = new THREE.Mesh(bead, hair);
        const t = i / 5;
        knot.position.set(Math.sin(t * 4 + side) * 0.008, -t * 0.22, 0);
        knot.scale.setScalar(1 - t * 0.35);
        braid.add(knot);
      }
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 4, 8), band);
      tie.position.y = -0.04;
      tie.rotation.x = Math.PI / 2;
      braid.add(tie);
      braid.position.set(side * 0.09, -0.02, 0.04);
      braid.rotation.z = side * 0.22;
      braid.rotation.x = 0.45;
      head.add(braid);
      braids.push(braid);
    }
  }
  if (chest) {
    const cloth = new THREE.MeshLambertMaterial({ color: '#2a2158', side: THREE.DoubleSide });
    const trim = new THREE.MeshLambertMaterial({ color: '#e7c56a', side: THREE.DoubleSide });
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.52, 6, 5), cloth);
    cape.name = 'lumen-mantle';
    const pos = cape.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const hang = (y + 0.26) / 0.52;
      pos.setZ(i, -0.01 - x * x * 0.55 + hang * 0.06);
      pos.setY(i, y - Math.abs(x) * 0.08);
    }
    pos.needsUpdate = true;
    cape.geometry.computeVertexNormals();
    cape.position.set(0, -0.04, 0.09);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.018), trim);
    edge.position.set(0, -0.24, 0.01);
    cape.add(edge);
    chest.add(cape);
  }
  const hand = vrm.humanoid.getRawBoneNode('leftHand');
  if (hand) {
    const lamp = new THREE.Group();
    lamp.name = 'lumen-lantern';
    const metal = new THREE.MeshLambertMaterial({ color: '#c4a05a' });
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8, 1, true), metal);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.012, 8), metal);
    cap.position.y = 0.028;
    const foot = cap.clone();
    foot.position.y = -0.028;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#fff1c8' }),
    );
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 4, 8), metal);
    handle.position.y = 0.04;
    handle.rotation.x = Math.PI / 2;
    lamp.add(cage, cap, foot, glow, handle);
    lamp.position.set(0.01, -0.08, 0.02);
    lamp.scale.setScalar(0.85);
    if (!low) {
      const lampLight = new THREE.PointLight('#fff1c8', 0.08, 0.7, 2);
      lamp.add(lampLight);
    }
    hand.add(lamp);
  }
  vrm.scene.userData.lumenBits = braids;
}

function charmOf(kind) {
  if (kind === 'hook') {
    const g = new THREE.Group();
    g.name = 'line-hook';
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), new THREE.MeshBasicMaterial({ color: '#d7dde2' }));
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 4, 8, Math.PI), new THREE.MeshBasicMaterial({ color: '#c5ced6' }));
    bend.position.y = -0.04;
    g.add(stem, bend);
    return g;
  }
  if (kind === 'bead') {
    const g = new THREE.Group();
    g.name = 'sun-bead';
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#e7c56a' }));
    g.add(bead);
    return g;
  }
  return sprig();
}

export async function createCompanion(url, opts = {}) {
  const low = !!opts.low;
  const dyes = opts.dyes || {
    hair: '#e7b08a', hairShade: '#7a4030',
    top: '#f3e2c0', topShade: '#a88458',
    bottom: '#b7d39a', bottomShade: '#4e6a3c',
    shoe: '#c4926e', shoeShade: '#5c3a28',
  };
  const tall = opts.height || 1.58;
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  // The normalized rig is a T-pose. Copying it onto the sample would hold her arms out.
  vrm.humanoid.autoUpdateHumanBones = false;
  const cap = low ? 192 : 0;
  const aniso = low ? 2 : 16;
  vrm.scene.traverse((o) => {
    o.frustumCulled = false;
    if (!o.isMesh) return;
    for (const material of [].concat(o.material || [])) {
      const name = material.name || o.name || '';
      if (HAIR.test(name)) dye(material, dyes.hair, dyes.hairShade);
      else if (TOP.test(name)) dye(material, dyes.top, dyes.topShade);
      else if (BOTTOM.test(name)) dye(material, dyes.bottom, dyes.bottomShade);
      else if (SHOE.test(name)) dye(material, dyes.shoe, dyes.shoeShade);
      if (material.outlineWidthFactor != null) material.outlineWidthFactor = low ? 0 : 0.0015;
      for (const key of ['map', 'shadeMultiplyTexture', 'normalMap']) {
        if (material[key]) sharpen(material[key], cap, aniso);
      }
    }
  });
  const chest = vrm.humanoid.getRawBoneNode('chest') || vrm.humanoid.getRawBoneNode('upperChest');
  if (chest) {
    if (opts.charm !== null) {
      const herb = charmOf(opts.charm || 'sprig');
      herb.position.set(0.03, 0.04, -0.1);
      herb.rotation.z = -0.5;
      chest.add(herb);
    }
    if (opts.id === 'lumen') dressLumen(vrm, chest, low);
  }
  if (opts.porcelain) glazePorcelain(vrm);
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
  if (Number.isFinite(height) && height > 0.3 && height < 20) root.scale.multiplyScalar(tall / height);
  root.updateMatrixWorld(true);
  root.position.y -= new THREE.Box3().setFromObject(root).min.y;
  root.userData.fit = root.scale.x;
  shapeBody(vrm, opts.shape || {});
  tuneSprings(vrm, low);
  const manner = MANNER[opts.id] || 'still';
  const idle = buildIdle(vrm, manner);
  let ring = null;
  if (isRareNpc(opts.id)) {
    ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 28),
      new THREE.MeshBasicMaterial({ color: '#f4e6c4', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    ring.name = 'rare-feet';
    root.add(ring);
  }
  const here = new THREE.Vector3();
  const there = new THREE.Vector3();

  const gaze = new THREE.Object3D();
  gaze.name = 'maren-gaze';
  if (vrm.lookAt) vrm.lookAt.target = gaze;
  let mood = 'settled';
  let greetLeft = 0;
  let greeting = false;
  let blinkIn = 2.4;
  let blink = 0;
  let hold = null;
  let detail = low;

  function setDetail(next) {
    detail = !!next;
    const max = detail ? 192 : 0;
    const aniso = detail ? 2 : 16;
    vrm.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const material of [].concat(o.material || [])) {
        if (material.outlineWidthFactor != null) material.outlineWidthFactor = detail ? 0 : 0.0015;
        for (const key of ['map', 'shadeMultiplyTexture', 'normalMap']) {
          if (material[key]) sharpen(material[key], max, aniso);
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
    idle.time = (idle.time + dt) % idle.clip.duration;
    idle.clip.tracks.forEach((track, i) => {
      sampleQuat(track, idle.time, _qout);
      idle.bones[i].quaternion.copy(_qout);
    });
    if (opts.porcelain) {
      const head = vrm.humanoid.getRawBoneNode('head');
      const spine = vrm.humanoid.getRawBoneNode('spine');
      if (head) {
        head.rotateZ(Math.sin(t * 0.55) * 0.09);
        head.rotateX(Math.sin(t * 0.8) * 0.04);
      }
      if (spine) spine.rotateZ(Math.sin(t * 0.45) * 0.025);
      const wisp = vrm.scene.getObjectByName('porcelain-wisp');
      const mote = vrm.scene.getObjectByName('porcelain-mote');
      if (wisp) wisp.position.set(0.2 + Math.sin(t * 0.9) * 0.1, 0.18 + Math.sin(t * 1.5) * 0.06, 0.12 + Math.cos(t * 0.7) * 0.08);
      if (mote) mote.position.set(-0.12 + Math.cos(t * 1.2) * 0.08, 0.28 + Math.sin(t * 1.7) * 0.05, 0.18);
    }
    if (camera) {
      camera.getWorldPosition(gaze.position);
      if (!gaze.parent) camera.parent?.add(gaze) || vrm.scene.parent?.add(gaze);
    }
    const bits = vrm.scene.userData.lumenBits;
    if (bits) bits.forEach((braid, i) => { braid.rotation.x = 0.45 + Math.sin(t * 1.6 + i) * 0.05; });
    if (ring) {
      const eye = camera ? (camera.getWorldPosition(there), root.getWorldPosition(here), here.distanceTo(there)) : 8;
      const near = eye < 2.2 ? 1 : eye > 6.5 ? 0 : 1 - (eye - 2.2) / 4.3;
      ring.material.opacity = near * 0.26;
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

export function createMaren(url, opts) {
  return createCompanion(url, opts);
}
