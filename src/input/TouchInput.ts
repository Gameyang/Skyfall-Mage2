// Responsibility: Translate playfield touch gestures into movement commands.
// Owner: input

import type { GameCommand } from "../core/state/Command";
import { touchVectorToCommand } from "./InputMapper";

type CommandSink = (command: GameCommand) => void;
const defaultMovementRadius = 48;

export interface TouchInputOptions {
  readonly onMovementGestureStart?: () => void;
}

export interface MovementAnchor {
  readonly x: number;
  readonly y: number;
  readonly maxRadius: number;
}

export interface MovementAnchorOptions {
  readonly clientX: number;
  readonly clientY: number;
  readonly maxRadius?: number;
}

export class TouchInput {
  private activeMovement: { readonly pointerId: number; readonly anchor: MovementAnchor } | null = null;

  constructor(
    private readonly playfieldElement: HTMLElement,
    private readonly sink: CommandSink,
    private readonly options: TouchInputOptions = {},
  ) {
    playfieldElement.addEventListener("touchstart", this.handleTouchStart, { capture: true, passive: true });
    playfieldElement.addEventListener("pointerdown", this.handlePointerDown);
    playfieldElement.addEventListener("pointermove", this.handlePointerMove);
    playfieldElement.addEventListener("pointerup", this.handlePointerUp);
    playfieldElement.addEventListener("pointercancel", this.handlePointerUp);
    playfieldElement.addEventListener("lostpointercapture", this.handlePointerUp);
  }

  dispose(): void {
    this.playfieldElement.removeEventListener("touchstart", this.handleTouchStart, { capture: true });
    this.playfieldElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.playfieldElement.removeEventListener("pointermove", this.handlePointerMove);
    this.playfieldElement.removeEventListener("pointerup", this.handlePointerUp);
    this.playfieldElement.removeEventListener("pointercancel", this.handlePointerUp);
    this.playfieldElement.removeEventListener("lostpointercapture", this.handlePointerUp);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!canClaimMovementPointer(this.activeMovement?.pointerId ?? null, event.pointerType, event.button)) {
      return;
    }

    this.requestFullscreenFromMovementGesture(event.pointerType);

    const anchor = createMovementAnchor({
      clientX: event.clientX,
      clientY: event.clientY,
    });

    this.activeMovement = { pointerId: event.pointerId, anchor };
    this.playfieldElement.setPointerCapture(event.pointerId);
    preventBattleGestureDefault(event);
    this.emitVector(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeMovement?.pointerId) {
      return;
    }

    preventBattleGestureDefault(event);
    this.emitVector(event);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeMovement?.pointerId) {
      return;
    }

    this.requestFullscreenFromMovementGesture(event.pointerType);
    preventBattleGestureDefault(event);
    this.activeMovement = null;
    this.releasePointerCapture(event.pointerId);
    this.sink(touchVectorToCommand(0, 0));
  };

  private readonly handleTouchStart = (): void => {
    if (this.activeMovement !== null) {
      return;
    }

    this.options.onMovementGestureStart?.();
  };

  private emitVector(event: PointerEvent): void {
    if (!this.activeMovement) {
      return;
    }

    const { x, y } = pointerToMovementVector(this.activeMovement.anchor, event.clientX, event.clientY);
    this.sink(touchVectorToCommand(x, y));
  }

  private releasePointerCapture(pointerId: number): void {
    if (!this.playfieldElement.hasPointerCapture(pointerId)) {
      return;
    }

    this.playfieldElement.releasePointerCapture(pointerId);
  }

  private requestFullscreenFromMovementGesture(pointerType: string): void {
    if (shouldRequestFullscreenForMovementPointer(pointerType)) {
      this.options.onMovementGestureStart?.();
    }
  }
}

export function canClaimMovementPointer(
  activePointerId: number | null,
  pointerType: string,
  button: number,
): boolean {
  if (activePointerId !== null) {
    return false;
  }

  return pointerType !== "mouse" || button === 0;
}

export function shouldRequestFullscreenForMovementPointer(pointerType: string): boolean {
  return pointerType !== "mouse";
}

export function createMovementAnchor(options: MovementAnchorOptions): MovementAnchor {
  const maxRadius = Math.max(1, options.maxRadius ?? defaultMovementRadius);

  return {
    x: options.clientX,
    y: options.clientY,
    maxRadius,
  };
}

export function pointerToMovementVector(anchor: MovementAnchor, clientX: number, clientY: number): { x: number; y: number } {
  return {
    x: clampUnit((clientX - anchor.x) / anchor.maxRadius),
    y: clampUnit((clientY - anchor.y) / anchor.maxRadius),
  };
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function preventBattleGestureDefault(event: PointerEvent): void {
  if (event.cancelable) {
    event.preventDefault();
  }
}
