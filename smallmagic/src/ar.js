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
    new THREE.TorusGeometry(1.25, 0.07, 8, 36, Math.PI),
    new THREE.MeshBasicMaterial({ color: '#ffe7a4', transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
  );
  arch.rotation.z = Math.PI;
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.035, 6, 32, Math.PI),
    new THREE.MeshBasicMaterial({ color: '#7ee0ff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  inner.rotation.z = Math.PI;
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  rift.add(glow, arch, inner);
  for (let i = 0; i < 14; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.03), new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff6dc' : '#9af6ff' }));
    const a = Math.PI + (i / 13) * Math.PI;
    tick.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0.02);
    tick.rotation.z = a - Math.PI / 2;
    rift.add(tick);
  }
  const riftSparks = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
    rift.add(s);
    riftSparks.push(s);
  }
  root.add(rift);
  const motes = [];
  for (let i = 0; i < 16; i++) {
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
    shadow.position.y = 0.03;
    shadow.name = 'arshadow';
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.64, 28),
      new THREE.MeshBasicMaterial({ color: '#f1d9a4', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.045;
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
      const depth = 4.15 + i * 0.2;
      const side = i === 0 ? 0.95 : -1.05;
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
    const other = anchored[1];
    if (lead) {
      const ax = other ? (lead.g.position.x + other.g.position.x) * 0.5 : lead.g.position.x;
      const az = other ? (lead.g.position.z + other.g.position.z) * 0.5 : lead.g.position.z;
      const ay = Math.max(lead.g.position.y, other ? other.g.position.y : lead.g.position.y);
      rift.position.set(ax + fx * 0.35, ay + 1.85, az + fz * 0.35);
      rift.scale.setScalar(1.15);
      rift.lookAt(walker.feet.x, walker.feet.y + 1.3, walker.feet.z);
    }
  }

  function clearPlants() {
    for (const b of anchored) {
      b.g.getObjectByName('arshadow') && (b.g.getObjectByName('arshadow').visible = false);
      b.g.getObjectByName('arring') && (b.g.getObjectByName('arring').visible = false);
      zones.releaseAnchor(b.n);
    }
    anchored = [];
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
    grade?.classList.toggle('dusk', !!zones.dusk);
    const tint = zones.dusk ? '#e7b0ff' : '#fff1c4';
    const t = performance.now() * 0.001;
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
      arch.material.opacity = 0.95 * fade;
      inner.material.opacity = 0.8 * fade;
      glow.material.opacity = 0.28 * fade;
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
