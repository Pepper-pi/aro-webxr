// Town people and the day's rare finds. Clips are the Quaternius hearth idles (CC0).
// Head turns and arm accents are posed on top. Far people skip the detail.
import * as THREE from 'three';

const ACTS = ['sweep', 'sit', 'window', 'feed', 'stretch', 'read', 'walk'];
const TELL = { rare: '#7ec8ff', epic: '#e7c56a', mythic: '#f2a0ff' };
const FILES = ['hearth/people/you.glb', 'hearth/people/bram.glb', 'hearth/people/sable.glb'];

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emote() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20, 12, 28, 0.82)';
  g.fillRect(8, 8, 112, 48);
  g.fillStyle = '#fff6dc';
  g.font = '28px Georgia';
  g.textAlign = 'center';
  g.fillText('…', 64, 40);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(0.7, 0.35, 1);
  s.position.y = 2.05;
  s.visible = false;
  return s;
}

function aura(color, lite) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.55, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  if (!lite) {
    for (let i = 0; i < 4; i++) {
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
      mote.userData.i = i;
      g.add(mote);
    }
  }
  return g;
}

function plant(color) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.35, 5), new THREE.MeshLambertMaterial({ color: '#3d6a34' }));
  stem.position.y = 0.18;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshLambertMaterial({ color }));
  head.position.y = 0.4;
  g.add(stem, head);
  return g;
}

