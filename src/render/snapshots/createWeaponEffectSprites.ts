// Responsibility: Convert weapon runtime state into sprite-sheet effect draw data.
// Owner: render/snapshots

import { clamp } from "../../core/math/vector";
import type { Vec2 } from "../../core/math/vector";
import type { EnemyState } from "../../core/state/EntityState";
import type { GameState } from "../../core/state/GameState";
import { getEffectPreset } from "../../content/effects/effectPresets";
import type { EffectEvaluationContext } from "../../content/effects/effectPresetTypes";
import { createEffectSpritesFromPreset } from "./createEffectSpritesFromPreset";
import type { WeaponEffectSprite } from "./RenderSnapshot";

const fireAreaBaseDurationMs = 2_000;
const defaultDirection: Vec2 = { x: 1, y: 0 };

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

    return createPresetSprites("fireball-projectile", projectile.ageMs, {
      instanceId: projectile.id,
      origin: projectile.position,
      direction: projectile.direction,
      radius: projectile.collisionRadius,
      bodySize: { x: projectile.collisionRadius * 2, y: projectile.collisionRadius * 2 },
      lifeRatio: clamp((projectile.maxAgeMs - projectile.ageMs) / Math.max(1, projectile.maxAgeMs), 0, 1),
      remainingMs: Math.max(0, projectile.maxAgeMs - projectile.ageMs),
      facing: 1,
      seed: projectile.id,
    });
  });
}

function createFireAreaEffects(state: GameState): readonly WeaponEffectSprite[] {
  return state.entities.fireDamageAreas.flatMap((area) => {
    const ageMs = clamp(fireAreaBaseDurationMs - area.remainingMs, 0, fireAreaBaseDurationMs);
    const lifeRatio = clamp(area.remainingMs / fireAreaBaseDurationMs, 0, 1);
    const effects: WeaponEffectSprite[] = [];
    const impactPreset = getEffectPreset("fireball-impact");

    if (ageMs < impactPreset.durationMs) {
      effects.push(
        ...createPresetSprites("fireball-impact", ageMs, {
          instanceId: `${area.id}-impact`,
          origin: area.position,
          direction: defaultDirection,
          radius: area.radius,
          bodySize: { x: area.radius * 2, y: area.radius * 2 },
          lifeRatio,
          remainingMs: area.remainingMs,
          facing: 1,
          seed: `${area.id}-impact`,
        }),
      );
    }

    effects.push(
      ...createPresetSprites("fire-area-burn", state.session.elapsedMs, {
        instanceId: `${area.id}-burn`,
        origin: area.position,
        direction: defaultDirection,
        radius: area.radius,
        bodySize: { x: area.radius * 2, y: area.radius * 2 },
        lifeRatio,
        remainingMs: area.remainingMs,
        facing: 1,
        seed: `${area.id}-burn`,
      }),
    );

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
    return createPresetSprites("burn-overlay", state.session.elapsedMs, {
      instanceId: `${enemy.id}-burn-overlay`,
      origin: enemy.position,
      direction: defaultDirection,
      radius: Math.max(bodySize.x, bodySize.y) * 0.5,
      bodySize,
      lifeRatio: clamp(burning.remainingMs / fireAreaBaseDurationMs, 0, 1),
      remainingMs: burning.remainingMs,
      facing: 1,
      seed: `${enemy.id}-burn-overlay`,
    });
  });
}

function getEnemyBodySize(enemy: EnemyState): Vec2 {
  return enemy.kind === "boss" || enemy.kind === "miniboss" ? { x: 0.122, y: 0.122 } : { x: 0.082, y: 0.082 };
}

function createPresetSprites(
  presetId: string,
  timeMs: number,
  context: EffectEvaluationContext,
): readonly WeaponEffectSprite[] {
  return createEffectSpritesFromPreset(getEffectPreset(presetId), timeMs, context);
}
