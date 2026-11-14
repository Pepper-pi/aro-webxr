// Whoever is walking in the meadow: seen through their eyes. They walk, run and jump over the ground as it lies,
// are stopped by trunks and stones, and cannot leave the meadow.
import * as THREE from 'three';

const EYE = 1.66, WALK = 4.2, RUN = 6.6;
/** How far the eye's rise and fall has gone per metre walked (radians): one dip, and so one step heard, every 1.85 m. */
export const BOB = 3.4;

export class Walker {
  constructor(world) {
    this.world = world;
    this.feet = new THREE.Vector3(world.start.x, world.ground(world.start.x, world.start.z), world.start.z);
    this.vel = new THREE.Vector3();
    this.yaw = world.start.yaw; // looks along (sin yaw, 0, cos yaw)
    this.pitch = 0.04; // + looks down
    this.speed = 0; this.stride = 0; this.air = 0; this.landed = 0; this.grounded = true; this.mode = 'move';
    this.turned = new THREE.Vector2(); // how far the eye turned this frame
  }

  update(dt, inp) {
    const w = this.world, f = this.feet;
    this.yaw -= inp.look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch + inp.look.y, -1.35, 1.35);
    this.turned.set(inp.look.x, inp.look.y);
    // where they mean to go
    const top = inp.sprint ? RUN : WALK, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (inp.move.y * sy - inp.move.x * cy) * top, wz = (inp.move.y * cy + inp.move.x * sy) * top;
    const k = 1 - Math.exp(-dt * (this.grounded ? 11 : 2.5));
    this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    f.x += this.vel.x * dt; f.z += this.vel.z * dt;
    // trunks and stones
    for (const c of w.colliders) {
      if (c.tree?.down) continue;
      const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.32;
      if (d < min && d > 1e-4) { f.x = c.x + (dx / d) * min; f.z = c.z + (dz / d) * min; }
    }
    // and whatever is built and still standing
    w.blockers?.(f);
    // the meadow's edge
    { const dx = f.x - w.home[0], dz = f.z - w.home[1], d = Math.hypot(dx, dz); if (d > w.edge) { f.x = w.home[0] + (dx / d) * w.edge; f.z = w.home[1] + (dz / d) * w.edge; } }
    // the ground, and leaving it
    const g = (w.walk ?? w.ground)(f.x, f.z);
    if (this.grounded) {
      if (inp.jump) { this.vel.y = 4.6; this.grounded = false; this.air = 0; } else f.y = g;
    }
    if (!this.grounded) {
      this.vel.y -= 12.5 * dt; f.y += this.vel.y * dt; this.air += dt;
      if (f.y <= g && this.vel.y < 0) { f.y = g; this.landed = Math.min(1, -this.vel.y / 6); this.vel.y = 0; this.grounded = true; }
    }
    this.landed = Math.max(0, this.landed - dt * 3.2);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded) this.stride += this.speed * dt;
  }

  /** Puts the eye where theirs is. */
  look(camera) {
    const f = this.feet, s = Math.min(1, this.speed / WALK);
    const bob = Math.sin(this.stride * BOB) * 0.028 * s, sway = Math.cos(this.stride * BOB * 0.5) * 0.016 * s;
    camera.position.set(f.x + Math.cos(this.yaw) * sway, f.y + EYE + bob - 0.09 * this.landed, f.z - Math.sin(this.yaw) * sway);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(-this.pitch, this.yaw + Math.PI, 0);
  }

  place(x, z, yaw) {
    this.feet.set(x, this.world.ground(x, z), z);
    this.vel.set(0, 0, 0); this.yaw = yaw; this.grounded = true; this.speed = 0;
  }
}
