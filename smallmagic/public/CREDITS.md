# Small Magic: credits

Aether Realms Online forks this game as a base. Code by Patch, MIT. The painted medallions and the Sonniss recordings are not included in this copy.

Code MIT. The world and everything in it is made in code by Patch.

- The meadow, its buildings and trees, the staff, the spells and their rune circles: made in code by Patch.
- The seven spell medallions on screen (`ui/1.webp` to `ui/7.webp`) and the cover: painted with an image model
  (Nano Banana 2.1) from Patch's direction and the game's own frames.
- Destruction: three-avbd by Steven Bobyn (MIT), with parts after Chris Giles and Erin Catto (MIT); see
  `LICENSE-three-avbd.txt` and `THIRD_PARTY_NOTICES.md`. The way things are built to break is from Patch's
  destruction block (MIT).
- three.js 0.186.1 (MIT), see `THIRD-PARTY-NOTICES.md`.

## Sound

- The sound of every spell, of fire, of footsteps and of the place is built in code (`src/sound.js`, MIT).
- Footsteps on grass, `sfx/step1.ogg` to `step5.ogg`: Kenney's Impact Sounds (kenney.nl), CC0 1.0. Kept as a fallback.
- The log village, the landing plot, and Long Lake are drawn in code. The boar, the slime, and a test goblin use the Cartoon Monster Pack by Overaction Game Studio (`public/mobs/overaction/`, CC0 1.0, see `License.txt`). Credit: Overaction Game Studio, https://overactiongamestudio.com/ . A reskin may replace these before the game goes live. The Kawaii Slimes pack is not included.
- Hex creatures in `public/mobs/cc0/` are CC0 1.0. Wolf, fox, deer, and cow are Quaternius Ultimate Animated Animals (Attack, Walk, Idle, and the rest of that pack's clips), https://quaternius.com/packs/ultimateanimatedanimals.html . Bear is still the untextured White Bear from OpenGameArt, https://opengameart.org/content/white-bear-low-poly . That file has no clips, so its breathing, sway, and wander are drawn in code. No CC0 animated bear or pig could be downloaded for this pass. Bunny: sandsound, Lucky Bunny, https://opengameart.org/content/lucky-bunny . Crab: Textured Cute Monster Pack, https://opengameart.org/content/textured-cute-monster-pack . Fish: Animated Fish, https://opengameart.org/content/animated-fish . The coded shape remains only if a file fails to load.
- Hearth people (`public/hearth/people/`): Sable, Bram, Lumen, and the player figure are Quaternius Ultimate Animated Character, CC0 1.0. Sable is Casual Female, Lumen is Kimono Female, Bram is Worker Male, and the player figure is Casual Male. https://quaternius.com/packs/ultimatedanimatedcharacter.html . Each of those files keeps its Idle clip. `maren.glb` is the unused Quaternius Chef Female, CC0, kept as a fallback if the VRM fails to load.
- Maren Reed (`public/hearth/people/maren-reed.vrm`) is derived from the VRoid official sample AvatarSample_A. Bram (`bram-vroid.vrm`) is derived from AvatarSample_B. Sable (`sable-vroid.vrm`) is derived from AvatarSample_C. Lumen reuses Maren's derived mesh and is recolored at runtime. VRoid allows these samples to be used and changed. None of them is a public-domain licence. These files are the game's characters. They are not the unmodified samples, and they are not offered as a standalone download of those samples. Do not relabel them as public domain. Their idle is an original four-second clip in this game. The loader is `@pixiv/three-vrm` (MIT).
- Hearth furniture (`public/hearth/furniture/`): Kenney Furniture Kit, CC0 1.0. Bed, chair, table, rug, open bookcase, kitchen stove, and floor lamp. https://kenney.nl/assets/furniture-kit . The fireplace surround is sculpted in code. The logs are Quaternius Medieval Village bonfire, CC0, and the pot is that pack's cauldron, CC0. https://quaternius.com/packs/medievalvillage.html
- The city block and the meadow houses (`public/city/kenney/`): Kenney Fantasy Town Kit 2.0, CC0. Walls, doors, shuttered windows, pitched roofs, stalls, lanterns, banners, roads, planks, rocks, hedges, a cart, pillars, a broken fence, and stone stairs. The meadow houses are built from those wall and roof pieces, fitted to each footprint. The kit's trees are not included. https://kenney.nl/assets/fantasy-town-kit . License: `public/city/kenney/License.txt`.
- Hearth surfaces (`public/hearth/textures/`): Poly Haven, CC0. `wood_floor_worn` diffuse and AO, and `stone_wall` diffuse, all 1k JPG. https://polyhaven.com/a/wood_floor_worn and https://polyhaven.com/a/stone_wall . No HDRI is shipped; the room light is built in the scene.
- The settings panel, the hit mark, and the Long Lake map are drawn in the page.
- The map body and Hands mode (`public/figure/hires/`) are the official VRoid Hub AvatarSample A, B, and C, re-encoded from the Hub originals. High textures are capped at 2048. Phone textures are capped at 512. Used under the VRoid Hub sample model terms. **Not CC0**, not MIT, not Apache. Do not label these models or their textures as public domain. Credit: VRoid Project / pixiv. The run is drawn in code on that rig. See `public/figure/hires/README.md`. The older per-part `public/figure/AvatarSample_B.vrm` is not loaded as the player.
- Meadow ground detail (`public/ground/cc0/`): Poly Haven, CC0. `aerial_grass_rock` diffuse and normal, and `brown_mud_leaves_01` diffuse, all 1k JPG. https://polyhaven.com/a/aerial_grass_rock and https://polyhaven.com/a/brown_mud_leaves_01 . They are blended under the painted grass, not used as a photograph of the meadow.
- The player's idle, walk, jog, and sprint (`public/motion/UAL1_Standard.glb`) are the in-place clips from the Universal Animation Library by Quaternius, CC0 1.0. https://quaternius.com/packs/universalanimationlibrary.html . License: `public/motion/License.txt`. They are retargeted onto the VRM. A coded gait remains only if that file fails to load.
- The loader is `@pixiv/three-vrm` (MIT).
- Blade adapts the block approach, the cut-angle score, and the wall hit from Moon Rider by Supermedium (MIT, Copyright © 2018, https://github.com/supermedium/moonrider), in `src/rider.js`. The pattern on this page is original. No song, beatmap, BeatSaver art, or BeatSaver audio is included.
- The grenade is thrown the way the ball is thrown in three.js `examples/games_fps.html` (MIT): speed along the look, gravity, and a bounce off the ground.
- Hands mode can ask the camera for a prototype tracker. That code is `@mediapipe/tasks-vision` (Apache-2.0), loaded from the network only after the toggle is turned on. It is not stored in this repo. If the camera is refused, the drawn arms stay.
- Softer meadow steps, `sfx/grass1.ogg` to `grass4.ogg`: Kenney RPG Audio (kenney.nl), CC0 1.0.
- Water steps, `sfx/wade1.ogg` to `wade3.ogg`: rubberduck, "40 CC0 water / splash / slime SFX" (OpenGameArt), CC0 1.0. Shortened.
- Class moves, hits, cobble steps, UI clicks, and rarity chimes in `sfx/feel/`: Kenney, CC0 1.0. Impact Sounds (hits, bell, glass, concrete steps), Interface Sounds (clicks, confirmations, bong), RPG Audio (knife, draw, chop, book, cloth, pot), and Digital Audio (phase jump, laser). https://kenney.nl/assets/impact-sounds https://kenney.nl/assets/interface-sounds https://kenney.nl/assets/rpg-audio https://kenney.nl/assets/digital-audio
- Calm beds `sfx/feel/bed-meadow.ogg`, `bed-town.ogg`, and `bed-lake.ogg`: short loops made from Kenney Digital Audio tones (`lowThreeTone`, `threeTone1`, `highUp`), low-pass filtered. The source tones are CC0 1.0.
- The published game also plays recordings from the Sonniss GDC Game Audio Bundles (sonniss.com), under their
  licence: free to use in a game, not to pass on as files. They are not part of this game's open licence, and are not
  in its repo: `MISSING_ASSETS.md` there names each one.
