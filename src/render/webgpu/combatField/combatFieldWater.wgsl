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
@group(0) @binding(1) var<storage, read> springs: array<f32>;
@group(0) @binding(2) var<storage, read> interactions: array<vec4f>;
@group(0) @binding(3) var<storage, read> particles: array<WaterParticleGpu>;

struct VertexOut {
  @builtin(position) position: vec4f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  var out: VertexOut;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  return out;
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let canvasSize = max(params.canvasAndTime.xy, vec2f(1.0, 1.0));
  let uv = clamp(position.xy / canvasSize, vec2f(0.0), vec2f(0.999));
  let time = params.canvasAndTime.z;
  let wavePx = waterWavePx(uv.x, time, canvasSize);
  let waterStart = clamp(params.surface.x, 0.0, 0.98);
  let surfaceY = clamp(waterStart - wavePx / canvasSize.y, 0.0, 1.0);
  let particle = particleLayer(uv, canvasSize, surfaceY);

  if (uv.y < surfaceY) {
    if (particle.a <= 0.01) {
      discard;
    }

    return particle;
  }

  let depth = clamp((uv.y - surfaceY) / max(0.001, 1.0 - surfaceY), 0.0, 1.0);
  let edge = 1.0 - smoothstep(0.0, 0.05, depth);
  let rain = clamp(params.environment.y * 2.5, 0.0, 1.0);
  let heat = clamp(params.environment.z / 1.5, 0.0, 1.0);
  let interaction = interactionSummary(uv, canvasSize, surfaceY);
  let disturbance = interaction.x;
  let heatGlow = interaction.y;
  let localFoam = interaction.z;
  let ringRipple = interaction.w;
  let slope = waterSlope(uv.x, time, canvasSize);
  let normalLight = clamp(0.54 + slope * 0.026, 0.0, 1.0);
  let surfaceNormalLight = normalLight * smoothstep(0.24, 0.0, depth);

  var shallowColor = mix(vec3f(0.12, 0.36, 0.46), vec3f(0.10, 0.43, 0.50), rain * 0.45);
  shallowColor = mix(shallowColor, vec3f(0.18, 0.24, 0.35), heat * 0.16);
  shallowColor = mix(shallowColor, vec3f(0.24, 0.48, 0.58), disturbance * 0.18);
  shallowColor = mix(shallowColor, vec3f(0.56, 0.27, 0.12), heatGlow * 0.28);
  let midColor = mix(vec3f(0.055, 0.18, 0.28), vec3f(0.07, 0.08, 0.17), heat * 0.26 + heatGlow * 0.15);
  let deepColor = mix(vec3f(0.02, 0.055, 0.11), vec3f(0.06, 0.035, 0.095), heat * 0.26 + heatGlow * 0.16);
  var color = mix(shallowColor, midColor, smoothstep(0.06, 0.72, depth));
  color = mix(color, deepColor, smoothstep(0.38, 1.0, depth));
  color *= 0.88 + surfaceNormalLight * 0.06;

  let waveIntensity = abs(wavePx);
  let surfaceSkin = smoothstep(0.026, 0.0, depth);
  let meniscus = smoothstep(0.014, 0.0, depth) * (0.62 + 0.38 * sin(uv.x * 28.0 + time * 0.85 + wavePx * 0.05));
  let slopeFoam = smoothstep(16.0, 62.0, abs(slope)) * edge;
  let foam = max(smoothstep(3.8, 11.0, waveIntensity) * edge, max(slopeFoam, localFoam * edge));
  color = mix(color, vec3f(0.84, 0.95, 1.0), foam * 0.5);
  color += vec3f(0.34, 0.68, 0.82) * surfaceSkin * (0.2 + surfaceNormalLight * 0.16);
  color += vec3f(0.75, 0.95, 1.0) * meniscus * 0.18;

  let highlight = edge * (sin(uv.x * 24.0 + time * 0.7 + wavePx * 0.08) * 0.5 + 0.5);
  let horizonReflection = smoothstep(0.18, 0.0, depth) * (0.55 + surfaceNormalLight * 0.45);
  color += vec3f(0.48, 0.62, 0.76) * highlight * (0.18 + rain * 0.06);
  color += vec3f(0.30, 0.34, 0.43) * horizonReflection * 0.13;
  color += vec3f(0.46, 0.82, 0.96) * ringRipple * smoothstep(0.82, 0.0, depth) * 0.26;
  color += vec3f(0.72, 0.26, 0.10) * heatGlow * smoothstep(0.42, 0.0, depth);
  color = mix(color, particle.rgb, particle.a);

  let frost = clamp(params.effects.x, 0.0, 1.0);
  if (frost > 0.001) {
    let frostBand = smoothstep(0.38, 0.0, depth) * frost;
    color = mix(color, vec3f(0.70, 0.86, 1.0), frostBand * 0.52);
  }

