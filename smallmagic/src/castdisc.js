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
  g.font = '700 22px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const word = spell.name.split(' ')[0].slice(0, 6).toUpperCase();
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
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.42, 8), skin);
  fore.rotation.x = Math.PI / 2;
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skin);
  fist.position.z = -0.24;
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
  const coils = [0, 1, 2].map((i) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 6, 18), ringMat('#ff7a1c', 0.9));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.z = -0.02 - i * 0.11;
    arm.add(mesh);
    return mesh;
  });
  const embers = [];
  for (let i = 0; i < 6; i++) {
    const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), ringMat('#ff7a1c', 0.95));
    ember.position.set(i % 2 ? 0.03 : -0.03, 0.02, -0.02 - i * 0.038);
    arm.add(ember);
    embers.push(ember);
  }
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 5, 16, Math.PI * 1.5), ringMat('#ffb15a', 0.85));
  ribbon.rotation.y = Math.PI / 2;
  ribbon.position.z = -0.12;
  arm.add(ribbon);
  const crystals = [];
  for (let i = 0; i < 5; i++) {
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4), ringMat('#d8f6ff', 0.9));
    crystal.position.set(i % 2 ? 0.028 : -0.028, 0.012, -0.04 - i * 0.04);
    crystal.rotation.z = i % 2 ? 0.7 : -0.7;
    arm.add(crystal);
    crystals.push(crystal);
  }
  const mist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), ringMat('#bfefff', 0.28));
  mist.position.z = -0.1;
  arm.add(mist);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 6), ringMat('#7a4ad4', 0.9));
  thread.rotation.x = Math.PI / 2;
  thread.position.z = -0.1;
  arm.add(thread);
  const beads = [];
  for (let i = 0; i < 4; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), ringMat(i % 2 ? '#3ddea0' : '#c9a0ff', 0.95));
    bead.position.z = -0.02 - i * 0.07;
    arm.add(bead);
    beads.push(bead);
  }
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
    }
    const reach = Math.max(size.x, size.z) * 0.30;
    const face = 0.07;
    const right = new THREE.Vector3();
    const radial = new THREE.Vector3();
    const front = new THREE.Vector3(0, 1, 0);
    const basis = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const a = i * (TAU / N);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(span * 0.13, span * 0.13),
        new THREE.MeshBasicMaterial({ map: medal(SPELLS[i], false), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      radial.set(Math.sin(a), 0, Math.cos(a));
      right.set(-Math.cos(a), 0, Math.sin(a));
      mesh.position.copy(radial).multiplyScalar(reach);
      mesh.position.y = face;
      mesh.quaternion.setFromRotationMatrix(basis.makeBasis(right, radial, front));
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.userData.hot = medal(SPELLS[i], true);
      mesh.userData.cold = mesh.material.map;
      inner.add(mesh);
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
    update(dt, show, index, walker, camera, held, firstPerson) {
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
      if (firstPerson) {
        const tanV = Math.tan((camera.fov * Math.PI) / 360);
        const dist = (DIAM * innerHeight * 0.5) / (tanV * (innerWidth / 3));
        const d = Math.min(2.0, Math.max(1.05, dist));
        root.position.set(walker.feet.x + fx * d, walker.feet.y + 1.25, walker.feet.z + fz * d);
      } else {
        root.position.set(walker.feet.x + fx * 0.95, walker.feet.y + 1.28, walker.feet.z + fz * 0.95);
      }
      root.lookAt(camera.position);
      sparkT += dt;
      const spin = sparkT;
      outerRing.rotation.z += dt * 0.7;
      midRing.rotation.z -= dt * 1.15;
      innerRing.rotation.z += dt * 1.6;
      ticks.rotation.z -= dt * 0.45;
      const tint = new THREE.Color(SPELLS[index]?.colour || '#f1d9a4');
      outerRing.material.color.copy(tint).lerp(new THREE.Color('#f1d9a4'), 0.45);
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
        mesh.scale.setScalar(on ? 1.28 : 1);
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
      screen.r = ((DIAM * 0.5) / dist) / Math.tan(fov / 2) * (innerHeight * 0.5);
      screen.on = ndc.z < 1;
      const key = SPELLS[index]?.key;
      const fireOn = key === 'fire' || key === 'explosion';
      const frostOn = key === 'frost';
      const siphonOn = key === 'singularity';
      const coilOn = !fireOn && !frostOn && !siphonOn;
      coils.forEach((coil, i) => {
        coil.visible = arm.visible && coilOn;
        coil.material.color.copy(tint);
        coil.scale.setScalar(0.45 + pose * (0.7 + i * 0.15));
        coil.rotation.x += dt * (1.4 + i) * (i % 2 ? -1 : 1);
        coil.material.opacity = 0.35 + pose * 0.6;
      });
      ribbon.visible = arm.visible && fireOn;
      ribbon.material.opacity = 0.35 + pose * 0.55;
      ribbon.rotation.z += dt * 2.2;
      embers.forEach((ember, i) => {
        ember.visible = arm.visible && fireOn;
        const a = sparkT * 3 + i;
        ember.position.x = Math.sin(a) * 0.035;
        ember.position.y = Math.cos(a * 1.3) * 0.03;
        ember.scale.setScalar(0.6 + pose * (0.8 + (i % 3) * 0.25));
      });
      crystals.forEach((crystal, i) => {
        crystal.visible = arm.visible && frostOn;
        crystal.scale.setScalar(0.5 + pose * (0.7 + i * 0.12));
      });
      mist.visible = arm.visible && frostOn;
      mist.material.opacity = 0.12 + pose * 0.4;
      mist.scale.setScalar(0.6 + pose * 1.3);
      thread.visible = arm.visible && siphonOn;
      thread.material.opacity = 0.4 + pose * 0.55;
      thread.scale.set(1, 1, 0.5 + pose);
      beads.forEach((bead, i) => {
        bead.visible = arm.visible && siphonOn;
        bead.position.x = Math.sin(sparkT * 4 + i) * 0.02;
        bead.scale.setScalar(0.6 + pose);
      });
      if (arm.visible) {
        const past = root.position.clone().addScaledVector(fwd, -0.05 + pose * 0.45);
        const from = camera.position.clone().addScaledVector(up, -0.22).addScaledVector(fwd, 0.2);
        arm.position.lerpVectors(from, past, 0.2 + pose * 0.75);
        arm.lookAt(root.position.x + fwd.x * 0.6, root.position.y + fwd.y * 0.6, root.position.z + fwd.z * 0.6);
      }
    },
  };
}
