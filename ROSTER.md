# The roster plan

Where this is going, and what each step costs. Plants vs Zombies shipped **49
plants, 26 zombies and 50 levels across 5 areas**; this is the equivalent for a
bedroom full of toys, with the engineering cost written next to each entry so
the cheap content can be told apart from the expensive content.

**Today: 20 toys, 10 kids, 40 levels, 4 worlds, endless mode.** Everything below is a plan,
not a promise.

## First, what of PvZ is actually signal

Roughly a third of PvZ's 49 plants are the same plant with a bigger number —
Peashooter into Repeater into Gatling Pea, Sunflower into Twin Sunflower,
Cabbage-pult into Melon-pult. Those exist to give an upgrade economy something
to sell, and they are the cheapest possible content: one `ToyDef`, one painter,
no new rule.

The other two thirds each add a **verb**. Torchwood changes what passes through
it. Pumpkin wraps another plant. Garlic redirects a lane. Magnet-shroom removes
armour. Those are the ones worth the time, and the ones that cost real work.

The same is true of the zombies: Conehead and Buckethead are one idea at two
numbers, while Pole Vaulter, Digger and Balloon each invalidate a different
build.

**So the plan is weighted towards verbs, and honest about which entries are
padding.** A fifty-level campaign needs some padding — a level whose new toy is
"the last one but stronger" is a rest, and children like rests — but it should
be deliberate.

## The five worlds

A world is a **terrain rule**, not a repaint. This is the single reason PvZ's
fifty levels don't feel like ten repeated: each area changed what the board
does and invalidated the build that had been working.

| # | World | Terrain rule | Status |
|---|---|---|---|
| 1 | **The Bedroom** | None. Every cell takes any toy. | **Built** (levels 1–10) |
| 2 | **The Backyard** | Paddling pool. Water cells need a Duck Ring first. | **Built** (11–20) |
| 3 | **Bath Time** | Steam. Kids past column five are silhouettes until a Little Fan clears that row. | **Built** (21–30) |
| 4 | **The Attic** | No floor — bare joists. Every toy needs a Shelf under it. Plus stacks of boxes that stop a flat shot. | **Built** (31–40) |
| 5 | **The Treehouse** | Two entrances. Kids come from the right *and* climb up through a trapdoor mid-board. | Planned |

World 4 is deliberately the "roof" of this game: it makes every previous build
cost double and forces the lobbed-shot toys to matter. World 5 breaks the
one-directional assumption the whole game has been teaching, which is the right
last lesson — see **Expansions, parked** at the bottom for what it needs.

## Toys

`data` = one `ToyDef` and one painter, no engine change.
`small` = one new field and a branch in `combat.ts`.
`system` = a genuinely new mechanic.

### Producers

| Toy | PvZ | Cost | Status |
|---|---|---|---|
| Glitter Jar | Sunflower | — | **Built** |
| Sparkle Fountain | Twin Sunflower | — | **Built** |
| Night Lamp | Sun-shroom (grows) | small | Planned — cheap, starts weak, doubles after 30s |
| Piggy Bank | Marigold | data | Planned — pays out on a timer, no defence |

### Shooters

| Toy | PvZ | Cost | Status |
|---|---|---|---|
| Bubble Wand | Peashooter | — | **Built** |
| Water Gun | Repeater | — | **Built** |
| Bubble Machine | Threepeater | — | **Built** |
| Sprinkler | Starfruit-ish | — | **Built** |
| Super Soaker | Gatling Pea | data | Planned — the padding entry, and fine |
| Slushie Cup | Snow Pea | — | **Built** — its hits leave a lingering chill |
| Two-Way Wand | Split Pea | small | Planned — fires left as well, for the treehouse |
| Bath Toy Lobber | Cabbage-pult | **system** | **Built** (level 32) — arcs over the attic's box stacks. Fractionally weaker than a Water Gun in the open, on purpose. |
| Beach Ball | — | — | **Built** — passes through kids instead of stopping |

### Walls and floor

| Toy | PvZ | Cost | Status |
|---|---|---|---|
| Pillow Fort | Wall-nut | — | **Built** |
| Sand Castle | Tall-nut | — | **Built** |
| Sticky Slime | Spikeweed (slow, not damage) | — | **Built** |
| Duck Ring | Lily Pad | — | **Built** |
| Shelf | Flower Pot | **system** | **Built** — world 4's prerequisite. Literally the ring's twin: same layer, same price, different world. |
| Blanket Wrap | Pumpkin | **system** | Planned — armour placed *around* an existing toy. New layer. |
| Jacks | Spikeweed (damage) | small | Planned — floor tile that hurts, not slows |

### Instants

