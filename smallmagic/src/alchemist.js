// Alchemist is a preview kit. A thrown splash, and a small heal over time.
import * as THREE from 'three';

export function createAlchemist({ scene, camera, world, zones, walker }) {
  const flask = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.9 }));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 6), new THREE.MeshBasicMaterial({ color: '#e7f6ea' }));
  neck.position.y = 0.14;
  flask.add(glass, neck);
  flask.visible = false;
  scene.add(flask);
  const bottles = [];
  const puddles = [];
  const geo = new THREE.SphereGeometry(0.1, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: '#7dff9a' });
  const puddleGeo = new THREE.CircleGeometry(1.1, 18);
  let note = 'Alchemist preview';
  let hot = 0;
  let tick = 0;

  function toss() {
    camera.getWorldDirection(flask.userData.dir || (flask.userData.dir = new THREE.Vector3()));
    const dir = flask.userData.dir.clone().normalize();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(camera.position).addScaledVector(dir, 0.6);
    scene.add(mesh);
    bottles.push({ mesh, v: dir.multiplyScalar(11), life: 1.1 });
    note = 'Alchemist preview · potion thrown';
  }

  function splash(x, z) {
    const y = world.ground(x, z) + 0.08;
    zones.hurt([{ x, z, r: 2.1, d: 12, k: 'arcane', radial: 1.1, falloff: true }]);
    const ring = new THREE.Mesh(puddleGeo, new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    scene.add(ring);
    world.mark(x, z, 2.2, 3, 0.45);
    puddles.push({ mesh: ring, x, z, life: 8, tick: 0 });
    note = 'Alchemist · puddle';
  }

  function sip() {
    hot = 5;
    tick = 0;
    note = 'Alchemist preview · mend';
  }

  function update(dt, on) {
    flask.visible = !!on;
    if (!on) hot = 0;
    if (on) {
      camera.getWorldDirection(flask.userData.dir || (flask.userData.dir = new THREE.Vector3()));
      const dir = flask.userData.dir;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      flask.position.copy(camera.position).addScaledVector(dir, 0.48).addScaledVector(right, -0.2);
      flask.position.y -= 0.18;
    }
    if (hot > 0) {
      hot = Math.max(0, hot - dt);
      tick += dt;
      if (tick >= 1) {
        tick -= 1;
        const before = zones.hearts;
        zones.heal(4);
        note = zones.hearts > before ? 'Alchemist preview · mend +4' : 'Alchemist preview · mend (full)';
      }
    }
    for (let i = bottles.length - 1; i >= 0; i--) {
      const b = bottles[i];
      b.life -= dt;
      b.v.y -= 12 * dt;
      b.mesh.position.addScaledVector(b.v, dt);
      const gy = world.ground(b.mesh.position.x, b.mesh.position.z) + 0.2;
      if (b.mesh.position.y <= gy || b.life <= 0) {
        splash(b.mesh.position.x, b.mesh.position.z);
        scene.remove(b.mesh);
        bottles.splice(i, 1);
      }
    }
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      p.life -= dt;
      p.tick += dt;
      p.mesh.material.opacity = p.life > 2 ? 0.48 : Math.max(0, p.life / 4);
      p.mesh.scale.setScalar(1 + Math.sin(p.life * 3) * 0.04);
      if (p.tick >= 0.9) {
        p.tick = 0;
        zones.hurt([{ x: p.x, z: p.z, r: 2.1, d: 4, k: 'arcane', status: 'chill', chill: 0.6 }]);
      }
      if (p.life <= 0) {
        scene.remove(p.mesh);
        puddles.splice(i, 1);
      }
    }
    const el = document.getElementById('alchemistNote');
    if (el) {
      el.hidden = !on;
      if (on) el.textContent = hot > 0 ? `${note} · ${hot.toFixed(1)}s` : note;
    }
  }

  return { toss, sip, update, get note() { return note; }, get hot() { return hot; } };
}
