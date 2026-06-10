// Responsibility: Resolve sprite-sheet metadata into renderer-facing values.
// Owner: content/sheets

import { assetUrls, skinAssetUrls } from "../../platform/assets";
import { findSheetDefinition } from "./sheetLibrary";
import type { SheetAssetRef, SheetDefinition, SheetRect } from "./sheetTypes";

export const defaultSheetRect: SheetRect = { x: 0, y: 0, width: 1, height: 1 };

export interface SheetFrameGrid {
  readonly columns: number;
  readonly rows: number;
}

export function resolveSheetDefinition(sheetId: string | null | undefined): SheetDefinition | null {
  return findSheetDefinition(sheetId);
}

export function resolveSheetAssetUrl(asset: SheetAssetRef): string {
  if (asset.scope === "skins") {
    return skinAssetUrls[asset.key] ?? "";
  }

  const scopedAssets = assetUrls[asset.scope] as Readonly<Record<string, string>> | undefined;
  return scopedAssets?.[asset.key] ?? "";
}

export function resolveSheetAssetUrlById(sheetId: string | null | undefined): string {
  const definition = resolveSheetDefinition(sheetId);
  return definition ? resolveSheetAssetUrl(definition.asset) : "";
}

export function resolveSheetRect(sheetId: string | null | undefined, fallback?: SheetRect): SheetRect {
  return normalizeSheetRect(resolveSheetDefinition(sheetId)?.rect ?? fallback ?? defaultSheetRect);
}

export function resolveSheetFrameGrid(
  sheetId: string | null | undefined,
  fallbackFrameCount = 1,
): SheetFrameGrid {
  const definition = resolveSheetDefinition(sheetId);
  const frameCount = Math.max(1, Math.floor(definition?.frameCount ?? fallbackFrameCount));
  const columns = Math.max(1, Math.floor(definition?.columns ?? frameCount));
  const rows = Math.max(1, Math.floor(definition?.rows ?? Math.ceil(frameCount / columns)));

  return { columns, rows };
}

export function normalizeSheetRect(rect: SheetRect | null | undefined): SheetRect {
  const source = rect ?? defaultSheetRect;
  const x = clamp(Number.isFinite(source.x) ? source.x : 0, 0, 0.999);
  const y = clamp(Number.isFinite(source.y) ? source.y : 0, 0, 0.999);

  return {
    x,
    y,
    width: clamp(Number.isFinite(source.width) ? source.width : 1, 0.001, 1 - x),
    height: clamp(Number.isFinite(source.height) ? source.height : 1, 0.001, 1 - y),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
