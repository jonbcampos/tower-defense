/**
 * Headless trials.
 *
 * `validateDesignContracts()` checks arithmetic over the config. This checks
 * the GAME: it drives the real `GameState`, with the real rules, through every
 * level at every difficulty, using a scripted bot.
 *
 * Two things learned from the sibling projects shape this file.
 *
 * **The bot's policy is part of the contract.** A trial that passes is only as
 * trustworthy as the player it simulates. The bots below are deliberately
 * mediocre — they place things in fixed columns, they never react to a lane
 * getting away from them, and they never use an instant. If a level needs more
 * than that, the level is too hard, and finding that out is the entire point.
 * The policy is described next to each bot so a failure can be read as "the bot
 * is wrong" rather than always as "the game is wrong".
 *
 * **Every trial prints what it MEASURED.** Not pass or fail — the number. Three
 * separate false alarms in the runner project turned out to be bad bot
 * policies, and each one cost an afternoon because the output said `FAIL` and
 * nothing else.
 *
 * Run it from the console: `__game.verify()`.
 */

import { FIXED_DT, DIFFICULTIES, DIFFICULTY_ORDER, STUCK_SECONDS, type DifficultyId } from '../game/config';
import { COL_COUNT, HALFWAY_COL, LANE_COUNT, cellCentreX, colAtX, squeezeX } from '../game/config';
import { ENEMIES, answersIn, type Enemy, type EnemyKind } from '../game/enemies';
import { LEVELS, levelById, type Level } from '../game/levels';
import { GameState } from '../game/state';
import { TOYS, TOY_ORDER, toyDealsDamage, type ToyId } from '../game/toys';
import { buildEndless } from '../game/endless';
import { Rng } from '../core/rng';
import { freshSave, loadSave, recordResult, starsFor, writeSave } from '../core/save';

export interface TrialResult {
  trial: string;
  level: string;
  difficulty: DifficultyId | 'all';
  detail: string;
  pass: boolean;
}

/** Simulated seconds any single trial is allowed. Levels run 80-180s. */
const MAX_SECONDS = 420;
/** How often the bot gets to act. A human is not making decisions at 120Hz. */
const THINK_INTERVAL = 0.25;

type Policy = (state: GameState) => void;

interface PlayResult {
  won: boolean;
  lost: boolean;
  seconds: number;
  state: GameState;
}

/** Drive a real level to its conclusion with a scripted policy. */
function play(level: Level, id: DifficultyId, policy: Policy, maxSeconds = MAX_SECONDS): PlayResult {
  const state = new GameState();
  // A fixed seed: a trial that passes four times in five is a trial that tells
  // you nothing. Optional-beat rolls are the only randomness, and pinning them
  // means a failure is reproducible by re-running this exact function.
  state.start(level, id, level.recommended, 0x5eed);
  let think = 0;
  let seconds = 0;
  while (seconds < maxSeconds && state.phase === 'playing') {
    think -= FIXED_DT;
    if (think <= 0) {
      think = THINK_INTERVAL;
      policy(state);
    }
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    seconds += FIXED_DT;
  }
  return { won: state.phase === 'won', lost: state.phase === 'lost', seconds, state };
}

// --- Bots -------------------------------------------------------------------

/** Take every sparkle on the floor. Free, and no player forgets to do it. */
function collectAll(state: GameState): void {
  for (const sparkle of state.sparkles.items) {
    if (sparkle.active) state.collectSparkleAt(sparkle.x, sparkle.y);
  }
}

function firstFreeCol(state: GameState, lane: number, from: number, to: number): number {
  for (let col = from; col <= to; col++) {
    if (state.isBlocked(lane, col)) continue;
    if (state.toys.at(lane, col)) continue;
    return col;
  }
  return -1;
}

function openLanes(level: Level): number[] {
  const lanes: number[] = [];
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    for (let col = 0; col < COL_COUNT; col++) {
      if (!level.blocked.includes(lane * COL_COUNT + col)) {
        lanes.push(lane);
        break;
      }
    }
  }
  return lanes;
}

/**
 * Where to put a defender, given the kid you are answering.
 *
 * BEHIND the kid — a lower column — because toys shoot rightwards, toward the
 * door. A toy placed in front of the kid that is currently eating your lane
 * cannot fire at it, and rebuilding into its mouth every time the last one
 * broke is how an earlier bot fed six Bubble Wands to one Raincoat Kid while
 * sitting on 200 sparkles.
 *
 * Column 0 stays reserved for producers; column 1 is the emergency slot.
 */
function placementCol(state: GameState, lane: number, targetCol: number): number {
  if (targetCol > 2) {
    const behind = firstFreeCol(state, lane, 2, targetCol - 1);
    if (behind >= 0) return behind;
  }
  const emergency = firstFreeCol(state, lane, 1, Math.max(1, targetCol - 1));
  if (emergency >= 0) return emergency;
  return firstFreeCol(state, lane, 2, COL_COUNT - 1);
}

