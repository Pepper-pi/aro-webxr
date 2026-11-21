// Summoner keeps the staff. A short arcane strike, and a familiar that circles for a few seconds.
import * as THREE from 'three';

export function createSummoner({ scene, camera, world, zones, walker }) {
  const mote = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#c9a6ff' }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 18), new THREE.MeshBasicMaterial({ color: '#7ee0ff', transparent: true, opacity: 0.85 }));
  ring.rotation.x = Math.PI / 2;
  mote.add(core, ring);
  mote.visible = false;
  scene.add(mote);
  const bolts = [];
  const geo = new THREE.SphereGeometry(0.08, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: '#d2b6ff' });
  let note = 'Summoner';
  let life = 0;
  let spin = 0;
  let cool = 0;

  function strike() {
    if (cool > 0) return;
    camera.getWorldDirection(mote.userData.dir || (mote.userData.dir = new THREE.Vector3()));
    const dir = mote.userData.dir.clone().normalize();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(camera.position).addScaledVector(dir, 0.7);
    scene.add(mesh);
    bolts.push({ mesh, v: dir.multiplyScalar(16), life: 0.8 });
    cool = 0.45;
    note = 'Summoner · staff strike';
  }

  function summon() {
    life = 8;
    spin = 0;
    mote.position.set(walker.feet.x, walker.feet.y + 1.2, walker.feet.z);
    mote.visible = true;
    note = 'Summoner · familiar';
  }

  function update(dt, on) {
    if (!on) { life = 0; mote.visible = false; }
    if (cool > 0) cool = Math.max(0, cool - dt);
    if (life > 0) {
      life -= dt;
      spin += dt;
      let tx = walker.feet.x + Math.sin(spin) * 1.2;
      let tz = walker.feet.z + Math.cos(spin) * 1.2;
      let prey = null;
      let best = 14;
      for (const b of zones.beasts()) {
        if (b.dead) continue;
        const d = Math.hypot(b.x - mote.position.x, b.z - mote.position.z);
        if (d < best) { best = d; prey = b; }
      }
      if (prey) { tx = prey.x; tz = prey.z; }
      const y = world.ground(tx, tz) + (prey ? 1.05 : 1.2);
      mote.visible = true;
      mote.position.x += (tx - mote.position.x) * Math.min(1, dt * 3.2);
      mote.position.z += (tz - mote.position.z) * Math.min(1, dt * 3.2);
      mote.position.y += (y - mote.position.y) * Math.min(1, dt * 4);
      ring.rotation.z += dt * 3;
      if (prey && best < 1.5 && Math.floor(spin * 3) !== Math.floor((spin - dt) * 3)) {
        zones.hurt([{ x: prey.x, z: prey.z, r: 1.2, d: 9, k: 'arcane' }]);
        note = `Summoner · familiar bites ${prey.kind}`;
      }
      if (life <= 0) { mote.visible = false; note = 'Summoner'; }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.v, dt);
      const p = b.mesh.position;
      if (b.life <= 0 || p.y <= world.ground(p.x, p.z) + 0.2) {
        zones.hurt([{ x: p.x, z: p.z, r: 1.2, d: 14, k: 'arcane' }]);
        scene.remove(b.mesh);
        bolts.splice(i, 1);
      }
    }
    const el = document.getElementById('summonerNote');
    if (el) {
      el.hidden = !on;
      if (on) el.textContent = life > 0 ? `${note} · ${life.toFixed(1)}s` : note;
    }
  }

  return { strike, summon, update, get life() { return life; } };
}
