// Responsibility: Define serializable sprite-sheet metadata contracts.
// Owner: content/sheets

export type SheetAssetScope = "effects" | "enemies" | "items" | "projectiles" | "skins" | "ui";
export type SheetFrameMode = "loop" | "once" | "hold";

export interface SheetAssetRef {
  readonly scope: SheetAssetScope;
  readonly key: string;
}

export interface SheetRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SheetPoint {
  readonly x: number;
  readonly y: number;
}

export interface SheetFramePlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SheetFrameDefinition {
  readonly id: string;
  readonly label: string;
  readonly rect: SheetRect;
  readonly cellRect: SheetRect;
  readonly placement: SheetFramePlacement;
  readonly pivot: SheetPoint;
}

export interface SheetAnimationClip {
  readonly id: string;
  readonly label: string;
  readonly frameIds: readonly string[];
  readonly frameMs?: number;
  readonly frameMode?: SheetFrameMode;
}

export interface SheetDefinition {
  readonly id: string;
  readonly label: string;
  readonly asset: SheetAssetRef;
  readonly rect: SheetRect;
  readonly frameCount: number;
  readonly columns?: number;
  readonly rows?: number;
  readonly frames?: readonly SheetFrameDefinition[];
  readonly clips?: readonly SheetAnimationClip[];
  readonly frameMs: number;
  readonly frameMode: SheetFrameMode;
  readonly movementFrameCount?: number;
  readonly hitFrameCount?: number;
  readonly movementFrameMs?: number;
  readonly hitFrameMs?: number;
  readonly tags: readonly string[];
}
