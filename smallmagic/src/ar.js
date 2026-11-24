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
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 40),
    new THREE.MeshBasicMaterial({ color: '#d7c4a4', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'ar-floor';
  root.add(floor);
  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(6.4, 6.7, 40),
    new THREE.MeshBasicMaterial({ color: '#f1d9a4', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  );
  floorRing.rotation.x = -Math.PI / 2;
  root.add(floorRing);
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.55, 28),
    new THREE.MeshBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.name = 'ar-reticle';
  reticle.visible = false;
  root.add(reticle);
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 512;
  panelCanvas.height = 192;
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.17),
    new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  panel.name = 'ar-hud';
  panel.visible = false;
  panel.renderOrder = 12;
  root.add(panel);
  let panelText = '';
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
  const butterflies = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), new THREE.MeshBasicMaterial({ color: i % 2 ? '#f2c14e' : '#f4fbff', side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    const wingR = wing.clone();
    wing.position.x = 0.22;
    wingR.position.x = -0.22;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: '#5a3a28' }));
    body.scale.set(1, 1, 2.2);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.22, depthWrite: false }));
    g.add(wing, wingR, body, glow);
    g.scale.setScalar(4.2);
    root.add(g);
    butterflies.push({ g, wing, wingR, a: i * 1.3, r: 1.6 + (i % 3) * 0.55 });
  }
  const groundGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 24),
    new THREE.MeshBasicMaterial({ color: '#ffe7b0', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  );
  groundGlow.rotation.x = -Math.PI / 2;
  root.add(groundGlow);
  const glowFar = groundGlow.clone();
  glowFar.material = groundGlow.material.clone();
  glowFar.material.opacity = 0.12;
  glowFar.scale.setScalar(1.85);
  root.add(glowFar);
  const critter = new THREE.Group();
  const bug = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#6a8f4a' }));
  bug.scale.set(1.4, 0.65, 1);
  const bugHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), new THREE.MeshBasicMaterial({ color: '#c6e08a' }));
  bugHead.position.set(0, 0.03, 0.1);
  critter.add(bug, bugHead);
  root.add(critter);
  const motes = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    m.userData.base = new THREE.Color('#fff1c4');
    m.userData.home = { x: 0, z: 0 };
    root.add(m);
    motes.push(m);
  }
  const grade = document.getElementById('arGrade');
  const button = document.getElementById('ar');
  const phone = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 820);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moteN = phone ? 6 : 12;
  const wingN = phone ? 2 : 5;
  let on = false;
  let riftLife = 0;
  let goals = [];
  let video = null;
  let videoTex = null;
  let gyro = { pitch: 0, roll: 0 };
  let wantP = 0;
  let wantR = 0;
  let floorY = 0;
  let anchored = [];
  let greeted = false;
  let shake = 0;
  let bright = 0.7;
  let sampleIn = 0;
  let path = 'park';
  let xrOn = false;
  let xrSession = null;
  let hitSource = null;
  let refSpace = null;
  let viewerSpace = null;
  let latestHit = null;
  let xrRenderer = null;
  let seated = false;
  let localOrigin = false;
  let selectHeld = false;
  let squeezeHeld = false;
  let panelCue = '';
  let floorSet = false;
  let anchorX = 0;
  let anchorZ = 0;
  let cam = null;
  let guestT = 0;
  let guestNoted = false;
  const recenterBtn = document.getElementById('arRecenter');
  const fires = [];
  const critters = [];
  const saved = new Map();
  const sample = document.createElement('canvas');
  sample.width = sample.height = 8;
  const sampleG = sample.getContext('2d', { willReadFrequently: true });
  const hit = new THREE.Vector3();

  addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    // Absolute tilt, never added up, so the floor does not drift.
    wantP = Math.max(-0.9, Math.min(0.65, (e.beta - 55) * 0.016));
    wantR = Math.max(-0.5, Math.min(0.5, (e.gamma || 0) * 0.01));
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

  function seat(mesh, radius = 0.42) {
    if (mesh.getObjectByName('arshadow')) return;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 16),
      new THREE.MeshBasicMaterial({ color: '#140e0a', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.name = 'arshadow';
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.92, radius * 1.15, 22),
      new THREE.MeshBasicMaterial({ color: '#f1d9a4', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.name = 'arring';
    mesh.add(shadow, ring);
  }
  function layHome(walker) {
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const put = (i, rad) => {
      const a = i * 0.9;
      return { x: walker.feet.x + fx * 2.4 + Math.cos(a) * rad, z: walker.feet.z + fz * 2.4 + Math.sin(a) * rad };
    };
    life.forEach((p, i) => { const at = put(i, p.r); p.x = at.x; p.z = at.z; seat(p.mesh, p.bob < 0 ? 0.28 : 0.16); });
    butterflies.forEach((b, i) => {
      const at = put(i + 3, b.r);
      b.x = at.x;
      b.z = at.z;
      b.g.visible = !phone || i < wingN;
    });
    motes.forEach((m, i) => {
      const at = put(i, 1.1 + (i % 4) * 0.35);
      m.userData.home.x = at.x;
      m.userData.home.z = at.z;
      m.visible = !phone || i < moteN;
    });
    critter.userData.x = walker.feet.x + fx * 1.8;
    critter.userData.z = walker.feet.z + fz * 1.8;
    seat(critter, 0.28);
  }
  function plant(walker) {
    const live = zones.live().filter((b) => !b.dead && b.where === 'meadow' && (b.model || b.kind === 'wolf' || b.kind === 'fox' || b.kind === 'bunny'));
    const pick = ['wolf', 'fox', 'bunny', 'deer'].map((k) => live.find((b) => b.kind === k)).filter(Boolean).slice(0, 1);
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    anchored = [];
    const depth = 2.2;
    const gx = walker.feet.x + fx * depth;
    const gz = walker.feet.z + fz * depth;
    pick.forEach((b) => {
      if (!saved.has(b.n)) saved.set(b.n, true);
      zones.anchor(b.n, gx, floorY, gz, Math.atan2(-fx, -fz));
      groundKit(b);
      const shadow = b.g.getObjectByName('arshadow');
      const ring = b.g.getObjectByName('arring');
      if (shadow) { shadow.visible = true; shadow.position.y = 0.02; }
      if (ring) ring.visible = true;
      anchored.push(b);
    });
    goals = anchored.map((b) => {
      const prev = b.g.scale.x || 1;
      return { x: gx, y: floorY, z: gz, scale: prev, name: b.kind };
    });
    rift.rotation.set(-Math.PI / 2, 0, 0);
    rift.position.set(gx, floorY + 0.05, gz);
    rift.scale.setScalar(0.2);
    greeted = false;
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
      if (path !== 'xr') path = 'camera';
    } catch { /* the painted park stays */ }
  }

  async function tryXR(renderer) {
    if (!navigator.xr?.isSessionSupported) return false;
    let mode = null;
    try {
      if (await navigator.xr.isSessionSupported('immersive-ar')) mode = 'immersive-ar';
      else if (await navigator.xr.isSessionSupported('immersive-vr')) mode = 'immersive-vr';
    } catch { return false; }
    if (!mode) return false;
    let session = null;
    try {
      session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hit-test'] });
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      localOrigin = false;
      try {
        await renderer.xr.setSession(session);
      } catch {
        renderer.xr.setReferenceSpaceType('local');
        localOrigin = true;
        await renderer.xr.setSession(session);
      }
      xrRenderer = renderer;
      xrSession = session;
      xrOn = true;
      path = 'xr';
      plate.visible = false;
      selectHeld = false;
      session.addEventListener('selectstart', () => {
        selectHeld = true;
        if (!floorSet) {
          const spot = hitPoint(cam);
          if (spot) placeAnchor(spot.x, spot.z, spot.y);
        }
      });
      session.addEventListener('selectend', () => { selectHeld = false; });
      session.addEventListener('squeezestart', () => { squeezeHeld = true; });
      session.addEventListener('squeezeend', () => { squeezeHeld = false; });
      session.addEventListener('end', () => {
        selectHeld = false;
        squeezeHeld = false;
        xrOn = false;
        xrSession = null;
        hitSource = null;
        refSpace = null;
        viewerSpace = null;
        latestHit = null;
        panel.visible = false;
        if (on) { path = videoTex ? 'camera' : 'park'; plate.visible = true; }
        renderer.xr.enabled = false;
      });
      armHitTest(session);
      return true;
    } catch {
      try { session?.end(); } catch { /* already closed */ }
      renderer.xr.enabled = false;
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
      try { xrSession?.end(); } catch { /* the session is already gone */ }
      clearPlants();
      riftLife = 0;
      while (critters.length) root.remove(critters.pop().g);
      while (fires.length) root.remove(fires.pop().g);
      if (recenterBtn) recenterBtn.hidden = true;
      if (video) {
        video.srcObject?.getTracks?.().forEach((t) => t.stop());
        video = null;
        videoTex = null;
        plate.material.map = zones.dusk ? duskMap : dayMap;
      }
      return;
    }
    riftLife = 3.4;
    guestT = 0;
    guestNoted = false;
    floorSet = false;
    floorY = walker ? walker.feet.y + 0.15 : 0;
    if (walker) {
      anchorX = walker.feet.x + Math.sin(walker.yaw) * 2.2;
      anchorZ = walker.feet.z + Math.cos(walker.yaw) * 2.2;
    }
    path = 'park';
    if (recenterBtn) recenterBtn.hidden = false;
    shake = reduced ? 0 : 0.55;
    if (walker) {
      layHome(walker);
      plant(walker);
      anchorX = rift.position.x;
      anchorZ = rift.position.z;
    }
    tryFeed();
    if (renderer) tryXR(renderer);
  }

  function duskNow() {
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  }
  function rollCritters(walker) {
    while (critters.length) {
      const c = critters.pop();
      root.remove(c.g);
    }
    const n = phone ? 1 : 3;
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (let i = 0; i < n; i++) {
      let tier = 'common';
      let shimmer = false;
      let title = 'A small critter';
      try {
        const rolled = livingRoll?.roll?.('critter', livingRoll.context?.('meadow'));
        if (rolled) { tier = rolled.tier || tier; shimmer = !!rolled.shimmer; title = rolled.species?.name || title; }
      } catch { /* a plain critter */ }
      const color = tier === 'mythic' ? '#f2a0ff' : tier === 'epic' ? '#e7c56a' : tier === 'rare' ? '#7ec8ff' : tier === 'uncommon' ? '#9fd4ff' : '#c8e6b0';
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color }));
      body.scale.set(1.2, 0.7, 1);
      body.position.y = 0.12;
      g.add(body);
      if (shimmer) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20), new THREE.MeshBasicMaterial({ color: '#f4e6c4', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        ring.name = 'tell';
        g.add(ring);
      }
      seat(g, 0.2);
      root.add(g);
      const a = i * 2.1;
      critters.push({ g, x: walker.feet.x + fx * 2 + Math.cos(a) * 1.4, z: walker.feet.z + fz * 2 + Math.sin(a) * 1.4, a, title, tier, vx: Math.cos(a) * 0.25, vz: Math.sin(a) * 0.25 });
    }
  }
  let livingRoll = null;
  function hitFloor(origin, dir) {
    const dy = dir?.y || 0;
    if (!on) return null;
    if (dy > -0.04) {
      const flat = Math.hypot(dir.x, dir.z) || 1;
      hit.set(origin.x + (dir.x / flat) * 2.6, floorY, origin.z + (dir.z / flat) * 2.6);
      return hit.clone();
    }
    const t = (floorY - origin.y) / dy;
    if (t < 0.35 || t > 16) return null;
    hit.set(origin.x + dir.x * t, floorY, origin.z + dir.z * t);
    return hit.clone();
  }
  function soften(mesh, camera) {
    const mat = mesh.material;
    if (!mat || !mat.color) return;
    if (!mesh.userData.base) mesh.userData.base = mat.color.clone();
    const dist = camera ? camera.position.distanceTo(mesh.getWorldPosition(hit)) : 3;
    const far = Math.max(0, Math.min(1, (dist - 2.2) / (phone ? 4.2 : 5.6)));
    const baseOp = mesh.userData.op ?? (mat.opacity ?? 1);
    if (mesh.userData.op == null) mesh.userData.op = baseOp;
    mat.transparent = true;
    mat.opacity = baseOp * (1 - far * 0.78);
    mat.color.copy(mesh.userData.base).lerp(new THREE.Color(bright, bright, bright), 0.2);
  }
  function readBright() {
    const dusk = duskNow();
    if (!video || video.readyState < 2 || !sampleG) { bright = dusk ? 0.4 : 0.72; return; }
    try {
      sampleG.drawImage(video, 0, 0, 8, 8);
      const data = sampleG.getImageData(0, 0, 8, 8).data;
      let s = 0;
      for (let i = 0; i < data.length; i += 4) s += data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      bright = (s / (data.length / 4)) / 255;
    } catch { bright = dusk ? 0.4 : 0.72; }
  }
  async function armHitTest(session) {
    // Hit results are read on the WebXR frame Three already delivers. No second session loop.
    try {
      viewerSpace = await session.requestReferenceSpace('viewer');
      refSpace = await session.requestReferenceSpace('local-floor').catch(() => session.requestReferenceSpace('local'));
      hitSource = await session.requestHitTestSource({ space: viewerSpace });
    } catch { hitSource = null; }
  }
  function sampleFrame(frame) {
    if (!frame || !hitSource || !xrOn) return;
    const space = xrRenderer?.xr?.getReferenceSpace?.() || refSpace || viewerSpace;
    const results = frame.getHitTestResults(hitSource);
    if (!results.length) return;
    const pose = results[0].getPose(space);
    if (!pose) return;
    const p = pose.transform.position;
    latestHit = { x: p.x, y: p.y, z: p.z, t: performance.now(), ref: space !== viewerSpace };
  }
  function hitPoint(camera) {
    if (!latestHit || performance.now() - latestHit.t > 250) return null;
    if (latestHit.ref) return new THREE.Vector3(latestHit.x, latestHit.y, latestHit.z);
    if (!camera) return null;
    const local = new THREE.Vector3(latestHit.x, latestHit.y, latestHit.z);
    local.applyMatrix4(camera.matrixWorld);
    return local;
  }
  function viewName() {
    if (xrOn) {
      const vr = xrSession?.mode === 'immersive-vr';
      if (hitSource) return vr ? 'WebXR VR with hit-test' : 'WebXR AR with hit-test';
      return vr ? 'WebXR VR without hit-test' : 'WebXR without hit-test';
    }
    if (on && path === 'camera') return 'iPhone camera';
    return 'desktop park';
  }
  function cue(text) {
    const next = text || '';
    if (next === panelCue) return;
    panelCue = next;
    panelText = '';
  }
  function paintPanel(text) {
    const line = `${text}|${panelCue}`;
    if (line === panelText) return;
    panelText = line;
    const g = panelCanvas.getContext('2d');
    g.clearRect(0, 0, 512, 192);
    g.fillStyle = 'rgba(18, 12, 24, 0.86)';
    g.fillRect(0, 0, 512, 192);
    g.strokeStyle = '#f1d9a4';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 180);
    g.fillStyle = '#f6ead0';
    g.font = '42px Georgia, serif';
    g.fillText(text, 28, 78);
    g.font = '30px Georgia, serif';
    g.fillText(panelCue || 'Look, then tap to cast', 28, 138);
    panelTex.needsUpdate = true;
  }
  function placePanel(camera) {
    panel.visible = seated && xrOn;
    if (!panel.visible || !camera) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    panel.position.copy(camera.position).addScaledVector(dir, 1.2);
    panel.quaternion.copy(camera.quaternion);
    paintPanel(viewName());
  }
  function seat(camera) {
    if (seated || !xrOn || !camera) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const ny = localOrigin ? camera.position.y - 1.4 : 0;
    const nx = camera.position.x + dir.x * 2.2;
    const nz = camera.position.z + dir.z * 2.2;
    shiftCluster(nx - rift.position.x, nz - rift.position.z);
    floorY = ny;
    anchorX = nx;
    anchorZ = nz;
    floorSet = false;
    seated = true;
    anchored.forEach((b, i) => {
      const meadow = goals[i]?.scale || b.g.scale.x || 1;
      b.g.scale.setScalar(meadow / 1.4);
    });
    butterflies.forEach((b) => b.g.scale.setScalar(1));
  }
  function unseat(walker) {
    if (!seated) return;
    butterflies.forEach((b) => b.g.scale.setScalar(4.2));
    seated = false;
    panel.visible = false;
    if (!on) return;
    anchored.forEach((b, i) => {
      const meadow = goals[i]?.scale;
      if (meadow) b.g.scale.setScalar(meadow);
    });
    clearPlants();
    floorSet = false;
    if (!walker) return;
    floorY = walker.feet.y + 0.15;
    layHome(walker);
    plant(walker);
    anchorX = rift.position.x;
    anchorZ = rift.position.z;
    riftLife = 3.4;
    guestT = 0;
    guestNoted = false;
  }
  function shiftCluster(dx, dz) {
    life.forEach((p) => { p.x += dx; p.z += dz; });
    butterflies.forEach((b) => { b.x += dx; b.z += dz; });
    motes.forEach((m) => { m.userData.home.x += dx; m.userData.home.z += dz; });
    critters.forEach((c) => { c.x += dx; c.z += dz; });
    goals.forEach((g) => { g.x += dx; g.z += dz; });
    anchored.forEach((b) => { b.g.position.x += dx; b.g.position.z += dz; });
    rift.position.x += dx;
    rift.position.z += dz;
    critter.userData.x += dx;
    critter.userData.z += dz;
  }
  function placeAnchor(x, z, y) {
    shiftCluster(x - rift.position.x, z - rift.position.z);
    floorSet = true;
    anchorX = x;
    anchorZ = z;
    floorY = y;
    zones.toast?.('The floor is set.');
  }
  function recenter(walker) {
    if (seated && cam) {
      floorSet = false;
      latestHit = null;
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      const nx = cam.position.x + dir.x * 2.2;
      const nz = cam.position.z + dir.z * 2.2;
      shiftCluster(nx - rift.position.x, nz - rift.position.z);
      anchorX = nx;
      anchorZ = nz;
      floorY = localOrigin ? cam.position.y - 1.4 : 0;
      zones.toast?.('Floor recentered.');
      return;
    }
    if (!walker) return;
    floorSet = false;
    latestHit = null;
    const nx = walker.feet.x + Math.sin(walker.yaw) * 2.2;
    const nz = walker.feet.z + Math.cos(walker.yaw) * 2.2;
    shiftCluster(nx - rift.position.x, nz - rift.position.z);
    anchorX = nx;
    anchorZ = nz;
    floorY = walker.feet.y + 0.15;
    zones.toast?.('Floor recentered.');
  }
  const tapNdc = new THREE.Vector2();
  const tapRay = new THREE.Raycaster();
  addEventListener('pointerup', (e) => {
    if (!on || !cam) return;
    if (e.target?.closest?.('button, #settings, #menu, #spells, #petPrompt, #stick, #cast, #spell, #petHud')) return;
    tapNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    tapRay.setFromCamera(tapNdc, cam);
    const guest = anchored[0]?.g?.position;
    if (guest) {
      const spot = hitFloor(tapRay.ray.origin, tapRay.ray.direction);
      if (spot && Math.hypot(spot.x - guest.x, spot.z - guest.z) < 1.1) return;
    }
    const detected = hitPoint(cam);
    const spot = detected || hitFloor(tapRay.ray.origin, tapRay.ray.direction);
    if (spot) placeAnchor(spot.x, spot.z, spot.y);
  });
  recenterBtn?.addEventListener('pointerup', (e) => {
    recenter(lastWalker);
    e.preventDefault();
    e.stopPropagation();
  });
  let lastWalker = null;
  function spawnMark(x, z, color) {
    const cap = phone ? 4 : 8;
    if (fires.length >= cap) return;
    if (fires.some((f) => Math.hypot(f.g.position.x - x, f.g.position.z - z) < 0.7)) return;
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    g.position.set(x, floorY + 0.04, z);
    root.add(g);
    fires.push({ g, life: 2.6, mark: true });
  }
  function spawnFire(x, z) {
    const cap = phone ? 3 : 6;
    if (fires.length >= cap) return;
    if (fires.some((f) => Math.hypot(f.g.position.x - x, f.g.position.z - z) < 0.85)) return;
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: '#ff7a1c', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    for (let i = 0; i < (phone ? 2 : 4); i++) {
      const wisp = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.28), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd27a' : '#ff5a1a', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      wisp.position.set((i - 1) * 0.2, 0.2, 0);
      wisp.userData.i = i;
      g.add(wisp);
    }
    g.position.set(x, floorY + 0.04, z);
    root.add(g);
    fires.push({ g, life: 6 });
  }
  function update(dt, walker, camera, extra) {
    if (!on || !walker) return;
    lastWalker = walker;
    cam = camera || cam;
    livingRoll = extra?.living || livingRoll;
    if (livingRoll && !critters.length) rollCritters(walker);
    const k = 1 - Math.exp(-dt * 7);
    gyro.pitch += (wantP - gyro.pitch) * k;
    gyro.roll += (wantR - gyro.roll) * k;
    const eye = walker.feet.y + 1.55;
    const wantFloor = eye - 1.4;
    if (!seated && !floorSet) floorY += (wantFloor - floorY) * (1 - Math.exp(-dt * 1.4));
    else if (!seated && !hitSource && floorSet && Math.abs(wantFloor - floorY) > 0.08) floorY += (wantFloor - floorY) * (1 - Math.exp(-dt * 0.15));
    const detected = hitPoint(camera);
    reticle.visible = true;
    if (!floorSet) {
      if (detected) reticle.position.set(detected.x, detected.y + 0.02, detected.z);
      else reticle.position.set(anchorX, floorY + 0.02, anchorZ);
      reticle.material.opacity = 0.45 + Math.sin(performance.now() * 0.008) * 0.25;
    } else {
      reticle.position.set(anchorX, floorY + 0.02, anchorZ);
      reticle.material.opacity = 0.72;
    }
    shake = Math.max(0, shake - dt * 0.8);
    const yaw = walker.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const dusk = duskNow();
    plate.visible = !xrOn;
    plate.position.set(walker.feet.x + fx * 7.4, eye - 0.2, walker.feet.z + fz * 7.4);
    plate.lookAt(walker.feet.x, plate.position.y, walker.feet.z);
    plate.rotateZ(-gyro.roll);
    plate.rotateX(gyro.pitch);
    plate.material.map = videoTex || (dusk ? duskMap : dayMap);
    plate.material.color.set(dusk ? '#ffd0c4' : '#fff3e0');
    grade?.classList.toggle('dusk', dusk);
    floor.position.set(walker.feet.x, floorY, walker.feet.z);
    floorRing.position.set(walker.feet.x, floorY + 0.02, walker.feet.z);
    floor.material.color.set(dusk ? '#6a5344' : '#d7c4a4');
    floor.material.opacity = 0.1 + bright * 0.08;
    sampleIn -= dt;
    if (sampleIn <= 0) { sampleIn = 0.45; readBright(); }
    const t = performance.now() * 0.001;
    const cast = extra?.spells?.cast;
    const casting = !!(cast?.holding || cast?.pour || extra?.spells?.busy);
    const pull = extra?.twister?.busy ? extra.twister.base : null;
    const nudge = (item) => {
      if (!casting) return;
      const dx = item.x - walker.feet.x;
      const dz = item.z - walker.feet.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 2.6) { item.x += (dx / d) * dt * 1.4; item.z += (dz / d) * dt * 1.4; }
    };
    life.forEach((p) => {
      p.x += Math.cos(t * 0.15 + p.a) * dt * 0.05;
      p.z += Math.sin(t * 0.12 + p.a) * dt * 0.05;
      nudge(p);
      const bob = p.bob < 0 ? 0.08 : 0.16 + Math.sin(t + p.bob) * 0.03;
      p.mesh.position.set(p.x, floorY + bob, p.z);
      soften(p.mesh, camera);
    });
    butterflies.forEach((b, i) => {
      if (!b.g.visible) return;
      b.x += Math.cos(t * 0.35 + b.a) * dt * 0.35;
      b.z += Math.sin(t * 0.28 + b.a) * dt * 0.28;
      nudge(b);
      if (pull) { b.x += (pull.x - b.x) * Math.min(1, dt * 1.5); b.z += (pull.z - b.z) * Math.min(1, dt * 1.5); }
      const lift = casting ? 0.45 : 0;
      b.g.position.set(b.x, floorY + 0.85 + lift + Math.sin(t * 0.9 + i) * 0.16, b.z);
      const flap = Math.sin(t * (casting ? 12 : 5.5) + i);
      b.wing.rotation.y = flap * 0.7;
      b.wingR.rotation.y = -flap * 0.7;
      soften(b.wing, camera);
    });
    groundGlow.position.set(walker.feet.x + fx * 1.4, floorY + 0.03, walker.feet.z + fz * 1.4);
    groundGlow.material.opacity = 0.12 + Math.sin(t * 2) * 0.04;
    glowFar.position.set(walker.feet.x + fx * 2.6, floorY + 0.025, walker.feet.z + fz * 2.6);
    critter.userData.x += Math.cos(t * 0.22) * dt * 0.2;
    critter.userData.z += Math.sin(t * 0.18) * dt * 0.2;
    critter.position.set(critter.userData.x, floorY + 0.02, critter.userData.z);
    critter.rotation.y = t * 0.3;
    motes.forEach((m, i) => {
      if (!m.visible) return;
      const home = m.userData.home;
      let x = home.x + Math.cos(t * 0.4 + i) * 0.35;
      let z = home.z + Math.sin(t * 0.33 + i) * 0.35;
      let y = floorY + 0.7 + (i % 4) * 0.22 + Math.sin(t + i) * 0.08;
      if (pull) {
        x += (pull.x - x) * Math.min(1, dt * 2.2);
        z += (pull.z - z) * Math.min(1, dt * 2.2);
        y += 0.6;
        home.x += (pull.x - home.x) * dt * 0.4;
        home.z += (pull.z - home.z) * dt * 0.4;
      }
      if (casting) y += 0.25;
      m.position.set(x, y, z);
      soften(m, camera);
    });
    critters.forEach((c) => {
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      if (Math.hypot(c.x - walker.feet.x, c.z - walker.feet.z) > 6) { c.vx *= -1; c.vz *= -1; }
      c.g.position.set(c.x, floorY, c.z);
      c.g.rotation.y = Math.atan2(c.vx, c.vz);
      const tell = c.g.getObjectByName('tell');
      if (tell) tell.material.opacity = 0.16 + Math.sin(t * 2) * 0.06;
    });
    const marks = extra?.spells?.marks || [];
    for (const m of marks) {
      if (m.k === 'fire') spawnFire(m.x, m.z);
      else spawnMark(m.x, m.z, m.status === 'chill' ? '#d8fbff' : '#e7c8ff');
    }
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      f.life -= dt;
      f.g.children.forEach((w, n) => {
        if (n === 0) { w.material.opacity = Math.max(0, f.life / (f.mark ? 2.6 : 6)) * 0.6; return; }
        w.position.y = 0.15 + Math.sin(t * 8 + w.userData.i) * 0.08;
        w.material.opacity = Math.max(0, f.life / 6) * 0.7;
      });
      if (f.life <= 0) { root.remove(f.g); fires.splice(i, 1); }
    }
    if (riftLife > 0) {
      riftLife = Math.max(0, riftLife - dt);
      const open = Math.min(1, (3.4 - riftLife) / 0.45);
      rift.scale.setScalar(seated ? 0.28 + open * 0.62 : 0.35 + open * 1.15);
      rift.position.y = floorY + 0.04;
      const fade = riftLife < 0.7 ? riftLife / 0.7 : 1;
      rift.visible = fade > 0.02;
      arch.material.opacity = fade;
      inner.material.opacity = fade;
      glow.material.opacity = 0.75 * fade;
      mouth.material.opacity = 0.45 * fade;
      const stepU = Math.min(1, (3.4 - riftLife) / 1.1);
      if (!greeted && open > 0.85 && goals[0]) {
        greeted = true;
        const who = { wolf: 'A moss wolf', fox: 'A fern fox', bunny: 'A pasture bunny', deer: 'A meadow deer' }[goals[0].name] || 'A beast';
        zones.toast?.(`${who} steps through the ring.`);
      }
      anchored.forEach((b, i) => {
        const g = goals[i];
        if (!g) return;
        b.g.position.set(g.x + fx * (1 - stepU) * 1.1, floorY, g.z + fz * (1 - stepU) * 1.1);
      });
      riftSparks.forEach((s, i) => {
        if (phone && i > 3) { s.visible = false; return; }
        const a = t * 1.4 + i;
        s.position.set(Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.9);
      });
    } else {
      rift.visible = false;
      const guest = anchored[0];
      const home = goals[0];
      if (guest && home) {
        guestT += dt;
        const dist = Math.hypot(walker.feet.x - guest.g.position.x, walker.feet.z - guest.g.position.z);
        const sniffX = home.x + Math.cos(guestT * 0.55) * 0.85;
        const sniffZ = home.z + Math.sin(guestT * 0.4) * 0.65;
        if (dist < 2.3) {
          guest.g.rotation.y = Math.atan2(walker.feet.x - guest.g.position.x, walker.feet.z - guest.g.position.z);
          if (!guestNoted) {
            guestNoted = true;
            zones.toast?.('It sniffs your hand. Tap it to befriend, or cast to fight.');
          }
        } else {
          guest.g.position.x += (sniffX - guest.g.position.x) * Math.min(1, dt * 1.4);
          guest.g.position.z += (sniffZ - guest.g.position.z) * Math.min(1, dt * 1.4);
          guest.g.rotation.y = Math.atan2(sniffX - guest.g.position.x, sniffZ - guest.g.position.z);
        }
        guest.g.position.y = floorY;
      }
    }
    placePanel(camera);
    const check = document.getElementById('xrCheck');
    if (check) {
      const line = `XR self-check: ${viewName()}`;
      if (check.textContent !== line) check.textContent = line;
    }
  }

  return {
    get on() { return on; },
    set, update, plant, hitFloor,
    get gyro() { return gyro; },
    get floorY() { return floorY; },
    get shake() { return reduced ? 0 : shake; },
    get xr() { return xrOn; },
    get path() { return path; },
    get placed() { return floorSet ? (hitSource ? 'hit-test' : 'tap') : 'estimate'; },
    get selectHeld() { return selectHeld; },
    get squeezeHeld() { return squeezeHeld; },
    cue,
    get seated() { return seated; },
    viewName, sample: sampleFrame, seat, unseat, recenter,
  };
}
