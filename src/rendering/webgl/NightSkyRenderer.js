import fragmentShaderSource from './nightSky.fragment.glsl?raw';
import vertexShaderSource from './nightSky.vertex.glsl?raw';

export function createNightSkyRenderer({ canvas }) {
  return new NightSkyRenderer({ canvas });
}

class NightSkyRenderer {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!this.gl) {
      throw new Error('WebGL2 is required for the night sky renderer.');
    }

    this.animationFrameId = 0;
    this.destroyed = false;
    this.startTime = performance.now();
    this.renderFrame = this.renderFrame.bind(this);
    this.program = createProgram(this.gl, vertexShaderSource, fragmentShaderSource);
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, 'uResolution'),
      time: this.gl.getUniformLocation(this.program, 'uTime'),
    };
    this.vertexArray = this.gl.createVertexArray();
  }

  start() {
    if (this.animationFrameId) return;
    this.animationFrameId = requestAnimationFrame(this.renderFrame);
  }

  renderFrame(now) {
    if (this.destroyed) return;

    this.resize();
    this.render(now);
    this.animationFrameId = requestAnimationFrame(this.renderFrame);
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

  render(now) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.time, (now - this.startTime) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }

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
