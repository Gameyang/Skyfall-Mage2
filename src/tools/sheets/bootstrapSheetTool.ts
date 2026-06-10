// Responsibility: Bootstrap the local-only shared sprite-sheet metadata editor.
// Owner: tools/sheets

import { sheetDefinitions } from "../../content/sheets/sheetLibrary";
import { resolveSheetAssetUrl } from "../../content/sheets/sheetResolver";
import type {
  SheetAnimationClip,
  SheetAssetScope,
  SheetDefinition,
  SheetFrameDefinition,
  SheetFrameMode,
} from "../../content/sheets/sheetTypes";
import { assetUrls, skinAssetUrls } from "../../platform/assets";
import { createSheetMultiRectEditor, normalizeEditableSheetRect } from "./SheetRectEditor";
import { analyzeSpriteSheetUrl, createGridFrameDefinitions } from "./spriteAutoMapper";
import "./sheetsTool.css";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

type SheetDefinitionDraft = Mutable<SheetDefinition>;
type SheetFrameDefinitionDraft = Mutable<SheetFrameDefinition>;
type SheetAnimationClipDraft = Mutable<SheetAnimationClip>;

interface AssetOption {
  readonly scope: SheetAssetScope;
  readonly key: string;
  readonly url: string;
}

const bundledAssetScopes: readonly Exclude<SheetAssetScope, "skins">[] = [
  "effects",
  "enemies",
  "items",
  "projectiles",
  "ui",
];
const assetScopes: readonly SheetAssetScope[] = [...bundledAssetScopes, "skins"];
const frameModes: readonly SheetFrameMode[] = ["loop", "once", "hold"];

export async function bootstrapSheetTool(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");

  if (!root) {
    throw new Error("Missing #app root element.");
  }

  await new SheetToolApp(root).init();
}

class SheetToolApp {
  private definitions: SheetDefinitionDraft[] = [];
  private selectedId = "";
  private selectedClipId = "";
  private previewFrameHandle = 0;
  private previewStartMs = 0;

