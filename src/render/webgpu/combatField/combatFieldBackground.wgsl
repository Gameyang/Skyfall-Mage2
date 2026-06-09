struct BackgroundParams {
  canvasAndTime: vec4f,
};

@group(0) @binding(0) var<uniform> params: BackgroundParams;

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
  let canvasSize = max(params.canvasAndTime.xy, vec2f(1.0));
  let uv = clamp(position.xy / canvasSize, vec2f(0.0), vec2f(1.0));
  let time = params.canvasAndTime.z;
  let horizon = smoothstep(0.18, 0.92, uv.y);

  let zenith = vec3f(0.08, 0.07, 0.20);
  let middle = vec3f(0.17, 0.13, 0.31);
  let dusk = vec3f(0.50, 0.24, 0.38);
  var color = mix(zenith, middle, smoothstep(0.0, 0.65, uv.y));
  color = mix(color, dusk, horizon * 0.72);

  let nebulaA = softBlob(uv, vec2f(0.45, 0.54), vec2f(0.28, 0.18));
  let nebulaB = softBlob(uv, vec2f(0.72, 0.42), vec2f(0.24, 0.16));
  let nebulaC = softBlob(uv, vec2f(0.24, 0.66), vec2f(0.22, 0.18));
  color += vec3f(0.02, 0.30, 0.36) * nebulaA * 0.42;
  color += vec3f(0.70, 0.30, 0.08) * nebulaB * 0.34;
  color += vec3f(0.24, 0.18, 0.45) * nebulaC * 0.26;

  let starLayerA = starField(uv * vec2f(72.0, 42.0), time, 0.975);
  let starLayerB = starField(uv * vec2f(128.0, 74.0) + 8.3, time * 1.3, 0.988);
  color += vec3f(0.76, 0.86, 1.0) * starLayerA * smoothstep(0.86, 0.08, uv.y);
  color += vec3f(1.0, 0.78, 0.45) * starLayerB * smoothstep(0.92, 0.18, uv.y);

  let farFog = smoothstep(0.62, 1.0, uv.y);
  color = mix(color, vec3f(0.42, 0.20, 0.34), farFog * 0.18);
  return vec4f(color, 1.0);
}

fn softBlob(uv: vec2f, center: vec2f, radius: vec2f) -> f32 {
  let delta = (uv - center) / radius;
  return exp(-dot(delta, delta) * 1.7);
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
