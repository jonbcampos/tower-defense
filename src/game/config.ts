/**
 * Every global tuning number in the game lives in this file.
 *
 * Units: virtual pixels and seconds. The game simulates at a fixed virtual
 * resolution and the renderer scales that to whatever the device actually is,
 * so these numbers mean the same thing on every phone.
 *
 * Rule: nothing else in the codebase should contain a magic gameplay number.
 *
 * The one deliberate exception is the two content registries — `TOYS` in
 * `toys.ts` and `ENEMIES` in `enemies.ts`. Those are named data tables, not
 * loose numbers, and they have to live next to the types that give them
 * meaning. Anything that isn't per-toy or per-kid belongs here.
 */

// --- Screen -----------------------------------------------------------------

/**
 * The virtual frame the game is drawn into.
 *
 * Height is FIXED, because the board is five lanes tall and a lane must be the
 * same size on every device. Width ADAPTS between the clamps below, because a
 * fixed 16:9 frame on a 20:9 phone wastes two fat black bars.
 *
 * The extra width on a wide phone becomes wider SIDE MARGINS — never extra
 * columns and never extra runway between the door and the first column. Both
 * of those would let the hardware decide the difficulty: a 21:9 phone would
 * hand you three free seconds per lane that a 16:9 phone doesn't get.
 */
export const DESIGN_W = 480;
export const VIRTUAL_H = 270;

/** Never narrower than the design width, or the board doesn't fit. */
export const MIN_VIRTUAL_W = DESIGN_W;
/** 2.37:1 — covers every phone up to 21:9 without letterboxing. */
export const MAX_VIRTUAL_W = 640;

/** The live frame size. Mutated by Viewport on resize. */
export const SCREEN = { w: DESIGN_W, h: VIRTUAL_H, rotated: false };

/** Retina beyond 2x costs fill rate and buys nothing at this art scale. */
export const MAX_DPR = 2;

// --- Loop -------------------------------------------------------------------

/**
 * Physics advances in exact 1/120s increments regardless of refresh rate, and
 * the renderer interpolates between steps. Without this, a kid's walking speed
 * literally differs between a 60Hz and a 120Hz phone — and every fairness
 * contract in this file is written in seconds, so they'd all quietly be lies.
 */
export const FIXED_DT = 1 / 120;
/** Clamp on a single frame's elapsed time, so a stall doesn't teleport anyone. */
export const MAX_FRAME_TIME = 0.25;

// --- The board --------------------------------------------------------------

/**
 * Five lanes of nine cells. The numbers are chosen from the thumb up:
 *
 * A 44x40 cell on a 480-wide frame is roughly 9mm across on a 5" phone held in
 * landscape, which is about the size of a five-year-old's fingertip contact
 * patch. Smaller cells fit more strategy on screen and make the game unplayable
 * for the person it's for.
 *
 * Nine columns is then what's left over once the bed and the doorway have their
 * space, and it happens to be a good number: deep enough that "put the shooters
 * at the back" is a real decision, shallow enough that a lane reads at a glance.
 */
export const LANE_COUNT = 5;
export const COL_COUNT = 9;
export const CELL_COUNT = LANE_COUNT * COL_COUNT; // 45

export const CELL_W = 44;
export const CELL_H = 40;

export const BOARD_W = COL_COUNT * CELL_W; // 396
export const BOARD_H = LANE_COUNT * CELL_H; // 200

/** The toy tray runs across the top; the board starts below it. */
export const TRAY_H = 44;
export const BOARD_TOP = TRAY_H; // 44
export const BOARD_BOTTOM = BOARD_TOP + BOARD_H; // 244

/** The strip under the board: level name and wave progress. */
export const FOOTER_H = VIRTUAL_H - BOARD_BOTTOM; // 26

/**
 * The unicorn's cushion, left of column 0. Not placeable.
 *
 * Was 40 while there was a drawn doorway on the right; the door was cut (it did
 * not read as a door) and all 44 of its pixels came here, which was too much —
 * the unicorn ended up adrift in a wide empty strip while the board sat flush
 * against the right edge of the screen. 68 is the balance: enough for her to
 * sit clear of the Toy Vacuums, not so much that she looks lost.
 */
export const BED_W = 68;

/**
 * A matching strip on the right, so the board is CENTRED rather than shoved
 * against the edge. Purely visual — the run-up kids walk is measured from the
 * board (see `SPAWN_RUN`), so this cannot change the difficulty.
 */
export const RIGHT_MARGIN = 16;

/** 68 + 396 + 16 = 480. The design width is this sum, not the other way round. */
export const BOARD_SPAN = BED_W + BOARD_W + RIGHT_MARGIN;

