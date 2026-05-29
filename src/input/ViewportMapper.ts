// Responsibility: Convert DOM pointer positions to normalized panel coordinates.
// Owner: input

import type { NormalizedPointer } from "./InputTypes";

export function pointerToNormalized(element: HTMLElement, clientX: number, clientY: number): NormalizedPointer {
  const rect = element.getBoundingClientRect();
  const x = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
  const y = rect.height <= 0 ? 0 : (clientY - rect.top) / rect.height;

  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}
