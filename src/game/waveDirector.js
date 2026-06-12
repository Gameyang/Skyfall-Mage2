import { createDifficultyContext, scaleEnemyDefinition } from './enemyDifficulty.js';
import { createEnemyFromSpawnContext } from './enemyPaths.js';
import { createSpawnContexts } from './enemySpawns.js';

export function createWaveRuntimeState(waveDefinitions = [], nowMs = 0) {
  const mode = isLegacyWaveSet(waveDefinitions) ? 'legacy' : 'sequence';
  if (mode === 'legacy') {
    return {
      mode,
      signature: getWaveDefinitionSignature(waveDefinitions),
      spawnBacklog: [],
      legacyStates: waveDefinitions.map((wave) => ({
        id: wave.id,
        nextAtMs: wave.startMs ?? 0,
        spawnedGroups: 0,
      })),
    };
  }

  const firstWave = waveDefinitions[0] || null;
  return {
    mode,
    signature: getWaveDefinitionSignature(waveDefinitions),
    currentIndex: 0,
    currentWaveNumber: firstWave?.waveIndex ?? 1,
    currentWaveId: firstWave?.id ?? null,
    waveStartedAtMs: nowMs,
    groupStates: createGroupStates(firstWave),
    completedWaveIds: [],
    spawnBacklog: [],
    delayedMs: 0,
    started: false,
  };
}

export function isWaveRuntimeStateCurrent(waveState, waveDefinitions = []) {
  return Boolean(waveState) && waveState.signature === getWaveDefinitionSignature(waveDefinitions);
}

export function updateWaveSpawns(state, content) {
  const waveDefinitions = content.waves || [];
  if (!isWaveRuntimeStateCurrent(state.waves, waveDefinitions)) {
    state.waves = createWaveRuntimeState(waveDefinitions, state.session.elapsedMs);
  }
  drainSpawnBacklog(state, content);

  if (state.waves.mode === 'legacy') {
    updateLegacyWaveSpawns(state, content);
    return;
  }

  updateSequentialWaveSpawns(state, content);
}

export function spawnWaveGroup(state, waveGroup, content, groupIndex = 0, context = {}) {
  const waveIndex = context.waveIndex ?? waveGroup.waveIndex ?? 1;
  const difficulty = context.difficulty ?? createDifficultyContext({
    waveIndex,
    elapsedMs: state.session.elapsedMs,
    config: content.enemyDifficulty,
  });
  const spawnContexts = createSpawnContexts({
    state,
    waveGroup,
    difficulty,
    repeatIndex: groupIndex,
  });
  const maxActiveEnemies = Math.max(1, difficulty.maxActiveEnemies ?? 100);
  let spawned = 0;

  for (const spawnContext of spawnContexts) {
    if (state.entities.enemies.length >= maxActiveEnemies) {
      enqueueSpawnBacklog(state, {
        waveGroup,
        spawnContext,
        groupIndex,
        waveIndex,
        waveId: context.wave?.id ?? waveGroup.id,
      });
      state.frameEvents.push({
        type: 'EnemySpawnBacklogged',
        waveIndex,
        waveId: context.wave?.id ?? waveGroup.id,
        groupId: waveGroup.id,
        reason: 'maxActiveEnemies',
        activeEnemies: state.entities.enemies.length,
      });
      continue;
    }

    spawned += spawnEnemyFromContext(state, content, {
      waveGroup,
      spawnContext,
      groupIndex,
      waveIndex,
      waveId: context.wave?.id ?? waveGroup.id,
      difficulty,
    });
  }

  return spawned;
}

function spawnEnemyFromContext(state, content, {
  waveGroup,
  spawnContext,
  groupIndex,
  waveIndex,
  waveId,
  difficulty,
}) {
  const enemyType = spawnContext.enemyType || waveGroup.enemyType;
  const baseDefinition = content.enemies?.[enemyType];
  if (!baseDefinition) return 0;

  const definition = scaleEnemyDefinition(baseDefinition, difficulty, waveGroup.scaling);
  const enemy = createEnemyFromSpawnContext({
    state,
    waveGroup: {
      ...waveGroup,
      enemyType,
    },
    definition,
    spawnContext,
    difficulty,
    groupIndex,
  });
  enemy.waveIndex = waveIndex;
  enemy.waveId = waveId;
  enemy.groupId = waveGroup.id;
  state.entities.enemies.push(enemy);
  state.frameEvents.push({
    type: 'EnemySpawned',
    enemyId: enemy.id,
    enemyType: enemy.type,
    waveIndex,
    waveId,
    groupId: waveGroup.id,
    spawnPatternId: spawnContext.spawnPatternId || waveGroup.spawnPatternId || 'edgeFlock',
    pathPatternId: enemy.pathPatternId,
  });
  return 1;
}

function enqueueSpawnBacklog(state, entry) {
  const backlog = state.waves.spawnBacklog || [];
  state.waves.spawnBacklog = backlog;
  backlog.push(entry);
}

function drainSpawnBacklog(state, content) {
  const backlog = state.waves.spawnBacklog;
  if (!backlog?.length) return;

  const remaining = [];
  for (const entry of backlog) {
    const difficulty = createDifficultyContext({
      waveIndex: entry.waveIndex,
      elapsedMs: state.session.elapsedMs,
      config: content.enemyDifficulty,
    });
    if (state.entities.enemies.length >= (difficulty.maxActiveEnemies ?? 100)) {
      remaining.push(entry);
      continue;
    }

    spawnEnemyFromContext(state, content, {
      ...entry,
      difficulty,
    });
  }

  state.waves.spawnBacklog = remaining;
}

