// Headless pass over the built preview: every class, the main screens, and a phone-quality cost reading.
//   node tools/smoke.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(here, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.vrm': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const errors = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console ${msg.text()}`);
  });
  await page.addInitScript(() => {
    const raw = {
      'aro-party': JSON.stringify({ slots: [{ kind: 'nope' }, null, 'fox'], active: 9 }),
      'aro-herbs': 'lots',
      'aro-class': 'healer',
      'aro-hex-xp': '[]',
      'aro-hub': '{',
      'aro-bestiary': 'nope',
      'aro-pet': '1',
    };
    const store = {};
    const gone = new Set();
    const ls = {
      getItem: (k) => (gone.has(k) ? null : (k in store ? store[k] : raw[k] ?? null)),
      setItem: (k, v) => { gone.delete(k); store[k] = String(v); },
      removeItem: (k) => { gone.add(k); delete store[k]; },
      key: (i) => Object.keys(raw).filter((k) => !gone.has(k)).concat(Object.keys(store))[i] || null,
      get length() { return Object.keys(raw).filter((k) => !gone.has(k)).length; },
    };
    Object.defineProperty(window, 'localStorage', { value: ls });
  });
  const budget = process.argv.includes('--budget') ? '&budget' : '';
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&q=low&nostaff${budget}`);
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
  const report = await page.evaluate(async () => {
    const L = window.lab;
    const notes = [];
    notes.push(`start herbs=${localStorage.getItem('aro-herbs')} class=${localStorage.getItem('aro-class')} party=${localStorage.getItem('aro-party')}`);
    const classes = ['mage', 'blade', 'gunner', 'summoner', 'puppet', 'warden', 'ranger', 'alchemist', 'nope'];
    const click = (sel) => document.querySelector(sel)?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    click('#gear');
    notes.push(`settings ${document.getElementById('settings')?.hidden === false}`);
    const budgetOnly = new URLSearchParams(location.search).has('budget');
    if (!budgetOnly) for (const name of classes) {
      try {
        click(`[data-class="${name}"]`);
        L.step(1 / 60, 2);
        const who = name === 'nope' ? 'mage' : name;
        const moves = L.kitCount?.(who) || 0;
        if (L.act && name !== 'nope') {
          for (let i = 0; i < moves; i++) {
            L.act(who, i, true);
            L.step(1 / 30, 2);
            L.act(who, i, false);
            L.step(1 / 30, 2);
          }
        }
        notes.push(`${name} class=${L.settings.class} moves=${moves}`);
      } catch (err) { notes.push(`${name} fail ${err.message}`); }
    }
    click('#raidTest');
    L.step(1 / 30, 8);
    notes.push(`raid ${!!L.duel.active}`);
    L.duel.end?.();
    click('#petTest');
    L.step(1 / 30, 4);
    notes.push(`pet ${!!L.duel.active}`);
    L.duel.end?.();
    try {
      L.zones.enter('lake');
      L.step(1 / 30, 4);
      const fish = document.getElementById('fish');
      fish?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      L.step(1 / 30, 3);
      fish?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      L.step(1 / 30, 6);
      notes.push(`lake ${L.zones.name} rod ${!!L.zones.rodOut}`);
    } catch (err) { notes.push(`lake fail ${err.message}`); }
    try {
      L.hub.openHome();
      L.step(1 / 30, 4);
      notes.push(`hub ${L.zones.name} home ${document.getElementById('home')?.hidden === false}`);
      L.hub.openBoard();
      notes.push(`crew ${document.getElementById('crew')?.hidden === false}`);
      L.hub.closeAll();
    } catch (err) { notes.push(`hub fail ${err.message}`); }
    L.zones.enter('meadow');
    try { await L.zones.town?.ready; } catch (err) { notes.push(`town fail ${err.message}`); }
    L.player.place?.(-4, 24, 0) || L.teleport(-4, 24, -4, 22);
    L.step(1 / 30, 8);
    L.zones.showBoard();
    notes.push(`board ${document.getElementById('board')?.hidden === false} square ${!!L.zones.town?.square?.notice}`);
    const sample = (label) => {
      const r = L.renderer;
      r.info.reset();
      r.info.autoReset = false;
      L.draw();
      L.step(1 / 60, 1);
      const seen = new Set();
      let bytes = 0;
      L.scene.traverse((o) => {
        const mats = o.material ? [].concat(o.material) : [];
        for (const m of mats) {
          for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'aoMap']) {
            const t = m[key];
            if (!t || seen.has(t)) continue;
            seen.add(t);
            const img = t.image;
            const w = img?.width || img?.videoWidth || t.source?.data?.width || 0;
            const h = img?.height || img?.videoHeight || t.source?.data?.height || 0;
            bytes += w * h * 4;
          }
        }
      });
      const heavy = [];
      L.scene.traverse((o) => {
        const g = o.geometry;
        if (!g?.attributes?.position) return;
        const base = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        const inst = o.isInstancedMesh ? o.count : (g.instanceCount || 1);
        const tris = base * inst;
        if (tris > 8000) heavy.push({ name: o.name || o.type, tris: Math.round(tris) });
      });
      heavy.sort((a, b) => b.tris - a.tris);
      return { label, calls: r.info.render.calls, triangles: r.info.render.triangles, textures: r.info.memory.textures, texBytes: bytes, heavy: heavy.slice(0, 8) };
    };
    L.zones.enter('meadow');
    L.teleport(2, 22, 2, 28);
    L.step(1 / 30, 4);
    const meadow = sample('meadow-square');
    const hex = L.hexes.list?.find((h) => h.id === 'meadow');
    if (hex) L.hexes.enter(hex);
    L.step(1 / 30, 4);
    const hexView = sample('hex');
    return { notes, meadow, hexView, herbs: localStorage.getItem('aro-herbs'), party: localStorage.getItem('aro-party'), cls: localStorage.getItem('aro-class') };
  });
  console.log(JSON.stringify({ errors, report }, null, 2));
} finally {
  await browser.close();
  server.close();
}
