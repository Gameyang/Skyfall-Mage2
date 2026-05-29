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
  let canvasSize = max(params.gridAndCanvas.zw, vec2f(1.0, 1.0));
  let uv = clamp(position.xy / canvasSize, vec2f(0.0), vec2f(0.999));
  var bloom = vec3f(0.0);
  bloom = bloom + vec3f(0.0, 0.45, 0.38) * smoothstep(0.22, 0.0, distance(uv, params.playerAndAim.xy));
  bloom = bloom + vec3f(0.75, 0.45, 0.08) * smoothstep(0.16, 0.0, distance(uv, params.playerAndAim.zw));

  let emitterCount = min(u32(params.timeAndCounts.y), 32u);
  for (var i = 0u; i < 32u; i = i + 1u) {
    if (i >= emitterCount) {
      break;
    }

    let emitter = emitters[i];
    let material = u32(emitter.data0.x);
    let center = emitter.data0.yz;
    let radius = max(0.0001, emitter.data0.w * 2.2);
    let strength = emitter.data1.x;
    let paletteColor = materialPalette[min(material, 31u)].rgb;
    bloom = bloom + paletteColor * smoothstep(radius, 0.0, distance(uv, center)) * clamp(strength, 0.0, 1.0) * 0.65;
  }

  return vec4f(bloom, 1.0);
}