/**
 * Place a card, laying a Duck Ring first if the cell is water.
 *
 * Every bot placement goes through here, which is the only reason the backyard
 * did not need two more policies written. The terrain rule is not strategy — a
 * bot that does not know it simply cannot build in three lanes of five, and the
 * trial would report "this level is unwinnable" when what it had actually found
 * was a bot that cannot swim.
 *
 * Note it does NOT teach the bots to value the pool lanes, decide whether a
 * lane is worth the ring, or hold cells back. Those are judgements, and the
 * whole point of a deliberately mediocre bot is that it makes none of them.
 */
function tryPlace(state: GameState, id: ToyId, lane: number, col: number): boolean {
  if (col < 0) return false;
  if (state.isWater(lane, col) && TOYS[id].layer !== 'float') {
    if (!state.toys.floatAt(lane, col) && !placeCard(state, 'ring', lane, col)) return false;
  }
  return placeCard(state, id, lane, col);
}

function placeCard(state: GameState, id: ToyId, lane: number, col: number): boolean {
  state.selectCard(null);
  state.selectCard(id);
  const placed = state.tryPlace(lane, col);
  state.selectCard(null);
  return placed;
}

/** The kid furthest along the board, or null. */
function frontmost(state: GameState): Enemy | null {
  let best: Enemy | null = null;
  for (const enemy of state.enemies.items) {
    if (!enemy.active) continue;
    if (!best || enemy.x < best.x) best = enemy;
  }
  return best;
}

/** Placeable toys in the loadout that can hurt this kid, cheapest first. */
function affordableAnswers(state: GameState, kind: EnemyKind): ToyId[] {
  return answersIn(state.loadout, kind)
    .filter((id) => TOYS[id].role !== 'instant')
    .filter((id) => state.canAfford(id) && state.isReady(id))
    .sort((a, b) => TOYS[a].cost - TOYS[b].cost);
}

/**
 * The weak bot.
 *
 * Policy, in full: collect every sparkle; keep four producers in columns 0-1;
 * otherwise look at the kid nearest the unicorn and put the CHEAPEST toy that
 * can actually hurt THAT kid into THAT kid's lane, in the first free column
 * from 2 rightwards. Nothing else. It never places a wall, never places slime,
 * never uses an instant, never uses the free sweeper, never sells anything, and
 * never notices that a lane it built for is now full of a different kid.
 *
 * The one piece of competence it has is picking the right tool, and that is
 * deliberate: it is the entire curriculum. Every level teaches "this kid, that
 * toy", so a level that cannot be won by applying exactly that lesson — with no
 * economy management, no positioning and no panic button — is asking for
 * something the campaign never taught.
 *
 * An earlier version of this bot only ever built the single cheapest damage toy
 * in the loadout, and it "failed" five levels. All five were fine: the bot was
 * shooting bubbles at balloons.
 */
function weakBot(level: Level): Policy {
  const lanes = openLanes(level);
  const producers = level.recommended.filter((id) => TOYS[id].produce !== undefined);
  const anyDefender = level.recommended
    .filter((id) => toyDealsDamage(id) && TOYS[id].role !== 'instant')
    .sort((a, b) => TOYS[a].cost - TOYS[b].cost);

  return (state) => {
    collectAll(state);

    const producer = producers[0];
    if (producer && wantsProducer(state, 4) && state.canAfford(producer) && state.isReady(producer)) {
      for (const lane of lanes) {
        if (!laneIsSafeForProducer(state, lane)) continue;
        if (tryPlace(state, producer, lane, firstFreeCol(state, lane, 0, 1))) return;
      }
    }

    const target = frontmost(state);
    if (target) {
      const col = placementCol(state, target.lane, colAtX(target.x));
      for (const id of affordableAnswers(state, target.kind)) {
        if (tryPlace(state, id, target.lane, col)) return;
      }
      // Nothing affordable that works on this kid: SAVE UP. Building something
      // that can't hurt it is worse than building nothing — it feeds the kid a
      // free toy and buys nothing. (An earlier bot did exactly this and turned
      // level seven into a 420-second stalemate against one Raincoat Kid.)
      return;
    }

    // Board empty. Build ahead.
    for (const id of anyDefender) {
      if (!state.canAfford(id) || !state.isReady(id)) continue;
      for (const lane of lanes) {
        if (tryPlace(state, id, lane, firstFreeCol(state, lane, 2, COL_COUNT - 1))) return;
      }
    }
  };
}

/**
 * Should the bot build another producer right now?
 *
 * Alternating — never more producers on the board than defenders — is the
 * single most important habit in a lane defence, and the one a bot that builds
 * "up to six jars first" doesn't have. That bot went broke on every level from
 * five onward and lost with a purse of 13, which reads as "the economy is too
 * tight" and is in fact "nobody plays like that".
 */
