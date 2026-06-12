import { ENEMY_SPAWN_PATTERN_DEFINITIONS } from './content/enemySpawnPatterns.js';
import { scaleSpawnCount } from './enemyDifficulty.js';
import { clamp, hash01 } from './math.js';

const DEFAULT_SIDE_ORDER = Object.freeze(['left', 'top', 'right', 'bottom']);

export function createSpawnContexts({
  state,
  waveGroup = {},
  spawnPatternId = waveGroup.spawnPatternId,
  spawnParams = waveGroup.spawnParams,
  difficulty,
  repeatIndex = 0,
} = {}) {
  const patternId = spawnPatternId || 'edgeFlock';
  const defaults = ENEMY_SPAWN_PATTERN_DEFINITIONS[patternId]?.defaultParams || {};
  const params = {
    ...defaults,
    ...legacySpawnParamsFromWave(waveGroup),
    ...(spawnParams || {}),
  };

  if (patternId === 'oppositePincer') {
    return createOppositePincerContexts({ state, params, difficulty, repeatIndex });
  }
  if (patternId === 'rotatingSides') {
    return createRotatingSideContexts({ state, params, difficulty, repeatIndex });
  }
  if (patternId === 'staggeredStream') {
    return createStaggeredStreamContexts({ state, params, difficulty, repeatIndex });
  }
  if (patternId === 'cornerAmbush') {
    return createCornerAmbushContexts({ state, params, difficulty, repeatIndex });
  }
  if (patternId === 'ringSurround') {
    return createRingSurroundContexts({ state, params, difficulty, repeatIndex });
  }
  if (patternId === 'eliteEscort') {
    return createEliteEscortContexts({ state, params, difficulty, repeatIndex });
  }

  return createEdgeFlockContexts({ state, params, difficulty, repeatIndex });
}

function legacySpawnParamsFromWave(waveGroup) {
  return {
    side: waveGroup.side,
    count: waveGroup.count,
    laneMode: waveGroup.laneMode,
  };
}

function createEdgeFlockContexts({ state, params, difficulty, repeatIndex }) {
  const count = scaleSpawnCount(params.count, difficulty, params.scaling);
  return createSideContexts({
    state,
    side: params.side || 'left',
    count,
    laneMode: params.laneMode,
    jitter: params.jitter,
    repeatIndex,
  });
}

function createOppositePincerContexts({ state, params, difficulty, repeatIndex }) {
  const sides = normalizeSideList(params.sides, ['left', 'right']);
  const countPerSide = scaleSpawnCount(params.countPerSide ?? params.count ?? 3, difficulty, params.scaling);
  return sides.flatMap((side, sideIndex) => createSideContexts({
    state,
    side,
    count: countPerSide,
    laneMode: params.laneMode,
    jitter: params.jitter,
    repeatIndex: repeatIndex + sideIndex * 17,
  }));
}

function createRotatingSideContexts({ state, params, difficulty, repeatIndex }) {
  const sideOrder = normalizeSideList(params.sideOrder, DEFAULT_SIDE_ORDER);
  const side = sideOrder[repeatIndex % sideOrder.length];
  const count = scaleSpawnCount(params.count, difficulty, params.scaling);
  return createSideContexts({
    state,
    side,
    count,
    laneMode: params.laneMode,
    jitter: params.jitter,
    repeatIndex,
  });
}

function createStaggeredStreamContexts({ state, params, difficulty, repeatIndex }) {
  const sideOrder = normalizeSideList(params.sideOrder, params.side ? [params.side] : DEFAULT_SIDE_ORDER);
  const side = sideOrder[repeatIndex % sideOrder.length];
  const count = scaleSpawnCount(params.count, difficulty, params.scaling);
  return createSideContexts({
    state,
    side,
    count,
    laneMode: params.laneMode || 'random',
    jitter: params.jitter ?? 0.16,
    repeatIndex,
  });
}

