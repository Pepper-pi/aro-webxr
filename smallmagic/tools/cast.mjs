// Casts a spell in the built page (dist/), headless and muted, with the clock stepped by hand, and takes stills of it
// or a film.
//   node tools/cast.mjs --name fire --at "x,z,fx,fz" [--pitch p] --spell 0 --hold 0.2 --shots "0.1,0.5,1.5,4"
//                       [--film shots/work/fire.mp4 --seconds 8] [--then "spell,hold,wait;spell,hold,wait"] [--size 1280x720] [--query ""]
// --spell: 0 fire, 1 frost, 2 wind, 3 growth. --hold: how long the button is held, in seconds.
// --shots: when to take stills, in seconds from when the button goes down. --then: more casts after the first, each
// after waiting so long. --walk m/s: they walk forward the while. --each "js": run in the page before every frame.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
const out = resolve(here, 'shots/work');
const [width, height] = flag('size', '1280x720').split('x').map(Number);
mkdirSync(out, { recursive: true });
const root = resolve(here, 'dist');
const types = { '.webp': 'image/webp', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.ogg': 'audio/ogg' };
// --sound: the sound of it is worked out too (never played), written to shots/work/<name>.wav and put on the film
const withSound = args.includes('--sound');
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
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text().slice(0, 900)}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${(e.stack ?? '').slice(0, 600)}`));
  const soundFor = Number(flag('seconds', 8)) + 1.5;
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&${withSound ? `sound=${soundFor}&` : ''}${flag('query', '')}`);
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  const name = flag('name', 'cast'), at = flag('at') ? flag('at').split(',').map(Number) : null;
  // the casts: [spell, hold, wait before it]
  const casts = [[Number(flag('spell', 0)), Number(flag('hold', 0.2)), 0], ...(flag('then') ? flag('then').split(';').map((c) => c.split(',').map(Number)) : [])];
  await page.evaluate(([at, pitch, walk]) => {
    const L = window.lab;
    if (at) L.teleport(...at);
    if (pitch != null) L.follow.pitch = pitch;
    L.setInput(() => ({ move: { x: 0, y: walk ? 1 : 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
    L.step(1 / 60, 20);
  }, [at, flag('pitch') ? Number(flag('pitch')) : null, Number(flag('walk', 0))]);
  // a list of what happens when: button down, button up, a still
  const events = []; let t = 0;
  for (const [spell, hold, wait] of casts) { t += wait; events.push([t, 'down', spell], [t + hold, 'up']); t += hold; }
  for (const s of (flag('shots', '') || '').split(',').filter(Boolean).map(Number)) events.push([s, 'shot']);
  const film = flag('film'), seconds = Number(flag('seconds', film ? 8 : Math.max(...events.map((e) => e[0])) + 0.05));
  const frames = resolve(out, 'cast-frames');
  if (film) { rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true }); }
  events.sort((a, b) => a[0] - b[0]);
  let shot = 0, e = 0;
  for (let f = 0; f <= Math.round(seconds * 60); f++) {
    const now = f / 60;
    while (e < events.length && events[e][0] <= now + 1e-6) {
      const [, what, spell] = events[e++];
      if (what === 'down') await page.evaluate((s) => { window.lab.spells.select(s); window.lab.spells.press(); }, spell);
      else if (what === 'up') await page.evaluate(() => window.lab.spells.release());
      else { await page.screenshot({ path: join(out, `${name}-${++shot}.png`) }); console.log(`shot ${name}-${shot} at ${now.toFixed(2)} s`); }
    }
    if (flag('each')) await page.evaluate(`(() => { ${flag('each')} })()`);
    if (withSound) await page.evaluate(() => window.lab.stepSound(1 / 60)); else await page.evaluate(() => window.lab.step(1 / 60, 1));
    if (film && f % 2 === 0) await page.screenshot({ path: join(frames, `f${String(f / 2).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  console.log(JSON.stringify(await page.evaluate(() => ({ marks: window.lab.fx.count, burning: window.lab.fire.burning, dbg: window.__dbg ?? undefined, ruin: window.lab.ruin ? { blocks: window.lab.ruin.count, brokenWelds: window.lab.ruin.broken, fallen: window.lab.ruin.fallen, held: window.lab.ruin.held, treesDown: window.lab.ruin.treesDown } : null }))));
  let wavFile = null;
  if (withSound) {
    const { wav, peak } = await page.evaluate(() => window.lab.sound.finish());
    wavFile = join(out, `${name}.wav`);
    writeFileSync(wavFile, Buffer.from(wav, 'base64'));
    console.log(`sound ${name}.wav, peak ${peak.toFixed(3)}`);
  }
  if (film) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, 'f%04d.jpg'), ...(wavFile ? ['-i', wavFile, '-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', resolve(here, film)]);
    console.log('wrote', film);
  }
  if (problems.length) console.log('problems:\n' + [...new Set(problems)].slice(0, 8).join('\n'));
} catch (e) {
  failed = true;
  console.log('FAILED:', e.message.slice(0, 400));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