function wantsProducer(state: GameState, cap: number): boolean {
  let producers = 0;
  let defenders = 0;
  for (const toy of state.toys.ground) {
    if (!toy.active) continue;
    if (TOYS[toy.id].produce) producers += 1;
    else defenders += 1;
  }
  return producers < cap && producers <= defenders;
}

/**
 * Is this lane safe to put a producer in?
 *
 * Not if a kid has got as far as column two. A jar has no health worth
 * speaking of and does not shoot back, so building one there feeds it to the
 * kid and buys nothing — and because the jar count then drops below the cap,
 * the bot immediately builds another. An earlier version did exactly that
 * loop against one Raincoat Kid for 420 simulated seconds, sitting on 2,961
 * sparkles, and the trial reported it as the LEVEL being unwinnable.
 */
function laneIsSafeForProducer(state: GameState, lane: number): boolean {
  for (const enemy of state.enemies.items) {
    if (!enemy.active || enemy.lane !== lane) continue;
    if (colAtX(enemy.x) <= 2) return false;
  }
  return true;
}

/**
 * The good bot.
 *
 * The weak bot plus three habits a competent player has: six producers rather
 * than four, the STRONGEST affordable answer rather than the cheapest, and an
 * instant fired into any lane where a kid has crossed the halfway column.
 * Still no walls, no slime and no sweeper.
 *
 * Used where "cleared it" isn't the bar — the pool trials, which want a level
 * played hard enough to stress them.
 */
function goodBot(level: Level): Policy {
  const lanes = openLanes(level);
  const producers = level.recommended.filter((id) => TOYS[id].produce !== undefined);
  const instants = level.recommended.filter((id) => TOYS[id].role === 'instant');
  const walls = level.recommended.filter((id) => TOYS[id].role === 'wall');
  const panicLine = cellCentreX(HALFWAY_COL);

  return (state) => {
    collectAll(state);

    const target = frontmost(state);
    if (target && target.x < panicLine) {
      for (const id of instants) {
        if (!state.isReady(id) || !state.canAfford(id)) continue;
        if (tryPlace(state, id, target.lane, 0)) return;
      }
    }

    const producer = producers[0];
    if (producer && wantsProducer(state, 6) && state.canAfford(producer) && state.isReady(producer)) {
      for (const lane of lanes) {
        if (!laneIsSafeForProducer(state, lane)) continue;
        if (tryPlace(state, producer, lane, firstFreeCol(state, lane, 0, 1))) return;
      }
    }

    if (target) {
      const col = placementCol(state, target.lane, colAtX(target.x));
      for (const id of affordableAnswers(state, target.kind).reverse()) {
        if (tryPlace(state, id, target.lane, col)) return;
      }
      return;
    }

    const wall = walls[0];
    if (wall && state.canAfford(wall) && state.isReady(wall)) {
      for (const lane of lanes) {
        if (tryPlace(state, wall, lane, firstFreeCol(state, lane, 6, COL_COUNT - 1))) return;
      }
    }
  };
}

// --- Trials -----------------------------------------------------------------

/**
 * Every level has to be winnable, and by whom depends on the tier.
 *
 * EASY and NORMAL are held to the WEAK bot: right tool, fixed columns, no
 * instants, no walls, no sense of which lane is in trouble. If a level in
 * either of those tiers needs more than "use the toy that works on that kid",
 * it is asking for something the campaign never taught.
 *
 * HARD is held to the GOOD bot instead, and that difference is the definition
 * of the tier. HARD is where the panic button, the strongest answer and six
 * producers stop being optional. Holding HARD to the weak bot would mean
 * either a HARD that isn't hard or a NORMAL that is.
 */
function trialLevelIsWinnable(level: Level, id: DifficultyId): TrialResult {
  const mediocre = id !== 'hard';
  const result = play(level, id, mediocre ? weakBot(level) : goodBot(level));
  return {
    trial: mediocre ? 'level is winnable by a mediocre bot' : 'level is winnable by a competent bot',
    level: `${level.id} ${level.name}`,
    difficulty: id,
    detail: result.won
      ? `cleared in ${result.seconds.toFixed(0)}s with ${result.state.lives}/3 hearts and ${
          result.state.toysLost
        } toys lost`
      : result.lost
        ? `LOST after ${result.seconds.toFixed(0)}s, ${result.state.enemies.count()} kids still walking`
        : `never resolved in ${MAX_SECONDS}s (wave ${result.state.waves.index + 1}/${result.state.waves.total})`,
    pass: result.won,
  };
}

function trialDoingNothingLoses(level: Level, id: DifficultyId): TrialResult {
  const result = play(level, id, () => {});
  return {
    trial: 'doing nothing loses',
    level: `${level.id} ${level.name}`,
    difficulty: id,
    detail: result.lost
      ? `lost after ${result.seconds.toFixed(0)}s`
      : `survived ${result.seconds.toFixed(0)}s with ${result.state.lives} hearts — the level plays itself`,
    pass: result.lost,
  };
}

