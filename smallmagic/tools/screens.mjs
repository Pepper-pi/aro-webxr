// Takes a still of each of the game's screens from the built page (dist/), headless and muted: the title while it
// loads and when it is ready, the title in a tall window, the game once begun, and paused.
//   node tools/screens.mjs            writes shots/work/screen-*.png and says what it saw
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..'), out = resolve(here, 'shots/work'), root = resolve(here, 'dist');
mkdirSync(out, { recursive: true });
const types = { '.webp': 'image/webp', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-webgpu'] });
const url = `http://127.0.0.1:${server.address().port}/?nopad`;
const problems = [];
const watch = (page) => { page.on('console', (m) => { if (m.type() === 'error') problems.push(`error: ${m.text().slice(0, 300)}`); }); page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`)); };
const state = (page) => page.evaluate(() => ({ title: Boolean(document.getElementById('title')), begin: document.getElementById('begin') && !document.getElementById('begin').hidden, paused: !document.getElementById('pause').hidden, now: window.lab?.air?.uniforms.uNow.value }));
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  watch(page);
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'screen-1-loading.png') });
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, 'screen-2-title.png') });
  console.log('title', JSON.stringify(await state(page)));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, 'screen-3-title-later.png') });
  await page.mouse.click(800, 450); await page.waitForTimeout(1600);
  const a = await state(page); await page.waitForTimeout(700); const b = await state(page);
  await page.screenshot({ path: join(out, 'screen-4-game.png') });
  console.log('begun', JSON.stringify(b), 'clock runs', b.now > a.now);
  await page.keyboard.press('KeyP'); await page.waitForTimeout(300);
  const c = await state(page); await page.waitForTimeout(600); const d = await state(page);
  await page.screenshot({ path: join(out, 'screen-5-paused.png') });
  console.log('paused', JSON.stringify(d), 'clock stopped', d.now === c.now);
  await page.keyboard.press('KeyP'); await page.waitForTimeout(500);
  const e = await state(page); await page.waitForTimeout(500); const f = await state(page);
  console.log('carried on', JSON.stringify(f), 'clock runs', f.now > e.now);
  await page.close();
  // a tall window: the tall cover
  const tall = await browser.newPage({ viewport: { width: 700, height: 1100 }, deviceScaleFactor: 1 });
  watch(tall);
  await tall.goto(url);
  await tall.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  await tall.waitForTimeout(600);
  await tall.screenshot({ path: join(out, 'screen-6-title-tall.png') });
  await tall.close();
  // as Patch's test opens it: no title, and W alone moves them
  const test = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  watch(test);
  await test.goto(url + '&patch-test=1');
  await test.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  await test.waitForTimeout(800);
  const at = () => test.evaluate(() => [window.lab.walker.feet.x, window.lab.walker.feet.z, Boolean(document.getElementById('title'))]);
  const p0 = await at();
  await test.keyboard.down('KeyW'); await test.waitForTimeout(1500); await test.keyboard.up('KeyW');
  const p1 = await at();
  console.log('as tested: title shown', p0[2], 'moved', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(1), 'm');
  await test.screenshot({ path: join(out, 'screen-7-tested.png') });
  console.log(problems.length ? 'problems:\n' + [...new Set(problems)].join('\n') : 'no errors');
} catch (e) {
  console.log('FAILED:', e.message.slice(0, 500), '\n', [...new Set(problems)].join('\n'));
} finally {
  await browser.close();
  server.close();
}
