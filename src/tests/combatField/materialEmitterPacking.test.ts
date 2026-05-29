import { describe, expect, it } from "vitest";

import { combatMaterialIds } from "../../features/combatField/CombatFieldTypes";
import { MaterialEmitterQueue } from "../../features/combatField/MaterialEmitterQueue";
import { materialEmitterStride } from "../../features/combatField/MaterialEmitterPacking";

describe("MaterialEmitterQueue", () => {
  it("packs queued emitters into fixed-stride float data", () => {
    const queue = new MaterialEmitterQueue(2);

    expect(
      queue.enqueue({
        material: "fire",
        x: 0.25,
        y: 0.5,
        radius: 0.1,
        strength: 0.8,
        ttlMs: 120,
      }),
    ).toBe(true);

    const packed = queue.pack();

    expect(packed).toHaveLength(2 * materialEmitterStride);
    expect(packed[0]).toBe(combatMaterialIds.fire);
    expect(packed[1]).toBeCloseTo(0.25);
    expect(packed[2]).toBeCloseTo(0.5);
    expect(packed[3]).toBeCloseTo(0.1);
    expect(packed[4]).toBeCloseTo(0.8);
    expect(packed[5]).toBeCloseTo(120);
  });

  it("rejects emitters after the configured capacity", () => {
    const queue = new MaterialEmitterQueue(1);

    expect(
      queue.enqueue({
        material: "spark",
        x: 0.1,
        y: 0.2,
        radius: 0.03,
        strength: 1,
        ttlMs: 60,
      }),
    ).toBe(true);
    expect(
      queue.enqueue({
        material: "water",
        x: 0.4,
        y: 0.5,
        radius: 0.08,
        strength: 0.5,
        ttlMs: 80,
      }),
    ).toBe(false);
  });
});
