/**
 * The simulation.
 *
 * This module and everything it imports know nothing about how the game looks
 * or sounds. There is no import from `src/render/` anywhere below, and there is
 * not going to be one: presentation happens by draining the event queue at the
 * bottom of this file, in `main.ts`. That boundary is what makes a second world
 * a new set of painters rather than a new game.
 *
 * Input works the same way in reverse. `update()` takes no `Input` — it takes
 * dt. Commands arrive as explicit calls (`selectCard`, `tryPlace`, `refund`,
 * `useSweeper`), which means the headless trials in `dev/verify.ts` drive the
 * real game with the real rules rather than a test-only fork of them.
 */

import {
  BOARD_TOP,
  CELL_H,
  CELL_W,
  COL_COUNT,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  FORGIVE,
  HALFWAY_COL,
  JUICE,
  KILL_MARGIN,
  KILL_SAFETY,
  LANE_SHIFT_SECONDS,
  loadoutSlotsFor,
  MIDDLE_LANE,
  SLUSH_FACTOR,
  STEAM_FROM_COL,
  LANE_COUNT,
  POOL,
  SPARKLE,
  SQUEEZE_LIVES,
  STUCK_SECONDS,
  WAVE,
  cellCentreX,
  cellIndex,
  colAtX,
  laneCentreY,
  squeezeX,
  type Difficulty,
  type DifficultyId,
} from './config';
import { applyDamage, isTargetable, ShotPool, enemyHalfWidth, type Shot } from './combat';
import { SparkleField } from './economy';
import {
  COL_BEYOND_BOARD,
  ENEMIES,
  EnemyField,
  answersIn,
  enemySpeed,
  type Enemy,
  type EnemyKind,
} from './enemies';
import { LEVELS, WORLDS, enemiesIn, firstAppearance, type Level } from './levels';
import { TOYS, ToyGrid, toyDealsDamage, type Toy, type ToyId } from './toys';
import { WaveRunner } from './waves';
import { Rng } from '../core/rng';

/**
 * Screen and simulation phase, in one union.
 *
 * `update()` early-returns unless this is `'playing'`, so the menu phases cost
 * the simulation nothing and the renderer gets one field to switch on instead
 * of a parallel screen-state machine that could disagree with this one.
 *
 * `'paused'` is a run that is still entirely intact — every toy, kid, shot and
 * sparkle is where it was. It gets its freeze for free from the early return,
 * which is the whole reason to spend a phase on it rather than a boolean: a
 * `paused` flag would have to be checked separately by everything that ticks,
 * and the first thing anyone forgot to check would keep running under the
 * scrim.
 */
export type Phase =
  | 'title'
  | 'select'
  | 'loadout'
  | 'guide'
  | 'playing'
  | 'paused'
  | 'won'
  | 'lost';

export type GameEventType =
  | 'place'
  | 'deny'
  | 'refund'
  | 'sweep'
  | 'drop'
  | 'collect'
  | 'shoot'
  | 'hit'
  | 'shrug'
  | 'shield-break'
  | 'down'
  | 'toy-hurt'
  | 'toy-lost'
  | 'wave'
  | 'big-wave'
  | 'nightlight'
  | 'powder'
  | 'sweeper'
  | 'boost'
  | 'divert'
  | 'magnet'
  | 'thud'
  | 'throw'
  | 'squeeze'
  | 'win'
  | 'lose';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  /** Sparkle value, damage, whatever the type means. */
  value: number;
  lane: number;
}

export interface RunResult {
  stars: number;
  toysLost: number;
  livesLeft: number;
  deepestCol: number;
}

export class GameState {
  phase: Phase = 'title';
  difficulty: Difficulty = DIFFICULTIES.kid;
  rng = new Rng(1);

  level: Level = LEVELS[0]!;
  /** The cards dealt this run. On EASY this is `level.recommended` verbatim. */
  loadout: ToyId[] = [];

  readonly toys = new ToyGrid();
  readonly enemies = new EnemyField();
  readonly shots = new ShotPool();
  readonly sparkles = new SparkleField();
  readonly waves = new WaveRunner();

  purse = 0;
  lives = SQUEEZE_LIVES;
  elapsed = 0;

  /** The card currently held, waiting for a cell. */
  selected: ToyId | null = null;
  /**
   * The broom is in hand: the next tap on a toy tidies it away.
   *
   * Mutually exclusive with `selected`, and deliberately MODAL. Decision 43
   * took deletion off a plain tap because a Glitter Jar makes sparkles and
   * tapping one to collect deleted it — the accident was the whole problem, not
   * the capability. Arming a tool first is what separates the two: nobody picks
   * up a broom by accident.
   */
  sweeping = false;
  /** Seconds until each card can be used again. */
  readonly cooldowns = new Map<ToyId, number>();

  /**
   * One Guard Bear sitting at the left end of each lane.
   *
   * The last line of defence, and the reason no lane can deadlock. The first
   * kid to reach the cushion in a lane gets swept up in an enormous hug by the
   * bear instead of squeezing the unicorn, and the pair of them wander off
   * together. The bear is then gone.
   *
   * Mechanically this is Plants vs Zombies' lawnmower, for the same two
   * reasons: it turns the first mistake in a lane into a warning rather than a
   * loss, and it guarantees the board can always be cleared. It was literally a
   * robot vacuum at first, which is what you get by translating "lawnmower"
   * into a bedroom instead of asking what belongs in one. In a game about
   * stuffed animals, the thing that saves a stuffed animal is another stuffed
   * animal.
   */
  readonly guardReady: boolean[] = new Array<boolean>(LANE_COUNT).fill(true);
  private readonly guardTimer: number[] = new Array<number>(LANE_COUNT).fill(0);

  /** Cells this level's furniture covers. */
  /**
   * Cell index of the most recent placement, or -1. The only refundable toy.
   */
  private lastPlaced = -1;
  private growWaves: ((index: number) => void) | null = null;
  private toughness: ((index: number) => number) | null = null;
  private blocked = new Set<number>();
  /** Paddling-pool cells. Empty outside a `pool` world. See `isWater`. */
  private water = new Set<number>();
  /** Stacks of boxes. Unbuildable, and they stop a flat shot. See `isClutter`. */
  private clutter = new Set<number>();

  /** Star bookkeeping. */
  toysLost = 0;
  deepestCol = COL_BEYOND_BOARD;

  /** Presentation state: set and decayed here, read by the renderer. */
  shake = 0;
  hitstop = 0;
  denyFlash = 0;
  denyCell = -1;
  readonly laneFlash: number[] = new Array<number>(LANE_COUNT).fill(0);

  private trickleTimer = 0;

  private readonly events: GameEvent[] = [];
  private eventCount = 0;

  constructor() {
    for (let i = 0; i < POOL.events; i++) {
      this.events.push({ type: 'place', x: 0, y: 0, value: 0, lane: 0 });
    }
  }

  // --- Lifecycle ------------------------------------------------------------

  start(
    level: Level,
    difficultyId: DifficultyId,
    loadout: readonly ToyId[],
    seed: number,
    /**
     * Endless only: extend the level's waves so it never runs out.
     *
     * A function rather than a mode flag, because that is the entire difference
     * between endless and a campaign level as far as the simulation is
     * concerned. There is no `if (endless)` anywhere below: a level whose wave
     * list keeps growing simply never satisfies `spawnedEverything`, so the win
     * check never fires and the run ends the only other way it can.
     */
    growWaves: ((index: number) => void) | null = null,
    /**
     * Endless only: how much tougher a kid spawned now should be.
     *
     * Same shape and same reasoning as `growWaves` — a function, not a mode
     * flag. The campaign passes nothing and every multiplier below is 1.
     */
    toughness: ((index: number) => number) | null = null,
  ): void {
    this.level = level;
    this.growWaves = growWaves;
    this.toughness = toughness;
    this.difficulty = DIFFICULTIES[difficultyId];
    this.rng = new Rng(seed);
    this.loadout = [...loadout];

    this.toys.reset();
    this.enemies.reset();
    this.shots.reset();
    this.sparkles.reset();

    this.lastPlaced = -1;
    this.blocked = new Set(level.blocked);
    this.water = new Set(WORLDS[level.world].terrain === 'pool' ? (level.water ?? []) : []);
    this.clutter = new Set(level.clutter ?? []);
    this.purse = level.startSparkles + this.difficulty.startSparkleBonus;
    this.lives = SQUEEZE_LIVES;
    this.elapsed = 0;
    this.selected = null;
    this.sweeping = false;
    this.cooldowns.clear();
    for (const id of this.loadout) this.cooldowns.set(id, 0);
    this.guardReady.fill(true);
    this.guardTimer.fill(0);
    this.toysLost = 0;
    this.deepestCol = COL_BEYOND_BOARD;
    this.shake = 0;
    this.hitstop = 0;
    this.denyFlash = 0;
    this.denyCell = -1;
    this.laneFlash.fill(0);
    // Half an interval, so the very first free sparkle lands at t=4s. A player
    // who opens a level unable to afford anything should not also have to wait
    // eight seconds to find out that will change.
    this.trickleTimer = SPARKLE.trickleFirstDelay;
    this.eventCount = 0;

    this.waves.start(level, this.difficulty, this.rng);
    this.phase = 'playing';
  }

