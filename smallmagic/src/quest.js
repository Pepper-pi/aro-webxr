// A short loop in the meadow: fell two beasts, pick up what they drop, walk back to the ring.
import * as THREE from 'three';

export function createQuest({ scene, world, walker, zones }) {
  const hud = document.createElement('div');
  hud.id = 'quest';
  hud.style.cssText = 'position:fixed;left:50%;top:max(54px,env(safe-area-inset-top));transform:translateX(-50%);z-index:8;color:#f6ead0;font:15px Georgia,serif;letter-spacing:.04em;text-shadow:0 1px 2px #000;pointer-events:none;text-align:center;';
  document.body.appendChild(hud);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;z-index:12;background:rgba(8,6,16,.45);color:#fff6dc;font:34px Georgia,serif;pointer-events:none;';
  document.body.appendChild(banner);
  let xp = 0, level = 1, fell = 0, phase = 'hunt', downT = 0, shown = '';
  const seen = new Set();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: '#ffd56a' }));
  gem.visible = false;
  scene.add(gem);
  const flash = (text) => {
    banner.style.display = 'grid';
    banner.textContent = text;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { banner.style.display = 'none'; }, 1400);
  };
  return {
    get level() { return level; },
    get xp() { return xp; },
    get phase() { return phase; },
    update() {
      if (!zones || zones.name !== 'meadow') { hud.hidden = true; return; }
      hud.hidden = false;
      for (const b of zones.beasts()) {
        if (!b.dead || seen.has(b.n)) continue;
        seen.add(b.n);
        fell += 1;
        xp += 1;
        if (fell === 2 && phase === 'hunt') {
          gem.position.set(b.x, world.ground(b.x, b.z) + 0.55, b.z);
          gem.visible = true;
          phase = 'loot';
        }
      }
      if (phase === 'loot' && gem.visible) {
        gem.rotation.y += 0.08;
        if (Math.hypot(walker.feet.x - gem.position.x, walker.feet.z - gem.position.z) < 1.4) {
          gem.visible = false;
          xp += 2;
          phase = 'back';
        }
      }
      if (phase === 'back') {
        const r = zones.ring;
        if (r && Math.hypot(walker.feet.x - r.x, walker.feet.z - r.z) < 2.4) {
          phase = 'won';
          flash('Quest complete');
        }
      }
      const need = level * 3;
      if (xp >= need) { level += 1; xp = 0; flash('Level up'); }
      if (zones.hearts <= 0) {
        downT += 1;
        if (downT === 8) flash('Down');
        if (downT > 50) {
          walker.place(world.start.x, world.start.z, world.start.yaw || 0);
          zones.heal();
          downT = 0;
        }
      } else downT = 0;
      const text = phase === 'hunt' ? `Fell 2 beasts (${Math.min(fell, 2)}/2) · Lv ${level} · ${xp} XP`
        : phase === 'loot' ? `Pick up the spoils · Lv ${level} · ${xp} XP`
        : phase === 'back' ? `Return to the ring · Lv ${level} · ${xp} XP`
        : `Done · Lv ${level}`;
      if (text !== shown) { shown = text; hud.textContent = text; }
    },
  };
}
