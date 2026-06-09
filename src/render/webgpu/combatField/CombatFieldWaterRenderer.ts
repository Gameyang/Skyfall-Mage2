// Responsibility: Composite the lower battlefield water surface in the WebGPU combat pass.
// Owner: render/webgpu/combatField

import type { BattleEnvironmentVisuals, RenderSnapshot, RenderableSprite } from "../../snapshots/RenderSnapshot";
import type { CombatMaterialName, MaterialEmitter } from "../../../features/combatField/CombatFieldTypes";
import waterShaderSource from "./combatFieldWater.wgsl?raw";
import { WaterSurfaceSimulation, type WaterImpulseKind } from "./WaterSurfaceSimulation";

const springColumns = 96;
const maxInteractions = 24;
const interactionStride = 4;

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

export class CombatFieldWaterRenderer {
  private readonly simulation = new WaterSurfaceSimulation({ columns: springColumns });
  private readonly paramsBuffer: GPUBuffer;
  private readonly springBuffer: GPUBuffer;
  private readonly interactionBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly pipeline: GPURenderPipeline;
  private readonly paramsData = new Float32Array(16);
  private readonly interactionData = new Float32Array(maxInteractions * interactionStride);
  private readonly spriteSamples = new Map<string, SpriteSample>();
  private readonly spriteWakeTimes = new Map<string, number>();
  private lastTimeMs: number | null = null;

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
    const interactions = this.collectInteractions(snapshot, deltaMs, timeMs);
    this.simulation.addRainRipples(deltaMs, visuals.rainRate);
    this.applyInteractionImpulses(interactions);
    this.simulation.update(deltaMs);
    this.device.queue.writeBuffer(this.springBuffer, 0, this.simulation.readHeights());
    this.writeInteractionData(interactions);
    this.writeParams(width, height, visuals, timeMs, interactions);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }

  dispose(): void {
    this.paramsBuffer.destroy();
    this.springBuffer.destroy();
    this.interactionBuffer.destroy();
  }

  private collectInteractions(snapshot: RenderSnapshot, deltaMs: number, timeMs: number): readonly WaterInteraction[] {
    const interactions: WaterInteraction[] = [];
    const waterStart = snapshot.environment.waterStart;

    for (const emitter of snapshot.materialEmitters) {
      const interaction = createEmitterInteraction(emitter, waterStart, deltaMs);

      if (interaction) {
        interactions.push(interaction);
      }

      if (interactions.length >= maxInteractions) {
        return interactions;
      }
    }

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
      const base = sprite.kind === "item" ? 0.16 : sprite.kind === "player" ? 0.36 : 0.28;
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
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);
  }
}

function createEmitterInteraction(
  emitter: MaterialEmitter,
  waterStart: number,
  deltaMs: number,
): WaterInteraction | null {
  const materialEffect = resolveMaterialWaterEffect(emitter.material);

  if (!materialEffect) {
    return null;
  }

  const reach = emitter.radius + 0.07;
  const distanceToSurface = emitter.y - waterStart;

  if (distanceToSurface < -reach || distanceToSurface > 0.42) {
    return null;
  }

  const proximity =
    distanceToSurface >= 0
      ? clamp(1 - distanceToSurface / 0.42, 0.24, 1)
      : clamp(1 + distanceToSurface / reach, 0, 1);

  if (proximity <= 0) {
    return null;
  }

  const frameScale = clamp(deltaMs / 16.6667, 0.35, 1.2);
  const strength = clamp(emitter.strength * materialEffect.strengthScale * proximity, 0.05, 1.8);
  const interactionY = distanceToSurface < 0 ? waterStart : emitter.y;

  return {
    x: clamp(emitter.x, 0, 1),
    y: clamp(interactionY, waterStart, 1),
    radius: clamp(emitter.radius * materialEffect.radiusScale, 0.018, 0.18),
    strength: materialEffect.heat ? -strength : strength,
    velocity: materialEffect.velocity * strength * frameScale,
    kind: materialEffect.kind,
  };
}

function resolveMaterialWaterEffect(material: CombatMaterialName):
  | {
      readonly kind: WaterImpulseKind;
      readonly velocity: number;
      readonly strengthScale: number;
      readonly radiusScale: number;
      readonly heat?: boolean;
    }
  | null {
  switch (material) {
    case "water":
    case "magicLiquid":
      return { kind: "drop", velocity: -0.82, strengthScale: 0.58, radiusScale: 1.45 };
    case "force":
      return { kind: "force", velocity: 1.05, strengthScale: 0.72, radiusScale: 1.35 };
    case "magicEnergy":
      return { kind: "force", velocity: 0.76, strengthScale: 0.62, radiusScale: 1.2 };
    case "fire":
    case "spark":
    case "lava":
      return { kind: "heat", velocity: 0.55, strengthScale: 0.5, radiusScale: 1.15, heat: true };
    default:
      return null;
  }
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
