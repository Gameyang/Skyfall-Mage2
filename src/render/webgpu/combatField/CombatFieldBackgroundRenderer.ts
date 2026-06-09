// Responsibility: Render the combat field sky and distant battlefield backdrop.
// Owner: render/webgpu/combatField

import backgroundShaderSource from "./combatFieldBackground.wgsl?raw";

export class CombatFieldBackgroundRenderer {
  private readonly paramsBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly paramsData = new Float32Array(4);

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.paramsBuffer = device.createBuffer({
      label: "Combat field background params",
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "Combat field background shader",
      code: backgroundShaderSource,
    });
    const bindGroupLayout = device.createBindGroupLayout({
      label: "Combat field background bind group layout",
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
    });

    this.pipeline = device.createRenderPipeline({
      label: "Combat field background pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field background pipeline layout",
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.bindGroup = device.createBindGroup({
      label: "Combat field background bind group",
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }],
    });
  }

  render(pass: GPURenderPassEncoder, width: number, height: number, timeMs: number): void {
    this.paramsData[0] = width;
    this.paramsData[1] = height;
    this.paramsData[2] = timeMs / 1_000;
    this.paramsData[3] = 0;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }

  dispose(): void {
    this.paramsBuffer.destroy();
  }
}
