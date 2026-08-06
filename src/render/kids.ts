/**
 * Kid art.
 *
 * Every kid is drawn walking LEFT, outlined in the darkest colour in the
 * palette, and shaped so its twist is visible before it is relevant: the
 * raincoat has a pointed hood, the blanket has no face at all, the balloon
 * hangs under a balloon, the sock slider is horizontal.
 *
 * Nobody is hurt here. A kid who runs out of health is not defeated, she is
 * distracted — she turns round and wanders back to the door to play with
 * whatever just squirted her. The `leaving` pose and the particle burst both
 * have to sell that, because the mechanics are the same ones a shooting game
 * would use and the framing is the only thing that isn't.
 */

import { ENEMIES, type Enemy, type EnemyKind } from '../game/enemies';
import { PALETTE, alpha, mix } from './palette';
import { roundRect } from './bedroom';
import { drawSprite, sprite } from './sprites';

/**
 * Draw one kid at (x, y), where y is the lane centre.
 *
 * `walk` is a free-running phase so the legs move; it is derived from the kid's
 * own position rather than a timer, so a slowed kid visibly takes smaller,
 * slower steps instead of moon-walking at full animation speed.
 */
export function drawKid(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number): void {
  const def = ENEMIES[enemy.kind];
  const walk = x * 0.14;
  const step = Math.sin(walk) * 2;
  // Gaits take raw pixels travelled and apply their own stride length.
  const walkPx = x;
  const body = enemy.hurt > 0 ? mix(def.color, PALETTE.kidHealthLost, Math.min(1, enemy.hurt * 5)) : def.color;

  ctx.save();
  ctx.translate(x, y);

  // Contact shadow. Floaters get a smaller, fainter one further down — the
  // cheapest possible way to say "this one is off the ground".
  const aerial = def.aerial === true;
  ctx.fillStyle = alpha(PALETTE.kidOutline, aerial ? 0.16 : 0.3);
  ctx.beginPath();
  ctx.ellipse(0, def.height / 2 + (aerial ? 8 : 1), aerial ? 6 : def.width / 2.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // A kid under a blanket that hasn't been revealed is drawn as a dim mound.
  // Visible, so she is never a surprise; featureless, so you cannot tell what
  // is under there until something lights her up.
  if (enemy.concealed) {
    const hidden = sprite('blanket');
    if (hidden) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawSprite(ctx, hidden, 0, 0, def.width * 1.7, def.height * 1.7);
      ctx.restore();
    } else {
      drawBlanketMound(ctx, PALETTE.kidHidden, step);
    }
    ctx.restore();
    return;
  }

  // Generated art wins if it exists — but only for the BODY. The shield, the
  // soaked drip and the slowed blob are drawn over the top either way, because
  // they are game state rather than character design and they have to look
  // identical whether or not somebody has run the art script.
  const image = sprite(enemy.kind);
  if (image) {
    ctx.save();
    if (enemy.hurt > 0) {
      // Sprites can't be tinted the way a fill can, so a hurt kid flashes by
      // going briefly translucent. Same read at a glance: "that one just got hit".
      ctx.globalAlpha = 1 - Math.min(0.45, enemy.hurt * 3);
    }
    applyGait(ctx, enemy, def, walkPx);
    drawSprite(ctx, image, 0, 0, def.width * 1.7, def.height * 1.7);
    ctx.restore();
    drawStatusMarkers(ctx, enemy, def);
    ctx.restore();
    return;
  }

  switch (enemy.kind) {
    case 'crawler':
      drawCrawler(ctx, body, def.accent, step);
      break;
    case 'toddler':
      drawToddler(ctx, body, def.accent, step);
      break;
    case 'runner':
      drawRunner(ctx, body, def.accent, step);
      break;
    case 'raincoat':
      drawRaincoat(ctx, body, def.accent, step);
      break;
    case 'blanket':
      drawBlanketMound(ctx, body, step);
      break;
    case 'balloon':
      drawBalloon(ctx, body, def.accent, walk);
      break;
    case 'puffy':
      drawPuffy(ctx, body, def.accent, step);
      break;
    case 'slider':
      drawSlider(ctx, body, def.accent, walk);
      break;
    case 'wagon':
      drawWagon(ctx, body, def.accent, walk);
      break;
    case 'bigkid':
      drawBigKid(ctx, body, def.accent, step);
      break;
  }

  drawStatusMarkers(ctx, enemy, def);
  ctx.restore();
}

