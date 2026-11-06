# v7 morning handoff

Pull request, unmerged: https://github.com/Pepper-pi/aro-webxr/pull/2

Live `/v7/` on main is unchanged. Nothing here was merged or deployed.

## What you can do

- Mage: press the center, drag to aim, hold. **Full fires once** casts at full charge and the lift does not cast again. An early release is one weaker cast. Switching view, class, Reset, or Back drops the charge and does not cast. The forearm mark says **Not tracked**.
- Views: **Tactical** is the default. **Low** is an optional closer-to-the-floor arena camera (same aim math). **First person** is unchanged. Details are below.
- Gunner: holding does not fire. The shot happens on release.
- Slash cuts the hexes you aimed. The first step into a trench says to tap again, including when the fight clock is still 0. The next step enters. Ember on that trench is a lava seam and burns while you stand in it. Reset and the 14 second life both clear it. A mob that walks into the cut is stopped by the same obstacle check the arena uses.
- Training yard, Mage disc: Iceberg raises your wall at 90 HP. Ember aimed at that wall, on the glowing center, hits for 40 (full-charge power 1.65, weak point 2×). Three of those remove it: cracked hexes and ice chunks. Frost and a shot at empty ground do not damage it. A lift after the cast does not hit again.
- Map raid, Ember on the spell wheel, Tactical and Low: hold the field about a quarter second and a ring labels **Ice wall**, **Enemy**, or **Ground**. Release on your own wall to hit it. A hold of about a second is 19 damage, 38 on the center. Three center holds shatter 90. A short tap on the wall is 12, or 24 on the center. Empty ground paints fire and does not hit the wall. A finger on a creature casts at that creature. Frost and Honey do not use this aim. A fast swipe still steps. A cancelled touch does not cast. The training disc is not drawn in the map raid, so it does not cover the wall. The spell wheel, dodge, Iceberg button, and swipes stay.
- Gel King bout is on the title. A full fight from 160 HP, without editing his health, can be won with Ember while stepping off red. One run of the test below did that in 7 casts.
- Raid: walk to the dome, **Enter the raid dome**, then tap the glass block. That punch starts the wave. **Back to the map** uses `endArena()` and returns to the map.

## Controls that stayed

Drag-to-aim, the 0.8 camera angle, disc charge, and the Gunner release rule were not retuned. `v7/regress.mjs` checks the angle is still 0.8 after these flows.

## Tests

From the repo, with the page already served at `http://127.0.0.1:8765/v7/` and Chrome available:

```
CHROME=/usr/local/bin/google-chrome node v7/regress.mjs
```

Two kinds of check live in that file. Do not treat them as the same thing.

- **Helper-level.** These call game functions. They do not move the pointer. Mage early / full / lift / view-switch and the Gunner hold versus release go through `releaseDisc`, `releaseMage`, and `trainUpdate`. The training iceberg (90 HP, weak 40, three-hit shatter, frost and empty ground) also calls `releaseMage`. The trench step, mob block, lava burn, expiry, and reset call `moveP`, `mobObstacle`, and `slashLine`. The Gel King fight calls `releaseMage` from 160 HP. None of these invoke `wallHit` directly, and none of them are a finger on the raid canvas.
- **UI-interaction.** These use real clicks and pointer events on the page. Raid enter, the glass punch, and Back are clicks. The map-raid wall test, `raidWallPointer`, enters from the map, punches, clicks Iceberg, and then uses `mouse` down / move / up. It does not call `wallHit` or `releaseMage`. For Tactical and Low, at 320×568, 390×844, and 844×390, it checks: a live enemy is on screen, empty ground leaves the wall at 90, a swipe steps and does not hit the wall, pointercancel does not hit, Frost on the wall does not damage it, the hold reports Ice wall, and Ember center holds of about a second deal 38 and shatter. It also checks 320×568, 390×844, and 844×390 that the training buttons and the cast line do not cover the dummies or the player, and that the page does not scroll.