  private readonly assetOptions = collectAssetOptions();
  private readonly list = document.createElement("div");
  private readonly stage = document.createElement("section");
  private readonly inspector = document.createElement("aside");
  private readonly status = document.createElement("div");
  private readonly previewCanvas = document.createElement("canvas");
  private readonly previewMeta = document.createElement("span");
  private readonly previewImagesByUrl = new Map<string, HTMLImageElement>();

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.definitions = await loadSheetDefinitions();
    this.selectedId = this.definitions[0]?.id ?? "";
    this.previewCanvas.className = "sheet-preview-canvas";
    this.previewCanvas.width = 240;
    this.previewCanvas.height = 240;
    this.previewMeta.className = "sheet-preview-meta";
    this.renderShell();
    this.renderAll();
    this.previewStartMs = performance.now();
    this.previewFrameHandle = requestAnimationFrame((time) => this.tickPreview(time));
  }

  private renderShell(): void {
    const frame = document.createElement("main");
    frame.className = "sheet-tool";

    const library = document.createElement("aside");
    library.className = "sheet-library";
    const header = document.createElement("div");
    header.className = "sheet-library-header";
    const title = document.createElement("h1");
    title.textContent = "Sheet Lab";
    const actions = document.createElement("div");
    actions.className = "sheet-action-row";
    actions.append(
      createButton("New", () => this.createDefinition()),
      createButton("Duplicate", () => this.duplicateDefinition()),
      createButton("Save", () => void this.saveDefinitions()),
    );
    this.list.className = "sheet-list";
    header.append(title, actions);
    library.append(header, this.list);

    this.stage.className = "sheet-stage";
    this.inspector.className = "sheet-inspector";
    this.status.className = "sheet-status";

    frame.append(library, this.stage, this.inspector);
    this.root.replaceChildren(frame, this.status);
  }

  private renderAll(): void {
    this.renderList();
    this.renderStage();
    this.renderInspector();
  }

  private renderList(): void {
    const items = this.definitions.map((definition) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sheet-list-item";
      button.dataset.active = String(definition.id === this.selectedId);
      button.addEventListener("click", () => {
        this.selectedId = definition.id;
        this.ensureSelectedClip(definition);
        this.previewStartMs = performance.now();
        this.renderAll();
      });

      const label = document.createElement("strong");
      label.textContent = definition.label;
      const meta = document.createElement("span");
      meta.textContent = `${definition.asset.scope}/${definition.asset.key}`;
      button.append(label, meta);
      return button;
    });
    this.list.replaceChildren(...items);
  }

  private renderStage(): void {
    const definition = this.getSelectedDefinition();

    if (!definition) {
      this.stage.replaceChildren(createEmptyState("No sheet selected."));
      return;
    }

    definition.rect = normalizeEditableSheetRect(definition.rect);
    this.ensureDefinitionFrames(definition);
    this.ensureSelectedClip(definition);

    const assetUrl = resolveSheetAssetUrl(definition.asset);
    const content = document.createElement("div");
    content.className = "sheet-stage-content";
    const header = document.createElement("div");
    header.className = "sheet-stage-header";
    const title = document.createElement("h2");
    title.textContent = definition.label;
    const meta = document.createElement("span");
    meta.textContent = `${definition.frameCount} frames / ${definition.clips?.length ?? 0} clips / ${
      definition.columns ?? definition.frameCount
    } x ${definition.rows ?? 1} / ${definition.frameMs} ms`;
    header.append(title, meta);
    content.append(
      header,
      this.createPreviewSection(definition, assetUrl),
      this.createFrameRectEditorGrid(definition, assetUrl),
    );
    this.stage.replaceChildren(content);
  }

  private renderInspector(): void {
    const definition = this.getSelectedDefinition();

    if (!definition) {
      this.inspector.replaceChildren();
      return;
    }

    this.ensureDefinitionFrames(definition);
    this.ensureSelectedClip(definition);
    const selectedClip = this.getSelectedClip(definition);

    const content = document.createElement("div");
    content.className = "sheet-inspector-content";
    content.append(
      createSection("Identity", [
        createTextControl("Id", definition.id, (value) => {
          const nextId = slugify(value) || definition.id;
          definition.id = nextId;
          this.selectedId = nextId;
          this.renderList();
        }),
        createTextControl("Label", definition.label, (value) => {
          definition.label = value;
          this.renderList();
          this.renderStage();
        }),
      ]),
      createSection("Asset", [
        createSelectControl("Scope", assetScopes, definition.asset.scope, (value) => {
          definition.asset.scope = value;
          definition.asset.key = this.getAssetOptionsForScope(value)[0]?.key ?? "";
          definition.rect = { x: 0, y: 0, width: 1, height: 1 };
          this.rebuildGridFrames(definition);
          this.repairClipFrameIds(definition);
          this.previewStartMs = performance.now();
          this.renderAll();
        }),
        createSelectControl("Key", this.getAssetKeysForScope(definition.asset.scope), definition.asset.key, (value) => {
          definition.asset.key = value;
          definition.rect = { x: 0, y: 0, width: 1, height: 1 };
          this.rebuildGridFrames(definition);
          this.repairClipFrameIds(definition);
          this.previewStartMs = performance.now();
          this.renderAll();
        }),
      ]),
      createSection("Frames", [
        createNumberControl("Frame Count", definition.frameCount, 1, 1, 256, (value) => {
          definition.frameCount = Math.max(1, Math.floor(value));
          if ((definition.columns ?? 1) * (definition.rows ?? 1) < definition.frameCount) {
            definition.columns = definition.frameCount;
            definition.rows = 1;
          }
          this.rebuildGridFrames(definition);
          this.repairClipFrameIds(definition);
          this.previewStartMs = performance.now();
          this.renderAll();
        }),
        createNumberControl("Columns", definition.columns ?? definition.frameCount, 1, 1, 256, (value) => {
          definition.columns = Math.max(1, Math.floor(value));
          this.rebuildGridFrames(definition);
          this.repairClipFrameIds(definition);
          this.previewStartMs = performance.now();
          this.renderAll();
        }),
        createNumberControl("Rows", definition.rows ?? 1, 1, 1, 64, (value) => {
          definition.rows = Math.max(1, Math.floor(value));
          this.rebuildGridFrames(definition);
          this.repairClipFrameIds(definition);
          this.previewStartMs = performance.now();
          this.renderAll();
        }),
        createNumberControl("Frame Ms", definition.frameMs, 1, 1, 5_000, (value) => {
          definition.frameMs = Math.max(1, value);
          this.previewStartMs = performance.now();
          this.renderStage();
        }),
        createSelectControl("Frame Mode", frameModes, definition.frameMode, (value) => {
          definition.frameMode = value;
          this.previewStartMs = performance.now();
        }),
        createOptionalNumberControl("Move Frames", definition.movementFrameCount, 1, 0, 256, (value) => {
          definition.movementFrameCount = value === null ? undefined : Math.max(0, Math.floor(value));
        }),
        createOptionalNumberControl("Hit Frames", definition.hitFrameCount, 1, 0, 256, (value) => {
          definition.hitFrameCount = value === null ? undefined : Math.max(0, Math.floor(value));
        }),
        createOptionalNumberControl("Move Ms", definition.movementFrameMs, 1, 1, 5_000, (value) => {
          definition.movementFrameMs = value === null ? undefined : Math.max(1, value);
        }),
        createOptionalNumberControl("Hit Ms", definition.hitFrameMs, 1, 1, 5_000, (value) => {
          definition.hitFrameMs = value === null ? undefined : Math.max(1, value);
        }),
      ]),
      createSection("Clips", this.createClipControls(definition, selectedClip)),
      createSection("Auto Map", [
        createButton("Detect Grid", () => void this.autoMapSelectedDefinition()),
        createTextValue("Frames", "Auto cut transparent bounds per frame and store placement inside each cell"),
        createTextValue("Source", "Projection + autocorrelation grid detection for local sprite sheets"),
      ]),
      createSection("Tags", [
        createTextControl("Tags", definition.tags.join(", "), (value) => {
          definition.tags = value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        }),
      ]),
    );
    this.inspector.replaceChildren(content);
  }

  private createPreviewSection(definition: SheetDefinitionDraft, assetUrl: string): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "sheet-preview-panel";
    const toolbar = document.createElement("div");
    toolbar.className = "sheet-preview-toolbar";
    const clipIds = (definition.clips ?? []).map((clip) => clip.id);
    const clipControl = createSelectControl("Clip", clipIds.length > 0 ? clipIds : [""], this.selectedClipId, (value) => {
      this.selectedClipId = value;
      this.previewStartMs = performance.now();
      this.renderInspector();
    });
    toolbar.append(clipControl, this.previewMeta);
    panel.append(toolbar, this.previewCanvas);
    this.renderPreviewFrame(performance.now(), definition, assetUrl);
    return panel;
  }

  private createFrameRectEditorGrid(definition: SheetDefinitionDraft, assetUrl: string): HTMLElement {
    const frames = this.getDefinitionFrames(definition).slice(0, Math.max(1, Math.floor(definition.frameCount)));
    const panel = document.createElement("section");
    panel.className = "sheet-frame-rect-panel";
    const header = document.createElement("div");
    header.className = "sheet-frame-rect-panel-header";
    const title = document.createElement("h2");
    title.textContent = "Frame Rects";
    const meta = document.createElement("span");
    meta.textContent = `${frames.length} editable rects`;
    header.append(title, meta);

    panel.append(
      header,
      createSheetMultiRectEditor({
        textureUrl: assetUrl,
        textureLabel: definition.label,
        rects: frames.map((frame) => ({ id: frame.id, label: frame.label, rect: frame.rect })),
        onChange: (frameId, rect) => {
          this.updateFrameRect(definition, frameId, rect);
          this.previewStartMs = performance.now();
        },
      }),
    );
    return panel;
  }

  private createClipControls(
    definition: SheetDefinitionDraft,
    selectedClip: SheetAnimationClipDraft | null,
  ): readonly HTMLElement[] {
    const clips = definition.clips ?? [];
    const actions = document.createElement("div");
    actions.className = "sheet-action-row";
    const newButton = createButton("New Clip", () => {
      const frames = this.getDefinitionFrames(definition);
      const id = uniqueId("clip", clips.map((clip) => clip.id));
      const clip: SheetAnimationClipDraft = {
        id,
        label: titleCase(id),
        frameIds: frames.map((frame) => frame.id),
      };
      definition.clips = [...clips, clip];
      this.selectedClipId = id;
      this.previewStartMs = performance.now();
      this.renderAll();
    });
    const duplicateButton = createButton("Duplicate", () => {
      if (!selectedClip) {
        return;
      }

      const id = uniqueId(`${selectedClip.id}-copy`, clips.map((clip) => clip.id));
      const clone = cloneAnimationClip(selectedClip);
      clone.id = id;
      clone.label = `${selectedClip.label} Copy`;
      definition.clips = [...clips, clone];
      this.selectedClipId = id;
      this.previewStartMs = performance.now();
      this.renderAll();
    });
    const deleteButton = createButton("Delete", () => {
      if (!selectedClip || clips.length <= 1) {
        return;
      }

      definition.clips = clips.filter((clip) => clip.id !== selectedClip.id);
      this.ensureSelectedClip(definition);
      this.previewStartMs = performance.now();
      this.renderAll();
    });
    deleteButton.disabled = clips.length <= 1;
    actions.append(newButton, duplicateButton, deleteButton);

    const controls: HTMLElement[] = [
      createSelectControl(
        "Selected",
        clips.map((clip) => clip.id),
        selectedClip?.id ?? "",
        (value) => {
          this.selectedClipId = value;
          this.previewStartMs = performance.now();
          this.renderAll();
        },
      ),
      actions,
    ];

    if (!selectedClip) {
      controls.push(createTextValue("Clip", "No clip selected"));
      return controls;
    }

    controls.push(
      createTextControl("Clip Id", selectedClip.id, (value) => {
        const existing = clips.filter((clip) => clip !== selectedClip).map((clip) => clip.id);
        const nextId = uniqueId(slugify(value) || selectedClip.id, existing);
        selectedClip.id = nextId;
        this.selectedClipId = nextId;
        this.renderAll();
      }),
      createTextControl("Label", selectedClip.label, (value) => {
        selectedClip.label = value;
        this.renderStage();
      }),
      createTextAreaControl("Frame Ids", selectedClip.frameIds.join(", "), (value) => {
        selectedClip.frameIds = parseFrameIds(value);
        this.repairClipFrameIds(definition);
        this.previewStartMs = performance.now();
      }),
      createNumberControl("Clip Ms", selectedClip.frameMs ?? definition.frameMs, 1, 1, 5_000, (value) => {
        selectedClip.frameMs = Math.max(1, value);
        this.previewStartMs = performance.now();
      }),
      createSelectControl("Clip Mode", frameModes, selectedClip.frameMode ?? definition.frameMode, (value) => {
        selectedClip.frameMode = value;
        this.previewStartMs = performance.now();
      }),
      createTextValue("Available", this.getDefinitionFrames(definition).map((frame) => frame.id).join(", ")),
    );
    return controls;
  }

  private createDefinition(): void {
    const asset = this.assetOptions[0] ?? { scope: "effects", key: "", url: "" };
    const id = uniqueId("sheet", this.definitions.map((definition) => definition.id));
    const definition: SheetDefinitionDraft = {
      id,
      label: titleCase(id),
      asset: { scope: asset.scope, key: asset.key },
      rect: { x: 0, y: 0, width: 1, height: 1 },
      frameCount: 1,
      columns: 1,
      rows: 1,
      frames: cloneFrameDefinitions(createGridFrameDefinitions({ x: 0, y: 0, width: 1, height: 1 }, 1, 1, 1)),
      frameMs: 80,
      frameMode: "loop",
      tags: [asset.scope],
    };
    definition.clips = [createAllFramesClip(definition)];
    this.definitions.push(definition);
    this.selectedId = definition.id;
    this.selectedClipId = definition.clips[0]?.id ?? "";
    this.previewStartMs = performance.now();
    this.renderAll();
  }

  private duplicateDefinition(): void {
    const selected = this.getSelectedDefinition();

    if (!selected) {
      return;
    }

    const clone = cloneSheetDefinition(selected);
    clone.id = uniqueId(`${selected.id}-copy`, this.definitions.map((definition) => definition.id));
    clone.label = `${selected.label} Copy`;
    this.ensureDefinitionFrames(clone);
    this.definitions.push(clone);
    this.selectedId = clone.id;
    this.ensureSelectedClip(clone);
    this.previewStartMs = performance.now();
    this.renderAll();
  }

  private async saveDefinitions(): Promise<void> {
    this.status.textContent = "Saving";

    try {
      for (const definition of this.definitions) {
        this.ensureDefinitionFrames(definition);
        this.repairClipFrameIds(definition);
      }

      const response = await fetch("/__local/sheets/definitions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(this.definitions),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      this.status.textContent = "Saved";
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : "Save failed";
    }
  }

  private getSelectedDefinition(): SheetDefinitionDraft | null {
    return this.definitions.find((definition) => definition.id === this.selectedId) ?? this.definitions[0] ?? null;
  }

  private getAssetKeysForScope(scope: SheetAssetScope): readonly string[] {
    const keys = this.getAssetOptionsForScope(scope).map((option) => option.key);
    return keys.length > 0 ? keys : [""];
  }

  private getAssetOptionsForScope(scope: SheetAssetScope): readonly AssetOption[] {
    return this.assetOptions.filter((option) => option.scope === scope);
  }

  private async autoMapSelectedDefinition(): Promise<void> {
    const definition = this.getSelectedDefinition();

    if (!definition) {
      return;
    }

    this.status.textContent = "Detecting grid";

    try {
      const result = await analyzeSpriteSheetUrl(resolveSheetAssetUrl(definition.asset));
      definition.rect = result.rect;
      definition.frameCount = result.frameCount;
      definition.columns = result.columns;
      definition.rows = result.rows;
      definition.frames = cloneFrameDefinitions(result.frames);
      definition.clips = cloneAnimationClips(result.clips);
      this.selectedClipId = definition.clips[0]?.id ?? "";
      this.previewStartMs = performance.now();
      this.status.textContent = `Detected ${result.columns} x ${result.rows}, ${result.frameCount} frames, confidence ${Math.round(
        result.confidence * 100,
      )}%`;
      this.renderAll();
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : "Auto map failed";
    }
  }

  private tickPreview(time: number): void {
    this.renderPreviewFrame(time);
    this.previewFrameHandle = requestAnimationFrame((nextTime) => this.tickPreview(nextTime));
  }

  private renderPreviewFrame(
    time: number,
    definition = this.getSelectedDefinition(),
    assetUrl = definition ? resolveSheetAssetUrl(definition.asset) : "",
  ): void {
    const context = this.previewCanvas.getContext("2d");

    if (!context) {
      return;
    }

    drawPreviewBackground(context, this.previewCanvas.width, this.previewCanvas.height);

    if (!definition) {
      this.previewMeta.textContent = "No sheet";
      return;
    }

    this.ensureDefinitionFrames(definition);
    this.ensureSelectedClip(definition);
    const clip = this.getSelectedClip(definition);
    const frames = this.getClipFrames(definition, clip);

    if (!clip || frames.length === 0) {
      this.previewMeta.textContent = "No clip frames";
      return;
    }

    const image = this.getPreviewImage(assetUrl);
    const frameMs = Math.max(1, Math.floor(clip.frameMs ?? definition.frameMs));
    const mode = clip.frameMode ?? definition.frameMode;
    const elapsed = Math.max(0, time - this.previewStartMs);
    const index = resolvePreviewFrameIndex(mode, elapsed, frameMs, frames.length);
    const frame = frames[index];
    this.previewMeta.textContent = `${clip.label} / ${frame.id}`;

    if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }

    drawPreviewFrame(context, this.previewCanvas, image, frame);
  }

  private getPreviewImage(assetUrl: string): HTMLImageElement | null {
    if (assetUrl.length === 0) {
      return null;
    }

    const existing = this.previewImagesByUrl.get(assetUrl);

    if (existing) {
      return existing;
    }

    const image = new Image();
    image.decoding = "async";
    image.src = assetUrl;
    this.previewImagesByUrl.set(assetUrl, image);
    return image;
  }

  private ensureDefinitionFrames(definition: SheetDefinitionDraft): void {
    const expectedFrameCount = Math.max(1, Math.floor(definition.frameCount));

    if (!definition.frames || definition.frames.length !== expectedFrameCount) {
      this.rebuildGridFrames(definition);
    }

    if (!definition.clips || definition.clips.length === 0) {
      definition.clips = [createAllFramesClip(definition)];
    }

    this.repairClipFrameIds(definition);
  }

  private rebuildGridFrames(definition: SheetDefinitionDraft): void {
    const frameCount = Math.max(1, Math.floor(definition.frameCount));
    const columns = Math.max(1, Math.floor(definition.columns ?? frameCount));
    const requestedRows = Math.max(1, Math.floor(definition.rows ?? Math.ceil(frameCount / columns)));
    const rows = Math.max(requestedRows, Math.ceil(frameCount / columns));
    definition.columns = columns;
    definition.rows = rows;
    definition.frames = cloneFrameDefinitions(createGridFrameDefinitions(definition.rect, columns, rows, frameCount));
  }

  private repairClipFrameIds(definition: SheetDefinitionDraft): void {
    const frames = this.getDefinitionFrames(definition);
    const frameIds = new Set(frames.map((frame) => frame.id));

    if (!definition.clips || definition.clips.length === 0) {
      definition.clips = [createAllFramesClip(definition)];
    }

    for (const clip of definition.clips) {
      clip.frameIds = clip.frameIds.filter((id) => frameIds.has(id));

      if (clip.frameIds.length === 0) {
        clip.frameIds = frames.map((frame) => frame.id);
      }
    }
  }

  private ensureSelectedClip(definition: SheetDefinitionDraft): void {
    this.ensureDefinitionFrames(definition);

    if (!definition.clips?.some((clip) => clip.id === this.selectedClipId)) {
      this.selectedClipId = definition.clips?.[0]?.id ?? "";
    }
  }

  private getSelectedClip(definition: SheetDefinitionDraft): SheetAnimationClipDraft | null {
    return definition.clips?.find((clip) => clip.id === this.selectedClipId) ?? definition.clips?.[0] ?? null;
  }

  private getDefinitionFrames(definition: SheetDefinitionDraft): SheetFrameDefinitionDraft[] {
    return definition.frames ?? [];
  }

  private updateFrameRect(definition: SheetDefinitionDraft, frameId: string, rect: SheetFrameDefinitionDraft["rect"]): void {
    const frame = this.getDefinitionFrames(definition).find((candidate) => candidate.id === frameId);

    if (!frame) {
      return;
    }

    frame.rect = normalizeEditableSheetRect(rect);
    frame.placement = calculateFramePlacement(frame.rect, frame.cellRect);
  }

  private getClipFrames(
    definition: SheetDefinitionDraft,
    clip: SheetAnimationClipDraft | null,
  ): readonly SheetFrameDefinitionDraft[] {
    if (!clip) {
      return [];
    }

    const framesById = new Map(this.getDefinitionFrames(definition).map((frame) => [frame.id, frame]));
    return clip.frameIds.map((id) => framesById.get(id)).filter((frame): frame is SheetFrameDefinitionDraft => Boolean(frame));
  }
}

