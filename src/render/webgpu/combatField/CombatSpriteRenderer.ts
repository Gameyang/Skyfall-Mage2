// Responsibility: Render textured combat entities with shared sprite shader effects.
// Owner: render/webgpu/combatField

import type {
  RenderableSprite,
  RenderableSpriteKind,
  RenderableSpriteMotionPreset,
  RenderableSpriteRarity,
} from "../../snapshots/RenderSnapshot";
import spriteShaderSource from "./combatSpriteRender.wgsl?raw";
import { SpriteTextureCache } from "./SpriteTextureCache";

const playerHitFlashDurationMs = 1_000;
const hpDecreaseEpsilon = 0.0001;

interface SpriteDraw {
  readonly bindGroup: GPUBindGroup;
}

interface SpriteHitState {
  readonly active: boolean;
  readonly elapsedMs: number;
}

export class CombatSpriteRenderer {
  private readonly textureCache: SpriteTextureCache;
  private readonly sampler: GPUSampler;
  private readonly paramsBuffers: GPUBuffer[] = [];
  private readonly paramsData = new Float32Array(16);
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly pipeline: GPURenderPipeline;
  private readonly previousHpPercentBySpriteId = new Map<string, number>();
  private readonly hitStartMsBySpriteId = new Map<string, number>();
  private readonly hitUntilMsBySpriteId = new Map<string, number>();
  private draws: readonly SpriteDraw[] = [];

