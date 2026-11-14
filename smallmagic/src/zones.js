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

function labelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 36px Georgia';
  g.fillStyle = '#f6ead0';
  g.textAlign = 'center';
  g.fillText(text, 128, 46);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  s.userData.canvas = c;
  return s;
}
function paintLabel(sprite, text) {
  const c = sprite.userData.canvas, g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = 'bold 36px Georgia';
  g.fillStyle = '#f6ead0';
  g.textAlign = 'center';
  g.fillText(text, 128, 46);
  sprite.material.map.needsUpdate = true;
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
  hubRing.position.set(0, 0.08, 1.55);
  const destTag = labelSprite('Meadow');
  destTag.position.y = 0.7;
  hubRing.add(destTag);
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
  const target = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 24), new THREE.MeshBasicMaterial({ color: 0xffe7a8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  target.rotation.x = -Math.PI / 2;
  target.visible = false;
  lake.add(target);
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

  const hold = new THREE.Group();
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 8), mat('#6a3a22'));
  const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.016, 0.7, 8), mat('#e2c48a'));
  blank.position.y = 0.4;
  const tipM = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.006, 0.26, 6), mat('#f2e2b8'));
  tipM.position.y = 0.86;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), mat('#c4a06a'));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.045, 0.1, 0);
  rod.add(grip, blank, tipM, reel);
  rod.position.set(0.16, -0.2, -0.9);
  rod.rotation.set(0.72, 0.05, -0.35);
  hold.add(rod);
  scene.add(hold);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xd8fbff }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  const splash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mat('#e7f6ff'));
  splash.visible = false;
  lake.add(splash);

  const panel = document.getElementById('board');
  const menu = document.getElementById('menu');
  const back = document.getElementById('back');
  const reelBtn = document.getElementById('reel');
  const catchEl = document.getElementById('catch');
  const FISH = ['Bluegill', 'Sunperch', 'Reed carp', 'Golden shiner', 'Creek trout'];
  let name = 'hub';
  let dest = 'meadow';
  let armUntil = 0;
  let leftRing = false;
  let boardHeld = false;
  let phase = 'idle';
  let biteAt = 0;
  let biteUntil = 0;
  let reelT = 0;
  let power = 0.35;
  const tipW = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const place = (x, z, yaw) => {
    walker.place(x, z, yaw);
    walker.feet.y = world.walk(x, z);
    walker.vel.set(0, 0, 0);
    armUntil = performance.now() + 2000;
    leftRing = false;
  };
  function markDest() {
    const lakeGo = dest === 'lake';
    hubRing.material.color.set(lakeGo ? 0x7ec8ff : 0xffe08a);
    paintLabel(destTag, lakeGo ? 'Long Lake' : 'Meadow');
  }
  function showBoard() { if (panel) panel.hidden = false; }
  function hideBoard() { if (panel) panel.hidden = true; }
  function resetFish() {
    phase = 'idle';
    bobber.visible = false;
    line.visible = false;
    target.visible = false;
    splash.visible = false;
    if (reelBtn) reelBtn.hidden = true;
  }
  function enter(next) {
    name = next;
    world.root.visible = next === 'meadow';
    hub.visible = next === 'hub';
    lake.visible = next === 'lake';
    meadowRing.visible = next === 'meadow';
    hold.visible = next === 'lake';
    if (back) back.hidden = next === 'hub';
    if (next !== 'hub') hideBoard();
    if (menu) menu.hidden = true;
    world.blockers = next === 'meadow' ? saved.blockers : null;
    world.wade = null;
    resetFish();
    if (next === 'meadow') {
      world.home = saved.home; world.edge = saved.edge; world.colliders = saved.colliders; world.walk = saved.walk;
      const yaw = world.start.yaw + Math.PI;
      place(meadowRing.position.x + Math.sin(yaw) * 3.4, meadowRing.position.z + Math.cos(yaw) * 3.4, yaw);
    } else if (next === 'hub') {
      world.home = [0, 0]; world.edge = 2.55; world.colliders = [];
      world.walk = () => 0;
      place(0, -1.55, Math.PI);
      boardHeld = false;
      showBoard();
    } else {
      world.home = [0, 0]; world.edge = 7.5; world.colliders = [];
      world.walk = (x, z) => (Math.abs(x) < 0.75 && z > 0.9 && z < 4.8 ? 0.22 : 0);
      world.wade = (x, z) => z > 0.7;
      place(0, 0.2, 0);
    }
  }
  panel?.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('pointerup', (e) => {
    dest = b.getAttribute('data-go');
    markDest();
    boardHeld = true;
    hideBoard();
    e.preventDefault();
    e.stopPropagation();
  }));
  document.getElementById('boardX')?.addEventListener('pointerup', (e) => { hideBoard(); boardHeld = true; e.preventDefault(); e.stopPropagation(); });
  menu?.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('pointerup', (e) => {
    enter(b.getAttribute('data-trip'));
    e.preventDefault();
    e.stopPropagation();
  }));
  document.getElementById('menuX')?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = true; e.preventDefault(); e.stopPropagation(); });
  document.getElementById('menubtn')?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = false; e.preventDefault(); e.stopPropagation(); });
  back?.addEventListener('pointerup', (e) => { if (menu) menu.hidden = false; e.preventDefault(); e.stopPropagation(); });
  reelBtn?.addEventListener('pointerup', (e) => {
    if (phase === 'bite') { phase = 'reel'; reelT = 0; reelBtn.hidden = true; }
    e.preventDefault();
    e.stopPropagation();
  });
  document.getElementById('catchOk')?.addEventListener('pointerup', (e) => { if (catchEl) catchEl.hidden = true; resetFish(); e.preventDefault(); e.stopPropagation(); });
  addEventListener('pointerup', (e) => {
    if (name !== 'hub' || (e.target.closest && e.target.closest('#cast, #spell, #stick, #board, #menu, #back, #menubtn, #reel, #catch'))) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(screen, false).length) showBoard();
  });

  enter('hub');
  markDest();
  return {
    get name() { return name; },
    get blocksMagic() { return name !== 'meadow'; },
    showBoard, enter,
    castHeld(_held, pressed, released) {
      if (name !== 'lake') return;
      if (pressed) { phase = 'aim'; power = 0.3; target.visible = true; }
      if (_held && phase === 'aim') power = Math.min(1, power + 0.015);
      if (released && phase === 'aim') {
        phase = 'wait';
        target.visible = false;
        bobber.visible = true;
        bobber.position.set(0, 0.16, 2.2 + power * 3.6);
        line.visible = true;
        biteAt = performance.now() + 2200 + Math.random() * 2500;
      }
    },
    update(dt) {
      waterMat.uniforms.uTime.value += dt;
      const gate = name === 'hub' ? hubRing.position : name === 'lake' ? lakeRing.position : meadowRing.position;
      const d = Math.hypot(walker.feet.x - gate.x, walker.feet.z - gate.z);
      if (d > 2.15) leftRing = true;
      if (leftRing && performance.now() >= armUntil && d < 0.95) enter(name === 'hub' ? dest : 'hub');
      if (name === 'hub') {
        const bd = Math.hypot(walker.feet.x - screen.position.x, walker.feet.z - screen.position.z);
        if (bd > 2.1) boardHeld = false;
        if (!boardHeld && bd < 1.7 && panel?.hidden) showBoard();
      }
      if (name === 'lake') {
        const onDock = Math.abs(walker.feet.x) < 0.75 && walker.feet.z > 0.9 && walker.feet.z < 4.8;
        if (!onDock && walker.feet.z > 1.05) walker.feet.z = 1.05;
        if (phase === 'aim') target.position.set(0, 0.05, 2.2 + power * 3.6);
        if (phase === 'wait' && performance.now() >= biteAt) {
          phase = 'bite';
          biteUntil = performance.now() + 1700;
          if (reelBtn) reelBtn.hidden = false;
        }
        if (phase === 'bite') {
          bobber.position.y = 0.02 + Math.sin(performance.now() * 0.02) * 0.08;
          splash.visible = true;
          splash.position.copy(bobber.position);
          splash.scale.setScalar(1 + Math.sin(performance.now() * 0.03));
          if (performance.now() > biteUntil) { phase = 'idle'; resetFish(); }
        }
        if (phase === 'reel') {
          reelT += dt;
          bobber.position.lerp(walker.feet, Math.min(1, dt * 3));
          bobber.position.y = 0.2;
          if (reelT > 0.7) {
            const title = document.getElementById('catchName');
            if (title) title.textContent = FISH[Math.floor(Math.random() * FISH.length)];
            if (catchEl) catchEl.hidden = false;
            phase = 'caught';
            line.visible = false;
            bobber.visible = false;
            splash.visible = false;
          }
        }
        if (line.visible) {
          hold.position.copy(camera.position);
          hold.quaternion.copy(camera.quaternion);
          tipM.getWorldPosition(tipW);
          const pos = lineGeo.attributes.position;
          const end = bobber.position;
          for (let i = 0; i < 8; i++) {
            const t = i / 7;
            const sag = Math.sin(t * Math.PI) * 0.12;
            pos.setXYZ(i, tipW.x + (end.x - tipW.x) * t, tipW.y + (end.y - tipW.y) * t - sag, tipW.z + (end.z - tipW.z) * t);
          }
          pos.needsUpdate = true;
        }
        if (bobber.visible && phase !== 'bite') {
          const u = (waterMat.uniforms.uTime.value * 0.7) % 1;
          rip.scale.setScalar(0.8 + u * 1.3);
          rip.material.opacity = (1 - u) * 0.7;
        }
      } else hold.visible = false;
      hub.children[0].position.copy(camera.position);
      lake.children[0].position.copy(camera.position);
    },
  };
}
