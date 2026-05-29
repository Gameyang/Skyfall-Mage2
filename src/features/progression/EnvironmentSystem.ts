// Responsibility: Convert environment changes into serializable combat field conditions.
// Owner: features/progression

import type { EnvironmentState } from "../../core/state/EnvironmentState";
import type { GameState } from "../../core/state/GameState";
import type { WavePlan } from "./WaveDirector";

export function applyEnvironmentFieldTransition(state: GameState, plan: WavePlan): GameState {
  const environment = plan.environment;

  return {
    ...state,
    environment,
    battleField: {
      ...state.battleField,
      seed: deriveFieldSeed(state.battleField.seed, environment, plan.wave.index),
      terrainProfile: environment.kind,
      emitterRateScale: plan.wave.fieldCondition.emitterRateScale ?? state.battleField.emitterRateScale,
      fluidLevel: environment.rainRate,
      gasLevel: Math.max(0, environment.heat + Math.abs(environment.windX) * 0.12),
      activeEmitters:
        environment.rainRate > state.environment.rainRate
          ? [
              ...state.battleField.activeEmitters,
              {
                id: `wave-${plan.wave.index}-rain`,
                material: "water",
                x: 0.5,
                y: 0.1,
                radius: 0.22,
                strength: environment.rainRate,
                ttlMs: 1_200,
              },
            ]
          : state.battleField.activeEmitters,
    },
  };
}

function deriveFieldSeed(seed: number, environment: EnvironmentState, waveIndex: number): number {
  const environmentSalt = environment.kind.length * 131 + Math.round(environment.heat * 1000);

  return seed + waveIndex * 997 + environmentSalt;
}
