struct ParticleParams {
  canvasAndTime: vec4f,
  reserved: vec4f,
};

struct WeaponParticle {
  data0: vec4f,
  data1: vec4f,
  data2: vec4f,
};

@group(0) @binding(0) var<uniform> params: ParticleParams;
@group(0) @binding(1) var<storage, read> particles: array<WeaponParticle>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) kind: f32,
  @location(2) seedAge: vec2f,
  @location(3) intensityOpacity: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );

  let particle = particles[instanceIndex];
  let center = particle.data0.xy;
  let radius = max(0.0005, particle.data0.z);
  let kind = particle.data0.w;
  let direction = normalizeOrUp(particle.data1.xy);
  let tangent = vec2f(-direction.y, direction.x);
  let stretch = max(0.5, particle.data2.z);
  let aspectScale = params.canvasAndTime.y / max(1.0, params.canvasAndTime.x);
  let corner = corners[vertexIndex];
  let localOffset = tangent * corner.x * radius + direction * corner.y * radius * stretch;
  let screenPosition = center + vec2f(localOffset.x * aspectScale, localOffset.y);

  var out: VertexOut;
  out.position = vec4f(screenPosition.x * 2.0 - 1.0, 1.0 - screenPosition.y * 2.0, 0.0, 1.0);
  out.local = corner;
  out.kind = kind;
  out.seedAge = particle.data1.zw;
  out.intensityOpacity = particle.data2.xy;
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let distanceToCenter = length(in.local);
  let seed = in.seedAge.x;
  let age = clamp(in.seedAge.y, 0.0, 1.0);
  let intensity = max(0.0, in.intensityOpacity.x);
  let opacity = clamp(in.intensityOpacity.y, 0.0, 1.0);
  let time = params.canvasAndTime.z;
  let flicker = 0.72 + 0.28 * sin(time * 22.0 + seed * 37.0);

  if (in.kind < 0.5) {
    return shadeFireballCore(in.local, distanceToCenter, age, intensity, opacity, flicker);
  }

  if (in.kind < 1.5) {
    return shadeFireballEmber(in.local, distanceToCenter, age, intensity, opacity, flicker);
  }

  if (in.kind < 2.5) {
    return shadeFireAreaFlame(in.local, distanceToCenter, age, intensity, opacity, flicker, seed);
  }

  return shadeBurnEmber(in.local, distanceToCenter, age, intensity, opacity, flicker);
}

fn shadeFireballCore(local: vec2f, distanceToCenter: f32, age: f32, intensity: f32, opacity: f32, flicker: f32) -> vec4f {
  let core = 1.0 - smoothstep(0.12, 0.52, distanceToCenter);
  let shell = (1.0 - smoothstep(0.42, 1.0, distanceToCenter)) * smoothstep(0.10, 0.72, distanceToCenter);
  let tail = (1.0 - smoothstep(0.0, 1.0, abs(local.x))) * (1.0 - smoothstep(-0.95, -0.1, local.y)) * 0.38;
  let alpha = clamp((core * 0.92 + shell * 0.54 + tail) * opacity * (1.0 - age * 0.18), 0.0, 1.0);
  let color = vec3f(1.18, 0.46, 0.08) * shell + vec3f(1.95, 1.05, 0.25) * core + vec3f(0.84, 0.10, 0.02) * tail;
  return vec4f(color * intensity * flicker, alpha);
}

fn shadeFireballEmber(local: vec2f, distanceToCenter: f32, age: f32, intensity: f32, opacity: f32, flicker: f32) -> vec4f {
  let stretched = length(vec2f(local.x * 1.45, local.y * 0.62));
  let core = 1.0 - smoothstep(0.0, 0.68, stretched);
  let smoke = (1.0 - smoothstep(0.25, 1.0, distanceToCenter)) * smoothstep(0.18, 1.0, age);
  let alpha = clamp((core * 0.68 + smoke * 0.16) * opacity * pow(1.0 - age * 0.55, 1.5), 0.0, 0.86);
  let heat = mix(vec3f(1.0, 0.22, 0.02), vec3f(1.0, 0.72, 0.12), core);
  let color = mix(vec3f(0.18, 0.10, 0.09), heat, core * 0.86) * intensity * flicker;
  return vec4f(color, alpha);
}

fn shadeFireAreaFlame(local: vec2f, distanceToCenter: f32, age: f32, intensity: f32, opacity: f32, flicker: f32, seed: f32) -> vec4f {
  let flameBody = length(vec2f(local.x * (1.15 + seed * 0.55), local.y * 0.58 + 0.28));
  let body = 1.0 - smoothstep(0.18, 0.98, flameBody);
  let lick = (1.0 - smoothstep(0.2, 1.0, abs(local.x + sin(seed * 17.0) * 0.18))) * (1.0 - smoothstep(-1.0, 0.72, local.y));
  let fade = 1.0 - smoothstep(0.72, 1.0, age);
  let alpha = clamp((body * 0.46 + lick * 0.26) * opacity * fade, 0.0, 0.74);
  let color = mix(vec3f(0.86, 0.12, 0.02), vec3f(1.45, 0.74, 0.12), body + lick * 0.35);
  return vec4f(color * intensity * flicker, alpha);
}

fn shadeBurnEmber(local: vec2f, distanceToCenter: f32, age: f32, intensity: f32, opacity: f32, flicker: f32) -> vec4f {
  let core = 1.0 - smoothstep(0.08, 0.68, distanceToCenter);
  let ash = (1.0 - smoothstep(0.32, 1.0, distanceToCenter)) * smoothstep(0.25, 1.0, age);
  let alpha = clamp((core * 0.72 + ash * 0.20) * opacity * pow(1.0 - age, 0.9), 0.0, 0.72);
  let color = mix(vec3f(0.22, 0.08, 0.05), vec3f(1.18, 0.42, 0.08), core) * intensity * flicker;
  return vec4f(color, alpha);
}

fn normalizeOrUp(value: vec2f) -> vec2f {
  let len = length(value);

  if (len < 0.0001) {
    return vec2f(0.0, -1.0);
  }

  return value / len;
}
