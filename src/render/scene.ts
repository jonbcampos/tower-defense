/**
 * The one renderer, and the owner of layer order.
 *
 * Layer order here is a game rule, not an art preference, and the load-bearing
 * ones are called out below. The rest of this module is the interpolation: the
 * simulation runs at a fixed 1/120s and the screen doesn't, so every moving
 * thing is drawn between its previous position and its current one.
 */

import {
  BOARD_TOP,
  CELL_H,
  CELL_W,
  COL_COUNT,
  LANE_COUNT,
  POOL,
  SCREEN,
  WAVE,
  cellAt,
  cellCentreX,
  cellIndex,
  cellX,
  laneCentreY,
  laneY,
} from '../game/config';
import { ENEMIES, type Enemy } from '../game/enemies';
import type { GameState } from '../game/state';
import { TOYS, type ToyId } from '../game/toys';
import type { Input } from '../core/input';
import type { Renderer } from './renderer';
import { PALETTE, alpha } from './palette';
import { drawBlocked, drawGuards, drawNook, drawRoom, drawUnicorn } from './bedroom';
import { drawKid } from './kids';
import { drawPlacedToy, drawToyArt } from './toys';
import { drawFooter, drawPopups } from '../ui/hud';
import { drawTray } from '../ui/tray';
import {
  drawLevelSelect,
  drawLoadout,
  drawResult,
  drawScrim,
  drawTitle,
  drawUnlockBanner,
} from '../ui/screens';
import { freshSave, type Save } from '../core/save';
import { LEVELS } from '../game/levels';

/**
 * Presentation-only state, mirrored here rather than read from storage or the
 * simulation on every frame. `clock` is free-running so menus keep breathing
 * while `state.elapsed` is frozen, and `save` is mirrored because the draw path
 * runs sixty times a second and `localStorage` reads are synchronous.
 */
let clock = 0;
let save: Save = freshSave();
let unlockBanner = '';
let squeezeFlash = 0;

export function advanceScene(dt: number, squeezed: boolean): void {
  clock += dt;
  if (squeezed) squeezeFlash = 1;
  else if (squeezeFlash > 0) squeezeFlash = Math.max(0, squeezeFlash - dt * 1.4);
}

export function setSaveForDisplay(next: Save): void {
  save = next;
}

export function setUnlockBanner(text: string): void {
  unlockBanner = text;
}

/** Mirrored from main.ts so the loadout screen can draw what it is choosing from. */
let loadoutAvailable: readonly ToyId[] = [];
let loadoutPicked: readonly ToyId[] = [];
let loadoutMax = 5;

export function setLoadoutDisplay(
  available: readonly ToyId[],
  picked: readonly ToyId[],
  max: number,
): void {
  loadoutAvailable = available;
  loadoutPicked = picked;
  loadoutMax = max;
}

export function sceneClock(): number {
  return clock;
}

export const sceneRenderer: Renderer = {
  draw(ctx, state, input, interpolation, particles) {
    ctx.save();
    if (state.shake > 0.05) {
      // Deterministic wobble rather than random: a random offset per frame at
      // 120Hz reads as static, not as a shake.
      ctx.translate(Math.sin(clock * 47) * state.shake, Math.cos(clock * 39) * state.shake * 0.6);
    }

    // On the menus the board behind the scrim is set dressing, so it is drawn
    // as a plain empty room. Level one's furniture covers four whole lanes, and
    // a title screen sitting on top of that reads as a broken level rather than
    // as a bedroom.
    const inPlay = state.phase === 'playing' || state.phase === 'won' || state.phase === 'lost';

    drawRoom(ctx, inPlay);
    // The door goes down before the kids, so a kid at the doorway is walking
    // OUT of it rather than standing on top of it.
    if (inPlay) drawNook(ctx);
    if (inPlay) drawBlocked(ctx, state.level.blocked);
    drawLaneFlashes(ctx, state);
    drawFloorToys(ctx, state);
    drawPlacementHints(ctx, state, input);
    // Ground toys and kids together, one row at a time. See drawRows.
    drawRows(ctx, state, interpolation);
    drawSparkles(ctx, state);
    drawShots(ctx, state, interpolation);
    particles.draw(ctx);
    // The unicorn over everything on the board, so a kid reaching the cushion
    // is hugging her rather than replacing her.
    if (inPlay) drawGuards(ctx, state.guardReady, clock);
    drawUnicorn(ctx, clock, squeezeFlash);
    drawDenyMark(ctx, state);

    ctx.restore();

    // The tray and the footer sit OUTSIDE the shake, so a card never moves
    // under a thumb that has already committed to pressing it.
    //
    // They are also hidden on the title and menu screens. A menu scrim is
    // semi-transparent by design — it has to push the room back without hiding
    // it — and a row of toy cards bleeding through the top of PICK A LEVEL just
    // reads as a rendering fault.
    if (inPlay) {
      drawTray(ctx, state, clock);
      drawFooter(ctx, state);
      drawPopups(ctx);
    }

    drawOverlays(ctx, state);
  },
};

