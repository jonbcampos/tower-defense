/**
 * The toy roster.
 *
 * A `ToyDef` is data, not a class. Adding a toy is one entry here, one painter
 * in `render/toys.ts`, and putting its id in a level's `unlocks`. If a new toy
 * ever needs a fourth file, something belongs in this table that isn't in it
 * yet — see the authoring contract in DECISIONS.md.
 *
 * The numbers below are the only per-toy tuning in the game. Everything global
 * (costs scaling, income rates, safety margins) is in `config.ts`.
 */

import { CELL_COUNT, COL_COUNT, cellIndex } from './config';

export type ToyId =
  | 'jar'
  | 'wand'
  | 'fort'
  | 'sprinkler'
  | 'watergun'
  | 'nightlight'
  | 'slime'
  | 'powder'
  | 'fountain'
  | 'machine'
  | 'ring'
  | 'castle'
  | 'sweeper';

/**
 * What a toy hurts kids *with*.
 *
 * Immunity is keyed off this rather than off the toy id, so a kid's twist is
 * "raincoats shrug off water" rather than "raincoats shrug off the water gun
 * and the sprinkler and whatever else gets added later and someone remembers".
 *
 * `'none'` bypasses every immunity. Only the free lane sweeper uses it, because
 * a panic button that can fail to work is not a panic button.
 */
export type DamageKind = 'water' | 'bubble' | 'powder' | 'light' | 'none';

export type ToyRole = 'producer' | 'shooter' | 'wall' | 'floor' | 'instant';

/**
 * Which layer of a cell a toy sits in.
 *
 * `floor` toys go under everything, so a Sticky Slime and a Water Gun can share
 * one cell. That's the whole reason the layer exists: a slowing tile that costs
 * you a shooting slot is a tile nobody ever places.
 */
/**
 * Which of a cell's three stacked slots a toy occupies.
 *
 * `floor` goes under everything, so Sticky Slime and a Water Gun can share a
 * cell — a slowing tile that costs you a shooting slot is a tile nobody places.
 * `float` is the paddling pool's prerequisite: a cell of water holds nothing at
 * all until a Duck Ring is in it, and then it behaves like dry ground.
 */
export type ToyLayer = 'ground' | 'floor' | 'float';

export interface ToyDef {
  id: ToyId;
  name: string;
  /**
   * One line for the guide screen, written to be read ALOUD to a five-year-old.
   *
   * Lives here rather than in the UI so that adding a toy still touches only
   * the four files decision 18 allows. Say what it does and what it is for; a
   * child who has forgotten what the sprinkler is does not need its damage
   * numbers, she needs "sprays three lanes, hits the floaty one".
   */
  blurb: string;
  role: ToyRole;
  layer: ToyLayer;
  cost: number;
  /** Seconds before the card can be used again. 0 for everything reusable. */
  recharge: number;
  /** Structural health. Instants are never placed, so they have none. */
  hp: number;

  /** Producers: a drop worth `value` every `interval` seconds. */
  produce?: { interval: number; value: number };

  /**
   * Shooters: damage per shot, seconds between shots, and how many lanes wide.
   * `lanes: 3` means its own lane plus the one above and below. Range along the
   * lane is unlimited on purpose — a range circle is one more thing to explain,
   * and "it shoots down the row" is a rule a five-year-old already knows.
   */
  shoot?: { damage: number; interval: number; kind: DamageKind; lanes: number; speed: number };

  /** Instants: damage applied to a whole lane the moment it is used. */
  instant?: { damage: number; kind: DamageKind; lanes: number; reveals: boolean };

  /** Floor tiles: what they multiply a kid's speed by while it stands on them. */
  slow?: { factor: number };

  /**
   * Whether this toy can touch a kid that is floating. Ground shooters fire
   * flat down the lane and a balloon drifts over them; anything that goes up,
   * spreads out or lights the room can reach one.
   */
  hitsAir: boolean;

  /** Card and board colours. Kept on the def so adding a toy is one line. */
  color: string;
  accent: string;
}

/**
 * Silhouette first, colour second.
 *
 * Every toy below is a different *shape* at 30px — a jar is round, the wand is
 * a stick with a ring, the fort is a squat block, the sprinkler is a cross, the
 * water gun is a nozzle pointing left. A child who is watching lane four picks
 * these out of her peripheral vision by outline. Colour is the confirmation,
 * never the identification.
 */