/**
 * How each kid moves. One row per character, because they should not all walk
 * the same and a single shared formula is what made the first version read as
 * "everything is gently bobbing" rather than as five different children.
 *
 * `stride` is radians of cycle per pixel travelled, so it sets how many steps
 * are taken to cross a given distance — small numbers are long, heavy strides.
 * Everything else is a fraction of the kid's own height, so a big kid's bob is
 * proportionally the same as a toddler's unless it is deliberately not.
 */
interface Gait {
  /** Cycle per pixel. Higher is more, shorter steps. */
  stride: number;
  /** Vertical rise, as a fraction of height. */
  bob: number;
  /** Rock about the feet, in radians. */
  lean: number;
  /** Squash on the footfall, as a fraction of height. */
  squash: number;
  /** Horizontal weight shift, in pixels. */
  sway: number;
  /** Side-to-side roll every OTHER step, in radians. A waddle. */
  waddle: number;
}

const GAITS: Partial<Record<EnemyKind, Gait>> = {
  // Hands and knees: almost no rise, a long reach, a big rock forward.
  crawler: { stride: 0.30, bob: 0.05, lean: 0.09, squash: 0.05, sway: 1.4, waddle: 0 },
  // The reference walk. Everything else is described relative to this.
  toddler: { stride: 0.26, bob: 0.15, lean: 0.07, squash: 0.09, sway: 1.4, waddle: 0 },
  // Long fast strides, thrown forward, barely touching down.
  runner: { stride: 0.19, bob: 0.19, lean: 0.13, squash: 0.06, sway: 2.2, waddle: 0 },
  // A stiff plastic coat: less bounce, more swing.
  raincoat: { stride: 0.24, bob: 0.11, lean: 0.06, squash: 0.07, sway: 1.2, waddle: 0.05 },
  // Shuffling blind under a blanket, so short steps and a lot of side-to-side.
  blanket: { stride: 0.34, bob: 0.05, lean: 0.03, squash: 0.11, sway: 0.6, waddle: 0.09 },
  // Too padded to bend. Rolls from foot to foot instead of stepping.
  puffy: { stride: 0.16, bob: 0.07, lean: 0.02, squash: 0.05, sway: 1.0, waddle: 0.13 },
  // Slow, heavy, and lands hard enough that you can feel it.
  bigkid: { stride: 0.13, bob: 0.09, lean: 0.04, squash: 0.14, sway: 2.6, waddle: 0.06 },
};

const DEFAULT_GAIT: Gait = { stride: 0.26, bob: 0.13, lean: 0.06, squash: 0.08, sway: 1.2, waddle: 0 };

/**
 * Fake a walk cycle out of one still image.
 *
 * A sprite that only slides along x reads as a sticker being dragged, which is
 * exactly what it looked like on the first art run. Generating three or four
 * poses per kid would be the "proper" fix and is a bad trade: thirty more
 * billed images, and image models will not hold a character consistent across
 * frames, so you get four slightly different children per enemy.
 *
 * Instead the transform does the work, driven by the kid's POSITION rather than
 * a clock. That is the load-bearing detail: a kid in Sticky Slime covers less
 * ground per second, so her stride slows down with her, for free. A time-based
 * cycle would have her moonwalking.
 *
 * Two things make the difference between "bobbing" and "walking":
 *
 * **Everything pivots at the FEET.** Rotating and squashing about the centre
 * makes a body swing like a pendulum hung from its middle and sink into the
 * floor when it compresses. Pivoting at the feet is what plants it on the
 * ground.
 *
 * **It stretches at the top and squashes at the bottom.** Squash alone reads as
 * a limp; the stretch on the rise is what gives it a push-off.
 */
