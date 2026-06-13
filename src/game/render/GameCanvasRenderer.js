import { BATTLE_FIELD_HEIGHT, BATTLE_FIELD_WIDTH } from '../battlefield.js';
import { getEquippedWeaponSlotAnchors, getPlayerFacing } from '../weapons/weaponAnchors.js';
import gameOverScreenUrl from '../../assets/generated/game-over-screen.webp?url';

const DISTANT_BACKGROUND_PARALLAX = 0.18;

export function createGameCanvasRenderer({ canvas }) {
  return new GameCanvasRenderer({ canvas });
}

class GameCanvasRenderer {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true });
    this.spriteCache = new Map();
    this.centeredVisible = {
      x: 0,
      y: 0,
      width: BATTLE_FIELD_WIDTH,
      height: BATTLE_FIELD_HEIGHT,
    };
    this.cssScale = {
      x: 1,
      y: 1,
    };
    if (!this.context) {
      throw new Error('The game canvas could not create a 2D context.');
    }
    this.getSprite(gameOverScreenUrl);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const cssHeight = Math.max(1, Math.floor(rect.height || window.innerHeight));
    const displayRect = {
      left: rect.left || 0,
      top: rect.top || 0,
      width: rect.width || cssWidth,
      height: rect.height || cssHeight,
    };
    const centeredRect = getCenteredCanvasRect(this.canvas, displayRect);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.context.setTransform(pixelWidth / BATTLE_FIELD_WIDTH, 0, 0, pixelHeight / BATTLE_FIELD_HEIGHT, 0, 0);
    this.centeredVisible = getVisibleCanvasArea(this.canvas, centeredRect, BATTLE_FIELD_WIDTH, BATTLE_FIELD_HEIGHT);
    this.cssScale = {
      x: displayRect.width / BATTLE_FIELD_WIDTH,
      y: displayRect.height / BATTLE_FIELD_HEIGHT,
    };
    return {
      width: BATTLE_FIELD_WIDTH,
      height: BATTLE_FIELD_HEIGHT,
      dpr,
      visible: this.centeredVisible,
    };
  }

  render(state) {
    this.syncCameraPan(state.viewport);
    const ctx = this.context;
    const { width, height } = state.viewport;
    ctx.clearRect(0, 0, width, height);

    drawItemDrops(ctx, state, this);
    drawProjectiles(ctx, state);
    drawEnemies(ctx, state, this);
    drawCollectedItemTrail(ctx, state, this);
    drawLostItems(ctx, state, this);
    drawPlayer(ctx, state, this);
    drawEquippedWeapons(ctx, state, this);
    drawRevealShopOverlay(ctx, state);

    if (state.session.gameOver) {
      drawGameOver(ctx, width, height, state, this);
    }
  }

  destroy() {
    this.syncCameraPan(null);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.spriteCache.clear();
  }

  syncCameraPan(viewport) {
    const host = this.canvas.parentElement;
    if (!host?.style) return;

    const cameraVisible = viewport?.visible || this.centeredVisible;
    const pan = getCameraPanOffset(this.centeredVisible, cameraVisible, this.cssScale);
    const distantPan = getDistantBackgroundPanOffset(pan);
    host.style.setProperty('--camera-pan-x', `${pan.x.toFixed(2)}px`);
    host.style.setProperty('--camera-pan-y', `${pan.y.toFixed(2)}px`);
    host.style.setProperty('--distant-pan-x', `${distantPan.x.toFixed(2)}px`);
    host.style.setProperty('--distant-pan-y', `${distantPan.y.toFixed(2)}px`);
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
    ctx.save();
    ctx.translate(projectile.x, projectile.y);

    if (visual.shape === 'bolt') {
      drawLightningProjectile(ctx, projectile, visual, energyRatio, state.session.elapsedMs);
    } else {
      drawOrbProjectile(ctx, projectile, visual, energyRatio);
    }

    ctx.restore();
  }
}

function drawOrbProjectile(ctx, projectile, visual, energyRatio) {
  const corePulse = 1 + energyRatio * 0.28;
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, projectile.radius * (4.8 + energyRatio * 2.2));
  glow.addColorStop(0, visual.glowColor || 'rgba(255, 110, 28, 0.75)');
  glow.addColorStop(1, visual.fadeColor || 'rgba(255, 110, 28, 0)');
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
}

