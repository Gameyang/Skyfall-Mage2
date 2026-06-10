// Responsibility: Bootstrap the local-only unified effect preset editor.
// Owner: tools/effects

import { effectPresets } from "../../content/effects/effectPresets";
import type {
  EffectBlendMode,
  EffectDrawMode,
  EffectFacingMode,
  EffectFrameMode,
  EffectLayer,
  EffectLayerKind,
  EffectOpacitySource,
  EffectOutputKind,
  EffectPreset,
  EffectSheetRect,
  EffectSizeMode,
  EffectSpawnDistribution,
  EffectTextureKey,
} from "../../content/effects/effectPresetTypes";
import { sheetDefinitions } from "../../content/sheets/sheetLibrary";
import { resolveSheetAssetUrl, resolveSheetRect } from "../../content/sheets/sheetResolver";
import type { SheetDefinition } from "../../content/sheets/sheetTypes";
import { assetUrls } from "../../platform/assets";
import { createEffectSpritesFromPreset } from "../../render/snapshots/createEffectSpritesFromPreset";
import { createSheetRectEditor } from "../sheets/SheetRectEditor";
import { EffectPreviewGpu } from "./EffectPreviewGpu";
import "./effectsTool.css";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

type EffectPresetDraft = Mutable<EffectPreset>;
type EffectLayerDraft = Mutable<EffectLayer>;
type SheetEditableLayer = Extract<
  EffectLayerDraft,
  { sheetId: string | null; sheetRect: EffectSheetRect; textureKey: EffectTextureKey | null }
>;
type SheetDefinitionDraft = Mutable<SheetDefinition>;

const outputKinds: readonly EffectOutputKind[] = [
  "fireball-projectile",
  "fireball-impact",
  "fire-area-burn",
  "burn-overlay",
  "effect-sprite",
  "effect-particle",
  "effect-trail",
  "effect-glow",
];
const sizeModes: readonly EffectSizeMode[] = ["absolute", "radius", "body"];
const drawModes: readonly EffectDrawMode[] = ["texture", "radial", "streak"];
const blendModes: readonly EffectBlendMode[] = ["alpha", "screen", "additive"];
const facingModes: readonly EffectFacingMode[] = ["fixed", "context", "random"];
const distributions: readonly EffectSpawnDistribution[] = ["point", "box", "anchors"];
const textureEntries = Object.keys(assetUrls.effects).map((key) => key as EffectTextureKey);
const defaultSheetIdByEffectTextureKey: Partial<Record<EffectTextureKey, string>> = {
  firestaffProjectile: "effect-firestaff-projectile",
  firestaffImpact: "effect-firestaff-impact",
  firestaffBurn: "effect-firestaff-burn",
  waterEntrySurface: "effect-water-entry-surface",
  waterEntryUnderwater: "effect-water-entry-underwater",
  waterUnderwaterLoop: "effect-water-underwater-loop",
};

export async function bootstrapEffectTool(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");

  if (!root) {
    throw new Error("Missing #app root element.");
  }

  await new EffectToolApp(root).init();
}

class EffectToolApp {
  private presets: EffectPresetDraft[] = [];
  private sheetDefinitions: SheetDefinitionDraft[] = [];
  private selectedPresetId = "";
  private selectedLayerId = "";
  private playing = true;
  private timeMs = 0;
  private lastFrameMs = 0;
  private frameHandle = 0;
  private gpu: EffectPreviewGpu | null = null;