export const TOYS: Record<ToyId, ToyDef> = {
  jar: {
    id: 'jar',
    name: 'Glitter Jar',
    blurb: 'Makes sparkles by itself. Build these first.',
    role: 'producer',
    layer: 'ground',
    // Cheap enough that the very first thing a new player can afford is the
    // thing that makes everything else affordable.
    cost: 25,
    recharge: 6,
    hp: 90,
    // Exactly twice the free trickle. Building economy is obviously correct;
    // the trickle stays a floor rather than becoming irrelevant. First drop at
    // half an interval, so the jar has paid for itself by t=12s — fast enough
    // that a five-year-old connects the cause to the effect within one wave.
    produce: { interval: 8, value: 20 },
    hitsAir: false,
    color: '#ffd94d',
    accent: '#fffbe0',
  },

  wand: {
    id: 'wand',
    name: 'Bubble Wand',
    blurb: 'Blows bubbles along its own row.',
    role: 'shooter',
    layer: 'ground',
    cost: 50,
    recharge: 5,
    // Six seconds in a Toddler's hands. Low enough that "something has to stand
    // in front of this" is a lesson the wand teaches by itself, on level two.
    hp: 80,
    // 6.4 damage a second. Set by the contracts, not by feel: two of these
    // are what a lane gets early on, and two have to see off a Toddler on HARD
    // over the width of the board with margin to spare.
    shoot: { damage: 9, interval: 1.4, kind: 'bubble', lanes: 1, speed: 150 },
    hitsAir: false,
    color: '#dff4ff',
    accent: '#79d0f5',
  },

  fort: {
    id: 'fort',
    name: 'Pillow Fort',
    blurb: 'A wall of pillows. Hurts nobody, but they stop to pull it apart.',
    role: 'wall',
    layer: 'ground',
    // The same price as the wand it protects. A wall that costs more than the
    // thing behind it is a wall nobody buys.
    cost: 50,
    recharge: 12,
    hp: 400,
    hitsAir: false,
    color: '#ff9ec7',
    accent: '#ffd6e8',
  },

  sprinkler: {
    id: 'sprinkler',
    name: 'Sprinkler',
    blurb: 'Sprays three rows at once, and it can reach the floaty one.',
    role: 'shooter',
    layer: 'ground',
    // The same price as a Water Gun for two thirds of its total damage, spread
    // over three lanes instead of one. Priced down from 125 because it is the
    // ONLY sustained answer to a balloon until level nine, and a mandatory toy
    // that costs more than the level's opening hand is a toll, not a choice.
    cost: 100,
    // Eight seconds, not twelve. This is the ONLY sustained answer to a Balloon
    // Kid for three whole levels, and a card that gates the only answer behind
    // a twelve-second wait means a stream of balloons gets through no matter
    // how much money you have. A toy that is mandatory has to be available.
    recharge: 8,
    hp: 100,
    // Weak per lane, three lanes at once, and it goes UP — which is what makes
    // it the first answer to a balloon.
    shoot: { damage: 5, interval: 1.6, kind: 'water', lanes: 3, speed: 110 },
    hitsAir: true,
    color: '#66c8f2',
    accent: '#b7e84f',
  },

  watergun: {
    id: 'watergun',
    name: 'Water Gun',
    blurb: 'Hits hard, straight ahead. Raincoats just shrug it off.',
    role: 'shooter',
    layer: 'ground',
    cost: 100,
    recharge: 8,
    hp: 100,
    // Twice the wand's price for 2.3x its damage. Strictly better per sparkle,
    // which is correct for a toy you unlock four levels later — but it is water,
    // and the raincoat is two levels away.
    shoot: { damage: 20, interval: 1.5, kind: 'water', lanes: 1, speed: 180 },
    hitsAir: false,
    color: '#4aa3d9',
    accent: '#dff4ff',
  },

  nightlight: {
    id: 'nightlight',
    name: 'Nightlight',
    blurb: 'Lights up one whole row and finds whoever is hiding.',
    role: 'instant',
    layer: 'ground',
    cost: 140,
    // A long recharge is what keeps the panic button from becoming the answer
    // to everything. It must still be shorter than the rest between waves, and
    // a contract checks that rather than trusting this number.
    recharge: 45,
    hp: 0,
    instant: { damage: 60, kind: 'light', lanes: 1, reveals: true },
    hitsAir: true,
    color: '#ffe98a',
    accent: '#fffbe0',
  },

  slime: {
    id: 'slime',
    name: 'Sticky Slime',
    blurb: 'Goes on the floor. Everyone slows down in it, except sock feet.',
    role: 'floor',
    layer: 'floor',
    cost: 75,
    recharge: 10,
    hp: 60,
    // Less than half speed. A Runner crossing a slimed cell takes longer than a
    // Toddler crossing a clean one, which is the whole point of the toy.
    slow: { factor: 0.45 },
    hitsAir: false,
    color: '#b7e84f',
    accent: '#7ec32f',
  },

  powder: {
    id: 'powder',
    name: 'Powder Puff',
    blurb: 'One big puff clears a whole row at once. Then it needs a rest.',
    role: 'instant',
    layer: 'ground',
    cost: 150,
    recharge: 30,
    hp: 0,
    // Enough to erase a full lane of anything short of a Puffy Coat. Expensive
    // and slow to come back, so spending it on one Toddler is a real mistake
    // rather than a free win.
    instant: { damage: 120, kind: 'powder', lanes: 1, reveals: false },
    hitsAir: true,
    color: '#fff0d9',
    accent: '#e8d5b0',
  },

  fountain: {
    id: 'fountain',
    name: 'Sparkle Fountain',
    blurb: 'Sparkles quicker than a jar, but it costs more to put down.',
    role: 'producer',
    layer: 'ground',
    cost: 150,
    recharge: 12,
    hp: 110,
    // Twice a jar's rate for six times a jar's price. Deliberately terrible per
    // sparkle and the only thing worth building when what you have run out of
    // is CELLS, not money. That is the entire lesson of level eight, and the
    // level's blocked columns are what make it true.
    produce: { interval: 5, value: 25 },
    hitsAir: false,
    color: '#ffb3d1',
    accent: '#ffd94d',
  },

  machine: {
    id: 'machine',
    name: 'Bubble Machine',
    blurb: 'Bubbles in three rows at the same time. The big one.',
    role: 'shooter',
    layer: 'ground',
    cost: 250,
    recharge: 12,
    hp: 140,
    // Three lanes at near single-lane strength. The most expensive thing in the
    // game and the only toy that makes a five-lane board feel small.
    shoot: { damage: 12, interval: 1.3, kind: 'bubble', lanes: 3, speed: 130 },
    hitsAir: true,
    color: '#c9b3ff',
    accent: '#dff4ff',
  },

  /**
   * The Guard Bear's payload. Never a card, never in a loadout, never bought.
   *
   * It lives in this table anyway because it is a thing that does damage to a
   * lane, and everything that does damage to a lane goes through the same code
   * path. Giving it its own bespoke branch would be one more place for a rule
   * like "immunities don't apply here" to be forgotten.
   */
  castle: {
    id: 'castle',
    name: 'Sand Castle',
    blurb: 'A really strong wall. Takes ages to knock down.',
    role: 'wall',
    layer: 'ground',
    // Three times a Pillow Fort's health for two and a half times the price.
    // Deliberately a worse deal per sparkle: the thing you are buying is the
    // number of SECONDS one cell holds, and in the backyard's pool lanes a cell
    // costs a Duck Ring before it costs anything else, so cells are the scarce
    // resource rather than sparkles.
    cost: 125,
    recharge: 0,
    hp: 1200,
    hitsAir: false,
    color: '#e8c98a',
    accent: '#c9a666',
  },

  ring: {
    id: 'ring',
    name: 'Duck Ring',
    blurb: 'Float it on the water, then you can build on top of it.',
    role: 'wall',
    layer: 'float',
    // Cheap on purpose. It does nothing by itself, and a prerequisite you have
    // to save up for reads as a tax rather than as a move — the interesting
    // decision is which water cells are worth opening, not whether you can
    // afford to open any.
    cost: 25,
    recharge: 0,
    // Tougher than a Pillow Fort. A kid who stops to pull the ring apart also
    // destroys whatever was standing on it, so it losing quickly would make the
    // pool lanes feel like a trap rather than a cost.
    hp: 300,
    hitsAir: false,
    color: '#ffd94d',
    accent: '#fff3c4',
  },

  sweeper: {
    id: 'sweeper',
    name: 'Guard Bear',
    blurb: 'Free! He hugs the first kid who reaches you. One per row, once.',
    role: 'instant',
    layer: 'ground',
    cost: 0,
    recharge: 0,
    hp: 0,
    // 'none' so it cannot be shrugged off. A panic button that sometimes does
    // nothing teaches a child not to trust the game.
    instant: { damage: 9999, kind: 'none', lanes: 1, reveals: true },
    hitsAir: true,
    color: '#7ee6a8',
    accent: '#fff4fb',
  },
};

