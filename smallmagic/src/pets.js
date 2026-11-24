// Battle pets. Common and uncommon meadow beasts, kept in a party of three.
// Names and moves are this meadow's. Models are the CC0 creatures already on the map.
import * as THREE from 'three';

const KEY = 'aro-party';
const FILES = {
  bunny: 'mobs/cc0/bunny.glb',
  fox: 'mobs/cc0/fox.glb',
  deer: 'mobs/cc0/deer.glb',
  crab: 'mobs/cc0/crab.glb',
  cow: 'mobs/cc0/cow.glb',
  wolf: 'mobs/cc0/wolf.glb',
  fish: 'mobs/cc0/fish.glb',
  boar: 'mobs/overaction/boar.glb',
  goblin: 'mobs/overaction/goblin.glb',
};
const TALL = { bunny: 0.62, fox: 0.72, deer: 0.95, crab: 0.42, cow: 0.9, wolf: 0.78, fish: 0.36, boar: 0.85, goblin: 0.7 };

export const ROSTER = {
  bunny: {
    kind: 'bunny', name: 'Pippin', element: 'growth', hp: 28, speed: 14,
    moves: [
      { name: 'Nibble', el: 'growth', pow: 8 },
      { name: 'Kick', el: 'bleed', pow: 7 },
      { name: 'Hop', el: 'wind', pow: 10, slam: true },
      { name: 'Sprout', el: 'growth', pow: 4, heal: 6 },
    ],
  },
  fox: {
    kind: 'fox', name: 'Ember', element: 'burn', hp: 26, speed: 16,
    moves: [
      { name: 'Nip', el: 'bleed', pow: 8 },
      { name: 'Spark', el: 'burn', pow: 9 },
      { name: 'Tail whip', el: 'wind', pow: 7 },
      { name: 'Flare', el: 'burn', pow: 12 },
    ],
  },
  deer: {
    kind: 'deer', name: 'Fawn', element: 'wind', hp: 32, speed: 13,
    moves: [
      { name: 'Butt', el: 'bleed', pow: 8 },
      { name: 'Gust', el: 'wind', pow: 9 },
      { name: 'Leap', el: 'wind', pow: 11, slam: true },
      { name: 'Moss lick', el: 'growth', pow: 5, heal: 5 },
    ],
  },
  crab: {
    kind: 'crab', name: 'Click', element: 'chill', hp: 34, speed: 8,
    moves: [
      { name: 'Pinch', el: 'bleed', pow: 9 },
      { name: 'Rime nip', el: 'chill', pow: 8 },
      { name: 'Shell up', el: 'chill', pow: 3, heal: 5 },
      { name: 'Tide snap', el: 'chill', pow: 11 },
    ],
  },
  cow: {
    kind: 'cow', name: 'Clover', element: 'growth', hp: 40, speed: 7,
    moves: [
      { name: 'Stomp', el: 'bleed', pow: 9 },
      { name: 'Cud', el: 'growth', pow: 4, heal: 8 },
      { name: 'Charge', el: 'bleed', pow: 12, slam: true },
      { name: 'Warm hide', el: 'growth', pow: 7 },
    ],
  },
  wolf: {
    kind: 'wolf', name: 'Moth', element: 'chill', hp: 30, speed: 15,
    moves: [
      { name: 'Bite', el: 'bleed', pow: 10 },
      { name: 'Rime', el: 'chill', pow: 9 },
      { name: 'Howl', el: 'wind', pow: 8 },
      { name: 'Frost lunge', el: 'chill', pow: 12, slam: true },
    ],
  },
  fish: {
    kind: 'fish', name: 'Minnow', element: 'chill', hp: 22, speed: 12,
    moves: [
      { name: 'Splash', el: 'chill', pow: 7 },
      { name: 'Dart', el: 'wind', pow: 8 },
      { name: 'Scale cut', el: 'bleed', pow: 7 },
      { name: 'Cold fin', el: 'chill', pow: 10 },
    ],
  },
  boar: {
    kind: 'boar', name: 'Trot', element: 'bleed', hp: 36, speed: 9,
    moves: [
      { name: 'Tusk', el: 'bleed', pow: 10 },
      { name: 'Shoulder', el: 'bleed', pow: 8, slam: true },
      { name: 'Bristle', el: 'wind', pow: 7 },
      { name: 'Mud kick', el: 'growth', pow: 6 },
    ],
  },
  slime: {
    kind: 'slime', name: 'Puddle', element: 'chill', hp: 30, speed: 8,
    moves: [
      { name: 'Seep', el: 'chill', pow: 8 },
      { name: 'Gel coat', el: 'chill', pow: 4, heal: 5 },
      { name: 'Split', el: 'growth', pow: 7 },
      { name: 'Cold drip', el: 'chill', pow: 11 },
    ],
  },
  goblin: {
    kind: 'goblin', name: 'Nim', element: 'wind', hp: 24, speed: 15,
    moves: [
      { name: 'Pebble', el: 'wind', pow: 8 },
      { name: 'Trip', el: 'bleed', pow: 7 },
      { name: 'Whistle', el: 'wind', pow: 9 },
      { name: 'Scramble', el: 'wind', pow: 11, slam: true },
    ],
  },
};

