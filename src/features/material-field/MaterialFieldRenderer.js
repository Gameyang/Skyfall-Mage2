import { createBloomPostProcess } from '../../rendering/webgpu/bloom/BloomPostProcess.js';
import materialFieldShaderSource from './shaders/noitaField.wgsl?raw';
import {
  BLOOM_CONFIG,
  CELL_BYTES,
  CELL_COUNT,
  DPR_LIMIT,
  EMITTER_BYTES,
  GRID_HEIGHT,
  GRID_WIDTH,
  HDR_SCENE_FORMAT,
  MAX_EMITTERS,
  PARAM_WORDS,
  SCENE_CLEAR_COLOR,
  WORKGROUP_SIZE,
} from './config.js';
import { seedInitialField } from './initialField.js';

export async function createMaterialFieldRenderer(options) {
  const renderer = new MaterialFieldRenderer(options);
  await renderer.initialize();
  return renderer;
}

class MaterialFieldRenderer {
  constructor({ canvas, onDeviceLost }) {
    this.canvas = canvas;
    this.onDeviceLost = onDeviceLost;
    this.state = null;
    this.emitterState = null;
    this.animationFrameId = 0;
    this.destroyed = false;
    this.renderFrame = this.renderFrame.bind(this);
  }

  async initialize() {
    if (!navigator.gpu) {
      throw new Error('WebGPU material field is unavailable in this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      throw new Error('No WebGPU adapter was found for this browser/device.');
    }

    const device = await adapter.requestDevice();
    device.lost.then((info) => {
      if (!this.destroyed && this.onDeviceLost) {
        this.onDeviceLost(info);
      }
    });

    const context = this.canvas.getContext('webgpu');
    if (!context) {
      throw new Error('The canvas could not create a WebGPU context.');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    const shaderModule = device.createShaderModule({
      label: 'material-field-shader',
      code: materialFieldShaderSource,
    });
    const initialCells = seedInitialField();
    const bufferSize = CELL_COUNT * CELL_BYTES;

    const cellBuffers = [
      device.createBuffer({
        label: 'material-cells-a',
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      device.createBuffer({
        label: 'material-cells-b',
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];
    device.queue.writeBuffer(cellBuffers[0], 0, initialCells);
    device.queue.writeBuffer(cellBuffers[1], 0, initialCells);

    const paramsBuffer = device.createBuffer({
      label: 'simulation-params',
      size: Uint32Array.BYTES_PER_ELEMENT * PARAM_WORDS,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const emitterBuffer = device.createBuffer({
      label: 'material-emitters',
      size: EMITTER_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const computeBindGroupLayout = device.createBindGroupLayout({
      label: 'compute-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    const renderBindGroupLayout = device.createBindGroupLayout({
      label: 'render-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const { computePipeline, renderPipeline } = await createPipelines(
      device,
      shaderModule,
      HDR_SCENE_FORMAT,
      computeBindGroupLayout,
      renderBindGroupLayout,
    );
    const bloom = await createBloomPostProcess(device, format, BLOOM_CONFIG);

    const computeBindGroups = [
      device.createBindGroup({
        label: 'compute-a-to-b',
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: cellBuffers[0] } },
          { binding: 1, resource: { buffer: cellBuffers[1] } },
          { binding: 2, resource: { buffer: paramsBuffer } },
          { binding: 3, resource: { buffer: emitterBuffer } },
        ],
      }),
      device.createBindGroup({
        label: 'compute-b-to-a',
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: cellBuffers[1] } },
          { binding: 1, resource: { buffer: cellBuffers[0] } },
          { binding: 2, resource: { buffer: paramsBuffer } },
          { binding: 3, resource: { buffer: emitterBuffer } },
        ],
      }),
    ];

    const renderBindGroups = [
      device.createBindGroup({
        label: 'render-a',
        layout: renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: cellBuffers[0] } },
          { binding: 2, resource: { buffer: paramsBuffer } },
        ],
      }),
      device.createBindGroup({
        label: 'render-b',
        layout: renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: cellBuffers[1] } },
          { binding: 2, resource: { buffer: paramsBuffer } },
        ],
      }),
    ];

