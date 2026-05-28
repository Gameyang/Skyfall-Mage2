const DEFAULT_OPTIONS = {
  enabled: true,
  threshold: 0.72,
  intensity: 0.75,
  radius: 1.0,
  levels: 5,
  bloomFormat: 'rgba8unorm',
  clearColor: { r: 0.02, g: 0.02, b: 0.03, a: 1 },
};

const PARAM_FLOATS = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function levelSize(baseWidth, baseHeight, level) {
  const divisor = 2 ** (level + 1);
  return {
    width: Math.max(1, Math.floor(baseWidth / divisor)),
    height: Math.max(1, Math.floor(baseHeight / divisor)),
  };
}

function createFullscreenPipeline(device, shaderModule, layout, targetFormat, entryPoint, label) {
  return device.createRenderPipelineAsync({
    label,
    layout: device.createPipelineLayout({
      label: `${label}-layout`,
      bindGroupLayouts: [layout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
    },
    fragment: {
      module: shaderModule,
      entryPoint,
      targets: [{ format: targetFormat }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}

async function loadShaderModule(device) {
  const response = await fetch('./bloomPostProcess.wgsl');
  if (!response.ok) {
    throw new Error(`Failed to load bloom shader: HTTP ${response.status}`);
  }

  return device.createShaderModule({
    label: 'bloom-postprocess-shader',
    code: await response.text(),
  });
}

export async function createBloomPostProcess(device, outputFormat, options = {}) {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    clearColor: {
      ...DEFAULT_OPTIONS.clearColor,
      ...(options.clearColor || {}),
    },
  };
  const shaderModule = await loadShaderModule(device);
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'bloom-postprocess-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  device.pushErrorScope('validation');
  let pipelines;
  try {
    pipelines = await Promise.all([
      createFullscreenPipeline(
        device,
        shaderModule,
        bindGroupLayout,
        resolvedOptions.bloomFormat,
        'brightDownsampleFragment',
        'bloom-bright-downsample-pipeline',
      ),
      createFullscreenPipeline(
        device,
        shaderModule,
        bindGroupLayout,
        resolvedOptions.bloomFormat,
        'downsampleFragment',
        'bloom-downsample-pipeline',
      ),
      createFullscreenPipeline(
        device,
        shaderModule,
        bindGroupLayout,
        resolvedOptions.bloomFormat,
        'upsampleFragment',
        'bloom-upsample-pipeline',
      ),
      createFullscreenPipeline(
        device,
        shaderModule,
        bindGroupLayout,
        outputFormat,
        'finalCompositeFragment',
        'bloom-final-composite-pipeline',
      ),
    ]);
  } catch (error) {
    await device.popErrorScope();
    throw error;
  }

  const validationError = await device.popErrorScope();
  if (validationError) {
    throw new Error(validationError.message);
  }

  return new BloomPostProcess(device, bindGroupLayout, pipelines, resolvedOptions);
}

class BloomPostProcess {
  constructor(device, bindGroupLayout, pipelines, options) {
    this.device = device;
    this.bindGroupLayout = bindGroupLayout;
    this.pipelines = {
      brightDownsample: pipelines[0],
      downsample: pipelines[1],
      upsample: pipelines[2],
      finalComposite: pipelines[3],
    };
    this.options = {
      ...options,
      levels: clamp(Math.floor(options.levels), 1, 8),
    };
    this.width = 0;
    this.height = 0;
    this.downsampleTextures = [];
    this.downsampleViews = [];
    this.upsampleTextures = [];
    this.upsampleViews = [];
    this.downsampleBindGroups = [];
    this.upsampleBindGroups = [];

    this.sampler = device.createSampler({
      label: 'bloom-linear-sampler',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      magFilter: 'linear',
      minFilter: 'linear',
    });
    this.paramsBuffer = device.createBuffer({
      label: 'bloom-params',
      size: Float32Array.BYTES_PER_ELEMENT * PARAM_FLOATS,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.blackTexture = device.createTexture({
      label: 'bloom-black-texture',
      size: { width: 1, height: 1 },
      format: this.options.bloomFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });
    this.blackView = this.blackTexture.createView();

    this.writeParams();
  }

  writeParams() {
    const params = new Float32Array(PARAM_FLOATS);
    params[0] = this.options.threshold;
    params[1] = this.options.intensity;
    params[2] = this.options.radius;
    params[3] = this.options.enabled ? 1 : 0;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, params);
  }

  resize(width, height) {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (this.width === nextWidth && this.height === nextHeight) return;

    this.destroyResizableResources();
    this.width = nextWidth;
    this.height = nextHeight;

    const levelCount = this.calculateLevelCount(nextWidth, nextHeight);
    for (let level = 0; level < levelCount; level += 1) {
      const size = levelSize(nextWidth, nextHeight, level);
      const downsampleTexture = this.createBloomTexture(`bloom-downsample-${level}`, size);
      const upsampleTexture = this.createBloomTexture(`bloom-upsample-${level}`, size);

      this.downsampleTextures.push(downsampleTexture);
      this.downsampleViews.push(downsampleTexture.createView());
      this.upsampleTextures.push(upsampleTexture);
      this.upsampleViews.push(upsampleTexture.createView());
    }

    this.rebuildStaticBindGroups();
  }

  calculateLevelCount(width, height) {
    let count = 1;
    let currentWidth = Math.max(1, Math.floor(width / 2));
    let currentHeight = Math.max(1, Math.floor(height / 2));

    while (count < this.options.levels && (currentWidth > 1 || currentHeight > 1)) {
      currentWidth = Math.max(1, Math.floor(currentWidth / 2));
      currentHeight = Math.max(1, Math.floor(currentHeight / 2));
      count += 1;
    }

    return count;
  }

  createBloomTexture(label, size) {
    return this.device.createTexture({
      label,
      size,
      format: this.options.bloomFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
  }

  rebuildStaticBindGroups() {
    this.downsampleBindGroups = this.downsampleViews.map((view, index) => {
      if (index === 0) return null;
      return this.createBindGroup(`bloom-downsample-bind-group-${index}`, this.downsampleViews[index - 1]);
    });

    this.upsampleBindGroups = this.upsampleViews.map((view, index) => {
      if (index >= this.upsampleViews.length - 1) return null;
      const lowView =
        index + 1 === this.upsampleViews.length - 1
          ? this.downsampleViews[index + 1]
          : this.upsampleViews[index + 1];
      return this.createBindGroup(`bloom-upsample-bind-group-${index}`, this.downsampleViews[index], lowView);
    });
  }

  createBindGroup(label, primaryView, secondaryView = this.blackView) {
    return this.device.createBindGroup({
      label,
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: primaryView },
        { binding: 1, resource: secondaryView },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  render(encoder, sourceView, destinationView) {
    if (!this.downsampleViews.length) {
      this.resize(this.width || 1, this.height || 1);
    }

    this.renderSinglePass(
      encoder,
      'bloom-bright-downsample-pass',
      this.downsampleViews[0],
      this.pipelines.brightDownsample,
      this.createBindGroup('bloom-bright-downsample-bind-group', sourceView),
    );

    for (let index = 1; index < this.downsampleViews.length; index += 1) {
      this.renderSinglePass(
        encoder,
        `bloom-downsample-pass-${index}`,
        this.downsampleViews[index],
        this.pipelines.downsample,
        this.downsampleBindGroups[index],
      );
    }

    for (let index = this.upsampleViews.length - 2; index >= 0; index -= 1) {
      this.renderSinglePass(
        encoder,
        `bloom-upsample-pass-${index}`,
        this.upsampleViews[index],
        this.pipelines.upsample,
        this.upsampleBindGroups[index],
      );
    }

    const bloomView =
      this.upsampleViews.length > 1 ? this.upsampleViews[0] : this.downsampleViews[0];
    this.renderSinglePass(
      encoder,
      'bloom-final-composite-pass',
      destinationView,
      this.pipelines.finalComposite,
      this.createBindGroup('bloom-final-composite-bind-group', sourceView, bloomView),
      this.options.clearColor,
    );
  }

  renderSinglePass(encoder, label, targetView, pipeline, bindGroup, clearValue = { r: 0, g: 0, b: 0, a: 1 }) {
    const pass = encoder.beginRenderPass({
      label,
      colorAttachments: [
        {
          view: targetView,
          clearValue,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  destroyResizableResources() {
    for (const texture of this.downsampleTextures) texture.destroy();
    for (const texture of this.upsampleTextures) texture.destroy();
    this.downsampleTextures = [];
    this.downsampleViews = [];
    this.upsampleTextures = [];
    this.upsampleViews = [];
    this.downsampleBindGroups = [];
    this.upsampleBindGroups = [];
  }

  destroy() {
    this.destroyResizableResources();
    this.blackTexture.destroy();
    this.paramsBuffer.destroy();
  }
}
