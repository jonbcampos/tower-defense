/**
 * Title, level select, and the win/lose cards.
 *
 * Every screen is a list of `MenuRect`s that both the drawing and the
 * hit-testing read, so a button can never be drawn somewhere other than where
 * it is tappable. Menus are polled from `main.ts` rather than inside the
 * simulation, because they aren't part of it.
 */

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  SCREEN,
  VIRTUAL_H,
  type DifficultyId,
} from '../game/config';
import { LEVELS, LEVEL_COUNT } from '../game/levels';
import { TOYS, type ToyId } from '../game/toys';
import { PALETTE, alpha } from '../render/palette';
import { drawToyArt } from '../render/toys';
import { starsFor, type Save } from '../core/save';
import { drawIcon, drawTick, type IconId } from './icons';
import { drawText, setFont } from './text';

export interface MenuRect {
  /** `level:3`, `diff:kid`, `back`, `retry`, `next`, `menu`, `mute`. */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub: string;
  enabled: boolean;
  /** A pictogram drawn beside the label, for the player who isn't reading yet. */
  icon: IconId;
}

const TAP_PAD = 6;

export function hitTestMenu(rects: readonly MenuRect[], x: number, y: number): MenuRect | null {
  for (const rect of rects) {
    if (!rect.enabled) continue;
    if (
      x >= rect.x - TAP_PAD &&
      x <= rect.x + rect.w + TAP_PAD &&
      y >= rect.y - TAP_PAD &&
      y <= rect.y + rect.h + TAP_PAD
    ) {
      return rect;
    }
  }
  return null;
}

export function muteButton(): MenuRect {
  return {
    id: 'mute',
    x: SCREEN.w - 30,
    y: 8,
    w: 22,
    h: 22,
    label: '',
    sub: '',
    enabled: true,
    icon: 'none',
  };
}

/** Title: pick a difficulty, which is also the button that starts. */
export function titleMenu(): MenuRect[] {
  const w = 104;
  const gap = 10;
  const total = DIFFICULTY_ORDER.length * w + (DIFFICULTY_ORDER.length - 1) * gap;
  const startX = (SCREEN.w - total) / 2;
  return DIFFICULTY_ORDER.map((id, index) => ({
    id: `diff:${id}`,
    x: startX + index * (w + gap),
    y: 158,
    w,
    h: 44,
    label: DIFFICULTIES[id].label,
    sub: DIFFICULTY_BLURB[id],
    enabled: true,
    icon: id === 'kid' ? 'easy' : id === 'normal' ? 'normal' : 'hard',
  }));
}

const DIFFICULTY_BLURB: Record<DifficultyId, string> = {
  // Written for the person choosing FOR a child, and for the child. Neither
  // "casual" nor "hard mode" tells either of them anything useful.
  kid: 'sparkles collect themselves',
  normal: 'you collect, you choose',
  hard: 'more kids, faster',
};

const CARD_W = 62;
const CARD_H = 56;
const CARD_GAP = 8;

export function levelMenu(save: Save): MenuRect[] {
  const perRow = 5;
  const total = perRow * CARD_W + (perRow - 1) * CARD_GAP;
  const startX = Math.round((SCREEN.w - total) / 2);
  const rects: MenuRect[] = LEVELS.map((level, index) => {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    return {
      id: `level:${level.id}`,
      x: startX + col * (CARD_W + CARD_GAP),
      y: 62 + row * (CARD_H + 10),
      w: CARD_W,
      h: CARD_H,
      label: String(level.id),
      sub: level.name,
      enabled: level.id <= save.unlocked,
      icon: 'none',
    };
  });
  rects.push({
    id: 'back',
    x: 8,
    y: VIRTUAL_H - 30,
    w: 70,
    h: 22,
    label: 'BACK',
    sub: '',
    enabled: true,
    icon: 'back',
  });
  return rects;
}

/**
 * The loadout picker, on NORMAL and HARD.
 *
 * Choosing five cards before you can see the board is the ritual that makes a
 * lane defence a strategy game rather than a reaction game — you are committing
 * to a plan against a level you have to remember. EASY skips it entirely and is
 * dealt `level.recommended`, because "pick five of ten things you have never
 * used" is a wall, not a choice.
 */
