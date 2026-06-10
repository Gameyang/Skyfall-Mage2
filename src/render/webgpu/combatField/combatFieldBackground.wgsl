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

  if (in.layer < 0.5) {
    return vec4f(skyColor(uv), 1.0);
  }

  if (in.layer < 2.5) {
    return ridgeColor(uv, in.localUv, vec3f(0.16, 0.12, 0.28), 0.68);
  }

  if (in.layer < 3.5) {
    return ridgeColor(uv, in.localUv, vec3f(0.11, 0.09, 0.19), 0.9);
  }

  return vec4f(0.0);
}

fn skyColor(uv: vec2f) -> vec3f {
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
  return max(vec3f(0.0), color);
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
