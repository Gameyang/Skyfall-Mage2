import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseMaterialRegistryXml } from "../../features/combatField/materials/MaterialRegistryXmlParser";

describe("parseMaterialRegistryXml", () => {
  it("parses authored material and reaction fixture data", () => {
    const fixture = readFileSync(resolve("src/tests/fixtures/material-reactions.fixture.xml"), "utf8");
    const registry = parseMaterialRegistryXml(fixture);

    expect(registry.materials.map((material) => material.id)).toEqual(["water", "fire", "steam"]);
    expect(registry.reactions).toEqual([
      {
        id: "water-fire-steam",
        inputA: "water",
        inputB: "fire",
        resultA: "steam",
        resultB: "steam",
        heatDelta: 0.45,
        life: 16,
      },
    ]);
  });

  it("rejects material names outside the authored registry contract", () => {
    expect(() =>
      parseMaterialRegistryXml('<materials><material id="unknown" density="1" motion="gas" heatCapacity="1" color="0,0,0,0" /></materials>'),
    ).toThrow(/Unknown material id/);
  });
});
