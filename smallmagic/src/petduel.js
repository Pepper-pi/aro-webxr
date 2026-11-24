// A light pet duel. The owned pet is the Quaternius fox (CC0). A wild deer or
// wolf meets it on a small arena of rubble and a boulder ridge. Leap Slam
// takes height from those props. The Mage's wheel and the Summoner's staff
// are left alone.
import * as THREE from 'three';

const PET_KEY = 'aro-pet';
const BEATS = { fire: 'frost', frost: 'earth', earth: 'wind', wind: 'fire' };
const ELEM = { fire: 'Ember', frost: 'Rime', wind: 'Gust', earth: 'Quake' };
const FOE_TYPE = { fox: 'fire', wolf: 'frost', deer: 'earth', boar: 'earth', bunny: 'wind', slime: 'frost', goblin: 'earth', bear: 'earth', cow: 'earth', crab: 'earth', fish: 'frost' };
const MOB = {
  fox: 'mobs/cc0/fox.glb', wolf: 'mobs/cc0/wolf.glb', deer: 'mobs/cc0/deer.glb',
  bunny: 'mobs/cc0/bunny.glb', cow: 'mobs/cc0/cow.glb', crab: 'mobs/cc0/crab.glb', fish: 'mobs/cc0/fish.glb',
  boar: 'mobs/overaction/boar.glb', goblin: 'mobs/overaction/goblin.glb',
};
const TALL = { fox: 1.05, wolf: 1.15, deer: 1.35, bunny: 0.72, cow: 1.15, crab: 0.55, fish: 0.42, boar: 1.05, goblin: 0.85 };
const MOVE_IDS = ['petSlam', 'petElemBtn', 'petGuard', 'petNip'];
const MOVE_LABELS = ['Leap Slam', 'Ember', 'Guard', 'Nip'];
const BEAT = { chill: 'burn', burn: 'growth', growth: 'bleed', bleed: 'wind', wind: 'chill' };

function loadPet() {
  try {
    const row = JSON.parse(localStorage.getItem(PET_KEY) || 'null');
    if (row?.id) return row;
  } catch { /* a new fox */ }
  return { id: 'fox', name: 'Ember', type: 'fire', xp: 0, level: 1 };
}
function savePet(row) {
  try { localStorage.setItem(PET_KEY, JSON.stringify(row)); } catch { /* private mode */ }
}
function mult(atk, def) {
  if (BEATS[atk] === def) return 1.35;
  if (BEATS[def] === atk) return 0.75;
  return 1;
}
function bindBox(root) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!o.isMesh || !pos || pos.count < 40) return;
    const step = Math.max(1, Math.floor(pos.count / 240));
    for (let i = 0; i < pos.count; i += step) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  return box;
}
function fit(root, height) {
  const box = bindBox(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(height / Math.max(size.y, 0.01));
  root.position.y -= bindBox(root).min.y;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = o.receiveShadow = true;
  });
}

function stone(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 200;
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return { c, tex, g: c.getContext('2d') };
}
function paintPanel(board, title, hp, max, sta, sub) {
  const { c, g, tex } = board;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(236, 242, 248, 0.94)';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 8;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = '#1c2430';
  g.font = '600 40px Georgia, serif';
  g.fillText(title, 28, 52);
  g.font = '24px Georgia, serif';
  g.fillStyle = '#3a4654';
  g.fillText(sub, 28, 86);
  const bar = (y, u, color) => {
    g.fillStyle = 'rgba(20, 28, 36, 0.12)';
    g.fillRect(28, y, 456, 22);
    g.fillStyle = color;
    g.fillRect(28, y, Math.max(0, Math.min(1, u)) * 456, 22);
  };
  bar(108, hp / max, '#e07a62');
  bar(146, sta / 100, '#5eb8b0');
  tex.needsUpdate = true;
}

