/**
 * The campaign.
 *
 * Adding a level touches this file and nothing else. That is the whole design
 * goal of the module: there are ten levels today and there is meant to be room
 * for fifty, so authoring one has to be a dozen readable lines rather than a
 * programming task.
 *
 * Every delay here is in SECONDS. Never pixels, never "frames", never a
 * distance. The board's geometry can change and the pacing of a level cannot
 * silently change with it — the same rule the runner game learned when a hazard
 * spacing measured in pixels turned into a different game at a different
 * scroll speed.
 */

import { COL_COUNT, LANE_COUNT, WAVE, cellIndex } from './config';
import type { EnemyKind } from './enemies';
import type { ToyId } from './toys';

// --- Worlds -----------------------------------------------------------------

/**
 * A world is a terrain rule, not a background.
 *
 * The reason Plants vs Zombies' fifty levels don't feel like ten repeated five
 * times is that each of its areas changed what the board itself does — night
 * removed the sky's income, the pool added lanes you couldn't build on, the
 * roof removed the ground. The same plants felt new because the rule under them
 * changed.
 *
 * v1 ships one world. This type exists now, with the fields the sketched worlds
 * would need, because retrofitting it later means touching every level.
 */
export type WorldId = 'bedroom' | 'backyard' | 'bathroom' | 'attic';

export interface World {
  id: WorldId;
  name: string;
  /** Lanes this world uses. Always the full board today. */
  lanes: number;
  /**
   * Multiplies the free trickle. A world with no ambient light ('Lights Out')
   * would set this to 0 and make a producer mandatory rather than obvious.
   */
  trickleScale: number;
  /**
   * The terrain rule. This is what makes a world a world rather than a
   * repaint — see decision 19 and the reason PvZ's fifty levels don't feel
   * like ten repeated: each area changed what the BOARD does, invalidating the
   * build that worked in the last one.
   *
   * `dry` is the bedroom: every unblocked cell takes any toy.
   * `pool` is the backyard: cells listed in a level's `water` hold nothing at
   * all until a Duck Ring floats there, and then behave like dry ground.
   * `steam` is the bathroom: the far half of the board is fogged, so a kid
   * walking in it cannot be SEEN — everything about her is unchanged, the
   * player simply does not know she is there.
   * `joists` is the attic: there is no floor at all, so EVERY cell needs a
   * Shelf before it holds anything. Deliberately the pool's rule turned all
   * the way up rather than a fourth idea — the pool taught it on three lanes,
   * and the attic is what that lesson looks like applied to the whole board.
   */
  terrain: 'dry' | 'pool' | 'steam' | 'joists';
  /**
   * The generated backdrop for this world's board, by sprite id.
   *
   * Falls back to the bedroom's, and then to the hand-drawn floor, so a world
   * whose art has not been generated yet is playable and merely wrong-looking
   * rather than blank. That is how the backyard shipped its first five levels.
   */
  background: string;
}

export const WORLDS: Record<WorldId, World> = {
  bedroom: { id: 'bedroom', name: 'The Bedroom', lanes: LANE_COUNT, trickleScale: 1, terrain: 'dry', background: 'room' },
  // Outdoors, in the sun, with the paddling pool out. The trickle is a touch
  // higher because there is daylight rather than one bedside lamp — a small
  // nudge that pays for the Duck Rings the terrain forces you to buy.
  backyard: { id: 'backyard', name: 'The Backyard', lanes: LANE_COUNT, trickleScale: 1.15, terrain: 'pool', background: 'yard' },
  // Bath time. Steam hides the far columns, so the board is the same size and
  // you can only use half of it with any confidence. The trickle is back to
  // normal — the pool's extra was paying for Duck Rings, and there are none here.
  bathroom: { id: 'bathroom', name: 'Bath Time', lanes: LANE_COUNT, trickleScale: 1, terrain: 'steam', background: 'bath' },
  // The attic. No floor, so every single cell costs a Shelf before it costs
  // anything else — which means half as many toys for the same sparkles. The
  // trickle is nearly half again to pay for that.
  //
  // It was a fifth higher and the world played fine, on a lie: a bare Shelf
  // used to be chewable, so every toy the player LOST left a 400-health wall
  // standing where it had been, and the attic was quietly being defended by its
  // own floor. Kids walk over bare floor now, and seven of these ten levels
  // failed the moment they had to be won with toys instead. This is what the
  // world actually costs.
  attic: { id: 'attic', name: 'The Attic', lanes: LANE_COUNT, trickleScale: 1.45, terrain: 'joists', background: 'attic' },
};

/** Worlds in the order they are played. Also the order of the level-select tabs. */
export const WORLD_ORDER: readonly WorldId[] = ['bedroom', 'backyard', 'bathroom', 'attic'];

// --- Waves ------------------------------------------------------------------

export interface WaveBeat {
  kind: EnemyKind;
  lane: number;
  /** Seconds after the previous beat in this wave. The first beat's is from the wave's start. */
  gap: number;
  /**
   * Only present above EASY. This is how a wave gets denser without being
   * rewritten three times — and it means the EASY version of a level is
   * provably a subset of the NORMAL one rather than a separate authoring.
   */
  optional?: boolean;
}

export interface Wave {
  beats: readonly WaveBeat[];
  /**
   * The wave after this one starts when this one is cleared OR this many
   * seconds have passed, whichever comes first. Clear-triggered so a strong
   * player never stands around watching an empty board; timeout-triggered so a
   * struggling one is never buried by a queue that kept advancing while she
   * was losing.
   */
  timeout: number;
  /** Announced ahead of time with a warning and a lane flash. */
  big: boolean;
}

const k = (kind: EnemyKind, lane: number, gap = 0): WaveBeat => ({ kind, lane, gap });
const o = (beat: WaveBeat): WaveBeat => ({ ...beat, optional: true });
const w = (beats: WaveBeat[], timeout: number = WAVE.defaultTimeout): Wave => ({
  beats,
  timeout,
  big: false,
});
const wBig = (beats: WaveBeat[], timeout: number = WAVE.defaultTimeout): Wave => ({
  beats,
  timeout,
  big: true,
});

// --- Blocked cells ----------------------------------------------------------

/**
 * Furniture, as cell indices.
 *
 * Written with these helpers rather than as literal index lists so a layout is
 * readable as a shape. `rect(1, 2, 3, 4)` is a toy chest; `[12, 13, 21, 22]` is
 * a bug waiting to happen the first time COL_COUNT changes.
 */
const rect = (lane0: number, lane1: number, col0: number, col1: number): number[] => {
  const out: number[] = [];
  for (let lane = lane0; lane <= lane1; lane++) {
    for (let col = col0; col <= col1; col++) out.push(cellIndex(lane, col));
  }
  return out;
};
const laneOff = (lane: number): number[] => rect(lane, lane, 0, COL_COUNT - 1);
const colOff = (col: number): number[] => rect(0, LANE_COUNT - 1, col, col);
const cells = (...pairs: readonly [number, number][]): number[] =>
  pairs.map(([lane, col]) => cellIndex(lane, col));
const merge = (...groups: number[][]): number[] => [...new Set(groups.flat())];

// --- Levels -----------------------------------------------------------------

