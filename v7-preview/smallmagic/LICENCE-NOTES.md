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
| Map body and Hands, samples A, B, and C | `public/figure/hires/` | Official VRoid Hub AvatarSample A, B, and C, re-encoded. High is capped at 2048. Phone is capped at 512. Not CC0, not MIT, not Apache. Do not label them public domain. Credit VRoid Project / pixiv. The older `public/figure/AvatarSample_B.vrm` is not loaded as the player. |
| Meadow grass and path detail | `public/ground/cc0/` | Poly Haven, CC0. aerial_grass_rock diffuse and normal, brown_mud_leaves_01 diffuse, 1k JPG. |
| Idle, walk, jog, sprint | `public/motion/UAL1_Standard.glb` | Quaternius Universal Animation Library, CC0. In-place clips, retargeted onto the VRM. |
| City block and meadow houses | `public/city/kenney/` | Kenney Fantasy Town Kit 2.0, CC0. Trees from that kit are not included. Meadow houses reuse the wall, door, window, and roof pieces. |
| Maren Reed | `public/hearth/people/maren-reed.vrm` | Derived from VRoid AvatarSample_A. Not a public-domain licence. Not the unmodified sample. |
| Bram | `public/hearth/people/bram-vroid.vrm` | Derived from VRoid AvatarSample_B. Not a public-domain licence. Not the unmodified sample. |
| Sable | `public/hearth/people/sable-vroid.vrm` | Derived from VRoid AvatarSample_C. Not a public-domain licence. Not the unmodified sample. |
| Lumen Pike | `public/hearth/people/lumen-pike.vrm` | Derived from VRoid AvatarSample_C, then dressed in the game (mantle, braids, lantern). Not a public-domain licence. Not the unmodified sample. Not Maren's AvatarSample_A mesh. |
| Porcelain healer | same AvatarSample_C derivation as Sable | Runtime ceramic glaze, cracks, glyphs, pink eyes, and joint rings. Not a public-domain licence. Not a playable class. The hub stand-in uses the player's AvatarSample body instead of the untextured Quaternius figure. |
| VRM loader | `@pixiv/three-vrm` 3.6.0 | pixiv, MIT |
| VRM animation | `@pixiv/three-vrm-animation` 3.6.0 | pixiv, MIT |
| Outdoor GPS | `locar` 0.2.12 | AR.js organisation, MIT. Location-based only. Full AR.js and jsartoolkit (LGPLv3) are not installed. |
| Outdoor distances | `@turf/distance` 7.2.0 | Turf authors, MIT |
| Hub picking | `three-mesh-bvh` 0.8.3 | Garrett Johnson, MIT |
| Sky and water | `three/addons/objects/Sky.js`, `Water.js` | three.js, MIT. Already in the three package. No new dependency. The water normal is drawn in the game. |
| Hearth idle, talk, greet, nod | `public/hearth/motion/Idle_Loop.vrma`, `Idle_Talking_Loop.vrma`, `Interact.vrma`, `Yes.vrma` | Quaternius Universal Animation Library, CC0, as `.vrma` in Sanami's open-vrma set (`quaternius/ual1` for the first three, `quaternius/ual2` for `Yes.vrma`, https://huggingface.co/datasets/Sanami/open-vrma). Not Mixamo. Not CMU. |
| Recordings laid over it in the published game | not in the repo | Sonniss GDC Game Audio Bundles, their own licence; see `MISSING_ASSETS.md` |

Nothing here has no stated source.

## What this Aether Realms copy kept and left out

Kept: `LICENSE`, this file, `src/`, `index.html`, `tools/`, `vendor/three-avbd` (MIT), `public/CREDITS.md`, `public/LICENSES/CC0-1.0.txt`, the five Kenney Impact footsteps `public/sfx/step1.ogg` to `step5.ogg` (CC0), four Kenney RPG Audio steps `sfx/grass1.ogg` to `grass4.ogg` (CC0), and three rubberduck water splashes `sfx/wade1.ogg` to `wade3.ogg` (CC0).

Left out: `public/ui/1.webp` to `7.webp` (painted medallions; not a stated open licence, so the drawn emblems stand in), `docs/rune-circles.jpg` (a picture, not code), and every Sonniss recording (`public/audio`, `sonniss/`). Those recordings were not downloaded. The game already plays when they are missing.
