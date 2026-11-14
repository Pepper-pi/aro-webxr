// The recordings the demo lays over the sound it makes in code. They are from the Sonniss GDC Game Audio Bundles:
// free to use in a game, but not to pass on as files, so they are not in this repo (MISSING_ASSETS.md). With none of
// them the game still sounds: every sound has a part made in code (src/sound.js).
//
//   node tools/sounds.mjs fetch   downloads the 39 recordings, about 830 MB, one by one from Sonniss's official mirror
//                                 into ./sonniss (skipping any already there), then cuts them
//   node tools/sounds.mjs check   says which of the game's sound files are in public/audio and which are missing
//   node tools/sounds.mjs         cuts them from recordings already on disk (also: `cut`)
//   node tools/sounds.mjs list    prints the table of what each recording is and where it comes from
//
// The recordings are looked for in ./sonniss, or in the folders named by SONNISS_DIR (several: joined as PATH is), laid
// out <year>/<library folder>/<file> with the names below. Cutting needs ffmpeg with libvorbis on the path. A recording
// it can't find is skipped, and it says which. What it writes, about 9 MB: public/audio/<id>.ogg and manifest.json.
//
// Steps (`steps: n`) are n single steps found in a recording of someone walking, each written as <id>1.ogg and so on:
// a step is a stretch of sound between two silences, a tenth to six tenths of a second long.
// A shot is the recording from its first sound on (or from `from` seconds in, for `length` seconds), brought to one
// peak, its end faded. A loop is 33 s (or `span`) that joins itself, brought to one loudness.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const SOUNDS = [
  { id: 'boom', what: 'A large explosion, close: the body of the blast', year: 2017, library: 'Gamemaster Audio -  Explosion Sound Pack', file: 'explosion_large_08.wav' },
  { id: 'deep', what: 'A deep explosion: the weight under the blast', year: 2020, library: 'Stefano Cremona - Explosions', file: 'DeepExplosion02.wav' },
  { id: 'tail', what: 'A big explosion with a long tail: what rolls on after the blast', year: 2020, library: 'Stefano Cremona - Explosions', file: 'BigExplosion02.wav', length: 13 },
  { id: 'far', what: 'A distant blast: the blast come back from the hills', year: 2018, library: 'Lukas Tvrdon - Distant Blast', file: 'Distant Blast 38.wav' },
  { id: 'fireball', what: 'A large fire taking: the ball of fire', year: 2018, library: 'Gregor Quendel - Designed Fire', file: 'Designed Fire - Impacts - Large, ignition 03.wav', length: 10 },
  { id: 'rubble', what: 'A slide of crumbling rock: a wall coming down', year: 2017, library: 'Mechanical Wave - Rock,Brick and Dirt - Part 02', file: 'Crumbling Rock Slide_RBDII 07.wav' },
  { id: 'bricks', what: 'Brick, rock and gravel struck hard: masonry broken', year: 2020, library: 'PMSFX - Shattering Bricks', file: 'PM_SB_DESIGNED_IMPACT_116 Impact brick rock dirt gravel designed multi LFE.wav' },
  { id: 'dust', what: 'Rock and dust falling: what comes down afterwards', year: 2020, library: 'Bluezone - Tank - Explosion Sound Effects', file: 'Bluezone_BC0271_debris_falling_rock_dust_002.wav' },
  { id: 'quake', what: 'The ground shaking, steady and heavy: under the gathering and under the blast', year: 2018, library: 'Olivier Girardot - Guns & Explosions', file: 'Earthquake 3 - Big.wav', from: 14, length: 10 },
  { id: 'slam', what: 'Something huge struck once: the weight of each circle, and of the blast', year: 2016, library: 'Game Audio Factory - GAFSFX01 - Dark Materials', file: 'GAF SFX01 - HORROR - Hammer Impact, huge.wav', length: 1.4 },
  { id: 'dark', what: 'A dark designed impact with a low tail: more weight under the blast', year: 2016, library: '3maze - High Impact', file: 'med_dark_001.wav' },
  { id: 'swoosh', what: 'A burst of fire rushing past: power running into a circle', year: 2018, library: 'Gregor Quendel - Designed Fire', file: 'Designed Fire - Swooshes - Burst, evolving 34.wav', from: 2.2, length: 2.4 },
  { id: 'stress', what: 'Timber and iron under great strain, groaning: a building being pulled apart', loop: true, span: 17, year: 2019, library: 'Rock The Speakerbox - Broken', file: 'BROKEN - DESIGNED - MINE SHAFT Wood Metal Stress Very Long 06.wav', from: 1, loudness: -22 },
  { id: 'grind', what: 'Rock grinding on rock, without end: stone carried round', loop: true, span: 19, year: 2018, library: 'Gregor Quendel - Designed Rocks', file: 'Designed Rocks - EVO19 - Texture - Filtered 4.wav', from: 1.5, loudness: -22 },
  { id: 'gusts', what: 'Hard gusts of wind on a mountain top: the body of a whirlwind', loop: true, year: 2018, library: 'Discover Oregon - Wind and Storms', file: 'Wind Gusts 2016 Lookout Snow - Biggest Gusts Long.wav', from: 118, loudness: -20 },
  { id: 'whistle', what: 'Wind whistling softly through a gap: the voice of a whirlwind', loop: true, year: 2020, library: 'Coll Anderson - Gentle Wind', file: 'EFX SD Wind Soft Whistling Gusts 04.wav', from: 20, loudness: -22 },
  { id: 'firetex', what: 'Fire rumbling, a steady texture: a whirlwind that has taken fire', loop: true, span: 27, year: 2018, library: 'Gregor Quendel - Designed Fire', file: 'Designed Fire - Textures - Rumbling, glitch.wav', from: 2, loudness: -18 },
  { id: 'firewind', what: 'Fire rushing in waves: the same, nearer', loop: true, span: 11, year: 2018, library: 'Gregor Quendel - Designed Fire', file: 'Designed Fire - Winds - Binaural, swoosh, waves 02.wav', from: 1, loudness: -20 },
  { id: 'rush', what: 'A fast stream: a whirlwind over water', loop: true, span: 20, year: 2018, library: 'Discover Oregon - Ocean and Stream', file: 'Streams 2014 McKenzie 1.wav', from: 3, loudness: -24 },
  { id: 'ice', what: 'Broken ice falling: a whirlwind that has taken frost', year: 2016, library: '3maze -  ICE BLOCK', file: 'debris_ice_001.wav' },
  { id: 'stove', what: 'A fire crackling in a stove: fire near at hand', loop: true, year: 2020, library: 'Coll Anderson - Gentle Wind', file: 'EFX SD Fire in Metal Stove 03.wav', from: 10, loudness: -20 },
  { id: 'iceburn', what: 'Ice hissing and ticking as it is burnt: cold pouring', loop: true, span: 4, year: 2016, library: '3maze -  ICE BLOCK', file: 'burn_ice_001.wav', from: 0.1, loudness: -22 },
  { id: 'ice2', what: 'A weight smashed down on ice, and what falls: ice breaking', year: 2018, library: 'FLYSOUND - Ice Fury', file: 'IC0318 KETTLEBELL SMASH DEBRIS 02.wav' },
  { id: 'ice3', what: 'Ice struck with a big chisel', year: 2018, library: 'FLYSOUND - Ice Fury', file: 'IC0151 BIG CHISEL HIT DEBRIS 06.wav' },
  { id: 'ice4', what: 'Ice struck with a crowbar', year: 2018, library: 'FLYSOUND - Ice Fury', file: 'IC0271 CROWBAR HIT DEBRIS 12.wav' },
  { id: 'icescrape', what: 'A chisel scraped along ice', year: 2018, library: 'FLYSOUND - Ice Fury', file: 'IC0120 CHISEL SCRAPE DEBRIS 09.wav' },
  { id: 'leaves', what: 'A pile of leaves gathered up: leaves torn loose, things sprouting', year: 2018, library: 'Soundrangers - Foley Elements Foliage', file: 'leaves_pile_pick_up_04.wav' },
  { id: 'creaks', what: 'A tree creaking gently: wood growing', loop: true, year: 2018, library: 'Discover Oregon - Wind and Storms', file: 'Creaks and Snaps 2017.03.20 - Gentle Tree Creaks.WAV', from: 60, loudness: -24 },
  { id: 'grassy', what: 'A breeze in tall grass: the meadow coming back', loop: true, year: 2017, library: 'Hzandbits - Wind In Trees', file: 'Wind,Ext,Breeze,Grass,Tall,Rustle,Buffeting.wav', from: 20, loudness: -24 },
  { id: 'treetops', what: 'Wind in tree tops, with birds', loop: true, year: 2018, library: 'Alexander Kopeikin - Quad ambience of Crimea in summer', file: '28 lake, high wind in tree tops, birds, daytime - QUAD XY LR.wav', from: 60, loudness: -24 },
  { id: 'birds', what: 'A summer evening on a hill: birds, insects, quiet air', loop: true, year: 2018, library: 'Alexander Kopeikin - Quad ambience of Crimea in summer', file: '09 vineyard evening ambience, hill, very quiet, birds, crickets, take 2, ortf offset 5 m, front - ORTF.wav', from: 40, loudness: -26 },
  { id: 'grassstep', what: 'Single steps on grass', steps: 8, year: 2017, library: 'Tovusound - Edward - Foleyart Collection Add-On Extended Footsteps', file: '169_Foley_Footsteps_Grass_Sneaker_Walk_Fast_Run_Jog_Close.wav' },
  { id: 'stonestep', what: 'Single steps on a hard road: paving', steps: 8, year: 2017, library: 'Tovusound - Edward - Foleyart Collection Add-On Extended Footsteps', file: '015_Foley_Footsteps_Asphalt_Boot_Walk_Fast_Run_Jog_Close.wav' },
  { id: 'dirtstep', what: 'Single steps on dirt and gravel: the path', steps: 8, year: 2019, library: 'PMSFX - STEPS Dirt & Gravel', file: 'PM_SDNG_Stereo_Walk_Seamless_Loop_1.wav' },
  { id: 'snowstep', what: 'Single steps in snow: ground that has been frozen', steps: 8, year: 2019, library: 'Studio 23 - Ultimate Footstep Collection', file: 'S23_SFX_Footsteps_Snow_Singles_Sequence.wav' },
  { id: 'ashstep', what: 'Single steps on dry leaves: ground that has been burnt', steps: 8, year: 2018, library: 'Sounds Visual - Footsteps on Leaves', file: 'FX3280 Walking Faster Leaves Foley Foosteps.wav' },
  { id: 'landstep', what: 'Landing on two feet after a jump', steps: 3, year: 2017, library: 'Tovusound - Edward - Foleyart Collection Add-On Extended Footsteps', file: '289_Foley_Footsteps_Rocks_Sneaker_Jump_Land_On_Two_Feet_Close.wav' },
  { id: 'lake', what: 'Small waves at the bank of a lake', loop: true, year: 2019, library: 'BlueZone - Lake Wave Sound Effects', file: 'Bluezone_BC0252_lake_wave_ambience_04.wav', from: 8, loudness: -26 },
  { id: 'wind', what: 'Wind in swells over open ground', loop: true, year: 2020, library: 'Coll Anderson - Gentle Wind', file: 'EFX SD Design Wind Swells 03.wav', from: 20, loudness: -27 },
];

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] ?? 'cut';
  if (!['cut', 'fetch', 'check', 'list'].includes(cmd)) throw new Error('fetch, check, cut or list');
  const roots = process.env.SONNISS_DIR ? process.env.SONNISS_DIR.split(path.delimiter) : [path.join(here, '..', 'sonniss')];
  const out = path.join(here, '..', 'public', 'audio');
  // where each recording is on Sonniss's mirror, and how big
  const sources = JSON.parse(fs.readFileSync(path.join(here, 'sound-sources.json'), 'utf8'));
  const made = (s) => (s.steps ? Array.from({ length: s.steps }, (_, i) => `${s.id}${i + 1}.ogg`) : [`${s.id}.ogg`]);
  const part = (s) => (s.steps ? `${s.steps} single steps cut out of it` : s.loop ? `a ${s.span ?? 33} s loop from ${s.from ?? 0} s in` : s.from || s.length ? `${s.length ? `${s.length} s` : 'the rest'} from ${s.from ? `${s.from} s in` : 'its first sound'}` : 'all of it');
  if (cmd === 'list') {
    console.log('| Files in `public/audio` | What it is | Bundle | Library | Recording | Part used |\n| --- | --- | --- | --- | --- | --- |');
    for (const s of SOUNDS) console.log(`| ${s.steps ? `\`${s.id}1.ogg\` to \`${s.id}${s.steps}.ogg\`` : `\`${s.id}.ogg\``} | ${s.what} | GDC ${s.year} | ${s.library} | ${s.file} | ${part(s)} |`);
    process.exit(0);
  }
  if (cmd === 'check') {
    let missing = 0;
    for (const s of SOUNDS) {
      const gone = made(s).filter((f) => !fs.existsSync(path.join(out, f)));
      missing += gone.length;
      console.log(`${gone.length ? 'MISSING' : 'ok     '}  ${s.id.padEnd(10)} ${s.what}${gone.length ? `  (${gone.join(', ')})` : ''}`);
    }
    console.log(missing ? `\n${missing} files missing: the game plays, with the sound it makes in code in their place. To get them: node tools/sounds.mjs fetch` : '\nAll of the recordings are there.');
    process.exit(missing ? 1 : 0);
  }
  if (cmd === 'fetch') {
    // one file at a time from the mirror, each to where the cutting looks for it; one already whole is left alone
    const have = (s) => roots.some((r, i) => { const f = path.join(r, String(s.year), s.library, s.file); return fs.existsSync(f) && (i > 0 || fs.statSync(f).size === sources[s.id].bytes); });
    const todo = SOUNDS.filter((s) => !have(s));
    console.log(`${SOUNDS.length - todo.length} of ${SOUNDS.length} recordings already here; fetching ${todo.length} (${(todo.reduce((a, s) => a + sources[s.id].bytes, 0) / 1048576).toFixed(0)} MB) from ftpmirror.your.org`);
    for (const s of todo) {
      const f = path.join(roots[0], String(s.year), s.library, s.file);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      const r = await fetch(sources[s.id].url);
      if (!r.ok) { console.log(`could not get ${s.id}: ${r.status} ${sources[s.id].url}`); continue; }
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(`${f}.part`));
      fs.renameSync(`${f}.part`, f);
      console.log(`got ${s.id} (${(sources[s.id].bytes / 1048576).toFixed(0)} MB)`);
    }
  }
  fs.mkdirSync(out, { recursive: true });
  const take = path.join(os.tmpdir(), `magic-take-${process.pid}.wav`);
  const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  for (const s of SOUNDS) {
    const source = roots.map((root) => path.join(root, String(s.year), s.library, s.file)).find((f) => fs.existsSync(f)) ?? path.join(roots[0], String(s.year), s.library, s.file);
    if (!fs.existsSync(source)) {
      console.log(`not found, skipped: ${s.id} (${source})`);
      continue;
    }
    const to = path.join(out, `${s.id}.ogg`);
    if (s.steps) {
      const said = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', source, '-af', 'silencedetect=noise=-34dB:d=0.08', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
      const marks = [...said.matchAll(/silence_(start|end): ([\d.]+)/g)].map((m) => [m[1], Number(m[2])]), found = [];
      for (let i = 0; i < marks.length - 1; i++) if (marks[i][0] === 'end' && marks[i + 1][0] === 'start') { const d = marks[i + 1][1] - marks[i][1]; if (d > 0.1 && d < 0.6) found.push([marks[i][1], d]); }
      // (spread through the recording, and not its first two, which are often someone setting off)
      const pool = found.slice(2), picked = Array.from({ length: Math.min(s.steps, pool.length) }, (_, i) => pool[Math.floor((i * pool.length) / Math.min(s.steps, pool.length))]);
      picked.forEach(([at, d], i) => {
        ffmpeg('-ss', Math.max(0, at - 0.008).toFixed(3), '-t', (d + 0.07).toFixed(3), '-i', source, '-af', 'aresample=48000', '-ac', '2', take);
        const heard = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', take, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
        const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(heard)?.[1] ?? 0);
        ffmpeg('-i', take, '-af', `volume=${(-3 - peak).toFixed(2)}dB,afade=t=out:st=${(d + 0.02).toFixed(3)}:d=0.05`, '-c:a', 'libvorbis', '-q:a', '5', path.join(out, `${s.id}${i + 1}.ogg`));
      });
      console.log(`wrote public/audio/${s.id}1..${picked.length}.ogg`);
      continue;
    }
    if (s.loop) {
      ffmpeg('-ss', String(s.from ?? 0), '-t', String((s.span ?? 33) + 3), '-i', source, '-af', `aresample=48000,loudnorm=I=${s.loudness}:TP=-3,aresample=48000`, '-ac', '2', take);
      // the take is opened twice: its body from 3 s on, and its first 3 s to fade in over the body's end
      ffmpeg('-ss', '3', '-i', take, '-t', '3', '-i', take, '-filter_complex', '[0][1]acrossfade=d=3:c1=tri:c2=tri', '-c:a', 'libvorbis', '-q:a', '5', to);
    } else {
      // from its first sound, so that it lands when it is asked for
      const cut = [...(s.from ? ['-ss', String(s.from)] : []), '-i', source, '-af', `aresample=48000,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.004${s.length ? `,atrim=0:${s.length}` : ''}`, '-ac', '2', take];
      ffmpeg(...cut);
      const said = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', take, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
      const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(said)?.[1] ?? 0);
      const length = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', take], { encoding: 'utf8' }).stdout);
      ffmpeg('-i', take, '-af', `volume=${(-1.5 - peak).toFixed(2)}dB,afade=t=out:st=${Math.max(0, length - 0.25).toFixed(3)}:d=0.25`, '-c:a', 'libvorbis', '-q:a', '5', to);
    }
    console.log(`wrote public/audio/${s.id}.ogg`);
  }
  fs.rmSync(take, { force: true });
  // what is there, for the page to ask for (the build writes this list again from what it finds)
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(fs.readdirSync(out).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort())}\n`);
}
