import { createRunSeed } from './waveRandomizer.js';

export function createRunContent(content, { runSeed = createRunSeed('skyfall') } = {}) {
  const waves = typeof content.createWaveSequence === 'function'
    ? content.createWaveSequence({ seed: runSeed })
    : content.waves;
  const equippedSkillIds = selectRunSkillIds(content, runSeed);

  return {
    ...content,
    runSeed,
    waves,
    equippedSkillIds: Object.freeze(equippedSkillIds),
    skills: selectSkillsById(content.skills || {}, equippedSkillIds),
  };
}

export function selectRunSkillIds(content, runSeed) {
  const skills = content.skills || {};
  const allSkillIds = Object.keys(skills);
  const overrideIds = normalizeSkillIds(content.skillLoadoutOverride, skills);
  if (overrideIds.length > 0) return overrideIds;

  if (typeof content.createSkillLoadout === 'function') {
    const loadoutIds = normalizeSkillIds(content.createSkillLoadout({
      seed: runSeed,
      skills,
    }), skills);
    if (loadoutIds.length > 0) return loadoutIds;
  }

  return allSkillIds;
}

export function selectSkillsById(skills, skillIds) {
  const selected = {};
  for (const skillId of skillIds) {
    if (skills[skillId]) {
      selected[skillId] = skills[skillId];
    }
  }
  return Object.freeze(selected);
}

function normalizeSkillIds(skillIds, skills) {
  if (!Array.isArray(skillIds)) return [];

  const selected = [];
  const seen = new Set();
  for (const skillId of skillIds) {
    const normalized = String(skillId || '').trim();
    if (!normalized || seen.has(normalized) || !skills[normalized]) continue;

    seen.add(normalized);
    selected.push(normalized);
  }
  return selected;
}