  /** Stars, computed from the run. Only meaningful once the level is won. */
  result(): RunResult {
    let stars = 1;
    if (this.deepestCol >= HALFWAY_COL) stars = 2;
    if (this.toysLost === 0 && this.lives === SQUEEZE_LIVES) stars = 3;
    return {
      stars,
      toysLost: this.toysLost,
      livesLeft: this.lives,
      deepestCol: this.deepestCol,
    };
  }

  // --- Commands -------------------------------------------------------------

  /** Pick up a card, or put it back down by selecting it again. */
  selectCard(id: ToyId | null): void {
    // A card and the broom are never both in hand. Picking either up puts the
    // other down, so there is never a tap whose meaning depends on something
    // off-screen.
    this.sweeping = false;
    if (id === null) {
      this.selected = null;
      return;
    }
    if (!this.loadout.includes(id)) return;
    this.selected = this.selected === id ? null : id;
  }

  /** Pick the broom up, or put it back. */
  armSweep(on = !this.sweeping): void {
    this.selected = null;
    this.sweeping = on;
  }

  /** True if a tap here with the broom in hand would take something away. */
  canSweep(lane: number, col: number): boolean {
    if (lane < 0 || lane >= LANE_COUNT || col < 0 || col >= COL_COUNT) return false;
    return this.topOf(lane, col) !== null;
  }

  /**
   * The toy a broom would take first: the highest layer that is occupied.
   *
   * Ground before floor before float, which is the order a child would pick
   * things up in and, more usefully, the order that lets her swap a Water Gun
   * without also losing the Shelf she paid for it to stand on. Two taps takes
   * the shelf as well.
   */
  private topOf(lane: number, col: number): Toy | null {
    return this.toys.at(lane, col) ?? this.toys.floorAt(lane, col) ?? this.toys.floatAt(lane, col);
  }

  /**
   * Tidy a toy away and give the cell back. Returns true if something went.
   *
   * The cell is what you are buying, not the sparkles: an ordinary sweep pays
   * nothing back, because a broom that refunded would turn the whole board into
   * a scratchpad and the economy into a suggestion. The one exception is a toy
   * still inside its refund window, which pays exactly what tapping it would
   * have — sweeping something you put down two seconds ago must never be a
   * worse deal than undoing it, or the two tools contradict each other.
   *
   * It does NOT count as a toy lost. Three stars means "cleared with no toy
   * taken from you", and choosing to tidy one away is not the same event as a
   * kid pulling it apart.
   */
  sweep(lane: number, col: number): boolean {
    if (!this.sweeping) return false;
    const toy = this.topOf(lane, col);
    if (!toy) {
      // An empty cell just puts the broom away. No red X: she has not made a
      // mistake, she has changed her mind, and those must not sound the same.
      this.sweeping = false;
      return false;
    }

    const back = this.isRefundable(lane, col) ? Math.round(toy.paid * this.difficulty.refundShare) : 0;
    this.purse += back;
    this.toys.remove(toy);
    if (this.lastPlaced === cellIndex(lane, col)) this.lastPlaced = -1;
    this.sweeping = false;
    this.emit(back > 0 ? 'refund' : 'sweep', cellCentreX(col), laneCentreY(lane), back, lane);
    return true;
  }

  costOf(id: ToyId): number {
    return Math.round(TOYS[id].cost * this.difficulty.toyCostScale);
  }

  canAfford(id: ToyId): boolean {
    return this.purse >= this.costOf(id);
  }

  isReady(id: ToyId): boolean {
    return (this.cooldowns.get(id) ?? 0) <= 0;
  }

  /**
   * Nothing can be built here.
   *
   * Furniture and box stacks are one answer to that question, so they are one
   * function. They differ only in what ELSE they do — boxes also stop a flat
   * shot — and every caller that cares about buildability wants both.
   */
  isBlocked(lane: number, col: number): boolean {
    const cell = cellIndex(lane, col);
    return this.blocked.has(cell) || this.clutter.has(cell);
  }

  /** A stack of boxes: unbuildable, and a flat shot thuds into it. */
  isClutter(lane: number, col: number): boolean {
    return this.clutter.has(cellIndex(lane, col));
  }

  /**
   * True where a tap would take a toy back — so the renderer can SAY so.
   *
   * A forgiveness feature nobody can see is a feature nobody uses, and one
   * whose rule ("the last one, for a few seconds") has to be discovered by
   * accident is worse than none.
   */
  isRefundable(lane: number, col: number): boolean {
    if (this.lastPlaced !== cellIndex(lane, col)) return false;
    const toy = this.topOf(lane, col);
    return toy !== null && toy.age <= this.difficulty.refundGraceSeconds;
  }

  /** Paddling pool. Buildable, but only on top of a Duck Ring. */
  isWater(lane: number, col: number): boolean {
    return this.water.has(cellIndex(lane, col));
  }

  /**
   * True where a toy needs something under it before it can go down.
   *
   * Two worlds answer yes, for what is really one rule at two scales: the
   * backyard's pool cells, and every last cell of the attic. Stated once here
   * rather than as two branches in `terrainAllows`, because the renderer and
   * the trial bots both need the same answer and a second copy of it would be
   * free to disagree.
   */
  needsSupport(lane: number, col: number): boolean {
    if (WORLDS[this.level.world].terrain === 'joists') return true;
    return this.isWater(lane, col);
  }

  /**
   * True where the bathroom's steam hides what is walking.
   *
   * Purely a question about SIGHT, and deliberately on `GameState` rather than
   * in the renderer even though nothing in the simulation reads it: the fog's
   * extent depends on the world and on which lanes hold a Fan, and both of
   * those are simulation state. A renderer that worked it out for itself would
   * be a second copy of the rule, free to disagree with this one.
   */
  isFogged(lane: number, col: number): boolean {
    if (WORLDS[this.level.world].terrain !== 'steam') return false;
    if (col < STEAM_FROM_COL) return false;
    return !this.laneIsClear(lane);
  }

  /**
   * True if this lane has no steam in it — because a Fan is holding it back,
   * or because this room does not have any steam to hold back.
   *
   * That second clause was missing, and the bug it caused shipped with world
   * three and survived four worlds: `drawSteam` has no idea which room it is
   * in, so it fogged the far columns of the BEDROOM and the BACKYARD too. It
   * went unnoticed because a soft gradient creeping in from the right reads as
   * afternoon light rather than as a fault — it only became obvious next to an
   * attic, where the same gradient sat on top of a deliberately dark room.
   *
   * Fixed here rather than at the call site so that every caller gets it. The
   * renderer asking "is this lane clear?" should not also have to know which
   * worlds have weather.
   */
  laneIsClear(lane: number): boolean {
    if (WORLDS[this.level.world].terrain !== 'steam') return true;
    for (let col = 0; col < COL_COUNT; col++) {
      const toy = this.toys.at(lane, col);
      if (toy && TOYS[toy.id].clearsFog) return true;
    }
    return false;
  }