function loadParty() {
  try {
    const row = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (row?.slots) return row;
  } catch { /* a new party */ }
  return { slots: [], active: 0 };
}
function saveParty(row) {
  try { localStorage.setItem(KEY, JSON.stringify(row)); } catch { /* private mode */ }
}
function fresh(kind) {
  const spec = ROSTER[kind];
  return { kind, name: spec.name, element: spec.element, xp: 0, level: 1, max: spec.hp, speed: spec.speed, power: 0, hp: spec.hp };
}
export function grow(row, gain) {
  row.xp = (row.xp || 0) + gain;
  const level = 1 + Math.floor(row.xp / 26);
  const spec = ROSTER[row.kind];
  row.max = spec.hp;
  row.speed = spec.speed;
  row.power = 0;
  row.level = 1;
  let bump = '';
  while (row.level < level) {
    row.level += 1;
    const which = (row.level - 1) % 3;
    if (which === 1) { row.max += 4; bump = 'HP +4'; }
    else if (which === 2) { row.speed += 1; bump = 'Speed +1'; }
    else { row.power += 1; bump = 'Power +1'; }
  }
  row.hp = row.max;
  row.bump = bump;
  return row;
}
function battleRow(row, wildName) {
  const spec = ROSTER[row.kind];
  return {
    kind: row.kind,
    name: wildName || row.name,
    element: row.element,
    level: row.level || 1,
    max: row.max,
    hp: row.max,
    speed: row.speed,
    power: row.power || 0,
    moves: spec.moves,
  };
}

