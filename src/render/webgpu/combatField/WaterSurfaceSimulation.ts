// Responsibility: Simulate a lightweight spring surface for visual water ripples.
// Owner: render/webgpu/combatField

interface WaterSpring {
  height: number;
  velocity: number;
}

export type WaterImpulseKind = "drop" | "force" | "heat" | "wake";

export interface WaterSurfaceImpulse {
  readonly x: number;
  readonly radius: number;
  readonly velocity: number;
  readonly kind: WaterImpulseKind;
}

export interface WaterSurfaceSimulationOptions {
  readonly columns?: number;
  readonly damping?: number;
  readonly tension?: number;
  readonly spread?: number;
  readonly speed?: number;
  readonly maxVelocity?: number;
  readonly maxHeight?: number;
}

export class WaterSurfaceSimulation {
  readonly columns: number;
  private readonly springs: WaterSpring[];
  private readonly heightData: Float32Array<ArrayBuffer>;
  private readonly leftDeltas: Float32Array<ArrayBuffer>;
  private readonly rightDeltas: Float32Array<ArrayBuffer>;
  private readonly damping: number;
  private readonly tension: number;
  private readonly spread: number;
  private readonly speed: number;
  private readonly maxVelocity: number;
  private readonly maxHeight: number;
  private rainAccumulator = 0;
  private randomState = 0x7f4a7c15;

  constructor(options: WaterSurfaceSimulationOptions = {}) {
    this.columns = options.columns ?? 96;
    this.damping = options.damping ?? 0.05;
    this.tension = options.tension ?? 0.025;
    this.spread = options.spread ?? 0.15;
    this.speed = options.speed ?? 1;
    this.maxVelocity = options.maxVelocity ?? 8;
    this.maxHeight = options.maxHeight ?? 16;
    this.springs = Array.from({ length: this.columns }, () => ({ height: 0, velocity: 0 }));
    this.heightData = new Float32Array(new ArrayBuffer(this.columns * Float32Array.BYTES_PER_ELEMENT));
    this.leftDeltas = new Float32Array(new ArrayBuffer(this.columns * Float32Array.BYTES_PER_ELEMENT));
    this.rightDeltas = new Float32Array(new ArrayBuffer(this.columns * Float32Array.BYTES_PER_ELEMENT));
  }

  update(deltaMs: number): void {
    const scaledDeltaMs = Math.max(1, deltaMs) * this.speed;
    const steps = Math.max(1, Math.min(8, Math.round(scaledDeltaMs / 16.6667)));

    for (let step = 0; step < steps; step += 1) {
      this.updateStep();
    }
  }

  addRainRipples(deltaMs: number, intensity: number): void {
    const clampedIntensity = clamp(intensity, 0, 1);

    if (clampedIntensity <= 0) {
      this.rainAccumulator = 0;
      return;
    }

    this.rainAccumulator += (Math.max(0, deltaMs) / 1_000) * (18 * clampedIntensity);

    while (this.rainAccumulator >= 1) {
      this.rainAccumulator -= 1;
      const velocity = -(0.8 + this.nextRandom() * 1.8) * (0.45 + clampedIntensity * 0.55);
      this.applyImpulse({
        x: this.nextRandom(),
        radius: 0.012 + clampedIntensity * 0.01,
        velocity,
        kind: "drop",
      });
    }
  }

  splash(normalizedX: number, velocity = 1): void {
    this.applyImpulse({
      x: normalizedX,
      radius: 1 / this.columns,
      velocity,
      kind: "drop",
    });
  }

  applyImpulse(impulse: WaterSurfaceImpulse): void {
    const radius = clamp(impulse.radius, 1 / this.columns, 0.45);
    const center = clamp(impulse.x, 0, 0.999) * (this.columns - 1);
    const radiusColumns = Math.max(1, Math.ceil(radius * this.columns));
    const start = Math.max(0, Math.floor(center - radiusColumns));
    const end = Math.min(this.columns - 1, Math.ceil(center + radiusColumns));
    const kindScale = impulseVelocityScale(impulse.kind);
    const velocity = clamp(impulse.velocity * kindScale, -this.maxVelocity, this.maxVelocity);

    for (let index = start; index <= end; index += 1) {
      const distance = Math.abs(index - center) / radiusColumns;
      const falloff = Math.pow(Math.max(0, 1 - distance * distance), 2);
      const spring = this.springs[index];

      if (spring && falloff > 0) {
        spring.velocity = clamp(spring.velocity + velocity * falloff, -this.maxVelocity, this.maxVelocity);
      }
    }
  }

  readHeights(): Float32Array<ArrayBuffer> {
    this.springs.forEach((spring, index) => {
      this.heightData[index] = spring.height;
    });
    return this.heightData;
  }

  reset(): void {
    for (const spring of this.springs) {
      spring.height = 0;
      spring.velocity = 0;
    }
    this.rainAccumulator = 0;
  }

  private updateStep(): void {
    for (const spring of this.springs) {
      const force = -this.tension * spring.height - this.damping * spring.velocity;
      spring.velocity = clamp(spring.velocity + force, -this.maxVelocity, this.maxVelocity);
      spring.height = clamp(spring.height + spring.velocity, -this.maxHeight, this.maxHeight);
    }

    this.leftDeltas.fill(0);
    this.rightDeltas.fill(0);

    for (let index = 0; index < this.springs.length; index += 1) {
      const spring = this.springs[index]!;

      if (index > 0) {
        this.leftDeltas[index] = this.spread * (spring.height - this.springs[index - 1]!.height);
        this.springs[index - 1]!.velocity = clamp(
          this.springs[index - 1]!.velocity + this.leftDeltas[index]!,
          -this.maxVelocity,
          this.maxVelocity,
        );
      }

      if (index < this.springs.length - 1) {
        this.rightDeltas[index] = this.spread * (spring.height - this.springs[index + 1]!.height);
        this.springs[index + 1]!.velocity = clamp(
          this.springs[index + 1]!.velocity + this.rightDeltas[index]!,
          -this.maxVelocity,
          this.maxVelocity,
        );
      }
    }

    for (let index = 0; index < this.springs.length; index += 1) {
      if (index > 0) {
        this.springs[index - 1]!.height = clamp(
          this.springs[index - 1]!.height + this.leftDeltas[index]!,
          -this.maxHeight,
          this.maxHeight,
        );
      }

      if (index < this.springs.length - 1) {
        this.springs[index + 1]!.height = clamp(
          this.springs[index + 1]!.height + this.rightDeltas[index]!,
          -this.maxHeight,
          this.maxHeight,
        );
      }
    }
  }

  private nextRandom(): number {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 0x1_0000_0000;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function impulseVelocityScale(kind: WaterImpulseKind): number {
  switch (kind) {
    case "force":
      return 1.35;
    case "heat":
      return 0.78;
    case "wake":
      return 1.05;
    case "drop":
      return 1;
  }
}
