// Responsibility: Composite the lower battlefield water surface in the WebGPU combat pass.
// Owner: render/webgpu/combatField

import type {
  BattleEnvironmentVisuals,
  RenderSnapshot,
  RenderableSprite,
  RenderableSpriteKind,
  WeaponEffectSprite,
} from "../../snapshots/RenderSnapshot";
import particleShaderSource from "./combatFieldWaterParticles.wgsl?raw";
import spriteEffectShaderSource from "./combatFieldWaterSpriteEffect.wgsl?raw";
import waterShaderSource from "./combatFieldWater.wgsl?raw";
import { SpriteTextureCache } from "./SpriteTextureCache";
import { WaterSurfaceSimulation, type WaterImpulseKind } from "./WaterSurfaceSimulation";

const springColumns = 320;
const waterSurfaceWaveDamping = 0.045;
const waterSurfaceWaveSpeed = 1.8;
const waterSurfaceWaveSmoothing = 0.36;
const waterSurfaceWaveSpread = 0.28;
const waterSurfaceWaveTension = 0.027;
const waterSurfaceContactReach = 0.035;
const waterSurfaceContactDepth = 0.22;
const maxInteractions = 24;
const interactionStride = 4;
const maxParticles = 1024;
const maxParticleEmitters = maxInteractions * 2;
const particleStride = 12;
const particleEmitterStride = 8;
const particleWorkgroupSize = 64;
const enableWaterParticleSprites = false;
const enableWaterSpriteSheetEffects = false;
const waterEffectFrameCount = 8;
const maxWaterSpriteEffects = 48;

const waterEffectTextureUrls = {
  entrySurface: new URL("../../../assets/effects/water-entry-surface-sheet.webp", import.meta.url).href,
  entryUnderwater: new URL("../../../assets/effects/water-entry-underwater-sheet.webp", import.meta.url).href,
  underwaterLoop: new URL("../../../assets/effects/water-underwater-loop-sheet.webp", import.meta.url).href,
} as const;

type WaterInteractionPhase = "surface-impact" | "submerged-body";
type WaterSpriteEffectKind = "entry-surface" | "entry-underwater" | "underwater-loop";

interface WaterInteraction {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
  readonly velocity: number;
  readonly kind: WaterImpulseKind;
  readonly phase: WaterInteractionPhase;
}

interface SpriteSample {
  readonly x: number;
  readonly y: number;
  readonly bottom: number;
  readonly timeMs: number;
}

type WaterParticleEmitterKind = "foam" | "spray" | "bubble";

interface WaterParticleEmitter {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
  readonly kind: WaterParticleEmitterKind;
  readonly count: number;
  readonly seed: number;
  readonly windX: number;
}

interface WaterSpriteEffect {
  readonly id: number;
  readonly kind: WaterSpriteEffectKind;
  readonly textureUrl: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly size: { readonly x: number; readonly y: number };
  readonly startMs: number;
  readonly durationMs: number;
  readonly opacity: number;
  readonly rotationRadians: number;
  readonly facing: -1 | 1;
}

interface WaterSpriteEffectDraw {
  readonly bindGroup: GPUBindGroup;
}

