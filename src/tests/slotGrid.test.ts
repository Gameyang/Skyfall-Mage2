import { describe, expect, it } from "vitest";

import {
  readSlotLocationFromElement,
  resolveSlotPointerAction,
  type SlotPointerStart,
} from "../ui/components/SlotGrid";

const start: SlotPointerStart = {
  location: { grid: "bag", index: 2 },
  clientX: 40,
  clientY: 40,
};

describe("SlotGrid pointer helpers", () => {
  it("treats hold and release on the same slot as a tap", () => {
    expect(resolveSlotPointerAction(start, { grid: "bag", index: 2 }, 40, 40)).toEqual({
      type: "tap",
      location: { grid: "bag", index: 2 },
    });
  });

  it("treats a dragged release on another slot as a drop", () => {
    expect(resolveSlotPointerAction(start, { grid: "bag", index: 5 }, 70, 40)).toEqual({
      type: "drop",
      from: { grid: "bag", index: 2 },
      to: { grid: "bag", index: 5 },
    });
  });

  it("keeps tiny pointer movement as the original tap", () => {
    expect(resolveSlotPointerAction(start, { grid: "equipment", index: 1 }, 43, 42)).toEqual({
      type: "tap",
      location: { grid: "bag", index: 2 },
    });
  });

  it("ignores releases outside a slot", () => {
    expect(resolveSlotPointerAction(start, null, 70, 40)).toBeNull();
  });

  it("reads a slot location from a nested element", () => {
    const label = {
      closest: () => ({
        dataset: {
          slotGrid: "equipment",
          slotIndex: "3",
        },
      }),
    } as unknown as Element;

    expect(readSlotLocationFromElement(label)).toEqual({ grid: "equipment", index: 3 });
  });
});
