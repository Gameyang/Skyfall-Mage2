// Responsibility: Classify top-level responsive layout modes.
// Owner: ui/shell

export type LayoutMode = "desktop-landscape" | "mobile-landscape" | "portrait-rotate-notice";

export interface LayoutViewport {
  readonly width: number;
  readonly height: number;
  readonly coarsePointer: boolean;
}

export const layoutBreakpoints = {
  compactLandscapeHeight: 560,
  compactLandscapeWidth: 980,
} as const;

export function classifyLayoutMode(viewport: LayoutViewport): LayoutMode {
  if (viewport.height > viewport.width) {
    return "portrait-rotate-notice";
  }

  if (
    viewport.coarsePointer ||
    viewport.height <= layoutBreakpoints.compactLandscapeHeight ||
    viewport.width <= layoutBreakpoints.compactLandscapeWidth
  ) {
    return "mobile-landscape";
  }

  return "desktop-landscape";
}