  private readonly libraryList = document.createElement("div");
  private readonly inspector = document.createElement("aside");
  private readonly canvas = document.createElement("canvas");
  private readonly status = document.createElement("div");
  private readonly gpuBadge = document.createElement("div");
  private readonly timeRange = document.createElement("input");
  private readonly timeLabel = document.createElement("span");
  private readonly playButton = document.createElement("button");

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.sheetDefinitions = await loadSheetDefinitions();
    this.presets = await loadPresets();
    this.selectedPresetId = this.presets[0]?.id ?? "";
    this.selectedLayerId = this.presets[0]?.layers[0]?.id ?? "";
    this.renderShell();
    this.renderPresetList();
    this.renderInspector();
    await this.initGpu();
    this.frameHandle = requestAnimationFrame((time) => this.tick(time));
  }

  private renderShell(): void {
    const frame = document.createElement("main");
    frame.className = "effect-tool";

    const library = document.createElement("aside");
    library.className = "effect-library";
    const libraryHeader = document.createElement("div");
    libraryHeader.className = "effect-library-header";
    const title = document.createElement("h1");
    title.textContent = "Effect Lab";
    const actions = document.createElement("div");
    actions.className = "effect-action-row";
    const newButton = createButton("New", () => this.createPreset());
    const duplicateButton = createButton("Duplicate", () => this.duplicatePreset());
    const saveButton = createButton("Save", () => void this.savePresets());
    actions.append(newButton, duplicateButton, saveButton);
    libraryHeader.append(title, actions);
    this.libraryList.className = "effect-list";
    library.append(libraryHeader, this.libraryList);

    const stage = document.createElement("section");
    stage.className = "effect-stage";
    const toolbar = document.createElement("div");
    toolbar.className = "effect-toolbar";
    this.playButton.className = "effect-icon-button";
    this.playButton.type = "button";
    this.playButton.title = "Play";
    this.playButton.textContent = "Pause";
    this.playButton.addEventListener("click", () => {
      this.playing = !this.playing;
      this.playButton.textContent = this.playing ? "Pause" : "Play";
      this.playButton.title = this.playing ? "Pause" : "Play";
    });
    const restartButton = createButton("Restart", () => {
      this.timeMs = 0;
      this.renderPreview();
      this.updateTimeline();
    });
    this.timeRange.type = "range";
    this.timeRange.min = "0";
    this.timeRange.step = "1";
    this.timeRange.className = "effect-time-range";
    this.timeRange.addEventListener("input", () => {
      this.timeMs = parseNumber(this.timeRange.value, this.timeMs);
      this.playing = false;
      this.playButton.textContent = "Play";
      this.playButton.title = "Play";
      this.renderPreview();
      this.updateTimeline();
    });
    this.timeLabel.className = "effect-time-label";
    toolbar.append(this.playButton, restartButton, this.timeRange, this.timeLabel, this.gpuBadge);

    const previewFrame = document.createElement("div");
    previewFrame.className = "effect-preview-frame";
    this.canvas.className = "effect-preview-canvas";
    previewFrame.append(this.canvas);
    this.status.className = "effect-status";
    stage.append(toolbar, previewFrame, this.status);

    this.inspector.className = "effect-inspector";
    frame.append(library, stage, this.inspector);
    this.root.replaceChildren(frame);
    this.updateTimeline();
  }

  private async initGpu(): Promise<void> {
    const result = await EffectPreviewGpu.create(this.canvas);

    if (result.ok) {
      this.gpu = result.renderer;
      this.gpuBadge.textContent = "WebGPU";
      this.gpuBadge.dataset.status = "ready";
      this.renderPreview();
      return;
    }

    this.gpuBadge.textContent = result.reason;
    this.gpuBadge.dataset.status = "degraded";
  }

  private tick(time: number): void {
    const preset = this.getSelectedPreset();
    const duration = Math.max(1, preset?.durationMs ?? 1);

    if (this.playing) {
      const delta = this.lastFrameMs > 0 ? Math.min(80, time - this.lastFrameMs) : 0;
      this.timeMs = (this.timeMs + delta) % duration;
    }

    this.lastFrameMs = time;
    this.renderPreview();
    this.updateTimeline();
    this.frameHandle = requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  private renderPresetList(): void {
    const items = this.presets.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "effect-list-item";
      button.dataset.active = String(preset.id === this.selectedPresetId);
      button.addEventListener("click", () => {
        this.selectedPresetId = preset.id;
        this.selectedLayerId = preset.layers[0]?.id ?? "";
        this.timeMs = 0;
        this.renderPresetList();
        this.renderInspector();
        this.renderPreview();
      });

      const label = document.createElement("strong");
      label.textContent = preset.label;
      const meta = document.createElement("span");
      meta.textContent = `${preset.layers.length} layers`;
      button.append(label, meta);
      return button;
    });
    this.libraryList.replaceChildren(...items);
  }

  private renderInspector(): void {
    const preset = this.getSelectedPreset();

    if (!preset) {
      this.inspector.replaceChildren();
      return;
    }

    const content = document.createElement("div");
    content.className = "effect-inspector-content";
    content.append(this.createPresetSection(preset), this.createLayerListSection(preset));

    const layer = this.getSelectedLayer(preset);

    if (layer) {
      content.append(this.createLayerSection(preset, layer));
    }

    this.inspector.replaceChildren(content);
    this.updateTimeline();
  }

  private createPresetSection(preset: EffectPresetDraft): HTMLElement {
    const section = createSection("Preset");
    section.append(
      createTextControl("Id", preset.id, (value) => {
        const nextId = slugify(value) || preset.id;
        preset.id = nextId;
        this.selectedPresetId = nextId;
        this.renderPresetList();
      }),
      createTextControl("Label", preset.label, (value) => {
        preset.label = value;
        this.renderPresetList();
      }),
      createNumberControl("Duration", preset.durationMs, 10, 60, 20_000, (value) => {
        preset.durationMs = Math.max(60, value);
        this.timeMs = clamp(this.timeMs, 0, preset.durationMs);
        this.updateTimeline();
      }),
      createCheckboxControl("Loop", preset.loop, (value) => {
        preset.loop = value;
      }),
    );

    const previewGrid = document.createElement("div");
    previewGrid.className = "effect-control-grid";
    previewGrid.append(
      createNumberControl("Origin X", preset.preview.origin.x, 0.01, 0, 1, (value) => {
        preset.preview.origin.x = value;
      }),
      createNumberControl("Origin Y", preset.preview.origin.y, 0.01, 0, 1, (value) => {
        preset.preview.origin.y = value;
      }),
      createNumberControl("Dir X", preset.preview.direction.x, 0.01, -1, 1, (value) => {
        preset.preview.direction.x = value;
      }),
      createNumberControl("Dir Y", preset.preview.direction.y, 0.01, -1, 1, (value) => {
        preset.preview.direction.y = value;
      }),
      createNumberControl("Radius", preset.preview.radius, 0.005, 0.005, 0.4, (value) => {
        preset.preview.radius = value;
      }),
      createNumberControl("Body W", preset.preview.bodySize.x, 0.005, 0.01, 0.4, (value) => {
        preset.preview.bodySize.x = value;
      }),
      createNumberControl("Body H", preset.preview.bodySize.y, 0.005, 0.01, 0.4, (value) => {
        preset.preview.bodySize.y = value;
      }),
    );
    section.append(previewGrid);
    return section;
  }

  private createLayerListSection(preset: EffectPresetDraft): HTMLElement {
    const section = createSection("Layers");
    const addRow = document.createElement("div");
    addRow.className = "effect-action-row";
    addRow.append(
      createButton("Sprite", () => this.addLayer(preset, "sprite")),
      createButton("Particle", () => this.addLayer(preset, "particle")),
      createButton("Trail", () => this.addLayer(preset, "trail")),
      createButton("Glow", () => this.addLayer(preset, "glow")),
    );
    section.append(addRow);

    const list = document.createElement("div");
    list.className = "effect-layer-list";
    list.append(
      ...preset.layers.map((layer) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "effect-layer-item";
        button.dataset.active = String(layer.id === this.selectedLayerId);
        button.textContent = `${layer.label} / ${layer.kind}`;
        button.addEventListener("click", () => {
          this.selectedLayerId = layer.id;
          this.renderInspector();
        });
        return button;
      }),
    );
    section.append(list);
    return section;
  }

  private createLayerSection(preset: EffectPresetDraft, layer: EffectLayerDraft): HTMLElement {
    const section = createSection(`Layer: ${layer.kind}`);
    const deleteButton = createButton("Delete Layer", () => {
      preset.layers = preset.layers.filter((candidate) => candidate.id !== layer.id);
      this.selectedLayerId = preset.layers[0]?.id ?? "";
      this.renderInspector();
      this.renderPreview();
    });
    deleteButton.disabled = preset.layers.length <= 1;
    section.append(
      createTextControl("Id", layer.id, (value) => {
        layer.id = slugify(value) || layer.id;
        this.selectedLayerId = layer.id;
      }),
      createTextControl("Label", layer.label, (value) => {
        layer.label = value;
        this.renderInspector();
      }),
      createSelectControl("Output", outputKinds, layer.outputKind, (value) => {
        layer.outputKind = value;
      }),
      createSelectControl("Draw", drawModes, layer.drawMode, (value) => {
        layer.drawMode = value;
      }),
      createSelectControl("Blend", blendModes, layer.blendMode, (value) => {
        layer.blendMode = value;
      }),
      createNumberControl("Start", layer.startMs, 10, 0, 20_000, (value) => {
        layer.startMs = Math.max(0, value);
      }),
      createNumberControl("Duration", layer.durationMs, 10, 1, 20_000, (value) => {
        layer.durationMs = Math.max(1, value);
      }),
      createNumberControl("Sort", layer.sortLayer, 1, -100, 100, (value) => {
        layer.sortLayer = value;
      }),
      createColorControl("Color", layer.color, (value) => {
        layer.color = value;
      }),
      createNumberControl("Opacity", layer.opacity, 0.01, 0, 1, (value) => {
        layer.opacity = clamp(value, 0, 1);
      }),
      this.createOpacitySourceControls(layer),
      createJsonControl("Opacity Curve", layer.opacityCurve, (value) => {
        layer.opacityCurve = parseCurve(value, layer.opacityCurve);
      }),
      createSelectControl("Offset Mode", sizeModes, layer.offsetMode, (value) => {
        layer.offsetMode = value;
      }),
      this.createVecControl("Offset", layer.offset, -2, 2, 0.005),
      createSelectControl("Size Mode", sizeModes, layer.sizeMode, (value) => {
        layer.sizeMode = value;
      }),
      this.createVecControl("Size", layer.size, 0.001, 4, 0.005),
      createNumberControl("Rotation", layer.rotationRadians, 0.01, -6.28, 6.28, (value) => {
        layer.rotationRadians = value;
      }),
      createCheckboxControl("Align Dir", layer.alignToDirection, (value) => {
        layer.alignToDirection = value;
      }),
      createNumberControl("Random Rot", layer.randomRotationRadians, 0.01, 0, 6.28, (value) => {
        layer.randomRotationRadians = value;
      }),
      createNumberControl("Random Scale", layer.randomScale, 0.01, 0, 3, (value) => {
        layer.randomScale = value;
      }),
      createSelectControl("Facing", facingModes, layer.facingMode, (value) => {
        layer.facingMode = value;
      }),
      createNumberControl("Softness", layer.softness, 0.01, 0.01, 1, (value) => {
        layer.softness = value;
      }),
      createNumberControl("Glow", layer.glowStrength, 0.01, 0, 2, (value) => {
        layer.glowStrength = value;
      }),
      this.createSpawnControls(layer),
      this.createKindSpecificControls(layer),
      deleteButton,
    );
    return section;
  }

  private createOpacitySourceControls(layer: EffectLayerDraft): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "effect-nested-controls";
    wrapper.append(
      createSelectControl("Opacity Source", ["none", "lifeRatio", "remainingFade"] as const, layer.opacitySource.kind, (value) => {
        layer.opacitySource = createOpacitySource(value);
        this.renderInspector();
      }),
    );

    if (layer.opacitySource.kind === "lifeRatio") {
      wrapper.append(
        createNumberControl("Life Min", layer.opacitySource.min, 0.01, 0, 1, (value) => {
          if (layer.opacitySource.kind === "lifeRatio") {
            layer.opacitySource.min = value;
          }
        }),
        createNumberControl("Life Max", layer.opacitySource.max, 0.01, 0, 1, (value) => {
          if (layer.opacitySource.kind === "lifeRatio") {
            layer.opacitySource.max = value;
          }
        }),
      );
    }

    if (layer.opacitySource.kind === "remainingFade") {
      wrapper.append(
        createNumberControl("Fade Ms", layer.opacitySource.fadeMs, 10, 1, 5_000, (value) => {
          if (layer.opacitySource.kind === "remainingFade") {
            layer.opacitySource.fadeMs = value;
          }
        }),
        createNumberControl("Fade Max", layer.opacitySource.max, 0.01, 0, 1, (value) => {
          if (layer.opacitySource.kind === "remainingFade") {
            layer.opacitySource.max = value;
          }
        }),
      );
    }

    return wrapper;
  }

  private createSpawnControls(layer: EffectLayerDraft): HTMLElement {
    const section = createSection("Spawn");
    section.append(
      createNumberControl("Count", layer.spawn.count, 1, 0, 256, (value) => {
        layer.spawn.count = Math.max(0, Math.floor(value));
      }),
      createNumberControl("Jitter", layer.spawn.countJitter, 1, 0, 128, (value) => {
        layer.spawn.countJitter = Math.max(0, Math.floor(value));
      }),
      createSelectControl("Distribution", distributions, layer.spawn.distribution, (value) => {
        layer.spawn.distribution = value;
      }),
      createSelectControl("Spread Mode", sizeModes, layer.spawn.spreadMode, (value) => {
        layer.spawn.spreadMode = value;
      }),
      this.createVecControl("Spread", layer.spawn.spread, 0, 4, 0.005),
      createJsonControl("Anchors", layer.spawn.anchors, (value) => {
        layer.spawn.anchors = parseVecArray(value, layer.spawn.anchors);
      }),
    );
    return section;
  }

  private createKindSpecificControls(layer: EffectLayerDraft): HTMLElement {
    const section = createSection("Kind Params");

    if (layer.kind === "sprite") {
      section.append(
        createSelectControl("Texture", textureEntries, layer.textureKey, (value) => {
          layer.textureKey = value;
          this.applyDefaultSheetRef(layer);
          this.renderInspector();
          this.renderPreview();
        }),
        this.createSheetRefControl(layer),
        this.createSheetEditor(layer),
        createNumberControl("Frames", layer.frameCount, 1, 1, 64, (value) => {
          layer.frameCount = Math.max(1, Math.floor(value));
        }),
        createNumberControl("Frame Ms", layer.frameMs, 1, 1, 1_000, (value) => {
          layer.frameMs = Math.max(1, value);
        }),
        createSelectControl("Frame Mode", ["loop", "once", "hold"] as const, layer.frameMode, (value) => {
          layer.frameMode = value;
        }),
      );
    }

    if (layer.kind === "particle") {
      section.append(
        createSelectControl("Texture", ["none", ...textureEntries] as const, layer.textureKey ?? "none", (value) => {
          layer.textureKey = value === "none" ? null : value;
          this.applyDefaultSheetRef(layer);
          this.renderInspector();
          this.renderPreview();
        }),
        this.createSheetRefControl(layer),
        this.createSheetEditor(layer),
        createNumberControl("Frames", layer.frameCount, 1, 1, 64, (value) => {
          layer.frameCount = Math.max(1, Math.floor(value));
        }),
        createNumberControl("Frame Ms", layer.frameMs, 1, 1, 1_000, (value) => {
          layer.frameMs = Math.max(1, value);
        }),
        createSelectControl("Frame Mode", ["loop", "once", "hold"] as const, layer.frameMode, (value) => {
          layer.frameMode = value;
        }),
        createNumberControl("Lifetime", layer.lifetimeMs, 10, 1, 20_000, (value) => {
          layer.lifetimeMs = Math.max(1, value);
        }),
        this.createVecControl("Velocity", layer.velocity, -2, 2, 0.005),
        createNumberControl("Speed Jitter", layer.speedJitter, 0.01, 0, 3, (value) => {
          layer.speedJitter = value;
        }),
        createNumberControl("Spread Angle", layer.spreadAngleRadians, 0.01, 0, 6.28, (value) => {
          layer.spreadAngleRadians = value;
        }),
        this.createVecControl("Gravity", layer.gravity, -2, 2, 0.005),
        createNumberControl("Drag", layer.drag, 0.01, 0, 4, (value) => {
          layer.drag = value;
        }),
      );
    }

    if (layer.kind === "trail" || layer.kind === "glow") {
      section.append(createTextValue("Mode", layer.drawMode));
    }

    return section;
  }

  private createSheetRefControl(layer: SheetEditableLayer): HTMLElement {
    if (!layer.textureKey) {
      return createTextValue("Sheet", "none");
    }

    const options = ["custom", ...this.getSheetOptionsForTexture(layer.textureKey).map((definition) => definition.id)];
    return createSelectControl("Sheet", options, layer.sheetId ?? "custom", (value) => {
      layer.sheetId = value === "custom" ? null : value;
      this.applySheetDefinitionToLayer(layer);
      this.renderInspector();
      this.renderPreview();
    });
  }

  private createSheetEditor(layer: SheetEditableLayer): HTMLElement {
    const section = createSection("Sheet Rect");

    if (!layer.textureKey) {
      section.append(createTextValue("Texture", "none"));
      return section;
    }

    const sheetDefinition = this.getSheetDefinition(layer.sheetId);
    const textureUrl = sheetDefinition ? resolveSheetAssetUrl(sheetDefinition.asset) : assetUrls.effects[layer.textureKey];
    const rect = sheetDefinition ? resolveSheetRect(sheetDefinition.id, layer.sheetRect) : resolveSheetRect(null, layer.sheetRect);
    section.append(
      createSheetRectEditor({
        textureUrl,
        textureLabel: sheetDefinition?.label ?? layer.textureKey,
        rect,
        disabled: sheetDefinition !== null,
        onChange: (nextRect) => {
          layer.sheetId = null;
          layer.sheetRect = nextRect;
          this.renderPreview();
        },
      }),
    );
    return section;
  }

  private applyDefaultSheetRef(layer: SheetEditableLayer): void {
    layer.sheetId = layer.textureKey ? this.getDefaultSheetForTexture(layer.textureKey)?.id ?? null : null;
    this.applySheetDefinitionToLayer(layer);
  }

  private applySheetDefinitionToLayer(layer: SheetEditableLayer): void {
    const sheetDefinition = this.getSheetDefinition(layer.sheetId);

    if (!sheetDefinition) {
      return;
    }

    layer.sheetRect = { ...sheetDefinition.rect };
    layer.frameCount = Math.max(1, Math.floor(sheetDefinition.frameCount));
    layer.frameMs = Math.max(1, sheetDefinition.frameMs);
    layer.frameMode = sheetDefinition.frameMode as EffectFrameMode;
  }

  private getDefaultSheetForTexture(textureKey: EffectTextureKey): SheetDefinitionDraft | null {
    const configuredDefault = defaultSheetIdByEffectTextureKey[textureKey];
    return this.getSheetDefinition(configuredDefault) ?? this.getSheetOptionsForTexture(textureKey)[0] ?? null;
  }

  private getSheetOptionsForTexture(textureKey: EffectTextureKey): readonly SheetDefinitionDraft[] {
    return this.sheetDefinitions.filter(
      (definition) => definition.asset.scope === "effects" && definition.asset.key === textureKey,
    );
  }

  private getSheetDefinition(sheetId: string | null | undefined): SheetDefinitionDraft | null {
    return this.sheetDefinitions.find((definition) => definition.id === sheetId) ?? null;
  }

  private createVecControl(
    label: string,
    value: { x: number; y: number },
    min: number,
    max: number,
    step: number,
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "effect-vec-control";
    const title = document.createElement("span");
    title.textContent = label;
    const controls = document.createElement("div");
    controls.append(
      createNumberInput(value.x, step, min, max, (next) => {
        value.x = next;
      }),
      createNumberInput(value.y, step, min, max, (next) => {
        value.y = next;
      }),
    );
    wrapper.append(title, controls);
    return wrapper;
  }

  private addLayer(preset: EffectPresetDraft, kind: EffectLayerKind): void {
    const layer = createLayerDraft(kind, uniqueId(kind, preset.layers.map((item) => item.id)));
    preset.layers.push(layer);
    this.selectedLayerId = layer.id;
    this.renderInspector();
    this.renderPreview();
  }

  private createPreset(): void {
    const id = uniqueId("effect", this.presets.map((preset) => preset.id));
    const preset = createPresetDraft(id);
    this.presets.push(preset);
    this.selectedPresetId = preset.id;
    this.selectedLayerId = preset.layers[0]?.id ?? "";
    this.timeMs = 0;
    this.renderPresetList();
    this.renderInspector();
  }

  private duplicatePreset(): void {
    const preset = this.getSelectedPreset();

    if (!preset) {
      return;
    }

    const clone = clonePreset(preset);
    clone.id = uniqueId(`${preset.id}-copy`, this.presets.map((candidate) => candidate.id));
    clone.label = `${preset.label} Copy`;
    this.presets.push(clone);
    this.selectedPresetId = clone.id;
    this.selectedLayerId = clone.layers[0]?.id ?? "";
    this.timeMs = 0;
    this.renderPresetList();
    this.renderInspector();
  }

  private async savePresets(): Promise<void> {
    this.status.textContent = "Saving";

    try {
      const response = await fetch("/__local/effects/presets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(this.presets),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      this.status.textContent = "Saved";
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : "Save failed";
    }
  }

  private renderPreview(): void {
    const preset = this.getSelectedPreset();

    if (!preset || !this.gpu) {
      return;
    }

    const duration = Math.max(1, preset.durationMs);
    const localTime = preset.loop ? this.timeMs % duration : clamp(this.timeMs, 0, duration);
    const effects = createEffectSpritesFromPreset(preset, localTime, {
      instanceId: `${preset.id}-preview`,
      origin: preset.preview.origin,
      direction: preset.preview.direction,
      radius: preset.preview.radius,
      bodySize: preset.preview.bodySize,
      lifeRatio: clamp(1 - localTime / duration, 0, 1),
      remainingMs: Math.max(0, duration - localTime),
      facing: 1,
      seed: `${preset.id}-preview`,
    });
    this.gpu.render(effects);
  }

  private updateTimeline(): void {
    const preset = this.getSelectedPreset();
    const duration = Math.max(1, preset?.durationMs ?? 1);
    this.timeMs = clamp(this.timeMs, 0, duration);
    this.timeRange.max = String(duration);
    this.timeRange.value = String(Math.floor(this.timeMs));
    this.timeLabel.textContent = `${Math.floor(this.timeMs)} / ${duration} ms`;
  }

  private getSelectedPreset(): EffectPresetDraft | null {
    return this.presets.find((preset) => preset.id === this.selectedPresetId) ?? this.presets[0] ?? null;
  }

  private getSelectedLayer(preset: EffectPresetDraft): EffectLayerDraft | null {
    return preset.layers.find((layer) => layer.id === this.selectedLayerId) ?? preset.layers[0] ?? null;
  }
}

