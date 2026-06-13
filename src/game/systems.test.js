import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFINITIONS } from './content/enemies.js';
import { GAME_CONTENT } from './content/index.js';
import { ITEM_DEFINITIONS } from './content/items.js';
import { SKILL_DEFINITIONS } from './content/skills.js';
import { createEnemyFromWave, createSCurvePath, sampleSCurvePath } from './enemyPaths.js';
import { createGameState } from './GameState.js';
import { SKILL_SEQUENCE_STEP_MS } from './skillSequence.js';
import {
  applyGpuDamageFeedback,
  losePlayerRibbonItems,
  selectProgressRiskTarget,
  updateGame,
  updatePlayer,
  updateViewport,
} from './systems.js';

function createTestContent(overrides = {}) {
  return {
    enemies: overrides.enemies ?? ENEMY_DEFINITIONS,
    skills: overrides.skills ?? {},
    waves: overrides.waves ?? [],
    items: overrides.items ?? {},
    loot: overrides.loot ?? { enemyDrops: [] },
    environment: overrides.environment,
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

describe('viewport sizing', () => {
  it('keeps the combat field size separate from the cropped visible area', () => {
    const state = createGameState({ width: 800, height: 800, content: createTestContent() });

    updateViewport(state, 800, 800, {
      x: 205,
      y: 0,
      width: 390,
      height: 800,
    });

    expect(state.viewport.width).toBe(800);
    expect(state.viewport.height).toBe(800);
    expect(state.viewport.visible).toEqual({
      x: 205,
      y: 0,
      width: 390,
      height: 800,
    });
  });

  it('limits player movement to the visible crop of the square combat field', () => {
    const content = createTestContent();
    const state = createGameState({ width: 844, height: 844, content });
    updateViewport(state, 844, 844, {
      x: 227,
      y: 0,
      width: 390,
      height: 844,
    });
    state.player.recenter = null;
    state.player.x = 422;
    state.player.y = 422;

    state.input.left = true;
    updateGame(state, 2000, content);
    expect(state.player.x).toBe(227);

    state.input.left = false;
    state.input.right = true;
    updateGame(state, 2000, content);
    expect(state.player.x).toBe(617);
  });

  it('moves the player with analog input vectors for free-angle mobile control', () => {
    const content = createTestContent();
    const state = createGameState({ width: 1000, height: 1000, content });
    state.player.recenter = null;
    state.player.x = 500;
    state.player.y = 500;
    state.input.vectorX = 0.6;
    state.input.vectorY = 0.8;

    updatePlayer(state, 1000);

    expect(state.player.x).toBeCloseTo(656);
    expect(state.player.y).toBeCloseTo(708);
  });

  it('recenters the player when the visible layout changes during play', () => {
    const content = createTestContent();
    const state = createGameState({ width: 800, height: 800, content });
    updateViewport(state, 800, 800, {
      x: 0,
      y: 0,
      width: 800,
      height: 800,
    });
    state.player.x = 80;
    state.player.y = 720;

    updateViewport(state, 844, 844, {
      x: 227,
      y: 0,
      width: 390,
      height: 844,
    });
    updateGame(state, 180, content);

    expect(state.player.x).toBeCloseTo(422);
    expect(state.player.y).toBeCloseTo(422);
    expect(state.player.recenter).toBeNull();
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
  it('fires immediately at a target, then respects the configured cooldown', () => {
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

    updateGame(state, 699, content);
    expect(state.entities.projectiles).toHaveLength(1);

    updateGame(state, 1, content);
    expect(state.entities.projectiles).toHaveLength(2);
  });

  it('casts every configured ready skill without relying on a hardcoded skill id', () => {
    const createSkill = (id) => ({
      id,
      cooldownMs: 1000,
      targeting: { type: 'progress-risk' },
      projectile: {
        speed: 0,
        damage: 1,
        radius: 4,
        lifetimeMs: 1000,
      },
    });
    const content = createTestContent({
      skills: {
        firebolt: createSkill('firebolt'),
        sparkbolt: createSkill('sparkbolt'),
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
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

    expect(state.entities.projectiles.map((projectile) => projectile.skillId).sort()).toEqual(['firebolt', 'sparkbolt']);
  });

  it('casts equipped skills one at a time in equipped order', () => {
    const createSkill = (id) => ({
      id,
      cooldownMs: 300,
      targeting: { type: 'progress-risk' },
      projectile: {
        speed: 0,
        damage: 1,
        radius: 4,
        lifetimeMs: 1000,
      },
    });
    const content = createTestContent({
      skills: {
        firebolt: createSkill('firebolt'),
        sparkbolt: createSkill('sparkbolt'),
      },
    });
    content.equippedSkillIds = Object.freeze(['firebolt', 'sparkbolt']);
    const state = createGameState({ width: 800, height: 600, content });
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
    expect(state.entities.projectiles.map((projectile) => projectile.skillId)).toEqual(['firebolt']);

    updateGame(state, SKILL_SEQUENCE_STEP_MS, content);
    expect(state.entities.projectiles.map((projectile) => projectile.skillId)).toEqual(['firebolt', 'sparkbolt']);

    updateGame(state, SKILL_SEQUENCE_STEP_MS, content);
    expect(state.entities.projectiles.map((projectile) => projectile.skillId)).toEqual([
      'firebolt',
      'sparkbolt',
      'firebolt',
    ]);
  });

  it('binds fire energy to the flying fireball entity and emits profiled fire from its moving position', () => {
    const content = createTestContent({
      skills: { fireball: SKILL_DEFINITIONS.fireball },
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
    expect(state.entities.projectiles[0].energy.current).toBe(96);
    expect(state.frameEffects.some((effect) => effect.material === 'smoke')).toBe(false);

    updateGame(state, 48, content);

    const trailEffects = state.frameEffects.filter((effect) => effect.type === 'MaterialEmitter');
    expect(trailEffects).toContainEqual(expect.objectContaining({
      material: 'fire',
      profile: 'projectileFire',
      life: SKILL_DEFINITIONS.fireball.projectile.energy.trailEffects[0].life,
    }));
    expect(trailEffects.some((effect) => effect.material === 'smoke')).toBe(false);
    expect(trailEffects.some((effect) => effect.material === 'spark')).toBe(false);
  });

  it('keeps fireball explosion emitters limited to direct fire input', () => {
    const content = createTestContent({
      skills: { fireball: SKILL_DEFINITIONS.fireball },
    });
    const state = createGameState({ width: 800, height: 600, content });
    const energyDefinition = SKILL_DEFINITIONS.fireball.projectile.energy;
    state.skills.fireball.cooldownRemainingMs = 9999;
    state.entities.enemies.push({
      id: 1,
      hp: 50,
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
      energy: {
        current: energyDefinition.initial,
        max: energyDefinition.max,
        trailAccumulatorMs: 0,
        trailIntervalMs: energyDefinition.trailIntervalMs,
        trailEffects: energyDefinition.trailEffects,
        explosion: energyDefinition.explosion,
      },
    });

    updateGame(state, 16, content);

    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'EnergyExplosion',
      skillId: 'fireball',
      radius: 68,
      damage: 32,
    }));
    expect(state.frameEffects).toContainEqual(expect.objectContaining({
      material: 'fire',
      profile: 'skillExplosionFire',
      life: 14,
      frames: 5,
      radialForce: 1,
      expansionFrames: 5,
      explosion: true,
    }));
    expect(state.frameEffects.every((effect) => ['fire'].includes(effect.material))).toBe(true);
  });

  it('defines the MVP elemental skills with only base material emitters', () => {
    const skillIds = Object.keys(SKILL_DEFINITIONS).sort();
    expect(skillIds).toEqual([
      'electric_bolt',
      'fireball',
      'rain_fall',
      'sand_barrage',
      'sand_bolt',
      'water_bolt',
      'water_burst',
    ]);

    for (const skill of Object.values(SKILL_DEFINITIONS)) {
      expect(skill).toEqual(expect.objectContaining({
        element: expect.any(String),
        tags: expect.arrayContaining([skill.element, 'base-element', 'gpu-reaction-input']),
        cooldownMs: expect.any(Number),
        targeting: expect.objectContaining({ type: 'progress-risk' }),
        gpuReactionRole: 'base-input-only',
      }));
      expect(collectSkillMaterials(skill).every((material) => (
        ['fire', 'water', 'electric', 'sand'].includes(material)
      ))).toBe(true);
    }
  });

  it('defines the three non-fire base weapons as single projectile bolts', () => {
    for (const skillId of ['water_bolt', 'electric_bolt', 'sand_bolt']) {
      const skill = SKILL_DEFINITIONS[skillId];

      expect(skill.tags).toEqual(expect.arrayContaining(['weapon', 'single-target', 'projectile']));
      expect(skill.projectile.pattern).toBeUndefined();
      expect(skill.impact.damage).toBeGreaterThan(0);
      expect(collectSkillMaterials(skill)).toEqual(expect.arrayContaining([skill.element]));
      expect(collectSkillMaterials(skill)).not.toContain('fire');
    }

    expect(SKILL_DEFINITIONS.electric_bolt.projectile.visual).toEqual(expect.objectContaining({
      shape: 'bolt',
      color: '#8be8ff',
    }));
    expect(SKILL_DEFINITIONS.electric_bolt.projectile.visual.coreColor).not.toBe('#fff0a6');
  });

  it('spawns sand barrage as a fan of five base sand projectiles', () => {
    const content = createTestContent({
      skills: { sand_barrage: SKILL_DEFINITIONS.sand_barrage },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 400;
    state.player.y = 300;
    state.entities.enemies.push({
      id: 1,
      hp: 100,
      x: 700,
      y: 300,
      radius: 18,
      progress: 400,
      travelDistance: 1000,
      contactDamage: 12,
    });

    updateGame(state, 16, content);

    expect(state.entities.projectiles).toHaveLength(5);
    expect(state.entities.projectiles.every((projectile) => projectile.skillId === 'sand_barrage')).toBe(true);
    expect(state.frameEffects).toContainEqual(expect.objectContaining({
      material: 'sand',
    }));
  });

  it('spawns rain fall above the target as downward water projectiles', () => {
    const content = createTestContent({
      skills: { rain_fall: SKILL_DEFINITIONS.rain_fall },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.entities.enemies.push({
      id: 1,
      hp: 100,
      x: 500,
      y: 300,
      radius: 18,
      progress: 400,
      travelDistance: 1000,
      contactDamage: 12,
    });

    updateGame(state, 16, content);

    expect(state.entities.projectiles).toHaveLength(9);
    expect(state.entities.projectiles.every((projectile) => projectile.vy > 0)).toBe(true);
    expect(state.entities.projectiles.every((projectile) => projectile.y < 300)).toBe(true);
  });
});

function collectSkillMaterials(skill) {
  const materials = [];
  const collect = (effects = []) => {
    for (const effect of effects || []) {
      if (effect?.material) materials.push(effect.material);
    }
  };

  collect(skill.materialEffects?.cast);
  collect(skill.materialEffects?.hit);
  collect(skill.projectile?.energy?.trailEffects);
  collect(skill.projectile?.energy?.explosion?.materialEffects);
  return materials;
}

describe('combat resolution', () => {
  it('clears stale frame effects even after game over', () => {
    const content = createTestContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.session.gameOver = true;
    state.frameEffects.push({
      type: 'MaterialEmitter',
      material: 'smoke',
      x: 120,
      y: 120,
      radius: 8,
      strength: 100,
      frames: 2,
    });

    updateGame(state, 16, content);

    expect(state.frameEffects).toHaveLength(0);
  });

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

  it('applies skill impact area damage around a projectile hit', () => {
    const content = createTestContent({
      skills: {
        blast: {
          id: 'blast',
          targeting: { type: 'progress-risk' },
          projectile: {
            speed: 0,
            damage: 0,
            radius: 8,
            lifetimeMs: 1000,
          },
          impact: {
            areaDamage: {
              radius: 64,
              damage: 10,
            },
          },
        },
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.skills.blast.cooldownRemainingMs = 9999;
    state.entities.enemies.push(
      {
        id: 1,
        hp: 30,
        x: 120,
        y: 120,
        radius: 18,
        progress: 0,
        travelDistance: 1000,
        contactDamage: 12,
      },
      {
        id: 2,
        hp: 30,
        x: 166,
        y: 120,
        radius: 18,
        progress: 0,
        travelDistance: 1000,
        contactDamage: 12,
      },
      {
        id: 3,
        hp: 30,
        x: 260,
        y: 120,
        radius: 18,
        progress: 0,
        travelDistance: 1000,
        contactDamage: 12,
      },
    );
    state.entities.projectiles.push({
      id: 1,
      skillId: 'blast',
      x: 120,
      y: 120,
      vx: 0,
      vy: 0,
      radius: 8,
      damage: 0,
      lifetimeMs: 1000,
      ageMs: 0,
    });

    updateGame(state, 16, content);

    expect(state.entities.enemies.find((enemy) => enemy.id === 1).hp).toBe(20);
    expect(state.entities.enemies.find((enemy) => enemy.id === 2).hp).toBe(20);
    expect(state.entities.enemies.find((enemy) => enemy.id === 3).hp).toBe(30);
  });

  it('scales projectile explosion radius and damage from compressed fire energy on impact', () => {
    const content = createTestContent({
      skills: {
        charge: {
          id: 'charge',
          targeting: { type: 'progress-risk' },
          projectile: {
            speed: 0,
            damage: 0,
            radius: 8,
            lifetimeMs: 1000,
          },
          impact: {
            damage: 0,
          },
        },
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.skills.charge.cooldownRemainingMs = 9999;
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      x: 120,
      y: 120,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 12,
    });
    state.entities.projectiles.push({
      id: 1,
      skillId: 'charge',
      x: 120,
      y: 120,
      vx: 0,
      vy: 0,
      radius: 8,
      damage: 0,
      lifetimeMs: 1000,
      ageMs: 0,
      energy: {
        current: 50,
        max: 100,
        trailAccumulatorMs: 0,
        trailIntervalMs: 1000,
        trailEffects: [],
        explosion: {
          minRadius: 10,
          maxRadius: 30,
          minDamage: 5,
          maxDamage: 15,
          materialEffects: [
            { material: 'fire', radiusScale: 1, strength: 255, frames: 3, explosion: true },
          ],
        },
      },
    });

    updateGame(state, 16, content);

    expect(state.entities.enemies[0].hp).toBe(20);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'EnergyExplosion',
      radius: 20,
      damage: 10,
    }));
    expect(state.frameEffects).toContainEqual(expect.objectContaining({
      material: 'fire',
      radius: 20,
      explosion: true,
    }));
  });

  it('ticks CPU hazards spawned by skill impact without reading back the GPU field', () => {
    const content = createTestContent({
      skills: {
        burn: {
          id: 'burn',
          targeting: { type: 'progress-risk' },
          projectile: {
            speed: 0,
            damage: 0,
            radius: 8,
            lifetimeMs: 1000,
          },
          impact: {
            hazards: [
              {
                type: 'burn',
                radius: 48,
                damagePerSecond: 10,
                lifetimeMs: 1000,
                tickMs: 250,
              },
            ],
          },
        },
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.skills.burn.cooldownRemainingMs = 9999;
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      x: 120,
      y: 120,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 12,
    });
    state.entities.projectiles.push({
      id: 1,
      skillId: 'burn',
      x: 120,
      y: 120,
      vx: 0,
      vy: 0,
      radius: 8,
      damage: 0,
      lifetimeMs: 1000,
      ageMs: 0,
    });

    updateGame(state, 16, content);
    expect(state.entities.hazards).toHaveLength(1);

    updateGame(state, 250, content);

    expect(state.entities.enemies[0].hp).toBeCloseTo(27.5);
    expect(state.frameEvents.some((event) => event.type === 'HazardTick')).toBe(true);
  });

  it('allows visual-only hazards to keep emitting material simulation ticks', () => {
    const content = createTestContent({
      skills: {
        steam: {
          id: 'steam',
          targeting: { type: 'progress-risk' },
          projectile: {
            speed: 0,
            damage: 0,
            radius: 8,
            lifetimeMs: 1000,
          },
          impact: {
            hazards: [
              {
                type: 'steam',
                radius: 48,
                damagePerSecond: 0,
                lifetimeMs: 1000,
                tickMs: 250,
                materialEffects: {
                  tick: [
                    { material: 'steam', radius: 12, strength: 180, frames: 2 },
                  ],
                },
              },
            ],
          },
        },
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.skills.steam.cooldownRemainingMs = 9999;
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      x: 120,
      y: 120,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 12,
    });
    state.entities.projectiles.push({
      id: 1,
      skillId: 'steam',
      x: 120,
      y: 120,
      vx: 0,
      vy: 0,
      radius: 8,
      damage: 0,
      lifetimeMs: 1000,
      ageMs: 0,
    });

    updateGame(state, 16, content);
    updateGame(state, 250, content);

    expect(state.frameEffects).toContainEqual(expect.objectContaining({
      material: 'steam',
      x: 120,
      y: 120,
    }));
  });

  it('applies GPU damage feedback records through the normal enemy damage path', () => {
    const content = createTestContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.entities.enemies.push(
      {
        id: 1,
        hp: 30,
        x: 120,
        y: 120,
        radius: 18,
        progress: 0,
        travelDistance: 1000,
        contactDamage: 12,
      },
      {
        id: 2,
        hp: 30,
        x: 220,
        y: 120,
        radius: 18,
        progress: 0,
        travelDistance: 1000,
        contactDamage: 12,
      },
    );

    const hitCount = applyGpuDamageFeedback(state, [
      { type: 'chainArc', sourceMaterial: 'chainArc', x: 120, y: 120, radius: 34, damage: 5 },
    ], content);

    expect(hitCount).toBe(1);
    expect(state.entities.enemies.find((enemy) => enemy.id === 1).hp).toBe(25);
    expect(state.entities.enemies.find((enemy) => enemy.id === 2).hp).toBe(30);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'GpuDamageFeedback',
      feedbackType: 'chainArc',
    }));
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'GpuDamageFeedbackHit',
      feedbackType: 'chainArc',
      enemyId: 1,
      damage: 5,
    }));
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

describe('item drops', () => {
  function createLootContent(overrides = {}) {
    return createTestContent({
      items: overrides.items ?? {
        coin: ITEM_DEFINITIONS.coin,
        hpPotion: ITEM_DEFINITIONS.hpPotion,
        gem: {
          ...ITEM_DEFINITIONS.coin,
          id: 'gem',
          name: 'Gem',
        },
      },
      loot: overrides.loot ?? {
        enemyDrops: [
          { itemId: 'coin', chance: 1, quantity: 1 },
        ],
      },
      environment: overrides.environment ?? {
        gasFlow: {
          windX: 0,
          windY: 0,
          windStrength: 0,
          noiseStrength: 0,
          noiseScale: 18,
          noiseSpeed: 10,
        },
      },
    });
  }

  function pushKillableEnemyAndProjectile(state, damage = 20) {
    state.entities.enemies.push({
      id: 1,
      hp: 10,
      maxHp: 10,
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
      damage,
      lifetimeMs: 1000,
      ageMs: 0,
    });
  }

  it('defines coin as the default enemy drop at seventy percent chance', () => {
    expect(GAME_CONTENT.loot.enemyDrops).toContainEqual(expect.objectContaining({
      itemId: 'coin',
      chance: 0.7,
    }));
  });

  it('defines hp potions as a default enemy drop at five percent chance', () => {
    expect(GAME_CONTENT.loot.enemyDrops).toContainEqual(expect.objectContaining({
      itemId: 'hpPotion',
      chance: 0.05,
    }));
  });

  it('drops a coin at the enemy death position when the loot roll succeeds', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    pushKillableEnemyAndProjectile(state);

    updateGame(state, 16, content);

    expect(state.entities.itemDrops).toHaveLength(1);
    expect(state.entities.itemDrops[0]).toMatchObject({
      itemId: 'coin',
      x: 120,
      y: 120,
      quantity: 1,
    });
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'ItemDropped',
      enemyId: 1,
      itemId: 'coin',
    }));
  });

  it('does not create a drop when the loot roll fails', () => {
    const content = createLootContent({
      loot: {
        enemyDrops: [
          { itemId: 'coin', chance: 0, quantity: 1 },
        ],
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
    pushKillableEnemyAndProjectile(state);

    updateGame(state, 16, content);

    expect(state.entities.itemDrops).toHaveLength(0);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'EnemyKilled',
      enemyId: 1,
    }));
  });

  it('moves world drops slowly with the CPU wind flow', () => {
    const content = createLootContent({
      environment: {
        gasFlow: {
          windX: 1,
          windY: 0,
          windStrength: 255,
          noiseStrength: 0,
          noiseScale: 18,
          noiseSpeed: 10,
        },
      },
    });
    const state = createGameState({ width: 800, height: 600, content });
    state.entities.itemDrops.push({
      id: 1,
      itemId: 'coin',
      quantity: 1,
      x: 100,
      y: 100,
      radius: 11,
      pickupRadius: 20,
      ageMs: 0,
      driftSeed: 1,
    });

    updateGame(state, 1000, content);

    expect(state.entities.itemDrops[0].x).toBeGreaterThan(100);
    expect(state.entities.itemDrops[0].x).toBeLessThan(125);
    expect(state.entities.itemDrops[0].y).toBe(100);
  });

  it('expires drops outside the whole square field but keeps drops outside only the visible crop', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 800, content });
    updateViewport(state, 800, 800, {
      x: 200,
      y: 0,
      width: 400,
      height: 800,
    });
    state.player.recenter = null;
    state.entities.itemDrops.push(
      {
        id: 1,
        itemId: 'coin',
        quantity: 1,
        x: 100,
        y: 400,
        radius: 11,
        pickupRadius: 20,
        ageMs: 0,
        driftSeed: 1,
      },
      {
        id: 2,
        itemId: 'coin',
        quantity: 1,
        x: 820,
        y: 400,
        radius: 11,
        pickupRadius: 20,
        ageMs: 0,
        driftSeed: 2,
      },
    );

    updateGame(state, 16, content);

    expect(state.entities.itemDrops.map((drop) => drop.id)).toEqual([1]);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'ItemDropExpired',
      itemDropId: 2,
    }));
  });

  it('collects colliding drops and stacks matching item quantities in tail order', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 100;
    state.player.y = 100;
    state.entities.itemDrops.push(
      {
        id: 1,
        itemId: 'coin',
        quantity: 1,
        x: 100,
        y: 100,
        radius: 11,
        pickupRadius: 20,
        ageMs: 0,
        driftSeed: 1,
      },
      {
        id: 2,
        itemId: 'coin',
        quantity: 2,
        x: 100,
        y: 100,
        radius: 11,
        pickupRadius: 20,
        ageMs: 0,
        driftSeed: 2,
      },
      {
        id: 3,
        itemId: 'gem',
        quantity: 1,
        x: 100,
        y: 100,
        radius: 11,
        pickupRadius: 20,
        ageMs: 0,
        driftSeed: 3,
      },
    );

    updateGame(state, 16, content);

    expect(state.entities.itemDrops).toHaveLength(0);
    expect(state.player.collectedItems.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
    }))).toEqual([
      { itemId: 'coin', quantity: 3 },
      { itemId: 'gem', quantity: 1 },
    ]);
  });

  it('heals immediately when picking up an hp potion below full health', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 100;
    state.player.y = 100;
    state.player.hp = 60;
    state.entities.itemDrops.push({
      id: 1,
      itemId: 'hpPotion',
      quantity: 1,
      x: 100,
      y: 100,
      radius: 11,
      pickupRadius: 20,
      ageMs: 0,
      driftSeed: 1,
    });

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(90);
    expect(state.player.collectedItems).toHaveLength(0);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'PlayerHealed',
      itemId: 'hpPotion',
      source: 'pickup',
      healAmount: 30,
      playerHp: 90,
    }));
  });

  it('caps immediate hp potion healing at max hp', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 100;
    state.player.y = 100;
    state.player.hp = 85;
    state.entities.itemDrops.push({
      id: 1,
      itemId: 'hpPotion',
      quantity: 1,
      x: 100,
      y: 100,
      radius: 11,
      pickupRadius: 20,
      ageMs: 0,
      driftSeed: 1,
    });

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(100);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'PlayerHealed',
      healAmount: 15,
      playerHp: 100,
    }));
  });

  it('stores hp potions as ribbon items when picked up at full health', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 100;
    state.player.y = 100;
    state.player.hp = state.player.maxHp;
    state.entities.itemDrops.push({
      id: 1,
      itemId: 'hpPotion',
      quantity: 1,
      x: 100,
      y: 100,
      radius: 11,
      pickupRadius: 20,
      ageMs: 0,
      driftSeed: 1,
    });

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(100);
    expect(state.player.collectedItems.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
    }))).toEqual([
      { itemId: 'hpPotion', quantity: 1 },
    ]);
  });

  it('auto uses one stored hp potion when player hp is fifty percent or lower', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.hp = 50;
    state.player.collectedItems.push({
      itemId: 'hpPotion',
      quantity: 2,
      name: 'HP Potion',
      spriteUrl: ITEM_DEFINITIONS.hpPotion.spriteUrl,
      spriteSize: ITEM_DEFINITIONS.hpPotion.tailSize,
      visual: ITEM_DEFINITIONS.hpPotion.visual,
    });

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(80);
    expect(state.player.collectedItems).toContainEqual(expect.objectContaining({
      itemId: 'hpPotion',
      quantity: 1,
    }));
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'PlayerHealed',
      itemId: 'hpPotion',
      source: 'auto',
      healAmount: 30,
    }));
  });

  it('does not auto use stored hp potions above fifty percent hp', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.hp = 51;
    state.player.collectedItems.push({
      itemId: 'hpPotion',
      quantity: 1,
      name: 'HP Potion',
      spriteUrl: ITEM_DEFINITIONS.hpPotion.spriteUrl,
      spriteSize: ITEM_DEFINITIONS.hpPotion.tailSize,
      visual: ITEM_DEFINITIONS.hpPotion.visual,
    });

    updateGame(state, 16, content);

    expect(state.player.hp).toBe(51);
    expect(state.player.collectedItems).toContainEqual(expect.objectContaining({
      itemId: 'hpPotion',
      quantity: 1,
    }));
    expect(state.frameEvents.some((event) => event.type === 'PlayerHealed')).toBe(false);
  });

  it('loses five to ten percent of ribbon items when the player is damaged', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 100;
    state.player.y = 100;
    state.player.collectedItems.push({
      itemId: 'coin',
      quantity: 100,
      name: 'Coin',
      spriteUrl: ITEM_DEFINITIONS.coin.spriteUrl,
      spriteSize: ITEM_DEFINITIONS.coin.tailSize,
      visual: ITEM_DEFINITIONS.coin.visual,
    });
    state.entities.enemies.push({
      id: 1,
      hp: 30,
      x: 100,
      y: 100,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 12,
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      updateGame(state, 16, content);
    } finally {
      randomSpy.mockRestore();
    }

    expect(state.player.hp).toBe(88);
    expect(state.player.collectedItems).toContainEqual(expect.objectContaining({
      itemId: 'coin',
      quantity: 95,
    }));
    expect(state.entities.lostItems).toHaveLength(5);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'RibbonItemsLost',
      source: 'enemyContact',
      enemyId: 1,
      lostQuantity: 5,
      totalQuantityBefore: 100,
      items: { coin: 5 },
    }));
  });

  it('caps lost ribbon item visuals at six regardless of lost quantity', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.player.x = 100;
    state.player.y = 100;
    state.player.collectedItems.push({
      itemId: 'coin',
      quantity: 1000,
      name: 'Coin',
      spriteUrl: ITEM_DEFINITIONS.coin.spriteUrl,
      spriteSize: ITEM_DEFINITIONS.coin.tailSize,
      visual: ITEM_DEFINITIONS.coin.visual,
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    let lostQuantity = 0;
    try {
      lostQuantity = losePlayerRibbonItems(state, content, { source: 'testDamage' });
    } finally {
      randomSpy.mockRestore();
    }

    expect(lostQuantity).toBe(50);
    expect(state.player.collectedItems).toContainEqual(expect.objectContaining({
      itemId: 'coin',
      quantity: 950,
    }));
    expect(state.entities.lostItems).toHaveLength(6);
    expect(state.entities.lostItems.every((item) => item.gravity === 1520)).toBe(true);
    expect(state.entities.lostItems.every((item) => item.vy < -320)).toBe(true);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'RibbonItemsLost',
      source: 'testDamage',
      lostQuantity: 50,
      totalQuantityBefore: 1000,
      items: { coin: 50 },
    }));
  });

  it('removes lost item visuals after they fall outside the field', () => {
    const content = createLootContent();
    const state = createGameState({ width: 800, height: 600, content });
    state.entities.lostItems.push({
      id: 1,
      itemId: 'coin',
      x: 400,
      y: 590,
      vx: 0,
      vy: 1000,
      gravity: 760,
      radius: 11,
      spriteUrl: ITEM_DEFINITIONS.coin.spriteUrl,
      spriteSize: ITEM_DEFINITIONS.coin.tailSize,
      visual: ITEM_DEFINITIONS.coin.visual,
      rotation: 0,
      rotationSpeed: 0,
      ageMs: 0,
      lifetimeMs: 4000,
    });

    updateGame(state, 500, content);

    expect(state.entities.lostItems).toHaveLength(0);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'LostItemExpired',
      lostItemId: 1,
      itemId: 'coin',
    }));
  });
});
