// Responsibility: Convert evaluated effect presets into weapon effect sprite draw data.
// Owner: render/snapshots

import { clamp } from "../../core/math/vector";
import { evaluateEffectPreset } from "../../content/effects/effectEvaluation";
import type { EffectEvaluationContext, EffectPreset } from "../../content/effects/effectPresetTypes";
import { resolveSheetAssetUrlById } from "../../content/sheets/sheetResolver";
import { assetUrls } from "../../platform/assets";
import type { WeaponEffectSprite } from "./RenderSnapshot";

export function createEffectSpritesFromPreset(
  preset: EffectPreset,
  timeMs: number,
  context: EffectEvaluationContext,
): readonly WeaponEffectSprite[] {
  return evaluateEffectPreset(preset, timeMs, context).map((quad) => ({
    id: quad.id,
    kind: quad.kind,
    position: quad.position,
    size: quad.size,
    textureUrl: resolveSheetAssetUrlById(quad.sheetId) || (quad.textureKey ? assetUrls.effects[quad.textureKey] : ""),
    frameIndex: clamp(quad.frameIndex, 0, Math.max(0, quad.frameCount - 1)),
    frameCount: Math.max(1, quad.frameCount),
    opacity: clamp(quad.opacity, 0, 1),
    rotationRadians: quad.rotationRadians,
    facing: quad.facing,
    drawMode: quad.drawMode,
    color: quad.color,
    blendMode: quad.blendMode,
    glowStrength: quad.glowStrength,
    softness: quad.softness,
    layer: quad.layer,
    sheetRect: quad.sheetRect,
    sheetColumns: quad.sheetColumns,
    sheetRows: quad.sheetRows,
  }));
}
