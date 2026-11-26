// Home hearth and the command board. Friendship and respect stay in the browser.
const KEY = 'aro-hub';
const RANKS = [
  { at: 0, name: 'Stranger' },
  { at: 20, name: 'Familiar' },
  { at: 50, name: 'Close' },
  { at: 90, name: 'Trusted' },
  { at: 140, name: 'Bonded' },
];
const CREW = [
  { at: 0, name: 'New' },
  { at: 15, name: 'Known' },
  { at: 40, name: 'Relied on' },
  { at: 80, name: 'Honored' },
];
const PEOPLE = [
  { id: 'maren', name: 'Maren Reed', role: 'Hearth keeper', color: '#c45a4a',
    lines: ['The kettle is on. Sit a minute.', 'You came back. That counts.', 'The fire knows your step now.'],
    chats: [
      { q: 'How is the house?', a: 'Warm, if you keep the door from swinging.', mood: 'glad', f: 4, r: 2 },
      { q: 'Need anything from the meadow?', a: 'Herbs, if the hex is kind today.', mood: 'hopeful', f: 3, r: 3 },
      { q: 'I can stay for tea.', a: 'Then stay. The cup is already yours.', mood: 'cozy', f: 6, r: 2 },
    ] },
  { id: 'sable', name: 'Sable Quinn', role: 'Lake guide', color: '#3d7a8c',
    lines: ['Long Lake is patient. Be patient back.', 'A small trout is still a trout.', 'Evening fish glow if you let them.'],
    chats: [
      { q: 'Any luck out there?', a: 'Luck is a clean cast and a quiet hand.', mood: 'dry', f: 4, r: 3 },
      { q: 'Show me the reeds.', a: 'Tide Reeds, then the real lake. Same water, different mood.', mood: 'pleased', f: 5, r: 2 },
      { q: 'I brought stories, not fish.', a: 'Stories keep. Fish do not. Tell it anyway.', mood: 'amused', f: 4, r: 2 },
    ] },
  { id: 'bram', name: 'Bram Holt', role: 'Hex warden', color: '#6a8f4a',
    lines: ['The hexes wake if you walk them.', 'Stand your ground. The rim will hold.', 'Mythic light is earned, not painted on.'],
    chats: [
      { q: 'Which hex first?', a: 'Moss Creek. Learn the water before the fight.', mood: 'steady', f: 3, r: 4 },
      { q: 'Spar a little?', a: 'Blunted. I still expect you to mean it.', mood: 'keen', f: 2, r: 6 },
      { q: 'The board looks full.', a: 'Then pick one pin and finish it.', mood: 'plain', f: 3, r: 3 },
    ] },
  { id: 'lumen', name: 'Lumen Pike', role: 'Spell friend', color: '#c9a15b',
    lines: ['Your disc likes a steady wrist.', 'Gifts should be something you found, not bought.', 'I saved you a note in the margin.'],
    chats: [
      { q: 'What should I practice?', a: 'Frost, slow. Then fire, once the arm is calm.', mood: 'bright', f: 4, r: 3 },
      { q: 'Want to see a trick?', a: 'Only if the hearth rug survives it.', mood: 'wary', f: 3, r: 2 },
      { q: 'I found an herb.', a: 'Then it already knows your name. So do I, a little more.', mood: 'warm', f: 5, r: 3 },
    ] },
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}
function blank() {
  return {
    respect: 0,
    people: Object.fromEntries(PEOPLE.map((p) => [p.id, { fp: 0, mood: 'calm', notes: 0, hangs: 0 }])),
    boardSeed: 1,
    done: {},
  };
}
function state() {
  const raw = load();
  const base = blank();
  return {
    respect: raw.respect || 0,
    people: { ...base.people, ...(raw.people || {}) },
    boardSeed: raw.boardSeed || 1,
    done: raw.done || {},
    need: raw.need || null,
  };
}
function rankName(fp) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (fp >= r.at) name = r.name;
  return name;
}
function crewName(n) {
  let name = CREW[0].name;
  for (const r of CREW) if (n >= r.at) name = r.name;
  return name;
}
function fishBook() {
  try { return JSON.parse(localStorage.getItem('aro-long-lake') || '{}'); } catch { return {}; }
}
function hexXp() {
  try { return JSON.parse(localStorage.getItem('aro-hex-xp') || '{}'); } catch { return {}; }
}
function herbs() {
  try { return Number(localStorage.getItem('aro-herbs') || 0); } catch { return 0; }
}
function fishCount(id) {
  const book = fishBook();
  if (id) return book[id]?.n || 0;
  return Object.values(book).reduce((n, r) => n + (r.n || 0), 0);
}
function hexSum() {
  return Object.values(hexXp()).reduce((n, v) => n + (Number(v) || 0), 0);
}