export interface Level {
  id: number;
  world: WorldId;
  name: string;
  /** The one thing this level exists to teach. Shown on the level-select card. */
  teaches: string;
  /** Toys this level hands over on completion. */
  unlocks: readonly ToyId[];
  /**
   * The five (or fewer) cards the game actually deals.
   *
   * Every fairness contract is computed against THIS, not against the full
   * roster. A guarantee about optimal play is a guarantee about nobody: the
   * question is whether the level is winnable with what a child was handed,
   * and on EASY this list is literally her loadout.
   */
  recommended: readonly ToyId[];
  blocked: readonly number[];
  /**
   * Cells that are paddling pool, as `lane * COL_COUNT + col`.
   *
   * Only meaningful in a `pool` world; a contract rejects water in a dry one
   * rather than silently ignoring it. Water is NOT blocked — a kid wades
   * through it exactly as she walks anywhere else. It restricts what YOU can
   * build, which is one rule rather than two, and it means the pool reads as an
   * obstacle for the player without needing a second set of swimming kids.
   */
  water?: readonly number[];
  /**
   * Stacks of boxes, as `lane * COL_COUNT + col`.
   *
   * Two things at once, and both are what a stack of boxes obviously does: you
   * cannot build there, and a shot fired FLAT down that row thuds into it. A
   * lobbed shot goes over.
   *
   * Kids walk past them, which is the one part that is a game rule rather than
   * common sense — they are squeezing between the boxes and the eaves. Making
   * boxes stop kids as well would just be a free Sand Castle in every level
   * that has one.
   *
   * This is the attic's second idea and it is what the Bath Toy Lobber is for.
   * Nothing outside the attic uses it, but it is on `Level` rather than on
   * `World` because which cells have boxes is a layout, exactly like `blocked`.
   */
  clutter?: readonly number[];
  startSparkles: number;
  waves: readonly Wave[];
}

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    world: 'bedroom',
    name: 'Nap Time',
    teaches: 'Tap a toy, then tap the floor.',
    unlocks: ['jar', 'wand'],
    recommended: ['jar', 'wand'],
    // Four lanes under the bunk bed and the toy chest. One lane, one enemy,
    // one job. To lose this you would have to place nothing at all for eighty
    // seconds, and a trial proves a single wand placed once wins on every tier.
    blocked: merge(laneOff(0), laneOff(1), laneOff(3), laneOff(4)),
    startSparkles: 100,
    waves: [
      w([k('crawler', 2)], 22),
      w([k('crawler', 2), k('crawler', 2, 6)], 22),
      w([k('crawler', 2), k('crawler', 2, 5), k('crawler', 2, 5)], 22),
      // Nine crawlers, not six. Six was gentle enough that a player who put
      // nothing down at all still WON — the lane's Guard Bear took the first
      // bunch and three hearts covered the rest. A first level should be almost
      // impossible to lose; "impossible to lose" is a cutscene, and a trial
      // that drives this level with no player at all is what caught it.
      wBig([k('crawler', 2), k('crawler', 2, 4), k('crawler', 2, 4), k('crawler', 2, 6)], 24),
    ],
  },

  {
    id: 2,
    world: 'bedroom',
    name: 'Toddler Traffic',
    teaches: 'Kids come down more than one row.',
    unlocks: ['fort'],
    recommended: ['jar', 'wand', 'fort'],
    blocked: merge(laneOff(0), laneOff(4)),
    startSparkles: 100,
    waves: [
      w([k('crawler', 2), k('toddler', 1, 4)]),
      w([k('toddler', 3), k('crawler', 1, 3), k('toddler', 3, 5)]),
      w([k('toddler', 1), k('toddler', 3, 1), o(k('crawler', 2, 3))]),
      wBig([k('toddler', 1), k('toddler', 3, 0.5), k('crawler', 2, 3), o(k('toddler', 2, 5))]),
    ],
  },

  {
    id: 3,
    world: 'bedroom',
    name: 'First Runner',
    teaches: 'Some kids are fast. Slow them down.',
    unlocks: ['sprinkler'],
    recommended: ['jar', 'wand', 'fort', 'sprinkler'],
    // A long rug takes the back half of the two outer lanes: less depth to
    // build in exactly where a five-year-old is paying the least attention.
    blocked: merge(rect(0, 0, 5, 8), rect(4, 4, 5, 8)),
    startSparkles: 100,
    waves: [
      w([k('toddler', 2), k('crawler', 0, 3)]),
      // Alone, announced, and in the middle lane. The first Runner should be a
      // thing you watch happen, not a thing you find out about afterwards.
      wBig([k('runner', 2, 3.5)]),
      w([k('toddler', 1), k('toddler', 3, 1), o(k('runner', 4, 4))]),
      w([k('runner', 0), k('runner', 4, 2), k('toddler', 2, 3)]),
      wBig([
        k('toddler', 0),
        k('toddler', 4, 0.5),
        k('runner', 2, 3),
        k('crawler', 1, 2),
        o(k('runner', 3, 4)),
      ]),
    ],
  },

  {
    id: 4,
    world: 'bedroom',
    name: 'Raincoats',
    teaches: 'The yellow coat laughs at water.',
    unlocks: ['watergun'],
    recommended: ['jar', 'wand', 'fort', 'watergun', 'sprinkler'],
    // A bath mat down the middle of every lane. No lane can be defended in
    // depth through the centre, so the new Water Gun has to commit to a side.
    blocked: colOff(4),
    startSparkles: 100,
    waves: [
      // Two waves of toddlers first, so the Water Gun feels excellent before
      // the level takes it away. The lesson has to be a discovery.
      w([k('toddler', 1), k('toddler', 3, 3)]),
      w([k('toddler', 2), k('crawler', 0, 2), o(k('toddler', 4, 4))]),
      // In lane 4, deliberately far from wherever the water went.
      wBig([k('raincoat', 4)]),
      w([k('raincoat', 1), k('toddler', 3, 2), o(k('raincoat', 2, 4))]),
      wBig([
        k('raincoat', 0),
        k('raincoat', 4, 1),
        k('toddler', 2, 2),
        o(k('toddler', 1, 3)),
        o(k('toddler', 3, 3)),
      ]),
    ],
  },

  {
    id: 5,
    world: 'bedroom',
    name: 'Lights Out',
    teaches: 'Some kids hide. Light them up.',
    unlocks: ['nightlight'],
    recommended: ['jar', 'wand', 'watergun', 'sprinkler', 'nightlight'],
    // Deliberately a clear floor. The lesson here is a mechanic, and stacking a
    // geometry puzzle on top of it is how you get a level that teaches neither.
    blocked: [],
    startSparkles: 125,
    waves: [
      w([k('toddler', 2), k('runner', 0, 4)]),
      wBig([k('blanket', 3)]),
      w([k('blanket', 1), k('toddler', 4, 3), o(k('runner', 2, 4))]),
      w([k('runner', 0), k('runner', 4, 1), k('blanket', 2, 3)]),
      wBig([
        k('blanket', 0),
        k('blanket', 4, 1),
        k('runner', 2, 2),
        k('toddler', 1, 3),
        o(k('blanket', 3, 4)),
      ]),
    ],
  },

  {
    id: 6,
    world: 'bedroom',
    name: 'Slip and Slide',
    teaches: 'Balloons float over your bubbles.',
    unlocks: ['slime'],
    recommended: ['jar', 'wand', 'sprinkler', 'slime', 'nightlight'],
    // A train-track rug on the diagonal. Every lane loses a different column,
    // so the build that worked one row up doesn't fit one row down.
    blocked: cells([0, 2], [1, 3], [2, 4], [3, 5], [4, 6]),
    startSparkles: 125,
    waves: [
      w([k('toddler', 1), k('runner', 3, 3)]),
      wBig([k('balloon', 2)]),
      w([k('balloon', 0), k('raincoat', 4, 3), o(k('runner', 2, 4))]),
      w([k('runner', 1), k('runner', 3, 1), k('balloon', 2, 3), o(k('raincoat', 0, 4))]),
      wBig([
        k('balloon', 0),
        k('balloon', 4, 1),
        k('raincoat', 2, 2),
        k('runner', 1, 2),
        o(k('balloon', 3, 4)),
        o(k('toddler', 3, 2)),
      ]),
    ],
  },

  {
    id: 7,
    world: 'bedroom',
    name: 'Big Coats',
    teaches: 'A wall buys the time your gun needs.',
    unlocks: ['powder'],
    // The Bubble Wand stays in the deck here on purpose: every other damage
    // toy in this loadout is water, and the Raincoat Kid is in three of the
    // five waves. A level whose only answer to a returning kid is a
    // thirty-second instant is a level that punishes you for the timer.
    recommended: ['jar', 'wand', 'watergun', 'fort', 'powder'],
    // The toy chest: a 2x2 hole in the middle of the board.
    blocked: rect(1, 2, 3, 4),
    startSparkles: 150,
    waves: [
      w([k('toddler', 2), k('runner', 0, 3)]),
      wBig([k('puffy', 2)]),
      w([k('puffy', 0), k('toddler', 4, 3), o(k('raincoat', 3, 4))]),
      w([k('raincoat', 1), k('runner', 3, 1), k('puffy', 4, 3)]),
      wBig([
        k('puffy', 0),
        k('puffy', 4, 2),
        k('toddler', 2, 2),
        k('raincoat', 1, 2),
        o(k('runner', 3, 3)),
        o(k('toddler', 3, 3)),
      ]),
    ],
  },

  {
    id: 8,
    world: 'bedroom',
    name: 'Sparkle Rush',
    teaches: 'When cells run out, build sparkles faster.',
    unlocks: ['fountain'],
    recommended: ['jar', 'wand', 'fountain', 'watergun', 'sprinkler'],
    // Three columns gone from every lane. Six cells of depth instead of nine is
    // what makes the Fountain's terrible rate-per-sparkle stop mattering — the
    // layout IS the lesson. Sticky Slime is deliberately absent: the Sock
    // Slider introduced here slides straight over it.
    blocked: merge(colOff(6), colOff(7), colOff(8)),
    startSparkles: 150,
    waves: [
      w([k('toddler', 1), k('runner', 3, 3)]),
      wBig([k('slider', 2)]),
      w([k('slider', 0), k('blanket', 4, 3), o(k('runner', 2, 3))]),
      w([k('puffy', 2), k('slider', 0, 2), k('slider', 4, 1), o(k('blanket', 1, 4))]),
      wBig([
        k('slider', 0),
        k('slider', 2, 1),
        k('slider', 4, 1),
        k('puffy', 1, 3),
        k('blanket', 3, 2),
        o(k('runner', 2, 4)),
        o(k('toddler', 0, 3)),
      ]),
    ],
  },

  {
    id: 9,
    world: 'bedroom',
    name: 'Everything At Once',
    teaches: 'One machine covers three rows.',
    unlocks: ['machine'],
    recommended: ['jar', 'wand', 'machine', 'watergun', 'sprinkler'],
    // Two staggered rugs leave the middle lane as the only one with full depth,
    // so the geometry hands you the Bubble Machine's spot rather than the tips
    // screen having to.
    blocked: merge(rect(0, 1, 2, 3), rect(3, 4, 5, 6)),
    // 200, not 150. This is the first level that expects a Bubble Machine at
    // 250 and it has eight fewer cells than any other, so the opening hand has
    // to cover a producer plus something that shoots plus the start of saving
    // up. The trial suite lost this level on HARD at 150 and wins it at 200.
    startSparkles: 200,
    waves: [
      w([k('toddler', 1), k('runner', 3, 2), k('crawler', 0, 3)]),
      wBig([k('wagon', 2)]),
      w([k('raincoat', 0), k('balloon', 4, 2), k('wagon', 1, 3), o(k('blanket', 3, 4))]),
      w([
        k('slider', 2),
        k('puffy', 0, 2),
        k('blanket', 4, 2),
        o(k('runner', 1, 3)),
        o(k('balloon', 3, 3)),
      ]),
      // Stretched from 17 seconds of arrivals to 24. Eight kids including two
      // Wagon Kids is the right SHAPE for the level before the boss; eight of
      // them inside seventeen seconds on HARD is just a wall.
      wBig([
        k('wagon', 0),
        k('wagon', 4, 2),
        k('puffy', 2, 3),
        k('balloon', 1, 3),
        k('slider', 3, 3),
        k('raincoat', 2, 4),
        o(k('blanket', 0, 5)),
        o(k('runner', 4, 4)),
      ]),
    ],
  },

  {
    id: 10,
    world: 'bedroom',
    name: 'The Big Kid',
    teaches: 'Everything you know, at once.',
    // Clearing the bedroom is what gets you outside, and the Duck Ring comes
    // with the change of scene rather than being handed out in the backyard's
    // own first level — the pool is unusable without it, and a level that opens
    // with a locked prerequisite reads as broken.
    unlocks: ['ring'],
    recommended: ['jar', 'wand', 'watergun', 'sprinkler', 'machine'],
    // The boss's lane has its back two columns gone, so he can't be intercepted
    // at the door and has to be fought with guns stacked behind him.
    blocked: rect(2, 2, 7, 8),
    startSparkles: 175,
    waves: [
      w([k('toddler', 1), k('runner', 3, 2), k('raincoat', 0, 3)]),
      w([k('blanket', 2), k('balloon', 4, 2), k('slider', 0, 3), o(k('runner', 1, 3))]),
      wBig([k('puffy', 1), k('puffy', 3, 1), k('wagon', 2, 3), o(k('raincoat', 0, 3)), o(k('balloon', 4, 3))]),
      w([k('slider', 0), k('slider', 4, 1), k('blanket', 2, 2), k('balloon', 1, 2), o(k('wagon', 3, 4))]),
      // No new verb. A boss that needs an input the campaign never taught turns
      // everything before it into a tutorial for one encounter.
      wBig(
        [
          k('bigkid', 2),
          k('toddler', 0, 4),
          k('toddler', 4, 4),
          k('runner', 1, 3),
          k('runner', 3, 3),
          o(k('puffy', 0, 5)),
          o(k('puffy', 4, 5)),
        ],
        60,
      ),
    ],
  },
  // --- World 2: The Backyard --------------------------------------------------
  //
  // The terrain rule is the paddling pool: a water cell holds nothing until a
  // Duck Ring floats on it. That is the whole world, and it is deliberately ONE
  // rule — the bedroom's ten levels taught a vocabulary of toys, and a second
  // area that also changed the toys would be a sequel rather than a new place.
  // What changes is where you are allowed to stand, which invalidates the build
  // that worked indoors without invalidating anything she learned.
  {
    id: 11,
    world: 'backyard',
    name: 'Splash Time',
    teaches: 'Put a ring on the water, then build on the ring.',
    unlocks: ['castle'],
    recommended: ['jar', 'wand', 'ring', 'fort', 'watergun', 'sprinkler'],
    blocked: [],
    // One puddle, in the middle lane, well forward. Small enough to walk round
    // and obvious enough to experiment with: the lesson is the ring, and a
    // first pool that split the board would teach panic instead.
    water: rect(2, 2, 4, 6),
    startSparkles: 175,
    waves: [
      w([k('toddler', 2)], 24),
      w([k('toddler', 1), k('crawler', 2, 3)], 24),
      w([k('toddler', 2), k('toddler', 3, 3), o(k('crawler', 1, 3))], 24),
      wBig([k('toddler', 0), k('toddler', 2, 2), k('toddler', 4, 2), k('crawler', 2, 4), o(k('runner', 3, 3))], 26),
    ],
  },
  {
    id: 12,
    world: 'backyard',
    name: 'Two Puddles',
    teaches: 'Two wet rows. Rings cost cells, not just sparkles.',
    unlocks: ['slushie'],
    recommended: ['jar', 'wand', 'ring', 'powder', 'sprinkler', 'watergun'],
    blocked: [],
    water: merge(rect(1, 1, 3, 7), rect(3, 3, 3, 7)),
    startSparkles: 200,
    waves: [
      w([k('toddler', 1), k('runner', 3, 3)]),
      w([k('runner', 1), k('toddler', 3, 2), k('crawler', 2, 3), o(k('runner', 0, 3))]),
      w([k('runner', 1), k('runner', 3, 1), k('toddler', 2, 3), o(k('toddler', 4, 3))]),
      wBig([k('runner', 1), k('runner', 3, 1), k('raincoat', 2, 3), k('toddler', 0, 3), o(k('runner', 4, 3))]),
    ],
  },
  {
    id: 13,
    world: 'backyard',
    name: 'The Deep End',
    teaches: 'Raincoats love the pool. Bubbles still work.',
    unlocks: [],
    recommended: ['jar', 'wand', 'ring', 'machine', 'fort', 'watergun'],
    blocked: [],
    // The right half of three lanes. You cannot meet these kids at the far end
    // without paying for rings first, so the fight happens closer to home.
    water: rect(1, 3, 5, 8),
    startSparkles: 200,
    waves: [
      w([k('raincoat', 2), k('toddler', 0, 3)]),
      w([k('raincoat', 1), k('raincoat', 3, 2), o(k('runner', 2, 3))]),
      w([k('raincoat', 2), k('toddler', 4, 2), k('runner', 0, 2), o(k('raincoat', 1, 3))]),
      wBig([k('raincoat', 1), k('raincoat', 2, 1), k('raincoat', 3, 1), k('runner', 0, 3), o(k('toddler', 4, 3))]),
    ],
  },
  {
    id: 14,
    world: 'backyard',
    name: 'Pool Party',
    teaches: 'Only the edges are dry.',
    unlocks: ['beachball'],
    recommended: ['jar', 'ring', 'sprinkler', 'machine', 'powder', 'watergun'],
    blocked: [],
    // Three whole lanes of water. The two dry lanes are the outer ones, so the
    // cheap build is a wall of rings across the middle or a decision to give
    // the middle up and hold the edges — which is the first time this game has
    // asked whether a lane is worth defending at all.
    water: merge(rect(1, 3, 1, 8)),
    startSparkles: 250,
    waves: [
      w([k('toddler', 0), k('toddler', 4, 2), k('runner', 2, 3)]),
      w([k('balloon', 2), k('runner', 0, 2), k('runner', 4, 2), o(k('toddler', 1, 3))]),
      w([k('balloon', 1), k('balloon', 3, 2), k('raincoat', 2, 3), o(k('runner', 0, 3))]),
      wBig([k('puffy', 0), k('puffy', 4, 1), k('balloon', 2, 2), k('runner', 1, 3), o(k('runner', 3, 3))]),
    ],
  },
  {
    id: 15,
    world: 'backyard',
    name: 'Sock Soup',
    teaches: 'She slides over slime. She does not slide over a wall.',
    unlocks: [],
    recommended: ['jar', 'ring', 'castle', 'watergun', 'machine', 'slushie'],
    // A patio table in the corner, and the pool wrapped round it.
    blocked: rect(0, 1, 6, 7),
    water: merge(rect(2, 4, 2, 5), rect(3, 3, 6, 8)),
    startSparkles: 250,
    waves: [
      w([k('slider', 3), k('toddler', 0, 3)]),
      w([k('slider', 2), k('slider', 4, 2), k('wagon', 3, 3), o(k('runner', 1, 3))]),
      w([k('wagon', 2), k('slider', 0, 2), k('puffy', 4, 2), o(k('slider', 3, 3))]),
      wBig([k('slider', 2), k('slider', 3, 1), k('slider', 4, 1), k('wagon', 0, 3), k('puffy', 1, 3), o(k('bigkid', 3, 5))], 30),
    ],
  },

  {
    id: 16,
    world: 'backyard',
    name: 'Cold Feet',
    teaches: 'A slushie makes them slow, and slow is as good as far away.',
    unlocks: [],
    recommended: ['jar', 'ring', 'slushie', 'wand', 'fort', 'watergun'],
    blocked: [],
    // Two narrow channels. The lanes are long, which is what makes a slow
    // worth more than damage here: a chilled kid spends the whole lane chilled.
    water: merge(rect(0, 0, 2, 6), rect(4, 4, 2, 6)),
    startSparkles: 250,
    waves: [
      w([k('runner', 0), k('runner', 4, 2)]),
      w([k('slider', 2), k('runner', 0, 2), k('runner', 4, 2), o(k('toddler', 1, 3))]),
      w([k('slider', 0), k('slider', 4, 2), k('puffy', 2, 3), o(k('runner', 3, 3))]),
      wBig([k('slider', 0), k('slider', 2, 1), k('slider', 4, 1), k('puffy', 1, 3), k('runner', 3, 3)], 28),
    ],
  },
  {
    id: 17,
    world: 'backyard',
    name: 'Queue Here',
    teaches: 'One wall, one beach ball, and a line of kids behind it.',
    unlocks: [],
    recommended: ['jar', 'ring', 'castle', 'beachball', 'watergun', 'machine'],
    blocked: [],
    // Only one dry column to build a wall on in the middle lanes, which is what
    // forces the queue the Beach Ball exists to punish.
    water: merge(rect(1, 3, 2, 4), rect(1, 3, 6, 8)),
    startSparkles: 275,
    waves: [
      w([k('toddler', 2), k('toddler', 2, 2), k('toddler', 2, 2)]),
      w([k('puffy', 2), k('toddler', 1, 2), k('toddler', 1, 2), o(k('toddler', 3, 3))]),
      w([k('wagon', 2), k('toddler', 2, 2), k('toddler', 2, 2), k('runner', 0, 3), o(k('runner', 4, 3))]),
      wBig([k('puffy', 1), k('puffy', 2, 1), k('puffy', 3, 1), k('toddler', 2, 3), k('toddler', 2, 2), o(k('wagon', 0, 4))], 30),
    ],
  },
  {
    id: 18,
    world: 'backyard',
    name: 'Sprinkler Season',
    teaches: 'Balloons, over a pool you cannot build in.',
    unlocks: [],
    recommended: ['jar', 'ring', 'sprinkler', 'machine', 'wand', 'watergun'],
    blocked: rect(2, 2, 7, 8),
    water: merge(rect(0, 4, 4, 6)),
    startSparkles: 275,
    waves: [
      w([k('balloon', 1), k('balloon', 3, 2)]),
      w([k('balloon', 0), k('balloon', 2, 1), k('balloon', 4, 1), o(k('runner', 1, 3))]),
      w([k('balloon', 1), k('balloon', 3, 1), k('raincoat', 2, 3), k('slider', 0, 2), o(k('balloon', 4, 3))]),
      wBig([k('balloon', 0), k('balloon', 1, 1), k('balloon', 3, 1), k('balloon', 4, 1), k('puffy', 2, 3), o(k('balloon', 2, 4))], 30),
    ],
  },
  {
    id: 19,
    world: 'backyard',
    name: 'Everything Is Wet',
    teaches: 'Rings everywhere. Choose which rows you can afford.',
    unlocks: [],
    recommended: ['jar', 'ring', 'watergun', 'sprinkler', 'machine', 'wand'],
    blocked: [],
    // Every column from 2 outward, in every lane. You cannot open the whole
    // board; the level is the question of which two rows you give up.
    water: rect(0, 4, 2, 8),
    startSparkles: 325,
    waves: [
      w([k('toddler', 0), k('toddler', 4, 2), k('runner', 2, 3)]),
      w([k('raincoat', 1), k('raincoat', 3, 2), k('slider', 2, 3), o(k('runner', 0, 3))]),
      w([k('wagon', 2), k('puffy', 0, 2), k('puffy', 4, 2), k('balloon', 1, 3), o(k('blanket', 3, 3))]),
      wBig([k('wagon', 1), k('wagon', 3, 2), k('puffy', 2, 2), k('slider', 0, 3), k('slider', 4, 1), o(k('balloon', 2, 4))], 32),
    ],
  },
  {
    id: 20,
    world: 'backyard',
    name: 'The Big Kid Outdoors',
    teaches: 'Everything the backyard taught, in one go.',
    // Same reasoning as the Duck Ring at the end of the bedroom: the bathroom
    // is played half-blind without a Fan, and a world that opens with its own
    // answer still locked reads as broken rather than as hard.
    unlocks: ['fan'],
    recommended: ['jar', 'ring', 'sprinkler', 'machine', 'watergun', 'wand'],
    // His lane is dry all the way, so he cannot be held at a ring — he has to
    // be fought, and the pool is what stops you reinforcing round him.
    blocked: [],
    water: merge(rect(0, 1, 3, 8), rect(3, 4, 3, 8)),
    startSparkles: 350,
    waves: [
      w([k('toddler', 2), k('runner', 0, 2), k('runner', 4, 2)]),
      w([k('raincoat', 1), k('balloon', 3, 2), k('slider', 2, 3), o(k('puffy', 0, 3))]),
      wBig([k('puffy', 1), k('puffy', 3, 1), k('wagon', 2, 3), o(k('balloon', 0, 3)), o(k('slider', 4, 3))], 30),
      w([k('slider', 0), k('slider', 4, 1), k('blanket', 2, 2), k('balloon', 1, 2), o(k('wagon', 3, 4))]),
      wBig(
        [
          k('bigkid', 2),
          k('puffy', 1, 4),
          k('puffy', 3, 4),
          k('slider', 0, 3),
          k('slider', 4, 2),
          o(k('wagon', 2, 5)),
          o(k('balloon', 1, 3)),
        ],
        36,
      ),
    ],
  },

  // --- World 3: Bath Time -----------------------------------------------------
  //
  // The terrain rule is steam: from column five rightward you can see that
  // somebody is coming but not who, until a Little Fan clears that row.
  //
  // Deliberately a SIGHT rule and nothing else. Nothing about the kids changes
  // — they walk the same, take the same damage, can be shot the same. What you
  // lose is the ability to pre-build the right answer, which is the whole of
  // the lesson and none of the cruelty of hiding them outright.
  {
    id: 21,
    world: 'bathroom',
    name: 'Steamy',
    teaches: 'A fan blows the steam out of its own row.',
    unlocks: [],
    recommended: ['jar', 'fan', 'wand', 'watergun', 'fort', 'sprinkler', 'machine'],
    blocked: [],
    startSparkles: 225,
    waves: [
      w([k('toddler', 2)], 24),
      w([k('toddler', 1), k('toddler', 3, 3)], 24),
      w([k('runner', 2), k('toddler', 0, 3), o(k('toddler', 4, 3))]),
      wBig([k('toddler', 0), k('runner', 2, 2), k('toddler', 4, 2), k('runner', 1, 3), o(k('toddler', 3, 3))]),
    ],
  },
  {
    id: 22,
    world: 'bathroom',
    name: 'Who Is That?',
    // Two lessons in one level, which is usually a mistake and is not one here:
    // the fog means you cannot tell a Raincoat Kid from a Toddler until she is
    // close, and the answer to a Raincoat Kid is bubbles. A toy that makes your
    // bubbles twice the size is therefore the answer to NOT KNOWING — build for
    // the worst case and it is still efficient against the ordinary one.
    teaches: 'Send your bubbles through the bath and they come out huge.',
    unlocks: ['soap'],
    // The Pillow Fort makes way. Its job here was buying a wand time, and the
    // bath does the same job by making the wand need less of it.
    recommended: ['jar', 'fan', 'wand', 'machine', 'soap', 'sprinkler', 'watergun'],
    blocked: [],
    startSparkles: 250,
    waves: [
      w([k('raincoat', 2), k('toddler', 0, 3)]),
      w([k('raincoat', 1), k('toddler', 3, 2), k('raincoat', 4, 2)]),
      w([k('toddler', 0), k('raincoat', 2, 2), k('toddler', 4, 2), o(k('raincoat', 1, 3))]),
      wBig([k('raincoat', 0), k('raincoat', 2, 1), k('raincoat', 4, 1), k('toddler', 1, 3), o(k('runner', 3, 3))]),
    ],
  },
  {
    id: 23,
    world: 'bathroom',
    name: 'Slippery Tiles',
    // The Sock Slider is the one kid you cannot slow down — she slides over
    // slime and the Slushie's chill does nothing. So this level answers the
    // question a different way: if you cannot make her take longer, make her
    // arrive somewhere you were ready for.
    teaches: 'You cannot slow her down. You can steer her into the middle.',
    unlocks: ['squeak'],
    recommended: ['jar', 'fan', 'watergun', 'slushie', 'castle', 'squeak', 'machine'],
    blocked: [],
    startSparkles: 250,
    waves: [
      w([k('slider', 2), k('toddler', 0, 3)]),
      w([k('slider', 1), k('slider', 3, 2), o(k('runner', 2, 3))]),
      w([k('slider', 0), k('slider', 2, 1), k('slider', 4, 1), o(k('puffy', 3, 4))]),
      wBig([k('slider', 1), k('slider', 2, 1), k('slider', 3, 1), k('puffy', 0, 3), k('runner', 4, 2)], 28),
    ],
  },
  {
    id: 24,
    world: 'bathroom',
    name: 'Bubbles Everywhere',
    teaches: 'Fans cost cells too. Choose which rows you can see.',
    unlocks: [],
    recommended: ['jar', 'fan', 'machine', 'sprinkler', 'watergun', 'wand'],
    // A bath mat down the middle of the board: fewer cells, so a Fan in every
    // lane is no longer affordable in space even when it is in sparkles.
    blocked: colOff(4),
    startSparkles: 275,
    waves: [
      w([k('balloon', 2), k('toddler', 0, 3)]),
      w([k('balloon', 1), k('balloon', 3, 2), k('runner', 2, 3)]),
      w([k('balloon', 0), k('runner', 2, 2), k('balloon', 4, 2), o(k('runner', 1, 3))]),
      wBig([k('balloon', 1), k('balloon', 3, 1), k('runner', 2, 2), k('puffy', 0, 3), o(k('balloon', 4, 3))]),
    ],
  },
  {
    id: 25,
    world: 'bathroom',
    name: 'Under the Towel',
    teaches: 'Hidden under a blanket AND hidden in the steam.',
    unlocks: [],
    recommended: ['jar', 'fan', 'sprinkler', 'machine', 'watergun', 'wand', 'fort'],
    blocked: [],
    startSparkles: 275,
    waves: [
      w([k('blanket', 2), k('toddler', 0, 3)]),
      w([k('blanket', 1), k('blanket', 3, 2), o(k('runner', 2, 3))]),
      w([k('blanket', 0), k('blanket', 2, 2), k('runner', 4, 2), o(k('blanket', 1, 3))]),
      wBig([k('blanket', 1), k('blanket', 2, 1), k('blanket', 3, 1), k('puffy', 0, 3), o(k('balloon', 4, 3))], 28),
    ],
  },
  {
    id: 26,
    world: 'bathroom',
    name: 'Big Coats, No View',
    // The Wagon Kid's shield is 150 points that have to come off before any of
    // her 90 do, and in the fog you find out she is coming with about two
    // seconds to spare. The magnet turns that from a problem into a formality —
    // and does nothing whatever about the Puffy Coats beside her.
    teaches: 'The magnet pulls a shield right off, three rows around it.',
    unlocks: ['magnet'],
    recommended: ['jar', 'fan', 'watergun', 'magnet', 'powder', 'machine', 'sprinkler'],
    blocked: [],
    startSparkles: 300,
    waves: [
      w([k('puffy', 2), k('toddler', 0, 3)]),
      w([k('puffy', 1), k('puffy', 3, 2), o(k('runner', 2, 3))]),
      w([k('puffy', 0), k('wagon', 2, 3), k('puffy', 4, 2), o(k('slider', 1, 3))]),
      wBig([k('puffy', 1), k('puffy', 2, 1), k('puffy', 3, 1), k('wagon', 0, 3), o(k('wagon', 4, 3))], 30),
    ],
  },
  {
    id: 27,
    world: 'bathroom',
    name: 'Two Fans',
    teaches: 'Not every row is worth clearing.',
    unlocks: [],
    recommended: ['jar', 'fan', 'machine', 'sprinkler', 'watergun', 'wand', 'castle'],
    // Both outer lanes lose their back half, so a Fan there costs a fighting
    // cell rather than a spare one.
    blocked: merge(rect(0, 0, 6, 8), rect(4, 4, 6, 8)),
    startSparkles: 300,
    waves: [
      w([k('runner', 0), k('runner', 4, 2), k('toddler', 2, 3)]),
      w([k('raincoat', 1), k('slider', 3, 2), k('balloon', 2, 3), o(k('runner', 0, 3))]),
      w([k('wagon', 2), k('puffy', 1, 2), k('slider', 4, 2), o(k('blanket', 3, 3))]),
      wBig([k('puffy', 0), k('puffy', 4, 1), k('wagon', 2, 2), k('slider', 1, 3), o(k('balloon', 3, 3))], 30),
    ],
  },
  {
    id: 28,
    world: 'bathroom',
    name: 'Rush Hour',
    teaches: 'Everything at once, and half of it invisible.',
    unlocks: [],
    recommended: ['jar', 'fan', 'machine', 'watergun', 'sprinkler', 'wand', 'castle'],
    blocked: [],
    startSparkles: 375,
    waves: [
      w([k('runner', 1), k('runner', 3, 1), k('slider', 2, 3)]),
      w([k('balloon', 0), k('raincoat', 2, 2), k('slider', 4, 2), o(k('runner', 1, 3))]),
      w([k('blanket', 1), k('puffy', 3, 2), k('balloon', 2, 2), k('wagon', 0, 3), o(k('slider', 4, 3))]),
      wBig([k('puffy', 1), k('wagon', 2, 2), k('puffy', 3, 2), k('balloon', 0, 3), k('slider', 4, 2)], 30),
    ],
  },
  {
    id: 29,
    world: 'bathroom',
    name: 'Fogged In',
    teaches: 'The steam reaches further than usual.',
    unlocks: [],
    recommended: ['jar', 'fan', 'machine', 'sprinkler', 'watergun', 'wand'],
    // A shelf across the middle. With less room, a Fan in every lane is a real
    // sacrifice — which is the whole question this level asks.
    blocked: merge(rect(1, 3, 3, 3)),
    startSparkles: 400,
    waves: [
      w([k('wagon', 2), k('runner', 0, 2), k('runner', 4, 2)]),
      w([k('puffy', 1), k('balloon', 3, 2), k('slider', 2, 3), o(k('raincoat', 0, 3))]),
      wBig([k('wagon', 1), k('wagon', 3, 2), k('blanket', 2, 3), o(k('puffy', 0, 3)), o(k('balloon', 4, 3))], 30),
      w([k('slider', 0), k('slider', 4, 1), k('puffy', 2, 2), k('runner', 1, 2), o(k('wagon', 3, 4))]),
    ],
  },
  {
    id: 30,
    world: 'bathroom',
    name: 'The Big Kid In The Bath',
    teaches: 'The exam, in the steam.',
    // Same reasoning as the Duck Ring and the Little Fan before it: the attic
    // has no floor, so a player who arrives without a Shelf cannot put a single
    // toy down. A world that opens with its own prerequisite still locked does
    // not read as hard, it reads as broken.
    unlocks: ['shelf'],
    recommended: ['jar', 'fan', 'machine', 'watergun', 'sprinkler', 'wand', 'castle'],
    blocked: rect(2, 2, 7, 8),
    startSparkles: 375,
    waves: [
      w([k('toddler', 1), k('runner', 3, 2), k('slider', 0, 3)]),
      w([k('balloon', 2), k('blanket', 4, 2), k('raincoat', 1, 3), o(k('runner', 3, 3))]),
      wBig([k('puffy', 1), k('puffy', 3, 1), k('wagon', 0, 3), o(k('balloon', 2, 3)), o(k('slider', 4, 3))], 30),
      w([k('slider', 0), k('slider', 4, 1), k('blanket', 2, 2), k('balloon', 1, 2), o(k('wagon', 3, 4))]),
      wBig(
        [
          k('bigkid', 2),
          k('puffy', 1, 4),
          k('puffy', 3, 4),
          k('slider', 0, 3),
          k('slider', 4, 2),
          o(k('wagon', 2, 5)),
          o(k('balloon', 1, 3)),
        ],
        36,
      ),
    ],
  },

  // --- World 4: The Attic -----------------------------------------------------
  //
  // The terrain rule is that there is no floor. Bare joists, and EVERY cell
  // needs a Shelf before it holds anything.
  //
  // Deliberately the paddling pool's rule turned all the way up rather than a
  // fourth idea. The pool asked which three lanes were worth opening; the attic
  // asks that about all forty-five cells. Nothing she learned stops working —
  // she can simply afford half as many toys at a time, and every placement is
  // two taps and two prices. That is enough to invalidate every build in the
  // game without invalidating a single lesson.
  //
  // The second idea is stacks of boxes. You cannot build on one and a shot
  // fired flat thuds into it, so a row with boxes can only be held from in
  // front of them — unless you throw something over the top, which is the whole
  // job of the Bath Toy Lobber. Boxes sit in the middle columns, never at the
  // very back: a stack at column eight would cost nothing at all.
  {
    id: 31,
    world: 'attic',
    name: 'Mind the Gap',
    teaches: 'There is no floor up here. Lay a shelf down first.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'wand', 'fort', 'watergun', 'sprinkler'],
    // A clear board and slow kids. The lesson is one extra tap before every
    // toy, and stacking a layout puzzle on top of a new economy is how you get
    // a level that teaches neither.
    blocked: [],
    // Enough for a shelf and a jar, then a shelf and a wand, with change. The
    // opening hand has to survive the fact that everything here costs 25 more
    // than it says on the card.
    startSparkles: 275,
    // Kids arrive two to a row on purpose from wave three on. A Guard Bear
    // clears a whole row, so a level that spreads its kids one per lane is a
    // level five bears win on their own — level one learned that the hard way
    // and this is the same shape of level.
    waves: [
      w([k('crawler', 2)], 26),
      w([k('toddler', 1), k('crawler', 3, 3)], 26),
      w([k('toddler', 2), k('toddler', 2, 3), k('crawler', 2, 3), o(k('toddler', 1, 3))]),
      wBig(
        [k('toddler', 0), k('toddler', 0, 2), k('toddler', 4, 1), k('toddler', 4, 2), k('crawler', 2, 3), o(k('runner', 3, 3))],
        28,
      ),
      wBig(
        [
          k('toddler', 1),
          k('toddler', 1, 2),
          k('toddler', 3, 1),
          k('toddler', 3, 2),
          k('toddler', 2, 3),
          k('crawler', 0, 3),
          o(k('runner', 4, 3)),
        ],
        30,
      ),
    ],
  },
  {
    id: 32,
    world: 'attic',
    name: 'Boxes In The Way',
    teaches: 'Water guns thud into the boxes. Throw something over instead.',
    unlocks: ['lobber'],
    recommended: ['jar', 'shelf', 'lobber', 'wand', 'watergun', 'fort', 'sprinkler'],
    blocked: [],
    // One stack, in the middle three rows, halfway along. Shallow enough that
    // the outer two rows still play normally, so the difference between a row
    // with boxes and a row without is visible side by side on one screen.
    clutter: cells([1, 5], [2, 5], [3, 5]),
    startSparkles: 300,
    waves: [
      w([k('toddler', 2), k('crawler', 0, 3)], 26),
      w([k('toddler', 1), k('toddler', 3, 2), o(k('runner', 2, 3))]),
      w([k('runner', 2), k('toddler', 0, 2), k('toddler', 4, 2), o(k('crawler', 1, 3))]),
      wBig([k('toddler', 1), k('runner', 2, 2), k('toddler', 3, 2), k('runner', 0, 3), o(k('toddler', 4, 3))], 28),
    ],
  },
  {
    id: 33,
    world: 'attic',
    name: 'Between The Rafters',
    teaches: 'Raincoats up here too, and boxes in the way of your bubbles.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'lobber', 'wand', 'machine', 'watergun', 'fort', 'sprinkler'],
    // The chimney: a solid block you cannot build round.
    blocked: rect(1, 2, 6, 7),
    clutter: cells([0, 4], [3, 5], [4, 4]),
    startSparkles: 325,
    waves: [
      w([k('raincoat', 2), k('toddler', 0, 3)]),
      w([k('raincoat', 1), k('runner', 3, 2), o(k('raincoat', 4, 3))]),
      w([k('raincoat', 0), k('raincoat', 2, 2), k('runner', 4, 2), o(k('toddler', 3, 3))]),
      wBig([k('raincoat', 1), k('raincoat', 2, 1), k('raincoat', 3, 1), k('runner', 0, 3), o(k('runner', 4, 3))], 30),
    ],
  },
  {
    id: 34,
    world: 'attic',
    name: 'Up In The Eaves',
    teaches: 'Balloons float over the boxes. Your spray does not.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'sprinkler', 'machine', 'lobber', 'wand', 'powder', 'fort'],
    blocked: [],
    // Right at the back, and only in the two rows the balloons do NOT use.
    // Nothing that reaches a floating kid arcs, so boxes near the unicorn in a
    // balloon row would be a rule with no answer rather than a decision.
    clutter: cells([0, 6], [4, 6]),
    startSparkles: 350,
    waves: [
      w([k('balloon', 2), k('toddler', 0, 3)]),
      w([k('balloon', 1), k('balloon', 3, 2), k('runner', 2, 3)]),
      w([k('balloon', 2), k('runner', 0, 2), k('balloon', 3, 2), o(k('toddler', 4, 3))]),
      wBig([k('balloon', 1), k('balloon', 2, 1), k('balloon', 3, 1), k('runner', 4, 3), o(k('raincoat', 0, 3))], 30),
    ],
  },
  {
    id: 35,
    world: 'attic',
    name: 'Under The Dust Sheets',
    teaches: 'A shelf costs a cell. So does seeing what is under the sheet.',
    unlocks: [],
    // The Nightlight is the obvious card for a level about things you cannot
    // see and it is not here: at a 45-second recharge it comes up twice in a
    // 126-second level, and a panic button you can press twice is a cutscene.
    // The Powder Puff does the same job three times over.
    recommended: ['jar', 'shelf', 'sprinkler', 'machine', 'powder', 'lobber', 'watergun', 'wand'],
    blocked: [],
    clutter: cells([1, 5], [2, 6], [3, 5]),
    startSparkles: 450,
    waves: [
      w([k('blanket', 2), k('toddler', 0, 3)]),
      w([k('blanket', 1), k('blanket', 3, 2), o(k('runner', 2, 3))]),
      w([k('blanket', 0), k('blanket', 2, 2), k('runner', 4, 2), o(k('blanket', 1, 3))]),
      wBig([k('blanket', 1), k('blanket', 2, 1), k('blanket', 3, 1), k('puffy', 0, 3), o(k('balloon', 4, 3))], 30),
    ],
  },
  {
    id: 36,
    world: 'attic',
    name: 'Heavy Boxes',
    teaches: 'Tanks, behind a wall of boxes. Only the lobber reaches them.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'lobber', 'watergun', 'castle', 'powder', 'machine', 'sprinkler'],
    blocked: [],
    // The deepest boxes in the world, in four rows out of five. A flat gun
    // holds a third of the board here, and the one clear row is the reward for
    // noticing there is one.
    clutter: merge(cells([0, 6], [1, 6], [3, 6], [4, 6]), cells([0, 5], [4, 5])),
    startSparkles: 400,
    waves: [
      w([k('puffy', 2), k('toddler', 0, 3)]),
      w([k('puffy', 1), k('puffy', 3, 2), o(k('runner', 2, 3))]),
      w([k('puffy', 0), k('puffy', 4, 2), k('runner', 2, 3), o(k('raincoat', 1, 3))]),
      wBig([k('puffy', 1), k('puffy', 2, 1), k('puffy', 3, 1), k('toddler', 0, 3), o(k('puffy', 4, 4))], 32),
    ],
  },
  {
    id: 37,
    world: 'attic',
    name: 'Sliding On Boards',
    teaches: 'She is fast, and the boxes give you less room to stop her.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'slushie', 'watergun', 'lobber', 'castle', 'machine', 'squeak'],
    blocked: [],
    clutter: cells([0, 5], [2, 5], [4, 5]),
    startSparkles: 400,
    waves: [
      w([k('slider', 2), k('toddler', 0, 3)]),
      w([k('slider', 1), k('slider', 3, 2), o(k('runner', 2, 3))]),
      w([k('slider', 0), k('slider', 2, 1), k('slider', 4, 1), o(k('puffy', 3, 4))]),
      wBig([k('slider', 1), k('slider', 2, 1), k('slider', 3, 1), k('puffy', 0, 3), k('runner', 4, 2)], 30),
    ],
  },
  {
    id: 38,
    world: 'attic',
    name: 'Wagons Upstairs',
    teaches: 'A magnet works through boxes. It does not care what is in the way.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'magnet', 'lobber', 'watergun', 'machine', 'castle', 'sprinkler'],
    // No furniture. The boxes already take five cells out of the middle three
    // rows, and in a world where every cell needs a shelf under it, adding a
    // chest of drawers on top of that was just removing the level.
    blocked: [],
    // All three stacks at column six. At five they capped a flat gun's reach at
    // five cells in the two rows the wagons use most, and this level's answer is
    // a 240-health tank you have to out-damage.
    clutter: cells([1, 6], [2, 6], [3, 6]),
    startSparkles: 775,
    // Three Wagon Kids, down from six.
    //
    // Each is 240 points of health before anything else, and in the attic every
    // gun aimed at one is standing on a shelf. Six was the level quietly
    // trusting the player to build the magnet — which a person will, because
    // the level is about it, and which neither bot ever does, because a magnet
    // deals no damage and both bots are built to ignore toys that cannot hurt
    // anything. That rule is worth more than this level's density, so the level
    // gave way. At four it flipped between passing and failing on fifty
    // sparkles either way, which is a level tuned to a knife edge rather than a
    // level that works; three has room in it.
    waves: [
      // No Wagon Kid in wave one. She is 240 points of health arriving before
      // anything is built, and losing here was costing three hearts inside the
      // first fifty seconds — on NORMAL, where the bot is deliberately mediocre.
      // Every other level in the game introduces its headline kid in wave two.
      w([k('toddler', 2), k('runner', 0, 3)], 26),
      w([k('wagon', 1), k('toddler', 3, 3), o(k('slider', 2, 3))]),
      w([k('toddler', 0), k('runner', 2, 4), k('wagon', 4, 3), o(k('balloon', 1, 4))]),
      // One wagon in the last wave, not two. Five of them across four waves was
      // the level trusting the magnet to be built, and neither bot builds a toy
      // that deals no damage — a rule worth keeping, so the level gives instead.
      wBig([k('wagon', 2), k('puffy', 0, 4), k('runner', 4, 4)], 38),
    ],
  },
  {
    id: 39,
    world: 'attic',
    name: 'Everything Upstairs',
    teaches: 'Every kid in the house, and a shelf under every toy.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'lobber', 'machine', 'sprinkler', 'watergun', 'powder', 'castle'],
    blocked: merge(rect(0, 0, 7, 8), rect(4, 4, 7, 8)),
    // Boxes at column four are the worst place on the board for them — a flat
    // gun at the back then covers a third of its row — and stacking that on the
    // densest wave list in the world made this the level that fell over first
    // once bare shelves stopped being free walls. Pushed back a column each.
    clutter: cells([1, 5], [2, 6], [3, 5]),
    startSparkles: 675,
    waves: [
      w([k('runner', 1), k('slider', 2, 3), o(k('runner', 3, 2))]),
      w([k('raincoat', 0), k('balloon', 2, 3), k('wagon', 4, 3), o(k('blanket', 1, 4))]),
      wBig([k('puffy', 1), k('wagon', 2, 4), o(k('balloon', 0, 4))], 38),
      w([k('slider', 0), k('slider', 4, 2), k('blanket', 2, 3), o(k('balloon', 1, 3))], 34),
    ],
  },
  {
    id: 40,
    world: 'attic',
    name: 'The Big Kid In The Attic',
    teaches: 'The exam, with no floor under it.',
    unlocks: [],
    recommended: ['jar', 'shelf', 'lobber', 'machine', 'watergun', 'sprinkler', 'powder', 'castle'],
    // His row is clear of boxes, so he cannot be held behind one — he has to be
    // fought, and every shelf you lay to fight him is a shelf you did not lay
    // somewhere else.
    blocked: [],
    clutter: cells([0, 5], [1, 5], [3, 5], [4, 5]),
    // The largest opening hand in the game, and it has to be: this is the
    // bathroom's boss wave in a world where every toy is standing on 25
    // sparkles of shelf. Every number here has been set by the trials rather
    // than by feel: 475 lost NORMAL and HARD, 600 still lost HARD by one kid,
    // and 675 lost it again once the floor stopped fighting for you.
    startSparkles: 775,
    waves: [
      w([k('toddler', 1), k('runner', 3, 2), k('slider', 0, 3)]),
      w([k('balloon', 2), k('blanket', 4, 2), k('raincoat', 1, 3), o(k('runner', 3, 3))]),
      wBig([k('puffy', 1), k('puffy', 3, 1), k('wagon', 0, 3), o(k('balloon', 2, 3)), o(k('slider', 4, 3))], 30),
      w([k('slider', 0), k('slider', 4, 1), k('blanket', 2, 2), k('balloon', 1, 2), o(k('wagon', 3, 4))]),
      wBig(
        [
          k('bigkid', 2),
          k('puffy', 1, 7),
          k('slider', 0, 6),
          k('slider', 4, 5),
          o(k('puffy', 3, 6)),
        ],
        50,
      ),
    ],
  },

];

