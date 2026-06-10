struct SpriteParams {
  positionAndSize: vec4f,
  transform: vec4f,
  effects: vec4f,
  effects2: vec4f,
};

@group(0) @binding(0) var<uniform> params: SpriteParams;
@group(0) @binding(1) var spriteTexture: texture_2d<f32>;
@group(0) @binding(2) var spriteSampler: sampler;

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
  let screenPosition = params.positionAndSize.xy + corner * params.positionAndSize.zw;

  var out: VertexOut;
  out.position = vec4f(screenPosition.x * 2.0 - 1.0, 1.0 - screenPosition.y * 2.0, 0.0, 1.0);
  out.quadUv = corner + vec2f(0.5);
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let time = params.transform.x * 0.001;
  let hit = params.effects.x;
  let uv = vec2f(select(in.quadUv.x, 1.0 - in.quadUv.x, params.transform.y < 0.0), in.quadUv.y);

  var color = sampleSprite(uv);

  if (color.a > 0.01) {
    color = vec4f(applyHitTint(color.rgb, time, hit), color.a);
  }

  return color;
}

fn sampleSprite(uv: vec2f) -> vec4f {
  let frameCount = max(1.0, floor(params.effects.z + 0.5));
  let frameIndex = clamp(floor(params.effects.y + 0.5), 0.0, frameCount - 1.0);
  let frameUv = vec2f((frameIndex + uv.x) / frameCount, uv.y);
  let inside = select(0.0, 1.0, uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0);
  return textureSampleLevel(spriteTexture, spriteSampler, clamp(frameUv, vec2f(0.0), vec2f(1.0)), 0.0) * inside;
}

fn applyHitTint(baseColor: vec3f, time: f32, hit: f32) -> vec3f {
  let blink = smoothstep(0.45, 0.85, 0.5 + 0.5 * sin(time * 34.0));
  return mix(baseColor, vec3f(1.0), hit * blink * 0.82);
}
