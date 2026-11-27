// Stills of the built page (dist/), headless and muted, with the clock stepped by hand.
//   node tools/shots.mjs --name n [--at "x,z,fx,fz"] [--run s] [--dist d] [--pitch p] [--yaw y]
//                        [--cam "ex,ey,ez,tx,ty,tz"] [--focus d] [--settle frames] [--size 1920x1080] [--query ""] [--out shots/work] [--time]
// --at puts the doll there facing (fx, fz); --cam is a fixed eye and what it looks at (and focuses on).
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const nums = (name) => (flag(name) ? flag(name).split(',').map(Number) : null);
const out = resolve(here, flag('out', 'shots/work'));
const [width, height] = flag('size', '1920x1080').split('x').map(Number);
mkdirSync(out, { recursive: true });
const root = resolve(here, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-webgpu'] });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text().slice(0, 1200)}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${(e.stack ?? '').slice(0, 700)}`));
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&${flag('query', '')}`);
  try {
    await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
    console.log(`ready in ${Date.now() - t0} ms`, JSON.stringify(await page.evaluate(() => ({ timings: window.lab.timings, counts: window.lab.counts }))));
    const info = await page.evaluate(([at, run, dist, pitch, yaw, cam, focus, settle]) => {
      const L = window.lab, still = () => ({ move: { x: 0, y: 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' });
      L.view(null);
      if (at) L.teleport(...at);
      if (pitch != null) L.follow.pitch = pitch;
      if (dist != null) L.follow.want = L.follow.distance = dist;
      L.setInput(() => ({ ...still(), move: { x: 0, y: run > 0 ? 1 : 0 } }));
      L.step(1 / 60, Math.round(Math.max(run, 0.5) * 60));
      if (yaw) { L.follow.yaw += yaw; L.step(1 / 60, 30); }
      if (settle) { L.setInput(still); L.step(1 / 60, settle); }
      if (cam) L.view(cam.slice(0, 3), cam.slice(3, 6));
      L.focus = focus ?? null;
      L.step(1 / 60, 6);
      const p = L.player.feet, b = L.doll.man.bones.Head.getWorldPosition(new L.THREE.Vector3());
      return { at: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), head: +(b.y - p.y).toFixed(2), mode: L.player.mode };
    }, [nums('at'), Number(flag('run', 0)), flag('dist') ? Number(flag('dist')) : null, flag('pitch') ? Number(flag('pitch')) : null, Number(flag('yaw', 0)), nums('cam'), flag('focus') ? Number(flag('focus')) : null, Number(flag('settle', 0))]);
    if (args.includes('--time')) {
      const ms = await page.evaluate(() => { const L = window.lab, gl = L.renderer.getContext(), px = new Uint8Array(4); L.step(1 / 60, 20); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t = performance.now(); for (let i = 0; i < 120; i++) { L.step(1 / 60, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - t) / 120; });
      console.log('ms a frame:', ms.toFixed(2));
    }
    const name = flag('name', 'shot');
    await page.screenshot({ path: join(out, `${name}.png`) });
    console.log(`shot ${name}`, JSON.stringify(info));
  } catch (e) {
    failed = true;
    console.log('FAILED:', e.message.slice(0, 300));
  }
  if (problems.length) console.log('problems:\n' + [...new Set(problems)].slice(0, 10).join('\n'));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
