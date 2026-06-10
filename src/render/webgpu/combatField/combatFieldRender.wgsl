struct FieldParams {
  gridAndCanvas: vec4f,
  playerAndAim: vec4f,
  timeAndCounts: vec4f,
};

struct MaterialEmitterGpu {
  data0: vec4f,
  data1: vec4f,
};

@group(0) @binding(0) var<uniform> params: FieldParams;
@group(0) @binding(1) var<storage, read> cellsIn: array<u32>;
@group(0) @binding(2) var<storage, read> cellsOut: array<u32>;
@group(0) @binding(3) var<storage, read> emitters: array<MaterialEmitterGpu>;
@group(0) @binding(4) var<storage, read> materialPalette: array<vec4f>;

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
  let gridSize = params.gridAndCanvas.xy;
  let canvasSize = max(params.gridAndCanvas.zw, vec2f(1.0, 1.0));
  let uv = clamp(position.xy / canvasSize, vec2f(0.0), vec2f(0.999));
  let cellX = min(u32(uv.x * gridSize.x), u32(gridSize.x) - 1u);
  let cellY = min(u32(uv.y * gridSize.y), u32(gridSize.y) - 1u);
  let index = cellY * u32(gridSize.x) + cellX;
  var color = materialColor(cellsIn[index] & 255u, uv);

  let emitterCount = min(u32(params.timeAndCounts.y), 32u);
  for (var i = 0u; i < 32u; i = i + 1u) {
    if (i >= emitterCount) {
      break;
    }

    let emitter = emitters[i];
    let material = u32(emitter.data0.x);
    let center = emitter.data0.yz;
    let radius = max(0.0001, emitter.data0.w);
    let strength = emitter.data1.x;
    let distanceToEmitter = distance(uv, center);

    if (distanceToEmitter < radius) {
      let blend = smoothstep(radius, 0.0, distanceToEmitter) * clamp(strength, 0.0, 1.0);
      color = mix(color, materialColor(material, uv), blend);
    }
  }

  let playerGlow = smoothstep(0.11, 0.0, distance(uv, params.playerAndAim.xy));
  let aimGlow = smoothstep(0.08, 0.0, distance(uv, params.playerAndAim.zw));
  let glowColor =
    vec3f(0.02, 0.12, 0.11) * playerGlow +
    vec3f(0.18, 0.11, 0.02) * aimGlow;
  let glowAlpha = clamp(max(playerGlow * 0.34, aimGlow * 0.26), 0.0, 0.45);
  color = vec4f(color.rgb + glowColor, max(color.a, glowAlpha));

  return color;
}

fn materialColor(material: u32, uv: vec2f) -> vec4f {
  let scan = 0.014 * sin((uv.x + uv.y) * 90.0 + params.timeAndCounts.x * 0.001);
  let paletteColor = materialPalette[min(material, 31u)];
  var alpha = paletteColor.a;
  var color = paletteColor.rgb;

  if (material == 0u) {
    alpha = 0.0;
  } else if (material == 1u) {
    alpha = 0.46;
    color = mix(color, vec3f(0.18, 0.16, 0.20), 0.34);
  } else if (material == 2u || material == 3u) {
    alpha = min(alpha, 0.66);
  } else if (material == 4u || material == 10u) {
    alpha = min(alpha, 0.82);
  } else if (material == 5u || material == 6u) {
    alpha = min(alpha, 0.38);
  } else if (material == 7u || material == 8u || material == 9u) {
    alpha = min(alpha, 0.72);
  } else {
    alpha = min(alpha, 0.76);
  }

  color = applyHdrEmission(material, color);
  return vec4f(max(vec3f(0.0), color + vec3f(scan)), alpha);
}

fn applyHdrEmission(material: u32, color: vec3f) -> vec3f {
  if (material == 4u) {
    return color * vec3f(2.45, 1.75, 1.35) + vec3f(0.32, 0.05, 0.02);
  }

  if (material == 7u) {
    return color * vec3f(3.1, 2.5, 1.8) + vec3f(0.35, 0.2, 0.05);
  }

  if (material == 8u) {
    return color * vec3f(1.8, 2.35, 2.1) + vec3f(0.0, 0.22, 0.2);
  }

  if (material == 9u) {
    return color * vec3f(2.2, 1.8, 2.65) + vec3f(0.16, 0.05, 0.32);
  }

  if (material == 10u) {
    return color * vec3f(2.7, 1.55, 1.2) + vec3f(0.45, 0.07, 0.01);
  }

  return color;
}
