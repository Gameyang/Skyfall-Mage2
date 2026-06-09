// Responsibility: Bind UI actions to pointer-safe presses without relying on synthesized clicks.
// Owner: ui/components

export const syntheticClickSuppressionMs = 650;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface PressActionBinding {
  dispose(): void;
}

export function bindPressAction(element: HTMLElement, action: () => void): PressActionBinding {
  let activePointerId: number | null = null;
  let lastPointerActivationMs = Number.NEGATIVE_INFINITY;

  const handlePointerDown = (event: PointerEvent): void => {
    if (!shouldAcceptPressPointer(activePointerId, event.pointerType, event.button) || isDisabledControl(element)) {
      return;
    }

    activePointerId = event.pointerId;
    setPointerCaptureIfAvailable(element, event.pointerId);
    preventDefaultIfCancelable(event);
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    releasePointerCaptureIfAvailable(element, event.pointerId);
    preventDefaultIfCancelable(event);

    if (isDisabledControl(element) || !isPointInsideRect({ x: event.clientX, y: event.clientY }, element.getBoundingClientRect())) {
      return;
    }

    lastPointerActivationMs = performance.now();
    action();
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    releasePointerCaptureIfAvailable(element, event.pointerId);
  };

  const handleClick = (event: MouseEvent): void => {
    if (isDisabledControl(element)) {
      return;
    }

    if (shouldSuppressSyntheticClick(performance.now(), lastPointerActivationMs)) {
      preventDefaultIfCancelable(event);
      return;
    }

    action();
  };

  element.addEventListener("pointerdown", handlePointerDown);
  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("pointercancel", handlePointerCancel);
  element.addEventListener("lostpointercapture", handlePointerCancel);
  element.addEventListener("click", handleClick);

  return {
    dispose() {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerCancel);
      element.removeEventListener("lostpointercapture", handlePointerCancel);
      element.removeEventListener("click", handleClick);
    },
  };
}

export function shouldAcceptPressPointer(
  activePointerId: number | null,
  pointerType: string,
  button: number,
): boolean {
  if (activePointerId !== null) {
    return false;
  }

  return pointerType !== "mouse" || button === 0;
}

export function shouldSuppressSyntheticClick(nowMs: number, lastPointerActivationMs: number): boolean {
  return nowMs - lastPointerActivationMs < syntheticClickSuppressionMs;
}

export function isPointInsideRect(point: Point, rect: RectLike): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export function isDisabledControl(element: HTMLElement): boolean {
  return Boolean((element as { disabled?: boolean }).disabled);
}

export function preventDefaultIfCancelable(event: Event): void {
  if (event.cancelable) {
    event.preventDefault();
  }
}

export function setPointerCaptureIfAvailable(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Pointer capture can fail if the browser has already canceled this pointer.
  }
}

export function releasePointerCaptureIfAvailable(element: HTMLElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // Nothing to release.
  }
}
