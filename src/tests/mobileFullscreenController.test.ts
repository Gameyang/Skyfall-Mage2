import { describe, expect, it } from "vitest";
import { shouldRequestMobileFullscreen } from "../ui/shell/MobileFullscreenController";
import type { LayoutViewport } from "../ui/shell/LayoutMode";

function mobileDecision(viewport: LayoutViewport) {
  return {
    viewport,
    fullscreenElement: null,
    canRequestFullscreen: true,
  };
}

describe("shouldRequestMobileFullscreen", () => {
  it("requests fullscreen for compact landscape screens", () => {
    expect(shouldRequestMobileFullscreen(mobileDecision({ width: 900, height: 430, coarsePointer: false }))).toBe(true);
  });

  it("requests fullscreen for coarse-pointer landscape screens", () => {
    expect(shouldRequestMobileFullscreen(mobileDecision({ width: 1180, height: 740, coarsePointer: true }))).toBe(true);
  });

  it("requests fullscreen while the portrait rotate notice is visible", () => {
    expect(shouldRequestMobileFullscreen(mobileDecision({ width: 430, height: 900, coarsePointer: true }))).toBe(true);
  });

  it("skips roomy desktop screens", () => {
    expect(shouldRequestMobileFullscreen(mobileDecision({ width: 1280, height: 720, coarsePointer: false }))).toBe(false);
  });

  it("skips when fullscreen is already active", () => {
    expect(
      shouldRequestMobileFullscreen({
        ...mobileDecision({ width: 900, height: 430, coarsePointer: true }),
        fullscreenElement: {} as Element,
      }),
    ).toBe(false);
  });

  it("skips when the browser cannot request fullscreen", () => {
    expect(
      shouldRequestMobileFullscreen({
        ...mobileDecision({ width: 900, height: 430, coarsePointer: true }),
        canRequestFullscreen: false,
      }),
    ).toBe(false);
  });
});
