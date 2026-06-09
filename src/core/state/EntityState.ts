// Responsibility: Store serializable entity state for enemies, projectiles, and drops.
// Owner: core/state

import type { Vec2 } from "../math/vector";

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
}

export interface ProjectileState {
  readonly id: string;
  readonly materialEmitterId: string;
  readonly material: import("../../features/combatField/CombatFieldTypes").CombatMaterialName;
  readonly position: Vec2;
  readonly direction: Vec2;
  readonly speedPerSecond: number;
  readonly ageMs: number;
  readonly maxAgeMs: number;
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
