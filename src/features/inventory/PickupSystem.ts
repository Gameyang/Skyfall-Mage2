// Responsibility: Collect nearby item drops into serializable inventory state.
// Owner: features/inventory

import { subtractVec2 } from "../../core/math/vector";
import type { ItemDropState } from "../../core/state/EntityState";
import type { GameEvent } from "../../core/state/Event";
import type { GameState } from "../../core/state/GameState";
import { addItemToInventoryBag } from "./InventoryMutations";

export interface PickupResolution {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

const pickupRadius = 0.075;

export function resolveItemPickups(state: GameState): PickupResolution {
  const events: GameEvent[] = [];
  let inventory = state.inventory;
  const itemDrops: ItemDropState[] = [];

  for (const drop of state.entities.itemDrops) {
    if (drop.collected) {
      continue;
    }

    const offset = subtractVec2(drop.position, state.player.position);
    const inRange = Math.hypot(offset.x, offset.y) <= pickupRadius;

    if (!inRange) {
      itemDrops.push(drop);
      continue;
    }

    if (drop.itemId === "coin") {
      inventory = { ...inventory, gold: inventory.gold + 1 };
      events.push({ type: "ItemCollected", itemDropId: drop.id, itemId: drop.itemId });
      continue;
    }

    if (drop.itemId === "gem") {
      inventory = { ...inventory, gems: inventory.gems + 1 };
      events.push({ type: "ItemCollected", itemDropId: drop.id, itemId: drop.itemId });
      continue;
    }

    const nextInventory = addItemToInventoryBag(inventory, drop.itemId, 1);

    if (!nextInventory) {
      itemDrops.push(drop);
      continue;
    }

    inventory = nextInventory;
    events.push({ type: "ItemCollected", itemDropId: drop.id, itemId: drop.itemId });
  }

  return {
    state: {
      ...state,
      inventory,
      entities: {
        ...state.entities,
        itemDrops,
      },
    },
    events,
  };
}
