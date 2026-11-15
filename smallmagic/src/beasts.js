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

function goblin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.32), mat('#3f8f4a'));
  body.position.y = 0.55;
  g.add(body);
  return g;
}

const MAKE = { wolf, boar, slime, goblin };
const HP = { wolf: 36, boar: 48, slime: 22, goblin: 30 };
const TALL = { boar: 1.05, slime: 0.85, goblin: 1.2 };
const mobMixers = [];

function fitMob(root, height) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = height / Math.max(size.y, 0.01);
  root.scale.multiplyScalar(k);
  root.position.y -= new THREE.Box3().setFromObject(root).min.y;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
}

async function dressMobs(all) {
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch {
    return;
  }
  const loader = new GLTFLoader();
  const cache = {};
  for (const b of all) {
    if (!TALL[b.kind]) continue;
    try {
      if (!cache[b.kind]) cache[b.kind] = loader.loadAsync(`/mobs/overaction/${b.kind}.glb`);
      const gltf = await cache[b.kind];
      const model = gltf.scene.clone(true);
      fitMob(model, TALL[b.kind]);
      for (const child of [...b.g.children]) {
        if (child === b.bar || child.name === 'flame') continue;
        b.g.remove(child);
      }
      b.g.add(model);
      const clip = gltf.animations.find((a) => /idle/i.test(a.name)) || gltf.animations[0];
      if (clip) {
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(clip).play();
        mobMixers.push(mixer);
      }
    } catch {
      /* keep the coded stand-in if a file is missing */
    }
  }
}

