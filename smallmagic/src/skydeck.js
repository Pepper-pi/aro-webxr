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
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1a140e';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#e6c27a';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(64, 64, 48, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#f2efe6';
  g.font = 'bold 22px Georgia';
  g.textAlign = 'center';
  g.fillText('N', 64, 28);
  g.fillStyle = '#c45a4a';
  g.beginPath();
  g.moveTo(64, 36);
  g.lineTo(72, 78);
  g.lineTo(64, 70);
  g.lineTo(56, 78);
  g.fill();
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

  const peaks = rich ? [[-8, 3.2], [-3.2, 4.4], [1.4, 3.6], [6.5, 2.8], [10, 2.2]] : [[-4, 3.4], [2, 4], [8, 2.6]];
  const hill = new THREE.MeshBasicMaterial({ color: '#1a1028', fog: false });
  peaks.forEach(([x, h]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(1.6, h, rich ? 6 : 4), hill);
    m.position.set(x * 0.7, h * 0.35, -16);
    root.add(m);
  });
  const town = new THREE.MeshBasicMaterial({ color: '#ffb060', fog: false });
  const lamps = rich ? 8 : 4;
  for (let i = 0; i < lamps; i++) {
    const bit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), town);
    bit.position.set(-6 + i * (12 / lamps), 0.35 + (i % 3) * 0.15, -14.2);
    root.add(bit);
  }
  if (rich) {
    const wash = new THREE.PointLight('#ffb060', 0.35, 18, 2);
    wash.position.set(0, 1.2, -10);
    root.add(wash);
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
  helm.position.set(0.15, 0, -1.15);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8), brass);
  foot.position.y = 0.5;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16), brass);
  wheel.position.y = 1.15;
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.58, 0.03), brass);
    spoke.position.y = 1.15;
    spoke.rotation.z = i * Math.PI / 4;
    helm.add(spoke);
  }
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ map: compassTex() }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.96;
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
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff1d4' }));
    bulb.position.y = -0.12;
    const lamp = new THREE.PointLight('#ffd9a8', rich ? 0.55 : 0.4, 3.4, 2);
    lamp.position.y = -0.12;
    g.add(cord, bulb, lamp);
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

  const exit = new THREE.Vector3(0, 0, 2.35);
  function tick(dt) {
    const t = performance.now() * 0.001;
    lanterns.forEach((g) => { g.rotation.z = Math.sin(t * 0.8 + g.userData.phase) * 0.08; });
    face.rotation.z = Math.sin(t * 0.4) * 0.15;
    void dt;
  }
  return { root, tick, exit };
}
