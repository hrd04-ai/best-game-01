// NOVA KEEPER — tuning and balance. Every number the game plays by lives
// here, so a balance pass is one file, and the dossier's outline shows the
// game's shape at a glance.

export const ARENA = { width: 1280, height: 720 };
export const STEP = 1 / 60; // fixed simulation step, seconds
export const WIN_TIME = 600; // survive 10 minutes and the Nova reignites

// The palette: deep space navy, neon cyan and magenta, warm gold accents.
export const PALETTE = {
  voidTop: '#0a0e27',
  voidBottom: '#141036',
  nebulaCyan: 'rgba(77, 243, 255, 0.10)',
  nebulaMagenta: 'rgba(255, 77, 166, 0.10)',
  nebulaGold: 'rgba(255, 209, 102, 0.07)',
  player: '#4df3ff',
  playerCore: '#ffffff',
  gem: '#ffd166',
  hp: '#4dff88',
  hpLow: '#ff4d6d',
  xp: '#b388ff',
  text: '#eef2ff',
  textDim: '#9aa3c7',
  panel: 'rgba(10, 14, 39, 0.88)',
  panelEdge: 'rgba(77, 243, 255, 0.35)',
  gold: '#ffd166',
  magenta: '#ff4da6',
};

export const PLAYER = {
  radius: 14,
  speed: 235, // px per second
  maxHp: 100,
  invulnerableSeconds: 0.6, // brief grace after a hit
  magnetRadius: 90,
  xpForLevel: (level) => 8 + (level - 1) * 6 + Math.floor((level - 1) * (level - 1) * 0.55),
  regenPerSecond: 1.0, // the Nova slowly rekindles the Keeper's light
};

export const COMBO = {
  windowSeconds: 2.5, // a kill inside the window raises the multiplier
  maxMultiplier: 5,
  decaySeconds: 3.5, // without a kill the multiplier falls one step
};

export const SPAWN = {
  intervalStart: 1.05, // seconds between spawn ticks at 0:00
  intervalEnd: 0.4, // seconds between spawn ticks at 10:00
  batchStart: 1, // enemies per tick at 0:00
  batchEnd: 3, // enemies per tick at 10:00
  maxAlive: 110,
  telegraphSeconds: 0.7, // spawn warning ring before an enemy wakes
  hpScalePerSecond: 1 / 120, // enemy HP grows ~5x over the ten minutes
  bossTimes: [150, 300, 450], // Wardens arrive at 2:30, 5:00, 7:30
};

export const SCORE = {
  perSecondSurvived: 10,
  perLevel: 150,
  victoryBonus: 5000,
};

export const SHOTS = {
  coverSeconds: 170, // the cover scene plays 2:50 of real game — mid boss fight
  levelupSeconds: 75, // the level-up scene plays 1:15, then forces a choice
  victorySeconds: WIN_TIME,
};