function drawLightningProjectile(ctx, projectile, visual, energyRatio, elapsedMs) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const length = Math.max(projectile.radius * 5.5, Math.hypot(projectile.vx, projectile.vy) * 0.024);
  const width = Math.max(2, projectile.radius * (0.62 + energyRatio * 0.28));
  const phase = (elapsedMs * 0.018 + projectile.id * 1.37) % 6.283;

  ctx.rotate(angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = projectile.radius * 2.8;
  ctx.shadowColor = visual.glowColor || 'rgba(111, 231, 255, 0.52)';
  ctx.strokeStyle = visual.glowColor || 'rgba(111, 231, 255, 0.48)';
  ctx.lineWidth = width * 3.2;
  strokeLightningPath(ctx, length, projectile.radius, phase);

  ctx.shadowBlur = projectile.radius * 1.1;
  ctx.strokeStyle = visual.color || '#8be8ff';
  ctx.lineWidth = width;
  strokeLightningPath(ctx, length, projectile.radius, phase + 1.9);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = visual.coreColor || '#effcff';
  ctx.lineWidth = Math.max(1, width * 0.42);
  strokeLightningPath(ctx, length * 0.86, projectile.radius * 0.62, phase + 3.1);
}

function strokeLightningPath(ctx, length, radius, phase) {
  const half = length * 0.5;
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  for (let index = 1; index <= 4; index += 1) {
    const t = index / 4;
    const x = -half + length * t;
    const jitter = Math.sin(phase + index * 2.13) * radius * 0.8;
    ctx.lineTo(x, jitter);
  }
  ctx.stroke();
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
  ctx.moveTo(0, -player.radius * 1.65);
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
  const width = Math.max(18, Math.min(32, visualSize * 0.72));
  const height = 3;
  const x = -width * 0.5;
  const y = -visualSize * 0.5 - 6;
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

function drawEquippedWeapons(ctx, state, renderer) {
  if (!state.weapons || state.revealShop?.status === 'revealing') return;

  const anchors = getEquippedWeaponSlotAnchors(state);
  const facing = getPlayerFacing(state.player);
  ctx.save();
  for (let index = 0; index < 3; index += 1) {
    const instanceId = state.weapons.equippedWeaponInstanceIds[index];
    const weapon = instanceId ? state.weapons.weaponInstancesById[instanceId] : null;
    if (!weapon) continue;

    const anchor = anchors[index];
    const runtime = state.weapons.equippedRuntime?.[index];
    const cooldownMs = runtime?.cooldownRemainingMs || 0;
    const maxCooldownMs = Math.max(cooldownMs, weapon?.rolledStats?.cooldownMs || 1);
    const readyRatio = clamp(1 - cooldownMs / maxCooldownMs, 0, 1);
    const sprite = renderer.getSprite(weapon.spriteUrl);
    const size = weapon.spriteSize ?? 30;
    drawEquippedWeapon(ctx, {
      anchor,
      facing,
      weapon,
      sprite,
      size,
      readyRatio,
      active: index === state.weapons.attackSequenceIndex,
    });
  }
  ctx.restore();
}

function drawEquippedWeapon(ctx, { anchor, facing, weapon, sprite, size, readyRatio, active }) {
  const outerRadius = Math.max(17, size * 0.62);
  const angle = Math.atan2(facing.y, facing.x) + Math.PI * 0.5;

  ctx.save();
  ctx.translate(anchor.x, anchor.y);

  const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, outerRadius * 1.7);
  glow.addColorStop(0, active ? 'rgba(255, 241, 163, 0.34)' : 'rgba(116, 220, 255, 0.18)');
  glow.addColorStop(1, 'rgba(116, 220, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius * 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(3, 7, 14, 0.58)';
  ctx.strokeStyle = active ? 'rgba(255, 241, 163, 0.92)' : 'rgba(215, 228, 255, 0.36)';
  ctx.lineWidth = active ? 2 : 1.25;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.rotate(angle);
  if (sprite) {
    drawPixelSprite(ctx, sprite, size);
  } else {
    drawWeaponFallback(ctx, size, weapon.rarity);
  }
  ctx.restore();

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5, 9, 18, 0.74)';
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius + 4, -Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();

  ctx.strokeStyle = getRarityColor(weapon.rarity);
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius + 4, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * readyRatio);
  ctx.stroke();
  ctx.restore();
}

