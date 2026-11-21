// AR Wander. The camera fallback, painted over: a soft sky, a few lights at
// ground level, and a step journal. Fights stay behind an explicit tap.
import * as THREE from 'three';

const KEY = 'aro-wander';
const FINDS = [
  { id: 'deer', title: 'Spirit deer', text: 'A deer of pale light crossed ahead, unhurried.' },
  { id: 'fox', title: 'Spirit fox', text: 'A small fox of ember-light sat, then went on.' },
  { id: 'chest', title: 'Warm chest', text: 'A little chest glowed at the path’s edge. Tap to open it.' },
  { id: 'herb', title: 'Moonherb', text: 'Glowing mushrooms came up beside your feet. Tap to gather.' },
  { id: 'friend', title: 'Cloaked traveler', text: 'Someone in a soft cloak waved from the path.' },
  { id: 'shade', title: 'A stir in the grass', text: 'Something moved. You can let it pass.', fight: true },
];

const TINT = {
  day: { top: '#f3c98a', mid: '#f8e4bf', low: '#fff6e4', cloud: 'rgba(255,250,236,0.5)', castle: '#5c4030', star: 0 },
  dusk: { top: '#c45a72', mid: '#f0a090', low: '#ffd2c0', cloud: 'rgba(255,214,204,0.42)', castle: '#2c1840', star: 0.25 },
  night: { top: '#100c22', mid: '#241c48', low: '#3a3060', cloud: 'rgba(190,186,220,0.16)', castle: '#07060e', star: 1 },
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

function skyCanvas(mood) {
  const tint = TINT[mood] || TINT.day;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, tint.top);
  sky.addColorStop(0.55, tint.mid);
  sky.addColorStop(1, tint.low);
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  if (tint.star > 0) {
    g.fillStyle = `rgba(255,246,220,${tint.star})`;
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % 1024;
      const y = (i * 53) % 360;
      const s = i % 7 === 0 ? 2.2 : 1.1;
      g.globalAlpha = 0.35 + (i % 5) * 0.12;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
  }
  const fade = g.createLinearGradient(0, 300, 0, 512);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = fade;
  g.fillRect(0, 0, 1024, 512);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudCanvas(mood) {
  const tint = TINT[mood] || TINT.day;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  g.fillStyle = tint.cloud;
  const puffs = [[80, 90, 120, 36], [240, 70, 160, 42], [460, 110, 140, 32], [680, 64, 180, 40], [900, 100, 130, 34]];
  for (const [x, y, rx, ry] of puffs) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse((x + 1024) % 1024, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function castleCanvas(mood) {
  const tint = TINT[mood] || TINT.day;
  const c = document.createElement('canvas');
  c.width = 420;
  c.height = 280;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 420, 280);
  g.fillStyle = tint.castle;
  g.globalAlpha = mood === 'night' ? 0.92 : 0.78;
  const wall = (x, y, w, h) => g.fillRect(x, y, w, h);
  wall(70, 120, 280, 150);
  wall(40, 80, 46, 190);
  wall(330, 70, 50, 200);
  wall(150, 40, 36, 120);
  wall(196, 18, 28, 140);
  g.beginPath();
  g.moveTo(40, 80); g.lineTo(63, 36); g.lineTo(86, 80); g.fill();
  g.beginPath();
  g.moveTo(330, 70); g.lineTo(355, 22); g.lineTo(380, 70); g.fill();
  g.fillStyle = mood === 'night' ? '#f1d9a4' : '#ffe7b8';
  g.globalAlpha = mood === 'day' ? 0.35 : 0.8;
  [[58, 110], [168, 70], [206, 48], [348, 100]].forEach(([x, y]) => g.fillRect(x, y, 8, 12));
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide,
  });
}

function island() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), mat('#6e9a62'));
  body.scale.set(1.5, 0.38, 1.1);
  const dirt = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), mat('#8a6248'));
  dirt.scale.set(1.35, 0.28, 1);
  dirt.position.y = -0.12;
  g.add(body, dirt);
  for (let i = 0; i < 3; i++) {
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), mat(i === 1 ? '#2f6a44' : '#3e8a55'));
    pine.position.set((i - 1) * 0.28, 0.34, i === 1 ? -0.05 : 0.08);
    g.add(pine);
  }
  return g;
}

function lantern() {
  const g = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ffd7a8', 0.95));
  const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), mat('#f1d9a4', 0.45));
  g.add(glow, cage);
  return g;
}

