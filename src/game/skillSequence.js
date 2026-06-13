export const DEFAULT_SKILL_SEQUENCE_COOLDOWN_MS = 1000;
export const SKILL_SEQUENCE_COOLDOWN_MULTIPLIER = 2;

export function getSkillSequenceDelayMs(skill) {
  return (skill?.cooldownMs ?? DEFAULT_SKILL_SEQUENCE_COOLDOWN_MS) * SKILL_SEQUENCE_COOLDOWN_MULTIPLIER;
}