/**
 * Level one, with ONE Bubble Wand, placed once, and nothing else ever.
 *
 * No producer, no second toy, no sparkle collection. This is the floor of what
 * a child who has understood "tap a card, tap the floor" and then stopped
 * paying attention can do, and it has to be enough.
 */
function trialLevelOneIsNearlyUnloseable(id: DifficultyId): TrialResult {
  const level = levelById(1);
  let placed = false;
  const result = play(level, id, (state) => {
    if (placed) return;
    placed = tryPlace(state, 'wand', 2, 0);
  });
  return {
    trial: 'level one survives one wand and no attention',
    level: '1 Nap Time',
    difficulty: id,
    detail: result.won
      ? `cleared with ${result.state.lives}/3 hearts in ${result.seconds.toFixed(0)}s`
      : `did not clear — ${result.state.lives} hearts left after ${result.seconds.toFixed(0)}s`,
    pass: result.won,
  };
}

/** The free trickle alone must rebuild a defence. Nothing placed, nothing collected. */
function trialNeverStuck(id: DifficultyId): TrialResult {
  const level = levelById(5);
  const state = new GameState();
  state.start(level, id, level.recommended, 1);
  const cheapest = Math.min(
    ...level.recommended.filter(toyDealsDamage).map((toy) => state.costOf(toy)),
  );
  const start = state.purse;
  // Spend the opening purse, so this measures income and not the starting hand.
  state.purse = 0;
  let seconds = 0;
  while (seconds < STUCK_SECONDS && state.purse < cheapest) {
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    // EASY auto-collects; the others need a tap, which a stuck player will make.
    for (const sparkle of state.sparkles.items) {
      if (sparkle.active && sparkle.age > 0.5) state.collectSparkleAt(sparkle.x, sparkle.y);
    }
    seconds += FIXED_DT;
  }
  return {
    trial: 'a wiped-out player is never stranded',
    level: '5 Lights Out',
    difficulty: id,
    detail: `from 0 sparkles (opening hand was ${start}) reached ${state.purse} in ${seconds.toFixed(
      1,
    )}s; needs ${cheapest} within ${STUCK_SECONDS}s`,
    pass: state.purse >= cheapest,
  };
}

/** The raincoat really is immune, and EASY really does leak. */
function trialImmunityIsReal(id: DifficultyId): TrialResult {
  const level = levelById(4);
  const state = new GameState();
  state.start(level, id, level.recommended, 2);
  const enemy = state.enemies.spawn('raincoat', 2, 1)!;
  const before = enemy.hp;
  // Reach through the same path a Water Gun uses, so this tests the rule and
  // not a re-implementation of it.
  state.toys.place('watergun', 2, 0, 0);
  let seconds = 0;
  while (seconds < 6) {
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    seconds += FIXED_DT;
  }
  const lost = before - enemy.hp;
  const leak = DIFFICULTIES[id].immunityLeak;
  const pass = leak === 0 ? lost === 0 : lost > 0 && lost < before;
  return {
    trial: 'water does nothing to a raincoat (except EASY, a little)',
    level: '4 Raincoats',
    difficulty: id,
    detail: `6s of water took ${lost.toFixed(1)} of ${before} hp; immunityLeak is ${leak}`,
    pass,
  };
}

/** A ground shooter cannot touch a balloon; something that goes up can. */
function trialBalloonNeedsAir(id: DifficultyId): TrialResult {
  const level = levelById(6);
  const ground = damageOver('wand', 'balloon', level, id, 6);
  const air = damageOver('sprinkler', 'balloon', level, id, 6);
  return {
    trial: 'balloons float over ground toys and not over spray',
    level: '6 Slip and Slide',
    difficulty: id,
    detail: `bubble wand landed ${ground.toFixed(1)}, sprinkler landed ${air.toFixed(1)}`,
    pass: ground === 0 && air > 0,
  };
}

/** A blanket hides from a single-lane shooter and not from a sprinkler. */
function trialBlanketHides(id: DifficultyId): TrialResult {
  const level = levelById(5);
  const aimed = damageOver('watergun', 'blanket', level, id, 6);
  const spray = damageOver('sprinkler', 'blanket', level, id, 6);
  return {
    trial: 'a blanket hides from an aimed shot and not from spray',
    level: '5 Lights Out',
    difficulty: id,
    detail: `water gun landed ${aimed.toFixed(1)}, sprinkler landed ${spray.toFixed(1)}`,
    pass: aimed === 0 && spray > 0,
  };
}

function damageOver(
  toy: ToyId,
  kind: 'balloon' | 'blanket',
  level: Level,
  id: DifficultyId,
  seconds: number,
): number {
  const state = new GameState();
  state.start(level, id, level.recommended, 3);
  const enemy = state.enemies.spawn(kind, 2, 1)!;
  const before = enemy.hp + enemy.shield;
  state.toys.place(toy, 2, 0, 0);
  let t = 0;
  while (t < seconds) {
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    t += FIXED_DT;
  }
  return before - (enemy.hp + enemy.shield);
}

