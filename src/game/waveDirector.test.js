import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from './content/enemies.js';
import { createDifficultyContext } from './enemyDifficulty.js';
import { createEnemyFromSpawnContext } from './enemyPaths.js';
import { createSpawnContexts } from './enemySpawns.js';
import { runHeadlessCombatSimulation } from './headlessCombat.js';
import { createGameState } from './GameState.js';
import { updateGame } from './systems.js';
import { createSeededWaveSequence } from './waveRandomizer.js';
import { WAVE_DEFINITIONS } from './content/waves.js';

function createTestContent(overrides = {}) {
  return {
    enemies: overrides.enemies ?? ENEMY_DEFINITIONS,
    skills: overrides.skills ?? {},
    waves: overrides.waves ?? [],
    items: overrides.items ?? {},
    loot: overrides.loot ?? { enemyDrops: [] },
    enemyDifficulty: overrides.enemyDifficulty,
  };
}

describe('enemy spawn patterns', () => {
  it('creates opposite pincer spawn contexts from both sides', () => {
    const state = createGameState({ width: 800, height: 600, content: createTestContent() });
    const contexts = createSpawnContexts({
      state,
      waveGroup: {
        spawnPatternId: 'oppositePincer',
        spawnParams: {
          sides: ['left', 'right'],
          countPerSide: 2,
        },
      },
      difficulty: createDifficultyContext({ waveIndex: 1 }),
      repeatIndex: 0,
    });

    expect(contexts).toHaveLength(4);
    expect(contexts.filter((context) => context.side === 'left')).toHaveLength(2);
    expect(contexts.filter((context) => context.side === 'right')).toHaveLength(2);
  });
});

describe('enemy path patterns', () => {
  it('start outside mobile and desktop viewports for supported edge paths', () => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 1280, height: 720 },
    ];
    const pathPatternIds = ['straight', 'sCurve', 'zigzag', 'homingSoft', 'dashPause', 'spiralIn'];

    for (const viewport of viewports) {
      for (const pathPatternId of pathPatternIds) {
        const content = createTestContent();
        const state = createGameState({ ...viewport, content });
        const enemy = createEnemyFromSpawnContext({
          state,
          waveGroup: {
            id: `path-${pathPatternId}`,
            enemyType: 'normalBat',
            pathPatternId,
            pathParams: {
              amplitude: 36,
              frequency: 2,
              turns: 1.2,
            },
          },
          definition: ENEMY_DEFINITIONS.normalBat,
          spawnContext: {
            side: 'left',
            laneT: 0.5,
            index: 0,
            count: 1,
          },
        });

        expect(enemy.x).toBeLessThan(0);
        expect(Number.isFinite(enemy.y)).toBe(true);
      }
    }
  });
});

describe('enemy difficulty scaling', () => {
  it('scales stats by wave while keeping configured caps', () => {
    const difficulty = createDifficultyContext({ waveIndex: 100 });

    expect(difficulty.hpMultiplier).toBe(8);
    expect(difficulty.speedMultiplier).toBeLessThanOrEqual(2);
    expect(difficulty.contactDamageMultiplier).toBeLessThanOrEqual(4);
    expect(difficulty.countMultiplier).toBeGreaterThan(1);
  });
});

describe('sequential wave director', () => {
  it('starts the next wave after the current duration', () => {
    const content = createTestContent({
      enemyDifficulty: {
        maxActiveEnemies: 20,
        fieldPressureEnemyLimit: 999,
        maxWaveDelayMs: 0,
      },
      waves: [
        {
          id: 'wave-one',
          waveIndex: 1,
          durationMs: 100,
          groups: [
            {
              id: 'first-group',
              startMs: 0,
              repeat: 1,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'left', count: 1 },
              pathPatternId: 'straight',
            },
          ],
        },
        {
          id: 'wave-two',
          waveIndex: 2,
          durationMs: 100,
          groups: [
            {
              id: 'second-group',
              startMs: 0,
              repeat: 1,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'right', count: 1 },
              pathPatternId: 'straight',
            },
          ],
        },
      ],
    });
    const state = createGameState({ width: 800, height: 600, content });

    updateGame(state, 1, content);
    expect(state.frameEvents.some((event) => event.type === 'WaveStarted' && event.waveId === 'wave-one')).toBe(true);
    expect(state.entities.enemies.some((enemy) => enemy.spawnSide === 'left')).toBe(true);

    updateGame(state, 120, content);
    updateGame(state, 1, content);
    expect(state.frameEvents.some((event) => event.type === 'WaveStarted' && event.waveId === 'wave-two')).toBe(true);
    expect(state.entities.enemies.some((enemy) => enemy.spawnSide === 'right')).toBe(true);
  });

  it('can complete an event wave when all spawned enemies are cleared', () => {
    const content = createTestContent({
      enemyDifficulty: {
        maxActiveEnemies: 20,
        fieldPressureEnemyLimit: 999,
        maxWaveDelayMs: 0,
      },
      waves: [
        {
          id: 'event-wave',
          waveIndex: 1,
          durationMs: 10000,
          endCondition: { type: 'allSpawnedCleared' },
          groups: [
            {
              id: 'event-group',
              startMs: 0,
              repeat: 1,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'left', count: 1 },
              pathPatternId: 'straight',
            },
          ],
        },
        {
          id: 'after-event',
          waveIndex: 2,
          durationMs: 10000,
          groups: [
            {
              id: 'after-group',
              startMs: 0,
              repeat: 1,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'right', count: 1 },
              pathPatternId: 'straight',
            },
          ],
        },
      ],
    });
    const state = createGameState({ width: 800, height: 600, content });

    updateGame(state, 1, content);
    expect(state.entities.enemies).toHaveLength(1);

    state.entities.enemies = [];
    updateGame(state, 1, content);
    updateGame(state, 1, content);

    expect(state.frameEvents.some((event) => event.type === 'WaveStarted' && event.waveId === 'after-event')).toBe(true);
  });

  it('backlogs spawns over the active enemy cap and drains them later', () => {
    const content = createTestContent({
      enemyDifficulty: {
        maxActiveEnemies: 1,
        fieldPressureEnemyLimit: 999,
        maxWaveDelayMs: 0,
      },
      waves: [
        {
          id: 'cap-wave',
          waveIndex: 1,
          durationMs: 10000,
          groups: [
            {
              id: 'cap-group',
              startMs: 0,
              repeat: 1,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'left', count: 3 },
              pathPatternId: 'straight',
            },
          ],
        },
      ],
    });
    const state = createGameState({ width: 800, height: 600, content });

    updateGame(state, 1, content);

    expect(state.entities.enemies).toHaveLength(1);
    expect(state.waves.spawnBacklog).toHaveLength(2);
    expect(state.frameEvents.filter((event) => event.type === 'EnemySpawnBacklogged')).toHaveLength(2);

    state.entities.enemies = [];
    updateGame(state, 100, content);

    expect(state.entities.enemies).toHaveLength(1);
    expect(state.waves.spawnBacklog).toHaveLength(1);
    expect(state.frameEvents.some((event) => event.type === 'EnemySpawned')).toBe(true);
  });
});

