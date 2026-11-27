// What the four companions remember. Notes stay in the browser. Lines are
// templates crossed with those notes, so the same sentence does not return.
// `talk` is the hook a cloud model can replace later. It does not call out.
const KEY = 'aro-mind';

const PEOPLE = ['maren', 'sable', 'bram', 'lumen'];
const WANTS = {
  maren: ['a quiet cup before the hex', 'herbs if the path is kind', 'someone to sit the long side of the fire'],
  sable: ['a clean cast at Long Lake', 'news of the evening fish', 'a walk that does not hurry'],
  bram: ['one finished pin on the board', 'a short spar with no audience', 'the hex to stay where he left it'],
  lumen: ['a found thing, not a bought one', 'a margin note read aloud', 'the disc held steady once'],
};
const MOOD = {
  maren: { clear: 'settled', rain: 'cozy', fog: 'hushed', wind: 'busy' },
  sable: { clear: 'dry', rain: 'pleased', fog: 'patient', wind: 'wary' },
  bram: { clear: 'plain', rain: 'steady', fog: 'watchful', wind: 'blunt' },
  lumen: { clear: 'bright', rain: 'soft', fog: 'curious', wind: 'restless' },
};
const OPEN = [
  (n, m) => `${n} looks ${m}.`,
  (n, m) => `${n} is ${m} today.`,
  (n, m) => `${n}, still ${m}, notices you.`,
];
const WEATHER = {
  clear: 'The day outside the window is open.',
  rain: 'Rain is on the glass.',
  fog: 'Fog sits against the window.',
  wind: 'The wind worries the latch.',
};
const CLOSE = [
  (w) => `What they want: ${w}.`,
  (w) => `If you stay, it would be for ${w}.`,
  (w) => `They keep coming back to ${w}.`,
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function blank(id) {
  return { notes: [], last: '', gifts: 0, hangs: 0, mood: 'calm', want: '', wantDay: '', lastLine: '' };
}

export function createMind() {
  const data = load();
  data.people = data.people || {};
  for (const id of PEOPLE) data.people[id] = { ...blank(id), ...data.people[id] };

  function row(id) {
    return data.people[id] || (data.people[id] = blank(id));
  }
  function persist() { save(data); }

  function remember(id, fact) {
    const r = row(id);
    if (!fact) return r;
    r.notes.push(fact);
    if (r.notes.length > 8) r.notes.shift();
    r.last = dayKey();
    if (/gift/i.test(fact)) r.gifts += 1;
    if (/tea|spar|stroll|sit/i.test(fact)) r.hangs += 1;
    persist();
    return r;
  }

  function meet(id, ctx = {}) {
    const r = row(id);
    const sky = ctx.weather || 'clear';
    r.mood = (MOOD[id] && MOOD[id][sky]) || r.mood || 'calm';
    const day = dayKey();
    if (r.wantDay !== day) {
      const bag = WANTS[id] || WANTS.maren;
      r.want = bag[hash(day + id) % bag.length];
      r.wantDay = day;
    }
    r.last = day;
    persist();
    return r;
  }

  function greet(id, ctx = {}) {
    const name = ctx.name || id;
    const r = meet(id, ctx);
    const memory = r.notes.length
      ? r.notes[r.notes.length - 1]
      : r.gifts
        ? `They still have the gift. That was ${r.gifts} now.`
        : 'Nothing is written down between you yet.';
    const weather = WEATHER[ctx.weather] || WEATHER.clear;
    const last = r.last && r.last !== dayKey() ? `Last time was ${r.last}.` : 'You are here today.';
    let line = '';
    let guard = 0;
    do {
      const n = hash(`${id}|${r.notes.length}|${r.want}|${ctx.weather}|${guard}`);
      const open = OPEN[n % OPEN.length](name, r.mood);
      const close = CLOSE[(n >>> 3) % CLOSE.length](r.want);
      line = `${open} ${memory} ${last} ${weather} ${close}`;
      guard += 1;
    } while (line === r.lastLine && guard < 6);
    r.lastLine = line;
    persist();
    return { id, name, mood: r.mood, want: r.want, line, notes: r.notes.slice() };
  }

  // A cloud model can replace `reply` later. Until then it stays quiet.
  const talker = {
    async reply(_id, _playerLine, _memory) {
      return null;
    },
  };

  return {
    remember, meet, greet,
    notes(id) { return row(id).notes.slice(); },
    mood(id) { return row(id).mood; },
    want(id) { return row(id).want; },
    /** Stop to talk. Uses the template line unless a model has been attached. */
    async talk(id, playerLine, ctx = {}) {
      const greeted = greet(id, ctx);
      const live = await talker.reply(id, playerLine, greeted);
      return live || greeted.line;
    },
    attach(fn) { talker.reply = fn; },
    people: () => JSON.parse(JSON.stringify(data.people)),
  };
}
