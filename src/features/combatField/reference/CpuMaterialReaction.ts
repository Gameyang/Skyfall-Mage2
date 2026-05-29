// Responsibility: Resolve simple CPU material reactions for the reference simulator.
// Owner: features/combatField/reference

import { combatMaterialIds, type CombatMaterialId } from "../CombatFieldTypes";
import type { CpuFieldBuffers } from "./CpuFieldBuffers";
import { indexOfCell, inBounds, setCell } from "./CpuFieldBuffers";

export function reactCpuMaterials(buffers: CpuFieldBuffers): void {
  decayEnergy(buffers);
  reactWaterAndFire(buffers);
  reactLavaAndWater(buffers);
  reactToxicSludgeAndWater(buffers);
  reactAcidAndCorrodibleTerrain(buffers);
  reactBurnableTerrain(buffers);
  applyHeatField(buffers);
  applyForcePressure(buffers);
  coolSteam(buffers);
}

function decayEnergy(buffers: CpuFieldBuffers): void {
  for (let index = 0; index < buffers.material.length; index += 1) {
    const material = buffers.material[index];

    if (
      material !== combatMaterialIds.fire &&
      material !== combatMaterialIds.spark &&
      material !== combatMaterialIds.force &&
      material !== combatMaterialIds.smoke
    ) {
      continue;
    }

    if (buffers.life[index] > 0) {
      buffers.life[index] -= 1;
    } else if (material === combatMaterialIds.fire || material === combatMaterialIds.spark) {
      buffers.material[index] = combatMaterialIds.smoke;
      buffers.life[index] = 6;
      buffers.heat[index] = Math.max(0.2, buffers.heat[index] * 0.5);
    } else {
      buffers.material[index] = combatMaterialIds.air;
      buffers.heat[index] = 0;
    }
  }
}

function reactWaterAndFire(buffers: CpuFieldBuffers): void {
  const changes: { readonly x: number; readonly y: number; readonly material: CombatMaterialId; readonly life: number; readonly heat: number }[] = [];

  for (let y = 0; y < buffers.height; y += 1) {
    for (let x = 0; x < buffers.width; x += 1) {
      const index = indexOfCell(buffers, x, y);
      const material = buffers.material[index];

      if (material !== combatMaterialIds.water && material !== combatMaterialIds.fire && material !== combatMaterialIds.spark) {
        continue;
      }

      for (const [dx, dy] of adjacentOffsets) {
        const nx = x + dx;
        const ny = y + dy;

        if (!inBounds(buffers, nx, ny)) {
          continue;
        }

        const neighbor = buffers.material[indexOfCell(buffers, nx, ny)];
        const waterFire =
          (material === combatMaterialIds.water && (neighbor === combatMaterialIds.fire || neighbor === combatMaterialIds.spark)) ||
          ((material === combatMaterialIds.fire || material === combatMaterialIds.spark) && neighbor === combatMaterialIds.water);

        if (waterFire) {
          changes.push({ x, y, material: combatMaterialIds.steam, life: 16, heat: 0.45 });
          changes.push({ x: nx, y: ny, material: combatMaterialIds.steam, life: 14, heat: 0.45 });
        }
      }
    }
  }

  for (const change of changes) {
    setCell(buffers, change.x, change.y, change.material, change.life, change.heat);
  }
}

function reactLavaAndWater(buffers: CpuFieldBuffers): void {
  const changes: { readonly x: number; readonly y: number; readonly material: CombatMaterialId; readonly life: number; readonly heat: number }[] = [];

  forEachAdjacentPair(buffers, (x, y, nx, ny, material, neighbor) => {
    const lavaWater =
      (material === combatMaterialIds.lava && neighbor === combatMaterialIds.water) ||
      (material === combatMaterialIds.water && neighbor === combatMaterialIds.lava);

    if (!lavaWater) {
      return;
    }

    changes.push({ x, y, material: material === combatMaterialIds.lava ? combatMaterialIds.rock : combatMaterialIds.steam, life: 20, heat: 0.5 });
    changes.push({
      x: nx,
      y: ny,
      material: neighbor === combatMaterialIds.lava ? combatMaterialIds.rock : combatMaterialIds.steam,
      life: 20,
      heat: 0.5,
    });
  });

  for (const change of changes) {
    setCell(buffers, change.x, change.y, change.material, change.life, change.heat);
  }
}

function reactToxicSludgeAndWater(buffers: CpuFieldBuffers): void {
  const changes: { readonly x: number; readonly y: number; readonly material: CombatMaterialId; readonly life: number; readonly heat: number }[] = [];

  forEachAdjacentPair(buffers, (x, y, nx, ny, material, neighbor) => {
    const toxicWater =
      (material === combatMaterialIds.toxicSludge && neighbor === combatMaterialIds.water) ||
      (material === combatMaterialIds.water && neighbor === combatMaterialIds.toxicSludge);

    if (!toxicWater) {
      return;
    }

    changes.push({ x, y, material: combatMaterialIds.water, life: 0, heat: 0.1 });
    changes.push({ x: nx, y: ny, material: combatMaterialIds.water, life: 0, heat: 0.1 });
  });

  for (const change of changes) {
    setCell(buffers, change.x, change.y, change.material, change.life, change.heat);
  }
}

function reactAcidAndCorrodibleTerrain(buffers: CpuFieldBuffers): void {
  const changes: { readonly x: number; readonly y: number; readonly material: CombatMaterialId; readonly life: number; readonly heat: number }[] = [];

  forEachAdjacentPair(buffers, (x, y, nx, ny, material, neighbor) => {
    if (material === combatMaterialIds.acid && isCorrodible(neighbor)) {
      changes.push({ x: nx, y: ny, material: combatMaterialIds.smoke, life: 10, heat: 0.28 });
    } else if (neighbor === combatMaterialIds.acid && isCorrodible(material)) {
      changes.push({ x, y, material: combatMaterialIds.smoke, life: 10, heat: 0.28 });
    }
  });

  for (const change of changes) {
    setCell(buffers, change.x, change.y, change.material, change.life, change.heat);
  }
}

