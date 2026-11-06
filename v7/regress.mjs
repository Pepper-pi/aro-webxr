// Repeatable checks for the v7 page. Serves nothing by itself.
//   CHROME=/usr/local/bin/google-chrome node v7/regress.mjs
// Expects the page at http://127.0.0.1:8765/v7/ (or BASE).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'handoff');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/v7/';
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  puppeteer = (await import('/tmp/ppt/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;
}

const fails = [];
function check(name, ok, detail) {
  const line = (ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '');
  console.log(line);
  if (!ok) fails.push(line);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

async function open(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(BASE + '?t=' + w + 'x' + h, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__train && window.__aro);
  return page;
}

const page = await open(390, 844);

const mage = await page.evaluate(() => {
  window.__aroFreeze = true;
  const T = window.__train.TRAIN, AR = window.__aro.AR;
  window.__train.startTrain();
  window.__train.setClass('mage');
  T.demo = false; T.autoFull = true; T.casts = 0; T.spent = false; T.charge = 0;
  const d = AR.mobs[1];
  const hp0 = d.hp;
  T.sel.mage = 0;
  T.aim = { x: d.x, y: d.y };
  T.charge = 0.4;
  T.cap = { part: 'center', i: 0, x0: 0, y0: 0, aimed: true };
  window.__train.releaseDisc(12, 12);
  for (let i = 0; i < 14; i++) window.__train.stepArena(0.05);
  const early = { casts: T.casts, shown: T.last && T.last.shown, hp: d.hp, hit: d.hp < hp0 };

  window.__train.resetTrain();
  window.__train.setClass('mage');
  T.demo = false; T.autoFull = true; T.casts = 0; T.spent = false; T.charge = 0;
  const d2 = window.__aro.AR.mobs[1];
  const hpA = d2.hp;
  T.sel.mage = 0;
  T.aim = { x: d2.x, y: d2.y };
  T.cap = { part: 'center', i: 0, x0: 0, y0: 0, aimed: true };
  window.__train.trainUpdate(0.9);
  for (let i = 0; i < 14; i++) window.__train.stepArena(0.05);
  const fullCasts = T.casts;
  const fullHp = d2.hp;
  window.__train.releaseDisc(4, 4);
  const afterLift = T.casts;

  window.__train.resetTrain();
  window.__train.setClass('mage');
  T.demo = false; T.autoFull = true; T.casts = 0; T.spent = false; T.charge = 0.5;
  T.cap = { part: 'center', i: 0, x0: 0, y0: 0, aimed: true };
  T.aim = { x: 0, y: -1 };
  window.__train.setTrainView('fp');
  const cancelCasts = T.casts;
  const cancelCap = T.cap;
  window.__train.setTrainView('tactical');
  return { early, fullCasts, fullHit: fullHp < hpA, afterLift, cancelCasts, cancelCap, A: window.__aro.AR.cam.A };
});
check('mage early release is one weaker cast', mage.early.casts === 1 && mage.early.shown < 80 && mage.early.hit, JSON.stringify(mage.early));
check('mage full charge fires once', mage.fullCasts === 1 && mage.fullHit, 'casts ' + mage.fullCasts);
check('mage lift after full does not cast again', mage.afterLift === 1, 'casts ' + mage.afterLift);
check('view switch cancels and does not cast', mage.cancelCasts === 0 && !mage.cancelCap, 'casts ' + mage.cancelCasts);
check('aim angle unchanged', Math.abs(mage.A - 0.8) < 1e-6, String(mage.A));

const gun = await page.evaluate(() => {
  window.__train.resetTrain();
  window.__train.setClass('gunner');
  const T = window.__train.TRAIN, AR = window.__aro.AR;
  const d = AR.mobs[0];
  const hp0 = d.hp;
  T.demo = false; T.aim = { x: d.x, y: d.y }; T.casts = 0; T.charge = 0;
  AR.ptr = { x0: 10, y0: 10, x: 10, y: 10, t0: performance.now() - 400, swiped: false, held: 0.4 };
  T.cap = { part: 'center', i: 0, x0: 0, y0: 0, aimed: true };
  window.__train.trainUpdate(0.5);
  const heldHp = d.hp;
  const heldCharge = T.charge;
  window.__train.releaseDisc(1, 1);
  for (let i = 0; i < 4; i++) window.__train.stepArena(0.05);
  return { heldHp, hp0, heldCharge, firedHp: d.hp, A: AR.cam.A };
});
check('gunner hold does not fire', gun.heldHp === gun.hp0 && gun.heldCharge > 0.2, 'hp ' + gun.heldHp + ' charge ' + gun.heldCharge.toFixed(2));
check('gunner release fires', gun.firedHp < gun.hp0, gun.hp0 + ' -> ' + gun.firedHp);

const wall = await page.evaluate(() => {
  window.__train.resetTrain();
  window.__train.setClass('mage');
  const T = window.__train.TRAIN, FIELD = window.__aro.FIELD, AR = window.__aro.AR;
  T.demo = false; T.sel.mage = 3; T.charge = 1; T.casts = 0;
  const raised = !!window.__train.releaseMage();
  const startHp = FIELD.wall && FIELD.wall.hp;
  T.sel.mage = 0; T.charge = 1; T.spent = false; AR.cds[0] = 0;
  T.aim = { x: FIELD.wall.cx, y: FIELD.wall.cy };
  const castsBefore = T.casts;
  window.__train.releaseMage();
  const mid = { hp: FIELD.wall.hp, dmg: FIELD.wall.lastDmg, weak: FIELD.wall.lastWeak, casts: T.casts - castsBefore };
  T.spent = true; T.cap = { part: 'center', x0: 0, y0: 0, aimed: true };
  const hold = FIELD.wall.hp;
  const castsAtHit = T.casts;
  window.__train.releaseDisc(2, 2);
  const lift = FIELD.wall.hp === hold && T.casts === castsAtHit;
  T.sel.mage = 1; T.charge = 1; T.spent = false; AR.cds[1] = 0;
  T.aim = { x: FIELD.wall.cx, y: FIELD.wall.cy };
  const frostBefore = FIELD.wall.hp;
  window.__train.releaseMage();
  const frostSame = FIELD.wall && FIELD.wall.hp === frostBefore;
  const empty = [Math.sqrt(3) * (2 + -2), 1.5 * -4];
  T.sel.mage = 0; T.charge = 1; T.spent = false; AR.cds[0] = 0;
  T.aim = { x: empty[0], y: empty[1] };
  const far = window.__train.aimedOwnWall(T.aim);
  const hpEmpty = FIELD.wall.hp;
  window.__train.releaseMage();
  const emptyOk = !far && window.__aro.hexState(2, -4) === 'fire' && FIELD.wall.hp === hpEmpty;
  let hits = 1;
  while (FIELD.wall && hits < 6) {
    T.sel.mage = 0; T.charge = 1; T.spent = false; AR.cds[0] = 0;
    T.aim = { x: FIELD.wall.cx, y: FIELD.wall.cy };
    window.__train.releaseMage();
    hits++;
  }
  return {
    raised, startHp, mid, lift, frostSame, emptyOk, hits,
    gone: !FIELD.wall, chunks: FIELD.chunks.length,
    cracked: [...FIELD.hex.values()].filter(h => h.s === 'cracked').length,
  };
});
check('iceberg raises at 90 HP', wall.raised && wall.startHp === 90, JSON.stringify(wall.mid));
check('ember on own center is weak x2 and one cast', wall.mid.weak && wall.mid.dmg === 40 && wall.mid.hp === 50 && wall.mid.casts === 1, JSON.stringify(wall.mid));
check('lift after that ember does not hit', wall.lift, '');
check('frost and empty ground do not damage the wall', wall.frostSame && wall.emptyOk, '');
check('third center ember shatters', wall.gone && wall.hits === 3 && wall.cracked >= 1 && wall.chunks >= 1, 'hits ' + wall.hits);

const trench = await page.evaluate(() => {
  window.__train.resetTrain();
  window.__train.setClass('mage');
  const AR = window.__aro.AR, FIELD = window.__aro.FIELD;
  const hexXY = (q, r) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];
  AR.t = 0;
  const a = hexXY(-1, 1), b = hexXY(1, 1);
  window.__aro.slashLine(a[0], a[1], b[0], b[1]);
  window.__aro.setP(-1, 2);
  const first = window.__aro.moveP(0, -1);
  const at1 = { q: AR.ph.q, r: AR.ph.r };
  const second = window.__aro.moveP(0, -1);
  const at2 = { q: AR.ph.q, r: AR.ph.r };
  window.__aro.setP(-1, 2);
  const sample = [...FIELD.terr.values()].find(e => e.shape === 'trench');
  const [sx, sy] = hexXY(sample.q, sample.r);
  const mob = { x: sx, y: sy - 1.1, D: { sp: 1 }, ph: 1, root: 0 };
  const blockedMob = window.__aro.mobObstacle(mob, 0.45, 0.05) === true;
  const T = window.__train.TRAIN;
  T.sel.mage = 0; T.charge = 1; T.spent = false; AR.cds[0] = 0;
  const th = [...FIELD.hex.values()].find(h => h.s === 'trench');
  T.aim = { x: hexXY(th.q, th.r)[0], y: hexXY(th.q, th.r)[1] };
  window.__train.releaseMage();
  const combo = FIELD.lastCombo;
  const lava = window.__aro.hexState(th.q, th.r);
  const shape = window.__aro.shapeAt(th.q, th.r);
  const hp0 = window.__aro.hp();
  window.__aro.setP(th.q, th.r);
  window.__train.stepArena(0.25);
  const burned = window.__aro.hp() < hp0 - 0.4;
  window.__aro.setP(-1, 2);
  for (const e of FIELD.terr.values()) e.t = e.life - 0.02;
  for (const h of FIELD.hex.values()) if (h.s === 'trench' || h.s === 'fire') h.t = h.life - 0.02;
  window.__train.stepArena(0.08);
  const expired = FIELD.terr.size === 0 && ![...FIELD.hex.values()].some(h => h.s === 'trench');
  const c = hexXY(0, 1);
  window.__aro.slashLine(c[0] - 1.5, c[1], c[0] + 1.5, c[1]);
  const beforeReset = FIELD.terr.size;
  window.__train.resetTrain();
  const reset = FIELD.terr.size === 0 && !FIELD.wall;
  return { first, at1, second, at2, blockedMob, combo, lava, shape, burned, expired, beforeReset, reset };
});
check('trench at t=0 refuses the first step', trench.first === false && trench.at1.r === 2, JSON.stringify(trench.at1));
check('second step enters the trench', trench.second === true && trench.at2.r === 1, JSON.stringify(trench.at2));
check('mob path treats the trench as a block', trench.blockedMob, '');
check('ember on the trench is a lava seam and burns', trench.combo === 'Lava seam!' && trench.lava === 'fire' && trench.shape === 'trench' && trench.burned, trench.combo);
check('trench expiry and reset clear it', trench.expired && trench.reset && trench.beforeReset > 0, '');

const raid = await page.evaluate(() => {
  window.__aroFreeze = false;
  window.__train.TRAIN.on = false;
  document.getElementById('trainHud').classList.add('hide');
  window.__train.openMapNav();
  const MAP = window.__aro.MAP;
  const dome = MAP.list.find(t => t.ter === 'dome');
  const near = MAP.list.find(t => !t.edge && t.ter !== 'water' && (Math.abs(t.q - dome.q) + Math.abs(t.r - dome.r) + Math.abs(t.q + t.r - dome.q - dome.r)) / 2 === 1);
  Object.assign(MAP.house, { q: near.q, r: near.r, x: near.x, y: near.y, mode: 'park' });
  window.__aro.G.step = 2;
  return true;
});
await page.evaluate(() => window.__train.goPlace(1, -3));
await page.waitForFunction(() => document.getElementById('act').textContent.includes('Enter the raid'), { timeout: 8000 });
const beforeEnter = await page.evaluate(() => ({ scene: window.__aro.G.scene, act: document.getElementById('act').textContent }));
await page.click('#act');
await page.waitForFunction(() => window.__aro.AR.phase === 'block', { timeout: 4000 });
const armed = await page.evaluate(() => ({ phase: window.__aro.AR.phase, block: !!window.__aro.AR.block, scene: window.__aro.G.scene }));
await page.mouse.click(200, 340);
await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const punched = await page.evaluate(() => ({ phase: window.__aro.AR.phase, k: window.__aro.AR.block && window.__aro.AR.block.k }));
await page.evaluate(() => endArena());
const back = await page.evaluate(() => ({ scene: window.__aro.G.scene, map: !document.getElementById('mapNav').classList.contains('hide') }));
check('raid waits on the map until Enter', beforeEnter.scene === 'map' && beforeEnter.act.includes('Enter the raid'), beforeEnter.act);
check('raid arming reaches the punch phase', armed.phase === 'block' && armed.block && armed.scene === 'arena', armed.phase);
check('tap punches the start block', punched.phase === 'wave' && punched.k > 0, JSON.stringify(punched));
check('back from the raid returns to the map', back.scene === 'map' && back.map, back.scene);

const king = await page.evaluate(() => {
  window.__aroFreeze = true;
  window.__train.setClass('mage');
  window.__train.startKing();
  window.__train.TRAIN.demo = false;
  const T = window.__train.TRAIN, AR = window.__aro.AR;
  let casts = 0, retries = 0, steps = 0;
  const seen = [];
  for (let n = 0; n < 1400 && AR.phase !== 'clear'; n++) {
    window.__train.stepArena(0.1);
    steps++;
    const m = AR.mobs.find(x => x.k === 'boss' && x.state !== 'gone');
    if (!m || m.state !== 'live') continue;
    if (seen.length && m.hp > seen[seen.length - 1] + 1) retries++;
    seen.push(m.hp);
    const here = [AR.ph.q, AR.ph.r];
    const danger = AR.zones.some(z => z.hexes.some(h => h[0] === here[0] && h[1] === here[1]))
      || AR.lines.some(l => l.aimed && !l.fired && segDist(AR.ppx, AR.ppy, l.x0, l.y0, l.x1, l.y1) < 0.95);
    if (danger) {
      if (!window.__aro.moveP(1, 0)) if (!window.__aro.moveP(-1, 0)) window.__aro.moveP(0, 1);
      continue;
    }
    if (AR.cds[0] <= 0 && window.__aro.FIELD.mana >= 10) {
      T.sel.mage = 0; T.charge = 1; T.spent = false; T.aim = { x: m.x, y: m.y };
      if (window.__train.releaseMage()) casts++;
    }
    if (retries > 2) break;
  }
  return { phase: AR.phase, casts, retries, steps, you: Math.ceil(window.__aro.G.hp), start: seen[0], low: Math.ceil(Math.min(...seen)) };
});
check('gel king full-health victory', king.phase === 'clear' && king.retries === 0 && king.start === 160 && king.casts >= 5, JSON.stringify(king));

async function layout(w, h) {
  const p = await open(w, h);
  const r = await p.evaluate(() => {
    window.__train.startTrain();
    window.__train.TRAIN.demo = false;
    document.getElementById('wheel').classList.add('on');
    const c = window.__aro.AR.cam;
    const scr = (x, y) => {
      const u = (x - c.x) * c.hz, v = (y - c.y) * c.hz;
      const depth = Math.max(c.D * 0.3, c.D - v * Math.sin(c.A)), f = c.D / depth;
      return { x: innerWidth / 2 + u * f, y: c.cy + v * Math.cos(c.A) * f };
    };
    const boxes = ['trainHud', 'castFeed'].map(id => {
      const b = document.getElementById(id).getBoundingClientRect();
      return { id, top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    });
    const hit = (pt, b) => pt.x > b.left && pt.x < b.right && pt.y > b.top && pt.y < b.bottom;
    const covered = [];
    for (const m of window.__aro.AR.mobs) {
      const pt = scr(m.x, m.y - 0.4);
      if (boxes.some(b => hit(pt, b))) covered.push(m.D.n);
    }
    const player = scr(window.__aro.AR.ppx, window.__aro.AR.ppy - 0.6);
    const scroll = document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight;
    return { covered, playerHit: boxes.some(b => hit(player, b)), scroll, A: c.A };
  });
  check('layout ' + w + 'x' + h + ' leaves fighters visible', r.covered.length === 0 && !r.playerHit, 'covered ' + r.covered.join(',') + ' player ' + r.playerHit);
  check('layout ' + w + 'x' + h + ' does not scroll', r.scroll <= 2, 'extra ' + r.scroll);
  await p.close();
}
await layout(320, 568);
await layout(390, 844);
await layout(844, 390);

const room = await open(390, 844);
await room.evaluate(() => {
  window.__train.TRAIN.on = false;
  document.getElementById('trainHud').classList.add('hide');
  window.__train.openMapNav();
  const MAP = window.__aro.MAP, dome = MAP.list.find(t => t.ter === 'dome');
  const near = MAP.list.find(t => !t.edge && t.ter !== 'water' && (Math.abs(t.q - dome.q) + Math.abs(t.r - dome.r) + Math.abs(t.q + t.r - dome.q - dome.r)) / 2 === 1);
  Object.assign(MAP.house, { q: near.q, r: near.r, x: near.x, y: near.y, mode: 'park' });
  window.__aro.G.step = 2;
});
await room.evaluate(() => window.__train.goPlace(1, -3));
await room.waitForFunction(() => document.getElementById('act').textContent.includes('Enter the raid'), { timeout: 8000 });
await room.click('#act');
await room.waitForFunction(() => window.__aro.AR.phase === 'block', { timeout: 4000 });
const roomTac = await room.evaluate(() => ({
  A: window.__aro.AR.cam.A,
  low: document.getElementById('roomLow').textContent,
  navHidden: document.getElementById('mapNav').classList.contains('hide'),
}));
await room.click('#roomLow');
const roomLow = await room.evaluate(() => window.__aro.AR.cam.A);
await room.click('#roomLow');
const roomBackA = await room.evaluate(() => window.__aro.AR.cam.A);
await room.evaluate(() => endArena());
const roomMap = await room.evaluate(() => ({
  scene: window.__aro.G.scene,
  lowHidden: document.getElementById('roomLow').classList.contains('hide'),
  navHidden: document.getElementById('mapNav').classList.contains('hide'),
}));
check('room raid starts tactical with the Low button and map buttons hidden', roomTac.A === 0.8 && roomTac.low === 'Low' && roomTac.navHidden, JSON.stringify(roomTac));
check('room raid Low uses angle 1 and toggles back', roomLow === 1 && roomBackA === 0.8, roomLow + ' then ' + roomBackA);
check('back from the room raid restores the map buttons', roomMap.scene === 'map' && roomMap.lowHidden && !roomMap.navHidden, JSON.stringify(roomMap));
await room.close();

const lowPage = await open(390, 844);
const low = await lowPage.evaluate(() => {
  window.__aroFreeze = true;
  window.__train.startTrain();
  window.__train.setClass('mage');
  window.__train.TRAIN.demo = false;
  const beforeA = window.__aro.AR.cam.A;
  window.__train.setTrainView('low');
  const c = window.__aro.AR.cam;
  const d = window.__aro.AR.mobs[1];
  const p = proj(c, d.x, d.y);
  const back = unproj(c, p[0], p[1]);
  const err = Math.hypot(back[0] - d.x, back[1] - d.y);
  const hud = document.getElementById('trainHud').getBoundingClientRect();
  const disc = window.__train.discCenter();
  const R = window.__train.discRadius();
  const onHud = p[1] > hud.top && p[1] < hud.bottom && p[0] > hud.left && p[0] < hud.right;
  const onDisc = Math.hypot(p[0] - disc.x, p[1] - disc.y) < R + 8;
  window.__train.TRAIN.sel.mage = 0;
  window.__train.TRAIN.aim = { x: d.x, y: d.y };
  window.__train.TRAIN.charge = 1;
  window.__train.TRAIN.spent = false;
  window.__aro.AR.cds[0] = 0;
  const hp0 = d.hp;
  window.__train.releaseMage();
  for (let i = 0; i < 14; i++) window.__train.stepArena(0.05);
  const hit = d.hp < hp0;
  const lowA = c.A;
  window.__train.setTrainView('tactical');
  const restored = Math.abs(window.__aro.AR.cam.A - beforeA) < 1e-6;
  return { A: lowA, err, onHud, onDisc, hit, screen: [Math.round(p[0]), Math.round(p[1])], restored };
});
check('low angle round-trips aim', low.A === 1 && low.err < 0.05, 'A ' + low.A + ' err ' + low.err.toFixed(4));
check('low angle keeps the dummy off the HUD and the disc', !low.onHud && !low.onDisc && low.screen[1] > 80 && low.screen[1] < 700, JSON.stringify(low.screen));
check('low angle ember still hits the aimed dummy', low.hit, '');
check('tactical camera returns', low.restored, '');
await lowPage.close();

async function lowLayout(w, h) {
  const p = await open(w, h);
  const r = await p.evaluate(() => {
    window.__train.startTrain();
    window.__train.setTrainView('low');
    const c = window.__aro.AR.cam;
    const scr = (x, y) => {
      const u = (x - c.x) * c.hz, v = (y - c.y) * c.hz;
      const depth = Math.max(c.D * 0.3, c.D - v * Math.sin(c.A)), f = c.D / depth;
      return { x: innerWidth / 2 + u * f, y: c.cy + v * Math.cos(c.A) * f };
    };
    const boxes = ['trainHud', 'castFeed'].map(id => {
      const b = document.getElementById(id).getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    });
    const hit = (pt, b) => pt.x > b.left && pt.x < b.right && pt.y > b.top && pt.y < b.bottom;
    const covered = [];
    for (const m of window.__aro.AR.mobs) {
      const pt = scr(m.x, m.y - 0.35);
      if (boxes.some(b => hit(pt, b)) || pt.x < 8 || pt.x > innerWidth - 8 || pt.y < 8 || pt.y > innerHeight - 8) covered.push(m.D.n);
    }
    return { covered, A: c.A };
  });
  check('low ' + w + 'x' + h + ' shows the dummies', r.covered.length === 0 && r.A === 1, r.covered.join(',') || 'ok');
  await p.close();
}
await lowLayout(320, 568);
await lowLayout(390, 844);
await lowLayout(844, 390);

fs.mkdirSync(OUT, { recursive: true });
async function frame(p, file) {
  await p.evaluate(() => {
    window.__train.TRAIN.demo = false;
    syncAutoBtn();
    showCast('');
    window.__aroFreeze = false;
  });
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.screenshot({ path: path.join(OUT, file) });
}
const shot = await open(390, 844);
const pix = await shot.evaluate(() => {
  window.__aroFreeze = true;
  window.__train.startTrain();
  window.__train.setClass('mage');
  const T = window.__train.TRAIN;
  T.demo = false;
  syncAutoBtn();
  showCast('');
  const d = window.__aro.AR.mobs[1];
  T.aim = { x: d.x, y: d.y };
  T.sel.mage = 0;
  const hexXY = (q, r) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];
  const a = hexXY(-1, 1), b = hexXY(1, 1);
  window.__aro.slashLine(a[0], a[1], b[0], b[1]);
  for (let i = 0; i < 16; i++) window.__train.stepArena(0.05);
  const c = window.__aro.AR.cam;
  const scr = (x, y) => {
    const u = (x - c.x) * c.hz, v = (y - c.y) * c.hz;
    const depth = Math.max(c.D * 0.3, c.D - v * Math.sin(c.A)), f = c.D / depth;
    return [innerWidth / 2 + u * f, c.cy + v * Math.cos(c.A) * f];
  };
  const head = scr(d.x, d.y - 0.35);
  const body = scr(window.__aro.AR.ppx, window.__aro.AR.ppy - 0.45);
  return { head, body, aim: scr(d.x, d.y), demo: T.demo, feed: document.getElementById('castFeed').classList.contains('hide') };
});
await frame(shot, 'play_phone.png');
const colors = await shot.evaluate((pix) => {
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), dpr = cv.width / innerWidth;
  const sample = (x, y) => {
    const d = ctx.getImageData(Math.max(0, Math.floor(x * dpr)), Math.max(0, Math.floor(y * dpr)), 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  return { head: sample(pix.head[0], pix.head[1]), body: sample(pix.body[0], pix.body[1]) };
}, pix);
check('phone frame draws a dummy and the player', colors.head[0] > 80 || colors.body[0] > 40, JSON.stringify(colors));
await shot.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
await shot.evaluate(() => { resize(); window.__aro.AR.floorDirty = true; window.__train.TRAIN.demo = false; showCast(''); });
await frame(shot, 'play_land.png');
await shot.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await shot.evaluate(() => { resize(); window.__train.setTrainView('tactical'); window.__train.TRAIN.demo = false; syncAutoBtn(); showCast(''); });
await frame(shot, 'tac_before.png');
await shot.evaluate(() => { window.__train.setTrainView('low'); window.__train.TRAIN.demo = false; syncAutoBtn(); showCast(''); });
await frame(shot, 'low_after.png');
await shot.close();

await browser.close();
console.log(fails.length ? '\n' + fails.length + ' failed' : '\nall passed');
process.exit(fails.length ? 1 : 0);
