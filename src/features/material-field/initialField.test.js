import { describe, expect, it } from 'vitest';
import { CELL_COUNT, EMITTER_PROFILE, EMITTER_WORDS, GAS_FLOW_CONFIG } from './config.js';
import { seedInitialField } from './initialField.js';
import { MaterialEmitterState } from './MaterialEmitterState.js';
import { MATERIAL } from './materials.js';
import materialFieldShaderSource from './shaders/noitaField.wgsl?raw';
import { mapEffectToGrid } from './ViewportMapper.js';
import { DamageFeedbackBuffer } from './DamageFeedbackBuffer.js';
import {
  compileGpuReactionRules,
  getReactionOutput,
  GPU_REACTION_RULES,
  PRIMARY_GPU_REACTION_RULES,
  SECONDARY_GPU_REACTION_RULES,
} from './gpuReactionRules.js';

describe('seedInitialField', () => {
  it('starts combat in an empty sky field without terrain or obstacles', () => {
    const cells = seedInitialField();

    expect(cells).toHaveLength(CELL_COUNT);
    expect(Array.from(cells).every((cell) => (cell & 0xff) === MATERIAL.EMPTY)).toBe(true);
  });
});

describe('mapEffectToGrid', () => {
  it('maps viewport combat effects into bounded material grid coordinates', () => {
    const mapped = mapEffectToGrid(
      { x: 400, y: 300, radius: 40 },
      { width: 800, height: 600 },
      { width: 80, height: 60 },
    );

    expect(mapped).toEqual({ x: 40, y: 30, radius: 4 });
  });

  it('clamps effects that land outside the viewport', () => {
    const mapped = mapEffectToGrid(
      { x: 900, y: -50, radius: 10 },
      { width: 800, height: 600 },
      { width: 80, height: 60 },
    );

    expect(mapped.x).toBe(79);
    expect(mapped.y).toBe(0);
  });
});

describe('MaterialEmitterState', () => {
  it('packs emitter profile and life into the reserved emitter word', () => {
    const emitterState = new MaterialEmitterState();
    emitterState.addEmitter({
      material: MATERIAL.FIRE,
      x: 10,
      y: 12,
      radius: 5,
      profile: EMITTER_PROFILE.PROJECTILE_FIRE,
      life: 44,
    });

    const payload = emitterState.buildEmitterBuffer();
    const profileData = payload.words[EMITTER_WORDS - 1];

    expect(payload.count).toBe(1);
    expect(profileData & 0xff).toBe(EMITTER_PROFILE.PROJECTILE_FIRE);
    expect((profileData >> 8) & 0xff).toBe(44);
  });

  it('expands radial burst emitters instead of shrinking them', () => {
    const emitterState = new MaterialEmitterState();
    emitterState.addEmitter({
      material: MATERIAL.FIRE,
      x: 10,
      y: 12,
      radius: 40,
      frames: 5,
      radialForce: 1,
      expansionFrames: 5,
    });

    const firstRadius = emitterState.buildEmitterBuffer().words[3];
    emitterState.ageBurstEmitters();
    const secondRadius = emitterState.buildEmitterBuffer().words[3];

    expect(firstRadius).toBeLessThan(40);
    expect(secondRadius).toBeGreaterThan(firstRadius);
  });
});

