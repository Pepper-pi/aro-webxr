// Warden keeps the party standing. A totem soaks hits, a bubble covers an ally,
// a snare holds a beast, and a calm aura slows the next wind-up. No leading slam.
import * as THREE from 'three';

export function createWarden({ scene, camera, world, zones, walker, pets, ground }) {
  const gy = (x, z) => (ground ? ground(x, z) : world.ground(x, z));
  const totem = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6), new THREE.MeshBasicMaterial({ color: '#8a9a78' }));
  post.position.y = 0.35;
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 18), new THREE.MeshBasicMaterial({ color: '#f1d9a4', transparent: true, opacity: 0.9 }));
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.04;
  totem.add(post, rune);
  totem.visible = false;
  scene.add(totem);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), new THREE.MeshBasicMaterial({ color: '#d7e4f2', transparent: true, opacity: 0.28, depthWrite: false }));
  bubble.visible = false;
  scene.add(bubble);
  const snare = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.92, 20), new THREE.MeshBasicMaterial({ color: '#6a8f4a', side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
  snare.rotation.x = -Math.PI / 2;
  snare.visible = false;
  scene.add(snare);
  const aura = new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 12), new THREE.MeshBasicMaterial({ color: '#c9d7b8', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.BackSide }));
  aura.visible = false;
  scene.add(aura);
  let note = 'Warden';
  let onKit = false;
  let pool = 0;
  let totemT = 0;
  let bubbleT = 0;
  let bubbleLeft = 0;
  let snareT = 0;
  let calmT = 0;
  let wound = null;

  function ahead(dist) {
    const yaw = walker.yaw;
    return { x: walker.feet.x + Math.sin(yaw) * dist, z: walker.feet.z + Math.cos(yaw) * dist, yaw };
  }

  function plantTotem() {
    const at = ahead(1.6);
    totem.position.set(at.x, gy(at.x, at.z), at.z);
    totem.visible = true;
    totemT = 14;
    pool = 36;
    note = 'Warden · the ward stands';
  }

  function shield() {
    bubbleT = 8;
    bubbleLeft = 18;
    bubble.visible = true;
    note = pets?.root?.visible ? 'Warden · bubble on your pet' : 'Warden · bubble on you';
  }

  function root() {
    const at = ahead(2.4);
    snare.position.set(at.x, gy(at.x, at.z) + 0.03, at.z);
    snare.visible = true;
    snareT = 8;
    note = 'Warden · roots take the ground';
  }

  function calm() {
    calmT = 8;
    aura.visible = true;
    note = 'Warden · the field slows';
  }

  function soak(n) {
    let left = n;
    if (totemT > 0 && pool > 0 && Math.hypot(walker.feet.x - totem.position.x, walker.feet.z - totem.position.z) < 4.6) {
      const use = Math.min(pool, left);
      pool -= use;
      left -= use;
      note = pool > 0 ? `Warden · ward soaks ${Math.round(use)}` : 'Warden · the ward is spent';
    }
    if (bubbleT > 0 && bubbleLeft > 0 && left > 0) {
      const use = Math.min(bubbleLeft, left);
      bubbleLeft -= use;
      left -= use;
      note = 'Warden · the bubble takes the hit';
    }
    return Math.max(0, left);
  }

  function use(key) {
    if (key === 'totem') plantTotem();
    else if (key === 'bubble') shield();
    else if (key === 'snare') root();
    else if (key === 'calm') calm();
  }

  function update(dt, on) {
    onKit = !!on;
    if (!on) { totemT = 0; bubbleT = 0; snareT = 0; calmT = 0; }
    if (totemT > 0) totemT = Math.max(0, totemT - dt);
    if (totemT <= 0) { totem.visible = false; pool = 0; }
    else rune.material.opacity = 0.45 + Math.sin(performance.now() * 0.003) * 0.25;
    if (bubbleT > 0) bubbleT = Math.max(0, bubbleT - dt);
    bubble.visible = on && bubbleT > 0 && bubbleLeft > 0;
    if (bubble.visible) {
      const pet = pets?.root;
      if (pet?.visible) bubble.position.set(pet.position.x, pet.position.y + 0.55, pet.position.z);
      else bubble.position.set(walker.feet.x, walker.feet.y + 1.1, walker.feet.z);
      bubble.material.opacity = 0.16 + Math.sin(performance.now() * 0.004) * 0.06;
    }
    if (snareT > 0) snareT = Math.max(0, snareT - dt);
    snare.visible = on && snareT > 0;
    if (snare.visible) {
      zones.stir?.((b) => {
        if (Math.hypot(b.g.position.x - snare.position.x, b.g.position.z - snare.position.z) < 1.35) b.rooted = 0.45;
      });
    }
    if (calmT > 0) calmT = Math.max(0, calmT - dt);
    aura.visible = on && calmT > 0;
    if (aura.visible) {
      aura.position.set(walker.feet.x, walker.feet.y + 1.1, walker.feet.z);
      aura.material.opacity = 0.05 + Math.sin(performance.now() * 0.002) * 0.02;
      zones.stir?.((b) => {
        if (Math.hypot(b.g.position.x - walker.feet.x, b.g.position.z - walker.feet.z) < 6.5) b.calm = 0.5;
      });
    }
    const el = document.getElementById('wardenNote');
    if (el) {
      el.hidden = !on;
      if (on) el.textContent = note;
    }
  }

  return {
    use, plantTotem, shield, root, calm, soak, update,
    bash() { plantTotem(); },
    raise() { calm(); },
    get note() { return note; },
    get guard() { return calmT; },
    get calm() { return calmT > 0 ? Math.min(1, calmT / 8) : 0; },
    aura() { return calmT > 0 ? 0.45 : 0; },
    bind(next) { wound = next?.wound || wound; },
  };
}
