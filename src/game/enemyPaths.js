import { clamp, hash01 } from './math.js';

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

export function createEnemyFromWave({ state, wave, definition, index, groupIndex = 0 }) {
  const radius = definition.radius;
  const pathConfig = definition.path || {};
  const side = wave.side || 'left';
  const count = Math.max(1, wave.count || 1);
  const laneJitter = (hash01((state.session.nextEnemyId + 1) * 2654435761 + groupIndex * 97) - 0.5) * 0.08;
  const laneT = clamp((index + 1) / (count + 1) + laneJitter, 0.1, 0.9);
  const phase = hash01((state.session.nextEnemyId + 3) * 2246822519) * Math.PI * 2;
  const amplitude = wave.pattern?.amplitude ?? pathConfig.amplitude ?? 56;
  const frequency = wave.pattern?.frequency ?? pathConfig.frequency ?? 2;
  const margin = pathConfig.margin ?? 44;
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
  const position = sampleSCurvePath(path, 0);

  const id = state.session.nextEnemyId;
  state.session.nextEnemyId += 1;

  return {
    id,
    type: definition.id,
    spawnSide: side,
    origin: path.origin,
    exitTarget: path.exitTarget,
    direction: path.direction,
    perpendicular: path.perpendicular,
    travelDistance: path.travelDistance,
    progress: 0,
    speed: definition.speed,
    amplitude,
    frequency,
    phase,
    hp: definition.hp,
    maxHp: definition.hp,
    radius,
    contactDamage: definition.contactDamage,
    x: position.x,
    y: position.y,
  };
}

export function updateEnemyPathPosition(enemy) {
  if (!enemy.origin || !enemy.direction || !enemy.perpendicular) return;

  const position = sampleSCurvePath(enemy, enemy.progress);
  enemy.x = position.x;
  enemy.y = position.y;
}

export function hasEnemyReachedExit(enemy) {
  return enemy.progress >= enemy.travelDistance;
}