export const LEVEL_COUNT = LEVELS.length;

export function levelById(id: number): Level {
  const level = LEVELS[id - 1];
  if (!level) throw new Error(`no level ${id}`);
  return level;
}

/** Every kid kind that appears in a level, optional beats included. */
export function enemiesIn(level: Level): EnemyKind[] {
  const kinds = new Set<EnemyKind>();
  for (const wave of level.waves) for (const beat of wave.beats) kinds.add(beat.kind);
  return [...kinds];
}

/** The first level a kid kind appears in, or 0 if it never does. */
export function firstAppearance(kind: EnemyKind): number {
  for (const level of LEVELS) {
    if (enemiesIn(level).includes(kind)) return level.id;
  }
  return 0;
}

/**
 * Every toy available while playing a level, in tray order.
 *
 * INCLUSIVE of this level's own unlocks. A level's `unlocks` is the toy it
 * TEACHES, so it has to be in your hand while you play it — level two is
 * called "the Pillow Fort level" and handing you the fort only after you have
 * already beaten it is exactly backwards.
 *
 * This read `level.id >= levelId` at first, which excluded the current level.
 * On EASY nobody noticed, because EASY is dealt `level.recommended` directly
 * and never consults this function. On NORMAL the loadout picker quietly
 * offered one fewer card than the level was designed around.
 */
export function unlockedBy(levelId: number): ToyId[] {
  const out: ToyId[] = [];
  for (const level of LEVELS) {
    if (level.id > levelId) break;
    out.push(...level.unlocks);
  }
  return out;
}

/** The most kids a level can have walking at once, for the pool-size contract. */
export function peakEnemies(level: Level): number {
  let peak = 0;
  for (const wave of level.waves) peak = Math.max(peak, wave.beats.length);
  // Two waves can overlap when the earlier one times out rather than clearing.
  return peak * 2;
}
