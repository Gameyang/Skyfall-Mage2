// Responsibility: Translate keyboard input into runtime commands.
// Owner: input

import type { GameCommand } from "../core/state/Command";
import type { MovementKeys } from "./InputTypes";
import { movementKeysToCommand } from "./InputMapper";

type CommandSink = (command: GameCommand) => void;

const movementCodeMap: Record<string, keyof MovementKeys> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
};

const hotbarCodeMap: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
};

export class KeyboardInput {
  private readonly keys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  } = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  constructor(
    private readonly target: Window,
    private readonly sink: CommandSink,
  ) {
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
    target.addEventListener("blur", this.handleBlur);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("blur", this.handleBlur);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const movementKey = movementCodeMap[event.code];

    if (movementKey) {
      event.preventDefault();
      this.keys[movementKey] = true;
      this.sink(movementKeysToCommand(this.keys));
      return;
    }

    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      this.sink({ type: "StartAttack", source: "keyboard" });
      return;
    }

    const hotbarIndex = hotbarCodeMap[event.code];

    if (hotbarIndex !== undefined && !event.repeat) {
      event.preventDefault();
      this.sink({ type: "UseInventorySlot", slotIndex: hotbarIndex });
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const movementKey = movementCodeMap[event.code];

    if (movementKey) {
      event.preventDefault();
      this.keys[movementKey] = false;
      this.sink(movementKeysToCommand(this.keys));
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      this.sink({ type: "StopAttack", source: "keyboard" });
    }
  };

  private readonly handleBlur = (): void => {
    this.keys.left = false;
    this.keys.right = false;
    this.keys.up = false;
    this.keys.down = false;
    this.sink(movementKeysToCommand(this.keys));
    this.sink({ type: "StopAttack", source: "keyboard" });
  };
}