export class CombatFieldWaterRenderer {
  private readonly simulation = new WaterSurfaceSimulation({
    columns: springColumns,
    damping: waterSurfaceWaveDamping,
    smoothing: waterSurfaceWaveSmoothing,
    speed: waterSurfaceWaveSpeed,
    spread: waterSurfaceWaveSpread,
    tension: waterSurfaceWaveTension,
  });
  private readonly spriteEffectTextureCache: SpriteTextureCache;
  private readonly spriteEffectSampler: GPUSampler;
  private readonly spriteEffectBindGroupLayout: GPUBindGroupLayout;
  private readonly spriteEffectPipeline: GPURenderPipeline;
  private readonly paramsBuffer: GPUBuffer;
  private readonly springBuffer: GPUBuffer;
  private readonly interactionBuffer: GPUBuffer;
  private readonly particleBuffer: GPUBuffer;
  private readonly spawnBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly particleComputeBindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly particleUpdatePipeline: GPUComputePipeline;
  private readonly particleSpawnPipeline: GPUComputePipeline;
  private readonly paramsData = new Float32Array(20);
  private readonly spriteEffectParamsData = new Float32Array(12);
  private readonly spriteEffectParamsBuffers: GPUBuffer[] = [];
  private readonly interactionData = new Float32Array(maxInteractions * interactionStride);
  private readonly spawnData = new Float32Array(maxParticleEmitters * particleEmitterStride);
  private readonly spriteSamples = new Map<string, SpriteSample>();
  private readonly spriteWakeTimes = new Map<string, number>();
  private readonly spriteFoamTimes = new Map<string, number>();
  private readonly effectWakeTimes = new Map<string, number>();
  private lastTimeMs: number | null = null;
  private randomState = 0x9e37_79b9;
  private pendingSpawnEmitterCount = 0;
  private pendingSpawnParticleCount = 0;
  private particleCursor = 0;
  private particleRenderCount = 0;
  private nextSpriteEffectId = 1;
  private activeSpriteEffects: readonly WaterSpriteEffect[] = [];
  private spriteEffectDraws: readonly WaterSpriteEffectDraw[] = [];
  private shouldRender = false;

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
    this.interactionBuffer = device.createBuffer({
      label: "Combat field water interactions",
      size: this.interactionData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.particleBuffer = device.createBuffer({
      label: "Combat field water particles",
      size: maxParticles * particleStride * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.spawnBuffer = device.createBuffer({
      label: "Combat field water particle emitters",
      size: this.spawnData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.spriteEffectTextureCache = new SpriteTextureCache(device);
    this.spriteEffectSampler = device.createSampler({
      label: "Combat field water sprite effect sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });

    for (const url of Object.values(waterEffectTextureUrls)) {
      this.spriteEffectTextureCache.get(url);
    }

    const shaderModule = device.createShaderModule({
      label: "Combat field water shader",
      code: waterShaderSource,
    });
    const particleShaderModule = device.createShaderModule({
      label: "Combat field water particle compute shader",
      code: particleShaderSource,
    });
    const spriteEffectShaderModule = device.createShaderModule({
      label: "Combat field water sprite effect shader",
      code: spriteEffectShaderSource,
    });
    const bindGroupLayout = device.createBindGroupLayout({
      label: "Combat field water bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      ],
    });
    const particleComputeBindGroupLayout = device.createBindGroupLayout({
      label: "Combat field water particle compute bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      ],
    });
    this.spriteEffectBindGroupLayout = device.createBindGroupLayout({
      label: "Combat field water sprite effect bind group layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
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
    this.particleUpdatePipeline = device.createComputePipeline({
      label: "Combat field water particle update pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field water particle update pipeline layout",
        bindGroupLayouts: [particleComputeBindGroupLayout],
      }),
      compute: {
        module: particleShaderModule,
        entryPoint: "updateParticles",
      },
    });
    this.particleSpawnPipeline = device.createComputePipeline({
      label: "Combat field water particle spawn pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field water particle spawn pipeline layout",
        bindGroupLayouts: [particleComputeBindGroupLayout],
      }),
      compute: {
        module: particleShaderModule,
        entryPoint: "spawnParticles",
      },
    });
    this.spriteEffectPipeline = device.createRenderPipeline({
      label: "Combat field water sprite effect pipeline",
      layout: device.createPipelineLayout({
        label: "Combat field water sprite effect pipeline layout",
        bindGroupLayouts: [this.spriteEffectBindGroupLayout],
      }),
      vertex: {
        module: spriteEffectShaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: spriteEffectShaderModule,
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
        { binding: 2, resource: { buffer: this.interactionBuffer } },
        { binding: 3, resource: { buffer: this.particleBuffer } },
      ],
    });
    this.particleComputeBindGroup = device.createBindGroup({
      label: "Combat field water particle compute bind group",
      layout: particleComputeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer } },
        { binding: 2, resource: { buffer: this.spawnBuffer } },
      ],
    });
  }

  prepare(encoder: GPUCommandEncoder, width: number, height: number, snapshot: RenderSnapshot, timeMs: number): void {
    const visuals = snapshot.environment;

    if (visuals.waterCoverage <= 0) {
      this.shouldRender = false;
      this.activeSpriteEffects = [];
      this.spriteEffectDraws = [];
      return;
    }

    this.shouldRender = true;
    const deltaMs = this.lastTimeMs === null ? 16.6667 : Math.min(50, Math.max(0, timeMs - this.lastTimeMs));
    this.lastTimeMs = timeMs;
    this.pendingSpawnEmitterCount = 0;
    this.pendingSpawnParticleCount = 0;
    this.spawnData.fill(0);
    const interactions = this.collectInteractions(snapshot, timeMs);
    if (enableWaterSpriteSheetEffects) {
      this.spawnInteractionSpriteEffects(interactions, timeMs);
    }
    if (enableWaterParticleSprites) {
      this.spawnInteractionParticles(interactions, visuals, deltaMs);
    } else {
      this.particleCursor = 0;
      this.particleRenderCount = 0;
    }
    this.simulation.addRainRipples(deltaMs, visuals.rainRate);
    this.applyInteractionImpulses(interactions);
    this.simulation.update(deltaMs);
    this.device.queue.writeBuffer(this.springBuffer, 0, this.simulation.readHeights());
    this.writeInteractionData(interactions);
    this.writeSpawnData();
    const spawnStart = enableWaterParticleSprites ? this.particleCursor : 0;
    const previousParticleRenderCount = enableWaterParticleSprites ? this.particleRenderCount : 0;
    const spawnCount = enableWaterParticleSprites ? this.pendingSpawnParticleCount : 0;
    const nextParticleRenderCount = enableWaterParticleSprites
      ? calculateNextParticleRenderCount(this.particleRenderCount, spawnStart, spawnCount)
      : 0;
    this.writeParams(width, height, visuals, timeMs, interactions, deltaMs, spawnStart, spawnCount, nextParticleRenderCount);

    if (enableWaterParticleSprites) {
      this.dispatchParticleCompute(encoder, previousParticleRenderCount, spawnCount);
      this.particleCursor = (spawnStart + spawnCount) % maxParticles;
    }

    this.particleRenderCount = nextParticleRenderCount;
    this.prepareSpriteEffectDraws(width, height, timeMs);
  }

  render(pass: GPURenderPassEncoder): void {
    if (!this.shouldRender) {
      return;
    }

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    this.renderSpriteEffects(pass);
  }

  dispose(): void {
    this.spriteEffectTextureCache.dispose();
    for (const buffer of this.spriteEffectParamsBuffers) {
      buffer.destroy();
    }
    this.paramsBuffer.destroy();
    this.springBuffer.destroy();
    this.interactionBuffer.destroy();
    this.particleBuffer.destroy();
    this.spawnBuffer.destroy();
  }

  private collectInteractions(snapshot: RenderSnapshot, timeMs: number): readonly WaterInteraction[] {
    const interactions: WaterInteraction[] = [];
    const waterStart = snapshot.environment.waterStart;

    this.collectSpriteWakeInteractions(snapshot.sprites, waterStart, timeMs, interactions);
    this.collectWeaponEffectWakeInteractions(snapshot.weaponEffects, waterStart, timeMs, interactions);
    return interactions;
  }

  private collectSpriteWakeInteractions(
    sprites: readonly RenderableSprite[],
    waterStart: number,
    timeMs: number,
    interactions: WaterInteraction[],
  ): void {
    const activeIds = new Set<string>();

    for (const sprite of sprites) {
      if (!isWaterInteractiveSprite(sprite)) {
        continue;
      }

      activeIds.add(sprite.id);

      if (interactions.length >= maxInteractions) {
        continue;
      }

      const profile = spriteWakeProfile(sprite.kind);
      const bottom = sprite.position.y + sprite.size.y * 0.46;
      const depth = clamp((bottom - waterStart + waterSurfaceContactReach) / waterSurfaceContactDepth, 0, 1);
      const previous = this.spriteSamples.get(sprite.id);
      this.spriteSamples.set(sprite.id, { x: sprite.position.x, y: sprite.position.y, bottom, timeMs });

      if (depth <= 0) {
        continue;
      }

      const deltaSeconds = previous ? Math.max(0.016, (timeMs - previous.timeMs) / 1_000) : 0.016;
      const speed = previous
        ? Math.hypot(sprite.position.x - previous.x, sprite.position.y - previous.y) / deltaSeconds
        : 0;
      const verticalSpeed = previous ? (bottom - previous.bottom) / deltaSeconds : 0;
      const strength = clamp(
        profile.baseStrength + speed * profile.speedScale + depth * profile.depthScale,
        profile.minStrength,
        profile.maxStrength,
      );
      const enteringWater = previous ? previous.bottom < waterStart && bottom >= waterStart : false;
      const surfaceHit = enteringWater || (depth < 0.54 && verticalSpeed > 0.035);
      const lastWakeMs = this.spriteWakeTimes.get(sprite.id) ?? -Infinity;

      if (surfaceHit && timeMs - lastWakeMs >= profile.surfaceCooldownMs) {
        const impactStrength = clamp(
          strength + Math.max(0, verticalSpeed) * profile.verticalSpeedScale,
          profile.minStrength,
          profile.maxImpactStrength,
        );
        interactions.push({
          x: clamp(sprite.position.x, 0, 1),
          y: waterStart,
          radius: clamp(sprite.size.x * profile.surfaceRadiusScale + depth * 0.024, 0.02, profile.maxRadius),
          strength: impactStrength,
          velocity: -impactStrength * profile.surfaceVelocityScale,
          kind: "wake",
          phase: "surface-impact",
        });
        this.spriteWakeTimes.set(sprite.id, timeMs);

        if (interactions.length >= maxInteractions) {
          continue;
        }
      }

      const lastFoamMs = this.spriteFoamTimes.get(sprite.id) ?? -Infinity;
      if (interactions.length < maxInteractions && timeMs - lastFoamMs >= profile.bodyCooldownMs) {
        interactions.push({
          x: clamp(sprite.position.x, 0, 1),
          y: clamp(Math.max(waterStart + 0.01, bottom - sprite.size.y * 0.18), 0, 1),
          radius: clamp(sprite.size.x * profile.bodyRadiusScale + depth * 0.022, 0.014, profile.maxRadius * 0.82),
          strength: clamp(strength * profile.bodyStrengthScale, 0.1, profile.maxStrength),
          velocity: -strength * profile.bodyVelocityScale,
          kind: "wake",
          phase: "submerged-body",
        });
        this.spriteFoamTimes.set(sprite.id, timeMs);
      }
    }

    for (const spriteId of this.spriteSamples.keys()) {
      if (!activeIds.has(spriteId)) {
        this.spriteSamples.delete(spriteId);
        this.spriteWakeTimes.delete(spriteId);
        this.spriteFoamTimes.delete(spriteId);
      }
    }
  }

  private collectWeaponEffectWakeInteractions(
    effects: readonly WeaponEffectSprite[],
    waterStart: number,
    timeMs: number,
    interactions: WaterInteraction[],
  ): void {
    const activeIds = new Set<string>();

    for (const effect of effects) {
      if (interactions.length >= maxInteractions) {
        break;
      }

      activeIds.add(effect.id);

      if (!isWaterInteractiveEffect(effect)) {
        continue;
      }

      const bottom = effect.position.y + effect.size.y * 0.5;
      const depth = clamp((bottom - waterStart + waterSurfaceContactReach) / waterSurfaceContactDepth, 0, 1);

      if (depth <= 0) {
        continue;
      }

      const lastWakeMs = this.effectWakeTimes.get(effect.id) ?? -Infinity;

      if (timeMs - lastWakeMs < 110) {
        continue;
      }

      const size = Math.max(effect.size.x, effect.size.y);
      const strength = clamp(effect.opacity * (0.22 + size * 2.6 + depth * 0.42), 0.12, 1.35);
      interactions.push({
        x: clamp(effect.position.x, 0, 1),
        y: waterStart,
        radius: clamp(size * 0.52 + depth * 0.026, 0.018, 0.12),
        strength,
        velocity: -strength * 1.16,
        kind: "force",
        phase: "surface-impact",
      });
      this.effectWakeTimes.set(effect.id, timeMs);
    }

    for (const effectId of this.effectWakeTimes.keys()) {
      if (!activeIds.has(effectId)) {
        this.effectWakeTimes.delete(effectId);
      }
    }
  }

  private applyInteractionImpulses(interactions: readonly WaterInteraction[]): void {
    for (const interaction of interactions) {
      this.simulation.applyImpulse({
        x: interaction.x,
        radius: interaction.radius,
        velocity: interaction.velocity,
        kind: interaction.kind,
      });
    }
  }

  private spawnInteractionSpriteEffects(interactions: readonly WaterInteraction[], timeMs: number): void {
    for (const interaction of interactions) {
      const strength = clamp(Math.abs(interaction.strength), 0.05, 1.6);

      if (interaction.phase === "surface-impact") {
        const surfaceHeight = clamp(0.11 + interaction.radius * 1.95 + strength * 0.028, 0.12, 0.27);
        this.queueSpriteEffect({
          id: this.nextSpriteEffectId++,
          kind: "entry-surface",
          textureUrl: waterEffectTextureUrls.entrySurface,
          position: {
            x: interaction.x,
            y: clamp(interaction.y - surfaceHeight * 0.08, 0, 1),
          },
          size: {
            x: clamp(interaction.radius * 5.1 + strength * 0.02, 0.13, 0.34),
            y: surfaceHeight,
          },
          startMs: timeMs,
          durationMs: 560,
          opacity: clamp(0.74 + strength * 0.14, 0, 0.96),
          rotationRadians: 0,
          facing: this.nextRandom() < 0.5 ? -1 : 1,
        });

        const underwaterHeight = clamp(0.15 + interaction.radius * 3.1 + strength * 0.032, 0.17, 0.34);
        this.queueSpriteEffect({
          id: this.nextSpriteEffectId++,
          kind: "entry-underwater",
          textureUrl: waterEffectTextureUrls.entryUnderwater,
          position: {
            x: interaction.x,
            y: clamp(interaction.y + underwaterHeight * 0.36, 0, 1),
          },
          size: {
            x: clamp(interaction.radius * 4.0 + strength * 0.012, 0.10, 0.24),
            y: underwaterHeight,
          },
          startMs: timeMs,
          durationMs: 640,
          opacity: clamp(0.56 + strength * 0.18, 0, 0.86),
          rotationRadians: 0,
          facing: this.nextRandom() < 0.5 ? -1 : 1,
        });
      } else {
        const loopHeight = clamp(0.09 + interaction.radius * 2.15 + strength * 0.024, 0.10, 0.22);
        this.queueSpriteEffect({
          id: this.nextSpriteEffectId++,
          kind: "underwater-loop",
          textureUrl: waterEffectTextureUrls.underwaterLoop,
          position: {
            x: interaction.x,
            y: clamp(interaction.y, 0, 1),
          },
          size: {
            x: clamp(interaction.radius * 2.6 + strength * 0.012, 0.075, 0.18),
            y: loopHeight,
          },
          startMs: timeMs,
          durationMs: 720,
          opacity: clamp(0.36 + strength * 0.22, 0, 0.72),
          rotationRadians: (this.nextRandom() - 0.5) * 0.12,
          facing: this.nextRandom() < 0.5 ? -1 : 1,
        });
      }
    }
  }

  private queueSpriteEffect(effect: WaterSpriteEffect): void {
    const active = this.activeSpriteEffects.length >= maxWaterSpriteEffects
      ? this.activeSpriteEffects.slice(1)
      : this.activeSpriteEffects;
    this.activeSpriteEffects = [...active, effect];
  }

  private prepareSpriteEffectDraws(width: number, height: number, timeMs: number): void {
    const aspectScale = height / Math.max(1, width);
    const activeEffects = this.activeSpriteEffects.filter((effect) => timeMs - effect.startMs < effect.durationMs);
    const draws: WaterSpriteEffectDraw[] = [];

    for (const effect of sortSpriteEffects(activeEffects)) {
      const texture = this.spriteEffectTextureCache.get(effect.textureUrl);

      if (!texture) {
        continue;
      }

      const paramsBuffer = this.ensureSpriteEffectParamsBuffer(draws.length);
      this.writeSpriteEffectParams(paramsBuffer, effect, timeMs, aspectScale);
      draws.push({
        bindGroup: this.device.createBindGroup({
          label: `Combat field water sprite effect bind group ${effect.id}`,
          layout: this.spriteEffectBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: paramsBuffer } },
            { binding: 1, resource: texture.view },
            { binding: 2, resource: this.spriteEffectSampler },
          ],
        }),
      });
    }

