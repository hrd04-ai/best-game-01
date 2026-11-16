// NOVA KEEPER — the Keeper's arsenal: five auto-firing weapons, each with
// five levels, plus the projectiles they throw. Weapons fire on their own;
// the player's job is positioning.

import { ARENA } from './config.js';
import { dist2 } from './random.js';

export const MAX_WEAPON_LEVEL = 5;

/** The arsenal: each weapon's name, flavour, and per-level tuning. */
export const WEAPONS = {
  shards: {
    name: 'Star Shards', icon: '✦', color: '#4df3ff',
    blurb: 'Blades of frozen starlight orbit you, shredding what they touch.',
    levels: [
      { count: 2, damage: 16, radius: 74, speed: 3.4 },
      { count: 3, damage: 17, radius: 78, speed: 3.7 },
      { count: 3, damage: 20, radius: 84, speed: 4.0 },
      { count: 4, damage: 23, radius: 90, speed: 4.3 },
      { count: 5, damage: 28, radius: 98, speed: 4.8 },
    ],
  },
  nova: {
    name: 'Pulse Nova', icon: '☀', color: '#ffd166',
    blurb: 'A heartbeat of the Nova itself: a ring of fire that knocks the swarm back.',
    cooldown: 2.3,
    levels: [
      { count: 8, damage: 10, knock: 260 },
      { count: 10, damage: 12, knock: 290 },
      { count: 12, damage: 14, knock: 320 },
      { count: 14, damage: 17, knock: 350 },
      { count: 18, damage: 21, knock: 400 },
    ],
  },
  comet: {
    name: 'Comet', icon: '☄', color: '#ff9f43',
    blurb: 'A hunting spark that chases the nearest Voidspawn and bursts on impact.',
    cooldown: 0.85,
    levels: [
      { damage: 18, splash: 40, count: 1 },
      { damage: 22, splash: 50, count: 1 },
      { damage: 26, splash: 60, count: 2 },
      { damage: 31, splash: 70, count: 2 },
      { damage: 38, splash: 85, count: 3 },
    ],
  },
  frost: {
    name: 'Frost Ring', icon: '❄', color: '#7dd8ff',
    blurb: 'A halo of deep cold that slows the swarm and bleeds it dry.',
    levels: [
      { radius: 105, dps: 7, slow: 0.72 },
      { radius: 120, dps: 10, slow: 0.66 },
      { radius: 135, dps: 14, slow: 0.60 },
      { radius: 150, dps: 18, slow: 0.55 },
      { radius: 170, dps: 24, slow: 0.48 },
    ],
  },
  lance: {
    name: 'Rail Lance', icon: '⚡', color: '#ff4da6',
    blurb: 'A piercing beam that lances through every enemy in its path.',
    cooldown: 1.6,
    levels: [
      { damage: 30, width: 10 },
      { damage: 38, width: 12 },
      { damage: 48, width: 14 },
      { damage: 60, width: 16 },
      { damage: 78, width: 20 },
    ],
  },
};

/** A projectile in flight: position, velocity, damage, and its behaviour. */
export class Projectile {
  constructor({ x, y, vx, vy, damage, radius, color, kind, target = null, pierce = false, splash = 0, life = 2.5 }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.radius = radius;
    this.color = color;
    this.kind = kind; // 'bolt' | 'comet'
    this.target = target;
    this.pierce = pierce;
    this.splash = splash;
    this.life = life;
    this.hitSet = new Set();
  }

  /** Homing comets steer toward their target; bolts fly straight. */
  update(dt) {
    if (this.kind === 'comet' && this.target && this.target.alive) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const distance = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(this.vx, this.vy);
      const steer = 9 * dt;
      this.vx += ((dx / distance) * speed - this.vx) * steer;
      this.vy += ((dy / distance) * speed - this.vy) * steer;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0 && this.x > -30 && this.x < ARENA.width + 30 && this.y > -30 && this.y < ARENA.height + 30;
  }
}

/** A lance beam flash, drawn for a fraction of a second. */
export class Beam {
  constructor(x1, y1, x2, y2, width, color) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.width = width;
    this.color = color;
    this.age = 0;
    this.life = 0.16;
  }

  update(dt) {
    this.age += dt;
    return this.age < this.life;
  }
}

/**
 * The weapon rack: which weapons the Keeper owns, at what level, and their
 * cooldowns. update() fires everything that is ready and returns the events
 * the world turns into damage, particles and sound.
 */
export class WeaponRack {
  constructor() {
    this.owned = new Map(); // weapon id -> level (1..5)
    this.cooldowns = new Map(); // weapon id -> seconds until ready
    this.orbitAngle = 0;
    this.frostTick = 0;
  }

  /** The level of a weapon, or 0 when not owned. */
  level(id) {
    return this.owned.get(id) ?? 0;
  }

  /** Add a weapon at level 1, or raise an owned one by one level. */
  addOrUpgrade(id) {
    const current = this.owned.get(id) ?? 0;
    this.owned.set(id, Math.min(current + 1, MAX_WEAPON_LEVEL));
    if (!this.cooldowns.has(id)) this.cooldowns.set(id, 0.2);
  }

  /** The ids of the weapons the Keeper owns, in acquisition order. */
  get ids() {
    return [...this.owned.keys()];
  }

