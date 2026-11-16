// NOVA KEEPER — keyboard, mouse and touch input. The game reads a single
// snapshot each frame: a movement vector, the pointer position, and edges for
// clicks and key presses (so a press is seen exactly once).

const KEY_BINDINGS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

/** Tracks held keys, the pointer, and one-frame press edges. */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressedKeys = new Set(); // keys pressed since the last frame
    this.pointer = { x: 640, y: 360, inside: false, down: false };
    this.clicked = null; // {x, y} in canvas coordinates, once per click
    this.wheelDelta = 0;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressedKeys.add(event.code);
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.held.delete(event.code));
    window.addEventListener('blur', () => this.held.clear());

    const toCanvas = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    };
    canvas.addEventListener('pointermove', (event) => {
      const point = toCanvas(event.clientX, event.clientY);
      this.pointer.x = point.x;
      this.pointer.y = point.y;
      this.pointer.inside = true;
    });
    canvas.addEventListener('pointerdown', (event) => {
      const point = toCanvas(event.clientX, event.clientY);
      this.pointer.x = point.x;
      this.pointer.y = point.y;
      this.pointer.down = true;
      this.clicked = point;
    });
    window.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True if the key was pressed since the last frame (and consumes it). */
  wasPressed(code) {
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      return true;
    }
    return false;
  }

  /** True while the key is held down. */
  isDown(code) {
    return this.held.has(code);
  }

  /** The normalized movement vector from WASD / arrow keys. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) x -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) x += 1;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) y -= 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  /** True when any movement key is held. */
  get moving() {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      .some((code) => this.held.has(code));
  }

  /** The click point this frame, if any (consumed on read). */
  takeClick() {
    const click = this.clicked;
    this.clicked = null;
    return click;
  }

  /** Clear the one-frame edges at the end of a frame. */
  endFrame() {
    this.pressedKeys.clear();
    this.clicked = null;
  }
}

export { KEY_BINDINGS };
