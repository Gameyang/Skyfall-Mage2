export function createGameCanvasRenderer({ canvas }) {
  return new GameCanvasRenderer({ canvas });
}

class GameCanvasRenderer {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true });
    this.spriteCache = new Map();
    if (!this.context) {
      throw new Error('The game canvas could not create a 2D context.');
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const cssHeight = Math.max(1, Math.floor(rect.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
      width: cssWidth,
      height: cssHeight,
      dpr,
      visible: getVisibleCanvasArea(this.canvas, rect, cssWidth, cssHeight),
    };
  }

  render(state) {
    const ctx = this.context;
    const { width, height } = state.viewport;
    ctx.clearRect(0, 0, width, height);

    drawProjectiles(ctx, state);
    drawEnemies(ctx, state, this);
    drawPlayer(ctx, state, this);
    drawHud(ctx, state);

    if (state.session.gameOver) {
      drawGameOver(ctx, width, height);
    }
  }

  destroy() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.spriteCache.clear();
  }

  getSprite(url) {
    if (!url || typeof Image === 'undefined') return null;

    const cached = this.spriteCache.get(url);
    if (cached) {
      return cached.loaded && !cached.failed ? cached.image : null;
    }

    const image = new Image();
    const next = {
      image,
      loaded: false,
      failed: false,
    };
    image.decoding = 'async';
    image.onload = () => {
      next.loaded = true;
    };
    image.onerror = () => {
      next.failed = true;
    };
    image.src = url;
    this.spriteCache.set(url, next);

    return null;
  }
}

