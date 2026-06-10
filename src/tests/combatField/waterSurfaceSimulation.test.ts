import { describe, expect, it } from "vitest";

import { WaterSurfaceSimulation } from "../../render/webgpu/combatField/WaterSurfaceSimulation";

describe("WaterSurfaceSimulation", () => {
  it("applies original splash input to one spring column", () => {
    const simulation = new WaterSurfaceSimulation({ columns: 10, damping: 0, tension: 0, spread: 0 });

    simulation.splash(0.52, 3);
    simulation.update(16.6667);

    const heights = simulation.readHeights();

    expect(heights[5]).toBe(3);
    expect(heights[4]).toBe(0);
    expect(heights[6]).toBe(0);
  });

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

  it("keeps wake impulses at the original splash scale", () => {
    const drop = new WaterSurfaceSimulation({ columns: 16, damping: 0, tension: 0, spread: 0.08 });
    const wake = new WaterSurfaceSimulation({ columns: 16, damping: 0, tension: 0, spread: 0.08 });

    drop.applyImpulse({ x: 0.5, radius: 1 / 16, velocity: 3, kind: "drop" });
    wake.applyImpulse({ x: 0.5, radius: 1 / 16, velocity: 3, kind: "wake" });
    drop.update(16.6667);
    wake.update(16.6667);

    expect(maxAbs(wake.readHeights())).toBeCloseTo(maxAbs(drop.readHeights()));
  });

  it("uses higher tension to return surface motion faster", () => {
    const original = new WaterSurfaceSimulation({ columns: 12, damping: 0.05, tension: 0.025, spread: 0 });
    const faster = new WaterSurfaceSimulation({ columns: 12, damping: 0.05, tension: 0.042, spread: 0 });

    original.splash(0.5, 3);
    faster.splash(0.5, 3);

    for (let frame = 0; frame < 8; frame += 1) {
      original.update(16.6667);
      faster.update(16.6667);
    }

    expect(maxAbs(faster.readHeights())).toBeLessThan(maxAbs(original.readHeights()));
  });

  it("keeps faster battlefield water tuning bounded under repeated impacts", () => {
    const simulation = new WaterSurfaceSimulation({
      columns: 100,
      damping: 0.05,
      tension: 0.042,
      spread: 0.15,
    });

    for (let frame = 0; frame < 48; frame += 1) {
      if (frame % 6 === 0) {
        simulation.applyImpulse({
          x: 0.18 + ((frame / 6) % 5) * 0.16,
          radius: 1 / 100,
          velocity: 3.4,
          kind: "drop",
        });
      }
      simulation.update(16.6667);
    }

    const heights = simulation.readHeights();

    expect(maxAbs(heights)).toBeLessThan(12);
    expect(maxAdjacentDelta(heights)).toBeLessThan(4.5);
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
