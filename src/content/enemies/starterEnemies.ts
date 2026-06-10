// Responsibility: Provide starter enemy definitions for the first vertical slice.
// Owner: content/enemies

import { getSheetDefinition } from "../sheets/sheetLibrary";
import { resolveSheetAssetUrl } from "../sheets/sheetResolver";
import { assetUrls } from "../../platform/assets";
import type { EnemyDefinition, EnemySpriteAnimationDefinition } from "./EnemyDefinition";

const batSpriteAnimation = createEnemySpriteAnimation("enemy-bat-animation");
const miniTrackingSpriteAnimation = createEnemySpriteAnimation("enemy-mini-tracking-animation");
const miniTeleportSpriteAnimation = createEnemySpriteAnimation("enemy-mini-teleport-animation");
const miniSplitSpriteAnimation = createEnemySpriteAnimation("enemy-mini-split-animation");
const trackingBossSpriteAnimation = createEnemySpriteAnimation("enemy-tracking-boss-animation");
const teleportBossSpriteAnimation = createEnemySpriteAnimation("enemy-teleport-boss-animation");
const splitBossSpriteAnimation = createEnemySpriteAnimation("enemy-split-boss-animation");

export const starterEnemies: readonly EnemyDefinition[] = [
  {
    id: "bat",
    nameKey: "enemy.bat.name",
    iconUrl: assetUrls.enemies.bat,
    spriteAnimation: batSpriteAnimation,
    maxHp: 36,
    kind: "normal",
    patternId: "none",
  },
  {
    id: "ember-miniboss",
    nameKey: "enemy.ember-miniboss.name",
    iconUrl: assetUrls.enemies.teleportBoss,
    spriteAnimation: teleportBossSpriteAnimation,
    maxHp: 120,
    kind: "miniboss",
    patternId: "ember-ring",
  },
  {
    id: "rain-boss",
    nameKey: "enemy.rain-boss.name",
    iconUrl: assetUrls.enemies.splitBoss,
    spriteAnimation: splitBossSpriteAnimation,
    maxHp: 260,
    kind: "boss",
    patternId: "rain-pressure",
  },
  {
    id: "mini-tracking",
    nameKey: "enemy.mini-tracking.name",
    iconUrl: assetUrls.enemies.miniTracking,
    spriteAnimation: miniTrackingSpriteAnimation,
    maxHp: 44,
    kind: "normal",
    patternId: "none",
  },
  {
    id: "mini-teleport",
    nameKey: "enemy.mini-teleport.name",
    iconUrl: assetUrls.enemies.miniTeleport,
    spriteAnimation: miniTeleportSpriteAnimation,
    maxHp: 52,
    kind: "normal",
    patternId: "none",
  },
  {
    id: "mini-split",
    nameKey: "enemy.mini-split.name",
    iconUrl: assetUrls.enemies.miniSplit,
    spriteAnimation: miniSplitSpriteAnimation,
    maxHp: 56,
    kind: "normal",
    patternId: "none",
  },
  {
    id: "tracking-boss",
    nameKey: "enemy.tracking-boss.name",
    iconUrl: assetUrls.enemies.trackingBoss,
    spriteAnimation: trackingBossSpriteAnimation,
    maxHp: 240,
    kind: "boss",
    patternId: "rain-pressure",
  },
  {
    id: "teleport-boss",
    nameKey: "enemy.teleport-boss.name",
    iconUrl: assetUrls.enemies.teleportBoss,
    spriteAnimation: teleportBossSpriteAnimation,
    maxHp: 220,
    kind: "boss",
    patternId: "ember-ring",
  },
  {
    id: "split-boss",
    nameKey: "enemy.split-boss.name",
    iconUrl: assetUrls.enemies.splitBoss,
    spriteAnimation: splitBossSpriteAnimation,
    maxHp: 280,
    kind: "boss",
    patternId: "rain-pressure",
  },
];

export const starterEnemyById = new Map(starterEnemies.map((enemy) => [enemy.id, enemy]));

function createEnemySpriteAnimation(sheetId: string): EnemySpriteAnimationDefinition {
  const sheet = getSheetDefinition(sheetId);

  return {
    textureUrl: resolveSheetAssetUrl(sheet.asset),
    sheetId: sheet.id,
    sheetRect: sheet.rect,
    sheetColumns: sheet.columns ?? sheet.frameCount,
    sheetRows: sheet.rows ?? 1,
    frameCount: sheet.frameCount,
    movementFrameCount: sheet.movementFrameCount ?? sheet.frameCount,
    hitFrameCount: sheet.hitFrameCount ?? 0,
    movementFrameMs: sheet.movementFrameMs ?? sheet.frameMs,
    hitFrameMs: sheet.hitFrameMs ?? sheet.frameMs,
  };
}
