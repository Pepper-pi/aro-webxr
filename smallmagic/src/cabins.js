// Simple stand-in cabins. Real art comes later: a few logs, a roof, a door, one warm window.
import * as THREE from 'three';
import { shadowed } from './air.js';

const LOG = new THREE.CylinderGeometry(0.16, 0.17, 1, 5);
LOG.rotateZ(Math.PI / 2);

function paint(air, key, rgb, logs) {
  return shadowed(air, {
    key,
    vertexPars: 'varying vec3 vW; varying vec3 vN;',
    vertex: '#include <begin_vertex>\n vW = (modelMatrix * vec4(position, 1.0)).xyz; vN = normalize(mat3(modelMatrix) * normal);',
    fragmentPars: 'varying vec3 vW; varying vec3 vN;',
    fragment: `
      vec3 alb = vec3(${rgb});
      float stripe = ${logs ? 'smoothstep(0.42, 0.58, fract(vW.y * 2.6))' : '0.0'};
      alb *= mix(1.0, 0.76, stripe);
      float sun = clamp(dot(normalize(vN), uSun), 0.0, 1.0);
      vec3 col = lit(alb, 0.32 + 0.68 * sun, 0.75);
      gl_FragColor = vec4(air(col, vW), 1.0);
    `,
  });
}

function beam(parent, mat, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  if (len < 0.25) return;
  const m = new THREE.Mesh(LOG, mat);
  m.scale.set(len, 1, 1);
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
}
function roof(parent, mat, w, d, h) {
  const run = d / 2 + 0.5;
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.12, run), mat);
    m.position.set(0, h + 0.45, side * run * 0.28);
    m.rotation.x = -side * 0.5;
    m.castShadow = true;
    parent.add(m);
  }
}
function windowAt(parent, glow, x, y, z) {
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), glow);
  glass.position.set(x, y, z);
  parent.add(glass);
}

function house(parent, mats, o) {
  const g = new THREE.Group();
  const W = o.w / 2, D = o.d / 2, door = o.door / 2, t = 0.28;
  box(g, mats.wood, o.w, o.h, t, 0, o.h / 2, -D);
  box(g, mats.wood, t, o.h, o.d, -W, o.h / 2, 0);
  box(g, mats.wood, t, o.h, o.d, W, o.h / 2, 0);
  box(g, mats.wood, (o.w - o.door) / 2, o.h, t, -(W + door) / 2, o.h / 2, D);
  box(g, mats.wood, (o.w - o.door) / 2, o.h, t, (W + door) / 2, o.h / 2, D);
  if (o.h > 1.85) box(g, mats.wood, o.door, o.h - 1.75, t, 0, 1.75 + (o.h - 1.75) / 2, D);
  roof(g, mats.roof, o.w, o.d, o.h);
  windowAt(g, mats.glow, o.win ?? -o.w * 0.28, o.h * 0.55, D + 0.2);
  if (o.loft) {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.4, 0.1, o.d * 0.55), mats.roof);
    fl.position.set(0, o.h * 0.55, -o.d * 0.12);
    g.add(fl);
  }
  if (o.bar) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(o.w * 0.45, 0.8, 0.4), mats.wood);
    bar.position.set(-o.w * 0.1, 0.45, -D + 0.6);
    g.add(bar);
  }
  g.position.set(o.x, o.y, o.z);
  g.userData.cabin = true;
  parent.add(g);
  return g;
}

function shell(walls, x, z, w, d, door, id) {
  const r = 0.34, hx = w / 2, hd = d / 2, t = 0.3;
  const add = (cx, cz, hw, hd2) => walls.push({ minx: cx - hw - r, maxx: cx + hw + r, minz: cz - hd2 - r, maxz: cz + hd2 + r, id });
  add(x, z - hd, hx, t);
  add(x - hx, z, t, hd);
  add(x + hx, z, t, hd);
  const gap = door / 2;
  add(x - (hx + gap) / 2, z + hd, (hx - gap) / 2, t);
  add(x + (hx + gap) / 2, z + hd, (hx - gap) / 2, t);
}

