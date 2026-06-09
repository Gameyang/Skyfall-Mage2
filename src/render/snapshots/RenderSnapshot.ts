// Responsibility: Define renderer-facing snapshots derived from serializable state.
// Owner: render/snapshots

import type { Vec2 } from "../../core/math/vector";
import type { EnvironmentKind } from "../../core/state/EnvironmentState";
import type { MaterialEmitter } from "../../features/combatField/CombatFieldTypes";

export type RenderableSpriteKind = "player" | "enemy" | "boss" | "item";
export type RenderableSpriteRarity = "common" | "uncommon" | "rare" | "epic";
export type RenderableSpriteStatusEffect =
  | "hit"
  | "buff"
  | "burning-field"
  | "slowed-field"
  | "magic-field"
  | "poisoned"
  | "frozen";
export type RenderableSpriteMotionPreset = "idle" | "bounce" | "shake" | "pulse" | "sway";

export interface RenderableSprite {
  readonly id: string;
  readonly kind: RenderableSpriteKind;
  readonly position: Vec2;
  readonly size: Vec2;
  readonly textureUrl: string;
  readonly rarity: RenderableSpriteRarity;
  readonly statusEffects: readonly RenderableSpriteStatusEffect[];
  readonly motionPreset: RenderableSpriteMotionPreset;
  readonly facing: -1 | 1;
  readonly hpPercent: number | null;
}

export interface BattleEnvironmentVisuals {
  readonly kind: EnvironmentKind;
  readonly waterStart: number;
  readonly waterCoverage: number;
  readonly waterAlpha: number;
  readonly waveActivity: number;
  readonly rainRate: number;
  readonly windX: number;
  readonly heat: number;
  readonly frostFactor: number;
  readonly lavaFactor: number;
}

export interface RenderSnapshot {
  readonly playerPosition: Vec2;
  readonly aim: Vec2;
  readonly enemyPositions: readonly Vec2[];
  readonly itemDropPositions: readonly Vec2[];
  readonly sprites: readonly RenderableSprite[];
  readonly environment: BattleEnvironmentVisuals;
  readonly materialEmitters: readonly MaterialEmitter[];
  readonly activeEmitterCount: number;
  readonly elapsedMs: number;
}
