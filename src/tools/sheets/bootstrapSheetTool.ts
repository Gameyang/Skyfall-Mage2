// Responsibility: Bootstrap the local-only shared sprite-sheet metadata editor.
// Owner: tools/sheets

import { sheetDefinitions } from "../../content/sheets/sheetLibrary";
import { resolveSheetAssetUrl } from "../../content/sheets/sheetResolver";
import type { SheetAssetScope, SheetDefinition, SheetFrameMode } from "../../content/sheets/sheetTypes";
import { assetUrls, skinAssetUrls } from "../../platform/assets";
import { createSheetRectEditor, normalizeEditableSheetRect } from "./SheetRectEditor";
import "./sheetsTool.css";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

type SheetDefinitionDraft = Mutable<SheetDefinition>;

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

  private readonly assetOptions = collectAssetOptions();
  private readonly list = document.createElement("div");
  private readonly stage = document.createElement("section");
  private readonly inspector = document.createElement("aside");
  private readonly status = document.createElement("div");

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.definitions = await loadSheetDefinitions();
    this.selectedId = this.definitions[0]?.id ?? "";
    this.renderShell();
    this.renderAll();
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
    const assetUrl = resolveSheetAssetUrl(definition.asset);
    const content = document.createElement("div");
    content.className = "sheet-stage-content";
    const header = document.createElement("div");
    header.className = "sheet-stage-header";
    const title = document.createElement("h2");
    title.textContent = definition.label;
    const meta = document.createElement("span");
    meta.textContent = `${definition.frameCount} frames / ${definition.frameMs} ms`;
    header.append(title, meta);
    content.append(
      header,
      createSheetRectEditor({
        textureUrl: assetUrl,
        textureLabel: definition.label,
        rect: definition.rect,
        onChange: (rect) => {
          definition.rect = rect;
        },
      }),
    );
    this.stage.replaceChildren(content);
  }

  private renderInspector(): void {
    const definition = this.getSelectedDefinition();

    if (!definition) {
      this.inspector.replaceChildren();
      return;
    }

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
          this.renderAll();
        }),
        createSelectControl("Key", this.getAssetKeysForScope(definition.asset.scope), definition.asset.key, (value) => {
          definition.asset.key = value;
          this.renderList();
          this.renderStage();
        }),
      ]),
      createSection("Frames", [
        createNumberControl("Frame Count", definition.frameCount, 1, 1, 256, (value) => {
          definition.frameCount = Math.max(1, Math.floor(value));
          this.renderStage();
        }),
        createNumberControl("Frame Ms", definition.frameMs, 1, 1, 5_000, (value) => {
          definition.frameMs = Math.max(1, value);
          this.renderStage();
        }),
        createSelectControl("Frame Mode", frameModes, definition.frameMode, (value) => {
          definition.frameMode = value;
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

  private createDefinition(): void {
    const asset = this.assetOptions[0] ?? { scope: "effects", key: "", url: "" };
    const id = uniqueId("sheet", this.definitions.map((definition) => definition.id));
    const definition: SheetDefinitionDraft = {
      id,
      label: titleCase(id),
      asset: { scope: asset.scope, key: asset.key },
      rect: { x: 0, y: 0, width: 1, height: 1 },
      frameCount: 1,
      frameMs: 80,
      frameMode: "loop",
      tags: [asset.scope],
    };
    this.definitions.push(definition);
    this.selectedId = definition.id;
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
    this.definitions.push(clone);
    this.selectedId = clone.id;
    this.renderAll();
  }

  private async saveDefinitions(): Promise<void> {
    this.status.textContent = "Saving";

    try {
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
