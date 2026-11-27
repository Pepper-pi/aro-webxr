// The moored sky-ship's observation deck. Built in code. Phone keeps fewer ribs, lamps, and peaks.
import * as THREE from 'three';

function plankTex() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6a4632';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#7a5340' : '#5c3c2c';
    g.fillRect(0, i * 16, 128, 15);
    g.fillStyle = 'rgba(40, 22, 14, 0.35)';
    g.fillRect(0, i * 16 + 14, 128, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function compassTex() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#140e08';
  g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.strokeStyle = '#ffe1a4';
  g.fillStyle = '#ffe1a4';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(0, 0, 96, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, -18);
    g.lineTo(i % 2 ? 10 : 16, -78);
    g.lineTo(0, -96);
    g.lineTo(i % 2 ? -10 : -16, -78);
    g.closePath();
    g.fillStyle = i === 0 ? '#ffb35a' : '#fff1d0';
    g.fill();
  }
  g.fillStyle = '#ffb35a';
  g.beginPath();
  g.arc(0, 0, 10, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function wispTex() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const wash = g.createRadialGradient(64, 32, 4, 64, 32, 60);
  wash.addColorStop(0, 'rgba(255,236,214,0.55)');
  wash.addColorStop(1, 'rgba(255,236,214,0)');
  g.fillStyle = wash;
  g.fillRect(0, 0, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSkyDeck(low) {
  const root = new THREE.Group();
  root.name = 'sky-deck';
  const rich = !low;
  const wood = new THREE.MeshStandardMaterial({ map: plankTex(), color: '#c4a080', roughness: 0.78 });
  const brass = new THREE.MeshStandardMaterial({ color: '#e0b45a', metalness: 0.62, roughness: 0.32, emissive: '#3a2810', emissiveIntensity: 0.35 });
  const rope = new THREE.MeshStandardMaterial({ color: '#8a6244', roughness: 0.9 });
  const belly = document.createElement('canvas');
  belly.width = 64;
  belly.height = 256;
  {
    const g = belly.getContext('2d');
    g.fillStyle = '#6a4558';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#e6c7a2';
    for (let i = 0; i < 8; i++) g.fillRect(0, 10 + i * 32, 64, 7);
  }
  const bellyTex = new THREE.CanvasTexture(belly);
  bellyTex.colorSpace = THREE.SRGBColorSpace;
  const cloth = new THREE.MeshStandardMaterial({ map: bellyTex, color: '#e7d0c4', roughness: 0.8 });
  const ribMat = new THREE.MeshStandardMaterial({ color: '#c4a48a', roughness: 0.6 });

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(36, rich ? 20 : 10, rich ? 12 : 8),
    new THREE.MeshBasicMaterial({ color: '#241434', side: THREE.BackSide, fog: false }),
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshBasicMaterial({ color: '#c46a58', side: THREE.BackSide, fog: false }),
  );
  glow.rotation.x = Math.PI;
  root.add(sky, glow);

  const seaMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false });
  const sea = rich
    ? [[-1.4, -11, 18, 0.9, 5, '#2a1848', 0.72], [-0.2, -8.5, 14, 0.55, 3.2, '#6a3a55', 0.4], [0.55, -6.5, 11, 0.35, 2.4, '#c47a68', 0.32]]
    : [[-0.6, -9, 16, 0.7, 4, '#3a2050', 0.6]];
  sea.forEach(([y, z, sx, sy, sz, color, opacity]) => {
    const bank = new THREE.Mesh(new THREE.SphereGeometry(1, rich ? 12 : 8, 6), seaMat(color, opacity));
    bank.scale.set(sx, sy, sz);
    bank.position.set(0, y, z);
    root.add(bank);
  });
  const ridgeMat = new THREE.MeshBasicMaterial({ color: '#120818', fog: false });
  (rich ? [[-7, 1.15], [-2.2, 1.7], [2.6, 1.35], [7.2, 0.95]] : [[-4, 1.3], [2, 1.5], [7, 1]]).forEach(([x, h]) => {
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), ridgeMat);
    ridge.scale.set(2.6, h, 1.15);
    ridge.position.set(x, h * 0.15, -15.5);
    root.add(ridge);
  });
  const town = [];
  const townN = rich ? 14 : 6;
  const townMat = new THREE.MeshBasicMaterial({ color: '#ffb047', fog: false });
  for (let i = 0; i < townN; i++) {
    const bit = new THREE.Mesh(new THREE.SphereGeometry(rich ? 0.07 : 0.09, 6, 5), townMat.clone());
    bit.position.set(-7 + (i / Math.max(1, townN - 1)) * 14, -0.15 + (i % 3) * 0.12, -13.4);
    bit.userData.phase = i;
    root.add(bit);
    town.push(bit);
  }

  const floor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 5.2), wood);
  floor.position.y = 0.06;
  floor.receiveShadow = true;
  root.add(floor);

  const rail = (z, len) => {
    const g = new THREE.Group();
    const posts = rich ? 5 : 3;
    for (let i = 0; i < posts; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), brass);
      p.position.set(-2.4 + (i / (posts - 1)) * 4.8, 0.55, z);
      g.add(p);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 5), rope);
    top.rotation.z = Math.PI / 2;
    top.position.set(0, 0.95, z);
    g.add(top);
    if (rich) {
      const lowRope = top.clone();
      lowRope.position.y = 0.48;
      g.add(lowRope);
    }
    root.add(g);
  };
  rail(-2.35, 4.8);
  rail(2.35, 4.8);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.6, 5), rope);
  bow.rotation.z = Math.PI / 2;
  bow.position.set(0, 0.95, -2.35);
  root.add(bow);

  const n = rich ? 14 : 8;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = Math.sin(Math.PI * t) * (rich ? 1.55 : 1.35);
    pts.push(new THREE.Vector2(Math.max(0.12, r), (t - 0.5) * (rich ? 7.4 : 6)));
  }
  const env = new THREE.Mesh(new THREE.LatheGeometry(pts, rich ? 14 : 8), cloth);
  env.rotation.x = Math.PI / 2;
  env.position.set(0, rich ? 3.7 : 3.45, -1.35);
  root.add(env);
  const ribN = rich ? 6 : 3;
  for (let i = 0; i < ribN; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.48 - Math.abs(i - (ribN - 1) / 2) * 0.16, 0.045, 6, rich ? 20 : 12), ribMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.set(0, rich ? 3.7 : 3.45, -2.7 + i * (rich ? 0.55 : 0.9));
    root.add(rib);
  }

  const helm = new THREE.Group();
  helm.name = 'sky-helm';
  helm.position.set(0.15, 0, -1.15);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8), brass);
  foot.position.y = 0.5;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16), brass);
  wheel.position.y = 1.22;
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.58, 0.03), brass);
    spoke.position.y = 1.15;
    spoke.rotation.z = i * Math.PI / 4;
    helm.add(spoke);
  }
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ map: compassTex(), transparent: true }));
  face.name = 'compass-rose';
  face.rotation.x = -1.05;
  face.position.set(0, 0.98, 0.16);
  const helmLight = new THREE.PointLight('#ffd7a4', rich ? 0.7 : 0.45, 3.2, 2);
  helmLight.position.y = 1.2;
  helm.add(foot, wheel, face, helmLight);
  root.add(helm);

  const lanterns = [];
  const spots = rich ? [[-2.15, -1.6], [2.15, -0.4], [-1.8, 1.2]] : [[2.05, -1.1]];
  spots.forEach(([x, z], i) => {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), rope);
    cord.position.y = 0.2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb047' }));
    bulb.position.y = -0.12;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false }));
    halo.position.y = -0.12;
    const lamp = new THREE.PointLight('#ffb047', rich ? 0.85 : 0.55, 3.6, 2);
    lamp.position.y = -0.12;
    g.add(cord, bulb, halo, lamp);
    g.position.set(x, 2.15, z);
    g.userData.phase = i * 1.3;
    root.add(g);
    lanterns.push(g);
  });

  const door = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 22), brass);
  door.position.set(0, 1.05, 2.55);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18), new THREE.MeshBasicMaterial({ color: '#140c18' }));
  mouth.position.set(0, 1.05, 2.52);
  root.add(door, mouth);

  const hemi = new THREE.HemisphereLight('#c4a0c8', '#3a2418', rich ? 0.55 : 0.4);
  const moon = new THREE.DirectionalLight('#e7c4b0', rich ? 0.35 : 0.22);
  moon.position.set(-4, 8, 2);
  root.add(hemi, moon);

  const wisps = [];
  const wispMat = new THREE.MeshBasicMaterial({ map: wispTex(), transparent: true, depthWrite: false, opacity: 0.8, fog: false });
  for (let i = 0; i < (rich ? 4 : 2); i++) {
    const wisp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45), wispMat);
    wisp.position.set(-3 + i * 1.6, 1.05, -2.1 + (i % 2) * 0.4);
    wisp.userData.speed = 0.35 + (i % 3) * 0.12;
    root.add(wisp);
    wisps.push(wisp);
  }
  const exit = new THREE.Vector3(0, 0, 2.35);
  function tick(dt) {
    const t = performance.now() * 0.001;
    lanterns.forEach((g) => { g.rotation.z = Math.sin(t * 0.8 + g.userData.phase) * 0.08; });
    face.rotation.z = Math.sin(t * 0.35) * 0.12;
    town.forEach((bit) => {
      const tw = 0.55 + Math.sin(t * 2.2 + bit.userData.phase) * 0.45;
      bit.scale.setScalar(0.7 + tw * 0.6);
      bit.material.opacity = 1;
    });
    wisps.forEach((wisp) => {
      wisp.position.x += wisp.userData.speed * dt;
      if (wisp.position.x > 3.4) wisp.position.x = -3.4;
      wisp.lookAt(0, wisp.position.y, 6);
    });
  }
  return { root, tick, exit, helm };
}
