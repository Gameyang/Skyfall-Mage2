import { GRID_HEIGHT, GRID_WIDTH } from './config.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function mapEffectToGrid(effect, viewport, grid = { width: GRID_WIDTH, height: GRID_HEIGHT }) {
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const gridWidth = Math.max(1, grid.width);
  const gridHeight = Math.max(1, grid.height);
  const gridX = Math.round((effect.x / viewportWidth) * (gridWidth - 1));
  const gridY = Math.round((effect.y / viewportHeight) * (gridHeight - 1));
  const radiusScale = Math.max(gridWidth / viewportWidth, gridHeight / viewportHeight);

  return {
    x: clamp(gridX, 0, gridWidth - 1),
    y: clamp(gridY, 0, gridHeight - 1),
    radius: Math.max(2, Math.round((effect.radius || 0) * radiusScale)),
  };
}
