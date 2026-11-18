// NOVA KEEPER — the three champions of the Void: one boss per phase of the
// run, each with its own shape, colour, attack and tagline, and each guarding
// a relic (see relics.js). The spawn director walks BOSS_SCHEDULE in order.

/** The boss bestiary: every champion's stats and behaviour. */
export const BOSS_TYPES = {
  warden: {
    name: 'THE WARDEN', tagline: 'A champion of the Void approaches',
    radius: 42, speed: 56, hp: 800, damage: 20, xp: 25, score: 500,
    color: '#ffd166', core: '#fff3cf', shape: 'warden',
    boss: true, ranged: true, range: 9999, shotCooldown: 3.0, boltSpeed: 160,
    radialShots: 8, // a ring of bolts, all at once
  },
  herald: {
    name: 'HERALD OF THE VOID', tagline: 'It calls the swarm to its side',
    radius: 38, speed: 70, hp: 1400, damage: 18, xp: 40, score: 800,
    color: '#b388ff', core: '#e6dcff', shape: 'herald',
    boss: true, ranged: true, range: 9999, shotCooldown: 2.4, boltSpeed: 190,
    fanShots: 3, // an aimed three-bolt fan
    summons: 'mote', summonCount: 3, summonCooldown: 9, // it births Motes
  },
  devourer: {
    name: 'THE DEVOURER', tagline: 'It does not chase. It charges.',
    radius: 52, speed: 48, hp: 2200, damage: 24, xp: 60, score: 1200,
    color: '#ff4d6d', core: '#ffd6dd', shape: 'devourer',
    boss: true, ranged: true, range: 9999, shotCooldown: 3.4, boltSpeed: 170,
    radialShots: 12, // a denser ring than the Warden's
    charge: true, // a telegraphed dash at the Keeper — sidestep it
  },
};

/** The boss schedule: which champion arrives, and when (seconds). */
export const BOSS_SCHEDULE = [
  { at: 150, type: 'warden' }, // 2:30, still Dusk
  { at: 300, type: 'herald' }, // 5:00, under the Eclipse
  { at: 450, type: 'devourer' }, // 7:30, in the Voidstorm
];

/** The boss definition for a type, or undefined for a swarm type. */
export function bossDef(type) {
  return BOSS_TYPES[type];
}

/** The schedule entry for the nth boss (0-based), or undefined. */
export function bossForIndex(index) {
  return BOSS_SCHEDULE[index];
}
