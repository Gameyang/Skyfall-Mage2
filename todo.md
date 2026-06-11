# Noita-Inspired WebGPU Combat TODO

## Phase 0: Stabilize the current combat loop

- [x] Clear `frameEvents` and `frameEffects` even when the game is already over.
- [x] Keep `npm test` and `npm run build` passing after each combat change.
- [x] Avoid making WebGPU support a hard requirement for the core battle loop.

## Phase 1: Generalize skills

- [x] Replace the hardcoded `fireball` auto attack path with a loop over all skill definitions.
- [x] Keep skill cooldown state per skill id.
- [x] Use skill data for targeting, projectile creation, impact damage, material effects, and hazard spawning.
- [x] Preserve the current fireball behavior as the baseline skill.

## Phase 2: Add Noita-style combat expression

- [x] Emit WebGPU material events for cast and hit effects.
- [x] Handle CPU authoritative direct damage and optional area damage on projectile impact.
- [x] Add CPU hazard zones for burn clouds, steam clouds, and other persistent attack areas.
- [x] Keep GPU material simulation visual-first; do not use full-grid readback for combat authority.

## Phase 3: Stabilize the WebGPU material layer

- [x] Use one viewport-to-grid mapping path for game events and material emitters.
- [x] Disable only the material canvas when WebGPU initialization fails.
- [x] Keep Canvas2D combat, HUD, enemies, and projectiles running without WebGPU.
- [x] Keep emitter count bounded and drop oldest overflow events.

## Phase 4: Verify performance envelope

- [x] Keep the default material grid at `256x144`.
- [x] Keep `MAX_EMITTERS=32` until profiling shows room for more.
- [ ] Stress-test 100 enemies, 100 projectiles, 16 hazards, and 32 active material bursts.
- [ ] Check desktop and mobile viewport alignment manually.