function wisp(i) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(i % 2 ? '#d8fff6' : '#ffe7b0', 0.95));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(i % 2 ? '#9fe7ff' : '#ffd7a8', 0.28));
  g.add(halo, core);
  return g;
}

function sproutMesh(i) {
  const g = new THREE.Group();
  if (i % 2) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.16, 5), mat('#e6d2ba'));
    stem.position.y = 0.08;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), mat(i % 4 ? '#ffb0d0' : '#d2b6ff', 0.95));
    cap.position.y = 0.18;
    cap.scale.y = 0.6;
    g.add(stem, cap);
  } else {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), mat('#3e8a4a'));
    stem.position.y = 0.09;
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(i % 3 ? '#fff1c4' : '#ffd0e0', 0.95));
    bloom.position.y = 0.2;
    g.add(stem, bloom);
  }
  g.visible = false;
  return g;
}

function deerMesh() {
  const g = new THREE.Group();
  const hide = mat('#f3e6c4', 0.88);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), hide);
  body.scale.set(1.5, 0.72, 0.7);
  body.position.y = 0.55;
  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), hide);
  neck.position.set(0, 0.78, 0.22);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), hide);
  head.position.set(0, 0.92, 0.32);
  g.add(body, neck, head);
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.38, 4), hide);
    leg.position.set(i < 2 ? -0.16 : 0.16, 0.2, i % 2 ? 0.12 : -0.12);
    g.add(leg);
  }
  for (const s of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), mat('#fff6dc', 0.9));
    ant.position.set(s * 0.06, 1.08, 0.3);
    g.add(ant);
  }
  return g;
}

function foxMesh() {
  const g = new THREE.Group();
  const hide = mat('#ffb15a', 0.9);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), hide);
  body.scale.set(1.4, 0.7, 0.65);
  body.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), hide);
  head.position.set(0, 0.4, 0.16);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), mat('#fff1c4', 0.9));
  tail.position.set(0, 0.34, -0.22);
  g.add(body, head, tail);
  return g;
}

function chestMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), mat('#c4a574'));
  box.position.y = 0.18;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.32), mat('#e6c27a'));
  lid.position.y = 0.34;
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 20), mat('#ffe7a4', 0.7));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.04;
  g.add(glow, box, lid);
  return g;
}

function herbMesh() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const s = sproutMesh(i + 1);
    s.visible = true;
    s.position.set((i - 1.5) * 0.16, 0, (i % 2) * 0.1);
    g.add(s);
  }
  return g;
}

function friendMesh() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), mat('#6a5a8c'));
  robe.position.y = 0.36;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), mat('#4a3c68'));
  hood.position.y = 0.74;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat('#f0c2a0'));
  face.position.set(0, 0.7, 0.06);
  g.add(robe, hood, face);
  return g;
}

function shadeMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat('#9a8cff', 0.55));
  body.position.y = 0.55;
  body.scale.set(0.7, 1.3, 0.7);
  g.add(body);
  return g;
}

const MAKERS = { deer: deerMesh, fox: foxMesh, chest: chestMesh, herb: herbMesh, friend: friendMesh, shade: shadeMesh };

