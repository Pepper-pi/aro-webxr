/* Daily field seed and live weather. The cabin and the boss arena do not use this.
   Open-Meteo needs no key. If the browser will not share a place, Seaside, Oregon is the fallback. */
const DISC_ID = 'v3-gold';
const SEASIDE = { lat: 45.99, lon: -123.92, source: 'seaside' };
const PIN_KEY = 'aro.world.pins';
const KINDS = ['clear', 'rain', 'storm', 'fog', 'snow', 'wind', 'night'];
const THEMES = [
  { sky: '#12182c', fog: '#12182c', sun: '#ffd2a8', neon: ['#3de0ff', '#b06bff', '#ff3355'] },
  { sky: '#1a1030', fog: '#1a1030', sun: '#ffb070', neon: ['#7a5cff', '#ff4d8d', '#3de0ff'] },
  { sky: '#0e1c28', fog: '#102028', sun: '#ffe0b0', neon: ['#3de0ff', '#ff3355', '#b06bff'] },
];
const HOURS = [
  { id: 'dawn', level: 0.85, sun: '#ffb07a' },
  { id: 'day', level: 1.35, sun: '#fff0d2' },
  { id: 'dusk', level: 0.75, sun: '#ff8a4a' },
  { id: 'night', level: 0.32, sun: '#8aa4d8' },
];

let table = null;
let override = '';
let place = Object.assign({}, SEASIDE);
let look = null;
let rev = 0;
const CELL = 0.02;
const dev = { on: false, lat: SEASIDE.lat, lon: SEASIDE.lon };
const cleared = new Set();
const MARK_NAME = {
  slime: 'Slime', blob: 'Blob', scout: 'Scout', goblin: 'Goblin', 'glass-brute': 'Brute',
  'npc-dock': 'Dock hand', 'npc-fisher': 'Fisher', 'npc-nightwatch': 'Night watch',
  'vendor-tea': 'Tea stall', 'vendor-ink': 'Ink stall', 'vendor-gear': 'Gear stall',
};
const MARK_LINE = {
  'npc-dock': 'The dock is quiet today. Mind the rain.',
  'npc-fisher': 'The pond is biting. Keep the line short.',
  'npc-nightwatch': 'I have the watch. The pits are glowing.',
  'vendor-tea': 'Tea is hot. I am not selling yet.',
  'vendor-ink': 'Ink for the map. The stall is closed.',
  'vendor-gear': 'Gear later. This is only a hello.',
};
const MARK_SLOTS = [[1.35, -1.2], [-1.4, -1.05], [0.1, -1.9], [-1.25, 0.15], [1.4, 0.05], [-0.15, 0.85], [1.05, -0.45]];