export function loadoutMenu(available: readonly ToyId[]): MenuRect[] {
  const perRow = 5;
  const w = 56;
  const h = 52;
  const gap = 8;
  const total = perRow * w + (perRow - 1) * gap;
  const startX = Math.round((SCREEN.w - total) / 2);
  const rects: MenuRect[] = available.map((id, index) => ({
    id: `toy:${id}`,
    x: startX + (index % perRow) * (w + gap),
    y: 58 + Math.floor(index / perRow) * (h + 10),
    w,
    h,
    label: TOYS[id].name,
    sub: '',
    enabled: true,
    icon: 'none',
  }));
  rects.push({
    id: 'play',
    x: SCREEN.w / 2 + 6,
    y: VIRTUAL_H - 34,
    w: 96,
    h: 26,
    label: 'PLAY',
    sub: '',
    enabled: true,
    icon: 'play',
  });
  rects.push({
    id: 'back',
    x: SCREEN.w / 2 - 102,
    y: VIRTUAL_H - 34,
    w: 96,
    h: 26,
    label: 'BACK',
    sub: '',
    enabled: true,
    icon: 'back',
  });
  return rects;
}

export function drawLoadout(
  ctx: CanvasRenderingContext2D,
  available: readonly ToyId[],
  picked: readonly ToyId[],
  max: number,
  time: number,
): void {
  drawScrim(ctx, 0.85);

  const none = picked.length === 0;
  drawText(ctx, none ? 'TAP THE TOYS YOU WANT' : max === 1 ? 'PICK YOUR TOY' : `PICK ${max} TOYS`, SCREEN.w / 2, 26, {
    size: 14,
    align: 'center',
    color: none ? PALETTE.hudAccent : PALETTE.hudText,
    glow: true,
  });
  drawText(ctx, `${picked.length} / ${max}`, SCREEN.w - 10, 26, {
    size: 10,
    align: 'right',
    color: picked.length === max ? PALETTE.cardReady : PALETTE.hudDim,
  });

  for (const rect of loadoutMenu(available)) {
    if (!rect.id.startsWith('toy:')) {
      // PLAY is visibly dead until something is chosen, rather than looking
      // ready and then refusing. A button that silently does nothing is the
      // single worst thing you can put in front of a five-year-old: she has no
      // way to tell "I did it wrong" from "the game is broken", so she taps it
      // harder. It reads DIMMED and the heading turns into the instruction.
      const dead = rect.id === 'play' && none;
      drawButton(ctx, rect, rect.id === 'play' && !none, dead);
      continue;
    }
    const id = rect.id.slice('toy:'.length) as ToyId;
    const chosen = picked.includes(id);

    // Chosen and unchosen differ in THREE ways at once — brightness, border
    // weight, and a tick badge. One of those is a thing to miss; three is not.
    ctx.fillStyle = chosen ? PALETTE.card : alpha(PALETTE.card, 0.3);
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
    ctx.fill();
    ctx.save();
    if (!chosen) ctx.globalAlpha = 0.4;
    drawToyArt(ctx, id, rect.x + rect.w / 2, rect.y + 18, 0.72, time);
    ctx.restore();
    drawText(ctx, String(TOYS[id].cost), rect.x + rect.w / 2, rect.y + rect.h - 9, {
      size: 8,
      align: 'center',
      color: chosen ? PALETTE.tray : PALETTE.hudDim,
    });
    ctx.lineWidth = chosen ? 3 : 1;
    ctx.strokeStyle = chosen ? PALETTE.cardReady : PALETTE.trayEdge;
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
    ctx.stroke();
    if (chosen) {
      drawTick(ctx, rect.x + rect.w - 7, rect.y + 7, 7, PALETTE.cardReady, PALETTE.tray);
    }
  }
}

export function resultMenu(won: boolean, hasNext: boolean): MenuRect[] {
  const rects: MenuRect[] = [];
  const y = 176;
  if (won && hasNext) {
    rects.push({
      id: 'next', x: SCREEN.w / 2 - 112, y, w: 104, h: 34,
      label: 'NEXT', sub: '', enabled: true, icon: 'next',
    });
    rects.push({
      id: 'retry', x: SCREEN.w / 2 + 8, y, w: 104, h: 34,
      label: 'AGAIN', sub: '', enabled: true, icon: 'again',
    });
  } else {
    rects.push({
      id: 'retry',
      x: SCREEN.w / 2 - 60,
      y,
      w: 120,
      h: 34,
      label: won ? 'AGAIN' : 'TRY AGAIN',
      sub: '',
      enabled: true,
      icon: 'again',
    });
  }
  rects.push({
    id: 'menu',
    x: SCREEN.w / 2 - 52,
    y: y + 42,
    w: 104,
    h: 26,
    label: 'LEVELS',
    sub: '',
    enabled: true,
    icon: 'levels',
  });
  return rects;
}

// --- Drawing ----------------------------------------------------------------

let mutedForDisplay = false;
/**
 * Mirrored here rather than read from storage in the draw path — this runs
 * sixty times a second and `localStorage` reads are synchronous.
 */