function reactBurnableTerrain(buffers: CpuFieldBuffers): void {
  const changes: { readonly x: number; readonly y: number; readonly material: CombatMaterialId; readonly life: number; readonly heat: number }[] = [];

  forEachAdjacentPair(buffers, (x, y, nx, ny, material, neighbor) => {
    if (material === combatMaterialIds.burnableTerrain && ignitesBurnable(neighbor)) {
      changes.push({ x, y, material: combatMaterialIds.fire, life: 18, heat: 0.9 });
      changes.push({ x: nx, y: ny, material: combatMaterialIds.smoke, life: 12, heat: 0.45 });
    }
  });

  for (const change of changes) {
    setCell(buffers, change.x, change.y, change.material, change.life, change.heat);
  }
}

function applyHeatField(buffers: CpuFieldBuffers): void {
  for (let y = 0; y < buffers.height; y += 1) {
    for (let x = 0; x < buffers.width; x += 1) {
      const index = indexOfCell(buffers, x, y);
      const material = buffers.material[index];

      if (material === combatMaterialIds.fire || material === combatMaterialIds.lava) {
        warmNeighbors(buffers, x, y, material === combatMaterialIds.lava ? 0.18 : 0.1);
      }

      if (material === combatMaterialIds.water && buffers.heat[index] > 0.8) {
        setCell(buffers, x, y, combatMaterialIds.steam, 16, 0.45);
      } else if (material === combatMaterialIds.sand && buffers.heat[index] > 0.7) {
        buffers.aux[index] = 1;
      } else {
        buffers.heat[index] = Math.max(0, buffers.heat[index] - 0.025);
      }
    }
  }
}

function applyForcePressure(buffers: CpuFieldBuffers): void {
  for (let y = 0; y < buffers.height; y += 1) {
    for (let x = 0; x < buffers.width; x += 1) {
      const index = indexOfCell(buffers, x, y);

      if (buffers.material[index] !== combatMaterialIds.force) {
        continue;
      }

      for (const [dx, dy] of adjacentOffsets) {
        const nx = x + dx;
        const ny = y + dy;
        const tx = nx + dx;
        const ty = ny + dy;

        if (!inBounds(buffers, nx, ny) || !inBounds(buffers, tx, ty)) {
          continue;
        }

        const neighborIndex = indexOfCell(buffers, nx, ny);
        const targetIndex = indexOfCell(buffers, tx, ty);
        const neighbor = buffers.material[neighborIndex];

        if ((isMovableByForce(neighbor) || neighbor === combatMaterialIds.sand) && buffers.material[targetIndex] === combatMaterialIds.air) {
          buffers.material[targetIndex] = neighbor;
          buffers.life[targetIndex] = buffers.life[neighborIndex];
          buffers.heat[targetIndex] = buffers.heat[neighborIndex];
          buffers.aux[targetIndex] = buffers.aux[neighborIndex];
          setCell(buffers, nx, ny, combatMaterialIds.air);
        }
      }
    }
  }
}

function coolSteam(buffers: CpuFieldBuffers): void {
  for (let index = 0; index < buffers.material.length; index += 1) {
    if (buffers.material[index] !== combatMaterialIds.steam) {
      continue;
    }

    if (buffers.life[index] > 0) {
      buffers.life[index] -= 1;
      continue;
    }

    buffers.material[index] = combatMaterialIds.water;
    buffers.heat[index] = 0.15;
  }
}

function forEachAdjacentPair(
  buffers: CpuFieldBuffers,
  visit: (x: number, y: number, nx: number, ny: number, material: CombatMaterialId, neighbor: CombatMaterialId) => void,
): void {
  for (let y = 0; y < buffers.height; y += 1) {
    for (let x = 0; x < buffers.width; x += 1) {
      const material = buffers.material[indexOfCell(buffers, x, y)] as CombatMaterialId;

      for (const [dx, dy] of adjacentOffsets) {
        const nx = x + dx;
        const ny = y + dy;

        if (!inBounds(buffers, nx, ny)) {
          continue;
        }

        visit(x, y, nx, ny, material, buffers.material[indexOfCell(buffers, nx, ny)] as CombatMaterialId);
      }
    }
  }
}

function warmNeighbors(buffers: CpuFieldBuffers, x: number, y: number, heatDelta: number): void {
  for (const [dx, dy] of adjacentOffsets) {
    const nx = x + dx;
    const ny = y + dy;

    if (!inBounds(buffers, nx, ny)) {
      continue;
    }

    const index = indexOfCell(buffers, nx, ny);
    buffers.heat[index] = Math.min(1, buffers.heat[index] + heatDelta);
  }
}

function isCorrodible(material: number): boolean {
  return material === combatMaterialIds.corrodibleTerrain || material === combatMaterialIds.staticTerrain;
}

function ignitesBurnable(material: number): boolean {
  return material === combatMaterialIds.fire || material === combatMaterialIds.spark || material === combatMaterialIds.lava;
}

function isMovableByForce(material: number): boolean {
  return (
    material === combatMaterialIds.water ||
    material === combatMaterialIds.lava ||
    material === combatMaterialIds.acid ||
    material === combatMaterialIds.toxicSludge ||
    material === combatMaterialIds.magicLiquid ||
    material === combatMaterialIds.smoke ||
    material === combatMaterialIds.steam
  );
}

const adjacentOffsets = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
