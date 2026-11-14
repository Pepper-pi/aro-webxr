// Keyboard, mouse and gamepad, read once a frame into one plain state.
//   move: {x, y} (x right, y forward, length 0..1), walk, sprint, strafe (held),
//   jump (pressed this frame), look: {x, y} (radians this frame), zoom (wheel steps this frame)
export class Input {
  constructor(el, { pads = true } = {}) {
    this.el = el;
    this.pads = pads; // off in headless checks: this PC's real gamepad shows up in headless browsers too
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, wheel: 0, right: false, drag: false };
    this.walkToggle = false;
    this.pad = { a: false, l3: false, sprint: false, lb: false, rb: false, start: false, any: false };
    this.sensitivity = 0.0022;
    this.override = null; // scripted input for captures
    this.lockable = true;
    const typing = () => document.activeElement?.tagName === 'INPUT';
    const down = (e) => {
      if (typing()) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'CapsLock') this.walkToggle = !this.walkToggle;
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', () => this.keys.clear());
    this.touchAt = 0;
    this.stick = { x: 0, y: 0 };
    this.lookDx = 0; this.lookDy = 0;
    this.casting = false; this.wasCasting = false; this.spellPulse = 0;
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.touchAt = performance.now(); }, true);
    el.addEventListener('mousedown', (e) => {
      if (performance.now() - this.touchAt < 700) return;
      if (e.button === 2) this.mouse.right = true;
      // a click locks the mouse for looking, except while a panel or the replay wants the mouse
      if (e.button === 0 && this.lockable && document.pointerLockElement !== el) el.requestPointerLock?.()?.catch?.(() => {});
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.mouse.right = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el || this.mouse.right) { this.mouse.x += e.movementX; this.mouse.y += e.movementY; }
    });
    el.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  read(dt) {
    if (this.override) return this.override(dt);
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const s = {
      move: { x, y },
      walk: this.walkToggle !== (k.has('AltLeft') || k.has('AltRight')),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      strafe: (this.mouse.right && document.pointerLockElement === this.el) || k.has('KeyF'),
      jump: this.pressed.has('Space'),
      look: { x: this.mouse.x * this.sensitivity, y: this.mouse.y * this.sensitivity },
      zoom: this.mouse.wheel,
      device: 'keyboard',
      // (from a pad only: the cast held, a step to the next spell or the last, pause pressed, any button down)
      cast: null, spell: 0, pause: false, any: false,
    };
    this.mouse.x = this.mouse.y = this.mouse.wheel = 0;
    this.pressed.clear();
    if (this.stick.x || this.stick.y) {
      s.move = { x: this.stick.x, y: this.stick.y };
      s.walk = false;
      s.device = 'pad';
    }
    s.look.x += this.lookDx * this.sensitivity;
    s.look.y += this.lookDy * this.sensitivity;
    this.lookDx = this.lookDy = 0;
    if (this.casting || this.wasCasting) s.cast = this.casting;
    this.wasCasting = this.casting;
    if (this.spellPulse) { s.spell = this.spellPulse; this.spellPulse = 0; }

    // gamepad: left stick moves (its tilt sets the speed), right stick looks, pressing the left stick sprints, the
    // bottom button jumps, the right trigger casts, the shoulders change spell, Start pauses
    const pad = this.pads ? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected) : null;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : Math.sign(v) * (Math.abs(v) - 0.15) / 0.85);
      let px = dz(pad.axes[0] ?? 0), py = -dz(pad.axes[1] ?? 0);
      const pl = Math.hypot(px, py);
      if (pl > 1) { px /= pl; py /= pl; }
      const btn = (i) => !!pad.buttons[i]?.pressed;
      if (pl > 0.01) { s.move = { x: px, y: py }; s.device = 'pad'; s.walk = false; }
      const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
      s.look.x += rx * Math.abs(rx) * 3.2 * dt;
      s.look.y += ry * Math.abs(ry) * 2.2 * dt;
      if (btn(10) && !this.pad.l3) this.pad.sprint = !this.pad.sprint;
      if (pl < 0.2) this.pad.sprint = false;
      if (this.pad.sprint) s.sprint = true;
      s.cast = (pad.buttons[7]?.value ?? 0) > 0.4;
      if (btn(5) && !this.pad.rb) s.spell = 1; else if (btn(4) && !this.pad.lb) s.spell = -1;
      if (btn(9) && !this.pad.start) s.pause = true;
      s.any = pad.buttons.some((b, i) => i !== 16 && b.pressed);
      this.pad.rb = btn(5); this.pad.lb = btn(4); this.pad.start = btn(9);
      if (btn(0) && !this.pad.a) s.jump = true;
      if ((pad.buttons[6]?.value ?? 0) > 0.4) s.strafe = true;
      if (btn(12)) s.zoom -= 4 * dt;
      if (btn(13)) s.zoom += 4 * dt;
      this.pad.a = btn(0); this.pad.l3 = btn(10);
      if (rx || ry || pl > 0.01 || btn(0)) s.device = 'pad';
    }
    return s;
  }

  bindTouch(root) {
    const stick = root.querySelector('#stick');
    const knob = root.querySelector('#knob');
    const cast = root.querySelector('#cast');
    const spell = root.querySelector('#spell');
    const max = 46;
    let sid = null;
    const place = (e) => {
      const r = stick.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, max);
      knob.style.transform = `translate(${(dx / len) * cl}px, ${(dy / len) * cl}px)`;
      this.stick.x = (dx / len) * cl / max;
      this.stick.y = -((dy / len) * cl) / max;
    };
    const endStick = (e) => {
      if (sid != null && e.pointerId !== sid) return;
      sid = null;
      this.stick.x = this.stick.y = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerdown', (e) => {
      sid = e.pointerId;
      try { stick.setPointerCapture(e.pointerId); } catch { /* a touch that cannot be captured still moves */ }
      this.touchAt = performance.now();
      place(e);
      e.preventDefault();
      e.stopPropagation();
    });
    addEventListener('pointermove', (e) => { if (e.pointerId === sid) place(e); });
    addEventListener('pointerup', endStick);
    addEventListener('pointercancel', endStick);
    const hold = (btn, on) => {
      btn.addEventListener('pointerdown', (e) => { this.touchAt = performance.now(); on(true); e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('pointerup', (e) => { on(false); e.preventDefault(); });
      btn.addEventListener('pointercancel', () => on(false));
    };
    hold(cast, (v) => { this.casting = v; });
    spell.addEventListener('pointerdown', (e) => { this.touchAt = performance.now(); e.preventDefault(); e.stopPropagation(); });
    spell.addEventListener('pointerup', (e) => { this.spellPulse = 1; e.preventDefault(); });
    let lid = null, lx = 0, ly = 0;
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || e.clientX < innerWidth * 0.42) return;
      if (e.target.closest && e.target.closest('#cast, #spell, #stick, #board, #back')) return;
      lid = e.pointerId; lx = e.clientX; ly = e.clientY;
      this.touchAt = performance.now();
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      this.lookDx += e.clientX - lx;
      this.lookDy += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lid) lid = null; };
    addEventListener('pointerup', endLook);
    addEventListener('pointercancel', endLook);
  }
}