const MANNER = {
  maren: {
    Day: 'sets a cup down and uses her morning voice',
    Dusk: 'keeps her voice near the fire, softer than the room',
    Evening: 'speaks from the dark side of the hearth',
    rain: 'She glances at the wet sill.',
  },
  sable: {
    Day: 'talks like the lake is still bright and easy',
    Dusk: 'goes quiet, the way she does when the reeds light up',
    Evening: 'sounds amused, as if the dark were a joke she keeps',
    rain: 'Rain ticks on her collar.',
  },
  bram: {
    Day: 'stands square and says it once',
    Dusk: 'checks the rim of the hex before he finishes the sentence',
    Evening: 'speaks lower, like a watch that does not want to wake the yard',
    rain: 'He shakes water off a glove.',
  },
  lumen: {
    Day: 'is bright, and a little too quick',
    Dusk: 'cups a hand near her bead and whispers the ask',
    Evening: 'reads it like a note she already wrote in the margin',
    rain: 'Her lantern bead fogs, then clears.',
  },
};
const PINS = [
  { id: 'herb-day', who: 'maren', title: 'Herbs while it is bright', note: 'One herb, before the day turns.', voice: 'The kettle can wait. Bring something green.', times: ['Day'], weathers: ['Clear'], need: 1, get: () => herbs(), rewardF: 7, rewardR: 5 },
  { id: 'shutters', who: 'maren', title: 'Latch the wet sill', note: 'Stay a moment while the lantern rain is up.', voice: 'The sill drinks every drop. Sit with me until it eases.', times: ['Day', 'Dusk', 'Evening'], weathers: ['Lantern Rain'], need: 1, get: (s) => s.people.maren?.hangs || 0, rewardF: 8, rewardR: 5 },
  { id: 'tea-dusk', who: 'maren', title: 'Tea at the turning', note: 'Share tea once the light goes copper.', voice: 'Dusk tea, not morning tea. The cup knows the difference.', times: ['Dusk'], weathers: ['Clear', 'Lantern Rain'], need: 1, get: (s) => s.people.maren?.hangs || 0, rewardF: 8, rewardR: 4 },
  { id: 'coals', who: 'maren', title: 'Keep the coals', note: 'An evening story, and the fire left fed.', voice: 'Evening is for the coals. Tell me one true thing.', times: ['Evening'], weathers: ['Clear', 'Lantern Rain'], need: 1, get: (s) => s.people.maren?.hangs || 0, rewardF: 9, rewardR: 4 },
  { id: 'trout-day', who: 'sable', title: 'A daylight trout', note: 'One creek trout while the water is plain.', voice: 'Day fish are honest. One trout, no glow.', times: ['Day'], weathers: ['Clear'], need: 1, get: () => fishCount('trout'), rewardF: 8, rewardR: 6 },
  { id: 'reed-dusk', who: 'sable', title: 'A dusk lantern fish', note: 'The evening fish, if the lake is dark.', voice: 'Wait until the belly-lamps rise. Then cast.', times: ['Dusk', 'Evening'], weathers: ['Clear', 'Lantern Rain'], need: 1, get: () => fishCount('lantern'), rewardF: 10, rewardR: 8 },
  { id: 'rain-lamps', who: 'sable', title: 'Two lamps in the rain', note: 'Any two fish, caught while the canal is wet.', voice: 'The canal hisses. Bring two fish and we will call the lamps honest.', times: ['Day', 'Dusk', 'Evening'], weathers: ['Lantern Rain'], need: 2, get: () => fishCount(), rewardF: 6, rewardR: 6 },
  { id: 'stroll-eve', who: 'sable', title: 'Walk the dark water', note: 'An evening stroll, not a noon one.', voice: 'Evening water tells different lies. Walk it with me.', times: ['Evening'], weathers: ['Clear'], need: 1, get: (s) => s.people.sable?.hangs || 0, rewardF: 8, rewardR: 4 },
  { id: 'hex-day', who: 'bram', title: 'Wake a daylight hex', note: 'Twenty resonance while the yard is bright.', voice: 'Daylight first. Twenty resonance, then you may talk about dusk.', times: ['Day'], weathers: ['Clear', 'Lantern Rain'], need: 20, get: () => hexSum(), rewardF: 6, rewardR: 8 },
  { id: 'patrol-dusk', who: 'bram', title: 'Walk the dusk rim', note: 'One spar, at the turning of the light.', voice: 'Dusk is when the rim lies. Step it with me. Blunted.', times: ['Dusk'], weathers: ['Clear', 'Lantern Rain'], need: 1, get: (s) => s.people.bram?.hangs || 0, rewardF: 4, rewardR: 8 },
  { id: 'rain-watch', who: 'bram', title: 'Hold the wet post', note: 'Stand a watch while the lantern rain falls.', voice: 'Rain makes people hurry. Do not. One watch is enough.', times: ['Day', 'Dusk', 'Evening'], weathers: ['Lantern Rain'], need: 1, get: (s) => s.people.bram?.hangs || 0, rewardF: 5, rewardR: 7 },
  { id: 'night-pin', who: 'bram', title: 'One pin, then sleep', note: 'Twenty resonance before the evening closes.', voice: 'Evening boards get fat. Pick the hex and finish it.', times: ['Evening'], weathers: ['Clear'], need: 20, get: () => hexSum(), rewardF: 6, rewardR: 9 },
  { id: 'wrist-day', who: 'lumen', title: 'A calm morning wrist', note: 'Practice once, while the day is clear.', voice: 'Frost, slow, in the daylight. Then stop.', times: ['Day'], weathers: ['Clear'], need: 1, get: (s) => s.people.lumen?.hangs || 0, rewardF: 6, rewardR: 4 },
  { id: 'bead-dusk', who: 'lumen', title: 'Light the dusk bead', note: 'One herb, for a wick, at dusk.', voice: 'Dusk likes a small flame. An herb will do for the wick.', times: ['Dusk'], weathers: ['Clear', 'Lantern Rain'], need: 1, get: () => herbs(), rewardF: 7, rewardR: 6 },
  { id: 'rain-bead', who: 'lumen', title: 'Keep the bead clear', note: 'Stay while the rain fogs the glass.', voice: 'Lantern rain beads on everything. Wipe the bead, then tell me a spell.', times: ['Day', 'Dusk', 'Evening'], weathers: ['Lantern Rain'], need: 1, get: (s) => s.people.lumen?.hangs || 0, rewardF: 6, rewardR: 5 },
  { id: 'margin-eve', who: 'lumen', title: 'The evening margin', note: 'A found gift, after the lamps are the only light.', voice: 'I left the evening note in the margin. Bring something you found.', times: ['Evening'], weathers: ['Clear', 'Lantern Rain'], need: 1, get: () => fishCount() + herbs(), rewardF: 8, rewardR: 5 },
];

