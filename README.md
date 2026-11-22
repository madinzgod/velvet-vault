# velvet-vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/madinzgod/velvet-vault/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/madinzgod/velvet-vault/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**Velvet Vault** — an original top-down stealth heist game that plays offline in a desktop browser. One thief, one diamond: cross the museum vault hall under the sweep of guard vision cones and security cameras, lift the Aurora Diamond from its pedestal, and reach the exit before the alarm meter hits 100%.

- Guards patrol real routes, investigate coin tosses, and converge when the alarm runs hot
- Vision cones and camera sweeps are ray-cast against the furniture, so display cases are true cover
- Tools at a cost: 3 coins to throw, sprinting that fills the alarm faster, a pressure plate under the loot
- Title, win and caught screens; a getaway rating from Ghost to Loud and Lucky

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`. To hand the entry in the way the grader does:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Controls: WASD / arrow keys move · Shift sprints · E grabs the diamond · Q or click tosses a coin · Enter starts · R retries.

---

<sub>Entered on [make.fun](https://make.fun/?ref=nnk13219&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
