// Responsibility: Render equipment and bag slots, emitting inventory commands only.
// Owner: ui/panels

import type { GameCommand } from "../../core/state/Command";
import type { EquipmentSlotKind } from "../../core/state/InventoryState";
import { createSlotGrid, type SlotGridHandle } from "../components/SlotGrid";
import type { InventoryViewModel } from "../viewModels/createInventoryViewModel";

type CommandSink = (command: GameCommand) => void;

export class InventoryPanel {
  readonly element: HTMLElement;
  private readonly wallet: HTMLElement;
  private readonly equipmentGrid: SlotGridHandle;
  private readonly bagGrid: SlotGridHandle;
  private selectedSlotIndex: number | null = null;
  private equipmentSlots: readonly EquipmentSlotKind[] = [];
  private lastSignature = "";

  constructor(private readonly sink: CommandSink) {
    this.element = document.createElement("section");
    this.element.className = "inventory-panel";
    this.wallet = document.createElement("div");
    this.wallet.className = "wallet-row";
    this.equipmentGrid = createSlotGrid("equipment-grid", (index) => this.handleEquipmentClick(index));
    this.bagGrid = createSlotGrid("bag-grid", (index) => this.handleBagClick(index));
    this.element.append(this.wallet, this.equipmentGrid.element, this.bagGrid.element);
  }

  update(viewModel: InventoryViewModel): void {
    const signature = createInventorySignature(viewModel);

    if (signature === this.lastSignature) {
      return;
    }

    this.lastSignature = signature;
    this.wallet.textContent = `Gold ${viewModel.gold}  Gems ${viewModel.gems}`;
    this.selectedSlotIndex = viewModel.bag.findIndex((slot) => slot.selected);
    this.selectedSlotIndex = this.selectedSlotIndex >= 0 ? this.selectedSlotIndex : null;
    this.equipmentSlots = viewModel.equipment.map((slot) => slot.slot);
    this.equipmentGrid.update(viewModel.equipment);
    this.bagGrid.update(viewModel.bag);
  }

  private handleBagClick(index: number): void {
    if (this.selectedSlotIndex !== null && this.selectedSlotIndex !== index) {
      this.sink({ type: "MoveInventoryItem", fromIndex: this.selectedSlotIndex, toIndex: index });
      return;
    }

    this.sink({ type: "UseInventorySlot", slotIndex: index });
  }

  private handleEquipmentClick(index: number): void {
    const equipmentSlot = this.equipmentSlots[index];

    if (!equipmentSlot || this.selectedSlotIndex === null) {
      return;
    }

    this.sink({ type: "EquipItem", slotIndex: this.selectedSlotIndex, equipmentSlot });
  }
}

function createInventorySignature(viewModel: InventoryViewModel): string {
  return [
    viewModel.gold,
    viewModel.gems,
    ...viewModel.equipment.map((slot) => `${slot.slot}:${slot.key}:${slot.label}:${slot.iconUrl ?? ""}`),
    ...viewModel.bag.map((slot) => `${slot.key}:${slot.label}:${slot.iconUrl ?? ""}:${slot.quantity ?? 0}:${slot.selected ?? false}`),
  ].join("|");
}
