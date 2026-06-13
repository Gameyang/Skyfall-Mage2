import { describe, expect, it } from 'vitest';
import { ATTACK_PATTERN_DEFINITIONS } from './content/attackPatterns.js';
import { ITEM_DEFINITIONS } from './content/items.js';
import { WEAPON_AFFIX_DEFINITIONS } from './content/weaponAffixes.js';
import { STARTER_WEAPON_DEFINITION_IDS, WEAPON_DEFINITIONS } from './content/weapons.js';
import { createGameState } from './GameState.js';
import { startRevealShopAfterWave } from './shop/revealShopEncounter.js';
import { getWeaponSlotPosition } from './weapons/weaponAnchors.js';
import { syncWeaponRuntimeState } from './weapons/weaponInventory.js';
import { buildWeaponRuntimeSkill } from './weapons/weaponRuntimeBuilder.js';
import { createRevealPanels } from './weapons/weaponRoller.js';
import { updateAutoAttack, updateGame } from './systems.js';

function createWeaponTestContent(overrides = {}) {
  return {
    enemies: overrides.enemies ?? {},
    skills: overrides.skills ?? {},
    waves: overrides.waves ?? [],
    items: overrides.items ?? { coin: ITEM_DEFINITIONS.coin },
    loot: overrides.loot ?? { enemyDrops: [] },
    weapons: overrides.weapons ?? WEAPON_DEFINITIONS,
    weaponAffixes: overrides.weaponAffixes ?? WEAPON_AFFIX_DEFINITIONS,
    attackPatterns: overrides.attackPatterns ?? ATTACK_PATTERN_DEFINITIONS,
    starterWeaponDefinitionIds: overrides.starterWeaponDefinitionIds ?? STARTER_WEAPON_DEFINITION_IDS,
    runSeed: overrides.runSeed ?? 'weapon-test-seed',
  };
}

describe('weapon reveal panel rolling', () => {
  it('is stable for the same seed and wave but changes across seeds', () => {
    const content = createWeaponTestContent();
    const first = createRevealPanels({ waveIndex: 5, seed: 'same', content });
    const second = createRevealPanels({ waveIndex: 5, seed: 'same', content });
    const different = createRevealPanels({ waveIndex: 5, seed: 'different', content });

    expect(first.map((panel) => panel.weaponInstance)).toEqual(second.map((panel) => panel.weaponInstance));
    expect(first.map((panel) => panel.weaponInstance.definitionId))
      .not.toEqual(different.map((panel) => panel.weaponInstance.definitionId));
  });

  it('does not roll higher rarity weapons before their wave gates', () => {
    const content = createWeaponTestContent();
    const panels = createRevealPanels({ waveIndex: 1, seed: 'intro', content });

    expect(panels).toHaveLength(4);
    expect(panels.every((panel) => panel.weaponInstance.rarity === 'Common')).toBe(true);
    expect(panels.every((panel) => panel.rows.filter((row) => row.type === 'affix').length >= 4)).toBe(true);
  });
});

describe('weapon reveal progress', () => {
  it('spends one coin per reveal tick only while the player is standing still inside a panel', () => {
    const content = createWeaponTestContent();
    const state = createGameState({ width: 800, height: 800, content });
    state.player.recenter = null;
    state.player.x = 100;
    state.player.y = 100;
    startRevealShopAfterWave(state, content, { waveIndex: 1, waveId: 'test-wave' });
    const panel = state.revealShop.panels.find((candidate) => candidate.quadrant === 'topLeft');
    const firstRow = panel.rows[0];

    updateGame(state, state.revealShop.minStationaryMs + firstRow.revealCost * state.revealShop.coinSpendIntervalMs, content);

    expect(firstRow.revealed).toBe(true);
    expect(firstRow.revealProgress).toBe(firstRow.revealCost);
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'RevealRowRevealed',
      panelId: panel.panelId,
      rowId: firstRow.rowId,
    }));

    const secondRow = panel.rows[1];
    updateGame(state, state.revealShop.coinSpendIntervalMs, content);
    expect(secondRow.revealProgress).toBe(1);

    state.input.right = true;
    state.input.vectorX = 1;
    updateGame(state, 16, content);

    expect(secondRow.revealProgress).toBe(0);
  });

  it('claims a weapon after all basic rows are revealed and equips it into the loadout', () => {
    const content = createWeaponTestContent();
    const state = createGameState({ width: 800, height: 800, content });
    state.player.recenter = null;
    state.player.x = 100;
    state.player.y = 100;
    startRevealShopAfterWave(state, content, { waveIndex: 1, waveId: 'test-wave' });
    const panel = state.revealShop.panels.find((candidate) => candidate.quadrant === 'topLeft');
    const previousEquipped = [...state.weapons.equippedWeaponInstanceIds];

    for (const row of panel.rows.filter((candidate) => candidate.type === 'basicStat')) {
      row.revealed = true;
      row.revealProgress = row.revealCost;
    }
    panel.rows.find((row) => row.type === 'affix').revealed = true;
    state.input.confirmPressed = true;

    updateGame(state, 16, content);

    expect(state.revealShop).toBeNull();
    expect(state.frameEvents).toContainEqual(expect.objectContaining({
      type: 'WeaponClaimed',
      weaponInstanceId: panel.weaponInstanceId,
      affixCount: 1,
    }));
    expect(state.weapons.equippedWeaponInstanceIds).not.toEqual(previousEquipped);
    expect(state.weapons.weaponInstancesById[panel.weaponInstanceId].affixes).toHaveLength(1);
  });
});

