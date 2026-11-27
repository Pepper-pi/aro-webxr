// Outdoor GPS grind. locar (MIT) anchors the nodes. @turf/distance (MIT) is the meter readout.
// Real GPS and device tilt start only from the Enable Outdoor GPS tap, so a phone
// does not ask on load. Simulate Walk uses locar.fakeGps along the Seaside prom.
import * as THREE from 'three';
import { DeviceOrientationControls, LocAR } from 'locar';
import { distance } from '@turf/distance';

const KEY = 'aro-wild';
const WINDOW = 72 * 60 * 60 * 1000;
const COIN_RANGE = 35;
const TAG_RANGE = 40;
const PROM = { lon: -123.9298, lat: 45.9934 };
const BEARING = 8 * Math.PI / 180;

const NODES = [
  { id: 'coin-dune', kind: 'coin', name: 'Dune cache', north: 38, east: 11, coins: 24, timber: 2, shards: 1 },
  { id: 'supply-drift', kind: 'supply', name: 'Drift timber', north: 44, east: -9, coins: 6, timber: 8, shards: 4 },
  { id: 'hex-lush', kind: 'hex', tier: 1, name: 'Lush Patch', north: 22, east: 0, hex: 'meadow' },
  { id: 'hex-relic', kind: 'hex', tier: 2, name: 'Relic Shrine', north: 50, east: 7, hex: 'moss' },
  { id: 'hex-myth', kind: 'hex', tier: 3, name: 'Mythic Oasis', north: 66, east: -5, hex: 'shore' },
];

const FARM = {
  1: { coins: 28, timber: 4, shards: 1, xp: 12 },
  2: { coins: 64, timber: 10, shards: 4, xp: 24 },
  3: { coins: 140, timber: 22, shards: 10, xp: 40 },
};

function blankWallet() {
  return { coins: 0, timber: 0, shards: 0, tagged: [] };
}
function loadWallet() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '');
    if (!data || typeof data !== 'object') return blankWallet();
    data.coins = Number(data.coins) || 0;
    data.timber = Number(data.timber) || 0;
    data.shards = Number(data.shards) || 0;
    data.tagged = Array.isArray(data.tagged) ? data.tagged : [];
    return data;
  } catch {
    return blankWallet();
  }
}
function saveWallet(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

function shift(north, east) {
  const lat = PROM.lat + north / 111320;
  const lon = PROM.lon + east / (111320 * Math.cos(PROM.lat * Math.PI / 180));
  return { lon, lat };
}
function along(dist, side = 0) {
  const north = dist * Math.cos(BEARING) - side * Math.sin(BEARING);
  const east = dist * Math.sin(BEARING) + side * Math.cos(BEARING);
  return shift(north, east);
}

function labelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(9.5, 2.35, 1);
  sprite.position.y = 3.2;
  sprite.userData.canvas = canvas;
  sprite.userData.tex = tex;
  sprite.userData.last = '';
  paintLabel(sprite, text);
  return sprite;
}
function paintLabel(sprite, text) {
  if (sprite.userData.last === text) return;
  sprite.userData.last = text;
  const canvas = sprite.userData.canvas;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = 'rgba(20, 16, 28, 0.78)';
  g.fillRect(16, 24, 480, 80);
  g.fillStyle = '#fff6dc';
  g.font = 'bold 36px Georgia, serif';
  g.textAlign = 'center';
  g.fillText(text, 256, 76);
  sprite.userData.tex.needsUpdate = true;
}

