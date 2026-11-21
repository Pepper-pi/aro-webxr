// Builds the block's demo into dist/ (index.html at the top) with the files it loads and their licences:
// `npm install`, then `npm run build`.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
execSync(`node "${path.join(here, 'node_modules/vite/bin/vite.js')}" build --config vite.config.mjs`, { cwd: here, stdio: 'inherit' });

const put = (from, to) => fs.cpSync(path.join(here, from), path.join(dist, to), { recursive: true });
put('LICENSE', 'LICENSE.txt');
// which recordings are there for the page to ask for (none, in a copy of this repo: see MISSING_ASSETS.md)
const audio = path.join(dist, 'audio');
fs.mkdirSync(audio, { recursive: true });
fs.writeFileSync(path.join(audio, 'manifest.json'), `${JSON.stringify(fs.readdirSync(audio).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort())}\n`);
put('LICENCE-NOTES.md', 'LICENCE-NOTES.md');
// the destruction engine's own licence and the notices of what it is built on
put('vendor/three-avbd/LICENSE', 'LICENSE-three-avbd.txt');
put('vendor/three-avbd/THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md');

let bytes = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else bytes += fs.statSync(p).size;
  }
};
walk(dist);
console.log(`dist: ${(bytes / 1048576).toFixed(1)} MB`);
