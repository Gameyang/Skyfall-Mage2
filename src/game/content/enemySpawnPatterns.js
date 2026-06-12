export const ENEMY_SPAWN_PATTERN_DEFINITIONS = Object.freeze({
  edgeFlock: Object.freeze({
    id: 'edgeFlock',
    defaultParams: Object.freeze({
      side: 'left',
      count: 4,
      laneMode: 'spread',
    }),
  }),
  oppositePincer: Object.freeze({
    id: 'oppositePincer',
    defaultParams: Object.freeze({
      sides: Object.freeze(['left', 'right']),
      countPerSide: 3,
      laneMode: 'spread',
    }),
  }),
  rotatingSides: Object.freeze({
    id: 'rotatingSides',
    defaultParams: Object.freeze({
      sideOrder: Object.freeze(['left', 'top', 'right', 'bottom']),
      count: 4,
      laneMode: 'spread',
    }),
  }),
  staggeredStream: Object.freeze({
    id: 'staggeredStream',
    defaultParams: Object.freeze({
      side: 'left',
      count: 2,
      laneMode: 'random',
    }),
  }),
  cornerAmbush: Object.freeze({
    id: 'cornerAmbush',
    defaultParams: Object.freeze({
      corners: Object.freeze(['topLeft', 'topRight', 'bottomLeft', 'bottomRight']),
      count: 4,
      jitter: 0.08,
    }),
  }),
  ringSurround: Object.freeze({
    id: 'ringSurround',
    defaultParams: Object.freeze({
      count: 12,
      angleOffset: 0,
    }),
  }),
  eliteEscort: Object.freeze({
    id: 'eliteEscort',
    defaultParams: Object.freeze({
      leaderType: 'eliteBat',
      escortType: 'normalBat',
      escortCount: 6,
      side: 'top',
    }),
  }),
});
