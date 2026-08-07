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
  SLUSH_FACTOR,
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
import { applyDamage, isTargetable, ShotPool, enemyHalfWidth } from './combat';
import { SparkleField } from './economy';
import {
  COL_BEYOND_BOARD,
  ENEMIES,
  EnemyField,
  answersIn,
  bestAnswerDps,
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
 */
export type Phase = 'title' | 'select' | 'loadout' | 'guide' | 'playing' | 'won' | 'lost';

export type GameEventType =
  | 'place'
  | 'deny'
  | 'refund'
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
  private blocked = new Set<number>();
  /** Paddling-pool cells. Empty outside a `pool` world. See `isWater`. */
  private water = new Set<number>();

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

  start(level: Level, difficultyId: DifficultyId, loadout: readonly ToyId[], seed: number): void {
    this.level = level;
    this.difficulty = DIFFICULTIES[difficultyId];
    this.rng = new Rng(seed);
    this.loadout = [...loadout];

    this.toys.reset();
    this.enemies.reset();
    this.shots.reset();
    this.sparkles.reset();

    this.blocked = new Set(level.blocked);
    this.water = new Set(WORLDS[level.world].terrain === 'pool' ? (level.water ?? []) : []);
    this.purse = level.startSparkles + this.difficulty.startSparkleBonus;
    this.lives = SQUEEZE_LIVES;
    this.elapsed = 0;
    this.selected = null;
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
    if (id === null) {
      this.selected = null;
      return;
    }
    if (!this.loadout.includes(id)) return;
    this.selected = this.selected === id ? null : id;
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

  isBlocked(lane: number, col: number): boolean {
    return this.blocked.has(cellIndex(lane, col));
  }

  /** Paddling pool. Buildable, but only on top of a Duck Ring. */
  isWater(lane: number, col: number): boolean {
    return this.water.has(cellIndex(lane, col));
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
   * The paddling pool rule, and the only thing that makes the backyard a
   * different game rather than a different picture.
   *
   * Water holds nothing until a Duck Ring floats on it; a ring is the one thing
   * that CAN go there and the one thing that cannot go anywhere else. Stated as
   * two symmetric refusals rather than one, because "you may not build here"
   * and "this belongs in the water" are different mistakes and the player has
   * to be able to tell which one she made.
   */
  private terrainAllows(id: ToyId, lane: number, col: number): boolean {
    const wet = this.isWater(lane, col);
    if (TOYS[id].layer === 'float') return wet;
    return !wet || this.toys.floatAt(lane, col) !== null;
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
  refund(lane: number, col: number): boolean {
    const toy = this.toys.at(lane, col) ?? this.toys.floorAt(lane, col);
    if (!toy) return false;
    if (toy.age > this.difficulty.refundGraceSeconds) return false;
    const back = Math.round(toy.paid * this.difficulty.refundShare);
    this.purse += back;
    this.cooldowns.set(toy.id, 0);
    this.toys.remove(toy);
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

  /** Fire a shooter into every lane it covers that has something to shoot. */
  private fireAt(toy: Toy, laneSpan: number): boolean {
    const def = TOYS[toy.id].shoot!;
    const from = laneSpan > 1 ? toy.lane - 1 : toy.lane;
    const to = laneSpan > 1 ? toy.lane + 1 : toy.lane;
    const seesHidden = laneSpan > 1;
    let fired = false;

    for (let lane = from; lane <= to; lane++) {
      if (lane < 0 || lane >= LANE_COUNT) continue;
      if (!this.hasTargetIn(lane, cellCentreX(toy.col), def.kind, seesHidden)) continue;
      this.shots.fire(
        cellCentreX(toy.col) + 6,
        lane,
        def.damage,
        def.kind,
        def.speed,
        TOYS[toy.id].hitsAir,
        seesHidden,
        false,
        { slowFor: def.slowFor ?? 0, pierce: def.pierce ?? 0 },
      );
      fired = true;
    }

    if (fired) this.emit('shoot', cellCentreX(toy.col), laneCentreY(toy.lane), 0, toy.lane);
    return fired;
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

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies.items) {
      if (!enemy.active) continue;
      enemy.prevX = enemy.x;
      if (enemy.hurt > 0) enemy.hurt = Math.max(0, enemy.hurt - dt);
      const def = ENEMIES[enemy.kind];

      if (def.behaviour === 'throws') this.updateThrower(enemy, dt);

      // Grab the toy directly in front, if there is one. Floaters never do.
      enemy.grabbing = false;
      if (!def.aerial) {
        const frontCol = colAtX(enemy.x - enemyHalfWidth(enemy));
        if (frontCol >= 0 && frontCol < COL_COUNT) {
          // The ring counts as something to pull at, so a lone Duck Ring is not
          // an invisible wall a kid walks straight through.
          const toy = this.toys.at(enemy.lane, frontCol) ?? this.toys.floatAt(enemy.lane, frontCol);
          if (toy) {
            enemy.grabbing = true;
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
    const enemy = this.enemies.spawn(kind, lane, this.difficulty.enemyHpScale);
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

    // A ring going under takes whatever was standing on it. Leaving a Water Gun
    // hovering over open water would be the one place in the game where a toy
    // sits somewhere it could never have been placed, and the alternative —
    // making the ring indestructible — turns the pool lanes into the safest
    // ones on the board rather than the most expensive.
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

  // --- Level by level, difficulty by difficulty ---
  for (const level of LEVELS) {
    const kinds = enemiesIn(level);
    const damageToys = level.recommended.filter(toyDealsDamage);

    check(
      level.recommended.length > 0 && level.recommended.length <= 5,
      `level ${level.id}: deals ${level.recommended.length} cards; the tray holds five`,
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
    const openLanes = new Set<number>();
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let col = 0; col < COL_COUNT; col++) {
        if (!level.blocked.includes(cellIndex(lane, col))) {
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
      for (const kind of kinds) {
        const dps = bestAnswerDps(level.recommended, kind);
        if (dps <= 0) continue; // already reported by the no-answer check above
        const needed = (ENEMIES[kind].hp + (ENEMIES[kind].shield ?? 0)) * difficulty.enemyHpScale;
        const copies = Math.min(5, Math.max(2, Math.ceil(needed / 120)));
        const speed = enemySpeed(kind, difficulty.enemySpeedScale);
        const seconds = approach / speed;
        const landed = dps * copies * seconds * KILL_SAFETY;
        const best = answersIn(level.recommended, kind)[0];
        check(
          landed >= needed * KILL_MARGIN,
          `${label}: ${copies}x the best answer (${
            best ? TOYS[best].name : '?'
          }) lands ${landed.toFixed(0)} over a ${ENEMIES[kind].name}'s ${seconds.toFixed(
            1,
          )}s walk, and it needs ${(needed * KILL_MARGIN).toFixed(0)}`,
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
