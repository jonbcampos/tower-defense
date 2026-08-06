/**
 * Generated art, layered over the hand-drawn painters.
 *
 * The whole module is optional. If `public/sprites/index.json` is missing —
 * because nobody has run `scripts/generate-art.mjs`, or the run failed, or half
 * of it failed — `sprite()` returns null for everything and every painter falls
 * back to the shapes it always drew. That is not a graceful-degradation nicety,
 * it is the design: the game shipped playable without any of this, the fairness
 * trials know nothing about it, and a bad art run must never be able to break a
 * working game.
 *
 * Loading is fire-and-forget at startup. Nothing waits for it; sprites simply
 * start appearing as they arrive, which on a warm cache is within a frame or
 * two and on a cold one is a second of hand-drawn art nobody will notice.
 *
 * ## Backgrounds
 *
 * The prompts ask for a flat green background rather than transparency,
 * because image models are far more reliable at "paint the background one flat
 * colour" than at producing an alpha channel. Removing it happens here, on a
 * canvas, once per image.
 *
 * The removal is a FLOOD FILL from the edges, not "delete every green pixel".
 * The difference matters: a flood fill only removes background that is actually
 * connected to the border, so a green highlight inside the slime survives while
 * the green around it goes. It also keys on the colour it finds in the corners
 * rather than on a hard-coded green, so a model that ignores the instruction
 * and gives you a flat white background still works.
 */

interface SpriteIndex {
  generated: string[];
  /** File extension the generator wrote. JPEG today; see generate-art.mjs. */
  ext?: string;
  /** Pieces whose background must NOT be removed — full-bleed images. */
  opaque: string[];
}

const sprites = new Map<string, HTMLCanvasElement>();
let loaded = false;

/**
 * How close a pixel must be to the corner colour to count as background.
 *
 * Generous, because the source is JPEG. Lossy compression puts ringing and
 * colour noise along every edge that meets the flat background, so a tolerance
 * tuned for a clean PNG leaves a speckled green halo around every character.
 */
const KEY_TOLERANCE = 96;
/** Pixels within this of the edge of the key get a soft alpha, to avoid fringing. */
const KEY_FEATHER = 56;

export function spritesReady(): boolean {
  return loaded;
}

export function spriteCount(): number {
  return sprites.size;
}

/** The generated image for an id, or null if there isn't one. */
export function sprite(id: string): HTMLCanvasElement | null {
  return sprites.get(id) ?? null;
}

/**
 * Draw a sprite centred on (x, y), scaled to fit a box, preserving its aspect.
 *
 * Smoothing is forced on and then restored. The viewport turns smoothing OFF
 * globally, which is right for the hand-drawn art — crisp rectangles — and
 * wrong for a downscaled painting, which without it turns into aliased mush.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
): void {
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
  ctx.imageSmoothingEnabled = smoothing;
}

/** Kick off loading. Safe to call once at startup; never throws, never blocks. */
export function loadSprites(baseUrl: string): void {
  void (async () => {
    let index: SpriteIndex;
    try {
      const response = await fetch(`${baseUrl}sprites/index.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(String(response.status));
      index = (await response.json()) as SpriteIndex;
      if (!Array.isArray(index.generated)) throw new Error('malformed index');
    } catch {
      // No generated art. Entirely normal — this is how the game shipped.
      loaded = true;
      return;
    }

    const opaque = new Set(index.opaque ?? []);
    await Promise.all(
      index.generated.map(async (id) => {
        try {
          const image = await loadImage(`${baseUrl}sprites/${id}.${index.ext ?? 'jpg'}`);
          sprites.set(id, opaque.has(id) ? toCanvas(image) : cutOutBackground(image));
        } catch {
          // One bad file loses one sprite, not the set.
        }
      }),
    );
    loaded = true;
  })();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

function toCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  return canvas;
}

/**
 * Remove the flat background by flooding inwards from every edge pixel.
 *
 * Returns a canvas rather than ImageData because a canvas can be handed
 * straight to `drawImage`, and doing the work once at load beats doing it
 * sixty times a second forever.
 */
function cutOutBackground(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = toCanvas(image);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;

  // The key colour is the average of the four corners. Averaging rather than
  // picking one corner survives a model that put a faint gradient in the
  // background instead of the flat fill it was asked for.
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  let kr = 0;
  let kg = 0;
  let kb = 0;
  for (const i of corners) {
    kr += data[i]!;
    kg += data[i + 1]!;
    kb += data[i + 2]!;
  }
  kr /= 4;
  kg /= 4;
  kb /= 4;

  // If the corners already have alpha, the model gave us real transparency and
  // there is nothing to key out.
  const cornerAlpha = corners.reduce((sum, i) => sum + data[i + 3]!, 0) / 4;
  if (cornerAlpha < 200) return canvas;

  const distanceAt = (i: number): number => {
    const dr = data[i]! - kr;
    const dg = data[i + 1]! - kg;
    const db = data[i + 2]! - kb;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // Iterative flood fill with an explicit stack — a recursive one blows the
  // call stack on a 1024x1024 image, which is exactly the size we generate.
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, x + (height - 1) * width);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, width - 1 + y * width);
  }

  while (stack.length > 0) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const distance = distanceAt(i);
    if (distance > KEY_TOLERANCE + KEY_FEATHER) continue;

    // Feathered edge: pixels close to the key go fully transparent, pixels on
    // the boundary fade. A hard cut leaves a green rim on every curve, which at
    // this scale is the difference between "a sprite" and "a sticker".
    if (distance <= KEY_TOLERANCE) {
      data[i + 3] = 0;
    } else {
      const t = (distance - KEY_TOLERANCE) / KEY_FEATHER;
      data[i + 3] = Math.min(data[i + 3]!, Math.round(255 * t));
      continue; // don't spread through a partially-kept pixel
    }

    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  ctx.putImageData(frame, 0, 0);
  return canvas;
}
