struct BackgroundParams {
  canvasAndTime: vec4f,
  environment: vec4f,
};

@group(0) @binding(0) var<uniform> params: BackgroundParams;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) sceneUv: vec2f,
  @location(1) localUv: vec2f,
  @location(2) layer: f32,
};

@vertex
fn vertexMain(
  @location(0) clipPosition: vec2f,
  @location(1) localUv: vec2f,
  @location(2) layer: f32
) -> VertexOut {
  var out: VertexOut;
  out.position = vec4f(clipPosition, 0.0, 1.0);
  out.sceneUv = vec2f(clipPosition.x * 0.5 + 0.5, 0.5 - clipPosition.y * 0.5);
  out.localUv = localUv;
  out.layer = layer;
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let uv = clamp(in.sceneUv, vec2f(0.0), vec2f(1.0));
  let time = params.canvasAndTime.z;

  if (in.layer < 0.5) {
    return vec4f(skyColor(uv, time), 1.0);
  }

  if (in.layer < 1.5) {
    return auroraRibbon(uv, in.localUv, time);
  }

  if (in.layer < 2.5) {
    return ridgeColor(uv, in.localUv, vec3f(0.16, 0.12, 0.28), 0.68);
  }

  if (in.layer < 3.5) {
    return ridgeColor(uv, in.localUv, vec3f(0.11, 0.09, 0.19), 0.9);
  }

  if (in.layer < 4.5) {
    return horizonHaze(uv, in.localUv, time);
  }

  return rainStreak(uv, in.localUv, time);
}

fn skyColor(uv: vec2f, time: f32) -> vec3f {
  let rain = params.environment.x;
  let heat = params.environment.y;
  let frost = params.environment.z;
  let lava = params.environment.w;
  let horizon = smoothstep(0.14, 0.95, uv.y);

  let zenith = mix(vec3f(0.07, 0.08, 0.2), vec3f(0.06, 0.1, 0.15), rain * 0.45);
  var middle = mix(vec3f(0.15, 0.14, 0.3), vec3f(0.12, 0.18, 0.24), rain * 0.35);
  middle = mix(middle, vec3f(0.2, 0.17, 0.34), frost * 0.4);
  var dusk = mix(vec3f(0.48, 0.23, 0.34), vec3f(0.56, 0.22, 0.12), clamp(heat * 0.42 + lava * 0.68, 0.0, 1.0));
  dusk = mix(dusk, vec3f(0.33, 0.36, 0.46), rain * 0.32);

  var color = mix(zenith, middle, smoothstep(0.0, 0.68, uv.y));
  color = mix(color, dusk, horizon * 0.72);

  let starLayerA = starField(uv * vec2f(74.0, 44.0), time, 0.974);
  let starLayerB = starField(uv * vec2f(132.0, 76.0) + 8.3, time * 1.25, 0.988);
  let starMask = (1.0 - smoothstep(0.08, 0.82, uv.y)) * (1.0 - rain * 0.85);
  color += vec3f(0.72, 0.86, 1.0) * starLayerA * starMask;
  color += vec3f(1.0, 0.76, 0.44) * starLayerB * starMask;

  let scan = 0.012 * sin((uv.x * 18.0 + uv.y * 9.0) + time * 0.35);
  return max(vec3f(0.0), color + vec3f(scan));
}

fn auroraRibbon(uv: vec2f, localUv: vec2f, time: f32) -> vec4f {
  let rain = params.environment.x;
  let heat = params.environment.y;
  let lava = params.environment.w;
  let wave = sin(localUv.x * 12.0 + time * 0.42) * 0.12 + sin(localUv.x * 21.0 - time * 0.24) * 0.05;
  let center = 0.48 + wave;
  let band = 1.0 - smoothstep(0.0, 0.48, abs(localUv.y - center));
  let edgeFade = smoothstep(0.0, 0.16, localUv.x) * (1.0 - smoothstep(0.72, 1.0, localUv.x));
  let verticalFade = 1.0 - smoothstep(0.12, 0.84, uv.y);
  let alpha = band * edgeFade * verticalFade * (0.24 + heat * 0.04 + lava * 0.12) * (1.0 - rain * 0.58);
  let cool = vec3f(0.12, 0.55, 0.56);
  let hot = vec3f(0.82, 0.28, 0.1);
  let color = mix(cool, hot, clamp(heat * 0.45 + lava * 0.8, 0.0, 1.0));
  return vec4f(color, alpha);
}

fn ridgeColor(uv: vec2f, localUv: vec2f, base: vec3f, alpha: f32) -> vec4f {
  let rain = params.environment.x;
  let heat = params.environment.y;
  let lava = params.environment.w;
  let topLight = 1.0 - smoothstep(0.0, 0.44, localUv.y);
  let depth = smoothstep(0.0, 1.0, localUv.y);
  var color = base;
  color += vec3f(0.11, 0.08, 0.12) * topLight;
  color = mix(color, vec3f(0.1, 0.14, 0.18), rain * 0.26);
  color += vec3f(0.16, 0.04, 0.01) * clamp(heat * 0.22 + lava * 0.5, 0.0, 1.0) * depth;
  let atmosphericFade = smoothstep(0.18, 0.92, uv.y);
  return vec4f(color, alpha * atmosphericFade);
}

fn horizonHaze(uv: vec2f, localUv: vec2f, time: f32) -> vec4f {
  let rain = params.environment.x;
  let heat = params.environment.y;
  let wind = params.canvasAndTime.w;
  let drift = sin((uv.x + wind * time * 0.035) * 18.0 + time * 0.18) * 0.5 + 0.5;
  let band = smoothstep(0.0, 0.36, localUv.y) * (1.0 - smoothstep(0.24, 1.0, localUv.y));
  let color = mix(vec3f(0.34, 0.22, 0.34), vec3f(0.42, 0.46, 0.52), rain * 0.48);
  let alpha = band * (0.18 + rain * 0.16 + heat * 0.04) * (0.72 + drift * 0.28);
  return vec4f(color, alpha);
}

fn rainStreak(uv: vec2f, localUv: vec2f, time: f32) -> vec4f {
  let rain = params.environment.x;
  let wind = params.canvasAndTime.w;
  let travel = fract(localUv.y - time * (0.72 + rain * 0.8) + localUv.x * 0.38);
  let core = 1.0 - smoothstep(0.0, 0.18, abs(travel - 0.18));
  let xFade = smoothstep(0.0, 0.35, localUv.x) * (1.0 - smoothstep(0.55, 1.0, localUv.x + wind * 0.08));
  let alpha = core * xFade * rain * 0.18 * smoothstep(0.08, 0.82, uv.y);
  return vec4f(vec3f(0.72, 0.86, 0.92), alpha);
}

fn starField(st: vec2f, time: f32, threshold: f32) -> f32 {
  let cell = floor(st);
  let seed = random(cell);
  let twinkle = 0.55 + 0.45 * sin(time * (0.8 + seed * 1.7) + seed * 6.28318);
  return smoothstep(threshold, 1.0, seed) * twinkle;
}

fn random(st: vec2f) -> f32 {
  return fract(sin(dot(st, vec2f(12.9898, 78.233))) * 43758.5453);
}
