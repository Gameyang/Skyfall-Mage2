import { createMaterialFieldApp } from '../features/material-field/MaterialFieldApp.js';
import { APP_TITLE } from './config.js';

function createFatalMessage() {
  const fatal = document.createElement('div');
  fatal.id = 'fatal';
  fatal.className = 'fatal';
  fatal.setAttribute('role', 'alert');

  const panel = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'WebGPU is required';

  const detail = document.createElement('span');
  detail.textContent = 'This page intentionally has no CPU, Canvas2D, or WebGL fallback.';

  panel.append(title, detail);
  fatal.append(panel);
  return fatal;
}

export function createApp({ root }) {
  document.title = APP_TITLE;
  root.replaceChildren();

  const shell = document.createElement('main');
  shell.className = 'app-shell';

  const canvas = document.createElement('canvas');
  canvas.id = 'fieldCanvas';
  canvas.setAttribute('aria-label', 'WebGPU material field');

  const materialHub = document.createElement('nav');
  materialHub.id = 'materialHub';
  materialHub.className = 'material-hub';
  materialHub.setAttribute('aria-label', 'Material brush slots');

  const fatal = createFatalMessage();
  shell.append(canvas, materialHub, fatal);
  root.append(shell);

  const materialFieldApp = createMaterialFieldApp({
    canvas,
    fatal,
    materialHub,
  });

  return {
    start() {
      materialFieldApp.start();
    },
    destroy() {
      materialFieldApp.destroy();
      root.replaceChildren();
    },
  };
}
