export const GRID_WIDTH = 256;
export const GRID_HEIGHT = 144;
export const WORKGROUP_SIZE = 8;
export const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;
export const CELL_BYTES = Uint32Array.BYTES_PER_ELEMENT;

export const PARAM_WORDS = 16;
export const MAX_EMITTERS = 32;
export const EMITTER_WORDS = 8;
export const EMITTER_FLAG_EXPLOSION = 1;
export const EMITTER_BYTES = MAX_EMITTERS * EMITTER_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const BRUSH_RADIUS = 5;
export const TOUCH_WATER_RADIUS = 6;
export const EXPLOSION_RADIUS = 18;
export const EXPLOSION_FRAMES = 5;
export const DPR_LIMIT = 2;

export const HDR_SCENE_FORMAT = 'rgba16float';
export const SCENE_CLEAR_COLOR = Object.freeze({ r: 0.02, g: 0.02, b: 0.03, a: 1 });
export const BLOOM_CONFIG = Object.freeze({
  enabled: true,
  threshold: 0.98,
  intensity: 0.95,
  radius: 1.35,
  levels: 6,
  bloomFormat: HDR_SCENE_FORMAT,
  clearColor: SCENE_CLEAR_COLOR,
});
