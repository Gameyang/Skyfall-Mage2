// Responsibility: Load and resolve localized game-facing strings from CSV data.
// Owner: content/strings

import gameStringsCsv from "./gameStrings.csv?raw";

export type GameStringKey = string;
export type GameStringParams = Readonly<Record<string, number | string>>;

export interface ParsedGameStrings {
  readonly locales: readonly string[];
  readonly entries: ReadonlyMap<string, Readonly<Record<string, string>>>;
}

export const defaultGameStringLocale = "ko";
export const englishGameStringLocale = "en";

let currentGameStringLocale = defaultGameStringLocale;
const gameStrings = parseGameStringsCsv(gameStringsCsv);

export function setGameStringLocale(locale: string): void {
  currentGameStringLocale = locale;
}

export function getGameStringLocale(): string {
  return currentGameStringLocale;
}

export function t(key: GameStringKey, params: GameStringParams = {}): string {
  return formatGameString(gameStrings, key, currentGameStringLocale, params);
}

export function formatGameString(
  strings: ParsedGameStrings,
  key: GameStringKey,
  locale: string,
  params: GameStringParams = {},
): string {
  const entry = strings.entries.get(key);
  const template = entry?.[locale] || entry?.[defaultGameStringLocale] || entry?.[englishGameStringLocale] || key;
  return interpolateGameString(template, params);
}

export function parseGameStringsCsv(csv: string): ParsedGameStrings {
  const rows = parseCsvRows(csv).filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length === 0) {
    return { locales: [], entries: new Map() };
  }

  const [header, ...dataRows] = rows;
  const keyColumn = header.indexOf("key");

  if (keyColumn < 0) {
    throw new Error("Game string CSV must include a key column.");
  }

  const locales = header.filter((column, index) => index !== keyColumn && column.trim().length > 0);
  const entries = new Map<string, Readonly<Record<string, string>>>();

  for (const row of dataRows) {
    const key = row[keyColumn]?.trim() ?? "";

    if (!key) {
      continue;
    }

    if (entries.has(key)) {
      throw new Error(`Duplicate game string key: ${key}`);
    }

    const values: Record<string, string> = {};

    for (let index = 0; index < header.length; index += 1) {
      const locale = header[index];

      if (index === keyColumn || !locale) {
        continue;
      }

      values[locale] = row[index] ?? "";
    }

    entries.set(key, values);
  }

  return { locales, entries };
}

export function interpolateGameString(template: string, params: GameStringParams): string {
  return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error("Game string CSV has an unterminated quoted field.");
  }

  return rows;
}
