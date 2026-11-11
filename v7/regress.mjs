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

const discMesh = await page.evaluate(() => {
  window.__train.startTrain();
  window.__train.setTrainView('fp');
  const play = window.__disc3d.play();
  const bright = (charge) => {
    const c = discPlayFrame(charge, 0);
    const g = document.createElement('canvas');
    g.width = c.width; g.height = c.height;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, g.width, g.height).data;
    let n = 0, e = 0;
    for (let i = 0; i < d.length; i += 16) { if (d[i + 3] > 24) { n++; e += d[i] + d[i + 1] + d[i + 2]; } }
    return { n, e };
  };
  const idle = bright(0), hot = bright(1);
  window.__train.setTrainView('tactical');
  return { tris: play.tris, gold: play.gold && play.gold[0], idle, hot, webgl: play.webgl };
});
check('v3 disc mesh is the playable ring', discMesh.webgl && discMesh.tris === 5020 && discMesh.idle.n > 400, JSON.stringify({ tris: discMesh.tris, n: discMesh.idle.n }));
check('gold roughness is set at runtime, not left at the file default', discMesh.gold && discMesh.gold.rough === 0.22 && discMesh.gold.metal === 1, JSON.stringify(discMesh.gold));
check('charged disc draws brighter than idle', discMesh.hot.e > discMesh.idle.e, JSON.stringify({ idle: discMesh.idle.e, hot: discMesh.hot.e }));
await new Promise(r => setTimeout(r, 350));
const discVis = await page.evaluate(() => new Promise(res => {
  window.__train.setTrainView('fp');
  window.__train.TRAIN.charge = 0;
  window.__train.TRAIN.demo = false;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cv = document.getElementById('cv'), g = cv.getContext('2d'), dpr = cv.width / innerWidth;
    const d = window.__train.discCenter(), R = window.__train.discRadius();
    const img = g.getImageData(0, 0, cv.width, cv.height).data;
    let gold = 0, gem = 0;
    const x0 = Math.max(0, (d.x - R * 1.35) * dpr | 0), x1 = Math.min(cv.width, (d.x + R * 1.35) * dpr | 0);
    const y0 = Math.max(0, (d.y - R * 1.35) * dpr | 0), y1 = Math.min(cv.height, (d.y + R * 1.35) * dpr | 0);
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * cv.width + x) * 4, r = img[i], gc = img[i + 1], b = img[i + 2];
      if (r > 130 && gc > 70 && gc < 190 && b < 110 && r > b + 35) gold++;
      else if ((gc > 140 && r < 130 && b < 140) || (b > 150 && gc > 90 && r < 140) || (r > 170 && gc < 90 && b < 120)) gem++;
    }
    const fx = (d.x * dpr) | 0, fy = Math.max(0, ((d.y - R * 2.4) * dpr) | 0);
    const fi = (fy * cv.width + fx) * 4;
    res({ gold, gem, far: [img[fi], img[fi + 1], img[fi + 2]], R });
  }));
}));
check('the gold ring is visible on the first-person field', discVis.gold > 40 && discVis.gem > 12, JSON.stringify(discVis));
check('the disc light does not wash the field above it', discVis.far[0] < 170 && discVis.far[1] < 160 && discVis.far[2] < 160, JSON.stringify(discVis.far));
await new Promise(r => setTimeout(r, 250));
const toonFight = await page.evaluate(() => window.__fight ? window.__fight.status() : null);
check('the yard fight is a toon field with a glass boss', !!(toonFight && toonFight.on && toonFight.hexes >= 19 && toonFight.gradient === 2 && toonFight.bossMax >= 40 && toonFight.lights === 1 && toonFight.rain >= 32 && toonFight.outlined), JSON.stringify(toonFight));
await page.evaluate(() => window.__train.setTrainView('tactical'));

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

const cell = await page.evaluate(() => {
  window.__train.startTrain();
  window.__train.resetTrain();
  const step = n => { for (let i = 0; i < n; i++) window.__train.stepArena(0.05); };
  const snap = () => JSON.parse(JSON.stringify(window.__train.CELL));
  const load = window.__train.loadCell({ hold: true });
  const bolt = window.__train.startCellBolt('fire');
  step(6);
  const kick = window.__train.kickCell();
  const dupKick = window.__train.kickCell();
  step(40);
  const charged = snap();
  const spend1 = window.__train.spendCell();
  const spend2 = window.__train.spendCell();
  const spent = snap();
  window.__train.resetTrain();
  const reset = snap();
  window.__train.loadCell({ hold: true });
  window.__train.startCellBolt('water');
  step(6);
  window.__train.kickCell();
  step(8);
  const cancel = window.__train.cancelCell();
  const cancelled = snap();
  window.__train.resetTrain();
  const noBolt = window.__train.kickCell();
  window.__train.loadCell({ hold: true });
  window.__train.startCellBolt('aether');
  step(6);
  window.__train.kickCell();
  step(40);
  const secondBolt = window.__train.startCellBolt('fire');
  const held = snap();
  return { load, bolt, kick, dupKick, charged, spend1, spend2, spent, reset, cancel, cancelled, noBolt, secondBolt, held };
});
check('cell catches one attack into a charge', cell.load && cell.bolt && cell.kick && !cell.dupKick && cell.charged.charge && cell.charged.charge.element === 'fire' && cell.charged.catches === 1, JSON.stringify(cell.charged));
check('cell charge spends once', cell.spend1 && !cell.spend2 && cell.spent.puzzle === 'fire' && cell.spent.spends === 1 && !cell.spent.charge, JSON.stringify(cell.spent));
check('cell reset clears the charge', !cell.reset.loaded && !cell.reset.charge && !cell.reset.puzzle && cell.reset.catches === 0, JSON.stringify(cell.reset));
check('cell cancel stores nothing', cell.cancel && !cell.cancelled.charge && cell.cancelled.cancels === 1, JSON.stringify(cell.cancelled));
check('cell does not catch twice or without a bolt', cell.noBolt === false && cell.secondBolt === false && cell.held.charge && cell.held.charge.element === 'aether' && cell.held.catches === 1, JSON.stringify(cell.held));

const topo = await page.evaluate(() => {
  const net = window.__train.cellNet;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const closed = net(0), mid = net(0.42), open = net(1);
  const side = dist(closed.base[0], closed.base[1]);
  const rigid = pose => pose.faces.every(f => Math.abs(dist(f.hinge[0], f.hinge[1]) - side) < 1e-6 && Math.abs(dist(f.hinge[0], f.tip) - side) < 1e-4 && Math.abs(dist(f.hinge[1], f.tip) - side) < 1e-4);
  const hinged = pose => pose.faces.length === 3 && pose.base.length === 3 && pose.faces.every((f, i) => f.hinge[0] === pose.base[i] && f.hinge[1] === pose.base[(i + 1) % 3]);
  const clear = pose => pose.base.every(b => b[2] >= -1e-6) && pose.faces.every(f => f.tip[2] >= -1e-6);
  const meet = dist(closed.faces[0].tip, closed.faces[1].tip) < 1e-6 && dist(closed.faces[0].tip, closed.faces[2].tip) < 1e-6 && closed.faces[0].tip[2] > closed.radius && closed.lift === 0;
  const midAir = mid.lift === 0 && mid.faces.every(f => f.tip[2] > 0.05 && f.tip[2] < closed.faces[0].tip[2] - 0.02);
  const tipsDown = open.faces.every(f => f.tip[2] < 1e-6);
  const tipR = Math.hypot(open.faces[0].tip[0], open.faces[0].tip[1]);
  const centerUp = open.lift > 0.02 && open.lift < tipR * 0.18;
  const star = open.faces.every(f => { const r = Math.hypot(f.tip[0], f.tip[1]); return r > open.radius * 1.7 && r < open.radius * 2.05; });
  window.__train.CELL.phase = 'beam';
  const beam = window.__train.cellFold();
  window.__train.CELL.phase = 'snap';
  window.__train.CELL.t = window.__train.CELL_TUNABLE.snap;
  const shut = window.__train.cellFold();
  window.__train.resetCell();
  return { topology: window.__train.CELL_TOPOLOGY, rigid: rigid(closed) && rigid(mid) && rigid(open), hinged: hinged(closed) && hinged(mid) && hinged(open), clear: clear(closed) && clear(mid) && clear(open), meet, midAir, tipsDown, centerUp, star, beam, shut, lift: open.lift, radius: open.radius };
});
check('cell is a three-face tetrahedron on shared hinges', topo.topology === 'tetrahedron-3' && topo.rigid && topo.hinged && topo.clear, JSON.stringify(topo));
check('cell opens from a closed apex through the air', topo.meet && topo.midAir, JSON.stringify(topo));
check('open star keeps its tips on the ground and lifts the center a little', topo.tipsDown && topo.centerUp && topo.star && topo.beam === 1 && topo.shut === 0, JSON.stringify(topo));

const live = await page.evaluate(() => {
  window.__train.startTrain();
  window.__train.resetTrain();
  const dt = 1 / 60;
  const step = n => { for (let i = 0; i < n; i++) window.__train.stepArena(dt); };
  const seen = [];
  const note = () => {
    const c = window.__train.CELL;
    const key = c.phase + (c.bolt ? '/bolt' : '') + (c.charge ? '/charge' : '');
    if (seen[seen.length - 1] !== key) seen.push(key);
  };
  const loaded = window.__train.loadCell();
  note();
  step(40);
  note();
  const kicked = window.__train.kickCell();
  note();
  for (let i = 0; i < 180 && !window.__train.CELL.charge; i++) { window.__train.stepArena(dt); note(); }
  const charged = JSON.parse(JSON.stringify(window.__train.CELL));
  window.__train.setTrainView('low');
  window.__train.setTrainView('fp');
  window.__train.setTrainView('tactical');
  const afterView = JSON.parse(JSON.stringify(window.__train.CELL));
  const spend1 = window.__train.spendCell();
  const again = window.__train.loadCell();
  const spend2 = window.__train.spendCell();
  window.__train.resetTrain();
  const afterReset = JSON.parse(JSON.stringify(window.__train.CELL));
  window.__train.loadCell({ hold: true });
  window.__train.startCellBolt('water');
  step(20);
  window.__train.kickCell();
  step(24);
  const cancelPhase = window.__train.CELL.phase;
  const cancel = window.__train.cancelCell();
  step(180);
  const afterCancel = JSON.parse(JSON.stringify(window.__train.CELL));
  window.__train.resetTrain();
  window.__train.loadCell({ hold: true });
  window.__train.startCellBolt('electric');
  step(20);
  window.__train.kickCell();
  step(48);
  const resetPhase = window.__train.CELL.phase;
  window.__train.resetTrain();
  step(120);
  const afterResetMid = JSON.parse(JSON.stringify(window.__train.CELL));
  window.__train.loadCell({ hold: true });
  window.__train.startCellBolt('aether');
  step(20);
  window.__train.kickCell();
  step(160);
  const stored = window.__train.CELL.charge && window.__train.CELL.charge.element;
  const catches = window.__train.CELL.catches;
  window.__train.leaveTrain();
  const hidden = document.getElementById('cellBtn').classList.contains('hide');
  window.__train.startTrain();
  const afterBack = JSON.parse(JSON.stringify(window.__train.CELL));
  window.__train.loadCell({ hold: true });
  window.__train.startCellBolt('fire');
  step(110);
  const rearmed = !!window.__train.CELL.bolt && !window.__train.CELL.charge;
  return { loaded, kicked, seen, charged, afterView, spend1, again, spend2, afterReset, cancelPhase, cancel, afterCancel, resetPhase, afterResetMid, stored, catches, hidden, afterBack, rearmed };
});
check('cell plays kick, open, beam, snap, and rattle at frame speed', live.loaded && live.kicked && live.seen.join(' ') === 'idle idle/bolt kick/bolt fold/bolt beam/bolt snap/bolt rattle/bolt idle/charge' && live.charged.charge.element === 'fire' && live.charged.catches === 1, live.seen.join(' '));
check('view changes keep one charge and it spends once', live.afterView.charge && live.afterView.charge.element === 'fire' && live.afterView.catches === 1 && live.spend1 && !live.spend2 && live.again === false, JSON.stringify({ afterView: live.afterView.charge, spend1: live.spend1, spend2: live.spend2 }));
check('cancel, reset, and Back store nothing and do not revive a charge', live.cancel && live.cancelPhase !== 'idle' && !live.afterCancel.charge && live.afterCancel.catches === 0 && live.resetPhase !== 'idle' && !live.afterResetMid.charge && !live.afterReset.charge && live.stored === 'aether' && live.catches === 1 && live.hidden && !live.afterBack.charge && live.afterBack.catches === 0, JSON.stringify({ cancelPhase: live.cancelPhase, resetPhase: live.resetPhase, stored: live.stored, afterBack: live.afterBack }));
check('a missed bolt arms another attack and does not charge', live.rearmed, JSON.stringify(live.rearmed));

