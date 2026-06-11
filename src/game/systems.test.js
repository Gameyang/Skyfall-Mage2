import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from './content/enemies.js';
import { SKILL_DEFINITIONS } from './content/skills.js';
import { createEnemyFromWave, createSCurvePath, sampleSCurvePath } from './enemyPaths.js';
import { createGameState } from './GameState.js';
import { selectProgressRiskTarget, updateGame } from './systems.js';

function createTestContent(overrides = {}) {
  return {
    enemies: overrides.enemies ?? ENEMY_DEFINITIONS,
    skills: overrides.skills ?? {},
    waves: overrides.waves ?? [],
  };
}

describe('enemy S-curve paths', () => {
  it('start outside the selected edge and end outside the opposite edge', () => {
    const viewport = { width: 800, height: 600 };
    const sides = ['left', 'right', 'top', 'bottom'];

    for (const side of sides) {
      const path = createSCurvePath({
        side,
        viewport,
        radius: 18,
        laneT: 0.5,
        amplitude: 40,
        frequency: 2,
        phase: 0,
        margin: 44,
      });
      const start = sampleSCurvePath(path, 0);
      const end = sampleSCurvePath(path, path.travelDistance);

      if (side === 'left') {
        expect(start.x).toBeLessThan(0);
        expect(end.x).toBeGreaterThan(viewport.width);
      } else if (side === 'right') {
        expect(start.x).toBeGreaterThan(viewport.width);
        expect(end.x).toBeLessThan(0);
      } else if (side === 'top') {
        expect(start.y).toBeLessThan(0);
        expect(end.y).toBeGreaterThan(viewport.height);
      } else {
        expect(start.y).toBeGreaterThan(viewport.height);
        expect(end.y).toBeLessThan(0);
      }
    }
  });
});

describe('wave spawning', () => {
  it('spawns configured enemy batches at the configured time', () => {
    const content = createTestContent({
      waves: [
        {
          id: 'test-wave',
          startMs: 0,
          intervalMs: 1000,
          count: 3,
          side: 'left',
          enemyType: 'normalBat',
          pattern: { amplitude: 32, frequency: 2 },
        },
      ],
    });
    const state = createGameState({ width: 800, height: 600, content });

    updateGame(state, 1, content);

    expect(state.entities.enemies).toHaveLength(3);
    expect(state.entities.enemies.every((enemy) => enemy.spawnSide === 'left')).toBe(true);
  });
});

describe('progress-risk targeting', () => {
  it('prioritizes a high-progress threat over a merely nearby enemy', () => {
    const state = createGameState({ width: 800, height: 600, content: createTestContent() });
    state.player.x = 400;
    state.player.y = 300;
    state.entities.enemies = [
      {
        id: 1,
        hp: 30,
        x: 430,
        y: 300,
        radius: 18,
        progress: 80,
        travelDistance: 1000,
      },
      {
        id: 2,
        hp: 30,
        x: 750,
        y: 120,
        radius: 18,
        progress: 930,
        travelDistance: 1000,
      },
    ];

    expect(selectProgressRiskTarget(state).id).toBe(2);
  });
});

describe('fireball skill', () => {
  it('fires immediately at a target, then respects the one-second cooldown', () => {
    const fireball = {
      ...SKILL_DEFINITIONS.fireball,
      projectile: {
        ...SKILL_DEFINITIONS.fireball.projectile,
        speed: 0,
      },
    };
    const content = createTestContent({
      skills: { fireball },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 400;
    state.player.y = 300;
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      x: 700,
      y: 300,
      radius: 18,
      progress: 400,
      travelDistance: 1000,
      contactDamage: 12,
    });

    updateGame(state, 16, content);
    expect(state.entities.projectiles).toHaveLength(1);

    updateGame(state, 999, content);
    expect(state.entities.projectiles).toHaveLength(1);

    updateGame(state, 1, content);
    expect(state.entities.projectiles).toHaveLength(2);
  });
});

describe('combat resolution', () => {
  it('damages an enemy and removes the projectile on hit', () => {
    const content = createTestContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      maxHp: 30,
      x: 120,
      y: 120,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 12,
    });
    state.entities.projectiles.push({
      id: 1,
      skillId: 'fireball',
      x: 120,
      y: 120,
      vx: 0,
      vy: 0,
      radius: 7,
      damage: 20,
      lifetimeMs: 1000,
      ageMs: 0,
    });

    updateGame(state, 16, content);

    expect(state.entities.projectiles).toHaveLength(0);
    expect(state.entities.enemies[0].hp).toBe(10);
  });

  it('applies contact damage to the player and removes the touching enemy', () => {
    const content = createTestContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      x: state.player.x,
      y: state.player.y,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 12,
    });

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(88);
    expect(state.entities.enemies).toHaveLength(0);
  });

  it('despawns offscreen enemies without damaging the player', () => {
    const content = createTestContent();
    const state = createGameState({ width: 800, height: 600, content });
    const enemy = createEnemyFromWave({
      state,
      wave: {
        id: 'test',
        count: 1,
        side: 'left',
        enemyType: 'normalBat',
        pattern: { amplitude: 32, frequency: 2 },
      },
      definition: ENEMY_DEFINITIONS.normalBat,
      index: 0,
    });
    enemy.progress = enemy.travelDistance;
    state.entities.enemies.push(enemy);

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.entities.enemies).toHaveLength(0);
    expect(state.frameEvents.some((event) => event.type === 'EnemyDespawned')).toBe(true);
  });
});
