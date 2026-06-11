import { GAME_CONTENT } from './content/index.js';

export function createGameState({ width = 1280, height = 720, content = GAME_CONTENT, rng = Math.random } = {}) {
  const playerSkinUrl = selectRandomUrl(content.player?.skinUrls, rng);

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
      radius: 18,
      spriteUrl: playerSkinUrl,
      spriteSize: 64,
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
    skills: createSkillState(content.skills),
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

export function createSkillState(skillDefinitions = {}) {
  const skills = {};
  for (const skillId of Object.keys(skillDefinitions)) {
    skills[skillId] = {
      cooldownRemainingMs: 0,
    };
  }
  return skills;
}

export function createWaveState(waveDefinitions = []) {
  return waveDefinitions.map((wave) => ({
    id: wave.id,
    nextAtMs: wave.startMs ?? 0,
    spawnedGroups: 0,
  }));
}
