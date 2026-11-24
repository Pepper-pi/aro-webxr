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

function footTell(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = 'tell';
  return ring;
}
function propUmbrella() {
  const g = new THREE.Group();
  g.name = 'brolly';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), new THREE.MeshLambertMaterial({ color: '#6a5344' }));
  pole.position.set(0.2, 1.15, 0.04);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.16, 8), new THREE.MeshLambertMaterial({ color: '#c45a4a' }));
  cap.position.set(0.2, 1.6, 0.04);
  g.add(pole, cap);
  g.visible = false;
  return g;
}
function propLantern() {
  const g = new THREE.Group();
  g.name = 'lantern';
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
  glow.position.set(-0.22, 0.82, 0.08);
  g.add(glow);
  g.visible = false;
  return g;
}
function say(sprite, text) {
  if (!sprite?.material?.map?.image) return;
  const c = sprite.material.map.image;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  if (text) {
    g.fillStyle = 'rgba(20, 12, 28, 0.82)';
    g.fillRect(8, 8, 112, 48);
    g.fillStyle = '#fff6dc';
    g.font = '26px Georgia';
    g.textAlign = 'center';
    g.fillText(text, 64, 42);
  }
  sprite.material.map.needsUpdate = true;
  sprite.visible = !!text;
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
    if (zones.town?.ready) await zones.town.ready;
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
    const idleClip = gltf.animations.find((a) => /idle/i.test(a.name)) || gltf.animations[0];
    const walkClip = gltf.animations.find((a) => /walk/i.test(a.name));
    const idle = idleClip ? mixer.clipAction(idleClip) : null;
    const walk = walkClip ? mixer.clipAction(walkClip) : null;
    idle?.play();
    return { model, mixer, head: headOf(model), idle, walk };
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
    const square = zones.town?.square;
    const porches = () => zones.town?.porches || [];
    const doors = porches();
    const spots = (square?.benches?.length ? [...square.benches, ...(square.stalls || []), square.well].filter(Boolean) : null)
      || (doors.length ? doors : [{ x: -4, z: 24, yaw: 0, y: world.ground(-4, 24) }]);
    const n = Math.min(cap, Math.max(2, spots.length));
    for (let i = 0; i < n; i++) {
      const seed = hash(`folk|${i}|${ctx.weather}`);
      const rnd = rngOf(seed);
      const home = spots[i % spots.length];
      const made = body(seed, 1);
      const node = new THREE.Group();
      const bubble = emote();
      const brolly = propUmbrella();
      const lantern = propLantern();
      node.add(made.model, bubble, brolly, lantern);
      node.position.set(home.x, world.ground(home.x, home.z), home.z);
      node.rotation.y = home.yaw || 0;
      root.add(node);
      people.push({
        node, mixer: made.mixer, head: made.head, idle: made.idle, walk: made.walk, moving: false, home, seed, rnd,
        pace: 0.65 + rnd() * 0.7,
        look: rnd() * Math.PI * 2,
        act: 'sweep',
        plan: ['sweep', 'water', 'notice', 'well'].map((_, k) => ['sweep', 'water', 'notice', 'well'][(i + k + (seed % 2)) % 4]),
        t: rnd() * 4,
        react: '',
        reactT: 0,
        waveCool: 2 + rnd() * 3,
        bubble, brolly, lantern,
        from: home,
        to: spots[(i + 1) % spots.length],
        goal: spots[(i + 1) % spots.length],
        bench: square?.benches?.[i % Math.max(1, square.benches.length)] || home,
        stall: square?.stalls?.[i % Math.max(1, square.stalls.length)] || home,
        well: square?.well || home,
        pair: null, inside: 0, tier: 'common',
      });
    }
    if (visit.shimmer) {
      const kind = visit.tier === 'mythic' ? 'lost-kid' : (hash(ctx.weather) % 2 ? 'boba-vendor' : 'traveling-bard');
      const spot = kind === 'boba-vendor' ? (square?.stalls?.[0] || spots[0])
        : kind === 'traveling-bard' ? (square?.well || spots[0])
          : (square?.benches?.[0] || spots[0]);
      const made = body(hash(kind), kind === 'lost-kid' ? 0.72 : 1);
      const node = new THREE.Group();
      const bubble = emote();
      node.add(made.model, bubble, footTell(TELL[visit.tier] || TELL.rare));
      const x = spot.x + 1.4;
      const z = spot.z + 1.1;
      node.position.set(x, world.ground(x, z), z);
      root.add(node);
      people.push({
        node, mixer: made.mixer, head: made.head, idle: made.idle, walk: made.walk, moving: false, home: spot, seed: hash(kind), rnd: rngOf(hash(kind)),
        pace: kind === 'lost-kid' ? 0.45 : 0.8,
        look: 0.4,
        act: kind === 'boba-vendor' ? 'read' : kind === 'traveling-bard' ? 'stretch' : 'sit',
        t: 0, from: spot, to: spot, goal: spot, bench: square?.benches?.[0] || spot, stall: square?.stalls?.[0] || spot, well: square?.well || spot, pair: null, inside: 0,
        tier: visit.tier, id: kind, visitor: true, bubble, brolly: null, lantern: null, plan: ['sit'], react: '', reactT: 0, waveCool: 4,
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

  function spotFor(p, act) {
    if (act === 'sweep' || act === 'home') return p.home;
    if (act === 'water') return { x: (p.well?.x || p.home.x) + 1.35, z: (p.well?.z || p.home.z) + 0.4, yaw: p.well?.yaw || 0 };
    if (act === 'notice') return zones.town?.square?.notice || p.stall || p.home;
    if (act === 'well' || act === 'chat') return p.well || p.home;
    return p.home;
  }
  function go(p, act) {
    const spot = spotFor(p, act);
    if (Math.hypot(spot.x - p.node.position.x, spot.z - p.node.position.z) > 1.1) {
      p.next = act;
      p.goal = spot;
      p.act = 'walk';
    } else p.act = act;
    p.t = 0;
  }
  function schedule(p, dusk) {
    const hour = new Date().getHours();
    if (dusk || hour >= 19 || hour < 6) return 'home';
    const band = hour < 11 ? 0 : hour < 15 ? 1 : 2;
    return (p.plan || ['sweep', 'water', 'notice', 'well'])[band] || 'sweep';
  }
  function stepPerson(p, dt, walker, dist, dusk, extra, visitor) {
    if (dist > near) return;
    const wantWalk = p.act === 'walk' && p.inside <= 0;
    if (wantWalk !== p.moving) {
      p.moving = wantWalk;
      const on = wantWalk && p.walk ? p.walk : p.idle;
      const off = on === p.walk ? p.idle : p.walk;
      if (on) { on.reset().fadeIn(0.18).play(); off?.fadeOut(0.18); }
    }
    p.mixer?.update(dt * (wantWalk ? Math.max(0.85, p.pace) : p.pace));
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
        if (p.next) {
          p.act = p.next;
          p.next = null;
        } else {
          const back = p.goal === p.to ? p.from : p.to;
          p.goal = back;
          p.act = dusk ? 'gather' : 'read';
          if (p.act === 'gather') p.goal = p.well || p.goal;
        }
      }
    } else if (p.act === 'sit') {
      p.node.position.y = y - 0.35;
      if (p.bench) p.node.rotation.y = p.bench.yaw;
    } else if (p.act === 'gather') {
      if (p.well) p.node.rotation.y = Math.atan2(p.well.x - p.node.position.x, p.well.z - p.node.position.z);
    } else if (p.act === 'stretch') {
      p.node.scale.y = 1 + Math.sin(performance.now() * 0.004 + p.look) * 0.03;
    } else if (p.act === 'sweep') {
      p.node.rotation.y = (p.home.yaw || 0) + Math.sin(performance.now() * 0.003 * p.pace) * 0.35;
    } else if (p.act === 'window' || p.act === 'read' || p.act === 'feed' || p.act === 'notice' || p.act === 'water') {
      const face = p.act === 'water' ? (p.well || p.home) : (p.stall || p.home);
      p.node.rotation.y = (face?.yaw || 0) + Math.sin(performance.now() * 0.002 + p.look) * 0.2;
    } else if (p.act === 'home') {
      p.node.rotation.y = p.home.yaw || 0;
    } else if (p.act === 'watch' && visitor) {
      p.node.rotation.y = Math.atan2(visitor.node.position.x - p.node.position.x, visitor.node.position.z - p.node.position.z);
    } else if (p.act === 'search') {
      p.node.rotation.y += dt * 0.6;
    }
    if (p.act !== 'sit') p.node.position.y = y;
    p.t += dt;
    const rain = extra?.weather === 'rain';
    if (p.brolly) p.brolly.visible = !!(rain && p.act !== 'home' && p.react !== 'gasp');
    if (p.lantern) p.lantern.visible = p.act === 'home' || (dusk && p.act === 'walk' && p.next === 'home');
    if (!p.visitor && p.reactT <= 0) {
      if (rain && p.seed % 2 === 0) {
        if (p.duty !== 'eave') { p.duty = 'eave'; go(p, 'home'); }
      } else {
        const due = schedule(p, dusk);
        if (due !== p.duty) { p.duty = due; go(p, due); }
      }
    }
    if (p.visitor) {
      p.node.rotation.z = Math.sin(performance.now() * 0.0015 + p.look) * 0.03;
    }
    if (!p.visitor && visitor && p.reactT <= 0 && p.act !== 'walk') {
      const kind = visitor.id;
      const line = kind === 'boba-vendor' ? (p.stall || visitor.home) : kind === 'traveling-bard' ? (p.well || visitor.home) : (visitor.home || p.bench);
      const queue = kind === 'boba-vendor' ? (p.seed % 3) * 0.7 : kind === 'lost-kid' ? 1.2 : 0.8;
      const gx = line.x + Math.cos(p.seed) * queue;
      const gz = line.z + Math.sin(p.seed) * queue;
      if (Math.hypot(gx - p.node.position.x, gz - p.node.position.z) > 1.4) {
        p.next = kind === 'lost-kid' ? 'search' : 'watch';
        p.goal = { x: gx, z: gz, yaw: 0 };
        p.act = 'walk';
        p.t = 0;
      } else if (kind === 'lost-kid') {
        p.act = 'search';
        say(p.bubble, '?');
      } else p.act = 'watch';
    }
    if (extra?.big && dist < 9 && p.react !== 'gasp') {
      p.react = 'gasp';
      p.reactT = 1.6;
      say(p.bubble, '!');
      const away = Math.atan2(p.node.position.x - walker.feet.x, p.node.position.z - walker.feet.z);
      p.goal = { x: p.node.position.x + Math.sin(away) * 1.4, z: p.node.position.z + Math.cos(away) * 1.4, yaw: 0 };
      p.act = 'walk';
      p.next = p.duty || 'sweep';
    } else if (dist < 3.4 && p.waveCool <= 0 && p.reactT <= 0 && !p.visitor) {
      p.react = 'wave';
      p.reactT = 1.1;
      p.waveCool = 8;
      say(p.bubble, 'hi');
      p.node.rotation.y = Math.atan2(walker.feet.x - p.node.position.x, walker.feet.z - p.node.position.z);
    }
    if (p.reactT > 0) {
      p.reactT -= dt;
      if (p.reactT <= 0) { p.react = ''; say(p.bubble, ''); }
    } else if (p.waveCool > 0) p.waveCool -= dt;
    const pet = extra?.pet;
    const lookAt = pet && Math.hypot(pet.x - p.node.position.x, pet.z - p.node.position.z) < 6 ? pet : (dist < 5 ? walker.feet : null);
    if (lookAt && p.head) {
      const face = Math.atan2(lookAt.x - p.node.position.x, lookAt.z - p.node.position.z);
      const spin = Math.atan2(Math.sin(face - p.node.rotation.y), Math.cos(face - p.node.rotation.y));
      p.head.rotation.y = THREE.MathUtils.clamp(spin, -0.7, 0.7);
    } else if (p.head) p.head.rotation.y *= 0.9;
    if (!p.react && p.act !== 'search') bubble.visible = !!p.pair && dist < detail;
  }

  return {
    ready,
    update(dt, walker, dusk, extra) {
      if (!people.length && finds.length === 0) return;
      for (const row of finds) discover(row, walker);
      for (const b of zones.live?.() || []) {
        if (!b.shimmer || b.noted) continue;
        if (Math.hypot(walker.feet.x - b.g.position.x, walker.feet.z - b.g.position.z) > 8) continue;
        b.noted = true;
        living.sight(b.kind, { where: b.where || 'meadow', tier: b.tier, shimmer: true, ctx: living.context('meadow') });
      }
      const visitor = people.find((p) => p.visitor);
      const active = [];
      for (const p of people) {
        const dist = Math.hypot(walker.feet.x - p.node.position.x, walker.feet.z - p.node.position.z);
        if (dist > near) continue;
        active.push(p);
        stepPerson(p, dt, walker, dist, dusk, extra, visitor);
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
