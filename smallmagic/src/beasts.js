// Passive beasts. Drawn in code, no downloaded models. They wander, never attack, and can be felled by a spell.
import * as THREE from 'three';

const mat = (color) => new THREE.MeshBasicMaterial({ color });

function wolf() {
  const g = new THREE.Group();
  const fur = mat('#6d645c');
  const dark = mat('#3e3834');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.28), fur);
  body.position.set(0, 0.42, 0);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.24), fur);
  chest.position.set(0.28, 0.5, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.22), mat('#7a7168'));
  head.position.set(0.52, 0.62, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), dark);
  snout.position.set(0.7, 0.56, 0);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), dark);
  earL.position.set(0.48, 0.8, 0.07);
  const earR = earL.clone();
  earR.position.z = -0.07;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), dark);
  tail.rotation.z = Math.PI / 2.4;
  tail.position.set(-0.42, 0.52, 0);
  const leg = () => new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), dark);
  const hips = [[0.18, 0.08], [0.18, -0.08], [-0.18, 0.08], [-0.18, -0.08]];
  for (const [x, z] of hips) {
    const l = leg();
    l.position.set(x, 0.16, z);
    g.add(l);
  }
  g.add(body, chest, head, snout, earL, earR, tail);
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
const TALL = { boar: 1.65, slime: 1.25, goblin: 1.85 };
const mobMixers = [];
const faces = {};
let gl = null;

export function useRenderer(renderer) { gl = renderer; }

function playClip(b, name) {
  const next = b.clips?.[name] || (name === 'idle' ? null : b.clips?.idle);
  if (!next || b.clipName === name) return;
  if (name === 'attack' || name === 'hit' || name === 'death') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  }
  next.reset().fadeIn(0.1).play();
  if (b.clip && b.clip !== next) b.clip.fadeOut(0.12);
  b.clip = next;
  b.clipName = name;
}

function clipDone(b) {
  const a = b.clip;
  if (!a) return true;
  const dur = a.getClip()?.duration || 1;
  return a.time >= dur - 0.06;
}

function snapFace(model, kind) {
  if (!gl || faces[kind]) return;
  try {
    const rt = new THREE.WebGLRenderTarget(64, 64);
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    const copy = model.clone(true);
    copy.traverse((o) => {
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      o.material = new THREE.MeshBasicMaterial({ map: src?.map || null, color: src?.color || '#ffffff' });
    });
    sc.add(copy, new THREE.HemisphereLight('#ffffff', '#d7e2c8', 2));
    const box = new THREE.Box3().setFromObject(copy);
    const mid = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 0.4);
    cam.position.copy(mid).add(new THREE.Vector3(span * 0.9, span * 0.35, span * 1.35));
    cam.lookAt(mid);
    const prev = gl.getRenderTarget();
    const clear = gl.getClearColor(new THREE.Color());
    const alpha = gl.getClearAlpha();
    gl.setRenderTarget(rt);
    gl.setClearColor(0xd5e4f2, 1);
    gl.clear();
    gl.render(sc, cam);
    const buf = new Uint8Array(64 * 64 * 4);
    gl.readRenderTargetPixels(rt, 0, 0, 64, 64, buf);
    gl.setRenderTarget(prev);
    gl.setClearColor(clear, alpha);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(64, 64);
    let bright = 0;
    for (let i = 0; i < buf.length; i += 16) bright += buf[i] + buf[i + 1] + buf[i + 2];
    if (bright < 12000) return;
    for (let y = 0; y < 64; y++) img.data.set(buf.subarray((63 - y) * 256, (64 - y) * 256), y * 256);
    ctx.putImageData(img, 0, 0);
    faces[kind] = canvas.toDataURL();
    rt.dispose();
  } catch { /* the colour chip stays if a snapshot cannot be taken */ }
}

