// Explicit Original Gold field-picture checks. Not a day route and not a frame-time sample.
//   CHROME=/usr/local/bin/google-chrome node v7/gold-field-clear.mjs
// Expects http://127.0.0.1:8765/v7/
import { execSync } from 'child_process';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/v7/';
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch { puppeteer = (await import('/tmp/ppt/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default; }

const lines = [];
function check(name, ok, detail) {
  const line = (ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '');
  lines.push(line);
  console.log(line);
  return ok;
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', protocolTimeout: 0,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(BASE + '?clear=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__gold && window.__aro);

const view = await page.evaluate(async () => {
  const before = G.fieldAvatar;
  const opened = await window.__gold.open();
  window.__gold.draw('quarter');
  window.__gold.draw('side');
  window.__gold.draw('back');
  window.__gold.draw('front');
  return { before, field: G.fieldAvatar, race: G.race, open: opened.ok, tris: opened.tris };
});
check('opening the viewer does not select the field picture', view.open && view.tris === 118790 && view.before === '' && view.field === '' && view.race === 'human', JSON.stringify(view));

const baked = await page.evaluate(() => window.__gold.bake());
check('Walk as Original Gold selects the field picture', baked.ok && baked.manifest && baked.manifest.sourceSha256 === '54b1f5c7bef848ab2ae364655296214e693e8f3aa196728d071a26413b5fd5aa' && baked.manifest.recipe === 'assets/original-gold-field-bake.mjs' && baked.manifest.skins === 0 && baked.race === 'human', JSON.stringify({ ok: baked.ok, race: baked.race, field: baked.ok && 'gold', alpha: baked.manifest && baked.manifest.alpha }));
const fieldNow = await page.evaluate(() => G.fieldAvatar);
check('the bake sets fieldAvatar to gold', fieldNow === 'gold', fieldNow);

const boba = await page.evaluate(() => {
  window.__gold.useBoba();
  return { field: G.fieldAvatar, race: G.race, form: G.form, sel: document.querySelector('.race.sel').dataset.r, btn: document.getElementById('goldBtn').textContent };
});
check('Walk as Boba clears the field picture', boba.field === '' && boba.race === 'slime' && boba.form === 'boba' && boba.sel === 'slime' && boba.btn === 'Original Gold', JSON.stringify(boba));

const humanCard = await page.evaluate(async () => {
  await window.__gold.bake();
  document.querySelector('.race[data-r="human"]').click();
  return { field: G.fieldAvatar, race: G.race, btn: document.getElementById('goldBtn').textContent };
});
check('the Wayfarer card clears the field picture', humanCard.field === '' && humanCard.race === 'human' && humanCard.btn === 'Original Gold', JSON.stringify(humanCard));

const slimeCard = await page.evaluate(async () => {
  await window.__gold.bake();
  document.querySelector('.race[data-r="slime"]').click();
  return { field: G.fieldAvatar, race: G.race, form: G.form };
});
check('the Boba card clears the field picture', slimeCard.field === '' && slimeCard.race === 'slime' && slimeCard.form === 'boba', JSON.stringify(slimeCard));

await page.evaluate(() => window.__gold.bake());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__gold && window.__aro);
const reloaded = await page.evaluate(() => ({ field: G.fieldAvatar, race: G.race, scene: G.scene, title: !document.getElementById('title').classList.contains('hide') }));
check('reload clears the field picture the same way Play again does', reloaded.field === '' && reloaded.race === 'human' && reloaded.title, JSON.stringify(reloaded));
check('the clear checks do not throw', errors.length === 0, JSON.stringify(errors));

const head = execSync('git -C /agent/repos/aro-webxr rev-parse HEAD').toString().trim();
const fail = lines.some(l => l.startsWith('FAIL'));
console.log(JSON.stringify({ head, fail, lines }, null, 2));
await browser.close();
process.exit(fail ? 1 : 0);
