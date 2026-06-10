// Responsibility: Preload browser image resources before the first playable frame.
// Owner: platform

export interface ResourcePreloadProgress {
  readonly loaded: number;
  readonly total: number;
  readonly failed: number;
  readonly ratio: number;
}

export type ResourcePreloadProgressSink = (progress: ResourcePreloadProgress) => void;

export async function preloadImageResources(
  urls: readonly string[],
  onProgress: ResourcePreloadProgressSink,
): Promise<ResourcePreloadProgress> {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  let loaded = 0;
  let failed = 0;
  const total = uniqueUrls.length;

  const emit = (): ResourcePreloadProgress => {
    const progress = {
      loaded,
      total,
      failed,
      ratio: total === 0 ? 1 : loaded / total,
    };
    onProgress(progress);
    return progress;
  };

  emit();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const ok = await preloadImage(url);
      loaded += 1;
      if (!ok) {
        failed += 1;
      }
      emit();
    }),
  );

  return emit();
}

function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}
