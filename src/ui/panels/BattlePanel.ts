// Responsibility: Render the combat canvas, HUD, markers, and mobile joystick surface.
// Owner: ui/panels

import type { BattleViewModel } from "../viewModels/createBattleViewModel";

export class BattlePanel {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly playfieldElement: HTMLElement;
  readonly joystickElement: HTMLElement;
  private readonly gpuBadge: HTMLElement;
  private readonly waveChip: HTMLElement;
  private readonly timeChip: HTMLElement;
  private readonly fieldChip: HTMLElement;
  private readonly emitterChip: HTMLElement;
  private readonly playerMarker: HTMLElement;
  private readonly aimMarker: HTMLElement;
  private readonly enemyLayer: HTMLElement;
  private readonly dropLayer: HTMLElement;

  constructor() {
    this.element = document.createElement("section");
    this.element.className = "battle-panel";
    this.playfieldElement = document.createElement("div");
    this.playfieldElement.className = "playfield";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "battle-canvas";

    const hud = document.createElement("div");
    hud.className = "field-hud";
    const chipRow = document.createElement("div");
    chipRow.className = "chip-row";
    this.waveChip = createChip();
    this.timeChip = createChip();
    this.fieldChip = createChip();
    this.emitterChip = createChip();
    chipRow.append(this.waveChip, this.timeChip, this.fieldChip, this.emitterChip);
    this.gpuBadge = document.createElement("div");
    this.gpuBadge.className = "gpu-badge";
    hud.append(chipRow, this.gpuBadge);

    this.playerMarker = document.createElement("div");
    this.playerMarker.className = "field-marker player-marker";
    this.aimMarker = document.createElement("div");
    this.aimMarker.className = "field-marker aim-marker";
    this.enemyLayer = document.createElement("div");
    this.enemyLayer.className = "enemy-layer";
    this.dropLayer = document.createElement("div");
    this.dropLayer.className = "drop-layer";
    this.joystickElement = document.createElement("div");
    this.joystickElement.className = "virtual-joystick";

    this.playfieldElement.append(
      this.canvas,
      hud,
      this.dropLayer,
      this.enemyLayer,
      this.playerMarker,
      this.aimMarker,
      this.joystickElement,
    );
    this.element.append(this.playfieldElement);
  }

  setGpuStatus(label: string, status: "ready" | "degraded"): void {
    this.gpuBadge.textContent = label;
    this.gpuBadge.dataset.status = status;
    this.playfieldElement.dataset.gpuStatus = status;
  }

  update(viewModel: BattleViewModel): void {
    this.waveChip.textContent = viewModel.waveLabel;
    this.timeChip.textContent = `${viewModel.elapsedSeconds}s`;
    this.fieldChip.textContent = viewModel.fieldLabel;
    this.emitterChip.textContent = `Emitters ${viewModel.emitterCount}`;
    this.playerMarker.style.left = `${viewModel.playerXPercent}%`;
    this.playerMarker.style.top = `${viewModel.playerYPercent}%`;
    this.aimMarker.style.left = `${viewModel.aimXPercent}%`;
    this.aimMarker.style.top = `${viewModel.aimYPercent}%`;
    this.enemyLayer.replaceChildren(...viewModel.enemies.map(createEnemyMarker));
    this.dropLayer.replaceChildren(...viewModel.itemDrops.map(createDropMarker));
  }
}

function createChip(): HTMLElement {
  const chip = document.createElement("div");
  chip.className = "chip";
  return chip;
}

function createEnemyMarker(enemy: BattleViewModel["enemies"][number]): HTMLElement {
  const marker = document.createElement("div");
  marker.className = "field-marker enemy-marker";
  marker.style.left = `${enemy.xPercent}%`;
  marker.style.top = `${enemy.yPercent}%`;
  marker.dataset.enemyId = enemy.id;

  const hp = document.createElement("div");
  hp.className = "enemy-hp";
  const fill = document.createElement("div");
  fill.style.transform = `scaleX(${Math.max(0, Math.min(1, enemy.hpPercent))})`;
  hp.append(fill);
  marker.append(hp);
  return marker;
}

function createDropMarker(drop: BattleViewModel["itemDrops"][number]): HTMLElement {
  const marker = document.createElement("div");
  marker.className = "field-marker item-drop-marker";
  marker.style.left = `${drop.xPercent}%`;
  marker.style.top = `${drop.yPercent}%`;
  marker.dataset.dropId = drop.id;
  marker.dataset.itemId = drop.itemId;
  return marker;
}
