// Responsibility: Compose runtime, renderer, input adapters, and DOM UI shell.
// Owner: app

import { createInitialGameState } from "../core/state/GameState";
import { KeyboardInput } from "../input/KeyboardInput";
import { TouchInput } from "../input/TouchInput";
import { CombatFieldGpu } from "../render/webgpu/combatField/CombatFieldGpu";
import { CommandBus } from "../runtime/CommandBus";
import { EventBus } from "../runtime/EventBus";
import { GameRuntime } from "../runtime/GameRuntime";
import { SaveRuntime } from "../runtime/SaveRuntime";
import { AppShell } from "../ui/shell/AppShell";
import { defaultAppConfig } from "./AppConfig";

export interface AppInstance {
  readonly runtime: GameRuntime;
  dispose(): void;
}

export async function createApp(root: HTMLElement): Promise<AppInstance> {
  const commandBus = new CommandBus();
  const eventBus = new EventBus();
  const saveRuntime = new SaveRuntime(createLocalStorageAdapter());
  const initialState = saveRuntime.load() ?? createInitialGameState();
  const shell = new AppShell({
    dispatch: (command) => commandBus.enqueue(command),
  });
  root.replaceChildren(shell.element);

  const runtime = new GameRuntime({
    commandBus,
    eventBus,
    initialState,
    onStateChanged: (state) => {
      shell.update(state);
      saveRuntime.saveIfDue(state);
    },
  });
  window.addEventListener("beforeunload", () => saveRuntime.save(runtime.getState()));

  const keyboardInput = new KeyboardInput(window, (command) => commandBus.enqueue(command));
  const touchInput = new TouchInput(shell.playfieldElement, (command) => commandBus.enqueue(command));

  const gpu = await CombatFieldGpu.create(shell.canvas, {
    maxDevicePixelRatio: defaultAppConfig.maxDevicePixelRatio,
  });

  if (gpu.ok) {
    shell.setGpuStatus("WebGPU", "ready");
    runtime.setRenderFrame((snapshot, timeMs) => {
      gpu.renderer.resize();
      gpu.renderer.render(snapshot, timeMs);
    });
    gpu.renderer.device.lost.then((info) => {
      shell.setGpuStatus(`WebGPU lost: ${info.reason}`, "degraded");
    });
  } else {
    shell.setGpuStatus(gpu.reason, "degraded");
  }

  shell.update(runtime.getState());

  if (!defaultAppConfig.initialRuntimePaused) {
    runtime.start();
  }

  return {
    runtime,
    dispose() {
      runtime.stop();
      keyboardInput.dispose();
      touchInput.dispose();
      if (gpu.ok) {
        gpu.renderer.dispose();
      }
      shell.dispose();
    },
  };
}
import { createLocalStorageAdapter } from "../platform/storage";
