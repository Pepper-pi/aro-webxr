// Sound. Every sound here is built from layers at the moment it is wanted, and each layer has a part made in code:
// tones, noise shaped by filters, and the room they are heard in. Over those, where the files are there, go
// recordings (public/audio, cut by tools/sounds.mjs; a game without them still sounds, thinner).
//
// What everything passes through, in order: the world's sounds are mixed, hushed for the instant a blast lands,
// dulled as ears are after one, pressed so that nothing clips, and let out. Two rooms are sent to: the air round
// about (a short wide tail) and the hills (the same sound come back late and dull).
//
// Nothing here is timed by the page's clock. A sound is asked for at a time on the sound card's own clock, so that
// what belongs together lands together whatever the frame rate; and the same code can be run with no sound card at
// all, as fast as it will go, to write down what would have been heard (`offline`, for films of the game).
import { FALL, HEIGHTS } from './blast.js';
import { SHUT } from './hole.js';
import { BOB } from './player.js';
import { SITES } from './structures.js';

const RATE = 48000;
// the six notes the circles of a blast are written to, lowest circle first
const NOTES = [110.0, 130.81, 146.83, 164.81, 196.0, 220.0];
const RECORDINGS = 'audio/';

export function createSound({ offline = 0 } = {}) {
  const AC = window.AudioContext ?? window.webkitAudioContext;
  const ctx = offline ? new OfflineAudioContext(2, Math.ceil(offline * RATE), RATE) : new AC({ latencyHint: 'interactive' });
  const rate = ctx.sampleRate || RATE;
  const t = () => ctx.currentTime;
  const R = Math.random;
  const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const O = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const P = (pan = 0) => { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); return p; };
  /** Joins them in a row; gives back the last. */
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  /** A value over time: [[seconds after `at`, value], ...], in straight lines, or falling away as sounds do (`curve`). */
  const env = (param, at, points, curve = false) => {
    param.cancelScheduledValues(at);
    param.setValueAtTime(points[0][1], at + points[0][0]);
    for (let i = 1; i < points.length; i++) {
      if (curve && points[i][1] > 0 && points[i - 1][1] > 0) param.exponentialRampToValueAtTime(points[i][1], at + points[i][0]);
      else param.linearRampToValueAtTime(points[i][1], at + points[i][0]);
    }
  };

  // ---- what everything passes through
  const mix = G(1), hush = G(1), ears = F('lowpass', 20000, 0.5), pre = G(0.5), press = ctx.createDynamicsCompressor(), soft = ctx.createWaveShaper(), out = G(0.9);
  Object.assign(press.threshold, { value: -6 }); Object.assign(press.knee, { value: 6 }); Object.assign(press.ratio, { value: 8 }); Object.assign(press.attack, { value: 0.003 }); Object.assign(press.release, { value: 0.3 });
  soft.curve = Float32Array.from({ length: 2049 }, (_, i) => Math.tanh(((i - 1024) / 1024) * 1.5) / Math.tanh(1.5));
  soft.oversample = '2x';
  chain(mix, hush, ears, pre, press, soft, out, ctx.destination);
  // (the ringing of ears is not dulled with the rest: it is inside the head)
  const ringing = G(1); ringing.connect(pre);
  // (what is always there, wind and the like, steps back for what is loud)
  const beds = G(1); beds.connect(mix);

  // the air round about: a burst of noise dying away, duller as it dies, with a few early returns
  const room = ctx.createConvolver(), roomIn = G(1);
  {
    const n = Math.floor(rate * 3.2), b = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const s = i / rate; lp += (0.03 + 0.55 * Math.exp(-s * 1.6)) * (R() * 2 - 1 - lp); d[i] = lp * Math.exp(-s * 2.1) * Math.min(1, s / 0.01); }
      for (let k = 0; k < 7; k++) { const at = Math.floor(rate * (0.018 + 0.14 * R())); d[at] += (R() < 0.5 ? -1 : 1) * (0.9 - 0.08 * k); }
    }
    room.buffer = b;
  }
  chain(roomIn, room, G(0.8), mix);
  // the hills: it comes back, late and dull, and comes back again fainter
  const hillsIn = G(1), far = ctx.createDelay(2), farLow = F('lowpass', 1250, 0.5);
  far.delayTime.value = 0.71;
  chain(hillsIn, far, farLow, G(0.85), mix); chain(farLow, G(0.34), far);

  // ---- what sounds are made of
  const noises = {};
  for (const kind of ['white', 'pink', 'brown']) {
    const n = Math.floor(rate * 3), b = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = R() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.24; }
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      }
    }
    noises[kind] = b;
  }
  const noise = (kind, at, until) => { const s = ctx.createBufferSource(); s.buffer = noises[kind]; s.loop = true; s.start(at, R() * 2.5); if (until) s.stop(until); return s; };
  // a click with a little body: an ember, a grain of what falls
  const grain = ctx.createBuffer(1, Math.floor(rate * 0.04), rate);
  { const d = grain.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (R() * 2 - 1) * Math.exp(-i / (rate * 0.006)); }
  /** A slow uneven swell on a level: so that what burns and what rumbles is never still. */
  const waver = (node, at, until, rates, depth) => { for (const r of rates) { const l = O('sine', r * (0.9 + 0.2 * R())); chain(l, G(depth / rates.length), node.gain); l.start(at); if (until) l.stop(until); } };
  /** Where a sound goes: the world, and how much of it to the air and to the hills. */
  const send = (node, { air = 0, hills = 0, to = mix } = {}) => { node.connect(to); if (air) chain(node, G(air), roomIn); if (hills) chain(node, G(hills), hillsIn); return node; };

  // ---- recordings
  const buffers = {};
  let loaded = false;
  const ready = (async () => {
    let names = [];
    // (?bare: as a copy of the repo sounds, with no recordings)
    if (!new URLSearchParams(location.search).has('bare')) try { const r = await fetch(`${RECORDINGS}manifest.json`); if (r.ok) names = await r.json(); } catch { /* none: all of it is made here */ }
    await Promise.all(names.map(async (name) => {
      try { const r = await fetch(`${RECORDINGS}${name}.ogg`); if (r.ok) buffers[name] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch { /* that one is done without */ }
    }));
    await Promise.all([1, 2, 3, 4, 5].map(async (i) => { try { const r = await fetch(`sfx/step${i}.ogg`); if (r.ok) buffers[`free${i}`] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch { /* none */ } }));
    // (turned round now, not in the middle of a spell)
    // (said once, where an agent or a person looking will see it; not an error)
    if (!names.length) console.info('Sound: playing with no recordings, only what is made in code. MISSING_ASSETS.md in the repo says what the published game adds and how to get it: node tools/sounds.mjs fetch');
    for (const name of ['slam', 'deep', 'boom', 'far', 'tail']) turned(name);
    loaded = true;
    bedsBegin();
  })();
  const back = {};
  /** A recording turned round, so that it swells to where it began. */
  const turned = (name) => {
    const b = buffers[name];
    if (!b) return null;
    if (!back[name]) { const r = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate); for (let c = 0; c < b.numberOfChannels; c++) r.getChannelData(c).set(Float32Array.from(b.getChannelData(c)).reverse()); back[name] = r; }
    return back[name];
  };
  /** Plays a recording, if it is there. */
  function play(name, { at = t(), gain = 1, rate = 1, pan = 0, low = 0, air = 0, hills = 0, to = mix, loop = false, fadeIn = 0, shape = null, rev = false, from = 0, bend = null, high = 0 } = {}) {
    const b = rev ? turned(name) : buffers[name];
    if (!b) return null;
    const s = ctx.createBufferSource(), g = G(gain);
    s.buffer = b; s.playbackRate.value = rate; s.loop = loop;
    if (fadeIn) env(g.gain, at, [[0, 0], [fadeIn, gain]]);
    // (`shape`: how its level goes, as parts of `gain` over seconds, falling away as sounds do)
    if (shape) env(g.gain, at, shape.map(([s, v]) => [s, Math.max(v * gain, 0.0001)]), true);
    // (`low`: nothing above this is let through; `high`: nothing below)
    const cut = low ? chain(s, F('lowpass', low, 0.5)) : s;
    send(chain(high ? chain(cut, F('highpass', high, 0.5)) : cut, g, P(pan)), { air, hills, to });
    // (`bend`: [how many times slower it ends, over how many seconds]: as a record does when its power is cut)
    if (bend) env(s.playbackRate, at, [[0, rate], [bend[1], rate / bend[0]]], true);
    s.start(at, loop ? R() * b.duration : from);
    s.level = g;
    return s;
  }

  // ---- who hears
  const eye = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
  /** How a place is heard from where they stand: how far, how much to one side, and how near (1 beside them, 0 far off). */
  function hear(p) {
    const dx = p.x - eye.x, dz = p.z - eye.z, d = Math.hypot(dx, dz);
    return { d, pan: d > 0.5 ? ((dx * eye.rx + dz * eye.rz) / d) * Math.min(1, d / 8) : 0, near: Math.max(0, 1 - d / 110) };
  }

  // ---- what is always there: wind over open ground
  function bedsBegin() {
    const at = t(), low = F('lowpass', 420, 0.6), g = G(0.04);
    chain(noise('pink', at), low, g, beds);
    const l = O('sine', 0.07); chain(l, G(170), low.frequency); l.start(at);
    waver(g, at, undefined, [0.11, 0.23], 0.03);
    play('wind', { at, gain: 0.45, loop: true, to: beds, fadeIn: 2 });
  }

  // ---- the blast
  // While it is gathered: a low drone that climbs and opens and begins to shake and tear, the ground under it, a beat
  // that quickens, tones and hiss climbing, air drawn in, light gathering high up, and a stroke of magic as each
  // circle is written. As it falls: all of that snatched away, one falling line, the
  // circles ringing as the spark passes them. Then nothing at all, for as long as the picture is ink. Then the blast.
  let gathering = null;
  const shaper = (hard) => { const w = ctx.createWaveShaper(); w.curve = Float32Array.from({ length: 1025 }, (_, i) => Math.tanh(((i - 512) / 512) * hard)); return w; };
  /** A level that rises and falls with no edge to it: nothing at `at`, `peak` part-way, nothing again `lasts` later. */
  const swell = (param, at, lasts, peak, lean = 1) => param.setValueCurveAtTime(Float32Array.from({ length: 48 }, (_, i) => peak * Math.sin(Math.PI * (i / 47) ** lean) ** 2), at, lasts);
  /** A circle written: a swish of air drawn round in a ring, with a thin high note sliding up inside it and glints after. Nothing is struck. Each is bigger than the last. */
  function seal(i, at, scale = 1, plain = false) {
    const f = NOTES[i], k = 1 + 0.12 * i, lasts = 0.6 + 0.05 * i, big = (0.28 + 0.13 * i) * scale, side = i % 2 ? 1 : -1, bus = G(big), pan = P(0);
    // (it goes round: from one side across to the other)
    env(pan.pan, at, [[0, -0.75 * side], [lasts, 0.75 * side]]);
    send(chain(bus, pan), { air: 0.6 });
    // the swish: its pitch goes up and comes down as it passes, and it is doubled against itself a hair late, which is
    // what makes air sound swept and not merely blown
    const band = F('bandpass', 500 * k, 1.1), e = G(0), late = ctx.createDelay(0.02);
    env(band.frequency, at, [[0, 500 * k], [lasts * 0.55, 3800 * k], [lasts, 1500 * k]], true);
    env(late.delayTime, at, [[0, 0.006], [lasts * 0.6, 0.0012], [lasts, 0.004]]);
    swell(e.gain, at, lasts, 0.9, 0.8);
    chain(noise('white', at, at + lasts + 0.05), band, e, bus); chain(band, late, e);
    // the breath on top of it
    const airE = G(0);
    swell(airE.gain, at + 0.04, lasts, 0.3, 0.7);
    chain(noise('white', at, at + lasts + 0.1), F('highpass', 6000), airE, bus);
    // a note inside it, high and thin, sliding up: what makes it magic and not wind
    if (!plain) {
    const toneE = G(0);
    swell(toneE.gain, at, lasts * 1.5, 0.07, 0.6);
    for (const ratio of [8, 12.02, 16, 24.05]) { const o = O('sine', f * ratio); env(o.detune, at, [[0, -250], [lasts * 1.5, 150]]); chain(o, toneE); o.start(at); o.stop(at + lasts * 1.5 + 0.02); }
    chain(toneE, bus); chain(toneE, G(1.5), roomIn);
    // glints, climbing, scattered to either side
    for (let g = 0; g < 9; g++) {
      const when = at + lasts * (0.25 + 0.1 * g) + 0.02 * R(), o = O('sine', f * (16 + 3 * g)), pe = G(0);
      env(pe.gain, when, [[0, 0.0001], [0.004, 0.05 * big], [0.08, 0.0001]], true);
      send(chain(o, pe, P(R() * 1.6 - 0.8)), { air: 0.9 }); o.start(when); o.stop(when + 0.09);
    }
    }
    // and under it a swell too low to have an edge
    const lo = O('sine', 52), loE = G(0);
    env(lo.frequency, at, [[0, 52], [lasts, 74]], true); swell(loE.gain, at, lasts * 1.2, 0.25, 0.9);
    chain(lo, loE, bus); lo.start(at); lo.stop(at + lasts * 1.2 + 0.02);
  }
  /** One beat of what quickens under it. */
  function pulse(when, c, to) {
    const o = O('sine', 78), e = G(0);
    env(o.frequency, when, [[0, 78], [0.12, 38]], true); env(e.gain, when, [[0, 0.0001], [0.005, 0.1 + 1.15 * c], [0.16, 0.0001]], true);
    chain(o, e, to); o.start(when); o.stop(when + 0.18);
  }
  function begin() {
    if (gathering) stop(gathering, 0.05);
    const at = t(), bus = G(0), low = F('lowpass', 90, 2.5), shake = G(1), lfo = O('sine', 2.5), depth = G(0), stuff = [];
    const oscs = [['sawtooth', 41.2, 0.5], ['sawtooth', 41.5, 0.5], ['square', 82.1, 0.2], ['sine', 41.2, 0.9], ['sawtooth', 61.7, 0.22]].map(([type, f, level]) => { const o = O(type, f); chain(o, G(level), low); o.start(at); return o; });
    // (the drone is pushed harder and harder into something that tears it)
    const droneG = G(0.03), push = G(1);
    chain(low, shake, push, shaper(2), droneG, bus); chain(lfo, depth, shake.gain); lfo.start(at);
    // tones that climb two octaves while it gathers, and a hiss that climbs with them
    const riseF = F('bandpass', 300, 1.2), riseG = G(0);
    const rise = [[110, 0.5], [110.7, 0.5], [165.3, 0.3], [220.4, 0.25]].map(([f, level]) => { const o = O('sawtooth', f); chain(o, G(level), riseF); o.start(at); return o; });
    chain(riseF, riseG, bus);
    const whineG = G(0), whine = [['sine', 520, 0.6], ['sawtooth', 523, 0.1], ['sine', 782, 0.3]].map(([type, f, level]) => { const o = O(type, f); chain(o, G(level), whineG); o.start(at); return o; });
    chain(whineG, bus); chain(whineG, G(0.6), roomIn);
    const roarF = F('lowpass', 200, 0.7), roarG = G(0), roar = noise('pink', at);
    chain(roar, roarF, roarG, bus);
    const hissF = F('highpass', 1200), hissG = G(0), hiss = noise('white', at);
    chain(hiss, hissF, hissG, bus);
    const air = noise('pink', at), band = F('bandpass', 250, 0.9), airG = G(0);
    chain(air, band, airG, bus);
    // the ground under it
    const quakeG = G(0), quake = play('quake', { at, loop: true, low: 240, to: quakeG });
    quakeG.connect(bus);
    const high = G(0);
    for (const ratio of [1, 1.26, 1.5, 1.89, 2.52]) {
      const o = O('sine', 1568 * ratio * (1 + (R() - 0.5) * 0.01)), g = G(0.2), l = O('sine', 0.7 + 2.3 * R());
      chain(l, G(0.2), g.gain); chain(o, g, high); o.start(at); l.start(at); stuff.push(o, l);
    }
    chain(high, bus); chain(high, G(1.6), roomIn);
    send(bus, { air: 0.3 });
    bus.gain.setTargetAtTime(0.9, at, 0.08);
    gathering = { whine, whineG, roarF, roarG, bus, low, lfo, depth, band, airG, high, oscs, drone: shake, droneG, push, rise, riseF, riseG, hissF, hissG, quakeG, beat: at + 0.3, stuff: [...oscs, ...rise, ...whine, roar, lfo, air, hiss, ...(quake ? [quake] : []), ...stuff], written: 0 };
  }
  function stop(v, over) { const at = t(); v.bus.gain.cancelScheduledValues(at); v.bus.gain.setTargetAtTime(0, at, over / 3); for (const s of v.stuff) s.stop(at + over * 2 + 0.05); }
  function charge(c) {
    const v = gathering, at = t(), k = 0.06;
    for (const o of v.oscs) o.detune.setTargetAtTime(1200 * c ** 1.6, at, k);
    v.low.frequency.setTargetAtTime(90 + 2600 * c * c, at, k); v.droneG.gain.setTargetAtTime(0.03 + 0.44 * c ** 1.6, at, k); v.push.gain.setTargetAtTime(1 + 3 * c, at, k);
    v.lfo.frequency.setTargetAtTime(2.5 + 15 * c * c, at, k); v.depth.gain.setTargetAtTime(0.5 * c, at, k);
    for (const o of v.rise) o.detune.setTargetAtTime(2400 * c ** 1.5, at, k);
    v.riseF.frequency.setTargetAtTime(300 + 3400 * c ** 1.5, at, k); v.riseG.gain.setTargetAtTime(0.26 * c * c, at, k);
    v.hissF.frequency.setTargetAtTime(1200 + 5200 * c, at, k); v.hissG.gain.setTargetAtTime(0.13 * c ** 3, at, k);
    v.band.frequency.setTargetAtTime(250 + 3200 * c ** 1.5, at, k); v.airG.gain.setTargetAtTime(0.6 * c * c, at, k);
    v.quakeG.gain.setTargetAtTime(1.4 * c ** 2, at, k);
    for (const o of v.whine) o.detune.setTargetAtTime(3600 * c ** 1.3, at, k);
    v.whineG.gain.setTargetAtTime(0.11 * c ** 3, at, k);
    v.roarF.frequency.setTargetAtTime(200 + 5200 * c * c, at, k); v.roarG.gain.setTargetAtTime(0.6 * c * c, at, k);
    // (and in the last of it, all of it surges)
    v.bus.gain.setTargetAtTime(0.9 * (1 + 0.45 * c ** 8), at, k); pre.gain.setTargetAtTime(0.5 + 0.22 * c ** 6, at, k);
    v.high.gain.setTargetAtTime(0.08 * c, at, k);
    // (a beat under it, twice a second at first, a roll of fifteen a second when it is full)
    while (v.beat <= at + 0.03) { pulse(Math.max(v.beat, at), c, v.bus); v.beat += Math.max(0.065, 0.5 - 0.45 * c); }
    // (each circle is struck as it begins to be written: blast.js writes them by the same rule)
    while (v.written < NOTES.length && c * (HEIGHTS.length + 0.7) - v.written > 0.05) seal(v.written++, at);
    beds.gain.setTargetAtTime(1 - 0.85 * c, at, 0.2);
  }
  function cancel() {
    const v = gathering, at = t();
    if (!v) return;
    for (const o of v.oscs) o.detune.setTargetAtTime(-700, at, 0.15);
    stop(v, 0.4); gathering = null;
    pre.gain.setTargetAtTime(0.5, at, 0.1);
    beds.gain.setTargetAtTime(1, at, 0.6);
  }
  function fall() {
    const v = gathering, at = t();
    if (v) {
      v.drone.gain.cancelScheduledValues(at); v.drone.gain.setTargetAtTime(0, at, 0.012); v.depth.gain.setTargetAtTime(0, at, 0.01); v.high.gain.setTargetAtTime(0, at, 0.02);
      v.bus.gain.cancelScheduledValues(at); v.bus.gain.setTargetAtTime(0.9, at, 0.02); pre.gain.setTargetAtTime(0.5, at, 0.02); v.whineG.gain.setTargetAtTime(0, at, 0.015); v.roarG.gain.setTargetAtTime(0, at, 0.015);
      v.riseG.gain.setTargetAtTime(0, at, 0.015); v.quakeG.gain.setTargetAtTime(0, at, 0.02); v.hissG.gain.setTargetAtTime(0.3, at, 0.03);
      v.airG.gain.setTargetAtTime(0.95, at, 0.03); v.band.frequency.cancelScheduledValues(at); v.band.frequency.setTargetAtTime(7500, at, 0.09);
      for (const s of v.stuff) s.stop(at + FALL + 0.05);
      gathering = null;
    }
    // the spark coming down
    const zip = G(0); send(zip, { air: 0.4 });
    for (const [type, octave, level] of [['sine', 1, 0.2], ['triangle', 0.5, 0.1]]) { const o = O(type, 5200 * octave); env(o.frequency, at, [[0, 5200 * octave], [FALL, 230 * octave]], true); chain(o, G(level), zip); o.start(at); o.stop(at + FALL + 0.02); }
    env(zip.gain, at, [[0, 0.5], [FALL, 1.3], [FALL + 0.015, 0]]);
    // each circle rings like glass as it is passed, the highest first
    const top = HEIGHTS[HEIGHTS.length - 1];
    HEIGHTS.forEach((h, i) => {
      const when = at + (1 - h / top) * FALL, e = G(0);
      env(e.gain, when, [[0, 0.0001], [0.003, 0.2], [0.13, 0.0001]], true);
      for (const ratio of [4, 11.04]) { const o = O('sine', NOTES[i] * ratio); chain(o, e); o.start(when); o.stop(when + 0.15); }
      send(chain(e, P(i % 2 ? -0.3 : 0.3)), { air: 0.6 });
    });
  }
  function impact(place) {
    const at = t(), { d, pan, near } = hear(place), level = 0.3 + 0.7 * near;
    // (it is seen before it is heard, by as long as sound takes to come: and until it comes there is nothing)
    const tb = at + 0.14 + Math.min(d / 343, 0.2), recorded = Boolean(buffers.boom);
    env(hush.gain, at, [[0, 1], [0.006, 0], [tb - at - 0.004, 0], [tb - at, 1]]);
    // ears: open for the crack, then dulled, and a long while clearing; and they ring
    const dull = 20000 * (2000 / 20000) ** Math.min(1, near * 1.1);
    env(ears.frequency, tb, [[0, 20000], [0.1, 20000], [0.45, dull], [1.2, dull], [5, 20000]], true);
    const ring = G(0);
    for (const f of [5900, 6035]) { const o = O('sine', f); chain(o, ring); o.start(tb); o.stop(tb + 6.6); }
    env(ring.gain, tb, [[0, 0.0001], [0.4, 0.022 * near * near + 0.0001], [6.5, 0.0001]], true);
    ring.connect(ringing);
    env(beds.gain, tb, [[0, 0.08], [2.5, 0.08], [10, 1]]);

    // everything of the blast's body goes through this: its low end lifted
    const body = G(1), shelf = F('lowshelf', 130);
    shelf.gain.value = 10; chain(body, shelf, mix);
    // (for its first seconds everything is pushed past what the press will pass cleanly: as loud things are when they are too loud)
    env(pre.gain, tb, [[0, 0.5], [0.004, 0.95], [1.4, 0.95], [5.5, 0.5]]);
    // the crack: twice, a breath apart
    for (const [after, lasts, cut, amount] of [[0, 0.11, 1200, 1], [0.045, 0.17, 700, 0.6]]) {
      const e = G(0);
      env(e.gain, tb + after, [[0, amount * level], [lasts, 0.0001]], true);
      send(chain(noise('white', tb + after, tb + after + lasts + 0.02), F('highpass', cut), e, P(pan * 0.6)), { air: 0.35, hills: 0.6 });
    }
    // the body, made here: a roar of noise that closes down as it dies
    {
      const low = F('lowpass', 4200, 0.6), e = G(0);
      env(low.frequency, tb, [[0, 4200], [1.5, 170]], true); env(e.gain, tb, [[0, (recorded ? 0.5 : 1.15) * level], [3.6, 0.0001]], true);
      send(chain(noise('pink', tb, tb + 3.7), low, e), { air: 0.3, hills: 0.7, to: body });
    }
    // under it: a note that drops out of hearing, pushed hard enough to be heard on small speakers too; and a thump
    {
      const o = O('sine', 86), e = G(0);
      env(o.frequency, tb, [[0, 86], [0.5, 30]], true); env(e.gain, tb, [[0, 0.0001], [0.008, 1.5], [6, 0.0001]], true);
      chain(o, e, shaper(2.6), G(1.0 * level), mix); o.start(tb); o.stop(tb + 6.1);
      // (a second, lower and slower, that is felt more than heard)
      const o2 = O('sine', 52), e2 = G(0);
      env(o2.frequency, tb, [[0, 52], [1.4, 24]], true); env(e2.gain, tb, [[0, 0.0001], [0.02, 1.3], [7.5, 0.0001]], true);
      chain(o2, e2, shaper(2.2), G(0.9 * level), mix); o2.start(tb); o2.stop(tb + 7.6);
      const th = O('triangle', 140), te = G(0);
      env(th.frequency, tb, [[0, 140], [0.18, 48]], true); env(te.gain, tb, [[0, 1.0 * level], [0.36, 0.0001]], true);
      chain(th, te, mix); th.start(tb); th.stop(tb + 0.4);
      // (and a growl an octave up from the floor, shuddering, for speakers that have no floor)
      const growl = F('lowpass', 210, 1), ge = G(0), gw = G(1);
      waver(gw, tb, tb + 2.6, [11, 7.3], 0.9);
      env(ge.gain, tb, [[0, 0.0001], [0.01, 0.6 * level], [2.5, 0.0001]], true);
      for (const f of [55, 55.7, 82.4]) { const g = O('sawtooth', f); chain(g, growl); g.start(tb); g.stop(tb + 2.6); }
      chain(growl, gw, ge, mix);
    }
    // the ground going on shaking, and the fire's own roar: neither of them steady
    {
      const wob = G(1), e = G(0);
      waver(wob, tb, tb + 8.2, [2.7, 4.3, 0.8], 0.6);
      env(e.gain, tb, [[0, 0.0001], [0.1, 1.0 * level], [2.5, 0.42 * level], [5, 0.12 * level], [7.9, 0.012 * level], [8.15, 0.0001]], true);
      chain(noise('brown', tb, tb + 8.2), F('lowpass', 150, 0.7), wob, e, mix);
      const wob2 = G(1), e2 = G(0);
      waver(wob2, tb, tb + 6.2, [5.3, 0.9, 8.1], 0.55);
      env(e2.gain, tb, [[0, 0.0001], [0.25, 0.4 * level], [2.5, 0.06 * level], [6, 0.0001]], true);
      send(chain(noise('pink', tb, tb + 6.2), F('bandpass', 340, 0.6), wob2, e2, P(pan * 0.5)), { air: 0.3 });
    }
    // recordings over all that: the blast close, its weight, what rolls on, the fire, and the hills' answer
    play('boom', { at: tb, gain: 1.0 * level, rate: 0.8, pan: pan * 0.4, air: 0.35, hills: 0.5, to: body });
    play('deep', { at: tb, gain: 1.0 * level, rate: 0.66, to: body });
    play('dark', { at: tb, gain: 0.9 * level, rate: 0.7, to: body });
    play('slam', { at: tb, gain: 0.9 * level, rate: 0.5, air: 0.3, to: body });
    play('tail', { at: tb + 0.06, gain: 0.5 * level, rate: 0.78, air: 0.3, to: body, shape: [[0, 1], [2, 0.8], [5, 0.4], [9, 0.1], [15, 0.003]] });
    play('quake', { at: tb, gain: 1.2 * level, rate: 0.85, low: 260, shape: [[0, 1], [2, 0.8], [5, 0.4], [9, 0.06], [11.5, 0.001]] });
    // (it rolls: once more, lower, and once more again, as thunder does going away)
    play('deep', { at: tb + 1.15, gain: 0.75 * level, rate: 0.5, to: body, air: 0.3 });
    play('boom', { at: tb + 2.2, gain: 0.55 * level, rate: 0.55, low: 900, pan: -pan * 0.4, to: body, air: 0.4 });
    play('dark', { at: tb + 3.3, gain: 0.45 * level, rate: 0.55, low: 600, pan: pan * 0.4, to: body, air: 0.4 });
    play('fireball', { at: tb + 0.05, gain: 0.4 * level, pan: pan * 0.5, air: 0.2, shape: [[0, 1], [1.5, 0.4], [5, 0.07], [9.5, 0.002]] });
    play('far', { at: tb + 0.9, gain: 0.42 * level, rate: 0.9, low: 1500, pan: -pan * 0.5, shape: [[0, 1], [3, 0.5], [7, 0.02]] });
    // embers coming down: many small ticks, thinning out
    for (let k = 0; k < 70; k++) {
      const s = ctx.createBufferSource(), when = tb + 0.5 + 9.5 * R() ** 1.7;
      s.buffer = grain; s.playbackRate.value = 0.5 + 1.6 * R();
      send(chain(s, F('bandpass', 2200 + 4500 * R(), 2), G((0.05 + 0.2 * R()) * near), P(pan + R() - 0.5)), { air: 0.2 });
      s.start(when);
    }
  }
  /** The ring of air from it reaching them. */
  function gust(power, pan) {
    const at = t(), band = F('bandpass', 260, 0.8), e = G(0), p = P(pan * 0.8);
    env(band.frequency, at, [[0, 260], [0.25, 1500], [1.1, 380]], true); env(e.gain, at, [[0, 0.0001], [0.18, 0.75 * power + 0.0001], [1.6, 0.0001]], true);
    env(p.pan, at, [[0, pan * 0.8], [1.2, -pan * 0.6]]);
    send(chain(noise('pink', at, at + 1.7), band, e, p), { air: 0.25 });
    const b = G(0);
    env(b.gain, at, [[0, 0.0001], [0.08, 1.4 * power + 0.0001], [1.1, 0.0001]], true);
    chain(noise('brown', at, at + 1.2), F('lowpass', 140), b, mix);
  }
  /** What it broke coming down: `amount` 0 to 1. */
  function debris(amount, pan) {
    const at = t(), recorded = Boolean(buffers.rubble);
    play('bricks', { at, gain: 0.7 * amount, pan: pan * 0.6, air: 0.25 });
    play('rubble', { at: at + 0.25, gain: 0.8 * amount, rate: 0.9, pan: pan * 0.7, air: 0.25 });
    play('dust', { at: at + 1.3, gain: 0.7 * amount, pan: pan * 0.5, air: 0.2 });
    play('rubble', { at: at + 1.9, gain: 0.4 * amount, rate: 0.75, pan: pan * 0.4, air: 0.3 });
    for (let k = 0, n = 8 + 30 * amount; k < n; k++) {
      const when = at + 3.2 * R() ** 1.4, lasts = 0.07 + 0.25 * R(), e = G(0);
      env(e.gain, when, [[0, (0.15 + 0.5 * R()) * amount * (recorded ? 0.35 : 1)], [lasts, 0.0001]], true);
      send(chain(noise('brown', when, when + lasts + 0.02), F('lowpass', 260 + 1100 * R()), e, P(pan + (R() - 0.5) * 0.7)), { air: 0.2 });
    }
  }

  // ---- the singularity
  // Open: a tear, and a note that drops to the floor. Held: two low notes a hair apart, beating; a pitch that falls and
  // falls and never arrives; air drawn round and in, in sweeps; a slow heart; the ground; and the world itself gone
  // dull and far, as if its sound were being taken too. If it has hold of a building: timber groaning, stone grinding.
  // Shut: all of that faster and lower and louder, a breath drawn in to nothing. Then nothing. Then the ring.
  // (Its own sounds go round what dulls the world: it is the one thing heard clearly.)
  let pit = null;
  /** The last `seconds` of a recording played backwards at `rate`: it swells and stops dead `seconds` after `at`. */
  const intake = (name, at, seconds, o) => { const b = buffers[name]; return b ? play(name, { ...o, rev: true, at, from: Math.max(0, b.duration - seconds * (o.rate ?? 1)) }) : null; };
  /** Something very heavy landing, made of noise (and never of a note that slides, which sounds like a machine). */
  function thud(at, level, lasts, to) {
    const low = F('lowpass', 260, 0.8), e = G(0);
    env(low.frequency, at, [[0, 260], [lasts * 0.6, 55]], true); env(e.gain, at, [[0, 0.0001], [0.006, level], [lasts, 0.0001]], true);
    chain(noise('brown', at, at + lasts + 0.05), low, e, shaper(3), to);
  }
  function pitOpen(place) {
    if (pit) pitShut(pit);
    const at = t(), { pan, near } = hear(place), level = 0.45 + 0.55 * near;
    // everything of it is pushed through something that tears it, and its low end lifted; and all of it growls: its level
    // is shaken some forty times a second, never quite evenly
    const bus = G(0), rough = G(1), post = G(0.15), shelf = F('lowshelf', 110), clear = G(level);
    shelf.gain.value = 7;
    // (how loud it is, is set after the tearing: before it, more level only tears it more)
    chain(bus, rough, G(0.75), shaper(3), post, shelf, clear, P(pan * 0.4), pre); chain(clear, G(0.4), roomIn);
    env(bus.gain, at, [[0, 0], [0.6, 1]]);
    const growl = O('sine', 39), growlDepth = G(0), drift = O('sine', 0.23);
    chain(growl, growlDepth, rough.gain); chain(drift, G(7), growl.frequency); growl.start(at); drift.start(at);
    // two notes at the floor of hearing a hair apart, one in each ear, and rough tones over them that do not agree
    const droneG = G(0), low = F('lowpass', 140, 1.2);
    const drone = [[31, 1, -0.8], [31.6, 1, 0.8], [62.3, 0.4, 0], [93.4, 0.25, 0], [43.8, 0.3, 0]].map(([f, lv, side]) => { const o = O(side ? 'sine' : 'sawtooth', f); chain(o, G(lv), side ? P(side) : low); if (side) o.connect(droneG); o.start(at); return o; });
    low.connect(droneG); droneG.connect(bus);
    // (and none of it holds its pitch: it sags and recovers, slowly)
    const sag = O('sine', 0.17), sagDepth = G(38);
    sag.connect(sagDepth); for (const o of drone) sagDepth.connect(o.detune); sag.start(at);
    // falling for ever: six rough notes an octave apart, low, all sliding down, each fading in at the top and out at the bottom
    const fallG = G(0), fallLow = F('lowpass', 700, 1);
    const fall = Array.from({ length: 6 }, () => { const o = O('sawtooth', 27.5), g = G(0); chain(o, g, fallLow); o.start(at); return { o, g }; });
    chain(fallLow, fallG, bus);
    // a howl: wind, slowed to a moan, heard only through three narrow gaps that sink and waver; mostly from far off
    const howlIn = G(6), howlG = G(0), wind = play('wind', { at, loop: true, rate: 0.4, to: howlIn }) ?? noise('pink', at);
    if (!buffers.wind) wind.connect(howlIn);
    const howls = [110, 155.6, 233.1].map((f, i) => { const band = F('bandpass', f, 16), l = O('sine', 0.11 + 0.07 * i); chain(l, G(f * 0.06), band.frequency); l.start(at); chain(howlIn, band, howlG); return { band, l, f }; });
    chain(howlG, bus); chain(howlG, G(1.5), roomIn);
    // and the same wind again far higher, thin and torn, a tritone stacked on itself: voices that are not voices
    const wailG = G(0), wailOut = G(0.5);
    const wails = [466.2, 659.3, 932.3].map((f, i) => { const band = F('bandpass', f, 22), l = O('sine', 0.19 + 0.11 * i); chain(l, G(f * 0.035), band.frequency); l.start(at); chain(howlIn, band, wailG); return { band, l, f }; });
    chain(wailG, shaper(2.5), wailOut, bus); chain(wailOut, G(2), roomIn);
    // timber and iron again, nearer their own pitch, wandering from ear to ear
    const creakG = G(0), creakPan = P(0), creakTurn = O('sine', 0.13), creak = play('stress', { at, loop: true, rate: 0.8, to: creakG });
    chain(creakTurn, G(0.9), creakPan.pan); creakTurn.start(at); chain(creakG, creakPan, bus);
    // air drawn round and in: each sweep falls in pitch as it goes, and it circles from ear to ear
    const band = F('bandpass', 700, 2.4), sweep = O('sawtooth', 0.6), round = O('sine', 0.3), suckPan = P(0), suckG = G(0), suck = noise('pink', at);
    chain(sweep, G(-480), band.frequency); chain(round, G(0.8), suckPan.pan); sweep.start(at); round.start(at);
    chain(suck, band, suckG, suckPan, bus);
    // the breath that is drawn at the end
    const inF = F('highpass', 2500), inG = G(0), breath = noise('white', at);
    chain(breath, inF, inG, bus);
    // recordings, far below their pitch: the ground, timber and iron groaning, stone grinding
    const quakeG = G(0), stressG = G(0), grindG = G(0), loops = [play('quake', { at, loop: true, rate: 0.55, low: 220, to: quakeG }), play('stress', { at, loop: true, rate: 0.42, to: stressG }), play('grind', { at, loop: true, rate: 0.5, to: grindG })].filter(Boolean);
    for (const g of [quakeG, stressG, grindG]) g.connect(bus);
    // the opening: a breath snatched in (something heavy, heard backwards), a tear from high to low, and then the weight of it arriving
    {
      const first = G(level * 0.6), lift = F('lowshelf', 120), hit = at + 0.3;
      lift.gain.value = 8;
      chain(first, lift, P(pan * 0.4), pre); chain(first, G(0.4), roomIn);
      intake('slam', at, 0.3, { rate: 0.8, gain: 0.8, to: first }); intake('deep', at, 0.3, { rate: 0.6, gain: 0.7, to: first });
      const rip = F('bandpass', 5000, 1.5), re = G(0);
      env(rip.frequency, at, [[0, 5000], [0.5, 140]], true); env(re.gain, at, [[0, 0.0001], [0.04, 0.5], [0.55, 0.0001]], true);
      chain(noise('white', at, at + 0.6), rip, re, first);
      play('dark', { at: hit, gain: 1.0, rate: 0.55, to: first, shape: [[0, 1], [1.5, 0.3], [3.5, 0.001]] });
      play('slam', { at: hit, gain: 1.0, rate: 0.4, to: first });
      play('deep', { at: hit, gain: 0.7, rate: 0.5, to: first, bend: [1.8, 2.5], shape: [[0, 1], [1.2, 0.3], [2.8, 0.001]] });
      thud(hit, buffers.slam ? 0.9 : 1.4, 1.1, first);
    }
    pit = { wails, wailG, creakG, gasp: at + 1.6, bus, post, growl, growlDepth, droneG, drone, fall, fallG, howls, howlG, sweep, round, suckG, inF, inG, quakeG, stressG, grindG, turn: 0, age: 0, beat: at + 1.0, had: 0, stuff: [...drone, ...fall.map((f) => f.o), ...howls.map((h) => h.l), ...wails.map((h) => h.l), sag, creakTurn, ...(creak ? [creak] : []), growl, drift, wind, sweep, round, suck, breath, ...loops] };
  }
  /** One beat of its slow heart: something huge, struck far below. */
  function thump(when, g, to) {
    if (!play('slam', { at: when, gain: 0.7 * g, rate: 0.3, low: 260, to })) thud(when, 0.5 * g, 0.45, to);
  }
  /** Each frame while it is there: how hard it draws, how far shut it is (0 to 1), and how many pieces of buildings it has. */
  function pitFeed(grip, k, held, dt) {
    const v = pit, at = t(), c = 0.08, g = Math.min(1.3, grip);
    v.had = held; v.age += dt;
    // (the fall: an octave every six seconds, and at the end an octave in a third of one)
    v.turn += (dt / 6) * (1 + 17 * k * k);
    v.fall.forEach(({ o, g: level }, i) => { const x = (((i - v.turn) % 6) + 6) % 6; o.frequency.setTargetAtTime(27.5 * 2 ** x, at, 0.02); level.gain.setTargetAtTime(0.3 * Math.sin((Math.PI * x) / 6) ** 2, at, 0.02); });
    v.post.gain.setTargetAtTime((0.06 + 0.2 * g ** 3) * (1 + 1.1 * k), at, c);
    v.fallG.gain.setTargetAtTime(0.5 * g, at, c);
    v.droneG.gain.setTargetAtTime(0.45 * g * (1 + k), at, c);
    for (const o of v.drone) o.detune.setTargetAtTime(-500 * k * k, at, 0.03);
    v.growlDepth.gain.setTargetAtTime(0.45 * g + 0.3 * k, at, c); v.growl.frequency.setTargetAtTime(39 + 22 * k, at, c);
    // (the howl sinks as it grows, and dives as it shuts)
    const sunk = (1 - 0.22 * Math.min(1, v.age / 8)) * (1 - 0.5 * k);
    for (const h of v.howls) h.band.frequency.setTargetAtTime(h.f * sunk, at, 0.1);
    v.howlG.gain.setTargetAtTime(0.9 * g * (1 + k), at, c);
    for (const h of v.wails) h.band.frequency.setTargetAtTime(h.f * sunk, at, 0.1);
    v.wailG.gain.setTargetAtTime(1.1 * g * g * (1 + k), at, c); v.creakG.gain.setTargetAtTime(0.22 * g, at, 0.3);
    // (and every couple of seconds it draws breath: a far blast heard backwards, swelling and cut off)
    while (k === 0 && v.gasp <= at) { intake(v.gasp % 2 < 1 ? 'far' : 'tail', at, 1.5, { rate: 0.6, gain: 0.9 * g, pan: R() * 1.2 - 0.6, to: v.bus }); v.gasp = at + 2 + 1.2 * R(); }
    v.sweep.frequency.setTargetAtTime(0.5 + 1.3 * g + 9 * k * k, at, c); v.round.frequency.setTargetAtTime(0.25 + 0.65 * g + 4.5 * k * k, at, c);
    v.suckG.gain.setTargetAtTime(0.3 * g * (1 + 2 * k), at, c);
    v.inF.frequency.setTargetAtTime(2500 + 6000 * k, at, 0.03); v.inG.gain.setTargetAtTime(0.04 * g + 0.45 * k * k, at, 0.03);
    const taken = Math.min(1, held / 50);
    v.quakeG.gain.setTargetAtTime(0.8 * g * (1 + k), at, c);
    v.stressG.gain.setTargetAtTime(0.35 * g + 0.6 * taken, at, 0.3); v.grindG.gain.setTargetAtTime(0.2 * g + 0.45 * taken, at, 0.3);
    while (v.beat <= at + 0.03) { thump(Math.max(v.beat, at), g, v.bus); v.beat += Math.max(0.2, 1.25 - 0.4 * Math.min(1, g) - 0.75 * k); }
    // the world, taken too: dull and far
    ears.frequency.setTargetAtTime(20000 * (1400 / 20000) ** Math.min(1, g * 0.8 + k), at, 0.15);
    beds.gain.setTargetAtTime(Math.max(0, 1 - 0.7 * g - k), at, 0.15);
    pre.gain.setTargetAtTime(0.5 + 0.1 * g + 0.4 * k ** 3, at, 0.03);
  }
  /** It begins to shut: two great sounds heard backwards, swelling to stop dead at the moment it is gone. */
  function pitClose() {
    const at = t();
    intake('deep', at, SHUT, { rate: 0.7, gain: 1.2, to: pit.bus });
    intake('boom', at, SHUT, { rate: 0.6, gain: 0.9, to: pit.bus });
    intake('tail', at, SHUT, { rate: 0.8, gain: 0.8, to: pit.bus });
  }
  function pitShut(v) { const at = t(); v.bus.gain.cancelScheduledValues(at); v.bus.gain.setTargetAtTime(0, at, 0.004); for (const s of v.stuff) s.stop(at + 0.08); pit = null; }
  /** It is gone: nothing, for as long as there is nothing to see; then all it took, given back at once. */
  function pitBurst(place) {
    const at = t(), had = pit?.had ?? 0, { d, pan, near } = hear(place), level = 0.45 + 0.55 * near, recorded = Boolean(buffers.boom);
    if (pit) pitShut(pit);
    const tb = at + 0.16 + Math.min(d / 343, 0.2);
    env(hush.gain, at, [[0, 1], [0.006, 0], [tb - at - 0.004, 0], [tb - at, 1]]);
    // (what is heard now is clear again at once; the world comes back more slowly)
    env(ears.frequency, tb, [[0, 1400], [0.6, 1400], [4, 20000]], true);
    env(beds.gain, tb, [[0, 0], [2, 0.15], [7, 1]]);
    // (and for its first seconds it is too loud for anything to pass cleanly)
    env(pre.gain, tb, [[0, 0.5], [0.004, 1.1], [2, 1.1], [6, 0.5]]);
    const clear = G(level), body = G(1), shelf = F('lowshelf', 120), shudder = G(1), shake = O('sine', 23), shakeDepth = G(0);
    shelf.gain.value = 10;
    // (its body shudders, hard at first: torn more than twenty times a second)
    chain(shake, shakeDepth, shudder.gain); env(shakeDepth.gain, tb, [[0, 0.65], [2.8, 0.0001]], true); env(shake.frequency, tb, [[0, 23], [2.8, 9]], true); shake.start(tb); shake.stop(tb + 3);
    chain(clear, P(pan * 0.3), pre); chain(clear, G(0.4), roomIn); chain(clear, G(0.5), hillsIn); chain(body, G(0.8), shudder, shaper(3), G(0.5), shelf, clear);
    // the weight of it: recordings far below their pitch, and slowing as they play, as if time itself were dragged
    play('boom', { at: tb, gain: 1.0, rate: 0.55, to: body, bend: [2.2, 3.5], shape: [[0, 1], [1.5, 0.5], [4, 0.1], [7, 0.002]] });
    play('deep', { at: tb, gain: 1.0, rate: 0.45, to: body, bend: [1.8, 4], shape: [[0, 1], [2, 0.5], [5, 0.1], [8, 0.002]] });
    play('dark', { at: tb, gain: 0.9, rate: 0.5, to: body, shape: [[0, 1], [1.5, 0.4], [4, 0.05], [7, 0.001]] });
    play('slam', { at: tb, gain: 1.0, rate: 0.35, to: body });
    play('tail', { at: tb + 0.05, gain: 0.6, rate: 0.6, to: body, bend: [2, 6], shape: [[0, 1], [2, 0.7], [5, 0.2], [9, 0.003]] });
    play('quake', { at: tb, gain: 1.1, rate: 0.7, low: 240, to: body, shape: [[0, 1], [2, 0.6], [5, 0.15], [8.5, 0.002]] });
    // (and once more, lower, a moment after)
    play('deep', { at: tb + 0.95, gain: 0.6, rate: 0.33, low: 500, to: body });
    play('boom', { at: tb + 2.0, gain: 0.5, rate: 0.3, low: 400, to: body });
    play('fireball', { at: tb, gain: 0.5, rate: 0.4, to: body, shape: [[0, 1], [2, 0.4], [6, 0.002]] });
    // (and the things it took, groaning far below their pitch as they are let go)
    play('stress', { at: tb + 0.1, gain: 0.8, rate: 0.3, to: body, bend: [1.6, 6], shape: [[0, 1], [3, 0.5], [7.5, 0.002]] });
    play('grind', { at: tb, gain: 0.5, rate: 0.35, to: body, shape: [[0, 1], [2, 0.4], [6, 0.002]] });
    // made here: a roar of noise that closes down, a floor that does not move, a dull crack
    {
      const low = F('lowpass', 3200, 0.6), e = G(0);
      env(low.frequency, tb, [[0, 3200], [2.2, 80]], true); env(e.gain, tb, [[0, (recorded ? 0.6 : 1.3)], [3.2, 0.0001]], true);
      chain(noise('pink', tb, tb + 3.3), low, e, body);
      thud(tb, recorded ? 1.0 : 1.5, 1.6, body);
      const floor = G(0);
      env(floor.gain, tb, [[0, 0.0001], [0.015, 1.2], [5, 0.0001]], true);
      for (const [f, side] of [[30, -0.7], [32.6, 0.7]]) { const o = O('sine', f); chain(o, P(side), floor); o.start(tb); o.stop(tb + 5.1); }
      chain(floor, shaper(2.4), clear);
      const ce = G(0);
      env(ce.gain, tb, [[0, 1.0], [0.16, 0.0001]], true);
      chain(noise('pink', tb, tb + 0.18), F('lowpass', 2400), ce, clear);
    }
    // the ring going out: air swept upward and away to both sides, doubled against itself
    for (const side of [-0.85, 0.85]) {
      const band = F('bandpass', 300, 1.6), e = G(0), late = ctx.createDelay(0.02);
      env(band.frequency, tb, [[0, 300], [1.0, 5200 + 400 * side]], true); env(late.delayTime, tb, [[0, 0.005], [1.0, 0.001]]);
      env(e.gain, tb, [[0, 0.0001], [0.03, 0.8], [1.15, 0.0001]], true);
      chain(noise('white', tb, tb + 1.2), band, e, shaper(3), G(0.5), P(side), clear); chain(band, late, e);
    }
    // What is left in the air is a wail: wind slowed, heard through four narrow gaps a tritone apart that start high and
    // sink more than an octave as it dies, each wavering; torn, and mostly from far off.
    {
      const wailIn = G(7), e = G(0), after = G(0.75), src = play('wind', { at: tb, loop: true, rate: 0.5, to: wailIn });
      if (src) src.stop(tb + 7.1); else noise('pink', tb, tb + 7.1).connect(wailIn);
      for (const f of [311.1, 440, 622.3, 880]) {
        const band = F('bandpass', f, 22), l = O('sine', 0.3 + 0.5 * R());
        env(band.frequency, tb, [[0, f * 1.3], [0.25, f], [6.8, f * 0.35]], true);
        chain(l, G(f * 0.03), band.frequency); l.start(tb); l.stop(tb + 7.1);
        chain(wailIn, band, e);
      }
      env(e.gain, tb, [[0, 0.0001], [0.05, 1], [3, 0.8], [6.8, 0.0001]], true);
      chain(e, shaper(4), after, clear); chain(after, G(1.8), roomIn);
    }
    play('far', { at: tb + 0.9, gain: 0.4, rate: 0.7, low: 1200, to: clear, shape: [[0, 1], [3, 0.4], [8, 0.01]] });
    // what it held, thrown: each piece goes by with a whip of air
    for (let n = Math.min(9, had > 3 ? 2 + had / 12 : 0), q = 0; q < n; q++) {
      const when = tb + 0.02 + 0.5 * R(), band = F('bandpass', 800, 3), e = G(0);
      env(band.frequency, when, [[0, 700 + 500 * R()], [0.1, 3200 + 1500 * R()], [0.24, 1000]], true); swell(e.gain, when, 0.24, 0.3, 0.7);
      chain(noise('white', when, when + 0.26), band, e, P(R() * 1.8 - 0.9), clear);
    }
  }

  // ---- the whirlwind
  let gale = null;
  /** Static: a scatter of sharp ticks, thick at first. */
  function crackle(at, lasts, level, to = mix) {
    for (let n = Math.floor(lasts * 90), q = 0; q < n; q++) {
      const s = ctx.createBufferSource(), when = at + lasts * R() ** 1.5;
      s.buffer = grain; s.playbackRate.value = 0.5 + 1.2 * R();
      chain(s, F('bandpass', 900 + 1600 * R(), 0.8), G(level * (0.3 + 0.7 * R())), P(R() * 1.6 - 0.8), to); s.start(when);
    }
  }
  /** Thunder a little way off: no crack, only its roll. */
  function mutter(level, pan) {
    const at = t();
    if (!play('far', { at, gain: 0.35 * level, rate: 0.75 + 0.4 * R(), low: 900, pan, air: 0.3, shape: [[0, 1], [1.5, 0.5], [5, 0.01]] })) {
      const e = G(0);
      env(e.gain, at, [[0, 0.0001], [0.08, 0.5 * level], [2.2, 0.0001]], true);
      send(chain(noise('brown', at, at + 2.3), F('lowpass', 220), e, P(pan)), { air: 0.3 });
    }
  }
  function galeBegin(place) {
    if (gale) galeEnd(gale, 0.1);
    const at = t(), h = hear(place), stuff = [];
    // all of its roar is driven a little and its low end lifted; how loud it is, is set after that
    const bus = G(0), post = G(0.05), shelf = F('lowshelf', 110), out = G(1), pan = P(h.pan * 0.7), rough = G(1), growl = O('sine', 27), growlDepth = G(0);
    shelf.gain.value = 11;
    chain(growl, growlDepth, rough.gain); growl.start(at);
    chain(bus, rough, G(1.0), shaper(3), post, shelf, out, pan, mix); chain(out, G(0.3), roomIn);
    // (a floor under it that does not turn with it: two notes at the bottom of hearing, a hair apart; these are not torn)
    const floorG = G(0), floor = [[33, -0.6], [35.2, 0.6]].map(([f, side]) => { const o = O('sine', f); chain(o, P(side), floorG); o.start(at); return o; });
    chain(floorG, shaper(2.2), G(0.3), out);
    env(bus.gain, at, [[0, 0], [0.25, 1]]);
    // recordings, each on its own level: hard gusts and the open wind slowed (its body), the ground, stone and timber
    // carried round, fire rumbling and rushing, a fast stream
    const loop = (name, rate, low = 0) => { const g = G(0), s = play(name, { at, loop: true, rate, low, to: g }); g.connect(bus); if (s) stuff.push(s); return { g, s, rate }; };
    const gusts = loop('gusts', 0.7), wind = loop('wind', 0.55), quake = loop('quake', 0.7, 200), quake2 = loop('quake', 0.42, 140), deepfire = loop('firetex', 0.35, 300), grind = loop('grind', 0.9), stress = loop('stress', 0.7), fireA = loop('firetex', 0.8), fireB = loop('firewind', 1), rush = loop('rush', 1);
    // made here: its roar, low, chopped by its own turning; its middle, going round from ear to ear; the hiss of what it carries
    const chop = G(1), roarG = G(0), turn = O('sine', 3.2), flutter = O('sine', 13.5), low = noise('brown', at);
    chain(turn, G(0.35), chop.gain); chain(flutter, G(0.2), chop.gain); turn.start(at); flutter.start(at);
    chain(low, F('lowpass', 200, 0.9), chop, roarG, bus);
    const midG = G(0), midPan = P(0), round = O('sine', 1.6), mid = noise('pink', at);
    chain(round, G(0.9), midPan.pan); round.start(at); chain(mid, F('bandpass', 520, 0.7), midG, midPan, bus);
    const hissG = G(0), hissPan = P(0), round2 = O('sine', 2.3), hiss = noise('white', at);
    chain(round2, G(-0.9), hissPan.pan); round2.start(at); chain(hiss, F('highpass', 3500), hissG, hissPan, bus);
    // its voice: wind whistling, heard through three narrow gaps that waver; this is not torn, and comes from far off too
    const howlIn = G(5), howlG = G(0), voice = play('whistle', { at, loop: true, to: howlIn }) ?? noise('pink', at);
    if (!buffers.whistle) voice.connect(howlIn);
    const howls = [392, 587.3, 784].map((f, i) => { const band = F('bandpass', f, 14), l = O('sine', 0.21 + 0.13 * i); chain(l, G(f * 0.05), band.frequency); l.start(at); chain(howlIn, band, howlG); return l; });
    chain(howlG, out); chain(howlG, G(1.2), roomIn);
    gale = { growlDepth, floorG, quake2, deepfire, bus, post, out, pan, gusts, wind, quake, grind, stress, fireA, fireB, rush, roarG, turn, midG, hissG, howlG, written: 0, stuff: [...stuff, growl, ...floor, turn, flutter, low, round, mid, round2, hiss, voice, ...howls] };
    // the air snatched in toward the place
    const band = F('bandpass', 300, 1.2), e = G(0);
    env(band.frequency, at, [[0, 300], [0.9, 2600]], true); swell(e.gain, at, 1.1, 0.5 * (0.4 + 0.6 * h.near), 1.6);
    send(chain(noise('pink', at, at + 1.15), band, e, P(h.pan * 0.6)), { air: 0.3 });
  }
  /** Each frame while it is there. `p`: how fully (0 to 1); and where, what it has taken up, and how many pieces of buildings. */
  function galeFeed(place, p, written, fire, frost, spout, held, lifting, dt) {
    const v = gale, at = t(), c = 0.1, h = hear(place), near = Math.max(0, 1 - h.d / 80), taken = Math.min(1, held / 40);
    v.pan.pan.setTargetAtTime(h.pan * 0.7, at, 0.1);
    v.post.gain.setTargetAtTime((0.03 + 0.2 * p * p) * (0.5 + 0.5 * near) * (1 + 0.35 * fire), at, c);
    v.growlDepth.gain.setTargetAtTime(0.4 * p, at, c); v.floorG.gain.setTargetAtTime(0.5 * p * p * (0.4 + 0.6 * near), at, c);
    v.quake2.g.gain.setTargetAtTime(1.3 * p * (0.5 + 0.5 * near), at, c); v.deepfire.g.gain.setTargetAtTime(0.7 * p, at, c);
    pre.gain.setTargetAtTime(0.5 + 0.2 * p * near, at, 0.2);
    // (as it draws back up, all of it runs down)
    const run = lifting ? 0.55 + 0.45 * p : 1;
    for (const l of [v.gusts, v.wind, v.quake, v.grind, v.fireA]) l.s?.playbackRate.setTargetAtTime(l.rate * run * (1 + 0.15 * p), at, c);
    v.gusts.g.gain.setTargetAtTime(2.2 * p, at, c); v.wind.g.gain.setTargetAtTime(1.4 * p, at, c); v.quake.g.gain.setTargetAtTime(1.5 * p * (0.5 + 0.5 * near), at, c);
    v.grind.g.gain.setTargetAtTime(0.25 * p + 0.5 * taken, at, 0.3); v.stress.g.gain.setTargetAtTime(0.5 * taken, at, 0.3);
    v.fireA.g.gain.setTargetAtTime(1.0 * fire, at, 0.2); v.fireB.g.gain.setTargetAtTime(0.6 * fire, at, 0.2); v.rush.g.gain.setTargetAtTime(0.8 * spout * p, at, 0.2);
    v.roarG.gain.setTargetAtTime(1.4 * p, at, c); v.midG.gain.setTargetAtTime(1.7 * p, at, c); v.hissG.gain.setTargetAtTime(0.22 * p + 0.2 * frost + 0.12 * spout, at, c);
    v.turn.frequency.setTargetAtTime((2.5 + 1.2 * p) * run, at, c);
    v.howlG.gain.setTargetAtTime(0.5 * p * (1 + frost) * (0.3 + 0.7 * near), at, c);
    // its three rings, each a swish as it is written
    while (v.written < 3 && written > [0.1, 0.4, 0.7][v.written]) seal(1 + 2 * v.written++, at, 0.6 * (0.4 + 0.6 * near), true);
    // fire in it spits; frost in it is broken ice, falling without end
    if (fire > 0.2 && R() < dt * 45 * fire) { const s = ctx.createBufferSource(); s.buffer = grain; s.playbackRate.value = 0.4 + 0.9 * R(); chain(s, F('bandpass', 900 + 2500 * R(), 1.5), G((0.2 + 0.5 * R()) * fire * near), P(h.pan + R() - 0.5), mix); s.start(at); }
    if (frost > 0.2 && R() < dt * 22 * frost && !play('ice', { at, gain: 0.3 * frost * near, rate: 0.8 + 1.5 * R(), pan: h.pan + R() - 0.5, air: 0.3 })) { const s = ctx.createBufferSource(); s.buffer = grain; s.playbackRate.value = 2 + 2 * R(); chain(s, F('highpass', 5000), G(0.3 * frost * near), P(h.pan + R() - 0.5), mix); s.start(at); }
    beds.gain.setTargetAtTime(1 - 0.75 * p, at, 0.3);
  }
  function galeEnd(v, over) { const at = t(); v.bus.gain.cancelScheduledValues(at); v.bus.gain.setTargetAtTime(0, at, over / 3); v.howlG.gain.setTargetAtTime(0, at, over / 3); for (const s of v.stuff) s.stop(at + over * 2 + 0.05); beds.gain.setTargetAtTime(1, at, 1.5); pre.gain.setTargetAtTime(0.5, at, 0.5); v.floorG.gain.setTargetAtTime(0, at, over / 3); if (gale === v) gale = null; }
  /** The stroke of lightning that brings it down: seen, then heard, as thunder is; and the funnel slammed to the ground after it. */
  function galeStrike(place) {
    const at = t(), { d, pan, near } = hear(place), level = 0.35 + 0.65 * near, tb = at + Math.min(d / 343, 0.25), recorded = Boolean(buffers.boom);
    const clap = G(level), lift = F('lowshelf', 120);
    lift.gain.value = 9;
    send(chain(clap, lift, P(pan * 0.5)), { air: 0.35, hills: 0.7 });
    play('deep', { at: tb, gain: 1.0, rate: 0.5, to: clap, shape: [[0, 1], [2, 0.5], [6, 0.01]] });
    play('quake', { at: tb, gain: 1.2, rate: 0.6, low: 220, to: clap, shape: [[0, 1], [1.5, 0.6], [5, 0.01]] });
    { const floor = G(0); env(floor.gain, tb, [[0, 0.0001], [0.015, 1.2], [4, 0.0001]], true); for (const [f, side] of [[30, -0.7], [32.6, 0.7]]) { const o = O('sine', f); chain(o, P(side), floor); o.start(tb); o.stop(tb + 4.1); } chain(floor, shaper(2.4), clap); }
    // the crack: the air torn, three times in a tenth of a second, each lower than the last
    for (const [after, lasts, cut, amount] of [[0, 0.07, 2200, 1.2], [0.035, 0.1, 1200, 0.9], [0.09, 0.2, 500, 0.8]]) {
      const e = G(0);
      env(e.gain, tb + after, [[0, amount], [lasts, 0.0001]], true);
      chain(noise('white', tb + after, tb + after + lasts + 0.02), F('highpass', cut), e, clap);
    }
    crackle(tb, 0.18, 0.5 * level);
    // its body, and then its roll, going away
    play('boom', { at: tb, gain: 1.0, rate: 1.2, to: clap });
    play('slam', { at: tb, gain: 0.9, rate: 0.7, to: clap });
    play('dark', { at: tb + 0.02, gain: 0.7, rate: 0.8, to: clap, shape: [[0, 1], [1.5, 0.3], [4, 0.001]] });
    play('far', { at: tb + 0.25, gain: 0.7, rate: 0.8, to: clap, shape: [[0, 1], [3, 0.5], [8, 0.01]] });
    play('tail', { at: tb + 0.1, gain: 0.5, rate: 0.7, to: clap, shape: [[0, 1], [2, 0.6], [6, 0.1], [12, 0.002]] });
    play('deep', { at: tb + 0.6, gain: 0.5, rate: 0.6, low: 700, pan: -pan, to: clap });
    thud(tb, recorded ? 1.2 : 1.6, 1.6, clap);
    if (!recorded) { const low = F('lowpass', 3000, 0.6), e = G(0); env(low.frequency, tb, [[0, 3000], [2.5, 120]], true); env(e.gain, tb, [[0, 1.1], [3.5, 0.0001]], true); chain(noise('pink', tb, tb + 3.6), low, e, clap); }
    // and the funnel comes down: drawn breath, then the ground struck
    const land = at + 0.3;
    intake('deep', at, 0.3, { rate: 0.7, gain: 0.7 * level });
    const ground = G(level), groundLift = F('lowshelf', 120);
    groundLift.gain.value = 9; chain(ground, groundLift, mix);
    thud(land, 1.5, 1.4, ground);
    play('slam', { at: land, gain: 1.0, rate: 0.4, to: ground });
    play('dark', { at: land, gain: 0.8, rate: 0.5, to: ground, shape: [[0, 1], [1.5, 0.3], [4, 0.001]] });
  }

  // ---- the four plain spells
  /** A sound that lasts as long as something is held: its own way out, its own place from side to side, and all that must stop with it. */
  const voice = (sends = { air: 0.2 }) => {
    const bus = G(0), out = P(0), stuff = [];
    send(chain(bus, out), sends);
    return {
      bus, out, stuff,
      /** A recording going round and round, on its own level. */
      loop(name, o = {}) { const g = G(0), s = play(name, { ...o, at: t(), loop: true, to: g }); g.connect(bus); if (s) stuff.push(s); return { g, s, rate: o.rate ?? 1 }; },
      /** Noise through whatever is given, on its own level. */
      noise(kind, ...through) { const n = noise(kind, t()), g = G(0); stuff.push(n); chain(n, ...through, g, bus); return g; },
      /** Something that swings a value to and fro. */
      swing(f, depth, param) { const o = O('sine', f); chain(o, G(depth), param); o.start(t()); stuff.push(o); return o; },
      place(p) { const h = hear(p); out.pan.setTargetAtTime(h.pan * 0.8, t(), 0.1); return h; },
      end(over = 0.3) { const at = t(); bus.gain.cancelScheduledValues(at); bus.gain.setTargetAtTime(0, at, over / 3); for (const s of stuff) s.stop(at + over * 2 + 0.05); },
    };
  };
  const to = (param, value, k = 0.08) => param.setTargetAtTime(value, t(), k);
  /** One short piece of a recording, somewhere, if it is there. */
  const shot = (names, o) => play(names[Math.floor(R() * names.length)], o);
  let flame = null, drawn = null, jet = null, bloom = null, blaze = null, blazeLook = 0, blazeAmount = 0, crack = 0, boom = 0, sprout = 0, jetAge = 0, bloomAge = 0;

  // Fire gathered at the staff: crackle close by, and under it a roar that grows as it is held.
  function flameFeed(c) {
    if (!flame) {
      const v = voice({ air: 0.15 });
      v.stove = v.loop('stove', { rate: 1.15 }); v.tex = v.loop('firetex', { rate: 0.7, low: 600 });
      v.roar = v.noise('pink', F('bandpass', 320, 0.6)); v.low = v.noise('brown', F('lowpass', 130));
      flame = v;
    }
    to(flame.stove.g.gain, 0.6 + 0.9 * c); to(flame.tex.g.gain, 1.0 * c); to(flame.roar.gain, 0.12 + 0.5 * c); to(flame.low.gain, 0.2 + 0.8 * c);
    to(flame.bus.gain, 0.3 + 0.5 * c);
  }
  // Wind gathered: the air round about drawn in to the staff, faster the longer it is held.
  function drawnFeed(c) {
    if (!drawn) {
      const v = voice({ air: 0.2 });
      v.gusts = v.loop('gusts', { rate: 0.9 }); v.band = F('bandpass', 500, 0.9); v.air = v.noise('pink', v.band); v.low = v.noise('brown', F('lowpass', 150));
      v.turn = v.swing(1.2, 0.7, v.out.pan);
      drawn = v;
    }
    to(drawn.gusts.g.gain, 1.0 + 1.6 * c); drawn.gusts.s?.playbackRate.setTargetAtTime(0.9 + 0.6 * c, t(), 0.08);
    to(drawn.band.frequency, 500 + 1300 * c); to(drawn.air.gain, 0.15 + 0.5 * c); to(drawn.low.gain, 0.15 + 0.7 * c); to(drawn.turn.frequency, 1.2 + 4 * c);
    to(drawn.bus.gain, 0.5 + 0.6 * c);
  }
  // Frost poured: a hard hissing jet from the staff with a cold wind in it and weight under it; and where it lands, ice
  // forming and breaking, heard from there. Over water the ice is thick, and booms.
  function jetFeed(c, dt) {
    if (!jet) {
      const v = voice({ air: 0.2 }), w = voice({ air: 0.35 });
      v.hiss = v.noise('white', F('bandpass', 4200, 0.6)); v.body = v.noise('pink', F('bandpass', 900, 0.7)); v.low = v.noise('brown', F('lowpass', 170));
      v.whistle = v.loop('whistle', { rate: 1.4 }); v.gusts = v.loop('gusts', { rate: 1.15 }); v.burn = v.loop('iceburn', {});
      v.there = w;
      // (it starts with a rush)
      const e = G(0), at = t(); swell(e.gain, at, 0.45, 0.6, 0.5); send(chain(noise('white', at, at + 0.5), F('highpass', 1800), e), { air: 0.2 });
      jet = v; jetAge = 0; crack = 0.15; boom = 0.6;
    }
    jetAge += dt;
    const v = jet, on = Math.min(1, jetAge / 0.25);
    to(v.hiss.gain, 0.42); to(v.body.gain, 0.4); to(v.low.gain, 0.85); to(v.whistle.g.gain, 0.7); to(v.gusts.g.gain, 0.9); to(v.burn.g.gain, 0.8);
    to(v.bus.gain, 0.75 * on);
    if (!c.target) return;
    const h = v.there.place(c.target), level = 0.35 + 0.65 * h.near, grown = Math.min(1, c.spread / 5.5);
    to(v.there.bus.gain, 1);
    crack -= dt; boom -= dt;
    // ice breaking as it forms, far below its own pitch so that it cracks and does not tinkle; more of it as it spreads
    if (crack <= 0) { crack = (0.14 + 0.3 * R()) / (0.6 + 0.8 * grown); shot(['ice', 'ice3', 'ice4', 'icescrape'], { gain: (0.3 + 0.5 * R()) * level, rate: 0.4 + 0.45 * R(), low: 5000, pan: h.pan + R() * 0.6 - 0.3, to: v.there.bus }); }
    if (boom <= 0) {
      boom = c.water ? 0.7 + 0.8 * R() : 1.5 + 1.5 * R();
      shot(['ice2'], { gain: (c.water ? 0.9 : 0.5) * level, rate: 0.28 + 0.2 * R(), low: 2500, pan: h.pan, to: v.there.bus });
      thud(t(), (c.water ? 0.7 : 0.35) * level, 0.5, v.there.bus);
    }
  }
  // Growth poured: the ground stirring, deep; grass, leaves and tree tops in a breeze that was not there; wood creaking as
  // it grows; and, the longer it is poured, birds. Heard from where it lands.
  function bloomFeed(c, dt) {
    if (!bloom) {
      const v = voice({ air: 0.3 });
      v.quake = v.loop('quake', { rate: 0.5, low: 130 }); v.low = v.noise('brown', F('lowpass', 95));
      v.band = F('bandpass', 1200, 0.8); v.airy = v.noise('pink', v.band); v.swing(0.7, 450, v.band.frequency);
      v.grass = v.loop('grassy', { rate: 1.1 }); v.trees = v.loop('treetops', { high: 300 }); v.birds = v.loop('birds', { high: 1100 }); v.creaks = v.loop('creaks', { rate: 0.8 });
      bloom = v; bloomAge = 0; sprout = 0.2;
      // (it lands with a soft rush of air and leaves)
      const at = t(), h = hear(c.target), e = G(0); swell(e.gain, at, 0.7, 0.35 * (0.4 + 0.6 * h.near), 0.6); send(chain(noise('pink', at, at + 0.75), F('bandpass', 900, 0.8), e, P(h.pan)), { air: 0.3 });
      play('leaves', { gain: 0.5 * (0.4 + 0.6 * h.near), rate: 1.1, pan: h.pan, air: 0.3 });
    }
    bloomAge += dt;
    const v = bloom, h = v.place(c.target), level = 0.4 + 0.6 * h.near, grown = Math.min(1, c.spread / 5.8), k = 0.4;
    to(v.quake.g.gain, 0.7 * grown, k); to(v.low.gain, 0.3 + 0.4 * grown, k); to(v.airy.gain, 0.16, k);
    to(v.grass.g.gain, 1.3, k); to(v.trees.g.gain, 0.9 * grown, k); to(v.creaks.g.gain, 0.9, k);
    // (the birds are not there at once: they come)
    to(v.birds.g.gain, 1.4 * Math.min(1, Math.max(0, bloomAge - 1) / 3.5), 0.6);
    to(v.bus.gain, 0.7 * level, 0.3);
    sprout -= dt;
    if (sprout <= 0) { sprout = 0.25 + 0.4 * R(); shot(['leaves'], { gain: (0.2 + 0.25 * R()) * level, rate: 1.1 + 0.6 * R(), pan: h.pan + R() - 0.5, air: 0.3 }); }
  }
  // Fire burning near them: crackle and a low roar, as much as there is of it within a stone's throw; and it spits.
  function blazeFeed(fire, dt) {
    blazeLook -= dt;
    if (blazeLook <= 0) { blazeLook = 0.25; blazeAmount = Math.min(1, (fire.near(eye.x, eye.z, 26) / 110) ** 0.6 + 0.2 * Math.min(1, fire.burning / 700)); }
    if (!blaze && loaded && blazeAmount > 0.01) {
      const v = voice({ air: 0.25 });
      v.stove = v.loop('stove', { rate: 0.9 }); v.stove2 = v.loop('stove', { rate: 0.62, low: 1800 }); v.tex = v.loop('firetex', { rate: 0.6, low: 700 });
      v.roar = v.noise('pink', F('bandpass', 280, 0.6)); v.low = v.noise('brown', F('lowpass', 140));
      // (nothing here swings a level to and fro: a roar that beats is a rotor, and a swing left running when its level has
      // gone to nothing is still heard)
      to(v.bus.gain, 1, 0.3);
      blaze = v;
    }
    if (!blaze) return;
    const a = blazeAmount, k = 0.5;
    to(blaze.stove.g.gain, 1.1 * a, k); to(blaze.stove2.g.gain, 0.9 * a, k); to(blaze.tex.g.gain, 0.9 * a * a, k); to(blaze.roar.gain, 0.22 * a, k); to(blaze.low.gain, 0.6 * a, k);
    // (and when there is none left, none of it is left)
    to(blaze.bus.gain, a > 0.004 ? 1 : 0, 0.3);
    if (a > 0.05 && R() < dt * 14 * a) { const s = ctx.createBufferSource(); s.buffer = grain; s.playbackRate.value = 0.35 + 0.8 * R(); chain(s, F('bandpass', 800 + 2200 * R(), 1.5), G((0.15 + 0.45 * R()) * a), P(R() * 1.6 - 0.8), mix); s.start(t()); }
  }
  /** Something that happens at an instant. */
  function cue(what, o) {
    const at = t();
    if (what === 'fireBurst') hushed(5 + 6 * o.big, 6 + 6 * o.big); else if (what === 'windThrow') hushed(3, 5);
    if (what === 'fireThrow') {
      // thrown: a rush of flame leaving, and the kick of it
      const c = o.charge, band = F('bandpass', 1800, 0.9), e = G(0);
      env(band.frequency, at, [[0, 1800], [0.5, 260]], true); env(e.gain, at, [[0, 0.0001], [0.03, 0.5 + 0.5 * c], [0.65, 0.0001]], true);
      send(chain(noise('pink', at, at + 0.7), band, e), { air: 0.25 });
      play('swoosh', { at, gain: 0.6 + 0.5 * c, rate: 1.15 - 0.25 * c, air: 0.25, shape: [[0, 1], [0.8, 0.25], [1.7, 0.001]] });
      thud(at, 0.35 + 0.7 * c, 0.5, mix);
    } else if (what === 'fireBurst') {
      // landed: a blow, a ball of fire taking, and the ground told of it; bigger for a bolt held longer
      const { d, pan, near } = hear(o.p), big = o.big, level = (0.35 + 0.65 * near) * (0.55 + 0.45 * big), tb = at + Math.min(d / 343, 0.12);
      const hit = G(level), lift = F('lowshelf', 120);
      lift.gain.value = 7;
      send(chain(hit, lift, P(pan * 0.6)), { air: 0.3, hills: 0.4 });
      env(pre.gain, tb, [[0, 0.5], [0.004, 0.5 + 0.3 * big], [0.4, 0.5 + 0.3 * big], [1.5, 0.5]]);
      const ce = G(0); env(ce.gain, tb, [[0, 0.9], [0.09, 0.0001]], true); chain(noise('white', tb, tb + 0.1), F('highpass', 800), ce, hit);
      play('boom', { at: tb, gain: 0.8, rate: 1.2 - 0.3 * big, to: hit, shape: [[0, 1], [0.8, 0.3], [2.2, 0.001]] });
      play('fireball', { at: tb, gain: 0.7, rate: 1.1 - 0.2 * big, to: hit, shape: [[0, 1], [1, 0.3], [3, 0.001]] });
      play('deep', { at: tb, gain: 0.7 * big, rate: 0.8, to: hit, shape: [[0, 1], [1, 0.3], [3, 0.001]] });
      play('slam', { at: tb, gain: 0.5 + 0.4 * big, rate: 0.65, to: hit });
      thud(tb, 0.8 + 0.5 * big, 0.9, hit);
      const le = G(0), low = F('lowpass', 2600, 0.6); env(low.frequency, tb, [[0, 2600], [1.2, 160]], true); env(le.gain, tb, [[0, buffers.boom ? 0.4 : 1.0], [1.6, 0.0001]], true); chain(noise('pink', tb, tb + 1.7), low, le, hit);
      for (let k = 0; k < 24; k++) { const s = ctx.createBufferSource(); s.buffer = grain; s.playbackRate.value = 0.35 + 0.8 * R(); chain(s, F('bandpass', 900 + 2200 * R(), 1.5), G((0.15 + 0.4 * R()) * level), P(pan + R() - 0.5), mix); s.start(tb + 0.1 + 1.6 * R() ** 1.5); }
      // (on water it is put out at once: steam)
      if (o.water) { const e = G(0); swell(e.gain, tb, 1.4, 0.5 * level, 0.5); send(chain(noise('white', tb, tb + 1.5), F('highpass', 2200), e, P(pan)), { air: 0.3 }); }
    } else if (what === 'windThrow') {
      // thrown: one great push of air going away from them, low first, with the grass and leaves it takes
      const c = o.charge, push = G(0.6 + 0.6 * c), lift = F('lowshelf', 120);
      lift.gain.value = 8;
      send(chain(push, lift), { air: 0.3, hills: 0.3 });
      env(pre.gain, at, [[0, 0.5], [0.004, 0.5 + 0.3 * c], [0.5, 0.5 + 0.3 * c], [1.6, 0.5]]);
      thud(at, 0.9 + 0.6 * c, 0.8, push);
      play('deep', { at, gain: 0.5 * c, rate: 1.0, low: 320, to: push, shape: [[0, 1], [0.8, 0.3], [2, 0.001]] });
      play('slam', { at, gain: 0.3 + 0.4 * c, rate: 0.55, low: 500, to: push });
      const band = F('bandpass', 700, 0.7), e = G(0); env(band.frequency, at, [[0, 700], [1.0, 180]], true); env(e.gain, at, [[0, 0.0001], [0.05, 1.0], [1.3, 0.0001]], true); chain(noise('pink', at, at + 1.4), band, e, push);
      const he = G(0); env(he.gain, at, [[0, 0.0001], [0.04, 0.3], [0.6, 0.0001]], true); chain(noise('white', at, at + 0.65), F('highpass', 2500), he, push);
      const g = play('gusts', { at, loop: true, gain: 1.6, rate: 1.3, to: push, shape: [[0, 0.2], [0.12, 1], [1.8, 0.001]] }); g?.stop(at + 1.9);
      play('leaves', { at: at + 0.12, gain: 0.5, rate: 0.9, air: 0.3 });
    } else if (what === 'treeShake') {
      const h = hear(o), level = 0.35 + 0.65 * h.near;
      play('leaves', { at, gain: 0.7 * level, rate: 0.75 + 0.3 * R(), pan: h.pan, air: 0.3 });
      const g = play('treetops', { at, loop: true, gain: 1.2 * level, rate: 1.2, pan: h.pan, air: 0.3, shape: [[0, 0.1], [0.2, 1], [1.8, 0.001]] }); g?.stop(at + 1.9);
    }
  }

  // ---- their own footsteps
  const STEPS = { grass: 'grassstep', stone: 'stonestep', dirt: 'dirtstep', snow: 'snowstep', ash: 'ashstep', water: 'dirtstep' };
  // (with no recordings: the five steps on grass that come with the game, shaped to stand for the rest)
  const SHAPED = { grass: {}, dirt: { low: 2600, rate: 0.9 }, stone: { rate: 1.25 }, snow: { low: 3500, rate: 0.72 }, ash: { rate: 1.1 }, water: { low: 2600, rate: 0.9 } };
  const lastTake = {};
  let foot = 1, dipWas = null, groundedWas = true;
  /** What is under their feet: water, ground a spell froze or burnt, something built, the path, or grass. */
  function underfoot(world, walker) {
    const f = walker.feet, S = world.state, g = world.ground(f.x, f.z);
    if (g < world.water - 0.02) return 'water';
    const i = Math.floor((f.x - S.x0) / S.cell), j = Math.floor((f.z - S.z0) / S.cell);
    if (i >= 0 && j >= 0 && i < S.N && j < S.N) { const k = (j * S.N + i) * 4; if (S.data[k + 1] > 110) return 'snow'; if (S.data[k] > 110) return 'ash'; }
    if (world.walk && world.walk(f.x, f.z) > g + 0.03) return 'stone';
    return world.pathAt(f.x, f.z) > 0.5 ? 'dirt' : 'grass';
  }
  /** One step. `hard`: 0 strolling to 1 at a run. Never the same recording twice running; each foot a little to its own side. */
  const stepsAt = [];
  function step(surface, hard, at = t()) {
    foot = -foot;
    // (for the measuring tools: when each was heard, and on what)
    if (stepsAt.length < 400) stepsAt.push([Math.round(at * 1000) / 1000, surface]);
    let take;
    do take = 1 + Math.floor(R() * 8); while (take === lastTake[surface]);
    lastTake[surface] = take;
    const o = { at, gain: (0.17 + 0.13 * hard) * (0.85 + 0.3 * R()), rate: 0.94 + 0.12 * R(), pan: 0.14 * foot, air: 0.08 };
    if (!play(STEPS[surface] + take, o)) play(`free${1 + Math.floor(R() * 5)}`, { ...o, ...SHAPED[surface], rate: o.rate * (SHAPED[surface].rate ?? 1) });
    if (surface === 'water') {
      const e = G(0);
      swell(e.gain, at, 0.32, 0.22 + 0.2 * hard, 0.45);
      send(chain(noise('white', at, at + 0.35), F('bandpass', 1400 + 900 * R(), 0.9), e, P(0.14 * foot)), { air: 0.1 });
      const s = play('rush', { at, loop: true, gain: 0.5, rate: 1.3, pan: 0.14 * foot, shape: [[0, 0.1], [0.05, 1], [0.35, 0.001]] });
      s?.stop(at + 0.4);
    }
  }
  function stepFeed(world, walker) {
    // (the eye is lowest three quarters of the way through each rise and fall: that is when a foot is down)
    const dip = Math.floor((walker.stride * BOB) / (2 * Math.PI) - 0.75), at = t();
    if (dipWas !== null && dip !== dipWas && walker.grounded && walker.speed > 0.8) step(underfoot(world, walker), Math.min(1, walker.speed / 6.6));
    dipWas = dip;
    if (walker.grounded && !groundedWas) {
      // down from a jump: both feet, a moment apart, and the weight of it
      const s = underfoot(world, walker);
      step(s, 1, at); step(s, 1, at + 0.035);
      if (s === 'stone') play(`landstep${1 + Math.floor(R() * 3)}`, { at, gain: 0.3, air: 0.1 });
      thud(at, 0.12 + 0.2 * walker.landed, 0.25, mix);
    } else if (!walker.grounded && groundedWas) {
      // up: cloth, and the air
      const e = G(0);
      swell(e.gain, at, 0.28, 0.07, 0.5);
      chain(noise('pink', at, at + 0.3), F('bandpass', 700, 0.8), e, mix);
    }
    groundedWas = walker.grounded;
  }

  // ---- the place, and how it answers
  let place = null, lookIn = 0, life = 1, quietFor = 0;
  const RING = [[0, 0], ...[5, 11, 18].flatMap((r) => Array.from({ length: 8 }, (_, i) => [Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r]))];
  /** Something has happened that birds fly from: they are not heard for so many seconds, and then come back slowly. */
  let backIn = 16;
  // (`back`: how long they take to return: a long while after anything great, a few seconds after a small thing)
  const hushed = (seconds, back = 16) => { if (seconds >= quietFor) backIn = quietFor > 0 ? Math.max(backIn, back) : back; quietFor = Math.max(quietFor, seconds); };
  function placeFeed(world, walker, dt) {
    if (!loaded) return;
    if (!place) {
      const v = voice({ to: beds });
      v.birds = v.loop('birds', { high: 1100 }); v.trees = v.loop('treetops', { high: 300 }); v.grass = v.loop('grassy', {}); v.lake = v.loop('lake', {});
      v.cold = v.loop('whistle', { rate: 1.2 }); v.mill = v.loop('creaks', { rate: 0.6 });
      to(v.bus.gain, 0.55, 1);
      place = v;
    }
    // (gone in under a second; back over the better part of a minute)
    quietFor = Math.max(0, quietFor - dt);
    const want = quietFor > 0 || blazeAmount > 0.08 ? 0 : 1;
    life += (want - life) * Math.min(1, dt / (want > life ? backIn : 0.5));
    lookIn -= dt;
    if (lookIn > 0) return;
    lookIn = 0.25;
    // what is round about: how much of the ground near is burnt, frozen, overgrown, under water; how near a tree in leaf; the mill
    const f = walker.feet, S = world.state;
    let burnt = 0, frozen = 0, lush = 0, wet = 0, near = 0;
    for (let n = 0; n < RING.length; n++) {
      const x = f.x + RING[n][0], z = f.z + RING[n][1];
      if (world.ground(x, z) < world.water) wet++;
      if (n > 16) continue;
      const i = Math.floor((x - S.x0) / S.cell), j = Math.floor((z - S.z0) / S.cell);
      if (i < 0 || j < 0 || i >= S.N || j >= S.N) continue;
      const k = (j * S.N + i) * 4;
      if (S.data[k] > 110) burnt++; if (S.data[k + 1] > 110) frozen++; if (S.data[k + 3] > 110) lush++;
    }
    burnt /= 17; frozen /= 17; lush /= 17; wet /= RING.length;
    for (let i = 1; i < world.trees.length; i++) { const tr = world.trees[i]; if (tr.down || tr.burnt > 0.8 || !tr.clumps?.length) continue; near = Math.max(near, 1 - (Math.hypot(tr.x - f.x, tr.z - f.z) - (tr.r ?? 2) - 1) / 12); }
    near = Math.max(0, Math.min(1, near));
    const mill = Math.max(0, 1 - Math.hypot(SITES.mill[0] - f.x, SITES.mill[1] - f.z) / 22), k = 1.2;
    to(place.birds.g.gain, 2.4 * life * (1 - 0.85 * frozen) * (1 - 0.8 * burnt) * (1 + 0.5 * lush), k);
    to(place.trees.g.gain, 0.8 * near * (0.2 + 0.8 * life), k);
    to(place.grass.g.gain, 0.8 * world.grassAt(f.x, f.z) * (1 - burnt) * (1 - frozen), k);
    to(place.lake.g.gain, 1.0 * Math.min(1, wet * 2.5) ** 0.7, k);
    to(place.cold.g.gain, 0.45 * frozen, k);
    to(place.mill.g.gain, 0.7 * mill, k);
  }

  // ---- what is watched, each frame
  let keyWas = null;
  let pitWas = 'idle', pitGust = false, pitHeard = null, galeWas = 'idle', flashWas = 0;
  let was = 'idle', gustDue = false, brokeBefore = 0, debrisAt = 0, heard = null, volume = 1, quiet = false, T = 0, rendering = null;
  return {
    ctx, ready,
    /** The sound card wakes at the first key or click: until then a page may make no sound. */
    wake() { if (!offline && ctx.state === 'suspended') ctx.resume(); },
    sleep() { if (!offline && ctx.state === 'running') ctx.suspend(); },
    get volume() { return volume; }, set volume(v) { volume = v; out.gain.setTargetAtTime(quiet ? 0 : 0.9 * v, t(), 0.03); },
    get quiet() { return quiet; }, set quiet(v) { quiet = v; out.gain.setTargetAtTime(v ? 0 : 0.9 * volume, t(), 0.03); },
    cue, stepsAt,
    update(dt, { blast, hole, twister, ruin, camera, fire, cast, world, walker }) {
      const m = camera.matrixWorld.elements;
      eye.x = camera.position.x; eye.y = camera.position.y; eye.z = camera.position.z; eye.rx = m[0]; eye.rz = m[2];
      if (world && walker) { stepFeed(world, walker); placeFeed(world, walker, dt); }
      // (the birds leave for anything violent, and for as long as it lasts)
      if (blast.phase === 'gather' || blast.phase === 'fall' || hole.phase !== 'idle' || twister.phase !== 'idle') hushed(10);
      if (cast?.pour === 'frost') hushed(3, 5);
      if (cast) {
        // a different spell taken up: a small swish, and no more
        if (keyWas && cast.key !== keyWas) seal(['fire', 'frost', 'wind', 'growth', 'explosion', 'singularity', 'tornado'].indexOf(cast.key) % 6, t(), 0.3, true);
        keyWas = cast.key;
        if (cast.key === 'fire' && cast.holding) flameFeed(cast.charge); else if (flame) { flame.end(0.12); flame = null; }
        if (cast.key === 'wind' && cast.holding) drawnFeed(cast.charge); else if (drawn) { drawn.end(0.12); drawn = null; }
        if (cast.pour === 'frost') jetFeed(cast, dt); else if (jet) { jet.end(0.35); jet.there.end(0.8); jet = null; }
        if (cast.pour === 'growth' && cast.target) bloomFeed(cast, dt); else if (bloom) { bloom.end(2.2); bloom = null; }
      }
      if (fire) blazeFeed(fire, dt);
      const tw = twister.phase;
      if (tw !== galeWas) {
        if (tw === 'gather') galeBegin(twister.base);
        else if (tw === 'slam') galeStrike(twister.base);
        else if (tw === 'idle' && gale) galeEnd(gale, 0.4);
        galeWas = tw;
      }
      if (tw !== 'idle' && gale) {
        galeFeed(twister.base, twister.power, tw === 'gather' ? twister.power / 0.3 : 1, twister.fire, twister.frost, twister.spout, ruin?.held ?? 0, tw === 'lift', dt);
        // (its lightning, when it flickers: a tick of static, and a mutter after)
        if (twister.flash > 0.55 && flashWas <= 0.55 && tw !== 'slam') { const h = hear(twister.base); mutter((tw === 'gather' ? 0.6 : 1) * (0.3 + 0.7 * h.near), h.pan + R() - 0.5); }
      }
      flashWas = twister.flash;
      const at = hole.phase;
      if (at !== pitWas) {
        if (at === 'open') pitOpen(hole.centre);
        else if (at === 'shut' && pit) pitClose();
        else if (at === 'burst') { pitHeard = hear(hole.centre); pitBurst(hole.centre); pitGust = true; }
        else if (at === 'idle' && pit) pitShut(pit);
        pitWas = at;
      }
      if ((at === 'open' || at === 'shut') && pit) pitFeed(hole.grip, hole.closing, ruin?.held ?? 0, dt);
      if (at === 'burst' && pitGust && hole.shockR >= pitHeard.d) { pitGust = false; gust(0.7, pitHeard.pan); }
      const phase = blast.phase;
      if (phase !== was) {
        if (phase === 'gather') begin();
        else if (phase === 'fade') cancel();
        else if (phase === 'fall') fall();
        else if (phase === 'boom') { hushed(14); heard = hear(blast.centre); impact(blast.centre); gustDue = true; brokeBefore = ruin?.broken ?? 0; debrisAt = t() + 0.42; }
        was = phase;
      }
      if (phase === 'gather' && gathering) charge(blast.charge);
      if (phase === 'boom') {
        if (gustDue && blast.shockR >= heard.d) { gustDue = false; gust(Math.min(1, blast.shockP * 1.2), heard.pan); }
        if (debrisAt && t() >= debrisAt) { const n = (ruin?.broken ?? 0) - brokeBefore; debrisAt = 0; if (n > 4) debris(Math.min(1, 0.25 + n / 200), heard.pan); }
      }
    },
    /** With no sound card: lets `dt` of it be worked out, and waits until it has been. */
    async advance(dt) { T += dt; const there = ctx.suspend(T); if (rendering) ctx.resume(); else rendering = ctx.startRendering(); await there; },
    /** With no sound card: works out the rest and gives all of it back as a WAV file, in base64. */
    async finish() {
      ctx.resume();
      const b = await rendering, n = b.length, data = new DataView(new ArrayBuffer(44 + n * 4)), L = b.getChannelData(0), Rr = b.getChannelData(1);
      const text = (at, s) => { for (let i = 0; i < s.length; i++) data.setUint8(at + i, s.charCodeAt(i)); };
      text(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); text(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
      data.setUint32(24, RATE, true); data.setUint32(28, RATE * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); text(36, 'data'); data.setUint32(40, n * 4, true);
      let peak = 0;
      for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])); data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true); }
      const bytes = new Uint8Array(data.buffer); let s = '';
      for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return { wav: btoa(s), peak };
    },
  };
}
