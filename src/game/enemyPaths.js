import { clamp, hash01, normalize } from './math.js';

export const SPAWN_SIDES = Object.freeze(['left', 'right', 'top', 'bottom']);

export function createSCurvePath({ side, viewport, radius, laneT, amplitude, frequency, phase, margin = 44 }) {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const edgeOffset = margin + radius;
  const t = clamp(laneT, 0.08, 0.92);

  let origin;
  let exitTarget;
  let direction;
  let perpendicular;

  if (side === 'right') {
    origin = { x: width + edgeOffset, y: height * t };
    exitTarget = { x: -edgeOffset, y: height * t };
    direction = { x: -1, y: 0 };
    perpendicular = { x: 0, y: 1 };
  } else if (side === 'top') {
    origin = { x: width * t, y: -edgeOffset };
    exitTarget = { x: width * t, y: height + edgeOffset };
    direction = { x: 0, y: 1 };
    perpendicular = { x: 1, y: 0 };
  } else if (side === 'bottom') {
    origin = { x: width * t, y: height + edgeOffset };
    exitTarget = { x: width * t, y: -edgeOffset };
    direction = { x: 0, y: -1 };
    perpendicular = { x: 1, y: 0 };
  } else {
    origin = { x: -edgeOffset, y: height * t };
    exitTarget = { x: width + edgeOffset, y: height * t };
    direction = { x: 1, y: 0 };
    perpendicular = { x: 0, y: 1 };
  }

  return {
    side,
    origin,
    exitTarget,
    direction,
    perpendicular,
    travelDistance: Math.hypot(exitTarget.x - origin.x, exitTarget.y - origin.y),
    amplitude,
    frequency,
    phase,
  };
}

export function sampleSCurvePath(path, progress) {
  const travelDistance = Math.max(1, path.travelDistance);
  const t = clamp(progress / travelDistance, 0, 1);
  const wave = Math.sin(t * Math.PI * path.frequency + path.phase) * path.amplitude;

  return {
    x: path.origin.x + path.direction.x * progress + path.perpendicular.x * wave,
    y: path.origin.y + path.direction.y * progress + path.perpendicular.y * wave,
  };
}

export function sampleZigzagPath(path, progress) {
  const travelDistance = Math.max(1, path.travelDistance);
  const t = clamp(progress / travelDistance, 0, 1);
  const cycle = positiveModulo(t * path.frequency + path.phase / (Math.PI * 2), 1);
  const triangle = cycle < 0.5 ? cycle * 4 - 1 : 3 - cycle * 4;
  const sharpness = clamp(path.sharpness ?? 0.82, 0.1, 1);
  const wave = Math.sign(triangle) * (Math.abs(triangle) ** sharpness) * path.amplitude;

  return {
    x: path.origin.x + path.direction.x * progress + path.perpendicular.x * wave,
    y: path.origin.y + path.direction.y * progress + path.perpendicular.y * wave,
  };
}

export function sampleSpiralPath(path, progress) {
  const travelDistance = Math.max(1, path.travelDistance);
  const t = clamp(progress / travelDistance, 0, 1);
  const radius = path.startRadius * (1 - t);
  const angle = path.startAngle + t * (Math.PI * 2 * path.turns + path.phase);

  return {
    x: path.center.x + Math.cos(angle) * radius,
    y: path.center.y + Math.sin(angle) * radius,
  };
}

export function createEnemyFromSpawnContext({
  state,
  waveGroup,
  definition,
  spawnContext,
  groupIndex = 0,
} = {}) {
  const radius = definition.radius;
  const pathConfig = definition.path || {};
  const pathPatternId = waveGroup.pathPatternId
    || definition.defaultPathPatternId
    || (waveGroup.pattern ? 'sCurve' : 'sCurve');
  const pathParams = {
    ...pathConfig,
    ...(waveGroup.pattern || {}),
    ...(waveGroup.pathParams || {}),
  };
  const side = spawnContext.side || waveGroup.side || 'left';
  const count = Math.max(1, spawnContext.count || waveGroup.count || 1);
  const laneT = clamp(spawnContext.laneT ?? (spawnContext.index + 1) / (count + 1), 0.08, 0.92);
  const phase = pathParams.phase ?? hash01((state.session.nextEnemyId + 3) * 2246822519 + groupIndex * 31) * Math.PI * 2;
  const path = createPath({
    state,
    definition,
    side,
    laneT,
    radius,
    pathPatternId,
    pathParams,
    phase,
  });
  const position = samplePath(path, 0);
  path.x = position.x;
  path.y = position.y;
  if (!path.velocity) {
    path.velocity = {
      x: path.direction.x,
      y: path.direction.y,
    };
  }

  const id = state.session.nextEnemyId;
  state.session.nextEnemyId += 1;

  return {
    id,
    type: definition.id,
    spawnSide: side,
    pathPatternId,
    pathState: path,
    origin: path.origin,
    exitTarget: path.exitTarget,
    direction: path.direction,
    perpendicular: path.perpendicular,
    travelDistance: path.travelDistance,
    progress: 0,
    speed: definition.speed,
    spriteUrl: definition.spriteUrl ?? null,
    spriteSize: definition.spriteSize ?? radius * 2.8,
    amplitude: path.amplitude ?? 0,
    frequency: path.frequency ?? 0,
    phase,
    hp: definition.hp,
    maxHp: definition.hp,
    radius,
    contactDamage: definition.contactDamage,
    x: position.x,
    y: position.y,
  };
}

