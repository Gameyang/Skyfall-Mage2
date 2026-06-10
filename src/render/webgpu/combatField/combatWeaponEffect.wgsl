struct EffectParams {
  positionAndSize: vec4f,
  atlas: vec4f,
  transform: vec4f,
  colorAndGlow: vec4f,
  sheetRect: vec4f,
  frameGrid: vec4f,
};

@group(0) @binding(0) var<uniform> params: EffectParams;
@group(0) @binding(1) var effectTexture: texture_2d<f32>;
@group(0) @binding(2) var effectSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) quadUv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var corners = array<vec2f, 6>(
    vec2f(-0.5, -0.5),
    vec2f(0.5, -0.5),
    vec2f(-0.5, 0.5),
    vec2f(-0.5, 0.5),
    vec2f(0.5, -0.5),
    vec2f(0.5, 0.5)
  );

  let corner = corners[vertexIndex];
  let localPosition = corner * params.positionAndSize.zw;
  let angle = params.transform.x;
  let rotated = vec2f(
    localPosition.x * cos(angle) - localPosition.y * sin(angle),
    localPosition.x * sin(angle) + localPosition.y * cos(angle)
  );
  let screenPosition = params.positionAndSize.xy + rotated;

  var out: VertexOut;
  out.position = vec4f(screenPosition.x * 2.0 - 1.0, 1.0 - screenPosition.y * 2.0, 0.0, 1.0);
  out.quadUv = corner + vec2f(0.5);
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  var localUv = in.quadUv;

  if (params.transform.y < 0.0) {
    localUv.x = 1.0 - localUv.x;
  }

  let drawMode = floor(params.atlas.w + 0.5);
  let color = sampleLayer(localUv, drawMode);
  let alpha = color.a * clamp(params.atlas.z, 0.0, 1.0);
  let blendBoost = 1.0 + clamp(params.transform.w, 0.0, 2.0) * 0.18;
  let glow = 1.0 + smoothstep(0.12, 1.0, color.a) * params.colorAndGlow.w * blendBoost;

  return vec4f(color.rgb * glow, alpha);
}

fn sampleLayer(localUv: vec2f, drawMode: f32) -> vec4f {
  if (drawMode > 1.5) {
    return sampleStreak(localUv);
  }

  if (drawMode > 0.5) {
    return sampleRadial(localUv);
  }

  let frameCount = max(1.0, floor(params.atlas.y + 0.5));
  let frameIndex = clamp(floor(params.atlas.x + 0.5), 0.0, frameCount - 1.0);
  let columns = max(1.0, floor(params.frameGrid.x + 0.5));
  let rows = max(1.0, floor(params.frameGrid.y + 0.5));
  let column = frameIndex - floor(frameIndex / columns) * columns;
  let row = floor(frameIndex / columns);
  let frameUv = vec2f(
    params.sheetRect.x + ((column + localUv.x) / columns) * params.sheetRect.z,
    params.sheetRect.y + ((row + localUv.y) / rows) * params.sheetRect.w
  );
  let color = sampleEffect(frameUv);
  return vec4f(color.rgb * params.colorAndGlow.rgb, color.a);
}

fn sampleRadial(uv: vec2f) -> vec4f {
  let distanceFromCenter = distance(uv, vec2f(0.5));
  let softness = clamp(params.transform.z, 0.08, 0.95);
  let alpha = 1.0 - smoothstep(0.5 - softness * 0.42, 0.5, distanceFromCenter);
  return vec4f(params.colorAndGlow.rgb, alpha);
}

fn sampleStreak(uv: vec2f) -> vec4f {
  let edge = 0.5 - clamp(params.transform.z, 0.08, 0.95) * 0.42;
  let yFade = 1.0 - smoothstep(edge, 0.5, abs(uv.y - 0.5));
  let xFade = 1.0 - smoothstep(0.42, 1.0, abs(uv.x - 0.5) * 2.0);
  let core = 1.0 - smoothstep(0.0, 0.18, abs(uv.y - 0.5));
  return vec4f(params.colorAndGlow.rgb * (1.0 + core * 0.35), yFade * xFade);
}

fn sampleEffect(uv: vec2f) -> vec4f {
  let inside = select(0.0, 1.0, uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0);
  return textureSampleLevel(effectTexture, effectSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0) * inside;
}