export function buildVillage(root, world, air) {
  const wood = paint(air, 'cabin-log', '0.62, 0.36, 0.16', true);
  const roofs = paint(air, 'cabin-roof', '0.42, 0.16, 0.09', false);
  const mats = { wood, roof: roofs, glow: new THREE.MeshBasicMaterial({ color: '#ffd27a' }) };
  const y = (x, z) => world.ground(x, z);
  const walls = [];
  const houses = [];
  const loose = [];
  let freed = 0, warriorDid = false;
  const addHouse = (o) => {
    const g = house(root, mats, o);
    g.userData.id = houses.length;
    houses.push(g);
    shell(walls, o.x, o.z, o.w, o.d, o.door, g.userData.id);
  };
  addHouse({ x: -54, y: y(-54, -18), z: -18, w: 8.2, d: 5.8, h: 2.6, door: 1.6, bar: true, win: -2.2 });
  addHouse({ x: -48, y: y(-48, -24), z: -24, w: 4.6, d: 4, h: 2.8, door: 1.1, loft: true });
  addHouse({ x: -60, y: y(-60, -22), z: -22, w: 3.6, d: 3.2, h: 2.3, door: 1 });
  addHouse({ x: -58, y: y(-58, -13), z: -13, w: 2.6, d: 2.6, h: 4, door: 0.9, win: 0 });
  const camp = new THREE.Group();
  const logs = [];
  for (let i = 0; i < 4; i++) logs.push(beam(camp, wood, -1, 0.25 + i * 0.32, -0.8, 1, 0.25 + i * 0.32, -0.8));
  roof(camp, roofs, 3.2, 2.2, 1.6);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 6), new THREE.MeshBasicMaterial({ color: '#ff8a3a' }));
  fire.position.set(1.6, 0.3, 0.3);
  camp.add(fire);
  camp.position.set(-66, y(-66, -20), -20);
  root.add(camp);
  camp.updateWorldMatrix(true, true);
  for (const log of logs) {
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
    log.getWorldPosition(wp); log.getWorldQuaternion(wq);
    camp.remove(log); root.add(log);
    log.position.copy(wp); log.quaternion.copy(wq);
    loose.push({ m: log, v: new THREE.Vector3(), light: true });
  }
  const plot = new THREE.Mesh(new THREE.CircleGeometry(3.4, 16), new THREE.MeshLambertMaterial({ color: '#c4a574' }));
  plot.rotation.x = -Math.PI / 2;
  plot.position.set(-32, y(-32, -8) + 0.04, -8);
  root.add(plot);
  const dock = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), roofs);
    p.position.set(0, 0.12, -i * 0.7);
    dock.add(p);
  }
  dock.position.set(-50, y(-50, -36), -36);
  root.add(dock);
  const raft = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 2), roofs);
  raft.position.set(-54, world.water + 0.05, -48);
  root.add(raft);
  loose.push({ m: raft, v: new THREE.Vector3(), light: true });
  const rip = (g, n, vx, vy, vz) => {
    if (freed >= 16) return 0;
    g.updateWorldMatrix(true, true);
    let took = 0;
    for (const p of [...g.children]) {
      if (!p.isMesh || p.userData.gone || took >= n || freed >= 16) break;
      p.userData.gone = true;
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
      p.getWorldPosition(wp); p.getWorldQuaternion(wq);
      g.remove(p); root.add(p);
      p.position.copy(wp); p.quaternion.copy(wq);
      loose.push({ m: p, v: new THREE.Vector3(vx, vy, vz) });
      took++; freed++;
    }
    if (took) { const id = g.userData.id; for (let i = walls.length - 1; i >= 0; i--) if (walls[i].id === id) walls.splice(i, 1); }
    return took;
  };
  const pushLoose = (x, z, r, shove) => {
    for (const p of loose) {
      const dx = p.m.position.x - x, dz = p.m.position.z - z, dist = Math.hypot(dx, dz);
      if (dist > r) continue;
      shove(p, dx, dz, dist || 0.2);
    }
  };
  return {
    /** Wind. Already-loose logs and debris slide. A standing cabin is left whole. */
    blow(x, z, dx, dz, r, dt) {
      const step = dt || 0.016;
      pushLoose(x, z, r, (p) => { p.v.x += dx * 16 * step; p.v.z += dz * 16 * step; p.v.y += 3 * step; });
    },
    /**
     * Tornado. Loose pieces are pulled in and spun.
     * A core tile comes off only while world.warriorTornado() is true. That hook stays off.
     */
    swirl(x, z, r, dt) {
      const step = dt || 0.016;
      if (world.warriorTornado?.() && !warriorDid) {
        warriorDid = true;
        let best = null, bestD = r;
        for (const g of houses) {
          if (g.userData.ripped) continue;
          const d = Math.hypot(g.position.x - x, g.position.z - z);
          if (d < bestD) { best = g; bestD = d; }
        }
        if (best) {
          best.userData.ripped = true;
          rip(best, 2, (Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3);
        }
      }
      if (!world.warriorTornado?.()) warriorDid = false;
      pushLoose(x, z, r, (p, dx, dz, dist) => {
        const pull = Math.min(18, 26 / dist);
        p.v.x += (-dx / dist) * pull * step + (-dz / dist) * 9 * step;
        p.v.z += (-dz / dist) * pull * step + (dx / dist) * 9 * step;
        p.v.y += 5 * step;
      });
    },
    /** Explosion and other heavy hits. This is what breaks a cabin. Wind never calls it. */
    breakAt(x, z, r, token) {
      for (const g of houses) {
        if (g.userData.broke === token || Math.hypot(g.position.x - x, g.position.z - z) > r) continue;
        g.userData.broke = token;
        const dx = g.position.x - x, dz = g.position.z - z, len = Math.hypot(dx, dz) || 1;
        rip(g, 3, (dx / len) * 6, 4.5, (dz / len) * 6);
      }
    },
    tick(dt) {
      for (const p of loose) {
        const moving = p.v.lengthSq() > 0.04;
        if (!moving) continue;
        p.v.y -= 9 * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += dt * p.v.length() * 0.35;
        const gy = world.ground(p.m.position.x, p.m.position.z);
        if (p.m.position.y < gy + 0.2) {
          p.m.position.y = gy + 0.15;
          p.v.y = Math.abs(p.v.y) * 0.2;
          const drag = Math.exp(-1.3 * dt);
          p.v.x *= drag; p.v.z *= drag;
        }
      }
    },
    block(f) {
      for (const w of walls) {
        if (f.x < w.minx || f.x > w.maxx || f.z < w.minz || f.z > w.maxz) continue;
        const px = Math.min(f.x - w.minx, w.maxx - f.x), pz = Math.min(f.z - w.minz, w.maxz - f.z);
        if (px < pz) f.x += f.x < (w.minx + w.maxx) / 2 ? -px : px;
        else f.z += f.z < (w.minz + w.maxz) / 2 ? -pz : pz;
      }
    },
  };
}
