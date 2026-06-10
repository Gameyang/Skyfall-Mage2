// Responsibility: Render weapon sprite-sheet effects in the combat WebGPU scene.
// Owner: render/webgpu/combatField

import type { WeaponEffectSprite, WeaponEffectSpriteKind } from "../../snapshots/RenderSnapshot";
import { assetUrls } from "../../../platform/assets";
import effectShaderSource from "./combatWeaponEffect.wgsl?raw";
import { SpriteTextureCache, type SpriteTextureResource } from "./SpriteTextureCache";

interface WeaponEffectDraw {
  readonly bindGroup: GPUBindGroup;
}

const proceduralTextureUrl = "";

export class CombatWeaponEffectRenderer {
  private readonly textureCache: SpriteTextureCache;
  private readonly proceduralTexture: SpriteTextureResource;
  private readonly sampler: GPUSampler;
  private readonly paramsBuffers: GPUBuffer[] = [];
  private readonly paramsData = new Float32Array(24);
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly pipeline: GPURenderPipeline;
  private draws: readonly WeaponEffectDraw[] = [];

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.textureCache = new SpriteTextureCache(device);
    this.textureCache.preload(Object.values(assetUrls.effects));
    this.proceduralTexture = createProceduralTexture(device);
    this.sampler = device.createSampler({
      label: "Combat weapon effect sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });

    const shaderModule = device.createShaderModule({
      label: "Combat weapon effect shader",
      code: effectShaderSource,
    });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: "Combat weapon effect bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });
    this.pipeline = device.createRenderPipeline({
      label: "Combat weapon effect pipeline",
      layout: device.createPipelineLayout({
        label: "Combat weapon effect pipeline layout",
        bindGroupLayouts: [this.bindGroupLayout],
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
  }

  prepare(width: number, height: number, effects: readonly WeaponEffectSprite[]): void {
    const aspectScale = height / Math.max(1, width);
    const draws: WeaponEffectDraw[] = [];

    sortWeaponEffects(effects).forEach((effect) => {
      const texture = this.getEffectTexture(effect);

      if (!texture) {
        return;
      }

      const paramsBuffer = this.ensureParamsBuffer(draws.length);
      this.writeEffectParams(paramsBuffer, effect, aspectScale);
      draws.push({
        bindGroup: this.device.createBindGroup({
          label: `Combat weapon effect bind group ${effect.id}`,
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: paramsBuffer } },
            { binding: 1, resource: texture.view },
            { binding: 2, resource: this.sampler },
          ],
        }),
      });
    });

    this.draws = draws;
  }

  render(pass: GPURenderPassEncoder): void {
    if (this.draws.length === 0) {
      return;
    }

    pass.setPipeline(this.pipeline);

    for (const draw of this.draws) {
      pass.setBindGroup(0, draw.bindGroup);
      pass.draw(6);
    }
  }

  dispose(): void {
    this.textureCache.dispose();
    this.proceduralTexture.texture.destroy();

    for (const buffer of this.paramsBuffers) {
      buffer.destroy();
    }
  }

  private ensureParamsBuffer(index: number): GPUBuffer {
    const existing = this.paramsBuffers[index];

    if (existing) {
      return existing;
    }

    const buffer = this.device.createBuffer({
      label: `Combat weapon effect params ${index}`,
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.paramsBuffers[index] = buffer;
    return buffer;
  }

  private writeEffectParams(buffer: GPUBuffer, effect: WeaponEffectSprite, aspectScale: number): void {
    this.paramsData.fill(0);
    this.paramsData[0] = effect.position.x;
    this.paramsData[1] = effect.position.y;
    this.paramsData[2] = effect.size.x * aspectScale;
    this.paramsData[3] = effect.size.y;
    this.paramsData[4] = effect.frameIndex;
    this.paramsData[5] = Math.max(1, effect.frameCount);
    this.paramsData[6] = effect.opacity;
    this.paramsData[7] = drawModeValue(effect.drawMode ?? "texture");
    this.paramsData[8] = effect.rotationRadians;
    this.paramsData[9] = effect.facing;
    this.paramsData[10] = effect.softness ?? 0.55;
    this.paramsData[11] = blendModeValue(effect.blendMode ?? "alpha");
    this.paramsData[12] = effect.color?.[0] ?? 1;
    this.paramsData[13] = effect.color?.[1] ?? 1;
    this.paramsData[14] = effect.color?.[2] ?? 1;
    this.paramsData[15] = effect.glowStrength ?? 0.55;
    this.paramsData[16] = effect.sheetRect?.x ?? 0;
    this.paramsData[17] = effect.sheetRect?.y ?? 0;
    this.paramsData[18] = effect.sheetRect?.width ?? 1;
    this.paramsData[19] = effect.sheetRect?.height ?? 1;
    this.paramsData[20] = effect.sheetColumns ?? effect.frameCount;
    this.paramsData[21] = effect.sheetRows ?? 1;
    this.paramsData[22] = 0;
    this.paramsData[23] = 0;
    this.device.queue.writeBuffer(buffer, 0, this.paramsData);
  }

  private getEffectTexture(effect: WeaponEffectSprite): SpriteTextureResource | null {
    if (effect.textureUrl === proceduralTextureUrl || (effect.drawMode && effect.drawMode !== "texture")) {
      return this.proceduralTexture;
    }

    return this.textureCache.get(effect.textureUrl);
  }
}

function sortWeaponEffects(effects: readonly WeaponEffectSprite[]): readonly WeaponEffectSprite[] {
  return [...effects].sort((a, b) => {
    const layerDelta = effectLayer(a) - effectLayer(b);
    return layerDelta !== 0 ? layerDelta : a.position.y - b.position.y;
  });
}

function effectLayer(effect: WeaponEffectSprite): number {
  if (typeof effect.layer === "number") {
    return effect.layer;
  }

  const kind: WeaponEffectSpriteKind = effect.kind;

  switch (kind) {
    case "fire-area-burn":
      return 0;
    case "fireball-impact":
      return 1;
    case "fireball-projectile":
      return 2;
    case "burn-overlay":
      return 3;
    case "effect-glow":
      return -1;
    case "effect-trail":
      return 1;
    case "effect-sprite":
    case "effect-particle":
      return 2;
    default:
      return 2;
  }
}

function drawModeValue(mode: NonNullable<WeaponEffectSprite["drawMode"]>): number {
  switch (mode) {
    case "radial":
      return 1;
    case "streak":
      return 2;
    case "texture":
    default:
      return 0;
  }
}

function blendModeValue(mode: NonNullable<WeaponEffectSprite["blendMode"]>): number {
  switch (mode) {
    case "screen":
      return 1;
    case "additive":
      return 2;
    case "alpha":
    default:
      return 0;
  }
}

function createProceduralTexture(device: GPUDevice): SpriteTextureResource {
  const texture = device.createTexture({
    label: "Procedural effect white texture",
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4, rowsPerImage: 1 },
    { width: 1, height: 1 },
  );
  return {
    texture,
    view: texture.createView(),
    width: 1,
    height: 1,
  };
}
