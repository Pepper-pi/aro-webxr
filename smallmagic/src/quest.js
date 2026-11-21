// Meadow chain: fell two beasts, pick up a drop, then fell the brute.
export function createQuest({ walker, zones, spells }) {
  const hud = document.createElement('div');
  hud.id = 'quest';
  hud.style.cssText = 'position:fixed;left:50%;top:max(188px,calc(env(safe-area-inset-top) + 176px));transform:translateX(-50%);width:min(220px,70vw);z-index:8;color:#f6ead0;font:12px/1.3 Georgia,serif;letter-spacing:.02em;text-shadow:0 1px 2px #000;pointer-events:none;text-align:center;';
  document.body.appendChild(hud);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;z-index:12;background:rgba(8,6,16,.45);color:#fff6dc;font:34px Georgia,serif;pointer-events:none;';
  document.body.appendChild(banner);
  let xp = 0, level = 1, gold = 0, fell = 0, phase = 'hunt', downT = 0, shown = '', bossN = -1, held = false;
  const seen = new Set();
  const flash = (text, ms = 1400) => {
    banner.style.display = 'grid';
    banner.textContent = text;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { if (phase !== 'won') banner.style.display = 'none'; }, ms);
  };
  const grant = (kind) => {
    held = true;
    if (kind === 'gold') { gold += 1; xp += 2; }
    else if (kind === 'heal') zones.heal(34);
    else if (kind === 'mana') { spells?.refresh(); flash('Charged'); }
    if (phase === 'loot') phase = 'boss';
  };
  return {
    get level() { return level; },
    get xp() { return xp; },
    get gold() { return gold; },
    get phase() { return phase; },
    update() {
      if (!zones || zones.name !== 'meadow') { hud.hidden = true; return; }
      hud.hidden = false;
      for (const kind of zones.collect(walker.feet.x, walker.feet.z)) grant(kind);
      if (phase === 'boss' && bossN >= 0) {
        const boss = zones.beasts().find((b) => b.n === bossN);
        if (boss?.dead) { phase = 'won'; flash('Quest complete', 4000); }
      }
      for (const b of zones.beasts()) {
        if (!b.dead || seen.has(b.n)) continue;
        seen.add(b.n);
        if (b.n === bossN) continue;
        fell += 1;
        xp += 1;
        if (fell >= 2 && phase === 'hunt') phase = held ? 'boss' : 'loot';
      }
      if (phase === 'boss' && bossN < 0) bossN = zones.promote();
      const need = level * 3;
      if (xp >= need) { level += 1; xp -= need; flash('Level up'); }
      if (zones.hearts <= 0 && phase !== 'won') {
        downT += 1;
        if (downT === 8) flash('Down');
        if (downT > 50) {
          const start = walker.world?.start;
          if (start) walker.place(start.x, start.z, start.yaw || 0);
          zones.heal();
          downT = 0;
        }
      } else downT = 0;
      const text = phase === 'hunt' ? `1/3 Fell 2 beasts (${Math.min(fell, 2)}/2) · ${gold} gold · Lv ${level}`
        : phase === 'loot' ? `2/3 Pick up a drop · ${gold} gold · Lv ${level}`
        : phase === 'boss' ? `3/3 Fell the brute · ${gold} gold · Lv ${level}`
        : `Quest complete · Lv ${level} · ${gold} gold`;
      if (text !== shown) { shown = text; hud.textContent = text; }
    },
  };
}
