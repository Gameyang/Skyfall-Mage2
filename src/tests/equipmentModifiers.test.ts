import { describe, expect, it } from "vitest";

import { t } from "../content/strings/GameStrings";
import { createInitialInventoryState } from "../core/state/InventoryState";
import { generateEquipment, generateEquipmentForDrop } from "../features/equipment/EquipmentGeneratorRegistry";
import { resolveEquipmentModifiers } from "../features/equipment/EquipmentModifierResolver";
import { createItemInstance } from "../features/inventory/ItemFactory";

describe("equipment and item factories", () => {
  it("creates item instances from definitions", () => {
    const item = createItemInstance("fire-staff", 1);

    expect(item.definition.nameKey).toBe("item.fire-staff.name");
    expect(t(item.definition.nameKey)).toBe("화염 지팡이");
    expect(item.definition.equipmentSlot).toBe("weapon");
    expect(item.quantity).toBe(1);
  });

  it("generates starter equipment from registry entries", () => {
    const item = generateEquipment("starter-force-armor", 2);

    expect(item.definitionId).toBe("mana-pulse-armor");
    expect(item.definition.equipmentSlot).toBe("body");
  });

  it("generates deterministic equipment by slot and rarity for drops", () => {
    const item = generateEquipmentForDrop("feet", "uncommon", 7, 3);

    expect(item.definitionId).toBe("blinkstep-boots");
    expect(item.definition.equipmentSlot).toBe("feet");
    expect(item.definition.rarity).toBe("uncommon");
  });

  it("resolves equipped items into simulation modifiers", () => {
    const summary = resolveEquipmentModifiers(createInitialInventoryState());

    expect(summary.stats.maxManaBonus).toBeGreaterThan(0);
    expect(summary.simulation.emitterStrengthScale).toBeGreaterThan(1);
    expect(summary.simulation.forceScale).toBeGreaterThan(1);
    expect(summary.simulation.fireResistance).toBeGreaterThan(0);
  });
});