export function setMutedDisplay(muted: boolean): void {
  mutedForDisplay = muted;
}

export function drawScrim(ctx: CanvasRenderingContext2D, strength = 0.72): void {
  ctx.fillStyle = alpha(PALETTE.scrim, strength);
  ctx.fillRect(0, 0, SCREEN.w, VIRTUAL_H);
}

/**
 * The title. Draws no scrim of its own — `scene.ts` lays the scrim down first
 * and then redraws the unicorn ON TOP of it, so the mascot stays bright white
 * instead of being greyed out along with the room behind her.
 */
export function drawTitle(ctx: CanvasRenderingContext2D, save: Save, time: number): void {
  const bob = Math.sin(time * 1.5) * 2;

  drawText(ctx, 'UNICORN', SCREEN.w / 2, 54 + bob, {
    size: 30,
    align: 'center',
    color: PALETTE.unicorn,
    glow: true,
  });
  drawText(ctx, 'SQUEEZE SQUAD', SCREEN.w / 2, 84 + bob, {
    size: 18,
    align: 'center',
    color: PALETTE.hudAccent,
    glow: true,
  });
  drawText(ctx, 'the kids are coming for a cuddle. hold them off.', SCREEN.w / 2, 112, {
    size: 9,
    align: 'center',
    color: PALETTE.hudDim,
    bold: false,
  });

  for (const rect of titleMenu()) {
    const selected = rect.id === `diff:${save.difficulty}`;
    drawButton(ctx, rect, selected);
  }

  drawMute(ctx);
  if (SCREEN.rotated) {
    drawText(ctx, 'TURN YOUR PHONE', SCREEN.w / 2, VIRTUAL_H - 18, {
      size: 9,
      align: 'center',
      color: PALETTE.hudDim,
    });
  }
}

export function drawLevelSelect(
  ctx: CanvasRenderingContext2D,
  save: Save,
  difficulty: DifficultyId,
  time: number,
): void {
  drawScrim(ctx, 0.82);
  drawText(ctx, 'PICK A LEVEL', SCREEN.w / 2, 32, {
    size: 16,
    align: 'center',
    color: PALETTE.hudText,
    glow: true,
  });
  drawText(ctx, DIFFICULTIES[difficulty].label, SCREEN.w - 10, 32, {
    size: 10,
    align: 'right',
    color: PALETTE.hudAccent,
  });

  for (const rect of levelMenu(save)) {
    if (rect.id === 'back') {
      drawButton(ctx, rect, false);
      continue;
    }
    const id = Number(rect.id.slice('level:'.length));
    drawLevelCard(ctx, rect, id, save, time);
  }
}

/**
 * A level card: its number, the toy it gives you, and its stars.
 *
 * The toy picture is the important part. A column of numbers tells a
 * five-year-old nothing about what is behind them, but "the one where you get
 * the sprinkler" is a thing she can want. The level's name is dropped from the
 * card rather than shrunk — at 6px it was decoration for her and unreadable for
 * everyone; it is on the footer during play instead.
 */
function drawLevelCard(
  ctx: CanvasRenderingContext2D,
  rect: MenuRect,
  id: number,
  save: Save,
  time: number,
): void {
  const locked = !rect.enabled;
  ctx.fillStyle = locked ? alpha(PALETTE.cardCharging, 0.6) : PALETTE.card;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fill();
  ctx.strokeStyle = locked ? PALETTE.trayEdge : PALETTE.cardEdge;
  ctx.lineWidth = 1;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.stroke();

  drawText(ctx, rect.label, rect.x + 7, rect.y + 11, {
    size: 11,
    align: 'left',
    color: locked ? PALETTE.hudDim : PALETTE.cardCharging,
  });

  // The toy this level hands over. The last level introduces nothing, so it
  // gets the boss's crown colour instead of a blank space.
  const level = LEVELS[id - 1];
  const toy = level?.unlocks[0];
  if (toy) {
    ctx.save();
    if (locked) ctx.globalAlpha = 0.35;
    drawToyArt(ctx, toy, rect.x + rect.w / 2, rect.y + 27, 0.66, time + id);
    ctx.restore();
  } else {
    ctx.save();
    if (locked) ctx.globalAlpha = 0.35;
    drawText(ctx, '!', rect.x + rect.w / 2, rect.y + 27, {
      size: 22,
      align: 'center',
      color: PALETTE.hudWarn,
      glow: true,
    });
    ctx.restore();
  }

  const stars = starsFor(save, id);
  for (let i = 0; i < 3; i++) {
    drawStar(
      ctx,
      rect.x + rect.w / 2 + (i - 1) * 13,
      rect.y + 45,
      5,
      i < stars ? PALETTE.star : PALETTE.starEmpty,
    );
  }
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  won: boolean,
  stars: number,
  levelName: string,
  hasNext: boolean,
  time: number,
): void {
  drawScrim(ctx, 0.78);
  drawText(ctx, won ? 'ALL SAFE!' : 'SQUEEZED!', SCREEN.w / 2, 52, {
    size: 26,
    align: 'center',
    color: won ? PALETTE.cardReady : PALETTE.hudWarn,
    glow: true,
  });
  drawText(ctx, levelName.toUpperCase(), SCREEN.w / 2, 76, {
    size: 10,
    align: 'center',
    color: PALETTE.hudDim,
  });

  if (won) {
    for (let i = 0; i < 3; i++) {
      // Stars pop in one at a time. Three at once is a result; three in
      // sequence is a small ceremony, and it costs one line.
      const pop = Math.min(1, Math.max(0, time * 2.2 - i * 0.7));
      const size = 13 * (0.6 + pop * 0.4);
      drawStar(ctx, SCREEN.w / 2 + (i - 1) * 38, 120, size, i < stars ? PALETTE.star : PALETTE.starEmpty);
    }
  } else {
    drawText(ctx, 'three kids got a cuddle. try a different row.', SCREEN.w / 2, 120, {
      size: 9,
      align: 'center',
      color: PALETTE.hudDim,
      bold: false,
    });
  }

  for (const rect of resultMenu(won, hasNext)) drawButton(ctx, rect, false);
}

