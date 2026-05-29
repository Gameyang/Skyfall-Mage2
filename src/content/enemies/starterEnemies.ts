// Responsibility: Provide starter enemy definitions for the first vertical slice.
// Owner: content/enemies

import { assetUrls } from "../../platform/assets";
import type { EnemyDefinition } from "./EnemyDefinition";

export const starterEnemies: readonly EnemyDefinition[] = [
  {
    id: "bat",
    name: "Ash Bat",
    iconUrl: assetUrls.enemies.bat,
    maxHp: 36,
    kind: "normal",
    patternId: "none",
  },
  {
    id: "ember-miniboss",
    name: "Ember Warden",
    iconUrl: assetUrls.enemies.bat,
    maxHp: 120,
    kind: "miniboss",
    patternId: "ember-ring",
  },
  {
    id: "rain-boss",
    name: "Rain Tyrant",
    iconUrl: assetUrls.enemies.bat,
    maxHp: 260,
    kind: "boss",
    patternId: "rain-pressure",
  },
];

export const starterEnemyById = new Map(starterEnemies.map((enemy) => [enemy.id, enemy]));
