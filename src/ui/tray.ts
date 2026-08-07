/**
 * The toy tray.
 *
 * Cards are laid out from one list that both the drawing and the hit-testing
 * read. Deriving both from the same source means a card can never end up drawn
 * somewhere other than where it is tappable — the sibling games learned that
 * one the hard way, and it is the single most infuriating class of bug for
 * someone who cannot tell you what went wrong, only that "it didn't work".
 *
 * The tray lives entirely above the board, and `validateTrayContracts` proves
 * it. A card drawn over a cell would make the top row of the board untappable,
 * which is a whole lane of the game quietly disappearing.
 */

import {
  BOARD_TOP,
  FORGIVE,
  SCREEN,
  MAX_LOADOUT_SLOTS,
  MIN_VIRTUAL_W,
  TRAY_H,
  cellCentreX,
} from '../game/config';
import type { GameState } from '../game/state';
import { TOYS, TOY_ORDER, type ToyId } from '../game/toys';
import { PALETTE, alpha } from '../render/palette';
import { drawToyArt } from '../render/toys';
import { drawText } from './text';

const CARD_W = 42;
const CARD_H = 36;
const CARD_Y = 4;
const CARD_GAP = 3;
/** Left edge of the first card, past the purse readout. */
const CARDS_X = 62;

/**
 * The broom, parked at the right-hand end of the tray.
 *
 * Anchored to the FRAME rather than to the end of the cards, and that is the
 * whole point. The tray grows by a card at every world boundary, so a broom
 * that sat after the last card would move three times over a campaign — and a
 * tool whose position changes is a tool nobody builds a habit for. It is in the
 * same place on level one and on level forty.
 */
const BROOM_W = 34;
const BROOM_H = 32;

/**
 * `width` defaults to the live frame. The contract below passes
 * `MIN_VIRTUAL_W` instead, because the only frame on which the broom and the
 * cards could ever meet is the narrowest one — and a check that measured
 * whatever window happened to be open would pass on a desktop and ship a
 * collision to a phone. Exactly the mistake decision 46 caught in the
 * card-overflow check.
 */
export function broomRect(width = SCREEN.w): { x: number; y: number; w: number; h: number } {
  return { x: width - BROOM_W - 4, y: CARD_Y + 2, w: BROOM_W, h: BROOM_H };
}

