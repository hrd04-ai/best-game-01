// NOVA KEEPER — boot, the fixed-timestep loop, and the wiring between input,
// screens, world and renderer. Also the screenshot mode: ?shot=<scene>&seed=N
// stages a deterministic scene and freezes it for the camera.

import { ARENA, STEP } from './config.js';
import { World, STATE_TITLE, STATE_PLAY, STATE_LEVELUP, STATE_PAUSE, STATE_OVER, STATE_VICTORY } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { handleClick, handleKey, inside, layoutTitle, layoutLevelUp, layoutPause, layoutEnd, layoutPlay } from './screens.js';

const canvas = document.getElementById('game');
const input = new Input(canvas);
const sound = new SoundEngine();
const renderer = new Renderer(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '', 10);
const runSeed = Number.isInteger(seed) ? seed : Math.floor(Math.random() * 1e9);

const world = new World(runSeed, sound);
const ui = { showHowTo: false, sound };
// Exposed for play-testing from the console and from automation.
window.__game = { world, sound, input };

/** Which control, if any, the pointer hovers over right now. */
function hoverAt(point) {
  if (!point.inside) return null;
  if (world.state === STATE_TITLE) {
    const layout = layoutTitle();
    if (inside(point, layout.start)) return 'start';
    if (inside(point, layout.howTo)) return 'howTo';
    return null;
  }
  if (world.state === STATE_LEVELUP) {
    const layout = layoutLevelUp();
    for (let i = 0; i < layout.cards.length; i += 1) {
      if (inside(point, layout.cards[i])) return `card${i}`;
    }
    if (inside(point, layout.reroll)) return 'reroll';
    return null;
  }
  if (world.state === STATE_PAUSE) {
    const layout = layoutPause();
    if (inside(point, layout.resume)) return 'resume';
    if (inside(point, layout.restart)) return 'restart';
    if (inside(point, layout.title)) return 'title';
    return null;
  }
  if (world.state === STATE_OVER || world.state === STATE_VICTORY) {
    const layout = layoutEnd();
    if (inside(point, layout.again)) return 'again';
    if (inside(point, layout.title)) return 'title';
    return null;
  }
  return null;
}

/** The movement vector for this frame: keys first, then mouse steering. */
function moveVector() {
  if (input.moving) return input.moveVector();
  if (input.pointer.down && input.pointer.inside) {
    return world.player.steerToward(input.pointer.x, input.pointer.y);
  }
  return { x: 0, y: 0 };
}

/** Route this frame's key presses through the screen handler. */
function routeKeys() {
  for (const code of ['KeyM', 'Enter', 'Space', 'Escape', 'KeyP', 'Digit1', 'Digit2', 'Digit3', 'KeyR', 'KeyH']) {
    if (input.wasPressed(code)) handleKey(world, code, ui);
  }
}

/** Screenshot mode: stage the scene, render one frozen frame, signal ready. */
async function runShotMode() {
  const { stageShot } = await import('./shots.js');
  const staged = stageShot(shotName, world);
  // A fixed animation time keeps the frame identical on every capture.
  const frozenTime = 12.5;
  renderer.draw(world, frozenTime, ui, null);
  window.__shotReady = true;
  window.__shotState = staged.screen;
}

/** Normal mode: the game loop on a fixed timestep with an accumulator. */
function runGameMode() {
  let last = performance.now();
  let accumulator = 0;
  let trailTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    routeKeys();
    const click = input.takeClick();
    if (click) handleClick(world, click, ui);
    canvas.style.cursor = hoverAt(input.pointer) ? 'pointer' : 'default';

    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      world.step(STEP, world.state === STATE_PLAY ? moveVector() : { x: 0, y: 0 });
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;

    // A trail of light behind the Keeper while it moves.
    if (world.state === STATE_PLAY) {
      trailTimer -= dt;
      if (trailTimer <= 0 && Math.hypot(world.player.vx, world.player.vy) > 60) {
        trailTimer = 0.05;
        world.particles.trail(world.player.x, world.player.y, '#4df3ff', 3);
      }
    }
    renderer.draw(world, now / 1000, ui, hoverAt(input.pointer));
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

if (shotName) {
  void runShotMode();
} else {
  runGameMode();
}

export { ARENA, STATE_TITLE, STATE_PLAY, STATE_LEVELUP, STATE_PAUSE, STATE_OVER, STATE_VICTORY };
