import { describe, expect, it } from 'vitest';
import { computeScreenShakeOffset } from './GameRuntime.js';
import { BASE_ELEMENT_WEAPON_IDS, createBaseElementSkillLoadout, SKILL_DEFINITIONS } from './content/skills.js';
import { createGameState } from './GameState.js';
import { createRunContent } from './runContent.js';

function createState({ contactFlashMs = 0, elapsedMs = 120, gameOver = false } = {}) {
  return {
    session: {
      contactFlashMs,
      elapsedMs,
      gameOver,
    },
  };
}

describe('game runtime screen shake', () => {
  it('scales hit shake from the contact flash timer', () => {
    const full = computeScreenShakeOffset(createState({ contactFlashMs: 180 }));
    const half = computeScreenShakeOffset(createState({ contactFlashMs: 90 }));

    expect(Math.abs(full.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(full.y)).toBeLessThanOrEqual(10);
    expect(half.x).toBeCloseTo(full.x * 0.5);
    expect(half.y).toBeCloseTo(full.y * 0.5);
  });

  it('disables hit shake when inactive or after game over', () => {
    expect(computeScreenShakeOffset(createState({ contactFlashMs: 0 }))).toEqual({ x: 0, y: 0 });
    expect(computeScreenShakeOffset(createState({ contactFlashMs: 180, gameOver: true }))).toEqual({ x: 0, y: 0 });
  });
});

describe('run skill loadouts', () => {
  it('equips the four base elemental weapons for a normal run', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    const runContent = createRunContent(content, { runSeed: 'loadout-alpha' });

    expect(runContent.equippedSkillIds).toHaveLength(4);
    expect([...runContent.equippedSkillIds].sort()).toEqual([...BASE_ELEMENT_WEAPON_IDS].sort());
    expect(Object.keys(runContent.skills)).toEqual([...runContent.equippedSkillIds]);
  });

  it('keeps loadout order stable for the same run seed', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    expect(createRunContent(content, { runSeed: 'same-seed' }).equippedSkillIds)
      .toEqual(createRunContent(content, { runSeed: 'same-seed' }).equippedSkillIds);
  });

  it('honors skill loadout overrides for focused skill testing', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      skillLoadoutOverride: Object.freeze(['water_bolt']),
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    const runContent = createRunContent(content, { runSeed: 'override-seed' });
    const state = createGameState({ content: runContent });

    expect(Object.keys(runContent.skills)).toEqual(['water_bolt']);
    expect(state.session.equippedSkillIds).toEqual(['water_bolt']);
  });
});
