// Responsibility: Convert weapon runtime state into sprite-sheet effect draw data.
// Owner: render/snapshots

import { clamp } from "../../core/math/vector";
import type { Vec2 } from "../../core/math/vector";
import type { EnemyState } from "../../core/state/EntityState";
import type { GameState } from "../../core/state/GameState";
import { assetUrls } from "../../platform/assets";
import type { WeaponEffectSprite } from "./RenderSnapshot";

const spriteFrameCount = 8;
const projectileFrameMs = 70;
const impactAnimationDurationMs = 560;
const fireAreaBaseDurationMs = 2_000;
const burnFrameMs = 90;
const fireAreaFlameCount = 4;
const bodyBurnAnchors: readonly Vec2[] = [
  { x: -0.2, y: 0.08 },
  { x: 0.14, y: -0.08 },
  { x: 0.02, y: -0.24 },
];

export function createWeaponEffectSprites(state: GameState): readonly WeaponEffectSprite[] {
  return [
    ...createProjectileEffects(state),
    ...createFireAreaEffects(state),
    ...createEnemyBurnEffects(state),
  ];
}

function createProjectileEffects(state: GameState): readonly WeaponEffectSprite[] {
  return state.entities.projectiles.flatMap((projectile) => {
    if (projectile.kind !== "fireball") {
      return [];
    }

    return [
      {
        id: `${projectile.id}-sprite`,
        kind: "fireball-projectile",
        position: projectile.position,
        size: { x: 0.112, y: 0.082 },
        textureUrl: assetUrls.effects.firestaffProjectile,
        frameIndex: loopingFrame(projectile.ageMs, projectileFrameMs),
        frameCount: spriteFrameCount,
        opacity: 1,
        rotationRadians: Math.atan2(projectile.direction.y, projectile.direction.x),
        facing: 1,
      },
    ];
  });
}

function createFireAreaEffects(state: GameState): readonly WeaponEffectSprite[] {
  return state.entities.fireDamageAreas.flatMap((area) => {
    const ageMs = clamp(fireAreaBaseDurationMs - area.remainingMs, 0, fireAreaBaseDurationMs);
    const lifeRatio = clamp(area.remainingMs / fireAreaBaseDurationMs, 0, 1);
    const effects: WeaponEffectSprite[] = [];

    if (ageMs < impactAnimationDurationMs) {
      const ageRatio = ageMs / impactAnimationDurationMs;
      effects.push({
        id: `${area.id}-impact`,
        kind: "fireball-impact",
        position: area.position,
        size: { x: area.radius * 2.55, y: area.radius * 1.95 },
        textureUrl: assetUrls.effects.firestaffImpact,
        frameIndex: Math.min(spriteFrameCount - 1, Math.floor(ageRatio * spriteFrameCount)),
        frameCount: spriteFrameCount,
        opacity: 1 - smoothstep(0.72, 1, ageRatio) * 0.35,
        rotationRadians: 0,
        facing: 1,
      });
    }

    for (let index = 0; index < fireAreaFlameCount; index += 1) {
      const offsetX = (hashToUnit(`${area.id}-area-x-${index}`) - 0.5) * area.radius * 1.45;
      const offsetY = (hashToUnit(`${area.id}-area-y-${index}`) - 0.5) * area.radius * 0.62;
      const scale = 0.82 + hashToUnit(`${area.id}-area-scale-${index}`) * 0.38;
      effects.push({
        id: `${area.id}-burn-${index}`,
        kind: "fire-area-burn",
        position: { x: area.position.x + offsetX, y: area.position.y + offsetY - area.radius * 0.18 },
        size: { x: area.radius * 0.46 * scale, y: area.radius * 0.82 * scale },
        textureUrl: assetUrls.effects.firestaffBurn,
        frameIndex: loopingFrame(
          state.session.elapsedMs + hashToUnit(`${area.id}-area-frame-${index}`) * burnFrameMs * spriteFrameCount,
          burnFrameMs,
        ),
        frameCount: spriteFrameCount,
        opacity: clamp(0.24 + lifeRatio * 0.48, 0, 0.72),
        rotationRadians: (hashToUnit(`${area.id}-area-tilt-${index}`) - 0.5) * 0.28,
        facing: hashToUnit(`${area.id}-area-facing-${index}`) < 0.5 ? -1 : 1,
      });
    }

    return effects;
  });
}

function createEnemyBurnEffects(state: GameState): readonly WeaponEffectSprite[] {
  return state.entities.enemies.flatMap((enemy) => {
    const burning = enemy.statusEffects?.find((effect) => effect.id === "burning" && effect.remainingMs > 0);

    if (!burning) {
      return [];
    }

    const bodySize = getEnemyBodySize(enemy);
    const baseFlameSize = getEnemyBurnFlameSize(enemy);
    const flameCount = 2 + Math.floor(hashToUnit(`${enemy.id}-burn-count`) * 2);

    return Array.from({ length: flameCount }, (_, index) => {
      const anchor = bodyBurnAnchors[index] ?? bodyBurnAnchors[bodyBurnAnchors.length - 1];
      const scale = 0.84 + hashToUnit(`${enemy.id}-burn-scale-${index}`) * 0.34;
      const size = { x: baseFlameSize.x * scale, y: baseFlameSize.y * scale };
      const jitterX = (hashToUnit(`${enemy.id}-burn-x-${index}`) - 0.5) * bodySize.x * 0.12;
      const jitterY = (hashToUnit(`${enemy.id}-burn-y-${index}`) - 0.5) * bodySize.y * 0.12;
      const offsetX = anchor.x * bodySize.x + jitterX;
      const offsetY = anchor.y * bodySize.y + jitterY;

      return {
        id: `${enemy.id}-burn-overlay-${index}`,
        kind: "burn-overlay",
        position: { x: enemy.position.x + offsetX, y: enemy.position.y + offsetY - size.y * 0.12 },
        size,
        textureUrl: assetUrls.effects.firestaffBurn,
        frameIndex: loopingFrame(
          state.session.elapsedMs + hashToUnit(`${enemy.id}-burn-frame-${index}`) * burnFrameMs * spriteFrameCount,
          burnFrameMs,
        ),
        frameCount: spriteFrameCount,
        opacity: clamp(burning.remainingMs / 250, 0, 1) * 0.92,
        rotationRadians: (hashToUnit(`${enemy.id}-burn-tilt-${index}`) - 0.5) * 0.34,
        facing: hashToUnit(`${enemy.id}-burn-facing-${index}`) < 0.5 ? -1 : 1,
      };
    });
  });
}

function getEnemyBodySize(enemy: EnemyState): Vec2 {
  return enemy.kind === "boss" || enemy.kind === "miniboss" ? { x: 0.122, y: 0.122 } : { x: 0.082, y: 0.082 };
}

function getEnemyBurnFlameSize(enemy: EnemyState): Vec2 {
  return enemy.kind === "boss" || enemy.kind === "miniboss" ? { x: 0.038, y: 0.066 } : { x: 0.026, y: 0.046 };
}

function loopingFrame(timeMs: number, frameMs: number): number {
  return Math.floor(Math.max(0, timeMs) / frameMs) % spriteFrameCount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hashToUnit(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0x1_0000_0000;
}
