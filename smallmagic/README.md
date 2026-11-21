---
kind: game
engine: three.js
---

# Small Magic

Aether Realms Online uses this as a base. The code is Blendi's Small Magic (Patch), MIT, kept with `LICENSE`. Credits: `public/CREDITS.md` and `LICENCE-NOTES.md`. The painted medallions, the cover still, and the Sonniss recordings are not in this copy.

First-person staff magic in a painted meadow. Seven spells, from a fire bolt to a tornado and a black hole, and a
hamlet whose buildings and trees really come apart. The whole world is drawn by code: there are no models or textures.
Only the seven spell medallions on screen and the cover are painted pictures.

![The explosion being gathered over the keep](docs/rune-circles.jpg)

## Playing

| | Keyboard and mouse | Controller |
| --- | --- | --- |
| Move, look | WASD, mouse | left stick, right stick |
| Cast (hold for more) | left button | right trigger |
| Change spell | 1 to 7, or the wheel | shoulders |
| Sprint, jump | Shift, Space | press the left stick, bottom button |
| Pause | P | Start |

Fire and wind are gathered while held and thrown when let go. Frost and growth pour for as long as they are held.
The explosion is held until it goes; the singularity stays open while held; the tornado follows where you aim.
M turns the sound on and off.

## For agents: read this before changing or publishing it

**The sound has two parts, and only one of them is in this repo.**

- **In the repo:** every sound is built in layers in `src/sound.js`, and each has a part made in code. Five footsteps
  on grass (`public/sfx`, CC0) are here too. So a fresh copy plays and sounds, with nothing added.
- **Not in the repo:** the published game also plays 39 recordings from the Sonniss GDC Game Audio Bundles, which make
  it sound far fuller. Their licence lets a game use them but does not let anyone pass the files on, so they are left
  out, and `.gitignore` keeps them out.

To get them, **ask the person first** (it downloads about 830 MB from Sonniss's official mirror), then:

```sh
node tools/sounds.mjs fetch    # downloads the 39 recordings and cuts them into public/audio (needs ffmpeg)
node tools/sounds.mjs check    # lists every sound file as ok or MISSING; exits 0 when all are there
npm run build
```

Rules: never commit `public/audio/*.ogg` or `sonniss/` to a repo others can read; a game you publish may play them;
say so in its credits and don't call its sound CC0 or CC BY. `MISSING_ASSETS.md` has the reasons, every recording by
name with what it is for, and how to swap in your own. Open the game with `?bare` to hear it without them.

## Building and running

```sh
npm install
npm run build      # writes dist/, with the licence files and the list of recordings that are there
npm run serve      # serves dist/ at http://127.0.0.1:5495/
```

Node 20 or later. `dist/` is what is published: `index.html` at its top, every path relative, nothing from other hosts.

## How it is made

| Where | What |
| --- | --- |
| `src/main.js` | the page: loading, the one clock, pause, what is drawn each frame |
| `src/meadow/world.js`, `src/structures.js` | the meadow, its trees, and the hamlet built piece by piece |
| `src/spells.js` | casting; `blast.js`, `hole.js`, `twister.js` are the explosion, the singularity and the tornado |
| `src/fire.js`, `src/flames.js`, `src/fx.js` | fire that spreads, its flames, and every particle |
| `src/ruin.js`, `src/physics/`, `vendor/three-avbd` | destruction: what breaks, and the engine that works it out |
| `src/sound.js` | all sound: spells, fire, footsteps, the place, and how it answers what is done to it |
| `src/staff.js`, `src/sigil.js`, `src/page.js` | the staff, the rune circles, and the finishing pass over the picture |

Address flags, for looking at one thing: `?bare` (no recordings), `?nosound`, `?noruin` (nothing to break),
`?shot` (nothing drawn over the picture), `?capture` (no clock: `window.lab.step(dt, n)` advances it).

## Tools

All run the built page in a headless, muted browser that never takes the mouse (`CHROME` names the browser to use).

| | |
| --- | --- |
| `tools/cast.mjs` | casts spells with the clock stepped by hand, for stills and films; `--sound` puts the sound on the film |
| `tools/hear.mjs` | writes down what would be heard, with no sound card: a WAV, a picture of it, loudness by the second |
| `tools/gaps.mjs` | plays in real time and reports any frame slower than 30 ms, and any error |
| `tools/screens.mjs` | a still of each screen: loading, title, playing, paused |
| `tools/sounds.mjs` | the recordings: `fetch`, `check`, `cut`, `list` |

## Licence

Code MIT (`LICENSE`). What everything is and where it came from: `LICENCE-NOTES.md`. Credits: `public/CREDITS.md`.