function createCornerAmbushContexts({ state, params, difficulty, repeatIndex }) {
  const corners = Array.isArray(params.corners) && params.corners.length > 0
    ? params.corners
    : ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  const count = scaleSpawnCount(params.count, difficulty, params.scaling);
  const contexts = [];

  for (let index = 0; index < count; index += 1) {
    const corner = corners[(repeatIndex + index) % corners.length];
    const horizontalSide = corner.endsWith('Left') ? 'left' : 'right';
    const verticalSide = corner.startsWith('top') ? 'top' : 'bottom';
    const side = index % 2 === 0 ? horizontalSide : verticalSide;
    const cornerLane = (corner.endsWith('Left') || corner.startsWith('top')) ? 0.14 : 0.86;
    const jitter = seededJitter(state, repeatIndex, index, params.jitter ?? 0.08);
    contexts.push({
      side,
      laneT: clamp(cornerLane + jitter, 0.08, 0.92),
      index,
      count,
      groupIndex: repeatIndex,
      spawnPatternId: 'cornerAmbush',
    });
  }

  return contexts;
}

function createRingSurroundContexts({ state, params, difficulty, repeatIndex }) {
  const count = scaleSpawnCount(params.count, difficulty, params.scaling);
  const angleOffset = params.angleOffset ?? 0;
  const contexts = [];

  for (let index = 0; index < count; index += 1) {
    const angle = angleOffset + (Math.PI * 2 * index) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let side;
    let laneT;
    if (Math.abs(cos) >= Math.abs(sin)) {
      side = cos < 0 ? 'left' : 'right';
      laneT = (sin + 1) * 0.5;
    } else {
      side = sin < 0 ? 'top' : 'bottom';
      laneT = (cos + 1) * 0.5;
    }

    contexts.push({
      side,
      laneT: clamp(laneT, 0.08, 0.92),
      index,
      count,
      groupIndex: repeatIndex,
      spawnPatternId: 'ringSurround',
    });
  }

  return contexts;
}

function createEliteEscortContexts({ state, params, difficulty, repeatIndex }) {
  const sideOrder = normalizeSideList(params.sideOrder, params.side ? [params.side] : DEFAULT_SIDE_ORDER);
  const side = sideOrder[repeatIndex % sideOrder.length];
  const escortCount = scaleSpawnCount(params.escortCount ?? 4, difficulty, {
    countMultiplier: 1,
  });
  const contexts = [{
    side,
    laneT: 0.5,
    index: 0,
    count: 1,
    groupIndex: repeatIndex,
    enemyType: params.leaderType || 'eliteBat',
    spawnPatternId: 'eliteEscort',
  }];

  const escorts = createSideContexts({
    state,
    side,
    count: escortCount,
    laneMode: 'spread',
    jitter: 0.04,
    repeatIndex: repeatIndex + 31,
  }).map((context, index) => ({
    ...context,
    index: index + 1,
    count: escortCount + 1,
    enemyType: params.escortType || 'normalBat',
    spawnPatternId: 'eliteEscort',
  }));

  return contexts.concat(escorts);
}

function createSideContexts({ state, side, count, laneMode = 'spread', jitter = 0.08, repeatIndex = 0 }) {
  const contexts = [];
  for (let index = 0; index < count; index += 1) {
    contexts.push({
      side,
      laneT: getLaneT({ state, index, count, laneMode, jitter, repeatIndex }),
      index,
      count,
      groupIndex: repeatIndex,
      spawnPatternId: 'edgeFlock',
    });
  }
  return contexts;
}

function getLaneT({ state, index, count, laneMode, jitter, repeatIndex }) {
  if (laneMode === 'center') return 0.5;

  const seedBase = (state?.session?.nextEnemyId ?? 1) * 2654435761 + repeatIndex * 97 + index * 53;
  const jitterValue = seededJitterFromSeed(seedBase, jitter ?? 0);
  if (laneMode === 'random') {
    return clamp(hash01(seedBase + 11) * 0.84 + 0.08 + jitterValue * 0.25, 0.08, 0.92);
  }

  return clamp((index + 1) / (count + 1) + jitterValue, 0.08, 0.92);
}

function seededJitter(state, repeatIndex, index, amount) {
  const seed = (state?.session?.nextEnemyId ?? 1) * 2246822519 + repeatIndex * 131 + index * 71;
  return seededJitterFromSeed(seed, amount);
}

function seededJitterFromSeed(seed, amount) {
  return (hash01(seed) - 0.5) * Math.max(0, amount);
}

function normalizeSideList(value, fallback) {
  const sides = Array.isArray(value) && value.length > 0 ? value : fallback;
  return sides.filter((side) => ['left', 'right', 'top', 'bottom'].includes(side));
}
