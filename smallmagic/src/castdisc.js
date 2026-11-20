// The v3 casting disc, stood up as a selection wheel in front of the Mage.
// It faces the camera. The inner ring turns so the spell under the top mark is the one in hand.
// Holding the hole pushes the forearm through it.
import * as THREE from 'three';
import { SPELLS } from './spells.js';

const TAU = Math.PI * 2;
const DIAM = 0.34;
const N = SPELLS.length;

function medal(spell, hot) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 56, 0, TAU);
  g.fillStyle = hot ? spell.colour : 'rgba(18, 12, 28, 0.94)';
  g.fill();
  g.lineWidth = hot ? 10 : 6;
  g.strokeStyle = hot ? '#fff6dc' : spell.colour;
  g.stroke();
  g.fillStyle = hot ? '#1a1020' : spell.colour;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const word = (spell.short || spell.name.split(' ')[0]).toUpperCase();
  g.font = `700 ${word.length > 8 ? 16 : 22}px Georgia, serif`;
  g.fillText(word, 64, 66);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function namePlate(spell) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.font = '600 52px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = spell?.colour || '#fff6dc';
  g.fillText((spell?.name || '').toUpperCase(), 256, 50);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function createCastDisc(scene) {
  const root = new THREE.Group();
  root.name = 'cast-disc';
  root.visible = false;
  scene.add(root);
  const inner = new THREE.Group();
  const holder = new THREE.Group();
  // The mesh is a coin lying in XZ. Tip that face onto -Z after it has been centered, so lookAt shows it to the camera.
  const tilt = new THREE.Group();
  tilt.rotation.x = -Math.PI / 2;
  root.add(tilt);
  tilt.add(holder);
  holder.add(inner);
  const skin = new THREE.MeshBasicMaterial({ color: '#f0c2a0' });
  const arm = new THREE.Group();
  arm.name = 'cast-arm';
  arm.visible = false;
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.82, 10), skin);
  fore.rotation.x = Math.PI / 2;
  fore.position.z = -0.06;
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
  fist.position.z = -0.48;
  arm.add(fore, fist);
  scene.add(arm);
  const mandala = new THREE.Group();
  root.add(mandala);
  const ringMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const rune = (radius, tube, color, opacity) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 56), ringMat(color, opacity));
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const outerRing = rune(0.2, 0.007, '#f1d9a4', 0.85);
  const midRing = rune(0.145, 0.004, '#7ee0ff', 0.7);
  const innerRing = rune(0.09, 0.0035, '#e6c27a', 0.8);
  const ticks = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.004), ringMat('#fff6dc', 0.8));
    const a = (i / 12) * TAU;
    tick.position.set(Math.sin(a) * 0.2, Math.cos(a) * 0.2, -0.01);
    tick.rotation.z = -a;
    ticks.add(tick);
  }
  const sparks = [];
  for (let i = 0; i < 10; i++) {
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), ringMat('#ffd27a', 0.9));
    mandala.add(spark);
    sparks.push(spark);
  }
  mandala.add(outerRing, midRing, innerRing, ticks);
  const along = (t) => -0.46 + t * 0.74;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.1, 1, 14), ringMat('#ff7a1c', 0.45));
  wrap.rotation.x = Math.PI / 2;
  arm.add(wrap);
  const sleeveBands = [0.08, 0.3, 0.52, 0.74, 0.92].map((t) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 20), ringMat('#fff6dc', 0.95));
    band.userData.t = t;
    band.frustumCulled = false;
    arm.add(band);
    return band;
  });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), ringMat('#fff6dc', 0.95));
  palm.position.z = -0.5;
  palm.frustumCulled = false;
  arm.add(palm);
  arm.frustumCulled = false;
  const ribbons = [];
  for (let i = 0; i < 10; i++) {
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.07), ringMat('#ffb15a', 0.95));
    bit.userData.t = i / 9;
    arm.add(bit);
    ribbons.push(bit);
  }
  const fireBands = [0.18, 0.55].map((t) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 18), ringMat('#ffe08a', 0.95));
    band.rotation.y = Math.PI / 2;
    band.userData.t = t;
    arm.add(band);
    return band;
  });
  const embers = [];
  for (let i = 0; i < 8; i++) {
    const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), ringMat('#ff7a1c', 0.95));
    ember.userData.t = i / 7;
    arm.add(ember);
    embers.push(ember);
  }
  const plates = [];
  for (let i = 0; i < 7; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.02), ringMat('#d8f6ff', 0.9));
    plate.userData.t = i / 6;
    arm.add(plate);
    plates.push(plate);
  }
  const mists = [0.15, 0.5, 0.82].map((t) => {
    const mist = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), ringMat('#c9b6ff', 0.22));
    mist.userData.t = t;
    arm.add(mist);
    return mist;
  });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.074, 1, 10), ringMat('#bfefff', 0.22));
  sleeve.rotation.x = Math.PI / 2;
  arm.add(sleeve);
  const helices = [0.12, 0.4, 0.68, 0.9].map((t) => {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 18), ringMat('#dffff0', 0.9));
    coil.rotation.y = Math.PI / 2;
    coil.userData.t = t;
    arm.add(coil);
    return coil;
  });
  const tethers = [0.1, 0.38, 0.66, 0.9].map((t, i) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.009, 6, 16), ringMat(i % 2 ? '#3ddea0' : '#b388ff', 0.92));
    band.rotation.y = Math.PI / 2;
    band.userData.t = t;
    arm.add(band);
    return band;
  });
  const leaves = [0.18, 0.42, 0.66, 0.88].map((t, i) => {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), ringMat('#7dff5a', 0.9));
    leaf.userData.t = t;
    leaf.position.set(i % 2 ? 0.06 : -0.06, 0.02, along(t));
    leaf.rotation.z = i % 2 ? 0.6 : -0.6;
    arm.add(leaf);
    return leaf;
  });
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), ringMat('#7a4ad4', 0.9));
  thread.rotation.x = Math.PI / 2;
  arm.add(thread);
  const charge = new THREE.Mesh(
    new THREE.RingGeometry(0.045, 0.11, 40),
    new THREE.MeshBasicMaterial({ color: '#ff7a1c', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  charge.position.z = -0.03;
  charge.visible = false;
  charge.renderOrder = 3;
  root.add(charge);
  const mark = new THREE.Mesh(
    new THREE.ConeGeometry(0.028, 0.05, 3),
    new THREE.MeshBasicMaterial({ color: '#ffe7a4' }),
  );
  mark.rotation.z = Math.PI;
  mark.position.set(0, DIAM * 0.46, -0.04);
  root.add(mark);
  const name = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.056),
    new THREE.MeshBasicMaterial({ map: namePlate(SPELLS[0]), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  name.position.set(0, DIAM * 0.62, -0.04);
  name.renderOrder = 4;
  root.add(name);
  const icons = [];
  let iconReach = 0.6;
  const upright = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
  ));
  let ready = false;
  let shown = 0;
  let sparkT = 0;
  let armLinger = 0;
  let armShown = 0;
  let named = -1;
  const screen = { x: 0, y: 0, r: 48, on: false };
  const muzzle = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
    const gltf = await new GLTFLoader().loadAsync(new URL('casting-disc-v3.glb', document.baseURI).href);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 0.01);
    const k = DIAM / span;
    holder.scale.setScalar(k);
    const mid = box.getCenter(new THREE.Vector3());
    holder.position.set(-mid.x * k, -mid.y * k, -mid.z * k);
    gltf.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const color = src.color ? src.color.clone() : new THREE.Color('#e6c27a');
      const emit = src.emissive ? src.emissive.clone() : new THREE.Color(0);
      color.multiplyScalar(1.35).add(emit.multiplyScalar(2));
      o.material = new THREE.MeshBasicMaterial({
        color, transparent: !!src.transparent, opacity: src.opacity == null ? 1 : src.opacity, side: THREE.DoubleSide,
      });
      o.frustumCulled = false;
    });
    for (const child of [...gltf.scene.children]) {
      const n = child.name || '';
      if (/^rim_outer|^hub_|^preview_glass/.test(n)) holder.add(child);
      else inner.add(child);
      if (/^slot_/.test(n)) child.visible = false;
    }
    iconReach = Math.max(size.x, size.z) * 0.30;
    const face = 0.07;
    const radial = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = i * (TAU / N);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(span * 0.13, span * 0.13),
        new THREE.MeshBasicMaterial({ map: medal(SPELLS[i], false), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      radial.set(Math.sin(a), 0, Math.cos(a));
      mesh.position.copy(radial).multiplyScalar(iconReach);
      mesh.position.y = face;
      mesh.quaternion.copy(upright);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.userData.hot = medal(SPELLS[i], true);
      mesh.userData.cold = mesh.material.map;
      mesh.userData.slot = i;
      holder.add(mesh);
      icons.push(mesh);
    }
    ready = true;
  }).catch(() => { ready = false; });
  return {
    root, screen, muzzle,
    get ready() { return ready; },
    /**
     * First person: on the view, a little under the crosshair, sized to about a third of the screen.
     * Otherwise: upright at the caster's chest, a short step in front. Always face-on to the camera.
     */
    update(dt, show, index, walker, camera, held, firstPerson, wrist, warm, hand) {
      if (held > 0.02) { armShown = held; armLinger = 0.28; }
      else armLinger = Math.max(0, armLinger - dt);
      const pose = held > 0.02 ? held : armShown * (armLinger / 0.28);
      root.visible = !!(show && ready);
      arm.visible = !!(root.visible && firstPerson && pose > 0.02);
      charge.visible = !!(root.visible && pose > 0.02);
      screen.on = root.visible;
      if (!root.visible || !walker || !camera) return;
      camera.getWorldDirection(fwd);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      const yaw = walker.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      // AR and the camera hand hold a 33 cm wheel half a metre out, so the hole is fist-sized.
      // In the world the same wheel is smaller, about the width of the chest.
      const diam = hand ? 0.33 : 0.22;
      const reach = hand ? 0.5 : (firstPerson ? 0.62 : 0.55);
      root.scale.setScalar(diam / DIAM);
      if (hand) {
        camera.getWorldDirection(fwd);
        root.position.copy(camera.position).addScaledVector(fwd, 0.5);
        root.position.y -= 0.06;
      } else {
        root.position.set(walker.feet.x + fx * reach, walker.feet.y + 1.22, walker.feet.z + fz * reach);
      }
      root.lookAt(camera.position);
      sparkT += dt;
      const spin = sparkT;
      outerRing.rotation.z += dt * 0.7;
      midRing.rotation.z -= dt * 1.15;
      innerRing.rotation.z += dt * 1.6;
      ticks.rotation.z -= dt * 0.45;
      const tint = new THREE.Color(SPELLS[index]?.colour || '#f1d9a4');
      if (warm) tint.lerp(new THREE.Color('#ffd7a8'), 0.4);
      outerRing.material.color.copy(tint).lerp(new THREE.Color(warm ? '#ffd2a2' : '#f1d9a4'), 0.45);
      sparks.forEach((spark, i) => {
        const a = spin * (1.2 + i * 0.07) + i;
        const rad = 0.1 + (i % 3) * 0.035;
        spark.position.set(Math.sin(a) * rad, Math.cos(a) * rad, -0.02);
        spark.material.color.copy(tint);
        spark.visible = root.visible;
      });
      const want = -index * (TAU / N);
      shown += (want - shown) * Math.min(1, dt * 10);
      inner.rotation.y = shown;
      for (let i = 0; i < icons.length; i++) {
        const on = i === index;
        const mesh = icons[i];
        const a = i * (TAU / N) + shown;
        mesh.position.set(Math.sin(a) * iconReach, 0.07, Math.cos(a) * iconReach);
        mesh.quaternion.copy(upright);
        mesh.scale.setScalar(hand ? (on ? 2.5 : 2.05) : (on ? 1.35 : 1));
        if (mesh.material.map !== (on ? mesh.userData.hot : mesh.userData.cold)) mesh.material.map = on ? mesh.userData.hot : mesh.userData.cold;
      }
      if (named !== index) {
        named = index;
        name.material.map?.dispose();
        name.material.map = namePlate(SPELLS[index]);
        charge.material.color.set(SPELLS[index]?.colour || '#ff7a1c');
      }
      const fill = Math.max(0, Math.min(1, pose));
      charge.scale.setScalar(0.55 + fill * 1.7);
      charge.material.opacity = 0.35 + fill * 0.6;
      muzzle.copy(root.position).addScaledVector(fwd, 0.08);
      ndc.copy(root.position).project(camera);
      screen.x = (ndc.x * 0.5 + 0.5) * innerWidth;
      screen.y = (-ndc.y * 0.5 + 0.5) * innerHeight;
      const dist = Math.max(0.35, camera.position.distanceTo(root.position));
      const fov = (camera.fov * Math.PI) / 180;
      screen.r = ((diam * 0.5) / dist) / Math.tan(fov / 2) * (innerHeight * 0.5);
      screen.hole = hand ? 0.46 : 0.36;
      screen.grab = hand ? 1.45 : 1.2;
      screen.hand = !!hand;
      screen.on = ndc.z < 1;
      const key = SPELLS[index]?.key;
      const fireOn = key === 'fire' || key === 'explosion';
      const frostOn = key === 'frost';
      const windOn = key === 'wind' || key === 'tornado';
      const siphonOn = key === 'singularity';
      const growthOn = key === 'growth';
      const lit = (t) => pose >= t * 0.92;
      const tier = pose > 0.72 ? 3 : pose > 0.38 ? 2 : 1;
      const fat = tier === 3 ? 0.85 : tier === 2 ? 0.7 : 0.5;
      wrap.visible = arm.visible && fireOn;
      wrap.material.color.copy(tint);
      wrap.material.opacity = key === 'explosion' ? 0.45 + pose * 0.3 : 0.2 + pose * 0.22;
      wrap.scale.set(key === 'explosion' ? fat * 1.25 : fat, Math.max(0.1, pose * (tier === 1 ? 0.62 : 1)), key === 'explosion' ? fat * 1.25 : fat);
      wrap.position.z = -0.46 + wrap.scale.y * 0.5;
      palm.visible = arm.visible && pose > 0.08;
      palm.material.color.set(frostOn ? '#e7fbff' : growthOn ? '#b6ff9a' : windOn ? '#e9fff6' : siphonOn ? '#c9a6ff' : '#fff1c4');
      palm.scale.setScalar(0.28 + pose * (tier === 3 ? 0.4 : 0.18));
      sleeveBands.forEach((band, i) => {
        const show = arm.visible && fireOn && lit(band.userData.t);
        band.visible = show;
        band.position.set(0, 0, along(band.userData.t));
        band.material.color.set(key === 'explosion' ? '#ff4a1c' : '#ffb15a');
        band.rotation.z = sparkT * 0.8 + i * 0.9;
        band.scale.setScalar(show ? 0.85 + (tier - 1) * 0.12 : 1);
      });
      ribbons.forEach((bit, i) => {
        const t = bit.userData.t;
        bit.visible = false;
        const a = sparkT * 3.2 + t * 8;
        bit.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, along(t));
        bit.rotation.z = a;
        bit.scale.setScalar(bit.visible ? 0.12 + pose * 0.06 : 1);
      });
      fireBands.forEach((band) => {
        band.visible = arm.visible && fireOn && lit(band.userData.t);
        band.position.z = along(band.userData.t);
        band.rotation.z += dt * 1.4;
        band.scale.setScalar(0.85 + pose * 0.35);
      });
      embers.forEach((ember, i) => {
        const climb = (sparkT * 0.45 + ember.userData.t) % 1;
        ember.visible = arm.visible && fireOn && lit(climb);
        const a = sparkT * 4 + i;
        ember.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, along(climb));
        ember.scale.setScalar(0.6 + (1 - climb) * pose);
      });
      plates.forEach((plate, i) => {
        const t = plate.userData.t;
        plate.visible = arm.visible && frostOn && lit(t);
        plate.position.set((i % 2 ? 0.045 : -0.045), 0.02, along(t));
        plate.rotation.z = i % 2 ? 0.5 : -0.5;
        plate.scale.setScalar(plate.visible ? 0.45 + pose * (0.5 + t) : 1);
      });
      mists.forEach((mist) => {
        mist.visible = arm.visible && frostOn && lit(mist.userData.t);
        mist.position.z = along(mist.userData.t);
        mist.material.opacity = 0.1 + pose * 0.28;
        mist.scale.setScalar(0.5 + pose * 1.1);
      });
      sleeve.visible = arm.visible && frostOn && pose > 0.05;
      sleeve.scale.y = Math.max(0.05, pose * 0.78);
      sleeve.position.z = -0.46 + sleeve.scale.y * 0.5;
      sleeve.material.opacity = 0.12 + pose * 0.28;
      helices.forEach((coil, i) => {
        coil.visible = arm.visible && windOn && lit(coil.userData.t);
        coil.position.z = along(coil.userData.t);
        coil.rotation.x += dt * (1.6 + i * 0.35) * (i % 2 ? -1 : 1);
        coil.material.color.copy(tint);
        coil.scale.setScalar(0.7 + pose * 0.55);
      });
      tethers.forEach((band, i) => {
        band.visible = arm.visible && siphonOn && lit(band.userData.t);
        band.position.z = along(band.userData.t);
        const pulse = 0.85 + Math.sin(sparkT * 5 + i) * 0.12;
        band.scale.setScalar(pulse * (0.7 + pose * 0.5));
      });
      leaves.forEach((leaf) => {
        leaf.visible = arm.visible && growthOn && lit(leaf.userData.t);
        leaf.material.opacity = 0.7 + pose * 0.25;
      });
      thread.visible = arm.visible && siphonOn;
      thread.scale.y = Math.max(0.05, pose * 0.78);
      thread.position.z = -0.46 + thread.scale.y * 0.5;
      thread.material.opacity = 0.35 + pose * 0.55;
      if (arm.visible) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const elbow = wrist
          ? wrist.clone()
          : camera.position.clone().addScaledVector(right, 0.72).addScaledVector(up, -0.55).addScaledVector(fwd, 0.95);
        const hand = camera.position.clone().addScaledVector(right, 0.38).addScaledVector(up, -0.36).addScaledVector(fwd, 1.12);
        arm.position.copy(elbow);
        arm.lookAt(hand.x, hand.y, hand.z);
      }
    },
  };
}
