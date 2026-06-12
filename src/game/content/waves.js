export const WAVE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'wave-01-edge-basics',
    waveIndex: 1,
    durationMs: 30000,
    difficultyTier: 'intro',
    groups: Object.freeze([
      Object.freeze({
        id: 'left-right-basics',
        startMs: 500,
        repeat: 8,
        repeatIntervalMs: 3600,
        enemyType: 'normalBat',
        spawnPatternId: 'rotatingSides',
        spawnParams: Object.freeze({
          sideOrder: Object.freeze(['left', 'right']),
          count: 3,
          laneMode: 'spread',
        }),
        pathPatternId: 'straight',
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-02-soft-curve',
    waveIndex: 2,
    durationMs: 30000,
    difficultyTier: 'intro',
    groups: Object.freeze([
      Object.freeze({
        id: 'curved-flock',
        startMs: 500,
        repeat: 8,
        repeatIntervalMs: 3600,
        enemyType: 'normalBat',
        spawnPatternId: 'edgeFlock',
        spawnParams: Object.freeze({
          side: 'top',
          count: 4,
          laneMode: 'spread',
        }),
        pathPatternId: 'sCurve',
        pathParams: Object.freeze({
          amplitude: 42,
          frequency: 1.8,
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-03-rotating-sides',
    waveIndex: 3,
    durationMs: 32000,
    difficultyTier: 'intro',
    groups: Object.freeze([
      Object.freeze({
        id: 'four-side-rotation',
        startMs: 500,
        repeat: 9,
        repeatIntervalMs: 3300,
        enemyType: 'normalBat',
        spawnPatternId: 'rotatingSides',
        spawnParams: Object.freeze({
          sideOrder: Object.freeze(['left', 'top', 'right', 'bottom']),
          count: 4,
          laneMode: 'spread',
        }),
        pathPatternId: 'sCurve',
        pathParams: Object.freeze({
          amplitude: 46,
          frequency: 2,
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-04-pincer',
    waveIndex: 4,
    durationMs: 32000,
    difficultyTier: 'early',
    groups: Object.freeze([
      Object.freeze({
        id: 'left-right-pincer',
        startMs: 500,
        repeat: 7,
        repeatIntervalMs: 4000,
        enemyType: 'normalBat',
        spawnPatternId: 'oppositePincer',
        spawnParams: Object.freeze({
          sides: Object.freeze(['left', 'right']),
          countPerSide: 3,
          laneMode: 'spread',
        }),
        pathPatternId: 'sCurve',
        pathParams: Object.freeze({
          amplitude: 54,
          frequency: 2.2,
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-05-fast-stream',
    waveIndex: 5,
    durationMs: 34000,
    difficultyTier: 'early',
    groups: Object.freeze([
      Object.freeze({
        id: 'fast-staggered-stream',
        startMs: 500,
        repeat: 18,
        repeatIntervalMs: 1700,
        enemyType: 'fastBat',
        spawnPatternId: 'staggeredStream',
        spawnParams: Object.freeze({
          sideOrder: Object.freeze(['left', 'right', 'top', 'bottom']),
          count: 2,
          laneMode: 'random',
        }),
        pathPatternId: 'straight',
        scaling: Object.freeze({
          speedMultiplier: 0.95,
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-06-heavy-mix',
    waveIndex: 6,
    durationMs: 36000,
    difficultyTier: 'early',
    groups: Object.freeze([
      Object.freeze({
        id: 'normal-cover',
        startMs: 500,
        repeat: 8,
        repeatIntervalMs: 3600,
        enemyType: 'normalBat',
        spawnPatternId: 'rotatingSides',
        spawnParams: Object.freeze({
          sideOrder: Object.freeze(['top', 'right', 'bottom', 'left']),
          count: 4,
          laneMode: 'spread',
        }),
        pathPatternId: 'sCurve',
      }),
      Object.freeze({
        id: 'heavy-pressure',
        startMs: 4500,
        repeat: 4,
        repeatIntervalMs: 7200,
        enemyType: 'heavyBat',
        spawnPatternId: 'edgeFlock',
        spawnParams: Object.freeze({
          side: 'bottom',
          count: 2,
          laneMode: 'spread',
        }),
        pathPatternId: 'sCurve',
        scaling: Object.freeze({
          hpMultiplier: 0.92,
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-07-corner-zigzag',
    waveIndex: 7,
    durationMs: 36000,
    difficultyTier: 'mid',
    groups: Object.freeze([
      Object.freeze({
        id: 'corner-fast-bats',
        startMs: 600,
        repeat: 8,
        repeatIntervalMs: 4000,
        enemyType: 'fastBat',
        spawnPatternId: 'cornerAmbush',
        spawnParams: Object.freeze({
          corners: Object.freeze(['topLeft', 'bottomRight', 'topRight', 'bottomLeft']),
          count: 4,
          jitter: 0.06,
        }),
        pathPatternId: 'zigzag',
        pathParams: Object.freeze({
          amplitude: 42,
          frequency: 5.5,
        }),
        scaling: Object.freeze({
          speedMultiplier: 0.9,
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'wave-08-elite-escort',
    waveIndex: 8,
    durationMs: 42000,
    difficultyTier: 'mid',
    endCondition: Object.freeze({
      type: 'durationOrCleared',
    }),
    groups: Object.freeze([
      Object.freeze({
        id: 'elite-with-escort',
        startMs: 1000,
        repeat: 3,
        repeatIntervalMs: 13000,
        enemyType: 'eliteBat',
        spawnPatternId: 'eliteEscort',
        spawnParams: Object.freeze({
          leaderType: 'eliteBat',
          escortType: 'normalBat',
          escortCount: 6,
          sideOrder: Object.freeze(['top', 'right', 'bottom']),
        }),
        pathPatternId: 'sCurve',
        pathParams: Object.freeze({
          amplitude: 64,
          frequency: 1.7,
        }),
        scaling: Object.freeze({
          hpMultiplier: 0.86,
          contactDamageMultiplier: 0.6,
        }),
      }),
      Object.freeze({
        id: 'ring-noise',
        startMs: 7000,
        repeat: 3,
        repeatIntervalMs: 13000,
        enemyType: 'normalBat',
        spawnPatternId: 'ringSurround',
        spawnParams: Object.freeze({
          count: 10,
        }),
        pathPatternId: 'sCurve',
        pathParams: Object.freeze({
          amplitude: 36,
          frequency: 2.4,
        }),
        scaling: Object.freeze({
          contactDamageMultiplier: 0.6,
        }),
      }),
    ]),
  }),
]);
