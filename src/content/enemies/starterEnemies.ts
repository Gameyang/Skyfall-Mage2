// Responsibility: Provide starter enemy definitions for the first vertical slice.
// Owner: content/enemies

import { assetUrls } from "../../platform/assets";
import type { EnemyDefinition } from "./EnemyDefinition";

const batSpriteAnimation = {
  textureUrl: assetUrls.enemies.batAnimationSheet,
  frameCount: 12,
  movementFrameCount: 8,
  hitFrameCount: 4,
  movementFrameMs: 90,
  hitFrameMs: 75,
} as const;

export const starterEnemies: readonly EnemyDefinition[] = [
  {
    id: "bat",
    name: "Ash Bat",
    iconUrl: assetUrls.enemies.bat,
    spriteAnimation: batSpriteAnimation,
    maxHp: 36,
    kind: "normal",
    patternId: "none",
  },
  {
    id: "ember-miniboss",
    name: "Ember Warden",
    iconUrl: assetUrls.enemies.bat,
    spriteAnimation: batSpriteAnimation,
    maxHp: 120,
    kind: "miniboss",
    patternId: "ember-ring",
  },
  {
    id: "rain-boss",
    name: "Rain Tyrant",
    iconUrl: assetUrls.enemies.bat,
    spriteAnimation: batSpriteAnimation,
    maxHp: 260,
    kind: "boss",
    patternId: "rain-pressure",
  },
];

export const starterEnemyById = new Map(starterEnemies.map((enemy) => [enemy.id, enemy]));
