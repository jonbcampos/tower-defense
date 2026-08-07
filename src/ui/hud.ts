/**
 * The footer strip: hearts, level name, wave progress — plus floating popups.
 *
 * The popup pool lives here rather than in `GameState` because nothing in the
 * simulation reads it. A number floating up off a collected sparkle is a thing
 * the player is told, not a thing the game knows.
 */

import {
  BOARD_BOTTOM,
  FORGIVE,
  JUICE,
  MIN_VIRTUAL_W,
  POOL,
  SCREEN,
  SQUEEZE_LIVES,
  VIRTUAL_H,
} from '../game/config';
import type { GameState } from '../game/state';
import { PALETTE, alpha } from '../render/palette';
import { drawIcon } from './icons';
import { drawText } from './text';

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  active: boolean;
}

const popups: Popup[] = [];
let cursor = 0;
for (let i = 0; i < POOL.popups; i++) {
  popups.push({ x: 0, y: 0, text: '', color: PALETTE.hudText, life: 0, active: false });
}

export function addPopup(x: number, y: number, text: string, color = PALETTE.sparkle): void {
  const popup = popups[cursor]!;
  cursor = (cursor + 1) % popups.length;
  popup.x = x;
  popup.y = y;
  popup.text = text;
  popup.color = color;
  popup.life = JUICE.popupSeconds;
  popup.active = true;
}

export function updateHud(dt: number): void {
  for (const popup of popups) {
    if (!popup.active) continue;
    popup.life -= dt;
    if (popup.life <= 0) popup.active = false;
  }
}

export function resetHud(): void {
  for (const popup of popups) popup.active = false;
}

export function drawPopups(ctx: CanvasRenderingContext2D): void {
  for (const popup of popups) {
    if (!popup.active) continue;
    const progress = 1 - popup.life / JUICE.popupSeconds;
    drawText(ctx, popup.text, popup.x, popup.y - progress * JUICE.popupRise, {
      size: 9,
      align: 'center',
      color: alpha(popup.color, 1 - progress * progress),
      glow: true,
    });
  }
}

/**
 * The pause button: bottom-left corner, in the footer.
 *
 * It is in the FOOTER and not in the tray for two reasons. The tray is already
 * full — the purse owns the left end, the broom owns the right, and eight cards
 * fill what is between them on the narrowest frame — but more importantly the
 * tray is where a thumb goes on purpose, forty times a run. Stopping the game is
 * not a thing that should live one card-width from "place a Bubble Machine".
 *
 * The far corner under the board is the least-travelled pixel on the screen:
 * nothing is ever placed there, no sparkle ever falls there, and the hearts
 * beside it are read rather than pressed.
 */
const PAUSE_W = 20;
const PAUSE_H = 20;

export function pauseRect(): { x: number; y: number; w: number; h: number } {
  const y = BOARD_BOTTOM + (VIRTUAL_H - BOARD_BOTTOM - PAUSE_H) / 2;
  return { x: 5, y, w: PAUSE_W, h: PAUSE_H };
}

