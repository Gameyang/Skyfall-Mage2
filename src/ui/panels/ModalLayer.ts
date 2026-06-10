// Responsibility: Host transient modal content without coupling it to gameplay rules.
// Owner: ui/panels

import type { GameCommand } from "../../core/state/Command";
import type { GameState } from "../../core/state/GameState";
import { t } from "../../content/strings/GameStrings";
import { levelRewards } from "../../features/progression/RewardSystem";
import { bindPressAction } from "../components/PressAction";

type CommandSink = (command: GameCommand) => void;

export class ModalLayer {
  readonly element: HTMLElement;
  private lastSignature = "";

  constructor(private readonly sink: CommandSink) {
    this.element = document.createElement("div");
    this.element.className = "modal-layer";
    this.element.hidden = true;
  }

  update(state: GameState): void {
    const signature = `${state.progression.pendingLevelUpRewards}:${state.session.reviveQuiz?.id ?? ""}`;

    if (signature === this.lastSignature) {
      return;
    }

    this.lastSignature = signature;

    if (state.session.reviveQuiz) {
      this.renderReviveQuiz(state.session.reviveQuiz);
      return;
    }

    if (state.progression.pendingLevelUpRewards <= 0) {
      this.clear();
      return;
    }

    this.element.hidden = false;

    const card = document.createElement("section");
    card.className = "modal-card";

    const title = document.createElement("h2");
    title.textContent = t("modal.levelUp");

    const rewardGrid = document.createElement("div");
    rewardGrid.className = "modal-actions";
    rewardGrid.append(
      ...levelRewards.map((reward) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "modal-action";
        button.textContent = t(reward.labelKey);
        bindPressAction(button, () => this.sink({ type: "SelectLevelUpReward", rewardId: reward.id }));
        return button;
      }),
    );

    const close = document.createElement("button");
    close.type = "button";
    close.className = "modal-close";
    close.textContent = t("common.close");
    bindPressAction(close, () => this.sink({ type: "DismissModal", modalId: "level-up" }));

    card.append(title, rewardGrid, close);
    this.element.replaceChildren(card);
  }

  private renderReviveQuiz(quiz: NonNullable<GameState["session"]["reviveQuiz"]>): void {
    this.element.hidden = false;

    const card = document.createElement("section");
    card.className = "modal-card";

    const title = document.createElement("h2");
    title.textContent = t("modal.revive");

    const prompt = document.createElement("div");
    prompt.className = "modal-prompt";
    prompt.textContent = t(quiz.promptKey);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    actions.append(
      ...quiz.choiceKeys.map((choiceKey) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "modal-action";
        button.textContent = t(choiceKey);
        bindPressAction(button, () => this.sink({ type: "AnswerReviveQuiz", answerKey: choiceKey }));
        return button;
      }),
    );

    card.append(title, prompt, actions);
    this.element.replaceChildren(card);
  }

  clear(): void {
    this.element.hidden = true;
    this.element.replaceChildren();
  }
}
