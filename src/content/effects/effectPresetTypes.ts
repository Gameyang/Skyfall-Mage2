// Responsibility: Define serializable, editor-facing effect preset contracts.
// Owner: content/effects

import type { Vec2 } from "../../core/math/vector";
import type { assetUrls } from "../../platform/assets";
import type { SheetRect } from "../sheets/sheetTypes";

export type EffectTextureKey = keyof typeof assetUrls.effects;

export type EffectLayerKind = "sprite" | "particle" | "trail" | "glow";
export type EffectDrawMode = "texture" | "radial" | "streak";
export type EffectBlendMode = "alpha" | "screen" | "additive";
export type EffectFrameMode = "loop" | "once" | "hold";
export type EffectSizeMode = "absolute" | "radius" | "body";
export type EffectSpawnDistribution = "point" | "box" | "anchors";
export type EffectFacingMode = "fixed" | "context" | "random";
export type EffectSheetDefinitionId = string;

export type EffectOutputKind =
  | "fireball-projectile"
  | "fireball-impact"
  | "fire-area-burn"
  | "burn-overlay"
  | "effect-sprite"
  | "effect-particle"
  | "effect-trail"
  | "effect-glow";

export interface EffectCurvePoint {
  readonly at: number;
  readonly value: number;
}

export type EffectSheetRect = SheetRect;

export type EffectOpacitySource =
  | {
      readonly kind: "none";
    }
  | {
      readonly kind: "lifeRatio";
      readonly min: number;
      readonly max: number;
    }
  | {
      readonly kind: "remainingFade";
      readonly fadeMs: number;
      readonly max: number;
    };

export interface EffectSpawnConfig {
  readonly count: number;
  readonly countJitter: number;
  readonly distribution: EffectSpawnDistribution;
  readonly spreadMode: EffectSizeMode;
  readonly spread: Vec2;
  readonly anchors: readonly Vec2[];
}

export interface EffectLayerBase {
  readonly id: string;
  readonly label: string;
  readonly kind: EffectLayerKind;
  readonly outputKind: EffectOutputKind;
  readonly startMs: number;
  readonly durationMs: number;
  readonly sortLayer: number;
  readonly drawMode: EffectDrawMode;
  readonly offsetMode: EffectSizeMode;
  readonly offset: Vec2;
  readonly sizeMode: EffectSizeMode;
  readonly size: Vec2;
  readonly opacity: number;
  readonly opacityCurve: readonly EffectCurvePoint[];
  readonly opacitySource: EffectOpacitySource;
  readonly color: string;
  readonly blendMode: EffectBlendMode;
  readonly rotationRadians: number;
  readonly alignToDirection: boolean;
  readonly randomRotationRadians: number;
  readonly randomScale: number;
  readonly facingMode: EffectFacingMode;
  readonly softness: number;
  readonly glowStrength: number;
  readonly spawn: EffectSpawnConfig;
}

export interface EffectSpriteLayer extends EffectLayerBase {
  readonly kind: "sprite";
  readonly drawMode: "texture";
  readonly textureKey: EffectTextureKey;
  readonly sheetId: EffectSheetDefinitionId | null;
  readonly sheetRect: EffectSheetRect;
  readonly frameCount: number;
  readonly frameMs: number;
  readonly frameMode: EffectFrameMode;
}

export interface EffectParticleLayer extends EffectLayerBase {
  readonly kind: "particle";
  readonly textureKey: EffectTextureKey | null;
  readonly sheetId: EffectSheetDefinitionId | null;
  readonly sheetRect: EffectSheetRect;
  readonly frameCount: number;
  readonly frameMs: number;
  readonly frameMode: EffectFrameMode;
  readonly lifetimeMs: number;
  readonly velocity: Vec2;
  readonly speedJitter: number;
  readonly spreadAngleRadians: number;
  readonly gravity: Vec2;
  readonly drag: number;
}

export interface EffectTrailLayer extends EffectLayerBase {
  readonly kind: "trail";
  readonly drawMode: "streak";
}

export interface EffectGlowLayer extends EffectLayerBase {
  readonly kind: "glow";
  readonly drawMode: "radial";
}

export type EffectLayer = EffectSpriteLayer | EffectParticleLayer | EffectTrailLayer | EffectGlowLayer;

export interface EffectPreviewConfig {
  readonly origin: Vec2;
  readonly direction: Vec2;
  readonly radius: number;
  readonly bodySize: Vec2;
}

export interface EffectPreset {
  readonly id: string;
  readonly label: string;
  readonly durationMs: number;
  readonly loop: boolean;
  readonly preview: EffectPreviewConfig;
  readonly layers: readonly EffectLayer[];
}

export interface EffectEvaluationContext {
  readonly instanceId: string;
  readonly origin: Vec2;
  readonly direction: Vec2;
  readonly radius: number;
  readonly bodySize: Vec2;
  readonly lifeRatio: number;
  readonly remainingMs: number;
  readonly facing: -1 | 1;
  readonly seed: string;
}

export interface EvaluatedEffectQuad {
  readonly id: string;
  readonly kind: EffectOutputKind;
  readonly drawMode: EffectDrawMode;
  readonly textureKey: EffectTextureKey | null;
  readonly sheetId: EffectSheetDefinitionId | null;
  readonly position: Vec2;
  readonly size: Vec2;
  readonly frameIndex: number;
  readonly frameCount: number;
  readonly opacity: number;
  readonly rotationRadians: number;
  readonly facing: -1 | 1;
  readonly color: readonly [number, number, number];
  readonly blendMode: EffectBlendMode;
  readonly glowStrength: number;
  readonly softness: number;
  readonly layer: number;
  readonly sheetRect: EffectSheetRect;
  readonly sheetColumns: number;
  readonly sheetRows: number;
}
