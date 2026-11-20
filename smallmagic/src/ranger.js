// Ranger is a preview kit. A short bow and a sidestep. Not a finished class.
import * as THREE from 'three';

export function createRanger({ scene, camera, world, zones, walker }) {
  const bow = new THREE.Group();
  const wood = new THREE.MeshBasicMaterial({ color: '#8a5a32' });
  const limb = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 18, Math.PI), wood);
  limb.rotation.z = Math.PI;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), new THREE.MeshBasicMaterial({ color: '#f3e6d0' }));
  bow.add(limb, string);
  bow.visible = false;
  scene.add(bow);
  const shots = [];
  const geo = new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5);
  const mat = new THREE.MeshBasicMaterial({ color: '#e7c56a' });
  let note = '';

  function shoot() {
    if (!bow.visible) return;
    camera.getWorldDirection(bow.userData.dir || (bow.userData.dir = new THREE.Vector3()));
    const dir = bow.userData.dir;
    const arrow = new THREE.Mesh(geo, mat);
    arrow.position.copy(camera.position).addScaledVector(dir, 0.8);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    scene.add(arrow);
    shots.push({ mesh: arrow, v: dir.clone().multiplyScalar(18), life: 0.7 });
    note = 'Ranger preview · shot';
  }

  function dodge() {
    const yaw = walker.yaw;
    const side = Math.random() < 0.5 ? 1 : -1;
    walker.place(walker.feet.x + Math.cos(yaw) * 1.7 * side, walker.feet.z - Math.sin(yaw) * 1.7 * side, yaw);
    note = 'Ranger preview · dodge';
  }

  function update(dt, on) {
    bow.visible = !!on;
    if (on) {
      camera.getWorldDirection(bow.userData.dir || (bow.userData.dir = new THREE.Vector3()));
      const dir = bow.userData.dir;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      bow.position.copy(camera.position).addScaledVector(dir, 0.55).addScaledVector(right, 0.22);
      bow.position.y -= 0.15;
      bow.lookAt(bow.position.clone().add(dir));
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.v, dt);
      const gy = world.ground(s.mesh.position.x, s.mesh.position.z) + 0.4;
      if (s.mesh.position.y < gy) s.life = 0;
      const beast = zones.beasts().find((b) => !b.dead && Math.hypot(b.x - s.mesh.position.x, b.z - s.mesh.position.z) < 1.2);
      if (beast) {
        zones.hurt([{ x: beast.x, z: beast.z, r: 1.2, d: 14, k: 'arcane' }]);
        s.life = 0;
        note = 'Ranger preview · hit';
      }
      if (s.life <= 0) {
        scene.remove(s.mesh);
        shots.splice(i, 1);
      }
    }
    const el = document.getElementById('rangerNote');
    if (el) {
      el.hidden = !on;
      if (on && note) el.textContent = note;
    }
  }

  return { shoot, dodge, update, get note() { return note; } };
}