/** Unlock order. Also the order cards appear in the tray. */
export const TOY_ORDER: readonly ToyId[] = [
  'jar',
  'wand',
  'fort',
  'sprinkler',
  'watergun',
  'nightlight',
  'slime',
  'powder',
  'fountain',
  'machine',
  // Backyard. The Guard Bear is deliberately absent from this list — it is not
  // a card, it never appears in the tray, and putting it here would give it a
  // slot in the loadout picker that nobody can use.
  'ring',
  'castle',
];

/** Damage per second a shooter lands on a single kid standing in front of it. */
export function toyDps(id: ToyId): number {
  const shoot = TOYS[id].shoot;
  if (!shoot) return 0;
  return shoot.damage / shoot.interval;
}

/** Sparkles per second a producer generates. 0 for everything else. */
export function toyIncome(id: ToyId): number {
  const produce = TOYS[id].produce;
  if (!produce) return 0;
  return produce.value / produce.interval;
}

/** True if a toy can, by itself, reduce a kid's health. Walls and slime can't. */
export function toyDealsDamage(id: ToyId): boolean {
  return TOYS[id].shoot !== undefined || TOYS[id].instant !== undefined;
}

// --- The board's toys -------------------------------------------------------

/**
 * One live toy on the board.
 *
 * These are pre-allocated, one per cell per layer, and never created or thrown
 * away. Placement flips `active` and assigns the fields; removal flips it back.
 * Nothing allocates after startup, and an occupied-cell test is one boolean
 * rather than a scan.
 */
