// Summoner. The staff class. A grimoire of spirit cells: the staff beam catches a
// creature onto a page, and a full page is cast to let that spirit out. Pages
// recharge like cells. Spirits are ghostly CC0 creatures. No puppets and no strings.
import * as THREE from 'three';

const FILES = {
  fox: 'mobs/cc0/fox.glb', bunny: 'mobs/cc0/bunny.glb', deer: 'mobs/cc0/deer.glb',
  wolf: 'mobs/cc0/wolf.glb', cow: 'mobs/cc0/cow.glb', crab: 'mobs/cc0/crab.glb', fish: 'mobs/cc0/fish.glb',
};
const NAMES = { fox: 'fox', bunny: 'bunny', deer: 'deer', wolf: 'wolf', cow: 'cow', crab: 'crab', fish: 'fish' };
const PAGES = 3;

function ghost(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      const copy = m.clone();
      copy.transparent = true;
      copy.opacity = 0.58;
      copy.depthWrite = false;
      if (copy.color) copy.color.set('#d7c8ff');
      if (copy.emissive) { copy.emissive.set('#9a7cff'); copy.emissiveIntensity = 0.4; }
      return copy;
    });
    o.material = next.length === 1 ? next[0] : next;
  });
}

export function createSummoner({ scene, world, zones, walker, camera, staff, beam }) {
  const pages = Array.from({ length: PAGES }, () => ({ kind: null, fill: 0, cool: 0 }));
  const spirits = [];
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#c9b6ff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
  );
  aura.visible = false;
  scene.add(aura);
  const tip = new THREE.Vector3();
  const aim = new THREE.Vector3();
  let cache = null;
  let catching = false;
  let auraT = 0;
  const magic = {};

  function standIn() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: '#d7c8ff', transparent: true, opacity: 0.7, depthWrite: false }));
    body.position.y = 0.32;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), new THREE.MeshBasicMaterial({ color: '#140e0a', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(body, shadow);
    return g;
  }
  async function wear(spirit) {
    if (!cache) {
      cache = {};
      try {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const utils = await import('three/addons/utils/SkeletonUtils.js');
        const loader = new GLTFLoader();
        for (const kind of Object.keys(FILES)) {
          try { cache[kind] = { gltf: await loader.loadAsync(new URL(FILES[kind], document.baseURI).href), clone: utils.clone }; } catch { /* stand-in */ }
        }
      } catch { return; }
    }
    const row = cache[spirit.kind];
    if (!row || spirit.worn) return;
    spirit.worn = true;
    const model = row.clone(row.gltf.scene);
    const box = new THREE.Box3().setFromObject(model);
    const h = Math.max(0.2, box.max.y - box.min.y);
    model.scale.multiplyScalar(0.8 / h);
    model.position.y -= box.min.y * model.scale.y;
    ghost(model);
    spirit.g.add(model);
  }
  function openPage() {
    return pages.find((p) => p.cool <= 0 && !p.kind);
  }
  function fullPage() {
    return pages.find((p) => p.kind && p.fill >= 1 && p.cool <= 0);
  }
  function prey() {
    let best = null;
    let dist = 14;
    const fx = Math.sin(walker.yaw);
    const fz = Math.cos(walker.yaw);
    for (const b of zones.beasts()) {
      if (b.dead || !FILES[b.kind]) continue;
      const dx = b.x - walker.feet.x;
      const dz = b.z - walker.feet.z;
      const d = Math.hypot(dx, dz);
      if (d > dist || d < 0.4) continue;
      if (dx * fx + dz * fz < d * 0.25) continue;
      best = b;
      dist = d;
    }
    return best;
  }
  function catchStart() { catching = true; }
  function catchStop() { catching = false; if (beam) beam.set(tip, tip, 0, 0, 0, [0, 0, 0], [0, 0, 0], 0); }
  function summon() {
    if (spirits.length >= 2) { zones.toast?.('Two spirits are already out.'); return; }
    const page = fullPage();
    if (!page) { zones.toast?.('No full page. Catch a spirit with the staff.'); return; }
    const g = standIn();
    scene.add(g);
    const spirit = { kind: page.kind, g, life: 16, bite: 0.4, worn: false };
    spirits.push(spirit);
    wear(spirit);
    g.position.set(walker.feet.x + 0.8, walker.feet.y, walker.feet.z + 0.6);
    page.kind = null;
    page.fill = 0;
    page.cool = 8;
    zones.toast?.(`The ${NAMES[spirit.kind]} page opens.`);
  }
  function update(dt, on) {
    for (const p of pages) if (p.cool > 0) p.cool = Math.max(0, p.cool - dt);
    if (!on) {
      if (catching) catchStop();
      catching = false;
      aura.visible = false;
      for (const s of spirits) s.g.visible = false;
      return;
    }
    for (const s of spirits) s.g.visible = true;
    const target = prey();
    if (catching) {
      const page = openPage();
      if (target && page && staff && camera) {
        staff.tip(camera, tip);
        aim.set(target.x, target.y + 0.6, target.z);
        beam?.set(tip, aim, 0.12, 0.015, 0.22, [0.45, 0.28, 1], [0.92, 0.82, 1], 1.1);
        staff.cast?.('#c9a6ff', 0.85, page.fill, 0, dt);
        page.fill = Math.min(1, page.fill + dt * 0.5);
        if (page.fill >= 1 && !page.kind) {
          page.kind = target.kind;
          zones.toast?.(`${NAMES[target.kind]} caught on a page.`);
        }
      }
    } else if (staff) staff.cast?.('#c9a6ff', spirits.length ? 0.35 : 0.12, 0, 0, dt);
    const foe = magic.foe?.();
    for (let i = spirits.length - 1; i >= 0; i--) {
      const s = spirits[i];
      s.life -= dt;
      let tx = walker.feet.x + Math.sin(s.life + i) * 1.4;
      let tz = walker.feet.z + 1.1;
      if (foe) { tx = foe.x; tz = foe.z; }
      else if (target) { tx = target.x; tz = target.z; }
      s.g.position.x += (tx - s.g.position.x) * Math.min(1, dt * 2.6);
      s.g.position.z += (tz - s.g.position.z) * Math.min(1, dt * 2.6);
      const y = world.ground(s.g.position.x, s.g.position.z);
      s.g.position.y += (y - s.g.position.y) * Math.min(1, dt * 6);
      s.bite -= dt;
      if (s.bite <= 0 && Math.hypot(tx - s.g.position.x, tz - s.g.position.z) < 1.7) {
        s.bite = 0.9;
        zones.hurt([{ x: s.g.position.x, z: s.g.position.z, r: 1.25, d: 8, k: 'arcane' }]);
        magic.wound?.(8, s.g.position.x, s.g.position.z);
      }
      if (s.life <= 0) { scene.remove(s.g); spirits.splice(i, 1); }
    }
    aura.visible = spirits.length > 0;
    aura.position.set(walker.feet.x, walker.feet.y + 0.9, walker.feet.z);
    aura.material.opacity = 0.08 + Math.sin(performance.now() * 0.003) * 0.04;
    if (spirits.length) {
      auraT -= dt;
      if (auraT <= 0) {
        auraT = 1.25;
        zones.heal(4);
        magic.mendPet?.(3);
      }
    }
    const el = document.getElementById('summonerNote');
    if (el) {
      el.hidden = false;
      const cells = pages.map((p) => (p.cool > 0 ? `${p.cool.toFixed(0)}s` : p.kind ? p.kind : p.fill > 0.05 ? `${Math.round(p.fill * 100)}%` : '·')).join(' ');
      el.textContent = `Pages ${cells}${spirits.length ? ' · mend' : ''}`;
    }
  }

  return {
    catchStart, catchStop, summon, update,
    bind(next) { Object.assign(magic, next); },
    get catching() { return catching; },
    get fill() {
      const page = pages.find((p) => p.fill > 0 && p.fill < 1) || pages.find((p) => p.kind);
      return page ? page.fill : 0;
    },
    get out() { return spirits.length; },
  };
}
