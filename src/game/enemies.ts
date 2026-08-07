/**
 * The kid roster.
 *
 * Same contract as `toys.ts`: a kid is one entry here, one painter in
 * `render/kids.ts`, and a mention in a level's waves. Nothing else.
 *
 * Nobody gets hurt in this game. A kid who runs out of health has been soaked
 * or bubbled or dazzled enough that whatever the toys are doing is more
 * interesting than the unicorn, and they wander off to play with it. The art
 * and the sound both have to sell that, because the verbs are the same ones a
 * violent game would use and the framing is the only thing that isn't.
 */

import { CROSS_DISTANCE, POOL, colAtX, spawnX } from './config';
import { TOYS, type DamageKind, type ToyId } from './toys';

export type EnemyKind =
  | 'crawler'
  | 'toddler'
  | 'runner'
  | 'raincoat'
  | 'blanket'
  | 'balloon'
  | 'puffy'
  | 'slider'
  | 'wagon'
  | 'bigkid';

/**
 * Behaviour that can't be expressed as a number.
 *
 * Deliberately a small closed union rather than a function on the def: a
 * function would make the roster a module of code instead of a table of data,
 * and the whole point of the table is that a level designer can read it.
 */
export type BehaviourId = 'throws';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  /** One line for the guide screen. See the note on `ToyDef.blurb`. */
  blurb: string;
  hp: number;
  /**
   * Seconds to walk the whole board unobstructed, at NORMAL.
   *
   * Seconds, not pixels per second, because seconds are what every fairness
   * contract is written in and what a play session is measured in. The px/s the
   * simulation actually uses is derived from `CROSS_DISTANCE`, so a change to
   * the board's width can never silently change how hard a level is.
   */
  crossSeconds: number;
  /** Damage per second dealt to the toy directly in front. */
  grabDps: number;
  /**
   * Sparkles the kid is worth.
   *
   * Big enough that surviving a wave pays for the answer to the next one.
   * Producers are still where the economy comes from — bounty is bursty and a
   * jar is steady — but a child who is only just holding on should be funded by
   * the holding on, not punished for having no spare cells for jars.
   */
  bounty: number;

  /** Shrugs this off entirely (subject to `difficulty.immunityLeak`). */
  immuneTo?: DamageKind;
  /** Takes this share of damage from a kind it merely dislikes. */
  resist?: { kind: DamageKind; share: number };
  /** A separate health bar that has to come off before the kid does. */
  shield?: number;

  /** Floats. Ground toys shoot underneath it and it never stops to grab. */
  aerial?: boolean;
  /** Can't be targeted by a single-lane shooter until something reveals it. */
  hidden?: boolean;
  /** Sticky Slime does nothing. She's wearing socks. */
  ignoresSlow?: boolean;

  behaviour?: BehaviourId;

  /** Drawn size, in px. Also the grab reach. */
  width: number;
  height: number;
  color: string;
  accent: string;

  /**
   * Skin and hair, per kid.
   *
   * These children are the whole cast of the game and a five-year-old should
   * see herself somewhere in it. They live here, next to `color` and `accent`,
   * rather than only in the art prompts, so that the variety survives with no
   * generated art at all — it must not depend on whether somebody ran a script
   * and had an API key. The prompts in `scripts/art-manifest.mjs` describe the
   * same children, and the two are meant to agree.
   */
  skin: string;
  hair: string;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  crawler: {
    kind: 'crawler',
    name: 'Crawler',
    blurb: 'The slowest one of all. Anything at all will turn her round.',
    // The slowest thing in the game by a wide margin. Level one is six of
    // these in one lane, and a single Bubble Wand lands nine times what it
    // takes to turn one around.
    hp: 20,
    crossSeconds: 35,
    grabDps: 6,
    bounty: 8,
    width: 22,
    height: 18,
    color: '#8fd9a8',
    accent: '#ffd166',
    skin: '#c98d5e',
    hair: '#3a2418',
  },

  toddler: {
    kind: 'toddler',
    name: 'Toddler',
    blurb: 'An ordinary kid. Bubbles are plenty.',
    // The baseline every other kid is described relative to.
    hp: 45,
    crossSeconds: 22,
    // Six seconds to chew through a Bubble Wand. That number is the reason
    // Pillow Fort exists and the reason it arrives on level two.
    grabDps: 13,
    bounty: 15,
    width: 20,
    height: 26,
    color: '#f2a65a',
    accent: '#ffe1b3',
    skin: '#c68642',
    hair: '#2e1b10',
  },

  runner: {
    kind: 'runner',
    name: 'Runner',
    blurb: 'Quick! Slow her down, or have two toys ready.',
    hp: 40,
    crossSeconds: 12,
    grabDps: 15,
    bounty: 18,
    width: 20,
    height: 26,
    color: '#ff6b8a',
    accent: '#fff0f4',
    skin: '#7a4a24',
    hair: '#241309',
  },

  raincoat: {
    kind: 'raincoat',
    name: 'Raincoat Kid',
    blurb: 'Water does nothing to her coat. Use bubbles instead.',
    hp: 60,
    crossSeconds: 20,
    grabDps: 14,
    bounty: 22,
    // The immunity is drawn, always: droplets visibly bounce off the hood. A
    // rule a child can only learn from a wiki is a rule that isn't in the game.
    immuneTo: 'water',
    width: 22,
    height: 28,
    color: '#ffd23f',
    accent: '#e0a800',
    skin: '#f2c396',
    hair: '#8a4b2a',
  },

  blanket: {
    kind: 'blanket',
    name: 'Blanket Kid',
    blurb: 'You cannot aim at her until she peeks out halfway.',
    hp: 70,
    crossSeconds: 18,
    grabDps: 14,
    bounty: 25,
    // Under a blanket, so a shooter aiming down the lane has nothing to aim at.
    // Anything that sprays, bursts or lights the room finds her anyway — which
    // is why the answer set is "area or instant" rather than "the Nightlight".
    hidden: true,
    width: 26,
    height: 28,
    color: '#a89bd6',
    accent: '#d9d0f5',
    skin: '#a8693c',
    hair: '#2b1a10',
  },

  balloon: {
    kind: 'balloon',
    name: 'Balloon Kid',
    blurb: 'She floats right over your toys. Spray her instead.',
    hp: 30,
    crossSeconds: 16,
    // Never stops. A kid who is floating is not going to pause to wrestle a
    // pillow fort, and a floating enemy that could still be walled would make
    // the whole twist decorative.
    grabDps: 0,
    bounty: 22,
    aerial: true,
    width: 20,
    height: 30,
    color: '#ff8fc7',
    accent: '#ffe14d',
    skin: '#e8b07a',
    hair: '#1f1610',
  },

  puffy: {
    kind: 'puffy',
    name: 'Puffy Coat',
    blurb: 'Very tough. A water gun, and a wall to slow her down.',
    // The tank. Two Water Guns at the back of a lane land comfortably more than
    // this even at HARD, so it is beatable with damage alone; the wall and the
    // Powder Puff are what make it comfortable rather than what make it possible.
    hp: 200,
    crossSeconds: 30,
    grabDps: 18,
    bounty: 45,
    width: 30,
    height: 30,
    color: '#7fb2e8',
    accent: '#d6e9ff',
    skin: '#5e3418',
    hair: '#1a0f08',
  },

  slider: {
    kind: 'slider',
    name: 'Sock Slider',
    blurb: 'The fastest, and she slides straight over slime.',
    // The fastest thing in the game. Crosses in seven seconds and slides
    // straight over Sticky Slime, which is why level eight — the level that
    // introduces her — deliberately doesn't hand you Slime.
    hp: 35,
    crossSeconds: 7.3,
    grabDps: 12,
    bounty: 25,
    ignoresSlow: true,
    width: 24,
    height: 22,
    color: '#ffffff',
    accent: '#ff6b8a',
    skin: '#f7d3b0',
    hair: '#c96a2e',
  },

  wagon: {
    kind: 'wagon',
    name: 'Wagon Kid',
    blurb: 'Her cardboard shield comes off first, then her.',
    hp: 90,
    shield: 150,
    crossSeconds: 20,
    grabDps: 16,
    bounty: 50,
    width: 34,
    height: 28,
    color: '#e05a3a',
    accent: '#ffd166',
    skin: '#c68642',
    hair: '#3a2012',
  },

  bigkid: {
    kind: 'bigkid',
    name: 'The Big Kid',
    blurb: 'Throws a stuffie at your toys, and shrugs off half of every bubble.',
    hp: 500,
    crossSeconds: 35,
    grabDps: 40,
    bounty: 200,
    // Half damage from bubbles, so the Bubble Machine unlocked one level
    // earlier is a strong answer rather than the whole answer. The exam should
    // test the course, not the last thing taught on it.
    resist: { kind: 'bubble', share: 0.5 },
    behaviour: 'throws',
    width: 44,
    height: 44,
    color: '#8f5cff',
    accent: '#ffd94d',
    skin: '#9b6136',
    hair: '#2a1a10',
  },
};

