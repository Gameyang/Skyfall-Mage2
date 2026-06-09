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
  let time = params.transform.x * 0.001;
  let motion = params.effects2.y;
  let outlineInflate = 1.24;

  var scale = 1.0;
  var rotation = 0.0;
  var offset = vec2f(0.0);

  if (motion > 0.5 && motion < 1.5) {
    scale = scale + sin(time * 7.5) * 0.055;
    offset.y = offset.y + sin(time * 7.5) * 0.006;
  } else if (motion > 1.5 && motion < 2.5) {
    offset.x = offset.x + sin(time * 56.0) * 0.0045;
    offset.y = offset.y + cos(time * 49.0) * 0.0035;
    rotation = rotation + sin(time * 62.0) * 0.045;
  } else if (motion > 2.5 && motion < 3.5) {
    scale = scale + sin(time * 5.5) * 0.075;
  } else if (motion > 3.5) {
    rotation = rotation + sin(time * 3.2) * 0.105;
    offset.y = offset.y + sin(time * 4.4) * 0.0035;
  } else {
    offset.y = offset.y + sin(time * 3.8) * 0.003;
  }

  let c = cos(rotation);
  let s = sin(rotation);
  let local = corner * params.positionAndSize.zw * outlineInflate * scale;
  let rotated = vec2f(local.x * c - local.y * s, local.x * s + local.y * c);
  let screenPosition = params.positionAndSize.xy + rotated + offset;

  var out: VertexOut;
  out.position = vec4f(screenPosition.x * 2.0 - 1.0, 1.0 - screenPosition.y * 2.0, 0.0, 1.0);
  out.quadUv = corner + vec2f(0.5);
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let time = params.transform.x * 0.001;
  let rarity = params.transform.z;
  let hit = params.effects.x;
  let buff = params.effects.y;
  let burning = params.effects.z;
  let slowed = params.effects.w;
  let magic = params.effects2.x;
  let outlineInflate = 1.24;
  let rawUv = (in.quadUv - vec2f(0.5)) * outlineInflate + vec2f(0.5);
  let uv = vec2f(select(rawUv.x, 1.0 - rawUv.x, params.transform.y < 0.0), rawUv.y);

  var color = sampleSprite(uv);
  let texel = spriteTexelSize();
  var neighborAlpha = 0.0;
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(1.5, 0.0)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(-1.5, 0.0)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(0.0, 1.5)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(0.0, -1.5)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(1.1, 1.1)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(-1.1, -1.1)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(1.1, -1.1)).a);
  neighborAlpha = max(neighborAlpha, sampleSprite(uv + texel * vec2f(-1.1, 1.1)).a);

  let outlineAlpha = clamp((neighborAlpha - color.a) * outlineStrength(rarity, buff, burning, slowed, magic), 0.0, 1.0);
  let outlineColor = resolveOutlineColor(rarity, buff, burning, slowed, magic, in.quadUv, time);

  if (color.a > 0.01) {
    color = vec4f(applyStatusColor(color.rgb, uv, time, hit, burning, slowed, magic), color.a);
  }

  let sprite = vec4f(color.rgb, color.a);
  let outline = vec4f(outlineColor, outlineAlpha);
  let mixed = mix(outline, sprite, sprite.a);

  if (mixed.a <= 0.01) {
    return vec4f(0.0);
  }

  return mixed;
}

fn spriteTexelSize() -> vec2f {
  let size = textureDimensions(spriteTexture);
  return vec2f(1.0 / f32(size.x), 1.0 / f32(size.y));
}

fn sampleSprite(uv: vec2f) -> vec4f {
  let inside = select(0.0, 1.0, uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0);
  return textureSampleLevel(spriteTexture, spriteSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0) * inside;
}

fn outlineStrength(rarity: f32, buff: f32, burning: f32, slowed: f32, magic: f32) -> f32 {
  if (rarity > 0.5 || buff > 0.5 || burning > 0.5 || slowed > 0.5 || magic > 0.5) {
    return 1.0;
  }

  return 0.0;
}

fn resolveOutlineColor(rarity: f32, buff: f32, burning: f32, slowed: f32, magic: f32, uv: vec2f, time: f32) -> vec3f {
  let sweep = 0.5 + 0.5 * sin((uv.x + uv.y) * 9.0 + time * 3.2);

  if (burning > 0.5) {
    return mix(vec3f(1.0, 0.26, 0.05), vec3f(1.0, 0.76, 0.18), sweep);
  }

  if (slowed > 0.5) {
    return mix(vec3f(0.48, 0.94, 1.0), vec3f(0.9, 1.0, 1.0), sweep);
  }

  if (magic > 0.5) {
    return mix(vec3f(0.28, 0.96, 0.84), vec3f(0.74, 0.38, 1.0), sweep);
  }

  if (rarity > 2.5) {
    return mix(vec3f(0.78, 0.38, 1.0), vec3f(1.0, 0.76, 0.2), sweep);
  }

  if (rarity > 1.5) {
    return mix(vec3f(0.3, 0.6, 1.0), vec3f(0.58, 0.9, 1.0), sweep);
  }

  if (rarity > 0.5 || buff > 0.5) {
    return mix(vec3f(0.24, 0.88, 0.68), vec3f(0.9, 0.98, 0.72), sweep);
  }

  return vec3f(0.0);
}

fn applyStatusColor(baseColor: vec3f, uv: vec2f, time: f32, hit: f32, burning: f32, slowed: f32, magic: f32) -> vec3f {
  var color = baseColor;
  let flash = hit * max(0.0, sin(time * 18.0));
  color = mix(color, vec3f(1.0, 0.86, 0.78), flash * 0.58);

  let fireNoise = hash2(floor((uv + vec2f(time * 0.22, -time * 0.34)) * 36.0));
  color = color + vec3f(1.0, 0.28, 0.04) * burning * fireNoise * 0.34;

  let iceShimmer = 0.5 + 0.5 * sin((uv.x - uv.y) * 68.0 - time * 5.0);
  color = mix(color, vec3f(0.68, 0.92, 1.0), slowed * iceShimmer * 0.36);

  let magicPulse = 0.5 + 0.5 * sin((uv.x + uv.y) * 24.0 + time * 6.0);
  color = color + vec3f(0.18, 0.46, 0.72) * magic * magicPulse * 0.26;

  return clamp(color, vec3f(0.0), vec3f(1.0));
}

fn hash2(value: vec2f) -> f32 {
  return fract(sin(dot(value, vec2f(127.1, 311.7))) * 43758.5453);
}
