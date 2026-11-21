# Overaction Cartoon Monster Pack

Mobile-ready GLB copies of three monsters from Overaction Game Studio's Cartoon Monster Pack v2.1, for unpublished ARO preview work.

- Author: Overaction Game Studio (https://overactiongamestudio.com/)
- Pack: Cartoon Monster Pack v2.1
- Source: itch.io purchase, 13 November 2026
- License: commercial use and modification permitted. The pack's own License.txt also marks the content CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Credit is requested but not required.

These files are converted, compressed game-ready copies. The original zip and FBX/Blender sources were not modified.

## Files

| File | Default look | Animation clips |
| --- | --- | --- |
| `slime.glb` | Green body (pack default `SlimeBody_Texture.png`) plus packed eye texture | `idle`, `walk` (from ROAM), `attack` |
| `goblin.glb` | Pack `Goblin.png` | `idle`, `walk`, `run`, `attack` (from Atack), `hit`, `death` (from Dead) |
| `boar.glb` | Pack `Boar.png` (resized from 2048 to 1024) | `idle`, `run` (from Boar-RunCycle), `attack` |
| `slime_body_blue.jpg` | Alternate slime body | Swap this onto the slime body material for a blue slime |
| `slime_body_cyan.jpg` | Alternate slime body | Cyan |
| `slime_body_pink.jpg` | Alternate slime body | Pink |
| `slime_body_purple.jpg` | Alternate slime body | Purple |
| `slime_body_yellow.jpg` | Alternate slime body | Yellow |

The pack also ships those five slime body colors as PNG. They are not embedded in `slime.glb`. The unsuffixed green texture is the default. A `SlimeEyes_Texture.png` referenced by the FBX was missing from the zip and was recovered from the packed `Slime.blend`.

## Conversion notes

- Output is glTF 2.0 GLB with embedded JPEG textures (max 1024px) and `KHR_mesh_quantization`. No Draco or Meshopt, so three.js `GLTFLoader` can load these without extra decoders.
- Clips kept: idle, walk/run, attack, hit/damage, and death when present. Everything else was dropped, including the Goblin `Pose` take.
- The Goblin FBX included a full Rigify-style control rig (656 bones). Only the 78 bones with mesh weights (plus `root`) were kept; animation was already baked onto those deform bones.
- The Boar's body and horn meshes were joined. The pack has no walk, hit, or death take for the boar.
- A leftover unskinned Plane was removed from the Slime file.
