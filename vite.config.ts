import { readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "./",
  plugins: [localEffectPresetPlugin()],
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

async function readPresetJson(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  const match = source.match(/export const effectPresets = ([\s\S]*?) as const satisfies readonly EffectPreset\[\];/);

  if (!match) {
    throw new Error("Could not locate effect preset JSON in effectPresets.ts.");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
