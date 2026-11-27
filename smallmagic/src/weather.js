// A short street that answers the weather. Rain brings puddles, clothed chibis,
// umbrellas, and vendors under an awning. No tree models are touched.
import * as THREE from 'three';

function cloth(color) {
  return new THREE.MeshBasicMaterial({ color });
}

const jiggle = [];
function hem(parent, color, y) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.025), cloth(color));
  m.geometry.translate(0, -0.06, 0);
  m.position.set(0, y, 0.02);
  parent.add(m);
  jiggle.push({ m, a: 0.12, v: 0 });
  return m;
}
function chibi(color, robe) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 12), cloth(robe));
  body.position.y = 0.34;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), cloth(robe));
  hood.position.y = 0.68;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), cloth(color));
  face.position.set(0, 0.64, 0.06);
  const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.03), cloth('#3a2a1c'));
  tuft.geometry.translate(0, -0.06, 0);
  tuft.position.set(0, 0.8, -0.02);
  g.add(body, hood, face, tuft);
  hem(g, robe, 0.12);
  jiggle.push({ m: tuft, a: 0.2, v: 0 });
  return g;
}

function umbrella(tint) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.15, 5), cloth('#6a5344'));
  pole.position.y = 0.58;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 8), cloth(tint));
  cap.position.y = 1.16;
  g.add(pole, cap);
  return g;
}

function vendor(robe) {
  const g = chibi('#f0c2a0', robe);
  const stall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.4), cloth('#c4a574'));
  stall.position.set(0, 0.28, 0.45);
  g.add(stall);
  return g;
}

export function createWeather(scene, world) {
  const root = new THREE.Group();
  root.name = 'weather-street';
  scene.add(root);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.6), cloth('#e7c56a'));
  awning.position.y = 1.7;
  const posts = [-1.4, 1.4].map((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 5), cloth('#6a5344'));
    post.position.set(x, 0.85, 0.4);
    return post;
  });
  root.add(awning, ...posts);
  const puddles = [];
  for (let i = 0; i < 3; i++) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.42 + i * 0.06, 14), new THREE.MeshBasicMaterial({ color: '#7eb8d4', transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.04;
    root.add(puddle);
    puddles.push(puddle);
  }
  const people = [chibi('#f0c2a0', '#6a8fbf'), chibi('#f0c2a0', '#c45a4a'), chibi('#f0c2a0', '#6a5a8c')];
  people.forEach((p) => root.add(p));
  const brollies = ['#e23b32', '#f1d9a4', '#3d7a8c', '#6a8f4a'].map((c) => umbrella(c));
  brollies.forEach((b) => root.add(b));
  const sellers = [vendor('#3d7a8c'), vendor('#c45a4a')];
  sellers.forEach((s) => root.add(s));
  const streaks = [];
  for (let i = 0; i < 18; i++) {
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.03), new THREE.MeshBasicMaterial({ color: '#d7eefe', transparent: true, opacity: 0.65 }));
    root.add(drop);
    streaks.push(drop);
  }
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ color: '#d9d3ea', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  fog.position.y = 1.4;
  fog.visible = false;
  root.add(fog);
  const shimmer = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 22), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.9 }));
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.visible = false;
  root.add(shimmer);
  const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff1c4' }));
  wisp.visible = false;
  root.add(wisp);

  let sky = 'clear';
  let placed = false;
  const origin = new THREE.Vector3();

  function place() {
    if (placed) return;
    placed = true;
    const s = world.start;
    const yaw = s.yaw || 0;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = fz;
    const rz = -fx;
    origin.set(s.x + fx * 8, 0, s.z + fz * 8);
    const y = world.ground(origin.x, origin.z);
    root.position.set(origin.x, y, origin.z);
    root.rotation.y = Math.atan2(fx, fz);
    puddles.forEach((p, i) => p.position.set(-1.6 + i * 1.3, 0.04, 1.5));
    people.forEach((p, i) => p.position.set(-1.6 + i * 1.3, 0, 1.5));
    brollies.forEach((b, i) => b.position.set(-2.2 + i * 1.4, 0, -0.2));
    fog.position.set(0, 1.5, 2.4);
  }

  function update(dt, _walker, hidden) {
    place();
    root.visible = !hidden;
    if (!root.visible) return;
    const rain = sky === 'rain';
    const wind = sky === 'wind' || sky === 'rain';
    fog.visible = sky === 'fog' || sky === 'rain';
    fog.material.opacity = sky === 'fog' ? 0.38 : 0.12;
    const t = performance.now() * 0.001;
    jiggle.forEach((row, i) => {
      const kick = Math.sin(t * 2.4 + i) * 0.2;
      row.v += ((0.16 - row.a) * 9 - row.v * 3.1 + kick) * dt;
      row.a += row.v;
      row.m.rotation.x = row.a;
    });
    people.forEach((p, i) => {
      p.visible = rain;
      if (!rain) return;
      const hop = Math.abs(Math.sin(t * 3.2 + i));
      p.position.y = hop * 0.18;
      p.rotation.z = Math.sin(t * 6 + i) * 0.08;
    });
    puddles.forEach((p) => { p.visible = rain || sky === 'fog'; p.material.opacity = rain ? 0.78 : 0.35; });
    brollies.forEach((b, i) => {
      b.visible = sky !== 'clear';
      b.rotation.z = wind ? Math.sin(t * 1.4 + i) * 0.18 : 0;
    });
    sellers.forEach((s, i) => {
      const under = rain || sky === 'fog' || wind;
      s.position.set(i === 0 ? -0.7 : 0.7, 0, under ? -0.15 : 1.15);
    });
    awning.position.z = 0.15;
    streaks.forEach((drop, i) => {
      drop.visible = rain;
      if (!rain) return;
      const u = (t * 1.8 + i * 0.17) % 1;
      drop.position.set(((i * 1.7) % 5) - 2.5, 2.2 - u * 2.1, ((i * 0.9) % 3) - 0.4);
    });
    if (shimmer.visible) {
      shimmer.rotation.z += dt * 0.6;
      const pulse = 0.85 + Math.sin(t * 3) * 0.08;
      shimmer.scale.setScalar(pulse);
      wisp.position.y = 0.85 + Math.sin(t * 2) * 0.06;
    }
  }

  return {
    root, update,
    get spot() { return origin; },
    set sky(v) { sky = v || 'clear'; },
    get sky() { return sky; },
    parade(next = 'rain') {
      place();
      sky = next;
      shimmer.visible = true;
      wisp.visible = true;
      shimmer.position.set(1.8, 0.08, 1.2);
      wisp.position.set(1.8, 0.85, 1.2);
    },
  };
}
