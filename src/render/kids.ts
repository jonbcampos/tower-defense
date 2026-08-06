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
import { drawSprite, sprite, spriteFrames } from './sprites';

/** How faded a kid under an unrevealed blanket is. Visible, but not readable. */
const CONCEALED_ALPHA = 0.75;

/**
 * How big a kid is drawn, as a multiple of its own `height`.
 *
 * Deliberately large enough that the tallest kids overflow their lane. A lane
 * is 40px and a toddler's collision box is 26 tall, so sizing the art to the
 * box left the cast looking like distant figures on a big empty floor.
 *
 * Two things make the overflow safe rather than messy. It is **render only** —
 * `def.width` and `def.height` are what the simulation aims and collides with,
 * and nothing here touches them, so making a kid look bigger cannot make her
 * easier to hit. And the board is drawn row by row in `scene.ts`, near lane
 * last, so a kid who overlaps upward passes in front of the row behind her and
 * behind the row in front — which is what overlapping is for.
 *
 * Driven by height rather than by the smaller of the two dimensions, because
 * these are narrow upright children: clamping to width made a toddler 34px
 * wide *and* 34px tall, throwing away a third of the room she had.
 */
const KID_ART_SCALE = 2;

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
  // Concealment is a dimming, NOT a different way of being drawn. It used to be
  // its own early-return branch that painted the still sprite and stopped, which
  // meant the one kid it applies to slid across half the board without moving a
  // muscle and then abruptly started walking the moment she peeked out. Anything
  // that opts out of the animation path will do that again, so don't add one:
  // this is the only kid who can be concealed, and concealed or not she is the
  // same featureless mound, so there is nothing to hide by animating her.
  const veiled = enemy.concealed;
  const body = veiled
    ? PALETTE.kidHidden
    : enemy.hurt > 0
      ? mix(def.color, PALETTE.kidHealthLost, Math.min(1, enemy.hurt * 5))
      : def.color;

  ctx.save();
  ctx.translate(x, y);

  // Contact shadow. Floaters get a smaller, fainter one further down — the
  // cheapest possible way to say "this one is off the ground".
  const aerial = def.aerial === true;
  ctx.fillStyle = alpha(PALETTE.kidOutline, aerial ? 0.16 : 0.3);
  ctx.beginPath();
  ctx.ellipse(0, def.height / 2 + (aerial ? 8 : 1), aerial ? 6 : def.width / 2.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Generated art wins if it exists — but only for the BODY. The shield, the
  // soaked drip and the slowed blob are drawn over the top either way, because
  // they are game state rather than character design and they have to look
  // identical whether or not somebody has run the art script.
  // Three layers, best first: a real frame cycle, a still, then the painters
  // below. Each is independently optional, so a half-finished art run gives some
  // kids cycles, some kids stills and some kids rectangles — all playable.
  const cycle = spriteFrames(`${enemy.kind}.walk`);
  const image = cycle ? frameFor(cycle, def, walkPx) : sprite(enemy.kind);
  if (image) {
    ctx.save();
    // Sprites can't be tinted the way a fill can, so a hurt kid flashes by going
    // briefly translucent, and a concealed one sits permanently faded. Same read
    // at a glance, and they multiply rather than fight when both apply.
    let fade = veiled ? CONCEALED_ALPHA : 1;
    if (enemy.hurt > 0) fade *= 1 - Math.min(0.45, enemy.hurt * 3);
    ctx.globalAlpha = fade;
    if (cycle) settleFrame(ctx, enemy, def, walkPx);
    else applyGait(ctx, enemy, def, walkPx);
    const box = def.height * KID_ART_SCALE;
    drawSprite(ctx, image, 0, 0, box, box);
    ctx.restore();
    // No status markers while concealed: a shield or a soaked drip floating over
    // the mound would say more about who is under there than the blanket should.
    if (!veiled) drawStatusMarkers(ctx, enemy, def);
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
 * Which pose to show, from the kid's POSITION rather than a clock.
 *
 * That is the load-bearing detail, and it is the same one the transform below
 * relies on: a kid wading through Sticky Slime covers less ground per second, so
 * she turns over fewer frames per second and visibly plods. Drive this from a
 * timer instead and a slowed kid moonwalks — legs pumping at full speed while
 * she inches along.
 *
 * It also means a kid who has stopped to chew on a pillow fort simply holds a
 * pose, with no special case needed: her x is not changing, so her phase is not
 * changing. `settleFrame` gives her the shoving motion on top.
 *
 * The cadence that falls out is around three frames a second — a real toddler
 * taking a step every half second, which is slower than a cartoon would run it
 * and is deliberately not sped up. Twice the frame rate would look livelier and
 * would also be a child sprinting on the spot.
 */
function frameFor(
  cycle: readonly HTMLCanvasElement[],
  def: (typeof ENEMIES)[EnemyKind],
  walkPx: number,
): HTMLCanvasElement {
  const gait = GAITS[def.kind] ?? DEFAULT_GAIT;
  const perFrame = (Math.PI * 2) / cycle.length;
  const index = Math.floor((walkPx * gait.stride) / perFrame);
  // Kids walk leftwards, so the phase counts DOWN and the modulo goes negative.
  const wrapped = ((index % cycle.length) + cycle.length) % cycle.length;
  return cycle[wrapped] ?? cycle[0]!;
}

/**
 * The small continuous motion that sits on top of a frame cycle.
 *
 * Deliberately much less than `applyGait` does. The frames already contain the
 * bob, the squash and the lean — they were drawn that way — so repeating any of
 * it here would double it, and worse, would double it slightly out of phase.
 * What is left is the part four frames cannot express: the things that depend on
 * game state rather than on the walk.
 */
function settleFrame(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  def: (typeof ENEMIES)[EnemyKind],
  walkPx: number,
): void {
  if (enemy.grabbing) {
    // Standing still tugging at a toy. The frame is frozen, so all of the
    // motion has to come from here or she looks paused rather than busy.
    const feet = def.height * 0.85;
    const tug = Math.sin(walkPx * 0.9);
    ctx.translate(tug * 1.8, 0);
    ctx.translate(0, feet);
    ctx.rotate(tug * 0.05);
    ctx.translate(0, -feet);
    return;
  }

  if (def.aerial) {
    // Her frames are centre-aligned precisely so they contribute no vertical
    // movement of their own, which leaves the float to be added here.
    const t = walkPx * 0.09;
    ctx.translate(Math.sin(t * 0.7) * 1.6, Math.sin(t) * 3);
    ctx.rotate(Math.sin(t * 0.5) * 0.05);
    return;
  }

  if (def.kind === 'slider') {
    // Friction judder, which is a vibration rather than a pose and so cannot
    // live in four frames without strobing.
    ctx.translate(0, Math.sin(walkPx * 0.7) * 0.7);
    return;
  }

  // Everyone else: a weight shift, and nothing else. Sub-pixel and continuous,
  // it fills the gap between one frame and the next without competing with it.
  const gait = GAITS[def.kind] ?? DEFAULT_GAIT;
  ctx.translate(Math.cos(walkPx * gait.stride) * gait.sway * 0.4, 0);
}

/**
 * Fake a walk cycle out of one still image.
 *
 * The fallback for a character with no generated frame sheet — either because
 * the art script has never been run, or because that one sheet failed to
 * generate or failed to slice. A sprite that only slides along x reads as a
 * sticker being dragged, and this is a great deal better than that; it is not,
 * and was never really, as good as four drawn poses.
 *
 * Driven by the kid's POSITION rather than a clock, for the same reason
 * `frameFor` is.
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
