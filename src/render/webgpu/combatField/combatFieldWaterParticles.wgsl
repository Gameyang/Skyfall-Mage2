struct WaterParams {
  canvasAndTime: vec4f,
  surface: vec4f,
  environment: vec4f,
  effects: vec4f,
  particles: vec4f,
};

struct WaterParticleGpu {
  data0: vec4f,
  data1: vec4f,
  data2: vec4f,
};

struct WaterParticleEmitterGpu {
  data0: vec4f,
  data1: vec4f,
};

@group(0) @binding(0) var<uniform> params: WaterParams;
@group(0) @binding(1) var<storage, read_write> particles: array<WaterParticleGpu>;
@group(0) @binding(2) var<storage, read> emitters: array<WaterParticleEmitterGpu>;

@compute @workgroup_size(64)
fn updateParticles(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;

  if (index >= 1024u) {
    return;
  }

  var particle = particles[index];
  var radius = particle.data0.z;
  var kind = particle.data0.w;

  if (radius <= 0.0 || kind < -0.5) {
    return;
  }

  let deltaSeconds = clamp(params.effects.w, 0.0, 0.05);
  let waterStart = clamp(params.surface.x, 0.0, 0.98);
  let wind = params.environment.x;
  var position = particle.data0.xy;
  var velocity = particle.data1.xy;
  var ageMs = particle.data1.z + deltaSeconds * 1000.0;
  var lifeMs = max(1.0, particle.data1.w);
  let seed = particle.data2.x;
  let strength = particle.data2.y;

  if (ageMs >= lifeMs) {
    particles[index] = deadParticle();
    return;
  }

  if (kind < 0.5) {
    let drift = sin(ageMs * 0.009 + seed * 53.0) * 0.014;
    velocity.x = velocity.x + (drift + wind * 0.012) * deltaSeconds;
    velocity.y = velocity.y + (waterStart - position.y) * 0.10 * deltaSeconds;
  } else if (kind < 1.5) {
    velocity.y = velocity.y + 0.92 * deltaSeconds;
    velocity.x = velocity.x + wind * 0.028 * deltaSeconds;
  } else {
    let wobble = sin(ageMs * 0.012 + seed * 37.0);
    velocity.x = velocity.x + (wobble * 0.026 + wind * 0.012) * deltaSeconds;
    velocity.y = max(-0.13, velocity.y - (0.072 + strength * 0.028) * deltaSeconds);
  }

  position.x = wrap01(position.x + velocity.x * deltaSeconds);
  position.y = clamp(position.y + velocity.y * deltaSeconds, 0.0, 1.08);

  if (kind >= 1.5 && position.y <= waterStart + 0.004) {
    kind = 0.0;
    position.y = waterStart + (seed - 0.5) * 0.006;
    velocity.y = 0.0;
    lifeMs = max(lifeMs, ageMs + 620.0 + seed * 380.0);
  }

  if (kind >= 0.5 && kind < 1.5 && velocity.y > 0.0 && position.y >= waterStart + 0.003 && ageMs > 80.0) {
    particles[index] = deadParticle();
    return;
  }

  particle.data0 = vec4f(position, radius, kind);
  particle.data1 = vec4f(velocity, ageMs, lifeMs);
  particles[index] = particle;
}

@compute @workgroup_size(64)
fn spawnParticles(@builtin(global_invocation_id) globalId: vec3u) {
  let spawnIndex = globalId.x;
  let spawnCount = min(u32(params.particles.w), 1024u);

  if (spawnIndex >= spawnCount) {
    return;
  }

  var localIndex = spawnIndex;
  let spawnStart = u32(params.particles.z) % 1024u;
  let targetIndex = (spawnStart + spawnIndex) % 1024u;

  for (var emitterIndex = 0u; emitterIndex < 48u; emitterIndex = emitterIndex + 1u) {
    let emitter = emitters[emitterIndex];
    let emitterCount = u32(clamp(round(emitter.data1.y), 0.0, 1024.0));

    if (emitterCount == 0u) {
      continue;
    }

    if (localIndex < emitterCount) {
      particles[targetIndex] = createParticleFromEmitter(emitter, localIndex);
      return;
    }

    localIndex = localIndex - emitterCount;
  }

  particles[targetIndex] = deadParticle();
}