    this.activeSpriteEffects = activeEffects;
    this.spriteEffectDraws = draws;
  }

  private renderSpriteEffects(pass: GPURenderPassEncoder): void {
    if (this.spriteEffectDraws.length === 0) {
      return;
    }

    pass.setPipeline(this.spriteEffectPipeline);

    for (const draw of this.spriteEffectDraws) {
      pass.setBindGroup(0, draw.bindGroup);
      pass.draw(6);
    }
  }

  private ensureSpriteEffectParamsBuffer(index: number): GPUBuffer {
    const existing = this.spriteEffectParamsBuffers[index];

    if (existing) {
      return existing;
    }

    const buffer = this.device.createBuffer({
      label: `Combat field water sprite effect params ${index}`,
      size: this.spriteEffectParamsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.spriteEffectParamsBuffers[index] = buffer;
    return buffer;
  }

  private writeSpriteEffectParams(
    buffer: GPUBuffer,
    effect: WaterSpriteEffect,
    timeMs: number,
    aspectScale: number,
  ): void {
    const ageRatio = clamp((timeMs - effect.startMs) / Math.max(1, effect.durationMs), 0, 0.999);
    const frameIndex = Math.min(waterEffectFrameCount - 1, Math.floor(ageRatio * waterEffectFrameCount));
    const opacity = effect.opacity * effectOpacity(effect.kind, ageRatio);

    this.spriteEffectParamsData.fill(0);
    this.spriteEffectParamsData[0] = effect.position.x;
    this.spriteEffectParamsData[1] = effect.position.y;
    this.spriteEffectParamsData[2] = effect.size.x * aspectScale;
    this.spriteEffectParamsData[3] = effect.size.y;
    this.spriteEffectParamsData[4] = frameIndex;
    this.spriteEffectParamsData[5] = waterEffectFrameCount;
    this.spriteEffectParamsData[6] = opacity;
    this.spriteEffectParamsData[7] = 0;
    this.spriteEffectParamsData[8] = effect.rotationRadians;
    this.spriteEffectParamsData[9] = effect.facing;
    this.spriteEffectParamsData[10] = 0;
    this.spriteEffectParamsData[11] = 0;
    this.device.queue.writeBuffer(buffer, 0, this.spriteEffectParamsData);
  }

  private spawnInteractionParticles(
    interactions: readonly WaterInteraction[],
    visuals: BattleEnvironmentVisuals,
    deltaMs: number,
  ): void {
    const frameScale = clamp(deltaMs / 16.6667, 0.35, 1.35);

    for (const interaction of interactions) {
      const strength = clamp(Math.abs(interaction.strength), 0.05, 1.8);

      if (interaction.phase === "surface-impact") {
        const foamCount = Math.min(5, Math.max(2, Math.round(strength * frameScale * 2.1)));
        const sprayCount = Math.round(50 + clamp((strength * frameScale - 0.12) / 1.28, 0, 1) * 50);

        this.queueParticleEmitter(createParticleEmitter(interaction, visuals.windX, "foam", foamCount, this.nextRandom()));
        this.queueParticleEmitter(createParticleEmitter(interaction, visuals.windX, "spray", sprayCount, this.nextRandom()));
      } else {
        const submergedSprayCount = Math.round(20 + clamp((strength * frameScale - 0.08) / 0.92, 0, 1) * 30);

        this.queueParticleEmitter(createParticleEmitter(interaction, visuals.windX, "bubble", submergedSprayCount, this.nextRandom()));
      }
    }
  }

  private queueParticleEmitter(emitter: WaterParticleEmitter): void {
    if (
      this.pendingSpawnEmitterCount >= maxParticleEmitters ||
      this.pendingSpawnParticleCount >= maxParticles ||
      emitter.count <= 0
    ) {
      return;
    }

    const count = Math.min(emitter.count, maxParticles - this.pendingSpawnParticleCount);
    writeParticleEmitter(this.spawnData, this.pendingSpawnEmitterCount * particleEmitterStride, emitter, count);
    this.pendingSpawnEmitterCount += 1;
    this.pendingSpawnParticleCount += count;
  }

  private writeInteractionData(interactions: readonly WaterInteraction[]): void {
    this.interactionData.fill(0);
    interactions.slice(0, maxInteractions).forEach((interaction, index) => {
      const offset = index * interactionStride;
      this.interactionData[offset] = interaction.x;
      this.interactionData[offset + 1] = interaction.y;
      this.interactionData[offset + 2] = interaction.radius;
      this.interactionData[offset + 3] = interaction.strength;
    });
    this.device.queue.writeBuffer(this.interactionBuffer, 0, this.interactionData);
  }

  private writeSpawnData(): void {
    if (this.pendingSpawnParticleCount <= 0) {
      return;
    }

    this.device.queue.writeBuffer(this.spawnBuffer, 0, this.spawnData);
  }

  private dispatchParticleCompute(
    encoder: GPUCommandEncoder,
    previousParticleRenderCount: number,
    spawnCount: number,
  ): void {
    if (previousParticleRenderCount <= 0 && spawnCount <= 0) {
      return;
    }

    const pass = encoder.beginComputePass({
      label: "Combat field water particle compute pass",
    });
    pass.setBindGroup(0, this.particleComputeBindGroup);

    if (previousParticleRenderCount > 0) {
      pass.setPipeline(this.particleUpdatePipeline);
      pass.dispatchWorkgroups(Math.ceil(previousParticleRenderCount / particleWorkgroupSize));
    }

    if (spawnCount > 0) {
      pass.setPipeline(this.particleSpawnPipeline);
      pass.dispatchWorkgroups(Math.ceil(spawnCount / particleWorkgroupSize));
    }

    pass.end();
  }

  private writeParams(
    width: number,
    height: number,
    visuals: BattleEnvironmentVisuals,
    timeMs: number,
    interactions: readonly WaterInteraction[],
    deltaMs: number,
    spawnStart: number,
    spawnCount: number,
    particleRenderCount: number,
  ): void {
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
    this.paramsData[14] = Math.min(maxInteractions, interactions.length);
    const interactionEnergy = clamp(
      interactions.reduce((sum, interaction) => sum + Math.abs(interaction.strength), 0) / 5,
      0,
      1,
    );
    this.paramsData[15] = Math.max(0, deltaMs) / 1_000;
    this.paramsData[16] = particleRenderCount;
    this.paramsData[17] = interactionEnergy;
    this.paramsData[18] = spawnStart;
    this.paramsData[19] = spawnCount;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);
  }

  private nextRandom(): number {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 0x1_0000_0000;
  }
}

