// Responsibility: Render tab controls and switch visible panel content.
// Owner: ui/components

import { bindPressAction } from "./PressAction";

export interface TabDefinition {
  readonly id: string;
  readonly label: string;
  readonly content: HTMLElement;
}

export class Tabs {
  readonly element: HTMLElement;
  private readonly buttonRow: HTMLElement;
  private readonly panelHost: HTMLElement;
  private activeId: string;

  constructor(private readonly tabs: readonly TabDefinition[]) {
    this.element = document.createElement("section");
    this.element.className = "tabs";
    this.buttonRow = document.createElement("div");
    this.buttonRow.className = "tab-buttons";
    this.panelHost = document.createElement("div");
    this.panelHost.className = "tab-panel-host";
    this.activeId = tabs[0]?.id ?? "";
    this.element.append(this.buttonRow, this.panelHost);
    this.render();
  }

  private render(): void {
    this.buttonRow.replaceChildren(
      ...this.tabs.map((tab) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tab-button";
        button.dataset.active = String(tab.id === this.activeId);
        button.textContent = tab.label;
        bindPressAction(button, () => {
          this.activeId = tab.id;
          this.render();
        });
        return button;
      }),
    );

    const active = this.tabs.find((tab) => tab.id === this.activeId);
    this.panelHost.replaceChildren(active?.content ?? document.createElement("div"));
  }
}
