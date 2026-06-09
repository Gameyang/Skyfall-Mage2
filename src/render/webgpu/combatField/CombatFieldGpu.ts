// Responsibility: Own WebGPU device, canvas context, and resize lifecycle.
// Owner: render/webgpu/combatField

import { checkWebGpuSupport, type WebGpuFailureReason } from "../../../platform/webgpuSupport";
import type { RenderSnapshot } from "../../snapshots/RenderSnapshot";
import { CombatFieldRenderer } from "./CombatFieldRenderer";

const bloomReferenceLogicalArea = 960 * 540;
const bloomMinIntensityScale = 0.58;
const bloomMaxIntensityScale = 1;

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
  private bloomIntensityScale = 1;

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
    const logicalWidth = Math.max(1, this.canvas.clientWidth);
    const logicalHeight = Math.max(1, this.canvas.clientHeight);
    const width = Math.max(1, Math.floor(logicalWidth * dpr));
    const height = Math.max(1, Math.floor(logicalHeight * dpr));
    this.bloomIntensityScale = calculateBloomIntensityScale(logicalWidth, logicalHeight);

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
    this.device.queue.submit([
      this.fieldRenderer.render(textureView, this.width, this.height, snapshot, timeMs, this.bloomIntensityScale),
    ]);
  }

  dispose(): void {
    this.fieldRenderer.dispose();
    this.device.destroy();
  }

}

export function calculateBloomIntensityScale(logicalWidth: number, logicalHeight: number): number {
  const width = Math.max(1, Number.isFinite(logicalWidth) ? logicalWidth : 1);
  const height = Math.max(1, Number.isFinite(logicalHeight) ? logicalHeight : 1);
  const areaScale = Math.sqrt((width * height) / bloomReferenceLogicalArea);
  return clamp(areaScale, bloomMinIntensityScale, bloomMaxIntensityScale);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