function createParticleEmitter(
  interaction: WaterInteraction,
  windX: number,
  kind: WaterParticleEmitterKind,
  count: number,
  seed: number,
): WaterParticleEmitter {
  return {
    x: interaction.x,
    y: interaction.y,
    radius: interaction.radius,
    strength: Math.abs(interaction.strength),
    kind,
    count,
    seed,
    windX,
  };
}

function encodeParticleEmitterKind(kind: WaterParticleEmitterKind): number {
  switch (kind) {
    case "foam":
      return 0;
    case "spray":
      return 1;
    case "bubble":
      return 2;
  }
}

function writeParticleEmitter(
  data: Float32Array,
  offset: number,
  emitter: WaterParticleEmitter,
  count: number,
): void {
  data[offset] = emitter.x;
  data[offset + 1] = emitter.y;
  data[offset + 2] = emitter.radius;
  data[offset + 3] = emitter.strength;
  data[offset + 4] = encodeParticleEmitterKind(emitter.kind);
  data[offset + 5] = count;
  data[offset + 6] = emitter.seed;
  data[offset + 7] = emitter.windX;
}

function calculateNextParticleRenderCount(currentCount: number, spawnStart: number, spawnCount: number): number {
  if (spawnCount <= 0) {
    return currentCount;
  }

  if (spawnCount >= maxParticles || spawnStart + spawnCount >= maxParticles) {
    return maxParticles;
  }

  return Math.min(maxParticles, Math.max(currentCount, spawnStart + spawnCount));
}

