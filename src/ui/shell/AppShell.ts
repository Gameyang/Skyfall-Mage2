// Responsibility: Compose the first-screen game shell and publish state to panels.
// Owner: ui/shell

import type { GameCommand } from "../../core/state/Command";
import type { GameState } from "../../core/state/GameState";
import { BattlePanel } from "../panels/BattlePanel";
import { InventoryPanel } from "../panels/InventoryPanel";
import { ModalLayer } from "../panels/ModalLayer";
import { ProgressPanel } from "../panels/ProgressPanel";
import { ShopPanel } from "../panels/ShopPanel";
import { SkillTreePanel } from "../panels/SkillTreePanel";
import { Tabs } from "../components/Tabs";
import { createBattleViewModel } from "../viewModels/createBattleViewModel";
import { createInventoryViewModel } from "../viewModels/createInventoryViewModel";
import { createProgressViewModel } from "../viewModels/createProgressViewModel";
import { createShopViewModel } from "../viewModels/createShopViewModel";
import { createAppLayout } from "./AppLayout";
import { createMobileFullscreenController, type MobileFullscreenController } from "./MobileFullscreenController";
import { createPanelHost } from "./PanelHost";
import { createViewportLayoutController, type ViewportLayoutController } from "./ViewportLayoutController";

export interface AppShellOptions {
  readonly dispatch: (command: GameCommand) => void;
}

export class AppShell {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly playfieldElement: HTMLElement;
  readonly joystickElement: HTMLElement;
  private readonly layoutController: ViewportLayoutController;
  private readonly mobileFullscreenController: MobileFullscreenController;
  private readonly battlePanel: BattlePanel;
  private readonly progressPanel: ProgressPanel;
  private readonly inventoryPanel: InventoryPanel;
  private readonly skillTreePanel: SkillTreePanel;
  private readonly shopPanel: ShopPanel;
  private readonly modalLayer: ModalLayer;

  constructor(options: AppShellOptions) {
    this.battlePanel = new BattlePanel();
    this.progressPanel = new ProgressPanel();
    this.inventoryPanel = new InventoryPanel(options.dispatch);
    this.skillTreePanel = new SkillTreePanel(options.dispatch);
    this.shopPanel = new ShopPanel(options.dispatch);
    this.modalLayer = new ModalLayer(options.dispatch);

    const sidePanel = createPanelHost("side-panel");
    const tabs = new Tabs([
      { id: "inventory", label: "Items", content: this.inventoryPanel.element },
      { id: "skills", label: "Skills", content: this.skillTreePanel.element },
      { id: "shop", label: "Shop", content: this.shopPanel.element },
      { id: "locked", label: "Lock", content: createLockedPanel() },
    ]);
    sidePanel.append(this.progressPanel.element, tabs.element);

    this.element = createAppLayout({
      battlePanelElement: this.battlePanel.element,
      sidePanelElement: sidePanel,
      modalLayerElement: this.modalLayer.element,
    });
    this.layoutController = createViewportLayoutController(this.element);
    this.mobileFullscreenController = createMobileFullscreenController(this.element);
    this.canvas = this.battlePanel.canvas;
    this.playfieldElement = this.battlePanel.playfieldElement;
    this.joystickElement = this.battlePanel.joystickElement;
  }

  setGpuStatus(label: string, status: "ready" | "degraded"): void {
    this.battlePanel.setGpuStatus(label, status);
  }

  update(state: GameState): void {
    this.battlePanel.update(createBattleViewModel(state));
    this.progressPanel.update(createProgressViewModel(state));
    this.inventoryPanel.update(createInventoryViewModel(state));
    this.skillTreePanel.update(state);
    this.shopPanel.update(createShopViewModel(state));
    this.modalLayer.update(state);
  }

  dispose(): void {
    this.layoutController.dispose();
    this.mobileFullscreenController.dispose();
    this.element.replaceChildren();
  }
}

function createLockedPanel(): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "locked-panel";
  const badge = document.createElement("div");
  badge.className = "locked-badge";
  badge.textContent = "Soon";
  panel.append(badge);
  return panel;
}