  let sideVolumeAlpha = params.surface.y * mix(0.50, 0.82, smoothstep(0.0, 0.9, depth));
  let surfaceAlpha = surfaceSkin * 0.16 + disturbance * edge * 0.08 + ringRipple * 0.04;
  let alpha = clamp(sideVolumeAlpha + surfaceAlpha + particle.a * 0.5, 0.0, 0.88);
  return vec4f(max(color, vec3f(0.0)), alpha);
}

fn waterWavePx(x: f32, time: f32, canvasSize: vec2f) -> f32 {
  let physicsDisplacement = springWave(x);
  let gerstnerHeight = gerstnerWaves(vec2f(x * canvasSize.x, 0.0), time) * 0.015;
  let ice = clamp(params.effects.x, 0.0, 1.0);
  let waveScale = 1.0 - ice * 0.92;
  return (physicsDisplacement * 3.0 + gerstnerHeight * 8.0) * waveScale;
}

fn waterSlope(x: f32, time: f32, canvasSize: vec2f) -> f32 {
  let dx = max(1.0 / canvasSize.x, 0.0015);
  let left = waterWavePx(clamp(x - dx, 0.0, 0.999), time, canvasSize);
  let right = waterWavePx(clamp(x + dx, 0.0, 0.999), time, canvasSize);
  return (right - left) / (dx * 2.0);
}

fn gerstnerWave(pos: vec2f, direction: vec2f, wavelength: f32, steepness: f32, time: f32) -> f32 {
  let k = 2.0 * 3.14159 / wavelength;
  let c = sqrt(9.8 / k);
  let d = normalize(direction);
  let f = k * (dot(d, pos) - c * time);
  let a = steepness / k;
  return a * cos(f);
}

fn gerstnerWaves(pos: vec2f, time: f32) -> f32 {
  var height = 0.0;
  height += gerstnerWave(pos, vec2f(1.0, 0.0), 120.0, 1.5, time * 0.4);
  height += gerstnerWave(pos, vec2f(-0.8, 0.0), 60.0, 1.0, time * 0.6);
  height += gerstnerWave(pos, vec2f(0.6, 0.0), 30.0, 0.6, time * 0.9);
  height += gerstnerWave(pos, vec2f(-0.4, 0.0), 15.0, 0.3, time * 1.3);
  return height;
}

fn particleLayer(uv: vec2f, canvasSize: vec2f, surfaceY: f32) -> vec4f {
  let count = min(u32(params.particles.x), 1024u);
  let aspect = canvasSize.x / max(1.0, canvasSize.y);
  var color = vec3f(0.0);
  var alpha = 0.0;

  for (var i = 0u; i < 1024u; i = i + 1u) {
    if (i >= count) {
      break;
    }

    let particle = particles[i];
    if (particle.data0.z <= 0.0 || particle.data0.w < -0.5) {
      continue;
    }

    let particleColor = shadeParticle(uv, aspect, surfaceY, particle);
    color = mix(color, particleColor.rgb, particleColor.a * (1.0 - alpha));
    alpha = clamp(alpha + particleColor.a * (1.0 - alpha), 0.0, 1.0);
  }

  return vec4f(color, alpha);
}

