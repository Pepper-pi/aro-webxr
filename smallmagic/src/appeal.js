// Runtime appeal. Nothing here rewrites a model file. Hair, hems, and a small
// charm are sprung onto the clothed companions after they load. A toon rim is
// a material swap on the live mesh. A rare shrine is built from new shapes.
import * as THREE from 'three';

const LOOK = {
  maren: { hair: '#6a2e28', hem: '#c45a4a', charm: '#e7c56a', phase: 0.2 },
  sable: { hair: '#1c2430', hem: '#3d7a8c', charm: '#d8e4ea', phase: 1.4 },
  bram: { hair: '#3a2a1c', hem: '#6a8f4a', charm: '#c4a574', phase: 2.2 },
  lumen: { hair: '#c9a15b', hem: '#f0d7a0', charm: '#fff1c4', phase: 3.1 },
};

function celMap() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 1;
  const g = c.getContext('2d');
  g.fillStyle = '#8a7a72';
  g.fillRect(0, 0, 2, 1);
  g.fillStyle = '#d7c2b4';
  g.fillRect(2, 0, 3, 1);
  g.fillStyle = '#fff4ea';
  g.fillRect(5, 0, 3, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const CEL = celMap();

function clothMat(color) {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

function toonize(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.appealPart) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!src) return;
    const mat = new THREE.MeshToonMaterial({
      map: src.map || null,
      color: src.color ? src.color.clone() : new THREE.Color('#ffffff'),
      gradientMap: CEL,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
         outgoingLight += vec3(1.0, 0.78, 0.62) * rim * 0.45;
         #include <opaque_fragment>`,
      );
    };
    o.material = mat;
  });
}

function dayRoll() {
  const day = new Date().toDateString();
  let h = 2166136261;
  for (const c of `${day}|blend`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function createAppeal(scene, world) {
  const springs = [];
  const poses = [];
  const locks = [];
  let quality = 1;
  let pending = 6;
  const tmp = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const euler = new THREE.Euler();

  function spring(obj, axis, rest, loose) {
    const row = { obj, axis, rest, a: rest, v: 0, loose: loose || 9, last: new THREE.Vector3(), drive: 0 };
    obj.getWorldPosition(row.last);
    springs.push(row);
    return row;
  }

  function dress(model, who) {
    if (!model || model.userData.appealed) return;
    model.userData.appealed = true;
    const look = LOOK[who] || LOOK.lumen;
    let head = null;
    let neck = null;
    model.updateWorldMatrix(true, true);
    model.traverse((o) => {
      if (o.name === 'Head') head = o;
      if (o.name === 'Neck') neck = o;
    });
    if (quality > 0) toonize(model);
    const follow = (bone) => {
      const g = new THREE.Group();
      scene.add(g);
      locks.push({ g, bone });
      return g;
    };
    if (head && quality > 0) {
      const face = follow(head);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), new THREE.MeshBasicMaterial({ color: '#fffaf6', transparent: true, opacity: 0.95, depthWrite: false }));
        eye.userData.appealPart = true;
        eye.position.set(side * 0.035, 0.04, -0.09);
        const light = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
        light.position.set(-0.005, 0.005, 0.002);
        eye.add(light);
        const blush = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), new THREE.MeshBasicMaterial({ color: '#e7a090', transparent: true, opacity: 0.4, depthWrite: false }));
        blush.userData.appealPart = true;
        blush.position.set(side * 0.055, -0.01, -0.085);
        face.add(eye, blush);
      }
    }
    if (neck) poses.push({ bone: neck, phase: look.phase });
  }

  const blend = new THREE.Group();
  blend.name = 'blend-spawn';
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 1.1), clothMat('#6d7264'));
  plinth.position.y = 0.14;
  const moss = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 1.15), clothMat('#3f6a45'));
  moss.position.y = 0.3;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.15, 0.22), clothMat('#8a8478'));
  left.position.set(-0.48, 0.85, 0);
  const right = left.clone();
  right.position.x = 0.48;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.16, 0.28), clothMat('#9a9184'));
  lintel.position.y = 1.46;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#d7fff6' }));
  core.position.y = 0.72;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 18), new THREE.MeshBasicMaterial({ color: '#7ee0ff' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.72;
  const gear = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 10), clothMat('#c4a574'));
  gear.position.set(0.72, 0.42, 0.15);
  const gear2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 8), clothMat('#e6c27a'));
  gear2.position.set(0.86, 0.58, 0.22);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), clothMat('#b8894a'));
  body.position.set(0.78, 0.28, 0.28);
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 7), clothMat('#5c4030'));
  cloak.position.set(0.78, 0.22, 0.28);
  blend.add(plinth, moss, left, right, lintel, core, ring, gear, gear2, body, cloak);
  blend.visible = false;
  scene.add(blend);

  function placeBlend() {
    const s = world.start || { x: 0, z: 0 };
    const x = s.x + 9;
    const z = s.z - 7;
    blend.position.set(x, world.ground(x, z), z);
  }
  function consider() {
    placeBlend();
    const roll = dayRoll();
    // About one day in eight is the shrine. One in five is at least the gadget.
    blend.visible = quality > 0 && roll < 0.2;
    blend.userData.tier = roll < 0.08 ? 'epic' : 'rare';
  }
  consider();

  function update(dt) {
    if (quality <= 0) return;
    const t = performance.now() * 0.001;
    for (const lock of locks) {
      lock.bone.getWorldPosition(lock.g.position);
      lock.bone.getWorldQuaternion(lock.g.quaternion);
    }
    for (const row of springs) {
      row.obj.getWorldPosition(tmp);
      const kick = (tmp.y - row.last.y) * 6 + Math.sin(t * 1.7 + row.loose) * 0.08;
      row.last.copy(tmp);
      row.v += ((row.rest - row.a) * row.loose - row.v * 3.2 + kick * 4) * dt;
      row.a += row.v;
      row.obj.rotation[row.axis] = row.a;
    }
    for (const pose of poses) {
      euler.set(Math.sin(t * 0.9 + pose.phase) * 0.045, 0, Math.sin(t * 0.55 + pose.phase) * 0.05);
      tilt.setFromEuler(euler);
      pose.bone.quaternion.multiply(tilt);
    }
    if (blend.visible) {
      core.rotation.y += dt * 0.8;
      ring.rotation.z += dt * 0.6;
      const pulse = 0.9 + Math.sin(t * 2.2) * 0.08;
      core.scale.setScalar(pulse);
    }
  }

  return {
    dress, update, blend,
    scan(root) {
      if (pending <= 0) return;
      root.traverse((o) => {
        if (pending <= 0) return;
        if (o.userData?.who && !o.userData.appealed) {
          dress(o, o.userData.who);
          pending -= 1;
        }
      });
    },
    set quality(v) {
      quality = v ? 1 : 0;
      if (!quality) blend.visible = false;
      else consider();
    },
    get quality() { return quality; },
    reveal() {
      placeBlend();
      blend.visible = true;
      blend.userData.tier = 'epic';
    },
    get spot() { return blend.position; },
  };
}
