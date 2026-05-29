// Responsibility: Resolve wave timeline data into spawn and field condition plans.
// Owner: features/progression

import { starterWaveByIndex } from "../../content/waves/starterWaves";
import type { WaveDefinition, WaveSpawnDefinition } from "../../content/waves/WaveDefinition";
import type { EnvironmentState } from "../../core/state/EnvironmentState";

export interface WavePlan {
  readonly wave: WaveDefinition;
  readonly dueSpawns: readonly WaveSpawnDefinition[];
  readonly environment: EnvironmentState;
  readonly complete: boolean;
}

export function planWaveStep(
  waveIndex: number,
  elapsedInWaveMs: number,
  previousElapsedInWaveMs: number,
  environment: EnvironmentState,
): WavePlan | null {
  const wave = starterWaveByIndex.get(waveIndex);

  if (!wave) {
    return null;
  }

  return {
    wave,
    dueSpawns: wave.spawns.filter((spawn) => spawn.atMs > previousElapsedInWaveMs && spawn.atMs <= elapsedInWaveMs),
    environment: applyWaveFieldCondition(environment, wave),
    complete: elapsedInWaveMs >= wave.durationMs,
  };
}

export function applyWaveFieldCondition(environment: EnvironmentState, wave: WaveDefinition): EnvironmentState {
  return {
    ...environment,
    kind: wave.fieldCondition.environmentKind ?? environment.kind,
    heat: environment.heat + (wave.fieldCondition.heatDelta ?? 0),
    windX: wave.fieldCondition.windX ?? environment.windX,
    rainRate: wave.fieldCondition.rainRate ?? environment.rainRate,
  };
}
