// One pass over localStorage before the rest of the game reads it.
// A missing herb count is a new save. A broken JSON blob becomes an empty object
// instead of throwing when an older browser save is opened.
const CLASSES = ['mage', 'blade', 'gunner', 'summoner', 'puppet', 'warden', 'ranger', 'alchemist'];
const PETS = new Set(['bunny', 'fox', 'deer', 'crab', 'cow', 'wolf', 'fish', 'boar', 'slime', 'goblin']);

function raw(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}
function drop(key) {
  try { localStorage.removeItem(key); } catch { /* private mode */ }
}
function asObject(key) {
  const text = raw(key);
  if (text == null) return;
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) write(key, '{}');
  } catch {
    write(key, '{}');
  }
}

export function migrateSave() {
  const herbs = raw('aro-herbs');
  const count = herbs == null || herbs === '' ? 3 : Number(herbs);
  write('aro-herbs', String(Number.isFinite(count) && count >= 0 ? Math.floor(count) : 3));

  const cls = raw('aro-class');
  if (cls && !CLASSES.includes(cls)) drop('aro-class');

  const partyText = raw('aro-party');
  if (partyText != null) {
    try {
      const row = JSON.parse(partyText);
      const slots = (Array.isArray(row?.slots) ? row.slots : []).filter((s) => s && PETS.has(s.kind)).slice(0, 3);
      let active = Number.isInteger(row?.active) ? row.active : 0;
      if (active < 0 || active >= slots.length) active = 0;
      write('aro-party', JSON.stringify({ slots, active }));
    } catch {
      write('aro-party', JSON.stringify({ slots: [], active: 0 }));
    }
  }

  const pet = raw('aro-pet');
  if (pet != null) {
    try {
      const row = JSON.parse(pet);
      if (!row || typeof row !== 'object' || Array.isArray(row) || !row.id) drop('aro-pet');
    } catch { drop('aro-pet'); }
  }

  for (const key of ['aro-hex-xp', 'aro-hub', 'aro-bestiary', 'aro-living', 'aro-long-lake', 'aro-beast-drops', 'aro-rod', 'aro-mind', 'aro-wander']) asObject(key);
}

export function herbCount() {
  const n = Number(raw('aro-herbs'));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function setHerbs(n) {
  write('aro-herbs', String(Math.max(0, Math.floor(Number(n) || 0))));
}

export function savedClass() {
  const cls = raw('aro-class');
  return CLASSES.includes(cls) ? cls : 'mage';
}

export function rememberClass(name) {
  if (CLASSES.includes(name)) write('aro-class', name);
}
