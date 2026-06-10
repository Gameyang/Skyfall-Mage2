struct BloomParams {
  sourceTexelAndThreshold: vec4f,
  targetSizeRadiusAndIntensity: vec4f,
};

@group(0) @binding(0) var<uniform> params: BloomParams;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;
@group(0) @binding(3) var bloomSampler: sampler;

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
fn brightDownsampleFragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = fragmentUv(position);
  let color = downsampleSource(uv);
  let brightness = max(max(color.r, color.g), color.b);
  let threshold = params.sourceTexelAndThreshold.z;
  let knee = max(0.0001, threshold * 0.18);
  let soft = clamp((brightness - threshold + knee) / (2.0 * knee), 0.0, 1.0);
  let contribution = max(brightness - threshold, soft * soft * knee) / max(brightness, 0.0001);
  return vec4f(color * contribution, 1.0);
}

@fragment
fn downsampleFragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  return vec4f(downsampleSource(fragmentUv(position)), 1.0);
}

@fragment
fn upsampleFragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = fragmentUv(position);
  let texel = params.sourceTexelAndThreshold.xy * params.targetSizeRadiusAndIntensity.z;
  var color = textureSample(sourceTexture, bloomSampler, uv).rgb * 4.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(1.0, 0.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(-1.0, 0.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(0.0, 1.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(0.0, -1.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(1.0, 1.0)).rgb;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(-1.0, 1.0)).rgb;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(1.0, -1.0)).rgb;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(-1.0, -1.0)).rgb;
  return vec4f(color / 16.0, 1.0);
}

@fragment
fn finalCompositeFragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = fragmentUv(position);
  let scene = textureSample(sourceTexture, bloomSampler, uv).rgb;
  let bloom = textureSample(bloomTexture, bloomSampler, uv).rgb;
  let intensity = params.targetSizeRadiusAndIntensity.w;
  return vec4f(scene + bloom * intensity, 1.0);
}

fn fragmentUv(position: vec4f) -> vec2f {
  let targetSize = max(params.targetSizeRadiusAndIntensity.xy, vec2f(1.0, 1.0));
  return clamp(position.xy / targetSize, vec2f(0.0), vec2f(0.999));
}

fn downsampleSource(uv: vec2f) -> vec3f {
  let texel = params.sourceTexelAndThreshold.xy * params.targetSizeRadiusAndIntensity.z;
  var color = textureSample(sourceTexture, bloomSampler, uv).rgb * 4.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(1.0, 0.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(-1.0, 0.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(0.0, 1.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(0.0, -1.0)).rgb * 2.0;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(1.0, 1.0)).rgb;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(-1.0, 1.0)).rgb;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(1.0, -1.0)).rgb;
  color = color + textureSample(sourceTexture, bloomSampler, uv + texel * vec2f(-1.0, -1.0)).rgb;
  return color / 16.0;
}
