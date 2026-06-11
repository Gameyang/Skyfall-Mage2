#version 300 es

precision highp float;

uniform vec2 uResolution;
uniform float uTime;

in vec2 vUv;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float starLayer(vec2 uv, float scale, float threshold, float size) {
  vec2 cell = floor(uv * scale);
  vec2 local = fract(uv * scale) - 0.5;
  float seed = hash21(cell);
  float starMask = step(threshold, seed);
  float dist = length(local);
  float core = smoothstep(size, 0.0, dist);
  float twinkle = 0.72 + 0.28 * sin(uTime * (0.7 + seed * 2.0) + seed * 24.0);
  return core * starMask * twinkle;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float vertical = clamp(uv.y, 0.0, 1.0);

  vec3 zenith = vec3(0.015, 0.018, 0.055);
  vec3 horizon = vec3(0.070, 0.085, 0.180);
  vec3 color = mix(horizon, zenith, smoothstep(0.0, 1.0, vertical));

  float moonGlow = smoothstep(0.62, 0.0, length((uv - vec2(0.58, 0.68)) * vec2(1.25, 1.0)));
  color += vec3(0.035, 0.055, 0.095) * moonGlow;

  float stars =
    starLayer(uv, 55.0, 0.965, 0.055) +
    starLayer(uv + vec2(12.7, 3.1), 92.0, 0.975, 0.045) * 0.85 +
    starLayer(uv + vec2(5.4, 18.9), 145.0, 0.986, 0.036) * 0.65;

  float upperSky = smoothstep(0.08, 0.72, vertical);
  color += vec3(0.72, 0.83, 1.0) * stars * upperSky;

  float vignette = smoothstep(0.88, 0.18, length(uv - vec2(0.5, 0.5)));
  color *= 0.74 + vignette * 0.34;

  outColor = vec4(color, 1.0);
}
