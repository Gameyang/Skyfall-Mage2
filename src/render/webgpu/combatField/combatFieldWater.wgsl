struct WaterParams {
  canvasAndTime: vec4f,
  surface: vec4f,
  environment: vec4f,
  effects: vec4f,
};

@group(0) @binding(0) var<uniform> params: WaterParams;
@group(0) @binding(1) var<storage, read> springs: array<f32>;

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
  let wavePx = proceduralWave(uv.x, time) + springWave(uv.x) * 3.0;
  let waterStart = clamp(params.surface.x, 0.0, 0.98);
  let surfaceY = clamp(waterStart - wavePx / canvasSize.y, 0.0, 1.0);

  if (uv.y < surfaceY) {
    discard;
  }

  let depth = clamp((uv.y - surfaceY) / max(0.001, 1.0 - waterStart), 0.0, 1.0);
  let edge = 1.0 - smoothstep(0.0, 0.045, depth);
  let rain = clamp(params.environment.y * 2.5, 0.0, 1.0);
  let heat = clamp(params.environment.z / 1.5, 0.0, 1.0);

  var surfaceColor = mix(vec3f(0.12, 0.29, 0.36), vec3f(0.10, 0.42, 0.48), rain * 0.55);
  surfaceColor = mix(surfaceColor, vec3f(0.17, 0.24, 0.36), heat * 0.16);
  let deepColor = mix(vec3f(0.035, 0.08, 0.16), vec3f(0.06, 0.05, 0.13), heat * 0.2);
  var color = mix(surfaceColor, deepColor, depth * depth);

  let waveIntensity = abs(wavePx);
  let foam = smoothstep(4.0, 12.0, waveIntensity) * edge;
  color = mix(color, vec3f(0.82, 0.93, 1.0), foam * 0.52);

  let highlight = edge * (sin(uv.x * 24.0 + time * 0.7 + wavePx * 0.08) * 0.5 + 0.5);
  color += vec3f(0.32, 0.50, 0.64) * highlight * (0.18 + rain * 0.08);

  let caustic = sin((uv.x * 54.0 + uv.y * 18.0) + time * 0.45 + noise(uv * vec2f(18.0, 6.0)) * 3.0);
  color += vec3f(0.08, 0.16, 0.18) * max(caustic, 0.0) * (1.0 - depth) * 0.12;

  let sparkleCell = floor(vec2f(uv.x * 36.0 + time * 0.22, depth * 10.0));
  let sparkleSeed = random(sparkleCell);
  let sparkleTime = fract(time * 0.9 + sparkleSeed);
  let sparkle = smoothstep(0.0, 0.1, sparkleTime) * (1.0 - smoothstep(0.15, 0.25, sparkleTime));

  if (sparkleSeed > 0.984 && depth < 0.18) {
    color = mix(color, vec3f(0.76, 0.9, 1.0), sparkle * edge * 0.65);
  }

  let frost = clamp(params.effects.x, 0.0, 1.0);
  if (frost > 0.001) {
    let frostBand = smoothstep(0.38, 0.0, depth) * frost;
    color = mix(color, vec3f(0.70, 0.86, 1.0), frostBand * 0.52);
  }

  let alpha = clamp(params.surface.y * mix(0.68, 1.0, depth), 0.0, 0.86);
  return vec4f(max(color, vec3f(0.0)), alpha);
}

fn springWave(x: f32) -> f32 {
  let springCount = max(1u, u32(params.canvasAndTime.w));
  let maxIndex = springCount - 1u;
  let scaled = clamp(x, 0.0, 0.999) * f32(maxIndex);
  let left = min(u32(floor(scaled)), maxIndex);
  let right = min(left + 1u, maxIndex);
  return mix(springs[left], springs[right], fract(scaled));
}

fn proceduralWave(x: f32, time: f32) -> f32 {
  let activity = clamp(params.surface.z, 0.0, 1.0);
  let wind = params.environment.x;
  let direction = select(-1.0, 1.0, wind >= 0.0);
  let windSpeed = 0.7 + abs(wind) * 0.55;
  let waveA = sin(x * 19.0 + time * windSpeed * direction);
  let waveB = sin(x * 43.0 - time * 1.35 + 1.7);
  let waveC = sin(x * 91.0 + time * 2.1 + 0.6);
  return (waveA * 4.8 + waveB * 2.3 + waveC * 0.9) * activity;
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
