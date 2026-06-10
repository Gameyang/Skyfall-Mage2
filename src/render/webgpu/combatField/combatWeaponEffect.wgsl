struct EffectParams {
  positionAndSize: vec4f,
  atlas: vec4f,
  transform: vec4f,
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

  let frameCount = max(1.0, floor(params.atlas.y + 0.5));
  let frameIndex = clamp(floor(params.atlas.x + 0.5), 0.0, frameCount - 1.0);
  let frameUv = vec2f((frameIndex + localUv.x) / frameCount, localUv.y);
  let color = sampleEffect(frameUv);
  let alpha = color.a * clamp(params.atlas.z, 0.0, 1.0);
  let glow = 1.08 + smoothstep(0.16, 1.0, color.a) * 0.55;

  return vec4f(color.rgb * glow, alpha);
}

fn sampleEffect(uv: vec2f) -> vec4f {
  let inside = select(0.0, 1.0, uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0);
  return textureSampleLevel(effectTexture, effectSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0) * inside;
}
