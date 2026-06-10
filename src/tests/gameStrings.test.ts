import { describe, expect, it } from "vitest";

import { starterEnemies } from "../content/enemies/starterEnemies";
import { starterItems } from "../content/items/starterItems";
import gameStringsCsv from "../content/strings/gameStrings.csv?raw";
import { defaultGameStringLocale, formatGameString, parseGameStringsCsv, t } from "../content/strings/GameStrings";
import { createInitialEnvironmentState } from "../core/state/EnvironmentState";
import { createInitialPlayerState } from "../core/state/PlayerState";
import { createReviveQuiz } from "../features/progression/QuizReviveSystem";
import { levelRewards } from "../features/progression/RewardSystem";
import { starterSkills } from "../features/progression/SkillTreeSystem";

describe("game strings", () => {
  it("resolves bundled strings by key and interpolates parameters", () => {
    expect(defaultGameStringLocale).toBe("ko");
    expect(t("battle.wave", { waveIndex: 3 })).toBe("웨이브 3");
    expect(t("item.fire-staff.name")).toBe("화염 지팡이");
  });

  it("parses CSV strings with locale fallback and quoted commas", () => {
    const strings = parseGameStringsCsv('key,ko,en\nsample,,"Hello, {name}"\n');

    expect(formatGameString(strings, "sample", "ko", { name: "Mage" })).toBe("Hello, Mage");
  });

  it("resolves the preserved English strings on request", () => {
    const strings = parseGameStringsCsv(gameStringsCsv);

    expect(formatGameString(strings, "battle.wave", "en", { waveIndex: 3 })).toBe("Wave 3");
    expect(formatGameString(strings, "item.fire-staff.name", "en")).toBe("Fire Staff");
  });

  it("keeps bundled Korean and English strings synchronized", () => {
    const strings = parseGameStringsCsv(gameStringsCsv);
    const problems: string[] = [];

    expect(strings.locales).toEqual(["ko", "en"]);

    for (const [key, entry] of strings.entries) {
      const korean = entry.ko ?? "";
      const english = entry.en ?? "";

      if (!korean.trim()) {
        problems.push(`${key}:ko`);
      }

      if (!english.trim()) {
        problems.push(`${key}:en`);
      }

      if (placeholderSignature(korean) !== placeholderSignature(english)) {
        problems.push(`${key}:placeholders`);
      }
    }

    expect(problems).toEqual([]);
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

function placeholderSignature(value: string): string {
  return [...value.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)].map((match) => match[1]).sort().join("|");
}
