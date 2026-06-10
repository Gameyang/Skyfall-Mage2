// Responsibility: Store editable sprite-sheet frame and crop metadata.
// Owner: content/sheets

import type { SheetAssetRef, SheetDefinition } from "./sheetTypes";

// @sheet-definitions-start
export const sheetDefinitions = [
  {
    "id": "effect-firestaff-projectile",
    "label": "Firestaff Projectile",
    "asset": {
      "scope": "effects",
      "key": "firestaffProjectile"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 8,
    "frameMs": 70,
    "frameMode": "loop",
    "tags": [
      "effect",
      "fire",
      "projectile"
    ]
  },
  {
    "id": "effect-firestaff-impact",
    "label": "Firestaff Impact",
    "asset": {
      "scope": "effects",
      "key": "firestaffImpact"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 8,
    "frameMs": 70,
    "frameMode": "once",
    "tags": [
      "effect",
      "fire",
      "impact"
    ]
  },
  {
    "id": "effect-firestaff-burn",
    "label": "Firestaff Burn",
    "asset": {
      "scope": "effects",
      "key": "firestaffBurn"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 8,
    "frameMs": 90,
    "frameMode": "loop",
    "tags": [
      "effect",
      "fire",
      "burn"
    ]
  },
  {
    "id": "effect-water-entry-surface",
    "label": "Water Entry Surface",
    "asset": {
      "scope": "effects",
      "key": "waterEntrySurface"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 8,
    "frameMs": 70,
    "frameMode": "once",
    "tags": [
      "effect",
      "water"
    ]
  },
  {
    "id": "effect-water-entry-underwater",
    "label": "Water Entry Underwater",
    "asset": {
      "scope": "effects",
      "key": "waterEntryUnderwater"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 8,
    "frameMs": 70,
    "frameMode": "once",
    "tags": [
      "effect",
      "water"
    ]
  },
  {
    "id": "effect-water-underwater-loop",
    "label": "Water Underwater Loop",
    "asset": {
      "scope": "effects",
      "key": "waterUnderwaterLoop"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 8,
    "frameMs": 90,
    "frameMode": "loop",
    "tags": [
      "effect",
      "water"
    ]
  },
  {
    "id": "enemy-bat-animation",
    "label": "Bat Animation",
    "asset": {
      "scope": "enemies",
      "key": "batAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "unit"
    ]
  },
  {
    "id": "enemy-mini-tracking-animation",
    "label": "Mini Tracking Animation",
    "asset": {
      "scope": "enemies",
      "key": "miniTrackingAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "unit"
    ]
  },
  {
    "id": "enemy-mini-teleport-animation",
    "label": "Mini Teleport Animation",
    "asset": {
      "scope": "enemies",
      "key": "miniTeleportAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "unit"
    ]
  },
  {
    "id": "enemy-mini-split-animation",
    "label": "Mini Split Animation",
    "asset": {
      "scope": "enemies",
      "key": "miniSplitAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "unit"
    ]
  },
  {
    "id": "enemy-tracking-boss-animation",
    "label": "Tracking Boss Animation",
    "asset": {
      "scope": "enemies",
      "key": "trackingBossAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "boss"
    ]
  },
  {
    "id": "enemy-teleport-boss-animation",
    "label": "Teleport Boss Animation",
    "asset": {
      "scope": "enemies",
      "key": "teleportBossAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "boss"
    ]
  },
  {
    "id": "enemy-split-boss-animation",
    "label": "Split Boss Animation",
    "asset": {
      "scope": "enemies",
      "key": "splitBossAnimationSheet"
    },
    "rect": {
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "frameCount": 12,
    "frameMs": 90,
    "frameMode": "loop",
    "movementFrameCount": 8,
    "hitFrameCount": 4,
    "movementFrameMs": 90,
    "hitFrameMs": 75,
    "tags": [
      "enemy",
      "boss"
    ]
  }
] as const satisfies readonly SheetDefinition[];
// @sheet-definitions-end

export function getSheetDefinition(id: string): SheetDefinition {
  const definition = findSheetDefinition(id);

  if (!definition) {
    throw new Error(`Missing sheet definition: ${id}`);
  }

  return definition;
}

export function findSheetDefinition(id: string | null | undefined): SheetDefinition | null {
  return sheetDefinitions.find((definition) => definition.id === id) ?? null;
}

export function findSheetDefinitionsByAsset(asset: SheetAssetRef): readonly SheetDefinition[] {
  return sheetDefinitions.filter(
    (definition) => definition.asset.scope === asset.scope && definition.asset.key === asset.key,
  );
}
