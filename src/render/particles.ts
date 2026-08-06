/**
 * Particles.
 *
 * A fixed pool, drawn as flat rectangles and circles. Nothing here is clever;
 * what it has to be is free. The board can have a dozen kids, thirty
 * projectiles and five toys firing at once, and none of that may cost a frame.
 *
 * Unlike the sibling games these do NOT drift with a scroll speed, because
 * nothing scrolls. A particle is placed in board coordinates and stays there.
 */

import { POOL } from '../game/config';
import { PALETTE, alpha } from './palette';

type Shape = 'dot' | 'square' | 'ring';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration. Bubbles use a negative one and float up. */
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: Shape;
  active: boolean;
}

export class Particles {
  private readonly items: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL.particles; i++) {
      this.items.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: '#ffffff',
        shape: 'dot',
        active: false,
      });
    }
  }

  /**
   * Take the next slot, live or not.
   *
   * A ring buffer rather than a search for a free slot: when the pool is full
   * the oldest particle is the right one to lose, and a scan that finds nothing
   * would silently drop the newest effect instead — which is always the one the
   * player just caused and is looking straight at.
   */
  private next(): Particle {
    const item = this.items[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.items.length;
    return item;
  }

  private spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    gravity: number,
    life: number,
    size: number,
    color: string,
    shape: Shape,
  ): void {
    const item = this.next();
    item.x = x;
    item.y = y;
    item.vx = vx;
    item.vy = vy;
    item.gravity = gravity;
    item.life = life;
    item.maxLife = life;
    item.size = size;
    item.color = color;
    item.shape = shape;
    item.active = true;
  }

  /** A kid wandering off: a puff of their own colour, drifting up and away. */
  kidLeaves(x: number, y: number, color: string, random: () => number): void {
    for (let i = 0; i < 10; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 20 + random() * 40;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 30,
        60,
        0.5 + random() * 0.3,
        2 + random() * 2,
        i % 3 === 0 ? PALETTE.shotBubble : color,
        'dot',
      );
    }
  }

  /** Water landing. Falls, unlike everything else here. */
  splash(x: number, y: number, random: () => number): void {
    for (let i = 0; i < 5; i++) {
      this.spawn(
        x,
        y,
        (random() - 0.5) * 70,
        -20 - random() * 40,
        280,
        0.35,
        2,
        PALETTE.shotWater,
        'dot',
      );
    }
  }

  /** Bubbles pop upward and outward, and do not fall. */
  bubblePop(x: number, y: number, random: () => number): void {
    for (let i = 0; i < 6; i++) {
      this.spawn(
        x,
        y,
        (random() - 0.5) * 60,
        -20 - random() * 30,
        -20,
        0.45,
        2 + random() * 2,
        PALETTE.shotBubble,
        'ring',
      );
    }
  }

  /** An immunity bounce: droplets deflecting off a hood. */
  shrug(x: number, y: number, random: () => number): void {
    for (let i = 0; i < 4; i++) {
      this.spawn(
        x,
        y,
        30 + random() * 50,
        -30 - random() * 40,
        320,
        0.4,
        2,
        PALETTE.shotWater,
        'dot',
      );
    }
  }

  /** A toy going down. Deliberately chunky — this one should sting. */
  toyLost(x: number, y: number, color: string, random: () => number): void {
    for (let i = 0; i < 12; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 40 + random() * 70;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 40,
        300,
        0.6 + random() * 0.3,
        2 + random() * 3,
        i % 4 === 0 ? PALETTE.toyDamaged : color,
        'square',
      );
    }
  }

  collect(x: number, y: number, random: () => number): void {
    for (let i = 0; i < 6; i++) {
      const angle = random() * Math.PI * 2;
      this.spawn(
        x,
        y,
        Math.cos(angle) * 40,
        Math.sin(angle) * 40 - 20,
        -40,
        0.4,
        2,
        PALETTE.sparkleCore,
        'dot',
      );
    }
  }

  place(x: number, y: number, random: () => number): void {
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI + random() * Math.PI;
      this.spawn(x, y + 8, Math.cos(angle) * 50, Math.sin(angle) * 30, 200, 0.3, 2, PALETTE.toyHighlight, 'dot');
    }
  }

  /** A whole lane lighting up or being powdered. Wide and brief. */
  laneSweep(y: number, from: number, to: number, color: string, random: () => number): void {
    for (let i = 0; i < 16; i++) {
      const x = from + random() * (to - from);
      this.spawn(x, y + (random() - 0.5) * 24, (random() - 0.5) * 30, -20 - random() * 30, -30, 0.55, 3, color, 'dot');
    }
  }

  update(dt: number): void {
    for (const item of this.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        continue;
      }
      item.vy += item.gravity * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const item of this.items) {
      if (!item.active) continue;
      const fade = Math.min(1, item.life / item.maxLife);
      ctx.fillStyle = alpha(item.color, fade);
      if (item.shape === 'square') {
        ctx.fillRect(item.x - item.size / 2, item.y - item.size / 2, item.size, item.size);
      } else if (item.shape === 'ring') {
        ctx.strokeStyle = alpha(item.color, fade);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  reset(): void {
    for (const item of this.items) item.active = false;
    this.cursor = 0;
  }
}
