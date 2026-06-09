// Responsibility: Render fixed-size item slots without owning gameplay rules.
// Owner: ui/components

import {
  preventDefaultIfCancelable,
  releasePointerCaptureIfAvailable,
  setPointerCaptureIfAvailable,
  shouldAcceptPressPointer,
  shouldSuppressSyntheticClick,
} from "./PressAction";

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

export type SlotGridKind = "equipment" | "bag";

export interface SlotLocation {
  readonly grid: SlotGridKind;
  readonly index: number;
}

export interface SlotPointerStart {
  readonly location: SlotLocation;
  readonly clientX: number;
  readonly clientY: number;
}

export type SlotPointerAction =
  | { readonly type: "tap"; readonly location: SlotLocation }
  | { readonly type: "drop"; readonly from: SlotLocation; readonly to: SlotLocation };

export interface SlotGridHandlers {
  readonly onSlotTap: (location: SlotLocation) => void;
  readonly onSlotDrop: (from: SlotLocation, to: SlotLocation) => void;
}

export const slotDragThresholdPx = 8;

export function createSlotGrid(className: string, grid: SlotGridKind, handlers: SlotGridHandlers): SlotGridHandle {
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
          button.dataset.slotGrid = grid;
          button.dataset.slotIndex = String(index);
          button.dataset.selected = String(Boolean(slot.selected));
          button.dataset.empty = String(Boolean(slot.empty));
          button.ariaLabel = slot.label;
          bindSlotPointerAction(button, { grid, index }, handlers);

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

export function resolveSlotPointerAction(
  start: SlotPointerStart,
  target: SlotLocation | null,
  clientX: number,
  clientY: number,
  dragThresholdPx = slotDragThresholdPx,
): SlotPointerAction | null {
  if (!target) {
    return null;
  }

  if (isSameSlot(start.location, target)) {
    return { type: "tap", location: start.location };
  }

  if (getDistanceSquared(start.clientX, start.clientY, clientX, clientY) >= dragThresholdPx * dragThresholdPx) {
    return { type: "drop", from: start.location, to: target };
  }

  return { type: "tap", location: start.location };
}

export function readSlotLocationFromElement(element: Element | null): SlotLocation | null {
  const slot = element?.closest<HTMLElement>("[data-slot-grid][data-slot-index]");

  if (!slot) {
    return null;
  }

  const grid = slot.dataset.slotGrid;
  const index = Number(slot.dataset.slotIndex);

  if ((grid !== "equipment" && grid !== "bag") || !Number.isInteger(index) || index < 0) {
    return null;
  }

  return { grid, index };
}

function bindSlotPointerAction(button: HTMLElement, location: SlotLocation, handlers: SlotGridHandlers): void {
  let activePointerId: number | null = null;
  let start: SlotPointerStart | null = null;
  let lastPointerActivationMs = Number.NEGATIVE_INFINITY;

  const handlePointerDown = (event: PointerEvent): void => {
    if (!shouldAcceptPressPointer(activePointerId, event.pointerType, event.button)) {
      return;
    }

    activePointerId = event.pointerId;
    start = {
      location,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    button.dataset.pressing = "true";
    setPointerCaptureIfAvailable(button, event.pointerId);
    preventDefaultIfCancelable(event);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId || !start) {
      return;
    }

    if (getDistanceSquared(start.clientX, start.clientY, event.clientX, event.clientY) >= slotDragThresholdPx * slotDragThresholdPx) {
      button.dataset.dragging = "true";
    }

    preventDefaultIfCancelable(event);
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId || !start) {
      return;
    }

    const action = resolveSlotPointerAction(
      start,
      readSlotLocationFromElement(button.ownerDocument.elementFromPoint(event.clientX, event.clientY)),
      event.clientX,
      event.clientY,
    );
    activePointerId = null;
    start = null;
    clearPointerState(button);
    releasePointerCaptureIfAvailable(button, event.pointerId);
    preventDefaultIfCancelable(event);
    lastPointerActivationMs = performance.now();

    if (action?.type === "drop") {
      handlers.onSlotDrop(action.from, action.to);
      return;
    }

    if (action?.type === "tap") {
      handlers.onSlotTap(action.location);
    }
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    start = null;
    clearPointerState(button);
    releasePointerCaptureIfAvailable(button, event.pointerId);
  };

  const handleClick = (event: MouseEvent): void => {
    if (shouldSuppressSyntheticClick(performance.now(), lastPointerActivationMs)) {
      preventDefaultIfCancelable(event);
      return;
    }

    handlers.onSlotTap(location);
  };

  button.addEventListener("pointerdown", handlePointerDown);
  button.addEventListener("pointermove", handlePointerMove);
  button.addEventListener("pointerup", handlePointerUp);
  button.addEventListener("pointercancel", handlePointerCancel);
  button.addEventListener("lostpointercapture", handlePointerCancel);
  button.addEventListener("click", handleClick);
}

function isSameSlot(left: SlotLocation, right: SlotLocation): boolean {
  return left.grid === right.grid && left.index === right.index;
}

function getDistanceSquared(startX: number, startY: number, endX: number, endY: number): number {
  return (endX - startX) * (endX - startX) + (endY - startY) * (endY - startY);
}

function clearPointerState(button: HTMLElement): void {
  delete button.dataset.pressing;
  delete button.dataset.dragging;
}
