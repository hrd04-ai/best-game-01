// NOVA KEEPER — the Keeper: movement, health, starlight (XP) and levels.
// The Keeper is a lone wisp of light; everything else in the game orbits
// this one object.

import { ARENA, PLAYER } from './config.js';
import { clamp } from './random.js';

/** The Keeper's derived combat stats (weapons and passives feed these). */
export function baseStats() {
  return {
    speed: PLAYER.speed,
    maxHp: PLAYER.maxHp,
    magnet: PLAYER.magnetRadius,
    damage: 1, // multiplier
    haste: 1, // cooldown multiplier (lower is faster)
    crit: 0.05, // base 5% critical chance
  };
}

/** The player character: position, health, XP, and the level-up queue. */
export class Player {
  constructor() {
    this.x = ARENA.width / 2;
    this.y = ARENA.height / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER.radius;
    this.hp = PLAYER.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpNext = PLAYER.xpForLevel(1);
    this.invulnerable = 0;
    this.facing = 0;
    this.pendingLevels = 0; // levels banked while a choice screen is open
    this.moveTime = 0;
  }

  get maxHp() {
    return this.stats?.maxHp ?? PLAYER.maxHp;
  }

  get alive() {
    return this.hp > 0;
  }

  /** Move by a normalized vector, clamped to the arena. */
  move(dt, vector, speed) {
    const targetVx = vector.x * speed;
    const targetVy = vector.y * speed;
    const blend = 1 - Math.exp(-14 * dt); // snappy but smooth acceleration
    this.vx += (targetVx - this.vx) * blend;
    this.vy += (targetVy - this.vy) * blend;
    this.x = clamp(this.x + this.vx * dt, this.radius, ARENA.width - this.radius);
    this.y = clamp(this.y + this.vy * dt, this.radius, ARENA.height - this.radius);
    if (Math.hypot(this.vx, this.vy) > 12) {
      this.facing = Math.atan2(this.vy, this.vx);
      this.moveTime += dt;
    }
  }

  /** Steer toward a point (mouse control): returns the move vector. */
  steerToward(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 8) return { x: 0, y: 0 };
    const strength = Math.min(1, distance / 90);
    return { x: (dx / distance) * strength, y: (dy / distance) * strength };
  }

  /** Take a hit; returns the damage actually applied (0 during grace). */
  hurt(amount) {
    if (this.invulnerable > 0 || !this.alive) return 0;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerable = PLAYER.invulnerableSeconds;
    return amount;
  }

  /** Restore health, up to the maximum. */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Add starlight; returns the number of levels gained. */
  gainXp(amount) {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = PLAYER.xpForLevel(this.level);
      this.pendingLevels += 1;
      gained += 1;
    }
    return gained;
  }

  /** Tick the invulnerability timer. */
  update(dt) {
    if (this.invulnerable > 0) this.invulnerable -= dt;
  }

  /** Reset for a new run. */
  reset() {
    this.x = ARENA.width / 2;
    this.y = ARENA.height / 2;
    this.vx = 0;
    this.vy = 0;
    this.hp = PLAYER.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpNext = PLAYER.xpForLevel(1);
    this.invulnerable = 0;
    this.facing = 0;
    this.pendingLevels = 0;
    this.moveTime = 0;
  }
}
