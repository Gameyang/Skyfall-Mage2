import { describe, expect, it } from 'vitest';
import { computeScreenShakeOffset } from './GameRuntime.js';
import { BASE_ELEMENT_WEAPON_IDS, createBaseElementSkillLoadout, SKILL_DEFINITIONS } from './content/skills.js';
import { createStarterWeaponLoadout, STARTER_WEAPON_DEFINITION_IDS, WEAPON_DEFINITIONS } from './content/weapons.js';
import { createGameState } from './GameState.js';
import { createRunContent } from './runContent.js';
import { getSkillSequenceDelayMs } from './skillSequence.js';

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
  it('equips all base elemental weapons in a randomized order for a normal run', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    const runContent = createRunContent(content, { runSeed: 'loadout-alpha' });

    expect(runContent.equippedSkillIds).toHaveLength(BASE_ELEMENT_WEAPON_IDS.length);
    expect(new Set(runContent.equippedSkillIds)).toEqual(new Set(BASE_ELEMENT_WEAPON_IDS));
    expect(Object.keys(runContent.skills)).toEqual([...runContent.equippedSkillIds]);
  });

  it('keeps the shuffled base elemental order stable for the same run seed', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    expect(createRunContent(content, { runSeed: 'same-seed' }).equippedSkillIds)
      .toEqual(createRunContent(content, { runSeed: 'same-seed' }).equippedSkillIds);
  });

  it('can select different base elemental orders across different run seeds', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    const selectedOrders = new Set(
      Array.from({ length: 16 }, (_, index) => createRunContent(content, {
        runSeed: `loadout-${index}`,
      }).equippedSkillIds.join('|')),
    );

    expect(selectedOrders.size).toBeGreaterThan(1);
    for (const order of selectedOrders) {
      expect(new Set(order.split('|'))).toEqual(new Set(BASE_ELEMENT_WEAPON_IDS));
    }
  });

  it('staggers randomized base elemental firing by equipped order', () => {
    const content = {
      skills: SKILL_DEFINITIONS,
      waves: [],
      createSkillLoadout: createBaseElementSkillLoadout,
    };

    const runContent = createRunContent(content, { runSeed: 'stagger-seed' });
    const state = createGameState({ content: runContent });
    let expectedCooldownMs = 0;

    expect(runContent.equippedSkillIds.map((skillId) => state.skills[skillId].cooldownRemainingMs))
      .toEqual(runContent.equippedSkillIds.map((skillId) => {
        const cooldownMs = expectedCooldownMs;
        expectedCooldownMs += getSkillSequenceDelayMs(runContent.skills[skillId]);
        return cooldownMs;
      }));
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

describe('run starter weapon loadouts', () => {
  function createWeaponContent() {
    return {
      skills: {},
      waves: [],
      weapons: WEAPON_DEFINITIONS,
      starterWeaponDefinitionIds: STARTER_WEAPON_DEFINITION_IDS,
      createStarterWeaponLoadout,
    };
  }

  it('equips three starter weapons selected from the four base elements', () => {
    const runContent = createRunContent(createWeaponContent(), { runSeed: 'weapon-loadout-alpha' });
    const state = createGameState({ content: runContent });
    const equippedWeapons = state.weapons.equippedWeaponInstanceIds.map((instanceId) => (
      state.weapons.weaponInstancesById[instanceId]
    ));
    const equippedElements = equippedWeapons.map((weapon) => WEAPON_DEFINITIONS[weapon.definitionId].baseElement);

    expect(runContent.starterWeaponDefinitionIds).toHaveLength(3);
    expect(state.weapons.equippedWeaponInstanceIds).toHaveLength(3);
    expect(new Set(equippedElements).size).toBe(3);
    expect(equippedElements.every((element) => ['fire', 'water', 'electric', 'sand'].includes(element))).toBe(true);
  });

  it('keeps starter weapon loadouts stable for the same run seed', () => {
    const content = createWeaponContent();

    expect(createRunContent(content, { runSeed: 'same-weapon-seed' }).starterWeaponDefinitionIds)
      .toEqual(createRunContent(content, { runSeed: 'same-weapon-seed' }).starterWeaponDefinitionIds);
  });

  it('can select different three-element starter sets across run seeds', () => {
    const content = createWeaponContent();
    const selectedSets = new Set(
      Array.from({ length: 16 }, (_, index) => createRunContent(content, {
        runSeed: `weapon-loadout-${index}`,
      }).starterWeaponDefinitionIds.slice().sort().join('|')),
    );

    expect(selectedSets.size).toBeGreaterThan(1);
  });
});
