/**
 * Persistent progress.
 *
 * The two sibling games store four scalar strings each and read them back with
 * an unchecked cast — `localStorage.getItem(KEY) as DifficultyId`. That is fine
 * when the worst a bad value can do is start you on the wrong difficulty. This
 * game stores which levels are beaten and which toys exist, and a corrupt read
 * there is a child losing a week of progress or a crash on the title screen.
 *
 * So: a versioned envelope, every field range-checked on the way in, and a
 * `loadSave` that is not allowed to throw for any input at all. `dev/verify.ts`
 * fires a pile of hostile fixtures at it — empty strings, arrays, a megabyte of
 * junk, negative level counts — and asserts it always hands back something the
 * game can start with.
 */

import { DIFFICULTY_ORDER, type DifficultyId } from '../game/config';
import { LEVEL_COUNT } from '../game/levels';

const SAVE_KEY = 'tower-defense.save';
/**
 * Where a save from a NEWER build gets parked.
 *
 * If a phone has cached an older bundle and loads it against a v2 save, the
 * honest options are "refuse to start" and "throw the save away". Neither is
 * acceptable. Instead the newer blob is copied here untouched and the game
 * starts fresh, so when the newer build loads again the progress is still there
 * to be recovered. A downgrade must never eat a save.
 */
const FUTURE_KEY = 'tower-defense.save.future';

export const SAVE_VERSION = 1;

export interface Save {
  v: number;
  /** Highest level the player may start. Always at least 1. */
  unlocked: number;
  /**
   * Level id (as a string key) to star count, 0-3.
   *
   * A sparse map rather than a fixed-length array specifically so that growing
   * LEVEL_COUNT from ten to fifty needs no migration — an older save simply has
   * fewer keys in it.
   */
  stars: Record<string, number>;
  difficulty: DifficultyId;
  muted: boolean;
  /** Best endless-mode score, once endless mode exists. */
  endlessBest: number;
}

export type LoadOutcome = 'fresh' | 'loaded' | 'corrupt' | 'future';

export interface LoadResult {
  save: Save;
  outcome: LoadOutcome;
}

export function freshSave(): Save {
  return { v: SAVE_VERSION, unlocked: 1, stars: {}, difficulty: 'kid', muted: false, endlessBest: 0 };
}

/**
 * Read the save. Never throws, for any input, ever.
 *
 * Storage itself can throw before parsing even starts — Safari's private mode
 * raises on `getItem` — so the whole thing is wrapped, not just the JSON.
 */
export function loadSave(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { save: freshSave(), outcome: 'fresh' };
  }
  if (raw === null || raw === '') return { save: freshSave(), outcome: 'fresh' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { save: freshSave(), outcome: 'corrupt' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { save: freshSave(), outcome: 'corrupt' };
  }

  const record = parsed as Record<string, unknown>;
  const version = typeof record['v'] === 'number' ? record['v'] : 0;

  if (version > SAVE_VERSION) {
    try {
      localStorage.setItem(FUTURE_KEY, raw);
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Nothing useful to do; the fresh save below still lets the game start.
    }
    return { save: freshSave(), outcome: 'future' };
  }

  return { save: sanitise(record), outcome: version === SAVE_VERSION ? 'loaded' : 'corrupt' };
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private-mode storage failures must not stop the game rendering. The run
    // in progress is unaffected; only the record of it is lost.
  }
}

/**
 * Coerce an arbitrary object into a valid `Save`.
 *
 * Every field is clamped rather than rejected. A save with `unlocked: 1e9` is
 * far more likely to be a bug of ours than a tampering attempt, and clamping it
 * to LEVEL_COUNT keeps a child's progress instead of resetting it to punish her
 * for our arithmetic.
 */
function sanitise(record: Record<string, unknown>): Save {
  const save = freshSave();

  const unlocked = record['unlocked'];
  if (typeof unlocked === 'number' && Number.isFinite(unlocked)) {
    save.unlocked = clampInt(unlocked, 1, LEVEL_COUNT);
  }

  const stars = record['stars'];
  if (typeof stars === 'object' && stars !== null && !Array.isArray(stars)) {
    for (const [key, value] of Object.entries(stars as Record<string, unknown>)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1 || id > LEVEL_COUNT) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      save.stars[String(id)] = clampInt(value, 0, 3);
    }
  }

  const difficulty = record['difficulty'];
  if (typeof difficulty === 'string' && (DIFFICULTY_ORDER as readonly string[]).includes(difficulty)) {
    save.difficulty = difficulty as DifficultyId;
  }

  if (typeof record['muted'] === 'boolean') save.muted = record['muted'];

  const endless = record['endlessBest'];
  if (typeof endless === 'number' && Number.isFinite(endless)) {
    save.endlessBest = Math.max(0, Math.floor(endless));
  }

  return save;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** Stars for a level, 0 if never played. */
export function starsFor(save: Save, levelId: number): number {
  return save.stars[String(levelId)] ?? 0;
}

/**
 * Record a result. Stars only ever go up — a replay that goes badly must not
 * take away a rating the player already earned, or replaying a beaten level
 * becomes a risk instead of a treat.
 */
export function recordResult(save: Save, levelId: number, stars: number): boolean {
  let changed = false;
  const key = String(levelId);
  const clamped = clampInt(stars, 0, 3);
  if (clamped > (save.stars[key] ?? 0)) {
    save.stars[key] = clamped;
    changed = true;
  }
  if (stars > 0 && levelId + 1 > save.unlocked && levelId < LEVEL_COUNT) {
    save.unlocked = levelId + 1;
    changed = true;
  }
  return changed;
}

export function totalStars(save: Save): number {
  let total = 0;
  for (const value of Object.values(save.stars)) total += value;
  return total;
}
