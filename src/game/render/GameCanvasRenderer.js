import hudPanelUrl from '../../assets/generated/hud-panel.png?url';

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
    this.getSprite(hudPanelUrl);
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
    drawHud(ctx, state, this);

    if (state.session.gameOver) {
      drawGameOver(ctx, width, height, state);
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

function drawHud(ctx, state, renderer) {
  const visible = state.viewport.visible || {
    x: 0,
    y: 0,
    width: state.viewport.width,
    height: state.viewport.height,
  };
  const pad = 12;
  const x = visible.x + pad;
  const y = visible.y + pad;
  const panelWidth = Math.min(360, Math.max(284, visible.width - pad * 2));
  const panelImage = renderer.getSprite(hudPanelUrl);
  const panelRatio = panelImage ? panelImage.height / Math.max(1, panelImage.width) : 0.405;
  const panelHeight = Math.round(panelWidth * panelRatio);

  drawHudPanel(ctx, panelImage, x, y, panelWidth, panelHeight);

  const contentX = x + Math.max(28, Math.round(panelWidth * 0.105));
  const contentY = y + Math.max(26, Math.round(panelHeight * 0.21));
  const contentWidth = panelWidth - (contentX - x) - Math.max(24, Math.round(panelWidth * 0.08));
  const hpRatio = state.player.hp / state.player.maxHp;

  ctx.font = '700 12px "Courier New", monospace';
  ctx.fillStyle = '#f4fbff';
  ctx.textBaseline = 'top';
  ctx.fillText(`HP ${Math.ceil(state.player.hp)}/${state.player.maxHp}`, contentX, contentY);
  drawHudBar(ctx, contentX, contentY + 18, contentWidth, 12, hpRatio);

  const statY = contentY + 40;
  const statGap = Math.min(24, Math.max(12, Math.round(contentWidth * 0.08)));
  const statWidth = Math.floor((contentWidth - statGap) * 0.5);
  drawHudCounter(ctx, contentX, statY, statWidth, 'KILLS', state.session.score, '#ffd66b');
  drawHudCounter(ctx, contentX + statWidth + statGap, statY, statWidth, 'THREAT', state.entities.enemies.length, '#ff6f8a');
}

function drawHudPanel(ctx, image, x, y, width, height) {
  if (image) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, x, y, width, height);
    ctx.imageSmoothingEnabled = previousSmoothing;
    return;
  }

  ctx.fillStyle = 'rgba(6, 9, 15, 0.82)';
  ctx.fillRect(x + 12, y + 10, width - 24, height - 20);
  ctx.strokeStyle = '#394656';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 12.5, y + 10.5, width - 25, height - 21);
  ctx.strokeStyle = '#81222d';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 18.5, y + 16.5, width - 37, height - 33);
  ctx.fillStyle = '#35dfff';
  ctx.fillRect(x + width * 0.5 - 3, y + 7, 6, 12);
}

function drawHudBar(ctx, x, y, width, height, ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = 'rgba(2, 4, 8, 0.72)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#17322b';
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
  ctx.fillStyle = clamped < 0.28 ? '#ff5877' : '#38d996';
  ctx.fillRect(x + 2, y + 2, Math.max(0, (width - 4) * clamped), height - 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(x + 2, y + 2, Math.max(0, (width - 4) * clamped), 2);
  ctx.strokeStyle = 'rgba(228, 244, 255, 0.48)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawHudCounter(ctx, x, y, width, label, value, accent) {
  ctx.fillStyle = 'rgba(3, 7, 12, 0.58)';
  ctx.fillRect(x, y, width, 28);
  ctx.strokeStyle = 'rgba(160, 182, 205, 0.32)';
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 27);

  ctx.fillStyle = accent;
  ctx.fillRect(x + 6, y + 9, 5, 5);
  ctx.fillStyle = 'rgba(178, 198, 222, 0.82)';
  ctx.font = '700 9px "Courier New", monospace';
  ctx.fillText(label, x + 16, y + 5);
  ctx.fillStyle = '#f8fbff';
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillText(String(value), x + 16, y + 16);
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

function drawGameOver(ctx, width, height, state) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, width, height);

  const remainingMs = Math.max(0, state.session.autoRestartRemainingMs ?? 3000);
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

  ctx.fillStyle = '#f4fbff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Game Over', width * 0.5, height * 0.5 - 12);
  ctx.font = '500 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(244, 251, 255, 0.78)';
  ctx.fillText(`Restarting in ${remainingSeconds}`, width * 0.5, height * 0.5 + 26);
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
