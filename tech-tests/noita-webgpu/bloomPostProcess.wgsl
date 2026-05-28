struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

struct BloomParams {
  threshold: f32,
  intensity: f32,
  radius: f32,
  enabled: f32,
};

@group(0) @binding(0) var primaryTexture: texture_2d<f32>;
@group(0) @binding(1) var secondaryTexture: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var<uniform> params: BloomParams;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0),
  );

  var out: VertexOut;
  out.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  out.uv = uvs[vertexIndex];
  return out;
}

fn textureTexelSize(tex: texture_2d<f32>) -> vec2<f32> {
  let size = vec2<f32>(textureDimensions(tex, 0));
  return 1.0 / max(size, vec2<f32>(1.0));
}

fn sampleBox(tex: texture_2d<f32>, uv: vec2<f32>, radius: f32) -> vec3<f32> {
  let texel = textureTexelSize(tex) * radius;
  let center = textureSample(tex, linearSampler, uv).rgb;
  let left = textureSample(tex, linearSampler, uv + vec2<f32>(-texel.x, 0.0)).rgb;
  let right = textureSample(tex, linearSampler, uv + vec2<f32>(texel.x, 0.0)).rgb;
  let up = textureSample(tex, linearSampler, uv + vec2<f32>(0.0, -texel.y)).rgb;
  let down = textureSample(tex, linearSampler, uv + vec2<f32>(0.0, texel.y)).rgb;
  return (center * 4.0 + left + right + up + down) * 0.125;
}

fn bloomMask(color: vec3<f32>) -> f32 {
  let luma = max(max(color.r, color.g), color.b);
  return smoothstep(params.threshold, params.threshold + 1.25, luma);
}

@fragment
fn brightDownsampleFragment(in: VertexOut) -> @location(0) vec4<f32> {
  let color = sampleBox(primaryTexture, in.uv, params.radius);
  return vec4<f32>(color * bloomMask(color), 1.0);
}

@fragment
fn downsampleFragment(in: VertexOut) -> @location(0) vec4<f32> {
  return vec4<f32>(sampleBox(primaryTexture, in.uv, params.radius), 1.0);
}

@fragment
fn upsampleFragment(in: VertexOut) -> @location(0) vec4<f32> {
  let high = textureSample(primaryTexture, linearSampler, in.uv).rgb;
  let low = sampleBox(secondaryTexture, in.uv, params.radius * 1.35);
  return vec4<f32>(high + low * 0.72, 1.0);
}

@fragment
fn finalCompositeFragment(in: VertexOut) -> @location(0) vec4<f32> {
  let scene = textureSample(primaryTexture, linearSampler, in.uv).rgb;
  let bloom = textureSample(secondaryTexture, linearSampler, in.uv).rgb;
  let enabled = select(0.0, 1.0, params.enabled > 0.5);
  return vec4<f32>(min(scene + bloom * params.intensity * enabled, vec3<f32>(1.0)), 1.0);
}