function drawWeaponFallback(ctx, size, rarity) {
  const accent = getRarityColor(rarity);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(244, 251, 255, 0.86)';
  ctx.lineWidth = Math.max(3, size * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.42);
  ctx.lineTo(0, size * 0.36);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.strokeStyle = 'rgba(5, 9, 18, 0.72)';
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(size * 0.22, -size * 0.32);
  ctx.lineTo(0, -size * 0.12);
  ctx.lineTo(-size * 0.22, -size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawRevealShopOverlay(ctx, state) {
  const shop = state.revealShop;
  if (!shop || shop.status !== 'revealing') return;

  const screen = getVisibleScreenRect(state.viewport, state.viewport.width, state.viewport.height);
  const margin = clamp(Math.min(screen.width, screen.height) * 0.018, 6, 14);
  const headerHeight = clamp(screen.height * 0.07, 34, 54);
  const panelGap = margin;
  const panelWidth = (screen.width - margin * 2 - panelGap) * 0.5;
  const panelHeight = (screen.height - headerHeight - margin * 2 - panelGap) * 0.5;
  const originY = screen.y + headerHeight + margin;
  const coin = getCollectedQuantity(state, 'coin');

  ctx.save();
  ctx.fillStyle = 'rgba(2, 4, 10, 0.54)';
  ctx.fillRect(screen.x, screen.y, screen.width, screen.height);

  ctx.fillStyle = '#f4fbff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 ${clamp(screen.width * 0.026, 13, 18)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(`Weapon reveal - Wave ${shop.waveIndex}`, screen.x + margin, screen.y + headerHeight * 0.42);
  ctx.textAlign = 'right';
  ctx.fillText(`Coin ${coin}`, screen.x + screen.width - margin, screen.y + headerHeight * 0.42);

  ctx.font = `600 ${clamp(screen.width * 0.018, 10, 13)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(215, 228, 255, 0.78)';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${shop.statusMessage || 'Stand still to reveal'} | Enter claim`,
    screen.x + margin,
    screen.y + headerHeight * 0.78,
  );

  for (const panel of shop.panels) {
    const rect = getRevealPanelRect(panel.quadrant, {
      x: screen.x + margin,
      y: originY,
      panelWidth,
      panelHeight,
      panelGap,
    });
    drawRevealPanel(ctx, state, shop, panel, rect);
  }

  ctx.restore();
}

function drawRevealPanel(ctx, state, shop, panel, rect) {
  const active = shop.activePanelId === panel.panelId;
  const identity = panel.rows[0];
  const title = identity?.revealed
    ? `${panel.weaponInstance.rarity} ${identity.valueText}`
    : `${panel.weaponInstance.rarity} ???`;
  const headerHeight = clamp(rect.height * 0.17, 32, 50);
  const footerHeight = clamp(rect.height * 0.12, 22, 34);
  const rowAreaHeight = Math.max(1, rect.height - headerHeight - footerHeight - 10);
  const rowHeight = Math.max(11, Math.min(20, rowAreaHeight / Math.max(1, panel.rows.length)));
  const rowFontSize = clamp(rowHeight * 0.48, 7, 11);

  ctx.fillStyle = active ? 'rgba(16, 31, 46, 0.88)' : 'rgba(7, 11, 22, 0.78)';
  ctx.strokeStyle = active ? 'rgba(255, 241, 163, 0.95)' : 'rgba(215, 228, 255, 0.24)';
  ctx.lineWidth = active ? 2.5 : 1.25;
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${clamp(rect.width * 0.055, 12, 17)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = '#f4fbff';
  ctx.fillText(truncateText(ctx, title, rect.width - 20), rect.x + 10, rect.y + headerHeight * 0.38);
  ctx.font = `700 ${clamp(rect.width * 0.04, 9, 12)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = getRarityColor(panel.weaponInstance.rarity);
  ctx.fillText(identity?.revealed ? panel.weaponInstance.displayName : 'Unidentified weapon', rect.x + 10, rect.y + headerHeight * 0.72);

  const rowsStartY = rect.y + headerHeight;
  ctx.font = `650 ${rowFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  for (let index = 0; index < panel.rows.length; index += 1) {
    const row = panel.rows[index];
    const y = rowsStartY + index * rowHeight;
    const activeRow = active && index === panel.activeRowIndex && !row.revealed;
    drawRevealRow(ctx, row, {
      x: rect.x + 8,
      y,
      width: rect.width - 16,
      height: rowHeight - 1,
      active: activeRow,
    });
  }

  const footerY = rect.y + rect.height - footerHeight * 0.5;
  ctx.textAlign = 'center';
  ctx.font = `800 ${clamp(rect.width * 0.042, 10, 13)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = panel.claimState === 'claimable' ? '#fff1a3' : 'rgba(215, 228, 255, 0.58)';
  ctx.fillText(getPanelFooterText(panel), rect.x + rect.width * 0.5, footerY);
}

function drawRevealRow(ctx, row, rect) {
  if (rect.active) {
    ctx.fillStyle = 'rgba(255, 241, 163, 0.12)';
    roundRect(ctx, rect.x - 2, rect.y, rect.width + 4, rect.height, 4);
    ctx.fill();
  }

  const progressText = row.revealed
    ? 'open'
    : `${row.revealProgress}/${row.revealCost}`;
  const value = row.revealed ? row.valueText : row.labelWhenLocked;
  const labelWidth = rect.width * 0.38;
  const progressWidth = rect.width * 0.22;
  const valueWidth = rect.width - labelWidth - progressWidth - 10;

  ctx.textAlign = 'left';
  ctx.fillStyle = row.revealed ? 'rgba(244, 251, 255, 0.94)' : 'rgba(215, 228, 255, 0.68)';
  ctx.fillText(truncateText(ctx, row.label, labelWidth), rect.x, rect.y + rect.height * 0.5);

  ctx.textAlign = 'right';
  ctx.fillStyle = row.revealed ? '#9ff0c2' : 'rgba(255, 241, 163, 0.84)';
  ctx.fillText(progressText, rect.x + labelWidth + progressWidth, rect.y + rect.height * 0.5);

  ctx.fillStyle = row.revealed ? '#f4fbff' : 'rgba(244, 251, 255, 0.58)';
  ctx.fillText(
    truncateText(ctx, value, valueWidth),
    rect.x + rect.width,
    rect.y + rect.height * 0.5,
  );
}

function getRevealPanelRect(quadrant, layout) {
  const right = quadrant.endsWith('Right');
  const bottom = quadrant.startsWith('bottom');
  return {
    x: layout.x + (right ? layout.panelWidth + layout.panelGap : 0),
    y: layout.y + (bottom ? layout.panelHeight + layout.panelGap : 0),
    width: layout.panelWidth,
    height: layout.panelHeight,
  };
}

function getPanelFooterText(panel) {
  if (panel.claimState === 'claimed') return 'Claimed';
  if (panel.claimState === 'claimable') return 'Claim ready';
  return 'Reveal all basics';
}

function getCollectedQuantity(state, itemId) {
  return (state.player.collectedItems || [])
    .filter((item) => item.itemId === itemId)
    .reduce((total, item) => total + Math.max(0, item.quantity || 0), 0);
}

function getRarityColor(rarity) {
  if (rarity === 'Epic') return '#d9a6ff';
  if (rarity === 'Rare') return '#74dcff';
  if (rarity === 'Uncommon') return '#9ff0c2';
  return '#d7e4ff';
}

function truncateText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  let truncated = value;
  while (truncated.length > 1 && ctx.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
  const screen = getVisibleScreenRect(state.viewport, width, height);
  const centerX = screen.x + screen.width * 0.5;
  const centerY = screen.y + screen.height * 0.5;
  const screenMin = Math.min(screen.width, screen.height);
  const margin = clamp(screenMin * 0.035, 12, 32);
  const statusFontSize = clamp(screenMin * 0.026, 13, 18);
  const statusLineHeight = statusFontSize * 1.25;
  const statusGap = clamp(screenMin * 0.028, 10, 24);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(screen.x, screen.y, screen.width, screen.height);

  const remainingMs = Math.max(0, state.session.autoRestartRemainingMs ?? 3000);
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const art = renderer.getSprite(gameOverScreenUrl);
  const artRect = art
    ? getContainedImageRect(art, screen, {
      margin,
      reserveBottom: statusGap + statusLineHeight,
    })
    : null;

  if (art && artRect) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, artRect.x, artRect.y, artRect.width, artRect.height);
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
  ctx.font = `500 ${statusFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(244, 251, 255, 0.78)';
  const statusY = artRect
    ? artRect.y + artRect.height + statusGap + statusLineHeight * 0.5
    : centerY + statusLineHeight * 1.4;
  ctx.fillText(`Restarting in ${remainingSeconds}`, centerX, statusY);
  ctx.textAlign = 'start';
}

export function getVisibleScreenRect(viewport = {}, fallbackWidth = 1, fallbackHeight = 1) {
  const width = Math.max(1, fallbackWidth);
  const height = Math.max(1, fallbackHeight);
  const visible = viewport.visible || {};
  const visibleWidth = clamp(visible.width ?? width, 1, width);
  const visibleHeight = clamp(visible.height ?? height, 1, height);

  return {
    x: clamp(visible.x ?? 0, 0, width - visibleWidth),
    y: clamp(visible.y ?? 0, 0, height - visibleHeight),
    width: visibleWidth,
    height: visibleHeight,
  };
}

export function getContainedImageRect(image, screen, { margin = 0, reserveBottom = 0 } = {}) {
  const sourceWidth = Math.max(1, image?.naturalWidth || image?.width || 1);
  const sourceHeight = Math.max(1, image?.naturalHeight || image?.height || 1);
  const safeMargin = Math.max(0, margin);
  const safeReserveBottom = Math.max(0, reserveBottom);
  const availableWidth = Math.max(1, screen.width - safeMargin * 2);
  const availableHeight = Math.max(1, screen.height - safeMargin * 2 - safeReserveBottom);
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  return {
    x: screen.x + (screen.width - drawWidth) * 0.5,
    y: screen.y + safeMargin + (availableHeight - drawHeight) * 0.5,
    width: drawWidth,
    height: drawHeight,
  };
}

export function getVisibleCanvasArea(canvas, rect, width, height) {
  const clipRect = canvas.parentElement?.getBoundingClientRect();
  const clipLeft = clipRect?.left ?? 0;
  const clipTop = clipRect?.top ?? 0;
  const clipRight = clipRect?.right ?? window.innerWidth;
  const clipBottom = clipRect?.bottom ?? window.innerHeight;
  const rectWidth = Math.max(1, rect.width || width);
  const rectHeight = Math.max(1, rect.height || height);
  const logicalPerCssX = width / rectWidth;
  const logicalPerCssY = height / rectHeight;

  const left = clamp((clipLeft - rect.left) * logicalPerCssX, 0, width);
  const top = clamp((clipTop - rect.top) * logicalPerCssY, 0, height);
  const right = clamp((clipRight - rect.left) * logicalPerCssX, left, width);
  const bottom = clamp((clipBottom - rect.top) * logicalPerCssY, top, height);

  return {
    x: Math.floor(left),
    y: Math.floor(top),
    width: Math.max(1, Math.ceil(right - left)),
    height: Math.max(1, Math.ceil(bottom - top)),
  };
}

export function getCenteredCanvasRect(canvas, rect) {
  const clipRect = canvas.parentElement?.getBoundingClientRect();
  if (!clipRect) return rect;

  return {
    left: clipRect.left + (clipRect.width - rect.width) * 0.5,
    top: clipRect.top + (clipRect.height - rect.height) * 0.5,
    width: rect.width,
    height: rect.height,
  };
}

export function getCameraPanOffset(centeredVisible = {}, cameraVisible = {}, cssScale = {}) {
  const scaleX = Number.isFinite(cssScale.x) ? cssScale.x : 1;
  const scaleY = Number.isFinite(cssScale.y) ? cssScale.y : 1;
  const centeredX = Number.isFinite(centeredVisible.x) ? centeredVisible.x : 0;
  const centeredY = Number.isFinite(centeredVisible.y) ? centeredVisible.y : 0;
  const cameraX = Number.isFinite(cameraVisible.x) ? cameraVisible.x : centeredX;
  const cameraY = Number.isFinite(cameraVisible.y) ? cameraVisible.y : centeredY;

  return {
    x: (centeredX - cameraX) * scaleX,
    y: (centeredY - cameraY) * scaleY,
  };
}

export function getDistantBackgroundPanOffset(cameraPan = {}, factor = DISTANT_BACKGROUND_PARALLAX) {
  const x = Number.isFinite(cameraPan.x) ? cameraPan.x : 0;
  const y = Number.isFinite(cameraPan.y) ? cameraPan.y : 0;

  return {
    x: x * factor,
    y: y * factor,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