async function loadSheetDefinitions(): Promise<SheetDefinitionDraft[]> {
  try {
    const response = await fetch("/__local/sheets/definitions");

    if (response.ok) {
      return cloneSheetDefinitions((await response.json()) as readonly SheetDefinition[]);
    }
  } catch {
    // The editor can still run with bundled sheet metadata.
  }

  return cloneSheetDefinitions(sheetDefinitions);
}

function cloneSheetDefinitions(source: readonly SheetDefinition[]): SheetDefinitionDraft[] {
  return JSON.parse(JSON.stringify(source)) as SheetDefinitionDraft[];
}

function cloneSheetDefinition(source: SheetDefinitionDraft): SheetDefinitionDraft {
  return JSON.parse(JSON.stringify(source)) as SheetDefinitionDraft;
}

function cloneFrameDefinitions(source: readonly SheetFrameDefinition[]): SheetFrameDefinitionDraft[] {
  return JSON.parse(JSON.stringify(source)) as SheetFrameDefinitionDraft[];
}

function cloneAnimationClips(source: readonly SheetAnimationClip[]): SheetAnimationClipDraft[] {
  return JSON.parse(JSON.stringify(source)) as SheetAnimationClipDraft[];
}

function cloneAnimationClip(source: SheetAnimationClipDraft): SheetAnimationClipDraft {
  return JSON.parse(JSON.stringify(source)) as SheetAnimationClipDraft;
}

