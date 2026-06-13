import { createRunSeed } from './waveRandomizer.js';

export function createRunContent(content, { runSeed = createRunSeed('skyfall') } = {}) {
  const waves = typeof content.createWaveSequence === 'function'
    ? content.createWaveSequence({ seed: runSeed })
    : content.waves;
  const equippedSkillIds = selectRunSkillIds(content, runSeed);
  const starterWeaponDefinitionIds = selectRunStarterWeaponDefinitionIds(content, runSeed);

  return {
    ...content,
    runSeed,
    waves,
    equippedSkillIds: Object.freeze(equippedSkillIds),
    starterWeaponDefinitionIds: Object.freeze(starterWeaponDefinitionIds),
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

export function selectRunStarterWeaponDefinitionIds(content, runSeed) {
  const weapons = content.weapons || {};
  if (typeof content.createStarterWeaponLoadout === 'function') {
    const loadoutIds = normalizeWeaponIds(content.createStarterWeaponLoadout({
      seed: runSeed,
      weapons,
      weaponIds: content.starterWeaponDefinitionIds,
    }), weapons);
    if (loadoutIds.length > 0) return loadoutIds;
  }

  return normalizeWeaponIds(content.starterWeaponDefinitionIds, weapons);
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

function normalizeWeaponIds(weaponIds, weapons) {
  if (!Array.isArray(weaponIds)) return [];

  const selected = [];
  const seen = new Set();
  for (const weaponId of weaponIds) {
    const normalized = String(weaponId || '').trim();
    if (!normalized || seen.has(normalized) || !weapons[normalized]) continue;

    seen.add(normalized);
    selected.push(normalized);
  }
  return selected;
}
