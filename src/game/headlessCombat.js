import { HEADLESS_GAME_CONTENT } from './content/headless.js';
import { createGameState } from './GameState.js';
import { createRunContent } from './runContent.js';
import { updateGame } from './systems.js';

export function runHeadlessCombatSimulation({
  content = HEADLESS_GAME_CONTENT,
  durationMs = 120000,
  tickMs = 100,
  width = 960,
  height = 540,
  sampleIntervalMs = 1000,
  playerHp = 10000,
  playerPolicy = 'stationary',
  waveSeed = null,
  contactDamageMultiplier = 1,
  beforeTick = null,
} = {}) {
  const simulationContent = createSimulationContent({
    content,
    waveSeed,
    contactDamageMultiplier,
  });
  const state = createGameState({ width, height, content: simulationContent });
  state.player.hp = playerHp;
  state.player.maxHp = Math.max(state.player.maxHp, playerHp);

  const metrics = {
    durationMs: 0,
    ticks: 0,
    spawnedEnemies: 0,
    backloggedSpawns: 0,
    skippedSpawns: 0,
    killedEnemies: 0,
    despawnedEnemies: 0,
    playerHits: 0,
    playerDamage: 0,
    waveStarts: [],
    waveCompletions: [],
    waves: {},
    peakActiveEnemies: 0,
    peakProjectiles: 0,
    finalScore: 0,
    playerDiedAtMs: null,
    snapshots: [],
  };

  let nextSampleAtMs = 0;
  while (metrics.durationMs < durationMs && !state.session.gameOver) {
    const dt = Math.min(tickMs, durationMs - metrics.durationMs);
    applyHeadlessPlayerPolicy(state, playerPolicy);
    beforeTick?.(state, metrics);
    updateGame(state, dt, simulationContent);
    metrics.durationMs = state.session.elapsedMs;
    metrics.ticks += 1;
    metrics.peakActiveEnemies = Math.max(metrics.peakActiveEnemies, state.entities.enemies.length);
    metrics.peakProjectiles = Math.max(metrics.peakProjectiles, state.entities.projectiles.length);
    collectFrameMetrics(metrics, state);
    collectWaveTickMetrics(metrics, state);

    while (metrics.durationMs >= nextSampleAtMs) {
      metrics.snapshots.push({
        elapsedMs: metrics.durationMs,
        waveIndex: state.waves?.currentWaveNumber ?? null,
        activeEnemies: state.entities.enemies.length,
        projectiles: state.entities.projectiles.length,
        score: state.session.score,
        playerHp: state.player.hp,
      });
      nextSampleAtMs += Math.max(1, sampleIntervalMs);
    }
  }

  if (state.session.gameOver) {
    metrics.playerDiedAtMs = state.session.elapsedMs;
  }

  metrics.finalScore = state.session.score;
  return {
    state,
    metrics,
  };
}

function createSimulationContent({ content, waveSeed, contactDamageMultiplier }) {
  const nextContent = createRunContent(content, waveSeed ? { runSeed: waveSeed } : {});

  if (contactDamageMultiplier === 1) {
    return nextContent;
  }

  const enemies = {};
  for (const [enemyId, enemy] of Object.entries(content.enemies || {})) {
    enemies[enemyId] = Object.freeze({
      ...enemy,
      contactDamage: Math.max(0, Math.round((enemy.contactDamage ?? 0) * contactDamageMultiplier)),
    });
  }

  return {
    ...nextContent,
    enemies: Object.freeze(enemies),
  };
}

function applyHeadlessPlayerPolicy(state, playerPolicy) {
  state.input.vectorX = 0;
  state.input.vectorY = 0;
  if (playerPolicy === 'stationary') return;

  if (playerPolicy === 'orbit') {
    const angle = state.session.elapsedMs / 2600;
    state.input.vectorX = Math.cos(angle);
    state.input.vectorY = Math.sin(angle);
    return;
  }

  if (playerPolicy === 'human') {
    applyHumanLikePolicy(state);
    return;
  }

  if (playerPolicy !== 'evade') return;

  let nearest = null;
  let nearestDistanceSq = Infinity;
  for (const enemy of state.entities.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < nearestDistanceSq) {
      nearest = { dx, dy };
      nearestDistanceSq = distanceSq;
    }
  }

  if (!nearest) {
    const angle = state.session.elapsedMs / 3200;
    state.input.vectorX = Math.cos(angle);
    state.input.vectorY = Math.sin(angle);
    return;
  }

  const length = Math.max(1, Math.hypot(nearest.dx, nearest.dy));
  state.input.vectorX = nearest.dx / length;
  state.input.vectorY = nearest.dy / length;
}

function applyHumanLikePolicy(state) {
  const policy = state.session.headlessPolicy || {
    nextDecisionAtMs: 0,
    vectorX: 0,
    vectorY: 0,
  };
  state.session.headlessPolicy = policy;

  if (state.session.elapsedMs < policy.nextDecisionAtMs) {
    state.input.vectorX = policy.vectorX;
    state.input.vectorY = policy.vectorY;
    return;
  }

  const visible = state.viewport.visible || {
    x: 0,
    y: 0,
    width: state.viewport.width,
    height: state.viewport.height,
  };
  const center = {
    x: visible.x + visible.width * 0.5,
    y: visible.y + visible.height * 0.5,
  };
  const avoid = getNearbyThreatAvoidance(state, Math.max(visible.width, visible.height) * 0.32);
  const centerPull = {
    x: (center.x - state.player.x) / Math.max(1, visible.width),
    y: (center.y - state.player.y) / Math.max(1, visible.height),
  };
  const wallPush = getWallPush(state, visible);
  const angle = state.session.elapsedMs / 1700;
  const drift = {
    x: Math.cos(angle) * 0.18,
    y: Math.sin(angle * 0.73) * 0.18,
  };
  const vector = normalizeVector({
    x: avoid.x * 0.78 + centerPull.x * 0.55 + wallPush.x * 1.25 + drift.x,
    y: avoid.y * 0.78 + centerPull.y * 0.55 + wallPush.y * 1.25 + drift.y,
  });

  policy.vectorX = vector.x;
  policy.vectorY = vector.y;
  policy.nextDecisionAtMs = state.session.elapsedMs + 420;
  state.input.vectorX = vector.x;
  state.input.vectorY = vector.y;
}

