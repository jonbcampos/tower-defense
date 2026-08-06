/**
 * Live tuning from the console.
 *
 *   __game.tune({ 'wand.damage': 10, 'crawler.crossSeconds': 30 })
 *   __game.showTuning()
 *
 * Both tiers of checking re-run after every change, because the feel knobs and
 * the fairness constraints are the SAME NUMBERS. Nudging a kid's walking speed
 * to make a wave feel better is also nudging whether the cheapest toy in the
 * loadout can still see one off, and finding that out an hour later while
 * play-testing a different level is the expensive way.
 *
 * This is the one module allowed to write to the `as const` registries.
 */

import { validateDesignContracts } from '../game/state';
import { ENEMIES, type EnemyKind } from '../game/enemies';
import { TOYS, type ToyId } from '../game/toys';
import { validateTrayContracts } from '../ui/tray';
import { verify } from './verify';

type Numeric = Record<string, number>;

/**
 * Apply `{ 'toy.field': value }` or `{ 'kid.field': value }` and re-check.
 *
 * Dotted keys rather than nested objects so a change is one short line in a
 * console you are already typing in with one hand.
 */
export function tune(changes: Record<string, number>, runTrials = true): void {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const [owner, ...rest] = key.split('.');
    const field = rest.join('.');
    if (!owner || !field) {
      console.warn(`[tune] "${key}" is not owner.field`);
      continue;
    }
    if (owner in TOYS) {
      if (writeInto(TOYS[owner as ToyId] as unknown as Numeric, field, value)) {
        applied.push(`${key} = ${value}`);
      } else {
        console.warn(`[tune] ${owner} has no numeric field "${field}"`);
      }
      continue;
    }
    if (owner in ENEMIES) {
      if (writeInto(ENEMIES[owner as EnemyKind] as unknown as Numeric, field, value)) {
        applied.push(`${key} = ${value}`);
      } else {
        console.warn(`[tune] ${owner} has no numeric field "${field}"`);
      }
      continue;
    }
    console.warn(`[tune] no toy or kid called "${owner}"`);
  }

  if (applied.length === 0) return;
  console.log(`[tune] ${applied.join(', ')}`);

  const problems = [...validateDesignContracts(), ...validateTrayContracts()];
  if (problems.length === 0) console.log('%c[tune] contracts still hold', 'color:#2a2');
  else for (const problem of problems) console.error(`[design] ${problem}`);

  if (runTrials) verify();
}

/** Walk one level of nesting, so `wand.shoot.damage` works as `shoot.damage`. */
function writeInto(target: Numeric, field: string, value: number): boolean {
  const parts = field.split('.');
  let node: Numeric = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = (node as unknown as Record<string, unknown>)[parts[i]!];
    if (typeof next !== 'object' || next === null) return false;
    node = next as Numeric;
  }
  const last = parts[parts.length - 1]!;
  if (typeof node[last] !== 'number') return false;
  node[last] = value;
  return true;
}

/** Print the whole roster as two tables, for finding the name of a knob. */
export function showTuning(): void {
  console.table(
    Object.values(TOYS).map((toy) => ({
      id: toy.id,
      role: toy.role,
      cost: toy.cost,
      recharge: toy.recharge,
      hp: toy.hp,
      dps: toy.shoot ? +(toy.shoot.damage / toy.shoot.interval).toFixed(2) : 0,
      lanes: toy.shoot?.lanes ?? toy.instant?.lanes ?? 0,
      income: toy.produce ? +(toy.produce.value / toy.produce.interval).toFixed(2) : 0,
    })),
  );
  console.table(
    Object.values(ENEMIES).map((kid) => ({
      kind: kid.kind,
      hp: kid.hp,
      shield: kid.shield ?? 0,
      crossSeconds: kid.crossSeconds,
      grabDps: kid.grabDps,
      immune: kid.immuneTo ?? '-',
      twist: [
        kid.aerial ? 'aerial' : '',
        kid.hidden ? 'hidden' : '',
        kid.ignoresSlow ? 'ignores-slow' : '',
        kid.behaviour ?? '',
      ]
        .filter(Boolean)
        .join(' ') || '-',
    })),
  );
}
