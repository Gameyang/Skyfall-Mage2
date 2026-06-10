// Responsibility: Resolve wave timeline data into spawn and field condition plans.
// Owner: features/progression

import { starterWaveByIndex, starterWaves } from "../../content/waves/starterWaves";
import type { WaveDefinition, WaveSpawnDefinition } from "../../content/waves/WaveDefinition";
import type { EnvironmentKind, EnvironmentState } from "../../core/state/EnvironmentState";

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
  const wave = getWaveDefinition(waveIndex);

  if (!wave) {
    return null;
  }

  const cappedElapsedInWaveMs = Math.min(elapsedInWaveMs, wave.durationMs);
  const cappedPreviousElapsedInWaveMs = Math.min(previousElapsedInWaveMs, wave.durationMs);
  const scriptedSpawns = wave.spawns.filter(
    (spawn) => spawn.atMs > cappedPreviousElapsedInWaveMs && spawn.atMs <= cappedElapsedInWaveMs,
  );
  const randomTestSpawns = createRandomTestSpawns(wave, cappedElapsedInWaveMs, cappedPreviousElapsedInWaveMs);

  return {
    wave,
    dueSpawns: [...scriptedSpawns, ...randomTestSpawns].sort((left, right) => left.atMs - right.atMs),
    environment: applyWaveFieldCondition(environment, wave),
    complete: elapsedInWaveMs >= wave.durationMs,
  };
}

export function getWaveDefinition(waveIndex: number): WaveDefinition | null {
  const starterWave = starterWaveByIndex.get(waveIndex);

  if (starterWave) {
    return starterWave;
  }

  if (waveIndex <= 0) {
    return null;
  }

  return createProceduralTestWave(waveIndex);
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

const proceduralEnvironmentKinds: readonly EnvironmentKind[] = ["ember-cavern", "rain-shelf", "ash-field"];
const authoredWaveCount = starterWaves.length;

function createProceduralTestWave(waveIndex: number): WaveDefinition {
  const environmentKind = proceduralEnvironmentKinds[(waveIndex - 1) % proceduralEnvironmentKinds.length]!;

  return {
    id: `test-wave-${waveIndex}`,
    index: waveIndex,
    durationMs: randomInt(waveIndex * 3_211, 28_000, 42_000),
    spawns: [],
    fieldCondition: {
      environmentKind,
      windX: randomRange(waveIndex * 7_919, -0.28, 0.28),
      rainRate:
        environmentKind === "rain-shelf"
          ? randomRange(waveIndex * 9_173, 0.16, 0.34)
          : randomRange(waveIndex * 9_173, 0.04, 0.18),
      emitterRateScale: randomRange(waveIndex * 4_997, 1.08, 1.35),
    },
    maxActiveEnemies: 24,
  };
}

function createRandomTestSpawns(
  wave: WaveDefinition,
  elapsedInWaveMs: number,
  previousElapsedInWaveMs: number,
): readonly WaveSpawnDefinition[] {
  const dueSpawns: WaveSpawnDefinition[] = [];
  let burstIndex = 0;
  let atMs = randomInt(wave.index * 1_009, 1_200, 3_200);

  while (atMs <= elapsedInWaveMs && burstIndex < 64) {
    if (atMs > previousElapsedInWaveMs) {
      dueSpawns.push(createRandomTestSpawn(wave.index, atMs, burstIndex));

      if (dueSpawns.length >= 8) {
        return dueSpawns;
      }
    }

    burstIndex += 1;
    atMs += randomInt(wave.index * 2_003 + burstIndex * 9_176, 2_400, 6_200);
  }

  return dueSpawns;
}

function createRandomTestSpawn(waveIndex: number, atMs: number, burstIndex: number): WaveSpawnDefinition {
  const enemyRoll = randomUnit(waveIndex * 19_417 + burstIndex * 193 + atMs);
  const enemyId =
    waveIndex > authoredWaveCount + 1 && enemyRoll > 0.93
      ? "rain-boss"
      : waveIndex > 2 && enemyRoll > 0.82
        ? "ember-miniboss"
        : "bat";

  return {
    atMs,
    enemyId,
    count: enemyId === "bat" ? randomInt(waveIndex * 4_397 + burstIndex * 1_337 + atMs, 1, 4) : 1,
    source: "random-test",
  };
}

function randomRange(seed: number, min: number, max: number): number {
  return roundTo(min + randomUnit(seed) * (max - min), 3);
}

function randomInt(seed: number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(randomUnit(seed) * (maxInclusive - minInclusive + 1));
}

function randomUnit(seed: number): number {
  let value = Math.imul(seed ^ 0x45d9f3b, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);

  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function roundTo(value: number, precision: number): number {
  const multiplier = 10 ** precision;

  return Math.round(value * multiplier) / multiplier;
}
