// NOVA KEEPER — the Voidspawn: five swarm types, the spawn director that
// raises the pressure over ten minutes, and each type's movement AI. The
// three bosses live in bosses.js; this file only spawns them on schedule.

import { ARENA, SPAWN } from './config.js';
import { BOSS_TYPES, BOSS_SCHEDULE } from './bosses.js';
import { clamp, dist2 } from './random.js';

/** The swarm bestiary: every type's shape, stats and behaviour. */
export const ENEMY_TYPES = {
  mote: {
    name: 'Mote', radius: 12, speed: 72, hp: 16, damage: 10, xp: 1, score: 10,
    color: '#ff4da6', core: '#ffd6e8', shape: 'spike', unlockAt: 0, weight: 10,
  },
  darter: {
    name: 'Darter', radius: 9, speed: 152, hp: 10, damage: 8, xp: 1, score: 15,
    color: '#ff9f43', core: '#ffe3c2', shape: 'dart', unlockAt: 60, weight: 6,
  },
  bulwark: {
    name: 'Bulwark', radius: 23, speed: 44, hp: 95, damage: 16, xp: 3, score: 30,
    color: '#b388ff', core: '#e6dcff', shape: 'hex', unlockAt: 90, weight: 4,
  },
  spitter: {
    name: 'Spitter', radius: 13, speed: 62, hp: 26, damage: 6, xp: 2, score: 25,
    color: '#4dff88', core: '#d6ffe2', shape: 'diamond', unlockAt: 150, weight: 4,
    ranged: true, range: 260, shotCooldown: 2.1, boltSpeed: 210,
  },
  splitter: {
    name: 'Splitter', radius: 16, speed: 82, hp: 36, damage: 12, xp: 2, score: 20,
    color: '#ff4d6d', core: '#ffd6dd', shape: 'twin', unlockAt: 210, weight: 4,
    splitsInto: 'mote', splitCount: 2,
  },
};

/** One live enemy: type, position, health, and AI timers. */
export class Enemy {
  constructor(type, x, y, hpScale, rng) {
    // Swarm types come from ENEMY_TYPES, bosses from BOSS_TYPES.
    const def = ENEMY_TYPES[type] ?? BOSS_TYPES[type];
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.hp = Math.round(def.hp * hpScale);
    this.maxHp = this.hp;
    this.speed = def.speed * rng.range(0.92, 1.08);
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.flash = 0; // hit-flash timer for the renderer
    this.shotTimer = rng.range(0.5, def.shotCooldown ?? 1);
    this.wobble = rng.range(0, Math.PI * 2); // per-enemy animation phase
    this.telegraph = SPAWN.telegraphSeconds; // counts down before it wakes
    this.knockX = 0;
    this.knockY = 0;
    // Boss-only timers: the Devourer's charge and the Herald's summons.
    this.chargeTimer = def.charge ? rng.range(4, 6) : 0;
    this.chargeState = 'idle'; // 'idle' | 'windup' | 'dashing'
    this.chargeDir = { x: 1, y: 0 }; // locked when the windup starts
    this.chargeTime = 0;
    this.summonTimer = def.summons ? rng.range(5, 7) : 0;
  }

  get radius() {
    return this.def.radius;
  }

  get alive() {
    return this.hp > 0;
  }

  get awake() {
    return this.telegraph <= 0;
  }

  get slowed() {
    return this.slowUntil > 0;
  }

  /** Apply damage; returns true when this kills the enemy. */
  damage(amount) {
    this.hp -= amount;
    this.flash = 0.09;
    return this.hp <= 0;
  }

  /** Push the enemy away from a hit. */
  knockback(dx, dy, force) {
    const len = Math.hypot(dx, dy) || 1;
    this.knockX += (dx / len) * force;
    this.knockY += (dy / len) * force;
  }

