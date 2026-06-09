// Responsibility: Resolve serializable game entities into common sprite render data.
// Owner: render/snapshots

import { starterEnemyById } from "../../content/enemies/starterEnemies";
import { starterItemById } from "../../content/items/starterItems";
import type { GameState } from "../../core/state/GameState";
import { resolveSkinUrl } from "../../platform/assets";
import type { RenderableSprite, RenderableSpriteStatusEffect } from "./RenderSnapshot";

export function createRenderableSprites(state: GameState): readonly RenderableSprite[] {
  return [
    createPlayerSprite(state),
    ...state.entities.enemies.map(createEnemySprite),
    ...state.entities.itemDrops.filter((drop) => !drop.collected).map(createItemDropSprite),
  ].filter((sprite) => sprite.textureUrl.length > 0);
}

function createPlayerSprite(state: GameState): RenderableSprite {
  return {
    id: state.player.id,
    kind: "player",
    position: state.player.position,
    size: { x: 0.108, y: 0.108 },
    textureUrl: resolveSkinUrl(state.player.skinId),
    rarity: "rare",
    statusEffects: resolvePlayerStatusEffects(state),
    motionPreset: state.player.movement.x !== 0 || state.player.movement.y !== 0 ? "bounce" : "idle",
    facing: state.player.aim.x < state.player.position.x ? -1 : 1,
    hpPercent: state.player.hp.max <= 0 ? null : state.player.hp.current / state.player.hp.max,
  };
}

function createEnemySprite(enemy: GameState["entities"]["enemies"][number]): RenderableSprite {
  const definition = starterEnemyById.get(enemy.definitionId);
  const isBoss = enemy.kind === "boss" || enemy.kind === "miniboss";
  const hpPercent = enemy.maxHp <= 0 ? 0 : enemy.hp / enemy.maxHp;

  return {
    id: enemy.id,
    kind: isBoss ? "boss" : "enemy",
    position: enemy.position,
    size: isBoss ? { x: 0.122, y: 0.122 } : { x: 0.082, y: 0.082 },
    textureUrl: definition?.iconUrl ?? "",
    rarity: enemy.kind === "boss" ? "epic" : enemy.kind === "miniboss" ? "rare" : "common",
    statusEffects: hpPercent < 1 ? ["hit"] : [],
    motionPreset: hpPercent < 1 ? "shake" : isBoss ? "pulse" : "sway",
    facing: 1,
    hpPercent,
  };
}

function createItemDropSprite(drop: GameState["entities"]["itemDrops"][number]): RenderableSprite {
  const definition = starterItemById.get(drop.itemId);

  return {
    id: drop.id,
    kind: "item",
    position: drop.position,
    size: { x: 0.058, y: 0.058 },
    textureUrl: definition?.iconUrl ?? "",
    rarity: definition?.rarity ?? "common",
    statusEffects: definition && definition.rarity !== "common" ? ["buff"] : [],
    motionPreset: definition?.rarity === "rare" || definition?.rarity === "epic" ? "pulse" : "sway",
    facing: 1,
    hpPercent: null,
  };
}

function resolvePlayerStatusEffects(state: GameState): readonly RenderableSpriteStatusEffect[] {
  const effects: RenderableSpriteStatusEffect[] = [];

  if (state.player.hp.current < state.player.hp.max) {
    effects.push("hit");
  }

  if (state.progression.activeBuffIds.length > 0) {
    effects.push("buff");
  }

  if (state.progression.activeBuffIds.includes("magic-field")) {
    effects.push("magic-field");
  }

  if (state.progression.activeDebuffIds.includes("burning-field")) {
    effects.push("burning-field");
  }

  if (state.progression.activeDebuffIds.includes("slowed-field")) {
    effects.push("slowed-field");
  }

  return effects;
}
