// Super Hexes sit on the meadow ground. Borders follow the terrain. Trees are not touched.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const KEY = 'aro-hex-xp';
const SIZE = 11;
const ROOT = { x: 2, z: 22 };

const HEXES = [
  { id: 'hearth', name: 'Hearth Square', theme: 'Hearth', q: 0, r: 0, tint: '#e7c56a', accent: '#fff1c4',
    spawns: 'No beasts. A safe square.', features: 'Lantern cobbles and a warm rim.',
    next: 'Tier II brightens the lanterns. Tier III raises a gold beacon.' },
  { id: 'meadow', name: 'Wildflower Pasture', theme: 'Sunlit Meadow', q: 1, r: 0, tint: '#d2e27a', accent: '#fff6b0',
    spawns: 'A pasture bunny and a deer.', features: 'Pollen and flower knots.',
    next: 'Tier II thickens the pollen. Tier III adds a golden wisp ring.' },
  { id: 'moss', name: 'Moss Creek', theme: 'Forest Creek', q: 0, r: 1, tint: '#1f8f62', accent: '#b6ffe0',
    spawns: 'A creek wolf and a boar. Herb nodes.', features: 'A creek, moss stones, forest motes.',
    next: 'Tier II shimmers the creek. Tier III lights it and calls an elite.' },
  { id: 'shore', name: 'Tide Reeds', theme: 'Lakeshore', q: -1, r: 1, tint: '#3ec8c0', accent: '#d8fff8',
    spawns: 'A shore crab and a fish.', features: 'A water edge, reeds, pebbles. Ties to Long Lake.',
    next: 'Tier II animates the shallows. Tier III adds a dusk glow and bonus catch XP.' },
  { id: 'glen', name: 'Fern Glen', theme: 'Forest Creek', q: 1, r: -1, tint: '#146b48', accent: '#9dffd2',
    spawns: 'A glen goblin and a fox.', features: 'Moss and a short rill.',
    next: 'Same forest ladder as Moss Creek.' },
  { id: 'bloom', name: 'Buttercup Reach', theme: 'Sunlit Meadow', q: -1, r: 0, tint: '#e6d15a', accent: '#fff3c4',
    spawns: 'A buttercup cow and a slime.', features: 'Warm pasture tint.',
    next: 'Same meadow ladder as Wildflower Pasture.' },
  { id: 'landing', name: 'Lantern Gate', theme: 'Hearth', q: 0, r: -1, tint: '#f0b45a', accent: '#ffe7b0',
    spawns: 'Safe ground. No fight.', features: 'A gate of warm stones.',
    next: 'Tier II gilds the stones. Tier III lifts a beacon.' },
];

function axial(q, r) {
  const x = SIZE * Math.sqrt(3) * (q + r / 2);
  const z = SIZE * 1.5 * r;
  return { x: ROOT.x + x, z: ROOT.z + z };
}

