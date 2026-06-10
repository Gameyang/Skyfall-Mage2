// Responsibility: Gate first play behind resource loading and a user start gesture.
// Owner: ui/shell

import type { ResourcePreloadProgress } from "../../platform/ResourcePreloader";

export interface TitleScreenStartEvent {
  readonly originalEvent: Event;
}

export type TitleScreenStartHandler = (event: TitleScreenStartEvent) => void;

export class TitleScreen {
  readonly element: HTMLElement;
  private readonly logo: HTMLImageElement;
  private readonly progressFill: HTMLElement;
  private readonly progressValue: HTMLElement;
  private readonly status: HTMLElement;
  private ready = false;
  private hidden = false;

  constructor(logoUrl: string, private readonly onStart: TitleScreenStartHandler) {
    this.element = document.createElement("section");
    this.element.className = "title-screen";
    this.element.tabIndex = 0;
    this.element.setAttribute("role", "button");
    this.element.setAttribute("aria-label", "Start Skyfall Mage2");

    const frame = document.createElement("div");
    frame.className = "title-frame";

    this.logo = document.createElement("img");
    this.logo.className = "title-logo";
    this.logo.src = logoUrl;
    this.logo.alt = "Skyfall Mage2";
    this.logo.decoding = "async";

    const loading = document.createElement("div");
    loading.className = "title-loading";
    const progressTrack = document.createElement("div");
    progressTrack.className = "title-progress";
    this.progressFill = document.createElement("div");
    this.progressFill.className = "title-progress-fill";
    progressTrack.append(this.progressFill);

    this.progressValue = document.createElement("div");
    this.progressValue.className = "title-progress-value";
    this.status = document.createElement("div");
    this.status.className = "title-status";

    loading.append(progressTrack, this.progressValue, this.status);
    frame.append(this.logo, loading);
    this.element.append(frame);

    this.setProgress({ loaded: 0, total: 1, failed: 0, ratio: 0 });

    this.element.addEventListener("pointerdown", this.handleStartGesture);
    this.element.addEventListener("touchstart", this.handleStartGesture, { capture: true, passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
  }

  setProgress(progress: ResourcePreloadProgress): void {
    const ratio = clampRatio(progress.ratio);
    this.progressFill.style.transform = `scaleX(${ratio})`;
    this.progressValue.textContent = `${Math.round(ratio * 100)}%`;
    this.status.textContent = progress.loaded >= progress.total ? "WARMING UP" : "LOADING";
    this.element.dataset.ready = String(this.ready);
  }

  setReady(): void {
    this.ready = true;
    this.element.dataset.ready = "true";
    this.status.textContent = "PRESS ANY KEY";
  }

  hide(): void {
    this.hidden = true;
    this.element.dataset.hidden = "true";
    this.element.setAttribute("aria-hidden", "true");
  }

  dispose(): void {
    this.element.removeEventListener("pointerdown", this.handleStartGesture);
    this.element.removeEventListener("touchstart", this.handleStartGesture, { capture: true });
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  private readonly handleStartGesture = (event: Event): void => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (this.hidden || !this.ready) {
      return;
    }

    this.onStart({ originalEvent: event });
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.hidden || !this.ready) {
      return;
    }

    this.handleStartGesture(event);
  };
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
