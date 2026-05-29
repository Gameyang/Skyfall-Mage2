// Responsibility: Advance dropped item marker motion before pickup collection.
// Owner: features/inventory

import { addVec2, clamp, scaleVec2 } from "../../core/math/vector";
import type { GameState } from "../../core/state/GameState";

const gravityPerSecond = 0.2;
const floorY = 0.86;
const horizontalDamping = 0.92;
const bounceDamping = 0.36;

export function advanceItemDropPhysics(state: GameState, deltaMs: number): GameState {
  if (deltaMs <= 0 || state.entities.itemDrops.length === 0) {
    return state;
  }

  const deltaSeconds = Math.min(deltaMs, 100) / 1000;

  return {
    ...state,
    entities: {
      ...state.entities,
      itemDrops: state.entities.itemDrops.map((drop) => {
        const velocity = {
          x: drop.velocity.x * horizontalDamping,
          y: drop.velocity.y + gravityPerSecond * deltaSeconds,
        };
        const nextPosition = addVec2(drop.position, scaleVec2(velocity, deltaSeconds));

        if (nextPosition.y >= floorY) {
          return {
            ...drop,
            position: {
              x: clamp(nextPosition.x, 0.06, 0.94),
              y: floorY,
            },
            velocity: {
              x: velocity.x,
              y: -Math.abs(velocity.y) * bounceDamping,
            },
            ageMs: drop.ageMs + deltaMs,
          };
        }

        return {
          ...drop,
          position: {
            x: clamp(nextPosition.x, 0.06, 0.94),
            y: clamp(nextPosition.y, 0.1, floorY),
          },
          velocity,
          ageMs: drop.ageMs + deltaMs,
        };
      }),
    },
  };
}