/**
 * How far right of the board a kid appears.
 *
 * Fixed, and measured from the BOARD rather than from the screen edge, so the
 * walk is exactly the same length on every device — the rule from decision 5.
 * On a narrow frame this is off-screen; on a wide one a kid is briefly visible
 * in the side margin before reaching column eight, which looks like walking in
 * from the side of the room and costs nothing, because the distance to the
 * cushion is identical either way.
 */
export const SPAWN_RUN = 24;

/**
 * The extra width a wide phone gets, split evenly outside the play area.
 * Rounded so cell edges land on whole pixels — a half-pixel grid line on an
 * unsmoothed canvas shimmers as the board scrolls under a finger.
 */
export function sideMargin(): number {
  return Math.round((SCREEN.w - BOARD_SPAN) / 2);
}

export function bedX(): number {
  return sideMargin();
}
export function boardLeft(): number {
  return sideMargin() + BED_W;
}
export function cellX(col: number): number {
  return boardLeft() + col * CELL_W;
}
export function laneY(lane: number): number {
  return BOARD_TOP + lane * CELL_H;
}
export function cellCentreX(col: number): number {
  return cellX(col) + CELL_W / 2;
}
export function laneCentreY(lane: number): number {
  return laneY(lane) + CELL_H / 2;
}

/**
 * Which board column a world x sits over.
 *
 * Returns a negative number left of the board and >= COL_COUNT right of it, on
 * purpose — callers that care about "has this kid reached the board yet" get
 * the answer from the same function that gives them the column, rather than
 * from a second boundary test that could disagree with this one.
 */
export function colAtX(x: number): number {
  return Math.floor((x - boardLeft()) / CELL_W);
}

/** Cells are addressed by a single index everywhere. Placement is never a search. */
export function cellIndex(lane: number, col: number): number {
  return lane * COL_COUNT + col;
}
export function cellLane(index: number): number {
  return Math.floor(index / COL_COUNT);
}
export function cellCol(index: number): number {
  return index % COL_COUNT;
}

/** Kids walk on from beyond the right-hand end of the board. */
export function spawnX(): number {
  return boardLeft() + BOARD_W + SPAWN_RUN;
}

/**
 * A kid whose centre reaches here has climbed onto the cushion.
 *
 * Half a cell left of column zero, not the column-zero edge, so the squeeze is
 * something the player watches arrive rather than something that fires while
 * the kid still looks like it's on the board. The extra half-cell of walking is
 * also, quietly, half a cell more time for a last-second Powder Puff.
 */
export function squeezeX(): number {
  return boardLeft() - CELL_W / 2;
}

/** The cell under a point, or null if the point isn't over the board. */
export function cellAt(x: number, y: number): { lane: number; col: number } | null {
  const lane = Math.floor((y - BOARD_TOP) / CELL_H);
  const col = colAtX(x);
  if (lane < 0 || lane >= LANE_COUNT) return null;
  if (col < 0 || col >= COL_COUNT) return null;
  return { lane, col };
}

/**
 * How far a kid walks, door to cushion. Independent of screen width by
 * construction — every enemy's `crossSeconds` is measured against this, so a
 * wide phone cannot make the game easier.
 */
export const CROSS_DISTANCE = BOARD_W + SPAWN_RUN + CELL_W / 2; // 442

/** Halfway across the board. The 2-star line: no kid may get past it. */
export const HALFWAY_COL = 4;

/**
 * How many kids can reach the cushion before the level is lost.
 *
 * Not one. In Plants vs Zombies a single zombie through the door ends the run,
 * and that is the right amount of tension for an adult. For a five-year-old it
 * is a game that ends without warning at the exact moment she is most confused
 * about why. Three squeezes gives her two chances to see it happen, understand
 * what happened, and fix the lane — and the hearts draining is a much clearer
 * teacher than a sudden loss screen.
 */
export const SQUEEZE_LIVES = 3;

/** Seconds a kid spends hugging the unicorn before wandering off happy. */
export const SQUEEZE_SECONDS = 1.1;

// --- Sparkles ---------------------------------------------------------------

