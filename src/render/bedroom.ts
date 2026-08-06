/**
 * The room: wall, floor, doorway, cushion and the unicorn herself.
 *
 * All procedural. There is not an image file in this project and there is not
 * going to be one — the sibling games proved that a few dozen rectangles and
 * arcs read better at 480x270 than a scaled sprite does, and it means a colour
 * change is a one-line edit rather than an art pass.
 */

import {
  BED_W,
  BOARD_BOTTOM,
  BOARD_TOP,
  BOARD_W,
  CELL_H,
  CELL_W,
  COL_COUNT,
  DOOR_W,
  LANE_COUNT,
  SCREEN,
  bedX,
  boardLeft,
  cellX,
  doorX,
  laneY,
} from '../game/config';
import { PALETTE, alpha } from './palette';
import { drawSprite, sprite } from './sprites';

/** Wall, wainscot and the floor's lane stripes. Drawn before anything else. */
export function drawRoom(ctx: CanvasRenderingContext2D): void {
  // A generated room replaces the wall and floor wholesale, but the lane lines
  // are drawn over it either way — they are the grid, not decoration, and a
  // painting of a carpet does not tell you where a cell ends.
  const room = sprite('room');
  if (room) {
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(room, 0, 0, SCREEN.w, SCREEN.h);
    ctx.imageSmoothingEnabled = smoothing;
    drawLaneGrid(ctx);
    return;
  }

  const wall = ctx.createLinearGradient(0, 0, 0, BOARD_TOP);
  wall.addColorStop(0, PALETTE.wallTop);
  wall.addColorStop(1, PALETTE.wallBottom);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, SCREEN.w, BOARD_TOP);

  // Wainscot panelling along the back wall. Purely so the top strip isn't a
  // flat block of colour behind the tray.
  ctx.fillStyle = PALETTE.wainscot;
  ctx.fillRect(0, BOARD_TOP - 14, SCREEN.w, 12);
  ctx.fillStyle = PALETTE.wainscotLine;
  for (let x = 6; x < SCREEN.w; x += 26) ctx.fillRect(x, BOARD_TOP - 12, 1, 8);
  ctx.fillStyle = PALETTE.skirting;
  ctx.fillRect(0, BOARD_TOP - 3, SCREEN.w, 3);

  // The floor, including the margins outside the board.
  ctx.fillStyle = PALETTE.floorA;
  ctx.fillRect(0, BOARD_TOP, SCREEN.w, BOARD_BOTTOM - BOARD_TOP);
  for (let lane = 1; lane < LANE_COUNT; lane += 2) {
    ctx.fillStyle = PALETTE.floorB;
    ctx.fillRect(0, laneY(lane), SCREEN.w, CELL_H);
  }

  drawLaneGrid(ctx);

  // The footer strip under the board.
  ctx.fillStyle = PALETTE.skirting;
  ctx.fillRect(0, BOARD_BOTTOM, SCREEN.w, SCREEN.h - BOARD_BOTTOM);
}

/**
 * Lane separators, only across the board itself. Extending them into the
 * margins would imply the margins are playable.
 */
function drawLaneGrid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = alpha(PALETTE.laneLine, 0.5);
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    ctx.fillRect(boardLeft(), laneY(lane), BOARD_W, 1);
  }
  ctx.fillStyle = alpha(PALETTE.laneLine, 0.22);
  for (let col = 1; col < COL_COUNT; col++) {
    ctx.fillRect(cellX(col), BOARD_TOP, 1, BOARD_BOTTOM - BOARD_TOP);
  }
}

/** Furniture over the cells a level has blocked. */
export function drawBlocked(ctx: CanvasRenderingContext2D, blocked: readonly number[]): void {
  const seen = new Set(blocked);
  for (const index of seen) {
    const lane = Math.floor(index / COL_COUNT);
    const col = index % COL_COUNT;
    const x = cellX(col);
    const y = laneY(lane);
    const art = sprite('rug');
    if (art) {
      drawSprite(ctx, art, x + CELL_W / 2, y + CELL_H / 2, CELL_W, CELL_H);
      continue;
    }
    // A rug: soft edges, low contrast, obviously not a place you build.
    ctx.fillStyle = PALETTE.rug;
    ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
    ctx.fillStyle = alpha(PALETTE.rugEdge, 0.6);
    ctx.fillRect(x + 1, y + 1, CELL_W - 2, 2);
    ctx.fillRect(x + 1, y + CELL_H - 3, CELL_W - 2, 2);
    ctx.fillStyle = alpha(PALETTE.rugEdge, 0.25);
    for (let i = 4; i < CELL_W - 4; i += 8) ctx.fillRect(x + i, y + 6, 3, CELL_H - 12);
  }
}