fn shadeParticle(uv: vec2f, aspect: f32, surfaceY: f32, particle: WaterParticleGpu) -> vec4f {
  let center = particle.data0.xy;
  let radius = max(0.001, particle.data0.z);
  let kind = particle.data0.w;
  let age = clamp(particle.data1.z / max(1.0, particle.data1.w), 0.0, 1.0);
  let seed = particle.data2.x;
  let strength = clamp(particle.data2.y, 0.0, 1.8);
  let velocityY = particle.data1.y;
  let delta = vec2f((uv.x - center.x) * aspect, uv.y - center.y);
  let distanceToParticle = length(delta);
  let lifeFade = pow(1.0 - age, 1.35);

  if (kind < 0.5) {
    let core = 1.0 - smoothstep(radius * 0.34, radius, distanceToParticle);
    let ring = (1.0 - smoothstep(radius, radius * 1.65, distanceToParticle)) * smoothstep(radius * 0.22, radius, distanceToParticle);
    let surfaceFade = 1.0 - smoothstep(0.0, 0.07, abs(center.y - surfaceY));
    let brokenNoise = noise(vec2f(uv.x * 120.0 + seed * 9.0 + params.canvasAndTime.z * 0.16, uv.y * 86.0 - params.canvasAndTime.z * 0.11));
    let broken = 0.42 + 0.58 * brokenNoise;
    let alpha = (core * 0.62 + ring * 0.46) * lifeFade * surfaceFade * broken * clamp(0.45 + strength * 0.38, 0.0, 1.0);
    return vec4f(vec3f(0.84, 0.95, 1.0), clamp(alpha, 0.0, 0.82));
  }

  if (kind < 1.5) {
    let core = 1.0 - smoothstep(radius * 0.2, radius, distanceToParticle);
    let trailOffset = vec2f(0.0, clamp(velocityY * 0.035, -0.035, 0.035));
    let trailDistance = length(vec2f(delta.x * 1.8, delta.y - trailOffset.y));
    let trail = (1.0 - smoothstep(radius * 0.8, radius * 2.8, trailDistance)) * smoothstep(radius * 0.2, radius * 1.1, abs(delta.y));
    let alpha = (core * 0.9 + trail * 0.22) * lifeFade * clamp(0.55 + strength * 0.35, 0.0, 1.0);
    let tint = mix(vec3f(0.62, 0.86, 1.0), vec3f(0.94, 0.99, 1.0), core);
    return vec4f(tint, clamp(alpha, 0.0, 0.9));
  }

  let waterFade = smoothstep(surfaceY + 0.002, surfaceY + 0.035, center.y);
  let noiseBreak = noise(vec2f(uv.x * 155.0 + seed * 17.0, uv.y * 118.0 - params.canvasAndTime.z * 0.28));
  let core = 1.0 - smoothstep(radius * 0.18, radius * 0.78, distanceToParticle);
  let ring = (1.0 - smoothstep(radius * 0.66, radius * 1.42, distanceToParticle)) * smoothstep(radius * 0.22, radius * 0.76, distanceToParticle);
  let plume = (1.0 - smoothstep(radius * 0.9, radius * 2.9, length(vec2f(delta.x * 1.45, delta.y + age * radius * 1.8)))) * 0.28;
  let alpha = (core * 0.18 + ring * 0.58 + plume) * lifeFade * waterFade * (0.52 + noiseBreak * 0.48) * clamp(0.38 + strength * 0.34, 0.0, 1.0);
  let tint = mix(vec3f(0.58, 0.86, 0.95), vec3f(0.90, 0.98, 1.0), clamp(core + ring * 0.35, 0.0, 1.0));
  return vec4f(tint, clamp(alpha, 0.0, 0.72));
}

fn interactionSummary(uv: vec2f, canvasSize: vec2f, surfaceY: f32) -> vec4f {
  let count = min(u32(params.effects.z), 24u);
  var disturbance = 0.0;
  var heatGlow = 0.0;
  var foam = 0.0;
  var ring = 0.0;
  let aspect = canvasSize.x / max(1.0, canvasSize.y);

  for (var i = 0u; i < 24u; i = i + 1u) {
    if (i >= count) {
      break;
    }

    let influence = interactions[i];
    let radius = max(0.001, influence.z);
    let delta = vec2f((uv.x - influence.x) * aspect, uv.y - influence.y);
    let distanceToInfluence = length(delta);
    let mask = smoothstep(radius, 0.0, distanceToInfluence) * abs(influence.w);
    let ringDistance = abs(distanceToInfluence - radius * 0.55);
    let ringMask = (1.0 - smoothstep(radius * 0.09, radius * 0.22, ringDistance)) * abs(influence.w);
    let surfaceDistance = abs(influence.y - surfaceY);
    let surfaceContact = 1.0 - smoothstep(0.0, 0.08, surfaceDistance);

    if (influence.w < 0.0) {
      heatGlow = max(heatGlow, mask);
    } else {
      disturbance = max(disturbance, mask);
    }

    foam = max(foam, smoothstep(radius * 0.72, 0.0, distanceToInfluence) * abs(influence.w) * surfaceContact);
    ring = max(ring, ringMask);
  }

  return vec4f(
    clamp(disturbance, 0.0, 1.0),
    clamp(heatGlow, 0.0, 1.0),
    clamp(foam, 0.0, 1.0),
    clamp(ring, 0.0, 1.0)
  );
}

fn springWave(x: f32) -> f32 {
  let springCount = max(1u, u32(params.canvasAndTime.w));
  let maxIndex = springCount - 1u;
  let scaled = clamp(x, 0.0, 0.999) * f32(maxIndex);
  let left = min(u32(floor(scaled)), maxIndex);
  let right = min(left + 1u, maxIndex);
  return mix(springs[left], springs[right], fract(scaled));
}

fn random(st: vec2f) -> f32 {
  return fract(sin(dot(st, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn noise(st: vec2f) -> f32 {
  let i = floor(st);
  let f = fract(st);
  let a = random(i);
  let b = random(i + vec2f(1.0, 0.0));
  let c = random(i + vec2f(0.0, 1.0));
  let d = random(i + vec2f(1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