async function loadPresets(): Promise<EffectPresetDraft[]> {
  try {
    const response = await fetch("/__local/effects/presets");

    if (response.ok) {
      return clonePresets((await response.json()) as readonly EffectPreset[]);
    }
  } catch {
    // The editor is dev-only, but imported presets keep it usable if the local API is unavailable.
  }

  return clonePresets(effectPresets);
}

async function loadSheetDefinitions(): Promise<SheetDefinitionDraft[]> {
  try {
    const response = await fetch("/__local/sheets/definitions");

    if (response.ok) {
      return cloneSheetDefinitions((await response.json()) as readonly SheetDefinition[]);
    }
  } catch {
    // The effect editor can still run with bundled sheet metadata.
  }

  return cloneSheetDefinitions(sheetDefinitions);
}

function clonePresets(source: readonly EffectPreset[]): EffectPresetDraft[] {
  return JSON.parse(JSON.stringify(source)) as EffectPresetDraft[];
}

function cloneSheetDefinitions(source: readonly SheetDefinition[]): SheetDefinitionDraft[] {
  return JSON.parse(JSON.stringify(source)) as SheetDefinitionDraft[];
}

function clonePreset(source: EffectPresetDraft): EffectPresetDraft {
  return JSON.parse(JSON.stringify(source)) as EffectPresetDraft;
}

