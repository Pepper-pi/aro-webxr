// Ranger is a preview kit. Hold to charge a shot, mark a beast, and count the quiver.
import * as THREE from 'three';

const QUIVER = 12;

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
  let note = 'Ranger preview';
  let ammo = QUIVER;
  let holding = false;
  let charge = 0;
  let marked = -1;
  let iframe = 0;
  let refill = 0;

  function nearest() {
    const here = walker.feet;
    let best = null;
    let bestD = 16;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - here.x, b.z - here.z);
      if (d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  function chargeStart() {
    if (!bow.visible) return;
    if (ammo <= 0) { note = 'Ranger preview · quiver empty'; return; }
    holding = true;
    charge = 0;
    note = 'Ranger preview · drawing';
  }

  function shoot(power) {
    if (!bow.visible || ammo <= 0) {
      note = 'Ranger preview · quiver empty';
      holding = false;
      charge = 0;
      return;
    }
    ammo -= 1;
    camera.getWorldDirection(bow.userData.dir || (bow.userData.dir = new THREE.Vector3()));
    const dir = bow.userData.dir.clone().normalize();
    const arrow = new THREE.Mesh(geo, mat);
    arrow.position.copy(camera.position).addScaledVector(dir, 0.8);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    scene.add(arrow);
    const p = Math.max(0.2, Math.min(1, power));
    shots.push({ mesh: arrow, v: dir.multiplyScalar(14 + p * 16), life: 0.85, dmg: Math.round(8 + p * 20), hunt: true });
    const kind = p > 0.72 ? 'power shot' : 'shot';
    note = `Ranger preview · ${kind} · ${ammo} arrows`;
  }

  function chargeRelease() {
    if (!holding) return;
    const power = charge;
    holding = false;
    charge = 0;
    shoot(power);
  }

  function mark() {
    const beast = nearest();
    if (!beast) { note = 'Ranger preview · no mark'; return; }
    marked = beast.n;
    zones.markBeast?.(beast.n);
    note = `Ranger preview · hunter's mark · ${beast.kind}`;
  }

  function dodge() {
    const yaw = walker.yaw;
    const side = Math.random() < 0.5 ? 1 : -1;
    walker.place(walker.feet.x + Math.cos(yaw) * 1.7 * side, walker.feet.z - Math.sin(yaw) * 1.7 * side, yaw);
    iframe = 0.62;
    note = `Ranger preview · dodge · ${ammo} arrows`;
  }

  function restock(n = 6) {
    ammo = Math.min(QUIVER, ammo + n);
    note = `Ranger preview · quiver ${ammo}`;
  }

  function update(dt, on) {
    bow.visible = !!on;
    if (iframe > 0) iframe = Math.max(0, iframe - dt);
    if (on && ammo < QUIVER) {
      refill += dt;
      if (refill >= 5) {
        refill = 0;
        ammo += 1;
        note = `Ranger preview · arrow back · ${ammo}`;
      }
    }
    if (holding && on) charge = Math.min(1, charge + dt / 0.85);
    if (!on) { holding = false; charge = 0; }
    if (on) {
      camera.getWorldDirection(bow.userData.dir || (bow.userData.dir = new THREE.Vector3()));
      const dir = bow.userData.dir;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      bow.position.copy(camera.position).addScaledVector(dir, 0.55).addScaledVector(right, 0.22);
      bow.position.y -= 0.15;
      bow.lookAt(bow.position.clone().add(dir));
      const pull = 0.04 + charge * 0.12;
      string.position.z = -pull;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.v, dt);
      const gy = world.ground(s.mesh.position.x, s.mesh.position.z) + 0.4;
      if (s.mesh.position.y < gy) s.life = 0;
      const beast = zones.beasts().find((b) => !b.dead && Math.hypot(b.x - s.mesh.position.x, b.z - s.mesh.position.z) < 1.2);
      if (beast) {
        const bonus = beast.n === marked;
        zones.hurt([{ x: beast.x, z: beast.z, r: 1.2, d: s.dmg, k: 'arcane', hunt: bonus }]);
        s.life = 0;
        note = `Ranger preview · ${bonus ? 'marked hit' : 'hit'} · ${ammo} arrows`;
      }
      if (s.life <= 0) {
        scene.remove(s.mesh);
        shots.splice(i, 1);
      }
    }
    const el = document.getElementById('rangerNote');
    const ammoEl = document.getElementById('rangerAmmo');
    const bar = document.querySelector('#rangerCharge i');
    if (ammoEl) ammoEl.textContent = `${ammo} / ${QUIVER} arrows`;
    if (bar) bar.style.width = `${Math.round((holding ? charge : 0) * 100)}%`;
    if (el) {
      el.hidden = !on;
      if (on && note) el.textContent = note;
    }
  }

  return {
    chargeStart, chargeRelease, shoot, mark, dodge, restock, update,
    get note() { return note; },
    get ammo() { return ammo; },
    get charge() { return charge; },
    get iframe() { return iframe; },
  };
}
