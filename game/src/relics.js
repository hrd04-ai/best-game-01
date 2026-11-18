// NOVA KEEPER — relics: the bosses' loot. Each fallen champion drops one
// relic, and walking over it claims its power for the rest of the run. Relics
// are the run's permanent treasures: they show in the HUD, on the victory
// screen, and in the run summary.

/** The relics: each one's name, look, and what it does to the Keeper. */
export const RELICS = {
  emberheart: {
    name: 'Ember Heart', icon: '♥', color: '#ff6b6b',
    blurb: '+25 max health, mend 25, and your light rekindles twice as fast',
    apply(stats, player) {
      stats.maxHp += 25;
      stats.regen += 1.5;
      player.heal(25);
    },
  },
  starlens: {
    name: 'Starforge Lens', icon: '◉', color: '#ffd166',
    blurb: '+15% damage on everything, +8% critical chance',
    apply(stats) {
      stats.damage *= 1.15;
      stats.crit += 0.08;
    },
  },
  voidmagnet: {
    name: 'Void Magnet', icon: '◎', color: '#b388ff',
    blurb: '+50% shard pickup radius, and every shard is worth +1 starlight',
    apply(stats) {
      stats.magnet *= 1.5;
      stats.xpBonus += 1;
    },
  },
};

/** The relic each boss drops, in schedule order: Warden, Herald, Devourer. */
export const RELIC_DROPS = ['emberheart', 'starlens', 'voidmagnet'];

/** The relic id the nth slain boss (0-based) drops, or null when spent. */
export function relicForBossIndex(index) {
  return RELIC_DROPS[index] ?? null;
}
