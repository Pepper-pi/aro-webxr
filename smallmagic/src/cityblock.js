// One seeded city block. The plan stays put. The seed only reskins it.
// Built from code and the CC0 wood and stone already in the hearth. No trees.
import * as THREE from 'three';

const STALLS = [[-2.2, 1.6], [1.1, 1.6], [4.2, 1.6], [7.2, 1.6]];
const LANTERNS = [];
for (let i = 0; i < 6; i++) LANTERNS.push([-4.2, -6 + i * 2.3]);
for (let i = 0; i < 4; i++) LANTERNS.push([2 + i * 3.2, -2.4]);
const HOUSES = [[8.6, -5.2], [8.6, -1.4], [8.6, 2.6], [8.6, 6.2]];

function theme(seed) {
  const moss = seed % 2 === 0;
  return moss
    ? {
      ground: '#6e7a62', wall: '#7a7368', roof: '#3e4a52', trim: '#b08a4a',
      water: '#2c4a44', light: '#d5e6a0', awning: '#6a7a58', moss: true,
    }
    : {
      ground: '#cbb89a', wall: '#e4d2b4', roof: '#8d5344', trim: '#f0d7a4',
      water: '#3c9aa6', light: '#ffd7a4', awning: '#c45a4a', moss: false,
    };
}

function instances(geo, mat, spots, y, rot) {
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    if (rot) dummy.rotation.z = rot;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createCityBlock(seed = 1) {
  const root = new THREE.Group();
  root.name = 'city-block';
  const look = theme(seed);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(22, 0.2, 18),
    new THREE.MeshLambertMaterial({ color: look.ground }),
  );
  ground.position.y = -0.1;
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.08, 18),
    new THREE.MeshLambertMaterial({ color: look.water }),
  );
  water.position.set(-8.6, 0.05, 0);
  const quay = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.28, 18),
    new THREE.MeshLambertMaterial({ color: look.trim }),
  );
  quay.position.set(-6.8, 0.1, 0);
  const street = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.04, 14),
    new THREE.MeshLambertMaterial({ color: look.moss ? '#5c6554' : '#b7a488' }),
  );
  street.position.set(0.4, 0.02, 0);
  const wallMat = new THREE.MeshLambertMaterial({ color: look.wall });
  const roofMat = new THREE.MeshLambertMaterial({ color: look.roof });
  const houses = instances(new THREE.BoxGeometry(3.2, 3.4, 2.8), wallMat, HOUSES, 1.7);
  const roofs = instances(new THREE.BoxGeometry(3.5, 0.28, 3.1), roofMat, HOUSES, 3.5);
  const postMat = new THREE.MeshLambertMaterial({ color: look.moss ? '#4a4034' : '#6a4a32' });
  const headMat = new THREE.MeshBasicMaterial({ color: look.light });
  const posts = instances(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), postMat, LANTERNS, 0.85);
  const heads = instances(new THREE.BoxGeometry(0.22, 0.28, 0.22), headMat, LANTERNS, 1.75);
  const stallMat = new THREE.MeshLambertMaterial({ color: look.awning });
  const stalls = instances(new THREE.BoxGeometry(1.5, 0.08, 1.1), stallMat, STALLS, 1.55);
  const crates = instances(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: look.trim }), STALLS, 0.24);
  const pipes = instances(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), new THREE.MeshLambertMaterial({ color: '#8a7348' }), HOUSES, 2.2, Math.PI / 2);
  pipes.visible = look.moss;
  const mossCaps = instances(new THREE.SphereGeometry(0.45, 6, 4), new THREE.MeshLambertMaterial({ color: '#4f7a48' }), HOUSES, 3.7);
  mossCaps.visible = look.moss;
  const dock = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 2.6), new THREE.MeshLambertMaterial({ color: look.trim }));
  pad.position.y = 1.7;
  const legGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.7, 5);
  const legMat = new THREE.MeshLambertMaterial({ color: look.roof });
  [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.85, z);
    dock.add(leg);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 16), new THREE.MeshBasicMaterial({ color: look.light }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.82;
  dock.add(pad, ring);
  dock.position.set(2.4, 0, -7.2);
  const lamp = new THREE.PointLight(look.light, look.moss ? 0.7 : 1.1, 9, 2);
  lamp.position.set(-1, 2.2, 0);
  const fill = new THREE.HemisphereLight(look.moss ? '#c5d4c0' : '#f4f7fb', look.moss ? '#3a4034' : '#8a7a68', 1.05);
  root.add(ground, water, quay, street, houses, roofs, posts, heads, stalls, crates, pipes, mossCaps, dock, lamp, fill);
  return { root, seed };
}
