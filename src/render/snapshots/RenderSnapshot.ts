// Responsibility: Define renderer-facing snapshots derived from serializable state.
// Owner: render/snapshots

import type { Vec2 } from "../../core/math/vector";
import type { MaterialEmitter } from "../../features/combatField/CombatFieldTypes";

export interface RenderSnapshot {
  readonly playerPosition: Vec2;
  readonly aim: Vec2;
  readonly enemyPositions: readonly Vec2[];
  readonly itemDropPositions: readonly Vec2[];
  readonly materialEmitters: readonly MaterialEmitter[];
  readonly activeEmitterCount: number;
  readonly elapsedMs: number;
}
