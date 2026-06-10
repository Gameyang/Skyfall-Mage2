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

@group(0) @binding(0) var<uniform> params: WaterParams;
@group(0) @binding(1) var<storage, read_write> particles: array<WaterParticleGpu>;
@group(0) @binding(2) var<storage, read> spawns: array<WaterParticleGpu>;

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

  let spawnStart = u32(params.particles.z) % 1024u;
  let targetIndex = (spawnStart + spawnIndex) % 1024u;
  particles[targetIndex] = spawns[spawnIndex];
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
