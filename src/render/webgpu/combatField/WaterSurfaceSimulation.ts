// Responsibility: Simulate a lightweight spring surface for visual water ripples.
// Owner: render/webgpu/combatField

interface WaterSpring {
  height: number;
  velocity: number;
}

export interface WaterSurfaceSimulationOptions {
  readonly columns?: number;
  readonly damping?: number;
  readonly tension?: number;
  readonly spread?: number;
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
  private rainAccumulator = 0;
  private randomState = 0x7f4a7c15;

  constructor(options: WaterSurfaceSimulationOptions = {}) {
    this.columns = options.columns ?? 96;
    this.damping = options.damping ?? 0.05;
    this.tension = options.tension ?? 0.025;
    this.spread = options.spread ?? 0.15;
    this.springs = Array.from({ length: this.columns }, () => ({ height: 0, velocity: 0 }));
    this.heightData = new Float32Array(new ArrayBuffer(this.columns * Float32Array.BYTES_PER_ELEMENT));
    this.leftDeltas = new Float32Array(new ArrayBuffer(this.columns * Float32Array.BYTES_PER_ELEMENT));
    this.rightDeltas = new Float32Array(new ArrayBuffer(this.columns * Float32Array.BYTES_PER_ELEMENT));
  }

  update(deltaMs: number): void {
    const steps = Math.max(1, Math.min(5, Math.round(Math.max(1, deltaMs) / 16.6667)));

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
      this.splash(this.nextRandom(), velocity);
    }
  }

  splash(normalizedX: number, velocity = 1): void {
    const index = Math.floor(clamp(normalizedX, 0, 0.999) * this.columns);
    const spring = this.springs[index];

    if (spring) {
      spring.velocity += velocity;
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
      spring.velocity += force;
      spring.height += spring.velocity;
    }

    this.leftDeltas.fill(0);
    this.rightDeltas.fill(0);

    for (let index = 0; index < this.springs.length; index += 1) {
      const spring = this.springs[index]!;

      if (index > 0) {
        this.leftDeltas[index] = this.spread * (spring.height - this.springs[index - 1]!.height);
        this.springs[index - 1]!.velocity += this.leftDeltas[index]!;
      }

      if (index < this.springs.length - 1) {
        this.rightDeltas[index] = this.spread * (spring.height - this.springs[index + 1]!.height);
        this.springs[index + 1]!.velocity += this.rightDeltas[index]!;
      }
    }

    for (let index = 0; index < this.springs.length; index += 1) {
      if (index > 0) {
        this.springs[index - 1]!.height += this.leftDeltas[index]!;
      }

      if (index < this.springs.length - 1) {
        this.springs[index + 1]!.height += this.rightDeltas[index]!;
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
