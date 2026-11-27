// Playtest tour must be moving by the 60th sim frame, with no combat on screen.
//   node tools/playtest-move.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.jpg': 'image/jpeg', '.png': 'image/png', '.vrm': 'application/octet-stream' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--mute-audio', '--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?playtest=1&capture&nopad&q=low&look=B`);
  await page.waitForFunction(() => window.lab?.ready && document.getElementById('playframes'), null, { timeout: 180000 });
  const report = await page.evaluate(() => {
    const lab = window.lab;
    const before = { x: lab.walker.feet.x, z: lab.walker.feet.z };
    lab.step(1 / 30, 60);
    const after = { x: lab.walker.feet.x, z: lab.walker.feet.z };
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    const near = (lab.zones.live?.() || []).filter((b) => b.g && b.where === 'meadow' && Math.hypot(b.g.position.x - after.x, b.g.position.z - after.z) < 40);
    const shown = (id) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display : 'missing';
    };
    return {
      moved: +moved.toFixed(2),
      frames: document.getElementById('playframes').textContent,
      zone: lab.zones.name,
      hex: !!lab.hexes.layer?.visible,
      nearBeasts: near.length,
      visibleBeasts: near.filter((b) => b.g.visible && !b.dead).length,
      hp: shown('hp'),
      mood: shown('mood'),
      pad: shown('discActs'),
      banner: shown('hexbanner'),
      aim: shown('aim'),
    };
  });
  console.log(JSON.stringify({ ...report, errors }));
  const frames = Number(report.frames);
  if (!(report.moved > 3)) throw new Error(`tour did not move in 60 frames (${report.moved} m)`);
  if (frames < 60) throw new Error(`frame counter is ${frames}`);
  if (report.zone !== 'meadow') throw new Error(`zone is ${report.zone}`);
  if (report.visibleBeasts !== 0) throw new Error(`${report.visibleBeasts} beasts visible within 40 m`);
  if (report.hex) throw new Error('hex guide lines are visible');
  for (const id of ['hp', 'mood', 'pad', 'banner', 'aim']) {
    if (report[id] !== 'none') throw new Error(`${id} display is ${report[id]}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('playtest movement ok');
} finally {
  await browser.close();
  server.close();
}
