/**
 * Wave sequencing.
 *
 * The one rule worth understanding: a wave begins when the previous one is
 * CLEARED or when its TIMEOUT elapses, whichever comes first. Clear-triggered
 * so a player who is winning is never made to stand and watch an empty board —
 * the most reliable way to lose a five-year-old's attention. Timeout-triggered
 * so a player who is losing is never buried by a queue that kept advancing
 * while she was busy losing.
 *
 * Both halves matter. Only-on-clear turns a stalled lane into an infinite
 * level; only-on-timer turns a bad thirty seconds into an unrecoverable one.
 */

import { WAVE } from './config';
import type { Difficulty } from './config';
import type { EnemyKind } from './enemies';
import type { Level, Wave, WaveBeat } from './levels';
import type { Rng } from '../core/rng';

export type WavePhase = 'rest' | 'warning' | 'running' | 'done';

/** Pre-allocated: one slot per beat in the largest wave any level can hold. */
const MAX_BEATS = 16;

export class WaveRunner {
  phase: WavePhase = 'rest';
  /** Index of the wave being spawned, or about to be. */
  index = 0;
  /** Seconds since the current wave started spawning. */
  elapsed = 0;
  /** Seconds left of the rest or the big-wave warning. */
  countdown = 0;
  /** True for the whole of a big wave, so the HUD can keep shouting. */
  big = false;

  private level: Level | null = null;
  private restSeconds: number = WAVE.baseRest;
  /** Beat schedule for the current wave: absolute seconds from wave start. */
  private readonly times: number[] = new Array<number>(MAX_BEATS).fill(0);
  private readonly kinds: EnemyKind[] = new Array<EnemyKind>(MAX_BEATS).fill('crawler');
  private readonly lanes: number[] = new Array<number>(MAX_BEATS).fill(0);
  private beatCount = 0;
  private beatCursor = 0;

  start(level: Level, difficulty: Difficulty, rng: Rng): void {
    this.level = level;
    // Rest scales with difficulty but never drops below the floor, so HARD is
    // denser rather than frantic. A contract checks both halves of that.
    this.restSeconds = Math.max(WAVE.minRest, WAVE.baseRest * difficulty.waveRestScale);
    this.index = 0;
    this.elapsed = 0;
    this.big = false;
    this.beatCount = 0;
    this.beatCursor = 0;
    this.phase = 'rest';
    // The first rest is short: a level that opens with six seconds of nothing
    // has spent its first impression on an empty room.
    this.countdown = Math.min(this.restSeconds, 3);
    this.buildSchedule(difficulty, rng);
  }

  /** Total waves in the level, for the progress bar. */
  get total(): number {
    return this.level?.waves.length ?? 0;
  }

  /** True once every beat of every wave has been spawned. */
  get spawnedEverything(): boolean {
    return this.phase === 'done';
  }

  /**
   * Advance. `liveEnemies` is how many kids are on the board right now — the
   * runner needs it to know whether a wave is cleared, and asking rather than
   * tracking it means the two can't disagree.
   */
  update(
    dt: number,
    liveEnemies: number,
    difficulty: Difficulty,
    rng: Rng,
    spawn: (kind: EnemyKind, lane: number) => void,
    onWaveStart: (big: boolean) => void,
  ): void {
    const level = this.level;
    if (!level || this.phase === 'done') return;

    if (this.phase === 'rest') {
      this.countdown -= dt;
      if (this.countdown > 0) return;
      const wave = level.waves[this.index]!;
      this.big = wave.big;
      if (wave.big) {
        this.phase = 'warning';
        this.countdown = WAVE.bigWarning;
      } else {
        this.beginRunning(onWaveStart);
      }
      return;
    }

    if (this.phase === 'warning') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.beginRunning(onWaveStart);
      return;
    }

    // phase === 'running'
    const wave = level.waves[this.index]!;
    this.elapsed += dt;

    while (this.beatCursor < this.beatCount && this.elapsed >= this.times[this.beatCursor]!) {
      spawn(this.kinds[this.beatCursor]!, this.lanes[this.beatCursor]!);
      this.beatCursor += 1;
    }

    const allSpawned = this.beatCursor >= this.beatCount;
    const cleared = allSpawned && liveEnemies === 0;
    const timedOut = this.elapsed >= wave.timeout;

    if (!cleared && !timedOut) return;

    this.index += 1;
    if (this.index >= level.waves.length) {
      this.phase = 'done';
      return;
    }
    this.buildSchedule(difficulty, rng);
    this.phase = 'rest';
    // A wave that arrived because the last one TIMED OUT gets no rest — the
    // board is already full and the pressure is the point. A wave that arrived
    // because the last one was cleared gets the full breather.
    this.countdown = cleared ? this.restSeconds : 0;
  }

  private beginRunning(onWaveStart: (big: boolean) => void): void {
    this.phase = 'running';
    this.elapsed = 0;
    this.beatCursor = 0;
    onWaveStart(this.big);
  }

  /**
   * Flatten the current wave's beats into a schedule of absolute times.
   *
   * Done once when the wave is queued rather than walked every frame, and into
   * pre-allocated arrays rather than a fresh list, because this runs on a level
   * transition and there is no reason for a level transition to hand the
   * garbage collector work it will do in the middle of the next wave.
   */
  private buildSchedule(difficulty: Difficulty, rng: Rng): void {
    const wave = this.level?.waves[this.index];
    this.beatCount = 0;
    if (!wave) return;
    let time = 0;
    for (const beat of wave.beats) {
      if (!this.includes(beat, difficulty, rng)) continue;
      if (this.beatCount >= MAX_BEATS) break;
      time += beat.gap;
      this.times[this.beatCount] = time;
      this.kinds[this.beatCount] = beat.kind;
      this.lanes[this.beatCount] = beat.lane;
      this.beatCount += 1;
    }
  }

  /**
   * Optional beats are rolled per beat rather than per wave.
   *
   * Per-wave would mean NORMAL's 0.5 share produces either the EASY wave or the
   * HARD wave with a coin flip, which is two difficulties wearing a trench
   * coat. Per-beat gives NORMAL its own density.
   */
  private includes(beat: WaveBeat, difficulty: Difficulty, rng: Rng): boolean {
    if (!beat.optional) return true;
    if (difficulty.extraBeatsShare >= 1) return true;
    if (difficulty.extraBeatsShare <= 0) return false;
    return rng.next() < difficulty.extraBeatsShare;
  }
}

/** Beats a wave will actually spawn at a given difficulty, for the contracts. */
export function beatsAt(wave: Wave, difficulty: Difficulty): readonly WaveBeat[] {
  if (difficulty.extraBeatsShare >= 1) return wave.beats;
  if (difficulty.extraBeatsShare <= 0) return wave.beats.filter((beat) => !beat.optional);
  return wave.beats;
}
