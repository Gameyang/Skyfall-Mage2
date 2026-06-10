// Responsibility: Provide a reusable local sprite-sheet crop editor widget.
// Owner: tools/sheets

import type { SheetRect } from "../../content/sheets/sheetTypes";
import "./sheetRectEditor.css";

export interface SheetRectEditorOptions {
  readonly textureUrl: string;
  readonly textureLabel: string;
  readonly rect: SheetRect;
  readonly disabled?: boolean;
  readonly onChange: (rect: SheetRect) => void;
}

export interface SheetMultiRectEditorItem {
  readonly id: string;
  readonly label: string;
  readonly rect: SheetRect;
}

export interface SheetMultiRectEditorOptions {
  readonly textureUrl: string;
  readonly textureLabel: string;
  readonly rects: readonly SheetMultiRectEditorItem[];
  readonly selectedId?: string;
  readonly disabled?: boolean;
  readonly onSelect?: (id: string) => void;
  readonly onChange: (id: string, rect: SheetRect) => void;
}

export function createSheetRectEditor(options: SheetRectEditorOptions): HTMLElement {
  let currentRect = normalizeEditableSheetRect(options.rect);
  const wrapper = document.createElement("div");
  wrapper.className = "sheet-rect-editor";
  wrapper.dataset.disabled = String(options.disabled === true);

  const frame = document.createElement("div");
  frame.className = "sheet-rect-frame";
  const image = document.createElement("img");
  image.src = options.textureUrl;
  image.alt = options.textureLabel;
  image.draggable = false;
  const selection = document.createElement("div");
  selection.className = "sheet-rect-selection";
  const handle = document.createElement("div");
  handle.className = "sheet-rect-handle";
  selection.append(handle);
  frame.append(image, selection);

  const controls = document.createElement("div");
  controls.className = "sheet-rect-controls";
  const xInput = createNumberInput(currentRect.x, 0.001, 0, 1, (value) => {
    currentRect = { ...currentRect, x: value };
    syncSelection(true);
  });
  const yInput = createNumberInput(currentRect.y, 0.001, 0, 1, (value) => {
    currentRect = { ...currentRect, y: value };
    syncSelection(true);
  });
  const widthInput = createNumberInput(currentRect.width, 0.001, 0.001, 1, (value) => {
    currentRect = { ...currentRect, width: value };
    syncSelection(true);
  });
  const heightInput = createNumberInput(currentRect.height, 0.001, 0.001, 1, (value) => {
    currentRect = { ...currentRect, height: value };
    syncSelection(true);
  });

  for (const input of [xInput, yInput, widthInput, heightInput]) {
    input.disabled = options.disabled === true;
  }

  controls.append(
    createLabeledInput("X", xInput),
    createLabeledInput("Y", yInput),
    createLabeledInput("W", widthInput),
    createLabeledInput("H", heightInput),
  );

  let dragState:
    | {
        readonly mode: "move" | "resize";
        readonly pointerId: number;
        readonly startX: number;
        readonly startY: number;
        readonly startRect: SheetRect;
        readonly target: HTMLElement;
      }
    | null = null;

  const beginDrag = (event: PointerEvent, mode: "move" | "resize"): void => {
    if (options.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    dragState = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { ...currentRect },
      target,
    };

    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners below keep the drag active if capture is unavailable.
    }

    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", endDrag, { once: true });
    window.addEventListener("pointercancel", endDrag, { once: true });
  };

  const onDragMove = (event: PointerEvent): void => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const box = frame.getBoundingClientRect();

    if (box.width <= 0 || box.height <= 0) {
      return;
    }

    const dx = (event.clientX - dragState.startX) / box.width;
    const dy = (event.clientY - dragState.startY) / box.height;

    currentRect =
      dragState.mode === "move"
        ? { ...dragState.startRect, x: dragState.startRect.x + dx, y: dragState.startRect.y + dy }
        : {
            ...dragState.startRect,
            width: dragState.startRect.width + dx,
            height: dragState.startRect.height + dy,
          };

    syncSelection(true);
  };

  const endDrag = (event: PointerEvent): void => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    window.removeEventListener("pointermove", onDragMove);

    try {
      dragState.target.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released after leaving the frame.
    }

    dragState = null;
  };

  selection.addEventListener("pointerdown", (event) => beginDrag(event, "move"));
  handle.addEventListener("pointerdown", (event) => beginDrag(event, "resize"));

  function syncSelection(emit: boolean): void {
    currentRect = normalizeEditableSheetRect(currentRect);
    selection.style.left = `${currentRect.x * 100}%`;
    selection.style.top = `${currentRect.y * 100}%`;
    selection.style.width = `${currentRect.width * 100}%`;
    selection.style.height = `${currentRect.height * 100}%`;
    xInput.value = currentRect.x.toFixed(3);
    yInput.value = currentRect.y.toFixed(3);
    widthInput.value = currentRect.width.toFixed(3);
    heightInput.value = currentRect.height.toFixed(3);

    if (emit) {
      options.onChange(currentRect);
    }
  }

  syncSelection(false);
  wrapper.append(frame, controls);
  return wrapper;
}

