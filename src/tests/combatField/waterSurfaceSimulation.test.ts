import { describe, expect, it } from "vitest";

import { WaterSurfaceSimulation } from "../../render/webgpu/combatField/WaterSurfaceSimulation";

describe("WaterSurfaceSimulation", () => {
  it("distributes radius impulses across nearby spring columns", () => {
    const simulation = new WaterSurfaceSimulation({ columns: 16, damping: 0.02, tension: 0.02, spread: 0.08 });

    simulation.applyImpulse({ x: 0.5, radius: 0.16, velocity: 5, kind: "force" });
    simulation.update(16.6667);

    const heights = simulation.readHeights();
    const center = heights[8] ?? 0;

    expect(center).toBeGreaterThan(0);
    expect(heights[7]).toBeGreaterThan(0);
    expect(heights[9]).toBeGreaterThan(0);
    expect(Math.abs(heights[0] ?? 0)).toBeLessThan(0.001);
  });

  it("uses spread to widen wave propagation without increasing the peak impulse", () => {
    const base = new WaterSurfaceSimulation({ columns: 16, damping: 0, tension: 0, spread: 0.08 });
    const wider = new WaterSurfaceSimulation({ columns: 16, damping: 0, tension: 0, spread: 0.16 });

    base.applyImpulse({ x: 0.5, radius: 1 / 16, velocity: 4, kind: "drop" });
    wider.applyImpulse({ x: 0.5, radius: 1 / 16, velocity: 4, kind: "drop" });
    base.update(16.6667);
    wider.update(16.6667);

    const baseHeights = base.readHeights();
    const widerHeights = wider.readHeights();
    const baseSideWave = Math.abs(baseHeights[6] ?? 0) + Math.abs(baseHeights[9] ?? 0);
    const widerSideWave = Math.abs(widerHeights[6] ?? 0) + Math.abs(widerHeights[9] ?? 0);

    expect(widerSideWave).toBeGreaterThan(baseSideWave * 1.8);
    expect(Math.max(...widerHeights)).toBeLessThanOrEqual(Math.max(...baseHeights));
  });

  it("keeps battlefield water tuning bounded under repeated impacts", () => {
    const simulation = new WaterSurfaceSimulation({ columns: 64, damping: 0.045, tension: 0.027, spread: 0.32 });

    for (let frame = 0; frame < 48; frame += 1) {
      if (frame % 6 === 0) {
        simulation.applyImpulse({
          x: 0.18 + ((frame / 6) % 5) * 0.16,
          radius: 1 / 64,
          velocity: 3.4,
          kind: "drop",
        });
      }
      simulation.update(16.6667);
    }

    const heights = simulation.readHeights();

    expect(maxAbs(heights)).toBeLessThan(12);
    expect(maxAdjacentDelta(heights)).toBeLessThan(8);
  });

  it("clamps extreme impulses and reset clears spring state", () => {
    const simulation = new WaterSurfaceSimulation({ columns: 8, maxHeight: 10, maxVelocity: 4 });

    simulation.applyImpulse({ x: 0.5, radius: 0.5, velocity: 500, kind: "force" });
    simulation.update(16.6667);

    expect(Math.max(...simulation.readHeights())).toBeLessThanOrEqual(10);

    simulation.reset();

    expect(Array.from(simulation.readHeights()).every((height) => height === 0)).toBe(true);
  });
});

function maxAbs(heights: Float32Array<ArrayBuffer>): number {
  return Math.max(...Array.from(heights, Math.abs));
}

function maxAdjacentDelta(heights: Float32Array<ArrayBuffer>): number {
  return Array.from(heights).reduce((maxDelta, height, index) => {
    if (index === 0) {
      return maxDelta;
    }

    return Math.max(maxDelta, Math.abs(height - (heights[index - 1] ?? 0)));
  }, 0);
}
