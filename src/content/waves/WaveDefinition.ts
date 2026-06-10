// Responsibility: Define wave timeline data without runtime side effects.
// Owner: content/waves

import type { EnvironmentKind } from "../../core/state/EnvironmentState";

export interface WaveSpawnDefinition {
  readonly atMs: number;
  readonly enemyId: string;
  readonly count: number;
  readonly source?: "scripted" | "random-test";
}

export interface WaveFieldCondition {
  readonly environmentKind?: EnvironmentKind;
  readonly heatDelta?: number;
  readonly windX?: number;
  readonly rainRate?: number;
  readonly emitterRateScale?: number;
}

export interface WaveDefinition {
  readonly id: string;
  readonly index: number;
  readonly durationMs: number;
  readonly spawns: readonly WaveSpawnDefinition[];
  readonly fieldCondition: WaveFieldCondition;
  readonly maxActiveEnemies?: number;
}
