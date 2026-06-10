// Responsibility: Own the HDR scene target and threshold-based bloom postprocess chain.
// Owner: render/webgpu/combatField

import bloomShaderSource from "./combatFieldBloom.wgsl?raw";

const hdrSceneFormat: GPUTextureFormat = "rgba16float";
const bloomThreshold = 0.98;
const bloomIntensity = 0.95;
const bloomRadius = 1.35;
const bloomLevels = 6;

interface BloomTarget {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly width: number;
  readonly height: number;
}

export class CombatFieldBloom {
  readonly sceneFormat = hdrSceneFormat;
  private readonly paramsData = new Float32Array(8);
  private readonly paramsBuffers: GPUBuffer[] = [];
  private readonly sampler: GPUSampler;
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly brightDownsamplePipeline: GPURenderPipeline;
  private readonly downsamplePipeline: GPURenderPipeline;
  private readonly upsamplePipeline: GPURenderPipeline;
  private readonly finalCompositePipeline: GPURenderPipeline;
  private sceneTarget: BloomTarget | null = null;
  private bloomTargets: readonly BloomTarget[] = [];
  private width = 0;
  private height = 0;

  constructor(
    private readonly device: GPUDevice,
    canvasFormat: GPUTextureFormat,
  ) {
    const shaderModule = device.createShaderModule({
      label: "Combat field bloom shader",
      code: bloomShaderSource,
    });

    this.sampler = device.createSampler({
      label: "Combat field bloom sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });

    this.bindGroupLayout = device.createBindGroupLayout({
      label: "Combat field bloom bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });

    this.brightDownsamplePipeline = this.createPipeline(
      shaderModule,
      "Combat field bright downsample pipeline",
      "brightDownsampleFragment",
      hdrSceneFormat,
    );
    this.downsamplePipeline = this.createPipeline(
      shaderModule,
      "Combat field bloom downsample pipeline",
      "downsampleFragment",
      hdrSceneFormat,
    );
    this.upsamplePipeline = this.createPipeline(
      shaderModule,
      "Combat field bloom upsample pipeline",
      "upsampleFragment",
      hdrSceneFormat,
      true,
    );
    this.finalCompositePipeline = this.createPipeline(
      shaderModule,
      "Combat field bloom final composite pipeline",
      "finalCompositeFragment",
      canvasFormat,
    );
  }

  resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));

    if (nextWidth === this.width && nextHeight === this.height) {
      return;
    }

    this.destroyTargets();
    this.width = nextWidth;
    this.height = nextHeight;
    this.sceneTarget = this.createTarget("Combat field HDR scene", nextWidth, nextHeight);
    this.bloomTargets = this.createBloomTargets(nextWidth, nextHeight);
  }

  getSceneView(): GPUTextureView {
    if (!this.sceneTarget) {
      throw new Error("Combat field bloom scene target was requested before resize");
    }

    return this.sceneTarget.view;
  }

  render(encoder: GPUCommandEncoder, outputView: GPUTextureView, bloomIntensityScale: number): void {
    if (!this.sceneTarget || this.bloomTargets.length === 0) {
      return;
    }

    let paramsIndex = 0;
    const firstBloomTarget = this.bloomTargets[0];
    this.renderFullscreenPass({
      encoder,
      label: "Combat field bright downsample pass",
      pipeline: this.brightDownsamplePipeline,
      targetView: firstBloomTarget.view,
      bindGroup: this.createBindGroup(
        this.writeParams(
          paramsIndex,
          this.sceneTarget.width,
          this.sceneTarget.height,
          firstBloomTarget.width,
          firstBloomTarget.height,
          bloomIntensityScale,
        ),
        this.sceneTarget.view,
        this.sceneTarget.view,
      ),
      loadOp: "clear",
    });
    paramsIndex += 1;

    for (let index = 1; index < this.bloomTargets.length; index += 1) {
      const source = this.bloomTargets[index - 1];
      const target = this.bloomTargets[index];
      this.renderFullscreenPass({
        encoder,
        label: `Combat field bloom downsample pass ${index}`,
        pipeline: this.downsamplePipeline,
        targetView: target.view,
        bindGroup: this.createBindGroup(
          this.writeParams(paramsIndex, source.width, source.height, target.width, target.height, bloomIntensityScale),
          source.view,
          source.view,
        ),
        loadOp: "clear",
      });
      paramsIndex += 1;
    }

    for (let index = this.bloomTargets.length - 2; index >= 0; index -= 1) {
      const source = this.bloomTargets[index + 1];
      const target = this.bloomTargets[index];
      this.renderFullscreenPass({
        encoder,
        label: `Combat field bloom upsample pass ${index}`,
        pipeline: this.upsamplePipeline,
        targetView: target.view,
        bindGroup: this.createBindGroup(
          this.writeParams(paramsIndex, source.width, source.height, target.width, target.height, bloomIntensityScale),
          source.view,
          source.view,
        ),
        loadOp: "load",
      });
      paramsIndex += 1;
    }

    this.renderFullscreenPass({
      encoder,
      label: "Combat field bloom final composite pass",
      pipeline: this.finalCompositePipeline,
      targetView: outputView,
      bindGroup: this.createBindGroup(
        this.writeParams(
          paramsIndex,
          this.sceneTarget.width,
          this.sceneTarget.height,
          this.sceneTarget.width,
          this.sceneTarget.height,
          bloomIntensityScale,
        ),
        this.sceneTarget.view,
        firstBloomTarget.view,
      ),
      loadOp: "clear",
    });
  }

  dispose(): void {
    this.destroyTargets();

    for (const buffer of this.paramsBuffers) {
      buffer.destroy();
    }
  }

  private createPipeline(
    shaderModule: GPUShaderModule,
    label: string,
    fragmentEntryPoint: string,
    format: GPUTextureFormat,
    additiveBlend = false,
  ): GPURenderPipeline {
    return this.device.createRenderPipeline({
      label,
      layout: this.device.createPipelineLayout({
        label: `${label} layout`,
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: fragmentEntryPoint,
        targets: [
          {
            format,
            blend: additiveBlend
              ? {
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
                }
              : undefined,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  private createBloomTargets(width: number, height: number): readonly BloomTarget[] {
    const targets: BloomTarget[] = [];
    let levelWidth = width;
    let levelHeight = height;

    for (let level = 0; level < bloomLevels; level += 1) {
      levelWidth = Math.max(1, Math.floor(levelWidth / 2));
      levelHeight = Math.max(1, Math.floor(levelHeight / 2));
      targets.push(this.createTarget(`Combat field bloom level ${level}`, levelWidth, levelHeight));

      if (levelWidth === 1 && levelHeight === 1) {
        break;
      }
    }

    return targets;
  }

  private createTarget(label: string, width: number, height: number): BloomTarget {
    const texture = this.device.createTexture({
      label,
      size: { width, height },
      format: hdrSceneFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    return {
      texture,
      view: texture.createView(),
      width,
      height,
    };
  }

  private writeParams(
    index: number,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    bloomIntensityScale: number,
  ): GPUBuffer {
    const buffer = this.ensureParamsBuffer(index);
    this.paramsData[0] = 1 / Math.max(1, sourceWidth);
    this.paramsData[1] = 1 / Math.max(1, sourceHeight);
    this.paramsData[2] = bloomThreshold;
    this.paramsData[3] = 0;
    this.paramsData[4] = Math.max(1, targetWidth);
    this.paramsData[5] = Math.max(1, targetHeight);
    this.paramsData[6] = bloomRadius;
    this.paramsData[7] = bloomIntensity * clamp(bloomIntensityScale, 0.35, 1);
    this.device.queue.writeBuffer(buffer, 0, this.paramsData);
    return buffer;
  }

  private ensureParamsBuffer(index: number): GPUBuffer {
    const existing = this.paramsBuffers[index];

    if (existing) {
      return existing;
    }

    const buffer = this.device.createBuffer({
      label: `Combat field bloom params ${index}`,
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.paramsBuffers[index] = buffer;
    return buffer;
  }

  private createBindGroup(paramsBuffer: GPUBuffer, sourceView: GPUTextureView, secondaryView: GPUTextureView): GPUBindGroup {
    return this.device.createBindGroup({
      label: "Combat field bloom bind group",
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: sourceView },
        { binding: 2, resource: secondaryView },
        { binding: 3, resource: this.sampler },
      ],
    });
  }

  private renderFullscreenPass({
    encoder,
    label,
    pipeline,
    targetView,
    bindGroup,
    loadOp,
  }: {
    readonly encoder: GPUCommandEncoder;
    readonly label: string;
    readonly pipeline: GPURenderPipeline;
    readonly targetView: GPUTextureView;
    readonly bindGroup: GPUBindGroup;
    readonly loadOp: GPULoadOp;
  }): void {
    const pass = encoder.beginRenderPass({
      label,
      colorAttachments: [
        {
          view: targetView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp,
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  }

  private destroyTargets(): void {
    this.sceneTarget?.texture.destroy();

    for (const target of this.bloomTargets) {
      target.texture.destroy();
    }

    this.sceneTarget = null;
    this.bloomTargets = [];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