export function createWander({ scene, world, zones, sound, leave }) {
  const root = new THREE.Group();
  root.name = 'ar-wander';
  root.visible = false;
  scene.add(root);

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshBasicMaterial({
    map: skyCanvas('day'), transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  sky.name = 'wander-sky';
  sky.renderOrder = 1;
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.2), new THREE.MeshBasicMaterial({
    map: cloudCanvas('day'), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.85,
  }));
  clouds.renderOrder = 2;
  clouds.position.set(0, 1.1, 0.05);
  const castle = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.3), new THREE.MeshBasicMaterial({
    map: castleCanvas('day'), transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  castle.renderOrder = 3;
  castle.position.set(-3.6, -1.15, 0.08);
  const isles = [island(), island()];
  isles[0].position.set(-5.3, 0.85, 0.2);
  isles[0].scale.setScalar(1.15);
  isles[1].position.set(5.1, 1.05, -0.12);
  isles[1].scale.setScalar(0.9);
  const lanterns = Array.from({ length: 5 }, () => lantern());
  lanterns.forEach((m) => sky.add(m));
  sky.add(clouds, castle, ...isles);
  root.add(sky);

  const star = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.03), mat('#fff6dc'));
  star.visible = false;
  sky.add(star);
  let starLife = 0;
  let starIn = 8;

  const wisps = Array.from({ length: 4 }, (_, i) => wisp(i));
  wisps.forEach((m) => root.add(m));
  const blooms = Array.from({ length: 6 }, (_, i) => sproutMesh(i));
  blooms.forEach((m) => root.add(m));
  const rune = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 28), mat('#f1d9a4', 0.9));
  ring.rotation.x = -Math.PI / 2;
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 20), mat('#fff6dc', 0.8));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.02;
  rune.add(ring, inner);
  for (let i = 0; i < 6; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.14), mat('#ffe7a4', 0.9));
    const a = (i / 6) * Math.PI * 2;
    tick.position.set(Math.cos(a) * 0.72, 0.03, Math.sin(a) * 0.72);
    tick.lookAt(0, 0.03, 0);
    rune.add(tick);
  }
  rune.visible = false;
  root.add(rune);
  let runeLife = 0;
  let runeWait = 2;

  const finds = {};
  for (const spec of FINDS) {
    const mesh = MAKERS[spec.id]();
    mesh.visible = false;
    mesh.name = `wander-${spec.id}`;
    root.add(mesh);
    finds[spec.id] = mesh;
  }

  let on = false;
  let forced = '';
  let metres = Number(load().metres) || 0;
  let nextAt = metres + 18;
  let sinceBloom = 0;
  let motionFresh = 0;
  let motionSteps = 0;
  let motionPeak = false;
  const here = new THREE.Vector3();
  let active = null;
  let activeLife = 0;
  let hintLife = 0;
  const entries = Array.isArray(load().entries) ? load().entries.slice(-12) : [];

  const bar = document.getElementById('wanderBar');
  const stepsEl = document.getElementById('wanderSteps');
  const hint = document.getElementById('wanderHint');
  const sheet = document.getElementById('wanderSheet');
  const list = document.getElementById('wanderList');
  const passBtn = document.getElementById('wanderPass');
  const meetBtn = document.getElementById('wanderMeet');

  function moodNow() {
    if (forced) return forced;
    const h = new Date().getHours();
    if (h >= 21 || h < 5) return 'night';
    if (zones?.dusk || h >= 17) return 'dusk';
    return 'day';
  }
  let painted = '';
  function paint(mood) {
    if (painted === mood) return;
    painted = mood;
    sky.material.map?.dispose();
    clouds.material.map?.dispose();
    castle.material.map?.dispose();
    sky.material.map = skyCanvas(mood);
    clouds.material.map = cloudCanvas(mood);
    castle.material.map = castleCanvas(mood);
    sky.material.needsUpdate = true;
    clouds.material.needsUpdate = true;
    castle.material.needsUpdate = true;
  }

  function persist() {
    save({ metres: Math.round(metres * 10) / 10, entries });
  }
  function renderJournal() {
    if (!list) return;
    const km = (metres / 1000).toFixed(metres < 1000 ? 2 : 1);
    list.innerHTML = `<p class="meta">${km} km walked</p>` + (entries.length
      ? `<ul>${entries.slice().reverse().map((e) => `<li><b>${e.title}</b><br>${e.text}</li>`).join('')}</ul>`
      : '<p>Nothing written yet. Walk a little.</p>');
  }
  function note(spec) {
    entries.push({ title: spec.title, text: spec.text });
    if (entries.length > 12) entries.shift();
    persist();
    renderJournal();
    if (hint) {
      hint.hidden = false;
      hint.textContent = spec.text;
    }
    hintLife = 6.5;
    if (spec.fight && hint && passBtn && meetBtn) {
      hint.append(passBtn, meetBtn);
      passBtn.hidden = false;
      meetBtn.hidden = false;
    }
    try { sound?.chime?.(); } catch { /* the bed can be quiet */ }
  }
  function hideFind() {
    if (active) finds[active].visible = false;
    active = null;
    if (passBtn) passBtn.hidden = true;
    if (meetBtn) meetBtn.hidden = true;
  }
  function show(id) {
    const spec = FINDS.find((f) => f.id === id) || FINDS[0];
    hideFind();
    active = spec.id;
    activeLife = spec.fight ? 14 : 9;
    finds[spec.id].visible = true;
    finds[spec.id].scale.setScalar(spec.id === 'deer' || spec.id === 'friend' ? 1.65 : spec.id === 'fox' ? 1.8 : 1);
    note(spec);
  }
  function placeFind(walker) {
    if (!active) return;
    const yaw = walker.yaw;
    const x = walker.feet.x + Math.sin(yaw) * 2.15 + Math.cos(yaw) * 1.05;
    const z = walker.feet.z + Math.cos(yaw) * 2.15 - Math.sin(yaw) * 1.05;
    const y = world.ground(x, z);
    const mesh = finds[active];
    mesh.position.set(x, y, z);
    mesh.lookAt(walker.feet.x, y + 0.4, walker.feet.z);
  }

  addEventListener('devicemotion', (e) => {
    if (!on) return;
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    motionFresh = 1.4;
    if (mag > 12.2 && !motionPeak) {
      motionPeak = true;
      motionSteps += 1;
      metres += 0.78;
    }
    if (mag < 9.6) motionPeak = false;
  });

  document.getElementById('wanderJournal')?.addEventListener('pointerup', (e) => {
    if (sheet) { sheet.hidden = false; renderJournal(); }
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('wanderClose')?.addEventListener('pointerup', (e) => {
    if (sheet) sheet.hidden = true;
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('wanderMute')?.addEventListener('pointerup', (e) => {
    if (sound) sound.quiet = !sound.quiet;
    const b = document.getElementById('wanderMute');
    if (b) b.textContent = sound?.quiet ? 'Muted' : 'Soft';
    e.preventDefault();
    e.stopPropagation();
  });
  passBtn?.addEventListener('pointerup', (e) => {
    hideFind();
    if (hint) hint.textContent = 'It went on. The path is quiet.';
    hintLife = 3;
    e.preventDefault();
    e.stopPropagation();
  });
  meetBtn?.addEventListener('pointerup', (e) => {
    hideFind();
    leave?.();
    const spot = { x: here.x, z: here.z, theme: 'Sunlit Meadow', id: 'wander' };
    const wave = zones?.beginWave?.(spot, ['fox'], 1, 0);
    zones?.toast?.(wave?.ids?.length ? 'You step through. One shade is waiting.' : 'The grass stayed quiet.');
    if (hint) hint.hidden = true;
    e.preventDefault();
    e.stopPropagation();
  });
  addEventListener('pointerup', (e) => {
    if (!on || !active || FINDS.find((f) => f.id === active)?.fight) return;
    if (e.target.closest && e.target.closest('#wanderBar, #wanderSheet, #ar, #dusk, #cast, #spell, #menu, #home')) return;
    if (active === 'chest' || active === 'herb') {
      const id = active;
      entries.push({ title: id === 'chest' ? 'Warm chest' : 'Moonherb', text: id === 'chest' ? 'Opened. A warm stone, and nothing owed.' : 'Gathered. It smells like rain on stone.' });
      if (entries.length > 12) entries.shift();
      persist();
      hideFind();
      if (hint) hint.textContent = id === 'chest' ? 'The chest shut, gently.' : 'Tucked away.';
      hintLife = 3;
      try { sound?.chime?.(); } catch { /* quiet */ }
    }
  });

  function ahead(walker, dist, side, lift) {
    const yaw = walker.yaw;
    const x = walker.feet.x + Math.sin(yaw) * dist + Math.cos(yaw) * side;
    const z = walker.feet.z + Math.cos(yaw) * dist - Math.sin(yaw) * side;
    return [x, world.ground(x, z) + lift, z];
  }

  function update(dt, walker, camera, arOn) {
    here.copy(walker.feet);
    on = !!arOn;
    root.visible = on;
    if (bar) bar.hidden = !on;
    if (!on) {
      try { sound?.wander?.(false); } catch { /* no bed yet */ }
      if (sheet) sheet.hidden = true;
      return;
    }
    try { sound?.wander?.(!sound.quiet); } catch { /* the page may still be waking */ }
    const mood = moodNow();
    paint(mood);
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const eye = walker.feet.y + 1.62;
    sky.position.set(walker.feet.x + fx * 6.3, eye + 1.15, walker.feet.z + fz * 6.3);
    sky.lookAt(walker.feet.x, sky.position.y, walker.feet.z);
    if (clouds.material.map) clouds.material.map.offset.x = (clouds.material.map.offset.x + dt * 0.006) % 1;
    const t = performance.now() * 0.001;
    isles[0].position.y = 0.85 + Math.sin(t * 0.35) * 0.08;
    isles[1].position.y = 1.05 + Math.sin(t * 0.28 + 1) * 0.07;
    lanterns.forEach((m, i) => {
      const a = t * 0.15 + i * 1.3;
      m.position.set(Math.cos(a) * (2.2 + (i % 3) * 0.8), 0.4 + Math.sin(t * 0.6 + i) * 0.25, Math.sin(a) * 0.35);
    });
    if (mood === 'night') {
      starIn -= dt;
      if (starLife <= 0 && starIn <= 0) {
        starLife = 1.3;
        starIn = 16 + Math.random() * 10;
        star.userData.from = -5 + Math.random() * 3;
        star.userData.to = 5;
        star.userData.y = 1.2 + Math.random() * 1.4;
      }
    }
    if (starLife > 0) {
      starLife -= dt;
      const u = 1 - starLife / 1.3;
      star.visible = true;
      star.position.set(THREE.MathUtils.lerp(star.userData.from || -4, star.userData.to || 4, u), star.userData.y || 1.6, 0.3);
      star.lookAt(camera.position);
    } else star.visible = false;

    wisps.forEach((m, i) => {
      const wobble = Math.sin(t * 0.45 + i) * 0.35 + (i % 2 ? 0.85 : -0.85);
      const [x, y, z] = ahead(walker, 2.2 + i * 0.7, wobble, 0.85 + Math.sin(t * 1.2 + i) * 0.18);
      m.position.set(x, y, z);
    });

    if (motionFresh > 0) motionFresh -= dt;
    else metres += Math.max(0, walker.speed) * dt;
    sinceBloom += Math.max(0, walker.speed) * dt;
    if (sinceBloom > 7) {
      sinceBloom = 0;
      const slot = blooms.find((m) => !m.visible) || blooms[0];
      const [x, y, z] = ahead(walker, 1.2, (Math.random() - 0.5) * 1.8, 0);
      slot.position.set(x, y, z);
      slot.visible = true;
      slot.userData.life = 12;
    }
    blooms.forEach((m) => {
      if (!m.visible) return;
      m.userData.life -= dt;
      const grown = 1 - m.userData.life / 12;
      m.scale.setScalar(grown < 0.12 ? grown / 0.12 : 1);
      if (m.userData.life <= 0) m.visible = false;
    });

    runeWait -= dt;
    if (walker.pitch > 0.42 && runeLife <= 0 && runeWait <= 0) {
      runeLife = 5.5;
      runeWait = 9;
      const [x, y, z] = ahead(walker, 1.7, -0.85, 0.04);
      rune.position.set(x, y, z);
      rune.visible = true;
    }
    if (runeLife > 0) {
      runeLife -= dt;
      rune.rotation.y += dt * 0.3;
      const fade = Math.min(1, runeLife / 1.2);
      ring.material.opacity = 0.85 * fade;
      if (runeLife <= 0) rune.visible = false;
    }

    if (metres >= nextAt && !active) {
      nextAt = metres + 80 + Math.random() * 40;
      const bag = FINDS.filter((f) => !f.fight || entries.length % 5 === 4);
      show(bag[Math.floor(Math.random() * bag.length)].id);
    }
    if (active) {
      activeLife -= dt;
      placeFind(walker);
      const mesh = finds[active];
      mesh.position.y += Math.sin(t * 1.4) * dt * 0.15;
      if (!FINDS.find((f) => f.id === active)?.fight && activeLife <= 0) hideFind();
      if (FINDS.find((f) => f.id === active)?.fight && activeLife <= 0) hideFind();
    }
    if (hintLife > 0) {
      hintLife -= dt;
      if (hintLife <= 0 && hint && !active) hint.hidden = true;
    }
    if (stepsEl) {
      const steps = Math.max(motionSteps, Math.round(metres / 0.78));
      const km = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
      stepsEl.textContent = `${km} · ${steps} steps`;
    }
  }

  return {
    root, update,
    askMotion() {
      const ask = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'
        ? DeviceMotionEvent.requestPermission().catch(() => 'denied')
        : Promise.resolve('granted');
      return ask;
    },
    set mood(v) { forced = v || ''; painted = ''; },
    get mood() { return moodNow(); },
    show, bloom() { runeWait = 0; runeLife = 0; },
    get metres() { return metres; },
    set metres(v) { metres = v; },
    get entries() { return entries; },
    get active() { return active; },
    open() { if (sheet) { sheet.hidden = false; renderJournal(); } },
  };
}