function sortSpriteEffects(effects: readonly WaterSpriteEffect[]): readonly WaterSpriteEffect[] {
  return [...effects].sort((a, b) => {
    const layerDelta = spriteEffectLayer(a.kind) - spriteEffectLayer(b.kind);
    return layerDelta !== 0 ? layerDelta : a.position.y - b.position.y;
  });
}

function spriteEffectLayer(kind: WaterSpriteEffectKind): number {
  switch (kind) {
    case "entry-underwater":
      return 0;
    case "underwater-loop":
      return 1;
    case "entry-surface":
      return 2;
  }
}

function effectOpacity(kind: WaterSpriteEffectKind, ageRatio: number): number {
  switch (kind) {
    case "entry-surface":
      return 1 - smoothstep(0.72, 1, ageRatio) * 0.5;
    case "entry-underwater":
      return (1 - smoothstep(0.78, 1, ageRatio)) * smoothstep(0, 0.12, ageRatio);
    case "underwater-loop":
      return smoothstep(0, 0.18, ageRatio) * (1 - smoothstep(0.72, 1, ageRatio));
  }
}

interface SpriteWakeProfile {
  readonly baseStrength: number;
  readonly speedScale: number;
  readonly depthScale: number;
  readonly minStrength: number;
  readonly maxStrength: number;
  readonly maxImpactStrength: number;
  readonly verticalSpeedScale: number;
  readonly surfaceVelocityScale: number;
  readonly bodyVelocityScale: number;
  readonly bodyStrengthScale: number;
  readonly surfaceRadiusScale: number;
  readonly bodyRadiusScale: number;
  readonly maxRadius: number;
  readonly surfaceCooldownMs: number;
  readonly bodyCooldownMs: number;
}

