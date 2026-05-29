// Responsibility: Provide starter wave data for the first progression slice.
// Owner: content/waves

import type { WaveDefinition } from "./WaveDefinition";

export const starterWaves: readonly WaveDefinition[] = [
  {
    id: "wave-1",
    index: 1,
    durationMs: 45_000,
    spawns: [{ atMs: 0, enemyId: "bat", count: 1 }],
    fieldCondition: { environmentKind: "ember-cavern", heatDelta: 0.02, windX: 0.18, emitterRateScale: 1 },
  },
  {
    id: "wave-2",
    index: 2,
    durationMs: 55_000,
    spawns: [
      { atMs: 0, enemyId: "bat", count: 2 },
      { atMs: 18_000, enemyId: "bat", count: 2 },
    ],
    fieldCondition: { environmentKind: "rain-shelf", heatDelta: -0.04, rainRate: 0.26, emitterRateScale: 1.1 },
  },
  {
    id: "wave-3",
    index: 3,
    durationMs: 70_000,
    spawns: [
      { atMs: 0, enemyId: "ember-miniboss", count: 1 },
      { atMs: 28_000, enemyId: "rain-boss", count: 1 },
    ],
    fieldCondition: { environmentKind: "ash-field", heatDelta: 0.08, windX: -0.12, rainRate: 0.12, emitterRateScale: 1.25 },
  },
];

export const starterWaveByIndex = new Map(starterWaves.map((wave) => [wave.index, wave]));
