import { describe, expect, it } from "vitest";

import { starterEnemies } from "../content/enemies/starterEnemies";
import { starterItems } from "../content/items/starterItems";
import { formatGameString, parseGameStringsCsv, t } from "../content/strings/GameStrings";
import { createInitialEnvironmentState } from "../core/state/EnvironmentState";
import { createInitialPlayerState } from "../core/state/PlayerState";
import { createReviveQuiz } from "../features/progression/QuizReviveSystem";
import { levelRewards } from "../features/progression/RewardSystem";
import { starterSkills } from "../features/progression/SkillTreeSystem";

describe("game strings", () => {
  it("resolves bundled strings by key and interpolates parameters", () => {
    expect(t("battle.wave", { waveIndex: 3 })).toBe("Wave 3");
    expect(t("item.fire-staff.name")).toBe("Fire Staff");
  });

  it("parses CSV strings with locale fallback and quoted commas", () => {
    const strings = parseGameStringsCsv('key,en,ko\nsample,"Hello, {name}",\n');

    expect(formatGameString(strings, "sample", "ko", { name: "Mage" })).toBe("Hello, Mage");
  });

  it("falls back to the missing key when no entry exists", () => {
    expect(t("missing.example")).toBe("missing.example");
  });

  it("contains entries for gameplay display keys", () => {
    const reviveQuiz = createReviveQuiz();
    const keys = [
      createInitialPlayerState().nameKey,
      `environment.${createInitialEnvironmentState().kind}`,
      ...starterItems.map((item) => item.nameKey),
      ...starterEnemies.map((enemy) => enemy.nameKey),
      ...starterSkills.map((skill) => skill.labelKey),
      ...levelRewards.map((reward) => reward.labelKey),
      reviveQuiz.promptKey,
      reviveQuiz.answerKey,
      ...reviveQuiz.choiceKeys,
    ];

    expect(keys.filter((key) => t(key) === key)).toEqual([]);
  });
});
