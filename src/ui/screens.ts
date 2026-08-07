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
import { ENEMIES, ENEMY_ORDER } from '../game/enemies';
import { LEVELS, LEVEL_COUNT, WORLDS, WORLD_ORDER, type WorldId } from '../game/levels';
import { TOYS, TOY_ORDER, type ToyId } from '../game/toys';
import { PALETTE, alpha } from '../render/palette';
import { drawToyArt } from '../render/toys';
import { drawGuideKid } from '../render/kids';
import { spriteFrames } from '../render/sprites';
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

/**
 * The guide button, on the title screen next to mute.
 *
 * Its own function rather than part of `titleMenu()` because that list is the
 * three difficulties and choosing one starts the game — dropping a fourth
 * entry in it that does something else entirely would make every caller check
 * which kind of button it got back.
 */
export function guideButton(): MenuRect {
  return {
    id: 'guide',
    x: SCREEN.w - 58,
    y: 8,
    w: 22,
    h: 22,
    label: '',
    sub: '',
    enabled: true,
    icon: 'guide',
  };
}

/**
 * Endless, on the level-select screen once she has finished the bedroom.
 *
 * Gated rather than always there: endless deals every toy you own, and before
 * the campaign has handed over a usable kit it is not a mode, it is level one
 * for an hour. Ten levels is also roughly where "I want to keep going" starts
 * being a thing a child says.
 */
export function endlessButton(save: Save): MenuRect {
  return {
    id: 'endless',
    x: SCREEN.w / 2 - 60,
    y: VIRTUAL_H - 30,
    w: 120,
    h: 22,
    label: 'ENDLESS',
    sub: '',
    enabled: save.unlocked > BEDROOM_LEVELS,
    icon: 'again',
  };
}

/** Clearing the bedroom is the gate. */
const BEDROOM_LEVELS = 10;

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

/**
 * Level select, one world at a time.
 *
 * It used to be every level in one grid, which fitted exactly as long as there
 * were ten of them: fifteen spilled into a third row that overlapped the BACK
 * button, and twenty would have run off the bottom of the screen. Paging by
 * world fixes that permanently — a world is ten levels by construction, so this
 * is two rows of five however many worlds get added.
 *
 * It also happens to be the honest grouping. "The Bedroom" and "The Backyard"
 * are different places with different rules, and a flat run of numbers from 1
 * to 20 hides the one thing a player most wants to know about level 11.
 */
