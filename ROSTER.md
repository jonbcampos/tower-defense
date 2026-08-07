# The roster plan

Where this is going, and what each step costs. Plants vs Zombies shipped **49
plants, 26 zombies and 50 levels across 5 areas**; this is the equivalent for a
bedroom full of toys, with the engineering cost written next to each entry so
the cheap content can be told apart from the expensive content.

**Today: 15 toys, 10 kids, 30 levels, 3 worlds, endless mode.** Everything below is a plan,
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
| 4 | **The Attic** | No floor — bare joists. Every toy needs a Shelf under it, anywhere on the board. | Planned |
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
| Bath Toy Lobber | Cabbage-pult | **system** | Planned — an arcing shot that ignores walls. Needed for world 4. |
| Beach Ball | — | — | **Built** — passes through kids instead of stopping |

### Walls and floor

| Toy | PvZ | Cost | Status |
|---|---|---|---|
| Pillow Fort | Wall-nut | — | **Built** |
| Sand Castle | Tall-nut | — | **Built** |
| Sticky Slime | Spikeweed (slow, not damage) | — | **Built** |
| Duck Ring | Lily Pad | — | **Built** |
| Shelf | Flower Pot | **system** | Planned — world 4's prerequisite, same shape as the ring |
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
| Bubble Bath | Torchwood | **system** | Shots passing through it get bigger. The first toy that makes *placement order* matter. |
| Squeaky Toy | Garlic | **system** | A kid who reaches it changes lane. Turns five lanes into a funnel. |
| Magnet Wand | Magnet-shroom | **system** | Strips the Wagon Kid's shield and the Bucket Kid's bucket at range. |
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
4. **The verb toys.** Bubble Bath, Squeaky Toy, Magnet Wand. These are the ones
   that make the loadout a real decision, and they are worth more than another
   ten levels of the same choices.
5. **World 4, The Attic**, which needs the Shelf and the Lobber.
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

The fix, when it becomes intolerable, is the one PvZ used — **more card slots as
you progress**. Six from world 3, seven from world 5. It touches `maxLoadout`,
the tray layout and the tray's don't-cover-a-cell contract, so it is a morning's
work rather than a line, and it is the right answer rather than trimming another
roster.

## What has to stay true

Every one of these is a data edit plus a painter, and the moment one of them
needs a fifth file, something belongs in a registry that isn't there yet — see
decision 18. The other guarantee is that **the checks scale for free**: levels
11–15 took the trial count from 91 to 121 without a test being written, and
found two real bugs on the way in. Fifty levels is a content problem in this
codebase, not an engineering one, and the whole point of the plan above is to
keep it that way.