| Toy | PvZ | Cost | Status |
|---|---|---|---|
| Nightlight | Plantern + Jalapeno | — | **Built** |
| Powder Puff | Cherry Bomb | — | **Built** |
| Guard Bear | Lawnmower | — | **Built** (not a card) |
| Ice Lolly | Ice-shroom | small | Planned — freezes the whole board briefly |
| Toy Box | Squash | small | Planned — one kid, gone, cheap, single use |
| Little Fan | Blover | — | **Built** — clears its row's steam. Sight only. |

### Verbs worth stealing

| Toy | PvZ | Cost | Why it earns its place |
|---|---|---|---|
| Bubble Bath | Torchwood | **system** | **Built** (level 22) — bubbles through it come out double. The first toy that makes *placement order* matter. |
| Squeaky Toy | Garlic | **system** | **Built** (level 23) — sends whoever finds it one row toward the MIDDLE, four times, then it wears out. |
| Magnet Wand | Magnet-shroom | **system** | **Built** (level 26) — strips a shield within three rows, every ten seconds. |
| Chomper Puppet | Chomper | small | Eats one kid whole, then chews for eight seconds and is helpless. |

## Kids

| Kid | PvZ | Cost | Status |
|---|---|---|---|
| Crawler, Toddler, Runner | Basic / Flag | — | **Built** |
| Raincoat Kid | Screen Door | — | **Built** |
| Blanket Kid | (none — ours) | — | **Built** |
| Balloon Kid | Balloon Zombie | — | **Built** |
| Puffy Coat | Conehead | — | **Built** |
| Sock Slider | Dolphin Rider | — | **Built** |
| Wagon Kid | Buckethead | — | **Built** |
| The Big Kid | Gargantuar | — | **Built** |
| Bucket Head | Buckethead (tier 2) | data | Padding, and needed for the Magnet Wand to have a job |
| Pogo Kid | Pogo Zombie | small | Hops the first wall it meets |
| Stool Kid | Ladder Zombie | small | Puts a stool on a wall, and everyone behind walks over |
| Pillow Fighter | Newspaper Zombie | small | Gets *faster* when its pillow is destroyed |
| Trike Kid | Zomboni | **system** | Rides over and flattens toys, leaves a slippery track |
| Hide-and-Seek Kid | Digger | **system** | Tunnels under the board and pops up behind you |
| Jack-in-the-Box Kid | Jack-in-the-Box | small | Wanders in and startles, destroying nearby toys |
| Snorkel Kid | Snorkel Zombie | small | World 3 — untargetable while under the bubbles |
| Bunk-Bed Climber | Bungee | **system** | World 5 — drops in from above and steals a toy |
| Big Sister | Dr Zomboss | **system** | The final boss. Two phases. |

## Build order

Content before systems, and a world at a time, because a world is the unit a
player experiences.

1. ~~Finish World 2~~ — **done**, levels 11–20 with the Slushie Cup, Beach Ball
   and Sand Castle.
2. ~~Endless mode~~ — **done**. Waves survived is the score; a competent bot
   reaches about wave 50 on EASY and 31 on HARD.
3. ~~World 3, Bath Time~~ — **done**, levels 21–30.
4. ~~The verb toys~~ — **done**. Bubble Bath, Squeaky Toy and Magnet Wand, taught
   on levels 22, 23 and 26 respectively. Those three levels unlocked nothing
   before, which made the bathroom ten levels long with one new card in it.
5. ~~World 4, The Attic~~ — **done**, levels 31–40 with the Shelf, the Bath Toy
   Lobber and box stacks that stop a flat shot.
6. **Stopped here, deliberately.** Forty levels, four worlds and twenty toys is
   more game than has actually been played. Everything past this point waits on
   watching a five-year-old play what exists — every good decision in this
   project so far came from that and not from the plan. See **Expansions,
   parked** at the bottom for what is queued and why.

## The loadout squeeze

Worth stating before World 4, because it has now bitten twice. Each world after
the first adds a **prerequisite toy** — the Duck Ring, the Little Fan — and
every loadout in that world spends one of its five slots on it. With the Glitter
Jar taking another, later worlds have **three** defensive cards where the
bedroom had four.

Three does not fit water-immunity plus a floater plus a tank, so levels 19, 20
and 27–30 all had to drop their raincoats. That is a real design cost, and it
compounds: the Attic wants a Shelf and the Treehouse will want something too.

**Fixed**, the way PvZ did it: the tray now grows. Five cards in the bedroom,
six in the backyard, seven in the bathroom, eight in the attic — one more per
world entered, which gives back exactly the slot each world's prerequisite
takes. The raincoats that levels 19, 20 and 27–30 had lost are back.