export const SPARKLE = {
  /**
   * Free income, arriving whether or not the player has built anything.
   *
   * This is the only reason a wiped-out player is never permanently stranded,
   * and the rate is set by a contract rather than by feel: 10 every 6s is
   * 1.67/s, which is six discrete drops inside STUCK_SECONDS — enough to
   * rebuild the cheapest defender with one drop to spare. Small and frequent
   * rather than large and rare, because each drop is also a tap, and a child
   * who taps six times has been given six small things to do.
   *
   * A Glitter Jar is still obviously the better idea — not because one jar is
   * dramatically faster, but because you can have six jars and there is only
   * ever one trickle.
   *
   * Deliberately NOT scaled by difficulty. HARD is harder because of the kids;
   * the floor that stops a wiped-out player being stranded is a floor, and a
   * floor that moves is not one.
   */
  trickleFirstDelay: 4,
  trickleInterval: 6,
  trickleValue: 10,

  /**
   * A drop sits on the floor this long before fading. Longer than two producer
   * cycles AT THE SLOWEST DIFFICULTY, so a child who is busy watching a lane
   * doesn't lose income for it — a contract enforces the relationship rather
   * than trusting these two numbers to be edited together.
   */
  lifetime: 22,
  fadeLast: 3,

  /** EASY only: a drop flies to the purse by itself after this long. */
  autoCollectDelay: 0.7,

  /** Tap radius. Generous on purpose; see the forgiveness rules in DECISIONS. */
  tapRadius: 14,

  /** Drop visual size, and how far a producer's drop scatters from its toy. */
  radius: 6,
  scatter: 10,
} as const;

/** Every level's authored start, before `difficulty.startSparkleBonus`. */
export const START_SPARKLES = 100;

/**
 * Income rates the fairness contracts are written against. Derived here rather
 * than typed into the contracts, so they can't drift apart from the numbers
 * above.
 */
export const TRICKLE_RATE = SPARKLE.trickleValue / SPARKLE.trickleInterval; // 1.5/s

/** A player who has fallen apart must be able to rebuild within this long. */
export const STUCK_SECONDS = 35;

/**
 * Safety factors for the kill-guarantee contracts.
 *
 * `KILL_SAFETY` assumes a toy only lands this share of its theoretical damage —
 * a real player places late, and a real shot misses the last frame. `KILL_MARGIN`
 * then demands that reduced total still exceed the target's health by 25%.
 * Together they mean "comfortably", not "exactly".
 */
export const KILL_SAFETY = 0.65;
export const KILL_MARGIN = 1.25;

// --- Waves ------------------------------------------------------------------

export const WAVE = {
  /**
   * A wave starts when the previous one is cleared OR its timeout elapses.
   *
   * Clear-triggered so a strong player is never made to stand around watching
   * an empty board, timeout-triggered so a struggling one is never buried by a
   * queue that kept advancing while they were losing.
   */
  defaultTimeout: 26,
  /** Rest between waves at NORMAL, before `difficulty.waveRestScale`. */
  baseRest: 6,
  /** Never less rest than this, whatever the difficulty scaling says. */
  minRest: 4,
  /** A `big` wave announces itself for this long before the first kid appears. */
  bigWarning: 3.5,
  /** How long the lane flash lasts on a big wave. */
  flashSeconds: 1.2,
} as const;

// --- Forgiveness ------------------------------------------------------------

/**
 * The rules that exist because the player is five.
 *
 * A mis-tap never costs sparkles: an illegal placement is refused with a red X
 * and its own sound, and the purse does not move. The sound matters as much as
 * the refund — silence, to a child, means the game stopped working.
 */
export const FORGIVE = {
  /** Extra tap radius around a cell, in px, past its actual bounds. */
  cellTapPad: 4,
  /** Extra tap radius around a tray card. */
  cardTapPad: 5,
  /** How long the red X shows after a refused placement. */
  denyFlash: 0.5,
} as const;

// --- Juice ------------------------------------------------------------------

export const JUICE = {
  /** Screenshake when a kid reaches the cushion. Small: this is a cosy game. */
  squeezeShake: 5,
  shakeDecay: 9,
  /** A freeze on the moment a level is lost, so the cause is legible. */
  loseHitstop: 0.35,
  popupRise: 14,
  popupSeconds: 0.9,
} as const;

// --- Pools ------------------------------------------------------------------

/**
 * Nothing allocates after startup. Every one of these is asserted against the
 * worst case the authored content can actually produce, so growing a world
 * raises a number here rather than finding a crash on someone's phone.
 *
 * Toys need no pool: there are exactly CELL_COUNT of them, indexed by cell.
 */
export const POOL = {
  enemies: 48,
  projectiles: 64,
  sparkles: 24,
  effects: 16,
  events: 24,
  popups: 8,
  particles: 160,
} as const;

// --- Difficulty -------------------------------------------------------------

export type DifficultyId = 'kid' | 'normal' | 'hard';