function hexRadius(ang) {
  const local = ((ang + Math.PI / 6) % (Math.PI / 3) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6;
  return Math.cos(Math.PI / 6) / Math.cos(local);
}

function loadXp() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveXp(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}
function tierOf(xp) { return xp >= 110 ? 3 : xp >= 40 ? 2 : 1; }
function need(tier) { return tier >= 3 ? 110 : tier === 2 ? 40 : 0; }
function nextNeed(tier) { return tier >= 3 ? 110 : tier === 2 ? 110 : 40; }

const FIGHT = {
  moss: ['wolf', 'boar'],
  glen: ['goblin', 'fox'],
  meadow: ['bunny', 'deer'],
  bloom: ['cow', 'slime'],
  shore: ['crab', 'fish'],
};

export function createHexes(scene, world, camera, walker, zones) {
  const group = new THREE.Group();
  group.name = 'super-hexes';
  scene.add(group);
  const xp = loadXp();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const built = HEXES.map((def) => {
    const at = axial(def.q, def.r);
    const node = new THREE.Group();
    node.position.set(at.x, 0, at.z);
    const fill = fillMesh(at.x, at.z, def.tint);
    const edge = edgeLine(at.x, at.z, SIZE * 0.96, def.accent);
    const glow = ribbon(at.x, at.z, def.accent);
    const outer = edgeLine(at.x, at.z, SIZE * 1.22, '#ffe27a');
    const aurora = auroraOf();
    outer.visible = false;
    const runes = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 - Math.PI / 6;
      const x = Math.cos(a) * SIZE;
      const z = Math.sin(a) * SIZE;
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: def.accent }));
      rune.scale.set(1, 0.35, 1);
      rune.position.set(x, world.ground(at.x + x, at.z + z) + 0.06, z);
      runes.add(rune);
    }
    const motes = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.85 }));
      node.add(m);
      motes.push(m);
    }
    const water = def.theme === 'Forest Creek' || def.theme === 'Lakeshore' ? creek(def.theme) : null;
    const stones = def.theme === 'Forest Creek' ? stonesOf('#6d8a72') : def.theme === 'Lakeshore' ? stonesOf('#c8b49a') : null;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 6.5, 6), new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.9 }));
    beacon.visible = false;
    beacon.position.y = 1.8;
    node.add(fill, edge, glow, outer, runes, beacon, aurora);
    if (water) node.add(water);
    if (stones) node.add(stones);
    const dress = dressOf(def, at.x, at.z);
    node.add(dress);
    const chest = chestOf(def.accent);
    chest.visible = false;
    node.add(chest);
    const herb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#7dff9a' }));
    herb.position.set(1.4, 0.4, 0.6);
    herb.visible = def.theme === 'Forest Creek' || def.theme === 'Sunlit Meadow';
    node.add(herb);
    group.add(node);
    return { ...def, ...at, node, fill, edge, glow, outer, aurora, runes, motes, water, beacon, herb, dress, chest, got: false, pulse: 0, chestT: 0, celebrated: tierOf(xp[def.id] || 0), waved: false, wave: null };
  });

  function fillMesh(cx, cz, color) {
    const pos = [];
    const n = 18;
    const c = [0, world.ground(cx, cz) + 0.05, 0];
    const ring = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rad = SIZE * 0.9 * hexRadius(a);
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      ring.push(x, world.ground(cx + x, cz + z) + 0.05, z);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pos.push(...c, ring[i * 3], ring[i * 3 + 1], ring[i * 3 + 2], ring[j * 3], ring[j * 3 + 1], ring[j * 3 + 2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    mesh.renderOrder = 1;
    return mesh;
  }
  function edgeLine(cx, cz, radius, color) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i % 6) * TAU / 6 - Math.PI / 6;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      for (let s = 0; s < (i === 6 ? 1 : 3); s++) {
        const t = s / 3;
        const a2 = a + t * (TAU / 6);
        const x2 = Math.cos(a2) * radius * (i === 6 ? 1 : 1);
        const z2 = Math.sin(a2) * radius;
        const px = i === 6 ? x : x2;
        const pz = i === 6 ? z : z2;
        pts.push(new THREE.Vector3(px, world.ground(cx + px, cz + pz) + 0.16, pz));
        if (i === 6) break;
      }
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
    line.frustumCulled = false;
    return line;
  }
  function ribbon(cx, cz, color) {
    const g = new THREE.Group();
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU;
      const rad = SIZE * hexRadius(a) * 0.98;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = world.ground(cx + x, cz + z);
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: '#b7aa96' }));
      stone.scale.set(1, 0.38, 1);
      stone.position.set(x, y + 0.05, z);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, y + 0.03, z);
      g.add(stone, glow);
    }
    return g;
  }
  function auroraOf() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), new THREE.MeshBasicMaterial({ color: i === 1 ? '#d7b0ff' : '#8dffe0', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      sheet.position.set(-1.2 + i * 1.2, 2.4, 0);
      g.add(sheet);
    }
    g.visible = false;
    return g;
  }
  function creek(theme) {
    const g = new THREE.Group();
    const n = theme === 'Lakeshore' ? 5 : 6;
    for (let i = 0; i < n; i++) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(theme === 'Lakeshore' ? 1.1 - i * 0.12 : 0.7, 10), new THREE.MeshBasicMaterial({ color: theme === 'Lakeshore' ? '#7ee7df' : '#2fbfa8', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }));
      const x = -2.2 + i * 0.85;
      const z = Math.sin(i) * 0.45;
      disc.position.set(x, world.ground(0, 0) , z);
      disc.rotation.x = -Math.PI / 2;
      g.add(disc);
    }
    return g;
  }
  function dressOf(def, cx, cz) {
    const g = new THREE.Group();
    const yAt = (x, z) => world.ground(cx + x, cz + z);
    if (def.theme === 'Forest Creek') {
      for (let i = 0; i < 7; i++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.7, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? '#1f6b45' : '#3d9a62' }));
        const x = -2.4 + i * 0.55;
        const z = 0.7 + Math.sin(i) * 0.2;
        reed.position.set(x, yAt(x, z) + 0.35, z);
        g.add(reed);
      }
      for (let i = 0; i < 2; i++) {
        const frog = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#3d8f4a' }));
        body.scale.set(1.2, 0.7, 1);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#f4f0c8' }));
        eye.position.set(0.05, 0.06, 0.08);
        frog.add(body, eye);
        const x = -0.4 + i * 1.3;
        const z = 1.1;
        frog.position.set(x, yAt(x, z) + 0.08, z);
        g.add(frog);
      }
      for (let i = 0; i < 6; i++) {
        const fly = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: '#e8ff8a' }));
        fly.userData.fly = i;
        g.add(fly);
      }
    } else if (def.theme === 'Sunlit Meadow') {
      for (let i = 0; i < 8; i++) {
        const flower = new THREE.Mesh(new THREE.CircleGeometry(0.12, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? '#f2d15a' : '#f08ab0', side: THREE.DoubleSide }));
        const x = -2 + (i % 4) * 1.1;
        const z = -1.2 + Math.floor(i / 4) * 1.4;
        flower.position.set(x, yAt(x, z) + 0.08, z);
        flower.rotation.x = -Math.PI / 2;
        g.add(flower);
      }
      for (let i = 0; i < 3; i++) {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ color: '#fff6dc', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
        wing.userData.wing = i;
        g.add(wing);
      }
    } else if (def.theme === 'Lakeshore') {
      for (let i = 0; i < 4; i++) {
        const mist = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: '#e7fff8', transparent: true, opacity: 0.22, depthWrite: false }));
        mist.position.set(-1.5 + i * 0.9, 0.5, 0.2);
        mist.userData.mist = i;
        g.add(mist);
      }
      for (let i = 0; i < 5; i++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 0.85, 5), new THREE.MeshBasicMaterial({ color: '#c6d27a' }));
        const x = -1.6 + i * 0.7;
        reed.position.set(x, yAt(x, 1.2) + 0.4, 1.2);
        g.add(reed);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), new THREE.MeshBasicMaterial({ color: '#6a4a32' }));
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.16), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
        const x = -1.6 + i * 1.5;
        post.position.set(x, yAt(x, 1.4) + 0.45, 1.4);
        lamp.position.set(x, yAt(x, 1.4) + 1.0, 1.4);
        g.add(post, lamp);
      }
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: '#c4b49a' }));
        const x = -1.1 + i * 0.7;
        s.position.set(x, yAt(x, -1.3) + 0.12, -1.3);
        g.add(s);
      }
    }
    return g;
  }
  function chestOf(color) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.46, 0.5), new THREE.MeshBasicMaterial({ color: '#c48a48' }));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.54), new THREE.MeshBasicMaterial({ color }));
    lid.position.y = 0.3;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 20), new THREE.MeshBasicMaterial({ color: '#ffe7a4' }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 4.2, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.9, depthWrite: false }));
    beam.position.y = 2.1;
    beam.name = 'beam';
    const icon = lootTag('Herb');
    icon.position.set(1.25, 1.2, 0);
    g.add(box, lid, rim, beam, icon);
    g.position.y = 0.55;
    g.scale.setScalar(2.35);
    return g;
  }
  function lootTag(text) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 36px Georgia';
    ctx.fillStyle = '#fff6dc';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(1.5, 0.38, 1);
    s.name = 'loot';
    s.userData.canvas = c;
    return s;
  }
  function stonesOf(color) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 2) * 0.08, 0), new THREE.MeshBasicMaterial({ color }));
      s.position.set(-1.2 + i * 0.7, 0.2, 1.3);
      g.add(s);
    }
    return g;
  }

  function inside(h, x, z) {
    const dx = x - h.x;
    const dz = z - h.z;
    const ang = Math.atan2(dz, dx);
    const rad = SIZE * hexRadius(ang);
    return Math.hypot(dx, dz) < rad * 0.98;
  }
  function at(x, z) { return built.find((h) => inside(h, x, z)) || null; }
  function tier(h) { return tierOf(xp[h.id] || 0); }

  const card = document.getElementById('hexcard');
  const banner = document.getElementById('hexbanner');
  let openId = null;
  let bannerT = 0;

  function paint(h) {
    const t = tier(h);
    const have = xp[h.id] || 0;
    const name = document.getElementById('hexName');
    const theme = document.getElementById('hexTheme');
    const tierEl = document.getElementById('hexTier');
    const bar = document.querySelector('#hexbar i');
    const spawns = document.getElementById('hexSpawns');
    const next = document.getElementById('hexNext');
    if (name) name.textContent = h.name;
    if (theme) theme.textContent = h.theme;
    const label = t === 1 ? 'I · Wild' : t === 2 ? 'II · Awakened' : 'III · Mythic';
    if (tierEl) tierEl.textContent = `Tier ${label} · ${have} XP`;
    if (bar) {
      const lo = need(t);
      const hi = nextNeed(t);
      const u = t >= 3 ? 1 : Math.max(0, Math.min(1, (have - lo) / (hi - lo)));
      bar.style.width = `${Math.round(u * 100)}%`;
    }
    if (spawns) spawns.textContent = `${h.spawns} ${h.features}`;
    if (next) next.textContent = t >= 3 ? 'This hex is at its highest tier.' : h.next;
    openId = h.id;
    if (card) card.hidden = false;
    const quest = document.getElementById('quest');
    if (quest) quest.style.visibility = 'hidden';
  }
  function close() {
    if (card) card.hidden = true;
    openId = null;
    const quest = document.getElementById('quest');
    if (quest) quest.style.visibility = '';
  }
  function enter(h) {
    walker.place(h.x, h.z, 0);
    walker.feet.y = world.walk ? world.walk(h.x, h.z) : world.ground(h.x, h.z);
    const t = tier(h);
    const label = t === 1 ? 'I' : t === 2 ? 'II' : 'III';
    if (banner) {
      banner.hidden = false;
      banner.textContent = `${h.name} · Tier ${label} ${h.theme} Hex`;
      bannerT = 2.4;
    }
    close();
    puff(h);
  }
  const moods = [];
  function puff(h) {
    h._puffed = h.id;
    const kind = h.id === 'moss' || h.id === 'glen' ? 'mist' : h.id === 'meadow' || h.id === 'bloom' ? 'petal' : h.id === 'shore' ? 'fly' : 'warm';
    const color = kind === 'mist' ? '#d5f0e2' : kind === 'petal' ? '#f2a3c2' : kind === 'fly' ? '#ffe27a' : '#ffd2a2';
    for (let i = 0; i < 12; i++) {
      const geo = kind === 'petal' ? new THREE.PlaneGeometry(0.18, 0.08) : new THREE.SphereGeometry(kind === 'fly' ? 0.045 : 0.16, 6, 4);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
      const x = h.x + (Math.random() - 0.5) * 5;
      const z = h.z + (Math.random() - 0.5) * 5;
      m.position.set(x, (world.walk ? world.walk(x, z) : world.ground(x, z)) + 0.3 + Math.random() * 1.2, z);
      scene.add(m);
      moods.push({ m, life: 5.5, kind, vx: (Math.random() - 0.5) * 0.35, vz: (Math.random() - 0.5) * 0.35 });
    }
  }
  function grant(id, n) {
    const before = tierOf(xp[id] || 0);
    xp[id] = (xp[id] || 0) + n;
    saveXp(xp);
    const h = built.find((b) => b.id === id);
    const after = tierOf(xp[id] || 0);
    if (h && after > before) celebrateTier(h, after);
    if (h && openId === id) paint(h);
  }
  function celebrateTier(h, t) {
    if ((h.celebrated || 0) >= t) return;
    h.celebrated = t;
    h.pulse = 1.4;
    h.chestT = 6;
    if (h.chest) {
      h.chest.visible = true;
      const loot = h.theme === 'Lakeshore' ? 'Trout' : h.theme === 'Hearth' ? 'Wick' : 'Herb';
      const icon = h.chest.getObjectByName('loot');
      if (icon?.userData.canvas) {
        const ctx = icon.userData.canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);
        ctx.font = 'bold 36px Georgia';
        ctx.fillStyle = '#fff6dc';
        ctx.textAlign = 'center';
        ctx.fillText(loot, 128, 44);
        icon.material.map.needsUpdate = true;
      }
    }
    const label = t === 2 ? 'II' : 'III';
    if (banner) {
      banner.hidden = false;
      banner.textContent = `${h.name} rises · Tier ${label}`;
      bannerT = 3.4;
    }
    try {
      if (h.theme === 'Lakeshore') {
        const book = JSON.parse(localStorage.getItem('aro-long-lake') || '{}');
        const prev = book.trout;
        book.trout = { n: (prev?.n || 0) + 1, best: Math.max(prev?.best || 0, 28) };
        localStorage.setItem('aro-long-lake', JSON.stringify(book));
      } else {
        localStorage.setItem('aro-herbs', String(Number(localStorage.getItem('aro-herbs') || 0) + 1));
      }
      if (h.theme === 'Hearth') {
        const bag = JSON.parse(localStorage.getItem('aro-beast-drops') || '{}');
        bag.wick = (bag.wick || 0) + 1;
        localStorage.setItem('aro-beast-drops', JSON.stringify(bag));
      }
    } catch { /* private mode */ }
  }

  document.getElementById('hexX')?.addEventListener('pointerup', (e) => { close(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('hexEnter')?.addEventListener('pointerup', (e) => {
    const h = built.find((b) => b.id === openId);
    if (h) enter(h);
    e.preventDefault();
    e.stopPropagation();
  });
  addEventListener('pointerup', (e) => {
    if (e.target.closest && e.target.closest('button, #hexcard, #menu, #atlas, #settings, #book, #catch, #board')) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = world.aim?.(ray.ray.origin, ray.ray.direction, 90);
    if (!hit?.point) return;
    const h = at(hit.point.x, hit.point.z);
    if (h) paint(h);
  });

  function update(dt) {
    for (let i = moods.length - 1; i >= 0; i--) {
      const p = moods[i];
      p.life -= dt;
      p.m.position.x += p.vx * dt;
      p.m.position.z += p.vz * dt;
      p.m.position.y += dt * (p.kind === 'petal' ? 0.15 : 0.35);
      p.m.material.opacity = Math.max(0, p.life / 5.5) * 0.75;
      if (p.kind === 'petal') p.m.rotation.z += dt * 2;
      if (p.life <= 0) { scene.remove(p.m); moods.splice(i, 1); }
    }
    const time = performance.now() * 0.001;
    const here = at(walker.feet.x, walker.feet.z);
    for (const h of built) {
      const t = tier(h);
      h.fill.material.opacity = (here === h ? 0.46 : 0.24) + (t === 3 ? 0.22 : (t - 1) * 0.08);
      h.edge.material.color.set(t >= 3 ? '#fff6c8' : h.accent);
      h.outer.visible = t >= 3;
      h.aurora.visible = t >= 3;
      if (h.aurora.visible) {
        h.aurora.rotation.y = time * 0.25;
        h.aurora.children.forEach((s, i) => { s.material.opacity = 0.16 + Math.sin(time * 1.4 + i) * 0.08; });
      }
      h.glow.children.forEach((s) => { s.material.opacity = t >= 3 ? 1 : t === 2 ? 0.9 : 0.72; });
      if (h.outer.material) h.outer.material.color.set('#ffe27a');
      h.beacon.visible = t >= 3;
      if (h.beacon.visible) h.beacon.position.y = 1.6 + Math.sin(time * 2 + h.q) * 0.15;
      h.runes.children.forEach((r, i) => {
        r.position.y = world.ground(h.x + r.position.x, h.z + r.position.z) + (t >= 2 ? 0.55 + Math.sin(time * 2 + i) * 0.12 : 0.32);
        r.scale.setScalar(t >= 2 ? 1.35 : 1);
      });
      h.motes.forEach((m, i) => {
        const a = time * (0.4 + t * 0.15) + i;
        const rad = 2 + (i % 4);
        m.position.set(Math.cos(a) * rad, 0.8 + (i % 3) * 0.35 + (t - 1) * 0.4, Math.sin(a) * rad);
        m.visible = true;
      });
      if (h.water) {
        h.water.children.forEach((d, i) => {
          const x = h.x + d.position.x;
          const z = h.z + d.position.z;
          d.position.y = world.ground(x, z) + 0.08;
          const pulse = t >= 2 ? 0.55 + Math.sin(time * 3 + i) * 0.2 : 0.7;
          d.material.opacity = pulse;
          d.scale.setScalar(t >= 3 ? 1.15 : 1);
        });
      }
      h.dress?.children.forEach((m) => {
        if (m.userData.fly != null) {
          const i = m.userData.fly;
          m.position.set(-1 + Math.sin(time * 1.4 + i) * 1.4, 0.8 + Math.sin(time * 2 + i) * 0.25, Math.cos(time * 1.1 + i) * 1.1);
        }
        if (m.userData.wing != null) {
          const i = m.userData.wing;
          m.position.set(Math.sin(time * 0.8 + i) * 2, 1.1 + Math.sin(time * 3 + i) * 0.2, Math.cos(time * 0.7 + i) * 1.6);
          m.rotation.z = Math.sin(time * 12 + i) * 0.6;
        }
        if (m.userData.mist != null) m.material.opacity = 0.14 + Math.sin(time + m.userData.mist) * 0.06;
      });
      if (h.pulse > 0) {
        h.pulse = Math.max(0, h.pulse - dt);
        const s = 1 + Math.sin((1.4 - h.pulse) * 10) * 0.12;
        h.glow.scale.setScalar(s);
        h.outer.visible = true;
      }
      if (h.chestT > 0) {
        h.chestT -= dt;
        if (h.chest) {
          h.chest.visible = true;
          h.chest.position.y = 0.62 + Math.sin(time * 3) * 0.08;
          h.chest.rotation.y += dt * 0.8;
          if (h.chestT <= 0) h.chest.visible = false;
        }
      }
      if (h.herb.visible && !h.got && Math.hypot(walker.feet.x - (h.x + 1.4), walker.feet.z - (h.z + 0.6)) < 1.3) {
        h.got = true;
        h.herb.visible = false;
        const bonus = (() => { try { return (JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.bram?.fp || 0) >= 90; } catch { return false; } })();
        grant(h.id, bonus ? 18 : 12);
        try {
          const n = Number(localStorage.getItem('aro-herbs') || 0) + 1;
          localStorage.setItem('aro-herbs', String(n));
        } catch { /* private mode */ }
        zones?.toast?.(`Herb kept · +${bonus ? 18 : 12} resonance`);
      }
    }
    for (const h of built) if (h !== here && h.wave?.done) h.waved = false;
    if (here && here._puffed !== here.id) { here._puffed = here.id; puff(here); }
    if (here && FIGHT[here.id] && zones?.beginWave && !here.waved) {
      here.waved = true;
      const t = tier(here);
      here.wave = zones.beginWave(here, FIGHT[here.id], t + 1, t === 1 ? 0.1 : t === 2 ? 0.35 : 0.6);
      if (watch) {
        for (const kind of FIGHT[here.id]) {
          const rolled = watch.roll('beast', { ...watch.context(here.id), hex: here.id });
          watch.sight(kind, { where: here.id, tier: rolled.tier, shimmer: rolled.shimmer, drop: t > 1 });
        }
      }
    }
    if (here?.wave && !here.wave.done && zones?.waveAlive) {
      if (zones.waveAlive(here.wave) === 0 && here.wave.ids.length) {
        here.wave.done = true;
        const have = xp[here.id] || 0;
        const t = tierOf(have);
        const gained = t < 3 ? Math.max(12, (t === 1 ? 40 : 110) - have) : 8;
        grant(here.id, gained);
        const names = { tusk: 'Boar tusk', ruff: 'Wolf ruff', gel: 'Slime gel', bead: 'Goblin bead' };
        const got = (here.wave.drops || []).map((k) => names[k] || k);
        const rose = tierOf(xp[here.id] || 0) > t;
        const loot = rose ? (here.theme === 'Lakeshore' ? 'Trout' : here.theme === 'Hearth' ? 'Lantern wick' : 'Herb') : '';
        zones?.toast?.([`${here.name} clear`, `+${gained} resonance`, ...got, loot].filter(Boolean).join(' · '));
        zones?.waveCleared?.();
      }
    }
    if (here) {
      here._acc = (here._acc || 0) + dt;
        if (here._acc > 8) {
          here._acc = 0;
          const bonus = (() => { try { return (JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.bram?.fp || 0) >= 90; } catch { return false; } })();
          grant(here.id, bonus ? 2 : 1);
        }
    }
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0 && banner) banner.hidden = true;
    }
    const atlas = document.getElementById('atlas');
    const canvas = document.getElementById('lakemap');
    if (atlas && !atlas.hidden && walker.feet.z > 5 && canvas) drawHexMap(canvas);
  }
  function drawHexMap(canvas) {
    const g = canvas.getContext('2d');
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    const span = 70;
    const cx = walker.feet.x;
    const cz = walker.feet.z;
    const px = (x, z) => ({ sx: ((x - (cx - span)) / (span * 2)) * W, sy: (1 - (z - (cz - span)) / (span * 2)) * H });
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#1d4a32';
    g.fillRect(0, 0, W, H);
    const title = document.getElementById('atlas')?.querySelector('p');
    if (title) title.textContent = 'Super Hexes';
    for (const h of built) {
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i % 6) * TAU / 6 - Math.PI / 6;
        const p = px(h.x + Math.cos(a) * SIZE, h.z + Math.sin(a) * SIZE);
        if (i === 0) g.moveTo(p.sx, p.sy);
        else g.lineTo(p.sx, p.sy);
      }
      g.fillStyle = h.tint;
      g.globalAlpha = 0.55;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = tier(h) >= 3 ? '#fff6dc' : h.accent;
      g.lineWidth = tier(h) >= 2 ? 4 : 2;
      g.stroke();
      const c = px(h.x, h.z);
      g.fillStyle = '#1a120c';
      g.font = '16px Georgia';
      g.textAlign = 'center';
      g.fillText(h.name, c.sx, c.sy);
    }
    mapFrame = { cx, cz, span, W, H };
    const you = px(walker.feet.x, walker.feet.z);
    g.fillStyle = '#fff6dc';
    g.beginPath();
    g.arc(you.sx, you.sy, 7, 0, TAU);
    g.fill();
  }

  let mapFrame = null;
  let watch = null;
  function hit(sx, sy) {
    if (!mapFrame) return null;
    const { cx, cz, span, W, H } = mapFrame;
    const x = (cx - span) + (sx / W) * span * 2;
    const z = (cz - span) + (1 - sy / H) * span * 2;
    let best = null;
    let bestD = SIZE * 1.05;
    for (const h of built) {
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  return {
    list: built, at, tier, grant, paint, enter, update, close, hit,
    layer: group,
    foe() { return (FIGHT[openId] || ['deer'])[0]; },
    root: ROOT,
    set watch(v) { watch = v; },
  };
}