function updateLegacyWaveSpawns(state, content) {
  const waveDefinitions = content.waves || [];
  for (let index = 0; index < waveDefinitions.length; index += 1) {
    const wave = waveDefinitions[index];
    const waveState = state.waves.legacyStates[index];
    if (!waveState) continue;

    while (state.session.elapsedMs >= waveState.nextAtMs) {
      spawnWaveGroup(state, wave, content, waveState.spawnedGroups, {
        wave,
        waveIndex: index + 1,
      });
      waveState.spawnedGroups += 1;
      waveState.nextAtMs += wave.intervalMs || 1000;
    }
  }
}

function updateSequentialWaveSpawns(state, content) {
  const waveDefinitions = content.waves || [];
  if (waveDefinitions.length === 0) return;

  const runtime = state.waves;
  const wave = waveDefinitions[runtime.currentIndex] || waveDefinitions[0];
  const waveIndex = runtime.currentWaveNumber || wave.waveIndex || runtime.currentIndex + 1;
  const waveElapsedMs = Math.max(0, state.session.elapsedMs - runtime.waveStartedAtMs);
  const difficulty = createDifficultyContext({
    waveIndex,
    elapsedMs: state.session.elapsedMs,
    config: content.enemyDifficulty,
  });

  if (!runtime.started) {
    runtime.started = true;
    state.frameEvents.push({
      type: 'WaveStarted',
      waveIndex,
      waveId: wave.id,
      tier: wave.difficultyTier || difficulty.tier,
    });
  }

  for (let index = 0; index < wave.groups.length; index += 1) {
    const group = wave.groups[index];
    const groupState = runtime.groupStates[index];
    if (!groupState) continue;

    const repeat = Math.max(1, group.repeat ?? 1);
    while (groupState.spawnedRepeats < repeat && waveElapsedMs >= groupState.nextAtMs) {
      spawnWaveGroup(state, group, content, groupState.spawnedRepeats, {
        wave,
        waveIndex,
        difficulty,
      });
      groupState.spawnedRepeats += 1;
      groupState.nextAtMs += group.repeatIntervalMs ?? group.intervalMs ?? 1000;
    }
  }

  const durationMs = Math.max(1, wave.durationMs ?? 30000);
  if (!shouldCompleteWave({ state, runtime, wave, waveElapsedMs, durationMs })) return;

  const activeEnemies = state.entities.enemies.length;
  if (
    activeEnemies > difficulty.fieldPressureEnemyLimit &&
    runtime.delayedMs < difficulty.maxWaveDelayMs
  ) {
    runtime.delayedMs += Math.min(250, difficulty.maxWaveDelayMs - runtime.delayedMs);
    return;
  }

  advanceWave(state, waveDefinitions, wave, waveIndex);
}

function advanceWave(state, waveDefinitions, wave, waveIndex) {
  const runtime = state.waves;
  state.frameEvents.push({
    type: 'WaveCompleted',
    waveIndex,
    waveId: wave.id,
    activeEnemies: state.entities.enemies.length,
  });
  runtime.completedWaveIds.push(wave.id);

  const nextIndex = runtime.currentIndex + 1;
  if (nextIndex < waveDefinitions.length) {
    runtime.currentIndex = nextIndex;
    runtime.currentWaveNumber = waveDefinitions[nextIndex].waveIndex ?? waveIndex + 1;
  } else {
    runtime.currentIndex = waveDefinitions.length - 1;
    runtime.currentWaveNumber = waveIndex + 1;
  }

  const nextWave = waveDefinitions[runtime.currentIndex];
  runtime.currentWaveId = nextWave.id;
  runtime.waveStartedAtMs = state.session.elapsedMs;
  runtime.groupStates = createGroupStates(nextWave);
  runtime.delayedMs = 0;
  runtime.started = false;
}

function shouldCompleteWave({ state, runtime, wave, waveElapsedMs, durationMs }) {
  const endCondition = wave.endCondition || { type: 'duration' };
  if (endCondition.type === 'allSpawnedCleared') {
    return allGroupsCompleted(runtime) && !hasActiveWaveEnemies(state, wave.id);
  }

  if (endCondition.type === 'enemyTypeCleared') {
    const minDurationMs = Math.max(0, endCondition.minDurationMs ?? 0);
    return (
      waveElapsedMs >= minDurationMs &&
      allGroupsCompleted(runtime) &&
      !hasActiveWaveEnemies(state, wave.id, endCondition.enemyType)
    );
  }

  if (endCondition.type === 'durationOrCleared') {
    return (
      waveElapsedMs >= durationMs ||
      (allGroupsCompleted(runtime) && !hasActiveWaveEnemies(state, wave.id))
    );
  }

  return waveElapsedMs >= durationMs;
}

function allGroupsCompleted(runtime) {
  return runtime.groupStates.every((groupState) => {
    const spawned = groupState.spawnedRepeats ?? 0;
    const repeat = groupState.repeat ?? 1;
    return spawned >= repeat;
  });
}

function hasActiveWaveEnemies(state, waveId, enemyType = null) {
  return state.entities.enemies.some((enemy) => (
    enemy.waveId === waveId &&
    (!enemyType || enemy.type === enemyType)
  ));
}

function isLegacyWaveSet(waveDefinitions = []) {
  return waveDefinitions.some((wave) => !Array.isArray(wave.groups));
}

function createGroupStates(wave) {
  if (!wave?.groups) return [];
  return wave.groups.map((group) => ({
    id: group.id,
    nextAtMs: group.startMs ?? 0,
    spawnedRepeats: 0,
    repeat: Math.max(1, group.repeat ?? 1),
  }));
}

function getWaveDefinitionSignature(waveDefinitions = []) {
  return waveDefinitions
    .map((wave) => `${wave.id}:${Array.isArray(wave.groups) ? 'sequence' : 'legacy'}:${wave.groups?.length ?? 0}`)
    .join('|');
}
