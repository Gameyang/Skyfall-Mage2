import { describe, expect, it } from "vitest";
import { calculateBloomIntensityScale } from "../render/webgpu/combatField/CombatFieldGpu";

describe("calculateBloomIntensityScale", () => {
  it("keeps the desktop-tuned area at full bloom strength", () => {
    expect(calculateBloomIntensityScale(960, 540)).toBe(1);
  });

  it("reduces bloom strength on compact logical playfields", () => {
    expect(calculateBloomIntensityScale(520, 360)).toBeCloseTo(0.601, 3);
  });

  it("clamps very small canvases to a readable lower bound", () => {
    expect(calculateBloomIntensityScale(320, 180)).toBe(0.58);
  });

  it("does not increase bloom above the tuned desktop strength", () => {
    expect(calculateBloomIntensityScale(1600, 900)).toBe(1);
  });
});
