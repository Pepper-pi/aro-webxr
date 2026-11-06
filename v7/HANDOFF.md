# v7 morning handoff

Pull request, unmerged: https://github.com/Pepper-pi/aro-webxr/pull/2

Live `/v7/` on main is unchanged. Nothing here was merged or deployed.

## What you can do

- Mage: press the center, drag to aim, hold. **Full fires once** casts at full charge and the lift does not cast again. An early release is one weaker cast. Switching view, class, Reset, or Back drops the charge and does not cast. The forearm mark says **Not tracked**.
- Views: **Tactical** is the default. **Low** is an optional closer-to-the-floor arena camera (same aim math). **First person** is unchanged. Details are below.
- Gunner: holding does not fire. The shot happens on release.
- Slash cuts the hexes you aimed. The first step into a trench says to tap again, including when the fight clock is still 0. The next step enters. Ember on that trench is a lava seam and burns while you stand in it. Reset and the 14 second life both clear it. A mob that walks into the cut is stopped by the same obstacle check the arena uses.
- Iceberg raises your wall at 90 HP. Ember aimed at that wall, on the glowing center, hits for 40 (weak point, 2×). Three of those remove it: cracked hexes and ice chunks. Frost and a shot at empty ground do not damage it. A lift after the cast does not hit again.
- Gel King bout is on the title. A full fight from 160 HP, without editing his health, can be won with Ember while stepping off red. One run of the test below did that in 7 casts.
- Raid: walk to the dome, **Enter the raid dome**, then tap the glass block. That punch starts the wave. **Back to the map** uses `endArena()` and returns to the map.

## Controls that stayed

Drag-to-aim, the 0.8 camera angle, disc charge, and the Gunner release rule were not retuned. `v7/regress.mjs` checks the angle is still 0.8 after these flows.

## Tests

From the repo, with the page already served at `http://127.0.0.1:8765/v7/` and Chrome available:

```
CHROME=/usr/local/bin/google-chrome node v7/regress.mjs
```

The file covers the list above: Ember on your own iceberg, Gel King from full health to clear, trench step at time 0 plus expiry, reset, mob block, and burn, raid enter / punch / back, Gunner hold versus release, Mage early / full / lift / view-switch. It also checks 320×568, 390×844, and 844×390 that the training buttons and the cast line do not cover the dummies or the player, and that the page does not scroll. Last run: all passed.

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

A map raid checked in `v7/regress.mjs` starts at angle 0.8 with the Low button showing and the map row hidden, switches to angle 1 and back, then returns to the map with the map row visible. Separate play of that raid (phone and landscape) punched the glass block, cut a trench with Shadow Slash, raised the iceberg, and broke it with the existing center hit (40, three times). That shatter is the same wall hit enemy shots already use. The raid wheel still has no ground aim, so you do not drag onto the wall the way the yard disc does.

What this is not: the paintings’ wide canyon and huge cliffs. The pits stay one hex. The rocks are simple peaks, not a sculpted range. A steeper angle than 1.0 pushed side targets off the screen, so it was not kept.

![Room raid, tactical](handoff/room_tac_phone_start.png)

![Room raid, Low](handoff/room_low_phone_start.png)

![Room raid after the cut and the shatter, Low](handoff/room_low_phone.png)

![Tactical](handoff/tac_before.png)

![Low](handoff/low_after.png)

## Not in this build

No tracked hand through the disc. No walking slime. No characters taken from the concept paintings. No new Gel King attacks. Root `index.html` and `v6/` are unchanged.
