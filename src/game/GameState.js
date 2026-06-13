import { createWaveRuntimeState } from './waveDirector.js';
import { getSkillSequenceDelayMs } from './skillSequence.js';

const DEFAULT_STATE_CONTENT = Object.freeze({
  player: Object.freeze({
    skinUrls: Object.freeze([]),
  }),
  skills: Object.freeze({}),
  waves: Object.freeze([]),
});

export function createGameState({ width = 1280, height = 720, content = DEFAULT_STATE_CONTENT, rng = Math.random } = {}) {
  const playerSkinUrl = selectRandomUrl(content.player?.skinUrls, rng);
  const equippedSkillIds = Object.freeze([...(content.equippedSkillIds || Object.keys(content.skills || {}))]);
  const orderedInitialSkillIds = Array.isArray(content.equippedSkillIds) ? equippedSkillIds : [];

  return {
    viewport: {
      width,
      height,
      visible: {
        x: 0,
        y: 0,
        width,
        height,
      },
    },
    session: {
      elapsedMs: 0,
      gameOver: false,
      autoRestartRemainingMs: null,
      score: 0,
      nextEnemyId: 1,
      nextProjectileId: 1,
      nextHazardId: 1,
      nextItemDropId: 1,
      nextLostItemId: 1,
      contactFlashMs: 0,
      autoSkillSequenceIndex: 0,
      autoSkillSequenceCooldownMs: 0,
      equippedSkillIds,
    },
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      vectorX: 0,
      vectorY: 0,
    },
    player: {
      x: width * 0.5,
      y: height * 0.55,
      radius: 9,
      spriteUrl: playerSkinUrl,
      spriteSize: 32,
      speed: 260,
      hp: 100,
      maxHp: 100,
      recenter: null,
      trailHistory: [],
      collectedItems: [],
    },
    entities: {
      enemies: [],
      projectiles: [],
      hazards: [],
      itemDrops: [],
      lostItems: [],
    },
    skills: createSkillState(content.skills, orderedInitialSkillIds),
    waves: createWaveState(content.waves),
    frameEvents: [],
    frameEffects: [],
  };
}

function selectRandomUrl(urls = [], rng = Math.random) {
  if (!Array.isArray(urls) || urls.length === 0) return null;

  const nextRandom = rng();
  const randomValue = Number.isFinite(nextRandom) ? nextRandom : Math.random();
  const index = Math.min(urls.length - 1, Math.max(0, Math.floor(randomValue * urls.length)));
  return urls[index];
}

export function createSkillState(skillDefinitions = {}, orderedSkillIds = []) {
  const skills = {};
  const initialCooldowns = createInitialSkillCooldowns(skillDefinitions, orderedSkillIds);
  for (const skillId of Object.keys(skillDefinitions)) {
    skills[skillId] = {
      cooldownRemainingMs: initialCooldowns.get(skillId) ?? 0,
    };
  }
  return skills;
}

function createInitialSkillCooldowns(skillDefinitions, orderedSkillIds) {
  const initialCooldowns = new Map();
  if (!Array.isArray(orderedSkillIds) || orderedSkillIds.length <= 1) return initialCooldowns;

  let nextCooldownMs = 0;
  orderedSkillIds.forEach((skillId, index) => {
    if (!skillDefinitions[skillId]) return;
    initialCooldowns.set(skillId, nextCooldownMs);
    if (index < orderedSkillIds.length - 1) {
      nextCooldownMs += getSkillSequenceDelayMs(skillDefinitions[skillId]);
    }
  });
  return initialCooldowns;
}

export function createWaveState(waveDefinitions = []) {
  return createWaveRuntimeState(waveDefinitions, 0);
}