export function createDuel({ scene, world, camera, living }) {
  const root = new THREE.Group();
  root.name = 'pet-arena';
  root.visible = false;
  scene.add(root);

  const pad = new THREE.Mesh(new THREE.CircleGeometry(7.2, 28), stone('#c4b49a'));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  root.add(pad);

  const pads = [];
  function pile(x, z, h, n) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.7 + (i % 2) * 0.25, 0.32, 0.55), stone(i % 2 ? '#8d8478' : '#6e655c'));
      m.position.set((i - 1) * 0.18, 0.2 + i * 0.28, (i % 2) * 0.12);
      m.rotation.y = i * 0.4;
      g.add(m);
    }
    g.position.set(x, 0, z);
    g.userData.high = h;
    root.add(g);
    pads.push(g);
    return g;
  }
  pile(-2.4, 1.6, 1.15, 3);
  pile(2.6, -1.2, 1.55, 4);
  const ridge = new THREE.Group();
  ridge.userData.high = 2.15;
  for (let i = 0; i < 8; i++) {
    const head = i === 7;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(head ? 0.72 : 0.38 + (i % 3) * 0.08, 0), stone(head ? '#5e564c' : '#7d7468'));
    const u = i / 7;
    rock.position.set(-1.2 + u * 3.4, 0.25 + u * u * 1.7, -2.4 + Math.sin(u * 2.2) * 0.7);
    ridge.add(rock);
  }
  root.add(ridge);
  pads.push(ridge);

  const actors = {
    pet: { kind: 'fox', type: 'fire', name: 'Ember', hp: 48, max: 48, sta: 100, g: new THREE.Group(), cd: 0, guard: 0 },
    foe: { kind: 'deer', type: 'earth', name: 'Wild deer', hp: 42, max: 42, sta: 100, g: new THREE.Group(), cd: 0, guard: 0 },
  };
  actors.pet.g.position.set(-2.2, 0, 0.2);
  actors.foe.g.position.set(2.4, 0, -0.2);
  root.add(actors.pet.g, actors.foe.g);

  function standIn(color) {
    const g = new THREE.Group();
    g.name = 'standin';
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), stone(color));
    body.scale.set(1.4, 0.7, 0.7);
    body.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), stone(color));
    head.position.set(0, 0.72, 0.22);
    g.add(body, head);
    return g;
  }
  actors.pet.g.add(standIn('#c46a2a'));
  actors.foe.g.add(standIn('#c4a574'));

  const shock = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 28), new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  shock.rotation.x = -Math.PI / 2;
  shock.visible = false;
  root.add(shock);
  const bits = [];
  for (let i = 0; i < 16; i++) {
    const dust = i < 10;
    const m = new THREE.Mesh(dust ? new THREE.BoxGeometry(0.12, 0.08, 0.12) : new THREE.OctahedronGeometry(0.07, 0), stone(dust ? '#d9c7a4' : '#ffe08a'));
    m.visible = false;
    root.add(m);
    bits.push({ m, dust, life: 0, v: new THREE.Vector3() });
  }

  const petBoard = panelTexture();
  const foeBoard = panelTexture();
  const boardMat = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const petPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.38), boardMat(petBoard.tex));
  const foePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.38), boardMat(foeBoard.tex));
  petPlane.renderOrder = 5;
  foePlane.renderOrder = 5;

  let active = false;
  let raid = null;
  let raidClear = false;
  let magic = {};
  const warn = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 28), new THREE.MeshBasicMaterial({ color: '#ffb043', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.06;
  warn.visible = false;
  root.add(warn);
  const lane = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), new THREE.MeshBasicMaterial({ color: '#e23b32', transparent: true, opacity: 0.55, depthWrite: false }));
  lane.visible = false;
  root.add(lane);
  const patches = [[1.4, -0.6], [-1.2, 1.1]].map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), new THREE.MeshBasicMaterial({ color: '#ff7a1c', transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.05, z);
    m.visible = false;
    root.add(m);
    return m;
  });
  const debris = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.22), stone('#8a7560'));
    m.visible = false;
    root.add(m);
    debris.push(m);
  }
  const LOOP = [
    { id: 'read', name: 'Wind-up', dur: 3.6 },
    { id: 'charge', name: 'Charge', dur: 2.6 },
    { id: 'embers', name: 'Embers', dur: 4.2 },
    { id: 'whirl', name: 'Whirl', dur: 4 },
  ];
  const BREAK = { id: 'breath', name: 'Break', dur: 3.2 };
  let bout = null;
  let freeze = false;
  let showBars = false;
  let ai = 1.2;
  let dip = 0;
  let slam = null;
  let ready = false;
  let foeKind = 'deer';
  const mixers = [];

  const hud = document.getElementById('petHud');
  const card = document.getElementById('petCard');

  function owned() {
    const row = loadPet();
    actors.pet.kind = row.id || 'fox';
    actors.pet.name = row.name || 'Ember';
    actors.pet.type = row.type || 'fire';
    actors.pet.level = row.level || 1;
    actors.pet.xp = row.xp || 0;
    actors.pet.max = 48 + (actors.pet.level - 1) * 6;
    return row;
  }

  async function dress() {
    let GLTFLoader;
    let SkeletonUtils;
    try {
      ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
      SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
    } catch { return; }
    const loader = new GLTFLoader();
    const cache = {};
    for (const kind of Object.keys(MOB)) {
      try { cache[kind] = await loader.loadAsync(new URL(MOB[kind], document.baseURI).href); } catch { /* stand-in stays */ }
    }
    function wear(actor, kind) {
      const gltf = cache[kind];
      if (!gltf || actor.g.getObjectByName(`mob-${kind}`)) return;
      const model = SkeletonUtils.clone(gltf.scene);
      fit(model, TALL[kind] || 1);
      const mixer = new THREE.AnimationMixer(model);
      const clips = {};
      for (const clip of gltf.animations) {
        const key = String(clip.name || '').toLowerCase();
        const slot = /attack|bite/.test(key) ? 'attack' : /walk|run/.test(key) && !/gallop/.test(key) ? 'walk' : /idle/.test(key) ? 'idle' : '';
        if (slot && !clips[slot]) clips[slot] = mixer.clipAction(clip);
      }
      (clips.idle || clips.walk)?.play();
      model.name = `mob-${kind}`;
      actor.g.add(model);
      const stand = actor.g.getObjectByName('standin');
      if (stand) stand.visible = false;
      mixers.push(mixer);
      actor.clips = clips;
    }
    function gel(actor) {
      if (actor.g.getObjectByName('mob-slime')) return;
      const g = new THREE.Group();
      g.name = 'mob-slime';
      const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshBasicMaterial({ color: '#2f8f5a', transparent: true, opacity: 0.88 }));
      mound.scale.set(1.15, 0.48, 1.15);
      mound.position.y = 0.16;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: '#1d5c38' }));
      cap.position.y = 0.34;
      g.add(mound, cap);
      actor.g.add(g);
    }
    gel(actors.pet);
    gel(actors.foe);
    wear(actors.pet, 'fox');
    wear(actors.foe, 'deer');
    wear(actors.foe, 'wolf');
    ready = true;
  }
  const loading = dress();

  function placeArena() {
    const s = world.start || { x: 0, z: 0 };
    const x = s.x + 16;
    const z = s.z + 4;
    root.position.set(x, world.ground(x, z), z);
  }
  function nearestPad(actor) {
    let best = null;
    let d = 3.6;
    for (const p of pads) {
      const dx = p.position.x - actor.g.position.x;
      const dz = p.position.z - actor.g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < d) { d = dist; best = p; }
    }
    return best;
  }
  function burst(x, y, z) {
    shock.visible = true;
    shock.position.set(x, y + 0.08, z);
    shock.scale.setScalar(0.3);
    shock.material.opacity = 0.95;
    bits.forEach((b, i) => {
      b.life = 0.55;
      b.m.visible = true;
      b.m.position.set(x, y + 0.2, z);
      const a = (i / bits.length) * Math.PI * 2;
      b.v.set(Math.cos(a) * (b.dust ? 2.2 : 3.4), (b.dust ? 1.2 : 2.4), Math.sin(a) * (b.dust ? 2.2 : 3.4));
    });
    dip = 1;
  }
  function hurt(target, amount, from) {
    const guard = target.guard > 0 ? 0.45 : 1;
    const bonus = mult(from, target.type);
    target.hp = Math.max(0, target.hp - amount * guard * bonus);
  }
  function act(who, move) {
    const self = who === 'pet' ? actors.pet : actors.foe;
    const other = who === 'pet' ? actors.foe : actors.pet;
    if (!active || self.cd > 0 || self.hp <= 0) return;
    if (move === 'guard') {
      if (self.sta < 12) return;
      self.sta -= 12;
      self.guard = 1.15;
      self.cd = 0.4;
      return;
    }
    if (move === 'nip') {
      if (self.sta < 8) return;
      self.sta -= 8;
      self.cd = 0.35;
      self.clips?.attack?.reset().play();
      hurt(other, 8, self.type);
      return;
    }
    if (move === 'elem') {
      if (self.sta < 18) return;
      self.sta -= 18;
      self.cd = 0.7;
      hurt(other, 14, self.type);
      burst((self.g.position.x + other.g.position.x) / 2, 0.2, (self.g.position.z + other.g.position.z) / 2);
      return;
    }
    if (move === 'slam') {
      if (self.sta < 20) return;
      self.sta -= 20;
      self.cd = 0.9;
      const padHit = nearestPad(self);
      const high = padHit ? padHit.userData.high : 0.4;
      slam = { who, t: 0, high, from: self.g.position.clone(), foe: other.g.position.clone(), bonus: high > 1 ? 10 : 0 };
    }
  }

  function bars() {
    const pet = actors.pet;
    const foe = actors.foe;
    const edge = BEATS[pet.type] === foe.type ? 'advantage' : BEATS[foe.type] === pet.type ? 'disadvantage' : 'even';
    paintPanel(petBoard, pet.name, pet.hp, pet.max, pet.sta, `${ELEM[pet.type]} · ${edge}`);
    paintPanel(foeBoard, foe.name, foe.hp, foe.max, foe.sta, foe.type);
    const hp = document.querySelector('#petPane .hp i');
    const sta = document.querySelector('#petPane .sta i');
    const fhp = document.querySelector('#foePane .hp i');
    const fsta = document.querySelector('#foePane .sta i');
    if (hp) hp.style.width = `${(pet.hp / pet.max) * 100}%`;
    if (sta) sta.style.width = `${pet.sta}%`;
    if (fhp) fhp.style.width = `${(foe.hp / foe.max) * 100}%`;
    if (fsta) fsta.style.width = `${foe.sta}%`;
    const pn = document.getElementById('petName');
    const fn = document.getElementById('foeName');
    const el = document.getElementById('petElem');
    if (pn) pn.textContent = `${pet.name} · lv ${pet.level || 1}`;
    if (fn) fn.textContent = foe.name;
    if (el) el.textContent = el.textContent = `${ELEM[pet.type]} vs ${foe.type}`;
  }
  const boardAt = new THREE.Vector3();
  function hitch() {
    if (!camera) return;
    camera.updateMatrixWorld(true);
    if (!petPlane.parent) scene.add(petPlane, foePlane);
    petPlane.visible = foePlane.visible = !!showBars;
    if (!showBars) return;
    const put = (plane, x) => {
      boardAt.set(x, -0.08, -1.35).applyMatrix4(camera.matrixWorld);
      plane.position.copy(boardAt);
      plane.quaternion.copy(camera.quaternion);
    };
    put(petPlane, -0.55);
    put(foePlane, 0.55);
  }
  function showUi(on) {
    if (hud) hud.hidden = !on;
    if (!on && card) card.hidden = true;
  }
  function end(won) {
    active = false;
    freeze = false;
    showBars = false;
    hitch();
    const row = owned();
    const gain = won ? 40 : 14;
    row.xp = (row.xp || 0) + gain;
    const level = 1 + Math.floor(row.xp / 40);
    const rose = level > (row.level || 1);
    row.level = level;
    savePet(row);
    actors.pet.level = level;
    actors.pet.xp = row.xp;
    const fromRaid = raidClear;
    const entry = fromRaid
      ? living?.sight?.('myth-stag', { where: 'raid', tier: 'mythic', shimmer: true, drop: true, defeated: true })
      : (won ? living?.defeat?.(foeKind) : living?.sight?.(foeKind, { where: 'duel' }));
    if (raidClear) raidClear = false;
    if (card) {
      card.hidden = false;
      const result = document.getElementById('petResult');
      const title = document.getElementById('petTitle');
      const xp = document.getElementById('petXp');
      const book = document.getElementById('petBook');
      if (result) result.textContent = fromRaid ? 'The brute falls. The hex keeps the quiet.' : (won ? 'Win' : 'Lose');
      if (title) title.textContent = fromRaid ? 'Loot · myth horn' : row.name;
      if (xp) xp.textContent = `+${gain} XP · level ${level}${rose ? ' · level up' : ''}`;
      if (book) book.textContent = entry ? `Bestiary · ${entry.name} · ${fromRaid || won ? `defeated ${entry.defeated || 1}` : 'seen'}` : 'Bestiary updated';
    }
    if (hud) hud.hidden = true;
    hideRaidBar();
  }

  function showKind(actor, kind) {
    let found = false;
    actor.g.traverse((o) => {
      if (!o.name?.startsWith?.('mob-')) return;
      o.visible = o.name === `mob-${kind}`;
      if (o.visible) found = true;
    });
    const stand = actor.g.getObjectByName('standin');
    if (stand) stand.visible = !found;
  }
  function resetMoveLabels() {
    MOVE_IDS.forEach((id, i) => {
      const b = document.getElementById(id);
      if (b) b.textContent = MOVE_LABELS[i];
    });
  }
  function raidBarPaint() {
    const bar = document.getElementById('raidBar');
    const name = document.getElementById('raidName');
    const hp = document.getElementById('raidHp');
    if (!bar) return;
    bar.hidden = false;
    if (name) name.textContent = `${actors.foe.name} · ${Math.max(0, Math.ceil(actors.foe.hp))}`;
    if (hp) hp.style.width = `${Math.max(0, (actors.foe.hp / actors.foe.max) * 100)}%`;
  }
  function hideRaidBar() {
    const bar = document.getElementById('raidBar');
    if (bar) bar.hidden = true;
  }
  function groundHere() {
    const coat = world.coat?.(root.position.x, root.position.z) || { burn: 0, frost: 0 };
    const iced = (world.iceCols || []).some((c) => Math.hypot(c.x - root.position.x, c.z - root.position.z) < (c.r || 0.4) + 2.2);
    return { burn: Math.max(coat.burn || 0, magic.flames?.() || 0), frost: Math.max(coat.frost || 0, iced ? 0.55 : 0) };
  }
  function nearRock(local) {
    for (const p of pads) {
      const dx = (p.position.x || 0) - local.x;
      const dz = (p.position.z || 0) - local.z;
      if (Math.hypot(dx, dz) < 2.15) return true;
    }
    return false;
  }
  function strike(actor, other, move, local) {
    const ground = groundHere();
    let dmg = (move.pow || 0) + (actor.power || 0);
    let note = '';
    if (move.slam && nearRock(local)) { dmg += 6; note = ' · jump-off'; }
    if (move.el === 'chill' && ground.frost > 0.22) { dmg = Math.round(dmg * 1.35); note = ' · frost'; }
    if (move.el === 'burn' && ground.burn > 0.22) { dmg = Math.round(dmg * 1.35); note = ' · burn'; }
    if (BEAT[move.el] === other.element) { dmg = Math.round(dmg * 1.25); note += ' · ring'; }
    other.hp = Math.max(0, other.hp - dmg);
    if (move.heal) actor.hp = Math.min(actor.max, actor.hp + move.heal);
    const self = actor === bout.mine ? actors.pet.g : actors.foe.g;
    const foeG = actor === bout.mine ? actors.foe.g : actors.pet.g;
    bout.anim = { who: actor === bout.mine ? 'mine' : 'wild', t: 0, from: self.position.clone(), to: foeG.position.clone() };
    shock.visible = true;
    shock.position.set(foeG.position.x, 0.08, foeG.position.z);
    shock.scale.setScalar(0.25);
    shock.material.opacity = 0.95;
    shock.material.color.set('#fff6dc');
    actors.pet.hp = bout.mine.hp;
    actors.pet.max = bout.mine.max;
    actors.foe.hp = bout.wild.hp;
    actors.foe.max = bout.wild.max;
    magic.note?.(`${actor.name} · ${move.name} · ${dmg}${note}`);
    bars();
  }
  function finishBout(won) {
    const mine = bout.mine;
    bout.over = true;
    active = false;
    showBars = false;
    const gain = won ? 26 : 8;
    const summary = magic.onBout?.({ won, kind: mine.kind, gain }) || {};
    if (card) {
      card.hidden = false;
      const result = document.getElementById('petResult');
      const title = document.getElementById('petTitle');
      const xp = document.getElementById('petXp');
      const book = document.getElementById('petBook');
      if (result) result.textContent = won ? 'Your pet holds the ring.' : 'Your pet sits down.';
      if (title) title.textContent = mine.name;
      if (xp) xp.textContent = summary.line || `+${gain} XP`;
      if (book) book.textContent = summary.book || `${mine.element} · level ${mine.level || 1}`;
    }
    if (hud) hud.hidden = true;
    bout = null;
  }
  function choose(i) {
    if (!bout || bout.over || bout.queue) return;
    const mineMove = bout.mine.moves[i];
    if (!mineMove) return;
    const foeMove = bout.wild.moves[Math.floor(Math.random() * bout.wild.moves.length)];
    const mineFirst = bout.mine.speed >= bout.wild.speed;
    bout.queue = mineFirst
      ? [['mine', mineMove], ['wild', foeMove]]
      : [['wild', foeMove], ['mine', mineMove]];
    bout.wait = 0.08;
  }
  function boutStep(dt) {
    if (!bout || bout.over) return;
    if (bout.anim) {
      bout.anim.t += dt;
      const u = Math.min(1, bout.anim.t / 0.22);
      const self = bout.anim.who === 'mine' ? actors.pet.g : actors.foe.g;
      const hop = Math.sin(u * Math.PI);
      self.position.x = bout.anim.from.x + (bout.anim.to.x - bout.anim.from.x) * hop * 0.42;
      self.position.z = bout.anim.from.z + (bout.anim.to.z - bout.anim.from.z) * hop * 0.42;
      self.position.y = hop * 0.22;
      if (u >= 1) {
        self.position.copy(bout.anim.from);
        self.position.y = 0;
        bout.anim = null;
      }
    }
    if (shock.visible) {
      shock.scale.multiplyScalar(1 + dt * 8);
      shock.material.opacity = Math.max(0, shock.material.opacity - dt * 4.5);
      if (shock.material.opacity <= 0.02) shock.visible = false;
    }
    if (!bout.queue) return;
    bout.wait -= dt;
    if (bout.wait > 0) return;
    const step = bout.queue.shift();
    if (!step) { bout.queue = null; return; }
    const [who, move] = step;
    const actor = who === 'mine' ? bout.mine : bout.wild;
    const other = who === 'mine' ? bout.wild : bout.mine;
    const local = who === 'mine' ? actors.pet.g.position : actors.foe.g.position;
    if (actor.hp > 0 && other.hp > 0) strike(actor, other, move, local);
    bout.wait = 0.28;
    if (!bout.queue.length) bout.queue = null;
    if (bout.wild.hp <= 0) { finishBout(true); return; }
    if (bout.mine.hp <= 0) finishBout(false);
  }
  function beginBout(mine, wild) {
    placeArena();
    raid = null;
    hideRaidBar();
    bout = {
      mine: { ...mine, hp: mine.max, moves: mine.moves },
      wild: { ...wild, hp: wild.max, moves: wild.moves },
      queue: null,
      wait: 0,
      over: false,
    };
    actors.pet.name = mine.name;
    actors.pet.max = mine.max;
    actors.pet.hp = mine.max;
    actors.pet.type = mine.element === 'burn' ? 'fire' : mine.element === 'chill' ? 'frost' : mine.element === 'wind' ? 'wind' : 'earth';
    actors.foe.name = wild.name;
    actors.foe.max = wild.max;
    actors.foe.hp = wild.max;
    actors.foe.type = 'earth';
    actors.pet.g.position.set(-2.15, 0, 1.35);
    actors.foe.g.position.set(2.15, 0, 2.05);
    actors.pet.g.visible = true;
    actors.foe.g.visible = true;
    showKind(actors.pet, mine.kind);
    showKind(actors.foe, wild.kind);
    const face = (a, b) => { a.rotation.y = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z); };
    face(actors.pet.g, actors.foe.g);
    face(actors.foe.g, actors.pet.g);
    if (actors.foe.g.userData.baseScale) actors.foe.g.scale.setScalar(actors.foe.g.userData.baseScale);
    root.visible = true;
    active = true;
    freeze = false;
    showBars = true;
    slam = null;
    showUi(true);
    MOVE_IDS.forEach((id, i) => {
      const b = document.getElementById(id);
      if (b) b.textContent = mine.moves[i]?.name || MOVE_LABELS[i];
    });
    const el = document.getElementById('petElem');
    if (el) el.textContent = `${mine.name} · ${mine.element}`;
    bars();
    magic.note?.(`${mine.name} faces ${wild.name}`);
  }

  function beginRaid(title = 'Hex brute') {
    begin({ foe: 'wolf' });
    actors.foe.name = title;
    actors.foe.hp = actors.foe.max = 70;
    if (!actors.foe.g.userData.baseScale) actors.foe.g.userData.baseScale = actors.foe.g.scale.x || 1;
    actors.foe.g.scale.setScalar(actors.foe.g.userData.baseScale * 1.45);
    actors.pet.g.visible = false;
    if (hud) hud.hidden = true;
    showBars = false;
    bout = null;
    raid = { i: 0, t: 0, struck: false, lit: false, spun: false, aimed: false, aim: { x: 0, z: 3 }, intro: 2.2, broke: false, breathing: false };
    raidBarPaint();
    magic.note?.(`${title} · Wind-up`);
    if (magic.walker) {
      const x = root.position.x + 0.2;
      const z = root.position.z + 4.2;
      magic.walker.place(x, z, Math.PI);
      magic.walker.feet.y = world.ground(x, z);
    }
  }
  function begin({ foe = 'deer' } = {}) {
    placeArena();
    owned();
    foeKind = MOB[foe] ? foe : 'deer';
    actors.foe.kind = foeKind;
    actors.foe.type = FOE_TYPE[foeKind] || 'earth';
    actors.foe.name = foeKind === 'deer' ? 'Wild deer' : foeKind === 'wolf' ? 'Wild wolf' : `Wild ${foeKind}`;
    actors.pet.hp = actors.pet.max;
    actors.foe.hp = actors.foe.max = 44;
    actors.pet.sta = actors.foe.sta = 100;
    actors.pet.g.position.set(-2.2, 0, 0.4);
    actors.foe.g.position.set(2.5, 0, -0.3);
    actors.foe.g.traverse((o) => { if (o.name?.startsWith?.('mob-')) o.visible = o.name === `mob-${foeKind}`; });
    const face = (a, b) => { a.rotation.y = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z); };
    face(actors.pet.g, actors.foe.g);
    face(actors.foe.g, actors.pet.g);
    actors.pet.g.visible = true;
    if (actors.foe.g.userData.baseScale) actors.foe.g.scale.setScalar(actors.foe.g.userData.baseScale);
    root.visible = true;
    active = true;
    freeze = false;
    showBars = true;
    ai = 1.1;
    dip = 0;
    slam = null;
    bout = null;
    resetMoveLabels();
    showUi(true);
    const elem = document.getElementById('petElemBtn');
    if (elem) elem.textContent = ELEM[actors.pet.type];
    bars();
  }

  function pose(mode) {
    begin({ foe: 'deer' });
    freeze = true;
    if (mode === 'leap') {
      showBars = false;
      const rock = ridge;
      actors.pet.g.position.set(rock.position.x + 1.4, rock.userData.high + 1.35, rock.position.z + 0.2);
      actors.pet.g.rotation.y = Math.atan2(actors.foe.g.position.x - actors.pet.g.position.x, actors.foe.g.position.z - actors.pet.g.position.z);
      actors.pet.g.rotation.x = -0.7;
      shock.visible = true;
      shock.position.set(1.2, 0.08, -0.4);
      shock.scale.setScalar(1.4);
      shock.material.opacity = 0.75;
      actors.pet.hp = 36;
      actors.foe.hp = 28;
    } else {
      showBars = true;
      actors.pet.hp = 34;
      actors.pet.sta = 62;
      actors.foe.hp = 24;
      actors.foe.sta = 40;
      bits[12].life = 0.4;
      bits[12].m.visible = true;
      bits[12].m.position.set(0.2, 0.8, 0);
    }
    bars();
  }

  function worldOf(local) {
    return { x: root.position.x + local.x, z: root.position.z + local.z };
  }
  function playerLocal() {
    const w = magic.walker;
    if (!w) return { x: 0, z: 4 };
    return { x: w.feet.x - root.position.x, z: w.feet.z - root.position.z };
  }
  function iceBlocks(ax, az, bx, bz) {
    const cols = magic.cols?.() || [];
    for (const c of cols) {
        const lx = c.x - root.position.x;
        const lz = c.z - root.position.z;
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz) || 1;
        const t = Math.max(0, Math.min(1, ((lx - ax) * dx + (lz - az) * dz) / (len * len)));
        const px = ax + dx * t;
        const pz = az + dz * t;
      if (Math.hypot(lx - px, lz - pz) < (c.r || 0.4) + 0.35) return true;
    }
    return false;
  }
  function inLane(you, from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((you.x - from.x) * dx + (you.z - from.z) * dz) / len2));
    return Math.hypot(you.x - (from.x + dx * t), you.z - (from.z + dz * t)) < 0.78;
  }
  function layLane(from, to, opacity) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 0.2;
    lane.visible = true;
    lane.position.set((from.x + to.x) / 2, 0.07, (from.z + to.z) / 2);
    lane.rotation.set(0, Math.atan2(dx, dz), 0);
    lane.scale.set(1.5, 1, len);
    lane.material.opacity = opacity;
  }
  function clearMarks() {
    warn.visible = false;
    lane.visible = false;
    patches.forEach((m) => { m.visible = false; });
    debris.forEach((m) => { m.visible = false; });
  }
  function raidDown() {
    clearMarks();
    raid = null;
    hideRaidBar();
    actors.pet.g.visible = true;
    magic.note?.('Down. The brute still stands.');
    end(false);
  }
  function raidWin() {
    clearMarks();
    raid = null;
    raidClear = true;
    hideRaidBar();
    actors.pet.g.visible = true;
    magic.note?.('The brute falls. The hex keeps the quiet.');
    end(true);
  }
  function raidStep(dt) {
    if (raid.intro > 0) raid.intro = Math.max(0, raid.intro - dt);
    const phase = raid.breathing ? BREAK : LOOP[raid.i];
    raid.t += dt;
    const foe = actors.foe;
    const you = playerLocal();
    const from = { x: foe.g.position.x, z: foe.g.position.z };
    lane.visible = false;
    warn.visible = false;
    if (phase.id === 'read' || phase.id === 'charge') {
      if (!raid.aimed) {
        raid.aimed = true;
        raid.aim = { x: you.x, z: you.z };
      }
      const hot = phase.id === 'charge';
      layLane(from, raid.aim, hot ? 0.72 : 0.28 + Math.sin(raid.t * 8) * 0.1);
      lane.material.color.set(hot ? '#e23b32' : '#ffb043');
      warn.visible = true;
      warn.position.set(raid.aim.x, 0.06, raid.aim.z);
      warn.scale.setScalar(hot ? 1.15 : 1.35);
      warn.material.color.set(hot ? '#e23b32' : '#ffb043');
      warn.material.opacity = hot ? 0.8 : 0.4;
      if (hot && raid.t > 1.6 && !raid.struck) {
        raid.struck = true;
        const held = iceBlocks(from.x, from.z, raid.aim.x, raid.aim.z);
        if (held) magic.note?.('The ice holds the charge.');
        else if (inLane(you, from, raid.aim) && magic.hurt?.(18)) raidDown();
      }
    } else if (phase.id === 'embers') {
      patches.forEach((m) => { m.visible = true; });
      if (!raid.lit) {
        raid.lit = true;
        for (const m of patches) {
          const at = worldOf(m.position);
          magic.ignite?.(at.x, at.z, 1.5);
        }
      }
      for (const m of patches) {
        if (!raid) break;
        if (Math.hypot(you.x - m.position.x, you.z - m.position.z) < 1.25 && magic.hurt?.(8 * dt)) raidDown();
      }
    } else if (phase.id === 'whirl') {
      patches.forEach((m) => { m.visible = false; });
      if (!raid.spun) {
        raid.spun = true;
        const at = worldOf({ x: 0, z: 0 });
        magic.whirl?.({ x: at.x, y: root.position.y + 0.2, z: at.z });
        debris.forEach((m, i) => {
          m.visible = true;
          m.position.set(Math.cos(i * 1.2) * 3.4, 0.25, Math.sin(i * 1.2) * 3.4);
        });
      }
      debris.forEach((m) => {
        m.position.x += (0 - m.position.x) * Math.min(1, dt * 1.6);
        m.position.z += (0 - m.position.z) * Math.min(1, dt * 1.6);
        m.position.y = 0.35 + Math.sin(raid.t * 6 + m.position.x) * 0.22;
      });
    }
    if (!raid) return;
    for (const m of magic.marks?.() || []) {
      const dx = root.position.x + from.x - m.x;
      const dz = root.position.z + from.z - m.z;
      if (Math.hypot(dx, dz) < (m.r || 1.5)) foe.hp -= Math.max(4, (m.d || 8) * 0.45);
    }
    foe.hp = Math.max(0, foe.hp);
    foe.g.lookAt(root.position.x + you.x, foe.g.position.y, root.position.z + you.z);
    raidBarPaint();
    if (foe.hp <= 0) {
      raidWin();
      return;
    }
    if (!raid.broke && !raid.breathing && foe.hp <= foe.max * 0.5) {
      raid.broke = true;
      raid.breathing = true;
      raid.t = 0;
      raid.struck = false;
      raid.lit = false;
      raid.aimed = false;
      clearMarks();
      magic.note?.(`${foe.name} · Break`);
      return;
    }
    if (raid.t >= phase.dur) {
      raid.breathing = false;
      raid.i = (raid.i + 1) % LOOP.length;
      raid.t = 0;
      raid.struck = false;
      raid.lit = false;
      raid.spun = false;
      raid.aimed = false;
      magic.note?.(`${foe.name} · ${LOOP[raid.i].name}`);
    }
  }

  function update(dt) {
    if (!root.visible) return;
    mixers.forEach((m) => m.update(dt));
    if (!active && !freeze) return;
    hitch();
    if (raid) { raidStep(dt); return; }
    if (bout) { boutStep(dt); return; }
    if (freeze) return;
    actors.pet.sta = Math.min(100, actors.pet.sta + dt * 14);
    actors.foe.sta = Math.min(100, actors.foe.sta + dt * 12);
    actors.pet.cd = Math.max(0, actors.pet.cd - dt);
    actors.foe.cd = Math.max(0, actors.foe.cd - dt);
    actors.pet.guard = Math.max(0, actors.pet.guard - dt);
    actors.foe.guard = Math.max(0, actors.foe.guard - dt);
    if (slam) {
      slam.t += dt;
      const u = Math.min(1, slam.t / 0.7);
      const self = slam.who === 'pet' ? actors.pet : actors.foe;
      const arc = Math.sin(u * Math.PI) * (slam.high + 1.1);
      self.g.position.lerpVectors(slam.from, slam.foe, u);
      self.g.position.y = arc;
      self.g.rotation.x = -0.8 * Math.sin(u * Math.PI);
      if (u >= 1) {
        const other = slam.who === 'pet' ? actors.foe : actors.pet;
        hurt(other, 12 + slam.bonus, self.type);
        burst(slam.foe.x, 0, slam.foe.z);
        self.g.position.y = 0;
        self.g.rotation.x = 0;
        slam = null;
      }
    }
    ai -= dt;
    if (ai <= 0 && actors.foe.hp > 0 && !slam) {
      ai = 1.25;
      const move = actors.foe.sta < 16 ? 'guard' : Math.random() < 0.34 ? 'slam' : Math.random() < 0.5 ? 'elem' : 'nip';
      act('foe', move);
    }
    if (shock.visible) {
      shock.scale.multiplyScalar(1 + dt * 2.4);
      shock.material.opacity = Math.max(0, shock.material.opacity - dt * 1.4);
      if (shock.material.opacity <= 0.02) shock.visible = false;
    }
    dip = Math.max(0, dip - dt * 1.6);
    bits.forEach((b) => {
      if (b.life <= 0) return;
      b.life -= dt;
      b.m.position.addScaledVector(b.v, dt);
      b.v.y -= dt * 6;
      if (b.life <= 0) b.m.visible = false;
    });
    bars();
    if (actors.foe.hp <= 0) end(true);
    else if (actors.pet.hp <= 0) end(false);
  }
  function look(cam) {
    if (raid && raid.intro > 0) {
      const u = 1 - raid.intro / 2.2;
      const ang = -0.4 + u * 1.35;
      const x = root.position.x + Math.sin(ang) * 8.2;
      const z = root.position.z + Math.cos(ang) * 7.4;
      cam.position.set(x, root.position.y + 4.4 - u * 1.5, z);
      cam.lookAt(root.position.x + 1.2, root.position.y + 1.15, root.position.z);
      return true;
    }
    if (raid) return false;
    {
      const pet = actors.pet.g.position;
      const foe = actors.foe.g.position;
      const dx = foe.x - pet.x;
      const dz = foe.z - pet.z;
      const len = Math.hypot(dx, dz) || 1;
      const fx = dx / len;
      const fz = dz / len;
      const sx = fz;
      const sz = -fx;
      cam.position.set(
        root.position.x + pet.x - fx * 2.35 + sx * 0.72,
        root.position.y + 1.45,
        root.position.z + pet.z - fz * 2.35 + sz * 0.72,
      );
      cam.lookAt(
        root.position.x + (pet.x * 0.35 + foe.x * 0.65),
        root.position.y + 0.55,
        root.position.z + (pet.z * 0.35 + foe.z * 0.65),
      );
      return true;
    }
  }

  MOVE_IDS.forEach((id, i) => {
    document.getElementById(id)?.addEventListener('pointerup', (e) => {
      if (bout) choose(i);
      else act('pet', ['slam', 'elem', 'guard', 'nip'][i]);
      e.preventDefault();
      e.stopPropagation();
    });
  });
  document.getElementById('petClose')?.addEventListener('pointerup', (e) => {
    if (card) card.hidden = true;
    root.visible = false;
    e.preventDefault();
    e.stopPropagation();
  });

  return {
    root, begin, beginRaid, beginBout, pose, update, look, act, end, loading, pick: choose,
    foeSpot() {
      return { x: root.position.x + actors.foe.g.position.x, y: root.position.y + 0.9, z: root.position.z + actors.foe.g.position.z };
    },
    wound(n, x, z) {
      if (!active || n <= 0) return false;
      const spot = { x: root.position.x + actors.foe.g.position.x, z: root.position.z + actors.foe.g.position.z };
      if (x != null && Math.hypot(spot.x - x, spot.z - z) > 4.8) return false;
      if (raid) { actors.foe.hp = Math.max(0, actors.foe.hp - n); return true; }
      if (bout && !bout.over) {
        bout.wild.hp = Math.max(0, bout.wild.hp - n);
        actors.foe.hp = bout.wild.hp;
        if (bout.wild.hp <= 0) finishBout(true);
        return true;
      }
      actors.foe.hp = Math.max(0, actors.foe.hp - n * 0.35);
      return actors.foe.hp >= 0;
    },
    mendPet(n) {
      if (!bout || bout.over || n <= 0) return false;
      bout.mine.hp = Math.min(bout.mine.max, bout.mine.hp + n);
      actors.pet.hp = bout.mine.hp;
      bars();
      return true;
    },
    get playerCam() { return !!(raid && raid.intro <= 0); },
    get sweep() { return !!(raid && raid.intro > 0); },
    bind(next) { magic = { ...magic, ...next }; },
    get active() { return active; },
    get ready() { return ready; },
    get spot() { return root.position; },
    pet: actors.pet,
    foe: actors.foe,
  };
}