function createPresetDraft(id: string): EffectPresetDraft {
  return {
    id,
    label: "New Effect",
    durationMs: 900,
    loop: true,
    preview: {
      origin: { x: 0.5, y: 0.55 },
      direction: { x: 1, y: -0.12 },
      radius: 0.09,
      bodySize: { x: 0.1, y: 0.1 },
    },
    layers: [createLayerDraft("glow", "glow")],
  };
}

function createLayerDraft(kind: EffectLayerKind, id: string): EffectLayerDraft {
  const base = {
    id,
    label: titleCase(id),
    kind,
    outputKind: `effect-${kind}` as EffectOutputKind,
    startMs: 0,
    durationMs: 900,
    sortLayer: kind === "glow" ? -5 : 5,
    drawMode: kind === "trail" ? "streak" : kind === "sprite" ? "texture" : "radial",
    offsetMode: "absolute",
    offset: { x: 0, y: 0 },
    sizeMode: kind === "sprite" ? "absolute" : "radius",
    size: kind === "trail" ? { x: 2.2, y: 0.3 } : kind === "particle" ? { x: 0.018, y: 0.018 } : { x: 1.6, y: 1.6 },
    opacity: 0.8,
    opacityCurve: [
      { at: 0, value: kind === "trail" ? 0 : 1 },
      { at: 0.25, value: 1 },
      { at: 1, value: kind === "sprite" ? 1 : 0 },
    ],
    opacitySource: { kind: "none" } as EffectOpacitySource,
    color: kind === "glow" ? "#58c7ff" : "#fff0cc",
    blendMode: kind === "glow" || kind === "particle" ? "additive" : "screen",
    rotationRadians: 0,
    alignToDirection: kind === "trail",
    randomRotationRadians: kind === "particle" ? 3.14 : 0,
    randomScale: kind === "particle" ? 0.45 : 0,
    facingMode: "fixed",
    softness: 0.6,
    glowStrength: 0.7,
    spawn: {
      count: kind === "particle" ? 12 : 1,
      countJitter: kind === "particle" ? 4 : 0,
      distribution: kind === "particle" ? "box" : "point",
      spreadMode: "radius",
      spread: { x: kind === "particle" ? 0.25 : 0, y: kind === "particle" ? 0.18 : 0 },
      anchors: [],
    },
  } satisfies Omit<
    EffectLayerDraft,
    | "textureKey"
    | "sheetId"
    | "sheetRect"
    | "frameCount"
    | "frameMs"
    | "frameMode"
    | "lifetimeMs"
    | "velocity"
    | "speedJitter"
    | "spreadAngleRadians"
    | "gravity"
    | "drag"
  >;

  if (kind === "sprite") {
    return {
      ...base,
      kind,
      drawMode: "texture",
      textureKey: textureEntries[0],
      sheetId: getDefaultSheetIdForTexture(textureEntries[0]),
      sheetRect: { x: 0, y: 0, width: 1, height: 1 },
      frameCount: 8,
      frameMs: 80,
      frameMode: "loop",
    } as EffectLayerDraft;
  }

  if (kind === "particle") {
    return {
      ...base,
      kind,
      textureKey: null,
      sheetId: null,
      sheetRect: { x: 0, y: 0, width: 1, height: 1 },
      frameCount: 1,
      frameMs: 80,
      frameMode: "hold",
      lifetimeMs: 900,
      velocity: { x: 0.16, y: -0.04 },
      speedJitter: 0.7,
      spreadAngleRadians: 3.14,
      gravity: { x: 0, y: 0.05 },
      drag: 0.4,
    } as EffectLayerDraft;
  }

  return {
    ...base,
    kind,
    drawMode: kind === "trail" ? "streak" : "radial",
  } as EffectLayerDraft;
}

