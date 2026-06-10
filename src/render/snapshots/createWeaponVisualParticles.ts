// Responsibility: Convert weapon runtime state into render-only visual particles.
// Owner: render/snapshots

import { addVec2, clamp, scaleVec2 } from "../../core/math/vector";
import type { GameState } from "../../core/state/GameState";
import type { WeaponVisualParticle, WeaponVisualParticleKind } from "./RenderSnapshot";

const fireAreaBaseDurationMs = 2_000;

export function createWeaponVisualParticles(state: GameState): readonly WeaponVisualParticle[] {
  const particles: WeaponVisualParticle[] = [];
  const timeMs = state.session.elapsedMs;

  for (const projectile of state.entities.projectiles) {
    if (projectile.kind !== "fireball") {
      continue;
    }

    const seed = hashToUnit(projectile.id);
    particles.push({
      id: `${projectile.id}-core`,
      kind: "fireball-core",
      position: projectile.position,
      direction: projectile.direction,
      radius: 0.031,
      seed,
      ageRatio: clamp(projectile.ageMs / Math.max(1, projectile.maxAgeMs), 0, 1),
      intensity: 1.55,
      opacity: 0.96,
      stretch: 1.35,
    });

    addFireballTrailParticles(particles, projectile.id, projectile.position, projectile.direction, projectile.ageMs, timeMs);
  }

  for (const area of state.entities.fireDamageAreas) {
    addFireAreaParticles(particles, area.id, area.position, area.radius, area.remainingMs, timeMs);
  }

  for (const enemy of state.entities.enemies) {
    if (!enemy.statusEffects?.some((effect) => effect.id === "burning" && effect.remainingMs > 0)) {
      continue;
    }

    addBurningEnemyParticles(particles, enemy.id, enemy.position, timeMs);
  }

  return particles;
}

function addFireballTrailParticles(
  particles: WeaponVisualParticle[],
  id: string,
  position: GameState["player"]["position"],
  direction: GameState["player"]["movement"],
  projectileAgeMs: number,
  timeMs: number,
): void {
  const tangent = { x: -direction.y, y: direction.x };

  for (let index = 0; index < 14; index += 1) {
    const seed = hashToUnit(`${id}-trail-${index}`);
    const lane = seed < 0.5 ? -1 : 1;
    const flicker = Math.sin(timeMs * 0.018 + seed * 40.0) * 0.5 + 0.5;
    const trailDistance = 0.012 + index * 0.0065 + flicker * 0.005;
    const sideOffset = (seed - 0.5) * 0.024 + lane * Math.sin(timeMs * 0.011 + index) * 0.003;
    const localAge = clamp((projectileAgeMs + index * 22) / 420, 0, 1);
    const trailPosition = addVec2(
      addVec2(position, scaleVec2(direction, -trailDistance)),
      scaleVec2(tangent, sideOffset),
    );

    particles.push({
      id: `${id}-trail-${index}`,
      kind: "fireball-ember",
      position: trailPosition,
      direction,
      radius: 0.010 + (1 - index / 14) * 0.010 + flicker * 0.004,
      seed,
      ageRatio: localAge,
      intensity: 0.82 + flicker * 0.36,
      opacity: clamp(0.72 - index * 0.042, 0.12, 0.72),
      stretch: 1.9,
    });
  }
}

function addFireAreaParticles(
  particles: WeaponVisualParticle[],
  id: string,
  position: GameState["player"]["position"],
  radius: number,
  remainingMs: number,
  timeMs: number,
): void {
  const ageRatio = clamp(1 - remainingMs / fireAreaBaseDurationMs, 0, 1);
  const lifeFade = 1 - smoothstep(0.72, 1, ageRatio);

  for (let index = 0; index < 36; index += 1) {
    const seed = hashToUnit(`${id}-flame-${index}`);
    const angle = seed * Math.PI * 2 + timeMs * (0.0008 + seed * 0.0009);
    const radial = Math.sqrt(hashToUnit(`${id}-radius-${index}`));
    const lift = Math.sin(timeMs * 0.006 + seed * 18.0) * 0.006;
    const particlePosition = {
      x: position.x + Math.cos(angle) * radius * radial * 0.78,
      y: position.y + Math.sin(angle) * radius * radial * 0.42 - radius * 0.16 * ageRatio - lift,
    };
    const flicker = Math.sin(timeMs * 0.021 + seed * 31.0) * 0.5 + 0.5;

    particles.push({
      id: `${id}-flame-${index}`,
      kind: "fire-area-flame",
      position: particlePosition,
      direction: { x: 0, y: -1 },
      radius: radius * (0.12 + seed * 0.14 + flicker * 0.045),
      seed,
      ageRatio: clamp(ageRatio + seed * 0.18, 0, 1),
      intensity: (0.62 + flicker * 0.55) * lifeFade,
      opacity: clamp((0.34 + flicker * 0.34) * lifeFade, 0, 0.75),
      stretch: 1.55 + seed * 0.8,
    });
  }
}

function addBurningEnemyParticles(
  particles: WeaponVisualParticle[],
  id: string,
  position: GameState["player"]["position"],
  timeMs: number,
): void {
  for (let index = 0; index < 12; index += 1) {
    const seed = hashToUnit(`${id}-burn-${index}`);
    const cycle = fract(timeMs * (0.00075 + seed * 0.00035) + seed);
    const sway = Math.sin(timeMs * 0.012 + seed * 60.0) * 0.012;
    const particlePosition = {
      x: position.x + (seed - 0.5) * 0.062 + sway * cycle,
      y: position.y + 0.018 - cycle * 0.075,
    };

    particles.push({
      id: `${id}-burn-${index}`,
      kind: "burn-ember",
      position: particlePosition,
      direction: { x: sway, y: -1 },
      radius: 0.006 + (1 - cycle) * 0.011,
      seed,
      ageRatio: cycle,
      intensity: 0.55 + (1 - cycle) * 0.5,
      opacity: (1 - cycle) * 0.62,
      stretch: 1.25,
    });
  }
}

function hashToUnit(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0x1_0000_0000;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fract(value: number): number {
  return value - Math.floor(value);
}
