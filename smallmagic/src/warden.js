// Warden is a preview kit. A shield bash, and a guard that calls beasts in.
import * as THREE from 'three';

export function createWarden({ scene, camera, world, zones, walker }) {
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16),
    new THREE.MeshBasicMaterial({ color: '#d7e4f2', transparent: true, opacity: 0.92 }),
  );
  shield.rotation.x = Math.PI / 2;
  shield.visible = false;
  scene.add(shield);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#c4a574' }));
  shield.add(boss);
  let note = 'Warden preview';
  let guard = 0;
  let bashT = 0;

  function bash() {
    const yaw = walker.yaw;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    walker.place(walker.feet.x + dx * 1.15, walker.feet.z + dz * 1.15, yaw);
    const x = walker.feet.x + dx * 0.8;
    const z = walker.feet.z + dz * 0.8;
    const dmg = guard > 0 ? 26 : 16;
    zones.hurt([{ x, z, r: 1.5, d: dmg, k: 'arcane', kx: dx * 1.8, kz: dz * 1.8 }]);
    zones.shoveBeast?.(x, z, dx, dz, 1.6);
    bashT = 0.28;
    note = guard > 0 ? 'Warden preview · guarded bash' : 'Warden preview · shield bash';
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
      shield.material.opacity = guard > 0 ? 1 : 0.78;
      shield.material.color.set(guard > 0 ? '#fff1c4' : '#d7e4f2');
    }
    const el = document.getElementById('wardenNote');
    if (el) {
      el.hidden = !on;
      if (on) el.textContent = guard > 0 ? `${note} · ${guard.toFixed(1)}s` : note;
    }
  }

  return { bash, raise, update, get note() { return note; }, get guard() { return guard; } };
}
