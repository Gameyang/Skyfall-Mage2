// Responsibility: Resolve combat field query summaries into CPU entity state and events.
// Owner: features/combat

import { clamp } from "../../core/math/vector";
import type { GameEvent } from "../../core/state/Event";
import type { GameState } from "../../core/state/GameState";
import type { CombatFieldQueryResult } from "../combatField/CombatFieldTypes";
import { resolveEquipmentModifiers } from "../equipment/EquipmentModifierResolver";
import { addExperience } from "../progression/ExperienceSystem";
import { startReviveQuiz } from "../progression/QuizReviveSystem";

export interface CombatResolutionResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function resolveCombatFieldResults(
  state: GameState,
  queryResults: readonly CombatFieldQueryResult[],
  deltaMs: number,
): CombatResolutionResult {
  const deltaScale = Math.min(deltaMs, 100) / 1000;
  const resultById = new Map(queryResults.map((result) => [result.entityId, result]));
  const events: GameEvent[] = [];
  const previousEnemies = state.entities.enemies;
  const enemies = previousEnemies
    .map((enemy) => {
      const query = resultById.get(enemy.id);

      if (!query) {
        return enemy;
      }

      const damage = query.damage * deltaScale;
      return {
        ...enemy,
        hp: clamp(enemy.hp - damage, 0, enemy.maxHp),
      };
    })
    .filter((enemy) => {
      const alive = enemy.hp > 0;

      if (!alive) {
        events.push({ type: "EnemyKilled", enemyId: enemy.id });
      }

      return alive;
    });
  const killedEnemies = previousEnemies.filter((enemy) => !enemies.some((next) => next.id === enemy.id));
  const playerQuery = resultById.get(state.player.id);
  const equipmentModifiers = resolveEquipmentModifiers(state.inventory);
  const playerDamage = playerQuery
    ? calculatePlayerDamage(playerQuery, equipmentModifiers.simulation.fireResistance, equipmentModifiers.simulation.waterResistance) *
      deltaScale
    : 0;
  const nextHp = clamp(state.player.hp.current - playerDamage, 0, state.player.hp.max);
  const playerWithExperience = killedEnemies.length > 0 ? addExperience(state.player, killedEnemies.length * 24) : state.player;
  const levelDelta = Math.max(0, playerWithExperience.level - state.player.level);

  const shouldStartReviveQuiz = nextHp <= 0 && state.player.hp.current > 0 && !state.session.reviveUsed;

  if (nextHp <= 0 && state.player.hp.current > 0 && state.session.reviveUsed) {
    events.push({ type: "GameOver" });
  }

  if (levelDelta > 0) {
    events.push({ type: "PlayerLevelUp", level: playerWithExperience.level });
  }

  return {
    state: shouldStartReviveQuiz
      ? startReviveQuiz(
          createResolvedCombatState(state, playerWithExperience, nextHp, queryResults, enemies, killedEnemies, levelDelta, playerQuery),
        )
      : createResolvedCombatState(state, playerWithExperience, nextHp, queryResults, enemies, killedEnemies, levelDelta, playerQuery),
    events,
  };
}

function createResolvedCombatState(
  state: GameState,
  playerWithExperience: GameState["player"],
  nextHp: number,
  queryResults: readonly CombatFieldQueryResult[],
  enemies: GameState["entities"]["enemies"],
  killedEnemies: GameState["entities"]["enemies"],
  levelDelta: number,
  playerQuery: CombatFieldQueryResult | undefined,
): GameState {
  return {
    ...state,
    player: {
      ...playerWithExperience,
      hp: {
        ...playerWithExperience.hp,
        current: nextHp,
      },
    },
    progression: {
      ...state.progression,
      activeBuffIds:
        playerQuery?.statusEffect === "magic" && !state.progression.activeBuffIds.includes("magic-field")
          ? [...state.progression.activeBuffIds, "magic-field"]
          : state.progression.activeBuffIds,
      activeDebuffIds: resolvePlayerDebuffs(state.progression.activeDebuffIds, playerQuery?.statusEffect ?? null),
      pendingLevelUpRewards: state.progression.pendingLevelUpRewards + levelDelta,
    },
    entities: {
      ...state.entities,
      enemies,
      itemDrops: [
        ...state.entities.itemDrops,
        ...killedEnemies.map((enemy) => ({
          id: `drop-${enemy.id}`,
          itemId: "coin",
          position: enemy.position,
          velocity: { x: 0.02, y: -0.06 },
          ageMs: 0,
          collected: false,
        })),
      ],
    },
    session: {
      ...state.session,
      gameOver: nextHp <= 0,
    },
    battleField: {
      ...state.battleField,
      lastQueryResults: queryResults,
    },
  };
}

function resolvePlayerDebuffs(
  activeDebuffIds: readonly string[],
  statusEffect: CombatFieldQueryResult["statusEffect"],
): readonly string[] {
  const debuffId = statusEffect === "burning" ? "burning-field" : statusEffect === "slowed" ? "slowed-field" : null;

  if (!debuffId || activeDebuffIds.includes(debuffId)) {
    return activeDebuffIds;
  }

  return [...activeDebuffIds, debuffId];
}

function calculatePlayerDamage(query: CombatFieldQueryResult, fireResistance: number, waterResistance: number): number {
  const fireMitigation = query.fireCoverage > 0 ? fireResistance : 0;
  const waterMitigation = query.waterCoverage > 0 ? waterResistance : 0;
  const resistance = Math.max(fireMitigation, waterMitigation);

  return Math.max(0, query.damage * (1 - resistance) - query.waterCoverage * 6);
}
