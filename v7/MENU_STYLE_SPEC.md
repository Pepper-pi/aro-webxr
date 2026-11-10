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

- Builder: `frostMark(k)` using `FROST` paths and `STAIN` colors.
- Class: `.hx-frost` inside `.hx-mark`. Landscape size `32px`. Portrait default `40px`.
- Each path is `fill-rule="evenodd"` with a `0.55` leading stroke. The fish eye stays a hole.
- Glow: `drop-shadow(0 0 4px rgba(120,230,255,.55))`. Selected: `drop-shadow(0 0 6px rgba(140,246,255,.95))`.
- Fishing pane fish: `.sg-fish`, shown only while `#ringHome` has `.sg-show`, `108×72`.

| Slot | Key | Stops | Leading |
| --- | --- | --- | --- |
| Bag | `bag` | `#f6d48a`, `#d0893a`, `#7a3e16` | `#fff1c9` |
| Nook | `craft` | `#f3e0b0`, `#e07a4a`, `#3d8f6e` | `#fff6e4` |
| Fishing | `fish` | `#e7fdff`, `#3ec8ee`, `#145e8c` | `#e9fbff` |
| Spellbook | `skills` | `#f8e7a0`, `#3ecfc4`, `#1a6d78` | `#fff6d4` |
| Collection | `log` | `#e7d4ff`, `#9b6bff`, `#45d0e6` | `#f4e9ff` |
| Settings | `set` | `#d9fbff`, `#3ec6e8`, `#1a6a90` | `#eefcff` |
| Command | `cmd` | `#fff3c4`, `#f0c14a`, `#2ec8e0` | `#fff8dc` |

## Reuse

Copy the four `--sg-*` tokens, the hex clip, the inset lip, and `frostMark` onto another panel. Do not add a pink grid, a perspective floor, or an extruded shelf. Botty Shop is not connected here.