function skinnedMinY(model) {
  let minY = Infinity;
  const v = new THREE.Vector3();
  model.updateWorldMatrix(true, true);
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry?.attributes?.position) return;
    o.frustumCulled = false;
    o.updateMatrixWorld(true);
    o.skeleton?.update();
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 720));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i);
      o.applyBoneTransform(i, v);
      v.applyMatrix4(o.matrixWorld);
      if (v.y < minY) minY = v.y;
    }
  });
  return minY;
}

const frostTint = new THREE.Color(0x9fd8ff);

function plantFeet(b) {
  const model = b.model;
  if (!model) return;
  if (b.per == null) {
    const y = model.position.y;
    b.g.updateWorldMatrix(true, true);
    const a = skinnedMinY(model);
    model.position.y = y + 1;
    b.g.updateWorldMatrix(true, true);
    const c = skinnedMinY(model);
    model.position.y = y;
    b.per = (c - a) || 1;
  }
  b.g.updateWorldMatrix(true, true);
  const minY = skinnedMinY(model);
  const err = b.g.position.y - minY;
  if (Math.abs(err) < 0.03) return;
  model.position.y += err / b.per;
}

let rimSerial = 0;

function fitMob(root, height) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = height / Math.max(size.y, 0.01);
  root.scale.multiplyScalar(k);
  root.position.y -= new THREE.Box3().setFromObject(root).min.y;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!src || src.type === 'MeshBasicMaterial') return;
    const mat = new THREE.MeshBasicMaterial({
      map: src.map || null,
      color: src.color ? src.color.clone() : new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
      alphaTest: src.alphaTest || 0,
    });
    // The boar albedo is nearly black, so the body disappears into the grass at the hold distance.
    if (/boar/i.test(o.name || '')) mat.color.multiplyScalar(2.4);
    o.material = mat;
    o.renderOrder = 1;
  });
  const skinned = [];
  root.traverse((o) => { if (o.isSkinnedMesh && o.skeleton && o.name !== 'rime') skinned.push(o); });
  for (const o of skinned) {
    const mid = new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).getCenter(new THREE.Vector3());
    const rimMat = new THREE.MeshBasicMaterial({ color: '#f7fbff', side: THREE.BackSide });
    const rimKey = 'rime-shell-' + (rimSerial++);
    rimMat.customProgramCacheKey = () => rimKey;
    rimMat.onBeforeCompile = (shader) => {
      shader.uniforms.rime = { value: 0.18 };
      shader.uniforms.mid = { value: mid };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float rime;\nuniform vec3 mid;')
        .replace('#include <project_vertex>', 'transformed = mid + (transformed - mid) * (1.0 + rime);\n#include <project_vertex>');
    };
    const rim = new THREE.SkinnedMesh(o.geometry, rimMat);
    rim.name = 'rime';
    rim.frustumCulled = false;
    rim.renderOrder = -1;
    rim.visible = false;
    rim.bind(o.skeleton, o.bindMatrix);
    rim.position.copy(o.position);
    rim.quaternion.copy(o.quaternion);
    rim.scale.copy(o.scale);
    o.parent.add(rim);
  }
}

// iOS Safari 17+ has createImageBitmap, so GLTFLoader decodes the embedded JPEG with
// ImageBitmapLoader. That call passes colorSpaceConversion:'none', which WebKit rejects
// (NotSupportedError). The rejection fails the whole GLB, and the stand-in shape stays.
export function patchWebKitImageBitmap() {
  if (typeof createImageBitmap !== 'function' || window.__aroBitmap) return;
  const ua = navigator.userAgent || '';
  const apple = /Safari\//.test(ua) && !/Chrom(e|ium)|CriOS|FxiOS|EdgiOS|Android/.test(ua);
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!apple && !ios) return;
  window.__aroBitmap = true;
  const native = createImageBitmap.bind(window);
  window.createImageBitmap = (source, ...args) => {
    const opt = args.find((a) => a && typeof a === 'object' && !ArrayBuffer.isView(a) && !(a instanceof Blob));
    const bare = args.filter((a) => a !== opt);
    const attempt = (options) => {
      try {
        const pending = options ? native(source, ...bare, options) : native(source, ...bare);
        return Promise.resolve(pending);
      } catch (err) {
        return Promise.reject(err);
      }
    };
    if (!opt) return attempt();
    const safe = { ...opt };
    delete safe.colorSpaceConversion;
    return attempt(Object.keys(safe).length ? safe : undefined).catch(() => attempt());
  };
}

