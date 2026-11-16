// A minute of Slice, then a finished Sky Rush, both have to lower a boar's health.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
const require = createRequire(new URL('./package.json', import.meta.url));
const { chromium } = require('playwright-core');
const root = resolve(new URL('./dist', import.meta.url).pathname);
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' }[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/?capture&fast&nopad`);
await page.waitForFunction(() => window.lab?.ready);
const report = await page.evaluate(() => {
  const L = window.lab;
  L.zones.enter('plot');
  L.settings.class = 'blade';
  L.blade.setFight(true);
  L.blade.setDrawn(true);
  const hp = () => L.zones.beasts().reduce((s, b) => s + (b.dead ? 0 : b.hp), 0);
  const boar = () => L.zones.beasts().find((b) => b.kind === 'boar' && !b.dead) || L.zones.beasts().find((b) => b.kind === 'boar');
  const first = boar();
  L.teleport(first.x + 5.5, first.z, first.x, first.z);
  for (let i = 0; i < 20; i++) L.step(1 / 60);
  const start = hp();
  for (let frame = 0; frame < 60 * 60; frame++) {
    if (frame % 90 === 0) {
      const b = boar();
      L.walker.place(b.x + 5.5, b.z, Math.atan2(-5.5, 0));
      L.blade.cut();
    }
    L.step(1 / 60);
  }
  return { start, afterSlice: hp() };
});
await new Promise((r) => setTimeout(r, 300));
const rush = await page.evaluate(() => {
  const L = window.lab;
  const hp = () => L.zones.beasts().reduce((s, b) => s + (b.dead ? 0 : b.hp), 0);
  const before = hp();
  L.blade.tryRush();
  for (let n = 0; n < 5; n++) document.querySelector('#rush button.on')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  for (let i = 0; i < 8; i++) L.step(1 / 60);
  return { before, after: hp(), say: document.getElementById('bladeSay')?.textContent || '' };
});
console.log(JSON.stringify({ ...report, rush }));
if (!(report.afterSlice < report.start - 4 && rush.after < rush.before - 4)) process.exitCode = 1;
await browser.close();
server.close();
