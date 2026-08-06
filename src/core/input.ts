/**
 * Input.
 *
 * A lane defence has exactly one gesture — tap a thing — so this is far simpler
 * than the sibling games' held-button rig. What it inherits from them is the
 * part that actually matters on a phone:
 *
 *  1. Every pointer is tracked by `pointerId`, so a second finger works. A
 *     child collecting sparkles with one hand while placing a toy with the
 *     other is not an edge case, it is how she plays.
 *  2. Taps are QUEUED, not latched. A fixed 1/120s step can easily see two taps
 *     between frames when someone is mashing a pile of sparkles, and a single
 *     `pendingTap` slot silently throws the first one away. Losing a tap that
 *     was worth 20 sparkles is exactly the kind of thing that reads as "the
 *     game is broken" to someone who cannot articulate what went wrong.
 *  3. `releaseAll` on blur and visibilitychange, because a backgrounded tab
 *     never delivers pointerup.
 *
 * The pointer position is also published continuously, so a held card can draw
 * a ghost of itself under the finger before it commits.
 */

import type { Viewport } from './viewport';

export interface Tap {
  x: number;
  y: number;
}

/** Keyboard shortcuts, for testing on a desktop without a touchscreen. */
export type KeyAction = 'card1' | 'card2' | 'card3' | 'card4' | 'card5' | 'cancel' | 'confirm';

/** Enough for any plausible burst between two fixed steps. */
const TAP_QUEUE = 8;
const KEY_QUEUE = 8;

export class Input {
  /** Where the pointer is now, for the placement ghost. */
  readonly pointer = { x: 0, y: 0, inside: false, down: false };

  /** Set on any input at all — used to unlock WebAudio. */
  anyPressThisTick = false;

  private readonly taps: Tap[] = [];
  private tapCount = 0;
  private readonly keys: KeyAction[] = [];
  private keyCount = 0;

  private readonly pointers = new Set<number>();

  constructor(private viewport: Viewport) {
    for (let i = 0; i < TAP_QUEUE; i++) this.taps.push({ x: 0, y: 0 });
    for (let i = 0; i < KEY_QUEUE; i++) this.keys.push('cancel');

    const canvas = viewport.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointers.add(e.pointerId);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.inside = true;
    this.pointer.down = true;
    this.anyPressThisTick = true;
    this.pushTap(x, y);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.inside = true;
    if (this.pointers.has(e.pointerId)) e.preventDefault();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.pointer.down = this.pointers.size > 0;
  };

  private onPointerLeave = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.pointer.down = this.pointers.size > 0;
    // A mouse that left the canvas has no meaningful position; a ghost frozen
    // at the last known cell would sit there implying a placement that isn't
    // going to happen.
    this.pointer.inside = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.anyPressThisTick = true;
    const action = keyToAction(e.code);
    if (!action || e.repeat) return;
    e.preventDefault();
    if (this.keyCount < KEY_QUEUE) {
      this.keys[this.keyCount] = action;
      this.keyCount += 1;
    }
  };

  private releaseAll = (): void => {
    this.pointers.clear();
    this.pointer.down = false;
    this.pointer.inside = false;
  };

  private pushTap(x: number, y: number): void {
    // A full queue drops the newest rather than the oldest. Eight taps between
    // two 120Hz frames is already a pathological case, and the first of them is
    // the one the player meant.
    if (this.tapCount >= TAP_QUEUE) return;
    const tap = this.taps[this.tapCount]!;
    tap.x = x;
    tap.y = y;
    this.tapCount += 1;
  }

  /** Hand every queued tap to the consumer, oldest first, then clear. */
  drainTaps(consume: (tap: Tap) => void): void {
    for (let i = 0; i < this.tapCount; i++) consume(this.taps[i]!);
    this.tapCount = 0;
  }

  drainKeys(consume: (action: KeyAction) => void): void {
    for (let i = 0; i < this.keyCount; i++) consume(this.keys[i]!);
    this.keyCount = 0;
  }

  /** Take the "something was pressed" flag. Used to unlock audio. */
  consumeAnyPress(): boolean {
    const pressed = this.anyPressThisTick;
    this.anyPressThisTick = false;
    return pressed;
  }

  /**
   * Drop anything queued.
   *
   * Called when a run starts, so the tap that pressed PLAY doesn't also land on
   * the board and place a toy in whatever cell happened to be under it.
   */
  clear(): void {
    this.tapCount = 0;
    this.keyCount = 0;
    this.anyPressThisTick = false;
  }
}

function keyToAction(code: string): KeyAction | null {
  switch (code) {
    case 'Digit1':
      return 'card1';
    case 'Digit2':
      return 'card2';
    case 'Digit3':
      return 'card3';
    case 'Digit4':
      return 'card4';
    case 'Digit5':
      return 'card5';
    case 'Escape':
      return 'cancel';
    case 'Enter':
    case 'Space':
      return 'confirm';
    default:
      return null;
  }
}
