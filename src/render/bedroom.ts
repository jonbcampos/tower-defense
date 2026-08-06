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
  LANE_COUNT,
  SCREEN,
  bedX,
  boardLeft,
  cellX,
  laneY,
} from '../game/config';
import { PALETTE, alpha } from './palette';
import { drawSprite, sprite } from './sprites';

/**
 * Wall, wainscot and the floor's lane stripes. Drawn before anything else.
 *
 * `inPlay` picks which generated backdrop to use. The menus get the pretty
 * detailed bedroom; the board gets a deliberately quiet flat floor. They are
 * different jobs — one is a postcard, the other is a surface you have to read
 * five rows of gameplay off — and trying to make one image do both makes a
 * lovely title screen and an unplayable board.
 */
export function drawRoom(ctx: CanvasRenderingContext2D, inPlay = true): void {
  // A generated room replaces the wall and floor wholesale, but the lane lines
  // are drawn over it either way — they are the grid, not decoration, and a
  // painting of a carpet does not tell you where a cell ends.
  const room = inPlay ? sprite('room') : (sprite('menu') ?? sprite('room'));
  if (room) {
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(room, 0, 0, SCREEN.w, SCREEN.h);
    ctx.imageSmoothingEnabled = smoothing;

    // Knock the painting back before anything is placed on it.
    //
    // A generated background is the one asset that competes with the game
    // rather than serving it: it is detailed, it is the same pastel palette as
    // the characters, and it covers the entire screen. Without this the kids
    // and toys sit ON a picture instead of IN a room, and the first full art
    // run made the board genuinely harder to read than the flat colours it
    // replaced. The scrim costs nothing and is not negotiable.
    if (inPlay) {
      ctx.fillStyle = alpha(PALETTE.scrim, 0.3);
      ctx.fillRect(0, BOARD_TOP, SCREEN.w, BOARD_BOTTOM - BOARD_TOP);
      drawLaneGrid(ctx, true);
    }
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
function drawLaneGrid(ctx: CanvasRenderingContext2D, overArt = false): void {
  // Over generated art the grid has to shout, because the art underneath it is
  // busy. Over the flat floor it can whisper. Which lane a kid is in and which
  // cell a toy will land in are the two things the player reads constantly, so
  // the grid is the last thing allowed to become decorative.
  ctx.fillStyle = alpha(PALETTE.laneLine, overArt ? 0.85 : 0.5);
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    ctx.fillRect(boardLeft(), laneY(lane), BOARD_W, 1);
  }
  ctx.fillStyle = alpha(PALETTE.laneLine, overArt ? 0.4 : 0.22);
  for (let col = 1; col < COL_COUNT; col++) {
    ctx.fillRect(cellX(col), BOARD_TOP, 1, BOARD_BOTTOM - BOARD_TOP);
  }
}

/**
 * Furniture over the cells a level has blocked.
 *
 * The art alone is not enough and never was. A pretty rug drawn in a cell reads
 * as "there is a rug here", which is true and useless — the thing the player
 * has to know is "you cannot build here", and the first person to play the
 * illustrated version said exactly that: the carpet doesn't read as
 * non-playable.
 *
 * So every blocked cell gets the same three-part treatment regardless of what
 * is drawn in it: the furniture, then a DARKENING so it is visibly not floor,
 * then a hard inset border so the boundary is a line rather than a vibe. The
 * board should look like it has holes cut in it.
 */
export function drawBlocked(ctx: CanvasRenderingContext2D, blocked: readonly number[]): void {
  const seen = new Set(blocked);
  const art = sprite('rug');
  for (const index of seen) {
    const lane = Math.floor(index / COL_COUNT);
    const col = index % COL_COUNT;
    const x = cellX(col);
    const y = laneY(lane);

    if (art) {
      drawSprite(ctx, art, x + CELL_W / 2, y + CELL_H / 2, CELL_W, CELL_H);
    } else {
      // A rug: soft edges, low contrast, obviously not a place you build.
      ctx.fillStyle = PALETTE.rug;
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
      ctx.fillStyle = alpha(PALETTE.rugEdge, 0.6);
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, 2);
      ctx.fillRect(x + 1, y + CELL_H - 3, CELL_W - 2, 2);
      ctx.fillStyle = alpha(PALETTE.rugEdge, 0.25);
      for (let i = 4; i < CELL_W - 4; i += 8) ctx.fillRect(x + i, y + 6, 3, CELL_H - 12);
    }

    // Sunk into shadow. This is what turns "a rug" into "not your floor".
    ctx.fillStyle = alpha(PALETTE.scrim, 0.42);
    ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);

    // And a hard edge, so where it stops is unambiguous.
    ctx.strokeStyle = alpha(PALETTE.scrim, 0.75);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
    ctx.strokeStyle = alpha(PALETTE.laneLine, 0.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3.5, y + 3.5, CELL_W - 7, CELL_H - 7);
  }
}

/**
 * The cushion and the unicorn, on the left.
 *
 * `hurt` is 0-1: how recently a kid got a squeeze in. The unicorn squashes and
 * her ears drop, which is the entire feedback for losing a life besides the
 * hearts. A five-year-old reads the face long before she reads the counter.
 */
