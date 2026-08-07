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

Forty levels across four worlds, a new toy every level or two, and a **Guard Bear** sitting at the end of every lane —
the first kid to reach the cushion in a lane gets swept into an enormous hug by the bear instead
of squeezing you, and the two of them wander off together. One bear per lane, once each.

Third in a set with [Flappy Unicorn](https://jonbcampos.github.io/flappy-unicorn/) and
[Ellie's Rainbow Run](https://jonbcampos.github.io/runner-game/), built the same way: TypeScript,
a 2D canvas, no engine, no runtime dependencies, no art or audio files.

## Running it

```bash
npm install && npm run dev
```

Open the printed Network URL on a phone to play it on a real touchscreen. Hold the phone either
way — the game rotates itself. On desktop, `1`–`5` pick a card and `Esc` puts it back.

Where it goes next — an equivalent of Plants vs Zombies' 49 plants, 26 zombies
and 50 levels, with the engineering cost written beside each entry — is in
[ROSTER.md](ROSTER.md).

## Why it's built this way

[DECISIONS.md](DECISIONS.md) is the running log of what we decided and why — read that before
changing anything structural. The short version:

- **`src/game/`** — the simulation. Never imports from `src/render/`; it has no idea how it
  looks. Presentation happens by draining an event queue in `main.ts`.
- **`src/game/config.ts`** — every global tuning number. The only exceptions are the two content
  registries, `TOYS` and `ENEMIES`, which are data tables rather than loose numbers.
- Nothing is allocated after startup. Every kid, projectile, sparkle and event lives in a fixed
  pool, and the toys are 45 pre-allocated objects indexed by cell.

### Eight ideas worth knowing before you change anything

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
Four are built: a dry bedroom; a backyard whose pool cells hold nothing until a Duck Ring floats
there; a bathroom whose far columns are hidden by steam until a Fan clears the row; and an attic
with no floor at all, where every cell needs a Shelf and stacks of boxes stop a flat shot.

**6. The tray grows with progress.** Five cards in the bedroom, six in the backyard, seven in the
bathroom, eight in the attic. Each world after the first spends a slot on its own prerequisite
toy, so a fixed five left later worlds a card short — the growth gives it back rather than
trimming the roster. Eight is the ceiling: a ninth card does not fit a 480px frame.

**7. Difficulty is chores first, pressure second.** EASY→NORMAL adds two things to *consider* —
you collect your own sparkles, you pick your own five cards — and speeds nothing up.
NORMAL→HARD keeps the identical vocabulary and turns up hit points, speed and wave density.
EASY never deletes an enemy type, so a child and a parent are watching the same game.

**8. A mis-tap never costs a sparkle.** An illegal placement gets a red X and its own sound, and
the purse does not move. The sound matters as much as the refund: silence, to a five-year-old,
means the game is broken, and she will keep tapping the same wrong cell rather than try another.
For the same reason nothing is deleted by a plain tap — tapping a toy you just put down undoes
it, and everything else needs the **broom** picked up first. Deletion is modal because the
accident was the problem, not the capability.

### Verifying it

Two layers, and both are worth running after any tuning change.

`validateDesignContracts()` runs on **every page load** and logs `[design] …` to the console. It
is pure arithmetic over the config, checked per level and per difficulty — the axis where a
change looks fine on NORMAL and quietly makes HARD impossible.

```js
__game.verify()
```

280 headless trials driving the real `GameState` with a scripted bot, across every level at every
difficulty — the count grows on its own as levels are added, which is the point. Every one reports **what it measured**, not just pass or fail. EASY and NORMAL are
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

The game ships with everything drawn in code — a few hundred rectangles and arcs. That reads
clearly and costs nothing, but it is deliberately plain. `npm run art` repaints the whole cast
using the Gemini image API.

### 1. Get a key

<https://aistudio.google.com/apikey>. Image generation needs billing enabled on the Google Cloud
project behind the key.

### 2. Put it in `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` and replace the placeholder:

```
GEMINI_API_KEY=AIza...your-real-key...
```

`.env.local` is gitignored, and the script **refuses to run** if that file ever stops being
ignored or turns out to be tracked by git. There is deliberately no `--key=` flag: a key on the
command line ends up in your shell history.

### 3. Look at the prompts first (free)

```bash
npm run art -- --dry-run
```

Prints all 51 prompts and calls nothing. Worth a skim — this is the art direction, and it is
much cheaper to fix a description here than after 51 billed calls.

### 4. Generate

```bash
npm run art
```

One API call per piece, 51 in total, printing `ok` / `skip` / `FAIL` as it goes. Finished pieces
are written straight to `public/sprites/` as JPEGs, so if it dies half way through — rate limit,
network, Ctrl-C — just run it again and it picks up where it stopped. Nothing already done is
paid for twice.

Budget roughly 36 images. At the time of writing `gemini-3.1-flash-image` is the cheap one and
`gemini-3-pro-image-preview` is several times the price; check current rates before doing a
`--force` run of the whole set.

Consider `npm run art -- --size=512` for the first pass. The sprites are drawn at about 30
pixels tall, so 1K is far more detail than the game can show, and every one of them is a file a
phone has to download.

### 5. Shrink it

```bash
npm run art:shrink
```

**Do this after every run.** The API returns pictures far larger than the game
draws — a 2752px background, a 1024px walk sheet, against a kid rendered about
thirty pixels tall — and all of that excess is download time on a phone. The
script resamples each piece to roughly 4x the size it is actually drawn at:
13.6 MB down to 1.25 MB, with no visible difference.

It overwrites the originals, which is the point, since those are what get
committed and served. The full-size versions stay in git history if a target
ever turns out to be too aggressive. Running it twice is harmless — anything
already small enough is skipped. Needs macOS (it uses `sips`, so that nothing
gets added to `package.json`); pass `--dry-run` to see the plan first.

Downscaling a large picture beats asking the model for a small one: it is a
resample of a finished drawing rather than a coarser drawing, and it is free.

### 6. Reload the game

That's it. No build step, no import to add. Anything in `public/sprites/` is picked up on the
next page load, and anything missing keeps its hand-drawn version.

### Fixing one piece you don't like

Descriptions live in [`scripts/art-manifest.mjs`](scripts/art-manifest.mjs) — one shared `STYLE`
paragraph, then a sentence of subject per piece. Edit the sentence, then redo just that piece:

```bash
npm run art -- --only=raincoat --force
```

`--force` is required to overwrite something that already exists. To change the whole look, edit
`STYLE` once and run `npm run art -- --force`.

### The flags

| Flag | What it does |
| --- | --- |
| `--dry-run` | Print the prompts, call nothing, spend nothing |
| `--only=jar,wand` | Just those pieces |
| `--force` | Redo pieces that already exist |
| `--size=512` | Smaller images. Valid sizes are `512`, `1K`, `2K`, `4K`. Prefer generating big and running `npm run art:shrink`, which keeps more detail for the same bytes |
| `--model=gemini-3-pro-image-preview` | The pricier, better model |
| `--list` | What has been generated so far |

### Things worth knowing

- **Nothing here can break the game.** Every sprite is optional and independent. A missing,
  failed or corrupt piece just keeps its hand-drawn version, so a half-finished run gives you a
  half-painted game rather than a broken one. The fairness contracts and the 91 trials never look
  at any of it. If you hate the result, `rm -rf public/sprites` puts everything back.
- **The generated JPEGs get committed**, because GitHub Pages builds from the repo. Straight out
  of the API the full set is about 13 MB, which is far too much to hand to a phone —
  `npm run art:shrink` takes it to about 1.25 MB and is not optional. `--size=512` is also kinder
  to both
  the repo and the phone downloading it.
- **JPEG, not PNG** — the API rejects PNG outright. That means no transparency, which is why the
  prompts ask for a flat green background and the game cuts it out at load time with a flood fill
  from the edges. If a piece comes back with something behind the subject, that background will
  survive; regenerate it rather than trying to fix it downstream.
- **Facing matters.** Kids are prompted facing left because they walk left; toys face right
  because they shoot right. If you rewrite a description, keep its direction — a lovely sprite
  facing the wrong way is a bug, because which way a thing points is how the player reads it.
  The one exception is the walk sheets, which are asked for facing **right** and mirrored at load;
  see below.

### Walk cycles

Ten of the 36 pieces are `<kid>.walk` — a 2x2 grid of four poses of one child, asked for in a
single call because an image model holds a character together within one picture far better than
across four. `src/render/kids.ts` picks a frame from how far the kid has walked, not from a
clock, so a child slowed by Sticky Slime plods instead of moonwalking.

Two things about them are not obvious and are both deliberate:

- **The frames are re-registered at load.** The model puts the four figures at slightly different
  sizes and heights in their cells, which played back is a child who grows and hops. `sliceSheet`
  trims each frame to its contents, pulls it most of the way to the median height, and plants them
  all on one floor line. Judge a cycle with `__game.sprites.frames('runner.walk')` rather than by
  watching a 20-pixel figure cross the board.
- **They are drawn facing right and mirrored.** Asked for left, all ten came back right — the pose
  text is full of "left leg" and "right leg" and the direction drowns in it, however forcefully it
  is stated. So the prompt asks for the direction the model is going to draw anyway and the loader
  flips it, which is deterministic where arguing with it was not.

A sheet that fails to generate, or comes back as three figures and a gap, simply isn't registered:
that kid keeps its still image and the procedural gait. Nothing has to be true for the game to run.

## Status

Playable end to end: **forty levels across four worlds**, an **endless mode**, twenty toys, ten kids, three
difficulties, saved progress and stars, an in-game guide, and the screen stays awake while you
play. All 280 trials and every design contract pass.

Every toy and kid has painted art.
