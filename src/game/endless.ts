/**
 * Endless mode: waves for as long as you can hold them.
 *
 * A `Level` like any other, except its `waves` array grows as you reach the end
 * of it. That is the entire trick, and it is why endless needed almost no new
 * engine: `WaveRunner` reads `level.waves[index]`, so a level whose array keeps
 * getting longer is a level that never finishes. Nothing in the runner, the
 * combat, the economy or the renderer knows this mode exists.
 *
 * ## What the score is
 *
 * Waves survived. Not kids turned round, not sparkles banked, not time. A wave
 * is the unit the game already shouts about, the progress bar already counts,
 * and a five-year-old can already hold in her head — "I got to seven" is a
 * thing she can say and want to beat. Any of the others would be a bigger
 * number that means less.
 *
 * ## What it escalates
 *
 * A budget per wave, spent on kids priced by how much trouble they are. Both
 * halves matter: the budget rising means later waves are bigger, and the prices
 * meaning the budget buys FEWER, HARDER kids as it grows rather than a hundred
 * crawlers. Wave forty should not be wave four with more of it.
 *
 * The roster is only what she has met. Endless is unlocked part way through the
 * campaign, and a Big Kid arriving in wave two of someone's first endless run —
 * before the level that introduces him — is a thing she has no answer to and no
 * reason to expect.
 */

import { LANE_COUNT, LEVELS_PER_WORLD, MAX_LOADOUT_SLOTS, POOL } from './config';
import type { Difficulty } from './config';
import { ENEMIES, type EnemyKind } from './enemies';
import { firstAppearance, type Level, type Wave, type WaveBeat } from './levels';
import { TOYS, TOY_ORDER, toyDealsDamage, toyIncome, type ToyId } from './toys';
import type { Rng } from '../core/rng';

/**
 * The endless level's id. Not 1..LEVEL_COUNT, on purpose: it must never match a
 * real level, because `save.unlocked` and the stars map are both keyed by id
 * and an endless run is neither unlockable nor star-rated.
 */
export const ENDLESS_ID = 0;

/** What the purse opens with. Exported so a trial can hold the hand to it. */
export const ENDLESS_START_SPARKLES = 200;

/** How many waves to keep generated ahead of the one being played. */
const LOOKAHEAD = 6;

/**
 * What each kid costs out of a wave's budget.
 *
 * Roughly their bounty, which is already a statement of how much trouble they
 * are, but hand-set rather than derived: bounty is tuned for the economy and
 * this is tuned for the threat, and the two agreeing today is a coincidence
 * rather than a rule worth encoding.
 */
const PRICE: Record<EnemyKind, number> = {
  crawler: 1,
  toddler: 2,
  runner: 3,
  raincoat: 4,
  blanket: 4,
  balloon: 4,
  slider: 5,
  puffy: 7,
  wagon: 8,
  bigkid: 20,
};

/**
 * How much tougher every kid is by wave `n`.
 *
 * Flat until TOUGHEN_FROM so the first dozen waves are the roster she knows at
 * the strength she knows it, then linear. Linear rather than exponential for
 * the same reason as the budget: a curve that doubles every ten waves is over
 * in forty and spends thirty of them being trivial.
 */
function toughness(wave: number): number {
  return 1 + Math.max(0, wave - TOUGHEN_FROM) * 0.07;
}

/** The wave after which kids start getting tougher as well as more numerous. */
const TOUGHEN_FROM = 12;

/** Wave `n`'s budget. Linear, because exponential stops being playable at nine. */
function budgetFor(wave: number, difficulty: Difficulty): number {
  return (3 + wave * 1.6) * difficulty.enemyHpScale;
}

/**
 * Build the endless level. `waves` starts with the lookahead and grows later.
 *
 * `recommended` is every toy she owns rather than a curated five, because
 * endless has no lesson to teach — the campaign levels pick five to make a
 * point, and this one is the exam with no syllabus.
 */
/**
 * A built endless run: the level, and the one function that extends it.
 *
 * `grow` is a closure over the roster, the difficulty and the rng so that
 * `GameState` can keep the level topped up without knowing what any of those
 * are. The simulation's job is to notice it is running low on waves; deciding
 * what a wave contains is this module's, and the seam between them is one
 * function of one argument.
 */
export interface EndlessRun {
  level: Level;
  /** Ensure waves exist through `index + LOOKAHEAD`. Idempotent. */
  grow(index: number): void;
  /**
   * Extra multiplier on enemy health at this wave. 1 for the first dozen.
   *
   * Without this the mode does not end. The board is 45 cells and a wave can
   * only hold so many kids before the pool runs out, so a player who fills the
   * board plateaus — a bot driven to wave 120 still had three hearts, a full
   * board, and no prospect of ever losing. More kids stops being an escalation
   * once you cannot fit more kids; tougher kids never stops.
   */
  toughnessAt(index: number): number;
}