  /**
   * Can the held card go here?
   *
   * Split out from `tryPlace` so the renderer can shade every legal cell the
   * moment a card is picked up. A child should be able to see where a toy is
   * allowed before committing a finger to it, not discover it by being refused.
   */
  canPlaceAt(lane: number, col: number): boolean {
    const id = this.selected;
    if (!id) return false;
    if (lane < 0 || lane >= LANE_COUNT || col < 0 || col >= COL_COUNT) return false;
    if (this.isBlocked(lane, col)) return false;
    if (!this.isReady(id)) return false;
    if (!this.canAfford(id)) return false;
    if (TOYS[id].role === 'instant') return true;
    if (!this.terrainAllows(id, lane, col)) return false;
    return this.toys.canPlace(id, lane, col);
  }

  /**
   * Place the held card. Returns true if it went down.
   *
   * A refusal costs nothing. Not one sparkle, not one second of cooldown — the
   * purse does not move. It emits a `deny` event instead, which becomes a red X
   * and a distinct sound. That sound is not decoration: a tap that produces
   * silence tells a five-year-old the game has stopped working, and she will
   * keep tapping the same wrong cell rather than trying a different one.
   */
  /**
   * The terrain rule for both worlds that have one, in three lines.
   *
   * A cell that needs support holds nothing until a float toy is in it; a float
   * toy is the one thing that CAN go there and the one thing that cannot go
   * anywhere else. Stated as two symmetric refusals rather than one, because
   * "you may not build here" and "this belongs on a shelf" are different
   * mistakes and the player has to be able to tell which one she made.
   *
   * The backyard applies it to a few wet cells and the attic to every cell in
   * the room. That difference is entirely in `needsSupport`, which is why the
   * attic cost one line of rule and not a new one.
   */
  private terrainAllows(id: ToyId, lane: number, col: number): boolean {
    const bare = this.needsSupport(lane, col);
    if (TOYS[id].layer === 'float') return bare;
    return !bare || this.toys.floatAt(lane, col) !== null;
  }

  tryPlace(lane: number, col: number): boolean {
    const id = this.selected;
    if (!id || !this.canPlaceAt(lane, col)) {
      this.denyFlash = FORGIVE.denyFlash;
      this.denyCell = lane >= 0 && col >= 0 ? cellIndex(lane, col) : -1;
      this.emit('deny', cellCentreX(Math.max(0, col)), laneCentreY(Math.max(0, lane)));
      return false;
    }

    const cost = this.costOf(id);
    const def = TOYS[id];
    this.purse -= cost;
    this.cooldowns.set(id, def.recharge);

    if (def.role === 'instant') {
      this.fireInstant(id, lane);
    } else {
      this.toys.place(id, lane, col, cost);
      // Only the most recent placement can be taken back. See `refund`.
      this.lastPlaced = cellIndex(lane, col);
      this.emit('place', cellCentreX(col), laneCentreY(lane), cost, lane);
    }

    this.selected = null;
    return true;
  }

  /**
   * Put a toy back in the toybox.
   *
   * Time-limited rather than free forever, because an unlimited undo turns
   * placement into a scratchpad and the economy into a suggestion. Full value
   * within eight seconds on EASY, 60% within four on the rest — long enough to
   * fix a fumble, short enough that it isn't a strategy.
   */
  /**
   * Take back the toy you have only just put down.
   *
   * ONLY the most recently placed one, and only inside the grace window. It
   * used to be any toy young enough, and that was a trap: a Glitter Jar makes
   * sparkles, so the most natural thing a five-year-old does is tap the jar to
   * collect from it — and tapping it deleted it. Reported as exactly that, and
   * it broke decision 7's promise that a mis-tap never costs anything, in the
   * worst possible way: the mis-tap cost a whole toy.
   *
   * Restricting it to the last placement keeps the feature doing its actual job
   * — "that went in the wrong cell, let me move it" is always about the thing
   * you just put down — and makes every other toy on the board inert to a tap.
   */
  refund(lane: number, col: number): boolean {
    if (this.lastPlaced !== cellIndex(lane, col)) return false;
    // `topOf` rather than ground-or-floor, so a Duck Ring or a Shelf can be
    // taken back too. It could not before, which was a real hole and a bad one
    // in the attic: laying a shelf in the wrong cell is the single most likely
    // fumble in that world, and it was the one placement with no undo.
    const toy = this.topOf(lane, col);
    if (!toy) return false;
    if (toy.age > this.difficulty.refundGraceSeconds) return false;
    const back = Math.round(toy.paid * this.difficulty.refundShare);
    this.purse += back;
    this.cooldowns.set(toy.id, 0);
    this.toys.remove(toy);
    this.lastPlaced = -1;
    this.emit('refund', cellCentreX(col), laneCentreY(lane), back, lane);
    return true;
  }

  /** Collect a sparkle at a tapped point. Returns what it was worth, or 0. */
  collectSparkleAt(x: number, y: number): number {
    const sparkle = this.sparkles.tapAt(x, y);
    if (!sparkle) return 0;
    sparkle.active = false;
    this.purse += sparkle.value;
    this.emit('collect', sparkle.x, sparkle.y, sparkle.value);
    return sparkle.value;
  }

  // --- Simulation -----------------------------------------------------------

  update(dt: number): void {
    if (this.phase !== 'playing') {
      this.decayShake(dt);
      return;
    }

    // Hitstop freezes everything, commands included. A frozen frame that still
    // accepted a placement would let a player act during a moment the game is
    // deliberately holding still to be looked at.
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.decayShake(dt);
      return;
    }

    this.elapsed += dt;
    this.decayShake(dt);
    this.tickTimers(dt);

    // Keep endless topped up BEFORE the runner looks at the list, so it never
    // sees a short one. Idempotent and cheap: almost every call is a length
    // comparison that returns immediately.
    this.growWaves?.(this.waves.index);

    this.waves.update(
      dt,
      this.enemies.count(),
      this.difficulty,
      this.rng,
      (kind, lane) => this.spawnEnemy(kind, lane),
      (big) => this.onWaveStart(big),
    );

    this.updateToys(dt);
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.sparkles.update(dt, this.difficulty.autoCollectSparkles, (sparkle) => {
      this.purse += sparkle.value;
      this.emit('collect', sparkle.x, sparkle.y, sparkle.value);
    });