describe('elemental material reactions', () => {
  it('defines the four direct elements and six primary derived materials', () => {
    expect(MATERIAL).toEqual(expect.objectContaining({
      FIRE: 4,
      WATER: 3,
      ELECTRIC: 9,
      SAND: 2,
      STEAM: 7,
      SPARK: 6,
      ROCK: 10,
      ICE: 11,
      DUST: 12,
      FIXED_ZONE: 13,
      CHAIN_ARC: 14,
      CHAIN_EXPLOSION: 15,
      LASER_ARC: 16,
      PINBALL_ROCK: 17,
      LIGHTNING_ROCK: 18,
      ICE_BURST: 19,
      BLIZZARD: 20,
      FIRE_DUST: 21,
      CHARGED_DUST: 22,
      AMPLIFY_ZONE: 23,
      SLOW_ZONE: 24,
      GRAVITY_ZONE: 25,
    }));
  });

  it('keeps primary GPU reaction rules out of skill definitions', () => {
    expect(PRIMARY_GPU_REACTION_RULES).toEqual(expect.arrayContaining([
      expect.objectContaining({ inputA: 'fire', inputB: 'water', output: 'steam' }),
      expect.objectContaining({ inputA: 'fire', inputB: 'electric', output: 'spark' }),
      expect.objectContaining({ inputA: 'fire', inputB: 'sand', output: 'rock' }),
      expect.objectContaining({ inputA: 'water', inputB: 'electric', output: 'ice' }),
      expect.objectContaining({ inputA: 'water', inputB: 'sand', output: 'dust' }),
      expect.objectContaining({ inputA: 'electric', inputB: 'sand', output: 'fixedZone' }),
    ]));
    expect(getReactionOutput('electric', 'fire')).toEqual(expect.objectContaining({
      output: 'spark',
    }));
  });

  it('compiles reaction metadata into numeric shader-friendly rows', () => {
    const materialIds = {
      fire: MATERIAL.FIRE,
      water: MATERIAL.WATER,
      electric: MATERIAL.ELECTRIC,
      sand: MATERIAL.SAND,
      steam: MATERIAL.STEAM,
      spark: MATERIAL.SPARK,
      rock: MATERIAL.ROCK,
      ice: MATERIAL.ICE,
      dust: MATERIAL.DUST,
      fixedZone: MATERIAL.FIXED_ZONE,
      chainArc: MATERIAL.CHAIN_ARC,
      chainExplosion: MATERIAL.CHAIN_EXPLOSION,
      laserArc: MATERIAL.LASER_ARC,
      pinballRock: MATERIAL.PINBALL_ROCK,
      lightningRock: MATERIAL.LIGHTNING_ROCK,
      iceBurst: MATERIAL.ICE_BURST,
      blizzard: MATERIAL.BLIZZARD,
      fireDust: MATERIAL.FIRE_DUST,
      chargedDust: MATERIAL.CHARGED_DUST,
      amplifyZone: MATERIAL.AMPLIFY_ZONE,
      slowZone: MATERIAL.SLOW_ZONE,
      gravityZone: MATERIAL.GRAVITY_ZONE,
    };
    const rows = compileGpuReactionRules(PRIMARY_GPU_REACTION_RULES, materialIds);

    expect(rows).toContainEqual(expect.objectContaining({
      inputA: MATERIAL.FIRE,
      inputB: MATERIAL.WATER,
      output: MATERIAL.STEAM,
      priority: 10,
    }));
    expect(rows.every((row) => row.inputA >= 0 && row.inputB >= 0 && row.output >= 0)).toBe(true);
    expect(compileGpuReactionRules(GPU_REACTION_RULES, materialIds)
      .every((row) => row.inputA >= 0 && row.inputB >= 0 && row.output >= 0)).toBe(true);
  });

  it('uses damage feedback only for selected secondary reactions', () => {
    const feedbackRules = SECONDARY_GPU_REACTION_RULES.filter((rule) => rule.feedback?.enabled);

    expect(feedbackRules.length).toBeGreaterThanOrEqual(6);
    expect(feedbackRules).toContainEqual(expect.objectContaining({
      output: 'chainArc',
      feedback: expect.objectContaining({ enabled: true, damageType: 'chainArc' }),
    }));
    expect(SECONDARY_GPU_REACTION_RULES.find((rule) => rule.output === 'amplifyZone').feedback.enabled).toBe(false);
  });

  it('stores bounded GPU damage feedback records without exposing field readback', () => {
    const buffer = new DamageFeedbackBuffer({ maxRecords: 1 });
    const chainArcRule = SECONDARY_GPU_REACTION_RULES.find((rule) => rule.output === 'chainArc');

    expect(buffer.pushFromRule(chainArcRule, { x: 42, y: 24 }, 2)).toEqual(expect.objectContaining({
      type: 'chainArc',
      x: 42,
      y: 24,
      radius: chainArcRule.feedback.radius,
    }));
    expect(buffer.push({ type: 'laserArc', x: 10, y: 10, radius: 20, damage: 4 })).toBeNull();
    expect(buffer.droppedRecords).toBe(1);
    expect(buffer.read()).toHaveLength(1);
    expect(buffer.drain()).toHaveLength(1);
    expect(buffer.read()).toHaveLength(0);
  });
});

