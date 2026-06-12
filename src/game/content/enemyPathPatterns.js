export const ENEMY_PATH_PATTERN_DEFINITIONS = Object.freeze({
  straight: Object.freeze({
    id: 'straight',
    defaultParams: Object.freeze({
      margin: 44,
    }),
  }),
  sCurve: Object.freeze({
    id: 'sCurve',
    defaultParams: Object.freeze({
      amplitude: 58,
      frequency: 2.15,
      margin: 44,
    }),
  }),
  zigzag: Object.freeze({
    id: 'zigzag',
    defaultParams: Object.freeze({
      amplitude: 52,
      frequency: 5,
      sharpness: 0.82,
      margin: 44,
    }),
  }),
  homingSoft: Object.freeze({
    id: 'homingSoft',
    defaultParams: Object.freeze({
      turnRate: 2.2,
      margin: 44,
    }),
  }),
  dashPause: Object.freeze({
    id: 'dashPause',
    defaultParams: Object.freeze({
      dashMs: 520,
      pauseMs: 360,
      margin: 44,
    }),
  }),
  spiralIn: Object.freeze({
    id: 'spiralIn',
    defaultParams: Object.freeze({
      turns: 1.35,
      margin: 44,
    }),
  }),
});
