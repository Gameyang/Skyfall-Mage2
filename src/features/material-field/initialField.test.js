import { describe, expect, it } from 'vitest';
import { CELL_COUNT, EMITTER_PROFILE, EMITTER_WORDS, GAS_FLOW_CONFIG } from './config.js';
import { seedInitialField } from './initialField.js';
import { MaterialEmitterState } from './MaterialEmitterState.js';
import { MATERIAL } from './materials.js';
import materialFieldShaderSource from './shaders/noitaField.wgsl?raw';
import { mapEffectToGrid } from './ViewportMapper.js';

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
});
