/**
 * Button pictograms.
 *
 * The player is five and is not reading yet. The words on the buttons are still
 * worth having — she is learning, and a parent needs them — but the word can
 * never be the only thing carrying the meaning. Every button gets a shape she
 * can recognise from across the room, and the label sits next to it.
 *
 * Rules for adding one:
 *
 *  - It has to read at 14px. If it needs detail to be legible, it is the wrong
 *    pictogram, not a pictogram that needs more pixels.
 *  - It has to be a DIFFERENT SHAPE from every other icon on the same screen.
 *    Two icons that differ only in colour or in which way an arrow points are
 *    two icons a child will mix up under pressure.
 *  - It must not depend on knowing another symbol. A right-pointing triangle
 *    means "go" to anyone who has seen a screen; a floppy disk means nothing.
 */

export type IconId =
  | 'none'
  | 'play'
  | 'back'
  | 'again'
  | 'next'
  | 'levels'
  | 'guide'
  | 'prev'
  | 'pause'
  | 'easy'
  | 'normal'
  | 'hard';

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  id: IconId,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  if (id === 'none') return;
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (id) {
    case 'play':
      // A solid right-pointing triangle. The one symbol every screen shares.
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s);
      ctx.lineTo(s * 0.85, 0);
      ctx.lineTo(-s * 0.6, s);
      ctx.closePath();
      ctx.fill();
      break;

    case 'back':
      // An arrow pointing left: shaft plus head, so it isn't just a chevron.
      ctx.beginPath();
      ctx.moveTo(s * 0.85, 0);
      ctx.lineTo(-s * 0.5, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, 0);
      ctx.lineTo(-s * 0.05, -s * 0.7);
      ctx.lineTo(-s * 0.05, s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;

    case 'again': {
      // A circular arrow. Distinct from every straight arrow by being round.
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.75, Math.PI * 0.35, Math.PI * 1.85);
      ctx.stroke();
      const ax = Math.cos(Math.PI * 0.35) * s * 0.75;
      const ay = Math.sin(Math.PI * 0.35) * s * 0.75;
      ctx.beginPath();
      ctx.moveTo(ax + s * 0.45, ay - s * 0.1);
      ctx.lineTo(ax - s * 0.2, ay + s * 0.35);
      ctx.lineTo(ax + s * 0.15, ay - s * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'next':
      // Two triangles: "forward, further than play".
      for (const dx of [-s * 0.55, s * 0.2]) {
        ctx.beginPath();
        ctx.moveTo(dx, -s * 0.8);
        ctx.lineTo(dx + s * 0.7, 0);
        ctx.lineTo(dx, s * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      break;

    case 'guide': {
      // An open book. A question mark would be the obvious choice and is
      // useless here: the player who most needs this button cannot read, and a
      // '?' is a letter to her. A book is a thing she has held.
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.62);
      ctx.lineTo(0, s * 0.66);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.62);
        ctx.quadraticCurveTo(side * s * 0.5, -s * 0.86, side * s * 0.88, -s * 0.5);
        ctx.lineTo(side * s * 0.88, s * 0.5);
        ctx.quadraticCurveTo(side * s * 0.5, s * 0.3, 0, s * 0.66);
        ctx.stroke();
      }
      break;
    }

    case 'prev': {
      // The mirror of 'next'. Drawn out rather than reusing 'next' with a flip,
      // because everything else here is drawn and a lone transform would be the
      // one thing a reader has to go and check.
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.72);
      ctx.lineTo(-s * 0.55, 0);
      ctx.lineTo(s * 0.5, s * 0.72);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'pause': {
      // Two upright bars. It is the one pictogram here that a child will not
      // arrive already knowing, and it is used anyway: it is the universal
      // symbol, she will meet it on every other screen she ever touches, and
      // the alternatives are worse. A '×' means "gone" and this button does not
      // throw the run away; a door needs a hinge and a handle to read as a door
      // and neither survives 14px.
      //
      // It also passes the different-shape rule trivially — nothing else in the
      // set is a pair of vertical bars, and its opposite number on the panel it
      // opens is 'play', which is the shape it is culturally paired with.
      const bar = s * 0.34;
      for (const side of [-1, 1]) {
        ctx.fillRect(side * s * 0.52 - bar / 2, -s * 0.72, bar, s * 1.44);
      }
      break;
    }

    case 'levels': {
      // A grid of squares — literally a picture of the level-select screen.
      const cell = s * 0.62;
      const gap = s * 0.22;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          ctx.fillRect(
            -s * 0.8 + col * (cell + gap),
            -s * 0.8 + row * (cell + gap),
            cell,
            cell,
          );
        }
      }
      break;
    }

    // One, two or three pips. Counting is the one abstraction a five-year-old
    // definitely has.
    //
    // These were little unicorn heads at first — a circle with a horn on top —
    // and at 16px the horn merged into the circle and the whole thing read as a
    // teardrop. Countability is the entire job here, so the pips are plain,
    // round and well spaced, and nothing is added that would blur them. They
    // are deliberately NOT stars: stars already mean "how well you did" on the
    // level cards, and one symbol meaning two things is worse than an abstract
    // one meaning one thing.
    case 'easy':
      pips(ctx, 1, s, color);
      break;
    case 'normal':
      pips(ctx, 2, s, color);
      break;
    case 'hard':
      pips(ctx, 3, s, color);
      break;
  }

  ctx.restore();
}

function pips(ctx: CanvasRenderingContext2D, count: number, s: number, color: string): void {
  const r = s * 0.3;
  // 2.6 radii apart: the gap between pips is wider than a pip, so three of them
  // never blur into one lump at small sizes or on a low-DPI screen.
  const spacing = r * 2.6;
  const startX = -((count - 1) * spacing) / 2;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A tick badge, for a card that is currently chosen. */
export function drawTick(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fill: string,
  mark: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mark;
  ctx.lineWidth = Math.max(1.5, radius * 0.34);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.45, cy);
  ctx.lineTo(cx - radius * 0.1, cy + radius * 0.42);
  ctx.lineTo(cx + radius * 0.5, cy - radius * 0.42);
  ctx.stroke();
}