fn createParticleFromEmitter(emitter: WaterParticleEmitterGpu, localIndex: u32) -> WaterParticleGpu {
  let origin = emitter.data0.xy;
  let emitterRadius = max(0.001, emitter.data0.z);
  let emitterStrength = emitter.data0.w;
  let kind = emitter.data1.x;
  let seedBase = emitter.data1.z + f32(localIndex) * 17.173;
  let wind = emitter.data1.w;
  let waterStart = clamp(params.surface.x, 0.0, 0.98);
  let r0 = random1(seedBase + 1.0);
  let r1 = random1(seedBase + 7.0);
  let r2 = random1(seedBase + 13.0);
  let r3 = random1(seedBase + 29.0);
  let r4 = random1(seedBase + 47.0);
  let r5 = random1(seedBase + 71.0);
  let seed = fract(seedBase * 0.61803398875);

  if (kind < 0.5) {
    let strength = clamp(emitterStrength, 0.08, 1.5);
    let offset = (r0 - 0.5) * emitterRadius * 2.0;
    let position = vec2f(wrap01(origin.x + offset), clamp(waterStart + (r1 - 0.52) * 0.01, 0.0, 1.0));
    let velocity = vec2f((r2 - 0.5) * 0.018 + wind * 0.012, 0.0);
    let radius = clamp(0.004 + emitterRadius * 0.12 + strength * 0.0025 * (0.75 + r3 * 0.5), 0.004, 0.018);
    let lifeMs = 720.0 + r4 * 820.0;
    return WaterParticleGpu(
      vec4f(position, radius, 0.0),
      vec4f(velocity, 0.0, lifeMs),
      vec4f(seed, strength, 0.0, 0.0)
    );
  }

  if (kind < 1.5) {
    let strength = clamp(emitterStrength, 0.08, 1.6);
    let side = select(1.0, -1.0, r0 < 0.5);
    let position = vec2f(
      wrap01(origin.x + side * emitterRadius * (0.15 + r1 * 0.55)),
      clamp(min(origin.y, waterStart) - 0.004 - r2 * 0.012, 0.0, 1.0)
    );
    let velocity = vec2f(
      side * (0.045 + r3 * 0.09) + wind * 0.026,
      -(0.16 + strength * 0.14 + r4 * 0.07)
    );
    let radius = clamp(0.0016 + strength * 0.0018 + emitterRadius * 0.018 * (0.72 + r5 * 0.56), 0.0016, 0.0065);
    let lifeMs = 280.0 + r5 * 320.0;
    return WaterParticleGpu(
      vec4f(position, radius, 1.0),
      vec4f(velocity, 0.0, lifeMs),
      vec4f(seed, strength, 0.0, 0.0)
    );
  }

  let strength = clamp(emitterStrength, 0.06, 1.2);
  let lateral = r0 - 0.5;
  let position = vec2f(
    wrap01(origin.x + lateral * emitterRadius * 1.35),
    clamp(max(waterStart + 0.012, origin.y + (r1 - 0.45) * emitterRadius * 0.9), 0.0, 1.0)
  );
  let velocity = vec2f(
    lateral * 0.026 + wind * 0.006,
    -(0.018 + r2 * 0.035 + strength * 0.018)
  );
  let radius = clamp(0.0018 + emitterRadius * 0.035 * (0.72 + r3 * 0.56) + strength * 0.0018, 0.0018, 0.007);
  let lifeMs = 520.0 + r4 * 560.0;
  return WaterParticleGpu(
    vec4f(position, radius, 2.0),
    vec4f(velocity, 0.0, lifeMs),
    vec4f(seed, strength, 0.0, 0.0)
  );
}

fn deadParticle() -> WaterParticleGpu {
  return WaterParticleGpu(
    vec4f(0.0, 0.0, 0.0, -1.0),
    vec4f(0.0),
    vec4f(0.0)
  );
}

fn wrap01(value: f32) -> f32 {
  return fract(value);
}

fn random1(value: f32) -> f32 {
  return fract(sin(value * 12.9898) * 43758.5453);
}
