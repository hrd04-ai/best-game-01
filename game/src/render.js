// NOVA KEEPER — every pixel the game shows: the arena, the starfield, the
// entities, the HUD and the screens. All art is drawn in code; the glow
// sprites are pre-rendered once so 150 enemies still run at 60fps.

import { ARENA, PALETTE, PHASES, WIN_TIME, phaseAt } from './config.js';
import { makeRng } from './random.js';
import { STATE_TITLE, STATE_PLAY, STATE_LEVELUP, STATE_PAUSE, STATE_OVER, STATE_VICTORY } from './world.js';
import { layoutTitle, layoutLevelUp, layoutPause, layoutEnd, layoutPlay } from './screens.js';
import { WEAPONS } from './weapons.js';
import { RELICS } from './relics.js';

const FONT = "system-ui, 'Segoe UI', sans-serif";

/** Format seconds as M:SS. */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The renderer: owns the canvas context and every pre-rendered sprite. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.starfield = this.buildStarfield();
    this.glowCache = new Map();
  }

  /** A radial glow sprite for a colour, cached by colour. */
  glow(color) {
    if (!this.glowCache.has(color)) {
      const sprite = document.createElement('canvas');
      sprite.width = 96;
      sprite.height = 96;
      const c = sprite.getContext('2d');
      const gradient = c.createRadialGradient(48, 48, 2, 48, 48, 48);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.25, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gradient;
      c.fillRect(0, 0, 96, 96);
      this.glowCache.set(color, sprite);
    }
    return this.glowCache.get(color);
  }

  /** The static starfield: three depths of seeded stars on one canvas. */
  buildStarfield() {
    const rng = makeRng(1337);
    const canvas = document.createElement('canvas');
    canvas.width = ARENA.width;
    canvas.height = ARENA.height;
    const c = canvas.getContext('2d');
    for (let i = 0; i < 240; i += 1) {
      const depth = rng.next();
      const size = 0.5 + depth * 1.7;
      const alpha = 0.25 + depth * 0.65;
      c.globalAlpha = alpha;
      c.fillStyle = rng.chance(0.12) ? '#9fd8ff' : rng.chance(0.08) ? '#ffd166' : '#ffffff';
      c.beginPath();
      c.arc(rng.range(0, ARENA.width), rng.range(0, ARENA.height), size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    return canvas;
  }

  /** Draw the arena: the phase's gradient, nebula drift, starfield, border. */
  drawBackground(elapsed, time) {
    const { ctx } = this;
    const phase = PHASES[phaseAt(elapsed)];
    const gradient = ctx.createLinearGradient(0, 0, 0, ARENA.height);
    gradient.addColorStop(0, phase.top);
    gradient.addColorStop(1, phase.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    // Slow-drifting nebula blobs (pure time functions, so screenshots repeat).
    const blobs = [
      { x: 260 + Math.sin(time * 0.021) * 60, y: 180 + Math.cos(time * 0.017) * 40, r: 300, color: phase.nebula[0] },
      { x: 1020 + Math.cos(time * 0.015) * 70, y: 480 + Math.sin(time * 0.019) * 50, r: 340, color: phase.nebula[1] },
      { x: 640 + Math.sin(time * 0.011) * 90, y: 620 + Math.cos(time * 0.013) * 30, r: 260, color: phase.nebula[2] },
    ];
    for (const blob of blobs) {
      const g = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      g.addColorStop(0, blob.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
    }
    ctx.drawImage(this.starfield, 0, 0);
    // The arena's edge: a thin neon frame.
    ctx.strokeStyle = 'rgba(77, 243, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, ARENA.width - 12, ARENA.height - 12);
  }

  /** Draw one enemy by its type's shape, with a glow and a hit flash. */
  drawEnemy(enemy, time, player) {
    const { ctx } = this;
    const def = enemy.def;
    const { x, y } = enemy;
    const r = enemy.radius;
    if (!enemy.awake) {
      // Telegraph: a pulsing warning ring where the enemy will wake.
      const pulse = 0.5 + 0.5 * Math.sin(time * 14);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.4 * pulse;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 8 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const flash = enemy.flash > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.38;
    const glowSize = r * 3.4;
    ctx.drawImage(this.glow(def.color), x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = flash ? '#ffffff' : def.color;
    ctx.strokeStyle = 'rgba(5, 8, 24, 0.85)';
    ctx.lineWidth = 2.5;
    const wobble = Math.sin(time * 3 + enemy.wobble) * 0.08;
    if (def.shape === 'spike') {
      // A spiky mote: eight triangles around a core.
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + wobble;
        const a2 = ((i + 0.5) / 8) * Math.PI * 2 + wobble;
        ctx.moveTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
        ctx.lineTo(Math.cos(a2) * r * 0.8, Math.sin(a2) * r * 0.8);
      }
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.shape === 'dart') {
      ctx.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2 + wobble);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.4);
      ctx.lineTo(r * 0.9, r);
      ctx.lineTo(0, r * 0.4);
      ctx.lineTo(-r * 0.9, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (def.shape === 'hex') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + wobble;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = def.core;
      ctx.fill();
    } else if (def.shape === 'diamond') {
      ctx.rotate(Math.PI / 4 + wobble);
      ctx.beginPath();
      ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = def.core;
      ctx.fill();
    } else if (def.shape === 'twin') {
      ctx.beginPath();
      ctx.arc(-r * 0.5, 0, r * 0.72, 0, Math.PI * 2);
      ctx.arc(r * 0.5, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.5, 0, r * 0.28, 0, Math.PI * 2);
      ctx.arc(r * 0.5, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = def.core;
      ctx.fill();
    } else if (def.shape === 'warden') {
      // The Warden: a crowned ring, the biggest thing on the field.
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 + wobble;
        const rr = i % 2 === 0 ? r * 1.25 : r * 0.95;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = def.core;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (def.shape === 'herald') {
      // The Herald: a diamond core ringed by six orbiting eyes.
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = def.core;
      ctx.fill();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 1.4 + enemy.wobble;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = def.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, r * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    } else if (def.shape === 'devourer') {
      // The Devourer: a jagged maw, the largest enemy in the game.
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 + wobble;
        const rr = i % 2 === 0 ? r * 1.35 : r * 0.85;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5, 8, 24, 0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = def.core;
      ctx.fill();
    }
    ctx.restore();
    // The Devourer's charge telegraph: a dashed warning line down its path.
    if (enemy.chargeState === 'windup') {
      const pulse = 0.5 + 0.5 * Math.sin(time * 18);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * pulse;
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + enemy.chargeDir.x * 300, y + enemy.chargeDir.y * 300);
      ctx.stroke();
      ctx.restore();
    }
    // A health bar over anything hurt (bosses get the big bar in the HUD).
    if (enemy.hp < enemy.maxHp && !def.boss) {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2, y - r - 12, w, 4);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(x - w / 2, y - r - 12, w * (enemy.hp / enemy.maxHp), 4);
    }
  }

  /** Draw the Keeper: a glowing wisp with a bright core and a trail ring. */
  drawPlayer(player, time) {
    const { ctx } = this;
    const blink = player.invulnerable > 0 && Math.floor(time * 18) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;
    ctx.globalCompositeOperation = 'lighter';
    const glowSize = 120;
    ctx.drawImage(this.glow(PALETTE.player), player.x - glowSize / 2, player.y - glowSize / 2, glowSize, glowSize);
    ctx.restore();
    ctx.save();
    ctx.translate(player.x, player.y);
    const pulse = 1 + Math.sin(time * 5) * 0.06;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 0.55 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // A small facing spark so the wisp reads as moving with intent.
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(Math.cos(player.facing) * player.radius * 0.9, Math.sin(player.facing) * player.radius * 0.9, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Draw the world mid-play: entities, effects, HUD and banner. */
  drawWorld(world, time, ui) {
    const { ctx } = this;
    const offset = world.particles.offset;
    ctx.save();
    ctx.translate(offset.x, offset.y);
    this.drawBackground(world.elapsed, time);

    // Frost aura under everything else.
    const frostRadius = world.weapons.frostRadius;
    if (frostRadius > 0) {
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(time * 4);
      ctx.fillStyle = '#7dd8ff';
      ctx.beginPath();
      ctx.arc(world.player.x, world.player.y, frostRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#7dd8ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Starlight shards: small rotating diamonds.
    for (const gem of world.gems) {
      const twinkle = 0.75 + 0.25 * Math.sin(time * 6 + gem.x);
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(Math.PI / 4 + gem.age * 2);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = PALETTE.gem;
      const s = 5 + Math.min(3, gem.value);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // Unclaimed relics: large pulsing diamonds, impossible to miss.
    for (const drop of world.relicDrops) {
      const relic = RELICS[drop.id];
      const pulse = 1 + Math.sin(time * 5 + drop.age * 3) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      ctx.drawImage(this.glow(relic.color), drop.x - 44, drop.y - 44, 88, 88);
      ctx.restore();
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = relic.color;
      const s = 17 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.save();
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(relic.icon, drop.x, drop.y + 6);
      ctx.restore();
    }

    for (const enemy of world.enemies) this.drawEnemy(enemy, time, world.player);

    // Enemy bolts: glowing orbs with a hot core.
    for (const bolt of world.bolts) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glow(bolt.color), bolt.x - 22, bolt.y - 22, 44, 44);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Projectiles and lance beams.
    for (const beam of world.beams) {
      const alpha = 1 - beam.age / beam.life;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = beam.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, beam.width * 0.35);
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
      ctx.restore();
    }
    for (const shot of world.projectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const size = shot.kind === 'comet' ? 40 : 28;
      ctx.drawImage(this.glow(shot.color), shot.x - size / 2, shot.y - size / 2, size, size);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Orbiting Star Shards: four-pointed stars on their orbit path.
    const shards = world.weapons.shardPositions(world.player);
    if (shards.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(world.player.x, world.player.y, Math.hypot(shards[0].x - world.player.x, shards[0].y - world.player.y), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      for (const shard of shards) {
        ctx.save();
        ctx.translate(shard.x, shard.y);
        ctx.rotate(time * 6);
        ctx.fillStyle = '#dffbff';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(3, -3);
        ctx.lineTo(11, 0);
        ctx.lineTo(3, 3);
        ctx.lineTo(0, 11);
        ctx.lineTo(-3, 3);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-3, -3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    this.drawPlayer(world.player, time);
    world.particles.draw(ctx);
    ctx.restore();

    this.drawHud(world, time, ui);
    this.drawBanner(world);
  }

  /** The HUD: XP bar, timer, score, health, weapons, boss bar, mute. */
  drawHud(world, time, ui) {
    const { ctx } = this;
    const player = world.player;
    // XP bar across the top, with the level badge.
    const xpRatio = player.xp / player.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, ARENA.width, 14);
    ctx.fillStyle = PALETTE.xp;
    ctx.fillRect(0, 0, ARENA.width * xpRatio, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${player.level}`, 14, 30);

    // The sky's phase, under the level: the run's chapter, always visible.
    const phase = PHASES[world.phase];
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`PHASE ${phase.roman} · ${phase.name}`, 14, 48);

    // Timer, centre-top: the goal is always in sight.
    const remaining = Math.max(0, WIN_TIME - world.elapsed);
    ctx.textAlign = 'center';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = remaining < 60 ? '#ffd166' : PALETTE.text;
    ctx.fillText(formatTime(remaining), ARENA.width / 2, 44);
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('UNTIL THE NOVA REIGNITES', ARENA.width / 2, 60);

    // Score and combo, top-right.
    ctx.textAlign = 'right';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(String(Math.round(world.score)).padStart(6, '0'), 1206, 40);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = world.combo > 1 ? '#ffd166' : PALETTE.textDim;
    ctx.fillText(world.combo > 1 ? `COMBO ×${world.combo}` : `${world.kills} KILLS`, 1206, 58);

    // Health bar, bottom-left, with a numeric readout.
    const hpRatio = player.hp / player.maxHp;
    const hpW = 260;
    const hpX = 16;
    const hpY = ARENA.height - 40;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(hpX - 4, hpY - 4, hpW + 8, 26);
    ctx.fillStyle = hpRatio < 0.3 ? PALETTE.hpLow : PALETTE.hp;
    ctx.fillRect(hpX, hpY, hpW * hpRatio, 18);
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`♥ ${Math.ceil(player.hp)} / ${player.maxHp}`, hpX + 8, hpY + 14);

    // Owned weapons with level pips, bottom-centre-left.
    let wx = hpX + hpW + 24;
    ctx.textAlign = 'left';
    for (const id of world.weapons.ids) {
      const def = WEAPONS[id];
      const level = world.weapons.level(id);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(wx, hpY - 4, 64, 26);
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = def.color;
      ctx.fillText(def.icon, wx + 6, hpY + 14);
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(`Lv${level}`, wx + 30, hpY + 14);
      wx += 72;
    }

    // Claimed relics, bottom-right: one glowing chip per treasure.
    if (world.relics.length > 0) {
      let rx = ARENA.width - 16;
      ctx.textAlign = 'left';
      for (let i = world.relics.length - 1; i >= 0; i -= 1) {
        const relic = RELICS[world.relics[i]];
        rx -= 34;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(rx, hpY - 4, 30, 26);
        ctx.font = `700 17px ${FONT}`;
        ctx.fillStyle = relic.color;
        ctx.fillText(relic.icon, rx + 7, hpY + 15);
      }
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      ctx.textAlign = 'right';
      ctx.fillText('RELICS', ARENA.width - 16, hpY - 10);
    }

    // Boss health bar, under the timer, while a champion lives.
    if (world.bossAlive) {
      const boss = world.boss;
      const bw = 520;
      const bx = (ARENA.width - bw) / 2;
      const by = 86;
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = boss.def.color;
      ctx.fillText(`⚠  ${boss.def.name}  ⚠`, ARENA.width / 2, by - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 4, by - 4, bw + 8, 22);
      ctx.fillStyle = boss.def.color;
      ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), 14);
    }

    // Low-health vignette: the screen closes in as the light fades.
    if (hpRatio < 0.35 && world.state === STATE_PLAY) {
      const pulse = 0.25 + 0.2 * Math.sin(time * 6);
      const gradient = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
      gradient.addColorStop(0, 'rgba(255, 77, 109, 0)');
      gradient.addColorStop(1, `rgba(255, 77, 109, ${pulse * (1 - hpRatio)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }

    // Controls hint, fading out after the first 25 seconds of a run.
    if (world.elapsed < 25 && world.state === STATE_PLAY) {
      ctx.globalAlpha = world.elapsed < 20 ? 0.9 : 0.9 * (1 - (world.elapsed - 20) / 5);
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText('WASD / arrows or hold mouse to move · Esc pause · M mute', ARENA.width - 16, ARENA.height - 16);
      ctx.globalAlpha = 1;
    }

    this.drawMuteButton(layoutPlay().mute, ui.sound.muted);
  }

  /** A centre-screen announcement banner. */
  drawBanner(world) {
    if (!world.banner) return;
    const { ctx } = this;
    const t = world.banner.age / world.banner.seconds;
    const alpha = t < 0.12 ? t / 0.12 : t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(world.banner.text, ARENA.width / 2, 150);
    if (world.banner.sub) {
      ctx.font = `600 17px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(world.banner.sub, ARENA.width / 2, 180);
    }
    ctx.restore();
  }

  /** A rounded button with a label; hovered buttons glow. */
  drawButton(rect, label, { primary = false, hovered = false, fontSize = 20 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = primary ? 'rgba(77, 243, 255, 0.16)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = primary ? PALETTE.player : 'rgba(238,242,255,0.4)';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = `800 ${fontSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = primary ? '#dffbff' : PALETTE.text;
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + fontSize / 3);
    ctx.restore();
  }

  /** The mute toggle in the top-right corner. */
  drawMuteButton(rect, muted) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(238,242,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(muted ? '✕' : '♪', rect.x + rect.w / 2, rect.y + rect.h / 2 + 7);
    ctx.restore();
  }

  /** The title screen: the name, the goal, the controls, the start button. */
  drawTitle(world, time, ui, hover) {
    const { ctx } = this;
    this.drawBackground(0, time);
    // A few decorative motes drift across the title, above and below the
    // text, so the screen is alive without covering the words.
    const lanes = [80, 130, 420, 625, 665];
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 197 + time * 12) % (ARENA.width + 80)) - 40;
      const y = lanes[i % lanes.length] + Math.sin(time * 0.7 + i) * 14;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glow('#ff4da6'), x - 30, y - 30, 60, 60);
      ctx.restore();
      ctx.fillStyle = '#ff4da6';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.font = `800 88px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NOVA KEEPER', ARENA.width / 2, 210);
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = PALETTE.player;
    ctx.fillText('The last star is dying. Hold the light for 10:00.', ARENA.width / 2, 252);
    ctx.font = `500 16px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('Your weapons fire on their own — you move, you dodge, you choose how to grow.', ARENA.width / 2, 282);
    ctx.fillText('Collect starlight · level up · slay 3 bosses · claim their relics.', ARENA.width / 2, 306);
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('MOVE  WASD / arrows / hold mouse      PAUSE  Esc      MUTE  M', ARENA.width / 2, 348);
    if (world.bestScore > 0) {
      ctx.font = `700 16px ${FONT}`;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`BEST SCORE  ${world.bestScore.toLocaleString('en-US')}`, ARENA.width / 2, 392);
    }
    const layout = layoutTitle();
    this.drawButton(layout.start, '▶  START THE DEFENCE', { primary: true, hovered: hover === 'start', fontSize: 22 });
    this.drawButton(layout.howTo, 'HOW TO PLAY  (H)', { hovered: hover === 'howTo', fontSize: 16 });
    this.drawMuteButton(layout.mute, ui.sound.muted);
    if (ui.showHowTo) this.drawHowTo();
  }

  /** The how-to-play overlay on the title screen. */
  drawHowTo() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 24, 0.82)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    const panel = { x: 290, y: 120, w: 700, h: 480 };
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = `800 28px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('HOW TO PLAY', panel.x + 32, panel.y + 52);
    const lines = [
      ['GOAL', 'Survive 10:00 until the Nova reignites. Your health is your light — when it runs out, the run ends.'],
      ['MOVE', 'WASD or arrow keys, or hold the mouse button and the Keeper follows the cursor.'],
      ['FIGHT', 'Weapons fire automatically. Kills drop starlight shards — walk over them to collect XP.'],
      ['GROW', 'Each level offers 3 upgrade cards: new weapons, stronger weapons, and passives. Pick one (click or 1/2/3). Reroll once per level with R.'],
      ['ENEMIES', 'Motes chase, Darters rush, Bulwarks soak damage, Spitters shoot, Splitters divide — and the Warden (2:30), the Herald (5:00) and the Devourer (7:30) each guard a relic.'],
      ['RELICS', 'Each fallen boss drops a relic: walk over it to claim its power for the rest of the run.'],
      ['SCORE', 'Kills × your combo multiplier, plus survival time and level bonuses. Chain kills to raise the combo.'],
    ];
    let y = panel.y + 96;
    ctx.font = `600 15px ${FONT}`;
    for (const [head, body] of lines) {
      ctx.fillStyle = PALETTE.player;
      ctx.fillText(head, panel.x + 32, y);
      ctx.fillStyle = PALETTE.text;
      this.wrapText(body, panel.x + 120, y, panel.w - 152, 20);
      y += head === 'GROW' ? 62 : 48;
    }
    ctx.textAlign = 'center';
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('Click anywhere to close', ARENA.width / 2, panel.y + panel.h - 20);
    ctx.restore();
  }

  /** Word-wrap a line of text into a column. */
  wrapText(text, x, y, maxWidth, lineHeight) {
    const { ctx } = this;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  /** The level-up screen: three upgrade cards and a reroll button. */
  drawLevelUp(world, hover) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 24, 0.72)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`LEVEL ${world.player.level} — CHOOSE YOUR POWER`, ARENA.width / 2, 120);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('Click a card, or press 1 / 2 / 3', ARENA.width / 2, 148);
    const layout = layoutLevelUp();
    world.choices.forEach((card, i) => {
      const rect = layout.cards[i];
      const hovered = hover === `card${i}`;
      ctx.save();
      ctx.fillStyle = hovered ? 'rgba(77, 243, 255, 0.14)' : PALETTE.panel;
      ctx.strokeStyle = card.color;
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '64px system-ui, sans-serif';
      ctx.fillStyle = card.color;
      ctx.fillText(card.icon, rect.x + rect.w / 2, rect.y + 96);
      ctx.font = `800 20px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      this.wrapCentered(card.title, rect.x + rect.w / 2, rect.y + 132, rect.w - 32, 24);
      ctx.font = `500 15px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      this.wrapCentered(card.blurb, rect.x + rect.w / 2, rect.y + 178, rect.w - 36, 21);
      // Level pips for weapons and passives.
      if (card.kind !== 'heal') {
        const max = 5;
        for (let p = 0; p < max; p += 1) {
          ctx.fillStyle = p < card.level ? card.color : 'rgba(255,255,255,0.18)';
          ctx.beginPath();
          ctx.arc(rect.x + rect.w / 2 - 44 + p * 22, rect.y + rect.h - 30, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.font = `700 13px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(`[${i + 1}]`, rect.x + rect.w / 2, rect.y + rect.h - 48);
      ctx.restore();
    });
    const reroll = layout.reroll;
    if (world.rerollsLeft > 0) {
      this.drawButton(reroll, '↻  REROLL  (R)', { hovered: hover === 'reroll', fontSize: 16 });
    } else {
      ctx.save();
      ctx.globalAlpha = 0.4;
      this.drawButton(reroll, '↻  REROLL USED', { fontSize: 16 });
      ctx.restore();
    }
  }

  /** Centre-aligned word wrap for card text. */
  wrapCentered(text, cx, y, maxWidth, lineHeight) {
    const { ctx } = this;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  }

  /** The pause overlay. */
  drawPause(world, ui, hover) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 24, 0.72)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    ctx.font = `800 48px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', ARENA.width / 2, 220);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`${formatTime(world.elapsed)} survived · level ${world.player.level} · ${world.kills} kills`, ARENA.width / 2, 252);
    const layout = layoutPause();
    this.drawButton(layout.resume, 'RESUME  (Esc)', { primary: true, hovered: hover === 'resume' });
    this.drawButton(layout.restart, 'RESTART RUN', { hovered: hover === 'restart' });
    this.drawButton(layout.title, 'QUIT TO TITLE', { hovered: hover === 'title' });
    this.drawMuteButton(layout.mute, ui.sound.muted);
    ctx.restore();
  }

  /** The end screens: victory or game over, with the run's stats. */
  drawEnd(world, hover) {
    const { ctx } = this;
    const won = world.state === STATE_VICTORY;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 24, 0.78)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    ctx.font = `800 56px ${FONT}`;
    ctx.fillStyle = won ? PALETTE.gold : '#ff4d6d';
    ctx.fillText(won ? 'THE NOVA REIGNITES' : 'THE LIGHT FADES', ARENA.width / 2, 150);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(
      won ? 'You held the dark at bay. The star burns again.' : 'The Void claims another Keeper. The Nova waits for the next.',
      ARENA.width / 2,
      184,
    );
    const s = world.summary;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE  ${s.score.toLocaleString('en-US')}`, ARENA.width / 2, 252);
    if (s.newBest) {
      ctx.font = `800 16px ${FONT}`;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('★ NEW BEST SCORE ★', ARENA.width / 2, 282);
    } else {
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(`BEST  ${s.best.toLocaleString('en-US')}`, ARENA.width / 2, 282);
    }
    // The stat grid: four numbers that tell the run's story.
    const stats = [
      ['TIME SURVIVED', formatTime(s.time)],
      ['LEVEL REACHED', String(s.level)],
      ['VOIDSPAWN SLAIN', String(s.kills)],
      ['UPGRADES TAKEN', String(s.levelUps)],
    ];
    ctx.font = `700 15px ${FONT}`;
    stats.forEach(([label, value], i) => {
      const x = 320 + (i % 2) * 340;
      const y = 330 + Math.floor(i / 2) * 58;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(label, x, y);
      ctx.textAlign = 'right';
      ctx.font = `800 22px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, x + 300, y);
      ctx.font = `700 15px ${FONT}`;
    });
    // The final build: weapon icons with levels, and the relics claimed.
    ctx.textAlign = 'center';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('FINAL BUILD', ARENA.width / 2, 448);
    const build = s.weapons.map((w) => `${WEAPONS[w.id].icon} ${WEAPONS[w.id].name} Lv${w.level}`).join('   ·   ');
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(build || 'Star Shards Lv1', ARENA.width / 2, 470);
    if (s.relics.length > 0) {
      const relicLine = s.relics.map((r) => `${r.icon} ${r.name}`).join('   ·   ');
      ctx.font = `700 14px ${FONT}`;
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText('RELICS CLAIMED', ARENA.width / 2, 496);
      ctx.font = `600 16px ${FONT}`;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(relicLine, ARENA.width / 2, 518);
    }
    const layout = layoutEnd();
    this.drawButton(layout.again, won ? '▶  PLAY AGAIN' : '↻  TRY AGAIN', { primary: true, hovered: hover === 'again', fontSize: 22 });
    this.drawButton(layout.title, 'TITLE SCREEN', { hovered: hover === 'title', fontSize: 16 });
    ctx.restore();
  }

  /**
   * Draw the whole frame for the current screen. `time` is the wall-clock
   * seconds for animation; `ui` carries the how-to flag and the sound engine;
   * `hover` names the control under the pointer, if any.
   */
  draw(world, time, ui, hover) {
    const { ctx } = this;
    ctx.clearRect(0, 0, ARENA.width, ARENA.height);
    if (world.state === STATE_TITLE) {
      this.drawTitle(world, time, ui, hover);
      return;
    }
    this.drawWorld(world, time, ui);
    if (world.state === STATE_LEVELUP) this.drawLevelUp(world, hover);
    else if (world.state === STATE_PAUSE) this.drawPause(world, ui, hover);
    else if (world.state === STATE_OVER || world.state === STATE_VICTORY) this.drawEnd(world, hover);
  }
}
