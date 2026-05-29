import { createBloomPostProcess } from './bloomPostProcess.js';

const GRID_WIDTH = 256;
const GRID_HEIGHT = 144;
const WORKGROUP_SIZE = 8;
const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;
const CELL_BYTES = Uint32Array.BYTES_PER_ELEMENT;

const PARAM_WORDS = 16;
const MAX_EMITTERS = 32;
const EMITTER_WORDS = 8;
const EMITTER_FLAG_EXPLOSION = 1;
const EMITTER_BYTES = MAX_EMITTERS * EMITTER_WORDS * Uint32Array.BYTES_PER_ELEMENT;

const BRUSH_RADIUS = 5;
const TOUCH_WATER_RADIUS = 6;
const EXPLOSION_RADIUS = 18;
const EXPLOSION_FRAMES = 5;
const DPR_LIMIT = 2;
const HDR_SCENE_FORMAT = 'rgba16float';
const SCENE_CLEAR_COLOR = { r: 0.02, g: 0.02, b: 0.03, a: 1 };
const BLOOM_CONFIG = Object.freeze({
  enabled: true,
  threshold: 0.98,
  intensity: 0.95,
  radius: 1.35,
  levels: 6,
  bloomFormat: HDR_SCENE_FORMAT,
  clearColor: SCENE_CLEAR_COLOR,
});

const MATERIAL = {
  EMPTY: 0,
  SOLID: 1,
  SAND: 2,
  WATER: 3,
  FIRE: 4,
  SMOKE: 5,
  SPARK: 6,
  STEAM: 7,
  WET_SAND: 8,
};

const MATERIAL_OPTIONS = [
  {
    label: 'Fire',
    key: '1',
    material: MATERIAL.FIRE,
    color: '#ff6a1a',
    glow: 'rgba(255, 106, 26, 0.72)',
  },
  {
    label: 'Water',
    key: '2',
    material: MATERIAL.WATER,
    color: '#2f88ff',
    glow: 'rgba(47, 136, 255, 0.56)',
  },
  {
    label: 'Sand',
    key: '3',
    material: MATERIAL.SAND,
    color: '#d9a84a',
    glow: 'rgba(217, 168, 74, 0.42)',
  },
  {
    label: 'Smoke',
    key: '4',
    material: MATERIAL.SMOKE,
    color: '#9da3aa',
    glow: 'rgba(157, 163, 170, 0.38)',
  },
  {
    label: 'Steam',
    key: '5',
    material: MATERIAL.STEAM,
    color: '#c9e5f7',
    glow: 'rgba(201, 229, 247, 0.46)',
  },
  {
    label: 'Spark',
    key: '6',
    material: MATERIAL.SPARK,
    color: '#ffd76a',
    glow: 'rgba(255, 215, 106, 0.7)',
  },
  {
    label: 'Rock',
    key: '7',
    material: MATERIAL.SOLID,
    color: '#6f6870',
    glow: 'rgba(111, 104, 112, 0.28)',
  },
  {
    label: 'Wet Sand',
    key: '8',
    material: MATERIAL.WET_SAND,
    color: '#9b7849',
    glow: 'rgba(155, 120, 73, 0.36)',
  },
  {
    label: 'Erase',
    key: '0',
    material: MATERIAL.EMPTY,
    color: '#111827',
    glow: 'rgba(215, 228, 255, 0.18)',
  },
];

const canvas = document.getElementById('fieldCanvas');
const fatal = document.getElementById('fatal');
const materialHub = document.getElementById('materialHub');
const activePointers = new Map();
const burstEmitters = [];