let mobsReady = Promise.resolve(0);
async function dressMobs(all) {
  let done = () => {};
  mobsReady = new Promise((resolve) => { done = resolve; });
  let GLTFLoader;
  try {
    patchWebKitImageBitmap();
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (err) {
    console.warn('mob loader', err);
    done(0);
    return;
  }
  const loader = new GLTFLoader();
  const SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
  const cache = {};
  const kinds = [...new Set(all.map((b) => b.kind).filter((k) => TALL[k]))];
  await Promise.all(kinds.map((k) => {
    cache[k] = loader.loadAsync(new URL(`mobs/overaction/${k}.glb`, document.baseURI).href);
    return cache[k];
  })).catch((err) => console.warn('mob pack', err));
  for (const b of all) {
    if (!TALL[b.kind] || !cache[b.kind]) continue;
    try {
      const gltf = await cache[b.kind];
      const model = SkeletonUtils.clone(gltf.scene);
      fitMob(model, TALL[b.kind]);
      for (const child of [...b.g.children]) {
        if (child === b.bar || child.name === 'flame' || child.name === 'rime' || child.name === 'bleedtick' || child.name === 'siphonthread') continue;
        b.g.remove(child);
      }
      b.g.add(model);
      b.model = model;
      b.bar.position.y = TALL[b.kind] * 0.92;
      const mixer = new THREE.AnimationMixer(model);
      const clips = {};
      for (const clip of gltf.animations) {
        const key = String(clip.name || '').toLowerCase();
        if (!/idle|walk|run|attack|hit|death/.test(key) || clips[key]) continue;
        clips[key] = mixer.clipAction(clip);
      }
      b.clips = clips;
      mobMixers.push(mixer);
      playClip(b, 'idle');
      snapFace(model, b.kind);
      b.g.getObjectByName('standin')?.removeFromParent();
    } catch (err) {
      console.warn('mob', b.kind, err);
    }
  }
  done(all.filter((b) => TALL[b.kind] && b.model).length);
}

function one(kind, x, z) {
  const g = new THREE.Group();
  const standin = MAKE[kind]();
  standin.name = 'standin';
  g.add(standin);
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe23b32 }));
  bar.position.y = kind === 'slime' ? 0.85 : 1.15;
  bar.scale.set(0.7, 0.07, 1);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), new THREE.MeshBasicMaterial({ color: '#ff7a1c' }));
  flame.position.y = kind === 'slime' ? 0.7 : 1.05;
  flame.name = 'flame';
  flame.visible = false;
  const rime = new THREE.Group();
  rime.name = 'rime';
  rime.visible = false;
  for (let i = 0; i < 4; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: '#d7f4ff', transparent: true, opacity: 0.85 }));
    crystal.position.set(Math.sin(i * 1.6) * 0.28, 0.5 + (i % 2) * 0.28, Math.cos(i * 1.6) * 0.22);
    rime.add(crystal);
  }
  const bleedtick = new THREE.Group();
  bleedtick.name = 'bleedtick';
  bleedtick.visible = false;
  for (let i = 0; i < 3; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#c43838' }));
    drop.position.set((i - 1) * 0.12, 0.38 + i * 0.16, 0.22);
    bleedtick.add(drop);
  }
  const siphonthread = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.012, 6, 18),
    new THREE.MeshBasicMaterial({ color: '#7a4ad4', transparent: true, opacity: 0.85 }),
  );
  siphonthread.name = 'siphonthread';
  siphonthread.rotation.x = Math.PI / 2;
  siphonthread.position.y = 0.55;
  siphonthread.visible = false;
  g.add(bar, flame, rime, bleedtick, siphonthread);
  g.position.set(x, 0, z);
  return { kind, g, bar, homeX: x, homeZ: z, x, z, hp: HP[kind], max: HP[kind], flash: 0, dead: false, back: 0, tx: x, tz: z, wait: 1, burn: 0, chill: 0 };
}