function one(kind, x, z) {
  const g = MAKE[kind]();
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe23b32 }));
  bar.position.y = kind === 'slime' ? 0.85 : 1.15;
  bar.scale.set(0.7, 0.07, 1);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), new THREE.MeshBasicMaterial({ color: '#ff7a1c' }));
  flame.position.y = kind === 'slime' ? 0.7 : 1.05;
  flame.name = 'flame';
  flame.visible = false;
  g.add(bar, flame);
  g.position.set(x, 0, z);
  return { kind, g, bar, homeX: x, homeZ: z, x, z, hp: HP[kind], max: HP[kind], flash: 0, dead: false, back: 0, tx: x, tz: z, wait: 1, burn: 0, chill: 0 };
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
  add(meadow, 'goblin', -20, -9);
  add(meadow, 'wolf', -62, -16);
  add(meadow, 'boar', -68, -23);
  add(meadow, 'slime', -63, -22);
  add(meadow, 'wolf', -44, -34);
  add(meadow, 'slime', -36, -32);
  add(meadow, 'boar', 6, 32);
  for (const b of all) b.g.scale.setScalar(1.4);
  scene.add(meadow, lake);
  dressMobs(all);
  const bits = [];
  const cube = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  return {
    meadow, lake,
    probe() {
      return all.map((b, n) => ({ n, kind: b.kind, x: +b.g.position.x.toFixed(2), y: +b.g.position.y.toFixed(2), z: +b.g.position.z.toFixed(2), hp: +b.hp.toFixed(1), burn: +b.burn.toFixed(2), chill: +b.chill.toFixed(2), dead: b.dead, flame: !!b.g.getObjectByName('flame')?.visible }));
    },
    hold(px, pz, min, max, dt) {
      for (const b of all) {
        if (b.dead || b.where !== 'meadow') continue;
        const dx = b.g.position.x - px;
        const dz = b.g.position.z - pz;
        const d = Math.hypot(dx, dz);
        if (b.busy || d > 16 || d < 0.05) continue;
        const nx = dx / d;
        const nz = dz / d;
        if (d < min) {
          const goal = min + (max - min) * 0.35;
          const step = Math.min(goal - d, 5.4 * dt);
          b.g.position.x += nx * step;
          b.g.position.z += nz * step;
          b.tx = px + nx * goal;
          b.tz = pz + nz * goal;
          b.wait = Math.max(b.wait, 0.35);
          continue;
        }
        const tdx = b.tx - px;
        const tdz = b.tz - pz;
        if (Math.hypot(tdx, tdz) < min) {
          const stay = Math.min(max, d);
          b.tx = px + nx * stay;
          b.tz = pz + nz * stay;
        }
      }
    },
    grab(x, z, reach = 8) {
      let best = null;
      let bestD = reach;
      for (const b of all) {
        if (b.dead || b.where !== 'meadow') continue;
        const d = Math.hypot(b.g.position.x - x, b.g.position.z - z);
        if (d < bestD) { best = b; bestD = d; }
      }
      if (!best) return null;
      best.busy = true;
      best.slide = null;
      return {
        get x() { return best.g.position.x; },
        get z() { return best.g.position.z; },
        put(nx, nz) {
          best.g.position.x = nx;
          best.g.position.z = nz;
          best.tx = nx;
          best.tz = nz;
        },
        flinch(n) { best.flinch = n; },
        release() { best.busy = false; best.flinch = 0.2; },
      };
    },
    shove(x, z, dx, dz, dist, reach = 1.5) {
      let best = null;
      let bestD = reach;
      for (const b of all) {
        if (b.dead || b.where !== 'meadow' || b.busy) continue;
        const d = Math.hypot(b.g.position.x - x, b.g.position.z - z);
        if (d < bestD) { best = b; bestD = d; }
      }
      if (!best) return false;
      const len = Math.hypot(dx, dz) || 1;
      best.flinch = 0.32;
      best.slide = { sx: best.g.position.x, sz: best.g.position.z, x: best.g.position.x + (dx / len) * dist, z: best.g.position.z + (dz / len) * dist, t: 0, dur: 0.28 };
      best.tx = best.slide.x;
      best.tz = best.slide.z;
      best.wait = Math.max(best.wait, 0.3);
      return true;
    },
    near(x, z) {
      let best = 99;
      for (const b of all) if (!b.dead && b.where === 'meadow') best = Math.min(best, Math.hypot(b.g.position.x - x, b.g.position.z - z));
      return best;
    },
    hurt(marks, zone, onHit) {
      if (!marks || !marks.length) return;
      for (const b of all) {
        if (b.dead || b.where !== zone) continue;
        let shown = 0;
        for (const m of marks) {
          const dist = Math.hypot(b.g.position.x - m.x, b.g.position.z - m.z);
          if (dist > m.r + (m.exact ? 0 : 0.6)) continue;
          const fall = m.falloff ? Math.max(0.22, 1 - dist / Math.max(m.r, 0.01)) : 1;
          const same = m.once != null && b.seen === m.once;
          const addFall = same ? Math.max(0, fall - (b.blastFall || 0)) : fall;
          if (same && addFall < 0.03) continue;
          const now = performance.now();
          const again = !same && b.hitAt && now - b.hitAt < 650;
          if (!same && b.hitAt && now - b.hitAt < 180) continue;
          b.hitAt = now;
          if (m.once != null) { b.seen = m.once; b.blastFall = fall; }
          const dealt = (again ? m.d * 0.4 : m.d) * addFall;
          b.hp -= dealt;
          b.flash = 0.28;
          if (m.k === 'fire') {
            b.burn = Math.max(b.burn, 3.4);
            for (const other of all) {
              if (other === b || other.dead || other.where !== b.where) continue;
              if (Math.hypot(other.g.position.x - b.g.position.x, other.g.position.z - b.g.position.z) < 1.35) other.burn = Math.max(other.burn, 1.5);
            }
          }
          if (m.status === 'chill') b.chill = Math.max(b.chill, 3.4);
          if (m.radial) {
            let ox = b.g.position.x - m.x, oz = b.g.position.z - m.z;
            const len = Math.hypot(ox, oz) || 0.4;
            const push = m.radial * addFall;
            ox /= len; oz /= len;
            b.g.position.x += ox * push; b.g.position.z += oz * push;
            b.tx += ox * push; b.tz += oz * push;
          } else if (!same && (m.kx || m.kz)) { b.g.position.x += m.kx; b.g.position.z += m.kz; b.tx += m.kx; b.tz += m.kz; }
          if (!same && shown < 3) {
            shown++;
            b.stack = (b.stack || 0) + 1;
            onHit?.({ x: b.g.position.x, y: b.g.position.y + 1.2, z: b.g.position.z, n: Math.round(dealt), k: m.k || 'fire', through: again, blast: !!m.blast });
          }
          if (b.hp <= 0) {
            b.dead = true; b.g.visible = false; b.back = 12; b.stack = 0; b.burn = 0; b.chill = 0;
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
      for (const mixer of mobMixers) mixer.update(dt);
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
        if (b.busy) {
          b.g.position.y = ground(b.g.position.x, b.g.position.z);
          if (b.flinch > 0) { b.flinch -= dt; b.g.rotation.z = Math.sin(b.flinch * 40) * 0.25; }
          else b.g.rotation.z = 0;
          continue;
        }
        if (b.slide) {
          b.slide.t += dt;
          const u = Math.min(1, b.slide.t / b.slide.dur);
          const e = u * u * (3 - 2 * u);
          b.g.position.x = b.slide.sx + (b.slide.x - b.slide.sx) * e;
          b.g.position.z = b.slide.sz + (b.slide.z - b.slide.sz) * e;
          b.g.rotation.z = (1 - u) * 0.35;
          if (u >= 1) { b.slide = null; b.g.rotation.z = 0; }
        }
        b.wait -= dt;
        if (b.slide) {
          b.g.position.y = ground(b.g.position.x, b.g.position.z);
          continue;
        }
        if (b.wait <= 0) {
          b.wait = 2 + Math.random() * 3;
          b.tx = b.homeX + (Math.random() - 0.5) * 3.2;
          b.tz = b.homeZ + (Math.random() - 0.5) * 3.2;
        }
        const slow = b.chill > 0 ? 0.32 : 1;
        const dx = b.tx - b.g.position.x, dz = b.tz - b.g.position.z, dist = Math.hypot(dx, dz);
        if (dist > 0.15) {
          b.g.position.x += (dx / dist) * 0.55 * slow * dt;
          b.g.position.z += (dz / dist) * 0.55 * slow * dt;
          b.g.rotation.y = Math.atan2(dx, dz);
        }
        if (b.burn > 0) { b.burn -= dt; b.hp -= 7 * dt; if (b.hp <= 0) { b.dead = true; b.g.visible = false; b.back = 12; b.burn = 0; } }
        else b.burn = 0;
        if (b.chill > 0) b.chill -= dt; else b.chill = 0;
        const flame = b.g.getObjectByName('flame');
        if (flame) { flame.visible = b.burn > 0; flame.scale.y = 0.7 + Math.sin(performance.now() * 0.02) * 0.35; }
        b.g.traverse((o) => {
          if (!o.isMesh || !o.material?.color || o.name === 'flame') return;
          if (!o.userData.base) o.userData.base = o.material.color.getHex();
          o.material.color.setHex(b.chill > 0 ? 0x8ecbff : o.userData.base);
        });
        b.g.position.y = ground(b.g.position.x, b.g.position.z);
        if (b.flash > 0) {
          b.flash -= dt;
          b.g.scale.y = 1.4 * 0.72;
          b.g.position.x += (Math.random() - 0.5) * 0.04;
        } else b.g.scale.y = 1.4 * (b.flinch > 0 ? 0.72 : 1);
        if (b.flinch > 0) b.flinch -= dt;
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