function drawLaneFlashes(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const flash = state.laneFlash[lane]!;
    if (flash <= 0) continue;
    const strength = (flash / WAVE.flashSeconds) * 0.3;
    ctx.fillStyle = alpha(PALETTE.hudWarn, strength);
    ctx.fillRect(0, laneY(lane), SCREEN.w, CELL_H);
  }
}

function drawFloorToys(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const toy of state.toys.floor) {
    if (!toy.active) continue;
    drawPlacedToy(ctx, toy, cellCentreX(toy.col), laneCentreY(toy.lane), clock);
  }
}

/**
 * The board, row by row: a whole far lane, then a whole nearer one.
 *
 * Kids are drawn about twice their collision height (see `KID_ART_SCALE`), so
 * they overflow their lane on purpose. That makes the draw order load-bearing
 * in a way it wasn't when everything fitted in its own row.
 *
 * The old arrangement was two flat passes — every toy, then every kid — which
 * put a kid in lane 3 in front of a toy in lane 2 *and* in front of a toy in
 * lane 4. The first is right and the second is wrong: lane 4 is nearer the
 * player. Painter's algorithm by row fixes both at once, and costs nothing.
 *
 * Within a row, toys first and then kids, because a kid chewing on a pillow
 * fort has to be visibly on top of it or "which one is being eaten" is a guess.
 * Within the kids, furthest from the unicorn first.
 */
function drawRows(ctx: CanvasRenderingContext2D, state: GameState, interpolation: number): void {
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const base = lane * COL_COUNT;
    for (let col = 0; col < COL_COUNT; col++) {
      const toy = state.toys.ground[base + col]!;
      if (toy.active) drawPlacedToy(ctx, toy, cellCentreX(col), laneCentreY(lane), clock);
    }
    drawKidsInLane(ctx, state, lane, interpolation);
  }
}

/**
 * Where the held card may go, and a ghost of it under the finger.
 *
 * Shown the moment a card is picked up, before anything is committed. A child
 * should be able to SEE where a toy is allowed rather than discover it by being
 * refused — the red X is the backstop, not the interface.
 */
function drawPlacementHints(ctx: CanvasRenderingContext2D, state: GameState, input: Input): void {
  const id = state.selected;
  if (!id || state.phase !== 'playing') return;

  const instant = TOYS[id].role === 'instant';
  const pulse = 0.18 + Math.sin(clock * 6) * 0.07;

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    for (let col = 0; col < COL_COUNT; col++) {
      const legal = state.canPlaceAt(lane, col);
      const blocked = state.isBlocked(lane, col);
      if (!legal && !blocked) continue;

      if (legal) {
        ctx.fillStyle = alpha(PALETTE.cellFree, pulse);
        ctx.fillRect(cellX(col) + 1, laneY(lane) + 1, CELL_W - 2, CELL_H - 2);
        ctx.strokeStyle = alpha(PALETTE.cellFreeEdge, 0.6);
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX(col) + 1.5, laneY(lane) + 1.5, CELL_W - 3, CELL_H - 3);
        continue;
      }

      // Blocked, and a card is in hand: say so plainly. Green means yes and
      // grey-with-a-line-through-it means no, and the two must be different
      // SHAPES rather than two shades of tint — a five-year-old is scanning
      // five rows at speed, not comparing swatches.
      const cx = cellX(col);
      const cy = laneY(lane);
      ctx.fillStyle = alpha(PALETTE.cellBusy, 0.45);
      ctx.fillRect(cx + 1, cy + 1, CELL_W - 2, CELL_H - 2);
      ctx.strokeStyle = alpha(PALETTE.scrim, 0.6);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 12, cy + 10);
      ctx.lineTo(cx + CELL_W - 12, cy + CELL_H - 10);
      ctx.stroke();
    }
  }

  if (!input.pointer.inside) return;
  const cell = cellAt(input.pointer.x, input.pointer.y);
  if (!cell) return;

  // An instant highlights the whole lane it would go off in, because that is
  // what it affects. Anything else ghosts into the single cell it would fill.
  if (instant) {
    const span = TOYS[id].instant!.lanes > 1 ? 1 : 0;
    for (let lane = cell.lane - span; lane <= cell.lane + span; lane++) {
      if (lane < 0 || lane >= LANE_COUNT) continue;
      ctx.fillStyle = alpha(TOYS[id].color, 0.22);
      ctx.fillRect(0, laneY(lane), SCREEN.w, CELL_H);
    }
    return;
  }

  ctx.save();
  ctx.globalAlpha = state.canPlaceAt(cell.lane, cell.col) ? 0.7 : 0.28;
  drawToyArt(ctx, id, cellCentreX(cell.col), laneCentreY(cell.lane), 1, clock);
  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const sparkle of state.sparkles.items) {
    if (!sparkle.active) continue;
    // Fades over the last few seconds, so "hurry up" is visible rather than
    // something that happens without warning.
    const fade = Math.min(1, sparkle.life / 3);
    const pop = Math.sin(clock * 5 + sparkle.x) * 0.6;
    ctx.fillStyle = alpha(PALETTE.sparkle, fade);
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, 6 + pop, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(PALETTE.sparkleCore, fade);
    ctx.beginPath();
    ctx.arc(sparkle.x - 1.5, sparkle.y - 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(PALETTE.sparkleDim, fade * 0.8);
    ctx.fillRect(sparkle.x - 1, sparkle.y + 4, 2, 2);
  }
}

