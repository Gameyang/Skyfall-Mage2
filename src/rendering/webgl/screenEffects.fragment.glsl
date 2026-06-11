#version 300 es

precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uHitFlash;
uniform float uDanger;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float edgeDistance = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float sharpEdge = 1.0 - smoothstep(0.0, 0.16, edgeDistance);
  float wideEdge = 1.0 - smoothstep(0.02, 0.34, edgeDistance);

  float flashPulse = 0.72 + 0.28 * sin(uTime * 74.0);
  float hitFlash = clamp(uHitFlash, 0.0, 1.0);
  float hitAlpha = hitFlash * hitFlash * flashPulse * mix(0.16, 0.82, sharpEdge) * wideEdge;

  float danger = clamp(uDanger, 0.0, 1.0);
  float dangerPulse = 0.72 + 0.28 * sin(uTime * 5.2);
  float dangerAlpha = danger * danger * wideEdge * (0.36 + 0.18 * dangerPulse);

  float alpha = clamp(hitAlpha + dangerAlpha, 0.0, 0.88);
  float hotRed = clamp(hitAlpha * 1.35 + danger * 0.18, 0.0, 1.0);
  vec3 dangerRed = vec3(0.08, 0.0, 0.0);
  vec3 flashRed = vec3(1.0, 0.03, 0.015);
  vec3 color = mix(dangerRed, flashRed, hotRed);

  outColor = vec4(color, alpha);
}