export function levelMenu(save: Save, world: WorldId): MenuRect[] {
  const perRow = 5;
  const inWorld = LEVELS.filter((level) => level.world === world);
  const total = perRow * CARD_W + (perRow - 1) * CARD_GAP;
  const startX = Math.round((SCREEN.w - total) / 2);
  const rects: MenuRect[] = inWorld.map((level, index) => {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    return {
      id: `level:${level.id}`,
      x: startX + col * (CARD_W + CARD_GAP),
      y: 74 + row * (CARD_H + 10),
      w: CARD_W,
      h: CARD_H,
      label: String(level.id),
      sub: level.name,
      enabled: level.id <= save.unlocked,
      icon: 'none',
    };
  });

  // One tab per world, and a world you have not reached yet is visibly shut
  // rather than absent — "there is more after this" is worth showing a child.
  const ids = WORLD_ORDER;
  const tabW = 96;
  const tabTotal = ids.length * tabW + (ids.length - 1) * 8;
  const tabX = Math.round((SCREEN.w - tabTotal) / 2);
  ids.forEach((id, index) => {
    rects.push({
      id: `world:${id}`,
      x: tabX + index * (tabW + 8),
      y: 44,
      w: tabW,
      h: 22,
      label: WORLDS[id].name,
      sub: '',
      enabled: LEVELS.some((level) => level.world === id && level.id <= save.unlocked),
      icon: 'none',
    });
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
  rects.push(endlessButton(save));
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

/**
 * The endless card: how far you got, and how far you have ever got.
 *
 * No stars. Stars measure how cleanly you beat a fixed thing; endless has no
 * fixed thing to beat. The whole scoreboard is one number, and it is the number
 * the progress bar was already counting while she played.
 */
export function drawEndlessResult(
  ctx: CanvasRenderingContext2D,
  reached: number,
  best: number,
): void {
  drawScrim(ctx, 0.82);
  const beatIt = reached >= best && reached > 0;

  drawText(ctx, beatIt ? 'NEW BEST!' : 'GOOD TRY!', SCREEN.w / 2, 52, {
    size: 20,
    align: 'center',
    color: beatIt ? PALETTE.hudAccent : PALETTE.hudText,
    glow: true,
  });
  // The count, big. It is the entire result, so it gets the space a row of
  // stars would have had.
  drawText(ctx, String(reached), SCREEN.w / 2, 96, {
    size: 40,
    align: 'center',
    color: PALETTE.hudAccent,
    glow: true,
  });
  drawText(ctx, reached === 1 ? 'wave' : 'waves', SCREEN.w / 2, 122, {
    size: 11,
    align: 'center',
    color: PALETTE.hudText,
  });
  if (!beatIt && best > 0) {
    drawText(ctx, `your best is ${best}`, SCREEN.w / 2, 142, {
      size: 9,
      align: 'center',
      color: PALETTE.hudDim,
      bold: false,
    });
  }

  for (const rect of resultMenu(false, false)) drawButton(ctx, rect, false);
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
  drawCornerButton(ctx, guideButton());
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
  world: WorldId,
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

  for (const rect of levelMenu(save, world)) {
    if (rect.id === 'back') {
      drawButton(ctx, rect, false);
      continue;
    }
    if (rect.id.startsWith('world:')) {
      const id = rect.id.slice('world:'.length) as WorldId;
      drawButton(ctx, rect, id === world, !rect.enabled);
      continue;
    }
    if (rect.id === 'endless') {
      drawButton(ctx, rect, false, !rect.enabled);
      // The best so far, beside the button rather than on it. A number on the
      // button reads as part of its name.
      if (rect.enabled && save.endlessBest > 0) {
        drawText(ctx, `best ${save.endlessBest}`, rect.x + rect.w + 8, rect.y + 11, {
          size: 8,
          color: PALETTE.hudAccent,
          bold: false,
        });
      }
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

/** A square icon button in the corner strip, styled like the mute toggle. */
function drawCornerButton(ctx: CanvasRenderingContext2D, rect: MenuRect): void {
  ctx.fillStyle = alpha(PALETTE.card, 0.9);
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fill();
  drawIcon(ctx, rect.icon, rect.x + rect.w / 2, rect.y + rect.h / 2, 14, PALETTE.tray);
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


// --- The guide ---------------------------------------------------------------

/**
 * Which half of the guide is showing. Toys and kids are separate lists rather
 * than one long one because they answer different questions — "what does this
 * do" and "what stops this" — and a child looking up the sprinkler should not
 * have to page past the Big Kid to reach it.
 */
export type GuideTab = 'toys' | 'kids';

/** Rows per page. Four fits 270px tall with room for the pager underneath. */
export const GUIDE_ROWS = 4;
const GUIDE_TOP = 74;
const GUIDE_ROW_H = 38;

export function guideCount(tab: GuideTab): number {
  return tab === 'toys' ? TOY_ORDER.length : ENEMY_ORDER.length;
}

export function guidePages(tab: GuideTab): number {
  return Math.max(1, Math.ceil(guideCount(tab) / GUIDE_ROWS));
}

export function guideMenu(tab: GuideTab, page: number): MenuRect[] {
  const last = guidePages(tab) - 1;
  const blank = { label: '', sub: '', enabled: true };
  const bottom = VIRTUAL_H - 30;
  return [
    { id: 'back', x: 10, y: bottom, w: 60, h: 22, label: 'BACK', sub: '', enabled: true, icon: 'back' },
    // The tabs carry no `icon`: they are drawn with real game art instead, by
    // drawGuideTab. To a child who cannot read, TOYS and KIDS are two identical
    // smudges, and an abstract glyph beside them is a third thing to decode.
    { id: 'tab:toys', x: SCREEN.w / 2 - 92, y: 42, w: 88, h: 24, label: 'TOYS', sub: '', enabled: true, icon: 'none' },
    { id: 'tab:kids', x: SCREEN.w / 2 + 4, y: 42, w: 88, h: 24, label: 'KIDS', sub: '', enabled: true, icon: 'none' },
    // Paging arrows sit at the outer edges, far apart, because a small thumb
    // aiming for one must never catch the other.
    { id: 'prev', x: SCREEN.w / 2 - 70, y: bottom, w: 34, h: 22, ...blank, enabled: page > 0, icon: 'prev' },
    { id: 'next', x: SCREEN.w / 2 + 36, y: bottom, w: 34, h: 22, ...blank, enabled: page < last, icon: 'next' },
  ];
}

/**
 * The guide: every toy and every kid, with one line each.
 *
 * Two audiences at once, which is the whole design problem. The child cannot
 * read, so each row leads with the actual game art at a size she recognises —
 * she looks up "the spinny water one" by finding its picture. The parent can
 * read, and is the one who forgets whether the sprinkler reaches the floating
 * kid, so the line beside it answers exactly that in plain words.
 *
 * The art is drawn by the same painters the board uses, not by a separate set
 * of menu illustrations. A guide that drifts out of step with the game is worse
 * than no guide, and this one cannot: change a toy's look and this changes.
 */
export function drawGuide(
  ctx: CanvasRenderingContext2D,
  tab: GuideTab,
  page: number,
  time: number,
): void {
  drawScrim(ctx, 0.86);
  drawText(ctx, 'WHAT DOES WHAT', SCREEN.w / 2, 28, {
    size: 15,
    align: 'center',
    color: PALETTE.hudText,
    glow: true,
  });

  for (const rect of guideMenu(tab, page)) {
    if (rect.id.startsWith('tab:')) {
      drawGuideTab(ctx, rect, rect.id === `tab:${tab}`, time);
    } else if (rect.id === 'prev' || rect.id === 'next') {
      drawButton(ctx, rect, false, !rect.enabled);
    } else {
      drawButton(ctx, rect, false);
    }
  }

  if (tab === 'kids') {
    // Two small captions, once at the top rather than on every row. At 6px
    // these are for the adult; the child is looking at the pictures.
    drawText(ctx, 'walking', 40, GUIDE_TOP - 7, { size: 7, align: 'center', color: PALETTE.hudText, bold: false });
    drawText(ctx, 'grabbing', 72, GUIDE_TOP - 7, { size: 7, align: 'center', color: PALETTE.hudText, bold: false });
  }

  const first = page * GUIDE_ROWS;
  const ids = tab === 'toys' ? TOY_ORDER : ENEMY_ORDER;
  for (let i = 0; i < GUIDE_ROWS; i++) {
    const which = ids[first + i];
    if (!which) break;
    drawGuideRow(ctx, tab, which, GUIDE_TOP + i * GUIDE_ROW_H, time);
  }

  // Page dots. A "2 / 3" would be two more numerals to decode; dots are a
  // shape, and she can see at a glance that there is more to the right.
  const pages = guidePages(tab);
  const dotsY = VIRTUAL_H - 19;
  for (let i = 0; i < pages; i++) {
    const x = SCREEN.w / 2 - ((pages - 1) * 9) / 2 + i * 9;
    ctx.fillStyle = i === page ? PALETTE.hudAccent : alpha(PALETTE.hudDim, 0.5);
    ctx.beginPath();
    ctx.arc(x, dotsY, i === page ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A tab, labelled with a picture of the thing it contains.
 *
 * A bubble wand for the toys and a toddler for the kids — the same art the
 * board uses, so the button is literally a picture of what is behind it. The
 * words stay for the adult; the picture is what the child navigates by.
 */
function drawGuideTab(
  ctx: CanvasRenderingContext2D,
  rect: MenuRect,
  selected: boolean,
  time: number,
): void {
  ctx.fillStyle = selected ? PALETTE.hudAccent : alpha(PALETTE.card, 0.85);
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fill();
  ctx.strokeStyle = selected ? PALETTE.cardReady : PALETTE.cardEdge;
  ctx.lineWidth = selected ? 2 : 1;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.stroke();

  const cx = rect.x + 18;
  const cy = rect.y + rect.h / 2;
  if (rect.id === 'tab:toys') drawToyArt(ctx, 'wand', cx, cy, 0.5, time, 0, 0);
  else drawGuideKid(ctx, 'toddler', cx, cy, 22);

  // On the centre line, like the art beside it. It sat 5px high, which at 11px
  // type is half a line and reads as a mistake rather than as a style.
  drawText(ctx, rect.label, rect.x + rect.w / 2 + 10, cy, {
    size: 11,
    align: 'center',
    color: selected ? PALETTE.tray : PALETTE.hudText,
  });
}

function drawGuideRow(
  ctx: CanvasRenderingContext2D,
  tab: GuideTab,
  which: string,
  y: number,
  time: number,
): void {
  const left = 18;
  const width = SCREEN.w - left * 2;

  // A proper opaque card, not a half-transparent one.
  //
  // It was `card` at 0.5 alpha over the scrim, which lands somewhere in the
  // middle — and light text on a mid-tone is unreadable. The rest of this game
  // puts DARK text on LIGHT cards, which is what the buttons have always done;
  // the guide was the one screen that wandered off and did its own thing.
  ctx.fillStyle = PALETTE.card;
  roundedRect(ctx, left, y, width, GUIDE_ROW_H - 5, 5);
  ctx.fill();
  ctx.strokeStyle = PALETTE.cardEdge;
  ctx.lineWidth = 1;
  roundedRect(ctx, left, y, width, GUIDE_ROW_H - 5, 5);
  ctx.stroke();

  const artX = left + 22;
  const artY = y + (GUIDE_ROW_H - 5) / 2;
  let name: string;
  let blurb: string;
  let cost = '';

  if (tab === 'toys') {
    const def = TOYS[which as ToyId];
    name = def.name;
    blurb = def.blurb;
    // The Guard Bear has no cost because you never buy him, and printing "0"
    // beside him would read as "free to place" rather than "not a card".
    cost = def.cost > 0 ? String(def.cost) : '';
    drawToyArt(ctx, def.id, artX, artY, 0.62, time, 0, 0);
  } else {
    const def = ENEMIES[which as keyof typeof ENEMIES];
    name = def.name;
    blurb = def.blurb;
    // Both cycles, side by side and both running: walking on the left, pulling
    // a toy apart on the right. Showing them together is the whole point of
    // this screen — it is where you decide whether an animation is any good,
    // and you cannot judge a grab you have to wait for a kid to start.
    drawGuideKid(ctx, def.kind, artX, artY, 28, time, 'walk');
    if (spriteFrames(`${def.kind}.grab`)) {
      drawGuideKid(ctx, def.kind, artX + 30, artY, 28, time, 'grab');
    }
  }

  const textX = left + (tab === 'kids' ? 76 : 46);
  drawText(ctx, name, textX, y + 12, { size: 10, color: PALETTE.cardText });
  drawText(ctx, blurb, textX, y + 24, {
    // 8px rather than 7. This line is the whole reason an adult opens this
    // screen, and it was set at the size used for captions nobody has to read.
    size: 8,
    color: PALETTE.cardTextDim,
    bold: false,
  });

  if (cost) {
    ctx.fillStyle = PALETTE.sparkle;
    ctx.beginPath();
    ctx.arc(left + width - 26, y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, cost, left + width - 18, y + 12, { size: 10, color: PALETTE.cardText });
  }
}
