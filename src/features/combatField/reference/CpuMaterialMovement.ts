// Responsibility: Move powder, liquid, gas, and energy cells in the CPU reference field.
// Owner: features/combatField/reference

import { combatMaterialIds } from "../CombatFieldTypes";
import type { CpuFieldBuffers } from "./CpuFieldBuffers";
import { indexOfCell, inBounds, swapCells } from "./CpuFieldBuffers";

export function moveCpuMaterials(buffers: CpuFieldBuffers, frame: number): void {
  movePowderAndLiquid(buffers, frame);
  moveGas(buffers, frame);
}

function movePowderAndLiquid(buffers: CpuFieldBuffers, frame: number): void {
  for (let y = buffers.height - 2; y >= 0; y -= 1) {
    const leftFirst = ((frame + y) & 1) === 0;

    for (let xStep = 0; xStep < buffers.width; xStep += 1) {
      const x = leftFirst ? xStep : buffers.width - 1 - xStep;
      const index = indexOfCell(buffers, x, y);
      const material = buffers.material[index];

      if (material === combatMaterialIds.sand) {
        moveFallingCell(buffers, x, y, [0, leftFirst ? -1 : 1, leftFirst ? 1 : -1]);
      } else if (isLiquid(material)) {
        moveFallingCell(buffers, x, y, [0, leftFirst ? -1 : 1, leftFirst ? 1 : -1]);
        spreadLiquid(buffers, x, y, leftFirst ? -1 : 1);
      }
    }
  }
}

function moveGas(buffers: CpuFieldBuffers, frame: number): void {
  for (let y = 1; y < buffers.height; y += 1) {
    const leftFirst = ((frame + y) & 1) === 0;

    for (let xStep = 0; xStep < buffers.width; xStep += 1) {
      const x = leftFirst ? xStep : buffers.width - 1 - xStep;
      const index = indexOfCell(buffers, x, y);
      const material = buffers.material[index];

      if (material === combatMaterialIds.smoke || material === combatMaterialIds.steam) {
        moveRisingCell(buffers, x, y, [0, leftFirst ? -1 : 1, leftFirst ? 1 : -1]);
      }
    }
  }
}

function moveFallingCell(buffers: CpuFieldBuffers, x: number, y: number, offsets: readonly number[]): void {
  const from = indexOfCell(buffers, x, y);

  for (const offset of offsets) {
    const targetX = x + offset;
    const targetY = y + 1;

    if (!inBounds(buffers, targetX, targetY)) {
      continue;
    }

    const to = indexOfCell(buffers, targetX, targetY);

    if (canDisplaceDown(buffers.material[from], buffers.material[to])) {
      swapCells(buffers, from, to);
      return;
    }
  }
}

function moveRisingCell(buffers: CpuFieldBuffers, x: number, y: number, offsets: readonly number[]): void {
  const from = indexOfCell(buffers, x, y);

  for (const offset of offsets) {
    const targetX = x + offset;
    const targetY = y - 1;

    if (!inBounds(buffers, targetX, targetY)) {
      continue;
    }

    const to = indexOfCell(buffers, targetX, targetY);

    if (buffers.material[to] === combatMaterialIds.air) {
      swapCells(buffers, from, to);
      return;
    }
  }
}

function spreadLiquid(buffers: CpuFieldBuffers, x: number, y: number, direction: number): void {
  const from = indexOfCell(buffers, x, y);

  if (!isLiquid(buffers.material[from])) {
    return;
  }

  const targetX = x + direction;

  if (!inBounds(buffers, targetX, y)) {
    return;
  }

  const to = indexOfCell(buffers, targetX, y);

  if (buffers.material[to] === combatMaterialIds.air) {
    swapCells(buffers, from, to);
  }
}

function canDisplaceDown(material: number, target: number): boolean {
  if (target === combatMaterialIds.air) {
    return true;
  }

  return material === combatMaterialIds.sand && target === combatMaterialIds.water;
}

function isLiquid(material: number): boolean {
  return (
    material === combatMaterialIds.water ||
    material === combatMaterialIds.lava ||
    material === combatMaterialIds.acid ||
    material === combatMaterialIds.toxicSludge ||
    material === combatMaterialIds.magicLiquid
  );
}
