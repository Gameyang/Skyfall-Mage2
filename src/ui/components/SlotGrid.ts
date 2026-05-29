// Responsibility: Render fixed-size item slots without owning gameplay rules.
// Owner: ui/components

export interface SlotView {
  readonly key: string;
  readonly label: string;
  readonly iconUrl: string | null;
  readonly quantity?: number;
  readonly selected?: boolean;
  readonly empty?: boolean;
}

export interface SlotGridHandle {
  readonly element: HTMLElement;
  update(slots: readonly SlotView[]): void;
}

export function createSlotGrid(className: string, onSlotClick: (index: number) => void): SlotGridHandle {
  const element = document.createElement("div");
  element.className = `slot-grid ${className}`;

  return {
    element,
    update(slots: readonly SlotView[]) {
      element.replaceChildren(
        ...slots.map((slot, index) => {
          const button = document.createElement("button");
          button.className = "item-slot";
          button.type = "button";
          button.dataset.selected = String(Boolean(slot.selected));
          button.dataset.empty = String(Boolean(slot.empty));
          button.ariaLabel = slot.label;
          button.addEventListener("click", () => onSlotClick(index));

          if (slot.iconUrl) {
            const image = document.createElement("img");
            image.src = slot.iconUrl;
            image.alt = "";
            button.append(image);
          }

          const label = document.createElement("span");
          label.className = "slot-label";
          label.textContent = slot.label;
          button.append(label);

          if (slot.quantity && slot.quantity > 1) {
            const quantity = document.createElement("span");
            quantity.className = "slot-quantity";
            quantity.textContent = String(slot.quantity);
            button.append(quantity);
          }

          return button;
        }),
      );
    },
  };
}