    this.checkOutcome();
  }

  private tickTimers(dt: number): void {
    for (const [id, left] of this.cooldowns) {
      if (left > 0) this.cooldowns.set(id, Math.max(0, left - dt));
    }
    if (this.denyFlash > 0) {
      this.denyFlash = Math.max(0, this.denyFlash - dt);
      if (this.denyFlash === 0) this.denyCell = -1;
    }
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.laneFlash[lane]! > 0) this.laneFlash[lane] = Math.max(0, this.laneFlash[lane]! - dt);
    }
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.guardTimer[lane]! <= 0) continue;
      this.guardTimer[lane] = Math.max(0, this.guardTimer[lane]! - dt);
      if (this.guardTimer[lane] === 0) this.guardReady[lane] = true;
    }

    // The free trickle. Scaled by the WORLD only — a world can turn the lights
    // off and take the ambient income away, but a difficulty cannot, because
    // this is the anti-stranding floor and a floor that moves is not one.
    const interval = SPARKLE.trickleInterval / (WORLDS[this.level.world].trickleScale || 1);
    this.trickleTimer -= dt;
    if (this.trickleTimer <= 0) {
      this.trickleTimer += interval;
      // Above the board, in a random lane. Deliberately not at the unicorn:
      // the point of the trickle is to pull her eyes across the whole board.
      const lane = Math.floor(this.rng.next() * LANE_COUNT);
      const col = Math.floor(this.rng.next() * COL_COUNT);
      this.dropSparkle(cellCentreX(col), laneCentreY(lane) - 8, SPARKLE.trickleValue);
    }
  }

  private updateToys(dt: number): void {
    for (const toy of this.toys.ground) {
      if (!toy.active) continue;
      toy.age += dt;
      if (toy.hurt > 0) toy.hurt = Math.max(0, toy.hurt - dt);
      const def = TOYS[toy.id];

      if (def.produce) {
        toy.timer -= dt;
        if (toy.timer <= 0) {
          toy.timer += def.produce.interval * this.difficulty.sparkleIntervalScale;
          this.dropSparkle(cellCentreX(toy.col), laneCentreY(toy.lane) - 6, def.produce.value);
        }
        continue;
      }

      if (def.shoot) {
        // The timer holds at zero rather than going negative, so the first shot
        // at a kid who has just walked into range is immediate. A shooter that
        // makes you wait out a cooldown you couldn't see is a shooter that
        // looks broken.
        if (toy.timer > 0) toy.timer -= dt;
        if (toy.timer > 0) continue;
        if (this.fireAt(toy, def.shoot.lanes)) toy.timer = def.shoot.interval;
        continue;
      }

      // The magnet holds its charge exactly like a shooter holds its reload:
      // the timer only restarts when there was something to pull, so a wand
      // sitting in an empty lane is fully charged the instant armour arrives
      // rather than a random fraction of ten seconds away from being useful.
      if (def.magnet) {
        if (toy.timer > 0) toy.timer -= dt;
        if (toy.timer > 0) continue;
        if (this.pullArmour(toy, def.magnet)) toy.timer = def.magnet.interval;
      }
    }

    for (const toy of this.toys.float) {
      if (!toy.active) continue;
      toy.age += dt;
      if (toy.hurt > 0) toy.hurt = Math.max(0, toy.hurt - dt);
    }

    for (const toy of this.toys.floor) {
      if (!toy.active) continue;
      toy.age += dt;
      if (toy.hurt > 0) toy.hurt = Math.max(0, toy.hurt - dt);
    }
  }

  /**
   * Fire a shooter into every lane it covers that has something to shoot.
   *
   * Two passes rather than one, because a `volley` shooter still has to decide
   * WHETHER to fire on the ordinary rule — a lane with something in it — before
   * it fires into all three. A machine that shot at a completely clear board
   * would be a machine that spends its reload on nothing and is never charged
   * when the wave actually arrives, which is the exact bug the held-reload rule
   * exists to prevent. What `volley` changes is only what happens once the
   * answer is yes.
   */
  private fireAt(toy: Toy, laneSpan: number): boolean {
    const def = TOYS[toy.id].shoot!;
    const from = laneSpan > 1 ? toy.lane - 1 : toy.lane;
    const to = laneSpan > 1 ? toy.lane + 1 : toy.lane;
    const seesHidden = laneSpan > 1;
    let fired = false;

    if (def.volley) {
      let anything = false;
      for (let lane = from; lane <= to && !anything; lane++) {
        if (lane < 0 || lane >= LANE_COUNT) continue;
        anything = this.hasTargetIn(lane, cellCentreX(toy.col), def.kind, seesHidden);
      }
      if (!anything) return false;
    }

    for (let lane = from; lane <= to; lane++) {
      if (lane < 0 || lane >= LANE_COUNT) continue;
      if (!def.volley && !this.hasTargetIn(lane, cellCentreX(toy.col), def.kind, seesHidden)) {
        continue;
      }
      this.shots.fire(
        cellCentreX(toy.col) + 6,
        lane,
        def.damage,
        def.kind,
        def.speed,
        TOYS[toy.id].hitsAir,
        seesHidden,
        false,
        { slowFor: def.slowFor ?? 0, pierce: def.pierce ?? 0, arcs: def.arcs ?? false },
      );
      fired = true;
    }

    if (fired) this.emit('shoot', cellCentreX(toy.col), laneCentreY(toy.lane), 0, toy.lane);
    return fired;
  }

  /**
   * The Magnet Wand's pull. Returns true if it found something to take.
   *
   * It strips the armour and leaves the kid — a Wagon Kid with her shield
   * yanked off is still a Wagon Kid walking at you, which is the difference
   * between a support toy and a delete button. Nearest first, so a magnet
   * behind a queue helps with the queue's front rather than its back.
   *
   * Hiding does not protect you. A magnet does not need to see a bucket to
   * pull it, and the alternative — a Blanket Kid whose armour is safe until
   * she peeks — is a rule with no way of being noticed.
   */
  private pullArmour(toy: Toy, magnet: { lanes: number; range: number }): boolean {
    const fromX = cellCentreX(toy.col);
    const span = magnet.lanes > 1 ? (magnet.lanes - 1) / 2 : 0;
    const reach = magnet.range * CELL_W;
    let target: Enemy | null = null;
    for (const enemy of this.enemies.items) {
      if (!enemy.active || enemy.shield <= 0) continue;
      if (Math.abs(enemy.lane - toy.lane) > span) continue;
      const away = enemy.x - fromX;
      if (away < 0 || away > reach) continue;
      if (!target || enemy.x < target.x) target = enemy;
    }
    if (!target) return false;
    target.shield = 0;
    target.hurt = 0.14;
    this.emit('magnet', target.x, laneCentreY(target.lane), 0, target.lane);
    return true;
  }

  private hasTargetIn(lane: number, fromX: number, _kind: string, seesHidden: boolean): boolean {
    for (const enemy of this.enemies.items) {
      if (!enemy.active || enemy.lane !== lane) continue;
      if (enemy.x < fromX) continue;
      const def = ENEMIES[enemy.kind];
      if (def.aerial) continue; // caller re-checks per shot; ground toys can't reach
      if (enemy.concealed && !seesHidden) continue;
      return true;
    }
    // An air-capable toy also fires at floaters. Kept as a second pass rather
    // than a flag inside the loop so the common case stays a straight scan.
    for (const enemy of this.enemies.items) {
      if (!enemy.active || enemy.lane !== lane) continue;
      if (enemy.x < fromX) continue;
      if (!ENEMIES[enemy.kind].aerial) continue;
      return true;
    }
    return false;
  }

  private updateShots(dt: number): void {
    for (const shot of this.shots.items) {
      if (!shot.active) continue;
      shot.prevX = shot.x;
      shot.x += (shot.hostile ? -shot.speed : shot.speed) * dt;

      if (shot.hostile) {
        const col = colAtX(shot.x);
        if (col < 0) {
          shot.active = false;
          continue;
        }
        if (col >= COL_COUNT) continue;
        const toy = this.toys.at(shot.lane, col);
        if (toy) {
          this.destroyToy(toy);
          shot.active = false;
        }
        continue;
      }

      if (shot.x > cellCentreX(COL_COUNT - 1) + CELL_W) {
        shot.active = false;
        continue;
      }

      // A stack of boxes. Anything fired flat stops here; a lob goes over.
      //
      // The thud is emitted rather than swallowed on purpose. A player who has
      // built a Water Gun behind the boxes has to be able to SEE why it is
      // achieving nothing, and silence is the one answer a five-year-old reads
      // as "the game is broken" — decision 7. The shooter keeps firing and
      // keeps thudding until she moves it, which costs her nothing but noise.
      if (!shot.arcs) {
        const col = colAtX(shot.x);
        if (col >= 0 && col < COL_COUNT && this.isClutter(shot.lane, col)) {
          shot.active = false;
          this.emit('thud', shot.x, laneCentreY(shot.lane), 0, shot.lane);
          continue;
        }
      }

      // A Bubble Bath the shot is passing over. Checked BEFORE the hit test, so
      // a bubble that arrives at the bath and the kid on the same frame lands
      // at its boosted size — the alternative loses the boost precisely when a
      // kid is standing right on top of the toy you built it for.
      if (!shot.boosted) this.boostThrough(shot);

      let target: Enemy | null = null;
      for (const enemy of this.enemies.items) {
        if (!isTargetable(enemy, shot)) continue;
        if (Math.abs(enemy.x - shot.x) > enemyHalfWidth(enemy) + 4) continue;
        if (!target || enemy.x < target.x) target = enemy;
      }
      if (!target) continue;

      const result = applyDamage(target, shot.damage, shot.kind, this.difficulty);
      // A hit that lands leaves its chill even if it did no damage — being
      // immune to a Slushie's water should not also make you immune to cold.
      if (shot.slowFor > 0) target.slowFor = Math.max(target.slowFor, shot.slowFor);
      // Piercing shots carry on. Decremented rather than a boolean so a Beach
      // Ball has a stated number of kids in it and cannot mow down a whole
      // wave; the shot also has to move past this target, or it would hit the
      // same one again on the next step.
      if (shot.pierce > 0) {
        shot.pierce -= 1;
        shot.x = target.x - enemyHalfWidth(target) - 5;
      } else {
        shot.active = false;
      }
      if (result.shrugged && result.dealt <= 0) {
        this.emit('shrug', target.x, laneCentreY(target.lane), 0, target.lane);
      } else {
        this.emit('hit', shot.x, laneCentreY(shot.lane), result.dealt, shot.lane);
      }
      if (result.brokeShield) {
        this.emit('shield-break', target.x, laneCentreY(target.lane), 0, target.lane);
      }
      if (result.downed) this.downEnemy(target);
    }
  }

  /**
   * Make a shot bigger if it is flying over a Bubble Bath that likes its kind.
   *
   * The cell is found from where the shot IS rather than from the cells it has
   * crossed since last frame, which is safe only because the fastest shot in
   * the game moves 1.5px in a 1/120s step and a cell is 44px wide. If a shot
   * ever gets fast enough to skip a cell this has to become a sweep — a boost
   * that silently stops working for one toy is far worse than one that never
   * worked at all.
   */
  private boostThrough(shot: Shot): void {
    const col = colAtX(shot.x);
    if (col < 0 || col >= COL_COUNT) return;
    const toy = this.toys.at(shot.lane, col);
    if (!toy) return;
    const boost = TOYS[toy.id].boost;
    if (!boost || boost.kind !== shot.kind) return;
    shot.damage *= boost.multiply;
    shot.boosted = true;
    this.emit('boost', shot.x, laneCentreY(shot.lane), 0, shot.lane);
  }

  /**
   * Can a Squeaky Toy in `toy`'s cell send someone into this row?
   *
   * Not if that row has a squeaky toy of its own at the same column. That is
   * what stops two of them in adjacent rows batting a kid back and forth at a
   * hundred and twenty frames a second. With nowhere to send her the toy does
   * nothing at all and she eats it like any other wall, which is the correct
   * outcome: the player built two toys that cancel, and the game should show
   * her that rather than hide it behind a special case.
   */
  private divertableTo(toy: Toy, lane: number): boolean {
    if (lane < 0 || lane >= LANE_COUNT) return false;
    const neighbour = this.toys.at(lane, toy.col);
    return !neighbour || TOYS[neighbour.id].divert === undefined;
  }

  /**
   * Send a kid into a neighbouring row — the one nearer the MIDDLE of the
   * board — and take a bite out of the toy that did it.
   *
   * Inward, not randomly. Plants vs Zombies' Garlic picks a random neighbour
   * and that is fine there, because every lane in that game is the same lane.
   * It is not fine here: this game routinely asks whether a row is worth
   * defending at all — level 14 is entirely that question — so a coin flip can
   * deposit a kid in the row you deliberately gave up, and a toy that makes
   * things worse half the time is a toy nobody can learn.
   *
   * Heading for the middle makes it a tool: put frogs on the outside, build one
   * strong centre row, and everybody comes to you. It also states a rule a
   * five-year-old can watch happen, which random never does.
   *
   * A frog sitting ON the middle row has no inward direction, and that one case
   * stays a coin flip.
   */
  private divert(enemy: Enemy, toy: Toy, bite: number): boolean {
    const up = this.divertableTo(toy, toy.lane - 1);
    const down = this.divertableTo(toy, toy.lane + 1);
    if (!up && !down) return false;

    let to: number;
    if (up && down) {
      const towardUp = Math.abs(toy.lane - 1 - MIDDLE_LANE);
      const towardDown = Math.abs(toy.lane + 1 - MIDDLE_LANE);
      to =
        towardUp === towardDown
          ? this.rng.next() < 0.5
            ? toy.lane - 1
            : toy.lane + 1
          : towardUp < towardDown
            ? toy.lane - 1
            : toy.lane + 1;
    } else {
      to = up ? toy.lane - 1 : toy.lane + 1;
    }

    // The offset is measured from the OLD row, so she slides across from where
    // she was rather than appearing part-way and drifting.
    enemy.laneShift = (enemy.lane - to) * CELL_H;
    enemy.lane = to;
    this.emit('divert', enemy.x, laneCentreY(to), 0, to);

    toy.hp -= bite;
    toy.hurt = 0.2;
    if (toy.hp <= 0) this.destroyToy(toy);
    return true;
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies.items) {
      if (!enemy.active) continue;
      enemy.prevX = enemy.x;
      if (enemy.hurt > 0) enemy.hurt = Math.max(0, enemy.hurt - dt);
      const def = ENEMIES[enemy.kind];

      if (def.behaviour === 'throws') this.updateThrower(enemy, dt);

      // The slide across after being sent into another row. Purely visual, and
      // decayed here rather than in the renderer so it keeps step with the
      // simulation clock through hitstop and pauses.
      if (enemy.laneShift !== 0) {
        const step = (CELL_H / LANE_SHIFT_SECONDS) * dt;
        enemy.laneShift =
          enemy.laneShift > 0
            ? Math.max(0, enemy.laneShift - step)
            : Math.min(0, enemy.laneShift + step);
      }

      // Grab the toy directly in front, if there is one. Floaters never do.
      enemy.grabbing = false;
      if (!def.aerial) {
        const frontCol = colAtX(enemy.x - enemyHalfWidth(enemy));
        if (frontCol >= 0 && frontCol < COL_COUNT) {
          // ONLY the ground layer. A bare Shelf or Duck Ring is floor, and kids
          // walk over floor.
          //
          // They used to stop and pull it up, which was wrong twice over. It
          // looked wrong — a child tearing up floorboards to get at a unicorn —
          // and it was quietly the best wall in the game: a Shelf is 400 health
          // for 25 sparkles, sixteen per sparkle against a Pillow Fort's eight
          // and a Sand Castle's nine and a half. Since it is also the attic's
          // prerequisite you always have a stack of them, so both actual wall
          // toys were pointless in two of the four worlds.
          //
          // Reported as a kid who destroyed a Glitter Jar and then "kept trying
          // to break the glitter that was left" — which was the shelf under it,
          // taking another twenty-five seconds. A toy standing on a float is
          // still chewed normally; what survives is the floor it stood on, and
          // that is the point of paying for the cell once.
          const toy = this.toys.at(enemy.lane, frontCol);
          const bite = toy ? TOYS[toy.id].divert?.bite : undefined;
          if (toy && bite !== undefined && this.divert(enemy, toy, bite)) {
            // Diverted: she does not stop, and she does not chew. She has found
            // something better to do and is already on her way to the next row.
          } else if (toy) {
            enemy.grabbing = true;
            // Stopping to pull at something takes both hands, so whatever you
            // were hiding under is off. Not a flourish — it closes a dead end.
            //
            // The peek rule below reveals a hidden kid at the halfway column,
            // which assumes she keeps walking. A Blanket Kid who parks at
            // column eight chewing on a toy never reaches halfway, and if a
            // stack of boxes also stops the spray that could otherwise find
            // her, nothing in the row can ever touch her: she sits there being
            // rebuilt into forever. A trial bot did exactly that for 420
            // simulated seconds on level 35 with 2,553 sparkles in the purse.
            //
            // Making the grab reveal her is the general fix, and it improves
            // the kid rather than nerfing her: she is untargetable while she is
            // coming, and targetable the moment she stops — which is the moment
            // you most want to shoot her anyway.
            enemy.concealed = false;
            toy.hp -= def.grabDps * dt;
            toy.hurt = 0.12;
            if (toy.hp <= 0) this.destroyToy(toy);
            else this.emit('toy-hurt', cellCentreX(toy.col), laneCentreY(toy.lane), 0, toy.lane);
          }
        }
      }

      if (enemy.slowFor > 0) enemy.slowFor = Math.max(0, enemy.slowFor - dt);

      if (!enemy.grabbing) {
        let factor = 1;
        if (!def.ignoresSlow && !def.aerial) {
          const col = colAtX(enemy.x);
          if (col >= 0 && col < COL_COUNT) {
            const floor = this.toys.floorAt(enemy.lane, col);
            if (floor) factor = TOYS[floor.id].slow?.factor ?? 1;
          }
        }
        // A Slushie's chill. It stacks with slime by taking the WORSE of the
        // two rather than multiplying: two slows that compound turn a Sock
        // Slider into a statue, and the fastest kid in the game standing still
        // is not a fight, it is a pause.
        if (enemy.slowFor > 0 && !def.ignoresSlow) factor = Math.min(factor, SLUSH_FACTOR);
        enemy.x -= enemySpeed(enemy.kind, this.difficulty.enemySpeedScale) * factor * dt;
      }

      const col = colAtX(enemy.x);
      if (col < enemy.deepestCol) enemy.deepestCol = col;
      if (col < this.deepestCol) this.deepestCol = col;

      // Halfway across, a hiding kid peeks out to see how close she is — and
      // stops being untargetable.
      //
      // Without this, a Blanket Kid can only ever be hurt by an area toy or an
      // instant, and on the level that introduces her that means the Sprinkler
      // at 125 sparkles or nothing. A child who hasn't bought one yet watches
      // her walk the whole board while every gun she owns declines to fire.
      // That isn't a lesson, it's a trap. Peeking keeps the lesson — light her
      // up EARLY or she gets close — and removes the dead end.
      // No event: the mound turning into a kid IS the notification, and a sound
      // for it would fire in the middle of whatever else that lane is doing.
      if (enemy.concealed && col <= HALFWAY_COL) enemy.concealed = false;

      if (enemy.x <= squeezeX()) {
        // The bear goes first. He clears the WHOLE lane rather than just this
        // kid, because a lane that has been overrun has more than one kid in it
        // and a save that leaves the next one two steps from the cushion is not
        // a save.
        if (this.guardReady[enemy.lane]) {
          this.guardReady[enemy.lane] = false;
          if (Number.isFinite(this.difficulty.guardRechargeSeconds)) {
            this.guardTimer[enemy.lane] = this.difficulty.guardRechargeSeconds;
          }
          this.fireInstant('sweeper', enemy.lane);
          this.shake = JUICE.squeezeShake * 0.6;
          continue;
        }
        enemy.active = false;
        this.lives -= 1;
        this.shake = JUICE.squeezeShake;
        this.emit('squeeze', enemy.x, laneCentreY(enemy.lane), this.lives, enemy.lane);
      }
    }
  }

  /**
   * The Big Kid's thrown stuffie.
   *
   * A real projectile rather than an instant "the frontmost toy is gone",
   * because you can watch it fly and you can lose a toy you were about to lose
   * anyway rather than one that vanished. He also holds his throw when nothing
   * is in range, so the timer isn't wasted on an empty lane.
   */
  private updateThrower(enemy: Enemy, dt: number): void {
    enemy.actionTimer -= dt;
    if (enemy.actionTimer > 0) return;
    const fromCol = colAtX(enemy.x);
    for (let col = Math.min(fromCol, COL_COUNT - 1); col >= Math.max(0, fromCol - 3); col--) {
      if (!this.toys.at(enemy.lane, col)) continue;
      this.shots.fire(enemy.x, enemy.lane, 0, 'none', 90, false, true, true);
      this.emit('throw', enemy.x, laneCentreY(enemy.lane), 0, enemy.lane);
      enemy.actionTimer = 6;
      return;
    }
    // Nothing to hit. Check again shortly rather than burning the full six
    // seconds, so he punishes a rebuild promptly.
    enemy.actionTimer = 1;
  }

  private fireInstant(id: ToyId, lane: number): void {
    const def = TOYS[id].instant!;
    const from = def.lanes > 1 ? lane - 1 : lane;
    const to = def.lanes > 1 ? lane + 1 : lane;

    for (let target = from; target <= to; target++) {
      if (target < 0 || target >= LANE_COUNT) continue;
      this.laneFlash[target] = WAVE.flashSeconds;
      for (const enemy of this.enemies.items) {
        if (!enemy.active || enemy.lane !== target) continue;
        if (def.reveals) enemy.concealed = false;
        if (ENEMIES[enemy.kind].aerial && !TOYS[id].hitsAir) continue;
        const result = applyDamage(enemy, def.damage, def.kind, this.difficulty);
        if (result.downed) this.downEnemy(enemy);
      }
    }

    const type: GameEventType =
      id === 'nightlight' ? 'nightlight' : id === 'sweeper' ? 'sweeper' : 'powder';
    this.emit(type, cellCentreX(0), laneCentreY(lane), 0, lane);
  }

  private spawnEnemy(kind: EnemyKind, lane: number): void {
    const ramp = this.toughness?.(this.waves.index) ?? 1;
    const enemy = this.enemies.spawn(kind, lane, this.difficulty.enemyHpScale * ramp);
    if (!enemy) return;
    // Bosses hold their first throw, so the entrance isn't also an ambush.
    if (ENEMIES[kind].behaviour === 'throws') enemy.actionTimer = 6;
  }

  private onWaveStart(big: boolean): void {
    this.emit(big ? 'big-wave' : 'wave', 0, 0, this.waves.index + 1);
    if (!big) return;
    for (let lane = 0; lane < LANE_COUNT; lane++) this.laneFlash[lane] = WAVE.flashSeconds;
  }

  private downEnemy(enemy: Enemy): void {
    enemy.active = false;
    this.purse += ENEMIES[enemy.kind].bounty;
    this.emit(
      'down',
      enemy.x,
      laneCentreY(enemy.lane),
      ENEMIES[enemy.kind].bounty,
      enemy.lane,
    );
  }

  private destroyToy(toy: Toy): void {
    const lane = toy.lane;
    const col = toy.col;
    const wasFloat = TOYS[toy.id].layer === 'float';
    this.toys.remove(toy);
    this.toysLost += 1;
    this.emit('toy-lost', cellCentreX(col), laneCentreY(lane), 0, lane);

    // A float going under takes whatever was standing on it: leaving a Water Gun
    // hovering over open water would be the one place in the game where a toy
    // sits somewhere it could never have been placed.
    //
    // Currently unreachable, and deliberately kept. Nothing damages a float any
    // more — kids walk over bare floor and the Big Kid's stuffie only looks at
    // the ground layer — so in practice a Duck Ring or a Shelf now lasts until
    // it is swept. The day something can hurt one, this is the rule it has to
    // obey, and rediscovering it by watching a gun float on open water would be
    // a worse afternoon than leaving five lines here.
    if (wasFloat) {
      const above = this.toys.at(lane, col);
      if (above) this.destroyToy(above);
      const below = this.toys.floorAt(lane, col);
      if (below) this.destroyToy(below);
    }
  }

  private dropSparkle(x: number, y: number, value: number): void {
    const sparkle = this.sparkles.drop(x, y, value);
    if (sparkle) this.emit('drop', x, y, value);
  }

  private checkOutcome(): void {
    if (this.lives <= 0) {
      this.phase = 'lost';
      this.hitstop = JUICE.loseHitstop;
      this.emit('lose', 0, 0, 0);
      return;
    }
    if (this.waves.spawnedEverything && this.enemies.count() === 0) {
      this.phase = 'won';
      this.emit('win', 0, 0, this.result().stars);
    }
  }

  private decayShake(dt: number): void {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - JUICE.shakeDecay * dt);
  }

  // --- Events ---------------------------------------------------------------

  private emit(type: GameEventType, x = 0, y = 0, value = 0, lane = 0): void {
    if (this.eventCount >= POOL.events) return;
    const event = this.events[this.eventCount]!;
    event.type = type;
    event.x = x;
    event.y = y;
    event.value = value;
    event.lane = lane;
    this.eventCount += 1;
  }

  drainEvents(consume: (event: GameEvent) => void): void {
    for (let i = 0; i < this.eventCount; i++) consume(this.events[i]!);
    this.eventCount = 0;
  }
}