    this.state = {
      device,
      context,
      format,
      sceneFormat: HDR_SCENE_FORMAT,
      cellBuffers,
      computePipeline,
      renderPipeline,
      computeBindGroups,
      renderBindGroups,
      paramsBuffer,
      emitterBuffer,
      bloom,
      sceneTexture: null,
      sceneTextureView: null,
      renderTargetWidth: 0,
      renderTargetHeight: 0,
      currentBufferIndex: 0,
      frame: 0,
    };
  }

  start({ emitterState }) {
    this.emitterState = emitterState;
    this.resizeCanvas();
    this.animationFrameId = requestAnimationFrame(this.renderFrame);
  }

  renderFrame() {
    if (this.destroyed || !this.state || !this.emitterState) return;

    const state = this.state;
    this.resizeCanvas();
    this.resizeRenderTargets();

    const emitterPayload = this.emitterState.buildEmitterBuffer();
    this.writeFrameData(emitterPayload);

    const encoder = state.device.createCommandEncoder();
    const computePass = encoder.beginComputePass({ label: 'material-simulation-pass' });
    computePass.setPipeline(state.computePipeline);
    computePass.setBindGroup(0, state.computeBindGroups[state.currentBufferIndex]);
    computePass.dispatchWorkgroups(
      Math.ceil(GRID_WIDTH / WORKGROUP_SIZE),
      Math.ceil(GRID_HEIGHT / WORKGROUP_SIZE),
    );
    computePass.end();

    state.currentBufferIndex = 1 - state.currentBufferIndex;

    const renderPass = encoder.beginRenderPass({
      label: 'material-render-pass',
      colorAttachments: [
        {
          view: state.sceneTextureView,
          clearValue: SCENE_CLEAR_COLOR,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(state.renderPipeline);
    renderPass.setBindGroup(0, state.renderBindGroups[state.currentBufferIndex]);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();

    const canvasView = state.context.getCurrentTexture().createView();
    state.bloom.render(encoder, state.sceneTextureView, canvasView);

    state.device.queue.submit([encoder.finish()]);
    state.frame += 1;
    this.emitterState.ageBurstEmitters();

    this.animationFrameId = requestAnimationFrame(this.renderFrame);
  }

  resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  resizeRenderTargets() {
    const state = this.state;
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);
    if (state.renderTargetWidth === width && state.renderTargetHeight === height) return;

    if (state.sceneTexture) {
      state.sceneTexture.destroy();
    }

    state.sceneTexture = createSceneTexture(state.device, state.sceneFormat, width, height);
    state.sceneTextureView = state.sceneTexture.createView();
    state.renderTargetWidth = width;
    state.renderTargetHeight = height;
    state.bloom.resize(width, height);
  }

  writeFrameData(emitterPayload) {
    const state = this.state;
    const params = new Uint32Array(PARAM_WORDS);
    params[0] = GRID_WIDTH;
    params[1] = GRID_HEIGHT;
    params[2] = state.frame;
    params[3] = emitterPayload.count;
    params[4] = this.canvas.width;
    params[5] = this.canvas.height;
    params[6] = MAX_EMITTERS;
    params[7] = performance.now() >>> 0;

    state.device.queue.writeBuffer(state.paramsBuffer, 0, params);
    state.device.queue.writeBuffer(state.emitterBuffer, 0, emitterPayload.words);
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (!this.state) return;
    this.state.sceneTexture?.destroy();
    this.state.bloom.destroy();
    this.state.paramsBuffer.destroy();
    this.state.emitterBuffer.destroy();
    for (const buffer of this.state.cellBuffers) {
      buffer.destroy();
    }
    this.state.device.destroy();
    this.state = null;
  }
}

async function createPipelines(device, shaderModule, format, computeBindGroupLayout, renderBindGroupLayout) {
  device.pushErrorScope('validation');

  const computePipelinePromise = device.createComputePipelineAsync({
    label: 'material-simulation-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
    compute: {
      module: shaderModule,
      entryPoint: 'simulate',
    },
  });

  const renderPipelinePromise = device.createRenderPipelineAsync({
    label: 'material-render-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  let pipelines;
  try {
    pipelines = await Promise.all([computePipelinePromise, renderPipelinePromise]);
  } catch (error) {
    await device.popErrorScope();
    throw error;
  }

  const validationError = await device.popErrorScope();
  if (validationError) {
    throw new Error(validationError.message);
  }

  return {
    computePipeline: pipelines[0],
    renderPipeline: pipelines[1],
  };
}

function createSceneTexture(device, format, width, height) {
  return device.createTexture({
    label: 'material-scene-texture',
    size: { width, height },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
}
