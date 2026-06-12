const SIDES = Object.freeze(['left', 'right', 'top', 'bottom']);

export function createSeededWaveSequence({
  seed = 'default',
  waves = [],
  waveCount = 8,
  fixedIntroCount = 3,
} = {}) {
  const rng = createSeededRandom(seed);
  const templates = waves.map((wave) => deepClone(wave));
  const intro = templates.slice(0, Math.min(fixedIntroCount, templates.length, waveCount));
  const pool = templates.slice(intro.length);
  const sequence = [];

  for (let index = 0; index < waveCount; index += 1) {
    let template;
    if (index < intro.length) {
      template = intro[index];
    } else {
      template = takeWeightedWaveTemplate(pool, rng, index + 1) || templates[index % templates.length];
    }

    sequence.push(prepareWaveForRun(template, {
      rng,
      waveIndex: index + 1,
      seed,
      randomize: index >= intro.length,
    }));

    if (pool.length === 0 && templates.length > intro.length) {
      pool.push(...templates.slice(intro.length));
    }
  }

  return sequence.map(deepFreeze);
}

export function createRunSeed(prefix = 'run') {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xFFFFFF).toString(36)}`;
}

function takeWeightedWaveTemplate(pool, rng, waveIndex) {
  if (pool.length === 0) return null;

  const allowedRank = getAllowedTierRank(waveIndex);
  const candidates = pool
    .map((wave, index) => ({ wave, index }))
    .filter(({ wave }) => getWaveTierRank(wave) <= allowedRank);
  const selectable = candidates.length > 0
    ? candidates
    : pool.map((wave, index) => ({ wave, index }));

  const weights = selectable.map(({ wave }) => {
    const templateIndex = wave.waveIndex ?? waveIndex;
    const distance = Math.abs(templateIndex - waveIndex);
    return 1 / (1 + distance);
  });
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let roll = rng() * totalWeight;
  for (let index = 0; index < selectable.length; index += 1) {
    roll -= weights[index];
    if (roll > 0) continue;

    const [selected] = pool.splice(selectable[index].index, 1);
    return selected;
  }

  return pool.pop();
}

function getAllowedTierRank(waveIndex) {
  if (waveIndex <= 3) return 0;
  if (waveIndex <= 5) return 1;
  if (waveIndex <= 8) return 2;
  if (waveIndex <= 12) return 3;
  return 4;
}

function getWaveTierRank(wave) {
  const tier = wave.difficultyTier || getTierFromWaveIndex(wave.waveIndex ?? 1);
  if (tier === 'intro') return 0;
  if (tier === 'early') return 1;
  if (tier === 'mid') return 2;
  if (tier === 'late') return 3;
  return 4;
}

function getTierFromWaveIndex(waveIndex) {
  if (waveIndex <= 3) return 'intro';
  if (waveIndex <= 7) return 'early';
  if (waveIndex <= 12) return 'mid';
  if (waveIndex <= 18) return 'late';
  return 'endless';
}

function prepareWaveForRun(template, { rng, waveIndex, seed, randomize = true }) {
  const wave = deepClone(template);
  wave.waveIndex = waveIndex;
  wave.id = `${template.id}-seed-${hashString(seed).toString(36)}-${waveIndex}`;
  wave.groups = (wave.groups || []).map((group, groupIndex) => randomizeGroup(group, {
    rng,
    groupIndex,
    waveIndex,
  }, { randomize }));
  return wave;
}

function randomizeGroup(group, { rng, groupIndex, waveIndex }, { randomize = true } = {}) {
  const nextGroup = deepClone(group);
  nextGroup.id = `${group.id || 'group'}-${waveIndex}-${groupIndex}`;
  if (!randomize) {
    return nextGroup;
  }
  nextGroup.spawnParams = randomizeSpawnParams(nextGroup.spawnParams || {}, rng);
  nextGroup.pathParams = randomizePathParams(nextGroup.pathParams || {}, rng);
  return nextGroup;
}

function randomizeSpawnParams(spawnParams, rng) {
  const nextParams = deepClone(spawnParams);
  if (Array.isArray(nextParams.sideOrder) && nextParams.sideOrder.length > 1) {
    nextParams.sideOrder = rotate(nextParams.sideOrder, Math.floor(rng() * nextParams.sideOrder.length));
  }
  if (nextParams.side && SIDES.includes(nextParams.side) && rng() < 0.35) {
    nextParams.side = SIDES[Math.floor(rng() * SIDES.length)];
  }
  if (Array.isArray(nextParams.sides) && nextParams.sides.length === 2 && rng() < 0.5) {
    nextParams.sides = [nextParams.sides[1], nextParams.sides[0]];
  }
  return nextParams;
}

function randomizePathParams(pathParams, rng) {
  const nextParams = deepClone(pathParams);
  if (typeof nextParams.amplitude === 'number') {
    nextParams.amplitude = Math.round(nextParams.amplitude * (0.9 + rng() * 0.2));
  }
  if (typeof nextParams.frequency === 'number') {
    nextParams.frequency = Number((nextParams.frequency * (0.94 + rng() * 0.12)).toFixed(2));
  }
  return nextParams;
}

function rotate(items, offset) {
  const normalized = offset % items.length;
  return items.slice(normalized).concat(items.slice(0, normalized));
}

function createSeededRandom(seed) {
  let value = hashString(String(seed)) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 100000) / 100000;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }
  if (value && typeof value === 'object') {
    const clone = {};
    for (const [key, child] of Object.entries(value)) {
      clone[key] = deepClone(child);
    }
    return clone;
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
