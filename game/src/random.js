// NOVA KEEPER — a small seeded RNG (mulberry32) so the whole simulation is
// reproducible: the same seed always plays the same game, which is what makes
// the screenshot scenes deterministic.

/** Make a mulberry32 generator from an integer seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny RNG object with the helpers the game needs, all driven by one seed. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of an array, uniformly. */
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** An angle in radians, uniform over the circle. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Squared distance between two points (avoids a sqrt in hot loops). */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