function beacon(tier) {
  const g = new THREE.Group();
  const scale = tier === 3 ? 2.05 : tier === 2 ? 1.45 : 1;
  const height = tier === 3 ? 6.4 : tier === 2 ? 4.1 : 2.4;
  const color = tier === 3 ? '#f0d060' : tier === 2 ? '#d7a15a' : '#7dcc6a';
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.16 * scale, height, 8),
    new THREE.MeshBasicMaterial({ color: '#f4efe4' }),
  );
  stem.position.y = height * 0.5;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42 * scale, 16, 12),
    new THREE.MeshBasicMaterial({ color }),
  );
  bulb.position.y = height + 0.2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72 * scale, 0.045 * scale, 8, 20),
    new THREE.MeshBasicMaterial({ color: tier === 3 ? '#9ee7ff' : '#fff6dc' }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  g.add(stem, bulb, ring);
  return g;
}
function cacheMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'coin') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), new THREE.MeshBasicMaterial({ color: '#e7c56a' }));
    disc.position.y = 0.7;
    const pile = disc.clone();
    pile.position.y = 0.86;
    pile.scale.setScalar(0.72);
    g.add(disc, pile);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), new THREE.MeshBasicMaterial({ color: '#8a5a32' }));
    box.position.y = 0.4;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.74), new THREE.MeshBasicMaterial({ color: '#c4a574' }));
    band.position.y = 0.55;
    g.add(box, band);
  }
  return g;
}

