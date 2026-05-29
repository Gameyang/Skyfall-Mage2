// Responsibility: Provide the minimum material set required by the first field slice.
// Owner: features/combatField/materials

import type { MaterialDefinition } from "./MaterialDefinition";

export const starterMaterials: readonly MaterialDefinition[] = [
  { id: "air", density: 0, motion: "gas", heatCapacity: 0.1, color: [0, 0, 0, 0] },
  { id: "staticTerrain", density: 10, motion: "none", heatCapacity: 0.9, color: [64, 58, 48, 255] },
  { id: "sand", density: 6, motion: "powder", heatCapacity: 0.65, color: [194, 156, 89, 255] },
  { id: "water", density: 4, motion: "liquid", heatCapacity: 1, color: [68, 128, 202, 255] },
  { id: "fire", density: 1, motion: "energy", heatCapacity: 0.15, color: [230, 82, 44, 255] },
  { id: "smoke", density: 1, motion: "gas", heatCapacity: 0.32, color: [82, 82, 88, 180] },
  { id: "steam", density: 1, motion: "gas", heatCapacity: 0.38, color: [194, 211, 214, 160] },
  { id: "spark", density: 1, motion: "energy", heatCapacity: 0.1, color: [255, 215, 90, 255] },
  { id: "force", density: 0, motion: "energy", heatCapacity: 0.05, color: [88, 224, 206, 220] },
  { id: "magicEnergy", density: 0, motion: "energy", heatCapacity: 0.12, color: [172, 132, 226, 230] },
  { id: "lava", density: 5, motion: "liquid", heatCapacity: 1.3, color: [235, 82, 28, 255] },
  { id: "rock", density: 9, motion: "none", heatCapacity: 0.8, color: [92, 82, 72, 255] },
  { id: "acid", density: 3, motion: "liquid", heatCapacity: 0.7, color: [140, 214, 63, 230] },
  { id: "corrodibleTerrain", density: 8, motion: "none", heatCapacity: 0.6, color: [92, 108, 72, 255] },
  { id: "burnableTerrain", density: 7, motion: "none", heatCapacity: 0.45, color: [122, 88, 44, 255] },
  { id: "toxicSludge", density: 4, motion: "liquid", heatCapacity: 0.9, color: [74, 126, 38, 240] },
  { id: "magicLiquid", density: 3, motion: "liquid", heatCapacity: 0.5, color: [150, 88, 226, 230] },
  { id: "ice", density: 5, motion: "none", heatCapacity: 1.1, color: [150, 218, 242, 255] },
];

export const starterMaterialById = new Map(starterMaterials.map((material) => [material.id, material]));
