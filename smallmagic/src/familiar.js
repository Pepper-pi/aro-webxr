// Original shoulder familiars. No borrowed creatures. Phone keeps the body and drops the dust.
import * as THREE from 'three';

const KEY = 'aro-familiar';

function readKind() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'moth' || v === 'crane' || v === 'wisp') return v;
  } catch { /* first visit */ }
  return 'none';
}

export function createFamiliar(scene) {
  const root = new THREE.Group();
  root.name = 'familiar';
  root.visible = false;
  scene.add(root);
  let kind = readKind();

  const moth = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb047' }));
  body.scale.set(1, 0.72, 1.5);
  const wingMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), wingMat);
  const wingR = wingL.clone();
  wingL.position.set(-0.1, 0.02, 0);
  wingR.position.set(0.1, 0.02, 0);
  moth.scale.setScalar(0.72);
  moth.add(body, wingL, wingR);
  const dust = [];
  for (let i = 0; i < 6; i++) {
    const bit = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffe1a4', transparent: true, opacity: 0.7 }));
    bit.visible = false;
    moth.add(bit);
    dust.push(bit);
  }

  const crane = new THREE.Group();
  const paper = new THREE.MeshBasicMaterial({ color: '#f4efe4', side: THREE.DoubleSide });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), paper);
  const right = left.clone();
  left.position.set(-0.06, 0.02, 0);
  left.rotation.z = 0.5;
  right.position.set(0.06, 0.02, 0);
  right.rotation.z = -0.5;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.015), paper);
  neck.position.set(0.08, 0.05, 0);
  neck.rotation.z = -0.8;
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.012), new THREE.MeshBasicMaterial({ color: '#e7c56a', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ribbon.position.set(-0.02, -0.02, 0);
  crane.add(left, right, neck, ribbon);

  const wisp = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: '#7ee0ff' }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb7d8' }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 18), new THREE.MeshBasicMaterial({ color: '#d7fff6' }));
  wisp.add(orb, core, ring);

  root.add(moth, crane, wisp);
  moth.visible = crane.visible = wisp.visible = false;

  function show(next) {
    kind = next === 'moth' || next === 'crane' || next === 'wisp' ? next : 'none';
    try { localStorage.setItem(KEY, kind); } catch { /* private mode */ }
  }

  function update(dt, walker, where, low, camera) {
    const outdoors = where === 'meadow' || where === 'block' || where === 'deck';
    root.visible = kind !== 'none' && outdoors;
    moth.visible = kind === 'moth';
    crane.visible = kind === 'crane';
    wisp.visible = kind === 'wisp';
    if (!root.visible) return;
    const t = performance.now() * 0.001;
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = fz;
    const rz = -fx;
    const bob = Math.sin(t * 1.7) * 0.05;
    const orbit = t * 0.7;
    root.position.set(
      walker.feet.x + rx * 0.38 + Math.cos(orbit) * 0.16,
      walker.feet.y + 1.42 + bob,
      walker.feet.z + rz * 0.38 + Math.sin(orbit) * 0.16,
    );
    if (camera) root.lookAt(camera.position.x, root.position.y, camera.position.z);
    if (kind === 'moth') {
      const flap = Math.sin(t * 14) * 0.45;
      wingL.rotation.y = 0.85;
      wingR.rotation.y = -0.85;
      wingL.rotation.z = 0.45 + flap;
      wingR.rotation.z = -0.45 - flap;
      dust.forEach((bit, i) => {
        bit.visible = !low;
        if (low) return;
        const u = (t * 0.6 + i / dust.length) % 1;
        bit.position.set(-rx * u * 0.35, -0.02 - u * 0.08, -rz * u * 0.35);
        bit.material.opacity = (1 - u) * 0.7;
      });
    } else if (kind === 'crane') {
      ribbon.material.color.set(t % 2 < 1 ? '#e7c56a' : '#d7c4ff');
      ribbon.rotation.z = Math.sin(t * 1.4) * 0.4;
    } else if (kind === 'wisp') {
      ring.rotation.x = t * 1.2;
      ring.rotation.y = t * 0.8;
      orb.material.color.setHSL(0.52 + Math.sin(t) * 0.04, 0.7, 0.7);
    }
    void dt;
  }

  return { show, update, get kind() { return kind; } };
}
