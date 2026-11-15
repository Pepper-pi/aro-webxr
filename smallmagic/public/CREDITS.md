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
- The log village, the landing plot, Long Lake and the beasts are drawn in code on the meadow. No animal models were imported.
- The settings panel, the hit mark, and the Long Lake map are drawn in the page.
- Hands mode uses AvatarSample_B by VRoid (`public/figure/AvatarSample_B.vrm`), the same walking character as the overworld. Redistribution and changes are allowed. It is not CC0, and the unmodified file is not for sale. https://hub.vroid.com/en/characters/7939147878897061040/models/2292219474373673889
- The loader is `@pixiv/three-vrm` (MIT).
- Blade borrows the lane, the cut, and the wall from Moon Rider by Supermedium (MIT, https://github.com/supermedium/moonrider). The pattern in this page is original. No BeatSaver song or map is included.
- Hands mode can ask the camera for a prototype tracker. That code is `@mediapipe/tasks-vision` (Apache-2.0), loaded from the network only after the toggle is turned on. It is not stored in this repo. If the camera is refused, the drawn arms stay.
- Softer meadow steps, `sfx/grass1.ogg` to `grass4.ogg`: Kenney RPG Audio (kenney.nl), CC0 1.0.
- Water steps, `sfx/wade1.ogg` to `wade3.ogg`: rubberduck, "40 CC0 water / splash / slime SFX" (OpenGameArt), CC0 1.0. Shortened.
- The published game also plays recordings from the Sonniss GDC Game Audio Bundles (sonniss.com), under their
  licence: free to use in a game, not to pass on as files. They are not part of this game's open licence, and are not
  in its repo: `MISSING_ASSETS.md` there names each one.
