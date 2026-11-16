// NOVA KEEPER — the screenshot scenes behind ?shot=cover|title|levelup|
// victory. Each one plays the real rules forward from a fresh world for a
// fixed time, steered by an autopilot, so the frame is what a real game
// really looks like and the same seed always gives the same frame.

import { ARENA, SHOTS, STEP, WIN_TIME } from './config.js';
import { STATE_PLAY, STATE_LEVELUP, STATE_TITLE } from './world.js';

const UPGRADE_PRIORITY = [
  // The autopilot's taste: new weapons first, then damage, then survival.
  'nova', 'frost', 'shards', 'comet', 'lance',
  'overcharge', 'haste', 'vital', 'magnet', 'swift', 'lucky', 'mend',
];

/** Late in a run the autopilot plays for survival, not damage. */
const LATE_PRIORITY = [
  'vital', 'swift', 'magnet', 'mend',
  'frost', 'nova', 'shards', 'comet', 'lance',
  'overcharge', 'haste', 'lucky',
];

/**
 * The autopilot: a kiting potential field. It does NOT run from the swarm —
 * the Star Shards only kill what comes close, so it holds the edge of the
 * blades' reach, strafing sideways so the orbit sweeps through the pack, and
 * only backs off when something gets inside its guard or its health is low.
 * Enemies push it away, starlight pulls it in, and a gentle pull keeps it
 * near the centre so it never hugs a wall. Returns a movement vector.
 */
export function autopilot(world) {
  const player = world.player;
  const hurt = player.hp < player.maxHp * 0.45;
  const guard = hurt ? 130 : 58; // the distance it refuses to let enemies close
  let fx = 0;
  let fy = 0;
  let nearest = Infinity;
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.awake) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < nearest) nearest = d;
    const reach = enemy.def.boss ? 195 : guard;
    if (d < reach) {
      const strength = (reach - d) / reach;
      fx += (dx / d) * strength * 3.4;
      fy += (dy / d) * strength * 3.4;
    }
  }
  // Strafe: when the swarm is at blade range, circle it so the orbit sweeps.
  // Suppressed while a Warden is close — then it is all about distance.
  const bossNear = world.bossAlive && Math.hypot(world.boss.x - player.x, world.boss.y - player.y) < 320;
  if (nearest < 150 && !bossNear) {
    const cx = ARENA.width / 2 - player.x;
    const cy = ARENA.height / 2 - player.y;
    const cl = Math.hypot(cx, cy) || 1;
    fx += (-cy / cl) * 1.1;
    fy += (cx / cl) * 1.1;
  }
  // Dodge incoming bolts: sidestep away from any bolt closing in.
  for (const bolt of world.bolts) {
    const dx = player.x - bolt.x;
    const dy = player.y - bolt.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 70) {
      const strength = (70 - d) / 70;
      // Sidestep perpendicular to the bolt's flight, not just away from it.
      const speed = Math.hypot(bolt.vx, bolt.vy) || 1;
      const px = -bolt.vy / speed;
      const py = bolt.vx / speed;
      const side = (dx * px + dy * py) >= 0 ? 1 : -1;
      fx += px * side * strength * 3.0;
      fy += py * side * strength * 3.0;
    }
  }
  // Chase the nearest shard when the way is clear.
  let nearestGem = null;
  let nearestDist = Infinity;
  for (const gem of world.gems) {
    const d = Math.hypot(gem.x - player.x, gem.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestGem = gem;
    }
  }
  if (nearestGem && nearestDist < 320 && nearest > 75 && !bossNear) {
    fx += ((nearestGem.x - player.x) / nearestDist) * 1.5;
    fy += ((nearestGem.y - player.y) / nearestDist) * 1.5;
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
  // Escape: when the swarm closes in from all sides the field cancels out
  // and the Keeper would stall and die. Sample eight directions and take the
  // one with the clearest run — the gap in the ring.
  if (len < 0.6 && nearest < 120) {
    let bestAngle = 0;
    let bestClearance = -1;
    for (let d = 0; d < 8; d += 1) {
      const angle = (d / 8) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let clearance = 400;
      for (const enemy of world.enemies) {
        if (!enemy.alive || !enemy.awake) continue;
        const ex = enemy.x - player.x;
        const ey = enemy.y - player.y;
        const along = ex * dx + ey * dy;
        if (along < 0) continue;
        const across = Math.abs(ex * dy - ey * dx);
        if (across < 46) clearance = Math.min(clearance, along);
      }
      // Prefer directions that also head for open space, not a wall.
      const nx = player.x + dx * 120;
      const ny = player.y + dy * 120;
      const wallPenalty = nx < 60 || nx > ARENA.width - 60 || ny < 60 || ny > ARENA.height - 60 ? 60 : 0;
      if (clearance - wallPenalty > bestClearance) {
        bestClearance = clearance - wallPenalty;
        bestAngle = angle;
      }
    }
    return { x: Math.cos(bestAngle), y: Math.sin(bestAngle) };
  }
  if (len < 0.01) return { x: 0, y: 0 };
  return { x: fx / len, y: fy / len };
}

/** Pick the autopilot's favourite card from the three on offer. */
export function autopilotChoice(world) {
  const priority = world.elapsed > 360 ? LATE_PRIORITY : UPGRADE_PRIORITY;
  let best = 0;
  let bestScore = -1;
  world.choices.forEach((card, i) => {
    const rank = priority.indexOf(card.id);
    const score = rank === -1 ? 0 : priority.length - rank;
    // A hurt Keeper values a heal, and a bigger health pool, more than damage.
    const bonus = (card.kind === 'heal' && world.player.hp < world.player.maxHp * 0.45) ? 6
      : (card.id === 'vital' && world.player.hp < world.player.maxHp * 0.6) ? 4 : 0;
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