function createOpacitySource(kind: EffectOpacitySource["kind"]): EffectOpacitySource {
  switch (kind) {
    case "lifeRatio":
      return { kind, min: 0.2, max: 0.8 };
    case "remainingFade":
      return { kind, fadeMs: 250, max: 0.9 };
    case "none":
    default:
      return { kind: "none" };
  }
}

function getDefaultSheetIdForTexture(textureKey: EffectTextureKey | undefined): string | null {
  return textureKey ? defaultSheetIdByEffectTextureKey[textureKey] ?? null : null;
}

function createSection(title: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "effect-control-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.append(heading);
  return section;
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "effect-button";
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
  wrapper.append(createNumberInput(value, step, min, max, onInput));
  return wrapper;
}

function createNumberInput(
  value: number,
  step: number,
  min: number,
  max: number,
  onInput: (value: number) => void,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.step = String(step);
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener("input", () => onInput(clamp(parseNumber(input.value, value), min, max)));
  return input;
}

function createCheckboxControl(label: string, value: boolean, onInput: (value: boolean) => void): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => onInput(input.checked));
  wrapper.append(input);
  return wrapper;
}

function createColorControl(label: string, value: string, onInput: (value: string) => void): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
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

function createJsonControl<T>(label: string, value: T, onInput: (value: string) => void): HTMLElement {
  const wrapper = createControlWrapper(label);
  const input = document.createElement("textarea");
  input.spellcheck = false;
  input.value = JSON.stringify(value);
  input.addEventListener("change", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function createControlWrapper(label: string): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "effect-control";
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text);
  return wrapper;
}