A contract checks a level never deals more cards than the tray holds at that
point in the campaign, and the tray's overflow check now runs against the
maximum rather than against five — a tray that fits today and overflows at
level 21 is a bug nobody meets until a child has played for a week.

### Eight is the ceiling, and it constrains World 5

Seven cards reach x=374 on the narrowest 480px frame and eight reach x=419,
with the broom parked at x=442. There is no ninth without moving the purse
readout, which means **World 5 cannot have a prerequisite toy.** Whatever the
treehouse's terrain rule turns out to be, it has to be something the existing
roster already answers — or the ninth slot has to be bought by redesigning the
tray, which is a bigger job than the world.

This is the single most important constraint on anything below.

## Expansions, parked

Everything here is designed enough to start and none of it is started. Kept in
one place so that picking the project up again is reading a page rather than
reconstructing an argument.

**Read the constraint above first.** The tray is full at eight cards, and that
rules out a whole class of otherwise obvious ideas.

### The one big thing: World 5, The Treehouse

The last world, and the one that breaks the assumption every other world has
been reinforcing: **kids come from the right.** In the treehouse they also climb
up through a trapdoor somewhere in the middle of the board, which invalidates
the habit of stacking everything at the back — the single strongest habit the
game teaches.

That is the right last lesson, and it is the only remaining terrain rule that
does not need a prerequisite toy, which is what makes it the one that still
fits. What it needs:

- **A second spawn point** that is a CELL rather than the door. Kids appear at
  the trapdoor already halfway across, so `spawnX()` grows a variant and the
  wave format grows a way to say "this beat arrives at the trapdoor".
- **The trapdoor drawn as a real thing on the board**, well before anyone comes
  out of it. A kid appearing out of blank floor is a cheat; a kid appearing out
  of a trapdoor you have been looking at for two minutes is a rule.
- **The Two-Way Wand** (Split Pea) becomes worth building for the first time —
  it fires left as well, which is worthless in every world so far and is the
  answer to something arriving behind your guns.
- **The Big Sister** (Dr Zomboss), the final boss, two phases.
- **The Bunk-Bed Climber** (Bungee), who drops in from above and steals a toy.

Rough cost: the biggest single item left. Two spawn points touch `waves.ts`,
`levels.ts`, `enemies.ts` and the renderer, and the boss is a behaviour that
does not exist yet.

### Toys still on the list, cheapest first

The cheap ones are genuinely cheap — one `ToyDef`, one painter, one line in a
level's `unlocks` — and a level whose new toy is "the last one but stronger" is
a rest, which children like.

| Toy | Cost | Note |
|---|---|---|
| Super Soaker | data | The padding entry, and fine. A stronger Water Gun. |
| Piggy Bank | data | Pays out on a timer, no defence at all. |
| Bucket Head (kid) | data | Gives the Magnet Wand a second job. |
| Night Lamp | small | Starts weak, doubles after 30s. Rewards building early. |
| Jacks | small | Floor tile that HURTS rather than slows — Sticky Slime's twin. |
| Ice Lolly | small | Freezes the whole board briefly. |
| Toy Box | small | One kid, gone. Cheap, single use. |
| Chomper Puppet | small | Eats one kid whole, then is helpless for eight seconds. |
| Two-Way Wand | small | Fires left as well. **Waits for World 5** — pointless before it. |
| Blanket Wrap | **system** | Armour placed *around* an existing toy. Needs a fourth layer, which is the only entry here that touches `ToyGrid`. |

### Kids still on the list

| Kid | Cost | Note |
|---|---|---|
| Pogo Kid | small | Hops the first wall it meets. |
| Pillow Fighter | small | Gets *faster* when its pillow is destroyed. |
| Stool Kid | small | Puts a stool on a wall and everyone behind walks over. |
| Snorkel Kid | small | Untargetable under the bubbles. Belongs in world 3. |
| Jack-in-the-Box Kid | small | Wanders in and startles, destroying nearby toys. |
| Trike Kid | **system** | Flattens toys and leaves a slippery track. |
| Hide-and-Seek Kid | **system** | Tunnels under the board and pops up behind you. |
| Bunk-Bed Climber | **system** | Drops in from above and steals a toy. World 5. |
| Big Sister | **system** | The final boss. Two phases. |

### Small things noticed but not done

- **The broom is not in the glossary.** That screen iterates the toy roster and
  the broom is a tool, not a toy. Its armed state is fairly self-explanatory —
  everything sweepable lights up — but the glossary exists precisely because
  things get forgotten, and a tool with no entry is a gap in it. Slightly more
  pointed now that it has generated art and looks exactly like a card.
