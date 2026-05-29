// Responsibility: Own serializable state evolution and runtime lifecycle.
// Owner: runtime

import { applyCommand } from "../core/state/commandReducer";
import type { GameState } from "../core/state/GameState";
import { stepGameState } from "../core/state/stateStep";
import { resolveCombatFieldResults } from "../features/combat/CombatResolutionSystem";
import { activeEmitterToMaterialEmitter } from "../features/combat/CombatSystem";
import { starterCombatFieldConfig } from "../features/combatField/CombatFieldConfig";
import { createCombatFieldQueryRequest } from "../features/combatField/queries/CombatFieldQueryPlanner";
import { CpuCombatFieldSimulator } from "../features/combatField/reference/CpuCombatFieldSimulator";
import { advanceItemDropPhysics } from "../features/inventory/ItemDropPhysicsSystem";
import { resolveItemPickups } from "../features/inventory/PickupSystem";
import { advanceWaveRuntime } from "../features/progression/WaveRuntimeSystem";
import { createRenderSnapshot } from "../render/snapshots/createRenderSnapshot";
import type { RenderSnapshot } from "../render/snapshots/RenderSnapshot";
import type { CommandBus } from "./CommandBus";
import type { EventBus } from "./EventBus";
import { GameClock } from "./GameClock";

export interface GameRuntimeOptions {
  readonly commandBus: CommandBus;
  readonly eventBus: EventBus;
  readonly initialState: GameState;
  readonly onStateChanged: (state: GameState) => void;
}

export class GameRuntime {
  private readonly clock: GameClock;
  private state: GameState;
  private readonly combatField: CpuCombatFieldSimulator;
  private renderFrame: ((snapshot: RenderSnapshot, timeMs: number) => void) | null = null;
  private running = false;

  constructor(private readonly options: GameRuntimeOptions) {
    this.state = options.initialState;
    this.combatField = new CpuCombatFieldSimulator({
      ...starterCombatFieldConfig,
      width: options.initialState.battleField.gridWidth,
      height: options.initialState.battleField.gridHeight,
    });
    this.clock = new GameClock((deltaMs, timeMs) => this.tick(deltaMs, timeMs));
  }

  getState(): GameState {
    return this.state;
  }

  setRenderFrame(renderFrame: (snapshot: RenderSnapshot, timeMs: number) => void): void {
    this.renderFrame = renderFrame;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.state = {
      ...this.state,
      session: {
        ...this.state.session,
        phase: "running",
      },
    };
    this.options.eventBus.emit({ type: "RuntimeStarted", atMs: this.state.session.elapsedMs });
    this.options.onStateChanged(this.state);
    this.clock.start();
  }

  pause(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.clock.stop();
    this.state = applyCommand(this.state, { type: "PauseRuntime" });
    this.options.eventBus.emit({ type: "RuntimePaused", atMs: this.state.session.elapsedMs });
    this.options.onStateChanged(this.state);
  }

  resume(): void {
    if (this.running) {
      return;
    }

    this.state = applyCommand(this.state, { type: "ResumeRuntime" });
    this.options.eventBus.emit({ type: "RuntimeResumed", atMs: this.state.session.elapsedMs });
    this.running = true;
    this.options.onStateChanged(this.state);
    this.clock.start();
  }

  stop(): void {
    this.running = false;
    this.clock.stop();
    this.options.commandBus.clear();
    this.options.eventBus.clear();
    this.state = {
      ...this.state,
      session: {
        ...this.state.session,
        phase: "stopped",
      },
    };
    this.options.onStateChanged(this.state);
  }

  private tick(deltaMs: number, timeMs: number): void {
    for (const command of this.options.commandBus.drain()) {
      if (command.type === "PauseRuntime") {
        this.pause();
        return;
      }

      if (command.type === "ResumeRuntime") {
        this.resume();
        return;
      }

      this.state = applyCommand(this.state, command);
    }

    this.state = stepGameState(this.state, deltaMs);
    this.state = advanceItemDropPhysics(this.state, deltaMs);
    const waveRuntime = advanceWaveRuntime(this.state, deltaMs);
    this.state = waveRuntime.state;
    for (const event of waveRuntime.events) {
      this.options.eventBus.emit(event);
    }

    this.combatField.step(this.state.battleField.activeEmitters.map(activeEmitterToMaterialEmitter));
    const queryResults = this.combatField.query(createCombatFieldQueryRequest(this.state));
    const combatResolution = resolveCombatFieldResults(this.state, queryResults, deltaMs);
    this.state = combatResolution.state;
    for (const event of combatResolution.events) {
      this.options.eventBus.emit(event);
    }
    const pickupResolution = resolveItemPickups(this.state);
    this.state = pickupResolution.state;
    for (const event of pickupResolution.events) {
      this.options.eventBus.emit(event);
    }

    this.options.eventBus.drain();
    this.options.onStateChanged(this.state);
    this.renderFrame?.(createRenderSnapshot(this.state), timeMs);
  }
}
