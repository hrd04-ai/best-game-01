// NOVA KEEPER — juice: particles, expanding shockwaves, floating damage
// numbers and screen shake. Purely cosmetic: nothing here changes the
// simulation, so the screenshot scenes can stage it freely.

const MAX_PARTICLES = 420;
const MAX_TEXTS = 64;

/** A burst of glowing sparks with drag and fade. */
export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
    this.shockwaves = [];
    this.shakeTime = 0;
    this.shakeStrength = 0;
  }

  /** Spawn a burst of sparks at a point. */
  burst(x, y, { count = 10, color = '#4df3ff', speed = 180, size = 3, life = 0.5 }) {
    for (let i = 0; i < count; i += 1) {
      if (this.list.length >= MAX_PARTICLES) return;
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.35 + Math.random() * 0.85);
      this.list.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: size * (0.6 + Math.random() * 0.8),
        life: life * (0.6 + Math.random() * 0.8),
        age: 0,
        color,
      });
    }
  }

  /** A trail spark behind a moving object (short-lived, low speed). */
  trail(x, y, color, size = 2.5) {
    if (this.list.length >= MAX_PARTICLES) return;
    this.list.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 24,
      vy: (Math.random() - 0.5) * 24,
      size,
      life: 0.35,
      age: 0,
      color,
    });
  }

  /** An expanding ring, for novas, explosions and level-ups. */
  shockwave(x, y, { color = '#4df3ff', maxRadius = 120, seconds = 0.45, width = 4 }) {
    this.shockwaves.push({ x, y, color, maxRadius, seconds, width, age: 0 });
  }

  /** Floating text that rises and fades (damage, pickups, announcements). */
  floatText(x, y, text, { color = '#ffffff', size = 15, seconds = 0.8 } = {}) {
    if (this.texts.length >= MAX_TEXTS) this.texts.shift();
    this.texts.push({
      x: x + (Math.random() - 0.5) * 14,
      y,
      text,
      color,
      size,
      seconds,
      age: 0,
    });
  }

  /** A camera jolt; strength in pixels, decaying over `seconds`. */
  shake(strength, seconds = 0.3) {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, seconds);
  }

  /** Advance all effects by dt seconds. */
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.age += dt;
      t.y -= 34 * dt;
      if (t.age >= t.seconds) this.texts.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const s = this.shockwaves[i];
      s.age += dt;
      if (s.age >= s.seconds) this.shockwaves.splice(i, 1);
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeStrength = 0;
    }
  }

  /** The current shake offset, or {x: 0, y: 0} when settled. */
  get offset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const s = this.shakeStrength * (this.shakeTime / 0.3);
    return {
      x: (Math.random() - 0.5) * 2 * s,
      y: (Math.random() - 0.5) * 2 * s,
    };
  }

  /** Draw every live effect onto the context. */
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of this.shockwaves) {
      const t = s.age / s.seconds;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.maxRadius * t, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = t.age < t.seconds * 0.6 ? 1 : 1 - (t.age - t.seconds * 0.6) / (t.seconds * 0.4);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `700 ${t.size}px system-ui, 'Segoe UI', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  /** Clear every effect (on restart). */
  clear() {
    this.list.length = 0;
    this.texts.length = 0;
    this.shockwaves.length = 0;
    this.shakeTime = 0;
    this.shakeStrength = 0;
  }
}
