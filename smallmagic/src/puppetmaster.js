// Puppetmaster. Two core puppets, original builds. Black Ant is a barrel tank.
// Crow is a fighter that nests in the tank's chest. Porcelain heal puppet is later.
// Strings match the fishing line: a slack glow from the fingers to each puppet.
import * as THREE from 'three';

const WOOD = '#6a3a22';
const BAND = '#2a2118';
const IRON = '#8a8178';

function stringLine() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.9 }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}
function sag(mesh, ax, ay, az, bx, by, bz, slack = 0.22) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const dip = Math.sin(t * Math.PI) * slack;
    pos.setXYZ(i, ax + (bx - ax) * t, ay + (by - ay) * t - dip, az + (bz - az) * t);
  }
  pos.needsUpdate = true;
}

function barrelTank() {
  const g = new THREE.Group();
  const wood = new THREE.MeshBasicMaterial({ color: WOOD });
  const band = new THREE.MeshBasicMaterial({ color: BAND });
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 1.15, 10), wood);
  belly.position.y = 0.62;
  const hoopA = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 16), band);
  hoopA.rotation.x = Math.PI / 2;
  hoopA.position.y = 0.38;
  const hoopB = hoopA.clone();
  hoopB.position.y = 0.92;
  const lid = new THREE.Group();
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.36), new THREE.MeshBasicMaterial({ color: '#8a5a32' }));
  hatch.position.set(0, 0, 0.16);
  lid.add(hatch);
  lid.position.set(0, 1.05, 0.05);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#3a2a22' }));
  sack.scale.set(1, 0.7, 0.8);
  sack.position.set(0, 0.95, 0.12);
  sack.name = 'sack';
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.08), new THREE.MeshBasicMaterial({ color: IRON }));
  face.position.set(0, 0.7, 0.52);
  g.add(belly, hoopA, hoopB, lid, sack, face);
  g.userData.lid = lid;
  g.userData.sack = sack;
  return g;
}

function crowFighter() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.16), new THREE.MeshBasicMaterial({ color: '#2c241c' }));
  body.position.y = 0.2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.34), new THREE.MeshBasicMaterial({ color: '#1a1614' }));
  wing.position.set(0, 0.28, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#3a322c' }));
  head.position.set(0, 0.38, 0.1);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), new THREE.MeshBasicMaterial({ color: '#c4a574' }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.36, 0.2);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), new THREE.MeshBasicMaterial({ color: '#8a8178' }));
  arm.position.set(0.2, 0.12, 0.05);
  arm.name = 'limb';
  const gadget = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), new THREE.MeshBasicMaterial({ color: '#c47a3a' }));
  gadget.position.set(-0.18, 0.16, 0.08);
  g.add(body, wing, head, beak, arm, gadget);
  return g;
}

