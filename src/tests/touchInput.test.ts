import { describe, expect, it } from "vitest";

import { canClaimMovementPointer, createMovementAnchor, pointerToMovementVector } from "../input/TouchInput";

describe("TouchInput movement helpers", () => {
  it("claims only the first active movement pointer", () => {
    expect(canClaimMovementPointer(null, "touch", 0)).toBe(true);
    expect(canClaimMovementPointer(10, "touch", 0)).toBe(false);
  });

  it("ignores non-primary mouse buttons", () => {
    expect(canClaimMovementPointer(null, "mouse", 0)).toBe(true);
    expect(canClaimMovementPointer(null, "mouse", 2)).toBe(false);
  });

  it("uses the pointer start as an anchor where the old fixed joystick used to be", () => {
    const anchor = createMovementAnchor({
      clientX: 42,
      clientY: 132,
    });

    expect(anchor).toEqual({ x: 42, y: 132, maxRadius: 48 });
    expect(pointerToMovementVector(anchor, 42, 132)).toEqual({ x: 0, y: 0 });
    expect(pointerToMovementVector(anchor, 90, 132)).toEqual({ x: 1, y: 0 });
  });

  it("uses the pointer start as an anchor for the wider playfield", () => {
    const anchor = createMovementAnchor({
      clientX: 240,
      clientY: 160,
    });

    expect(pointerToMovementVector(anchor, 240, 160)).toEqual({ x: 0, y: 0 });
    expect(pointerToMovementVector(anchor, 264, 136)).toEqual({ x: 0.5, y: -0.5 });
  });

  it("clamps long drags to the movement vector range", () => {
    const anchor = createMovementAnchor({
      clientX: 240,
      clientY: 160,
    });

    expect(pointerToMovementVector(anchor, 400, 0)).toEqual({ x: 1, y: -1 });
  });
});