export interface Difficulty {
  id: DifficultyId;
  label: string;
  enemyHpScale: number;
  enemySpeedScale: number;
  /** Added to every level's authored `startSparkles`. */
  startSparkleBonus: number;
  /** Multiplies every producer's and the trickle's INTERVAL. Below 1 is faster. */
  sparkleIntervalScale: number;
  toyCostScale: number;
  /** Multiplies the rest between waves. Below 1 is more pressure. */
  waveRestScale: number;
  /** Share of `optional` wave beats that are included. */
  extraBeatsShare: number;
  /**
   * Seconds before a spent Toy Vacuum comes back, or Infinity for never.
   *
   * Every difficulty gets one vacuum per lane. That is not a kindness setting,
   * it is a structural guarantee: without it a kid that reaches column zero can
   * become UNKILLABLE, because everything behind it is a producer and every
   * shooter fires the other way. That state doesn't end — it just sits there.
   */
  mowerRechargeSeconds: number;
  /**
   * Sparkles fly to the purse on their own. The most important EASY lever,
   * because it removes a thing to CONSIDER rather than a thing to do.
   */
  autoCollectSparkles: boolean;
  /** The loadout is taken from `level.recommended` rather than chosen. */
  loadoutIsPicked: boolean;
  /**
   * Share of damage an immune kid still takes from the thing it's immune to.
   *
   * A child who hasn't yet worked out why her water gun does nothing to the
   * raincoat still wins the level. She'll work it out from the splash bouncing
   * off, which is drawn either way.
   */
  immunityLeak: number;
  /** Refund share, and how long after placing a toy it stays available. */
  refundShare: number;
  refundGraceSeconds: number;
}

/**
 * Difficulty is a handful of multipliers, not separate content.
 *
 * The ladder is CHORES FIRST, PRESSURE SECOND. EASY to NORMAL adds two things
 * to *consider* — you collect your own sparkles, you pick your own five cards —
 * and speeds nothing up. NORMAL to HARD keeps the identical vocabulary and
 * turns up hit points, speed, wave density and the optional beats.
 *
 * Stacking "now you must pick a loadout" on top of "and everything is 25%
 * tougher" would mean a player who failed at HARD couldn't tell which of the
 * two changes beat them.
 *
 * Note what EASY does NOT do: it does not delete an enemy type. Every kid has
 * an answer in every recommended loadout by construction, so removing content
 * would only change which levels exist — and a child playing EASY while a
 * parent plays NORMAL should be watching the same game. `immunityLeak` is the
 * honest lever instead.
 */
export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  kid: {
    id: 'kid',
    label: 'EASY',
    enemyHpScale: 0.75,
    enemySpeedScale: 0.8,
    startSparkleBonus: 50,
    sparkleIntervalScale: 0.75,
    toyCostScale: 0.8,
    waveRestScale: 1.5,
    extraBeatsShare: 0,
    // Infinity, even on EASY. A recharging vacuum sounds kind and is actually
    // corrosive: with five lanes refilling every 25 seconds the game stops
    // being losable at all, and a trial that drives a level with NO PLAYER
    // caught exactly that — eight of the ten levels beat themselves. EASY is
    // forgiving through softer kids, cheaper toys and free collection, none of
    // which remove the need to play.
    mowerRechargeSeconds: Infinity,
    autoCollectSparkles: true,
    loadoutIsPicked: true,
    immunityLeak: 0.25,
    refundShare: 1,
    refundGraceSeconds: 8,
  },
  normal: {
    id: 'normal',
    label: 'NORMAL',
    enemyHpScale: 1,
    enemySpeedScale: 1,
    startSparkleBonus: 0,
    sparkleIntervalScale: 1,
    toyCostScale: 1,
    waveRestScale: 1,
    extraBeatsShare: 0.5,
    mowerRechargeSeconds: Infinity,
    autoCollectSparkles: false,
    loadoutIsPicked: false,
    immunityLeak: 0,
    refundShare: 0.6,
    refundGraceSeconds: 4,
  },
  hard: {
    id: 'hard',
    label: 'HARD',
    enemyHpScale: 1.25,
    enemySpeedScale: 1.15,
    startSparkleBonus: 0,
    // Deliberately 1, not 1.15. HARD is harder because of the KIDS — more of
    // them, tougher, faster, arriving sooner. Taxing the player's income as
    // well means a bad thirty seconds compounds into an unrecoverable minute,
    // which isn't difficulty, it's a spiral.
    sparkleIntervalScale: 1,
    toyCostScale: 1,
    waveRestScale: 0.75,
    extraBeatsShare: 1,
    mowerRechargeSeconds: Infinity,
    autoCollectSparkles: false,
    loadoutIsPicked: false,
    immunityLeak: 0,
    refundShare: 0.6,
    refundGraceSeconds: 4,
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyId[] = ['kid', 'normal', 'hard'];
