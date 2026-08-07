/**
 * Projectiles and damage resolution.
 *
 * Everything that takes health off a kid goes through `applyDamage`. Immunity,
 * resistance, shields and EASY's immunity leak are resolved in exactly one
 * place, so a new toy or a new kid can't accidentally route around a rule that
 * every other toy respects.
 */

import { POOL, laneCentreY } from './config';
import type { Difficulty } from './config';
import { ENEMIES, type Enemy } from './enemies';
import type { DamageKind } from './toys';

export interface Shot {
  x: number;
  prevX: number;
  y: number;
  lane: number;
  damage: number;
  kind: DamageKind;
  speed: number;
  /** Can reach a floating kid. */
  hitsAir: boolean;
  /** Can find a kid under a blanket. True for anything that sprays. */
  seesHidden: boolean;
  /** Seconds of lingering slow this hit inflicts. 0 for everything but the Slushie. */
  slowFor: number;
  /**
   * How many more kids this shot can pass through before it stops.
   *
   * 0 is the normal case: hit one and vanish. The Beach Ball sets it, and the
   * difference matters most against a queue stacked on one wall — a shot that
   * stops on the first body is the reason a pile-up is dangerous.
   */
  pierce: number;
  /**
   * Travels left and damages TOYS instead of kids. Only the Big Kid's thrown
   * stuffie uses this.
   *
   * It reuses this pool rather than getting its own because it is a thing that
   * flies across the board and hits the first thing in its way, which is what
   * this pool is for — and because a telegraphed object you can watch coming is
   * far fairer than a toy that silently evaporates on a timer.
   */
  hostile: boolean;
  active: boolean;
}

export interface ShotExtras {
  slowFor?: number;
  pierce?: number;
}

export class ShotPool {
  readonly items: Shot[] = [];

  constructor() {
    for (let i = 0; i < POOL.projectiles; i++) {
      this.items.push({
        x: 0,
        prevX: 0,
        y: 0,
        lane: 0,
        damage: 0,
        kind: 'none',
        speed: 0,
        hitsAir: false,
        seesHidden: false,
        slowFor: 0,
        pierce: 0,
        hostile: false,
        active: false,
      });
    }
  }

  fire(
    x: number,
    lane: number,
    damage: number,
    kind: DamageKind,
    speed: number,
    hitsAir: boolean,
    seesHidden: boolean,
    hostile = false,
    // An options bag rather than two more positionals. Eight was already the
    // limit of what a call site can be read at a glance, and `fire(x, lane, 20,
    // 'water', 150, false, false, false, 2, 0)` is not a thing anyone can check.
    extras: ShotExtras = {},
  ): Shot | null {
    const item = this.items.find((s) => !s.active);
    if (!item) return null;
    item.x = x;
    item.prevX = x;
    item.y = laneCentreY(lane);
    item.lane = lane;
    item.damage = damage;
    item.kind = kind;
    item.speed = speed;
    item.hitsAir = hitsAir;
    item.seesHidden = seesHidden;
    item.hostile = hostile;
    item.slowFor = extras.slowFor ?? 0;
    item.pierce = extras.pierce ?? 0;
    item.active = true;
    return item;
  }

  reset(): void {
    for (const item of this.items) item.active = false;
  }
}

export interface DamageResult {
  /** Health actually removed, after every modifier. Zero means fully immune. */
  dealt: number;
  /** True when the shield took the hit and broke on this one. */
  brokeShield: boolean;
  /** True when the kid ran out of health and is wandering off. */
  downed: boolean;
  /** True when the kind was one this kid shrugs off, for the bounce effect. */
  shrugged: boolean;
}

const RESULT: DamageResult = { dealt: 0, brokeShield: false, downed: false, shrugged: false };

/**
 * Apply damage to a kid and report what happened.
 *
 * Returns a shared object rather than a fresh one. This is called several times
 * per frame per lane and nothing holds onto the result past the call site; a
 * new object each time would be a steady drip of garbage-collector work, and on
 * a mid-range Android phone that drip surfaces as a hitch in the middle of the
 * exact wave the player is struggling with.
 */
export function applyDamage(
  enemy: Enemy,
  amount: number,
  kind: DamageKind,
  difficulty: Difficulty,
): DamageResult {
  const def = ENEMIES[enemy.kind];
  RESULT.dealt = 0;
  RESULT.brokeShield = false;
  RESULT.downed = false;
  RESULT.shrugged = false;

  let scaled = amount;
  if (kind !== 'none') {
    if (def.immuneTo === kind) {
      // Not zero on EASY. A child who hasn't worked out why her water gun does
      // nothing to the raincoat still gets somewhere, and the bounce is drawn
      // either way so the rule is still visible.
      scaled *= difficulty.immunityLeak;
      RESULT.shrugged = true;
    } else if (def.resist && def.resist.kind === kind) {
      scaled *= def.resist.share;
      RESULT.shrugged = true;
    }
  }
  if (scaled <= 0) return RESULT;

  // The shield eats damage first and does not spill over. A shield that leaked
  // its excess into the health bar would make the Wagon Kid's 150 points of
  // armour meaningless against a Powder Puff, which is the one hit it exists to
  // survive.
  if (enemy.shield > 0) {
    enemy.shield -= scaled;
    RESULT.dealt = scaled;
    if (enemy.shield <= 0) {
      enemy.shield = 0;
      RESULT.brokeShield = true;
    }
    enemy.hurt = 0.14;
    enemy.lastHit = kind;
    return RESULT;
  }

  enemy.hp -= scaled;
  RESULT.dealt = scaled;
  enemy.hurt = 0.14;
  enemy.lastHit = kind;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    RESULT.downed = true;
  }
  return RESULT;
}

/** True when a shot in this lane is allowed to pick this kid as its target. */
export function isTargetable(enemy: Enemy, shot: Shot): boolean {
  if (!enemy.active || enemy.lane !== shot.lane) return false;
  if (ENEMIES[enemy.kind].aerial && !shot.hitsAir) return false;
  if (enemy.concealed && !shot.seesHidden) return false;
  return true;
}

/** Half-width of a kid's hitbox. Kids are drawn on their centre. */
export function enemyHalfWidth(enemy: Enemy): number {
  return ENEMIES[enemy.kind].width / 2;
}
