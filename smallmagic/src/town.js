// Meadow houses from Kenney's Fantasy Town Kit (CC0). Each sits on a real footprint,
// closed on every side, with a pitched roof and a door toward the nearest path.
import * as THREE from 'three';
import { patchWebKitImageBitmap } from './beasts.js';

const PATH = [
  [0, 36], [-1, 26], [-3, 16], [-1.5, 8], [0, 4.5], [1.5, -2], [0.5, -12], [3, -22], [5, -30],
  [-10.6, 33.1], [-22, 20.6], [22.5, 23.6], [17.6, 42],
];

const PLOTS = [
  { id: 'cottage', x: -10, z: 30.3, w: 7.8, d: 5.4, enter: true },
  { id: 'keep', x: -22, z: 17, w: 6.6, d: 6.6, enter: true },
  { id: 'abbey', x: 27, z: 42, w: 14.2, d: 7.6, enter: true, wings: 2 },
  { id: 'mill', x: 22.5, z: 20.9, w: 4.8, d: 4.8 },
  { id: 'lodge', x: -54, z: -18, w: 8.2, d: 5.8 },
  { id: 'loft', x: -48, z: -24, w: 4.6, d: 4 },
  { id: 'cabin', x: -60, z: -22, w: 3.6, d: 3.2 },
  { id: 'tower', x: -58, z: -13, w: 2.8, d: 2.8, tall: true },
];

const PIECES = ['wall', 'wall-door', 'wall-window-shutters', 'wall-wood', 'wall-wood-door', 'wall-wood-window-shutters', 'roof', 'roof-gable', 'wall-wood-block', 'stall-red', 'pillar-wood'];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function faceYaw(x, z) {
  let best = PATH[0];
  let bestD = Infinity;
  for (const p of PATH) {
    const d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return Math.atan2(best[0] - x, best[1] - z);
}

function styles() {
  const order = [...PLOTS].sort((a, b) => (a.x + a.z) - (b.x + b.z));
  const out = {};
  let prev = -1;
  for (const plot of order) {
    let style = hash(plot.id) % 4;
    if (style === prev) style = (style + 1) % 4;
    out[plot.id] = style;
    prev = style;
  }
  return out;
}

function prep(mesh) {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geo.translate(-cx, -box.min.y, -cz);
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const mat = mesh.material.clone();
  mat.side = THREE.FrontSide;
  const crisp = !(typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 820));
  for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
    const tex = mat[key];
    if (!tex) continue;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = crisp ? 16 : 2;
    tex.needsUpdate = true;
  }
  return { geo, mat, size };
}