/** A refused placement costs nothing at all. */
function trialDeniedPlacementIsFree(id: DifficultyId): TrialResult {
  const level = levelById(2);
  const state = new GameState();
  state.start(level, id, level.recommended, 4);
  const before = state.purse;
  state.selectCard('wand');
  // Lane 0 is entirely furniture on level two.
  const denied = state.tryPlace(0, 3);
  const afterDeny = state.purse;
  state.selectCard(null);
  state.selectCard('wand');
  state.tryPlace(2, 3);
  const afterPlace = state.purse;
  return {
    trial: 'a refused placement costs nothing',
    level: '2 Toddler Traffic',
    difficulty: id,
    detail: `purse ${before} -> ${afterDeny} on a refusal (placed=${denied}), then -> ${afterPlace} on a real one`,
    pass: !denied && afterDeny === before && afterPlace < before,
  };
}

/** The refund window opens and then closes. */
function trialRefundWindowCloses(id: DifficultyId): TrialResult {
  const level = levelById(3);
  const difficulty = DIFFICULTIES[id];
  const state = new GameState();
  state.start(level, id, level.recommended, 5);
  state.selectCard('wand');
  state.tryPlace(2, 1);
  const spent = state.purse;
  const early = state.refund(2, 1);
  const afterEarly = state.purse;

  state.selectCard('wand');
  state.tryPlace(2, 2);
  let t = 0;
  while (t < difficulty.refundGraceSeconds + 1) {
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    t += FIXED_DT;
  }
  const late = state.refund(2, 2);
  return {
    trial: 'a fumble can be undone, briefly',
    level: '3 First Runner',
    difficulty: id,
    detail: `refund inside ${difficulty.refundGraceSeconds}s: ${early} (purse ${spent} -> ${afterEarly}); after: ${late}`,
    pass: early && !late && afterEarly > spent,
  };
}

/** A Guard Bear saves a lane, costs no heart, and only does it once. */
function trialGuardSavesALane(id: DifficultyId): TrialResult {
  const level = levelById(5);
  const state = new GameState();
  state.start(level, id, level.recommended, 6);
  for (const kind of ['raincoat', 'blanket', 'balloon', 'puffy'] as const) {
    state.enemies.spawn(kind, 1, 1);
  }
  const other = state.enemies.spawn('toddler', 3, 1)!;
  // Walk lane 1's kids onto the cushion.
  for (const enemy of state.enemies.items) {
    if (enemy.active && enemy.lane === 1) enemy.x = squeezeX() - 1;
  }
  const livesBefore = state.lives;
  state.update(FIXED_DT);
  state.drainEvents(() => {});
  const afterFirst = state.enemies.count();
  const livesAfterFirst = state.lives;

  // Second overrun in the same lane: the bear is gone, so this one costs a heart.
  const again = state.enemies.spawn('toddler', 1, 1)!;
  again.x = squeezeX() - 1;
  state.update(FIXED_DT);
  state.drainEvents(() => {});

  return {
    trial: 'a Guard Bear saves a lane once, then never again',
    level: '5 Lights Out',
    difficulty: id,
    detail: `4 kids on the cushion in lane 1 -> ${afterFirst} left and ${livesAfterFirst}/${livesBefore} hearts; a second overrun left ${state.lives} hearts (lane 3's ${other.kind} untouched: ${other.active})`,
    pass:
      livesAfterFirst === livesBefore &&
      afterFirst === 1 &&
      other.active &&
      state.lives === livesBefore - 1,
  };
}

/** Wave pacing actually responds to `waveRestScale`. */
function trialWavePacingResponds(): TrialResult {
  const gaps = DIFFICULTY_ORDER.map((id) => {
    const level = levelById(3);
    const state = new GameState();
    state.start(level, id, level.recommended, 7);
    // Clear the board instantly every step, so every wave ends by CLEARING and
    // the measured gap is the rest rather than a timeout.
    let firstEnd = -1;
    let secondStart = -1;
    let t = 0;
    while (t < 90 && secondStart < 0) {
      state.update(FIXED_DT);
      state.drainEvents(() => {});
      for (const enemy of state.enemies.items) enemy.active = false;
      if (state.waves.index === 1 && firstEnd < 0) firstEnd = t;
      if (state.waves.index === 1 && state.waves.phase === 'running' && firstEnd >= 0) secondStart = t;
      t += FIXED_DT;
    }
    return secondStart - firstEnd;
  });
  const [easy, normal, hard] = gaps as [number, number, number];
  return {
    trial: 'the difficulty rest multiplier is wired to something',
    level: '3 First Runner',
    difficulty: 'all',
    detail: `gap after a cleared wave: EASY ${easy.toFixed(1)}s, NORMAL ${normal.toFixed(
      1,
    )}s, HARD ${hard.toFixed(1)}s`,
    pass: easy > normal && normal > hard && hard > 0,
  };
}

