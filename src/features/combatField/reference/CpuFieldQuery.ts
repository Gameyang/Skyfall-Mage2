// Responsibility: Sample CPU reference field coverage for entity hitboxes.
// Owner: features/combatField/reference

import { combatMaterialIds, type CombatFieldQueryRequest, type CombatFieldQueryResult } from "../CombatFieldTypes";
import type { CpuFieldBuffers } from "./CpuFieldBuffers";
import { indexOfCell } from "./CpuFieldBuffers";

export function queryCpuField(buffers: CpuFieldBuffers, request: CombatFieldQueryRequest): CombatFieldQueryResult[] {
  return request.hitboxes.map((hitbox) => {
    const centerX = Math.round(hitbox.x * (buffers.width - 1));
    const centerY = Math.round(hitbox.y * (buffers.height - 1));
    const radiusCells = Math.max(1, Math.ceil(hitbox.radius * Math.max(buffers.width, buffers.height)));
    let sampled = 0;
    let fire = 0;
    let force = 0;
    let water = 0;
    let magic = 0;
    let liquid = 0;
    let solid = 0;

    for (let y = centerY - radiusCells; y <= centerY + radiusCells; y += 1) {
      for (let x = centerX - radiusCells; x <= centerX + radiusCells; x += 1) {
        if (x < 0 || x >= buffers.width || y < 0 || y >= buffers.height) {
          continue;
        }

        const dx = x - centerX;
        const dy = y - centerY;

        if (dx * dx + dy * dy > radiusCells * radiusCells) {
          continue;
        }

        sampled += 1;
        const material = buffers.material[indexOfCell(buffers, x, y)];

        if (material === combatMaterialIds.fire || material === combatMaterialIds.spark) {
          fire += 1;
        } else if (material === combatMaterialIds.lava) {
          fire += 1;
          liquid += 1;
        } else if (material === combatMaterialIds.force) {
          force += 1;
        } else if (material === combatMaterialIds.water || material === combatMaterialIds.steam) {
          water += 1;
        }

        if (material === combatMaterialIds.magicLiquid || material === combatMaterialIds.magicEnergy) {
          magic += 1;
        }

        if (
          material === combatMaterialIds.water ||
          material === combatMaterialIds.lava ||
          material === combatMaterialIds.acid ||
          material === combatMaterialIds.toxicSludge ||
          material === combatMaterialIds.magicLiquid
        ) {
          liquid += 1;
        }

        if (
          material === combatMaterialIds.staticTerrain ||
          material === combatMaterialIds.rock ||
          material === combatMaterialIds.corrodibleTerrain ||
          material === combatMaterialIds.burnableTerrain ||
          material === combatMaterialIds.ice
        ) {
          solid += 1;
        }
      }
    }

    const fireCoverage = sampled === 0 ? 0 : fire / sampled;
    const forceCoverage = sampled === 0 ? 0 : force / sampled;
    const waterCoverage = sampled === 0 ? 0 : water / sampled;
    const magicCoverage = sampled === 0 ? 0 : magic / sampled;
    const liquidCoverage = sampled === 0 ? 0 : liquid / sampled;
    const solidCoverage = sampled === 0 ? 0 : solid / sampled;

    return {
      entityId: hitbox.id,
      fireCoverage,
      forceCoverage,
      waterCoverage,
      magicCoverage,
      liquidCoverage,
      solidCoverage,
      movementScale: Math.max(0.45, 1 - liquidCoverage * 0.35 - solidCoverage * 0.5 + forceCoverage * 0.1),
      statusEffect: magicCoverage > 0.15 ? "magic" : fireCoverage > 0.2 ? "burning" : liquidCoverage > 0.3 ? "slowed" : null,
      damage: fireCoverage * 18 + forceCoverage * 9 + magicCoverage * 6,
    };
  });
}
