// Living world. Tables in src/tables, a seeded roll, and a bestiary that grows.
// The player book is JSON in localStorage (`aro-bestiary`). The shape is bestiary.schema.json.
import rarity from './tables/rarity.json';
import species from './tables/species.json';
import vendors from './tables/vendors.json';
import quests from './tables/quests.json';
import network from './tables/network.json';

const BOOK = 'aro-bestiary';
const MEM = 'aro-living';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function write(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* private mode */ }
}
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function seasonOf(date = new Date()) {
  const m = date.getMonth();
  if (m < 2 || m === 11) return 'winter';
  if (m < 5) return 'spring';
  if (m < 8) return 'summer';
  return 'autumn';
}
function timeOf(dusk) {
  const h = new Date().getHours();
  if (h >= 21 || h < 5) return 'night';
  if (dusk || h >= 17) return 'dusk';
  return 'day';
}

const FIND_ID = { deer: 'spirit-deer', fox: 'spirit-fox', chest: 'warm-chest', herb: 'moonherb', friend: 'cloaked-traveler', shade: 'fox' };

export function createLiving({ zones } = {}) {
  let weather = '';
  let hear = null;

  function store() {
    const data = read(MEM);
    data.memory = Array.isArray(data.memory) ? data.memory : [];
    data.net = data.net || {};
    for (const [id, specialty] of Object.entries(network.starts)) {
      if (!data.net[id]) data.net[id] = { specialty, lean: 1, seen: 0 };
    }
    return data;
  }
  function book() {
    const data = read(BOOK);
    data.version = 1;
    data.seen = data.seen || {};
    return data;
  }
  function weatherNow() {
    if (weather) return weather;
    const names = ['clear', 'rain', 'fog', 'wind'];
    const rng = mulberry32(hash(`${dayKey()}|sky`));
    return names[Math.floor(rng() * names.length)];
  }
  function context(hex = 'meadow') {
    return {
      hex,
      time: timeOf(!!zones?.dusk),
      weather: weatherNow(),
      season: seasonOf(),
    };
  }
  function weights(ctx) {
    const score = { ...rarity.base };
    const add = (table) => {
      if (!table) return;
      for (const [tier, n] of Object.entries(table)) score[tier] = (score[tier] || 0) + n;
    };
    add(rarity.hex[ctx.hex]);
    add(rarity.time[ctx.time]);
    add(rarity.weather[ctx.weather]);
    add(rarity.season[ctx.season]);
    return score;
  }
  function rollTier(ctx, rng) {
    const score = weights(ctx);
    let sum = 0;
    for (const tier of rarity.tiers) sum += Math.max(0, score[tier] || 0);
    let pickAt = rng() * sum;
    for (const tier of rarity.tiers) {
      pickAt -= Math.max(0, score[tier] || 0);
      if (pickAt <= 0) return tier;
    }
    return 'common';
  }
  function roll(kind, ctx = context()) {
    const rng = mulberry32(hash(`${dayKey()}|${kind}|${ctx.hex}|${ctx.weather}|${Math.floor(performance.now() / 1000)}`));
    const pool = Object.entries(species).filter(([, row]) => row.kind === kind || (kind === 'find' && (row.kind === 'find' || row.kind === 'critter')));
    const tier = rollTier(ctx, rng);
    const inTier = pool.filter(([, row]) => row.tier === tier);
    const [id, row] = (inTier.length ? inTier : pool)[Math.floor(rng() * (inTier.length || pool.length))] || ['fox', species.fox];
    const shimmer = rarity.shimmer.includes(row.tier) || rarity.shimmer.includes(tier);
    return { id, tier: row.tier || tier, species: row, shimmer, ctx };
  }
  function sight(id, extra = {}) {
    const row = species[id] || species[FIND_ID[id]];
    const key = row ? (species[id] ? id : FIND_ID[id]) : id;
    const spec = species[key];
    if (!spec) return null;
    const data = book();
    const prev = data.seen[key];
    const ctx = extra.ctx || context(extra.hex || extra.where || 'meadow');
    const entry = prev || {
      id: key,
      name: spec.name,
      kind: spec.kind,
      tier: spec.tier,
      seen: 0,
      first: dayKey(),
      where: [],
      drops: [],
      rareDrops: [],
      best: null,
      vanity: null,
      pet: null,
      known: { drop: false, rare: false, best: false, vanity: false, pet: false },
      notes: [],
    };
    entry.seen += 1;
    const place = extra.where || extra.hex;
    if (place && !entry.where.includes(place)) entry.where.push(place);
    if (entry.seen === 1) entry.notes.push(`First seen in ${ctx.weather}, at ${ctx.time}, ${ctx.season}.`);
    const matched = spec.best.time === ctx.time || spec.best.weather === ctx.weather || spec.best.season === ctx.season;
    if ((entry.seen >= 2 || matched) && !entry.known.best) {
      entry.known.best = true;
      entry.best = { ...spec.best };
      entry.notes.push(`Keeps to ${spec.best.time}, ${spec.best.weather}, ${spec.best.season}.`);
    }
    if ((extra.drop || entry.seen >= 3) && !entry.known.drop) {
      entry.known.drop = true;
      entry.drops = [...spec.drops];
      entry.notes.push(`Drops ${spec.drops.join(', ')}.`);
    }
    if (extra.rare && !entry.known.rare) {
      entry.known.rare = true;
      entry.rareDrops = [...spec.rareDrops];
      entry.notes.push(`Rare drop ${spec.rareDrops.join(', ')}.`);
    }
    if (entry.seen >= 4 && !entry.known.vanity && spec.vanity) {
      entry.known.vanity = true;
      entry.vanity = spec.vanity;
      entry.notes.push(`Vanity: ${spec.vanity}.`);
    }
    if ((entry.seen >= 6 || spec.tier === 'mythic') && !entry.known.pet && spec.pet) {
      entry.known.pet = true;
      entry.pet = spec.pet;
      entry.notes.push(`A small companion answers to ${spec.pet}.`);
    }
    data.seen[key] = entry;
    write(BOOK, data);
    if ((extra.shimmer || rarity.shimmer.includes(spec.tier)) && entry.seen === 1) hear?.();
    const mem = store();
    const specName = network.starts[extra.who] || spec.kind;
    if (extra.who && mem.net[extra.who]) {
      mem.net[extra.who].seen += 1;
      if (mem.net[extra.who].seen % 3 === 0) mem.net[extra.who].lean += 1;
      write(MEM, mem);
    }
    void specName;
    return entry;
  }
  function namedVendor(type, rng) {
    const first = pick(rng, vendors.names.first);
    let last = pick(rng, vendors.names.last);
    if (last === first) last = vendors.names.last[(vendors.names.last.indexOf(last) + 3) % vendors.names.last.length];
    const outfit = pick(rng, vendors.outfits);
    const pool = vendors.types[type];
    const stock = pool.stock.slice(0, 3);
    const got = pick(rng, pool.got);
    return {
      type,
      label: pool.label,
      name: `${first} ${last}`,
      outfit,
      stock,
      got,
      line: `${first} ${last}, ${pool.label.toLowerCase()}, in ${outfit}. Got in today: ${got}.`,
    };
  }
  function stalls() {
    const data = store();
    const stamp = `${dayKey()}|${weatherNow()}`;
    if (data.stalls?.stamp === stamp) return data.stalls.list;
    const rng = mulberry32(hash(`${stamp}|vendors`));
    const types = Object.keys(vendors.types);
    const list = [];
    const used = new Set();
    while (list.length < 3) {
      const type = pick(rng, types);
      if (used.has(type)) continue;
      used.add(type);
      list.push(namedVendor(type, rng));
    }
    if (rng() < vendors.black.chance) {
      const outfit = 'hooded coat, dark gloves, no sign';
      list.push({
        type: 'black',
        label: vendors.black.label,
        name: `${pick(rng, vendors.names.first)} ${pick(rng, vendors.names.last)}`,
        outfit,
        stock: vendors.black.stock.slice(0, 3),
        got: pick(rng, vendors.black.stock),
        rare: true,
        line: `No sign on the stall. ${outfit}. Odd goods: ${vendors.black.stock.slice(0, 3).join(', ')}.`,
      });
    }
    data.stalls = { stamp, list };
    write(MEM, data);
    return list;
  }
  function issueQuest() {
    const data = store();
    const sky = weatherNow();
    const stamp = `${dayKey()}|${sky}`;
    const now = Date.now();
    data.memory = (data.memory || []).filter((row) => now - row.at < WEEK);
    if (data.quest?.stamp === stamp && !data.memory.some((row) => row.key === data.quest.key && row.at < now - 1000)) return data.quest;
    const rng = mulberry32(hash(`${stamp}|quest`));
    const givers = Object.entries(quests.givers);
    const needs = quests.needs.filter((need) => need.weather.includes(sky));
    const bag = [];
    for (const [id, giver] of givers) {
      const manners = quests.mannerisms[giver.personality];
      for (const manner of manners) {
        for (const need of needs.length ? needs : quests.needs) {
          bag.push({ id, giver, manner, need });
        }
      }
    }
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const time = timeOf(!!zones?.dusk);
    const choice = bag.find((row) => {
      const key = `${row.id}|${row.manner}|${row.need.id}|${sky}`;
      return !data.memory.some((mem) => mem.key === key);
    }) || bag[0];
    const key = `${choice.id}|${choice.manner}|${choice.need.id}|${sky}`;
    const weatherLine = pick(rng, quests.weatherLines[sky] || quests.weatherLines.clear);
    const closing = pick(rng, quests.closings[choice.giver.personality]);
    const timeLine = quests.timeLines[time];
    const quest = {
      stamp,
      key,
      giver: choice.id,
      name: choice.giver.name,
      personality: choice.giver.personality,
      item: choice.need.item,
      specialty: choice.need.specialty,
      weather: sky,
      line: `${choice.giver.name} ${choice.manner}. ${weatherLine} ${choice.need.ask} ${timeLine} ${closing}`,
    };
    data.memory.push({ key, at: now });
    data.quest = quest;
    const net = data.net[choice.id];
    if (net) {
      if (net.specialty !== choice.giver.specialty && net.lean < 4) {
        net.specialty = choice.giver.specialty;
      }
      net.lean += 1;
    }
    write(MEM, data);
    return quest;
  }
  function help(item) {
    const data = store();
    let best = null;
    for (const [id, row] of Object.entries(data.net)) {
      const spec = network.specialties[row.specialty];
      if (!spec || !spec.helps.includes(item)) continue;
      if (!best || row.lean > best.lean) best = { id, ...row, spec };
    }
    if (!best || best.lean < 2) return null;
    const giver = quests.givers[best.id];
    return {
      id: best.id,
      name: giver?.name || best.id,
      specialty: best.spec.label,
      lean: best.lean,
      line: `${giver?.name || best.id} leans ${best.spec.label.toLowerCase()} and ${best.spec.line}.`,
    };
  }
  function roster() {
    const data = store();
    return Object.entries(data.net).map(([id, row]) => {
      const giver = quests.givers[id];
      const spec = network.specialties[row.specialty];
      return {
        id,
        name: giver?.name || id,
        specialty: spec?.label || row.specialty,
        lean: row.lean,
        line: `${giver?.name || id} · ${spec?.label || row.specialty} · lean ${row.lean}`,
      };
    });
  }

  return {
    species, rarity, quests, vendors, network,
    context, weights, roll, rollTier, sight, stalls, issueQuest, help, roster, book,
    findId: FIND_ID,
    get weather() { return weatherNow(); },
    set weather(v) { weather = v || ''; const data = store(); data.stalls = null; data.quest = null; write(MEM, data); },
    set hear(fn) { hear = fn; },
    resetMemory() { const data = store(); data.memory = []; data.quest = null; write(MEM, data); },
  };
}