export const ENEMY_ORDER: readonly EnemyKind[] = [
  'crawler',
  'toddler',
  'runner',
  'raincoat',
  'blanket',
  'balloon',
  'puffy',
  'slider',
  'wagon',
  'bigkid',
];

/** Px per second, derived so the board's width can't change the difficulty. */
export function enemySpeed(kind: EnemyKind, speedScale: number): number {
  return (CROSS_DISTANCE * speedScale) / ENEMIES[kind].crossSeconds;
}

/**
 * Does this toy count as an *answer* to this kid?
 *
 * Derived rather than authored. A hand-written `ANSWERS` table is a second
 * source of truth that goes stale the first time someone changes an immunity
 * and forgets it exists — and the contract that every kid has two answers in
 * every level's loadout would then be checking the table rather than the game.
 *
 * A toy answers a kid when it can actually take health off it: it deals damage
 * at all, it can reach a floating kid if the kid floats, it isn't the one thing
 * the kid shrugs off, and it can find a kid who is hiding.
 */
export function isAnswer(toy: ToyId, kind: EnemyKind): boolean {
  const def = TOYS[toy];
  const enemy = ENEMIES[kind];
  const attack = def.shoot ?? def.instant;
  if (!attack) return false;
  if (enemy.aerial && !def.hitsAir) return false;
  if (enemy.immuneTo && enemy.immuneTo === attack.kind) return false;
  // Note what is NOT here: hiding. A Blanket Kid peeks out at the halfway
  // column whatever you own, so hiding costs an aimed shooter the first four
  // columns of a lane and nothing else. An earlier version treated hidden as a
  // hard immunity to anything single-lane, which made the Sprinkler the only
  // sustained answer in the game and turned every level with a blanket in it
  // into a 125-sparkle toll gate.
  return true;
}

