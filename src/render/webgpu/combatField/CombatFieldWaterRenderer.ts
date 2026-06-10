// Responsibility: Composite the lower battlefield water surface in the WebGPU combat pass.
// Owner: render/webgpu/combatField

import type { BattleEnvironmentVisuals, RenderSnapshot, RenderableSprite } from "../../snapshots/RenderSnapshot";
import waterShaderSource from "./combatFieldWater.wgsl?raw";
import { WaterSurfaceSimulation, type WaterImpulseKind } from "./WaterSurfaceSimulation";

const springColumns = 160;
const maxInteractions = 24;
const interactionStride = 4;
const maxParticles = 160;
const particleStride = 8;

interface WaterInteraction {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
  readonly velocity: number;
  readonly kind: WaterImpulseKind;
}

interface SpriteSample {
  readonly x: number;
  readonly y: number;
  readonly timeMs: number;
}

type WaterParticleKind = "foam" | "droplet";

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
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly paramsData = new Float32Array(20);
  private readonly interactionData = new Float32Array(maxInteractions * interactionStride);
  private readonly particleData = new Float32Array(maxParticles * particleStride);
  private readonly particles: WaterParticle[] = [];
  private readonly spriteSamples = new Map<string, SpriteSample>();
  private readonly spriteWakeTimes = new Map<string, number>();
  private lastTimeMs: number | null = null;
  private randomState = 0x9e37_79b9;
  private particleCursor = 0;

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
      size: this.particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: "Combat field water shader",
      code: waterShaderSource,
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
  }

  render(pass: GPURenderPassEncoder, width: number, height: number, snapshot: RenderSnapshot, timeMs: number): void {
    const visuals = snapshot.environment;

    if (visuals.waterCoverage <= 0) {
      return;
    }

    const deltaMs = this.lastTimeMs === null ? 16.6667 : Math.min(50, Math.max(0, timeMs - this.lastTimeMs));
    this.lastTimeMs = timeMs;
    const interactions = this.collectInteractions(snapshot, timeMs);
    this.spawnInteractionParticles(interactions, visuals, deltaMs);
    this.updateParticles(deltaMs, visuals);
    this.simulation.addRainRipples(deltaMs, visuals.rainRate);
    this.applyInteractionImpulses(interactions);
    this.simulation.update(deltaMs);
    this.device.queue.writeBuffer(this.springBuffer, 0, this.simulation.readHeights());
    this.writeInteractionData(interactions);
    this.writeParticleData();
    this.writeParams(width, height, visuals, timeMs, interactions);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }

  dispose(): void {
    this.paramsBuffer.destroy();
    this.springBuffer.destroy();
    this.interactionBuffer.destroy();
    this.particleBuffer.destroy();
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
        break;
      }

      const bottom = sprite.position.y + sprite.size.y * 0.46;
      const depth = clamp((bottom - waterStart + 0.025) / 0.16, 0, 1);
      const previous = this.spriteSamples.get(sprite.id);
      this.spriteSamples.set(sprite.id, { x: sprite.position.x, y: sprite.position.y, timeMs });

      if (depth <= 0) {
        continue;
      }

      const cooldownMs = sprite.kind === "item" ? 260 : 120;
      const lastWakeMs = this.spriteWakeTimes.get(sprite.id) ?? -Infinity;

      if (timeMs - lastWakeMs < cooldownMs) {
        continue;
      }

      const deltaSeconds = previous ? Math.max(0.016, (timeMs - previous.timeMs) / 1_000) : 0.016;
      const speed = previous
        ? Math.hypot(sprite.position.x - previous.x, sprite.position.y - previous.y) / deltaSeconds
        : 0;
      const base = sprite.kind === "item" ? 0.16 : 0.36;
      const strength = clamp(base + speed * 0.055 + depth * 0.26, 0.12, 1.15);

      if (previous && speed < 0.015 && depth < 0.3) {
        continue;
      }

      interactions.push({
        x: clamp(sprite.position.x, 0, 1),
        y: clamp(Math.max(waterStart, bottom), 0, 1),
        radius: clamp(sprite.size.x * 0.7 + depth * 0.02, 0.018, 0.09),
        strength,
        velocity: -strength * 1.35,
        kind: "wake",
      });
      this.spriteWakeTimes.set(sprite.id, timeMs);
    }

    for (const spriteId of this.spriteSamples.keys()) {
      if (!activeIds.has(spriteId)) {
        this.spriteSamples.delete(spriteId);
        this.spriteWakeTimes.delete(spriteId);
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
      const foamCount = Math.min(5, Math.max(1, Math.round(strength * frameScale * 2.4)));
      const dropletCount = interaction.kind === "wake" ? 1 : Math.min(4, Math.round(strength * frameScale * 1.7));

      for (let index = 0; index < foamCount; index += 1) {
        this.spawnParticle(createFoamParticle(interaction, visuals.waterStart, visuals.windX, this.nextRandom()));
      }

      for (let index = 0; index < dropletCount; index += 1) {
        this.spawnParticle(createDropletParticle(interaction, visuals.waterStart, visuals.windX, this.nextRandom()));
      }
    }
  }

  private spawnParticle(particle: WaterParticle): void {
    if (this.particles.length < maxParticles) {
      this.particles.push(particle);
      return;
    }

    this.particles[this.particleCursor] = particle;
    this.particleCursor = (this.particleCursor + 1) % maxParticles;
  }

  private updateParticles(deltaMs: number, visuals: BattleEnvironmentVisuals): void {
    const deltaSeconds = Math.max(0, deltaMs) / 1_000;
    const waterStart = visuals.waterStart;
    const wind = visuals.windX;

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index]!;
      particle.ageMs += deltaMs;

      if (particle.ageMs >= particle.lifeMs) {
        this.particles.splice(index, 1);
        continue;
      }

      if (particle.kind === "droplet") {
        particle.vy += 0.78 * deltaSeconds;
        particle.vx += wind * 0.028 * deltaSeconds;
      } else {
        particle.vy += (waterStart - particle.y) * 0.16 * deltaSeconds;
        particle.vx += wind * 0.018 * deltaSeconds;
      }

      particle.x = wrap01(particle.x + particle.vx * deltaSeconds);
      particle.y = clamp(particle.y + particle.vy * deltaSeconds, 0, 1.08);
    }
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

  private writeParticleData(): void {
    this.particleData.fill(0);
    this.particles.slice(0, maxParticles).forEach((particle, index) => {
      const offset = index * particleStride;
      const ageRatio = clamp(particle.ageMs / Math.max(1, particle.lifeMs), 0, 1);
      this.particleData[offset] = particle.x;
      this.particleData[offset + 1] = particle.y;
      this.particleData[offset + 2] = particle.radius;
      this.particleData[offset + 3] = encodeParticleKind(particle.kind);
      this.particleData[offset + 4] = ageRatio;
      this.particleData[offset + 5] = particle.seed;
      this.particleData[offset + 6] = particle.strength;
      this.particleData[offset + 7] = particle.vy;
    });
    this.device.queue.writeBuffer(this.particleBuffer, 0, this.particleData);
  }

  private writeParams(
    width: number,
    height: number,
    visuals: BattleEnvironmentVisuals,
    timeMs: number,
    interactions: readonly WaterInteraction[],
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
    this.paramsData[15] = clamp(
      interactions.reduce((sum, interaction) => sum + Math.abs(interaction.strength), 0) / 5,
      0,
      1,
    );
    this.paramsData[16] = Math.min(maxParticles, this.particles.length);
    this.paramsData[17] = this.paramsData[15];
    this.paramsData[18] = 0;
    this.paramsData[19] = 0;
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
  const offset = (seed - 0.5) * interaction.radius * 1.8;
  const strength = clamp(Math.abs(interaction.strength), 0.08, 1.5);

  return {
    x: wrap01(interaction.x + offset),
    y: clamp(waterStart + (seed - 0.52) * 0.012, 0, 1),
    vx: (seed - 0.5) * 0.055 + windX * 0.018,
    vy: 0.005 + seed * 0.012,
    ageMs: 0,
    lifeMs: 520 + seed * 760,
    radius: clamp(0.004 + interaction.radius * 0.12 + strength * 0.0025, 0.004, 0.018),
    strength,
    kind: "foam",
    seed,
  };
}

function createDropletParticle(
  interaction: WaterInteraction,
  waterStart: number,
  windX: number,
  seed: number,
): WaterParticle {
  const side = seed < 0.5 ? -1 : 1;
  const strength = clamp(Math.abs(interaction.strength), 0.08, 1.6);
  const lift = 0.18 + strength * 0.16 + seed * 0.08;

  return {
    x: wrap01(interaction.x + side * interaction.radius * (0.15 + seed * 0.55)),
    y: clamp(Math.min(interaction.y, waterStart) - 0.004 - seed * 0.012, 0, 1),
    vx: side * (0.045 + seed * 0.09) + windX * 0.026,
    vy: -lift,
    ageMs: 0,
    lifeMs: 360 + seed * 420,
    radius: clamp(0.0028 + strength * 0.0035 + interaction.radius * 0.035, 0.0025, 0.012),
    strength,
    kind: "droplet",
    seed,
  };
}

function encodeParticleKind(kind: WaterParticleKind): number {
  switch (kind) {
    case "foam":
      return 0;
    case "droplet":
      return 1;
  }
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
