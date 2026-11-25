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
  wallBox(0.18, 2.7, 4.2, 5.45, 1.35, -4.6);
  wallBox(0.18, 2.7, 4.2, 5.45, 1.35, 4.6);
  wallBox(0.18, 0.7, 5.6, 5.45, 2.35, 0);
  wallBox(0.18, 0.55, 5.6, 5.45, 0.28, 0);
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
  const flameMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = [0.24, 0.16, 0.08].map((r, i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, 0.58 - i * 0.1, 8), flameMat(i === 2 ? '#fff6d8' : i === 1 ? '#ffb15a' : '#ff6a1a', 0.8 - i * 0.08));
    f.position.set(0, 0.72 + i * 0.12, 0.42);
    hearth.add(f);
    return f;
  });
  const embers = [];
  for (let i = 0; i < 8; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), flameMat('#ffc56a', 0.9));
    e.userData.p = i / 8;
    e.userData.x = (i - 3.5) * 0.07;
    hearth.add(e);
    embers.push(e);
  }
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

  const fireLight = new THREE.PointLight('#fff4e6', 0.72, 8, 2);
  fireLight.position.set(-3.2, 1.05, -4.7);
  const bounce = new THREE.PointLight('#f7f1e8', 0.22, 7, 2);
  bounce.position.set(0.2, 1.5, 0.4);
  const windowLight = new THREE.PointLight('#d5e4f8', 1.35, 16, 2);
  windowLight.position.set(4.4, 1.9, 0.2);
  const moon = new THREE.DirectionalLight('#d7e6f8', 0.55);
  moon.position.set(4.2, 3.2, 1.4);
  const hemi = new THREE.HemisphereLight('#e4eef8', '#c8b8a4', 1.25);
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
    windowLight.intensity = dusk ? 0.45 : 0.9;
  }

  function flicker(t) {
    flames.forEach((f, i) => {
      f.scale.y = 0.8 + Math.sin(t * (9 + i * 4)) * 0.22;
      f.scale.x = f.scale.z = 0.9 + Math.sin(t * (7 + i)) * 0.14;
    });
    embers.forEach((e) => {
      const u = (t * 0.4 + e.userData.p) % 1;
      e.position.set(e.userData.x, 0.45 + u * 1.05, 0.35);
      e.material.opacity = (1 - u) * 0.85;
    });
    fireLight.intensity = 0.66 + Math.sin(t * 11) * 0.06;
    bounce.intensity = 0.2 + Math.sin(t * 11) * 0.02;
  }

  root.add(porcelainHealer());

  return { root, paintWindow, flicker, fireLight };
}

function porcelainSkin() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4e6e4';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(42, 24, 28, 0.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(36, 18); g.bezierCurveTo(70, 60, 48, 120, 62, 210);
  g.moveTo(200, 24); g.bezierCurveTo(160, 80, 188, 140, 170, 230);
  g.moveTo(20, 140); g.bezierCurveTo(80, 150, 140, 130, 230, 160);
  g.stroke();
  g.strokeStyle = '#9a1830';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(78, 168, 16, 0.4, Math.PI * 1.35);
  g.moveTo(70, 160); g.lineTo(86, 176);
  g.stroke();
  g.strokeStyle = '#1a1014';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(128, 36); g.lineTo(128, 68);
  g.moveTo(114, 50); g.lineTo(142, 50);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function porcelainHealer() {
  const g = new THREE.Group();
  g.name = 'porcelain-healer';
  const skin = new THREE.MeshStandardMaterial({ map: porcelainSkin(), color: '#fff8f6', roughness: 0.16, metalness: 0.12 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#5a3050', roughness: 0.55 });
  const joint = new THREE.MeshStandardMaterial({ color: '#1a1214', roughness: 0.4, metalness: 0.2 });
  const red = new THREE.MeshStandardMaterial({ color: '#8a1830', roughness: 0.45 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 18), skin);
  head.scale.set(0.9, 1.08, 0.86);
  head.position.y = 1.28;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 8), joint);
  neck.position.y = 1.14;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#2a1420', roughness: 0.35 }));
  hair.position.y = 1.32;
  const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 0.78, 14), cloth);
  dress.position.y = 0.7;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.016, 6, 18), red);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 0.96;
  g.add(head, neck, hair, dress, sash);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff7ad4' }));
    eye.position.set(side * 0.04, 1.3, 0.095);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.36, 8), cloth);
    arm.position.set(side * 0.2, 0.98, 0);
    arm.rotation.z = side * 0.15;
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), joint);
    shoulder.position.set(side * 0.16, 1.14, 0);
    g.add(eye, arm, shoulder);
  }
  const rim = new THREE.PointLight('#ff4fa8', 0.7, 2.4, 2);
  rim.position.set(-0.45, 1.45, 0.35);
  g.add(rim);
  g.position.set(3.15, 0, 2.4);
  g.rotation.y = Math.PI;
  return g;
}