function mix(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pad(n) { return n < 10 ? '0' + n : String(n); }
function dateKey(d) {
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function discId() {
  const q = new URLSearchParams(location.search).get('disc');
  return q || DISC_ID;
}
function dailySeed(date, disc) {
  return mix(date + '|' + disc);
}
function codeToKind(code, wind, isDay) {
  const c = Number(code) || 0;
  if (c >= 95) return 'storm';
  if (c >= 71 && c <= 77) return 'snow';
  if (c === 45 || c === 48) return 'fog';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if (wind >= 28) return 'wind';
  if (Number(isDay) === 0) return 'night';
  return 'clear';
}
function cells() {
  const out = [];
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) {
    const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
    if (dist >= 1 && dist <= 3) out.push({ q, r });
  }
  return out;
}
function weighted(rng, items) {
  const total = items.reduce((s, it) => s + it.w, 0) || 1;
  let r = rng() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
function entryWeight(e, weather) {
  const mult = e[weather] == null ? 1 : Number(e[weather]);
  if (mult === 0) return 0;
  return Math.max(0.05, (e.weight || 1) * mult);
}
function rollCount(rng, spec, fallback) {
  if (Array.isArray(spec) && spec.length >= 2) {
    const lo = spec[0] | 0, hi = spec[1] | 0;
    if (hi <= lo) return lo;
    return lo + ((rng() * (hi - lo + 1)) | 0);
  }
  const n = Number(spec);
  return Number.isFinite(n) ? n : fallback;
}
function rollGroup(rng, group, n, weather, places) {
  const pool = (table && table.entries || []).filter(e => e.group === group && (!places || places.indexOf(e.place || '') >= 0)).map(e => ({
    id: e.id, group: e.group, name: e.name || e.id, line: e.line || '', place: e.place || '',
    w: entryWeight(e, weather),
  })).filter(e => e.w > 0);
  const left = pool.slice();
  const out = [];
  for (let i = 0; i < n && left.length; i++) {
    const pick = weighted(rng, left);
    out.push({ id: pick.id, group: pick.group, name: pick.name, line: pick.line, place: pick.place });
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}
function fogFor(kind) {
  if (kind === 'fog') return [2.2, 8];
  if (kind === 'storm') return [5, 13];
  if (kind === 'snow') return [4, 12];
  if (kind === 'night') return [7, 16];
  if (kind === 'rain') return [7, 16];
  return [10, 22];
}
function buildLook(date, disc, weather) {
  const seed = dailySeed(date, disc);
  const rng = mulberry32(seed ^ mix(weather));
  const theme = THEMES[seed % THEMES.length];
  const hour = weather === 'night' ? HOURS[3] : HOURS[(seed >>> 4) % 4];
  const bag = cells();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const s = bag[i]; bag[i] = bag[j]; bag[j] = s;
  }
  const pits = bag.slice(0, 3).map((c, i) => ({ q: c.q, r: c.r, deep: i === 0 }));
  const used = new Set(pits.map(p => p.q + ',' + p.r));
  const scatter = [];
  for (const c of bag) {
    if (scatter.length >= 5) break;
    const key = c.q + ',' + c.r;
    if (used.has(key)) continue;
    used.add(key);
    scatter.push({ q: c.q, r: c.r, kind: rng() < 0.5 ? 'lantern' : 'crate' });
  }
  const roll = (table && table.roll) || { mob: 4, npc: [2, 3], vendor: [1, 2] };
  const spawnRng = mulberry32(seed ^ mix('spawn|' + weather));
  const spawns = []
    .concat(rollGroup(spawnRng, 'mob', rollCount(spawnRng, roll.mob, 4), weather))
    .concat(rollGroup(spawnRng, 'npc', rollCount(spawnRng, roll.npc, 2), weather))
    .concat(rollGroup(spawnRng, 'vendor', rollCount(spawnRng, roll.vendor, 1), weather));
  const fog = fogFor(weather);
  return {
    seed, date, disc, weather, hour: hour.id,
    sky: theme.sky, fog: theme.fog, sun: hour.sun, sunLevel: hour.level,
    neon: theme.neon.slice(),
    fogNear: fog[0], fogFar: fog[1],
    pits, scatter, spawns,
    place: { lat: place.lat, lon: place.lon, source: place.source },
  };
}
function publish(next) {
  look = next;
  rev += 1;
  paintReadout();
}
function currentDate() {
  const q = new URLSearchParams(location.search).get('day');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return dateKey(new Date());
}
function recompute() {
  const weather = override || (look && look.weather) || 'clear';
  publish(buildLook(currentDate(), discId(), weather));
}
function paintReadout() {
  const chip = document.getElementById('worldChip');
  if (chip && look) chip.textContent = look.weather + ' · ' + look.seed.toString(16).slice(0, 6);
  const el = document.getElementById('worldRead');
  if (!el || !look) return;
  const line = group => look.spawns.filter(s => s.group === group).map(s => s.name || s.id).join(', ') || '—';
  const arcade = look.spawns.filter(s => s.place === 'arcade');
  const where = look.place.source === 'seaside' ? 'Seaside' : look.place.lat.toFixed(2) + ', ' + look.place.lon.toFixed(2);
  el.textContent = 'seed ' + look.seed.toString(16) + ' · ' + look.hour + ' · ' + look.weather + ' · ' + where
    + '\nmobs: ' + line('mob') + '\nnpc: ' + line('npc') + '\nvendor: ' + line('vendor')
    + (arcade.length ? '\narcade stub: ' + arcade.map(s => s.name + ' — ' + s.line).join(' | ') : '');
}
function loadPins() {
  try {
    const list = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}
function here() {
  if (dev.on) return { lat: dev.lat, lon: dev.lon };
  return { lat: place.lat, lon: place.lon };
}
function cellId(lat, lon) {
  return Math.round(lat / CELL) + ',' + Math.round(lon / CELL);
}
function anchor() {
  if (dev.on) {
    const x = (dev.lon + 123.92) * 28;
    const y = (dev.lat - 45.99) * 34;
    return { x: Math.max(-4.2, Math.min(4.2, x)), y: Math.max(-3.4, Math.min(3.4, y)) };
  }
  const h = window.__aro && window.__aro.MAP && window.__aro.MAP.house;
  if (h) return { x: h.x, y: h.y };
  return { x: 0, y: 0 };
}
function markers() {
  if (!look || !table) return [];
  const h = here();
  const cell = cellId(h.lat, h.lon);
  const seed = mix(look.date + '|' + cell + '|' + (look.disc || discId()));
  const rng = mulberry32(seed ^ mix('mark|' + look.weather));
  const roll = table.roll || { mob: 2, npc: [2, 3], vendor: [1, 2] };
  const spawns = []
    .concat(rollGroup(rng, 'mob', Math.min(2, rollCount(rng, roll.mob, 2)), look.weather))
    .concat(rollGroup(rng, 'npc', rollCount(rng, roll.npc, 2), look.weather, ['town', 'market']))
    .concat(rollGroup(rng, 'vendor', rollCount(rng, roll.vendor, 1), look.weather, ['town', 'market']))
  const order = MARK_SLOTS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const swap = order[i]; order[i] = order[j]; order[j] = swap;
  }
  const at = anchor();
  return spawns.map((s, i) => {
    const slot = order[i % order.length];
    const key = look.date + '|' + cell + '|' + i + '|' + s.id;
    return {
      key, id: s.id, group: s.group,
      x: at.x + slot[0], y: at.y + slot[1],
      name: s.name || MARK_NAME[s.id] || s.id,
      line: s.line || MARK_LINE[s.id] || 'Hello.',
      place: s.place || '',
      cell,
    };
  }).filter(m => !cleared.has(m.key));
}
function clearMarker(key) {
  if (key) cleared.add(key);
  rev += 1;
  return true;
}
function nudge(dLat, dLon) {
  dev.on = true;
  dev.lat += dLat;
  dev.lon += dLon;
  rev += 1;
  const btn = document.getElementById('devWalk');
  if (btn) btn.textContent = 'Walking';
  return { lat: dev.lat, lon: dev.lon, cell: cellId(dev.lat, dev.lon) };
}
function setDev(on) {
  dev.on = !!on;
  if (dev.on) { dev.lat = place.lat; dev.lon = place.lon; }
  const btn = document.getElementById('devWalk');
  if (btn) btn.textContent = dev.on ? 'Walking' : 'Dev walk';
  rev += 1;
  return dev.on;
}
function pin() {
  if (!look) recompute();
  const list = loadPins();
  list.unshift({
    date: look.date,
    seed: look.seed,
    weather: look.weather,
    lat: look.place.lat,
    lon: look.place.lon,
  });
  try { localStorage.setItem(PIN_KEY, JSON.stringify(list.slice(0, 8))); } catch (e) { /* private mode */ }
  if (window.__home && window.__home.refreshBook) window.__home.refreshBook();
  return list.slice(0, 8);
}

async function loadTable() {
  try {
    const res = await fetch('data/weather_spawns.json');
    if (res.ok) table = await res.json();
  } catch (e) { table = null; }
  if (!table) table = { roll: { mob: 4, npc: 1, vendor: 1 }, entries: [] };
  recompute();
}
async function loadWeather() {
  if (override) return;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon + '&current=weather_code,wind_speed_10m,is_day';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const cur = data.current || {};
    const kind = codeToKind(cur.weather_code, cur.wind_speed_10m, cur.is_day);
    if (!override) publish(buildLook(currentDate(), discId(), kind));
  } catch (e) { /* keep the fallback kind */ }
}
function locate() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(Object.assign({}, SEASIDE)); return; }
    let done = false;
    const finish = (p) => { if (done) return; done = true; resolve(p); };
    const timer = setTimeout(() => finish(Object.assign({}, SEASIDE)), 2500);
    navigator.geolocation.getCurrentPosition(
      pos => { clearTimeout(timer); finish({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'geo' }); },
      () => { clearTimeout(timer); finish(Object.assign({}, SEASIDE)); },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 600000 }
    );
  });
}