export function createPets({ scene, world, walker, living, zones, duel }) {
  const party = loadParty();
  const root = new THREE.Group();
  root.name = 'battle-pet';
  root.visible = false;
  scene.add(root);
  let shown = '';
  let mixer = null;
  let clips = {};
  let clipName = '';
  let calmN = -1;
  let calmT = 0;
  let picked = null;
  const prompt = document.getElementById('petPrompt');
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function active() {
    return party.slots[party.active] || null;
  }
  function known(kind) {
    try { return !!living.book?.().seen?.[kind]; } catch { return false; }
  }
  function remember(kind) {
    if (!known(kind)) living.sight?.(kind, { where: 'meadow' });
  }
  function paintPrompt(row, calm, weak) {
    if (!prompt) return;
    const spec = ROSTER[row.kind];
    const tier = document.getElementById('petPromptTier');
    const name = document.getElementById('petPromptName');
    const line = document.getElementById('petPromptLine');
    const befriend = document.getElementById('petBefriend');
    if (tier) tier.textContent = known(row.kind) ? 'In the bestiary' : 'New to the bestiary';
    if (name) name.textContent = spec.name;
    if (line) {
      line.textContent = weak
        ? 'Weakened. A quiet hand might keep it.'
        : calm
          ? 'It stays still beside you.'
          : 'Stand quietly, or weaken it, before it will stay.';
    }
    if (befriend) befriend.hidden = !(calm || weak);
    prompt.hidden = false;
  }
  function shut() {
    if (prompt) prompt.hidden = true;
    picked = null;
  }
  function reward(name) {
    living.chime?.();
    const card = document.getElementById('petCard');
    const result = document.getElementById('petResult');
    const title = document.getElementById('petTitle');
    const xp = document.getElementById('petXp');
    const book = document.getElementById('petBook');
    if (result) result.textContent = 'Rare catch';
    if (title) title.textContent = name;
    if (xp) xp.textContent = '+12 Resonance';
    if (book) book.textContent = 'The bestiary keeps the find.';
    if (card) card.hidden = false;
    magicReward?.(name);
  }
  let magicReward = null;
  function join(kind, keepN, tier) {
    if (!ROSTER[kind]) return null;
    if (party.slots.some((s) => s.kind === kind)) {
      zones.toast?.(`${ROSTER[kind].name} is already with you.`);
      return null;
    }
    if (party.slots.length >= 3) {
      zones.toast?.('Three pets already. That is the party.');
      return null;
    }
    if (keepN != null) zones.keepBeast?.(keepN);
    remember(kind);
    const row = fresh(kind);
    party.slots.push(row);
    party.active = party.slots.length - 1;
    saveParty(party);
    zones.toast?.(`${row.name} follows you.`);
    if (tier === 'rare' || tier === 'epic' || tier === 'mythic') reward(row.name);
    return row;
  }
  function startBattle(mine, wild) {
    shut();
    zones.enter?.('meadow');
    duel.beginBout(battleRow(mine), wild);
  }
  function onBout({ won, kind, gain }) {
    const row = party.slots.find((s) => s.kind === kind) || active();
    if (!row) return {};
    const before = row.level || 1;
    grow(row, gain);
    saveParty(party);
    const rose = row.level > before;
    return {
      line: `+${gain} XP · level ${row.level}${rose ? ` · ${row.bump}` : ''}`,
      book: `${row.element} · ${row.max} HP · speed ${row.speed}`,
    };
  }
  duel.bind?.({ onBout });

  document.getElementById('petBefriend')?.addEventListener('pointerup', (e) => {
    if (picked) join(picked.kind, picked.n, picked.tier);
    shut();
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('petBattle')?.addEventListener('pointerup', (e) => {
    const mine = active();
    if (!mine) zones.toast?.('Befriend a pet first.');
    else if (picked) {
      const spec = ROSTER[picked.kind];
      startBattle(mine, battleRow(fresh(picked.kind), `Wild ${spec.name}`));
    }
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('petPromptX')?.addEventListener('pointerup', (e) => {
    shut();
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('petTest')?.addEventListener('pointerup', (e) => {
    const settingsEl = document.getElementById('settings');
    if (settingsEl) settingsEl.hidden = true;
    const menu = document.getElementById('menu');
    if (menu) menu.hidden = true;
    const mine = active() || join('bunny', null);
    if (mine) startBattle(mine, battleRow(fresh('wolf'), "Bram's moth"));
    e.preventDefault();
    e.stopPropagation();
  });

  let cam = null;
  function arm(camera) { cam = camera; }

  function gelBody() {
    const gel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshBasicMaterial({ color: '#2f8f5a', transparent: true, opacity: 0.88 }));
    gel.scale.set(1.15, 0.5, 1.15);
    gel.position.y = 0.16;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: '#1d5c38' }));
    cap.position.y = 0.32;
    const g = new THREE.Group();
    g.add(gel, cap);
    return g;
  }
  async function wear(kind) {
    if (shown === kind) return;
    shown = kind;
    while (root.children.length) root.remove(root.children[0]);
    if (kind === 'slime') { root.add(gelBody()); return; }
    let GLTFLoader;
    let SkeletonUtils;
    try {
      ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
      SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
    } catch { return; }
    try {
      const gltf = await new GLTFLoader().loadAsync(new URL(FILES[kind], document.baseURI).href);
      if (shown !== kind) return;
      const model = SkeletonUtils.clone(gltf.scene);
      const box = new THREE.Box3().setFromObject(model);
      const h = Math.max(0.2, box.max.y - box.min.y);
      model.scale.multiplyScalar((TALL[kind] || 0.7) / h);
      model.position.y -= box.min.y * model.scale.y;
      mixer = new THREE.AnimationMixer(model);
      clips = {};
      clipName = '';
      for (const clip of gltf.animations) {
        const key = String(clip.name || '').toLowerCase();
        const slot = /walk|run/.test(key) && !/gallop/.test(key) ? 'walk' : /idle/.test(key) ? 'idle' : '';
        if (slot && !clips[slot]) clips[slot] = mixer.clipAction(clip);
      }
      if (clips.idle) { clips.idle.play(); clipName = 'idle'; }
      root.add(model);
    } catch { /* the party still exists without the mesh */ }
  }
  function playClip(name) {
    const next = clips[name] || (name === 'walk' ? null : clips.idle);
    if (!next || clipName === name) return;
    next.reset().fadeIn(0.18).play();
    if (clips[clipName] && clips[clipName] !== next) clips[clipName].fadeOut(0.18);
    clipName = next === clips.walk ? 'walk' : 'idle';
  }

  function update(dt, camera, floorY) {
    if (camera) cam = camera;
    const row = active();
    const here = zones.name === 'meadow' && !duel.active && row;
    root.visible = !!here;
    if (!here) {
      calmT = 0;
      return;
    }
    wear(row.kind);
    const sky = living.weather || 'clear';
    const rate = sky === 'fog' ? 1.4 : 3.2;
    const back = typeof floorY === 'number' ? 0.55 : (sky === 'wind' ? 1.7 : 1.25);
    const tx = walker.feet.x - Math.sin(walker.yaw) * back;
    const tz = walker.feet.z - Math.cos(walker.yaw) * back;
    const before = Math.hypot(tx - root.position.x, tz - root.position.z);
    root.position.x += (tx - root.position.x) * Math.min(1, dt * rate);
    root.position.z += (tz - root.position.z) * Math.min(1, dt * rate);
    playClip(before > 0.18 ? 'walk' : 'idle');
    mixer?.update(dt);
    const y = typeof floorY === 'number' ? floorY : world.ground(root.position.x, root.position.z);
    let shadow = root.getObjectByName('petshadow');
    if (!shadow) {
      shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), new THREE.MeshBasicMaterial({ color: '#140e0a', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.name = 'petshadow';
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 20), new THREE.MeshBasicMaterial({ color: '#f1d9a4', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.name = 'petring';
      root.add(shadow, ring);
    }
    shadow.visible = typeof floorY === 'number';
    const ring = root.getObjectByName('petring');
    if (ring) ring.visible = shadow.visible;
    const t = performance.now() * 0.001;
    if (sky === 'rain') {
      root.position.y = y + Math.sin(t * 16) * 0.02;
      root.rotation.z = Math.sin(t * 14) * 0.12;
    } else if (sky === 'wind') {
      root.position.y = y;
      root.rotation.z = Math.sin(t * 1.6) * 0.22;
    } else if (sky === 'fog') {
      root.position.y = y + Math.sin(t) * 0.03;
      root.rotation.z *= 0.9;
    } else {
      root.position.y = y + Math.abs(Math.sin(t * 3)) * 0.05;
      root.rotation.z *= 0.85;
    }
    const face = Math.atan2(walker.feet.x - root.position.x, walker.feet.z - root.position.z);
    root.rotation.y += (face - root.rotation.y) * Math.min(1, dt * 4);
    const near = zones.nearestBeast?.(walker.feet.x, walker.feet.z, 2.6);
    if (near && near.n === calmN && walker.speed < 0.45) calmT += dt;
    else { calmN = near ? near.n : -1; calmT = 0; }
  }
  function tap(e, camera) {
    if (duel.active || zones.name !== 'meadow') return;
    if (e.target?.closest?.('button, #settings, #menu, #petPrompt, #petCard, #hexcard, #spells, #petHud')) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = zones.rayBeast?.(ray);
    if (!hit || !ROSTER[hit.kind]) return;
    remember(hit.kind);
    picked = hit;
    const weak = hit.hp <= hit.max * 0.55;
    const calm = calmN === hit.n && calmT >= 1.1;
    paintPrompt(hit, calm, weak);
  }

  return {
    root, update, tap, arm, join, party, roster: ROSTER,
    set onRare(fn) { magicReward = fn; },
  };
}
