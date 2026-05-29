// Responsibility: Define raw input data before it is mapped into game commands.
// Owner: input

export interface NormalizedPointer {
  readonly x: number;
  readonly y: number;
}

export interface MovementKeys {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}