function createAllFramesClip(definition: SheetDefinitionDraft): SheetAnimationClipDraft {
  const frameIds = (definition.frames ?? []).map((frame) => frame.id);
  return {
    id: "all",
    label: "All Frames",
    frameIds,
  };
}

function collectAssetOptions(): readonly AssetOption[] {
  const scopedEntries = bundledAssetScopes.flatMap((scope) =>
    Object.entries(assetUrls[scope] as Readonly<Record<string, string>>).map(([key, url]) => ({ scope, key, url })),
  );
  const skinEntries = Object.entries(skinAssetUrls).map(([key, url]) => ({ scope: "skins" as const, key, url }));
  return [...scopedEntries, ...skinEntries];
}

function createSection(title: string, children: readonly HTMLElement[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "sheet-control-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.append(heading, ...children);
  return section;
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sheet-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createTextControl(label: string, value: string, onInput: (value: string) => void): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function createTextAreaControl(label: string, value: string, onInput: (value: string) => void): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("textarea");
  input.rows = 3;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function createTextValue(label: string, value: string): HTMLElement {
  const wrapper = createControlWrapper(label);
  const output = document.createElement("output");
  output.textContent = value;
  wrapper.append(output);
  return wrapper;
}

function createNumberControl(
  label: string,
  value: number,
  step: number,
  min: number,
  max: number,
  onInput: (value: number) => void,
): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener("input", () => onInput(clamp(parseNumber(input.value, value), min, max)));
  wrapper.append(input);
  return wrapper;
}

function createOptionalNumberControl(
  label: string,
  value: number | undefined,
  step: number,
  min: number,
  max: number,
  onInput: (value: number | null) => void,
): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.min = String(min);
  input.max = String(max);
  input.value = value === undefined ? "" : String(value);
  input.addEventListener("input", () => {
    const trimmed = input.value.trim();
    onInput(trimmed.length === 0 ? null : clamp(parseNumber(trimmed, value ?? min), min, max));
  });
  wrapper.append(input);
  return wrapper;
}

