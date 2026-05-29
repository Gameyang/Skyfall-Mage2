// Responsibility: Parse small authored material registry fixtures into simulation metadata.
// Owner: features/combatField/materials

import { combatMaterialIds, type CombatMaterialName } from "../CombatFieldTypes";
import type { MaterialDefinition, MaterialMotionClass } from "./MaterialDefinition";
import type { MaterialReactionDefinition, MaterialRegistryDefinition } from "./MaterialReactionDefinition";

const motionClasses = new Set<MaterialMotionClass>(["none", "powder", "liquid", "gas", "energy"]);

export function parseMaterialRegistryXml(xml: string): MaterialRegistryDefinition {
  return {
    materials: parseElementAttributes(xml, "material").map(parseMaterial),
    reactions: parseElementAttributes(xml, "reaction").map(parseReaction),
  };
}

function parseMaterial(attributes: Readonly<Record<string, string>>): MaterialDefinition {
  const id = parseMaterialName(attributes.id, "material id");
  const motion = attributes.motion;

  if (!motionClasses.has(motion as MaterialMotionClass)) {
    throw new Error(`Unknown material motion class: ${motion}`);
  }

  return {
    id,
    density: parseNumber(attributes.density, `${id}.density`),
    motion: motion as MaterialMotionClass,
    heatCapacity: parseNumber(attributes.heatCapacity, `${id}.heatCapacity`),
    color: parseColor(attributes.color, `${id}.color`),
  };
}

function parseReaction(attributes: Readonly<Record<string, string>>): MaterialReactionDefinition {
  const id = attributes.id;

  if (!id) {
    throw new Error("Reaction is missing id");
  }

  return {
    id,
    inputA: parseMaterialName(attributes.inputA, `${id}.inputA`),
    inputB: parseMaterialName(attributes.inputB, `${id}.inputB`),
    resultA: parseMaterialName(attributes.resultA, `${id}.resultA`),
    resultB: parseMaterialName(attributes.resultB, `${id}.resultB`),
    heatDelta: parseNumber(attributes.heatDelta, `${id}.heatDelta`),
    life: parseNumber(attributes.life, `${id}.life`),
  };
}

function parseElementAttributes(xml: string, tagName: string): ReadonlyArray<Readonly<Record<string, string>>> {
  const attributes: Readonly<Record<string, string>>[] = [];
  const tagPattern = new RegExp(`<${tagName}\\s+([^>]+?)/?>`, "g");
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(xml)) !== null) {
    attributes.push(parseAttributes(match[1] ?? ""));
  }

  return attributes;
}

function parseAttributes(source: string): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z][\w-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(source)) !== null) {
    attributes[match[1]!] = match[2]!;
  }

  return attributes;
}

function parseMaterialName(value: string | undefined, label: string): CombatMaterialName {
  if (!value || !(value in combatMaterialIds)) {
    throw new Error(`Unknown ${label}: ${value ?? ""}`);
  }

  return value as CombatMaterialName;
}

function parseNumber(value: string | undefined, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${label}: ${value ?? ""}`);
  }

  return parsed;
}

function parseColor(value: string | undefined, label: string): readonly [number, number, number, number] {
  const parts = value?.split(",").map(Number) ?? [];

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid color for ${label}: ${value ?? ""}`);
  }

  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
}
