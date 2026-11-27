# Menu style spec

Locked look for the main menu glass. Botty Shop can reuse these tokens later. This file does not wire Botty Shop.

## Tokens

Defined on `:root` in `v7/index.html`.

| Name | Value | Use |
| --- | --- | --- |
| `--sg-edge` | `#bff6ff` | Outer neon stroke |
| `--sg-violet` | `#c9b6ff` | Inner lip |
| `--sg-glow` | `rgba(120,236,255,.72)` | Edge bloom |
| `--sg-glass` | `rgba(8,16,36,.32)` | Clear glass tint |
| `--cyan` | `#7ff0ff` | Existing accent |
| `--pink` | `#ff4fb4` | Toggle on-state only |

## Pane

- Class shell: `#ring`, backing `#ringBack`, tint `#ringGrid`.
- `#ringGrid` is a flat fill of `--sg-glass`, clipped to the hex. No hex-grid image.
- Outer stroke `#bff6ff`, width `1.6`. Inner lip `rgba(201,182,255,.7)`, width `1`.
- Bloom: `drop-shadow(0 0 6px rgba(120,236,255,.8))` and `drop-shadow(0 0 3px rgba(190,160,255,.65))`.
- Content sheet and `#ringHome`, while the menu is open: background `rgba(8,16,36,.22)`, inset `1px` of `--sg-edge`, inset `4px` of `rgba(201,182,255,.28)`, outer `0 0 14px var(--sg-glow)`.
- Landscape content clip: `polygon(8% 0,92% 0,100% 50%,92% 100%,8% 100%,0 50%)`.
- Portrait `.tight` clip: `polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)`.

## Tabs

- Class: `#ring .hx`. Chamfer: `polygon(22px 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 22px 100%, 0 50%)`.
- Landscape `.land-fit` chamfer uses `16px` and the tab is `36px` tall. Portrait default is `56px` tall.
- Fills stay `rgba(122,223,240,.18)`, `rgba(187,166,244,.16)`, and `rgba(150,196,255,.16)`.
- Selected tab (`.hx.sel`) adds a white inner line, a cyan band, and `0 0 16px rgba(120,236,255,.8)`.
- Landscape Close (`#ringX`) is `40px` tall, `16px` type, edge `--sg-edge`.

## Icons

- Builder: `stainedSvg(k, className)` and `frostMark(k)`.
- Each icon is clipped to its `FROST` silhouette (`clip-rule: evenodd`, so the fish eye and the gear hole stay open).
- `FACETS` draws several polygons. `LEADS` draws `#14081c` lines at `0.7` between those facets. The silhouette stroke is `#f4fbff` at `0.75`.
- A blurred cyan copy of the silhouette sits behind the facets. A small white ellipse is the specular highlight.
- Landscape `.land-fit .hx-frost` is `44px` inside a `44px` tab. Portrait `.tight .hx-frost` is `44px` inside a `56px` tab.
- Fishing pane fish: `#ringFish` inside `.sg-fish`, `120px`, shown only while `#ringHome` has `.sg-show`. Landscape `#ringHome` ends `56px` above the stage bottom so the Cook Nook line stays above `#ringX`.
- While the menu is open, `.sheet .x` is hidden. The one close control is `#ringX`.

| Slot | Key | Facet colors |
| --- | --- | --- |
| Bag | `bag` | `#c47a32`, `#8a4e22`, `#f6d48a`, `#fff1c9` |
| Nook | `craft` | `#e07a4a`, `#f3e0b0`, `#3d8f6e`, `#2a6b54`, `#f6d48a` |
| Fishing | `fish` | `#145e8c`, `#7ee7ff`, `#1a8fb8`, `#e7fdff` |
| Spellbook | `skills` | `#f8e7a0`, `#3ecfc4`, `#9b6bff` |
| Collection | `log` | `#e7d4ff`, `#9b6bff`, `#45d0e6`, `#c084fc` |
| Settings | `set` | `#7ee7ff`, `#1a8fb8`, `#9b6bff`, `#f0c14a`, `#3ecfc4`, `#e7fdff` |
| Command | `cmd` | `#fff3c4`, `#f0c14a`, `#2ec8e0`, `#7ee7ff` |

## Reuse

Copy the four `--sg-*` tokens, the hex clip, the inset lip, and `frostMark` onto another panel. Do not add a pink grid, a perspective floor, or an extruded shelf. Botty Shop is not connected here.
