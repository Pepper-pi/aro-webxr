// The circle a spell draws: one design, used wherever a spell writes itself (in the sky, on the ground, before the
// staff). From the rim inward: a broad ring and a fine one with the marks of a dial between them; a band of runes;
// a broken ring; a figure of so many corners with a star drawn through it and a roundel holding a rune at each
// corner; a rosette of arcs through the middle; a second, smaller band of runes; a small figure; and a bright heart.
// Its parts turn against one another. It is not there all at once: it is written, from the rim inward, each part
// drawn round by a bright point.
//
// Needs `uniform sampler2D tRunes` (the rune atlas, 8 by 4) declared before it. Works in a vertex shader too, so the
// size of a pixel is handed in (px, in the circle's own measure) and nothing here asks the card for it.
export const SIGIL = /* glsl */ `
float sgGlyph(float id, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  float g = mod(floor(id), 32.0);
  return texture2D(tRunes, (vec2(mod(g, 8.0), 3.0 - floor(g / 8.0)) + uv) / vec2(8.0, 4.0)).r;
}
// a stroke of half-width w, d away: never thinner than can be drawn, and fainter for it instead
float sgLine(float d, float w, float px) { float ww = max(w, px * 0.75); return (1.0 - smoothstep(ww - px * 0.75, ww + px * 0.75, d)) * min(1.0, w / ww); }
// c: -1 to 1 across the circle. sides: the corners of its figure. turn: how far its parts have turned. written: 0 to 1.
float sigil(vec2 c, float sides, float turn, float written, float px) {
  float r = length(c);
  if (r > 1.0 || written <= 0.0) return 0.0;
  float a = atan(c.y, c.x), seg = 6.2832 / sides, I = 0.0;
  // the rim, and the marks of a dial in it (every eighth one longer)
  I += sgLine(abs(r - 0.972), 0.02, px) + sgLine(abs(r - 0.9), 0.006, px);
  float ta = (a + turn * 0.3) / 6.2832 * 96.0;
  I += sgLine(abs(fract(ta) - 0.5) / 96.0 * 6.2832 * r, 0.004, px) * step(0.908, r) * step(r, 0.927 + 0.022 * step(mod(floor(ta), 8.0), 0.5));
  // a band of runes
  float k1 = (a + turn) / 6.2832 * 22.0;
  I += sgGlyph(floor(k1) * 5.0 + 3.0, vec2(fract(k1) * 1.16 - 0.08, (r - 0.757) / 0.13));
  I += sgLine(abs(r - 0.742), 0.006, px);
  // a broken ring
  I += sgLine(abs(r - 0.705), 0.005, px) * step(0.36, fract((a - turn * 0.6) / 6.2832 * 30.0));
  // the figure, turning the other way: al is the angle from the nearest corner, am from the middle of the nearest side
  float a2 = a - turn * 0.7, f = floor(a2 / seg + 0.5), al = a2 - f * seg, am = a2 + seg * 0.5; am -= floor(am / seg + 0.5) * seg;
  float dR = length(r * vec2(cos(al), sin(al)) - vec2(0.66, 0.0)), clear = smoothstep(0.088, 0.1, dR) * step(r, 0.672);
  I += sgLine(abs(r * cos(am) - 0.66 * cos(seg * 0.5)), 0.006, px) * clear;
  // the star through it (with three corners: the same figure again, turned between them), and the rosette
  float star = 9.0, rose = 9.0;
  for (int j = -1; j <= 1; j++) {
    float aj = al + float(j) * seg; vec2 p = r * vec2(cos(aj), sin(aj));
    if (sides > 3.5) star = min(star, abs(p.x - 0.66 * cos(seg)) + step(seg, abs(aj)) * 9.0);
    rose = min(rose, abs(length(p - vec2(0.33, 0.0)) - 0.33));
  }
  if (sides < 3.5) star = abs(r * cos(al) - 0.66 * cos(seg * 0.5));
  I += sgLine(star, 0.005, px) * clear * 0.9 + sgLine(rose, 0.004, px) * clear * step(0.37, r) * 0.55;
  // a roundel at each corner, with its rune
  vec2 q = r * vec2(cos(al), sin(al)) - vec2(0.66, 0.0);
  I += sgLine(abs(dR - 0.088), 0.006, px) + sgGlyph(f * 7.0 + 11.0, vec2(q.y, q.x) / 0.125 + 0.5) * step(dR, 0.08);
  // within: two rings, a smaller band of runes going the other way, a small figure, and the heart
  I += sgLine(abs(r - 0.36), 0.007, px) + sgLine(abs(r - 0.335), 0.004, px) + sgLine(abs(r - 0.225), 0.005, px);
  float k2 = (a - turn * 1.3) / 6.2832 * 12.0;
  I += sgGlyph(floor(k2) * 3.0 + 17.0, vec2(fract(k2) * 1.2 - 0.1, (r - 0.238) / 0.088));
  float a3 = a + turn * 1.1 + seg * 0.5; a3 -= floor(a3 / seg + 0.5) * seg;
  I += sgLine(abs(r * cos(a3) - 0.2 * cos(seg * 0.5)), 0.005, px) * step(r, 0.205);
  I += (1.0 - smoothstep(0.035, 0.05, r)) * 1.5 + sgLine(abs(r - 0.085), 0.004, px);
  // written: the rim first, then the runes and the figure, then what is within; each drawn round by a bright point
  float zone = r > 0.89 ? 0.0 : r > 0.69 ? 1.0 : r > 0.345 ? 2.0 : 3.0, pz = clamp(written * 4.6 - zone, 0.0, 1.0), af = fract(a / 6.2832 + 0.27 * zone + 0.5);
  return I * (step(af, pz) + (1.0 - step(1.0, pz)) * step(0.001, pz) * exp(-(af - pz) * (af - pz) * 1600.0) * 2.5);
}
`;
