// Responsibility: Run a small deterministic CPU reference material simulation.
// Owner: features/combatField/reference

import {
  combatMaterialIds,
  combatMaterialNamesById,
  type CombatFieldQueryRequest,
  type CombatFieldQueryResult,
  type CombatMaterialName,
  type MaterialEmitter,
} from "../CombatFieldTypes";
import type { CombatFieldConfig } from "../CombatFieldConfig";
import { reactCpuMaterials } from "./CpuMaterialReaction";
import { moveCpuMaterials } from "./CpuMaterialMovement";
import type { CpuFieldBuffers } from "./CpuFieldBuffers";
import { indexOfCell, setCell } from "./CpuFieldBuffers";
import { queryCpuField } from "./CpuFieldQuery";

export class CpuCombatFieldSimulator {
  readonly buffers: CpuFieldBuffers;
  private frame = 0;

  constructor(config: CombatFieldConfig) {
    const cellCount = config.width * config.height;
    this.buffers = {
      width: config.width,
      height: config.height,
      material: new Uint8Array(cellCount),
      life: new Uint16Array(cellCount),
      aux: new Uint8Array(cellCount),
      heat: new Float32Array(cellCount),
    };
    this.seedStarterTerrain();
  }

  clear(): void {
    this.buffers.material.fill(combatMaterialIds.air);
    this.buffers.life.fill(0);
    this.buffers.aux.fill(0);
    this.buffers.heat.fill(0);
  }

  seedStarterTerrain(): void {
    this.clear();
    const floorY = Math.floor(this.buffers.height * 0.82);

    for (let y = floorY; y < this.buffers.height; y += 1) {
      for (let x = 0; x < this.buffers.width; x += 1) {
        setCell(this.buffers, x, y, combatMaterialIds.staticTerrain, 0, 0.15);
      }
    }

    for (let x = Math.floor(this.buffers.width * 0.12); x < Math.floor(this.buffers.width * 0.26); x += 1) {
      setCell(this.buffers, x, floorY - 1, combatMaterialIds.sand, 0, 0.12);
    }

    for (let x = Math.floor(this.buffers.width * 0.64); x < Math.floor(this.buffers.width * 0.78); x += 1) {
      setCell(this.buffers, x, floorY - 1, combatMaterialIds.water, 0, 0.05);
    }
  }

  step(emitters: readonly MaterialEmitter[] = []): void {
    for (const emitter of emitters) {
      this.emit(emitter);
    }

    reactCpuMaterials(this.buffers);
    moveCpuMaterials(this.buffers, this.frame);
    reactCpuMaterials(this.buffers);
    this.frame += 1;
  }

  emit(emitter: MaterialEmitter): void {
    const centerX = Math.round(emitter.x * (this.buffers.width - 1));
    const centerY = Math.round(emitter.y * (this.buffers.height - 1));
    const radiusCells = Math.max(1, Math.ceil(emitter.radius * Math.max(this.buffers.width, this.buffers.height)));
    const material = combatMaterialIds[emitter.material];
    const life = Math.max(1, Math.round(emitter.ttlMs / 16));
    const heat = material === combatMaterialIds.fire || material === combatMaterialIds.spark ? emitter.strength : emitter.strength * 0.2;

    for (let y = centerY - radiusCells; y <= centerY + radiusCells; y += 1) {
      for (let x = centerX - radiusCells; x <= centerX + radiusCells; x += 1) {
        if (x < 0 || x >= this.buffers.width || y < 0 || y >= this.buffers.height) {
          continue;
        }

        const dx = x - centerX;
        const dy = y - centerY;

        if (dx * dx + dy * dy > radiusCells * radiusCells) {
          continue;
        }

        const index = indexOfCell(this.buffers, x, y);
        const current = this.buffers.material[index];

        if (current === combatMaterialIds.staticTerrain && material !== combatMaterialIds.force) {
          continue;
        }

        this.buffers.material[index] = material;
        this.buffers.life[index] = life;
        this.buffers.heat[index] = heat;
      }
    }
  }

  query(request: CombatFieldQueryRequest): CombatFieldQueryResult[] {
    return queryCpuField(this.buffers, request);
  }

  setCell(x: number, y: number, material: CombatMaterialName, life = 0, heat = 0): void {
    setCell(this.buffers, x, y, combatMaterialIds[material], life, heat);
  }

  getCell(x: number, y: number): CombatMaterialName {
    return combatMaterialNamesById[this.buffers.material[indexOfCell(this.buffers, x, y)] as keyof typeof combatMaterialNamesById];
  }

  count(material: CombatMaterialName): number {
    const id = combatMaterialIds[material];
    let count = 0;

    for (const cell of this.buffers.material) {
      if (cell === id) {
        count += 1;
      }
    }

    return count;
  }
}
