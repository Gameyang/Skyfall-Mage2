// Responsibility: Translate playfield pointer ownership into aim and attack commands.
// Owner: input

import type { GameCommand } from "../core/state/Command";
import { pointerToAimCommand } from "./InputMapper";
import { pointerToNormalized } from "./ViewportMapper";

type CommandSink = (command: GameCommand) => void;

export class PointerInput {
  private activePointerId: number | null = null;

  constructor(
    private readonly playfieldElement: HTMLElement,
    private readonly sink: CommandSink,
  ) {
    playfieldElement.addEventListener("pointermove", this.handlePointerMove);
    playfieldElement.addEventListener("pointerdown", this.handlePointerDown);
    playfieldElement.addEventListener("pointerup", this.handlePointerUp);
    playfieldElement.addEventListener("pointercancel", this.handlePointerUp);
  }

  dispose(): void {
    this.playfieldElement.removeEventListener("pointermove", this.handlePointerMove);
    this.playfieldElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.playfieldElement.removeEventListener("pointerup", this.handlePointerUp);
    this.playfieldElement.removeEventListener("pointercancel", this.handlePointerUp);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      return;
    }

    this.sink(pointerToAimCommand(pointerToNormalized(this.playfieldElement, event.clientX, event.clientY), "pointer"));
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      return;
    }

    this.activePointerId = event.pointerId;
    this.playfieldElement.setPointerCapture(event.pointerId);
    this.sink(pointerToAimCommand(pointerToNormalized(this.playfieldElement, event.clientX, event.clientY), "pointer"));
    this.sink({ type: "StartAttack", source: "pointer" });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.activePointerId = null;
    this.sink({ type: "StopAttack", source: "pointer" });
  };
}
