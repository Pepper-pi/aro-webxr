// Passive beasts. Drawn in code, no downloaded models. They wander, never attack, and can be felled by a spell.
import * as THREE from 'three';

const mat = (color) => new THREE.MeshBasicMaterial({ color });

function wolf() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.38), mat('#5c534c'));
  body.position.y = 0.48;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.28), mat('#6a6158'));
  head.position.set(0.5, 0.62, 0);
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat('#3e3834'));
  ear.position.set(0.48, 0.84, 0.08);
  g.add(body, head, ear);
  return g;
}
function boar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mat('#8a5a3a'));
  body.scale.set(1.3, 0.75, 0.85);
  body.position.y = 0.46;
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.16), mat('#c4a574'));
  snout.position.set(0.5, 0.4, 0);
  g.add(body, snout);
  return g;
}
function slime() {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), mat('#3dba6a'));
  blob.scale.y = 0.72;
  blob.position.y = 0.28;
  blob.name = 'blob';
  g.add(blob);
  return g;
}

const MAKE = { wolf, boar, slime };
const HP = { wolf: 36, boar: 48, slime: 22 };

function one(kind, x, z) {
  const g = MAKE[kind]();
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe23b32 }));
  bar.position.y = kind === 'slime' ? 0.85 : 1.15;
  bar.scale.set(0.7, 0.07, 1);
  g.add(bar);
  g.position.set(x, 0, z);
  return { kind, g, bar, homeX: x, homeZ: z, x, z, hp: HP[kind], max: HP[kind], flash: 0, dead: false, back: 0, tx: x, tz: z, wait: 1 };
}

export const PACKS = [
  { name: 'Beasts by the landing', x: -26, z: -8 },
  { name: 'Beasts near the logging camp', x: -64, z: -20 },
  { name: 'Beasts on the shore', x: -42, z: -34 },
];

export function createBeasts(scene, ground) {
  const meadow = new THREE.Group();
  const lake = new THREE.Group();
  const all = [];
  const add = (group, kind, x, z) => {
    const b = one(kind, x, z);
    b.where = group === lake ? 'lake' : 'meadow';
    group.add(b.g);
    all.push(b);
  };
  add(meadow, 'wolf', -26, -6);
  add(meadow, 'slime', -30, -14);
  add(meadow, 'boar', -24, -11);
  add(meadow, 'wolf', -62, -16);
  add(meadow, 'boar', -68, -23);
  add(meadow, 'slime', -63, -22);
  add(meadow, 'wolf', -44, -34);
  add(meadow, 'slime', -36, -32);
  add(meadow, 'boar', 6, 32);
  for (const b of all) b.g.scale.setScalar(1.4);
  scene.add(meadow, lake);
  const bits = [];
  const cube = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  return {
    meadow, lake,
    hurt(marks, zone, onHit) {
      if (!marks || !marks.length) return;
      for (const b of all) {
        if (b.dead || b.where !== zone) continue;
        let shown = 0;
        for (const m of marks) {
          if (Math.hypot(b.g.position.x - m.x, b.g.position.z - m.z) > m.r + 0.6) continue;
          b.hp -= m.d;
          b.flash = 0.28;
          if (shown < 3) {
            shown++;
            b.stack = (b.stack || 0) + 1;
            onHit?.({ x: b.g.position.x + (shown - 1) * 0.22, y: b.g.position.y + 1.15 + (b.stack % 4) * 0.32, z: b.g.position.z, n: Math.round(m.d), k: m.k || 'fire' });
          }
          if (b.hp <= 0) {
            b.dead = true; b.g.visible = false; b.back = 12; b.stack = 0;
            const tint = b.kind === 'slime' ? '#3dba6a' : b.kind === 'boar' ? '#8a5a3a' : '#6a6158';
            for (let i = 0; i < 7; i++) {
              const bit = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: tint }));
              bit.position.set(b.g.position.x, 0.45, b.g.position.z);
              bit.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3.2, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 3.2);
              bit.userData.life = 0.8;
              meadow.add(bit);
              bits.push(bit);
            }
            break;
          }
        }
      }
    },
    update(dt, zone) {
      meadow.visible = zone === 'meadow';
      lake.visible = zone === 'lake';
      for (const b of all) {
        if (b.where !== zone) continue;
        if (b.dead) {
          b.back -= dt;
          if (b.back <= 0) {
            b.dead = false; b.hp = b.max; b.g.visible = true; b.flash = 0;
            b.g.position.set(b.homeX, ground(b.homeX, b.homeZ), b.homeZ);
            b.g.rotation.z = 0;
            b.g.scale.setScalar(1.4);
          }
          continue;
        }
        b.wait -= dt;
        if (b.wait <= 0) {
          b.wait = 2 + Math.random() * 3;
          b.tx = b.homeX + (Math.random() - 0.5) * 3.2;
          b.tz = b.homeZ + (Math.random() - 0.5) * 3.2;
        }
        const dx = b.tx - b.g.position.x, dz = b.tz - b.g.position.z, dist = Math.hypot(dx, dz);
        if (dist > 0.15) {
          b.g.position.x += (dx / dist) * 0.55 * dt;
          b.g.position.z += (dz / dist) * 0.55 * dt;
          b.g.rotation.y = Math.atan2(dx, dz);
        }
        b.g.position.y = ground(b.g.position.x, b.g.position.z);
        if (b.flash > 0) {
          b.flash -= dt;
          b.g.scale.y = 1.4 * 0.72;
          b.g.position.x += (Math.random() - 0.5) * 0.04;
        } else b.g.scale.y = 1.4;
        const blob = b.g.getObjectByName('blob');
        if (blob) blob.scale.y = 0.72 + Math.sin(performance.now() * 0.004 + b.homeX) * 0.08;
        b.bar.scale.x = 0.7 * Math.max(0.05, b.hp / b.max);
        if (b.stack) b.stack = Math.max(0, b.stack - dt * 1.6);
      }
      for (let i = bits.length - 1; i >= 0; i--) {
        const bit = bits[i];
        bit.userData.life -= dt;
        bit.userData.v.y -= 7 * dt;
        bit.position.addScaledVector(bit.userData.v, dt);
        bit.scale.setScalar(Math.max(0.05, bit.userData.life));
        if (bit.userData.life <= 0) { meadow.remove(bit); bits.splice(i, 1); }
      }
    },
  };
}
