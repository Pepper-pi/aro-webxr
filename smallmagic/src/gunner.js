// A single blaster and one grenade. The grenade follows the thrown ball in three.js
// examples/games_fps.html (MIT): a velocity along the look, gravity of 30, and the
// same ground reflection. The blaster taps toward the nearest beast still in view.
import * as THREE from 'three';

const GRAVITY = 30;
const GRENADE_R = 2.2;
const dir = new THREE.Vector3();
const to = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

export function createGunner(scene, camera, world, zones, fire) {
  const gun = new THREE.Group();
  const steel = new THREE.MeshBasicMaterial({ color: '#d5dee6' });
  const dark = new THREE.MeshBasicMaterial({ color: '#2c343c' });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.42, 8), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, -0.16, -0.48);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.22), dark);
  body.position.set(0.16, -0.2, -0.34);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: '#6b3a22' }));
  grip.position.set(0.16, -0.28, -0.28);
  grip.rotation.x = 0.4;
  gun.add(barrel, body, grip);
  gun.scale.setScalar(1.45);
  gun.visible = false;
  gun.traverse((o) => { o.frustumCulled = false; });
  scene.add(gun);
  let ammo = 8;
  let reload = 0;
  let armed = 0;
  let markT = 0;
  let rollT = 0;
  let rollDir = 1;
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

  function arm() { armed = performance.now(); }
  function release() {
    const held = armed ? (performance.now() - armed) / 1000 : 0;
    armed = 0;
    fire(held > 0.45);
  }
  function fire(charged) {
    if (reload > 0) return;
    const cost = charged ? 2 : 1;
    if (ammo < cost) { reload = 1.15; return; }
    ammo -= cost;
    assist();
    const mat = new THREE.MeshBasicMaterial({ color: charged ? '#ffd27a' : '#7ef0ff' });
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const from = camera.position.clone().addScaledVector(right, 0.2).addScaledVector(up, -0.14).addScaledVector(dir, 0.45);
    const to = camera.position.clone().addScaledVector(dir, charged ? 4.4 : 3.4);
    const span = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(charged ? 0.055 : 0.03, charged ? 0.02 : 0.012, span.length(), 6), mat);
    mesh.position.copy(from).addScaledVector(span, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize());
    scene.add(mesh);
    const muzzle = new THREE.Mesh(flashGeo, flashMat.clone());
    muzzle.scale.setScalar(charged ? 0.04 : 0.028);
    muzzle.position.copy(from);
    scene.add(muzzle);
    flashes.push({ mesh: muzzle, life: 0.22, max: 0.22 });
    bolts.push({ mesh, velocity: dir.clone().multiplyScalar(charged ? 14 : 20), life: 0.9, dmg: charged ? 22 : 10, charged });
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
    n.life = Math.min(n.life, 0.2);
    zones.hurt([{ x: n.mesh.position.x, z: n.mesh.position.z, r: damage, d: 16, k: 'fire', radial: 1.8, falloff: true, exact: true }]);
  }

  function underCrosshair() {
    camera.getWorldDirection(dir);
    let best = null;
    let bestDot = 0.82;
    const eye = camera.position;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      to.set(b.x - eye.x, b.y + 0.5 - eye.y, b.z - eye.z);
      const len = to.length() || 1;
      const dot = to.dot(dir) / len;
      if (dot > bestDot) { bestDot = dot; best = b; }
    }
    return best;
  }

  function toss() {
    if (nades.some((n) => n.life > 0)) return;
    const mesh = new THREE.Mesh(nadeGeo, nadeMat);
    camera.getWorldDirection(dir);
    mesh.position.copy(camera.position).addScaledVector(dir, 0.8);
    mesh.position.y += 0.1;
    const beast = underCrosshair();
    let velocity;
    if (!beast) {
      velocity = dir.clone().multiplyScalar(9);
      velocity.y += 4.5;
    } else {
      const cap = 12;
      let tx = beast.x;
      let tz = beast.z;
      const dx = tx - mesh.position.x;
      const dz = tz - mesh.position.z;
      const horiz = Math.hypot(dx, dz) || 1;
      if (horiz > cap) { tx = mesh.position.x + dx / horiz * cap; tz = mesh.position.z + dz / horiz * cap; }
      const ty = world.ground(tx, tz) + 0.3;
      const span = Math.hypot(tx - mesh.position.x, tz - mesh.position.z);
      const flight = Math.min(1.15, Math.max(0.5, span / 8));
      velocity = new THREE.Vector3((tx - mesh.position.x) / flight, (ty - mesh.position.y + 0.5 * GRAVITY * flight * flight) / flight, (tz - mesh.position.z) / flight);
    }
    scene.add(mesh);
    nades.push({ mesh, velocity, life: 2.4, age: 0, boom: false });
  }

  function update(dt, active) {
    const bar = document.getElementById('gun');
    const cross = document.getElementById('cross');
    if (bar) bar.hidden = !active;
    if (cross) cross.hidden = !active;
    gun.visible = !!active;
    const ammoEl = document.getElementById('gunAmmo');
    if (ammoEl) ammoEl.textContent = reload > 0 ? 'REL' : String(ammo);
    if (!active) return;
    if (gun.visible) {
      gun.position.copy(camera.position);
      gun.quaternion.copy(camera.quaternion);
    }
    if (reload > 0) { reload -= dt; if (reload <= 0) { reload = 0; ammo = 8; } }
    const hitEl = document.getElementById('hitmark');
    if (markT > 0) { markT -= dt; if (hitEl) hitEl.hidden = false; }
    else if (hitEl) hitEl.hidden = true;
    if (rollT > 0) rollT -= dt;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.velocity.clone().normalize());
      const hit = zones.beasts().find((beast) => !beast.dead && Math.hypot(beast.x - b.mesh.position.x, beast.z - b.mesh.position.z) < 1.15 && Math.abs(beast.y + 0.7 - b.mesh.position.y) < 1.5);
      if (hit) {
        zones.hurt([{ x: hit.x, z: hit.z, r: 1.2, d: b.dmg || 10, k: b.charged ? 'fire' : 'arcane', burn: b.charged ? 2.2 : 0, kx: b.charged ? b.velocity.x * 0.1 : 0, kz: b.charged ? b.velocity.z * 0.1 : 0 }]);
        const spark = new THREE.Mesh(flashGeo, sparkMat);
        spark.scale.setScalar(0.35);
        spark.position.set(hit.x, hit.y + 0.7, hit.z);
        scene.add(spark);
        flashes.push({ mesh: spark, life: 0.22, max: 0.22 });
        markT = 0.45;
      }
      if (hit || b.life <= 0) {
        const x = b.mesh.position.x;
        const z = b.mesh.position.z;
        const gy = world.ground(x, z) + 0.05;
        const pock = new THREE.Mesh(
          new THREE.CircleGeometry(b.charged ? 1.15 : 0.38, 14),
          new THREE.MeshBasicMaterial({ color: b.charged ? '#4a2414' : '#2a2118', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
        );
        pock.rotation.x = -Math.PI / 2;
        pock.position.set(x, gy, z);
        scene.add(pock);
        flashes.push({ mesh: pock, life: b.charged ? 3.2 : 1.4, max: b.charged ? 3.2 : 1.4 });
        if (b.charged) {
          fire?.ignite(x, z, 1.5, 0.55);
          world.mark?.(x, z, 1.5, 0, 0.55);
          zones.shoveBeast?.(x, z, b.velocity.x, b.velocity.z, 2.4);
        } else world.mark?.(x, z, 0.55, 0, 0.35);
        scene.remove(b.mesh);
        bolts.splice(i, 1);
      }
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

  function roll(dir = 1) { rollT = 0.34; rollDir = dir < 0 ? -1 : 1; }
  return { fire, arm, release, toss, roll, update, get ammo() { return ammo; }, get lean() { return rollT > 0 ? rollDir * Math.sin((1 - rollT / 0.34) * Math.PI) * 0.85 : 0; } };
}
