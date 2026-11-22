# Small Magic: licence notes

Code MIT (`LICENSE`). The world is drawn by code in `src/`: there are no models, textures or fonts in the repo
(text uses the fonts already on the player's PC).

| What | Where | Source and licence |
| --- | --- | --- |
| The game | `src/`, `index.html`, `tools/` | Patch, MIT |
| three.js 0.186.1 | npm | MIT; its notice is written into each build as `THIRD-PARTY-NOTICES.md` |
| three-avbd | `vendor/three-avbd` | Steven Bobyn, MIT, at the commit named in its `VENDOR.md`, one kernel changed; third parties in its `THIRD_PARTY_NOTICES.md` |
| How things are built to break | `src/physics/` | Patch's destruction block, MIT |
| Five footsteps on grass | `public/sfx/step1.ogg` to `step5.ogg` | Kenney's Impact Sounds, CC0 1.0 (`public/LICENSES/CC0-1.0.txt`) |
| Seven spell medallions | `public/ui/1.webp` to `7.webp` | Made for this game with an image model (Nano Banana 2.1), from Patch's direction and the game's cover; no other source |
| Sound made in code | `src/sound.js` | Patch, MIT |
| Hands, the walking character | `public/figure/AvatarSample_B.vrm` | VRoid AvatarSample_B. Share and change it. Not CC0. Do not sell the unmodified file. |
| Maren Reed | `public/hearth/people/maren-reed.vrm` | Derived from VRoid AvatarSample_A. Not a public-domain licence. Not the unmodified sample. |
| Bram | `public/hearth/people/bram-vroid.vrm` | Derived from VRoid AvatarSample_B. Not a public-domain licence. Not the unmodified sample. |
| Sable | `public/hearth/people/sable-vroid.vrm` | Derived from VRoid AvatarSample_C. Not a public-domain licence. Not the unmodified sample. |
| Lumen | same mesh as Maren Reed | Runtime recolor of the Maren derivation. Not a public-domain licence. |
| VRM loader | `@pixiv/three-vrm` | pixiv, MIT |
| Recordings laid over it in the published game | not in the repo | Sonniss GDC Game Audio Bundles, their own licence; see `MISSING_ASSETS.md` |

Nothing here has no stated source.

## What this Aether Realms copy kept and left out

Kept: `LICENSE`, this file, `src/`, `index.html`, `tools/`, `vendor/three-avbd` (MIT), `public/CREDITS.md`, `public/LICENSES/CC0-1.0.txt`, the five Kenney Impact footsteps `public/sfx/step1.ogg` to `step5.ogg` (CC0), four Kenney RPG Audio steps `sfx/grass1.ogg` to `grass4.ogg` (CC0), and three rubberduck water splashes `sfx/wade1.ogg` to `wade3.ogg` (CC0).

Left out: `public/ui/1.webp` to `7.webp` (painted medallions; not a stated open licence, so the drawn emblems stand in), `docs/rune-circles.jpg` (a picture, not code), and every Sonniss recording (`public/audio`, `sonniss/`). Those recordings were not downloaded. The game already plays when they are missing.
