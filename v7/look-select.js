/* First hang of the roster. Plates are crops of the locked reference sheets.
   Mage and Gunner are the classes this build already runs. Hunter and Summoner are not a slot here. */
(function () {
  const SHEET = {
    slimes: 'looks/slimes.jpg',
    gold: 'looks/gold-hair.jpg',
    elves: 'looks/elves-v2.jpg',
    humans: 'looks/humans.jpg',
    cheebs: 'looks/cheebs.jpg',
    kemo: 'looks/minks-fox.jpg',
    core: 'looks/shrooms-core.jpg',
    girls: 'looks/shroom-girls.jpg',
    people: 'looks/shroom-people.jpg',
    bigger: 'looks/shrooms-bigger.jpg',
    goblins: 'looks/goblins.jpg',
    pinup: 'looks/cap-princess.jpg',
  };
  const RACES = [
    { id: 'human', label: 'Human', note: 'Coats and twin-tails from the human lineup. The black swordsman on that sheet is not a look.' },
    { id: 'elf', label: 'Elf', note: 'Elves v2. The female is still a little close to another story’s elf. Locked close enough for this hang.' },
    { id: 'slime', label: 'Slime', note: 'Simple slime face: no human nose, a forehead gem, a tiny smile, glossy skin. Gold hair colors are extra flavors, not stand-ins for Honey, Boba, Citrine, or Lime.' },
    { id: 'mink', label: 'Mink', note: 'First neon-district pair. Furred. A smoother-skin version can come later. It does not replace these.' },
    { id: 'fox', label: 'Fox', note: 'Foxes from the same kemono sheet. Rabbits on that sheet are not a finished race.' },
    { id: 'goblin', label: 'Goblin', note: 'Big male, a mid archer, and a smaller hooded shortstack.' },
    { id: 'shroom', label: 'Shroom', note: 'Small dumpling body. The cap is the head. Bead eyes. Hair can come out from under the cap. Bigger forms are the tanky ones.' },
    { id: 'cheeb', label: 'Cheeb', note: 'Style A, Style B with horns, and Beatrice-hair. The hair is only a hairstyle. Cheebs stay clothed.' },
    { id: 'princess', label: 'Cap princess', note: 'Temporary concept plate. The painted pinup is not final in-game art. The cap stays on. It is part of her, not a hat you equip.' },
  ];
  const LOOKS = [
    { id: 'human-brown', race: 'human', name: 'Brown coat', sheet: SHEET.humans, x: 18, y: 70, w: 140, h: 620 },
    { id: 'human-dark', race: 'human', name: 'Dark coat', sheet: SHEET.humans, x: 312, y: 70, w: 150, h: 620 },
    { id: 'human-blue', race: 'human', name: 'Blue twins', sheet: SHEET.humans, x: 624, y: 80, w: 140, h: 600 },
    { id: 'human-pink', race: 'human', name: 'Pink twins', sheet: SHEET.humans, x: 774, y: 80, w: 150, h: 600 },
    { id: 'elf-f', race: 'elf', name: 'Female', sheet: SHEET.elves, x: 70, y: 90, w: 200, h: 540 },
    { id: 'elf-m', race: 'elf', name: 'Male', sheet: SHEET.elves, x: 680, y: 100, w: 220, h: 530 },
    { id: 'slime-male-gold', race: 'slime', name: 'Male Gold', sheet: SHEET.slimes, x: 40, y: 90, w: 200, h: 540 },
    { id: 'slime-honey', race: 'slime', name: 'Honey', sheet: SHEET.slimes, x: 280, y: 90, w: 210, h: 540 },
    { id: 'slime-boba', race: 'slime', name: 'Boba', sheet: SHEET.slimes, x: 530, y: 90, w: 200, h: 540 },
    { id: 'slime-citrine', race: 'slime', name: 'Citrine', sheet: SHEET.slimes, x: 770, y: 90, w: 200, h: 540 },
    { id: 'slime-lime', race: 'slime', name: 'Lime', sheet: SHEET.slimes, x: 1020, y: 90, w: 220, h: 540 },
    { id: 'gold-classic', race: 'slime', name: 'Classic Gold', sheet: SHEET.gold, x: 24, y: 110, w: 180, h: 520 },
    { id: 'gold-copper', race: 'slime', name: 'Copper Waves', sheet: SHEET.gold, x: 230, y: 110, w: 180, h: 520 },
    { id: 'gold-mercury', race: 'slime', name: 'Mercury Bob', sheet: SHEET.gold, x: 430, y: 110, w: 170, h: 520 },
    { id: 'gold-caramel', race: 'slime', name: 'Caramel Braids', sheet: SHEET.gold, x: 630, y: 110, w: 180, h: 520 },
    { id: 'gold-rose', race: 'slime', name: 'Rose Pony', sheet: SHEET.gold, x: 840, y: 100, w: 180, h: 530 },
    { id: 'gold-berry', race: 'slime', name: 'Berry Twins', sheet: SHEET.gold, x: 1055, y: 100, w: 200, h: 530 },
    { id: 'mink-kael', race: 'mink', name: 'Kael', sheet: SHEET.kemo, x: 20, y: 90, w: 210, h: 560 },
    { id: 'mink-lyra', race: 'mink', name: 'Lyra', sheet: SHEET.kemo, x: 220, y: 90, w: 220, h: 560 },
    { id: 'fox-front', race: 'fox', name: 'Fox front', sheet: SHEET.kemo, x: 450, y: 90, w: 210, h: 560 },
    { id: 'fox-three', race: 'fox', name: 'Fox three-quarter', sheet: SHEET.kemo, x: 660, y: 90, w: 210, h: 560 },
    { id: 'gob-big', race: 'goblin', name: 'Big male', sheet: SHEET.goblins, x: 700, y: 80, w: 170, h: 540 },
    { id: 'gob-mid', race: 'goblin', name: 'Mid archer', sheet: SHEET.goblins, x: 900, y: 200, w: 150, h: 420 },
    { id: 'gob-small', race: 'goblin', name: 'Small hood', sheet: SHEET.goblins, x: 1145, y: 280, w: 120, h: 360 },
    { id: 'shroom-red', race: 'shroom', name: 'Red cap', sheet: SHEET.core, x: 150, y: 70, w: 210, h: 270 },
    { id: 'shroom-chant', race: 'shroom', name: 'Chanterelle', sheet: SHEET.core, x: 780, y: 50, w: 220, h: 290 },
    { id: 'shroom-braids', race: 'shroom', name: 'Braids', sheet: SHEET.core, x: 560, y: 380, w: 220, h: 300 },
    { id: 'shroom-tea', race: 'shroom', name: 'Tea cup', sheet: SHEET.girls, x: 40, y: 80, w: 380, h: 580 },
    { id: 'shroom-plain', race: 'shroom', name: 'Plain dumpling', sheet: SHEET.people, x: 40, y: 80, w: 380, h: 580 },
    { id: 'shroom-tank', race: 'shroom', name: 'Tank vest', sheet: SHEET.bigger, x: 10, y: 140, w: 280, h: 520 },
    { id: 'shroom-tank-red', race: 'shroom', name: 'Tank spots', sheet: SHEET.bigger, x: 290, y: 140, w: 270, h: 520 },
    { id: 'pin-witchy', race: 'princess', name: 'Witchy', sheet: SHEET.pinup, x: 10, y: 70, w: 210, h: 560, concept: true },
    { id: 'pin-parasol', race: 'princess', name: 'Parasol', sheet: SHEET.pinup, x: 210, y: 70, w: 210, h: 560, concept: true },
    { id: 'pin-cluster', race: 'princess', name: 'Cluster', sheet: SHEET.pinup, x: 420, y: 70, w: 210, h: 560, concept: true },
    { id: 'pin-tilted', race: 'princess', name: 'Tilted', sheet: SHEET.pinup, x: 630, y: 70, w: 210, h: 560, concept: true },
    { id: 'pin-glow', race: 'princess', name: 'Glowing', sheet: SHEET.pinup, x: 840, y: 70, w: 210, h: 560, concept: true },
    { id: 'pin-steam', race: 'princess', name: 'Steampunk', sheet: SHEET.pinup, x: 1050, y: 70, w: 220, h: 560, concept: true },
    { id: 'cheeb-a', race: 'cheeb', name: 'Style A', sheet: SHEET.cheebs, x: 40, y: 40, w: 380, h: 640 },
    { id: 'cheeb-b', race: 'cheeb', name: 'Style B', sheet: SHEET.cheebs, x: 430, y: 40, w: 400, h: 640 },
    { id: 'cheeb-hair', race: 'cheeb', name: 'Beatrice-hair', sheet: SHEET.cheebs, x: 860, y: 40, w: 380, h: 640 },
  ];

  let race = 'human';
  let flavor = 'human-brown';
  let cls = 'mage';

  function lookById(id) { return LOOKS.filter(l => l.id === id)[0] || LOOKS[0]; }
  function paintPlate(el, look, box) {
    const scale = box / look.h;
    el.style.backgroundImage = 'url(' + look.sheet + ')';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundSize = (1280 * scale) + 'px ' + (720 * scale) + 'px';
    el.style.backgroundPosition = (-look.x * scale) + 'px ' + (-look.y * scale) + 'px';
    el.style.backgroundColor = '#f4f7fb';
    el.style.width = Math.round(look.w * scale) + 'px';
    el.style.height = box + 'px';
  }
  function selected() { return lookById(flavor); }

  function render() {
    const root = document.getElementById('lookPick');
    if (!root) return;
    root.querySelectorAll('[data-race]').forEach(b => b.classList.toggle('on', b.dataset.race === race));
    const raceMeta = RACES.filter(r => r.id === race)[0];
    root.querySelector('#lookNote').textContent = raceMeta ? raceMeta.note : '';
    const stage = root.querySelector('#lookStage');
    const cur = selected();
    if (cur.race !== race) {
      const first = LOOKS.filter(l => l.race === race)[0];
      if (first) flavor = first.id;
    }
    const show = selected();
    paintPlate(stage, show, 340);
    root.querySelector('#lookNamePlate').textContent = show.name + (show.concept ? ' · concept plate' : '');
    const row = root.querySelector('#lookFlavors');
    row.innerHTML = '';
    LOOKS.filter(l => l.race === race).forEach(l => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'look-flavor' + (l.id === flavor ? ' on' : '');
      b.title = l.name;
      const face = document.createElement('span');
      paintPlate(face, l, 72);
      const lab = document.createElement('b');
      lab.textContent = l.name;
      b.appendChild(face);
      b.appendChild(lab);
      b.onclick = () => { flavor = l.id; render(); };
      row.appendChild(b);
    });
    root.querySelectorAll('[data-cls]').forEach(b => b.classList.toggle('on', b.dataset.cls === cls));
    const banner = root.querySelector('#lookConcept');
    banner.hidden = race !== 'princess';
  }

  function applyLook() {
    const look = selected();
    const name = (document.getElementById('lookName').value || '').trim().slice(0, 18);
    if (window.__profile && window.__profile.setLook) window.__profile.setLook({ name: name, race: look.race, flavor: look.id, cls: cls });
    if (window.__cast && window.__cast.setBody) window.__cast.setBody(look.race === 'slime' ? 'slime' : 'human', look.id === 'slime-citrine' ? 'citrine' : 'boba');
    document.querySelectorAll('.race').forEach(b => {
      const slime = look.race === 'slime';
      b.classList.toggle('sel', (slime && b.dataset.r === 'slime') || (!slime && b.dataset.r === 'human'));
    });
    if (typeof setClass === 'function') setClass(cls);
    if (window.__profile && window.__profile.setClass) window.__profile.setClass(cls);
    const btn = document.getElementById('titleLook');
    if (btn) btn.textContent = name ? ('Your look · ' + name) : 'Your look';
    closeLook();
    if (typeof SFX !== 'undefined' && SFX.tap) SFX.tap();
  }

  function openLook() {
    const root = document.getElementById('lookPick');
    if (!root) return;
    const saved = window.__profile && window.__profile.look && window.__profile.look();
    if (saved && saved.flavor && lookById(saved.flavor).id === saved.flavor) {
      flavor = saved.flavor;
      race = lookById(flavor).race;
      if (saved.cls === 'gunner' || saved.cls === 'mage') cls = saved.cls;
      const input = document.getElementById('lookName');
      if (input && saved.name) input.value = saved.name;
    }
    root.classList.add('on');
    root.setAttribute('aria-hidden', 'false');
    render();
  }
  function closeLook() {
    const root = document.getElementById('lookPick');
    if (!root) return;
    root.classList.remove('on');
    root.setAttribute('aria-hidden', 'true');
  }

  function mount() {
    if (document.getElementById('lookPick')) return;
    const style = document.createElement('style');
    style.textContent = [
      '#titleLook{margin-top:8px}',
      '#lookPick{position:fixed;inset:0;z-index:80;display:none;overflow:auto;background:rgba(10,4,16,.82);color:#fff6ea;font-family:ui-rounded,system-ui,sans-serif}',
      '#lookPick.on{display:block}',
      '#lookCard{width:min(980px,calc(100% - 16px));margin:12px auto 28px;padding:14px;border-radius:22px;border:1px solid rgba(255,211,106,.75);background:linear-gradient(180deg,#2a1436,#140810);box-shadow:0 0 0 1px rgba(255,79,180,.35),0 18px 40px rgba(0,0,0,.45)}',
      '#lookCard h2{margin:0 0 8px;font-size:22px;letter-spacing:.04em;background:linear-gradient(180deg,#fff6d8,#ff8fca);-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#lookRaces,#lookFlavors{display:flex;gap:8px;overflow:auto;padding-bottom:6px}',
      '#lookRaces button,#lookCls button,.look-flavor{border:1px solid rgba(255,255,255,.18);background:#241428;color:#fff6ea;border-radius:14px;font-weight:800}',
      '#lookRaces button,#lookCls button{min-height:40px;padding:8px 12px}',
      '#lookRaces button.on,#lookCls button.on,.look-flavor.on{border-color:#ffd36a;box-shadow:0 0 12px rgba(255,211,106,.45);background:#3a2048}',
      '#lookBody{display:flex;gap:14px;align-items:flex-start;margin-top:10px}',
      '#lookStage{width:auto;max-width:46vw;height:340px;border-radius:18px;border:1px solid rgba(255,214,140,.5);flex:none}',
      '#lookSide{min-width:0;flex:1}',
      '#lookNamePlate{font-size:18px;margin:0 0 6px}',
      '#lookNote{color:#f0d0ea;font-size:13px;line-height:1.35;margin:0 0 8px}',
      '#lookConcept{margin:0 0 8px;padding:8px 10px;border-radius:12px;background:rgba(255,79,180,.16);border:1px solid rgba(255,143,202,.6);font-size:13px}',
      '.look-flavor{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;min-width:84px}',
      '.look-flavor span{height:72px;border-radius:10px;display:block}',
      '.look-flavor b{font-size:11px;font-weight:800;max-width:84px;text-align:center}',
      '#lookName{width:100%;margin:8px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,214,140,.7);background:#120810;color:#fff6ea;font:700 16px ui-rounded,system-ui}',
      '#lookCls{display:flex;gap:8px;flex-wrap:wrap}',
      '#lookPet{font-size:12px;color:#d7c4ff;margin:6px 0 10px}',
      '#lookActions{display:flex;gap:8px;flex-wrap:wrap}',
      '@media (max-width:560px){#lookBody{flex-direction:column;align-items:center}#lookSide{width:100%}}',
    ].join('');
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = 'lookPick';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div id="lookCard"><h2>Your look</h2><div id="lookRaces"></div><div id="lookBody"><div id="lookStage"></div><div id="lookSide"><p id="lookNamePlate"></p><p id="lookNote"></p><p id="lookConcept">Concept plate only. This pinup still needs a cleaner cel pass. It is not the final princess art. The cap stays on.</p><div id="lookFlavors"></div><input id="lookName" maxlength="18" placeholder="Name" autocomplete="nickname"><div id="lookCls"><button type="button" data-cls="mage">Mage</button><button type="button" data-cls="gunner">Gunner</button></div><p id="lookPet">Mage and Gunner are the classes this build runs. Neither takes a combat pet. Hunter and Summoner are not a slot yet.</p><div id="lookActions"><button type="button" class="big gold" id="lookWear">Wear this look</button><button type="button" class="big" id="lookClose">Back</button></div></div></div></div>';
    document.body.appendChild(root);
    const races = root.querySelector('#lookRaces');
    RACES.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.race = r.id;
      b.textContent = r.label;
      b.onclick = () => {
        race = r.id;
        const first = LOOKS.filter(l => l.race === race)[0];
        if (first) flavor = first.id;
        render();
      };
      races.appendChild(b);
    });
    root.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { cls = b.dataset.cls; render(); });
    root.querySelector('#lookWear').onclick = applyLook;
    root.querySelector('#lookClose').onclick = closeLook;
    const openBtn = document.getElementById('titleLook');
    if (openBtn) openBtn.onclick = () => { if (typeof SFX !== 'undefined' && SFX.tap) SFX.tap(); openLook(); };
    const saved = window.__profile && window.__profile.look && window.__profile.look();
    if (saved && saved.name && openBtn) openBtn.textContent = 'Your look · ' + saved.name;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.__look = {
    open: openLook,
    close: closeLook,
    races: () => RACES.map(r => r.id),
    flavors: (id) => LOOKS.filter(l => l.race === id).map(l => l.id),
    pick: (id) => { const l = lookById(id); race = l.race; flavor = l.id; render(); return { race: race, flavor: flavor, cls: cls }; },
    setClass: (c) => { cls = c === 'gunner' ? 'gunner' : 'mage'; render(); return cls; },
    setName: (n) => { const el = document.getElementById('lookName'); if (el) el.value = String(n || '').slice(0, 18); return el ? el.value : ''; },
    state: () => ({ race: race, flavor: flavor, cls: cls, name: (document.getElementById('lookName') || {}).value || '', open: !!(document.getElementById('lookPick') && document.getElementById('lookPick').classList.contains('on')) }),
    wear: applyLook,
  };
})();