const queue = await page.evaluate(() => {
  window.__train.startTrain();
  window.__train.resetTrain();
  const F = window.__aro.FIELD;
  F.pots = 2; F.potCD = 0; F.mana = 40;
  window.__train.openCommand();
  const boardOpen = document.getElementById('cmdM').classList.contains('on');
  const reachLabel = document.getElementById('itemReach') && document.getElementById('itemReach').textContent;
  const sent = window.__train.itemSend();
  const sentAgain = window.__train.itemSend();
  const popped = window.__train.itemPop();
  const afterPotion = { pots: F.pots, mana: F.mana, cd: F.potCD, front: window.__train.itemFront(), kind: window.__train.REACH.kind, loaded: window.__train.CELL.loaded };
  const spell = document.querySelector('#spells .sp');
  if (spell) spell.click();
  const afterSpell = { front: window.__train.itemFront(), kind: window.__train.REACH.kind, loaded: window.__train.CELL.loaded, pots: F.pots };
  const cellPop = window.__train.itemPop();
  const earlyKick = window.__train.kickCell();
  const readied = { phase: window.__train.CELL.phase, loaded: window.__train.CELL.loaded, bolt: !!window.__train.CELL.bolt, charge: window.__train.CELL.charge, front: window.__train.itemFront() };
  for (let i = 0; i < 12; i++) window.__train.stepArena(1 / 60);
  const kick = window.__train.kickCell();
  window.__train.cancelCell();
  const blocked = window.__train.itemPop();
  F.potCD = 0;
  const secondPotion = window.__train.itemPop();
  const empty = window.__train.itemPop();
  const viewAt = window.__train.REACH.at;
  window.__train.setTrainView('low');
  window.__train.setTrainView('tactical');
  const afterView = window.__train.REACH.at === viewAt && !window.__train.CELL.charge;
  window.__train.resetTrain();
  const afterReset = { charge: window.__train.CELL.charge, loaded: window.__train.CELL.loaded, at: window.__train.REACH.at };
  window.__train.itemReset();
  window.__train.itemSend();
  window.__train.itemPop();
  window.__train.leaveTrain();
  const hidden = document.getElementById('itemBubble').classList.contains('hide');
  window.__train.startTrain();
  const afterBack = { at: window.__train.REACH.at, kind: window.__train.REACH.kind, charge: window.__train.CELL.charge };
  F.pots = 2; F.potCD = 0; F.mana = 100;
  document.getElementById('cmdM').classList.remove('on');
  window.__train.resetTrain();
  return { boardOpen, reachLabel, sent, sentAgain, popped, afterPotion, afterSpell, cellPop, earlyKick, readied, kick, blocked, secondPotion, empty, afterView, afterReset, hidden, afterBack };
});
check('the board reaches one item and a potion pop uses the existing dose once', queue.boardOpen && queue.sent && !queue.sentAgain && queue.popped === 'potion' && queue.afterPotion.pots === 1 && queue.afterPotion.mana === 100 && queue.afterPotion.cd === 20 && queue.afterPotion.front === 'cell' && !queue.afterPotion.loaded, JSON.stringify(queue.afterPotion));
check('a spell tap does not pop the line, and a cell pop only readies the kick', queue.afterSpell.kind === 'cell' && queue.afterSpell.pots === 1 && queue.cellPop === 'cell' && queue.earlyKick === false && queue.readied.loaded && queue.readied.bolt && queue.readied.phase === 'idle' && !queue.readied.charge && queue.kick === true, JSON.stringify({ spell: queue.afterSpell, readied: queue.readied, kick: queue.kick }));
check('the next item waits out the potion cooldown, then reset and Back stay single', queue.blocked === false && queue.secondPotion === 'potion' && queue.empty === false && queue.afterView && !queue.afterReset.charge && queue.afterReset.at === 3 && queue.hidden && queue.afterBack.at === 0 && !queue.afterBack.charge, JSON.stringify(queue));

async function readyCell(p, view) {
  return p.evaluate((view) => {
    window.__train.startTrain();
    window.__train.resetTrain();
    window.__train.setTrainView(view);
    window.__train.setClass('mage');
    window.__train.TRAIN.demo = false;
    window.__train.TRAIN.casts = 0;
    window.__train.loadCell({ hold: true });
    window.__train.startCellBolt('fire');
    for (let i = 0; i < 12; i++) window.__train.stepArena(1 / 60);
    const cv = document.getElementById('cv');
    const candidates = [[innerWidth * 0.62, innerHeight * 0.48], [innerWidth * 0.72, innerHeight * 0.42], [innerWidth * 0.5, innerHeight * 0.55]];
    let spot = candidates[candidates.length - 1];
    for (const pair of candidates) { if (document.elementFromPoint(pair[0], pair[1]) === cv) { spot = pair; break; } }
    return { x: spot[0], y: spot[1], q: window.__aro.AR.ph.q, phase: window.__train.CELL.phase, btn: document.getElementById('cellBtn').textContent, casts: window.__aro.G.day.casts };
  }, view);
}
async function cellRead(p) {
  return p.evaluate(() => ({
    q: window.__aro.AR.ph.q,
    phase: window.__train.CELL.phase,
    from: window.__train.CELL.kickFrom,
    aim: window.__train.CELL.aim,
    casts: window.__aro.G.day.casts,
    bolt: !!window.__train.CELL.bolt,
  }));
}
async function cellMouse(p, view, flick) {
  const spot = await readyCell(p, view);
  await p.mouse.move(spot.x, spot.y);
  await p.mouse.down();
  await p.mouse.move(spot.x + (flick ? 64 : 8), spot.y - (flick ? 12 : 2), { steps: 3 });
  await p.mouse.up();
  const after = await cellRead(p);
  return { spot, after };
}
for (const [w, h] of [[320, 568], [390, 844], [844, 390]]) {
  for (const view of ['tactical', 'low']) {
    const p = await open(w, h);
    const tap = await cellMouse(p, view, false);
    check('cell tap ' + w + 'x' + h + ' ' + view + ' does not kick, step, or cast', tap.after.phase === 'idle' && tap.after.q === tap.spot.q && tap.after.casts === tap.spot.casts && tap.after.bolt && tap.spot.btn === 'Kick fallback', JSON.stringify(tap.after));
    const flung = await cellMouse(p, view, true);
    check('cell flick ' + w + 'x' + h + ' ' + view + ' is an avatar kick', flung.after.phase === 'kick' && flung.after.from === 'flick' && flung.after.q === flung.spot.q && flung.after.casts === flung.spot.casts && flung.after.aim && flung.after.aim.x > 0, JSON.stringify(flung.after));
    await p.close();
  }
}
{
  const p = await open(390, 844);
  const spot = await readyCell(p, 'fp');
  await p.mouse.move(spot.x, spot.y);
  await p.mouse.down();
  await p.mouse.move(spot.x + 70, spot.y + 20, { steps: 3 });
  await p.mouse.up();
  const after = await cellRead(p);
  check('cell flick in first person kicks and does not cast', after.phase === 'kick' && after.from === 'flick' && after.casts === spot.casts && after.q === spot.q, JSON.stringify(after));
  await p.close();
}
{
  const p = await open(390, 844);
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
  const touch = await touchApi(p);
  for (const view of ['tactical', 'low']) {
    const spot = await readyCell(p, view);
    const id = await touch.down(spot.x, spot.y);
    await touch.move(id, spot.x + 70, spot.y - 16);
    await touch.up(id, spot.x + 70, spot.y - 16);
    const after = await cellRead(p);
    check('cell touch flick ' + view + ' kicks without a step or a cast', after.phase === 'kick' && after.from === 'flick' && after.q === spot.q && after.casts === spot.casts, JSON.stringify(after));
    const spot2 = await readyCell(p, view);
    const id2 = await touch.down(spot2.x, spot2.y);
    await touch.move(id2, spot2.x + 10, spot2.y);
    await touch.cancel();
    const cancelled = await cellRead(p);
    check('cell touch cancel ' + view + ' does not kick', cancelled.phase === 'idle' && cancelled.q === spot2.q && cancelled.casts === spot2.casts && cancelled.bolt, JSON.stringify(cancelled));
  }
  await p.close();
}

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
  const blocked = !window.__train.releaseMage() && !FIELD.wall;
  window.__profile.setLoadout('mage', ['ember', 'frost', 'iceberg']);
  if (window.__train.syncWheel) window.__train.syncWheel();
  T.sel.mage = 2; T.charge = 1; T.casts = 0; T.spent = false;
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
    blocked, raised, startHp, mid, lift, frostSame, emptyOk, hits,
    gone: !FIELD.wall, chunks: FIELD.chunks.length,
    cracked: [...FIELD.hex.values()].filter(h => h.s === 'cracked').length,
  };
});
check('an unequipped iceberg does not raise a wall', wall.blocked, JSON.stringify(wall));
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
const kingPlate = await page.evaluate(async () => {
  window.__aroFreeze = true;
  window.__train.startKing();
  window.__train.setTrainView('fp');
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let front = null, floor = null;
  for (let i = 0; i < 40; i++) {
    await wait();
    front = window.__fight && window.__fight.plate && window.__fight.plate();
    floor = window.__fight && window.__fight.floor && window.__fight.floor();
    if (front && front.on && front.mode === 'paint' && floor && floor.on && floor.ready) break;
  }
  const m = window.__aro.AR.mobs.find(x => x.tier === 'boss' && x.art === 'king');
  if (m) { window.__aro.AR.ppx = m.x; window.__aro.AR.ppy = m.y - 2.6; }
  await wait(); await wait();
  const behind = window.__fight && window.__fight.plate && window.__fight.plate();
  return { front, behind, floor, view: window.__train.TRAIN.view, king: window.__train.TRAIN.king };
});
check('gel king plate is the painting from the front and a hologram from behind', kingPlate.king && kingPlate.view === 'fp' && kingPlate.front && kingPlate.front.on && kingPlate.front.mode === 'paint' && kingPlate.behind && kingPlate.behind.on && kingPlate.behind.mode === 'holo', JSON.stringify(kingPlate));
check('gel king front fight shows the dressed raid floor', kingPlate.king && kingPlate.front && kingPlate.front.mode === 'paint' && kingPlate.floor && kingPlate.floor.on && kingPlate.floor.art === 'raid-floor' && kingPlate.floor.ready && kingPlate.floor.pit && kingPlate.floor.ice && kingPlate.floor.sky, JSON.stringify(kingPlate.floor));
await page.waitForFunction(() => window.__gardenPlate && window.__gardenPlate.state().ready, { timeout: 8000 });
const gardenPlate = await page.evaluate(() => {
  enterGarden();
  const front = window.__gardenPlate.state();
  window.__gardenPlate.setView({ z: 0.7, x: 0 });
  const close = window.__gardenPlate.state();
  window.__gardenPlate.setView({ z: 4.6, x: 0 });
  closeGardenRoom();
  return { front, close };
});
check('garden plate is the painting in the room and a hologram up close', gardenPlate.front.on && gardenPlate.front.mode === 'paint' && gardenPlate.close.on && gardenPlate.close.mode === 'holo', JSON.stringify(gardenPlate));
await page.waitForFunction(() => window.__marketPlate && window.__marketPlate.state().ready, { timeout: 8000 });
const marketPlate = await page.evaluate(() => {
  enterDiscArea({ name: 'Market', q: -4, r: 1, x: 0, y: 0 });
  const front = window.__marketPlate.state();
  window.__marketPlate.setView({ z: 0.7, x: 0 });
  const close = window.__marketPlate.state();
  window.__marketPlate.setView({ z: 4.6, x: 0 });
  if (window.__train.leaveTrain) window.__train.leaveTrain();
  return { front, close };
});
check('market plate is the cleaned painting in the room and a hologram up close', marketPlate.front.on && marketPlate.front.mode === 'paint' && marketPlate.close.on && marketPlate.close.mode === 'holo', JSON.stringify(marketPlate));
const boarPlate = await page.evaluate(async () => {
  window.__aroFreeze = true;
  const prof = window.__profile && window.__profile.get && window.__profile.get();
  if (prof) prof.raidDate = '';
  window.__train.startDayRaid(null);
  window.__train.setTrainView('fp');
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const m = window.__aro.AR.mobs.find(x => x.raidBoss);
  if (m) window.__aro.AR.ppx = m.x;
  let front = null;
  let park = null;
  for (let i = 0; i < 12; i++) { await wait(); front = window.__fight && window.__fight.boar && window.__fight.boar(); park = window.__fight && window.__fight.park && window.__fight.park(); if (front && front.on && front.mode === 'paint' && park && park.on) break; }
  if (m) { window.__aro.AR.ppx = m.x; window.__aro.AR.ppy = m.y - 2.6; }
  await wait(); await wait();
  const behind = window.__fight && window.__fight.boar && window.__fight.boar();
  const floor = window.__fight && window.__fight.floor && window.__fight.floor();
  return { front, behind, park, floor, view: window.__train.TRAIN.view, day: window.__train.TRAIN.dayRaid };
});
check('boar plate is the painting from the front and a hologram from behind', boarPlate.day && boarPlate.view === 'fp' && boarPlate.front && boarPlate.front.on && boarPlate.front.mode === 'paint' && boarPlate.behind && boarPlate.behind.on && boarPlate.behind.mode === 'holo', JSON.stringify(boarPlate));
check('park backdrop is the painting behind the boar', boarPlate.day && boarPlate.view === 'fp' && boarPlate.park && boarPlate.park.on && boarPlate.park.mode === 'paint' && boarPlate.front && boarPlate.front.mode === 'paint', JSON.stringify(boarPlate.park));
check('day raid hides the raid floor and keeps the park', boarPlate.day && boarPlate.park && boarPlate.park.on && boarPlate.park.mode === 'paint' && boarPlate.floor && boarPlate.floor.on === false && boarPlate.floor.pit === false, JSON.stringify(boarPlate.floor));

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

