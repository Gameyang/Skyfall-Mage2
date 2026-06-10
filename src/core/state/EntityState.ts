// Responsibility: Store serializable entity state for enemies, projectiles, and drops.
// Owner: core/state

import type { Vec2 } from "../math/vector";

export interface EnemyStatusEffectState {
  readonly id: "burning";
  readonly remainingMs: number;
  readonly damagePerSecond: number;
}

export interface EnemyState {
  readonly id: string;
  readonly definitionId: string;
  readonly kind: import("../../content/enemies/EnemyDefinition").EnemyKind;
  readonly patternId: import("../../content/enemies/EnemyDefinition").EnemyPatternId;
  readonly position: Vec2;
  readonly velocity?: Vec2;
  readonly despawnWhenOffscreen?: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly statusEffects?: readonly EnemyStatusEffectState[];
}

export interface FireballImpactState {
  readonly explosionRadius: number;
  readonly fireAreaDurationMs: number;
  readonly fireAreaDamagePerSecond: number;
  readonly burnDurationMs: number;
  readonly burnDamagePerSecond: number;
}

export interface ProjectileState {
  readonly id: string;
  readonly kind: "fireball" | "legacy";
  readonly ownerId: string;
  readonly materialEmitterId: string;
  readonly material: import("../../features/combatField/CombatFieldTypes").CombatMaterialName;
  readonly position: Vec2;
  readonly direction: Vec2;
  readonly speedPerSecond: number;
  readonly collisionRadius: number;
  readonly ageMs: number;
  readonly maxAgeMs: number;
  readonly impact?: FireballImpactState;
}

export interface FireDamageAreaState {
  readonly id: string;
  readonly ownerId: string;
  readonly materialEmitterId: string;
  readonly position: Vec2;
  readonly radius: number;
  readonly remainingMs: number;
  readonly damagePerSecond: number;
  readonly burnDurationMs: number;
  readonly burnDamagePerSecond: number;
}

export interface ItemDropState {
  readonly id: string;
  readonly itemId: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly ageMs: number;
  readonly collected: boolean;
}

export interface EntityState {
  readonly enemies: readonly EnemyState[];
  readonly projectiles: readonly ProjectileState[];
  readonly fireDamageAreas: readonly FireDamageAreaState[];
  readonly itemDrops: readonly ItemDropState[];
}

export function createInitialEntityState(): EntityState {
  return {
    enemies: [
      {
        id: "enemy-1",
        definitionId: "bat",
        kind: "normal",
        patternId: "none",
        position: { x: -0.08, y: 0.52 },
        velocity: { x: 0.14, y: 0 },
        despawnWhenOffscreen: true,
        hp: 36,
        maxHp: 36,
      },
    ],
    projectiles: [],
    fireDamageAreas: [],
    itemDrops: [
      {
        id: "drop-coin",
        itemId: "coin",
        position: { x: 0.38, y: 0.66 },
        velocity: { x: 0.018, y: -0.05 },
        ageMs: 0,
        collected: false,
      },
    ],
  };
}
