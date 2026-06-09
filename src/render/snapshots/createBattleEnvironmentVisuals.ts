// Responsibility: Derive render-only environment surface values from serializable game state.
// Owner: render/snapshots

import type { GameState } from "../../core/state/GameState";
import type { BattleEnvironmentVisuals } from "./RenderSnapshot";

const baseWaterCoverage = 0.2;
const maxWaterCoverage = 0.55;

export function createBattleEnvironmentVisuals(state: GameState): BattleEnvironmentVisuals {
  const rainInfluence = clamp(state.environment.rainRate / 0.4, 0, 1);
  const windInfluence = clamp(Math.abs(state.environment.windX) / 0.5, 0, 1);
  const waterCoverage = clamp(
    Math.max(baseWaterCoverage, state.battleField.fluidLevel, state.environment.rainRate),
    0.05,
    maxWaterCoverage,
  );

  return {
    kind: state.environment.kind,
    waterStart: 1 - waterCoverage,
    waterCoverage,
    waterAlpha: clamp(0.56 + waterCoverage * 0.32 + rainInfluence * 0.08, 0.5, 0.78),
    waveActivity: clamp(0.36 + rainInfluence * 0.34 + windInfluence * 0.2, 0.25, 1),
    rainRate: clamp(state.environment.rainRate, 0, 1),
    windX: clamp(state.environment.windX, -1, 1),
    heat: clamp(state.environment.heat, 0, 1.5),
    frostFactor: 0,
    lavaFactor: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