export function buildEndless(
  unlockedToys: readonly ToyId[],
  highestLevel: number,
  difficulty: Difficulty,
  rng: Rng,
): EndlessRun {
  const level: Level = {
    id: ENDLESS_ID,
    world: 'bedroom',
    name: 'Endless',
    teaches: 'How long can you hold them off?',
    unlocks: [],
    recommended: unlockedToys,
    blocked: [],
    startSparkles: ENDLESS_START_SPARKLES,
    // Mutable on purpose, and the one place in this codebase a level's waves
    // are not frozen content. `growEndless` appends to it.
    waves: [],
  };
  const roster = rosterFor(highestLevel);
  const append = (count: number): void => {
    const waves = level.waves as Wave[];
    for (let i = 0; i < count; i++) waves.push(makeWave(waves.length, roster, difficulty, rng));
  };
  append(LOOKAHEAD);

  return {
    level,
    grow(index: number): void {
      const want = index + LOOKAHEAD;
      if (level.waves.length > want) return;
      append(want - level.waves.length + 1);
    },
    toughnessAt(index: number): number {
      return toughness(index + 1);
    },
  };
}

/**
 * The lowest `save.unlocked` at which endless is offered — clearing the bedroom.
 *
 * Here rather than in the menu that draws the button, because two things depend
 * on it: whether the button lights up, and how far down the campaign the trials
 * bother checking the hand endless deals. The gate lived next to the button and
 * the trial swept from level one, which is how the first version of that trial
 * failed on a hand drawn from the single toy you own at level one — a state the
 * mode can never actually be started in.
 */
export const ENDLESS_UNLOCKED_AT = LEVELS_PER_WORLD + 1;

/**
 * The hand endless deals you: a tray's worth of toys, never more.
 *
 * Endless used to deal EVERYTHING you owned, which was fine when that was ten
 * toys and quietly broken by the time it was twenty — the tray is eight cards
 * wide, so the ninth card onwards was drawn off the right-hand edge, under the
 * broom and past the frame. Cards you cannot reach are worse than cards you do
 * not have: the mode looked like it was offering you the Bubble Machine and
 * then refused to hand it over.
 *
 * Three rules, in order:
 *
 *  - **Floats are dropped.** The endless board is a dry bedroom, so a Duck Ring
 *    and a Shelf have nothing to do there. They are prerequisites for terrain
 *    this mode does not have, and a dead card in a hand of eight is a real loss.
 *  - **The two anchors are always dealt** — the cheapest producer and the
 *    cheapest damage card she owns, which in practice means the Glitter Jar and
 *    the Bubble Wand. Not merely "a producer and two attackers": the campaign
 *    holds every level to opening with a producer PLUS a defender out of the
 *    starting purse, and a hand whose cheapest two are a Sparkle Fountain and a
 *    Bubble Machine fails that on wave one. Random is fine; unable to open is
 *    not. They are also the two cards she has known since level two, which is
 *    no bad thing to find in a hand she did not choose.
 *  - **One more attacker, then the rest is random, re-rolled every run.** This
 *    is the reason to cap rather than to fix a list: "what did I get this time"
 *    is the mode's own small novelty, and it costs nothing.
 *
 * Returned in TOY_ORDER, never in the order they were drawn. Where a card sits
 * in the tray is the thing she actually remembers — the jar is always first —
 * and shuffling the layout as well as the contents would make every run start
 * with re-reading the tray.
 */
export function endlessKit(owned: readonly ToyId[], rng: Rng): ToyId[] {
  const usable = owned.filter((id) => TOYS[id].layer !== 'float');
  const slots = Math.min(MAX_LOADOUT_SLOTS, usable.length);

  const bag = [...usable];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [bag[i], bag[j]] = [bag[j] as ToyId, bag[i] as ToyId];
  }

  const kit = new Set<ToyId>();
  const cheapest = (want: (id: ToyId) => boolean): ToyId | undefined =>
    usable.filter(want).sort((a, b) => TOYS[a].cost - TOYS[b].cost)[0];
  // The anchors come off `usable` rather than the shuffled bag on purpose:
  // "cheapest" has to mean cheapest, not cheapest-of-the-first-few.
  for (const anchor of [cheapest((id) => toyIncome(id) > 0), cheapest(toyDealsDamage)]) {
    if (anchor && kit.size < slots) kit.add(anchor);
  }

  const take = (want: (id: ToyId) => boolean, count: number): void => {
    for (const id of bag) {
      if (kit.size >= slots || count <= 0) return;
      if (kit.has(id) || !want(id)) continue;
      kit.add(id);
      count--;
    }
  };
  take(toyDealsDamage, 1);
  take(() => true, slots);

  return TOY_ORDER.filter((id) => kit.has(id));
}