/** The doorway on the right. Kids walk out of it, so it stays lit. */
export function drawDoor(ctx: CanvasRenderingContext2D, time: number): void {
  const x = doorX();
  const art = sprite('door');
  if (art) {
    const top = BOARD_TOP - 20;
    const height = BOARD_BOTTOM - top;
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, x - 2, top, DOOR_W + 4, height);
    ctx.imageSmoothingEnabled = smoothing;
    return;
  }
  ctx.fillStyle = PALETTE.doorDark;
  ctx.fillRect(x + 4, BOARD_TOP - 18, DOOR_W - 8, BOARD_BOTTOM - BOARD_TOP + 18);

  // Warm landing light spilling in. Breathes very slightly, so a static board
  // still has something alive on it between waves.
  const glow = 0.16 + Math.sin(time * 1.4) * 0.03;
  ctx.fillStyle = alpha(PALETTE.doorGlow, glow);
  ctx.fillRect(x + 6, BOARD_TOP - 16, DOOR_W - 12, BOARD_BOTTOM - BOARD_TOP + 14);

  ctx.fillStyle = PALETTE.doorFrame;
  ctx.fillRect(x, BOARD_TOP - 20, 5, BOARD_BOTTOM - BOARD_TOP + 20);
  ctx.fillRect(x + DOOR_W - 5, BOARD_TOP - 20, 5, BOARD_BOTTOM - BOARD_TOP + 20);
  ctx.fillRect(x, BOARD_TOP - 20, DOOR_W, 5);
  ctx.fillStyle = PALETTE.doorSill;
  ctx.fillRect(x, BOARD_BOTTOM - 2, DOOR_W, 3);
}

/**
 * The cushion and the unicorn, on the left.
 *
 * `hurt` is 0-1: how recently a kid got a squeeze in. The unicorn squashes and
 * her ears drop, which is the entire feedback for losing a life besides the
 * hearts. A five-year-old reads the face long before she reads the counter.
 */
