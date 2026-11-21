// A light pet duel. The owned pet is the Quaternius fox (CC0). A wild deer or
// wolf meets it on a small arena of rubble and a boulder ridge. Leap Slam
// takes height from those props. The Mage's wheel and the Summoner's staff
// are left alone.
import * as THREE from 'three';

const PET_KEY = 'aro-pet';
const BEATS = { fire: 'frost', frost: 'earth', earth: 'wind', wind: 'fire' };
const ELEM = { fire: 'Ember', frost: 'Rime', wind: 'Gust', earth: 'Quake' };
const FOE_TYPE = { fox: 'fire', wolf: 'frost', deer: 'earth', boar: 'earth', bunny: 'wind', slime: 'frost', goblin: 'earth', bear: 'earth', cow: 'earth', crab: 'earth', fish: 'frost' };
const MOB = { fox: 'mobs/cc0/fox.glb', wolf: 'mobs/cc0/wolf.glb', deer: 'mobs/cc0/deer.glb' };
const TALL = { fox: 1.05, wolf: 1.15, deer: 1.35 };

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
    for (const kind of ['fox', 'wolf', 'deer']) {
      try { cache[kind] = await loader.loadAsync(new URL(MOB[kind], document.baseURI).href); } catch { /* stand-in stays */ }
    }
    function wear(actor, kind) {
      const gltf = cache[kind];
      if (!gltf) return;
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
    const entry = won ? living?.defeat?.(foeKind) : living?.sight?.(foeKind, { where: 'duel' });
    if (card) {
      card.hidden = false;
      const result = document.getElementById('petResult');
      const title = document.getElementById('petTitle');
      const xp = document.getElementById('petXp');
      const book = document.getElementById('petBook');
      if (result) result.textContent = won ? 'Win' : 'Lose';
      if (title) title.textContent = row.name;
      if (xp) xp.textContent = `+${gain} XP · level ${level}${rose ? ' · level up' : ''}`;
      if (book) book.textContent = entry ? `Bestiary · ${entry.name} · ${won ? `defeated ${entry.defeated}` : 'seen'}` : 'Bestiary updated';
    }
    if (hud) hud.hidden = true;
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
    root.visible = true;
    active = true;
    freeze = false;
    showBars = true;
    ai = 1.1;
    dip = 0;
    slam = null;
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

  function update(dt) {
    if (!root.visible) return;
    mixers.forEach((m) => m.update(dt));
    if (!active && !freeze) return;
    hitch();
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
    const pet = actors.pet.g.position;
    const foe = actors.foe.g.position;
    const x = root.position.x + (pet.x + foe.x) * 0.5;
    const z = root.position.z + (pet.z + foe.z) * 0.5;
    const y = root.position.y;
    cam.position.set(x + 7.2, y + 3.4 - dip * 1.35, z + 6.4);
    cam.lookAt(x, y + 0.9 - dip * 0.35, z);
  }

  document.getElementById('petSlam')?.addEventListener('pointerup', (e) => { act('pet', 'slam'); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('petElemBtn')?.addEventListener('pointerup', (e) => { act('pet', 'elem'); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('petGuard')?.addEventListener('pointerup', (e) => { act('pet', 'guard'); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('petNip')?.addEventListener('pointerup', (e) => { act('pet', 'nip'); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('petClose')?.addEventListener('pointerup', (e) => {
    if (card) card.hidden = true;
    root.visible = false;
    e.preventDefault();
    e.stopPropagation();
  });

  return {
    root, begin, pose, update, look, act, end, loading,
    get active() { return active; },
    get ready() { return ready; },
    get spot() { return root.position; },
    pet: actors.pet,
    foe: actors.foe,
  };
}
