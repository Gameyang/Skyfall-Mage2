// Responsibility: Apply wave timeline plans to serializable runtime state.
// Owner: features/progression

import { clamp, type Vec2 } from "../../core/math/vector";
import type { GameEvent } from "../../core/state/Event";
import type { GameState } from "../../core/state/GameState";
import { spawnEnemy, type EnemySpawnOptions } from "../combat/SpawnSystem";
import { applyEnvironmentFieldTransition } from "./EnvironmentSystem";
import { planWaveStep, type WavePlan } from "./WaveDirector";

export interface WaveRuntimeResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function advanceWaveRuntime(state: GameState, deltaMs: number): WaveRuntimeResult {
  if (deltaMs <= 0) {
    return { state, events: [] };
  }

  const events: GameEvent[] = [];
  const previousWaveElapsedMs = Math.max(0, state.session.waveElapsedMs - deltaMs);
  const plan = planWaveStep(
    state.session.waveIndex,
    state.session.waveElapsedMs,
    previousWaveElapsedMs,
    state.environment,
  );

  if (!plan) {
    return { state, events };
  }

  let nextState = previousWaveElapsedMs === 0 ? applyWaveEnvironment(state, plan, events) : state;
  nextState = spawnDueEnemies(nextState, plan);

  if (!plan.complete) {
    return { state: nextState, events };
  }

  const nextWaveIndex = nextState.session.waveIndex + 1;
  nextState = {
    ...nextState,
    session: {
      ...nextState.session,
      waveIndex: nextWaveIndex,
      waveElapsedMs: 0,
    },
  };
  events.push({ type: "WaveStarted", waveIndex: nextWaveIndex });

  const nextPlan = planWaveStep(nextWaveIndex, 0, -1, nextState.environment);

  if (!nextPlan) {
    return { state: nextState, events };
  }

  nextState = applyWaveEnvironment(nextState, nextPlan, events);
  nextState = spawnDueEnemies(nextState, nextPlan);

  return { state: nextState, events };
}

function applyWaveEnvironment(state: GameState, plan: WavePlan, events: GameEvent[]): GameState {
  const environmentChanged =
    state.environment.kind !== plan.environment.kind ||
    state.environment.heat !== plan.environment.heat ||
    state.environment.windX !== plan.environment.windX ||
    state.environment.rainRate !== plan.environment.rainRate;

  if (!environmentChanged) {
    return state;
  }

  events.push({ type: "EnvironmentChanged", environmentId: plan.environment.kind });

  return applyEnvironmentFieldTransition(state, plan);
}

function spawnDueEnemies(state: GameState, plan: WavePlan): GameState {
  let nextState = state;
  let spawnOrdinal = 0;

  for (const spawn of plan.dueSpawns) {
    for (let index = 0; index < spawn.count; index += 1) {
      const transit = createTransitSpawn(plan.wave.index, spawnOrdinal, index);
      nextState = spawnEnemy(nextState, spawn.enemyId, transit.position, transit.options);
    }

    spawnOrdinal += 1;
  }

  return nextState;
}

function createTransitSpawn(
  waveIndex: number,
  spawnOrdinal: number,
  index: number,
): { readonly position: Vec2; readonly options: EnemySpawnOptions } {
  const direction = (waveIndex + spawnOrdinal + index) % 2 === 0 ? 1 : -1;

  return {
    position: {
      x: direction > 0 ? -0.08 : 1.08,
      y: clamp(0.34 + ((waveIndex + index + spawnOrdinal) % 4) * 0.08, 0.24, 0.76),
    },
    options: {
      velocity: { x: direction * 0.14, y: 0 },
      despawnWhenOffscreen: true,
    },
  };
}