// --- Design contracts -------------------------------------------------------

/**
 * The fairness guarantees the whole game is tuned around, checked as pure
 * arithmetic over the config on every page load.
 *
 * Three things make this worth the code it costs:
 *
 *  - Every check runs **per level and per difficulty**. That is precisely the
 *    axis where a change looks fine on NORMAL and quietly makes HARD
 *    impossible, and it is not an axis anybody play-tests exhaustively.
 *  - Every check is computed against `level.recommended`, not the full roster.
 *    A guarantee about optimal play is a guarantee about nobody.
 *  - Every message says what it measured, in the units the designer thinks in.
 *    "level 8 HARD: the cheapest damage toy lands 190 of the 273 it needs" is
 *    actionable; "contract 6 failed" is a scavenger hunt.
 *
 * Adding a level or a kid earns it all of these automatically. That is the
 * single biggest reason a fifty-level campaign is a data edit.
 */
export function validateDesignContracts(): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) problems.push(message);
  };

  // --- Global, difficulty by difficulty ---
  for (const id of DIFFICULTY_ORDER) {
    const difficulty = DIFFICULTIES[id];
    const label = difficulty.label;

    const cheapestDefender = Math.min(
      ...Object.values(TOYS)
        .filter((toy) => toyDealsDamage(toy.id) && toy.cost > 0)
        .map((toy) => Math.round(toy.cost * difficulty.toyCostScale)),
    );
    // Counted as DISCRETE DROPS, not as a rate. `TRICKLE_RATE * 35` says 58
    // where the game actually pays 60, and the version of this check that used
    // the rate passed while the trial that counts real drops failed. When the
    // arithmetic and the simulation disagree, the arithmetic is what's wrong.
    const drops = Math.floor((STUCK_SECONDS - SPARKLE.trickleFirstDelay) / SPARKLE.trickleInterval) + 1;
    const paid = drops * SPARKLE.trickleValue;
    check(
      paid >= cheapestDefender,
      `${label}: a wiped-out player is stranded — the free trickle pays ${drops} drops (${paid}) in ${STUCK_SECONDS}s and the cheapest defender costs ${cheapestDefender}`,
    );

    const rest = Math.max(WAVE.minRest, WAVE.baseRest * difficulty.waveRestScale);
    check(
      rest >= WAVE.minRest,
      `${label}: rest between waves is ${rest.toFixed(1)}s, below the ${WAVE.minRest}s floor`,
    );

    // The sparkle economy has to survive the player looking somewhere else.
    const producerInterval = TOYS.jar.produce!.interval * difficulty.sparkleIntervalScale;
    check(
      SPARKLE.lifetime > producerInterval * 2,
      `${label}: a sparkle expires in ${SPARKLE.lifetime}s but a jar takes ${(
        producerInterval * 2
      ).toFixed(1)}s to drop two — income is lost to looking at another lane`,
    );
  }

  // --- The verb toys, which are only worth a slot next to something else ---
  //
  // None of these three deals damage, so every existing contract is blind to
  // them: a level could deal a Bubble Bath and no bubbles, or a Magnet Wand in
  // a level with nothing armoured in it, and every other check would pass while
  // the card sat in the tray doing nothing. A dead card is worse than a missing
  // one — it costs a slot AND teaches that the toy is useless.
  for (const toy of Object.values(TOYS)) {
    if (toy.boost) {
      const kind = toy.boost.kind;
      check(
        Object.values(TOYS).some((other) => other.shoot?.kind === kind),
        `${toy.name} makes ${kind} shots bigger and nothing in the game fires ${kind}`,
      );
      check(
        toy.boost.multiply > 1,
        `${toy.name} multiplies ${kind} by ${toy.boost.multiply} — that is not a boost`,
      );
    }
    if (toy.divert) {
      // Two kids minimum, or it is a 75-sparkle way of moving one child one row.
      check(
        toy.hp / toy.divert.bite >= 2,
        `${toy.name} has ${toy.hp} health and loses ${toy.divert.bite} per kid, so it redirects ${Math.floor(
          toy.hp / toy.divert.bite,
        )} — a one-use toy needs to be an instant`,
      );
    }
    if (toy.magnet) {
      check(
        Object.values(ENEMIES).some((enemy) => enemy.shield !== undefined),
        `${toy.name} strips armour and no kid in the game wears any`,
      );
    }
  }

  // --- Level by level, difficulty by difficulty ---
  for (const level of LEVELS) {
    // A verb toy is only a card if the thing it acts on is in the same hand.
    for (const id of level.recommended) {
      const boost = TOYS[id].boost;
      if (boost) {
        check(
          level.recommended.some((other) => TOYS[other].shoot?.kind === boost.kind),
          `level ${level.id} deals a ${TOYS[id].name} and nothing that fires ${boost.kind} — the card cannot do anything`,
        );
      }
      if (TOYS[id].magnet) {
        check(
          enemiesIn(level).some((kind) => ENEMIES[kind].shield !== undefined),
          `level ${level.id} deals a ${TOYS[id].name} and no kid in it wears armour — the card cannot do anything`,
        );
      }
      if (TOYS[id].divert) {
        // Somewhere to send them. One open lane is a squeaky toy that squeaks.
        check(
          LANE_COUNT >= 2,
          `level ${level.id} deals a ${TOYS[id].name} on a ${LANE_COUNT}-lane board`,
        );
      }
    }

    // A level cannot deal more cards than the tray holds at that point in the
    // campaign. The slot count grows at world boundaries, so this is the one
    // contract that would otherwise only fail for a player far enough in to
    // reach the level — which is to say, never during development.
    const slots = loadoutSlotsFor(level.id);
    check(
      level.recommended.length <= slots,
      `level ${level.id} deals ${level.recommended.length} cards but the tray holds ${slots} there`,
    );

    // A world with no floor has to deal the thing that makes a floor. Without
    // it the level is not hard, it is inert: not one toy can be placed in any
    // cell, and the only contract that would have noticed is this one.
    if (WORLDS[level.world].terrain === 'joists') {
      check(
        level.recommended.some((id) => TOYS[id].layer === 'float'),
        `level ${level.id} is in ${WORLDS[level.world].name}, which has no floor, and deals nothing that makes one — no toy can be placed at all`,
      );
    }

    const kinds = enemiesIn(level);
    const damageToys = level.recommended.filter(toyDealsDamage);

    check(
      level.recommended.length > 0,
      `level ${level.id}: deals no cards at all`,
    );
    check(
      damageToys.length >= 1,
      `level ${level.id}: the recommended loadout contains nothing that deals damage`,
    );
    check(
      level.recommended.some((id) => TOYS[id].produce !== undefined),
      `level ${level.id}: the recommended loadout has no producer, so the level is capped at the free trickle`,
    );

    // Every kid must have an answer, and a kid with a TWIST must have a spare —
    // unless this is the level that introduces it, where having exactly one
    // answer is the lesson rather than an oversight.
    for (const kind of kinds) {
      const answers = answersIn(level.recommended, kind);
      const def = ENEMIES[kind];
      const hasTwist =
        def.immuneTo !== undefined ||
        def.resist !== undefined ||
        def.aerial === true ||
        def.hidden === true ||
        def.ignoresSlow === true ||
        def.shield !== undefined ||
        def.behaviour !== undefined;
      const introducing = firstAppearance(kind) === level.id;
      check(
        answers.length >= 1,
        `level ${level.id}: ${def.name} has NO answer in the recommended loadout — the level is unwinnable`,
      );
      check(
        !hasTwist || introducing || answers.length >= 2,
        `level ${level.id}: ${def.name} has only ${answers.length} answer (${answers.join(
          ', ',
        )}) and was introduced back on level ${firstAppearance(kind)} — a kid with a twist needs a spare`,
      );
    }

    // Pools have to cover the worst case this level's own content can produce.
    let biggestWave = 0;
    for (const wave of level.waves) biggestWave = Math.max(biggestWave, wave.beats.length);
    check(
      POOL.enemies >= biggestWave * 2,
      `level ${level.id}: pool holds ${POOL.enemies} kids but two overlapping waves of ${biggestWave} need ${
        biggestWave * 2
      }`,
    );

    // Every cell a wave uses has to be reachable, and every lane a beat names
    // has to actually be open. A beat in a lane that is entirely furniture is a
    // kid that walks the whole board unopposed.
    // Boxes count as furniture here. They are a different thing on the board —
    // a shot stops at one — but for "is there anywhere at all to build in this
    // row", a stack of boxes and a chest of drawers are the same answer.
    const unbuildable = new Set([...level.blocked, ...(level.clutter ?? [])]);
    const openLanes = new Set<number>();
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let col = 0; col < COL_COUNT; col++) {
        if (!unbuildable.has(cellIndex(lane, col))) {
          openLanes.add(lane);
          break;
        }
      }
    }
    for (const wave of level.waves) {
      for (const beat of wave.beats) {
        check(
          openLanes.has(beat.lane),
          `level ${level.id}: a ${ENEMIES[beat.kind].name} spawns in lane ${beat.lane}, which is entirely furniture — nothing can be built in its way`,
        );
      }
    }

    for (const id of DIFFICULTY_ORDER) {
      const difficulty = DIFFICULTIES[id];
      const label = `level ${level.id} ${difficulty.label}`;

      // Opening hand: one producer plus one defender, out of the gate.
      const purse = level.startSparkles + difficulty.startSparkleBonus;
      const producers = level.recommended.filter((toy) => TOYS[toy].produce !== undefined);
      const cheapestProducer = Math.min(
        ...producers.map((toy) => Math.round(TOYS[toy].cost * difficulty.toyCostScale)),
      );
      const cheapestDefender = Math.min(
        ...damageToys.map((toy) => Math.round(TOYS[toy].cost * difficulty.toyCostScale)),
      );
      check(
        purse >= cheapestProducer + cheapestDefender,
        `${label}: opens with ${purse} sparkles but a producer plus a defender costs ${
          cheapestProducer + cheapestDefender
        } — the first choice is not a choice`,
      );

      // The kill guarantee.
      //
      // The model of a player: she finds the BEST answer her loadout has to a
      // kid, and she builds a few of them in that lane, proportional to how
      // alarming the kid is — two for anything ordinary, up to five for a boss.
      // They fight it across the full width of the board, and they only land
      // KILL_SAFETY of their theoretical damage, because a real player places
      // late and a real shot misses the last frame.
      //
      // Modelling TWO rather than one matters. One toy per lane is not how
      // anybody plays a lane defence, and a contract written against a player
      // who doesn't exist fails on levels that are fine and passes on levels
      // that aren't.
      const approach = cellCentreX(COL_COUNT - 1) - cellCentreX(0) + CELL_W;

      // How far down a row a FLAT shot reaches once there are boxes in it.
      //
      // The model of the player everywhere in this function is that she builds
      // a few copies of the best answer at the BACK of a lane — which is what
      // both trial bots do and what a lane defence teaches. Under that model a
      // stack of boxes caps her coverage at the boxes, and the kid walks
      // everything beyond them untouched.
      //
      // The binding stack is therefore the one NEAREST the unicorn, not the
      // furthest away — the first shot to leave a gun dies at the first stack
      // it meets, and everything behind that one is irrelevant. Written the
      // other way round at first, which had it exactly backwards: it made a
      // stack at column three look harmless when a stack at column three is the
      // worst place on the board for one, and a stack at column eight look
      // ruinous when a stack at column eight costs nothing at all.
      let nearestBoxes = COL_COUNT;
      for (const cell of level.clutter ?? []) {
        nearestBoxes = Math.min(nearestBoxes, cell % COL_COUNT);
      }
      const pastBoxes =
        nearestBoxes < COL_COUNT ? cellCentreX(nearestBoxes) - cellCentreX(0) + CELL_W : approach;

      // A Magnet Wand in the hand means the armour is not part of the problem.
      // Without this the contract charges a Wagon Kid's 150-point shield to a
      // loadout that is holding the card whose entire job is taking it off, and
      // the only way to satisfy it would be to delete the toy that solves it.
      const strips = level.recommended.some((id) => TOYS[id].magnet !== undefined);

      for (const kind of kinds) {
        const answers = answersIn(level.recommended, kind);
        if (answers.length === 0) continue; // already reported by the check above
        const armour = strips ? 0 : (ENEMIES[kind].shield ?? 0);
        const needed = (ENEMIES[kind].hp + armour) * difficulty.enemyHpScale;
        const copies = Math.min(5, Math.max(2, Math.ceil(needed / 120)));
        const speed = enemySpeed(kind, difficulty.enemySpeedScale);

        // Per answer rather than "the highest dps answer", because with boxes
        // on the board those are different questions: a Water Gun out-damages
        // a Bath Toy Lobber everywhere except the row it cannot shoot down.
        // Ranking on damage alone would pick the gun and then measure it over
        // a walk it never gets, which is how a level looks fine and is not.
        let landed = 0;
        let seconds = 0;
        let best: ToyId | null = null;
        for (const toy of answers) {
          const def = TOYS[toy];
          const rate = def.shoot
            ? def.shoot.damage / def.shoot.interval
            : (def.instant?.damage ?? 0) / Math.max(1, def.recharge);
          // An instant empties the whole row whatever is stacked in it, and a
          // lob goes over. Only a flat shooter pays the boxes.
          const reach = !def.shoot || def.shoot.arcs ? approach : pastBoxes;
          const walk = reach / speed;
          const total = rate * copies * walk * KILL_SAFETY;
          if (total > landed) {
            landed = total;
            seconds = walk;
            best = toy;
          }
        }

        check(
          landed >= needed * KILL_MARGIN,
          `${label}: ${copies}x the best answer (${
            best ? TOYS[best].name : '?'
          }) lands ${landed.toFixed(0)} over a ${ENEMIES[kind].name}'s ${seconds.toFixed(
            1,
          )}s walk${
            nearestBoxes < COL_COUNT && seconds < approach / speed
              ? ` (cut short by the boxes at column ${nearestBoxes})`
              : ''
          }, and it needs ${(needed * KILL_MARGIN).toFixed(0)}${
            strips && ENEMIES[kind].shield ? ' with the shield magnetted off' : ''
          }`,
        );
      }

      // A panic button you can only press once in a level is not a panic
      // button, it is a cutscene. Three uses over the level's worst-case
      // duration is the bar — enough that reaching for it is a decision rather
      // than a hoarding problem.
      const rest = Math.max(WAVE.minRest, WAVE.baseRest * difficulty.waveRestScale);
      let levelSeconds = (level.waves.length - 1) * rest;
      for (const wave of level.waves) levelSeconds += wave.timeout;
      for (const toy of level.recommended) {
        if (TOYS[toy].role !== 'instant') continue;
        check(
          TOYS[toy].recharge * 3 <= levelSeconds,
          `${label}: ${TOYS[toy].name} recharges in ${TOYS[toy].recharge}s, so it is usable ${Math.floor(
            levelSeconds / TOYS[toy].recharge,
          )} times in a ${levelSeconds.toFixed(0)}s level — a panic button needs at least three`,
        );
      }
    }
  }

  // --- Level one is nearly unloseable ---
  const one = LEVELS[0]!;
  for (const id of DIFFICULTY_ORDER) {
    const difficulty = DIFFICULTIES[id];
    const wandDps = TOYS.wand.shoot!.damage / TOYS.wand.shoot!.interval;
    const approach = cellCentreX(COL_COUNT - 1) - cellCentreX(0) + CELL_W;
    const seconds = approach / enemySpeed('crawler', difficulty.enemySpeedScale);
    const landed = wandDps * seconds;
    const needed = ENEMIES.crawler.hp * difficulty.enemyHpScale;
    check(
      landed >= needed * 4,
      `level 1 ${difficulty.label}: one Bubble Wand lands ${landed.toFixed(
        0,
      )} on a Crawler that has ${needed.toFixed(
        0,
      )} — the first level is supposed to be almost impossible to lose`,
    );
  }
  check(
    one.recommended.length === 2,
    `level 1 deals ${one.recommended.length} cards; the first level should be two`,
  );

  // --- Layout: no card may be drawn over a cell ---
  check(
    BOARD_TOP >= 0 && BOARD_TOP + LANE_COUNT * CELL_H <= 270,
    `the board runs from y=${BOARD_TOP} to y=${BOARD_TOP + LANE_COUNT * CELL_H}, outside the frame`,
  );

  return problems;
}
