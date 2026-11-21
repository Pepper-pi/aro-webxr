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

const REQUESTS = [
  { id: 'trout', who: 'sable', title: 'A creek trout', note: 'One real catch from Long Lake.', need: 1, get: () => fishCount('trout'), rewardF: 8, rewardR: 6 },
  { id: 'anyfish', who: 'sable', title: 'Two for the pan', note: 'Any two fish in the book.', need: 2, get: () => fishCount(), rewardF: 6, rewardR: 5 },
  { id: 'lantern', who: 'lumen', title: 'A dusk lantern', note: 'The evening fish, if the lake is dark.', need: 1, get: () => fishCount('lantern'), rewardF: 10, rewardR: 8 },
  { id: 'herb', who: 'maren', title: 'Hearth herbs', note: 'One herb picked in a hex.', need: 1, get: () => herbs(), rewardF: 7, rewardR: 5 },
  { id: 'hex', who: 'bram', title: 'Wake a hex', note: 'Twenty resonance, across any hexes.', need: 20, get: () => hexSum(), rewardF: 6, rewardR: 8 },
  { id: 'tea', who: 'maren', title: 'Tea at the hearth', note: 'Share tea with Maren.', need: 1, get: (s) => s.people.maren?.hangs || 0, rewardF: 8, rewardR: 4 },
  { id: 'spar', who: 'bram', title: 'A friendly spar', note: 'Practice once with Bram.', need: 1, get: (s) => s.people.bram?.hangs || 0, rewardF: 4, rewardR: 8 },
  { id: 'stroll', who: 'sable', title: 'Evening stroll', note: 'Walk the lake talk with Sable.', need: 1, get: (s) => s.people.sable?.hangs || 0, rewardF: 8, rewardR: 4 },
];

const NEEDS = [
  { item: 'herb', title: 'A moss sprig', note: 'One herb picked in a hex.', who: 'maren' },
  { item: 'trout', title: 'One creek trout', note: 'A trout from Long Lake. Pays respect.', who: 'sable' },
  { item: 'eel', title: 'A violet eel', note: 'An evening fish from the glowing water.', who: 'sable' },
  { item: 'tusk', title: 'A boar tusk', note: 'A drop from a hex fight.', who: 'bram' },
  { item: 'wick', title: 'A lantern wick', note: 'A crafted bit from a hearth hex.', who: 'lumen' },
];
function bagCount(item) {
  if (item === 'herb') return herbs();
  if (item === 'trout') return fishCount('trout');
  if (item === 'eel') return fishCount('eel') + fishCount('glowfin') + fishCount('lantern');
  try { return JSON.parse(localStorage.getItem('aro-beast-drops') || '{}')[item] || 0; } catch { return 0; }
}
function pickBoard(seed) {
  const fish = REQUESTS.filter((r) => r.id === 'trout' || r.id === 'anyfish' || r.id === 'lantern');
  const hang = REQUESTS.filter((r) => r.id === 'tea' || r.id === 'spar' || r.id === 'stroll');
  const chosen = [
    fish[seed % fish.length],
    REQUESTS.find((r) => r.id === 'herb'),
    REQUESTS.find((r) => r.id === 'hex'),
    hang[seed % hang.length],
  ];
  const rest = REQUESTS.filter((r) => !chosen.includes(r));
  chosen.push(rest[(seed + 2) % rest.length]);
  return chosen;
}

function hideQuest(on) {
  const q = document.getElementById('quest');
  if (q) q.style.visibility = on ? 'hidden' : '';
}

export function createHub(hooks = {}) {
  let data = state();
  let who = null;
  let lastLine = '';

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
      p && (data.people[p.id].hangs += 1);
      persist();
      lastLine = `${p.name} takes the gift. +12 friendship, +6 respect.`;
      renderHome();
      return;
    }
    const word = kind === 'tea' ? 'The tea is shared. The room goes quiet in a good way.' : kind === 'stroll' ? 'You walk the long way by the water and talk little.' : 'A short spar. Neither of you is showing off.';
    data.people[p.id].hangs += 1;
    bump(p.id, kind === 'spar' ? 4 : 8, kind === 'spar' ? 7 : 4, kind === 'spar' ? 'keen' : 'cozy');
    lastLine = `${word} +friendship, +respect.`;
    renderHome();
  }

  function ensureNeed() {
    const now = Date.now();
    if (!data.need || data.need.until < now) {
      const pick = NEEDS[Math.floor(Math.random() * NEEDS.length)];
      data.need = { item: pick.item, title: pick.title, note: pick.note, who: pick.who, until: now + 90000 };
      persist();
    }
    return data.need;
  }
  function renderBoard() {
    const list = document.getElementById('crewList');
    const rank = document.getElementById('crewRank');
    if (rank) rank.textContent = `Respect · ${crewName(data.respect)} · ${data.respect}`;
    if (!list) return;
    const need = ensureNeed();
    const left = Math.max(0, Math.ceil((need.until - Date.now()) / 1000));
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const haveNeed = bagCount(need.item);
    const needPerson = PEOPLE.find((p) => p.id === need.who);
    const needReady = haveNeed >= 1 && !data.done[`need:${need.until}`];
    const needDone = !!data.done[`need:${need.until}`];
    const pins = pickBoard(data.boardSeed);
    const randomPin = `<div class="pin"><b>${need.title}</b><br>${needPerson.name} · ${need.note}<br>${Math.min(1, haveNeed)}/1 · ${clock} left · +10 respect · bonus +6<br>${needDone ? 'Turned in.' : `<button type="button" data-turn="random" ${needReady ? '' : 'disabled'}>${needReady ? 'Turn in' : 'In progress'}</button>`}</div>`;
    list.innerHTML = randomPin + pins.map((pin) => {
      const person = PEOPLE.find((p) => p.id === pin.who);
      const have = Math.min(pin.need, pin.get(data));
      const ready = have >= pin.need && !data.done[`${data.boardSeed}:${pin.id}`];
      const turned = !!data.done[`${data.boardSeed}:${pin.id}`];
      return `<div class="pin"><b>${pin.title}</b><br>${person.name} · ${pin.note}<br>${have}/${pin.need} · +${pin.rewardR} respect · +${pin.rewardF} friendship${turned ? '<br>Turned in.' : ''}<br>${turned ? '' : `<button type="button" data-turn="${pin.id}" ${ready ? '' : 'disabled'}>${ready ? 'Turn in' : 'In progress'}</button>`}</div>`;
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
    const pin = REQUESTS.find((r) => r.id === id);
    if (!pin) return;
    const key = `${data.boardSeed}:${pin.id}`;
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
  function openBoard() {
    data = state();
    document.getElementById('menu') && (document.getElementById('menu').hidden = true);
    document.getElementById('crew').hidden = false;
    document.getElementById('home').hidden = true;
    const travel = document.getElementById('board');
    if (travel) travel.hidden = true;
    hideQuest(true);
    renderBoard();
  }
  function closeAll() {
    document.getElementById('home').hidden = true;
    document.getElementById('crew').hidden = true;
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
  document.getElementById('crewRefresh')?.addEventListener('pointerup', (e) => {
    data.boardSeed += 1;
    persist();
    renderBoard();
    e.preventDefault();
    e.stopPropagation();
  });

  return { openHome, openBoard, reply, act, turnIn, closeAll, get who() { return who; }, set who(v) { who = v; }, get lastLine() { return lastLine; }, people: PEOPLE };
}
