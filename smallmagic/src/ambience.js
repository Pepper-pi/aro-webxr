// Opt-in bed. Generated in the browser. Off until asked. No recordings.
const KEY = 'aro-ambience';

export function createAmbience() {
  let ctx = null;
  let master = null;
  let noise = null;
  let crackle = null;
  let water = null;
  let rain = null;
  let breeze = null;
  let chime = null;
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch { /* stay quiet */ }

  function noiseBuffer(audio) {
    const len = audio.sampleRate * 2;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  function layer(audio, type, freq) {
    const src = audio.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = audio.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    return gain;
  }
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    noise = noiseBuffer(ctx);
    crackle = layer(ctx, 'bandpass', 900);
    water = layer(ctx, 'lowpass', 520);
    rain = layer(ctx, 'highpass', 2800);
    breeze = layer(ctx, 'lowpass', 280);
    chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.value = 523;
    const chimeGain = ctx.createGain();
    chimeGain.gain.value = 0;
    chime.connect(chimeGain);
    chimeGain.connect(master);
    chime.start();
    chime.userData = chimeGain;
  }
  function set(next) {
    on = !!next;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (!on && !ctx) return;
    ensure();
    if (!ctx) return;
    ctx.resume?.();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(on ? 0.22 : 0, now, 0.08);
  }
  function scene(kind, raining) {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    const levels = {
      hearth: { crackle: 0.35, water: 0, rain: 0, breeze: 0, chime: 0 },
      water: { crackle: 0, water: 0.28, rain: raining ? 0.18 : 0, breeze: 0.04, chime: 0.012 },
      deck: { crackle: 0, water: 0, rain: 0, breeze: 0.3, chime: 0.006 },
      meadow: { crackle: 0, water: 0.08, rain: 0, breeze: 0.16, chime: 0 },
    };
    const row = levels[kind] || levels.meadow;
    crackle.gain.setTargetAtTime(row.crackle, now, 0.4);
    water.gain.setTargetAtTime(row.water, now, 0.4);
    rain.gain.setTargetAtTime(row.rain, now, 0.3);
    breeze.gain.setTargetAtTime(row.breeze, now, 0.5);
    chime.userData.gain.setTargetAtTime(row.chime, now, 0.6);
    if (kind === 'hearth') crackle.gain.setValueAtTime(0.15 + Math.random() * 0.4, now);
  }
  function harmonic() {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(392, now);
    o.frequency.exponentialRampToValueAtTime(784, now + 0.42);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.75);
  }
  function steep() {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    [494, 659.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const at = now + i * 0.11;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.045, at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g);
      g.connect(master);
      o.start(at);
      o.stop(at + 0.55);
    });
  }
  return { set, scene, harmonic, steep, get on() { return on; } };
}
