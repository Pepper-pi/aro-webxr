/* One saved profile. Coins, tokens, CELLs, potions, pets, and the collection book. */
const KEY = 'aro.profile.v1';
const SHOP = [
  { id: 'cell', name: 'CELL refill', price: 12, key: 'cells' },
  { id: 'potion', name: 'Mana potion', price: 8, key: 'potions' },
  { id: 'treat', name: 'Pet treat', price: 5, key: 'treats' },
  { id: 'cosmetic', name: 'Glow trace', price: 20, key: 'cosmetic' },
];
const PRIZES = [
  { id: 'sticker', name: 'Dock sticker', price: 2 },
  { id: 'snack', name: 'Honey snack', price: 3 },
  { id: 'trinket', name: 'Glow trinket', price: 5 },
];

function blank() {
  return {
    coins: 40, tokens: 6, xp: 0, cls: '',
    cells: 2, potions: 2, treats: 0, cosmetic: '', buff: '',
    loadout: { mage: ['ember', 'frost', 'nova'], gunner: ['shot', 'frag', 'turret'] },
    fieldWins: 0, captures: 0, raidDate: '', friendRaid: '',
    friends: {},
    quests: null,
    pets: [{ id: 'pip', species: 'pip', name: 'Pip', note: 'Honey carbuncle', level: 1, xp: 0, bond: 0, active: true }],
    pins: [], bonds: { taps: 0, tier: 0, collected: [] }, catches: [], prizes: [],
  };
}
let state = null;