/** Stars only ever go up, and unlocks follow them. */
function trialStarsAreMonotone(): TrialResult {
  const save = freshSave();
  recordResult(save, 1, 3);
  recordResult(save, 1, 1);
  const kept = starsFor(save, 1);
  recordResult(save, 2, 2);
  const unlocked = save.unlocked;
  recordResult(save, 99, 3);
  const clamped = save.unlocked;
  return {
    trial: 'a bad replay never takes a star away',
    level: 'save',
    difficulty: 'all',
    detail: `3 then 1 leaves ${kept} stars; clearing level 2 unlocked ${unlocked}; a bogus level 99 left it at ${clamped}`,
    pass: kept === 3 && unlocked === 3 && clamped === 3,
  };
}

/**
 * The save never throws and always hands back something startable.
 *
 * Every one of these is a real thing that has happened to a save file
 * somewhere: a half-written string, a quota error mid-write, a value from a
 * newer build, a hand-edited number, a key that isn't a level.
 */
function trialSaveSurvivesHostility(): TrialResult {
  const fixtures: string[] = [
    '',
    '{',
    'null',
    '[]',
    '42',
    '"hi"',
    '{}',
    '{"v":"1"}',
    '{"v":0}',
    '{"v":1,"unlocked":-3}',
    '{"v":1,"unlocked":1000000000}',
    '{"v":1,"stars":{"3":9,"nope":2,"-1":3}}',
    '{"v":1,"stars":[3,3,3]}',
    '{"v":1,"difficulty":"impossible","muted":"yes"}',
    `{"v":1,"junk":"${'x'.repeat(200000)}"}`,
    '{"v":99,"unlocked":7}',
  ];
  const failures: string[] = [];
  for (const fixture of fixtures) {
    try {
      localStorage.setItem('tower-defense.save', fixture);
      const { save } = loadSave();
      const ok =
        Number.isInteger(save.unlocked) &&
        save.unlocked >= 1 &&
        save.unlocked <= LEVELS.length &&
        (DIFFICULTY_ORDER as readonly string[]).includes(save.difficulty) &&
        typeof save.muted === 'boolean' &&
        Object.entries(save.stars).every(([key, value]) => {
          const id = Number(key);
          return Number.isInteger(id) && id >= 1 && id <= LEVELS.length && value >= 0 && value <= 3;
        });
      if (!ok) failures.push(fixture.slice(0, 40));
    } catch (error) {
      failures.push(`${fixture.slice(0, 24)} threw ${String(error).slice(0, 40)}`);
    }
  }
  // A newer save must have been parked rather than eaten.
  localStorage.setItem('tower-defense.save', '{"v":99,"unlocked":7}');
  loadSave();
  const parked = localStorage.getItem('tower-defense.save.future');
  if (parked === null) failures.push('a v99 save was discarded instead of parked');
  localStorage.removeItem('tower-defense.save');
  localStorage.removeItem('tower-defense.save.future');
  writeSave(freshSave());

  return {
    trial: 'the save survives anything at all',
    level: 'save',
    difficulty: 'all',
    detail: `${fixtures.length} hostile fixtures, ${failures.length} failures${
      failures.length ? `: ${failures.join(' | ')}` : ''
    }`,
    pass: failures.length === 0,
  };
}

/** Nothing allocates mid-run: every pool ends a level with room to spare. */
function trialPoolsHold(level: Level, id: DifficultyId): TrialResult {
  const result = play(level, id, goodBot(level));
  const peak = result.state.enemies.count();
  return {
    trial: 'pools hold through a whole level',
    level: `${level.id} ${level.name}`,
    difficulty: id,
    detail: `finished with ${peak} kids live, ${result.state.sparkles.count()} sparkles on the floor`,
    pass: peak < 48 && result.state.sparkles.count() <= 24,
  };
}

/** The boss really does take half from bubbles. */
function trialBossResistsBubbles(): TrialResult {
  const level = levelById(10);
  const bubble = damageOverBoss('machine', level);
  const water = damageOverBoss('watergun', level);
  const ratio = water > 0 ? bubble / water : 0;
  return {
    trial: 'the Big Kid shrugs off half of every bubble',
    level: '10 The Big Kid',
    difficulty: 'normal',
    detail: `over 8s: bubbles ${bubble.toFixed(0)}, water ${water.toFixed(0)}, ratio ${ratio.toFixed(2)} vs the ${
      ENEMIES.bigkid.resist!.share
    } it should be per point of damage`,
    pass: bubble > 0 && water > 0,
  };
}

function damageOverBoss(toy: ToyId, level: Level): number {
  const state = new GameState();
  state.start(level, 'normal', level.recommended, 8);
  const boss = state.enemies.spawn('bigkid', 2, 1)!;
  const before = boss.hp;
  state.toys.place(toy, 2, 0, 0);
  let t = 0;
  while (t < 8) {
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    t += FIXED_DT;
  }
  return before - boss.hp;
}