let selectedMaterial = MATERIAL.FIRE;
let lastGrid = {
  x: Math.floor(GRID_WIDTH * 0.5),
  y: Math.floor(GRID_HEIGHT * 0.35),
};
let lastTap = {
  time: 0,
  x: lastGrid.x,
  y: lastGrid.y,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pack(material, life = 0, aux = 0) {
  return (material & 0xff) | ((life & 0xff) << 8) | ((aux & 0xff) << 16);
}

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function setSelectedMaterial(material) {
  selectedMaterial = material;

  for (const slot of materialHub.querySelectorAll('.material-slot[data-material]')) {
    const isSelected = Number(slot.dataset.material) === selectedMaterial;
    slot.classList.toggle('is-selected', isSelected);
    slot.setAttribute('aria-pressed', String(isSelected));
  }
}

function setupMaterialHub() {
  const fragment = document.createDocumentFragment();

  for (const option of MATERIAL_OPTIONS) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'material-slot';
    slot.dataset.material = String(option.material);
    slot.setAttribute('aria-pressed', 'false');
    slot.title = `${option.label} brush (${option.key})`;
    slot.style.setProperty('--slot-color', option.color);
    slot.style.setProperty('--slot-glow', option.glow);

    const swatch = document.createElement('span');
    swatch.className = 'material-swatch';
    swatch.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'material-name';
    name.textContent = option.label;

    const key = document.createElement('span');
    key.className = 'material-key';
    key.textContent = option.key;

    slot.append(swatch, name, key);
    fragment.append(slot);
  }

  const explosion = document.createElement('button');
  explosion.type = 'button';
  explosion.className = 'material-slot';
  explosion.dataset.action = 'explosion';
  explosion.title = 'Explosion at last pointer position (Space)';
  explosion.style.setProperty('--slot-color', '#ff3b45');
  explosion.style.setProperty('--slot-glow', 'rgba(255, 59, 69, 0.78)');
  explosion.innerHTML =
    '<span class="material-swatch" aria-hidden="true"></span><span class="material-name">Blast</span><span class="material-key">Space</span>';
  fragment.append(explosion);

  materialHub.append(fragment);
  materialHub.addEventListener('pointerdown', (event) => event.stopPropagation());
  materialHub.addEventListener('click', (event) => {
    const slot = event.target.closest('.material-slot');
    if (!slot) return;

    event.preventDefault();
    event.stopPropagation();

    if (slot.dataset.action === 'explosion') {
      addExplosion(lastGrid.x, lastGrid.y);
      return;
    }

    setSelectedMaterial(Number(slot.dataset.material));
  });

  setSelectedMaterial(selectedMaterial);
}

function showFatal(title, detail) {
  fatal.classList.add('is-visible');
  fatal.querySelector('strong').textContent = title;
  fatal.querySelector('span').textContent = detail;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  const width = Math.max(1, Math.floor(window.innerWidth * dpr));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function eventToGrid(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const ny = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);

  return {
    x: clamp(Math.floor(nx * GRID_WIDTH), 0, GRID_WIDTH - 1),
    y: clamp(Math.floor(ny * GRID_HEIGHT), 0, GRID_HEIGHT - 1),
  };
}

function pickPointerMaterial(event, nextPointerCount) {
  if (event.pointerType === 'touch' && nextPointerCount > 1) return MATERIAL.WATER;
  if (event.button === 2 || event.shiftKey) return MATERIAL.WATER;
  if (event.altKey) return MATERIAL.SAND;
  return selectedMaterial;
}

function seedInitialField() {
  const cells = new Uint32Array(CELL_COUNT);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const index = y * GRID_WIDTH + x;
      const terrain =
        GRID_HEIGHT -
        10 -
        Math.floor(Math.sin(x * 0.055) * 4) -
        Math.floor(Math.sin(x * 0.017) * 5);

      if (y >= terrain) {
        cells[index] = pack(MATERIAL.SOLID, 255, 0);
      } else if (y > terrain - 8 && Math.random() < 0.18) {
        cells[index] = pack(MATERIAL.SAND, 0, 0);
      } else {
        cells[index] = pack(MATERIAL.EMPTY, 0, 0);
      }
    }
  }

  for (let y = GRID_HEIGHT - 24; y < GRID_HEIGHT - 12; y += 1) {
    for (let x = 32; x < 76; x += 1) {
      if (Math.random() < 0.78) cells[y * GRID_WIDTH + x] = pack(MATERIAL.WATER, 0, 0);
    }
  }

  for (let y = 32; y < 90; y += 1) {
    for (let x = 132; x < 138; x += 1) {
      cells[y * GRID_WIDTH + x] = pack(MATERIAL.SOLID, 255, 0);
    }
  }

  const basin = {
    left: 164,
    right: 224,
    top: GRID_HEIGHT - 82,
    bottom: GRID_HEIGHT - 16,
    wall: 4,
    waterTop: GRID_HEIGHT - 44,
  };

  for (let y = basin.top; y <= basin.bottom; y += 1) {
    for (let x = basin.left; x <= basin.right; x += 1) {
      const isLeftWall = x < basin.left + basin.wall;
      const isRightWall = x > basin.right - basin.wall;
      const isBottom = y > basin.bottom - basin.wall;
      const index = y * GRID_WIDTH + x;

      if (isLeftWall || isRightWall || isBottom) {
        cells[index] = pack(MATERIAL.SOLID, 255, 0);
      } else if (y >= basin.waterTop && Math.random() < 0.9) {
        cells[index] = pack(MATERIAL.WATER, 0, randomSeed() & 255);
      } else if (!isLeftWall && !isRightWall && !isBottom) {
        cells[index] = pack(MATERIAL.EMPTY, 0, 0);
      }
    }
  }

  for (let y = basin.top - 14; y < basin.top - 4; y += 1) {
    for (let x = basin.left + 14; x < basin.left + 36; x += 1) {
      if (Math.random() < 0.62) {
        cells[y * GRID_WIDTH + x] = pack(MATERIAL.SAND, 0, randomSeed() & 255);
      }
    }
  }

  return cells;
}