describe('headless combat simulation', () => {
  it('runs the real combat loop and reports balance metrics', () => {
    const content = createTestContent({
      enemyDifficulty: {
        maxActiveEnemies: 30,
        fieldPressureEnemyLimit: 999,
        maxWaveDelayMs: 0,
      },
      waves: [
        {
          id: 'headless-wave',
          waveIndex: 1,
          durationMs: 2000,
          groups: [
            {
              id: 'headless-group',
              startMs: 0,
              repeat: 3,
              repeatIntervalMs: 500,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'left', count: 2 },
              pathPatternId: 'straight',
            },
          ],
        },
      ],
    });

    const { metrics } = runHeadlessCombatSimulation({
      content,
      durationMs: 1200,
      tickMs: 100,
      width: 800,
      height: 600,
    });

    expect(metrics.spawnedEnemies).toBe(6);
    expect(metrics.peakActiveEnemies).toBeGreaterThan(0);
    expect(metrics.waveStarts).toContainEqual(expect.objectContaining({ waveId: 'headless-wave' }));
    expect(metrics.snapshots.length).toBeGreaterThan(0);
  });

  it('records wave-level metrics and can disable contact damage for path pressure checks', () => {
    const content = createTestContent({
      enemyDifficulty: {
        maxActiveEnemies: 30,
        fieldPressureEnemyLimit: 999,
        maxWaveDelayMs: 0,
      },
      waves: [
        {
          id: 'metric-wave',
          waveIndex: 1,
          durationMs: 2000,
          groups: [
            {
              id: 'metric-group',
              startMs: 0,
              repeat: 3,
              repeatIntervalMs: 500,
              enemyType: 'normalBat',
              spawnPatternId: 'edgeFlock',
              spawnParams: { side: 'left', count: 2 },
              pathPatternId: 'straight',
            },
          ],
        },
      ],
    });

    const { metrics } = runHeadlessCombatSimulation({
      content,
      durationMs: 1200,
      tickMs: 100,
      width: 800,
      height: 600,
      playerHp: 100,
      playerPolicy: 'human',
      contactDamageMultiplier: 0,
    });

    expect(metrics.waves['1']).toEqual(expect.objectContaining({
      waveId: 'metric-wave',
      spawnedEnemies: 6,
    }));
    expect(metrics.playerDamage).toBe(0);
    expect(metrics.playerDiedAtMs).toBe(null);
  });
});

describe('seeded wave generation', () => {
  it('creates reproducible but seed-dependent wave orders', () => {
    const templates = [
      { id: 'w1', waveIndex: 1, groups: [] },
      { id: 'w2', waveIndex: 2, groups: [] },
      { id: 'w3', waveIndex: 3, groups: [{ id: 'a', spawnParams: { side: 'left' } }] },
      { id: 'w4', waveIndex: 4, groups: [{ id: 'b', spawnParams: { side: 'right' } }] },
      { id: 'w5', waveIndex: 5, groups: [{ id: 'c', spawnParams: { side: 'top' } }] },
    ];

    const first = createSeededWaveSequence({ seed: 'same-seed', waves: templates, waveCount: 5 });
    const second = createSeededWaveSequence({ seed: 'same-seed', waves: templates, waveCount: 5 });
    const different = createSeededWaveSequence({ seed: 'different-seed', waves: templates, waveCount: 5 });

    expect(first.map((wave) => wave.id)).toEqual(second.map((wave) => wave.id));
    expect(first.map((wave) => wave.id)).not.toEqual(different.map((wave) => wave.id));
    expect(first.map((wave) => wave.waveIndex)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not unlock mid-tier templates in the first five generated waves', () => {
    const sequence = createSeededWaveSequence({
      seed: 'tier-check',
      waves: WAVE_DEFINITIONS,
      waveCount: 8,
    });

    expect(sequence.slice(0, 5).every((wave) => wave.difficultyTier !== 'mid')).toBe(true);
    expect(sequence.some((wave) => wave.difficultyTier === 'mid')).toBe(true);
  });
});
