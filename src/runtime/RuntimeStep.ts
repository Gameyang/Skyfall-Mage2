// Responsibility: Document the high-level runtime update sequence.
// Owner: runtime

export const runtimeStepOrder = [
  "drain-command-queue",
  "apply-command-reducers",
  "advance-cpu-state",
  "flush-events",
  "publish-view-models",
  "render-frame",
] as const;

export type RuntimeStepName = (typeof runtimeStepOrder)[number];
