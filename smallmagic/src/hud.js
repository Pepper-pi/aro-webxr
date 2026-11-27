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
  pound: [{ d: 'M0 9 V-1 M-6 3 H6 M-3.5 -3 H3.5' }],
  spin: [{ d: 'M-7 3 A8 8 0 1 1 6 4' }],
  rush: [{ d: 'M-8 6 L0 -8 L8 6 M-4 2 H4' }],
  block: [{ d: 'M-7 -6 H7 V7 H-7 Z' }],
  slice: [{ d: 'M-8 7 L8 -7' }],
  bolt: [{ d: 'M3 -9 L-5 1 H1 L-3 9 L6 -1 H1 Z' }],
  nade: [{ d: 'M0 -8 V-3 M-5 0 A5 5 0 1 0 5 0' }],
  catch: [{ d: 'M-8 6 H8 M0 6 V-2 M-4 -2 H4 M0 -2 V-8' }],
  summon: [{ d: 'M0 8 C-6 2 -6 -4 0 -8 C6 -4 6 2 0 8 Z' }],
  mend: [{ d: 'M0 -8 V8 M-8 0 H8' }],
  strike: [{ d: 'M-7 7 L7 -7 M4 -7 H7 V-4' }],
  siphon: [{ d: 'M-8 4 C-2 4 2 -4 8 -4 M8 -4 L4 -7 M8 -4 L4 -1' }],
  trap: [{ d: 'M-7 -7 H7 V7 H-7 Z M-7 -7 L7 7 M7 -7 L-7 7' }],
  guard: [{ d: 'M0 -8 C6 -4 7 2 0 8 C-7 2 -6 -4 0 -8 Z' }],
  deploy: [{ d: 'M-6 6 H6 V-2 H-6 Z M-3 -2 V-7 H3 V-2' }],
  pop: [{ d: 'M-6 4 H6 V-1 H-6 Z M0 -1 V-8' }],
  bash: [{ d: 'M0 8 V-2 M-7 2 H7 M-4 -4 H4' }],
  recall: [{ d: 'M6 0 H-6 M-6 0 L-1 -4 M-6 0 L-1 4' }],
};

const el = (tag, at, to) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); to?.appendChild(e); return e; };

/** Fills `box` with the spells. A Mage ring lays them on a circle and calls `onPick` when one is tapped. Gives back `select(i)`, `charge(v)`, and `cool(v)`. */
export function spellBar(box, spells, art = 'ui/', opt = {}) {
  if (!box) return { select() {}, charge() {}, cool() {} };
  const ring = opt === true || opt.ring === true;
  const onPick = typeof opt.onPick === 'function' ? opt.onPick : null;
  box.innerHTML = '';
  box.classList.toggle('ring', ring);
  const row = document.createElement('div'); row.className = 'row'; box.appendChild(row);
  const name = document.createElement('div'); name.className = 'name'; box.appendChild(name);
  const items = spells.map((s, i) => {
    const it = document.createElement('div');
    it.className = 'spell'; it.style.setProperty('--c', s.colour);
    if (ring) {
      const a = (i / spells.length) * TAU - Math.PI / 2;
      it.style.setProperty('--x', `${Math.cos(a).toFixed(4)} * var(--r)`);
      it.style.setProperty('--y', `${Math.sin(a).toFixed(4)} * var(--r)`);
      it.addEventListener('pointerup', (e) => { onPick?.(i); e.preventDefault(); e.stopPropagation(); });
    }
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
    const chg = document.createElement('b'); chg.className = 'chg'; it.appendChild(chg);
    const cd = document.createElement('b'); cd.className = 'cd'; it.appendChild(cd);
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
      told = v;
      items.forEach((it, i) => {
        const on = i === now;
        it.style.setProperty('--g', on ? v.toFixed(2) : '0');
        const label = it.querySelector('.chg');
        if (label) label.textContent = on && v > 0.04 ? String(Math.round(v * 100)) : '';
      });
    },
    cool(v) {
      v = Math.max(0, Math.min(1, v));
      items[now]?.style.setProperty('--cd', v.toFixed(2));
    },
    /** One cooldown, 0 to 1, for every slot. The dark sweep and the number both follow it. */
    paint(levels) {
      levels?.forEach((v, i) => {
        const n = Math.max(0, Math.min(1, v || 0));
        const it = items[i];
        if (!it) return;
        it.style.setProperty('--cd', n.toFixed(2));
        const label = it.querySelector('.cd');
        if (label) label.textContent = n > 0.08 ? n.toFixed(1) : '';
      });
    },
  };
}
