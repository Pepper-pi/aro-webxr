// Alchemist is where healing lives. Flasks spend gathered herbs: a heal splash,
// an acid that burns, a smoke that drops aggro, and a brew that rain thins or fire lights.
import * as THREE from 'three';

const COLOUR = { heal: '#7dff9a', acid: '#c6e04a', smoke: '#d5d0c8', oil: '#6a4324' };

export function createAlchemist({ scene, camera, world, zones, walker, fire, living, ground }) {
  const gy = (x, z) => (ground ? ground(x, z) : world.ground(x, z));
  const flask = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.9 }));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 6), new THREE.MeshBasicMaterial({ color: '#e7f6ea' }));
  neck.position.y = 0.14;
  flask.add(glass, neck);
  flask.visible = false;
  scene.add(flask);
  const bottles = [];
  const puddles = [];
  const geo = new THREE.SphereGeometry(0.09, 8, 6);
  let note = 'Alchemist';
  let onKit = false;
  let wound = null;
  const aim = new THREE.Vector3();

  function herbs() {
    try { return Number(localStorage.getItem('aro-herbs') || 0); } catch { return 0; }
  }
  function spend() {
    const n = herbs();
    if (n <= 0) { note = 'Alchemist · no herbs gathered'; return false; }
    try { localStorage.setItem('aro-herbs', String(n - 1)); } catch { /* private mode */ }
    return true;
  }
  function raining() {
    return living?.weather === 'rain';
  }

  function toss(kind = 'heal') {
    if (!spend()) return;
    camera.getWorldDirection(aim);
    const dir = aim.clone().normalize();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLOUR[kind] || COLOUR.heal, transparent: true, opacity: 0.92 }));
    mesh.position.copy(camera.position).addScaledVector(dir, 0.55);
    scene.add(mesh);
    bottles.push({ mesh, v: dir.multiplyScalar(10), life: 1.15, kind });
    glass.material.color.set(COLOUR[kind] || COLOUR.heal);
    const left = herbs();
    note = `Alchemist · ${kind} flask · ${left} herbs`;
  }

  function splash(x, z, kind) {
    const y = gy(x, z) + 0.05;
    const colour = COLOUR[kind] || COLOUR.heal;
    const ring = new THREE.Mesh(new THREE.CircleGeometry(kind === 'smoke' ? 1.8 : 1.35, 18), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    scene.add(ring);
    const row = { mesh: ring, x, z, life: kind === 'smoke' ? 5 : 7, tick: 0, kind, spent: false };
    if (kind === 'oil' && raining()) {
      row.kind = 'heal';
      ring.material.color.set(COLOUR.heal);
      note = 'Alchemist · rain thins the brew';
    } else if (kind === 'oil' && (fire?.near?.(x, z, 2) || 0) > 0) {
      row.kind = 'burn';
      ring.material.color.set('#ff7a1c');
      fire.ignite(x, z, 2.2, 0.8);
      zones.hurt([{ x, z, r: 2.2, d: 16, k: 'fire' }]);
      wound?.(10, x, z);
      note = 'Alchemist · the brew catches';
      row.spent = true;
    }
    puddles.push(row);
  }

  function tickPuddle(p) {
    const nearYou = Math.hypot(walker.feet.x - p.x, walker.feet.z - p.z) < 1.7;
    if (p.kind === 'heal') {
      if (nearYou) zones.heal(4);
      note = nearYou ? 'Alchemist · heal splash' : 'Alchemist · a green pool';
    } else if (p.kind === 'acid') {
      zones.hurt([{ x: p.x, z: p.z, r: 1.7, d: 5, k: 'fire' }]);
      wound?.(4, p.x, p.z);
      note = 'Alchemist · acid burns';
    } else if (p.kind === 'smoke') {
      zones.stir?.((b) => {
        if (Math.hypot(b.g.position.x - p.x, b.g.position.z - p.z) < 2.2) {
          b.lost = 0.5;
          const dx = b.g.position.x - walker.feet.x;
          const dz = b.g.position.z - walker.feet.z;
          const len = Math.hypot(dx, dz) || 1;
          b.tx = b.g.position.x + (dx / len) * 2;
          b.tz = b.g.position.z + (dz / len) * 2;
        }
      });
      note = 'Alchemist · smoke · they lose you';
    } else if (p.kind === 'oil') {
      if (raining()) {
        p.kind = 'heal';
        p.mesh.material.color.set(COLOUR.heal);
        note = 'Alchemist · rain thins the brew';
      } else if (!p.spent && (fire?.near?.(p.x, p.z, 2) || 0) > 0) {
        p.spent = true;
        p.kind = 'burn';
        p.mesh.material.color.set('#ff7a1c');
        fire.ignite(p.x, p.z, 2.2, 0.8);
        zones.hurt([{ x: p.x, z: p.z, r: 2.2, d: 16, k: 'fire' }]);
        wound?.(10, p.x, p.z);
        note = 'Alchemist · fire takes the oil';
      }
    }
  }

  function update(dt, on) {
    onKit = !!on;
    flask.visible = !!on;
    if (on) {
      camera.getWorldDirection(aim);
      const right = new THREE.Vector3().crossVectors(aim, new THREE.Vector3(0, 1, 0));
      if (right.lengthSq() > 1e-6) right.normalize();
      flask.position.copy(camera.position).addScaledVector(aim, 0.48).addScaledVector(right, -0.2);
      flask.position.y -= 0.18;
    }
    for (let i = bottles.length - 1; i >= 0; i--) {
      const b = bottles[i];
      b.life -= dt;
      b.v.y -= 11 * dt;
      b.mesh.position.addScaledVector(b.v, dt);
      const y = gy(b.mesh.position.x, b.mesh.position.z) + 0.2;
      if (b.mesh.position.y <= y || b.life <= 0) {
        splash(b.mesh.position.x, b.mesh.position.z, b.kind);
        scene.remove(b.mesh);
        bottles.splice(i, 1);
      }
    }
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      p.life -= dt;
      p.tick += dt;
      p.mesh.material.opacity = Math.max(0.05, Math.min(0.5, p.life / 8));
      if (p.tick >= 0.8) { p.tick = 0; tickPuddle(p); }
      if (p.life <= 0) { scene.remove(p.mesh); puddles.splice(i, 1); }
    }
    const el = document.getElementById('alchemistNote');
    if (el) {
      el.hidden = !on;
      if (on) el.textContent = `${note} · ${herbs()} herbs`;
    }
  }

  return {
    toss: (kind) => toss(kind || 'heal'),
    heal() { toss('heal'); },
    acid() { toss('acid'); },
    smoke() { toss('smoke'); },
    brew() { toss('oil'); },
    sip() { toss('heal'); },
    update,
    get note() { return note; },
    get hot() { return 0; },
    bind(next) { wound = next?.wound || wound; },
  };
}
