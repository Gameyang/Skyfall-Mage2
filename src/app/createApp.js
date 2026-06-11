import { createMaterialFieldApp } from '../features/material-field/MaterialFieldApp.js';
import gameOverScreenUrl from '../assets/generated/game-over-screen.webp?url';
import titleScreenUrl from '../assets/generated/title-screen.webp?url';
import { GAME_CONTENT } from '../game/content/index.js';
import { createGameRuntime } from '../game/GameRuntime.js';
import { createNightSkyRenderer } from '../rendering/webgl/NightSkyRenderer.js';
import { createScreenEffectsRenderer } from '../rendering/webgl/ScreenEffectsRenderer.js';
import { APP_TITLE } from './config.js';

const LOADING_STEPS = Object.freeze({
  resources: 'resources',
  shaders: 'shaders',
});

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

function createTitleOverlay() {
  const overlay = document.createElement('section');
  overlay.className = 'title-overlay';
  overlay.setAttribute('aria-live', 'polite');

  const panel = document.createElement('div');
  panel.className = 'title-panel';

  const art = document.createElement('img');
  art.className = 'title-art';
  art.src = titleScreenUrl;
  art.alt = APP_TITLE;
  art.decoding = 'async';
  art.draggable = false;

  const completedSteps = new Set();
  const loadingBar = document.createElement('div');
  loadingBar.className = 'title-loading-bar';
  loadingBar.setAttribute('role', 'progressbar');
  loadingBar.setAttribute('aria-label', 'Loading');
  loadingBar.setAttribute('aria-valuemin', '0');
  loadingBar.setAttribute('aria-valuemax', '100');
  loadingBar.setAttribute('aria-valuenow', '0');

  const loadingBarFill = document.createElement('span');
  loadingBarFill.className = 'title-loading-bar-fill';
  loadingBar.append(loadingBarFill);

  const prompt = document.createElement('div');
  prompt.className = 'title-prompt';
  prompt.textContent = 'Press Any Key';
  prompt.hidden = true;
  let ready = false;

  panel.append(art, loadingBar, prompt);
  overlay.append(panel);

  return {
    element: overlay,
    setStepStatus(step, status) {
      if (status.toLowerCase() === 'ready') {
        completedSteps.add(step);
      } else {
        completedSteps.delete(step);
      }

      const progress = Math.round((completedSteps.size / Object.keys(LOADING_STEPS).length) * 100);
      loadingBar.setAttribute('aria-valuenow', String(progress));
      loadingBarFill.style.transform = `scaleX(${progress / 100})`;
    },
    showReady() {
      ready = true;
      loadingBar.hidden = true;
      prompt.hidden = false;
      overlay.classList.add('is-ready');
      prompt.classList.add('is-ready');
    },
    showError(message) {
      ready = false;
      loadingBar.hidden = true;
      prompt.textContent = message;
      prompt.hidden = false;
      overlay.classList.remove('is-ready');
      prompt.classList.add('is-error');
    },
    waitForActivation() {
      return new Promise((resolve) => {
        const activate = (event) => {
          if (!ready) return;
          event?.preventDefault?.();
          cleanup();
          resolve();
        };
        const cleanup = () => {
          overlay.removeEventListener('pointerdown', activate);
          window.removeEventListener('keydown', activate);
        };

        overlay.addEventListener('pointerdown', activate);
        window.addEventListener('keydown', activate);
      });
    },
    hide() {
      overlay.hidden = true;
    },
  };
}

function preloadImages(urls) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  return Promise.all(uniqueUrls.map(preloadImage));
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      resolve();
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
    image.src = url;
  });
}

function collectGameResourceUrls(content, state) {
  const enemySpriteUrls = Object.values(content.enemies || {}).map((enemy) => enemy.spriteUrl);
  const itemSpriteUrls = Object.values(content.items || {}).map((item) => item.spriteUrl);
  return [
    titleScreenUrl,
    gameOverScreenUrl,
    state.player?.spriteUrl,
    ...enemySpriteUrls,
    ...itemSpriteUrls,
  ];
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

  const screenEffectsCanvas = document.createElement('canvas');
  screenEffectsCanvas.id = 'screenEffectsCanvas';
  screenEffectsCanvas.className = 'screen-effects-canvas';
  screenEffectsCanvas.setAttribute('aria-hidden', 'true');

  const fatal = createFatalMessage();
  const titleOverlay = createTitleOverlay();
  shell.append(skyCanvas, canvas, gameCanvas, screenEffectsCanvas, fatal, titleOverlay.element);
  root.append(shell);

  const skyRenderer = createNightSkyRenderer({
    canvas: skyCanvas,
  });
  const materialFieldApp = createMaterialFieldApp({
    canvas,
  });
  const screenEffectsRenderer = createScreenEffectsRenderer({
    canvas: screenEffectsCanvas,
  });
  const gameRuntime = createGameRuntime({
    canvas: gameCanvas,
    materialEffects: materialFieldApp,
    screenEffects: screenEffectsRenderer,
    content: GAME_CONTENT,
  });
  let startPromise = null;

  return {
    start() {
      if (startPromise) return startPromise;

      skyRenderer.start();
      titleOverlay.setStepStatus(LOADING_STEPS.resources, 'Loading');
      titleOverlay.setStepStatus(LOADING_STEPS.shaders, 'Loading');

      const resourcePromise = preloadImages(collectGameResourceUrls(GAME_CONTENT, gameRuntime.state))
        .then(() => titleOverlay.setStepStatus(LOADING_STEPS.resources, 'Ready'));
      const shaderPromise = materialFieldApp.start()
        .then(() => titleOverlay.setStepStatus(LOADING_STEPS.shaders, 'Ready'));

      startPromise = Promise.all([resourcePromise, shaderPromise])
        .then(async () => {
          titleOverlay.showReady();
          await titleOverlay.waitForActivation();
          titleOverlay.hide();
          gameRuntime.start();
        })
        .catch((error) => {
          titleOverlay.showError('Loading Failed');
          throw error;
        });

      return startPromise;
    },
    destroy() {
      gameRuntime.destroy();
      screenEffectsRenderer.destroy();
      materialFieldApp.destroy();
      skyRenderer.destroy();
      root.replaceChildren();
    },
    getDebugState() {
      return gameRuntime.state;
    },
  };
}
