/**
 * The footer strip: hearts, level name, wave progress — plus floating popups.
 *
 * The popup pool lives here rather than in `GameState` because nothing in the
 * simulation reads it. A number floating up off a collected sparkle is a thing
 * the player is told, not a thing the game knows.
 */

import {
  BOARD_BOTTOM,
  JUICE,
  POOL,
  SCREEN,
  SQUEEZE_LIVES,
  VIRTUAL_H,
} from '../game/config';
import type { GameState } from '../game/state';
import { PALETTE, alpha } from '../render/palette';
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

export function drawFooter(ctx: CanvasRenderingContext2D, state: GameState): void {
  const y = BOARD_BOTTOM + (VIRTUAL_H - BOARD_BOTTOM) / 2;

  drawHearts(ctx, 8, y, state.lives);

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
