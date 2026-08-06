/**
 * Toy art.
 *
 * One painter per toy, keyed off the id, and every one of them a different
 * SILHOUETTE at 30 pixels: the jar is a circle, the wand is a stick with a ring
 * on top, the fort is a squat stack, the sprinkler is a cross, the water gun is
 * a barrel pointing right, the fountain is a tier. A child watching lane four
 * identifies what is in lane one from its outline in her peripheral vision.
 * Colour is the confirmation, never the identification.
 *
 * Everything is drawn around a centre point and scaled, so the same painter
 * fills a board cell and a tray card and they can never disagree about what a
 * toy looks like.
 */

import { CELL_H, CELL_W } from '../game/config';
import { TOYS, type Toy, type ToyId } from '../game/toys';
import { PALETTE, alpha, mix } from './palette';
import { roundRect } from './bedroom';
import { drawSprite, sprite } from './sprites';

/**
 * Draw a toy centred on (x, y).
 *
 * `scale` is 1 for a board cell. `t` is a free-running clock for idle motion,
 * and `hurt` is 0-1 for the damage flash.
 */
export function drawToyArt(
  ctx: CanvasRenderingContext2D,
  id: ToyId,
  x: number,
  y: number,
  scale: number,
  t: number,
  hurt = 0,
  fired = 0,
): void {
  const def = TOYS[id];

  // Generated art wins if it exists. This is the only place toys are drawn, so
  // one check here covers the board, the tray cards, the placement ghost and
  // the level-select cards at once — they can never disagree about what a toy
  // looks like, which is the reason they all came through this function in the
  // first place.
  const image = sprite(id);
  if (image) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // A slow breath. Every toy on the board shares one clock but is offset by
    // its own cell in the caller, so five jars don't pulse in unison like a
    // heartbeat — which looks far more artificial than not moving at all.
    const breath = Math.sin(t * 1.6);
    ctx.translate(0, breath * 0.7);
    ctx.scale(1 - breath * 0.012, 1 + breath * 0.018);
    // Recoil: a shooter that has just fired kicks back and squashes. `fired`
    // is DERIVED from the reload timer rather than stored, so the animation
    // cannot drift out of step with the thing it is animating.
    if (fired > 0) {
      ctx.translate(-fired * 2.5, 0);
      ctx.scale(1 + fired * 0.06, 1 - fired * 0.05);
    }
    drawSprite(ctx, image, 0, 0, CELL_W - 2, CELL_H - 2);
    drawFlourish(ctx, id, t, fired);
    if (hurt > 0) {
      // A wash rather than a colour mix: we can't recolour a painting the way
      // we can swap a fill, and a flash of red over the top reads the same.
      ctx.fillStyle = alpha(PALETTE.toyDamaged, Math.min(0.55, hurt * 2.2));
      roundRect(ctx, -CELL_W / 2 + 2, -CELL_H / 2 + 2, CELL_W - 4, CELL_H - 4, 6);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const body = hurt > 0 ? mix(def.color, PALETTE.toyDamaged, Math.min(1, hurt * 2.2)) : def.color;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // A soft contact shadow under everything, so a toy sits ON the floor rather
  // than floating over it. Skipped for the floor layer, which IS the floor.
  if (def.layer !== 'floor') {
    ctx.fillStyle = alpha(PALETTE.toyShadow, 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 13, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  switch (id) {
    case 'jar':
      drawJar(ctx, body, def.accent, t);
      break;
    case 'wand':
      drawWand(ctx, body, def.accent, t);
      break;
    case 'fort':
      drawFort(ctx, body, def.accent);
      break;
    case 'sprinkler':
      drawSprinkler(ctx, body, def.accent, t);
      break;
    case 'watergun':
      drawWaterGun(ctx, body, def.accent);
      break;
    case 'nightlight':
      drawNightlight(ctx, body, def.accent, t);
      break;
    case 'slime':
      drawSlime(ctx, body, def.accent, t);
      break;
    case 'powder':
      drawPowder(ctx, body, def.accent);
      break;
    case 'fountain':
      drawFountain(ctx, body, def.accent, t);
      break;
    case 'machine':
      drawMachine(ctx, body, def.accent, t);
      break;
    case 'sweeper':
      drawSweeper(ctx, body, def.accent);
      break;
  }

  ctx.restore();
}

/**
 * How recently this toy fired, 0-1, derived rather than stored.
 *
 * `toy.timer` is reset to the full reload interval the instant a shot goes out,
 * so a timer near its maximum means "just fired". Reading it back beats adding
 * a `firedAt` field: there is no second piece of state to keep in sync, and the
 * simulation stays unaware that anything is being animated at all.
 */
const RECOIL_SECONDS = 0.16;
function firedRecently(toy: Toy): number {
  const shoot = TOYS[toy.id].shoot;
  if (!shoot) return 0;
  const since = shoot.interval - toy.timer;
  if (since < 0 || since > RECOIL_SECONDS) return 0;
  return 1 - since / RECOIL_SECONDS;
}

/** A placed toy on the board, with its health bar once it has been chewed on. */
export function drawPlacedToy(ctx: CanvasRenderingContext2D, toy: Toy, x: number, y: number, t: number): void {
  drawToyArt(ctx, toy.id, x, y, 1, t + toy.lane * 0.7 + toy.col * 0.3, toy.hurt, firedRecently(toy));
  if (toy.maxHp <= 0 || toy.hp >= toy.maxHp) return;
  const share = Math.max(0, toy.hp / toy.maxHp);
  const w = CELL_W - 14;
  ctx.fillStyle = alpha(PALETTE.toyShadow, 0.7);
  ctx.fillRect(x - w / 2, y + CELL_H / 2 - 6, w, 3);
  ctx.fillStyle = share > 0.35 ? PALETTE.cardReady : PALETTE.toyDamaged;
  ctx.fillRect(x - w / 2, y + CELL_H / 2 - 6, w * share, 3);
}

/**
 * The moving part of each toy, drawn over its still image.
 *
 * A generated sprite is one frame forever, and a board of them sits there like
 * a sticker album. Generating three or four frames each would cost thirty more
 * billed images and would not hold the character consistent between them, so
 * instead each toy gets a small procedural flourish on top: the thing it is
 * visibly DOING. The sprinkler's spray sweeps, the wand's bubbles rise, the
 * fountain throws sparkles.
 *
 * Two rules. It must be the toy's own idea — bubbles for bubble things, water
 * for water things — so the animation reinforces which toy this is rather than
 * being generic sparkle. And it must be cheap: this runs for up to 45 toys
 * every frame.
 */
function drawFlourish(ctx: CanvasRenderingContext2D, id: ToyId, t: number, fired: number): void {
  switch (id) {
    case 'jar': {
      // Glitter motes rising and winking out.
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.55 + i * 0.37) % 1;
        ctx.fillStyle = alpha(PALETTE.sparkle, (1 - phase) * 0.85);
        const size = 2 - phase;
        ctx.fillRect(-5 + i * 4 + Math.sin(t * 2 + i) * 1.5, -8 - phase * 12, size, size);
      }
      break;
    }

    case 'wand':
    case 'machine': {
      // Bubbles drifting up and to the right, out of the hoop or the spouts.
      const rows = id === 'machine' ? [-6, 0, 6] : [-4];
      ctx.strokeStyle = alpha(PALETTE.shotBubble, 0.9);
      ctx.lineWidth = 1;
      for (const row of rows) {
        for (let i = 0; i < 2; i++) {
          const phase = (t * 0.7 + i * 0.5 + row * 0.11) % 1;
          const radius = 1.5 + phase * 2.5;
          ctx.globalAlpha = 1 - phase;
          ctx.beginPath();
          ctx.arc(6 + phase * 12, row - phase * 6, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'sprinkler': {
      // A spray that sweeps side to side, so the head reads as turning even
      // though the painting of it cannot.
      const sweep = Math.sin(t * 2.2);
      ctx.strokeStyle = alpha(PALETTE.shotWater, 0.75);
      ctx.lineWidth = 1.5;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * 2, -6);
        ctx.quadraticCurveTo(dir * (9 + sweep * dir * 3), -14, dir * (15 + sweep * dir * 4), -6);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const phase = (t * 1.1 + i * 0.33) % 1;
        ctx.fillStyle = alpha(PALETTE.shotWater, 1 - phase);
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.fillRect(dir * (14 + phase * 5), -6 + phase * 10, 1.5, 1.5);
      }
      break;
    }

    case 'watergun': {
      // A drip at the nozzle between shots, and a splash on the shot itself.
      const drip = (t * 0.8) % 1;
      ctx.fillStyle = alpha(PALETTE.shotWater, (1 - drip) * 0.8);
      ctx.beginPath();
      ctx.arc(15, -1 + drip * 5, 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (fired > 0) {
        ctx.fillStyle = alpha(PALETTE.shotCore, fired);
        ctx.beginPath();
        ctx.arc(17, 0, 2 + fired * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'nightlight': {
      // A halo that breathes. Nothing moves; the light does.
      const pulse = 0.14 + Math.sin(t * 2.4) * 0.07;
      const glow = ctx.createRadialGradient(0, -2, 2, 0, -2, 20);
      glow.addColorStop(0, alpha(PALETTE.shotLight, pulse * 1.6));
      glow.addColorStop(1, alpha(PALETTE.shotLight, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -2, 20, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'slime': {
      // Bubbles surfacing in the goo and popping.
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.5 + i * 0.34) % 1;
        ctx.fillStyle = alpha('#ffffff', (1 - phase) * 0.5);
        ctx.beginPath();
        ctx.arc(-9 + i * 9, 6 - phase * 3, 1 + phase * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'fountain': {
      // Sparkles thrown up and falling back, on their own little arcs.
      for (let i = 0; i < 5; i++) {
        const phase = (t * 0.9 + i * 0.2) % 1;
        const rise = Math.sin(phase * Math.PI);
        ctx.fillStyle = alpha(PALETTE.sparkle, 0.9 - phase * 0.6);
        ctx.fillRect((i - 2) * 3.2, -8 - rise * 9, 1.8, 1.8);
      }
      break;
    }

    case 'powder': {
      const phase = (t * 0.45) % 1;
      ctx.fillStyle = alpha(PALETTE.shotPowder, (1 - phase) * 0.55);
      ctx.beginPath();
      ctx.arc(2, -9 - phase * 6, 2 + phase * 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // Pillow forts do not do anything. A wall that shimmers is a
    // wall that looks like it is about to do something, and it isn't.
    default:
      break;
  }
}

// --- The painters -----------------------------------------------------------

function drawJar(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  ctx.fillStyle = alpha('#ffffff', 0.35);
  roundRect(ctx, -10, -6, 20, 20, 7);
  ctx.fill();
  ctx.fillStyle = body;
  roundRect(ctx, -8, 0, 16, 13, 5);
  ctx.fill();
  ctx.fillStyle = accent;
  for (let i = 0; i < 4; i++) {
    const wobble = Math.sin(t * 2 + i * 1.7) * 2;
    ctx.fillRect(-6 + i * 4, 2 + wobble, 2, 2);
  }
  // Lid.
  ctx.fillStyle = PALETTE.cardEdge;
  ctx.fillRect(-9, -9, 18, 4);
  ctx.fillStyle = alpha(PALETTE.toyHighlight, 0.8);
  ctx.fillRect(-6, -4, 3, 10);
}

function drawWand(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  ctx.fillStyle = PALETTE.cardEdge;
  ctx.fillRect(-2, -2, 4, 16);
  ctx.strokeStyle = body;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = alpha(accent, 0.5 + Math.sin(t * 3) * 0.2);
  ctx.beginPath();
  ctx.arc(0, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  // A bubble drifting off the ring, so an idle wand still looks switched on.
  ctx.strokeStyle = alpha(accent, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(9 + ((t * 8) % 6), -12 - ((t * 4) % 5), 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFort(ctx: CanvasRenderingContext2D, body: string, accent: string): void {
  ctx.fillStyle = body;
  roundRect(ctx, -14, -2, 28, 15, 5);
  ctx.fill();
  roundRect(ctx, -11, -12, 22, 13, 5);
  ctx.fill();
  ctx.fillStyle = alpha(accent, 0.9);
  roundRect(ctx, -8, -10, 16, 7, 3);
  ctx.fill();
  ctx.fillStyle = alpha(PALETTE.toyShadow, 0.18);
  ctx.fillRect(-14, 8, 28, 4);
}

function drawSprinkler(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  ctx.fillStyle = accent;
  ctx.fillRect(-11, 8, 22, 5);
  ctx.fillStyle = body;
  ctx.fillRect(-2, -6, 4, 15);
  // The cross head, spinning.
  const spin = Math.sin(t * 4) * 4;
  ctx.fillRect(-10 + spin, -9, 20, 3);
  ctx.fillRect(-2, -13, 4, 5);
  ctx.fillStyle = alpha(PALETTE.shotWater, 0.6);
  for (let i = 0; i < 4; i++) {
    const a = t * 3 + (i * Math.PI) / 2;
    ctx.fillRect(Math.cos(a) * 12 - 1, -8 + Math.sin(a) * 5, 2, 2);
  }
}

function drawWaterGun(ctx: CanvasRenderingContext2D, body: string, accent: string): void {
  ctx.fillStyle = body;
  roundRect(ctx, -12, -4, 20, 12, 4);
  ctx.fill();
  // Barrel, pointing right — at the door the kids come from. Which way a toy
  // faces is the fastest way to read what it does.
  ctx.fillRect(4, -1, 12, 6);
  ctx.fillStyle = accent;
  ctx.fillRect(14, 0, 3, 4);
  // Grip and tank.
  ctx.fillStyle = body;
  ctx.fillRect(-9, 6, 6, 8);
  ctx.fillStyle = alpha(PALETTE.shotWater, 0.85);
  roundRect(ctx, -13, -11, 12, 9, 4);
  ctx.fill();
}

function drawNightlight(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  const pulse = 0.35 + Math.sin(t * 2.5) * 0.15;
  ctx.fillStyle = alpha(body, pulse);
  ctx.beginPath();
  ctx.arc(0, -4, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.cardEdge;
  roundRect(ctx, -8, 2, 16, 12, 3);
  ctx.fill();
  // A five-pointed star bulb. The only star-shaped thing on the board.
  ctx.fillStyle = body;
  star(ctx, 0, -5, 9, 4, 5);
  ctx.fill();
  ctx.fillStyle = accent;
  star(ctx, 0, -5, 5, 2, 5);
  ctx.fill();
}

function drawSlime(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  ctx.fillStyle = alpha(body, 0.85);
  ctx.beginPath();
  ctx.ellipse(0, 6, 19, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(accent, 0.9);
  ctx.beginPath();
  ctx.ellipse(0, 7, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.4);
  for (let i = 0; i < 3; i++) {
    const bob = Math.sin(t * 2 + i * 2) * 1.5;
    ctx.beginPath();
    ctx.arc(-8 + i * 8, 4 + bob, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPowder(ctx: CanvasRenderingContext2D, body: string, accent: string): void {
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(-1, 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-4, -11, 8, 5);
  // The squeeze bulb, so it reads as a puffer rather than a ball.
  ctx.fillStyle = PALETTE.cardEdge;
  ctx.beginPath();
  ctx.arc(9, -7, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.55);
  ctx.beginPath();
  ctx.arc(-4, -1, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawFountain(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  ctx.fillStyle = body;
  trapezoid(ctx, 0, 11, 22, 14, 6);
  ctx.fill();
  trapezoid(ctx, 0, 1, 13, 8, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.cardEdge;
  ctx.fillRect(-2, -8, 4, 8);
  ctx.fillStyle = accent;
  for (let i = 0; i < 5; i++) {
    const a = t * 2.4 + (i * Math.PI * 2) / 5;
    ctx.fillRect(Math.cos(a) * 9 - 1, -12 + Math.abs(Math.sin(a)) * -5, 2, 2);
  }
}

function drawMachine(ctx: CanvasRenderingContext2D, body: string, accent: string, t: number): void {
  ctx.fillStyle = body;
  roundRect(ctx, -13, -6, 24, 19, 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.cardEdge;
  ctx.fillRect(-9, -2, 8, 7);
  ctx.fillStyle = alpha(accent, 0.9);
  ctx.fillRect(-8, -1, 6, 5);
  // Three spouts, three lanes. The art states the rule.
  ctx.fillStyle = body;
  for (let i = -1; i <= 1; i++) ctx.fillRect(10, -4 + i * 6, 6, 3);
  ctx.strokeStyle = alpha(accent, 0.85);
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    const drift = (t * 10 + i * 3) % 9;
    ctx.beginPath();
    ctx.arc(17 + drift, -3 + i * 6, 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSweeper(ctx: CanvasRenderingContext2D, body: string, accent: string): void {
  ctx.fillStyle = PALETTE.cardEdge;
  ctx.save();
  ctx.rotate(-0.3);
  ctx.fillRect(-2, -14, 4, 18);
  ctx.fillStyle = body;
  trapezoid(ctx, 0, 9, 16, 10, 5);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-7, 11, 14, 3);
  ctx.restore();
}

// --- Small shape helpers ----------------------------------------------------

function star(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** A tier: wide at the bottom, narrow at the top. */
function trapezoid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  baseW: number,
  topW: number,
  h: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx - baseW / 2, baseY);
  ctx.lineTo(cx + baseW / 2, baseY);
  ctx.lineTo(cx + topW / 2, baseY - h);
  ctx.lineTo(cx - topW / 2, baseY - h);
  ctx.closePath();
}
