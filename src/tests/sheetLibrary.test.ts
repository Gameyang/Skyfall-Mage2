import { describe, expect, it } from "vitest";

import { getSheetDefinition } from "../content/sheets/sheetLibrary";
import { resolveSheetAssetUrl, resolveSheetRect } from "../content/sheets/sheetResolver";

describe("sheet library", () => {
  it("resolves shared effect sheet metadata", () => {
    const sheet = getSheetDefinition("effect-firestaff-projectile");

    expect(resolveSheetAssetUrl(sheet.asset)).toContain("firestaff-projectile");
    expect(resolveSheetRect(sheet.id)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(sheet.frameCount).toBe(8);
    expect(sheet.columns).toBe(8);
    expect(sheet.rows).toBe(1);
    expect(sheet.frameMode).toBe("loop");
  });

  it("resolves unit animation sheets through the same registry", () => {
    const sheet = getSheetDefinition("enemy-bat-animation");

    expect(resolveSheetAssetUrl(sheet.asset)).toContain("bat-animation-sheet.webp");
    expect(sheet.movementFrameCount).toBe(8);
    expect(sheet.hitFrameCount).toBe(4);
  });

  it("resolves generated enemy animation sheets", () => {
    const sheetIds = [
      "enemy-mini-tracking-animation",
      "enemy-mini-teleport-animation",
      "enemy-mini-split-animation",
      "enemy-tracking-boss-animation",
      "enemy-teleport-boss-animation",
      "enemy-split-boss-animation",
    ];

    for (const sheetId of sheetIds) {
      const sheet = getSheetDefinition(sheetId);

      expect(resolveSheetAssetUrl(sheet.asset)).toContain("-animation-sheet.webp");
      expect(sheet.frameCount).toBe(12);
      expect(sheet.movementFrameCount).toBe(8);
      expect(sheet.hitFrameCount).toBe(4);
    }
  });
});
