// Home Hub reach, furniture, and the coins the prom walk brings home.
// three-mesh-bvh (MIT) accelerates the pick ray. The disc is a look cue, not a weapon.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

const KEY = 'aro-house';
const ROOM = { minX: -4.55, maxX: 4.55, minZ: -5.9, maxZ: 5.35 };

const BUYS = [
  { id: 'rug-weave', kind: 'rug', value: 'weave', name: 'Rug · Weave', coins: 15, timber: 4 },
  { id: 'rug-star', kind: 'rug', value: 'star', name: 'Rug · Star', coins: 22, timber: 6 },
  { id: 'rug-hearth', kind: 'rug', value: 'hearth', name: 'Rug · Hearth', coins: 28, timber: 8 },
  { id: 'wood-honey', kind: 'finish', value: 'honey', name: 'Timber · Honey', coins: 18, timber: 6 },
  { id: 'wood-ash', kind: 'finish', value: 'ash', name: 'Timber · Ash', coins: 24, timber: 8 },
  { id: 'wood-night', kind: 'finish', value: 'night', name: 'Timber · Night', coins: 30, timber: 10 },
  { id: 'mood-ember', kind: 'mood', value: 'ember', name: 'Light · Ember', coins: 15, timber: 0 },
  { id: 'mood-lantern', kind: 'mood', value: 'lantern', name: 'Light · Lantern', coins: 20, timber: 4 },
  { id: 'mood-moon', kind: 'mood', value: 'moon', name: 'Light · Moon', coins: 26, timber: 6 },
];

const LINES = {
  maren: 'The fire is the good seat.',
  sable: 'The lake can wait. Sit a minute.',
  bram: 'One hand. No stakes.',
  lumen: 'Rest if the day was long.',
};

let raycastArmed = false;
function armRaycast() {
  if (raycastArmed) return;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  raycastArmed = true;
}
function indexRoot(root) {
  armRaycast();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.geometry.boundsTree) return;
    try { o.geometry.boundsTree = new MeshBVH(o.geometry); } catch { /* a line or empty geom stays on the slow path */ }
  });
}

function loadHouse() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveHouse(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

function handCue() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#d7f6ff', transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  const palm = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), mat);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 2, 6), mat);
  thumb.position.set(-0.04, 0.01, 0);
  thumb.rotation.z = 0.8;
  g.add(palm, thumb);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.045, 2, 6), mat);
    finger.position.set(-0.02 + i * 0.016, 0.055, 0);
    g.add(finger);
  }
  g.position.set(0.12, -0.08, 0.02);
  return g;
}

function makeTV() {
  const g = new THREE.Group();
  g.name = 'hub-tv';
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4030', roughness: 0.72 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.48, 0.28), wood);
  cab.position.y = 0.24;
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.04), new THREE.MeshStandardMaterial({ color: '#1a140f', roughness: 0.5 }));
  bezel.position.set(0, 0.28, 0.13);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.26),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  screen.position.set(0, 0.28, 0.156);
  screen.name = 'tv-screen';
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.16), wood);
  leg.position.y = 0.02;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8), new THREE.MeshStandardMaterial({ color: '#e7c56a', metalness: 0.4, roughness: 0.35 }));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.28, 0.16, 0.14);
  g.add(cab, bezel, screen, leg, knob);
  g.userData.canvas = canvas;
  g.userData.tex = tex;
  return g;
}

function paintSurf(g, t) {
  g.fillStyle = '#1a6a9a';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#f4e2b0';
  g.fillRect(0, 118, 256, 42);
  for (let i = 0; i < 4; i++) {
    const y = 40 + i * 18 + Math.sin(t * 2 + i) * 4;
    g.strokeStyle = i % 2 ? '#d7f4ff' : '#7ec8e8';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + t * 3 + i) * 6);
    g.stroke();
  }
}
function paintRain(g, t) {
  g.fillStyle = '#1a2030';
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(210,220,240,0.75)';
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = (i * 17 + t * 80) % 256;
    const y = (i * 29 + t * 140) % 160;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 6, y + 14);
    g.stroke();
  }
}
function paintStars(g, t) {
  g.fillStyle = '#070814';
  g.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 48; i++) {
    const x = (i * 53 + Math.sin(t + i) * 8) % 256;
    const y = (i * 37) % 160;
    g.fillStyle = i % 5 ? '#fff6dc' : '#9ee7ff';
    g.fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
  }
}

