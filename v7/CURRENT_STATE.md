# Menu glass, current state

Nothing in this pass was merged, deployed, or published. `main` was not pushed. GitHub Pages was not published. The live site stays on `main`.

## Commits

- Look: `8ce439b86b8c804da191a5166016ffc4584c7f05`
- Parent: `2ff277a60d6c2dcd4ccd73c9c938b7178f263949` (`Put a flat pink hex floor behind the menu pane.`)
- Branch: `cursor/v7-mage-forearm-guide-6863` (open PR 2). This note is the commit after the look.

## What changed

The v7 menu pane is drawn as a glass slab instead of a flat CSS stroke. A WebGL pass paints a front face and a side wall in the existing hex silhouette. The large pink hex grid is a flat outline layer (no vanishing point and no filled shelf). It is not clipped to the hex: the same outlines continue behind the pane and in a quiet band around it, and the sample inside the glass is bent a little so the lines do not meet the outside lines one-to-one. A faint finer honeycomb is etched on the glass itself. Map rings still show farther out. Landscape layout numbers were not moved.

## Layout that still holds

- All seven landscape tabs, including Command.
- Cook Nook stays the line under Fishing, not a title.
- Landscape Settings heading reads SETTINGS / Core settings, unclipped, with Sound under it.
- Landscape Close is the existing control under the pane (about 30px tall on 844×390).
- Portrait Close is still at the top of the column. That was left alone.
- Floor-hex section buttons and stained-glass slots were not built.

## Honest leftovers

The slab is in the family of the locked still: a thick edge, a lip, and a flat pink outline floor behind and around the pane. It is not a photograph of that still. The edge is a neon purple glass band with a cyan lip, brighter and more regular than the reference. The fine etching on the face is screen-aligned and can still read as a pattern on the glass. The bend inside the pane is a mild lens (about 5.5% scale, plus a shift near the lip), not a heavy refraction. The old failure modes this pass was meant to leave behind — a flat outlined stroke, a grid clipped inside the hex as wallpaper, a receding tunnel, and an opaque pink shelf — are not what this build draws. Calling the look fully landed would oversell how close the neon band is to the reference glass.

## Tests

`CHROME=/usr/bin/google-chrome node v7/regress.mjs` on this commit's parent tree plus the look: 202 passed, 0 failed.

`v7/regress.mjs` does not contain an 88px assertion. The stylesheet still has `#title .race canvas{height:88px}` inside `@media (max-height:519px)`, and a later rule in that same breakpoint still sets those canvases to 60px. Neither rule was edited. A measurement of the short-landscape race card will still come out 60px because the later rule wins.

## Shots

Comparison stills for 844×390 and 390×844, Fishing and Settings, plus zooms of the landscape Settings heading, Close, and the glass edge, are in the agent artifacts next to this note. The locked material still is on the left of each beside image. Its oversized Cook Nook title and tiny Close are the still's layout mistakes and were not copied.