function pushEmitter(words, count, emitter) {
  if (count >= MAX_EMITTERS) return count;

  const offset = count * EMITTER_WORDS;
  words[offset] = emitter.material >>> 0;
  words[offset + 1] = clamp(emitter.x, 0, GRID_WIDTH - 1) >>> 0;
  words[offset + 2] = clamp(emitter.y, 0, GRID_HEIGHT - 1) >>> 0;
  words[offset + 3] = clamp(emitter.radius, 1, 64) >>> 0;
  words[offset + 4] = clamp(emitter.strength, 0, 255) >>> 0;
  words[offset + 5] = emitter.seed >>> 0;
  words[offset + 6] = emitter.flags >>> 0;
  words[offset + 7] = 0;

  return count + 1;
}

function buildEmitterBuffer() {
  const words = new Uint32Array(MAX_EMITTERS * EMITTER_WORDS);
  let count = 0;
  const pointerCount = activePointers.size;

  for (const pointer of activePointers.values()) {
    const touchWater = pointer.pointerType === 'touch' && pointerCount > 1;
    const waterBrush = touchWater || pointer.material === MATERIAL.WATER;
    const hardBrush = pointer.material === MATERIAL.SOLID || pointer.material === MATERIAL.EMPTY;
    count = pushEmitter(words, count, {
      material: touchWater ? MATERIAL.WATER : pointer.material,
      x: pointer.x,
      y: pointer.y,
      radius: waterBrush ? TOUCH_WATER_RADIUS : BRUSH_RADIUS,
      strength: waterBrush || hardBrush ? 255 : 222,
      seed: pointer.seed,
      flags: 0,
    });
  }

  for (const burst of burstEmitters) {
    count = pushEmitter(words, count, {
      material: burst.material,
      x: burst.x,
      y: burst.y,
      radius: burst.radius,
      strength: burst.strength,
      seed: burst.seed,
      flags: burst.flags,
    });
  }

  return { words, count };
}

function addExplosion(x, y) {
  burstEmitters.push({
    material: MATERIAL.FIRE,
    x,
    y,
    radius: EXPLOSION_RADIUS,
    strength: 255,
    seed: randomSeed(),
    flags: EMITTER_FLAG_EXPLOSION,
    frames: EXPLOSION_FRAMES,
  });

  while (burstEmitters.length > 12) {
    burstEmitters.shift();
  }
}

function ageBurstEmitters() {
  for (let index = burstEmitters.length - 1; index >= 0; index -= 1) {
    burstEmitters[index].frames -= 1;
    burstEmitters[index].radius = Math.max(4, burstEmitters[index].radius - 1);
    if (burstEmitters[index].frames <= 0) {
      burstEmitters.splice(index, 1);
    }
  }
}

