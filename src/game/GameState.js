import { GAME_CONTENT } from './content/index.js';

export function createGameState({ width = 1280, height = 720, content = GAME_CONTENT } = {}) {
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
      score: 0,
      nextEnemyId: 1,
      nextProjectileId: 1,
      nextHazardId: 1,
      contactFlashMs: 0,
    },
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    player: {
      x: width * 0.5,
      y: height * 0.55,
      radius: 18,
      speed: 260,
      hp: 100,
      maxHp: 100,
      recenter: null,
    },
    entities: {
      enemies: [],
      projectiles: [],
      hazards: [],
    },
    skills: createSkillState(content.skills),
    waves: createWaveState(content.waves),
    frameEvents: [],
    frameEffects: [],
  };
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
