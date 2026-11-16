// NOVA KEEPER — the level-up: when the Keeper levels, the run offers three
// upgrade cards. A card is a new weapon, a stronger weapon, a passive, or a
// heal; the pool follows what the run already owns, so no card is ever dead.

import { WEAPONS, MAX_WEAPON_LEVEL } from './weapons.js';

/** The passives: permanent bonuses that stack with every level. */
export const PASSIVES = {
  swift: {
    name: 'Swift Boots', icon: '➤', color: '#4df3ff',
    blurb: '+8% move speed',
    apply: (stats) => { stats.speed *= 1.08; },
  },
  vital: {
    name: 'Vital Core', icon: '♥', color: '#4dff88',
    blurb: '+20 max health, mend 20 now',
    apply: (stats, player) => {
      stats.maxHp += 20;
      player.heal(20);
    },
  },
  magnet: {
    name: 'Star Magnet', icon: '◎', color: '#ffd166',
    blurb: '+35% shard pickup radius',
    apply: (stats) => { stats.magnet *= 1.35; },
  },
  overcharge: {
    name: 'Overcharge', icon: '✚', color: '#ff4da6',
    blurb: '+10% damage on everything',
    apply: (stats) => { stats.damage *= 1.1; },
  },
  haste: {
    name: 'Haste Sigil', icon: '↻', color: '#b388ff',
    blurb: 'Weapons recharge 7% faster',
    apply: (stats) => { stats.haste *= 0.93; },
  },
  lucky: {
    name: 'Lucky Star', icon: '★', color: '#ff9f43',
    blurb: '+6% critical chance (crits hit double)',
    apply: (stats) => { stats.crit += 0.06; },
  },
};

export const MAX_PASSIVE_LEVEL = 5;
export const MAX_WEAPONS = 4;

/** One upgrade card: what it does, its icon, and how it reads. */
export class UpgradeCard {
  constructor(kind, id, level) {
    this.kind = kind; // 'weapon' | 'passive' | 'heal'
    this.id = id;
    this.level = level; // the level the card takes it to (1 for a new weapon)
    if (kind === 'weapon') {
      const def = WEAPONS[id];
      this.name = def.name;
      this.icon = def.icon;
      this.color = def.color;
      this.title = level === 1 ? `${def.name} — NEW` : `${def.name} Lv ${level}`;
      this.blurb = def.blurb;
    } else if (kind === 'passive') {
      const def = PASSIVES[id];
      this.name = def.name;
      this.icon = def.icon;
      this.color = def.color;
      this.title = level === 1 ? `${def.name} — NEW` : `${def.name} Lv ${level}`;
      this.blurb = def.blurb;
    } else {
      this.name = 'Starlight Mend';
      this.icon = '✚';
      this.color = '#4dff88';
      this.title = 'Starlight Mend';
      this.blurb = 'Restore 40 health right now.';
    }
  }
}

/**
 * Build the three cards for a level-up: every legal upgrade, weighted so new
 * weapons show up early and maxed-out lines disappear, shuffled by the run's
 * RNG. Always returns exactly three cards (heals fill any gap).
 */
export function rollChoices(rng, weapons, passives, playerHp, playerMaxHp) {
  const candidates = [];
  for (const id of Object.keys(WEAPONS)) {
    const level = weapons.level(id);
    if (level === 0 && weapons.ids.length < MAX_WEAPONS) {
      candidates.push({ card: new UpgradeCard('weapon', id, 1), weight: 3 });
    } else if (level > 0 && level < MAX_WEAPON_LEVEL) {
      candidates.push({ card: new UpgradeCard('weapon', id, level + 1), weight: 2 });
    }
  }
  for (const id of Object.keys(PASSIVES)) {
    const level = passives.get(id) ?? 0;
    if (level < MAX_PASSIVE_LEVEL) {
      candidates.push({ card: new UpgradeCard('passive', id, level + 1), weight: 2 });
    }
  }
  // A heal is always on the table when the Keeper is hurt.
  if (playerHp < playerMaxHp) {
    candidates.push({ card: new UpgradeCard('heal', 'mend', 0), weight: 1 });
  }
  const choices = [];
  while (choices.length < 3 && candidates.length > 0) {
    let total = 0;
    for (const candidate of candidates) total += candidate.weight;
    let roll = rng.next() * total;
    let picked = 0;
    for (let i = 0; i < candidates.length; i += 1) {
      roll -= candidates[i].weight;
      if (roll <= 0) {
        picked = i;
        break;
      }
    }
    choices.push(candidates[picked].card);
    candidates.splice(picked, 1);
  }
  while (choices.length < 3) choices.push(new UpgradeCard('heal', 'mend', 0));
  return choices;
}

/** Apply a chosen card to the run (weapons, passives, stats, player). */
export function applyChoice(card, weapons, passives, stats, player) {
  if (card.kind === 'weapon') {
    weapons.addOrUpgrade(card.id);
  } else if (card.kind === 'passive') {
    passives.set(card.id, (passives.get(card.id) ?? 0) + 1);
    PASSIVES[card.id].apply(stats, player);
  } else {
    player.heal(40);
  }
}
