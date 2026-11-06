# v7 morning handoff

Pull request, unmerged: https://github.com/Pepper-pi/aro-webxr/pull/2

Live `/v7/` on main is unchanged. Nothing here was merged or deployed.

## What you can do

- Mage: press the center, drag to aim, hold. **Full fires once** casts at full charge and the lift does not cast again. An early release is one weaker cast. Switching view, class, Reset, or Back drops the charge and does not cast. The forearm mark says **Not tracked**.
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

## Depth, and what a lower angle would take

The picture is one canvas projection. `proj` / `unproj` use `cam.A` of 0.8. World Y is the depth axis, and at this angle a thin cut along that axis becomes a short screen band. That is why a slash ribbon looked like two bars. The current pits avoid that by dropping each hex downward on the screen by about the hex’s own screen height, with side walls and a cyan floor. That is as deep as this angle can show without covering the next tile.

A closer match to the low, tilted concept view is a smaller `cam.A` (and a pass over `cy`) so a multi-hex canyon has tall inner walls in screen space. `unproj` is the inverse of that same angle, and every drag-to-aim, shot, and tap uses it. Changing `A` moves the world point under a finger. It is the same 2D math, not a camera plane and not WebXR. It is not a safe one-line change: aim, the disc, trench steps, and the three viewports above would have to be rechecked, and the floor skirts and pit drop would need to be retuned or they will intersect the buttons. That work is not done.

## Not in this build

No tracked hand through the disc. No walking slime. No characters taken from the concept paintings. No new Gel King attacks. Root `index.html` and `v6/` are unchanged.
