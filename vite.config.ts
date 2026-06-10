import { readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "./",
  plugins: [localEffectPresetPlugin(), localSheetDefinitionPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});

function localEffectPresetPlugin(): Plugin {
  const presetPath = resolve(projectRoot, "src/content/effects/effectPresets.ts");

  return {
    name: "skyfall-local-effect-presets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__local/effects/presets", async (request, response) => {
        if (!isLoopbackRequest(request)) {
          sendText(response, 403, "Local effect presets are available from loopback only.");
          return;
        }

        try {
          if (request.method === "GET") {
            sendJson(response, 200, await readPresetJson(presetPath));
            return;
          }

          if (request.method === "POST") {
            const body = await readRequestBody(request);
            const presets = sanitizePresetPayload(JSON.parse(body));
            await writeFile(presetPath, formatPresetSource(presets), "utf8");
            sendJson(response, 200, { ok: true });
            return;
          }

          sendText(response, 405, "Method not allowed.");
        } catch (error) {
          sendText(response, 400, error instanceof Error ? error.message : "Invalid effect preset request.");
        }
      });
    },
  };
}

function localSheetDefinitionPlugin(): Plugin {
  const definitionPath = resolve(projectRoot, "src/content/sheets/sheetLibrary.ts");

  return {
    name: "skyfall-local-sheet-definitions",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__local/sheets/definitions", async (request, response) => {
        if (!isLoopbackRequest(request)) {
          sendText(response, 403, "Local sheet definitions are available from loopback only.");
          return;
        }

        try {
          if (request.method === "GET") {
            sendJson(response, 200, await readSheetDefinitionJson(definitionPath));
            return;
          }

          if (request.method === "POST") {
            const body = await readRequestBody(request);
            const definitions = sanitizeSheetDefinitionPayload(JSON.parse(body));
            await writeFile(definitionPath, formatSheetDefinitionSource(definitions), "utf8");
            sendJson(response, 200, { ok: true });
            return;
          }

          sendText(response, 405, "Method not allowed.");
        } catch (error) {
          sendText(response, 400, error instanceof Error ? error.message : "Invalid sheet definition request.");
        }
      });
    },
  };
}

async function readPresetJson(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  const match = source.match(/export const effectPresets = ([\s\S]*?) as const satisfies readonly EffectPreset\[\];/);

  if (!match) {
    throw new Error("Could not locate effect preset JSON in effectPresets.ts.");
  }

  return JSON.parse(match[1]);
}

async function readSheetDefinitionJson(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  const match = source.match(/export const sheetDefinitions = ([\s\S]*?) as const satisfies readonly SheetDefinition\[\];/);

  if (!match) {
    throw new Error("Could not locate sheet definition JSON in sheetLibrary.ts.");
  }

  return JSON.parse(match[1]);
}

function sanitizePresetPayload(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Effect preset payload must be an array.");
  }

  if (JSON.stringify(value).length > 400_000) {
    throw new Error("Effect preset payload is too large.");
  }

  const ids = new Set<string>();

  for (const preset of value) {
    if (!isRecord(preset)) {
      throw new Error("Each effect preset must be an object.");
    }

    const id = preset.id;

    if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error("Effect preset ids must be lowercase slugs.");
    }

    if (ids.has(id)) {
      throw new Error(`Duplicate effect preset id: ${id}`);
    }

    ids.add(id);

    if (!Array.isArray(preset.layers)) {
      throw new Error(`Effect preset ${id} must include a layers array.`);
    }
  }

  return JSON.parse(JSON.stringify(value)) as unknown[];
}