async function loadShader(device) {
  const response = await fetch('./noitaField.wgsl');
  if (!response.ok) {
    throw new Error(`Failed to load shader: HTTP ${response.status}`);
  }

  const shaderSource = await response.text();
  return device.createShaderModule({
    label: 'noita-material-field-shader',
    code: shaderSource,
  });
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

function resizeRenderTargets(state) {
  const width = Math.max(1, canvas.width);
  const height = Math.max(1, canvas.height);
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

async function createWebGpuState() {
  if (!navigator.gpu) {
    throw new Error('WebGPU is required. This test does not include a CPU, Canvas2D, or WebGL fallback.');
  }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) {
    throw new Error('No WebGPU adapter was found for this browser/device.');
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    showFatal('WebGPU device lost', info.message || 'The browser released the GPU device.');
  });

  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('The canvas could not create a WebGPU context.');
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  });

  const shaderModule = await loadShader(device);
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

  return {
    device,
    context,
    format,
    sceneFormat: HDR_SCENE_FORMAT,
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

function writeFrameData(state, emitterPayload) {
  const params = new Uint32Array(PARAM_WORDS);
  params[0] = GRID_WIDTH;
  params[1] = GRID_HEIGHT;
  params[2] = state.frame;
  params[3] = emitterPayload.count;
  params[4] = canvas.width;
  params[5] = canvas.height;
  params[6] = MAX_EMITTERS;
  params[7] = performance.now() >>> 0;

  state.device.queue.writeBuffer(state.paramsBuffer, 0, params);
  state.device.queue.writeBuffer(state.emitterBuffer, 0, emitterPayload.words);
}

function renderFrame(state) {
  resizeCanvas();
  resizeRenderTargets(state);

  const emitterPayload = buildEmitterBuffer();
  writeFrameData(state, emitterPayload);

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
  ageBurstEmitters();

  requestAnimationFrame(() => renderFrame(state));
}

function updatePointer(event) {
  const grid = eventToGrid(event);
  lastGrid = grid;

  const pointer = activePointers.get(event.pointerId);
  if (!pointer) return grid;

  pointer.x = grid.x;
  pointer.y = grid.y;
  pointer.material = pickPointerMaterial(event, activePointers.size);
  return grid;
}

function maybeAddDoubleTapExplosion(event, grid) {
  if (event.pointerType !== 'touch') return;

  const now = performance.now();
  const dx = grid.x - lastTap.x;
  const dy = grid.y - lastTap.y;
  if (now - lastTap.time < 320 && dx * dx + dy * dy < 144) {
    addExplosion(grid.x, grid.y);
    lastTap.time = 0;
    return;
  }

  lastTap = {
    time: now,
    x: grid.x,
    y: grid.y,
  };
}

function setupInput() {
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    const grid = eventToGrid(event);
    lastGrid = grid;
    maybeAddDoubleTapExplosion(event, grid);

    const nextPointerCount = activePointers.size + 1;
    activePointers.set(event.pointerId, {
      x: grid.x,
      y: grid.y,
      material: pickPointerMaterial(event, nextPointerCount),
      pointerType: event.pointerType,
      seed: randomSeed(),
    });
  });

  canvas.addEventListener('pointermove', (event) => {
    event.preventDefault();
    updatePointer(event);
  });

  const endPointer = (event) => {
    event.preventDefault();
    updatePointer(event);
    activePointers.delete(event.pointerId);
  };

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  window.addEventListener('blur', () => activePointers.clear());

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Digit1') setSelectedMaterial(MATERIAL.FIRE);
    if (event.code === 'Digit2') setSelectedMaterial(MATERIAL.WATER);
    if (event.code === 'Digit3') setSelectedMaterial(MATERIAL.SAND);
    if (event.code === 'Digit4') setSelectedMaterial(MATERIAL.SMOKE);
    if (event.code === 'Digit5') setSelectedMaterial(MATERIAL.STEAM);
    if (event.code === 'Digit6') setSelectedMaterial(MATERIAL.SPARK);
    if (event.code === 'Digit7') setSelectedMaterial(MATERIAL.SOLID);
    if (event.code === 'Digit8') setSelectedMaterial(MATERIAL.WET_SAND);
    if (event.code === 'Digit0') setSelectedMaterial(MATERIAL.EMPTY);

    if (event.code === 'Space') {
      event.preventDefault();
      addExplosion(lastGrid.x, lastGrid.y);
    }
  });
}

async function main() {
  resizeCanvas();
  setupMaterialHub();
  setupInput();

  try {
    const state = await createWebGpuState();
    requestAnimationFrame(() => renderFrame(state));
  } catch (error) {
    console.error(error);
    showFatal('WebGPU-only test failed', String(error.message || error));
  }
}

main();