export function createEnemyFromWave({ state, wave, definition, index, groupIndex = 0 }) {
  const side = wave.side || 'left';
  const count = Math.max(1, wave.count || 1);
  const laneJitter = (hash01((state.session.nextEnemyId + 1) * 2654435761 + groupIndex * 97) - 0.5) * 0.08;
  const laneT = clamp((index + 1) / (count + 1) + laneJitter, 0.1, 0.9);

  return createEnemyFromSpawnContext({
    state,
    waveGroup: wave,
    definition,
    spawnContext: {
      side,
      laneT,
      index,
      count,
      groupIndex,
    },
    groupIndex,
  });
}

export function createPath({ state, definition, side, laneT, radius, pathPatternId, pathParams, phase }) {
  if (pathPatternId === 'spiralIn') {
    return createSpiralPath({
      state,
      definition,
      side,
      laneT,
      radius,
      pathParams,
      phase,
    });
  }

  const amplitude = pathPatternId === 'straight'
    ? 0
    : pathParams.amplitude ?? definition.path?.amplitude ?? 56;
  const frequency = pathPatternId === 'straight'
    ? 1
    : pathParams.frequency ?? definition.path?.frequency ?? 2;
  const margin = pathParams.margin ?? definition.path?.margin ?? 44;
  const path = createSCurvePath({
    side,
    viewport: state.viewport,
    radius,
    laneT,
    amplitude,
    frequency,
    phase,
    margin,
  });

  return {
    ...path,
    pathPatternId,
    sharpness: pathParams.sharpness,
    turnRate: pathParams.turnRate,
    dashMs: pathParams.dashMs,
    pauseMs: pathParams.pauseMs,
    motionProgress: 0,
  };
}

export function samplePath(path, progress) {
  if (path.pathPatternId === 'zigzag') {
    return sampleZigzagPath(path, progress);
  }
  if (path.pathPatternId === 'spiralIn') {
    return sampleSpiralPath(path, progress);
  }
  return sampleSCurvePath(path, progress);
}

export function updateEnemyPathPosition(enemy, state, dtMs = 0) {
  const path = enemy.pathState || enemy;
  if (!path.origin || !path.direction || !path.perpendicular) return;

  if (path.pathPatternId === 'homingSoft') {
    updateHomingSoftPath(enemy, path, state, dtMs);
    return;
  }

  if (path.pathPatternId === 'dashPause') {
    updateDashPausePath(enemy, path, dtMs);
    return;
  }

  const position = samplePath(path, enemy.progress);
  enemy.x = position.x;
  enemy.y = position.y;
}

export function hasEnemyReachedExit(enemy) {
  return enemy.progress >= enemy.travelDistance;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function createSpiralPath({ state, definition, side, laneT, radius, pathParams, phase }) {
  const basePath = createSCurvePath({
    side,
    viewport: state.viewport,
    radius,
    laneT,
    amplitude: 0,
    frequency: 1,
    phase,
    margin: pathParams.margin ?? definition.path?.margin ?? 44,
  });
  const center = {
    x: state.viewport.width * 0.5,
    y: state.viewport.height * 0.5,
  };
  const startRadius = Math.max(1, Math.hypot(basePath.origin.x - center.x, basePath.origin.y - center.y));
  const startAngle = Math.atan2(basePath.origin.y - center.y, basePath.origin.x - center.x);
  const originDirection = normalize(center.x - basePath.origin.x, center.y - basePath.origin.y);

  return {
    ...basePath,
    pathPatternId: 'spiralIn',
    center,
    startRadius,
    startAngle,
    turns: pathParams.turns ?? 1.35,
    exitTarget: center,
    direction: originDirection,
    perpendicular: {
      x: -originDirection.y,
      y: originDirection.x,
    },
    travelDistance: startRadius,
  };
}

function updateHomingSoftPath(enemy, path, state, dtMs) {
  if (!state?.player) {
    const position = samplePath(path, enemy.progress);
    enemy.x = position.x;
    enemy.y = position.y;
    return;
  }

  const dt = Math.max(0, dtMs) / 1000;
  const desired = normalize(state.player.x - path.x, state.player.y - path.y);
  const steer = clamp((path.turnRate ?? 2.2) * dt, 0, 1);
  const nextVelocity = normalize(
    path.velocity.x * (1 - steer) + desired.x * steer,
    path.velocity.y * (1 - steer) + desired.y * steer,
  );
  path.velocity = nextVelocity;
  path.x += nextVelocity.x * (enemy.speed || 0) * dt;
  path.y += nextVelocity.y * (enemy.speed || 0) * dt;
  enemy.x = path.x;
  enemy.y = path.y;
}

function updateDashPausePath(enemy, path, dtMs) {
  const dashMs = Math.max(1, path.dashMs ?? 520);
  const pauseMs = Math.max(0, path.pauseMs ?? 360);
  const cycleMs = dashMs + pauseMs;
  path.elapsedMs = (path.elapsedMs || 0) + Math.max(0, dtMs);
  const active = positiveModulo(path.elapsedMs, cycleMs) < dashMs;
  if (active) {
    path.motionProgress = Math.min(
      path.travelDistance,
      (path.motionProgress || 0) + (enemy.speed || 0) * (Math.max(0, dtMs) / 1000),
    );
  }

  enemy.progress = path.motionProgress || 0;
  const position = samplePath(path, enemy.progress);
  enemy.x = position.x;
  enemy.y = position.y;
}
