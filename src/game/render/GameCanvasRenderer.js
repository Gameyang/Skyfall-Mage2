import gameOverScreenUrl from '../../assets/generated/game-over-screen.webp?url';

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
    this.getSprite(gameOverScreenUrl);
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

    drawItemDrops(ctx, state, this);
    drawProjectiles(ctx, state);
    drawEnemies(ctx, state, this);
    drawCollectedItemTrail(ctx, state, this);
    drawLostItems(ctx, state, this);
    drawPlayer(ctx, state, this);

    if (state.session.gameOver) {
      drawGameOver(ctx, width, height, state, this);
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

function drawItemDrops(ctx, state, renderer) {
  for (const drop of state.entities.itemDrops || []) {
    const sprite = renderer.getSprite(drop.spriteUrl);
    const size = drop.spriteSize ?? drop.radius * 2.2;
    const pulse = 1 + Math.sin((state.session.elapsedMs + drop.id * 173) * 0.008) * 0.08;

    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.scale(pulse, pulse);
    drawItemGlow(ctx, size, drop.visual);

    if (sprite) {
      drawPixelSprite(ctx, sprite, size);
    } else {
      drawCoinFallback(ctx, size, drop.visual);
    }

    ctx.restore();
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
  }
}

function drawCollectedItemTrail(ctx, state, renderer) {
  const items = state.player.collectedItems || [];
  if (!items.length) return;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 230, 145, 0.28)';
  ctx.beginPath();
  for (let index = 0; index < items.length; index += 1) {
    const point = samplePlayerTrailPoint(state.player, 44 + index * 34);
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
  ctx.restore();

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const point = samplePlayerTrailPoint(state.player, 44 + index * 34);
    const sprite = renderer.getSprite(item.spriteUrl);
    const size = item.spriteSize ?? 24;

    ctx.save();
    ctx.translate(point.x, point.y);
    drawItemGlow(ctx, size, item.visual);
    if (sprite) {
      drawPixelSprite(ctx, sprite, size);
    } else {
      drawCoinFallback(ctx, size, item.visual);
    }
    drawItemQuantity(ctx, item.quantity, size);
    ctx.restore();
  }
}

function drawLostItems(ctx, state, renderer) {
  for (const item of state.entities.lostItems || []) {
    const sprite = renderer.getSprite(item.spriteUrl);
    const size = item.spriteSize ?? 24;
    const lifetimeMs = item.lifetimeMs ?? 4000;
    const ageRatio = Math.max(0, Math.min(1, (item.ageMs || 0) / Math.max(1, lifetimeMs)));

    ctx.save();
    ctx.globalAlpha = 1 - ageRatio * 0.45;
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation || 0);
    drawItemGlow(ctx, size, item.visual);
    if (sprite) {
      drawPixelSprite(ctx, sprite, size);
    } else {
      drawCoinFallback(ctx, size, item.visual);
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, state, renderer) {
  const player = state.player;
  const damaged = state.session.contactFlashMs > 0;
  const sprite = renderer.getSprite(player.spriteUrl);

  ctx.save();
  ctx.translate(player.x, player.y);

  if (sprite) {
    const spriteSize = player.spriteSize ?? player.radius * 3.4;
    drawPixelSprite(ctx, sprite, spriteSize);
    drawPlayerHealthBar(ctx, player, spriteSize);
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

  drawPlayerHealthBar(ctx, player, player.radius * 2.8);
  ctx.restore();
}

function drawPlayerHealthBar(ctx, player, visualSize) {
  const width = Math.max(34, Math.min(52, visualSize * 0.72));
  const height = 5;
  const x = -width * 0.5;
  const y = -visualSize * 0.5 - 10;
  const ratio = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  const clamped = Math.max(0, Math.min(1, ratio));

  ctx.fillStyle = 'rgba(2, 4, 8, 0.74)';
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = '#1a2b27';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = clamped < 0.28 ? '#ff5877' : '#38d996';
  ctx.fillRect(x, y, width * clamped, height);
  ctx.strokeStyle = 'rgba(236, 246, 255, 0.76)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
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

function drawItemGlow(ctx, size, visual = {}) {
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, size * 0.82);
  glow.addColorStop(0, 'rgba(255, 233, 138, 0.42)');
  glow.addColorStop(1, 'rgba(255, 207, 87, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(1, size * 0.34, size * 0.36, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (visual?.stroke) {
    ctx.strokeStyle = `${visual.stroke}66`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCoinFallback(ctx, size, visual = {}) {
  const radius = size * 0.4;
  ctx.fillStyle = visual.fill || '#f7c948';
  ctx.strokeStyle = visual.stroke || '#b7791f';
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = visual.shine || '#fff3a3';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.3, -radius * 0.32, radius * 0.26, radius * 0.16, -0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawItemQuantity(ctx, quantity, size) {
  if (!quantity || quantity <= 1) return;

  ctx.font = '700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = `x${quantity}`;
  const x = size * 0.38;
  const y = size * 0.34;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff7c2';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}

function drawPixelSprite(ctx, image, size) {
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -size * 0.5, -size * 0.5, size, size);
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function samplePlayerTrailPoint(player, distanceBehind) {
  const history = player.trailHistory || [];
  if (!history.length) {
    return {
      x: player.x,
      y: player.y + distanceBehind,
    };
  }

  let previous = {
    x: player.x,
    y: player.y,
  };
  let previousSegment = null;
  let remaining = distanceBehind;

  for (const point of history) {
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength >= remaining && segmentLength > 0.0001) {
      const ratio = remaining / segmentLength;
      return {
        x: previous.x + dx * ratio,
        y: previous.y + dy * ratio,
      };
    }

    if (segmentLength > 0.0001) {
      previousSegment = { x: dx / segmentLength, y: dy / segmentLength };
    }
    remaining -= segmentLength;
    previous = point;
  }

  const fallback = previousSegment || { x: 0, y: 1 };
  return {
    x: previous.x + fallback.x * remaining,
    y: previous.y + fallback.y * remaining,
  };
}

function drawGameOver(ctx, width, height, state, renderer) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, width, height);

  const remainingMs = Math.max(0, state.session.autoRestartRemainingMs ?? 3000);
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const art = renderer.getSprite(gameOverScreenUrl);
  const artSize = clamp(Math.min(width, height) * 0.44, 150, 260);

  if (art) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, centerX - artSize * 0.5, centerY - artSize * 0.62, artSize, artSize);
    ctx.imageSmoothingEnabled = previousSmoothing;
  } else {
    ctx.fillStyle = '#f4fbff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Game Over', centerX, centerY - 12);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '500 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(244, 251, 255, 0.78)';
  ctx.fillText(`Restarting in ${remainingSeconds}`, centerX, centerY + artSize * 0.48);
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