export function createOutdoor(scene, renderer, zones, hexes) {
  const outdoorScene = new THREE.Scene();
  outdoorScene.background = new THREE.Color('#9ec8ea');
  outdoorScene.fog = new THREE.Fog('#c5dff3', 40, 180);
  const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  cam.rotation.x = -0.2;
  outdoorScene.add(cam);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(80, 40),
    new THREE.MeshBasicMaterial({ color: '#e4d2a4' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.35;
  cam.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 80),
    new THREE.MeshBasicMaterial({ color: '#7eb6d8' }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-30, -1.2, 20);
  outdoorScene.add(sea);

  const locar = new LocAR(outdoorScene, cam, { gpsMinDistance: 0, gpsMinAccuracy: 30 });
  locar.on('gpserror', () => {
    const read = document.getElementById('wildRead');
    if (read) read.textContent = 'GPS needs another tap outdoors';
  });

  let wallet = loadWallet();
  if (!wallet.stipend) {
    if (wallet.coins < 15) {
      wallet.coins += 24;
      wallet.timber += 8;
    }
    wallet.stipend = true;
    saveWallet(wallet);
  }
  let open = false;
  let walking = false;
  let gpsLive = false;
  let walked = 0;
  let side = 0;
  let here = { ...PROM };
  let orientation = null;
  let spawned = false;
  const nodes = [];
  let tagTarget = null;

  const bar = document.getElementById('wildBar');
  const gpsBtn = document.getElementById('wildGps');
  const walkBtn = document.getElementById('wildWalk');
  const backBtn = document.getElementById('wildBack');
  const tagBtn = document.getElementById('wildTag');
  const walletEl = document.getElementById('wildWallet');
  const readEl = document.getElementById('wildRead');
  const board = document.getElementById('wildBoard');
  const queue = document.getElementById('wildQueue');

  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function persist() {
    const now = Date.now();
    wallet.tagged = wallet.tagged.filter((tag) => tag.until > now);
    saveWallet(wallet);
    paintWallet();
    paintBoard();
  }
  function paintWallet() {
    if (!walletEl) return;
    walletEl.textContent = `${wallet.coins} coins · ${wallet.timber} timber · ${wallet.shards} shards`;
  }
function hoursLeft(until) {
  const h = Math.max(1, Math.ceil((until - Date.now()) / 3600000));
  return `${h}h`;
}
  function paintBoard() {
    if (!queue) return;
    const now = Date.now();
    const live = wallet.tagged.filter((tag) => tag.until > now);
    if (!live.length) {
      queue.innerHTML = '<p>No tagged hexes yet. Walk one in, then bring it home.</p>';
      return;
    }
    queue.innerHTML = live.map((tag) => {
      const roman = tag.tier === 3 ? 'III' : tag.tier === 2 ? 'II' : 'I';
      return `<button type="button" data-farm="${tag.id}">${tag.name} · Tier ${roman} · ${hoursLeft(tag.until)} left<br>Enter &amp; Farm from Home</button>`;
    }).join('');
  }
  function paintChrome() {
    const hub = zones.name === 'hub';
    const meadow = zones.name === 'meadow' && !zones.atLake;
    if (bar) bar.hidden = !(open || meadow);
    if (backBtn) backBtn.hidden = !open;
    if (walkBtn) {
      walkBtn.classList.toggle('on', walking);
      walkBtn.textContent = walking ? 'Walking the Prom' : 'Simulate Walk';
    }
    if (gpsBtn) gpsBtn.classList.toggle('on', gpsLive);
    if (readEl) readEl.hidden = !open;
    if (walletEl) walletEl.hidden = !(hub || open);
    if (board) board.hidden = !hub;
    if (tagBtn) tagBtn.hidden = !(open && tagTarget);
    const quest = document.getElementById('quest');
    const way = document.getElementById('wayfinder');
    if (quest) quest.style.visibility = open ? 'hidden' : '';
    if (way && open) way.hidden = true;
    paintWallet();
  }

  function spawn() {
    if (spawned) return;
    locar.fakeGps(PROM.lon, PROM.lat, 4, 8);
    for (const spec of NODES) {
      const at = along(spec.north, spec.east);
      const root = new THREE.Group();
      root.name = spec.id;
      root.add(spec.kind === 'hex' ? beacon(spec.tier) : cacheMesh(spec.kind));
      const sprite = labelSprite(spec.name);
      if (spec.kind === 'hex') sprite.position.y = (spec.tier === 3 ? 8.2 : spec.tier === 2 ? 5.6 : 3.6);
      root.add(sprite);
      locar.add(root, at.lon, at.lat, 0);
      nodes.push({ ...spec, ...at, root, sprite, taken: false });
    }
    spawned = true;
    here = { ...PROM };
  }

  function metersTo(node) {
    return distance([here.lon, here.lat], [node.lon, node.lat], { units: 'meters' });
  }

  function collect(node) {
    node.taken = true;
    node.root.visible = false;
    wallet.coins += node.coins || 0;
    wallet.timber += node.timber || 0;
    wallet.shards += node.shards || 0;
    persist();
    toast(`${node.name} · +${node.coins || 0} coins`);
  }

  function tag(node) {
    if (!node || node.kind !== 'hex') return false;
    const now = Date.now();
    if (wallet.tagged.some((item) => item.id === node.id && item.until > now)) {
      toast(`${node.name} is already queued at home`);
      return true;
    }
    wallet.tagged.push({
      id: node.id,
      name: node.name,
      tier: node.tier,
      hex: node.hex,
      at: now,
      until: now + WINDOW,
    });
    persist();
    toast(`${node.name} tagged for the home portal`);
    return true;
  }

  function enableGps() {
    if (!orientation) {
      orientation = new DeviceOrientationControls(cam, { enablePermissionDialog: false, smoothingFactor: 0.22 });
      orientation.on('deviceorientationerror', () => {
        if (readEl && open) readEl.textContent = 'Tilt stayed off. The prom walk still runs.';
      });
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((state) => {
        if (state === 'granted') orientation.connect();
      }).catch(() => {});
    } else {
      try { orientation.connect(); } catch { /* a desktop has no tilt */ }
    }
    locar.startGps().catch(() => {});
    gpsLive = true;
    open = true;
    walking = false;
    spawn();
    if (readEl) readEl.textContent = 'Outdoor GPS · waiting for a fix';
    paintChrome();
  }

  function simulate() {
    open = true;
    walking = true;
    gpsLive = false;
    walked = 0;
    side = 0;
    spawn();
    locar.fakeGps(PROM.lon, PROM.lat, 4, 8);
    here = { ...PROM };
    if (readEl) readEl.textContent = 'Simulate Walk · Seaside Prom';
    paintChrome();
  }

  function close() {
    open = false;
    walking = false;
    if (tagBtn) tagBtn.hidden = true;
    paintChrome();
  }

  function farm(id) {
    const now = Date.now();
    const tagItem = wallet.tagged.find((item) => item.id === id && item.until > now);
    if (!tagItem) return;
    const pay = FARM[tagItem.tier] || FARM[1];
    wallet.coins += pay.coins;
    wallet.timber += pay.timber;
    wallet.shards += pay.shards;
    wallet.tagged = wallet.tagged.filter((item) => item.id !== id);
    persist();
    close();
    zones.enter('meadow');
    const hex = hexes.list.find((item) => item.id === tagItem.hex);
    if (hex) {
      hexes.grant(hex.id, pay.xp);
      hexes.enter(hex);
    }
    toast(`${tagItem.name} farmed · +${pay.coins} coins`);
  }

  gpsBtn?.addEventListener('pointerup', (e) => {
    enableGps();
    e.preventDefault();
    e.stopPropagation();
  });
  walkBtn?.addEventListener('pointerup', (e) => {
    if (walking) close();
    else simulate();
    e.preventDefault();
    e.stopPropagation();
  });
  backBtn?.addEventListener('pointerup', (e) => {
    close();
    e.preventDefault();
    e.stopPropagation();
  });
  tagBtn?.addEventListener('pointerup', (e) => {
    if (tagTarget) tag(tagTarget);
    e.preventDefault();
    e.stopPropagation();
  });
  queue?.addEventListener('pointerup', (e) => {
    const btn = e.target.closest('[data-farm]');
    if (!btn) return;
    farm(btn.dataset.farm);
    e.preventDefault();
    e.stopPropagation();
  });

  locar.on('gpsupdate', (ev) => {
    here = { lon: ev.position.coords.longitude, lat: ev.position.coords.latitude };
    if (gpsLive && readEl && open) {
      readEl.textContent = `Outdoor GPS · ${here.lat.toFixed(4)}, ${here.lon.toFixed(4)}`;
    }
  });

  function update(dt, move) {
    paintChrome();
    if (!open) return;
    if (walking) {
      let step = 1.15 * dt;
      const push = move || { x: 0, y: 0 };
      if (push.x || push.y) {
        step += push.y * 3.2 * dt;
        side += push.x * 2.4 * dt;
      }
      walked = Math.max(0, walked + step);
      const at = along(walked, side);
      locar.fakeGps(at.lon, at.lat, 4, 8);
      if (readEl) readEl.textContent = `Simulate Walk · Seaside Prom · ${Math.round(walked)} m`;
    }
    if (orientation && gpsLive) orientation.update();
    else cam.rotation.x = -0.2;
    tagTarget = null;
    let nearest = Infinity;
    for (const node of nodes) {
      if (node.taken) continue;
      const meters = metersTo(node);
      const near = `${node.name} · ${Math.max(1, Math.round(meters))} m`;
      paintLabel(node.sprite, near);
      if ((node.kind === 'coin' || node.kind === 'supply') && meters <= COIN_RANGE) collect(node);
      if (node.kind === 'hex' && meters <= TAG_RANGE && meters < nearest && !wallet.tagged.some((item) => item.id === node.id && item.until > Date.now())) {
        nearest = meters;
        tagTarget = node;
      }
    }
    if (tagBtn) {
      tagBtn.hidden = !tagTarget;
      if (tagTarget) tagBtn.textContent = `Tag ${tagTarget.name} for Home Portal`;
    }
  }

  function render() {
    const canvas = renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (cam.aspect !== w / h) {
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor('#9ec8ea', 1);
    renderer.render(outdoorScene, cam);
  }

  paintBoard();
  paintChrome();

  return {
    get open() { return open; },
    get wallet() { return wallet; },
    update,
    render,
    simulate,
    enableGps,
    close,
    tag,
    farm,
    spend(coins, timber) {
      if (wallet.coins < coins || wallet.timber < timber) return false;
      wallet.coins -= coins;
      wallet.timber -= timber;
      persist();
      return true;
    },
    gain(coins) {
      wallet.coins += Math.max(0, coins | 0);
      persist();
    },
  };
}
