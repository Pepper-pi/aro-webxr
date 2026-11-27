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

  function wingShape(hind) {
    const s = new THREE.Shape();
    if (!hind) {
      s.moveTo(0, 0.012);
      s.bezierCurveTo(0.04, 0.07, 0.1, 0.095, 0.145, 0.04);
      s.bezierCurveTo(0.15, 0.02, 0.12, 0.012, 0.105, 0.02);
      s.bezierCurveTo(0.12, 0.0, 0.138, -0.02, 0.12, -0.038);
      s.bezierCurveTo(0.08, -0.008, 0.04, 0.008, 0, 0.012);
    } else {
      s.moveTo(0.01, -0.004);
      s.bezierCurveTo(0.04, -0.03, 0.09, -0.055, 0.105, -0.028);
      s.bezierCurveTo(0.07, -0.01, 0.035, 0.006, 0.01, -0.004);
    }
    return new THREE.ShapeGeometry(s);
  }
  const moth = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: '#ffc56a', side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthWrite: false });
  const tipMat = new THREE.MeshBasicMaterial({ color: '#8a3a22', side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  const fore = new THREE.Mesh(wingShape(false), wingMat);
  const hind = new THREE.Mesh(wingShape(true), wingMat);
  const tip = new THREE.Mesh(new THREE.CircleGeometry(0.018, 6), tipMat);
  tip.position.set(0.125, 0.03, 0.001);
  wingL.add(fore, hind, tip);
  wingR.add(fore.clone(), hind.clone(), tip.clone());
  wingR.scale.x = -1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.07, 6), new THREE.MeshBasicMaterial({ color: '#ffb047' }));
  body.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffe1a4', transparent: true, opacity: 0.85 }));
  glow.position.z = 0.02;
  moth.add(wingL, wingR, body, glow);
  for (const side of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.045, 4), new THREE.MeshBasicMaterial({ color: '#5a3018' }));
    ant.position.set(side * 0.008, 0.02, 0.03);
    ant.rotation.z = side * -0.7;
    ant.rotation.x = 0.4;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.003, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffb047' }));
    knob.position.y = 0.024;
    ant.add(knob);
    moth.add(ant);
  }
  const dust = [];
  for (let i = 0; i < 6; i++) {
    const bit = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffe1a4', transparent: true, opacity: 0.7 }));
    bit.visible = false;
    moth.add(bit);
    dust.push(bit);
  }

  const crane = new THREE.Group();
  crane.scale.setScalar(0.62);
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
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: '#9af0ff', transparent: true, opacity: 0.28, depthWrite: false }));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshBasicMaterial({ color: '#7ee0ff', transparent: true, opacity: 0.9 }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb7d8' }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0035, 6, 20), new THREE.MeshBasicMaterial({ color: '#d7fff6' }));
  wisp.add(shell, orb, core, ring);

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
      walker.feet.x - fx * 0.32 + rx * 0.2 + Math.cos(orbit) * 0.05,
      walker.feet.y + 1.28 + bob,
      walker.feet.z - fz * 0.32 + rz * 0.2 + Math.sin(orbit) * 0.05,
    );
    root.rotation.y = yaw;
    if (kind === 'moth') {
      const flap = Math.sin(t * 12) * 0.35;
      wingL.rotation.z = flap;
      wingR.rotation.z = -flap;
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