function getNearbyThreatAvoidance(state, threatRadius) {
  let x = 0;
  let y = 0;
  for (const enemy of state.entities.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance > threatRadius) continue;

    const weight = 1 - distance / threatRadius;
    x += (dx / distance) * weight;
    y += (dy / distance) * weight;
  }
  return { x, y };
}

function getWallPush(state, visible) {
  const margin = Math.max(48, Math.min(visible.width, visible.height) * 0.12);
  const left = state.player.x - visible.x;
  const right = visible.x + visible.width - state.player.x;
  const top = state.player.y - visible.y;
  const bottom = visible.y + visible.height - state.player.y;

  return {
    x: wallWeight(left, margin) - wallWeight(right, margin),
    y: wallWeight(top, margin) - wallWeight(bottom, margin),
  };
}

function wallWeight(distance, margin) {
  return distance < margin ? (1 - distance / margin) : 0;
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.0001) return { x: 0, y: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function collectFrameMetrics(metrics, state) {
  for (const event of state.frameEvents) {
    const waveMetrics = event.waveIndex ? getWaveMetrics(metrics, event.waveIndex, event.waveId) : null;
    if (event.type === 'EnemySpawned') {
      metrics.spawnedEnemies += 1;
      if (waveMetrics) waveMetrics.spawnedEnemies += 1;
    }
    if (event.type === 'EnemySpawnSkipped') {
      metrics.skippedSpawns += 1;
      if (waveMetrics) waveMetrics.skippedSpawns += 1;
    }
    if (event.type === 'EnemySpawnBacklogged') {
      metrics.backloggedSpawns += 1;
      if (waveMetrics) waveMetrics.backloggedSpawns += 1;
    }
    if (event.type === 'EnemyKilled') {
      metrics.killedEnemies += 1;
      const enemyWave = getWaveMetrics(metrics, event.waveIndex, event.waveId);
      if (enemyWave) enemyWave.killedEnemies += 1;
    }
    if (event.type === 'EnemyDespawned') {
      metrics.despawnedEnemies += 1;
      const enemyWave = getWaveMetrics(metrics, event.waveIndex, event.waveId);
      if (enemyWave) enemyWave.despawnedEnemies += 1;
    }
    if (event.type === 'PlayerDamaged') {
      metrics.playerHits += 1;
      metrics.playerDamage += event.damage ?? 0;
      if (waveMetrics) {
        waveMetrics.playerHits += 1;
        waveMetrics.playerDamage += event.damage ?? 0;
      }
    }
    if (event.type === 'WaveStarted') {
      const startedWave = getWaveMetrics(metrics, event.waveIndex, event.waveId);
      startedWave.startedAtMs = state.session.elapsedMs;
      startedWave.tier = event.tier;
      metrics.waveStarts.push({
        elapsedMs: state.session.elapsedMs,
        waveIndex: event.waveIndex,
        waveId: event.waveId,
        tier: event.tier,
      });
    }
    if (event.type === 'WaveCompleted') {
      const completedWave = getWaveMetrics(metrics, event.waveIndex, event.waveId);
      completedWave.completedAtMs = state.session.elapsedMs;
      completedWave.activeEnemiesAtCompletion = event.activeEnemies;
      metrics.waveCompletions.push({
        elapsedMs: state.session.elapsedMs,
        waveIndex: event.waveIndex,
        waveId: event.waveId,
        activeEnemies: event.activeEnemies,
      });
    }
  }
}

function collectWaveTickMetrics(metrics, state) {
  const waveIndex = state.waves?.currentWaveNumber;
  if (!waveIndex) return;
  const waveMetrics = getWaveMetrics(metrics, waveIndex, state.waves?.currentWaveId);
  waveMetrics.peakActiveEnemies = Math.max(waveMetrics.peakActiveEnemies, state.entities.enemies.length);
  waveMetrics.peakProjectiles = Math.max(waveMetrics.peakProjectiles, state.entities.projectiles.length);
}

function getWaveMetrics(metrics, waveIndex, waveId) {
  if (!waveIndex) return null;
  const key = String(waveIndex);
  if (!metrics.waves[key]) {
    metrics.waves[key] = {
      waveIndex,
      waveId: waveId ?? null,
      tier: null,
      startedAtMs: null,
      completedAtMs: null,
      spawnedEnemies: 0,
      backloggedSpawns: 0,
      skippedSpawns: 0,
      killedEnemies: 0,
      despawnedEnemies: 0,
      playerHits: 0,
      playerDamage: 0,
      peakActiveEnemies: 0,
      peakProjectiles: 0,
      activeEnemiesAtCompletion: null,
    };
  }
  if (waveId && !metrics.waves[key].waveId) {
    metrics.waves[key].waveId = waveId;
  }
  return metrics.waves[key];
}