function mount() {
  const style = document.createElement('style');
  style.textContent = [
    '#worldChip{position:fixed;left:50%;top:calc(44px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:16;display:none;padding:6px 14px;border-radius:999px;background:rgba(42,24,16,.9);border:1px solid rgba(226,196,138,.8);color:#f6e2c4;font:800 13px sans-serif;pointer-events:none;letter-spacing:.02em}',
    'body.field-on #worldChip{display:block}',
    '#devWalk{position:fixed;left:12px;top:calc(52px + env(safe-area-inset-top,0px));z-index:16;display:none;min-height:36px;padding:6px 12px;border-radius:12px;border:1px solid rgba(226,196,138,.7);background:rgba(42,24,16,.9);color:#f6e2c4;font:800 13px sans-serif}',
    'body.out-combat #devWalk{display:block}',
    '#worldHud{position:fixed;right:12px;top:calc(8px + env(safe-area-inset-top,0px));z-index:16;display:none;width:min(18rem,calc(100% - 24px));pointer-events:none}',
    'body.field-on.fight-fp:not(.fp-clear) #worldHud{display:block}',
    '#worldHud select,#worldHud button{pointer-events:auto;min-height:36px;margin:0 6px 6px 0;padding:6px 10px;border-radius:10px;border:1px solid rgba(180,220,255,.45);background:rgba(12,10,20,.88);color:#f4f7ff;font:700 13px sans-serif}',
    '#worldRead{pointer-events:none;margin:0;white-space:pre-line;font:600 12px/1.35 sans-serif;color:#f4f7ff;background:rgba(12,10,20,.82);padding:8px 10px;border-radius:10px}',
  ].join('');
  document.head.appendChild(style);
  const hud = document.createElement('div');
  hud.id = 'worldHud';
  const opts = ['live'].concat(KINDS).map(k => '<option value="' + k + '">' + (k === 'live' ? 'Weather: live' : k) + '</option>').join('');
  hud.innerHTML = '<select id="worldWeather" aria-label="Weather override">' + opts + '</select><button type="button" id="worldPin">Pin this world</button><p id="worldRead"></p>';
  document.body.appendChild(hud);
  const chip = document.createElement('div');
  chip.id = 'worldChip';
  chip.textContent = 'weather';
  document.body.appendChild(chip);
  const walk = document.createElement('button');
  walk.id = 'devWalk';
  walk.type = 'button';
  walk.textContent = 'Dev walk';
  walk.onclick = () => setDev(!dev.on);
  document.body.appendChild(walk);
  document.getElementById('worldWeather').onchange = (e) => {
    override = e.target.value === 'live' ? '' : e.target.value;
    if (override) publish(buildLook(currentDate(), discId(), override));
    else loadWeather();
  };
  document.getElementById('worldPin').onclick = () => pin();
  window.__world = {
    look: () => look,
    revision: () => rev,
    pins: loadPins,
    pin,
    markers,
    you: anchor,
    dev: () => dev.on,
    setDev,
    nudge,
    clearMarker,
    setWeather: (kind) => {
      override = KINDS.includes(kind) ? kind : '';
      const sel = document.getElementById('worldWeather');
      if (sel) sel.value = override || 'live';
      if (override) publish(buildLook(currentDate(), discId(), override));
      else loadWeather();
      return look;
    },
    preview: ({ date, disc, weather, lat, lon } = {}) => {
      const d = date || currentDate();
      const id = disc || discId();
      const w = weather || override || (look && look.weather) || 'clear';
      if (lat != null && lon != null) place = { lat, lon, source: 'preview' };
      if (weather) override = weather;
      const sel = document.getElementById('worldWeather');
      if (sel) sel.value = override || 'live';
      publish(buildLook(d, id, w));
      return look;
    },
  };
  loadTable().then(async () => {
    place = await locate();
    dev.lat = place.lat;
    dev.lon = place.lon;
    if (!override) await loadWeather();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