function applyGait(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  def: (typeof ENEMIES)[EnemyKind],
  walkPx: number,
): void {
  const feet = def.height * 0.85;

  // Standing still to chew on a toy is not walking. The gait freezes and a
  // shove-rhythm takes over, so a kid eating a pillow fort is visibly doing
  // something rather than paused mid-step.
  if (enemy.grabbing) {
    const tug = Math.sin(walkPx * 0.9);
    ctx.translate(tug * 1.8, 0);
    ctx.translate(0, feet);
    ctx.rotate(tug * 0.05);
    ctx.translate(0, -feet);
    return;
  }

  if (def.aerial) {
    // Floating: a slow lazy rise and fall and a gentle drift of the whole body.
    const t = walkPx * 0.09;
    ctx.translate(Math.sin(t * 0.7) * 1.6, Math.sin(t) * 3);
    ctx.rotate(Math.sin(t * 0.5) * 0.05);
    return;
  }

  if (def.kind === 'slider') {
    // On her front. No bob — the whole joke is that she is the one kid not on
    // her feet — just judder from the friction and a bit of skid.
    ctx.translate(0, Math.sin(walkPx * 0.7) * 0.7);
    ctx.rotate(Math.sin(walkPx * 0.35) * 0.03);
    return;
  }

  if (def.kind === 'wagon') {
    // Wheels on carpet: bumps, not steps.
    const bump = Math.abs(Math.sin(walkPx * 0.34));
    ctx.translate(0, -bump * 2.2);
    ctx.translate(0, feet);
    ctx.rotate(Math.sin(walkPx * 0.34) * 0.05);
    ctx.translate(0, -feet);
    return;
  }

  const g = GAITS[def.kind] ?? DEFAULT_GAIT;
  const phase = walkPx * g.stride;
  // Two steps per full cycle: `rise` peaks on each foot, `roll` alternates.
  const rise = Math.abs(Math.sin(phase));
  const roll = Math.sin(phase * 0.5);
  const plant = 1 - rise;

  ctx.translate(Math.cos(phase) * g.sway, -rise * def.height * g.bob);
  ctx.translate(0, feet);
  ctx.rotate(Math.cos(phase) * g.lean + roll * g.waddle);
  // Stretch on the way up, squash on the way down, about the feet.
  ctx.scale(1 + plant * g.squash * 0.7 - rise * g.squash * 0.35, 1 - plant * g.squash + rise * g.squash * 0.5);
  ctx.translate(0, -feet);
}