export interface Toy {
  id: ToyId;
  lane: number;
  col: number;
  hp: number;
  maxHp: number;
  /** Counts down to the next shot or the next sparkle drop. */
  timer: number;
  /** Seconds since placement, for the refund window. */
  age: number;
  /** What was paid, so a refund gives back a share of the real price. */
  paid: number;
  /** Flash timer for the damage tint. */
  hurt: number;
  active: boolean;
}

/**
 * Both layers of the board, addressed by cell index.
 *
 * Two flat arrays rather than one array of cell objects: the update loop walks
 * the ground layer every frame and the floor layer only on movement checks, and
 * splitting them keeps the hot loop from touching memory it doesn't need.
 */
export class ToyGrid {
  readonly ground: Toy[] = [];
  readonly floor: Toy[] = [];
  readonly float: Toy[] = [];

  constructor() {
    for (let i = 0; i < CELL_COUNT; i++) {
      this.ground.push(blankToy(i));
      this.floor.push(blankToy(i));
      this.float.push(blankToy(i));
    }
  }

  layerFor(id: ToyId): Toy[] {
    const layer = TOYS[id].layer;
    if (layer === 'floor') return this.floor;
    if (layer === 'float') return this.float;
    return this.ground;
  }

  /** The float in a cell, if any. The prerequisite for building on water. */
  floatAt(lane: number, col: number): Toy | null {
    const toy = this.float[cellIndex(lane, col)]!;
    return toy.active ? toy : null;
  }

  at(lane: number, col: number): Toy | null {
    const toy = this.ground[cellIndex(lane, col)]!;
    return toy.active ? toy : null;
  }

  floorAt(lane: number, col: number): Toy | null {
    const toy = this.floor[cellIndex(lane, col)]!;
    return toy.active ? toy : null;
  }

  /** True if `id` could legally go here, ignoring cost. Blocked cells are the caller's job. */
  canPlace(id: ToyId, lane: number, col: number): boolean {
    if (lane < 0 || lane >= this.floor.length / COL_COUNT) return false;
    if (col < 0 || col >= COL_COUNT) return false;
    return !this.layerFor(id)[cellIndex(lane, col)]!.active;
  }

  place(id: ToyId, lane: number, col: number, paid: number): Toy {
    const toy = this.layerFor(id)[cellIndex(lane, col)]!;
    const def = TOYS[id];
    toy.id = id;
    toy.lane = lane;
    toy.col = col;
    toy.hp = def.hp;
    toy.maxHp = def.hp;
    // Producers start half-charged so the first drop lands at t=4s rather than
    // t=8s. A jar that appears to do nothing for eight seconds reads as broken.
    toy.timer = def.produce ? def.produce.interval / 2 : (def.shoot?.interval ?? 0);
    toy.age = 0;
    toy.paid = paid;
    toy.hurt = 0;
    toy.active = true;
    return toy;
  }

  remove(toy: Toy): void {
    toy.active = false;
  }

  reset(): void {
    for (const toy of this.ground) toy.active = false;
    for (const toy of this.floor) toy.active = false;
    for (const toy of this.float) toy.active = false;
  }
}

function blankToy(index: number): Toy {
  return {
    id: 'jar',
    lane: Math.floor(index / COL_COUNT),
    col: index % COL_COUNT,
    hp: 0,
    maxHp: 0,
    timer: 0,
    age: 0,
    paid: 0,
    hurt: 0,
    active: false,
  };
}
