# Skyfall-Mage2

Official app source now lives under `src/`.

## Run

```bash
npm run dev
```

Open the Vite URL printed in the terminal.

## Build

```bash
npm run build
```

## Finish Work Hook

This repo uses versioned Git hooks from `.githooks`.

```bash
git config core.hooksPath .githooks
npm run finish -- -Message "chore: migrate material field to src"
```

`post-commit` pushes the current branch after every manual commit. `npm run finish` stages all changes, commits them, then pushes the current branch. Set `SKYFALL_SKIP_AUTO_PUSH=1` to skip automatic push for a single commit.

## Source Layout

```text
src/
  app/                         DOM bootstrap and app assembly
  features/material-field/     WebGPU material field feature
  rendering/webgpu/bloom/      reusable bloom postprocess renderer
  ui/styles/                   global app styles
```

The old `tech-tests/noita-webgpu/` page is now only a redirect to the official app.
