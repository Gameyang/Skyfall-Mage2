import { BATTLE_FIELD_HEIGHT, BATTLE_FIELD_WIDTH } from './battlefield.js';
import { GAME_CONTENT } from './content/index.js';
import { createGameState } from './GameState.js';
import { createGameInput } from './input/createGameInput.js';
import { createGameCanvasRenderer } from './render/GameCanvasRenderer.js';
import { createRunContent } from './runContent.js';
import { updateGame, updateViewport } from './systems.js';

const GAME_OVER_RESTART_DELAY_MS = 3000;
const HIT_SHAKE_DURATION_MS = 180;
const HIT_SHAKE_MAX_OFFSET_PX = 10;

export function createGameRuntime({ canvas, materialEffects, screenEffects = null, content = GAME_CONTENT }) {
  return new GameRuntime({ canvas, materialEffects, screenEffects, content });
}

export function computeScreenShakeOffset(state) {
  if (state.session?.gameOver) {
    return { x: 0, y: 0 };
  }

  const intensity = clamp((state.session?.contactFlashMs ?? 0) / HIT_SHAKE_DURATION_MS, 0, 1);
  if (intensity <= 0) {
    return { x: 0, y: 0 };
  }

  const phase = (state.session?.elapsedMs ?? 0) * 0.18;
  return {
    x: Math.sin(phase * 2.17) * HIT_SHAKE_MAX_OFFSET_PX * intensity,
    y: Math.cos(phase * 2.89) * HIT_SHAKE_MAX_OFFSET_PX * intensity,
  };
}

class GameRuntime {
  constructor({ canvas, materialEffects, screenEffects, content }) {
    this.canvas = canvas;
    this.screenShakeElement = canvas.parentElement;
    this.materialEffects = materialEffects;
    this.screenEffects = screenEffects;
    this.baseContent = content;
    this.content = createRunContent(content);
    this.renderer = createGameCanvasRenderer({ canvas });
    this.state = createGameState({
      width: BATTLE_FIELD_WIDTH,
      height: BATTLE_FIELD_HEIGHT,
      content: this.content,
    });
    this.state.session.runSeed = this.content.runSeed ?? null;
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

    this.applyScreenShake({ x: 0, y: 0 });
    const viewport = this.renderer.resize();
    updateViewport(this.state, viewport.width, viewport.height, viewport.visible);

    const dtMs = Math.min(100, Math.max(0, now - this.lastFrameTime));
    this.lastFrameTime = now;
    updateGame(this.state, dtMs, this.content);
    this.updateAutoRestart(now, viewport);
    this.materialEffects?.emitEffects?.(this.state.frameEffects, this.state.viewport);
    this.applyScreenShake(computeScreenShakeOffset(this.state));
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
    this.applyScreenShake({ x: 0, y: 0 });
    this.renderer.destroy();
  }

  applyScreenShake(offset) {
    if (!this.screenShakeElement?.style) return;

    this.screenShakeElement.style.setProperty('--screen-shake-x', `${offset.x.toFixed(2)}px`);
    this.screenShakeElement.style.setProperty('--screen-shake-y', `${offset.y.toFixed(2)}px`);
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
    this.content = createRunContent(this.baseContent);
    const nextState = createGameState({
      width: viewport.width,
      height: viewport.height,
      content: this.content,
    });
    nextState.session.runSeed = this.content.runSeed ?? null;
    Object.assign(this.state, nextState);
    updateViewport(this.state, viewport.width, viewport.height, viewport.visible);
    this.gameOverStartedAt = null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
