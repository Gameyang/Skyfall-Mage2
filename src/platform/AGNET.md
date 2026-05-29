# src/platform

브라우저, storage, asset path, WebGPU support 같은 platform adapter를 둔다.

- gameplay rule을 넣지 않는다.
- GitHub Pages base path와 local path 차이를 여기서 흡수한다.
- WebGPU availability와 device lost 처리를 명확히 제공한다.