export function createSheetMultiRectEditor(options: SheetMultiRectEditorOptions): HTMLElement {
  const currentRects = options.rects.map((rect) => ({ ...rect, rect: normalizeEditableSheetRect(rect.rect) }));
  let activeId =
    currentRects.find((rect) => rect.id === options.selectedId)?.id ?? currentRects[0]?.id ?? "";
  const wrapper = document.createElement("div");
  wrapper.className = "sheet-rect-editor sheet-multi-rect-editor";
  wrapper.dataset.disabled = String(options.disabled === true);

  const frame = document.createElement("div");
  frame.className = "sheet-rect-frame";
  const image = document.createElement("img");
  image.src = options.textureUrl;
  image.alt = options.textureLabel;
  image.draggable = false;
  frame.append(image);

  const selections = new Map<string, HTMLElement>();

  for (const rect of currentRects) {
    const selection = document.createElement("div");
    selection.className = "sheet-rect-selection sheet-multi-rect-selection";
    selection.dataset.frameId = rect.id;
    const label = document.createElement("span");
    label.className = "sheet-rect-label";
    label.textContent = rect.id;
    selection.append(label);
    selection.addEventListener("pointerdown", (event) => {
      setActiveRect(rect.id, true);
      beginDrag(event, "move");
    });
    selections.set(rect.id, selection);
    frame.append(selection);
  }

  const handle = document.createElement("div");
  handle.className = "sheet-rect-handle";
  handle.addEventListener("pointerdown", (event) => beginDrag(event, "resize"));

  const detail = document.createElement("div");
  detail.className = "sheet-rect-detail-row";
  const selectedLabel = document.createElement("output");
  selectedLabel.className = "sheet-rect-selected-label";
  const xInput = createNumberInput(0, 0.001, 0, 1, (value) => updateActiveRect({ x: value }));
  const yInput = createNumberInput(0, 0.001, 0, 1, (value) => updateActiveRect({ y: value }));
  const widthInput = createNumberInput(1, 0.001, 0.001, 1, (value) => updateActiveRect({ width: value }));
  const heightInput = createNumberInput(1, 0.001, 0.001, 1, (value) => updateActiveRect({ height: value }));

  for (const input of [xInput, yInput, widthInput, heightInput]) {
    input.disabled = options.disabled === true || currentRects.length === 0;
  }

  detail.append(
    selectedLabel,
    createLabeledInput("X", xInput),
    createLabeledInput("Y", yInput),
    createLabeledInput("W", widthInput),
    createLabeledInput("H", heightInput),
  );

  let dragState:
    | {
        readonly mode: "move" | "resize";
        readonly pointerId: number;
        readonly startX: number;
        readonly startY: number;
        readonly startRect: SheetRect;
        readonly target: HTMLElement;
      }
    | null = null;

  const beginDrag = (event: PointerEvent, mode: "move" | "resize"): void => {
    if (options.disabled || currentRects.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const activeRect = findActiveRect();

    if (!activeRect) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    dragState = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { ...activeRect.rect },
      target,
    };

    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners below keep the drag active if capture is unavailable.
    }

    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", endDrag, { once: true });
    window.addEventListener("pointercancel", endDrag, { once: true });
  };

  const onDragMove = (event: PointerEvent): void => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const box = frame.getBoundingClientRect();

    if (box.width <= 0 || box.height <= 0) {
      return;
    }

    const dx = (event.clientX - dragState.startX) / box.width;
    const dy = (event.clientY - dragState.startY) / box.height;
    updateActiveRect(
      dragState.mode === "move"
        ? { x: dragState.startRect.x + dx, y: dragState.startRect.y + dy }
        : { width: dragState.startRect.width + dx, height: dragState.startRect.height + dy },
    );
  };

  const endDrag = (event: PointerEvent): void => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    window.removeEventListener("pointermove", onDragMove);

    try {
      dragState.target.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released after leaving the frame.
    }

    dragState = null;
  };

  function findActiveRect(): (typeof currentRects)[number] | null {
    return currentRects.find((rect) => rect.id === activeId) ?? currentRects[0] ?? null;
  }

  function setActiveRect(id: string, emit: boolean): void {
    if (!currentRects.some((rect) => rect.id === id)) {
      return;
    }

    activeId = id;
    syncSelections();

    if (emit) {
      options.onSelect?.(id);
    }
  }

  function updateActiveRect(patch: Partial<SheetRect>): void {
    const activeRect = findActiveRect();

    if (!activeRect) {
      return;
    }

    activeRect.rect = normalizeEditableSheetRect({ ...activeRect.rect, ...patch });
    syncSelections();
    options.onChange(activeRect.id, activeRect.rect);
  }

  function syncSelections(): void {
    const activeRect = findActiveRect();

    for (const rect of currentRects) {
      const selection = selections.get(rect.id);

      if (!selection) {
        continue;
      }

      selection.dataset.active = String(rect.id === activeRect?.id);
      selection.style.left = `${rect.rect.x * 100}%`;
      selection.style.top = `${rect.rect.y * 100}%`;
      selection.style.width = `${rect.rect.width * 100}%`;
      selection.style.height = `${rect.rect.height * 100}%`;

      if (rect.id === activeRect?.id && !selection.contains(handle)) {
        selection.append(handle);
      }
    }

    if (!activeRect) {
      selectedLabel.textContent = "No rect";
      return;
    }

    selectedLabel.textContent = `${activeRect.label} (${activeRect.id})`;
    xInput.value = activeRect.rect.x.toFixed(3);
    yInput.value = activeRect.rect.y.toFixed(3);
    widthInput.value = activeRect.rect.width.toFixed(3);
    heightInput.value = activeRect.rect.height.toFixed(3);
  }

  syncSelections();
  wrapper.append(frame, detail);
  return wrapper;
}

export function normalizeEditableSheetRect(rect: SheetRect): SheetRect {
  const x = clamp(Number.isFinite(rect.x) ? rect.x : 0, 0, 0.999);
  const y = clamp(Number.isFinite(rect.y) ? rect.y : 0, 0, 0.999);

  return {
    x,
    y,
    width: clamp(Number.isFinite(rect.width) ? rect.width : 1, 0.001, 1 - x),
    height: clamp(Number.isFinite(rect.height) ? rect.height : 1, 0.001, 1 - y),
  };
}

function createLabeledInput(label: string, input: HTMLInputElement): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "sheet-rect-input";
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text, input);
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

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
