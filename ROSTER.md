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
last lesson.

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
6. **World 5, The Treehouse**, and the Big Sister.

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
six in the backyard, seven in the bathroom — one more per world entered, which
gives back exactly the slot each world's prerequisite takes. The raincoats that
levels 19, 20 and 27–30 had lost are back.

A contract checks a level never deals more cards than the tray holds at that
point in the campaign, and the tray's overflow check now runs against the
maximum rather than against five — a tray that fits today and overflows at
level 21 is a bug nobody meets until a child has played for a week.

## What has to stay true

Every one of these is a data edit plus a painter, and the moment one of them
needs a fifth file, something belongs in a registry that isn't there yet — see
decision 18. The other guarantee is that **the checks scale for free**: levels
11–15 took the trial count from 91 to 121 without a test being written, and
found two real bugs on the way in. Fifty levels is a content problem in this
codebase, not an engineering one, and the whole point of the plan above is to
keep it that way.