  /** Slow the enemy to `factor` of its speed for `seconds`. */
  slow(factor, seconds) {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, seconds);
  }

  /**
   * Steer toward (or, for ranged types, around) the player, then integrate
   * movement and knockback. Returns 'shoot' when a ranged enemy fires, or
   * 'summon' when the Herald births Motes. The Devourer's charge overrides
   * steering: it winds up (frozen, telegraphing), then dashes in a straight
   * line — the renderer draws the warning, the autopilot sidesteps it.
   */
  update(dt, player, now, bolts, rng) {
    if (this.flash > 0) this.flash -= dt;
    if (this.slowUntil > 0) {
      this.slowUntil -= dt;
      if (this.slowUntil <= 0) this.slowFactor = 1;
    }
    if (this.telegraph > 0) {
      this.telegraph -= dt;
      return null;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = this.speed * (this.slowed ? this.slowFactor : 1);
    let mx = dx / distance;
    let my = dy / distance;
    if (this.def.ranged && !this.def.boss && distance < this.def.range * 0.75) {
      // Spitters keep their distance: back away when the player closes in.
      mx = -mx;
      my = -my;
    }
    // The Devourer's charge: wind up frozen, then dash along a locked line.
    let moveSpeed = speed;
    let wobbleAmp = 0.35;
    if (this.def.charge) {
      if (this.chargeState === 'windup') {
        this.chargeTime -= dt;
        if (this.chargeTime <= 0) {
          this.chargeState = 'dashing';
          this.chargeTime = 0.45;
        }
        moveSpeed = 0;
        wobbleAmp = 0;
      } else if (this.chargeState === 'dashing') {
        mx = this.chargeDir.x;
        my = this.chargeDir.y;
        moveSpeed = 560;
        wobbleAmp = 0;
        this.chargeTime -= dt;
        if (this.chargeTime <= 0) {
          this.chargeState = 'idle';
          this.chargeTimer = rng.range(5, 7);
        }
      } else {
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0 && distance < 520) {
          this.chargeState = 'windup';
          this.chargeTime = 0.6;
          this.chargeDir = { x: dx / distance, y: dy / distance };
          moveSpeed = 0;
          wobbleAmp = 0;
        }
      }
    }
    // A slight sideways wobble keeps the swarm from moving in lockstep.
    const wobble = Math.sin(now * 2.1 + this.wobble) * wobbleAmp;
    const px = -my * wobble;
    const py = mx * wobble;
    this.x += (mx + px) * moveSpeed * dt + this.knockX * dt;
    this.y += (my + py) * moveSpeed * dt + this.knockY * dt;
    this.knockX *= 1 - 8 * dt;
    this.knockY *= 1 - 8 * dt;
    this.x = clamp(this.x, this.radius, ARENA.width - this.radius);
    this.y = clamp(this.y, this.radius, ARENA.height - this.radius);

    // The Herald births Motes on its own clock.
    if (this.def.summons) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = this.def.summonCooldown;
        return 'summon';
      }
    }

    if (this.def.ranged) {
      this.shotTimer -= dt;
      if (this.shotTimer <= 0 && distance < this.def.range) {
        this.shotTimer = this.def.shotCooldown;
        return 'shoot';
      }
    }
    return null;
  }
}

/** An enemy projectile (spitter bolts and warden radial shots). */
export class Bolt {
  constructor(x, y, vx, vy, damage, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.color = color;
    this.radius = 6;
    this.life = 2.5;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0 && this.x > -20 && this.x < ARENA.width + 20 && this.y > -20 && this.y < ARENA.height + 20;
  }
}

/**
 * The spawn director: picks what spawns, where, and how fast, from the
 * elapsed time. Bosses arrive on a fixed schedule, one at a time.
 */
export class SpawnDirector {
  constructor(rng) {
    this.rng = rng;
    this.timer = 0;
    this.bossesSpawned = 0;
    this.eliteAt = 0;
  }

  /** Seconds between spawn ticks at this elapsed time. */
  intervalAt(elapsed) {
    const t = clamp(elapsed / 600, 0, 1);
    return SPAWN.intervalStart + (SPAWN.intervalEnd - SPAWN.intervalStart) * t;
  }

