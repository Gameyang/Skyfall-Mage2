// Responsibility: Composite the lower battlefield water surface in the WebGPU combat pass.
// Owner: render/webgpu/combatField

import type { BattleEnvironmentVisuals, RenderSnapshot, RenderableSprite } from "../../snapshots/RenderSnapshot";
import particleShaderSource from "./combatFieldWaterParticles.wgsl?raw";
import waterShaderSource from "./combatFieldWater.wgsl?raw";
import { WaterSurfaceSimulation, type WaterImpulseKind } from "./WaterSurfaceSimulation";

const springColumns = 320;
const maxInteractions = 24;
const interactionStride = 4;
const maxParticles = 1024;
const particleStride = 12;
const particleWorkgroupSize = 64;

type WaterInteractionPhase = "surface-impact" | "submerged-body";

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

type WaterParticleKind = "foam" | "spray" | "bubble";

interface WaterParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  radius: number;
  strength: number;
  kind: WaterParticleKind;
  seed: number;
}

export class CombatFieldWaterRenderer {
  private readonly simulation = new WaterSurfaceSimulation({ columns: springColumns });
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
  private readonly interactionData = new Float32Array(maxInteractions * interactionStride);
  private readonly spawnData = new Float32Array(maxParticles * particleStride);
  private readonly spriteSamples = new Map<string, SpriteSample>();
  private readonly spriteWakeTimes = new Map<string, number>();
  private readonly spriteFoamTimes = new Map<string, number>();
  private lastTimeMs: number | null = null;
  private randomState = 0x9e37_79b9;
  private pendingSpawnCount = 0;
  private particleCursor = 0;
  private particleRenderCount = 0;
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
      label: "Combat field water particle spawns",
      size: this.spawnData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "Combat field water shader",
      code: waterShaderSource,
    });
    const particleShaderModule = device.createShaderModule({
      label: "Combat field water particle compute shader",
      code: particleShaderSource,
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
      return;
    }

    this.shouldRender = true;
    const deltaMs = this.lastTimeMs === null ? 16.6667 : Math.min(50, Math.max(0, timeMs - this.lastTimeMs));
    this.lastTimeMs = timeMs;
    this.pendingSpawnCount = 0;
    const interactions = this.collectInteractions(snapshot, timeMs);
    this.spawnInteractionParticles(interactions, visuals, deltaMs);
    this.simulation.addRainRipples(deltaMs, visuals.rainRate);
    this.applyInteractionImpulses(interactions);
    this.simulation.update(deltaMs);
    this.device.queue.writeBuffer(this.springBuffer, 0, this.simulation.readHeights());
    this.writeInteractionData(interactions);
    this.writeSpawnData();
    const spawnStart = this.particleCursor;
    const previousParticleRenderCount = this.particleRenderCount;
    const nextParticleRenderCount = calculateNextParticleRenderCount(
      this.particleRenderCount,
      spawnStart,
      this.pendingSpawnCount,
    );
    this.writeParams(width, height, visuals, timeMs, interactions, deltaMs, spawnStart, this.pendingSpawnCount, nextParticleRenderCount);
    this.dispatchParticleCompute(encoder, previousParticleRenderCount, this.pendingSpawnCount);
    this.particleCursor = (spawnStart + this.pendingSpawnCount) % maxParticles;
    this.particleRenderCount = nextParticleRenderCount;
  }

  render(pass: GPURenderPassEncoder): void {
    if (!this.shouldRender) {
      return;
    }

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }

  dispose(): void {
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

      const bottom = sprite.position.y + sprite.size.y * 0.46;
      const depth = clamp((bottom - waterStart) / 0.18, 0, 1);
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
      const base = sprite.kind === "item" ? 0.16 : 0.36;
      const strength = clamp(base + speed * 0.052 + depth * 0.24, 0.12, 1.15);
      const enteringWater = previous ? previous.bottom < waterStart && bottom >= waterStart : false;
      const surfaceHit = enteringWater || (depth < 0.54 && verticalSpeed > 0.035);
      const lastWakeMs = this.spriteWakeTimes.get(sprite.id) ?? -Infinity;

      if (surfaceHit && timeMs - lastWakeMs >= (sprite.kind === "item" ? 220 : 96)) {
        const impactStrength = clamp(strength + Math.max(0, verticalSpeed) * 0.75, 0.16, 1.45);
        interactions.push({
          x: clamp(sprite.position.x, 0, 1),
          y: waterStart,
          radius: clamp(sprite.size.x * 0.72 + depth * 0.018, 0.02, 0.095),
          strength: impactStrength,
          velocity: -impactStrength * 1.48,
          kind: "wake",
          phase: "surface-impact",
        });
        this.spriteWakeTimes.set(sprite.id, timeMs);

        if (interactions.length >= maxInteractions) {
          continue;
        }
      }

      const lastFoamMs = this.spriteFoamTimes.get(sprite.id) ?? -Infinity;
      if (interactions.length < maxInteractions && timeMs - lastFoamMs >= (sprite.kind === "item" ? 260 : 150)) {
        interactions.push({
          x: clamp(sprite.position.x, 0, 1),
          y: clamp(Math.max(waterStart + 0.01, bottom - sprite.size.y * 0.18), 0, 1),
          radius: clamp(sprite.size.x * 0.54 + depth * 0.018, 0.014, 0.072),
          strength: clamp(strength * 0.72, 0.1, 0.92),
          velocity: -strength * 0.36,
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

        for (let index = 0; index < foamCount; index += 1) {
          this.spawnParticle(createFoamParticle(interaction, visuals.waterStart, visuals.windX, this.nextRandom()));
        }

        for (let index = 0; index < sprayCount; index += 1) {
          this.spawnParticle(createSprayParticle(interaction, visuals.waterStart, visuals.windX, this.nextRandom()));
        }
      } else {
        const submergedSprayCount = Math.round(20 + clamp((strength * frameScale - 0.08) / 0.92, 0, 1) * 30);

        for (let index = 0; index < submergedSprayCount; index += 1) {
          this.spawnParticle(createSubmergedSprayParticle(interaction, visuals.waterStart, visuals.windX, this.nextRandom()));
        }
      }
    }
  }

  private spawnParticle(particle: WaterParticle): void {
    if (this.pendingSpawnCount >= maxParticles) {
      return;
    }

    writeParticle(this.spawnData, this.pendingSpawnCount * particleStride, particle);
    this.pendingSpawnCount += 1;
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
    if (this.pendingSpawnCount <= 0) {
      return;
    }

    this.device.queue.writeBuffer(this.spawnBuffer, 0, this.spawnData, 0, this.pendingSpawnCount * particleStride);
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

function createFoamParticle(
  interaction: WaterInteraction,
  waterStart: number,
  windX: number,
  seed: number,
): WaterParticle {
  const offset = (seed - 0.5) * interaction.radius * 2.0;
  const strength = clamp(Math.abs(interaction.strength), 0.08, 1.5);

  return {
    x: wrap01(interaction.x + offset),
    y: clamp(waterStart + (seed - 0.52) * 0.01, 0, 1),
    vx: (seed - 0.5) * 0.018 + windX * 0.012,
    vy: 0,
    ageMs: 0,
    lifeMs: 720 + seed * 820,
    radius: clamp(0.004 + interaction.radius * 0.12 + strength * 0.0025, 0.004, 0.018),
    strength,
    kind: "foam",
    seed,
  };
}

function createSprayParticle(
  interaction: WaterInteraction,
  waterStart: number,
  windX: number,
  seed: number,
): WaterParticle {
  const side = seed < 0.5 ? -1 : 1;
  const strength = clamp(Math.abs(interaction.strength), 0.08, 1.6);
  const lift = 0.16 + strength * 0.14 + seed * 0.07;

  return {
    x: wrap01(interaction.x + side * interaction.radius * (0.15 + seed * 0.55)),
    y: clamp(Math.min(interaction.y, waterStart) - 0.004 - seed * 0.012, 0, 1),
    vx: side * (0.045 + seed * 0.09) + windX * 0.026,
    vy: -lift,
    ageMs: 0,
    lifeMs: 280 + seed * 320,
    radius: clamp(0.0016 + strength * 0.0018 + interaction.radius * 0.018, 0.0016, 0.0065),
    strength,
    kind: "spray",
    seed,
  };
}

function createSubmergedSprayParticle(
  interaction: WaterInteraction,
  waterStart: number,
  windX: number,
  seed: number,
): WaterParticle {
  const strength = clamp(Math.abs(interaction.strength), 0.06, 1.2);
  const lateral = seed - 0.5;

  return {
    x: wrap01(interaction.x + lateral * interaction.radius * 1.35),
    y: clamp(Math.max(waterStart + 0.012, interaction.y + (seed - 0.45) * interaction.radius * 0.9), 0, 1),
    vx: lateral * 0.026 + windX * 0.006,
    vy: -(0.018 + seed * 0.035 + strength * 0.018),
    ageMs: 0,
    lifeMs: 520 + seed * 560,
    radius: clamp(0.0018 + interaction.radius * 0.035 + strength * 0.0018, 0.0018, 0.007),
    strength,
    kind: "bubble",
    seed,
  };
}

function encodeParticleKind(kind: WaterParticleKind): number {
  switch (kind) {
    case "foam":
      return 0;
    case "spray":
      return 1;
    case "bubble":
      return 2;
  }
}

function writeParticle(data: Float32Array, offset: number, particle: WaterParticle): void {
  data[offset] = particle.x;
  data[offset + 1] = particle.y;
  data[offset + 2] = particle.radius;
  data[offset + 3] = encodeParticleKind(particle.kind);
  data[offset + 4] = particle.vx;
  data[offset + 5] = particle.vy;
  data[offset + 6] = particle.ageMs;
  data[offset + 7] = particle.lifeMs;
  data[offset + 8] = particle.seed;
  data[offset + 9] = particle.strength;
  data[offset + 10] = 0;
  data[offset + 11] = 0;
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

function isWaterInteractiveSprite(sprite: RenderableSprite): boolean {
  return sprite.kind === "player" || sprite.kind === "item";
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

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}
