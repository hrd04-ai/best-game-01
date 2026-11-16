// NOVA KEEPER — the screenshot scenes behind ?shot=cover|title|levelup|
// victory. Each one plays the real rules forward from a fresh world for a
// fixed time, steered by an autopilot, so the frame is what a real game
// really looks like and the same seed always gives the same frame.

import { ARENA, SHOTS, STEP, WIN_TIME } from './config.js';
import { STATE_PLAY, STATE_LEVELUP, STATE_TITLE } from './world.js';

const UPGRADE_PRIORITY = [
  // The autopilot's taste: new weapons first, then damage, then survival.
  'nova', 'comet', 'lance', 'frost',
  'overcharge', 'haste', 'vital', 'magnet', 'swift', 'lucky', 'mend',
];

/**
 * The autopilot: a potential field. Enemies push it away, starlight pulls it
 * in when the way is clear, and a gentle pull keeps it near the centre so it
 * never hugs a wall. Returns a movement vector for one step.
 */
export function autopilot(world) {
  const player = world.player;
  let fx = 0;
  let fy = 0;
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.awake) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 170) {
      const strength = (170 - d) / 170;
      const weight = enemy.def.boss ? 3 : 1;
      fx += (dx / d) * strength * weight * 3.2;
      fy += (dy / d) * strength * weight * 3.2;
    }
  }
  // Chase the nearest shard when no enemy is breathing down the Keeper's neck.
  let nearestGem = null;
  let nearestDist = Infinity;
  for (const gem of world.gems) {
    const d = Math.hypot(gem.x - player.x, gem.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestGem = gem;
    }
  }
  const danger = world.enemies.some((e) => e.alive && e.awake && Math.hypot(e.x - player.x, e.y - player.y) < 95);
  if (nearestGem && nearestDist < 280 && !danger) {
    fx += ((nearestGem.x - player.x) / nearestDist) * 1.4;
    fy += ((nearestGem.y - player.y) / nearestDist) * 1.4;
  }
  // A soft pull toward the centre and away from the walls.
  fx += (ARENA.width / 2 - player.x) * 0.0016;
  fy += (ARENA.height / 2 - player.y) * 0.0016;
  const margin = 70;
  if (player.x < margin) fx += (margin - player.x) * 0.02;
  if (player.x > ARENA.width - margin) fx -= (player.x - (ARENA.width - margin)) * 0.02;
  if (player.y < margin) fy += (margin - player.y) * 0.02;
  if (player.y > ARENA.height - margin) fy -= (player.y - (ARENA.height - margin)) * 0.02;
  const len = Math.hypot(fx, fy);
  if (len < 0.01) return { x: 0, y: 0 };
  return { x: fx / len, y: fy / len };
}

/** Pick the autopilot's favourite card from the three on offer. */
export function autopilotChoice(world) {
  let best = 0;
  let bestScore = -1;
  world.choices.forEach((card, i) => {
    const rank = UPGRADE_PRIORITY.indexOf(card.id);
    const score = rank === -1 ? 0 : UPGRADE_PRIORITY.length - rank;
    // A hurt Keeper values a heal more than a third weapon.
    const bonus = card.kind === 'heal' && world.player.hp < world.player.maxHp * 0.45 ? 6 : 0;
    if (score + bonus > bestScore) {
      bestScore = score + bonus;
      best = i;
    }
  });
  return best;
}

/**
 * Play the world forward for `seconds` of game time under the autopilot,
 * choosing upgrades the moment they are offered. Stops early if the run
 * ends. Returns the state the run is in when it stops.
 */
export function playForward(world, seconds) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state === STATE_LEVELUP) {
      world.choose(autopilotChoice(world));
      continue;
    }
    if (world.state !== STATE_PLAY) break;
    world.step(STEP, autopilot(world));
  }
  return world.state;
}

/**
 * Stage the named screenshot scene on a fresh world and return the screen to
 * draw. `seed` fixes the whole run, so the frame is reproducible.
 */
export function stageShot(name, world) {
  // The world's seed is set by main.js before this call; startRun re-seeds
  // the RNG from it, so the whole staged run is reproducible.
  if (name === 'title') {
    world.state = STATE_TITLE;
    return { screen: STATE_TITLE };
  }
  world.startRun();
  if (name === 'cover') {
    playForward(world, SHOTS.coverSeconds);
    // The cover wants a busy mid-game frame: if the run ended early, it is
    // still a real frame, but the screenshot script retries another seed.
    return { screen: world.state };
  }
  if (name === 'levelup') {
    playForward(world, SHOTS.levelupSeconds);
    if (world.state === STATE_PLAY) {
      // Force the choice screen with a real level-up, not a fake one.
      world.player.gainXp(world.player.xpNext);
      if (world.player.pendingLevels > 0) world.openLevelUp();
    }
    return { screen: world.state };
  }
  if (name === 'victory') {
    playForward(world, WIN_TIME + 1);
    return { screen: world.state };
  }
  world.state = STATE_TITLE;
  return { screen: STATE_TITLE };
}
