# Recordings that are not in this repo

**In one line:** the game plays without them; to get them, run `node tools/sounds.mjs fetch` (after asking the person,
since it downloads about 830 MB), then build.

## What this is about

Every sound in the game is built in layers (`src/sound.js`). Each has a part made in code, which is in this repo, and
five footsteps on grass that are CC0 are in `public/sfx`. So a copy of this repo sounds, with nothing added.

The published game also lays **39 recordings** over those parts, cut into the 76 small files listed below. They come
from the Sonniss GDC Game Audio Bundles. Their licence (https://sonniss.com/gdc-bundle-license/) lets anyone use them in
a game, free, with no credit needed, but does not let anyone pass the recordings on as files. So:

- they are **not in this repo**, and `.gitignore` keeps `public/audio/*.ogg` and `sonniss/` out of it;
- **never commit them** to a repo other people can read, and never upload them anywhere as sounds;
- a game you publish **may** play them. Say in its credits that its sound uses Sonniss recordings, and don't call its
  sound CC0 or CC BY.

## Getting them

1. **Ask the person first.** It downloads 39 files, about 830 MB, from `ftpmirror.your.org`, Sonniss's official mirror.
2. Run `node tools/sounds.mjs fetch`. It needs Node 20 or later, and ffmpeg with libvorbis on the path. It puts the
   recordings in `sonniss/`, skips any already there, and cuts them into `public/audio` (about 9 MB).
3. Run `node tools/sounds.mjs check`. It names every file and says `ok` or `MISSING`; it exits 0 when all are there.
4. Build (`npm run build`). The build lists what is in `public/audio`, and the game asks only for what is listed.

To hear the game as it is without them, open it with `?bare` on its address.

If the bundles are already on the PC, point at them instead of downloading: `SONNISS_DIR=<folder> node tools/sounds.mjs`,
where `<folder>` holds `<year>/<library>/<file>` as named below (several folders: joined as PATH is).

## Using other recordings

Any recording of the same kind of thing will do. Put it at `public/audio/<name>.ogg` under the name in the first
column, and build. Each row says what the sound is for, so that a replacement can be chosen to fit.

## The recordings

| Files in `public/audio` | What it is | Bundle | Library | Recording | Part used |
| --- | --- | --- | --- | --- | --- |
| `boom.ogg` | A large explosion, close: the body of the blast | GDC 2017 | Gamemaster Audio -  Explosion Sound Pack | explosion_large_08.wav | all of it |
| `deep.ogg` | A deep explosion: the weight under the blast | GDC 2020 | Stefano Cremona - Explosions | DeepExplosion02.wav | all of it |
| `tail.ogg` | A big explosion with a long tail: what rolls on after the blast | GDC 2020 | Stefano Cremona - Explosions | BigExplosion02.wav | 13 s from its first sound |
| `far.ogg` | A distant blast: the blast come back from the hills | GDC 2018 | Lukas Tvrdon - Distant Blast | Distant Blast 38.wav | all of it |
| `fireball.ogg` | A large fire taking: the ball of fire | GDC 2018 | Gregor Quendel - Designed Fire | Designed Fire - Impacts - Large, ignition 03.wav | 10 s from its first sound |
| `rubble.ogg` | A slide of crumbling rock: a wall coming down | GDC 2017 | Mechanical Wave - Rock,Brick and Dirt - Part 02 | Crumbling Rock Slide_RBDII 07.wav | all of it |
| `bricks.ogg` | Brick, rock and gravel struck hard: masonry broken | GDC 2020 | PMSFX - Shattering Bricks | PM_SB_DESIGNED_IMPACT_116 Impact brick rock dirt gravel designed multi LFE.wav | all of it |
| `dust.ogg` | Rock and dust falling: what comes down afterwards | GDC 2020 | Bluezone - Tank - Explosion Sound Effects | Bluezone_BC0271_debris_falling_rock_dust_002.wav | all of it |
| `quake.ogg` | The ground shaking, steady and heavy: under the gathering and under the blast | GDC 2018 | Olivier Girardot - Guns & Explosions | Earthquake 3 - Big.wav | 10 s from 14 s in |
| `slam.ogg` | Something huge struck once: the weight of each circle, and of the blast | GDC 2016 | Game Audio Factory - GAFSFX01 - Dark Materials | GAF SFX01 - HORROR - Hammer Impact, huge.wav | 1.4 s from its first sound |
| `dark.ogg` | A dark designed impact with a low tail: more weight under the blast | GDC 2016 | 3maze - High Impact | med_dark_001.wav | all of it |
| `swoosh.ogg` | A burst of fire rushing past: power running into a circle | GDC 2018 | Gregor Quendel - Designed Fire | Designed Fire - Swooshes - Burst, evolving 34.wav | 2.4 s from 2.2 s in |
| `stress.ogg` | Timber and iron under great strain, groaning: a building being pulled apart | GDC 2019 | Rock The Speakerbox - Broken | BROKEN - DESIGNED - MINE SHAFT Wood Metal Stress Very Long 06.wav | a 17 s loop from 1 s in |
| `grind.ogg` | Rock grinding on rock, without end: stone carried round | GDC 2018 | Gregor Quendel - Designed Rocks | Designed Rocks - EVO19 - Texture - Filtered 4.wav | a 19 s loop from 1.5 s in |
| `gusts.ogg` | Hard gusts of wind on a mountain top: the body of a whirlwind | GDC 2018 | Discover Oregon - Wind and Storms | Wind Gusts 2016 Lookout Snow - Biggest Gusts Long.wav | a 33 s loop from 118 s in |
| `whistle.ogg` | Wind whistling softly through a gap: the voice of a whirlwind | GDC 2020 | Coll Anderson - Gentle Wind | EFX SD Wind Soft Whistling Gusts 04.wav | a 33 s loop from 20 s in |
| `firetex.ogg` | Fire rumbling, a steady texture: a whirlwind that has taken fire | GDC 2018 | Gregor Quendel - Designed Fire | Designed Fire - Textures - Rumbling, glitch.wav | a 27 s loop from 2 s in |
| `firewind.ogg` | Fire rushing in waves: the same, nearer | GDC 2018 | Gregor Quendel - Designed Fire | Designed Fire - Winds - Binaural, swoosh, waves 02.wav | a 11 s loop from 1 s in |
| `rush.ogg` | A fast stream: a whirlwind over water | GDC 2018 | Discover Oregon - Ocean and Stream | Streams 2014 McKenzie 1.wav | a 20 s loop from 3 s in |
| `ice.ogg` | Broken ice falling: a whirlwind that has taken frost | GDC 2016 | 3maze -  ICE BLOCK | debris_ice_001.wav | all of it |
| `stove.ogg` | A fire crackling in a stove: fire near at hand | GDC 2020 | Coll Anderson - Gentle Wind | EFX SD Fire in Metal Stove 03.wav | a 33 s loop from 10 s in |
| `iceburn.ogg` | Ice hissing and ticking as it is burnt: cold pouring | GDC 2016 | 3maze -  ICE BLOCK | burn_ice_001.wav | a 4 s loop from 0.1 s in |
| `ice2.ogg` | A weight smashed down on ice, and what falls: ice breaking | GDC 2018 | FLYSOUND - Ice Fury | IC0318 KETTLEBELL SMASH DEBRIS 02.wav | all of it |
| `ice3.ogg` | Ice struck with a big chisel | GDC 2018 | FLYSOUND - Ice Fury | IC0151 BIG CHISEL HIT DEBRIS 06.wav | all of it |
| `ice4.ogg` | Ice struck with a crowbar | GDC 2018 | FLYSOUND - Ice Fury | IC0271 CROWBAR HIT DEBRIS 12.wav | all of it |
| `icescrape.ogg` | A chisel scraped along ice | GDC 2018 | FLYSOUND - Ice Fury | IC0120 CHISEL SCRAPE DEBRIS 09.wav | all of it |
| `leaves.ogg` | A pile of leaves gathered up: leaves torn loose, things sprouting | GDC 2018 | Soundrangers - Foley Elements Foliage | leaves_pile_pick_up_04.wav | all of it |
| `creaks.ogg` | A tree creaking gently: wood growing | GDC 2018 | Discover Oregon - Wind and Storms | Creaks and Snaps 2017.03.20 - Gentle Tree Creaks.WAV | a 33 s loop from 60 s in |
| `grassy.ogg` | A breeze in tall grass: the meadow coming back | GDC 2017 | Hzandbits - Wind In Trees | Wind,Ext,Breeze,Grass,Tall,Rustle,Buffeting.wav | a 33 s loop from 20 s in |
| `treetops.ogg` | Wind in tree tops, with birds | GDC 2018 | Alexander Kopeikin - Quad ambience of Crimea in summer | 28 lake, high wind in tree tops, birds, daytime - QUAD XY LR.wav | a 33 s loop from 60 s in |
| `birds.ogg` | A summer evening on a hill: birds, insects, quiet air | GDC 2018 | Alexander Kopeikin - Quad ambience of Crimea in summer | 09 vineyard evening ambience, hill, very quiet, birds, crickets, take 2, ortf offset 5 m, front - ORTF.wav | a 33 s loop from 40 s in |
| `grassstep1.ogg` to `grassstep8.ogg` | Single steps on grass | GDC 2017 | Tovusound - Edward - Foleyart Collection Add-On Extended Footsteps | 169_Foley_Footsteps_Grass_Sneaker_Walk_Fast_Run_Jog_Close.wav | 8 single steps cut out of it |
| `stonestep1.ogg` to `stonestep8.ogg` | Single steps on a hard road: paving | GDC 2017 | Tovusound - Edward - Foleyart Collection Add-On Extended Footsteps | 015_Foley_Footsteps_Asphalt_Boot_Walk_Fast_Run_Jog_Close.wav | 8 single steps cut out of it |
| `dirtstep1.ogg` to `dirtstep8.ogg` | Single steps on dirt and gravel: the path | GDC 2019 | PMSFX - STEPS Dirt & Gravel | PM_SDNG_Stereo_Walk_Seamless_Loop_1.wav | 8 single steps cut out of it |
| `snowstep1.ogg` to `snowstep8.ogg` | Single steps in snow: ground that has been frozen | GDC 2019 | Studio 23 - Ultimate Footstep Collection | S23_SFX_Footsteps_Snow_Singles_Sequence.wav | 8 single steps cut out of it |
| `ashstep1.ogg` to `ashstep8.ogg` | Single steps on dry leaves: ground that has been burnt | GDC 2018 | Sounds Visual - Footsteps on Leaves | FX3280 Walking Faster Leaves Foley Foosteps.wav | 8 single steps cut out of it |
| `landstep1.ogg` to `landstep3.ogg` | Landing on two feet after a jump | GDC 2017 | Tovusound - Edward - Foleyart Collection Add-On Extended Footsteps | 289_Foley_Footsteps_Rocks_Sneaker_Jump_Land_On_Two_Feet_Close.wav | 3 single steps cut out of it |
| `lake.ogg` | Small waves at the bank of a lake | GDC 2019 | BlueZone - Lake Wave Sound Effects | Bluezone_BC0252_lake_wave_ambience_04.wav | a 33 s loop from 8 s in |
| `wind.ogg` | Wind in swells over open ground | GDC 2020 | Coll Anderson - Gentle Wind | EFX SD Design Wind Swells 03.wav | a 33 s loop from 20 s in |