describe('material field shader profiles', () => {
  it('keeps projectile fire marked while letting the tail follow gas flow and decay quickly', () => {
    expect(materialFieldShaderSource).toContain('const AUX_PROJECTILE_FIRE');
    expect(materialFieldShaderSource).toContain('const PROJECTILE_FIRE_DECAY_PER_STEP');
    expect(materialFieldShaderSource).toContain('fn isProjectileFire');
    expect(materialFieldShaderSource).toContain('fn projectileFireTarget');
    expect(materialFieldShaderSource).toContain('let moveTo = projectileFireTarget(x, y)');
    expect(materialFieldShaderSource).toContain('return pack(FIRE, nextAge, AUX_PROJECTILE_FIRE)');
    expect(materialFieldShaderSource).toContain('profile == EMITTER_PROFILE_PROJECTILE_FIRE');
  });

  it('keeps skill explosion fire separate from normal fire so it can burn hotter and clear faster', () => {
    expect(EMITTER_PROFILE.SKILL_EXPLOSION_FIRE).toBe(3);
    expect(materialFieldShaderSource).toContain('const EMITTER_PROFILE_SKILL_EXPLOSION_FIRE');
    expect(materialFieldShaderSource).toContain('const AUX_SKILL_EXPLOSION_FIRE');
    expect(materialFieldShaderSource).toContain('const SKILL_EXPLOSION_FIRE_DECAY_PER_STEP');
    expect(materialFieldShaderSource).toContain('fn isSkillExplosionFire');
    expect(materialFieldShaderSource).toContain('fn decaySkillExplosionFireAge');
    expect(materialFieldShaderSource).toContain('emitterProfile(emitter) == EMITTER_PROFILE_SKILL_EXPLOSION_FIRE');
    expect(materialFieldShaderSource).toContain('let ringWidth = max(2, radius / 4)');
    expect(materialFieldShaderSource).toContain('let innerRadius2 = innerRadius * innerRadius');
  });

  it('uses global gas wind and noise when selecting gas movement targets', () => {
    expect(GAS_FLOW_CONFIG).toEqual(expect.objectContaining({
      windX: 1,
      windY: 0,
      windStrength: 85,
      noiseStrength: 64,
    }));
    expect(materialFieldShaderSource).toContain('gasWindX: u32');
    expect(materialFieldShaderSource).toContain('gasWindStrength: u32');
    expect(materialFieldShaderSource).toContain('gasNoiseStrength: u32');
    expect(materialFieldShaderSource).toContain('fn gasFlowX');
    expect(materialFieldShaderSource).toContain('let windStrength = min(params.gasWindStrength, 255u)');
    expect(materialFieldShaderSource).toContain('let flowX = gasFlowX(x, y, 30u)');
    expect(materialFieldShaderSource).toContain('let flowX = gasFlowX(x, y, 33u)');
  });

  it('contains elemental material constants and primary reaction branches', () => {
    expect(materialFieldShaderSource).toContain('const ELECTRIC: u32 = 9u');
    expect(materialFieldShaderSource).toContain('const ROCK: u32 = 10u');
    expect(materialFieldShaderSource).toContain('const ICE: u32 = 11u');
    expect(materialFieldShaderSource).toContain('const DUST: u32 = 12u');
    expect(materialFieldShaderSource).toContain('const FIXED_ZONE: u32 = 13u');
    expect(materialFieldShaderSource).toContain('return pack(SPARK');
    expect(materialFieldShaderSource).toContain('return pack(ROCK');
    expect(materialFieldShaderSource).toContain('return pack(ICE');
    expect(materialFieldShaderSource).toContain('return pack(DUST');
    expect(materialFieldShaderSource).toContain('return pack(FIXED_ZONE');
  });

  it('contains secondary reaction material constants and priority branches', () => {
    expect(materialFieldShaderSource).toContain('const CHAIN_ARC: u32 = 14u');
    expect(materialFieldShaderSource).toContain('const CHAIN_EXPLOSION: u32 = 15u');
    expect(materialFieldShaderSource).toContain('const LASER_ARC: u32 = 16u');
    expect(materialFieldShaderSource).toContain('const LIGHTNING_ROCK: u32 = 18u');
    expect(materialFieldShaderSource).toContain('const GRAVITY_ZONE: u32 = 25u');
    expect(materialFieldShaderSource).toContain('return pack(CHAIN_ARC');
    expect(materialFieldShaderSource).toContain('return pack(CHAIN_EXPLOSION');
    expect(materialFieldShaderSource).toContain('return pack(LASER_ARC');
    expect(materialFieldShaderSource).toContain('return pack(PINBALL_ROCK');
    expect(materialFieldShaderSource).toContain('return pack(LIGHTNING_ROCK');
    expect(materialFieldShaderSource).toContain('return pack(ICE_BURST');
    expect(materialFieldShaderSource).toContain('return pack(BLIZZARD');
    expect(materialFieldShaderSource).toContain('return pack(FIRE_DUST');
    expect(materialFieldShaderSource).toContain('return pack(CHARGED_DUST');
    expect(materialFieldShaderSource).toContain('return pack(AMPLIFY_ZONE');
    expect(materialFieldShaderSource).toContain('return pack(SLOW_ZONE');
    expect(materialFieldShaderSource).toContain('return pack(GRAVITY_ZONE');
    expect(materialFieldShaderSource).toContain('fn isPassableSecondaryMaterial');
    expect(materialFieldShaderSource).toContain('!isHeavyFallingMaterial(mat)');
    expect(materialFieldShaderSource.indexOf('mat == SPARK && isSandNear'))
      .toBeLessThan(materialFieldShaderSource.indexOf('mat == ELECTRIC && isSandNear'));
  });

  it('preserves electric movement from every direction it can target', () => {
    expect(materialFieldShaderSource).toContain('fn electricTarget');
    expect(materialFieldShaderSource).toContain('targetMatches(electricTarget(x - 1, y), x, y)');
    expect(materialFieldShaderSource).toContain('targetMatches(electricTarget(x + 1, y), x, y)');
    expect(materialFieldShaderSource).toContain('targetMatches(electricTarget(x, y + 1), x, y)');
    expect(materialFieldShaderSource).toContain('return pack(SPARK, 6u + (randByte(x, y, 56u) & 7u)');
  });
});
