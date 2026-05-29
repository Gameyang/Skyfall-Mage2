// Responsibility: Add a lightweight additive bloom overlay for field emitters.
// Owner: render/webgpu/combatField

import bloomShaderSource from "./combatFieldBloom.wgsl?raw";

export class CombatFieldBloom {
  private readonly pipeline: GPURenderPipeline;

  constructor(device: GPUDevice, format: GPUTextureFormat, bindGroupLayout: GPUBindGroupLayout) {
    const shaderModule = device.createShaderModule({
      label: "Combat field bloom shader",
      code: bloomShaderSource,
    });
    this.pipeline = device.createRenderPipeline({
      label: "Combat field bloom pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field bloom pipeline layout",
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
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
              },
              alpha: {
                srcFactor: "zero",
                dstFactor: "one",
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
  }

  render(pass: GPURenderPassEncoder, bindGroup: GPUBindGroup): void {
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
  }
}
