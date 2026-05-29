// Responsibility: Calculate enemy scaling from wave and level progression.
// Owner: features/progression

export interface EnemyScaling {
  readonly hpScale: number;
  readonly speedScale: number;
}

export function calculateEnemyScaling(waveIndex: number, playerLevel: number): EnemyScaling {
  return {
    hpScale: 1 + Math.max(0, waveIndex - 1) * 0.18 + Math.max(0, playerLevel - 1) * 0.08,
    speedScale: 1 + Math.max(0, waveIndex - 1) * 0.05,
  };
}