const NEEDS = [
  { item: 'herb', title: 'A morning sprig', note: 'One herb, while the day is clear.', who: 'maren', times: ['Day'], weathers: ['Clear'], voice: 'Morning herbs smell like the path.' },
  { item: 'trout', title: 'One daylight trout', note: 'A trout from Long Lake. Pays respect.', who: 'sable', times: ['Day'], weathers: ['Clear', 'Lantern Rain'], voice: 'Daylight trout. No stories instead.' },
  { item: 'eel', title: 'A violet eel', note: 'An evening fish from the glowing water.', who: 'sable', times: ['Dusk', 'Evening'], weathers: ['Clear', 'Lantern Rain'], voice: 'The eel only after the sky goes purple.' },
  { item: 'tusk', title: 'A wet-weather tusk', note: 'A drop from a hex fight in the rain.', who: 'bram', times: ['Day', 'Dusk', 'Evening'], weathers: ['Lantern Rain'], voice: 'Rain fights are shorter. Bring the tusk anyway.' },
  { item: 'tusk', title: 'A dusk tusk', note: 'A drop from a hex fight at the turning.', who: 'bram', times: ['Dusk', 'Evening'], weathers: ['Clear'], voice: 'Dusk tusks. Not a noon trophy.' },
  { item: 'wick', title: 'A lantern wick', note: 'A crafted bit, once the lamps matter.', who: 'lumen', times: ['Dusk', 'Evening'], weathers: ['Clear', 'Lantern Rain'], voice: 'The wick is for dusk, not for noon.' },
  { item: 'herb', title: 'A rain herb', note: 'One herb picked while the lanterns drip.', who: 'maren', times: ['Day', 'Dusk', 'Evening'], weathers: ['Lantern Rain'], voice: 'Wet herbs keep. Bring one in.' },
];
function bagCount(item) {
  if (item === 'herb') return herbs();
  if (item === 'trout') return fishCount('trout');
  if (item === 'eel') return fishCount('eel') + fishCount('glowfin') + fishCount('lantern');
  try { return JSON.parse(localStorage.getItem('aro-beast-drops') || '{}')[item] || 0; } catch { return 0; }
}
function shuffle(list, seed) {
  const a = list.slice();
  let s = (seed * 9301 + 49297) % 233280;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = s % (i + 1);
    const swap = a[i];
    a[i] = a[j];
    a[j] = swap;
  }
  return a;
}
function manner(who, sky) {
  const row = MANNER[who] || MANNER.maren;
  const line = row[sky.time] || row.Day;
  return sky.weather === 'Lantern Rain' ? `${line}. ${row.rain}` : line;
}
function pickBoard(seed, sky) {
  const fit = (row) => (!row.times || row.times.includes(sky.time)) && (!row.weathers || row.weathers.includes(sky.weather));
  const strict = PINS.filter(fit);
  const bag = strict.length >= 4 ? strict : PINS.filter((row) => !row.times || row.times.includes(sky.time));
  const order = shuffle(bag.length ? bag : PINS, seed + sky.time.length * 5 + (sky.weather === 'Lantern Rain' ? 19 : 3));
  const picked = [];
  for (const id of ['maren', 'sable', 'bram', 'lumen']) {
    const row = order.find((pin) => pin.who === id && !picked.includes(pin));
    if (row) picked.push(row);
  }
  for (const row of order) {
    if (picked.length >= 4) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked;
}

function hideQuest(on) {
  const q = document.getElementById('quest');
  if (q) q.style.visibility = on ? 'hidden' : '';
}

export function createHub(hooks = {}) {
  let data = state();
  let who = null;
  let lastLine = '';
  let currentPins = [];
  let skyKey = 'Day|Clear';
  function skyNow() {
    return hooks.sky?.() || { time: 'Day', weather: 'Clear' };
  }

  function persist() { save(data); }

  function meter(fp) {
    const next = RANKS.find((r) => r.at > fp);
    const prev = [...RANKS].reverse().find((r) => r.at <= fp) || RANKS[0];
    const span = (next?.at || prev.at + 1) - prev.at;
    const u = next ? (fp - prev.at) / span : 1;
    return { label: rankName(fp), width: Math.round(Math.max(0, Math.min(1, u)) * 100) };
  }

  function renderHome() {
    const box = document.getElementById('homeCrew');
    const card = document.getElementById('homeCard');
    if (!box) return;
    const perkLine = {
      maren: 'Perk: rarer fish at Long Lake.',
      bram: 'Perk: harder Warrior cuts.',
      sable: 'Perk: more evening fish.',
      lumen: 'Perk: faster spell gather.',
    };
    box.innerHTML = PEOPLE.map((p) => {
      const row = data.people[p.id] || { fp: 0, mood: 'calm' };
      const m = meter(row.fp);
      const perk = row.fp >= 90 ? (perkLine[p.id] || '') : '';
      return `<button type="button" class="pal${who === p.id ? ' on' : ''}" data-who="${p.id}"><b style="color:${p.color}">${p.name}</b><br>${p.role} · ${row.mood} · ${m.label}<div class="meter"><i style="width:${m.width}%"></i></div>${perk ? `<br>${perk}` : ''}</button>`;
    }).join('');
    box.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('pointerup', (e) => {
      who = b.getAttribute('data-who');
      renderHome();
      e.preventDefault();
      e.stopPropagation();
    }));
    if (!card) return;
    if (!who) { card.hidden = true; return; }
    const p = PEOPLE.find((x) => x.id === who);
    const row = data.people[p.id];
    const m = meter(row.fp);
    const perks = {
      maren: 'Perk: rare fish come easier at Long Lake.',
      bram: 'Perk: Warrior cuts hit harder.',
      sable: 'Perk: evening fish rise more often.',
      lumen: 'Perk: spells gather faster.',
    };
    const perk = row.fp >= 90 ? (perks[p.id] || 'Perk: a little extra luck in their craft.') : row.fp >= 50 ? 'A longer note is unlocked.' : 'Keep talking. Notes open as you grow close.';
    card.hidden = false;
    card.innerHTML = `<p class="meta">${p.role}</p><h2>${p.name}</h2><p>Mood ${row.mood} · ${m.label} · ${row.fp} bond</p><div class="meter"><i style="width:${m.width}%"></i></div><p>${p.lines[Math.min(p.lines.length - 1, row.notes || 0)]}</p><p>${perk}</p><p>${lastLine}</p>${p.chats.map((c, i) => `<button type="button" data-chat="${i}">${c.q}</button>`).join('')}<button type="button" data-act="tea">Share tea at the hearth</button><button type="button" data-act="stroll">Evening stroll by Long Lake</button><button type="button" data-act="spar">Friendly spar</button><button type="button" data-act="gift">Give a found gift</button>`;
    card.querySelectorAll('[data-chat]').forEach((b) => b.addEventListener('pointerup', (e) => {
      reply(Number(b.getAttribute('data-chat')));
      e.preventDefault();
      e.stopPropagation();
    }));
    card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('pointerup', (e) => {
      act(b.getAttribute('data-act'));
      e.preventDefault();
      e.stopPropagation();
    }));
  }

  function bump(id, f, r, mood) {
    const row = data.people[id];
    row.fp += f;
    if (mood) row.mood = mood;
    if (row.fp >= 50) row.notes = Math.max(row.notes || 0, 1);
    if (row.fp >= 90) row.notes = Math.max(row.notes || 0, 2);
    data.respect += r;
    persist();
  }

  function reply(i) {
    const p = PEOPLE.find((x) => x.id === who);
    if (!p) return;
    const c = p.chats[i];
    if (!c) return;
    bump(p.id, c.f, c.r, c.mood);
    lastLine = `${p.name}: “${c.a}”  +${c.f} friendship, +${c.r} respect`;
    renderHome();
  }

  function act(kind) {
    const p = PEOPLE.find((x) => x.id === who);
    if (!p) return;
    if (kind === 'gift') {
      const herbN = herbs();
      const fishN = fishCount();
      if (herbN < 1 && fishN < 1) {
        lastLine = 'Nothing found yet. Catch a fish or pick an herb first.';
        renderHome();
        return;
      }
      if (herbN > 0) {
        try { localStorage.setItem('aro-herbs', String(herbN - 1)); } catch { /* ignore */ }
      }
      bump(p.id, 12, 6, 'touched');
      hooks.mind?.remember(p.id, 'You gave a found gift.');
      p && (data.people[p.id].hangs += 1);
      persist();
      lastLine = `${p.name} takes the gift. +12 friendship, +6 respect.`;
      renderHome();
      return;
    }
    const word = kind === 'tea' ? 'The tea is shared. The room goes quiet in a good way.' : kind === 'stroll' ? 'You walk the long way by the water and talk little.' : 'A short spar. Neither of you is showing off.';
    data.people[p.id].hangs += 1;
    hooks.mind?.remember(p.id, kind === 'tea' ? 'You shared tea at the hearth.' : kind === 'spar' ? 'You sparred, kindly.' : 'You walked the lake together.');
    bump(p.id, kind === 'spar' ? 4 : 8, kind === 'spar' ? 7 : 4, kind === 'spar' ? 'keen' : 'cozy');
    lastLine = `${word} +friendship, +respect.`;
    renderHome();
  }

  function ensureNeed(sky) {
    const now = Date.now();
    const key = `${sky.time}|${sky.weather}`;
    if (!data.need || data.need.sky !== key || data.need.until < now) {
      const pool = NEEDS.filter((row) => (!row.times || row.times.includes(sky.time)) && (!row.weathers || row.weathers.includes(sky.weather)));
      const pick = (pool.length ? pool : NEEDS)[data.boardSeed % (pool.length || NEEDS.length)];
      data.need = { item: pick.item, title: pick.title, note: pick.note, who: pick.who, voice: pick.voice, sky: key, until: now + 90000 };
      persist();
    }
    return data.need;
  }
  function renderBoard() {
    const list = document.getElementById('crewList');
    const rank = document.getElementById('crewRank');
    const sky = skyNow();
    skyKey = `${sky.time}|${sky.weather}`;
    if (rank) rank.textContent = `Respect · ${crewName(data.respect)} · ${data.respect}`;
    const skyEl = document.getElementById('crewSky');
    if (skyEl) skyEl.textContent = `${sky.time} · ${sky.weather}`;
    if (!list) return;
    const need = ensureNeed(sky);
    const left = Math.max(0, Math.ceil((need.until - Date.now()) / 1000));
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const haveNeed = bagCount(need.item);
    const needPerson = PEOPLE.find((p) => p.id === need.who);
    const needReady = haveNeed >= 1 && !data.done[`need:${need.until}`];
    const needDone = !!data.done[`need:${need.until}`];
    currentPins = pickBoard(data.boardSeed, sky);
    const randomPin = `<div class="pin"><b>${need.title}</b><br>${needPerson.name} · ${manner(need.who, sky)}<br><span class="voice">“${need.voice || need.note}”</span><br>${Math.min(1, haveNeed)}/1 · ${clock} left · +10 respect · +6 bond<br>${needDone ? 'Turned in.' : `<button type="button" data-turn="random" ${needReady ? '' : 'disabled'}>${needReady ? 'Turn in' : 'In progress'}</button>`}</div>`;
    list.innerHTML = `<div class="pin"><b>${sky.time} · ${sky.weather}</b><br>The board changes with the light and the canal rain. Each voice asks for something else.</div>` + randomPin + currentPins.map((pin) => {
      const person = PEOPLE.find((p) => p.id === pin.who);
      const have = Math.min(pin.need, pin.get(data));
      const key = `${data.boardSeed}:${skyKey}:${pin.id}`;
      const ready = have >= pin.need && !data.done[key];
      const turned = !!data.done[key];
      return `<div class="pin"><b>${pin.title}</b><br>${person.name} · ${manner(pin.who, sky)}<br><span class="voice">“${pin.voice}”</span><br>${pin.note}<br>${have}/${pin.need} · +${pin.rewardR} respect · +${pin.rewardF} bond${turned ? '<br>Turned in.' : ''}<br>${turned ? '' : `<button type="button" data-turn="${pin.id}" ${ready ? '' : 'disabled'}>${ready ? 'Turn in' : 'In progress'}</button>`}</div>`;
    }).join('');
    list.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('pointerup', (e) => {
      turnIn(b.getAttribute('data-turn'));
      e.preventDefault();
      e.stopPropagation();
    }));
  }

  function turnIn(id) {
    if (id === 'random') {
      const need = ensureNeed();
      const key = `need:${need.until}`;
      if (data.done[key] || bagCount(need.item) < 1) return;
      data.done[key] = true;
      if (need.item !== 'herb' && need.item !== 'trout') {
        try {
          const bag = JSON.parse(localStorage.getItem('aro-beast-drops') || '{}');
          bag[need.item] = Math.max(0, (bag[need.item] || 0) - 1);
          localStorage.setItem('aro-beast-drops', JSON.stringify(bag));
        } catch { /* private mode */ }
      }
      bump(need.who, 4, 16, 'proud');
      const who = PEOPLE.find((p) => p.id === need.who);
      hooks.toast?.(`${who?.name || 'Crew'} · +16 respect · +4 bond`);
      renderBoard();
      return;
    }
    const pin = currentPins.find((r) => r.id === id) || PINS.find((r) => r.id === id);
    if (!pin) return;
    const key = `${data.boardSeed}:${skyKey}:${pin.id}`;
    if (data.done[key]) return;
    if (pin.get(data) < pin.need) return;
    data.done[key] = true;
    bump(pin.who, pin.rewardF, pin.rewardR, 'proud');
    const person = PEOPLE.find((p) => p.id === pin.who);
    hooks.toast?.(`${person?.name || 'Crew'} · +${pin.rewardR} respect · +${pin.rewardF} bond`);
    renderBoard();
  }

  function openHome() {
    hooks.visit?.();
    data = state();
    document.getElementById('menu') && (document.getElementById('menu').hidden = true);
    document.getElementById('home').hidden = false;
    document.getElementById('crew').hidden = true;
    hideQuest(true);
    renderHome();
  }
  const FIELD = [
    { speciesId: 'moss-boar', name: 'Moss Boar', rarity: 'Common', habitat: 'Moss hex', drops: ['bristle', 'moss tusk'], rareDrops: ['dew tusk'], seasonalVanityOrPet: 'Bristle clasp' },
    { speciesId: 'creek-boar', name: 'Creek Boar', rarity: 'Common', habitat: 'Forest creek', drops: ['tusk', 'hide'], rareDrops: ['gold tusk'], seasonalVanityOrPet: 'Creek bell' },
    { speciesId: 'gel-king', name: 'Gel King', rarity: 'Boss', habitat: 'Bloom hollow', drops: ['crown gel', 'king core'], rareDrops: ['star gel'], seasonalVanityOrPet: 'Gel crown' },
    { speciesId: 'forest-wolf', name: 'Forest Wolf', rarity: 'Uncommon', habitat: 'Moss woods', drops: ['ruff', 'fang'], rareDrops: ['pale ruff'], seasonalVanityOrPet: 'Fog collar' },
    { speciesId: 'tide-crab', name: 'Tide Crab', rarity: 'Uncommon', habitat: 'Long Lake shore', drops: ['shell', 'claw'], rareDrops: ['pearl shell'], seasonalVanityOrPet: 'Shell button' },
    { speciesId: 'lantern-moth', name: 'Lantern Moth', rarity: 'Rare', habitat: 'Dusk shore and hearth', drops: ['dust', 'mote'], rareDrops: ['gold dust'], seasonalVanityOrPet: 'Moth clasp' },
  ];
  let pickedSpecies = 'creek-boar';
  function fieldBook() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem('aro-bestiary') || '{}'); } catch { data = {}; }
    const prior = {};
    for (const row of data.entries || []) prior[row.speciesId] = row;
    const entries = FIELD.map((s) => ({
      speciesId: s.speciesId,
      name: s.name,
      rarity: s.rarity,
      habitat: s.habitat,
      drops: s.drops.slice(),
      rareDrops: s.rareDrops.slice(),
      seasonalVanityOrPet: s.seasonalVanityOrPet,
      seenCount: prior[s.speciesId]?.seenCount || 0,
      defeatedCount: prior[s.speciesId]?.defeatedCount || 0,
    }));
    data.version = 2;
    data.seen = data.seen || {};
    data.entries = entries;
    try { localStorage.setItem('aro-bestiary', JSON.stringify(data)); } catch { /* private mode */ }
    return data;
  }
  function paintBook() {
    const list = document.getElementById('bestiaryList');
    const detail = document.getElementById('bestiaryDetail');
    const data = fieldBook();
    const rows = data.entries;
    if (list) {
      list.innerHTML = rows.map((s) => `<button type="button" data-species="${s.speciesId}" class="${s.speciesId === pickedSpecies ? 'on' : ''}"><b>${s.name}</b><span class="pill ${s.rarity.toLowerCase()}">${s.rarity}</span></button>`).join('');
      list.querySelectorAll('[data-species]').forEach((b) => b.addEventListener('pointerup', (e) => {
        pickedSpecies = b.getAttribute('data-species');
        paintBook();
        e.preventDefault();
        e.stopPropagation();
      }));
    }
    const s = rows.find((row) => row.speciesId === pickedSpecies) || rows[0];
    if (detail && s) {
      detail.innerHTML = `<span class="pill ${s.rarity.toLowerCase()}">${s.rarity}</span><h2>${s.name}</h2><p>${s.habitat}</p><p>Drops · ${s.drops.join(', ')}</p><p>Rare · ${s.rareDrops.join(', ')}</p><p>Keepsake · ${s.seasonalVanityOrPet}</p><p>Seen ${s.seenCount} · Defeated ${s.defeatedCount}</p>`;
    }
  }
  function openBook() {
    const sheet = document.getElementById('bestiary');
    if (!sheet) return;
    document.getElementById('crew').hidden = true;
    document.getElementById('home').hidden = true;
    const menu = document.getElementById('menu');
    if (menu) menu.hidden = true;
    sheet.hidden = false;
    paintBook();
  }
  function openBoard() {
    data = state();
    document.getElementById('menu') && (document.getElementById('menu').hidden = true);
    document.getElementById('crew').hidden = false;
    document.getElementById('home').hidden = true;
    const travel = document.getElementById('board');
    if (travel) travel.hidden = true;
    hideQuest(true);
    const banner = document.getElementById('hexbanner');
    if (banner) banner.hidden = true;
    renderBoard();
  }
  function closeAll() {
    document.getElementById('home').hidden = true;
    document.getElementById('crew').hidden = true;
    const book = document.getElementById('bestiary');
    if (book) book.hidden = true;
    hideQuest(false);
  }

  document.getElementById('openAR')?.addEventListener('pointerup', (e) => {
    closeAll();
    document.getElementById('menu').hidden = true;
    document.getElementById('ar')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('openHome')?.addEventListener('pointerup', (e) => { openHome(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('openCrew')?.addEventListener('pointerup', (e) => { openBoard(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('homeClose')?.addEventListener('pointerup', (e) => { closeAll(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('crewClose')?.addEventListener('pointerup', (e) => { closeAll(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('openBook')?.addEventListener('pointerup', (e) => { openBook(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('menuBook')?.addEventListener('pointerup', (e) => { openBook(); e.preventDefault(); e.stopPropagation(); });
  document.getElementById('bookClose')?.addEventListener('pointerup', (e) => {
    document.getElementById('bestiary').hidden = true;
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('crewRefresh')?.addEventListener('pointerup', (e) => {
    data.boardSeed += 1;
    persist();
    renderBoard();
    e.preventDefault();
    e.stopPropagation();
  });

  return { openHome, openBoard, openBook, reply, act, turnIn, closeAll, get who() { return who; }, set who(v) { who = v; }, get lastLine() { return lastLine; }, people: PEOPLE };
}
