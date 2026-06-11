import { GAME_CONTENT } from './content/index.js';
import { createGameState } from './GameState.js';
import { createGameInput } from './input/createGameInput.js';
import { createGameCanvasRenderer } from './render/GameCanvasRenderer.js';
import { updateGame, updateViewport } from './systems.js';

const GAME_OVER_RESTART_DELAY_MS = 3000;

export function createGameRuntime({ canvas, materialEffects, screenEffects = null, content = GAME_CONTENT }) {
  return new GameRuntime({ canvas, materialEffects, screenEffects, content });
}

class GameRuntime {
  constructor({ canvas, materialEffects, screenEffects, content }) {
    this.canvas = canvas;
    this.materialEffects = materialEffects;
    this.screenEffects = screenEffects;
    this.content = content;
    this.renderer = createGameCanvasRenderer({ canvas });
    const initialWidth = Math.max(1, Math.floor(canvas.getBoundingClientRect().width || window.innerWidth));
    const initialHeight = Math.max(1, Math.floor(canvas.getBoundingClientRect().height || window.innerHeight));
    this.state = createGameState({ width: initialWidth, height: initialHeight, content });
    this.input = createGameInput({ canvas, state: this.state });
    this.animationFrameId = 0;
    this.lastFrameTime = 0;
    this.gameOverStartedAt = null;
    this.destroyed = false;
    this.renderFrame = this.renderFrame.bind(this);
  }

  start() {
    if (this.animationFrameId) return;

    const viewport = this.renderer.resize();
    updateViewport(this.state, viewport.width, viewport.height, viewport.visible);
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.renderFrame);
  }

  renderFrame(now) {
    if (this.destroyed) return;

    const viewport = this.renderer.resize();
    updateViewport(this.state, viewport.width, viewport.height, viewport.visible);

    const dtMs = Math.min(100, Math.max(0, now - this.lastFrameTime));
    this.lastFrameTime = now;
    updateGame(this.state, dtMs, this.content);
    this.updateAutoRestart(now, viewport);
    this.materialEffects?.emitEffects?.(this.state.frameEffects, this.state.viewport);
    this.renderer.render(this.state);
    this.screenEffects?.render?.(this.state, now);

    this.animationFrameId = requestAnimationFrame(this.renderFrame);
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    this.input.destroy();
    this.renderer.destroy();
  }

  updateAutoRestart(now, viewport) {
    if (!this.state.session.gameOver) {
      this.gameOverStartedAt = null;
      this.state.session.autoRestartRemainingMs = null;
      return;
    }

    if (this.gameOverStartedAt === null) {
      this.gameOverStartedAt = now;
    }

    const remainingMs = Math.max(0, GAME_OVER_RESTART_DELAY_MS - (now - this.gameOverStartedAt));
    this.state.session.autoRestartRemainingMs = remainingMs;
    if (remainingMs > 0) return;

    this.restart(viewport);
  }

  restart(viewport) {
    const nextState = createGameState({
      width: viewport.width,
      height: viewport.height,
      content: this.content,
    });
    Object.assign(this.state, nextState);
    updateViewport(this.state, viewport.width, viewport.height, viewport.visible);
    this.gameOverStartedAt = null;
  }
}