async function raidWallPointer(w, h, low, shots) {
  const p = await open(w, h);
  await p.evaluate(() => {
    window.__train.TRAIN.on = false;
    document.getElementById('trainHud').classList.add('hide');
    window.__train.openMapNav();
    const MAP = window.__aro.MAP, dome = MAP.list.find(t => t.ter === 'dome');
    const near = MAP.list.find(t => !t.edge && t.ter !== 'water' && (Math.abs(t.q - dome.q) + Math.abs(t.r - dome.r) + Math.abs(t.q + t.r - dome.q - dome.r)) / 2 === 1);
    Object.assign(MAP.house, { q: near.q, r: near.r, x: near.x, y: near.y, mode: 'park' });
    window.__aro.G.step = 2;
  });
  await p.evaluate(() => window.__train.goPlace(1, -3));
  await p.waitForFunction(() => document.getElementById('act').textContent.includes('Enter the raid'), { timeout: 8000 });
  await p.click('#act');
  await p.waitForFunction(() => window.__aro.AR.phase === 'block', { timeout: 4000 });
  if (low) await p.click('#roomLow');
  await p.mouse.click(w / 2, Math.min(h * 0.42, h - 120));
  await new Promise(r => setTimeout(r, 350));
  await p.evaluate(() => { for (let i = 0; i < 20; i++) window.__train.stepArena(0.05); });
  const actors = await p.evaluate(() => ({
    mobs: window.__aro.AR.mobs.filter(m => m.state === 'live').length,
    you: Math.round(window.__aro.G.hp),
    scene: window.__aro.G.scene,
  }));
  if (shots && shots.before) await p.screenshot({ path: path.join(OUT, shots.before) });
  await p.click('#iceWall');
  await new Promise(r => setTimeout(r, 150));
  const pot = await p.$('#manaPot');
  if (pot) await pot.click();
  const spot = await p.evaluate(() => {
    const wall = window.__aro.FIELD.wall;
    if (!wall) return null;
    const cam = window.__aro.AR.cam;
    const mid = proj(cam, wall.cx, wall.cy);
    const far = proj(cam, 0, -2);
    const fw = unproj(cam, far[0], far[1]);
    return {
      hp: wall.hp,
      aim: { x: mid[0], y: mid[1] },
      far: { x: far[0], y: far[1] },
      farHitsWall: !!aimedOwnWall({ x: fw[0], y: fw[1] }),
      q: window.__aro.AR.ph.q,
    };
  });
  const tag = w + 'x' + h + (low ? ' low' : ' tactical');
  if (!spot) { check('raid pointer ' + tag + ' raises a wall', false, 'no wall'); await p.close(); return; }
  const hold = async (x, y, ms) => { await p.mouse.move(x, y); await p.mouse.down(); await new Promise(r => setTimeout(r, ms)); await p.mouse.up(); };
  const wall = () => p.evaluate(() => { const w = window.__aro.FIELD.wall; return w ? { hp: w.hp, dmg: w.lastDmg, weak: !!w.lastWeak } : { gone: true, shatters: window.__aro.FIELD.shatters }; });
  const waitCd = () => p.waitForFunction(() => window.__aro.AR.cds[0] <= 0, { timeout: 3000 }).catch(() => {});
  await hold(spot.far.x, spot.far.y, 500);
  const afterEmpty = await wall();
  await p.mouse.move(w * 0.35, h * 0.5);
  await p.mouse.down();
  await p.mouse.move(w * 0.35 + 80, h * 0.5);
  await p.mouse.up();
  const q1 = await p.evaluate(() => window.__aro.AR.ph.q);
  const afterSwipe = await wall();
  await p.mouse.move(spot.aim.x, spot.aim.y);
  await p.mouse.down();
  await new Promise(r => setTimeout(r, 80));
  await p.evaluate(() => {
    const id = window.__aro.AR.ptr && window.__aro.AR.ptr.id;
    document.getElementById('cv').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: id == null ? 1 : id, clientX: 8, clientY: 8 }));
  });
  await p.mouse.up();
  const afterCancel = await wall();
  await p.click('.sp[data-i="1"]');
  await waitCd();
  await hold(spot.aim.x, spot.aim.y, 500);
  const afterFrost = await p.evaluate(() => ({ hp: window.__aro.FIELD.wall && window.__aro.FIELD.wall.hp, sel: window.__aro.AR.sel }));
  await p.click('.sp[data-i="0"]');
  await waitCd();
  await p.mouse.move(spot.aim.x, spot.aim.y);
  await p.mouse.down();
  let ring = { aiming: false };
  for (let i = 0; i < 12 && !ring.aiming; i++) {
    await new Promise(r => setTimeout(r, 80));
    ring = await p.evaluate(() => {
      const ptr = window.__aro.AR.ptr;
      if (!ptr || !ptr.aiming) return { aiming: false };
      return { aiming: true, kind: raidAimKind(ptr.x, ptr.y, ptr.aim) };
    });
  }
  if (shots && shots.ring) {
    await p.evaluate(() => showCast(''));
    await p.screenshot({ path: path.join(OUT, shots.ring) });
  }
  await new Promise(r => setTimeout(r, 650));
  await p.mouse.up();
  await waitCd();
  const hits = [await wall()];
  for (let i = 0; i < 3 && (await wall()).hp; i++) {
    const pt = await p.evaluate(() => { const wall = window.__aro.FIELD.wall; const s = proj(window.__aro.AR.cam, wall.cx, wall.cy); return { x: s[0], y: s[1] }; });
    await hold(pt.x, pt.y, 1050);
    hits.push(await wall());
    await waitCd();
  }
  if (shots && shots.after) {
    await p.evaluate(() => showCast(''));
    await p.screenshot({ path: path.join(OUT, shots.after) });
  }
  const shattered = hits.some(h => h.gone && h.shatters >= 1);
  const weak = hits.filter(h => h.dmg === 38 && h.weak).length >= 2;
  check('raid pointer ' + tag + ' has a live enemy before the wall', actors.mobs >= 1 && actors.you > 0 && actors.scene === 'arena', JSON.stringify(actors));
  check('raid pointer ' + tag + ' empty ground does not hit the wall', !spot.farHitsWall && afterEmpty.hp === 90 && afterEmpty.dmg === 0, JSON.stringify(afterEmpty));
  check('raid pointer ' + tag + ' swipe steps and does not hit the wall', q1 !== spot.q && afterSwipe.hp === 90, 'q ' + spot.q + ' to ' + q1);
  check('raid pointer ' + tag + ' cancel does not hit the wall', afterCancel.hp === 90, JSON.stringify(afterCancel));
  check('raid pointer ' + tag + ' Frost on the wall does not damage it', afterFrost.sel === 1 && afterFrost.hp === 90, JSON.stringify(afterFrost));
  check('raid pointer ' + tag + ' shows Ice wall while held', ring.aiming === true && ring.kind === 'wall', JSON.stringify(ring));
  check('raid pointer ' + tag + ' Ember hold is weak 38 and shatters', weak && shattered, JSON.stringify(hits));
  await p.close();
}
fs.mkdirSync(OUT, { recursive: true });
await raidWallPointer(390, 844, false, { before: 'raid_play_before.png', ring: 'raid_aim_ring.png', after: 'raid_after_tac.png' });
await raidWallPointer(390, 844, true, { after: 'raid_after_low.png' });
await raidWallPointer(320, 568, false, null);
await raidWallPointer(320, 568, true, null);
await raidWallPointer(844, 390, false, null);
await raidWallPointer(844, 390, true, null);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function touchApi(page) {
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  let n = 10;
  const pt = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 0.5, radiusY: 0.5, force: 0.5 });
  return {
    async down(x, y) { const id = ++n; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(id, x, y)] }); return id; },
    async move(id, x, y) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(id, x, y)] }); },
    async up(id, x, y) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pt(id, x, y)] }); },
    async cancel() { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); },
  };
}
async function enterRaid(p) {
  await p.evaluate(() => {
    window.__train.TRAIN.on = false;
    document.getElementById('trainHud').classList.add('hide');
    window.__train.openMapNav();
    const MAP = window.__aro.MAP, dome = MAP.list.find(t => t.ter === 'dome');
    const near = MAP.list.find(t => !t.edge && t.ter !== 'water' && (Math.abs(t.q - dome.q) + Math.abs(t.r - dome.r) + Math.abs(t.q + t.r - dome.q - dome.r)) / 2 === 1);
    Object.assign(MAP.house, { q: near.q, r: near.r, x: near.x, y: near.y, mode: 'park' });
    window.__aro.G.step = 2;
  });
  await p.evaluate(() => window.__train.goPlace(1, -3));
  await p.waitForFunction(() => document.getElementById('act').textContent.includes('Enter the raid'), { timeout: 8000 });
  await p.click('#act');
  await p.waitForFunction(() => window.__aro.AR.phase === 'block', { timeout: 4000 });
}
async function btnCenter(page, sel) {
  const b = await page.$(sel);
  if (!b) return null;
  const r = await b.boundingBox();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}
