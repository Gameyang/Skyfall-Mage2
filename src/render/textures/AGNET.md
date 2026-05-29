# src/render/textures

texture atlas, texture metadata, GPU texture cache 경계를 둔다.

- Runtime image files live under `src/assets`.
- texture cache는 serializable state에 들어가면 안 된다.
