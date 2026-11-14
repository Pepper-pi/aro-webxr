// The ship, the meadow, and Long Lake. All of it is drawn in code. Nothing here is a picture or a recording.
import * as THREE from 'three';

const mat = (color) => new THREE.MeshBasicMaterial({ color });
const box = (w, h, d, color, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};

function sky(top, horizon) {
  const g = new THREE.SphereGeometry(40, 16, 10);
  const c = new THREE.Color(top), h = new THREE.Color(horizon);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 40 * 0.5 + 0.5, 0, 1);
    const k = c.clone().lerp(h, 1 - t);
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  mesh.frustumCulled = false;
  return mesh;
}

function ring(color) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#24180f'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#f1d9a4'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 300);
  g.fillStyle = '#f1d9a4'; g.font = '28px Georgia'; g.fillText('Where to', 58, 58);
  g.font = '24px Georgia'; g.fillText('Meadow', 62, 140); g.fillText('Long Lake', 48, 210);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function createZones({ scene, world, walker, camera }) {
  const saved = { home: world.home, edge: world.edge, colliders: world.colliders, walk: world.walk, blockers: world.blockers };
  const meadowRing = ring(0x9ee7ff);
  meadowRing.position.set(world.start.x, 0.15, world.start.z - 1.6);
  const hub = new THREE.Group();
  const lake = new THREE.Group();
  hub.add(sky('#2a2218', '#6a5340'));
  hub.add(box(6.2, 0.12, 5.2, '#a67c52', 0, -0.06, 0.4));
  hub.add(box(6.2, 2.3, 0.12, '#6b4a32', 0, 1.15, 2.55));
  hub.add(box(0.12, 2.3, 5.2, '#7a5538', -3.05, 1.15, 0.4));
  hub.add(box(0.12, 2.3, 5.2, '#7a5538', 3.05, 1.15, 0.4));
  hub.add(box(6.2, 0.1, 5.2, '#4a3428', 0, 2.3, 0.4));
  hub.add(box(1.4, 0.08, 0.7, '#c4a574', 0, 0.72, 1.55));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.45), new THREE.MeshBasicMaterial({ map: boardTexture() }));
  screen.position.set(0, 1.25, 2.46);
  screen.name = 'command-board';
  hub.add(screen);
  const hubRing = ring(0xffe08a);
  hubRing.position.set(0, 0.08, 0.35);
  hub.add(hubRing);
  const lamp = new THREE.PointLight(0xffc56a, 1.4, 8);
  lamp.position.set(0, 2, 0.6);
  hub.add(lamp);

  lake.add(sky('#f0a06a', '#f6d7b0'));
  lake.add(box(16, 0.2, 10, '#7d9a48', 0, -0.1, -2));
  const waterGeo = new THREE.PlaneGeometry(16, 14, 1, 1);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      precision mediump float; varying vec2 vUv; uniform float uTime;
      void main(){
        float r = sin(vUv.x * 28.0 + uTime * 1.6) * sin(vUv.y * 22.0 - uTime * 1.2);
        vec3 deep = vec3(0.05, 0.22, 0.34); vec3 mid = vec3(0.16, 0.45, 0.55);
        vec3 c = mix(deep, mid, 0.5 + 0.5 * r);
        c = mix(c * vec3(0.45, 0.6, 0.7), c, smoothstep(0.0, 0.45, vUv.y));
        gl_FragColor = vec4(c, 0.94);
      }`,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.05, 6);
  lake.add(water);
  for (let i = 0; i < 6; i++) lake.add(box(1.3, 0.08, 0.42, i % 2 ? '#c4a574' : '#a67c52', 0, 0.16, 1.2 + i * 0.55));
  for (let i = 0; i < 7; i++) {
    const reed = box(0.04, 0.9, 0.04, '#6a8a48', (i - 3) * 0.7, 0.4, 1.05);
    lake.add(reed);
  }
  const lakeRing = ring(0x9ee7ff);
  lakeRing.position.set(0, 0.2, -3.2);
  lake.add(lakeRing);
  const bobber = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#e23b32'));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat('#f7fbff'));
  cap.scale.y = 0.45; cap.position.y = 0.06;
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  rip.rotation.x = -Math.PI / 2;
  bobber.add(ball, cap, rip);
  bobber.visible = false;
  lake.add(bobber);

  scene.add(meadowRing, hub, lake);
  hub.visible = lake.visible = meadowRing.visible = false;

  const panel = document.getElementById('board');
  const back = document.getElementById('back');
  let name = 'hub';
  let dest = 'meadow';
  let armed = false;
  let bob = false;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const place = (x, z, yaw) => {
    walker.place(x, z, yaw);
    walker.feet.y = world.walk(x, z);
    walker.vel.set(0, 0, 0);
    armed = false;
  };
  function enter(next) {
    name = next;
    world.root.visible = next === 'meadow';
    hub.visible = next === 'hub';
    lake.visible = next === 'lake';
    meadowRing.visible = next === 'meadow';
    if (back) back.hidden = next === 'hub';
    if (panel && next !== 'hub') panel.hidden = true;
    world.blockers = next === 'meadow' ? saved.blockers : null;
    if (next === 'meadow') {
      world.home = saved.home; world.edge = saved.edge; world.colliders = saved.colliders; world.walk = saved.walk;
      place(world.start.x, world.start.z + 1.4, world.start.yaw);
    } else if (next === 'hub') {
      world.home = [0, 0.4]; world.edge = 2.45; world.colliders = [];
      world.walk = () => 0;
      place(0, -0.7, 0);
    } else {
      world.home = [0, -1]; world.edge = 7.5; world.colliders = [];
      world.walk = (x, z) => (Math.abs(x) < 0.7 && z > 0.8 && z < 4.6 ? 0.2 : z < 1.15 ? 0 : 0);
      place(0, -1.6, 0);
    }
  }
  function showBoard() { if (panel) panel.hidden = false; }
  panel?.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('pointerup', (e) => {
    dest = b.getAttribute('data-go');
    hubRing.material.color.set(dest === 'lake' ? 0x7ec8ff : 0xffe08a);
    panel.hidden = true;
    e.preventDefault();
    e.stopPropagation();
  }));
  back?.addEventListener('pointerup', (e) => { enter('hub'); e.preventDefault(); e.stopPropagation(); });
  addEventListener('pointerup', (e) => {
    if (name !== 'hub' || (e.target.closest && e.target.closest('#cast, #spell, #stick, #board, #back'))) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(screen, false).length) showBoard();
  });

  enter('hub');
  return {
    get name() { return name; },
    get blocksMagic() { return name !== 'meadow'; },
    showBoard, enter,
    onCast() {
      if (name !== 'lake') return;
      bob = !bob;
      bobber.visible = bob;
      if (bob) bobber.position.set(THREE.MathUtils.clamp(walker.feet.x, -2.2, 2.2), 0.2, 3.4);
    },
    update(dt) {
      waterMat.uniforms.uTime.value += dt;
      const gate = name === 'hub' ? hubRing.position : name === 'lake' ? lakeRing.position : meadowRing.position;
      const d = Math.hypot(walker.feet.x - gate.x, walker.feet.z - gate.z);
      if (d > 1.5) armed = true;
      if (name === 'lake') {
        const onDock = Math.abs(walker.feet.x) < 0.7 && walker.feet.z > 0.8 && walker.feet.z < 4.6;
        if (!onDock && walker.feet.z > 1.15) walker.feet.z = 1.15;
      }
      if (armed && d < 0.9) enter(name === 'hub' ? dest : 'hub');
      if (bob && bobber.visible) {
        const u = (waterMat.uniforms.uTime.value * 0.7) % 1;
        rip.scale.setScalar(0.7 + u * 1.4);
        rip.material.opacity = (1 - u) * 0.75;
      }
      hub.children[0].position.copy(camera.position);
      lake.children[0].position.copy(camera.position);
    },
  };
}
