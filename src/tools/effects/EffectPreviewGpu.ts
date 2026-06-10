// Responsibility: Render local effect preset previews with the combat effect renderer.
// Owner: tools/effects

import { checkWebGpuSupport, type WebGpuFailureReason } from "../../platform/webgpuSupport";
import type { WeaponEffectSprite } from "../../render/snapshots/RenderSnapshot";
import { CombatWeaponEffectRenderer } from "../../render/webgpu/combatField/CombatWeaponEffectRenderer";

export type EffectPreviewGpuCreateResult =
  | {
      readonly ok: true;
      readonly renderer: EffectPreviewGpu;
    }
  | {
      readonly ok: false;
      readonly reason: WebGpuFailureReason | "WebGPU canvas context unavailable" | "Failed to create WebGPU device";
    };

export class EffectPreviewGpu {
  private readonly effectRenderer: CombatWeaponEffectRenderer;
  private width = 0;
  private height = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly format: GPUTextureFormat,
  ) {
    this.context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
    this.effectRenderer = new CombatWeaponEffectRenderer(device, format);
  }

  static async create(canvas: HTMLCanvasElement): Promise<EffectPreviewGpuCreateResult> {
    const support = await checkWebGpuSupport();

    if (!support.ok) {
      return support;
    }

    const context = canvas.getContext("webgpu");

    if (!context) {
      return { ok: false, reason: "WebGPU canvas context unavailable" };
    }

    try {
      const device = await support.adapter.requestDevice();
      return {
        ok: true,
        renderer: new EffectPreviewGpu(canvas, device, context, support.preferredFormat),
      };
    } catch {
      return { ok: false, reason: "Failed to create WebGPU device" };
    }
  }

  render(effects: readonly WeaponEffectSprite[]): void {
    this.resize();

    if (this.width <= 0 || this.height <= 0) {
      return;
    }

    this.effectRenderer.prepare(this.width, this.height, effects);
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.055, g: 0.065, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    this.effectRenderer.render(pass);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  dispose(): void {
    this.effectRenderer.dispose();
    this.device.destroy();
  }

  private resize(): void {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (width === this.width && height === this.height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
  }
}