function drawShots(ctx: CanvasRenderingContext2D, state: GameState, interpolation: number): void {
  for (const shot of state.shots.items) {
    if (!shot.active) continue;
    const x = shot.prevX + (shot.x - shot.prevX) * interpolation;

    if (shot.hostile) {
      // A thrown stuffie: big, tumbling, unmistakably not a bubble.
      ctx.save();
      ctx.translate(x, shot.y);
      ctx.rotate(clock * 7);
      ctx.fillStyle = PALETTE.cushion;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = PALETTE.cushionFrill;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
      continue;
    }

    if (shot.kind === 'bubble') {
      ctx.strokeStyle = PALETTE.shotBubble;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, shot.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = alpha(PALETTE.shotBubble, 0.28);
      ctx.fill();
      continue;
    }

    ctx.fillStyle = shot.kind === 'water' ? PALETTE.shotWater : PALETTE.shotLight;
    ctx.beginPath();
    ctx.ellipse(x, shot.y, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.shotCore;
    ctx.fillRect(x - 1, shot.y - 1, 2, 2);
  }
}

/**
 * How far a kid sits below the middle of her lane.
 *
 * Zero, and deliberately a constant rather than a formula. It used to be
 * `height / 4`, which was right for the procedural painters — they draw feet at
 * the bottom of the shape — and wrong for the generated art, which is centred
 * in a square frame. Worse, being per-kind it sat a tall kid lower in her lane
 * than a short one, so no two kids agreed on where their row was and none of
 * them looked centred in it. Reported as "I couldn't be sure which row they
 * were in."
 */
const KID_LANE_OFFSET = 0;

/**
 * How far apart to fan kids who are standing on top of each other.
 *
 * Two kids piled against the same pillow fort occupy the same pixel, so a
 * crowd looks like one child. That matters beyond looks, because the game
 * treats them very differently from a single kid: both chew the toy at once, so
 * it dies twice as fast, and a bubble always hits whichever is nearest the
 * unicorn. A player who cannot see the second one cannot understand either.
 *
 * The fan alternates above and below the lane centre so the group stays
 * balanced on its row instead of drifting off it.
 */
const STACK_STEP = 5;
const STACK_FAN = [0, -1, 1, -2, 2];

/**
 * One lane's kids, furthest from the unicorn first, so a kid nearer her
 * overlaps the one behind rather than the other way round.
 *
 * The order is found by scanning for the rightmost undrawn kid rather than by
 * `filter().sort()`, which allocated two arrays per lane per frame — sixty
 * times a second, for the whole of a level, in a project whose rule is that
 * nothing is allocated after startup. There are at most a couple of dozen kids
 * alive, so the quadratic scan is cheaper than the garbage was.
 *
 * The scan order is also what drives the stacking fan: consecutive kids close
 * enough to overlap get stepped apart, and a kid with clear space around her
 * resets to the middle of the lane. Deriving it from proximity rather than from
 * something per-kid matters — a permanent per-kid offset would fix the crowd
 * and immediately recreate the "which row is she in?" problem for everyone
 * walking alone.
 */
function drawKidsInLane(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  lane: number,
  interpolation: number,
): void {
  const centre = laneCentreY(lane) + KID_LANE_OFFSET;
  let drawn = 0;
  let previous = Infinity;
  // Where the last kid was and how wide she is, to decide whether the next one
  // is standing on top of her. -Infinity so the first is never counted stacked.
  let lastX = -Infinity;
  let lastHalf = 0;
  let depth = 0;

  for (;;) {
    let next: Enemy | null = null;
    for (const enemy of state.enemies.items) {
      if (!enemy.active || enemy.lane !== lane) continue;
      if (enemy.x > previous) continue;
      if (next === null || enemy.x > next.x) next = enemy;
    }
    if (next === null) return;
    // Ties on x would otherwise loop forever, so each pass must consume one.
    const cutoff = next.x;
    for (const enemy of state.enemies.items) {
      if (!enemy.active || enemy.lane !== lane || enemy.x !== cutoff) continue;
      const half = ENEMIES[enemy.kind].width / 2;
      // Walking from the far end, so lastX is always the greater. Overlapping
      // bodies mean a pile; clear space means this kid starts a new one.
      depth = lastX - enemy.x < lastHalf + half ? depth + 1 : 0;
      lastX = enemy.x;
      lastHalf = half;

      const fan = STACK_FAN[Math.min(depth, STACK_FAN.length - 1)]! * STACK_STEP;
      const x = enemy.prevX + (enemy.x - enemy.prevX) * interpolation;
      drawKid(ctx, enemy, x, centre + fan);
      drawn++;
    }
    previous = cutoff - 1e-9;
    if (drawn > POOL.enemies) return; // belt and braces; unreachable
  }
}

/** The red X over a refused cell. Bright, brief, and impossible to miss. */
function drawDenyMark(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.denyFlash <= 0 || state.denyCell < 0) return;
  const lane = Math.floor(state.denyCell / COL_COUNT);
  const col = state.denyCell % COL_COUNT;
  const cx = cellCentreX(col);
  const cy = laneCentreY(lane);
  const fade = state.denyFlash / 0.5;
  ctx.fillStyle = alpha(PALETTE.cellDeny, fade * 0.3);
  ctx.fillRect(cellX(col) + 1, laneY(lane) + 1, CELL_W - 2, CELL_H - 2);
  ctx.strokeStyle = alpha(PALETTE.cellDeny, fade);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 9);
  ctx.lineTo(cx + 9, cy + 9);
  ctx.moveTo(cx + 9, cy - 9);
  ctx.lineTo(cx - 9, cy + 9);
  ctx.stroke();
}

function drawOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  switch (state.phase) {
    case 'title':
      // Scrim, then the unicorn again over it, then the words. She is the
      // mascot and the thing you are protecting; behind a 55% scrim she came
      // out grey-brown, which is not a hero.
      drawScrim(ctx, 0.6);
      drawUnicorn(ctx, clock, 0);
      drawTitle(ctx, save, clock);
      break;
    case 'select':
      drawLevelSelect(ctx, save, save.difficulty, clock);
      break;
    case 'loadout':
      drawLoadout(ctx, loadoutAvailable, loadoutPicked, loadoutMax, clock);
      break;
    case 'won':
    case 'lost': {
      const won = state.phase === 'won';
      const hasNext = state.level.id < LEVELS.length;
      drawResult(ctx, won, state.result().stars, state.level.name, hasNext, clock % 8);
      if (won && unlockBanner) drawUnlockBanner(ctx, unlockBanner);
      break;
    }
    case 'playing':
      drawBigWaveWarning(ctx, state);
      break;
  }
}

/** The "here they come" banner, only while a big wave is winding up. */
function drawBigWaveWarning(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.waves.phase !== 'warning') return;
  const pulse = 0.5 + Math.sin(clock * 9) * 0.5;
  ctx.fillStyle = alpha(PALETTE.hudWarn, 0.18 + pulse * 0.12);
  ctx.fillRect(0, BOARD_TOP + 60, SCREEN.w, 30);
  ctx.fillStyle = alpha(PALETTE.hudText, 0.6 + pulse * 0.4);
  ctx.font = 'bold 18px "SF Mono", "Roboto Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A BIG BUNCH!', SCREEN.w / 2, BOARD_TOP + 75);
}

/** Exported for the dev console: which cell a point is over. */
export { cellAt, cellIndex };
