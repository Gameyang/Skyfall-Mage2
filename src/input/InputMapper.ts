// Responsibility: Convert raw keyboard, pointer, and touch input into game commands.
// Owner: input

import type { GameCommand } from "../core/state/Command";
import type { MovementKeys } from "./InputTypes";

export function movementKeysToCommand(keys: MovementKeys): GameCommand {
  return {
    type: "MovePlayer",
    x: Number(keys.right) - Number(keys.left),
    y: Number(keys.down) - Number(keys.up),
    source: "keyboard",
  };
}

export function touchVectorToCommand(x: number, y: number): GameCommand {
  return {
    type: "MovePlayer",
    x,
    y,
    source: "touch",
  };
}