/** Every kid she has actually met, cheapest first. */
function rosterFor(highestLevel: number): EnemyKind[] {
  return (Object.keys(ENEMIES) as EnemyKind[])
    .filter((kind) => {
      const at = firstAppearance(kind);
      return at > 0 && at <= highestLevel;
    })
    .sort((a, b) => PRICE[a] - PRICE[b]);
}

/**
 * The wave at `index`, in two passes.
 *
 * **Pass one spends most of the budget on the dearest kid it can afford**, and
 * how strongly it prefers dear scales with the wave number. Without the ramp,
 * wave two bought a Sock Slider — the fastest kid in the game, in the second
 * wave of the mode — because she was simply the priciest thing affordable.
 *
 * **Pass two spends what is left on cheap kids.** This is what stops a late
 * wave being four Big Kids and nothing else: a budget spent entirely on tanks
 * buys a wave that is harder and *emptier* than the one before it, and an empty
 * board with three enormous children on it is less frightening than a crowd. A
 * late wave should be tanks WITH a crowd, which is also what a Plants vs
 * Zombies flag wave actually looks like.
 */
function makeWave(index: number, roster: EnemyKind[], difficulty: Difficulty, rng: Rng): Wave {
  const number = index + 1;
  const total = budgetFor(number, difficulty);
  const beats: WaveBeat[] = [];
  // Two waves can be on the board at once when one times out rather than
  // clearing, so a single wave may never exceed half the pool.
  const cap = Math.min(Math.floor(POOL.enemies / 2) - 2, 3 + Math.floor(number / 2));

  // A ceiling on how dear a single kid may be, rising with the wave.
  //
  // The budget alone was not enough of a gate. Wave one could afford exactly
  // one four-point kid, so it opened with a lone Balloon Kid — a floater that
  // needs a specific answer — and wave three with a single Puffy Coat. Each was
  // technically within budget and each was a wall. The ceiling makes the early
  // waves introduce the roster in roughly the order the campaign does, and
  // stops being the binding constraint about ten waves in.
  const ceiling = 1 + number * 0.8;
  // The boss is held back separately. He is the campaign's final exam, and
  // meeting him in wave twelve of a mode with no checkpoints is not an
  // escalation, it is an end.
  const usable = roster.filter(
    (kind) => PRICE[kind] <= ceiling && (kind !== 'bigkid' || number >= BIGKID_FROM),
  );
  // The ceiling can exclude everything on wave one if the roster is short.
  if (usable.length === 0) usable.push(roster[0]!);
  const cheapest = PRICE[usable[0]!] ?? 1;
  // The cheap half, for pass two. At least one entry however short the roster.
  const filler = usable.slice(0, Math.max(1, Math.ceil(usable.length / 2)));

  const dearChance = Math.min(0.8, 0.1 + number * 0.035);
  let budget = total;
  const heavyFloor = total * 0.4;

  while (budget > heavyFloor && beats.length < cap) {
    const affordable = usable.filter((kind) => PRICE[kind] <= budget);
    if (affordable.length === 0) break;
    const pick =
      rng.next() < dearChance
        ? affordable[affordable.length - 1]!
        : affordable[rng.int(0, affordable.length - 1)]!;
    budget -= PRICE[pick];
    beats.push(beat(pick, number, beats.length, rng));
  }

  while (budget >= cheapest && beats.length < cap) {
    const affordable = filler.filter((kind) => PRICE[kind] <= budget);
    if (affordable.length === 0) break;
    const pick = affordable[rng.int(0, affordable.length - 1)]!;
    budget -= PRICE[pick];
    beats.push(beat(pick, number, beats.length, rng));
  }

  // Guarantee something. A budget rounding down to nothing would hand her an
  // empty wave, which clears instantly and reads as the game having broken.
  if (beats.length === 0) beats.push(beat(usable[0] ?? 'crawler', number, 0, rng));

  return {
    beats,
    timeout: Math.max(14, 26 - number * 0.25),
    // Every fifth, so there is a rhythm to brace for rather than a flat ramp.
    big: number % 5 === 0,
  };
}

/** The wave the Big Kid may first appear in. */
const BIGKID_FROM = 15;

function beat(kind: EnemyKind, number: number, position: number, rng: Rng): WaveBeat {
  return {
    kind,
    lane: rng.int(0, LANE_COUNT - 1),
    // The first beat lands immediately; the rest trickle in. The spread shrinks
    // as waves get bigger, so later waves arrive as a crowd rather than as a
    // queue — which is the actual difference between wave 5 and wave 25.
    gap: position === 0 ? 0 : Math.max(0.45, 2.6 - number * 0.045) * (0.5 + rng.next()),
  };
}
