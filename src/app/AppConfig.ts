// Responsibility: Hold top-level runtime and rendering defaults.
// Owner: app

export interface AppConfig {
  readonly maxDevicePixelRatio: number;
  readonly initialRuntimePaused: boolean;
  readonly showDebugHud: boolean;
}

export const defaultAppConfig: AppConfig = {
  maxDevicePixelRatio: 2,
  initialRuntimePaused: false,
  showDebugHud: import.meta.env.DEV,
};