async function raidTouch(w, h, low) {
  const p = await open(w, h);
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  const touch = await touchApi(p);
  await p.evaluate(() => {
    window.__ptrTypes = [];
    document.getElementById('cv').addEventListener('pointerdown', e => window.__ptrTypes.push(e.pointerType), true);
  });
  await enterRaid(p);
  if (low) await p.click('#roomLow');
  await p.mouse.click(w / 2, Math.min(h * 0.42, h - 120));
  await sleep(350);
  await p.evaluate(() => { for (let i = 0; i < 16; i++) window.__train.stepArena(0.05); });
  await p.click('#iceWall');
  await sleep(120);
  const pot = await p.$('#manaPot');
  if (pot) await pot.click();
  const spot = await p.evaluate(() => {
    const wall = window.__aro.FIELD.wall;
    if (!wall) return null;
    const cam = window.__aro.AR.cam;
    const mid = proj(cam, wall.cx, wall.cy);
    const far = proj(cam, 0, -2);
    let mob = null;
    for (const m of window.__aro.AR.mobs) {
      if (m.state !== 'live') continue;
      const s = proj(cam, m.x, m.y - 0.35);
      const el = document.elementFromPoint(s[0], s[1]);
      if (!el || el.id !== 'cv' || !mobAt(s[0], s[1])) continue;
      const world = unproj(cam, s[0], s[1]);
      if (aimedOwnWall({ x: world[0], y: world[1] })) continue;
      m.__mark = 1;
      mob = { x: s[0], y: s[1], hp: m.hp };
      break;
    }
    return { aim: { x: mid[0], y: mid[1] }, far: { x: far[0], y: far[1] }, mob, q: window.__aro.AR.ph.q };
  });
  const tag = 'touch ' + w + 'x' + h + (low ? ' low' : ' tactical');
  const wall = () => p.evaluate(() => { const w = window.__aro.FIELD.wall; return w ? { hp: w.hp, dmg: w.lastDmg, weak: !!w.lastWeak } : { gone: true, shatters: window.__aro.FIELD.shatters }; });
  const waitCd = () => p.waitForFunction(() => window.__aro.AR.cds[0] <= 0, { timeout: 3000 }).catch(() => {});
  if (!spot) { check(tag + ' raises a wall', false, 'no wall'); await p.close(); return; }
  const hold = async (x, y, ms) => { const id = await touch.down(x, y); await sleep(ms); await touch.up(id, x, y); };
  await hold(spot.far.x, spot.far.y, 450);
  const afterEmpty = await wall();
  await waitCd();
  let enemy = null;
  const mobNow = await p.evaluate(() => {
    const cam = window.__aro.AR.cam;
    for (const m of window.__aro.AR.mobs) {
      if (m.state !== 'live') continue;
      const s = proj(cam, m.x, m.y - 0.35);
      const el = document.elementFromPoint(s[0], s[1]);
      if (!el || el.id !== 'cv' || !mobAt(s[0], s[1])) continue;
      const world = unproj(cam, s[0], s[1]);
      if (aimedOwnWall({ x: world[0], y: world[1] })) continue;
      m.__mark = 1;
      return { x: s[0], y: s[1], hp: m.hp };
    }
    return null;
  });
  if (mobNow) {
    const wallBefore = (await wall()).hp;
    await hold(mobNow.x, mobNow.y, 280);
    await sleep(400);
    enemy = await p.evaluate(() => {
      const m = window.__aro.AR.mobs.find(m => m.__mark);
      const w = window.__aro.FIELD.wall;
      return { hp: m ? m.hp : null, wall: w && w.hp };
    });
    enemy.start = mobNow.hp;
    enemy.wallBefore = wallBefore;
  }
  await waitCd();
  const sx = spot.far.x, sy = spot.far.y;
  const hpBeforeSwipe = (await wall()).hp;
  let q1 = spot.q;
  let afterSwipe = await wall();
  for (let attempt = 0; attempt < 2 && q1 === spot.q; attempt++) {
    const swipeId = await touch.down(sx, sy);
    await sleep(40);
    await touch.move(swipeId, sx + 90, sy);
    await sleep(30);
    await touch.up(swipeId, sx + 90, sy);
    await sleep(50);
    q1 = await p.evaluate(() => window.__aro.AR.ph.q);
    afterSwipe = await wall();
  }
  if (q1 === spot.q) {
    const flick = await p.touchscreen.touchStart(spot.far.x, spot.far.y);
    await sleep(20);
    await flick.move(spot.far.x + 110, spot.far.y);
    await flick.end();
    await sleep(40);
    q1 = await p.evaluate(() => window.__aro.AR.ph.q);
    afterSwipe = await wall();
  }
  const qBeforeDodge = q1;
  const dodgeId = await touch.down(spot.far.x, spot.far.y);
  for (const sel of ['dodgeL', 'dodgeR']) {
    const now = await p.evaluate(() => window.__aro.AR.ph.q);
    const el = await p.$('#' + sel);
    if (el) { try { await el.tap(); } catch { /* a later pointerdown covers a missed tap */ } }
    await sleep(30);
    let next = await p.evaluate(() => window.__aro.AR.ph.q);
    if (next === now) {
      await p.evaluate(id => {
        const b = document.getElementById(id);
        const r = b.getBoundingClientRect();
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
      }, sel);
      next = await p.evaluate(() => window.__aro.AR.ph.q);
    }
    if (next !== now) break;
  }
  await touch.up(dodgeId, spot.far.x, spot.far.y);
  const qDodge = await p.evaluate(() => window.__aro.AR.ph.q);
  const afterDodge = await wall();
  const first = await touch.down(spot.aim.x, spot.aim.y);
  let ring = 'none';
  for (let i = 0; i < 12 && ring === 'none'; i++) {
    await sleep(80);
    ring = await p.evaluate(() => {
      const ptr = window.__aro.AR.ptr;
      return ptr && ptr.aiming ? raidAimKind(ptr.x, ptr.y, ptr.aim) : 'none';
    });
  }
  const second = await touch.down(spot.far.x, spot.far.y);
  await sleep(40);
  await touch.up(second, spot.far.x, spot.far.y);
  const duringSecond = await wall();
  await sleep(700);
  await touch.up(first, spot.aim.x, spot.aim.y);
  await sleep(40);
  const afterFirst = await wall();
  const cancelId = await touch.down(spot.aim.x, spot.aim.y);
  await sleep(80);
  await touch.cancel();
  await sleep(40);
  const afterCancel = await wall();
  const ptrAfterCancel = await p.evaluate(() => window.__aro.AR.ptr);
  const beforeSpell = afterCancel.hp;
  const spellHold = await touch.down(spot.aim.x, spot.aim.y);
  await sleep(200);
  await p.click('.sp[data-i="1"]');
  await sleep(40);
  await touch.up(spellHold, spot.aim.x, spot.aim.y);
  const afterSpell = await p.evaluate(() => ({ hp: window.__aro.FIELD.wall && window.__aro.FIELD.wall.hp, sel: window.__aro.AR.sel, ptr: !!window.__aro.AR.ptr }));
  await p.click('.sp[data-i="0"]');
  await waitCd();
  const hits = [afterFirst];
  for (let i = 0; i < 3 && (await wall()).hp; i++) {
    const pt = await p.evaluate(() => { const wall = window.__aro.FIELD.wall; const s = proj(window.__aro.AR.cam, wall.cx, wall.cy); return { x: s[0], y: s[1] }; });
    await hold(pt.x, pt.y, 1050);
    hits.push(await wall());
    await waitCd();
  }
  const types = await p.evaluate(() => window.__ptrTypes);
  const shattered = hits.some(h => h.gone && h.shatters >= 1);
  check(tag + ' events are touch', types.includes('touch'), JSON.stringify(types.slice(0, 6)));
  check(tag + ' empty ground does not hit the wall', afterEmpty.hp === 90 && afterEmpty.dmg === 0, JSON.stringify(afterEmpty));
  check(tag + ' enemy is not a wall hit', !enemy || enemy.wall === enemy.wallBefore, JSON.stringify(enemy));
  check(tag + ' touch flick steps and does not hit the wall', q1 !== spot.q && afterSwipe.hp === hpBeforeSwipe, 'q ' + spot.q + ' to ' + q1 + ' hp ' + hpBeforeSwipe + ' -> ' + afterSwipe.hp);
  check(tag + ' dodge still steps during a press', qDodge !== qBeforeDodge && afterDodge.hp === afterSwipe.hp, 'q ' + qBeforeDodge + ' to ' + qDodge + ' hp ' + JSON.stringify(afterDodge));
  const onWall = ring === 'wall' && duringSecond.hp === afterDodge.hp && afterFirst.dmg === 38 && afterFirst.weak;
  const noAccidental = duringSecond.hp === afterDodge.hp && afterFirst.hp === afterDodge.hp;
  check(tag + ' second finger does not cast and the first finger does not hit the wrong target', onWall || noAccidental, JSON.stringify({ ring, duringSecond, afterFirst }));
  check(tag + ' touch cancel does not hit', afterCancel.hp === afterFirst.hp && !ptrAfterCancel, JSON.stringify({ afterFirst, afterCancel }));
  check(tag + ' spell switch then release does not hit the wall', afterSpell.sel === 1 && afterSpell.hp === beforeSpell && !afterSpell.ptr, JSON.stringify(afterSpell));
  check(tag + ' center holds of about a second shatter', shattered && hits.some(h => h.dmg === 38 && h.weak), JSON.stringify(hits));
  await p.close();
}
for (const [w, h] of [[390, 844], [320, 568], [844, 390]]) {
  for (const low of [false, true]) await raidTouch(w, h, low);
}

