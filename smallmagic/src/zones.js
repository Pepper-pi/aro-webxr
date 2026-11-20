// The ship, the meadow, and Long Lake. All of it is drawn in code. Nothing here is a picture or a recording.
import * as THREE from 'three';
import { createBeasts, PACKS, patchWebKitImageBitmap } from './beasts.js';
import { TUNE } from './rider.js';
import { buildVillage } from './cabins.js';

const mat = (color) => new THREE.MeshBasicMaterial({ color });
const lit = (color) => new THREE.MeshLambertMaterial({ color });
const box = (w, h, d, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lit(color));
  m.position.set(x, y, z);
  return m;
};

function sky(top, horizon) {
  const g = new THREE.SphereGeometry(40, 16, 10);
  const c = new THREE.Color(top), h = new THREE.Color(horizon);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 40 * 0.5 + 0.5, 0, 1);
    const k = c.clone().lerp(h, 1 - t);
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  mesh.frustumCulled = false;
  return mesh;
}

function labelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 36px Georgia';
  g.fillStyle = '#f6ead0';
  g.textAlign = 'center';
  g.fillText(text, 128, 46);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  s.userData.canvas = c;
  return s;
}
function paintLabel(sprite, text) {
  const c = sprite.userData.canvas, g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = 'bold 36px Georgia';
  g.fillStyle = '#f6ead0';
  g.textAlign = 'center';
  g.fillText(text, 128, 46);
  sprite.material.map.needsUpdate = true;
}
function ring(color) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#24180f'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#f1d9a4'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 300);
  g.fillStyle = '#f1d9a4'; g.font = '28px Georgia'; g.fillText('Where to', 58, 58);
  g.font = '24px Georgia'; g.fillText('Meadow', 62, 140); g.fillText('Long Lake', 48, 210);
  const t = new THREE.CanvasTexture(c);
  return t;
}