export function createTown(parent, world, { low = false } = {}) {
  const root = new THREE.Group();
  root.name = 'town';
  parent.add(root);
  const doors = [];
  const porches = [];
  const glows = [];
  let square = { well: null, benches: [], stalls: [], notice: null };
  let cobbles = [];
  let noticeNear = false;
  let built = null;
  let quality = low ? 'low' : 'high';
  let cool = 0;

  const ready = (async () => {
    patchWebKitImageBitmap();
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const lib = {};
    await Promise.all(PIECES.map(async (name) => {
      const gltf = await loader.loadAsync(new URL(`city/kenney/${name}.glb`, document.baseURI).href);
      gltf.scene.updateMatrixWorld(true);
      let mesh = null;
      gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
      lib[name] = prep(mesh);
      if (name.startsWith('roof')) lib[name].mat.side = THREE.DoubleSide;
    }));
    built = lib;
    raise();
  })().catch((err) => { console.warn('town', err); });

  function clear() {
    for (const child of [...root.children]) {
      if (!child.isInstancedMesh) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
      root.remove(child);
    }
    doors.length = 0;
    porches.length = 0;
    glows.length = 0;
    square = { well: null, benches: [], stalls: [], notice: null };
    cobbles = [];
    cobbles = [];
  }

  function buildSquare(bag, simple) {
    const cx = -4;
    const cz = 24;
    const y0 = world.ground(cx, cz);
    const stone = new THREE.MeshLambertMaterial({ color: '#b7aa96' });
    const wood = new THREE.MeshLambertMaterial({ color: '#6a3a22' });
    const well = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 8, 18), stone);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.22, 16), new THREE.MeshLambertMaterial({ color: '#7eb8c9' }));
    basin.position.y = 0.16;
    well.add(ring, basin);
    const posts = simple ? 0 : 4;
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), new THREE.MeshLambertMaterial({ color: '#e7c56a' }));
      post.position.set(Math.cos(a) * 0.95, 0.55, Math.sin(a) * 0.95);
      well.add(post);
    }
    well.position.set(cx, y0, cz);
    root.add(well);
    square.well = { x: cx, z: cz, y: y0, yaw: 0 };
    const stallN = simple ? 2 : 3;
    for (let i = 0; i < stallN; i++) {
      const a = (0.4 + i * (Math.PI * 2 / 3));
      const x = cx + Math.cos(a) * 3.5;
      const z = cz + Math.sin(a) * 3.5;
      const y = world.ground(x, z);
      const yaw = Math.atan2(cx - x, cz - z);
      put(bag, 'stall-red', x, y, z, yaw, 1, 1, 1);
      square.stalls.push({ x, z, y, yaw });
    }
    const benchN = simple ? 2 : 3;
    const benches = [];
    for (let i = 0; i < benchN; i++) {
      const a = i * (Math.PI * 2 / 3);
      const x = cx + Math.cos(a) * 2.25;
      const z = cz + Math.sin(a) * 2.25;
      const y = world.ground(x, z);
      const yaw = Math.atan2(cx - x, cz - z);
      benches.push({ x, y, z, yaw });
      square.benches.push({ x, z, y, yaw });
    }
    const lampN = simple ? 2 : 4;
    const lamps = [];
    for (let i = 0; i < lampN; i++) {
      const a = Math.PI / 4 + i * (Math.PI * 2 / lampN);
      lamps.push({ x: cx + Math.cos(a) * 4.5, z: cz + Math.sin(a) * 4.5 });
    }
    const plantN = simple ? 2 : 4;
    const plants = [];
    for (let i = 0; i < plantN; i++) {
      const a = i * (Math.PI * 2 / plantN) + 0.4;
      plants.push({ x: cx + Math.cos(a) * 1.35, z: cz + Math.sin(a) * 1.35 });
    }
    const stamp = (geo, mat, items, place) => {
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      const dummy = new THREE.Object3D();
      items.forEach((item, i) => {
        place(dummy, item);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    };
    stamp(new THREE.BoxGeometry(1.1, 0.12, 0.34), wood, benches, (dummy, item) => {
      dummy.position.set(item.x, item.y + 0.32, item.z);
      dummy.rotation.set(0, item.yaw, 0);
      dummy.scale.set(1, 1, 1);
    });
    const legs = [];
    for (const bench of benches) {
      const c = Math.cos(bench.yaw);
      const s = Math.sin(bench.yaw);
      legs.push({ x: bench.x + 0.4 * c, y: bench.y + 0.16, z: bench.z - 0.4 * s, yaw: bench.yaw });
      legs.push({ x: bench.x - 0.4 * c, y: bench.y + 0.16, z: bench.z + 0.4 * s, yaw: bench.yaw });
    }
    stamp(new THREE.BoxGeometry(0.08, 0.28, 0.08), wood, legs, (dummy, item) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.yaw, 0);
      dummy.scale.set(1, 1, 1);
    });
    stamp(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), wood, lamps, (dummy, item) => {
      const y = world.ground(item.x, item.z);
      dummy.position.set(item.x, y + 0.75, item.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
    });
    stamp(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), lamps, (dummy, item) => {
      const y = world.ground(item.x, item.z);
      dummy.position.set(item.x, y + 1.55, item.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
    });
    const potMat = new THREE.MeshLambertMaterial({ color: '#8a5a3a' });
    const leafMat = new THREE.MeshLambertMaterial({ color: '#3d8f4a' });
    stamp(new THREE.CylinderGeometry(0.18, 0.14, 0.22, 6), potMat, plants, (dummy, item) => {
      dummy.position.set(item.x, world.ground(item.x, item.z) + 0.12, item.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
    });
    stamp(new THREE.SphereGeometry(0.16, 6, 5), leafMat, plants, (dummy, item) => {
      dummy.position.set(item.x, world.ground(item.x, item.z) + 0.32, item.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
    });
    const nx = cx + 2.2;
    const nz = cz - 3.4;
    const ny = world.ground(nx, nz);
    const board = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 0.08), wood);
    plank.position.y = 1.15;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.62), new THREE.MeshBasicMaterial({ color: '#f6ead0' }));
    paper.position.set(0, 1.18, 0.05);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), wood);
    stand.position.y = 0.55;
    board.add(plank, paper, stand);
    board.position.set(nx, ny, nz);
    board.rotation.y = Math.atan2(cx - nx, cz - nz);
    board.name = 'square-notice';
    root.add(board);
    square.notice = { x: nx, z: nz, y: ny };
    const tiles = [];
    const step = simple ? 2.5 : 1.2;
    const targets = ['cottage', 'keep', 'abbey-a'].map((id) => doors.find((d) => d.id === id)).filter(Boolean);
    const houses = { cottage: { x: -10, z: 30.3 }, keep: { x: -22, z: 17 }, 'abbey-a': { x: 27, z: 42 } };
    for (const door of targets) {
      const ax = cx;
      const az = cz;
      const bx = door.x;
      const bz = door.z;
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len;
      const pz = dx / len;
      const house = houses[door.id] || { x: bx, z: bz };
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const side = Math.sign((house.x - mx) * px + (house.z - mz) * pz) || 1;
      const bow = 2.6 * -side;
      const qx = mx + px * bow;
      const qz = mz + pz * bow;
      const n = Math.max(3, Math.floor(len / step));
      let prevX = ax;
      let prevZ = az;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const o = 1 - t;
        const x = o * o * ax + 2 * o * t * qx + t * t * bx;
        const z = o * o * az + 2 * o * t * qz + t * t * bz;
        tiles.push({ x, z, yaw: Math.atan2(x - prevX, z - prevZ) });
        prevX = x;
        prevZ = z;
      }
    }
    if (tiles.length) {
      const geo = new THREE.BoxGeometry(0.9, 0.05, 0.55);
      const mat = new THREE.MeshLambertMaterial({ color: '#c4b49a' });
      const mesh = new THREE.InstancedMesh(geo, mat, tiles.length);
      const dummy = new THREE.Object3D();
      tiles.forEach((tile, i) => {
        dummy.position.set(tile.x, world.ground(tile.x, tile.z) + 0.03, tile.z);
        dummy.rotation.set(0, tile.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      root.add(mesh);
      cobbles = tiles;
    }
  }

  function put(bag, name, x, y, z, yaw, sx, sy, sz) {
    (bag[name] || (bag[name] = [])).push({ x, y, z, yaw, sx, sy, sz });
  }

  function wing(bag, plot, style, simple) {
    const wood = style % 2 === 0;
    const wall = wood ? 'wall-wood' : 'wall';
    const win = wood ? 'wall-wood-window-shutters' : 'wall-window-shutters';
    const door = wood ? 'wall-wood-door' : 'wall-door';
    const roofName = style === 1 ? 'roof' : 'roof-gable';
    const nx = Math.max(2, Math.round(plot.w / (simple ? 2.2 : 1.6)));
    const nz = Math.max(2, Math.round(plot.d / (simple ? 2.2 : 1.6)));
    const sx = plot.w / nx;
    const sz = plot.d / nz;
    const stories = simple ? 1 : (plot.tall ? 2 : 1 + (hash(plot.id) % 2));
    const yaw = plot.yaw;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const place = (lx, ly, lz, spin, name, scx, scy, scz) => {
      const wx = plot.x + lx * cos + lz * sin;
      const wz = plot.z - lx * sin + lz * cos;
      put(bag, name, wx, ly, wz, yaw + spin, scx, scy, scz);
    };
    const y0 = world.ground(plot.x, plot.z);
    const farLodge = simple && Math.hypot(plot.x + 4, plot.z - 24) > 36;
    if (farLodge) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(plot.w, plot.tall ? 3.2 : 2.2, plot.d), new THREE.MeshLambertMaterial({ color: '#8d6b4a' }));
      box.position.set(plot.x, y0 + (plot.tall ? 1.6 : 1.1), plot.z);
      box.rotation.y = yaw;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(plot.w, plot.d) * 0.62, 1.15, 4), new THREE.MeshLambertMaterial({ color: '#6a3a22' }));
      cap.position.set(plot.x, y0 + (plot.tall ? 3.5 : 2.4), plot.z);
      cap.rotation.y = yaw + Math.PI / 4;
      root.add(box, cap);
      return;
    }
    const footing = new THREE.Mesh(
      new THREE.BoxGeometry(plot.w + 0.35, 0.16, plot.d + 0.35),
      new THREE.MeshLambertMaterial({ color: '#6e6256' }),
    );
    footing.position.set(plot.x, y0 - 0.02, plot.z);
    footing.rotation.y = yaw;
    footing.receiveShadow = true;
    root.add(footing);
    const frontDoor = Math.floor(nx / 2);
    for (let story = 0; story < stories; story++) {
      const y = y0 + story;
      for (let i = 0; i < nx; i++) {
        const x = -plot.w / 2 + sx * (i + 0.5);
        const kindF = story === 0 && i === frontDoor ? door : (!simple && (i + story) % 2 === 0 ? win : wall);
        const kindB = !simple && (i + story) % 2 === 1 ? win : wall;
        place(x, y, plot.d / 2, Math.PI / 2, kindF, 1, 1, sx);
        place(x, y, -plot.d / 2, -Math.PI / 2, kindB, 1, 1, sx);
        if (!simple && kindF === win) glows.push({ x: plot.x + x * cos + (plot.d / 2) * sin, y: y + 0.55, z: plot.z - x * sin + (plot.d / 2) * cos, yaw });
      }
      for (let i = 0; i < nz; i++) {
        const z = -plot.d / 2 + sz * (i + 0.5);
        const kind = !simple && i % 2 === 0 ? win : wall;
        place(-plot.w / 2, y, z, Math.PI, kind, 1, 1, sz);
        place(plot.w / 2, y, z, 0, kind, 1, 1, sz);
      }
    }
    const eaves = simple ? 1.08 : 1.18;
    const pitch = style === 2 ? 1.25 : style === 1 ? 0.9 : 1.05;
    for (let i = 0; i < nx; i++) {
      const x = -plot.w / 2 + (plot.w / nx) * (i + 0.5);
      place(x, y0 + stories, 0, Math.PI / 2, roofName, (plot.d * eaves) / 1.07, pitch, (plot.w / nx) * 1.08);
    }
    if (!simple && style !== 1) {
      place(plot.w * 0.32, y0 + stories + 0.35 * pitch, 0, 0, 'wall-wood-block', 0.42, 0.7, 0.42);
    } else if (!simple) {
      place(0, y0, plot.d / 2 + 0.85, 0, 'stall-red', 0.9, 0.9, 0.9);
    }
    porches.push({ id: plot.id, x: plot.x + ( -plot.w / 2 + sx * (frontDoor + 0.5)) * cos + (plot.d / 2 + 0.7) * sin, z: plot.z - (-plot.w / 2 + sx * (frontDoor + 0.5)) * sin + (plot.d / 2 + 0.7) * cos, yaw, y: y0 });
    if (plot.enter) {
      const lx = -plot.w / 2 + sx * (frontDoor + 0.5);
      const lz = plot.d / 2 + 0.35;
      const dx = plot.x + lx * cos + lz * sin;
      const dz = plot.z - lx * sin + lz * cos;
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.7),
        new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }),
      );
      glow.position.set(dx, y0 + 0.9, dz);
      glow.rotation.y = yaw;
      glow.renderOrder = 2;
      root.add(glow);
      doors.push({ x: dx, z: dz, glow, id: plot.id });
    }
  }

  function raise() {
    if (!built) return;
    clear();
    const look = styles();
    const simple = quality !== 'high';
    const bag = {};
    for (const plot of PLOTS) {
      const yaw = faceYaw(plot.x, plot.z);
      if (plot.wings === 2) {
        const span = plot.w / 2 - 0.15;
        const offset = plot.w / 4;
        for (const [sign, enter] of [[-1, true], [1, false]]) {
          const lx = sign * offset;
          wing(bag, {
            ...plot,
            id: `${plot.id}-${sign < 0 ? 'a' : 'b'}`,
            x: plot.x + lx * Math.cos(yaw),
            z: plot.z - lx * Math.sin(yaw),
            w: span,
            yaw,
            enter: enter && plot.enter,
          }, (look[plot.id] + (sign < 0 ? 0 : 1)) % 4, simple);
        }
      } else wing(bag, { ...plot, yaw }, look[plot.id], simple);
    }
    buildSquare(bag, simple);
    const dummy = new THREE.Object3D();
    for (const [name, spots] of Object.entries(bag)) {
      const src = built[name];
      if (!src || !spots.length) continue;
      const mesh = new THREE.InstancedMesh(src.geo, src.mat, spots.length);
      spots.forEach((spot, i) => {
        dummy.position.set(spot.x, spot.y, spot.z);
        dummy.rotation.set(0, spot.yaw, 0);
        dummy.scale.set(spot.sx, spot.sy, spot.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    }
    if (!simple) {
      const glowGeo = new THREE.PlaneGeometry(0.46, 0.42);
      const glowMat = new THREE.MeshBasicMaterial({ color: '#ffcc77', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
      const panes = new THREE.InstancedMesh(glowGeo, glowMat, Math.max(1, glows.length));
      panes.userData.panes = true;
      panes.frustumCulled = false;
      glows.forEach((g, i) => {
        dummy.position.set(g.x, g.y, g.z);
        dummy.rotation.set(0, g.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        panes.setMatrixAt(i, dummy.matrix);
      });
      panes.instanceMatrix.needsUpdate = true;
      root.add(panes);
    }
  }

  return {
    ready,
    doors,
    porches,
    get square() { return square; },
    nearCobble(x, z) {
      for (let i = 0; i < cobbles.length; i++) {
        const t = cobbles[i];
        const dx = t.x - x;
        const dz = t.z - z;
        if (dx * dx + dz * dz < 0.5) return true;
      }
      return false;
    },
    nearCobble(x, z) {
      for (let i = 0; i < cobbles.length; i++) {
        const t = cobbles[i];
        const dx = t.x - x;
        const dz = t.z - z;
        if (dx * dx + dz * dz < 0.5) return true;
      }
      return false;
    },
    setQuality(next) {
      const pick = next ? 'low' : 'high';
      if (pick === quality) return;
      quality = pick;
      raise();
    },
    update(_dt, walker, dusk) {
      const panes = root.children.find((c) => c.userData.panes);
      if (panes) panes.material.opacity = dusk && quality === 'high' ? 0.85 : 0;
      const playing = document.body.classList.contains('playtest');
      const now = performance.now();
      if (square.notice && !playing) {
        const nd = Math.hypot(walker.feet.x - square.notice.x, walker.feet.z - square.notice.z);
        const close = nd < 1.7;
        if (close && !noticeNear) { noticeNear = true; return 'board'; }
        if (!close) noticeNear = false;
      }
      for (const door of doors) {
        const dist = Math.hypot(walker.feet.x - door.x, walker.feet.z - door.z);
        const near = dist < 3.4;
        door.glow.material.opacity = near ? 0.45 + Math.sin(now * 0.006) * 0.12 : 0;
        if (!playing && dist < 1.2 && now > cool) {
          cool = now + 2500;
          return door.id;
        }
      }
      return null;
    },
  };
}
