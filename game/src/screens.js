// NOVA KEEPER — screen flow and canvas button layout. Every button the game
// draws has exactly one rectangle, defined here: the renderer draws it and
// the click handler tests it, so what you see is what you press.

import { ARENA } from './config.js';
import { STATE_TITLE, STATE_PLAY, STATE_LEVELUP, STATE_PAUSE, STATE_OVER, STATE_VICTORY } from './world.js';

/** True when a point lies inside a rectangle. */
export function inside(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/** The title screen's buttons: start, how to play, and mute. */
export function layoutTitle() {
  return {
    start: { x: 490, y: 462, w: 300, h: 64 },
    howTo: { x: 490, y: 540, w: 300, h: 48 },
    mute: { x: 1222, y: 14, w: 44, h: 44 },
  };
}

/** The level-up screen: three cards in a row, plus the reroll button. */
export function layoutLevelUp() {
  const cardW = 280;
  const cardH = 310;
  const gap = 24;
  const total = cardW * 3 + gap * 2;
  const x0 = (ARENA.width - total) / 2;
  const y = 196;
  return {
    cards: [0, 1, 2].map((i) => ({ x: x0 + i * (cardW + gap), y, w: cardW, h: cardH })),
    reroll: { x: 540, y: 534, w: 200, h: 44 },
  };
}

/** The pause overlay's buttons. */
export function layoutPause() {
  return {
    resume: { x: 490, y: 296, w: 300, h: 56 },
    restart: { x: 490, y: 366, w: 300, h: 56 },
    title: { x: 490, y: 436, w: 300, h: 56 },
    mute: { x: 1222, y: 14, w: 44, h: 44 },
  };
}

/** The end screens' buttons (game over and victory share the layout). */
export function layoutEnd() {
  return {
    again: { x: 490, y: 506, w: 300, h: 60 },
    title: { x: 490, y: 580, w: 300, h: 48 },
  };
}

/** The mute button shown during play (top-right corner). */
export function layoutPlay() {
  return {
    mute: { x: 1222, y: 14, w: 44, h: 44 },
  };
}

/**
 * Route a click for the current screen. Returns true when the click hit a
 * control. `ui` carries the how-to overlay flag and the sound engine.
 */
export function handleClick(world, point, ui) {
  const { sound } = ui;
  if (world.state === STATE_TITLE) {
    const layout = layoutTitle();
    if (inside(point, layout.mute)) {
      sound.unlock();
      sound.toggleMute();
      return true;
    }
    if (inside(point, layout.howTo)) {
      ui.showHowTo = !ui.showHowTo;
      return true;
    }
    if (ui.showHowTo) {
      ui.showHowTo = false;
      return true;
    }
    if (inside(point, layout.start)) {
      sound.unlock();
      sound.startMusic();
      world.startRun();
      return true;
    }
    return false;
  }
  if (world.state === STATE_PLAY) {
    if (inside(point, layoutPlay().mute)) {
      sound.toggleMute();
      return true;
    }
    return false;
  }
  if (world.state === STATE_LEVELUP) {
    const layout = layoutLevelUp();
    for (let i = 0; i < layout.cards.length; i += 1) {
      if (inside(point, layout.cards[i])) {
        world.choose(i);
        return true;
      }
    }
    if (inside(point, layout.reroll) && world.rerollsLeft > 0) {
      world.reroll();
      return true;
    }
    return false;
  }
  if (world.state === STATE_PAUSE) {
    const layout = layoutPause();
    if (inside(point, layout.resume)) {
      world.togglePause();
      return true;
    }
    if (inside(point, layout.restart)) {
      world.startRun();
      return true;
    }
    if (inside(point, layout.title)) {
      world.state = STATE_TITLE;
      return true;
    }
    if (inside(point, layout.mute)) {
      sound.toggleMute();
      return true;
    }
    return false;
  }
  if (world.state === STATE_OVER || world.state === STATE_VICTORY) {
    const layout = layoutEnd();
    if (inside(point, layout.again)) {
      world.startRun();
      return true;
    }
    if (inside(point, layout.title)) {
      world.state = STATE_TITLE;
      return true;
    }
    return false;
  }
  return false;
}

/**
 * Route a key press for the current screen (Enter to start, 1/2/3 and R on
 * the level-up screen, Esc/P to pause, M to mute, R to retry on the end
 * screens).
 */
export function handleKey(world, code, ui) {
  const { sound } = ui;
  if (code === 'KeyM') {
    sound.unlock();
    sound.toggleMute();
    return true;
  }
  if (world.state === STATE_TITLE) {
    if (code === 'Enter' || code === 'Space') {
      sound.unlock();
      sound.startMusic();
      world.startRun();
      return true;
    }
    if (code === 'KeyH') {
      ui.showHowTo = !ui.showHowTo;
      return true;
    }
    return false;
  }
  if (world.state === STATE_PLAY) {
    if (code === 'Escape' || code === 'KeyP') {
      world.togglePause();
      return true;
    }
    return false;
  }
  if (world.state === STATE_LEVELUP) {
    if (code === 'Digit1') world.choose(0);
    else if (code === 'Digit2') world.choose(1);
    else if (code === 'Digit3') world.choose(2);
    else if (code === 'KeyR') world.reroll();
    else return false;
    return true;
  }
  if (world.state === STATE_PAUSE) {
    if (code === 'Escape' || code === 'KeyP') {
      world.togglePause();
      return true;
    }
    return false;
  }
  if (world.state === STATE_OVER || world.state === STATE_VICTORY) {
    if (code === 'Enter' || code === 'KeyR' || code === 'Space') {
      world.startRun();
      return true;
    }
    return false;
  }
  return false;
}
