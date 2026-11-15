// A single blaster and one grenade. The grenade follows the thrown ball in three.js
// examples/games_fps.html (MIT): a velocity along the look, gravity of 30, and the
// same ground reflection. The blaster taps toward the nearest beast still in view.
import * as THREE from 'three';

const GRAVITY = 30;
const dir = new THREE.Vector3();
const to = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

export function createGunner(scene, camera, world, zones) {
  const bolts = [];
  const nades = [];
  const boltGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const boltMat = new THREE.MeshBasicMaterial({ color: '#7ef0ff' });
  const nadeGeo = new THREE.IcosahedronGeometry(0.18, 1);
  const nadeMat = new THREE.MeshBasicMaterial({ color: '#dede8d' });

  function assist() {
    camera.getWorldDirection(dir);
    let best = null;
    let bestDot = 0.82;
    const eye = camera.position;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      to.set(b.x - eye.x, b.y + 0.6 - eye.y, b.z - eye.z);
      const len = to.length() || 1;
      to.multiplyScalar(1 / len);
      const dot = to.dot(dir);
      if (dot > bestDot) { bestDot = dot; best = to.clone(); }
    }
    if (best) dir.lerp(best, 0.35).normalize();
  }

  function fire() {
    const mesh = new THREE.Mesh(boltGeo, boltMat);
    mesh.position.copy(camera.position);
    assist();
    scene.add(mesh);
    bolts.push({ mesh, velocity: dir.clone().multiplyScalar(32), life: 0.9 });
  }

  function toss() {
    if (nades.some((n) => n.life > 0)) return;
    const mesh = new THREE.Mesh(nadeGeo, nadeMat);
    camera.getWorldDirection(dir);
    const velocity = dir.clone().multiplyScalar(9);
    velocity.y += 4.5;
    mesh.position.copy(camera.position).addScaledVector(dir, 0.8);
    mesh.position.y += 0.1;
    scene.add(mesh);
    nades.push({ mesh, velocity, life: 2.4, boom: false });
  }

  function update(dt, active) {
    const bar = document.getElementById('gun');
    if (bar) bar.hidden = !active;
    if (!active) return;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      const hit = zones.beasts().find((beast) => !beast.dead && Math.hypot(beast.x - b.mesh.position.x, beast.z - b.mesh.position.z) < 1.15 && Math.abs(beast.y + 0.7 - b.mesh.position.y) < 1.5);
      if (hit) zones.hurt([{ x: hit.x, z: hit.z, r: 1.2, d: 10, k: 'arcane' }]);
      if (hit || b.life <= 0) { scene.remove(b.mesh); bolts.splice(i, 1); }
    }
    for (let i = nades.length - 1; i >= 0; i--) {
      const n = nades[i];
      n.life -= dt;
      n.mesh.position.addScaledVector(n.velocity, dt);
      const gy = world.ground(n.mesh.position.x, n.mesh.position.z) + 0.22;
      const near = zones.beasts().find((beast) => !beast.dead && Math.hypot(beast.x - n.mesh.position.x, beast.z - n.mesh.position.z) < 1.6);
      if (near && !n.boom) {
        n.boom = true;
        zones.hurt([{ x: n.mesh.position.x, z: n.mesh.position.z, r: 3.4, d: 18, k: 'fire', radial: 2.4, falloff: true }]);
      }
      if (n.mesh.position.y < gy) {
        n.mesh.position.y = gy;
        n.velocity.addScaledVector(up, -up.dot(n.velocity) * 1.5);
        const damping = Math.exp(-1.5 * dt) - 1;
        n.velocity.addScaledVector(n.velocity, damping);
        if (!n.boom) {
          n.boom = true;
          zones.hurt([{ x: n.mesh.position.x, z: n.mesh.position.z, r: 3.4, d: 18, k: 'fire', radial: 2.4, falloff: true }]);
        }
      } else {
        n.velocity.y -= GRAVITY * dt;
      }
      if (n.life <= 0) { scene.remove(n.mesh); nades.splice(i, 1); }
    }
  }

  return { fire, toss, update };
}
