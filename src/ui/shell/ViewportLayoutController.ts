// Responsibility: Keep shell layout mode in sync with the browser viewport.
// Owner: ui/shell

import { classifyLayoutMode, type LayoutViewport } from "./LayoutMode";

export interface ViewportLayoutController {
  dispose(): void;
}

export type LayoutViewportReader = () => LayoutViewport;

export function createViewportLayoutController(
  root: HTMLElement,
  readViewport: LayoutViewportReader = readBrowserLayoutViewport,
): ViewportLayoutController {
  let disposed = false;
  let frameId = 0;
  const pointerQuery = window.matchMedia("(pointer: coarse)");

  const apply = () => {
    frameId = 0;

    if (disposed) {
      return;
    }

    const viewport = readViewport();
    root.dataset.layoutMode = classifyLayoutMode(viewport);
  };

  const schedule = () => {
    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
    }

    frameId = window.requestAnimationFrame(apply);
  };

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  pointerQuery.addEventListener("change", schedule);
  apply();

  return {
    dispose() {
      disposed = true;
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      pointerQuery.removeEventListener("change", schedule);

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    },
  };
}

function readBrowserLayoutViewport(): LayoutViewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  };
}