export function createPuppetmaster({ scene, world, zones, walker }) {
  const tank = barrelTank();
  const fighter = crowFighter();
  tank.visible = false;
  fighter.visible = false;
  scene.add(tank, fighter);
  const strings = [stringLine(), stringLine(), stringLine(), stringLine()];
  strings.forEach((s) => scene.add(s));
  const trapRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.62, 18),
    new THREE.MeshBasicMaterial({ color: '#ffb043', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
  );
  trapRing.rotation.x = -Math.PI / 2;
  trapRing.visible = false;
  scene.add(trapRing);
  let deployed = false;
  let nest = 'in';
  let pop = 0;
  let trap = null;
  let scrap = 3;
  let bashCharge = 0;
  let bashing = false;
  let bashCool = 0;
  let strikeCool = 0;
  let trapCool = 0;
  let taunt = 0;
  const magic = {};

  function foeAt() {
    const raid = magic.foe?.();
    if (raid) return raid;
    let best = null;
    let dist = 14;
    for (const b of zones.beasts()) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - walker.feet.x, b.z - walker.feet.z);
      if (d < dist) { best = b; dist = d; }
    }
    return best;
  }
  function placeTank() {
    const x = walker.feet.x + Math.sin(walker.yaw) * 1.8;
    const z = walker.feet.z + Math.cos(walker.yaw) * 1.8;
    tank.position.set(x, world.ground(x, z), z);
    tank.rotation.y = walker.yaw;
  }
  function deploy() {
    if (deployed) { zones.toast?.('Black Ant is already set.'); return; }
    deployed = true;
    nest = 'in';
    pop = 0;
    scrap = 3;
    placeTank();
    tank.visible = true;
    fighter.visible = false;
    zones.toast?.('Black Ant sets down. Crow waits in the chest.');
    zones.tauntBeasts?.(tank.position.x, tank.position.z);
  }
  function popFighter() {
    if (!deployed) { zones.toast?.('Deploy the tank first.'); return; }
    if (nest === 'out' || nest === 'leaving') { zones.toast?.('Crow is already out.'); return; }
    nest = 'leaving';
    pop = 0;
    fighter.visible = true;
    zones.toast?.('The chest opens. Crow pops out.');
  }
  function recall() {
    if (!deployed) return;
    if (nest === 'out' || nest === 'leaving') {
      nest = 'returning';
      pop = 1;
      zones.toast?.('Crow folds back into the chest.');
      return;
    }
    deployed = false;
    nest = 'in';
    tank.visible = false;
    fighter.visible = false;
    trap = null;
    trapRing.visible = false;
    zones.toast?.('Both puppets are packed away.');
  }
  function strike() {
    if (nest !== 'out') { zones.toast?.('Pop Crow out of the tank first.'); return; }
    if (strikeCool > 0) return;
    const foe = foeAt();
    if (!foe) { zones.toast?.('Crow has no one to swing at.'); return; }
    strikeCool = 0.75;
    const limb = fighter.getObjectByName('limb');
    if (limb) limb.position.z = 0.35;
    zones.hurt([{ x: foe.x, z: foe.z, r: 1.35, d: 12, k: 'arcane' }]);
    magic.wound?.(12, foe.x, foe.z);
    if (scrap < 3) scrap += 1;
    zones.toast?.('Crow throws a limb and takes it back.');
  }
  function setTrap() {
    if (!deployed) { zones.toast?.('Deploy the tank first.'); return; }
    if (nest !== 'out') { zones.toast?.('Crow sets traps once it is out.'); return; }
    if (scrap <= 0) { zones.toast?.('The barrel is empty of scrap.'); return; }
    if (trapCool > 0) return;
    const foe = foeAt();
    const x = foe ? foe.x : fighter.position.x;
    const z = foe ? foe.z : fighter.position.z;
    scrap -= 1;
    trap = { x, z, life: 6, tick: 0.2 };
    trapCool = 5;
    trapRing.visible = true;
    trapRing.position.set(x, world.ground(x, z) + 0.04, z);
    zones.toast?.('Crow leaves a gadget snare. Scrap returns when Crow hits.');
  }
  function bashStart() {
    if (!deployed || bashCool > 0) return;
    bashing = true;
  }
  function bashRelease() {
    if (!bashing) return;
    bashing = false;
    const heavy = bashCharge >= 0.6;
    bashCharge = 0;
    if (!deployed) return;
    bashCool = heavy ? 2.4 : 1.1;
    const foe = foeAt();
    const dmg = heavy ? 22 : 10;
    if (foe) {
      zones.hurt([{ x: foe.x, z: foe.z, r: heavy ? 2.1 : 1.4, d: dmg, k: 'arcane' }]);
      magic.wound?.(dmg, foe.x, foe.z);
      tank.position.x += (foe.x - tank.position.x) * (heavy ? 0.45 : 0.25);
      tank.position.z += (foe.z - tank.position.z) * (heavy ? 0.45 : 0.25);
    }
    zones.tauntBeasts?.(tank.position.x, tank.position.z);
    zones.toast?.(heavy ? 'Black Ant slams. The front holds.' : 'Black Ant bashes.');
  }
  function use(key) {
    if (key === 'deploy') deploy();
    else if (key === 'pop') popFighter();
    else if (key === 'strike') strike();
    else if (key === 'trap') setTrap();
    else if (key === 'recall') recall();
  }
  function update(dt, on) {
    if (!on) {
      tank.visible = false;
      fighter.visible = false;
      strings.forEach((s) => { s.visible = false; });
      zones.setGuard?.(0, 0);
      trapRing.visible = false;
      bashing = false;
      return;
    }
    zones.ageGuard?.(dt);
    if (bashCool > 0) bashCool = Math.max(0, bashCool - dt);
    if (strikeCool > 0) strikeCool = Math.max(0, strikeCool - dt);
    if (trapCool > 0) trapCool = Math.max(0, trapCool - dt);
    if (bashing) bashCharge = Math.min(1, bashCharge + dt * 0.7);
    const foe = foeAt();
    if (deployed) {
      tank.visible = true;
      const y = world.ground(tank.position.x, tank.position.z);
      tank.position.y += (y - tank.position.y) * Math.min(1, dt * 6);
      const open = nest === 'in' ? 0 : nest === 'out' ? 1 : nest === 'leaving' ? pop : pop;
      tank.userData.lid.rotation.x = -1.15 * open;
      tank.userData.sack.scale.setScalar(nest === 'in' ? 1 : 1 - open * 0.8);
      if (nest === 'leaving') {
        pop = Math.min(1, pop + dt / 0.7);
        const u = pop;
        const hx = tank.position.x + Math.sin(tank.rotation.y) * 0.9;
        const hz = tank.position.z + Math.cos(tank.rotation.y) * 0.9;
        fighter.visible = true;
        fighter.scale.setScalar(0.25 + u * 0.75);
        fighter.position.set(
          tank.position.x + (hx - tank.position.x) * u,
          tank.position.y + 1.05 + Math.sin(u * Math.PI) * 1.15,
          tank.position.z + (hz - tank.position.z) * u,
        );
        if (pop >= 1) { nest = 'out'; fighter.scale.setScalar(1); }
      } else if (nest === 'returning') {
        pop = Math.max(0, pop - dt / 0.65);
        const u = pop;
        const hx = tank.position.x + Math.sin(tank.rotation.y) * 0.9;
        const hz = tank.position.z + Math.cos(tank.rotation.y) * 0.9;
        fighter.visible = u > 0.02;
        fighter.scale.setScalar(0.25 + u * 0.75);
        fighter.position.set(
          tank.position.x + (hx - tank.position.x) * u,
          tank.position.y + 1.05 + Math.sin(u * Math.PI) * 0.8,
          tank.position.z + (hz - tank.position.z) * u,
        );
        if (pop <= 0) { nest = 'in'; fighter.visible = false; }
      } else if (nest === 'out') {
        const tx = foe ? foe.x : tank.position.x + Math.sin(tank.rotation.y) * 1.4;
        const tz = foe ? foe.z : tank.position.z + Math.cos(tank.rotation.y) * 1.4;
        const fy = world.ground(tx, tz) + 0.9 + Math.sin(performance.now() * 0.004) * 0.08;
        fighter.position.x += (tx - fighter.position.x) * Math.min(1, dt * 2.4);
        fighter.position.z += (tz - fighter.position.z) * Math.min(1, dt * 2.4);
        fighter.position.y += (fy - fighter.position.y) * Math.min(1, dt * 4);
        const limb = fighter.getObjectByName('limb');
        if (limb) limb.position.z += (0.05 - limb.position.z) * Math.min(1, dt * 4);
      }
      taunt -= dt;
      if (taunt <= 0) {
        taunt = 2.4;
        zones.tauntBeasts?.(tank.position.x, tank.position.z);
      }
      if (foe) {
        const fx = foe.x - tank.position.x;
        const fz = foe.z - tank.position.z;
        const face = Math.sin(tank.rotation.y) * fx + Math.cos(tank.rotation.y) * fz;
        if (face > 0.4) zones.setGuard?.(20, 0.35);
      }
    }
    if (trap) {
      trap.life -= dt;
      trap.tick -= dt;
      trapRing.position.set(trap.x, world.ground(trap.x, trap.z) + 0.04, trap.z);
      if (trap.tick <= 0) {
        trap.tick = 0.55;
        zones.hurt([{ x: trap.x, z: trap.z, r: 1.2, d: 7, k: 'arcane' }]);
        magic.wound?.(7, trap.x, trap.z);
      }
      if (trap.life <= 0) { trap = null; trapRing.visible = false; }
    }
    const showStrings = deployed;
    strings.forEach((s) => { s.visible = showStrings; });
    if (showStrings) {
      const hy = walker.feet.y + 1.2;
      const lx = walker.feet.x + Math.cos(walker.yaw) * 0.18;
      const lz = walker.feet.z - Math.sin(walker.yaw) * 0.18;
      const rx = walker.feet.x - Math.cos(walker.yaw) * 0.18;
      const rz = walker.feet.z + Math.sin(walker.yaw) * 0.18;
      sag(strings[0], lx, hy, lz, tank.position.x - 0.3, tank.position.y + 1.05, tank.position.z, 0.2);
      sag(strings[1], rx, hy, rz, tank.position.x + 0.3, tank.position.y + 1.05, tank.position.z, 0.2);
      if (fighter.visible) {
        sag(strings[2], lx, hy, lz, fighter.position.x - 0.12, fighter.position.y + 0.35, fighter.position.z, 0.16);
        sag(strings[3], rx, hy, rz, fighter.position.x + 0.12, fighter.position.y + 0.35, fighter.position.z, 0.16);
      } else {
        sag(strings[2], lx, hy, lz, tank.position.x, tank.position.y + 0.9, tank.position.z, 0.28);
        sag(strings[3], rx, hy, rz, tank.position.x, tank.position.y + 0.9, tank.position.z, 0.28);
      }
    }
    const el = document.getElementById('puppetNote');
    if (el) {
      const where = !deployed ? 'packed' : nest === 'out' ? 'Crow out' : nest === 'leaving' ? 'chest opening' : nest === 'returning' ? 'Crow returning' : 'Crow inside';
      const wind = bashing ? ` · bash ${Math.round(bashCharge * 100)}%` : '';
      el.textContent = `Black Ant · ${where} · scrap ${scrap}${wind}`;
    }
  }

  return {
    deploy, popFighter, strike, setTrap, bashStart, bashRelease, recall, use, update,
    bind(next) { Object.assign(magic, next); },
    get bash() { return bashCharge; },
    get state() { return { deployed, nest, scrap }; },
  };
}
