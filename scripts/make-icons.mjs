/**
 * Generates the PWA icons.
 *
 * Written as a script rather than committing PNGs by hand so the icon stays
 * editable: it's drawn from the same palette as the game, so when the art
 * direction changes (the 16-bit renderer is planned), you change these numbers
 * and re-run instead of trying to hand-edit a binary.
 *
 *   node scripts/make-icons.mjs
 *
 * No dependencies — it rasterises into an RGBA buffer and writes the PNG with
 * Node's built-in zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---------------------------------------------------------------- raster ---

class Raster {
  constructor(size) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
  }

  /** Source-over blend of a solid colour, so translucent glow layers stack. */
  fillRect(x, y, w, h, [r, g, b], a = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.size, Math.round(x + w));
    const y1 = Math.min(this.size, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.size + px) * 4;
        this.data[i] = this.data[i] * (1 - a) + r * a;
        this.data[i + 1] = this.data[i + 1] * (1 - a) + g * a;
        this.data[i + 2] = this.data[i + 2] * (1 - a) + b * a;
        this.data[i + 3] = 255;
      }
    }
  }

  verticalGradient(top, bottom) {
    for (let y = 0; y < this.size; y++) {
      const t = y / (this.size - 1);
      const c = [0, 1, 2].map((k) => top[k] + (bottom[k] - top[k]) * t);
      this.fillRect(0, y, this.size, 1, c, 1);
    }
  }
}

// ------------------------------------------------------------------ png ----

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, body])));
  return Buffer.concat([length, typeBytes, body, crc]);
}

function encodePng(raster) {
  const { size, data } = raster;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type; 0 (none) is fine here
  // because the image is flat colour blocks and compresses well regardless.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- icon ----

// Straight from BEDROOM_PALETTE in src/render/palette.ts — the icon should
// match what the game actually looks like, since it sits on the home screen
// next to everything else and is the only preview anyone gets.
const WALL_TOP = [74, 58, 107];
const WALL_BOTTOM = [95, 74, 125];
const FLOOR = [107, 84, 135];
const CUSHION = [255, 158, 199];
const CUSHION_DARK = [217, 122, 165];
const BODY = [255, 248, 251];
const BODY_SHADE = [230, 211, 226];
const MANE = [168, 108, 255];
const HORN = [255, 209, 102];
const EYE = [58, 42, 82];
const BLUSH = [255, 179, 209];
const BUBBLE = [223, 244, 255];
const SPARKLE = [255, 217, 77];

/**
 * The icon is authored on a 512 grid and scaled, with everything kept inside
 * the middle ~80%. Android crops maskable icons to a circle or squircle, so
 * anything near the edge is liable to be sliced off.
 *
 * It is the unicorn head-on rather than the board. At 48px on a home screen you
 * cannot read five lanes of anything, but you can read "white horse face, gold
 * horn, purple". The bubbles are what make it this game rather than a pony app.
 */
function drawIcon(size) {
  const r = new Raster(size);
  const u = size / 512;
  r.verticalGradient(WALL_TOP, WALL_BOTTOM);

  // Floor and cushion, so she is sitting on something.
  r.fillRect(0, 392 * u, size, size - 392 * u, FLOOR, 1);
  r.fillRect(96 * u, 384 * u, 320 * u, 44 * u, CUSHION_DARK, 1);
  r.fillRect(104 * u, 372 * u, 304 * u, 32 * u, CUSHION, 1);

  // Body: a wide rounded blob, corners knocked off so it reads as plush.
  r.fillRect(148 * u, 248 * u, 216 * u, 136 * u, BODY, 1);
  r.fillRect(132 * u, 268 * u, 248 * u, 96 * u, BODY, 1);
  r.fillRect(148 * u, 330 * u, 216 * u, 54 * u, BODY_SHADE, 0.5);

  // Head, big and centred. At icon sizes the head IS the character.
  r.fillRect(176 * u, 132 * u, 160 * u, 132 * u, BODY, 1);
  r.fillRect(160 * u, 156 * u, 192 * u, 88 * u, BODY, 1);

  // Ears.
  r.fillRect(180 * u, 106 * u, 30 * u, 40 * u, BODY, 1);
  r.fillRect(302 * u, 106 * u, 30 * u, 40 * u, BODY, 1);

  // Horn. The only gold in the icon, and dead centre.
  r.fillRect(240 * u, 60 * u, 32 * u, 56 * u, HORN, 1);
  r.fillRect(248 * u, 30 * u, 16 * u, 36 * u, HORN, 1);

  // Mane, falling down both sides of the head.
  r.fillRect(150 * u, 140 * u, 34 * u, 108 * u, MANE, 1);
  r.fillRect(328 * u, 140 * u, 34 * u, 108 * u, MANE, 1);
  r.fillRect(196 * u, 112 * u, 120 * u, 26 * u, MANE, 1);

  // Face.
  r.fillRect(206 * u, 182 * u, 26 * u, 30 * u, EYE, 1);
  r.fillRect(280 * u, 182 * u, 26 * u, 30 * u, EYE, 1);
  r.fillRect(184 * u, 224 * u, 30 * u, 18 * u, BLUSH, 0.8);
  r.fillRect(298 * u, 224 * u, 30 * u, 18 * u, BLUSH, 0.8);

  // Bubbles drifting up the right-hand side: the reason this is a defence game
  // and not a pony. Drawn as rings so they read as bubbles at small sizes.
  const bubbles = [
    [404, 214, 30],
    [438, 148, 22],
    [396, 108, 16],
  ];
  for (const [bx, by, br] of bubbles) {
    ring(r, bx * u, by * u, br * u, Math.max(1, 5 * u), BUBBLE);
  }
  r.fillRect(92 * u, 168 * u, 18 * u, 18 * u, SPARKLE, 1);
  r.fillRect(84 * u, 176 * u, 34 * u, 2 * u, SPARKLE, 1);

  return r;
}

/** A hollow circle, drawn by stamping small squares around the circumference. */
function ring(raster, cx, cy, radius, thickness, colour) {
  for (let a = 0; a < 360; a += 3) {
    const rad = (a * Math.PI) / 180;
    raster.fillRect(
      cx + Math.cos(rad) * radius - thickness / 2,
      cy + Math.sin(rad) * radius - thickness / 2,
      thickness,
      thickness,
      colour,
      1,
    );
  }
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512, 180]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, encodePng(drawIcon(size)));
  console.log(`wrote ${file}`);
}
