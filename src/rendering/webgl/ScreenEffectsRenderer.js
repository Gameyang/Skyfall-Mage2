import fragmentShaderSource from './screenEffects.fragment.glsl?raw';
import vertexShaderSource from './screenEffects.vertex.glsl?raw';

const HIT_FLASH_DURATION_MS = 180;
const DANGER_START_HP_RATIO = 0.2;
const DANGER_MAX_HP_RATIO = 0.01;

export function createScreenEffectsRenderer({ canvas }) {
  return new ScreenEffectsRenderer({ canvas });
}

export function computeScreenEffectIntensities(state) {
  const hitFlash = clamp((state.session?.contactFlashMs ?? 0) / HIT_FLASH_DURATION_MS, 0, 1);
  const hp = Math.max(0, state.player?.hp ?? 0);
  const maxHp = Math.max(1, state.player?.maxHp ?? 1);
  const hpRatio = clamp(hp / maxHp, 0, 1);
  const danger = hpRatio <= DANGER_START_HP_RATIO
    ? clamp((DANGER_START_HP_RATIO - hpRatio) / (DANGER_START_HP_RATIO - DANGER_MAX_HP_RATIO), 0, 1)
    : 0;

  return {
    hitFlash,
    danger,
  };
}

class ScreenEffectsRenderer {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!this.gl) {
      throw new Error('WebGL2 is required for the screen effects renderer.');
    }

    this.program = createProgram(this.gl, vertexShaderSource, fragmentShaderSource);
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, 'uResolution'),
      time: this.gl.getUniformLocation(this.program, 'uTime'),
      hitFlash: this.gl.getUniformLocation(this.program, 'uHitFlash'),
      danger: this.gl.getUniformLocation(this.program, 'uDanger'),
    };
    this.vertexArray = this.gl.createVertexArray();
    this.startTime = performance.now();

    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.clearColor(0, 0, 0, 0);
  }

  render(state, now = performance.now()) {
    this.resize();

    const { hitFlash, danger } = computeScreenEffectIntensities(state);
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.time, (now - this.startTime) / 1000);
    gl.uniform1f(this.uniforms.hitFlash, hitFlash);
    gl.uniform1f(this.uniforms.danger, danger);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const cssHeight = Math.max(1, Math.floor(rect.height || window.innerHeight));
    const width = Math.max(1, Math.floor(cssWidth * dpr));
    const height = Math.max(1, Math.floor(cssHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  destroy() {
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