const orient = await open(390, 844);
await orient.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
const orientTouch = await touchApi(orient);
await enterRaid(orient);
await orient.mouse.click(195, 340);
await sleep(300);
await orient.evaluate(() => { for (let i = 0; i < 12; i++) window.__train.stepArena(0.05); });
await orient.click('#iceWall');
await sleep(100);
const orientAim = await orient.evaluate(() => { const wall = window.__aro.FIELD.wall; const s = proj(window.__aro.AR.cam, wall.cx, wall.cy); return { x: s[0], y: s[1], hp: wall.hp }; });
const orientId = await orientTouch.down(orientAim.x, orientAim.y);
await sleep(200);
await orient.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true });
await sleep(80);
await orientTouch.up(orientId, orientAim.x, orientAim.y);
const orientAfter = await orient.evaluate(() => ({ hp: window.__aro.FIELD.wall && window.__aro.FIELD.wall.hp, ptr: !!window.__aro.AR.ptr, w: innerWidth, h: innerHeight }));
check('touch orientation change drops the press', orientAfter.hp === 90 && !orientAfter.ptr && orientAfter.w === 844, JSON.stringify(orientAfter));
const lowBtn = await btnCenter(orient, '#roomLow');
const again = await orient.evaluate(() => { const wall = window.__aro.FIELD.wall; const s = proj(window.__aro.AR.cam, wall.cx, wall.cy); return wall ? { x: s[0], y: s[1] } : null; });
if (again && lowBtn) {
  const id = await orientTouch.down(again.x, again.y);
  await sleep(180);
  await orient.click('#roomLow');
  await sleep(40);
  await orientTouch.up(id, again.x, again.y);
}
const lowDrop = await orient.evaluate(() => ({ hp: window.__aro.FIELD.wall && window.__aro.FIELD.wall.hp, low: document.getElementById('roomLow').textContent, ptr: !!window.__aro.AR.ptr }));
check('touch Low switch drops the press and does not hit', lowDrop.hp === 90 && lowDrop.low === 'Low on' && !lowDrop.ptr, JSON.stringify(lowDrop));
await orient.close();

const yard = await open(390, 844);
await yard.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
const yardTouch = await touchApi(yard);
await yard.evaluate(() => { window.__train.startTrain(); window.__train.setClass('mage'); window.__train.TRAIN.casts = 0; window.__train.TRAIN.demo = false; });
const disc = await yard.evaluate(() => window.__train.discCenter());
const yardId = await yardTouch.down(disc.x, disc.y);
await sleep(250);
const grabbed = await yard.evaluate(() => !!window.__train.TRAIN.cap);
await yard.evaluate(() => document.getElementById('trainPractice').click());
await yard.click('#trainReset');
await sleep(40);
await yardTouch.up(yardId, disc.x, disc.y);
const afterReset = await yard.evaluate(() => ({ casts: window.__train.TRAIN.casts, on: window.__train.TRAIN.on, cap: !!window.__train.TRAIN.cap }));
check('touch release after Reset does not cast', grabbed && afterReset.casts === 0 && afterReset.on && !afterReset.cap, JSON.stringify({ grabbed, afterReset }));
const disc2 = await yard.evaluate(() => { window.__train.TRAIN.casts = 0; return window.__train.discCenter(); });
const yardId2 = await yardTouch.down(disc2.x, disc2.y);
await sleep(200);
const backNow = await yard.evaluate(() => { document.getElementById('trainBack').click(); return { on: window.__train.TRAIN.on, scene: window.__aro.G.scene }; });
await yardTouch.up(yardId2, 2, 2);
const afterBack = await yard.evaluate(() => ({ casts: window.__train.TRAIN.casts, on: window.__train.TRAIN.on, scene: window.__aro.G.scene }));
check('touch release after Back does not cast', afterBack.casts === 0 && !afterBack.on && !backNow.on, JSON.stringify({ backNow, afterBack }));
await yard.close();

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
check('phone frame draws a dummy and the player', colors.head[0] > 55 || colors.body[0] > 40, JSON.stringify(colors));
await shot.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
await shot.evaluate(() => { resize(); window.__aro.AR.floorDirty = true; window.__train.TRAIN.demo = false; showCast(''); });
await frame(shot, 'play_land.png');
await shot.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await shot.evaluate(() => { resize(); window.__train.setTrainView('tactical'); window.__train.TRAIN.demo = false; syncAutoBtn(); showCast(''); });
await frame(shot, 'tac_before.png');
await shot.evaluate(() => { window.__train.setTrainView('low'); window.__train.TRAIN.demo = false; syncAutoBtn(); showCast(''); });
await frame(shot, 'low_after.png');
await shot.close();

const yardLook = await open(390, 844);
const look = await yardLook.evaluate(() => {
  window.__aroFreeze = true;
  window.__train.startTrain();
  window.__train.setClass('mage');
  window.__train.setTrainView('tactical');
  const info = window.__train.yardFloorInfo();
  const world = { x: Math.sqrt(3) * (2 + -2 / 2), y: 1.5 * -2 };
  window.__train.TRAIN.aim = world;
  window.__profile.setLoadout('mage', ['ember', 'frost', 'slash']);
  window.__train.TRAIN.sel.mage = 0;
  window.__train.TRAIN.cap = { part: 'center', aimed: true, i: 0, x0: 0, y0: 0 };
  const before = { hex: window.__aro.FIELD.hex.size, terr: window.__aro.FIELD.terr.size };
  const ember = window.__train.yardPreviewHexes().map(h => h.join(','));
  window.__train.TRAIN.sel.mage = 2;
  const slash = window.__train.yardPreviewHexes();
  const afterPreview = { hex: window.__aro.FIELD.hex.size, terr: window.__aro.FIELD.terr.size };
  const [px, py] = [window.__aro.AR.ppx, window.__aro.AR.ppy];
  let dx = world.x - px, dy = world.y - py; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const x0 = px + dx * .9, y0 = py + dy * .9, x1 = world.x + dx * 1.6, y1 = world.y + dy * 1.6;
  const expected = hexesOnLine(x0, y0, x1, y1).map(h => h.join(',')).sort();
  const got = slash.map(h => h.join(',')).sort();
  const dug = slashLine(x0, y0, x1, y1).map(h => h.join(',')).sort();
  const terr = [...window.__aro.FIELD.terr.keys()].sort();
  const hit = window.__aro.hexScreen(2, -2);
  const w = unproj(window.__aro.AR.cam, hit.x, hit.y);
  const backHex = xyHex(w[0], w[1]);
  window.__aro.zoneTest('slam', [[0, 1], [1, 1]], { warn: 2, act: 2 });
  return {
    info, ember, expected, got, dug, terr,
    before, afterPreview,
    same: expected.join('|') === got.join('|') && expected.join('|') === dug.join('|') && expected.join('|') === terr.join('|'),
    backHex, zones: window.__aro.AR.zones.length,
  };
});
check('yard hides the idle grid without leaving the yard', look.info.yard && look.info.grid === 'hidden' && look.info.spare === false, JSON.stringify(look.info));
check('aim preview names the hex and does not paint it', look.ember[0] === '2,-2' && look.before.hex === look.afterPreview.hex && look.before.terr === look.afterPreview.terr, JSON.stringify(look.ember));
check('slash preview matches the real per-hex cut', look.same && look.expected.length >= 1, JSON.stringify({ n: look.expected.length, got: look.got, terr: look.terr }));
check('hidden outlines still map a tap back to that hex', look.backHex && look.backHex[0] === 2 && look.backHex[1] === -2, JSON.stringify(look.backHex));
check('a danger zone still exists to draw', look.zones === 1, JSON.stringify(look.zones));
await yardLook.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
const spare = await yardLook.evaluate(() => { resize(); window.__aro.AR.floorDirty = true; return window.__train.yardFloorInfo(); });
check('landscape yard uses the simpler surface', spare.yard && spare.spare === true && spare.grid === 'hidden', JSON.stringify(spare));
const perf = await yardLook.evaluate(() => new Promise(res => {
  window.__aroFreeze = false;
  window.__aro.AR.zones = [];
  let n = 0, worst = 0, prev = performance.now(), t0 = prev;
  const tick = now => {
    const dt = now - prev; prev = now; if (n && dt > worst) worst = dt; n++;
    if (n < 45) requestAnimationFrame(tick);
    else res({ frames: n, ms: Math.round(now - t0), worst: Math.round(worst), fps: Math.round(n / ((now - t0) / 1000)) });
  };
  requestAnimationFrame(tick);
}));
console.log('PERF yard desktop ' + JSON.stringify(perf));
check('yard frames finish on this desktop', perf.frames === 45 && perf.worst < 1000, JSON.stringify(perf));
await yardLook.close();

