// Warden is a preview kit. A shield bash, and a guard that calls beasts in.
import * as THREE from 'three';

export function createWarden({ scene, camera, world, zones, walker }) {
  const shield = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.05, 6), new THREE.MeshBasicMaterial({ color: '#d7e4f2' }));
  face.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 6, 6), new THREE.MeshBasicMaterial({ color: '#8a5a32' }));
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#c4a574' }));
  boss.position.z = 0.04;
  shield.add(face, rim, boss);
  shield.visible = false;
  scene.add(shield);
  const cracks = [];
  let note = 'Warden';
  let guard = 0;
  let bashT = 0;

  function crackAt(x, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#2a211c' });
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.7 + (i % 3) * 0.25), mat);
      seg.rotation.y = i * 1.05;
      seg.position.set(Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15);
      g.add(seg);
    }
    g.position.set(x, world.ground(x, z) + 0.04, z);
    scene.add(g);
    cracks.push({ g, life: 4.5 });
  }

  function bash() {
    const yaw = walker.yaw;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    walker.place(walker.feet.x + dx * 1.15, walker.feet.z + dz * 1.15, yaw);
    const x = walker.feet.x + dx * 1.1;
    const z = walker.feet.z + dz * 1.1;
    const dmg = guard > 0 ? 26 : 16;
    zones.hurt([{ x, z, r: 1.8, d: dmg, k: 'arcane', kx: dx * 2.4, kz: dz * 2.4 }]);
    zones.shoveBeast?.(x, z, dx, dz, 3.1);
    crackAt(x, z);
    bashT = 0.28;
    note = guard > 0 ? 'Warden · guarded slam' : 'Warden · shield slam';
  }

  function raise() {
    guard = 4;
    const n = zones.tauntBeasts?.(walker.feet.x, walker.feet.z) || 0;
    note = `Warden preview · guard · taunt ${n}`;
  }

  function update(dt, on) {
    shield.visible = !!on;
    if (!on) { guard = 0; bashT = 0; }
    if (guard > 0) guard = Math.max(0, guard - dt);
    if (bashT > 0) bashT = Math.max(0, bashT - dt);
    if (on) {
      camera.getWorldDirection(shield.userData.dir || (shield.userData.dir = new THREE.Vector3()));
      const dir = shield.userData.dir;
      shield.position.copy(camera.position).addScaledVector(dir, 0.62);
      shield.position.y -= 0.12 + bashT * 0.2;
      shield.lookAt(shield.position.clone().add(dir));
      face.material.color.set(guard > 0 ? '#fff1c4' : '#d7e4f2');
      face.material.opacity = guard > 0 ? 1 : 0.9;
      face.material.transparent = true;
    }
    for (let i = cracks.length - 1; i >= 0; i--) {
      cracks[i].life -= dt;
      cracks[i].g.scale.setScalar(1 + (4.5 - cracks[i].life) * 0.04);
      if (cracks[i].life <= 0) { scene.remove(cracks[i].g); cracks.splice(i, 1); }
    }
    const el = document.getElementById('wardenNote');
    if (el) {
      el.hidden = !on;
      if (on) el.textContent = guard > 0 ? `${note} · ${guard.toFixed(1)}s` : note;
    }
  }

  return { bash, raise, update, get note() { return note; }, get guard() { return guard; } };
}
