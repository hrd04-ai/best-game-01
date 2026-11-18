# NOVA KEEPER

An arena-survival game for make.fun's **best-game-01** bounty: you are the
Keeper of the last Nova, holding back the Voidspawn swarm until the star
reignites. Survive 10 minutes to win.

## How it plays

- **Move** with WASD / arrow keys or the mouse (the Keeper follows the cursor
  while the mouse button is held). Your weapons fire on their own.
- **Kill Voidspawn**, collect the starlight shards they drop, and **level up**:
  each level offers a choice of 3 upgrade cards — new weapons, stronger
  weapons, or passives (speed, vitality, magnet, damage, haste, luck).
- **5 weapons** (orbiting Star Shards, radial Pulse Nova, homing Comets,
  slowing Frost Ring, piercing Rail Lance), each with 5 levels.
- **6 enemy types** — Motes, Darters, Bulwarks, Spitters, Splitters, and three
  distinct bosses: the Warden (2:30, ring of bolts), the Herald of the Void
  (5:00, aimed fan + births Motes), and the Devourer (7:30, telegraphed charge
  + dense bolt ring) — with a spawn director that keeps raising the pressure.
- **3 relics**: each fallen boss drops one — Ember Heart, Starforge Lens,
  Void Magnet — claimed by walking over it, kept for the whole run.
- **3 phases of the darkening sky** — Dusk, Eclipse, Voidstorm — each
  re-painting the arena, plus kill-streak callouts (RAMPAGE / FRENZY /
  UNSTOPPABLE) with score bonuses for unbroken chains.
- **Win** by surviving until 10:00; **lose** when your light runs out.
  Score comes from kills, survival time, and your level. Pause with Esc/P,
  mute with M.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no network request, no assets: all art is drawn in code on a
canvas and all sound is synthesized with WebAudio.

## Screenshots

`?shot=cover|title|levelup|victory&seed=N` stages a deterministic scene from
the real simulation (a seeded autopilot plays the game forward), so each
screenshot is a true render of the game's own code. `shots.json` lists them.

## Layout

- `game/index.html` — page shell and canvas
- `game/styles.css` — page chrome
- `game/src/config.js` — tuning and balance
- `game/src/random.js` — seeded RNG
- `game/src/audio.js` — synthesized sound effects and music
- `game/src/input.js` — keyboard, mouse and touch
- `game/src/particles.js` — particles, shockwaves, floating text, screen shake
- `game/src/enemies.js` — swarm types, spawn director and enemy AI
- `game/src/bosses.js` — the three bosses: Warden, Herald, Devourer
- `game/src/relics.js` — the bosses' loot: Ember Heart, Starforge Lens, Void Magnet
- `game/src/weapons.js` — weapon definitions, firing and projectiles
- `game/src/upgrades.js` — the upgrade pool and level-up choices
- `game/src/player.js` — the Keeper: movement, health, XP and levels
- `game/src/world.js` — game state, the update loop, collisions and scoring
- `game/src/render.js` — all canvas drawing: arena, entities, HUD and screens
- `game/src/screens.js` — screen flow and canvas button hit-testing
- `game/src/shots.js` — deterministic screenshot scenes and the autopilot
- `game/src/main.js` — boot, the fixed-timestep loop and wiring

## License

MIT.
