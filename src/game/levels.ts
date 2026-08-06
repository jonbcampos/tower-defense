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
export type WorldId = 'bedroom';

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
}

export const WORLDS: Record<WorldId, World> = {
  bedroom: { id: 'bedroom', name: 'The Bedroom', lanes: LANE_COUNT, trickleScale: 1 },
};

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
    unlocks: [],
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
