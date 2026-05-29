// Responsibility: Detect WebGPU availability without mutating gameplay state.
// Owner: platform

export type WebGpuFailureReason =
  | "WebGPU unsupported"
  | "WebGPU requires a secure context"
  | "No compatible WebGPU adapter"
  | "Failed to create WebGPU device";

export type WebGpuSupportResult =
  | {
      readonly ok: true;
      readonly adapter: GPUAdapter;
      readonly preferredFormat: GPUTextureFormat;
    }
  | {
      readonly ok: false;
      readonly reason: WebGpuFailureReason;
    };

export async function checkWebGpuSupport(): Promise<WebGpuSupportResult> {
  if (!window.isSecureContext) {
    return { ok: false, reason: "WebGPU requires a secure context" };
  }

  if (!navigator.gpu) {
    return { ok: false, reason: "WebGPU unsupported" };
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });

  if (!adapter) {
    return { ok: false, reason: "No compatible WebGPU adapter" };
  }

  return {
    ok: true,
    adapter,
    preferredFormat: navigator.gpu.getPreferredCanvasFormat(),
  };
}