export function drawUnlockBanner(ctx: CanvasRenderingContext2D, name: string): void {
  drawText(ctx, `NEW TOY: ${name.toUpperCase()}`, SCREEN.w / 2, 148, {
    size: 11,
    align: 'center',
    color: PALETTE.hudAccent,
    glow: true,
  });
}

/**
 * A button: pictogram on the left, word on the right.
 *
 * Both, always. The icon is what the five-year-old reads and the word is what
 * everyone else reads — and the word is also how she learns the word.
 */
function drawButton(
  ctx: CanvasRenderingContext2D,
  rect: MenuRect,
  selected: boolean,
  dimmed = false,
): void {
  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.4;

  ctx.fillStyle = selected ? PALETTE.buttonActive : PALETTE.buttonIdle;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fill();
  ctx.strokeStyle = selected ? PALETTE.buttonIdle : PALETTE.buttonEdge;
  ctx.lineWidth = selected ? 2 : 1;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.stroke();

  const textColor = selected ? PALETTE.buttonIdle : PALETTE.tray;
  const centred = rect.sub === '';
  const labelY = rect.y + (centred ? rect.h / 2 : 16);
  const hasIcon = rect.icon !== 'none';
  const iconSize = Math.min(16, rect.h * 0.5);

  if (hasIcon) {
    // Icon and label are measured together and centred as one group, so a
    // short word and a long one both sit properly under the button's middle.
    setFont(ctx, 13, true);
    const textW = ctx.measureText(rect.label).width;
    const gap = 6;
    const groupW = iconSize + gap + textW;
    const left = rect.x + (rect.w - groupW) / 2;
    drawIcon(ctx, rect.icon, left + iconSize / 2, labelY, iconSize, textColor);
    drawText(ctx, rect.label, left + iconSize + gap, labelY, {
      size: 13,
      align: 'left',
      color: textColor,
    });
  } else {
    drawText(ctx, rect.label, rect.x + rect.w / 2, labelY, {
      size: 13,
      align: 'center',
      color: textColor,
    });
  }

  if (!centred) {
    drawText(ctx, rect.sub, rect.x + rect.w / 2, rect.y + 32, {
      size: 6,
      align: 'center',
      color: selected ? alpha(PALETTE.buttonIdle, 0.85) : PALETTE.cardCharging,
      bold: false,
    });
  }
  ctx.restore();
}

function drawMute(ctx: CanvasRenderingContext2D): void {
  const rect = muteButton();
  ctx.fillStyle = alpha(PALETTE.card, 0.9);
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.tray;
  ctx.fillRect(rect.x + 6, rect.y + 9, 4, 4);
  ctx.beginPath();
  ctx.moveTo(rect.x + 10, rect.y + 11);
  ctx.lineTo(rect.x + 15, rect.y + 6);
  ctx.lineTo(rect.x + 15, rect.y + 16);
  ctx.closePath();
  ctx.fill();
  if (mutedForDisplay) {
    ctx.strokeStyle = PALETTE.hudWarn;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x + 4, rect.y + 18);
    ctx.lineTo(rect.x + 18, rect.y + 4);
    ctx.stroke();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
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

export { LEVEL_COUNT };
