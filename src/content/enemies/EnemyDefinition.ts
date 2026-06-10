// Responsibility: Define static enemy metadata for early combat slices.
// Owner: content/enemies

import type { SheetRect } from "../sheets/sheetTypes";

export type EnemyKind = "normal" | "miniboss" | "boss";
export type EnemyPatternId = "none" | "ember-ring" | "rain-pressure";

export interface EnemySpriteAnimationDefinition {
  readonly textureUrl: string;
  readonly sheetId?: string | null;
  readonly sheetRect?: SheetRect;
  readonly sheetColumns?: number;
  readonly sheetRows?: number;
  readonly frameCount: number;
  readonly movementFrameCount: number;
  readonly hitFrameCount: number;
  readonly movementFrameMs: number;
  readonly hitFrameMs: number;
}

export interface EnemyDefinition {
  readonly id: string;
  readonly nameKey: string;
  readonly iconUrl: string;
  readonly spriteAnimation?: EnemySpriteAnimationDefinition;
  readonly maxHp: number;
  readonly kind: EnemyKind;
  readonly patternId: EnemyPatternId;
}