export function drawUnicorn(ctx: CanvasRenderingContext2D, time: number, hurt: number): void {
  const x = bedX() + 2;
  const cy = (BOARD_TOP + BOARD_BOTTOM) / 2;
  const bob = Math.sin(time * 1.8) * 1.5;

  const cushionArt = sprite('cushion');
  const unicornArt = sprite('unicorn');
  if (unicornArt) {
    if (cushionArt) drawSprite(ctx, cushionArt, x + 18, cy + 30, 40, 22);
    ctx.save();
    // She squashes down and forward when squeezed. The pose can't change on a
    // painting, so the SCALE carries it — and the eyes-shut face the painter
    // drew is replaced by the whole toy flinching, which reads fine at this size.
    const squash = 1 - hurt * 0.16;
    ctx.translate(x + 18, cy + bob + hurt * 5);
    ctx.scale(1 + hurt * 0.08, squash);
    drawSprite(ctx, unicornArt, 0, 0, 44, 62);
    ctx.restore();
    return;
  }

  // Cushion.
  ctx.fillStyle = PALETTE.cushionDark;
  ctx.fillRect(x, cy + 24, 36, 14);
  ctx.fillStyle = PALETTE.cushion;
  ctx.fillRect(x + 1, cy + 22, 34, 12);
  ctx.fillStyle = PALETTE.cushionFrill;
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * 7, cy + 34, 4, 3);

  const squash = 1 - hurt * 0.18;
  const bodyY = cy + bob + hurt * 4;

  // Body: a fat rounded blob. A stuffie, not a horse.
  ctx.fillStyle = PALETTE.unicorn;
  roundRect(ctx, x + 3, bodyY - 18 * squash, 30, 40 * squash, 12);
  ctx.fill();
  ctx.fillStyle = alpha(PALETTE.unicornShade, 0.55);
  roundRect(ctx, x + 3, bodyY + 8 * squash, 30, 14 * squash, 10);
  ctx.fill();

  // Legs.
  ctx.fillStyle = PALETTE.unicorn;
  ctx.fillRect(x + 7, bodyY + 16 * squash, 7, 8);
  ctx.fillRect(x + 22, bodyY + 16 * squash, 7, 8);

  // Head.
  const headY = bodyY - 20 * squash;
  ctx.fillStyle = PALETTE.unicorn;
  roundRect(ctx, x + 8, headY - 12, 22, 20, 8);
  ctx.fill();

  // Ears — they droop when she has just been squeezed.
  const droop = hurt * 5;
  ctx.fillStyle = PALETTE.unicorn;
  ctx.beginPath();
  ctx.moveTo(x + 11, headY - 10);
  ctx.lineTo(x + 9, headY - 17 + droop);
  ctx.lineTo(x + 15, headY - 11);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 25, headY - 10);
  ctx.lineTo(x + 28, headY - 17 + droop);
  ctx.lineTo(x + 21, headY - 11);
  ctx.closePath();
  ctx.fill();

  // Horn.
  ctx.fillStyle = PALETTE.unicornHorn;
  ctx.beginPath();
  ctx.moveTo(x + 17, headY - 11);
  ctx.lineTo(x + 19, headY - 24);
  ctx.lineTo(x + 21, headY - 11);
  ctx.closePath();
  ctx.fill();

  // Mane, down the back of the neck.
  ctx.fillStyle = PALETTE.unicornMane;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + 26 + (i % 2), headY - 8 + i * 5, 6, 5);
  }

  // Face. Eyes close on a squeeze — the clearest possible "ow" at this size.
  ctx.fillStyle = PALETTE.unicornEye;
  if (hurt > 0.35) {
    ctx.fillRect(x + 12, headY - 3, 4, 1);
    ctx.fillRect(x + 21, headY - 3, 4, 1);
  } else {
    ctx.fillRect(x + 13, headY - 4, 2, 3);
    ctx.fillRect(x + 22, headY - 4, 2, 3);
  }
  ctx.fillStyle = alpha(PALETTE.unicornBlush, 0.7);
  ctx.fillRect(x + 10, headY + 1, 4, 2);
  ctx.fillRect(x + 24, headY + 1, 4, 2);
}

/**
 * The Toy Vacuums, one parked at the left end of each lane.
 *
 * Drawn ON the board, in the strip between the cushion and column zero, so the
 * player can see how many saves are left without reading anything. A spent lane
 * shows a faint outline where its vacuum used to be — the absence has to be as
 * visible as the presence, because "this lane has no safety net any more" is
 * the single most useful thing to know at a glance.
 */
export function drawMowers(ctx: CanvasRenderingContext2D, ready: readonly boolean[], time: number): void {
  for (let lane = 0; lane < ready.length; lane++) {
    const x = bedX() + BED_W - 8;
    const y = laneY(lane) + CELL_H / 2 + 6;

    if (!ready[lane]) {
      ctx.strokeStyle = alpha(PALETTE.kidOutline, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    const art = sprite('vacuum');
    if (art) {
      drawSprite(ctx, art, x, y, 20, 16);
      continue;
    }

    ctx.fillStyle = alpha(PALETTE.toyShadow, 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // A little robot vacuum: a disc with a bumper and one blinking eye.
    ctx.fillStyle = PALETTE.cardReady;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(PALETTE.toyHighlight, 0.8);
    ctx.beginPath();
    ctx.ellipse(x - 2, y - 2, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.toyShadow;
    ctx.fillRect(x + 4, y - 1, 4, 3);
    // The eye blinks on its own clock per lane, so five of them aren't a chorus.
    const blink = Math.sin(time * 2.2 + lane * 1.7) > 0.9 ? 0 : 1;
    if (blink) {
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
}

/** Rounded rectangle path. Canvas has `roundRect` now, but not on older iOS. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
