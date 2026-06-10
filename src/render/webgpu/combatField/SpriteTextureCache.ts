// Responsibility: Load sprite texture URLs into reusable WebGPU textures.
// Owner: render/webgpu/combatField

export interface SpriteTextureResource {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly width: number;
  readonly height: number;
}

type SpriteTextureRecord =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly resource: SpriteTextureResource }
  | { readonly status: "failed" };

export class SpriteTextureCache {
  private readonly records = new Map<string, SpriteTextureRecord>();

  constructor(private readonly device: GPUDevice) {}

  preload(urls: Iterable<string>): void {
    for (const url of urls) {
      this.get(url);
    }
  }

  get(url: string): SpriteTextureResource | null {
    const record = this.records.get(url);

    if (record?.status === "ready") {
      return record.resource;
    }

    if (!record) {
      this.records.set(url, { status: "loading" });
      void this.load(url);
    }

    return null;
  }

  dispose(): void {
    for (const record of this.records.values()) {
      if (record.status === "ready") {
        record.resource.texture.destroy();
      }
    }

    this.records.clear();
  }

  private async load(url: string): Promise<void> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch sprite texture: ${url}`);
      }

      const image = await createImageBitmap(await response.blob());
      const width = image.width;
      const height = image.height;
      const texture = this.device.createTexture({
        label: `Sprite texture ${url}`,
        size: { width, height },
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.device.queue.copyExternalImageToTexture({ source: image }, { texture }, { width, height });
      image.close();
      this.records.set(url, {
        status: "ready",
        resource: {
          texture,
          view: texture.createView(),
          width,
          height,
        },
      });
    } catch {
      this.records.set(url, { status: "failed" });
    }
  }
}