function load() {
  if (state) return state;
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  const existed = !!raw;
  try { state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
  const savedCells = state && typeof state.cells === 'number' ? state.cells : null;
  const fresh = !state || typeof state.coins !== 'number';
  if (fresh) state = blank();
  if (!Array.isArray(state.pets) || !state.pets.length) state.pets = blank().pets;
  state.pets = state.pets.map(p => ({
    id: p.id, species: p.species || p.id, name: p.name || 'Pet', note: p.note || '',
    level: p.level || 1, xp: p.xp || 0, bond: p.bond || 0, active: !!p.active,
  }));
  if (!state.pets.some(p => p.active)) state.pets[0].active = true;
  if (!Array.isArray(state.pins)) state.pins = [];
  if (!state.bonds || !Array.isArray(state.bonds.collected)) state.bonds = { taps: 0, tier: 0, collected: [] };
  if (!Array.isArray(state.catches)) state.catches = [];
  if (typeof state.buff !== 'string') state.buff = '';
  if (typeof state.fishXp !== 'number') state.fishXp = 0;
  if (!state.loadout || typeof state.loadout !== 'object') state.loadout = { mage: ['ember', 'frost', 'nova'], gunner: ['shot', 'frag', 'turret'] };
  if (!Array.isArray(state.loadout.mage) || !state.loadout.mage.length) state.loadout.mage = ['ember', 'frost', 'nova'];
  if (!Array.isArray(state.loadout.gunner) || !state.loadout.gunner.length) state.loadout.gunner = ['shot', 'frag', 'turret'];
  if (!Array.isArray(state.prizes)) state.prizes = [];
  if (state.cls !== 'mage' && state.cls !== 'gunner') state.cls = '';
  if (!existed) state.cells = 3;
  else if (savedCells != null) state.cells = savedCells;
  else if (typeof state.cells !== 'number') state.cells = 2;
  if (typeof state.fieldWins !== 'number') state.fieldWins = 0;
  if (typeof state.captures !== 'number') state.captures = 0;
  if (typeof state.raidDate !== 'string') state.raidDate = '';
  if (typeof state.friendRaid !== 'string') state.friendRaid = '';
  if (!state.friends || typeof state.friends !== 'object') state.friends = {};
  const guideSteps = ['class', 'fish', 'out', 'fight', 'home', 'done'];
  if (fresh && !existed) state.guide = 'class';
  else if (guideSteps.indexOf(state.guide) < 0) state.guide = 'done';
  try {
    const oldPins = JSON.parse(localStorage.getItem('aro.world.pins') || '[]');
    if (Array.isArray(oldPins) && oldPins.length && !state.pins.length) state.pins = oldPins.slice(0, 8);
  } catch (e) { /* keep the profile pins */ }
  try {
    const oldBond = JSON.parse(localStorage.getItem('aro.home.gold.bond') || 'null');
    if (oldBond && oldBond.taps && !state.bonds.taps) state.bonds = { taps: oldBond.taps, tier: oldBond.tier || 0, collected: oldBond.collected || [] };
  } catch (e) { /* keep the profile bond */ }
  save();
  return state;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  paintPurse();
  return state;
}
function todayKey() {
  const look = window.__world && window.__world.look && window.__world.look();
  if (look && look.date) return look.date;
  const d = new Date();
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
function playerLevel(xp) {
  let level = 1;
  let rest = xp || 0;
  while (rest >= level * 20) {
    rest -= level * 20;
    level += 1;
  }
  return { level, rest, need: level * 20 };
}
function paintPurse() {
  const el = document.getElementById('spinePurse');
  const lvEl = document.getElementById('spineLevel');
  if (!state) return;
  const lv = playerLevel(state.xp);
  if (el) el.textContent = state.coins + ' coins · ' + state.tokens + ' tokens';
  if (lvEl) lvEl.textContent = 'Lv ' + lv.level + ' · ' + lv.rest + '/' + lv.need;
}
function showLevel(n) {
  let el = document.getElementById('levelPop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'levelPop';
    document.body.appendChild(el);
  }
  el.textContent = 'Level ' + n;
  el.classList.add('on');
  clearTimeout(showLevel.timer);
  showLevel.timer = setTimeout(() => el.classList.remove('on'), 1200);
}
function addXp(n) {
  load();
  const before = playerLevel(state.xp).level;
  state.xp += n;
  const after = playerLevel(state.xp);
  if (after.level > before) showLevel(after.level);
  return after;
}
const QUEST_POOL = [
  { id: 'fish', name: 'Catch a fish', need: 1, coins: 8, tokens: 0 },
  { id: 'fights', name: 'Win 2 field fights', need: 2, coins: 10, tokens: 1 },
  { id: 'capture', name: 'Capture a pet', need: 1, coins: 8, tokens: 1 },
  { id: 'raid', name: 'Clear the raid', need: 1, coins: 12, tokens: 2 },
];
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function ensureQuests() {
  load();
  const date = todayKey();
  if (state.quests && state.quests.date === date && Array.isArray(state.quests.ids) && state.quests.ids.length === 3) return state.quests;
  const look = window.__world && window.__world.look && window.__world.look();
  const rng = mulberry((look && look.seed) || 1);
  const pool = QUEST_POOL.map(q => q.id);
  const ids = [];
  while (ids.length < 3 && pool.length) {
    const j = Math.floor(rng() * pool.length);
    ids.push(pool.splice(j, 1)[0]);
  }
  state.quests = { date, ids, claimed: [] };
  save();
  return state.quests;
}
function friendLevel(points) {
  let level = 1;
  let rest = points || 0;
  while (rest >= 2) { rest -= 2; level += 1; }
  return { level, rest, need: 2 };
}
function friendList() {
  load();
  return Object.keys(state.friends).map(id => {
    const f = state.friends[id];
    const lv = friendLevel(f.points || 0);
    return { id, name: f.name || id, points: f.points || 0, level: lv.level, rest: lv.rest, need: lv.need, talked: f.talked || '' };
  });
}
function visitor() {
  return friendList().find(f => f.level >= 3) || null;
}
function talkFriend(id, name) {
  load();
  const today = todayKey();
  const cur = state.friends[id] || { name: name || id, points: 0, talked: '' };
  cur.name = name || cur.name;
  if (cur.talked === today) { state.friends[id] = cur; save(); return { talked: false, level: friendLevel(cur.points).level }; }
  cur.points += 1;
  cur.talked = today;
  state.friends[id] = cur;
  save();
  return { talked: true, level: friendLevel(cur.points).level };
}
function giveFriendTreat(id) {
  load();
  const cur = state.friends[id];
  if (!cur || !(state.treats > 0)) return false;
  state.treats--;
  cur.points += 1;
  save();
  return friendLevel(cur.points);
}
function questCount(id) {
  if (id === 'fish') return state.catches.length;
  if (id === 'fights') return state.fieldWins || 0;
  if (id === 'capture') return state.captures || 0;
  if (id === 'raid') return state.raidDate === todayKey() ? 1 : 0;
  if (id === 'friend') return state.friendRaid === todayKey() ? 1 : 0;
  return 0;
}
function questRows() {
  const quests = ensureQuests();
  const rows = quests.ids.map(id => {
    const q = QUEST_POOL.find(x => x.id === id);
    const n = questCount(id);
    return { id, name: q.name, need: q.need, have: n, coins: q.coins, tokens: q.tokens, claimed: quests.claimed.indexOf(id) >= 0 };
  });
  const pal = visitor();
  if (pal) {
    rows.push({
      id: 'friend',
      name: 'Bring ' + pal.name + ' to the raid',
      need: 1,
      have: questCount('friend'),
      coins: 6,
      tokens: 1,
      claimed: quests.claimed.indexOf('friend') >= 0,
    });
  }
  return rows;
}
function claimQuest(id) {
  const rows = questRows();
  const row = rows.find(r => r.id === id);
  if (!row || row.claimed || row.have < row.need) return false;
  state.quests.claimed.push(id);
  state.coins += row.coins;
  state.tokens += row.tokens;
  save();
  return true;
}
function use(key) {
  load();
  if (!(state[key] > 0)) return false;
  state[key]--;
  save();
  return true;
}
function buy(item) {
  load();
  if (state.coins < item.price) return false;
  state.coins -= item.price;
  if (item.key === 'cosmetic') state.cosmetic = 'glow-trace';
  else state[item.key] = (state[item.key] || 0) + 1;
  save();
  return true;
}
function buyPrize(item) {
  load();
  if (state.tokens < item.price) return false;
  state.tokens -= item.price;
  state.prizes.push(item.name);
  save();
  return true;
}
function list(host, rows) {
  host.innerHTML = '';
  if (!rows.length) {
    const p = document.createElement('p');
    p.textContent = 'Nothing here yet';
    host.appendChild(p);
    return;
  }
  for (const row of rows) {
    const p = document.createElement('p');
    p.textContent = row;
    host.appendChild(p);
  }
}
function bookRows(tab) {
  load();
  if (tab === 'pins') {
    const pins = (window.__world && window.__world.pins ? window.__world.pins() : state.pins) || [];
    return pins.map(p => p.date + ' · ' + p.weather + ' · ' + Number(p.lat).toFixed(2) + ', ' + Number(p.lon).toFixed(2));
  }
  if (tab === 'bonds') {
    const b = state.bonds;
    const cards = (b.collected || []).map(id => id);
    return ['Bond taps ' + (b.taps || 0) + ' · tier ' + (b.tier || 0)].concat(cards.length ? cards : ['No cards yet']);
  }
  if (tab === 'catches') {
    const fl = fishProgress(state.fishXp || 0);
    const fish = state.catches.map(c => c.name + ' · ' + c.cm + ' cm · ' + (c.date || 'no date') + ' · ' + (c.weather || 'clear'));
    const kept = state.prizes.map(n => 'Prize · ' + n);
    const bonus = (fl.extraCasts ? ' · +1 cast' : '') + (fl.size ? ' · +' + fl.size + ' cm' : '');
    return ['Fishing Lv ' + fl.level + ' · ' + fl.rest + '/' + fl.need + bonus].concat(fish, kept);
  }
  return state.pets.map(p => petLine(p));
}
function fishProgress(xp) {
  let level = 1, rest = xp || 0, need = 8;
  while (rest >= need) { rest -= need; level++; need = level * 8; }
  return { level, rest, need, extraCasts: level >= 3 ? 1 : 0, size: level >= 2 ? (level - 1) * 2 : 0 };
}
function petLine(p) {
  return (p.active ? 'Active · ' : '') + p.name + ' · Lv ' + p.level + ' · bond ' + p.bond + ' · ' + p.xp + '/' + (p.level * 10) + ' xp';
}
function activePet() {
  load();
  return state.pets.find(p => p.active) || null;
}
function setActive(id) {
  load();
  state.pets.forEach(p => { p.active = p.id === id; });
  save();
}
function addPetXp(amount, bond) {
  const pet = activePet();
  if (!pet) return null;
  pet.xp += amount;
  if (bond) pet.bond += bond;
  while (pet.xp >= pet.level * 10) {
    pet.xp -= pet.level * 10;
    pet.level += 1;
  }
  return pet;
}
function giveTreat(id) {
  load();
  const pet = state.pets.find(p => p.id === id);
  if (!pet || !(state.treats > 0)) return false;
  state.treats--;
  pet.bond += 1;
  save();
  return true;
}
function addPet(species, name) {
  load();
  const pet = { id: species + '-' + (state.pets.length + 1), species, name: name || species, note: 'Caught', level: 1, xp: 0, bond: 0, active: true };
  state.pets.forEach(p => { p.active = false; });
  state.pets.push(pet);
  state.captures = (state.captures || 0) + 1;
  save();
  return pet;
}
function openBook(tab) {
  load();
  const panel = document.getElementById('spineBook');
  panel.classList.add('on');
  const lv = playerLevel(state.xp);
  const who = document.getElementById('spineYou');
  if (who) who.textContent = 'You · Lv ' + lv.level + ' · ' + lv.rest + '/' + lv.need + ' xp' + (state.cls ? ' · ' + state.cls : '');
  panel.dataset.tab = tab || panel.dataset.tab || 'pins';
  panel.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === panel.dataset.tab));
  const body = document.getElementById('spineBookBody');
  if (panel.dataset.tab === 'pets') renderPets(body);
  else if (panel.dataset.tab === 'friends') renderFriends(body);
  else list(body, bookRows(panel.dataset.tab));
}
function renderFriends(host) {
  load();
  host.innerHTML = '';
  const rows = friendList();
  if (!rows.length) {
    const p = document.createElement('p');
    p.textContent = 'Talk to someone on the map. A treat raises friendship too.';
    host.appendChild(p);
    return;
  }
  for (const f of rows) {
    const title = document.createElement('p');
    title.textContent = f.name + ' · Lv ' + f.level + ' · ' + f.rest + '/' + f.need + (f.level >= 3 ? ' · visits' : '');
    const treat = document.createElement('button');
    treat.type = 'button';
    treat.textContent = 'Give treat · ' + state.treats + ' left';
    treat.onclick = () => { giveFriendTreat(f.id); openBook('friends'); };
    host.appendChild(title);
    host.appendChild(treat);
  }
}
function renderPets(host) {
  load();
  host.innerHTML = '';
  for (const pet of state.pets) {
    const row = document.createElement('div');
    const title = document.createElement('p');
    title.textContent = petLine(pet);
    row.appendChild(title);
    const set = document.createElement('button');
    set.type = 'button';
    set.textContent = pet.active ? 'Active' : 'Set active';
    set.onclick = () => { setActive(pet.id); openBook('pets'); };
    const treat = document.createElement('button');
    treat.type = 'button';
    treat.textContent = 'Give treat · ' + state.treats + ' left';
    treat.onclick = () => { giveTreat(pet.id); openBook('pets'); };
    row.appendChild(set);
    row.appendChild(treat);
    host.appendChild(row);
  }
}
const table = { pet: '', foe: 4, you: 0, done: false };
function boardStrike() {
  load();
  const pet = activePet();
  if (!pet) return { win: false, reason: 'none' };
  if (table.pet !== pet.id || table.done) {
    table.pet = pet.id;
    table.foe = 4;
    table.you = 4 + pet.level;
    table.done = false;
  }
  if (table.you <= 0) return { win: false, reason: 'ko', you: table.you, foe: table.foe };
  table.foe = Math.max(0, table.foe - 2);
  if (table.foe > 0) table.you = Math.max(0, table.you - 1);
  if (table.foe <= 0) {
    const grown = addPetXp(3, 1);
    state.tokens += 2;
    save();
    table.done = true;
    return { win: true, name: grown.name, level: grown.level, bond: grown.bond };
  }
  if (table.you <= 0) return { win: false, reason: 'ko', you: table.you, foe: table.foe };
  return { win: false, reason: 'hit', you: table.you, foe: table.foe };
}
function openBoard() {
  load();
  const panel = document.getElementById('spineBoard');
  panel.classList.add('on');
  const pet = activePet();
  const foe = { name: 'Drill slime', hp: 4, max: 4 };
  const you = { hp: pet ? 4 + pet.level : 0, max: pet ? 4 + pet.level : 0 };
  const log = document.getElementById('spineBoardLog');
  const title = document.getElementById('spineBoardWho');
  title.textContent = pet ? pet.name + ' vs ' + foe.name : 'No active pet';
  const paint = () => {
    log.textContent = pet
      ? pet.name + ' ' + you.hp + '/' + you.max + ' · ' + foe.name + ' ' + foe.hp + '/' + foe.max
      : 'Set an active pet in the book first.';
  };
  paint();
  const strike = document.getElementById('spineBoardStrike');
  strike.onclick = () => {
    if (!pet || you.hp <= 0 || foe.hp <= 0) return;
    foe.hp = Math.max(0, foe.hp - 2);
    if (foe.hp > 0) you.hp = Math.max(0, you.hp - 1);
    if (foe.hp <= 0) {
      const grown = addPetXp(3, 1);
      state.tokens += 2;
      save();
      log.textContent = 'Win · ' + grown.name + ' Lv ' + grown.level + ' · bond ' + grown.bond + ' · +2 tokens';
      return;
    }
    if (you.hp <= 0) { log.textContent = 'The drill slime holds the board.'; return; }
    paint();
  };
}
function openShop(who) {
  load();
  const panel = document.getElementById('spineShop');
  panel.classList.add('on');
  document.getElementById('spineShopWho').textContent = (who && who.name) || 'Vendor';
  document.getElementById('spineShopLine').textContent = (who && who.line) || 'Fixed prices. No surprises.';
  const box = document.getElementById('spineShopList');
  box.innerHTML = '';
  for (const item of SHOP) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.name + ' · ' + item.price + ' coins';
    b.onclick = () => {
      const ok = buy(item);
      document.getElementById('spineShopNote').textContent = ok ? 'Bought ' + item.name : 'Not enough coins';
      paintPurse();
    };
    box.appendChild(b);
  }
}
function openArcade() {
  load();
  const panel = document.getElementById('spineArcade');
  panel.classList.add('on');
  const box = document.getElementById('spineArcadeList');
  box.innerHTML = '';
  for (const item of PRIZES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.name + ' · ' + item.price + ' tokens';
    b.onclick = () => {
      const ok = buyPrize(item);
      document.getElementById('spineArcadeNote').textContent = ok ? 'Took ' + item.name : 'Not enough tokens';
    };
    box.appendChild(b);
  }
}
function mount() {
  const style = document.createElement('style');
  style.textContent = [
    '#spinePurse{position:fixed;right:12px;top:calc(46px + env(safe-area-inset-top,0px));z-index:18;display:none;padding:6px 10px;border-radius:999px;background:rgba(42,24,16,.92);border:1px solid rgba(226,196,138,.75);color:#f6e2c4;font:800 12px sans-serif;pointer-events:none}',
    'body.out-combat #spinePurse,body.field-on #spinePurse{display:block}',
    '#spineLevel{position:fixed;left:12px;top:calc(46px + env(safe-area-inset-top,0px));z-index:18;display:none;padding:6px 10px;border-radius:999px;background:rgba(42,24,16,.92);border:1px solid rgba(255,211,106,.8);color:#ffe7a8;font:800 13px sans-serif;pointer-events:none}',
    'body.out-combat #spineLevel,body.field-on #spineLevel{display:block}',
    '#spineBookBtn{position:fixed;left:12px;top:calc(96px + env(safe-area-inset-top,0px));z-index:16;display:none;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(226,196,138,.7);background:rgba(42,24,16,.92);color:#f6e2c4;font:800 13px sans-serif}',
    'body.out-combat #spineBookBtn{display:block}',
    '#spineBook,#spineShop,#spineArcade,#spineBoard{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;display:none;width:min(92vw,420px);max-height:min(78vh,560px);overflow:auto;padding:14px;border-radius:16px;background:#24160f;border:1px solid rgba(226,196,138,.8);color:#f6e2c4;font:700 14px/1.4 sans-serif}',
    '#spineBook.on,#spineShop.on,#spineArcade.on,#spineBoard.on{display:block}',
    '#spineBook button,#spineShop button,#spineArcade button,#spineBoard button{display:block;width:100%;min-height:44px;margin:8px 0 0;padding:8px 10px;border-radius:12px;border:1px solid rgba(226,196,138,.55);background:#3a2618;color:#f6e2c4;font:800 14px sans-serif}',
    '#catchChip{position:fixed;left:50%;top:calc(78px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:18;display:none;padding:6px 12px;border-radius:999px;background:rgba(18,32,28,.92);border:1px solid rgba(120,220,160,.8);color:#e7fff2;font:800 13px sans-serif;pointer-events:none}',
    '#levelPop{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:45;display:none;padding:14px 22px;border-radius:16px;background:rgba(42,24,16,.94);border:1px solid rgba(255,211,106,.9);color:#ffe7a8;font:800 28px sans-serif}',
    '#levelPop.on{display:block}',
    '#homeClass.on{outline:2px solid #ffd36a}',
    '#spineTabs{display:flex;gap:6px}',
    '#spineTabs button{width:auto;flex:1;margin:0}',
    '#spineTabs button.on{background:#6a4524}',
    '#spineBookBody p,#spineShop p,#spineArcade p{margin:8px 0}',
  ].join('');
  document.head.appendChild(style);
  const purse = document.createElement('div');
  purse.id = 'spinePurse';
  document.body.appendChild(purse);
  const level = document.createElement('div');
  level.id = 'spineLevel';
  document.body.appendChild(level);
  const bookBtn = document.createElement('button');
  bookBtn.id = 'spineBookBtn';
  bookBtn.type = 'button';
  bookBtn.textContent = 'Collection';
  bookBtn.onclick = () => openBook('pins');
  document.body.appendChild(bookBtn);
  const book = document.createElement('div');
  book.id = 'spineBook';
  book.dataset.tab = 'pins';
  book.innerHTML = '<b>Collection</b><p id="spineYou"></p><div id="spineTabs"></div><div id="spineBookBody"></div><button type="button" id="spineBookClose">Close</button>';
  document.body.appendChild(book);
  const tabs = book.querySelector('#spineTabs');
  for (const tab of ['pins', 'bonds', 'catches', 'pets', 'friends']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tab = tab;
    b.textContent = tab[0].toUpperCase() + tab.slice(1);
    b.onclick = () => openBook(tab);
    tabs.appendChild(b);
  }
  book.querySelector('#spineBookClose').onclick = () => book.classList.remove('on');
  const shop = document.createElement('div');
  shop.id = 'spineShop';
  shop.innerHTML = '<b id="spineShopWho">Vendor</b><p id="spineShopLine"></p><div id="spineShopList"></div><p id="spineShopNote"></p><button type="button" id="spineShopClose">Close</button>';
  document.body.appendChild(shop);
  shop.querySelector('#spineShopClose').onclick = () => shop.classList.remove('on');
  const arcade = document.createElement('div');
  arcade.id = 'spineArcade';
  arcade.innerHTML = '<b>Arcade shelf</b><p>Fixed prices. What is posted is what you get.</p><div id="spineArcadeList"></div><p id="spineArcadeNote"></p><button type="button" id="spineArcadeClose">Close</button>';
  document.body.appendChild(arcade);
  arcade.querySelector('#spineArcadeClose').onclick = () => arcade.classList.remove('on');
  const board = document.createElement('div');
  board.id = 'spineBoard';
  board.innerHTML = '<b id="spineBoardWho">Pet board</b><p id="spineBoardLog">Strike deals 2. The drill slime strikes back for 1. No surprises.</p><button type="button" id="spineBoardStrike">Strike</button><button type="button" id="spineBoardClose">Close</button>';
  document.body.appendChild(board);
  board.querySelector('#spineBoardClose').onclick = () => board.classList.remove('on');
  load();
  window.__profile = {
    get: () => load(),
    use,
    buy,
    grantWin: () => { load(); state.coins += 12; state.fieldWins = (state.fieldWins || 0) + 1; const lv = addXp(6); const pet = addPetXp(8, 0); save(); if (window.__guideBeat) window.__guideBeat('fight'); return { coins: 12, xp: 6, total: state.coins, pet, level: lv.level }; },
    grantRaid: () => { load(); state.coins += 24; state.tokens += 4; state.cells += 1; state.raidDate = todayKey(); const lv = addXp(16); save(); return { coins: 24, tokens: 4, cells: 1, level: lv.level }; },
    addXp: (n) => { const lv = addXp(n); save(); return lv; },
    level: () => { load(); return playerLevel(state.xp); },
    setClass: (c) => { load(); state.cls = c === 'gunner' ? 'gunner' : 'mage'; save(); return state.cls; },
    guide: () => { load(); return state.guide || 'done'; },
    setGuide: (step) => {
      load();
      const steps = ['class', 'fish', 'out', 'fight', 'home', 'done'];
      if (steps.indexOf(step) < 0) return state.guide;
      state.guide = step;
      save();
      return state.guide;
    },
    raidCleared: () => { load(); return state.raidDate === todayKey(); },
    talk: talkFriend,
    giveFriendTreat,
    visitor,
    noteFriendRaid: () => { load(); state.friendRaid = todayKey(); save(); },
    quests: questRows,
    claimQuest,
    openBook, openShop, openArcade, openBoard, boardStrike,
    takePrize: (id) => {
      load();
      const item = PRIZES.find(p => p.id === id);
      const ok = item ? buyPrize(item) : false;
      if (ok && window.__home && window.__home.refreshPrize) window.__home.refreshPrize();
      return ok;
    },
    active: activePet,
    addPet, setActive, giveTreat,
    notePin: (pin) => { load(); state.pins = [pin].concat(state.pins).slice(0, 8); save(); },
    noteBond: (b) => { load(); state.bonds = { taps: b.taps || 0, tier: b.tier || 0, collected: (b.collected || []).slice() }; save(); },
    catches: () => { load(); return state.catches.slice(); },
    takeBuff: () => { load(); const name = state.buff || ''; if (name) { state.buff = ''; save(); } return name; },
    loadout: (cls) => { load(); const key = cls === 'gunner' ? 'gunner' : 'mage'; return state.loadout[key].slice(); },
    setLoadout: (cls, ids) => {
      load();
      const key = cls === 'gunner' ? 'gunner' : 'mage';
      const allow = key === 'gunner' ? ['shot', 'frag', 'turret', 'drone', 'flare'] : ['ember', 'frost', 'nova', 'iceberg', 'slash', 'ward'];
      const clean = (ids || []).filter(id => allow.indexOf(id) >= 0).slice(0, 3);
      if (clean.length) state.loadout[key] = clean;
      save();
      return state.loadout[key].slice();
    },
    fishLevel: () => { load(); return fishProgress(state.fishXp || 0); },
    toggleLoadout: (cls, id) => {
      load();
      const key = cls === 'gunner' ? 'gunner' : 'mage';
      const allow = key === 'gunner' ? ['shot', 'frag', 'turret', 'drone', 'flare'] : ['ember', 'frost', 'nova', 'iceberg', 'slash', 'ward'];
      if (allow.indexOf(id) < 0) return state.loadout[key].slice();
      const cur = state.loadout[key].slice();
      const at = cur.indexOf(id);
      if (at >= 0) { if (cur.length > 1) cur.splice(at, 1); }
      else { if (cur.length >= 3) cur.shift(); cur.push(id); }
      state.loadout[key] = cur;
      save();
      return cur.slice();
    },
    cookCatch: (index, kind) => {
      load();
      const fish = state.catches[index | 0];
      if (!fish) return { ok: false, reason: 'none' };
      state.catches.splice(index | 0, 1);
      if (kind === 'treat') {
        state.treats += 1;
        save();
        return { ok: true, kind: 'treat', name: fish.name, treats: state.treats };
      }
      state.coins += 6;
      state.buff = 'Honey plate';
      save();
      return { ok: true, kind: 'meal', name: fish.name, coins: state.coins, buff: state.buff };
    },
    addCatch: (fish) => {
      load();
      const look = window.__world && window.__world.look && window.__world.look();
      state.catches.push({
        name: fish.n || fish.name || 'Fish',
        cm: fish.cm || 0,
        date: fish.date || (look && look.date) || new Date().toISOString().slice(0, 10),
        weather: fish.weather || (look && look.weather) || 'clear',
      });
      state.fishXp = (state.fishXp || 0) + 4;
      save();
      if (window.__guideBeat) window.__guideBeat('fish');
      return fishProgress(state.fishXp);
    },
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