const lay = await open(844, 390);
const layErrors = [];
lay.on('pageerror', err => layErrors.push(String(err && err.message || err)));
const yardLay = await lay.evaluate(async () => {
  window.__train.startTrain();
  window.__train.resetTrain();
  window.__train.setClass('mage');
  window.__train.setTrainView('tactical');
  resize();
  const tucked = id => {
    const el = document.getElementById(id);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width < 2 || r.height < 2;
  };
  const hiddenBefore = ['viewTac', 'viewLow', 'trainReset', 'trainAuto', 'trainHelpBtn', 'trainNote'].every(tucked);
  document.getElementById('trainPractice').click();
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 80));
    const dodge = document.getElementById('dodgeL').getBoundingClientRect();
    if (dodge.top >= 0 && dodge.bottom <= innerHeight + 1) break;
  }
  const box = id => {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el || el.classList.contains('hide')) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const pe = getComputedStyle(el).pointerEvents;
    return { id: el.id || 'spell', l: r.left, t: r.top, r: r.right, b: r.bottom, pe };
  };
  const nodes = ['viewTac', 'viewLow', 'viewFp', 'trainClass', 'trainReset', 'trainBack', 'trainAuto', 'trainDemo', 'trainHelpBtn', 'cellBtn', 'itemBoard', 'dodgeL', 'dodgeR', 'iceWall', 'castFeed'].map(box).filter(Boolean);
  document.querySelectorAll('#spells .sp').forEach((el, i) => { const b = box(el); if (b) { b.id = 'spell' + i; nodes.push(b); } });
  const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const overlaps = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (area(nodes[i], nodes[j]) > 12) overlaps.push(nodes[i].id + ' x ' + nodes[j].id);
  const off = nodes.filter(n => n.l < -1 || n.t < -1 || n.r > innerWidth + 1 || n.b > innerHeight + 1).map(n => n.id);
  const cx = innerWidth / 2, cy = innerHeight * 0.4;
  const covering = nodes.filter(n => n.pe !== 'none' && cx >= n.l && cx <= n.r && cy >= n.t && cy <= n.b).map(n => n.id);
  const feed = nodes.find(n => n.id === 'castFeed'), dodge = nodes.find(n => n.id === 'dodgeL');
  const cv = document.getElementById('cv'), dpr = cv.width / innerWidth, g = cv.getContext('2d');
  const pix = (x, y) => { const d = g.getImageData(Math.max(0, Math.min(cv.width - 1, x * dpr | 0)), Math.max(0, Math.min(cv.height - 1, y * dpr | 0)), 1, 1).data; return [d[0], d[1], d[2]]; };
  const a = window.__aro.hexScreen(0, 0), b = window.__aro.hexScreen(1, 0);
  const seam = pix((a.x + b.x) / 2, (a.y + b.y) / 2);
  document.getElementById('trainReset').click();
  const resetLine = document.getElementById('castFeed').textContent;
  showCast('Hold the center · full fires once · the message stays beside the ring');
  const longFeed = box('castFeed');
  const disc = window.__train.discCenter(), R = window.__train.discRadius();
  const nearDisc = (b) => {
    if (!b) return false;
    const cx = Math.max(b.l, Math.min(disc.x, b.r)), cy = Math.max(b.t, Math.min(disc.y, b.b));
    return (cx - disc.x) ** 2 + (cy - disc.y) ** 2 < (R + 6) ** 2;
  };
  const longHits = nodes.filter(n => n.id !== 'castFeed' && longFeed && area(n, longFeed) > 12).map(n => n.id);
  const ds = window.__aro.AR.mobs.filter(m => m.dummy);
  window.__aro.shadowSlash({ x: ds[0].x, y: ds[0].y });
  for (let i = 0; i < 30; i++) window.__train.stepArena(0.05);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const labels = (window.__train.TRAIN.labels || []).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h || 16, n: b.n || '' }));
  const labelHits = [];
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const A = labels[i], B = labels[j];
    if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 + 4 && Math.abs(A.y - B.y) < (A.h + B.h) / 2) labelHits.push(i + ':' + j);
  }
  const labelOff = labels.filter(b => b.x - b.w / 2 < 2 || b.x + b.w / 2 > innerWidth - 2 || b.y - 14 < 2 || b.y > innerHeight - 2);
  const boxHits = (b, L, T, R, B) => (b.x + b.w / 2) > L && (b.x - b.w / 2) < R && (b.y + 4) > T && (b.y - 14) < B;
  const player = window.__train.playerMark();
  const onBody = labels.filter(b => boxHits(b, player.x - player.h * 0.42, player.y - player.h - 34, player.x + player.h * 0.42, player.y + 4)).map(b => b.n);
  const onPost = [];
  for (const b of labels) for (const m of window.__train.dummyMarks()) {
    const left = b.x - b.w / 2, right = b.x + b.w / 2, top = b.y - 14, bot = b.y + 4;
    const qx = Math.max(left, Math.min(right, m.x)), qy = Math.max(top, Math.min(bot, m.y));
    if ((qx - m.x) ** 2 + (qy - m.y) ** 2 < m.r * m.r) onPost.push(b.n + '@' + m.n);
  }
  const ob = document.getElementById('obj').getBoundingClientRect();
  const onBanner = labels.filter(b => boxHits(b, ob.left, ob.top, ob.right, ob.bottom)).map(b => b.n);
  const onFeed = labels.filter(b => longFeed && boxHits(b, longFeed.l, longFeed.t, longFeed.r, longFeed.b)).map(b => b.n);
  return { hiddenBefore, overlaps, off, covering, feedOnDodge: feed && dodge ? area(feed, dodge) : -1, seam, n: nodes.length, feed: resetLine, terr: window.__aro.FIELD.terr.size, longHits, onRing: nearDisc(longFeed), labels: labels.length, labelHits, labelOff: labelOff.length, onBody, onPost, onBanner, onFeed };
});
check('practice chrome stays hidden until Practice', yardLay.hiddenBefore, JSON.stringify(yardLay.hiddenBefore));
check('landscape controls stay on screen and off each other', yardLay.off.length === 0 && yardLay.overlaps.length === 0 && yardLay.n >= 14, JSON.stringify({ off: yardLay.off, overlaps: yardLay.overlaps, n: yardLay.n }));
check('landscape cast line does not cover the dodge', yardLay.feedOnDodge === 0, JSON.stringify(yardLay.feedOnDodge));
check('landscape center of the field is not a button', yardLay.covering.length === 0, JSON.stringify(yardLay.covering));
check('landscape reset still writes the cast line', /Dummies reset|Round/.test(yardLay.feed), yardLay.feed);
check('yard seam reads as stone rather than a black gap', yardLay.seam[0] > 55 && yardLay.seam[1] > 40, JSON.stringify(yardLay.seam));
check('a negative-column slash does not throw while drawing', layErrors.length === 0 && yardLay.terr > 0, JSON.stringify(layErrors));
check('landscape cast line stays off the spell ring and the other controls', yardLay.onRing === false && yardLay.longHits.length === 0, JSON.stringify({ onRing: yardLay.onRing, longHits: yardLay.longHits }));
check('dummy names stay apart and on screen', yardLay.labels >= 3 && yardLay.labelHits.length === 0 && yardLay.labelOff === 0, JSON.stringify(yardLay));
check('dummy names stay off the posts, the avatar, and the round banner', yardLay.onBody.length === 0 && yardLay.onPost.length === 0 && yardLay.onBanner.length === 0 && yardLay.onFeed.length === 0, JSON.stringify({ onBody: yardLay.onBody, onPost: yardLay.onPost, onBanner: yardLay.onBanner, onFeed: yardLay.onFeed }));
await lay.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const dodgePort = await lay.evaluate(async () => {
  resize();
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 80));
    const d = document.getElementById('dodgeL').getBoundingClientRect();
    if (d.left >= 0 && d.right <= innerWidth) break;
  }
  const read = id => {
    const el = document.getElementById(id), r = el.getBoundingClientRect();
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return { id, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, click: !!(hit && (hit.id === id || hit.closest('#' + id))) };
  };
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const labels = (window.__train.TRAIN.labels || []).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h || 16, n: b.n || '' }));
  const labelHits = [];
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const A = labels[i], B = labels[j];
    if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 + 4 && Math.abs(A.y - B.y) < (A.h + B.h) / 2) labelHits.push(i + ':' + j);
  }
  const labelOff = labels.filter(b => b.x - b.w / 2 < 2 || b.x + b.w / 2 > innerWidth - 2 || b.y - 14 < 2 || b.y > innerHeight - 2);
  const boxHits = (b, L, T, R, B) => (b.x + b.w / 2) > L && (b.x - b.w / 2) < R && (b.y + 4) > T && (b.y - 14) < B;
  const player = window.__train.playerMark();
  const onBody = labels.filter(b => boxHits(b, player.x - player.h * 0.42, player.y - player.h - 34, player.x + player.h * 0.42, player.y + 4)).map(b => b.n);
  const onPost = [];
  for (const b of labels) for (const m of window.__train.dummyMarks()) {
    const left = b.x - b.w / 2, right = b.x + b.w / 2, top = b.y - 14, bot = b.y + 4;
    const qx = Math.max(left, Math.min(right, m.x)), qy = Math.max(top, Math.min(bot, m.y));
    if ((qx - m.x) ** 2 + (qy - m.y) ** 2 < m.r * m.r) onPost.push(b.n + '@' + m.n);
  }
  return { W: innerWidth, H: innerHeight, L: read('dodgeL'), R: read('dodgeR'), labels: labels.length, labelHits, labelOff: labelOff.length, onBody, onPost };
});
const dodgeIn = (d, W, H) => d.l >= 0 && d.r <= W + 0.5 && d.t >= 0 && d.b <= H + 0.5 && d.w >= 44 && d.h >= 44 && d.click;
check('portrait dodge chevrons are fully on screen and clickable', dodgeIn(dodgePort.L, dodgePort.W, dodgePort.H) && dodgeIn(dodgePort.R, dodgePort.W, dodgePort.H), JSON.stringify(dodgePort));
check('portrait dummy names stay apart, on screen, and off the posts and the avatar', dodgePort.labels >= 3 && dodgePort.labelHits.length === 0 && dodgePort.labelOff === 0 && dodgePort.onBody.length === 0 && dodgePort.onPost.length === 0, JSON.stringify(dodgePort));
await lay.close();

const nodePage = await open(390, 844);
const nodeObj = await nodePage.evaluate(() => {
  startArena('hack', () => {});
  AR.phase = 'nodes';
  AR.wave = 0;
  AR.mobs = HACK_NODES.map((s, j) => mkMob(s, 0));
  AR.mobs.forEach(m => { m.state = 'live'; });
  AR.objT = null;
  arenaObjective();
  return document.getElementById('obj').textContent;
});
check('hack nodes are counted as nodes, not as wave 1 of 1', /3 nodes left/.test(nodeObj) && !/Wave 1\/1/.test(nodeObj), nodeObj);
await nodePage.close();

