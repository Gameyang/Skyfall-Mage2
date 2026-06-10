// Responsibility: Evaluate serializable effect presets into renderer-facing quads.
// Owner: content/effects

import { clamp, normalizeVec2, type Vec2 } from "../../core/math/vector";
import { defaultSheetRect, resolveSheetDefinition, resolveSheetFrameGrid, resolveSheetRect } from "../sheets/sheetResolver";
import type {
  EffectEvaluationContext,
  EffectLayer,
  EffectOpacitySource,
  EffectPreset,
  EffectSizeMode,
  EvaluatedEffectQuad,
} from "./effectPresetTypes";

const defaultOpacityCurve = [{ at: 0, value: 1 }, { at: 1, value: 1 }] as const;

interface EffectFrameTiming {
  readonly frameCount: number;
  readonly frameMs: number;
  readonly frameMode: string;
}

export function evaluateEffectPreset(
  preset: EffectPreset,
  timeMs: number,
  context: EffectEvaluationContext,
): readonly EvaluatedEffectQuad[] {
  const presetDuration = Math.max(1, preset.durationMs);
  const presetTime = preset.loop ? positiveModulo(timeMs, presetDuration) : clamp(timeMs, 0, presetDuration);
  const quads: EvaluatedEffectQuad[] = [];

  for (const layer of preset.layers) {
    const layerDuration = Math.max(1, layer.durationMs);
    const localTime = presetTime - layer.startMs;

    if (localTime < 0 || localTime > layerDuration) {
      continue;
    }

    const layerProgress = clamp(localTime / layerDuration, 0, 1);
    const count = resolveSpawnCount(layer, context);

    for (let index = 0; index < count; index += 1) {
      const seed = `${context.seed}:${preset.id}:${layer.id}:${index}`;
      const randomScale = 1 + hashSigned(`${seed}:scale`) * layer.randomScale;
      const size = scaleVec(layer.size, resolveScale(layer.sizeMode, context), randomScale);
      const position = resolvePosition(layer, index, context, seed);
      const movedPosition = applyLayerMotion(layer, position, localTime, layerProgress, seed);
      const opacity = resolveOpacity(layer.opacitySource, layer.opacity, context) * sampleCurve(layer.opacityCurve, layerProgress);
      const sheetDefinition = "sheetId" in layer ? resolveSheetDefinition(layer.sheetId) : null;
      const frameCount = Math.max(1, Math.floor(sheetDefinition?.frameCount ?? ("frameCount" in layer ? layer.frameCount : 1)));
      const sheetGrid = "sheetId" in layer ? resolveSheetFrameGrid(layer.sheetId, frameCount) : { columns: frameCount, rows: 1 };
      const frameIndex =
        "frameMode" in layer
          ? resolveFrameIndex(
              {
                frameCount,
                frameMs: sheetDefinition?.frameMs ?? layer.frameMs,
                frameMode: sheetDefinition?.frameMode ?? layer.frameMode,
              },
              localTime,
              layerProgress,
              seed,
            )
          : 0;
      const directionRotation = layer.alignToDirection ? Math.atan2(context.direction.y, context.direction.x) : 0;
      const rotation =
        layer.rotationRadians + directionRotation + hashSigned(`${seed}:rotation`) * layer.randomRotationRadians;

      quads.push({
        id: `${context.instanceId}-${layer.id}-${index}`,
        kind: layer.outputKind,
        drawMode: layer.drawMode,
        textureKey: "textureKey" in layer ? layer.textureKey : null,
        sheetId: "sheetId" in layer ? layer.sheetId : null,
        position: movedPosition,
        size,
        frameIndex,
        frameCount,
        opacity: clamp(opacity, 0, 1),
        rotationRadians: rotation,
        facing: resolveFacing(layer, context, seed),
        color: parseHexColor(layer.color),
        blendMode: layer.blendMode,
        glowStrength: layer.glowStrength,
        softness: layer.softness,
        layer: layer.sortLayer,
        sheetRect: "sheetId" in layer ? resolveSheetRect(layer.sheetId, layer.sheetRect) : defaultSheetRect,
        sheetColumns: sheetGrid.columns,
        sheetRows: sheetGrid.rows,
      });
    }
  }

  return quads.sort((a, b) => a.layer - b.layer || a.position.y - b.position.y);
}

function resolveSpawnCount(layer: EffectLayer, context: EffectEvaluationContext): number {
  const jitter = Math.max(0, Math.floor(layer.spawn.countJitter));
  const extra = jitter > 0 ? Math.floor(hashUnit(`${context.seed}:${layer.id}:count`) * (jitter + 1)) : 0;
  return Math.max(0, Math.floor(layer.spawn.count) + extra);
}