function spriteWakeProfile(kind: RenderableSpriteKind): SpriteWakeProfile {
  switch (kind) {
    case "boss":
      return {
        baseStrength: 0.58,
        speedScale: 0.08,
        depthScale: 0.42,
        minStrength: 0.18,
        maxStrength: 1.35,
        maxImpactStrength: 1.72,
        verticalSpeedScale: 1.05,
        surfaceVelocityScale: 1.72,
        bodyVelocityScale: 0.9,
        bodyStrengthScale: 0.82,
        surfaceRadiusScale: 0.92,
        bodyRadiusScale: 0.72,
        maxRadius: 0.13,
        surfaceCooldownMs: 96,
        bodyCooldownMs: 132,
      };
    case "enemy":
      return {
        baseStrength: 0.38,
        speedScale: 0.07,
        depthScale: 0.34,
        minStrength: 0.14,
        maxStrength: 1.12,
        maxImpactStrength: 1.48,
        verticalSpeedScale: 0.92,
        surfaceVelocityScale: 1.58,
        bodyVelocityScale: 0.72,
        bodyStrengthScale: 0.78,
        surfaceRadiusScale: 0.86,
        bodyRadiusScale: 0.66,
        maxRadius: 0.105,
        surfaceCooldownMs: 104,
        bodyCooldownMs: 145,
      };
    case "item":
      return {
        baseStrength: 0.2,
        speedScale: 0.052,
        depthScale: 0.24,
        minStrength: 0.12,
        maxStrength: 0.92,
        maxImpactStrength: 1.3,
        verticalSpeedScale: 0.82,
        surfaceVelocityScale: 1.52,
        bodyVelocityScale: 0.48,
        bodyStrengthScale: 0.72,
        surfaceRadiusScale: 0.78,
        bodyRadiusScale: 0.58,
        maxRadius: 0.09,
        surfaceCooldownMs: 220,
        bodyCooldownMs: 260,
      };
    case "player":
      return {
        baseStrength: 0.46,
        speedScale: 0.074,
        depthScale: 0.36,
        minStrength: 0.16,
        maxStrength: 1.2,
        maxImpactStrength: 1.56,
        verticalSpeedScale: 1.0,
        surfaceVelocityScale: 1.64,
        bodyVelocityScale: 0.78,
        bodyStrengthScale: 0.8,
        surfaceRadiusScale: 0.84,
        bodyRadiusScale: 0.66,
        maxRadius: 0.112,
        surfaceCooldownMs: 96,
        bodyCooldownMs: 145,
      };
  }
}

function isWaterInteractiveSprite(sprite: RenderableSprite): boolean {
  return sprite.kind === "player" || sprite.kind === "enemy" || sprite.kind === "boss" || sprite.kind === "item";
}

function isWaterInteractiveEffect(effect: WeaponEffectSprite): boolean {
  return effect.opacity > 0.08 && effect.size.x > 0.001 && effect.size.y > 0.001;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
