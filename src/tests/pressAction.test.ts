import { describe, expect, it } from "vitest";

import {
  isPointInsideRect,
  shouldAcceptPressPointer,
  shouldSuppressSyntheticClick,
  syntheticClickSuppressionMs,
} from "../ui/components/PressAction";

describe("PressAction helpers", () => {
  it("accepts a primary pointer only when no pointer is active", () => {
    expect(shouldAcceptPressPointer(null, "touch", 0)).toBe(true);
    expect(shouldAcceptPressPointer(1, "touch", 0)).toBe(false);
    expect(shouldAcceptPressPointer(null, "mouse", 0)).toBe(true);
    expect(shouldAcceptPressPointer(null, "mouse", 2)).toBe(false);
  });

  it("suppresses synthetic clicks shortly after pointer activation", () => {
    expect(shouldSuppressSyntheticClick(1000, 1000 - syntheticClickSuppressionMs + 1)).toBe(true);
    expect(shouldSuppressSyntheticClick(1000, 1000 - syntheticClickSuppressionMs)).toBe(false);
  });

  it("checks whether a pointer is released inside a control", () => {
    const rect = { left: 10, top: 20, right: 110, bottom: 120 };

    expect(isPointInsideRect({ x: 10, y: 20 }, rect)).toBe(true);
    expect(isPointInsideRect({ x: 110, y: 120 }, rect)).toBe(true);
    expect(isPointInsideRect({ x: 9, y: 80 }, rect)).toBe(false);
    expect(isPointInsideRect({ x: 50, y: 121 }, rect)).toBe(false);
  });
});