function resolvePosition(
  layer: EffectLayer,
  index: number,
  context: EffectEvaluationContext,
  seed: string,
): Vec2 {
  const offsetScale = resolveScale(layer.offsetMode, context);
  const spreadScale = resolveScale(layer.spawn.spreadMode, context);
  let x = context.origin.x + layer.offset.x * offsetScale.x;
  let y = context.origin.y + layer.offset.y * offsetScale.y;

  if (layer.spawn.distribution === "anchors" && layer.spawn.anchors.length > 0) {
    const anchor = layer.spawn.anchors[index % layer.spawn.anchors.length];
    x += anchor.x * context.bodySize.x;
    y += anchor.y * context.bodySize.y;
  }

  if (layer.spawn.distribution === "box" || layer.spawn.distribution === "anchors") {
    x += hashSigned(`${seed}:x`) * layer.spawn.spread.x * spreadScale.x;
    y += hashSigned(`${seed}:y`) * layer.spawn.spread.y * spreadScale.y;
  }

  return { x, y };
}

function applyLayerMotion(
  layer: EffectLayer,
  position: Vec2,
  localTime: number,
  progress: number,
  seed: string,
): Vec2 {
  if (layer.kind !== "particle") {
    return position;
  }

  const seconds = Math.min(localTime, layer.lifetimeMs) / 1_000;
  const direction = normalizeVec2(layer.velocity);
  const speed = Math.hypot(layer.velocity.x, layer.velocity.y);
  const angle = Math.atan2(direction.y, direction.x) + hashSigned(`${seed}:angle`) * layer.spreadAngleRadians;
  const speedScale = 1 + hashSigned(`${seed}:speed`) * layer.speedJitter;
  const dragScale = 1 / (1 + Math.max(0, layer.drag) * progress);
  const vx = Math.cos(angle) * speed * speedScale * dragScale;
  const vy = Math.sin(angle) * speed * speedScale * dragScale;

  return {
    x: position.x + vx * seconds + 0.5 * layer.gravity.x * seconds * seconds,
    y: position.y + vy * seconds + 0.5 * layer.gravity.y * seconds * seconds,
  };
}

function resolveFrameIndex(layer: EffectFrameTiming, localTime: number, progress: number, seed: string): number {
  const frameCount = Math.max(1, layer.frameCount);

  if (layer.frameMode === "hold") {
    return 0;
  }

  if (layer.frameMode === "once") {
    return Math.min(frameCount - 1, Math.floor(progress * frameCount));
  }

  const frameMs = Math.max(1, layer.frameMs);
  const phase = hashUnit(`${seed}:frame`) * frameMs * frameCount;
  return Math.floor((localTime + phase) / frameMs) % frameCount;
}

function resolveOpacity(
  source: EffectOpacitySource,
  baseOpacity: number,
  context: EffectEvaluationContext,
): number {
  switch (source.kind) {
    case "none":
      return baseOpacity;
    case "lifeRatio":
      return source.min + (source.max - source.min) * clamp(context.lifeRatio, 0, 1);
    case "remainingFade":
      return source.max * clamp(context.remainingMs / Math.max(1, source.fadeMs), 0, 1);
    default:
      return baseOpacity;
  }
}

function resolveScale(mode: EffectSizeMode, context: EffectEvaluationContext): Vec2 {
  switch (mode) {
    case "radius":
      return { x: context.radius, y: context.radius };
    case "body":
      return context.bodySize;
    case "absolute":
    default:
      return { x: 1, y: 1 };
  }
}

function scaleVec(value: Vec2, scale: Vec2, randomScale: number): Vec2 {
  return {
    x: Math.max(0.0001, value.x * scale.x * randomScale),
    y: Math.max(0.0001, value.y * scale.y * randomScale),
  };
}

function resolveFacing(layer: EffectLayer, context: EffectEvaluationContext, seed: string): -1 | 1 {
  switch (layer.facingMode) {
    case "context":
      return context.facing;
    case "random":
      return hashUnit(`${seed}:facing`) < 0.5 ? -1 : 1;
    case "fixed":
    default:
      return 1;
  }
}

function sampleCurve(points: readonly { readonly at: number; readonly value: number }[], progress: number): number {
  const curve = points.length > 0 ? points : defaultOpacityCurve;
  const sorted = [...curve].sort((a, b) => a.at - b.at);
  const x = clamp(progress, 0, 1);

  if (x <= sorted[0].at) {
    return sorted[0].value;
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const next = sorted[index];

    if (x <= next.at) {
      const t = clamp((x - previous.at) / Math.max(0.0001, next.at - previous.at), 0, 1);
      return previous.value + (next.value - previous.value) * t;
    }
  }

  return sorted[sorted.length - 1].value;
}

function parseHexColor(color: string): readonly [number, number, number] {
  const normalized = color.trim().replace(/^#/, "");
  const value = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : "ffffff";
  const numeric = Number.parseInt(value, 16);
  return [((numeric >> 16) & 255) / 255, ((numeric >> 8) & 255) / 255, (numeric & 255) / 255];
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hashSigned(value: string): number {
  return hashUnit(value) * 2 - 1;
}

function hashUnit(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0x1_0000_0000;
}
