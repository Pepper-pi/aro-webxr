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
    coins: 40, tokens: 6, xp: 0,
    cells: 2, potions: 2, treats: 0, cosmetic: '',
    pets: [{ id: 'pip', species: 'pip', name: 'Pip', note: 'Honey carbuncle', level: 1, xp: 0, bond: 0, active: true }],
    pins: [], bonds: { taps: 0, tier: 0, collected: [] }, catches: [], prizes: [],
  };
}
let state = null;

function load() {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
  if (!state || typeof state.coins !== 'number') state = blank();
  if (!Array.isArray(state.pets) || !state.pets.length) state.pets = blank().pets;
  state.pets = state.pets.map(p => ({
    id: p.id, species: p.species || p.id, name: p.name || 'Pet', note: p.note || '',
    level: p.level || 1, xp: p.xp || 0, bond: p.bond || 0, active: !!p.active,
  }));
  if (!state.pets.some(p => p.active)) state.pets[0].active = true;
  if (!Array.isArray(state.pins)) state.pins = [];
  if (!state.bonds || !Array.isArray(state.bonds.collected)) state.bonds = { taps: 0, tier: 0, collected: [] };
  if (!Array.isArray(state.catches)) state.catches = [];
  if (!Array.isArray(state.prizes)) state.prizes = [];
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
function paintPurse() {
  const el = document.getElementById('spinePurse');
  if (!el || !state) return;
  el.textContent = state.coins + ' coins · ' + state.tokens + ' tokens';
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
    const fish = state.catches.map(c => c.name + ' · ' + c.cm + ' cm');
    const kept = state.prizes.map(n => 'Prize · ' + n);
    return fish.concat(kept);
  }
  return state.pets.map(p => petLine(p));
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
  save();
  return pet;
}
function openBook(tab) {
  load();
  const panel = document.getElementById('spineBook');
  panel.classList.add('on');
  panel.dataset.tab = tab || panel.dataset.tab || 'pins';
  panel.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === panel.dataset.tab));
  const body = document.getElementById('spineBookBody');
  if (panel.dataset.tab === 'pets') renderPets(body);
  else list(body, bookRows(panel.dataset.tab));
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
    '#spineBookBtn{position:fixed;left:12px;top:calc(96px + env(safe-area-inset-top,0px));z-index:16;display:none;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(226,196,138,.7);background:rgba(42,24,16,.92);color:#f6e2c4;font:800 13px sans-serif}',
    'body.out-combat #spineBookBtn{display:block}',
    '#spineBook,#spineShop,#spineArcade,#spineBoard{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;display:none;width:min(92vw,420px);max-height:min(78vh,560px);overflow:auto;padding:14px;border-radius:16px;background:#24160f;border:1px solid rgba(226,196,138,.8);color:#f6e2c4;font:700 14px/1.4 sans-serif}',
    '#spineBook.on,#spineShop.on,#spineArcade.on,#spineBoard.on{display:block}',
    '#spineBook button,#spineShop button,#spineArcade button,#spineBoard button{display:block;width:100%;min-height:44px;margin:8px 0 0;padding:8px 10px;border-radius:12px;border:1px solid rgba(226,196,138,.55);background:#3a2618;color:#f6e2c4;font:800 14px sans-serif}',
    '#catchChip{position:fixed;left:50%;top:calc(78px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:18;display:none;padding:6px 12px;border-radius:999px;background:rgba(18,32,28,.92);border:1px solid rgba(120,220,160,.8);color:#e7fff2;font:800 13px sans-serif;pointer-events:none}',
    '#spineTabs{display:flex;gap:6px}',
    '#spineTabs button{width:auto;flex:1;margin:0}',
    '#spineTabs button.on{background:#6a4524}',
    '#spineBookBody p,#spineShop p,#spineArcade p{margin:8px 0}',
  ].join('');
  document.head.appendChild(style);
  const purse = document.createElement('div');
  purse.id = 'spinePurse';
  document.body.appendChild(purse);
  const bookBtn = document.createElement('button');
  bookBtn.id = 'spineBookBtn';
  bookBtn.type = 'button';
  bookBtn.textContent = 'Collection';
  bookBtn.onclick = () => openBook('pins');
  document.body.appendChild(bookBtn);
  const book = document.createElement('div');
  book.id = 'spineBook';
  book.dataset.tab = 'pins';
  book.innerHTML = '<b>Collection</b><div id="spineTabs"></div><div id="spineBookBody"></div><button type="button" id="spineBookClose">Close</button>';
  document.body.appendChild(book);
  const tabs = book.querySelector('#spineTabs');
  for (const tab of ['pins', 'bonds', 'catches', 'pets']) {
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
    grantWin: () => { load(); state.coins += 12; state.xp += 6; const pet = addPetXp(8, 0); save(); return { coins: 12, xp: 6, total: state.coins, pet }; },
    openBook, openShop, openArcade, openBoard,
    active: activePet,
    addPet, setActive, giveTreat,
    notePin: (pin) => { load(); state.pins = [pin].concat(state.pins).slice(0, 8); save(); },
    noteBond: (b) => { load(); state.bonds = { taps: b.taps || 0, tier: b.tier || 0, collected: (b.collected || []).slice() }; save(); },
    addCatch: (fish) => { load(); state.catches.push({ name: fish.n || fish.name || 'Fish', cm: fish.cm || 0 }); save(); },
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
