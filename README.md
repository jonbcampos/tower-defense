# Unicorn Squeeze Squad

You are a unicorn stuffed animal on a cushion at the end of a bedroom. Kids keep coming in
through the door to grab you and squeeze you. Hold them off with toys until they get distracted
by the water and wander back out.

Nobody is hurt in this game. A kid who runs out of health has been bubbled or soaked or dazzled
enough that whatever your toys are doing is more interesting than you are.

## The kids, and what stops them

| Kid | What's different about them | The answer |
| --- | --- | --- |
| **Crawler** | Slowest thing in the game | Anything at all |
| **Toddler** | The baseline | Bubble Wand |
| **Runner** | Fast | Sticky Slime, or two of anything |
| **Raincoat Kid** (pointed hood) | **Water does nothing** | Bubbles, powder, light |
| **Blanket Kid** (a mound, no face) | Can't be aimed at until she peeks out halfway | Sprinkler, Nightlight |
| **Balloon Kid** (floating) | **Drifts over ground toys** and never stops | Sprinkler, Bubble Machine |
| **Puffy Coat** | 200 health | Water Gun, and a wall to buy it time |
| **Sock Slider** (horizontal) | Fastest, and **slides over Sticky Slime** | Meet her at the door |
| **Wagon Kid** | A cardboard shield comes off first | Sustained damage |
| **The Big Kid** | Throws a stuffie that destroys a toy; half damage from bubbles | Everything you know |

Ten levels, a new toy every level or two, and a **Toy Vacuum** parked at the end of every lane —
the first kid to reach the cushion in a lane gets vacuumed up instead of squeezing you, once.

Third in a set with [Flappy Unicorn](https://jonbcampos.github.io/flappy-unicorn/) and
[Ellie's Rainbow Run](https://jonbcampos.github.io/runner-game/), built the same way: TypeScript,
a 2D canvas, no engine, no runtime dependencies, no art or audio files.

## Running it

```bash
npm install && npm run dev
```

Open the printed Network URL on a phone to play it on a real touchscreen. Hold the phone either
way — the game rotates itself. On desktop, `1`–`5` pick a card and `Esc` puts it back.

## Why it's built this way

[DECISIONS.md](DECISIONS.md) is the running log of what we decided and why — read that before
changing anything structural. The short version:

- **`src/game/`** — the simulation. Never imports from `src/render/`; it has no idea how it
  looks. Presentation happens by draining an event queue in `main.ts`.
- **`src/game/config.ts`** — every global tuning number. The only exceptions are the two content
  registries, `TOYS` and `ENEMIES`, which are data tables rather than loose numbers.
- Nothing is allocated after startup. Every kid, projectile, sparkle and event lives in a fixed
  pool, and the toys are 45 pre-allocated objects indexed by cell.

### Seven ideas worth knowing before you change anything

**1. The loop is fixed-timestep.** Physics advances in exact 1/120s increments regardless of
refresh rate, and the renderer interpolates between steps. Every fairness rule in this project is
written in seconds, so without this they would all quietly be lies on a 120Hz phone.

**2. Everything is measured in seconds, never pixels.** A kid's speed is authored as
`crossSeconds` — how long it takes to walk the whole board — and the px/s is derived from the
board's width. Change the geometry and the pacing does not move underneath you.

**3. Adding content is a data edit.** A toy is one `ToyDef`, one painter, and a mention in a
level's `unlocks`. A kid is one `EnemyDef` and one painter. A level is one entry in `levels.ts`.
If an addition ever needs a fourth file, something belongs in a registry that isn't there yet.

**4. The fairness checks scale for free.** `validateDesignContracts()` loops
`LEVELS × DIFFICULTY_ORDER`, and so does the trial suite. Adding level 23 earns it a dozen new
checks on every page load with no test to write. This is the main reason a fifty-level campaign
is a content problem rather than an engineering one.

**5. `World` is a terrain rule, not a background.** The reason Plants vs Zombies' fifty levels
don't feel like ten repeated five times is that each area changed what the board itself does.
v1 ships one world; the seam for the rest is already in `levels.ts`.

**6. Difficulty is chores first, pressure second.** EASY→NORMAL adds two things to *consider* —
you collect your own sparkles, you pick your own five cards — and speeds nothing up.
NORMAL→HARD keeps the identical vocabulary and turns up hit points, speed and wave density.
EASY never deletes an enemy type, so a child and a parent are watching the same game.

**7. A mis-tap never costs a sparkle.** An illegal placement gets a red X and its own sound, and
the purse does not move. The sound matters as much as the refund: silence, to a five-year-old,
means the game is broken, and she will keep tapping the same wrong cell rather than try another.

### Verifying it

Two layers, and both are worth running after any tuning change.

`validateDesignContracts()` runs on **every page load** and logs `[design] …` to the console. It
is pure arithmetic over the config, checked per level and per difficulty — the axis where a
change looks fine on NORMAL and quietly makes HARD impossible.

```js
__game.verify()
```

91 headless trials driving the real `GameState` with a scripted bot, across every level at every
difficulty. Every one reports **what it measured**, not just pass or fail. EASY and NORMAL are
held to a deliberately mediocre bot; HARD is held to a competent one, and that difference is the
definition of the tier.

```js
__game.tune({ 'wand.damage': 11, 'runner.crossSeconds': 14 })
__game.showTuning()
__game.go(7, 'hard')
__game.unlockAll()
```

`tune` re-runs both layers after every change, because the feel knobs and the fairness
constraints are the same numbers.

## Painted art (optional)

The game ships with everything drawn in code — a few hundred rectangles and
arcs. That reads well and costs nothing, but it is deliberately plain. If you
want it to look painted instead, there is a generator:

```bash
cp .env.example .env.local     # then paste your Gemini API key into it
npm run art
```

That's it. Reload the game and the generated art appears.

- **Your key never touches the repo.** It lives in `.env.local`, which is
  gitignored, and the script *refuses to run* if that file ever stops being
  ignored or turns out to be tracked. There is no `--key=` flag on purpose: a
  key on the command line goes into your shell history.
- **`scripts/art-manifest.mjs` is the art direction.** One shared style
  paragraph plus one sentence of subject per piece, 26 in all. Edit a
  description, run `npm run art --  --only=raincoat --force`, look at it, edit
  again. To change the whole look, change `STYLE` once and regenerate.
- **It is resumable and per-piece.** Finished pieces are skipped, so an
  interrupted run costs nothing to restart. `--only=jar,wand` redoes two.
  `--dry-run` prints every prompt and calls nothing.
- **Nothing here can break the game.** Every sprite is optional and independent.
  A missing, failed or malformed piece just keeps its hand-drawn version, so a
  half-finished art run gives you a half-painted game rather than a broken one.
  The fairness contracts and the 91 trials never look at any of it.

Other flags: `--model=gemini-3-pro-image-preview` for the pricier model,
`--size=512px` to cut the download (the sprites are served to a phone, so this
is worth doing), `--force` to redo what already exists.

## Status

Playable end to end: ten levels, ten toys, ten kids, three difficulties, saved progress and
stars. All 91 trials and every design contract pass.