const core = await open(390, 844);
const coreErr = [];
core.on('pageerror', err => coreErr.push(String(err && err.message || err)));
const day = await core.evaluate(async () => {
  const bag = () => JSON.parse(JSON.stringify(window.__aro.G.bag));
  const snap = () => ({ bag: bag(), aether: window.__aro.G.aether, caps: window.__aro.G.caps, mobs: window.__aro.G.day.mobs, fish: window.__aro.G.bag.fish || 0 });
  startDay();
  const pollenBefore = bag().pollen;
  wakeUp();
  wakeUp();
  const wokeOnce = window.__aro.G.step === 2 && bag().pollen === pollenBefore && window.__aro.G.day.woke === true;
  const dome = tileAt(1, -3);
  window.__aro.MAP.house.q = dome.q; window.__aro.MAP.house.r = dome.r;
  onArrive(dome);
  syncMapNav();
  const enter = document.getElementById('act').textContent;
  const actBox = document.getElementById('act').getBoundingClientRect();
  const navBox = document.getElementById('mapNav').getBoundingClientRect();
  const actClear = actBox.left >= navBox.right - 1 && actBox.right <= innerWidth + 1 && actBox.bottom <= innerHeight + 1;
  const actHit = document.elementFromPoint((actBox.left + actBox.right) / 2, (actBox.top + actBox.bottom) / 2);
  startArena('raid', afterRaid);
  await new Promise(r => setTimeout(r, 1400));
  punchBlock();
  const killWave = async () => {
    for (let n = 0; n < 8; n++) {
      for (const m of window.__aro.AR.mobs) if (m.state !== 'gone' && m.state !== 'dying') { m.hp = 0; m.state = 'dying'; m.st = 0.4; }
      window.__train.stepArena(0.05);
      await new Promise(r => setTimeout(r, 40));
      if (window.__aro.AR.phase === 'clear') return;
      if (window.__aro.AR.phase === 'between') await new Promise(r => setTimeout(r, 1200));
    }
  };
  await killWave();
  const cleared = snap();
  const obj = document.getElementById('obj').textContent;
  const phaseClear = window.__aro.AR.phase;
  rewind();
  await killWave();
  const afterRewind = snap();
  const sameLoot = JSON.stringify(cleared) === JSON.stringify(afterRewind);
  document.getElementById('act').click();
  const afterLeave = { step: window.__aro.G.step, scene: window.__aro.G.scene, phase: window.__aro.AR.phase };
  const caps0 = window.__aro.G.caps, ae0 = window.__aro.G.aether, spot0 = window.__aro.G.bag.spot || 0;
  claimEnd(); claimEnd();
  const claimOnce = window.__aro.G.caps === caps0 + 1 && window.__aro.G.aether === ae0 + 3 && (window.__aro.G.bag.spot || 0) === spot0 + 1;
  const fish0 = snap();
  openFish();
  FI.grade = 'Good'; FI.hits = 3; FI.phase = 'reel';
  landFish(); landFish();
  const fishOnce = (window.__aro.G.bag.fish || 0) === (fish0.fish + 1) && window.__aro.G.aether === fish0.aether + 3;
  const summaryFish = document.getElementById('sumBody') ? '' : '';
  endDay();
  await new Promise(r => setTimeout(r, 1000));
  const sum = document.getElementById('sumM').classList.contains('on');
  const sumText = document.getElementById('sumBody').textContent;
  const again = document.getElementById('again').textContent;
  return { wokeOnce, enter, actClear, actHit: actHit && (actHit.id || actHit.tagName), phaseClear, obj, cleared, afterRewind, sameLoot, afterLeave, claimOnce, fishOnce, sum, sumText: sumText.slice(0, 280), again, waves: window.__aro.AR.waves.length };
});
check('the day wakes once and the dome button is clear of the map shortcuts', day.wokeOnce && /Enter the raid dome/.test(day.enter) && day.actClear && day.actHit === 'act', JSON.stringify({ woke: day.wokeOnce, enter: day.enter, actClear: day.actClear, hit: day.actHit }));
check('one raid clear pays each mob once and a rewind does not pay again', day.phaseClear === 'clear' && day.sameLoot && day.cleared.mobs >= 5 && day.cleared.bag.gel >= 5 && /Clear/.test(day.obj), JSON.stringify({ phase: day.phaseClear, obj: day.obj, cleared: day.cleared, after: day.afterRewind }));
check('leaving a cleared raid continues the day', day.afterLeave.step === 4 && day.afterLeave.scene === 'map', JSON.stringify(day.afterLeave));
check('a hack claim and a pond fish each pay once', day.claimOnce && day.fishOnce, JSON.stringify({ claim: day.claimOnce, fish: day.fishOnce }));
check('the day can finish and names the pond fish, not a creature', day.sum && /Fish/.test(day.sumText) && /pond/.test(day.sumText) && !/Catch/.test(day.sumText) && /Play the day again/.test(day.again), JSON.stringify({ sum: day.sum, again: day.again, text: day.sumText }));
check('the day flow does not throw', coreErr.length === 0, JSON.stringify(coreErr));
await core.close();

const goldPage = await open(844, 390);
const gold = await goldPage.evaluate(async () => {
  const boba = document.querySelector('.race[data-r="slime"]');
  const before = { race: G.race, form: G.form, name: boba.querySelector('b').textContent, small: boba.querySelector('small').textContent };
  const loaded = await window.__gold.open();
  const during = { race: G.race, form: G.form, field: G.fieldAvatar, open: !document.getElementById('goldBox').classList.contains('hide') };
  window.__gold.draw('side');
  const side = document.querySelector('#goldViews button.on').dataset.v;
  const bake = await window.__gold.bake();
  const chosen = { field: G.fieldAvatar, race: G.race, source: bake.manifest && bake.manifest.sourceSha256, tris: bake.manifest && bake.manifest.triangles, views: bake.manifest && Object.keys(bake.manifest.spriteSha256 || {}), skins: bake.manifest && bake.manifest.skins, anims: bake.manifest && bake.manifest.animations };
  window.__gold.close();
  boba.click();
  const after = { race: G.race, form: G.form, field: G.fieldAvatar, name: boba.querySelector('b').textContent, sel: document.querySelector('.race.sel b').textContent, closed: document.getElementById('goldBox').classList.contains('hide'), btn: document.getElementById('goldBtn').textContent };
  return { before, loaded, during, side, bakeOk: bake.ok, chosen, after, sha: window.__gold.sha };
});
check('Original Gold is the hashed mesh and does not replace Boba', gold.loaded.ok && gold.loaded.tris === 118790 && gold.loaded.hash === gold.sha && gold.sha === '54b1f5c7bef848ab2ae364655296214e693e8f3aa196728d071a26413b5fd5aa' && gold.during.race === 'human' && gold.during.field === '' && gold.before.name === 'Boba' && gold.after.race === 'slime' && gold.after.form === 'boba' && gold.after.field === '' && gold.after.sel === 'Boba' && gold.after.closed && gold.side === 'side' && gold.bakeOk && gold.chosen.field === 'gold' && gold.chosen.race === 'human' && gold.chosen.source === gold.sha && gold.chosen.tris === 118790 && gold.chosen.skins === 0 && gold.chosen.anims === 0 && gold.chosen.views.length === 3, JSON.stringify(gold));
await goldPage.close();

const fishPage = await open(844, 390);
const fishErr = [];
fishPage.on('pageerror', err => fishErr.push(String(err && err.message || err)));
await fishPage.waitForFunction(() => window.__fish && window.__fish.fishCam && window.__fish.fishCam().painted, { timeout: 8000 });
const fish = await fishPage.evaluate(() => {
  window.__aroFreeze = true;
  startDay();
  wakeUp();
  const home = tileAt(0, 0);
  MAP.house.q = home.q; MAP.house.r = home.r; MAP.house.x = home.x; MAP.house.y = home.y; MAP.house.face = 1; MAP.avOut = true;
  const ship = ensureFishSpot();
  const poi = tileAt(4, -3);
  MAP.house.q = poi.q; MAP.house.r = poi.r; MAP.house.x = poi.x; MAP.house.y = poi.y;
  const pond = ensureFishSpot();
  MAP.house.q = home.q; MAP.house.r = home.r; MAP.house.x = home.x; MAP.house.y = home.y;
  const zone = { x: 100, y: 100, r: 40 };
  const perfect = gradeFlick({ x: 100, y: 220 }, { x: 100, y: 100 }, zone);
  const great = gradeFlick({ x: 100, y: 220 }, { x: 100, y: 118 }, zone);
  const good = gradeFlick({ x: 100, y: 220 }, { x: 100, y: 136 }, zone);
  const whiff = gradeFlick({ x: 0, y: 0 }, { x: 8, y: 0 }, zone);
  const away = gradeFlick({ x: 80, y: 100 }, { x: 0, y: 100 }, zone);
  SET.hand = 'right';
  const pose = (name, lead) => { setGesture(name, { lead, pinch: name === 'tug' ? 1 : 0 }); GEST.blend = 1; return gestureHands(100, { x: 1, y: 0 }); };
  const idle = pose('idle', 'offhand');
  const wind = pose('wind', 'offhand');
  const rel = pose('release', 'offhand');
  const tug = pose('tug', 'offhand');
  const spell = pose('release', 'spell');
  openFish();
  const cam = fishCam();
  const title = document.getElementById('title');
  const titleHidden = !title || getComputedStyle(title).display === 'none';
  const rip = rippleScreen(), me = playerScreen();
  const fish0 = G.bag.fish || 0, ae0 = G.aether;
  const side = gradeAndCast(me.x, me.y, me.x + (rip.y - me.y), me.y - (rip.x - me.x));
  const usedAfterWhiff = FI.used || 0;
  const cast = gradeAndCast(me.x, me.y, rip.x, rip.y);
  fishUpdate(1);
  const waited = { phase: FI.phase, used: FI.used, echo: FI.echo > 0, who: FI.echoWho, grade: FI.grade };
  fishUpdate(3);
  const bad = tryTug({ x0: me.x, y0: me.y }, me.x + 90, me.y);
  const still = FI.phase;
  let guard = 0;
  while (FI.phase !== 'slip' && FI.phase !== 'spent' && guard++ < 8) {
    if (FI.phase === 'nibble') fishUpdate(nibbleWindow() + 0.05);
    else fishUpdate((FI.biteAt || 0.5) + 0.05);
  }
  const missed = { phase: FI.phase, lost: FI.phase === 'lost' };
  FI.phase = 'aim'; FI.used = 0; FI.paid = false; FI.castCounted = false; FI.nibbles = 0; FI.hits = 0;
  gradeAndCast(me.x, me.y, rip.x, rip.y);
  fishUpdate(1); fishUpdate(3);
  const tugged = tryTug({ x0: rip.x, y0: rip.y }, me.x, me.y);
  trailScreen().forEach(p => fishTraceAt(p.x, p.y));
  const caught = { phase: FI.phase, icon: FI.lootIcon, bag: (G.bag.fish || 0) - fish0, ae: G.aether - ae0, rod: fishUsesRod(), lead: GEST.lead };
  landFish();
  const once = (G.bag.fish || 0) === fish0 + 1 && G.aether === ae0 + 3;
  nextCast();
  gradeAndCast(me.x, me.y, rip.x, rip.y); fishUpdate(1);
  FI.nibbles = 3; FI.phase = 'nibble'; anotherNibble();
  const mid = FI.phase === 'slip' && FI.used === 2;
  nextCast();
  gradeAndCast(me.x, me.y, rip.x, rip.y); fishUpdate(1);
  FI.nibbles = 3; FI.phase = 'nibble'; anotherNibble();
  const spent = FI.phase === 'spent' && FI.used === 3;
  FI.respawnAt = performance.now() - 5;
  fishUpdate(0.01);
  const back = FI.phase === 'aim' && FI.used === 0;
  setWater('river'); const river = waterPace();
  setWater('ocean'); const ocean = waterPace();
  const badKind = setWater('lake');
  setWater('pond');
  const restored = waterPace();
  return {
    ship, pond, perfect, great, good, whiff, away, side, usedAfterWhiff, cast, waited, bad, still, missed, tugged, caught, once, mid, spent, back,
    river, ocean, badKind, restored, cam, titleHidden, poses: { idle, wind, rel, tug, spell },
  };
});
const handApart = (a, b) => Math.hypot(a.L.x - a.R.x, a.L.y - a.R.y) > Math.hypot(b.L.x - b.R.x, b.L.y - b.R.y);
check('a flick grades Perfect, Great, and Good, and a short or backward flick does not', fish.perfect.grade === 'Perfect' && fish.great.grade === 'Great' && fish.good.grade === 'Good' && fish.whiff.whiff && fish.away.whiff && fish.side.whiff && fish.usedAfterWhiff === 0, JSON.stringify({ perfect: fish.perfect.grade, great: fish.great.grade, good: fish.good.grade }));
check('the pond opens beside the ship, and on real water when you are already at the pond', fish.ship.kind === 'summon' && fish.ship.space === 'ship' && fish.pond.kind === 'pond' && fish.pond.space === 'pond', JSON.stringify({ ship: fish.ship, pond: fish.pond }));
check('a flick toward the ripple is graded, then a short wait, and Dock Echo is your own reflection', fish.cast.grade === 'Perfect' && fish.waited.phase === 'wait' && fish.waited.used === 1 && fish.waited.echo && fish.waited.who === 'self', JSON.stringify(fish.waited));
check('a tug the wrong way is another nibble, not a snapped line', fish.bad === false && fish.still === 'nibble' && fish.missed.phase === 'slip' && fish.missed.lost === false, JSON.stringify({ bad: fish.bad, still: fish.still, missed: fish.missed }));
check('tracing the glowing trail keeps one fish and an 8-bit icon, with a fishing rod', fish.tugged && fish.caught.phase === 'catch' && fish.caught.icon === 'fish' && fish.caught.rod === true && fish.caught.lead === 'offhand' && fish.once, JSON.stringify(fish.caught));
check('fishing opens in first person with a rod in hand, not the mid-distance cheeb', fish.cam && fish.cam.mode === 'fp' && fish.cam.zoom === 'in' && fish.cam.rod === 'fishing-rod' && fish.cam.cheeb === false && fish.cam.behind === false && fish.cam.painted && fish.titleHidden, JSON.stringify({ cam: fish.cam, titleHidden: fish.titleHidden }));
check('three casts fish the spot out, and the shortened respawn brings a ripple back', fish.mid && fish.spent && fish.back, JSON.stringify({ mid: fish.mid, spent: fish.spent, back: fish.back }));
check('river and ocean only change the timing', fish.river < 1 && fish.ocean < fish.river && fish.badKind === false && fish.restored === 1, JSON.stringify({ river: fish.river, ocean: fish.ocean, restored: fish.restored }));
check('fishing poses move the off hand, and the spell hand stays available for later', fish.poses.wind.L.y < fish.poses.idle.L.y && fish.poses.rel.L.x > fish.poses.idle.L.x + 20 && handApart(fish.poses.idle, fish.poses.tug) && fish.poses.tug.pinch === 1 && fish.poses.spell.R.x > fish.poses.idle.R.x + 20 && Math.abs(fish.poses.spell.L.x - fish.poses.idle.L.x) < 2, JSON.stringify(fish.poses));
check('the fishing slice does not throw', fishErr.length === 0, JSON.stringify(fishErr));
await fishPage.close();