function createSelectControl<T extends string>(
  label: string,
  options: readonly T[],
  value: T,
  onInput: (value: T) => void,
): HTMLElement {
  const wrapper = createControlWrapper(label);
  const select = document.createElement("select");

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option;
    element.textContent = option;
    element.selected = option === value;
    select.append(element);
  }

  if (!options.includes(value)) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = value;
    element.selected = true;
    select.prepend(element);
  }

  select.addEventListener("change", () => onInput(select.value as T));
  wrapper.append(select);
  return wrapper;
}

function createControlWrapper(label: string): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "sheet-control";
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text);
  return wrapper;
}

function createEmptyState(text: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "sheet-empty";
  element.textContent = text;
  return element;
}

function drawPreviewBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#0c0e12";
  context.fillRect(0, 0, width, height);

  const tile = 12;
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      context.fillStyle = (x / tile + y / tile) % 2 === 0 ? "#141821" : "#10131a";
      context.fillRect(x, y, tile, tile);
    }
  }
}

function drawPreviewFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  frame: SheetFrameDefinitionDraft,
): void {
  const sourceX = Math.round(frame.rect.x * image.naturalWidth);
  const sourceY = Math.round(frame.rect.y * image.naturalHeight);
  const sourceWidth = Math.max(1, Math.round(frame.rect.width * image.naturalWidth));
  const sourceHeight = Math.max(1, Math.round(frame.rect.height * image.naturalHeight));
  const cellWidth = Math.max(sourceWidth, Math.round(frame.cellRect.width * image.naturalWidth));
  const cellHeight = Math.max(sourceHeight, Math.round(frame.cellRect.height * image.naturalHeight));
  const maxDrawWidth = canvas.width - 48;
  const maxDrawHeight = canvas.height - 48;
  const scale = Math.min(maxDrawWidth / cellWidth, maxDrawHeight / cellHeight);
  const cellDrawWidth = cellWidth * scale;
  const cellDrawHeight = cellHeight * scale;
  const cellX = (canvas.width - cellDrawWidth) / 2;
  const cellY = (canvas.height - cellDrawHeight) / 2;
  const drawX = cellX + frame.placement.x * cellDrawWidth;
  const drawY = cellY + frame.placement.y * cellDrawHeight;
  const drawWidth = Math.max(1, frame.placement.width * cellDrawWidth);
  const drawHeight = Math.max(1, frame.placement.height * cellDrawHeight);

  context.imageSmoothingEnabled = false;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
  context.strokeStyle = "rgba(146, 214, 208, 0.72)";
  context.lineWidth = 2;
  context.strokeRect(cellX, cellY, cellDrawWidth, cellDrawHeight);

  const pivotX = cellX + frame.pivot.x * cellDrawWidth;
  const pivotY = cellY + frame.pivot.y * cellDrawHeight;
  context.strokeStyle = "rgba(255, 224, 161, 0.82)";
  context.beginPath();
  context.moveTo(pivotX - 8, pivotY);
  context.lineTo(pivotX + 8, pivotY);
  context.moveTo(pivotX, pivotY - 8);
  context.lineTo(pivotX, pivotY + 8);
  context.stroke();
}

function resolvePreviewFrameIndex(
  frameMode: SheetFrameMode,
  elapsedMs: number,
  frameMs: number,
  frameCount: number,
): number {
  if (frameMode === "hold") {
    return 0;
  }

  if (frameMode === "once") {
    return Math.min(frameCount - 1, Math.floor(elapsedMs / frameMs));
  }

  return Math.floor(elapsedMs / frameMs) % frameCount;
}

function calculateFramePlacement(
  rect: SheetFrameDefinitionDraft["rect"],
  cellRect: SheetFrameDefinitionDraft["cellRect"],
): SheetFrameDefinitionDraft["placement"] {
  const cellWidth = Math.max(0.001, cellRect.width);
  const cellHeight = Math.max(0.001, cellRect.height);

  return {
    x: (rect.x - cellRect.x) / cellWidth,
    y: (rect.y - cellRect.y) / cellHeight,
    width: rect.width / cellWidth,
    height: rect.height / cellHeight,
  };
}

function parseFrameIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueId(base: string, existing: readonly string[]): string {
  const slug = slugify(base) || "sheet";
  let next = slug;
  let index = 2;

  while (existing.includes(next)) {
    next = `${slug}-${index}`;
    index += 1;
  }

  return next;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
