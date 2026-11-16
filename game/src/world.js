// NOVA KEEPER — the world: the game state machine, the fixed-step update,
// collisions, pickups, the kill combo and the score. Everything the screens
// show comes from here.

import { ARENA, COMBO, SCORE, WIN_TIME } from './config.js';
import { makeRng, clamp, dist2 } from './random.js';
import { Player, baseStats } from './player.js';
import { WeaponRack } from './weapons.js';
import { SpawnDirector, Bolt, Enemy } from './enemies.js';
import { Particles } from './particles.js';
import { rollChoices, applyChoice } from './upgrades.js';

export const STATE_TITLE = 'title';
export const STATE_PLAY = 'play';
export const STATE_LEVELUP = 'levelup';
export const STATE_PAUSE = 'pause';
export const STATE_OVER = 'over';
export const STATE_VICTORY = 'victory';

/** A starlight shard: the XP pickup enemies drop. */
export class Gem {
  constructor(x, y, value, rng) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.vx = rng.range(-40, 40);
    this.vy = rng.range(-40, 40);
    this.age = 0;
    this.magnetized = false;
  }

  /** Drift, then fly to the player once magnetized. */
  update(dt, player, magnetRadius) {
    this.age += dt;
    const d2 = dist2(this.x, this.y, player.x, player.y);
    if (!this.magnetized && d2 < magnetRadius * magnetRadius) this.magnetized = true;
    if (this.magnetized) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distance = Math.hypot(dx, dy) || 1;
      const speed = 620;
      this.vx = (dx / distance) * speed;
      this.vy = (dy / distance) * speed;
    } else {
      this.vx *= 1 - 3 * dt;
      this.vy *= 1 - 3 * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, 8, ARENA.width - 8);
    this.y = clamp(this.y, 8, ARENA.height - 8);
    return d2 < 26 * 26; // collected when close to the Keeper
  }
}

/** The whole game: state, entities, timers and the score. */
export class World {
  constructor(seed, sound) {
    this.seed = seed;
    this.sound = sound;
    this.rng = makeRng(seed);
    this.player = new Player();
    this.stats = baseStats();
    this.player.stats = this.stats;
    this.weapons = new WeaponRack();
    this.passives = new Map();
    this.director = new SpawnDirector(this.rng);
    this.particles = new Particles();
    this.enemies = [];
    this.projectiles = [];
    this.beams = [];
    this.bolts = [];
    this.gems = [];
    this.state = STATE_TITLE;
    this.elapsed = 0;
    this.kills = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.levelUps = 0;
    this.boss = null;
    this.choices = [];
    this.rerollsLeft = 0;
    this.banner = null; // { text, sub, age, seconds }
    this.shardHitAt = new Map(); // enemy -> last shard-hit time (throttle)
    this.bestScore = 0;
    this.newBest = false;
    try {
      this.bestScore = Number(window.localStorage.getItem('nova-keeper-best') ?? 0) || 0;
    } catch {
      this.bestScore = 0;
    }
  }

  /** The run's boss, if one is alive. */
  get bossAlive() {
    return this.boss !== null && this.boss.alive;
  }

  /** Start a fresh run from the title screen. */
  startRun() {
    this.rng = makeRng(this.seed);
    this.player.reset();
    this.stats = baseStats();
    this.player.stats = this.stats;
    this.weapons.reset();
    this.passives.clear();
    this.director.reset();
    this.particles.clear();
    this.enemies = [];
    this.projectiles = [];
    this.beams = [];
    this.bolts = [];
    this.gems = [];
    this.state = STATE_PLAY;
    this.elapsed = 0;
    this.kills = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.levelUps = 0;
    this.boss = null;
    this.choices = [];
    this.newBest = false;
    this.showBanner('SURVIVE UNTIL THE NOVA REIGNITES', '10:00 on the clock — hold the light');
  }

  /** Show a centre-screen announcement for a few seconds. */
  showBanner(text, sub = '', seconds = 2.6) {
    this.banner = { text, sub, age: 0, seconds };
  }

  /** Offer the level-up choice screen (pauses the simulation). */
  openLevelUp() {
    this.choices = rollChoices(this.rng, this.weapons, this.passives, this.player.hp, this.player.maxHp);
    this.rerollsLeft = 1;
    this.state = STATE_LEVELUP;
    this.sound.levelUp();
    this.particles.shockwave(this.player.x, this.player.y, { color: '#b388ff', maxRadius: 170, seconds: 0.6 });
  }

