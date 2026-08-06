/**
 * Sparkles: the currency, and the drops it arrives as.
 *
 * Two sources, and the split is deliberate. Producers are the interesting one —
 * spending a cell and 25 sparkles now to have more later is the actual game of
 * a lane defence. The free trickle is the boring one, and it exists so that a
 * player whose board has just been wiped out is never sitting on zero with
 * nothing to do but watch. A contract, not a hunch, decides how slow it can be.
 */

import { POOL, SPARKLE } from './config';

export interface Sparkle {
  x: number;
  y: number;
  prevY: number;
  /** Falls to here and then sits, so a drop never lands under a kid's feet. */
  restY: number;
  vy: number;
  value: number;
  /** Counts down; the last `fadeLast` seconds are drawn fading. */
  life: number;
  /** Seconds since it landed, for EASY's auto-collect. */
  age: number;
  active: boolean;
}

export class SparkleField {
  readonly items: Sparkle[] = [];

  constructor() {
    for (let i = 0; i < POOL.sparkles; i++) {
      this.items.push({
        x: 0,
        y: 0,
        prevY: 0,
        restY: 0,
        vy: 0,
        value: 0,
        life: 0,
        age: 0,
        active: false,
      });
    }
  }

  /**
   * Drop a sparkle. Returns null when the pool is full, and that is fine: the
   * alternative is recycling a live drop, which takes money out of the player's
   * hand to put money in it. Dropping the drop is the honest failure.
   */
  drop(x: number, y: number, value: number): Sparkle | null {
    const item = this.items.find((s) => !s.active);
    if (!item) return null;
    item.x = x;
    item.y = y;
    item.prevY = y;
    item.restY = y + SPARKLE.scatter;
    // A small upward pop first. A drop that only falls reads as debris; a drop
    // that hops reads as something that came out of the jar.
    item.vy = -34;
    item.value = value;
    item.life = SPARKLE.lifetime;
    item.age = 0;
    item.active = true;
    return item;
  }

  update(dt: number, autoCollect: boolean, collect: (sparkle: Sparkle) => void): void {
    for (const item of this.items) {
      if (!item.active) continue;
      item.prevY = item.y;
      if (item.y < item.restY) {
        item.vy += 240 * dt;
        item.y = Math.min(item.restY, item.y + item.vy * dt);
      } else {
        item.y = item.restY;
        item.vy = 0;
        item.age += dt;
      }

      if (autoCollect && item.age >= SPARKLE.autoCollectDelay) {
        item.active = false;
        collect(item);
        continue;
      }

      item.life -= dt;
      if (item.life <= 0) item.active = false;
    }
  }

  /**
   * The drop nearest a tap, within the tap radius.
   *
   * Nearest rather than first-found: two drops from the same jar land close
   * together, and a tap between them should take the one the thumb was aiming
   * at rather than whichever happens to sit earlier in the pool.
   */
  tapAt(x: number, y: number): Sparkle | null {
    let best: Sparkle | null = null;
    let bestDistance = SPARKLE.tapRadius * SPARKLE.tapRadius;
    for (const item of this.items) {
      if (!item.active) continue;
      const dx = item.x - x;
      const dy = item.y - y;
      const distance = dx * dx + dy * dy;
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
    return best;
  }

  count(): number {
    let total = 0;
    for (const item of this.items) if (item.active) total += 1;
    return total;
  }

  reset(): void {
    for (const item of this.items) item.active = false;
  }
}