export function answersIn(loadout: readonly ToyId[], kind: EnemyKind): ToyId[] {
  return loadout.filter((toy) => isAnswer(toy, kind));
}

/**
 * Sustained damage per second the best answer in a loadout lands on one kid.
 *
 * Instants are rated at `damage / recharge`, which is the honest way to compare
 * a 120-point burst every thirty seconds against a gun that never stops.
 */
export function bestAnswerDps(loadout: readonly ToyId[], kind: EnemyKind): number {
  let best = 0;
  for (const toy of answersIn(loadout, kind)) {
    const def = TOYS[toy];
    const rate = def.shoot
      ? def.shoot.damage / def.shoot.interval
      : (def.instant?.damage ?? 0) / Math.max(1, def.recharge);
    best = Math.max(best, rate);
  }
  return best;
}

// --- Live kids --------------------------------------------------------------

/** Statuses a kid can be under. Flat fields rather than a list: no allocation. */
export interface Enemy {
  kind: EnemyKind;
  lane: number;
  /** Centre x, in virtual px. Kids only ever move left. */
  x: number;
  prevX: number;
  hp: number;
  shield: number;
  /** Seconds of slow remaining, and the factor to apply while it lasts. */
  slowFor: number;
  slowFactor: number;
  /** A hidden kid stops being hidden once something reveals it. */
  concealed: boolean;
  /** Counts down between thrown stuffies, for `behaviour: 'throws'`. */
  actionTimer: number;
  /** Flash timer for the damage tint, and which kind last landed. */
  hurt: number;
  lastHit: DamageKind;
  /** Set while standing still to grab the toy in front. */
  grabbing: boolean;
  /**
   * Pixels a kid is drawn ABOVE or BELOW her row while she finishes changing
   * rows, decaying to zero. Presentation, but it lives here for the same reason
   * `hurt` does: the renderer is not allowed to hold per-kid state.
   *
   * A Squeaky Toy changes `lane` in one frame, and without this she teleports a
   * whole row. A five-year-old tracking one child across a board cannot follow
   * a jump — she reads it as "a different kid appeared", which is exactly the
   * wrong lesson from a toy whose whole job is redirecting the one she was
   * watching.
   */
  laneShift: number;
  /** Furthest-left column reached, for the two-star rule. */
  deepestCol: number;
  active: boolean;
}