// --- The verb toys ----------------------------------------------------------
//
// Each of these three changes what a DIFFERENT toy does, which means none of
// them is covered by "is this level winnable" — a level stays winnable whether
// the verb toy works or not, because the campaign never requires one. Without a
// trial apiece, all three could silently do nothing.

/**
 * A bubble that flies through a Bubble Bath hits twice as hard.
 *
 * Measured as a ratio between two otherwise identical runs rather than against
 * an absolute number, so retuning the Bubble Wand cannot break this.
 */
function trialBathBoostsBubbles(): TrialResult {
  const level = levelById(22);
  const plain = damageWithHelper(level, null);
  const boosted = damageWithHelper(level, 'soap');
  const ratio = plain > 0 ? boosted / plain : 0;
  const want = TOYS.soap.boost!.multiply;
  return {
    trial: 'a Bubble Bath doubles the bubbles that pass through it',
    level: '22 Who Is That?',
    difficulty: 'normal',
    detail: `8s of one Bubble Wand landed ${plain.toFixed(0)} alone and ${boosted.toFixed(
      0,
    )} through a bath — ${ratio.toFixed(2)}x, want about ${want}x`,
    // A band rather than an equality: the two runs can differ by one in-flight
    // bubble at the moment the clock stops, and a trial that fails on that is a
    // trial that gets deleted rather than read.
    pass: plain > 0 && ratio > want * 0.8 && ratio <= want * 1.15,
  };
}

/** One shooter in lane 2 column 0, optionally with a helper in column 1. */
function damageWithHelper(level: Level, helper: ToyId | null): number {
  const state = new GameState();
  state.start(level, 'normal', level.recommended, 21);
  const enemy = state.enemies.spawn('puffy', 2, 4)!;
  // Parked at the far end, so it never reaches the toys and the only variable
  // is what happens to the bubbles on the way.
  enemy.x = cellCentreX(COL_COUNT - 1);
  const before = enemy.hp;
  state.toys.place('wand', 2, 0, 0);
  if (helper) state.toys.place(helper, 2, 1, 0);
  let t = 0;
  while (t < 8) {
    enemy.x = cellCentreX(COL_COUNT - 1);
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    t += FIXED_DT;
  }
  return before - enemy.hp;
}

/**
 * A Squeaky Toy moves kids into another row, and wears out doing it.
 *
 * Both halves matter. A toy that redirects forever is a wall that never breaks,
 * and this is the one toy in the game a kid does not stop to chew — so its
 * health has to come off somewhere or a single squeaky toy holds a lane for the
 * rest of the level.
 */
function trialSqueakRedirectsThenWearsOut(): TrialResult {
  const level = levelById(23);
  const state = new GameState();
  state.start(level, 'normal', level.recommended, 22);
  state.toys.place('squeak', 2, 4, 0);

  for (let i = 0; i < 6; i++) {
    const kid = state.enemies.spawn('toddler', 2, 1);
    if (kid) kid.x = cellCentreX(COL_COUNT - 1) + i * 30;
  }

  // Counted from the EVENTS, not by looking at the kids afterwards.
  //
  // The first version of this held references to the six pooled `Enemy`
  // objects and checked their lanes at the end, and it under-counted by half:
  // the level's own waves are running the whole time, and a kid who has walked
  // off the board frees her slot for a spawn that lands back in lane 2. A
  // pooled object is not an identity, and a trial that treats it as one is
  // measuring the pool rather than the game.
  let diverted = 0;
  let intoLaneTwo = 0;
  let t = 0;
  while (t < 40 && state.phase === 'playing') {
    state.update(FIXED_DT);
    state.drainEvents((event) => {
      if (event.type !== 'divert') return;
      diverted += 1;
      if (event.lane === 2) intoLaneTwo += 1;
    });
    t += FIXED_DT;
  }

  const gone = state.toys.at(2, 4) === null;
  const capacity = Math.floor(TOYS.squeak.hp / TOYS.squeak.divert!.bite);
  return {
    trial: 'a Squeaky Toy redirects a few kids and then is squeaked to bits',
    level: '23 Slippery Tiles',
    difficulty: 'normal',
    detail: `sent ${diverted} kids out of lane 2 (${intoLaneTwo} wrongly back into it), and the toy ${
      gone ? 'wore out' : 'is still there'
    } after ${t.toFixed(0)}s — it should hold exactly ${capacity}`,
    pass: diverted === capacity && intoLaneTwo === 0 && gone,
  };
}

/**
 * The magnet takes the shield and leaves the kid, from a neighbouring row.
 *
 * Deliberately placed one lane over. Reaching across rows is the whole reason
 * it is worth a cell rather than being a worse Water Gun.
 */
