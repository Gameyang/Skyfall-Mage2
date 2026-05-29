import { describe, expect, it } from "vitest";

import { CpuCombatFieldSimulator } from "../../features/combatField/reference/CpuCombatFieldSimulator";

describe("CpuCombatFieldSimulator", () => {
  it("moves sand downward through air", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(4, 1, "sand");

    simulator.step();

    expect(simulator.getCell(4, 2)).toBe("sand");
    expect(simulator.getCell(4, 1)).toBe("air");
  });

  it("lets water settle and spread", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(3, 5, "staticTerrain");
    simulator.setCell(4, 5, "staticTerrain");
    simulator.setCell(3, 4, "water");

    simulator.step();

    expect(simulator.count("water")).toBe(1);
    expect([simulator.getCell(2, 4), simulator.getCell(4, 4), simulator.getCell(2, 5), simulator.getCell(5, 5)]).toContain(
      "water",
    );
  });

  it("moves smoke upward", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(4, 5, "smoke", 4);

    simulator.step();

    expect(simulator.getCell(4, 4)).toBe("smoke");
  });

  it("turns adjacent water and fire into steam", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(3, 3, "water");
    simulator.setCell(4, 3, "fire", 8, 1);

    simulator.step();

    expect(simulator.count("steam")).toBeGreaterThanOrEqual(2);
  });

  it("turns adjacent lava and water into rock and steam", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(3, 3, "lava", 12, 1);
    simulator.setCell(4, 3, "water");

    simulator.step();

    expect(simulator.count("rock")).toBeGreaterThanOrEqual(1);
    expect(simulator.count("steam")).toBeGreaterThanOrEqual(1);
  });

  it("lets acid corrode terrain and burnable terrain generate smoke", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(2, 3, "acid", 8, 0.2);
    simulator.setCell(3, 3, "corrodibleTerrain");
    simulator.setCell(5, 3, "burnableTerrain");
    simulator.setCell(6, 3, "fire", 8, 1);

    simulator.step();

    expect(simulator.count("smoke")).toBeGreaterThanOrEqual(1);
    expect(simulator.count("fire")).toBeGreaterThanOrEqual(1);
  });

  it("purifies toxic sludge when it contacts water", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(3, 3, "toxicSludge");
    simulator.setCell(4, 3, "water");

    simulator.step();

    expect(simulator.count("toxicSludge")).toBe(0);
    expect(simulator.count("water")).toBeGreaterThanOrEqual(2);
  });

  it("lets force emitters destroy static terrain into open field", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(4, 4, "staticTerrain");

    simulator.emit({ material: "force", x: 4 / 7, y: 4 / 7, radius: 0.05, strength: 1, ttlMs: 16 });
    simulator.step();
    simulator.step();

    expect(simulator.getCell(4, 4)).toBe("air");
  });

  it("pushes nearby movable cells with force pressure", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 8, height: 8, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(2, 2, "force", 4, 0.2);
    simulator.setCell(3, 2, "water");

    simulator.step();

    expect(simulator.getCell(3, 2)).toBe("air");
    expect(simulator.count("water")).toBe(1);
  });

  it("queries entity fire and force coverage as damage", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 16, height: 16, maxEmitters: 8 });
    simulator.clear();
    simulator.emit({
      material: "spark",
      x: 0.5,
      y: 0.5,
      radius: 0.12,
      strength: 1,
      ttlMs: 180,
    });

    const [result] = simulator.query({
      frame: 1,
      hitboxes: [{ id: "enemy-1", x: 0.5, y: 0.5, radius: 0.12 }],
    });

    expect(result?.entityId).toBe("enemy-1");
    expect(result?.fireCoverage).toBeGreaterThan(0);
    expect(result?.damage).toBeGreaterThan(0);
  });

  it("samples magic liquid as entity status and movement summary", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 16, height: 16, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(8, 8, "magicLiquid");

    const [result] = simulator.query({
      frame: 1,
      hitboxes: [{ id: "player", x: 0.5, y: 0.5, radius: 0.03 }],
    });

    expect(result?.magicCoverage).toBeGreaterThan(0);
    expect(result?.statusEffect).toBe("magic");
    expect(result?.movementScale).toBeLessThan(1);
  });

  it("changes combat damage after water/fire material interaction", () => {
    const simulator = new CpuCombatFieldSimulator({ width: 16, height: 16, maxEmitters: 8 });
    simulator.clear();
    simulator.setCell(8, 8, "fire", 8, 1);
    const [before] = simulator.query({
      frame: 1,
      hitboxes: [{ id: "enemy-1", x: 0.5, y: 0.5, radius: 0.04 }],
    });
    simulator.setCell(9, 8, "water");
    simulator.step();
    const [after] = simulator.query({
      frame: 2,
      hitboxes: [{ id: "enemy-1", x: 0.5, y: 0.5, radius: 0.04 }],
    });

    expect(before?.damage).toBeGreaterThan(after?.damage ?? 0);
    expect(simulator.count("steam")).toBeGreaterThan(0);
  });
});