export function hitTestBroom(x: number, y: number): boolean {
  const pad = FORGIVE.cardTapPad;
  const r = broomRect();
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

export interface CardRect {
  id: ToyId;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function trayCards(loadout: readonly ToyId[]): CardRect[] {
  return loadout.map((id, index) => ({
    id,
    index,
    x: CARDS_X + index * (CARD_W + CARD_GAP),
    y: CARD_Y,
    w: CARD_W,
    h: CARD_H,
  }));
}

/**
 * There is no sweeper button.
 *
 * There used to be one parked here in the corner, and the first person to play
 * the game asked what it was and reported that it didn't do anything. It didn't
 * — it couldn't be selected at all — but the real problem was that a
 * free-floating panic button with no home on the board is not something anyone
 * can guess the meaning of. It became the Guard Bear, who sits at the end of
 * each lane where you can see it, fires by itself, and needs no explanation.
 */

export function hitTestCard(loadout: readonly ToyId[], x: number, y: number): CardRect | null {
  const pad = FORGIVE.cardTapPad;
  for (const card of trayCards(loadout)) {
    if (
      x >= card.x - pad &&
      x <= card.x + card.w + pad &&
      y >= card.y - pad &&
      y <= card.y + card.h + pad
    ) {
      return card;
    }
  }
  return null;
}

export function drawTray(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  ctx.fillStyle = alpha(PALETTE.tray, 0.92);
  ctx.fillRect(0, 0, SCREEN.w, TRAY_H);
  ctx.fillStyle = PALETTE.trayEdge;
  ctx.fillRect(0, TRAY_H - 2, SCREEN.w, 2);

  drawPurse(ctx, state.purse);

  for (const card of trayCards(state.loadout)) {
    drawCard(ctx, state, card, time);
  }

  drawBroom(ctx, state.sweeping, time);
}

/**
 * The broom button, and a loud armed state.
 *
 * Loud on purpose. This is the only control in the game that DESTROYS
 * something, and the one guard against sweeping a 250-sparkle Bubble Machine by
 * accident is that being armed has to be impossible to miss — the button fills
 * in, the outline pulses, and every cell holding something lights up. Compare
 * the card's held state, which is a thin ring: picking a card up is reversible
 * and this is not.
 */
function drawBroom(ctx: CanvasRenderingContext2D, armed: boolean, time: number): void {
  const r = broomRect();
  ctx.fillStyle = armed ? PALETTE.hudWarn : PALETTE.card;
  roundedRect(ctx, r.x, r.y, r.w, r.h, 5);
  ctx.fill();

  drawBroomIcon(ctx, r.x + r.w / 2, r.y + r.h / 2, armed);

  ctx.lineWidth = armed ? 2 : 1;
  ctx.strokeStyle = armed ? PALETTE.cardReady : PALETTE.cardEdge;
  roundedRect(ctx, r.x, r.y, r.w, r.h, 5);
  ctx.stroke();
  if (armed) {
    ctx.strokeStyle = alpha(PALETTE.cardReady, 0.5 + Math.sin(time * 8) * 0.3);
    ctx.lineWidth = 1;
    roundedRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 6);
    ctx.stroke();
  }
}

/**
 * A dustpan brush: a handle and a splayed head of bristles.
 *
 * Drawn rather than generated, unlike every toy. It is a piece of INTERFACE and
 * not a thing on the board, so it wants to look like the buttons around it —
 * flat, small and legible at 20 pixels — rather than like a painted object
 * sitting in a card.
 */
function drawBroomIcon(ctx: CanvasRenderingContext2D, x: number, y: number, armed: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  const ink = armed ? PALETTE.tray : PALETTE.cardEdge;

  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(0, 1);
  ctx.stroke();

  // The head, wider at the bottom, with the bristles drawn as separate strokes
  // so it reads as a brush rather than as a hammer.
  ctx.fillStyle = armed ? PALETTE.tray : PALETTE.sparkle;
  ctx.beginPath();
  ctx.moveTo(-4, 1);
  ctx.lineTo(4, 1);
  ctx.lineTo(6.5, 9);
  ctx.lineTo(-6.5, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2.5, 2);
    ctx.lineTo(i * 4, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPurse(ctx: CanvasRenderingContext2D, purse: number): void {
  ctx.fillStyle = PALETTE.card;
  roundedRect(ctx, 4, CARD_Y, 52, CARD_H, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.sparkle;
  ctx.beginPath();
  ctx.arc(15, CARD_Y + CARD_H / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.sparkleCore;
  ctx.beginPath();
  ctx.arc(13, CARD_Y + CARD_H / 2 - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  drawText(ctx, String(purse), 50, CARD_Y + CARD_H / 2, {
    size: 12,
    align: 'right',
    color: PALETTE.tray,
  });
}

function drawCard(ctx: CanvasRenderingContext2D, state: GameState, card: CardRect, time: number): void {
  const def = TOYS[card.id];
  const cost = state.costOf(card.id);
  const ready = state.isReady(card.id);
  const afford = state.canAfford(card.id);
  const held = state.selected === card.id;
  const usable = ready && afford;

  ctx.fillStyle = usable ? PALETTE.card : PALETTE.cardUnaffordable;
  roundedRect(ctx, card.x, card.y, card.w, card.h, 5);
  ctx.fill();

  // The art sits high on the card with the price under it, and it is drawn
  // greyed rather than hidden when unaffordable — knowing what you cannot yet
  // afford is most of the reason to build a jar.
  ctx.save();
  if (!usable) ctx.globalAlpha = 0.45;
  drawToyArt(ctx, card.id, card.x + card.w / 2, card.y + 15, 0.62, time);
  ctx.restore();

  drawText(ctx, String(cost), card.x + card.w / 2, card.y + card.h - 7, {
    size: 9,
    align: 'center',
    color: afford ? PALETTE.tray : PALETTE.hudWarn,
  });

  // The recharge sweeps up from the bottom, so "nearly ready" is a glance.
  if (!ready) {
    const left = state.cooldowns.get(card.id) ?? 0;
    const share = Math.min(1, left / Math.max(0.001, def.recharge));
    ctx.fillStyle = alpha(PALETTE.cardCharging, 0.72);
    ctx.fillRect(card.x, card.y + card.h * (1 - share), card.w, card.h * share);
  }

  ctx.lineWidth = held ? 2 : 1;
  ctx.strokeStyle = held ? PALETTE.cardReady : PALETTE.cardEdge;
  roundedRect(ctx, card.x, card.y, card.w, card.h, 5);
  ctx.stroke();

  if (held) {
    ctx.strokeStyle = alpha(PALETTE.cardReady, 0.5 + Math.sin(time * 8) * 0.3);
    ctx.lineWidth = 1;
    roundedRect(ctx, card.x - 2, card.y - 2, card.w + 4, card.h + 4, 6);
    ctx.stroke();
  }
}


/**
 * Layout contracts.
 *
 * These live here rather than in `validateDesignContracts` for exactly the
 * reason flappy's touchpad contract does: reaching for the tray's geometry from
 * inside `src/game/` would make the simulation depend on the interface, and
 * that is the one boundary this codebase does not bend.
 */
export function validateTrayContracts(): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) problems.push(message);
  };

  check(
    CARD_Y + CARD_H <= BOARD_TOP,
    `a tray card runs to y=${CARD_Y + CARD_H}, over the board that starts at y=${BOARD_TOP} — the top lane would be untappable`,
  );

  // The MOST cards the tray can ever be asked to hold, plus the purse, have to
  // fit the narrowest frame. Checked against the maximum rather than against
  // five, because the count grows with progress — see `loadoutSlotsFor` — and a
  // tray that fits today and overflows at level 21 is a bug nobody meets until
  // a child has played for a week.
  const most: ToyId[] = [];
  for (let i = 0; i < MAX_LOADOUT_SLOTS; i++) most.push(TOY_ORDER[i % TOY_ORDER.length]!);
  const cards = trayCards(most);
  const last = cards[cards.length - 1]!;
  check(
    last.x + last.w < SCREEN.w - 8,
    `${MAX_LOADOUT_SLOTS} cards reach x=${last.x + last.w} on a ${SCREEN.w}px frame — the tray overflows`,
  );

  // The broom is anchored to the right edge of the frame and the cards grow
  // from the left, so the two have to be proved not to meet — on the NARROWEST
  // frame, with the MOST cards, which is the only case where they could.
  const broom = broomRect(MIN_VIRTUAL_W);
  check(
    last.x + last.w < broom.x - 6,
    `with ${MAX_LOADOUT_SLOTS} cards the last one ends at x=${
      last.x + last.w
    } and the broom starts at x=${broom.x} — they collide on the narrowest ${MIN_VIRTUAL_W}px frame`,
  );
  check(
    broom.x + broom.w <= MIN_VIRTUAL_W - 2 && broom.y + broom.h <= BOARD_TOP,
    `the broom occupies ${broom.x}..${broom.x + broom.w} x ${broom.y}..${
      broom.y + broom.h
    }, outside the tray on the narrowest ${MIN_VIRTUAL_W}px frame`,
  );

  // A card has to be at least as big as the cells it competes with for thumbs.
  check(
    CARD_W >= 34 && CARD_H >= 30,
    `a card is ${CARD_W}x${CARD_H}; anything smaller is below a five-year-old's fingertip`,
  );

  // And the board's own left edge has to clear the purse readout, so the
  // unicorn is never hidden behind the money.
  check(
    cellCentreX(0) > 56,
    `column zero is centred at x=${cellCentreX(0)}, under the purse readout that ends at x=56`,
  );

  return problems;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