  /** The nearest living enemy to a point — the boss first when it is near. */
  nearestEnemy(x, y, enemies, boss = null) {
    if (boss && boss.alive && boss.awake) {
      const bd = dist2(x, y, boss.x, boss.y);
      if (bd < 700 * 700) return boss;
    }
    let best = null;
    let bestDist = Infinity;
    for (const enemy of enemies) {
      if (!enemy.alive || !enemy.awake) continue;
      const d = dist2(x, y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  /**
   * Fire every ready weapon. `stats` carries the Keeper's damage, haste and
   * crit bonuses; `boss` is the live Warden, if any, which aimed weapons
   * prefer. Returns { projectiles, beams, novas, events }.
   */
  update(dt, player, enemies, stats, events, boss = null) {
    const projectiles = [];
    const beams = [];
    const novas = [];
    const haste = stats.haste; // cooldown multiplier, lower is faster

    // Star Shards: orbiting blades, always active, damage on contact.
    if (this.owned.has('shards')) {
      const def = WEAPONS.shards.levels[this.level('shards') - 1];
      this.orbitAngle += def.speed * dt;
      for (let i = 0; i < def.count; i += 1) {
        const angle = this.orbitAngle + (i * Math.PI * 2) / def.count;
        const bx = player.x + Math.cos(angle) * def.radius;
        const by = player.y + Math.sin(angle) * def.radius;
        for (const enemy of enemies) {
          if (!enemy.alive || !enemy.awake) continue;
          const rr = enemy.radius + 12;
          if (dist2(bx, by, enemy.x, enemy.y) < rr * rr) {
            events.push({ type: 'hit', enemy, x: bx, y: by, damage: def.damage * stats.damage, source: 'shards', knock: 120 });
          }
        }
      }
    }

    // Frost Ring: a slowing aura that ticks damage on everything inside.
    if (this.owned.has('frost')) {
      const def = WEAPONS.frost.levels[this.level('frost') - 1];
      this.frostTick += dt;
      for (const enemy of enemies) {
        if (!enemy.alive || !enemy.awake) continue;
        if (dist2(player.x, player.y, enemy.x, enemy.y) < def.radius * def.radius) {
          enemy.slow(def.slow, 0.6);
        }
      }
      if (this.frostTick >= 0.5) {
        this.frostTick = 0;
        for (const enemy of enemies) {
          if (!enemy.alive || !enemy.awake) continue;
          if (dist2(player.x, player.y, enemy.x, enemy.y) < def.radius * def.radius) {
            events.push({ type: 'hit', enemy, x: enemy.x, y: enemy.y, damage: def.dps * 0.5 * stats.damage, source: 'frost', knock: 0, quiet: true });
          }
        }
      }
    }

    // Cooldown weapons: nova, comet, lance.
    for (const id of ['nova', 'comet', 'lance']) {
      if (!this.owned.has(id)) continue;
      const def = WEAPONS[id];
      const level = this.level(id);
      const tuning = def.levels[level - 1];
      const ready = (this.cooldowns.get(id) ?? 0) - dt;
      this.cooldowns.set(id, ready);
      if (ready > 0) continue;
      const target = this.nearestEnemy(player.x, player.y, enemies, boss);
      if (!target && id !== 'nova') continue;
      this.cooldowns.set(id, def.cooldown * haste);

      if (id === 'nova') {
        novas.push({ x: player.x, y: player.y, count: tuning.count, damage: tuning.damage * stats.damage, knock: tuning.knock, color: def.color });
        events.push({ type: 'nova', x: player.x, y: player.y, radius: tuning.count * 9 });
      } else if (id === 'comet') {
        for (let i = 0; i < tuning.count; i += 1) {
          const angle = Math.atan2(target.y - player.y, target.x - player.x) + (i - (tuning.count - 1) / 2) * 0.35;
          projectiles.push(new Projectile({
            x: player.x, y: player.y,
            vx: Math.cos(angle) * 420, vy: Math.sin(angle) * 420,
            damage: tuning.damage * stats.damage, radius: 8, color: def.color,
            kind: 'comet', target, splash: tuning.splash,
          }));
        }
        events.push({ type: 'shoot', x: player.x, y: player.y });
      } else if (id === 'lance') {
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        const x2 = player.x + Math.cos(angle) * 900;
        const y2 = player.y + Math.sin(angle) * 900;
        beams.push(new Beam(player.x, player.y, x2, y2, tuning.width, def.color));
        for (const enemy of enemies) {
          if (!enemy.alive || !enemy.awake) continue;
          if (distanceToSegment(enemy.x, enemy.y, player.x, player.y, x2, y2) < enemy.radius + tuning.width / 2) {
            events.push({ type: 'hit', enemy, x: enemy.x, y: enemy.y, damage: tuning.damage * stats.damage, source: 'lance', knock: 120 });
          }
        }
        events.push({ type: 'shoot', x: player.x, y: player.y });
      }
    }
    return { projectiles, beams, novas };
  }

  /** The current orbit positions of the Star Shards, for the renderer. */
  shardPositions(player) {
    if (!this.owned.has('shards')) return [];
    const def = WEAPONS.shards.levels[this.level('shards') - 1];
    const positions = [];
    for (let i = 0; i < def.count; i += 1) {
      const angle = this.orbitAngle + (i * Math.PI * 2) / def.count;
      positions.push({ x: player.x + Math.cos(angle) * def.radius, y: player.y + Math.sin(angle) * def.radius });
    }
    return positions;
  }

  /** The Frost Ring's current radius, or 0 when not owned. */
  get frostRadius() {
    if (!this.owned.has('frost')) return 0;
    return WEAPONS.frost.levels[this.level('frost') - 1].radius;
  }

  /** Reset the rack for a new run (the Keeper starts with Star Shards). */
  reset() {
    this.owned.clear();
    this.cooldowns.clear();
    this.owned.set('shards', 1);
    this.cooldowns.set('shards', 0);
    this.orbitAngle = 0;
    this.frostTick = 0;
  }
}

/** Distance from a point to a line segment (for the lance's pierce test). */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