function trialMagnetStripsArmour(): TrialResult {
  const level = levelById(26);
  const state = new GameState();
  state.start(level, 'normal', level.recommended, 23);
  const wagon = state.enemies.spawn('wagon', 2, 1)!;
  wagon.x = cellCentreX(4);
  const shieldBefore = wagon.shield;
  const hpBefore = wagon.hp;
  state.toys.place('magnet', 1, 2, 0);

  let t = 0;
  while (t < 2 && wagon.shield > 0) {
    wagon.x = cellCentreX(4);
    state.update(FIXED_DT);
    state.drainEvents(() => {});
    t += FIXED_DT;
  }

  // And it does NOT reach four rows away, which is what stops it being a
  // board-wide "no armour in this level" button.
  const far = new GameState();
  far.start(level, 'normal', level.recommended, 24);
  const distant = far.enemies.spawn('wagon', 4, 1)!;
  distant.x = cellCentreX(4);
  far.toys.place('magnet', 0, 2, 0);
  let ft = 0;
  while (ft < 2) {
    distant.x = cellCentreX(4);
    far.update(FIXED_DT);
    far.drainEvents(() => {});
    ft += FIXED_DT;
  }

  return {
    trial: 'a Magnet Wand takes the shield, leaves the kid, and cannot reach four rows',
    level: '26 Big Coats, No View',
    difficulty: 'normal',
    detail: `one row over: shield ${shieldBefore} -> ${wagon.shield} in ${t.toFixed(
      2,
    )}s, health ${hpBefore} -> ${wagon.hp}; four rows over: shield still ${distant.shield}`,
    pass: wagon.shield === 0 && wagon.hp === hpBefore && distant.shield === shieldBefore,
  };
}

// --- Runner -----------------------------------------------------------------

/**
 * Endless must actually end.
 *
 * The first version did not. A bot driven to wave 120 still had three hearts, a
 * full board and no prospect of ever losing, because the wave size caps out
 * once the enemy pool is the limit and more kids stops being an escalation the
 * moment you cannot fit more kids. The fix was a toughness ramp; this is what
 * stops it quietly regressing, and it is the only trial in the suite whose
 * pass condition is that the player LOSES.
 *
 * The bound at the top is generous. The point is "this terminates", not "this
 * terminates at wave 33" — pinning the exact number would turn every tuning
 * change into a failing test with nothing wrong.
 */
function trialEndlessEnds(id: DifficultyId): TrialResult {
  const state = new GameState();
  const owned = [...TOY_ORDER];
  const run = buildEndless(owned, LEVELS.length, DIFFICULTIES[id], new Rng(11));
  state.start(run.level, id, owned, 11, run.grow, run.toughnessAt);

  const policy = goodBot(run.level);
  const limit = 120 * 3000;
  for (let i = 0; i < limit && state.phase === 'playing'; i++) {
    if (i % 30 === 0) policy(state);
    state.update(1 / 120);
    state.drainEvents(() => {});
  }

  const reached = state.waves.index;
  return {
    trial: 'endless eventually ends',
    level: 'endless',
    difficulty: id,
    detail:
      state.phase === 'playing'
        ? `still going at wave ${reached} after 3000s — the ramp never catches up`
        : `ended at wave ${reached}`,
    pass: state.phase !== 'playing' && reached >= 5,
  };
}

export function verify(): TrialResult[] {
  const results: TrialResult[] = [];

  for (const id of DIFFICULTY_ORDER) {
    for (const level of LEVELS) {
      results.push(trialLevelIsWinnable(level, id));
      results.push(trialDoingNothingLoses(level, id));
    }
    results.push(trialPoolsHold(levelById(9), id));
    results.push(trialLevelOneIsNearlyUnloseable(id));
    results.push(trialNeverStuck(id));
    results.push(trialImmunityIsReal(id));
    results.push(trialBalloonNeedsAir(id));
    results.push(trialBlanketHides(id));
    results.push(trialDeniedPlacementIsFree(id));
    results.push(trialRefundWindowCloses(id));
    results.push(trialGuardSavesALane(id));
  }
  results.push(trialWavePacingResponds());
  results.push(trialStarsAreMonotone());
  results.push(trialSaveSurvivesHostility());
  results.push(trialBossResistsBubbles());
  results.push(trialBathBoostsBubbles());
  results.push(trialSqueakRedirectsThenWearsOut());
  results.push(trialMagnetStripsArmour());
  for (const id of DIFFICULTY_ORDER) results.push(trialEndlessEnds(id));

  const failed = results.filter((r) => !r.pass);
  console.table(
    results.map((r) => ({
      trial: r.trial,
      level: r.level,
      difficulty: r.difficulty,
      result: r.pass ? 'PASS' : 'FAIL',
      detail: r.detail,
    })),
  );
  if (failed.length === 0) {
    console.log(`%c${results.length} trials, all passing`, 'color:#2a2');
  } else {
    console.error(`${failed.length} of ${results.length} trials FAILED`);
    for (const f of failed) console.error(`  ${f.level} [${f.difficulty}] ${f.trial}: ${f.detail}`);
  }
  return results;
}
