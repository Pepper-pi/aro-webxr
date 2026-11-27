// What Patch's test times: every frame from ready on. Loads the built page as a player gets it (headless, muted),
// clicks the middle, holds W, and prints the longest gaps between frames with when they came.
//   node tools/gaps.mjs [--seconds 9] [--cast]     --cast: then casts every spell for the first time, and times that too
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const root = resolve(fileURLToPath(import.meta.url), '..', '..', 'dist');
const types = { '.webp': 'image/webp', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-webgpu'] });
try {
  const [vw, vh] = flag('size', '1280x720').split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__gaps = []; window.__times = [];
    let last = 0, t0 = 0;
    const frame = (now) => { if (window.__block?.ready) { if (!t0) t0 = now; else if (now - last > 30) window.__gaps.push([Math.round(now - t0), Math.round(now - last), window.__doing ?? '']); if (window.__doing && last) window.__times.push(now - last); last = now; } requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  const t = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/?nopad&${flag('query', '')}`);
  await page.waitForFunction(() => window.__block?.ready, null, { timeout: 90000, polling: 50 });
  // (past the title, as a click would)
  await page.evaluate(() => window.lab.begin?.());
  const ready = Date.now() - t;
  await page.waitForTimeout(1000);
  await page.mouse.click(640, 360);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout((Number(flag('seconds', 9)) - 2.5) * 1000);
  if (args.includes('--cast')) {
    // each spell for the first time: aimed at the ground ahead, held, let go, and what it does left to play out
    // (--at "x,z,fx,fz" --pitch p: from there, facing that)
    await page.evaluate(([at, pitch]) => { if (at) window.lab.teleport(...at); window.lab.follow.pitch = pitch; }, [flag('at') ? flag('at').split(',').map(Number) : null, Number(flag('pitch', 0.14))]);
    // (--spells "spell,hold ms,then ms;...": these instead)
    const list = flag('spells') ? flag('spells').split(';').map((c) => c.split(',').map(Number)) : [[0, 900, 3500], [2, 900, 2000], [1, 1800, 800], [3, 1800, 800], [0, 150, 2500]];
    for (const [spell, hold, after] of list) {
      await page.evaluate((s) => { window.__doing = 'spell ' + s + ' held'; window.lab.spells.select(s); window.lab.spells.press(); }, spell);
      await page.waitForTimeout(hold);
      await page.evaluate((s) => { window.__doing = 'spell ' + s + ' let go'; window.lab.spells.release(); }, spell);
      await page.waitForTimeout(after);
    }
  }
  const times = (await page.evaluate(() => window.__times)).sort((a, b) => a - b);
  if (times.length) console.log(JSON.stringify({ framesWhileCasting: times.length, meanMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2), p99Ms: +times[Math.floor(times.length * 0.99)].toFixed(1), worstMs: +times[times.length - 1].toFixed(1), ruin: await page.evaluate(() => window.lab.ruin ? { brokenWelds: window.lab.ruin.broken, fallen: window.lab.ruin.fallen } : null) }));
  console.log(JSON.stringify({ ready, gapsOver30ms: await page.evaluate(() => window.__gaps), timings: await page.evaluate(() => window.__block.timings), errors }));
} finally {
  await browser.close();
  server.close();
}