const cabin = await open(844, 390);
const cabinErr = [];
cabin.on('pageerror', err => cabinErr.push(String(err && err.message || err)));
await cabin.waitForFunction(() => window.__home && window.__home.enter, { timeout: 20000 });
const home = await cabin.evaluate(() => {
  const entered = window.__home.enter();
  const nook = window.__home.activate('nook');
  const craft = document.getElementById('craftM').classList.contains('on');
  closeModal('craftM');
  const board = window.__home.activate('board');
  const cmd = document.getElementById('cmdM').classList.contains('on');
  const friends = document.getElementById('cmdM').textContent.includes('Friend quests');
  closeModal('cmdM');
  window.__home.activate('spot');
  const bounce = window.__home.state().bounce;
  const slotted = window.__home.setSlot('gold') && window.__home.state().slot === 'gold';
  window.__home.setSlot('billboard');
  const sound = window.__home.state().sound;
  window.__home.activate('door');
  for (let i = 0; i < 60; i++) window.__home.step(0.05);
  const portrait = document.getElementById('doorRooms') && document.getElementById('doorRooms').classList.contains('on');
  const rooms = window.__home.doorRooms().map(r => r.id);
  window.__home.chooseDoor('pond');
  const fishing = document.getElementById('fishM').classList.contains('on');
  const phase = window.__home.state().phase;
  const backBtn = document.getElementById('homeDoorBack').classList.contains('on');
  window.__home.back();
  for (let i = 0; i < 50; i++) window.__home.step(0.05);
  const after = window.__home.state();
  const fishClosed = !document.getElementById('fishM').classList.contains('on');
  const homeAgain = document.body.classList.contains('home-in');
  return { entered, nook, craft, board, cmd, friends, bounce, slotted, sound, fishing, phase, backBtn, after, fishClosed, homeAgain, portrait, rooms };
});
check('the cabin door opens a room portrait, the pond still fishes, and the door comes back home', home.entered && home.portrait && home.rooms.indexOf('out') >= 0 && home.rooms.indexOf('garden') >= 0 && home.rooms.indexOf('pond') >= 0 && home.fishing && home.phase === 'fishing' && home.backBtn && home.fishClosed && home.homeAgain && home.after.phase === 'inside' && home.after.door < 0.35, JSON.stringify(home));
check('the Cook Nook counter opens the Cook Nook', home.nook && home.craft, JSON.stringify({ nook: home.nook, craft: home.craft }));
check('the wall board opens Command with Friend quests', home.board && home.cmd && home.friends, JSON.stringify({ board: home.board, cmd: home.cmd, friends: home.friends }));
check('a tap on the character spot bounces, and the fire stays quiet', home.bounce === 1 && home.sound === false && home.slotted, JSON.stringify({ bounce: home.bounce, sound: home.sound, slot: home.slotted }));
check('the home interior does not throw', cabinErr.length === 0, JSON.stringify(cabinErr));
const ar = await cabin.evaluate(async () => {
  const probe = await window.__home.ar.probe();
  const doll = await window.__home.ar.start('dollhouse');
  const port = await window.__home.ar.start('portal');
  const entered = window.__home.enter();
  for (let i = 0; i < 4; i++) window.__home.step(0.05);
  const pads = window.__home.targets();
  const note = document.getElementById('homeArNote').textContent;
  const hud = document.getElementById('homeTable').getBoundingClientRect();
  return { probe, doll, port, entered, pads, note, hudH: hud.height, phase: window.__home.state().phase, on: document.body.classList.contains('home-in') };
});
check('WebXR is reported missing and the full-screen cabin stays', ar.probe.available === false && ar.doll.stub === true && ar.doll.active === false && ar.doll.mode === 'dollhouse' && ar.doll.scale === 0.07 && ar.port.mode === 'portal' && ar.port.scale === 1 && ar.port.stub === true && ar.entered && ar.on && ar.phase === 'inside' && /full-screen cabin/.test(ar.note), JSON.stringify(ar));
check('cabin taps are large enough for a hand or a pinch', ar.pads.nook >= 1.5 && ar.pads.board >= 1.5 && ar.pads.door >= 1.5 && ar.pads.spot >= 1.5 && ar.hudH >= 44, JSON.stringify({ pads: ar.pads, hudH: ar.hudH }));
check('the AR fallback does not throw', cabinErr.length === 0, JSON.stringify(cabinErr));
await cabin.waitForFunction(() => window.__home.doorPlate && window.__home.doorPlate.state().ready, { timeout: 8000 });
const doorPlate = await cabin.evaluate(() => {
  window.__home.enter();
  const front = window.__home.doorPlate.face('front');
  const close = window.__home.doorPlate.face('close');
  window.__home.enter();
  return { front, close };
});
check('door plate is the painting from the front and a hologram up close', doorPlate.front.on && doorPlate.front.mode === 'paint' && doorPlate.close.on && doorPlate.close.mode === 'holo', JSON.stringify(doorPlate));
await cabin.waitForFunction(() => window.__home.roomPlate && window.__home.roomPlate.state().ready, { timeout: 8000 });
const cabinRoom = await cabin.evaluate(() => {
  window.__home.enter();
  const front = window.__home.roomPlate.face('front');
  const close = window.__home.roomPlate.face('close');
  const door = window.__home.doorPlate.face('front');
  window.__home.enter();
  return { front, close, door };
});
check('cabin backdrop is the painting from the front and a hologram up close', cabinRoom.front.on && cabinRoom.front.mode === 'paint' && cabinRoom.close.on && cabinRoom.close.mode === 'holo' && cabinRoom.door.on && cabinRoom.door.mode === 'paint', JSON.stringify(cabinRoom));
const travel = await cabin.evaluate(() => {
  window.__home.enter();
  window.__home.activate('door');
  for (let i = 0; i < 60; i++) window.__home.step(0.05);
  const openPortrait = document.getElementById('doorRooms').classList.contains('on');
  window.__home.chooseDoor('out');
  const portraitClosed = !document.getElementById('doorRooms').classList.contains('on');
  const state = window.__profile.get();
  state.cells = 3;
  const placed = window.__portal.place();
  const open = window.__portal.get();
  const cellsAfter = window.__profile.get().cells;
  const kingWas = TRAIN.king;
  TRAIN.king = true;
  const blocked = window.__portal.step() === false && window.__portal.get() === true;
  TRAIN.king = kingWas;
  const stepped = window.__portal.step();
  const used = window.__portal.get() === false;
  state.cells = 0;
  const empty = window.__portal.place() === false;
  return { openPortrait, portraitClosed, placed, open, cellsAfter, blocked, stepped, used, empty };
});
check('the ship door steps out, and one Home door trip spends the placement', travel.openPortrait && travel.portraitClosed && travel.placed && travel.open && travel.cellsAfter === 0 && travel.blocked && travel.stepped && travel.used && travel.empty, JSON.stringify(travel));
await cabin.close();

await browser.close();
console.log(fails.length ? '\n' + fails.length + ' failed' : '\nall passed');
process.exit(fails.length ? 1 : 0);
