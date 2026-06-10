// Responsibility: Build stable top-level DOM regions for the game shell.
// Owner: ui/shell

import { t } from "../../content/strings/GameStrings";

export interface AppLayoutOptions {
  readonly battlePanelElement: HTMLElement;
  readonly sidePanelElement: HTMLElement;
  readonly modalLayerElement: HTMLElement;
}

export function createAppLayout(options: AppLayoutOptions): HTMLElement {
  const element = document.createElement("main");
  element.className = "skyfall-app";

  const rotateNotice = createRotateNotice();
  const frame = document.createElement("div");
  frame.className = "app-frame";
  frame.append(options.battlePanelElement, options.sidePanelElement, options.modalLayerElement);

  element.append(rotateNotice, frame);
  return element;
}

function createRotateNotice(): HTMLElement {
  const rotateNotice = document.createElement("section");
  rotateNotice.className = "rotate-notice";

  const rotateTitle = document.createElement("h1");
  rotateTitle.textContent = t("app.title");

  const rotateText = document.createElement("p");
  rotateText.textContent = t("layout.rotateDevice");

  rotateNotice.append(rotateTitle, rotateText);
  return rotateNotice;
}