  /** Re-roll the three cards once per level-up. */
  reroll() {
    if (this.state !== STATE_LEVELUP || this.rerollsLeft <= 0) return;
    this.rerollsLeft -= 1;
    this.choices = rollChoices(this.rng, this.weapons, this.passives, this.player.hp, this.player.maxHp);
  }

  /** Apply a chosen card and resume (or chain the next pending level). */
  choose(index) {
    if (this.state !== STATE_LEVELUP || index < 0 || index >= this.choices.length) return;
    applyChoice(this.choices[index], this.weapons, this.passives, this.stats, this.player);
    this.levelUps += 1;
    this.player.pendingLevels -= 1;
    this.choices = [];
    if (this.player.pendingLevels > 0) {
      this.openLevelUp();
    } else {
      this.state = STATE_PLAY;
    }
  }

  /** Pause or resume the run. */
  togglePause() {
    if (this.state === STATE_PLAY) this.state = STATE_PAUSE;
    else if (this.state === STATE_PAUSE) this.state = STATE_PLAY;
  }

  /**
   * One fixed simulation step. `move` is the player's movement vector for
   * this step. The title, level-up, pause and end screens freeze the world;
   * only the play state advances it.
   */
  step(dt, move) {
    if (this.state !== STATE_PLAY) {
      this.particles.update(dt);
      if (this.banner) {
        this.banner.age += dt;
        if (this.banner.age >= this.banner.seconds) this.banner = null;
      }
      return;
    }
    this.elapsed += dt;
    this.score += SCORE.perSecondSurvived * dt;

    // Combo decay: the multiplier falls a step after a quiet stretch.
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo -= 1;
        this.comboTimer = COMBO.decaySeconds;
      }
    }

    this.player.move(dt, move, this.stats.speed);
    this.player.update(dt);

    // Spawning (bosses on schedule, the swarm on the director's clock).
    const spawned = this.director.update(dt, this.elapsed, this.player, this.enemies.length, this.bossAlive);
    for (const enemy of spawned) {
      this.enemies.push(enemy);
      if (enemy.def.boss) {
        this.boss = enemy;
        this.showBanner('⚠ THE WARDEN AWAKENS ⚠', 'A champion of the Void approaches', 3);
        this.sound.bossWarn();
      }
    }

    // Enemy AI and ranged shots.
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const action = enemy.update(dt, this.player, this.elapsed, this.bolts, this.rng);
      if (action === 'shoot') this.enemyShoot(enemy);
    }

    // Weapons fire; their events become damage below.
    const events = [];
    const fired = this.weapons.update(dt, this.player, this.enemies, this.stats, events);
    this.projectiles.push(...fired.projectiles);
    this.beams.push(...fired.beams);
    for (const nova of fired.novas) this.detonateNova(nova);

    // Projectiles fly and hit.
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const shot = this.projectiles[i];
      if (!shot.update(dt)) {
        this.projectiles.splice(i, 1);
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive || !enemy.awake || shot.hitSet.has(enemy)) continue;
        const rr = enemy.radius + shot.radius;
        if (dist2(shot.x, shot.y, enemy.x, enemy.y) < rr * rr) {
          shot.hitSet.add(enemy);
          this.hitEnemy(enemy, shot.damage, shot.x, shot.y, 80);
          if (shot.splash > 0) this.splashDamage(shot.x, shot.y, shot.splash, shot.damage * 0.5, enemy);
          this.particles.burst(shot.x, shot.y, { count: 5, color: shot.color, speed: 120, size: 2.5, life: 0.3 });
          if (!shot.pierce) {
            this.projectiles.splice(i, 1);
          }
          break;
        }
      }
    }

    // Weapon events: shard and frost hits, lance hits, nova and shoot sounds.
    for (const event of events) {
      if (event.type === 'hit') {
        if (event.source === 'shards') {
          const last = this.shardHitAt.get(event.enemy) ?? -1;
          if (this.elapsed - last < 0.32) continue;
          this.shardHitAt.set(event.enemy, this.elapsed);
        }
        this.hitEnemy(event.enemy, event.damage, event.x, event.y, event.knock ?? 0, event.quiet);
      } else if (event.type === 'shoot') {
        this.sound.shoot();
      } else if (event.type === 'nova') {
        this.particles.shockwave(event.x, event.y, { color: '#ffd166', maxRadius: 170, seconds: 0.4 });
        this.sound.enemyDie();
      }
    }

    // Enemy bolts fly and can hit the player.
    for (let i = this.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = this.bolts[i];
      if (!bolt.update(dt)) {
        this.bolts.splice(i, 1);
        continue;
      }
      const rr = bolt.radius + this.player.radius;
      if (dist2(bolt.x, bolt.y, this.player.x, this.player.y) < rr * rr) {
        this.bolts.splice(i, 1);
        this.hurtPlayer(bolt.damage, bolt.x, bolt.y);
      }
    }

    // Contact damage: a live, awake enemy touching the Keeper hurts it.
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.awake) continue;
      const rr = enemy.radius + this.player.radius - 2;
      if (dist2(enemy.x, enemy.y, this.player.x, this.player.y) < rr * rr) {
        this.hurtPlayer(enemy.def.damage, enemy.x, enemy.y);
        enemy.knockback(this.player.x - enemy.x, this.player.y - enemy.y, -140);
      }
    }

    // Beams fade; gems drift, magnetize and get collected.
    for (let i = this.beams.length - 1; i >= 0; i -= 1) {
      if (!this.beams[i].update(dt)) this.beams.splice(i, 1);
    }
    for (let i = this.gems.length - 1; i >= 0; i -= 1) {
      const gem = this.gems[i];
      if (gem.update(dt, this.player, this.stats.magnet)) {
        this.gems.splice(i, 1);
        this.sound.gem();
        this.particles.burst(gem.x, gem.y, { count: 4, color: '#ffd166', speed: 90, size: 2, life: 0.25 });
        const gained = this.player.gainXp(gem.value);
        if (gained > 0) {
          this.score += SCORE.perLevel * gained;
          this.openLevelUp();
          return; // the choice screen pauses the rest of this step
        }
      }
    }

    // Dead enemies drop their shards and split where they must.
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy.alive) continue;
      this.enemies.splice(i, 1);
      this.shardHitAt.delete(enemy);
      if (enemy === this.boss) this.boss = null;
      this.dropGems(enemy);
      if (enemy.def.splitsInto) {
        for (let s = 0; s < enemy.def.splitCount; s += 1) {
          const child = new Enemy(
            enemy.def.splitsInto,
            enemy.x + this.rng.range(-14, 14),
            enemy.y + this.rng.range(-14, 14),
            this.director.hpScaleAt(this.elapsed),
            this.rng,
          );
          child.telegraph = 0.25;
          this.enemies.push(child);
        }
      }
    }

    this.particles.update(dt);
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age >= this.banner.seconds) this.banner = null;
    }

    // Victory: the clock runs out and the Nova reignites.
    if (this.elapsed >= WIN_TIME) {
      this.state = STATE_VICTORY;
      this.score += SCORE.victoryBonus;
      this.finishRun(true);
    } else if (!this.player.alive) {
      this.state = STATE_OVER;
      this.finishRun(false);
    }
  }

  /** A radial nova detonation: damage and knockback in a radius. */
  detonateNova(nova) {
    const radius = 90 + nova.count * 5;
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.awake) continue;
      const d = Math.hypot(enemy.x - nova.x, enemy.y - nova.y);
      if (d < radius + enemy.radius) {
        this.hitEnemy(enemy, nova.damage, enemy.x, enemy.y, nova.knock);
        enemy.knockback(enemy.x - nova.x, enemy.y - nova.y, nova.knock * 0.6);
      }
    }
  }

  /** Splash damage around a point (comet bursts), excluding one enemy. */
  splashDamage(x, y, radius, damage, except) {
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.awake || enemy === except) continue;
      const rr = radius + enemy.radius;
      if (dist2(x, y, enemy.x, enemy.y) < rr * rr) {
        this.hitEnemy(enemy, damage, enemy.x, enemy.y, 40, true);
      }
    }
  }

  /** Apply one hit to an enemy: crits, damage numbers, death and score. */
  hitEnemy(enemy, amount, x, y, knock, quiet = false) {
    if (!enemy.alive) return;
    const critical = this.rng.next() < this.stats.crit;
    const damage = Math.round(amount * (critical ? 2 : 1));
    const killed = enemy.damage(damage);
    if (knock > 0) enemy.knockback(enemy.x - x, enemy.y - y, knock);
    if (!quiet) {
      this.particles.floatText(x, y - enemy.radius - 4, String(damage), {
        color: critical ? '#ffd166' : '#eef2ff',
        size: critical ? 19 : 13,
      });
      this.sound.enemyHit();
    }
    if (killed) this.killEnemy(enemy);
  }

  /** Score, combo and effects for a kill. */
  killEnemy(enemy) {
    this.kills += 1;
    this.combo = Math.min(this.combo + 1, 5);
    this.comboTimer = COMBO.windowSeconds;
    this.score += enemy.def.score * this.combo;
    this.particles.burst(enemy.x, enemy.y, {
      count: enemy.def.boss ? 46 : 14,
      color: enemy.def.color,
      speed: enemy.def.boss ? 300 : 190,
      size: enemy.def.boss ? 4.5 : 3,
      life: 0.6,
    });
    if (enemy.def.boss) {
      this.particles.shockwave(enemy.x, enemy.y, { color: '#ffd166', maxRadius: 260, seconds: 0.7, width: 6 });
      this.particles.shake(9, 0.4);
      this.showBanner('WARDEN FALLEN', `+${enemy.def.score * this.combo} score`, 2.2);
    }
    this.sound.enemyDie();
  }

  /** Drop starlight shards (and a heal for bosses) where an enemy fell. */
  dropGems(enemy) {
    const value = enemy.def.xp;
    const count = enemy.def.boss ? 8 : Math.min(3, value);
    const per = Math.max(1, Math.round(value / count));
    for (let i = 0; i < count; i += 1) {
      this.gems.push(new Gem(
        enemy.x + this.rng.range(-12, 12),
        enemy.y + this.rng.range(-12, 12),
        per,
        this.rng,
      ));
    }
    if (enemy.def.boss) {
      this.player.heal(25);
      this.particles.floatText(this.player.x, this.player.y - 30, '+25 HP', { color: '#4dff88', size: 18 });
    }
  }

  /** An enemy's ranged attack: one aimed bolt, or a radial fan for Wardens. */
  enemyShoot(enemy) {
    const def = enemy.def;
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    if (def.radialShots) {
      for (let i = 0; i < def.radialShots; i += 1) {
        const a = (i / def.radialShots) * Math.PI * 2 + this.elapsed;
        this.bolts.push(new Bolt(
          enemy.x, enemy.y,
          Math.cos(a) * def.boltSpeed, Math.sin(a) * def.boltSpeed,
          def.damage, def.color,
        ));
      }
    } else {
      this.bolts.push(new Bolt(
        enemy.x, enemy.y,
        Math.cos(angle) * def.boltSpeed, Math.sin(angle) * def.boltSpeed,
        def.damage, def.color,
      ));
    }
  }

  /** The Keeper takes a hit: damage, shake, vignette flash, and the end. */
  hurtPlayer(amount, fromX, fromY) {
    const applied = this.player.hurt(amount);
    if (applied <= 0) return;
    this.particles.shake(6, 0.25);
    this.particles.burst(this.player.x, this.player.y, { count: 12, color: '#ff4d6d', speed: 200, size: 3, life: 0.4 });
    this.particles.floatText(this.player.x, this.player.y - 26, `-${applied}`, { color: '#ff4d6d', size: 18 });
    this.sound.hurt();
  }

  /** Wrap up a run: fanfare, best score, and the end screen. */
  finishRun(won) {
    this.score = Math.round(this.score);
    if (won) {
      this.sound.victory();
      this.particles.shockwave(this.player.x, this.player.y, { color: '#ffd166', maxRadius: 420, seconds: 1.2, width: 8 });
    } else {
      this.sound.gameOver();
      this.particles.burst(this.player.x, this.player.y, { count: 60, color: '#4df3ff', speed: 320, size: 4, life: 0.9 });
    }
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.newBest = true;
      try {
        window.localStorage.setItem('nova-keeper-best', String(this.bestScore));
      } catch {
        // Storage may be unavailable (private mode, sandbox): the run still counts.
      }
    }
  }

  /** The run's summary for the end screens. */
  get summary() {
    return {
      score: Math.round(this.score),
      best: this.bestScore,
      newBest: this.newBest,
      time: Math.floor(this.elapsed),
      level: this.player.level,
      kills: this.kills,
      levelUps: this.levelUps,
      weapons: this.weapons.ids.map((id) => ({ id, level: this.weapons.level(id) })),
    };
  }
}