- **Endless is only ever trialled with one hand.** `endlessKit` draws eight
  cards per run and `trialEndlessEnds` runs a single fixed seed, so "endless
  eventually ends" is proven for one draw out of hundreds. The hand is
  guaranteed openable and guaranteed to hold three useful cards, which is why
  this is parked rather than urgent — but a hand of eight walls-and-slime is
  not impossible, and nothing currently measures how the mode plays with one.
- **No cooldown on the broom.** A player could sweep a wall the instant before
  it breaks so the kid has nothing to chew. No five-year-old will find that, and
  a cooldown on a tidy-up tool is a confusing thing to explain, so it is
  deliberately absent — but it is the obvious lever if it ever matters.
- **The good bot fills spare cells with `walls[0]`,** which in the attic is the
  Shelf. Harmless, and it means the bot lays bare shelves it never builds on.
  Worth a smarter rule if a future world's fairness depends on it.
- **`ARC_HEIGHT` is a fixed 26px.** A lob crossing two cells and one crossing
  seven rise the same amount, because the arc is measured against the distance
  left to run. Fine today; wrong-looking if a short-range lobber ever exists.
- **The Pillow Fort is the only wall with a recharge.** Twelve seconds, while the
  Duck Ring, the Fan, the Squeaky Toy, the Soap Dish, the Shelf and the Sand
  Castle all have none — a player can lay Sand Castles as fast as she can afford
  them, and that is the rule rather than the exception. Asked about, and correct
  as it stands: walls are limited by CELLS and by price, not by a timer, and the
  Castle's 125 sparkles per cell is the cost. The Fort is the odd one out and it
  is the cheap one, which is the wrong way round if the recharge is doing any
  work at all. Left alone because nothing is currently broken by it and the
  campaign is tuned around the number as it is.
- ~~`hasTargetIn` runs its aerial pass for every shooter~~ — **fixed**, see
  decision 64. It was parked as a wasted-shots problem, which undersold it: a
  Water Gun firing under a Balloon Kid reads as a broken toy rather than as the
  wrong toy, and "go and get a different one" is the whole lesson level six
  exists to teach.

### Not content: debts to pay

- **Rotate the Gemini API key.** It was leaked into a transcript once. The
  generate-art script has no `--key=` flag and refuses to run unless
  `.env.local` is gitignored, but the key itself is still the old one.
- **Regenerate `bigkid.motion`.** Reported as "the big kid's clothes change as
  the walk cycle continues", and they do: walk frames 1 and 3 wear a closed purple
  top with the green bunny on his chest, frames 2 and 4 an open purple jacket over
  a cream tee with no bunny at all. At walking speed his jacket does itself up and
  undoes itself twice a second and the bunny blinks.

  He is the only child in the cast whose outfit layers one garment over another,
  and the shared consistency rules could not catch it: they forbid *changing* a
  colour or adding a panel, and nothing changed colour — the ambiguity is in "a
  top OVER a t-shirt", which describes two consistent garments and never says how
  much of the lower one shows. The manifest now states the layering as a visible
  fact about the picture ("the jacket is ALWAYS open, a wide panel of cream is
  visible in every frame"), in both the outfit line and the cycle line, and keeps
  the open jacket because that is what the model drew in six of the eight frames.

  The prompt is fixed; the file on disk is not, and cannot be until someone with
  a key runs `npm run art -- --only=bigkid.motion --force` — one billed call. The
  still `bigkid.jpg` is worth doing in the same run for the same reason, though
  nothing sees it while the sheet exists. Check the result with
  `__game.checkArt()` and by eye before committing.
- ~~Back-port the `viewport.ts` NaN fix~~ — **done**. Both siblings floor the
  window at one pixel, and `src/core/viewport.ts` is byte-identical across all
  three games again.
- **Extract the shared core.** Decision 2 deferred this and named the trigger as
  "a bug fixed in one core file that has to be applied by hand in three places".
  That trigger has now fired — the NaN fix sat in one copy for months and was
  only found because one person happened to be looking at all three. Deferred a
  second time on purpose (see decision 55); three finished, deployed games are a
  bad moment to restructure. A cheap intermediate step if it comes up sooner: a
  script that hashes the six shared files across the repos and complains.

## What has to stay true

Every one of these is a data edit plus a painter, and the moment one of them
needs a fifth file, something belongs in a registry that isn't there yet — see
decision 18. The other guarantee is that **the checks scale for free**: levels
11–15 took the trial count from 91 to 121 without a test being written, and
found two real bugs on the way in. Fifty levels is a content problem in this
codebase, not an engineering one, and the whole point of the plan above is to
keep it that way.
