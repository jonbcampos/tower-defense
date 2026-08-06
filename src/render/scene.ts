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
  SCREEN,
  WAVE,
  cellAt,
  cellCentreX,
  cellIndex,
  cellX,
  laneCentreY,
  laneY,
} from '../game/config';
import { ENEMIES } from '../game/enemies';
import type { GameState } from '../game/state';
import { TOYS, type ToyId } from '../game/toys';
import type { Input } from '../core/input';
import type { Renderer } from './renderer';
import { PALETTE, alpha } from './palette';
import { drawBlocked, drawDoor, drawMowers, drawRoom, drawUnicorn } from './bedroom';
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

    drawRoom(ctx);
    // The door goes down before the kids, so a kid at the doorway is walking
    // OUT of it rather than standing on top of it.
    drawDoor(ctx, clock);
    if (inPlay) drawBlocked(ctx, state.level.blocked);
    drawLaneFlashes(ctx, state);
    drawFloorToys(ctx, state);
    drawPlacementHints(ctx, state, input);
    drawGroundToys(ctx, state);
    drawSparkles(ctx, state);
    drawShots(ctx, state, interpolation);
    // Kids over toys: a kid chewing a pillow fort has to be visibly on top of
    // it, or "which one is being eaten" is a guess.
    drawKids(ctx, state, interpolation);
    particles.draw(ctx);
    // The unicorn over everything on the board, so a kid reaching the cushion
    // is hugging her rather than replacing her.
    if (inPlay) drawMowers(ctx, state.mowerReady, clock);
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

function drawGroundToys(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const toy of state.toys.ground) {
    if (!toy.active) continue;
    drawPlacedToy(ctx, toy, cellCentreX(toy.col), laneCentreY(toy.lane), clock);
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
      if (!legal && !state.isBlocked(lane, col)) continue;
      ctx.fillStyle = legal ? alpha(PALETTE.cellFree, pulse) : alpha(PALETTE.cellBusy, 0.2);
      ctx.fillRect(cellX(col) + 1, laneY(lane) + 1, CELL_W - 2, CELL_H - 2);
      if (!legal) continue;
      ctx.strokeStyle = alpha(PALETTE.cellFreeEdge, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX(col) + 1.5, laneY(lane) + 1.5, CELL_W - 3, CELL_H - 3);
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

function drawKids(ctx: CanvasRenderingContext2D, state: GameState, interpolation: number): void {
  // Back to front within a lane, so a kid nearer the unicorn overlaps the one
  // behind it rather than the other way round.
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const inLane = state.enemies.items.filter((e) => e.active && e.lane === lane);
    inLane.sort((a, b) => b.x - a.x);
    for (const enemy of inLane) {
      const x = enemy.prevX + (enemy.x - enemy.prevX) * interpolation;
      drawKid(ctx, enemy, x, laneCentreY(lane) + ENEMIES[enemy.kind].height / 4);
    }
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
