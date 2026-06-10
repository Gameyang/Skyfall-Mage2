// Responsibility: Render the combat field sky and distant battlefield backdrop.
// Owner: render/webgpu/combatField

import type { BattleEnvironmentVisuals } from "../../snapshots/RenderSnapshot";
import backgroundShaderSource from "./combatFieldBackground.wgsl?raw";

const vertexStrideFloats = 5;
const backgroundVertexData = createBackgroundMesh();

export class CombatFieldBackgroundRenderer {
  private readonly paramsBuffer: GPUBuffer;
  private readonly vertexBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly paramsData = new Float32Array(8);

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.paramsBuffer = device.createBuffer({
      label: "Combat field background params",
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.vertexBuffer = device.createBuffer({
      label: "Combat field background mesh vertices",
      size: backgroundVertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, backgroundVertexData);

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
        buffers: [
          {
            arrayStride: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: "float32x2" },
              { shaderLocation: 2, offset: 4 * Float32Array.BYTES_PER_ELEMENT, format: "float32" },
            ],
          },
        ],
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
      label: "Combat field background bind group",
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }],
    });
  }

  render(
    pass: GPURenderPassEncoder,
    width: number,
    height: number,
    visuals: BattleEnvironmentVisuals,
    timeMs: number,
  ): void {
    this.paramsData[0] = width;
    this.paramsData[1] = height;
    this.paramsData[2] = timeMs / 1_000;
    this.paramsData[3] = visuals.windX;
    this.paramsData[4] = visuals.rainRate;
    this.paramsData[5] = visuals.heat;
    this.paramsData[6] = visuals.frostFactor;
    this.paramsData[7] = visuals.lavaFactor;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.draw(backgroundVertexData.length / vertexStrideFloats);
  }

  dispose(): void {
    this.paramsBuffer.destroy();
    this.vertexBuffer.destroy();
  }
}

function createBackgroundMesh(): Float32Array<ArrayBuffer> {
  const vertices: number[] = [];

  addQuad(vertices, 0, 0, 1, 1, 0);
  addQuad(vertices, 0.03, 0.12, 0.96, 0.58, 1);
  addQuad(vertices, 0.52, 0.19, 0.98, 0.66, 1);
  addQuad(vertices, 0, 0.48, 1, 0.88, 4);
  addRidge(vertices, 2, 0.86, [
    [0, 0.61],
    [0.1, 0.58],
    [0.18, 0.64],
    [0.29, 0.55],
    [0.4, 0.62],
    [0.52, 0.57],
    [0.62, 0.65],
    [0.76, 0.55],
    [0.88, 0.62],
    [1, 0.59],
  ]);
  addRidge(vertices, 3, 1, [
    [0, 0.74],
    [0.08, 0.69],
    [0.17, 0.76],
    [0.28, 0.68],
    [0.38, 0.73],
    [0.5, 0.66],
    [0.63, 0.76],
    [0.73, 0.7],
    [0.84, 0.78],
    [0.94, 0.72],
    [1, 0.76],
  ]);
  addRainMesh(vertices);

  return new Float32Array(vertices);
}

function addQuad(vertices: number[], left: number, top: number, right: number, bottom: number, layer: number): void {
  addVertex(vertices, left, top, 0, 0, layer);
  addVertex(vertices, right, top, 1, 0, layer);
  addVertex(vertices, left, bottom, 0, 1, layer);
  addVertex(vertices, left, bottom, 0, 1, layer);
  addVertex(vertices, right, top, 1, 0, layer);
  addVertex(vertices, right, bottom, 1, 1, layer);
}

function addRidge(vertices: number[], layer: number, bottom: number, points: readonly (readonly [number, number])[]): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [leftX, leftTop] = points[index]!;
    const [rightX, rightTop] = points[index + 1]!;
    const leftBottomUv = normalizeRidgeUv(bottom, leftTop, bottom);
    const rightBottomUv = normalizeRidgeUv(bottom, rightTop, bottom);

    addVertex(vertices, leftX, leftTop, leftX, 0, layer);
    addVertex(vertices, rightX, rightTop, rightX, 0, layer);
    addVertex(vertices, leftX, bottom, leftX, leftBottomUv, layer);
    addVertex(vertices, leftX, bottom, leftX, leftBottomUv, layer);
    addVertex(vertices, rightX, rightTop, rightX, 0, layer);
    addVertex(vertices, rightX, bottom, rightX, rightBottomUv, layer);
  }
}

function addRainMesh(vertices: number[]): void {
  for (let index = 0; index < 18; index += 1) {
    const x = index / 18;
    const width = 0.008 + (index % 3) * 0.002;
    const top = (index % 5) * 0.12;
    addQuad(vertices, x, top, Math.min(1, x + width), Math.min(1, top + 0.54), 5);
  }
}

function addVertex(vertices: number[], x: number, y: number, u: number, v: number, layer: number): void {
  vertices.push(x * 2 - 1, 1 - y * 2, u, v, layer);
}

function normalizeRidgeUv(y: number, top: number, bottom: number): number {
  return (y - top) / Math.max(0.001, bottom - top);
}
