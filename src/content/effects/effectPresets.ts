// Responsibility: Store editable effect presets used by the local effect tool and render snapshots.
// Owner: content/effects

import type { EffectPreset } from "./effectPresetTypes";

// @effect-presets-start
export const effectPresets = [
  {
    "id": "fireball-projectile",
    "label": "Fireball Projectile",
    "durationMs": 560,
    "loop": true,
    "preview": {
      "origin": {
        "x": 0.5,
        "y": 0.54
      },
      "direction": {
        "x": 1,
        "y": -0.08
      },
      "radius": 0.075,
      "bodySize": {
        "x": 0.082,
        "y": 0.082
      }
    },
    "layers": [
      {
        "id": "projectile-core",
        "label": "Projectile Core",
        "kind": "sprite",
        "outputKind": "fireball-projectile",
        "startMs": 0,
        "durationMs": 560,
        "sortLayer": 20,
        "drawMode": "texture",
        "offsetMode": "absolute",
        "offset": {
          "x": 0,
          "y": 0
        },
        "sizeMode": "absolute",
        "size": {
          "x": 0.112,
          "y": 0.082
        },
        "opacity": 1,
        "opacityCurve": [
          {
            "at": 0,
            "value": 1
          },
          {
            "at": 1,
            "value": 1
          }
        ],
        "opacitySource": {
          "kind": "none"
        },
        "color": "#ffffff",
        "blendMode": "screen",
        "rotationRadians": 0,
        "alignToDirection": true,
        "randomRotationRadians": 0,
        "randomScale": 0,
        "facingMode": "fixed",
        "softness": 0.55,
        "glowStrength": 0.55,
        "spawn": {
          "count": 1,
          "countJitter": 0,
          "distribution": "point",
          "spreadMode": "absolute",
          "spread": {
            "x": 0,
            "y": 0
          },
          "anchors": []
        },
        "textureKey": "firestaffProjectile",
        "sheetRect": {
          "x": 0,
          "y": 0,
          "width": 1,
          "height": 1
        },
        "frameCount": 8,
        "frameMs": 70,
        "frameMode": "loop"
      }
    ]
  },
  {
    "id": "fireball-impact",
    "label": "Fireball Impact",
    "durationMs": 560,
    "loop": false,
    "preview": {
      "origin": {
        "x": 0.52,
        "y": 0.58
      },
      "direction": {
        "x": 1,
        "y": 0
      },
      "radius": 0.15,
      "bodySize": {
        "x": 0.082,
        "y": 0.082
      }
    },
    "layers": [
      {
        "id": "impact-burst",
        "label": "Impact Burst",
        "kind": "sprite",
        "outputKind": "fireball-impact",
        "startMs": 0,
        "durationMs": 560,
        "sortLayer": 10,
        "drawMode": "texture",
        "offsetMode": "absolute",
        "offset": {
          "x": 0,
          "y": 0
        },
        "sizeMode": "radius",
        "size": {
          "x": 2.55,
          "y": 1.95
        },
        "opacity": 1,
        "opacityCurve": [
          {
            "at": 0,
            "value": 1
          },
          {
            "at": 0.72,
            "value": 1
          },
          {
            "at": 1,
            "value": 0.65
          }
        ],
        "opacitySource": {
          "kind": "none"
        },
        "color": "#fff2d2",
        "blendMode": "screen",
        "rotationRadians": 0,
        "alignToDirection": false,
        "randomRotationRadians": 0,
        "randomScale": 0,
        "facingMode": "fixed",
        "softness": 0.48,
        "glowStrength": 0.7,
        "spawn": {
          "count": 1,
          "countJitter": 0,
          "distribution": "point",
          "spreadMode": "absolute",
          "spread": {
            "x": 0,
            "y": 0
          },
          "anchors": []
        },
        "textureKey": "firestaffImpact",
        "sheetRect": {
          "x": 0,
          "y": 0,
          "width": 1,
          "height": 1
        },
        "frameCount": 8,
        "frameMs": 70,
        "frameMode": "once"
      }
    ]
  },
  {
    "id": "fire-area-burn",
    "label": "Fire Area Burn",
    "durationMs": 2000,
    "loop": true,
    "preview": {
      "origin": {
        "x": 0.5,
        "y": 0.6
      },
      "direction": {
        "x": 1,
        "y": 0
      },
      "radius": 0.15,
      "bodySize": {
        "x": 0.082,
        "y": 0.082
      }
    },
    "layers": [
      {
        "id": "ground-flames",
        "label": "Ground Flames",
        "kind": "sprite",
        "outputKind": "fire-area-burn",
        "startMs": 0,
        "durationMs": 2000,
        "sortLayer": 0,
        "drawMode": "texture",
        "offsetMode": "radius",
        "offset": {
          "x": 0,
          "y": -0.18
        },
        "sizeMode": "radius",
        "size": {
          "x": 0.46,
          "y": 0.82
        },
        "opacity": 0.72,
        "opacityCurve": [
          {
            "at": 0,
            "value": 1
          },
          {
            "at": 1,
            "value": 1
          }
        ],
        "opacitySource": {
          "kind": "lifeRatio",
          "min": 0.24,
          "max": 0.72
        },
        "color": "#fff0cc",
        "blendMode": "screen",
        "rotationRadians": 0,
        "alignToDirection": false,
        "randomRotationRadians": 0.28,
        "randomScale": 0.38,
        "facingMode": "random",
        "softness": 0.52,
        "glowStrength": 0.48,
        "spawn": {
          "count": 4,
          "countJitter": 0,
          "distribution": "box",
          "spreadMode": "radius",
          "spread": {
            "x": 1.45,
            "y": 0.62
          },
          "anchors": []
        },
        "textureKey": "firestaffBurn",
        "sheetRect": {
          "x": 0,
          "y": 0,
          "width": 1,
          "height": 1
        },
        "frameCount": 8,
        "frameMs": 90,
        "frameMode": "loop"
      }
    ]
  },
  {
    "id": "burn-overlay",
    "label": "Burn Overlay",
    "durationMs": 2000,
    "loop": true,
    "preview": {
      "origin": {
        "x": 0.5,
        "y": 0.54
      },
      "direction": {
        "x": 1,
        "y": 0
      },
      "radius": 0.075,
      "bodySize": {
        "x": 0.1,
        "y": 0.1
      }
    },
    "layers": [
      {
        "id": "body-flames",
        "label": "Body Flames",
        "kind": "sprite",
        "outputKind": "burn-overlay",
        "startMs": 0,
        "durationMs": 2000,
        "sortLayer": 30,
        "drawMode": "texture",
        "offsetMode": "absolute",
        "offset": {
          "x": 0,
          "y": -0.006
        },
        "sizeMode": "body",
        "size": {
          "x": 0.317,
          "y": 0.55
        },
        "opacity": 0.92,
        "opacityCurve": [
          {
            "at": 0,
            "value": 1
          },
          {
            "at": 1,
            "value": 1
          }
        ],
        "opacitySource": {
          "kind": "remainingFade",
          "fadeMs": 250,
          "max": 0.92
        },
        "color": "#fff0cc",
        "blendMode": "screen",
        "rotationRadians": 0,
        "alignToDirection": false,
        "randomRotationRadians": 0.34,
        "randomScale": 0.34,
        "facingMode": "random",
        "softness": 0.52,
        "glowStrength": 0.5,
        "spawn": {
          "count": 3,
          "countJitter": 0,
          "distribution": "anchors",
          "spreadMode": "body",
          "spread": {
            "x": 0.12,
            "y": 0.12
          },
          "anchors": [
            {
              "x": -0.2,
              "y": 0.08
            },
            {
              "x": 0.14,
              "y": -0.08
            },
            {
              "x": 0.02,
              "y": -0.24
            }
          ]
        },
        "textureKey": "firestaffBurn",
        "sheetRect": {
          "x": 0,
          "y": 0,
          "width": 1,
          "height": 1
        },
        "frameCount": 8,
        "frameMs": 90,
        "frameMode": "loop"
      }
    ]
  },
  {
    "id": "arcane-particle-burst",
    "label": "Arcane Particle Burst",
    "durationMs": 900,
    "loop": true,
    "preview": {
      "origin": {
        "x": 0.5,
        "y": 0.55
      },
      "direction": {
        "x": 1,
        "y": -0.18
      },
      "radius": 0.09,
      "bodySize": {
        "x": 0.1,
        "y": 0.1
      }
    },
    "layers": [
      {
        "id": "core-glow",
        "label": "Core Glow",
        "kind": "glow",
        "outputKind": "effect-glow",
        "startMs": 0,
        "durationMs": 900,
        "sortLayer": -5,
        "drawMode": "radial",
        "offsetMode": "absolute",
        "offset": {
          "x": 0,
          "y": 0
        },
        "sizeMode": "radius",
        "size": {
          "x": 2.4,
          "y": 2.4
        },
        "opacity": 0.62,
        "opacityCurve": [
          {
            "at": 0,
            "value": 0.25
          },
          {
            "at": 0.25,
            "value": 1
          },
          {
            "at": 1,
            "value": 0
          }
        ],
        "opacitySource": {
          "kind": "none"
        },
        "color": "#58c7ff",
        "blendMode": "additive",
        "rotationRadians": 0,
        "alignToDirection": false,
        "randomRotationRadians": 0,
        "randomScale": 0,
        "facingMode": "fixed",
        "softness": 0.72,
        "glowStrength": 1,
        "spawn": {
          "count": 1,
          "countJitter": 0,
          "distribution": "point",
          "spreadMode": "absolute",
          "spread": {
            "x": 0,
            "y": 0
          },
          "anchors": []
        }
      },
      {
        "id": "outward-particles",
        "label": "Outward Particles",
        "kind": "particle",
        "outputKind": "effect-particle",
        "startMs": 0,
        "durationMs": 900,
        "sortLayer": 5,
        "drawMode": "radial",
        "offsetMode": "absolute",
        "offset": {
          "x": 0,
          "y": 0
        },
        "sizeMode": "absolute",
        "size": {
          "x": 0.018,
          "y": 0.018
        },
        "opacity": 0.86,
        "opacityCurve": [
          {
            "at": 0,
            "value": 1
          },
          {
            "at": 0.7,
            "value": 0.8
          },
          {
            "at": 1,
            "value": 0
          }
        ],
        "opacitySource": {
          "kind": "none"
        },
        "color": "#72f2c6",
        "blendMode": "additive",
        "rotationRadians": 0,
        "alignToDirection": false,
        "randomRotationRadians": 3.14,
        "randomScale": 0.55,
        "facingMode": "fixed",
        "softness": 0.64,
        "glowStrength": 0.9,
        "spawn": {
          "count": 18,
          "countJitter": 4,
          "distribution": "box",
          "spreadMode": "radius",
          "spread": {
            "x": 0.35,
            "y": 0.2
          },
          "anchors": []
        },
        "textureKey": null,
        "sheetRect": {
          "x": 0,
          "y": 0,
          "width": 1,
          "height": 1
        },
        "frameCount": 1,
        "frameMs": 80,
        "frameMode": "hold",
        "lifetimeMs": 900,
        "velocity": {
          "x": 0.16,
          "y": -0.04
        },
        "speedJitter": 0.75,
        "spreadAngleRadians": 3.14,
        "gravity": {
          "x": 0,
          "y": 0.06
        },
        "drag": 0.4
      },
      {
        "id": "directional-trail",
        "label": "Directional Trail",
        "kind": "trail",
        "outputKind": "effect-trail",
        "startMs": 70,
        "durationMs": 520,
        "sortLayer": 3,
        "drawMode": "streak",
        "offsetMode": "absolute",
        "offset": {
          "x": -0.05,
          "y": 0.008
        },
        "sizeMode": "radius",
        "size": {
          "x": 2.8,
          "y": 0.34
        },
        "opacity": 0.58,
        "opacityCurve": [
          {
            "at": 0,
            "value": 0
          },
          {
            "at": 0.25,
            "value": 1
          },
          {
            "at": 1,
            "value": 0
          }
        ],
        "opacitySource": {
          "kind": "none"
        },
        "color": "#a7f08f",
        "blendMode": "screen",
        "rotationRadians": 0,
        "alignToDirection": true,
        "randomRotationRadians": 0,
        "randomScale": 0,
        "facingMode": "fixed",
        "softness": 0.58,
        "glowStrength": 0.72,
        "spawn": {
          "count": 1,
          "countJitter": 0,
          "distribution": "point",
          "spreadMode": "absolute",
          "spread": {
            "x": 0,
            "y": 0
          },
          "anchors": []
        }
      }
    ]
  }
] as const satisfies readonly EffectPreset[];
// @effect-presets-end

export function getEffectPreset(id: string): EffectPreset {
  const preset = effectPresets.find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(`Missing effect preset: ${id}`);
  }

  return preset;
}
