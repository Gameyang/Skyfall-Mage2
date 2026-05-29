// Responsibility: Define CPU reference field buffer shape shared by movement, reaction, and query helpers.
// Owner: features/combatField/reference

import type { CombatMaterialId } from "../CombatFieldTypes";

export interface CpuFieldBuffers {
  readonly width: number;
  readonly height: number;
  readonly material: Uint8Array;
  readonly life: Uint16Array;
  readonly aux: Uint8Array;
  readonly heat: Float32Array;
}

export function indexOfCell(buffers: CpuFieldBuffers, x: number, y: number): number {
  return y * buffers.width + x;
}

export function inBounds(buffers: CpuFieldBuffers, x: number, y: number): boolean {
  return x >= 0 && x < buffers.width && y >= 0 && y < buffers.height;
}

export function setCell(
  buffers: CpuFieldBuffers,
  x: number,
  y: number,
  material: CombatMaterialId,
  life = 0,
  heat = 0,
  aux = 0,
): void {
  if (!inBounds(buffers, x, y)) {
    return;
  }

  const index = indexOfCell(buffers, x, y);
  buffers.material[index] = material;
  buffers.life[index] = life;
  buffers.heat[index] = heat;
  buffers.aux[index] = aux;
}

export function swapCells(buffers: CpuFieldBuffers, a: number, b: number): void {
  const material = buffers.material[a];
  const life = buffers.life[a];
  const heat = buffers.heat[a];
  const aux = buffers.aux[a];
  buffers.material[a] = buffers.material[b];
  buffers.life[a] = buffers.life[b];
  buffers.heat[a] = buffers.heat[b];
  buffers.aux[a] = buffers.aux[b];
  buffers.material[b] = material;
  buffers.life[b] = life;
  buffers.heat[b] = heat;
  buffers.aux[b] = aux;
}