export const PACKS = [
  { name: 'Beasts by the landing', x: -26, z: -8 },
  { name: 'Beasts near the logging camp', x: -64, z: -20 },
  { name: 'Beasts on the shore', x: -42, z: -34 },
];

export function createBeasts(scene, ground, world) {
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
  const drops = [];
  const slams = [];
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.7, 28), new THREE.MeshBasicMaterial({ color: '#ff5a45', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 6), new THREE.MeshBasicMaterial({ color: '#ffc2b0', transparent: true, opacity: 0.8 }));
  pillar.visible = false;
  scene.add(ring, pillar);
  const KINDS = ['gold', 'heal', 'mana'];
  function dropAt(b) {
    if (b.dropped) return;
    b.dropped = true;
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const geo = kind === 'gold' ? new THREE.OctahedronGeometry(0.16, 0) : new THREE.SphereGeometry(0.16, 8, 6);
    const color = kind === 'gold' ? '#ffd56a' : kind === 'heal' ? '#7dff9a' : '#9fd4ff';
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(b.g.position.x, ground(b.g.position.x, b.g.position.z) + 0.5, b.g.position.z);
    scene.add(mesh);
    drops.push({ kind, mesh, life: 18 });
  }
  return {
    meadow, lake,
    act(x, z, name) {
      let best = null;
      let bestD = 4;
      for (const b of all) {
        if (b.dead || b.dying > 0) continue;
        const d = Math.hypot(b.g.position.x - x, b.g.position.z - z);
        if (d < bestD) { best = b; bestD = d; }
      }
      if (best) playClip(best, name);
    },
    face(kind) { return faces[kind] || ''; },
    clip(kind) {
      const b = all.find((m) => m.kind === kind && m.clipName);
      return b ? b.clipName : '';
    },
    promote() {
      const b = all.find((m) => !m.dead && m.where === 'meadow' && m.kind === 'boar') || all.find((m) => !m.dead && m.where === 'meadow');
      if (!b) return -1;
      b.boss = true;
      b.max = 96;
      b.hp = 96;
      b.g.scale.setScalar(2.35);
      b.cool = 1.3;
      b.wind = 0;
      return all.indexOf(b);
    },
    collect(x, z, reach = 1.35) {
      const got = [];
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (Math.hypot(d.mesh.position.x - x, d.mesh.position.z - z) > reach) continue;
        got.push(d.kind);
        scene.remove(d.mesh);
        drops.splice(i, 1);
      }
      return got;
    },
    slams() { const out = slams.splice(0, slams.length); return out; },
    get mobsReady() { return mobsReady; },
    live() {
      return all.map((b, n) => ({ n, kind: b.kind, dead: b.dead, where: b.where, model: !!b.model, g: b.g }));
    },
    anchor(n, x, y, z, face) {
      const b = all[n];
      if (!b || b.dead) return;
      b.busy = true;
      b.g.visible = true;
      b.g.position.set(x, y, z);
      b.tx = x;
      b.tz = z;
      if (face != null) b.g.rotation.y = face;
    },
    releaseAnchor(n) {
      const b = all[n];
      if (!b) return;
      b.busy = false;
      b.g.position.set(b.homeX, ground(b.homeX, b.homeZ), b.homeZ);
      b.tx = b.homeX;
      b.tz = b.homeZ;
    },
    probe() {
      return all.map((b, n) => ({ n, kind: b.kind, boss: !!b.boss, x: +b.g.position.x.toFixed(2), y: +b.g.position.y.toFixed(2), z: +b.g.position.z.toFixed(2), hp: +b.hp.toFixed(1), burn: +b.burn.toFixed(2), chill: +b.chill.toFixed(2), dead: b.dead, flame: !!b.g.getObjectByName('flame')?.visible }));
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
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], c = all[j];
          if (a.dead || c.dead || a.where !== 'meadow' || c.where !== 'meadow') continue;
          const dx = c.g.position.x - a.g.position.x;
          const dz = c.g.position.z - a.g.position.z;
          const gap = Math.hypot(dx, dz);
          if (gap > 2.4 || gap < 1e-4) continue;
          const push = (2.4 - gap) * 0.35;
          const nx = dx / gap, nz = dz / gap;
          a.g.position.x -= nx * push; a.g.position.z -= nz * push;
          c.g.position.x += nx * push; c.g.position.z += nz * push;
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
          if (m.status === 'chill') b.chill = Math.min(8, b.chill + (m.chill != null ? m.chill : 1.4));
          if (m.bleed) b.bleed = Math.max(b.bleed || 0, m.bleed);
          if (m.siphon) b.siphon = Math.max(b.siphon || 0, m.siphon);
          if (m.radial) {
            let ox = b.g.position.x - m.x, oz = b.g.position.z - m.z;
            const len = Math.hypot(ox, oz) || 0.4;
            const push = m.radial * addFall;
            ox /= len; oz /= len;
            b.g.position.x += ox * push; b.g.position.z += oz * push;
            b.tx += ox * push; b.tz += oz * push;
          } else if (m.pull) {
            let ox = m.x - b.g.position.x, oz = m.z - b.g.position.z;
            const len = Math.hypot(ox, oz) || 0.4;
            if (len > 0.7) { const step = m.pull * addFall; b.g.position.x += (ox / len) * step; b.g.position.z += (oz / len) * step; b.tx += (ox / len) * step; b.tz += (oz / len) * step; }
          } else if (!same && (m.kx || m.kz)) { b.g.position.x += m.kx; b.g.position.z += m.kz; b.tx += m.kx; b.tz += m.kz; }
          if (!same && shown < 3) {
            shown++;
            b.stack = (b.stack || 0) + 1;
            onHit?.({ x: b.g.position.x, y: b.g.position.y + 1.2, z: b.g.position.z, n: Math.round(dealt), k: m.k || 'fire', through: again, blast: !!m.blast });
          }
          if (b.hp <= 0) {
            b.dead = true; b.back = 12; b.stack = 0; b.burn = 0; b.chill = 0; dropAt(b); b.boss = false;
            if (b.clips?.death) { b.dying = Math.max(0.9, b.clips.death.getClip().duration || 1); playClip(b, 'death'); }
            else b.g.visible = false;
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
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life -= dt;
        d.mesh.rotation.y += dt * 2;
        d.mesh.position.y += Math.sin(d.life * 4) * 0.002;
        if (d.life <= 0) { scene.remove(d.mesh); drops.splice(i, 1); }
      }
      meadow.visible = zone === 'meadow';
      lake.visible = zone === 'lake';
      for (const b of all) {
        if (b.where !== zone) continue;
        if (b.dead) {
          if (b.dying > 0) {
            b.dying -= dt;
            b.g.position.y = ground(b.g.position.x, b.g.position.z);
            if (b.dying <= 0) b.g.visible = false;
            continue;
          }
          b.back -= dt;
          if (b.back <= 0) {
            b.dead = false; b.hp = b.max; b.g.visible = true; b.flash = 0; b.dropped = false; b.boss = false;
            b.g.position.set(b.homeX, ground(b.homeX, b.homeZ), b.homeZ);
            b.g.rotation.z = 0;
            b.g.scale.setScalar(1.4);
          }
          continue;
        }
        if (b.model) b.g.getObjectByName('standin')?.removeFromParent();
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
        if (b.boss) {
          b.cool = (b.cool ?? 1.4) - dt;
          if (!b.wind && b.cool <= 0) { b.wind = 0.85; b.cool = 4.4; }
          if (b.wind > 0) {
            b.wind -= dt;
            const gy = ground(b.g.position.x, b.g.position.z);
            ring.visible = true;
            ring.position.set(b.g.position.x, gy + 0.08, b.g.position.z);
            ring.scale.setScalar(0.4 + (1 - Math.max(0, b.wind) / 0.85) * 0.75);
            pillar.visible = true;
            pillar.position.set(b.g.position.x, gy + 1.1, b.g.position.z);
            if (b.wind <= 0) {
              b.wind = 0;
              ring.visible = false;
              pillar.visible = false;
              slams.push({ x: b.g.position.x, z: b.g.position.z, r: 2.3 });
            }
          }
        }
        const slow = 1 - Math.min(0.68, b.chill / 8);
        const ice = world?.iceCols;
        if (ice) for (const c of ice) {
          const ix = b.g.position.x - c.x, iz = b.g.position.z - c.z, id = Math.hypot(ix, iz);
          if (id < c.r && id > 1e-4) { b.g.position.x = c.x + (ix / id) * c.r; b.g.position.z = c.z + (iz / id) * c.r; }
        }
        const dx = b.tx - b.g.position.x, dz = b.tz - b.g.position.z, dist = Math.hypot(dx, dz);
        if (dist > 0.15) {
          b.g.position.x += (dx / dist) * 0.55 * slow * dt;
          b.g.position.z += (dz / dist) * 0.55 * slow * dt;
          b.g.rotation.y = Math.atan2(dx, dz);
        }
        if (b.burn > 0) { b.burn -= dt; b.hp -= 7 * dt; if (b.hp <= 0) { b.dead = true; b.g.visible = false; b.back = 12; b.burn = 0; dropAt(b); b.boss = false; } }
        else b.burn = 0;
        if (b.chill > 0) b.chill -= dt; else b.chill = 0;
        if (b.bleed > 0) { b.bleed -= dt; b.hp -= 5 * dt; if (b.hp <= 0) { b.dead = true; b.g.visible = false; b.back = 12; b.bleed = 0; dropAt(b); } }
        if (b.siphon > 0) { b.siphon -= dt; b.hp -= 3.5 * dt; }
        const flame = b.g.getObjectByName('flame');
        if (flame) { flame.visible = b.burn > 0; flame.scale.y = 0.7 + Math.sin(performance.now() * 0.02) * 0.35; }
        const rime = b.g.getObjectByName('rime');
        if (rime) rime.visible = b.chill > 0.2;
        const bleedG = b.g.getObjectByName('bleedtick');
        if (bleedG) bleedG.visible = b.bleed > 0.2;
        const sip = b.g.getObjectByName('siphonthread');
        if (sip) { sip.visible = b.siphon > 0.2; sip.rotation.z += dt * 2; }
        b.g.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const tag = o.name || o.parent?.name;
          if (tag === 'rime' || tag === 'bleedtick' || tag === 'siphonthread') return;
          if (!o.material.color || o.name === 'flame') return;
          if (!o.userData.base) o.userData.base = o.material.color.getHex();
          const u = Math.min(1, b.chill / 6);
          o.material.color.setHex(o.userData.base).lerp(frostTint, u * 0.9);
          if (b.bleed > 0.2) o.material.color.lerp(new THREE.Color('#c43838'), 0.35);
          if (b.siphon > 0.2) o.material.color.lerp(new THREE.Color('#7a4ad4'), 0.4);
        });
        b.g.position.y = ground(b.g.position.x, b.g.position.z);
        if (b.model) plantFeet(b);
        if ((b.flash > 0 || b.flinch > 0) && b.clips?.hit && b.clipName !== 'hit' && b.clipName !== 'attack') playClip(b, 'hit');
        else if (b.clipName === 'attack' || b.clipName === 'hit') { if (clipDone(b)) playClip(b, 'idle'); }
        else if (dist > 0.2) playClip(b, b.clips?.run ? 'run' : b.clips?.walk ? 'walk' : 'idle');
        else if (b.clipName && b.clipName !== 'idle') playClip(b, 'idle');
        if (b.flash > 0) {
          b.flash -= dt;
          b.g.scale.y = 1.4 * (b.clips ? 0.94 : 0.72);
          b.g.position.x += (Math.random() - 0.5) * 0.04;
        } else b.g.scale.y = 1.4;
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
