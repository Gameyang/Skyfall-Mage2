// Responsibility: Own WebGPU device, canvas context, and resize lifecycle.
// Owner: render/webgpu/combatField

import { checkWebGpuSupport, type WebGpuFailureReason } from "../../../platform/webgpuSupport";
import type { RenderSnapshot } from "../../snapshots/RenderSnapshot";
import { CombatFieldRenderer } from "./CombatFieldRenderer";

export interface CombatFieldGpuOptions {
  readonly maxDevicePixelRatio: number;
}

export type CombatFieldGpuCreateResult =
  | {
      readonly ok: true;
      readonly renderer: CombatFieldGpu;
    }
  | {
      readonly ok: false;
      readonly reason: WebGpuFailureReason | "WebGPU canvas context unavailable";
    };

export class CombatFieldGpu {
  readonly device: GPUDevice;
  private readonly context: GPUCanvasContext;
  private readonly format: GPUTextureFormat;
  private readonly maxDevicePixelRatio: number;
  private readonly fieldRenderer: CombatFieldRenderer;
  private width = 0;
  private height = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    options: CombatFieldGpuOptions,
  ) {
    this.device = device;
    this.context = context;
    this.format = format;
    this.maxDevicePixelRatio = options.maxDevicePixelRatio;
    this.context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
    this.fieldRenderer = new CombatFieldRenderer(device, format);
  }

  static async create(canvas: HTMLCanvasElement, options: CombatFieldGpuOptions): Promise<CombatFieldGpuCreateResult> {
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
        renderer: new CombatFieldGpu(canvas, device, context, support.preferredFormat, options),
      };
    } catch {
      return { ok: false, reason: "Failed to create WebGPU device" };
    }
  }

  resize(): void {
    const dpr = Math.min(this.maxDevicePixelRatio, Math.max(1, window.devicePixelRatio || 1));
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

  render(snapshot: RenderSnapshot, timeMs: number): void {
    if (this.width <= 0 || this.height <= 0) {
      return;
    }

    const textureView = this.context.getCurrentTexture().createView();
    this.device.queue.submit([this.fieldRenderer.render(textureView, this.width, this.height, snapshot, timeMs)]);
  }

  dispose(): void {
    this.device.destroy();
  }

}
