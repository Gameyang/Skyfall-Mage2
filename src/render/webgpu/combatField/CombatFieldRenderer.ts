// Responsibility: Render material field buffers and battle overlays in one WebGPU pipeline.
// Owner: render/webgpu/combatField

import { combatMaterialIds } from "../../../features/combatField/CombatFieldTypes";
import { materialEmitterStride, packMaterialEmitter } from "../../../features/combatField/MaterialEmitterPacking";
import { starterMaterials } from "../../../features/combatField/materials/starterMaterials";
import type { RenderSnapshot } from "../../snapshots/RenderSnapshot";
import { CombatSpriteRenderer } from "./CombatSpriteRenderer";
import { CombatFieldBackgroundRenderer } from "./CombatFieldBackgroundRenderer";
import { CombatFieldBloom } from "./CombatFieldBloom";
import { CombatFieldWaterRenderer } from "./CombatFieldWaterRenderer";
import entityQueryShaderSource from "./combatFieldEntityQuery.wgsl?raw";
import movementShaderSource from "./combatFieldMovement.wgsl?raw";
import reactionShaderSource from "./combatFieldReaction.wgsl?raw";
import renderShaderSource from "./combatFieldRender.wgsl?raw";

export class CombatFieldRenderer {
  private static readonly gridWidth = 256;
  private static readonly gridHeight = 144;
  private static readonly maxEmitters = 32;
  private readonly paramsBuffer: GPUBuffer;
  private readonly cellReadBuffer: GPUBuffer;
  private readonly cellWriteBuffer: GPUBuffer;
  private readonly emitterBuffer: GPUBuffer;
  private readonly materialPaletteBuffer: GPUBuffer;
  private readonly renderPipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly bloom: CombatFieldBloom;
  private readonly backgroundRenderer: CombatFieldBackgroundRenderer;
  private readonly waterRenderer: CombatFieldWaterRenderer;
  private readonly spriteRenderer: CombatSpriteRenderer;
  private readonly paramsData = new Float32Array(12);
  private readonly emitterData = new Float32Array(CombatFieldRenderer.maxEmitters * materialEmitterStride);

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.bloom = new CombatFieldBloom(device, format);
    this.paramsBuffer = device.createBuffer({
      label: "Combat field params",
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.cellReadBuffer = device.createBuffer({
      label: "Combat field cell read buffer",
      size: CombatFieldRenderer.gridWidth * CombatFieldRenderer.gridHeight * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.cellWriteBuffer = device.createBuffer({
      label: "Combat field cell write buffer",
      size: CombatFieldRenderer.gridWidth * CombatFieldRenderer.gridHeight * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.emitterBuffer = device.createBuffer({
      label: "Combat field emitter buffer",
      size: this.emitterData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.materialPaletteBuffer = device.createBuffer({
      label: "Combat field material palette buffer",
      size: 32 * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "Combat field render shader",
      code: renderShaderSource,
    });
    device.createShaderModule({ label: "Combat field movement shader", code: movementShaderSource });
    device.createShaderModule({ label: "Combat field reaction shader", code: reactionShaderSource });
    device.createShaderModule({ label: "Combat field entity query shader", code: entityQueryShaderSource });

    const bindGroupLayout = device.createBindGroupLayout({
      label: "Combat field bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      ],
    });
    this.renderPipeline = device.createRenderPipeline({
      label: "Combat field render pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field render pipeline layout",
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
            format: this.bloom.sceneFormat,
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
      label: "Combat field render bind group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.cellReadBuffer } },
        { binding: 2, resource: { buffer: this.cellWriteBuffer } },
        { binding: 3, resource: { buffer: this.emitterBuffer } },
        { binding: 4, resource: { buffer: this.materialPaletteBuffer } },
      ],
    });
    this.backgroundRenderer = new CombatFieldBackgroundRenderer(device, this.bloom.sceneFormat);
    this.waterRenderer = new CombatFieldWaterRenderer(device, this.bloom.sceneFormat);
    this.spriteRenderer = new CombatSpriteRenderer(device, this.bloom.sceneFormat);

    const starterField = createStarterFieldCells(CombatFieldRenderer.gridWidth, CombatFieldRenderer.gridHeight);
    this.device.queue.writeBuffer(this.cellReadBuffer, 0, starterField);
    this.device.queue.writeBuffer(this.cellWriteBuffer, 0, starterField);
    this.device.queue.writeBuffer(this.materialPaletteBuffer, 0, createMaterialPalette());
  }

  render(
    textureView: GPUTextureView,
    width: number,
    height: number,
    snapshot: RenderSnapshot,
    timeMs: number,
    bloomIntensityScale = 1,
  ): GPUCommandBuffer {
    this.writeFrameData(width, height, snapshot, timeMs, bloomIntensityScale);
    this.spriteRenderer.prepare(width, height, snapshot.sprites, timeMs);
    this.bloom.resize(width, height);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.bloom.getSceneView(),
          clearValue: { r: 0.07, g: 0.09, b: 0.1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    this.backgroundRenderer.render(pass, width, height, snapshot.environment, timeMs);
    pass.setPipeline(this.renderPipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    this.spriteRenderer.render(pass);
    this.waterRenderer.render(pass, width, height, snapshot, timeMs);
    pass.end();
    this.bloom.render(encoder, textureView, bloomIntensityScale);
    return encoder.finish();
  }

  dispose(): void {
    this.bloom.dispose();
    this.backgroundRenderer.dispose();
    this.waterRenderer.dispose();
    this.spriteRenderer.dispose();
  }

  private writeFrameData(
    width: number,
    height: number,
    snapshot: RenderSnapshot,
    timeMs: number,
    bloomIntensityScale: number,
  ): void {
    this.paramsData[0] = CombatFieldRenderer.gridWidth;
    this.paramsData[1] = CombatFieldRenderer.gridHeight;
    this.paramsData[2] = width;
    this.paramsData[3] = height;
    this.paramsData[4] = snapshot.playerPosition.x;
    this.paramsData[5] = snapshot.playerPosition.y;
    this.paramsData[6] = snapshot.aim.x;
    this.paramsData[7] = snapshot.aim.y;
    this.paramsData[8] = timeMs;
    this.paramsData[9] = Math.min(CombatFieldRenderer.maxEmitters, snapshot.materialEmitters.length);
    this.paramsData[10] = snapshot.activeEmitterCount;
    this.paramsData[11] = bloomIntensityScale;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);

    this.emitterData.fill(0);
    snapshot.materialEmitters.slice(0, CombatFieldRenderer.maxEmitters).forEach((emitter, index) => {
      packMaterialEmitter(this.emitterData, index * materialEmitterStride, emitter);
    });
    this.device.queue.writeBuffer(this.emitterBuffer, 0, this.emitterData);
  }
}

function createMaterialPalette(): Float32Array<ArrayBuffer> {
  const palette = new Float32Array(new ArrayBuffer(32 * 4 * Float32Array.BYTES_PER_ELEMENT));

  for (const material of starterMaterials) {
    const offset = combatMaterialIds[material.id] * 4;
    palette[offset] = material.color[0] / 255;
    palette[offset + 1] = material.color[1] / 255;
    palette[offset + 2] = material.color[2] / 255;
    palette[offset + 3] = material.color[3] / 255;
  }

  palette[3] = 1;
  return palette;
}

function createStarterFieldCells(width: number, height: number): Uint32Array<ArrayBuffer> {
  const cells = new Uint32Array(new ArrayBuffer(width * height * Uint32Array.BYTES_PER_ELEMENT));
  const floorY = Math.floor(height * 0.82);

  cells.fill(combatMaterialIds.air);

  for (let y = floorY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells[y * width + x] = combatMaterialIds.staticTerrain;
    }
  }

  for (let x = Math.floor(width * 0.12); x < Math.floor(width * 0.26); x += 1) {
    cells[(floorY - 1) * width + x] = combatMaterialIds.sand;
  }

  for (let x = Math.floor(width * 0.64); x < Math.floor(width * 0.78); x += 1) {
    cells[(floorY - 1) * width + x] = combatMaterialIds.water;
  }

  return cells;
}
