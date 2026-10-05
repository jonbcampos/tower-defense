/**
 * Who says what, and how rarely (DECISIONS 67).
 *
 * The lesson from slingshot (its DECISIONS 18) is that characters who talk on
 * every event are tiring within a level, even when every line is good. So most
 * events get no voice at all, the ones that do are rolled against a chance,
 * and each speaker has a quiet gap after speaking. Lines never overlap:
 * `Audio.say` drops a line while another is playing.
 *
 * - **Ellie** (in the nook beside the unicorn) calls the first wave of a level
 *   and every big one, cheers now and then, protests when a kid squeezes the
 *   unicorn, and always speaks at the end.
 * - **The kids** squeal happily as they wander off (rarely: kids leave
 *   constantly), say what they think of the unicorn when they reach her, and
 *   "Teddy!" when the Guard Bear scoops them up.
 * - **The Big Kid** announces his throw, sometimes.
 *
 * Lives in the presentation layer, beside the particles: it reacts to the
 * simulation's events and the simulation never knows it exists.
 */

import type { Audio } from '../core/audio';
import type { GameEvent } from '../game/state';

const KID_HAPPY = ['k.wheee', 'k.bubbles', 'k.giggle', 'k.bye', 'k.splashy'] as const;
const KID_HUG = ['k.squishy', 'k.unicorn'] as const;

/** Seconds of quiet a speaker keeps after a line. */
const ELLIE_GAP = 7;
const KID_GAP = 5;

export class Voices {
  private clock = 0;
  private ellieQuietUntil = 0;
  private kidQuietUntil = 0;

  constructor(private readonly audio: Audio) {}

  /** A run started. Everyone may speak again. */
  reset(): void {
    this.ellieQuietUntil = 0;
    this.kidQuietUntil = 0;
  }

  tick(dt: number): void {
    this.clock += dt;
  }

  event(event: GameEvent): void {
    switch (event.type) {
      case 'wave':
        // Only the first wave of a level. Every wave would be a chant.
        if (event.value === 1) this.ellie(['e.herethey'], 1, 0.3);
        break;
      case 'big-wave':
        this.ellie(['e.lots', 'e.herethey'], 0.85, 0.5);
        break;
      case 'down':
        // A kid leaves every second or two in a busy wave: mostly the chime alone.
        if (!this.kid(KID_HAPPY, 0.2)) this.ellie(['e.yay', 'e.hooray'], 0.05);
        break;
      case 'squeeze':
        // The kid's hug, then Ellie's protest once the kid has finished.
        this.kid(KID_HUG, 0.75, 0, true);
        this.ellie(['e.gentle', 'e.ohno'], 0.6, 1.6);
        break;
      case 'sweeper':
        this.kid(['k.teddy'], 0.7, 0.15, true);
        break;
      case 'throw':
        this.kid(['b.catch', 'b.mine'], 0.5);
        break;
      case 'nightlight':
        this.ellie(['e.wow'], 0.3, 0.2);
        break;
      case 'win':
        this.audio.say(['e.won'], { delay: 0.6, interrupt: true });
        break;
      case 'lose':
        this.audio.say(['e.again', 'e.ohno'], { delay: 1.4, interrupt: true });
        break;
      default:
        break;
    }
  }

  private ellie(ids: readonly string[], chance: number, delay = 0): boolean {
    if (this.clock < this.ellieQuietUntil || Math.random() >= chance) return false;
    if (!this.audio.say(ids, { delay })) return false;
    this.ellieQuietUntil = this.clock + delay + ELLIE_GAP;
    return true;
  }

  /** `force` ignores the quiet gap (not the one-voice-at-a-time rule): for rare, big moments. */
  private kid(ids: readonly string[], chance: number, delay = 0, force = false): boolean {
    if ((!force && this.clock < this.kidQuietUntil) || Math.random() >= chance) return false;
    if (!this.audio.say(ids, { delay })) return false;
    this.kidQuietUntil = this.clock + delay + KID_GAP;
    return true;
  }
}