function drawProjectiles(ctx, state) {
  for (const projectile of state.entities.projectiles) {
    const visual = projectile.visual || {};
    const energyRatio = projectile.energy
      ? Math.max(0, Math.min(1, projectile.energy.current / Math.max(1, projectile.energy.max)))
      : 1;
    const corePulse = 1 + energyRatio * 0.28;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, projectile.radius * (4.8 + energyRatio * 2.2));
    glow.addColorStop(0, visual.glowColor || 'rgba(255, 110, 28, 0.75)');
    glow.addColorStop(1, 'rgba(255, 110, 28, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius * (4.8 + energyRatio * 2.2), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = visual.color || '#ff8a2a';
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius * 1.35 * corePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = visual.coreColor || '#fff0a6';
    ctx.beginPath();
    ctx.arc(-projectile.vx * 0.002, -projectile.vy * 0.002, projectile.radius * 0.58 * corePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies(ctx, state, renderer) {
  const time = state.session.elapsedMs;
  for (const enemy of state.entities.enemies) {
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    const sprite = renderer.getSprite(enemy.spriteUrl);

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (sprite) {
      drawPixelSprite(ctx, sprite, enemy.spriteSize ?? enemy.radius * 2.8);
    } else {
      const angle = Math.atan2(enemy.direction.y, enemy.direction.x);
      const flap = Math.sin(time * 0.013 + enemy.phase) * 0.25;
      drawBatFallback(ctx, enemy, angle, flap);
    }

    ctx.restore();

    if (hpRatio < 1) {
      drawSmallBar(ctx, enemy.x - 16, enemy.y - enemy.radius - 10, 32, 4, hpRatio, '#ff5877');
    }
  }
}

function drawPlayer(ctx, state, renderer) {
  const player = state.player;
  const damaged = state.session.contactFlashMs > 0;
  const sprite = renderer.getSprite(player.spriteUrl);

  ctx.save();
  ctx.translate(player.x, player.y);

  if (sprite) {
    drawPixelSprite(ctx, sprite, player.spriteSize ?? player.radius * 3.4);
    ctx.restore();
    return;
  }

  ctx.fillStyle = damaged ? '#ffd4dc' : '#eaf8ff';
  ctx.strokeStyle = damaged ? '#ff4966' : '#5ed8ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#29384b';
  ctx.beginPath();
  ctx.moveTo(0, -player.radius - 12);
  ctx.lineTo(player.radius * 0.85, -player.radius * 0.05);
  ctx.lineTo(-player.radius * 0.85, -player.radius * 0.05);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffb84d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.radius * 0.55, player.radius * 0.65);
  ctx.lineTo(player.radius * 1.1, player.radius * 1.45);
  ctx.stroke();

  ctx.restore();
}

function drawBatFallback(ctx, enemy, angle, flap) {
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(20, 13, 26, 0.92)';
  ctx.strokeStyle = 'rgba(197, 120, 255, 0.58)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-enemy.radius * 0.2, 0);
  ctx.bezierCurveTo(-enemy.radius * 1.3, -enemy.radius * (0.9 + flap), -enemy.radius * 1.8, enemy.radius * 0.15, -enemy.radius * 0.48, enemy.radius * 0.42);
  ctx.bezierCurveTo(-enemy.radius * 0.25, enemy.radius * 0.68, enemy.radius * 0.25, enemy.radius * 0.68, enemy.radius * 0.48, enemy.radius * 0.42);
  ctx.bezierCurveTo(enemy.radius * 1.8, enemy.radius * 0.15, enemy.radius * 1.3, -enemy.radius * (0.9 - flap), enemy.radius * 0.2, 0);
  ctx.bezierCurveTo(enemy.radius * 0.16, -enemy.radius * 0.42, -enemy.radius * 0.16, -enemy.radius * 0.42, -enemy.radius * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ff4c86';
  ctx.beginPath();
  ctx.arc(enemy.radius * 0.25, -enemy.radius * 0.12, 2.2, 0, Math.PI * 2);
  ctx.arc(-enemy.radius * 0.25, -enemy.radius * 0.12, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixelSprite(ctx, image, size) {
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -size * 0.5, -size * 0.5, size, size);
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function drawHud(ctx, state) {
  const visible = state.viewport.visible || {
    x: 0,
    y: 0,
    width: state.viewport.width,
    height: state.viewport.height,
  };
  const pad = 16;
  const x = visible.x + pad;
  const y = visible.y + pad;
  const barWidth = Math.min(260, Math.max(160, visible.width * 0.34));
  drawSmallBar(ctx, x, y, barWidth, 12, state.player.hp / state.player.maxHp, '#38d996', 'rgba(3, 9, 12, 0.72)');

  ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(236, 246, 255, 0.92)';
  ctx.textBaseline = 'top';
  ctx.fillText(`HP ${Math.ceil(state.player.hp)}/${state.player.maxHp}`, x, y + 18);
  ctx.fillText(`Kills ${state.session.score}`, x, y + 38);
  ctx.fillText(`Threats ${state.entities.enemies.length}`, x, y + 58);
}

function drawSmallBar(ctx, x, y, width, height, ratio, color, background = 'rgba(0, 0, 0, 0.46)') {
  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height);
  ctx.strokeStyle = 'rgba(230, 246, 255, 0.46)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawGameOver(ctx, width, height) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f4fbff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Game Over', width * 0.5, height * 0.5 - 12);
  ctx.font = '500 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(244, 251, 255, 0.78)';
  ctx.fillText('Refresh to restart', width * 0.5, height * 0.5 + 26);
  ctx.textAlign = 'start';
}

function getVisibleCanvasArea(canvas, rect, width, height) {
  const clipRect = canvas.parentElement?.getBoundingClientRect();
  const clipLeft = clipRect?.left ?? 0;
  const clipTop = clipRect?.top ?? 0;
  const clipRight = clipRect?.right ?? window.innerWidth;
  const clipBottom = clipRect?.bottom ?? window.innerHeight;

  const left = clamp(clipLeft - rect.left, 0, width);
  const top = clamp(clipTop - rect.top, 0, height);
  const right = clamp(clipRight - rect.left, left, width);
  const bottom = clamp(clipBottom - rect.top, top, height);

  return {
    x: Math.floor(left),
    y: Math.floor(top),
    width: Math.max(1, Math.ceil(right - left)),
    height: Math.max(1, Math.ceil(bottom - top)),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
