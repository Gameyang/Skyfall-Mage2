const GRID_WIDTH = 256;
const GRID_HEIGHT = 144;
const WORKGROUP_SIZE = 8;
const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;
const CELL_BYTES = Uint32Array.BYTES_PER_ELEMENT;

const MATERIAL = {
  EMPTY: 0,
  SOLID: 1,
  SAND: 2,
  WATER: 3,
  FIRE: 4,
  SMOKE: 5,
  SPARK: 6,
};

const BRUSH_RADIUS = 5;
const EXPLOSION_RADIUS = 18;

const canvas = document.getElementById('fieldCanvas');
const unsupported = document.getElementById('unsupported');

const pointer = {
  active: false,
  x: Math.floor(GRID_WIDTH * 0.5),
  y: Math.floor(GRID_HEIGHT * 0.35),
  material: MATERIAL.FIRE,
};

let explosionFrames = 0;
let explosionX = Math.floor(GRID_WIDTH * 0.5);
let explosionY = Math.floor(GRID_HEIGHT * 0.5);

function pack(material, life = 0, aux = 0) {
  return (material & 0xff) | ((life & 0xff) << 8) | ((aux & 0xff) << 16);
}

function showUnsupported(message) {
  unsupported.classList.add('is-visible');
  unsupported.querySelector('div').innerHTML = message;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(window.innerWidth * dpr));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function pointerToGrid(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const ny = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  pointer.x = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor(nx * GRID_WIDTH)));
  pointer.y = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor(ny * GRID_HEIGHT)));
}

function pickPointerMaterial(event) {
  if (event.button === 2 || event.shiftKey) return MATERIAL.WATER;
  if (event.altKey) return MATERIAL.SAND;
  return pointer.material;
}

function seedInitialField() {
  const cells = new Uint32Array(CELL_COUNT);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const index = y * GRID_WIDTH + x;
      const terrain =
        GRID_HEIGHT - 10 -
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

  return cells;
}

async function createWebGpuState() {
  if (!navigator.gpu) {
    showUnsupported('<strong>WebGPU를 사용할 수 없습니다.</strong><br />최신 Chrome 또는 Edge에서 HTTPS/GitHub Pages로 실행해 주세요.');
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    showUnsupported('<strong>WebGPU adapter를 찾지 못했습니다.</strong><br />브라우저 설정 또는 GPU 드라이버 상태를 확인해 주세요.');
    return null;
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    showUnsupported(`<strong>WebGPU device lost.</strong><br />${info.message || '브라우저에서 GPU 장치를 잃었습니다.'}`);
  });

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  });

  const shaderSource = await fetch('./noitaField.wgsl').then((response) => {
    if (!response.ok) throw new Error(`Failed to load shader: ${response.status}`);
    return response.text();
  });
  const shaderModule = device.createShaderModule({ code: shaderSource });

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
    size: Uint32Array.BYTES_PER_ELEMENT * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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

  const computePipeline = device.createComputePipeline({
    label: 'material-simulation-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
    compute: {
      module: shaderModule,
      entryPoint: 'simulate',
    },
  });

  const renderPipeline = device.createRenderPipeline({
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

  const computeBindGroups = [
    device.createBindGroup({
      label: 'compute-a-to-b',
      layout: computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: cellBuffers[0] } },
        { binding: 1, resource: { buffer: cellBuffers[1] } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    }),
    device.createBindGroup({
      label: 'compute-b-to-a',
      layout: computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: cellBuffers[1] } },
        { binding: 1, resource: { buffer: cellBuffers[0] } },
        { binding: 2, resource: { buffer: paramsBuffer } },
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
    computePipeline,
    renderPipeline,
    computeBindGroups,
    renderBindGroups,
    paramsBuffer,
    currentBufferIndex: 0,
    frame: 0,
  };
}

function writeParams(state) {
  const params = new Uint32Array(16);
  params[0] = GRID_WIDTH;
  params[1] = GRID_HEIGHT;
  params[2] = state.frame;
  params[3] = pointer.active ? 1 : 0;
  params[4] = pointer.x;
  params[5] = pointer.y;
  params[6] = BRUSH_RADIUS;
  params[7] = pointer.material;
  params[8] = explosionFrames > 0 ? 1 : 0;
  params[9] = explosionX;
  params[10] = explosionY;
  params[11] = EXPLOSION_RADIUS;
  params[12] = canvas.width;
  params[13] = canvas.height;
  state.device.queue.writeBuffer(state.paramsBuffer, 0, params);
}

function frame(state) {
  resizeCanvas();
  writeParams(state);

  const encoder = state.device.createCommandEncoder();
  const computePass = encoder.beginComputePass();
  computePass.setPipeline(state.computePipeline);
  computePass.setBindGroup(0, state.computeBindGroups[state.currentBufferIndex]);
  computePass.dispatchWorkgroups(
    Math.ceil(GRID_WIDTH / WORKGROUP_SIZE),
    Math.ceil(GRID_HEIGHT / WORKGROUP_SIZE),
  );
  computePass.end();

  state.currentBufferIndex = 1 - state.currentBufferIndex;

  const textureView = state.context.getCurrentTexture().createView();
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.02, g: 0.02, b: 0.03, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });
  renderPass.setPipeline(state.renderPipeline);
  renderPass.setBindGroup(0, state.renderBindGroups[state.currentBufferIndex]);
  renderPass.draw(3, 1, 0, 0);
  renderPass.end();

  state.device.queue.submit([encoder.finish()]);
  state.frame += 1;
  if (explosionFrames > 0) explosionFrames -= 1;

  requestAnimationFrame(() => frame(state));
}

function setupInput() {
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointerToGrid(event);
    pointer.material = pickPointerMaterial(event);
    pointer.active = true;
  });

  canvas.addEventListener('pointermove', (event) => {
    pointerToGrid(event);
    if (pointer.active) {
      pointer.material = pickPointerMaterial(event);
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    pointerToGrid(event);
    pointer.active = false;
  });

  canvas.addEventListener('pointercancel', () => {
    pointer.active = false;
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Digit1') pointer.material = MATERIAL.FIRE;
    if (event.code === 'Digit2') pointer.material = MATERIAL.WATER;
    if (event.code === 'Digit3') pointer.material = MATERIAL.SAND;
    if (event.code === 'Space') {
      event.preventDefault();
      explosionX = pointer.x;
      explosionY = pointer.y;
      explosionFrames = 4;
    }
  });
}

async function main() {
  resizeCanvas();
  setupInput();

  try {
    const state = await createWebGpuState();
    if (!state) return;
    requestAnimationFrame(() => frame(state));
  } catch (error) {
    console.error(error);
    showUnsupported(`<strong>WebGPU 테스트 초기화 실패</strong><br />${String(error.message || error)}`);
  }
}

main();
