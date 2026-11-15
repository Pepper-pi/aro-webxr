// A single blaster and one grenade. The grenade follows the thrown ball in three.js
// examples/games_fps.html (MIT): a velocity along the look, gravity of 30, and the
// same ground reflection. The blaster taps toward the nearest beast still in view.
import * as THREE from 'three';

const GRAVITY = 30;
const GRENADE_R = 2.2;
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
  const flashGeo = new THREE.SphereGeometry(1, 10, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.9 });
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  const boomMat = new THREE.MeshBasicMaterial({ color: '#ffb15a', transparent: true, opacity: 0.5, depthWrite: false });
  const flashes = [];

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
    const muzzle = new THREE.Mesh(flashGeo, flashMat.clone());
    muzzle.scale.setScalar(0.16);
    muzzle.position.copy(camera.position).addScaledVector(dir, 0.45);
    scene.add(muzzle);
    flashes.push({ mesh: muzzle, life: 0.08, max: 0.08 });
    bolts.push({ mesh, velocity: dir.clone().multiplyScalar(32), life: 0.9 });
  }

  function explode(n) {
    if (n.boom) return;
    n.boom = true;
    const visual = GRENADE_R;
    const damage = visual;
    if (Math.abs(damage - visual) > 1e-3) console.warn('grenade damage radius does not match the visible blast', { damage, visual });
    const ball = new THREE.Mesh(flashGeo, boomMat.clone());
    ball.scale.setScalar(visual);
    ball.position.copy(n.mesh.position);
    scene.add(ball);
    flashes.push({ mesh: ball, life: 0.35, max: 0.35 });
    zones.hurt([{ x: n.mesh.position.x, z: n.mesh.position.z, r: damage, d: 16, k: 'fire', radial: 1.8, falloff: true, exact: true }]);
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
    nades.push({ mesh, velocity, life: 1.35, age: 0, boom: false });
  }

  function update(dt, active) {
    const bar = document.getElementById('gun');
    const cross = document.getElementById('cross');
    if (bar) bar.hidden = !active;
    if (cross) cross.hidden = !active;
    if (!active) return;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      const hit = zones.beasts().find((beast) => !beast.dead && Math.hypot(beast.x - b.mesh.position.x, beast.z - b.mesh.position.z) < 1.15 && Math.abs(beast.y + 0.7 - b.mesh.position.y) < 1.5);
      if (hit) {
        zones.hurt([{ x: hit.x, z: hit.z, r: 1.2, d: 10, k: 'arcane' }]);
        const spark = new THREE.Mesh(flashGeo, sparkMat);
        spark.scale.setScalar(0.35);
        spark.position.set(hit.x, hit.y + 0.7, hit.z);
        scene.add(spark);
        flashes.push({ mesh: spark, life: 0.22, max: 0.22 });
      }
      if (hit || b.life <= 0) { scene.remove(b.mesh); bolts.splice(i, 1); }
    }
    for (let i = nades.length - 1; i >= 0; i--) {
      const n = nades[i];
      n.life -= dt;
      n.age += dt;
      n.mesh.position.addScaledVector(n.velocity, dt);
      const gy = world.ground(n.mesh.position.x, n.mesh.position.z) + 0.22;
      let bounced = false;
      if (n.mesh.position.y < gy) {
        n.mesh.position.y = gy;
        n.velocity.addScaledVector(up, -up.dot(n.velocity) * 1.5);
        const damping = Math.exp(-1.5 * dt) - 1;
        n.velocity.addScaledVector(n.velocity, damping);
        bounced = true;
      } else {
        n.velocity.y -= GRAVITY * dt;
      }
      if (!n.boom && (bounced || n.age >= 1.35)) explode(n);
      if (n.life <= 0) { scene.remove(n.mesh); nades.splice(i, 1); }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= dt;
      f.mesh.material.opacity = Math.max(0, f.life / f.max);
      if (f.life <= 0) { scene.remove(f.mesh); flashes.splice(i, 1); }
    }
  }

  return { fire, toss, update };
}