function parseCurve(value: string, fallback: EffectLayerDraft["opacityCurve"]): EffectLayerDraft["opacityCurve"] {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      Array.isArray(parsed) &&
      parsed.every(
        (point) =>
          typeof point === "object" &&
          point !== null &&
          typeof (point as { at?: unknown }).at === "number" &&
          typeof (point as { value?: unknown }).value === "number",
      )
    ) {
      return parsed as EffectLayerDraft["opacityCurve"];
    }
  } catch {
    // keep fallback
  }

  return fallback;
}

function parseVecArray(value: string, fallback: EffectLayerDraft["spawn"]["anchors"]): EffectLayerDraft["spawn"]["anchors"] {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      Array.isArray(parsed) &&
      parsed.every(
        (point) =>
          typeof point === "object" &&
          point !== null &&
          typeof (point as { x?: unknown }).x === "number" &&
          typeof (point as { y?: unknown }).y === "number",
      )
    ) {
      return parsed as EffectLayerDraft["spawn"]["anchors"];
    }
  } catch {
    // keep fallback
  }

  return fallback;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueId(base: string, existing: readonly string[]): string {
  const slug = slugify(base) || "effect";
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

window.addEventListener("beforeunload", () => {
  // The page owns GPU device lifetime; browser teardown releases it after navigation.
});
