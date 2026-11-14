// What is drawn over the picture while they play: the seven spells, as a row of medallions at the top left.
// Each is a painted medallion (public/ui/1.webp to 7.webp, made with an image model in the style of the cover).
// The one in hand is larger and lit, its rim fills as the spell is gathered, and its name is written under the row.
// Under each picture is a plain medallion drawn here, a dark disc with a gold rim and the spell's emblem in line
// work: it is what is seen if a picture is missing.
const NS = 'http://www.w3.org/2000/svg';
const P = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
const TAU = Math.PI * 2;

// The emblems, in a square of 24 with its middle at 0, 0. Each is a list of paths; `fill` ones are filled in.
const EMBLEMS = {
  // a flame, and the heart of it
  fire: [
    { d: 'M0.4 -9.6 C4.6 -5.8 7.4 -2.6 7.4 2 A7.4 7.4 0 0 1 -7.4 2 C-7.4 -0.6 -6 -2.6 -4.4 -4.4 C-3.6 -2.6 -2.6 -1.6 -1.6 -1.2 C-0.2 -3.6 0.8 -6.4 0.4 -9.6 Z' },
    { d: 'M0.3 9.2 C-2.4 9.2 -3.6 7 -2.8 4.8 C-2.2 3.2 -0.6 2.4 0 0.4 C1.8 2.2 3.4 4 3.2 6.2 C3 8 1.8 9.2 0.3 9.2 Z', fill: true },
  ],
  // a snow crystal: six arms, each forked
  frost: [{ d: Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * TAU - Math.PI / 2; return `M0 0L${P(9.6, a)}M${P(5.6, a)}L${P(8.4, a - 0.36)}M${P(5.6, a)}L${P(8.4, a + 0.36)}M${P(2.8, a)}L${P(4.6, a - 0.5)}M${P(2.8, a)}L${P(4.6, a + 0.5)}`; }).join('') }],
  // three lines of moving air, two of them curling over
  wind: [{ d: 'M-9.4 -3.4 H2.6 A3.1 3.1 0 1 0 -0.5 -6.5 M-9.4 1 H6.2 A3.3 3.3 0 1 1 2.9 4.3 M-9.4 5.4 H-1.6' }],
  // a shoot with two leaves
  growth: [
    { d: 'M0 9.6 C0 5 0 2 0.4 -1.4' },
    { d: 'M0.2 3.4 C-5.4 3.6 -8.6 0.4 -8.8 -4.6 C-3.8 -4.8 -0.2 -1.6 0.2 3.4 Z' },
    { d: 'M0.4 -1.2 C0.4 -6.2 3.6 -9.4 8.8 -9.6 C8.8 -4.4 5.6 -1.2 0.4 -1.2 Z' },
  ],
  // a burst: eight rays, long and short by turns, round a bright middle
  explosion: [
    { d: Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * TAU - Math.PI / 2; return `M${P(4.4, a)}L${P(k % 2 ? 7.4 : 10, a)}`; }).join('') },
    { d: 'M0 -2.4 A2.4 2.4 0 1 1 0 2.4 A2.4 2.4 0 1 1 0 -2.4 Z', fill: true },
  ],
  // a dark ball with a ring of light round it, tipped
  singularity: [
    { d: 'M-9.8 2.2 C-8.6 -1.6 -3.2 -4.6 2.6 -5.2 C7.4 -5.6 10.2 -4 9.8 -2.2', thin: true },
    { d: 'M0 -4.6 A4.6 4.6 0 1 1 0 4.6 A4.6 4.6 0 1 1 0 -4.6 Z', dark: true },
    { d: 'M9.8 -2.2 C8.6 1.6 3.2 4.6 -2.6 5.2 C-7.4 5.6 -10.2 4 -9.8 2.2' },
  ],
  // a funnel: bands of it, narrowing and leaning as they go down
  tornado: [{ d: 'M-9 -8 Q0 -5.4 9 -8 M-7 -4.2 Q0.4 -1.8 7.4 -4.4 M-4.6 -0.4 Q0.8 1.6 5.6 -0.6 M-2.4 3.4 Q1 5 4 3.2 M-0.4 7 Q1.2 8.2 2.6 7' }],
};

const el = (tag, at, to) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); to?.appendChild(e); return e; };

/** Fills `box` with the spells. Gives back `select(i)` and `charge(v)` (how far the spell in hand is gathered, 0 to 1). */
export function spellBar(box, spells, art = 'ui/') {
  if (!box) return { select() {}, charge() {} };
  box.innerHTML = '';
  const row = document.createElement('div'); row.className = 'row'; box.appendChild(row);
  const name = document.createElement('div'); name.className = 'name'; box.appendChild(name);
  const items = spells.map((s, i) => {
    const it = document.createElement('div');
    it.className = 'spell'; it.style.setProperty('--c', s.colour);
    const svg = el('svg', { viewBox: '-20 -20 40 40' }, null);
    el('circle', { r: 18.6, class: 'disc' }, svg);
    el('circle', { r: 18.6, class: 'rim' }, svg);
    el('circle', { r: 15.8, class: 'rim in' }, svg);
    // (a mark on the rim for each side of the spell's own circle, as it is drawn in the meadow)
    for (let k = 0; k < s.sides; k++) { const a = (k / s.sides) * TAU - Math.PI / 2; el('path', { d: `M${P(15.8, a)}L${P(18.6, a)}`, class: 'tick' }, svg); }
    el('circle', { r: 18.6, class: 'gathered', pathLength: 1, transform: 'rotate(-90)' }, svg);
    const g = el('g', { class: 'emblem', transform: 'scale(1.02)' }, svg);
    for (const p of EMBLEMS[s.key] ?? []) el('path', { d: p.d, class: p.fill ? 'full' : p.dark ? 'dark' : p.thin ? 'thin' : '' }, g);
    it.appendChild(svg);
    // The painted medallion, over what is drawn here. If its picture is not there, the drawn one stands in for it.
    // The painted medallions are not in this copy. The drawn emblem stands in for them.
    const key = document.createElement('i'); key.textContent = i + 1; it.appendChild(key);
    row.appendChild(it);
    return it;
  });
  let now = -1, told = 0;
  return {
    select(i) {
      if (i === now) return;
      if (items[now]) { items[now].classList.remove('on'); items[now].style.removeProperty('--g'); }
      now = i; told = 0;
      items[i]?.classList.add('on');
      name.textContent = spells[i]?.name ?? ''; name.style.setProperty('--c', spells[i]?.colour ?? '#fff');
      // (the name is written afresh each time, so that it is seen to change)
      name.classList.remove('in'); void name.offsetWidth; name.classList.add('in');
    },
    charge(v) {
      v = Math.max(0, Math.min(1, v));
      if (Math.abs(v - told) < 0.01 && !(v === 0 && told !== 0)) return;
      told = v; items[now]?.style.setProperty('--g', v.toFixed(2));
    },
  };
}