export function drawUnicorn(ctx: CanvasRenderingContext2D, time: number, hurt: number): void {
  const x = bedX() + 1;
  const cy = (BOARD_TOP + BOARD_BOTTOM) / 2;
  const bob = Math.sin(time * 1.8) * 1.5;

  const cushionArt = sprite('cushion');
  const unicornArt = sprite('unicorn');
  if (unicornArt) {
    if (cushionArt) drawSprite(ctx, cushionArt, x + 25, cy + 31, 54, 26);
    ctx.save();
    // She squashes down and forward when squeezed. The pose can't change on a
    // painting, so the SCALE carries it — and the eyes-shut face the painter
    // drew is replaced by the whole toy flinching, which reads fine at this size.
    const squash = 1 - hurt * 0.16;
    ctx.translate(x + 25, cy + bob + hurt * 5);
    ctx.scale(1 + hurt * 0.08, squash);
    // Bigger now that the doorway's 44px went to this side. She is the thing
    // the whole game is about and she was previously a thumbnail wedged behind
    // a row of vacuum cleaners.
    drawSprite(ctx, unicornArt, 0, 0, 58, 78);
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
 * The unicorn's corner: a lamplit nook to the left of the board.
 *
 * The strip left of column zero is not playable and never will be, so with a
 * flat carpet under it and one small character on it, it read as dead space —
 * a margin the artist forgot rather than a place. This gives it a reason to
 * exist: a warm pool of lamplight, a round bedside rug, and a couple of toys
 * she has left lying about.
 *
 * Everything here is procedural rather than another generated image, for one
 * reason: it has to fit the strip EXACTLY, and the strip's width is a layout
 * constant that has already changed twice. A painting sized to a 68px strip
 * would be wrong the next time that number moves; an ellipse and a gradient
 * are right at any width.
 *
 * It also has to stay visibly UNPLACEABLE. No straight edges, no cell-sized
 * anything, nothing that could be mistaken for a square you could build on.
 */
export function drawNook(ctx: CanvasRenderingContext2D): void {
  const cx = bedX() + 26;
  const cy = (BOARD_TOP + BOARD_BOTTOM) / 2;

  // Lamplight from above, pooling on the floor around her.
  const glow = ctx.createRadialGradient(cx, cy - 10, 6, cx, cy - 10, 96);
  glow.addColorStop(0, alpha(PALETTE.doorGlow, 0.2));
  glow.addColorStop(0.55, alpha(PALETTE.doorGlow, 0.07));
  glow.addColorStop(1, alpha(PALETTE.doorGlow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, BOARD_TOP, bedX() + BED_W, BOARD_BOTTOM - BOARD_TOP);

  // A round bedside rug. Round on purpose — nothing else on the floor is.
  ctx.fillStyle = alpha(PALETTE.cushionDark, 0.28);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 24, 40, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.cushionFrill, 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 24, 33, 21, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Toys she has left out. Small, soft, and well away from the vacuum column.
  ctx.fillStyle = alpha(PALETTE.unicornMane, 0.5);
  ctx.beginPath();
  ctx.arc(cx - 20, cy - 44, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(PALETTE.sparkle, 0.4);
  ctx.beginPath();
  ctx.arc(cx + 16, cy + 52, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(PALETTE.shotBubble, 0.35);
  ctx.beginPath();
  ctx.arc(cx - 15, cy + 56, 3, 0, Math.PI * 2);
  ctx.fill();
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
  const art = sprite('vacuum');
  for (let lane = 0; lane < ready.length; lane++) {
    const x = bedX() + BED_W - 14;
    const y = laneY(lane) + CELL_H / 2 + 2;

    // The DOCK is drawn whether or not the vacuum is in it.
    //
    // This is the whole fix. Previously a spent lane showed a faint ellipse
    // outline and nothing else, which the first player reported as "circles
    // that the kids hit" — an unexplained shape doing an unexplained thing. A
    // dock that is sometimes full and sometimes empty is a sentence: there is a
    // slot here, something lives in it, and in this lane it has been used up.
    ctx.fillStyle = alpha(PALETTE.scrim, ready[lane] ? 0.3 : 0.45);
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!ready[lane]) {
      // Empty dock: a scuff where it used to sit. No outline that could be
      // mistaken for an object.
      ctx.strokeStyle = alpha(PALETTE.laneLine, 0.35);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 7, 10, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }

    // Ready: a soft pulse so she can see at a glance which lanes still have a
    // net under them. Big enough to actually recognise — it was 20x16, which at
    // this scale is a dot.
    const pulse = 0.1 + Math.sin(time * 2 + lane * 1.3) * 0.05;
    ctx.fillStyle = alpha(PALETTE.cardReady, pulse);
    ctx.beginPath();
    ctx.ellipse(x, y, 17, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    if (art) {
      drawSprite(ctx, art, x, y, 30, 26);
      continue;
    }

    // A little robot vacuum: a disc with a bumper and one blinking eye.
    ctx.fillStyle = PALETTE.cardReady;
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(PALETTE.toyHighlight, 0.8);
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 2.5, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.toyShadow;
    ctx.fillRect(x + 6, y - 1.5, 5, 4);
    const blink = Math.sin(time * 2.2 + lane * 1.7) > 0.9 ? 0 : 1;
    if (blink) {
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
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
