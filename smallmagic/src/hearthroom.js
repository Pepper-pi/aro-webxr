// The hearth room, built at runtime. Wood and stone maps are Poly Haven CC0.
// Furniture models stay the Kenney kit already in the hub. No character file is edited.
import * as THREE from 'three';

function mapOf(url, rx, ry) {
  const tex = new THREE.TextureLoader().load(new URL(url, document.baseURI).href);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function paintSky(dusk, weather) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 280);
  if (dusk) {
    sky.addColorStop(0, '#14102a');
    sky.addColorStop(0.55, '#6a3a58');
    sky.addColorStop(1, '#e7a07a');
  } else {
    sky.addColorStop(0, '#8eb7e4');
    sky.addColorStop(0.62, '#f3e2c4');
    sky.addColorStop(1, '#f7f1e4');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 300);
  g.fillStyle = dusk ? '#243028' : '#6ea85a';
  g.fillRect(0, 268, 512, 116);
  if (weather === 'rain') {
    g.strokeStyle = 'rgba(230,240,255,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const x = (i * 19) % 512;
      g.beginPath();
      g.moveTo(x, 20 + (i % 5) * 12);
      g.lineTo(x - 8, 70 + (i % 5) * 12);
      g.stroke();
    }
  } else if (weather === 'fog') {
    g.fillStyle = 'rgba(220,214,230,0.45)';
    g.fillRect(0, 180, 512, 120);
  } else if (weather === 'wind') {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(180, 70, 70, 18, 0, 0, Math.PI * 2);
    g.ellipse(300, 90, 50, 14, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = dusk ? '#f3e2b0' : '#fff6d2';
  g.beginPath();
  g.arc(dusk ? 90 : 400, dusk ? 78 : 64, 22, 0, Math.PI * 2);
  g.fill();
  return c;
}

export function createHearthShell() {
  const root = new THREE.Group();
  root.name = 'hearth-shell';
  const wood = mapOf('hearth/textures/wood_floor_diff_1k.jpg', 4, 5);
  const wall = wood.clone();
  wall.repeat.set(3, 1.4);
  const stone = mapOf('hearth/textures/stone_wall_diff_1k.jpg', 2, 2);
  const plank = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.86, metalness: 0, color: '#8a7560' });
  const boards = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.84, metalness: 0, color: '#e4e8ee' });
  const rock = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.92, metalness: 0, color: '#f4efe8' });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.16, 14), plank);
  floor.position.y = -0.08;
  floor.receiveShadow = true;
  root.add(floor);

  const wallBox = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boards);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  wallBox(11, 2.7, 0.18, 0, 1.35, -6.85);
  wallBox(11, 2.7, 0.18, 0, 1.35, 6.85);
  wallBox(0.18, 2.7, 14, -5.45, 1.35, 0);
  // The window wall is three boards around a pane, not one solid box.
  wallBox(0.18, 2.7, 5.5, 5.45, 1.35, -4.05);
  wallBox(0.18, 2.7, 5.5, 5.45, 1.35, 4.05);
  wallBox(0.18, 0.7, 2.7, 5.45, 2.35, 0);
  wallBox(0.18, 0.55, 2.7, 5.45, 0.28, 0);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 14), boards);
  ceil.position.y = 2.7;
  root.add(ceil);

  const paneCanvas = paintSky(false, 'clear');
  const paneTex = new THREE.CanvasTexture(paneCanvas);
  paneTex.colorSpace = THREE.SRGBColorSpace;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: paneTex }));
  pane.position.set(5.34, 1.35, 0);
  pane.rotation.y = -Math.PI / 2;
  root.add(pane);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 2.55), new THREE.MeshStandardMaterial({ color: '#6a4a32', roughness: 0.7 }));
  frame.position.set(5.4, 1.35, 0);
  root.add(frame);
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.35, 0.04), new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.5 }));
  mullion.position.set(5.32, 1.35, 0);
  root.add(mullion);

  const hearth = new THREE.Group();
  hearth.position.set(-3.2, 0, -5.5);
  const block = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rock);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    hearth.add(m);
    return m;
  };
  block(2.4, 0.34, 1.15, 0, 0.17, 0.2);
  block(2.2, 1.35, 0.34, 0, 1.0, -0.28);
  block(0.32, 1.3, 0.7, -0.95, 0.95, 0.05);
  block(0.32, 1.3, 0.7, 0.95, 0.95, 0.05);
  block(2.5, 0.2, 0.55, 0, 1.7, 0);
  const flameMat = (color, opacity, map) => new THREE.MeshBasicMaterial({
    color, map: map || null, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const char = new THREE.MeshStandardMaterial({ color: '#241410', roughness: 0.94, metalness: 0.02 });
  const log = (len, x, y, z, yaw) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, len, 7), char);
    m.rotation.z = Math.PI / 2;
    m.rotation.y = yaw;
    m.position.set(x, y, z);
    hearth.add(m);
    return m;
  };
  log(0.62, -0.02, 0.4, 0.36, 0.55);
  log(0.56, 0.06, 0.46, 0.4, -0.62);
  log(0.34, 0.02, 0.5, 0.34, 1.4);
  const emberMat = flameMat('#ff6a1a', 0.72);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(0.26, 14), emberMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0.02, 0.37, 0.38);
  hearth.add(bed);
  const embers = [];
  for (let i = 0; i < 10; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (i % 3) * 0.006, 6, 5), flameMat(i % 2 ? '#ffd27a' : '#ff7a2a', 0.85));
    const a = (i / 10) * Math.PI * 2;
    e.position.set(Math.cos(a) * 0.12, 0.4, 0.38 + Math.sin(a) * 0.08);
    e.userData.p = i / 10;
    e.userData.x = e.position.x;
    e.userData.z = e.position.z;
    hearth.add(e);
    embers.push(e);
  }
  const flameCanvas = document.createElement('canvas');
  flameCanvas.width = 64;
  flameCanvas.height = 128;
  {
    const g = flameCanvas.getContext('2d');
    const grd = g.createLinearGradient(0, 128, 0, 0);
    grd.addColorStop(0, 'rgba(255,70,10,0)');
    grd.addColorStop(0.22, 'rgba(255,90,16,0.9)');
    grd.addColorStop(0.5, 'rgba(255,168,48,0.72)');
    grd.addColorStop(0.78, 'rgba(255,214,110,0.4)');
    grd.addColorStop(1, 'rgba(255,244,210,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(32, 6);
    g.bezierCurveTo(60, 48, 52, 96, 42, 124);
    g.lineTo(22, 124);
    g.bezierCurveTo(12, 96, 4, 48, 32, 6);
    g.fill();
    const core = g.createLinearGradient(0, 120, 0, 20);
    core.addColorStop(0, 'rgba(255,220,140,0)');
    core.addColorStop(0.5, 'rgba(255,236,190,0.55)');
    core.addColorStop(1, 'rgba(255,250,230,0)');
    g.fillStyle = core;
    g.beginPath();
    g.moveTo(32, 18);
    g.bezierCurveTo(40, 50, 38, 90, 34, 118);
    g.lineTo(30, 118);
    g.bezierCurveTo(26, 90, 24, 50, 32, 18);
    g.fill();
  }
  const flameTex = new THREE.CanvasTexture(flameCanvas);
  flameTex.colorSpace = THREE.SRGBColorSpace;
  const tongues = [];
  [[0.42, '#ffb45a', -0.06, 0.4], [0.34, '#ffd48a', 0.08, 0.36], [0.28, '#ffe6b0', 0.0, 0.44], [0.22, '#ff8a32', 0.12, 0.42]].forEach(([h, color, x, z], i) => {
    const g = new THREE.Group();
    const mat = flameMat(color, 0.62, flameTex);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(0.18, h), mat);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.12, h * 0.92), mat);
    b.rotation.y = Math.PI / 2;
    g.add(a, b);
    g.position.set(x, 0.42 + h * 0.5, z);
    g.userData.h = h;
    g.userData.i = i;
    hearth.add(g);
    tongues.push(g);
  });
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2e32', roughness: 0.88, metalness: 0.22 });
  const cauldron = new THREE.Group();
  cauldron.name = 'hearth-cauldron';
  cauldron.position.set(0.72, 0, 1.22);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52), iron);
  belly.scale.y = 0.78;
  belly.position.y = 0.2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 16), iron);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.25;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 10), iron);
  foot.position.y = 0.02;
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 8, Math.PI), iron);
    handle.position.set(side * 0.2, 0.2, 0);
    handle.rotation.y = Math.PI / 2;
    cauldron.add(handle);
  }
  const stew = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 14),
    new THREE.MeshBasicMaterial({ color: '#7ec8b0', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  stew.rotation.x = -Math.PI / 2;
  stew.position.y = 0.248;
  stew.name = 'cauldron-stew';
  const stewCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 10),
    new THREE.MeshBasicMaterial({ color: '#ffb15a', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  stewCore.rotation.x = -Math.PI / 2;
  stewCore.position.y = 0.252;
  stewCore.name = 'cauldron-core';
  cauldron.add(foot, belly, rim, stew, stewCore);
  hearth.add(cauldron);
  root.add(hearth);

  function plant(x, z) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 8), new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.7 }));
    pot.position.y = 0.11;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: '#3e8a4a', roughness: 0.85 }));
    leaf.position.y = 0.42;
    leaf.scale.y = 0.8;
    g.add(pot, leaf);
    g.position.set(x, 0, z);
    root.add(g);
  }
  plant(4.4, -1.6);
  plant(4.2, 1.8);
  plant(-4.4, 2.6);

  const trim = new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.45 });
  const beamMat = new THREE.MeshStandardMaterial({ color: '#6a4030', roughness: 0.72 });
  [[-4.2, 0], [4.2, 0]].forEach(([z]) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.12, 0.16), beamMat);
    beam.position.set(0, 2.55, z);
    root.add(beam);
  });
  const hang = (x, z) => {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), beamMat);
    cord.position.y = 0.16;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff4e6' }));
    bulb.position.y = -0.08;
    const lamp = new THREE.PointLight('#fff4e6', 0.1, 2.4, 2);
    lamp.position.y = -0.08;
    g.add(cord, bulb, lamp);
    g.position.set(x, 2.35, z);
    root.add(g);
  };
  hang(-1.4, -1.1);
  hang(1.7, 1.15);
  const rugCanvas = document.createElement('canvas');
  rugCanvas.width = 256;
  rugCanvas.height = 320;
  {
    const g = rugCanvas.getContext('2d');
    g.fillStyle = '#5c2e32';
    g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#e4c7a4';
    g.fillRect(12, 14, 232, 292);
    g.fillStyle = '#6a3836';
    g.fillRect(24, 26, 208, 268);
    for (let y = 26; y < 294; y += 10) {
      for (let x = 24; x < 232; x += 10) {
        const alt = ((x / 10) + (y / 10)) % 2;
        g.fillStyle = alt ? '#7a403c' : '#8d4c46';
        g.fillRect(x, y, 10, 10);
        g.fillStyle = alt ? '#c4a07a' : '#a88462';
        g.fillRect(x + 2, y + 4, 6, 2);
      }
    }
    g.strokeStyle = '#f0d8b4';
    g.lineWidth = 3;
    g.strokeRect(30, 34, 196, 252);
  }
  const rugTex = new THREE.CanvasTexture(rugCanvas);
  rugTex.colorSpace = THREE.SRGBColorSpace;
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.4),
    new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.92 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.2, 0.012, -0.4);
  root.add(rug);
  const shelf = new THREE.Group();
  shelf.position.set(-4.85, 0, -1.4);
  const grain = mapOf('hearth/textures/wood_floor_diff_1k.jpg', 1.4, 1.1);
  const caseMat = new THREE.MeshStandardMaterial({ map: grain, color: '#c4a078', roughness: 0.78 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.55, 1.5), caseMat);
  body.position.y = 0.78;
  shelf.add(body);
  const bookColors = ['#8a3a3a', '#3a4a6a', '#6a5a32', '#3a5a48'];
  for (let i = 0; i < 4; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.16), new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.6 }));
    book.position.set(0.16, 0.45 + (i % 2) * 0.38, -0.4 + i * 0.22);
    shelf.add(book);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? '#7ec8c4' : '#c47ad4', roughness: 0.35, emissive: i % 2 ? '#1a3a38' : '#3a1840', emissiveIntensity: 0.25 }));
    bottle.position.set(0.18, 1.15, -0.35 + i * 0.22);
    shelf.add(bottle);
  }
  root.add(shelf);
  const side = new THREE.Group();
  side.position.set(3.5, 0, -4.15);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.42), caseMat);
  cabinet.position.y = 0.36;
  side.add(cabinet);
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#d7c48a', roughness: 0.4, emissive: '#3a3018', emissiveIntensity: 0.2 }));
    jar.position.set(-0.35 + i * 0.32, 0.78, 0);
    side.add(jar);
  }
  root.add(side);
  [[5.28, 2.15], [5.28, 0.55]].forEach(([x, y]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.7), trim);
    bar.position.set(x, y, 0);
    root.add(bar);
  });
  [[1.25], [-1.25]].forEach(([z]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.08), trim);
    bar.position.set(5.28, 1.35, z);
    root.add(bar);
  });

  const fireLight = new THREE.PointLight('#fff4e6', 0.34, 6.5, 2);
  fireLight.position.set(-3.2, 1.05, -4.7);
  const bounce = new THREE.PointLight('#f7f1e8', 0.08, 5.5, 2);
  bounce.position.set(0.2, 1.5, 0.4);
  const windowLight = new THREE.PointLight('#d5e4f8', 0.42, 12, 2);
  windowLight.position.set(4.4, 1.9, 0.2);
  const moon = new THREE.DirectionalLight('#d7e6f8', 0.16);
  moon.position.set(4.2, 3.2, 1.4);
  const hemi = new THREE.HemisphereLight('#f3efe6', '#d7c4a8', 0.55);
  root.add(fireLight, bounce, windowLight, moon, hemi);

  let painted = '';
  function paintWindow(dusk, weather) {
    const key = `${dusk ? 1 : 0}|${weather || 'clear'}`;
    if (key === painted) return;
    painted = key;
    const next = paintSky(!!dusk, weather || 'clear');
    paneCanvas.getContext('2d').drawImage(next, 0, 0);
    paneTex.needsUpdate = true;
    windowLight.color.set(dusk ? '#c9b4dc' : weather === 'rain' ? '#c5d4e4' : '#d5e4f8');
    windowLight.intensity = dusk ? 0.28 : 0.48;
  }

  function flicker(t) {
    tongues.forEach((g) => {
      const i = g.userData.i;
      const flick = 0.86 + Math.sin(t * (7 + i * 1.7)) * 0.16 + Math.sin(t * 13 + i) * 0.05;
      g.scale.set(0.9 + Math.sin(t * 5 + i) * 0.08, flick, 0.9);
      g.position.y = 0.42 + g.userData.h * 0.5 * flick;
      g.children.forEach((m) => { m.material.opacity = 0.42 + flick * 0.28; });
    });
    embers.forEach((e) => {
      const u = (t * 0.35 + e.userData.p) % 1;
      e.position.y = 0.4 + u * 0.22;
      e.material.opacity = (1 - u) * 0.8;
    });
    bed.material.opacity = 0.55 + Math.sin(t * 6) * 0.12;
    const stewMesh = cauldron.getObjectByName('cauldron-stew');
    const coreMesh = cauldron.getObjectByName('cauldron-core');
    if (stewMesh) stewMesh.material.opacity = 0.62 + Math.sin(t * 3.2) * 0.16;
    if (coreMesh) coreMesh.material.opacity = 0.28 + Math.sin(t * 4.4) * 0.12;
    fireLight.intensity = 0.3 + Math.sin(t * 11) * 0.03;
    bounce.intensity = 0.07 + Math.sin(t * 11) * 0.012;
  }

  return { root, paintWindow, flicker, fireLight };
}
