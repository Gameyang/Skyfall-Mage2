// Responsibility: Render an initial skill tree surface driven by progression state.
// Owner: ui/panels

import type { GameCommand } from "../../core/state/Command";
import type { GameState } from "../../core/state/GameState";
import { t } from "../../content/strings/GameStrings";
import { canUnlockSkill, starterSkills } from "../../features/progression/SkillTreeSystem";
import { bindPressAction } from "../components/PressAction";

type CommandSink = (command: GameCommand) => void;

export class SkillTreePanel {
  readonly element: HTMLElement;
  private lastSignature = "";

  constructor(private readonly sink: CommandSink) {
    this.element = document.createElement("section");
    this.element.className = "skill-panel";
  }

  update(state: GameState): void {
    const signature = [
      state.progression.skillPoints,
      ...state.progression.unlockedSkillIds,
    ].join("|");

    if (signature === this.lastSignature) {
      return;
    }

    this.lastSignature = signature;

    this.element.replaceChildren(
      ...starterSkills.map((skill) => {
        const active = state.progression.unlockedSkillIds.includes(skill.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "skill-node";
        button.dataset.active = String(active);
        button.disabled = active || !canUnlockSkill(state, skill.id);
        button.textContent = `${t(skill.labelKey)} ${active ? t("common.on") : skill.cost}`;
        bindPressAction(button, () => this.sink({ type: "UnlockSkill", skillId: skill.id }));
        return button;
      }),
    );
  }
}
