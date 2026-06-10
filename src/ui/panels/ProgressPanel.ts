// Responsibility: Render player status rail and resource meters.
// Owner: ui/panels

import { createMeter, type MeterHandle } from "../components/Meter";
import { t } from "../../content/strings/GameStrings";
import type { ProgressViewModel } from "../viewModels/createProgressViewModel";

export class ProgressPanel {
  readonly element: HTMLElement;
  private readonly title: HTMLElement;
  private readonly level: HTMLElement;
  private readonly environment: HTMLElement;
  private readonly skillPoints: HTMLElement;
  private readonly hpMeter: MeterHandle;
  private readonly manaMeter: MeterHandle;

  constructor() {
    this.element = document.createElement("section");
    this.element.className = "progress-panel";
    this.title = document.createElement("h2");
    this.level = document.createElement("div");
    this.level.className = "status-value";
    this.environment = document.createElement("div");
    this.environment.className = "status-value";
    this.skillPoints = document.createElement("div");
    this.skillPoints.className = "status-value";
    this.hpMeter = createMeter("hp-meter");
    this.manaMeter = createMeter("mana-meter");

    const stats = document.createElement("div");
    stats.className = "status-grid";
    stats.append(
      createStatusCell(t("progress.level"), this.level),
      createStatusCell(t("progress.field"), this.environment),
      createStatusCell(t("progress.skillPoints"), this.skillPoints),
    );

    this.element.append(this.title, this.hpMeter.element, this.manaMeter.element, stats);
  }

  update(viewModel: ProgressViewModel): void {
    this.title.textContent = viewModel.playerName;
    this.level.textContent = String(viewModel.level);
    this.environment.textContent = viewModel.environment;
    this.skillPoints.textContent = String(viewModel.skillPoints);
    this.hpMeter.update(viewModel.hpCurrent, viewModel.hpMax);
    this.manaMeter.update(viewModel.manaCurrent, viewModel.manaMax);
  }
}

function createStatusCell(label: string, value: HTMLElement): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "status-cell";
  const caption = document.createElement("span");
  caption.textContent = label;
  cell.append(caption, value);
  return cell;
}