Last run of the whole file, helper checks and the pointer cases together, passed.

## Pictures

Normal play, show-hold off, aim ring on dummy 2, trench in the row in front of the player:

![Phone](handoff/play_phone.png)

![Landscape](handoff/play_land.png)

An earlier phone frame of a pit (`hole_trench_phone`) looked empty of people. Measured on 390×844, the dummies sit around y 349–387 and the player around y 523, which is below the button stack (ends ~248) and above the old cast line. The canvas sample for the new frame has a warm pixel on the dummy and a pixel on the player, so those sprites are being drawn. This note does not pick a single cause for the empty read.

## Layout fixes in this pass

- 320×568: the button stack covered all three dummies. Short portrait screens hide the note and use tighter buttons.
- Landscape: the side panel was half the screen and covered the dummies. It is 210px wide.
- The cast line sat on the player on a tall phone. It now sits at the left, under the buttons, and in the corner on short screens.
- The page already sets `overflow: hidden` and `touch-action: none` on the canvas, so the field does not scroll.

## Low angle (optional), including the map raid

Tactical stays the default at camera angle 0.8.

- Yard and Gel King: the view row is **Tactical**, **Low**, **First person**.
- Map raid: a **Low** button at the top right (it says **Low on** while that camera is up). It is not on the map. Entering a raid starts on Tactical. **Back to the map** hides that button and brings the map buttons back. The map’s own Home / Dome / Pond / Command row is hidden during the fight so it does not sit on the floor, and it returns when you are on the map again.

Low uses the same `proj` / `unproj` as Tactical, at angle 1.0. Plate edges are thicker, seam glow is lower, and the back of a raid is two ranges of dark rock rising from the horizon with a thin cyan or purple edge. While Low is on, a few dim streaks drift in that sky. They do not wet hexes and they are not a weather spell. On a cozy setting those streaks are skipped. The rocks are drawn once into the floor cache, not every frame.

A map raid checked in `v7/regress.mjs` starts at angle 0.8 with the Low button showing and the map row hidden, switches to angle 1 and back, then returns to the map with the map row visible.

Room-raid Ember aim, both cameras: hold the canvas with Ember selected. After about a quarter second the ring labels the point under your finger. Release on the wall to damage it. A fast swipe still changes hex and does not cast. The pictures below are that raid after a normal map enter, with a live slime and the player, then the ring on the wall, then the shatter. They are not a `wallHit` fixture.

The raid floor is drawn opaque. The hot-pink underworld used to show through the gaps between plates (default neon is 0.3, so the floor was partly see-through). Near seams stay cyan and far seams stay purple, which is the reference's restrained edge color rather than a pink bar. The red edge during a fight is the existing danger vignette, not a seam.

What this is not: the paintings’ wide canyon and huge cliffs. The pits stay one hex. The rocks are simple peaks, not a sculpted range. A steeper angle than 1.0 pushed side targets off the screen, so it was not kept.

![Room raid, tactical](handoff/room_tac_phone_start.png)

![Room raid, Low](handoff/room_low_phone_start.png)

![Room raid after the cut and the shatter, Low](handoff/room_low_phone.png)

Ordinary map raid, before the wall. Player, fox, and a live slime:

![Raid before the wall](handoff/raid_play_before.png)

Hold on the wall. The ring says Ice wall:

![Raid aim ring](handoff/raid_aim_ring.png)

After the aimed Ember holds. Shattered, player and slime still there:

![Raid after shatter, tactical](handoff/raid_after_tac.png)

![Raid after shatter, Low](handoff/raid_after_low.png)

![Tactical](handoff/tac_before.png)

![Low](handoff/low_after.png)

## Not in this build

No tracked hand through the disc. No walking slime. No characters taken from the concept paintings. No new Gel King attacks. Root `index.html` and `v6/` are unchanged.
