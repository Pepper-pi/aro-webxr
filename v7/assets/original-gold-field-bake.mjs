// How the page turns Original_Gold_Likeness.glb into three field pictures.
// The page imports this file. It does not key against magenta.
//
// Readback is the WebGL drawing buffer: premultiplied alpha, bottom row first.
// Coverage comes from that alpha. Color is divided back out so an edge stays
// the mesh color instead of a blend with the clear color. The clear is
// transparent. The source file has no magenta material.

export const FIELD_BAKE = {
  sourceFile: 'Original_Gold_Likeness.glb',
  sourceSha256: '54b1f5c7bef848ab2ae364655296214e693e8f3aa196728d071a26413b5fd5aa',
  pixels: [480, 800],
  views: { front: 0, q: 0.7, back: Math.PI },
  viewNames: { front: 'front', q: 'quarter', back: 'back' },
  pitch: 0.08,
  alpha: 'premultiplied WebGL readback converted to straight alpha',
  clear: [0, 0, 0, 0],
  cropPad: 2,
  cropAlpha: 8
};

export function goldStraightAlpha(px, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w;
    for (let x = 0; x < w; x++) {
      const s = (srcRow + x) * 4;
      const d = (y * w + x) * 4;
      const a = px[s + 3];
      if (!a) continue;
      const scale = a === 255 ? 1 : 255 / a;
      out[d] = Math.min(255, Math.round(px[s] * scale));
      out[d + 1] = Math.min(255, Math.round(px[s + 1] * scale));
      out[d + 2] = Math.min(255, Math.round(px[s + 2] * scale));
      out[d + 3] = a;
    }
  }
  return out;
}

export function goldAlphaBounds(buf, w, h, pad = FIELD_BAKE.cropPad, minA = FIELD_BAKE.cropAlpha) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (buf[(y * w + x) * 4 + 3] < minA) continue;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (x1 < x0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export function goldReadbackHasAlpha(px, w, h) {
  const ids = [0, w - 1, (h - 1) * w, h * w - 1];
  return ids.every(i => px[i * 4 + 3] < 8);
}

function selfTest() {
  const w = 3, h = 3;
  const px = new Uint8Array(w * h * 4);
  // bottom-up: row 0 is the bottom. Put a solid pixel and a half-covered edge inside.
  const put = (x, y, r, g, b, a) => { const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
  put(1, 1, 255, 200, 40, 255);
  put(1, 0, 128, 100, 20, 128);
  const straight = goldStraightAlpha(px, w, h);
  const solid = straight.slice((1 * w + 1) * 4, (1 * w + 1) * 4 + 4);
  if ([...solid].join() !== '255,200,40,255') throw new Error('solid pixel ' + solid);
  const edge = straight.slice((2 * w + 1) * 4, (2 * w + 1) * 4 + 4);
  if (edge[0] < 250 || edge[1] < 190 || edge[2] > 50 || edge[3] !== 128) throw new Error('edge ' + edge);
  if (edge[0] > 250 && edge[2] > 120 && edge[1] < 140) throw new Error('edge went pink ' + edge);
  if (!goldReadbackHasAlpha(px, w, h)) throw new Error('alpha check');
  const bounds = goldAlphaBounds(straight, w, h, 0, 8);
  if (!bounds || bounds.width < 1 || bounds.height < 2) throw new Error('bounds ' + JSON.stringify(bounds));
  console.log('original-gold-field-bake self-test passed');
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('original-gold-field-bake.mjs')) selfTest();
