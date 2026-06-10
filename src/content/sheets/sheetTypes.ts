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

export interface SheetDefinition {
  readonly id: string;
  readonly label: string;
  readonly asset: SheetAssetRef;
  readonly rect: SheetRect;
  readonly frameCount: number;
  readonly columns?: number;
  readonly rows?: number;
  readonly frameMs: number;
  readonly frameMode: SheetFrameMode;
  readonly movementFrameCount?: number;
  readonly hitFrameCount?: number;
  readonly movementFrameMs?: number;
  readonly hitFrameMs?: number;
  readonly tags: readonly string[];
}
