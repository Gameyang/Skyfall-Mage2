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

  it("clamps extreme impulses and reset clears spring state", () => {
    const simulation = new WaterSurfaceSimulation({ columns: 8, maxHeight: 10, maxVelocity: 4 });

    simulation.applyImpulse({ x: 0.5, radius: 0.5, velocity: 500, kind: "force" });
    simulation.update(16.6667);

    expect(Math.max(...simulation.readHeights())).toBeLessThanOrEqual(10);

    simulation.reset();

    expect(Array.from(simulation.readHeights()).every((height) => height === 0)).toBe(true);
  });
});
