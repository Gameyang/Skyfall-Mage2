// Responsibility: Translate virtual joystick gestures into movement commands.
// Owner: input

import type { GameCommand } from "../core/state/Command";
import { touchVectorToCommand } from "./InputMapper";

type CommandSink = (command: GameCommand) => void;

export class TouchInput {
  private activePointerId: number | null = null;

  constructor(
    private readonly joystickElement: HTMLElement,
    private readonly sink: CommandSink,
  ) {
    joystickElement.addEventListener("pointerdown", this.handlePointerDown);
    joystickElement.addEventListener("pointermove", this.handlePointerMove);
    joystickElement.addEventListener("pointerup", this.handlePointerUp);
    joystickElement.addEventListener("pointercancel", this.handlePointerUp);
  }

  dispose(): void {
    this.joystickElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.joystickElement.removeEventListener("pointermove", this.handlePointerMove);
    this.joystickElement.removeEventListener("pointerup", this.handlePointerUp);
    this.joystickElement.removeEventListener("pointercancel", this.handlePointerUp);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.activePointerId = event.pointerId;
    this.joystickElement.setPointerCapture(event.pointerId);
    this.emitVector(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.emitVector(event);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.sink(touchVectorToCommand(0, 0));
  };

  private emitVector(event: PointerEvent): void {
    const rect = this.joystickElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const x = Math.max(-1, Math.min(1, (event.clientX - centerX) / maxRadius));
    const y = Math.max(-1, Math.min(1, (event.clientY - centerY) / maxRadius));
    this.sink(touchVectorToCommand(x, y));
  }
}
