// After a Frost Bolt, stick-forward must still move along the view.
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
  const stick = { move: { x: 0, y: 1 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'pad', cast: null, spell: 0, pause: false, any: true };
  function forward(yaw) {
    L.zones.enter('plot');
    L.settings.class = 'mage';
    L.walker.place(-10, -20, yaw);
    L.setInput(() => stick);
    for (let i = 0; i < 20; i++) L.step(1 / 60);
    const x0 = L.walker.feet.x, z0 = L.walker.feet.z;
    const lx = Math.sin(yaw), lz = Math.cos(yaw);
    for (let i = 0; i < 30; i++) L.step(1 / 60);
    const dx = L.walker.feet.x - x0, dz = L.walker.feet.z - z0;
    return dx * lx + dz * lz;
  }
  const before = forward(Math.PI / 2);
  L.spells.select(1);
  L.view([-10, 4, -16], [-10, 1.2, -24]);
  L.spells.press();
  for (let i = 0; i < 20; i++) L.step(1 / 60);
  L.spells.release();
  for (let i = 0; i < 40; i++) L.step(1 / 60);
  L.view();
  const after = forward(Math.PI / 2);
  const north = forward(0);
  return { before: +before.toFixed(2), after: +after.toFixed(2), north: +north.toFixed(2) };
});
console.log(JSON.stringify(report));
if (!(report.before > 0.4 && report.after > 0.4 && report.north > 0.4)) process.exitCode = 1;
await browser.close();
server.close();
