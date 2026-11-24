// Ranger draws a bow, looses a short volley, leaves a trap arrow, and sends a hawk
// that marks a rare beast's weak spot.
import * as THREE from 'three';

const QUIVER = 12;

export function createRanger({ scene, camera, world, zones, walker, fire, living, ground }) {
  const gy = (x, z) => (ground ? ground(x, z) : world.ground(x, z));
  const bow = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.26, 6), new THREE.MeshBasicMaterial({ color: '#6a3e22' }));
  const limb = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 6, 20, Math.PI), new THREE.MeshBasicMaterial({ color: '#c4a574' }));
  limb.rotation.z = Math.PI;
  limb.position.y = 0.02;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.52, 4), new THREE.MeshBasicMaterial({ color: '#f3e6d0' }));
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshBasicMaterial({ color: '#e7c56a' }));
  gem.position.set(0, 0.02, 0.04);
  bow.add(grip, limb, string, gem);
  bow.visible = false;
  scene.add(bow);
  const hawk = new THREE.Group();
  const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.1), new THREE.MeshBasicMaterial({ color: '#8a5a32', side: THREE.DoubleSide }));
  const wingR = wing.clone();
  wing.position.x = 0.12;
  wingR.position.x = -0.12;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: '#c4a574' }));
  hawk.add(wing, wingR, body);
  hawk.visible = false;
  scene.add(hawk);
  const shots = [];
  const traps = [];
  const geo = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 5);
  let note = 'Ranger';
  let ammo = QUIVER;
  let holding = false;
  let charge = 0;
  let marked = -1;
  let hawkT = 0;
  let hawkAt = null;
  let wound = null;
  const up = new THREE.Vector3(0, 1, 0);
  const aim = new THREE.Vector3();

  function look() {
    camera.getWorldDirection(aim);
    return aim;
  }

  function loose(power, yawOff = 0, kind = 'arrow') {
    if (ammo <= 0) {
      note = 'Ranger · quiver empty';
      return false;
    }
    ammo -= 1;
    const dir = look().clone().normalize();
    if (yawOff) dir.applyAxisAngle(up, yawOff);
    const arrow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: kind === 'trap' ? '#6a8f4a' : '#e7c56a' }));
    arrow.position.copy(camera.position).addScaledVector(dir, 0.7);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    scene.add(arrow);
    const p = Math.max(0.15, Math.min(1, power));
    shots.push({ mesh: arrow, v: dir.multiplyScalar(kind === 'trap' ? 12 : 14 + p * 14), life: 0.9, dmg: kind === 'trap' ? 6 : Math.round(8 + p * 16), kind, p });
    return true;
  }

  function chargeStart() {
    if (ammo <= 0) { note = 'Ranger · quiver empty'; return; }
    holding = true;
    charge = Math.max(charge, 0.05);
    note = 'Ranger · drawing';
  }

  function chargeRelease() {
    if (!holding) return;
    const power = charge;
    holding = false;
    charge = 0;
    if (loose(power, 0, 'arrow')) note = `Ranger · arrow · ${ammo} left`;
  }

  function volley() {
    let n = 0;
    for (const off of [-0.16, 0, 0.16]) if (loose(0.4, off, 'arrow')) n += 1;
    if (n) note = `Ranger · volley ${n} · ${ammo} left`;
  }

  function trap() {
    if (loose(0.5, 0, 'trap')) note = `Ranger · trap arrow · ${ammo} left`;
  }

  function hawkMark() {
    let best = null;
    let bestScore = -1;
    zones.stir?.((b, n) => {
      const d = Math.hypot(b.g.position.x - walker.feet.x, b.g.position.z - walker.feet.z);
      if (d > 22) return;
      const rolled = living?.rollSeeded?.('beast', `${b.kind}:${n}`) || { tier: 'common', shimmer: false };
      const rare = !!(rolled.shimmer || rolled.tier === 'rare' || rolled.tier === 'epic' || rolled.tier === 'mythic');
      const score = (rare ? 12 : 0) + (22 - d);
      if (score > bestScore) { best = { b, n, rolled, rare }; bestScore = score; }
    });
    if (!best) { note = 'Hawk · nothing to mark'; hawk.visible = false; return; }
    marked = best.n;
    zones.markBeast?.(best.n);
    const ring = best.b.g.getObjectByName('hmark');
    if (ring) ring.material.color.set(best.rare ? '#e7c56a' : '#ff5a5a');
    hawkAt = best.b;
    hawkT = 8;
    hawk.visible = true;
    const tier = best.rolled.tier || 'common';
    note = best.rare ? `Hawk · ${tier} ${best.b.kind} · weak spot` : `Hawk · ${best.b.kind} · weak spot`;
    living?.sight?.(best.b.kind, { tier, shimmer: best.rare, where: 'meadow' });
  }

  function stickTrap(x, z) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 16), new THREE.MeshBasicMaterial({ color: '#6a8f4a', side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, gy(x, z) + 0.04, z);
    scene.add(ring);
    traps.push({ mesh: ring, x, z, life: 8 });
  }

  function hit(x, z, dmg, kind) {
    zones.hurt([{ x, z, r: 1.15, d: dmg, k: kind === 'trap' ? 'arcane' : 'fire', hunt: true }]);
    wound?.(Math.max(4, Math.round(dmg * 0.45)), x, z);
    if (kind !== 'trap') fire?.ignite(x, z, 1.1, 0.4);
  }

  function restock(n = 6) {
    ammo = Math.min(QUIVER, ammo + n);
    note = `Ranger · quiver ${ammo}`;
  }

  function update(dt, on) {
    bow.visible = !!on;
    if (on && ammo < QUIVER) {
      bow.userData.refill = (bow.userData.refill || 0) + dt;
      if (bow.userData.refill >= 6) { bow.userData.refill = 0; ammo += 1; }
    }
    if (holding && on) charge = Math.min(1, charge + dt / 0.85);
    if (!on) { holding = false; charge = 0; }
    if (on) {
      const dir = look();
      const right = new THREE.Vector3().crossVectors(dir, up);
      if (right.lengthSq() > 1e-6) right.normalize();
      bow.position.copy(camera.position).addScaledVector(dir, 0.55).addScaledVector(right, 0.22);
      bow.position.y -= 0.15;
      bow.lookAt(bow.position.clone().add(dir));
      string.position.z = -0.04 - charge * 0.12;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.v, dt);
      const y = gy(s.mesh.position.x, s.mesh.position.z) + 0.35;
      let beast = null;
      zones.stir?.((b) => { if (Math.hypot(b.g.position.x - s.mesh.position.x, b.g.position.z - s.mesh.position.z) < 1.05) beast = b; });
      if (beast || s.mesh.position.y < y || s.life <= 0) {
        const x = s.mesh.position.x;
        const z = s.mesh.position.z;
        if (s.kind === 'trap') stickTrap(x, z);
        else hit(x, z, s.dmg, s.kind);
        scene.remove(s.mesh);
        shots.splice(i, 1);
      }
    }
    for (let i = traps.length - 1; i >= 0; i--) {
      const t = traps[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 8);
      zones.stir?.((b) => {
        if (Math.hypot(b.g.position.x - t.x, b.g.position.z - t.z) < 1.15) {
          b.rooted = 0.5;
          if (!t.nipped) { t.nipped = true; hit(t.x, t.z, 8, 'trap'); note = 'Ranger · trap takes'; }
        }
      });
      if (t.life <= 0) { scene.remove(t.mesh); traps.splice(i, 1); }
    }
    if (hawkT > 0) hawkT = Math.max(0, hawkT - dt);
    hawk.visible = on && hawkT > 0 && !!hawkAt?.g;
    if (hawk.visible) {
      const t = performance.now() * 0.001;
      hawk.position.set(hawkAt.g.position.x + Math.cos(t) * 0.8, gy(hawkAt.g.position.x, hawkAt.g.position.z) + 1.7, hawkAt.g.position.z + Math.sin(t) * 0.8);
      wing.rotation.z = Math.sin(t * 8) * 0.5;
      wingR.rotation.z = -Math.sin(t * 8) * 0.5;
    }
    const el = document.getElementById('rangerNote');
    const ammoEl = document.getElementById('rangerAmmo');
    const bar = document.querySelector('#rangerCharge i');
    if (ammoEl) ammoEl.textContent = `${ammo} / ${QUIVER} arrows`;
    if (bar) bar.style.width = `${Math.round((holding ? charge : 0) * 100)}%`;
    if (el) { el.hidden = !on; if (on) el.textContent = note; }
  }

  return {
    chargeStart, chargeRelease, volley, trap, hawk: hawkMark, mark: hawkMark, dodge() { hawkMark(); }, restock, update,
    get note() { return note; },
    get ammo() { return ammo; },
    get charge() { return charge; },
    get iframe() { return 0; },
    bind(next) { wound = next?.wound || wound; },
  };
}