const PLOT = [-32, -8];
function numeral(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 92px Georgia';
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#1a1008';
  g.strokeText(text, 128, 100);
  g.fillStyle = color;
  g.fillText(text, 128, 100);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.center.set(0.5, 0.2);
  return s;
}
export function createZones({ scene, world, walker, camera, air }) {
  const saved = { home: world.home, edge: world.edge, colliders: world.colliders, walk: world.walk, blockers: world.blockers };
  const meadowRing = ring(0x9ee7ff);
  meadowRing.position.set(PLOT[0], world.ground(PLOT[0], PLOT[1]) + 0.2, PLOT[1] - 2.4);
  const hub = new THREE.Group();
  const village = buildVillage(world.root, world, air);
  world.blow = (x, z, dx, dz, r) => village.blow(x, z, dx, dz, r);
  world.pound = (x, z, r) => village.pound(x, z, r);
  world.addLoose = (mesh, v, life) => village.addLoose(mesh, v, life);
  world.takeLoose = (x, z, r, n) => village.takeLoose(x, z, r, n);
  world.swirl = (x, z, r) => village.swirl(x, z, r);
  world.breakAt = (x, z, r, token) => village.breakAt(x, z, r, token);
  // Hook for a warrior ability that is not in the game yet. Tornado rips a few core tiles only
  // while this returns true. It stays off, so a normal tornado only swirls loose debris.
  world.warriorTornado = () => false;
  const priorBlock = world.blockers;
  const blockFeet = (f) => { priorBlock?.(f); village.block(f); };
  hub.add(sky('#3a2a1c', '#c4a07a'));
  hub.add(box(11, 0.14, 14, '#a67c52', 0, -0.07, 0));
  hub.add(box(11, 2.6, 0.16, '#6b4a32', 0, 1.3, 6.9));
  hub.add(box(0.16, 2.6, 14, '#7a5538', -5.5, 1.3, 0));
  hub.add(box(0.16, 2.6, 14, '#7a5538', 5.5, 1.3, 0));
  hub.add(box(11, 2.6, 0.16, '#5c4030', 0, 1.3, -6.9));
  hub.add(box(11, 0.12, 14, '#4a3428', 0, 2.6, 0));
  hub.add(box(1.6, 0.08, 0.8, '#c4a574', 2.4, 0.74, 1.2));
  hub.add(box(2.4, 2.5, 0.08, '#e7d3a8', 0, 1.35, 6.72));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), new THREE.MeshBasicMaterial({ map: boardTexture() }));
  screen.position.set(0, 1.35, 6.8);
  screen.scale.set(1.2, 1.2, 1);
  screen.name = 'command-board';
  hub.add(screen);
  const hubRing = ring(0xffe08a);
  hubRing.position.set(0, 0.08, -4.4);
  const destTag = labelSprite('Meadow');
  destTag.position.y = 0.7;
  hubRing.add(destTag);
  hub.add(hubRing);
  const friend = (tunic, x, z, yaw) => {
    const g = new THREE.Group();
    const cloth = mat(tunic);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.16), mat('#3a342c'));
    legs.position.y = 0.28;
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.2), cloth);
    shirt.position.y = 0.68;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat('#f0c2a0'));
    head.position.y = 1.02;
    g.add(legs, shirt, head);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return g;
  };
  const hearth = new THREE.Group();
  hearth.position.set(-3.55, 0, -4.75);
  const stone = (w, h, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lit(color));
    m.position.set(x, y, z);
    return m;
  };
  hearth.add(
    stone(2.05, 0.28, 1.05, '#6d5646', 0, 0.14, 0.22),
    stone(1.85, 1.25, 0.28, '#4a3428', 0, 0.95, -0.22),
    stone(0.26, 1.2, 0.62, '#5c4334', -0.86, 0.9, 0.08),
    stone(0.26, 1.2, 0.62, '#5c4334', 0.86, 0.9, 0.08),
    stone(2.15, 0.18, 0.5, '#3a2a22', 0, 1.58, 0.02),
    stone(0.12, 0.42, 0.12, '#2a2018', -0.42, 0.42, 0.18),
    stone(0.12, 0.42, 0.12, '#2a2018', 0.42, 0.42, 0.18),
  );
  const flameMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = [0.22, 0.15, 0.08].map((r, i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, 0.55 - i * 0.1, 7), flameMat(i === 2 ? '#fff1c4' : i === 1 ? '#ffb15a' : '#ff6a1a', 0.75 - i * 0.08));
    f.position.set(0, 0.7 + i * 0.12, 0.48);
    hearth.add(f);
    return f;
  });
  const embers = [];
  for (let i = 0; i < 10; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 4), flameMat('#ffc56a', 0.9));
    e.userData.p = i / 10;
    e.userData.x = (i - 4.5) * 0.06;
    hearth.add(e);
    embers.push(e);
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.03, 0.35);
  hearth.add(glow);
  const roomLight = new THREE.HemisphereLight('#ffe6c8', '#6a4030', 0.95);
  const fillLight = new THREE.AmbientLight('#ffd0a6', 0.42);
  const fireLight = new THREE.PointLight('#ff7a2a', 8, 11, 2);
  fireLight.position.set(-3.55, 1.15, -4.2);
  const sideLight = new THREE.PointLight('#ffc48a', 3.2, 10, 2);
  sideLight.position.set(1.2, 1.7, -0.4);
  hub.add(hearth, roomLight, fillLight, fireLight, sideLight);
  const plaques = new THREE.Group();
  plaques.position.set(5.28, 0, -1.35);
  plaques.rotation.y = -Math.PI / 2;
  hub.add(plaques);
  const emote = (text) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 40px Georgia';
    g.fillStyle = '#fff6dc';
    g.textAlign = 'center';
    g.fillText(text, 64, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(0.7, 0.35, 1);
    s.position.y = 1.45;
    s.visible = false;
    return s;
  };
  const pals = [
    { id: 'maren', name: 'Maren', color: '#c45a4a', home: [-2.0, 0, -3.0], yaw: -0.4, line: 'The fire is the good seat.', file: 'maren' },
    { id: 'sable', name: 'Sable', color: '#3d7a8c', home: [2.6, 0, -0.2], yaw: 1.4, line: 'Your fish are on the wall.', file: 'sable' },
    { id: 'bram', name: 'Bram', color: '#6a8f4a', home: [1.2, 0, 1.2], yaw: 2.6, line: 'One hand. No stakes.', file: 'bram' },
    { id: 'lumen', name: 'Lumen', color: '#c9a15b', home: [-1.8, 0, 2.2], yaw: -0.2, line: 'Rest if the day was long.', file: 'lumen' },
  ].map((p) => {
    const g = friend(p.color, p.home[0], p.home[2], p.yaw);
    const mark = emote('!');
    g.add(mark);
    hub.add(g);
    return { ...p, g, mark, mood: 0 };
  });
  const you = friend('#6a8fbf', 0, 0, 0);
  you.visible = false;
  scene.add(you);
  const buddyBody = friend('#c45a4a', 0, 0, 0);
  buddyBody.visible = false;
  scene.add(buddyBody);
  const hearthSpots = [
    { id: 'fire', name: 'Sit by the fire', x: -2.6, z: -3.5 },
    { id: 'trophy', name: 'Fish trophies', x: 3.4, z: -1.6 },
    { id: 'pot', name: 'Cook a meal', x: -2.2, z: -4.3 },
    { id: 'table', name: 'Play a hand', x: 1.4, z: 0.4 },
    { id: 'bed', name: 'Rest', x: -3.4, z: 2.4 },
  ];
  let buddy = null;
  let buddyT = 0;
  let nearSpot = null;
  const useBtn = document.getElementById('hearthUse');
  const buddySay = document.getElementById('buddySay');
  const cardBox = document.getElementById('cards');
  function note(text) {
    if (!buddySay) return;
    buddySay.hidden = false;
    buddySay.textContent = text;
    clearTimeout(buddySay._t);
    buddySay._t = setTimeout(() => { buddySay.hidden = true; }, 2200);
  }
  function useHearth() {
    const who = useBtn?.dataset.who;
    if (who) {
      buddy = who;
      const pal = pals.find((p) => p.id === who);
      if (pal) {
        dressBuddy(pal);
        note(`${pal.name} comes with you.`);
      }
      buddyBody.position.copy(walker.feet);
      return;
    }
    if (!nearSpot) return;
    if (nearSpot.id === 'fire') {
      walker.place(-2.6, -3.2, -0.2);
      note('You sit by the fire. The room goes quiet.');
    } else if (nearSpot.id === 'trophy') {
      showBook();
      note('The wall keeps every fish you have landed.');
    } else if (nearSpot.id === 'pot') {
      let herbs = 0;
      let book = {};
      try { herbs = Number(localStorage.getItem('aro-herbs') || 0); book = JSON.parse(localStorage.getItem('aro-long-lake') || '{}'); } catch { /* empty */ }
      const species = Object.keys(book).find((id) => (book[id]?.n || 0) > 0);
      if (herbs < 1 || !species) { note('The pot wants one fish and one herb.'); return; }
      book[species].n -= 1;
      try {
        localStorage.setItem('aro-herbs', String(herbs - 1));
        localStorage.setItem('aro-long-lake', JSON.stringify(book));
        localStorage.setItem('aro-meal', String(Date.now() + 60000));
      } catch { /* private mode */ }
      hearts = Math.min(120, hearts + 25);
      note('A warm meal. You feel steadier.');
    } else if (nearSpot.id === 'table') {
      if (cardBox) cardBox.hidden = false;
      note('Bram deals three cards.');
    } else if (nearSpot.id === 'bed') {
      hearts = Math.max(hearts, 100);
      note('You rest. The day can start again.');
    }
  }
  const hearthMixers = [];
  const buddyTag = emote('Friend');
  buddyTag.visible = false;
  buddyTag.position.y = 2.25;
  buddyTag.scale.set(1.3, 0.55, 1);
  buddyBody.add(buddyTag);
  const buddyRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: '#fff1c4', side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
  buddyRing.rotation.x = Math.PI / 2;
  buddyRing.position.y = 0.2;
  buddyRing.renderOrder = 3;
  buddyRing.visible = false;
  buddyBody.add(buddyRing);
  function fitModel(root, height) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = height / (size.y || 1);
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(root);
    root.position.y -= fitted.min.y;
  }
  function toBasic(root, warm) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = [].concat(o.material);
      const next = list.map((m) => {
        const color = m.color ? m.color.clone() : new THREE.Color('#ffffff');
        if (warm) {
          const hsl = { h: 0, s: 0, l: 0 };
          color.getHSL(hsl);
          if (hsl.l > 0.5 || hsl.s < 0.2) color.set('#b86a32');
          else color.lerp(new THREE.Color('#a86838'), 0.45);
        }
        const basic = warm
          ? new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
          : new THREE.MeshBasicMaterial({
            map: m.map || null,
            color,
            transparent: !!m.transparent,
            opacity: m.opacity ?? 1,
            side: THREE.DoubleSide,
          });
        basic.name = m.name || '';
        return basic;
      });
      o.material = next.length === 1 ? next[0] : next;
      o.frustumCulled = false;
    });
  }
  function tintCloth(root, hex) {
    const dye = new THREE.Color(hex);
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (/shirt|pants|cloth|kimono|apron|hat/i.test(m.name || '')) m.color.lerp(dye, 0.35);
      }
    });
  }
  function playIdle(gltf, model) {
    const mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find((a) => /idle/i.test(a.name)) || gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
    hearthMixers.push(mixer);
  }
  function stripBlocks(host) {
    for (const child of [...host.children]) if (child.isMesh) host.remove(child);
  }
  let loadedPeople = null;
  let dressBuddy = () => {};
  let hearthReady = Promise.resolve(false);
  function loadHearth() {
    let done = () => {};
    hearthReady = new Promise((resolve) => { done = resolve; });
    (async () => {
      patchWebKitImageBitmap();
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { clone } = await import('three/addons/utils/SkeletonUtils.js');
      const loader = new GLTFLoader();
      const file = (path) => loader.loadAsync(new URL(path, document.baseURI).href);
      loadedPeople = {
        maren: null, sable: null, bram: null, lumen: null, you: null,
      };
      const people = loadedPeople;
      Object.assign(people, {
        maren: await file('hearth/people/maren.glb'),
        sable: await file('hearth/people/sable.glb'),
        bram: await file('hearth/people/bram.glb'),
        lumen: await file('hearth/people/lumen.glb'),
        you: await file('hearth/people/you.glb'),
      });
      dressBuddy = (pal) => {
        stripBlocks(buddyBody);
        const gltf = loadedPeople[pal.file];
        if (!gltf) return;
        const model = clone(gltf.scene);
        toBasic(model);
        tintCloth(model, pal.color);
        fitModel(model, 1.7);
        buddyBody.add(model);
        playIdle(gltf, model);
        buddyTag.visible = true;
        const canvas = buddyTag.material.map.image;
        const g = canvas.getContext('2d');
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.font = 'bold 36px Georgia';
        g.fillStyle = '#fff6dc';
        g.textAlign = 'center';
        g.fillText(pal.name, canvas.width / 2, 46);
        buddyTag.material.map.needsUpdate = true;
        buddyRing.material.color.set(pal.color);
      };
      const furn = {};
      for (const name of ['bed', 'chair', 'table', 'rug', 'shelves', 'lamp', 'fire', 'pot']) {
        furn[name] = await file(`hearth/furniture/${name}.glb`);
      }
      const put = (gltf, x, y, z, yaw, height) => {
        const model = gltf.scene.clone(true);
        toBasic(model, true);
        fitModel(model, height);
        model.position.x += x;
        model.position.z += z;
        model.position.y += y;
        model.rotation.y = yaw;
        hub.add(model);
        return model;
      };
      put(furn.rug, 0.2, 0, -0.4, 0, 0.04);
      put(furn.rug, -3.4, 0, 3.0, 0.2, 0.03);
      put(furn.fire, -3.55, 0.3, -4.82, 0.2, 0.36);
      put(furn.table, 1.5, 0, -0.8, 0.3, 0.75);
      put(furn.chair, 0.7, 0, -0.5, 0.8, 0.9);
      put(furn.chair, 2.2, 0, -1.3, -2.2, 0.9);
      put(furn.bed, -3.6, 0, 3.3, Math.PI / 2, 0.7);
      put(furn.shelves, 4.7, 0, -1.6, -Math.PI / 2, 1.7);
      put(furn.lamp, -1.0, 0, -3.4, 0, 1.35);
      put(furn.pot, -2.35, 0, -4.15, 0.6, 0.46);
      for (const p of pals) {
        const gltf = people[p.file];
        if (!gltf) continue;
        stripBlocks(p.g);
        const model = clone(gltf.scene);
        toBasic(model);
        tintCloth(model, p.color);
        fitModel(model, 1.65);
        p.g.add(model);
        playIdle(gltf, model);
        p.mark.position.y = 1.85;
      }
      stripBlocks(you);
      const youModel = clone(people.you.scene);
      toBasic(youModel);
      tintCloth(youModel, '#6a8fbf');
      fitModel(youModel, 1.65);
      you.add(youModel);
      playIdle(people.you, youModel);
      done(true);
    })().catch((err) => { console.warn('hearth models', err); done(false); });
  }
  loadHearth();
  useBtn?.addEventListener('pointerup', (e) => { useHearth(); e.preventDefault(); e.stopPropagation(); });
  cardBox?.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('pointerup', (e) => {
    const win = Math.random() < 0.5;
    note(win ? 'Your card matches. Bram nods.' : 'Bram takes the hand, kindly.');
    cardBox.hidden = true;
    e.preventDefault();
    e.stopPropagation();
  }));

  const target = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 24), new THREE.MeshBasicMaterial({ color: 0xffe7a8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  target.rotation.x = -Math.PI / 2;
  target.visible = false;
  scene.add(target);
  const bobber = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#e23b32'));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat('#f7fbff'));
  cap.scale.y = 0.45; cap.position.y = 0.06;
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  rip.rotation.x = -Math.PI / 2;
  bobber.add(ball, cap, rip);
  bobber.scale.setScalar(0.55);
  bobber.visible = false;
  scene.add(bobber);

  scene.add(meadowRing, hub);
  const beasts = createBeasts(scene, (x, z) => world.ground(x, z), world);
  hub.visible = meadowRing.visible = false;

  const hold = new THREE.Group();
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 8), mat('#6a3a22'));
  const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.016, 0.7, 8), mat('#e2c48a'));
  blank.position.y = 0.4;
  const tipM = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.006, 0.26, 6), mat('#f2e2b8'));
  tipM.position.y = 0.86;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), mat('#e7c48a'));
  reel.rotation.x = Math.PI / 2;
  reel.position.set(0, 0.12, 0.03);
  reel.visible = false;
  rod.add(grip, blank, tipM, reel);
  rod.position.set(0.28, -0.22, -0.48);
  rod.rotation.set(0.82, -0.55, -0.35);
  hold.add(rod);
  scene.add(hold);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xd8fbff }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  const splash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mat('#e7f6ff'));
  splash.visible = false;
  scene.add(splash);
  const ripples = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 24), new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    m.userData.life = 0;
    return m;
  });
  function splashAt(x, z, cyan) {
    const m = ripples.find((r) => r.userData.life <= 0) || ripples[0];
    m.visible = true;
    m.userData.life = 1;
    m.userData.x = x;
    m.userData.z = z;
    m.material.color.set(cyan ? '#5dfff0' : '#dff6ff');
    m.position.set(x, world.water + 0.04, z);
  }
  const pads = [];
  for (let i = 0; i < 6; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.34 + (i % 3) * 0.08, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? '#2f8a45' : '#3eaf58', side: THREE.DoubleSide }));
    const a = -0.8 + i * 0.28;
    pad.position.set(-50 + Math.sin(a) * (6 + (i % 2)), world.water + 0.03, -38 + Math.cos(a) * 2.2);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = i;
    scene.add(pad);
    pads.push(pad);
  }
  const fishShade = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.28 + (i % 2) * 0.12, 7), new THREE.MeshBasicMaterial({ color: '#07141c', transparent: true, opacity: 0.55, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.position.y = world.water - 0.18;
    scene.add(s);
    fishShade.push(s);
  }
  const fly = new THREE.Group();
  const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.06), new THREE.MeshBasicMaterial({ color: '#e7fbff', side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
  fly.add(wing);
  scene.add(fly);
  const wisps = [];
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.02), new THREE.MeshBasicMaterial({ color: '#f6ead0', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(w);
    wisps.push(w);
  }
  const bioGeo = new THREE.BufferGeometry();
  const bioN = 280;
  const bioPos = new Float32Array(bioN * 3);
  const bioCol = new Float32Array(bioN * 3);
  const bioId = new Float32Array(bioN);
  for (let i = 0; i < bioN; i++) {
    const a = (i / bioN) * Math.PI * 2;
    const edge = 0.82 + (i % 5) * 0.04;
    bioPos[i * 3] = -50 + Math.cos(a) * 14 * edge;
    bioPos[i * 3 + 1] = world.water + 0.05;
    bioPos[i * 3 + 2] = -46 + Math.sin(a) * 9 * edge;
    const mag = i % 3 === 0;
    bioCol[i * 3] = mag ? 0.85 : 0.25;
    bioCol[i * 3 + 1] = mag ? 0.25 : 1;
    bioCol[i * 3 + 2] = mag ? 0.95 : 0.9;
    bioId[i] = i * 1.7;
  }
  bioGeo.setAttribute('position', new THREE.BufferAttribute(bioPos, 3));
  bioGeo.setAttribute('color', new THREE.BufferAttribute(bioCol, 3));
  bioGeo.setAttribute('aId', new THREE.BufferAttribute(bioId, 1));
  const bio = new THREE.Points(bioGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uNow: { value: 0 } },
    vertexShader: `attribute float aId; attribute vec3 color; varying vec3 vCol; varying float vTw; uniform float uNow;
      void main() { vCol = color; vTw = 0.25 + 0.75 * abs(sin(uNow * 2.4 + aId)); gl_PointSize = 3.4 + vTw * 6.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vCol; varying float vTw; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vCol, vTw * (1.0 - d * 1.4)); }`,
    vertexColors: true,
  }));
  bio.visible = false;
  bio.frustumCulled = false;
  scene.add(bio);
  const shorePos = new Float32Array(160 * 3);
  const shoreCol = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    const edge = 1.02 + (i % 4) * 0.03;
    shorePos[i * 3] = -50 + Math.cos(a) * 14 * edge;
    shorePos[i * 3 + 1] = world.water + 0.12;
    shorePos[i * 3 + 2] = -46 + Math.sin(a) * 9 * edge;
    shoreCol[i * 3] = 0.95;
    shoreCol[i * 3 + 1] = 0.2 + (i % 3) * 0.08;
    shoreCol[i * 3 + 2] = 1;
  }
  const shoreGeo = new THREE.BufferGeometry();
  shoreGeo.setAttribute('position', new THREE.BufferAttribute(shorePos, 3));
  shoreGeo.setAttribute('color', new THREE.BufferAttribute(shoreCol, 3));
  const shoreGlow = new THREE.Points(shoreGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  shoreGlow.visible = false;
  shoreGlow.frustumCulled = false;
  scene.add(shoreGlow);
  const shoreVeil = new THREE.Mesh(
    new THREE.RingGeometry(7.5, 20, 40),
    new THREE.MeshBasicMaterial({ color: '#10162e', transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
  );
  shoreVeil.rotation.x = -Math.PI / 2;
  shoreVeil.position.set(-50, world.water + 0.03, -46);
  shoreVeil.scale.set(1.15, 1, 0.72);
  shoreVeil.visible = false;
  scene.add(shoreVeil);
  const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#f4f0ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
  {
    const n = 180;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4;
      const e = 0.2 + (i % 9) * 0.08;
      const r = 28;
      p[i * 3] = Math.cos(a) * Math.cos(e) * r;
      p[i * 3 + 1] = Math.sin(e) * r * 0.7 + 8;
      p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    stars.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  stars.visible = false;
  stars.frustumCulled = false;
  scene.add(stars);
  const shot = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.03), new THREE.MeshBasicMaterial({ color: '#fff6e8', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  shot.visible = false;
  scene.add(shot);
  let shotT = -1;
  const SPECIES = [
    { id: 'trout', name: 'Creek Trout', rarity: 'Common', min: 18, max: 34, flavor: 'A silver flash under the pines.', w: 5 },
    { id: 'bass', name: 'Reed Bass', rarity: 'Common', min: 22, max: 41, flavor: 'It sulks in the reeds, then surges.', w: 5 },
    { id: 'perch', name: 'Sun Perch', rarity: 'Common', min: 12, max: 24, flavor: 'Striped gold, fond of the warm shallows.', w: 5 },
    { id: 'bluegill', name: 'Bluegill', rarity: 'Common', min: 10, max: 20, flavor: 'Small, round, and quick to a fly.', w: 4 },
    { id: 'shiner', name: 'Golden Shiner', rarity: 'Uncommon', min: 8, max: 16, flavor: 'A coin of a fish, bright as a lure.', w: 3 },
    { id: 'char', name: 'Pine Char', rarity: 'Uncommon', min: 20, max: 38, flavor: 'Cold-water spots, pale as birch bark.', w: 3 },
    { id: 'cat', name: 'Moss Catfish', rarity: 'Uncommon', min: 24, max: 48, flavor: 'Whiskers full of lake moss.', w: 2 },
    { id: 'lantern', name: 'Dusk Lantern', rarity: 'Rare', min: 16, max: 28, flavor: 'Its belly lamp lights the evening weeds.', dusk: true, w: 2 },
    { id: 'eel', name: 'Violet Eel', rarity: 'Rare', min: 30, max: 62, flavor: 'A purple ribbon that rises only after sunset.', dusk: true, w: 1 },
    { id: 'minnow', name: 'Star Minnow', rarity: 'Rare', min: 6, max: 12, flavor: 'Tiny lights, as if the sky fell into the shallows.', dusk: true, lure: 'glow', w: 1 },
  ];
  const BOOK_KEY = 'aro-long-lake';
  let lure = 'bobber';
  let fight = 0;
  let tension = 0.3;
  let biteIn = 0;
  let biteLeft = 0;
  let dip = 0;
  const readBook = () => { try { return JSON.parse(localStorage.getItem(BOOK_KEY) || '{}'); } catch { return {}; } };
  let trophyKey = '';
  function refreshTrophies() {
    const book = readBook();
    const caught = SPECIES.filter((s) => (book[s.id]?.n || 0) > 0);
    const key = caught.map((s) => s.id).join(',');
    if (key === trophyKey) return;
    trophyKey = key;
    for (const child of [...plaques.children]) plaques.remove(child);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.78, 0.04), lit('#3a2a22'));
    board.position.set(0.05, 0.98, 0);
    plaques.add(board);
    caught.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.025), mat('#e7c56a'));
      plate.position.set(-0.55 + col * 0.58, 1.12 - row * 0.26, 0.04);
      const tag = emote(s.name.split(' ')[0]);
      tag.visible = true;
      tag.position.set(-0.55 + col * 0.58, 1.12 - row * 0.26, 0.1);
      tag.scale.set(0.55, 0.22, 1);
      plaques.add(plate, tag);
    });
  }
  const writeBook = (data) => { try { localStorage.setItem(BOOK_KEY, JSON.stringify(data)); } catch { /* private mode */ } };
  function pickFish() {
    const rows = SPECIES.filter((s) => (!s.dusk || dusk) && (!s.lure || s.lure === lure));
    let bag = [];
    for (const s of rows) {
      let w = s.w;
      if (lure === 'fly' && s.max < 26) w += 3;
      if (lure === 'glow' && s.dusk && dusk) w += 4;
      try { if (s.dusk && (JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.sable?.fp || 0) >= 90) w += 3; } catch { /* ordinary odds */ }
      for (let i = 0; i < w; i++) bag.push(s);
    }
    if (!bag.length) bag = SPECIES.filter((s) => !s.dusk);
    return bag[Math.floor(Math.random() * bag.length)];
  }
  function showBook() {
    const box = document.getElementById('book');
    const list = document.getElementById('bookList');
    const data = readBook();
    const caught = Object.values(data).reduce((n, r) => n + (r.n || 0), 0);
    const count = document.getElementById('bookCount');
    if (count) count.textContent = `${caught} caught`;
    if (list) {
      list.innerHTML = SPECIES.map((s) => {
        const row = data[s.id];
        if (!row) return `<div class="rowfish lost"><b>▬▬▬▬</b><span>not yet</span></div>`;
        return `<div class="rowfish"><b>${s.name}</b><span>${s.rarity} · best ${row.best} cm · ${row.n}</span></div>`;
      }).join('');
    }
    if (box) box.hidden = false;
  }
  function celebrate(species) {
    const cm = Math.round(species.min + Math.random() * (species.max - species.min));
    const data = readBook();
    const prev = data[species.id];
    const record = !prev || cm > prev.best;
    data[species.id] = { n: (prev?.n || 0) + 1, best: Math.max(prev?.best || 0, cm) };
    writeBook(data);
    const title = document.getElementById('catchName');
    const size = document.getElementById('catchSize');
    const rare = document.getElementById('catchRare');
    const flavor = document.getElementById('catchFlavor');
    const badge = document.getElementById('catchRecord');
    if (title) title.textContent = species.name;
    if (size) size.textContent = `${cm} cm`;
    if (rare) rare.textContent = species.rarity;
    if (flavor) flavor.textContent = `${species.flavor} The board can count this catch.`;
    if (badge) badge.hidden = !record;
    if (catchEl) catchEl.hidden = false;
    onLand?.(species);
  }
  let onLand = null;

  const panel = document.getElementById('board');
  const menu = document.getElementById('menu');
  const back = document.getElementById('back');
  const reelBtn = document.getElementById('reel');
  const fishBtn = document.getElementById('fish');
  const duskBtn = document.getElementById('dusk');
  const catchEl = document.getElementById('catch');
  const FISH = ['Bluegill', 'Sunperch', 'Reed carp', 'Golden shiner', 'Creek trout'];
  let name = 'hub';
  let atLake = false;
  let fishZoom = 0;
  let dest = 'meadow';
  let armUntil = 0;
  let leftRing = false;
  let boardHeld = false;
  let phase = 'idle';
  let biteAt = 0;
  let biteUntil = 0;
  let reelT = 0;
  let power = 0.35;
  let cock = 0;
  let flicking = 0;
  const aimDir = new THREE.Vector3();
  const tipW = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const place = (x, z, yaw) => {
    walker.place(x, z, yaw);
    walker.feet.y = world.walk(x, z);
    walker.vel.set(0, 0, 0);
    armUntil = performance.now() + 2000;
    leftRing = false;
  };
  function markDest() {
    const lakeGo = dest === 'lake';
    hubRing.material.color.set(lakeGo ? 0x7ec8ff : 0xffe08a);
    paintLabel(destTag, lakeGo ? 'Long Lake' : 'Meadow');
  }
  function showBoard() { if (panel) panel.hidden = false; }
  function hideBoard() { if (panel) panel.hidden = true; }
  function resetFish() {
    phase = 'idle';
    reelProg = 0;
    bobber.visible = false;
    line.visible = false;
    target.visible = false;
    splash.visible = false;
    if (reelBtn) reelBtn.hidden = true;
  }
  function outdoors() {
    world.home = saved.home; world.edge = saved.edge; world.colliders = saved.colliders; world.walk = saved.walk;
    world.blockers = blockFeet;
    world.wade = null;
  }
  function enter(next) {
    if (next === 'lake') {
      atLake = true;
      name = 'meadow';
      outdoors();
      world.root.visible = true;
      hub.visible = false;
      meadowRing.visible = false;
      hold.visible = false;
      if (menu) menu.hidden = true;
      hideBoard();
      resetFish();
      const x = -50;
      const z = -33.2;
      meadowRing.position.set(x, world.ground(x, z) + 0.2, z - 1.6);
      place(x, z, Math.PI);
      if (back) { back.hidden = false; back.textContent = 'Field'; }
      return;
    }
    atLake = false;
    if (back) back.textContent = 'Back';
    const outside = next === 'meadow' || next === 'plot';
    name = outside ? 'meadow' : 'hub';
    world.root.visible = outside;
    hub.visible = !outside;
    meadowRing.visible = outside;
    hold.visible = false;
    if (back) back.hidden = outside;
    if (outside) hideBoard();
    if (menu) menu.hidden = true;
    resetFish();
    if (next === 'plot') {
      outdoors();
      const yaw = Math.atan2(-54 - PLOT[0], -18 - PLOT[1]);
      meadowRing.position.set(PLOT[0] - Math.sin(yaw) * 2.4, world.ground(PLOT[0], PLOT[1]) + 0.2, PLOT[1] - Math.cos(yaw) * 2.4);
      place(PLOT[0], PLOT[1], yaw);
    } else if (next === 'meadow') {
      outdoors();
      const yaw = world.start.yaw + Math.PI;
      meadowRing.position.set(world.start.x, world.ground(world.start.x, world.start.z) + 0.2, world.start.z - 1.6);
      place(meadowRing.position.x + Math.sin(yaw) * 3.4, meadowRing.position.z + Math.cos(yaw) * 3.4, yaw);
    } else {
      world.home = [0, 0]; world.edge = 5.1; world.colliders = [];
      world.blockers = null;
      world.walk = () => 0;
      place(0, -2.2, 0);
      walker.pitch = 0.12;
      boardHeld = true;
      hideBoard();
    }
  }
  panel?.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('pointerup', (e) => {
    dest = b.getAttribute('data-go');
    markDest();
    boardHeld = true;
    hideBoard();
    e.preventDefault();
    e.stopPropagation();
  }));
  document.getElementById('boardX')?.addEventListener('pointerup', (e) => { hideBoard(); boardHeld = true; e.preventDefault(); e.stopPropagation(); });
  menu?.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('pointerup', (e) => {
    enter(b.getAttribute('data-trip'));
    e.preventDefault();
    e.stopPropagation();
  }));
  document.getElementById('menuX')?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = true; e.preventDefault(); e.stopPropagation(); });
  document.getElementById('menubtn')?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = false; e.preventDefault(); e.stopPropagation(); });
  const atlas = document.getElementById('atlas');
  const mapCanvas = document.getElementById('lakemap');
  const mapCtx = mapCanvas?.getContext('2d');
  const MAP = { x0: -78, x1: -16, z0: -64, z1: 4 };
  const spots = [
    { name: 'Landing', x: -32, z: -8, tx: 12, ty: -28 },
    { name: 'Village', x: -54, z: -18, tx: 12, ty: -40 },
    { name: 'Logging camp', x: -66, z: -20, tx: 12, ty: 16 },
    { name: 'Campfire', x: -64.4, z: -19.7, tx: 12, ty: 40 },
    { name: PACKS[0].name, x: PACKS[0].x, z: PACKS[0].z, tx: -230, ty: 22 },
    { name: PACKS[1].name, x: PACKS[1].x, z: PACKS[1].z, tx: 12, ty: -18 },
    { name: PACKS[2].name, x: PACKS[2].x, z: PACKS[2].z, tx: 12, ty: -18 },
  ];
  let pin = null;
  let onHexTap = null;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.4, 70, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }));
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  beam.add(beamCore);
  beam.visible = false;
  world.root.add(beam);
  const toMap = (x, z) => ({
    sx: ((x - MAP.x0) / (MAP.x1 - MAP.x0)) * mapCanvas.width,
    sy: (1 - (z - MAP.z0) / (MAP.z1 - MAP.z0)) * mapCanvas.height,
  });
  const fromMap = (sx, sy) => ({
    x: MAP.x0 + (sx / mapCanvas.width) * (MAP.x1 - MAP.x0),
    z: MAP.z0 + (1 - sy / mapCanvas.height) * (MAP.z1 - MAP.z0),
  });
  function drawMap() {
    if (!mapCtx) return;
    const g = mapCtx, W = mapCanvas.width, H = mapCanvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#245234'; g.fillRect(0, 0, W, H);
    const lake = toMap(-50, -46);
    g.fillStyle = '#2f7ea8';
    g.beginPath(); g.ellipse(lake.sx, lake.sy, (14 / (MAP.x1 - MAP.x0)) * W, (9 / (MAP.z1 - MAP.z0)) * H, 0, 0, Math.PI * 2); g.fill();
    for (const [px, pz, r] of [[-30, -56, 4.2], [-68, -42, 3.5]]) {
      const p = toMap(px, pz);
      g.beginPath(); g.arc(p.sx, p.sy, (r / (MAP.x1 - MAP.x0)) * W, 0, Math.PI * 2); g.fill();
    }
    for (const s of spots) {
      const p = toMap(s.x, s.z);
      g.fillStyle = s.name.startsWith('Beasts') ? '#e23b32' : '#c4a574';
      g.beginPath(); g.arc(p.sx, p.sy, s.name.startsWith('Beasts') ? 10 : 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f6ead0';
      g.font = '18px Georgia';
      g.textAlign = 'left';
      g.fillText(s.name, p.sx + (s.tx ?? 14), p.sy + (s.ty ?? 6));
    }
    const you = toMap(walker.feet.x, walker.feet.z);
    g.fillStyle = '#fff6dc';
    g.beginPath(); g.arc(you.sx, you.sy, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff6dc'; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(you.sx, you.sy);
    g.lineTo(you.sx + Math.sin(walker.yaw) * 28, you.sy - Math.cos(walker.yaw) * 28);
    g.stroke();
    if (pin) {
      const q = toMap(pin.x, pin.z);
      g.strokeStyle = '#ffe7a8'; g.lineWidth = 3;
      g.beginPath(); g.arc(q.sx, q.sy, 14, 0, Math.PI * 2); g.stroke();
    }
  }
  function setPin(x, z) {
    if (pin && Math.hypot(pin.x - x, pin.z - z) < 3.5) pin = null;
    else pin = { x, z };
    beam.visible = !!pin;
    if (pin) beam.position.set(pin.x, world.ground(pin.x, pin.z) + 35, pin.z);
    drawMap();
  }
  document.getElementById('openMap')?.addEventListener('pointerup', (e) => {
    if (menu) menu.hidden = true;
    if (atlas) atlas.hidden = false;
    drawMap();
    e.preventDefault(); e.stopPropagation();
  });
  document.getElementById('mapX')?.addEventListener('pointerup', (e) => { if (atlas) atlas.hidden = true; e.preventDefault(); e.stopPropagation(); });
  mapCanvas?.addEventListener('pointerdown', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (mapCanvas.width / r.width);
    const sy = (e.clientY - r.top) * (mapCanvas.height / r.height);
    let hit = null;
    for (const s of spots) {
      const p = toMap(s.x, s.z);
      if (Math.hypot(p.sx - sx, p.sy - sy) < 36) hit = s;
    }
    if (walker.feet.z > 5 && onHexTap?.(sx, sy)) {
      if (atlas) atlas.hidden = true;
      e.preventDefault(); e.stopPropagation();
      return;
    }
    const at = hit || fromMap(sx, sy);
    setPin(at.x, at.z);
    e.preventDefault(); e.stopPropagation();
  });
  back?.addEventListener('pointerup', (e) => {
    if (atLake) enter('meadow');
    else if (menu) menu.hidden = false;
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('catchOk')?.addEventListener('pointerup', (e) => { if (catchEl) catchEl.hidden = true; resetFish(); e.preventDefault(); e.stopPropagation(); });
  document.querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  addEventListener('pointerup', (e) => {
    if (name !== 'hub' || (e.target.closest && e.target.closest('#cast, #spell, #stick, #board, #menu, #back, #menubtn, #reel, #catch, #fish, #dusk, #gear, #settings, #atlas'))) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(screen, false).length) showBoard();
  });

  function onWater(x, z) { return world.fishHere(x, z); }
  function byWater() {
    const x = walker.feet.x, z = walker.feet.z;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (onWater(x + Math.cos(a) * 4.2, z + Math.sin(a) * 4.2)) return true;
    }
    return false;
  }
  function waterSpot() {
    camera.getWorldDirection(aimDir);
    aimDir.y = 0;
    if (aimDir.lengthSq() < 1e-6) aimDir.set(0, 0, 1);
    aimDir.normalize();
    const dist = 4 + power * 11;
    let x = camera.position.x + aimDir.x * dist;
    let z = camera.position.z + aimDir.z * dist;
    if (!onWater(x, z)) {
      for (let t = 2.5; t < 22; t += 0.35) {
        const px = camera.position.x + aimDir.x * t;
        const pz = camera.position.z + aimDir.z * t;
        if (onWater(px, pz)) { x = px; z = pz; break; }
      }
    }
    return { x, z };
  }
  function looseLine() {
    const spot = waterSpot();
    phase = 'wait';
    target.visible = false;
    bobber.visible = true;
    bobber.position.set(spot.x, world.water + 0.16, spot.z);
    line.visible = true;
    flicking = 1;
    const quick = lure === 'fly' ? 0.7 : lure === 'glow' ? 0.4 : 0;
    let wait = 1.5 + Math.random() * 2.1 - quick;
    try { if ((JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.sable?.fp || 0) >= 90) wait *= 0.55; } catch { /* keep the ordinary wait */ }
    biteIn = wait;
    splashAt(spot.x, spot.z, dusk);
  }
  let fishDown = false;
  let reelHold = 0;
  let reelProg = 0;
  reelBtn?.addEventListener('pointerdown', (e) => {
    if (phase === 'bite') reelHold = 0.001;
    e.preventDefault();
    e.stopPropagation();
  });
  const endReel = (e) => {
    if (phase === 'bite' && reelHold > 0 && reelHold < 0.45) {
      reelProg += 0.34;
      reel.rotation.x += 1.5;
      if (reelProg >= 1) { phase = 'reel'; reelT = 0; reelProg = 0; if (reelBtn) reelBtn.hidden = true; }
    }
    reelHold = 0;
    e.preventDefault();
  };
  reelBtn?.addEventListener('pointerup', (e) => { endReel(e); e.stopPropagation(); });
  reelBtn?.addEventListener('pointercancel', endReel);
  fishBtn?.addEventListener('pointerdown', (e) => {
    fishDown = true;
    if (name === 'meadow' && (phase === 'idle' || phase === 'caught')) { phase = 'aim'; power = 0.25; target.visible = true; }
    e.preventDefault();
    e.stopPropagation();
  });
  const endFish = (e) => {
    if (fishDown && phase === 'aim') looseLine();
    fishDown = false;
    e.preventDefault();
    e.stopPropagation();
  };
  fishBtn?.addEventListener('pointerup', endFish);
  fishBtn?.addEventListener('pointercancel', endFish);
  let skyMesh = null;
  world.root.traverse((o) => { if (!skyMesh && o.material?.uniforms?.uZenith) skyMesh = o; });
  const dayZenith = skyMesh?.material.uniforms.uZenith.value.clone();
  const dayHorizon = skyMesh?.material.uniforms.uHorizon.value.clone();
  let dusk = false;
  let waterMat = null;
  let grassU = null;
  world.root.traverse((o) => {
    if (!waterMat && o.material?.uniforms?.uBio) waterMat = o.material;
    if (!grassU && o.material?.uniforms?.uG1) grassU = o.material.uniforms;
  });
  function setDusk(on) {
    dusk = on;
    if (duskBtn) duskBtn.textContent = on ? 'Day' : 'Dusk';
    const eve = document.getElementById('eve');
    if (eve) { eve.textContent = on ? 'Day' : 'Evening'; eve.classList.toggle('on', on); }
    if (skyMesh) {
      const u = skyMesh.material.uniforms;
      if (!skyMesh.userData.dayCloud && u.uCloud) {
        skyMesh.userData.dayCloud = u.uCloud.value.clone();
        skyMesh.userData.dayMid = u.uCloudMid.value.clone();
        skyMesh.userData.dayShade = u.uCloudShade.value.clone();
      }
      u.uZenith.value.set(on ? '#070d24' : dayZenith);
      u.uHorizon.value.set(on ? '#3a2458' : dayHorizon);
      if (u.uNight) u.uNight.value = on ? 1 : 0;
      if (u.uCloud && skyMesh.userData.dayCloud) {
        u.uCloud.value.copy(on ? new THREE.Color('#14183a') : skyMesh.userData.dayCloud);
        u.uCloudMid.value.copy(on ? new THREE.Color('#2a2048') : skyMesh.userData.dayMid);
        u.uCloudShade.value.copy(on ? new THREE.Color('#0c1028') : skyMesh.userData.dayShade);
      }
    }
    if (waterMat) waterMat.uniforms.uBio.value = on ? 1 : 0;
    bio.visible = on;
    stars.visible = on;
    shoreGlow.visible = on;
    shoreVeil.visible = on && atLake;
    if (on && atLake) { shotT = 0.05; shot.visible = true; }
    if (grassU) {
      const eve = on && atLake;
      ['uG1', 'uG2', 'uG3', 'uG4'].forEach((k) => {
        const slot = grassU[k];
        if (!slot) return;
        if (!slot.userData) slot.userData = {};
        if (!slot.userData.day) slot.userData.day = slot.value.clone();
        slot.value.copy(slot.userData.day);
        if (eve) slot.value.multiply(new THREE.Color('#243058'));
      });
    }
  }
  duskBtn?.addEventListener('pointerup', (e) => { setDusk(!dusk); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('eve')?.addEventListener('pointerup', (e) => { setDusk(!dusk); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('bookBtn')?.addEventListener('pointerup', (e) => { showBook(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('bookX')?.addEventListener('pointerup', (e) => { const box = document.getElementById('book'); if (box) box.hidden = true; e.preventDefault(); e.stopPropagation(); });
  document.querySelectorAll('#lures button').forEach((b) => b.addEventListener('pointerup', (e) => {
    lure = b.getAttribute('data-lure') || 'bobber';
    document.querySelectorAll('#lures button').forEach((t) => t.classList.toggle('on', t === b));
    e.preventDefault();
    e.stopPropagation();
  }));
  addEventListener('keydown', (e) => { if (e.code === 'KeyK' && name === 'meadow') setDusk(!dusk); });
  const life = new THREE.Group();
  const motes = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff6df' : '#f2d56a' }));
    life.add(s);
    motes.push(s);
  }
  const wings = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshBasicMaterial({ color: '#f7fbff', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    g.add(w);
    g.userData.home = new THREE.Vector3(-56 + i * 5, 0, -16);
    life.add(g);
    wings.push(g);
  }
  const birds = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.07), mat('#2a2622'));
    a.rotation.z = 0.45; a.position.x = 0.12;
    const b = a.clone(); b.rotation.z = -0.45; b.position.x = -0.12;
    g.add(a, b);
    life.add(g);
    birds.push(g);
  }
  world.root.add(life);
  const pool = [];
  const blasts = [];
  const blastGeo = new THREE.SphereGeometry(0.4, 10, 8);
  enter('hub');
  markDest();
  let hearts = 100;
  function dressHexBeast(b, hex, elite) {
    const LOOK = {
      'Forest Creek': { color: '#8dff9a', scale: 1.12, tag: 'Creek', bit: 'reed' },
      'Sunlit Meadow': { color: '#ffe27a', scale: 0.92, tag: 'Pollen', bit: 'bloom' },
      'Lakeshore': { color: '#7ee7ff', scale: 1.05, tag: 'Tide', bit: 'shell' },
      Hearth: { color: '#ffb15a', scale: 1.08, tag: 'Lantern', bit: 'lamp' },
    };
    const who = { boar: 'Boar', wolf: 'Wolf', slime: 'Slime', goblin: 'Goblin' };
    const look = LOOK[hex.theme] || LOOK['Forest Creek'];
    b.g.getObjectByName('hexkit')?.removeFromParent();
    const kit = new THREE.Group();
    kit.name = 'hexkit';
    if (look.bit === 'reed') {
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 5), new THREE.MeshBasicMaterial({ color: '#3e8a4a' }));
      reed.position.set(0.2, 1.15, 0);
      kit.add(reed);
    } else if (look.bit === 'bloom') {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: '#fff3a0' }));
      flower.position.set(0, 1.35, 0.1);
      kit.add(flower);
    } else if (look.bit === 'shell') {
      const shell = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12), new THREE.MeshBasicMaterial({ color: '#d8fff8' }));
      shell.rotation.x = Math.PI / 2;
      shell.position.y = 0.35;
      kit.add(shell);
    } else {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
      lamp.position.set(-0.15, 1.4, 0);
      kit.add(lamp);
    }
    const title = `${look.tag} ${who[b.kind] || 'Beast'}`;
    b.hexTitle = title;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 36px Georgia';
    ctx.fillStyle = '#fff6dc';
    ctx.textAlign = 'center';
    ctx.fillText(title, 128, 46);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    tag.position.y = 1.55;
    tag.scale.set(1.4, 0.36, 1);
    kit.add(tag);
    b.g.add(kit);
    b.g.scale.setScalar((look.scale || 1) * (elite ? 1.35 : 1));
    const tint = new THREE.Color(look.color);
    b.g.traverse((o) => {
      if (!o.isMesh || o.parent === kit || !o.material?.color) return;
      if (o.name === 'spot' || o.name === 'elite') return;
      for (const m of [].concat(o.material)) {
        if (!m.userData.base) m.userData.base = m.color.clone();
        m.color.copy(m.userData.base).lerp(tint, 0.62);
      }
    });
  }
  return {
    toast(text) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.hidden = false;
      el.textContent = text;
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.hidden = true; }, 3200);
    },
    set onHexTap(fn) { onHexTap = fn; },
    get name() { return name; },
    get atLake() { return atLake; },
    buddyAt() { return buddyBody.visible ? buddyBody.position : null; },
    get hearts() { return hearts; },
    nick(n) { hearts = Math.max(0, hearts - n); },
    heal(n) {
      let cap = 100;
      try { if ((JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.maren?.fp || 0) >= 90) cap = 120; } catch { /* cap stays 100 */ }
      hearts = n ? Math.min(cap, hearts + n) : cap;
    },
    setHearts(n) { hearts = n; },
    promote() { return beasts.promote(); },
    collect(x, z) { return beasts.collect(x, z); },
    get ring() { return meadowRing.position; },
    get rodOut() { return hold.visible; },
    get tipAt() { return tipW; },
    get nearBeast() { return beasts.near(walker.feet.x, walker.feet.z); },
    beasts() { return beasts.probe(); },
    live() { return beasts.live(); },
    anchor(n, x, y, z, face) { beasts.anchor(n, x, y, z, face); },
    releaseAnchor(n) { beasts.releaseAnchor(n); },
    get mobsReady() { return beasts.mobsReady; },
    get dusk() { return dusk; },
    get fishZoom() { return fishZoom; },
    setDusk,
    showBook,
    stickRod() {
      if (!hold.visible) return;
      hold.position.copy(camera.position);
      hold.quaternion.copy(camera.quaternion);
    },
    celebrate,
    set onLand(fn) { onLand = fn; },
    cueBeast(x, z, name) { beasts.act(x, z, name); },
    face(kind) { return beasts.face(kind); },
    clip(kind) { return beasts.clip(kind); },
    holdBeasts(px, pz, min, max, dt) { beasts.hold(px, pz, min, max, dt); },
    grabBeast(x, z) { return beasts.grab(x, z); },
    shoveBeast(x, z, dx, dz, dist) { return beasts.shove(x, z, dx, dz, dist); },
    get blocksMagic() { return name !== 'meadow'; },
    showBoard, enter,
    useHearth,
    get buddy() { return buddy; },
    get hearthReady() { return hearthReady; },
    beginWave(hex, table, count, eliteChance) {
      const live = beasts.live().filter((b) => !b.dead && b.where === 'meadow');
      const used = new Set();
      const ids = [];
      const n = Math.max(1, Math.min(4, count));
      for (let i = 0; i < n; i++) {
        const kind = table[i % table.length];
        const b = live.find((x) => x.kind === kind && !used.has(x.n)) || live.find((x) => !used.has(x.n));
        if (!b) break;
        used.add(b.n);
        const ang = (i / n) * Math.PI * 2;
        const x = hex.x + Math.cos(ang) * 2.4;
        const z = hex.z + Math.sin(ang) * 2.4;
        beasts.anchor(b.n, x, world.ground(x, z), z, Math.atan2(-Math.cos(ang), -Math.sin(ang)));
        const elite = Math.random() < eliteChance;
        dressHexBeast(b, hex, elite);
        if (elite && !b.g.getObjectByName('elite')) {
          const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
          mark.name = 'elite';
          mark.position.y = 1.9;
          b.g.add(mark);
        }
        ids.push(b.n);
      }
      return { ids, done: false, noted: new Set(), drops: [] };
    },
    waveAlive(wave) {
      const dropName = { boar: 'tusk', wolf: 'ruff', slime: 'gel', goblin: 'bead' };
      let left = 0;
      const live = beasts.live();
      for (const id of wave.ids) {
        const b = live.find((x) => x.n === id);
        if (!b || b.dead) {
          if (b && !wave.noted.has(id)) {
            wave.noted.add(id);
            try {
              const bag = JSON.parse(localStorage.getItem('aro-beast-drops') || '{}');
              const key = dropName[b.kind] || 'bead';
              bag[key] = (bag[key] || 0) + 1;
              localStorage.setItem('aro-beast-drops', JSON.stringify(bag));
              wave.drops?.push(b.hexTitle || key);
            } catch { /* private mode */ }
          }
        } else left += 1;
      }
      return left;
    },
    seatHexes(list) {
      const live = beasts.live().filter((b) => !b.dead && b.where === 'meadow');
      const take = (kind) => {
        const i = live.findIndex((b) => b.kind === kind && !b._sat);
        if (i < 0) return null;
        live[i]._sat = true;
        return live[i];
      };
      const put = (b, hex, side) => {
        if (!b || !hex) return;
        const x = hex.x + side;
        const z = hex.z + 1.2;
        beasts.anchor(b.n, x, world.ground(x, z), z, 0);
      };
      const byId = (id) => list.find((h) => h.id === id);
      put(take('boar'), byId('moss'), -1.2);
      put(take('wolf'), byId('moss'), 1.4);
      put(take('wolf'), byId('glen'), 0.4);
      put(take('slime'), byId('meadow'), 0);
      put(take('slime'), byId('bloom'), -0.6);
    },
    hurt(marks) {
      beasts.hurt(marks, name, (hit) => {
        const boom = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: hit.through ? 0xfff6dc : (hit.k === 'arcane' ? 0xd7a6ff : 0xff7a1c), transparent: true, opacity: 0.85, depthWrite: false }));
        boom.position.set(hit.x, hit.y, hit.z);
        boom.userData.life = hit.through ? 0.22 : 0.42;
        boom.userData.max = boom.userData.life;
        boom.userData.big = hit.through ? 0.9 : 2.4;
        scene.add(boom);
        blasts.push(boom);
        const color = hit.k === 'arcane' ? '#d7a6ff' : '#ffb043';
        const key = `${hit.n}-${hit.k}`;
        let sprite = pool.find((s) => s.userData.life <= 0);
        if (!sprite) {
          if (pool.length > 16) return;
          sprite = numeral(String(hit.n), color);
          sprite.userData.key = key;
          scene.add(sprite);
          pool.push(sprite);
        } else if (sprite.userData.key !== key) {
          sprite.material.map.dispose();
          sprite.material.map = numeral(String(hit.n), color).material.map;
          sprite.userData.key = key;
        }
        sprite.userData.life = 0.9;
        sprite.position.set(hit.x, hit.y, hit.z);
        sprite.visible = true;
        sprite.material.opacity = 1;
        const mark = document.getElementById('xmark');
        if (mark) { mark.classList.add('on'); clearTimeout(mark._t); mark._t = setTimeout(() => mark.classList.remove('on'), 400); }
      });
    },
    launchNearest(damage = 12, lockN = null) {
      const here = walker.feet;
      const list = beasts.probe().filter((b) => !b.dead);
      let best = lockN != null ? list.find((b) => b.n === lockN) : null;
      if (!best) {
        const fx = Math.sin(walker.yaw), fz = Math.cos(walker.yaw);
        let bestD = 1e9;
        for (const b of list) {
          const dx = b.x - here.x, dz = b.z - here.z;
          const d = Math.hypot(dx, dz);
          const ahead = d > 0.2 && (dx / d) * fx + (dz / d) * fz > 0.25;
          const score = ahead ? d : d + 30;
          if (score < bestD) { best = b; bestD = score; }
        }
      }
      if (!best) return false;
      const dx = best.x - here.x, dz = best.z - here.z, len = Math.hypot(dx, dz) || 1;
      this.hurt([{ x: best.x, z: best.z, r: 1.6, d: damage, k: 'arcane', kx: (dx / len) * 2.6, kz: (dz / len) * 2.6 }]);
      return true;
    },
    castHeld() {},
    update(dt) {
      try {
        if ((JSON.parse(localStorage.getItem('aro-hub') || '{}').people?.maren?.fp || 0) >= 90 && hearts < 120) hearts = Math.min(120, hearts + dt * 4);
      } catch { /* ordinary health */ }
      for (const s of beasts.slams()) {
        if (Math.hypot(walker.feet.x - s.x, walker.feet.z - s.z) < s.r) this.nick(24);
      }
      for (const s of pool) {
        if (s.userData.life <= 0) continue;
        s.userData.life -= dt;
        const u = 1 - s.userData.life / 0.9;
        const pop = u < 0.16 ? 0.45 + (u / 0.16) * 0.95 : 1.4 - (u - 0.16) * 0.28;
        s.scale.set(1.8 * pop, 0.9 * pop, 1);
        s.position.y += dt * 1.4;
        s.material.opacity = s.userData.life > 0.28 ? 1 : Math.max(0, s.userData.life / 0.28);
        if (s.userData.life <= 0) s.visible = false;
      }
      for (let i = blasts.length - 1; i >= 0; i--) {
        const m = blasts[i];
        m.userData.life -= dt;
        const u = 1 - m.userData.life / m.userData.max;
        m.scale.setScalar(0.15 + u * m.userData.big);
        m.material.opacity = Math.max(0, m.userData.life / m.userData.max);
        if (m.userData.life <= 0) { scene.remove(m); blasts.splice(i, 1); }
      }
      village.tick?.(dt);
      const fell = world.stepFells?.(dt) || [];
      const bumps = village.takeBumps?.() || [];
      if (fell.length || bumps.length) {
        const marks = [];
        for (const h of fell) marks.push({ x: h.x, z: h.z, r: h.r, d: TUNE.debrisHit, k: 'arcane', exact: true });
        for (const h of bumps) {
          marks.push({ x: h.x, z: h.z, r: 1.2, d: TUNE.debrisHit, k: 'arcane', exact: true });
          if (h.dx || h.dz) beasts.shove(h.x, h.z, h.dx, h.dz, TUNE.rockFling);
        }
        this.hurt(marks);
      }
      beasts.update(dt, name);
      if (pin) {
        beam.visible = name === 'meadow';
        beam.position.y = world.ground(pin.x, pin.z) + 35 + Math.sin(performance.now() * 0.004) * 0.4;
        beam.material.opacity = 0.4 + Math.sin(performance.now() * 0.006) * 0.12;
      }
      if (atlas && !atlas.hidden) drawMap();
      const gate = name === 'hub' ? hubRing.position : meadowRing.position;
      const d = Math.hypot(walker.feet.x - gate.x, walker.feet.z - gate.z);
      if (d > 2.15) leftRing = true;
      if (leftRing && performance.now() >= armUntil && d < 0.95) enter(name === 'hub' ? dest : 'hub');
      you.visible = name === 'hub' || buddyBody.visible;
      if (you.visible) {
        you.position.set(walker.feet.x, 0, walker.feet.z);
        you.rotation.y = walker.yaw;
      }
      buddyBody.visible = !!(buddy && name === 'meadow' && !atLake);
      if (buddyBody.visible) {
        const pal = pals.find((p) => p.id === buddy);
        const fx = Math.sin(walker.yaw);
        const fz = Math.cos(walker.yaw);
        const backX = walker.feet.x + fx * 1.6 + fz * 1.35;
        const backZ = walker.feet.z + fz * 1.6 - fx * 1.35;
        buddyTag.visible = true;
        buddyRing.visible = true;
        buddyBody.position.x += (backX - buddyBody.position.x) * Math.min(1, dt * 3);
        buddyBody.position.z += (backZ - buddyBody.position.z) * Math.min(1, dt * 3);
        buddyBody.position.y = world.ground(buddyBody.position.x, buddyBody.position.z);
        buddyBody.lookAt(walker.feet.x, buddyBody.position.y, walker.feet.z);
        buddyT -= dt;
        if (buddyT <= 0 && buddySay) {
          buddyT = 7;
          buddySay.hidden = false;
          buddySay.textContent = pal ? `${pal.name}: ${pal.line}` : '';
          clearTimeout(buddySay._t);
          buddySay._t = setTimeout(() => { buddySay.hidden = true; }, 2400);
        }
        if (buddy === 'maren') {
          const cap = 100;
          if (hearts < cap) hearts = Math.min(cap, hearts + dt * 2);
        }
      } else {
        if (buddySay && name !== 'hub') buddySay.hidden = true;
        buddyTag.visible = false;
        buddyRing.visible = false;
      }
      for (const mixer of hearthMixers) mixer.update(dt);
      if (name === 'hub') {
        const flick = performance.now() * 0.001;
        flames.forEach((f, i) => {
          f.scale.y = 0.78 + Math.sin(flick * (9 + i * 4)) * 0.22 + Math.sin(flick * 21) * 0.06;
          f.scale.x = f.scale.z = 0.9 + Math.sin(flick * (7 + i)) * 0.16;
        });
        embers.forEach((e) => {
          const u = (flick * 0.42 + e.userData.p) % 1;
          e.position.set(e.userData.x + Math.sin(flick * 3 + e.userData.p * 6) * 0.04, 0.4 + u * 1.15, 0.16);
          e.material.opacity = (1 - u) * 0.9;
        });
        glow.material.opacity = 0.22 + Math.sin(flick * 9) * 0.1;
        fireLight.intensity = 7 + Math.sin(flick * 11) * 1.6 + Math.sin(flick * 23) * 0.8;
        refreshTrophies();
      }
      if (name === 'hub') {
        const time = performance.now() * 0.001;
        nearSpot = null;
        let best = 1.5;
        for (const s of hearthSpots) {
          const d = Math.hypot(walker.feet.x - s.x, walker.feet.z - s.z);
          if (d < best) { best = d; nearSpot = s; }
        }
        let nearPal = null;
        for (const p of pals) {
          const home = p.home;
          const bob = Math.sin(time * 1.6 + home[0]) * 0.03;
          const d = Math.hypot(walker.feet.x - p.g.position.x, walker.feet.z - p.g.position.z);
          if (d < 2.2) {
            p.g.lookAt(walker.feet.x, 0, walker.feet.z);
            p.mark.visible = true;
            nearPal = p;
          } else {
            p.g.position.x += (home[0] - p.g.position.x) * 0.05;
            p.g.position.z += (home[2] - p.g.position.z) * 0.05;
            p.g.rotation.y += (p.yaw - p.g.rotation.y) * 0.05;
            p.mark.visible = false;
          }
          p.g.position.y = bob;
        }
        if (useBtn) {
          const label = nearSpot ? nearSpot.name : nearPal ? `Invite ${nearPal.name}` : '';
          useBtn.hidden = !label;
          useBtn.textContent = label;
          useBtn.dataset.who = nearPal && !nearSpot ? nearPal.id : '';
        }
        const bd = Math.hypot(walker.feet.x - screen.position.x, walker.feet.z - screen.position.z);
        if (bd > 2.1) boardHeld = false;
        if (!boardHeld && bd < 1.7 && panel?.hidden) showBoard();
      } else if (useBtn) useBtn.hidden = true;
      const fishing = name === 'meadow' && (byWater() || phase !== 'idle');
      const showFish = name === 'meadow' && (byWater() || phase === 'aim') && phase !== 'bite' && phase !== 'reel';
      if (fishBtn) { fishBtn.hidden = !showFish; fishBtn.textContent = 'Cast'; }
      const cue = document.getElementById('fishcue');
      if (cue) { cue.hidden = !showFish; cue.textContent = phase === 'aim' ? 'Release to cast' : 'Hold to cast'; }
      const bar = document.getElementById('castbar');
      if (bar) { bar.hidden = phase !== 'aim'; const fill = bar.querySelector('i'); if (fill) fill.style.width = `${Math.round(power * 100)}%`; }
      const ten = document.getElementById('tension');
      const luresEl = document.getElementById('lures');
      const bookBtn = document.getElementById('bookBtn');
      const eveBtn = document.getElementById('eve');
      if (luresEl) luresEl.hidden = !atLake;
      if (bookBtn) bookBtn.hidden = !atLake;
      if (eveBtn) eveBtn.hidden = !atLake;
      pads.forEach((p) => { p.visible = atLake; });
      if (atLake) {
        const tt = performance.now() * 0.001;
        fishShade.forEach((s, i) => {
          const a = tt * 0.35 + i * 1.3;
          s.visible = true;
          s.position.set(-50 + Math.cos(a) * (4 + i), world.water - 0.2, -40 + Math.sin(a * 0.8) * 3);
        });
        fly.visible = true;
        fly.position.set(-48 + Math.sin(tt * 0.6) * 6, world.water + 0.55 + Math.sin(tt * 3) * 0.08, -36 + Math.cos(tt * 0.5) * 2);
        wing.rotation.y = Math.sin(tt * 18) * 0.8;
        wisps.forEach((w, i) => {
          w.visible = true;
          w.position.set(-52 + i * 1.4 + Math.sin(tt + i) * 0.4, world.water + 0.8, -35.5);
          w.lookAt(camera.position);
        });
        if (dusk && shotT < 0 && Math.random() < dt * 0.08) { shotT = 0; shot.visible = true; }
        if (shotT >= 0) {
          shotT += dt;
          const u = shotT / 1.1;
          shot.position.set(-62 + u * 28, 14 - u * 6, -50);
          shot.lookAt(camera.position);
          shot.material.opacity = u < 0.8 ? 0.8 : (1 - u) * 4;
          if (shotT > 1.1) { shotT = -1; shot.visible = false; }
        }
        stars.position.copy(camera.position);
        bio.material.uniforms.uNow.value = tt;
      } else {
        fishShade.forEach((s) => { s.visible = false; });
        fly.visible = false;
        wisps.forEach((w) => { w.visible = false; });
      }
      const wantZ = phase === 'aim' ? 0.28 : (phase === 'bite' || phase === 'reel') ? 0.36 : (fishing ? 0.08 : 0);
      fishZoom += (wantZ - fishZoom) * Math.min(1, dt * 2.4);
      if (name === 'meadow' && fishing) {
        if (fishDown && phase === 'aim') power = Math.min(1, power + dt * 0.55);
        if (phase === 'aim') { const spot = waterSpot(); target.position.set(spot.x, world.water + 0.05, spot.z); }
        if (phase === 'wait') {
          biteIn -= dt;
          if (biteIn < 0.8) bobber.position.y = world.water + Math.sin(performance.now() * 0.012) * 0.04;
          if (biteIn < 0.45 && Math.random() < dt * 3) splashAt(bobber.position.x, bobber.position.z, dusk);
          if (biteIn <= 0) {
            phase = 'bite';
            biteLeft = 5.2;
            fight = 0.08;
            dip = 1;
            splashAt(bobber.position.x, bobber.position.z, dusk);
            if (reelBtn) { reelBtn.hidden = false; reelBtn.textContent = 'Hook'; }
          }
        }
        if (phase === 'bite') {
          biteLeft -= dt;
          tension = 0.28 + 0.62 * (0.5 + 0.5 * Math.sin(performance.now() * 0.004 + biteLeft));
          const hot = tension > 0.72;
          if (ten) {
            ten.hidden = false;
            const fill = ten.querySelector('i');
            if (fill) { fill.style.width = `${Math.round(tension * 100)}%`; fill.classList.toggle('hot', hot); }
          }
          if (reelHold > 0) {
            reelHold += dt;
            reel.rotation.x += dt * 8;
            if (hot) fight = Math.max(0, fight - dt * 0.42);
            else fight = Math.min(1, fight + dt * 0.5);
            if (reelBtn) reelBtn.textContent = hot ? 'Ease' : (fight < 0.25 ? 'Hook' : 'Reel');
          }
          bobber.position.y = world.water + (hot ? -0.12 : Math.sin(performance.now() * 0.02) * 0.06);
          splash.visible = hot;
          splash.position.copy(bobber.position);
          if (fight >= 1) { phase = 'reel'; reelT = 0; reelHold = 0; if (reelBtn) reelBtn.hidden = true; if (ten) ten.hidden = true; }
          if (biteLeft <= 0 && fight < 1) { if (ten) ten.hidden = true; resetFish(); }
        } else if (ten) ten.hidden = true;
        if (phase === 'reel') {
          reelT += dt;
          bobber.position.lerp(walker.feet, Math.min(1, dt * 2.2));
          bobber.position.y = walker.feet.y + 1.1;
          if (reelT > 0.65) {
            celebrate(pickFish());
            phase = 'caught';
            line.visible = false;
            bobber.visible = false;
            splash.visible = false;
          }
        }
        hold.visible = true;
        hold.position.copy(camera.position);
        hold.quaternion.copy(camera.quaternion);
        hold.translateY(-0.12);
        if (phase === 'aim') cock = Math.min(1, cock + dt * 2.6);
        else if (flicking <= 0) cock = Math.max(0, cock - dt * 3);
        let pose = cock;
        if (flicking > 0) {
          flicking -= dt * 3.2;
          pose = flicking > 0.5 ? (flicking - 0.5) / 0.5 : (flicking / 0.5) * -0.45;
          if (flicking <= 0) { flicking = 0; cock = 0; }
        }
        if (dip > 0) dip = Math.max(0, dip - dt * 1.6);
        const bend = (phase === 'bite' ? 0.25 + tension * 0.7 : 0) + dip * 0.45;
        const framed = phase === 'bite' || phase === 'reel';
        if (framed) {
          rod.scale.setScalar(0.58);
          rod.position.set(0.3, -0.18, -0.55);
          rod.rotation.set(-0.78, -0.28, 0.1);
        } else {
          rod.scale.setScalar(1);
          rod.position.set(0.28, -0.22, -0.48);
          rod.rotation.set(0.55 + pose * 0.2, -0.4, -0.22 - Math.max(0, pose) * 0.1);
        }
        blank.rotation.z = framed ? -bend * 0.1 : -bend * 0.8;
        tipM.rotation.z = framed ? -bend * 0.16 : -bend * 1.3;
        if (line.visible) {
          const hot = phase === 'bite' && tension > 0.72;
          line.material.color.set(hot ? '#ff5a4a' : phase === 'bite' ? '#9af6ff' : '#d8fbff');
          tipM.getWorldPosition(tipW);
          const pos = lineGeo.attributes.position;
          const end = bobber.position;
          const slack = phase === 'bite' ? (hot ? 0.04 : 0.1) : 0.28;
          for (let i = 0; i < 8; i++) {
            const t = i / 7;
            const sag = Math.sin(t * Math.PI) * slack;
            pos.setXYZ(i, tipW.x + (end.x - tipW.x) * t, tipW.y + (end.y - tipW.y) * t - sag, tipW.z + (end.z - tipW.z) * t);
          }
          pos.needsUpdate = true;
        }
        if (bobber.visible && phase !== 'bite') {
          const u = (performance.now() * 0.0007) % 1;
          rip.scale.setScalar(0.8 + u * 1.3);
          rip.material.opacity = (1 - u) * 0.7;
        }
        for (const m of ripples) {
          if (m.userData.life <= 0) continue;
          m.userData.life -= dt * 0.7;
          const u = 1 - m.userData.life;
          m.scale.setScalar(0.6 + u * 4.2);
          m.material.opacity = Math.max(0, m.userData.life) * 0.75;
          m.position.y = world.water + 0.04;
          if (m.userData.life <= 0) m.visible = false;
        }
        const t = performance.now() * 0.001;
        motes.forEach((s, i) => s.position.set(-46 + Math.sin(t * 0.25 + i) * 16, 2 + (i % 4) * 0.45, -22 + Math.cos(t * 0.18 + i * 0.7) * 10));
        wings.forEach((g, i) => {
          const hx = g.userData.home.x, hz = g.userData.home.z;
          g.position.set(hx + Math.sin(t * 0.8 + i) * 1.5, world.ground(hx, hz) + 1.2 + Math.sin(t * 2 + i) * 0.3, hz + Math.cos(t * 0.7 + i) * 1.2);
          g.children[0].rotation.y = Math.sin(t * 14 + i) * 0.9;
        });
        birds.forEach((g, i) => {
          const a = t * 0.22 + i * 2.1;
          g.position.set(-50 + Math.cos(a) * 18, 12 + i * 1.4, -24 + Math.sin(a) * 12);
          g.rotation.y = -a;
        });
      } else hold.visible = false;
      if (name === 'meadow' && !fishing) {
        const t = performance.now() * 0.001;
        motes.forEach((s, i) => s.position.set(walker.feet.x + Math.sin(t * 0.3 + i) * 8, walker.feet.y + 1.5 + (i % 3) * 0.4, walker.feet.z + Math.cos(t * 0.2 + i) * 8));
      }
      hub.children[0].position.copy(camera.position);
    },
  };
}