describe('weapon auto attack sequence', () => {
  function createTargetedWeaponState() {
    const content = createWeaponTestContent({
      enemies: {
        testEnemy: {
          id: 'testEnemy',
          hp: 500,
          speed: 0,
          radius: 18,
          contactDamage: 0,
        },
      },
    });
    const state = createGameState({ width: 800, height: 800, content });
    state.player.recenter = null;
    state.player.x = 400;
    state.player.y = 400;
    state.entities.enemies.push({
      id: 1,
      type: 'testEnemy',
      hp: 500,
      maxHp: 500,
      x: 720,
      y: 400,
      radius: 18,
      progress: 0,
      travelDistance: 1000,
      contactDamage: 0,
    });
    return { content, state };
  }

  function getEquippedWeaponSkills(state, content) {
    return state.weapons.equippedWeaponInstanceIds.map((instanceId) => (
      buildWeaponRuntimeSkill(state.weapons.weaponInstancesById[instanceId], content)
    ));
  }

  it('normalizes the equipped loadout to three weapon slots', () => {
    const content = createWeaponTestContent();
    const state = createGameState({ width: 800, height: 800, content });
    const equipped = [...state.weapons.equippedWeaponInstanceIds];
    state.weapons.weaponInstancesById.extraWeapon = {
      ...state.weapons.weaponInstancesById[equipped[0]],
      instanceId: 'extraWeapon',
    };
    state.weapons.equippedWeaponInstanceIds = [...equipped, 'extraWeapon'];

    syncWeaponRuntimeState(state);

    expect(state.weapons.equippedWeaponInstanceIds).toHaveLength(3);
    expect(state.weapons.equippedWeaponInstanceIds).toEqual(equipped);
    expect(state.weapons.equippedRuntime).toHaveLength(3);
  });

  it('fires equipped weapon instances after each slot cooldown in strict order', () => {
    const { content, state } = createTargetedWeaponState();
    const skills = getEquippedWeaponSkills(state, content);

    updateAutoAttack(state, skills[0].cooldownMs - 1, content);
    expect(state.entities.projectiles).toHaveLength(0);
    expect(state.weapons.attackSequenceIndex).toBe(0);
    expect(state.weapons.equippedRuntime[0]).toEqual(expect.objectContaining({
      cooldownRemainingMs: 1,
      cooldownStarted: true,
    }));
    expect(state.weapons.equippedRuntime[1]).toEqual(expect.objectContaining({
      cooldownRemainingMs: 0,
      cooldownStarted: false,
    }));

    updateAutoAttack(state, 1, content);
    updateAutoAttack(state, skills[1].cooldownMs, content);
    updateAutoAttack(state, skills[2].cooldownMs, content);

    expect(state.entities.projectiles.map((projectile) => projectile.skillId)).toEqual([
      'starter-0-fire_bolt_staff',
      'starter-1-water_bolt_staff',
      'starter-2-electric_bolt_staff',
    ]);
    expect(state.weapons.attackSequenceIndex).toBe(0);
    expect(state.weapons.equippedRuntime.map((runtime) => runtime.cooldownStarted)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('spawns each equipped weapon projectile from its in-world slot anchor', () => {
    const { content, state } = createTargetedWeaponState();
    state.player.facing = { x: 1, y: 0 };
    const skills = getEquippedWeaponSkills(state, content);
    const origins = [];

    updateAutoAttack(state, skills[0].cooldownMs, content);
    origins.push(getWeaponSlotPosition(state, 0));
    updateAutoAttack(state, skills[1].cooldownMs, content);
    origins.push(getWeaponSlotPosition(state, 1));
    updateAutoAttack(state, skills[2].cooldownMs, content);
    origins.push(getWeaponSlotPosition(state, 2));

    expect(state.entities.projectiles).toHaveLength(3);
    for (let index = 0; index < 3; index += 1) {
      expect(state.entities.projectiles[index]).toEqual(expect.objectContaining({
        x: origins[index].x,
        y: origins[index].y,
      }));
    }
  });

  it('does not attach cast material effects to weapon firing', () => {
    const content = createWeaponTestContent();
    const state = createGameState({ width: 800, height: 800, content });
    const instanceId = state.weapons.equippedWeaponInstanceIds[0];
    const skill = buildWeaponRuntimeSkill(state.weapons.weaponInstancesById[instanceId], content);

    expect(skill.materialEffects.cast).toEqual([]);
    expect(skill.materialEffects.hit.length).toBeGreaterThan(0);
  });
});
