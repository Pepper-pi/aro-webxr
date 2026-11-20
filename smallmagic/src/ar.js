// Camera-AR layer. A painted park plate stands in for the live camera when no
// webcam is available, so the same composition can be checked on a desktop.
// A real environment camera replaces that plate when the browser allows it.
// WebXR immersive-ar is requested when the device supports it; the plate stays
// if the session is refused.
import * as THREE from 'three';

function paintPark(dusk) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 432;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 280);
  if (dusk) {
    sky.addColorStop(0, '#2a2458');
    sky.addColorStop(0.55, '#c47a62');
    sky.addColorStop(1, '#f0c49a');
  } else {
    sky.addColorStop(0, '#7eb6e8');
    sky.addColorStop(0.62, '#d7e7f6');
    sky.addColorStop(1, '#f6e2c4');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 768, 300);
  g.fillStyle = dusk ? '#3d6a45' : '#6eae62';
  g.fillRect(0, 286, 768, 146);
  g.fillStyle = dusk ? '#2f5538' : '#4f8d49';
  for (let i = 0; i < 18; i++) {
    g.fillRect(i * 46, 300 + (i % 3) * 8, 28, 70);
  }
  g.fillStyle = dusk ? '#c4a07a' : '#d8c39a';
  g.beginPath();
  g.moveTo(330, 432);
  g.lineTo(390, 300);
  g.lineTo(470, 432);
  g.fill();
  const trees = [[90, 250], [210, 236], [520, 242], [660, 254]];
  for (const [x, y] of trees) {
    g.fillStyle = dusk ? '#6a4634' : '#8a5a3c';
    g.fillRect(x - 6, y, 12, 52);
    g.fillStyle = dusk ? '#2f6a48' : '#3e9a55';
    g.beginPath();
    g.arc(x, y, 38, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = dusk ? '#3f8a58' : '#7dcc6a';
    g.beginPath();
    g.arc(x - 10, y - 8, 16, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = dusk ? '#ffd2a8' : '#fff4c8';
  g.beginPath();
  g.arc(620, 78, 28, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAR(scene, camera, world, zones) {
  const root = new THREE.Group();
  root.name = 'ar-layer';
  root.visible = false;
  scene.add(root);
  const dayMap = paintPark(false);
  const duskMap = paintPark(true);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshBasicMaterial({ map: dayMap, side: THREE.DoubleSide }),
  );
  plate.name = 'ar-plate';
  plate.frustumCulled = false;
  root.add(plate);
  const rift = new THREE.Group();
  rift.name = 'ar-rift';
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.11, 10, 48),
    new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }),
  );
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.045, 8, 40),
    new THREE.MeshBasicMaterial({ color: '#7ee0ff', transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }),
  );
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 1.2, 40),
    new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 28),
    new THREE.MeshBasicMaterial({ color: '#140c28', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
  );
  rift.add(mouth, glow, arch, inner);
  for (let i = 0; i < 16; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.04), new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff6dc' : '#9af6ff' }));
    const a = (i / 16) * Math.PI * 2;
    tick.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0.04);
    tick.rotation.z = a + Math.PI / 2;
    rift.add(tick);
  }
  const riftSparks = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
    rift.add(s);
    riftSparks.push(s);
  }
  root.add(rift);
  const life = [];
  for (let i = 0; i < 10; i++) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 5),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#f2c14e' : '#e07a9a' }),
    );
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), new THREE.MeshBasicMaterial({ color: '#3e8a4a' }));
    stem.position.y = -0.12;
    flower.add(stem);
    root.add(flower);
    life.push({ mesh: flower, a: i * 0.7, r: 1.3 + (i % 4) * 0.45, bob: i });
  }
  for (let i = 0; i < 4; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + (i % 2) * 0.05, 0), new THREE.MeshBasicMaterial({ color: '#c4b49a' }));
    root.add(stone);
    life.push({ mesh: stone, a: i * 1.4 + 0.4, r: 2.1 + i * 0.25, bob: -1 });
  }
  const lakeMotes = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 5, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd7a8' : '#9fe7ff', transparent: true, opacity: 0.8, depthWrite: false }),
    );
    m.visible = false;
    root.add(m);
    lakeMotes.push(m);
  }
  const motes = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.03, 0),
      new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.85 }),
    );
    root.add(m);
    motes.push(m);
  }
  const grade = document.getElementById('arGrade');
  const button = document.getElementById('ar');
  let on = false;
  let riftLife = 0;
  let goals = [];
  let video = null;
  let videoTex = null;
  let gyro = { pitch: 0, roll: 0 };
  let anchored = [];
  const saved = new Map();

  addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    gyro.pitch = Math.max(-0.35, Math.min(0.35, (e.beta - 50) * 0.004));
    gyro.roll = Math.max(-0.4, Math.min(0.4, (e.gamma || 0) * 0.004));
  });

  function groundKit(b) {
    if (b.g.getObjectByName('arshadow')) return;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 18),
      new THREE.MeshBasicMaterial({ color: '#140e0a', transparent: true, opacity: 0.42, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.06;
    shadow.scale.setScalar(1.35);
    shadow.name = 'arshadow';
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.045, 8, 28),
      new THREE.MeshBasicMaterial({ color: '#f1d9a4', transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    ring.name = 'arring';
    b.g.add(shadow, ring);
  }

  function plant(walker) {
    const live = zones.live().filter((b) => !b.dead && b.where === 'meadow' && (b.model || b.kind === 'wolf'));
    const pick = ['boar', 'slime', 'goblin'].map((k) => live.find((b) => b.kind === k)).filter(Boolean).slice(0, 2);
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = fz;
    const rz = -fx;
    anchored = [];
    pick.forEach((b, i) => {
      const depth = 2.05 + i * 0.08;
      const side = i === 0 ? 0.28 : -0.32;
      const x = walker.feet.x + fx * depth + rx * side;
      const z = walker.feet.z + fz * depth + rz * side;
      const y = world.ground(x, z);
      if (!saved.has(b.n)) saved.set(b.n, true);
      zones.anchor(b.n, x, y, z, Math.atan2(-fx, -fz));
      groundKit(b);
      const shadow = b.g.getObjectByName('arshadow');
      const ring = b.g.getObjectByName('arring');
      if (shadow) shadow.visible = true;
      if (ring) ring.visible = true;
      anchored.push(b);
    });
    const lead = anchored[0];
    goals = anchored.map((b) => {
      const prev = b.g.scale.x || 1;
      b.g.scale.setScalar(0.58);
      return { x: b.g.position.x, y: b.g.position.y, z: b.g.position.z, scale: prev };
    });
    if (lead) {
      const depth = 3.15;
      rift.position.set(walker.feet.x + fx * depth, walker.feet.y + 1.35, walker.feet.z + fz * depth);
      rift.scale.setScalar(1.35);
      rift.lookAt(walker.feet.x, walker.feet.y + 1.45, walker.feet.z);
    }
  }

  function clearPlants() {
    for (const b of anchored) {
      b.g.getObjectByName('arshadow') && (b.g.getObjectByName('arshadow').visible = false);
      b.g.getObjectByName('arring') && (b.g.getObjectByName('arring').visible = false);
      const g = goals[anchored.indexOf(b)];
      if (g?.scale) b.g.scale.setScalar(g.scale);
      zones.releaseAnchor(b.n);
    }
    anchored = [];
    goals = [];
    saved.clear();
  }

  async function tryFeed() {
    if (video || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      videoTex = new THREE.VideoTexture(video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      plate.material.map = videoTex;
      plate.material.needsUpdate = true;
    } catch { /* the painted park stays */ }
  }

  async function tryXR(renderer) {
    if (!navigator.xr?.isSessionSupported) return false;
    try {
      if (!(await navigator.xr.isSessionSupported('immersive-ar'))) return false;
      const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['local-floor', 'hit-test'] });
      renderer.xr.enabled = true;
      await renderer.xr.setSession(session);
      session.addEventListener('end', () => { renderer.xr.enabled = false; });
      return true;
    } catch {
      return false;
    }
  }

  function set(next, walker, renderer) {
    on = !!next;
    root.visible = on;
    if (world.root) world.root.visible = !on;
    grade?.classList.toggle('on', on);
    button?.classList.toggle('on', on);
    if (button) button.textContent = on ? 'Field' : 'AR';
    if (!on) {
      clearPlants();
      riftLife = 0;
      if (video) {
        video.srcObject?.getTracks?.().forEach((t) => t.stop());
        video = null;
        videoTex = null;
        plate.material.map = zones.dusk ? duskMap : dayMap;
      }
      return;
    }
    riftLife = 3.4;
    rift.scale.setScalar(0.2);
    if (walker) plant(walker);
    tryFeed();
    if (renderer) tryXR(renderer);
  }

  function update(dt, walker) {
    if (!on || !walker) return;
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const eyeY = walker.feet.y + 1.55;
    plate.position.set(walker.feet.x + fx * 7.4, eyeY - 0.35, walker.feet.z + fz * 7.4);
    plate.lookAt(walker.feet.x, plate.position.y, walker.feet.z);
    plate.rotateZ(-gyro.roll);
    plate.rotateX(gyro.pitch);
    plate.material.map = videoTex || (zones.dusk ? duskMap : dayMap);
    plate.material.color.set(zones.atLake ? '#f6e2c0' : zones.dusk ? '#ffd0c4' : '#fff3e0');
    grade?.classList.toggle('dusk', !!zones.dusk);
    const t = performance.now() * 0.001;
    life.forEach((p) => {
      const depth = 2.4 + p.r;
      const side = Math.sin(p.a) * p.r;
      const x = walker.feet.x + fx * depth + fz * side;
      const z = walker.feet.z + fz * depth - fx * side;
      p.mesh.position.set(x, world.ground(x, z) + (p.bob < 0 ? 0.1 : 0.55 + Math.sin(t + p.bob) * 0.04), z);
    });
    const tint = zones.atLake ? '#ffe0b0' : zones.dusk ? '#e7b0ff' : '#fff1c4';
    lakeMotes.forEach((m, i) => {
      m.visible = !!zones.atLake;
      if (!m.visible) return;
      const a = t * 0.6 + i;
      m.position.set(
        walker.feet.x + fx * (2.2 + (i % 4) * 0.35) + Math.cos(a) * 0.8,
        walker.feet.y + 0.35 + Math.sin(t * 1.4 + i) * 0.08,
        walker.feet.z + fz * (2.2 + (i % 4) * 0.35) + Math.sin(a) * 0.45,
      );
    });
    motes.forEach((m, i) => {
      const a = t * 0.35 + i;
      const rad = 1.2 + (i % 4) * 0.45;
      m.position.set(
        walker.feet.x + fx * (2.2 + (i % 3) * 0.4) + Math.cos(a) * rad,
        walker.feet.y + 0.8 + (i % 5) * 0.38 + Math.sin(t + i) * 0.12,
        walker.feet.z + fz * (2.2 + (i % 3) * 0.4) + Math.sin(a) * rad * 0.35,
      );
      m.material.color.set(tint);
    });
    if (riftLife > 0) {
      riftLife = Math.max(0, riftLife - dt);
      const open = Math.min(1, (3.4 - riftLife) / 0.45);
      rift.scale.setScalar((0.4 + open * 0.7) * 1.7);
      const fade = riftLife < 0.7 ? riftLife / 0.7 : 1;
      rift.visible = fade > 0.02;
      arch.material.opacity = fade;
      inner.material.opacity = fade;
      glow.material.opacity = 0.75 * fade;
      mouth.material.opacity = 0.4 * fade;
      const stepU = Math.min(1, (3.4 - riftLife) / 1.1);
      anchored.forEach((b, i) => {
        const g = goals[i];
        if (!g) return;
        b.g.position.x = g.x + fx * (1 - stepU) * 1.7;
        b.g.position.z = g.z + fz * (1 - stepU) * 1.7;
      });
      arch.rotation.y += dt * 0.4;
      inner.rotation.y -= dt * 0.7;
      riftSparks.forEach((s, i) => {
        const a = t * 1.4 + i;
        s.position.set(Math.cos(a) * (0.8 + (i % 3) * 0.08), 0.2 + Math.sin(a) * 0.7, Math.sin(t * 2 + i) * 0.08);
      });
    } else rift.visible = false;
    for (const b of anchored) {
      const ring = b.g.getObjectByName('arring');
      if (ring) ring.rotation.z += dt * 0.6;
    }
  }

  return {
    get on() { return on; },
    set, update, plant,
    get gyro() { return gyro; },
  };
}
