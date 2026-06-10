// Responsibility: Request browser fullscreen from mobile user gestures.
// Owner: ui/shell

import { classifyLayoutMode, type LayoutViewport } from "./LayoutMode";

export interface MobileFullscreenController {
  requestIfNeeded(): void;
  dispose(): void;
}

export type MobileFullscreenViewportReader = () => LayoutViewport;

export interface MobileFullscreenControllerOptions {
  readonly ignoredGestureTargets?: readonly HTMLElement[];
}

export interface MobileFullscreenDecision {
  readonly viewport: LayoutViewport;
  readonly fullscreenElement: Element | null;
  readonly canRequestFullscreen: boolean;
}

type FullscreenRequester = (options?: FullscreenOptions) => Promise<void> | void;

interface WebkitFullscreenDocument extends Document {
  readonly webkitFullscreenElement?: Element | null;
}

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const fullscreenAttemptCooldownMs = 1000;

export function createMobileFullscreenController(
  root: HTMLElement,
  readViewport: MobileFullscreenViewportReader = readBrowserFullscreenViewport,
  options: MobileFullscreenControllerOptions = {},
): MobileFullscreenController {
  let disposed = false;
  let requestPending = false;
  let lastAttemptTimeMs = Number.NEGATIVE_INFINITY;

  const requestFullscreenIfNeeded = async (): Promise<void> => {
    if (disposed || requestPending) {
      return;
    }

    const requester = getFullscreenRequester(root);
    const shouldRequest = shouldRequestMobileFullscreen({
      viewport: readViewport(),
      fullscreenElement: getFullscreenElement(root.ownerDocument),
      canRequestFullscreen: requester !== null,
    });

    if (!shouldRequest || requester === null) {
      return;
    }

    const now = performance.now();
    if (now - lastAttemptTimeMs < fullscreenAttemptCooldownMs) {
      return;
    }

    requestPending = true;

    try {
      await requester({ navigationUI: "hide" });
      lastAttemptTimeMs = now;
    } catch {
      // Some mobile browsers reject fullscreen requests outside installed/PWA contexts.
    } finally {
      requestPending = false;
    }
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" || isIgnoredGestureTarget(event.target, options.ignoredGestureTargets ?? [])) {
      return;
    }

    void requestFullscreenIfNeeded();
  };

  const handleTouchStart = (event: TouchEvent): void => {
    if (isIgnoredGestureTarget(event.target, options.ignoredGestureTargets ?? [])) {
      return;
    }

    void requestFullscreenIfNeeded();
  };

  root.addEventListener("pointerdown", handlePointerDown, { capture: true });
  root.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });

  return {
    requestIfNeeded() {
      void requestFullscreenIfNeeded();
    },

    dispose() {
      disposed = true;
      root.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      root.removeEventListener("touchstart", handleTouchStart, { capture: true });
    },
  };
}

function isIgnoredGestureTarget(target: EventTarget | null, ignoredTargets: readonly HTMLElement[]): boolean {
  if (!(target instanceof Node)) {
    return false;
  }

  return ignoredTargets.some((ignoredTarget) => ignoredTarget.contains(target));
}

export function shouldRequestMobileFullscreen(decision: MobileFullscreenDecision): boolean {
  if (decision.fullscreenElement !== null || !decision.canRequestFullscreen) {
    return false;
  }

  return classifyLayoutMode(decision.viewport) !== "desktop-landscape";
}

function getFullscreenElement(document: Document): Element | null {
  const webkitDocument = document as WebkitFullscreenDocument;
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

function getFullscreenRequester(element: HTMLElement): FullscreenRequester | null {
  const webkitElement = element as WebkitFullscreenElement;

  if (typeof element.requestFullscreen === "function") {
    return (options) => element.requestFullscreen(options);
  }

  if (typeof webkitElement.webkitRequestFullscreen === "function") {
    return () => webkitElement.webkitRequestFullscreen?.();
  }

  return null;
}

function readBrowserFullscreenViewport(): LayoutViewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  };
}
