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
- Hex creatures in `public/mobs/cc0/` are CC0 1.0. Wolf, fox, deer, and cow are Quaternius Ultimate Animated Animals (Attack, Walk, Idle, and the rest of that pack's clips), https://quaternius.com/packs/ultimateanimatedanimals.html . Bear is still the untextured White Bear from OpenGameArt, https://opengameart.org/content/white-bear-low-poly . Bunny: sandsound, Lucky Bunny, https://opengameart.org/content/lucky-bunny . Crab: Textured Cute Monster Pack, https://opengameart.org/content/textured-cute-monster-pack . Fish: Animated Fish, https://opengameart.org/content/animated-fish . The coded shape remains only if a file fails to load.
- Hearth people (`public/hearth/people/`): Quaternius Ultimate Animated Character, CC0 1.0. Maren is Chef Female, Sable is Casual Female, Lumen is Kimono Female, Bram is Worker Male, and the player figure is Casual Male. https://quaternius.com/packs/ultimatedanimatedcharacter.html . Each file keeps its Idle clip.
- Hearth furniture (`public/hearth/furniture/`): Kenney Furniture Kit, CC0 1.0. Bed, chair, table, rug, open bookcase, kitchen stove, and floor lamp. https://kenney.nl/assets/furniture-kit . The fireplace surround is sculpted in code. The logs are Quaternius Medieval Village bonfire, CC0, and the pot is that pack's cauldron, CC0. https://quaternius.com/packs/medievalvillage.html
- Hearth surfaces (`public/hearth/textures/`): Poly Haven, CC0. `wood_floor_worn` diffuse and AO, and `stone_wall` diffuse, all 1k JPG. https://polyhaven.com/a/wood_floor_worn and https://polyhaven.com/a/stone_wall . No HDRI is shipped; the room light is built in the scene.
- The settings panel, the hit mark, and the Long Lake map are drawn in the page.
- Hands mode uses AvatarSample_B by VRoid (`public/figure/AvatarSample_B.vrm`), the same walking character as the overworld. Redistribution and changes are allowed. It is not CC0, and the unmodified file is not for sale. https://hub.vroid.com/en/characters/7939147878897061040/models/2292219474373673889
- The loader is `@pixiv/three-vrm` (MIT).
- Blade adapts the block approach, the cut-angle score, and the wall hit from Moon Rider by Supermedium (MIT, Copyright © 2018, https://github.com/supermedium/moonrider), in `src/rider.js`. The pattern on this page is original. No song, beatmap, BeatSaver art, or BeatSaver audio is included.
- The grenade is thrown the way the ball is thrown in three.js `examples/games_fps.html` (MIT): speed along the look, gravity, and a bounce off the ground.
- Hands mode can ask the camera for a prototype tracker. That code is `@mediapipe/tasks-vision` (Apache-2.0), loaded from the network only after the toggle is turned on. It is not stored in this repo. If the camera is refused, the drawn arms stay.
- Softer meadow steps, `sfx/grass1.ogg` to `grass4.ogg`: Kenney RPG Audio (kenney.nl), CC0 1.0.
- Water steps, `sfx/wade1.ogg` to `wade3.ogg`: rubberduck, "40 CC0 water / splash / slime SFX" (OpenGameArt), CC0 1.0. Shortened.
- The published game also plays recordings from the Sonniss GDC Game Audio Bundles (sonniss.com), under their
  licence: free to use in a game, not to pass on as files. They are not part of this game's open licence, and are not
  in its repo: `MISSING_ASSETS.md` there names each one.