export function hitTestPause(x: number, y: number): boolean {
  const pad = FORGIVE.cardTapPad;
  const r = pauseRect();
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

export function drawFooter(ctx: CanvasRenderingContext2D, state: GameState): void {
  const y = BOARD_BOTTOM + (VIRTUAL_H - BOARD_BOTTOM) / 2;

  drawPause(ctx);
  // The hearts start past the pause button rather than at the edge. They are
  // the most important number on the screen and they stay leftmost of the
  // things that are *information*; the button is a control, and controls in
  // this game live in corners.
  drawHearts(ctx, 32, y, state.lives);

  drawText(ctx, state.level.name.toUpperCase(), SCREEN.w / 2, y, {
    size: 9,
    align: 'center',
    color: PALETTE.hudDim,
  });

  // Wave progress. A bar rather than "3/5" because a five-year-old reads a bar
  // filling up long before she reads a fraction.
  const total = Math.max(1, state.waves.total);
  const done = Math.min(total, state.waves.index + (state.waves.spawnedEverything ? 1 : 0));
  const barW = 76;
  const barX = SCREEN.w - barW - 8;
  ctx.fillStyle = PALETTE.progressTrack;
  ctx.fillRect(barX, y - 4, barW, 8);
  ctx.fillStyle = PALETTE.progressFill;
  ctx.fillRect(barX, y - 4, (barW * done) / total, 8);
  ctx.strokeStyle = alpha(PALETTE.hudDim, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, y - 3.5, barW - 1, 7);
  // The last wave gets a tick, so "one more" is visible rather than inferred.
  ctx.fillStyle = alpha(PALETTE.hudText, 0.6);
  ctx.fillRect(barX + barW - Math.round(barW / total), y - 4, 1, 8);
}

/**
 * Quiet on purpose — the exact opposite of the broom.
 *
 * The broom shouts because arming it is one tap away from destroying a
 * 250-sparkle toy. This button destroys nothing: it stops the clock and asks a
 * question, and both answers are safe. So it is drawn dim, in the footer's own
 * muted colour, and it does not pulse, fill in or animate. A five-year-old
 * should be able to find it when she wants it and never notice it when she
 * doesn't.
 */
function drawPause(ctx: CanvasRenderingContext2D): void {
  const r = pauseRect();
  ctx.fillStyle = alpha(PALETTE.scrim, 0.35);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = alpha(PALETTE.hudDim, 0.55);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  drawIcon(ctx, 'pause', r.x + r.w / 2, r.y + r.h / 2, 11, PALETTE.hudDim);
}

/**
 * Footer layout contracts, on the same rule as the tray's.
 *
 * They live here rather than in `validateDesignContracts` for the reason that
 * one does: reaching into the interface's geometry from inside `src/game/`
 * would make the simulation depend on the screen.
 */
export function validateHudContracts(): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) problems.push(message);
  };

  const r = pauseRect();
  check(
    r.y >= BOARD_BOTTOM && r.y + r.h <= VIRTUAL_H,
    `the pause button spans y=${r.y}..${r.y + r.h}, outside the footer that runs ${BOARD_BOTTOM}..${VIRTUAL_H}`,
  );
  // The hearts are drawn from x=32 at 13px apart and are about 9 wide, so this
  // is where the last one ends. A pause button that reached into them would be
  // a control overlapping the one readout that must never be misread.
  check(
    r.x + r.w < 32,
    `the pause button ends at x=${r.x + r.w} and the hearts start at x=32 — they overlap`,
  );
  // On the NARROWEST frame, because that is the only one where the hearts and
  // the centred level name could meet — the same rule the broom check follows.
  check(
    32 + (SQUEEZE_LIVES - 1) * 13 + 9 < MIN_VIRTUAL_W / 2 - 60,
    `${SQUEEZE_LIVES} hearts reach x=${32 + (SQUEEZE_LIVES - 1) * 13 + 9} on a ${MIN_VIRTUAL_W}px frame, into the centred level name`,
  );
  // Big enough for a five-year-old, and no bigger: this is the one control on
  // the play screen she is not meant to press by accident.
  check(
    PAUSE_W + FORGIVE.cardTapPad * 2 >= 30 && PAUSE_H + FORGIVE.cardTapPad * 2 >= 30,
    `the pause button's tap area is ${PAUSE_W + FORGIVE.cardTapPad * 2}x${PAUSE_H + FORGIVE.cardTapPad * 2}, below a fingertip`,
  );

  return problems;
}

/**
 * Hearts, drawn as blocks rather than outlines.
 *
 * Filled and empty differ in VALUE, not just colour: an empty heart is dark and
 * flat, a full one is bright. At this size a red-versus-grey outline is
 * indistinguishable across a room, and how many squeezes are left is the most
 * important number on screen.
 */
function drawHearts(ctx: CanvasRenderingContext2D, x: number, y: number, lives: number): void {
  for (let i = 0; i < SQUEEZE_LIVES; i++) {
    const cx = x + i * 13;
    ctx.fillStyle = i < lives ? PALETTE.heartFull : PALETTE.heartEmpty;
    ctx.fillRect(cx, y - 3, 3, 5);
    ctx.fillRect(cx + 6, y - 3, 3, 5);
    ctx.fillRect(cx + 1, y - 5, 7, 3);
    ctx.fillRect(cx + 1, y + 2, 7, 2);
    ctx.fillRect(cx + 3, y + 4, 3, 2);
  }
}