export class EnemyField {
  readonly items: Enemy[] = [];

  constructor() {
    for (let i = 0; i < POOL.enemies; i++) this.items.push(blankEnemy());
  }

  /** Returns null when the pool is full. A contract makes that unreachable. */
  spawn(kind: EnemyKind, lane: number, hpScale: number): Enemy | null {
    const item = this.items.find((e) => !e.active);
    if (!item) return null;
    const def = ENEMIES[kind];
    item.kind = kind;
    item.lane = lane;
    item.x = spawnX();
    item.prevX = item.x;
    item.hp = def.hp * hpScale;
    item.shield = (def.shield ?? 0) * hpScale;
    item.slowFor = 0;
    item.slowFactor = 1;
    item.concealed = def.hidden === true;
    item.actionTimer = 0;
    item.hurt = 0;
    item.lastHit = 'none';
    item.grabbing = false;
    item.laneShift = 0;
    item.deepestCol = COL_BEYOND_BOARD;
    item.active = true;
    return item;
  }

  count(): number {
    let total = 0;
    for (const item of this.items) if (item.active) total += 1;
    return total;
  }

  reset(): void {
    for (const item of this.items) item.active = false;
  }

  /** The kid furthest left in a lane — the one a toy in that lane is fighting. */
  frontmostIn(lane: number): Enemy | null {
    let best: Enemy | null = null;
    for (const item of this.items) {
      if (!item.active || item.lane !== lane) continue;
      if (!best || item.x < best.x) best = item;
    }
    return best;
  }
}

/** Sentinel for "hasn't set foot on the board yet". Higher than any real column. */
export const COL_BEYOND_BOARD = 99;

/** Which column a kid is standing over, for the deepest-column star rule. */
export function enemyCol(enemy: Enemy): number {
  return colAtX(enemy.x);
}

function blankEnemy(): Enemy {
  return {
    kind: 'crawler',
    lane: 0,
    x: 0,
    prevX: 0,
    hp: 0,
    shield: 0,
    slowFor: 0,
    slowFactor: 1,
    concealed: false,
    actionTimer: 0,
    hurt: 0,
    lastHit: 'none',
    grabbing: false,
    laneShift: 0,
    deepestCol: COL_BEYOND_BOARD,
    active: false,
  };
}