export function createFolk({ scene, world, living, zones, phone }) {
  const root = new THREE.Group();
  root.name = 'folk';
  scene.add(root);
  const people = [];
  const finds = [];
  let templates = [];
  const cap = phone ? 3 : 5;
  const near = phone ? 22 : 42;
  const detail = phone ? 12 : 26;

  const ready = (async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const loaded = await Promise.all(FILES.map((path) => loader.loadAsync(new URL(path, document.baseURI).href).catch(() => null)));
    templates = loaded.filter(Boolean);
    spawn();
  })().catch((err) => console.warn('folk', err));

  function headOf(model) {
    let bone = null;
    model.traverse((o) => { if (!bone && o.isBone && /head/i.test(o.name)) bone = o; });
    return bone;
  }

  function body(seed, scale = 1) {
    const gltf = templates[seed % Math.max(1, templates.length)];
    if (!gltf) {
      const g = new THREE.Group();
      const shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), new THREE.MeshLambertMaterial({ color: '#c4a574' }));
      shirt.position.y = 1.05;
      const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 4, 6), new THREE.MeshLambertMaterial({ color: '#3a342c' }));
      legs.position.y = 0.45;
      g.add(shirt, legs);
      return { model: g, mixer: null, head: null };
    }
    const model = gltf.scene.clone(true);
    model.traverse((o) => { o.frustumCulled = false; });
    const box = new THREE.Box3().setFromObject(model);
    const h = box.getSize(new THREE.Vector3()).y || 1;
    model.scale.setScalar((1.6 * scale) / h);
    model.position.y -= new THREE.Box3().setFromObject(model).min.y;
    const mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find((a) => /idle/i.test(a.name)) || gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
    return { model, mixer, head: headOf(model) };
  }

  function markFind(mesh, id, tier, x, z) {
    const row = { id, tier, x, z, mesh, seen: false, shimmer: TELL[tier] };
    if (row.shimmer) mesh.add(aura(row.shimmer, phone));
    finds.push(row);
    root.add(mesh);
  }

  function spawn() {
    const ctx = living.context('meadow');
    const beasts = zones.live?.() || [];
    for (const b of beasts) {
      if (b.tier) continue;
      const rolled = living.rollSeeded('beast', `${b.kind}:${b.homeX}:${b.homeZ}`, ctx);
      b.tier = rolled.tier;
      b.shimmer = rolled.shimmer;
      if (rolled.shimmer) b.g.add(aura(TELL[rolled.tier] || TELL.rare, phone));
    }
    const herbs = [[-8, 33], [-20, 19], [24, 40], [-52, -16]];
    herbs.forEach(([x, z], i) => {
      const rolled = living.rollSeeded('critter', `herb:${i}`, ctx);
      const tint = rolled.tier === 'mythic' ? '#f2a0ff' : rolled.tier === 'rare' ? '#9fd4ff' : '#7dff9a';
      const mesh = plant(tint);
      mesh.position.set(x, world.ground(x, z), z);
      markFind(mesh, rolled.tier === 'rare' || rolled.tier === 'mythic' ? 'glowwisp' : 'moonherb', rolled.tier, x, z);
    });
    const visit = living.rollSeeded('npc', 'visitor', ctx);
    const porches = () => zones.town?.porches || [];
    const doors = porches();
    const spots = doors.length ? doors : [{ x: -10, z: 33, yaw: 0, y: world.ground(-10, 33) }];
    const n = Math.min(cap, Math.max(2, spots.length));
    for (let i = 0; i < n; i++) {
      const seed = hash(`folk|${i}|${ctx.weather}`);
      const rnd = rngOf(seed);
      const home = spots[i % spots.length];
      const made = body(seed, 1);
      const node = new THREE.Group();
      node.add(made.model, emote());
      node.position.set(home.x, world.ground(home.x, home.z), home.z);
      node.rotation.y = home.yaw || 0;
      root.add(node);
      people.push({
        node, mixer: made.mixer, head: made.head, home, seed, rnd,
        pace: 0.65 + rnd() * 0.7,
        look: rnd() * Math.PI * 2,
        act: ACTS[Math.floor(rnd() * ACTS.length)],
        t: rnd() * 4,
        from: home,
        to: spots[(i + 1) % spots.length],
        goal: spots[(i + 1) % spots.length],
        pair: null, inside: 0, tier: 'common',
      });
    }
    if (visit.shimmer) {
      const kind = visit.tier === 'mythic' ? 'lost-kid' : (hash(ctx.weather) % 2 ? 'boba-vendor' : 'traveling-bard');
      const spot = spots[spots.length - 1] || spots[0];
      const made = body(hash(kind), kind === 'lost-kid' ? 0.72 : 1);
      const node = new THREE.Group();
      node.add(made.model, emote());
      node.add(aura(TELL[visit.tier] || TELL.rare, phone));
      const x = spot.x + 1.4;
      const z = spot.z + 1.1;
      node.position.set(x, world.ground(x, z), z);
      root.add(node);
      people.push({
        node, mixer: made.mixer, head: made.head, home: spot, seed: hash(kind), rnd: rngOf(hash(kind)),
        pace: kind === 'lost-kid' ? 0.45 : 0.8,
        look: 0.4,
        act: kind === 'boba-vendor' ? 'read' : kind === 'traveling-bard' ? 'stretch' : 'window',
        t: 0, from: spot, to: spot, goal: spot, pair: null, inside: 0,
        tier: visit.tier, id: kind, visitor: true,
      });
      finds.push({ id: kind, tier: visit.tier, x, z, mesh: node, seen: false, shimmer: true });
    }
  }

  function discover(row, walker) {
    if (row.seen) return;
    if (Math.hypot(walker.feet.x - row.x, walker.feet.z - row.z) > 8) return;
    row.seen = true;
    living.sight(row.id, { where: 'meadow', tier: row.tier, shimmer: !!row.shimmer, ctx: living.context('meadow') });
  }

  function stepPerson(p, dt, walker, dist) {
    if (dist > near) return;
    p.mixer?.update(dt * p.pace);
    const bubble = p.node.children.find((c) => c.isSprite);
    if (p.inside > 0) {
      p.inside -= dt;
      p.node.visible = false;
      if (p.inside <= 0) {
        p.node.visible = true;
        p.act = 'walk';
        p.t = 0;
      }
      return;
    }
    p.node.visible = true;
    const y = world.ground(p.node.position.x, p.node.position.z);
    if (p.act === 'walk') {
      const dx = p.goal.x - p.node.position.x;
      const dz = p.goal.z - p.node.position.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = Math.min(len, dt * (0.9 + p.pace));
      p.node.position.x += (dx / len) * step;
      p.node.position.z += (dz / len) * step;
      p.node.rotation.y = Math.atan2(dx, dz);
      if (len < 0.4) {
        const back = p.goal === p.to ? p.from : p.to;
        p.goal = back;
        p.inside = p.visitor ? 0 : 4 + (p.seed % 5);
        if (!p.inside) p.act = 'read';
      }
    } else if (p.act === 'sit') {
      p.node.position.y = y - 0.35;
    } else if (p.act === 'stretch') {
      p.node.scale.y = 1 + Math.sin(performance.now() * 0.004 + p.look) * 0.03;
    } else if (p.act === 'sweep') {
      p.node.rotation.y = (p.home.yaw || 0) + Math.sin(performance.now() * 0.003 * p.pace) * 0.35;
    } else if (p.act === 'window' || p.act === 'read' || p.act === 'feed') {
      p.node.rotation.y = (p.home.yaw || 0) + Math.PI + p.look * 0.15;
    }
    if (p.act !== 'sit') p.node.position.y = y;
    p.t += dt;
    if (p.act !== 'walk' && p.t > 6 + (p.seed % 4)) {
      p.t = 0;
      p.act = ACTS[Math.floor(p.rnd() * ACTS.length)];
      if (p.act === 'walk' && !p.visitor) p.goal = p.home === p.goal ? p.home : p.goal;
    }
    if (dist < 5 && p.head) {
      const face = Math.atan2(walker.feet.x - p.node.position.x, walker.feet.z - p.node.position.z);
      const spin = Math.atan2(Math.sin(face - p.node.rotation.y), Math.cos(face - p.node.rotation.y));
      p.head.rotation.y = THREE.MathUtils.clamp(spin, -0.6, 0.6);
    } else if (p.head) p.head.rotation.y *= 0.9;
    if (bubble) bubble.visible = !!p.pair && dist < detail;
  }

  return {
    ready,
    update(dt, walker) {
      if (!people.length && finds.length === 0) return;
      for (const row of finds) discover(row, walker);
      for (const b of zones.live?.() || []) {
        if (!b.shimmer || b.noted) continue;
        if (Math.hypot(walker.feet.x - b.g.position.x, walker.feet.z - b.g.position.z) > 8) continue;
        b.noted = true;
        living.sight(b.kind, { where: b.where || 'meadow', tier: b.tier, shimmer: true, ctx: living.context('meadow') });
      }
      const active = [];
      for (const p of people) {
        const dist = Math.hypot(walker.feet.x - p.node.position.x, walker.feet.z - p.node.position.z);
        if (dist > near) continue;
        active.push(p);
        stepPerson(p, dt, walker, dist);
      }
      for (let i = 0; i < active.length; i++) {
        const a = active[i];
        if (a.pair || a.visitor || a.inside > 0) continue;
        for (let j = i + 1; j < active.length; j++) {
          const b = active[j];
          if (b.pair || b.visitor || b.inside > 0) continue;
          const d = Math.hypot(a.node.position.x - b.node.position.x, a.node.position.z - b.node.position.z);
          if (d > 2.6 || a.rnd() > 0.01) continue;
          a.pair = b;
          b.pair = a;
          a.t = 0;
          b.t = 0;
          a.act = 'chat';
          b.act = 'chat';
          break;
        }
      }
      for (const p of people) {
        if (!p.pair) continue;
        const other = p.pair;
        if (!other.pair) { p.pair = null; continue; }
        p.node.rotation.y = Math.atan2(other.node.position.x - p.node.position.x, other.node.position.z - p.node.position.z);
        if (p.t > 5.5) { p.pair = null; other.pair = null; p.act = 'walk'; other.act = 'walk'; }
      }
      const t = performance.now() * 0.001;
      root.traverse((o) => {
        if (typeof o.userData?.i !== 'number') return;
        const a = t * 1.3 + o.userData.i;
        o.position.set(Math.cos(a) * 0.45, 0.7 + Math.sin(a * 2) * 0.15, Math.sin(a) * 0.45);
      });
    },
  };
}