export function createHouse(scene, outdoor) {
  const pieces = [];
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const view = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const saved = loadHouse();
  let shell = null;
  let held = null;
  let focus = null;
  let charge = 0;
  let channel = saved.channel || 'surf';
  let playLeft = 0;
  let catches = 0;
  let stars = [];
  let paddle = 128;
  const channels = ['surf', 'rain', 'stars'];

  const cue = new THREE.Group();
  cue.name = 'reach-cue';
  cue.visible = false;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.36, 48),
    new THREE.MeshBasicMaterial({ color: '#7ee7ff', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
  );
  const fill = new THREE.Mesh(
    new THREE.RingGeometry(0.04, 0.14, 40, 1, -Math.PI / 2, 0.02),
    new THREE.MeshBasicMaterial({ color: '#e7c56a', transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }),
  );
  cue.add(ring, fill, handCue());
  cue.traverse((o) => {
    if (!o.isMesh) return;
    o.raycast = () => {};
    o.material.depthTest = false;
    o.renderOrder = 20;
  });
  cue.renderOrder = 20;
  scene.add(cue);
  const placeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.62, 32),
    new THREE.MeshBasicMaterial({ color: '#7ee7ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  placeRing.rotation.x = -Math.PI / 2;
  placeRing.visible = false;
  placeRing.raycast = () => {};
  scene.add(placeRing);

  const tv = makeTV();
  const fixBtn = document.getElementById('houseFix');
  const bar = document.getElementById('houseBar');
  const actBtn = document.getElementById('houseAct');
  const rotBtn = document.getElementById('houseRot');
  const dropBtn = document.getElementById('houseDrop');
  const panel = document.getElementById('housePanel');
  const funds = document.getElementById('houseFunds');
  const buys = document.getElementById('houseBuys');
  const tvBar = document.getElementById('tvBar');

  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 1800);
  }
  function paintBuys() {
    if (!buys) return;
    const w = outdoor.wallet;
    if (funds) funds.textContent = `${w.coins} coins · ${w.timber} timber`;
    buys.innerHTML = BUYS.map((item) => {
      const on = saved[item.kind] === item.value ? ' class="on"' : '';
      const cost = item.timber ? `${item.coins} coins · ${item.timber} timber` : `${item.coins} coins`;
      return `<button type="button" data-buy="${item.id}"${on}>${item.name}<br>${cost}</button>`;
    }).join('');
  }
  function applySaved() {
    if (!shell) return;
    if (saved.rug) shell.paintRug(saved.rug);
    if (saved.finish) shell.setFinish(saved.finish);
    if (saved.mood) shell.setMood(saved.mood);
    const layout = saved.pieces || {};
    for (const piece of pieces) {
      const at = layout[piece.id];
      if (!at) continue;
      piece.root.position.x = at.x;
      piece.root.position.z = at.z;
      piece.root.rotation.y = at.yaw || 0;
    }
  }
  function remember() {
    saved.pieces = {};
    for (const piece of pieces) {
      saved.pieces[piece.id] = { x: piece.root.position.x, z: piece.root.position.z, yaw: piece.root.rotation.y };
    }
    saved.channel = channel;
    saveHouse(saved);
  }
  function proxy(root, id) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.4, size.x), Math.max(0.6, size.y), Math.max(0.4, size.z)));
    mesh.visible = false;
    mesh.name = `reach-${id}`;
    root.worldToLocal(center);
    mesh.position.copy(center);
    root.add(mesh);
    indexRoot(mesh);
    return mesh;
  }
  function addPiece(id, root, verb) {
    root.userData.houseId = id;
    const hit = proxy(root, id);
    pieces.push({ id, root, hit, verb });
  }

  function mount(parts) {
    const step = (name, fn) => {
      try { fn(); } catch (err) { throw new Error(`${name}: ${err && err.message ? err.message : err}`); }
    };
    shell = parts.shell;
    step('tea', () => {
      const tea = parts.hub.getObjectByName('tea-table');
      if (tea && parts.table) parts.table.attach(tea);
    });
    step('chair', () => addPiece('chair', parts.chairA, 'Move'));
    step('chair-b', () => addPiece('chair-b', parts.chairB, 'Move'));
    step('table', () => addPiece('table', parts.table, 'Move'));
    step('lamp', () => addPiece('lamp', parts.lamp, 'Move'));
    step('plant', () => { if (parts.plant) addPiece('plant', parts.plant, 'Move'); });
    step('tv', () => {
      tv.position.set(2.15, 0, 1.55);
      tv.rotation.y = 0.15;
      tv.scale.setScalar(1.35);
      parts.hub.add(tv);
      addPiece('tv', tv, 'Change Channel');
    });
    step('pals', () => { for (const pal of parts.pals) addPiece(pal.id, pal.g, 'Talk'); });
    step('plaque', () => {
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.28, 0.04),
        new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.5 }),
      );
      plaque.position.set(-4.7, 1.35, 0.4);
      plaque.rotation.y = Math.PI / 2;
      plaque.name = 'fix-plaque';
      parts.hub.add(plaque);
      addPiece('fix', plaque, 'Fix Up');
    });
    step('saved', () => { applySaved(); paintBuys(); });
  }

  function setChargeMesh(c) {
    fill.geometry.dispose();
    fill.geometry = new THREE.RingGeometry(0.04, 0.14, 40, 1, -Math.PI / 2, Math.max(0.04, c) * Math.PI * 2);
  }
  function verbOf(piece) {
    return piece?.verb || '';
  }
  function showBars(inHub) {
    if (fixBtn) fixBtn.hidden = !inHub;
    const ready = inHub && focus && charge >= 0.98 && !held;
    if (bar) bar.hidden = !(inHub && (held || ready));
    if (actBtn) {
      actBtn.hidden = !!held;
      actBtn.textContent = verbOf(focus) || 'Move';
    }
    if (rotBtn) rotBtn.hidden = !held;
    if (dropBtn) dropBtn.hidden = !held;
    if (tvBar) tvBar.hidden = !(inHub && focus?.id === 'tv' && charge >= 0.98 && !held);
    if (panel && !inHub) panel.hidden = true;
  }
  function beginMove(piece) {
    if (!piece || piece.verb !== 'Move') return;
    held = piece;
    piece.root.position.y = 0.22;
    showBars(true);
  }
  function drop() {
    if (!held) return;
    held.root.position.y = 0;
    held = null;
    placeRing.visible = false;
    remember();
    showBars(true);
  }
  function rotateHeld() {
    if (!held) return;
    held.root.rotation.y += Math.PI / 8;
  }
  function act() {
    if (!focus || charge < 0.98) return;
    if (focus.verb === 'Move') beginMove(focus);
    else if (focus.verb === 'Talk') toast(`${focus.id[0].toUpperCase()}${focus.id.slice(1)}: ${LINES[focus.id] || 'Good to see you.'}`);
    else if (focus.verb === 'Change Channel') flip();
    else if (focus.verb === 'Fix Up') { if (panel) panel.hidden = false; paintBuys(); }
  }
  function flip() {
    channel = channels[(channels.indexOf(channel) + 1) % channels.length];
    remember();
    toast(channel === 'surf' ? 'Seaside Surf' : channel === 'rain' ? 'Lo-Fi Rain' : 'Starfield');
  }
  function playGame() {
    playLeft = 20;
    catches = 0;
    stars = [];
    paddle = 128;
    toast('Star-Catcher · 20 seconds');
  }
  function paintGame(g, dt) {
    g.fillStyle = '#070814';
    g.fillRect(0, 0, 256, 160);
    if (Math.random() < dt * 3.2) stars.push({ x: 16 + Math.random() * 224, y: 0 });
    g.fillStyle = '#fff6dc';
    stars = stars.filter((s) => {
      s.y += dt * 70;
      if (s.y > 148 && Math.abs(s.x - paddle) < 18) { catches += 1; return false; }
      if (s.y > 160) return false;
      g.fillRect(s.x, s.y, 4, 4);
      return true;
    });
    paddle += (128 + Math.sin(performance.now() * 0.004) * 70 - paddle) * Math.min(1, dt * 4);
    g.fillStyle = '#7ee7ff';
    g.fillRect(paddle - 16, 148, 32, 6);
    g.fillStyle = '#e7c56a';
    g.font = '16px Georgia';
    g.fillText(`${catches} · ${Math.ceil(playLeft)}s`, 8, 20);
  }
  function paintScreen(dt) {
    const g = tv.userData.canvas.getContext('2d');
    const t = performance.now() * 0.001;
    if (playLeft > 0) {
      playLeft = Math.max(0, playLeft - dt);
      paintGame(g, dt);
      if (playLeft === 0) {
        const bonus = Math.min(24, catches);
        if (bonus) outdoor.gain(bonus);
        toast(bonus ? `Star-Catcher · +${bonus} coins` : 'Star-Catcher · the sky kept them');
      }
    } else if (channel === 'rain') paintRain(g, t);
    else if (channel === 'stars') paintStars(g, t);
    else paintSurf(g, t);
    tv.userData.tex.needsUpdate = true;
  }
  function buy(id) {
    const item = BUYS.find((row) => row.id === id);
    if (!item) return;
    if (saved[item.kind] === item.value) return;
    if (!outdoor.spend(item.coins, item.timber)) {
      toast('The prom can spare a few more coins');
      paintBuys();
      return;
    }
    saved[item.kind] = item.value;
    if (item.kind === 'rug') shell.paintRug(item.value);
    else if (item.kind === 'finish') shell.setFinish(item.value);
    else shell.setMood(item.value);
    saveHouse(saved);
    paintBuys();
    toast(`${item.name} set`);
  }

  fixBtn?.addEventListener('pointerup', (e) => {
    if (panel) panel.hidden = !panel.hidden;
    paintBuys();
    e.preventDefault();
    e.stopPropagation();
  });
  actBtn?.addEventListener('pointerup', (e) => { act(); e.preventDefault(); e.stopPropagation(); });
  rotBtn?.addEventListener('pointerup', (e) => { rotateHeld(); e.preventDefault(); e.stopPropagation(); });
  dropBtn?.addEventListener('pointerup', (e) => { drop(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('tvChannel')?.addEventListener('pointerup', (e) => { flip(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('tvPlay')?.addEventListener('pointerup', (e) => { playGame(); e.preventDefault(); e.stopPropagation(); });
  buys?.addEventListener('pointerup', (e) => {
    const btn = e.target.closest('[data-buy]');
    if (!btn) return;
    buy(btn.dataset.buy);
    e.preventDefault();
    e.stopPropagation();
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && held) rotateHeld();
  });

  function aimed(camera, walker) {
    ndc.set(0, 0);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pieces.map((p) => p.hit), false);
    if (!hits.length || hits[0].distance > 5.5) return null;
    const piece = pieces.find((p) => p.hit === hits[0].object);
    if (!piece) return null;
    const feet = Math.hypot(piece.root.position.x - walker.feet.x, piece.root.position.z - walker.feet.z);
    if (feet > 4.4) return null;
    return piece;
  }

  function update(dt, camera, walker, inHub) {
    paintScreen(inHub ? dt : 0);
    if (!inHub) {
      cue.visible = false;
      charge = 0;
      showBars(false);
      return;
    }
    const next = aimed(camera, walker);
    if (held) {
      const yaw = walker.yaw;
      const x = THREE.MathUtils.clamp(walker.feet.x + Math.sin(yaw) * 1.2, ROOM.minX, ROOM.maxX);
      const z = THREE.MathUtils.clamp(walker.feet.z + Math.cos(yaw) * 1.2, ROOM.minZ, ROOM.maxZ);
      held.root.position.x += (x - held.root.position.x) * Math.min(1, dt * 5);
      held.root.position.z += (z - held.root.position.z) * Math.min(1, dt * 5);
      held.root.position.y = 0.28;
      placeRing.visible = true;
      placeRing.position.set(held.root.position.x, 0.05, held.root.position.z);
      cue.visible = false;
      showBars(true);
      return;
    }
    placeRing.visible = false;
    if (next && next === focus) charge = Math.min(1, charge + dt * 0.62);
    else {
      focus = next;
      charge = next ? 0.15 : Math.max(0, charge - dt * 1.4);
    }
    showBars(true);
    if (!focus || charge <= 0.02) {
      cue.visible = false;
      return;
    }
    focus.root.getWorldPosition(aim);
    aim.y += focus.verb === 'Talk' ? 1.25 : 0.7;
    camera.getWorldDirection(view);
    cue.visible = true;
    cue.position.copy(camera.position).addScaledVector(view, 1.15);
    cue.lookAt(camera.position);
    const s = 0.85 + charge * 0.35;
    ring.scale.setScalar(s);
    setChargeMesh(charge);
    cue.children[2].visible = charge > 0.25;
  }

  return {
    mount, update,
    ids() { return pieces.map((p) => p.id); },
    lift(id) { const piece = pieces.find((p) => p.id === id); if (piece) beginMove(piece); },
    get held() { return held; },
    get focus() { return focus; },
    beginMove, drop, flip, playGame,
  };
}
