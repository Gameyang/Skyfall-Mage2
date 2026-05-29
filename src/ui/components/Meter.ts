// Responsibility: Render reusable resource meters.
// Owner: ui/components

export interface MeterHandle {
  readonly element: HTMLElement;
  update(current: number, max: number): void;
}

export function createMeter(className: string): MeterHandle {
  const element = document.createElement("div");
  element.className = `meter ${className}`;

  const fill = document.createElement("div");
  fill.className = "meter-fill";

  const label = document.createElement("span");
  label.className = "meter-label";

  element.append(fill, label);

  return {
    element,
    update(current: number, max: number) {
      const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, current / max));
      fill.style.transform = `scaleX(${ratio})`;
      label.textContent = `${Math.ceil(current)} / ${Math.ceil(max)}`;
    },
  };
}