  constructor(
    private readonly device: GPUDevice,
    format: GPUTextureFormat,
  ) {
    this.textureCache = new SpriteTextureCache(device);
    this.sampler = device.createSampler({
      label: "Combat sprite sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
    });

    const shaderModule = device.createShaderModule({
      label: "Combat sprite render shader",
      code: spriteShaderSource,
    });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: "Combat sprite bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });
    this.pipeline = device.createRenderPipeline({
      label: "Combat sprite render pipeline",
      layout: device.createPipelineLayout({
        label: "Combat sprite pipeline layout",
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

  prepare(width: number, height: number, sprites: readonly RenderableSprite[], timeMs: number): void {
    const aspectScale = height / Math.max(1, width);
    const draws: SpriteDraw[] = [];
    const activeSpriteIds = new Set<string>();

    sortSprites(sprites).forEach((sprite) => {
      activeSpriteIds.add(sprite.id);
      const hitState = this.resolveHitState(sprite, timeMs);
      const hitFlash = sprite.kind === "player" && hitState.active ? 1 : 0;
      const frameIndex = resolveAnimationFrameIndex(sprite, timeMs, hitState);
      const texture = this.textureCache.get(sprite.textureUrl);

      if (!texture) {
        return;
      }

      const paramsBuffer = this.ensureParamsBuffer(draws.length);
      this.writeSpriteParams(paramsBuffer, sprite, timeMs, aspectScale, hitFlash, frameIndex);
      draws.push({
        bindGroup: this.device.createBindGroup({
          label: `Combat sprite bind group ${sprite.id}`,
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: paramsBuffer } },
            { binding: 1, resource: texture.view },
            { binding: 2, resource: this.sampler },
          ],
        }),
      });
    });

    this.pruneSpriteAnimationState(activeSpriteIds);
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
      label: `Combat sprite params ${index}`,
      size: this.paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.paramsBuffers[index] = buffer;
    return buffer;
  }

  private writeSpriteParams(
    buffer: GPUBuffer,
    sprite: RenderableSprite,
    timeMs: number,
    aspectScale: number,
    hitFlash: number,
    frameIndex: number,
  ): void {
    this.paramsData.fill(0);
    this.paramsData[0] = sprite.position.x;
    this.paramsData[1] = sprite.position.y;
    this.paramsData[2] = sprite.size.x * aspectScale;
    this.paramsData[3] = sprite.size.y;
    this.paramsData[4] = timeMs;
    this.paramsData[5] = sprite.facing;
    this.paramsData[6] = encodeRarity(sprite.rarity);
    this.paramsData[7] = encodeKind(sprite.kind);
    this.paramsData[8] = hitFlash;
    this.paramsData[9] = frameIndex;
    this.paramsData[10] = sprite.animation?.frameCount ?? 1;
    this.paramsData[11] = 0;
    this.paramsData[12] = 0;
    this.paramsData[13] = encodeMotion(sprite.motionPreset);
    this.paramsData[14] = sprite.hpPercent ?? -1;
    this.paramsData[15] = 0;
    this.device.queue.writeBuffer(buffer, 0, this.paramsData);
  }

  private resolveHitState(sprite: RenderableSprite, timeMs: number): SpriteHitState {
    if (sprite.hpPercent === null) {
      return inactiveHitState;
    }

    const previousHpPercent = this.previousHpPercentBySpriteId.get(sprite.id);
    const hitDurationMs = getHitDurationMs(sprite);

    if (previousHpPercent !== undefined && sprite.hpPercent < previousHpPercent - hpDecreaseEpsilon) {
      this.hitStartMsBySpriteId.set(sprite.id, timeMs);
      this.hitUntilMsBySpriteId.set(sprite.id, timeMs + hitDurationMs);
    }

    this.previousHpPercentBySpriteId.set(sprite.id, sprite.hpPercent);
    const hitUntilMs = this.hitUntilMsBySpriteId.get(sprite.id) ?? 0;

    if (timeMs >= hitUntilMs) {
      return inactiveHitState;
    }

    return {
      active: true,
      elapsedMs: Math.max(0, timeMs - (this.hitStartMsBySpriteId.get(sprite.id) ?? timeMs)),
    };
  }

  private pruneSpriteAnimationState(activeSpriteIds: ReadonlySet<string>): void {
    for (const spriteId of this.previousHpPercentBySpriteId.keys()) {
      if (!activeSpriteIds.has(spriteId)) {
        this.previousHpPercentBySpriteId.delete(spriteId);
        this.hitStartMsBySpriteId.delete(spriteId);
        this.hitUntilMsBySpriteId.delete(spriteId);
      }
    }
  }
}

const inactiveHitState: SpriteHitState = { active: false, elapsedMs: 0 };

function resolveAnimationFrameIndex(sprite: RenderableSprite, timeMs: number, hitState: SpriteHitState): number {
  const animation = sprite.animation;

  if (!animation) {
    return 0;
  }

  const frameCount = Math.max(1, animation.frameCount);
  const movementFrameCount = Math.max(1, Math.min(animation.movementFrameCount, frameCount));
  const hitFrameCount = Math.max(0, Math.min(animation.hitFrameCount, frameCount - movementFrameCount));

  if (hitState.active && hitFrameCount > 0) {
    const hitFrame = Math.min(hitFrameCount - 1, Math.floor(hitState.elapsedMs / Math.max(1, animation.hitFrameMs)));
    return Math.min(frameCount - 1, movementFrameCount + hitFrame);
  }

  return Math.floor(timeMs / Math.max(1, animation.movementFrameMs)) % movementFrameCount;
}

function getHitDurationMs(sprite: RenderableSprite): number {
  if (!sprite.animation || sprite.animation.hitFrameCount <= 0) {
    return playerHitFlashDurationMs;
  }

  return Math.max(1, sprite.animation.hitFrameCount) * Math.max(1, sprite.animation.hitFrameMs);
}

function sortSprites(sprites: readonly RenderableSprite[]): readonly RenderableSprite[] {
  return [...sprites].sort((a, b) => {
    const layerDelta = spriteLayer(a.kind) - spriteLayer(b.kind);
    return layerDelta !== 0 ? layerDelta : a.position.y - b.position.y;
  });
}

function spriteLayer(kind: RenderableSpriteKind): number {
  switch (kind) {
    case "item":
      return 0;
    case "enemy":
      return 1;
    case "boss":
      return 2;
    case "player":
      return 3;
    default:
      return assertNever(kind);
  }
}

function encodeKind(kind: RenderableSpriteKind): number {
  switch (kind) {
    case "player":
      return 1;
    case "enemy":
      return 2;
    case "boss":
      return 3;
    case "item":
      return 4;
    default:
      return assertNever(kind);
  }
}

function encodeRarity(rarity: RenderableSpriteRarity): number {
  switch (rarity) {
    case "common":
      return 0;
    case "uncommon":
      return 1;
    case "rare":
      return 2;
    case "epic":
      return 3;
  }
}

function encodeMotion(motion: RenderableSpriteMotionPreset): number {
  switch (motion) {
    case "idle":
      return 0;
    case "bounce":
      return 1;
    case "shake":
      return 2;
    case "pulse":
      return 3;
    case "sway":
      return 4;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled sprite value: ${String(value)}`);
}

