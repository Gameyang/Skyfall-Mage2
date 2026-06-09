// Responsibility: Composite the lower battlefield water surface in the WebGPU combat pass.
// Owner: render/webgpu/combatField

import type { BattleEnvironmentVisuals } from "../../snapshots/RenderSnapshot";
import waterShaderSource from "./combatFieldWater.wgsl?raw";
import { WaterSurfaceSimulation } from "./WaterSurfaceSimulation";

const springColumns = 96;

export class CombatFieldWaterRenderer {
  private readonly simulation = new WaterSurfaceSimulation({ columns: springColumns });
  private readonly paramsBuffer: GPUBuffer;
  private readonly springBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly paramsData = new Float32Array(16);
  private lastTimeMs: number | null = null;

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.paramsBuffer = device.createBuffer({
      label: "Combat field water params",
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.springBuffer = device.createBuffer({
      label: "Combat field water springs",
      size: springColumns * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "Combat field water shader",
      code: waterShaderSource,
    });
    const bindGroupLayout = device.createBindGroupLayout({
      label: "Combat field water bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      label: "Combat field water pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field water pipeline layout",
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.bindGroup = device.createBindGroup({
      label: "Combat field water bind group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.springBuffer } },
      ],
    });
  }

  render(pass: GPURenderPassEncoder, width: number, height: number, visuals: BattleEnvironmentVisuals, timeMs: number): void {
    if (visuals.waterCoverage <= 0) {
      return;
    }

    const deltaMs = this.lastTimeMs === null ? 16.6667 : Math.min(50, Math.max(0, timeMs - this.lastTimeMs));
    this.lastTimeMs = timeMs;
    this.simulation.addRainRipples(deltaMs, visuals.rainRate);
    this.simulation.update(deltaMs);
    this.device.queue.writeBuffer(this.springBuffer, 0, this.simulation.readHeights());
    this.writeParams(width, height, visuals, timeMs);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }

  dispose(): void {
    this.paramsBuffer.destroy();
    this.springBuffer.destroy();
  }

  private writeParams(width: number, height: number, visuals: BattleEnvironmentVisuals, timeMs: number): void {
    this.paramsData.fill(0);
    this.paramsData[0] = width;
    this.paramsData[1] = height;
    this.paramsData[2] = timeMs / 1_000;
    this.paramsData[3] = springColumns;
    this.paramsData[4] = visuals.waterStart;
    this.paramsData[5] = visuals.waterAlpha;
    this.paramsData[6] = visuals.waveActivity;
    this.paramsData[7] = visuals.waterCoverage;
    this.paramsData[8] = visuals.windX;
    this.paramsData[9] = visuals.rainRate;
    this.paramsData[10] = visuals.heat;
    this.paramsData[11] = encodeEnvironmentKind(visuals.kind);
    this.paramsData[12] = visuals.frostFactor;
    this.paramsData[13] = visuals.lavaFactor;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);
  }
}

function encodeEnvironmentKind(kind: BattleEnvironmentVisuals["kind"]): number {
  switch (kind) {
    case "ember-cavern":
      return 0;
    case "rain-shelf":
      return 1;
    case "ash-field":
      return 2;
  }
}
