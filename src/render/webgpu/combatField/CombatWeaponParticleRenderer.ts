// Responsibility: Render weapon-driven visual particles in the combat WebGPU scene.
// Owner: render/webgpu/combatField

import type { WeaponVisualParticle, WeaponVisualParticleKind } from "../../snapshots/RenderSnapshot";
import particleShaderSource from "./combatWeaponParticles.wgsl?raw";

const maxParticles = 768;
const particleStride = 12;

export class CombatWeaponParticleRenderer {
  private readonly paramsBuffer: GPUBuffer;
  private readonly particleBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly paramsData = new Float32Array(8);
  private readonly particleData = new Float32Array(maxParticles * particleStride);
  private particleCount = 0;

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.paramsBuffer = device.createBuffer({
      label: "Combat weapon particle params",
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.particleBuffer = device.createBuffer({
      label: "Combat weapon particles",
      size: this.particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "Combat weapon particle shader",
      code: particleShaderSource,
    });
    const bindGroupLayout = device.createBindGroupLayout({
      label: "Combat weapon particle bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      label: "Combat weapon particle pipeline",
      layout: device.createPipelineLayout({
        label: "Combat weapon particle pipeline layout",
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
    this.bindGroup = device.createBindGroup({
      label: "Combat weapon particle bind group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer } },
      ],
    });
  }

  prepare(particles: readonly WeaponVisualParticle[]): void {
    this.particleData.fill(0);
    this.particleCount = Math.min(maxParticles, particles.length);

    particles.slice(0, maxParticles).forEach((particle, index) => {
      const offset = index * particleStride;
      this.particleData[offset] = particle.position.x;
      this.particleData[offset + 1] = particle.position.y;
      this.particleData[offset + 2] = particle.radius;
      this.particleData[offset + 3] = encodeParticleKind(particle.kind);
      this.particleData[offset + 4] = particle.direction.x;
      this.particleData[offset + 5] = particle.direction.y;
      this.particleData[offset + 6] = particle.seed;
      this.particleData[offset + 7] = particle.ageRatio;
      this.particleData[offset + 8] = particle.intensity;
      this.particleData[offset + 9] = particle.opacity;
      this.particleData[offset + 10] = particle.stretch;
      this.particleData[offset + 11] = 0;
    });

    this.device.queue.writeBuffer(this.particleBuffer, 0, this.particleData);
  }

  render(pass: GPURenderPassEncoder, width: number, height: number, timeMs: number): void {
    if (this.particleCount === 0) {
      return;
    }

    this.paramsData[0] = width;
    this.paramsData[1] = height;
    this.paramsData[2] = timeMs / 1_000;
    this.paramsData[3] = this.particleCount;
    this.paramsData[4] = 0;
    this.paramsData[5] = 0;
    this.paramsData[6] = 0;
    this.paramsData[7] = 0;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6, this.particleCount);
  }

  dispose(): void {
    this.paramsBuffer.destroy();
    this.particleBuffer.destroy();
  }
}

function encodeParticleKind(kind: WeaponVisualParticleKind): number {
  switch (kind) {
    case "fireball-core":
      return 0;
    case "fireball-ember":
      return 1;
    case "fire-area-flame":
      return 2;
    case "burn-ember":
      return 3;
  }
}