/** Shield, soaked and slowed. Drawn over the body, sprite or not. */
function drawStatusMarkers(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  def: (typeof ENEMIES)[EnemyKind],
): void {
  // The shield, drawn as a cardboard box lid held out front. Its own layer over
  // whatever is underneath, so "the shield is gone" is a visible event.
  if (enemy.shield > 0) {
    const full = (ENEMIES[enemy.kind].shield ?? 1) * (enemy.shield > 0 ? 1 : 0);
    ctx.fillStyle = alpha(PALETTE.chest, 0.95);
    ctx.fillRect(-def.width / 2 - 6, -def.height / 2 + 4, 6, def.height - 6);
    ctx.fillStyle = alpha(PALETTE.chestDark, 0.9);
    const wear = 1 - enemy.shield / Math.max(1, full);
    ctx.fillRect(-def.width / 2 - 6, -def.height / 2 + 4, 6, (def.height - 6) * wear);
  }

  // Soaked and slowed markers. Small, above the head, and different SHAPES:
  // a drip and a blob. Two coloured dots would be one thing to learn.
  if (enemy.lastHit === 'water' && enemy.hurt > 0) {
    ctx.fillStyle = PALETTE.kidSoaked;
    ctx.fillRect(-1, -def.height / 2 - 6, 2, 4);
  }
  if (enemy.slowFor > 0) {
    ctx.fillStyle = PALETTE.kidSlowed;
    ctx.beginPath();
    ctx.arc(5, -def.height / 2 - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Painters ---------------------------------------------------------------

function outline(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = PALETTE.kidOutline;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function head(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = PALETTE.kidHair;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.35, r * 0.92, Math.PI, Math.PI * 2);
  ctx.fill();
  // Facing left: both eyes on the left side of the head.
  ctx.fillStyle = PALETTE.kidOutline;
  ctx.fillRect(cx - r * 0.7, cy - 1, 1.5, 2);
  ctx.fillRect(cx - r * 0.2, cy - 1, 1.5, 2);
}

function drawCrawler(ctx: CanvasRenderingContext2D, body: string, accent: string, step: number): void {
  ctx.fillStyle = body;
  roundRect(ctx, -10, -3, 20, 11, 5);
  ctx.fill();
  outline(ctx);
  // Hands and knees, alternating.
  ctx.fillStyle = accent;
  ctx.fillRect(-9, 6 + step, 4, 4);
  ctx.fillRect(4, 6 - step, 4, 4);
  head(ctx, -10, -4, 6);
}

function drawToddler(ctx: CanvasRenderingContext2D, body: string, accent: string, step: number): void {
  ctx.fillStyle = accent;
  ctx.fillRect(-5, 6 + step, 4, 6);
  ctx.fillRect(1, 6 - step, 4, 6);
  ctx.fillStyle = body;
  roundRect(ctx, -7, -4, 14, 12, 4);
  ctx.fill();
  outline(ctx);
  // Arms out front, reaching for the unicorn. Every kid who walks does this;
  // it is the single clearest statement of what they all want.
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.fillRect(-11, -1, 5, 3);
  head(ctx, -2, -10, 7);
}

function drawRunner(ctx: CanvasRenderingContext2D, body: string, accent: string, step: number): void {
  ctx.save();
  // Leaning into the run. A tilt reads as speed at any size.
  ctx.rotate(-0.16);
  ctx.fillStyle = accent;
  ctx.fillRect(-6, 6 + step * 2, 4, 7);
  ctx.fillRect(2, 6 - step * 2, 4, 7);
  ctx.fillStyle = body;
  roundRect(ctx, -7, -4, 14, 11, 4);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.fillRect(-12, -2, 6, 3);
  ctx.fillRect(6, 1, 5, 3);
  head(ctx, -3, -10, 6.5);
  ctx.restore();
}

function drawRaincoat(ctx: CanvasRenderingContext2D, body: string, accent: string, step: number): void {
  ctx.fillStyle = accent;
  ctx.fillRect(-5, 8 + step, 4, 5);
  ctx.fillRect(1, 8 - step, 4, 5);
  // The coat: a bell, wider at the bottom, so water visibly runs off it.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-9, 9);
  ctx.lineTo(-6, -6);
  ctx.lineTo(6, -6);
  ctx.lineTo(9, 9);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  // The pointed hood. The single most identifiable outline in the game, and it
  // has to be, because it is the one that makes your water gun useless.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-9, -5);
  ctx.lineTo(-4, -16);
  ctx.lineTo(5, -14);
  ctx.lineTo(4, -5);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.beginPath();
  ctx.arc(-4, -8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.kidOutline;
  ctx.fillRect(-6, -9, 1.5, 2);
}

function drawBlanketMound(ctx: CanvasRenderingContext2D, body: string, step: number): void {
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-13, 12);
  ctx.quadraticCurveTo(-11, -14, 0, -13);
  ctx.quadraticCurveTo(12, -12, 13, 12);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  // Only the feet show. No face: you genuinely cannot tell who is under there.
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.fillRect(-6, 10 + step, 4, 3);
  ctx.fillRect(2, 10 - step, 4, 3);
  ctx.fillStyle = alpha(PALETTE.kidOutline, 0.25);
  for (let i = -8; i < 10; i += 6) {
    ctx.fillRect(i, -6, 1, 16);
  }
}

function drawBalloon(ctx: CanvasRenderingContext2D, body: string, accent: string, walk: number): void {
  const float = Math.sin(walk * 0.5) * 2;
  ctx.translate(0, float - 4);
  // String first, so the kid hangs from it.
  ctx.strokeStyle = PALETTE.kidOutline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, -13, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = alpha('#ffffff', 0.45);
  ctx.beginPath();
  ctx.ellipse(-3, -16, 2.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs dangling, not walking. Nothing about this kid touches the floor.
  ctx.fillStyle = body;
  roundRect(ctx, -6, 2, 12, 10, 4);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.fillRect(-4, 11, 3, 5);
  ctx.fillRect(1, 11, 3, 5);
  head(ctx, -1, -1, 5.5);
}

function drawPuffy(ctx: CanvasRenderingContext2D, body: string, accent: string, step: number): void {
  ctx.fillStyle = accent;
  ctx.fillRect(-7, 11 + step, 5, 4);
  ctx.fillRect(2, 11 - step, 5, 4);
  // Three stacked puffs. A quilted coat, and unmistakably the biggest
  // silhouette on the board short of the boss.
  ctx.fillStyle = body;
  roundRect(ctx, -14, -8, 28, 20, 9);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = alpha(PALETTE.kidOutline, 0.13);
  ctx.fillRect(-13, -2, 26, 1.5);
  ctx.fillRect(-13, 5, 26, 1.5);
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.fillRect(-19, 0, 6, 4);
  head(ctx, -4, -14, 7);
}

function drawSlider(ctx: CanvasRenderingContext2D, body: string, accent: string, walk: number): void {
  // Horizontal. The only kid in the game that isn't upright, which is the whole
  // reason you can tell at a glance that this is the fast one.
  ctx.save();
  ctx.rotate(-0.1);
  ctx.fillStyle = body;
  roundRect(ctx, -8, -2, 20, 10, 5);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = accent;
  ctx.fillRect(-14, 1, 7, 5);
  head(ctx, 12, 0, 6);
  // Speed lines behind, to the right.
  ctx.fillStyle = alpha('#ffffff', 0.5);
  for (let i = 0; i < 3; i++) {
    const offset = (walk * 6 + i * 5) % 14;
    ctx.fillRect(14 + offset, -3 + i * 4, 5, 1);
  }
  ctx.restore();
}

function drawWagon(ctx: CanvasRenderingContext2D, body: string, accent: string, walk: number): void {
  ctx.fillStyle = body;
  roundRect(ctx, -16, 0, 32, 12, 3);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = PALETTE.kidOutline;
  const spin = Math.sin(walk) * 1.2;
  ctx.beginPath();
  ctx.arc(-9, 13, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, 13, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-10 + spin, 12, 2, 2);
  ctx.fillRect(8 - spin, 12, 2, 2);
  // The passenger, sitting up out of the wagon.
  ctx.fillStyle = accent;
  roundRect(ctx, -6, -9, 12, 11, 4);
  ctx.fill();
  outline(ctx);
  head(ctx, -2, -14, 6);
}

function drawBigKid(ctx: CanvasRenderingContext2D, body: string, accent: string, step: number): void {
  ctx.fillStyle = PALETTE.kidOutline;
  ctx.fillRect(-10, 16 + step, 7, 6);
  ctx.fillRect(3, 16 - step, 7, 6);
  ctx.fillStyle = body;
  roundRect(ctx, -18, -10, 36, 28, 8);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = accent;
  ctx.fillRect(-6, -6, 12, 12);
  // Arms out wide. He wants a very big hug.
  ctx.fillStyle = PALETTE.kidSkin;
  ctx.fillRect(-26, -4, 9, 5);
  ctx.fillRect(17, -4, 9, 5);
  head(ctx, -6, -19, 10);
  // A stuffie in the raised hand, so the throw is telegraphed by the pose too.
  ctx.fillStyle = PALETTE.cushion;
  roundRect(ctx, 18, -12, 9, 8, 3);
  ctx.fill();
  outline(ctx);
}
