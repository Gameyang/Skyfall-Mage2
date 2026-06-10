import { describe, expect, it } from "vitest";

import { getEffectPreset } from "../content/effects/effectPresets";
import { evaluateEffectPreset } from "../content/effects/effectEvaluation";
import type { EffectEvaluationContext } from "../content/effects/effectPresetTypes";
import { createEffectSpritesFromPreset } from "../render/snapshots/createEffectSpritesFromPreset";

const baseContext: EffectEvaluationContext = {
  instanceId: "test-effect",
  origin: { x: 0.5, y: 0.55 },
  direction: { x: 1, y: -0.1 },
  radius: 0.1,
  bodySize: { x: 0.1, y: 0.1 },
  lifeRatio: 1,
  remainingMs: 1_000,
  facing: 1,
  seed: "test-seed",
};

describe("effect preset evaluation", () => {
  it("evaluates particle, glow, and trail layers deterministically", () => {
    const preset = getEffectPreset("arcane-particle-burst");
    const first = evaluateEffectPreset(preset, 240, baseContext);
    const second = evaluateEffectPreset(preset, 240, baseContext);

    expect(first).toEqual(second);
    expect(first.some((quad) => quad.drawMode === "radial" && quad.kind === "effect-glow")).toBe(true);
    expect(first.some((quad) => quad.drawMode === "radial" && quad.kind === "effect-particle")).toBe(true);
    expect(first.some((quad) => quad.drawMode === "streak" && quad.kind === "effect-trail")).toBe(true);
    expect(first.every((quad) => quad.opacity >= 0 && quad.opacity <= 1)).toBe(true);
  });

  it("uses preset opacity context for life-ratio driven burn layers", () => {
    const preset = getEffectPreset("fire-area-burn");
    const highLife = createEffectSpritesFromPreset(preset, 100, {
      ...baseContext,
      lifeRatio: 1,
      remainingMs: 2_000,
    });
    const lowLife = createEffectSpritesFromPreset(preset, 100, {
      ...baseContext,
      lifeRatio: 0.25,
      remainingMs: 500,
    });

    expect(highLife).toHaveLength(4);
    expect(lowLife).toHaveLength(4);
    expect(highLife[0].kind).toBe("fire-area-burn");
    expect(highLife[0].opacity).toBeGreaterThan(lowLife[0].opacity);
    expect(highLife[0].textureUrl).toContain("firestaff-burn");
  });

  it("clamps one-shot sprite frames at the end of the preset duration", () => {
    const preset = getEffectPreset("fireball-impact");
    const sprites = createEffectSpritesFromPreset(preset, preset.durationMs, baseContext);

    expect(sprites).toHaveLength(1);
    expect(sprites[0].kind).toBe("fireball-impact");
    expect(sprites[0].frameIndex).toBe(7);
    expect(sprites[0].frameCount).toBe(8);
    expect(sprites[0].opacity).toBeCloseTo(0.65);
  });
});
