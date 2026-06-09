import { describe, expect, it } from "vitest";
import { classifyLayoutMode } from "../ui/shell/LayoutMode";

describe("classifyLayoutMode", () => {
  it("uses rotate notice for portrait viewports", () => {
    expect(classifyLayoutMode({ width: 720, height: 1280, coarsePointer: false })).toBe("portrait-rotate-notice");
  });

  it("uses desktop landscape for roomy fine-pointer screens", () => {
    expect(classifyLayoutMode({ width: 1280, height: 720, coarsePointer: false })).toBe("desktop-landscape");
  });

  it("uses mobile landscape for compact landscape screens", () => {
    expect(classifyLayoutMode({ width: 900, height: 430, coarsePointer: false })).toBe("mobile-landscape");
  });

  it("uses mobile landscape for coarse-pointer landscape screens", () => {
    expect(classifyLayoutMode({ width: 1180, height: 740, coarsePointer: true })).toBe("mobile-landscape");
  });
});
