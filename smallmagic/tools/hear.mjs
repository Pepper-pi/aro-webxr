// Works out what the built page (dist/) would sound like, with no sound card and nothing played, and writes it down:
// shots/work/<name>.wav, a picture of it (<name>-sound.png: its wave over its spectrum, low notes at the bottom),
// and how loud it is second by second.
//   node tools/hear.mjs --name still --seconds 6                         nothing cast: what is always there
//   node tools/hear.mjs --name blast --seconds 14 --spell 4 --hold 3.2   [--at "x,z,fx,fz"] [--pitch p] [--query ""]
//   --walk: they walk forward the while (--sprint: run); --jump s: and jump at s seconds; --each "js": run before every frame
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
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
mkdirSync(out, { recursive: true });
const root = resolve(here, 'dist');
const types = { '.webp': 'image/webp', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--enable-unsafe-webgpu'] });
const name = flag('name', 'heard'), seconds = Number(flag('seconds', 8));
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`error: ${m.text().slice(0, 600)}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${(e.stack ?? '').slice(0, 600)}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&sound=${seconds + 0.5}&${flag('query', '')}`);
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  const at = flag('at') ? flag('at').split(',').map(Number) : null;
  await page.evaluate(([at, pitch, walk, sprint]) => {
    const L = window.lab;
    if (at) L.teleport(...at);
    if (pitch != null) L.follow.pitch = pitch;
    window.__jump = false;
    L.setInput(() => ({ move: { x: 0, y: walk ? 1 : 0 }, walk: false, sprint, strafe: false, jump: window.__jump, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
    L.step(1 / 60, 20);
  }, [at, flag('pitch') ? Number(flag('pitch')) : null, args.includes('--walk'), args.includes('--sprint')]);
  const spell = flag('spell'), hold = Number(flag('hold', 0.2)), wait = Number(flag('wait', 0.5));
  // (all the frames in one go inside the page: the picture is not wanted, only what is heard)
  await page.evaluate(async ([seconds, spell, hold, wait, jump, each]) => {
    const L = window.lab, every = each ? new Function(each) : null;
    for (let f = 0; f < Math.round(seconds * 60); f++) {
      const now = f / 60;
      window.__jump = jump != null && Math.abs(now - jump) < 0.05;
      every?.();
      if (spell != null && Math.abs(now - wait) < 1e-6) { L.spells.select(Number(spell)); L.spells.press(); }
      if (spell != null && Math.abs(now - wait - hold) < 0.5 / 60) L.spells.release();
      await L.stepSound(1 / 60);
    }
  }, [seconds, spell ?? null, hold, wait, flag('jump') ? Number(flag('jump')) : null, flag('each') ?? null]);
  const { wav, peak } = await page.evaluate(() => window.lab.sound.finish());
  const file = join(out, `${name}.wav`);
  writeFileSync(file, Buffer.from(wav, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-filter_complex', '[0]aformat=channel_layouts=mono,asplit[a][b];[a]showwavespic=s=1800x240:colors=white[w];[b]showspectrumpic=s=1800x480:legend=0:scale=log:fscale=log:start=25:stop=16000[s];[w][s]vstack', join(out, `${name}-sound.png`)]);
  // how loud, second by second: the mean and the peak of each, in dB below full
  const rows = [];
  for (let s = 0; s < seconds; s++) {
    const said = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(s), '-t', '1', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    rows.push(`${s}s ${/mean_volume: (-?[\d.]+)/.exec(said)?.[1]}/${/max_volume: (-?[\d.]+)/.exec(said)?.[1]}`);
  }
  console.log(`${name}.wav peak ${peak.toFixed(3)}\n${rows.join('  ')}`);
  const steps = await page.evaluate(() => window.lab.sound.stepsAt);
  if (steps.length) console.log(`steps: ${steps.length}, ${((steps.length - 1) / (steps[steps.length - 1][0] - steps[0][0] || 1)).toFixed(2)} a second; on ${[...new Set(steps.map((s) => s[1]))].join(', ')}; at ${steps.slice(0, 14).map((s) => s[0].toFixed(2)).join(' ')}`);
  if (problems.length) console.log('problems:\n' + [...new Set(problems)].slice(0, 8).join('\n'));
} catch (e) {
  console.log('FAILED:', e.message.slice(0, 600));
} finally {
  await browser.close();
  server.close();
}
