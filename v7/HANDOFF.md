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

## Low angle (optional)

In the yard and the Gel King bout, the view row is **Tactical**, **Low**, **First person**. Tactical is still the default and still uses camera angle 0.8. **Low** is a second arena camera on the same `proj` / `unproj`: angle 1.0, the floor pulled a little closer to the horizon, plate edges drawn thicker, seam glow turned down, and a dim band plus a few drifting streaks at the back. Those streaks are drawn only. They are not rain gameplay and they do not wet the hexes.

Switching Low cancels a charge in progress, the same way First person does. Reset keeps the view you picked. Back, and a new yard or king entrance, return to Tactical. The map raid does not grow a new button; it stays on the default camera. Map navigation is unchanged.

`v7/regress.mjs` checks that a point aimed in Low unprojects back to itself, that Ember still hits the dummy under the ring, that the dummies stay off the buttons and the disc at 320×568, 390×844, and landscape, and that Tactical’s angle returns to 0.8.

What Low does not do: it is not the low heroic painting. The pits are still one hex, the back rocks are still small, and there is no wide canyon. Pushing the angle further made the side dummies leave the screen in the trials above, so this is the setting that stayed playable.

![Tactical](handoff/tac_before.png)

![Low](handoff/low_after.png)

## Not in this build

No tracked hand through the disc. No walking slime. No characters taken from the concept paintings. No new Gel King attacks. Root `index.html` and `v6/` are unchanged.
