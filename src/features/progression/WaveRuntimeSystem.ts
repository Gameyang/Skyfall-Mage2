// Responsibility: Apply wave timeline plans to serializable runtime state.
// Owner: features/progression

import { clamp, type Vec2 } from "../../core/math/vector";
import type { GameEvent } from "../../core/state/Event";
import type { GameState } from "../../core/state/GameState";
import { spawnEnemy } from "../combat/SpawnSystem";
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
  const maxActiveEnemies = plan.wave.maxActiveEnemies ?? Number.POSITIVE_INFINITY;

  for (const spawn of plan.dueSpawns) {
    for (let index = 0; index < spawn.count; index += 1) {
      if (spawn.source === "random-test" && nextState.entities.enemies.length >= maxActiveEnemies) {
        break;
      }

      nextState = spawnEnemy(nextState, spawn.enemyId, createSpawnPosition(plan.wave.index, spawn.atMs, spawnOrdinal, index));
    }

    spawnOrdinal += 1;
  }

  return nextState;
}

function createSpawnPosition(waveIndex: number, spawnAtMs: number, spawnOrdinal: number, index: number): Vec2 {
  const seed = waveIndex * 73_856_093 + spawnAtMs * 19_349 + spawnOrdinal * 83_492 + index * 2_654;

  return {
    x: clamp(0.58 + randomUnit(seed) * 0.32, 0.58, 0.9),
    y: clamp(0.22 + randomUnit(seed + 1_013) * 0.56, 0.22, 0.78),
  };
}

function randomUnit(seed: number): number {
  let value = Math.imul(seed ^ 0x45d9f3b, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);

  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}
