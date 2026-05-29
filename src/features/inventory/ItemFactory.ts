// Responsibility: Create serializable item instances from static item definitions.
// Owner: features/inventory

import { starterItemById } from "../../content/items/starterItems";
import type { ItemDefinition } from "../../content/items/ItemDefinition";

export interface ItemInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly quantity: number;
  readonly definition: ItemDefinition;
}

export function createItemInstance(definitionId: string, sequence: number, quantity = 1): ItemInstance {
  const definition = starterItemById.get(definitionId);

  if (!definition) {
    throw new Error(`Unknown item definition: ${definitionId}`);
  }

  return {
    id: `${definitionId}-${sequence}`,
    definitionId,
    quantity,
    definition,
  };
}
