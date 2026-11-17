# EMBERWARDEN — Hold the Light

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/haidildariell/emberwarden-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/haidildariell/emberwarden-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original 2D arena survival roguelite for [make.fun best-game-01](https://make.fun/bounty/best-game-01).
You are the Warden of the last lighthouse. Shadows pour in from the dark in
escalating waves — hold the light through 10 waves, slay the Dreadlord, and
bring the dawn.

## How to play

- **WASD / arrow keys** — move
- **Mouse** — aim
- **Hold click or Space** — fire ember bolts
- **P / Esc** — pause · **M** — mute · **R** — restart after a run ends

Slain foes drop **embers**. Between waves the shop opens: spend embers on
upgrades — damage, fire rate, multishot, piercing bolts, max HP, magnet,
regeneration, move speed. Wave 10 brings the **Dreadlord** boss: beat it and
you win the run. Your best score is saved in the browser.

## Features

- 10 escalating waves, 5 enemy kinds (Shade, Wisp, Spitter, Brute, Dreadlord boss) with distinct movement and attacks
- Between-wave upgrade shop (8 upgrades, stacking, priced by wave)
- Ember economy with magnet pickups and wave-clear bonuses
- Synthesized WebAudio sound effects and a generative A-minor music loop — no audio files
- Particles, screen shake, hit flashes, floating damage numbers, wave banners
- Title, pause, shop, victory and game-over screens with run stats and restart
- Fully offline: plain static files, no network requests, no libraries

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from any static file server. Node 22+
is needed only for the `main.ts` entry program, which copies `game/` and
`screenshots/` to `/output` and writes `dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