  /** Enemies per tick at this elapsed time. */
  batchAt(elapsed) {
    const t = clamp(elapsed / 600, 0, 1);
    return Math.round(SPAWN.batchStart + (SPAWN.batchEnd - SPAWN.batchStart) * t);
  }

  /** HP multiplier for enemies spawned at this elapsed time. */
  hpScaleAt(elapsed) {
    return 1 + elapsed * SPAWN.hpScalePerSecond;
  }

  /** Bosses scale more gently than the swarm, so they stay killable. */
  bossHpScaleAt(elapsed) {
    return 1 + elapsed / 300;
  }

  /** Weighted pick of an unlocked, non-boss type. */
  pickType(elapsed, enemies) {
    // Spitters are capped: too many ranged attackers drown the arena in bolts.
    const spitters = enemies.filter((e) => e.type === 'spitter').length;
    const pool = Object.entries(ENEMY_TYPES)
      .filter(([, def]) => !def.boss && elapsed >= def.unlockAt)
      .filter(([type]) => type !== 'spitter' || spitters < 8)
      .map(([type, def]) => ({ type, weight: def.weight }));
    let total = 0;
    for (const entry of pool) total += entry.weight;
    let roll = this.rng.next() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.type;
    }
    return 'mote';
  }

  /** A spawn point on a random arena edge, away from the player. */
  spawnPoint(player) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const edge = this.rng.int(0, 3);
      let x;
      let y;
      if (edge === 0) { x = this.rng.range(0, ARENA.width); y = 24; }
      else if (edge === 1) { x = this.rng.range(0, ARENA.width); y = ARENA.height - 24; }
      else if (edge === 2) { x = 24; y = this.rng.range(0, ARENA.height); }
      else { x = ARENA.width - 24; y = this.rng.range(0, ARENA.height); }
      if (dist2(x, y, player.x, player.y) > 260 * 260) return { x, y };
    }
    return { x: 24, y: 24 };
  }

  /**
   * Advance the director; returns the list of enemies to spawn this step
   * (possibly empty). `bossAlive` suppresses a scheduled boss until the
   * current one falls. In the final minute the Nova's returning light thins
   * the swarm, so the climax is a triumph, not a wall.
   */
  update(dt, elapsed, player, enemies, bossAlive) {
    const enemyCount = enemies.length;
    const spawned = [];
    // Boss schedule: the Warden at 2:30, the Herald at 5:00, the Devourer
    // at 7:30, one at a time (see BOSS_SCHEDULE in bosses.js).
    const nextBoss = BOSS_SCHEDULE[this.bossesSpawned];
    if (nextBoss && elapsed >= nextBoss.at && !bossAlive) {
      const point = this.spawnPoint(player);
      spawned.push(new Enemy(nextBoss.type, point.x, point.y, this.bossHpScaleAt(elapsed), this.rng));
      this.bossesSpawned += 1;
      return spawned;
    }
    this.timer -= dt;
    // While a boss lives, the swarm thins so the boss is the fight.
    const cap = bossAlive ? 80 : SPAWN.maxAlive;
    if (this.timer > 0 || enemyCount >= cap) return spawned;
    const finalMinute = elapsed > 540 ? 1.6 : 1;
    this.timer = this.intervalAt(elapsed) * (bossAlive ? 1.7 : 1) * finalMinute;
    const batch = this.batchAt(elapsed);
    for (let i = 0; i < batch && enemyCount + spawned.length < cap; i += 1) {
      const point = this.spawnPoint(player);
      spawned.push(new Enemy(this.pickType(elapsed, enemies), point.x, point.y, this.hpScaleAt(elapsed), this.rng));
    }
    return spawned;
  }

  /** Reset the director for a new run. */
  reset() {
    this.timer = 0.5;
    this.bossesSpawned = 0;
  }
}
