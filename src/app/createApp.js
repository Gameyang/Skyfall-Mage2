import { createMaterialFieldApp } from '../features/material-field/MaterialFieldApp.js';
import { createGameRuntime } from '../game/GameRuntime.js';
import { createNightSkyRenderer } from '../rendering/webgl/NightSkyRenderer.js';
import { APP_TITLE } from './config.js';

function createFatalMessage() {
  const fatal = document.createElement('div');
  fatal.id = 'fatal';
  fatal.className = 'fatal';
  fatal.setAttribute('role', 'alert');

  const panel = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'WebGPU material effects disabled';

  const detail = document.createElement('span');
  detail.textContent = 'The battle can continue without the compute shader material layer.';

  panel.append(title, detail);
  fatal.append(panel);
  return fatal;
}

export function createApp({ root }) {
  document.title = APP_TITLE;
  root.replaceChildren();

  const shell = document.createElement('main');
  shell.className = 'app-shell';

  const skyCanvas = document.createElement('canvas');
  skyCanvas.id = 'skyCanvas';
  skyCanvas.className = 'sky-canvas';
  skyCanvas.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.id = 'fieldCanvas';
  canvas.className = 'material-canvas';
  canvas.setAttribute('aria-label', 'WebGPU material effects');

  const gameCanvas = document.createElement('canvas');
  gameCanvas.id = 'gameCanvas';
  gameCanvas.className = 'game-canvas';
  gameCanvas.setAttribute('aria-label', 'Skyfall Mage2 battle');

  const fatal = createFatalMessage();
  shell.append(skyCanvas, canvas, gameCanvas, fatal);
  root.append(shell);

  const skyRenderer = createNightSkyRenderer({
    canvas: skyCanvas,
  });
  const materialFieldApp = createMaterialFieldApp({
    canvas,
  });
  const gameRuntime = createGameRuntime({
    canvas: gameCanvas,
    materialEffects: materialFieldApp,
  });

  return {
    start() {
      skyRenderer.start();
      materialFieldApp.start();
      gameRuntime.start();
    },
    destroy() {
      gameRuntime.destroy();
      materialFieldApp.destroy();
      skyRenderer.destroy();
      root.replaceChildren();
    },
    getDebugState() {
      return gameRuntime.state;
    },
  };
}