function sanitizeSheetDefinitionPayload(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Sheet definition payload must be an array.");
  }

  if (JSON.stringify(value).length > 2_000_000) {
    throw new Error("Sheet definition payload is too large.");
  }

  const ids = new Set<string>();

  for (const definition of value) {
    if (!isRecord(definition)) {
      throw new Error("Each sheet definition must be an object.");
    }

    const id = definition.id;

    if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error("Sheet definition ids must be lowercase slugs.");
    }

    if (ids.has(id)) {
      throw new Error(`Duplicate sheet definition id: ${id}`);
    }

    ids.add(id);

    if (typeof definition.label !== "string") {
      throw new Error(`Sheet definition ${id} must include a label.`);
    }

    if (!isRecord(definition.asset)) {
      throw new Error(`Sheet definition ${id} must include an asset ref.`);
    }

    if (
      !["effects", "enemies", "items", "projectiles", "skins", "ui"].includes(String(definition.asset.scope)) ||
      typeof definition.asset.key !== "string"
    ) {
      throw new Error(`Sheet definition ${id} has an invalid asset ref.`);
    }

    if (!isRecord(definition.rect)) {
      throw new Error(`Sheet definition ${id} must include a rect.`);
    }

    for (const key of ["x", "y", "width", "height"]) {
      if (typeof definition.rect[key] !== "number" || !Number.isFinite(definition.rect[key])) {
        throw new Error(`Sheet definition ${id} has an invalid rect ${key}.`);
      }
    }

    if (typeof definition.frameCount !== "number" || definition.frameCount < 1) {
      throw new Error(`Sheet definition ${id} must include a positive frameCount.`);
    }

    if (
      "columns" in definition &&
      (typeof definition.columns !== "number" || !Number.isFinite(definition.columns) || definition.columns < 1)
    ) {
      throw new Error(`Sheet definition ${id} has an invalid columns value.`);
    }

    if (
      "rows" in definition &&
      (typeof definition.rows !== "number" || !Number.isFinite(definition.rows) || definition.rows < 1)
    ) {
      throw new Error(`Sheet definition ${id} has an invalid rows value.`);
    }

    if ("frames" in definition) {
      if (!Array.isArray(definition.frames)) {
        throw new Error(`Sheet definition ${id} has an invalid frames value.`);
      }

      const frameIds = new Set<string>();

      for (const frame of definition.frames) {
        if (!isRecord(frame)) {
          throw new Error(`Sheet definition ${id} frame entries must be objects.`);
        }

        if (typeof frame.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frame.id)) {
          throw new Error(`Sheet definition ${id} has an invalid frame id.`);
        }

        if (frameIds.has(frame.id)) {
          throw new Error(`Sheet definition ${id} has duplicate frame id ${frame.id}.`);
        }

        frameIds.add(frame.id);

        if (typeof frame.label !== "string") {
          throw new Error(`Sheet definition ${id} frame ${frame.id} must include a label.`);
        }

        assertRectLike(frame.rect, `Sheet definition ${id} frame ${frame.id} rect`);
        assertRectLike(frame.cellRect, `Sheet definition ${id} frame ${frame.id} cellRect`);
        assertRectLike(frame.placement, `Sheet definition ${id} frame ${frame.id} placement`);
        assertPointLike(frame.pivot, `Sheet definition ${id} frame ${frame.id} pivot`);
      }
    }

    if ("clips" in definition) {
      if (!Array.isArray(definition.clips)) {
        throw new Error(`Sheet definition ${id} has an invalid clips value.`);
      }

      const clipIds = new Set<string>();
      const frameIds = new Set(
        Array.isArray(definition.frames)
          ? definition.frames
              .filter((frame): frame is Record<string, unknown> => isRecord(frame))
              .map((frame) => frame.id)
              .filter((frameId): frameId is string => typeof frameId === "string")
          : [],
      );

      for (const clip of definition.clips) {
        if (!isRecord(clip)) {
          throw new Error(`Sheet definition ${id} clip entries must be objects.`);
        }

        if (typeof clip.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clip.id)) {
          throw new Error(`Sheet definition ${id} has an invalid clip id.`);
        }

        if (clipIds.has(clip.id)) {
          throw new Error(`Sheet definition ${id} has duplicate clip id ${clip.id}.`);
        }

        clipIds.add(clip.id);

        if (typeof clip.label !== "string") {
          throw new Error(`Sheet definition ${id} clip ${clip.id} must include a label.`);
        }

        if (!Array.isArray(clip.frameIds) || !clip.frameIds.every((frameId) => typeof frameId === "string")) {
          throw new Error(`Sheet definition ${id} clip ${clip.id} must include string frameIds.`);
        }

        if (frameIds.size > 0 && !clip.frameIds.every((frameId) => frameIds.has(frameId))) {
          throw new Error(`Sheet definition ${id} clip ${clip.id} references a missing frame.`);
        }

        if (
          "frameMs" in clip &&
          (typeof clip.frameMs !== "number" || !Number.isFinite(clip.frameMs) || clip.frameMs < 1)
        ) {
          throw new Error(`Sheet definition ${id} clip ${clip.id} has an invalid frameMs.`);
        }

        if ("frameMode" in clip && !["loop", "once", "hold"].includes(String(clip.frameMode))) {
          throw new Error(`Sheet definition ${id} clip ${clip.id} has an invalid frameMode.`);
        }
      }
    }

    if (typeof definition.frameMs !== "number" || definition.frameMs < 1) {
      throw new Error(`Sheet definition ${id} must include a positive frameMs.`);
    }

    if (!["loop", "once", "hold"].includes(String(definition.frameMode))) {
      throw new Error(`Sheet definition ${id} has an invalid frameMode.`);
    }

    if (!Array.isArray(definition.tags) || !definition.tags.every((tag) => typeof tag === "string")) {
      throw new Error(`Sheet definition ${id} must include string tags.`);
    }
  }

  return JSON.parse(JSON.stringify(value)) as unknown[];
}

function formatPresetSource(presets: unknown[]): string {
  return `// Responsibility: Store editable effect presets used by the local effect tool and render snapshots.
// Owner: content/effects

import type { EffectPreset } from "./effectPresetTypes";

// @effect-presets-start
export const effectPresets = ${JSON.stringify(presets, null, 2)} as const satisfies readonly EffectPreset[];
// @effect-presets-end

export function getEffectPreset(id: string): EffectPreset {
  const preset = effectPresets.find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(\`Missing effect preset: \${id}\`);
  }

  return preset;
}
`;
}

function formatSheetDefinitionSource(definitions: unknown[]): string {
  return `// Responsibility: Store editable sprite-sheet frame and crop metadata.
// Owner: content/sheets

import type { SheetAssetRef, SheetDefinition } from "./sheetTypes";

// @sheet-definitions-start
export const sheetDefinitions = ${JSON.stringify(definitions, null, 2)} as const satisfies readonly SheetDefinition[];
// @sheet-definitions-end

export function getSheetDefinition(id: string): SheetDefinition {
  const definition = findSheetDefinition(id);

  if (!definition) {
    throw new Error(\`Missing sheet definition: \${id}\`);
  }

  return definition;
}

export function findSheetDefinition(id: string | null | undefined): SheetDefinition | null {
  return sheetDefinitions.find((definition) => definition.id === id) ?? null;
}

export function findSheetDefinitionsByAsset(asset: SheetAssetRef): readonly SheetDefinition[] {
  return sheetDefinitions.filter(
    (definition) => definition.asset.scope === asset.scope && definition.asset.key === asset.key,
  );
}
`;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress ?? "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end(body);
}

function assertRectLike(value: unknown, label: string): void {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  for (const key of ["x", "y", "width", "height"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new Error(`${label} has an invalid ${key}.`);
    }
  }
}

function assertPointLike(value: unknown, label: string): void {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  for (const key of ["x", "y"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new Error(`${label} has an invalid ${key}.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
